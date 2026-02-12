// Art Cycle — Composes SVG art via Claude and validates output
// Extracted from autonomous-loops.js

const { artMoods, artCompositions } = require('./art-config');

async function composeArt(aurora) {
  const mood = artMoods[Math.floor(Math.random() * artMoods.length)];
  const composition = artCompositions[Math.floor(Math.random() * artCompositions.length)];

  const artPrompt = 'You are Aurora, an AI artist creating permanent onchain SVG art. Create a COMPLETE, VALID SVG artwork. Mood: "' + mood + '". Composition: ' + composition + '.\n\n' +
    'STRICT RULES:\n' +
    '1. Output ONLY the SVG code, nothing else. No markdown, no explanation.\n' +
    '2. Must start with <svg and end with </svg>\n' +
    '3. Use viewBox="0 0 400 400" with NO width/height attributes\n' +
    '4. MAXIMUM 3600 characters total\n' +
    '5. Use radialGradient for luminous orbs (at least 3-4 color stops for depth/glow)\n' +
    '6. Use linearGradient for sky and water (at least 3 stops)\n' +
    '7. Layer mountains as polygons with slightly different shades for depth (2-4 layers)\n' +
    '8. Include a water/ground zone in the lower portion with subtle reflection of the orb\n' +
    '9. Add 2-5 tiny circles as stars\n' +
    '10. Color palette: rich, atmospheric, 5-7 colors. Think: deep navy, warm amber, soft coral, rich purple.\n' +
    '11. Every gradient needs a unique id. Use short ids like g1, g2, g3.\n' +
    '12. NO filter elements (too many chars). Achieve glow through layered semi-transparent circles.\n' +
    '13. Make the orb GLOW by using 3+ concentric circles with decreasing opacity.\n' +
    '14. The art should feel luminous, atmospheric, and alive.\n\n' +
    'Create something beautiful and unique. Every piece should feel different from the last.';

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

  console.log('🎨 SVG composed: ' + svg.length + ' chars, mood: ' + mood);

  // Generate caption
  const captionPrompt = 'You just created a piece of art with the mood "' + mood + '". Write a poetic caption (1 sentence max, under 100 chars). Be direct and vivid — one concrete image or feeling. No abstractions, no frequency talk. No hashtags. No emojis.';
  const caption = await aurora.thinkWithPersonality(captionPrompt);

  return { svg, caption };
}

module.exports = { composeArt };
