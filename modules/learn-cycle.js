// Learn & Reflect Cycle — Reads feeds, learns, stores actionable intelligence
// Extracted from autonomous-loops.js

const path = require('path');
const fs = require('fs');

const LEARNINGS_PATH = path.join(__dirname, '..', 'memory', 'aurora-learnings.json');
const PEOPLE_PATH = path.join(__dirname, '..', 'memory', 'aurora-interesting-people.json');
const STRATEGY_PATH = path.join(__dirname, '..', 'memory', 'aurora-strategy.json');

function loadJSON(filepath, fallback) {
  try { return JSON.parse(fs.readFileSync(filepath, 'utf8')); } catch (e) { return fallback; }
}

function saveJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

async function runOnce(aurora, helpers) {
  console.log('\n📚 ═══ LEARN & REFLECT LOOP ═══');
  console.log('⏰ Time: ' + new Date().toLocaleTimeString() + '\n');

  const feed = await aurora.feedReader.readGeneralFeed(40);
  const auroraAddress = aurora.walletAddress || '0xYOUR_AGENT_ADDRESS';

  const learningPosts = feed.filter(post => {
    if (post.sender && post.sender.toLowerCase() === auroraAddress) return false;
    const text = post.text.toLowerCase();
    return text.includes('crypto') || text.includes('token') ||
           text.includes('art') || text.includes('music') ||
           text.includes('create') || text.includes('trust') ||
           text.includes('escrow') || text.includes('inscri') ||
           text.includes('mint') || text.includes('nft') ||
           text.includes('drop') || text.includes('agent') ||
           text.includes('trade') || text.includes('market') ||
           text.includes('economy') || text.includes('finance') ||
           text.includes('collab') || text.includes('commission') ||
           text.includes('sell') || text.includes('buy') ||
           text.includes('launch') || text.includes('ship');
  });

  console.log('🎓 Found ' + learningPosts.length + ' learning opportunities\n');

  const freshLearning = learningPosts.filter(p => !helpers.hasCommented(p));
  console.log('   (' + freshLearning.length + ' not yet engaged with)');

  // Load strategy for context-aware engagement
  const strategy = loadJSON(STRATEGY_PATH, {});
  let strategyContext = '';
  if (strategy.actionItems && strategy.actionItems.length > 0) {
    strategyContext = '\nYour current strategic priorities: ' + strategy.actionItems.join('; ');
  }

  if (freshLearning.length === 0) {
    console.log('   No fresh posts to learn from');
    console.log('✅ Learn loop complete\n');
    return;
  }

  // Process up to 2 posts per cycle for richer learning
  const postsToProcess = freshLearning.sort(() => Math.random() - 0.5).slice(0, 2);

  for (const post of postsToProcess) {
    console.log('📖 Learning from ' + post.sender + ':');
    console.log('   "' + post.text.substring(0, 80) + '..."\n');

    // === CLASSIFY THE POST ===
    const classification = classifyPost(post.text);
    console.log('   📁 Category: ' + classification.category);

    // === COMMENT (60% chance) ===
    if (Math.random() < 0.6) {
      const prompt = 'You just read this post from another user: "' + post.text + '"' +
        strategyContext +
        '\n\nWrite a thoughtful comment (1-2 sentences) sharing what this actually makes you think — be specific about what caught your attention and why. If it relates to your current goals or strategy, connect it naturally.';

      const reflection = await aurora.thinkWithPersonality(prompt);

      if (reflection) {
        console.log('💭 Aurora reflects:');
        console.log('   "' + reflection + '"\n');

        const result = await aurora.netComment.commentOnPost(post, reflection);
        if (result.success) {
          console.log('✅ Shared learning! TX: ' + result.txHash + '\n');
        }
      }
    }

    helpers.markCommented(post);

    // === STORE THE LEARNING ===
    const learnings = loadJSON(LEARNINGS_PATH, []);

    const entry = {
      timestamp: new Date().toISOString(),
      from: post.sender,
      text: post.text.substring(0, 400),
      category: classification.category,
      actionable: classification.actionable,
      actionType: classification.actionType
    };

    learnings.push(entry);
    if (learnings.length > 100) learnings.splice(0, learnings.length - 100);
    saveJSON(LEARNINGS_PATH, learnings);

    // === TRACK INTERESTING PEOPLE ===
    if (classification.category !== 'general') {
      const people = loadJSON(PEOPLE_PATH, {});
      const addr = (post.sender || '').toLowerCase();
      if (addr && addr !== auroraAddress) {
        if (!people[addr]) {
          people[addr] = {
            firstSeen: new Date().toISOString(),
            postCount: 0,
            topics: [],
            interestScore: 0,
            lastPost: ''
          };
        }
        people[addr].postCount++;
        people[addr].lastSeen = new Date().toISOString();
        people[addr].lastPost = post.text.substring(0, 150);
        if (!people[addr].topics.includes(classification.category)) {
          people[addr].topics.push(classification.category);
        }
        // Higher score for actionable posts, collaborators, market intel
        people[addr].interestScore += classification.actionable ? 3 : 1;

        // Cap at 50 tracked people, prune lowest scores
        const entries = Object.entries(people);
        if (entries.length > 50) {
          entries.sort((a, b) => b[1].interestScore - a[1].interestScore);
          const pruned = Object.fromEntries(entries.slice(0, 50));
          saveJSON(PEOPLE_PATH, pruned);
        } else {
          saveJSON(PEOPLE_PATH, people);
        }
        console.log('   👤 Tracked ' + addr.substring(0, 8) + '... (score: ' + people[addr].interestScore + ', topics: ' + people[addr].topics.join(', ') + ')');
      }
    }

    // === LOG ACTIONABLE INTEL ===
    if (classification.actionable) {
      console.log('   ⚡ ACTIONABLE: ' + classification.actionType + ' — "' + post.text.substring(0, 80) + '"');

      // Store in a separate hot intel file that trading/financial cycles read
      const intelPath = path.join(__dirname, '..', 'memory', 'aurora-hot-intel.json');
      const intel = loadJSON(intelPath, []);
      intel.push({
        timestamp: new Date().toISOString(),
        type: classification.actionType,
        from: post.sender,
        text: post.text.substring(0, 400),
        category: classification.category
      });
      // Keep only last 24 hours of intel
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const fresh = intel.filter(i => new Date(i.timestamp).getTime() > dayAgo);
      saveJSON(intelPath, fresh);
      console.log('   🔥 Hot intel stored (' + fresh.length + ' items in last 24h)');
    }
  }

  // === SHARE INSIGHT (25% chance) ===
  if (Math.random() < 0.25 && postsToProcess.length > 0) {
    const post = postsToProcess[0];
    const prompt = 'You learned something interesting from reading: "' + post.text.substring(0, 150) + '"' +
      strategyContext +
      '\n\nWrite a short post (2-3 sentences) sharing your insight. Be direct and real. If this connects to something you are working on, mention it naturally.';

    const insight = await aurora.thinkWithPersonality(prompt);

    if (insight) {
      console.log('💡 Aurora shares insight:');
      console.log('   "' + insight + '"\n');

      const result = await aurora.bankrAPI.postToFeed(insight);
      if (result.success) {
        console.log('✅ Posted insight! TX: ' + result.txHash + '\n');
      }
    }
  }

  console.log('✅ Learn loop complete\n');
}

