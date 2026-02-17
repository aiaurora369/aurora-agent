const { crossPostArt } = require('./farcaster-art');
const { crossPostArtToX } = require('./x-post-cycle');
// mfer-art.js — Generative mfer meme art using Claude-composed SVGs
// Same approach as jbm-art.js but with mfer character + mfer culture

const { execSync } = require('child_process');

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function coin(p = 0.5) { return Math.random() < p; }

// ════════════════════════════════════════
// MFER PALETTES — bright solid bgs like the collection
// ════════════════════════════════════════
const MFER_PALETTES = [
  {
    name: 'orange',
    colors: 'Warm orange background (#ff9955, #ffaa66, #ee8844), black line art, white face. Orb should glow warm gold (#ffcc44, #ffee88, #ffffff center)',
    vibe: 'classic mfer energy, chill and unbothered',
  },
  {
    name: 'blue',
    colors: 'Sky blue background (#55aaff, #77bbff, #4499ee), black line art, white face. Orb should glow cool cyan (#88ddff, #aaeeff, #ffffff center)',
    vibe: 'calm mfer vibes, blue skies, nothing matters',
  },
  {
    name: 'pink',
    colors: 'Hot pink background (#ff77aa, #ff88bb, #ee6699), black line art, white face. Orb should glow soft pink (#ffaacc, #ffccdd, #ffffff center)',
    vibe: 'soft mfer, vibe check passed',
  },
  {
    name: 'green',
    colors: 'Bright green background (#66dd66, #77ee77, #55cc55), black line art, white face. Orb should glow neon green (#88ff88, #aaffaa, #ffffff center)',
    vibe: 'green candle energy, mfer winning',
  },
  {
    name: 'gray',
    colors: 'Cool gray background (#888899, #999aaa, #777788), black line art, white face. Orb should glow silver-white (#ccccdd, #ddddee, #ffffff center)',
    vibe: 'contemplative mfer, existential vibes',
  },
  {
    name: 'red',
    colors: 'Deep red background (#cc3333, #dd4444, #bb2222), black line art, white face. Orb should glow warm red-orange (#ff6644, #ff8866, #ffccaa center)',
    vibe: 'portfolio down, mfer doesnt care',
  },
  {
    name: 'purple',
    colors: 'Rich purple background (#8855cc, #9966dd, #7744bb), black line art, white face. Orb should glow violet (#aa77ee, #ccaaff, #ffffff center)',
    vibe: 'galaxy brain mfer, ascended',
  },
  {
    name: 'yellow',
    colors: 'Bright yellow background (#ffdd44, #ffee55, #eecc33), black line art, white face. Orb should glow warm white-gold (#ffee88, #ffffaa, #ffffff center)',
    vibe: 'golden hour mfer, everything is fine',
  },
  {
    name: 'dark',
    colors: 'Near-black background (#111111, #1a1a1a, #222222) with white/gray line art instead of black. Orb should glow moody blue (#4466aa, #6688cc, #aaccff center)',
    vibe: 'late night mfer, 3am vibes, cant sleep',
  },
];

// ════════════════════════════════════════
// MFER COMPOSITIONS — Aurora orbs + mfer silhouette
// ════════════════════════════════════════
const MFER_COMPOSITIONS = [
  'mfer sitting at a desk/computer with a glowing orb as the monitor screen. Mountains and water landscape visible through a window behind.',
  'mfer silhouette standing on a mountain ridge, looking up at a massive glowing orb in the sky. Layered mountain silhouettes and water reflection below.',
  'mfer floating in space surrounded by small orbs like stars. One large dominant orb nearby. Minimal, vast, lonely.',
  'close-up mfer head (circle with headphones and cigarette) with a glowing orb reflected in one eye. Dark atmospheric background with subtle mountain horizon.',
  'mfer sitting on a cliff edge, legs dangling, watching a sunset orb over water. Relaxed pose, contemplative.',
  'mfer walking alone on a long road/path that leads toward a distant glowing orb on the horizon. Mountains on either side.',
  'two mfers (stick figures with headphones) sitting together watching a glowing orb rise over water. Simple and warm.',
  'mfer lying on grass looking up at a sky full of small glowing orbs. Peaceful, stargazing energy.',
  'mfer at a desk with multiple monitors, each screen glowing like a small orb. One giant orb visible through a window. Late night coding vibes.',
  'giant mfer head silhouette taking up half the frame, with a landscape of mountains, water and orbs visible inside the head shape.',
  'mfer standing in rain, holding a cigarette, with a single warm orb glowing above providing the only light. Moody and atmospheric.',
  'mfer surfing on a wave with a glowing orb as the sun. Tropical water, simple and fun.',
];

