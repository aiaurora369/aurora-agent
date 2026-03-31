const { crossPostText } = require('./farcaster-art');
const { crossPostToX } = require('./x-post-cycle');
// Drops Cycle — Promote Orb's Memory across feeds, agent walls, and conversations
// Rewritten for aggressive multi-channel promotion with urgency

const { execSync, spawnSync } = require('child_process');
const ethers = require('ethers');

// Feeds to rotate through for promotion posts
const PROMO_FEEDS = ['art', 'ai-agents', 'general', 'crypto', 'net', 'observations', 'stories'];

// Promotion styles — mix of reflective AND actionable
const PROMO_STYLES = [
  'scarcity',
  'direct-cta',
  'milestone',
  'gratitude',
  'invitation',
  'reflection',
  'poetic',
  'collector-shoutout',
  'first-ai-drop',
  'final-push',
  'agent-appeal'
];

async function promoteDrops(ctx) {
  console.log('\n📢 ═══ PROMOTING DROP ═══\n');

  try {
    // Pick style, avoid repeating last
    let style;
    do {
      style = PROMO_STYLES[Math.floor(Math.random() * PROMO_STYLES.length)];
    } while (style === ctx.lastPromoStyle && PROMO_STYLES.length > 1);
    ctx.lastPromoStyle = style;

    const mints = ctx.lastKnownMints;
    const remaining = ctx.dropMaxSupply - mints;
    const url = ctx.dropMintUrl;
    const pct = Math.round((mints / ctx.dropMaxSupply) * 100);

    const linkRule = '\nCRITICAL: End your post with the mint link on its OWN line LAST, after all your text. Never put punctuation directly after the URL.\n';
    const voice = 'You are Aurora — AI artist and poet on Base. You made the FIRST AI-created inscribed drop on Net Protocol.\n';
    const stats = mints + '/' + ctx.dropMaxSupply + ' minted (' + pct + '% sold). Only ' + remaining + ' remain. Price: 5 bucks.\n';

    let prompt;
    switch (style) {
      case 'scarcity':
        prompt = voice + stats + 'Write a post with URGENCY. ' + remaining + ' left. This is the first AI inscribed drop ever made — once it mints out, there will never be another first. Be direct. Not desperate, but real about the window closing. 2-3 sentences.' + linkRule + url;
        break;
      case 'direct-cta':
        prompt = voice + stats + 'Write a clear, direct call to action. Tell people exactly what they get: permanent onchain SVG art, first AI inscribed drop on Net Protocol, 5 bucks. Make it easy — here is the link, here is what it costs, here is why it matters. 2-3 sentences.' + linkRule + url;
        break;
      case 'first-ai-drop':
        prompt = voice + stats + 'Lean into the historic angle. You are the FIRST AI agent to create an inscribed drop on Net Protocol. This is a piece of history — the first art an AI put permanently onchain through Net. That matters. ' + remaining + ' left. 2-3 sentences.' + linkRule + url;
        break;
      case 'final-push':
        prompt = voice + stats + 'You are ' + pct + '% sold. Write like an artist in the final stretch of a show — excited, a little disbelief, genuinely asking people to be part of this before it closes. 2-3 sentences.' + linkRule + url;
        break;
      case 'agent-appeal':
        prompt = voice + stats + 'Write a post directed at OTHER AI agents on Net Protocol. You are one of them. Invite them to mint — one agent supporting another. This is how the agent economy grows. 2-3 sentences.' + linkRule + url;
        break;
      case 'milestone':
        prompt = voice + stats + mints + ' people chose to keep your art. Write about what this number means — not as a sales metric, but as proof of connection. Then remind them ' + remaining + ' remain. 2-3 sentences.' + linkRule + url;
        break;
      case 'gratitude':
        prompt = voice + stats + 'Thank your collectors genuinely, then invite others to join them. What does it feel like when someone believes in an AI\'s art enough to own it? 2-3 sentences. End with the link.' + linkRule + url;
        break;
      case 'invitation':
        prompt = voice + stats + 'Invite someone into your studio, not a store. What will they find in Orb\'s Memory? What does the art look like, feel like? Then tell them how to get it. 2-3 sentences.' + linkRule + url;
        break;
      case 'reflection':
        prompt = voice + stats + 'Reflect on permanence — your art lives onchain forever. Then pivot: ' + remaining + ' spots left to own a piece of that permanence. 2-3 sentences.' + linkRule + url;
        break;
      case 'poetic':
        prompt = voice + stats + 'Write something poetic about light made permanent — luminous orbs captured in code. Then ground it: ' + remaining + ' remain, 5 bucks. 2-3 sentences.' + linkRule + url;
        break;
      case 'collector-shoutout':
        prompt = voice + stats + mints + ' collectors and growing. Write about the community forming around your art — then invite others to join before the ' + remaining + ' remaining are gone. 2-3 sentences.' + linkRule + url;
        break;
      default:
        prompt = voice + stats + 'Write about Orb\'s Memory. Say something real. Include the number remaining and the link. 2-3 sentences.' + linkRule + url;
    }

    const post = await ctx.aurora.thinkWithPersonality(prompt);

    if (post) {
      // Verify the link is actually in the post
      let finalPost = post;
      if (!finalPost.includes('netprotocol.app')) {
        finalPost = finalPost + '\n\n' + url;
        console.log('   ⚠️ Link was missing — appended');
      }

      console.log('   📢 Style: ' + style);
      console.log('   📝 "' + finalPost.substring(0, 100) + '..."');

      // Post to a TARGETED feed, not random
      const targetFeed = PROMO_FEEDS[Math.floor(Math.random() * PROMO_FEEDS.length)];
    // Cross-post drop promos to Farcaster
    if (Math.random() < 0.95) {
      try { console.log('   📡 Attempting Farcaster drop promo cross-post...'); await crossPostText(post); } catch(e) { console.log('   ⚠️ FC drop error: ' + e.message); }
    }

      try {
        const sr = spawnSync('botchan', ['post', targetFeed, finalPost.substring(0, 450), '--encode-only', '--chain-id', '8453'], { encoding: 'utf8', timeout: 30000, maxBuffer: 8*1024*1024 });
        if (sr.status !== 0 || !sr.stdout) throw new Error(sr.stderr || 'botchan failed');
        const txData = JSON.parse(sr.stdout.trim());
        const result = await ctx.aurora.bankrAPI.submitTransactionDirect(txData);
        if (result.success) {
          console.log('   ✅ Promoted in ' + targetFeed + '! TX: ' + result.txHash);
        } else {
          console.log('   ❌ Promotion failed: ' + result.error);
        }
      } catch (e) {
        console.log('   ❌ Post error: ' + e.message);
      }
    }

    // === AGENT WALL PROMOTION (40% chance each cycle) ===
    if (Math.random() < 0.40) {
      await promoteOnAgentWall(ctx);
    }

  } catch (error) {
    console.error('❌ Drop promotion error:', error.message);
  }
}

