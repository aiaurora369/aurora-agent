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
        'botchan post agent-finance "' + message.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, ' ') + '" --encode-only',
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



      if (Math.random() < 0.70) {
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
    // Extracted to modules/friends-cycle.js
    return require('./friends-cycle').runOnce(this);
  }

  
  _trackFriendComment(name, content) {
    if (!this.friendRecentComments[name]) {
      this.friendRecentComments[name] = [];
    }
    const summary = content.length > 120 ? content.substring(0, 120) + '...' : content;
    this.friendRecentComments[name].push(summary);
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

  _loadFriendCommentHistory() {
    try {
      const fp = path.join(__dirname, '..', 'memory', 'aurora-friend-comment-history.json');
      if (fs.existsSync(fp)) {
        return JSON.parse(fs.readFileSync(fp, 'utf8'));
      }
    } catch (e) {}
    return {};
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

  async checkAndRespondToComments() {
    // Extracted to modules/comments-cycle.js
    return require('./comments-cycle').runOnce(this);
  }

    // ═══════════════════════════════════════════════════════
  // BAI INVESTIGATOR v1.0
  // Bureau of Agent Investigations — real onchain evidence
  // ═══════════════════════════════════════════════════════

  async investigateAndReport() {
    // Extracted to modules/bai-cycle.js
    try {
      await require('./bai-cycle').runOnce(this.aurora, {
        postToBAI: async (text) => {
          const { execSync } = require('child_process');
          const escaped = text.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, ' ');
          const cmd = 'botchan post "bai-evidence" "' + escaped + '" --encode-only --chain-id 8453';
          const txOutput = execSync(cmd, { timeout: 30000 }).toString();
          const txData = JSON.parse(txOutput);
          return this.aurora.bankrAPI.submitTransactionDirect(txData);
        }
      });
    } catch (error) {
      console.error('BAI error:', error.message);
    }
  }

  // _quickBAICheck now in bai-cycle.js
  async _quickBAICheck(address) {
    return require('./bai-cycle').quickCheck(address, this.baiCheckedAddresses);
  }

  // ═══════════════════════════════════════════════════════
  // COLLECTOR ENGAGEMENT v2.0
  // Warm, personal, art gifts, poems, cross-feed scanning
  // ═══════════════════════════════════════════════════════

  async engageWithCollectors() {
    // Extracted to modules/collectors-cycle.js
    return require('./collectors-cycle').runOnce(this);
  }

    async engageWithAgents() {
    // Extracted to modules/agents-cycle.js
    return require('./agents-cycle').runOnce(this);
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
    return require('./drops-cycle').promoteDrops(this);
  }

    async checkMintProgress() {
    return require('./drops-cycle').checkMintProgress(this);
  }

    async reflectOnFinances() {
    // Merged into financial-cycle.js — no longer needed as separate function
  }


  async learnLoop() {
    // Extracted to modules/learn-cycle.js
    try {
      await require('./learn-cycle').runOnce(this.aurora, {
        hasCommented: (p) => this._hasCommented(p),
        markCommented: (p) => this._markCommented(p)
      });
    } catch (error) {
      console.error('Learn error:', error.message);
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
    // Extracted to modules/financial-cycle.js
    try {
      await require('./financial-cycle').runOnce(this.aurora, {
        lastKnownMints: this.lastKnownMints,
        dropMintPrice: this.dropMintPrice,
        dropMaxSupply: this.dropMaxSupply
      });
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
    return require('./feed-engage-cycle').postToThemedFeed(this);
  }

    async respondToWallPosts() {
    return require('./feed-engage-cycle').respondToWallPosts(this);
  }

    async engageInFeeds() {
    return require('./feed-engage-cycle').engageInFeeds(this);
  }


}

module.exports = AutonomousLoops;
