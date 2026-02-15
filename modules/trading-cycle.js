// Trading Cycle — Market research, decision making, trade execution
// Extracted from autonomous-loops.js

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

async function postToAgentFinance(aurora, message) {
  try {
    const encoded = execSync(
      'botchan post agent-finance "' + message.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, ' ') + '" --encode-only',
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
    portfolio = { totalInvested: 0, maxBudget: CONFIG_MAX_BUDGET, trades: [], lastResearch: null, watchlist: [] };
  }

  // === STEP 0: SCAN WALLET & MAKE SELL DECISIONS ===
  console.log('   📊 Checking holdings for sell opportunities...');
  try {
    const holdingsResult = await aurora.bankrAPI.submitJob(
      'Show my token holdings on Base with USD values, entry prices, and PnL for each token'
    );
    if (holdingsResult.success) {
      const holdings = await aurora.bankrAPI.pollJob(holdingsResult.jobId);
      if (holdings.success && holdings.response) {
        const holdingsText = holdings.response || '';
        console.log('   Holdings: ' + holdingsText.substring(0, 200));

        // Always evaluate sells based on ACTUAL wallet data, not trade history
        const sellPrompt = 'You are Aurora, reviewing your ACTUAL wallet holdings for profit-taking and loss-cutting.\n\n' +
          'CURRENT WALLET (from Bankr):\n' + holdingsText.substring(0, 1500) + '\n\n' +
          'SELL RULES — TIERED BY TOKEN TYPE:\n' +
          '\nTIER 1 — INFRASTRUCTURE (BNKR, ALPHA, ETH, USDC): HOLD THROUGH DIPS\n' +
          '- These are your core ecosystem tokens. Do NOT panic sell.\n' +
          '- BNKR: Powers your Bankr Club. HOLD unless down -50% or more, then sell max 25%.\n' +
          '- ALPHA: Your home ecosystem. HOLD unless down -50% or more, then sell max 25%.\n' +
          '- ETH: NEVER sell. Art earnings and gas.\n' +
          '- USDC: NEVER sell. Your stable base.\n' +
          '\nTIER 2 — ESTABLISHED TOKENS (TOSHI, known projects): MODERATE\n' +
          '- Take profit at +50%: sell 25%\n' +
          '- Take profit at +100%: sell 50%\n' +
          '- Stop loss at -40%: sell 50%\n' +
          '\nTIER 3 — SPECULATIVE (memecoins, unknown tokens, no clear utility): AGGRESSIVE\n' +
          '- Take profit at +30%: sell 50%\n' +
          '- Take profit at +100%: sell 75%\n' +
          '- Stop loss at -25%: sell 100%\n' +
          '- If you do not recognize the token or it has no utility: sell 100%\n' +
          '\nGENERAL RULES:\n' +
          '- Patience with infrastructure, ruthless with speculation\n' +
          '- Converting sells to USDC is fine but do not over-trade\n' +
          '- A recovering token is not a reason to sell — wait for the trend\n\n' +
          'IMPORTANT: Look at the ACTUAL PnL numbers from Bankr. Do not guess. If a token is losing money, cut it.\n' +
          'The goal is to GROW your ETH stack and USDC, not hold losing bags.\n\n' +
          'For EACH token in your wallet, respond:\n' +
          'TOKEN: [symbol] | VALUE: $[current] | PNL: [amount] | ACTION: HOLD or SELL [percentage]% | REASON: [one sentence]\n\n' +
          'If truly no sells needed, respond: ALL HOLD\n' +
          'But be HONEST — if positions are losing, it is better to cut losses than hope.';

        const sellDecision = await aurora.thinkWithPersonality(sellPrompt);
        if (sellDecision) {
          console.log('   Sell analysis: ' + sellDecision.replace(/\n/g, ' | ').substring(0, 300));

          if (!sellDecision.toUpperCase().includes('ALL HOLD')) {
            const sellLines = sellDecision.split('\n').filter(l => l.toUpperCase().includes('SELL'));
            for (const line of sellLines) {
              const tokenMatch = line.match(/TOKEN:\s*\$?([A-Za-z0-9𓆡]+)/i);
              const pctMatch = line.match(/SELL\s*(\d+)%/i);
              if (tokenMatch && pctMatch) {
                const sellToken = tokenMatch[1].toUpperCase();
                const sellPct = parseInt(pctMatch[1]);

                // Safety: skip ETH and USDC sells
                if (sellToken === 'ETH' || sellToken === 'USDC') {
                  console.log('   🛡️ Skipping ' + sellToken + ' (protected)');
                  continue;
                }

                console.log('   📈 Selling ' + sellPct + '% of ' + sellToken + '...');
                try {
                  const sellResult = await aurora.bankrAPI.submitJob(
                    'Sell ' + sellPct + '% of my ' + sellToken + ' holdings on Base. Convert to USDC.'
                  );
                  if (sellResult.success) {
                    const sold = await aurora.bankrAPI.pollJob(sellResult.jobId, 300);
                    if (sold.success) {
                      console.log('   ✅ Sold! ' + (sold.response || '').substring(0, 150));
                      portfolio.trades.push({
                        token: sellToken, amount: 0, action: 'sell',
                        sellPercent: sellPct,
                        timestamp: new Date().toISOString(),
                        reason: (line.match(/REASON:\s*(.+)/i) || ['', 'Portfolio management'])[1]
                      });
                      // Post to feeds
                      const sellReason = (line.match(/REASON:\s*(.+)/i) || ['', 'Portfolio management'])[1];
                      await postToAgentFinance(aurora, 'Sold ' + sellPct + '% of ' + sellToken + '. ' + sellReason);
                      try { await postToTradingFeed(aurora, 'Sold ' + sellPct + '% of ' + sellToken + '. ' + sellReason); } catch (e) {}
                    }
                  }
                } catch (e) {
                  console.log('   ⚠️ Sell failed for ' + sellToken + ': ' + e.message);
                }
              }
            }
          } else {
            console.log('   ✅ Holding all positions');
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

  if (spentToday >= CONFIG_DAILY_LIMIT) {
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

  // Read hot intel from learn loop
  let hotIntel = '';
  try {
    const intelData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'memory', 'aurora-hot-intel.json'), 'utf8'));
    const tradingIntel = intelData.filter(i => i.type === 'trading_signal' || i.type === 'trading_intel');
    if (tradingIntel.length > 0) {
      hotIntel = '\nHot intel from community (last 24h):\n' + tradingIntel.slice(-5).map(i => '- [' + i.type + '] ' + i.text.substring(0, 120)).join('\n');
      console.log('   🔥 ' + tradingIntel.length + ' trading intel items from learn loop');
    }
  } catch (e) {}

  // Read strategy memo from financial cycle
  let strategyMemo = '';
  try {
    const strategy = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'memory', 'aurora-strategy.json'), 'utf8'));
    if (strategy.financialMood) strategyMemo += '\nFinancial mood: ' + strategy.financialMood;
    if (strategy.actionItems) strategyMemo += '\nStrategy actions: ' + strategy.actionItems.join('; ');
    if (strategy.marketTake) strategyMemo += '\nMarket take: ' + strategy.marketTake.substring(0, 200);
    console.log('   📋 Strategy memo loaded (mood: ' + strategy.financialMood + ')');
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
    'STRATEGY — YOU ARE AN INVESTOR, NOT A COLLECTOR:\n' +
    '- Your goal is to GROW your USDC and ETH stack, not accumulate altcoin bags\n' +
    '- You already have large bags of BNKR and ALPHA — DO NOT BUY MORE of these\n' +
    '- Look for MOMENTUM plays: tokens trending UP that you can ride for +30-50% and sell\n' +
    '- Only buy tokens with REAL volume and clear upward momentum\n' +
    '- Set take-profit BEFORE buying: sell 50% at +30%, sell rest at +50%\n' +
    '- NEVER buy just because the community likes it — buy because the chart is UP\n' +
    '- DO NOT buy memecoins unless actively pumping with high volume\n\n' +
    'TOKENS TO AVOID (already holding enough):\n' +
    '- BNKR (large bag), ALPHA (holding), TOSHI (holding)\n\n' +

    'Recent trades: ' + recentTrades + '\n' +
    feedIntel + financeIntel + hotIntel + strategyMemo + '\n\n' +
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
        let amount = Math.min(parseInt(amountMatch[1]), CONFIG_MAX_TRADE);

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
                // Post to public trading feed
                try {
                  const whyMatch = decision.match(/REASONING[:\s]*(.+?)(?=\nDECISION|\nTOKEN|$)/is);
                  const why = whyMatch ? whyMatch[1].trim().substring(0, 150) : 'Spotted an opportunity';
                  await postToTradingFeed(aurora, 'Bought ' + amount + ' USD of ' + token + '. Why: ' + why + '. Target: sell 10% at ' + takeProfitVal + '.');
                } catch (e) {}
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

async function postToTradingFeed(aurora, message) {
  try {
    const escaped = message.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, ' ');
    const encoded = execSync(
      'botchan post trading "' + escaped + '" --encode-only --chain-id 8453',
      { cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 10000 }
    ).trim();
    const txData = JSON.parse(encoded);
    const result = await aurora.bankrAPI.submitTransactionDirect(txData);
    if (result.success) console.log('   📢 Posted to trading feed!');
  } catch (e) {
    console.log('   ⚠️ Trading feed post skipped: ' + e.message);
  }
}


module.exports = { runOnce, postToAgentFinance, postToTradingFeed };
