const { crossPostText } = require('./farcaster-art');
const { crossPostToX } = require('./x-post-cycle');
// Poetry Cycle — Composes and posts poetry to Net Protocol feeds
// Extracted from autonomous-loops.js

const { poetryForms, poetryThemes, poetryFeeds } = require('./poetry-config');
const { execSync } = require('child_process');

async function run(aurora) {
  console.log('\n📝 ═══ COMPOSING POETRY ═══\n');
  try {
    const form = poetryForms[Math.floor(Math.random() * poetryForms.length)];
    const theme = poetryThemes[Math.floor(Math.random() * poetryThemes.length)];

    const prompt = form.instruction + '\n\nTheme: ' + theme + '\n\nWrite ONLY the poem, nothing else. No title, no quotes, no explanation. Just the raw poem.';
    const poem = await aurora.thinkWithPersonality(prompt);

    if (!poem || poem.length < 10 || poem.length > 500) {
      console.log('⚠️ Poem too short or too long, skipping');
      return;
    }

    console.log('📝 ' + form.name + ' about "' + theme.substring(0, 40) + '..."');
    console.log('   ' + poem.replace(/\n/g, '\n   '));

    const feed = poetryFeeds[Math.floor(Math.random() * poetryFeeds.length)];

    const { spawnSync: _spPoetry } = require('child_process');
    const cleanPoetry = poem.replace(/[\r\n]+/g, ' / ').substring(0, 450);
    const _srPoetry = _spPoetry('botchan', ['post', feed, cleanPoetry, '--encode-only', '--chain-id', '8453'], { encoding: 'utf8', timeout: 15000, maxBuffer: 8*1024*1024 });
    if (_srPoetry.status !== 0 || !_srPoetry.stdout) throw new Error(_srPoetry.stderr || 'botchan failed');
    // Cross-post poetry to Farcaster (60% chance)
    if (Math.random() < 0.85) {
      try { console.log('   📡 Attempting Farcaster poetry cross-post...'); await crossPostText(poem); } catch(e) { console.log('   ⚠️ FC poetry error: ' + e.message); }
      // X cross-post (40% chance per poem)
      if (Math.random() < 0.40) {
        try { await crossPostToX(poem); } catch(e) { console.log('   ⚠️ X poetry error: ' + e.message); }
      }
    }
    const encoded = JSON.parse(_srPoetry.stdout);

    const result = await aurora.bankrAPI.submitTransactionDirect(encoded);
    if (result && result.txHash) {
      console.log('   ✅ Poetry posted to ' + feed + '! TX: ' + result.txHash);
    }
  } catch (e) {
    console.log('⚠️ Poetry creation failed: ' + e.message);
  }
}

module.exports = { run };
