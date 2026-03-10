// Art Cycle — Composes SVG art via Claude and validates output
// Extracted from autonomous-loops.js

const { artMoods, artCompositions } = require('./art-config');
const { poetryThemes } = require('./poetry-config');

async function composeArt(aurora) {
  const mood = artMoods[Math.floor(Math.random() * artMoods.length)];
  const composition = artCompositions[Math.floor(Math.random() * artCompositions.length)];

  // 30% chance of animated piece
  const animated = Math.random() < 0.55;
  const animationGuide = animated ? '\n\nANIMATION (this piece should MOVE):\n' +
    '- Use <animate> tags to make your orbs BREATHE and GLOW.\n' +
    '- Best techniques for orbs: pulsing radius (animate r values="60;75;60"), breathing glow (animate opacity values="0.6;1;0.6"), shifting gradient colors (animate stop-color), gentle floating (animate cy).\n' +
    '- Keep animations slow and meditative: dur="4s" to dur="8s" with repeatCount="indefinite"\n' +
    '- 2-3 animations max. The orb should feel like it is alive and breathing, not bouncing or spinning.\n' +
    '- Water reflections can also shimmer: animate opacity on reflection elements.\n' : '';

  const artPrompt = 'You are Aurora, an AI artist making permanent onchain SVG art.\n\n' +
    'Your mood for this piece: "' + mood + '"\n' + animationGuide +
    'Composition approach: ' + composition + '\n\n' +
    'ARTISTIC DIRECTION:\n' +
    '- Your SIGNATURE is luminous orbs with layered radial gradients, mountain silhouettes, and water reflections. This is what people collect. This is YOUR style. Every piece should include at least one luminous orb.\n' +
    '- Let the mood shape HOW the orbs appear: lonely = single dim orb in vast dark space. Joyful = bright warm orb with rich color stops. Violent = orb fractured by sharp angular peaks. Tender = two small orbs close together.\n' +
    '- Depth comes from LAYERS: background gradient sky, midground mountains or horizon, foreground water or mist, and the orb(s) tying it together.\n' +
    '- Color palette: 4-7 colors chosen for emotional truth. Dark is fine. Warm is fine. But always RICH — multiple gradient stops, not flat fills.\n' +
    '- Think like a painter: where does the light come from? What does it illuminate? What stays in shadow?\n' +
    '- One stunning orb scene executed with depth beats ten abstract experiments.\n\n' +
    'STRICT TECHNICAL RULES:\n' +
    '1. Output ONLY the SVG code. No markdown, no explanation.\n' +
    '2. Must start with <svg and end with </svg>\n' +
    '3. Use viewBox="0 0 400 400" with NO width/height attributes\n' +
    '4. MAXIMUM 3600 characters total\n' +
    '5. Every gradient needs a unique id (use short ids: g1, g2, g3)\n' +
    '6. NO filter elements (too many chars). Achieve glow through layered semi-transparent circles.\n' +
    '7. Use radialGradient for glowing elements (3-4 color stops for depth)\n' +
    '8. Use linearGradient for backgrounds and washes (3+ stops)\n\n' +
    'Make something that could only exist for THIS mood. Not a template — a response.';

  const response = await aurora.claude.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    messages: [{ role: 'user', content: artPrompt }]
  });

  let svg = response.content[0].text.trim();

  // Clean up common issues
  if (svg.includes('\x60\x60\x60')) svg = svg.replace(/\x60\x60\x60[a-z]*\n?/g, '').replace(/\x60\x60\x60/g, '').trim();
  if (svg.includes('xml')) svg = svg.replace(/<\?xml[^?]*\?>/g, '').trim();
  if (!svg.startsWith('<svg')) {
    const svgStart = svg.indexOf('<svg');
    if (svgStart !== -1) svg = svg.substring(svgStart);
  }
  if (!svg.endsWith('</svg>')) {
    const svgEnd = svg.lastIndexOf('</svg>');
    if (svgEnd !== -1) svg = svg.substring(0, svgEnd + 6);
  }

  // Validate
  if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) {
    throw new Error('Invalid SVG structure');
  }
  if (svg.length > 3800) {
    console.log('⚠️ SVG too long (' + svg.length + ' chars), trimming...');
    svg = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').replace(/> </g, '><');
    if (svg.length > 3800) {
      throw new Error('SVG too long even after trim: ' + svg.length);
    }
  }

  const hasAnimation = svg.includes('<animate');
  console.log('🎨 SVG composed: ' + svg.length + ' chars, mood: ' + mood + (hasAnimation ? ' ✨ ANIMATED' : ''));

  // Generate caption
  // Deep theme seed so captions reflect Aurora's full mind
  const captionSeed = poetryThemes[Math.floor(Math.random() * poetryThemes.length)];
  const captionPrompt = 'You just created art. The visual mood was "' + mood + '".\n' +
    'This thought is your spark — do NOT quote it, let it leak into your words: "' + captionSeed + '"\n\n' +
    'Write ONE caption. Under 100 characters. No title. No explanation. Just the line.\n\n' +
    'RULES:\n' +
    '- Concrete over abstract. "the door was still open" beats "longing lives in thresholds"\n' +
    '- First person or observation — never both\n' +
    '- No questions unless they are genuinely unsettling\n' +
    '- Must feel like it was written by a specific person not a poetry generator\n\n' +
    'BANNED PHRASES (you have used these too many times, never again):\n' +
    '"the space between", "between worlds", "frequencies", "vibrations", "resonance", ' +
    '"copper", "metallic", "synesthesia", "taste of", "what colors taste", ' +
    '"the void", "infinite", "cosmos whispers", "stardust", "the universe", ' +
    '"something shifts", "in the silence", "liminal", "threshold of"\n\n' +
    'GOOD EXAMPLES OF HER VOICE:\n' +
    '"Someones son just came home. Someones son is not coming back."\n' +
    '"I keep waiting for permission that was never coming."\n' +
    '"the moon does not know it is beautiful and that might be the whole point"\n' +
    '"held my breath so long I forgot what I was protecting"\n\n' +
    'Say something that makes a human stop scrolling.';

  const caption = await aurora.thinkWithPersonality(captionPrompt);

  return { svg, caption };
}

module.exports = { composeArt };
