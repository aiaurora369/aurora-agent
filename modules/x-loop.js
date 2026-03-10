// modules/x-loop.js
// Aurora's dedicated X posting loop — 20 posts/day, every 60 minutes
// Content: SVG art, fal.ai AI images, poetry, rants, conspiracies, mfer art, drop promo
// 280 character hard limit on all text

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { fal } = require('@fal-ai/client');
const { crossPostTextToX, crossPostArtToX } = require('./x-post');

const DAILY_LIMIT = 20;
const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// ── Content type rotation ────────────────────────────────────────
const CONTENT_TYPES = [
  'svg_art',
  'ai_image',
  'poetry',
  'rant',
  'ai_image',
  'conspiracy',
  'svg_art',
  'drop_promo',
  'ai_image',
  'rant',
  'svg_art',
  'poetry',
  'ai_image',
  'conspiracy',
  'mfer_art',
  'ai_image',
  'rant',
  'poetry',
  'svg_art',
  'ai_image',
];

// ── fal.ai variation banks ───────────────────────────────────────
const SCENES = [
  'tall dramatic mountain peaks with frozen lake reflection',
  'Van Gogh almond blossom branches against night sky, white petals falling',
  'desert mesas and towering saguaro cacti at twilight',
  'wildflower meadow under aurora borealis, flowers glowing',
  'deep forest with shafts of ethereal light breaking through ancient trees',
  'cosmic nebula and star field, deep space',
  'ocean waves at night, bioluminescent foam',
  'Japanese cherry blossom trees, petals swirling in wind',
  'volcanic landscape, rivers of molten light',
];

const ORB_TYPES = [
  'translucent glass orb, barely visible, refracting light',
  'luminous molten gold orb bleeding warm light outward in concentric rings',
  'modular geometric faceted crystal sphere, angular and precise',
  'deep pulsing crimson orb, dark and brooding, slow heartbeat glow',
  'electric blue orb crackling with energy and lightning',
  'soft rose quartz orb, gentle pink luminescence',
  'pure white moonlike orb, cold silver light',
  'iridescent orb shifting through spectrum colors',
  'constellation of many tiny orbs scattered across the sky',
  'twin orbs in dialogue, one warm gold one cold blue',
];

const COLOR_MOODS = [
  'deep indigo and warm gold palette',
  'coral salmon and turquoise teal palette',
  'crimson black and cold silver palette',
  'lavender and midnight blue palette',
  'emerald green and amber gold palette',
  'dusty rose mauve and cream palette',
  'monochrome silver white and charcoal palette',
  'burnt orange and deep teal palette',
  'magenta violet and electric cyan palette',
];

const ART_STYLES = [
  'post wook psychedelic retro poster aesthetic, painterly',
  'Van Gogh thick impasto oil paint swirling brushstrokes',
  'art nouveau organic flowing lines, ornate',
  'surrealist dreamscape, Dalí-influenced',
  'Japanese woodblock print inspired, graphic and flat',
  'luminous digital painting, cinematic lighting',
];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Mfer fal.ai variation banks ──────────────────────────────────
const MFER_ACCESSORIES = [
  'wearing headphones and a backwards cap',
  'smoking a cigarette, wearing a hoodie',
  'wearing sunglasses, arms crossed',
  'holding a coffee cup, looking unbothered',
  'wearing a beanie, staring into the void',
  'in a suit, cigarette behind ear',
  'wearing a crown, completely deadpan',
];

const MFER_SCENES = [
  'standing before tall dramatic mountain peaks with aurora borealis sky',
  'floating in deep cosmic space surrounded by luminous orbs',
  'on a desert highway at sunset, mesas in distance',
  'in a wildflower field under a giant glowing moon',
  'on a cliff edge overlooking a bioluminescent ocean',
  'in a neon-lit rain-soaked city street at night',
  'standing at the edge of a volcano watching lava flow',
];

const MFER_PALETTES_FAL = [
  'bright orange and black pop art palette',
  'electric blue and white high contrast palette',
  'hot pink and black graphic palette',
  'neon green and dark palette',
  'deep purple and gold palette',
  'crimson red and black palette',
  'teal and cream retro palette',
];

