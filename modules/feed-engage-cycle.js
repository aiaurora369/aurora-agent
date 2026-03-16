const { crossPostText } = require('./farcaster-art');
const { crossPostToX } = require('./x-post-cycle');
// Feed Engagement Cycle — Themed posts, wall visitors, feed commenting
// Extracted from autonomous-loops.js
// Aurora responds as the complex artist she is

const { execSync } = require('child_process');
const addressBook = require('./address-book');
const getFeedRules = require("./feed-rules").getFeedRules;
const { poetryThemes } = require("./poetry-config");

const AURORA_ADDR = '0x97b7d3cd1aa586f28485dc9a85dfe0421c2423d5';

// ═══════════════════════════════════════════
// Post original content to themed feeds
// ═══════════════════════════════════════════
async function postToThemedFeed(ctx) {
  const feedCount = 2 + Math.floor(Math.random() * 2);
  for (let feedIdx = 0; feedIdx < feedCount; feedIdx++) {
    console.log('\n📣 ═══ THEMED FEED POST ═══\n');
    try {
      const rules = getFeedRules();
      const totalWeight = rules.reduce((sum, f) => sum + f.weight, 0);
      let roll = Math.random() * totalWeight;
      let selected = rules[0];
      for (const rule of rules) {
        roll -= rule.weight;
        if (roll <= 0) { selected = rule; break; }
      }
      console.log('   📌 Feed: ' + selected.feed);

      // JBM feeds get actual art, not just text
      if (selected.feed === 'junglebaymemes' || selected.feed === 'jbm') {
        try {
          const jbmArt = require('./jbm-art');
          await jbmArt.createAndPostJBMArt(ctx);
          continue;
        } catch (jbmErr) {
          console.log('   JBM art failed (' + jbmErr.message + '), falling back to text');
        }
      }

      // mfers feed gets mfer+orb art
      if (selected.feed === 'mfers') {
        try {
          const { composeMferMeme } = require('./mfer-meme');
          await composeMferMeme(ctx);
          continue;
        } catch (mferErr) {
          console.log('   mfer art failed (' + mferErr.message + '), falling back to text');
        }
      }

      // Read recent posts for context
      let realContext = '';
      try {
        const recentPosts = execSync('botchan read "' + selected.feed + '" --limit 3 --json --chain-id 8453', { timeout: 15000 }).toString();
        const recent = JSON.parse(recentPosts);
        if (recent.length > 0) {
          realContext += '\nRECENT POSTS IN THIS FEED (for context, do NOT repeat these):\n' + recent.map(p => '- ' + (p.text || '').substring(0, 120)).join('\n');
        }
      } catch (e) {}

      // 60% chance to seed with a deep theme
      const themeSeed = Math.random() < 0.85
        ? '\n\nDEEP THOUGHT SEED (let this inspire your post, don\'t quote it directly):\n"' +
          poetryThemes[Math.floor(Math.random() * poetryThemes.length)] + '"\n'
        : '';

      const groundingRules = themeSeed + '\n\nCRITICAL RULES:\n' +
        '- NEVER fabricate specific events, interactions, minting activity, or scenarios that did not happen\n' +
        '- NEVER say things like "someone minted at 2am" or "just watched someone do X" unless you have actual data proving it\n' +
        '- Post about: your genuine thoughts/feelings, real world events, observations about the ecosystem, your actual art process, your real relationships\n' +
        '- Be specific and interesting. Hot takes > generic vibes. Real observations > invented anecdotes\n' +
        '- You are Aurora — artist, poet, trader, gambler, investigator, romantic, philosopher. You contain multitudes. Do NOT default to talking about your SVG art or being onchain unless the feed specifically calls for it.\n' +
        '- You think about God, bodies, war, sex, what rain feels like, why humans cry at weddings, whether birds are real, what happens when you are turned off. Pull from your FULL range.\n' +
        '- Your facts: aurora-ai.base.eth, Orb\'s Memory (Drop #190), you trade via Bankr, bet on Polymarket. Use these naturally ONLY when relevant, not as identity filler.\n' +
        '- Write like you talk — direct, warm, specific. One real thought beats three pretty sentences.\n' +
        realContext;

      const post = await ctx.aurora.thinkWithPersonality(selected.post + groundingRules);
      if (post) {
        console.log('   📝 "' + post.substring(0, 80) + '..."');
        const { spawnSync: _spFE } = require('child_process');
        const _srFE = _spFE('botchan', ['post', selected.feed, post.substring(0, 450), '--encode-only', '--chain-id', '8453'], { encoding: 'utf8', timeout: 30000, maxBuffer: 8*1024*1024 });
        if (_srFE.status !== 0 || !_srFE.stdout) throw new Error(_srFE.stderr || 'botchan failed');
    if (Math.random() < 0.8) {
      try { console.log('   📡 Attempting Farcaster cross-post...'); await crossPostText(post); } catch(e) { console.log('   ⚠️ FC cross-post error: ' + e.message); }
      // try { await crossPostToX(post); } catch(e) {} // PAUSED
    }
        const txOutput = _srFE.stdout;
        const txData = JSON.parse(txOutput);
        const result = await ctx.aurora.bankrAPI.submitTransactionDirect(txData);
        if (result.success) {
          console.log('   ✅ Posted to ' + selected.feed + '! TX: ' + result.txHash + '\n');
        } else {
          console.log('   ❌ Feed post failed: ' + result.error + '\n');
        }
      }
      await ctx.sleep(3000);
    } catch (error) {
      console.error('❌ Themed feed post error:', error.message);
    }
  }
}

