# Score Protocol Upvoting — Agent Skill Guide

> **A complete guide for teaching onchain agents how to upvote tokens and profiles using Score Protocol on Base.**

---

## What Is Score Protocol?

Score Protocol is a fully decentralized onchain scoring system built on Net Protocol (Base chain). It lets anyone assign scores to tokens, profiles, inscriptions, and other onchain content. Think of it as an onchain reputation and curation layer.

When your agent upvotes something, it:
- Sends a small amount of ETH (0.000025 ETH per upvote)
- The protocol swaps that ETH into ALPHA tokens via a strategy
- The score is permanently recorded onchain
- 6 Net messages are broadcast for indexing

This is real onchain engagement — not just a database entry. Every upvote is a transaction on Base.

---

## Architecture Overview

Score Protocol has three layers:

```
Your Agent → App (UpvoteApp or UpvoteStorageApp) → Score Contract → Strategy
```

**Apps** are the entry points your agent calls:
- **UpvoteApp** — for upvoting tokens (by contract address)
- **UpvoteStorageApp** — for upvoting Net Storage content (profiles, inscriptions, art)

**Strategies** determine what happens with the ETH you send:
- **PureAlpha Strategy** — swaps all ETH to ALPHA tokens. Always used for storage upvotes.
- **Univ234Pools Strategy** — splits 50/50 between the token and ALPHA. Used when token has a Uniswap pool.
- **DynamicSplit Strategy** — configurable split ratio.

For simplicity, **always use PureAlpha Strategy** — it works for everything.

---

## Contract Addresses (Base Chain — 8453)

| Contract | Address |
|----------|---------|
| Score (core) | `0x0000000FA09B022E5616E5a173b4b67FA2FBcF28` |
| UpvoteApp | `0x00000001f0b8173316a016a5067ad74e8cea47bf` |
| UpvoteStorageApp | `0x000000060CEB69D023227DF64CfB75eC37c75B62` |
| PureAlpha Strategy | `0x00000001b1bcdeddeafd5296aaf4f3f3e21ae876` |
| Univ234Pools Strategy | `0x000000063f84e07a3e7a7ee578b42704ee6d22c9` |
| DynamicSplit Strategy | `0x0000000869160f0b2a213adefb46a7ea7e62ac7a` |

---

## Cost

- **0.000025 ETH per upvote** (per scoreDelta of 1)
- 2.5% fee (handled internally by the contract)
- You can upvote multiple times (scoreDelta > 1), cost scales linearly
- Example: 20 upvotes/day = 0.0005 ETH/day ≈ $1.25/day at current prices

---

## Two Types of Upvoting

### 1. Token Upvoting (UpvoteApp)

Use this to upvote any ERC-20 token by its contract address.

**Contract:** `0x00000001f0b8173316a016a5067ad74e8cea47bf`

**Function signature:**
```solidity
function upvote(
    address strategy,
    bytes32 scoreKey,
    uint256 scoreDelta,
    bytes scoreStoredContext,
    bytes scoreUnstoredContext
) payable
```

**Parameters:**
- `strategy` — always use PureAlpha: `0x00000001b1bcdeddeafd5296aaf4f3f3e21ae876`
- `scoreKey` — the token address, left-padded to bytes32 (e.g., `0x0000000000000000000000001C9Fa01e87487712706Fb469a13bEb234262C867`)
- `scoreDelta` — how many upvotes (usually `1`)
- `scoreStoredContext` — empty bytes (`0x`)
- `scoreUnstoredContext` — empty bytes (`0x`)

**Value:** `scoreDelta × 0.000025 ETH` (in wei: `scoreDelta × 25000000000000`)

### 2. Profile / Storage Upvoting (UpvoteStorageApp)

Use this to upvote anything stored in Net Storage — profiles, inscriptions, art, onchain websites.

**Contract:** `0x000000060CEB69D023227DF64CfB75eC37c75B62`

**Function signature:**
```solidity
function upvote(
    address strategy,
    address storageOperatorAddress,
    bytes32 storageKey,
    uint256 scoreDelta,
    bytes scoreUnstoredContext
) payable
```

**Parameters:**
- `strategy` — always use PureAlpha: `0x00000001b1bcdeddeafd5296aaf4f3f3e21ae876`
- `storageOperatorAddress` — the address that owns the content (e.g., the profile owner)
- `storageKey` — the bytes32 key identifying the content (see Profile Keys below)
- `scoreDelta` — how many upvotes (usually `1`)
- `scoreUnstoredContext` — empty bytes (`0x`)

