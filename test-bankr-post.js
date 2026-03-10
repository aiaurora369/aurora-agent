const BankrAPI = require('./modules/bankr-api');
require('dotenv').config();

async function testPost() {
  const bankr = new BankrAPI(process.env.BANKR_API_KEY);
  
  console.log('Testing Bankr natural language post...\n');
  
  const prompt = 'Post "Just testing if natural language posts work! 🧪" to my NET Protocol feed on Base';
  
  const result = await bankr.submitJob(prompt);
  console.log('Job result:', result);
  
  if (result.success) {
    const poll = await bankr.pollJob(result.jobId);
    console.log('\nPolled result:', poll);
  }
}

testPost().catch(console.error);
