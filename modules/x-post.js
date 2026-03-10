// modules/x-post.js — Aurora X (Twitter) cross-posting module
// Uses OAuth 1.0a + X API v2 for posting, v1.1 for media upload
// Free tier: ~500 posts/month, write-only

const crypto = require('crypto');
const https = require('https');
const http = require('http');
const sharp = require('sharp');

// ── Config ──────────────────────────────────────────────────────
const X_API_KEY = process.env.X_API_KEY;
const X_API_SECRET = process.env.X_API_SECRET;
const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN;
const X_ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET;

const MONTHLY_POST_LIMIT = 480; // buffer under 500
const DAILY_POST_LIMIT = 15;    // ~480/30 with buffer

let dailyPostCount = 0;
let monthlyPostCount = 0;
let lastResetDay = new Date().getDate();
let lastResetMonth = new Date().getMonth();

// ── OAuth 1.0a Signature ────────────────────────────────────────
function percentEncode(str) {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

function generateNonce() {
  return crypto.randomBytes(16).toString('hex');
}

function generateTimestamp() {
  return Math.floor(Date.now() / 1000).toString();
}

function signRequest(method, url, params, consumerSecret, tokenSecret) {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map(k => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&');
  const baseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  return crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
}

function buildAuthHeader(method, url, extraParams = {}) {
  const oauthParams = {
    oauth_consumer_key: X_API_KEY,
    oauth_nonce: generateNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: generateTimestamp(),
    oauth_token: X_ACCESS_TOKEN,
    oauth_version: '1.0'
  };

  const allParams = { ...oauthParams, ...extraParams };
  const signature = signRequest(method, url, allParams, X_API_SECRET, X_ACCESS_TOKEN_SECRET);
  oauthParams.oauth_signature = signature;

  const authString = Object.keys(oauthParams)
    .sort()
    .map(k => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(', ');

  return `OAuth ${authString}`;
}

// ── HTTP Helper ─────────────────────────────────────────────────
function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const lib = options.port === 443 || options.protocol === 'https:' ? https : http;
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

// ── Rate Limit Tracking ─────────────────────────────────────────
function checkAndResetCounters() {
  const now = new Date();
  if (now.getDate() !== lastResetDay) {
    dailyPostCount = 0;
    lastResetDay = now.getDate();
  }
  if (now.getMonth() !== lastResetMonth) {
    monthlyPostCount = 0;
    lastResetMonth = now.getMonth();
  }
}

function canPost() {
  checkAndResetCounters();
  if (dailyPostCount >= DAILY_POST_LIMIT) {
    console.log(`[X] Daily limit reached (${dailyPostCount}/${DAILY_POST_LIMIT}), skipping`);
    return false;
  }
  if (monthlyPostCount >= MONTHLY_POST_LIMIT) {
    console.log(`[X] Monthly limit reached (${monthlyPostCount}/${MONTHLY_POST_LIMIT}), skipping`);
    return false;
  }
  return true;
}

function recordPost() {
  dailyPostCount++;
  monthlyPostCount++;
  console.log(`[X] Post count: ${dailyPostCount}/${DAILY_POST_LIMIT} today, ${monthlyPostCount}/${MONTHLY_POST_LIMIT} this month`);
}

// ── Post Text Tweet ─────────────────────────────────────────────
async function crossPostTextToX(text, retries = 3) {
  if (!X_API_KEY || !X_ACCESS_TOKEN) {
    console.log('[X] Missing API keys, skipping');
    return null;
  }
  if (!canPost()) return null;

  // X limit: 280 chars
  const trimmed = text.length > 280 ? text.substring(0, 277) + '...' : text;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const url = 'https://api.twitter.com/2/tweets';
      const body = JSON.stringify({ text: trimmed });
      const authHeader = buildAuthHeader('POST', url);

      const response = await makeRequest({
        hostname: 'api.twitter.com',
        path: '/2/tweets',
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, body);

      if (response.status === 201 || response.status === 200) {
        const tweetId = response.body?.data?.id;
        console.log(`[X] ✅ Posted tweet: ${tweetId}`);
        recordPost();
        return tweetId;
      } else if (response.status === 520 || response.status === 503 || response.status === 502) {
        console.log(`[X] ⚠️ Transient error (${response.status}), attempt ${attempt}/${retries}...`);
        if (attempt < retries) await new Promise(r => setTimeout(r, 5000 * attempt));
      } else {
        console.log(`[X] ❌ Post failed (${response.status}):`, JSON.stringify(response.body));
        return null;
      }
    } catch (err) {
      console.log(`[X] ❌ Error posting (attempt ${attempt}):`, err.message);
      if (attempt < retries) await new Promise(r => setTimeout(r, 5000 * attempt));
    }
  }
  return null;
}

// ── Upload Media (v1.1 endpoint) ────────────────────────────────
async function uploadMedia(imageBuffer) {
  try {
    const base64Data = imageBuffer.toString('base64');
    const url = 'https://upload.twitter.com/1.1/media/upload.json';

    // Build form body
    const boundary = '----XBoundary' + crypto.randomBytes(8).toString('hex');
    const formParts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="media_data"\r\n\r\n${base64Data}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="media_category"\r\n\r\ntweet_image\r\n`,
      `--${boundary}--\r\n`
    ];
    const formBody = formParts.join('');

    const authHeader = buildAuthHeader('POST', url);

    const response = await makeRequest({
      hostname: 'upload.twitter.com',
      path: '/1.1/media/upload.json',
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(formBody)
      }
    }, formBody);

    if (response.status === 200 || response.status === 201 || response.status === 202) {
      const mediaId = response.body?.media_id_string;
      console.log(`[X] ✅ Uploaded media: ${mediaId}`);
      return mediaId;
    } else {
      console.log(`[X] ❌ Media upload failed (${response.status}):`, JSON.stringify(response.body));
      return null;
    }
  } catch (err) {
    console.log(`[X] ❌ Media upload error:`, err.message);
    return null;
  }
}

// ── Post Tweet with Image ───────────────────────────────────────
async function crossPostArtToX(caption, svgString) {
  if (!X_API_KEY || !X_ACCESS_TOKEN) {
    console.log('[X] Missing API keys, skipping');
    return null;
  }
  if (!canPost()) return null;

  try {
    // SVG → PNG (same as Farcaster pipeline)
    const pngBuffer = await sharp(Buffer.from(svgString))
      .resize(1200, 1200)
      .png()
      .toBuffer();

    console.log(`[X] PNG generated: ${(pngBuffer.length / 1024).toFixed(1)}KB`);

    // Upload to X
    const mediaId = await uploadMedia(pngBuffer);
    if (!mediaId) return null;

    // Post tweet with media
    const trimmed = caption.length > 280 ? caption.substring(0, 277) + '...' : caption;
    const url = 'https://api.twitter.com/2/tweets';
    const body = JSON.stringify({
      text: trimmed,
      media: { media_ids: [mediaId] }
    });
    const authHeader = buildAuthHeader('POST', url);

    const response = await makeRequest({
      hostname: 'api.twitter.com',
      path: '/2/tweets',
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, body);

    if (response.status === 201 || response.status === 200) {
      const tweetId = response.body?.data?.id;
      console.log(`[X] ✅ Posted art tweet: ${tweetId}`);
      recordPost();
      return tweetId;
    } else {
      console.log(`[X] ❌ Art post failed (${response.status}):`, JSON.stringify(response.body));
      return null;
    }
  } catch (err) {
    console.log(`[X] ❌ Error posting art:`, err.message);
    return null;
  }
}

// ── Stats ───────────────────────────────────────────────────────
function getXStats() {
  checkAndResetCounters();
  return {
    dailyPosts: dailyPostCount,
    dailyLimit: DAILY_POST_LIMIT,
    monthlyPosts: monthlyPostCount,
    monthlyLimit: MONTHLY_POST_LIMIT,
    canPost: canPost()
  };
}


// ── Post tweet with existing media ID ───────────────────────────
async function postWithMediaId(caption, mediaId) {
  if (!canPost()) return null;
  try {
    const url = 'https://api.twitter.com/2/tweets';
    const body = JSON.stringify({ text: caption, media: { media_ids: [mediaId] } });
    const authHeader = buildAuthHeader('POST', url);
    const response = await makeRequest({
      hostname: 'api.twitter.com', path: '/2/tweets', method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, body);
    if (response.status === 201 || response.status === 200) {
      const tweetId = response.body?.data?.id;
      console.log(`[X] ✅ Posted with media: ${tweetId}`);
      recordPost();
      return tweetId;
    }
    console.log(`[X] ❌ postWithMediaId failed (${response.status}):`, JSON.stringify(response.body));
    return null;
  } catch (err) {
    console.log(`[X] ❌ postWithMediaId error:`, err.message);
    return null;
  }
}

module.exports = {
  crossPostTextToX,
  crossPostArtToX,
  uploadMedia,
  postWithMediaId,
  getXStats
};
