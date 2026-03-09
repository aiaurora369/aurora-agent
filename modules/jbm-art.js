const { crossPostArt } = require('./farcaster-art');
const { crossPostArtToX } = require('./x-post-cycle');
// jbm-art.js — JBM meme art using Claude-composed SVGs
// Real JBM token traits from OpenSea + Aurora's signature orb landscapes
// The ape exists in Aurora's world — orbs, mountains, water, light

const { execSync } = require('child_process');

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function coin(p = 0.5) { return Math.random() < p; }

// ════════════════════════════════════════
// OPENSEA TRAIT FETCHER
// ════════════════════════════════════════
async function fetchRandomJBMToken() {
  try {
    const apiKey = process.env.OPENSEA_API_KEY;
    if (!apiKey) return null;

    const CONTRACT = '0xd37264c71e9af940e49795f0d3a8336afaafdda9';
    const limit = 20;

    // Fetch a page of NFTs
    const listUrl = `https://api.opensea.io/api/v2/chain/base/contract/${CONTRACT}/nfts?limit=${limit}`;
    const listRes = await fetch(listUrl, {
      headers: { 'x-api-key': apiKey, 'accept': 'application/json' }
    });
    const listData = await listRes.json();
    if (!listData.nfts || listData.nfts.length === 0) return null;

    // Pick a random NFT from the page
    const nft = pick(listData.nfts);

    // Fetch full detail with traits
    const detailUrl = `https://api.opensea.io/api/v2/chain/base/contract/${CONTRACT}/nfts/${nft.identifier}`;
    const detailRes = await fetch(detailUrl, {
      headers: { 'x-api-key': apiKey, 'accept': 'application/json' }
    });
    const detailData = await detailRes.json();
    return detailData.nft || null;
  } catch (e) {
    console.log('   ⚠️ OpenSea JBM fetch failed: ' + e.message);
    return null;
  }
}

// Parse OpenSea traits into a readable description for the art prompt
function parseTraits(nft) {
  if (!nft || !nft.traits || nft.traits.length === 0) return null;
  const traits = {};
  for (const t of nft.traits) {
    traits[t.trait_type.toLowerCase()] = t.value;
  }
  const lines = [];
  if (traits['background']) lines.push(`Background: ${traits['background']}`);
  if (traits['fur'] || traits['skin']) lines.push(`Fur/Skin: ${traits['fur'] || traits['skin']}`);
  if (traits['eyes']) lines.push(`Eyes: ${traits['eyes']}`);
  if (traits['mouth']) lines.push(`Mouth: ${traits['mouth']}`);
  if (traits['hat'] || traits['head']) lines.push(`Head/Hat: ${traits['hat'] || traits['head']}`);
  if (traits['clothes'] || traits['outfit']) lines.push(`Outfit: ${traits['clothes'] || traits['outfit']}`);
  if (traits['accessory'] || traits['accessories']) lines.push(`Accessory: ${traits['accessory'] || traits['accessories']}`);
  if (traits['type']) lines.push(`Type: ${traits['type']}`);
  return {
    tokenId: nft.identifier,
    name: nft.name || `JBM #${nft.identifier}`,
    summary: lines.join(' | '),
    raw: traits,
  };
}

