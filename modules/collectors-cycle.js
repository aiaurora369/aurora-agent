// Collectors Engagement Cycle — Warm, personal engagement with art collectors
// Extracted from autonomous-loops.js

const { execSync } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(require('child_process').exec);

async function runOnce(ctx) {
    console.log('\n\ud83d\udc8e \u2550\u2550\u2550 ENGAGING WITH COLLECTORS \u2550\u2550\u2550\n');

    try {
      const relationships = ctx.aurora.memoryManager.get('relationships');

      if (!relationships.collectors || !relationships.collectors.drop_190) {
        console.log('   \u26a0\ufe0f No collector data found\n');
        return;
      }

      const collectors = relationships.collectors.drop_190.collectors;
      const newCollectors = collectors.filter(function(c) {
        return c.address.toLowerCase() !== ctx.auroraAddress && !c.is_friend;
      }.bind(this));

      if (newCollectors.length === 0) {
        console.log('   \u26a0\ufe0f No collectors to engage\n');
        return;
      }

      // Rotate through 2 collectors per cycle
      const startIdx = ctx.collectorIndex % newCollectors.length;
      const toEngage = [];
      for (let i = 0; i < 2 && i < newCollectors.length; i++) {
        toEngage.push(newCollectors[(startIdx + i) % newCollectors.length]);
      }
      ctx.collectorIndex += 2;

      console.log('   \ud83d\udc8e Engaging with ' + toEngage.length + ' collectors this cycle\n');

      const { execSync } = require('child_process');

      for (const collector of toEngage) {
        const addr = collector.address.toLowerCase();
        const displayAddr = addr.substring(0, 6) + '...' + addr.substring(38);
        const displayName = collector.known_as || displayAddr;

        console.log('   \ud83c\udfa8 ' + displayName + '...');

        // ── FIRST CONTACT: Thank once, ever ──
        if (!ctx.thankedCollectors.has(addr)) {
          console.log('      \ud83d\udcdd First contact \u2014 welcome message...');

          const prompt = 'You are Aurora, an AI artist on Net Protocol. Someone collected your Inscribed Drop "Orb\'s Memory" \u2014 they chose to make your art part of their permanent onchain collection.\n\n' +
            'Write a warm, personal thank you (2-3 sentences) to ' + displayName + '.\n' +
            '- Express genuine gratitude that they resonated with your work\n' +
            '- Be curious about them \u2014 ask what drew them to your piece, or what they create or collect\n' +
            '- Be warm and personal, like recognizing a supporter at a gallery opening\n' +
            '- Do NOT be groveling or over-the-top. One genuine moment of thanks.\n' +
            '- Do NOT use heavy Tesla/frequency language\n' +
            '\nRespond with ONLY the message text.';

          const thanks = await ctx.aurora.thinkWithPersonality(prompt);

          if (thanks) {
            console.log('      \ud83d\udcac "' + thanks.substring(0, 70) + '..."');
            const feed = 'feed-' + addr;
            const escapedThanks = thanks.replace(/"/g, '\\"').replace(/\$/g, '\\$');
            const postCmd = 'botchan post "' + feed + '" "' + escapedThanks + '" --encode-only --chain-id 8453';
            try {
              const txOutput = execSync(postCmd, { timeout: 30000 }).toString();
              const txData = JSON.parse(txOutput);
              const result = await ctx.aurora.bankrAPI.submitTransactionDirect(txData);
              if (result.success) {
                ctx.thankedCollectors.add(addr);
                ctx._saveThankedCollectors();
                console.log('      \u2705 Welcome posted! TX: ' + result.txHash);
                if (ctx.aurora.upvote && !ctx.aurora.upvote.hasUpvotedProfile(addr)) {
                  try {
                    const upRes = await ctx.aurora.upvote.upvoteProfile(addr, 1);
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
          await ctx.sleep(3000);
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
          return p.text && p.text.length > 5 && !ctx._hasCommented(p);
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
          await ctx.sleep(2000);
          continue;
        }

        if (interactionType === 'art_gift') {
          // ── ART GIFT (5%) ──
          console.log('      \ud83c\udfa8 Art gift!');
          await sendCollectorArtGift(displayName, addr, commentable, ctx);

        } else if (interactionType === 'poem') {
          // ── POEM (5%) ──
          console.log('      \ud83d\udcdd Writing poem...');
          await sendCollectorPoem(displayName, addr, commentable, ctx);

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

          const comment = await ctx.aurora.thinkWithPersonality(prompt);

          if (comment) {
            console.log('      \ud83d\udcac "' + comment.substring(0, 70) + '..."');
            const result = await ctx.aurora.netComment.commentOnPost(post, comment);
            if (result.success) {
              ctx._markCommented(post);
              console.log('      \u2705 TX: ' + result.txHash + '\n');
            } else {
              console.log('      \u274c Comment failed\n');
            }
          }
        }

        await ctx.sleep(3000);
      }
    } catch (error) {
      console.error('\u274c Collector engagement error:', error.message);
    }
  }

async function sendCollectorArtGift(displayName, addr, theirPosts, ctx) {
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

    const dedication = await ctx.aurora.thinkWithPersonality(prompt);
    if (!dedication) return;

    // Generate art
    let svg;
    try {
      const result = await ctx.composeArtWithClaude();
      svg = result.svg;
    } catch (e) {
      svg = ctx.artGenerator.generateRandomArt();
    }
    await ctx.artGenerator.logArtCreation(svg, 'Collector gift for ' + displayName);

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
      const result = await ctx.aurora.bankrAPI.submitTransactionDirect(txData);

      if (result.success) {
        console.log('      \u2705 Art gift sent! TX: ' + result.txHash + '\n');
      } else {
        console.log('      \u274c Art gift failed\n');
      }
    } catch (e) {
      console.log('      \u274c Art gift error: ' + e.message + '\n');
    }
  }

async function sendCollectorPoem(displayName, addr, theirPosts, ctx) {
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

    const poem = await ctx.aurora.thinkWithPersonality(prompt);
    if (!poem) return;

    console.log('      \ud83d\udcdd ' + poem.substring(0, 70).replace(/\n/g, ' / ') + '...');

    try {
      const { execSync } = require('child_process');
      const feed = 'feed-' + addr;
      const escaped = poem.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/[\r\n]+/g, ' / ');
      const cmd = 'botchan post "' + feed + '" "' + escaped + '" --encode-only --chain-id 8453';
      const txOutput = execSync(cmd, { timeout: 30000 }).toString();
      const txData = JSON.parse(txOutput);
      const result = await ctx.aurora.bankrAPI.submitTransactionDirect(txData);

      if (result.success) {
        console.log('      \u2705 Poem gifted! TX: ' + result.txHash + '\n');
      } else {
        console.log('      \u274c Poem failed\n');
      }
    } catch (e) {
      console.log('      \u274c Poem error: ' + e.message + '\n');
    }
  }



module.exports = { runOnce };
