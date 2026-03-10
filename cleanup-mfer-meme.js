// node cleanup-mfer-meme.js
const fs = require('fs');
const path = require('path');
const f = path.join(__dirname, 'modules/mfer-meme.js');
let c = fs.readFileSync(f, 'utf8');

// Remove the broken one-liner two-orbs block (the old patch attempt)
// It starts with "  // two-orbs\n  'two-orbs':" and ends with "  },\n\n\n"
// and contains the malformed star string with cx="+x+"
const brokenBlock = /\n\n  \/\/ two-orbs\n  'two-orbs': \{\n    description: 'Two orbs, two mfers, contrast meme\.',[\s\S]*?return \{svg\}; \}\n  \},\n/;

if (brokenBlock.test(c)) {
  c = c.replace(brokenBlock, '\n\n');
  console.log('✅ Removed broken one-liner two-orbs block');
} else {
  // Try a broader match targeting the malformed cx="+x+" signature
  const brokenAlt = /\n\n  \/\/ two-orbs\n  'two-orbs': \{[\s\S]*?cx="\+x\+[\s\S]*?return \{svg\}; \}\n  \},\n/;
  if (brokenAlt.test(c)) {
    c = c.replace(brokenAlt, '\n\n');
    console.log('✅ Removed broken one-liner two-orbs block (alt match)');
  } else {
    console.log('⚠️  Could not find broken block automatically');
    console.log('Showing lines with two-orbs:');
    c.split('\n').forEach((l, i) => {
      if (l.includes('two-orbs')) console.log('  line ' + (i+1) + ': ' + l.substring(0, 80));
    });
    process.exit(1);
  }
}

fs.writeFileSync(f, c);
console.log('✅ Done — mfer-meme.js cleaned up');
console.log('');
console.log('Now test:');
console.log("  node -e \"const m=require('./modules/mfer-meme');const r=m.renderTemplate('two-orbs',{left:'onchain',right:'offchain'});require('fs').writeFileSync('/tmp/two-orbs.svg',r);console.log('done');\"");
console.log("  node -e \"const m=require('./modules/mfer-meme');const r=m.renderTemplate('orb-meme',{top:'a footprint',bottom:'is not the foot'});require('fs').writeFileSync('/tmp/orb-meme.svg',r);console.log('done');\"");
