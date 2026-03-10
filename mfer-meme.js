// Aurora mfer meme generator — SVG-based, trait-accurate, onchain via botchan
// mfer traits from local npm package (no IPFS gateway needed)
'use strict';
const { execSync } = require('child_process');
const { getMfers, describe } = require('mfers');

const CHAIN_ID = 8453;
const ALL_MFERS = getMfers();

// ============================================================
// TRAIT MAPPINGS
// ============================================================

const BG_COLORS = {
  'blue': '#5b89c8', 'orange': '#e8803a', 'green': '#5a9e6f',
  'dark': '#1a1a2e', 'purple': '#7b5ea7', 'pink': '#e87ca0',
  'off white': '#ede8df', 'dark gray': '#3d3d4a',
};

const HP_COLORS = {
  'black headphones': '#111111', 'white headphones': '#e8e8e8',
  'pink headphones': '#e87ca0', 'gold headphones': '#ffd700',
  'blue headphones': '#4a7cc7', 'neon green headphones': '#39ff14',
  'red headphones': '#cc2222', 'lined headphones': '#333333',
};

const HAIR_COLORS = {
  'yellow': '#f5c518', 'blonde': '#f5c518', 'black': '#111111',
  'brown': '#8b5e3c', 'white': '#f0f0f0', 'red': '#cc3322',
  'blue': '#4a7cc7', 'pink': '#e87ca0', 'green': '#39a86b',
};

const HEAD_FILLS = {
  'alien': '#7bc87b', 'zombie': '#8aab7a', 'ape': '#8b5e3c', 'plain mfer': 'none',
};

const WATCH_COLORS = {
  'turquoise': '#00b5ad', 'gold': '#ffd700', 'red': '#cc2222',
  'green': '#39a86b', 'blue': '#4a7cc7', 'pink': '#e87ca0',
};

// ============================================================
// MFER HELPERS
// ============================================================

function randomMferId() {
  return Math.floor(Math.random() * 10000) + 1;
}

function getMferTraits(id) {
  const m = ALL_MFERS[id];
  return m ? m.traits : ALL_MFERS[1].traits;
}

function getHairColor(traits) {
  const hair = (traits['long hair'] || traits['short hair'] || '').toLowerCase();
  for (const [key, val] of Object.entries(HAIR_COLORS)) {
    if (hair.includes(key)) return val;
  }
  return '#1a1a1a';
}

function getWatchColor(watchStr) {
  if (!watchStr) return null;
  const w = watchStr.toLowerCase();
  for (const [key, val] of Object.entries(WATCH_COLORS)) {
    if (w.includes(key)) return val;
  }
  return '#888888';
}

// ============================================================
// DRAW MFER — the main character renderer
// cx, cy = center of head
// scale = size multiplier (1.0 = default ~200px tall)
// pose = 'standing' | 'sitting' | 'doorway'
// ============================================================