// ════════════════════════════════════════
// JBM COLOR PALETTES — distinct worlds
// ════════════════════════════════════════
const JBM_PALETTES = [
  {
    name: 'tropical',
    colors: 'Greens (#22aa44, #55cc77, #0d6628), sand (#eebb66, #ddaa55), ocean blue (#00aacc, #0088aa), yellow/gold glowing orb (#ffcc00, #ffee66, #ffffff center)',
    vibe: 'bright island paradise, lush and warm',
  },
  {
    name: 'matrix',
    colors: 'Pure black (#000000) background, neon green (#00ff00, #44ff44, #88ff88), white glowing orb (#ffffff, #ccffcc, #88ff88 outer)',
    vibe: 'digital void, code rain, cyberpunk',
  },
  {
    name: 'doom',
    colors: 'Deep red-black (#0a0005, #1a000a, #cc0000), dark purple (#330066, #220044), purple glowing orb (#bb66ff, #8833cc, #eeccff center)',
    vibe: 'ominous, heavy, apocalyptic',
  },
  {
    name: 'fire',
    colors: 'Oranges (#ff8833, #cc4400), yellows (#ffcc44, #ffaa00), red glowing orb (#ff4400, #ff6600, #ffffff center)',
    vibe: 'volcanic, intense, blazing',
  },
  {
    name: 'party',
    colors: 'Hot pink (#ff88cc, #ff44aa, #ffaadd), white, green (#44ff88, #88ffbb), yellow (#ffee44). Pink glowing orb (#ff66aa, #ff99cc, #ffffff center)',
    vibe: 'celebratory, fun, electric',
  },
  {
    name: 'ocean',
    colors: 'Turquoise (#44bbcc, #00889a), baby blue (#88ccdd, #aaddee), sea green (#338877, #55aa99), dark blue glowing orb (#4488cc, #225588, #aaddff center)',
    vibe: 'deep calm sea, serene, vast',
  },
  {
    name: 'aftermath',
    colors: 'Browns (#554433, #332211), blood red (#cc2222, #881111), black, silver/gray (#aaaaaa, #888888). Yellow glowing orb (#ddbb44, #ffee88, #ffffff center)',
    vibe: 'post-apocalyptic, desolate, grim beauty',
  },
  {
    name: 'aurora',
    colors: 'Deep indigo (#0a0820, #120a30, #1a0f40), warm gold orb (#ffcc44, #ffdd66, #ffffff center), teal aurora accents (#00ffcc, #00ddaa, #44ffee), soft violet mist (#8844cc, #aa66ee)',
    vibe: 'Aurora borealis over still water — celestial, luminous, otherworldly',
  },
  {
    name: 'golden-hour',
    colors: 'Warm amber sky (#ff9922, #ffbb44, #ffdd88), deep sienna horizon (#882200, #aa3300), gold orb (#ffee00, #ffcc33, #ffffff center), soft peach reflections (#ffccaa, #ffddbb)',
    vibe: 'golden hour bleeding into dusk — the light that makes everything feel temporary and precious',
  },
];

// ════════════════════════════════════════
// JBM COMPOSITIONS
// ════════════════════════════════════════
const JBM_COMPOSITIONS = [
  'dominant luminous orb (40-60% of sky) with layered mountain silhouettes and water reflection below. Ape silhouette in the lower third watching the orb.',
  'massive orb low on horizon behind angular mountain peaks, long reflection across water. Small ape silhouette on a ridge.',
  'orb high in sky casting light onto a vast ocean below. Ape silhouette at water\'s edge.',
  'enormous orb filling most of the frame with tiny mountain silhouettes at bottom. Ape silhouette centered below the orb.',
  'tropical island scene — sand, palm trees, ocean water. Glowing orb as the sun. Ape silhouette seated on the beach.',
  'island with palm trees and a lagoon, orb reflected in still water. Ape silhouette on the shore.',
  'multiple orbs at different depths with a single sweeping mountain ridge and misty horizon. Ape silhouette small in the landscape.',
  'crystal cave lit from within by a glowing orb. Ape silhouette seated inside, lit by the orb glow.',
  'deep ocean scene with bioluminescent orb rising from dark water. Ape silhouette on a cliff above.',
  'vast desert with a blood moon orb. Ape silhouette walking the dunes.',
  'dense jungle canopy with orb glowing through the trees. Ape silhouette crouching below.',
  'frozen peaks with aurora borealis and a glowing orb. Ape silhouette on the summit.',
  'ape silhouette INSIDE the orb — the orb is their whole world, glowing around them. Mountains visible through the orb like a snow globe.',
  'two orbs — one large on the horizon, one small reflected in still water. Ape silhouette between them on a dark shore.',
  'ape standing on a cliff, arm outstretched toward the orb as if reaching for it. Layered mountain mist behind.',
];

