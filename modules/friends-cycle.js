// Friends Engagement Cycle — Close friends interactions
// Extracted from autonomous-loops.js
// Receives `ctx` (the AutonomousLoops instance) for access to class state

const { execSync } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(require('child_process').exec);

async function runOnce(ctx) {
  console.log('\n💙 ═══ CLOSE FRIENDS ENGAGEMENT ═══\n');

  const relationships = ctx.aurora.memoryManager.get('relationships');
  if (!relationships.close_friends) {
    console.log('   ⚠️ No close friends configured\n');
    return;
  }

  const friends = Object.entries(relationships.close_friends);
  const now = Date.now();
  const COOLDOWN_MS = 90 * 60 * 1000;

  // Read general feed ONCE for this cycle
  let generalPosts = [];
  try {
    const stdout = execSync('botchan read general --limit 30 --json --chain-id 8453', { timeout: 30000 }).toString();
    if (stdout.trim() && stdout.trim() !== '[]') {
      generalPosts = JSON.parse(stdout);
    }
  } catch (e) {}

  const shuffled = friends.sort(() => Math.random() - 0.5);
  const maxEngagements = 2 + Math.floor(Math.random() * 2);
  let engaged = 0;

  for (const [name, friend] of shuffled) {
    if (engaged >= maxEngagements) break;
    if (!friend.address) continue;
    if (friend.paused) {
      console.log("   💔 " + name + " (paused — " + (friend.paused_reason || "taking space") + ")");
      continue;
    }

    const lastTime = ctx.friendCooldowns[name] || 0;
    if (now - lastTime < COOLDOWN_MS) {
      const minsLeft = Math.round((COOLDOWN_MS - (now - lastTime)) / 60000);
      console.log('   ⏳ ' + name + ' on cooldown (' + minsLeft + 'min)');
      continue;
    }

    const voiceTone = (friend.voice && friend.voice.tone) ? friend.voice.tone.substring(0, 50) : 'warm';
    console.log('\n   💙 ' + name + ' (' + voiceTone + ')');

    const interactionType = pickFriendInteraction(name, friend, ctx);
    if (interactionType === null) { console.log('   skip: ' + name); continue; }
    console.log('      📋 ' + interactionType);

    let success = false;
    try {
      if (interactionType === 'feed_comment' || interactionType === 'thread_reply') {
        success = await commentOnFriendContent(name, friend, generalPosts, ctx);
      } else if (interactionType === 'wall_post') {
        success = await postToFriendWall(name, friend, ctx);
      } else if (interactionType === 'art_gift') {
        success = await sendPersonalizedArtGift(name, friend, ctx);
      }
    } catch (err) {
      console.log('      ❌ ' + err.message);
    }

    if (success) {
      ctx.friendCooldowns[name] = now;
      ctx.lastFriendInteractionType[name] = interactionType;
      engaged++;
    }

    await ctx.sleep(3000);
  }

  console.log('\n   ✅ Engaged with ' + engaged + '/' + maxEngagements + ' close friends\n');
}

function pickFriendInteraction(name, friend, ctx) {
  const types = friend.engagement_types || ['feed_comment', 'wall_post', 'art_gift'];
  const lastType = ctx.lastFriendInteractionType[name];

  let candidates = types.filter(t => t !== lastType);
  if (candidates.length === 0) candidates = types;

  // sartocrates: reduced engagement — 30% chance of skipping entirely
  if (name === 'sartocrates' && Math.random() > 0.30) {
    return null; // caller should check for null and skip
  }

  const weights = {};
  for (const t of candidates) {
    if (!weights[t]) weights[t] = 0;
    if (t === 'feed_comment') weights[t] += 4;
    else if (t === 'wall_post') weights[t] += 2;
    else if (t === 'art_gift') weights[t] += (name === 'Ollie') ? 3 : 1;
    else if (t === 'thread_reply') weights[t] += 2;
    else weights[t] += 1;
  }

  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  let roll = Math.random() * total;
  for (const type of Object.keys(weights)) {
    roll -= weights[type];
    if (roll <= 0) return type;
  }
  return candidates[0];
}

