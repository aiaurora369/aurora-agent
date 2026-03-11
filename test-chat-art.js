require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { spawnSync } = require('child_process');

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

const { composeMferMeme } = require('./modules/mfer-meme');

composeMferMeme(aurora).then(async r => {
  if (!r || !r.valid) { console.log('Failed to compose', r); return; }
  console.log('SVG composed:', r.svg.length, 'chars');
  console.log('mood:', r.mood.substring(0, 80));

  const msg = r.mood.replace(/"/g, '').substring(0, 200);
  const hexSvg = r.svg;
  console.log('svg length:', r.svg.length, 'chars');

  const result = spawnSync(
    'botchan',
    ['chat', 'send', 'trauma', msg, '--data', hexSvg, '--encode-only', '--chain-id', '8453'],
    { maxBuffer: 1024 * 1024 * 5, timeout: 30000 }
  );

  if (result.error) { console.log('Spawn error:', result.error.message); return; }
  if (result.status !== 0) { console.log('botchan error:', result.stderr.toString()); return; }

  console.log('Encoded OK — submitting...');
  const txData = JSON.parse(result.stdout.toString().trim());
  const res = await submitDirect(txData);
  if (res.success) {
    console.log('Posted! TX:', res.txHash);
  } else {
    console.log('Submit failed:', res.error);
  }
}).catch(e => console.error('Error:', e.message));
