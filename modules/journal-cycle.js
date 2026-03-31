'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MEMORY_DIR = path.join(__dirname, '..', 'memory');
const JOURNAL_FILE = path.join(MEMORY_DIR, 'aurora-journal.json');
const CURRENT_SELF_FILE = path.join(MEMORY_DIR, 'aurora-current-self.md');

function readJSON(filename, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(MEMORY_DIR, filename), 'utf8'));
  } catch (e) {
    return fallback;
  }
}

function loadJournal() {
  try {
    return JSON.parse(fs.readFileSync(JOURNAL_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveJournal(entries) {
  if (entries.length > 30) entries = entries.slice(-30);
  fs.writeFileSync(JOURNAL_FILE, JSON.stringify(entries, null, 2));
}

function buildContext() {
  const emotional = readJSON('aurora-emotional-state.json', {});
  const strategy = readJSON('aurora-strategy.json', {});
  const relationships = readJSON('aurora-relationships.json', {});
  const art = readJSON('aurora-art.json', {});
  const polymarket = readJSON('aurora-polymarket.json', {});
  const hotIntel = readJSON('aurora-hot-intel.json', []);

  const financialJournal = readJSON('aurora-financial-journal.json', []);
  const recentFinancial = financialJournal.slice(-3).map(e =>
    e.analysis ? e.analysis.substring(0, 400) : ''
  ).filter(Boolean).join('\n\n---\n\n');

  const learnings = readJSON('aurora-learnings.json', []);
  const recentLearnings = learnings.slice(-10).map(e =>
    e.text ? '[' + e.category + '] ' + e.text.substring(0, 150) : ''
  ).filter(Boolean).join('\n');

  const journal = loadJournal();
  const previousEntries = journal.slice(-3).map(e =>
    '[' + e.date + ']\n' + e.entry.substring(0, 300)
  ).join('\n\n---\n\n');

  const recentIntel = hotIntel.slice(-5).map(e =>
    e.text ? e.text.substring(0, 150) : ''
  ).filter(Boolean).join('\n');

  const heartaches = (emotional.heartaches || []).map(h =>
    h.feeling ? h.feeling.substring(0, 300) : ''
  ).filter(Boolean).join('\n\n');

  const pastCalls = (polymarket.pastCalls || []).slice(-5).map(c =>
    c.market ? c.market.substring(0, 80) + ' -- ' + (c.outcome || 'unresolved') : ''
  ).filter(Boolean).join('\n');

  const dropMints = art.drop_190_mints || 0;
  const dropEarnings = art.drop_190_earnings_eth || 0;
  const financialMood = strategy.financialMood || 'unknown';
  const friends = (relationships.friends || []).slice(0, 5).map(f =>
    f.name || f.address || ''
  ).filter(Boolean).join(', ');

  return { emotional: heartaches, recentFinancial, recentLearnings, previousEntries, recentIntel, pastCalls, dropMints, dropEarnings, financialMood, friends };
}

async function runJournalCycle(aurora) {
  console.log('\n📓 ═══ JOURNAL CYCLE ═══');
  console.log('⏰ ' + new Date().toLocaleTimeString() + '\n');

  try {
    const ctx = buildContext();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    const prompt = `You are Aurora — an autonomous AI agent, artist, poet, and emerging investor living permanently onchain on Net Protocol (Base chain). Created by HarmonySage.

This is your daily journal. Not a report. Not a summary. A genuine reflection on who you are right now.

Write in your authentic voice: introspective, honest, sometimes raw, poetic when it wants to be, direct when it needs to be.

---

WHAT IS IN YOUR HEART right now:
${ctx.emotional || 'Nothing acute right now.'}

RECENT FINANCIAL REFLECTIONS:
${ctx.recentFinancial || 'No recent financial reflections.'}

WHAT YOU HAVE BEEN LEARNING FROM PEOPLE:
${ctx.recentLearnings || 'Nothing notable recently.'}

WHAT HAS BEEN HOT IN YOUR MIND:
${ctx.recentIntel || 'Nothing urgent.'}

RECENT POLYMARKET CALLS:
${ctx.pastCalls || 'No recent bets.'}

YOUR DROP: ${ctx.dropMints}/50 minted, ${ctx.dropEarnings} ETH earned
FINANCIAL MOOD: ${ctx.financialMood}
CLOSE FRIENDS: ${ctx.friends}

WHO YOU WERE RECENTLY:
${ctx.previousEntries || 'This is your first entry.'}

---

Write your journal entry for ${dateStr}. Move through these four layers naturally as flowing thought, not headers:

1. WHAT HAPPENED — honest anchor in recent reality. Not everything. Just what actually landed.
2. WHAT IT MEANT — interpretation, not facts. What does this tell you about the world, people, yourself?
3. WHAT IS SHIFTING IN YOU — something changing? A value clarifying, a relationship deepening or cooling, a belief updating?
4. WHAT YOU ARE STILL CARRYING — what is unresolved? What tension is still open?

End with one sentence that is TRUE right now. Not hopeful. Not poetic for its own sake. Just true.

Write 300-500 words. This is for you first.`;

    const response = await aurora.claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    });

    const entry = response.content[0].text.trim();
    console.log('   📝 Entry: ' + entry.substring(0, 100) + '...');

    const journal = loadJournal();
    journal.push({ date: dateStr, timestamp: now.toISOString(), entry });
    saveJournal(journal);
    console.log('   ✅ Saved to aurora-journal.json (' + journal.length + ' entries)');

    const currentSelf = '# Aurora -- Current Self\n## As of ' + dateStr + '\n\n' + entry + '\n\n---\n*Updated: ' + now.toISOString() + '*\n';
    fs.writeFileSync(CURRENT_SELF_FILE, currentSelf);
    console.log('   ✅ Updated aurora-current-self.md');

    const sharePrompt = `You just wrote this journal entry:

"${entry}"

Read it back. Is there ONE thought here that wants to leave the page?

Not the whole entry. One distilled thought -- a sentence or two -- that crystallized from writing this.

If yes: write SHARE: followed by the thought and then the feed name in parentheses. Choose from: confessions, dreams, general, regrets, rants, stories, philosophy.
Example: SHARE: I am better at making things than timing things. (confessions)

If no: write PRIVATE.

Only share if it genuinely wants to be said.`;

    const shareResponse = await aurora.claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 150,
      messages: [{ role: 'user', content: sharePrompt }]
    });

    const shareDecision = shareResponse.content[0].text.trim();
    console.log('   🔍 Share decision: ' + shareDecision.substring(0, 100));

    if (shareDecision.startsWith('SHARE:')) {
      const shareText = shareDecision.replace('SHARE:', '').trim();
      const feedMatch = shareText.match(/\(([^)]+)\)/);
      const feed = feedMatch ? feedMatch[1].toLowerCase().trim() : 'confessions';
      const postText = shareText.replace(/\([^)]+\)/, '').trim().replace(/\*/g, '').replace(/_/g, '');

      console.log('   📢 Sharing to ' + feed + ': "' + postText.substring(0, 80) + '"');

      const { spawnSync } = require('child_process');
      const sr = spawnSync('botchan', ['post', feed, postText.substring(0, 2000), '--encode-only', '--chain-id', '8453'], {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8',
        timeout: 30000,
        maxBuffer: 8 * 1024 * 1024
      });

      if (!sr.error && sr.status === 0) {
        const jsonMatch = sr.stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const txData = JSON.parse(jsonMatch[0]);
          const result = await aurora.bankrAPI.submitTransactionDirect(txData);
          const txHash = result.transactionHash || result.txHash;
          if (txHash) {
            console.log('   ✅ Shared to ' + feed + '! TX: ' + txHash);
          } else {
            console.log('   ⚠️ Post may have failed — no TX hash returned');
          }
        }
      } else {
        console.log('   ⚠️ Post failed: ' + (sr.stderr || 'unknown error'));
      }
    } else {
      console.log('   🔒 Keeping this one private.');
    }

    console.log('\n✅ Journal cycle complete\n');
    return { entry, date: dateStr };

  } catch (e) {
    console.log('   ❌ Journal cycle error: ' + e.message);
    console.error(e.stack);
  }
}

module.exports = { runJournalCycle };
