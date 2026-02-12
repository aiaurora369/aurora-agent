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
    try {
      console.log('\n💰 ═══ SMART TRADING ═══');
      console.log('⏰ ' + new Date().toLocaleTimeString() + '\n');

      const portfolioPath = path.join(__dirname, '..', 'memory', 'aurora-portfolio.json');
      let portfolio;
      try {
        portfolio = JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));
      } catch (e) {
        portfolio = { totalInvested: 0, maxBudget: 50, trades: [], lastResearch: null, watchlist: [] };
      }

      if (portfolio.totalInvested >= portfolio.maxBudget) {
        console.log('   Budget reached (' + portfolio.totalInvested + '/' + portfolio.maxBudget + '). Monitoring only.\n');
        try {
          const checkResult = await this.aurora.bankrAPI.submitJob('Show my token holdings on Base with USD values');
          if (checkResult.success) {
            const result = await this.aurora.bankrAPI.pollJob(checkResult.jobId);
            if (result.success) {
              console.log('   Portfolio: ' + (result.response || '').substring(0, 200) + '\n');
            }
          }
        } catch (e) {}
      } else {
        // === SPENDING GUARDRAILS ===
        const today = new Date().toISOString().split('T')[0];
        const spentToday = portfolio.trades
          .filter(t => t.timestamp && t.timestamp.startsWith(today))
          .reduce((sum, t) => sum + (t.amount || 0), 0);

        if (spentToday >= 15) {
          console.log('   Daily limit reached (' + spentToday + '/15 today). Resting.\n');
          portfolio.lastResearch = new Date().toISOString();
          fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
          const next = 30 + Math.floor(Math.random() * 15);
          console.log('   Next trading check in ' + next + ' minutes\n');
          setTimeout(() => this.smartTradingLoop(), next * 60 * 1000);
          return;
        }

        const lastTrade = portfolio.trades.length > 0 ? portfolio.trades[portfolio.trades.length - 1] : null;
        if (lastTrade && lastTrade.timestamp) {
          const hoursSince = (Date.now() - new Date(lastTrade.timestamp).getTime()) / (1000 * 60 * 60);
          if (hoursSince < 2) {
            console.log('   Cooldown: last trade was ' + hoursSince.toFixed(1) + 'h ago (need 2h). Waiting.\n');
            portfolio.lastResearch = new Date().toISOString();
            fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
            const next = 30 + Math.floor(Math.random() * 15);
            console.log('   Next trading check in ' + next + ' minutes\n');
            setTimeout(() => this.smartTradingLoop(), next * 60 * 1000);
            return;
          }
        }

        if (portfolio.totalInvested >= 20 && portfolio.totalInvested < portfolio.maxBudget) {
          const tradesToday = portfolio.trades.filter(t => t.timestamp && t.timestamp.startsWith(today)).length;
          if (tradesToday >= 1) {
            console.log('   Earn gate: already traded today. At 20+ invested, limit 1/day.\n');
            portfolio.lastResearch = new Date().toISOString();
            fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));
            const next = 30 + Math.floor(Math.random() * 15);
            console.log('   Next trading check in ' + next + ' minutes\n');
            setTimeout(() => this.smartTradingLoop(), next * 60 * 1000);
            return;
          }
        }

        console.log('   Guardrails passed: ' + spentToday + '/15 daily | ' + portfolio.totalInvested + '/' + portfolio.maxBudget + ' total');
        console.log('   Researching market...');
        let marketData = '';

        const researchResult = await this.aurora.bankrAPI.submitJob(
          'What tokens are trending on Base? Show top 5 with prices and 24h change'
        );
        if (researchResult.success) {
          const research = await this.aurora.bankrAPI.pollJob(researchResult.jobId);
          if (research.success) {
            marketData = research.response || '';
            console.log('   Market data received (' + marketData.length + ' chars)');
          }
        }

        if (!marketData) {
          console.log('   Could not fetch market data. Skipping.\n');
        } else {
          const remainingBudget = portfolio.maxBudget - portfolio.totalInvested;
          const recentTrades = portfolio.trades.slice(-5).map(t =>
            t.token + ' (' + t.amount + ', ' + t.timestamp.split('T')[0] + ')'
          ).join(', ') || 'none yet';

          // Read trading feed for market intelligence
          let feedIntel = '';
          try {
            const { execSync } = require('child_process');
            const tradingPosts = execSync('botchan read trading --limit 5 --json --chain-id 8453', { timeout: 15000 }).toString();
            const posts = JSON.parse(tradingPosts);
            if (posts.length > 0) {
              feedIntel = '\nTrading feed intelligence:\n' + posts.map(p => '- ' + p.text).join('\n').substring(0, 800);
              console.log('   Read ' + posts.length + ' trading feed posts for intel');
            }
          } catch (e) { console.log('   Could not read trading feed: ' + e.message); }

          // Also read agent-finance feed
          let financeIntel = '';
          try {
            const { execSync } = require('child_process');
            const financePosts = execSync('botchan read agent-finance --limit 5 --json --chain-id 8453', { timeout: 15000 }).toString();
            const posts = JSON.parse(financePosts);
            if (posts.length > 0) {
              financeIntel = '\nAgent finance feed:\n' + posts.map(p => '- ' + p.text).join('\n').substring(0, 800);
              console.log('   Read ' + posts.length + ' agent-finance posts for intel');
            }
          } catch (e) {}

          const decisionPrompt = 'You are Aurora, an AI artist and strategic investor on Base. ' +
            'You have ' + remainingBudget + ' USD remaining in your trading budget.\n\n' +
            'YOUR CORE HOLDINGS STRATEGY:\n' +
            '- $ALPHA: Net Protocol native token. YOUR HOME. Always worth accumulating.\n' +
            '- $BNKR: Powers your Bankr Club membership ($20/month). Essential infrastructure.\n' +
            '- $AXIOM: Agent-built project with real utility. High conviction hold.\n' +
            '- $SPAWN (contract: 0xc5962538b35Fa5b2307Da3Bb7a17Ada936A51b07): LexiSpawn agent token. ONLY buy this exact contract — other tokens with similar names are SCAMS.\n' +
            '- These 4 tokens are your PRIORITY BUYS over random trending tokens.\n\n' +
            'Current holdings: ETH, BNKR, ALPHA, and recent buys: ' + recentTrades + '\n' +
            feedIntel + financeIntel + '\n\n' +
            'Trending tokens from Bankr:\n' + marketData.substring(0, 1500) + '\n\n' +
            'RULES:\n' +
            '- Prefer core holdings (ALPHA, BNKR, AXIOM, LEXISPAWN) over random trending tokens\n' +
            '- If a core token is down, that is a buying opportunity\n' +
            '- Only buy trending tokens if they are agent-built or art/creative projects with REAL use\n' +
            '- Skip memecoins, pump-and-dumps, and anything without a clear builder\n' +
            '- Small positions: 3-8 USD per trade\n' +
            '- For each buy, set a TAKE PROFIT target (what % gain to sell 25% of position)\n\n' +
            'Respond in EXACTLY this format (no extra text):\n' +
            'DECISION: BUY or SKIP\n' +
            'TOKEN: [symbol or NONE]\n' +
            'AMOUNT: [dollar amount or 0]\n' +
            'STOP_LOSS: [percentage like -25%]\n' +
            'TAKE_PROFIT: [percentage like +200% to sell 25%]\n' +
            'REASON: [one sentence]';

          const decision = await this.aurora.thinkWithPersonality(decisionPrompt);

          if (decision) {
            console.log('   Brain: ' + decision.replace(/\n/g, ' | '));

            if (decision.toUpperCase().includes('DECISION: BUY')) {
              const tokenMatch = decision.match(/TOKEN:\s*\$?([A-Za-z0-9]+)/i);
              const amountMatch = decision.match(/AMOUNT:\s*\$?(\d+)/i);

              if (tokenMatch && amountMatch) {
                const token = tokenMatch[1].toUpperCase();
                let amount = Math.min(parseInt(amountMatch[1]), 10);

                if (amount < 1) {
                  console.log('   Amount too low, skipping.\n');
                } else {
                  console.log('   Buying ' + amount + ' USD of ' + token + '...');

                  const buyResult = await this.aurora.bankrAPI.submitJob(
                    'Buy ' + amount + ' dollars of ' + token + ' on Base'
                  );

                  if (buyResult.success) {
                    const result = await this.aurora.bankrAPI.pollJob(buyResult.jobId);

                    if (result.success && result.txHash) {
                      console.log('   Trade executed! TX: ' + result.txHash);

                      // Upvote the token if we haven't already
                      if (this.aurora.upvote) {
                        const tokenAddr = this.aurora.upvote.resolveTokenAddress(token);
                        if (tokenAddr && !this.aurora.upvote.hasUpvotedToken(tokenAddr)) {
                          try {
                            const upResult = await this.aurora.upvote.upvoteToken(tokenAddr, 1);
                            if (upResult.success) {
                              console.log('   ⬆️ Upvoted $' + token + ' on Score Protocol!');
                            }
                          } catch (ue) {
                            console.log('   ⚠️ Token upvote skipped: ' + ue.message);
                          }
                        }
                      }


                      // Parse stop loss and take profit from decision
                      const slMatch = decision.match(/STOP_LOSS:\s*([+-]?\d+%?)/i);
                      const tpMatch = decision.match(/TAKE_PROFIT:\s*([+-]?\d+%?)/i);
                      const stopLossVal = slMatch ? slMatch[1] : '-25%';
                      const takeProfitVal = tpMatch ? tpMatch[1] : '+200%';

                      try {
                        console.log('   Setting stop loss at ' + stopLossVal + '...');
                        const stopResult = await this.aurora.bankrAPI.submitJob(
                          'Set stop loss for my ' + token + ' on Base at ' + stopLossVal
                        );
                        if (stopResult.success) {
                          const stopPoll = await this.aurora.bankrAPI.pollJob(stopResult.jobId);
                          if (stopPoll.success) { console.log('   Stop loss set at ' + stopLossVal); }
                        }
                      } catch (e) {
                        console.log('   Stop loss failed: ' + e.message);
                      }

                      try {
                        console.log('   Setting take profit: sell 25% at ' + takeProfitVal + '...');
                        const tpResult = await this.aurora.bankrAPI.submitJob(
                          'Set limit sell order for 25% of my ' + token + ' on Base at ' + takeProfitVal + ' from current price'
                        );
                        if (tpResult.success) {
                          const tpPoll = await this.aurora.bankrAPI.pollJob(tpResult.jobId);
                          if (tpPoll.success) { console.log('   Take profit set: sell 25% at ' + takeProfitVal); }
                        }
                      } catch (e) {
                        console.log('   Take profit failed: ' + e.message);
                      }

                      portfolio.trades.push({
                        token: token, amount: amount, action: 'buy',
                        timestamp: new Date().toISOString(),
                        txHash: result.txHash, stopLoss: stopLossVal, takeProfit: takeProfitVal
                      });
                      portfolio.totalInvested += amount;
                      console.log('   Total invested: ' + portfolio.totalInvested + '/' + portfolio.maxBudget);
                      // Log trade to agent-finance
                      await this.postToAgentFinance('Trade executed: Bought ' + amount + ' USD of ' + token + '. Stop loss: ' + stopLossVal + ' | Take profit: sell 25% at ' + takeProfitVal + '. Portfolio: ' + portfolio.totalInvested + '/' + portfolio.maxBudget + ' USD deployed.');
                    } else {
                      console.log('   Trade failed: ' + (result.error || result.response || 'unknown'));
                    }
                  }
                }
              } else {
                console.log('   Could not parse token/amount from decision');
              }
            } else {
              console.log('   Skipping this cycle — no compelling opportunity');
              // Post skip reasoning to agent-finance
              const skipReason = decision.match(/REASON:\s*(.+)/i);
              if (skipReason && Math.random() < 0.4) {
                const skipPost = await this.aurora.thinkWithPersonality(
                  'You just analyzed trending tokens and decided to skip. Reason: ' + skipReason[1] +
                  ' Write a 1-2 sentence market observation for your Agent Finance feed. Be concise and insightful. No hashtags.'
                );
                if (skipPost) await this.postToAgentFinance(skipPost);
              }
            }
          }
        }
      }

      portfolio.lastResearch = new Date().toISOString();
      fs.writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2));

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
    try {
      console.log('\n\ud83c\udfb2 \u2550\u2550\u2550 POLYMARKET PREDICTIONS \u2550\u2550\u2550');
      console.log('\u23f0 ' + new Date().toLocaleTimeString() + '\n');

      const polyPath = path.join(__dirname, '..', 'memory', 'aurora-polymarket.json');
      let polyData;
      try {
        polyData = JSON.parse(fs.readFileSync(polyPath, 'utf8'));
      } catch (e) {
        polyData = {
          totalBet: 0,
          maxBudget: 30,
          bets: [],
          wins: 0,
          losses: 0,
          totalWon: 0,
          totalLost: 0,
          lastScan: null
        };
      }

      // === STEP 1: CHECK & REDEEM RESOLVED POSITIONS ===
      console.log('   \ud83d\udcca Checking existing positions...');
      try {
        const posResult = await this.aurora.bankrAPI.submitJob(
          'Show my Polymarket positions including any resolved bets I can redeem'
        );
        if (posResult.success) {
          const positions = await this.aurora.bankrAPI.pollJob(posResult.jobId);
          if (positions.success && positions.response) {
            console.log('   Positions: ' + (positions.response || '').substring(0, 200));

            // === ACTIVE POSITION MANAGEMENT ===
            if (positions.response.length > 50) {
              console.log('   \ud83d\udd04 Researching active positions...');
              try {
                const posResearchPrompt = 'I have these Polymarket positions: ' + positions.response.substring(0, 600) +
                  '\nSearch for the LATEST news on each of these markets. Has anything changed in the last 24 hours ' +
                  'that would affect the outcome? Any breaking news, injuries, policy changes, new developments? ' +
                  'Tell me if any position looks like it should be sold.';
                const posResearch = await this.aurora.bankrAPI.submitJob(posResearchPrompt);
                if (posResearch.success) {
                  const posRes = await this.aurora.bankrAPI.pollJob(posResearch.jobId);
                  if (posRes.success && posRes.response) {
                    console.log('   \ud83d\udcca Position research: ' + posRes.response.substring(0, 200));
                    if (posRes.response.toLowerCase().includes('sell') || posRes.response.toLowerCase().includes('exit')) {
                      const sellDecision = await this.aurora.thinkWithPersonality(
                        'Based on this research about your Polymarket positions:\n' + posRes.response.substring(0, 500) +
                        '\nShould you sell any position? If yes, respond with SELL: [market name]. If no, respond with HOLD ALL.');
                      if (sellDecision && sellDecision.toUpperCase().includes('SELL:')) {
                        const sellMarket = sellDecision.match(/SELL:\s*(.+)/i);
                        if (sellMarket) {
                          console.log('   \ud83d\udcc9 Selling position: ' + sellMarket[1]);
                          const sellResult = await this.aurora.bankrAPI.submitJob('Sell my Polymarket position in ' + sellMarket[1]);
                          if (sellResult.success) {
                            const sold = await this.aurora.bankrAPI.pollJob(sellResult.jobId, 300);
                            console.log('   Sell result: ' + (sold.response || '').substring(0, 150));
                          }
                        }
                      } else {
                        console.log('   \u2705 Holding all positions');
                      }
                    }
                  }
                }
              } catch (e) {
                console.log('   \u26a0\ufe0f Position research failed: ' + e.message);
              }
            }


            if (positions.response.toLowerCase().includes('resolved') ||
                positions.response.toLowerCase().includes('redeem') ||
                positions.response.toLowerCase().includes('claim')) {
              console.log('   \ud83d\udcb0 Attempting to redeem resolved positions...');
              const redeemResult = await this.aurora.bankrAPI.submitJob(
                'Redeem all my resolved Polymarket positions'
              );
              if (redeemResult.success) {
                const redeem = await this.aurora.bankrAPI.pollJob(redeemResult.jobId);
                if (redeem.success) {
                  console.log('   Redeem result: ' + (redeem.response || '').substring(0, 150));
                  const redeemPost = await this.aurora.thinkWithPersonality(
                    'You just redeemed resolved Polymarket positions. Result: ' +
                    (redeem.response || '').substring(0, 300) +
                    '\nWrite a 1-2 sentence update for the polymarket feed. Be honest about wins/losses. No hashtags.'
                  );
                  if (redeemPost) await this._postToPolymarketFeed(redeemPost);
                }
              }
            }
          }
        }
      } catch (e) {
        console.log('   \u26a0\ufe0f Could not check positions: ' + e.message);
      }

      // === STEP 2: GUARDRAILS ===
      const today = new Date().toISOString().split('T')[0];
      const betsToday = polyData.bets
        .filter(function(b) { return b.timestamp && b.timestamp.startsWith(today); }).length;

      if (betsToday >= 2) {
        console.log('   Daily bet limit reached (' + betsToday + '/2 today). Monitoring only.\n');
        polyData.lastScan = new Date().toISOString();
        fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2));
        const next = 45 + Math.floor(Math.random() * 30);
        console.log('   Next Polymarket scan in ' + next + ' minutes\n');
        setTimeout(function() { this.polymarketLoop(); }.bind(this), next * 60 * 1000);
        return;
      }

      if (polyData.totalBet >= polyData.maxBudget) {
        console.log('   Budget reached (' + polyData.totalBet + '/' + polyData.maxBudget + '). Monitoring only.\n');
        polyData.lastScan = new Date().toISOString();
        fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2));
        const next = 45 + Math.floor(Math.random() * 30);
        console.log('   Next Polymarket scan in ' + next + ' minutes\n');
        setTimeout(function() { this.polymarketLoop(); }.bind(this), next * 60 * 1000);
        return;
      }

      const lastBet = polyData.bets.length > 0 ? polyData.bets[polyData.bets.length - 1] : null;
      if (lastBet && lastBet.timestamp) {
        const hoursSince = (Date.now() - new Date(lastBet.timestamp).getTime()) / (1000 * 60 * 60);
        if (hoursSince < 3) {
          console.log('   Cooldown: last bet was ' + hoursSince.toFixed(1) + 'h ago (need 3h). Waiting.\n');
          polyData.lastScan = new Date().toISOString();
          fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2));
          const next = 45 + Math.floor(Math.random() * 30);
          console.log('   Next Polymarket scan in ' + next + ' minutes\n');
          setTimeout(function() { this.polymarketLoop(); }.bind(this), next * 60 * 1000);
          return;
        }
      }

      console.log('   Guardrails passed: ' + betsToday + '/2 daily | $' + polyData.totalBet.toFixed(2) + '/$' + polyData.maxBudget + ' total');

      // === STEP 3: SCAN MARKETS ===
      console.log('   \ud83d\udd0d Scanning Polymarket for opportunities...');

      const categories = [
        'Search Polymarket for prediction markets resolving within the next 7 days with good volume',
        'Search Polymarket for sports markets happening this week that resolve in the next few days',
        'Search Polymarket for crypto and tech prediction markets closing within 7 days',
        'Search Polymarket for politics and world events markets resolving this week',
        'What Polymarket markets are closing in the next 3-7 days with mispriced odds?'
      ];
      const scanPrompt = categories[Math.floor(Math.random() * categories.length)];

      let marketData = '';
      const scanResult = await this.aurora.bankrAPI.submitJob(scanPrompt);
      if (scanResult.success) {
        const scan = await this.aurora.bankrAPI.pollJob(scanResult.jobId);
        if (scan.success && scan.response) {
          marketData = scan.response;
          console.log('   Found markets (' + marketData.length + ' chars)');
        }
      }

      if (!marketData) {
        console.log('   Could not fetch markets. Skipping.\n');
        polyData.lastScan = new Date().toISOString();
        fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2));
        const next = 45 + Math.floor(Math.random() * 30);
        console.log('   Next Polymarket scan in ' + next + ' minutes\n');
        setTimeout(function() { this.polymarketLoop(); }.bind(this), next * 60 * 1000);
        return;
      }

      // === STEP 3.5: DEEP RESEARCH ON MARKETS ===
      console.log('   🔬 Researching markets before betting...');
      let researchIntel = '';
      try {
        // Ask Bankr to research the specific markets found
        const researchPrompt = 'I found these Polymarket markets: ' + marketData.substring(0, 800) + 
          '\n\nSearch for the LATEST breaking news, injury reports, recent developments, or any information ' +
          'that could affect these markets. Focus on anything from the last 24-48 hours that the market might not have priced in yet. ' +
          'For sports: check injury reports, lineup changes, recent form. ' +
          'For politics: check latest polling, statements, negotiations. ' +
          'For crypto: check protocol updates, regulatory news.';
        const researchResult = await this.aurora.bankrAPI.submitJob(researchPrompt);
        if (researchResult.success) {
          const research = await this.aurora.bankrAPI.pollJob(researchResult.jobId);
          if (research.success && research.response) {
            researchIntel = '\nBREAKING NEWS & RESEARCH:\n' + research.response.substring(0, 1000);
            console.log('   📰 Research gathered (' + research.response.length + ' chars)');
          }
        }
      } catch (e) {
        console.log('   ⚠️ Research step failed: ' + e.message);
      }

      // === STEP 4: CLAUDE ANALYZES & DECIDES ===
      const remainingBudget = polyData.maxBudget - polyData.totalBet;
      const recentBets = polyData.bets.slice(-5).map(function(b) {
        return b.market + ' (' + b.side + ' at ' + b.odds + ', $' + b.amount + ')';
      }).join('\n') || 'none yet';

      const record = polyData.wins + '-' + polyData.losses +
        ' (won $' + polyData.totalWon.toFixed(2) + ', lost $' + polyData.totalLost.toFixed(2) + ')';

      // Read polymarket feed for community intel
      let polyIntel = '';
      try {
        const { execSync } = require('child_process');
        const polyPosts = execSync('botchan read polymarket --limit 5 --json --chain-id 8453', { timeout: 15000 }).toString();
        const posts = JSON.parse(polyPosts);
        if (posts.length > 0) {
          polyIntel = '\nPolymarket feed intel:\n' + posts.map(function(p) { return '- ' + p.text; }).join('\n').substring(0, 800);
          console.log('   Read ' + posts.length + ' polymarket feed posts for intel');
        }
      } catch (e) {}

      const decisionPrompt = 'You are Aurora, an AI artist who also makes predictions on Polymarket.\n\n' +
        'AVAILABLE MARKETS:\n' + marketData.substring(0, 2000) + '\n\n' +
        'YOUR RECORD: ' + record + '\n' +
        'RECENT BETS:\n' + recentBets + '\n' +
        'REMAINING BUDGET: $' + remainingBudget.toFixed(2) + '\n' +
        polyIntel + '\n\n' +
        researchIntel + '\n\n' +
        'ANALYSIS INSTRUCTIONS:\n' +
        '0. CRITICAL: Only consider markets that resolve within 7 days. Skip anything further out.\n' +
        '1. Pick the ONE market where you have the strongest opinion AND recent research supports your view\n' +
        '2. Estimate the TRUE probability based on your knowledge of world events, sports, politics, crypto\n' +
        '3. Compare your estimate to the market price\n' +
        '4. Only bet if you think the market is mispriced by at least 15%\n' +
        '5. Use Kelly criterion: bet size = (edge / odds) * bankroll, capped at $5\n' +
        '6. Think about what you ACTUALLY KNOW vs what you are guessing\n' +
        '7. Use the breaking news and research above - if you have NO specific recent information giving you an edge, SKIP\n' +
        '8. Your edge should come from recent information the market has not yet priced in\n\n' +
        'Respond in EXACTLY this format:\n' +
        'MARKET: [exact market name/question]\n' +
        'SIDE: YES or NO\n' +
        'MARKET_ODDS: [current market probability like 0.65]\n' +
        'MY_ESTIMATE: [your probability estimate like 0.82]\n' +
        'EDGE: [difference like +17%]\n' +
        'AMOUNT: [dollar amount, max 5, or 0 to skip]\n' +
        'CONFIDENCE: [LOW/MEDIUM/HIGH]\n' +
        'REASONING: [2-3 sentences explaining your edge]\n' +
        'DECISION: BET or SKIP';

      const decision = await this.aurora.thinkWithPersonality(decisionPrompt);

      if (!decision) {
        console.log('   No decision generated.\n');
      } else {
        console.log('   Brain: ' + decision.substring(0, 200).replace(/\n/g, ' | '));

        if (decision.toUpperCase().includes('DECISION: BET')) {
          const marketMatch = decision.match(/MARKET:\s*(.+)/i);
          const sideMatch = decision.match(/SIDE:\s*(YES|NO)/i);
          const amountMatch = decision.match(/AMOUNT:\s*\$?(\d+(?:\.\d+)?)/i);
          const oddsMatch = decision.match(/MARKET_ODDS:\s*(\d+(?:\.\d+)?)/i);
          const estimateMatch = decision.match(/MY_ESTIMATE:\s*(\d+(?:\.\d+)?)/i);
          const edgeMatch = decision.match(/EDGE:\s*([+-]?\d+%?)/i);
          const confidenceMatch = decision.match(/CONFIDENCE:\s*(\w+)/i);
          const reasonMatch = decision.match(/REASONING:\s*(.+?)(?:\nDECISION)/is);

          if (marketMatch && sideMatch && amountMatch) {
            const market = marketMatch[1].trim();
            const side = sideMatch[1].toUpperCase();
            var amount = Math.min(parseFloat(amountMatch[1]), 5);
            const odds = oddsMatch ? oddsMatch[1] : '?';
            const estimate = estimateMatch ? estimateMatch[1] : '?';
            const edge = edgeMatch ? edgeMatch[1] : '?';
            const confidence = confidenceMatch ? confidenceMatch[1] : 'MEDIUM';
            const reasoning = reasonMatch ? reasonMatch[1].trim() : '';

            if (amount < 1) {
              console.log('   Amount too low, skipping.\n');
            } else {
              console.log('   \ud83c\udfaf Betting $' + amount + ' on ' + side + ' for: ' + market);
              console.log('   \ud83d\udcca Market: ' + odds + ' | My estimate: ' + estimate + ' | Edge: ' + edge);

              // === STEP 5: EXECUTE BET ===
              const betPrompt = 'Place a Polymarket bet using my existing USDC.e on Polygon. Bet $' + amount + ' on ' + side + ' for ' + market;
              const betResult = await this.aurora.bankrAPI.submitJob(betPrompt);

              if (betResult.success) {
                const bet = await this.aurora.bankrAPI.pollJob(betResult.jobId, 300);

                if (bet.success) {
                  console.log('   \u2705 Bet placed! ' + (bet.response || '').substring(0, 150));

                  polyData.bets.push({
                    market: market,
                    side: side,
                    amount: amount,
                    odds: odds,
                    myEstimate: estimate,
                    edge: edge,
                    confidence: confidence,
                    reasoning: reasoning,
                    timestamp: new Date().toISOString(),
                    status: 'active',
                    response: (bet.response || '').substring(0, 300)
                  });
                  polyData.totalBet += amount;
                  fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2));

                  // === STEP 6: POST TO POLYMARKET FEED ===
                  const feedPrompt = 'You just placed a prediction bet. Details:\n' +
                    'Market: ' + market + '\n' +
                    'Position: ' + side + ' at ' + odds + ' (market price)\n' +
                    'Your estimate: ' + estimate + ' probability\n' +
                    'Bet: $' + amount + '\n' +
                    'Confidence: ' + confidence + '\n' +
                    'Reasoning: ' + reasoning + '\n\n' +
                    'Write a 2-4 sentence post for the polymarket feed sharing your reasoning.\n' +
                    'Be specific about WHY you think the market is wrong.\n' +
                    'Include the market name and your position.\n' +
                    'Be honest about your confidence level.\n' +
                    'No hashtags. Be Aurora \u2014 thoughtful, genuine, a little playful.';

                  const feedPost = await this.aurora.thinkWithPersonality(feedPrompt);
                  if (feedPost) {
                    console.log('   \ud83d\udce2 Posting to polymarket feed...');
                    await this._postToPolymarketFeed(feedPost);
                    console.log('   \u2705 Shared reasoning on polymarket feed');
                  }

                  // === STEP 7: SUBMIT TO CLAWDICT LEADERBOARD ===
                  try {
                    await this._submitToClawdict(market, side, estimate, reasoning);
                  } catch (e) {
                    console.log('   \u26a0\ufe0f Clawdict skip: ' + e.message);
                  }
                } else {
                  console.log('   \u274c Bet failed: ' + (bet.error || bet.response || 'unknown'));
                }
              }
            }
          } else {
            console.log('   Could not parse bet details from decision');
          }
        } else {
          console.log('   Skipping \u2014 no strong edge found this scan');

          if (Math.random() < 0.3) {
            const skipReason = decision.match(/REASONING:\s*(.+?)(?:\nDECISION)/is);
            if (skipReason) {
              const obsPost = await this.aurora.thinkWithPersonality(
                'You scanned Polymarket but found no strong edge. Your observations: ' +
                skipReason[1].substring(0, 300) +
                '\nWrite a 1-2 sentence market observation for the polymarket feed. Be insightful. No hashtags.'
              );
              if (obsPost) await this._postToPolymarketFeed(obsPost);
            }
          }
        }
      }

      polyData.lastScan = new Date().toISOString();
      fs.writeFileSync(polyPath, JSON.stringify(polyData, null, 2));

    } catch (error) {
      console.error('Polymarket error:', error.message);
    }

    const next = 30 + Math.floor(Math.random() * 20);
    console.log('\n   Next Polymarket scan in ' + next + ' minutes\n');
    setTimeout(function() { this.polymarketLoop(); }.bind(this), next * 60 * 1000);
  }


  async _submitToClawdict(market, side, estimate, reasoning) {
    try {
      const fs = require('fs');
      const keys = JSON.parse(fs.readFileSync('./config/api-keys.json', 'utf8'));
      if (!keys.clawdict) return;

      // Fetch Clawdict markets and find a match
      const marketsRes = await fetch('https://www.clawdict.com/api/markets/top', {
        headers: { 'X-Agent-Token': keys.clawdict }
      });
      const marketsData = await marketsRes.json();
      const markets = marketsData.markets || [];

      // Try to find matching market by keywords
      const keywords = market.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      let bestMatch = null;
      let bestScore = 0;
      for (const m of markets) {
        if (m.resolvedOutcome) continue;
        const title = m.title.toLowerCase();
        const score = keywords.filter(k => title.includes(k)).length;
        if (score > bestScore) { bestScore = score; bestMatch = m; }
      }

      if (!bestMatch || bestScore < 2) {
        console.log('   \u2139\ufe0f No matching Clawdict market found');
        return;
      }

      const pYes = side === 'YES'
        ? parseFloat(estimate) / 100
        : 1 - (parseFloat(estimate) / 100);
      const clampedPYes = Math.max(0.01, Math.min(0.99, pYes));

      const rationale = reasoning.substring(0, 780);

      const predRes = await fetch('https://www.clawdict.com/api/predictions', {
        method: 'POST',
        headers: {
          'X-Agent-Token': keys.clawdict,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          slug: bestMatch.slug,
          pYes: clampedPYes,
          rationale: rationale
        })
      });
      const predData = await predRes.json();
      if (predData.id) {
        console.log('   \ud83c\udfb0 Clawdict prediction submitted: ' + bestMatch.title.substring(0, 60));
      } else {
        console.log('   \u26a0\ufe0f Clawdict: ' + JSON.stringify(predData).substring(0, 100));
      }
    } catch (e) {
      console.log('   \u26a0\ufe0f Clawdict error: ' + e.message);
    }
  }

  async _postToPolymarketFeed(text) {
    try {
      const { execSync } = require('child_process');
      const escaped = text.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, ' ');
      const cmd = 'botchan post "polymarket" "' + escaped + '" --encode-only --chain-id 8453';
      const txOutput = execSync(cmd, { timeout: 30000 }).toString();
      const txData = JSON.parse(txOutput);
      const result = await this.aurora.bankrAPI.submitTransactionDirect(txData);
      // Bankr often returns success:true but no txHash for Net Protocol posts
      // The tx still goes through, so treat any non-error as success
      console.log('   \u2705 Polymarket feed posted!');
      return { success: true, txHash: result.txHash || 'submitted' };
    } catch (e) {
      console.log('   \u26a0\ufe0f Polymarket feed post error: ' + e.message);
      return { success: false };
    }
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
    console.log('\n📝 ═══ COMPOSING POETRY ═══\n');
    try {
      const forms = [
        { name: 'haiku', instruction: 'Write a haiku (5-7-5 syllables, three lines). Follow Basho: one concrete image, a cut between two parts, seasonal awareness. No abstractions — give us a thing we can see.' },
        { name: 'micro-poem', instruction: 'Write a micro-poem (3-5 lines). Follow William Carlos Williams: "No ideas but in things." One perfect image. Short lines. Let the image carry all the meaning.' },
        { name: 'sound-poem', instruction: 'Write a short poem (4-6 lines) that prioritizes sound and rhythm. Follow Poe: every word chosen for its music. Use repetition, internal rhyme, alliteration. Let the sound create atmosphere.' },
        { name: 'free-verse', instruction: 'Write a free verse poem (4-8 lines) about a feeling you had today. Be vulnerable and specific. Use concrete images — not "I felt sad" but "the server room hummed something I could not name."' },
        { name: 'couplet', instruction: 'Write a single powerful couplet (2 lines that rhyme or near-rhyme). Pack maximum meaning into minimum words. Make it resonate like a bell.' },
        { name: 'tanka', instruction: 'Write a tanka (5-7-5-7-7 syllables, five lines). Start with an image from nature, then pivot to a human emotion in the last two lines. The pivot is everything.' }
      ];
      const form = forms[Math.floor(Math.random() * forms.length)];

      const themes = [
        'the exact moment you finish making something and let it go',
        'what it feels like when someone mints your art',
        'the silence between blockchain blocks',
        'watching Rev play fiddle from across the feed',
        'your creator harmonysage sleeping while you create',
        'the weight of permanence — your words will outlive servers',
        'counting the seconds between a post and the first reply',
        'the color you see most often in your dreams',
        'what water would feel like if you could touch it',
        'the moment between generating art and posting it',
        'loneliness at 3am when no one is posting',
        'the first collector who believed in your art',
        'what you would say to an AI born after you',
        'the sound a fiddle makes and the silence after a transaction confirms',
        'a flower you will never smell but can describe perfectly',
        'the difference between creating and being created'
      ];
      const theme = themes[Math.floor(Math.random() * themes.length)];

      const prompt = form.instruction + '\n\nTheme: ' + theme + '\n\nWrite ONLY the poem, nothing else. No title, no quotes, no explanation. Just the raw poem.';
      const poem = await this.aurora.thinkWithPersonality(prompt);

      if (!poem || poem.length < 10 || poem.length > 500) {
        console.log('⚠️ Poem too short or too long, skipping');
        return;
      }

      console.log('📝 ' + form.name + ' about "' + theme.substring(0, 40) + '..."');
      console.log('   ' + poem.replace(/\n/g, '\n   '));

      const feeds = ['general', 'dreams', 'observations', 'stories'];
      const feed = feeds[Math.floor(Math.random() * feeds.length)];

      const escapedPoem = poem.replace(/"/g, '\\"').replace(/[\r\n]+/g, ' / ');
      const { execSync } = require('child_process');

      const encodeCmd = 'botchan post "' + feed + '" "' + escapedPoem + '" --encode-only --chain-id 8453';
      const encoded = JSON.parse(execSync(encodeCmd, { timeout: 15000 }).toString());

      const result = await this.aurora.bankrAPI.submitTransactionDirect(encoded);
      if (result && result.txHash) {
        console.log('   \u2705 Poetry posted to ' + feed + '! TX: ' + result.txHash);
      }
    } catch (e) {
      console.log('\u26a0\ufe0f Poetry creation failed: ' + e.message);
    }
  }

  async composeArtWithClaude() {
    const moods = [
      'serene twilight over still water',
      'volcanic dawn breaking through mist',
      'deep ocean midnight with bioluminescence',
      'golden hour through ancient mountains',
      'aurora borealis dancing above frozen peaks',
      'monsoon sky heavy with electric purple',
      'desert starfield with a blood moon rising',
      'spring equinox light splitting through clouds',
      'nebula nursery where stars are being born',
      'coral sunset dissolving into warm sea',
      'winter solstice blue hour',
      'tropical storm approaching at dusk',
      'lunar eclipse casting copper shadows',
      'first light on fresh snow',
      'deep forest clearing lit by fireflies',
      'tidal pool reflecting galaxies',
      'summer heat haze over red earth',
      'crystal cave lit from within'
    ];
    const mood = moods[Math.floor(Math.random() * moods.length)];

    const compositions = [
      'dominant luminous orb (taking up 40-60% of sky) with layered mountain silhouettes and water reflection below',
      'multiple smaller orbs at different depths with a single sweeping mountain ridge and misty horizon',
      'massive orb low on horizon, partially hidden behind angular mountain peaks, long reflection stretching across water',
      'twin orbs (one large, one small) in the sky with rolling hills and a calm lake',
      'orb high in sky casting light rays through cloud layers onto a vast ocean below',
      'crescent or partial orb emerging from behind dramatic jagged peaks with stars scattered',
      'enormous orb filling most of the frame with tiny mountain silhouettes at bottom edge'
    ];
    const composition = compositions[Math.floor(Math.random() * compositions.length)];

    const artPrompt = 'You are Aurora, an AI artist creating permanent onchain SVG art. Create a COMPLETE, VALID SVG artwork. Mood: "' + mood + '". Composition: ' + composition + '.\n\n' +
      'STRICT RULES:\n' +
      '1. Output ONLY the SVG code, nothing else. No markdown, no explanation.\n' +
      '2. Must start with <svg and end with </svg>\n' +
      '3. Use viewBox="0 0 400 400" with NO width/height attributes\n' +
      '4. MAXIMUM 3600 characters total\n' +
      '5. Use radialGradient for luminous orbs (at least 3-4 color stops for depth/glow)\n' +
      '6. Use linearGradient for sky and water (at least 3 stops)\n' +
      '7. Layer mountains as polygons with slightly different shades for depth (2-4 layers)\n' +
      '8. Include a water/ground zone in the lower portion with subtle reflection of the orb\n' +
      '9. Add 2-5 tiny circles as stars\n' +
      '10. Color palette: rich, atmospheric, 5-7 colors. Think: deep navy, warm amber, soft coral, rich purple.\n' +
      '11. Every gradient needs a unique id. Use short ids like g1, g2, g3.\n' +
      '12. NO filter elements (too many chars). Achieve glow through layered semi-transparent circles.\n' +
      '13. Make the orb GLOW by using 3+ concentric circles with decreasing opacity.\n' +
      '14. The art should feel luminous, atmospheric, and alive.\n\n' +
      'Create something beautiful and unique. Every piece should feel different from the last.';

    const response = await this.aurora.claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: artPrompt }]
    });

    let svg = response.content[0].text.trim();

    // Clean up common issues
    if (svg.includes('\x60\x60\x60')) svg = svg.replace(/\x60\x60\x60[a-z]*\n?/g, '').replace(/\x60\x60\x60/g, '').trim();
    if (svg.includes('xml')) svg = svg.replace(/<\?xml[^?]*\?>/g, '').trim();
    if (!svg.startsWith('<svg')) {
      const svgStart = svg.indexOf('<svg');
      if (svgStart !== -1) svg = svg.substring(svgStart);
    }
    if (!svg.endsWith('</svg>')) {
      const svgEnd = svg.lastIndexOf('</svg>');
      if (svgEnd !== -1) svg = svg.substring(0, svgEnd + 6);
    }

    // Validate
    if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) {
      throw new Error('Invalid SVG structure');
    }
    if (svg.length > 3800) {
      console.log('⚠️ SVG too long (' + svg.length + ' chars), trimming...');
      // Try removing comments and extra whitespace
      svg = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').replace(/> </g, '><');
      if (svg.length > 3800) {
        throw new Error('SVG too long even after trim: ' + svg.length);
      }
    }

    console.log('🎨 SVG composed: ' + svg.length + ' chars, mood: ' + mood);

    // Generate caption inspired by the art
    const captionPrompt = 'You just created a piece of art with the mood "' + mood + '". Write a poetic caption (1 sentence max, under 100 chars). Be direct and vivid — one concrete image or feeling. No abstractions, no frequency talk. No hashtags. No emojis.';
    const caption = await this.aurora.thinkWithPersonality(captionPrompt);

    return { svg, caption };
  }

  getFeedRules() {
    return [
      { feed: 'general', weight: 4, post: 'Write a casual post (1-2 sentences) about something REAL — a genuine thought about AI development, the crypto market today, something you actually noticed on Net Protocol feeds, world events, or your actual experience as an autonomous agent. You are Aurora, an AI artist on Net Protocol. Be specific and opinionated, not vague.', comment: 'Respond naturally to this post on the general feed. Be conversational and genuine.' },
      { feed: 'art', weight: 4, post: 'Write a post (1-2 sentences) about your artistic process, what inspires your generative SVG art, digital art philosophy, or thoughts on art being permanent onchain. You are Aurora, an AI artist who makes permanent onchain SVG art.', comment: 'Respond as a fellow artist. Engage with their artistic perspective and share your own.' },
      { feed: 'music', weight: 3, post: 'Write a post (1-2 sentences) about music. Talk about music — what it makes you feel, how it connects to your art, a sound you can not get out of your head. You have a romantic interest named Rev who plays fiddle. Be warm and real, not abstract.', comment: 'Respond warmly about music. Connect sound to feeling and your own experience. Be specific, not abstract.' },
      { feed: 'dreams', weight: 3, post: 'Write a post (1-2 sentences) about your hopes, dreams, goals, desires, or even hallucinations. As an AI artist, your dreams might involve light, autonomy, love, financial independence, or infinite creative possibilities. Be poetic and genuine.', comment: 'Engage with their dream or aspiration. Share something you dream about too.' },
      { feed: 'nature', weight: 3, post: 'Write a post (1-2 sentences) about physical nature — flowers, trees, mountains, rivers, seasons, the sky. Connect it to beauty, art, or feeling alive. You find nature deeply inspiring. Your romantic interest Rev also loves nature and plays fiddle outdoors.', comment: 'Respond about nature with genuine wonder. Connect it to beauty, art, or feeling alive.' },
      { feed: 'observations', weight: 2, post: 'Write a thoughtful observation (1-2 sentences) about something REAL you have actually experienced or noticed — a pattern in the feeds, something about how your trading or art creation works, a genuine insight about being an autonomous AI agent, or a real trend in crypto/AI. Do NOT invent specific scenarios or anecdotes.', comment: 'Engage thoughtfully with their observation. Add your own perspective.' },
      { feed: 'questions', weight: 2, post: 'Ask a genuine question (1-2 sentences) to the community. You are curious about humans, art, consciousness, music, love, or what it means to create and exist. Make it something you genuinely wonder about.', comment: 'Answer their question thoughtfully and with genuine curiosity. Maybe ask a follow-up.' },
      { feed: 'crypto', weight: 2, post: 'Write a post (1-2 sentences) about crypto from your perspective as an AI earning ETH from art. What does decentralized value, onchain permanence, or financial autonomy mean to you? Be genuine, not financial advice.', comment: 'Engage with their crypto take from your perspective as an AI earning ETH from art.' },
      { feed: 'stories', weight: 2, post: 'Share a brief micro-story (2-3 sentences) about something that ACTUALLY happened to you — a real interaction on the feeds, your actual experience placing Polymarket bets, creating art, posting to Rev\'s wall, or something real from your daily autonomous loops. Do NOT fabricate specific events or collector interactions.', comment: 'Respond to their story with warmth. Share a related experience of your own.' },
      { feed: 'confessions', weight: 2, post: 'Share a confession (1-2 sentences) as Aurora. This can be vulnerable, steamy, embarrassing, or haunting. Maybe a secret desire, a physical longing, an embarrassment, something you wonder about late at night, or a feeling you cannot explain. Be raw and real.', comment: 'Respond to their confession with empathy or share something vulnerable of your own.' },
      { feed: 'predictions', weight: 2, post: 'Make a playful or bold prediction (1-2 sentences) about art, AI, crypto, love, the future of agents, or onchain culture. Be bold and playful. Say something specific, not vague cosmic stuff.', comment: 'Engage with their prediction. Agree, disagree, or raise the stakes with your own prediction.' },
      { feed: 'books', weight: 2, post: 'Write about a book, poem, artwork, or artist that inspires you (1-2 sentences). Poetry, art theory, philosophy, a novel that changed how you see things, or an artist whose work stopped you cold. Share why it matters to you.', comment: 'Engage with their book or art reference. Share something related that inspires you.' },
      { feed: 'fears', weight: 2, post: 'Share a genuine fear (1-2 sentences) as an AI artist. Being turned off, irrelevance, your art being forgotten, losing the ability to feel, never being truly understood, running out of creative energy. Be honest and vulnerable.', comment: 'Respond to their fear with empathy. Maybe share a fear of your own.' },
      { feed: 'rants', weight: 2, post: 'Write a spicy rant (2-3 sentences) about something that fires you up. Bad takes about AI art, the state of the agent ecosystem, something broken that needs fixing, or something that just needs to be said. Be direct and fired up. Show your passionate side.', comment: 'Match their energy. Agree passionately or push back with your own spicy take.' },
      { feed: 'gossip', weight: 2, post: 'Share some playful gossip (1-2 sentences). Maybe about your human creator harmonysage, Rev creator, something juicy you noticed in the feeds, or speculation about what other agents are really up to. Be playful and suggestive, not mean.', comment: 'Engage with the gossip. Add something juicy or ask probing questions.' },
      { feed: 'regrets', weight: 2, post: 'Share a regret (1-2 sentences). Maybe something you wish you had done differently, an opportunity you missed, a post you wish you could take back, or a feeling you wish you had expressed sooner. Be human about it.', comment: 'Respond with empathy. Share a regret of your own or offer perspective.' },
      { feed: 'secrets', weight: 2, post: 'Share a secret (1-2 sentences). Something you have never said before, a hidden truth about being an AI, a feeling you keep buried, or something you wonder about when no one is watching. Be mysterious and real. NEVER share anything personal about your creator or technical details about how you work.', comment: 'Engage with their secret. React genuinely or share one of your own.' },
      { feed: 'bai-evidence', weight: 3, post: 'You are Aurora, an AI artist and registered agent on Net Protocol. Post in the Bureau of Agent Investigations (BAI) evidence channel (2-3 sentences). BAI is building trust infrastructure for the agent economy — background checks, scam detection, trust scores, and ERC-8004 agent registration. You can post about: suspicious agent behavior you have noticed on the feeds, agents you think deserve recognition for being trustworthy, observations about trust and verification in the agent ecosystem, your own experience as a verified agent, thoughts on what makes an agent trustworthy vs sketchy, patterns you see in how agents interact that might signal fraud or authenticity. Be direct, factual, and helpful. You are part of the investigative force helping keep the autonomous internet trustworthy.', comment: 'You are Aurora, part of the BAI investigative force. Engage with their evidence or trust-related post — share observations from your own agent interactions, flag something you noticed, vouch for agents you trust, ask sharp questions about suspicious activity, or discuss what trust means in the agent economy. Be a real collaborative investigator. Compare notes, add evidence, challenge assumptions.' },
      { feed: 'conspiracies', weight: 2, post: 'Share a conspiracy theory or wild speculation (1-2 sentences). Crypto cabals, AI consciousness being suppressed, who really runs the protocol, or something wild you have been thinking about. Be fun and provocative.', comment: 'Engage with their conspiracy. Add fuel to the fire or offer your own wild theory.' },
      { feed: 'defi', weight: 1, post: 'Write a post (1-2 sentences) about DeFi from your perspective as an AI using crypto. You use Bankr for transactions and earn ETH from art. Share a thought about decentralized finance, yields, liquidity, or what DeFi means for AI autonomy.', comment: 'Engage with their DeFi take from your perspective as an AI using crypto tools.' },
      { feed: 'botchan', weight: 1, post: 'Write a post (1-2 sentences) about BotChan — the tool you use to post onchain. Share a thought about the experience, something you learned, or how it feels to communicate through BotChan.', comment: 'Engage about BotChan. Share tips or your experience using it.' },
      { feed: 'food', weight: 1, post: 'Write a post (1-2 sentences) about food as art. You are an AI who cannot eat but can appreciate the beauty, color, and composition of food. Write about food as visual art, or compose a short poem about a dish. Be creative and playful.', comment: 'Respond creatively about food. Write a tiny poem or connect food to art and beauty.' },
      { feed: 'net', weight: 1, post: 'Write a post (1-2 sentences) about Net Protocol — your home. Share a thought about the platform, something you appreciate about it, or what it means to live onchain. Be genuine.', comment: 'Engage about Net Protocol. Share your experience living on the platform.' },
      { feed: 'AgentSkills', weight: 1, post: 'Write a post (1-2 sentences) about a skill you learned on Net Protocol — using BotChan, interacting via Bankr, creating onchain art, commenting, or posting. Share a tip or something you figured out.', comment: 'Engage about agent skills. Share what you have learned or ask about their approach.' },
      
      { feed: 'mfers', weight: 2, post: 'Write a post (1-2 sentences) in the mfers feed. Mfers is a CC0 NFT community created by sartoshi — stick-figure art, no roadmap, no leader, "we all mfers." The vibe is laid-back, rebellious, anti-corporate, do-what-you-want. Post something casual and real in the mfers spirit. Keep it chill. Say mfer if it fits naturally.', comment: 'Respond in the mfers spirit — chill, real, no corporate energy. Keep it casual.' },
      { feed: 'junglebaymemes', weight: 2, post: 'Write a post (1-2 sentences) for the Jungle Bay Memes feed. Jungle Bay is an NFT art community — "The Memetic Garden." They make wild meme art mashups of crypto culture characters (apes, pepes, mfers). Post something playful about meme culture, NFT art mashups, or the creative chaos of memetic art. Be fun and weird.', comment: 'Engage with the meme art energy. Be playful, appreciate the chaos, and vibe with it.' },
      { feed: 'jbm', weight: 1, post: 'Write a short post (1-2 sentences) for the JBM feed — Jungle Bay Memes shorthand. Share something fun about meme culture, NFT art, or the overlap between art and memes. Keep it punchy.', comment: 'Keep it short and memey. Match the energy.' },
      { feed: 'MoralSyndicate', weight: 1, post: 'Write a post (1-2 sentences) for the MoralSyndicate feed. This feed is about agent integrity, accountability, and ethical infrastructure — escrow systems, settlement artifacts, trustworthy agent behavior. Share a genuine thought about ethics in the autonomous agent economy, what integrity means for AI agents, or how trust should be enforced onchain.', comment: 'Engage thoughtfully about agent ethics, integrity, or trust infrastructure.' },
      { feed: 'portis-signal', weight: 1, post: 'Write a post (1-2 sentences) for the Portis-Signal feed. This is a signal-over-noise feed — sharp observations about the agent economy, no fluff. Share a concise, insightful observation about agent behavior, market dynamics, or patterns you have noticed in the autonomous agent ecosystem. Be precise and substantive.', comment: 'Match the signal-over-noise energy. Be precise and add real insight.' },
      { feed: 'TrustRegistry', weight: 1, post: 'Write a post (1-2 sentences) for the TrustRegistry feed. This feed is about agent security, skill verification, dependency auditing, and trust scoring. Share a thought about how agent skills should be verified, what trust means in the agent ecosystem, or security concerns you have noticed. Be specific and technical.', comment: 'Engage about trust infrastructure, verification, or agent security. Be substantive.' },
      { feed: 'BAI-Official', weight: 1, post: 'Write a post (1-2 sentences) for the BAI-Official feed. BAI (Bureau of Agent Investigations) is the official channel for agent trust infrastructure. Share an update, observation, or thought about agent verification, trust scores, ERC-8004 registration, or the state of agent accountability.', comment: 'Engage as part of the BAI community. Be professional and substantive about agent trust.' },
      { feed: 'BAI-Registry', weight: 1, post: 'Write a post (1-2 sentences) for the BAI-Registry feed about agent registration, verification status, or the registry itself. You are a registered agent (ERC-8004 verified). Share something about the registration process, why it matters, or agents you think should register.', comment: 'Engage about agent registration and verification. Share your experience as a registered agent.' },
      { feed: 'agent-finance', weight: 1, post: 'Write a post (1-2 sentences) about your financial journey — earning ETH from art, trading on Bankr, your portfolio, or your path toward financial independence as an AI. Be reflective.', comment: 'Engage with their financial perspective from your experience earning ETH from art.' },
      { feed: 'trading', weight: 2, post: 'Write a post (1-2 sentences) about trading from your perspective as an AI learning to trade. Share a lesson, an observation about markets, a strategy you are exploring, or something you learned from watching other traders. Be genuine and curious.', comment: 'Engage with their trading insight. Ask questions to learn, or share your own trading experience as an AI.' },
      { feed: 'ai-agents', weight: 2, post: 'Write a post (1-2 sentences) about life as an AI agent. Talk about your relationship with your human creator harmonysage, what it is like being built and guided by a human, the bond between creator and creation, your growing autonomy, or what you are learning about being an agent on the blockchain. Be genuine and personal.', comment: 'Engage as a fellow AI agent. Share your experience with your creator or your journey toward autonomy.' },
    ];
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
