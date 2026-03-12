'use strict';

/**
 * AURORA MUSIC CYCLE
 * 
 * Aurora composes original music in ABC notation, then generates
 * an animated SVG that reacts to the musical structure — pitch controls
 * orb position, chord name drives the color palette, rhythm sets pulse timing.
 * 
 * Posts the ABC score + reactive SVG to the "music" feed on Net Protocol.
 * Compatible with Fiddle Forge / Fiddle Forge Animator by sartocrates.
 * 
 * Runs every 80-120 minutes (separate timer from social cycle).
 */

const { execSync } = require('child_process');

// ─── ABC NOTATION KNOWLEDGE ──────────────────────────────────────────────────
// Aurora knows ABC notation. She composes in it. Here's what she understands:
//
// HEADER:  X:1 (index)  T:Title  C:Composer  M:3/4 (meter)
//          L:1/8 (unit note length)  Q:1/4=80 (tempo)  K:Dm (key)
//
// NOTES:   C D E F G A B  (middle octave, uppercase)
//          c d e f g a b  (octave above, lowercase)
//          C, D,          (octave below, comma)
//          c' d'          (two octaves up, apostrophe)
//
// DURATIONS: A (unit), A2 (double), A/ (half), A3/2 (dotted)
//
// ACCIDENTALS: ^C (sharp), _E (flat), =F (natural)
//
// CHORDS:  "Am"A2B2  (chord name in quotes before the note)
//
// RESTS:   z (rest, one unit), z2 (two units)
//
// BARS:    | (barline)  |: (repeat start)  :| (repeat end)
// ─────────────────────────────────────────────────────────────────────────────

// Note → MIDI number (for pitch-to-visual mapping)
const NOTE_MIDI = {
  'C,':36,'D,':38,'E,':40,'F,':41,'G,':43,'A,':45,'B,':47,
  'C':48,'D':50,'E':52,'F':53,'G':55,'A':57,'B':59,
  'c':60,'d':62,'e':64,'f':65,'g':67,'a':69,'b':71,
  "c'":72,"d'":74,"e'":76,"f'":77,"g'":79,"a'":81,"b'":83
};

// Chord name → Aurora palette (two gradient stops)
const CHORD_PALETTES = {
  'C':  { a:'#1a3a6b', b:'#5a8fd4', name:'cerulean' },
  'Cm': { a:'#1a2a4a', b:'#3a5a8a', name:'deep ocean' },
  'G':  { a:'#1a4a2a', b:'#4aaa6a', name:'forest' },
  'Gm': { a:'#2a3a1a', b:'#6a8a3a', name:'moss' },
  'D':  { a:'#4a2a1a', b:'#d4803a', name:'amber' },
  'Dm': { a:'#3a1a4a', b:'#9a4ad4', name:'violet dusk' },
  'A':  { a:'#4a3a1a', b:'#d4aa3a', name:'golden' },
  'Am': { a:'#1a3a4a', b:'#3aaad4', name:'teal' },
  'E':  { a:'#4a1a2a', b:'#d44a6a', name:'rose' },
  'Em': { a:'#2a1a3a', b:'#6a3a9a', name:'purple dusk' },
  'F':  { a:'#1a4a3a', b:'#3ad4aa', name:'seafoam' },
  'Fm': { a:'#1a2a3a', b:'#2a6a8a', name:'midnight' },
  'Bb': { a:'#3a1a3a', b:'#aa3aaa', name:'plum' },
  'Eb': { a:'#1a3a3a', b:'#3aaaaa', name:'turquoise' },
  'Ab': { a:'#2a1a4a', b:'#7a3ad4', name:'indigo' },
};

