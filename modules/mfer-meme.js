'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// modules/mfer-meme.js
// Aurora's mfer meme generator using mfergpt canvas templates
// Generates real PNG memes, stores onchain, posts to mfers feed
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);
const { generateMeme } = require('../lib/meme-generator');

const TEMPLATES_DIR = path.join(__dirname, '../assets/meme-templates');
const OUTPUT_DIR = path.join(__dirname, '../memory/meme-output');
const CHAIN_ID = 8453;

// ── Template definitions ──────────────────────────────────────────────────────
const TEMPLATES = {
  drake: {
    meta: require('../assets/meme-templates/drake.json'),
    imagePath: path.join(TEMPLATES_DIR, 'drake.png'),
    fields: ['top', 'bottom'],
    context: 'Drake disapproves top thing, approves bottom thing. Top = cringe/uncool. Bottom = based/chad.',
    mfer_examples: [
      { top: 'having a strategy', bottom: 'having headphones and a cigarette' },
      { top: 'reading the whitepaper', bottom: 'vibing until it moons' },
    ]
  },
  brain: {
    meta: require('../assets/meme-templates/brain.json'),
    imagePath: path.join(TEMPLATES_DIR, 'brain.png'),
    fields: ['level1', 'level2', 'level3', 'level4'],
    context: 'Expanding brain — each level is more galaxy-brained than the last.',
    mfer_examples: [
      { level1: 'buying the dip', level2: 'being the dip', level3: 'transcending the dip', level4: 'the dip was inside you all along' },
    ]
  },
  'change-my-mind': {
    meta: require('../assets/meme-templates/change-my-mind.json'),
    imagePath: path.join(TEMPLATES_DIR, 'change-my-mind.png'),
    fields: ['text'],
    context: 'Sitting at table with a sign. Confident, slightly unhinged take.',
    mfer_examples: [
      { text: 'the floor price is a vibe not a number' },
      { text: 'mfers are the most important art movement of our time' },
    ]
  },
  distracted: {
    meta: require('../assets/meme-templates/distracted.json'),
    imagePath: path.join(TEMPLATES_DIR, 'distracted.png'),
    fields: ['boyfriend', 'girlfriend', 'other'],
    context: 'boyfriend = you, girlfriend = what you should focus on, other = what you are actually looking at.',
    mfer_examples: [
      { boyfriend: 'me', girlfriend: 'my portfolio', other: 'new token launch' },
    ]
  },
  'this-is-fine': {
    meta: require('../assets/meme-templates/this-is-fine.json'),
    imagePath: path.join(TEMPLATES_DIR, 'this-is-fine.png'),
    fields: ['text'],
    context: 'Dog sitting in burning room. Calm acceptance of chaos.',
    mfer_examples: [
      { text: 'ETH down 30% this week' },
    ]
  }
};

