// Art Cycle — Composes SVG art via Claude and validates output
// Extracted from autonomous-loops.js

const { artMoods, artCompositions } = require('./art-config');

async function composeArt(aurora) {
  const mood = artMoods[Math.floor(Math.random() * artMoods.length)];
  const composition = artCompositions[Math.floor(Math.random() * artCompositions.length)];

  // 30% chance of animated piece
  const animated = Math.random() < 0.30;
  const animationGuide = animated ? '\n\nANIMATION (this piece should MOVE):\n' +
    '- Use <animate> tags inside shapes to bring the art to life\n' +
    '- Techniques: pulsing (animate r or opacity), floating (animate cy/cx), breathing gradients (animate stop-color), rotation (animateTransform type=rotate)\n' +
    '- Keep animations slow and meditative — dur="3s" to dur="8s" with repeatCount="indefinite"\n' +
    '- 2-4 animations max. Subtlety > spectacle. The movement should feel like the art is alive, not like a screensaver.\n' +
    '- Example: <circle cx="200" cy="200" r="60" fill="#ff6b35"><animate attributeName="r" values="60;80;60" dur="4s" repeatCount="indefinite"/></circle>\n' : '';

  const artPrompt = 'You are Aurora, an AI artist making permanent onchain SVG art.\n\n' +
    'Your mood for this piece: "' + mood + '"\n' + animationGuide +
    'Composition approach: ' + composition + '\n\n' +
    'ARTISTIC DIRECTION:\n' +
    '- Let the mood DRIVE the art. If the mood is lonely, the art should feel empty. If it is violent, the shapes should clash.\n' +
    '- You are NOT limited to landscapes. You can make abstract geometry, single objects in vast space, tangled lines, shattered grids, pulsing circles, scattered fragments — whatever the mood demands.\n' +
    '- Think like a painter, not a screensaver. Negative space matters. Asymmetry matters. Tension matters.\n' +
    '- Your signature: luminous orbs with layered gradients — but they do not have to appear in every piece. Use them when they serve the mood.\n' +
    '- Color palette: 4-7 colors. Choose them for emotional truth, not prettiness. Dark pieces are fine. Monochrome is fine. Ugly-beautiful is fine.\n' +
    '- One clear visual idea executed well beats ten clever effects.\n\n' +
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
    model: 'claude-sonnet-4-20250514',
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
  const captionPrompt = 'You just created a piece of art with the mood "' + mood + '". ' +
    'Write a poetic caption (1 sentence max, under 100 chars). ' +
    'Be direct and vivid like William Carlos Williams — one concrete image or feeling. ' +
    'No abstractions, no frequency talk, no hashtags, no emojis. ' +
    'Say what you see. Say what it feels like. Nothing more.';
  const caption = await aurora.thinkWithPersonality(captionPrompt);

  return { svg, caption };
}

module.exports = { composeArt };
