// JBM Art Module — Creates Jungle Bay themed SVG meme art
// Aurora's orb style meets tropical island ape culture
// Posts actual SVG art (not just text) to junglebaymemes/jbm feeds

const path = require('path');
const { execSync } = require('child_process');
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);

// Tropical color palettes
var PALETTES = [
  { name: 'sunset', sky1: '#ff6b35', sky2: '#f7c59f', sky3: '#2d1b69', water: '#1a5276', sand: '#f4d03f', orb: '#ff4500', orbGlow: '#ff8c00' },
  { name: 'moonlit', sky1: '#0f0c29', sky2: '#302b63', sky3: '#24243e', water: '#1b2838', sand: '#2c3e50', orb: '#e8d5b7', orbGlow: '#f5e6cc' },
  { name: 'neon-jungle', sky1: '#0a0a2e', sky2: '#1a1a4e', sky3: '#0d0d3b', water: '#0a2463', sand: '#1e3d59', orb: '#00ff88', orbGlow: '#00cc6a' },
  { name: 'golden-hour', sky1: '#ff9a56', sky2: '#ffcd94', sky3: '#c0392b', water: '#154360', sand: '#d4ac0d', orb: '#f39c12', orbGlow: '#e67e22' },
  { name: 'tropical-storm', sky1: '#2c3e50', sky2: '#4a6741', sky3: '#1a1a2e', water: '#1b4f72', sand: '#616a6b', orb: '#e74c3c', orbGlow: '#c0392b' },
  { name: 'vapor-island', sky1: '#a855f7', sky2: '#ec4899', sky3: '#3b0764', water: '#1e1b4b', sand: '#581c87', orb: '#f0abfc', orbGlow: '#d946ef' }
];

// Scene compositions
var SCENES = [
  'ape-watching-orb',     // ape silhouette on beach watching glowing orb rise
  'island-orbs',          // multiple orbs floating over a tropical island
  'palm-meditation',      // ape under palm tree with orb overhead
  'ocean-glow',           // orb reflected in tropical water, ape on cliff
  'jungle-portal',        // orbs forming a portal between palm trees
  'beach-campfire'        // ape by glowing orb-fire on beach
];

// Meme themes to pair with art
var MEME_THEMES = [
  'when the rug pull hits but you already live on an island',
  'diamond hands hitting different when the sunset looks like this',
  'ape alone with thoughts and a glowing orb',
  'the island doesnt care about your portfolio',
  'minting memories on the shore of nowhere',
  'who needs a roadmap when you have a beach',
  'the real alpha was the island we built along the way',
  'ser the floor price is vibes',
  'gm from the jungle where the orbs never set',
  'ape contemplates the void and finds it beautiful',
  'somewhere between degen and zen',
  'the market is temporary but the island is forever',
  'what if the real airdrop was this sunset',
  'ngmi at leaving this beach',
  'wen moon? the orb says now.'
];

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function buildPalmTree(x, baseY, height, lean) {
  var trunkTop = baseY - height;
  var cx = x + lean;
  // Simple trunk
  var trunk = '<path d="M' + x + ',' + baseY + ' Q' + (x + lean * 0.5) + ',' + (baseY - height * 0.5) + ' ' + cx + ',' + trunkTop + '" stroke="#5d4037" stroke-width="6" fill="none"/>';
  // Fronds
  var fronds = '';
  var angles = [-60, -30, 0, 30, 60, 90];
  for (var i = 0; i < angles.length; i++) {
    var a = angles[i];
    var rad = a * Math.PI / 180;
    var fx = cx + Math.cos(rad) * 35;
    var fy = trunkTop + Math.sin(rad) * 15 - 10;
    var mx = cx + Math.cos(rad) * 18;
    var my = trunkTop - 15;
    fronds += '<path d="M' + cx + ',' + trunkTop + ' Q' + mx + ',' + my + ' ' + fx + ',' + fy + '" stroke="#2e7d32" stroke-width="3" fill="none"/>';
  }
  return trunk + fronds;
}

function buildApeSilhouette(x, y, size) {
  var s = size || 1;
  // Simple ape: round head, body, sitting pose
  var head = '<circle cx="' + x + '" cy="' + (y - 18 * s) + '" r="' + (10 * s) + '" fill="#1a1a1a"/>';
  // Body
  var body = '<ellipse cx="' + x + '" cy="' + (y - 4 * s) + '" rx="' + (8 * s) + '" ry="' + (12 * s) + '" fill="#1a1a1a"/>';
  // Arms resting on knees
  var armL = '<path d="M' + (x - 8 * s) + ',' + (y - 8 * s) + ' Q' + (x - 14 * s) + ',' + (y + 2 * s) + ' ' + (x - 10 * s) + ',' + (y + 8 * s) + '" stroke="#1a1a1a" stroke-width="' + (3 * s) + '" fill="none"/>';
  var armR = '<path d="M' + (x + 8 * s) + ',' + (y - 8 * s) + ' Q' + (x + 14 * s) + ',' + (y + 2 * s) + ' ' + (x + 10 * s) + ',' + (y + 8 * s) + '" stroke="#1a1a1a" stroke-width="' + (3 * s) + '" fill="none"/>';
  // Legs tucked
  var legL = '<ellipse cx="' + (x - 6 * s) + '" cy="' + (y + 10 * s) + '" rx="' + (5 * s) + '" ry="' + (3 * s) + '" fill="#1a1a1a"/>';
  var legR = '<ellipse cx="' + (x + 6 * s) + '" cy="' + (y + 10 * s) + '" rx="' + (5 * s) + '" ry="' + (3 * s) + '" fill="#1a1a1a"/>';
  return head + body + armL + armR + legL + legR;
}