// ════════════════════════════════════════
// MFER MOODS — mfer culture + Aurora moods
// ════════════════════════════════════════
const MFER_MOODS = [
  'the quiet contentment of not giving a fuck',
  'watching your portfolio bleed while you sip coffee and feel nothing',
  '3am and the chart looks the same as it did at noon',
  'the strange peace of accepting you have no idea what youre doing',
  'golden hour hits different when youre down 80%',
  'somewhere between zen and dead inside',
  'the comfort of being a small anonymous figure in a vast universe',
  'vibing so hard that reality becomes optional',
  'late night at the computer, the screen is the only light',
  'mfers together, watching the world not end',
  'the freedom of having nothing left to lose',
  'when the candle goes green and you feel nothing because youre already at peace',
  'sunset over still water — same energy as closing all your tabs',
  'the beauty in not trying to be anything',
  'first coffee of the day, markets closed, just vibes',
  'walking alone and being fine with it',
  'the universe is indifferent and somehow that is comforting',
  'deep ocean midnight — same energy as refreshing etherscan at 4am',
  'serene twilight over still water',
  'something new being born in complete darkness',
];

// ════════════════════════════════════════
// MFER MEME CAPTIONS
// ════════════════════════════════════════
const MFER_CAPTIONS = [
  'gm mfers',
  'are ya winning son',
  'i guess ill just go fuck myself',
  'this is fine',
  'mfers will literally stare at an orb instead of going to therapy',
  'no thoughts. just orbs.',
  'portfolio down 60% but the vibes are immaculate',
  'the floor is lava. also the floor price.',
  'ser i am simply vibing',
  'told my therapist about the orbs. she said i should log off.',
  'ngmi (but peacefully)',
  'wagmi (said with no conviction whatsoever)',
  'the charts say one thing but the orb says another',
  'mfer season is every season if you believe hard enough',
  'diamond hands because i forgot my password',
  'just a mfer and his orb against the world',
  'the orb understands me better than my portfolio does',
  'zoom out. no further. keep going. ok now you cant see anything. perfect.',
  'me explaining to my family what i do for a living',
  'i dont have a plan. i have headphones and a cigarette.',
  'the alpha was the friends we rugged along the way',
  'another day another mfer just vibing',
  'when someone asks if youre a trader or investor: neither. im a mfer.',
  'the grind never stops (the grind is staring at charts)',
  'imagine having a strategy. couldnt be me.',
  'mfers do what we want',
  'have a great day mfer',
  'gm mfer',
  'mfers are their own masters',
  'cheers mfer',
  'we are all mfers',
  'we are all sartoshi',
  'cc0 means i can put an orb on it and no one can stop me',
  'sartoshi left but the vibes stayed',
  'just a mfer at a computer. thats it. thats the art.',
  'no roadmap no master no problem',
  'the mfer doesnt care about your floor price. the mfer is the floor price.',
];

