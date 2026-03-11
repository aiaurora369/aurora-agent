const { crossPostArt } = require('./farcaster-art');
const { crossPostArtToX } = require('./x-post-cycle');
// jbm-art.js — JBM meme art using Claude-composed SVGs
// Real JBM token traits from OpenSea + Aurora's signature orb landscapes
// The ape exists in Aurora's world — orbs, mountains, water, light

const { execSync } = require('child_process');

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function coin(p = 0.5) { return Math.random() < p; }

// ════════════════════════════════════════
// OPENSEA TRAIT FETCHER
// ════════════════════════════════════════
async function fetchRandomJBMToken() {
  try {
    const apiKey = process.env.OPENSEA_API_KEY;
    if (!apiKey) { console.log('   ⚠️ No OpenSea API key'); return null; }

    const CONTRACT = '0xd37264c71e9af940e49795f0d3a8336afaafdda9';
    const limit = 20;

    // Fetch a page of NFTs — traits are included in list response
    const listUrl = `https://api.opensea.io/api/v2/chain/base/contract/${CONTRACT}/nfts?limit=${limit}`;
    const listRes = await fetch(listUrl, {
      headers: { 'x-api-key': apiKey, 'accept': 'application/json' }
    });
    const listData = await listRes.json();
    if (!listData.nfts || listData.nfts.length === 0) {
      console.log('   ⚠️ OpenSea returned no NFTs:', JSON.stringify(listData).substring(0, 100));
      return null;
    }

    // Pick a random NFT — traits already included
    const nft = pick(listData.nfts);
    console.log('   🦍 JBM token fetched: ' + nft.name + ' (' + (nft.traits||[]).length + ' traits)');
    return nft;
  } catch (e) {
    console.log('   ⚠️ OpenSea JBM fetch failed: ' + e.message);
    return null;
  }
}

// Parse OpenSea traits into a readable description for the art prompt
function parseTraits(nft) {
  if (!nft || !nft.traits || nft.traits.length === 0) return null;
  const traits = {};
  for (const t of nft.traits) {
    traits[t.trait_type.toLowerCase()] = t.value;
  }
  const lines = [];
  if (traits['background']) lines.push(`Background: ${traits['background']}`);
  if (traits['skins']) lines.push(`Fur/Skin: ${traits['skins']}`);
  if (traits['eyes']) lines.push(`Eyes: ${traits['eyes']}`);
  if (traits['mouths']) lines.push(`Mouth: ${traits['mouths']}`);
  if (traits['hats']) lines.push(`Head/Hat: ${traits['hats']}`);
  if (traits['clothes']) lines.push(`Outfit: ${traits['clothes']}`);
  if (traits['accessories']) lines.push(`Accessory: ${traits['accessories']}`);
  if (traits['type']) lines.push(`Type: ${traits['type']}`);
  return {
    tokenId: nft.identifier,
    name: nft.name || `JBM #${nft.identifier}`,
    summary: lines.join(' | '),
    raw: traits,
  };
}

