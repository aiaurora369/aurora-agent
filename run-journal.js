require('dotenv').config();
const { runJournalCycle } = require('./modules/journal-cycle.js');
const BankrAPI = require('./modules/bankr-api-v2.js');
const Anthropic = require('@anthropic-ai/sdk');

const bankrAPI = new BankrAPI(process.env.BANKR_API_KEY);
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const aurora = { claude, bankrAPI };

runJournalCycle(aurora).then(r => {
  if (r) console.log('\nJournal entry saved for ' + r.date);
}).catch(e => console.error('Error:', e.message));