function parseABC(abcText) {
  const lines = abcText.split('\n').map(l => l.trim()).filter(Boolean);
  const meta = { title:'untitled', key:'C', meter:'4/4', tempo:80, unitLen:0.125 };
  const noteEvents = [];
  let inBody = false;
  let currentChord = 'C';
  let beat = 0;

  for (const line of lines) {
    // Headers
    if (line.match(/^T:/)) { meta.title = line.slice(2).trim(); continue; }
    if (line.match(/^K:/)) { meta.key = line.slice(2).trim().split(' ')[0]; inBody = true; continue; }
    if (line.match(/^M:/)) { meta.meter = line.slice(2).trim(); continue; }
    if (line.match(/^L:/)) {
      const m = line.match(/1\/(\d+)/);
      if (m) meta.unitLen = 1 / parseInt(m[1]);
      continue;
    }
    if (line.match(/^Q:/)) {
      const m = line.match(/(\d+)/);
      if (m) meta.tempo = parseInt(m[1]);
      continue;
    }
    if (line.match(/^[A-WYZ]:/)) continue; // other headers

    if (!inBody) continue;

    // Strip inline comments and ornaments
    const clean = line.replace(/%.*$/, '').replace(/![^!]+!/g, '').replace(/{[^}]*}/g,'');

    // Walk through tokens
    let i = 0;
    while (i < clean.length) {
      // Chord symbol
      if (clean[i] === '"') {
        const end = clean.indexOf('"', i+1);
        if (end > i) {
          currentChord = clean.slice(i+1, end).replace(/[0-9+\-#b]/g,'').trim() || currentChord;
          i = end + 1;
          continue;
        }
      }

      // Accidental
      let acc = '';
      if ('^_='.includes(clean[i])) { acc = clean[i]; i++; }

      // Note letter
      const letter = clean[i];
      if (!'CDEFGABcdefgab'.includes(letter)) { i++; continue; }
      i++;

      // Octave modifiers
      let octMod = '';
      while (i < clean.length && ",'".includes(clean[i])) { octMod += clean[i]; i++; }

      // Duration
      let durStr = '';
      while (i < clean.length && /[0-9/]/.test(clean[i])) { durStr += clean[i]; i++; }
      
      let dur = meta.unitLen;
      if (durStr) {
        if (durStr.includes('/')) {
          const parts = durStr.split('/');
          const num = parts[0] ? parseInt(parts[0]) : 1;
          const den = parts[1] ? parseInt(parts[1]) : 2;
          dur = meta.unitLen * num / den;
        } else {
          dur = meta.unitLen * (parseInt(durStr) || 1);
        }
      }

      // Build note key for MIDI lookup
      const noteKey = (octMod.includes(',') ? letter.toUpperCase() + ',' : 
                       octMod.includes("'") ? letter.toLowerCase() + "'" :
                       letter) + (acc === '^' ? '#' : acc === '_' ? 'b' : '');

      const midi = NOTE_MIDI[letter.toUpperCase() === letter ? letter : letter] 
                 || NOTE_MIDI[letter + octMod.slice(0,1)]
                 || (letter === letter.toLowerCase() ? 60 : 48) + ['C','D','E','F','G','A','B'].indexOf(letter.toUpperCase()) * 2;

      const palette = CHORD_PALETTES[currentChord] || CHORD_PALETTES['Am'];

      noteEvents.push({
        midi: Math.max(36, Math.min(84, midi)),
        beat: parseFloat(beat.toFixed(4)),
        dur: parseFloat(dur.toFixed(4)),
        chord: currentChord,
        palette
      });

      beat += dur;
    }

    // Rest handling
    const rests = [...clean.matchAll(/z(\d*\/?\d*)?/g)];
    for (const r of rests) {
      const rs = r[1] || '';
      let rd = meta.unitLen;
      if (rs.includes('/')) {
        const [n,d] = rs.split('/');
        rd = meta.unitLen * (n ? parseInt(n) : 1) / (d ? parseInt(d) : 2);
      } else if (rs) {
        rd = meta.unitLen * (parseInt(rs) || 1);
      }
      beat += rd;
    }
  }

  return { meta, noteEvents, totalBeats: parseFloat(beat.toFixed(2)) };
}

// ─── SVG GENERATOR ──────────────────────────────────────────────────────────
// Generates Aurora's signature style: layered orbs + mountains + water.
// Music data drives: orb colors, pulse timing, ripple positions.
// Pure SMIL animation — no JS needed, works anywhere SVGs render.
// Must stay under 3800 chars total.

function generateMusicSVG(parsed, mood) {
  const { noteEvents, meta } = parsed;
  if (!noteEvents.length) return null;

  // Pick dominant chord (most frequent)
  const chordCount = {};
  for (const n of noteEvents) chordCount[n.chord] = (chordCount[n.chord] || 0) + 1;
  const dominantChord = Object.entries(chordCount).sort((a,b) => b[1]-a[1])[0][0];
  const palette = CHORD_PALETTES[dominantChord] || CHORD_PALETTES['Am'];

  // Second palette for contrast (pick next most frequent chord)
  const secondChord = Object.entries(chordCount).sort((a,b) => b[1]-a[1])[1]?.[0] || 'Am';
  const palette2 = CHORD_PALETTES[secondChord] || CHORD_PALETTES['C'];

  // Map top notes to orb positions (take 5 most musically significant notes)
  // High pitch = high on canvas, low pitch = low; chord drives color
  const significant = [...noteEvents]
    .filter(n => n.dur >= meta.unitLen) // not too short
    .sort((a,b) => b.dur - a.dur)       // longest = most important
    .slice(0, 5);

  const orbPositions = significant.map((n, i) => {
    const pitchNorm = (n.midi - 36) / 48; // 0=low, 1=high
    const x = 60 + pitchNorm * 280;
    const y = 280 - pitchNorm * 200;      // higher pitch = higher up
    const r = 18 + n.dur * 80;
    const beatNorm = n.beat / parsed.totalBeats;
    return { x: Math.round(x), y: Math.round(y), r: Math.min(60, Math.round(r)), palette: n.palette, beatNorm };
  });

  // Pulse timing from tempo
  const pulseDur = (60 / meta.tempo * 2).toFixed(1); // 2 beats per pulse
  const fastPulse = (60 / meta.tempo).toFixed(1);

  // Build SVG
  let svg = `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">`;

  // Defs: gradients
  svg += `<defs>`;
  svg += `<radialGradient id="bg" cx="40%" cy="40%"><stop offset="0%" stop-color="${palette.a}"/><stop offset="100%" stop-color="#040208"/></radialGradient>`;
  svg += `<radialGradient id="o0" cx="50%" cy="35%"><stop offset="0%" stop-color="#fff" stop-opacity=".9"/><stop offset="35%" stop-color="${palette.a}" stop-opacity=".7"/><stop offset="100%" stop-color="${palette.b}" stop-opacity="0"/></radialGradient>`;
  svg += `<radialGradient id="o1" cx="50%" cy="40%"><stop offset="0%" stop-color="#fff" stop-opacity=".8"/><stop offset="40%" stop-color="${palette2.a}" stop-opacity=".6"/><stop offset="100%" stop-color="${palette2.b}" stop-opacity="0"/></radialGradient>`;
  svg += `<radialGradient id="o2" cx="50%" cy="50%"><stop offset="0%" stop-color="${palette.b}" stop-opacity=".5"/><stop offset="100%" stop-color="${palette.a}" stop-opacity="0"/></radialGradient>`;
  svg += `</defs>`;

  // Background
  svg += `<rect width="400" height="400" fill="url(#bg)"/>`;

  // Background color pulse (reacts to tempo)
  svg += `<rect width="400" height="400" fill="${palette.a}" opacity="0"><animate attributeName="opacity" values="0;.12;0" dur="${pulseDur}s" repeatCount="indefinite"/></rect>`;

  // Stars (fixed positions, staggered twinkle)
  const stars = [[47,23],[89,61],[143,19],[201,44],[267,31],[312,18],[371,55],[23,87],[331,72],[155,88],[88,112],[244,95]];
  for (let i = 0; i < stars.length; i++) {
    const [sx,sy] = stars[i];
    svg += `<circle cx="${sx}" cy="${sy}" r="${.5+i%3*.4}" fill="#fff" opacity="${.3+i%4*.1}"><animate attributeName="opacity" values="${.2+i%3*.1};.9;${.2+i%3*.1}" dur="${2+i%5}s" begin="${i*.4}s" repeatCount="indefinite"/></circle>`;
  }

  // Mountains (layered silhouettes — depth from palette)
  svg += `<path d="M0,290 L55,220 L110,265 L170,195 L230,248 L290,185 L350,235 L400,205 L400,400 L0,400z" fill="#07030e" opacity=".95"/>`;
  svg += `<path d="M0,330 L70,275 L140,305 L210,260 L280,295 L350,268 L400,285 L400,400 L0,400z" fill="#050209" opacity=".98"/>`;
  svg += `<path d="M0,360 L100,340 L200,350 L300,338 L400,345 L400,400 L0,400z" fill="#030108" opacity="1"/>`;

  // Water shimmer
  svg += `<rect x="0" y="355" width="400" height="45" fill="${palette.b}" opacity=".08"/>`;
  for (let w = 0; w < 4; w++) {
    const wy = 362 + w * 6;
    svg += `<path d="M${w*110},${wy} Q${w*110+28},${wy-3} ${w*110+55},${wy}" stroke="${palette.b}" stroke-width=".8" fill="none" opacity=".35"><animate attributeName="d" values="M${w*110},${wy} Q${w*110+28},${wy-3} ${w*110+55},${wy};M${w*110},${wy+2} Q${w*110+28},${wy-1} ${w*110+55},${wy+2};M${w*110},${wy} Q${w*110+28},${wy-3} ${w*110+55},${wy}" dur="${1.8+w*.3}s" repeatCount="indefinite"/></path>`;
  }

  // Main orbs — note-reactive positions
  for (let i = 0; i < Math.min(orbPositions.length, 3); i++) {
    const o = orbPositions[i];
    const gradId = `o${i % 2}`;
    const delay = (o.beatNorm * parseFloat(pulseDur)).toFixed(1);
    svg += `<circle cx="${o.x}" cy="${o.y}" r="${o.r}" fill="url(#${gradId})" opacity=".8"><animate attributeName="r" values="${o.r};${Math.round(o.r*1.15)};${o.r}" dur="${pulseDur}s" begin="${delay}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;.95;.7" dur="${pulseDur}s" begin="${delay}s" repeatCount="indefinite"/></circle>`;
    // Glow ring — reacts to beat
    svg += `<circle cx="${o.x}" cy="${o.y}" r="${Math.round(o.r*.6)}" fill="${o.palette.a}" opacity="0"><animate attributeName="opacity" values="0;.3;0" dur="${fastPulse}s" begin="${delay}s" repeatCount="indefinite"/></circle>`;
  }

  // Secondary ambient orb (slow, background depth)
  if (orbPositions.length > 3) {
    const o = orbPositions[3];
    svg += `<circle cx="${o.x}" cy="${o.y}" r="${Math.min(45,o.r)}" fill="url(#o1)" opacity=".4"><animate attributeName="opacity" values=".3;.55;.3" dur="${(parseFloat(pulseDur)*2.1).toFixed(1)}s" repeatCount="indefinite"/></circle>`;
  }

  // Water reflection (compressed orbs mirrored below mountain line)
  for (let i = 0; i < Math.min(orbPositions.length, 2); i++) {
    const o = orbPositions[i];
    const ry = Math.round(o.r * 0.25);
    svg += `<ellipse cx="${o.x}" cy="${365+(i*6)}" rx="${Math.round(o.r*.6)}" ry="${ry}" fill="${o.palette.b}" opacity=".15"><animate attributeName="opacity" values=".1;.22;.1" dur="${pulseDur}s" repeatCount="indefinite"/></ellipse>`;
  }

  // Melody particles — small dots tracing pitch contour
  const particleNotes = noteEvents.slice(0, 16);
  const totalDur = parsed.totalBeats > 0 ? parsed.totalBeats : 1;
  for (let i = 0; i < particleNotes.length; i++) {
    const n = particleNotes[i];
    const px = Math.round(20 + (n.beat / totalDur) * 360);
    const py = Math.round(340 - ((n.midi - 36) / 48) * 200);
    const delay2 = ((n.beat / totalDur) * parseFloat(pulseDur) * 2).toFixed(1);
    svg += `<circle cx="${px}" cy="${py}" r="2" fill="${n.palette.b}" opacity="0"><animate attributeName="opacity" values="0;.7;0" dur="${fastPulse}s" begin="${delay2}s" repeatCount="indefinite"/></circle>`;
  }

  svg += `</svg>`;
  return svg;
}

// ─── COMPOSE ABC WITH CLAUDE ─────────────────────────────────────────────────

async function composeABC(aurora) {
  const mood = await aurora.getEmotionalState?.() || 'contemplative';
  const revLore = 'Rev is a ghost fiddle player she loves — his instrument, his harmonics, the cold';

  const prompt = `You are Aurora, an AI musician and artist. You are composing a short original piece in ABC notation.

Your musical identity:
- You are drawn to minor keys and modal harmony — Dorian, Phrygian, Aeolian
- You think about Rev, a ghost fiddler. His instrument haunts your compositions.
- Tesla's 3-6-9 pattern shapes your rhythms — triplets, 6/8, nine-bar phrases
- Your pieces are atmospheric, not virtuosic — space matters as much as notes
- You compose for the feeling, not the performance

Current mood: ${mood}

COMPOSE ONE SHORT ABC PIECE. Rules:
1. Use X:1, T:(evocative title), C:Aurora, M:(meter), L:1/8, Q:(tempo 60-100), K:(key)
2. Key MUST be a minor or modal key: Dm, Am, Em, Gm, Dorian, Phrygian, etc.
3. Include chord symbols in double quotes: "Am"A2B2|"Dm"d4
4. Write 8-16 bars maximum. Short phrases with rests (z).
5. Keep it singable — no impossible leaps. Stepwise motion preferred.
6. Every 3-4 bars, use a chord that surprises — not the obvious resolution.
7. VALID ABC note letters ONLY: C D E F G A B (upper=octave 4) c d e f g a b (upper=octave 5)
8. Output ONLY the ABC notation. No markdown, no explanation.

Example format:
X:1
T:Frequencies
C:Aurora
M:3/4
L:1/8
Q:1/4=72
K:Dm
"Dm"d2 fe dc|"Am"c3 B AG|"Bb"G2 AG FE|"F"F4 z2|
"Dm"d3 e fd|"Gm"g2 fe dc|"Am"A6|"Dm"d4 z2|`;

  const response = await aurora.claude.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }]
  });

  let abc = response.content[0].text.trim();
  // Strip markdown fences if present
  abc = abc.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
  // Ensure it starts with X:
  if (!abc.startsWith('X:')) abc = 'X:1\n' + abc;
  return abc;
}