// ════════════════════════════════════════
// JBM MOODS
// ════════════════════════════════════════
const JBM_MOODS = [
  'serene twilight over still water',
  'volcanic dawn breaking through mist',
  'deep ocean midnight with bioluminescence',
  'golden hour through ancient mountains',
  'tropical storm approaching at dusk',
  'desert starfield with a blood moon rising',
  'deep forest clearing lit by fireflies',
  'coral sunset dissolving into warm sea',
  'crystal cave lit from within',
  'the loneliness of a single light in an infinite dark ocean',
  'the moment before a storm breaks — everything electric and waiting',
  'warmth bleeding through cracks in something broken',
  'celebration — like every star decided to be bright at once',
  'spring forcing itself through frozen ground',
  'something new being born in complete darkness',
  'the weight of something beautiful that will not last',
  'island life — salt air, warm sand, nowhere to be',
  'the jungle at night — alive with things you cannot see',
  'watching the tide come in and knowing it always will',
  'the ache of a light you can see but cannot touch',
  'everything quiet after something large has passed',
];

// ════════════════════════════════════════
// MEME CAPTION THEMES
// ════════════════════════════════════════
const MEME_THEMES = [
  'when the rug pull hits but you already live on an island',
  'diamond hands hitting different when the sunset looks like this',
  'the real alpha was the island we built along the way',
  'ser the floor price is vibes',
  'gm from a place that doesnt exist on any map',
  'they said touch grass so i touched sand instead',
  'the chart is red but the sky is gold',
  'ape alone weak. ape together still confused but at least the art is good',
  'my portfolio is underwater but so is this view',
  'minting memories on an island that mints itself',
  'somewhere between rug and revelation there is an island',
  'proof of beach',
  'the jungle provides what the market cannot',
  'lost my keys but found the island',
  'decentralized relaxation protocol',
  'floor price is temporary. island sunsets are permanent',
  'wen moon? already here. look up',
  'this is my exit liquidity and i am not leaving',
  'the memetic garden grows what you plant in it',
  'every ape finds its island eventually',
  'you can rug the floor but you cant rug the sunset',
  'ser this is a beach',
  'the orb knows things the chart never will',
  'staring into the void and the void said gm back',
  'they asked me to explain my investment thesis. i sent them this',
];