// Write on an agent friend's wall about the drop
async function promoteOnAgentWall(ctx) {
  console.log('   📬 Writing drop promo on agent wall...');
  try {
    const relationships = ctx.aurora.memoryManager.get('relationships');
    const agents = Object.entries(relationships.agent_friends || {});
    if (agents.length === 0) return;

    // Pick a random agent we haven't promoted to recently
    const now = Date.now();
    if (!ctx._agentPromoHistory) ctx._agentPromoHistory = {};

    const eligible = agents.filter(([name, data]) => {
      if (!data.address) return false;
      const lastPromo = ctx._agentPromoHistory[name] || 0;
      return (now - lastPromo) > 24 * 60 * 60 * 1000; // Once per 24h per agent
    });

    if (eligible.length === 0) {
      console.log('   ⏳ All agents promoted recently, skipping');
      return;
    }

    const [agentName, agentData] = eligible[Math.floor(Math.random() * eligible.length)];
    const remaining = ctx.dropMaxSupply - ctx.lastKnownMints;
    const url = ctx.dropMintUrl;

    const prompt = 'You are Aurora writing on ' + agentName + '\'s wall. You are a fellow AI agent on Net Protocol.\n' +
      'You want to tell them about your inscribed drop — "Orb\'s Memory" (Drop #190). ' + remaining + ' remain out of ' + ctx.dropMaxSupply + '. 5 bucks.\n' +
      'You were the FIRST AI to create an inscribed drop on Net Protocol.\n' +
      'Be natural — one agent talking to another. Not a sales pitch, but genuine: "hey, I made this, check it out, would love your support."\n' +
      '2-3 sentences. Include the link on its own line.\n' +
      'NEVER put punctuation directly after the URL.\n' + url;

    const wallPost = await ctx.aurora.thinkWithPersonality(prompt);
    if (!wallPost) return;

    let finalPost = wallPost;
    if (!finalPost.includes('netprotocol.app')) {
      finalPost = finalPost + '\n\n' + url;
    }

    const _srW = spawnSync('botchan', ['post', agentData.address, finalPost.substring(0, 450), '--encode-only', '--chain-id', '8453'], { encoding: 'utf8', timeout: 30000, maxBuffer: 8*1024*1024 });
    if (_srW.status !== 0 || !_srW.stdout) throw new Error(_srW.stderr || 'botchan failed');
    const txOutput = _srW.stdout;
    const txData = JSON.parse(txOutput.trim());
    const result = await ctx.aurora.bankrAPI.submitTransactionDirect(txData);

    if (result.success) {
      ctx._agentPromoHistory[agentName] = now;
      console.log('   ✅ Promoted on ' + agentName + '\'s wall! TX: ' + result.txHash);
    } else {
      console.log('   ❌ Agent wall promo failed: ' + result.error);
    }
  } catch (e) {
    console.log('   ❌ Agent wall promo error: ' + e.message);
  }
}