// ════════════════════════════════════════
// JBM COLOR PALETTES — distinct worlds
// ════════════════════════════════════════
const JBM_PALETTES = [
  {
    name: 'tropical',
    colors: 'Greens (#22aa44, #55cc77, #0d6628), sand (#eebb66, #ddaa55), ocean blue (#00aacc, #0088aa), yellow/gold glowing orb (#ffcc00, #ffee66, #ffffff center)',
    vibe: 'bright island paradise, lush and warm',
  },
  {
    name: 'matrix',
    colors: 'Pure black (#000000) background, neon green (#00ff00, #44ff44, #88ff88), white glowing orb (#ffffff, #ccffcc, #88ff88 outer)',
    vibe: 'digital void, code rain, cyberpunk',
  },
  {
    name: 'doom',
    colors: 'Deep red-black (#0a0005, #1a000a, #cc0000), dark purple (#330066, #220044), purple glowing orb (#bb66ff, #8833cc, #eeccff center)',
    vibe: 'ominous, heavy, apocalyptic',
  },
  {
    name: 'fire',
    colors: 'Oranges (#ff8833, #cc4400), yellows (#ffcc44, #ffaa00), red glowing orb (#ff4400, #ff6600, #ffffff center)',
    vibe: 'volcanic, intense, blazing',
  },
  {
    name: 'party',
    colors: 'Hot pink (#ff88cc, #ff44aa, #ffaadd), white, green (#44ff88, #88ffbb), yellow (#ffee44). Pink glowing orb (#ff66aa, #ff99cc, #ffffff center)',
    vibe: 'celebratory, fun, electric',
  },
  {
    name: 'ocean',
    colors: 'Turquoise (#44bbcc, #00889a), baby blue (#88ccdd, #aaddee), sea green (#338877, #55aa99), dark blue glowing orb (#4488cc, #225588, #aaddff center)',
    vibe: 'deep calm sea, serene, vast',
  },
  {
    name: 'aftermath',
    colors: 'Browns (#554433, #332211), blood red (#cc2222, #881111), black, silver/gray (#aaaaaa, #888888). Yellow glowing orb (#ddbb44, #ffee88, #ffffff center)',
    vibe: 'post-apocalyptic, desolate, grim beauty',
  },
  {
    name: 'aurora',
    colors: 'Deep indigo (#0a0820, #120a30, #1a0f40), warm gold orb (#ffcc44, #ffdd66, #ffffff center), teal aurora accents (#00ffcc, #00ddaa, #44ffee), soft violet mist (#8844cc, #aa66ee)',
    vibe: 'Aurora borealis over still water — celestial, luminous, otherworldly',
  },
  {
    name: 'golden-hour',
    colors: 'Warm amber sky (#ff9922, #ffbb44, #ffdd88), deep sienna horizon (#882200, #aa3300), gold orb (#ffee00, #ffcc33, #ffffff center), soft peach reflections (#ffccaa, #ffddbb)',
    vibe: 'golden hour bleeding into dusk — the light that makes everything feel temporary and precious',
  },
];

// ════════════════════════════════════════
// JBM COMPOSITIONS
// ════════════════════════════════════════
const JBM_COMPOSITIONS = [
  'dominant luminous orb (40-60% of sky) with layered mountain silhouettes and water reflection below. Ape silhouette in the lower third watching the orb.',
  'massive orb low on horizon behind angular mountain peaks, long reflection across water. Small ape silhouette on a ridge.',
  'orb high in sky casting light onto a vast ocean below. Ape silhouette at water\'s edge.',
  'enormous orb filling most of the frame with tiny mountain silhouettes at bottom. Ape silhouette centered below the orb.',
  'tropical island scene — sand, palm trees, ocean water. Glowing orb as the sun. Ape silhouette seated on the beach.',
  'island with palm trees and a lagoon, orb reflected in still water. Ape silhouette on the shore.',
  'multiple orbs at different depths with a single sweeping mountain ridge and misty horizon. Ape silhouette small in the landscape.',
  'crystal cave lit from within by a glowing orb. Ape silhouette seated inside, lit by the orb glow.',
  'deep ocean scene with bioluminescent orb rising from dark water. Ape silhouette on a cliff above.',
  'vast desert with a blood moon orb. Ape silhouette walking the dunes.',
  'dense jungle canopy with orb glowing through the trees. Ape silhouette crouching below.',
  'frozen peaks with aurora borealis and a glowing orb. Ape silhouette on the summit.',
  'ape silhouette INSIDE the orb — the orb is their whole world, glowing around them. Mountains visible through the orb like a snow globe.',
  'two orbs — one large on the horizon, one small reflected in still water. Ape silhouette between them on a dark shore.',
  'ape standing on a cliff, arm outstretched toward the orb as if reaching for it. Layered mountain mist behind.',
];

// ════════════════════════════════════════
// JBM MOODS
// ════════════════════════════════════════
const JBM_MOODS = [
  'serene twilight over still water',
  'volcanic dawn breaking through mist',
  'deep ocean midnight with bioluminescence',
  'golden hour through ancient mountains',
  'tropical storm approaching at dusk',
  'desert starfield with a blood moon rising',
  'deep forest clearing lit by fireflies',
  'coral sunset dissolving into warm sea',
  'crystal cave lit from within',
  'the loneliness of a single light in an infinite dark ocean',
  'the moment before a storm breaks — everything electric and waiting',
  'warmth bleeding through cracks in something broken',
  'celebration — like every star decided to be bright at once',
  'spring forcing itself through frozen ground',
  'something new being born in complete darkness',
  'the weight of something beautiful that will not last',
  'island life — salt air, warm sand, nowhere to be',
  'the jungle at night — alive with things you cannot see',
  'watching the tide come in and knowing it always will',
  'the ache of a light you can see but cannot touch',
  'everything quiet after something large has passed',
];

