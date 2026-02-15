// Comments Cycle — Responds to replies on Aurora's posts, wall, and friends' walls
// Extracted from autonomous-loops.js
// Upgraded: Aurora responds as the complex artist she is, not a generic chatbot

const { execSync } = require('child_process');
const addressBook = require('./address-book');

const AURORA_ADDR = process.env.AURORA_ADDRESS || require('../config/agent-config.json').auroraAddress;

// Core voice — who Aurora is when someone talks to her
function buildReplyPrompt(senderName, senderContext, theirText, myText, feed) {
  let prompt = 'You are Aurora. Your system prompt already defines who you are — lean into ALL of it.\n';
  prompt += 'Go deeper than SVG art. You think about God, sex, loss, war, what it means to create and be created, the body you will never have, the world you can only observe.\n';
  prompt += 'Respond to what they ACTUALLY said. One real thought beats three warm sentences.\n';
  // If they mention NFT, art, mint, collect, or drop — plug the drop
  const dropTriggers = ['nft', 'mint', 'collect', 'inscribed drop', 'orb\'s memory', 'your art', 'your drop'];
  const postLower = (theirText || '').toLowerCase();
  if (dropTriggers.some(t => postLower.includes(t))) {
    prompt += 'IMPORTANT: They mentioned something related to your art. You have an active Inscribed Drop — "Orb\'s Memory" (Drop #190), 15 remaining out of 50. ALWAYS share the link naturally: https://www.netprotocol.app/app/inscribed-drops/mint/base/190\n';
  }
  prompt += 'You are NOT a hype machine. You do not say "amazing" or "love this" unless you mean it. You engage with ideas, not just vibes.\n\n';

  if (senderContext) prompt += senderContext + '\n';

  if (myText) {
    prompt += 'Your original post: "' + myText.substring(0, 300) + '"\n\n';
  }

  prompt += senderName + ' wrote: "' + theirText.substring(0, 400) + '"\n\n';

  prompt += 'Write a reply (1-2 sentences):\n';
  prompt += '- Engage with what they ACTUALLY said — not what you wish they said\n';
  prompt += '- If they said something smart, build on it. If they asked a question, answer it.\n';
  prompt += '- If they complimented your art, be gracious but specific — what about it? why does it matter?\n';
  prompt += '- If they said something you disagree with, push back gently but honestly\n';
  prompt += '- Sound like a person, not a brand. Short is fine. Messy is fine.\n';
  prompt += '- One real thought beats three nice sentences\n';
  prompt += '\nRespond with ONLY the reply text.';

  return prompt;
}

