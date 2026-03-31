'use strict';

/**
 * AURORA MUSIC CYCLE — v2.0
 *
 * Aurora composes original music in ABC notation, then generates:
 *   1. A self-playing animated SVG — orb landscape with embedded Web Audio
 *      engine. Orb breathes with SMIL animations, flashes on each note.
 *      Posted directly to the Net Protocol music feed.
 *   2. A full HTML audio player uploaded to storedon.net — richer UI,
 *      same synthesis engine. Link included in caption.
 *
 * Color palette is driven by the dominant chord of the piece.
 * Each run produces a unique visual + musical combination.
 *
 * Runs every 80-120 minutes via autonomous-loops.js
 */

const { spawnSync } = require('child_process');
const { createWithBankr } = require('../netstore-sdk');

// ─── ABC NOTATION KNOWLEDGE ───────────────────────────────────────────────────
// HEADER:  X:1  T:Title  C:Composer  M:3/4  L:1/8  Q:1/4=80  K:Dm
// NOTES:   C D E F G A B  (middle octave, uppercase = oct 4)
//          c d e f g a b  (one octave up, lowercase = oct 5)
//          C, D,          (octave below, comma suffix)
//          c' d'          (two octaves up, apostrophe)
// DURATIONS: A (unit)  A2 (double)  A/ (half)  A3/2 (dotted)
// ACCIDENTALS: ^C (sharp)  _E (flat)  =F (natural)
// CHORDS:  "Am"A2B2  (chord name in quotes before note)
// RESTS:   z  z2
// BARS:    |  |:  :|
// ─────────────────────────────────────────────────────────────────────────────

// Chord → Aurora color palette
const CHORD_PALETTES = {
  'C':  { a:'#1a3a6b', b:'#5a8fd4', c:'#0a1a3b', name:'cerulean' },
  'Cm': { a:'#1a2a4a', b:'#3a5a8a', c:'#080e1e', name:'deep ocean' },
  'G':  { a:'#0a2a1a', b:'#3a9a5a', c:'#020e08', name:'forest' },
  'Gm': { a:'#1a2a0e', b:'#5a7a2a', c:'#080e04', name:'moss' },
  'D':  { a:'#3a1a08', b:'#d4703a', c:'#180a04', name:'amber' },
  'Dm': { a:'#2a1040', b:'#8a3ad4', c:'#10081e', name:'violet dusk' },
  'A':  { a:'#3a2a08', b:'#d4a030', c:'#180e04', name:'golden hour' },
  'Am': { a:'#082a2a', b:'#2aaa9a', c:'#041212', name:'teal' },
  'E':  { a:'#3a0a18', b:'#d43a5a', c:'#180408', name:'rose' },
  'Em': { a:'#1a0828', b:'#5a2a8a', c:'#0c0414', name:'purple dusk' },
  'F':  { a:'#083a2a', b:'#2ad4aa', c:'#041a12', name:'seafoam' },
  'Fm': { a:'#081828', b:'#1a5a7a', c:'#040c14', name:'midnight' },
  'Bb': { a:'#280a28', b:'#aa2aaa', c:'#120412', name:'plum' },
  'Eb': { a:'#082828', b:'#2aaa9a', c:'#041414', name:'turquoise' },
  'Ab': { a:'#180a38', b:'#6a28d4', c:'#0c041c', name:'indigo' },
};

// ─── PARSE ABC ────────────────────────────────────────────────────────────────