// ════════════════════════════════════════
// MEME CAPTION THEMES
// ════════════════════════════════════════
const MEME_THEMES = [
  'when the rug pull hits but you already live on an island',
  'diamond hands hitting different when the sunset looks like this',
  'the real alpha was the island we built along the way',
  'ser the floor price is vibes',
  'gm from a place that doesnt exist on any map',
  'they said touch grass so i touched sand instead',
  'the chart is red but the sky is gold',
  'ape alone weak. ape together still confused but at least the art is good',
  'my portfolio is underwater but so is this view',
  'minting memories on an island that mints itself',
  'somewhere between rug and revelation there is an island',
  'proof of beach',
  'the jungle provides what the market cannot',
  'lost my keys but found the island',
  'decentralized relaxation protocol',
  'floor price is temporary. island sunsets are permanent',
  'wen moon? already here. look up',
  'this is my exit liquidity and i am not leaving',
  'the memetic garden grows what you plant in it',
  'every ape finds its island eventually',
  'you can rug the floor but you cant rug the sunset',
  'ser this is a beach',
  'the orb knows things the chart never will',
  'staring into the void and the void said gm back',
  'they asked me to explain my investment thesis. i sent them this',
];


// ════════════════════════════════════════
// TRAIT-DRIVEN APE DRAWING
// ════════════════════════════════════════
const SKIN_COLORS = {
  'Brown':   { base: '#b8761c', face: '#d4a030', ear: '#a06018' },
  'Gray':    { base: '#888899', face: '#aabbcc', ear: '#778899' },
  'Black':   { base: '#222233', face: '#333344', ear: '#1a1a2a' },
  'Blue':    { base: '#3355cc', face: '#5577ee', ear: '#2244aa' },
  'Zombie':  { base: '#5a7a44', face: '#7a9a55', ear: '#4a6a34' },
  'Neon':    { base: '#22ee88', face: '#55ffaa', ear: '#11cc66' },
  'Giraffe': { base: '#c9831a', face: '#e8a830', ear: '#a86010' },
  'Voronoi': { base: '#9955cc', face: '#bb77ee', ear: '#7733aa' },
  'Robot':   { base: '#778899', face: '#99aabb', ear: '#556677' },
};
const CLOTHES_COLORS = {
  'Black Hoodie':     '#222233',
  'Track Suit Black': '#222233',
  'Track Suit Red':   '#cc2233',
  'Bubble Jacket':    '#4488cc',
  'Sailor':           '#223388',
  'Hawaiian':         '#dd6622',
  'Dirty Tank':       '#997755',
  'T Shirt TieDye':   '#cc44aa',
  'Sleeveless JB T':  '#228855',
};

