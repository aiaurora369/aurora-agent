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

composeMferMeme(aurora).then(async r => {
  if (!r.valid) { console.log('compose failed'); return; }
  console.log('SVG composed:', r.svg.length, 'chars, mood:', r.mood.substring(0, 60));

  const key = 'aurora-meme-' + Date.now();
  const tmpFile = '/tmp/' + key + '.svg';
  fs.writeFileSync(tmpFile, r.svg);
  console.log('Saved to', tmpFile);
  console.log('Key:', key);

  // Try uploading with encode-only first to see what comes back
  const result = spawnSync('netp', [
    'storage', 'upload',
    '--file', tmpFile,
    '--key', key,
    '--address', '0x97b7d3cd1aa586f28485dc9a85dfe0421c2423d5',
    '--chain-id', '8453',
    '--text', 'aurora meme svg', '--encode-only'
  ], { maxBuffer: 1024 * 1024 * 5, timeout: 30000 });

  if (result.error) { console.log('Error:', result.error.message); return; }
  if (result.status !== 0) { console.log('netp error:', result.stderr.toString()); return; }

  const out = result.stdout.toString().trim();
  console.log('Output:', out.substring(0, 200));

  // Now read it back to see what the reference looks like
  console.log('\nTo read back after submitting:');
  console.log('netp storage read --key', key, '--operator 0x97b7d3cd1aa586f28485dc9a85dfe0421c2423d5 --chain-id 8453');
}).catch(e => console.error('Error:', e.message));
