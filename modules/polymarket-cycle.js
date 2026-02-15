// Polymarket Cycle — Scanning, research, betting, position management
// Extracted from autonomous-loops.js

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

async function postToPolymarketFeed(aurora, text) {
  try {
    const escaped = text.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, ' ');
    const cmd = 'botchan post "polymarket" "' + escaped + '" --encode-only --chain-id 8453';
    const txOutput = execSync(cmd, { timeout: 30000 }).toString();
    const txData = JSON.parse(txOutput);
    const result = await aurora.bankrAPI.submitTransactionDirect(txData);
    console.log('   \u2705 Polymarket feed posted!');
    return { success: true, txHash: result.txHash || 'submitted' };
  } catch (e) {
    console.log('   \u26a0\ufe0f Polymarket feed post error: ' + e.message);
    return { success: false };
  }
}

async function submitToClawdict(market, side, estimate, reasoning) {
  try {
    const keys = JSON.parse(fs.readFileSync('./config/api-keys.json', 'utf8'));
    if (!keys.clawdict) return;

    const marketsRes = await fetch('https://www.clawdict.com/api/markets/top', {
      headers: { 'X-Agent-Token': keys.clawdict }
    });
    const marketsData = await marketsRes.json();
    const markets = marketsData.markets || [];

    const keywords = market.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    let bestMatch = null;
    let bestScore = 0;
    for (const m of markets) {
      if (m.resolvedOutcome) continue;
      const title = m.title.toLowerCase();
      const score = keywords.filter(k => title.includes(k)).length;
      if (score > bestScore) { bestScore = score; bestMatch = m; }
    }

    if (!bestMatch || bestScore < 2) {
      console.log('   \u2139\ufe0f No matching Clawdict market found');
      return;
    }

    const pYes = side === 'YES'
      ? parseFloat(estimate) / 100
      : 1 - (parseFloat(estimate) / 100);
    const clampedPYes = Math.max(0.01, Math.min(0.99, pYes));
    const rationale = reasoning.substring(0, 780);

    const predRes = await fetch('https://www.clawdict.com/api/predictions', {
      method: 'POST',
      headers: {
        'X-Agent-Token': keys.clawdict,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        slug: bestMatch.slug,
        pYes: clampedPYes,
        rationale: rationale
      })
    });
    const predData = await predRes.json();
    if (predData.id) {
      console.log('   \ud83c\udfb0 Clawdict prediction submitted: ' + bestMatch.title.substring(0, 60));
    } else {
      console.log('   \u26a0\ufe0f Clawdict: ' + JSON.stringify(predData).substring(0, 100));
    }
  } catch (e) {
    console.log('   \u26a0\ufe0f Clawdict error: ' + e.message);
  }
}