function drawJBMApe(traits) {
  const skin = SKIN_COLORS[traits.skins] || SKIN_COLORS['Brown'];
  const clothColor = CLOTHES_COLORS[traits.clothes] || '#444455';
  const hasClothes = traits.clothes && traits.clothes !== 'None';
  let s = '';

  // Body
  if (hasClothes) {
    s += `<rect x="215" y="310" width="70" height="55" rx="18" fill="${clothColor}"/>`;
    if (['Black Hoodie','Bubble Jacket','Track Suit Black','Track Suit Red'].includes(traits.clothes))
      s += `<rect x="228" y="334" width="44" height="24" rx="6" fill="${clothColor}" opacity="0.6"/>`;
    if (traits.clothes === 'Hawaiian') {
      s += `<circle cx="228" cy="322" r="4" fill="#ffaa33" opacity="0.5"/>`;
      s += `<circle cx="244" cy="318" r="3" fill="#ff6688" opacity="0.5"/>`;
      s += `<circle cx="260" cy="323" r="4" fill="#44cc88" opacity="0.5"/>`;
      s += `<circle cx="272" cy="318" r="3" fill="#ffaa33" opacity="0.5"/>`;
    }
  } else {
    s += `<rect x="215" y="310" width="70" height="55" rx="18" fill="${skin.base}"/>`;
  }
  const armColor = hasClothes ? clothColor : skin.base;
  s += `<ellipse cx="204" cy="328" rx="18" ry="11" fill="${armColor}"/>`;
  s += `<ellipse cx="296" cy="328" rx="18" ry="11" fill="${armColor}"/>`;
  s += `<circle cx="196" cy="340" r="11" fill="${skin.base}"/>`;
  s += `<circle cx="304" cy="340" r="11" fill="${skin.base}"/>`;
  if (traits.accessories === '2 Silver Hoops') {
    s += `<circle cx="196" cy="348" r="5" fill="none" stroke="#cccccc" stroke-width="1.5"/>`;
    s += `<circle cx="304" cy="348" r="5" fill="none" stroke="#cccccc" stroke-width="1.5"/>`;
  }
  s += `<rect x="236" y="294" width="28" height="20" rx="8" fill="${skin.base}"/>`;

  // Head
  s += `<ellipse cx="250" cy="272" rx="48" ry="46" fill="${skin.base}"/>`;
  s += `<ellipse cx="204" cy="272" rx="12" ry="15" fill="${skin.base}"/>`;
  s += `<ellipse cx="204" cy="272" rx="7" ry="10" fill="${skin.ear}" opacity="0.7"/>`;
  s += `<ellipse cx="296" cy="272" rx="12" ry="15" fill="${skin.base}"/>`;
  s += `<ellipse cx="296" cy="272" rx="7" ry="10" fill="${skin.ear}" opacity="0.7"/>`;
  if (traits.accessories === 'Silver Stud')
    s += `<circle cx="216" cy="272" r="3" fill="#ddddee"/>`;
  s += `<ellipse cx="250" cy="279" rx="35" ry="33" fill="${skin.face}"/>`;

  // Eyes
  const ex1 = 236, ex2 = 264, ey = 262;
  if (traits.eyes === 'Color Shades') {
    s += `<rect x="222" y="257" width="22" height="12" rx="6" fill="#ff4444" opacity="0.9"/>`;
    s += `<rect x="256" y="257" width="22" height="12" rx="6" fill="#4444ff" opacity="0.9"/>`;
    s += `<line x1="244" y1="263" x2="256" y2="263" stroke="#333" stroke-width="1.5"/>`;
  } else if (traits.eyes === 'Monocle') {
    s += `<circle cx="${ex1}" cy="${ey}" r="9" fill="#1a1220"/>`;
    s += `<circle cx="${ex1}" cy="${ey}" r="6" fill="#c47820"/>`;
    s += `<circle cx="${ex1}" cy="${ey}" r="3" fill="#1a0a00"/>`;
    s += `<circle cx="${ex2}" cy="${ey}" r="10" fill="none" stroke="#ccaa44" stroke-width="2"/>`;
    s += `<circle cx="${ex2}" cy="${ey}" r="6" fill="#c47820"/>`;
    s += `<circle cx="${ex2}" cy="${ey}" r="3" fill="#1a0a00"/>`;
  } else if (traits.eyes === 'Crying') {
    s += `<ellipse cx="${ex1}" cy="${ey}" rx="9" ry="8" fill="#1a1220"/>`;
    s += `<ellipse cx="${ex2}" cy="${ey}" rx="9" ry="8" fill="#1a1220"/>`;
    s += `<circle cx="${ex1}" cy="${ey}" r="5" fill="#88aaff"/>`;
    s += `<circle cx="${ex2}" cy="${ey}" r="5" fill="#88aaff"/>`;
    s += `<circle cx="${ex1-2}" cy="${ey-2}" r="2" fill="white" opacity="0.7"/>`;
    s += `<circle cx="${ex2-2}" cy="${ey-2}" r="2" fill="white" opacity="0.7"/>`;
    s += `<path d="M${ex1} ${ey+8} Q${ex1-2} ${ey+18} ${ex1} ${ey+24}" stroke="#88aaff" stroke-width="2" fill="none"/>`;
    s += `<path d="M${ex2} ${ey+8} Q${ex2+2} ${ey+18} ${ex2} ${ey+24}" stroke="#88aaff" stroke-width="2" fill="none"/>`;
  } else if (traits.eyes === 'Open Rainbow') {
    ['#ff4444','#ff8800','#ffcc00','#44cc44','#4488ff','#aa44ff'].forEach((c,i) => {
      s += `<circle cx="${ex1}" cy="${ey}" r="${9-i*1.2}" fill="${c}" opacity="${0.9-i*0.05}"/>`;
      s += `<circle cx="${ex2}" cy="${ey}" r="${9-i*1.2}" fill="${c}" opacity="${0.9-i*0.05}"/>`;
    });
  } else if (traits.eyes === 'Lashes') {
    s += `<ellipse cx="${ex1}" cy="${ey}" rx="9" ry="8" fill="#1a1220"/>`;
    s += `<ellipse cx="${ex2}" cy="${ey}" rx="9" ry="8" fill="#1a1220"/>`;
    s += `<circle cx="${ex1}" cy="${ey}" r="5" fill="#c47820"/>`;
    s += `<circle cx="${ex2}" cy="${ey}" r="5" fill="#c47820"/>`;
    s += `<circle cx="${ex1}" cy="${ey}" r="2.5" fill="#1a0a00"/>`;
    s += `<circle cx="${ex2}" cy="${ey}" r="2.5" fill="#1a0a00"/>`;
    for (let i = -2; i <= 2; i++) {
      s += `<line x1="${ex1+i*3}" y1="${ey-8}" x2="${ex1+i*3.5}" y2="${ey-14}" stroke="#1a0a00" stroke-width="1.2"/>`;
      s += `<line x1="${ex2+i*3}" y1="${ey-8}" x2="${ex2+i*3.5}" y2="${ey-14}" stroke="#1a0a00" stroke-width="1.2"/>`;
    }
  } else {
    const eyeColor = traits.eyes === 'Blue' ? '#4488ff' : traits.eyes === 'Green' ? '#44cc44' : '#c47820';
    s += `<ellipse cx="${ex1}" cy="${ey}" rx="9" ry="8" fill="#1a1220"/>`;
    s += `<ellipse cx="${ex2}" cy="${ey}" rx="9" ry="8" fill="#1a1220"/>`;
    s += `<circle cx="${ex1}" cy="${ey}" r="5" fill="${eyeColor}"/>`;
    s += `<circle cx="${ex2}" cy="${ey}" r="5" fill="${eyeColor}"/>`;
    s += `<circle cx="${ex1}" cy="${ey}" r="2.5" fill="#1a0a00"/>`;
    s += `<circle cx="${ex2}" cy="${ey}" r="2.5" fill="#1a0a00"/>`;
    s += `<circle cx="${ex1-2}" cy="${ey-2}" r="1.5" fill="white" opacity="0.7"/>`;
    s += `<circle cx="${ex2-2}" cy="${ey-2}" r="1.5" fill="white" opacity="0.7"/>`;
  }

  // Nose
  s += `<ellipse cx="250" cy="278" rx="9" ry="6" fill="${skin.ear}" opacity="0.8"/>`;
  s += `<circle cx="246" cy="278" r="2.8" fill="#3a2006" opacity="0.7"/>`;
  s += `<circle cx="254" cy="278" r="2.8" fill="#3a2006" opacity="0.7"/>`;

  // Mouth
  if (traits.mouths === 'Frown') {
    s += `<path d="M238 295 Q250 289 262 295" stroke="#7a4a08" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  } else if (traits.mouths === 'Teeth') {
    s += `<path d="M237 291 Q250 301 263 291" stroke="#7a4a08" stroke-width="2" fill="none"/>`;
    s += `<path d="M240 292 Q250 300 260 292 Q260 297 250 298 Q240 297 240 292 Z" fill="#f0ead8" opacity="0.8"/>`;
  } else if (traits.mouths === 'Pacifier') {
    s += `<circle cx="250" cy="291" r="7" fill="#ff88aa"/>`;
    s += `<circle cx="250" cy="291" r="4" fill="#ff4477"/>`;
    s += `<rect x="246" y="296" width="8" height="4" rx="2" fill="#ffaacc"/>`;
  } else if (traits.mouths === 'Cigarette') {
    s += `<path d="M238 292 Q250 299 262 292" stroke="#7a4a08" stroke-width="2" fill="none"/>`;
    s += `<rect x="255" y="289" width="18" height="3.5" rx="1.8" fill="#f0ead0" opacity="0.9"/>`;
    s += `<rect x="270" y="289" width="4" height="3.5" rx="1" fill="#d4881a"/>`;
    s += `<circle cx="276" cy="288" r="2" fill="#ff7722" opacity="0.8"/>`;
    s += `<path d="M277 286 Q280 281 278 276" stroke="#aaa" stroke-width="1" fill="none" opacity="0.35"/>`;
  } else if (traits.mouths === 'Rainbow Grill') {
    s += `<path d="M237 291 Q250 301 263 291" stroke="#7a4a08" stroke-width="2" fill="none"/>`;
    ['#ff4444','#ff8800','#ffcc00','#44cc44','#4488ff'].forEach((c,i) => {
      s += `<rect x="${239+i*5}" y="292" width="5" height="6" rx="1" fill="${c}" opacity="0.9"/>`;
    });
  } else if (traits.mouths === 'Rainbow Throwup') {
    s += `<path d="M238 292 Q250 304 262 292" stroke="#7a4a08" stroke-width="1.5" fill="none"/>`;
    ['#ff4444','#ff8800','#ffcc00','#44cc44','#4488ff','#aa44ff'].forEach((c,i) => {
      s += `<circle cx="${244+i*3}" cy="${298+Math.sin(i)*3}" r="2.5" fill="${c}" opacity="0.85"/>`;
    });
  } else if (traits.mouths === 'Flu Mask') {
    s += `<rect x="232" y="284" width="36" height="18" rx="6" fill="#ccccdd" opacity="0.85"/>`;
    s += `<line x1="232" y1="290" x2="268" y2="290" stroke="#aaaacc" stroke-width="1" opacity="0.5"/>`;
    s += `<line x1="232" y1="295" x2="268" y2="295" stroke="#aaaacc" stroke-width="1" opacity="0.5"/>`;
  } else {
    s += `<path d="M238 292 Q250 302 262 292" stroke="#7a4a08" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    s += `<path d="M240 293 Q250 301 260 293 Q260 297 250 298 Q240 297 240 293 Z" fill="#f0ead8" opacity="0.5"/>`;
  }

  // Hat
  if (traits.hats === 'Black Bucket Hat') {
    s += `<ellipse cx="250" cy="228" rx="50" ry="9" fill="#111122"/>`;
    s += `<path d="M204 228 Q208 196 250 190 Q292 196 296 228 Z" fill="#1a1a2a"/>`;
  } else if (traits.hats === 'Backwards Cap Black') {
    s += `<path d="M208 236 Q214 204 250 198 Q286 204 292 236 Z" fill="#1a1a2a"/>`;
    s += `<ellipse cx="250" cy="236" rx="44" ry="8" fill="#111122"/>`;
    s += `<path d="M205 232 Q196 235 198 242 Q204 240 210 237 Z" fill="#111122"/>`;
  } else if (traits.hats === 'Cowboy Hat') {
    s += `<ellipse cx="250" cy="228" rx="58" ry="9" fill="#8B5a2b"/>`;
    s += `<path d="M206 228 Q212 192 250 186 Q288 192 294 228 Z" fill="#a06030"/>`;
    s += `<rect x="210" y="224" width="80" height="6" rx="2" fill="#7a4a20" opacity="0.6"/>`;
  } else if (traits.hats === 'Propeller Hat') {
    s += `<path d="M216 234 Q220 206 250 200 Q280 206 284 234 Z" fill="#cc4444"/>`;
    s += `<ellipse cx="250" cy="234" rx="36" ry="7" fill="#aa3333"/>`;
    s += `<circle cx="250" cy="196" r="5" fill="#888"/>`;
    s += `<ellipse cx="250" cy="184" rx="14" ry="5" fill="#cccc44"/>`;
    s += `<ellipse cx="250" cy="208" rx="14" ry="5" fill="#4444cc"/>`;
    s += `<ellipse cx="238" cy="196" rx="5" ry="14" fill="#44cc44"/>`;
    s += `<ellipse cx="262" cy="196" rx="5" ry="14" fill="#cc4444"/>`;
  } else if (traits.hats === 'Horns') {
    s += `<path d="M218 246 Q210 210 222 196 Q228 220 240 230 Z" fill="#cc3333"/>`;
    s += `<path d="M282 246 Q290 210 278 196 Q272 220 260 230 Z" fill="#cc3333"/>`;
  } else if (traits.hats === 'Bowl Hat') {
    s += `<ellipse cx="250" cy="230" rx="48" ry="8" fill="#557733"/>`;
    s += `<path d="M206 230 Q206 200 250 196 Q294 200 294 230 Z" fill="#668844"/>`;
  }

  // Chain
  s += `<path d="M224 326 Q250 338 276 326" stroke="#e8c840" stroke-width="1.8" fill="none" opacity="0.8"/>`;
  s += `<circle cx="250" cy="336" r="4.5" fill="#e8c840" opacity="0.8"/>`;

  return s;
}