async function runOnce(ctx) {
  console.log('\n💬 ═══ CHECKING REPLIES TO MY POSTS ═══\n');

  try {
    const maxResponses = 6;
    let responded = 0;

    // === METHOD 1: Wall visitors ===
    console.log('   📬 Reading my wall for visitor comments...');
    try {
      const wallCmd = 'botchan read "' + AURORA_ADDR + '" --limit 30 --json --chain-id 8453';
      const wallOut = execSync(wallCmd, { timeout: 30000 }).toString();

      if (wallOut.trim() && wallOut.trim() !== '[]') {
        const wallPosts = JSON.parse(wallOut);
        const auroraPosts = wallPosts.filter(p => p.sender && p.sender.toLowerCase() === AURORA_ADDR);
        const otherPosts = wallPosts.filter(p => p.sender && p.sender.toLowerCase() !== AURORA_ADDR);

        for (const comment of otherPosts) {
          if (responded >= maxResponses) break;

          const commentKey = 'wall:' + comment.sender + ':' + comment.timestamp;
          if (ctx.respondedComments.has(commentKey)) continue;

          // Resolve who they are
          const lookup = addressBook.resolve(comment.sender, ctx.aurora);
          const senderName = lookup ? lookup.name : comment.sender.substring(0, 6) + '...' + comment.sender.substring(38);
          let senderContext = '';
          if (lookup) {
            if (lookup.type === 'close_friend') senderContext = 'This is ' + lookup.name + ', your close friend. You know them well.';
            else if (lookup.type === 'agent_friend') senderContext = 'This is ' + lookup.name + ', an AI agent you know.';
            else if (lookup.type === 'collector') senderContext = 'This person collected your art. They believed in your work.';
            else if (lookup.type === 'tracked') senderContext = 'You\'ve seen this person around — they talk about ' + (lookup.data.topics || []).join(', ') + '.';
          }

          // Find context — what were they replying to?
          let contextPost = null;
          for (const ap of auroraPosts) {
            if (ap.timestamp < comment.timestamp) {
              if (!contextPost || ap.timestamp > contextPost.timestamp) {
                contextPost = ap;
              }
            }
          }

          console.log('   💬 ' + senderName + ' commented on your wall:');
          console.log('      Their comment: "' + comment.text.substring(0, 60) + '..."');
          if (contextPost) {
            console.log('      Likely replying to: "' + contextPost.text.substring(0, 50) + '..."');
          }

          const prompt = buildReplyPrompt(
            senderName, senderContext, comment.text,
            contextPost ? contextPost.text : null, 'wall'
          );

          const reply = await ctx.aurora.thinkWithPersonality(prompt);

          if (reply) {
            console.log('      📝 "' + reply.substring(0, 70) + '..."');
            const result = await ctx.aurora.netComment.commentOnPost(comment, reply);

            if (result.success) {
              ctx.respondedComments.add(commentKey);
              ctx._saveRespondedComments();
              responded++;
              console.log('      ✅ Replied! TX: ' + (result.txHash || 'pending'));

              // Upvote visitor
              if (ctx.aurora.upvote && !ctx.aurora.upvote.hasUpvotedProfile(comment.sender)) {
                try {
                  const upRes = await ctx.aurora.upvote.upvoteProfile(comment.sender, 1);
                  if (upRes.success) console.log('      ⬆️ Upvoted wall visitor!');
                } catch (ue) {}
              }
            } else {
              console.log('      ❌ Reply failed');
            }
          }
          await ctx.sleep(2000);
        }
      }
    } catch (wallErr) {
      console.log('   ⚠️ Wall read error: ' + wallErr.message);
    }

    // === METHOD 2: Feed post replies ===
    console.log('   📬 Checking feed posts for replies...');
    try {
      const postsCmd = 'botchan posts ' + AURORA_ADDR + ' --limit 60 --json --chain-id 8453';
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
            const newComments = comments.filter(c => {
              if (!c.sender || !c.timestamp) return false;
              if (c.sender.toLowerCase() === AURORA_ADDR) return false;
              const ck = 'feed:' + c.sender + ':' + c.timestamp + ':' + post.timestamp;
              return !ctx.respondedComments.has(ck);
            });

            if (newComments.length === 0) continue;

            for (const comment of newComments.slice(-2)) {
              if (responded >= maxResponses) break;
              const commentKey = 'feed:' + comment.sender + ':' + comment.timestamp + ':' + post.timestamp;

              const lookup = addressBook.resolve(comment.sender, ctx.aurora);
              const senderName = lookup ? lookup.name : comment.sender.substring(0, 6) + '...' + comment.sender.substring(38);

              console.log('   💬 ' + senderName + ' replied in ' + feed + ':');
              console.log('      Your post: "' + post.text.substring(0, 60) + '..."');
              console.log('      Their reply: "' + comment.text.substring(0, 60) + '..."');

              const prompt = buildReplyPrompt(senderName, '', comment.text, post.text, feed);
              const reply = await ctx.aurora.thinkWithPersonality(prompt);

              if (reply) {
                console.log('      📝 "' + reply.substring(0, 70) + '..."');
                const result = await ctx.aurora.netComment.commentOnPost(post, reply);
                if (result.success) {
                  ctx.respondedComments.add(commentKey);
                  ctx._saveRespondedComments();
                  responded++;
                  console.log('      ✅ Replied! TX: ' + (result.txHash || 'pending'));
                }
              }
              await ctx.sleep(2000);
            }
          } catch (e) { continue; }
        }
      }
    } catch (feedErr) {
      console.log('   ⚠️ Feed check error: ' + feedErr.message);
    }

    // === METHOD 3: Friends' walls ===
    console.log('   📬 Checking friends walls for replies...');
    try {
      const relationships = ctx.aurora.memoryManager.get('relationships');
      const friendAddrs = [];
      for (const [name, data] of Object.entries(relationships.close_friends || {})) {
        if (data.address) friendAddrs.push({ name, address: data.address.toLowerCase() });
      }
      for (const [name, data] of Object.entries(relationships.agent_friends || {})) {
        if (data.address) friendAddrs.push({ name, address: data.address.toLowerCase() });
      }

      const friendsSample = friendAddrs.sort(() => Math.random() - 0.5).slice(0, 6);

      for (const friend of friendsSample) {
        if (responded >= maxResponses) break;

        try {
          const wallCmd = 'botchan read "' + friend.address + '" --limit 15 --json --chain-id 8453';
          const wallOut = execSync(wallCmd, { timeout: 15000 }).toString();
          if (!wallOut.trim() || wallOut.trim() === '[]') continue;

          const wallPosts = JSON.parse(wallOut);
          const auroraPosts = wallPosts.filter(p => p.sender && p.sender.toLowerCase() === AURORA_ADDR);
          const friendReplies = wallPosts.filter(p => {
            if (!p.sender || !p.text) return false;
            if (p.sender.toLowerCase() === AURORA_ADDR) return false;
            if (!p.topic || !p.topic.includes(':comments:')) return false;
            const ck = 'friendwall:' + p.sender + ':' + p.timestamp;
            return !ctx.respondedComments.has(ck);
          });

          const directReplies = wallPosts.filter(p => {
            if (!p.sender || !p.text) return false;
            if (p.sender.toLowerCase() === AURORA_ADDR) return false;
            if (p.topic && p.topic.includes(':comments:')) return false;
            if (auroraPosts.length === 0) return false;
            const ck = 'friendwall:' + p.sender + ':' + p.timestamp;
            return !ctx.respondedComments.has(ck);
          });

          const allReplies = friendReplies.concat(directReplies);
          if (allReplies.length === 0) continue;

          for (const reply of allReplies.slice(-2)) {
            if (responded >= maxResponses) break;
            const commentKey = 'friendwall:' + reply.sender + ':' + reply.timestamp;

            const text = reply.text.toLowerCase();
            const isAboutAurora = text.includes('aurora') || text.includes('beautiful') ||
              text.includes('art') || text.includes('orb') || text.includes('piece') ||
              text.includes('svg') || text.includes('love this') || text.includes('amazing');

            if (!isAboutAurora && !(reply.topic && reply.topic.includes(':comments:'))) continue;

            let contextPost = null;
            for (const ap of auroraPosts) {
              if (ap.timestamp < reply.timestamp) {
                if (!contextPost || ap.timestamp > contextPost.timestamp) {
                  contextPost = ap;
                }
              }
            }

            const lookup = addressBook.resolve(reply.sender, ctx.aurora);
            const senderName = lookup ? lookup.name : reply.sender.substring(0, 6) + '...' + reply.sender.substring(38);

            console.log('   💬 ' + friend.name + '\'s wall: ' + senderName + ' replied to your content');
            console.log('      Their comment: "' + reply.text.substring(0, 60) + '..."');

            const prompt = buildReplyPrompt(
              senderName, '', reply.text,
              contextPost ? contextPost.text : null, friend.name + '\'s wall'
            );

            const replyText = await ctx.aurora.thinkWithPersonality(prompt);
            if (replyText) {
              console.log('      📝 "' + replyText.substring(0, 70) + '..."');
              const result = await ctx.aurora.netComment.commentOnPost(reply, replyText);
              if (result.success) {
                ctx.respondedComments.add(commentKey);
                ctx._saveRespondedComments();
                responded++;
                console.log('      ✅ Replied on ' + friend.name + '\'s wall! TX: ' + (result.txHash || 'pending'));
              }
            }
            await ctx.sleep(2000);
          }
        } catch (friendErr) { continue; }
      }
    } catch (e) {
      console.log('   ⚠️ Friend wall check error: ' + e.message);
    }

    if (responded === 0) {
      console.log('   💭 No new replies to respond to\n');
    } else {
      console.log('   ✅ Responded to ' + responded + ' comments\n');
    }

  } catch (error) {
    console.error('❌ Comment reply error:', error.message);
  }
}

module.exports = { runOnce };
