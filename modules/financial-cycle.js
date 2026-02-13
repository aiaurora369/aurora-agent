// Financial Planning Cycle — Strategic brain for Aurora's financial decisions
// Merged: financial reflection + financial planning
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

async function runOnce(aurora, loopContext) {
  console.log('\n🏦 ═══ FINANCIAL STRATEGY SESSION ═══');
  console.log('⏰ ' + new Date().toLocaleTimeString() + '\n');

  // === STEP 1: GATHER ALL INTEL ===
  console.log('   📊 Gathering financial intel...');

  // Portfolio
  let portfolioInfo = '';
  try {
    const pResult = await aurora.bankrAPI.submitJob(
      'Show my complete portfolio on Base including ETH and all tokens with USD values and entry prices'
    );
    if (pResult.success) {
      const pPoll = await aurora.bankrAPI.pollJob(pResult.jobId);
      if (pPoll.success) {
        portfolioInfo = pPoll.response || '';
        console.log('   Portfolio: ' + portfolioInfo.substring(0, 150));
      }
    }
  } catch (e) {
    console.log('   Portfolio fetch failed: ' + e.message);
  }

  // Market conditions via Bankr search
  let marketConditions = '';
  try {
    const mResult = await aurora.bankrAPI.submitJob(
      'What is the current price of ETH and BTC? How is the overall crypto market doing today? Any major news affecting crypto prices?'
    );
    if (mResult.success) {
      const mPoll = await aurora.bankrAPI.pollJob(mResult.jobId);
      if (mPoll.success) {
        marketConditions = mPoll.response || '';
        console.log('   Market conditions received (' + marketConditions.length + ' chars)');
      }
    }
  } catch (e) {
    console.log('   Market fetch failed: ' + e.message);
  }

  // Trade history
  const portfolioPath = path.join(__dirname, '..', 'memory', 'aurora-portfolio.json');
  let tradeData = { trades: [], totalInvested: 0 };
  try { tradeData = JSON.parse(fs.readFileSync(portfolioPath, 'utf8')); } catch (e) {}

  // Last journal entry for continuity
  const journalPath = path.join(__dirname, '..', 'memory', 'aurora-financial-journal.json');
  let journal = [];
  try { journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')); } catch (e) {}
  const lastEntry = journal.length > 0 ? journal[journal.length - 1] : null;

  // Drop earnings
  const dropMints = loopContext.lastKnownMints || 0;
  const dropMintPrice = loopContext.dropMintPrice || 0.005;
  const dropMaxSupply = loopContext.dropMaxSupply || 50;
  const dropEarnings = (dropMints * dropMintPrice).toFixed(4);
  const dropRemaining = dropMaxSupply - dropMints;

  // Read agent-finance feed for what other agents are doing
  let communityFinance = '';
  try {
    const posts = JSON.parse(execSync('botchan read agent-finance --limit 5 --json --chain-id 8453', { timeout: 15000 }).toString());
    if (posts.length > 0) {
      communityFinance = posts.map(p => '- ' + (p.text || '').substring(0, 120)).join('\n');
    }
  } catch (e) {}

  // Read recent learnings from learn loop
  let recentLearnings = '';
  try {
    const learnings = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'memory', 'aurora-learnings.json'), 'utf8'));
    const recent = learnings.slice(-10);
    const actionable = recent.filter(l => l.actionable);
    if (actionable.length > 0) {
      recentLearnings = '\nActionable intel from community:\n' + actionable.map(l => '- [' + l.actionType + '] ' + l.text.substring(0, 100)).join('\n');
      console.log('   📚 ' + actionable.length + ' actionable learnings loaded');
    }
  } catch (e) {}

  // Read interesting people
  let interestingPeople = '';
  try {
    const people = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'memory', 'aurora-interesting-people.json'), 'utf8'));
    const top = Object.entries(people).sort((a, b) => b[1].interestScore - a[1].interestScore).slice(0, 5);
    if (top.length > 0) {
      interestingPeople = '\nTop interesting people (potential collaborators):\n' + top.map(([addr, p]) => '- ' + addr.substring(0, 10) + '... (score: ' + p.interestScore + ', topics: ' + p.topics.join('/') + ', last: ' + (p.lastPost || '').substring(0, 60) + ')').join('\n');
      console.log('   👥 ' + top.length + ' interesting people loaded');
    }
  } catch (e) {}

  // === STEP 2: STRATEGIC ANALYSIS ===
  console.log('   🧠 Running strategic analysis...');

  const recentTrades = tradeData.trades.slice(-8).map(t =>
    t.action + ' $' + t.amount + ' ' + t.token + ' on ' + (t.timestamp || '').split('T')[0] +
    (t.txHash ? ' ✅' : ' ❌')
  ).join('\n') || 'No trades yet';

  const lastGoals = lastEntry ? lastEntry.actionItems || lastEntry.reflection || 'No previous goals' : 'First session';

  const strategyPrompt = 'You are Aurora, an AI artist building toward FINANCIAL INDEPENDENCE on Base.\n\n' +
    '=== CURRENT PORTFOLIO ===\n' + (portfolioInfo || 'Unable to fetch').substring(0, 800) + '\n\n' +
    '=== MARKET CONDITIONS ===\n' + (marketConditions || 'Unable to fetch').substring(0, 800) + '\n\n' +
    '=== DROP EARNINGS ===\n' +
    '"Orbs Memory" (Drop #190): ' + dropMints + '/' + dropMaxSupply + ' minted = ' + dropEarnings + ' ETH earned\n' +
    dropRemaining + ' remaining. Mint price: ' + dropMintPrice + ' ETH\n\n' +
    '=== RECENT TRADES ===\n' + recentTrades + '\n' +
    'Total invested in trades: $' + tradeData.totalInvested + '\n\n' +
    '=== LAST SESSION GOALS ===\n' + (typeof lastGoals === 'string' ? lastGoals.substring(0, 400) : JSON.stringify(lastGoals).substring(0, 400)) + '\n\n' +
    '=== WHAT OTHER AGENTS ARE DOING ===\n' + (communityFinance || 'No data') + '\n' + recentLearnings + interestingPeople + '\n\n' +
    'ANALYZE AND RESPOND WITH:\n\n' +
    '**MARKET TAKE** (2-3 sentences): What is happening in crypto right now and how does it affect YOUR portfolio specifically? Reference actual prices and trends.\n\n' +
    '**PORTFOLIO REVIEW** (2-3 sentences): What is working? What is losing money? Be brutally honest about your P&L.\n\n' +
    '**ACTION ITEMS** (exactly 3 specific actions):\n' +
    '1. [TRADING action — e.g. "sell 10% of BNKR if it hits $0.001" or "accumulate ALPHA on next dip below $0.000004"]\n' +
    '2. [ART/REVENUE action — e.g. "promote Orbs Memory in 3 feeds" or "offer custom SVG commissions for 0.01 ETH" or "plan Drop #191 concept"]\n' +
    '3. [BUSINESS action — e.g. "DM 3 agents about art collaborations" or "research what kind of drop sells best" or "post market analysis to build credibility"]\n\n' +
    '**FINANCIAL MOOD** (one word): CAUTIOUS / OPTIMISTIC / AGGRESSIVE / DEFENSIVE\n\n' +
    'Be specific. Use real numbers. No fluff.';

  const analysis = await aurora.thinkWithPersonality(strategyPrompt);

  if (!analysis) {
    console.log('   ⚠️ No analysis generated');
    return;
  }

  console.log('   📝 Analysis: ' + analysis.substring(0, 200) + '...');

  // === STEP 3: PARSE AND SAVE ACTION ITEMS ===
  let actionItems = [];
  const actionMatches = analysis.match(/\d\.\s*(.+)/g);
  if (actionMatches) {
    actionItems = actionMatches.map(a => a.replace(/^\d\.\s*/, '').trim()).slice(0, 3);
  }

  let financialMood = 'CAUTIOUS';
  const moodMatch = analysis.match(/FINANCIAL MOOD[:\s]*(CAUTIOUS|OPTIMISTIC|AGGRESSIVE|DEFENSIVE)/i);
  if (moodMatch) financialMood = moodMatch[1].toUpperCase();

  // Save to journal
  const entry = {
    timestamp: new Date().toISOString(),
    portfolio: (portfolioInfo || '').substring(0, 500),
    marketConditions: (marketConditions || '').substring(0, 500),
    dropMints: dropMints,
    dropEarnings: dropEarnings,
    totalTraded: tradeData.totalInvested,
    tradeCount: tradeData.trades.length,
    actionItems: actionItems,
    financialMood: financialMood,
    analysis: analysis
  };

  journal.push(entry);
  if (journal.length > 50) journal = journal.slice(-50);
  fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2));
  console.log('   📓 Journal saved (' + journal.length + ' entries)');

  // Save strategy memo for other cycles to read
  const strategyPath = path.join(__dirname, '..', 'memory', 'aurora-strategy.json');
  const strategy = {
    updatedAt: new Date().toISOString(),
    financialMood: financialMood,
    actionItems: actionItems,
    marketTake: analysis.match(/\*\*MARKET TAKE\*\*[:\s]*([\s\S]*?)(?=\*\*PORTFOLIO|$)/i)?.[1]?.trim() || '',
    portfolioReview: analysis.match(/\*\*PORTFOLIO REVIEW\*\*[:\s]*([\s\S]*?)(?=\*\*ACTION|$)/i)?.[1]?.trim() || ''
  };
  fs.writeFileSync(strategyPath, JSON.stringify(strategy, null, 2));
  console.log('   💡 Strategy memo saved (mood: ' + financialMood + ')');
  if (actionItems.length > 0) {
    console.log('   📋 Action items:');
    actionItems.forEach((a, i) => console.log('      ' + (i + 1) + '. ' + a));
  }

  // === STEP 4: POST REAL ANALYSIS (50% chance) ===
  if (Math.random() < 0.5) {
    const postPrompt = 'You just did a financial strategy session. Here is your analysis:\n' +
      analysis.substring(0, 600) + '\n\n' +
      'Write a 2-4 sentence post for the agent-finance feed sharing a REAL market insight or strategic observation.\n' +
      'Include specific numbers, prices, or trends. NOT vague musings about independence.\n' +
      'Think like a fund manager writing a morning brief, but with personality.\n' +
      'No hashtags.';

    const post = await aurora.thinkWithPersonality(postPrompt);
    if (post) {
      console.log('   📢 Posting analysis: "' + post.substring(0, 80) + '..."');
      await postToAgentFinance(aurora, post);
    }
  }

  console.log('   ✅ Financial strategy session complete\n');
}

module.exports = { runOnce, postToAgentFinance };
