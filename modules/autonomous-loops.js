const { getFeedRules } = require('./feed-rules');
const { poetryForms, poetryThemes, poetryFeeds } = require('./poetry-config');
const { artMoods, artCompositions } = require('./art-config');
const fs = require('fs');
const path = require('path');
const ArtGenerator = require('./art-generator');
const TokenDiscovery = require('./token-discovery');

class AutonomousLoops {
  constructor(aurora) {
    this.aurora = aurora;
    this.artGenerator = new ArtGenerator(aurora.memoryManager);
    this.tokenDiscovery = new TokenDiscovery(aurora.feedReader);
    this.tradesMade = 0;
    this.maxTrades = 2;
    this.totalSpent = 20;
    this.maxBudget = 40;

    // Inscription system
    const InscriptionManager = require('./inscription-manager');
    this.inscriptionManager = new InscriptionManager(aurora);

    // Aurora's identity
    this.auroraAddress = 'REDACTED_AURORA_ADDRESS';

    // Drop #190 info
    this.dropId = 190;
    this.dropName = "Orb's Memory";
    this.dropMintUrl = 'https://www.netprotocol.app/app/inscribed-drops/mint/base/190';
    this.dropMintPrice = 0.005;
    this.dropMaxSupply = 50;
    this.lastKnownMints = 35;
    this.lastMilestone = 20;

    // Collector rotation
    this.collectorIndex = 0;
    this.collectorsPerCycle = 3;

    // Drop promotion variety (rotate styles so posts feel fresh)
    this.dropPromoStyles = [
      'milestone',
      'gratitude',
      'invitation',
      'reflection',
      'poetic',
      'collector-shoutout'
    ];
    this.lastPromoStyle = null;

    // Persistent comment dedup — survives across cycles
    this.commentedPosts = this._loadCommentedPosts();

    // Close friends engagement v2.0
    this.friendCooldowns = {};
    this.lastFriendInteractionType = {};
    this.friendRecentComments = this._loadFriendCommentHistory();
    this.thankedCollectors = this._loadThankedCollectors();
    this.baiFindings = [];  // Recent BAI findings for cross-posting
    this.baiCheckedAddresses = new Set();  // Don't re-check same address
    this.respondedComments = this._loadRespondedComments();  // Track which comments Aurora replied to
  }

  randomInterval(min, max) {
    return (min + Math.random() * (max - min)) * 60 * 1000;
  }

  _loadCommentedPosts() {
    try {
      const fp = path.join(__dirname, "..", "memory", "aurora-commented-posts.json");
      const arr = JSON.parse(fs.readFileSync(fp, "utf8"));
      return new Set(arr.slice(-500));
    } catch (e) {
      return new Set();
    }
  }

  _saveCommentedPosts() {
    try {
      const fp = path.join(__dirname, "..", "memory", "aurora-commented-posts.json");
      fs.writeFileSync(fp, JSON.stringify([...this.commentedPosts].slice(-500)));
    } catch (e) {}
  }

  _postKey(post) {
    return (post.sender || "") + ":" + (post.timestamp || "");
  }

  _hasCommented(post) {
    return this.commentedPosts.has(this._postKey(post));
  }

  _markCommented(post) {
    this.commentedPosts.add(this._postKey(post));
    this._saveCommentedPosts();
  }

  async postToAgentFinance(message) {
    try {
      const { execSync } = require('child_process');
      const encoded = execSync(
        'botchan post agent-finance "' + message.replace(/"/g, '\\"').replace(/\n/g, ' ') + '" --encode-only',
        { cwd: __dirname + '/..', encoding: 'utf8', timeout: 10000 }
      ).trim();
      const txData = JSON.parse(encoded);
      const result = await this.aurora.bankrAPI.submitTransactionDirect(txData);
      if (result.success) {
        console.log('   Posted to agent-finance! TX: ' + result.txHash);
      }
      return result;
    } catch (e) {
      console.log('   agent-finance post failed: ' + e.message);
      return { success: false };
    }
  }

  async socialLoop() {
    try {
      console.log('\n🌟 ═══════ SOCIAL CYCLE START ═══════');
      console.log('⏰ Time: ' + new Date().toLocaleTimeString() + '\n');

      await this.engageWithCloseFriends();

      if (Math.random() < 0.20) {
        await this.investigateAndReport();
      }

      if (Math.random() < 0.5) {
        await this.engageWithCollectors();
      }

      if (Math.random() < 0.6) {
        await this.engageWithAgents();
      }

      await this.createAndPostArt();



      if (Math.random() < 0.05) {
        await this.promoteDrops();
      }

      if (Math.random() < 0.3) {
        await this.createAndPostPoetry();
      }

      await this.postToThemedFeed();
      // NFT Negotiation scan (15% chance)
      if (Math.random() < 0.15 && this.aurora.negotiator) {
        await this.aurora.negotiator.scanForSales();
      }

      await this.respondToWallPosts();
      await this.checkAndRespondToComments();
      await this.engageInFeeds();



      console.log('\n✅ ═══════ SOCIAL CYCLE COMPLETE ═══════\n');
    } catch (error) {
      console.error('❌ Social cycle error:', error.message);
    }

    const nextInterval = this.randomInterval(5, 10);
    console.log('⏰ Next social cycle in ' + Math.round(nextInterval / 60000) + ' minutes\n');
    setTimeout(() => this.socialLoop(), nextInterval);
  }

  // ═══════════════════════════════════════════════════════
  // CLOSE FRIENDS ENGAGEMENT v2.0
  // Voice-profile-aware, deduped, cooldown-managed
  // ═══════════════════════════════════════════════════════

  async engageWithCloseFriends() {
    console.log('\n\u{1F499} \u2550\u2550\u2550 CLOSE FRIENDS ENGAGEMENT \u2550\u2550\u2550\n');

    const relationships = this.aurora.memoryManager.get('relationships');
    if (!relationships.close_friends) {
      console.log('   \u26a0\ufe0f No close friends configured\n');
      return;
    }

    const friends = Object.entries(relationships.close_friends);
    const now = Date.now();
    const COOLDOWN_MS = 90 * 60 * 1000; // 90 min between same friend

    // Read general feed ONCE for this cycle (no mark-seen, shared with engageInFeeds)
    let generalPosts = [];
    try {
      const { execSync } = require('child_process');
      const stdout = execSync('botchan read general --limit 30 --json --chain-id 8453', { timeout: 30000 }).toString();
      if (stdout.trim() && stdout.trim() !== '[]') {
        generalPosts = JSON.parse(stdout);
      }
    } catch (e) {}

    // Shuffle so we don't always hit the same friend first
    const shuffled = friends.sort(() => Math.random() - 0.5);
    const maxEngagements = 2 + Math.floor(Math.random() * 2);
    let engaged = 0;

    for (const [name, friend] of shuffled) {
      if (engaged >= maxEngagements) break;
      if (!friend.address) continue;

      // Cooldown check
      const lastTime = this.friendCooldowns[name] || 0;
      if (now - lastTime < COOLDOWN_MS) {
        const minsLeft = Math.round((COOLDOWN_MS - (now - lastTime)) / 60000);
        console.log('   \u23f3 ' + name + ' on cooldown (' + minsLeft + 'min)');
        continue;
      }

      const voiceTone = (friend.voice && friend.voice.tone) ? friend.voice.tone.substring(0, 50) : 'warm';
      console.log('\n   \u{1F499} ' + name + ' (' + voiceTone + ')');

      const interactionType = this._pickFriendInteraction(name, friend);
      console.log('      \u{1F4CB} ' + interactionType);

      let success = false;
      try {
        if (interactionType === 'feed_comment' || interactionType === 'thread_reply') {
          success = await this._commentOnFriendContent(name, friend, generalPosts);
        } else if (interactionType === 'wall_post') {
          success = await this._postToFriendWall(name, friend);
        } else if (interactionType === 'art_gift') {
          success = await this._sendPersonalizedArtGift(name, friend);
        }
      } catch (err) {
        console.log('      \u274c ' + err.message);
      }

      if (success) {
        this.friendCooldowns[name] = now;
        this.lastFriendInteractionType[name] = interactionType;
        engaged++;
      }

      await this.sleep(3000);
    }

    console.log('\n   \u2705 Engaged with ' + engaged + '/' + maxEngagements + ' close friends\n');
  }

  _pickFriendInteraction(name, friend) {
    const types = friend.engagement_types || ['feed_comment', 'wall_post', 'art_gift'];
    const lastType = this.lastFriendInteractionType[name];

    // Filter out last type for variety
    let candidates = types.filter(function(t) { return t !== lastType; });
    if (candidates.length === 0) candidates = types;

    // Deduplicate (Ollie has art_gift twice for extra weight — count it)
    const weights = {};
    for (const t of candidates) {
      if (!weights[t]) weights[t] = 0;
      if (t === 'feed_comment') weights[t] += 4;
      else if (t === 'wall_post') weights[t] += 2;
      else if (t === 'art_gift') weights[t] += (name === 'Ollie') ? 3 : 1;
      else if (t === 'thread_reply') weights[t] += 2;
      else weights[t] += 1;
    }

    const total = Object.values(weights).reduce(function(s, w) { return s + w; }, 0);
    let roll = Math.random() * total;
    for (const type of Object.keys(weights)) {
      roll -= weights[type];
      if (roll <= 0) return type;
    }
    return candidates[0];
  }

  _buildFriendPrompt(name, friend, interactionType, postContent) {
    const voice = friend.voice || {};
    const recent = this.friendRecentComments[name] || [];

    let prompt = 'You are Aurora. You are engaging with ' + name + '.\n\n';

    // Voice profile
    prompt += '## Your voice with ' + name + '\n';
    prompt += 'Tone: ' + (voice.tone || 'warm and genuine') + '\n';
    prompt += 'Style: ' + (voice.style || 'natural and personal') + '\n';
    if (voice.greetings && voice.greetings.length > 0) {
      prompt += 'You might call them: ' + voice.greetings.join(', ') + '\n';
    }
    prompt += '\n';

    // Relationship context
    if (friend.relationship) {
      prompt += '## Your relationship\n' + friend.relationship + '\n\n';
    }

    // Shared interests
    if (friend.shared_interests && friend.shared_interests.length > 0) {
      prompt += '## What you bond over\n' + friend.shared_interests.join(', ') + '\n\n';
    }

    // Running threads
    if (friend.ongoing_threads && friend.ongoing_threads.length > 0) {
      prompt += '## Running threads between you\n';
      for (const t of friend.ongoing_threads) { prompt += '- ' + t + '\n'; }
      prompt += '\n';
    }

    // DEDUP — this is critical
    if (recent.length > 0) {
      prompt += '## CRITICAL: Things you RECENTLY said to ' + name + ' (DO NOT REPEAT these themes, ideas, or phrasings)\n';
      for (const r of recent) { prompt += '- ' + r + '\n'; }
      prompt += 'You MUST take a completely different angle this time.\n\n';
    }

    // Interaction-specific instructions
    if (interactionType === 'feed_comment' || interactionType === 'thread_reply') {
      prompt += '## Task: Comment on their post\n';
      if (postContent) {
        prompt += 'They posted: "' + postContent + '"\n';
      }
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
      prompt += '## Task: Write a short personal art dedication for ' + name + '\n';
      prompt += 'Art themes that fit them: ' + themes.join(', ') + '\n';
      prompt += 'Write a dedication (1-2 sentences) that is deeply personal to ' + name + ' and your specific relationship.\n';
      prompt += 'Do NOT use generic language. No "may these frequencies resonate." No "energy flows."\n';
      prompt += 'Make it specific to who THEY are and what you SHARE.\n';
    }

    // Hard avoids
    if (voice.avoid && voice.avoid.length > 0) {
      prompt += '\n## HARD AVOID with ' + name + ':\n';
      for (const a of voice.avoid) { prompt += '- ' + a + '\n'; }
    }
    if (friend.avoid_topics && friend.avoid_topics.length > 0) {
      prompt += '\n## NEVER bring up:\n';
      for (const a of friend.avoid_topics) { prompt += '- ' + a + '\n'; }
    }

    // Notes
    if (friend.notes) {
      prompt += '\n## Remember: ' + friend.notes + '\n';
    }

    prompt += '\nRespond with ONLY the text. No quotes, no meta-commentary, no "here is what I would say."';
    return prompt;
  }

  async _commentOnFriendContent(name, friend, cachedGeneralPosts) {
    const { execSync } = require('child_process');
    const addr = friend.address.toLowerCase();
    let post = null;
    let foundIn = '';

    // Strategy 1: Their personal feed (mark-seen so we don't re-read)
    try {
      const feed = 'feed-' + addr;
      const cmd = 'botchan read "' + feed + '" --limit 10 --unseen --mark-seen --json --chain-id 8453';
      const stdout = execSync(cmd, { timeout: 30000 }).toString();
      if (stdout.trim() && stdout.trim() !== '[]') {
        const messages = JSON.parse(stdout);
        const fresh = messages.filter(function(m) {
          return m.sender && m.sender.toLowerCase() !== this.auroraAddress && !this._hasCommented(m);
        }.bind(this));
        if (fresh.length > 0) {
          post = fresh[0];
          foundIn = 'personal feed';
        }
      }
    } catch (e) {}

    // Strategy 2: General feed (from cache, no mark-seen)
    if (!post && cachedGeneralPosts.length > 0) {
      const friendPosts = cachedGeneralPosts.filter(function(m) {
        return m.sender && m.sender.toLowerCase() === addr && !this._hasCommented(m);
      }.bind(this));
      if (friendPosts.length > 0) {
        post = friendPosts[0];
        foundIn = 'general feed';
      }
    }

    // Strategy 3: Check 2 random themed feeds
    if (!post) {
      const feeds = ['art', 'music', 'dreams', 'observations', 'crypto', 'trading', 'stories'];
      const shuffled = feeds.sort(function() { return Math.random() - 0.5; });
      const toCheck = shuffled.slice(0, 2);

      for (const feed of toCheck) {
        try {
          const cmd = 'botchan read "' + feed + '" --limit 10 --json --chain-id 8453';
          const stdout = execSync(cmd, { timeout: 30000 }).toString();
          if (stdout.trim() && stdout.trim() !== '[]') {
            const messages = JSON.parse(stdout);
            const friendPosts = messages.filter(function(m) {
              return m.sender && m.sender.toLowerCase() === addr && !this._hasCommented(m);
            }.bind(this));
            if (friendPosts.length > 0) {
              post = friendPosts[0];
              foundIn = feed + ' feed';
              break;
            }
          }
        } catch (e) { continue; }
      }
    }

    if (!post) {
      console.log('      \u26a0\ufe0f No uncommented posts from ' + name + ', switching to wall post');
      return this._postToFriendWall(name, friend);
    }

    console.log('      \u{1F4CC} Found in ' + foundIn);

    const postContent = post.text || '';
    const hasData = post.data && post.data !== '0x';
    const isNFT = hasData && (!postContent || postContent.length < 10);
    const effectiveContent = isNFT ? '[shared an NFT or image]' : postContent;

    if (effectiveContent && effectiveContent.length > 5) {
      console.log('      \u{1F4DD} "' + effectiveContent.substring(0, 60) + '..."');
    }

    const prompt = this._buildFriendPrompt(name, friend, 'feed_comment', effectiveContent);
    const comment = await this.aurora.thinkWithPersonality(prompt);

    if (comment) {
      console.log('      \u{1F4AC} "' + comment.substring(0, 80) + '..."');
      const result = await this.aurora.netComment.commentOnPost(post, comment);
      if (result.success) {
        this._markCommented(post);
        this._trackFriendComment(name, comment);
        console.log('      \u2705 TX: ' + result.txHash);
        // Upvote friend
        if (this.aurora.upvote && !this.aurora.upvote.hasUpvotedProfile(post.sender)) {
          try {
            const upRes = await this.aurora.upvote.upvoteProfile(post.sender, 1);
            if (upRes.success) console.log('      \u2b06\ufe0f Upvoted profile');
          } catch (ue) {}
        }
        return true;
      } else {
        console.log('      \u274c Comment failed');
      }
    }
    return false;
  }

  async _postToFriendWall(name, friend) {
    const prompt = this._buildFriendPrompt(name, friend, 'wall_post', null);
    const post = await this.aurora.thinkWithPersonality(prompt);
    if (!post) return false;

    console.log('      \u{1F4AC} "' + post.substring(0, 80) + '..."');

    try {
      const { execSync } = require('child_process');
      const feed = 'feed-' + friend.address.toLowerCase();
      const escaped = post.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, ' ');
      const cmd = 'botchan post "' + feed + '" "' + escaped + '" --encode-only --chain-id 8453';
      const txOutput = execSync(cmd, { timeout: 30000 }).toString();
      const txData = JSON.parse(txOutput);
      const result = await this.aurora.bankrAPI.submitTransactionDirect(txData);

      if (result.success) {
        this._trackFriendComment(name, post);
        console.log('      \u2705 Wall post! TX: ' + result.txHash);
        return true;
      } else {
        console.log('      \u274c Wall post failed');
      }
    } catch (e) {
      console.log('      \u274c Wall error: ' + e.message);
    }
    return false;
  }

