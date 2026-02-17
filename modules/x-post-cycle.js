/**
 * X (Twitter) Cross-posting & Engagement
 * Posts Aurora's content to X and reads/engages with timeline.
 */

const { TwitterApi } = require('twitter-api-v2');

const fs = require('fs');
const path = require('path');

const X_DAILY_LIMIT = 12;  // max posts per 24h — adjust as needed
const TRACKER_FILE = path.join(__dirname, '..', '.x-post-tracker.json');

function getTracker() {
  try {
    const data = JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8'));
    const today = new Date().toISOString().slice(0, 10);
    if (data.date !== today) return { date: today, count: 0, posts: [] };
    return data;
  } catch {
    return { date: new Date().toISOString().slice(0, 10), count: 0, posts: [] };
  }
}

function saveTracker(tracker) {
  fs.writeFileSync(TRACKER_FILE, JSON.stringify(tracker, null, 2));
}

function canPostToX() {
  const tracker = getTracker();
  return tracker.count < X_DAILY_LIMIT;
}

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
  // Smart trim: preserve URLs when cutting for X's 280 char limit
  let trimmed = text;
  if (text.length > 280) {
    // Find URL in text
    const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      const url = urlMatch[0];
      const textWithoutUrl = text.replace(url, '').trim();
      const maxTextLen = 280 - url.length - 2; // 2 for newline spacing
      const shortText = textWithoutUrl.length > maxTextLen ? textWithoutUrl.substring(0, maxTextLen - 3) + '...' : textWithoutUrl;
      trimmed = url + '\n' + shortText;
    } else {
      trimmed = text.substring(0, 277) + '...';
    }
  }

  // Check daily limit
    if (!canPostToX()) {
      console.log('   ⏸️ X daily limit reached (' + X_DAILY_LIMIT + '/' + X_DAILY_LIMIT + ') — skipping');
      return null;
    }

    try {
    let mediaId = null;
    if (mediaBuffer) {
      mediaId = await tw.v1.uploadMedia(mediaBuffer, { mimeType: 'image/png' });
    }

    const params = { text: trimmed };
    if (mediaId) params.media = { media_ids: [mediaId] };

    const result = await tw.v2.tweet(params);
    console.log(`   🐦 Posted to X: ${result.data.id}`);
    const tracker = getTracker();
    tracker.count++;
    tracker.posts.push({ id: result.data.id, time: new Date().toISOString() });
    saveTracker(tracker);
    console.log(`   📊 X posts today: ${tracker.count}/${X_DAILY_LIMIT}`);
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