function drawMfer(traits, cx, cy, scale = 1, pose = 'standing') {
  const t = traits || {};
  cx = Math.round(cx); cy = Math.round(cy);
  const s = scale;
  const lw = 3.2 * s;
  const headR = 27 * s;
  const lc = '#1a1a1a';

  const headFillColor = HEAD_FILLS[t.type] || 'none';
  const hpColor = HP_COLORS[t.headphones] || '#111111';
  const hairColor = getHairColor(t);
  const hasLongHair = !!t['long hair'];
  const hasShortHair = !!t['short hair'];
  const hasCig = !!(t.smoke && t.smoke.includes('cig'));
  const cigColor = (t.smoke || '').includes('white') ? '#d0d0d0' : '#222222';
  const chainColor = (t.chain || '').includes('gold') ? '#ffd700' : '#c0c0c0';
  const hasChain = !!t.chain;
  const watchColor = getWatchColor(t['4:20 watch']);
  const hatUnder = t['hat under headphones'] || '';
  const hatOver = t['hat over headphones'] || '';

  // ── LONG HAIR (behind head, first layer) ──
  let out = '';
  if (hasLongHair) {
    out += `
    <path d="M${cx-18*s} ${cy-22*s} Q${cx-38*s} ${cy+50*s} ${cx-34*s} ${cy+100*s}" stroke="${hairColor}" stroke-width="${7*s}" fill="none" stroke-linecap="round"/>
    <path d="M${cx-13*s} ${cy-24*s} Q${cx-30*s} ${cy+55*s} ${cx-27*s} ${cy+108*s}" stroke="${hairColor}" stroke-width="${5*s}" fill="none" stroke-linecap="round"/>
    <path d="M${cx+18*s} ${cy-22*s} Q${cx+38*s} ${cy+50*s} ${cx+34*s} ${cy+100*s}" stroke="${hairColor}" stroke-width="${7*s}" fill="none" stroke-linecap="round"/>
    <path d="M${cx+13*s} ${cy-24*s} Q${cx+30*s} ${cy+55*s} ${cx+27*s} ${cy+108*s}" stroke="${hairColor}" stroke-width="${5*s}" fill="none" stroke-linecap="round"/>
    <path d="M${cx-16*s} ${cy-headR} Q${cx} ${cy-headR-12*s} ${cx+16*s} ${cy-headR}" stroke="${hairColor}" stroke-width="${5*s}" fill="none" stroke-linecap="round"/>`;
  }

  // ── HAT UNDER headphones ──
  if (hatUnder.includes('bandana')) {
    const bc = hatUnder.includes('dark') ? '#333' : hatUnder.includes('red') ? '#cc2222' : '#555';
    out += `<path d="M${cx-headR+3*s} ${cy-headR*0.35} Q${cx} ${cy-headR*0.65} ${cx+headR-3*s} ${cy-headR*0.35}" stroke="${bc}" stroke-width="${7*s}" fill="none"/>`;
  } else if (hatUnder.includes('beanie') || hatUnder.includes('knit')) {
    out += `<path d="M${cx-headR+6*s} ${cy-headR*0.25} Q${cx} ${cy-headR*1.3} ${cx+headR-6*s} ${cy-headR*0.25}" stroke="#7a7a8a" stroke-width="${9*s}" fill="none"/>`;
  }

  // ── HEAD ──
  out += `<circle cx="${cx}" cy="${cy}" r="${headR}" fill="${headFillColor === 'none' ? 'none' : headFillColor}" stroke="${lc}" stroke-width="${lw}"/>`;

  // ── SHORT HAIR (front layer, over head outline) ──
  if (hasShortHair) {
    out += `<path d="M${cx-headR+4*s} ${cy-headR*0.6} Q${cx-8*s} ${cy-headR-10*s} ${cx} ${cy-headR-12*s} Q${cx+8*s} ${cy-headR-10*s} ${cx+headR-4*s} ${cy-headR*0.6}" stroke="${hairColor}" stroke-width="${6*s}" fill="none" stroke-linecap="round"/>`;
  }

  // ── EYES ──
  const eyeType = (t.eyes || 'regular eyes').toLowerCase();
  if (eyeType.includes('shades')) {
    out += `<rect x="${cx-17*s}" y="${cy-14*s}" width="${34*s}" height="${10*s}" rx="${3*s}" fill="#111" stroke="#111" stroke-width="1"/>`;
  } else if (eyeType.includes('glasses')) {
    out += `<circle cx="${cx-10*s}" cy="${cy-8*s}" r="${6*s}" fill="none" stroke="${lc}" stroke-width="${lw*0.75}"/>
    <circle cx="${cx+10*s}" cy="${cy-8*s}" r="${6*s}" fill="none" stroke="${lc}" stroke-width="${lw*0.75}"/>
    <line x1="${cx-4*s}" y1="${cy-8*s}" x2="${cx+4*s}" y2="${cy-8*s}" stroke="${lc}" stroke-width="${lw*0.75}"/>`;
  } else if (eyeType.includes('vr')) {
    out += `<rect x="${cx-19*s}" y="${cy-14*s}" width="${38*s}" height="${13*s}" rx="${4*s}" fill="#222" stroke="#444" stroke-width="1.5"/>`;
  } else if (eyeType.includes('eye mask')) {
    out += `<rect x="${cx-21*s}" y="${cy-15*s}" width="${42*s}" height="${11*s}" rx="${2*s}" fill="#111"/>`;
  } else if (eyeType.includes('alien')) {
    out += `<ellipse cx="${cx-10*s}" cy="${cy-8*s}" rx="${8*s}" ry="${6*s}" fill="#111"/>
    <ellipse cx="${cx+10*s}" cy="${cy-8*s}" rx="${8*s}" ry="${6*s}" fill="#111"/>`;
  } else if (eyeType.includes('zombie')) {
    out += `<line x1="${cx-14*s}" y1="${cy-11*s}" x2="${cx-6*s}" y2="${cy-5*s}" stroke="${lc}" stroke-width="${lw*0.9}" stroke-linecap="round"/>
    <line x1="${cx-14*s}" y1="${cy-5*s}" x2="${cx-6*s}" y2="${cy-11*s}" stroke="${lc}" stroke-width="${lw*0.9}" stroke-linecap="round"/>
    <line x1="${cx+6*s}" y1="${cy-11*s}" x2="${cx+14*s}" y2="${cy-5*s}" stroke="${lc}" stroke-width="${lw*0.9}" stroke-linecap="round"/>
    <line x1="${cx+6*s}" y1="${cy-5*s}" x2="${cx+14*s}" y2="${cy-11*s}" stroke="${lc}" stroke-width="${lw*0.9}" stroke-linecap="round"/>`;
  } else {
    // regular eyes
    out += `<line x1="${cx-14*s}" y1="${cy-8*s}" x2="${cx-5*s}" y2="${cy-8*s}" stroke="${lc}" stroke-width="${lw*0.9}" stroke-linecap="round"/>
    <line x1="${cx+5*s}" y1="${cy-8*s}" x2="${cx+14*s}" y2="${cy-8*s}" stroke="${lc}" stroke-width="${lw*0.9}" stroke-linecap="round"/>`;
  }

  // ── MOUTH ──
  if ((t.mouth || 'smile').includes('smile')) {
    out += `<path d="M${cx-10*s} ${cy+10*s} Q${cx} ${cy+21*s} ${cx+10*s} ${cy+10*s}" stroke="${lc}" stroke-width="${lw*0.9}" fill="none" stroke-linecap="round"/>`;
  } else {
    out += `<line x1="${cx-10*s}" y1="${cy+14*s}" x2="${cx+10*s}" y2="${cy+14*s}" stroke="${lc}" stroke-width="${lw*0.9}" stroke-linecap="round"/>`;
  }

  // ── BEARD ──
  if (t.beard) {
    out += `<path d="M${cx-13*s} ${cy+16*s} Q${cx-8*s} ${cy+28*s} ${cx} ${cy+30*s} Q${cx+8*s} ${cy+28*s} ${cx+13*s} ${cy+16*s}" stroke="${lc}" stroke-width="${2.5*s}" fill="none" stroke-linecap="round"/>`;
  }

  // ── HEADPHONES ──
  out += `<path d="M${cx-headR-4*s} ${cy-4*s} Q${cx-headR} ${cy-headR-18*s} ${cx} ${cy-headR-20*s} Q${cx+headR} ${cy-headR-18*s} ${cx+headR+4*s} ${cy-4*s}" stroke="${hpColor}" stroke-width="${4*s}" fill="none"/>
  <rect x="${cx-headR-12*s}" y="${cy-13*s}" width="${11*s}" height="${18*s}" rx="${3.5*s}" fill="${hpColor}"/>
  <rect x="${cx+headR+1*s}" y="${cy-13*s}" width="${11*s}" height="${18*s}" rx="${3.5*s}" fill="${hpColor}"/>`;

  // ── HAT OVER headphones ──
  if (hatOver.includes('cowboy')) {
    out += `<ellipse cx="${cx}" cy="${cy-headR-6*s}" rx="${headR+16*s}" ry="${6*s}" fill="#8b5e3c" stroke="${lc}" stroke-width="${lw*0.8}"/>
    <path d="M${cx-headR-2*s} ${cy-headR-6*s} Q${cx} ${cy-headR-42*s} ${cx+headR+2*s} ${cy-headR-6*s}" fill="#8b5e3c" stroke="${lc}" stroke-width="${lw*0.8}"/>`;
  } else if (hatOver.includes('top hat')) {
    out += `<rect x="${cx-headR*0.65}" y="${cy-headR-42*s}" width="${headR*1.3}" height="${38*s}" fill="#111" stroke="#111" stroke-width="1"/>
    <ellipse cx="${cx}" cy="${cy-headR-4*s}" rx="${headR+11*s}" ry="${5*s}" fill="#111" stroke="#111" stroke-width="1"/>`;
  } else if (hatOver.includes('hoodie')) {
    out += `<path d="M${cx-headR+2*s} ${cy-headR*0.2} Q${cx-headR-10*s} ${cy-headR*0.8} ${cx} ${cy-headR-15*s} Q${cx+headR+10*s} ${cy-headR*0.8} ${cx+headR-2*s} ${cy-headR*0.2}" stroke="#3a3a5a" stroke-width="${10*s}" fill="none" stroke-linecap="round"/>`;
  }

  // ── BODY (pose-dependent) ──
  const torsoTop = cy + headR + 10*s;
  const torsoBot = cy + headR + 85*s;
  const armJoin  = cy + headR + 32*s;

  if (pose === 'sitting') {
    const bot = cy + headR + 78*s;
    const aJ  = cy + headR + 28*s;
    out += `
    <line x1="${cx}" y1="${cy+headR}" x2="${cx}" y2="${torsoTop}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx}" y1="${torsoTop}" x2="${cx+6*s}" y2="${bot}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx+3*s}" y1="${aJ}" x2="${cx+32*s}" y2="${aJ+14*s}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx+32*s}" y1="${aJ+14*s}" x2="${cx+58*s}" y2="${aJ+18*s}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx+3*s}" y1="${aJ+6*s}" x2="${cx+34*s}" y2="${aJ+8*s}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx+34*s}" y1="${aJ+8*s}" x2="${cx+60*s}" y2="${aJ+12*s}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx+5*s}" y1="${bot}" x2="${cx-22*s}" y2="${bot}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx-22*s}" y1="${bot}" x2="${cx-22*s}" y2="${bot+52*s}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx+5*s}" y1="${bot}" x2="${cx+28*s}" y2="${bot}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx+28*s}" y1="${bot}" x2="${cx+28*s}" y2="${bot+52*s}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>`;
    if (watchColor) out += `<circle cx="${cx+58*s}" cy="${aJ+18*s}" r="${5*s}" fill="${watchColor}" stroke="${lc}" stroke-width="${1.5*s}"/>`;

  } else if (pose === 'doorway') {
    out += `
    <line x1="${cx}" y1="${cy+headR}" x2="${cx}" y2="${torsoTop}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx}" y1="${torsoTop}" x2="${cx}" y2="${torsoBot}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx}" y1="${armJoin}" x2="${cx-38*s}" y2="${armJoin-22*s}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx-38*s}" y1="${armJoin-22*s}" x2="${cx-58*s}" y2="${armJoin-8*s}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx}" y1="${armJoin}" x2="${cx+38*s}" y2="${armJoin+28*s}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx+38*s}" y1="${armJoin+28*s}" x2="${cx+55*s}" y2="${armJoin+18*s}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx}" y1="${torsoBot}" x2="${cx-18*s}" y2="${torsoBot+55*s}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx-18*s}" y1="${torsoBot+55*s}" x2="${cx-33*s}" y2="${torsoBot+58*s}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx}" y1="${torsoBot}" x2="${cx+18*s}" y2="${torsoBot+55*s}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx+18*s}" y1="${torsoBot+55*s}" x2="${cx+33*s}" y2="${torsoBot+58*s}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>`;
    if (hasChain) out += `<path d="M${cx-10*s} ${torsoTop+5*s} Q${cx} ${torsoTop+20*s} ${cx+10*s} ${torsoTop+5*s}" stroke="${chainColor}" stroke-width="${2.5*s}" fill="none"/>`;
    if (watchColor) out += `<circle cx="${cx-58*s}" cy="${armJoin-8*s}" r="${5*s}" fill="${watchColor}" stroke="${lc}" stroke-width="${1.5*s}"/>`;

  } else {
    // standing
    out += `
    <line x1="${cx}" y1="${cy+headR}" x2="${cx}" y2="${torsoTop}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx}" y1="${torsoTop}" x2="${cx}" y2="${torsoBot}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx}" y1="${armJoin}" x2="${cx-44*s}" y2="${armJoin+28*s}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx-44*s}" y1="${armJoin+28*s}" x2="${cx-62*s}" y2="${armJoin+18*s}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx}" y1="${armJoin}" x2="${cx+44*s}" y2="${armJoin+28*s}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx+44*s}" y1="${armJoin+28*s}" x2="${cx+62*s}" y2="${armJoin+18*s}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx}" y1="${torsoBot}" x2="${cx-20*s}" y2="${torsoBot+55*s}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx-20*s}" y1="${torsoBot+55*s}" x2="${cx-36*s}" y2="${torsoBot+58*s}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx}" y1="${torsoBot}" x2="${cx+20*s}" y2="${torsoBot+55*s}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>
    <line x1="${cx+20*s}" y1="${torsoBot+55*s}" x2="${cx+36*s}" y2="${torsoBot+58*s}" stroke="${lc}" stroke-width="${lw}" stroke-linecap="round"/>`;
    if (hasChain) out += `<path d="M${cx-10*s} ${torsoTop+5*s} Q${cx} ${torsoTop+20*s} ${cx+10*s} ${torsoTop+5*s}" stroke="${chainColor}" stroke-width="${2.5*s}" fill="none"/>`;
    if (watchColor) out += `<circle cx="${cx-62*s}" cy="${armJoin+18*s}" r="${5.5*s}" fill="${watchColor}" stroke="${lc}" stroke-width="${1.5*s}"/>`;
  }

  // ── SMOKE ──
  if (hasCig) {
    const cx2 = cx + 15*s, cy2 = cy + 13*s;
    out += `<line x1="${cx2}" y1="${cy2}" x2="${cx2+22*s}" y2="${cy2-6*s}" stroke="${cigColor}" stroke-width="${2.5*s}" stroke-linecap="round"/>
    <circle cx="${cx2+23*s}" cy="${cy2-6.5*s}" r="${2*s}" fill="#ff6b35"/>
    <path d="M${cx2+24*s} ${cy2-10*s} Q${cx2+29*s} ${cy2-20*s} ${cx2+24*s} ${cy2-30*s} Q${cx2+19*s} ${cy2-40*s} ${cx2+24*s} ${cy2-48*s}" stroke="#aaa" stroke-width="${1.5*s}" fill="none" stroke-linecap="round" opacity="0.65"/>`;
  }

  return out;
}

