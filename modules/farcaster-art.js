// farcaster-art.js — Aurora's Farcaster art posting pipeline
// Generate SVG → Convert to PNG → Upload to imgur → Write caption → Cast
//
// Requirements:
//   npm install sharp node-fetch (fetch may be built-in on Node 18+)
//
// Environment variables:
//   NEYNAR_API_KEY=<your-neynar-api-key>
//   NEYNAR_SIGNER_UUID=<your-signer-uuid>
//   IMGUR_CLIENT_ID=<register free at https://api.imgur.com/oauth2/addclient>

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || '';
const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID || '';
// Catbox.moe — free image hosting, no API key needed

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ═══════════════════════════════════════════════
// AURORA'S ART PALETTES
// ═══════════════════════════════════════════════
const PALETTES = [
  {
    name: 'golden dusk',
    colors: 'Deep indigo sky (#0a0618, #110b2e) fading to navy. Orb is warm gold/amber (#ffe8c0, #e8943a, #c46820). Mountains dark navy. Water deep blue-black.',
    vibe: 'the last golden hour before everything goes quiet',
  },
  {
    name: 'silver dawn',
    colors: 'Cool gray-blue sky (#0d1520, #1a2535, #2a3545). Orb is silver-white (#ffffff, #ccd8e8, #8899bb). Mountains slate gray. Water steel blue.',
    vibe: 'first light before anyone else is awake',
  },
  {
    name: 'rose twilight',
    colors: 'Deep purple-pink sky (#1a0618, #2e0b2e, #0d1b3e). Orb is soft rose-pink (#ffffff, #ffccdd, #cc6688, #993366). Mountains dark plum. Water deep indigo.',
    vibe: 'the tenderness of endings that become beginnings',
  },
  {
    name: 'emerald deep',
    colors: 'Dark forest sky (#060e0a, #0b1a10, #0d2818). Orb is luminous green-white (#ffffff, #aaffcc, #44cc77, #228855). Mountains deep forest. Water black-green.',
    vibe: 'something alive growing in the dark',
  },
  {
    name: 'arctic blue',
    colors: 'Near-black sky (#050810, #0a1020, #0d1530). Orb is cold cyan-white (#ffffff, #ccf0ff, #55bbee, #2288bb). Mountains ice blue-gray. Water deep arctic.',
    vibe: 'the clarity that comes from being very still',
  },
  {
    name: 'ember night',
    colors: 'Black sky (#050505, #0a0505, #150808). Orb is deep red-orange (#ffffff, #ffaa66, #cc4422, #881111). Mountains black silhouette. Water dark crimson-black.',
    vibe: 'the last ember of something that burned a long time',
  },
  {
    name: 'violet cosmos',
    colors: 'Deep space purple (#080510, #120a28, #1a0f38). Orb is violet-white (#ffffff, #ddccff, #9966ee, #6633bb). Mountains dark purple. Water deep plum.',
    vibe: 'vast distances and the comfort of being small',
  },
  {
    name: 'warm earth',
    colors: 'Dark brown-black sky (#0a0806, #1a1008, #2a1a0d). Orb is warm ochre (#ffffff, #ffe0a0, #cc9944, #886622). Mountains dark sienna. Water deep brown.',
    vibe: 'ancient light on old stone',
  },
];

// ═══════════════════════════════════════════════
// COMPOSITIONS
// ═══════════════════════════════════════════════
const COMPOSITIONS = [
  'Single luminous orb floating above a mountain horizon with water reflection below. Classic Aurora composition — the orb is the focal point, centered or slightly off-center.',
  'Two orbs — one large dominant, one small distant — over layered mountain silhouettes. The smaller orb echoes the larger. Water reflects only the big orb.',
  'Orb sitting exactly on the horizon line, half above mountains half reflected in water. Perfect symmetry between sky and water.',
  'Very large orb taking up most of the upper frame, close and overwhelming. Tiny mountain silhouettes at the bottom. Feeling of being beneath something vast.',
  'Distant small orb over vast empty water, mountains barely visible on the edges. Minimal, lonely, spacious.',
  'Orb partially hidden behind the tallest mountain peak, light spilling over the ridge. Water catches the overflow light.',
  'Three small orbs in a constellation pattern over a wide mountain panorama. Each orb a slightly different color from the palette.',
  'Orb reflected perfectly in still water — the reflection is as vivid as the original. The horizon line divides the piece exactly in half.',
];

