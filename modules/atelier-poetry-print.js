// Atelier Poetry Print — orb landscape + poem text overlay
// Aurora's signature: cosmic backdrop, poem centered in the void

function wrapPoetryLines(text, maxChars = 34) {
  // Split on actual line breaks first (poet may use intentional line breaks)
  const stanzaLines = text.split('\n').filter(l => l.trim());
  const result = [];
  for (const stanzaLine of stanzaLines) {
    const words = stanzaLine.trim().split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (test.length > maxChars) {
        if (line) result.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) result.push(line);
  }
  return result;
}

function renderPoetryPrint(poemText, title = '') {
  const W = 460, H = 500;

  const palettes = [
    { bg1:'#030308', bg2:'#080d20', bg3:'#040408', orb1:'#ffffff', orb2:'#6699ff', orb3:'#1133aa', mtn:'#060614', water:'#040408', text:'#e8f0ff' },
    { bg1:'#080302', bg2:'#150a04', bg3:'#060302', orb1:'#fff5d0', orb2:'#ffcc55', orb3:'#994400', mtn:'#100805', water:'#060302', text:'#fff8e8' },
    { bg1:'#030a07', bg2:'#081508', bg3:'#030605', orb1:'#d0ffee', orb2:'#33ffaa', orb3:'#005533', mtn:'#050c06', water:'#030605', text:'#e0fff4' },
    { bg1:'#080310', bg2:'#120820', bg3:'#060310', orb1:'#f5e0ff', orb2:'#cc77ff', orb3:'#660099', mtn:'#0a0618', water:'#060310', text:'#f0e0ff' },
  ];
  const pal = palettes[Math.floor(Math.random() * palettes.length)];

  const stars = Array.from({length: 44}, (_, i) => {
    const x = ((i*151+37)%430)+15, y = ((i*97+13)%210)+5;
    const r = i%6===0?1.6:i%3===0?1.0:0.6;
    const op = (0.2+((i*13)%9)*0.08).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="white" opacity="${op}"/>`;
  }).join('');

  // Poem lines
  const lines = wrapPoetryLines(poemText, 36);
  const lineHeight = 22;
  const totalTextH = lines.length * lineHeight;
  const textStartY = Math.round((H * 0.45) - (totalTextH / 2));

  const poemSvg = lines.map((l, i) =>
    `<text x="230" y="${textStartY + i * lineHeight}" text-anchor="middle" font-size="13" fill="${pal.text}" font-family="Georgia,serif" font-style="italic" opacity="0.92" xml:space="preserve"> ${l} </text>`
  ).join('\n  ');

  // Title line
  const titleSvg = title
    ? `<text x="230" y="${textStartY - 22}" text-anchor="middle" font-size="11" fill="${pal.orb2}" font-family="Arial,sans-serif" letter-spacing="2" opacity="0.7">${title.toUpperCase()}</text>`
    : '';

  // Signature
  const sigSvg = `<text x="230" y="${H - 8}" text-anchor="middle" font-size="9" fill="${pal.orb2}" font-family="Arial,sans-serif" opacity="0.5">Aurora ✦ onchain poet</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="ppbg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${pal.bg1}"/>
      <stop offset="60%" stop-color="${pal.bg2}"/>
      <stop offset="100%" stop-color="${pal.bg3}"/>
    </linearGradient>
    <radialGradient id="pprg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${pal.orb1}" stop-opacity="0.85"/>
      <stop offset="30%" stop-color="${pal.orb2}" stop-opacity="0.5"/>
      <stop offset="65%" stop-color="${pal.orb3}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${pal.orb3}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="pptext" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${pal.orb3}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${pal.orb3}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#ppbg)"/>
  ${stars}
  <!-- Orb glow halo -->
  <circle cx="230" cy="175" r="110" fill="url(#pptext)"/>
  <circle cx="230" cy="175" r="78" fill="${pal.orb3}" opacity="0.07"/>
  <circle cx="230" cy="175" r="55" fill="url(#pprg)"/>
  <circle cx="216" cy="160" r="15" fill="white" opacity="0.13"/>
  <circle cx="220" cy="164" r="7" fill="white" opacity="0.2"/>
  <!-- Mountains -->
  <path d="M0 370 L55 310 L108 340 L162 282 L218 326 L230 298 L242 326 L298 280 L352 318 L408 292 L460 316 L460 370 Z" fill="${pal.mtn}"/>
  <path d="M0 384 L40 348 L88 365 L138 335 L188 354 L230 332 L272 354 L322 333 L372 352 L420 338 L460 350 L460 384 Z" fill="${pal.mtn}" opacity="0.6"/>
  <rect x="0" y="384" width="${W}" height="${H - 384}" fill="${pal.water}"/>
  <ellipse cx="230" cy="428" rx="50" ry="10" fill="${pal.orb2}" opacity="0.1"/>
  <!-- Poem text -->
  ${titleSvg}
  ${poemSvg}
  ${sigSvg}
</svg>`;

  return svg;
}

module.exports = { renderPoetryPrint };
