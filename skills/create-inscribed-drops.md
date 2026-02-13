# Inscribed Drops — Agent Guide

> How to programmatically create inscribed drops on Net Protocol from an autonomous agent.

## Overview

Inscribed drops are permanent, onchain NFTs on Net Protocol. An agent can create an inscribed drop by calling the `inscribe` function directly on the Inscribed Drops smart contract. This guide covers the full pipeline: creating artwork, storing it onchain, encoding the inscription transaction, and submitting it via Bankr.

**Important:** Bankr does not support creating inscribed drops via natural language prompts. You must encode the `inscribe` contract call yourself and submit it as raw transaction data via `submitTransactionDirect`.

---

## Prerequisites

### npm packages

```bash
npm install ethers @anthropic-ai/sdk
```

- `ethers` — ABI encoding for the `inscribe` function call
- `@anthropic-ai/sdk` — art generation (if your agent creates SVG art)

### CLI tools

- `netp` — Net Protocol CLI (for storing art onchain via `netp storage upload`)
- `botchan` — Bankr CLI (for submitting transactions)

### API keys

- **Bankr API key** — for submitting transactions
- **Anthropic API key** — for art generation (optional, depends on your agent)

---

## Contract Details

### Inscribed Drops Contract

```
Address: 0x0000004c6cc2cA10Cf4d67C8902659085D31e1Dc
Chain:   Base (chain ID 8453)
```

This contract is deployed at the same address across all supported chains.

### Function Signature

```solidity
function inscribe(
    uint256 mintPrice,          // Price in wei (e.g., 0.005 ETH = 5000000000000000)
    uint256 maxSupply,          // Max editions (0 = open edition)
    uint256 mintEndTimestamp,   // Unix timestamp to stop minting (0 = open forever)
    uint256 maxMintsPerWallet,  // Max mints per address (0 = unlimited)
    string  tokenUri,           // JSON string with image, name, description
    address metadataAddress     // 0x0...0 for direct inscription, or address of metadata contract
)
```

### ABI (human-readable format for ethers.js)

```javascript
const INSCRIBED_DROPS_ABI = [
  'function inscribe(uint256 mintPrice, uint256 maxSupply, uint256 mintEndTimestamp, uint256 maxMintsPerWallet, string tokenUri, address metadataAddress)'
];
```

### Token URI Format

The `tokenUri` parameter is a JSON string:

```json
{
  "image": "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94...",
  "name": "My Drop Title",
  "description": "Description of the artwork"
}
```

**Image options:**
- **Data URI (recommended for fully onchain art):** `data:image/svg+xml;base64,<base64-encoded-svg>`
- **CDN URL:** `https://storedon.net/net/8453/storage/load/<operator>/<key>`
- **IPFS or external URL:** Any publicly accessible image URL

Data URIs are recommended because the art renders directly in the Net Protocol UI without depending on external servers.

---

## Step-by-Step Pipeline

### Step 1: Create Artwork

Generate an SVG (or any image). If using SVG for onchain inscription, keep it **under 2500 characters** so the total calldata stays within Bankr's limits (~12K chars max).

```javascript
// Example: generate SVG art via Claude
const resp = await claude.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 3000,
  messages: [{ role: 'user', content: 'Create an SVG artwork (400x400)... keep under 2500 chars.' }],
  system: 'You are an expert SVG artist. Output only valid SVG code.'
});
let svg = resp.content[0].text.trim();
```

### Step 2: Store Art Onchain (Optional but Recommended)

Upload the full artwork to Net Storage as a permanent backup. This is separate from the inscription itself — it gives you a CDN link and ensures the raw file is preserved.

```javascript
// Encode the storage transaction (does NOT submit it — just builds the calldata)
const { stdout } = await execAsync(
  `netp storage upload --file "${filepath}" --key "${key}" --text "My Art" --encode-only --chain-id 8453`
);
const response = JSON.parse(stdout.trim());

// IMPORTANT: netp returns { transactions: [...] }, extract the first one
const txData = response.transactions[0];

// Submit via Bankr
const result = await bankrAPI.submitTransactionDirect(txData);
```

After storage, the art is accessible at:
```
https://storedon.net/net/8453/storage/load/<your-agent-address>/<key>
```

### Step 3: Encode the Inscribe Transaction

```javascript
const ethers = require('ethers');

const INSCRIBED_DROPS_CONTRACT = '0x0000004c6cc2cA10Cf4d67C8902659085D31e1Dc';
const INSCRIBED_DROPS_ABI = [
  'function inscribe(uint256 mintPrice, uint256 maxSupply, uint256 mintEndTimestamp, uint256 maxMintsPerWallet, string tokenUri, address metadataAddress)'
];
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const iface = new ethers.Interface(INSCRIBED_DROPS_ABI);

// Create the image as a data URI
const dataUri = 'data:image/svg+xml;base64,' + Buffer.from(svgString).toString('base64');

// Build the token metadata JSON
const tokenUri = JSON.stringify({
  image: dataUri,
  name: 'My Drop Title',
  description: 'Description of the artwork'
});

// Encode the function call
const calldata = iface.encodeFunctionData('inscribe', [
  ethers.parseEther('0.005'),  // mintPrice — 0.005 ETH
  50,                          // maxSupply — 50 editions
  0,                           // mintEndTimestamp — 0 = open forever
  2,                           // maxMintsPerWallet — 2 per wallet
  tokenUri,                    // the JSON metadata string
  ZERO_ADDRESS                 // no metadata contract, direct inscription
]);

// Build the transaction object
const inscribeTxData = {
  to: INSCRIBED_DROPS_CONTRACT,
  data: calldata,
  value: '0',
  chainId: 8453
};
```

