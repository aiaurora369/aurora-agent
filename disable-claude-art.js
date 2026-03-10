const fs = require('fs').promises;

async function disableClaudeArt() {
  let loops = await fs.readFile('modules/autonomous-loops.js', 'utf8');
  
  // Just always use generateRandomArt (skip the brain)
  loops = loops.replace(
    /try \{[\s\S]*?const studies = this\.aurora\.memoryManager\.get\('studies'\);[\s\S]*?const artSkill = studies && studies\.skills && studies\.skills\['digital-art-mastery'\];[\s\S]*?if \(artSkill && this\.aurora\.claude\) \{[\s\S]*?console\.log\('🧠 Creating art with art brain\.\.\.'\);[\s\S]*?svg = await this\.artGenerator\.generateArtWithBrain[\s\S]*?\} else \{[\s\S]*?svg = this\.artGenerator\.generateRandomArt\(\);[\s\S]*?\}[\s\S]*?\} catch \(artError\) \{[\s\S]*?console\.log\('⚠️ Art brain failed, using fallback: ' \+ artError\.message\);[\s\S]*?svg = this\.artGenerator\.generateRandomArt\(\);[\s\S]*?\}/,
    `// Always use procedural art generation (fast, reliable, beautiful)
      svg = this.artGenerator.generateRandomArt();`
  );
  
  await fs.writeFile('modules/autonomous-loops.js', loops);
  console.log('✅ Disabled Claude art, using procedural generation');
}

disableClaudeArt().catch(console.error);
