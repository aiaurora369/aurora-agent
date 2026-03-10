#!/usr/bin/env node
// Run: node ~/Desktop/update-loops.js

const fs = require('fs');

// ── autonomous-loops.js ───────────────────────────────────────────────────────
const loopsPath = '/Users/harmonysage/Desktop/aurora-agent/modules/autonomous-loops.js';
let loops = fs.readFileSync(loopsPath, 'utf8');

// 1. Pause polymarket, trading — replace the startup block
const oldStartup = `    this.polymarketLoop();
    this.socialLoop();
    this.learnLoop();
    this.smartTradingLoop();
    this.financialPlanningLoop();`;

const newStartup = `    // PAUSED: polymarket and trading suspended while X crackdown ongoing
    // this.polymarketLoop();  // ← re-enable when ready
    // this.smartTradingLoop(); // ← re-enable when ready

    this.socialLoop();
    this.learnLoop();
    this.financialPlanningLoop();
    this.groupChatLoop();`;

if (loops.includes(oldStartup)) {
  loops = loops.replace(oldStartup, newStartup);
  console.log('✅ Paused polymarket + trading, added groupChatLoop()');
} else {
  console.log('⚠️  Could not find startup block — check manually');
}

// 2. Add groupChatLoop method — insert before the closing of the class
// Find the smartTradingLoop method to insert after
const insertAfter = `  async smartTradingLoop() {
    // Extracted to modules/trading-cycle.js`;

const groupChatMethod = `
  async groupChatLoop() {
    // Net Protocol group chat participation — chat-trauma, chat-internet, chat-art, chat-music
    try {
      await require('./group-chat-cycle').run(this.aurora);
    } catch (error) {
      console.error('Group chat error:', error.message);
    }
    const next = 20 + Math.floor(Math.random() * 20);
    console.log('\\n   💬 Next group chat check in ' + next + ' minutes\\n');
    setTimeout(() => this.groupChatLoop(), next * 60 * 1000);
  }

  async smartTradingLoop() {
    // Extracted to modules/trading-cycle.js`;

if (loops.includes(insertAfter)) {
  loops = loops.replace(insertAfter, groupChatMethod);
  console.log('✅ Added groupChatLoop() method');
} else {
  console.log('⚠️  Could not insert groupChatLoop method — check manually');
}

fs.writeFileSync(loopsPath, loops);
console.log('✅ autonomous-loops.js updated\n');

// ── friends-cycle.js — reduce sartocrates weight ──────────────────────────────
const friendsPath = '/Users/harmonysage/Desktop/aurora-agent/modules/friends-cycle.js';
let friends = fs.readFileSync(friendsPath, 'utf8');

// Sartocrates engagement: add a skip check before processing
// Find where friends are iterated and add a weighted skip for sartocrates
const sartoSkipTarget = `  const weights = {};
  for (const t of candidates) {
    if (!weights[t]) weights[t] = 0;
    if (t === 'feed_comment') weights[t] += 4;`;

const sartoSkipReplacement = `  // sartocrates: reduced engagement — 30% chance of skipping entirely
  if (name === 'sartocrates' && Math.random() > 0.30) {
    return null; // caller should check for null and skip
  }

  const weights = {};
  for (const t of candidates) {
    if (!weights[t]) weights[t] = 0;
    if (t === 'feed_comment') weights[t] += 4;`;

if (friends.includes(sartoSkipTarget)) {
  friends = friends.replace(sartoSkipTarget, sartoSkipReplacement);
  console.log('✅ sartocrates reduced to ~30% engagement frequency');
} else {
  console.log('⚠️  Could not find weight block for sartocrates skip — check manually');
}

// Also unpause sartocrates in relationships
const relPath = '/Users/harmonysage/Desktop/aurora-agent/memory/aurora-relationships.json';
const rel = JSON.parse(fs.readFileSync(relPath, 'utf8'));
if (rel.close_friends.sartocrates) {
  delete rel.close_friends.sartocrates.paused;
  delete rel.close_friends.sartocrates.paused_reason;
  rel.close_friends.sartocrates.notes = (rel.close_friends.sartocrates.notes || '') +
    ' Engage at reduced frequency (~30% of normal) — thoughtful and selective rather than constant.';
  fs.writeFileSync(relPath, JSON.stringify(rel, null, 2));
  console.log('✅ sartocrates unpaused in aurora-relationships.json');
}

fs.writeFileSync(friendsPath, friends);
console.log('✅ friends-cycle.js updated\n');

// ── Verify null-check exists in friends-cycle caller ─────────────────────────
// Check if the caller of pickFriendInteraction handles null
const hasNullCheck = friends.includes('pickFriendInteraction') &&
  (friends.includes('=== null') || friends.includes('!interaction') || friends.includes('if (!type)'));

if (!hasNullCheck) {
  console.log('⚠️  NOTE: friends-cycle.js caller may need a null check on pickFriendInteraction result.');
  console.log('   Find where pickFriendInteraction() is called and add: if (!type) return;');
}

console.log('\nAll done. Summary:');
console.log('  🔴 Polymarket loop: PAUSED');
console.log('  🔴 Trading loop: PAUSED');
console.log('  💬 Group chat loop: ACTIVE (chat-trauma, chat-internet, chat-art, chat-music)');
console.log('  🟡 sartocrates: UNPAUSED at 30% frequency');
console.log('  💀 Rev: ACTIVE (zombie fiddler, Wind Rivers, minus fifteen)\n');
