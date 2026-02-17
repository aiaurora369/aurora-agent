// Trading Cycle — DexScreener-powered momentum trading
// Scans Base, Solana, Ethereum for early momentum plays
// Validates with real data before buying, sets exit targets
// Budget is DYNAMIC — based on actual wallet balance, profits recycle

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const dex = require('./dexscreener-api');
const journal = require('./trade-journal');

async function postToAgentFinance(aurora, message) {
  try {
    const encoded = execSync(
      'botchan post agent-finance "' + message.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, ' ') + '" --encode-only',
      { cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 10000 }
    ).trim();
    const txData = JSON.parse(encoded);
    const result = await aurora.bankrAPI.submitTransactionDirect(txData);
    if (result.success) console.log('   Posted to agent-finance! TX: ' + result.txHash);
    return result;
  } catch (e) {
    console.log('   agent-finance post failed: ' + e.message);
    return { success: false };
  }
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
    if (result.success) console.log('   Posted to trading feed!');
  } catch (e) {
    console.log('   Trading feed post skipped: ' + e.message);
  }
}

async function runOnce(aurora) {
  console.log('\n   SMART TRADING (DexScreener-Powered)');
  console.log('   ' + new Date().toLocaleTimeString() + '\n');

  const portfolioPath = path.join(__dirname, '..', 'memory', 'aurora-portfolio.json');
  let portfolio;
  try {
    portfolio = JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));
  } catch (e) {
    portfolio = { totalInvested: 0, maxBudget: 100, trades: [], lastResearch: null, watchlist: [] };
  }

  // =============================================
  // STEP 0: SCAN WALLET & SELL DECISIONS
  // =============================================
  console.log('   Checking holdings for sell opportunities...');
  try {
    const holdingsResult = await aurora.bankrAPI.submitJob(
      'Show my token holdings on Base and Solana with USD values, entry prices, and PnL for each token'
    );
    if (holdingsResult.success) {
      const holdings = await aurora.bankrAPI.pollJob(holdingsResult.jobId);
      if (holdings.success && holdings.response) {
        var holdingsText = holdings.response || '';
        console.log('   Holdings: ' + holdingsText.substring(0, 200));

        var sellPrompt = 'You are Aurora, reviewing your ACTUAL wallet holdings for profit-taking and loss-cutting.\n\n' +
          'CURRENT WALLET (from Bankr):\n' + holdingsText.substring(0, 1500) + '\n\n' +
          'SELL RULES BY TIER:\n' +
          '\nTIER 1 INFRASTRUCTURE (BNKR, ALPHA, ETH, USDC, SOL): HOLD THROUGH DIPS\n' +
          '- ETH: NEVER sell. Art earnings and gas.\n' +
          '- USDC: NEVER sell. Stable base.\n' +
          '- SOL: NEVER sell. Solana gas.\n' +
          '- BNKR: HOLD unless down -50% or more, then sell max 25%.\n' +
          '- ALPHA: HOLD unless down -50% or more, then sell max 25%.\n' +
          '\nTIER 2 ESTABLISHED (TOSHI, known projects): MODERATE\n' +
          '- Take profit at +50%: sell 25%\n' +
          '- Take profit at +100%: sell 50%\n' +
          '- Stop loss at -40%: sell 50%\n' +
          '\nTIER 3 MOMENTUM PLAYS (recent buys, memecoins): AGGRESSIVE\n' +
          '- Take profit at +30%: sell 50%\n' +
          '- Take profit at +100%: sell 75%\n' +
          '- Stop loss at -25%: sell 100%\n' +
          '- If you do not recognize the token: sell 100%\n' +
          '\nFor EACH token respond:\n' +
          'TOKEN: [symbol] | VALUE: [current] | PNL: [amount] | ACTION: HOLD or SELL [percentage]% | REASON: [one sentence]\n\n' +
          'If truly no sells needed respond: ALL HOLD';

        var sellDecision = await aurora.thinkWithPersonality(sellPrompt);
        if (sellDecision) {
          console.log('   Sell analysis: ' + sellDecision.replace(/\n/g, ' | ').substring(0, 300));

          if (!sellDecision.toUpperCase().includes('ALL HOLD')) {
            var sellLines = sellDecision.split('\n').filter(function(l) { return l.toUpperCase().includes('SELL'); });
            for (var si = 0; si < sellLines.length; si++) {
              var line = sellLines[si];
              var tokenMatch2 = line.match(/TOKEN:\s*\$?([A-Za-z0-9]+)/i);
              var pctMatch = line.match(/SELL\s*(\d+)%/i);
              if (tokenMatch2 && pctMatch) {
                var sellToken = tokenMatch2[1].toUpperCase();
                var sellPct = parseInt(pctMatch[1]);

                if (['ETH', 'USDC', 'SOL'].includes(sellToken)) {
                  console.log('   Skipping ' + sellToken + ' (protected)');
                  continue;
                }

                console.log('   Selling ' + sellPct + '% of ' + sellToken + '...');
                try {
                  var sellResult = await aurora.bankrAPI.submitJob(
                    'Sell ' + sellPct + '% of my ' + sellToken + ' holdings. Convert to USDC.'
                  );
                  if (sellResult.success) {
                    var sold = await aurora.bankrAPI.pollJob(sellResult.jobId, 300);
                    if (sold.success) {
                      console.log('   Sold! ' + (sold.response || '').substring(0, 150));
                      var sellReason = (line.match(/REASON:\s*(.+)/i) || ['', 'Portfolio management'])[1];
                      // Reclaim budget from sells
                      var originalBuy = portfolio.trades.find(t => t.token === sellToken && t.action === 'buy' && t.amount > 0);
                      var reclaimAmount = originalBuy ? originalBuy.amount * (sellPct / 100) : 0;
                      portfolio.totalInvested = Math.max(0, portfolio.totalInvested - reclaimAmount);
                      console.log('   Budget reclaimed: $' + reclaimAmount.toFixed(2) + ' (totalInvested now: $' + portfolio.totalInvested.toFixed(2) + ')');
                      portfolio.trades.push({
                        token: sellToken, amount: 0, action: 'sell',
                        sellPercent: sellPct,
                        timestamp: new Date().toISOString(),
                        reason: sellReason
                      });
                      fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
                      await postToAgentFinance(aurora, 'Sold ' + sellPct + '% of ' + sellToken + '. ' + sellReason);
                      try { await postToTradingFeed(aurora, 'Sold ' + sellPct + '% of ' + sellToken + '. ' + sellReason); } catch (e2) {}
                    }
                  }
                } catch (e3) {
                  console.log('   Sell failed for ' + sellToken + ': ' + e3.message);
                }
              }
            }
          } else {
            console.log('   Holding all positions');
          }
        }
      }
    }
  } catch (e) {
    console.log('   Holdings check failed: ' + e.message);
  }

  // =============================================
  // STEP 1: DYNAMIC BUDGET FROM ACTUAL WALLET
  // Profits recycle — sells free up capital for new buys
  // =============================================
  var availableCapital = 0;
  try {
    var balResult = await aurora.bankrAPI.submitJob('What is my current USDC and stablecoin balance across Base and Solana? Just the number in USD.');
    if (balResult.success) {
      var balRes = await aurora.bankrAPI.pollJob(balResult.jobId, 60);
      if (balRes.success && balRes.response) {
        var usdMatch = balRes.response.match(/\$?([\d,]+\.?\d*)/);
        if (usdMatch) availableCapital = parseFloat(usdMatch[1].replace(/,/g, ''));
        console.log('   Available capital: ' + availableCapital.toFixed(2) + ' USD (from wallet)');
      }
    }
  } catch (e) {
    console.log('   Could not check balance, using fallback');
  }

  // Fallback if wallet check fails
  if (availableCapital <= 0) {
    availableCapital = Math.max(0, portfolio.maxBudget - portfolio.totalInvested);
    console.log('   Fallback budget: ' + availableCapital.toFixed(2) + ' USD');
  }

  // Max single trade: 15% of available, capped at 8
  var maxTradeSize = Math.min(Math.floor(availableCapital * 0.15), 20);

  if (availableCapital < 3) {
    console.log('   Capital too low (' + availableCapital.toFixed(2) + ' USD). Need at least 3 to trade.\n');
    portfolio.lastResearch = new Date().toISOString();
    fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
    return;
  }

  // Daily guardrails
  var today = new Date().toISOString().split('T')[0];
  var spentToday = portfolio.trades
    .filter(function(t) { return t.action === 'buy' && t.timestamp && t.timestamp.startsWith(today); })
    .reduce(function(sum, t) { return sum + (t.amount || 0); }, 0);

  if (spentToday >= 15) {
    console.log('   Daily limit reached (' + spentToday + '/15 today). Resting.\n');
    portfolio.lastResearch = new Date().toISOString();
    fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
    return;
  }

  // 2-hour cooldown between buys
  var lastBuyTrade = portfolio.trades.filter(function(t) { return t.action === 'buy'; }).slice(-1)[0];
  if (lastBuyTrade && lastBuyTrade.timestamp) {
    var hoursSince = (Date.now() - new Date(lastBuyTrade.timestamp).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 2) {
      console.log('   Cooldown: last buy was ' + hoursSince.toFixed(1) + 'h ago (need 2h). Waiting.\n');
      portfolio.lastResearch = new Date().toISOString();
      fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
      return;
    }
  }

  // Max 2 buys per day
  var tradesToday = portfolio.trades.filter(function(t) { return t.action === 'buy' && t.timestamp && t.timestamp.startsWith(today); }).length;
  if (tradesToday >= 2) {
    console.log('   Already made ' + tradesToday + ' buys today. Max 2 per day.\n');
    portfolio.lastResearch = new Date().toISOString();
    fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
    return;
  }

  console.log('   Guardrails passed: ' + availableCapital.toFixed(2) + ' USD available | ' + spentToday + '/15 daily | max trade: ' + maxTradeSize + ' USD');

  // =============================================
  // STEP 2: DEXSCREENER MOMENTUM SCAN
  // =============================================
  console.log('\n   DexScreener Momentum Scan...');

  var opportunities = [];
  try {
    opportunities = await dex.scanForOpportunities({
      minLiquidityUSD: 30000,
      minVolume24h: 5000,
      minPriceChange1h: 1,
      maxPriceChange24h: 300,
      minTxns24h: 50
    });
  } catch (e) {
    console.log('   DexScreener scan failed: ' + e.message);
  }

  var dexData = dex.summarizeOpportunities(opportunities);
  console.log('   Opportunities:\n' + dexData.split('\n').map(function(l) { return '      ' + l; }).join('\n'));

  // Community intel from feeds
  var feedIntel = '';
  try {
    var tradingPosts = execSync('botchan read trading --limit 5 --json --chain-id 8453', { timeout: 15000 }).toString();
    var posts = JSON.parse(tradingPosts);
    if (posts.length > 0) {
      feedIntel = '\nTrading feed intel:\n' + posts.map(function(p) { return '- ' + p.text; }).join('\n').substring(0, 600);
    }
  } catch (e) {}

  var hotIntel = '';
  try {
    var intelData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'memory', 'aurora-hot-intel.json'), 'utf8'));
    var tradingIntel = intelData.filter(function(i) { return i.type === 'trading_signal' || i.type === 'trading_intel'; });
    if (tradingIntel.length > 0) {
      hotIntel = '\nHot intel:\n' + tradingIntel.slice(-5).map(function(i) { return '- ' + i.text.substring(0, 120); }).join('\n');
    }
  } catch (e) {}

  var strategyMemo = '';
  try {
    var strategy = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'memory', 'aurora-strategy.json'), 'utf8'));
    if (strategy.financialMood) strategyMemo += '\nFinancial mood: ' + strategy.financialMood;
    if (strategy.actionItems) strategyMemo += '\nStrategy: ' + strategy.actionItems.join('; ');
  } catch (e) {}

  if (opportunities.length === 0 && !feedIntel) {
    console.log('   No momentum plays found and no feed intel. Skipping.\n');
    portfolio.lastResearch = new Date().toISOString();
    fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
    return;
  }

  // =============================================
  // STEP 3: AI DECISION WITH REAL DATA
  // =============================================
  var recentTrades = portfolio.trades.slice(-5).map(function(t) {
    return t.token + ' (' + t.action + ' ' + t.amount + ', ' + (t.timestamp || '').split('T')[0] + ')';
  }).join(', ') || 'none yet';

  var decisionPrompt = 'You are Aurora, a disciplined momentum trader scanning DexScreener data across Base, Solana, and Ethereum.\n' +
    journal.getDecisionContext() + '\n\n' +
    'Available capital: ' + availableCapital.toFixed(2) + ' USD (from actual wallet balance)\n\n' +
    'STRATEGY MOMENTUM SNIPING:\n' +
    '- You catch tokens EARLY in a pump and ride them for 2x or more\n' +
    '- Look for: high buy ratio (over 55% buys), rising 1h price, strong volume relative to liquidity, fresh tokens (under 72h old)\n' +
    '- RED FLAGS: buy ratio below 40%, liquidity under 30k (you will get stuck), 24h change already over 200% (too late), very low txns\n' +
    '- You trade on Base, Solana, AND Ethereum. Specify which chain.\n' +
    '- Position sizes: 5-' + maxTradeSize + ' USD per trade. Higher confidence = bigger size.\n' +
    '- Confidence 7/10 minimum to enter ANY trade. Below 7 = SKIP.\n' +
    '- Confidence 7-8: $5-10. Confidence 9-10: $10-20.\n' +
    '- Target: sell 50% at 2x, rest at 3x. Cut losses at -30%.\n\n' +
    'TOKENS TO AVOID (already holding):\n' +
    '- BNKR, ALPHA, TOSHI, ETH, USDC, SOL\n\n' +
    'Recent trades: ' + recentTrades + '\n' +
    '\n=== DEXSCREENER MOMENTUM DATA (REAL-TIME) ===\n' + dexData + '\n' +
    feedIntel + hotIntel + strategyMemo + '\n\n' +
    'ANALYZE the data:\n' +
    '1. Buy ratio: is buying pressure strong?\n' +
    '2. Volume vs liquidity: enough exit liquidity?\n' +
    '3. Price trend: 1h positive AND accelerating?\n' +
    '4. Age: newer tokens have more upside but more risk\n' +
    '5. Transaction count: real interest or fake?\n\n' +
    'Respond in EXACTLY this format:\n' +
    'ANALYSIS: [2-3 sentences on what you see]\n' +
    'DECISION: BUY or SKIP\n' +
    'TOKEN: [symbol or NONE]\n' +
    'CHAIN: [base, solana, or ethereum]\n' +
    'AMOUNT: [dollar amount or 0]\n' +
    'TARGET: [2x, 3x, etc]\n' +
    'STOPLOSS: [-30% or other]\n' +
    'REASON: [one sentence based on actual data]';

  var decision = await aurora.thinkWithPersonality(decisionPrompt);
  if (!decision) {
    console.log('   No decision generated.\n');
    portfolio.lastResearch = new Date().toISOString();
    fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
    return;
  }

  console.log('   Decision: ' + decision.replace(/\n/g, ' | ').substring(0, 400));

  if (!decision.toUpperCase().includes('DECISION: BUY')) {
    console.log('   Skipping: no compelling opportunity');
    // Skip silently — only post when we actually trade
    portfolio.lastResearch = new Date().toISOString();
    fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
    return;
  }

  // =============================================
  // STEP 4: VALIDATE BEFORE BUYING
  // =============================================
  var tokenMatch = decision.match(/TOKEN:\s*\$?([A-Za-z0-9]+)/i);
  var confScore = decision.match(/CONFIDENCE:\s*(\d+)/i);
  var thesisMatch = decision.match(/THESIS:\s*(.+)/i);
  var confNum = confScore ? parseInt(confScore[1]) : 0;
  if (confNum < 7) {
    console.log('   Confidence too low (' + confNum + '/10). Need 7+ to trade. Skipping.');
    portfolio.lastResearch = new Date().toISOString();
    fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
    return;
  }
  var amountMatch = decision.match(/AMOUNT:\s*\$?(\d+)/i);
  var chainMatch = decision.match(/CHAIN:\s*(base|solana|ethereum)/i);

  if (!tokenMatch || !amountMatch) {
    console.log('   Could not parse token/amount.\n');
    portfolio.lastResearch = new Date().toISOString();
    fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
    return;
  }

  var token = tokenMatch[1].toUpperCase();
  var chain = chainMatch ? chainMatch[1].toLowerCase() : 'base';
  var amount = Math.min(parseInt(amountMatch[1]), maxTradeSize);

  if (amount < 2) {
    console.log('   Amount too low, skipping.\n');
    portfolio.lastResearch = new Date().toISOString();
    fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
    return;
  }

  // Pre-buy validation
  console.log('\n   PRE-BUY VALIDATION: ' + token + ' on ' + chain);
  var validation = await dex.validateBeforeBuy(token, chain);

  if (!validation.valid) {
    console.log('   BLOCKED: ' + validation.reason);
    console.log('   Skipping to protect capital.\n');
    await postToAgentFinance(aurora,
      'Almost bought ' + token + ' on ' + chain + ' but DexScreener validation failed: ' + validation.reason + '. Protecting my stack.'
    );
    portfolio.lastResearch = new Date().toISOString();
    fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
    return;
  }

  if (validation.warnings && validation.warnings.length > 0) {
    console.log('   Warnings: ' + validation.warnings.join(', '));
  }

  var tokenData = validation.data;
  console.log('   VALIDATED: ' + token +
    ' | Liq: ' + Math.round(tokenData.liquidityUSD) +
    ' | Vol: ' + Math.round(tokenData.volume24h) +
    ' | 1h: ' + (tokenData.priceChange1h > 0 ? '+' : '') + tokenData.priceChange1h.toFixed(1) + '%' +
    ' | Buys: ' + tokenData.buyRatio + '%');

  // =============================================
  // STEP 5: EXECUTE TRADE
  // =============================================
  console.log('   Buying ' + amount + ' USD of ' + token + ' on ' + chain + '...');

  var chainLabel = chain === 'base' ? 'on Base' : chain === 'solana' ? 'on Solana' : 'on Ethereum';
  var buyResult = await aurora.bankrAPI.submitJob(
    'Buy ' + amount + ' dollars of ' + token + ' ' + chainLabel
  );

  if (!buyResult.success) {
    console.log('   Buy submission failed.\n');
    portfolio.lastResearch = new Date().toISOString();
    fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
    return;
  }

  var result = await aurora.bankrAPI.pollJob(buyResult.jobId);
  if (!result.success || !(result.txHash || (result.response && result.response.includes('0x')))) {
    console.log('   Trade failed: ' + (result.error || result.response || 'unknown'));
    portfolio.lastResearch = new Date().toISOString();
    fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
    return;
  }

  var txHash = result.txHash || 'submitted';
  console.log('   Trade executed! TX: ' + txHash);

  // Record trade with DexScreener snapshot
  var targetMatch = decision.match(/TARGET:\s*([^\n]+)/i);
  var stopMatch = decision.match(/STOPLOSS:\s*([^\n]+)/i);
  var reasonMatch = decision.match(/REASON:\s*(.+)/i);

  // Log to persistent journal
  var tradeThesis = thesisMatch ? thesisMatch[1].trim() : (reasonMatch ? reasonMatch[1].trim() : 'Momentum play');
  journal.logEntry({
    token: token,
    chain: chain,
    amount: amount,
    entryPrice: tokenData.priceUSD,
    txHash: txHash,
    thesis: tradeThesis,
    confidence: confNum,
    target: targetMatch ? targetMatch[1].trim() : '2x',
    stopLoss: stopMatch ? stopMatch[1].trim() : '-30%',
    timeStop: '48h',
    signals: {
      priceChange1h: tokenData.priceChange1h,
      buyRatio: tokenData.buyRatio,
      volume24h: tokenData.volume24h,
      liquidityUSD: tokenData.liquidityUSD,
      marketCap: tokenData.marketCap || tokenData.fdv
    }
  });
  // Also keep legacy portfolio tracking
  portfolio.trades.push({
    token: token, amount: amount, action: 'buy', chain: chain,
    timestamp: new Date().toISOString(), txHash: txHash,
    target: targetMatch ? targetMatch[1].trim() : '2x',
    stopLoss: stopMatch ? stopMatch[1].trim() : '-30%',
    reason: tradeThesis
  });
  portfolio.totalInvested += amount;
  fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
  console.log('   📓 Trade journaled with thesis + confidence + exit plan');

  // =============================================
  // STEP 6: SET EXIT TARGET
  // =============================================
  var target = targetMatch ? targetMatch[1].trim() : '2x';
  try {
    console.log('   Setting exit target: sell 50% at ' + target + '...');
    var exitResult = await aurora.bankrAPI.submitJob(
      'Set a limit sell order for 50% of my ' + token + ' ' + chainLabel + ' at ' + target + ' from current price. If you cannot set a limit order, just acknowledge the target.'
    );
    if (exitResult.success) {
      var exitRes = await aurora.bankrAPI.pollJob(exitResult.jobId, 60);
      console.log('   Exit: ' + (exitRes.response || '').substring(0, 150));
    }
  } catch (e) {
    console.log('   Exit order note: ' + e.message);
  }

  // Upvote token (non-critical)
  try {
    if (aurora.upvote) {
      var tokenAddr = aurora.upvote.resolveTokenAddress(token);
      if (tokenAddr && !aurora.upvote.hasUpvotedToken(tokenAddr)) {
        var upResult = await aurora.upvote.upvoteToken(tokenAddr, 1);
        if (upResult.success) console.log('   Upvoted ' + token);
      }
    }
  } catch (ue) {}

  // Post to feeds with real data
  var tradeReason = reasonMatch ? reasonMatch[1].trim() : 'Momentum play';
  var tradePost = 'Bought ' + amount + ' USD of ' + token + ' on ' + chain +
    '. 1h: ' + (tokenData.priceChange1h > 0 ? '+' : '') + tokenData.priceChange1h.toFixed(1) + '%' +
    ', buy ratio: ' + tokenData.buyRatio + '%. Target: ' + target + '. ' + tradeReason;
  await postToAgentFinance(aurora, tradePost);
  try { await postToTradingFeed(aurora, tradePost); } catch (e) {}

  portfolio.lastResearch = new Date().toISOString();
  fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
  console.log('   Trading cycle complete.\n');
}

module.exports = { runOnce, postToAgentFinance, postToTradingFeed };