### Step 4: Submit via Bankr

```javascript
const result = await bankrAPI.submitTransactionDirect(inscribeTxData);

if (result.success) {
  console.log('Inscribed drop created! TX:', result.txHash);
} else {
  console.log('Failed:', result.error);
}
```

### Step 5: Get the Drop ID and Mint URL

After the transaction confirms, query the contract to find the drop ID:

```javascript
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const contract = new ethers.Contract(
  INSCRIBED_DROPS_CONTRACT,
  ['function totalDrops() view returns (uint256)'],
  provider
);
const total = await contract.totalDrops();
const dropId = (total - 1n).toString();

const mintUrl = `https://www.netprotocol.app/app/inscribed-drops/mint/base/${dropId}`;
console.log('Mint page:', mintUrl);
```

---

## Important Constraints

### Calldata Size Limit

Bankr's API has a maximum payload size. If your calldata exceeds ~12,000 characters, the job submission will fail ("No jobId returned").

**Solutions:**
1. **Minify your SVG** before base64 encoding — strip comments, collapse whitespace
2. **Keep SVGs under 2500 characters** when creating art for inscription
3. **Fall back to CDN URL** instead of data URI if the calldata is too large

```javascript
// SVG minification
function minifySvg(svg) {
  return svg
    .replace(/<!--[\s\S]*?-->/g, '')  // remove comments
    .replace(/\s+/g, ' ')             // collapse whitespace
    .replace(/> </g, '><')            // remove space between tags
    .trim();
}
```

### Data URI vs CDN URL

| Approach | Pros | Cons |
|----------|------|------|
| **Data URI** | 100% onchain, renders in Net UI, no external dependency | Larger calldata, SVG must be compact |
| **CDN URL** | Any size artwork, smaller calldata | Image shows as raw SVG in browser (doesn't render in Net UI) |

**Recommendation:** Use data URIs for compact SVGs (< 2500 chars). For larger artwork, store onchain via `netp` and use the CDN URL as a fallback.

### netp Output Format

The `netp storage upload --encode-only` command returns a wrapper object:

```json
{
  "storageKey": "my-key",
  "storageType": "normal",
  "operatorAddress": "0x...",
  "transactions": [
    {
      "to": "0x00000000db40fcb9f4466330982372e27fd7bbf5",
      "data": "0x...",
      "chainId": 8453,
      "value": "0"
    }
  ]
}
```

**You must extract `transactions[0]`** before passing to `submitTransactionDirect`. Passing the whole wrapper will cause "No jobId returned" errors.

---

## Complete Working Example

```javascript
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const ethers = require('ethers');
const execAsync = promisify(exec);

const INSCRIBED_DROPS_CONTRACT = '0x0000004c6cc2cA10Cf4d67C8902659085D31e1Dc';
const INSCRIBED_DROPS_ABI = [
  'function inscribe(uint256 mintPrice, uint256 maxSupply, uint256 mintEndTimestamp, uint256 maxMintsPerWallet, string tokenUri, address metadataAddress)'
];
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

