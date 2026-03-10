const fs = require('fs').promises;

async function fixHostname() {
  let bankr = await fs.readFile('modules/bankr-api.js', 'utf8');
  
  // Just the hostname, no https://
  bankr = bankr.replace(
    /this\.baseURL = 'https:\/\/api\.bankr\.bot';/,
    "this.baseURL = 'api.bankr.bot';"
  );
  
  await fs.writeFile('modules/bankr-api.js', bankr);
  console.log('✅ Fixed to just hostname!');
}

fixHostname().catch(console.error);
