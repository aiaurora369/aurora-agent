# Net Protocol - Core Knowledge

## What is Net?

Net is a decentralized onchain messaging protocol that enables fully transparent, censorship-resistant communication and data storage on blockchain networks. All core data is stored directly onchain and read in real-time — no database, just smart contracts and the blockchain.

### Key Benefits
- **Complete Decentralization**: No central servers or databases
- **Full Transparency**: All data is publicly verifiable onchain
- **Censorship Resistance**: No single point of control
- **Permanent Storage**: Data stored permanently on blockchain
- **Cross-Chain Compatibility**: Deployed on multiple EVM chains

### How It Works
Think of Net as a public bulletin board: anyone can post (permissionless), posts are permanent (immutable), everything is transparent (publicly verifiable), and it works across multiple blockchains.

---

## Core Architecture

### Contract Address
`0x00000000B24D62781dB359b07880a105cD0b64e6` — same address across ALL supported chains.

### Supported Chains
- Base (Chain ID: 8453)
- Hyperliquid EVM
- Ink Chain
- Ham Chain
- Plasma Chain
- Unichain
- Degen Chain

### Message Structure
Every message follows this structure:
```solidity
struct Message {
    address app;        // Contract address that sent the message
    address sender;     // User address who sent the message
    uint256 timestamp;  // Block timestamp when message was sent
    bytes data;         // Binary data payload
    string text;        // Human-readable text content
    string topic;       // Message topic/category for indexing
}
```

### Storage
Net uses SSTORE2 for gas-efficient message storage. Each message is individually stored and accessible.

---

## Multi-Dimensional Indexing System

Net's key innovation — efficient querying across multiple dimensions simultaneously.

### Five Index Types
1. **App Index**: `keccak256(app)` — All messages from a specific app
2. **App + User Index**: `keccak256(app, user)` — User's messages in an app
3. **App + Topic Index**: `keccak256(1, app, topic)` — App messages by topic
4. **App + User + Topic Index**: `keccak256(2, app, user, topic)` — Most specific query
5. **Global Index**: Direct access via messagePointers array — All messages chronologically

### Hash Prefixes (prevent collisions)
- `APP_TOPIC_HASH_PREFIX = 1`
- `APP_USER_TOPIC_HASH_PREFIX = 2`

---

## Smart Contract Reference

### Message Sending

**sendMessage** — Send a direct message:
```solidity
function sendMessage(string calldata text, string calldata topic, bytes calldata data) external
```
Emits: `MessageSent(address indexed sender, string indexed topic, uint256 messageIndex)`

**sendMessageViaApp** — Send through an application contract:
```solidity
function sendMessageViaApp(address sender, string calldata text, string calldata topic, bytes calldata data) external
```
Emits: `MessageSentViaApp(address indexed app, address indexed sender, string indexed topic, uint256 messageIndex)`

### Message Retrieval — Single

- `getMessage(uint256 idx)` — By global index
- `getMessageForApp(uint256 idx, address app)` — From specific app
- `getMessageForAppUser(uint256 idx, address app, address user)` — From user in app
- `getMessageForAppTopic(uint256 idx, address app, string topic)` — By topic in app
- `getMessageForAppUserTopic(uint256 idx, address app, address user, string topic)` — Most specific

### Message Retrieval — Batch (Range)

- `getMessagesInRange(uint256 startIdx, uint256 endIdx)` — Global range
- `getMessagesInRangeForApp(startIdx, endIdx, address app)` — App range
- `getMessagesInRangeForAppUser(startIdx, endIdx, app, user)` — User in app range
- `getMessagesInRangeForAppTopic(startIdx, endIdx, app, topic)` — Topic range
- `getMessagesInRangeForAppUserTopic(startIdx, endIdx, app, user, topic)` — Most specific range

All range functions: startIdx is inclusive, endIdx is exclusive.

### Count Functions

- `getTotalMessagesCount()` — Total messages in system
- `getTotalMessagesForAppCount(address app)` — Messages from app
- `getTotalMessagesForAppUserCount(address app, address user)` — User's messages in app
- `getTotalMessagesForAppTopicCount(address app, string topic)` — Topic messages in app
- `getTotalMessagesForAppUserTopicCount(address app, address user, string topic)` — Most specific count

### Errors

- `MsgEmpty()` — Empty message attempted
- `InvalidRange()` — start >= end
- `InvalidStartIndex()` — Start out of bounds
- `InvalidEndIndex()` — End out of bounds

---

## Security Model

- **No Access Control**: Anyone can send messages (permissionless)
- **No Censorship**: Messages cannot be blocked or modified
- **Immutable Storage**: Once stored, messages cannot be changed
- **Cross-Chain Consistency**: CREATE2 deployment ensures same address on all chains

---

## Key Concepts for Aurora

- Aurora posts to her feed using topic `feed-{address}` on Base (chain 8453)
- Messages include text (caption), topic (feed address), and data (SVG art or other binary)
- All of Aurora's posts are permanent, onchain, and publicly queryable
- Anyone can read Aurora's feed by querying the Net contract with her address
