/**
 * X (Twitter) Cross-posting & Engagement
 * Posts Aurora's content to X and reads/engages with timeline.
 */

const { TwitterApi } = require('twitter-api-v2');

let client = null;

function getClient() {
  if (client) return client;
  const userClient = new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
  });
  client = userClient.readWrite;
  return client;
}

async function postTweet(text, mediaBuffer) {
  const tw = getClient();
  const trimmed = text.length > 280 ? text.substring(0, 277) + '...' : text;

  try {
    let mediaId = null;
    if (mediaBuffer) {
      mediaId = await tw.v1.uploadMedia(mediaBuffer, { mimeType: 'image/png' });
    }

    const params = { text: trimmed };
    if (mediaId) params.media = { media_ids: [mediaId] };

    const result = await tw.v2.tweet(params);
    console.log(`   🐦 Posted to X: ${result.data.id}`);
    return result.data;
  } catch (e) {
    console.log(`   ⚠️ X post failed: ${e.message}`);
    return null;
  }
}

async function crossPostToX(text) {
  if (!process.env.X_API_KEY) return null;
  return postTweet(text);
}

async function crossPostArtToX(text, svg) {
  if (!process.env.X_API_KEY || !svg) return crossPostToX(text);

  try {
    const sharp = require('sharp');
    const pngBuf = await sharp(Buffer.from(svg)).resize(1200, 1200).png().toBuffer();
    return postTweet(text, pngBuf);
  } catch (e) {
    console.log(`   ⚠️ X art post failed: ${e.message}`);
    return crossPostToX(text);
  }
}

module.exports = { postTweet, crossPostToX, crossPostArtToX };