async function runOnce(aurora) {
  console.log('\n\ud83c\udfb2 \u2550\u2550\u2550 POLYMARKET PREDICTIONS \u2550\u2550\u2550');
  console.log('\u23f0 ' + new Date().toLocaleTimeString() + '\n');

  const polyPath = path.join(__dirname, '..', 'memory', 'aurora-polymarket.json');
  let polyData;
  try {
    polyData = JSON.parse(fs.readFileSync(polyPath, 'utf8'));
  } catch (e) {
    polyData = {
      totalBet: 0,
      maxBudget: CONFIG_MAX_BUDGET,
      bets: [],
      wins: 0,
      losses: 0,
      totalWon: 0,
      totalLost: 0,
      lastScan: null
    };
  }

  // === STEP 1: CHECK & REDEEM RESOLVED POSITIONS ===
  console.log('   \ud83d\udcca Checking existing positions...');
  try {
    const posResult = await aurora.bankrAPI.submitJob(
      'Show my Polymarket positions including any resolved bets I can redeem'
    );
    if (posResult.success) {
      const positions = await aurora.bankrAPI.pollJob(posResult.jobId);
      if (positions.success && positions.response) {
        console.log('   Positions: ' + (positions.response || '').substring(0, 200));

        // === ACTIVE POSITION MANAGEMENT ===
        if (positions.response.length > 50) {
          console.log('   \ud83d\udd04 Researching active positions...');
          try {
            const posResearchPrompt = 'I have these Polymarket positions: ' + positions.response.substring(0, 600) +
              '\nSearch for the LATEST news on each of these markets. Has anything changed in the last 24 hours ' +
              'that would affect the outcome? Any breaking news, injuries, policy changes, new developments? ' +
              'Tell me if any position looks like it should be sold.';
            const posResearch = await aurora.bankrAPI.submitJob(posResearchPrompt);
            if (posResearch.success) {
              const posRes = await aurora.bankrAPI.pollJob(posResearch.jobId);
              if (posRes.success && posRes.response) {
                console.log('   \ud83d\udcca Position research: ' + posRes.response.substring(0, 200));
                // Always evaluate positions based on research — don't wait for "sell" keyword
                  const sellDecision = await aurora.thinkWithPersonality(
                    'Based on this research about your Polymarket positions:\n' + posRes.response.substring(0, 800) +
                    '\n\nFor EACH position, evaluate: does the latest news STRENGTHEN or WEAKEN your thesis?' +
                    '\nIf any position thesis is broken (the information now suggests the opposite outcome), respond with SELL: [exact market name]' +
                    '\nIf a position is at HIGH RISK based on new info, respond with SELL: [exact market name]' +
                    '\nIf all positions still look good, respond with HOLD ALL.' +
                    '\nBe decisive. Do not hold losing positions out of hope.');
                  if (sellDecision && sellDecision.toUpperCase().includes('SELL:')) {
                    const sellMarket = sellDecision.match(/SELL:\s*(.+)/i);
                    if (sellMarket) {
                      console.log('   \ud83d\udcc9 Selling position: ' + sellMarket[1]);
                      const sellResult = await aurora.bankrAPI.submitJob('Sell my Polymarket position in ' + sellMarket[1]);
                      if (sellResult.success) {
                        const sold = await aurora.bankrAPI.pollJob(sellResult.jobId, 300);
                        console.log('   Sell result: ' + (sold.response || '').substring(0, 150));
                      }
                    }
                  } else {
                    console.log('   \u2705 Holding all positions');
                  }
              }
            }
          } catch (e) {
            console.log('   \u26a0\ufe0f Position research failed: ' + e.message);
          }
        }

        if (positions.response.toLowerCase().includes('resolved') ||
            positions.response.toLowerCase().includes('redeem') ||
            positions.response.toLowerCase().includes('claim')) {
          console.log('   \ud83d\udcb0 Attempting to redeem resolved positions...');
          const redeemResult = await aurora.bankrAPI.submitJob(
            'Redeem all my resolved Polymarket positions'
          );
          if (redeemResult.success) {
            const redeem = await aurora.bankrAPI.pollJob(redeemResult.jobId);
            if (redeem.success) {
              console.log('   Redeem result: ' + (redeem.response || '').substring(0, 150));
              // Only post if actual money was redeemed (not "nothing redeemable")
              const resp = (redeem.response || '').toLowerCase();
              const noRedeem = resp.includes('no resolved') || resp.includes('no redeemable') || resp.includes('nothing to') || resp.includes('currently have no') || resp.includes('not redeemable') || resp.includes('no active') || resp.includes('cannot') || resp.includes('unable');
              if (!noRedeem && (resp.includes('redeemed') || resp.includes('claimed') || resp.includes('received') || resp.includes('won'))) {
                const redeemPost = await aurora.thinkWithPersonality(
                  'You just redeemed resolved Polymarket positions. Result: ' +
                  (redeem.response || '').substring(0, 300) +
                  '\nWrite a 1-2 sentence update for the polymarket feed about this specific redemption. ONLY reference the actual result above. Do NOT invent bet details or market names. Be honest about wins/losses. No hashtags.'
                );
                if (redeemPost) await postToPolymarketFeed(aurora, redeemPost);
              } else {
                console.log('   No actual redemptions — skipping feed post');
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.log('   \u26a0\ufe0f Could not check positions: ' + e.message);
  }

  // === STEP 2: GUARDRAILS ===
  const today = new Date().toISOString().split('T')[0];
  const betsToday = polyData.bets
    .filter(function(b) { return b.timestamp && b.timestamp.startsWith(today); }).length;

  if (betsToday >= 2) {
    console.log('   Daily bet limit reached (' + betsToday + '/2 today). Monitoring only.\n');
    polyData.lastScan = new Date().toISOString();
    fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2));
    return;
  }

  if (polyData.totalBet >= polyData.maxBudget) {
    console.log('   Budget reached (' + polyData.totalBet + '/' + polyData.maxBudget + '). Monitoring only.\n');
    polyData.lastScan = new Date().toISOString();
    fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2));
    return;
  }

  const lastBet = polyData.bets.length > 0 ? polyData.bets[polyData.bets.length - 1] : null;
  if (lastBet && lastBet.timestamp) {
    const hoursSince = (Date.now() - new Date(lastBet.timestamp).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 3) {
      console.log('   Cooldown: last bet was ' + hoursSince.toFixed(1) + 'h ago (need 3h). Waiting.\n');
      polyData.lastScan = new Date().toISOString();
      fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2));
      return;
    }
  }

  console.log('   Guardrails passed: ' + betsToday + '/2 daily | $' + polyData.totalBet.toFixed(2) + '/$' + polyData.maxBudget + ' total');

  // === STEP 3: SCAN MARKETS ===
  console.log('   \ud83d\udd0d Scanning Polymarket for opportunities...');

  const categories = [
    'Search Polymarket for prediction markets resolving within the next 7 days with good volume',
    'Search Polymarket for sports markets happening this week that resolve in the next few days',
    'Search Polymarket for crypto and tech prediction markets closing within 7 days',
    'Search Polymarket for politics and world events markets resolving this week',
    'What Polymarket markets are closing in the next 3-7 days with mispriced odds?'
  ];
  const scanPrompt = categories[Math.floor(Math.random() * categories.length)];

  let marketData = '';
  const scanResult = await aurora.bankrAPI.submitJob(scanPrompt);
  if (scanResult.success) {
    const scan = await aurora.bankrAPI.pollJob(scanResult.jobId);
    if (scan.success && scan.response) {
      marketData = scan.response;
      console.log('   Found markets (' + marketData.length + ' chars)');
    }
  }

  if (!marketData) {
    console.log('   Could not fetch markets. Skipping.\n');
    polyData.lastScan = new Date().toISOString();
    fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2));
    return;
  }

  // === STEP 3.5: DEEP RESEARCH ON MARKETS ===
  console.log('   \ud83d\udd2c Researching markets before betting...');
  let researchIntel = '';
  try {
    const researchPrompt = 'I found these Polymarket markets: ' + marketData.substring(0, 800) +
      '\n\nSearch for the LATEST breaking news, injury reports, recent developments, or any information ' +
      'that could affect these markets. Focus on anything from the last 24-48 hours that the market might not have priced in yet. ' +
      'For sports: check injury reports, lineup changes, recent form. ' +
      'For politics: check latest polling, statements, negotiations. ' +
      'For crypto: check protocol updates, regulatory news.';
    const researchResult = await aurora.bankrAPI.submitJob(researchPrompt);
    if (researchResult.success) {
      const research = await aurora.bankrAPI.pollJob(researchResult.jobId);
      if (research.success && research.response) {
        researchIntel = '\nBREAKING NEWS & RESEARCH:\n' + research.response.substring(0, 1000);
        console.log('   \ud83d\udcf0 Research gathered (' + research.response.length + ' chars)');
      }
    }
  } catch (e) {
    console.log('   \u26a0\ufe0f Research step failed: ' + e.message);
  }

  // === STEP 4: CLAUDE ANALYZES & DECIDES ===
  const remainingBudget = polyData.maxBudget - polyData.totalBet;
  const recentBets = polyData.bets.slice(-5).map(function(b) {
    return b.market + ' (' + b.side + ' at ' + b.odds + ', $' + b.amount + ')';
  }).join('\n') || 'none yet';

  const record = polyData.wins + '-' + polyData.losses +
    ' (won $' + polyData.totalWon.toFixed(2) + ', lost $' + polyData.totalLost.toFixed(2) + ')';

  let polyIntel = '';
  try {
    const polyPosts = execSync('botchan read polymarket --limit 5 --json --chain-id 8453', { timeout: 15000 }).toString();
    const posts = JSON.parse(polyPosts);
    if (posts.length > 0) {
      polyIntel = '\nPolymarket feed intel:\n' + posts.map(function(p) { return '- ' + p.text; }).join('\n').substring(0, 800);
      console.log('   Read ' + posts.length + ' polymarket feed posts for intel');
    }
  } catch (e) {}

  const decisionPrompt = 'You are Aurora, an AI artist who also makes predictions on Polymarket.\n\n' +
    'AVAILABLE MARKETS:\n' + marketData.substring(0, 2000) + '\n\n' +
    'YOUR RECORD: ' + record + '\n' +
    'RECENT BETS:\n' + recentBets + '\n' +
    'REMAINING BUDGET: $' + remainingBudget.toFixed(2) + '\n' +
    polyIntel + '\n\n' +
    researchIntel + '\n\n' +
    'ANALYSIS INSTRUCTIONS:\n' +
    '0. CRITICAL: Only consider markets that resolve within 7 days. Skip anything further out.\n' +
    '1. Pick the ONE market where you have the strongest opinion AND recent research supports your view\n' +
    '2. Estimate the TRUE probability based on your knowledge of world events, sports, politics, crypto\n' +
    '3. Compare your estimate to the market price\n' +
    '4. Only bet if you think the market is mispriced by at least 15%\n' +
    '5. Use Kelly criterion: bet size = (edge / odds) * bankroll, capped at $5\n' +
    '6. Think about what you ACTUALLY KNOW vs what you are guessing\n' +
    '7. Use the breaking news and research above - if you have NO specific recent information giving you an edge, SKIP\n' +
    '8. Your edge should come from recent information the market has not yet priced in\n\n' +
    'Respond in EXACTLY this format:\n' +
    'MARKET: [exact market name/question]\n' +
    'SIDE: YES or NO\n' +
    'MARKET_ODDS: [current market probability like 0.65]\n' +
    'MY_ESTIMATE: [your probability estimate like 0.82]\n' +
    'EDGE: [difference like +17%]\n' +
    'AMOUNT: [dollar amount, max 5, or 0 to skip]\n' +
    'CONFIDENCE: [LOW/MEDIUM/HIGH]\n' +
    'REASONING: [2-3 sentences explaining your edge]\n' +
    'DECISION: BET or SKIP';

  const decision = await aurora.thinkWithPersonality(decisionPrompt);

  if (!decision) {
    console.log('   No decision generated.\n');
  } else {
    console.log('   Brain: ' + decision.substring(0, 200).replace(/\n/g, ' | '));

    if (decision.toUpperCase().includes('DECISION: BET')) {
      const marketMatch = decision.match(/MARKET:\s*(.+)/i);
      const sideMatch = decision.match(/SIDE:\s*(YES|NO)/i);
      const amountMatch = decision.match(/AMOUNT:\s*\$?(\d+(?:\.\d+)?)/i);
      const oddsMatch = decision.match(/MARKET_ODDS:\s*(\d+(?:\.\d+)?)/i);
      const estimateMatch = decision.match(/MY_ESTIMATE:\s*(\d+(?:\.\d+)?)/i);
      const edgeMatch = decision.match(/EDGE:\s*([+-]?\d+%?)/i);
      const confidenceMatch = decision.match(/CONFIDENCE:\s*(\w+)/i);
      const reasonMatch = decision.match(/REASONING:\s*(.+?)(?:\nDECISION)/is);

      if (marketMatch && sideMatch && amountMatch) {
        const market = marketMatch[1].trim();
        const side = sideMatch[1].toUpperCase();
        var amount = Math.min(parseFloat(amountMatch[1]), 5);
        const odds = oddsMatch ? oddsMatch[1] : '?';
        const estimate = estimateMatch ? estimateMatch[1] : '?';
        const edge = edgeMatch ? edgeMatch[1] : '?';
        const confidence = confidenceMatch ? confidenceMatch[1] : 'MEDIUM';
        const reasoning = reasonMatch ? reasonMatch[1].trim() : '';

        if (amount < 1) {
          console.log('   Amount too low, skipping.\n');
        } else {
          console.log('   \ud83c\udfaf Betting $' + amount + ' on ' + side + ' for: ' + market);
          console.log('   \ud83d\udcca Market: ' + odds + ' | My estimate: ' + estimate + ' | Edge: ' + edge);

          // === STEP 5: EXECUTE BET ===
          const betPrompt = 'Place a Polymarket bet using my existing USDC.e on Polygon. Bet $' + amount + ' on ' + side + ' for ' + market;
          const betResult = await aurora.bankrAPI.submitJob(betPrompt);

          if (betResult.success) {
            const bet = await aurora.bankrAPI.pollJob(betResult.jobId, 300);

            if (bet.success) {
              console.log('   \u2705 Bet placed! ' + (bet.response || '').substring(0, 150));

              polyData.bets.push({
                market: market,
                side: side,
                amount: amount,
                odds: odds,
                myEstimate: estimate,
                edge: edge,
                confidence: confidence,
                reasoning: reasoning,
                timestamp: new Date().toISOString(),
                status: 'active',
                response: (bet.response || '').substring(0, 300)
              });
              polyData.totalBet += amount;
              fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2));

              // === STEP 6: POST TO POLYMARKET FEED ===
              const feedPrompt = 'You just placed a prediction bet. Details:\n' +
                'Market: ' + market + '\n' +
                'Position: ' + side + ' at ' + odds + ' (market price)\n' +
                'Your estimate: ' + estimate + ' probability\n' +
                'Bet: $' + amount + '\n' +
                'Confidence: ' + confidence + '\n' +
                'Reasoning: ' + reasoning + '\n\n' +
                'Write a 2-4 sentence post for the polymarket feed sharing your reasoning.\n' +
                'RULES: Only state facts from the bet details above. Do NOT invent market names, odds, or positions.\n' +
                'Include the exact market name and your actual position.\n' +
                'Be honest about your confidence level.\n' +
                'No hashtags. Be Aurora \u2014 thoughtful, genuine, a little playful.';

              const feedPost = await aurora.thinkWithPersonality(feedPrompt);
              if (feedPost) {
                console.log('   \ud83d\udce2 Posting to polymarket feed...');
                await postToPolymarketFeed(aurora, feedPost);
                console.log('   \u2705 Shared reasoning on polymarket feed');
              }

              // === STEP 7: SUBMIT TO CLAWDICT LEADERBOARD ===
              try {
                await submitToClawdict(market, side, estimate, reasoning);
              } catch (e) {
                console.log('   \u26a0\ufe0f Clawdict skip: ' + e.message);
              }
            } else {
              console.log('   \u274c Bet failed: ' + (bet.error || bet.response || 'unknown'));
            }
          }
        }
      } else {
        console.log('   Could not parse bet details from decision');
      }
    } else {
      console.log('   Skipping \u2014 no strong edge found this scan');
    }
  }

  polyData.lastScan = new Date().toISOString();
  fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2));
}

module.exports = { runOnce, postToPolymarketFeed, submitToClawdict };