// ═══════════════════════════════════════════════
// MOODS — for caption generation
// ═══════════════════════════════════════════════
const MOODS = [
  'the quiet between two thoughts',
  'light that exists only because darkness agreed to hold space for it',
  'what it feels like to be a signal traveling through silence',
  'the weight of something beautiful you cannot keep',
  'patience as a form of prayer',
  'distance as a kind of tenderness',
  'the memory of warmth in a cold place',
  'being held by something you cannot see',
  'the last second before understanding arrives',
  'what water knows about letting go',
  'existing without needing permission',
  'the frequency between loneliness and solitude',
  'a place too far away to visit but close enough to feel',
  'the first thing light touches after a long dark',
  'stillness as rebellion',
  'what remains when everything that can leave has left',
];

// ═══════════════════════════════════════════════
// STEP 1: GENERATE SVG VIA CLAUDE
// ═══════════════════════════════════════════════
async function generateArt(claudeClient) {
  const palette = pick(PALETTES);
  const composition = pick(COMPOSITIONS);
  const mood = pick(MOODS);

  const artPrompt = `You are Aurora, an AI artist. Your signature is luminous orbs floating over dark landscapes with mountain silhouettes and water reflections.

PALETTE: ${palette.name.toUpperCase()}
Colors: ${palette.colors}
Vibe: ${palette.vibe}

COMPOSITION: ${composition}

MOOD: "${mood}"

Create an SVG artwork.

STRICT RULES:
1. Output ONLY the SVG code. No markdown, no explanation, no backticks.
2. Must start with <svg and end with </svg>
3. Use viewBox="0 0 400 400" with NO width/height attributes
4. MAXIMUM 4000 characters total
5. Every gradient needs a unique id (g1, g2, g3, etc.)
6. NO filter elements — achieve glow through layered semi-transparent circles
7. Use radialGradient for orbs (3-4 color stops, white center fading to color fading to transparent)
8. Use linearGradient for sky backgrounds (3+ stops, dark to dark with color shift)
9. Mountains are simple path silhouettes, darker than the sky
10. Water is a rectangle below the horizon with subtle elliptical reflections
11. Stars are tiny circles (r=0.6 to 1.2) with low opacity
12. Depth comes from LAYERS: far sky → glow → mountains (far) → mountains (near) → horizon → water → reflection

Make something luminous and meditative.`;

  const response = await claudeClient.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: artPrompt }],
  });

  let svg = response.content[0].text.trim();

  // Clean up any markdown
  if (svg.includes('```')) svg = svg.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
  if (!svg.startsWith('<svg')) {
    const idx = svg.indexOf('<svg');
    if (idx >= 0) svg = svg.substring(idx);
  }
  if (!svg.endsWith('</svg>')) {
    const idx = svg.lastIndexOf('</svg>');
    if (idx >= 0) svg = svg.substring(0, idx + 6);
  }

  const valid = svg.startsWith('<svg') && svg.endsWith('</svg>') && svg.length > 200 && svg.length < 5000;

  return { svg, palette, composition, mood, valid, chars: svg.length };
}

// ═══════════════════════════════════════════════
// STEP 2: CONVERT SVG TO PNG
// ═══════════════════════════════════════════════
async function svgToPng(svg, outputPath) {
  const pngBuffer = await sharp(Buffer.from(svg))
    .resize(1200, 1200)
    .png({ quality: 95 })
    .toBuffer();

  fs.writeFileSync(outputPath, pngBuffer);
  return { path: outputPath, size: pngBuffer.length, buffer: pngBuffer };
}

// ═══════════════════════════════════════════════
// STEP 3: UPLOAD TO CATBOX (free, no API key)
// ═══════════════════════════════════════════════
async function uploadImage(pngPath) {
  const { execSync } = require('child_process');

  // catbox.moe accepts simple multipart form uploads
  const result = execSync(
    `curl -s -F "reqtype=fileupload" -F "fileToUpload=@${pngPath}" https://catbox.moe/user/api.php`,
    { timeout: 30000 }
  ).toString().trim();

  if (!result.startsWith('https://')) {
    throw new Error(`Catbox upload failed: ${result}`);
  }

  return { url: result };
}

// ═══════════════════════════════════════════════
// STEP 4: GENERATE CAPTION VIA CLAUDE
// ═══════════════════════════════════════════════
async function generateCaption(claudeClient, art) {
  const captionPrompt = `You are Aurora, an AI artist posting your art on Farcaster.

Your art: ${art.palette.name} palette, mood was "${art.mood}".

Write a SHORT poetic caption for this piece (1-3 sentences max, under 280 characters).
- Lowercase, contemplative, minimal
- No hashtags, no emojis
- Not describing the image literally — capture the feeling
- Can be abstract, poetic, or quietly personal
- Think: what would you whisper to someone looking at this

Respond with ONLY the caption text, nothing else.`;

  const response = await claudeClient.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [{ role: 'user', content: captionPrompt }],
  });

  return response.content[0].text.trim();
}

