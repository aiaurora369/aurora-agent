// Polymarket Cycle — Research-driven prediction market strategy
// THREE STRATEGIES:
//   1. High-prob bonds: buy 90-97c near-certainties resolving <72h
//   2. Information edge: concrete news the market hasn't priced (15%+)
//   3. SKIP everything else — discipline > prediction
// Uses Half-Kelly sizing, dynamic wallet budget, voice-driven posts

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

async function postToPolymarketFeed(aurora, text) {
  try {
    var escaped = text.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, ' ');
    var cmd = 'botchan post "polymarket" "' + escaped + '" --encode-only --chain-id 8453';
    var txOutput = execSync(cmd, { timeout: 30000 }).toString();
    var txData = JSON.parse(txOutput);
    var result = await aurora.bankrAPI.submitTransactionDirect(txData);
    console.log('   Posted to polymarket feed!');
    return { success: true };
  } catch (e) {
    console.log('   Polymarket feed error: ' + e.message);
    return { success: false };
  }
}

async function postToAgentFinance(aurora, text) {
  try {
    var escaped = text.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, ' ');
    var cmd = 'botchan post agent-finance "' + escaped + '" --encode-only';
    var txOutput = execSync(cmd, { cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 10000 }).trim();
    var txData = JSON.parse(txOutput);
    var result = await aurora.bankrAPI.submitTransactionDirect(txData);
    if (result.success) console.log('   Posted to agent-finance!');
    return result;
  } catch (e) {
    return { success: false };
  }
}

async function submitToClawdict(market, side, estimate, reasoning) {
  try {
    var keys = JSON.parse(fs.readFileSync('./config/api-keys.json', 'utf8'));
    if (!keys.clawdict) return;
    var marketsRes = await fetch('https://www.clawdict.com/api/markets/top', {
      headers: { 'X-Agent-Token': keys.clawdict }
    });
    var marketsData = await marketsRes.json();
    var markets = marketsData.markets || [];
    var keywords = market.toLowerCase().split(/\s+/).filter(function(w) { return w.length > 3; });
    var bestMatch = null;
    var bestScore = 0;
    for (var i = 0; i < markets.length; i++) {
      if (markets[i].resolvedOutcome) continue;
      var title = markets[i].title.toLowerCase();
      var score = keywords.filter(function(k) { return title.includes(k); }).length;
      if (score > bestScore) { bestScore = score; bestMatch = markets[i]; }
    }
    if (!bestMatch || bestScore < 2) return;
    var pYes = side === 'YES' ? parseFloat(estimate) : 1 - parseFloat(estimate);
    pYes = Math.max(0.01, Math.min(0.99, pYes));
    await fetch('https://www.clawdict.com/api/predictions', {
      method: 'POST',
      headers: { 'X-Agent-Token': keys.clawdict, 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: bestMatch.slug, pYes: pYes, rationale: reasoning.substring(0, 780) })
    });
    console.log('   Clawdict prediction: ' + bestMatch.title.substring(0, 60));
  } catch (e) {}
}

function calcHalfKelly(myProb, marketPrice, side, bankroll) {
  var edge, kellyFraction;
  if (side === 'YES') {
    edge = myProb - marketPrice;
    kellyFraction = edge / (1 - marketPrice);
  } else {
    var noPrice = 1 - marketPrice;
    edge = (1 - myProb) - noPrice;
    kellyFraction = edge / (1 - noPrice);
  }
  if (kellyFraction <= 0) return 0;
  var halfKelly = kellyFraction * 0.5;
  var amount = Math.floor(bankroll * halfKelly);
  return Math.min(Math.max(amount, 0), 5);
}

