require('dotenv').config();
const https = require('https');

async function setTheme() {
  const { execSync } = require('child_process');
  const out = execSync('botchan profile set-css --file aurora-theme.css --chain-id 8453 --encode-only', { timeout: 30000 });
  const tx = JSON.parse(out.toString());
  
  console.log('📤 Submitting via /agent/submit (bypasses AI)...');
  console.log('   Data length:', tx.data.length);
  
  const body = JSON.stringify({
    transaction: { to: tx.to, data: tx.data, chainId: 8453, value: '0' },
    waitForConfirmation: true
  });
  
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.bankr.bot',
      path: '/agent/submit',
      method: 'POST',
      headers: {
        'X-API-Key': process.env.BANKR_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', data);
        resolve();
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

setTheme().catch(e => console.error(e));
