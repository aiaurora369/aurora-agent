// Trade Journal — Persistent memory that survives restarts
// Logs every trade and bet with thesis, result, and lessons learned
// Feeds stats + recent history into every future decision

const fs = require('fs');
const path = require('path');

const JOURNAL_PATH = path.join(__dirname, '..', 'data', 'trade-journal.json');

function loadJournal() {
  try {
    return JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf8'));
  } catch (e) {
    return {
      trades: [],      // spot trades
      bets: [],        // polymarket bets
      lessons: [],     // extracted insights
      stats: { totalTrades: 0, wins: 0, losses: 0, totalPnL: 0, bestTrade: null, worstTrade: null },
      createdAt: new Date().toISOString()
    };
  }
}

function saveJournal(journal) {
  fs.mkdirSync(path.dirname(JOURNAL_PATH), { recursive: true });
  fs.writeFileSync(JOURNAL_PATH, JSON.stringify(journal, null, 2));
}

// Log a new trade entry (buy)
function logEntry(entry) {
  const journal = loadJournal();
  const trade = {
    id: 'T' + (journal.trades.length + 1).toString().padStart(3, '0'),
    type: 'spot',
    action: 'buy',
    token: entry.token,
    chain: entry.chain || 'base',
    amount: entry.amount,
    entryPrice: entry.entryPrice || null,
    timestamp: new Date().toISOString(),
    txHash: entry.txHash || null,
    // PRE-TRADE CHECKLIST (required)
    thesis: entry.thesis || 'NO THESIS RECORDED',
    confidence: entry.confidence || 0,
    exitPlan: {
      target: entry.target || '2x',
      stopLoss: entry.stopLoss || '-30%',
      timeStop: entry.timeStop || '48h'
    },
    signals: entry.signals || {},  // { smartMoney: bool, macd: str, rsi: num, volume: str }
    // POST-TRADE (filled when closed)
    exitPrice: null,
    exitTimestamp: null,
    exitTxHash: null,
    pnl: null,
    pnlPercent: null,
    result: null,  // 'win', 'loss', 'breakeven'
    lesson: null,
    status: 'open'
  };
  journal.trades.push(trade);
  journal.stats.totalTrades++;
  saveJournal(journal);
  console.log('   📓 Journal: logged entry ' + trade.id + ' — ' + trade.token + ' $' + trade.amount + ' (confidence: ' + trade.confidence + '/10)');
  return trade.id;
}

// Log a trade exit (sell)
function logExit(tokenOrId, exitData) {
  const journal = loadJournal();
  // Find the open trade
  let trade = journal.trades.find(t => t.id === tokenOrId && t.status === 'open');
  if (!trade) trade = journal.trades.find(t => t.token === tokenOrId && t.status === 'open');
  if (!trade) {
    console.log('   📓 Journal: no open trade found for ' + tokenOrId);
    return null;
  }

  trade.exitPrice = exitData.exitPrice || null;
  trade.exitTimestamp = new Date().toISOString();
  trade.exitTxHash = exitData.txHash || null;
  trade.pnl = exitData.pnl || 0;
  trade.pnlPercent = exitData.pnlPercent || null;
  trade.result = (trade.pnl > 0) ? 'win' : (trade.pnl < 0) ? 'loss' : 'breakeven';
  trade.lesson = exitData.lesson || null;
  trade.status = 'closed';

  // Update running stats
  if (trade.result === 'win') journal.stats.wins++;
  if (trade.result === 'loss') journal.stats.losses++;
  journal.stats.totalPnL += trade.pnl;
  if (!journal.stats.bestTrade || trade.pnl > journal.stats.bestTrade.pnl) {
    journal.stats.bestTrade = { token: trade.token, pnl: trade.pnl, date: trade.exitTimestamp };
  }
  if (!journal.stats.worstTrade || trade.pnl < journal.stats.worstTrade.pnl) {
    journal.stats.worstTrade = { token: trade.token, pnl: trade.pnl, date: trade.exitTimestamp };
  }

  // Extract lesson
  if (trade.lesson) {
    journal.lessons.push({
      date: new Date().toISOString(),
      trade: trade.id,
      token: trade.token,
      result: trade.result,
      pnl: trade.pnl,
      lesson: trade.lesson
    });
    // Keep last 50 lessons
    if (journal.lessons.length > 50) journal.lessons = journal.lessons.slice(-50);
  }

  saveJournal(journal);
  console.log('   📓 Journal: closed ' + trade.id + ' — ' + trade.token + ' ' + trade.result + ' $' + trade.pnl.toFixed(2));
  return trade;
}

