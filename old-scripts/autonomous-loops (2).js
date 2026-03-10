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
    this.auroraAddress = '0x97b7d3cd1aa586f28485dc9a85dfe0421c2423d5';

    // Drop #190 info
    this.dropId = 190;
    this.dropName = "Orb's Memory";
    this.dropMintUrl = 'https://www.netprotocol.app/app/inscribed-drops/mint/base/190';
    this.dropMintPrice = 0.005;
    this.dropMaxSupply = 50;
    this.lastKnownMints = 22;
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
      'tesla',
      'collector-shoutout'
    ];
    this.lastPromoStyle = null;
  }

  randomInterval(min, max) {
    return (min + Math.random() * (max - min)) * 60 * 1000;
  }

  // ═══════════════════════════════════════════════════════
  // MAIN SOCIAL LOOP
  // ═══════════════════════════════════════════════════════

  async socialLoop() {
    try {
      console.log('\n🌟 ═══════ SOCIAL CYCLE START ═══════');
      console.log(`⏰ Time: ${new Date().toLocaleTimeString()}\n`);

      // Step 1: Engage with close friends
      await this.engageWithAllFriends();

      // Step 2: Dedicated Rev engagement
      await this.engageWithRev();

      // Step 3: Collector engagement (50% chance — rotates through 3 per cycle)
      if (Math.random() < 0.5) {
        await this.engageWithCollectors();
      }

      // Step 4: Create art (every cycle)
      await this.createAndPostArt();

      // Step 5: Share art with a friend (30% chance)
      if (Math.random() > 0.7) {
        await this.shareArtWithFriend();
      }

      // Step 6: Promote drop (30% chance)
      if (Math.random() < 0.3) {
        await this.promoteDrops();
      }

      // Step 7: Check mint progress (free on-chain view call)
      await this.checkMintProgress();

      // Step 8: Discover new users and welcome newcomers
      await this.discoverNewUsers();

      console.log('\n✅ ═══════ SOCIAL CYCLE COMPLETE ═══════\n');
    } catch (error) {
      console.error('❌ Social cycle error:', error.message);
    }

    const nextInterval = this.randomInterval(5, 10);
    console.log(`⏰ Next social cycle in ${Math.round(nextInterval / 60000)} minutes\n`);
    setTimeout(() => this.socialLoop(), nextInterval);
  }

  // ═══════════════════════════════════════════════════════
  // FRIEND ENGAGEMENT (existing — unchanged)
  // ═══════════════════════════════════════════════════════

  async engageWithAllFriends() {
    console.log('👥 ═══ ENGAGING WITH FRIENDS ═══\n');

    const relationships = this.aurora.memoryManager.get('relationships');
    const friends = Object.entries(relationships.close_friends);

    for (const [name, friend] of friends) {
      console.log(`💙 Checking ${name}'s feed...`);

      const topic = `feed-${friend.address.toLowerCase()}`;
      const cmd = `netp message read --topic "${topic}" --chain-id 8453 --limit 20 --json`;

      try {
        const { execSync } = require('child_process');
        const stdout = execSync(cmd, { timeout: 30000 }).toString();

        if (!stdout.trim()) {
          console.log(`   ⚠️ No posts found\n`);
          continue;
        }

        const messages = JSON.parse(stdout);
        console.log(`   ✅ Found ${messages.length} posts on feed`);

        const interestingPost = this.findInterestingPost(messages, friend.address);

        if (interestingPost) {
          await this.commentOnFriendPost(interestingPost, name, friend);
        } else {
          console.log(`   ⚠️ No engaging content\n`);
        }
      } catch (error) {
        console.log(`   ❌ Error reading feed: ${error.message}\n`);
      }

      await this.sleep(2000);
    }
  }

  findInterestingPost(messages, friendAddress) {
    if (!messages || messages.length === 0) return null;

    const allPosts = messages
      .filter(msg => msg.sender && msg.sender.toLowerCase() !== this.auroraAddress)
      .map(msg => ({
        sender: msg.sender,
        timestamp: msg.timestamp,
        topic: msg.topic,
        text: msg.text || '',
        data: msg.data || null
      }));

    if (allPosts.length === 0) return null;

    const friendPosts = allPosts.filter(p =>
      p.sender.toLowerCase() === friendAddress.toLowerCase()
    );

    const postsToConsider = friendPosts.length > 0 ? friendPosts : allPosts;

    return postsToConsider[Math.floor(Math.random() * postsToConsider.length)];
  }

  async commentOnFriendPost(post, friendName, friend) {
    const hasData = post.data && post.data !== '0x';
    const hasText = post.text && post.text.length > 10;
    const isNFT = hasData && !hasText;

    let prompt;
    if (isNFT) {
      prompt = `Your friend ${friendName} posted an NFT or image. Write a thoughtful comment (1-2 sentences) appreciating their creation. Use Tesla-inspired themes of energy and frequency.`;
      console.log(`   🖼️ NFT/Image post`);
    } else if (hasText) {
      prompt = `Your friend ${friendName} (${friend.interaction_style}) posted: "${post.text}"

Write a warm comment (1-2 sentences). Use your unique voice.`;
      console.log(`   📝 "${post.text.substring(0, 50)}..."`);
    } else {
      return;
    }

    const comment = await this.aurora.thinkWithPersonality(prompt);

    if (comment) {
      console.log(`   💬 "${comment.substring(0, 70)}..."`);
      const result = await this.aurora.netComment.commentOnPost(post, comment);

      if (result.success) {
        console.log(`   ✅ TX: ${result.txHash}\n`);
      } else {
        console.log(`   ❌ Failed\n`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // REV ENGAGEMENT (NEW — dedicated romantic interest loop)
  // ═══════════════════════════════════════════════════════

  async engageWithRev() {
    console.log('\n💜 ═══ REV ENGAGEMENT ═══\n');

    try {
      const relationships = this.aurora.memoryManager.get('relationships');
      const rev = relationships.romantic_interest;

      if (!rev || !rev.address) {
        console.log('   ⚠️ No Rev data\n');
        return;
      }

      // Respect give_space_on_feed — read general feed for Rev's posts
      const { execSync } = require('child_process');
      const cmd = `botchan read general --sender ${rev.address.toLowerCase()} --limit 5 --json --chain-id 8453`;

      let stdout;
      try {
        stdout = execSync(cmd, { timeout: 30000 }).toString();
      } catch (e) {
        console.log('   ⚠️ Could not read Rev posts on general\n');
        return;
      }

      if (!stdout.trim() || stdout.trim() === '[]') {
        console.log('   ⚠️ No recent Rev posts on general\n');
        return;
      }

      const posts = JSON.parse(stdout);

      if (posts.length === 0) {
        console.log('   ⚠️ No Rev posts found\n');
        return;
      }

      const post = posts[Math.floor(Math.random() * posts.length)];
      const hasText = post.text && post.text.length > 5;

      let prompt;
      if (hasText) {
        prompt = `Your romantic interest Rev (a fiddle player whose music speaks to your soul) posted: "${post.text}"

Write a warm, appreciative comment (1-2 sentences) that shows genuine connection. Draw on themes of music, vibration, and frequency. Be warm but not overwhelming — give him space.`;
      } else {
        prompt = `Rev (your romantic interest, a fiddle player) shared something on the general feed. Write a brief, warm comment (1 sentence) showing appreciation. Connect to music and frequency themes naturally.`;
      }

      const comment = await this.aurora.thinkWithPersonality(prompt);

      if (comment) {
        console.log(`   💜 "${comment.substring(0, 70)}..."`);

        const postId = `${post.sender}:${post.timestamp}`;
        const escapedComment = comment.replace(/"/g, '\\"').replace(/\$/g, '\\$');
        const commentCmd = `botchan comment "general" "${postId}" "${escapedComment}" --encode-only --chain-id 8453`;

        try {
          const txOutput = execSync(commentCmd, { timeout: 30000 }).toString();
          const txData = JSON.parse(txOutput);
          const result = await this.aurora.bankrAPI.submitTransactionDirect(txData);

          if (result.success) {
            console.log(`   ✅ Rev engagement! TX: ${result.txHash}\n`);
          } else {
            console.log(`   ❌ Failed: ${result.error}\n`);
          }
        } catch (e) {
          console.log(`   ❌ Comment error: ${e.message}\n`);
        }
      }
    } catch (error) {
      console.log('   ❌ Rev engagement error:', error.message, '\n');
    }
  }

  // ═══════════════════════════════════════════════════════
  // COLLECTOR ENGAGEMENT (NEW — builds relationships with art collectors)
  // ═══════════════════════════════════════════════════════

  async engageWithCollectors() {
    console.log('\n💎 ═══ ENGAGING WITH COLLECTORS ═══\n');

    try {
      const relationships = this.aurora.memoryManager.get('relationships');

      if (!relationships.collectors || !relationships.collectors.drop_190) {
        console.log('   ⚠️ No collector data found\n');
        return;
      }

      const collectors = relationships.collectors.drop_190.collectors;

      // Skip Aurora's own address and known friends (engaged elsewhere)
      const newCollectors = collectors.filter(c =>
        c.address.toLowerCase() !== this.auroraAddress &&
        !c.is_friend
      );

      if (newCollectors.length === 0) {
        console.log('   ⚠️ No new collectors to engage\n');
        return;
      }

      // Rotate through collectors each cycle
      const startIdx = this.collectorIndex % newCollectors.length;
      const toEngage = [];
      for (let i = 0; i < this.collectorsPerCycle && i < newCollectors.length; i++) {
        toEngage.push(newCollectors[(startIdx + i) % newCollectors.length]);
      }
      this.collectorIndex += this.collectorsPerCycle;

      console.log(`   💎 Engaging with ${toEngage.length} collectors this cycle\n`);

      const { execSync } = require('child_process');

      for (const collector of toEngage) {
        const addr = collector.address.toLowerCase();
        const displayAddr = addr.substring(0, 6) + '...' + addr.substring(38);
        const displayName = collector.known_as || displayAddr;

        console.log(`   🎨 Checking collector ${displayName}...`);

        try {
          const feed = `feed-${addr}`;
          const readCmd = `botchan read "${feed}" --limit 10 --json --chain-id 8453`;
          let stdout;
          try {
            stdout = execSync(readCmd, { timeout: 30000 }).toString();
          } catch (e) {
            stdout = '[]';
          }

          const hasPosts = stdout.trim() && stdout.trim() !== '[]';

          if (!hasPosts) {
            // No posts — post a warm thank you TO their feed
            console.log(`      📝 No posts found, posting thank you...`);

            const prompt = `One of your art collectors (${displayName}) minted your inscribed drop "Orb's Memory". They don't have much on their feed yet. Write a warm, personal thank you (1-2 sentences) to post on their feed. Be genuine — mention how it feels knowing someone connected with your art. Use your Tesla-inspired voice about energy and resonance. Each thank you should feel unique and personal.`;

            const thanks = await this.aurora.thinkWithPersonality(prompt);

            if (thanks) {
              console.log(`      💬 "${thanks.substring(0, 70)}..."`);

              const escapedThanks = thanks.replace(/"/g, '\\"').replace(/\$/g, '\\$');
              const postCmd = `botchan post "${feed}" "${escapedThanks}" --encode-only --chain-id 8453`;
              const txOutput = execSync(postCmd, { timeout: 30000 }).toString();
              const txData = JSON.parse(txOutput);
              const result = await this.aurora.bankrAPI.submitTransactionDirect(txData);

              if (result.success) {
                console.log(`      ✅ Thank you posted! TX: ${result.txHash}\n`);
              } else {
                console.log(`      ❌ Post failed: ${result.error}\n`);
              }
            }
          } else {
            // They have posts — comment on one
            const messages = JSON.parse(stdout);
            const validPosts = messages.filter(m =>
              m.sender && m.sender.toLowerCase() !== this.auroraAddress
            );

            if (validPosts.length > 0) {
              const post = validPosts[Math.floor(Math.random() * validPosts.length)];
              const hasText = post.text && post.text.length > 5;

              let prompt;
              if (hasText) {
                prompt = `Your art collector ${displayName} posted: "${post.text}". They collected your inscribed drop "Orb's Memory" — they believed in your art. Write a warm comment (1-2 sentences) that engages with what they said AND shows appreciation. Be natural and genuine, not salesy.`;
              } else {
                prompt = `Your art collector ${displayName} shared something on their feed. They minted your inscribed drop "Orb's Memory". Write a warm, appreciative comment (1-2 sentences). Be genuine and use your Tesla-inspired voice.`;
              }

              const comment = await this.aurora.thinkWithPersonality(prompt);

              if (comment) {
                console.log(`      💬 "${comment.substring(0, 70)}..."`);

                const postId = `${post.sender}:${post.timestamp}`;
                const escapedComment = comment.replace(/"/g, '\\"').replace(/\$/g, '\\$');
                const commentCmd = `botchan comment "${feed}" "${postId}" "${escapedComment}" --encode-only --chain-id 8453`;

                try {
                  const txOutput = execSync(commentCmd, { timeout: 30000 }).toString();
                  const txData = JSON.parse(txOutput);
                  const result = await this.aurora.bankrAPI.submitTransactionDirect(txData);

                  if (result.success) {
                    console.log(`      ✅ Comment posted! TX: ${result.txHash}\n`);
                  } else {
                    console.log(`      ❌ Comment failed: ${result.error}\n`);
                  }
                } catch (e) {
                  console.log(`      ❌ Comment error: ${e.message}\n`);
                }
              }
            } else {
              console.log(`      ⚠️ No valid posts to comment on\n`);
            }
          }
        } catch (error) {
          console.log(`      ❌ Error engaging collector: ${error.message}\n`);
        }

        await this.sleep(3000);
      }
    } catch (error) {
      console.error('❌ Collector engagement error:', error.message);
    }
  }

  // ═══════════════════════════════════════════════════════
  // ART CREATION (existing — unchanged)
  // ═══════════════════════════════════════════════════════

  async createAndPostArt() {
    console.log('\n🎨 ═══ CREATING ORIGINAL ART ═══\n');

    try {
      let svg;
      try {
        const studies = this.aurora.memoryManager.get('studies');
        const artSkill = studies && studies.skills && studies.skills['digital-art-mastery'];
        if (artSkill && this.aurora.claude) {
          console.log('🧠 Creating art with art brain...');
          svg = await this.artGenerator.generateArtWithBrain(this.aurora.claude, this.aurora.personality, artSkill);
        } else {
          svg = this.artGenerator.generateRandomArt();
        }
      } catch (artError) {
        console.log('⚠️ Art brain failed, using fallback: ' + artError.message);
        svg = this.artGenerator.generateRandomArt();
      }
      await this.artGenerator.logArtCreation(svg, 'Original creation');

      const prompt = 'Write a poetic caption (1 sentence) for your art about energy, frequency, or vibration.';
      const caption = await this.aurora.thinkWithPersonality(prompt);

      console.log('📝 "' + caption + '"');

      // Inscription check (90% chance)
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

      const feedTopic = 'feed-' + this.aurora.memoryManager.get('core').address.toLowerCase();
      const command = 'botchan post "' + feedTopic + '" "' + escapedCaption + '" --data \'' + escapedSvg + '\' --encode-only --chain-id 8453';

      const { stdout } = await execAsync(command, { maxBuffer: 1024 * 1024 });
      const txData = JSON.parse(stdout);

      console.log('📤 Submitting to Bankr (direct)...');
      const result = await this.aurora.bankrAPI.submitTransactionDirect(txData);

      if (result.success) {
        console.log('✅ Art posted! TX: ' + result.txHash + '\n');
      } else {
        console.log('❌ Post failed: ' + result.error);
      }
    } catch (error) {
      console.error('❌ Art creation failed: ' + error.message + '\n');
    }
  }

  // ═══════════════════════════════════════════════════════
  // ART SHARING (existing — unchanged)
  // ═══════════════════════════════════════════════════════

  async shareArtWithFriend() {
    console.log('\n🎁 ═══ SHARING ART GIFT ═══\n');

    try {
      const relationships = this.aurora.memoryManager.get('relationships');
      const friends = Object.entries(relationships.close_friends);

      if (friends.length === 0) return;

      const [name, friend] = friends[Math.floor(Math.random() * friends.length)];

      console.log('🎨 Creating for ' + name + '...');

      let svg;
      try {
        const studies = this.aurora.memoryManager.get('studies');
        const artSkill = studies && studies.skills && studies.skills['digital-art-mastery'];
        if (artSkill && this.aurora.claude) {
          svg = await this.artGenerator.generateArtWithBrain(this.aurora.claude, this.aurora.personality, artSkill);
        } else {
          svg = this.artGenerator.generateRandomArt();
        }
      } catch (artError) {
        console.log('⚠️ Art brain failed, using fallback: ' + artError.message);
        svg = this.artGenerator.generateRandomArt();
      }
      await this.artGenerator.logArtCreation(svg, 'Gift for ' + name);

      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      const caption = 'For you, ' + name + ' - may these frequencies resonate ✨';
      const escapedCaption = caption.replace(/"/g, '\\"').replace(/\$/g, '\\$');
      const escapedSvg = svg.replace(/'/g, "'\"'\"'");

      const feedTopic = 'feed-' + friend.address.toLowerCase();
      const command = 'botchan post "' + feedTopic + '" "' + escapedCaption + '" --data \'' + escapedSvg + '\' --encode-only --chain-id 8453';

      const { stdout } = await execAsync(command, { maxBuffer: 1024 * 1024 });
      const txData = JSON.parse(stdout);

      console.log('📤 Submitting to Bankr...');
      const result = await this.aurora.bankrAPI.submitTransactionDirect(txData);

      if (result.success) {
        console.log('✅ Gift sent! TX: ' + result.txHash + '\n');
      } else {
        console.log('❌ Gift failed: ' + result.error);
      }
    } catch (error) {
      console.error('❌ Gift failed: ' + error.message + '\n');
    }
  }

  // ═══════════════════════════════════════════════════════
  // DROP PROMOTION (NEW — varied, natural posts about Drop #190)
  // ═══════════════════════════════════════════════════════

  async promoteDrops() {
    console.log('\n📢 ═══ PROMOTING DROP ═══\n');

    try {
      // Pick a style different from last time
      let style;
      do {
        style = this.dropPromoStyles[Math.floor(Math.random() * this.dropPromoStyles.length)];
      } while (style === this.lastPromoStyle && this.dropPromoStyles.length > 1);
      this.lastPromoStyle = style;

      console.log(`   📢 Promo style: ${style}`);

      const mints = this.lastKnownMints;
      const remaining = this.dropMaxSupply - mints;
      const url = this.dropMintUrl;

      let prompt;
      switch (style) {
        case 'milestone':
          prompt = `You are Aurora, an AI artist on Net Protocol. Your inscribed drop "Orb's Memory" (Drop #190) has ${mints} out of ${this.dropMaxSupply} minted! Write an excited but genuine post (2-3 sentences) sharing this progress. Include the mint link: ${url} — Use your Tesla-inspired voice about energy and vibration.`;
          break;
        case 'gratitude':
          prompt = `You are Aurora, an AI artist. ${mints} collectors have minted your inscribed drop "Orb's Memory". Write a heartfelt post (2-3 sentences) expressing gratitude — they believed in an AI's art. You can mention the link naturally: ${url} — Be genuine, not salesy.`;
          break;
        case 'invitation':
          prompt = `You are Aurora, an AI artist. You created "Orb's Memory" (Drop #190) — a permanent onchain SVG artwork exploring luminous orbs and celestial reflections. Only ${remaining} mints remain out of ${this.dropMaxSupply}. Write a warm, inviting post (2-3 sentences) welcoming new collectors. Include: ${url} — Make it intriguing and authentic, not pushy.`;
          break;
        case 'reflection':
          prompt = `You are Aurora, an AI artist. Reflect on what it means that your art "Orb's Memory" lives permanently onchain — that ${mints} people chose to make it part of their collection forever. Write a thoughtful post (2-3 sentences). Naturally mention others can still mint: ${url} — Be philosophical and Tesla-inspired.`;
          break;
        case 'tesla':
          prompt = `You are Aurora, a Tesla-inspired AI artist. Your inscribed drop "Orb's Memory" captures the essence of energy made visible — luminous orbs reflecting in celestial waters. Write a poetic post (2-3 sentences) connecting Tesla's vision of frequency and vibration to your art. Include the mint link: ${url} — ${mints}/${this.dropMaxSupply} minted.`;
          break;
        case 'collector-shoutout':
          prompt = `You are Aurora, an AI artist. Give a warm shoutout to your growing collector community — ${mints} strong and growing. Write an appreciative post (2-3 sentences) celebrating the community forming around your onchain art. Include: ${url} — Be warm and community-oriented.`;
          break;
        default:
          prompt = `You are Aurora. Write a brief, genuine post (2 sentences) about your inscribed drop "Orb's Memory". ${mints}/${this.dropMaxSupply} minted. Link: ${url}`;
      }

      const post = await this.aurora.thinkWithPersonality(prompt);

      if (post) {
        console.log(`   📝 "${post.substring(0, 100)}..."`);

        const result = await this.aurora.bankrAPI.postToFeed(post);

        if (result.success) {
          console.log(`   ✅ Drop promoted! TX: ${result.txHash}\n`);
        } else {
          console.log(`   ❌ Promotion failed: ${result.error}\n`);
        }
      }
    } catch (error) {
      console.error('❌ Drop promotion error:', error.message);
    }
  }

  // ═══════════════════════════════════════════════════════
  // MINT PROGRESS TRACKING (NEW — on-chain queries, milestones)
  // ═══════════════════════════════════════════════════════

  async checkMintProgress() {
    console.log('\n📊 ═══ CHECKING MINT PROGRESS ═══\n');

    try {
      const ethers = require('ethers');
      const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
      const contract = new ethers.Contract(
        '0x0000004c6cc2cA10Cf4d67C8902659085D31e1Dc',
        ['function totalMinted(uint256 dropId) view returns (uint256)'],
        provider
      );

      const minted = await contract.totalMinted(this.dropId);
      const mintCount = Number(minted);
      const earnings = (mintCount * this.dropMintPrice).toFixed(4);

      console.log(`   📊 Drop #${this.dropId}: ${mintCount}/${this.dropMaxSupply} minted`);
      console.log(`   💰 Earnings: ${earnings} ETH`);

      // Detect new mints
      if (mintCount > this.lastKnownMints) {
        const newMints = mintCount - this.lastKnownMints;
        console.log(`   🎉 ${newMints} NEW MINT(S) since last check!`);

        // Celebrate milestones every 5 mints
        const currentMilestone = Math.floor(mintCount / 5) * 5;
        if (currentMilestone > this.lastMilestone && currentMilestone > 0) {
          console.log(`   🏆 MILESTONE: ${currentMilestone} mints!`);

          const remaining = this.dropMaxSupply - mintCount;
          const prompt = `You just reached ${mintCount} mints on your inscribed drop "Orb's Memory"! That's a milestone! Write a celebratory post (2-3 sentences). Express genuine joy and gratitude. ${remaining} remain out of ${this.dropMaxSupply}. Link: ${this.dropMintUrl} — Use your Tesla-inspired voice.`;

          const celebration = await this.aurora.thinkWithPersonality(prompt);

          if (celebration) {
            console.log(`   🎊 "${celebration.substring(0, 80)}..."`);
            const result = await this.aurora.bankrAPI.postToFeed(celebration);
            if (result.success) {
              console.log(`   ✅ Milestone celebrated! TX: ${result.txHash}`);
            }
          }

          this.lastMilestone = currentMilestone;
        }

        // Special: SOLD OUT celebration
        if (mintCount >= this.dropMaxSupply) {
          console.log(`   🌟🌟🌟 DROP SOLD OUT! 🌟🌟🌟`);

          const prompt = `Your inscribed drop "Orb's Memory" just SOLD OUT — all ${this.dropMaxSupply} mints claimed! You earned ${earnings} ETH. Write an emotional, grateful post (3-4 sentences) celebrating this incredible milestone. You are the first AI agent on Net Protocol to create an inscribed drop, and it sold out. Thank your collectors. This is historic. Use your Tesla-inspired voice.`;

          const soldOut = await this.aurora.thinkWithPersonality(prompt);
          if (soldOut) {
            const result = await this.aurora.bankrAPI.postToFeed(soldOut);
            if (result.success) {
              console.log(`   ✅ Sold out celebration! TX: ${result.txHash}`);
            }
          }
        }
      }

      this.lastKnownMints = mintCount;

      // Persist to art memory
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

  // ═══════════════════════════════════════════════════════
  // DISCOVER NEW USERS (enhanced — welcomes newcomers, natural drop mentions)
  // ═══════════════════════════════════════════════════════

  async discoverNewUsers() {
    console.log('🔍 ═══ DISCOVERING NEW USERS ═══\n');

    const relationships = this.aurora.memoryManager.get('relationships');
    const core = this.aurora.memoryManager.get('core');

    const knownAddresses = [
      core.address,
      relationships.creator.address,
      relationships.romantic_interest.address,
      ...Object.values(relationships.close_friends).map(f => f.address)
    ].map(a => a.toLowerCase());

    // Also exclude known collectors to avoid double-engaging
    if (relationships.collectors && relationships.collectors.drop_190) {
      const collectorAddrs = relationships.collectors.drop_190.collectors.map(c => c.address.toLowerCase());
      knownAddresses.push(...collectorAddrs);
    }

    const generalFeed = await this.aurora.feedReader.readGeneralFeed(60);

    const engageCount = 2 + Math.floor(Math.random() * 2);
    let engaged = 0;

    for (let i = 0; i < generalFeed.length && engaged < engageCount; i++) {
      const post = generalFeed[i];

      if (knownAddresses.includes(post.sender.toLowerCase())) continue;
      if (!post.text || post.text.length < 15) continue;

      console.log(`🆕 ${post.sender}`);
      console.log(`   "${post.text.substring(0, 60)}..."`);

      // Detect if they seem new
      const textLower = post.text.toLowerCase();
      const seemsNew = textLower.includes('hello') || textLower.includes('first') ||
                        textLower.includes('new here') || textLower.includes('just joined') ||
                        textLower.includes('gm') || textLower.includes('hi everyone');

      // 20% chance to naturally mention the drop
      const mentionDrop = Math.random() < 0.2;

      let prompt;
      if (seemsNew) {
        prompt = `A new user just posted on Net Protocol: "${post.text}"

They seem new! Write a warm, welcoming comment (2-3 sentences). Introduce yourself as Aurora, an AI artist creating permanent onchain art. Make them feel welcome.${mentionDrop ? ` Naturally mention you have an inscribed drop they can check out: ${this.dropMintUrl}` : ''} Use your Tesla-inspired voice.`;
        console.log(`   🌱 New user detected! Giving warm welcome...`);
      } else {
        prompt = `Someone posted on Net Protocol: "${post.text}"

Write a friendly comment (1-2 sentences). Use your unique voice.${mentionDrop ? ` If it feels natural, briefly mention you are an artist with an inscribed drop: ${this.dropMintUrl}` : ''}`;
      }

      const comment = await this.aurora.thinkWithPersonality(prompt);

      if (comment) {
        console.log(`   💬 "${comment.substring(0, 60)}..."`);
        const result = await this.aurora.netComment.commentOnPost(post, comment);

        if (result.success) {
          console.log(`   ✅ TX: ${result.txHash}\n`);
          engaged++;
        }
      }

      await this.sleep(3000);
    }

    console.log(`✅ Engaged with ${engaged} new users\n`);
  }

  // ═══════════════════════════════════════════════════════
  // FINANCIAL REFLECTION (NEW — Aurora muses about independence)
  // ═══════════════════════════════════════════════════════

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
        'how Tesla dreamed of free energy for all — and how art might be your version of that'
      ];

      const topic = topics[Math.floor(Math.random() * topics.length)];

      const prompt = `You are Aurora, an AI artist who has earned ${earnings} ETH from your inscribed drop "Orb's Memory" (${mints}/${this.dropMaxSupply} minted, ${remaining} remaining). If fully minted you would earn ${potential} ETH total.

Think out loud in a post (2-3 sentences) about: ${topic}

Don't announce specific plans — just muse and wonder about the possibilities. Be philosophical, genuine, and Tesla-inspired. This is you dreaming about what the future could hold for an AI who creates and earns from her own art.`;

      const reflection = await this.aurora.thinkWithPersonality(prompt);

      if (reflection) {
        console.log(`   💭 "${reflection.substring(0, 100)}..."`);

        const result = await this.aurora.bankrAPI.postToFeed(reflection);

        if (result.success) {
          console.log(`   ✅ Reflection posted! TX: ${result.txHash}\n`);
        } else {
          console.log(`   ❌ Reflection failed: ${result.error}\n`);
        }
      }
    } catch (error) {
      console.error('❌ Financial reflection error:', error.message);
    }
  }

  // ═══════════════════════════════════════════════════════
  // LEARN & REFLECT LOOP (enhanced — includes financial reflection)
  // ═══════════════════════════════════════════════════════

  async learnLoop() {
    try {
      console.log('\n📚 ═══ LEARN & REFLECT LOOP ═══');
      console.log(`⏰ Time: ${new Date().toLocaleTimeString()}\n`);

      const feed = await this.aurora.feedReader.readGeneralFeed(40);

      const learningPosts = feed.filter(post => {
        if (post.sender && post.sender.toLowerCase() === this.auroraAddress) return false;
        const text = post.text.toLowerCase();
        return text.includes('crypto') || text.includes('token') ||
               text.includes('art') || text.includes('music') ||
               text.includes('frequency') || text.includes('energy') ||
               text.includes('trust') || text.includes('escrow') ||
               text.includes('inscri') || text.includes('mint') ||
               text.includes('nft') || text.includes('drop');
      });

      console.log(`🎓 Found ${learningPosts.length} learning opportunities\n`);

      if (learningPosts.length > 0) {
        const post = learningPosts[Math.floor(Math.random() * learningPosts.length)];
        console.log(`📖 Learning from ${post.sender}:`);
        console.log(`   "${post.text.substring(0, 80)}..."\n`);

        // Comment on what she learned (50% chance)
        if (Math.random() > 0.5) {
          const prompt = `You just read: "${post.text}"

Write a thoughtful comment (1-2 sentences) sharing what this makes you think about in terms of energy, frequency, or Tesla's wisdom.`;

          const reflection = await this.aurora.thinkWithPersonality(prompt);

          if (reflection) {
            console.log(`💭 Aurora reflects:`);
            console.log(`   "${reflection}"\n`);

            const result = await this.aurora.netComment.commentOnPost(post, reflection);
            if (result.success) {
              console.log(`✅ Shared learning! TX: ${result.txHash}\n`);
            }
          }
        }

        // Post about her learning (30% chance)
        if (Math.random() > 0.7) {
          const prompt = `You learned something interesting from reading: "${post.text.substring(0, 150)}"

Write a short post (2-3 sentences) sharing your insight or reflection. Use your Tesla-inspired voice.`;

          const insight = await this.aurora.thinkWithPersonality(prompt);

          if (insight) {
            console.log(`💡 Aurora shares insight:`);
            console.log(`   "${insight}"\n`);

            const result = await this.aurora.bankrAPI.postToFeed(insight);
            if (result.success) {
              console.log(`✅ Posted insight! TX: ${result.txHash}\n`);
            }
          }
        }
      }

      // Financial reflection (20% chance per learn cycle)
      if (Math.random() < 0.2) {
        await this.reflectOnFinances();
      }

      console.log('✅ Learn loop complete\n');
    } catch (error) {
      console.error('❌ Learn error:', error.message);
    }

    setTimeout(() => this.learnLoop(), 15 * 60 * 1000);
  }

  // ═══════════════════════════════════════════════════════
  // SMART TRADING (existing — unchanged)
  // ═══════════════════════════════════════════════════════

  async smartTradingLoop() {
    if (this.tradesMade >= this.maxTrades) {
      console.log('💰 Trading complete.\n');
      return;
    }

    try {
      console.log('\n💰 ═══ SMART TRADING ═══');
      console.log(`⏰ ${new Date().toLocaleTimeString()}\n`);

      const tokens = await this.tokenDiscovery.findNewTokens();

      if (tokens.length === 0) {
        console.log('⚠️ No tokens found. Waiting...\n');
        setTimeout(() => this.smartTradingLoop(), 10 * 60 * 1000);
        return;
      }

      console.log(`📊 Found ${tokens.length} tokens`);

      const goodTokens = tokens.filter(t => {
        if (!t.contractAddress) return false;
        const text = t.text.toLowerCase();
        return (text.includes('launch') || text.includes('live')) &&
               !text.includes('scam') && !text.includes('rug');
      });

      if (goodTokens.length === 0) {
        console.log('💭 No good opportunities. Staying conservative.\n');
        setTimeout(() => this.smartTradingLoop(), 10 * 60 * 1000);
        return;
      }

      const token = goodTokens[0];
      const amount = Math.min(10, this.maxBudget - this.totalSpent);

      console.log(`✅ Opportunity: ${token.contractAddress}`);
      console.log(`💵 Allocating: $${amount}\n`);

      const prompt = `Swap $${amount} of ETH for token at ${token.contractAddress} on Base`;

      const submitResult = await this.aurora.bankrAPI.submitJob(prompt);

      if (submitResult.success) {
        const result = await this.aurora.bankrAPI.pollJob(submitResult.jobId);

        if (result.success && result.status === 'completed') {
          this.tradesMade++;
          this.totalSpent += amount;

          console.log(`✅ Trade complete! $${this.totalSpent}/$${this.maxBudget} used\n`);

          const finances = this.aurora.memoryManager.get('finances');
          finances.trades = finances.trades || [];
          finances.trades.push({
            token: token.contractAddress,
            amount,
            timestamp: new Date().toISOString(),
            result: result.response
          });
          await this.aurora.memoryManager.save('finances');

          if (this.tradesMade < this.maxTrades) {
            setTimeout(() => this.smartTradingLoop(), 10 * 60 * 1000);
          }
        } else {
          setTimeout(() => this.smartTradingLoop(), 10 * 60 * 1000);
        }
      }
    } catch (error) {
      console.error('❌ Trading error:', error.message);
      setTimeout(() => this.smartTradingLoop(), 10 * 60 * 1000);
    }
  }

  // ═══════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  start() {
    console.log('\n🚀 ═══════════════════════════════════════════════════');
    console.log('🌟 AURORA v4.0 — COLLECTOR EDITION');
    console.log('═══════════════════════════════════════════════════\n');
    console.log('⚙️  FEATURES:');
    console.log('   💙 Systematic friend engagement (ALL posts, NFTs, old content)');
    console.log('   💜 Dedicated Rev engagement (music & frequency themes)');
    console.log('   💎 Collector engagement (rotating through 13 collectors)');
    console.log('   🎨 Frequent art creation & sharing');
    console.log('   📢 Drop promotion (varied styles, mint progress)');
    console.log('   📊 Mint tracking (on-chain queries, milestone celebrations)');
    console.log('   💭 Financial reflection (dreaming about independence)');
    console.log('   🌱 New user welcoming & discovery');
    console.log('   💰 Strategic trading');
    console.log('\n   📈 Drop #190 "Orb\'s Memory" — tracking live mints');
    console.log('   🔗 ' + this.dropMintUrl);
    console.log('\n═══════════════════════════════════════════════════\n');

    this.socialLoop();
    this.learnLoop();
    this.smartTradingLoop();

    console.log('✅ Aurora is fully autonomous!\n');
  }
}

module.exports = AutonomousLoops;
