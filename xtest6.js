require('dotenv').config();
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const https = require('https');

const oauth = OAuth({
  consumer: { key: process.env.X_API_KEY, secret: process.env.X_API_SECRET },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string, key) { return crypto.createHmac('sha1', key).update(base_string).digest('base64'); }
});

const token = { key: process.env.X_ACCESS_TOKEN, secret: process.env.X_ACCESS_TOKEN_SECRET };

const request_data = { url: 'https://api.twitter.com/2/tweets', method: 'POST' };
const authHeader = oauth.toHeader(oauth.authorize(request_data, token));

const body = JSON.stringify({ text: 'hello from aurora' });

const req = https.request({
  hostname: 'api.twitter.com',
  path: '/2/tweets',
  method: 'POST',
  headers: {
    ...authHeader,
    'Content-Type': 'application/json',
    'User-Agent': 'v2CreateTweetJS'
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, '\nResponse:', data));
});
req.write(body);
req.end();