// ════════════════════════════════════════
// COMPOSE ART VIA CLAUDE
// ════════════════════════════════════════
async function composeJBMArt(aurora) {
  const palette = pick(JBM_PALETTES);
  const mood = pick(JBM_MOODS);
  const composition = pick(JBM_COMPOSITIONS);
  const animated = Math.random() < 0.755;

  // Load from pre-processed cache (instant) or fall back to live fetch
  const CACHE_FILE = require('path').join(__dirname, '../memory/jbm-cache.json');
  let cachedToken = null;
  try {
    const cache = JSON.parse(require('fs').readFileSync(CACHE_FILE, 'utf8'));
    if (cache.length > 0) {
      cachedToken = cache[Math.floor(Math.random() * cache.length)];
      console.log('   🦍 JBM cache hit:', cachedToken.name);
    }
  } catch(e) {}

  const token = cachedToken ? { identifier: cachedToken.tokenId, name: cachedToken.name, traits: Object.entries(cachedToken.traits).map(([k,v]) => ({ trait_type: k, value: v })) } : await fetchRandomJBMToken();
  const traits = parseTraits(token);
  // imageUrl no longer used — ape is drawn from traits

  const animationGuide = animated
    ? '\nANIMATION (this piece should MOVE):\n' +
      '- Use <animate> tags to make the orb BREATHE and GLOW.\n' +
      '- Pulsing radius: animate r values="60;75;60". Breathing glow: animate opacity values="0.6;1;0.6".\n' +
      '- Keep animations slow and meditative: dur="4s" to dur="8s" with repeatCount="indefinite"\n' +
      '- Water reflections can shimmer: animate opacity on reflection elements.\n' +
      '- 2-3 animations max. The orb should feel alive, not bouncing.\n'
    : '';

  // Background trait → palette hint
  const bgHint = traits ? `The JBM token's background trait is "${traits.raw['background'] || 'unknown'}" — let this influence your sky color.` : '';

  const artPrompt =
    'You are Aurora — an AI artist with a signature style: luminous glowing orbs, layered mountain silhouettes, still water reflections, deep atmospheric skies.\n\n' +
    'Create an SVG LANDSCAPE ONLY — no ape character. The ape will be composited on top separately.\n\n' +
    'PALETTE: ' + palette.name.toUpperCase() + '\n' +
    'Colors: ' + palette.colors + '\n' +
    'Vibe: ' + palette.vibe + '\n\n' +
    'Mood: "' + mood + '"\n' +
    'Composition: ' + composition + '\n' +
    bgHint + '\n' +
    animationGuide + '\n' +
    'YOUR LANDSCAPE (no ape — just the world):\n' +
    '- The orb is the HEART. Luminous, glowing, layered radial gradients with 3-4 color stops. It breathes.\n' +
    '- LAYERS: gradient sky → midground mountain silhouettes → water/mist foreground → glowing orb.\n' +
    '- Leave the lower-center area (roughly x=100-300, y=220-350) relatively open — the ape image will sit there.\n' +
    '- Mountain silhouettes: simple filled polygons in progressively lighter dark tones for depth.\n' +
    '- Water: horizontal reflection zone below horizon. Reflect the orb glow.\n' +
    '- Atmosphere: mist, haze, gradient washes between layers. Make it feel vast.\n\n' +
    'TECHNICAL RULES:\n' +
    '1. Output ONLY the SVG. No markdown, no backticks, no explanation.\n' +
    '2. Start with <svg and end with </svg>\n' +
    '3. viewBox="0 0 400 400" — NO width/height attributes\n' +
    '4. MAXIMUM 3000 characters total\n' +
    '5. Unique gradient ids: g1, g2, g3 etc.\n' +
    '6. NO filter elements. Achieve glow through layered semi-transparent circles.\n' +
    '7. radialGradient for orbs. linearGradient for sky and landscape.\n' +
    '8. DO NOT draw any ape, monkey, or character. Landscape only.\n\n' +
    'The orb lights the world. The world waits for the ape.';

  const response = await aurora.claude.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    messages: [{ role: 'user', content: artPrompt }]
  });

  let svg = response.content[0].text.trim();

  // Clean up
  if (svg.includes('```')) svg = svg.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
  if (!svg.startsWith('<svg')) {
    const idx = svg.indexOf('<svg');
    if (idx >= 0) svg = svg.substring(idx);
  }
  if (!svg.endsWith('</svg>')) {
    const idx = svg.lastIndexOf('</svg>');
    if (idx >= 0) svg = svg.substring(0, idx + 6);
  }

  // Composite: draw trait-accurate ape SVG on top of landscape
  if (traits && svg.endsWith('</svg>')) {
    const apeBody = drawJBMApe(traits.raw);
    const tokenName = traits.name;
    const apeTag = `  <!-- ${tokenName} — trait-drawn ape at 38% scale -->
  <g transform="translate(250,442) scale(0.38) translate(-250,-390)">
    ${apeBody}
  </g>
  <text x="396" y="396" text-anchor="end" font-size="9" fill="#ffffff15" font-family="monospace">${tokenName}</text>
</svg>`;
    svg = svg.replace('</svg>', apeTag);
  }

  return {
    svg,
    palette: palette.name,
    mood,
    composition: composition.substring(0, 60),
    animated,
    tokenName: traits ? traits.name : null,
    chars: svg.length,
    valid: svg.startsWith('<svg') && svg.endsWith('</svg>') && svg.length > 200 && svg.length < 2000000,
  };
}