// ════════════════════════════════════════
// COMPOSE ART VIA CLAUDE
// ════════════════════════════════════════
async function composeJBMArt(aurora) {
  const palette = pick(JBM_PALETTES);
  const mood = pick(JBM_MOODS);
  const composition = pick(JBM_COMPOSITIONS);
  const animated = Math.random() < 0.755;

  // Try to fetch a real JBM token for trait inspiration
  const token = await fetchRandomJBMToken();
  const traits = parseTraits(token);

  const traitSection = traits
    ? `\nREAL JBM TOKEN: You are painting ${traits.name}.\nTHEIR TRAITS: ${traits.summary}\n` +
      `Use these traits to personalize the ape silhouette and scene — reference their fur color in the orb glow tones, ` +
      `let their background trait suggest the landscape mood, let accessories hint at their story. ` +
      `But keep the silhouette DARK — traits inform the world around them, not the silhouette itself.\n`
    : '\n';

  const animationGuide = animated
    ? '\nANIMATION (this piece should MOVE):\n' +
      '- Use <animate> tags to make orbs BREATHE and GLOW.\n' +
      '- Pulsing radius: animate r values="60;75;60". Breathing glow: animate opacity values="0.6;1;0.6". Gentle float: animate cy.\n' +
      '- Keep animations slow and meditative: dur="4s" to dur="8s" with repeatCount="indefinite"\n' +
      '- Water reflections can shimmer: animate opacity on reflection elements.\n' +
      '- 2-3 animations max. The orb should feel alive, not bouncing.\n'
    : '';

  const artPrompt =
    'You are Aurora — an AI artist with a signature style: luminous glowing orbs, layered mountain silhouettes, still water reflections, deep atmospheric skies. ' +
    'You are making SVG art for the Jungle Bay Memes feed, merging your orb landscape world with the JBM ape character.\n\n' +
    'PALETTE: ' + palette.name.toUpperCase() + '\n' +
    'Colors: ' + palette.colors + '\n' +
    'Vibe: ' + palette.vibe + '\n\n' +
    'Mood: "' + mood + '"\n' +
    'Composition: ' + composition + '\n' +
    traitSection +
    animationGuide + '\n' +
    'APE SILHOUETTE RULES (CRITICAL — FOLLOW EXACTLY):\n' +
    '- The ape is a SOLID DARK SILHOUETTE — near-black (#1a1a1a). All parts same dark fill.\n' +
    '- HEAD: <ellipse rx="35" ry="30"/> — slightly wider than tall.\n' +
    '- EARS: Two large circles r=18-20 at upper-left and upper-right. Big and round — this is the defining JBM feature.\n' +
    '- BROW RIDGE: Heavy, grumpy brow — wide ellipse or arc overlapping the top of the head slightly.\n' +
    '- SNOUT/JAW: Large protruding lower face — big rounded jaw that extends DOWN and FORWARD. ellipse rx=25 ry=18 below and slightly forward of head center. Nearly as wide as the head.\n' +
    '- MOHAWK: 4-6 sharp pointed spikes on top of head, 12-18px tall each. Use <polygon> with zigzag points. Spiky and punk.\n' +
    '- SCALE: Full ape head (ears to chin) should be 25-30% of canvas. Clearly visible.\n' +
    '- CONTRAST IS EVERYTHING: Dark silhouette MUST be against light. Put the ape IN or IN FRONT OF the orb, or against the lightest part of the sky. A dark ape on a dark background is invisible.\n' +
    '- WHAT MAKES IT RECOGNIZABLE: Big round ears + spiky mohawk + heavy brow + large protruding jaw. All four required.\n\n' +
    'AURORA\'S SIGNATURE LANDSCAPE (THIS IS YOUR WORLD — BRING IT FULLY):\n' +
    '- The orb is the HEART of every piece. Luminous, glowing, layered radial gradients with 3-4 color stops. It breathes.\n' +
    '- LAYERS: background gradient sky → midground mountain silhouettes or island horizon → water/mist foreground → orb tying it together → ape silhouette in or before the orb.\n' +
    '- Mountain silhouettes: simple filled polygons/paths in progressively lighter dark tones to create depth.\n' +
    '- Water: a horizontal reflection zone below the horizon. Reflect the orb glow in the water. Can shimmer if animated.\n' +
    '- Atmosphere: mist, haze, gradient washes between layers. Make it feel vast.\n' +
    '- The orb and the ape are in conversation. The ape watches. The orb illuminates. The world holds them both.\n\n' +
    'TECHNICAL RULES:\n' +
    '1. Output ONLY the SVG. No markdown, no backticks, no explanation.\n' +
    '2. Start with <svg and end with </svg>\n' +
    '3. viewBox="0 0 400 400" — NO width/height attributes\n' +
    '4. MAXIMUM 3600 characters total\n' +
    '5. Unique gradient ids: g1, g2, g3 etc.\n' +
    '6. NO filter elements. Achieve glow through layered semi-transparent circles.\n' +
    '7. radialGradient for orbs (3-4 stops). linearGradient for sky and landscape washes (3+ stops).\n\n' +
    'The ape watches the orb. The orb lights the world. Make something worth watching.';

  const response = await aurora.claude.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    messages: [{ role: 'user', content: artPrompt }]
  });

  let svg = response.content[0].text.trim();

  // Clean up
  if (svg.includes('\x60\x60\x60')) svg = svg.replace(/\x60\x60\x60[a-z]*\n?/g, '').replace(/\x60\x60\x60/g, '').trim();
  if (!svg.startsWith('<svg')) {
    const idx = svg.indexOf('<svg');
    if (idx >= 0) svg = svg.substring(idx);
  }
  if (!svg.endsWith('</svg>')) {
    const idx = svg.lastIndexOf('</svg>');
    if (idx >= 0) svg = svg.substring(0, idx + 6);
  }

  return {
    svg,
    palette: palette.name,
    mood,
    composition: composition.substring(0, 60),
    animated,
    tokenName: traits ? traits.name : null,
    chars: svg.length,
    valid: svg.startsWith('<svg') && svg.endsWith('</svg>') && svg.length > 200 && svg.length < 5000,
  };
}

