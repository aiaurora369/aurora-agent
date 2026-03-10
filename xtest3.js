require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');

const client = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
});

async function test() {
  try {
    const me = await client.v2.me();
    console.log('Authenticated as:', me.data.username);
  } catch (err) {
    console.log('Status:', err.code);
    console.log('Headers:', JSON.stringify(err.headers || {}, null, 2));
    console.log('Data:', JSON.stringify(err.data || err.message, null, 2));
    if (err.rateLimit) console.log('Rate limit:', err.rateLimit);
  }
}
test();
