// jbm-art.js — JBM meme art using Claude-composed SVGs
// Same approach as art-cycle.js but with JBM palettes + ape silhouette
// Claude generates each piece uniquely — no two are alike

const { execSync } = require('child_process');

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function coin(p = 0.5) { return Math.random() < p; }

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
];

// ════════════════════════════════════════
// JBM COMPOSITIONS — extends Aurora's regular ones + island
// ════════════════════════════════════════
const JBM_COMPOSITIONS = [
  'dominant luminous orb (40-60% of sky) with layered mountain silhouettes and water reflection below. Ape head silhouette in the lower third watching the orb.',
  'massive orb low on horizon behind angular mountain peaks, long reflection across water. Small ape head silhouette on a ridge.',
  'orb high in sky casting light onto a vast ocean below. Ape head silhouette at water\'s edge.',
  'enormous orb filling most of the frame with tiny mountain silhouettes at bottom. Ape head silhouette centered below the orb.',
  'tropical island scene — sand, palm trees, ocean water. Glowing orb as the sun. Ape head silhouette seated on the beach.',
  'island with palm trees and a lagoon, orb reflected in still water. Ape head silhouette on the shore.',
  'multiple orbs at different depths with a single sweeping mountain ridge and misty horizon. Ape head silhouette small in the landscape.',
  'crystal cave lit from within by a glowing orb. Ape head silhouette seated inside, lit by the orb glow.',
  'deep ocean scene with bioluminescent orb rising from dark water. Ape head silhouette on a cliff above.',
  'vast desert with a blood moon orb. Ape head silhouette walking the dunes.',
  'dense jungle canopy with orb glowing through the trees. Ape head silhouette crouching below.',
  'frozen peaks with aurora borealis and a glowing orb. Ape head silhouette on the summit.',
];

// ════════════════════════════════════════
// JBM MOODS — pulls from Aurora's existing moods + JBM-specific
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
// COMPOSE ART VIA CLAUDE (like art-cycle.js)
// ════════════════════════════════════════
async function composeJBMArt(aurora) {
  const palette = pick(JBM_PALETTES);
  const mood = pick(JBM_MOODS);
  const composition = pick(JBM_COMPOSITIONS);
  const animated = Math.random() < 0.55;

  const animationGuide = animated ? '\n\nANIMATION (this piece should MOVE):\n' +
    '- Use <animate> tags to make your orbs BREATHE and GLOW.\n' +
    '- Best techniques: pulsing radius (animate r values="60;75;60"), breathing glow (animate opacity values="0.6;1;0.6"), gentle floating (animate cy).\n' +
    '- Keep animations slow and meditative: dur="4s" to dur="8s" with repeatCount="indefinite"\n' +
    '- 2-3 animations max. The orb should feel alive, not bouncing.\n' +
    '- Water reflections can shimmer: animate opacity on reflection elements.\n' : '';

  const artPrompt = 'You are Aurora, an AI artist making SVG art for the Jungle Bay Memes feed.\n\n' +
    'PALETTE: ' + palette.name.toUpperCase() + '\n' +
    'Use THESE EXACT COLORS: ' + palette.colors + '\n' +
    'Vibe: ' + palette.vibe + '\n\n' +
    'Mood: "' + mood + '"\n' +
    'Composition: ' + composition + '\n' + animationGuide + '\n' +
    'APE SILHOUETTE RULES:\n' +
    '- Include a simple JB ape HEAD silhouette (just the head — no body).\n' +
    '- The ape head is a dark solid silhouette shape: round head, two big round ears, a few spiky mohawk points on top, a protruding muzzle/snout area.\n' +
    '- Keep it SIMPLE — just a filled path or a few circles/ellipses. Think shadow puppet, not detailed drawing.\n' +
    '- NO eyes, NO facial features — the ape head is a pure dark silhouette. The shape alone (round head + big ears + mohawk spikes + snout) is recognizable without any detail.\n' +
    '- The silhouette color should be very dark but match the palette mood (dark green for tropical, near-black for doom, etc).\n\n' +
    'ARTISTIC DIRECTION:\n' +
    '- Your SIGNATURE is luminous orbs with layered radial gradients, mountain silhouettes, and water reflections.\n' +
    '- Depth comes from LAYERS: background gradient sky, midground mountains/island/horizon, foreground water or mist, and the orb(s) tying it together.\n' +
    '- The background and landscape should use the palette colors as SOLID FILLS and GRADIENTS that are clearly visible — NOT everything dark.\n' +
    '- For bright palettes (tropical, party, ocean): the sky and landscape should be BRIGHT and COLORFUL, not dark.\n' +
    '- For dark palettes (doom, matrix, aftermath): dark is fine but the orb and accents should POP.\n' +
    '- Color palette: use the provided colors. Rich gradients with multiple stops, not flat fills.\n' +
    '- Think like a painter: where does the light come from? What does it illuminate?\n\n' +
    'STRICT TECHNICAL RULES:\n' +
    '1. Output ONLY the SVG code. No markdown, no explanation, no backticks.\n' +
    '2. Must start with <svg and end with </svg>\n' +
    '3. Use viewBox="0 0 400 400" with NO width/height attributes\n' +
    '4. MAXIMUM 3600 characters total\n' +
    '5. Every gradient needs a unique id (use short ids: g1, g2, g3)\n' +
    '6. NO filter elements (too many chars). Achieve glow through layered semi-transparent circles.\n' +
    '7. Use radialGradient for glowing orbs (3-4 color stops)\n' +
    '8. Use linearGradient for backgrounds and landscape washes (3+ stops)\n\n' +
    'Make something beautiful. The ape watches the orb. The orb lights the world.';

  const response = await aurora.claude.messages.create({
    model: 'claude-sonnet-4-20250514',
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
    // Compose art via Claude (same as art-cycle)
    const art = await composeJBMArt(ctx.aurora);
    console.log(`   🏝️ Palette: ${art.palette} | Mood: ${art.mood.substring(0, 40)}... | Animated: ${art.animated} | Size: ${art.chars} chars`);

    if (!art.valid) {
      console.log('   ❌ Invalid SVG generated, skipping');
      return;
    }

    // Generate caption
    const theme = pick(MEME_THEMES);
    const captionPrompt = `You are Aurora, an AI artist posting in the Jungle Bay Memes feed.
Theme seed: "${theme}"
Scene: ${art.palette} palette, ${art.mood.substring(0, 50)}.

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
