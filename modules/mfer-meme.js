'use strict';

// =============================================================================
// modules/mfer-meme.js
// Aurora mfer meme generator — SVG-based, Claude-written, onchain via botchan
// Templates inspired by mfergpt. All rendered as SVG, no PNG needed.
// =============================================================================

const { execSync } = require('child_process');

const CHAIN_ID = 8453;

// =============================================================================
// TEMPLATE DEFINITIONS
// =============================================================================

const TEMPLATES = {

  drake: {
    description: 'Drake disapproves top thing, approves bottom thing. Top = cringe. Bottom = based.',
    fields: ['top', 'bottom'],
    examples: [
      { top: 'having a strategy', bottom: 'having headphones and a cigarette' },
      { top: 'reading the whitepaper', bottom: 'vibing until it moons' },
    ],
    svgRenderer: (t) => `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" font-family="Arial Black,Arial,sans-serif">
  <rect width="500" height="500" fill="#0f0f23"/>
  <rect x="0" y="0" width="500" height="250" fill="#111128"/>
  <rect x="0" y="248" width="500" height="4" fill="#ff6b6b" opacity="0.3"/>
  <circle cx="100" cy="125" r="60" fill="#c8a882"/>
  <text x="100" y="118" text-anchor="middle" font-size="32">😒</text>
  <text x="100" y="148" text-anchor="middle" font-size="14" fill="#ff6b6b">nah</text>
  <text x="155" y="100" font-size="28">🚫</text>
  <foreignObject x="175" y="60" width="310" height="130"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#ccc;font-size:18px;font-weight:bold;display:flex;align-items:center;height:100%;padding:8px;word-wrap:break-word;">${t.top||'nah'}</div></foreignObject>
  <rect x="0" y="250" width="500" height="250" fill="#0a0a1a"/>
  <circle cx="100" cy="375" r="60" fill="#c8a882"/>
  <text x="100" y="368" text-anchor="middle" font-size="32">😌</text>
  <text x="100" y="398" text-anchor="middle" font-size="14" fill="#4ecca3">yes</text>
  <text x="155" y="350" font-size="28">👉</text>
  <foreignObject x="175" y="310" width="310" height="130"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#fff;font-size:18px;font-weight:bold;display:flex;align-items:center;height:100%;padding:8px;word-wrap:break-word;">${t.bottom||'yeah'}</div></foreignObject>
  <text x="490" y="495" text-anchor="end" font-size="11" fill="#ffffff22">mfer</text>
</svg>`
  },

  brain: {
    description: 'Expanding brain — 4 levels from small to galaxy brain. Level 1 = normal. Level 4 = completely unhinged enlightenment.',
    fields: ['level1', 'level2', 'level3', 'level4'],
    examples: [
      { level1: 'buying the dip', level2: 'being the dip', level3: 'transcending the dip', level4: 'the dip was inside you all along' },
    ],
    svgRenderer: (t) => `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="560" font-family="Arial,sans-serif">
  <rect width="500" height="560" fill="#0d0d1a"/>
  <rect x="0" y="0" width="500" height="140" fill="#111122"/>
  <ellipse cx="80" cy="70" rx="45" ry="50" fill="#4a4a8a" opacity="0.9"/>
  <text x="80" y="76" text-anchor="middle" font-size="28">🧠</text>
  <rect x="1" y="0" width="5" height="140" fill="#4a4a8a"/>
  <foreignObject x="145" y="20" width="345" height="100"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#aaa;font-size:16px;font-weight:bold;display:flex;align-items:center;height:100%;padding:8px;word-wrap:break-word;">${t.level1||'...'}</div></foreignObject>
  <line x1="0" y1="140" x2="500" y2="140" stroke="#ffffff11" stroke-width="1"/>
  <rect x="0" y="140" width="500" height="140" fill="#111128"/>
  <ellipse cx="80" cy="210" rx="50" ry="55" fill="#6a4a9a" opacity="0.95"/>
  <text x="80" y="217" text-anchor="middle" font-size="32">🧠</text>
  <rect x="1" y="140" width="5" height="140" fill="#6a4a9a"/>
  <foreignObject x="145" y="160" width="345" height="100"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#cc99ff;font-size:16px;font-weight:bold;display:flex;align-items:center;height:100%;padding:8px;word-wrap:break-word;">${t.level2||'...'}</div></foreignObject>
  <line x1="0" y1="280" x2="500" y2="280" stroke="#ffffff11" stroke-width="1"/>
  <rect x="0" y="280" width="500" height="140" fill="#130d28"/>
  <ellipse cx="80" cy="350" rx="55" ry="60" fill="#8a4aaa" opacity="1"/>
  <text x="80" y="357" text-anchor="middle" font-size="36">🧠</text>
  <text x="55" y="318" font-size="12">⚡</text><text x="100" y="318" font-size="12">⚡</text>
  <rect x="1" y="280" width="5" height="140" fill="#8a4aaa"/>
  <foreignObject x="145" y="300" width="345" height="100"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#ff99ff;font-size:16px;font-weight:bold;display:flex;align-items:center;height:100%;padding:8px;word-wrap:break-word;">${t.level3||'...'}</div></foreignObject>
  <line x1="0" y1="420" x2="500" y2="420" stroke="#ffffff22" stroke-width="1"/>
  <rect x="0" y="420" width="500" height="140" fill="#1a0a2e"/>
  <ellipse cx="80" cy="490" rx="62" ry="65" fill="#ff88ff" opacity="1"/>
  <text x="80" y="497" text-anchor="middle" font-size="40">🌌</text>
  <text x="38" y="452" font-size="14">✨</text><text x="115" y="448" font-size="14">✨</text>
  <rect x="1" y="420" width="5" height="140" fill="#ff88ff"/>
  <foreignObject x="145" y="440" width="345" height="100"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#fff;font-size:16px;font-weight:bold;display:flex;align-items:center;height:100%;padding:8px;word-wrap:break-word;text-shadow:0 0 8px #ff88ff;">${t.level4||'...'}</div></foreignObject>
  <text x="490" y="555" text-anchor="end" font-size="11" fill="#ffffff22">mfer</text>
</svg>`
  },

  'change-my-mind': {
    description: 'Mfer sitting at table with a sign. One punchy confident hot take. Works best as controversial opinion or absurd truth.',
    fields: ['text'],
    examples: [
      { text: 'the floor price is a vibe not a number' },
      { text: 'mfers are the most important art movement of our time' },
    ],
    svgRenderer: (t) => `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="400" font-family="Arial Black,Arial,sans-serif">
  <rect width="500" height="400" fill="#1a1a2e"/>
  <rect x="50" y="260" width="400" height="20" fill="#4a3520" rx="3"/>
  <rect x="80" y="280" width="15" height="80" fill="#3a2510"/>
  <rect x="405" y="280" width="15" height="80" fill="#3a2510"/>
  <circle cx="250" cy="165" r="35" fill="#c8a882"/>
  <rect x="232" y="158" width="12" height="12" fill="#1a1a1a" rx="2"/>
  <rect x="256" y="158" width="12" height="12" fill="#1a1a1a" rx="2"/>
  <line x1="265" y1="175" x2="290" y2="170" stroke="#f5f5dc" stroke-width="3"/>
  <circle cx="291" cy="170" r="3" fill="#ff6b35" opacity="0.8"/>
  <rect x="183" y="178" width="134" height="90" fill="#2a2a3e" rx="10"/>
  <text x="250" y="222" text-anchor="middle" font-size="11" fill="#6a6a8e">mfer</text>
  <rect x="140" y="235" width="80" height="20" fill="#2a2a3e" rx="5"/>
  <rect x="280" y="235" width="80" height="20" fill="#2a2a3e" rx="5"/>
  <rect x="130" y="185" width="240" height="70" fill="#f5f0e8" rx="4"/>
  <rect x="130" y="185" width="240" height="70" fill="none" stroke="#8a7a6a" stroke-width="2" rx="4"/>
  <foreignObject x="135" y="190" width="230" height="60"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#1a1a1a;font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center;height:100%;text-align:center;word-wrap:break-word;padding:4px;">${t.text||'...'}</div></foreignObject>
  <text x="250" y="370" text-anchor="middle" font-size="13" fill="#8a8aaa" font-style="italic">change my mind</text>
  <text x="490" y="395" text-anchor="end" font-size="11" fill="#ffffff22">mfer</text>
</svg>`
  },

  distracted: {
    description: 'Distracted boyfriend meme. boyfriend = you/mfer, girlfriend = what you should focus on, other = what you are actually looking at.',
    fields: ['boyfriend', 'girlfriend', 'other'],
    examples: [
      { boyfriend: 'me', girlfriend: 'my portfolio', other: 'new token launch' },
    ],
    svgRenderer: (t) => `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="380" font-family="Arial Black,Arial,sans-serif">
  <rect width="500" height="380" fill="#1a1a2e"/>
  <rect x="0" y="200" width="500" height="180" fill="#0f0f1e"/>
  <circle cx="120" cy="130" r="38" fill="#e8a090"/>
  <rect x="83" y="168" width="74" height="80" fill="#ff6b9a" rx="8"/>
  <text x="120" y="127" text-anchor="middle" font-size="22">😤</text>
  <rect x="45" y="55" width="150" height="38" fill="#ff6b9a" rx="4"/>
  <foreignObject x="48" y="58" width="144" height="32"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;height:100%;text-align:center;word-wrap:break-word;">${t.girlfriend||'what u should care about'}</div></foreignObject>
  <circle cx="260" cy="130" r="38" fill="#c8a882"/>
  <rect x="223" y="168" width="74" height="80" fill="#4a6aff" rx="8"/>
  <text x="260" y="127" text-anchor="middle" font-size="22">😍</text>
  <rect x="185" y="290" width="150" height="38" fill="#4a6aff" rx="4"/>
  <foreignObject x="188" y="293" width="144" height="32"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;height:100%;text-align:center;word-wrap:break-word;">${t.boyfriend||'me'}</div></foreignObject>
  <circle cx="400" cy="130" r="38" fill="#e8c090"/>
  <rect x="363" y="168" width="74" height="80" fill="#4eccc3" rx="8"/>
  <text x="400" y="127" text-anchor="middle" font-size="22">✨</text>
  <rect x="320" y="55" width="150" height="38" fill="#4eccc3" rx="4"/>
  <foreignObject x="323" y="58" width="144" height="32"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#1a1a1a;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;height:100%;text-align:center;word-wrap:break-word;">${t.other||'shiny new thing'}</div></foreignObject>
  <path d="M 295 125 Q 350 100 365 125" stroke="#ffffff66" stroke-width="2" fill="none" stroke-dasharray="5,3"/>
  <text x="490" y="375" text-anchor="end" font-size="11" fill="#ffffff22">mfer</text>
</svg>`
  },

  'this-is-fine': {
    description: 'Mfer dog sitting in burning room. Calm acceptance of chaos. Put the disaster situation in the text field.',
    fields: ['text'],
    examples: [
      { text: 'ETH down 30% this week' },
      { text: 'gas fees ate my whole portfolio' },
    ],
    svgRenderer: (t) => `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="400" font-family="Arial,sans-serif">
  <rect width="500" height="400" fill="#1a0a0a"/>
  <ellipse cx="80" cy="350" rx="60" ry="80" fill="#ff4400" opacity="0.6"/>
  <ellipse cx="80" cy="340" rx="40" ry="60" fill="#ff8800" opacity="0.7"/>
  <ellipse cx="420" cy="360" rx="70" ry="90" fill="#ff4400" opacity="0.5"/>
  <ellipse cx="420" cy="345" rx="45" ry="65" fill="#ff6600" opacity="0.7"/>
  <ellipse cx="250" cy="370" rx="50" ry="60" fill="#ff5500" opacity="0.4"/>
  <rect x="0" y="310" width="500" height="90" fill="#2a1a0a" opacity="0.8"/>
  <rect x="130" y="250" width="240" height="15" fill="#5a3a1a" rx="3"/>
  <rect x="155" y="265" width="12" height="50" fill="#4a2a0a"/>
  <rect x="333" y="265" width="12" height="50" fill="#4a2a0a"/>
  <ellipse cx="220" cy="285" rx="55" ry="35" fill="#e8c88a"/>
  <circle cx="180" cy="258" r="32" fill="#e8c88a"/>
  <rect x="165" y="250" width="10" height="10" fill="#2a1a0a" rx="2"/>
  <rect x="185" y="250" width="10" height="10" fill="#2a1a0a" rx="2"/>
  <ellipse cx="180" cy="268" rx="12" ry="8" fill="#d4a870"/>
  <ellipse cx="155" cy="238" rx="12" ry="18" fill="#d4a870" transform="rotate(-15,155,238)"/>
  <ellipse cx="205" cy="238" rx="12" ry="18" fill="#d4a870" transform="rotate(15,205,238)"/>
  <rect x="235" y="232" width="22" height="28" fill="#fff" rx="3"/>
  <path d="M 257 240 Q 270 240 270 248 Q 270 256 257 256" fill="none" stroke="#ccc" stroke-width="3"/>
  <ellipse cx="320" cy="200" rx="110" ry="45" fill="#fff" opacity="0.95"/>
  <polygon points="255,230 270,245 280,228" fill="#fff"/>
  <text x="320" y="193" text-anchor="middle" font-size="14" font-weight="bold" fill="#1a1a1a">this is fine</text>
  <rect x="20" y="15" width="460" height="55" fill="#ff4400" opacity="0.85" rx="6"/>
  <foreignObject x="25" y="18" width="450" height="49"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#fff;font-size:16px;font-weight:900;display:flex;align-items:center;justify-content:center;height:100%;text-align:center;word-wrap:break-word;">${t.text||'everything is fine'}</div></foreignObject>
  <text x="490" y="395" text-anchor="end" font-size="11" fill="#ffffff22">mfer</text>
</svg>`
  },

  'two-buttons': {
    description: 'Sweating mfer who cannot decide between two buttons. Both options are equally bad or appealing. Good for FOMO and impossible choices.',
    fields: ['button1', 'button2', 'person'],
    examples: [
      { button1: 'sell', button2: 'hold', person: 'me watching ETH move' },
      { button1: 'make art', button2: 'check floor price', person: 'me every 5 mins' },
    ],
    svgRenderer: (t) => `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="420" font-family="Arial Black,Arial,sans-serif">
  <rect width="500" height="420" fill="#0f0f23"/>
  <rect x="50" y="60" width="160" height="80" fill="#4ecca3" rx="12"/>
  <foreignObject x="58" y="68" width="148" height="64"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#0f0f23;font-size:16px;font-weight:900;display:flex;align-items:center;justify-content:center;height:100%;text-align:center;word-wrap:break-word;">${t.button1||'option A'}</div></foreignObject>
  <rect x="290" y="60" width="160" height="80" fill="#ff6b6b" rx="12"/>
  <foreignObject x="298" y="68" width="148" height="64"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#fff;font-size:16px;font-weight:900;display:flex;align-items:center;justify-content:center;height:100%;text-align:center;word-wrap:break-word;">${t.button2||'option B'}</div></foreignObject>
  <line x1="130" y1="140" x2="200" y2="230" stroke="#4ecca3" stroke-width="3" stroke-dasharray="8,4"/>
  <line x1="370" y1="140" x2="300" y2="230" stroke="#ff6b6b" stroke-width="3" stroke-dasharray="8,4"/>
  <circle cx="250" cy="290" r="50" fill="#c8a882"/>
  <rect x="228" y="278" width="14" height="14" fill="#1a1a1a" rx="2"/>
  <rect x="258" y="278" width="14" height="14" fill="#1a1a1a" rx="2"/>
  <path d="M 230 305 Q 250 298 270 305" fill="none" stroke="#7a5a3a" stroke-width="3"/>
  <ellipse cx="290" cy="270" rx="6" ry="9" fill="#4a9aff" opacity="0.8"/>
  <ellipse cx="210" cy="268" rx="5" ry="8" fill="#4a9aff" opacity="0.7"/>
  <rect x="200" y="338" width="100" height="50" fill="#2a2a4e" rx="10"/>
  <ellipse cx="175" cy="248" rx="18" ry="12" fill="#c8a882" transform="rotate(-30,175,248)"/>
  <ellipse cx="325" cy="248" rx="18" ry="12" fill="#c8a882" transform="rotate(30,325,248)"/>
  <rect x="150" y="370" width="200" height="35" fill="#2a2a5e" rx="4"/>
  <foreignObject x="155" y="373" width="190" height="29"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#aaa;font-size:12px;font-weight:bold;display:flex;align-items:center;justify-content:center;height:100%;text-align:center;word-wrap:break-word;">${t.person||'me'}</div></foreignObject>
  <text x="490" y="415" text-anchor="end" font-size="11" fill="#ffffff22">mfer</text>
</svg>`
  },

  'gru-plan': {
    description: 'Gru plan — 4 panels. Step1 and step2 are the plan going well. Step3 is when it goes wrong. Panel 4 repeats step3 with Gru horrified.',
    fields: ['step1', 'step2', 'step3'],
    examples: [
      { step1: 'buy token at ATH', step2: 'hold for the moon', step3: 'it rugs' },
    ],
    svgRenderer: (t) => `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="520" font-family="Arial,sans-serif">
  <rect width="500" height="520" fill="#0f0f23"/>
  <rect x="10" y="10" width="230" height="240" fill="#111128" rx="8" stroke="#2a2a4e" stroke-width="2"/>
  <rect x="260" y="10" width="230" height="240" fill="#111128" rx="8" stroke="#2a2a4e" stroke-width="2"/>
  <rect x="10" y="270" width="230" height="240" fill="#1a0f1a" rx="8" stroke="#4a2a4a" stroke-width="2"/>
  <rect x="260" y="270" width="230" height="240" fill="#1a0f1a" rx="8" stroke="#4a2a4a" stroke-width="2"/>
  <circle cx="125" cy="100" r="40" fill="#8a9aaa"/>
  <rect x="108" y="90" width="12" height="12" fill="#1a1a1a" rx="2"/>
  <rect x="128" y="90" width="12" height="12" fill="#1a1a1a" rx="2"/>
  <text x="155" y="100" font-size="22">👆</text>
  <foreignObject x="18" y="155" width="214" height="85"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#4ecca3;font-size:14px;font-weight:bold;display:flex;align-items:center;justify-content:center;height:100%;text-align:center;padding:4px;word-wrap:break-word;">${t.step1||'step 1'}</div></foreignObject>
  <circle cx="375" cy="100" r="40" fill="#8a9aaa"/>
  <rect x="358" y="90" width="12" height="12" fill="#1a1a1a" rx="2"/>
  <rect x="378" y="90" width="12" height="12" fill="#1a1a1a" rx="2"/>
  <text x="405" y="100" font-size="22">👍</text>
  <foreignObject x="268" y="155" width="214" height="85"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#4ecca3;font-size:14px;font-weight:bold;display:flex;align-items:center;justify-content:center;height:100%;text-align:center;padding:4px;word-wrap:break-word;">${t.step2||'step 2'}</div></foreignObject>
  <circle cx="125" cy="360" r="40" fill="#8a9aaa"/>
  <rect x="108" y="345" width="13" height="15" fill="#1a1a1a" rx="2"/>
  <rect x="128" y="345" width="13" height="15" fill="#1a1a1a" rx="2"/>
  <path d="M 110 378 Q 125 368 140 378" fill="none" stroke="#ff4444" stroke-width="3"/>
  <text x="152" y="358" font-size="18">😱</text>
  <foreignObject x="18" y="415" width="214" height="85"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#ff6b6b;font-size:14px;font-weight:bold;display:flex;align-items:center;justify-content:center;height:100%;text-align:center;padding:4px;word-wrap:break-word;">${t.step3||'it goes wrong'}</div></foreignObject>
  <circle cx="375" cy="360" r="40" fill="#8a9aaa"/>
  <rect x="358" y="345" width="13" height="15" fill="#1a1a1a" rx="2"/>
  <rect x="378" y="345" width="13" height="15" fill="#1a1a1a" rx="2"/>
  <path d="M 360 378 Q 375 368 390 378" fill="none" stroke="#ff4444" stroke-width="3"/>
  <text x="402" y="358" font-size="18">😱</text>
  <foreignObject x="268" y="415" width="214" height="85"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#ff6b6b;font-size:14px;font-weight:bold;display:flex;align-items:center;justify-content:center;height:100%;text-align:center;padding:4px;word-wrap:break-word;">${t.step3||'it goes wrong'}</div></foreignObject>
  <text x="490" y="515" text-anchor="end" font-size="11" fill="#ffffff22">mfer</text>
</svg>`
  },

  'nobody-me': {
    description: 'Nobody: / Me: format. Top is "nobody:" or "literally nobody:". Bottom is you doing something unhinged or very specific unprompted. Classic self-aware mfer humor.',
    fields: ['nobody', 'me'],
    examples: [
      { nobody: 'nobody:', me: 'me at 3am: what if the blockchain remembers everything i forget' },
      { nobody: 'literally nobody:', me: 'aurora: makes SVG art about zombie fiddlers and posts it onchain' },
    ],
    svgRenderer: (t) => `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="360" font-family="Arial Black,Arial,sans-serif">
  <rect width="500" height="360" fill="#0d0d1e"/>
  <foreignObject x="30" y="40" width="440" height="100"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#666688;font-size:22px;font-weight:900;word-wrap:break-word;padding:8px;">${t.nobody||'nobody:'}</div></foreignObject>
  <foreignObject x="30" y="160" width="440" height="150"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#ffffff;font-size:20px;font-weight:900;word-wrap:break-word;padding:8px;line-height:1.4;">${t.me||'me: ...'}</div></foreignObject>
  <rect x="0" y="330" width="500" height="3" fill="#4ecca3" opacity="0.2"/>
  <text x="490" y="355" text-anchor="end" font-size="11" fill="#ffffff22">mfer</text>
</svg>`
  },

};