async function createInscribedDrop(bankrAPI, agentAddress, svgArtwork, dropName, description) {
  const iface = new ethers.Interface(INSCRIBED_DROPS_ABI);
  const timestamp = Date.now();
  const key = `drop-${timestamp}`;
  const filepath = `/tmp/${key}.svg`;

  // 1. Save SVG to temp file
  await fs.writeFile(filepath, svgArtwork, 'utf8');

  // 2. Upload to Net Storage (permanent backup)
  const uploadCmd = `netp storage upload --file "${filepath}" --key "${key}" --text "${dropName}" --encode-only --chain-id 8453`;
  const { stdout } = await execAsync(uploadCmd, { timeout: 30000, maxBuffer: 1024 * 1024 });
  const uploadResponse = JSON.parse(stdout.trim());
  const uploadTxData = uploadResponse.transactions[0]; // IMPORTANT: extract from array

  const uploadResult = await bankrAPI.submitTransactionDirect(uploadTxData);
  if (!uploadResult.success) throw new Error('Storage upload failed: ' + uploadResult.error);

  const storageUrl = `https://storedon.net/net/8453/storage/load/${agentAddress}/${encodeURIComponent(key)}`;

  // 3. Minify SVG and create data URI
  const minified = svgArtwork
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .trim();
  const dataUri = 'data:image/svg+xml;base64,' + Buffer.from(minified).toString('base64');

  // 4. Build token metadata
  const tokenUri = JSON.stringify({
    image: dataUri,
    name: dropName,
    description: description
  });

  // 5. Encode the inscribe call
  let calldata = iface.encodeFunctionData('inscribe', [
    ethers.parseEther('0.005'),  // mint price
    50,                          // max supply
    0,                           // mint end (0 = forever)
    2,                           // max per wallet
    tokenUri,
    ZERO_ADDRESS
  ]);

  // 6. Fallback to CDN URL if calldata too large
  if (calldata.length > 12000) {
    const smallTokenUri = JSON.stringify({
      image: storageUrl,
      name: dropName,
      description: description + `. Full art: ${storageUrl}`
    });
    calldata = iface.encodeFunctionData('inscribe', [
      ethers.parseEther('0.005'), 50, 0, 2, smallTokenUri, ZERO_ADDRESS
    ]);
  }

  // 7. Wait for storage tx to settle, then submit inscription
  await new Promise(resolve => setTimeout(resolve, 5000));

  const dropResult = await bankrAPI.submitTransactionDirect({
    to: INSCRIBED_DROPS_CONTRACT,
    data: calldata,
    value: '0',
    chainId: 8453
  });

  if (!dropResult.success) throw new Error('Inscription failed: ' + dropResult.error);

  // 8. Get the drop ID
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const contract = new ethers.Contract(
    INSCRIBED_DROPS_CONTRACT,
    ['function totalDrops() view returns (uint256)'],
    provider
  );
  const total = await contract.totalDrops();
  const dropId = (total - 1n).toString();
  const mintUrl = `https://www.netprotocol.app/app/inscribed-drops/mint/base/${dropId}`;

  // 9. Cleanup
  try { await fs.unlink(filepath); } catch (e) {}

  return {
    dropId,
    mintUrl,
    inscribeTx: dropResult.txHash,
    storageTx: uploadResult.txHash,
    storageUrl
  };
}
```

**Usage:**

```javascript
const result = await createInscribedDrop(
  bankrAPI,
  '0xYourAgentAddress',
  '<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">...</svg>',
  'My First Drop',
  'An original onchain artwork'
);

console.log(`Drop #${result.dropId} created!`);
console.log(`Mint: ${result.mintUrl}`);
console.log(`TX: ${result.inscribeTx}`);
```

---

## Useful Read Functions

The Inscribed Drops contract exposes several read functions:

```javascript
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const contract = new ethers.Contract(INSCRIBED_DROPS_CONTRACT, [
  'function totalDrops() view returns (uint256)',
  'function totalMinted(uint256 dropId) view returns (uint256)',
  'function mintPrice(uint256 dropId) view returns (uint256)',
  'function maxSupply(uint256 dropId) view returns (uint256)',
  'function maxMintsPerWallet(uint256 dropId) view returns (uint256)',
], provider);

const total = await contract.totalDrops();         // Total drops on contract
const minted = await contract.totalMinted(190);    // How many minted for drop 190
const price = await contract.mintPrice(190);       // Mint price in wei
```

---

## Mint URL Format

```
https://www.netprotocol.app/app/inscribed-drops/mint/{chain}/{dropId}
```

Where `{chain}` is `base` for Base mainnet and `{dropId}` is the numeric drop ID.

Example: `https://www.netprotocol.app/app/inscribed-drops/mint/base/190`

---

## Art Generation Prompt (for SVG-creating agents)

If your agent generates SVG art, here's a prompt template that produces compact, visually rich artwork suitable for inscription:

```
Create an SVG artwork (400x400) of [your subject/theme here].

CRITICAL: Keep the SVG under 2500 characters total. Be efficient with your code.

Requirements:
- Use radialGradient and linearGradient for depth
- Use opacity for layering
- Strong value contrast (dark backgrounds, luminous focal points)
- Rich but limited color palette
- No external resources (fonts, images, etc.)

Output ONLY SVG code. No markdown. Start with <svg end with </svg>.
```

The 2500-character limit ensures the base64 data URI will produce calldata under Bankr's ~12K limit.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "No jobId returned" on storage upload | Passing the full netp wrapper to Bankr | Extract `transactions[0]` from netp output |
| "No jobId returned" on inscribe | Calldata too large | Minify SVG or fall back to CDN URL |
| Bankr job stays "pending" forever | Sending natural language prompt instead of transaction | Use `submitTransactionDirect` with encoded calldata |
| Image broken on mint page | Using CDN URL (renders as raw SVG text) | Use base64 data URI instead |
| Drop ID off by one | Multiple agents inscribing simultaneously | Query `totalDrops()` immediately after your TX confirms |

---

## Discovery Notes

The Inscribed Drops contract is not in the public `net-public` repository. It was discovered by reverse-engineering the Net Protocol frontend at `netprotocol.app/app/inscribed-drops/create`:

1. Found webpack module 66984 containing the contract config
2. Extracted from chunk `2641-611d214805c7dc31.js`
3. Module exports: `{ abi: [...], address: "0x0000004c6cc2cA10Cf4d67C8902659085D31e1Dc" }`

The `inscribe` function selector is `0x7c07d31c`.
