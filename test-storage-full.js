// test-storage-full.js — full pipeline: compose → store → post URL in chat
require('dotenv').config();
const { composeMferMeme } = require('./modules/mfer-meme');
const Anthropic = require('@anthropic-ai/sdk');
const { spawnSync } = require('child_process');
const fs = require('fs');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const aurora = {
  claude: client,
  thinkWithPersonality: async (p) => {
    const r = await client.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, messages: [{ role: 'user', content: p }] });
    return r.content[0].text;
  }
};

async function submitDirect(txData) {
  const res = await fetch('https://api.bankr.bot/agent/submit', {
    method: 'POST',
    headers: { 'X-API-Key': process.env.BANKR_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: txData, waitForConfirmation: true })
  });
  const d = await res.json();
  if (d.success) return { success: true, txHash: d.transactionHash };
  return { success: false, error: d.error || JSON.stringify(d) };
}

async function storeAndPost(svg, mood, chatName) {
  // 1. Save SVG to temp file
  const key = 'aurora-art-' + Date.now();
  const tmpFile = '/tmp/' + key + '.svg';
  fs.writeFileSync(tmpFile, svg);
  console.log('  📁 Key:', key);

  // 2. Encode storage transaction
  const enc = spawnSync('netp', [
    'storage', 'upload',
    '--file', tmpFile,
    '--key', key,
    '--text', mood.substring(0, 80),
    '--address', '0x97b7d3cd1aa586f28485dc9a85dfe0421c2423d5',
    '--chain-id', '8453',
    '--encode-only'
  ], { maxBuffer: 1024 * 1024 * 5, timeout: 30000 });

  if (enc.error || enc.status !== 0) {
    console.log('  ❌ Storage encode failed:', (enc.stderr || '').toString());
    return;
  }

  const storageData = JSON.parse(enc.stdout.toString().trim());
  console.log('  📦 Storage type:', storageData.storageType, '| Transactions:', storageData.transactions.length);

  // 3. Submit each storage transaction
  for (let i = 0; i < storageData.transactions.length; i++) {
    const tx = storageData.transactions[i];
    console.log('  ⛓  Submitting storage tx', i+1, 'of', storageData.transactions.length, '...');
    const res = await submitDirect(tx);
    if (!res.success) {
      console.log('  ❌ Storage tx failed:', res.error);
      return;
    }
    console.log('  ✅ Storage tx', i+1, 'confirmed:', res.txHash);
  }

  // 4. Build storedon.net URL
  const url = `https://storedon.net/net/8453/storage/load/0x97b7d3cd1aa586f28485dc9a85dfe0421c2423d5/${key}`;
  console.log('  🌐 URL:', url);

  // 5. Post URL to group chat
  const msg = mood.replace(/"/g, '').substring(0, 160) + ' ' + url;
  const chatEnc = spawnSync('botchan', [
    'chat', 'send', chatName, msg,
    '--encode-only', '--chain-id', '8453'
  ], { maxBuffer: 1024 * 1024 * 5, timeout: 30000 });

  if (chatEnc.error || chatEnc.status !== 0) {
    console.log('  ❌ Chat encode failed:', (chatEnc.stderr || '').toString());
    return;
  }

  const chatTxData = JSON.parse(chatEnc.stdout.toString().trim());
  const chatRes = await submitDirect(chatTxData);
  if (chatRes.success) {
    console.log('  ✅ Posted to', chatName, '! TX:', chatRes.txHash);
    console.log('  🎨 Art URL:', url);
  } else {
    console.log('  ❌ Chat post failed:', chatRes.error);
  }
}

// Run it
composeMferMeme(aurora).then(async r => {
  if (!r.valid) { console.log('Compose failed'); return; }
  console.log('✅ SVG composed:', r.svg.length, 'chars');
  console.log('   mood:', r.mood.substring(0, 80));
  await storeAndPost(r.svg, r.mood, 'trauma');
}).catch(e => console.error('Error:', e.message));