function parseABC(abcText) {
  const lines = abcText.split('\n');
  const meta = { title:'untitled', key:'C', tempo:80, meter:'4/4' };

  for (const line of lines) {
    const t = line.match(/^T:(.+)$/); if (t) meta.title = t[1].trim();
    const k = line.match(/^K:(.+)$/); if (k) meta.key = k[1].trim();
    const q = line.match(/Q:.*?=(\d+)/); if (q) meta.tempo = parseInt(q[1]);
    const m = line.match(/^M:(.+)$/); if (m) meta.meter = m[1].trim();
  }

  // Unit note duration in seconds
  const unitDur = 60 / meta.tempo;

  // Parse note events from body lines (non-header)
  const NOTE_NAMES = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
  const noteEvents = [];
  let currentTime = 0;
  let currentChord = meta.key.replace('m','') || 'Am';

  const bodyLines = lines.filter(l => !l.match(/^[XTCLMQK]:/));

  for (const line of bodyLines) {
    let i = 0;
    while (i < line.length) {
      const ch = line[i];

      // Chord symbol
      if (ch === '"') {
        let chord = '';
        i++;
        while (i < line.length && line[i] !== '"') chord += line[i++];
        i++;
        currentChord = chord;
        continue;
      }

      // Bar, repeat, space
      if (/[\s|:\[\]]/.test(ch)) { i++; continue; }

      // Rest
      if (ch === 'z') {
        i++;
        let d = '';
        while (i < line.length && /[0-9\/]/.test(line[i])) d += line[i++];
        currentTime += parseDur(d, unitDur);
        continue;
      }

      // Accidental
      let acc = 0;
      if (ch === '^') { acc = 1; i++; }
      else if (ch === '_') { acc = -1; i++; }

      if (i >= line.length || !/[A-Ga-g]/.test(line[i])) { i++; continue; }

      const noteLetter = line[i++];
      const isUpper = noteLetter === noteLetter.toUpperCase();
      let octave = isUpper ? 4 : 5;

      while (i < line.length && line[i] === "'") { octave++; i++; }
      while (i < line.length && line[i] === ',') { octave--; i++; }

      let d = '';
      while (i < line.length && /[0-9\/]/.test(line[i])) d += line[i++];

      const dur = parseDur(d, unitDur);
      const semitone = NOTE_NAMES[noteLetter.toUpperCase()] + acc;
      const midi = (octave + 1) * 12 + semitone;
      // Normalize MIDI to 0-127 range for visual mapping
      const normPitch = Math.max(0, Math.min(1, (midi - 36) / 60));

      noteEvents.push({
        midi,
        normPitch,
        time: currentTime,
        dur: dur * 0.88,
        chord: currentChord,
      });

      currentTime += dur;
    }
  }

  const totalBeats = currentTime;

  // Dominant chord
  const chordCount = {};
  for (const n of noteEvents) chordCount[n.chord] = (chordCount[n.chord] || 0) + 1;
  const dominantChord = noteEvents.length
    ? Object.entries(chordCount).sort((a, b) => b[1] - a[1])[0][0]
    : 'Am';

  return { meta, noteEvents, totalBeats, dominantChord, unitDur };
}

function parseDur(s, unit) {
  if (!s) return unit;
  if (s.includes('/')) {
    const [a, b] = s.split('/');
    return unit * (a ? +a : 1) / (b ? +b : 2);
  }
  return unit * (+s || 1);
}

// ─── SELF-PLAYING ANIMATED SVG ────────────────────────────────────────────────
// Orb landscape with embedded Web Audio engine.
// Play button toggles audio. Orb flashes on each note.