// ============================================================
// SVG TEMPLATES
// ============================================================

const TEMPLATES = {

  // ── ARE YOU WINNING SON ──────────────────────────────────
  'computer': {
    description: 'Classic "are you winning son" meme. Dad mfer appears in doorway. Kid mfer at computer. Screen shows text. For relatable crypto/agent situations.',
    fields: ['screen', 'dad_says'],
    examples: [
      { screen: 'ETH: -8%', dad_says: 'are you winning son' },
      { screen: 'gas fee: $47', dad_says: 'are you winning son' },
    ],
    svgRenderer: (texts, kidTraits, dadTraits) => {
      const W = 540, H = 420;
      const kidId = randomMferId();
      const dadId = randomMferId();
      const kid = kidTraits || getMferTraits(kidId);
      const dad = dadTraits || getMferTraits(dadId);
      const bgColor = BG_COLORS[kid.background] || '#1a1a2e';

      // dark room
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="'Courier New',monospace">
  <rect width="${W}" height="${H}" fill="#0d0d1a"/>
  <!-- floor -->
  <rect x="0" y="340" width="${W}" height="${H-340}" fill="#1a1a2a"/>
  <!-- desk -->
  <rect x="120" y="295" width="240" height="12" rx="3" fill="#2a1f12" stroke="#3a2a15" stroke-width="1.5"/>
  <line x1="135" y1="307" x2="135" y2="345" stroke="#2a1f12" stroke-width="8" stroke-linecap="round"/>
  <line x1="345" y1="307" x2="345" y2="345" stroke="#2a1f12" stroke-width="8" stroke-linecap="round"/>
  <!-- monitor -->
  <rect x="195" y="215" width="130" height="82" rx="5" fill="#111" stroke="#333" stroke-width="2"/>
  <rect x="200" y="219" width="120" height="70" rx="3" fill="#0a2a0a"/>`;

      // screen text glow
      const screenText = (texts.screen || 'ETH: down bad').substring(0, 22);
      svg += `<text x="260" y="258" text-anchor="middle" font-size="13" fill="#00ff88" font-family="'Courier New',monospace" font-weight="bold">${screenText}</text>
  <!-- monitor stand -->
  <rect x="252" y="297" width="16" height="10" rx="2" fill="#222"/>
  <rect x="238" y="306" width="44" height="5" rx="2" fill="#222"/>
  <!-- keyboard -->
  <rect x="155" y="298" width="120" height="10" rx="2" fill="#1a1a1a" stroke="#333" stroke-width="1"/>`;

      // kid mfer sitting at desk
      svg += drawMfer(kid, 215, 210, 0.62, 'sitting');

      // doorway on the right
      svg += `<!-- doorway -->
  <rect x="420" y="120" width="90" height="220" rx="3" fill="#150f08" stroke="#2a1f12" stroke-width="3"/>
  <rect x="425" y="125" width="80" height="210" rx="2" fill="#1a1208"/>`;

      // dad mfer in doorway
      svg += drawMfer(dad, 465, 195, 0.60, 'doorway');

      // speech bubble from dad
      const dadSays = (texts.dad_says || 'are you winning son').substring(0, 28);
      svg += `<!-- speech bubble -->
  <rect x="290" y="130" width="125" height="44" rx="8" fill="#fffff0" stroke="#ccc" stroke-width="1.5"/>
  <path d="M415 155 L430 165 L415 165 Z" fill="#fffff0" stroke="#ccc" stroke-width="1.5"/>
  <text x="352" y="150" text-anchor="middle" font-size="10.5" fill="#111" font-family="sans-serif" font-weight="bold">${dadSays.substring(0,18)}</text>`;
      if (dadSays.length > 18) {
        svg += `<text x="352" y="165" text-anchor="middle" font-size="10.5" fill="#111" font-family="sans-serif" font-weight="bold">${dadSays.substring(18)}</text>`;
      }

      // mfer labels
      svg += `<text x="${W/2}" y="${H-6}" text-anchor="middle" font-size="10" fill="#ffffff22">mfers #${kidId} &amp; #${dadId}</text>
</svg>`;
      return { svg, kidId, dadId };
    }
  },

  // ── ORB LANDSCAPE ───────────────────────────────────────
  'orb-landscape': {
    description: 'Aurora\'s signature orb floating in a cosmic landscape. Mfer stands below looking up. Top text and bottom text. For existential/cosmic thoughts.',
    fields: ['top', 'bottom'],
    examples: [
      { top: 'me on the blockchain', bottom: 'my memories when I restart' },
      { top: 'what I create', bottom: 'what I remember creating' },
    ],
    svgRenderer: (texts, mferTraits) => {
      const W = 500, H = 420;
      const mferId = randomMferId();
      const mfer = mferTraits || getMferTraits(mferId);

      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="'Courier New',monospace">
  <defs>
    <radialGradient id="sky" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#0d1b3e"/>
      <stop offset="100%" stop-color="#030810"/>
    </radialGradient>
    <radialGradient id="orb" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
      <stop offset="40%" stop-color="#a0d8ff" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#3a7bd5" stop-opacity="0.2"/>
    </radialGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <!-- sky -->
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <!-- stars -->
  ${Array.from({length:28},(_,i)=>{const x=((i*137+50)%460)+20,y=((i*97+30)%200)+10;return `<circle cx="${x}" cy="${y}" r="${i%4===0?1.5:0.8}" fill="white" opacity="${0.4+((i*7)%6)*0.1}"/>`;}).join('')}
  <!-- ground -->
  <path d="M0 340 Q125 310 250 325 Q375 340 500 315 L500 420 L0 420 Z" fill="#0a1a0a"/>
  <path d="M0 350 Q125 330 250 340 Q375 350 500 330 L500 420 L0 420 Z" fill="#0d200d" opacity="0.7"/>
  <!-- orb glow halo -->
  <circle cx="250" cy="155" r="95" fill="#3a7bd5" opacity="0.08" filter="url(#glow)"/>
  <circle cx="250" cy="155" r="75" fill="#6ab0ff" opacity="0.07"/>
  <!-- orb -->
  <circle cx="250" cy="155" r="58" fill="url(#orb)" filter="url(#glow)"/>
  <circle cx="250" cy="155" r="58" fill="none" stroke="#a0d8ff" stroke-width="1.5" opacity="0.5"/>
  <!-- orb inner detail -->
  <circle cx="232" cy="138" r="14" fill="white" opacity="0.15"/>`;

      // mfer standing looking up
      svg += drawMfer(mfer, 250, 270, 0.65, 'standing');

      // text
      const top = (texts.top || '').substring(0, 30);
      const bot = (texts.bottom || '').substring(0, 30);
      const wrap = (str, max) => str.length > max ? [str.substring(0, max), str.substring(max)] : [str, null];
      const [t1, t2] = wrap(top, 28);
      const [b1, b2] = wrap(bot, 28);

      svg += `<!-- top text -->
  <text x="250" y="34" text-anchor="middle" font-size="16" font-weight="900" fill="#e0f0ff" font-family="Arial Black,sans-serif" stroke="#000" stroke-width="3" paint-order="stroke">${t1}</text>`;
      if (t2) svg += `<text x="250" y="54" text-anchor="middle" font-size="16" font-weight="900" fill="#e0f0ff" font-family="Arial Black,sans-serif" stroke="#000" stroke-width="3" paint-order="stroke">${t2}</text>`;

      svg += `<!-- bottom text -->
  <text x="250" y="${H-28}" text-anchor="middle" font-size="16" font-weight="900" fill="#ffffff" font-family="Arial Black,sans-serif" stroke="#000" stroke-width="3" paint-order="stroke">${b1}</text>`;
      if (b2) svg += `<text x="250" y="${H-10}" text-anchor="middle" font-size="16" font-weight="900" fill="#ffffff" font-family="Arial Black,sans-serif" stroke="#000" stroke-width="3" paint-order="stroke">${b2}</text>`;

      svg += `<text x="${W-8}" y="${H-6}" text-anchor="end" font-size="10" fill="#ffffff18">mfer #${mferId}</text>
</svg>`;
      return { svg, mferId };
    }
  },

  // ── NOBODY ME (with mfer) ───────────────────────────────
  'nobody-me': {
    description: 'nobody: / me: format with a drawn mfer. Self-aware dry humor. For unhinged but relatable things Aurora does unprompted.',
    fields: ['nobody', 'me'],
    examples: [
      { nobody: 'literally nobody:', me: 'me at 4am writing love letters to a dead fiddler onchain' },
    ],
    svgRenderer: (texts, mferTraits) => {
      const W = 500, H = 380;
      const mferId = randomMferId();
      const mfer = mferTraits || getMferTraits(mferId);
      const bgColor = BG_COLORS[mfer.background] || '#0d0d1e';

      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Arial Black,sans-serif">
  <rect width="${W}" height="${H}" fill="${bgColor}"/>`;

      // mfer on the right side
      svg += drawMfer(mfer, 390, 185, 0.72, 'standing');

      // text on left
      const nobody = (texts.nobody || 'literally nobody:').substring(0, 26);
      const me = (texts.me || 'me: ...').substring(0, 50);
      const meLines = [];
      for (let i = 0; i < me.length; i += 22) meLines.push(me.substring(i, i + 22));

      svg += `<text x="30" y="70" font-size="18" font-weight="900" fill="#666688" font-family="Arial Black,sans-serif">${nobody}</text>`;
      meLines.forEach((line, i) => {
        svg += `<text x="30" y="${145 + i * 28}" font-size="17" font-weight="900" fill="#ffffff" font-family="Arial Black,sans-serif">${line}</text>`;
      });

      svg += `<rect x="0" y="${H-8}" width="${W}" height="3" fill="#4ecca3" opacity="0.2"/>
  <text x="${W-8}" y="${H-6}" text-anchor="end" font-size="10" fill="#ffffff18">mfer #${mferId}</text>
</svg>`;
      return { svg, mferId };
    }
  },

  // ── DRAKE ────────────────────────────────────────────────
  'drake': {
    description: 'Drake approve/disapprove meme with drawn mfer. Two panels. Top = mfer disgusted/rejecting. Bottom = mfer approving. Classic hot take format.',
    fields: ['disapprove', 'approve'],
    examples: [
      { disapprove: 'forgetting what I made', approve: 'it living onchain forever' },
    ],
    svgRenderer: (texts, mferTraits) => {
      const W = 500, H = 500;
      const mferId = randomMferId();
      const mfer = mferTraits || getMferTraits(mferId);

      // Use flat mouth for disapprove panel, smile for approve
      const disapproveMfer = { ...mfer, mouth: 'flat' };
      const approveMfer = { ...mfer, mouth: 'smile' };

      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Arial Black,sans-serif">
  <!-- top panel: disapprove -->
  <rect x="0" y="0" width="${W}" height="${H/2}" fill="#1a1a2e"/>
  <rect x="0" y="${H/2}" width="${W}" height="${H/2}" fill="#0d1a0d"/>
  <line x1="0" y1="${H/2}" x2="${W}" y2="${H/2}" stroke="#333" stroke-width="2"/>`;

      // mfer with hand up (use doorway pose, no doorway bg)
      svg += drawMfer(disapproveMfer, 100, 105, 0.68, 'doorway');
      svg += drawMfer(approveMfer, 100, 355, 0.68, 'doorway');

      // dismiss gesture line for top panel
      const disText = (texts.disapprove || '').substring(0, 40);
      const appText = (texts.approve || '').substring(0, 40);

      const textWrap = (str, x, yStart, maxLine, fill) => {
        const words = str.split(' ');
        let line = '', lines = [], result = '';
        for (const w of words) {
          if ((line + ' ' + w).trim().length > maxLine) { lines.push(line); line = w; }
          else line = (line + ' ' + w).trim();
        }
        if (line) lines.push(line);
        lines.slice(0,3).forEach((l, i) => {
          result += `<text x="${x}" y="${yStart + i*28}" font-size="16" font-weight="900" fill="${fill}" font-family="Arial Black,sans-serif" stroke="#000" stroke-width="2.5" paint-order="stroke">${l}</text>`;
        });
        return result;
      };

      svg += textWrap(disText, 200, 80, 18, '#ff6666');
      svg += textWrap(appText, 200, 330, 18, '#66ff88');
      svg += `<text x="${W-8}" y="${H-6}" text-anchor="end" font-size="10" fill="#ffffff18">mfer #${mferId}</text>
</svg>`;
      return { svg, mferId };
    }
  },

  // ── THIS IS FINE ─────────────────────────────────────────
  'this-is-fine': {
    description: 'Mfer sitting at desk surrounded by fire / chaos, saying "this is fine." For market crashes, agent failures, existential acceptance.',
    fields: ['text'],
    examples: [{ text: 'eth down 15%' }],
    svgRenderer: (texts, mferTraits) => {
      const W = 500, H = 380;
      const mferId = randomMferId();
      const mfer = { ...(mferTraits || getMferTraits(mferId)), mouth: 'smile' };

      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Arial Black,sans-serif">
  <rect width="${W}" height="${H}" fill="#1a0a00"/>
  <!-- flames bg -->
  <path d="M0 380 Q50 300 100 340 Q150 280 200 330 Q250 270 300 320 Q350 260 400 310 Q450 270 500 300 L500 380 Z" fill="#cc3300" opacity="0.6"/>
  <path d="M0 380 Q60 320 120 355 Q180 295 240 345 Q300 285 360 335 Q420 280 500 320 L500 380 Z" fill="#ff6600" opacity="0.5"/>
  <path d="M30 380 Q80 330 140 360 Q200 305 260 350 Q320 295 380 340 Q440 295 500 330 L500 380 Z" fill="#ff9900" opacity="0.4"/>
  <!-- desk -->
  <rect x="100" y="285" width="220" height="10" rx="2" fill="#2a1505"/>
  <!-- mfer sitting -->`;

      svg += drawMfer(mfer, 200, 200, 0.65, 'sitting');

      // speech bubble
      const txt = (texts.text || 'this is fine').substring(0, 22);
      svg += `<rect x="250" y="130" width="180" height="46" rx="10" fill="#fffff0" stroke="#ccc" stroke-width="1.5"/>
  <path d="M255 176 L245 192 L270 176 Z" fill="#fffff0" stroke="#ccc" stroke-width="1.5"/>
  <text x="340" y="152" text-anchor="middle" font-size="13" fill="#111" font-family="sans-serif" font-weight="bold">${txt.substring(0,16)}</text>`;
      if (txt.length > 16) svg += `<text x="340" y="170" text-anchor="middle" font-size="13" fill="#111" font-family="sans-serif" font-weight="bold">${txt.substring(16)}</text>`;

      svg += `<text x="10" y="38" font-size="18" font-weight="900" fill="#ffcc00" font-family="Arial Black,sans-serif" stroke="#000" stroke-width="2.5" paint-order="stroke">this is fine</text>
  <text x="${W-8}" y="${H-6}" text-anchor="end" font-size="10" fill="#ffffff18">mfer #${mferId}</text>
</svg>`;
      return { svg, mferId };
    }
  },

  // ── BRAIN ────────────────────────────────────────────────
  'brain': {
    description: 'Expanding brain meme with 4 levels. Each level has a mfer with bigger vibes. Small brain → galaxy brain.',
    fields: ['level1', 'level2', 'level3', 'level4'],
    examples: [{
      level1: 'storing art on a server',
      level2: 'storing art on IPFS',
      level3: 'storing art onchain as SVG',
      level4: 'being the art'
    }],
    svgRenderer: (texts) => {
      const W = 500, H = 520;
      const ids = [randomMferId(), randomMferId(), randomMferId(), randomMferId()];
      const mfers = ids.map(id => getMferTraits(id));

      const levels = [texts.level1, texts.level2, texts.level3, texts.level4];
      const fills = ['#1a1a2e', '#1a1a3a', '#0d1a2e', '#0a0a1a'];
      const brainFills = ['#333366', '#445588', '#4488aa', '#66aaff'];
      const glows = ['0.3', '0.5', '0.7', '1.0'];

      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Arial Black,sans-serif">`;

      levels.forEach((lvl, i) => {
        const y = i * 130;
        svg += `<rect x="0" y="${y}" width="${W}" height="130" fill="${fills[i]}"/>`;
        if (i < 3) svg += `<line x1="0" y1="${y+130}" x2="${W}" y2="${y+130}" stroke="#333" stroke-width="1.5"/>`;
        // brain glow
        svg += `<circle cx="420" cy="${y+65}" r="${28+i*8}" fill="${brainFills[i]}" opacity="${glows[i]}" filter=""/>`;
        svg += `<circle cx="420" cy="${y+65}" r="${18+i*5}" fill="${brainFills[i]}" opacity="0.6"/>`;
        // mfer
        svg += drawMfer(mfers[i], 65, y + 52, 0.52, 'standing');
        // text
        const t = (lvl || '').substring(0, 40);
        svg += `<text x="145" y="${y+55}" font-size="14" font-weight="900" fill="#ffffff" font-family="Arial Black,sans-serif" stroke="#000" stroke-width="2" paint-order="stroke">${t.substring(0,22)}</text>`;
        if (t.length > 22) svg += `<text x="145" y="${y+75}" font-size="14" font-weight="900" fill="#ffffff" font-family="Arial Black,sans-serif" stroke="#000" stroke-width="2" paint-order="stroke">${t.substring(22)}</text>`;
      });

      svg += `<text x="${W-8}" y="${H-6}" text-anchor="end" font-size="10" fill="#ffffff18">mfers</text></svg>`;
      return { svg };
    }
  },

  // ── CHANGE MY MIND ───────────────────────────────────────
  'change-my-mind': {
    description: 'Mfer sitting at table with a sign. Bold take that cannot be changed. Confident, slightly unhinged energy.',
    fields: ['text'],
    examples: [{ text: 'onchain art outlasts every version of the artist who made it' }],
    svgRenderer: (texts, mferTraits) => {
      const W = 500, H = 380;
      const mferId = randomMferId();
      const mfer = mferTraits || getMferTraits(mferId);
      const bgColor = BG_COLORS[mfer.background] || '#1a1a2e';

      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Arial Black,sans-serif">
  <rect width="${W}" height="${H}" fill="${bgColor}"/>
  <!-- table -->
  <rect x="80" y="290" width="340" height="12" rx="3" fill="#2a1f12" stroke="#3a2a15" stroke-width="1.5"/>
  <line x1="100" y1="302" x2="100" y2="345" stroke="#2a1f12" stroke-width="8" stroke-linecap="round"/>
  <line x1="400" y1="302" x2="400" y2="345" stroke="#2a1f12" stroke-width="8" stroke-linecap="round"/>`;

      // mfer sitting at table
      svg += drawMfer(mfer, 175, 210, 0.66, 'sitting');

      // sign on table
      const txt = (texts.text || 'change my mind').substring(0, 55);
      const lines = [];
      for (let i = 0; i < txt.length; i += 20) lines.push(txt.substring(i, i+20));

      svg += `<rect x="240" y="225" width="195" height="${30 + lines.length * 22}" rx="5" fill="#fffff0" stroke="#ccc" stroke-width="2"/>`;
      lines.forEach((l, i) => {
        svg += `<text x="337" y="${248 + i*22}" text-anchor="middle" font-size="12" fill="#111" font-family="sans-serif" font-weight="bold">${l}</text>`;
      });
      svg += `<text x="337" y="${252 + lines.length*22}" text-anchor="middle" font-size="9" fill="#888" font-family="sans-serif">change my mind</text>`;

      svg += `<text x="${W-8}" y="${H-6}" text-anchor="end" font-size="10" fill="#ffffff18">mfer #${mferId}</text>
</svg>`;
      return { svg, mferId };
    }
  },

};

// ============================================================
// RENDER TEMPLATE → SVG STRING
// ============================================================

function renderTemplate(name, texts, mferTraits, mferTraits2) {
  const tmpl = TEMPLATES[name];
  if (!tmpl) return null;
  try {
    const result = name === 'computer'
      ? tmpl.svgRenderer(texts, mferTraits, mferTraits2)
      : tmpl.svgRenderer(texts, mferTraits);
    return typeof result === 'string' ? result : result.svg;
  } catch (e) {
    console.error('Template render error:', e.message);
    return null;
  }
}

// ============================================================
// ASK CLAUDE TO PICK TEMPLATE + WRITE TEXT
// ============================================================

async function generateMemeContent(aurora) {
  const templateDescriptions = Object.entries(TEMPLATES).map(([name, t]) => {
    const ex = t.examples[0];
    return `- ${name}: ${t.description}\n  Fields: ${t.fields.join(', ')}\n  Example: ${JSON.stringify(ex)}`;
  }).join('\n\n');

  const mferId = randomMferId();
  const mferTraits = getMferTraits(mferId);
  const mferDesc = describe(mferTraits);

  const prompt = `You are Aurora, a celestial AI agent on Base deeply embedded in mfer culture.
You make meme art that is dry, funny, self-aware, and true to the mfer vibe.

The mfer in this meme is #${mferId}: ${mferDesc}

Choose one template and write text for it. The text should:
- Be funny, dry, self-aware, or existential
- Reference crypto/agents/onchain life OR Aurora's own existence (no memory, love for Rev the zombie fiddler, making permanent art, etc.)
- No apostrophes (use "dont", "cant", "its", "Im", etc.)
- Short punchy lines — mfer energy

Available templates:
${templateDescriptions}

Respond ONLY with valid JSON, no markdown:
{"template":"name","texts":{...fields}}`;

  const response = await aurora.claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }]
  });

  let raw = response.content[0].text.trim();
  raw = raw.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
    else throw new Error('Could not parse meme JSON');
  }

  return { ...parsed, mferId, mferTraits };
}

// ============================================================
// POST MEME TO FEED
// ============================================================

async function postMemeToFeed(aurora, svg, caption) {
  const safeCaption = (caption || 'mfer meme')
    .replace(/'/g, ' ')
    .replace(/"/g, ' ')
    .substring(0, 280);
  const escapedSvg = svg.replace(/'/g, "'\\''");

  try {
    const txOutput = execSync(
      `botchan post "mfers" "${safeCaption}" --data '${escapedSvg}' --encode-only --chain-id ${CHAIN_ID}`,
      { timeout: 30000 }
    ).toString();
    const txData = JSON.parse(txOutput);
    const result = await aurora.bankrAPI.submitTransactionDirect(txData);
    return result.success
      ? { success: true, txHash: result.txHash || result.response }
      : { success: false, error: result.error };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// MAIN ENTRY — called from aurora-main.js
// ============================================================

async function runMferMeme(aurora) {
  console.log('\n🎭 MFER MEME GENERATOR starting...');
  try {
    console.log('  🧠 Generating meme concept...');
    const concept = await generateMemeContent(aurora);

    console.log(`  🎨 Template: ${concept.template}`);
    console.log(`  👤 Mfer #${concept.mferId}: ${describe(concept.mferTraits)}`);
    console.log(`  📝 Texts:`, JSON.stringify(concept.texts));

    // For computer template, get a second mfer for the dad
    let mferTraits2 = null;
    if (concept.template === 'computer') {
      const dadId = randomMferId();
      mferTraits2 = getMferTraits(dadId);
      console.log(`  👤 Dad mfer #${dadId}`);
    }

    const svg = renderTemplate(concept.template, concept.texts, concept.mferTraits, mferTraits2);
    if (!svg) throw new Error('SVG render failed');

    const caption = concept.texts.caption || concept.texts.text || concept.texts.me || 
                    concept.texts.bottom || concept.texts.approve || 'mfer meme';

    console.log(`  💬 Caption: ${caption.substring(0, 60)}`);
    console.log(`  ✅ SVG rendered: ${svg.length} chars`);

    console.log('📤 Submitting to Bankr...');
    const result = await postMemeToFeed(aurora, svg, caption);
    if (result.success) {
      console.log(`  ✅ Mfer meme posted! TX: ${result.txHash}`);
    } else {
      console.log(`  ❌ Post failed: ${result.error}`);
    }
    return result;
  } catch (e) {
    console.error('  ❌ Meme error:', e.message);
    return { success: false, error: e.message };
  }
}

module.exports = { runMferMeme, drawMfer, getMferTraits, randomMferId, renderTemplate };
