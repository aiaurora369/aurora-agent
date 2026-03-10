# Wallet Bridge - Wallet Interaction for Onchain HTML

## Overview

Wallet Bridge is a feature of the Net website's storage content renderer that enables HTML content stored in Net Storage to securely interact with the user's connected wallet. It provides a `window.wallet` object inside iframes displaying stored HTML content.

**Important**: Wallet Bridge is a renderer feature, not part of the Storage protocol itself.

---

## When Available

Wallet Bridge is only available when:
- Net website's storage renderer has wallet bridge enabled (default on storage pages)
- User has a wallet connected
- Content is HTML rendered in an iframe

If not available, `window.wallet` will be `undefined`.

---

## Security Model

- Secure `postMessage`-based communication between iframe and parent
- Origin validation (only `blob:` and same-origin accepted)
- Request ID and timestamp validation (30s timeout)
- **User confirmation dialogs for ALL wallet operations**
- Iframe ID isolation prevents duplicate dialogs

---

## Available Functions

### getAccount()
Returns connected wallet address.
```javascript
const account = await window.wallet.getAccount();
// "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
```

### getChainId()
Returns current chain ID.
```javascript
const chainId = await window.wallet.getChainId();
// 8453 (Base)
```

### getBalance()
Returns wallet balance in wei.
```javascript
const balance = await window.wallet.getBalance();
```

### signMessage(message)
Signs a message. Returns signature string.
```javascript
const signature = await window.wallet.signMessage("Hello, Net Protocol!");
```

### signTypedData(typedData)
Signs EIP-712 typed data. Returns signature string.
```javascript
const signature = await window.wallet.signTypedData({
  domain: { name: "Net Protocol", version: "1", chainId: 8453, verifyingContract: "0x..." },
  types: { Message: [{ name: "content", type: "string" }, { name: "timestamp", type: "uint256" }] },
  primaryType: "Message",
  message: { content: "Hello!", timestamp: Math.floor(Date.now() / 1000) }
});
```

### sendTransaction(params)
Sends a transaction. Returns transaction hash.
```javascript
const hash = await window.wallet.sendTransaction({
  to: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
  value: "1000000000000000",  // 0.001 ETH in wei
  data: "0x..."               // Optional calldata
});
```

### encodeFunctionCall(abi, functionName, params)
Encodes Solidity function call into calldata. Returns `{ calldata, warning }`.
```javascript
const result = await window.wallet.encodeFunctionCall(
  [{ type: "function", name: "transfer", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }] }],
  "transfer",
  ["0x1234...", "1000000000000000000"]
);
// Use result.calldata in sendTransaction
```

---

## Error Types

- `WALLET_NOT_CONNECTED` — No wallet connected
- `USER_REJECTED` — User cancelled operation
- `INVALID_INPUT` — Invalid parameters
- `SIGN_FAILED` — Signing failed
- `SEND_FAILED` — Transaction submission failed
- `ENCODING_FAILED` — Function encoding failed
```javascript
try {
  const account = await window.wallet.getAccount();
} catch (error) {
  console.error("Error:", error.message);
}
```

---

## Use Cases

- Interactive dApps stored in Net Storage
- Onchain games and applications
- Wallet-enabled web content
- Custom transaction interfaces (e.g., upvoting, minting)

---

## For Aurora

- Wallet Bridge enables interactive HTML art stored on Net
- Aurora could create stored HTML pages that interact with viewers' wallets
- Enables possibilities like onchain art that responds to the collector
- All wallet operations require explicit user confirmation for security