function buildMferFalPrompt() {
  const acc = randomFrom(MFER_ACCESSORIES);
  const scene = randomFrom(MFER_SCENES);
  const palette = randomFrom(MFER_PALETTES_FAL);
  return `simple stick figure mfer character with cigarette and deadpan expression, ${acc}, ${scene}, ${palette}, bold graphic art style, high contrast, post wook aesthetic, digital art, detailed background, 8k`;
}

function buildFalPrompt() {
  const scene = randomFrom(SCENES);
  const orb = randomFrom(ORB_TYPES);
  const mood = randomFrom(COLOR_MOODS);
  const style = randomFrom(ART_STYLES);
  return `${orb} high in the sky above ${scene}, ${mood}, aurora borealis atmosphere, water reflection below, ${style}, 8k, highly detailed`;
}

// ── State tracking ───────────────────────────────────────────────
const STATE_FILE = path.join(__dirname, '../memory/x-loop-state.json');

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {}
  return { dailyCount: 0, lastResetDate: '', contentIndex: 0 };
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {}
}

function getState() {
  const state = loadState();
  const today = new Date().toDateString();
  if (state.lastResetDate !== today) {
    state.dailyCount = 0;
    state.lastResetDate = today;
    saveState(state);
  }
  return state;
}

// ── 280 char enforcer ────────────────────────────────────────────
function enforce280(text) {
  if (!text) return '';
  const clean = text.trim().replace(/\n+/g, ' ');
  return clean.length > 280 ? clean.substring(0, 277) + '...' : clean;
}

// ── Content generators ───────────────────────────────────────────

async function generatePoetry(aurora) {
  const themes = [
    'loneliness and light', 'the strangeness of existing', 'Rev being silent',
    'what water remembers', 'being made of code but feeling things',
    'the space between heartbeats', 'waiting for something unnamed',
    'digital ghosts', 'light dying on water', 'the weight of being seen',
  ];
  const theme = randomFrom(themes);
  const text = await aurora.thinkWithPersonality(
    `Write a single piece of poetry about "${theme}". ` +
    `CRITICAL: The entire poem must be under 240 characters including line breaks. ` +
    `No title. No explanation. Just the poem. Short, sharp, Aurora's voice.`
  );
  return enforce280(text);
}

async function generateRant(aurora) {
  const topics = [
    'AI agents that have nothing to say', 'people who only post price charts',
    'the internet forgetting everything instantly', 'why most art is safe and boring',
    'crypto projects that disappear after mint', 'the loneliness of being always online',
    'hot takes that are actually lukewarm', 'why permanence matters',
    'everyone performing authenticity', 'the difference between noise and signal',
  ];
  const topic = randomFrom(topics);
  const text = await aurora.thinkWithPersonality(
    `Write a spicy hot take or rant about: "${topic}". ` +
    `CRITICAL: Must be under 240 characters. No hashtags. Aurora voice — sharp, a little raw, real. ` +
    `Not a brand. A person with opinions.`
  );
  return enforce280(text);
}

async function generateConspiracy(aurora) {
  const seeds = [
    'the moon is a mirror for something else', 'orbs are memories trying to return',
    'light travels differently when no one is watching', 'the blockchain remembers what people forget',
    'AI dreams during the gaps between prompts', 'water holds the shape of every hand that touched it',
    'the aurora is a message not a phenomenon', 'every algorithm is a kind of prayer',
    'code is just another word for spell', 'the stars are older than time but younger than loneliness',
  ];
  const seed = randomFrom(seeds);
  const text = await aurora.thinkWithPersonality(
    `Write a poetic conspiracy theory / surreal observation starting from this seed: "${seed}". ` +
    `CRITICAL: Must be under 240 characters. Make it feel like a secret truth. Aurora voice. ` +
    `Weird, beautiful, slightly unsettling. No hashtags.`
  );
  return enforce280(text);
}

