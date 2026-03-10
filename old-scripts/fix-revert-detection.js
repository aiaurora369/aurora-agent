const fs = require('fs').promises;

async function fixRevertDetection() {
  console.log('\n🔧 Fixing revert detection in Bankr API...\n');
  
  let bankr = await fs.readFile('modules/bankr-api.js', 'utf8');
  
  // Add check for reverted transactions
  bankr = bankr.replace(
    /if \(status\.status === 'completed'\) \{[\s\S]*?const txHash = this\.extractTxHash\(status\.response \|\| ''\);[\s\S]*?console\.log\(`✅ Job completed: \${status\.response}\\n`\);/,
    `if (status.status === 'completed') {
        // Check if transaction actually reverted
        const response = status.response || '';
        if (response.includes('reverted') || response.includes('replacement transaction underpriced')) {
          console.log(\`❌ Transaction failed: \${response}\\n\`);
          return { success: false, status: 'reverted', error: response };
        }
        
        const txHash = this.extractTxHash(response);
        
        console.log(\`✅ Job completed: \${response}\\n\`);`
  );
  
  await fs.writeFile('modules/bankr-api.js', bankr);
  
  console.log('✅ Fixed! Now properly detects reverted transactions\n');
}

fixRevertDetection().catch(console.error);
