const fs = require('fs').promises;

async function fixOrphanedArt() {
  let loops = await fs.readFile('modules/autonomous-loops.js', 'utf8');
  
  // Remove the orphaned art lines from _loadCommentedPosts
  loops = loops.replace(
    /_loadCommentedPosts\(\) \{[\s\S]*?\/\/ Always use procedural art generation[\s\S]*?svg = this\.artGenerator\.generateRandomArt\(\);[\s\S]*?await this\.artGenerator\.logArtCreation\(svg, 'Original creation'\);[\s\S]*?\/\/ Load poetry skill/,
    `_loadCommentedPosts() {
    // Load poetry skill`
  );
  
  await fs.writeFile('modules/autonomous-loops.js', loops);
  console.log('✅ Removed orphaned art code');
}

fixOrphanedArt().catch(console.error);