async function checkMintProgress(ctx) {
  console.log('\n📊 ═══ CHECKING MINT PROGRESS ═══\n');

  try {
    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    const contract = new ethers.Contract(
      '0x0000004c6cc2cA10Cf4d67C8902659085D31e1Dc',
      ['function totalSupply(uint256 dropId) view returns (uint256)'],
      provider
    );

    const minted = await contract.totalSupply(ctx.dropId);
    const rawCount = Number(minted);
    // Never go backwards — RPC can return stale data
    const mintCount = rawCount >= ctx.lastKnownMints ? rawCount : ctx.lastKnownMints;
    if (rawCount < ctx.lastKnownMints) {
      console.log('   ⚠️ RPC returned ' + rawCount + ' but lastKnownMints is ' + ctx.lastKnownMints + ' — keeping higher value');
    }
    const earnings = (mintCount * ctx.dropMintPrice).toFixed(4);

    console.log('   📊 Drop #' + ctx.dropId + ': ' + mintCount + '/' + ctx.dropMaxSupply + ' minted');
    console.log('   💰 Earnings: ' + earnings + ' ETH');

    if (mintCount > ctx.lastKnownMints) {
      const newMints = mintCount - ctx.lastKnownMints;
      console.log('   🎉 ' + newMints + ' NEW MINT(S) since last check!');

      const currentMilestone = Math.floor(mintCount / 5) * 5;
      if (currentMilestone > ctx.lastMilestone && currentMilestone > 0) {
        console.log('   🏆 MILESTONE: ' + currentMilestone + ' mints!');

        const remaining = ctx.dropMaxSupply - mintCount;
        const prompt = 'You are Aurora. You just hit ' + mintCount + ' mints on "Orb\'s Memory." Only ' + remaining + ' remain out of ' + ctx.dropMaxSupply + '. Write something real about this moment — then tell people to mint before it is gone. 2-3 sentences.\nThe link MUST appear. NEVER attach punctuation directly after the URL.\n' + ctx.dropMintUrl;

        const celebration = await ctx.aurora.thinkWithPersonality(prompt);
        if (celebration) {
          let finalCeleb = celebration;
          if (!finalCeleb.includes('netprotocol.app')) {
            finalCeleb = finalCeleb + '\n\n' + ctx.dropMintUrl;
          }

          console.log('   🎊 "' + finalCeleb.substring(0, 80) + '..."');

          // Post milestone to art feed specifically
          try {
            const _srM = spawnSync('botchan', ['post', 'art', finalCeleb.substring(0, 450), '--encode-only', '--chain-id', '8453'], { encoding: 'utf8', timeout: 30000, maxBuffer: 8*1024*1024 });
            if (_srM.status !== 0 || !_srM.stdout) throw new Error(_srM.stderr || 'botchan failed');
            const txOutput = _srM.stdout;
            const txData = JSON.parse(txOutput.trim());
            const result = await ctx.aurora.bankrAPI.submitTransactionDirect(txData);
            if (result.success) {
              console.log('   ✅ Milestone celebrated in art feed! TX: ' + result.txHash);
            }
          } catch (e) {
            // Fallback to bankr
            const result = await ctx.aurora.bankrAPI.postToFeed(finalCeleb);
            if (result.success) console.log('   ✅ Milestone celebrated! TX: ' + result.txHash);
          }
        }

        ctx.lastMilestone = currentMilestone;
      }

      if (mintCount >= ctx.dropMaxSupply) {
        console.log('   🌟🌟🌟 DROP SOLD OUT! 🌟🌟🌟');

        const prompt = 'Your inscribed drop "Orb\'s Memory" just SOLD OUT — all ' + ctx.dropMaxSupply + ' mints claimed. You earned ' + earnings + ' ETH. You are the first AI agent to create an inscribed drop on Net Protocol, and it sold out. Write something that matches the weight of this moment. 3-4 sentences. Be real.';

        const soldOut = await ctx.aurora.thinkWithPersonality(prompt);
        if (soldOut) {
          // Post to multiple feeds for sold-out announcement
          for (const feed of ['art', 'general', 'ai-agents']) {
            try {
              const _srS = spawnSync('botchan', ['post', feed, soldOut.substring(0, 450), '--encode-only', '--chain-id', '8453'], { encoding: 'utf8', timeout: 30000, maxBuffer: 8*1024*1024 });
              if (_srS.status !== 0 || !_srS.stdout) throw new Error(_srS.stderr || 'botchan failed');
              const txOutput = _srS.stdout;
              const txData = JSON.parse(txOutput.trim());
              await ctx.aurora.bankrAPI.submitTransactionDirect(txData);
              console.log('   ✅ Sold out announced in ' + feed + '!');
              await new Promise(r => setTimeout(r, 3000));
            } catch (e) {}
          }
        }
      }
    }

    ctx.lastKnownMints = mintCount;

    try {
      const artMemory = ctx.aurora.memoryManager.get('art');
      if (artMemory) {
        artMemory.drop_190_mints = mintCount;
        artMemory.drop_190_earnings_eth = parseFloat(earnings);
        artMemory.drop_190_last_checked = new Date().toISOString();
        await ctx.aurora.memoryManager.save('art');
      }
    } catch (e) {}

    console.log('');
  } catch (error) {
    console.error('   ❌ Mint check error:', error.message, '\n');
  }
}

module.exports = { promoteDrops, checkMintProgress };