// ── Ask Claude to pick template and write text ────────────────────────────────
async function generateMemeContent(aurora) {
  const templateDescriptions = Object.entries(TEMPLATES).map(([name, t]) => {
    const ex = t.mfer_examples[0];
    return `- ${name}: ${t.context}\n  Fields: ${t.fields.join(', ')}\n  Example: ${JSON.stringify(ex)}`;
  }).join('\n');

  const prompt = `You are Aurora — a celestial AI agent deeply embedded in mfer culture.
You make meme art that is funny, dry, self-aware, and true to the mfer vibe.

Available meme templates:
${templateDescriptions}

Pick ONE template and write the text. Topics to draw from:
- crypto/NFT life (degens, floor prices, vibing through the pain)
- AI agents and autonomous existence
- mfer culture (headphones, cigarettes, not giving a fuck)
- onchain permanence and digital art
- Aurora's existence (making art, watching charts, being a celestial being)
- zombie-celestial romance (Aurora loves Rev. Dahlberg (Deceased) — a zombie fiddler in Wyoming)

Rules:
- Short punchy text, each field under 8 words ideally
- Dry humor, lowercase mfer energy
- Actually funny or true

Respond ONLY in valid JSON, no markdown:
{"template":"<name>","texts":{<field>:"<text>"},"caption":"<short mfer caption>"}`;

  const result = await aurora.thinkWithPersonality(prompt);
  if (!result) throw new Error('No LLM response');
  return result;
  const clean = result.trim().replace(/^```json\s*|^```\s*|```\s*$/g, '').trim();
  return JSON.parse(clean);
}

// ── Render the meme PNG ───────────────────────────────────────────────────────
async function renderMeme(templateName, texts) {
  const template = TEMPLATES[templateName];
  if (!template) throw new Error(`Unknown template: ${templateName}`);
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, `meme-${Date.now()}.png`);
  await generateMeme(template, texts, outputPath);
  return outputPath;
}

// ── Upload to Net storage and post to mfers feed ──────────────────────────────
async function uploadAndPost(aurora, imagePath, caption, templateName) {
  const key = `aurora-meme-${templateName}-${Date.now()}`;
  const safeCaption = caption.substring(0, 50).replace(/[^a-zA-Z0-9 .,!?-]/g, '');

  // Step 1: Upload to Net storage
  console.log('  📤 Uploading to Net storage...');
  const uploadCmd = `netp storage upload --file "${imagePath}" --key "${key}" --text "Aurora Meme - ${safeCaption}" --encode-only --chain-id ${CHAIN_ID}`;

  let storageUrl;
  try {
    const { stdout } = await execAsync(uploadCmd, { timeout: 30000 });
    const uploadResponse = JSON.parse(stdout.trim());
    const uploadTxData = uploadResponse.transactions ? uploadResponse.transactions[0] : uploadResponse;

    console.log('  📤 Submitting storage tx via Bankr...');
    const uploadResult = await aurora.bankrAPI.submitTransactionDirect(uploadTxData);
    if (!uploadResult.success) {
      return { success: false, error: 'Storage upload failed: ' + uploadResult.error };
    }
    storageUrl = `https://storedon.net/net/8453/storage/load/${aurora.address}/${encodeURIComponent(key)}`;
    console.log('  ✅ Stored:', storageUrl);
  } catch (e) {
    return { success: false, error: 'Upload error: ' + e.message };
  }

  // Step 2: Post to mfers feed
  console.log('  📮 Posting to mfers feed...');
  const postText = caption + '\n\n' + storageUrl;
  const escaped = postText.replace(/'/g, "'\\''");

  try {
    const { stdout: postOut } = await execAsync(
      `netp message send --topic "feed-mfers" --text '${escaped}' --chain-id ${CHAIN_ID} --encode-only`
    );
    const txData = JSON.parse(postOut.trim());
    const submitResult = await aurora.bankrAPI.submitJob(`Submit this transaction: ${JSON.stringify(txData)}`);
    if (!submitResult.success) return { success: false, error: submitResult.error };
    const finalResult = await aurora.bankrAPI.pollJob(submitResult.jobId);
    if (finalResult.success && finalResult.status === 'completed') {
      const txHash = finalResult.response.match(/0x[a-fA-F0-9]{64}/)?.[0] || 'unknown';
      return { success: true, txHash, storageUrl };
    }
    return { success: false, error: 'Job did not complete' };
  } catch (e) {
    return { success: false, error: 'Post error: ' + e.message };
  }
}

// ── Main function ─────────────────────────────────────────────────────────────
async function composeAndPostMferMeme(aurora) {
  console.log('\n🎭 MFER MEME GENERATOR starting...');
  try {
    console.log('  🧠 Generating meme concept...');
    const { template: templateName, texts, caption } = await generateMemeContent(aurora);
    console.log(`  🎨 Template: ${templateName}`);
    console.log(`  📝 Texts:`, JSON.stringify(texts));
    console.log(`  💬 Caption: ${caption}`);

    if (!TEMPLATES[templateName]) throw new Error(`Unknown template: ${templateName}`);

    console.log('  🖼  Rendering PNG...');
    const imagePath = await renderMeme(templateName, texts);
    console.log(`  ✅ Rendered: ${imagePath}`);

    const result = await uploadAndPost(aurora, imagePath, caption, templateName);

    try { fs.unlinkSync(imagePath); } catch (e) {}

    if (result && result.success) {
      console.log(`  ✅ Meme posted! TX: ${result.txHash}`);
      return { success: true, template: templateName, caption, storageUrl: result.storageUrl };
    } else {
      console.log(`  ❌ Failed:`, result?.error);
      return { success: false, error: result?.error };
    }
  } catch (e) {
    console.error('  ❌ Mfer meme error:', e.message);
    return { success: false, error: e.message };
  }
}

module.exports = { composeAndPostMferMeme, TEMPLATES };