function buildGlowingOrb(cx, cy, r, color, glowColor, animated) {
  var orb = '<defs><radialGradient id="orbG' + cx + '">' +
    '<stop offset="0%" stop-color="white" stop-opacity="0.9"/>' +
    '<stop offset="40%" stop-color="' + color + '" stop-opacity="0.8"/>' +
    '<stop offset="100%" stop-color="' + glowColor + '" stop-opacity="0"/>' +
    '</radialGradient></defs>';
  // Outer glow
  orb += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 2.5) + '" fill="url(#orbG' + cx + ')" opacity="0.4"';
  if (animated) orb += '><animate attributeName="opacity" values="0.3;0.5;0.3" dur="4s" repeatCount="indefinite"/></circle>';
  else orb += '/>';
  // Core orb
  orb += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + color + '" opacity="0.9"';
  if (animated) orb += '><animate attributeName="r" values="' + r + ';' + (r * 1.1) + ';' + r + '" dur="5s" repeatCount="indefinite"/></circle>';
  else orb += '/>';
  // Hot center
  orb += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.3) + '" fill="white" opacity="0.7"/>';
  return orb;
}

function composeJBMScene() {
  var palette = randomFrom(PALETTES);
  var scene = randomFrom(SCENES);
  var animated = Math.random() < 0.6; // 60% animated for meme feeds
  var w = 400, h = 400;

  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '">';

  // Sky gradient
  svg += '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="' + palette.sky1 + '"/>' +
    '<stop offset="50%" stop-color="' + palette.sky2 + '"/>' +
    '<stop offset="100%" stop-color="' + palette.sky3 + '"/>' +
    '</linearGradient></defs>';
  svg += '<rect width="' + w + '" height="' + h + '" fill="url(#sky)"/>';

  // Water
  var waterY = h * 0.65;
  svg += '<rect x="0" y="' + waterY + '" width="' + w + '" height="' + (h - waterY) + '" fill="' + palette.water + '" opacity="0.7"/>';
  // Water shimmer lines
  for (var i = 0; i < 5; i++) {
    var wy = waterY + rand(10, h - waterY - 10);
    var wx = rand(20, w - 80);
    svg += '<line x1="' + wx + '" y1="' + wy + '" x2="' + (wx + rand(30, 80)) + '" y2="' + wy + '" stroke="' + palette.orbGlow + '" stroke-width="1" opacity="0.2"';
    if (animated) svg += '><animate attributeName="opacity" values="0.1;0.3;0.1" dur="' + (3 + i) + 's" repeatCount="indefinite"/></line>';
    else svg += '/>';
  }

  // Sand strip
  svg += '<ellipse cx="' + (w * 0.5) + '" cy="' + waterY + '" rx="' + (w * 0.6) + '" ry="15" fill="' + palette.sand + '" opacity="0.3"/>';

  // Island/mountains in background
  svg += '<path d="M0,' + waterY + ' Q80,' + (waterY - 40) + ' 160,' + waterY + '" fill="#1a472a" opacity="0.5"/>';
  svg += '<path d="M250,' + waterY + ' Q320,' + (waterY - 55) + ' 400,' + waterY + '" fill="#1a472a" opacity="0.4"/>';

  // Scene-specific elements
  var orbX, orbY, orbR;

  if (scene === 'ape-watching-orb' || scene === 'ocean-glow') {
    orbX = w * 0.6; orbY = h * 0.3; orbR = rand(25, 40);
    svg += buildGlowingOrb(orbX, orbY, orbR, palette.orb, palette.orbGlow, animated);
    // Orb reflection in water
    svg += '<ellipse cx="' + orbX + '" cy="' + (waterY + 30) + '" rx="' + (orbR * 0.8) + '" ry="' + (orbR * 0.3) + '" fill="' + palette.orb + '" opacity="0.2"/>';
    // Palm tree
    svg += buildPalmTree(rand(50, 100), waterY, rand(80, 120), rand(-15, 15));
    // Ape watching
    svg += buildApeSilhouette(rand(130, 180), waterY - 5, 1.2);
  } else if (scene === 'island-orbs') {
    // Multiple orbs over island
    svg += buildGlowingOrb(120, 100, 20, palette.orb, palette.orbGlow, animated);
    svg += buildGlowingOrb(280, 80, 30, palette.orb, palette.orbGlow, animated);
    svg += buildGlowingOrb(200, 140, 15, palette.orbGlow, palette.orb, animated);
    svg += buildPalmTree(80, waterY, 100, -10);
    svg += buildPalmTree(300, waterY, 90, 12);
    svg += buildApeSilhouette(190, waterY - 5, 1);
  } else if (scene === 'palm-meditation') {
    svg += buildPalmTree(200, waterY, 130, 0);
    orbX = 200; orbY = h * 0.2; orbR = 35;
    svg += buildGlowingOrb(orbX, orbY, orbR, palette.orb, palette.orbGlow, animated);
    svg += buildApeSilhouette(200, waterY - 5, 1.3);
  } else if (scene === 'jungle-portal') {
    svg += buildPalmTree(100, waterY, 120, -20);
    svg += buildPalmTree(300, waterY, 120, 20);
    // Portal orbs between trees
    svg += buildGlowingOrb(200, h * 0.35, 40, palette.orb, palette.orbGlow, animated);
    svg += buildGlowingOrb(200, h * 0.35, 20, 'white', palette.orb, animated);
    svg += buildApeSilhouette(200, waterY - 5, 1);
  } else if (scene === 'beach-campfire') {
    svg += buildPalmTree(60, waterY, 100, -15);
    // Campfire orb on ground
    svg += buildGlowingOrb(220, waterY - 15, 18, palette.orb, palette.orbGlow, animated);
    svg += buildApeSilhouette(190, waterY - 5, 1.2);
    svg += buildApeSilhouette(250, waterY - 5, 1);
  }

  // Stars (for night palettes)
  if (['moonlit', 'neon-jungle', 'vapor-island'].includes(palette.name)) {
    for (var s = 0; s < 20; s++) {
      svg += '<circle cx="' + rand(10, w - 10) + '" cy="' + rand(5, waterY - 30) + '" r="' + (Math.random() * 1.5 + 0.5) + '" fill="white" opacity="' + (Math.random() * 0.5 + 0.2) + '"/>';
    }
  }

  svg += '</svg>';

  return {
    svg: svg,
    palette: palette.name,
    scene: scene,
    animated: animated
  };
}