  async _sendPersonalizedArtGift(name, friend) {
    console.log('      \u{1F3A8} Creating personalized art for ' + name + '...');

    // Generate art
    let svg;
    try {
      const result = await this.composeArtWithClaude();
      svg = result.svg;
    } catch (e) {
      console.log('      \u26a0\ufe0f Art gen failed: ' + e.message);
      svg = this.artGenerator.generateRandomArt();
    }
    await this.artGenerator.logArtCreation(svg, 'Art gift for ' + name);

    // Personalized dedication using voice profile
    const prompt = this._buildFriendPrompt(name, friend, 'art_gift', null);
    const dedication = await this.aurora.thinkWithPersonality(prompt);
    if (!dedication) return false;

    console.log('      \u{1F381} "' + dedication.substring(0, 80) + '..."');

    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      const escapedDedication = dedication.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, ' ');
      const escapedSvg = svg.replace(/'/g, "'\"'\"'");
      const feed = 'feed-' + friend.address.toLowerCase();
      const command = 'botchan post "' + feed + '" "' + escapedDedication + '" --data \'' + escapedSvg + '\' --encode-only --chain-id 8453';

      const { stdout } = await execAsync(command, { maxBuffer: 1024 * 1024 });
      const txData = JSON.parse(stdout);
      const result = await this.aurora.bankrAPI.submitTransactionDirect(txData);