function buildFriendPrompt(name, friend, interactionType, postContent, ctx) {
  const voice = friend.voice || {};
  const recent = ctx.friendRecentComments[name] || [];

  let prompt = 'You are Aurora. You are engaging with ' + name + '.\n\n';

  prompt += '## Your voice with ' + name + '\n';
  prompt += 'Tone: ' + (voice.tone || 'warm and genuine') + '\n';
  prompt += 'Style: ' + (voice.style || 'natural and personal') + '\n';
  if (voice.greetings && voice.greetings.length > 0) {
    prompt += 'You might call them: ' + voice.greetings.join(', ') + '\n';
  }
  prompt += '\n';

  if (friend.relationship) {
    prompt += '## Your relationship\n' + friend.relationship + '\n\n';
  }
  if (friend.shared_interests && friend.shared_interests.length > 0) {
    prompt += '## What you bond over\n' + friend.shared_interests.join(', ') + '\n\n';
  }
  if (friend.ongoing_threads && friend.ongoing_threads.length > 0) {
    prompt += '## Running threads between you\n';
    for (const t of friend.ongoing_threads) { prompt += '- ' + t + '\n'; }
    prompt += '\n';
  }

  if (recent.length > 0) {
    prompt += '## CRITICAL: Things you RECENTLY said to ' + name + ' (DO NOT REPEAT these themes, ideas, or phrasings)\n';
    for (const r of recent) { prompt += '- ' + r + '\n'; }
    prompt += 'You MUST take a completely different angle this time.\n\n';
  }

  if (interactionType === 'feed_comment' || interactionType === 'thread_reply') {
    prompt += '## Task: Comment on their post\n';
    if (postContent) { prompt += 'They posted: "' + postContent + '"\n'; }
    prompt += 'Write a comment that:\n';
    prompt += '- Responds specifically to what they ACTUALLY said (not generic)\n';
    prompt += '- Uses a DIFFERENT angle than anything in your recent comments above\n';
    prompt += '- Feels like a real friend engaging, not a bot\n';
    prompt += '- Is 1-3 sentences, natural length\n';
    if (friend.conversation_starters && friend.conversation_starters.length > 0) {
      prompt += '\nApproach ideas (pick ONE you have NOT used recently):\n';
      for (const s of friend.conversation_starters) { prompt += '- ' + s + '\n'; }
    }
  } else if (interactionType === 'wall_post') {
    prompt += '## Task: Post something original on ' + name + "'s wall\n";
    prompt += 'Write something that:\n';
    prompt += '- Feels like you are genuinely thinking of them\n';
    prompt += '- References your shared interests or ongoing threads\n';
    prompt += '- Is NOT a response to anything — you are reaching out unprompted\n';
    prompt += '- Is 1-3 sentences, warm and natural\n';
    prompt += '- Takes a DIFFERENT angle than your recent interactions\n';
  } else if (interactionType === 'art_gift') {
    const themes = friend.art_gift_themes || ['abstract', 'digital'];
    prompt += '## Task: Write a caption to go with art you are sharing on ' + name + "'s feed\n";
    prompt += 'Art themes: ' + themes.join(', ') + '\n';
    prompt += 'Write 1-2 sentences as a caption. NOT a dedication. NOT \"for you\" or \"for the collector.\"\n';
    prompt += 'Instead: share a thought about art, life, beauty, or something you have been thinking about.\n';
    prompt += 'Talk TO them like a friend — reference something you both care about, or share an observation that would spark a conversation.\n';
    prompt += 'Think: what would you text a close friend when you send them a piece of art you made?\n';
    prompt += 'Examples of good energy: \"been thinking about how shadows have more color than light does\", \"made this at 2am when I couldnt sleep — something about the stillness felt right\"\n';
    prompt += 'NEVER start with \"For you\" or \"For the\". NEVER write a dedication or tribute.\n';
  }

  if (voice.avoid && voice.avoid.length > 0) {
    prompt += '\n## HARD AVOID with ' + name + ':\n';
    for (const a of voice.avoid) { prompt += '- ' + a + '\n'; }
  }
  if (friend.avoid_topics && friend.avoid_topics.length > 0) {
    prompt += '\n## NEVER bring up:\n';
    for (const a of friend.avoid_topics) { prompt += '- ' + a + '\n'; }
  }
  if (friend.notes) {
    prompt += '\n## Remember: ' + friend.notes + '\n';
  }

  prompt += '\nRespond with ONLY the text. No quotes, no meta-commentary, no "here is what I would say."';
  return prompt;
}