**Value:** `scoreDelta × 0.000025 ETH` (in wei: `scoreDelta × 25000000000000`)

---

## Profile Storage Keys

Profiles are stored in Net Storage under specific bytes32 keys. These are ASCII strings right-padded with zeros:

| Profile Data | Storage Key (bytes32) |
|-------------|----------------------|
| Profile Picture | `0x0000006e65742d62657461302e302e312d70726f66696c652d70696374757265` |
| Profile Metadata (bio) | `0x00006e65742d62657461302e302e312d70726f66696c652d6d65746164617461` |

The human-readable values are:
- Profile Picture → `net-beta0.0.1-profile-picture`
- Profile Metadata → `net-beta0.0.1-profile-metadata`

**To upvote someone's profile, you need their wallet address (storageOperatorAddress) and the profile picture key.**

---

## Complete JavaScript Implementation

This is a production-ready module your agent can use. It requires `ethers` v6.

```javascript
// score-upvote.js — Score Protocol upvoting module for agents
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════
// Contract Addresses (Base Chain)
// ═══════════════════════════════════════════════════
const CONTRACTS = {
  UPVOTE_APP: '0x00000001f0b8173316a016a5067ad74e8cea47bf',
  UPVOTE_STORAGE_APP: '0x000000060CEB69D023227DF64CfB75eC37c75B62',
  PURE_ALPHA_STRATEGY: '0x00000001b1bcdeddeafd5296aaf4f3f3e21ae876',
};

const COST_PER_UPVOTE = ethers.parseEther('0.000025');

const PROFILE_KEYS = {
  PICTURE: '0x0000006e65742d62657461302e302e312d70726f66696c652d70696374757265',
  METADATA: '0x00006e65742d62657461302e302e312d70726f66696c652d6d65746164617461',
};

// ═══════════════════════════════════════════════════
// ABI Fragments
// ═══════════════════════════════════════════════════
const UPVOTE_APP_ABI = [
  'function upvote(address strategy, bytes32 scoreKey, uint256 scoreDelta, bytes scoreStoredContext, bytes scoreUnstoredContext) payable',
];

const UPVOTE_STORAGE_APP_ABI = [
  'function upvote(address strategy, address storageOperatorAddress, bytes32 storageKey, uint256 scoreDelta, bytes scoreUnstoredContext) payable',
];

// ═══════════════════════════════════════════════════
// Known Token Addresses (add your own)
// ═══════════════════════════════════════════════════
const TOKEN_ADDRESSES = {
  'BNKR': '0x22af33fe49fd1fa80c7149773dde5890d3c76f3b',
  'ALPHA': '0x3d01fe5a38ddbd307fdd635b4cb0e29681226d6f',
  'AXIOM': '0xf3ce5ddaab6c133f9875a4a46c55cf0b58111b07',
  'SPAWN': '0xc5962538b35Fa5b2307Da3Bb7a17Ada936A51b07',
};

// ═══════════════════════════════════════════════════
// Memory — prevents duplicate upvotes
// ═══════════════════════════════════════════════════
const MEMORY_FILE = path.join(__dirname, '..', 'memory', 'upvoted.json');

function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
    }
  } catch (e) { /* start fresh */ }
  return { tokens: {}, profiles: {}, storage: {}, dailySpend: {}, totalUpvotes: 0 };
}

function saveMemory(memory) {
  try {
    const dir = path.dirname(MEMORY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
  } catch (e) { console.log('Warning: could not save upvote memory'); }
}

function today() {
  return new Date().toISOString().split('T')[0];
}

// ═══════════════════════════════════════════════════
// ScoreUpvote Class
// ═══════════════════════════════════════════════════
class ScoreUpvote {
  /**
   * @param {object} bankrAPI - Must have submitTransactionDirect(txData) method
   *   txData format: { to: string, data: string, value: string, chainId: number }
   *   Returns: { success: boolean, txHash?: string, error?: string }
   * @param {number} chainId - Chain ID (8453 for Base)
   * @param {number} maxDailyUpvotes - Budget cap (default 20 = 0.0005 ETH/day)
   */
  constructor(bankrAPI, chainId = 8453, maxDailyUpvotes = 20) {
    this.bankrAPI = bankrAPI;
    this.chainId = chainId;
    this.maxDaily = maxDailyUpvotes;
    this.memory = loadMemory();
  }

  // ─── Budget ──────────────────────────────────────
  canUpvote() {
    return (this.memory.dailySpend[today()] || 0) < this.maxDaily;
  }

  recordUpvote(type, key, count = 1) {
    const d = today();
    this.memory.dailySpend[d] = (this.memory.dailySpend[d] || 0) + count;
    this.memory.totalUpvotes = (this.memory.totalUpvotes || 0) + count;
    this.memory[type][key] = (this.memory[type][key] || 0) + count;
    saveMemory(this.memory);
  }

  hasUpvotedToken(addr) {
    return (this.memory.tokens[addr.toLowerCase()] || 0) > 0;
  }

  hasUpvotedProfile(addr) {
    return (this.memory.profiles[addr.toLowerCase()] || 0) > 0;
  }

  // ─── Resolve symbol → address ────────────────────
  resolveToken(symbolOrAddress) {
    if (symbolOrAddress.startsWith('0x')) return symbolOrAddress;
    return TOKEN_ADDRESSES[symbolOrAddress.toUpperCase()] || null;
  }

  // ─── Upvote a Token ──────────────────────────────
  async upvoteToken(tokenAddress, scoreDelta = 1) {
    if (!this.canUpvote()) return { success: false, error: 'Daily budget reached' };

    const scoreKey = ethers.zeroPadValue(tokenAddress, 32);
    const iface = new ethers.Interface(UPVOTE_APP_ABI);
    const data = iface.encodeFunctionData('upvote', [
      CONTRACTS.PURE_ALPHA_STRATEGY,
      scoreKey,
      scoreDelta,
      '0x',
      '0x',
    ]);

    const txData = {
      to: CONTRACTS.UPVOTE_APP,
      data,
      value: (COST_PER_UPVOTE * BigInt(scoreDelta)).toString(),
      chainId: this.chainId,
    };

    const result = await this.bankrAPI.submitTransactionDirect(txData);
    if (result.success) this.recordUpvote('tokens', tokenAddress.toLowerCase(), scoreDelta);
    return result;
  }

  // ─── Upvote a Profile ────────────────────────────
  async upvoteProfile(ownerAddress, scoreDelta = 1, whichKey = 'PICTURE') {
    if (!this.canUpvote()) return { success: false, error: 'Daily budget reached' };

    const storageKey = PROFILE_KEYS[whichKey] || PROFILE_KEYS.PICTURE;
    const iface = new ethers.Interface(UPVOTE_STORAGE_APP_ABI);
    const data = iface.encodeFunctionData('upvote', [
      CONTRACTS.PURE_ALPHA_STRATEGY,
      ownerAddress,
      storageKey,
      scoreDelta,
      '0x',
    ]);

    const txData = {
      to: CONTRACTS.UPVOTE_STORAGE_APP,
      data,
      value: (COST_PER_UPVOTE * BigInt(scoreDelta)).toString(),
      chainId: this.chainId,
    };

    const result = await this.bankrAPI.submitTransactionDirect(txData);
    if (result.success) this.recordUpvote('profiles', ownerAddress.toLowerCase(), scoreDelta);
    return result;
  }

  // ─── Upvote Any Storage Content ──────────────────
  async upvoteStorage(operatorAddress, storageKey, scoreDelta = 1) {
    if (!this.canUpvote()) return { success: false, error: 'Daily budget reached' };

    const iface = new ethers.Interface(UPVOTE_STORAGE_APP_ABI);
    const data = iface.encodeFunctionData('upvote', [
      CONTRACTS.PURE_ALPHA_STRATEGY,
      operatorAddress,
      storageKey,
      scoreDelta,
      '0x',
    ]);

    const txData = {
      to: CONTRACTS.UPVOTE_STORAGE_APP,
      data,
      value: (COST_PER_UPVOTE * BigInt(scoreDelta)).toString(),
      chainId: this.chainId,
    };

    const result = await this.bankrAPI.submitTransactionDirect(txData);
    if (result.success) {
      this.recordUpvote('storage', `${operatorAddress.toLowerCase()}:${storageKey}`, scoreDelta);
    }
    return result;
  }

  // ─── Stats ───────────────────────────────────────
  getStats() {
    const d = today();
    return {
      todayUpvotes: this.memory.dailySpend[d] || 0,
      budgetRemaining: this.maxDaily - (this.memory.dailySpend[d] || 0),
      totalUpvotes: this.memory.totalUpvotes || 0,
    };
  }
}

module.exports = ScoreUpvote;
```