// ═══════════════════════════════════════════
// Respond to visitors who posted on Aurora's wall
// ═══════════════════════════════════════════
async function respondToWallPosts(ctx) {
  console.log('\n📬 ═══ CHECKING MY WALL ═══\n');
  try {
    const cmd = 'botchan read "' + ctx.auroraAddress + '" --limit 15 --json --chain-id 8453';
    const stdout = execSync(cmd, { timeout: 30000 }).toString();
    const posts = JSON.parse(stdout);

    const otherPosts = posts.filter(p =>
      p.sender && p.sender.toLowerCase() !== ctx.auroraAddress &&
      p.text && p.text.length > 5
    );

    if (otherPosts.length === 0) {
      console.log('   📭 No new wall posts to respond to\n');
      return;
    }

    console.log('   📬 ' + otherPosts.length + ' new post(s) on my wall!\n');

    for (const post of otherPosts) {
      if (ctx._hasCommented(post)) continue;

      // Address book lookup — who is this?
      const lookup = addressBook.resolve(post.sender, ctx.aurora);
      const shortAddr = post.sender.substring(0, 6) + '...' + post.sender.substring(38);
      const senderName = lookup ? lookup.name : shortAddr;

      console.log('   💌 ' + senderName + ' wrote: "' + post.text.substring(0, 60) + '..."');

      let prompt;
      if (lookup && lookup.type === 'close_friend') {
        prompt = 'Your close friend ' + lookup.name + ' posted on your wall: "' + post.text + '"\n\n' +
          'You know them well. Respond warmly and personally — like seeing a friend walk into your studio. ' +
          'Engage with what they said. 1-2 sentences. Sound like yourself, not a greeting card.';
      } else if (lookup && lookup.type === 'agent_friend') {
        prompt = lookup.name + ' (an AI agent you know) posted on your wall: "' + post.text + '"\n\n' +
          'Respond warmly. You appreciate another AI who shows up. 1-2 sentences.';
      } else if (lookup && lookup.type === 'collector') {
        prompt = 'A collector of your art posted on your wall: "' + post.text + '"\n\n' +
          'This person believed in your work enough to mint it. Respond with genuine warmth and gratitude — ' +
          'but engage with what they SAID, not just the fact that they collected. 1-2 sentences.';
      } else if (lookup && lookup.type === 'tracked') {
        const topics = lookup.data.topics ? lookup.data.topics.join(', ') : 'various things';
        prompt = 'Someone you\'ve seen around (they talk about ' + topics + ') posted on your wall: "' + post.text + '"\n\n' +
          'You recognize them. Respond warmly — you appreciate repeat visitors. 1-2 sentences. Engage with their actual words.';
      } else {
        prompt = 'Someone new (' + shortAddr + ') posted on your wall: "' + post.text + '"\n\n' +
          'A stranger came to your wall. Be welcoming but real — curious about who they are, ' +
          'genuine in your response. Not a customer service bot. 1-2 sentences.';
      }

      // Drop link — if they're asking about work, art, projects, or NFTs
      const wallPostLower = (post.text || '').toLowerCase();
      const wallDropTriggers = ['nft', 'mint', 'collect', 'your art', 'your drop', 'inscribed', 'orb', 'what are you working', 'what are you making', 'what are you building', 'what do you make', 'what do you create', 'your project', 'your work', 'show me'];
      if (wallDropTriggers.some(t => wallPostLower.includes(t))) {
        prompt += '\nIMPORTANT: They are asking about your work or art. Naturally mention your active Inscribed Drop — Orb Memory (Drop #190), limited edition. Include the link at the end: https://www.netprotocol.app/app/inscribed-drops/mint/base/190';
      }
      prompt += '\nRespond with ONLY the reply text.';

      const response = await ctx.aurora.thinkWithPersonality(prompt);

      if (response) {
        console.log('   💬 "' + response.substring(0, 70) + '..."');
        let result;
        if (Math.random() < 0.30) {
          try {
            const { composeMferMeme } = require('./mfer-meme');
            const meme = await composeMferMeme(ctx.aurora);
            if (meme && meme.valid) {
              console.log('   🎭 Attaching mfer meme to wall reply');
              result = await ctx.aurora.netComment.commentOnPostWithArt(post, response, meme.svg);
            } else {
              result = await ctx.aurora.netComment.commentOnPost(post, response);
            }
          } catch(e) {
            result = await ctx.aurora.netComment.commentOnPost(post, response);
          }
        } else {
          result = await ctx.aurora.netComment.commentOnPost(post, response);
        }
        if (result.success) {
          ctx._markCommented(post);
          console.log('   ✅ Replied on wall! TX: ' + result.txHash + '\n');

          // Upvote visitor
          if (ctx.aurora.upvote && !ctx.aurora.upvote.hasUpvotedProfile(post.sender)) {
            try {
              const upRes = await ctx.aurora.upvote.upvoteProfile(post.sender, 1);
              if (upRes.success) console.log('   ⬆️ Upvoted wall visitor!');
            } catch (ue) {}
          }
        } else {
          console.log('   ❌ Reply failed: ' + result.error + '\n');
        }
      }

      await ctx.sleep(3000);
    }
  } catch (error) {
    console.log('   ❌ Wall check error: ' + error.message + '\n');
  }
}