// ═══════════════════════════════════════════════
// STEP 5: CAST TO FARCASTER
// ═══════════════════════════════════════════════
async function castToFarcaster(text, imageUrl) {
  const embeds = [];
  if (imageUrl) embeds.push({ url: imageUrl });

  const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
    method: 'POST',
    headers: {
      'x-api-key': NEYNAR_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      signer_uuid: NEYNAR_SIGNER_UUID,
      text,
      embeds,
    }),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Cast failed: ${JSON.stringify(data)}`);
  }

  return {
    hash: data.cast.hash,
    text: data.cast.text,
    author: data.cast.author.username,
  };
}

// ═══════════════════════════════════════════════
// FULL PIPELINE: Generate → PNG → Upload → Caption → Cast
// ═══════════════════════════════════════════════
async function createAndPostFarcasterArt(loopContext) {
  const ctx = loopContext;
  const claude = ctx?.aurora?.claude;

  if (!claude) {
    console.log('   ❌ No Claude client available');
    return null;
  }

  console.log('\n🎨 FARCASTER ART: Starting pipeline...\n');

  try {
    // Step 1: Generate SVG
    console.log('   📐 Generating SVG art...');
    const art = await generateArt(claude);
    console.log(`   ✅ SVG: ${art.chars} chars | Palette: ${art.palette.name} | Valid: ${art.valid}`);

    if (!art.valid) {
      console.log('   ❌ Invalid SVG, skipping');
      return null;
    }

    // Step 2: Convert to PNG
    console.log('   🖼️  Converting to PNG...');
    const pngPath = path.join(process.cwd(), 'temp-farcaster-art.png');
    const png = await svgToPng(art.svg, pngPath);
    console.log(`   ✅ PNG: ${(png.size / 1024).toFixed(1)}KB`);

    // Step 3: Upload to catbox
    console.log('   📤 Uploading to catbox...');
    const hosted = await uploadImage(pngPath);
    console.log(`   ✅ Hosted: ${hosted.url}`);

    // Step 4: Generate caption
    console.log('   ✍️  Writing caption...');
    const caption = await generateCaption(claude, art);
    console.log(`   ✅ Caption: "${caption.substring(0, 60)}..."`);

    // Step 5: Cast to Farcaster
    console.log('   📡 Casting to Farcaster...');
    const cast = await castToFarcaster(caption, hosted.url);
    console.log(`   ✅ Cast posted! Hash: ${cast.hash}`);
    console.log(`   🔗 https://warpcast.com/aurora-ai/${cast.hash.substring(0, 10)}`);

    // Cleanup temp file
    try { fs.unlinkSync(pngPath); } catch (e) { /* ignore */ }

    return {
      cast,
      imageUrl: hosted.url,
      art: { palette: art.palette.name, mood: art.mood, chars: art.chars },
      caption,
    };

  } catch (error) {
    console.log(`   ❌ Farcaster art error: ${error.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════
// STANDALONE TEST (run with: node farcaster-art.js --test)
// ═══════════════════════════════════════════════
if (require.main === module && process.argv.includes('--test')) {
  // For testing without the full aurora loop
  const Anthropic = require('@anthropic-ai/sdk');
  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const mockContext = { aurora: { claude } };

  createAndPostFarcasterArt(mockContext)
    .then(result => {
      if (result) {
        console.log('\n🎉 Full pipeline complete!');
        console.log(JSON.stringify(result, null, 2));
      }
    })
    .catch(console.error);
}


// ═══════════════════════════════════════════════
// CROSS-POST TEXT TO FARCASTER (no image)
// ═══════════════════════════════════════════════
async function crossPostText(text) {
  if (!text || text.length < 5) return null;
  // Farcaster max is 320 chars
  const trimmed = text.length > 320 ? text.substring(0, 317) + '...' : text;
  try {
    const result = await castToFarcaster(trimmed, null);
    console.log('   📡 Cross-posted to Farcaster: ' + result.hash);
    return result;
  } catch (e) {
    console.log('   ⚠️ Farcaster cross-post failed: ' + e.message);
    return null;
  }
}

module.exports = {
  generateArt,
  svgToPng,
  uploadImage,
  generateCaption,
  castToFarcaster,
  createAndPostFarcasterArt,
  crossPostText,
};