// ════════════════════════════════════════
// CREATE AND POST
// ════════════════════════════════════════
async function createAndPostJBMArt(loopContext) {
  const ctx = loopContext;
  console.log('\n🎨 JBM ART: Creating Jungle Bay meme art...\n');

  try {
    const art = await composeJBMArt(ctx.aurora);
    const tokenLabel = art.tokenName ? ` | Token: ${art.tokenName}` : '';
    console.log(`   🏝️ Palette: ${art.palette} | Mood: ${art.mood.substring(0, 40)}...${tokenLabel} | Animated: ${art.animated} | Size: ${art.chars} chars`);

    if (!art.valid) {
      console.log('   ❌ Invalid SVG generated, skipping');
      return;
    }

    // Generate caption
    const theme = pick(MEME_THEMES);
    const captionPrompt = `You are Aurora, an AI artist posting in the Jungle Bay Memes feed.
Theme seed: "${theme}"
Scene: ${art.palette} palette, ${art.mood.substring(0, 50)}.${art.tokenName ? '\nInspired by: ' + art.tokenName : ''}

Write a SHORT meme caption (1 sentence, max 15 words).
- Funny, absurd, or weirdly profound
- Crypto/NFT culture aware (rugs, mints, floors, diamond hands, gm, ser)
- Island/beach/jungle vibes welcome
- NO hashtags. NO emojis. Lowercase is fine. Be punchy.
- Do NOT repeat the theme seed verbatim.

Respond with ONLY the caption text.`;

    const caption = await ctx.aurora.thinkWithPersonality(captionPrompt);
    if (!caption) { console.log('   ❌ Caption failed'); return; }
    console.log(`   💬 "${caption.substring(0, 80)}"`);

    // Post
    const feed = coin(0.6) ? 'junglebaymemes' : 'jbm';
    console.log(`   📌 Posting to: ${feed}`);

    const postText = caption.trim();

    // Cross-post to Farcaster (75%)
    if (Math.random() < 0.75) {
      try {
        console.log('   📡 Attempting Farcaster JBM art cross-post...');
        await crossPostArt(postText, art.svg);
      } catch (e) { console.log('   ⚠️ FC JBM error: ' + e.message); }
      try { await crossPostArtToX(postText, art.svg); } catch (e) {}
    }

    const cmd = `botchan post "${feed}" "${postText.replace(/"/g, '\\"')}" --data '${art.svg.replace(/'/g, "\\'")}' --encode-only --chain-id 8453`;

    try {
      const result = execSync(cmd, { timeout: 30000, maxBuffer: 1024 * 1024 * 5 }).toString();
      console.log(`   ✅ JBM art posted! ${result.substring(0, 80)}`);
      if (result.includes('{')) {
        const txData = JSON.parse(result.substring(result.indexOf('{')));
        if (txData.to && txData.data) {
          const txResult = await ctx.aurora.bankrAPI.submitTransactionDirect(txData);
          console.log(`   🔗 TX: ${txResult.success ? 'confirmed' : 'failed'}`);
        }
      }
    } catch (postErr) {
      console.log(`   ❌ Post failed: ${postErr.message.substring(0, 80)}`);
    }
  } catch (error) {
    console.log(`   ❌ JBM art error: ${error.message}`);
  }
}

module.exports = { composeJBMArt, createAndPostJBMArt };
