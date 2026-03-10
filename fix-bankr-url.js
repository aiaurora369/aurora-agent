const fs = require('fs').promises;

async function fixURL() {
  let bankr = await fs.readFile('modules/bankr-api.js', 'utf8');
  
  bankr = bankr.replace(
    /this\.baseURL = 'api\.bankr\.bot';/,
    "this.baseURL = 'https://api.bankr.bot';"
  );
  
  await fs.writeFile('modules/bankr-api.js', bankr);
  console.log('✅ Fixed Bankr URL!');
}

fixURL().catch(console.error);