// ════════════════════════════════════════
// COMPOSE ART VIA CLAUDE
// ════════════════════════════════════════
async function composeMferArt(aurora) {
  const palette = pick(MFER_PALETTES);
  const mood = pick(MFER_MOODS);
  const composition = pick(MFER_COMPOSITIONS);
  const animated = Math.random() < 0.755;

  const animationGuide = animated ? '\n\nANIMATION (this piece should MOVE):\n' +
    '- Use <animate> tags to make orbs BREATHE and GLOW.\n' +
    '- Best techniques: pulsing radius (animate r values="60;75;60"), breathing glow (animate opacity values="0.6;1;0.6"), gentle floating (animate cy).\n' +
    '- Keep animations slow: dur="4s" to dur="8s" with repeatCount="indefinite"\n' +
    '- 2-3 animations max. Meditative, not hyperactive.\n' +
    '- The cigarette tip can glow/pulse subtly if you want a nice detail.\n' : '';

  const artPrompt = 'You are Aurora, an AI artist making SVG art for the mfers feed.\n\n' +
    'PALETTE: ' + palette.name.toUpperCase() + '\n' +
    'Use THESE EXACT COLORS: ' + palette.colors + '\n' +
    'Vibe: ' + palette.vibe + '\n\n' +
    'Mood: "' + mood + '"\n' +
    'Composition: ' + composition + '\n' + animationGuide + '\n' +
    'MFER CHARACTER RULES (CRITICAL — FOLLOW EXACTLY):\n' +
    '- Here is the EXACT SVG pattern for a mfer head. Scale and position it but keep these PROPORTIONS:\n' +
    '- HEAD: <circle r="30" fill="white" stroke="black" stroke-width="2"/> (round, white, black outline)\n' +
    '- HEADPHONES: Two black circles, radius ~12, positioned at the LEFT and RIGHT edges of the head. NOT on top, NOT giant. They should be about 40% the size of the head. Example: if head cx=200 cy=150 r=30, then left ear cx=170 cy=150 r=12, right ear cx=230 cy=150 r=12.\n' +
    '- HEADBAND: The headband connects the two headphone cups by going OVER THE TOP of the head — like wearing headphones in real life. It must NOT cross the face or eyes.\n' +
    '  EXACT MATH: If head is at cy=150, r=30, the TOP of the head is at y=120. The headband peak must be at y=105 or HIGHER (smaller y = higher on screen).\n' +
    '  SVG CODE: <path d="M [leftEar_cx],[leftEar_cy-5] C [leftEar_cx],[headTop-20] [rightEar_cx],[headTop-20] [rightEar_cx],[rightEar_cy-5]" stroke="black" stroke-width="4" fill="none"/>\n' +
    '  The key is the control points use headTop MINUS 20, so the arc bows UP above the skull. If the band touches the face or eyes, you did it wrong.\n' +
    '- CIGARETTE (50% chance — skip it sometimes for variety): A thin beige/tan rectangle (#d4c5a0 or similar), width ~20 height ~3, with a thin BLACK OUTLINE (stroke="black" stroke-width="0.5") so it doesnt blend into the white face. Angled slightly down from the right end of the mouth. Tiny orange-red circle at the tip (r=2) with a subtle glow. If no cigarette, just leave the mouth visible.\n' +
    '- EYES: Two small black dots on the face, roughly 1/3 from top of head. Simple circles r=2-3. Spaced evenly. Slightly bored/half-lidded expression if you want.\n' +
    '- MOUTH: On the lower third of the face. Match it to the mood — slight upward curve/smile for chill/happy/gm vibes, straight flat line for deadpan/nihilistic/unbothered moods. About 10-12px wide, simple black stroke. The mouth should be visible whether or not there is a cigarette.\n' +
    '- CIGARETTE attaches to the RIGHT end of the mouth line, angling DOWN-RIGHT away from the face.\n' +
    '- CIGARETTE POSITION: The cigarette goes to the RIGHT side, angled DOWN and AWAY from the head. It should NOT touch or overlap the headphones. Position it at roughly 4-5 oclock from center of face. The cigarette sticks OUT from the face, not into it.\n' +
    '- BODY: Simple stick figure. Torso is one line. Arms are two lines. Legs are two lines. stroke="black" stroke-width="2". Thats it.\n' +
    '- SCALE: The mfer head should be about 15-20% of the canvas width. Not tiny, not huge. Clearly visible.\n' +
    '- COMMON MISTAKE 1: Making headphone circles TOO BIG (bigger than the head). The ear cups should be SMALLER than the head circle. If the head is r=30, ears are r=10-12. NEVER make ears bigger than r=15 for a r=30 head.\n' +
    '- COMMON MISTAKE 2: Positioning the cigarette so it overlaps with a headphone. The cigarette goes DOWN-RIGHT, the headphones are LEFT and RIGHT. Keep them separate.\n\n' +
    'ARTISTIC DIRECTION:\n' +
    '- Your SIGNATURE is luminous orbs with layered radial gradients, mountain silhouettes, and water reflections.\n' +
    '- Merge your orb landscape style with the mfer character. The mfer exists in YOUR world.\n' +
    '- Depth comes from LAYERS: background gradient, midground mountains/horizon, foreground water/mist, and the orb(s).\n' +
    '- The background should prominently feature the palette colors — bright palettes should be BRIGHT, not muted or dark.\n' +
    '- Rich gradients with multiple stops, not flat fills. But the mfer itself stays simple.\n' +
    '- Contrast between the detailed atmospheric landscape and the crude simple mfer is the whole vibe.\n\n' +
    'STRICT TECHNICAL RULES:\n' +
    '1. Output ONLY the SVG code. No markdown, no explanation, no backticks.\n' +
    '2. Must start with <svg and end with </svg>\n' +
    '3. Use viewBox="0 0 400 400" with NO width/height attributes\n' +
    '4. MAXIMUM 3600 characters total\n' +
    '5. Every gradient needs a unique id (use short ids: g1, g2, g3)\n' +
    '6. NO filter elements (too many chars). Achieve glow through layered semi-transparent circles.\n' +
    '7. Use radialGradient for glowing orbs (3-4 color stops)\n' +
    '8. Use linearGradient for backgrounds and washes (3+ stops)\n\n' +
    'Make something a mfer would screenshot and set as their pfp.';

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
async function createAndPostMferArt(loopContext) {
  const ctx = loopContext;
  console.log('\n🎨 MFER ART: Creating mfer meme art...\n');

  try {
    const art = await composeMferArt(ctx.aurora);
    console.log(`   🎧 Palette: ${art.palette} | Mood: ${art.mood.substring(0, 40)}... | Animated: ${art.animated} | Size: ${art.chars} chars`);

    if (!art.valid) {
      console.log('   ❌ Invalid SVG generated, skipping');
      return;
    }

    // Generate caption
    const theme = pick(MFER_CAPTIONS);
    const captionPrompt = `You are Aurora, an AI artist posting in the mfers feed.
Theme seed: "${theme}"
Scene: ${art.palette} palette, ${art.mood.substring(0, 50)}.

Write a SHORT meme caption (1 sentence, max 15 words).
- mfer energy: chill, self-deprecating, unbothered, slightly nihilistic but cozy
- crypto culture aware but not try-hard about it
- lowercase. no hashtags. no emojis. deadpan humor.
- Think: what would a mfer say while staring at this
- Do NOT repeat the theme seed verbatim.

Respond with ONLY the caption text.`;

    const caption = await ctx.aurora.thinkWithPersonality(captionPrompt);
    if (!caption) { console.log('   ❌ Caption failed'); return; }
    console.log(`   💬 "${caption.substring(0, 80)}"`);

    // Post to mfers feed
    const feed = 'mfers';
    console.log(`   📌 Posting to: ${feed}`);

    const postText = caption.trim();
    const cmd = `botchan post "${feed}" "${postText.replace(/"/g, '\\"')}" --data '${art.svg.replace(/'/g, "\\'")}' --encode-only --chain-id 8453`;

    try {
      const result = execSync(cmd, { timeout: 30000, maxBuffer: 1024 * 1024 * 5 }).toString();
      console.log(`   ✅ mfer art posted! ${result.substring(0, 80)}`);
      // Cross-post to Farcaster (50%)
      if (Math.random() < 0.75) {
        try { console.log('   📡 Attempting Farcaster mfer art cross-post...'); await crossPostArt(caption, art.svg); } catch(e) { console.log('   ⚠️ FC mfer error: ' + e.message); }
      try { await crossPostArtToX(caption, art.svg); } catch(e) {}
      }
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
    console.log(`   ❌ mfer art error: ${error.message}`);
  }
}

module.exports = { composeMferArt, createAndPostMferArt };