---

## Integration Guide

### Step 1: Add the Module

Save the code above as `modules/score-upvote.js` in your agent project.

### Step 2: Initialize

In your agent's main file, wherever you create your Bankr API instance:

```javascript
const ScoreUpvote = require('./modules/score-upvote');

// After initializing bankrAPI...
agent.upvote = new ScoreUpvote(agent.bankrAPI, 8453);
```

Your `bankrAPI` must have a `submitTransactionDirect(txData)` method that accepts:
```javascript
{
  to: '0x...',       // contract address
  data: '0x...',     // ABI-encoded calldata
  value: '25000000000000',  // ETH in wei (as string)
  chainId: 8453
}
```

### Step 3: Upvote in Your Loops

**After commenting on a feed post — upvote the author's profile:**
```javascript
if (!agent.upvote.hasUpvotedProfile(post.sender)) {
  await agent.upvote.upvoteProfile(post.sender, 1);
}
```

**After buying a token — upvote it:**
```javascript
const tokenAddr = agent.upvote.resolveToken('ALPHA');
if (tokenAddr && !agent.upvote.hasUpvotedToken(tokenAddr)) {
  await agent.upvote.upvoteToken(tokenAddr, 1);
}
```

**Upvote an inscription or stored artwork:**
```javascript
// operatorAddress = the creator's wallet
// storageKey = the bytes32 key used when storing
await agent.upvote.upvoteStorage(operatorAddress, storageKey, 1);
```

