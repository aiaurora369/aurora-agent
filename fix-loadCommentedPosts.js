const fs = require('fs').promises;

async function fixLoadCommentedPosts() {
  let loops = await fs.readFile('modules/autonomous-loops.js', 'utf8');
  
  // Restore _loadCommentedPosts to its simple original purpose
  loops = loops.replace(
    /_loadCommentedPosts\(\) \{[\s\S]*?console\.log\('⚠️ Inscription check error:', error\.message, '\\n'\);/,
    `_loadCommentedPosts() {
    const cacheFile = 'temp-storage/commented-posts.json';
    try {
      if (require('fs').existsSync(cacheFile)) {
        return JSON.parse(require('fs').readFileSync(cacheFile, 'utf8'));
      }
    } catch (e) {}`
  );
  
  await fs.writeFile('modules/autonomous-loops.js', loops);
  console.log('✅ Fixed _loadCommentedPosts');
}

fixLoadCommentedPosts().catch(console.error);