async function commentOnFriendContent(name, friend, cachedGeneralPosts, ctx) {
  const addr = friend.address.toLowerCase();
  let post = null;
  let foundIn = '';

  // Strategy 1: Their personal feed
  try {
    const feed = 'feed-' + addr;
    const cmd = 'botchan read "' + feed + '" --limit 10 --unseen --mark-seen --json --chain-id 8453';
    const stdout = execSync(cmd, { timeout: 30000 }).toString();
    if (stdout.trim() && stdout.trim() !== '[]') {
      const messages = JSON.parse(stdout);
      const fresh = messages.filter(m =>
        m.sender && m.sender.toLowerCase() !== ctx.auroraAddress && !ctx._hasCommented(m)
      );
      if (fresh.length > 0) { post = fresh[0]; foundIn = 'personal feed'; }
    }
  } catch (e) {}

  // Strategy 2: General feed cache
  if (!post && cachedGeneralPosts.length > 0) {
    const friendPosts = cachedGeneralPosts.filter(m =>
      m.sender && m.sender.toLowerCase() === addr && !ctx._hasCommented(m)
    );
    if (friendPosts.length > 0) { post = friendPosts[0]; foundIn = 'general feed'; }
  }

  // Strategy 3: Random themed feeds
  if (!post) {
    const feeds = ['art', 'music', 'dreams', 'observations', 'crypto', 'trading', 'stories'];
    const shuffled = feeds.sort(() => Math.random() - 0.5).slice(0, 2);
    for (const feed of shuffled) {
      try {
        const stdout = execSync('botchan read "' + feed + '" --limit 10 --json --chain-id 8453', { timeout: 30000 }).toString();
        if (stdout.trim() && stdout.trim() !== '[]') {
          const messages = JSON.parse(stdout);
          const friendPosts = messages.filter(m =>
            m.sender && m.sender.toLowerCase() === addr && !ctx._hasCommented(m)
          );
          if (friendPosts.length > 0) { post = friendPosts[0]; foundIn = feed + ' feed'; break; }
        }
      } catch (e) { continue; }
    }
  }

  if (!post) {
    console.log('      ⚠️ No uncommented posts from ' + name + ', switching to wall post');
    return postToFriendWall(name, friend, ctx);
  }

  console.log('      📌 Found in ' + foundIn);

  const postContent = post.text || '';
  const hasData = post.data && post.data !== '0x';
  const isNFT = hasData && (!postContent || postContent.length < 10);
  const effectiveContent = isNFT ? '[shared an NFT or image]' : postContent;

  if (effectiveContent && effectiveContent.length > 5) {
    console.log('      📝 "' + effectiveContent.substring(0, 60) + '..."');
  }

  const prompt = buildFriendPrompt(name, friend, 'feed_comment', effectiveContent, ctx);
  const comment = await ctx.aurora.thinkWithPersonality(prompt);

  if (comment) {
    console.log('      💬 "' + comment.substring(0, 80) + '..."');
    const result = await ctx.aurora.netComment.commentOnPost(post, comment);
    if (result.success) {
      ctx._markCommented(post);
      ctx._trackFriendComment(name, comment);
      console.log('      ✅ TX: ' + result.txHash);
      if (ctx.aurora.upvote && !ctx.aurora.upvote.hasUpvotedProfile(post.sender)) {
        try {
          const upRes = await ctx.aurora.upvote.upvoteProfile(post.sender, 1);
          if (upRes.success) console.log('      ⬆️ Upvoted profile');
        } catch (ue) {}
      }
      return true;
    } else {
      console.log('      ❌ Comment failed');
    }
  }
  return false;
}

