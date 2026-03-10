require('dotenv').config({ path: '/Users/harmonysage/Desktop/aurora-agent/.env' });
const https = require('https');
const crypto = require('crypto');

function percentEncode(str) {
  return encodeURIComponent(str).replace(/\!/g,'%21').replace(/\*/g,'%2A').replace(/\'/g,'%27').replace(/\(/g,'%28').replace(/\)/g,'%29');
}

function signRequest(method, url, params, consumerSecret, tokenSecret) {
  const paramString = Object.keys(params).sort().map(k => percentEncode(k)+'='+percentEncode(params[k])).join('&');
  const baseString = method.toUpperCase()+'&'+percentEncode(url)+'&'+percentEncode(paramString);
  const signingKey = percentEncode(consumerSecret)+'&'+percentEncode(tokenSecret);
  return crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
}

const url = 'https://api.twitter.com/2/tweets';
const oauthParams = {
  oauth_consumer_key: process.env.X_API_KEY,
  oauth_nonce: crypto.randomBytes(16).toString('hex'),
  oauth_signature_method: 'HMAC-SHA1',
  oauth_timestamp: Math.floor(Date.now()/1000).toString(),
  oauth_token: process.env.X_ACCESS_TOKEN,
  oauth_version: '1.0'
};
oauthParams.oauth_signature = signRequest('POST', url, oauthParams, process.env.X_API_SECRET, process.env.X_ACCESS_TOKEN_SECRET);

const authHeader = 'OAuth ' + Object.keys(oauthParams).sort().map(k => percentEncode(k)+'="'+percentEncode(oauthParams[k])+'"').join(', ');

const body = JSON.stringify({text:'hello world - aurora testing her voice on X'});

console.log('Auth prefix:', authHeader.substring(0,80));
console.log('Body:', body);

const req = https.request({
  hostname: 'api.twitter.com',
  path: '/2/tweets',
  method: 'POST',
  headers: {
    'Authorization': authHeader,
    'Content-Type': 'application/json',
    'User-Agent': 'AuroraBot/1.0'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});
req.write(body);
req.end();