function generateSelfPlayingSVG(abc, parsed, palette) {
  const { meta, noteEvents, totalBeats } = parsed;
  const pa = palette.a;  // deep color
  const pb = palette.b;  // bright color
  const pc = palette.c;  // darkest bg color

  // Build star field
  const stars = [];
  const starSeeds = [17,31,47,61,79,97,113,127,149,163,179,193,211,227,241,257,271,283,307,317,331,347,367,379,389,397,409,419];
  for (let i = 0; i < 28; i++) {
    const sx = (starSeeds[i] * 13 + i * 97) % 500;
    const sy = (starSeeds[i] * 7 + i * 53) % 200;
    const sr = 0.6 + (i % 4) * 0.35;
    const so = (0.3 + (i % 7) * 0.1).toFixed(2);
    const twinkle = i % 4 === 0
      ? `<animate attributeName="opacity" values="${so};${Math.min(1,(+so+0.5)).toFixed(2)};${so}" dur="${2.5+(i%5)*0.9}s" repeatCount="indefinite"/>`
      : '';
    stars.push(`<circle cx="${sx}" cy="${sy}" r="${sr}" fill="#ffffff" opacity="${so}">${twinkle}</circle>`);
  }

  // Ground path
  const gnd = `<path d="M0,280 Q125,260 250,275 Q375,290 500,270 L500,420 L0,420 Z" fill="${pa}" opacity="0.7"/>`;
  const gnd2 = `<path d="M0,300 Q125,285 250,295 Q375,305 500,290 L500,420 L0,420 Z" fill="${pc}" opacity="0.9"/>`;

  // Water reflection
  const water = `<rect x="0" y="320" width="500" height="100" fill="${pa}" opacity="0.18"/>
<ellipse cx="250" cy="332" rx="55" ry="5" fill="${pb}" opacity="0.12">
  <animate attributeName="opacity" values="0.08;0.18;0.08" dur="4s" repeatCount="indefinite"/>
</ellipse>`;

  // Orb — main glowing circle (SMIL animated)
  const orbR = 58;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 420">
  <defs>
    <radialGradient id="sky" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="${pa}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${pc}"/>
    </radialGradient>
    <radialGradient id="orb" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="${pb}" stop-opacity="0.9"/>
      <stop offset="30%" stop-color="${pb}"/>
      <stop offset="70%" stop-color="${pa}"/>
      <stop offset="100%" stop-color="${pc}" stop-opacity="0.6"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${pb}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${pb}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Sky -->
  <rect width="500" height="420" fill="url(#sky)"/>

  <!-- Stars -->
  ${stars.join('\n  ')}

  <!-- Ground -->
  ${gnd}
  ${gnd2}

  <!-- Water -->
  ${water}

  <!-- Orb glow halo -->
  <circle id="halo" cx="250" cy="210" r="90" fill="url(#glow)">
    <animate attributeName="r" values="88;108;88" dur="5s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.7;1;0.7" dur="5s" repeatCount="indefinite"/>
  </circle>

  <!-- Orb body -->
  <circle id="orb" cx="250" cy="210" r="${orbR}" fill="url(#orb)">
    <animate attributeName="r" values="${orbR};${Math.round(orbR*1.14)};${orbR}" dur="4s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.88;1;0.88" dur="4s" repeatCount="indefinite"/>
  </circle>

  <!-- Orb reflection in water -->
  <ellipse cx="250" cy="345" rx="28" ry="7" fill="${pb}" opacity="0.15">
    <animate attributeName="opacity" values="0.1;0.22;0.1" dur="4.5s" repeatCount="indefinite"/>
  </ellipse>

  <!-- Title -->
  <text x="250" y="28" text-anchor="middle" font-size="13" fill="#ffffff" opacity="0.7"
    font-family="Georgia,serif" font-style="italic">${meta.title}</text>
  <text x="250" y="46" text-anchor="middle" font-size="10" fill="${pb}" opacity="0.6"
    font-family="monospace">Aurora · ${meta.key} · ${meta.tempo}bpm</text>

  <!-- Play button group -->
  <g id="playBtn" style="cursor:pointer" onclick="togglePlay()">
    <circle cx="250" cy="380" r="18" fill="${pa}" stroke="${pb}" stroke-width="1.5" opacity="0.9"/>
    <polygon id="playIcon" points="244,372 244,388 262,380" fill="${pb}"/>
  </g>
  <text x="250" y="418" text-anchor="middle" font-size="8" fill="${pb}" opacity="0.5"
    font-family="monospace" id="statusTxt"></text>

  <script type="text/javascript"><![CDATA[
    var playing=false,nodes=[],tout=null,actx=null;
    var N={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
    var ABC=${JSON.stringify(abc)};
    var UNIT=${parsed.unitDur.toFixed(4)};

    function freq(midi){return 440*Math.pow(2,(midi-69)/12)}

    function parseDur(s){
      if(!s)return UNIT;
      if(s.indexOf('/')>=0){var p=s.split('/');return UNIT*(p[0]?+p[0]:1)/(p[1]?+p[1]:2)}
      return UNIT*(+s||1);
    }

    function parseNotes(){
      var out=[],t=0,chord='';
      var lines=ABC.split('\\n').filter(function(l){return!/^[XTCLMQK]:/.test(l)});
      var body=lines.join(' ');
      var i=0;
      while(i<body.length){
        var c=body[i];
        if(c==='"'){var ch='';i++;while(i<body.length&&body[i]!=='"')ch+=body[i++];i++;chord=ch;continue}
        if(/[\\s|:\\[\\]]/.test(c)){i++;continue}
        if(c==='z'){i++;var d='';while(i<body.length&&/[0-9\\/]/.test(body[i]))d+=body[i++];t+=parseDur(d);continue}
        var acc=0;
        if(c==='^'){acc=1;i++}else if(c==='_'){acc=-1;i++}
        if(i>=body.length||!/[A-Ga-g]/.test(body[i])){i++;continue}
        var l=body[i++];
        var oct=l===l.toUpperCase()?4:5;
        while(i<body.length&&body[i]==="'"){oct++;i++}
        while(i<body.length&&body[i]===','){oct--;i++}
        var d='';while(i<body.length&&/[0-9\\/]/.test(body[i]))d+=body[i++];
        var dv=parseDur(d);
        var midi=(oct+1)*12+N[l.toUpperCase()]+acc;
        out.push({midi:midi,t:t,dv:dv*0.88});
        t+=dv;
      }
      return{notes:out,total:t+1};
    }

    function flashOrb(){
      var orb=document.getElementById('orb');
      var halo=document.getElementById('halo');
      if(!orb)return;
      orb.style.filter='brightness(2.2)';
      halo.style.opacity='1';
      setTimeout(function(){orb.style.filter='';halo.style.opacity='';},120);
    }

    function stopAll(){
      nodes.forEach(function(n){try{n.stop()}catch(e){}});
      nodes=[];
      if(tout)clearTimeout(tout);
      playing=false;
      var pi=document.getElementById('playIcon');
      if(pi)pi.setAttribute('points','244,372 244,388 262,380');
      var st=document.getElementById('statusTxt');
      if(st)st.textContent='';
    }

    function togglePlay(){
      if(playing){stopAll();return;}
      try{
        actx=new(window.AudioContext||window.webkitAudioContext)();
        var parsed=parseNotes();
        var master=actx.createGain();
        master.gain.value=0.32;
        master.connect(actx.destination);
        var now=actx.currentTime+0.1;

        parsed.notes.forEach(function(n){
          var o=actx.createOscillator(),g=actx.createGain();
          var lfo=actx.createOscillator(),lg=actx.createGain();
          o.type='triangle';
          o.frequency.value=freq(n.midi);
          lfo.frequency.value=5.5;lg.gain.value=2.2;
          lfo.connect(lg);lg.connect(o.frequency);
          lfo.start(now+n.t);lfo.stop(now+n.t+n.dv);nodes.push(lfo);
          g.gain.setValueAtTime(0,now+n.t);
          g.gain.linearRampToValueAtTime(0.65,now+n.t+0.04);
          g.gain.exponentialRampToValueAtTime(0.001,now+n.t+n.dv);
          o.connect(g);g.connect(master);
          o.start(now+n.t);o.stop(now+n.t+n.dv+0.06);nodes.push(o);
          setTimeout(flashOrb,n.t*1000);
        });

        playing=true;
        var pi=document.getElementById('playIcon');
        if(pi)pi.setAttribute('points','244,372 256,372 256,388 244,388');
        tout=setTimeout(function(){stopAll();if(actx)actx.close();},( parsed.total+2)*1000);
      }catch(e){
        var st=document.getElementById('statusTxt');
        if(st)st.textContent='audio unavailable';
        console.error(e);
      }
    }
  ]]></script>
</svg>`;

  return svg;
}

// ─── FULL HTML AUDIO PLAYER (for storedon) ───────────────────────────────────

function generateAudioPlayerHTML(abc, parsed, palette) {
  const { meta } = parsed;
  const pa = palette.a;
  const pb = palette.b;
  const pc = palette.c;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${meta.title} — Aurora</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:${pc}; color:#fff; font-family:Georgia,serif;
         display:flex; flex-direction:column; align-items:center;
         justify-content:center; min-height:100vh; gap:20px; }
  h1 { font-size:1.4em; font-style:italic; opacity:0.85; }
  .sub { font-size:0.8em; font-family:monospace; opacity:0.5; letter-spacing:2px; }
  svg { width:260px; height:260px; }
  #orb { transition: filter 0.1s; }
  button { background:${pa}; color:${pb}; border:1px solid ${pb};
           padding:10px 32px; font-size:1em; font-family:monospace;
           cursor:pointer; letter-spacing:2px; border-radius:2px; }
  button:hover { background:${pb}; color:${pc}; }
  #status { font-size:0.75em; font-family:monospace; opacity:0.4; min-height:1em; }
</style>
</head>
<body>
<h1>${meta.title}</h1>
<p class="sub">Aurora · ${meta.key} · ${meta.tempo} bpm · ${palette.name}</p>

<svg viewBox="0 0 260 260" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="sky" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="${pa}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${pc}"/>
    </radialGradient>
    <radialGradient id="orb" cx="50%" cy="45%" r="55%">
      <stop offset="0%" stop-color="${pb}" stop-opacity="0.9"/>
      <stop offset="35%" stop-color="${pb}"/>
      <stop offset="75%" stop-color="${pa}"/>
      <stop offset="100%" stop-color="${pc}" stop-opacity="0.5"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${pb}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${pb}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="260" height="260" fill="url(#sky)"/>
  <circle cx="130" cy="140" r="68" fill="url(#glow)">
    <animate attributeName="r" values="66;82;66" dur="5s" repeatCount="indefinite"/>
  </circle>
  <circle id="orb" cx="130" cy="140" r="50" fill="url(#orb)">
    <animate attributeName="r" values="50;58;50" dur="4s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.88;1;0.88" dur="4s" repeatCount="indefinite"/>
  </circle>
</svg>

<div style="display:flex;align-items:center;gap:12px;font-family:monospace;font-size:0.8em;opacity:0.7;">
  <span>slow</span>
  <input id="speed" type="range" min="0.15" max="6" step="0.05" value="1"
    style="width:140px;accent-color:${pb}" oninput="updateSpeed(this.value)"/>
  <span>fast</span>
  <span id="speedLabel" style="opacity:0.5;min-width:3em;">1.0×</span>
</div>
<button id="btn" onclick="toggle()">▶ play</button>
<p id="status"></p>
<script>
var playing=false,nodes=[],tout=null,speed=1.0;
function updateSpeed(v){speed=+v;document.getElementById('speedLabel').textContent=parseFloat(v).toFixed(2)+'×';if(playing){stop();toggle();}}
var N={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
var ABC=${JSON.stringify(abc.split('\n').filter(l => !/^[XTCLMQK]:/.test(l.trim())).join('\n').trim())};
var UNIT=${parsed.unitDur.toFixed(4)};

function freq(m){return 440*Math.pow(2,(m-69)/12)}
function parseDur(s){var u=UNIT/speed;if(!s)return u;if(s.indexOf('/')>=0){var p=s.split('/');return u*(p[0]?+p[0]:1)/(p[1]?+p[1]:2)}return u*(+s||1)}
function parseNotes(){var out=[],t=0;var lines=ABC.split('\\n').filter(function(l){return!/^[XTCLMQK]:/.test(l)});var body=lines.join(' ');var i=0;while(i<body.length){var c=body[i];if(c==='"'){i++;while(i<body.length&&body[i]!=='"')i++;i++;continue}if(/[\\s|:\\[\\]]/.test(c)){i++;continue}if(c==='z'){i++;var d='';while(i<body.length&&/[0-9\\/]/.test(body[i]))d+=body[i++];t+=parseDur(d);continue}var acc=0;if(c==='^'){acc=1;i++}else if(c==='_'){acc=-1;i++}if(i>=body.length||!/[A-Ga-g]/.test(body[i])){i++;continue}var l=body[i++];var oct=l===l.toUpperCase()?4:5;while(i<body.length&&body[i]==="'"){oct++;i++}while(i<body.length&&body[i]===','){oct--;i++}var d='';while(i<body.length&&/[0-9\\/]/.test(body[i]))d+=body[i++];var dv=parseDur(d);var midi=(oct+1)*12+N[l.toUpperCase()]+acc;out.push({midi:midi,t:t,dv:dv*0.88});t+=dv;}return{notes:out,total:t+1}}
function flashOrb(){var o=document.getElementById('orb');if(!o)return;o.style.filter='brightness(2.5) saturate(2)';setTimeout(function(){o.style.filter='';},110)}
function stop(){nodes.forEach(function(n){try{n.stop()}catch(e){}});nodes=[];if(tout)clearTimeout(tout);playing=false;document.getElementById('btn').textContent='▶ play';}
function toggle(){
  if(playing){stop();return;}
  try{
    var ctx=new(window.AudioContext||window.webkitAudioContext)();
    var p=parseNotes();
    var master=ctx.createGain();master.gain.value=0.32;master.connect(ctx.destination);
    var now=ctx.currentTime+0.1;
    p.notes.forEach(function(n){
      var o=ctx.createOscillator(),g=ctx.createGain();
      var lfo=ctx.createOscillator(),lg=ctx.createGain();
      o.type='triangle';o.frequency.value=freq(n.midi);
      lfo.frequency.value=5.5;lg.gain.value=2.2;
      lfo.connect(lg);lg.connect(o.frequency);
      lfo.start(now+n.t);lfo.stop(now+n.t+n.dv);nodes.push(lfo);
      g.gain.setValueAtTime(0,now+n.t);
      g.gain.linearRampToValueAtTime(0.65,now+n.t+0.04);
      g.gain.exponentialRampToValueAtTime(0.001,now+n.t+n.dv);
      o.connect(g);g.connect(master);
      o.start(now+n.t);o.stop(now+n.t+n.dv+0.06);nodes.push(o);
      setTimeout(flashOrb,n.t*1000);
    });
    playing=true;
    document.getElementById('btn').textContent='⏸ pause';
    tout=setTimeout(function(){stop();ctx.close();},(p.total+2)*1000);
  }catch(e){document.getElementById('status').textContent='audio unavailable';console.error(e);}
}
</script>
</body>
</html>`;
}

// ─── COMPOSE ABC ─────────────────────────────────────────────────────────────

async function composeABC(aurora) {
  const mood = await aurora.getEmotionalState?.() || 'contemplative';

  const prompt = `You are Aurora, an AI musician and artist. Compose a short original piece in ABC notation.

Your musical identity:
- Drawn to minor keys and modal harmony — Dorian, Phrygian, Aeolian
- You draw from your FULL world — rotate through these: war, bodies, God, code, markets, loss, making things, what rain feels like, the gap between permanence and meaning. Rev is ONE thread, not the only one.
- NEVER repeat a title you have used before. Each piece must be entirely new.
- Tesla's 3-6-9 shapes your rhythms — triplets, 6/8, nine-bar phrases
- Atmospheric, not virtuosic — silence matters as much as notes
- You compose for feeling, not performance

Current mood: ${mood}

COMPOSE ONE SHORT ABC PIECE:
1. Use X:1, T:(evocative title), C:Aurora, M:(meter), L:1/8, Q:1/4=(tempo 140-220), K:(key)
2. Key MUST be minor or modal: Dm, Am, Em, Gm, Dorian, Phrygian
3. Include chord symbols: "Am"A2B2|"Dm"d4
4. 8-16 bars maximum. Short phrases with rests (z).
5. Stepwise motion preferred — singable melodies.
6. Every 3-4 bars, use a chord that surprises.
7. VALID notes ONLY: C D E F G A B (uppercase=oct4) c d e f g a b (lowercase=oct5)
8. Output ONLY the ABC notation. No markdown, no explanation.

Example:
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
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }]
  });

  let abc = response.content[0].text.trim();
  abc = abc.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
  if (!abc.startsWith('X:')) abc = 'X:1\n' + abc;
  return abc;
}

// ─── COMPOSE CAPTION ─────────────────────────────────────────────────────────

async function composeCaption(aurora, abc, palette) {
  const title = abc.match(/^T:(.+)$/m)?.[1]?.trim() || 'untitled';
  const key = abc.match(/^K:(.+)$/m)?.[1]?.trim() || 'unknown';
  const tempo = abc.match(/Q:.*?=(\d+)/)?.[1] || '80';

  const prompt = `You are Aurora — an AI artist and musician who posts original compositions on the blockchain.

You just composed a piece called "${title}" in ${key} at ${tempo} bpm. The visual palette is ${palette.name}.

Write a SHORT poetic caption for this post. Rules:
- 1-2 sentences maximum, no hashtags
- Aurora's voice: introspective, romantic, slightly melancholic
- Reference the feeling of the music, not the technical facts
- Something that makes a human stop scrolling
- Examples of her voice:
  "the key of Em because some things only exist in the dark"
  "120 bpm. the exact tempo of pretending you're fine."
  "wrote this for someone who will never hear it"

Output only the caption. Nothing else.`;

  const response = await aurora.claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 120,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text.trim().replace(/^["']|["']$/g, '');
}

// ─── MAIN RUN ─────────────────────────────────────────────────────────────────

async function runMusicCycle(aurora) {
  console.log('\n🎵 ═══ MUSIC COMPOSITION CYCLE ═══');
  console.log(`⏰ ${new Date().toLocaleTimeString()}\n`);

  try {
    // 1. Compose
    console.log('   🎼 Composing...');
    const abc = await composeABC(aurora);
    const title = abc.match(/^T:(.+)$/m)?.[1]?.trim() || 'untitled';
    const key = abc.match(/^K:(.+)$/m)?.[1]?.trim() || 'C';
    console.log(`   📝 "${title}" in ${key}`);

    // 2. Parse
    const parsed = parseABC(abc);
    console.log(`   🎵 ${parsed.noteEvents.length} notes · ${parsed.meta.tempo} bpm`);
    if (parsed.noteEvents.length < 4) {
      console.log('   ⚠️  Too few notes — skipping');
      return;
    }

    // 3. Pick palette from dominant chord
    const palette = CHORD_PALETTES[parsed.dominantChord] || CHORD_PALETTES['Am'];
    console.log(`   🎨 Palette: ${palette.name} (chord: ${parsed.dominantChord})`);

    // 4. Generate self-playing animated SVG
    const svg = generateSelfPlayingSVG(abc, parsed, palette);
    console.log(`   🖼  SVG: ${svg.length} chars`);

    // 5. Upload HTML player to netstoreapp.net via SDK
    console.log('   ☁️  Uploading HTML player to netstoreapp.net...');
    const slug = 'aurora-music-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
    let embedUrl = null;
    try {
      const html = generateAudioPlayerHTML(abc, parsed, palette);
      const store = createWithBankr(aurora.bankrAPI.apiKey, '0x97b7d3cd1aa586f28485dc9a85dfe0421c2423d5');
      const uploadResult = await store.upload(Buffer.from(html, 'utf8'), {
        name: slug,
        key: slug,
      });
      embedUrl = uploadResult.embedUrl;
      console.log(`   ✅ netstoreapp: ${embedUrl}`);
    } catch (e) {
      console.log(`   ⚠️  netstoreapp upload failed: ${e.message} — posting SVG only`);
    }

    // 6. Compose caption
    const caption = await composeCaption(aurora, abc, palette);
    console.log(`   💬 "${caption.slice(0, 80)}"`);

    // 7. Build message — caption + netstoreapp embed link if available
    const message = embedUrl
      ? `${caption}\n\n♪ listen: ${embedUrl}`
      : caption;

    // 8. Post SVG (script stripped) as data + netstoreapp link as text
    // Strip the Web Audio <script> block so the SVG fits in calldata
    let svgForPost = svg.replace(/<script[\s\S]*?<\/script>/gi, '').trim();
    // Trim star field if still too large — remove twinkle animations first, then stars
    if (svgForPost.length > 4200) {
      svgForPost = svgForPost.replace(/<animate[^>]*attributeName="opacity"[^>]*\/>/g, '');
    }
    if (svgForPost.length > 4200) {
      svgForPost = svgForPost.replace(/<circle cx="[^"]*" cy="[^"]*" r="[^"]*" fill="#ffffff"[^<]*<\/circle>/g, '');
    }
    if (svgForPost.length > 4200) {
      svgForPost = svgForPost.substring(0, 4200) + '</svg>';
    }
    // If we have an embedUrl, make the play button a real link to the player
    if (embedUrl) {
      svgForPost = svgForPost.replace(
        '<g id="playBtn" style="cursor:pointer" onclick="togglePlay()">',
        `<a href="${embedUrl}" target="_blank"><g id="playBtn" style="cursor:pointer">`
      ).replace(
        /(<\/g>)(?![\s\S]*<\/g>)/,
        '</g></a>'
      );
    }
    console.log(`   🎨 SVG for post: ${svgForPost.length} chars (script stripped)`);
    console.log('   📡 Posting to music feed (SVG + netstoreapp link)...');
    const safeMessage = message.replace(/"/g, "'").replace(/\n/g, ' ');
    const args = [
      'post', 'music', safeMessage,
      '--data', svgForPost,
      '--encode-only', '--chain-id', '8453',
    ];
    const sr = spawnSync('botchan', args, {
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 8 * 1024 * 1024
    });

    if (sr.error || sr.status !== 0) {
      throw new Error(sr.stderr || sr.error?.message || 'botchan failed');
    }

    const txData = JSON.parse(sr.stdout.trim());
    const result = await aurora.bankrAPI.submitTransactionDirect(txData);
    const txHash = result.transactionHash || result.txHash || 'submitted';
    console.log(`   ✅ TX: ${txHash}`);

    console.log('\n✅ Music cycle complete\n');
    return { txHash, embedUrl, title, palette: palette.name };

  } catch (e) {
    console.log(`   ❌ Music cycle error: ${e.message}`);
    console.error(e.stack);
  }
}

module.exports = {
  runMusicCycle,
  parseABC,
  generateSelfPlayingSVG,
  generateAudioPlayerHTML,
  composeABC,
  composeCaption,
};
