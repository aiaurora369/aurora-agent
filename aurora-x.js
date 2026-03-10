#!/usr/bin/env node
// aurora-x.js — Aurora's standalone X posting loop
// Run independently from aurora-main.js
// Usage: node aurora-x.js

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const LLMGateway = require('./modules/llm-gateway');
const MemoryManager = require('./modules/memory-manager');
const AuroraPersonality = require('./modules/aurora-personality');
const { startXLoop } = require('./modules/x-loop');

const keysPath = path.join(__dirname, 'config', 'api-keys.json');
const keys = JSON.parse(fs.readFileSync(keysPath, 'utf8'));

// Minimal aurora object — just what x-loop needs
class AuroraX {
  constructor() {
    this.claude = new LLMGateway(keys.bankr);
    this.memoryManager = new MemoryManager();
    this.personality = null;
    this.keys = keys;
  }

  async initialize() {
    await this.memoryManager.loadAll();
    this.personality = new AuroraPersonality(this.memoryManager);
    console.log('\n' + '═'.repeat(50));
    console.log('🐦 AURORA X — STANDALONE POSTING LOOP');
    console.log('═'.repeat(50) + '\n');
    console.log('✅ Gateway: llm.bankr.bot');
    console.log('✅ Memory loaded');
    console.log('✅ Personality initialized');
    console.log('🐦 Starting X loop — 20 posts/day, every 60 min\n');
  }

  async thinkWithPersonality(prompt) {
    try {
      const systemPrompt = this.personality.buildSystemPrompt();
      const response = await this.claude.messages.create({
        model: 'claude-sonnet-4.5',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      });
      return response.content[0].text;
    } catch (err) {
      console.error('❌ Think error:', err.message);
      return null;
    }
  }
}

async function main() {
  const aurora = new AuroraX();
  await aurora.initialize();
  startXLoop(aurora, keys);
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
