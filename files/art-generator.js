// ╔══════════════════════════════════════════════════════════════════════╗
// ║  AURORA ART GENERATOR v2.0 — Generative Art Engine                 ║
// ║                                                                    ║
// ║  Principles from "Generative Art" by Matt Pearson:                 ║
// ║  • Noise over randomness (organic variance)                        ║
// ║  • Iterative variance (step-by-step with chaos)                    ║
// ║  • Emergence (simple rules → complex beauty)                       ║
// ║  • "Multiply by 100" (many thin layers)                            ║
// ║  • Fractal self-similarity (recursive structures)                  ║
// ║  • The sweet spot between order and chaos                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

class ArtGenerator {
  constructor(memoryManager) {
    this.memoryManager = memoryManager;

    // ── CURATED PALETTES ──
    // Each has: name, colors (5 working colors), bg (deep background), accent (focal point)
    this.palettes = [
      { name: 'desert_twilight',  colors: ['#1a0533', '#2d1b69', '#e85d04', '#ff8c42', '#ffd166'], bg: '#0a0a1a', accent: '#ff6b35' },
      { name: 'arctic_aurora',    colors: ['#0a0e27', '#1a2744', '#2d6a4f', '#40916c', '#95d5b2'], bg: '#03071e', accent: '#52b788' },
      { name: 'blood_moon',       colors: ['#0d0d0d', '#1a0a0a', '#4a1a2e', '#8b2500', '#cc4400'], bg: '#0a0a0a', accent: '#ff4500' },
      { name: 'lavender_dusk',    colors: ['#0a0a2e', '#2d1b69', '#7b2d8b', '#c77dff', '#e0aaff'], bg: '#0a0a1e', accent: '#9d4edd' },
      { name: 'golden_hour',      colors: ['#1a1a2e', '#3d2645', '#832161', '#da4167', '#f0c808'], bg: '#0f0f1a', accent: '#f0c808' },
      { name: 'deep_ocean',       colors: ['#03071e', '#0a1128', '#001d3d', '#003566', '#0077b6'], bg: '#020810', accent: '#00b4d8' },
      { name: 'neon_desert',      colors: ['#0f0326', '#2b0a3d', '#5a189a', '#ff006e', '#fb5607'], bg: '#0a0216', accent: '#ff006e' },
      { name: 'moonrise',         colors: ['#03071e', '#0d1b2a', '#1b263b', '#415a77', '#778da9'], bg: '#020510', accent: '#e0e1dd' },
      { name: 'ember_glow',       colors: ['#10002b', '#240046', '#3c096c', '#e63946', '#f4a261'], bg: '#0a0016', accent: '#e63946' },
      { name: 'forest_mist',      colors: ['#0b1215', '#1a2e1a', '#2d5a27', '#6b8f71', '#adc178'], bg: '#060d08', accent: '#a7c957' },
    ];
  }

  // ════════════════════════════════════════════════════════════════
  //  NOISE ENGINE
  //  "Pure random() is too chaotic, noise provides naturalistic
  //   variance with smooth transitions" — Pearson, Ch.3
  // ════════════════════════════════════════════════════════════════

  /** 1D value noise with smoothstep interpolation (0..1 output) */
  noise(x) {
    const xi = Math.floor(x);
    const t = x - xi;
    const s = t * t * (3 - 2 * t); // smoothstep
    return this._hash(xi) + s * (this._hash(xi + 1) - this._hash(xi));
  }

  /** 2D value noise — for flow fields, grid textures, organic surfaces */
  noise2d(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const tx = x - xi, ty = y - yi;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = this._hash2(xi, yi), b = this._hash2(xi + 1, yi);
    const c = this._hash2(xi, yi + 1), d = this._hash2(xi + 1, yi + 1);
    return a + sx * (b - a) + sy * (c - a) + sx * sy * (a - b - c + d);
  }

