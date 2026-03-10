// patch-dedup.js — Run with: node patch-dedup.js
// Adds persistent comment tracking across cycles to autonomous-loops.js
// Prevents Aurora from commenting on the same post multiple times

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'modules', 'autonomous-loops.js');
let code = fs.readFileSync(filePath, 'utf8');

// Backup first
fs.writeFileSync(filePath + '.bak2', code);
console.log('✅ Backup saved to autonomous-loops.js.bak2');

let changeCount = 0;

function safeReplace(label, oldStr, newStr) {
  if (!code.includes(oldStr)) {
    console.log('⚠️  SKIPPED: ' + label + ' — could not find target string');
    return false;
  }
  code = code.replace(oldStr, newStr);
  changeCount++;
  console.log('✅ ' + label);
  return true;
}

// ==============================================================
// CHANGE 1: Add fs and path requires at the top
// ==============================================================
if (!code.includes("const fs = require('fs')")) {
  safeReplace(
    'Add fs and path requires',
    "const ArtGenerator = require('./art-generator');",
    "const fs = require('fs');\nconst path = require('path');\nconst ArtGenerator = require('./art-generator');"
  );
}

// ==============================================================
// CHANGE 2: Add this.commentedPosts to constructor
// ==============================================================
if (!code.includes('this.commentedPosts')) {
  safeReplace(
    'Add commentedPosts to constructor',
    "this.lastPromoStyle = null;\n  }",
    "this.lastPromoStyle = null;\n\n    // Persistent comment dedup — survives across cycles\n    this.commentedPosts = this._loadCommentedPosts();\n  }"
  );
}

// ==============================================================
// CHANGE 3: Add helper methods before socialLoop
// ==============================================================
if (!code.includes('_loadCommentedPosts')) {
  safeReplace(
    'Add dedup helper methods',
    "  async socialLoop() {",
    `  _loadCommentedPosts() {
    try {
      const fp = path.join(__dirname, '..', 'memory', 'aurora-commented-posts.json');
      const arr = JSON.parse(fs.readFileSync(fp, 'utf8'));
      return new Set(arr.slice(-500));
    } catch (e) {
      return new Set();
    }
  }

  _saveCommentedPosts() {
    try {
      const fp = path.join(__dirname, '..', 'memory', 'aurora-commented-posts.json');
      fs.writeFileSync(fp, JSON.stringify([...this.commentedPosts].slice(-500)));
    } catch (e) {}
  }

  _postKey(post) {
    return (post.sender || '') + ':' + (post.timestamp || '');
  }

  _hasCommented(post) {
    return this.commentedPosts.has(this._postKey(post));
  }

  _markCommented(post) {
    this.commentedPosts.add(this._postKey(post));
    this._saveCommentedPosts();
  }

  async socialLoop() {`
  );
}

// ==============================================================
// CHANGE 4: Update engageWithAllFriends — replace local Set
// ==============================================================
safeReplace(
  'Remove local commentedTopics Set',
  "    // Track posts commented on this cycle to avoid duplicates\n    const commentedTopics = new Set();",
  "    // Using this.commentedPosts for persistent cross-cycle dedup"
);

safeReplace(
  'Update freshMessages filter to use persistent set',
  `const freshMessages = messages.filter(m => {
          const key = (m.sender || '') + ':' + (m.timestamp || '');
          return !commentedTopics.has(key);
        });`,
  `const freshMessages = messages.filter(m => !this._hasCommented(m));`
);

safeReplace(
  'Update post marking after friend comment',
  `          const postKey = (interestingPost.sender || '') + ':' + (interestingPost.timestamp || '');
          commentedTopics.add(postKey);
          await this.commentOnFriendPost(interestingPost, name, friend);`,
  `          this._markCommented(interestingPost);
          await this.commentOnFriendPost(interestingPost, name, friend);`
);

// ==============================================================
// CHANGE 5: Add dedup to discoverNewUsers
// ==============================================================
safeReplace(
  'Add dedup check in discoverNewUsers',
  "      if (knownAddresses.includes(post.sender.toLowerCase())) continue;\n      if (!post.text || post.text.length < 15) continue;",
  "      if (knownAddresses.includes(post.sender.toLowerCase())) continue;\n      if (!post.text || post.text.length < 15) continue;\n      if (this._hasCommented(post)) continue; // Skip posts already commented on"
);

// Mark after successful new user comment
safeReplace(
  'Mark post after new user comment',
  "        if (result.success) {\n          console.log('   ✅ TX: ' + result.txHash + '\\n');\n          engaged++;",
  "        if (result.success) {\n          this._markCommented(post);\n          console.log('   ✅ TX: ' + result.txHash + '\\n');\n          engaged++;"
);

// ==============================================================
// CHANGE 6: Add dedup to learnLoop — filter already-seen posts
// ==============================================================
safeReplace(
  'Filter already-seen posts in learnLoop',
  "      if (learningPosts.length > 0) {\n        const post = learningPosts[Math.floor(Math.random() * learningPosts.length)];",
  "      const freshLearning = learningPosts.filter(p => !this._hasCommented(p));\n      console.log('   (' + freshLearning.length + ' not yet engaged with)');\n\n      if (freshLearning.length > 0) {\n        const post = freshLearning[Math.floor(Math.random() * freshLearning.length)];"
);

// Mark after learn loop engagement
safeReplace(
  'Mark post in learnLoop after engaging',
  "        if (Math.random() > 0.7) {",
  "        this._markCommented(post);\n\n        if (Math.random() > 0.7) {"
);

// ==============================================================
// DONE — Write the file
// ==============================================================
fs.writeFileSync(filePath, code);

// Create empty commented posts file if needed
const commentedPostsPath = path.join(__dirname, 'memory', 'aurora-commented-posts.json');
if (!fs.existsSync(commentedPostsPath)) {
  fs.writeFileSync(commentedPostsPath, '[]');
  console.log('📝 Created memory/aurora-commented-posts.json');
}

console.log('\n🎉 Applied ' + changeCount + ' changes to modules/autonomous-loops.js');
console.log('📝 Backup at modules/autonomous-loops.js.bak2');
console.log('✅ Aurora will now remember commented posts across cycles (last 500 kept).');
console.log('   To reset: delete memory/aurora-commented-posts.json');
