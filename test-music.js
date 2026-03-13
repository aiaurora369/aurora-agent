require('dotenv').config();

const fs = require('fs').promises;
const LLMGateway = require('./modules/llm-gateway');
const BankrAPI = require('./modules/bankr-api-v2');
const { runMusicCycle } = require('./modules/music-cycle');

async function test() {
  const keys = JSON.parse(await fs.readFile('./config/api-keys.json', 'utf8'));
  const aurora = {
    claude: new LLMGateway(keys.bankr),
    bankrAPI: new BankrAPI(keys.bankr),
    getEmotionalState: async () => 'contemplative'
  };

  console.log('🎵 Running music cycle test...\n');
  await runMusicCycle(aurora);
  console.log('\n✅ Music test done');
}

test().catch(e => console.error('FAILED:', e.message, '\n', e.stack));