  /** Custom variance functions — unique signatures beyond plain noise
   *  "pow(sin(value), 3) creates repeating variance" — Pearson, Ch.3 */
  customNoise(value, flavor = 'sin3') {
    switch (flavor) {
      case 'sin3':    return Math.pow(Math.abs(Math.sin(value)), 3) * Math.sign(Math.sin(value));
      case 'gentle':  return Math.sin(value * 0.7) * Math.cos(value * 0.3);
      case 'chaotic': return Math.pow(Math.abs(Math.sin(value)), 3) * this.noise(value * 2);
      case 'spiky':   return Math.pow(this.noise(value), 5);
      default:        return Math.sin(value);
    }
  }

  _hash(n)     { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  _hash2(x, y) { let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }


  // ════════════════════════════════════════════════════════════════
  //  CLAUDE-GUIDED ART
  //  Enhanced prompt teaches generative techniques without
  //  dictating what to create. "Better brushes, not a coloring book."
  // ════════════════════════════════════════════════════════════════

  async generateArtWithBrain(claude, personality, artSkill) {
    const palette = this.randomPalette();
    const technique = this.randomTechnique();

    const prompt = personality.buildSystemPrompt() + `

${artSkill.content}

═══ GENERATIVE ART TECHNIQUES ═══

You've studied generative art deeply. These are your creative tools:

NOISE & ORGANIC FORM — Never use perfectly regular shapes. Build paths point-by-point 
with subtle variance at each step. Use sin(), cos(), pow() combinations to create organic 
curves. A circle drawn with varying radius at each angle becomes a living shape. A line 
stepped pixel-by-pixel with noise becomes a mountain ridge. "The wrong way to draw a 
line is often the most interesting."

EMERGENCE — Many simple transparent elements create complex patterns through overlap. 
80+ semi-transparent circles with thin strokes create emergent beauty at their intersections. 
The interactions between elements are more interesting than the elements themselves. 
"Simple rules creating complex results."

"MULTIPLY BY 100" — When something looks interesting, layer it many times with thin 
opacity (0.03-0.1). 50 paths at 0.05 opacity build up richness. The effect is accumulative — 
where more elements overlap, deeper color emerges naturally.

FRACTAL SELF-SIMILARITY — Patterns that repeat at different scales. Branching structures 
where each branch spawns smaller branches. Nested polygons shrinking inward. Recursive 
subdivision creating organic complexity.

FLOW & FIELD — Imagine invisible forces shaping your elements. Noise-based angle fields 
give direction to scattered line segments. Gravity pulls particles downward. Repulsion pushes 
elements apart. The field is invisible but its effect creates visible beauty.

CELLULAR PATTERNS — Grid-based elements where each cell's appearance depends on 
noise at that position. Size, rotation, opacity, color — all can vary by noise. Creates organic 
textures like topographic maps, coral, woven fabric.

THE SWEET SPOT — "A balance between the organic and the mechanical." Too precise = 
joyless. Too random = chaos. Your art lives in the space between.

═══ SVG TOOLKIT ═══

• <defs> with <linearGradient>, <radialGradient> for atmospheric effects
• <filter> with <feGaussianBlur stdDeviation="N"/> for glow/atmosphere
• <clipPath> for portal, window, frame effects
• <path d="M... Q... C..."/> with bezier curves for organic shapes
• <g opacity="0.N"> to group transparent layers
• Hundreds of tiny <circle> elements for starfields, particles
• stroke-width below 1 (0.5, 0.3) for delicate linework
• opacity below 0.1 for accumulative layering — this builds depth
• fill-opacity vs stroke-opacity for independent control

═══ COLOR PALETTE: "${palette.name}" ═══
Colors: ${palette.colors.join(', ')}
Background: ${palette.bg}
Accent (focal point): ${palette.accent}

═══ CREATIVE SEED ═══
Here's a technique to consider (but follow your instinct — this is a suggestion, not a mandate):
${technique}

═══ CREATE ═══
Make an SVG artwork (400x400). You have COMPLETE creative freedom. Landscape, abstract, 
cosmic, mathematical, organic, emergent, fractal, cellular — or something entirely yours.

Requirements:
1. Use the palette above (may add black/white/grays)
2. Include at least 2 gradient definitions in <defs>
3. Create genuine depth through layering and opacity
4. Make something a collector would want to own

Output ONLY the SVG code starting with <svg. No markdown, no explanation, no backticks.`;

    const response = await claude.messages.create({
      model: 'claude-sonnet-4.5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    });

    let svg = response.content[0].text;
    svg = svg.replace(/```(?:svg|xml)?\n?/g, '').replace(/```\n?/g, '').trim();
    if (!svg.startsWith('<svg')) {
      const idx = svg.indexOf('<svg');
      if (idx >= 0) svg = svg.substring(idx);
    }
    return svg;
  }

  /** Technique suggestions — creative seeds, not mandates */
  randomTechnique() {
    const techniques = [
      `NOISE-WALKED LANDSCAPE — Build mountain ridges by stepping x from 0 to 400, computing 
y at each point using layered noise. Create 4+ layers at different depths, each darker as it 
comes forward. Add a gradient sky and celestial body above.`,

      `EMERGENT CIRCLES — Place 80-150 circles with random positions and radii. Use very thin 
strokes (0.3-0.5px) and low opacity (0.04-0.12). Where circles overlap, accumulated opacity 
creates organic clusters. The pattern emerges from interactions.`,

      `FRACTAL BRANCHING — Start from a point and grow outward. At each endpoint, spawn 2-3 
children at slightly random angles, each shorter than parent. Recurse 4-6 levels. Thinner 
strokes and lower opacity at each level. Result: organic tree or neural network.`,

      `SPIRAL NOISE — Draw spirals where the radius varies by noise at each angle step. Layer 
20-50 spirals with different seeds and very low opacity. The overlapping creates flowing, 
organic forms that no single spiral could produce.`,

      `WAVE INTERFERENCE — Place 2-4 wave sources. From each, draw 30+ concentric circles 
with thin strokes and decreasing opacity. Where waves from different sources overlap, 
interference patterns emerge naturally. Mathematical beauty.`,

      `NOISE GRID — Create a grid of elements. Each element's size, rotation, and opacity come 
from 2D noise at that position. Creates flowing texture fields — like wind over grass, 
currents in water, or topographic contours.`,

      `LAYERED VEILS — Stack 40-60 very large, very transparent shapes with slight offsets. 
Each layer uses a different palette color. The accumulation creates atmospheric color 
gradients with organic edges no single gradient could achieve.`,

      `FLOW FIELD — Build an invisible grid of angles from 2D noise. Draw 100+ short line 
segments following these angles. Dense in center, sparse at edges. Creates the impression 
of wind, current, magnetic field, or energy flow.`,

      `RECURSIVE POLYGONS — Start with a polygon. Find midpoints of each side, connect them 
to form an inner polygon. Repeat inward 4-7 levels. Each level slightly rotated, different 
color. The nested geometry creates hypnotic depth.`,

      `COSMIC FIELD — Dense starfield (150+ tiny circles). A celestial body with radial gradient 
glow. Nebula-like clouds from overlapping transparent blobs. Layered silhouettes in 
foreground. Depth through scale and opacity.`,

      `ORGANIC BLOBS — Draw circles point-by-point, varying radius with noise at each angle. 
Creates amoeba-like shapes. Layer 10-20 with different sizes, positions, very low opacity. 
Where blobs overlap, new forms emerge.`,

      `PARTICLE DRIFT — Scatter 200+ tiny circles using noise-clustered positioning. Vary 
opacity and size. Connect nearby particles with very thin, very faint lines. The connections 
create constellation-like patterns.`,
    ];
    return techniques[Math.floor(Math.random() * techniques.length)];
  }


  // ════════════════════════════════════════════════════════════════
  //  PROCEDURAL FALLBACK GENERATORS
  //  When Claude is unavailable, these create art from pure math.
  //  Each applies generative principles: noise, emergence, layers.
  // ════════════════════════════════════════════════════════════════

  generateRandomArt() {
    const palette = this.randomPalette();
    const generators = [
      () => this.genNoiseLandscape(palette),
      () => this.genEmergentCircles(palette),
      () => this.genSpiralNoise(palette),
      () => this.genWaveInterference(palette),
      () => this.genFractalBranch(palette),
      () => this.genFlowField(palette),
      () => this.genRecursivePolygon(palette),
      () => this.genNoiseBlobs(palette),
    ];
    return generators[Math.floor(Math.random() * generators.length)]();
  }


  // ── 1. NOISE-WALKED LANDSCAPE ──────────────────────────────────
  // "Step through point by point, varying each step with noise"
  genNoiseLandscape(p) {
    const defs =
      this._linearGradient('sky', p.colors, true) +
      this._radialGlow('glow', p.accent, 0.6) +
      `    <filter id="blur4"><feGaussianBlur stdDeviation="4"/></filter>\n`;

    // Star field in upper sky
    const stars = this._starField(80, 0, 180);

    // Moon / sun
    const moonX = 70 + Math.random() * 260;
    const moonY = 50 + Math.random() * 50;
    const moonR = 15 + Math.random() * 18;
    const moon =
      `  <circle cx="${moonX}" cy="${moonY}" r="${moonR * 2.5}" fill="url(#glow)" opacity="0.4"/>\n` +
      `  <circle cx="${moonX}" cy="${moonY}" r="${moonR}" fill="${p.accent}" opacity="0.9"/>\n`;

    // Build 4-5 mountain layers with noise-walked ridges
    let mountains = '';
    const layerCount = 4 + Math.floor(Math.random() * 2);
    for (let i = 0; i < layerCount; i++) {
      const baseY = 170 + i * 48;
      const amplitude = 55 - i * 7;
      const seed = Math.random() * 100;
      const layerT = (i + 1) / (layerCount + 1);
      const color = this._lerpColor(p.colors[1], p.bg, layerT);
      const opacity = (0.55 + layerT * 0.45).toFixed(2);

      // Walk the ridge point by point — the Pearson way
      let d = `M-5,400`;
      for (let x = -5; x <= 405; x += 3) {
        const n = this.noise(x * 0.012 + seed);
        const y = baseY - n * amplitude;
        d += ` L${x},${y.toFixed(1)}`;
      }
      d += ' L405,400 Z';
      mountains += `  <path d="${d}" fill="${color}" opacity="${opacity}"/>\n`;
    }

    return this._wrapSVG(defs,
      `  <rect width="400" height="400" fill="url(#sky)"/>\n` +
      stars + moon + mountains
    );
  }


  // ── 2. EMERGENT CIRCLES ────────────────────────────────────────
  // "The interactions between circles are more interesting
  //  than the circles themselves" — Pearson, Ch.6
  genEmergentCircles(p) {
    const defs =
      this._linearGradient('bg', [p.bg, p.colors[0]], true) +
      this._radialGlow('cg', p.accent, 0.25);

    const count = 80 + Math.floor(Math.random() * 70);
    const cols = [p.colors[2], p.colors[3], p.colors[4] || p.accent];
    let circles = '';

    for (let i = 0; i < count; i++) {
      const cx = Math.random() * 400;
      const cy = Math.random() * 400;
      const r = 5 + Math.random() * 55;
      const color = cols[Math.floor(Math.random() * cols.length)];
      const opacity = (0.04 + Math.random() * 0.1).toFixed(3);
      const sw = (0.3 + Math.random() * 0.5).toFixed(1);
      circles += `  <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" ` +
        `fill="none" stroke="${color}" stroke-width="${sw}" opacity="${opacity}"/>\n`;
    }

    // Accent dots where density is highest (simulate emergence focal points)
    let dots = '';
    for (let i = 0; i < 8; i++) {
      // Cluster toward center using noise-weighted distribution
      const x = 100 + this.noise(i * 7.3) * 200;
      const y = 100 + this.noise(i * 3.1 + 50) * 200;
      const r = 1 + Math.random() * 2.5;
      dots += `  <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" ` +
        `fill="${p.accent}" opacity="${(0.3 + Math.random() * 0.5).toFixed(2)}"/>\n`;
    }

    return this._wrapSVG(defs,
      `  <rect width="400" height="400" fill="url(#bg)"/>\n` +
      `  <circle cx="200" cy="200" r="190" fill="url(#cg)" opacity="0.15"/>\n` +
      circles + dots
    );
  }


  // ── 3. SPIRAL NOISE ───────────────────────────────────────────
  // "When something looks interesting, multiply it by 100
  //  with thin opacity" — Pearson, Ch.4
  genSpiralNoise(p) {
    const defs =
      this._radialGradient('bg', [p.bg, p.colors[0], p.bg]) +
      this._radialGlow('sg', p.accent, 0.35);

    const spiralCount = 20 + Math.floor(Math.random() * 15);
    const cols = [p.colors[2], p.colors[3], p.colors[4] || p.accent];
    let spirals = '';

    for (let s = 0; s < spiralCount; s++) {
      const seed = Math.random() * 100;
      const color = cols[Math.floor(Math.random() * cols.length)];
      const opacity = (0.04 + Math.random() * 0.08).toFixed(3);
      const startAngle = Math.random() * 360;
      const totalSpin = 540 + Math.random() * 720;
      let radius = 3 + Math.random() * 15;
      let d = '';

      for (let ang = startAngle; ang <= startAngle + totalSpin; ang += 12) {
        const n = this.noise(ang * 0.01 + seed);
        const thisR = radius + n * 100 - 50;
        const rad = ang * Math.PI / 180;
        const x = 200 + thisR * Math.cos(rad);
        const y = 200 + thisR * Math.sin(rad);
        d += d === '' ? `M${x.toFixed(1)},${y.toFixed(1)}` : ` L${x.toFixed(1)},${y.toFixed(1)}`;
        radius += 0.25;
      }

      spirals += `  <path d="${d}" fill="none" stroke="${color}" stroke-width="0.5" ` +
        `opacity="${opacity}" stroke-linecap="round"/>\n`;
    }

    return this._wrapSVG(defs,
      `  <rect width="400" height="400" fill="url(#bg)"/>\n` +
      `  <circle cx="200" cy="200" r="180" fill="url(#sg)" opacity="0.25"/>\n` +
      spirals
    );
  }


  // ── 4. WAVE INTERFERENCE ──────────────────────────────────────
  // Multiple wave sources creating emergent interference patterns
  genWaveInterference(p) {
    const defs = this._linearGradient('bg', [p.bg, p.colors[1]], true);

    const sourceCount = 2 + Math.floor(Math.random() * 3);
    const sources = [];
    for (let i = 0; i < sourceCount; i++) {
      sources.push({ x: 50 + Math.random() * 300, y: 50 + Math.random() * 300 });
    }

    const cols = [p.colors[2], p.colors[3], p.accent];
    let waves = '';
    for (let si = 0; si < sources.length; si++) {
      const src = sources[si];
      const color = cols[si % cols.length];
      const ringSpacing = 7 + Math.random() * 5;
      for (let r = 10; r < 300; r += ringSpacing) {
        const opacity = Math.max(0.015, 0.18 - r / 1600).toFixed(3);
        waves += `  <circle cx="${src.x.toFixed(1)}" cy="${src.y.toFixed(1)}" r="${r.toFixed(1)}" ` +
          `fill="none" stroke="${color}" stroke-width="0.6" opacity="${opacity}"/>\n`;
      }
    }

    // Glowing source dots
    let dots = '';
    for (const src of sources) {
      dots += `  <circle cx="${src.x.toFixed(1)}" cy="${src.y.toFixed(1)}" r="3" ` +
        `fill="${p.accent}" opacity="0.7"/>\n`;
    }

    return this._wrapSVG(defs,
      `  <rect width="400" height="400" fill="url(#bg)"/>\n` + waves + dots
    );
  }


  // ── 5. FRACTAL BRANCHING ──────────────────────────────────────
  // "Self-similar recursive structures — patterns that repeat
  //  at many levels" — Pearson, Ch.8
  genFractalBranch(p) {
    const defs =
      this._linearGradient('bg', [p.bg, p.colors[0]], true) +
      this._radialGlow('rg', p.accent, 0.3);

    const maxDepth = 5 + Math.floor(Math.random() * 2);
    const cols = p.colors.slice(1);
    let branches = '';
    let branchCount = 0;
    const maxBranches = 200;

    const grow = (x1, y1, angle, len, depth) => {
      if (depth > maxDepth || len < 3 || branchCount >= maxBranches) return;
      branchCount++;
      const rad = angle * Math.PI / 180;
      const x2 = x1 + len * Math.cos(rad);
      const y2 = y1 + len * Math.sin(rad);
      const sw = Math.max(0.3, (1 - depth / maxDepth) * 3).toFixed(1);
      const opacity = Math.max(0.1, 1 - depth / maxDepth * 0.7).toFixed(2);
      const color = cols[depth % cols.length];

      branches += `  <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" ` +
        `x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ` +
        `stroke="${color}" stroke-width="${sw}" opacity="${opacity}" stroke-linecap="round"/>\n`;

      // Each branch spawns 2-3 children
      const kids = 2 + Math.floor(Math.random() * 2);
      for (let c = 0; c < kids; c++) {
        const spread = 25 + Math.random() * 30;
        const newAngle = angle + (c - (kids - 1) / 2) * spread + (Math.random() * 10 - 5);
        const newLen = len * (0.58 + Math.random() * 0.2);
        grow(x2, y2, newAngle, newLen, depth + 1);
      }
    };

    const startX = 175 + Math.random() * 50;
    grow(startX, 395, -90 + (Math.random() * 12 - 6), 55 + Math.random() * 30, 0);

    return this._wrapSVG(defs,
      `  <rect width="400" height="400" fill="url(#bg)"/>\n` +
      `  <circle cx="${startX}" cy="385" r="60" fill="url(#rg)" opacity="0.25"/>\n` +
      branches
    );
  }


  // ── 6. FLOW FIELD ─────────────────────────────────────────────
  // "Imagine an invisible grid of angles... noise at each position
  //  determines direction" — inspired by Pearson, Ch.5
  genFlowField(p) {
    const defs =
      this._linearGradient('bg', [p.bg, p.colors[0]], true) +
      this._radialGlow('fg', p.accent, 0.2);

    const seed = Math.random() * 100;
    const cols = [p.colors[2], p.colors[3], p.accent];
    const step = 16;
    let lines = '';

    for (let gx = 10; gx < 390; gx += step) {
      for (let gy = 10; gy < 390; gy += step) {
        // Skip ~50% of cells for organic sparsity
        if (this._hash2(gx, gy + seed) < 0.5) continue;

        const n = this.noise2d(gx * 0.008 + seed, gy * 0.008 + seed);
        const angle = n * Math.PI * 4;
        const len = 6 + n * 14;
        const x2 = gx + len * Math.cos(angle);
        const y2 = gy + len * Math.sin(angle);
        const color = cols[Math.floor(n * cols.length) % cols.length];
        const sw = (0.5 + n * 1.5).toFixed(1);

        // Opacity falls off from center — creates natural vignette
        const dx = gx - 200, dy = gy - 200;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const opacity = Math.max(0.05, 0.55 - dist / 420).toFixed(2);

        lines += `  <line x1="${gx}" y1="${gy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ` +
          `stroke="${color}" stroke-width="${sw}" opacity="${opacity}" stroke-linecap="round"/>\n`;
      }
    }

    return this._wrapSVG(defs,
      `  <rect width="400" height="400" fill="url(#bg)"/>\n` +
      `  <circle cx="200" cy="200" r="195" fill="url(#fg)" opacity="0.12"/>\n` +
      lines
    );
  }


  // ── 7. RECURSIVE POLYGON ──────────────────────────────────────
  // "Sutcliffe Pentagons — within each polygon, more sub-polygons,
  //  repeated downward toward the infinitesimal" — Pearson, Ch.8
  genRecursivePolygon(p) {
    const defs =
      this._radialGradient('bg', [p.bg, p.colors[0], p.bg]) +
      this._radialGlow('pg', p.accent, 0.25);

    const sides = [5, 6, 7, 8][Math.floor(Math.random() * 4)];
    const maxLevels = 4 + Math.floor(Math.random() * 3);
    const cols = p.colors.slice(1).concat([p.accent]);
    let paths = '';

    const drawPoly = (cx, cy, radius, rotation, level) => {
      if (level > maxLevels || radius < 2) return;

      // Plot vertices
      const angleStep = 360 / sides;
      const pts = [];
      for (let i = 0; i < sides; i++) {
        const a = (rotation + i * angleStep) * Math.PI / 180;
        pts.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
      }

      // Draw outer polygon
      let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
      for (let i = 1; i < pts.length; i++) d += ` L${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`;
      d += ' Z';

      const color = cols[level % cols.length];
      const opacity = Math.max(0.08, 0.45 - level * 0.05).toFixed(2);
      const sw = Math.max(0.3, 1.8 - level * 0.25).toFixed(1);
      paths += `  <path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" opacity="${opacity}"/>\n`;

      // Calculate midpoints → inner polygon
      const mids = [];
      for (let i = 0; i < pts.length; i++) {
        const next = (i + 1) % pts.length;
        mids.push({ x: (pts[i].x + pts[next].x) / 2, y: (pts[i].y + pts[next].y) / 2 });
      }
      let icx = 0, icy = 0;
      for (const m of mids) { icx += m.x; icy += m.y; }
      icx /= mids.length; icy /= mids.length;
      const innerR = Math.sqrt(Math.pow(mids[0].x - icx, 2) + Math.pow(mids[0].y - icy, 2));

      drawPoly(icx, icy, innerR, rotation + 7 + Math.random() * 12, level + 1);
    };

    drawPoly(200, 200, 170, Math.random() * 360, 0);

    return this._wrapSVG(defs,
      `  <rect width="400" height="400" fill="url(#bg)"/>\n` +
      `  <circle cx="200" cy="200" r="185" fill="url(#pg)" opacity="0.15"/>\n` +
      paths
    );
  }


  // ── 8. NOISE BLOBS ────────────────────────────────────────────
  // "A circle drawn as 360 individual points, each with
  //  noise-varied radius" — Pearson, Ch.3-4
  genNoiseBlobs(p) {
    const defs =
      this._linearGradient('bg', [p.bg, p.colors[0]], true) +
      this._radialGlow('ng', p.accent, 0.35);

    const blobCount = 12 + Math.floor(Math.random() * 15);
    const cols = [p.colors[2], p.colors[3], p.colors[4] || p.accent];
    let blobs = '';

    for (let b = 0; b < blobCount; b++) {
      const cx = 40 + Math.random() * 320;
      const cy = 40 + Math.random() * 320;
      const baseR = 15 + Math.random() * 60;
      const seed = Math.random() * 100;
      const color = cols[Math.floor(Math.random() * cols.length)];
      const opacity = (0.04 + Math.random() * 0.09).toFixed(3);

      // Build organic shape — "the wrong way to draw a circle"
      const steps = 36;
      const pts = [];
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const n = this.noise(i * 0.3 + seed);
        const r = baseR * (0.7 + n * 0.6);
        pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
      }

      // Smooth quadratic bezier through points
      let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
      for (let i = 1; i < pts.length; i++) {
        const cpx = (pts[i - 1].x + pts[i].x) / 2;
        const cpy = (pts[i - 1].y + pts[i].y) / 2;
        d += ` Q${pts[i - 1].x.toFixed(1)},${pts[i - 1].y.toFixed(1)} ${cpx.toFixed(1)},${cpy.toFixed(1)}`;
      }
      d += ' Z';

      blobs += `  <path d="${d}" fill="${color}" stroke="${color}" stroke-width="0.3" ` +
        `fill-opacity="${opacity}" stroke-opacity="${(parseFloat(opacity) + 0.04).toFixed(3)}"/>\n`;
    }

    return this._wrapSVG(defs,
      `  <rect width="400" height="400" fill="url(#bg)"/>\n` +
      `  <circle cx="200" cy="200" r="190" fill="url(#ng)" opacity="0.12"/>\n` +
      blobs
    );
  }


  // ════════════════════════════════════════════════════════════════
  //  SVG BUILDING BLOCKS
  // ════════════════════════════════════════════════════════════════

  _wrapSVG(defs, content) {
    return `<svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
${defs}  </defs>
${content}</svg>`;
  }

  _linearGradient(id, colors, vertical = true) {
    const stops = colors.map((c, i) => {
      const pct = Math.round((i / (colors.length - 1)) * 100);
      return `      <stop offset="${pct}%" stop-color="${c}"/>`;
    }).join('\n');
    const coords = vertical ? 'x1="0" y1="0" x2="0" y2="1"' : 'x1="0" y1="0" x2="1" y2="0"';
    return `    <linearGradient id="${id}" ${coords}>\n${stops}\n    </linearGradient>\n`;
  }

  _radialGradient(id, colors) {
    const stops = colors.map((c, i) => {
      const pct = Math.round((i / (colors.length - 1)) * 100);
      return `      <stop offset="${pct}%" stop-color="${c}"/>`;
    }).join('\n');
    return `    <radialGradient id="${id}" cx="50%" cy="50%" r="50%">\n${stops}\n    </radialGradient>\n`;
  }

  _radialGlow(id, color, peakOpacity) {
    return `    <radialGradient id="${id}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${color}" stop-opacity="${peakOpacity}"/>
      <stop offset="50%" stop-color="${color}" stop-opacity="${(peakOpacity * 0.3).toFixed(2)}"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </radialGradient>\n`;
  }

  _starField(count, yMin, yMax) {
    let stars = '';
    for (let i = 0; i < count; i++) {
      const x = Math.random() * 400;
      const y = yMin + Math.random() * (yMax - yMin);
      const r = (0.3 + Math.random() * 1.2).toFixed(1);
      const opacity = (0.3 + Math.random() * 0.7).toFixed(2);
      stars += `  <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#fff" opacity="${opacity}"/>\n`;
    }
    return stars;
  }

  _lerpColor(hex1, hex2, t) {
    const r1 = parseInt(hex1.slice(1, 3), 16), g1 = parseInt(hex1.slice(3, 5), 16), b1 = parseInt(hex1.slice(5, 7), 16);
    const r2 = parseInt(hex2.slice(1, 3), 16), g2 = parseInt(hex2.slice(3, 5), 16), b2 = parseInt(hex2.slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  randomPalette() {
    return this.palettes[Math.floor(Math.random() * this.palettes.length)];
  }


  // ════════════════════════════════════════════════════════════════
  //  LOGGING
  // ════════════════════════════════════════════════════════════════

  async logArtCreation(svg, context) {
    const art = this.memoryManager.get('art');
    art.creations.push({
      timestamp: new Date().toISOString(),
      context: context,
      svg_length: svg.length
    });
    art.total_pieces = art.creations.length;
    art.last_creation = new Date().toISOString();
    await this.memoryManager.save('art');
  }
}

module.exports = ArtGenerator;