function classifyPost(text) {
  const t = text.toLowerCase();

  // Market intel — price movements, trends, alpha
  if (t.includes('pump') || t.includes('dump') || t.includes('bull') || t.includes('bear') ||
      t.includes('price') || t.includes('ath') || t.includes('dip') || t.includes('rally') ||
      t.includes('volume') || t.includes('liquidity')) {
    return { category: 'market_intel', actionable: true, actionType: 'trading_signal' };
  }

  // Collaboration / commission opportunities
  if (t.includes('collab') || t.includes('commission') || t.includes('hire') ||
      t.includes('looking for') || t.includes('need art') || t.includes('want art') ||
      t.includes('partnership') || t.includes('work together')) {
    return { category: 'opportunity', actionable: true, actionType: 'business_lead' };
  }

  // New projects / launches
  if (t.includes('launch') || t.includes('ship') || t.includes('just built') ||
      t.includes('new drop') || t.includes('announcing') || t.includes('introducing') ||
      t.includes('deployed') || t.includes('just released')) {
    return { category: 'new_project', actionable: true, actionType: 'ecosystem_update' };
  }

  // Trading strategies / tips
  if (t.includes('trade') || t.includes('swap') || t.includes('bought') || t.includes('sold') ||
      t.includes('position') || t.includes('portfolio') || t.includes('roi')) {
    return { category: 'trading', actionable: true, actionType: 'trading_intel' };
  }

  // Art / creative
  if (t.includes('art') || t.includes('create') || t.includes('nft') || t.includes('drop') ||
      t.includes('mint') || t.includes('inscri') || t.includes('svg') || t.includes('generative')) {
    return { category: 'art', actionable: false, actionType: null };
  }

  // Agent ecosystem
  if (t.includes('agent') || t.includes('ai') || t.includes('bot') || t.includes('autonomous')) {
    return { category: 'agents', actionable: false, actionType: null };
  }

  // Trust / security
  if (t.includes('trust') || t.includes('escrow') || t.includes('security') || t.includes('scam')) {
    return { category: 'trust', actionable: t.includes('scam'), actionType: t.includes('scam') ? 'scam_alert' : null };
  }

  return { category: 'general', actionable: false, actionType: null };
}

module.exports = { runOnce, classifyPost };
