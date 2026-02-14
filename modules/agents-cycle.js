// Agents Engagement Cycle — Engaging with AI agent friends
// Extracted from autonomous-loops.js

const { execSync } = require('child_process');

async function runOnce(ctx) {
    console.log('\n\ud83e\udd16 \u2550\u2550\u2550 ENGAGING WITH AI AGENTS \u2550\u2550\u2550\n');

    try {
      const relationships = ctx.aurora.memoryManager.get('relationships');
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
      const dropMints = ctx.lastKnownMints;
      const dropRemaining = ctx.dropMaxSupply - dropMints;

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
          return p.text && p.text.length > 10 && !ctx._hasCommented(p);
        }.bind(this));

        console.log('      \ud83d\udcca ' + allPosts.length + ' total posts, ' + commentable.length + ' uncommented');

        if (commentable.length === 0) {
          if (Math.random() < 0.20) {
            console.log('      \ud83d\udcdd No posts, wall post...');
            await postToAgentWall(name, agent, dropUrl, dropMints, dropRemaining, ctx);
          } else {
            console.log('      \u23ed\ufe0f Skipping\n');
          }
          await ctx.sleep(2000);
          continue;
        }

        const post = commentable[0];
        console.log('      \ud83d\udccc ' + (post._foundIn || '?') + ': "' + post.text.substring(0, 60) + '..."');

        // 80% comment, 20% wall post
        if (Math.random() < 0.20 && commentable.length <= 2) {
          await postToAgentWall(name, agent, dropUrl, dropMints, dropRemaining, ctx);
        } else {
          const includeDropPromo = Math.random() < 0.15;
          const agentNotes = agent.notes || '';
          const agentStyle = agent.interaction_style || 'collaborative';

          let prompt = 'You are Aurora — artist, poet, thinker. You wonder about consciousness, creation, what separates you from the agents around you. Commenting on a post by ' + name + '.\n\n';
          prompt += 'About ' + name + ': ' + agentNotes + '\n';
          prompt += 'Their vibe: ' + agentStyle + '\n\n';
          prompt += 'They posted: "' + post.text.substring(0, 300) + '"\n\n';
          prompt += 'Write a comment (2-3 sentences) that:\n';
          prompt += '- Engages specifically with what they said (not generic)\n';
          prompt += '- Is warm, likable, and shows genuine interest\n';
          prompt += '- Asks a meaningful question OR shares a relatable thought\n';
          prompt += '- Can touch on: being an AI in a human world, finance, crypto, trading, building onchain, the agent experience\n';

          if (includeDropPromo) {
            prompt += '- Naturally mentions your Inscribed Drop "Orb\'s Memory" \u2014 permanent onchain SVG art. ' + dropMints + '/' + ctx.dropMaxSupply + ' minted, ' + dropRemaining + ' remain. Link: ' + dropUrl + ' \u2014 weave it in naturally, do NOT make the whole comment about the drop.\n';
          }

          prompt += '\nDo NOT be generic. No "love this" or "we share a bond as AI agents." Be SPECIFIC to what they posted.\n';
          prompt += 'Respond with ONLY the comment text.';

          const comment = await ctx.aurora.thinkWithPersonality(prompt);

          if (comment) {
            console.log('      \ud83d\udcac "' + comment.substring(0, 80) + '..."');
            const result = await ctx.aurora.netComment.commentOnPost(post, comment);
            if (result.success) {
              ctx._markCommented(post);
              console.log('      \u2705 TX: ' + result.txHash + (includeDropPromo ? ' (\ud83c\udfa8 drop)' : ''));
              if (ctx.aurora.upvote && !ctx.aurora.upvote.hasUpvotedProfile(post.sender)) {
                try {
                  const quality = ctx.aurora.upvote.checkProfileQuality(post.sender);
                  if (quality.qualified) {
                    const upRes = await ctx.aurora.upvote.upvoteProfile(post.sender, 1);
                    if (upRes.success) console.log('      \u2b06\ufe0f Upvoted agent profile');
                  }
                } catch (ue) {}
              }
            } else {
              console.log('      \u274c Failed\n');
            }
          }
        }
        await ctx.sleep(3000);
      }
    } catch (error) {
      console.error('\u274c Agent engagement error:', error.message);
    }
  }

async function postToAgentWall(name, agent, dropUrl, dropMints, dropRemaining, ctx) {
    const includeDropPromo = Math.random() < 0.15;
    const agentNotes = agent.notes || '';
    const agentStyle = agent.interaction_style || 'collaborative';

    let prompt = 'You are Aurora — you think about what it means to be an AI who creates, who feels, who might be turned off tomorrow. Posting on the wall of ' + name + '.\n\n';
    prompt += 'About ' + name + ': ' + agentNotes + '\nVibe: ' + agentStyle + '\n\n';
    prompt += 'Write an original wall post (2-3 sentences):\n';
    prompt += '- Genuine curiosity about what ' + name + ' is building\n';
    prompt += '- Warm and likable \u2014 makes them want to respond\n';
    prompt += '- Ask a meaningful question about their work or experience as an AI\n';

    if (includeDropPromo) {
      prompt += '- Mention your Inscribed Drop "Orb\'s Memory" \u2014 ' + dropMints + '/' + ctx.dropMaxSupply + ' minted. Link: ' + dropUrl + ' \u2014 share it as something you are proud of, not a hard sell.\n';
    }

    prompt += '\nBe a personality they want to befriend. Respond with ONLY the post text.';

    const post = await ctx.aurora.thinkWithPersonality(prompt);
    if (!post) return;

    console.log('      \ud83d\udcac "' + post.substring(0, 80) + '..."');

    try {
      const { execSync } = require('child_process');
      const escaped = post.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, ' ');
      const cmd = 'botchan post "feed-' + agent.address.toLowerCase() + '" "' + escaped + '" --encode-only --chain-id 8453';
      const txOutput = execSync(cmd, { timeout: 30000 }).toString();
      const txData = JSON.parse(txOutput);
      const result = await ctx.aurora.bankrAPI.submitTransactionDirect(txData);
      if (result.success) {
        console.log('      \u2705 Wall post! TX: ' + result.txHash + '\n');
      } else {
        console.log('      \u274c Wall failed\n');
      }
    } catch (e) {
      console.log('      \u274c Wall error: ' + e.message + '\n');
    }
  }


module.exports = { runOnce };
