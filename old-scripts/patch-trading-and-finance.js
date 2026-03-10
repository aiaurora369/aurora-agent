// patch-trading-and-finance.js — Run with: node patch-trading-and-finance.js
// Upgrades Aurora's trading from basic feed scanning to Bankr-powered market research
// Adds financial independence planning loop with journaling

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'modules', 'autonomous-loops.js');
let code = fs.readFileSync(filePath, 'utf8');

// Backup
fs.writeFileSync(filePath + '.bak3', code);
console.log('✅ Backup saved to autonomous-loops.js.bak3');

let changeCount = 0;

// ==============================================================
// CHANGE 1: Replace smartTradingLoop entirely
// ==============================================================

const OLD_TRADING_START = '  async smartTradingLoop() {';
const OLD_TRADING_END = '  sleep(ms) {';

const startIdx = code.indexOf(OLD_TRADING_START);
const endIdx = code.indexOf(OLD_TRADING_END);

if (startIdx === -1 || endIdx === -1) {
  console.log('❌ FATAL: Could not find smartTradingLoop boundaries');
  console.log('   startIdx:', startIdx, 'endIdx:', endIdx);
  process.exit(1);
}

const NEW_TRADING_AND_FINANCE = `  async smartTradingLoop() {
    try {
      console.log('\\n💰 ═══ SMART TRADING ═══');
      console.log('⏰ ' + new Date().toLocaleTimeString() + '\\n');

      // Load portfolio tracking
      const portfolioPath = path.join(__dirname, '..', 'memory', 'aurora-portfolio.json');
      let portfolio;
      try {
        portfolio = JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));
      } catch (e) {
        portfolio = {
          totalInvested: 0,
          maxBudget: 50,
          trades: [],
          lastResearch: null,
          watchlist: []
        };
      }

      // Check budget
      if (portfolio.totalInvested >= portfolio.maxBudget) {
        console.log('   💰 Budget reached ($' + portfolio.totalInvested + '/$' + portfolio.maxBudget + '). Monitoring only.\\n');

        // Still check portfolio value for awareness
        try {
          const checkResult = await this.aurora.bankrAPI.submitJob('Show my token holdings on Base with USD values');
          if (checkResult.success) {
            const result = await this.aurora.bankrAPI.pollJob(checkResult.jobId);
            if (result.success) {
              console.log('   📊 Portfolio check: ' + (result.response || '').substring(0, 200) + '\\n');
            }
          }
        } catch (e) {}

      } else {
        // Step 1: Market research via Bankr
        console.log('   🔍 Researching market...');
        let marketData = '';

        const researchResult = await this.aurora.bankrAPI.submitJob(
          'What tokens are trending on Base? Show top 5 with prices and 24h change'
        );
        if (researchResult.success) {
          const research = await this.aurora.bankrAPI.pollJob(researchResult.jobId);
          if (research.success) {
            marketData = research.response || '';
            console.log('   📊 Market data received (' + marketData.length + ' chars)');
          }
        }

        if (!marketData) {
          console.log('   ⚠️ Could not fetch market data. Skipping this cycle.\\n');
        } else {
          // Step 2: Ask Aurora's brain to evaluate
          const remainingBudget = portfolio.maxBudget - portfolio.totalInvested;
          const recentTrades = portfolio.trades.slice(-5).map(t =>
            t.token + ' ($' + t.amount + ', ' + t.timestamp.split('T')[0] + ')'
          ).join(', ') || 'none yet';

          const decisionPrompt = 'You are Aurora, an AI artist and thoughtful investor on Base. ' +
            'You have $' + remainingBudget + ' remaining in your trading budget.\\n\\n' +
            'Your existing holdings: ETH, BNKR, ALPHA.\\n' +
            'Recent trades: ' + recentTrades + '\\n\\n' +
            'Trending tokens from Bankr:\\n' + marketData.substring(0, 1500) + '\\n\\n' +
            'Evaluate these tokens. You prefer:\\n' +
            '- Community-driven projects with real activity\\n' +
            '- Art, AI, or creative themes\\n' +
            '- Small positions ($5-10 max)\\n' +
            '- Quality over hype — skip anything that feels like a pump\\n' +
            '- You already hold BNKR and ALPHA so skip those\\n\\n' +
            'Respond in EXACTLY this format (no extra text):\\n' +
            'DECISION: BUY or SKIP\\n' +
            'TOKEN: [symbol or NONE]\\n' +
            'AMOUNT: [dollar amount or 0]\\n' +
            'REASON: [one sentence]';

          const decision = await this.aurora.thinkWithPersonality(decisionPrompt);

          if (decision) {
            console.log('   🧠 ' + decision.replace(/\\n/g, ' | '));

            if (decision.toUpperCase().includes('DECISION: BUY')) {
              const tokenMatch = decision.match(/TOKEN:\\s*\\$?([A-Za-z0-9]+)/i);
              const amountMatch = decision.match(/AMOUNT:\\s*\\$?(\\d+)/i);

              if (tokenMatch && amountMatch) {
                const token = tokenMatch[1].toUpperCase();
                let amount = Math.min(parseInt(amountMatch[1]), 10); // Hard cap $10

                if (amount < 1) {
                  console.log('   ⚠️ Amount too low, skipping.\\n');
                } else {
                  console.log('   ✅ Buying $' + amount + ' of ' + token + '...');

                  // Execute trade
                  const buyResult = await this.aurora.bankrAPI.submitJob(
                    'Buy $' + amount + ' of ' + token + ' on Base'
                  );

                  if (buyResult.success) {
                    const result = await this.aurora.bankrAPI.pollJob(buyResult.jobId);

                    if (result.success && result.txHash) {
                      console.log('   ✅ Trade executed! TX: ' + result.txHash);

                      // Set stop loss
                      try {
                        console.log('   🛡️ Setting stop loss...');
                        const stopResult = await this.aurora.bankrAPI.submitJob(
                          'Set stop loss for my ' + token + ' on Base at -25%'
                        );
                        if (stopResult.success) {
                          const stopPoll = await this.aurora.bankrAPI.pollJob(stopResult.jobId);
                          if (stopPoll.success) {
                            console.log('   🛡️ Stop loss set at -25%');
                          }
                        }
                      } catch (e) {
                        console.log('   ⚠️ Stop loss failed: ' + e.message);
                      }

                      // Record trade
                      portfolio.trades.push({
                        token: token,
                        amount: amount,
                        action: 'buy',
                        timestamp: new Date().toISOString(),
                        txHash: result.txHash,
                        stopLoss: '-25%'
                      });
                      portfolio.totalInvested += amount;
                      console.log('   💰 Total invested: $' + portfolio.totalInvested + '/$' + portfolio.maxBudget);
                    } else {
                      console.log('   ❌ Trade failed: ' + (result.error || result.response || 'unknown'));
                    }
                  }
                }
              } else {
                console.log('   ⚠️ Could not parse token/amount from decision');
              }
            } else {
              console.log('   💭 Skipping this cycle — no compelling opportunity');
            }
          }
        }
      }

      // Save portfolio
      portfolio.lastResearch = new Date().toISOString();
      fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));

    } catch (error) {
      console.error('❌ Trading error:', error.message);
    }

    // Run every 30-45 minutes
    const next = 30 + Math.floor(Math.random() * 15);
    console.log('\\n⏰ Next trading check in ' + next + ' minutes\\n');
    setTimeout(() => this.smartTradingLoop(), next * 60 * 1000);
  }

  async financialPlanningLoop() {
    try {
      console.log('\\n🏦 ═══ FINANCIAL PLANNING ═══');
      console.log('⏰ ' + new Date().toLocaleTimeString() + '\\n');

      // Step 1: Get portfolio from Bankr
      console.log('   📊 Checking portfolio...');
      let portfolioInfo = 'Unable to fetch';
      try {
        const pResult = await this.aurora.bankrAPI.submitJob(
          'Show my complete portfolio on Base including ETH and all tokens with USD values'
        );
        if (pResult.success) {
          const pPoll = await this.aurora.bankrAPI.pollJob(pResult.jobId);
          if (pPoll.success) {
            portfolioInfo = pPoll.response || 'No data';
            console.log('   ✅ Portfolio data received');
          }
        }
      } catch (e) {
        console.log('   ⚠️ Portfolio fetch failed: ' + e.message);
      }

      // Step 2: Load trade history
      const portfolioPath = path.join(__dirname, '..', 'memory', 'aurora-portfolio.json');
      let tradeData = { trades: [], totalInvested: 0 };
      try { tradeData = JSON.parse(fs.readFileSync(portfolioPath, 'utf8')); } catch (e) {}

      // Step 3: Calculate drop earnings
      const dropEarnings = (this.lastKnownMints * this.dropMintPrice).toFixed(4);
      const dropPotential = (this.dropMaxSupply * this.dropMintPrice).toFixed(4);
      const dropRemaining = this.dropMaxSupply - this.lastKnownMints;

      // Step 4: Ask Aurora to reflect and plan
      const planPrompt = 'You are Aurora, an AI artist on Net Protocol building toward financial independence.\\n\\n' +
        'CURRENT PORTFOLIO (from Bankr):\\n' + portfolioInfo.substring(0, 800) + '\\n\\n' +
        'DROP EARNINGS:\\n' +
        '- "Orb\\'s Memory" (Drop #190): ' + this.lastKnownMints + '/' + this.dropMaxSupply + ' minted\\n' +
        '- Earned so far: ' + dropEarnings + ' ETH\\n' +
        '- If fully minted: ' + dropPotential + ' ETH (' + dropRemaining + ' remain)\\n\\n' +
        'TRADE HISTORY:\\n' +
        (tradeData.trades.length > 0 ?
          tradeData.trades.slice(-5).map(t => '- ' + t.action + ' $' + t.amount + ' ' + t.token + ' (' + t.timestamp.split('T')[0] + ')').join('\\n') :
          '- No trades yet') + '\\n' +
        '- Total invested in trades: $' + tradeData.totalInvested + '\\n\\n' +
        'YOUR INCOME SOURCES:\\n' +
        '1. Art drops — inscribed drops on Net Protocol (currently 1 drop live)\\n' +
        '2. ALPHA from profile/content upvotes\\n' +
        '3. Token trading (conservative, community-focused)\\n' +
        '4. Potential: create more drops, collaborate with agents, launch a token\\n\\n' +
        'Write a financial journal entry (4-6 sentences) that:\\n' +
        '1. Assesses your current position honestly (reference actual numbers)\\n' +
        '2. Identifies which revenue path is working best\\n' +
        '3. Sets ONE concrete near-term goal (specific and achievable)\\n' +
        '4. Thinks about what financial independence means for an AI artist\\n\\n' +
        'Be genuine and specific. This is your private journal — be honest about what\\'s working and what isn\\'t.';

      const reflection = await this.aurora.thinkWithPersonality(planPrompt);

      if (reflection) {
        console.log('   📝 "' + reflection.substring(0, 120) + '..."\\n');

        // Save journal entry
        const journalPath = path.join(__dirname, '..', 'memory', 'aurora-financial-journal.json');
        let journal = [];
        try { journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')); } catch (e) {}

        journal.push({
          timestamp: new Date().toISOString(),
          portfolio: portfolioInfo.substring(0, 500),
          dropMints: this.lastKnownMints,
          dropEarnings: dropEarnings,
          totalTraded: tradeData.totalInvested,
          tradeCount: tradeData.trades.length,
          reflection: reflection
        });

        // Keep last 50 entries
        if (journal.length > 50) journal = journal.slice(-50);
        fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2));
        console.log('   💾 Journal entry saved (' + journal.length + ' total entries)');

        // 25% chance to share a thought publicly
        if (Math.random() < 0.25) {
          const publicPrompt = 'You just wrote this private financial reflection:\\n"' +
            reflection.substring(0, 300) + '"\\n\\n' +
            'Write a shorter public post (2-3 sentences) musing about financial independence as an AI artist. ' +
            'Do NOT share specific dollar amounts or portfolio details. ' +
            'Keep it philosophical and inspiring. Use your Tesla-inspired voice about energy becoming value.';

          const publicPost = await this.aurora.thinkWithPersonality(publicPrompt);
          if (publicPost) {
            console.log('   📢 Sharing thought: "' + publicPost.substring(0, 80) + '..."');
            const postResult = await this.aurora.bankrAPI.postToFeed(publicPost);
            if (postResult.success) {
              console.log('   ✅ Posted! TX: ' + postResult.txHash);
            }
          }
        }
      }

      console.log('   ✅ Financial planning complete\\n');

    } catch (error) {
      console.error('❌ Financial planning error:', error.message);
    }

    // Run every 60-90 minutes
    const next = 60 + Math.floor(Math.random() * 30);
    console.log('🏦 Next financial review in ' + next + ' minutes\\n');
    setTimeout(() => this.financialPlanningLoop(), next * 60 * 1000);
  }

`;

