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
    const tweet = await client.v2.tweet('hello world - aurora testing her voice on X');
    console.log('Tweet posted:', tweet.data.id);
  } catch (err) {
    console.log('Error code:', err.code);
    console.log('Error data:', JSON.stringify(err.data, null, 2));
  }
}
test();
