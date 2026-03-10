const fs = require('fs').promises;

async function addQueue() {
  console.log('\n🔧 Adding transaction queue to Bankr API...\n');
  
  let bankr = await fs.readFile('modules/bankr-api.js', 'utf8');
  
  // Add queue to constructor
  bankr = bankr.replace(
    /constructor\(apiKey\) \{[\s\S]*?this\.baseUrl = 'https:\/\/api\.bankr\.run';/,
    `constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.bankr.run';
    this.transactionQueue = Promise.resolve(); // Queue for sequential transactions`
  );
  
  // Wrap submitTransactionDirect with queue
  bankr = bankr.replace(
    /async submitTransactionDirect\(txData\) \{/,
    `async submitTransactionDirect(txData) {
    // Use queue to ensure transactions happen one at a time
    return this.transactionQueue = this.transactionQueue.then(async () => {
      return this._submitTransactionDirectInternal(txData);
    }).catch(error => {
      console.log('Queue error:', error.message);
      return { success: false, error: error.message };
    });
  }
  
  async _submitTransactionDirectInternal(txData) {`
  );
  
  await fs.writeFile('modules/bankr-api.js', bankr);
  
  console.log('✅ Transaction queue added!\n');
  console.log('   Now transactions will wait for each other\n');
}

addQueue().catch(console.error);