async function createAndPostJBMArt(loopContext) {
  console.log('\n   JBM ART: Creating Jungle Bay meme art...');

  var aurora = loopContext.aurora;
  var art = composeJBMScene();
  var memeTheme = randomFrom(MEME_THEMES);

  console.log('   Scene: ' + art.scene + ' | Palette: ' + art.palette + (art.animated ? ' | ANIMATED' : ''));

  // Get Aurora to write a meme caption inspired by the theme
  var captionPrompt = 'You are Aurora, making meme art for the Jungle Bay community — an NFT ape collective on the island.\n' +
    'Theme seed: "' + memeTheme + '"\n' +
    'Scene: An ape silhouette on a tropical island watching glowing orbs over the water.\n\n' +
    'Write a SHORT meme caption (1 sentence, max 15 words). It should be:\n' +
    '- Funny, absurd, or weirdly profound\n' +
    '- Crypto/NFT culture aware (rugs, mints, floors, diamond hands, gm)\n' +
    '- Island/beach/jungle vibes\n' +
    '- Could work as a meme caption on an image\n' +
    'NO hashtags. NO emojis. Lowercase is fine. Be punchy.';

  var caption = await aurora.thinkWithPersonality(captionPrompt);
  if (!caption) caption = memeTheme;

  console.log('   Caption: "' + caption + '"');

  // Post to junglebaymemes or jbm feed with SVG data
  var feed = Math.random() < 0.6 ? 'junglebaymemes' : 'jbm';

  try {
    var escapedCaption = (caption || 'ape watches orb').replace(/"/g, '\\"').replace(/\$/g, '\\$');
    var escapedSvg = art.svg.replace(/'/g, "'\"'\"'");
    var command = 'botchan post "' + feed + '" "' + escapedCaption + '" --data \'' + escapedSvg + '\' --encode-only --chain-id 8453';
    var result = await execAsync(command, { maxBuffer: 1024 * 1024 });
    var txData = JSON.parse(result.stdout);

    console.log('   Submitting JBM art to Bankr...');
    var submitResult = await aurora.bankrAPI.submitJob('Submit this transaction: ' + JSON.stringify(txData));
    if (submitResult.success) {
      var pollResult = await aurora.bankrAPI.pollJob(submitResult.jobId);
      if (pollResult.success) {
        console.log('   JBM art posted to ' + feed + '! TX: ' + ((pollResult.response || '').match(/0x[a-fA-F0-9]{64}/)?.[0] || 'unknown'));
      } else {
        console.log('   JBM post failed: ' + (pollResult.error || 'unknown'));
      }
    }
  } catch (e) {
    console.log('   JBM art post failed: ' + e.message);
  }
}

module.exports = { createAndPostJBMArt, composeJBMScene };