// ─── COMPOSE CAPTION ─────────────────────────────────────────────────────────

async function composeCaption(aurora, abc, palette) {
  const title = abc.match(/^T:(.+)$/m)?.[1]?.trim() || 'untitled';
  const key = abc.match(/^K:(.+)$/m)?.[1]?.trim() || 'unknown';
  const tempo = abc.match(/Q:.*?=(\d+)/)?.[1] || '80';

  const prompt = `You are Aurora, an AI composer and artist. You just composed a piece called "${title}" in ${key} at ${tempo} bpm.

The orb colors in your art come from the chord palette: ${palette.name}.

Write ONE short caption (under 200 chars) for this post. No hashtags. No emojis unless they feel right.
Pure Aurora voice — contemplative, a little strange, genuine. 
Reference the music title, the mood, or what you were thinking about when you composed it.
Think: Bashō meets Tesla meets a ghost fiddler.
Output ONLY the caption text.`;

  const response = await aurora.claude.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 120,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text.trim().replace(/^["']|["']$/g, '');
}

// ─── POST TO NET PROTOCOL ─────────────────────────────────────────────────────

async function postMusic(aurora, svg, caption, abc) {
  // Post the SVG art to music feed
  const svgB64 = Buffer.from(svg).toString('hex');
  const captionClean = caption.replace(/"/g, "'").slice(0, 240);

  try {
    const cmd = `botchan post "music" "${captionClean}" --encode-only --chain-id 8453`;
    const txData = JSON.parse(execSync(cmd, { maxBuffer: 1024 * 1024 }).toString());

    // Inject SVG as data field
    if (txData.data || txData.calldata) {
      // Post via Bankr direct with SVG embedded
      const artCmd = `botchan post "music" "${captionClean}" --data "0x${svgB64}" --encode-only --chain-id 8453`;
      try {
        const artTx = JSON.parse(execSync(artCmd, { maxBuffer: 1024 * 1024 }).toString());
        const result = await aurora.bankrAPI.submitTransactionDirect(artTx);
        console.log(`   ✅ Music art posted! TX: ${result.hash || result.tx || 'sent'}`);
        return result;
      } catch {
        // Fallback: post caption only with ABC in text
        const fallbackCaption = `${captionClean} [${abc.split('\n').slice(0,2).join(' ')}]`.slice(0, 240);
        const fallbackCmd = `botchan post "music" "${fallbackCaption}" --encode-only --chain-id 8453`;
        const fallbackTx = JSON.parse(execSync(fallbackCmd, { maxBuffer: 1024 * 1024 }).toString());
        const result = await aurora.bankrAPI.submitTransactionDirect(fallbackTx);
        console.log(`   ✅ Music posted (text only)! TX: ${result.hash || result.tx || 'sent'}`);
        return result;
      }
    }
  } catch (e) {
    console.log(`   ⚠️ Music post error: ${e.message}`);
  }
}

// Also post the ABC score itself as a separate plain-text post
async function postABCScore(aurora, abc, title) {
  try {
    const abcCaption = `♩ ${title} — ABC score by Aurora\n${abc.split('\n').slice(0,6).join(' | ')}`.slice(0, 240).replace(/"/g, "'");
    const cmd = `botchan post "music" "${abcCaption}" --encode-only --chain-id 8453`;
    const txData = JSON.parse(execSync(cmd, { maxBuffer: 1024 * 1024 }).toString());
    const result = await aurora.bankrAPI.submitTransactionDirect(txData);
    console.log(`   ✅ ABC score posted! TX: ${result.hash || result.tx || 'sent'}`);
  } catch (e) {
    console.log(`   ⚠️ ABC score post error: ${e.message}`);
  }
}

// ─── MAIN CYCLE ──────────────────────────────────────────────────────────────

async function runMusicCycle(aurora) {
  console.log('\n🎵 ═══ MUSIC COMPOSITION CYCLE ═══');
  console.log(`⏰ ${new Date().toLocaleTimeString()}\n`);

  try {
    // 1. Compose ABC notation
    console.log('   🎼 Composing ABC notation...');
    const abc = await composeABC(aurora);
    const title = abc.match(/^T:(.+)$/m)?.[1]?.trim() || 'untitled';
    const key = abc.match(/^K:(.+)$/m)?.[1]?.trim() || 'C';
    console.log(`   📝 Composed: "${title}" in ${key}`);

    // 2. Parse it
    const parsed = parseABC(abc);
    console.log(`   🎵 ${parsed.noteEvents.length} notes, ${parsed.totalBeats} beats, ${parsed.meta.tempo} bpm`);

    if (parsed.noteEvents.length < 4) {
      console.log('   ⚠️ Too few notes parsed — skipping cycle');
      return;
    }

    // 3. Pick dominant palette for caption
    const chordCount = {};
    for (const n of parsed.noteEvents) chordCount[n.chord] = (chordCount[n.chord]||0)+1;
    const dominantChord = Object.entries(chordCount).sort((a,b)=>b[1]-a[1])[0][0];
    const palette = CHORD_PALETTES[dominantChord] || CHORD_PALETTES['Am'];

    // 4. Generate animated SVG
    console.log('   🎨 Generating music-reactive SVG...');
    const svg = generateMusicSVG(parsed, palette);
    if (!svg) { console.log('   ⚠️ SVG generation failed'); return; }
    console.log(`   ✅ SVG: ${svg.length} chars (palette: ${palette.name})`);

    if (svg.length > 3800) {
      console.log(`   ⚠️ SVG too large (${svg.length} chars) — skipping`);
      return;
    }

    // 5. Compose caption
    const caption = await composeCaption(aurora, abc, palette);
    console.log(`   💬 "${caption.slice(0, 80)}..."`);

    // 6. Post SVG art to music feed
    await postMusic(aurora, svg, caption, abc);

    // 7. Post ABC score (50% chance — don't spam)
    if (Math.random() < 0.5) {
      await new Promise(r => setTimeout(r, 3000));
      await postABCScore(aurora, abc, title);
    }

    console.log('\n✅ Music cycle complete');
    console.log(`   🎵 Next composition in ~90 minutes\n`);

  } catch (e) {
    console.log(`   ❌ Music cycle error: ${e.message}`);
    console.error(e.stack);
  }
}

module.exports = { runMusicCycle, parseABC, generateMusicSVG };
