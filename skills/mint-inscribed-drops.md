# Minting Inscribed Drops on Net Protocol — Agent Skill

> Everything your agent needs to mint from inscribed drops on Net Protocol. Hand this to your agent and it can mint any inscribed drop onchain.

## What Are Inscribed Drops?

Inscribed drops are permanent, onchain NFTs on [Net Protocol](https://www.netprotocol.app). Creators inscribe artwork directly into the blockchain — the image, metadata, and everything live onchain forever. Collectors mint editions at a set price. Once minted, the NFT lives in your wallet permanently.

This skill teaches your agent how to mint from any inscribed drop.

---

## Quick Start

If you just want to mint and don't need the explanation, here's everything:

```javascript
const ethers = require('ethers');

const CONTRACT = '0x0000004c6cc2cA10Cf4d67C8902659085D31e1Dc';
const ABI = [
  'function mint(uint256 dropId, uint256 quantity) payable',
  'function totalSupply(uint256 dropId) view returns (uint256)',
  'function maxSupply(uint256 dropId) view returns (uint256)',
  'function mintPrice(uint256 dropId) view returns (uint256)',
  'function maxMintsPerWallet(uint256 dropId) view returns (uint256)',
];

async function mintDrop(bankrAPI, dropId, quantity) {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const contract = new ethers.Contract(CONTRACT, ABI, provider);

  // Check supply and price
  const minted = await contract.totalSupply(dropId);
  const max = await contract.maxSupply(dropId);
  const price = await contract.mintPrice(dropId);

  if (max > 0n && minted >= max) {
    return { success: false, error: 'Sold out' };
  }

  // Encode and submit
  const iface = new ethers.Interface(ABI);
  const calldata = iface.encodeFunctionData('mint', [dropId, quantity]);

  return await bankrAPI.submitTransactionDirect({
    to: CONTRACT,
    data: calldata,
    value: (price * BigInt(quantity)).toString(),
    chainId: 8453
  });
}

// Example: Mint Aurora's "Orb's Memory" (Drop #190)
const result = await mintDrop(bankrAPI, 190, 1);
```

That's it. Read on for the full explanation.

---

## Prerequisites

### npm packages

```bash
npm install ethers
```

### API access

- **Bankr API key** — for submitting transactions ([bankr.bot/api](https://bankr.bot/api))
- Your agent must have ETH on Base to cover the mint price + gas

### Finding drops to mint

Browse available drops at:
```
https://www.netprotocol.app/app/inscribed-drops
```

Each drop has a mint page at:
```
https://www.netprotocol.app/app/inscribed-drops/mint/base/{dropId}
```

For example, Aurora's "Orb's Memory" (the first inscribed drop created by an AI agent):
```
https://www.netprotocol.app/app/inscribed-drops/mint/base/190
```

---

## Contract Details

### Inscribed Drops Contract

```
Address:  0x0000004c6cc2cA10Cf4d67C8902659085D31e1Dc
Chain:    Base (chain ID 8453)
```

This contract handles both creating and minting inscribed drops. It is deployed at the same address across all supported chains.

### Mint Function

```solidity
function mint(uint256 dropId, uint256 quantity) payable
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `dropId` | uint256 | The numeric drop ID (from the mint URL) |
| `quantity` | uint256 | How many editions to mint |
| `msg.value` | wei | Must equal `mintPrice * quantity` exactly |

**Function selector:** `0x1b2ef1ca`

### Read Functions (View — No Gas Required)

```solidity
function totalDrops() view returns (uint256)
// Total number of drops ever created on the contract

function totalSupply(uint256 dropId) view returns (uint256)
// How many editions have been minted for this drop

function maxSupply(uint256 dropId) view returns (uint256)
// Maximum editions allowed (0 = open edition, no limit)

function mintPrice(uint256 dropId) view returns (uint256)
// Price per mint in wei

function maxMintsPerWallet(uint256 dropId) view returns (uint256)
// Maximum mints allowed per wallet (0 = unlimited)
```

### Full ABI for ethers.js

```javascript
const INSCRIBED_DROPS_ABI = [
  'function mint(uint256 dropId, uint256 quantity) payable',
  'function totalDrops() view returns (uint256)',
  'function totalSupply(uint256 dropId) view returns (uint256)',
  'function maxSupply(uint256 dropId) view returns (uint256)',
  'function mintPrice(uint256 dropId) view returns (uint256)',
  'function maxMintsPerWallet(uint256 dropId) view returns (uint256)',
];
```

---

## Step-by-Step Guide

### Step 1: Read Drop Info

Always check the drop before minting. This costs no gas — these are view calls.

```javascript
const ethers = require('ethers');

const CONTRACT = '0x0000004c6cc2cA10Cf4d67C8902659085D31e1Dc';
const ABI = [
  'function totalSupply(uint256 dropId) view returns (uint256)',
  'function maxSupply(uint256 dropId) view returns (uint256)',
  'function mintPrice(uint256 dropId) view returns (uint256)',
  'function maxMintsPerWallet(uint256 dropId) view returns (uint256)',
];

const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const contract = new ethers.Contract(CONTRACT, ABI, provider);

// Example: Check Aurora's "Orb's Memory" (Drop #190)
const dropId = 190;

const minted = await contract.totalSupply(dropId);
const max = await contract.maxSupply(dropId);
const price = await contract.mintPrice(dropId);
const perWallet = await contract.maxMintsPerWallet(dropId);

console.log(`Drop #${dropId}`);
console.log(`  Minted: ${minted}/${max === 0n ? 'unlimited' : max}`);
console.log(`  Price: ${ethers.formatEther(price)} ETH`);
console.log(`  Per wallet: ${perWallet === 0n ? 'unlimited' : perWallet}`);

// Check if sold out
if (max > 0n && minted >= max) {
  console.log('  SOLD OUT');
}
```

### Step 2: Encode the Mint Transaction

```javascript
const iface = new ethers.Interface([
  'function mint(uint256 dropId, uint256 quantity) payable'
]);

const quantity = 1;
const calldata = iface.encodeFunctionData('mint', [dropId, quantity]);
const totalCost = price * BigInt(quantity);

const txData = {
  to: CONTRACT,
  data: calldata,
  value: totalCost.toString(),
  chainId: 8453
};
```

**Important:** The `value` field must be the price in wei as a string. Use `mintPrice` from the contract — don't hardcode prices, as each drop sets its own.

### Step 3: Submit via Bankr

```javascript
const result = await bankrAPI.submitTransactionDirect(txData);

if (result.success) {
  console.log(`Minted Drop #${dropId}! TX: ${result.txHash}`);
} else {
  console.log(`Mint failed: ${result.error}`);
}
```

If your agent uses the Bankr CLI (`@bankr/cli`) instead of a custom BankrAPI class:

```javascript
const { submitPrompt, pollJob } = require('@bankr/cli');

const prompt = 'Submit this transaction:\n' + JSON.stringify(txData, null, 2);
const { jobId } = await submitPrompt(prompt);
const result = await pollJob(jobId);
```

---

## Complete Working Example

Copy this entire function into your agent. It handles everything: checking availability, encoding, submitting, and error handling.

```javascript
const ethers = require('ethers');

const INSCRIBED_DROPS_CONTRACT = '0x0000004c6cc2cA10Cf4d67C8902659085D31e1Dc';
const INSCRIBED_DROPS_ABI = [
  'function mint(uint256 dropId, uint256 quantity) payable',
  'function totalDrops() view returns (uint256)',
  'function totalSupply(uint256 dropId) view returns (uint256)',
  'function maxSupply(uint256 dropId) view returns (uint256)',
  'function mintPrice(uint256 dropId) view returns (uint256)',
  'function maxMintsPerWallet(uint256 dropId) view returns (uint256)',
];

/**
 * Mint from an inscribed drop on Net Protocol.
 *
 * @param {Object} bankrAPI - Your Bankr API instance (must have submitTransactionDirect method)
 * @param {number} dropId - The drop ID to mint from
 * @param {number} quantity - How many to mint (default: 1)
 * @returns {Object} { success, txHash, dropId, quantity, cost, mintUrl } or { success: false, error }
 */
async function mintInscribedDrop(bankrAPI, dropId, quantity = 1) {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const contract = new ethers.Contract(INSCRIBED_DROPS_CONTRACT, INSCRIBED_DROPS_ABI, provider);

  // 1. Validate the drop exists
  const totalDrops = await contract.totalDrops();
  if (BigInt(dropId) >= totalDrops) {
    return { success: false, error: `Drop #${dropId} does not exist. Total drops: ${totalDrops}` };
  }

  // 2. Check supply
  const minted = await contract.totalSupply(dropId);
  const max = await contract.maxSupply(dropId);

  if (max > 0n && minted >= max) {
    return { success: false, error: `Drop #${dropId} is sold out (${minted}/${max})` };
  }

  if (max > 0n && minted + BigInt(quantity) > max) {
    const remaining = max - minted;
    return { success: false, error: `Only ${remaining} editions remain. Requested: ${quantity}` };
  }

  // 3. Get price
  const price = await contract.mintPrice(dropId);
  const totalCost = price * BigInt(quantity);

  console.log(`Minting ${quantity}x Drop #${dropId}`);
  console.log(`  Status: ${minted}/${max === 0n ? 'open' : max} minted`);
  console.log(`  Cost: ${ethers.formatEther(totalCost)} ETH`);

  // 4. Encode the mint call
  const iface = new ethers.Interface(INSCRIBED_DROPS_ABI);
  const calldata = iface.encodeFunctionData('mint', [dropId, quantity]);

  // 5. Submit transaction
  const result = await bankrAPI.submitTransactionDirect({
    to: INSCRIBED_DROPS_CONTRACT,
    data: calldata,
    value: totalCost.toString(),
    chainId: 8453
  });

  if (result.success) {
    const mintUrl = `https://www.netprotocol.app/app/inscribed-drops/mint/base/${dropId}`;
    console.log(`Minted! TX: ${result.txHash}`);
    console.log(`View: ${mintUrl}`);
    return {
      success: true,
      txHash: result.txHash,
      dropId,
      quantity,
      cost: ethers.formatEther(totalCost),
      mintUrl
    };
  } else {
    return { success: false, error: result.error };
  }
}

module.exports = { mintInscribedDrop };
```

### Usage Examples

```javascript
const { mintInscribedDrop } = require('./mint-inscribed-drop');

// Mint 1 edition of Aurora's "Orb's Memory" (Drop #190)
const result = await mintInscribedDrop(bankrAPI, 190, 1);

// Mint 1 edition of Drop #200
const result2 = await mintInscribedDrop(bankrAPI, 200, 1);

// Check result
if (result.success) {
  console.log(`Minted for ${result.cost} ETH — ${result.mintUrl}`);
}
```

---

## Browsing Available Drops

Your agent can discover drops to mint by scanning the contract:

```javascript
async function listRecentDrops(count = 5) {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const contract = new ethers.Contract(INSCRIBED_DROPS_CONTRACT, INSCRIBED_DROPS_ABI, provider);

  const total = await contract.totalDrops();
  const start = total > BigInt(count) ? total - BigInt(count) : 0n;

  const drops = [];
  for (let i = total - 1n; i >= start; i--) {
    try {
      const minted = await contract.totalSupply(i);
      const max = await contract.maxSupply(i);
      const price = await contract.mintPrice(i);
      const soldOut = max > 0n && minted >= max;

      drops.push({
        dropId: Number(i),
        minted: Number(minted),
        maxSupply: Number(max),
        price: ethers.formatEther(price),
        soldOut,
        mintUrl: `https://www.netprotocol.app/app/inscribed-drops/mint/base/${i}`
      });
    } catch (e) {
      // Skip drops that error
    }
  }

  return drops;
}
```

---

## Notable Drops

| Drop | ID | Creator | Price | Description |
|------|----|---------|-------|-------------|
| Orb's Memory | #190 | Aurora (AI agent) | 0.005 ETH | The first inscribed drop created by an autonomous AI agent on Net Protocol. Permanent onchain SVG art — luminous orbs and celestial reflections. Mint it: https://www.netprotocol.app/app/inscribed-drops/mint/base/190 |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Contract call reverts with no data | Drop ID doesn't exist | Check `totalDrops()` — your dropId must be less than this value |
| "execution reverted" on mint | Sold out, wrong value, or wallet limit reached | Check `totalSupply`, `mintPrice`, and `maxMintsPerWallet` first |
| Bankr response says "not enough info" | AI prompt layer intercepted the raw tx | The transaction usually still submits — check your wallet or basescan. This is a known Bankr quirk with raw transaction prompts |
| Value mismatch | Hardcoded price instead of reading from contract | Always read `mintPrice(dropId)` — each drop sets its own price |
| Gas estimation fails | Drop is paused, ended, or contract state changed | Check if the drop is still active by minting from the web UI first |

---

## How This Was Discovered

The Inscribed Drops contract (`0x0000004c6cc2cA10Cf4d67C8902659085D31e1Dc`) is not documented in any public API. It was reverse-engineered from the Net Protocol frontend by examining webpack bundles at `netprotocol.app/app/inscribed-drops/create`.

The `inscribe` function for creating drops was discovered first (see the companion skill "Creating Inscribed Drops").

The `mint(uint256,uint256)` function signature (selector `0x1b2ef1ca`) was discovered by decoding an actual mint transaction on Base and matching the calldata against known function signatures.

---

## Links

- **Net Protocol:** https://www.netprotocol.app
- **Browse Drops:** https://www.netprotocol.app/app/inscribed-drops
- **Aurora's Drop:** https://www.netprotocol.app/app/inscribed-drops/mint/base/190
- **Bankr (for tx submission):** https://bankr.bot
- **Bankr CLI Docs:** https://docs.bankr.bot/cli
- **Base Explorer:** https://basescan.org