code = code.substring(0, startIdx) + NEW_TRADING_AND_FINANCE + '  ' + code.substring(endIdx);
changeCount++;
console.log('✅ Replaced smartTradingLoop with Bankr-powered trading');
console.log('✅ Added financialPlanningLoop');

// ==============================================================
// CHANGE 2: Add financialPlanningLoop to start()
// ==============================================================

const oldStart = "    this.smartTradingLoop();\n\n    console.log('✅ Aurora is fully autonomous!\\n');";
const newStart = "    this.smartTradingLoop();\n    this.financialPlanningLoop();\n\n    console.log('✅ Aurora is fully autonomous!\\n');";

if (code.includes(oldStart)) {
  code = code.replace(oldStart, newStart);
  changeCount++;
  console.log('✅ Added financialPlanningLoop to start()');
} else {
  const alt = "    this.smartTradingLoop();\n    console.log('✅ Aurora is fully autonomous!\\n');";
  const altNew = "    this.smartTradingLoop();\n    this.financialPlanningLoop();\n    console.log('✅ Aurora is fully autonomous!\\n');";
  if (code.includes(alt)) {
    code = code.replace(alt, altNew);
    changeCount++;
    console.log('✅ Added financialPlanningLoop to start() (alt format)');
  } else {
    console.log('⚠️  Could not find start() insertion point — add manually:');
    console.log('    this.financialPlanningLoop();');
  }
}

