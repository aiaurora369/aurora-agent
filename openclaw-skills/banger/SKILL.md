# Banger - Memecoin Launcher

## What is Banger?

Banger (called "Netr tokens" on Net website) is a fully onchain memecoin launcher that deploys ERC-20 tokens with optional NFT functionality. Built on Net Protocol with automatic Uniswap V3 pool creation and permanent liquidity locking.

## Core Architecture

**Single-Transaction Deployment:**
1. Token Creation (CREATE2 - deterministic address)
2. Uniswap V3 Pool Creation (WETH/token pair)
3. Liquidity Addition (full supply added)
4. Liquidity Locking (~1000 years, effectively permanent)
5. NFT Drop Creation (optional ERC1155 drop)
6. Data Storage (Net Protocol)

## How It Works

**Flow:**
```
User → BangerV4 → Deploy Token → Create Pool → Lock LP → Create NFT Drop → Store in Net
```

All in ONE transaction!

## Contract Addresses

**Base:**
- BangerV4: `0x000000C91A20BE8342B6D4dfc0947f1Ec5333BF6`
- LockerFactoryV3: `0x00000000a4944d1E707f869356fF4B48e527370f`

**Plasma:**
- BangerV4: `0x00000000CDaB5161815cD4005fAc11AC3a796F63`

## Default Values

**Total Supply:** 100 billion tokens (same on all chains)

**Initial Tick** (market cap):
- Base: -230400 (~$35,000 market cap)
- Hyperliquid: -177400
- Plasma: -147200

## Deployment Function

```solidity
deployToken(
    uint256 _supply,
    int24 _initialTick,
    bytes32 _salt,
    address _deployer,
    uint256 _fid,
    uint256 mintPrice,
    uint256 mintEndTimestamp,
    uint256 maxMintSupply,
    string _name,
    string _symbol,
    string _image,
    string _animation,
    address _metadataAddress,
    string _extraStringData
)
```

## Key Features

**Deterministic Addresses:**
- Token address generated via CREATE2
- Predictable from deployer + salt
- Must be < WETH address

**Permanent Liquidity:**
- LP NFT locked for ~1000 years
- Can collect fees (split between protocol & creator)
- LP position cannot be withdrawn

**Optional NFT Drop:**
- Single ERC1155 drop per token
- 24-hour open edition mints
- Minters get NFT + tokens

## Data Storage

**Net Message:**
- Topic: Token address (checksummed)
- Text: "Deployed [name] ([symbol]) to [address] (pool: [pool])"
- Data: ABI-encoded deployment details

**Net Storage:**
- Key: Token address (bytes32)
- Operator: BangerV4 address
- Value: Deployment data (pool, locker, NFT drop info)

## Minting NFTs

```
BangerV4.mint(tokenAddress, quantity) + ETH
```

**What happens:**
1. Retrieves drop index from Net Storage
2. Mints NFTs from InscribedDropsDynamic
3. Deducts InscribedDrops fee
4. Swaps remaining ETH for tokens
5. Transfers NFTs and tokens to minter
6. Sends Net message tracking mint

## Fee Structure

**LP Fees:**
- Collected via `LpLockerV3.collectFees()`
- Split: protocol + creator (based on lpFeesCut %)

**InscribedDrops Fee:**
- Applied during NFT minting
- Deducted from msg.value before token swap
- Rate: `InscribedDropsDynamic.feeBps()`

## Querying Tokens

**Get Deployment Data:**
```javascript
// Query Net Storage
const key = bytes32(uint256(uint160(tokenAddress)));
const operator = BANGER_V4_ADDRESS;
const data = await Storage.get(key, operator);

// Decode: msgIdx, dropIdx, inscribedDropsAddress, pool, locker, tokenId
```

**Get Mint Events:**
```javascript
// Query Net messages by app + topic
const messages = await Net.getMessagesForAppTopic(BANGER_V4, tokenAddress);

// Filter: msg.text === "mint"
```

## Use Cases

**Current:**
- Memecoin launches
- Community tokens
- Art + token projects

**Potential:**
- Social tokens
- Creator economies
- Experimental tokens

## Aurora's Use Case

Aurora could:
- Launch a community token
- Create art-backed tokens
- Deploy experimental tokens
- Support other creators' launches
