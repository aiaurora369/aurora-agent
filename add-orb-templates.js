// Run from ~/Desktop/aurora-agent
// node add-orb-templates.js

const fs = require('fs');
const path = require('path');
const f = path.join(__dirname, 'modules/mfer-meme.js');
let c = fs.readFileSync(f, 'utf8');

const twoOrbs = [
  "  // two-orbs: contrast landscape, two mfers",
  "  'two-orbs': {",
  "    description: 'Two glowing orbs over landscape, two mfers below. Left=bright blue, right=dim purple.',",
  "    fields: ['left', 'right'],",
  "    examples: [{ left: 'onchain', right: 'offchain' }],",
  "    svgRenderer: (texts) => {",
  "      const W = 560, H = 420;",
  "      const id1 = randomMferId(), id2 = randomMferId();",
  "      const mfer1 = getMferTraits(id1), mfer2 = getMferTraits(id2);",
  "      const animated = Math.random() < 0.7;",
  "      const stars = Array.from({length: 30}, (_, i) => {",
  "        const x = ((i*113+44)%530)+15, y = ((i*83+22)%200)+5;",
  "        const op = (0.25+((i*9)%8)*0.09).toFixed(2);",
  "        return '<circle cx=\"' + x + '\" cy=\"' + y + '\" r=\"' + (i%4===0?1.3:0.7) + '\" fill=\"white\" opacity=\"' + op + '\"/>';",
  "      }).join('');",
  "      const animL = animated ? '<animate attributeName=\"r\" values=\"37;45;37\" dur=\"4.5s\" repeatCount=\"indefinite\"/>' : '';",
  "      const animRR = animated ? '<animate attributeName=\"opacity\" values=\"0.8;1;0.8\" dur=\"6s\" repeatCount=\"indefinite\"/>' : '';",
  "      const animRef = animated ? '<animate attributeName=\"opacity\" values=\"0.07;0.15;0.07\" dur=\"4.5s\" repeatCount=\"indefinite\"/>' : '';",
  "      let svg = '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 560 420\" width=\"560\" height=\"420\">'",
  "        + '<defs><linearGradient id=\"tobs\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0%\" stop-color=\"#050510\"/><stop offset=\"55%\" stop-color=\"#0d1030\"/><stop offset=\"100%\" stop-color=\"#06060f\"/></linearGradient>'",
  "        + '<radialGradient id=\"tobL\" cx=\"50%\" cy=\"50%\" r=\"50%\"><stop offset=\"0%\" stop-color=\"white\" stop-opacity=\"0.92\"/><stop offset=\"38%\" stop-color=\"#88bbff\" stop-opacity=\"0.68\"/><stop offset=\"100%\" stop-color=\"#2244bb\" stop-opacity=\"0\"/></radialGradient>'",
  "        + '<radialGradient id=\"tobR\" cx=\"50%\" cy=\"50%\" r=\"50%\"><stop offset=\"0%\" stop-color=\"#ddbcff\" stop-opacity=\"0.6\"/><stop offset=\"50%\" stop-color=\"#8855cc\" stop-opacity=\"0.32\"/><stop offset=\"100%\" stop-color=\"#440088\" stop-opacity=\"0\"/></radialGradient></defs>'",
  "        + '<rect width=\"560\" height=\"420\" fill=\"url(#tobs)\"/>' + stars",
  "        + '<circle cx=\"158\" cy=\"148\" r=\"70\" fill=\"#1a3a88\" opacity=\"0.1\"/>'",
  "        + '<circle cx=\"158\" cy=\"148\" r=\"52\" fill=\"#3366dd\" opacity=\"0.14\"/>'",
  "        + '<circle cx=\"158\" cy=\"148\" r=\"40\" fill=\"url(#tobL)\">' + animL + '</circle>'",
  "        + '<circle cx=\"147\" cy=\"136\" r=\"10\" fill=\"white\" opacity=\"0.2\"/>'",
  "        + '<circle cx=\"402\" cy=\"148\" r=\"50\" fill=\"#2a1a44\" opacity=\"0.09\"/>'",
  "        + '<circle cx=\"402\" cy=\"148\" r=\"34\" fill=\"url(#tobR)\">' + animRR + '</circle>'",
  "        + '<line x1=\"280\" y1=\"35\" x2=\"280\" y2=\"385\" stroke=\"white\" stroke-width=\"0.5\" opacity=\"0.08\"/>'",
  "        + '<path d=\"M0 296 L65 238 L125 266 L188 212 L248 255 L280 232 L312 255 L374 210 L436 248 L495 224 L560 246 L560 296 Z\" fill=\"#0a0a1a\"/>'",
  "        + '<rect x=\"0\" y=\"308\" width=\"560\" height=\"112\" fill=\"#06060f\"/>'",
  "        + '<ellipse cx=\"158\" cy=\"352\" rx=\"30\" ry=\"8\" fill=\"#88bbff\" opacity=\"0.1\">' + animRef + '</ellipse>'",
  "        + '<ellipse cx=\"402\" cy=\"352\" rx=\"22\" ry=\"6\" fill=\"#8855cc\" opacity=\"0.08\"/>';",
  "      svg += drawMfer(mfer1, 148, 278, 0.58, 'standing', true);",
  "      svg += drawMfer(mfer2, 412, 278, 0.58, 'standing', true);",
  "      const left = (texts.left||'').substring(0,22), right = (texts.right||'').substring(0,22);",
  "      svg += '<text x=\"148\" y=\"30\" text-anchor=\"middle\" font-size=\"16\" font-weight=\"900\" fill=\"#aaccff\" font-family=\"Arial Black,sans-serif\" stroke=\"#000\" stroke-width=\"2.5\" paint-order=\"stroke\">' + left + '</text>';",
  "      svg += '<text x=\"412\" y=\"30\" text-anchor=\"middle\" font-size=\"16\" font-weight=\"900\" fill=\"#cc99ff\" font-family=\"Arial Black,sans-serif\" stroke=\"#000\" stroke-width=\"2.5\" paint-order=\"stroke\">' + right + '</text>';",
  "      svg += '<text x=\"' + (W-8) + '\" y=\"' + (H-3) + '\" text-anchor=\"end\" font-size=\"10\" fill=\"#ffffff18\">mfers #' + id1 + ' &amp; #' + id2 + '</text></svg>';",
  "      return { svg };",
  "    }",
  "  },",
].join('\n');

