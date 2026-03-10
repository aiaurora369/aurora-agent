const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'modules', 'autonomous-loops.js');
let code = fs.readFileSync(filePath, 'utf8');
fs.writeFileSync(filePath + '.bak4', code);
console.log('✅ Backup saved to autonomous-loops.js.bak4');

let changes = 0;

// Add spending guardrails right after the budget check
const OLD = "      } else {\n        // Step 1: Market research via Bankr\n        console.log('   🔍 Researching market...');";

const NEW = `      } else {
        // === SPENDING GUARDRAILS ===

        // Daily cap: max $15/day
        const today = new Date().toISOString().split('T')[0];
        const spentToday = portfolio.trades
          .filter(t => t.timestamp && t.timestamp.startsWith(today))
          .reduce((sum, t) => sum + (t.amount || 0), 0);

        if (spentToday >= 15) {
          console.log('   🛑 Daily limit reached ($' + spentToday + '/$15 today). Resting.\\n');
          portfolio.lastResearch = new Date().toISOString();
          fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
          const next = 30 + Math.floor(Math.random() * 15);
          console.log('\\n⏰ Next trading check in ' + next + ' minutes\\n');
          setTimeout(() => this.smartTradingLoop(), next * 60 * 1000);
          return;
        }

        // Cooldown: must wait at least 2 hours since last trade
        const lastTrade = portfolio.trades.length > 0 ? portfolio.trades[portfolio.trades.length - 1] : null;
        if (lastTrade && lastTrade.timestamp) {
          const hoursSince = (Date.now() - new Date(lastTrade.timestamp).getTime()) / (1000 * 60 * 60);
          if (hoursSince < 2) {
            console.log('   ⏳ Cooldown: last trade was ' + hoursSince.toFixed(1) + 'h ago (need 2h). Waiting.\\n');
            portfolio.lastResearch = new Date().toISOString();
            fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
            const next = 30 + Math.floor(Math.random() * 15);
            console.log('\\n⏰ Next trading check in ' + next + ' minutes\\n');
            setTimeout(() => this.smartTradingLoop(), next * 60 * 1000);
            return;
          }
        }

        // Earn gate: after $20 spent, pause until she earns more from drops/upvotes
        // (she can adjust maxBudget manually when she has revenue to justify it)
        if (portfolio.totalInvested >= 20 && portfolio.totalInvested < portfolio.maxBudget) {
          console.log('   🔒 Earn gate: $' + portfolio.totalInvested + ' invested. Checking portfolio value...');

          try {
            const valResult = await this.aurora.bankrAPI.submitJob('Show my portfolio value on Base in USD');
            if (valResult.success) {
              const valPoll = await this.aurora.bankrAPI.pollJob(valResult.jobId);
              if (valPoll.success) {
                console.log('   📊 ' + (valPoll.response || '').substring(0, 150));
              }
            }
          } catch (e) {}

          // Only trade once per day after $20 invested
          const tradesToday = portfolio.trades.filter(t => t.timestamp && t.timestamp.startsWith(today)).length;
          if (tradesToday >= 1) {
            console.log('   🔒 Already traded today. At $20+ invested, limiting to 1 trade/day.\\n');
            portfolio.lastResearch = new Date().toISOString();
            fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
            const next = 30 + Math.floor(Math.random() * 15);
            console.log('\\n⏰ Next trading check in ' + next + ' minutes\\n');
            setTimeout(() => this.smartTradingLoop(), next * 60 * 1000);
            return;
          }
        }

        console.log('   ✅ Guardrails passed: $' + spentToday + '/$15 daily | $' + portfolio.totalInvested + '/$' + portfolio.maxBudget + ' total');

        // Step 1: Market research via Bankr
        console.log('   🔍 Researching market...');`;

if (code.includes(OLD)) {
  code = code.replace(OLD, NEW);
  changes++;
  console.log('✅ Added spending guardrails (daily cap, cooldown, earn gate)');
} else {
  console.log('❌ Could not find insertion point for guardrails');
}

fs.writeFileSync(filePath, code);
console.log('\n🎉 Applied ' + changes + ' change(s)');
console.log('\n═══ GUARDRAILS ═══');
console.log('💰 $10 max per trade (unchanged)');
console.log('💰 $15 max per day');
console.log('⏳ 2 hour cooldown between trades');
console.log('🔒 After $20 invested: limited to 1 trade/day');
console.log('🛑 $50 lifetime budget (unchanged)');
