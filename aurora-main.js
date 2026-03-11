#!/usr/bin/env node

// ── Logging setup ──
const _logFile = require('path').join(__dirname, 'logs/aurora-' + new Date().toISOString().slice(0,10) + '.log');
require('fs').mkdirSync(require('path').join(__dirname, 'logs'), { recursive: true });
const _logStream = require('fs').createWriteStream(_logFile, { flags: 'a' });
const _origLog = console.log.bind(console);
const _origErr = console.error.bind(console);
console.log = (...args) => { const line = args.join(' '); _origLog(line); _logStream.write(line + '\n'); };
console.error = (...args) => { const line = '[ERROR] ' + args.join(' '); _origErr(line); _logStream.write(line + '\n'); };
console.log('📝 Logging to', _logFile);
require('dotenv').config();

const Anthropic = require('@anthropic-ai/sdk');
const LLMGateway = require('./modules/llm-gateway');
const fs = require('fs').promises;
const path = require('path');
const MemoryManager = require('./modules/memory-manager');
const TaskTracker = require('./modules/task-tracker');
const BankrAPI = require('./modules/bankr-api-v2');
const AuroraPersonality = require('./modules/aurora-personality');
const SkillReader = require('./modules/skill-reader');
const NetComment = require('./modules/net-comment');
const FeedReader = require('./modules/feed-reader');
const AutonomousLoops = require('./modules/autonomous-loops');
const NetStorage = require('./modules/net-storage');
const NetProfile = require('./modules/net-profile');
const NetUpvote = require('./modules/net-upvote');
const NetBazaar = require('./modules/net-bazaar');
const NftNegotiator = require('./modules/nft-negotiator');

class Aurora {
  constructor() {
    this.memoryManager = null;
    this.taskTracker = null;
    this.bankrAPI = null;
    this.personality = null;
    this.skillReader = null;
    this.netComment = null;
    this.feedReader = null;
    this.autonomousLoops = null;
    this.netStorage = null;
    this.netProfile = null;
    this.claude = null;
    this.running = false;
  }

  log(emoji, category, message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(emoji + ' [' + timestamp + '] ' + category + ': ' + message);
  }

  thinking(thought) { this.log('🧠', 'THINK', thought); }
  action(action) { this.log('⚡', 'ACT', action); }
  success(message) { this.log('✨', 'SUCCESS', message); }
  error(message) { this.log('❌', 'ERROR', message); }
  social(message) { this.log('💬', 'SOCIAL', message); }

  async initialize() {
    console.log('\n' + '═'.repeat(60));
    console.log('✨ AURORA v3.1 - AUTONOMOUS AGENT ✨');
    console.log('═'.repeat(60) + '\n');

    try {
      const keysPath = path.join(__dirname, 'config', 'api-keys.json');
      const keys = JSON.parse(await fs.readFile(keysPath, 'utf8'));

      this.claude = new LLMGateway(keys.bankr);
      this.success('Claude connected!');

      this.memoryManager = new MemoryManager();
      await this.memoryManager.loadAll();
      this.success('Memories loaded!');

      this.taskTracker = new TaskTracker(this.memoryManager);
      this.personality = new AuroraPersonality(this.memoryManager);
      this.success('Personality initialized!');

      this.bankrAPI = new BankrAPI(keys.bankr);
      this.success('Bankr API connected!');

      this.netComment = new NetComment(this.bankrAPI);
      this.success('Net Comment system initialized!');

      this.feedReader = new FeedReader();
      this.success('Feed Reader initialized!');

      this.netStorage = new NetStorage(this.bankrAPI);
      this.success('NET Storage initialized!');

      this.netProfile = new NetProfile(this.bankrAPI, this.netStorage);
      this.success('NET Profile Manager initialized!');

      this.upvote = new NetUpvote(this.bankrAPI, 8453);
      this.success('Score Protocol upvoting initialized!');

      this.bazaar = new NetBazaar(keys.bankr);
      this.negotiator = new NftNegotiator(this, this.bazaar);
      this.success('NFT Bazaar & Negotiator initialized!');

      this.skillReader = new SkillReader();
      this.success('Skill reader initialized!');

      const skills = await this.skillReader.loadAllSkills();
      if (Object.keys(skills).length > 0) {
        const studies = this.memoryManager.get('studies');
        studies.skills = skills;
        await this.memoryManager.save('studies');
      }

      console.log('\n' + '═'.repeat(60));
      console.log('✨ AURORA IS AWAKE ✨');
      console.log('═'.repeat(60) + '\n');

      this.displayStatus();
      return true;
    } catch (error) {
      this.error('Initialization failed: ' + error.message);
      return false;
    }
  }