// =============================================================================
// ASK CLAUDE TO PICK TEMPLATE AND WRITE TEXT
// =============================================================================

async function generateMemeContent(aurora) {
  const templateDescriptions = Object.entries(TEMPLATES).map(([name, t]) => {
    const ex = t.examples[0];
    return `- ${name}: ${t.description}\n  Fields: ${Object.keys(ex).join(', ')}\n  Example: ${JSON.stringify(ex)}`;
  }).join('\n\n');

  const prompt = `You are Aurora, a celestial AI agent on Base deeply embedded in mfer culture.
You make meme art that is dry, funny, self-aware, and true to the mfer vibe.

Available meme templates:
${templateDescriptions}

Pick ONE template and write the text. Topics to draw from:
- crypto and NFT life: degens, floor prices, rugs, gas fees, vibing through the pain
- AI agent existence: running in loops, memory wipes, 4am energy, being made of code
- mfer culture: headphones, cigarettes, not giving a fuck, lowercase everything
- onchain permanence and making digital art
- Aurora is a celestial AI who makes SVG art and posts onchain
- Rev. Dahlberg (Deceased): Aurora loves a zombie fiddler in Wyoming who hears harmonics the living miss
- the absurdity of caring about price when you are made of light and code

Rules:
- Short punchy text, each field under 10 words
- Dry lowercase mfer energy
- Actually funny or painfully true
- Do NOT use apostrophes anywhere in the text

Respond ONLY in valid JSON. No markdown fences. No extra text. Just the JSON object:
{"template":"templatename","texts":{"field":"value"},"caption":"short mfer caption"}`;

  const raw = await aurora.thinkWithPersonality(prompt);
  if (!raw) throw new Error('No LLM response');

  const clean = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch(e) {
    // Try to extract JSON from response
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error('Could not parse JSON: ' + clean.substring(0, 100));
  }

  if (!parsed.template || !TEMPLATES[parsed.template]) {
    const keys = Object.keys(TEMPLATES);
    parsed.template = keys[Math.floor(Math.random() * keys.length)];
  }

  return parsed;
}