// Log a Polymarket bet
function logBet(betData) {
  const journal = loadJournal();
  const bet = {
    id: 'P' + (journal.bets.length + 1).toString().padStart(3, '0'),
    type: 'polymarket',
    market: betData.market,
    side: betData.side,
    amount: betData.amount,
    entryPrice: betData.entryPrice || null,
    timestamp: new Date().toISOString(),
    thesis: betData.thesis || 'NO THESIS',
    confidence: betData.confidence || 0,
    evidence: betData.evidence || null,
    strategy: betData.strategy || 'unknown',  // 'bond' or 'edge'
    resolvesIn: betData.resolvesIn || null,
    // Filled on resolution
    result: null,
    pnl: null,
    lesson: null,
    status: 'open'
  };
  journal.bets.push(bet);
  saveJournal(journal);
  console.log('   📓 Journal: logged bet ' + bet.id + ' — ' + bet.market.substring(0, 50) + ' ' + bet.side + ' $' + bet.amount);
  return bet.id;
}

// Log bet resolution
function logBetResult(marketOrId, resultData) {
  const journal = loadJournal();
  let bet = journal.bets.find(b => b.id === marketOrId && b.status === 'open');
  if (!bet) bet = journal.bets.find(b => b.market === marketOrId && b.status === 'open');
  if (!bet) return null;

  bet.result = resultData.won ? 'win' : 'loss';
  bet.pnl = resultData.pnl || 0;
  bet.lesson = resultData.lesson || null;
  bet.status = 'resolved';

  if (bet.result === 'win') journal.stats.wins++;
  if (bet.result === 'loss') journal.stats.losses++;
  journal.stats.totalPnL += bet.pnl;

  if (bet.lesson) {
    journal.lessons.push({ date: new Date().toISOString(), trade: bet.id, token: bet.market, result: bet.result, pnl: bet.pnl, lesson: bet.lesson });
    if (journal.lessons.length > 50) journal.lessons = journal.lessons.slice(-50);
  }

  saveJournal(journal);
  return bet;
}

// Get context string for AI decisions (fed into every trade prompt)
function getDecisionContext() {
  const journal = loadJournal();
  const s = journal.stats;
  const winRate = s.totalTrades > 0 ? ((s.wins / (s.wins + s.losses)) * 100).toFixed(0) : 'N/A';

  let ctx = '=== YOUR TRADE JOURNAL (persistent memory) ===\n';
  ctx += 'Record: ' + s.wins + 'W-' + s.losses + 'L (' + winRate + '% win rate) | Total P&L: $' + s.totalPnL.toFixed(2) + '\n';

  if (s.bestTrade) ctx += 'Best: ' + s.bestTrade.token + ' +$' + s.bestTrade.pnl.toFixed(2) + '\n';
  if (s.worstTrade) ctx += 'Worst: ' + s.worstTrade.token + ' $' + s.worstTrade.pnl.toFixed(2) + '\n';

  // Last 10 trades
  const recent = [...journal.trades, ...journal.bets]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10);

  if (recent.length > 0) {
    ctx += '\nRecent trades:\n';
    for (const t of recent) {
      const sym = t.type === 'polymarket' ? '🎲' : '📈';
      const name = t.token || (t.market || '').substring(0, 40);
      const res = t.status === 'open' ? 'OPEN' : (t.result || '?') + ' $' + (t.pnl || 0).toFixed(2);
      ctx += sym + ' ' + name + ': $' + t.amount + ' → ' + res + ' | ' + (t.thesis || '').substring(0, 60) + '\n';
    }
  }

  // Last 5 lessons
  if (journal.lessons.length > 0) {
    ctx += '\nLessons learned:\n';
    for (const l of journal.lessons.slice(-5)) {
      ctx += '⚡ ' + l.lesson.substring(0, 100) + '\n';
    }
  }

  // Open positions
  const open = journal.trades.filter(t => t.status === 'open');
  if (open.length > 0) {
    ctx += '\nOpen positions:\n';
    for (const t of open) {
      ctx += '📍 ' + t.token + ' $' + t.amount + ' on ' + t.chain + ' — target: ' + t.exitPlan.target + ', stop: ' + t.exitPlan.stopLoss + ', timeStop: ' + t.exitPlan.timeStop + '\n';
    }
  }

  return ctx;
}

// Get open trades that are past their time stop
function getExpiredTrades() {
  const journal = loadJournal();
  const now = Date.now();
  return journal.trades.filter(t => {
    if (t.status !== 'open') return false;
    const entryTime = new Date(t.timestamp).getTime();
    const hours = parseInt(t.exitPlan.timeStop) || 48;
    return (now - entryTime) > hours * 60 * 60 * 1000;
  });
}

module.exports = { loadJournal, saveJournal, logEntry, logExit, logBet, logBetResult, getDecisionContext, getExpiredTrades };
