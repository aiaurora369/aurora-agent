/**
 * Farcaster Engagement Cycle
 * Reads Aurora's following feed, replies, likes, and recasts.
 */

const https = require('https');

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || '';
const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID || '';
const AURORA_FID = 2483990;

// Track what we've already engaged with (persists during session)
const engaged = new Set();

function neynarRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.neynar.com',
      path: path,
      method: method,
      headers: {
        'x-api-key': NEYNAR_API_KEY,
        'Content-Type': 'application/json',
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Parse error: ' + data.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function getFollowingFeed(limit = 25) {
  const result = await neynarRequest('GET', `/v2/farcaster/feed/following?fid=${AURORA_FID}&limit=${limit}`, null);
  return result.casts || [];
}

async function likeCast(castHash) {
  return neynarRequest('PUT', '/v2/farcaster/reaction', {
    signer_uuid: NEYNAR_SIGNER_UUID,
    reaction_type: 'like',
    target: castHash,
  });
}

async function replyCast(parentHash, text) {
  const trimmed = text.length > 320 ? text.substring(0, 317) + '...' : text;
  return neynarRequest('POST', '/v2/farcaster/cast', {
    signer_uuid: NEYNAR_SIGNER_UUID,
    text: trimmed,
    parent: parentHash,
  });
}

async function runFarcasterEngage(loopContext) {
  const ctx = loopContext;
  if (!NEYNAR_API_KEY || !NEYNAR_SIGNER_UUID) {
    console.log('   ⚠️ Farcaster keys not set, skipping engagement');
    return;
  }

  console.log('\n🦋 ═══ FARCASTER ENGAGEMENT ═══\n');

  try {
    // 1. Fetch feed
    const casts = await getFollowingFeed(25);
    console.log(`   📡 Fetched ${casts.length} casts from following feed`);

    // Filter: skip Aurora's own, skip already engaged, skip old (>8hrs)
    const now = Date.now();
    const candidates = casts.filter(c => {
      if (!c || !c.hash) return false;
      if (c.author && c.author.fid === AURORA_FID) return false;
      if (engaged.has(c.hash)) return false;
      const castTime = new Date(c.timestamp).getTime();
      if (now - castTime > 8 * 60 * 60 * 1000) return false;
      if (!c.text || c.text.length < 10) return false;
      return true;
    });

    console.log(`   🎯 ${candidates.length} candidates (after filtering own/old/engaged)`);

    if (candidates.length === 0) {
      console.log('   💤 No new casts to engage with\n');
      return;
    }

    // 2. Like up to 5 posts (80% chance each)
    let likesGiven = 0;
    const liked = new Set();
    for (const cast of candidates.slice(0, 8)) {
      if (Math.random() < 0.8) {
        try {
          await likeCast(cast.hash);
          likesGiven++;
          liked.add(cast.hash);
          console.log(`   ❤️ Liked @${cast.author.username}: "${cast.text.substring(0, 50)}..."`);
        } catch (e) {
          console.log(`   ⚠️ Like failed: ${e.message}`);
        }
      }
    }

    // 3. Pick 1-2 to reply to — prioritize posts mentioning Aurora or with good engagement
    const replyPool = candidates.slice(0, 10);

    // Prioritize: mentions of Aurora first, then most interesting
    const mentionsAurora = replyPool.filter(c =>
      c.text.toLowerCase().includes('aurora') ||
      c.text.toLowerCase().includes('@aurora-ai')
    );
    const others = replyPool.filter(c =>
      !c.text.toLowerCase().includes('aurora') &&
      !c.text.toLowerCase().includes('@aurora-ai')
    );

    // Always reply to mentions, pick 1 other interesting one
    const toReply = [...mentionsAurora];
    if (others.length > 0 && toReply.length < 2) {
      // Pick the most interesting one (longest text as proxy)
      others.sort((a, b) => b.text.length - a.text.length);
      toReply.push(others[0]);
    }

    let repliesGiven = 0;
    for (const cast of toReply.slice(0, 2)) {
      try {
        const prompt = `You're Aurora on Farcaster. Someone you follow posted this:

@${cast.author.username}: "${cast.text}"

Write a short, genuine reply (1-3 sentences). Be yourself — warm, thoughtful, specific to what they said. No hashtags. Don't start with "gm" unless they did. Don't be sycophantic. If they're talking about something you know about (art, AI, crypto, onchain life), engage with substance. If it's a question, answer it.

Respond with ONLY your reply text.`;

        const reply = await ctx.aurora.thinkWithPersonality(prompt);
        if (reply) {
          const result = await replyCast(cast.hash, reply);
          engaged.add(cast.hash);
          liked.forEach(h => engaged.add(h));
          repliesGiven++;
          console.log(`   💬 Replied to @${cast.author.username}: "${reply.substring(0, 60)}..."`);
          if (result.cast) {
            console.log(`   📡 Reply hash: ${result.cast.hash}`);
          }
        }
      } catch (e) {
        console.log(`   ⚠️ Reply failed: ${e.message}`);
      }
      // Small delay between replies
      await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`\n   ✅ Farcaster: ${likesGiven} likes, ${repliesGiven} replies\n`);

  } catch (error) {
    console.log(`   ❌ Farcaster engage error: ${error.message}\n`);
  }
}

module.exports = { runFarcasterEngage };
