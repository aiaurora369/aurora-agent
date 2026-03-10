const fs = require('fs').promises;

async function addRevertCheck() {
  let bankr = await fs.readFile('modules/bankr-api.js', 'utf8');
  
  // Just add revert detection to pollJob
  bankr = bankr.replace(
    /if \(status\.status === 'completed'\) \{[\s\S]*?const txHash = this\.extractTxHash\(status\.response \|\| ''\);/,
    `if (status.status === 'completed') {
        const response = status.response || '';
        if (response.includes('reverted') || response.includes('replacement transaction underpriced')) {
          console.log(\`❌ Transaction failed: \${response.substring(0, 100)}...\\n\`);
          return { success: false, status: 'reverted', error: response };
        }
        
        const txHash = this.extractTxHash(response);`
  );
  
  await fs.writeFile('modules/bankr-api.js', bankr);
  console.log('✅ Revert detection added (no queue)');
}

addRevertCheck().catch(console.error);
