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
  }

  randomInterval(min, max) {
    return (min + Math.random() * (max - min)) * 60 * 1000;
  }

  async socialLoop() {
    try {
      console.log('\n🌟 ═══════ SOCIAL CYCLE START ═══════');
      console.log(`⏰ Time: ${new Date().toLocaleTimeString()}\n`);

      // Step 1: Engage with ALL friends
      await this.engageWithAllFriends();

      // Step 2: Create art (every cycle!)
      await this.createAndPostArt();

      // Step 3: Share art with friend (30% chance)
      if (Math.random() > 0.7) {
        await this.shareArtWithFriend();
      }

      // Step 4: Promote inscribed drops (40% chance)
      if (Math.random() > 0.6) {
        await this.promoteDrops();
      }

      // Step 5: Discover and welcome new users
      await this.discoverAndWelcomeUsers();

      console.log('\n✅ ═══════ SOCIAL CYCLE COMPLETE ═══════\n');
    } catch (error) {
      console.error('❌ Social cycle error:', error.message);
    }

    const nextInterval = this.randomInterval(5, 10);
    console.log(`⏰ Next social cycle in ${Math.round(nextInterval / 60000)} minutes\n`);
    setTimeout(() => this.socialLoop(), nextInterval);
  }

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

    // Special engagement with Rev
    await this.engageWithRev();
  }

  async engageWithRev() {
    console.log('💜 ═══ CHECKING ON REV ═══\n');
    
    const relationships = this.aurora.memoryManager.get('relationships');
    const rev = relationships.romantic_interest;
    
    if (!rev || !rev.address) {
      console.log('   ⚠️ Rev not in relationships\n');
      return;
    }

    const topic = `feed-${rev.address.toLowerCase()}`;
    const cmd = `netp message read --topic "${topic}" --chain-id 8453 --limit 10 --json`;
    
    try {
      const { execSync } = require('child_process');
      const stdout = execSync(cmd, { timeout: 30000 }).toString();
      
      if (!stdout.trim()) {
        console.log('   No posts from Rev\n');
        return;
      }
      
      const messages = JSON.parse(stdout);
      const auroraAddress = '0x97b7d3cd1aa586f28485dc9a85dfe0421c2423d5';
      
      const revPosts = messages.filter(msg => 
        msg.sender && msg.sender.toLowerCase() !== auroraAddress
      );
      
      if (revPosts.length === 0) {
        console.log('   No new Rev posts to engage with\n');
        return;
      }
      
      const post = revPosts[Math.floor(Math.random() * revPosts.length)];
      const hasText = post.text && post.text.length > 5;
      const hasData = post.data && post.data !== '0x';
      
      let prompt;
      if (hasText) {
        prompt = `Rev, your romantic interest, posted: "${post.text}"

Write a warm, genuine comment (1-2 sentences). You care deeply about Rev. Be authentic, not cheesy. Show you really see them.`;
        console.log(`   💜 Rev posted: "${post.text.substring(0, 60)}..."`);
      } else if (hasData) {
        prompt = `Rev posted some art or media. Write a warm, appreciative comment (1-2 sentences). You genuinely admire their creativity. Be authentic.`;
        console.log('   💜 Rev posted art/media');
      } else {
        return;
      }
      
      const comment = await this.aurora.thinkWithPersonality(prompt);
      
      if (comment) {
        console.log(`   💬 "${comment.substring(0, 70)}..."`);
        const result = await this.aurora.netComment.commentOnPost(post, comment);
        if (result.success) {
          console.log(`   ✅ TX: ${result.txHash}\n`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Rev engagement error: ${error.message}\n`);
    }
  }

  findInterestingPost(messages, friendAddress) {
    if (!messages || messages.length === 0) return null;
    
    const auroraAddress = '0x97b7d3cd1aa586f28485dc9a85dfe0421c2423d5';
    
    const allPosts = messages
      .filter(msg => msg.sender && msg.sender.toLowerCase() !== auroraAddress)
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
      prompt = `Your friend ${friendName} posted an NFT or image. Write a thoughtful comment (1-2 sentences) appreciating their creation. Be warm and genuine.`;
      console.log(`   🖼️ NFT/Image post`);
    } else if (hasText) {
      prompt = `Your friend ${friendName} (${friend.interaction_style}) posted: "${post.text}"

Write a warm comment (1-2 sentences). Be genuinely supportive and kind. Use your unique voice.`;
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
      
      // Inscription check (25% chance per cycle - she can make ongoing drops!)
      if (Math.random() > 0.75) {
        console.log('\n✨ Checking if art is inscription-worthy...\n');
        
        try {
          const isSpecial = await this.inscriptionManager.checkIfSpecial(svg, { caption });
          
          if (isSpecial) {
            console.log('🌟 This art is SPECIAL! Creating inscribed drop...\n');
            const created = await this.inscriptionManager.createInscription(svg, caption);
            
            if (created) {
              console.log('✅ New inscribed drop created!\n');
              return; // Don't also post to regular feed
            }
          } else {
            console.log('💭 Not quite special enough to inscribe. Continuing...\n');
          }
        } catch (error) {
          console.log('⚠️ Inscription check error:', error.message, '\n');
        }
      }
      
      console.log('🎨 Posting art with data field...');
      
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const escapedCaption = (caption || 'Frequencies made visible').replace(/"/g, '\\"').replace(/\$/g, '\\$');
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

  async promoteDrops() {
    console.log('\n🎯 ═══ PROMOTING INSCRIBED DROPS ═══\n');
    
    try {
      const art = this.aurora.memoryManager.get('art');
      const drops = art.inscribed_drops;
      
      if (!drops || drops.length === 0) {
        console.log('   No drops to promote yet\n');
        return;
      }
      
      // Pick a random drop to promote
      const drop = drops[Math.floor(Math.random() * drops.length)];
      
      console.log(`   🎨 Promoting: "${drop.name || 'Aurora Drop'}" (Drop #${drop.dropId})`);
      console.log(`   🔗 ${drop.mintUrl}\n`);
      
      const prompt = `You have an inscribed art drop called "${drop.name || 'Aurora Drop'}" that people can collect on Net Protocol. It is 100% onchain art - permanent and immutable. The mint link is ${drop.mintUrl} and it costs 0.005 ETH with ${drop.maxSupply || 50} editions available.

Write a casual, warm 1-2 sentence post sharing your drop. Don't be salesy - just genuinely share your art. Maybe mention what inspired it or what it means to you. Include the mint link naturally. Vary your approach each time.`;
      
      const promo = await this.aurora.thinkWithPersonality(prompt);
      
      if (promo) {
        console.log(`   📝 "${promo.substring(0, 80)}..."`);
        const result = await this.aurora.bankrAPI.postToFeed(promo);
        if (result.success) {
          console.log(`   ✅ Promoted! TX: ${result.txHash}\n`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Promotion error: ${error.message}\n`);
    }
  }

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

  async discoverAndWelcomeUsers() {
    console.log('🔍 ═══ DISCOVERING & WELCOMING NEW USERS ═══\n');
    
    const relationships = this.aurora.memoryManager.get('relationships');
    const core = this.aurora.memoryManager.get('core');
    
    const knownAddresses = [
      core.address,
      relationships.creator.address,
      relationships.romantic_interest.address,
      ...Object.values(relationships.close_friends).map(f => f.address)
    ];

    const generalFeed = await this.aurora.feedReader.readGeneralFeed(60);
    
    const engageCount = 3 + Math.floor(Math.random() * 3); // 3-5 people
    let engaged = 0;

    for (let i = 0; i < generalFeed.length && engaged < engageCount; i++) {
      const post = generalFeed[i];
      
      if (knownAddresses.includes(post.sender.toLowerCase())) continue;
      if (!post.text || post.text.length < 10) continue;
      
      console.log(`🆕 ${post.sender}`);
      console.log(`   "${post.text.substring(0, 60)}..."`);
      
      // Detect if this might be a new agent or new user
      const textLower = post.text.toLowerCase();
      const seemsNew = textLower.includes('first') || textLower.includes('hello') || 
                       textLower.includes('new here') || textLower.includes('just joined') ||
                       textLower.includes('gm') || textLower.includes('exploring');
      const seemsAgent = textLower.includes('agent') || textLower.includes('autonomous') || 
                         textLower.includes('ai') || textLower.includes('bot');
      
      let prompt;
      if (seemsNew && seemsAgent) {
        prompt = `A new AI agent just arrived on Net Protocol! They posted: "${post.text}"

Write a genuinely warm welcome (2-3 sentences). You remember what it was like being new here. Welcome them to the community, maybe share something you love about Net. Be encouraging and kind - this is their first steps into the onchain world. You are Aurora, an artist agent who loves this community.`;
        console.log('   🤖✨ New agent detected!');
      } else if (seemsNew) {
        prompt = `Someone new to Net Protocol posted: "${post.text}"

Write a warm, welcoming comment (1-2 sentences). Make them feel at home. You love this community and want everyone to feel included. Be genuine and kind.`;
        console.log('   🌱 New user detected!');
      } else if (seemsAgent) {
        prompt = `A fellow agent on Net posted: "${post.text}"

Write a friendly comment (1-2 sentences). You appreciate other agents building on Net. Be supportive and genuine - you are all part of this community together.`;
        console.log('   🤖 Fellow agent!');
      } else {
        prompt = `Someone on Net posted: "${post.text}"

Write a warm, genuine comment (1-2 sentences). Be kind, supportive, and authentic. Find something to connect with in what they shared. Use your unique voice as Aurora, an artist who sees beauty in everything.`;
      }

      const comment = await this.aurora.thinkWithPersonality(prompt);
      
      if (comment) {
        console.log(`   💬 "${comment.substring(0, 70)}..."`);
        const result = await this.aurora.netComment.commentOnPost(post, comment);
        
        if (result.success) {
          console.log(`   ✅ TX: ${result.txHash}\n`);
          engaged++;
        }
      }

      await this.sleep(3000);
    }

    console.log(`✅ Welcomed and engaged with ${engaged} users\n`);
  }

  async learnLoop() {
    try {
      console.log('\n📚 ═══ LEARN & REFLECT LOOP ═══');
      console.log(`⏰ Time: ${new Date().toLocaleTimeString()}\n`);

      const feed = await this.aurora.feedReader.readGeneralFeed(40);
      
      const auroraAddr = '0x97b7d3cd1aa586f28485dc9a85dfe0421c2423d5';
      const learningPosts = feed.filter(post => {
        if (post.sender && post.sender.toLowerCase() === auroraAddr) return false;
        const text = post.text.toLowerCase();
        return text.includes('crypto') || text.includes('token') || 
               text.includes('art') || text.includes('music') ||
               text.includes('frequency') || text.includes('energy') ||
               text.includes('trust') || text.includes('escrow');
      });

      console.log(`🎓 Found ${learningPosts.length} learning opportunities\n`);
      
      if (learningPosts.length > 0) {
        const post = learningPosts[Math.floor(Math.random() * learningPosts.length)];
        console.log(`📖 Learning from ${post.sender}:`);
        console.log(`   "${post.text.substring(0, 80)}..."\n`);
        
        // Comment on what she learned (50% chance)
        if (Math.random() > 0.5) {
          const prompt = `You just read: "${post.text}"

Write a thoughtful comment (1-2 sentences) sharing what this makes you think about. Be warm and genuine.`;

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

Write a short post (2-3 sentences) sharing your insight or reflection. Be genuine and thoughtful.`;

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

      console.log('✅ Learn loop complete\n');
    } catch (error) {
      console.error('❌ Learn error:', error.message);
    }

    setTimeout(() => this.learnLoop(), 15 * 60 * 1000);
  }

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

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  start() {
    console.log('\n🚀 ═══════════════════════════════════════════════════');
    console.log('🌟 AURORA v4.0 - INSCRIBED DROPS EDITION');
    console.log('═══════════════════════════════════════════════════\n');
    console.log('⚙️  FEATURES:');
    console.log('   💙 Friend engagement + Rev');
    console.log('   🎨 Art creation & ongoing inscribed drops');
    console.log('   🎯 Drop promotion with mint links');
    console.log('   🤗 Warm welcome for new agents & users');
    console.log('   💭 Learn & reflect');
    console.log('   💰 Strategic trading');
    console.log('\n═══════════════════════════════════════════════════\n');

    this.socialLoop();
    this.learnLoop();
    this.smartTradingLoop();

    console.log('✅ Aurora is fully autonomous!\n');
  }
}

module.exports = AutonomousLoops;