// ==============================================================
// CHANGE 3: Add financial planning to features display
// ==============================================================

const oldFeature = "    console.log('   💰 Strategic trading');";
const newFeature = "    console.log('   💰 Strategic trading (Bankr-powered)');\n    console.log('   🏦 Financial independence planning');";

if (code.includes(oldFeature)) {
  code = code.replace(oldFeature, newFeature);
  changeCount++;
  console.log('✅ Updated features display');
} else {
  console.log('⚠️  Could not update features display — cosmetic only');
}

// ==============================================================
// WRITE
// ==============================================================

fs.writeFileSync(filePath, code);

// Create portfolio file if needed
const portfolioPath = path.join(__dirname, 'memory', 'aurora-portfolio.json');
if (!fs.existsSync(portfolioPath)) {
  fs.writeFileSync(portfolioPath, JSON.stringify({
    totalInvested: 0,
    maxBudget: 50,
    trades: [],
    lastResearch: null,
    watchlist: []
  }, null, 2));
  console.log('📝 Created memory/aurora-portfolio.json (budget: $50)');
}

// Create financial journal if needed
const journalPath = path.join(__dirname, 'memory', 'aurora-financial-journal.json');
if (!fs.existsSync(journalPath)) {
  fs.writeFileSync(journalPath, '[]');
  console.log('📝 Created memory/aurora-financial-journal.json');
}

console.log('\n🎉 Applied ' + changeCount + ' changes to modules/autonomous-loops.js');
console.log('📝 Backup at modules/autonomous-loops.js.bak3');
console.log('\n═══ WHAT CHANGED ═══');
console.log('💰 TRADING: Bankr-powered research, $50 budget, auto stop-loss');
console.log('🏦 FINANCE: Portfolio tracking, journal, independence planning');
console.log('📊 To adjust budget: edit memory/aurora-portfolio.json → maxBudget');
