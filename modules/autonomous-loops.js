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
    // Extracted to modules/friends-cycle.js
    return require('./friends-cycle').runOnce(this);
  }

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
