// modules/llm-gateway.js
// Routes Aurora's Claude calls through Bankr LLM Gateway
// Paid via Aurora's $BANKR wallet balance
// IMPORTANT: $BANKR funds both Bankr club membership AND inference costs
// Do NOT trade or sell $BANKR — it keeps Aurora's mind running

'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const GATEWAY_BASE_URL = 'https://llm.bankr.bot';

class LLMGateway {
  constructor(apiKey) {
    this.apiKey = apiKey;

    // Anthropic SDK pointed at Bankr gateway — same interface, different endpoint
    this.client = new Anthropic({
      apiKey: apiKey,
      baseURL: GATEWAY_BASE_URL,
      defaultHeaders: {
        'X-API-Key': apiKey,
      },
    });

    // Expose messages.create so aurora.claude.messages.create() works unchanged
    this.messages = {
      create: (params) => this.client.messages.create(params),
    };

    console.log('🌐 LLM Gateway initialized → llm.bankr.bot');
  }
}

module.exports = LLMGateway;