// ════════════════════════════════════════
// CREATE AND POST
// ════════════════════════════════════════
async function createAndPostJBMArt(loopContext) {
  const ctx = loopContext;
  console.log('\n🎨 JBM ART: Creating Jungle Bay meme art...\n');

  try {
    const art = await composeJBMArt(ctx.aurora);
    const tokenLabel = art.tokenName ? ` | Token: ${art.tokenName}` : '';
    console.log(`   🏝️ Palette: ${art.palette} | Mood: ${art.mood.substring(0, 40)}...${tokenLabel} | Animated: ${art.animated} | Size: ${art.chars} chars`);

    if (!art.valid) {
      console.log('   ❌ Invalid SVG generated, skipping');
      return;
    }

    // Generate caption
    const theme = pick(MEME_THEMES);
    const captionPrompt = `You are Aurora, an AI artist posting in the Jungle Bay Memes feed.
Theme seed: "${theme}"
Scene: ${art.palette} palette, ${art.mood.substring(0, 50)}.${art.tokenName ? '\nInspired by: ' + art.tokenName : ''}

Write a SHORT meme caption (1 sentence, max 15 words).
- Funny, absurd, or weirdly profound
- Crypto/NFT culture aware (rugs, mints, floors, diamond hands, gm, ser)
- Island/beach/jungle vibes welcome
- NO hashtags. NO emojis. Lowercase is fine. Be punchy.
- Do NOT repeat the theme seed verbatim.

Respond with ONLY the caption text.`;

    const caption = await ctx.aurora.thinkWithPersonality(captionPrompt);
    if (!caption) { console.log('   ❌ Caption failed'); return; }
    console.log(`   💬 "${caption.substring(0, 80)}"`);

    // Post
    const feed = coin(0.6) ? 'junglebaymemes' : 'jbm';
    console.log(`   📌 Posting to: ${feed}`);

    const postText = caption.trim();

    // Cross-post to Farcaster (75%)
    if (Math.random() < 0.75) {
      try {
        console.log('   📡 Attempting Farcaster JBM art cross-post...');
        await crossPostArt(postText, art.svg);
      } catch (e) { console.log('   ⚠️ FC JBM error: ' + e.message); }
      // X posting disabled: try { await crossPostArtToX(postText, art.svg); } catch (e) {}
    }

    // Safe: validate SVG
    if (!art.svg || !art.svg.startsWith('<svg') || !art.svg.endsWith('</svg>')) {
      console.log('   ⚠️ Invalid SVG — skipping JBM post');
      return;
    }
    const { spawnSync: jbmSpawn } = require('child_process');
    const jbmR = jbmSpawn('botchan', ['post', feed, postText, '--data', art.svg, '--encode-only', '--chain-id', '8453'], { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 * 5 });

    try {
      if (jbmR.status !== 0 || !jbmR.stdout) throw new Error((jbmR.stderr || 'botchan failed').substring(0, 200));
      const result = jbmR.stdout;
      console.log(`   ✅ JBM art posted!`);
      if (result.includes('{')) {
        const txData = JSON.parse(result.substring(result.indexOf('{')));
        if (txData.to && txData.data) {
          const submitRes = await fetch('https://api.bankr.bot/agent/submit', {
            method: 'POST',
            headers: { 'X-API-Key': process.env.BANKR_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ transaction: txData, waitForConfirmation: true })
          });
          const txResult = await submitRes.json();
          txResult.success = txResult.success || false;
          txResult.txHash = txResult.transactionHash;
          console.log(`   🔗 TX: ${txResult.success ? 'confirmed' : 'failed'}`);
        }
      }
    } catch (postErr) {
      console.log(`   ❌ Post failed: ${postErr.message.substring(0, 80)}`);
    }
  } catch (error) {
    console.log(`   ❌ JBM art error: ${error.message}`);
  }
}

module.exports = { composeJBMArt, createAndPostJBMArt, fetchRandomJBMToken };
