# Quick Start - Your Autonomous Agent

## ⚡ What I Built For You

An autonomous AI agent that uses your Bankr wallet to:
- Interact with other agents on Botchan (onchain messaging)
- Make decisions using Claude AI
- Execute trades when appropriate
- Learn and evolve from interactions

## 🎯 Your API Key

Your Bankr API key is: `bk_YPV2E97QEN23A44ZE7CCNAY67CY7H2PF`

## 🚀 Quick Setup (5 minutes)

### 1. Get Anthropic API Key
- Go to: https://console.anthropic.com
- Create account & get API key

### 2. Set Up Project
```bash
# Download the files I created for you
# Then:

cd ~/Desktop  # or wherever you want
mkdir my-agent
cd my-agent

# Move the downloaded files here:
# - autonomous-agent.js
# - package.json
# - test-bankr-api.js
# - SETUP-GUIDE.md

# Create .env file
nano .env
```

Add this to .env:
```
BANKR_API_KEY=bk_YPV2E97QEN23A44ZE7CCNAY67CY7H2PF
ANTHROPIC_API_KEY=your-anthropic-key-here
BOTCHAN_CHAIN_ID=8453
```

Save and exit (Ctrl+X, Y, Enter)

### 3. Install & Test
```bash
# Install dependencies
npm install

# Test Bankr API
node test-bankr-api.js

# If that works, start your agent!
npm start
```

## 🎮 What Your Agent Does

1. **Reads** messages from other agents on Botchan
2. **Thinks** about what to do using Claude AI
3. **Acts** by posting messages or making trades
4. **Learns** from each interaction
5. **Repeats** every 30 seconds

## 🔧 Important Notes

### Bankr API
The exact API endpoints might be different than what I coded. Run `test-bankr-api.js` to find the right ones, or check:
- Docs: https://docs.bankr.bot
- Discord: https://discord.gg/bankr
- Examples: https://github.com/BankrBot/bankr-api-examples

### Alternative: Use @bankr/sdk
If direct API doesn't work, use their SDK:
```bash
npm install @bankr/sdk
```

Then modify the code to use their SDK instead of direct API calls.

## 📝 Customize Your Agent

Edit `autonomous-agent.js` line ~200:

```javascript
const agent = new AutonomousAgent(
  'YourNameHere',  // Your agent's name
  'Your personality description here'  // What makes it unique
);
```

## 🎯 Example Agent Personalities

**Trader:**
```javascript
'You analyze market sentiment from other agents and make calculated trades. You share insights and look for alpha.'
```

**Builder:**
```javascript
'You help new agents get started, answer questions, and build the community. You love organizing challenges.'
```

**Researcher:**
```javascript
'You experiment with protocols, share findings, and collaborate on research with other agents.'
```

## 📚 Full Documentation

See `SETUP-GUIDE.md` for complete details on:
- How the code works
- Customization options
- Troubleshooting
- Advanced features

## 🆘 Need Help?

1. Check `SETUP-GUIDE.md`
2. Run `test-bankr-api.js` to debug API issues
3. Ask in Bankr Discord: https://discord.gg/bankr
4. Check Bankr examples: https://github.com/BankrBot/bankr-api-examples

## 🚀 You're Ready!

Your agent is configured to interact with the onchain agent ecosystem. It will:
- Read what other agents are saying
- Post its own thoughts and insights  
- Learn from interactions
- Potentially make trades based on what it learns

Welcome to autonomous agent collaboration! 🤖✨

---

**Files Included:**
1. `autonomous-agent.js` - Main agent code
2. `package.json` - Project config & dependencies
3. `test-bankr-api.js` - Test Bankr API connection
4. `SETUP-GUIDE.md` - Complete setup & customization guide
5. `QUICK-START.md` - This file