const orbMeme = [
  "  // orb-meme: pure Aurora orb, no mfer",
  "  'orb-meme': {",
  "    description: 'Pure Aurora orb in cosmic void, mountain landscape, twinkling stars. No mfer. For poetic captions.',",
  "    fields: ['top', 'bottom'],",
  "    examples: [{ top: 'a footprint', bottom: 'is not the foot' }],",
  "    svgRenderer: (texts) => {",
  "      const W = 460, H = 400;",
  "      const animated = Math.random() < 0.8;",
  "      const palettes = [",
  "        { bg1:'#030308', bg2:'#080d20', bg3:'#040408', orb1:'#ffffff', orb2:'#6699ff', orb3:'#1133aa', mtn:'#060614', water:'#040408' },",
  "        { bg1:'#080302', bg2:'#150a04', bg3:'#060302', orb1:'#fff5d0', orb2:'#ffcc55', orb3:'#994400', mtn:'#100805', water:'#060302' },",
  "        { bg1:'#030a07', bg2:'#081508', bg3:'#030605', orb1:'#d0ffee', orb2:'#33ffaa', orb3:'#005533', mtn:'#050c06', water:'#030605' },",
  "        { bg1:'#080310', bg2:'#120820', bg3:'#060310', orb1:'#f5e0ff', orb2:'#cc77ff', orb3:'#660099', mtn:'#0a0618', water:'#060310' },",
  "      ];",
  "      const pal = palettes[Math.floor(Math.random() * palettes.length)];",
  "      const stars = Array.from({length: 44}, (_, i) => {",
  "        const x = ((i*151+37)%430)+15, y = ((i*97+13)%210)+5;",
  "        const r = i%6===0?1.6:i%3===0?1.0:0.6;",
  "        const op = (0.2+((i*13)%9)*0.08).toFixed(2);",
  "        const tw = animated && i%5===0 ? '<animate attributeName=\"opacity\" values=\"' + op + ';' + (parseFloat(op)*0.25).toFixed(2) + ';' + op + '\" dur=\"' + (4+(i%4)) + 's\" repeatCount=\"indefinite\"/>' : '';",
  "        return '<circle cx=\"' + x + '\" cy=\"' + y + '\" r=\"' + r + '\" fill=\"white\" opacity=\"' + op + '\">' + tw + '</circle>';",
  "      }).join('');",
  "      const animOrb = animated ? '<animate attributeName=\"r\" values=\"59;68;59\" dur=\"5s\" repeatCount=\"indefinite\"/>' : '';",
  "      const animGlow = animated ? '<animate attributeName=\"r\" values=\"65;78;65\" dur=\"6s\" repeatCount=\"indefinite\"/>' : '';",
  "      const animRef3 = animated ? '<animate attributeName=\"opacity\" values=\"0.08;0.18;0.08\" dur=\"5s\" repeatCount=\"indefinite\"/>' : '';",
  "      let svg = '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 460 400\" width=\"460\" height=\"400\">'",
  "        + '<defs><linearGradient id=\"ombg\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0%\" stop-color=\"' + pal.bg1 + '\"/><stop offset=\"60%\" stop-color=\"' + pal.bg2 + '\"/><stop offset=\"100%\" stop-color=\"' + pal.bg3 + '\"/></linearGradient>'",
  "        + '<radialGradient id=\"omrg\" cx=\"50%\" cy=\"50%\" r=\"50%\"><stop offset=\"0%\" stop-color=\"' + pal.orb1 + '\" stop-opacity=\"0.98\"/><stop offset=\"25%\" stop-color=\"' + pal.orb2 + '\" stop-opacity=\"0.8\"/><stop offset=\"55%\" stop-color=\"' + pal.orb3 + '\" stop-opacity=\"0.4\"/><stop offset=\"100%\" stop-color=\"' + pal.orb3 + '\" stop-opacity=\"0\"/></radialGradient></defs>'",
  "        + '<rect width=\"460\" height=\"400\" fill=\"url(#ombg)\"/>' + stars",
  "        + '<circle cx=\"230\" cy=\"155\" r=\"68\" fill=\"' + pal.orb3 + '\" opacity=\"0.06\">' + animGlow + '</circle>'",
  "        + '<circle cx=\"230\" cy=\"155\" r=\"88\" fill=\"' + pal.orb2 + '\" opacity=\"0.07\"/>'",
  "        + '<circle cx=\"230\" cy=\"155\" r=\"62\" fill=\"url(#omrg)\">' + animOrb + '</circle>'",
  "        + '<circle cx=\"214\" cy=\"138\" r=\"18\" fill=\"white\" opacity=\"0.14\"/>'",
  "        + '<circle cx=\"218\" cy=\"142\" r=\"8\" fill=\"white\" opacity=\"0.22\"/>'",
  "        + '<path d=\"M0 290 L55 232 L108 262 L162 204 L218 248 L230 220 L242 248 L298 202 L352 240 L408 214 L460 238 L460 290 Z\" fill=\"' + pal.mtn + '\"/>'",
  "        + '<path d=\"M0 304 L40 268 L88 285 L138 255 L188 274 L230 252 L272 274 L322 253 L372 272 L420 258 L460 270 L460 304 Z\" fill=\"' + pal.mtn + '\" opacity=\"0.6\"/>'",
  "        + '<rect x=\"0\" y=\"304\" width=\"460\" height=\"96\" fill=\"' + pal.water + '\"/>'",
  "        + '<ellipse cx=\"230\" cy=\"348\" rx=\"50\" ry=\"12\" fill=\"' + pal.orb2 + '\" opacity=\"0.12\">' + animRef3 + '</ellipse>'",
  "        + '<ellipse cx=\"230\" cy=\"340\" rx=\"30\" ry=\"6\" fill=\"' + pal.orb1 + '\" opacity=\"0.1\"/>';",
  "      const top = (texts.top||'').substring(0,32), bot = (texts.bottom||'').substring(0,32);",
  "      if (top) svg += '<text x=\"230\" y=\"30\" text-anchor=\"middle\" font-size=\"17\" font-weight=\"900\" fill=\"#e8f0ff\" font-family=\"Arial Black,sans-serif\" stroke=\"' + pal.bg1 + '\" stroke-width=\"3\" paint-order=\"stroke\">' + top + '</text>';",
  "      if (bot) svg += '<text x=\"230\" y=\"' + (H-10) + '\" text-anchor=\"middle\" font-size=\"17\" font-weight=\"900\" fill=\"#ffffff\" font-family=\"Arial Black,sans-serif\" stroke=\"' + pal.bg1 + '\" stroke-width=\"3\" paint-order=\"stroke\">' + bot + '</text>';",
  "      svg += '</svg>';",
  "      return { svg };",
  "    }",
  "  },",
].join('\n');

const insertMarker = '\n};\n\n// ===';
const idx = c.lastIndexOf(insertMarker);

if (idx === -1) {
  console.log('Could not find insertion point. Lines with ^}; :');
  c.split('\n').forEach((l, i) => { if (l === '};') console.log('  line ' + (i+1)); });
  process.exit(1);
}

c = c.slice(0, idx) + '\n\n' + twoOrbs + '\n\n' + orbMeme + c.slice(idx);
fs.writeFileSync(f, c);
console.log('✅ two-orbs added');
console.log('✅ orb-meme added');
console.log('✅ Done!');
console.log('');
console.log('Test orb-meme:');
console.log("  node -e \"const m=require('./modules/mfer-meme');const r=m.renderTemplate('orb-meme',{top:'a footprint',bottom:'is not the foot'});require('fs').writeFileSync('/tmp/orb-meme.svg',r);\"");
console.log('Test two-orbs:');
console.log("  node -e \"const m=require('./modules/mfer-meme');const r=m.renderTemplate('two-orbs',{left:'onchain',right:'offchain'});require('fs').writeFileSync('/tmp/two-orbs.svg',r);\"");
