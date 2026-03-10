const fs = require('fs').promises;

async function addLock() {
  let bankr = await fs.readFile('modules/bankr-api.js', 'utf8');
  
  // Add lock property to constructor
  bankr = bankr.replace(
    /this\.baseUrl = 'https:\/\/api\.bankr\.run';/,
    `this.baseUrl = 'https://api.bankr.run';
    this.isSubmitting = false; // Lock to prevent concurrent submissions`
  );
  
  // Add lock check at start of submitTransactionDirect
  bankr = bankr.replace(
    /async submitTransactionDirect\(txData\) \{[\s\S]*?try \{/,
    `async submitTransactionDirect(txData) {
    // Wait if another submission is in progress
    while (this.isSubmitting) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    this.isSubmitting = true;
    
    try {`
  );
  
  // Release lock after completion
  bankr = bankr.replace(
    /await new Promise\(resolve => setTimeout\(resolve, 3000\)\);[\s\S]*?const result = await this\.pollJob/,
    `await new Promise(resolve => setTimeout(resolve, 3000));
      
      const result = await this.pollJob`
  );
  
  bankr = bankr.replace(
    /\} catch \(error\) \{[\s\S]*?return \{ success: false, error: error\.message \};[\s\S]*?\}[\s\S]*?\}/,
    `} catch (error) {
      return { success: false, error: error.message };
    } finally {
      this.isSubmitting = false; // Always release lock
    }
  }`
  );
  
  await fs.writeFile('modules/bankr-api.js', bankr);
  console.log('✅ Simple lock added');
}

addLock().catch(console.error);