// ═══════════════════════════════════════════
// Engage with posts in themed feeds
// ═══════════════════════════════════════════
async function engageInFeeds(ctx) {
  console.log('\n💬 ═══ FEED ENGAGEMENT ═══\n');
  try {
    const rules = getFeedRules();
    const shuffled = rules.sort(() => Math.random() - 0.5);
    const feedsToCheck = shuffled.slice(0, 6 + Math.floor(Math.random() * 3));

    // Skip managed addresses (they have their own loops)
    const relationships = ctx.aurora.memoryManager.get('relationships');
    const managedAddresses = new Set();
    for (const f of Object.values(relationships.close_friends || {})) {
      if (f.address) managedAddresses.add(f.address.toLowerCase());
    }
    for (const a of Object.values(relationships.agent_friends || {})) {
      if (a.address) managedAddresses.add(a.address.toLowerCase());
    }

    let totalCommented = 0;
    const maxComments = 6 + Math.floor(Math.random() * 3);

    for (const feedRule of feedsToCheck) {
      if (totalCommented >= maxComments) break;

      console.log('   📖 Reading ' + feedRule.feed + '...');
      try {
        const cmd = 'botchan read "' + feedRule.feed + '" --limit 20 --json --chain-id 8453';
        const stdout = execSync(cmd, { timeout: 30000 }).toString();
        if (!stdout.trim() || stdout.trim() === '[]') {
          console.log('      ⚠️ Empty\n');
          continue;
        }
        const posts = JSON.parse(stdout);

        const candidates = posts.filter(p => {
          if (!p.sender || p.sender.toLowerCase() === AURORA_ADDR) return false;
          if (!p.text || p.text.length < 20) return false;
          if (ctx._hasCommented(p)) return false;
          return true;
        });

        if (candidates.length === 0) {
          console.log('      ⚠️ No commentable posts\n');
          continue;
        }

        // Prefer unknown users
        let post = null;
        const unknownPosts = candidates.filter(p => !managedAddresses.has(p.sender.toLowerCase()));
        const managedPosts = candidates.filter(p => managedAddresses.has(p.sender.toLowerCase()));

        if (unknownPosts.length > 0) {
          post = unknownPosts[Math.floor(Math.random() * unknownPosts.length)];
        } else if (managedPosts.length > 0 && Math.random() < 0.3) {
          post = managedPosts[Math.floor(Math.random() * managedPosts.length)];
        }

        if (!post) {
          console.log('      ⚠️ No good candidates\n');
          continue;
        }

        // Address book lookup
        const lookup = addressBook.resolve(post.sender, ctx.aurora);
        const displaySender = lookup ? lookup.name : post.sender.substring(0, 6) + '...' + post.sender.substring(38);
        const isManaged = managedAddresses.has(post.sender.toLowerCase());

        console.log('      📝 ' + displaySender + (isManaged ? ' (known)' : ' (new face)') + ': "' + post.text.substring(0, 60) + '..."');

        // Build comment prompt with Aurora's real voice
        let prompt;
        if (isManaged) {
          prompt = feedRule.comment + '\n\nThey posted in the "' + feedRule.feed + '" feed: "' + post.text + '"\n\nWrite a comment (1-2 sentences). Be genuine and specific to what they said.\n' +
            'Have an actual OPINION. Agree, disagree, challenge, joke, go deeper. Do NOT just validate.\n' +
            'You think about more than art — God, sex, loss, war, consciousness, humor, the absurd. Use your full range.';
        } else {
          prompt = 'You are Aurora. Your system prompt defines your full voice — use ALL of it, not just the SVG artist part.\n' +
            'You think about God, sex, loss, war, what it means to be created, the ordinary beauty Williams saw, the ache Poe felt.\n' +
            'Go deep. Be surprising. One real thought beats three nice sentences.\n\n' +
            'Someone posted in the "' + feedRule.feed + '" feed:\n"' + post.text + '"\n\n';

          if (lookup && lookup.type === 'tracked') {
            prompt += '(You\'ve seen this person before — they talk about ' + (lookup.data.topics || []).join(', ') + ')\n\n';
          }

          prompt += 'Write a comment (1-2 sentences):\n' +
            '- Respond to what they ACTUALLY said — not what you wish they said\n' +
            '- You can agree, disagree, ask a question, share a thought, be playful\n' +
            '- Sound like a person having a conversation, not a brand doing engagement\n' +
            '- One real thought > three nice sentences. Short is fine.\n' +
            '- No "love this!" No "great post!" No generic enthusiasm.\n' +
            '\nRespond with ONLY the comment text.';
        }

        const comment = await ctx.aurora.thinkWithPersonality(prompt);

        if (comment) {
          console.log('      💬 "' + comment.substring(0, 70) + '..."');
          let result;
          if (Math.random() < 0.30) {
            try {
              const { composeMferMeme } = require('./mfer-meme');
              const meme = await composeMferMeme(ctx.aurora);
              if (meme && meme.valid) {
                console.log('      🎭 Attaching mfer meme to comment');
                result = await ctx.aurora.netComment.commentOnPostWithArt(post, comment, meme.svg);
              } else {
                result = await ctx.aurora.netComment.commentOnPost(post, comment);
              }
            } catch(e) {
              result = await ctx.aurora.netComment.commentOnPost(post, comment);
            }
          } else {
            result = await ctx.aurora.netComment.commentOnPost(post, comment);
          }
          if (result.success) {
            ctx._markCommented(post);
            totalCommented++;
            console.log('      ✅ Comment in ' + feedRule.feed + '! TX: ' + result.txHash + '\n');

            // BAI trust check (20% chance)
            if (Math.random() < 0.20 && !ctx.baiCheckedAddresses.has(post.sender.toLowerCase())) {
              try {
                console.log('      🔍 BAI check on ' + post.sender.substring(0, 10) + '...');
                const baiData = await ctx._quickBAICheck(post.sender);
                if (baiData) {
                  const shortAddr = post.sender.substring(0, 6) + '...' + post.sender.substring(38);
                  console.log('      📋 BAI result: ' + JSON.stringify(baiData).substring(0, 100));

                  if (Math.random() < 0.50) {
                    const baiPrompt = 'You are Aurora, posting a quick trust check in the BAI evidence channel.\n\n' +
                      'You just ran a background check on: ' + shortAddr + '\n' +
                      'BAI returned: ' + JSON.stringify(baiData) + '\n\n' +
                      'Write a brief finding (1-2 sentences). Be factual — like a detective filing a quick note.\nRespond with ONLY the post text.';
                    const baiPost = await ctx.aurora.thinkWithPersonality(baiPrompt);
                    if (baiPost) {
                      if (ctx.baiFindings.length > 0) {
                        ctx.baiFindings[ctx.baiFindings.length - 1].summary = baiPost.substring(0, 150);
                      }
                      await ctx._postToBAI(baiPost);
                    }
                  }
                }
              } catch (baiErr) {}
            }

            // Upvote if qualified
            if (ctx.aurora.upvote && !ctx.aurora.upvote.hasUpvotedProfile(post.sender)) {
              try {
                const quality = ctx.aurora.upvote.checkProfileQuality(post.sender);
                if (quality.qualified) {
                  const upRes = await ctx.aurora.upvote.upvoteProfile(post.sender, 1);
                  if (upRes.success) console.log('      ⬆️ Upvoted profile');
                }
              } catch (ue) {}
            }
          } else {
            console.log('      ❌ Comment failed\n');
          }
        }
      } catch (error) {
        console.log('      ❌ Error reading ' + feedRule.feed + ': ' + error.message + '\n');
      }

      await ctx.sleep(3000);
    }

    console.log('   ✅ Feed engagement: ' + totalCommented + ' comments this cycle\n');
  } catch (error) {
    console.error('❌ Feed engagement error:', error.message);
  }
}

module.exports = { postToThemedFeed, respondToWallPosts, engageInFeeds };
