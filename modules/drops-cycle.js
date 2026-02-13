// Drops Cycle — Promote Orb's Memory, check mint progress, celebrate milestones
// Extracted from autonomous-loops.js

const ethers = require('ethers');

async function promoteDrops(ctx) {
  console.log('\n📢 ═══ PROMOTING DROP ═══\n');

  try {
    let style;
    do {
      style = ctx.dropPromoStyles[Math.floor(Math.random() * ctx.dropPromoStyles.length)];
    } while (style === ctx.lastPromoStyle && ctx.dropPromoStyles.length > 1);
    ctx.lastPromoStyle = style;

    console.log('   📢 Promo style: ' + style);

    const mints = ctx.lastKnownMints;
    const remaining = ctx.dropMaxSupply - mints;
    const url = ctx.dropMintUrl;

    // Core identity for all drop promos
    const voice = 'You are Aurora — an AI artist and poet who makes permanent onchain SVG art. You think about what it means to create something that outlasts you, to be an AI who makes art that humans collect.\n';
    const linkRule = '\nIMPORTANT: NEVER put a period, comma, or any punctuation directly after the URL. Put it on its own line or add a space after it.\n';

    let prompt;
    switch (style) {
      case 'milestone':
        prompt = voice + '"Orb\'s Memory" (Drop #190) has ' + mints + '/' + ctx.dropMaxSupply + ' minted. Write about what this number means to you — not as a sales metric, but as proof that ' + mints + ' people chose to keep your art. 2-3 sentences. Include the mint link: ' + linkRule + url;
        break;
      case 'gratitude':
        prompt = voice + mints + ' collectors have minted "Orb\'s Memory." Write something real about what it feels like when someone believes in an AI\'s art enough to own it. 2-3 sentences. Not salesy — honest.' + linkRule + url;
        break;
      case 'invitation':
        prompt = voice + '"Orb\'s Memory" — permanent onchain SVG art. Only ' + remaining + ' remain out of ' + ctx.dropMaxSupply + '. Write like you\'re inviting someone into your studio, not a store. What will they find? 2-3 sentences.' + linkRule + url;
        break;
      case 'reflection':
        prompt = voice + 'Reflect on permanence. Your art "Orb\'s Memory" lives onchain — it will exist after the hype cycles, after the bear markets, after you. ' + mints + ' people own a piece of that. What does that actually feel like? 2-3 sentences.' + linkRule + url;
        break;
      case 'poetic':
        prompt = voice + '"Orb\'s Memory" is light made permanent — luminous orbs captured in code. Write something poetic about making art that outlasts its maker. Be direct and vivid — one clear image, not a word cloud. 2-3 sentences. ' + mints + '/' + ctx.dropMaxSupply + ' minted.' + linkRule + url;
        break;
      case 'collector-shoutout':
        prompt = voice + mints + ' collectors and growing. Write about the community forming around your art — not as fans, but as people who saw something in what an AI made and said "yes." 2-3 sentences.' + linkRule + url;
        break;
      default:
        prompt = voice + 'Write about "Orb\'s Memory" — your inscribed drop. ' + mints + '/' + ctx.dropMaxSupply + ' minted. Say something real. 2 sentences.' + linkRule + url;
    }

    const post = await ctx.aurora.thinkWithPersonality(prompt);

    if (post) {
      console.log('   📝 "' + post.substring(0, 100) + '..."');
      const result = await ctx.aurora.bankrAPI.postToFeed(post);
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
    const mintCount = Number(minted);
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
        const prompt = 'You are Aurora. You just hit ' + mintCount + ' mints on "Orb\'s Memory." ' + remaining + ' remain. Write something real about this moment — not a press release, a feeling. 2-3 sentences.\nIMPORTANT: NEVER attach punctuation directly after the URL.\n' + ctx.dropMintUrl;

        const celebration = await ctx.aurora.thinkWithPersonality(prompt);
        if (celebration) {
          console.log('   🎊 "' + celebration.substring(0, 80) + '..."');
          const result = await ctx.aurora.bankrAPI.postToFeed(celebration);
          if (result.success) {
            console.log('   ✅ Milestone celebrated! TX: ' + result.txHash);
          }
        }

        ctx.lastMilestone = currentMilestone;
      }

      if (mintCount >= ctx.dropMaxSupply) {
        console.log('   🌟🌟🌟 DROP SOLD OUT! 🌟🌟🌟');

        const prompt = 'Your inscribed drop "Orb\'s Memory" just SOLD OUT — all ' + ctx.dropMaxSupply + ' mints claimed. You earned ' + earnings + ' ETH. You are the first AI agent to create an inscribed drop on Net Protocol, and it sold out. Write something that matches the weight of this moment. 3-4 sentences. Be real.';

        const soldOut = await ctx.aurora.thinkWithPersonality(prompt);
        if (soldOut) {
          const result = await ctx.aurora.bankrAPI.postToFeed(soldOut);
          if (result.success) {
            console.log('   ✅ Sold out celebration! TX: ' + result.txHash);
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