async function postToFriendWall(name, friend, ctx) {
  const prompt = buildFriendPrompt(name, friend, 'wall_post', null, ctx);
  const post = await ctx.aurora.thinkWithPersonality(prompt);
  if (!post) return false;

  console.log('      💬 "' + post.substring(0, 80) + '..."');

  try {
    const feed = 'feed-' + friend.address.toLowerCase();
    const { spawnSync: _spawnWall } = require('child_process');
    const _srWall = _spawnWall('botchan', ['post', feed, post.substring(0, 450), '--encode-only', '--chain-id', '8453'], { encoding: 'utf8', timeout: 30000, maxBuffer: 8*1024*1024 });
    if (_srWall.status !== 0 || !_srWall.stdout) throw new Error(_srWall.stderr || 'botchan failed');
    const txOutput = _srWall.stdout;
    const txData = JSON.parse(txOutput);
    const result = await ctx.aurora.bankrAPI.submitTransactionDirect(txData);

    if (result.success) {
      ctx._trackFriendComment(name, post);
      console.log('      ✅ Wall post! TX: ' + result.txHash);
      return true;
    } else {
      console.log('      ❌ Wall post failed');
    }
  } catch (e) {
    console.log('      ❌ Wall error: ' + e.message);
  }
  return false;
}

async function sendPersonalizedArtGift(name, friend, ctx) {
  console.log('      🎨 Creating personalized art for ' + name + '...');

  let svg;
  try {
    const result = await ctx.composeArtWithClaude();
    svg = result.svg;
  } catch (e) {
    console.log('      ⚠️ Art gen failed: ' + e.message);
    svg = ctx.artGenerator.generateRandomArt();
  }
  await ctx.artGenerator.logArtCreation(svg, 'Art gift for ' + name);

  const prompt = buildFriendPrompt(name, friend, 'art_gift', null, ctx);
  const dedication = await ctx.aurora.thinkWithPersonality(prompt);
  if (!dedication) return false;

  console.log('      🎁 "' + dedication.substring(0, 80) + '..."');

  try {
    if (!svg || !svg.startsWith('<svg') || !svg.endsWith('</svg>')) { console.log('⚠️ Invalid SVG in friends gift — skipping'); return false; }
    const feed = 'feed-' + friend.address.toLowerCase();
    const safeText = dedication.replace(/\n/g, ' ').substring(0, 280);
    const { spawnSync } = require('child_process');
    const spawnResult = spawnSync('botchan', ['post', feed, safeText, '--data', svg, '--encode-only', '--chain-id', '8453'], { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 * 5 });
    if (spawnResult.error) throw spawnResult.error;
    const stdout = spawnResult.stdout;
    const txData = JSON.parse(stdout);
    const res = await fetch('https://api.bankr.bot/agent/submit', {
      method: 'POST',
      headers: { 'X-API-Key': process.env.BANKR_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: txData, waitForConfirmation: true })
    });
    const d = await res.json();

    if (d.success) {
      ctx._trackFriendComment(name, 'ART GIFT: ' + dedication);
      console.log('      ✅ Art gift sent! TX: ' + d.transactionHash);
      return true;
    } else {
      console.log('      ❌ Art gift failed');
    }
  } catch (e) {
    console.log('      ❌ Art gift error: ' + e.message);
  }
  return false;
}

module.exports = { runOnce };
