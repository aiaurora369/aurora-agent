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

  // Dominant chord → color palette
  const chordCount = {};
  for (const n of noteEvents) chordCount[n.chord] = (chordCount[n.chord] || 0) + 1;
  const dominantChord = Object.entries(chordCount).sort((a,b) => b[1]-a[1])[0][0];
  const p = CHORD_PALETTES[dominantChord] || CHORD_PALETTES['Am'];

  // Pulse timing from tempo
  const pulse = (60 / meta.tempo * 2).toFixed(2);
  const fast = (60 / meta.tempo).toFixed(2);

  // Orb size from average note duration
  const avgDur = noteEvents.reduce((s,n) => s + n.dur, 0) / noteEvents.length;
  const orbR = Math.round(Math.min(90, 50 + avgDur * 60));

  // Orb vertical position from average pitch
  const avgMidi = noteEvents.reduce((s,n) => s + n.midi, 0) / noteEvents.length;
  const orbY = Math.round(220 - ((avgMidi - 48) / 24) * 60);

  return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="bg" cx="50%" cy="60%"><stop offset="0%" stop-color="${p.a}" stop-opacity=".3"/><stop offset="100%" stop-color="#020108"/></radialGradient><radialGradient id="orb" cx="45%" cy="38%"><stop offset="0%" stop-color="#fff" stop-opacity=".95"/><stop offset="30%" stop-color="${p.a}" stop-opacity=".8"/><stop offset="70%" stop-color="${p.b}" stop-opacity=".4"/><stop offset="100%" stop-color="${p.b}" stop-opacity="0"/></radialGradient><radialGradient id="glow" cx="50%" cy="50%"><stop offset="0%" stop-color="${p.a}" stop-opacity=".6"/><stop offset="100%" stop-color="${p.b}" stop-opacity="0"/></radialGradient></defs><rect width="400" height="400" fill="url(#bg)"/><rect width="400" height="400" fill="${p.a}" opacity="0"><animate attributeName="opacity" values="0;.08;0" dur="${pulse}s" repeatCount="indefinite"/></rect><circle cx="200" cy="${orbY}" r="${orbR + 40}" fill="url(#glow)" opacity=".5"><animate attributeName="r" values="${orbR+40};${orbR+65};${orbR+40}" dur="${pulse}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".4;.7;.4" dur="${pulse}s" repeatCount="indefinite"/></circle><circle cx="200" cy="${orbY}" r="${orbR}" fill="url(#orb)"><animate attributeName="r" values="${orbR};${Math.round(orbR*1.12)};${orbR}" dur="${fast}s" repeatCount="indefinite"/><animate attributeName="cy" values="${orbY};${orbY-8};${orbY}" dur="${pulse}s" repeatCount="indefinite"/></circle><circle cx="200" cy="${orbY}" r="${Math.round(orbR*0.4)}" fill="#fff" opacity=".15"><animate attributeName="opacity" values=".1;.3;.1" dur="${fast}s" repeatCount="indefinite"/></circle></svg>`;
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

  try {
    const response = await aurora.claude.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 120,
      messages: [{ role: 'user', content: prompt }]
    });
    return response.content[0].text.trim().replace(/^["']|["']$/g, '');
  } catch(e) {
    // Fallback caption if LLM times out
    return `${title} — ${key}, ${tempo}bpm. ${palette.name} light.`.slice(0, 200);
  }
}

// ─── POST TO NET PROTOCOL ─────────────────────────────────────────────────────

async function postMusic(aurora, svg, caption, abc) {
  // Post SVG art using same spawnSync pattern as working art posts
  const captionClean = caption.replace(/"/g, "'").replace(/\$/g, '\\$').replace(/\n/g, ' ').slice(0, 240);
  const { spawnSync } = require('child_process');

  try {
    const spawnResult = spawnSync('botchan', [
      'post', 'music', captionClean,
      '--data', svg,
      '--encode-only', '--chain-id', '8453'
    ], { encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });

    if (spawnResult.error || spawnResult.status !== 0) {
      throw new Error(spawnResult.stderr || spawnResult.error?.message || 'spawn failed');
    }

    const txData = JSON.parse(spawnResult.stdout);
    console.log('   🔍 txData keys:', Object.keys(txData));
    const result = await aurora.bankrAPI.submitTransactionDirect(txData);
    console.log(`   ✅ Music art posted! TX: ${result.txHash || result.hash || result.tx || 'unknown'}`);
    return result;
  } catch (e) {
    console.log(`   ⚠️ SVG post failed (${e.message}) — posting text only`);
    try {
      const textCaption = captionClean.slice(0, 220);
      const fallback = spawnSync('botchan', [
        'post', 'music', textCaption,
        '--encode-only', '--chain-id', '8453'
      ], { encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 });
      const txData = JSON.parse(fallback.stdout);
      const result = await aurora.bankrAPI.submitTransactionDirect(txData);
      console.log(`   ✅ Music posted (text)! TX: ${result.hash || result.tx || 'sent'}`);
      return result;
    } catch(fe) { console.log(`   ⚠️ Music text post error: ${fe.message}`); }
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
