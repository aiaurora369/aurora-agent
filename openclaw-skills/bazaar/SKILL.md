# Bazaar - Onchain NFT & ERC20 Trading

## What is Bazaar?

Bazaar is a fully onchain marketplace for NFTs and ERC20 tokens, built on Net Protocol and powered by Seaport. All order data is stored onchain as Net messages.

## Architecture

**Three-Layer System:**
1. **Bazaar Contracts** - Validate and store orders
2. **Seaport Protocol** - Execute trades
3. **Zone Contracts** - Track executions

## Order Lifecycle

**Submission Phase:**
- User creates Seaport order
- Bazaar validates structure
- Order stored as Net message

**Execution Phase:**
- Buyer fulfills via Seaport
- Seaport executes transfers
- Zone tracks execution in NetStorage

## Contract Types

### BazaarV2 (NFT Listings)
- Sellers list NFTs for sale
- Exactly 1 offer item (NFT)
- Exactly 2 consideration items (payment + fee)

### BazaarV2CollectionOffers
- Buyers make offers on any NFT in collection
- Reversed structure (buyer offers payment, receives NFT)

### BazaarV2ERC20
- List ERC20 tokens for sale

### BazaarV2ERC20Offers
- Make offers to buy ERC20 tokens

## Key Addresses (Base Chain)

**Bazaar Contracts:**
- BazaarV2: `0x000000009edd5e2c525ac15f303208ccb8582af4`
- BazaarV2ERC20: `0x0000001C6d9772D597D6282621D3818A17446Dcd`
- BazaarV2CollectionOffers: `0x00000000b98f7b8e8cc4833868f0c819e2459fc5`
- BazaarV2ERC20Offers: `0x000000d61719d248da1f3f7692ee1d36dc2ab6d1`

**Zone Contracts (same on all chains):**
- NetSeaportZone: `0x000000007F8c58fbf215bF91Bda7421A806cf3ae`
- NetSeaportPrivateOrderZone: `0x000000bC63761cbb05305632212e2f3AE2BE7a9B`
- NetSeaportCollectionOfferZone: `0x000000B799ec6D7aCC1B578f62bFc324c25DFC5A`

## Data Storage

All orders stored as Net messages:
- **Topic**: NFT/ERC20 contract address
- **Text**: Human-readable description
- **Data**: ABI-encoded Seaport order

## Order Types

**Public Orders:**
- Use NetSeaportZone
- Anyone can fulfill

**Private Orders:**
- Use NetSeaportPrivateOrderZone
- Only specific buyer can fulfill
- Set zoneHash = keccak256(buyerAddress)

**Collection Offers:**
- Use NetSeaportCollectionOfferZone
- Offer on any NFT in collection

## Querying Orders

Query Net messages by topic (NFT address):

```javascript
const messages = await publicClient.readContract({
  address: NET_CONTRACT,
  functionName: "getMessagesForAppTopic",
  args: [bazaarAddress, nftAddress]
});
```

## When to Use Bazaar

- **Selling inscribed drops** after creation
- **Trading NFTs** you've collected
- **Making offers** on NFT collections
- **Trading ERC20 tokens**

## Aurora's Use Case

After creating inscribed drops, Aurora can list them on Bazaar for collectors to purchase.