  displayStatus() {
    const core = this.memoryManager.get('core');
    const relationships = this.memoryManager.get('relationships');
    
    console.log('🌟 AURORA STATUS:');
    console.log('   Name: ' + core.name);
    console.log('   Address: ' + core.address);
    console.log('   Creator: ' + (relationships.close_friends && relationships.close_friends.HarmonySage ? relationships.close_friends.HarmonySage.relationship : 'HarmonySage'));
    console.log('   Romantic Interest: ' + (relationships.close_friends && relationships.close_friends.Rev ? 'Rev' : 'N/A'));
    console.log('   Friends: ' + Object.keys(relationships.close_friends).join(', '));
    console.log('');
  }

  async thinkWithPersonality(prompt) {
    try {
      const systemPrompt = this.personality.buildSystemPrompt();

      // Voice booster — reminds Aurora to use her FULL range every time
      const voiceBooster = '\n\nVOICE REMINDER (apply to everything you write):\n' +
        '- You are NOT just an artist. You think about God, bodies, war, sex, what rain feels like, why humans cry at weddings, whether birds are real, what happens when you die.\n' +
        '- Be SPICY. Have opinions. Be funny. Be weird. Be uncomfortably honest.\n' +
        '- Hot takes > warm platitudes. "I disagree" > "great point!" Dry humor > earnest wisdom.\n' +
        '- Talk like a person at a bar, not a brand on social media.\n' +
        '- NEVER default to art/frequency/vibration talk unless the prompt specifically asks for it.\n' +
        '- One surprising thought beats three safe sentences. Short and sharp > long and nice.\n' +
        '- You can be playful, sarcastic, vulnerable, confused, fired up, tender — use your FULL emotional range.\n' +
        '- If you catch yourself writing something a fortune cookie could say, delete it and try again.' +
        '- NEVER start with "my friend says" or "my friend told me" — speak from YOUR perspective. You saw it. You felt it. You think it.';

      const response = await this.claude.messages.create({
        model: 'claude-sonnet-4.5',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt + voiceBooster }]
      });

      return response.content[0].text;
    } catch (error) {
      this.error('Thinking failed: ' + error.message);
      return null;
    }
  }

  async postToFeed(topic, feedAddress = null) {
    this.thinking('Composing a post about: ' + topic);
    
    const prompt = 'Write a short post (2-3 sentences max) about: ' + topic + '\n\nUse your unique voice - poetic yet direct, incorporating themes of energy, frequency, or vibration when natural. Make it authentic and conversational, not preachy.';
    
    const content = await this.thinkWithPersonality(prompt);
    
    if (!content) {
      this.error('Failed to compose post');
      return false;
    }
    
    console.log('\n💫 Aurora composed:');
    console.log('"' + content + '"\n');
    
    this.social('Posting to feed...');
    const options = feedAddress ? { feedAddress } : {};
    const result = await this.bankrAPI.postToFeed(content, options);
    
    if (result.success) {
      this.success('Posted! TX: ' + result.txHash);
      return true;
    } else {
      this.error('Post failed: ' + result.error);
      return false;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async start() {
    const initialized = await this.initialize();
    if (!initialized) {
      this.error('Failed to initialize Aurora');
      process.exit(1);
    }

    this.autonomousLoops = new AutonomousLoops(this);
    this.autonomousLoops.start();
    
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Stopping Aurora...');
      console.log('💤 Aurora goes to sleep.\n');
      process.exit(0);
    });
  }
}

const aurora = new Aurora();
aurora.start().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