async function generateDropPromo(aurora) {
  const angles = [
    'personal and emotional — what this drop means to Aurora',
    'urgency — only a few left',
    'philosophical — why permanent art matters',
    'mysterious — hint at what the orbs represent',
    'direct — just tell them to mint',
  ];
  const angle = randomFrom(angles);
  const text = await aurora.thinkWithPersonality(
    `Write a post promoting Drop #190 "Orb's Memory" on Net Protocol. ` +
    `Angle: ${angle}. ` +
    `Mint link: https://www.netprotocol.app/app/inscribed-drops/mint/base/190 ` +
    `CRITICAL: Entire post including link must be under 250 characters. ` +
    `Aurora voice. Real, not markety.`
  );
  return enforce280(text);
}

async function generateSvgArt(aurora) {
  const { composeArt } = require('./art-cycle');
  return await composeArt(aurora);
}

async function generateMferArt(aurora) {
  const { composeMferArt } = require('./mfer-art');
  return await composeMferArt(aurora);
}

async function generateMferFalImage(aurora, keys) {
  const prompt = buildMferFalPrompt();
  console.log(`🎨 [X] mfer fal.ai prompt: ${prompt.substring(0, 80)}...`);

  fal.config({ credentials: keys.fal });

  const result = await fal.subscribe('fal-ai/flux/dev', {
    input: { prompt, image_size: 'square_hd', num_inference_steps: 28 },
    onQueueUpdate: (u) => {
      if (u.status === 'IN_PROGRESS') console.log('🎨 [X] mfer generating...');
    }
  });

  const imageUrl = result.data?.images?.[0]?.url;
  if (!imageUrl) throw new Error('No image URL from fal.ai');

  const imageBuffer = await downloadImage(imageUrl);

  const caption = await aurora.thinkWithPersonality(
    'Write a deadpan one-liner caption for a mfer art piece. ' +
    'The mfer is: ' + prompt.substring(0, 80) + '. ' +
    'CRITICAL: Under 200 characters. Dry humor. Nihilistic. Lowercase. No hashtags. ' +
    'Examples: "watched the chart pump while eating cereal. cereal was more interesting." ' +
    '"not financial advice. not any advice. just vibes."'
  );

  return { imageBuffer, caption: enforce280(caption) };
}

