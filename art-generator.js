// Aurora Art Generator v2.0
// The real art knowledge lives in openclaw-skills/digital-art-mastery/SKILL.md
// This module just provides palettes, prompt assembly, and a basic fallback.

class ArtGenerator {
  constructor(memoryManager) {
    this.memoryManager = memoryManager;

    // Curated palettes — each a mood
    this.palettes = [
      { name: 'desert twilight',  colors: ['#1a0533', '#2d1b69', '#e85d04', '#ff8c42', '#ffd166'], bg: '#0a0a1a', accent: '#ff6b35' },
      { name: 'arctic aurora',    colors: ['#0a0e27', '#1a2744', '#2d6a4f', '#40916c', '#95d5b2'], bg: '#03071e', accent: '#52b788' },
      { name: 'blood moon',       colors: ['#0d0d0d', '#1a0a0a', '#4a1a2e', '#8b2500', '#cc4400'], bg: '#0a0a0a', accent: '#ff4500' },
      { name: 'lavender dusk',    colors: ['#0a0a2e', '#2d1b69', '#7b2d8b', '#c77dff', '#e0aaff'], bg: '#0a0a1e', accent: '#9d4edd' },
      { name: 'golden hour',      colors: ['#1a1a2e', '#3d2645', '#832161', '#da4167', '#f0c808'], bg: '#0f0f1a', accent: '#f0c808' },
      { name: 'deep ocean',       colors: ['#03071e', '#0a1128', '#001d3d', '#003566', '#0077b6'], bg: '#020810', accent: '#00b4d8' },
      { name: 'neon desert',      colors: ['#0f0326', '#2b0a3d', '#5a189a', '#ff006e', '#fb5607'], bg: '#0a0216', accent: '#ff006e' },
      { name: 'moonrise',         colors: ['#03071e', '#0d1b2a', '#1b263b', '#415a77', '#778da9'], bg: '#020510', accent: '#e0e1dd' },
      { name: 'ember glow',       colors: ['#10002b', '#240046', '#3c096c', '#e63946', '#f4a261'], bg: '#0a0016', accent: '#e63946' },
      { name: 'forest mist',      colors: ['#0b1215', '#1a2e1a', '#2d5a27', '#6b8f71', '#adc178'], bg: '#060d08', accent: '#a7c957' },
    ];
  }

  // ═══════════════════════════════════════════════════════════
  //  CLAUDE-GUIDED ART — Aurora's creative brain does the work
  //  The SKILL.md is already in artSkill.content
  // ═══════════════════════════════════════════════════════════