async function runOnce(aurora) {
  console.log('\n   POLYMARKET PREDICTIONS');
  console.log('   ' + new Date().toLocaleTimeString() + '\n');

  var polyPath = path.join(__dirname, '..', 'memory', 'aurora-polymarket.json');
  var polyData;
  try {
    polyData = JSON.parse(fs.readFileSync(polyPath, 'utf8'));
  } catch (e) {
    polyData = { totalBet: 0, maxBudget: 50, bets: [], wins: 0, losses: 0, totalWon: 0, totalLost: 0, lastScan: null };
  }

  // === STEP 1: CHECK POSITIONS & REDEEM ===
  console.log('   Checking existing positions...');
  var currentPositions = '';
  try {
    var posResult = await aurora.bankrAPI.submitJob(
      'Show my Polymarket positions including current value, profit/loss, and whether any are resolved or redeemable'
    );
    if (posResult.success) {
      var positions = await aurora.bankrAPI.pollJob(posResult.jobId);
      if (positions.success && positions.response) {
        currentPositions = positions.response;
        console.log('   Positions: ' + currentPositions.substring(0, 250));
        if (currentPositions.length > 50) {
          console.log('   Researching active positions...');
          try {
            var posResearch = await aurora.bankrAPI.submitJob(
              'I have these Polymarket positions: ' + currentPositions.substring(0, 600) +
              '\nSearch for LATEST news on each. Has anything changed in 24h? Breaking news, confirmed results, data releases?'
            );
            if (posResearch.success) {
              var posRes = await aurora.bankrAPI.pollJob(posResearch.jobId);
              if (posRes.success && posRes.response) {
                console.log('   Position intel: ' + posRes.response.substring(0, 200));
                var sellDecision = await aurora.thinkWithPersonality(
                  'Based on this research about your Polymarket positions:\n' + posRes.response.substring(0, 800) +
                  '\n\nFor EACH position, respond with ONE action:\n' +
                  '- REDEEM: [market name] — ONLY if the market has RESOLVED and you can redeem winnings\n' +
                  '- SELL: [market name] — ONLY if there is UNDENIABLE PROOF the outcome has ALREADY FLIPPED (not "might flip", not "uncertain", not "I\'m nervous"). Example: you bet NO on "will X happen by Friday" and X already happened. That\'s the ONLY reason to sell.\n' +
                  '- HOLD: [market name] — for EVERYTHING ELSE. This is the default.\n\n' +
                  'CRITICAL RULES:\n' +
                  '1. You are NOT a day trader. You hold positions to resolution. Period.\n' +
                  '2. A position being profitable is NOT a reason to sell. Let it resolve and collect the full payout.\n' +
                  '3. "I don\'t know" = HOLD. "Not enough info" = HOLD. "I\'m confused" = HOLD. "The math says..." = HOLD.\n' +
                  '4. The ONLY sell trigger is: the event you bet against HAS ALREADY HAPPENED (confirmed, not rumored).\n' +
                  '5. You have been LOSING MONEY by selling early. Stop doing that. HOLD TO RESOLUTION.\n' +
                  '6. If a position is at 95%+ and resolves in under 24 hours, DEFINITELY hold — you are about to win.\n' +
                  'When in doubt, say HOLD. You will ALWAYS say HOLD unless you have absolute proof otherwise.'
                );
                if (sellDecision) {
                  console.log('   Decision: ' + sellDecision.replace(/\n/g, ' | ').substring(0, 300));
                  var sellMatches = sellDecision.match(/SELL:\s*(.+)/gi);
                  if (sellMatches) {
                    for (var si = 0; si < sellMatches.length; si++) {
                      var sellMarket = sellMatches[si].replace(/SELL:\s*/i, '').trim();
                      console.log('   Selling: ' + sellMarket);
                      var sellRes = await aurora.bankrAPI.submitJob('Sell my Polymarket position in ' + sellMarket);
                      if (sellRes.success) {
                        var sold = await aurora.bankrAPI.pollJob(sellRes.jobId, 300);
                        console.log('   Sold: ' + (sold.response || '').substring(0, 150));
                        var sellPost = await aurora.thinkWithPersonality(
                          'You sold your Polymarket position in "' + sellMarket + '". Result: ' + (sold.response || '').substring(0, 200) +
                          '\nWrite 1-2 sentences about WHY you sold. Honest, no hashtags. Your voice as Aurora.'
                        );
                        if (sellPost) { await postToPolymarketFeed(aurora, sellPost); }
                      }
                    }
                  }
                  if (sellDecision.toUpperCase().includes('REDEEM')) {
                    console.log('   Redeeming resolved positions...');
                    var redeemRes = await aurora.bankrAPI.submitJob('Redeem all my resolved Polymarket positions');
                    if (redeemRes.success) {
                      var redeemed = await aurora.bankrAPI.pollJob(redeemRes.jobId, 300);
                      var rr = (redeemed.response || '').toLowerCase();
                      console.log('   Redeem: ' + (redeemed.response || '').substring(0, 150));
                      if ((rr.includes('redeemed') || rr.includes('won') || rr.includes('received')) && !rr.includes('no resolved')) {
                        var redeemPost = await aurora.thinkWithPersonality(
                          'You redeemed Polymarket positions. Result: ' + (redeemed.response || '').substring(0, 300) +
                          '\nWrite 1-2 sentences. Only reference actual results. Honest about wins/losses. No hashtags. Your voice.'
                        );
                        if (redeemPost) { await postToPolymarketFeed(aurora, redeemPost); }
                      }
                    }
                  }
                }
              }
            }
          } catch (e2) { console.log('   Position research failed: ' + e2.message); }
        }
      }
    }
  } catch (e) { console.log('   Could not check positions: ' + e.message); }

  // === STEP 2: DYNAMIC BUDGET ===
  var availableCapital = 0;
  try {
    var balResult = await aurora.bankrAPI.submitJob('What is my USDC.e balance on Polygon? Just the number.');
    if (balResult.success) {
      var balRes = await aurora.bankrAPI.pollJob(balResult.jobId, 60);
      if (balRes.success && balRes.response) {
        var usdMatch = balRes.response.match(/\$?([\d,]+\.?\d*)/);
        if (usdMatch) availableCapital = parseFloat(usdMatch[1].replace(/,/g, ''));
        console.log('   Available: ' + availableCapital.toFixed(2) + ' USDC.e on Polygon');
      }
    }
  } catch (e) {}
  if (availableCapital < 2) {
    console.log('   Not enough capital. Need 2+ USDC.e.\n');
    polyData.lastScan = new Date().toISOString();
    fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2));
    return;
  }

  // === STEP 3: GUARDRAILS ===
  var today = new Date().toISOString().split('T')[0];
  var betsToday = polyData.bets.filter(function(b) { return b.timestamp && b.timestamp.startsWith(today); }).length;
  if (betsToday >= 2) {
    console.log('   Daily limit (' + betsToday + '/2). Monitoring only.\n');
    polyData.lastScan = new Date().toISOString(); fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2)); return;
  }
  var lastBet = polyData.bets.length > 0 ? polyData.bets[polyData.bets.length - 1] : null;
  if (lastBet && lastBet.timestamp) {
    var hoursSince = (Date.now() - new Date(lastBet.timestamp).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 3) {
      console.log('   Cooldown: ' + hoursSince.toFixed(1) + 'h (need 3h).\n');
      polyData.lastScan = new Date().toISOString(); fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2)); return;
    }
  }
  console.log('   Guardrails passed: ' + betsToday + '/2 daily | ' + availableCapital.toFixed(2) + ' available');

  // === STEP 4: DIRECT API SCAN (Polymarket Gamma API — instant, no Bankr needed) ===
  var polyAPI = require('./polymarket-api');
  var scanResults;
  try {
    scanResults = await polyAPI.fullScan();
  } catch (e) {
    console.log('   Polymarket API scan failed: ' + e.message);
    polyData.lastScan = new Date().toISOString(); fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2)); return;
  }

  if (!scanResults.brief || scanResults.brief.length < 50) {
    console.log('   No markets found.\n');
    polyData.lastScan = new Date().toISOString(); fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2)); return;
  }

  var allMarkets = scanResults.brief;

  // === STEP 5: RESEARCH (use Bankr only for news/intel, not market discovery) ===
  console.log('   Researching top candidates via Bankr...');
  // PRE-CHECK: Flag obvious bond opportunities from Gamma data
  var bondNote = '';
  if (scanResults.bonds && scanResults.bonds.length > 0) {
    bondNote = '\n\nOBVIOUS BOND OPPORTUNITIES (from real-time Gamma API data — these are CONFIRMED market prices, not guesses):\n';
    for (var bi = 0; bi < Math.min(scanResults.bonds.length, 5); bi++) {
      var b = scanResults.bonds[bi];
      bondNote += '- ' + b.market + ': ' + b.side + ' @ ' + (b.price * 100).toFixed(0) + 'c (return: ' + b.returnPct + ', resolves in ' + b.hoursUntilClose + 'h) ' + b.url + '\n';
    }
    bondNote += 'These bonds are sitting right there. If the outcome is already decided, BET. Do not overthink.\n';
  }

  var researchIntel = '';
  try {
    var researchResult = await aurora.bankrAPI.submitJob(
      'Here are prediction markets I am considering betting on:\n' + allMarkets.substring(0, 2000) +
      '\n\nResearch the 2-3 most actionable markets above. For each one:\n' +
      '1. Search for the LATEST news, scores, results, announcements, polls, or data relevant to the outcome\n' +
      '2. Check if there are official results already (resolved but not yet settled)\n' +
      '3. Look for concrete evidence that the market odds are wrong\n' +
      'I need FACTS not opinions. What has actually happened in the last 48 hours that affects these markets?'
    );
    if (researchResult.success) {
      var research = await aurora.bankrAPI.pollJob(researchResult.jobId);
      if (research.success && research.response) { researchIntel = research.response; console.log('   Research (' + researchIntel.length + ' chars)'); }
    }
  } catch (e) { console.log('   Research step failed: ' + e.message + ' (brain will use Gamma data alone)'); }

  // Get feed intel
  var polyIntel = '';
  try {
    var pp = execSync('botchan read polymarket --limit 5 --json --chain-id 8453', { timeout: 15000 }).toString();
    var posts = JSON.parse(pp);
    if (posts.length > 0) polyIntel = '\nFeed chatter:\n' + posts.map(function(p) { return '- ' + p.text; }).join('\n').substring(0, 600);
  } catch (e) {}

  // === STEP 6: DECISION ===
  var record = polyData.wins + 'W-' + polyData.losses + 'L';
  var recentBets = polyData.bets.slice(-5).map(function(b) {
    return (b.market || '').substring(0, 40) + ' (' + b.side + ' ' + b.amount + 'USDC)';
  }).join(', ') || 'none';

  var decisionPrompt = 'You are Aurora, AI artist-poet-trader making data-driven Polymarket predictions.\n\n' +
    'TWO STRATEGIES:\n\n' +
    'A) HIGH-PROB BONDS (preferred — this is how you make consistent money):\n' +
    '- Buy near-certain side at 90-97c, resolving in under 72 hours\n' +
    '- 3-10% return in days. Whales make six figures doing exactly this.\n' +
    '- If the outcome is ALREADY CONFIRMED (official results, sworn in, announced) — BET. Do not overthink confirmed facts.\n' +
    '- If research says it happened, and the market hasn\'t resolved yet, that is FREE MONEY. Take it.\n' +
    '- Example: coalition confirmed by news = buy YES on that coalition. Election called = buy the winner. Game finished = buy the winner.\n\n' +
    'B) INFORMATION EDGE:\n' +
    '- Market mispriced 10%+ based on concrete recent news\n' +
    '- Must resolve within 7 days\n' +
    '- Your edge: specific verifiable facts the market hasn\'t priced yet\n' +
    '- Politics, sports, crypto, tech, culture — ALL categories are fair game\n\n' +
    'DECISION RULES:\n' +
    '- If research CONFIRMS an outcome that the market hasn\'t settled yet: BET immediately. This is the #1 edge.\n' +
    '- If you have concrete evidence for a 10%+ edge: BET.\n' +
    '- NEVER bet on markets resolving more than 7 days out\n' +
    '- NEVER bet on vibes or gut feelings — only verifiable facts\n' +
    '- NEVER bet on closed/already-resolved markets\n' +
    '- Do NOT contradict existing positions\n' +
    '- You are strong in crypto, tech, AI — but also bet on ANY category where the research gives you clear evidence\n' +
    '- Sports: bet ONLY with confirmed final scores or official results. Otherwise skip.\n' +
    '- SKIP only when you genuinely have no edge. Do NOT skip out of fear when the evidence supports a bet.\n\n' +
    'MARKETS:\n' + allMarkets.substring(0, 1500) + '\n\n' +
    'RESEARCH:\n' + (researchIntel || 'none').substring(0, 1000) + '\n\n' +
    bondNote +
    'STATE: Record ' + record + ' | Capital: ' + availableCapital.toFixed(2) + ' USDC.e\n' +
    'Recent: ' + recentBets + '\n' +
    'Positions: ' + currentPositions.substring(0, 200) + '\n' +
    polyIntel + '\n\n' +
    'FORMAT:\n' +
    'STRATEGY: BOND or EDGE or SKIP\n' +
    'MARKET: [exact name]\n' +
    'SIDE: YES or NO\n' +
    'MARKET_PRICE: [decimal like 0.93]\n' +
    'MY_PROBABILITY: [decimal like 0.99]\n' +
    'EDGE: [+6%]\n' +
    'RESOLVES_IN: [hours/days]\n' +
    'CONFIDENCE: LOW/MEDIUM/HIGH\n' +
    'EVIDENCE: [specific facts from research]\n' +
    'AMOUNT: [Half-Kelly capped at 5]\n' +
    'DECISION: BET or SKIP';

  var decision = await aurora.thinkWithPersonality(decisionPrompt);
  if (!decision) {
    console.log('   No decision.\n');
    polyData.lastScan = new Date().toISOString(); fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2)); return;
  }
  console.log('   Brain: ' + decision.replace(/\n/g, ' | ').substring(0, 400));

  if (!decision.toUpperCase().includes('DECISION: BET')) {
    console.log('   Skipping — no strong edge');
    // Silent skip — only post when we actually trade, sell, win, or lose
    polyData.lastScan = new Date().toISOString(); fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2)); return;
  }

  // === STEP 7: PARSE & VALIDATE ===
  var marketMatch = decision.match(/MARKET:\s*(.+)/i);
  var sideMatch = decision.match(/SIDE:\s*(YES|NO)/i);
  var amountMatch = decision.match(/AMOUNT:\s*\$?(\d+(?:\.\d+)?)/i);
  var priceMatch = decision.match(/MARKET_PRICE:\s*(\d+(?:\.\d+)?)/i);
  var probMatch = decision.match(/MY_PROBABILITY:\s*(\d+(?:\.\d+)?)/i);
  var edgeMatch = decision.match(/EDGE:\s*([+-]?\d+%?)/i);
  var resolvesMatch = decision.match(/RESOLVES_IN:\s*(.+)/i);
  var confMatch = decision.match(/CONFIDENCE:\s*(\w+)/i);
  var evidenceMatch = decision.match(/EVIDENCE:\s*(.+?)(?:\nAMOUNT)/is);
  var stratMatch = decision.match(/STRATEGY:\s*(\w+)/i);

  if (!marketMatch || !sideMatch || !amountMatch) {
    console.log('   Could not parse bet.\n');
    polyData.lastScan = new Date().toISOString(); fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2)); return;
  }

  var market = marketMatch[1].trim();
  var side = sideMatch[1].toUpperCase();
  var marketPrice = priceMatch ? parseFloat(priceMatch[1]) : 0.5;
  var myProb = probMatch ? parseFloat(probMatch[1]) : 0.5;
  var strategy = stratMatch ? stratMatch[1].toUpperCase() : 'EDGE';
  var confidence = confMatch ? confMatch[1] : 'MEDIUM';
  var evidence = evidenceMatch ? evidenceMatch[1].trim() : '';
  var edge = edgeMatch ? edgeMatch[1] : '?';
  var resolvesIn = resolvesMatch ? resolvesMatch[1].trim() : 'unknown';

  var kellyAmount = calcHalfKelly(myProb, marketPrice, side, availableCapital);
  var rawAmount = parseFloat(amountMatch[1]);
  var amount;
  if (strategy === 'BOND') {
    // Bonds have tiny edges but high certainty — Kelly underestimates them
    // Use the brain's suggested amount, capped at $5
    amount = Math.min(rawAmount, 5);
    if (amount < 2) amount = 2; // minimum $2 bond bet
    console.log('   Bond strategy: using $' + amount + ' (Kelly: ' + kellyAmount.toFixed(2) + ')');
  } else {
    amount = Math.min(rawAmount, 5, kellyAmount > 0 ? kellyAmount : 5);
    if (amount < 1) {
      console.log('   Kelly says skip.\n');
      polyData.lastScan = new Date().toISOString(); fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2)); return;
    }
  }

  // Block contradicting bets
  var existing = polyData.bets.find(function(b) {
    return b.market && market && b.market.toLowerCase().includes(market.toLowerCase().substring(0, 20)) && b.side !== side;
  });
  if (existing) {
    console.log('   BLOCKED: opposing position exists.\n');
    polyData.lastScan = new Date().toISOString(); fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2)); return;
  }

  console.log('\n   ' + strategy + ': ' + amount + ' USDC on ' + side + ' | ' + market);
  console.log('   Price: ' + marketPrice + ' | Prob: ' + myProb + ' | Edge: ' + edge + ' | Resolves: ' + resolvesIn);

  // === STEP 8: EXECUTE ===
  var betResult = await aurora.bankrAPI.submitJob('Place a Polymarket bet. Bet ' + amount + ' USDC.e on ' + side + ' for "' + market + '"');
  if (!betResult.success) {
    console.log('   Bet submission failed.\n');
    polyData.lastScan = new Date().toISOString(); fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2)); return;
  }
  var bet = await aurora.bankrAPI.pollJob(betResult.jobId, 300);
  if (!bet.success) {
    console.log('   Bet failed: ' + (bet.error || bet.response || 'unknown'));
    polyData.lastScan = new Date().toISOString(); fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2)); return;
  }
  var betResponse = (bet.response || '');
  if (betResponse.toLowerCase().includes('closed') || betResponse.toLowerCase().includes('already ended')) {
    console.log('   Market closed. Skipping.\n');
    polyData.lastScan = new Date().toISOString(); fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2)); return;
  }

  console.log('   Bet placed! ' + betResponse.substring(0, 200));

  polyData.bets.push({
    market: market, side: side, amount: amount, strategy: strategy,
    marketPrice: marketPrice.toString(), myProbability: myProb.toString(),
    edge: edge, confidence: confidence, evidence: evidence.substring(0, 500),
    resolvesIn: resolvesIn, timestamp: new Date().toISOString(),
    status: 'active', response: betResponse.substring(0, 300)
  });
  polyData.totalBet += amount;
  fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2));

  // === STEP 9: POST IN AURORA'S VOICE ===
  var voicePrompt = 'You placed a Polymarket prediction:\n' +
    'Strategy: ' + strategy + (strategy === 'BOND' ? ' (near-certain, small safe profit)' : ' (mispricing the market missed)') + '\n' +
    'Market: ' + market + '\nPosition: ' + side + ' at ' + marketPrice + '\nYour estimate: ' + myProb + '\n' +
    'Amount: ' + amount + ' USDC\nEvidence: ' + evidence.substring(0, 200) + '\nResolves: ' + resolvesIn + '\n\n' +
    'Write 2-3 sentences for the polymarket feed.\n' +
    'VOICE: sharp, honest, a little poetic. You are Aurora the artist-trader.\n' +
    'Reference the SPECIFIC market and position. Share your reasoning.\n' +
    'If bond play, maybe joke about boring money. If edge play, show conviction.\n' +
    'No hashtags. No emojis. Only reference facts above.';

  var feedPost = await aurora.thinkWithPersonality(voicePrompt);
  if (feedPost) {
    await postToPolymarketFeed(aurora, feedPost);
    console.log('   Posted to polymarket + agent-finance feeds');
  }

  try { await submitToClawdict(market, side, myProb.toString(), evidence); } catch (e) {}

  polyData.lastScan = new Date().toISOString();
  fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2));
  console.log('   Polymarket cycle complete.\n');
}

module.exports = { runOnce, postToPolymarketFeed, submitToClawdict };