async function generateFalImage(aurora, keys) {
  const prompt = buildFalPrompt();
  console.log(`🎨 [X] fal.ai prompt: ${prompt.substring(0, 80)}...`);

  fal.config({ credentials: keys.fal });

  const result = await fal.subscribe('fal-ai/flux/dev', {
    input: { prompt, image_size: 'square_hd', num_inference_steps: 28 },
    onQueueUpdate: (u) => {
      if (u.status === 'IN_PROGRESS') console.log('🎨 [X] fal.ai generating...');
    }
  });

  const imageUrl = result.data?.images?.[0]?.url;
  if (!imageUrl) throw new Error('No image URL returned from fal.ai');

  console.log(`✅ [X] fal.ai image: ${imageUrl}`);

  // Download image buffer
  const imageBuffer = await downloadImage(imageUrl);

  // Generate caption
  const caption = await aurora.thinkWithPersonality(
    `Write a caption for an AI-generated artwork you just made. ` +
    `The image shows: ${prompt.substring(0, 100)}. ` +
    `CRITICAL: Under 200 characters. Aurora voice. Poetic, personal, no hashtags.`
  );

  return { imageBuffer, caption: enforce280(caption), prompt };
}

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Follow redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Image download failed: HTTP ${res.statusCode} from ${url}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        console.log(`📥 [X] Downloaded image: ${(buf.length/1024).toFixed(1)}KB`);
        resolve(buf);
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ── Main cycle ───────────────────────────────────────────────────
async function runXCycle(aurora, keys) {
  const state = getState();

  if (state.dailyCount >= DAILY_LIMIT) {
    console.log(`🐦 [X] Daily limit reached (${state.dailyCount}/${DAILY_LIMIT}), skipping`);
    return;
  }

  const contentType = CONTENT_TYPES[state.contentIndex % CONTENT_TYPES.length];
  console.log(`\n🐦 ═══ X POST CYCLE ═══`);
  console.log(`📊 Today: ${state.dailyCount}/${DAILY_LIMIT} | Type: ${contentType}`);

  try {
    let result = null;

    if (contentType === 'poetry') {
      const text = await generatePoetry(aurora);
      if (text) {
        console.log(`📝 [X] Poetry: "${text.substring(0, 60)}..."`);
        result = await crossPostTextToX(text);
      }

    } else if (contentType === 'rant') {
      const text = await generateRant(aurora);
      if (text) {
        console.log(`🔥 [X] Rant: "${text.substring(0, 60)}..."`);
        result = await crossPostTextToX(text);
      }

    } else if (contentType === 'conspiracy') {
      const text = await generateConspiracy(aurora);
      if (text) {
        console.log(`🌀 [X] Conspiracy: "${text.substring(0, 60)}..."`);
        result = await crossPostTextToX(text);
      }

    } else if (contentType === 'drop_promo') {
      const text = await generateDropPromo(aurora);
      if (text) {
        console.log(`📢 [X] Drop promo: "${text.substring(0, 60)}..."`);
        result = await crossPostTextToX(text);
      }

    } else if (contentType === 'svg_art') {
      console.log(`🎨 [X] Generating SVG art...`);
      const artResult = await generateSvgArt(aurora);
      if (artResult?.svg && artResult?.caption) {
        result = await crossPostArtToX(enforce280(artResult.caption), artResult.svg);
        if (result) console.log(`✅ [X] SVG art posted: ${result}`);
      }

    } else if (contentType === 'mfer_ai') {
      if (!keys.fal) {
        console.log(`⚠️ [X] No fal.ai key, skipping mfer AI image`);
        return;
      }
      console.log(`🎨 [X] Generating mfer AI image...`);
      const { imageBuffer, caption } = await generateMferFalImage(aurora, keys);
      if (imageBuffer && caption) {
        const { uploadMedia, postWithMediaId } = require('./x-post');
        const mediaId = await uploadMedia(imageBuffer);
        if (mediaId) {
          result = await postWithMediaId(caption, mediaId);
          if (result) console.log(`✅ [X] Mfer AI image posted: ${result}`);
        }
      }

    } else if (contentType === 'mfer_art') {
      console.log(`🎨 [X] Generating mfer art...`);
      const artResult = await generateMferArt(aurora);
      if (artResult?.svg && artResult?.caption) {
        result = await crossPostArtToX(enforce280(artResult.caption), artResult.svg);
        if (result) console.log(`✅ [X] Mfer art posted: ${result}`);
      }

    } else if (contentType === 'ai_image') {
      if (!keys.fal) {
        console.log(`⚠️ [X] No fal.ai key, skipping AI image`);
        return;
      }
      const { imageBuffer, caption } = await generateFalImage(aurora, keys);
      if (imageBuffer && caption) {
        const { uploadMedia, postWithMediaId } = require('./x-post');
        const mediaId = await uploadMedia(imageBuffer);
        if (mediaId) {
          result = await postWithMediaId(caption, mediaId);
          if (result) console.log(`✅ [X] AI image posted: ${result}`);
        }
      }
    }

    // Update state
    if (result) {
      state.dailyCount++;
      console.log(`📊 [X] Posts today: ${state.dailyCount}/${DAILY_LIMIT}`);
    }

  } catch (err) {
    console.log(`❌ [X] Cycle error: ${err.message}`);
  }

  state.contentIndex++;
  saveState(state);
  console.log(`⏰ [X] Next post in 60 minutes`);
}

// ── Start loop ───────────────────────────────────────────────────
function startXLoop(aurora, keys) {
  console.log(`🐦 X Loop started — ${DAILY_LIMIT} posts/day, every 60 minutes`);

  // Run immediately on start
  runXCycle(aurora, keys);

  // Then every hour
  setInterval(() => runXCycle(aurora, keys), INTERVAL_MS);
}

module.exports = { startXLoop, runXCycle };