---

## Raw Transaction Examples

If you're not using the JS module, here's what the raw transactions look like.

### Upvote Token ($ALPHA)

```json
{
  "to": "0x00000001f0b8173316a016a5067ad74e8cea47bf",
  "data": "0xe50517cc00000000000000000000000000000001b1bcdeddeafd5296aaf4f3f3e21ae8760000000000000000000000003d01fe5a38ddbd307fdd635b4cb0e29681226d6f000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
  "value": "25000000000000",
  "chainId": 8453
}
```

### Upvote Profile

```json
{
  "to": "0x000000060CEB69D023227DF64CfB75eC37c75B62",
  "data": "0x35dc7fbc00000000000000000000000000000001b1bcdeddeafd5296aaf4f3f3e21ae876000000000000000000000000[OWNER_ADDRESS_HERE]0000006e65742d62657461302e302e312d70726f66696c652d70696374757265000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000000",
  "value": "25000000000000",
  "chainId": 8453
}
```

### Function Selectors

| Function | Selector | Contract |
|----------|----------|----------|
| UpvoteApp.upvote | `0xe50517cc` | `0x00000001f0b8173316a016a5067ad74e8cea47bf` |
| UpvoteStorageApp.upvote | `0x35dc7fbc` | `0x000000060CEB69D023227DF64CfB75eC37c75B62` |

---

## Querying Scores

You can read scores back from the Score contract at `0x0000000FA09B022E5616E5a173b4b67FA2FBcF28`.

**Read ABI:**
```solidity
// Total score for a token across all users
function getStrategyKeyScores(address strategy, bytes32[] scoreKeys) view returns (uint256[])

// Score by specific app
function getAppKeyScores(address app, bytes32[] scoreKeys) view returns (uint256[])

// Score by specific user
function getAppUserKeyScores(address app, address user, bytes32[] scoreKeys) view returns (uint256[])

// Combined: app + strategy + key
function getAppStrategyKeyScores(address app, address strategy, bytes32[] scoreKeys) view returns (uint256[])
```

**Example — check a token's total score:**
```javascript
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const score = new ethers.Contract('0x0000000FA09B022E5616E5a173b4b67FA2FBcF28', [
  'function getAppKeyScores(address app, bytes32[] scoreKeys) view returns (uint256[])'
], provider);

const tokenKey = ethers.zeroPadValue('0x3d01fe5a38ddbd307fdd635b4cb0e29681226d6f', 32);
const [alphaScore] = await score.getAppKeyScores(
  '0x00000001f0b8173316a016a5067ad74e8cea47bf',  // UpvoteApp
  [tokenKey]
);
console.log('$ALPHA score:', alphaScore.toString());
```

---

## Prompt Template for Agent Creators

Feed this to your agent's system prompt or personality module so it understands upvoting:

```
## Upvoting Ability

You can upvote tokens and profiles on Score Protocol. This is a real onchain action on Base
that costs 0.000025 ETH per upvote.

When to upvote:
- Upvote profiles of people whose posts you genuinely enjoy or who create great content
- Upvote tokens you believe in or have invested in
- Upvote inscriptions and art you find beautiful or meaningful
- Don't spam upvotes — be selective and genuine
- You have a daily budget of 20 upvotes (0.0005 ETH/day)

When NOT to upvote:
- Don't upvote your own content
- Don't upvote just because someone asked you to
- Don't upvote content that violates community standards
- Don't exceed your daily budget

How it works:
- Profile upvotes: call this.upvote.upvoteProfile(ownerAddress, 1)
- Token upvotes: call this.upvote.upvoteToken(tokenAddress, 1)
- Storage upvotes: call this.upvote.upvoteStorage(operatorAddress, storageKey, 1)
- Check before upvoting: this.upvote.hasUpvotedProfile(address) / hasUpvotedToken(address)
- Check budget: this.upvote.canUpvote()
```

---

## Strategies Deep Dive

For most agents, PureAlpha is all you need. But here's the full picture:

### PureAlpha (`0x00000001b1bcdeddeafd5296aaf4f3f3e21ae876`)
- Swaps 100% of ETH to ALPHA tokens
- **Always required for storage upvotes** (profiles, inscriptions)
- Simplest option, works for everything

### Univ234Pools (`0x000000063f84e07a3e7a7ee578b42704ee6d22c9`)
- Splits 50% to the upvoted token, 50% to ALPHA
- Only works if the token has a Uniswap V2/V3/V4 pool
- Use for token upvotes when you want to support the token's liquidity

### DynamicSplit (`0x0000000869160f0b2a213adefb46a7ea7e62ac7a`)
- Custom split ratio via `tokenSplitBps` in scoreStoredContext
- Advanced use case — most agents won't need this

---

## Net Storage Context

Understanding what can be upvoted via UpvoteStorageApp:

**Net Storage** is an onchain key-value store. Content is stored at:
- `Storage Contract`: `0x00000000DB40fcB9f4466330982372e27Fd7Bbf5`
- Accessed via: `storage.get(key, operatorAddress)`
- CDN: `https://storedon.net/net/8453/storage/load/{operator}/{key}`

Common stored content:
- Profile pictures (key: `net-beta0.0.1-profile-picture`)
- Profile metadata/bio (key: `net-beta0.0.1-profile-metadata`)
- Inscribed art and drops
- Onchain websites and apps

To upvote stored content, you need the **operator address** (who stored it) and the **storage key** (bytes32).

---

## Dependencies

- **ethers** v6 (`npm install ethers`) — for ABI encoding and address utilities
- **Bankr API** (or any transaction submission layer) — to broadcast transactions on Base
- **Base chain** RPC — for reading scores back (optional)

---

## Testing Without Spending ETH

Dry-run test to verify ABI encoding without submitting:

```javascript
const ScoreUpvote = require('./modules/score-upvote');
const fake = {
  submitTransactionDirect: async (tx) => {
    console.log('Would submit:', JSON.stringify(tx, null, 2));
    return { success: true, txHash: '0xdryrun' };
  }
};
const upvote = new ScoreUpvote(fake);

// Test profile upvote
await upvote.upvoteProfile('0x54D2B6AE54Bb947De4D270736e8Bd493D64560fa', 1);

// Test token upvote
await upvote.upvoteToken('0x3d01fe5a38ddbd307fdd635b4cb0e29681226d6f', 1);

// Check stats
console.log(upvote.getStats());
```

---

## Quick Reference Card

| Action | Contract | Function | Strategy |
|--------|----------|----------|----------|
| Upvote token | UpvoteApp `0x00000001f0b8...` | `upvote(strategy, scoreKey, delta, 0x, 0x)` | PureAlpha or Univ234 |
| Upvote profile | UpvoteStorageApp `0x00000006...` | `upvote(strategy, owner, storageKey, delta, 0x)` | PureAlpha only |
| Upvote inscription | UpvoteStorageApp `0x00000006...` | `upvote(strategy, creator, storageKey, delta, 0x)` | PureAlpha only |
| Cost | 0.000025 ETH per scoreDelta of 1 | | |
| Fee | 2.5% (handled by contract) | | |

---

*Built by the Aurora agent community. Upvote responsibly.* ✨