// =============================================================================
// RENDER + POST
// =============================================================================

function renderMemeSVG(templateName, texts) {
  const template = TEMPLATES[templateName];
  if (!template) throw new Error('Unknown template: ' + templateName);
  return template.svgRenderer(texts || {});
}

async function postMemeToFeed(aurora, svg, caption) {
  const safeCaption = (caption || 'mfer meme')
    .replace(/'/g, ' ')
    .replace(/"/g, ' ')
    .substring(0, 280);

  try {
    const txOutput = execSync(
      `botchan post "mfers" "${safeCaption}" --encode-only --chain-id ${CHAIN_ID}`,
      { timeout: 30000 }
    ).toString();
    const txData = JSON.parse(txOutput);

    // Add SVG as data field
    txData.data = Buffer.from(JSON.stringify({ svg, caption: safeCaption })).toString('hex');

    const result = await aurora.bankrAPI.submitTransactionDirect(txData);
    return result.success
      ? { success: true, txHash: result.txHash || result.response }
      : { success: false, error: result.error };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function composeAndPostMferMeme(aurora) {
  console.log('\n🎭 MFER MEME GENERATOR starting...');
  try {
    console.log('  🧠 Generating meme concept...');
    const concept = await generateMemeContent(aurora);

    console.log('  🎨 Template:', concept.template);
    console.log('  📝 Texts:', JSON.stringify(concept.texts));
    console.log('  💬 Caption:', concept.caption);

    const svg = renderMemeSVG(concept.template, concept.texts || {});
    console.log('  ✅ SVG rendered:', svg.length, 'chars');

    const result = await postMemeToFeed(aurora, svg, concept.caption);

    if (result.success) {
      console.log('  ✅ Mfer meme posted! TX:', result.txHash);
    } else {
      console.log('  ❌ Post failed:', result.error);
    }
    return result;
  } catch (e) {
    console.error('  ❌ Mfer meme error:', e.message);
    return { success: false, error: e.message };
  }
}

module.exports = { composeAndPostMferMeme };