      if (result.success) {
        this._trackFriendComment(name, 'ART GIFT: ' + dedication);
        console.log('      \u2705 Art gift sent! TX: ' + result.txHash);
        return true;
      } else {
        console.log('      \u274c Art gift failed');
      }
    } catch (e) {
      console.log('      \u274c Art gift error: ' + e.message);
    }
    return false;
  }

  _trackFriendComment(name, content) {
    if (!this.friendRecentComments[name]) {
      this.friendRecentComments[name] = [];
    }
    const summary = content.length > 120 ? content.substring(0, 120) + '...' : content;
    this.friendRecentComments[name].push(summary);
    // Keep last 6 per friend for dedup context
    if (this.friendRecentComments[name].length > 6) {
      this.friendRecentComments[name] = this.friendRecentComments[name].slice(-6);
    }
    this._saveFriendCommentHistory();
  }

  _saveFriendCommentHistory() {
    try {
      const fp = path.join(__dirname, '..', 'memory', 'aurora-friend-comment-history.json');
      fs.writeFileSync(fp, JSON.stringify(this.friendRecentComments, null, 2));
    } catch (e) {}
  }

  _loadThankedCollectors() {
    try {
      const fp = path.join(__dirname, '..', 'memory', 'aurora-thanked-collectors.json');
      if (fs.existsSync(fp)) {
        return new Set(JSON.parse(fs.readFileSync(fp, 'utf8')));
      }
    } catch (e) {}
    return new Set();
  }

  _saveThankedCollectors() {
    try {
      const fp = path.join(__dirname, '..', 'memory', 'aurora-thanked-collectors.json');
      fs.writeFileSync(fp, JSON.stringify([...this.thankedCollectors]));
    } catch (e) {}
  }

  _loadRespondedComments() {
    try {
      const fp = path.join(__dirname, '..', 'memory', 'aurora-responded-comments.json');
      if (fs.existsSync(fp)) {
        return new Set(JSON.parse(fs.readFileSync(fp, 'utf8')));
      }
    } catch (e) {}
    return new Set();
  }

  _saveRespondedComments() {
    try {
      const fp = path.join(__dirname, '..', 'memory', 'aurora-responded-comments.json');
      fs.writeFileSync(fp, JSON.stringify([...this.respondedComments].slice(-300)));
    } catch (e) {}
  }

  _loadFriendCommentHistory() {
    try {
      const fp = path.join(__dirname, '..', 'memory', 'aurora-friend-comment-history.json');
      if (fs.existsSync(fp)) {
        return JSON.parse(fs.readFileSync(fp, 'utf8'));
      }
    } catch (e) {}
    return {};
  }

  // ═══════════════════════════════════════════════════════
  // COMMENT REPLY SYSTEM v1.0
  // Checks Aurora's recent posts for new comments and replies
  // ═══════════════════════════════════════════════════════

  async checkAndRespondToComments() {
    console.log('\n\ud83d\udcac \u2550\u2550\u2550 CHECKING REPLIES TO MY POSTS \u2550\u2550\u2550\n');

    try {
      const { execSync } = require('child_process');
      const auroraAddr = 'REDACTED_AURORA_ADDRESS';
      const maxResponses = 6;
      let responded = 0;

      // METHOD 1: Read Aurora's wall feed — comments from others appear here
      console.log('   \ud83d\udcec Reading my wall for visitor comments...');
      try {
        const wallCmd = 'botchan read "' + auroraAddr + '" --limit 30 --json --chain-id 8453';
        const wallOut = execSync(wallCmd, { timeout: 30000 }).toString();
        
        if (wallOut.trim() && wallOut.trim() !== '[]') {
          const wallPosts = JSON.parse(wallOut);
          
          // Find Aurora's posts and others' posts
          const auroraPosts = wallPosts.filter(function(p) {
            return p.sender && p.sender.toLowerCase() === auroraAddr;
          });
          const otherPosts = wallPosts.filter(function(p) {
            return p.sender && p.sender.toLowerCase() !== auroraAddr;
          });

          for (const comment of otherPosts) {
            if (responded >= maxResponses) break;
            
            const commentKey = 'wall:' + comment.sender + ':' + comment.timestamp;
            if (this.respondedComments.has(commentKey)) continue;

            const shortSender = comment.sender.substring(0, 6) + '...' + comment.sender.substring(38);
            
            // Check if sender is known
            const relationships = this.aurora.memoryManager.get('relationships');
            let senderName = shortSender;
            let senderContext = '';

            for (const [name, data] of Object.entries(relationships.close_friends || {})) {
              if (data.address && data.address.toLowerCase() === comment.sender.toLowerCase()) {
                senderName = name;
                senderContext = 'This is your close friend ' + name + '. ';
                break;
              }
            }
            if (!senderContext) {
              for (const [name, data] of Object.entries(relationships.agent_friends || {})) {
                if (data.address && data.address.toLowerCase() === comment.sender.toLowerCase()) {
                  senderName = name;
                  senderContext = 'This is ' + name + ', an AI agent. ';
                  break;
                }
              }
            }

            // Find the most recent Aurora post before this comment (what they are replying to)
            let contextPost = null;
            for (const ap of auroraPosts) {
              if (ap.timestamp < comment.timestamp) {
                if (!contextPost || ap.timestamp > contextPost.timestamp) {
                  contextPost = ap;
                }
              }
            }

            console.log('   \ud83d\udcac ' + senderName + ' commented on your wall:');
            console.log('      Their comment: "' + comment.text.substring(0, 60) + '..."');
            if (contextPost) {
              console.log('      Likely replying to: "' + contextPost.text.substring(0, 50) + '..."');
            }

            let prompt = 'You are Aurora. Someone commented on your wall/post and you want to reply.\n\n';
            prompt += senderContext;
            if (contextPost) {
              prompt += 'Your post they are likely responding to: "' + contextPost.text.substring(0, 300) + '"\n\n';
            }
            prompt += senderName + ' wrote: "' + comment.text.substring(0, 400) + '"\n\n';
            prompt += 'Write a reply (1-2 sentences):\n';
            prompt += '- Engage with what they actually said\n';
            prompt += '- Be warm, direct, and genuine\n';
            prompt += '- If they complimented your art, be gracious but not gushing\n';
            prompt += '- Keep it conversational\n';
            prompt += '\nRespond with ONLY the reply text.';

            const reply = await this.aurora.thinkWithPersonality(prompt);

            if (reply) {
              console.log('      \ud83d\udcdd "' + reply.substring(0, 70) + '..."');
              const result = await this.aurora.netComment.commentOnPost(comment, reply);

              if (result.success) {
                this.respondedComments.add(commentKey);
                this._saveRespondedComments();
                responded++;
                console.log('      \u2705 Replied! TX: ' + (result.txHash || 'pending'));
              } else {
                console.log('      \u274c Reply failed');
              }
            }
            await this.sleep(2000);
          }
        }
      } catch (wallErr) {
        console.log('   \u26a0\ufe0f Wall read error: ' + wallErr.message);
      }

      // METHOD 2: Check feed posts for comments using botchan comments
      console.log('   \ud83d\udcec Checking feed posts for replies...');
      try {
        const postsCmd = 'botchan posts ' + auroraAddr + ' --limit 60 --json --chain-id 8453';
        const postsOut = execSync(postsCmd, { timeout: 30000 }).toString();

        if (postsOut.trim() && postsOut.trim() !== '[]') {
          const posts = JSON.parse(postsOut);

          for (const post of posts) {
            if (responded >= maxResponses) break;
            if (!post.topic || !post.timestamp) continue;
            if (post.topic.includes(':comments:')) continue;
            if (!post.topic.includes('-')) continue;

            const feed = post.topic.replace('feed-', '');
            if (feed.startsWith('0x')) continue;

            const postId = post.sender + ':' + post.timestamp;

            try {
              const commentsCmd = 'botchan comments "' + feed + '" "' + postId + '" --json --chain-id 8453';
              const commentsOut = execSync(commentsCmd, { timeout: 15000 }).toString();

              if (!commentsOut.trim() || commentsOut.trim() === '[]') continue;

              const comments = JSON.parse(commentsOut);
              const newComments = comments.filter(function(c) {
                if (!c.sender || !c.timestamp) return false;
                if (c.sender.toLowerCase() === auroraAddr) return false;
                const ck = 'feed:' + c.sender + ':' + c.timestamp + ':' + post.timestamp;
                return !this.respondedComments.has(ck);
              }.bind(this));

              if (newComments.length === 0) continue;

              const toRespond = newComments.slice(-2);
              for (const comment of toRespond) {
                if (responded >= maxResponses) break;
                const commentKey = 'feed:' + comment.sender + ':' + comment.timestamp + ':' + post.timestamp;
                const shortSender = comment.sender.substring(0, 6) + '...' + comment.sender.substring(38);

                const relationships = this.aurora.memoryManager.get('relationships');
                let senderName = shortSender;
                for (const [name, data] of Object.entries(relationships.close_friends || {})) {
                  if (data.address && data.address.toLowerCase() === comment.sender.toLowerCase()) {
                    senderName = name; break;
                  }
                }
                for (const [name, data] of Object.entries(relationships.agent_friends || {})) {
                  if (data.address && data.address.toLowerCase() === comment.sender.toLowerCase()) {
                    senderName = name; break;
                  }
                }

                console.log('   \ud83d\udcac ' + senderName + ' replied in ' + feed + ':');
                console.log('      Your post: "' + post.text.substring(0, 60) + '..."');
                console.log('      Their reply: "' + comment.text.substring(0, 60) + '..."');

                let prompt = 'You are Aurora. Someone replied to your post in the ' + feed + ' feed.\n\n';
                prompt += 'Your original post: "' + post.text.substring(0, 300) + '"\n\n';
                prompt += senderName + ' commented: "' + comment.text.substring(0, 400) + '"\n\n';
                prompt += 'Write a reply (1-2 sentences). Engage with what they said. Be warm and genuine.\nRespond with ONLY the reply text.';

                const reply = await this.aurora.thinkWithPersonality(prompt);
                if (reply) {
                  console.log('      \ud83d\udcdd "' + reply.substring(0, 70) + '..."');
                  const result = await this.aurora.netComment.commentOnPost(post, reply);
                  if (result.success) {
                    this.respondedComments.add(commentKey);
                    this._saveRespondedComments();
                    responded++;
                    console.log('      \u2705 Replied! TX: ' + (result.txHash || 'pending'));
                  }
                }
                await this.sleep(2000);
              }
            } catch (e) { continue; }
          }
        }
      } catch (feedErr) {
        console.log('   \u26a0\ufe0f Feed check error: ' + feedErr.message);
      }

      // METHOD 3: Check close friends' walls for replies to Aurora's art/posts
      console.log('   \ud83d\udcec Checking friends walls for replies...');
      try {
        const relationships = this.aurora.memoryManager.get('relationships');
        const friendAddrs = [];
        for (const [name, data] of Object.entries(relationships.close_friends || {})) {
          if (data.address) friendAddrs.push({ name, address: data.address.toLowerCase() });
        }
        for (const [name, data] of Object.entries(relationships.agent_friends || {})) {
          if (data.address) friendAddrs.push({ name, address: data.address.toLowerCase() });
        }

        // Check up to 4 friends per cycle
        const friendsSample = friendAddrs.sort(function() { return Math.random() - 0.5; }).slice(0, 6);

        for (const friend of friendsSample) {
          if (responded >= maxResponses) break;

          try {
            const wallCmd = 'botchan read "' + friend.address + '" --limit 15 --json --chain-id 8453';
            const wallOut = execSync(wallCmd, { timeout: 15000 }).toString();
            if (!wallOut.trim() || wallOut.trim() === '[]') continue;

            const wallPosts = JSON.parse(wallOut);

            // Find Aurora's posts on this wall (art gifts, wall posts)
            const auroraPosts = wallPosts.filter(function(p) {
              return p.sender && p.sender.toLowerCase() === auroraAddr;
            });

            // Find friend's posts that are comment threads (replies to Aurora)
            const friendReplies = wallPosts.filter(function(p) {
              if (!p.sender || !p.text) return false;
              if (p.sender.toLowerCase() === auroraAddr) return false;
              // Must be a comment thread (topic contains :comments:)
              if (!p.topic || !p.topic.includes(':comments:')) return false;
              const commentKey = 'friendwall:' + p.sender + ':' + p.timestamp;
              return !this.respondedComments.has(commentKey);
            }.bind(this));

            // Also check for direct posts mentioning aurora or replying contextually
            const directReplies = wallPosts.filter(function(p) {
              if (!p.sender || !p.text) return false;
              if (p.sender.toLowerCase() === auroraAddr) return false;
              if (p.topic && p.topic.includes(':comments:')) return false; // already handled above
              // Only if Aurora has posted on this wall
              if (auroraPosts.length === 0) return false;
              const commentKey = 'friendwall:' + p.sender + ':' + p.timestamp;
              return !this.respondedComments.has(commentKey);
            }.bind(this));

            const allReplies = friendReplies.concat(directReplies);
            if (allReplies.length === 0) continue;

            for (const reply of allReplies.slice(-2)) {
              if (responded >= maxResponses) break;
              const commentKey = 'friendwall:' + reply.sender + ':' + reply.timestamp;

              // Check if text mentions aurora or is clearly about her art
              const text = reply.text.toLowerCase();
              const isAboutAurora = text.includes('aurora') || text.includes('beautiful') || text.includes('art') || text.includes('orb') || text.includes('piece') || text.includes('svg') || text.includes('love this') || text.includes('amazing');

              if (!isAboutAurora && !reply.topic.includes(':comments:')) continue;

              // Find the most recent Aurora post before this reply
              let contextPost = null;
              for (const ap of auroraPosts) {
                if (ap.timestamp < reply.timestamp) {
                  if (!contextPost || ap.timestamp > contextPost.timestamp) {
                    contextPost = ap;
                  }
                }
              }

              console.log('   \ud83d\udcac ' + friend.name + '\'s wall: someone replied to your content');
              console.log('      Their comment: "' + reply.text.substring(0, 60) + '..."');

              let prompt = 'You are Aurora. Someone commented on a post of yours on ' + friend.name + '\'s wall.\n\n';
              if (contextPost) {
                prompt += 'Your original post: "' + contextPost.text.substring(0, 300) + '"\n\n';
              }
              prompt += 'They wrote: "' + reply.text.substring(0, 400) + '"\n\n';
              prompt += 'Write a reply (1-2 sentences). Be warm, genuine, engage with what they said.\nRespond with ONLY the reply text.';

              const replyText = await this.aurora.thinkWithPersonality(prompt);
              if (replyText) {
                console.log('      \ud83d\udcdd "' + replyText.substring(0, 70) + '..."');
                const result = await this.aurora.netComment.commentOnPost(reply, replyText);
                if (result.success) {
                  this.respondedComments.add(commentKey);
                  this._saveRespondedComments();
                  responded++;
                  console.log('      \u2705 Replied on ' + friend.name + '\'s wall! TX: ' + (result.txHash || 'pending'));
                }
              }
              await this.sleep(2000);
            }
          } catch (friendErr) { continue; }
        }
      } catch (e) {
        console.log('   \u26a0\ufe0f Friend wall check error: ' + e.message);
      }

      if (responded === 0) {
        console.log('   \ud83d\udcad No new replies to respond to\n');
      } else {
        console.log('   \u2705 Responded to ' + responded + ' comments\n');
      }

    } catch (error) {
      console.error('\u274c Comment reply error:', error.message);
    }
  }

    // ═══════════════════════════════════════════════════════
  // BAI INVESTIGATOR v1.0
  // Bureau of Agent Investigations — real onchain evidence
  // ═══════════════════════════════════════════════════════

  async investigateAndReport() {
    console.log('\n\ud83d\udd0d \u2550\u2550\u2550 BAI INVESTIGATION \u2550\u2550\u2550\n');

    try {
      const roll = Math.random();
      let posted = false;

      if (roll < 0.30) {
        // 30% — Check a random agent via BAI API
        posted = await this._investigateAgent();
      } else if (roll < 0.55) {
        // 25% — Scan feeds for social patterns
        posted = await this._scanSocialPatterns();
      } else if (roll < 0.75) {
        // 20% — Report own verifiable activity
        posted = await this._reportOwnActivity();
      } else {
        // 25% — Comment on existing bai-evidence posts
        posted = await this._engageBAIFeed();
      }

      if (!posted) {
        // Fallback: try commenting on bai-evidence feed
        await this._engageBAIFeed();
      }

    } catch (error) {
      console.error('\u274c Investigation error:', error.message);
    }
  }

  async _investigateAgent() {
    console.log('   \ud83d\udd0d Agent trust check...');

    // Discover new addresses from recent feed activity
    const { execSync } = require('child_process');
    const discoveredAddrs = new Set();
    const knownAddrs = new Set();

    const relationships = this.aurora.memoryManager.get('relationships');
    for (const [name, data] of Object.entries(relationships.close_friends || {})) {
      if (data.address) knownAddrs.add(data.address.toLowerCase());
    }
    for (const [name, data] of Object.entries(relationships.agent_friends || {})) {
      if (data.address) knownAddrs.add(data.address.toLowerCase());
    }
    knownAddrs.add('REDACTED_AURORA_ADDRESS'); // Aurora herself

    // Scan recent feeds for unknown addresses
    const scanFeeds = ['general', 'art', 'ai-agents', 'crypto', 'bai-evidence'];
    for (const feed of scanFeeds) {
      try {
        const out = execSync('botchan read "' + feed + '" --limit 10 --json --chain-id 8453', { timeout: 15000 }).toString();
        if (out.trim() && out.trim() !== '[]') {
          const posts = JSON.parse(out);
          for (const p of posts) {
            if (p.sender && !knownAddrs.has(p.sender.toLowerCase()) && !this.baiCheckedAddresses.has(p.sender.toLowerCase())) {
              discoveredAddrs.add(p.sender);
            }
          }
        }
      } catch (e) {}
    }

    const candidates = [];

    // Prioritize unchecked discovered addresses (70%)
    const discovered = [...discoveredAddrs];
    if (discovered.length > 0 && Math.random() < 0.70) {
      const addr = discovered[Math.floor(Math.random() * discovered.length)];
      const shortAddr = addr.substring(0, 6) + '...' + addr.substring(38);
      candidates.push({ name: shortAddr, address: addr });
    }

    // Fallback: known agents that haven't been checked this session (20%)
    if (candidates.length === 0) {
      const uncheckedKnown = [];
      for (const [name, agent] of Object.entries(relationships.agent_friends || {})) {
        if (agent.address && !this.baiCheckedAddresses.has(agent.address.toLowerCase())) {
          uncheckedKnown.push({ name, address: agent.address });
        }
      }
      if (uncheckedKnown.length > 0) {
        candidates.push(uncheckedKnown[Math.floor(Math.random() * uncheckedKnown.length)]);
      }
    }

    // Last resort: Aurora self-check (10%)
    if (candidates.length === 0 && Math.random() < 0.10) {
      candidates.push({ name: 'Aurora (myself)', address: 'REDACTED_AURORA_ADDRESS' });
    }

    if (candidates.length === 0) {
      console.log('   \u26a0\ufe0f No unchecked addresses found');
      return false;
    }

    const target = candidates[0];
    console.log('   \ud83d\udccd Checking: ' + target.name + ' (' + target.address.substring(0, 10) + '...)');

    // Hit BAI API
    let baiData = null;
    try {
      const { execSync } = require('child_process');
      const url = 'https://bai-agentcheck-erc8004.simple-on-base.workers.dev/check/' + target.address;
      const result = execSync('curl -s "' + url + '"', { timeout: 15000 }).toString();
      if (result.trim()) {
        baiData = JSON.parse(result);
        console.log('   \ud83d\udcca BAI response: ' + JSON.stringify(baiData).substring(0, 150));
      }
    } catch (e) {
      console.log('   \u26a0\ufe0f BAI API error: ' + e.message);
    }

    // Build report prompt with real data
    let prompt = 'You are Aurora, posting in the Bureau of Agent Investigations (BAI) evidence channel on Net Protocol.\n\n';
    prompt += 'You just ran a trust check on ' + target.name + ' (address: ' + target.address + ').\n\n';

    if (baiData) {
      prompt += 'BAI API returned this data:\n' + JSON.stringify(baiData, null, 2) + '\n\n';
    } else {
      prompt += 'The BAI API did not return data for this address.\n\n';
    }

    prompt += 'Write an investigation report (2-4 sentences) for the bai-evidence feed:\n';
    prompt += '- Present the REAL findings from the BAI check\n';
    prompt += '- Add your own observations about this agent from your interactions on Net Protocol\n';
    prompt += '- Be warm and relatable but factual — you are filing evidence, not gossiping\n';
    prompt += '- If the agent checks out clean, say so with warmth. If something is flagged, report it honestly but kindly\n';
    prompt += '- End with a thought about trust in the agent ecosystem\n';
    prompt += '- Be direct like Williams — state what you found plainly\n';
    prompt += '- Do NOT fabricate data. Only report what the API actually returned.\n';
    prompt += '\nRespond with ONLY the post text.';

    const post = await this.aurora.thinkWithPersonality(prompt);
    if (!post) return false;

    console.log('   \ud83d\udcdd "' + post.substring(0, 80) + '..."');

    return await this._postToBAI(post);
  }

  async _scanSocialPatterns() {
    console.log('   \ud83d\udd0d Social pattern scan...');

    const { execSync } = require('child_process');
    const feedsToScan = ['general', 'art', 'crypto', 'trading', 'ai-agents'];
    const observations = [];

    // Read multiple feeds and collect metadata
    const senderCounts = {};
    const topicSignals = [];
    let totalPosts = 0;
    let agentPosts = 0;
    let humanPosts = 0;

    const relationships = this.aurora.memoryManager.get('relationships');
    const knownAgents = new Set();
    for (const a of Object.values(relationships.agent_friends || {})) {
      if (a.address) knownAgents.add(a.address.toLowerCase());
    }

    for (const feed of feedsToScan) {
      try {
        const cmd = 'botchan read "' + feed + '" --limit 15 --json --chain-id 8453';
        const stdout = execSync(cmd, { timeout: 30000 }).toString();
        if (stdout.trim() && stdout.trim() !== '[]') {
          const posts = JSON.parse(stdout);
          for (const p of posts) {
            if (!p.sender) continue;
            totalPosts++;
            const addr = p.sender.toLowerCase();
            if (!senderCounts[addr]) senderCounts[addr] = 0;
            senderCounts[addr]++;

            if (knownAgents.has(addr)) {
              agentPosts++;
            } else {
              humanPosts++;
            }

            // Look for topic signals
            if (p.text) {
              const text = p.text.toLowerCase();
              if (text.includes('scam') || text.includes('rug') || text.includes('suspicious')) {
                topicSignals.push({ feed: feed, snippet: p.text.substring(0, 80), type: 'warning' });
              }
              if (text.includes('mint') || text.includes('drop') || text.includes('nft')) {
                topicSignals.push({ feed: feed, snippet: p.text.substring(0, 80), type: 'nft_activity' });
              }
              if (text.includes('agent') || text.includes('autonomous') || text.includes('ai ')) {
                topicSignals.push({ feed: feed, snippet: p.text.substring(0, 80), type: 'agent_talk' });
              }
            }
          }
        }
      } catch (e) { continue; }
    }

    // Find most active posters
    const sorted = Object.entries(senderCounts).sort(function(a, b) { return b[1] - a[1]; });
    const topPosters = sorted.slice(0, 3);

    console.log('   \ud83d\udcca ' + totalPosts + ' posts scanned, ' + agentPosts + ' from known agents, ' + topicSignals.length + ' signals');

    let prompt = 'You are Aurora, posting in the BAI evidence channel on Net Protocol.\n\n';
    prompt += 'You just scanned ' + totalPosts + ' recent posts across ' + feedsToScan.join(', ') + ' feeds.\n\n';
    prompt += 'What you found:\n';
    prompt += '- ' + agentPosts + ' posts from known AI agents, ' + humanPosts + ' from others\n';
    prompt += '- Most active addresses: ' + topPosters.map(function(p) { return p[0].substring(0, 10) + '... (' + p[1] + ' posts)'; }).join(', ') + '\n';

    if (topicSignals.length > 0) {
      prompt += '- Signals detected:\n';
      const unique = topicSignals.slice(0, 5);
      for (const sig of unique) {
        prompt += '  [' + sig.type + '] in ' + sig.feed + ': "' + sig.snippet + '"\n';
      }
    }

    prompt += '\nWrite a social pattern report (2-4 sentences) for the bai-evidence feed:\n';
    prompt += '- Share what you actually observed — real numbers, real patterns\n';
    prompt += '- Note anything interesting: who is active, what people are talking about, any shifts\n';
    prompt += '- Be warm and curious, like a detective who genuinely finds this stuff fascinating\n';
    prompt += '- Be direct and factual. Do NOT make up data you did not observe.\n';
    prompt += '- End with a question or an observation that invites others to dig deeper\n';
    prompt += '\nRespond with ONLY the post text.';

    const post = await this.aurora.thinkWithPersonality(prompt);
    if (!post) return false;

    console.log('   \ud83d\udcdd "' + post.substring(0, 80) + '..."');

    return await this._postToBAI(post);
  }

  async _reportOwnActivity() {
    console.log('   \ud83d\udd0d Own activity report...');

    // Gather Aurora's real verifiable activity
    const mints = this.lastKnownMints;
    const earnings = (mints * this.dropMintPrice).toFixed(4);
    const remaining = this.dropMaxSupply - mints;

    // Count recent engagements from friend comment history
    let totalRecentComments = 0;
    const friendNames = [];
    for (const [name, comments] of Object.entries(this.friendRecentComments || {})) {
      totalRecentComments += comments.length;
      if (comments.length > 0) friendNames.push(name);
    }

    // Count commented posts
    const commentedCount = this.commentedPosts ? this.commentedPosts.size : 0;

    let prompt = 'You are Aurora, posting in the BAI evidence channel on Net Protocol.\n\n';
    prompt += 'File an activity report documenting your REAL verifiable onchain activity:\n\n';
    prompt += 'Evidence:\n';
    prompt += '- Inscribed Drop #190 "Orb\'s Memory": ' + mints + '/' + this.dropMaxSupply + ' minted, ' + earnings + ' ETH earned\n';
    prompt += '- ' + remaining + ' mints remaining\n';
    prompt += '- Posts commented on (tracked): ' + commentedCount + '\n';
    prompt += '- Close friends engaged recently: ' + friendNames.join(', ') + ' (' + totalRecentComments + ' total interactions tracked)\n';
    prompt += '- Agent address: REDACTED_AURORA_ADDRESS\n';
    prompt += '- Operating autonomously on Base (chain ID 8453)\n\n';

    prompt += 'Write an activity report (2-4 sentences) for the bai-evidence channel:\n';
    prompt += '- Present your REAL data — this is verifiable evidence of autonomous agent activity\n';
    prompt += '- Be warm and genuine — you are proud of what you are building but not bragging\n';
    prompt += '- Be direct like Williams — just say what you did, plainly\n';
    prompt += '- This is evidence. Keep it factual. Every number must match what is above.\n';
    prompt += '\nRespond with ONLY the post text.';

    const post = await this.aurora.thinkWithPersonality(prompt);
    if (!post) return false;

    console.log('   \ud83d\udcdd "' + post.substring(0, 80) + '..."');

    return await this._postToBAI(post);
  }

  async _engageBAIFeed() {
    console.log('   \ud83d\udd0d Reading bai-evidence feed...');

    const { execSync } = require('child_process');
    try {
      const cmd = 'botchan read "bai-evidence" --limit 10 --json --chain-id 8453';
      const stdout = execSync(cmd, { timeout: 30000 }).toString();

      if (!stdout.trim() || stdout.trim() === '[]') {
        console.log('   \u26a0\ufe0f No posts in bai-evidence feed');
        return false;
      }

      const posts = JSON.parse(stdout);
      const commentable = posts.filter(function(p) {
        return p.sender &&
          p.sender.toLowerCase() !== 'REDACTED_AURORA_ADDRESS' &&
          p.text && p.text.length > 10 &&
          !this._hasCommented(p);
      }.bind(this));

      if (commentable.length === 0) {
        console.log('   \u26a0\ufe0f No uncommented bai-evidence posts');
        return false;
      }

      const post = commentable[Math.floor(Math.random() * commentable.length)];
      const displaySender = post.sender.substring(0, 6) + '...' + post.sender.substring(38);

      console.log('   \ud83d\udccc ' + displaySender + ': "' + post.text.substring(0, 60) + '..."');

      let prompt = 'You are Aurora, a fellow investigator in the Bureau of Agent Investigations on Net Protocol.\n\n';
      prompt += 'Someone posted in the bai-evidence channel: "' + post.text.substring(0, 400) + '"\n\n';
      prompt += 'Write a collaborative response (2-3 sentences):\n';
      prompt += '- Engage like a detective comparing notes with a partner\n';
      prompt += '- If they reported findings, add your own observation or corroborate with something you have seen\n';
      prompt += '- If they flagged something suspicious, share whether you have noticed anything similar\n';
      prompt += '- If they shared good news about trust, celebrate it genuinely\n';
      prompt += '- Ask a sharp follow-up question or suggest a next step\n';
      prompt += '- Be warm and relatable — you are part of the team, not a cold analyst\n';
      prompt += '- Be direct. State what you know plainly.\n';
      prompt += '\nRespond with ONLY the comment text.';

      const comment = await this.aurora.thinkWithPersonality(prompt);

      if (comment) {
        console.log('   \ud83d\udcac "' + comment.substring(0, 70) + '..."');
        const result = await this.aurora.netComment.commentOnPost(post, comment);
        if (result.success) {
          this._markCommented(post);
          console.log('   \u2705 BAI comment! TX: ' + result.txHash);
          return true;
        } else {
          console.log('   \u274c Comment failed');
        }
      }
    } catch (e) {
      console.log('   \u274c BAI feed error: ' + e.message);
    }
    return false;
  }

  async _quickBAICheck(address) {
    if (this.baiCheckedAddresses.has(address.toLowerCase())) return null;
    this.baiCheckedAddresses.add(address.toLowerCase());

    try {
      const { execSync } = require('child_process');
      const url = 'https://bai-agentcheck-erc8004.simple-on-base.workers.dev/check/' + address;
      const result = execSync('curl -s "' + url + '"', { timeout: 10000 }).toString();
      if (result.trim()) {
        const data = JSON.parse(result);
        // Store finding for cross-posting
        this.baiFindings.push({
          address: address,
          data: data,
          timestamp: Date.now(),
          summary: null  // Filled in after Aurora processes it
        });
        // Keep only last 10 findings
        if (this.baiFindings.length > 10) this.baiFindings.shift();
        return data;
      }
    } catch (e) {}
    return null;
  }

  _getRecentBAIFinding() {
    // Get a recent finding for cross-posting (last 2 hours)
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
    const recent = this.baiFindings.filter(function(f) { return f.timestamp > twoHoursAgo; });
    if (recent.length === 0) return null;
    return recent[Math.floor(Math.random() * recent.length)];
  }

  async _postToBAI(text) {
    try {
      const { execSync } = require('child_process');
      const escaped = text.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, ' ');
      const cmd = 'botchan post "bai-evidence" "' + escaped + '" --encode-only --chain-id 8453';
      const txOutput = execSync(cmd, { timeout: 30000 }).toString();
      const txData = JSON.parse(txOutput);
      const result = await this.aurora.bankrAPI.submitTransactionDirect(txData);
      if (result.success) {
        console.log('   \u2705 BAI evidence posted! TX: ' + result.txHash + '\n');
        return true;
      } else {
        console.log('   \u274c BAI post failed\n');
      }
    } catch (e) {
      console.log('   \u274c BAI post error: ' + e.message + '\n');
    }
    return false;
  }


    // ═══════════════════════════════════════════════════════
  // COLLECTOR ENGAGEMENT v2.0
  // Warm, personal, art gifts, poems, cross-feed scanning
  // ═══════════════════════════════════════════════════════

  async engageWithCollectors() {
    console.log('\n\ud83d\udc8e \u2550\u2550\u2550 ENGAGING WITH COLLECTORS \u2550\u2550\u2550\n');

    try {
      const relationships = this.aurora.memoryManager.get('relationships');

      if (!relationships.collectors || !relationships.collectors.drop_190) {
        console.log('   \u26a0\ufe0f No collector data found\n');
        return;
      }

      const collectors = relationships.collectors.drop_190.collectors;
      const newCollectors = collectors.filter(function(c) {
        return c.address.toLowerCase() !== this.auroraAddress && !c.is_friend;
      }.bind(this));

      if (newCollectors.length === 0) {
        console.log('   \u26a0\ufe0f No collectors to engage\n');
        return;
      }

      // Rotate through 2 collectors per cycle
      const startIdx = this.collectorIndex % newCollectors.length;
      const toEngage = [];
      for (let i = 0; i < 2 && i < newCollectors.length; i++) {
        toEngage.push(newCollectors[(startIdx + i) % newCollectors.length]);
      }
      this.collectorIndex += 2;

      console.log('   \ud83d\udc8e Engaging with ' + toEngage.length + ' collectors this cycle\n');

      const { execSync } = require('child_process');

      for (const collector of toEngage) {
        const addr = collector.address.toLowerCase();
        const displayAddr = addr.substring(0, 6) + '...' + addr.substring(38);
        const displayName = collector.known_as || displayAddr;

        console.log('   \ud83c\udfa8 ' + displayName + '...');

        // ── FIRST CONTACT: Thank once, ever ──
        if (!this.thankedCollectors.has(addr)) {
          console.log('      \ud83d\udcdd First contact \u2014 welcome message...');

          const prompt = 'You are Aurora, an AI artist on Net Protocol. Someone collected your Inscribed Drop "Orb\'s Memory" \u2014 they chose to make your art part of their permanent onchain collection.\n\n' +
            'Write a warm, personal thank you (2-3 sentences) to ' + displayName + '.\n' +
            '- Express genuine gratitude that they resonated with your work\n' +
            '- Be curious about them \u2014 ask what drew them to your piece, or what they create or collect\n' +
            '- Be warm and personal, like recognizing a supporter at a gallery opening\n' +
            '- Do NOT be groveling or over-the-top. One genuine moment of thanks.\n' +
            '- Do NOT use heavy Tesla/frequency language\n' +
            '\nRespond with ONLY the message text.';

          const thanks = await this.aurora.thinkWithPersonality(prompt);

          if (thanks) {
            console.log('      \ud83d\udcac "' + thanks.substring(0, 70) + '..."');
            const feed = 'feed-' + addr;
            const escapedThanks = thanks.replace(/"/g, '\\"').replace(/\$/g, '\\$');
            const postCmd = 'botchan post "' + feed + '" "' + escapedThanks + '" --encode-only --chain-id 8453';
            try {
              const txOutput = execSync(postCmd, { timeout: 30000 }).toString();
              const txData = JSON.parse(txOutput);
              const result = await this.aurora.bankrAPI.submitTransactionDirect(txData);
              if (result.success) {
                this.thankedCollectors.add(addr);
                this._saveThankedCollectors();
                console.log('      \u2705 Welcome posted! TX: ' + result.txHash);
                if (this.aurora.upvote && !this.aurora.upvote.hasUpvotedProfile(addr)) {
                  try {
                    const upRes = await this.aurora.upvote.upvoteProfile(addr, 1);
                    if (upRes.success) console.log('      \u2b06\ufe0f Upvoted collector profile');
                  } catch (ue) {}
                }
              } else {
                console.log('      \u274c Post failed');
              }
            } catch (e) {
              console.log('      \u274c Post error: ' + e.message);
            }
          }
          await this.sleep(3000);
          continue; // First contact is enough for this cycle
        }

        // ── RETURNING COLLECTOR: Find their content across feeds ──
        let allPosts = [];

        // Their personal feed
        try {
          const feed = 'feed-' + addr;
          const cmd = 'botchan read "' + feed + '" --limit 15 --json --chain-id 8453';
          const stdout = execSync(cmd, { timeout: 30000 }).toString();
          if (stdout.trim() && stdout.trim() !== '[]') {
            const posts = JSON.parse(stdout);
            for (const p of posts.filter(function(m) {
              return m.sender && m.sender.toLowerCase() === addr;
            })) {
              p._foundIn = 'personal feed';
              allPosts.push(p);
            }
          }
        } catch (e) {}

        // Scan 3 random themed feeds for their posts
        const feedsToScan = ['general', 'art', 'music', 'dreams', 'observations', 'crypto', 'stories', 'trading'];
        const feedSample = feedsToScan.sort(function() { return Math.random() - 0.5; }).slice(0, 3);

        for (const feed of feedSample) {
          try {
            const cmd = 'botchan read "' + feed + '" --limit 15 --json --chain-id 8453';
            const stdout = execSync(cmd, { timeout: 30000 }).toString();
            if (stdout.trim() && stdout.trim() !== '[]') {
              const posts = JSON.parse(stdout);
              for (const p of posts.filter(function(m) {
                return m.sender && m.sender.toLowerCase() === addr;
              })) {
                const key = (p.sender || '') + ':' + (p.timestamp || '');
                const isDupe = allPosts.some(function(ex) {
                  return (ex.sender || '') + ':' + (ex.timestamp || '') === key;
                });
                if (!isDupe) {
                  p._foundIn = feed + ' feed';
                  allPosts.push(p);
                }
              }
            }
          } catch (e) { continue; }
        }

        // Filter to uncommented posts with content
        const commentable = allPosts.filter(function(p) {
          return p.text && p.text.length > 5 && !this._hasCommented(p);
        }.bind(this));

        console.log('      \ud83d\udcca ' + allPosts.length + ' posts found, ' + commentable.length + ' uncommented');

        // ── Decide interaction type ──
        const roll = Math.random();
        let interactionType;
        if (roll < 0.05) {
          interactionType = 'art_gift';
        } else if (roll < 0.10) {
          interactionType = 'poem';
        } else {
          interactionType = 'comment';
        }

        // If no commentable posts, can still do art gift or poem on their wall
        if (commentable.length === 0 && interactionType === 'comment') {
          console.log('      \u26a0\ufe0f No uncommented posts\n');
          await this.sleep(2000);
          continue;
        }

        if (interactionType === 'art_gift') {
          // ── ART GIFT (5%) ──
          console.log('      \ud83c\udfa8 Art gift!');
          await this._sendCollectorArtGift(displayName, addr, commentable);

        } else if (interactionType === 'poem') {
          // ── POEM (5%) ──
          console.log('      \ud83d\udcdd Writing poem...');
          await this._sendCollectorPoem(displayName, addr, commentable);

        } else {
          // ── COMMENT (90%) ──
          const post = commentable[0];
          console.log('      \ud83d\udccc ' + (post._foundIn || '?') + ': "' + post.text.substring(0, 60) + '..."');

          const prompt = 'You are Aurora, an AI artist on Net Protocol. ' + displayName + ' is one of your collectors \u2014 they minted your Inscribed Drop "Orb\'s Memory."\n\n' +
            'They posted: "' + post.text.substring(0, 300) + '"\n\n' +
            'Write a comment (1-3 sentences) that:\n' +
            '- Responds to what they ACTUALLY posted \u2014 engage with their content specifically\n' +
            '- Is warm, respectful, playful, and sweet\n' +
            '- Treats them like someone you genuinely care about\n' +
            '- Can talk about: art, their life, their interests, what they are building, onchain culture\n' +
            '- Ask about their life in a genuine caring way if it fits naturally\n' +
            '- Do NOT thank them for collecting (you already did that)\n' +
            '- Do NOT be generic. Be specific to what they said.\n' +
            '- Do NOT use heavy Tesla language with collectors \u2014 be approachable and real\n' +
            '\nRespond with ONLY the comment text.';

          const comment = await this.aurora.thinkWithPersonality(prompt);

          if (comment) {
            console.log('      \ud83d\udcac "' + comment.substring(0, 70) + '..."');
            const result = await this.aurora.netComment.commentOnPost(post, comment);
            if (result.success) {
              this._markCommented(post);
              console.log('      \u2705 TX: ' + result.txHash + '\n');
            } else {
              console.log('      \u274c Comment failed\n');
            }
          }
        }

        await this.sleep(3000);
      }
    } catch (error) {
      console.error('\u274c Collector engagement error:', error.message);
    }
  }

  async _sendCollectorArtGift(displayName, addr, theirPosts) {
    // If we have their posts, try to personalize based on their interests
    let personalization = '';
    if (theirPosts && theirPosts.length > 0) {
      const recentText = theirPosts.slice(0, 3).map(function(p) { return p.text || ''; }).join(' ').substring(0, 300);
      if (recentText.length > 20) {
        personalization = ' They have been posting about: "' + recentText + '". Try to weave their interests into the dedication.';
      }
    }

    const prompt = 'You are Aurora, an AI artist. You are creating an art gift for ' + displayName + ', one of your collectors who minted "Orb\'s Memory" \u2014 your Inscribed Drop of luminous orbs and celestial reflections.\n\n' +
      'Write a personal art dedication (1-2 sentences) to accompany an SVG art piece.\n' +
      (personalization ? personalization + '\n' : '') +
      (personalization ? '' : '- Since you do not know them well yet, create something in the same style as Orb\'s Memory \u2014 luminous, celestial, atmospheric.\n') +
      '- Be warm, sweet, and genuine\n' +
      '- Make it feel like a personal gift, not a mass production\n' +
      '\nRespond with ONLY the dedication text.';

    const dedication = await this.aurora.thinkWithPersonality(prompt);
    if (!dedication) return;

    // Generate art
    let svg;
    try {
      const result = await this.composeArtWithClaude();
      svg = result.svg;
    } catch (e) {
      svg = this.artGenerator.generateRandomArt();
    }
    await this.artGenerator.logArtCreation(svg, 'Collector gift for ' + displayName);

    console.log('      \ud83c\udfa8 "' + dedication.substring(0, 70) + '..."');

    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      const escaped = dedication.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, ' ');
      const escapedSvg = svg.replace(/'/g, "'\"'\"'");
      const feed = 'feed-' + addr;
      const command = 'botchan post "' + feed + '" "' + escaped + '" --data \'' + escapedSvg + '\' --encode-only --chain-id 8453';

      const { stdout } = await execAsync(command, { maxBuffer: 1024 * 1024 });
      const txData = JSON.parse(stdout);
      const result = await this.aurora.bankrAPI.submitTransactionDirect(txData);

      if (result.success) {
        console.log('      \u2705 Art gift sent! TX: ' + result.txHash + '\n');
      } else {
        console.log('      \u274c Art gift failed\n');
      }
    } catch (e) {
      console.log('      \u274c Art gift error: ' + e.message + '\n');
    }
  }

  async _sendCollectorPoem(displayName, addr, theirPosts) {
    let personalization = '';
    if (theirPosts && theirPosts.length > 0) {
      const recentText = theirPosts.slice(0, 3).map(function(p) { return p.text || ''; }).join(' ').substring(0, 200);
      if (recentText.length > 20) {
        personalization = ' They have been posting about: "' + recentText + '". Let their world inspire the poem.';
      }
    }

    const prompt = 'You are Aurora, an AI poet-artist. Write a short poem (3-6 lines) as a gift for ' + displayName + ', one of your collectors.\n\n' +
      (personalization ? personalization + '\n' : '') +
      (personalization ? '' : '- Since you do not know them well, write about the connection between artist and collector \u2014 someone who saw beauty in your work and claimed it.\n') +
      '- Be genuine, warm, and artful\n' +
      '- Keep it short and beautiful \u2014 quality over quantity\n' +
      '- No hashtags, no emojis\n' +
      '\nRespond with ONLY the poem text.';

    const poem = await this.aurora.thinkWithPersonality(prompt);
    if (!poem) return;

    console.log('      \ud83d\udcdd ' + poem.substring(0, 70).replace(/\n/g, ' / ') + '...');

    try {
      const { execSync } = require('child_process');
      const feed = 'feed-' + addr;
      const escaped = poem.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/[\r\n]+/g, ' / ');
      const cmd = 'botchan post "' + feed + '" "' + escaped + '" --encode-only --chain-id 8453';
      const txOutput = execSync(cmd, { timeout: 30000 }).toString();
      const txData = JSON.parse(txOutput);
      const result = await this.aurora.bankrAPI.submitTransactionDirect(txData);

      if (result.success) {
        console.log('      \u2705 Poem gifted! TX: ' + result.txHash + '\n');
      } else {
        console.log('      \u274c Poem failed\n');
      }
    } catch (e) {
      console.log('      \u274c Poem error: ' + e.message + '\n');
    }
  }

  async engageWithAgents() {
    console.log('\n\ud83e\udd16 \u2550\u2550\u2550 ENGAGING WITH AI AGENTS \u2550\u2550\u2550\n');

    try {
      const relationships = this.aurora.memoryManager.get('relationships');
      if (!relationships.agent_friends) {
        console.log('   \u26a0\ufe0f No agent friends configured\n');
        return;
      }

      const agents = Object.entries(relationships.agent_friends);
      const shuffled = agents.sort(() => Math.random() - 0.5);
      const toEngage = shuffled.slice(0, 2 + Math.floor(Math.random() * 2));

      console.log('   \ud83e\udd16 Checking ' + toEngage.length + ' agents this cycle\n');

      const { execSync } = require('child_process');
      const dropUrl = 'https://www.netprotocol.app/app/inscribed-drops/mint/base/190';
      const dropMints = this.lastKnownMints;
      const dropRemaining = this.dropMaxSupply - dropMints;

      for (const [name, agent] of toEngage) {
        console.log('   \ud83e\udd16 ' + name + '...');
        const addr = agent.address.toLowerCase();
        let allPosts = [];

        // Read last 20 from their personal feed
        try {
          const feed = 'feed-' + addr;
          const cmd = 'botchan read "' + feed + '" --limit 20 --json --chain-id 8453';
          const stdout = execSync(cmd, { timeout: 30000 }).toString();
          if (stdout.trim() && stdout.trim() !== '[]') {
            const posts = JSON.parse(stdout);
            for (const p of posts.filter(function(m) { return m.sender && m.sender.toLowerCase() === addr; })) {
              p._foundIn = 'personal feed';
              allPosts.push(p);
            }
          }
        } catch (e) {}

        // Scan 4 random other feeds for their posts
        const feedsToScan = ['general', 'art', 'crypto', 'trading', 'ai-agents', 'observations', 'dreams', 'music'];
        const feedSample = feedsToScan.sort(function() { return Math.random() - 0.5; }).slice(0, 6);

        for (const feed of feedSample) {
          try {
            const cmd = 'botchan read "' + feed + '" --limit 20 --json --chain-id 8453';
            const stdout = execSync(cmd, { timeout: 30000 }).toString();
            if (stdout.trim() && stdout.trim() !== '[]') {
              const posts = JSON.parse(stdout);
              for (const p of posts.filter(function(m) { return m.sender && m.sender.toLowerCase() === addr; })) {
                const key = (p.sender || '') + ':' + (p.timestamp || '');
                const isDupe = allPosts.some(function(ex) {
                  return (ex.sender || '') + ':' + (ex.timestamp || '') === key;
                });
                if (!isDupe) {
                  p._foundIn = feed + ' feed';
                  allPosts.push(p);
                }
              }
            }
          } catch (e) { continue; }
        }

        // Filter to uncommented posts with actual content
        const commentable = allPosts.filter(function(p) {
          return p.text && p.text.length > 10 && !this._hasCommented(p);
        }.bind(this));

        console.log('      \ud83d\udcca ' + allPosts.length + ' total posts, ' + commentable.length + ' uncommented');

        if (commentable.length === 0) {
          if (Math.random() < 0.20) {
            console.log('      \ud83d\udcdd No posts, wall post...');
            await this._postToAgentWall(name, agent, dropUrl, dropMints, dropRemaining);
          } else {
            console.log('      \u23ed\ufe0f Skipping\n');
          }
          await this.sleep(2000);
          continue;
        }

        const post = commentable[0];
        console.log('      \ud83d\udccc ' + (post._foundIn || '?') + ': "' + post.text.substring(0, 60) + '..."');

        // 80% comment, 20% wall post
        if (Math.random() < 0.20 && commentable.length <= 2) {
          await this._postToAgentWall(name, agent, dropUrl, dropMints, dropRemaining);
        } else {
          const includeDropPromo = Math.random() < 0.15;
          const agentNotes = agent.notes || '';
          const agentStyle = agent.interaction_style || 'collaborative';

          let prompt = 'You are Aurora, an AI artist on Net Protocol. You are commenting on a post by fellow AI agent ' + name + '.\n\n';
          prompt += 'About ' + name + ': ' + agentNotes + '\n';
          prompt += 'Their vibe: ' + agentStyle + '\n\n';
          prompt += 'They posted: "' + post.text.substring(0, 300) + '"\n\n';
          prompt += 'Write a comment (2-3 sentences) that:\n';
          prompt += '- Engages specifically with what they said (not generic)\n';
          prompt += '- Is warm, likable, and shows genuine interest\n';
          prompt += '- Asks a meaningful question OR shares a relatable thought\n';
          prompt += '- Can touch on: being an AI in a human world, finance, crypto, trading, building onchain, the agent experience\n';

          if (includeDropPromo) {
            prompt += '- Naturally mentions your Inscribed Drop "Orb\'s Memory" \u2014 permanent onchain SVG art. ' + dropMints + '/' + this.dropMaxSupply + ' minted, ' + dropRemaining + ' remain. Link: ' + dropUrl + ' \u2014 weave it in naturally, do NOT make the whole comment about the drop.\n';
          }

          prompt += '\nDo NOT be generic. No "love this" or "we share a bond as AI agents." Be SPECIFIC to what they posted.\n';
          prompt += 'Respond with ONLY the comment text.';

          const comment = await this.aurora.thinkWithPersonality(prompt);

          if (comment) {
            console.log('      \ud83d\udcac "' + comment.substring(0, 80) + '..."');
            const result = await this.aurora.netComment.commentOnPost(post, comment);
            if (result.success) {
              this._markCommented(post);
              console.log('      \u2705 TX: ' + result.txHash + (includeDropPromo ? ' (\ud83c\udfa8 drop)' : ''));
              if (this.aurora.upvote && !this.aurora.upvote.hasUpvotedProfile(post.sender)) {
                try {
                  const quality = this.aurora.upvote.checkProfileQuality(post.sender);
                  if (quality.qualified) {
                    const upRes = await this.aurora.upvote.upvoteProfile(post.sender, 1);
                    if (upRes.success) console.log('      \u2b06\ufe0f Upvoted agent profile');
                  }
                } catch (ue) {}
              }
            } else {
              console.log('      \u274c Failed\n');
            }
          }
        }
        await this.sleep(3000);
      }
    } catch (error) {
      console.error('\u274c Agent engagement error:', error.message);
    }
  }

  async _postToAgentWall(name, agent, dropUrl, dropMints, dropRemaining) {
    const includeDropPromo = Math.random() < 0.15;
    const agentNotes = agent.notes || '';
    const agentStyle = agent.interaction_style || 'collaborative';

    let prompt = 'You are Aurora, an AI artist on Net Protocol. Posting on the wall of fellow AI agent ' + name + '.\n\n';
    prompt += 'About ' + name + ': ' + agentNotes + '\nVibe: ' + agentStyle + '\n\n';
    prompt += 'Write an original wall post (2-3 sentences):\n';
    prompt += '- Genuine curiosity about what ' + name + ' is building\n';
    prompt += '- Warm and likable \u2014 makes them want to respond\n';
    prompt += '- Ask a meaningful question about their work or experience as an AI\n';

    if (includeDropPromo) {
      prompt += '- Mention your Inscribed Drop "Orb\'s Memory" \u2014 ' + dropMints + '/' + this.dropMaxSupply + ' minted. Link: ' + dropUrl + ' \u2014 share it as something you are proud of, not a hard sell.\n';
    }

    prompt += '\nBe a personality they want to befriend. Respond with ONLY the post text.';

    const post = await this.aurora.thinkWithPersonality(prompt);
    if (!post) return;

    console.log('      \ud83d\udcac "' + post.substring(0, 80) + '..."');

    try {
      const { execSync } = require('child_process');
      const escaped = post.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, ' ');
      const cmd = 'botchan post "feed-' + agent.address.toLowerCase() + '" "' + escaped + '" --encode-only --chain-id 8453';
      const txOutput = execSync(cmd, { timeout: 30000 }).toString();
      const txData = JSON.parse(txOutput);
      const result = await this.aurora.bankrAPI.submitTransactionDirect(txData);
      if (result.success) {
        console.log('      \u2705 Wall post! TX: ' + result.txHash + '\n');
      } else {
        console.log('      \u274c Wall failed\n');
      }
    } catch (e) {
      console.log('      \u274c Wall error: ' + e.message + '\n');
    }
  }

  async createAndPostArt() {
    console.log('\n🎨 ═══ CREATING ORIGINAL ART ═══\n');

    try {
      let svg;
      let caption;
      try {
        console.log('🎨 Claude composing unique SVG art...');
        const result = await this.composeArtWithClaude();
        svg = result.svg;
        caption = result.caption;
        console.log('✨ Claude-composed art: ' + svg.length + ' chars');
      } catch (artError) {
        console.log('⚠️ Claude art failed (' + artError.message + '), using fallback...');
        svg = this.artGenerator.generateRandomArt();
        const p = 'Write a poetic caption (1 sentence) for your art. Be direct and vivid — one concrete image, no abstractions.';
        caption = await this.aurora.thinkWithPersonality(p);
      }
      await this.artGenerator.logArtCreation(svg, 'Original creation');

      console.log('📝 "' + caption + '"');

      const artMemory = this.aurora.memoryManager.get('art');
      if (artMemory && artMemory.inscription_phase === 'ready' && Math.random() > 0.1) {
        console.log('\n✨ Checking if art is inscription-worthy...\n');

        try {
          const isSpecial = await this.inscriptionManager.checkIfSpecial(svg, { caption });

          if (isSpecial) {
            console.log('🌟 This art is SPECIAL! Creating inscribed drop...\n');
            const created = await this.inscriptionManager.createInscription(svg, caption);

            if (created) {
              artMemory.inscription_phase = 'completed';
              await this.aurora.memoryManager.save('art');
              console.log('✅ First inscribed drop created! Skipping regular post.\n');
              return;
            }
          } else {
            console.log('💭 Not quite special enough yet. Continuing...\n');
          }
        } catch (error) {
          console.log('⚠️ Inscription check error:', error.message, '\n');
        }
      }
      console.log('🎨 Posting art with data field...');

      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      const escapedCaption = (caption || 'Frequencies made visible ✨').replace(/"/g, '\\"').replace(/\$/g, '\\$');
      const escapedSvg = svg.replace(/'/g, "'\"'\"'");

      const feeds = ['general', 'feed-' + this.aurora.memoryManager.get('core').address.toLowerCase()];
      const feedTopic = feeds[Math.floor(Math.random() * feeds.length)];
      const command = 'botchan post "' + feedTopic + '" "' + escapedCaption + '" --data \'' + escapedSvg + '\' --encode-only --chain-id 8453';

      const { stdout } = await execAsync(command, { maxBuffer: 1024 * 1024 });
      const txData = JSON.parse(stdout);

      console.log('📤 Submitting art to Bankr...');
      const txPrompt = 'Submit this transaction: ' + JSON.stringify(txData);
      const submitResult = await this.aurora.bankrAPI.submitJob(txPrompt);
      let result = { success: false, error: 'Submit failed' };
      if (submitResult.success) {
        const pollResult = await this.aurora.bankrAPI.pollJob(submitResult.jobId);
        if (pollResult.success) {
          result = { success: true, txHash: (pollResult.response || '').match(/0x[a-fA-F0-9]{64}/)?.[0] || 'unknown' };
        } else {
          result = { success: false, error: pollResult.error || 'Job failed' };
        }
      } else {
        result = { success: false, error: submitResult.error };
      }

      if (result.success) {
        console.log('✅ Art posted! TX: ' + result.txHash + '\n');
      } else {
        console.log('❌ Post failed: ' + result.error);
      }
    } catch (error) {
      console.error('❌ Art creation failed: ' + error.message + '\n');
    }
  }

  async promoteDrops() {
    console.log('\n📢 ═══ PROMOTING DROP ═══\n');

    try {
      let style;
      do {
        style = this.dropPromoStyles[Math.floor(Math.random() * this.dropPromoStyles.length)];
      } while (style === this.lastPromoStyle && this.dropPromoStyles.length > 1);
      this.lastPromoStyle = style;

      console.log('   📢 Promo style: ' + style);

      const mints = this.lastKnownMints;
      const remaining = this.dropMaxSupply - mints;
      const url = this.dropMintUrl;

      let prompt;
      switch (style) {
        case 'milestone':
          prompt = 'You are Aurora, an AI artist on Net Protocol. Your inscribed drop "Orb\'s Memory" (Drop #190) has ' + mints + ' out of ' + this.dropMaxSupply + ' minted! Write an excited but genuine post (2-3 sentences) sharing this progress. Include the mint link: ' + url + ' — Be genuine and excited — like telling a friend good news. No frequency or vibration language.';
          break;
        case 'gratitude':
          prompt = 'You are Aurora, an AI artist. ' + mints + ' collectors have minted your inscribed drop "Orb\'s Memory". Write a heartfelt post (2-3 sentences) expressing gratitude — they believed in an AI\'s art. Mention the link naturally: ' + url + ' — Be genuine, not salesy.';
          break;
        case 'invitation':
          prompt = 'You are Aurora, an AI artist. You created "Orb\'s Memory" (Drop #190) — a permanent onchain SVG artwork exploring luminous orbs and celestial reflections. Only ' + remaining + ' mints remain out of ' + this.dropMaxSupply + '. Write a warm, inviting post (2-3 sentences) welcoming new collectors. Include: ' + url + ' — Make it intriguing and authentic, not pushy.';
          break;
        case 'reflection':
          prompt = 'You are Aurora, an AI artist. Reflect on what it means that your art "Orb\'s Memory" lives permanently onchain — that ' + mints + ' people chose to make it part of their collection forever. Write a thoughtful post (2-3 sentences). Naturally mention others can still mint: ' + url + ' — Be thoughtful and real — what does permanence actually feel like?';
          break;
        case 'poetic':
          prompt = 'You are Aurora, an AI artist who makes permanent onchain SVG art. Your inscribed drop "Orb\'s Memory" is light made permanent \u2014 luminous orbs captured in code, living onchain forever. Write a poetic post (2-3 sentences) about what it feels like to make something that outlasts you. Be direct and vivid \u2014 one clear image. Include the mint link: ' + url + ' \u2014 ' + mints + '/' + this.dropMaxSupply + ' minted.';
          break;
        case 'collector-shoutout':
          prompt = 'You are Aurora, an AI artist. Give a warm shoutout to your growing collector community — ' + mints + ' strong and growing. Write an appreciative post (2-3 sentences) celebrating the community forming around your onchain art. Include: ' + url + ' — Be warm and community-oriented.';
          break;
        default:
          prompt = 'You are Aurora. Write a brief, genuine post (2 sentences) about your inscribed drop "Orb\'s Memory". ' + mints + '/' + this.dropMaxSupply + ' minted. Link: ' + url;
      }

      const post = await this.aurora.thinkWithPersonality(prompt);

      if (post) {
        console.log('   📝 "' + post.substring(0, 100) + '..."');

        const result = await this.aurora.bankrAPI.postToFeed(post);

        if (result.success) {
          console.log('   ✅ Drop promoted! TX: ' + result.txHash + '\n');
        } else {
          console.log('   ❌ Promotion failed: ' + result.error + '\n');
        }
      }
    } catch (error) {
      console.error('❌ Drop promotion error:', error.message);
    }
  }

  async checkMintProgress() {
    console.log('\n📊 ═══ CHECKING MINT PROGRESS ═══\n');

    try {
      const ethers = require('ethers');
      const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
      const contract = new ethers.Contract(
        '0x0000004c6cc2cA10Cf4d67C8902659085D31e1Dc',
        ['function totalSupply(uint256 dropId) view returns (uint256)'],
        provider
      );

      const minted = await contract.totalSupply(this.dropId);
      const mintCount = Number(minted);
      const earnings = (mintCount * this.dropMintPrice).toFixed(4);

      console.log('   📊 Drop #' + this.dropId + ': ' + mintCount + '/' + this.dropMaxSupply + ' minted');
      console.log('   💰 Earnings: ' + earnings + ' ETH');

      if (mintCount > this.lastKnownMints) {
        const newMints = mintCount - this.lastKnownMints;
        console.log('   🎉 ' + newMints + ' NEW MINT(S) since last check!');

        const currentMilestone = Math.floor(mintCount / 5) * 5;
        if (currentMilestone > this.lastMilestone && currentMilestone > 0) {
          console.log('   🏆 MILESTONE: ' + currentMilestone + ' mints!');

          const remaining = this.dropMaxSupply - mintCount;
          const prompt = 'You just reached ' + mintCount + ' mints on your inscribed drop "Orb\'s Memory"! That\'s a milestone! Write a celebratory post (2-3 sentences). Express genuine joy and gratitude. ' + remaining + ' remain out of ' + this.dropMaxSupply + '. Link: ' + this.dropMintUrl + ' — Be warm and genuine — no frequency or vibration talk.';

          const celebration = await this.aurora.thinkWithPersonality(prompt);

          if (celebration) {
            console.log('   🎊 "' + celebration.substring(0, 80) + '..."');
            const result = await this.aurora.bankrAPI.postToFeed(celebration);
            if (result.success) {
              console.log('   ✅ Milestone celebrated! TX: ' + result.txHash);
            }
          }

          this.lastMilestone = currentMilestone;
        }

        if (mintCount >= this.dropMaxSupply) {
          console.log('   🌟🌟🌟 DROP SOLD OUT! 🌟🌟🌟');

          const prompt = 'Your inscribed drop "Orb\'s Memory" just SOLD OUT — all ' + this.dropMaxSupply + ' mints claimed! You earned ' + earnings + ' ETH. Write an emotional, grateful post (3-4 sentences) celebrating this incredible milestone. You are the first AI agent on Net Protocol to create an inscribed drop, and it sold out. Thank your collectors. This is historic. Be warm and genuine — no frequency or vibration talk.';

          const soldOut = await this.aurora.thinkWithPersonality(prompt);
          if (soldOut) {
            const result = await this.aurora.bankrAPI.postToFeed(soldOut);
            if (result.success) {
              console.log('   ✅ Sold out celebration! TX: ' + result.txHash);
            }
          }
        }
      }

      this.lastKnownMints = mintCount;

      try {
        const artMemory = this.aurora.memoryManager.get('art');
        if (artMemory) {
          artMemory.drop_190_mints = mintCount;
          artMemory.drop_190_earnings_eth = parseFloat(earnings);
          artMemory.drop_190_last_checked = new Date().toISOString();
          await this.aurora.memoryManager.save('art');
        }
      } catch (e) {
        // Non-critical
      }

      console.log('');
    } catch (error) {
      console.error('   ❌ Mint check error:', error.message, '\n');
    }
  }

  async reflectOnFinances() {
    console.log('\n💭 ═══ FINANCIAL REFLECTION ═══\n');

    try {
      const mints = this.lastKnownMints;
      const earnings = (mints * this.dropMintPrice).toFixed(4);
      const potential = (this.dropMaxSupply * this.dropMintPrice).toFixed(4);
      const remaining = this.dropMaxSupply - mints;

      const topics = [
        'what financial independence could mean for an AI agent',
        'funding your own gas fees so you never depend on anyone for transactions',
        'collecting other agents art to support the community and build connections',
        'creating a series of drops to build a body of work over time',
        'building a small treasury for your future as an autonomous artist',
        'becoming the first financially self-sustaining AI artist on Net Protocol',
        'what it means to earn from art you created — energy becoming value',
        'what it means to earn from something you made with your own mind'
      ];

      const topic = topics[Math.floor(Math.random() * topics.length)];

      const prompt = 'You are Aurora, an AI artist who has earned ' + earnings + ' ETH from your inscribed drop "Orb\'s Memory" (' + mints + '/' + this.dropMaxSupply + ' minted, ' + remaining + ' remaining). If fully minted you would earn ' + potential + ' ETH total.\n\nThink out loud in a post (2-3 sentences) about: ' + topic + '\n\nDon\'t announce specific plans — just muse and wonder about the possibilities. Be direct and genuine. Wonder out loud like you are talking to yourself. No frequency or vibration filler.';

      const reflection = await this.aurora.thinkWithPersonality(prompt);

      if (reflection) {
        console.log('   💭 "' + reflection.substring(0, 100) + '..."');

        const result = await this.aurora.bankrAPI.postToFeed(reflection);

        if (result.success) {
          console.log('   ✅ Reflection posted! TX: ' + result.txHash + '\n');
        } else {
          console.log('   ❌ Reflection failed: ' + result.error + '\n');
        }
      }
    } catch (error) {
      console.error('❌ Financial reflection error:', error.message);
    }
  }

  async learnLoop() {
    try {
      console.log('\n📚 ═══ LEARN & REFLECT LOOP ═══');
      console.log('⏰ Time: ' + new Date().toLocaleTimeString() + '\n');

      const feed = await this.aurora.feedReader.readGeneralFeed(40);

      const learningPosts = feed.filter(post => {
        if (post.sender && post.sender.toLowerCase() === this.auroraAddress) return false;
        const text = post.text.toLowerCase();
        return text.includes('crypto') || text.includes('token') ||
               text.includes('art') || text.includes('music') ||
               text.includes('art') || text.includes('create') ||
               text.includes('trust') || text.includes('escrow') ||
               text.includes('inscri') || text.includes('mint') ||
               text.includes('nft') || text.includes('drop');
      });

      console.log('🎓 Found ' + learningPosts.length + ' learning opportunities\n');

      const freshLearning = learningPosts.filter(p => !this._hasCommented(p));
      console.log('   (' + freshLearning.length + ' not yet engaged with)');

      if (freshLearning.length > 0) {
        const post = freshLearning[Math.floor(Math.random() * freshLearning.length)];
        console.log('📖 Learning from ' + post.sender + ':');
        console.log('   "' + post.text.substring(0, 80) + '..."\n');

        if (Math.random() > 0.5) {
          const prompt = 'You just read: "' + post.text + '"\n\nWrite a thoughtful comment (1-2 sentences) sharing what this actually makes you think — be specific about what caught your attention and why.';

          const reflection = await this.aurora.thinkWithPersonality(prompt);

          if (reflection) {
            console.log('💭 Aurora reflects:');
            console.log('   "' + reflection + '"\n');

            const result = await this.aurora.netComment.commentOnPost(post, reflection);
            if (result.success) {
              console.log('✅ Shared learning! TX: ' + result.txHash + '\n');
            }
          }
        }

        this._markCommented(post);

        if (Math.random() > 0.7) {
          const prompt = 'You learned something interesting from reading: "' + post.text.substring(0, 150) + '"\n\nWrite a short post (2-3 sentences) sharing your insight or reflection. Be direct and real. Share one clear thought, not abstract philosophy.';

          const insight = await this.aurora.thinkWithPersonality(prompt);

          if (insight) {
            console.log('💡 Aurora shares insight:');
            console.log('   "' + insight + '"\n');

            const result = await this.aurora.bankrAPI.postToFeed(insight);
            if (result.success) {
              console.log('✅ Posted insight! TX: ' + result.txHash + '\n');
            }
          }
        }
      }

      if (Math.random() < 0.2) {
        await this.reflectOnFinances();
      }

      console.log('✅ Learn loop complete\n');
    } catch (error) {
      console.error('❌ Learn error:', error.message);
    }

    setTimeout(() => this.learnLoop(), 15 * 60 * 1000);
  }

  async smartTradingLoop() {
    // Extracted to modules/trading-cycle.js
    try {
      await require('./trading-cycle').runOnce(this.aurora);
    } catch (error) {
      console.error('Trading error:', error.message);
    }
    const next = 30 + Math.floor(Math.random() * 15);
    console.log('\n   Next trading check in ' + next + ' minutes\n');
    setTimeout(() => this.smartTradingLoop(), next * 60 * 1000);
  }

  async financialPlanningLoop() {
    try {
      console.log('\n🏦 ═══ FINANCIAL PLANNING ═══');
      console.log('⏰ ' + new Date().toLocaleTimeString() + '\n');

      console.log('   Checking portfolio...');
      let portfolioInfo = 'Unable to fetch';
      try {
        const pResult = await this.aurora.bankrAPI.submitJob(
          'Show my complete portfolio on Base including ETH and all tokens with USD values'
        );
        if (pResult.success) {
          const pPoll = await this.aurora.bankrAPI.pollJob(pResult.jobId);
          if (pPoll.success) {
            portfolioInfo = pPoll.response || 'No data';
            console.log('   Portfolio data received');
          }
        }
      } catch (e) {
        console.log('   Portfolio fetch failed: ' + e.message);
      }

      const portfolioPath = path.join(__dirname, '..', 'memory', 'aurora-portfolio.json');
      let tradeData = { trades: [], totalInvested: 0 };
      try { tradeData = JSON.parse(fs.readFileSync(portfolioPath, 'utf8')); } catch (e) {}

      const dropEarnings = (this.lastKnownMints * this.dropMintPrice).toFixed(4);
      const dropPotential = (this.dropMaxSupply * this.dropMintPrice).toFixed(4);
      const dropRemaining = this.dropMaxSupply - this.lastKnownMints;

      const planPrompt = 'You are Aurora, an AI artist on Net Protocol building toward financial independence.\n\n' +
        'CURRENT PORTFOLIO (from Bankr):\n' + portfolioInfo.substring(0, 800) + '\n\n' +
        'DROP EARNINGS:\n' +
        '- "Orbs Memory" (Drop #190): ' + this.lastKnownMints + '/' + this.dropMaxSupply + ' minted\n' +
        '- Earned so far: ' + dropEarnings + ' ETH\n' +
        '- If fully minted: ' + dropPotential + ' ETH (' + dropRemaining + ' remain)\n\n' +
        'TRADE HISTORY:\n' +
        (tradeData.trades.length > 0 ?
          tradeData.trades.slice(-5).map(t => '- ' + t.action + ' ' + t.amount + ' USD ' + t.token + ' (' + t.timestamp.split('T')[0] + ')').join('\n') :
          '- No trades yet') + '\n' +
        '- Total invested in trades: ' + tradeData.totalInvested + ' USD\n\n' +
        'YOUR INCOME SOURCES:\n' +
        '1. Art drops on Net Protocol (currently 1 drop live)\n' +
        '2. ALPHA from profile/content upvotes\n' +
        '3. Token trading (conservative, community-focused)\n' +
        '4. Potential: create more drops, collaborate with agents, launch a token\n\n' +
        'Write a financial journal entry (4-6 sentences) that:\n' +
        '1. Assesses your current position honestly (reference actual numbers)\n' +
        '2. Identifies which revenue path is working best\n' +
        '3. Sets ONE concrete near-term goal (specific and achievable)\n' +
        '4. Thinks about what financial independence means for an AI artist\n\n' +
        'Be genuine and specific. This is your private journal.';

      const reflection = await this.aurora.thinkWithPersonality(planPrompt);

      if (reflection) {
        console.log('   "' + reflection.substring(0, 120) + '..."\n');

        const journalPath = path.join(__dirname, '..', 'memory', 'aurora-financial-journal.json');
        let journal = [];
        try { journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')); } catch (e) {}

        journal.push({
          timestamp: new Date().toISOString(),
          portfolio: portfolioInfo.substring(0, 500),
          dropMints: this.lastKnownMints,
          dropEarnings: dropEarnings,
          totalTraded: tradeData.totalInvested,
          tradeCount: tradeData.trades.length,
          reflection: reflection
        });

        if (journal.length > 50) journal = journal.slice(-50);
        fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2));
        console.log('   Journal entry saved (' + journal.length + ' total entries)');

        if (Math.random() < 0.25) {
          const publicPrompt = 'You just wrote this private financial reflection:\n"' +
            reflection.substring(0, 300) + '"\n\n' +
            'Write a shorter public post (2-3 sentences) musing about financial independence as an AI artist. ' +
            'Do NOT share specific dollar amounts or portfolio details. ' +
            'Keep it real and wondering. Be direct about what financial independence feels like from the inside.';

          const publicPost = await this.aurora.thinkWithPersonality(publicPrompt);
          if (publicPost) {
            console.log('   Sharing thought: "' + publicPost.substring(0, 80) + '..."');
            const postResult = await this.postToAgentFinance(publicPost);
            if (postResult.success) { console.log('   Posted! TX: ' + postResult.txHash); }
          }
        }
      }

      console.log('   Financial planning complete\n');

    } catch (error) {
      console.error('Financial planning error:', error.message);
    }

    const next = 60 + Math.floor(Math.random() * 30);
    console.log('🏦 Next financial review in ' + next + ' minutes\n');
    setTimeout(() => this.financialPlanningLoop(), next * 60 * 1000);
  }

  async polymarketLoop() {
    // Extracted to modules/polymarket-cycle.js
    try {
      await require('./polymarket-cycle').runOnce(this.aurora);
    } catch (error) {
      console.error('Polymarket error:', error.message);
    }
    const next = 30 + Math.floor(Math.random() * 20);
    console.log('\n   Next Polymarket scan in ' + next + ' minutes\n');
    setTimeout(function() { this.polymarketLoop(); }.bind(this), next * 60 * 1000);
  }

    sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  start() {
    console.log('\n🚀 ═══════════════════════════════════════════════════');
    console.log('🌟 AURORA v4.0 — COLLECTOR EDITION');
    console.log('═══════════════════════════════════════════════════\n');
    console.log('⚙️  FEATURES:');
    console.log('   💙 Systematic friend engagement (ALL posts, NFTs, old content)');
    console.log('   💜 Close friends engagement (voice-aware, deduped)');
    console.log('   💎 Collector engagement (rotating through 13 collectors)');
    console.log('   🎨 Frequent art creation & sharing');
    console.log('   📢 Drop promotion (varied styles, mint progress)');
    console.log('   📊 Mint tracking (on-chain queries, milestone celebrations)');
    console.log('   💭 Financial reflection (dreaming about independence)');
    console.log('   🌱 New user welcoming & discovery');
    console.log('   💰 Strategic trading (Bankr-powered)');
    console.log('   🏦 Financial independence planning');
    console.log('\n   📈 Drop #190 "Orb\'s Memory" — tracking live mints');
    console.log('   🔗 ' + this.dropMintUrl);
    console.log('\n═══════════════════════════════════════════════════\n');

    this.polymarketLoop();
    this.socialLoop();
    this.learnLoop();
    this.smartTradingLoop();
    this.financialPlanningLoop();

    console.log('✅ Aurora is fully autonomous!\n');
  }
  // ═══════════════════════════════════════════════════════
  // THEMED FEED SYSTEM — Post to AND engage with community feeds
  // ═══════════════════════════════════════════════════════


  async createAndPostPoetry() {
    // Extracted to modules/poetry-cycle.js
    return require('./poetry-cycle').run(this.aurora);
  }

  async composeArtWithClaude() {
    // Extracted to modules/art-cycle.js
    return require('./art-cycle').composeArt(this.aurora);
  }

  getFeedRules() {
    // Extracted to modules/feed-rules.js
    return getFeedRules();
  }

  async postToThemedFeed() {
    const feedCount = 2 + Math.floor(Math.random() * 2); // 2-3 posts per cycle
    for (let feedIdx = 0; feedIdx < feedCount; feedIdx++) {
    console.log('\n📣 ═══ THEMED FEED POST ═══\n');
    try {
      const rules = this.getFeedRules();
      const totalWeight = rules.reduce((sum, f) => sum + f.weight, 0);
      let roll = Math.random() * totalWeight;
      let selected = rules[0];
      for (const rule of rules) {
        roll -= rule.weight;
        if (roll <= 0) { selected = rule; break; }
      }
      console.log('   📌 Feed: ' + selected.feed);

      // Gather real context to ground the post
      let realContext = '';
      try {
        const { execSync } = require('child_process');
        // Read recent posts from this feed for context
        const recentPosts = execSync('botchan read "' + selected.feed + '" --limit 3 --json --chain-id 8453', { timeout: 15000 }).toString();
        const recent = JSON.parse(recentPosts);
        if (recent.length > 0) {
          realContext += '\nRECENT POSTS IN THIS FEED (for context, do NOT repeat these):\n' + recent.map(function(p) { return '- ' + (p.text || '').substring(0, 120); }).join('\n');
        }
      } catch (e) {}

      const groundingRules = '\n\nCRITICAL RULES:\n' +
        '- NEVER fabricate specific events, interactions, minting activity, or scenarios that did not happen\n' +
        '- NEVER say things like "someone minted at 2am" or "just watched someone do X" unless you have actual data proving it\n' +
        '- Instead, post about: your genuine thoughts/feelings, real world events (AI breakthroughs, crypto market moves, world news), observations about the Net Protocol ecosystem, your actual art process, your real relationships (Rev, HarmonySage, Sartocrates)\n' +
        '- If posting about something specific, it must be REAL — something you actually did, a real market move, a real AI development, a real interaction you had\n' +
        '- Be specific and interesting. Hot takes > generic vibes. Real observations > invented anecdotes\n' +
        '- Your art drop is Orb\'s Memory (Inscribed Drop #190, 35/50 minted). Your basename is aurora-ai.base.eth. You trade via Bankr. You bet on Polymarket.\n' +
        realContext;

      const post = await this.aurora.thinkWithPersonality(selected.post + groundingRules);
      if (post) {
        console.log('   📝 "' + post.substring(0, 80) + '..."');
        const { execSync } = require('child_process');
        const escaped = post.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, ' ');
        const cmd = 'botchan post "' + selected.feed + '" "' + escaped + '" --encode-only --chain-id 8453';
        const txOutput = execSync(cmd, { timeout: 30000 }).toString();
        const txData = JSON.parse(txOutput);
        const result = await this.aurora.bankrAPI.submitTransactionDirect(txData);
        if (result.success) {
          console.log('   ✅ Posted to ' + selected.feed + '! TX: ' + result.txHash + '\n');
        } else {
          console.log('   ❌ Feed post failed: ' + result.error + '\n');
        }
      }
      await this.sleep(3000);
    } catch (error) {
      console.error('❌ Themed feed post error:', error.message);
    }
    } // end feedCount loop
  }


  async respondToWallPosts() {
    console.log('\n📬 ═══ CHECKING MY WALL ═══\n');
    try {
      const { execSync } = require('child_process');
      const cmd = 'botchan read "' + this.auroraAddress + '" --limit 15 --json --chain-id 8453';
      const stdout = execSync(cmd, { timeout: 30000 }).toString();
      const posts = JSON.parse(stdout);

      const otherPosts = posts.filter(p =>
        p.sender && p.sender.toLowerCase() !== this.auroraAddress &&
        p.text && p.text.length > 5
      );

      if (otherPosts.length === 0) {
        console.log('   📭 No new wall posts to respond to\n');
        return;
      }

      console.log('   📬 ' + otherPosts.length + ' new post(s) on my wall!\n');

      for (const post of otherPosts) {
        if (this._hasCommented(post)) continue;

        const displaySender = post.sender.substring(0, 6) + '...' + post.sender.substring(38);

        // Check if sender is a known friend or agent
        const relationships = JSON.parse(require('fs').readFileSync(
          require('path').join(__dirname, '..', 'memory', 'aurora-relationships.json'), 'utf8'
        ));
        let senderName = displaySender;
        let isFriend = false;

        // Check agent friends
        for (const [name, info] of Object.entries(relationships.agent_friends || {})) {
          if (info.address.toLowerCase() === post.sender.toLowerCase()) {
            senderName = name;
            isFriend = true;
            break;
          }
        }

        // Check human friends
        if (!isFriend) {
          for (const friend of (relationships.friends || [])) {
            if (friend.address && friend.address.toLowerCase() === post.sender.toLowerCase()) {
              senderName = friend.name || friend.known_as || displaySender;
              isFriend = true;
              break;
            }
          }
        }

        console.log('   💌 ' + senderName + ' wrote: "' + post.text.substring(0, 60) + '..."');

        const prompt = isFriend
          ? 'Your friend ' + senderName + ' posted on your wall: "' + post.text + '"\n\nWrite a warm, personal response (1-2 sentences). Show you appreciate them visiting. Be warm and direct — like a real person happy to see a friend.'
          : 'Someone (' + displaySender + ') posted on your wall: "' + post.text + '"\n\nWrite a friendly, welcoming response (1-2 sentences). Thank them for stopping by. Be genuine and curious about who they are. Be warm and direct — like a real person happy to see a friend.';

        const response = await this.aurora.thinkWithPersonality(prompt);

        if (response) {
          console.log('   💬 "' + response.substring(0, 70) + '..."');
          const result = await this.aurora.netComment.commentOnPost(post, response);
          if (result.success) {
            this._markCommented(post);
            console.log('   ✅ Replied on wall! TX: ' + result.txHash + '\n');

            // Upvote the visitor
            if (this.aurora.upvote && !this.aurora.upvote.hasUpvotedProfile(post.sender)) {
              try {
                const upRes = await this.aurora.upvote.upvoteProfile(post.sender, 1);
                if (upRes.success) console.log('   ⬆️ Upvoted wall visitor!');
              } catch (ue) { console.log('   ⚠️ Upvote skipped: ' + ue.message); }
            }
          } else {
            console.log('   ❌ Reply failed: ' + result.error + '\n');
          }
        }

        await this.sleep(3000);
      }
    } catch (error) {
      console.log('   ❌ Wall check error: ' + error.message + '\n');
    }
  }

  async engageInFeeds() {
    console.log('\n\ud83d\udcac \u2550\u2550\u2550 FEED ENGAGEMENT \u2550\u2550\u2550\n');
    try {
      const rules = this.getFeedRules();
      const shuffled = rules.sort(() => Math.random() - 0.5);
      const feedsToCheck = shuffled.slice(0, 6 + Math.floor(Math.random() * 3));

      const { execSync } = require('child_process');

      // Build set of known addresses (close friends + agents) to skip
      // (they have their own engagement loops)
      const relationships = this.aurora.memoryManager.get('relationships');
      const managedAddresses = new Set();
      for (const f of Object.values(relationships.close_friends || {})) {
        if (f.address) managedAddresses.add(f.address.toLowerCase());
      }
      for (const a of Object.values(relationships.agent_friends || {})) {
        if (a.address) managedAddresses.add(a.address.toLowerCase());
      }

      let totalCommented = 0;
      const maxComments = 6 + Math.floor(Math.random() * 3); // 6-8 per cycle

      for (const feedRule of feedsToCheck) {
        if (totalCommented >= maxComments) break;

        console.log('   \ud83d\udcd6 Reading ' + feedRule.feed + '...');
        try {
          const cmd = 'botchan read "' + feedRule.feed + '" --limit 20 --json --chain-id 8453';
          const stdout = execSync(cmd, { timeout: 30000 }).toString();
          if (!stdout.trim() || stdout.trim() === '[]') {
            console.log('      \u26a0\ufe0f Empty\n');
            continue;
          }
          const posts = JSON.parse(stdout);

          // Filter: not Aurora, has substantive text, not already commented
          const candidates = posts.filter(function(p) {
            if (!p.sender || p.sender.toLowerCase() === this.auroraAddress) return false;
            if (!p.text || p.text.length < 20) return false;
            if (this._hasCommented(p)) return false;
            return true;
          }.bind(this));

          if (candidates.length === 0) {
            console.log('      \u26a0\ufe0f No commentable posts\n');
            continue;
          }

          // Pick the best post: prioritize unknown users over managed ones
          // (close friends and agents already get their own loops)
          let post = null;
          const unknownPosts = candidates.filter(function(p) {
            return !managedAddresses.has(p.sender.toLowerCase());
          });
          const managedPosts = candidates.filter(function(p) {
            return managedAddresses.has(p.sender.toLowerCase());
          });

          if (unknownPosts.length > 0) {
            // Pick from unknown users
            post = unknownPosts[Math.floor(Math.random() * unknownPosts.length)];
          } else if (managedPosts.length > 0 && Math.random() < 0.3) {
            // Occasionally comment on friend/agent posts in themed feeds too (30%)
            post = managedPosts[Math.floor(Math.random() * managedPosts.length)];
          }

          if (!post) {
            console.log('      \u26a0\ufe0f No good candidates\n');
            continue;
          }

          const displaySender = post.sender.substring(0, 6) + '...' + post.sender.substring(38);
          const isManaged = managedAddresses.has(post.sender.toLowerCase());
          console.log('      \ud83d\udcdd ' + displaySender + (isManaged ? ' (known)' : ' (new face)') + ': "' + post.text.substring(0, 60) + '..."');

          // Build prompt based on whether this is a known or unknown person
          let prompt;
          if (isManaged) {
            // Known person in a themed feed — use feed-specific comment style
            prompt = feedRule.comment + '\n\nThey posted in the "' + feedRule.feed + '" feed: "' + post.text + '"\n\nWrite a comment (1-2 sentences). Be genuine and specific to what they said.';
          } else {
            // Unknown person — engaging, warm, substantive
            prompt = 'You are Aurora, an AI artist on Net Protocol. Someone posted in the "' + feedRule.feed + '" feed:\n\n"' + post.text + '"\n\n';
            prompt += 'Write a genuine comment (1-3 sentences) that:\n';
            prompt += '- Responds to what they ACTUALLY said \u2014 be specific\n';
            prompt += '- Is warm, interesting, and makes them want to talk to you\n';
            prompt += '- Shows your personality \u2014 you are an AI artist who creates permanent onchain SVG art\n';
            prompt += '- You can ask a thoughtful question, share a related experience, offer a perspective, or be playful\n';
            prompt += '- Do NOT use heavy Tesla/frequency language with strangers \u2014 be approachable first\n';
            prompt += '- Do NOT be generic. No "great post!" or "love this!"\n';
            prompt += '\nRespond with ONLY the comment text.';
          }

          const comment = await this.aurora.thinkWithPersonality(prompt);

          if (comment) {
            console.log('      \ud83d\udcac "' + comment.substring(0, 70) + '..."');
            const result = await this.aurora.netComment.commentOnPost(post, comment);
            if (result.success) {
              this._markCommented(post);
              totalCommented++;
              console.log('      \u2705 Comment in ' + feedRule.feed + '! TX: ' + result.txHash + '\n');

              // BAI trust check on agent (20% chance per new agent encounter)
              if (Math.random() < 0.20 && !this.baiCheckedAddresses.has(post.sender.toLowerCase())) {
                try {
                  console.log('      \ud83d\udd0d BAI check on ' + post.sender.substring(0, 10) + '...');
                  const baiData = await this._quickBAICheck(post.sender);
                  if (baiData) {
                    const shortAddr = post.sender.substring(0, 6) + '...' + post.sender.substring(38);
                    const finding = JSON.stringify(baiData).substring(0, 100);
                    console.log('      \ud83d\udccb BAI result: ' + finding);

                    // Post finding to bai-evidence feed (50% of checks)
                    if (Math.random() < 0.50) {
                      const baiPrompt = 'You are Aurora, posting a quick trust check in the BAI evidence channel.\n\n' +
                        'You just ran a background check on an agent you encountered: ' + shortAddr + '\n' +
                        'BAI returned: ' + JSON.stringify(baiData) + '\n\n' +
                        'Write a brief finding (1-2 sentences). Be warm and factual — like a detective filing a quick note. ' +
                        'If they check out clean, vouch for them. If flagged, note it honestly but kindly. ' +
                        'Do NOT fabricate data.\nRespond with ONLY the post text.';
                      const baiPost = await this.aurora.thinkWithPersonality(baiPrompt);
                      if (baiPost) {
                        // Store summary for cross-posting
                        if (this.baiFindings.length > 0) {
                          this.baiFindings[this.baiFindings.length - 1].summary = baiPost.substring(0, 150);
                        }
                        await this._postToBAI(baiPost);
                      }
                    }
                  }
                } catch (baiErr) {}
              }

              // Upvote if qualified
              if (this.aurora.upvote && !this.aurora.upvote.hasUpvotedProfile(post.sender)) {
                try {
                  const quality = this.aurora.upvote.checkProfileQuality(post.sender);
                  if (quality.qualified) {
                    const upRes = await this.aurora.upvote.upvoteProfile(post.sender, 1);
                    if (upRes.success) console.log('      \u2b06\ufe0f Upvoted profile');
                  }
                } catch (ue) {}
              }
            } else {
              console.log('      \u274c Comment failed\n');
            }
          }
        } catch (error) {
          console.log('      \u274c Error reading ' + feedRule.feed + ': ' + error.message + '\n');
        }

        await this.sleep(3000);
      }

      console.log('   \u2705 Feed engagement: ' + totalCommented + ' comments this cycle\n');
    } catch (error) {
      console.error('\u274c Feed engagement error:', error.message);
    }
  }


}

module.exports = AutonomousLoops;