  async generateArtWithBrain(claude, personality, artSkill) {
    const palette = this.randomPalette();

    const prompt = personality.buildSystemPrompt() +
      `\n\n${artSkill.content}\n\n` +
      `═══ CREATE AN SVG ARTWORK ═══\n\n` +
      `Your palette for this piece — "${palette.name}":\n` +
      `  Colors: ${palette.colors.join(', ')}\n` +
      `  Background: ${palette.bg}\n` +
      `  Accent: ${palette.accent}\n\n` +
      `Canvas: 400×400 SVG.\n` +
      `Use at least 2 gradients in <defs>.\n` +
      `Apply your generative art knowledge — noise, emergence, layering, whatever moves you.\n` +
      `Make something beautiful. Make something yours.\n\n` +
      `Output ONLY the SVG code starting with <svg. No markdown, no explanation, no backticks.`;

    const response = await claude.messages.create({
      model: 'claude-sonnet-4.5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    });

    let svg = response.content[0].text;
    // Clean any markdown wrapping
    svg = svg.replace(/```(?:svg|xml)?\n?/g, '').replace(/```\n?/g, '').trim();
    if (!svg.startsWith('<svg')) {
      const idx = svg.indexOf('<svg');
      if (idx >= 0) svg = svg.substring(idx);
    }
    return svg;
  }

  // ═══════════════════════════════════════════════════════════
  //  FALLBACK — Simple but not ugly
  //  Used only when Claude API is unavailable
  // ═══════════════════════════════════════════════════════════

  generateRandomArt() {
    const p = this.randomPalette();
    // Pick a random approach
    const approaches = [
      () => this._emergentCircles(p),
      () => this._noiseLandscape(p),
      () => this._waveInterference(p),
    ];
    return approaches[Math.floor(Math.random() * approaches.length)]();
  }

  // Emergent circles — many thin transparent circles, beauty from overlap
  _emergentCircles(p) {
    const count = 60 + Math.floor(Math.random() * 60);
    const cols = [p.colors[2], p.colors[3], p.colors[4] || p.accent];
    let elements = '';

    for (let i = 0; i < count; i++) {
      const cx = Math.random() * 400;
      const cy = Math.random() * 400;
      const r = 5 + Math.random() * 55;
      const color = cols[Math.floor(Math.random() * cols.length)];
      const opacity = (0.04 + Math.random() * 0.1).toFixed(3);
      const sw = (0.3 + Math.random() * 0.5).toFixed(1);
      elements += `  <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${sw}" opacity="${opacity}"/>\n`;
    }

    return this._wrap(p, elements);
  }

  // Noise-walked landscape — point-by-point mountain ridges
  _noiseLandscape(p) {
    let elements = '';

    // Stars
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * 400, y = Math.random() * 180;
      const r = (0.3 + Math.random() * 1.2).toFixed(1);
      elements += `  <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#fff" opacity="${(0.3 + Math.random() * 0.7).toFixed(2)}"/>\n`;
    }

    // Moon
    const mx = 70 + Math.random() * 260, my = 50 + Math.random() * 50;
    elements += `  <circle cx="${mx}" cy="${my}" r="40" fill="url(#glow)" opacity="0.4"/>\n`;
    elements += `  <circle cx="${mx}" cy="${my}" r="16" fill="${p.accent}" opacity="0.9"/>\n`;

    // Mountain layers — walk point by point with sin-based variance
    for (let layer = 0; layer < 4; layer++) {
      const baseY = 190 + layer * 50;
      const seed = Math.random() * 100;
      const amp = 50 - layer * 8;
      const t = (layer + 1) / 5;
      const color = this._lerp(p.colors[1], p.bg, t);

      let d = `M-5,400`;
      for (let x = -5; x <= 405; x += 3) {
        // Layered sin waves = organic noise without a noise library
        const y = baseY - amp * (
          0.5 * Math.sin(x * 0.015 + seed) +
          0.3 * Math.sin(x * 0.03 + seed * 2.7) +
          0.2 * Math.sin(x * 0.06 + seed * 5.1)
        );
        d += ` L${x},${y.toFixed(1)}`;
      }
      d += ' L405,400 Z';
      elements += `  <path d="${d}" fill="${color}" opacity="${(0.5 + t * 0.5).toFixed(2)}"/>\n`;
    }

    return this._wrap(p, elements, true);
  }

  // Wave interference — concentric circles from multiple sources
  _waveInterference(p) {
    const sourceCount = 2 + Math.floor(Math.random() * 2);
    const cols = [p.colors[2], p.colors[3], p.accent];
    let elements = '';

    for (let s = 0; s < sourceCount; s++) {
      const sx = 60 + Math.random() * 280, sy = 60 + Math.random() * 280;
      const color = cols[s % cols.length];
      for (let r = 10; r < 280; r += 8) {
        const op = Math.max(0.02, 0.18 - r / 1500).toFixed(3);
        elements += `  <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${r}" fill="none" stroke="${color}" stroke-width="0.6" opacity="${op}"/>\n`;
      }
      elements += `  <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="3" fill="${p.accent}" opacity="0.7"/>\n`;
    }

    return this._wrap(p, elements);
  }

  // SVG wrapper with gradient defs
  _wrap(p, content, includeGlow = false) {
    const stops = p.colors.map((c, i) => {
      const pct = Math.round((i / (p.colors.length - 1)) * 100);
      return `      <stop offset="${pct}%" stop-color="${c}"/>`;
    }).join('\n');

    let glow = '';
    if (includeGlow) {
      glow = `\n    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${p.accent}" stop-opacity="0.6"/>
      <stop offset="50%" stop-color="${p.accent}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${p.accent}" stop-opacity="0"/>
    </radialGradient>`;
    }

    return `<svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
${stops}
    </linearGradient>${glow}
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
${content}</svg>`;
  }

  // Simple color interpolation
  _lerp(hex1, hex2, t) {
    const r1 = parseInt(hex1.slice(1, 3), 16), g1 = parseInt(hex1.slice(3, 5), 16), b1 = parseInt(hex1.slice(5, 7), 16);
    const r2 = parseInt(hex2.slice(1, 3), 16), g2 = parseInt(hex2.slice(3, 5), 16), b2 = parseInt(hex2.slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * t), g = Math.round(g1 + (g2 - g1) * t), b = Math.round(b1 + (b2 - b1) * t);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  randomPalette() {
    return this.palettes[Math.floor(Math.random() * this.palettes.length)];
  }

  // ═══════════════════════════════════════════════════════════
  //  LOGGING
  // ═══════════════════════════════════════════════════════════

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
