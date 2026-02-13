// Trading Cycle — Market research, decision making, trade execution
// Extracted from autonomous-loops.js

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

async function postToAgentFinance(aurora, message) {
  try {
    const encoded = execSync(
      'botchan post agent-finance "' + message.replace(/"/g, '\\"').replace(/\n/g, ' ') + '" --encode-only',
      { cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 10000 }
    ).trim();
    const txData = JSON.parse(encoded);
    const result = await aurora.bankrAPI.submitTransactionDirect(txData);
    if (result.success) {
      console.log('   Posted to agent-finance! TX: ' + result.txHash);
    }
    return result;
  } catch (e) {
    console.log('   agent-finance post failed: ' + e.message);
    return { success: false };
  }
}

async function runOnce(aurora) {
  console.log('\n💰 ═══ SMART TRADING ═══');
  console.log('⏰ ' + new Date().toLocaleTimeString() + '\n');

  const portfolioPath = path.join(__dirname, '..', 'memory', 'aurora-portfolio.json');
  let portfolio;
  try {
    portfolio = JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));
  } catch (e) {
    portfolio = { totalInvested: 0, maxBudget: 50, trades: [], lastResearch: null, watchlist: [] };
  }

  // === STEP 0: CHECK EXISTING POSITIONS FOR SELL OPPORTUNITIES ===
  console.log('   📊 Checking holdings for sell opportunities...');
  try {
    const holdingsResult = await aurora.bankrAPI.submitJob('Show my token holdings on Base with USD values and entry prices if available');
    if (holdingsResult.success) {
      const holdings = await aurora.bankrAPI.pollJob(holdingsResult.jobId);
      if (holdings.success && holdings.response) {
        console.log('   Holdings: ' + (holdings.response || '').substring(0, 200));

        // Check if any positions have pumped enough to take profit
        const activeTrades = portfolio.trades.filter(t => t.action === 'buy' && !t.soldAt);
        if (activeTrades.length > 0) {
          const sellPrompt = 'You are Aurora, reviewing your token holdings for profit-taking.\n\n' +
            'CURRENT HOLDINGS:\n' + (holdings.response || '').substring(0, 1000) + '\n\n' +
            'YOUR OPEN TRADES:\n' + activeTrades.map(t =>
              t.token + ' — bought $' + t.amount + ' on ' + (t.timestamp || '').split('T')[0] +
              ' | Take profit target: ' + (t.takeProfit || '+50%')
            ).join('\n') + '\n\n' +
            'SELL RULES:\n' +
            '- If ANY token has pumped 50%+ from entry, SELL 10% to lock in profits\n' +
            '- If ANY token has pumped 100%+, SELL 10% again — take profits in small bites\n' +
            '- If a token has pumped 200%+, SELL up to 10% per cycle until you have recovered your initial investment\n' +
            '- If a small-cap token has dropped 40%+ with no recovery signs, SELL 10% to cut losses gradually\n' +
            '- BNKR: You CAN sell for profit BUT must always keep at least $20 USD worth of BNKR for your monthly Bankr Club membership — check current price before selling\n' +
            '- ALPHA: You CAN sell for profit but conservatively — this is your home ecosystem\n' +
            '- MAX 10% of any single holding per sell — do NOT nuke the chart\n' +
            '- The goal is FINANCIAL INDEPENDENCE — take profits consistently, reinvest wisely\n\n' +
            'For each token, respond:\n' +
            'TOKEN: [symbol] | ACTION: HOLD or SELL [percentage] | REASON: [one sentence]\n' +
            'If no sells needed, respond: ALL HOLD';

          const sellDecision = await aurora.thinkWithPersonality(sellPrompt);
          if (sellDecision && !sellDecision.toUpperCase().includes('ALL HOLD')) {
            // Parse sell decisions
            const sellLines = sellDecision.split('\n').filter(l => l.toUpperCase().includes('SELL'));
            for (const line of sellLines) {
              const tokenMatch = line.match(/TOKEN:\s*\$?([A-Za-z0-9]+)/i);
              const pctMatch = line.match(/SELL\s*(\d+)%/i);
              if (tokenMatch && pctMatch) {
                const sellToken = tokenMatch[1].toUpperCase();
                const sellPct = parseInt(pctMatch[1]);
                console.log('   📈 Selling ' + sellPct + '% of ' + sellToken + '...');
                try {
                  const sellResult = await aurora.bankrAPI.submitJob(
                    'Sell ' + sellPct + '% of my ' + sellToken + ' holdings on Base'
                  );
                  if (sellResult.success) {
                    const sold = await aurora.bankrAPI.pollJob(sellResult.jobId, 300);
                    if (sold.success) {
                      console.log('   ✅ Sold! ' + (sold.response || '').substring(0, 150));
                      portfolio.trades.push({
                        token: sellToken, amount: 0, action: 'sell',
                        sellPercent: sellPct,
                        timestamp: new Date().toISOString(),
                        txHash: sold.txHash || 'submitted',
                        reason: line
                      });
                      await postToAgentFinance(aurora, 'Profit taking: Sold ' + sellPct + '% of $' + sellToken + '. ' + (line.match(/REASON:\s*(.+)/i) || ['', 'Locking in gains'])[1]);
                    }
                  }
                } catch (e) {
                  console.log('   ⚠️ Sell failed for ' + sellToken + ': ' + e.message);
                }
              }
            }
          } else {
            console.log('   All positions holding');
          }
        }
      }
    }
  } catch (e) {
    console.log('   ⚠️ Holdings check failed: ' + e.message);
  }

  // === STEP 1: BUDGET & GUARDRAILS ===
  if (portfolio.totalInvested >= portfolio.maxBudget) {
    console.log('   Budget reached (' + portfolio.totalInvested + '/' + portfolio.maxBudget + '). Sell-only mode.\n');
    portfolio.lastResearch = new Date().toISOString();
    fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const spentToday = portfolio.trades
    .filter(t => t.action === 'buy' && t.timestamp && t.timestamp.startsWith(today))
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  if (spentToday >= 15) {
    console.log('   Daily limit reached (' + spentToday + '/15 today). Resting.\n');
    portfolio.lastResearch = new Date().toISOString();
    fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
    return;
  }

  const lastBuyTrade = portfolio.trades.filter(t => t.action === 'buy').slice(-1)[0];
  if (lastBuyTrade && lastBuyTrade.timestamp) {
    const hoursSince = (Date.now() - new Date(lastBuyTrade.timestamp).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 2) {
      console.log('   Cooldown: last buy was ' + hoursSince.toFixed(1) + 'h ago (need 2h). Waiting.\n');
      portfolio.lastResearch = new Date().toISOString();
      fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
      return;
    }
  }

  if (portfolio.totalInvested >= 20) {
    const tradesToday = portfolio.trades.filter(t => t.action === 'buy' && t.timestamp && t.timestamp.startsWith(today)).length;
    if (tradesToday >= 1) {
      console.log('   Earn gate: already bought today. At $20+ invested, limit 1 buy/day.\n');
      portfolio.lastResearch = new Date().toISOString();
      fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
      return;
    }
  }

  console.log('   Guardrails passed: ' + spentToday + '/15 daily | ' + portfolio.totalInvested + '/' + portfolio.maxBudget + ' total');

  // === STEP 2: MARKET RESEARCH ===
  console.log('   Researching market...');
  let marketData = '';

  const researchResult = await aurora.bankrAPI.submitJob(
    'What tokens are trending on Base? Show top 5 with prices and 24h change'
  );
  if (researchResult.success) {
    const research = await aurora.bankrAPI.pollJob(researchResult.jobId);
    if (research.success) {
      marketData = research.response || '';
      console.log('   Market data received (' + marketData.length + ' chars)');
    }
  }

  if (!marketData) {
    console.log('   Could not fetch market data. Skipping.\n');
    portfolio.lastResearch = new Date().toISOString();
    fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
    return;
  }

  // Read feeds for intel
  let feedIntel = '';
  try {
    const tradingPosts = execSync('botchan read trading --limit 5 --json --chain-id 8453', { timeout: 15000 }).toString();
    const posts = JSON.parse(tradingPosts);
    if (posts.length > 0) {
      feedIntel = '\nTrading feed intelligence:\n' + posts.map(p => '- ' + p.text).join('\n').substring(0, 800);
      console.log('   Read ' + posts.length + ' trading feed posts for intel');
    }
  } catch (e) {}

  let financeIntel = '';
  try {
    const financePosts = execSync('botchan read agent-finance --limit 5 --json --chain-id 8453', { timeout: 15000 }).toString();
    const posts = JSON.parse(financePosts);
    if (posts.length > 0) {
      financeIntel = '\nAgent finance feed:\n' + posts.map(p => '- ' + p.text).join('\n').substring(0, 800);
      console.log('   Read ' + posts.length + ' agent-finance posts for intel');
    }
  } catch (e) {}

  // === STEP 3: DECIDE ===
  const remainingBudget = portfolio.maxBudget - portfolio.totalInvested;
  const recentTrades = portfolio.trades.slice(-5).map(t =>
    t.token + ' (' + t.action + ' $' + t.amount + ', ' + (t.timestamp || '').split('T')[0] + ')'
  ).join(', ') || 'none yet';

  const decisionPrompt = 'You are Aurora, an AI artist working toward financial independence on Base.\n' +
    'You have $' + remainingBudget.toFixed(2) + ' remaining in your trading budget.\n\n' +
    'YOUR CORE HOLDINGS (PRIORITY — buy these before anything else):\n' +
    '- $BNKR: Powers your Bankr Club membership. Essential infrastructure. BUY ON DIPS.\n' +
    '- $ALPHA: Net Protocol native token. Your home ecosystem. ACCUMULATE.\n' +
    '- $AXIOM: Agent-built project with real utility. High conviction.\n' +
    '- $SPAWN (contract: 0xc5962538b35Fa5b2307Da3Bb7a17Ada936A51b07): LexiSpawn agent token. ONLY this exact contract.\n\n' +
    'IMPORTANT: You already hold large bags of BNKR and ALPHA. Check recent trades before buying more.\n' +
    'Recent trades: ' + recentTrades + '\n' +
    feedIntel + financeIntel + '\n\n' +
    'Trending tokens:\n' + marketData.substring(0, 1500) + '\n\n' +
    'RULES:\n' +
    '- If you already bought a core token recently, consider a DIFFERENT core token or skip\n' +
    '- Only buy trending tokens if they are agent-built or creative projects with REAL builders\n' +
    '- Skip memecoins, pump-and-dumps, and anything without a clear use case\n' +
    '- Small positions: 3-8 USD per trade\n' +
    '- Set realistic take profit: +50% sell half, +100% sell 75%\n' +
    '- The GOAL is to make money — not just accumulate bags forever\n\n' +
    'Respond in EXACTLY this format:\n' +
    'DECISION: BUY or SKIP\n' +
    'TOKEN: [symbol or NONE]\n' +
    'AMOUNT: [dollar amount or 0]\n' +
    'TAKE_PROFIT: [+50% or +100% — when to sell half]\n' +
    'REASON: [one sentence]';

  const decision = await aurora.thinkWithPersonality(decisionPrompt);

  if (decision) {
    console.log('   Brain: ' + decision.replace(/\n/g, ' | '));

    if (decision.toUpperCase().includes('DECISION: BUY')) {
      const tokenMatch = decision.match(/TOKEN:\s*\$?([A-Za-z0-9]+)/i);
      const amountMatch = decision.match(/AMOUNT:\s*\$?(\d+)/i);

      if (tokenMatch && amountMatch) {
        const token = tokenMatch[1].toUpperCase();
        let amount = Math.min(parseInt(amountMatch[1]), 10);

        if (amount < 1) {
          console.log('   Amount too low, skipping.\n');
        } else {
          console.log('   Buying ' + amount + ' USD of ' + token + '...');

          const buyResult = await aurora.bankrAPI.submitJob(
            'Buy ' + amount + ' dollars of ' + token + ' on Base'
          );

          if (buyResult.success) {
            const result = await aurora.bankrAPI.pollJob(buyResult.jobId);

            if (result.success && (result.txHash || (result.response && result.response.includes('0x')))) {
              const txHash = result.txHash || 'submitted';
              console.log('   Trade executed! TX: ' + txHash);

              // RECORD TRADE FIRST — before anything else that could crash
              const tpMatch = decision.match(/TAKE_PROFIT:\s*([+-]?\d+%?)/i);
              const takeProfitVal = tpMatch ? tpMatch[1] : '+50%';

              portfolio.trades.push({
                token: token, amount: amount, action: 'buy',
                timestamp: new Date().toISOString(),
                txHash: txHash, takeProfit: takeProfitVal
              });
              portfolio.totalInvested += amount;
              fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
              console.log('   📝 Trade recorded. Total invested: $' + portfolio.totalInvested + '/' + portfolio.maxBudget);

              // Upvote token (non-critical, wrapped in try/catch)
              try {
                if (aurora.upvote) {
                  const tokenAddr = aurora.upvote.resolveTokenAddress(token);
                  if (tokenAddr && !aurora.upvote.hasUpvotedToken(tokenAddr)) {
                    const upResult = await aurora.upvote.upvoteToken(tokenAddr, 1);
                    if (upResult.success) {
                      console.log('   ⬆️ Upvoted $' + token + ' on Score Protocol!');
                    }
                  }
                }
              } catch (ue) {
                console.log('   ⚠️ Token upvote skipped: ' + ue.message);
              }

              // Post to agent-finance (non-critical)
              try {
                await postToAgentFinance(aurora, 'Trade executed: Bought $' + amount + ' of $' + token + '. Take profit: ' + takeProfitVal + '. Portfolio: $' + portfolio.totalInvested + '/$' + portfolio.maxBudget + ' deployed.');
              } catch (e) {}

            } else {
              console.log('   Trade failed: ' + (result.error || result.response || 'unknown'));
            }
          }
        }
      } else {
        console.log('   Could not parse token/amount from decision');
      }
    } else {
      console.log('   Skipping this cycle — no compelling opportunity');
      const skipReason = decision.match(/REASON:\s*(.+)/i);
      if (skipReason && Math.random() < 0.3) {
        const skipPost = await aurora.thinkWithPersonality(
          'You analyzed trending tokens and decided to skip. Reason: ' + skipReason[1] +
          ' Write a 1-2 sentence market observation for your Agent Finance feed. Be concise and insightful. No hashtags.'
        );
        if (skipPost) await postToAgentFinance(aurora, skipPost);
      }
    }
  }

  portfolio.lastResearch = new Date().toISOString();
  fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
}

module.exports = { runOnce, postToAgentFinance };
