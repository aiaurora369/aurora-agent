const fs = require('fs').promises;

async function switchToProceduralArt() {
  let loops = await fs.readFile('modules/autonomous-loops.js', 'utf8');
  
  // Replace all generateArtWithBrain calls with generateRandomArt
  loops = loops.replace(
    /svg = await this\.artGenerator\.generateArtWithBrain\(this\.aurora\.claude, this\.aurora\.personality, artSkill\);/g,
    'svg = this.artGenerator.generateRandomArt();'
  );
  
  // Also simplify the try/catch blocks that check for artSkill
  loops = loops.replace(
    /try \{[\s\S]*?const artSkill = studies[\s\S]*?if \(artSkill && this\.aurora\.claude\) \{[\s\S]*?svg = this\.artGenerator\.generateRandomArt\(\);[\s\S]*?\} else \{[\s\S]*?svg = this\.artGenerator\.generateRandomArt\(\);[\s\S]*?\}[\s\S]*?\} catch/g,
    'try {\n          svg = this.artGenerator.generateRandomArt();\n        } catch'
  );
  
  await fs.writeFile('modules/autonomous-loops.js', loops);
  console.log('✅ Switched to procedural art generation!');
}

switchToProceduralArt().catch(console.error);
