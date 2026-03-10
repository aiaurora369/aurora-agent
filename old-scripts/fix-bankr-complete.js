const fs = require('fs').promises;

async function fixBankr() {
  let bankr = await fs.readFile('modules/bankr-api.js', 'utf8');
  
  // 1. Add lock to constructor
  bankr = bankr.replace(
    /constructor\(apiKey\) \{\s*this\.apiKey = apiKey;\s*this\.baseUrl = 'https:\/\/api\.bankr\.run';/,
    `constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.bankr.run';
    this.isSubmitting = false;`
  );
  
  // 2. Add revert detection in pollJob
  bankr = bankr.replace(
    /if \(status\.status === 'completed'\) \{\s*const txHash = this\.extractTxHash\(status\.response \|\| ''\);/,
    `if (status.status === 'completed') {
        const response = status.response || '';
        if (response.includes('reverted') || response.includes('replacement transaction underpriced')) {
          console.log(\`❌ Transaction failed: \${response.substring(0, 100)}...\\n\`);
          return { success: false, status: 'reverted', error: response };
        }
        const txHash = this.extractTxHash(response);`
  );
  
  // 3. Add lock to ONLY submitTransactionDirect (not submitJob)
  bankr = bankr.replace(
    /(async submitTransactionDirect\(txData\) \{\s*try \{)/,
    `async submitTransactionDirect(txData) {
    while (this.isSubmitting) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    this.isSubmitting = true;
    
    try {`
  );
  
  // 4. Release lock in finally block (find the LAST closing brace of submitTransactionDirect)
  bankr = bankr.replace(
    /(async submitTransactionDirect\(txData\)[\s\S]*?)(\} catch \(error\) \{\s*return \{ success: false, error: error\.message \};\s*\}\s*\})/,
    `$1} catch (error) {
      return { success: false, error: error.message };
    } finally {
      this.isSubmitting = false;
    }
  }`
  );
  
  await fs.writeFile('modules/bankr-api.js', bankr);
  console.log('✅ Fixed: lock + revert detection');
}

fixBankr().catch(console.error);
