---
name: net-inscriptions
description: Create inscribed drops on NET Protocol. Use when the user wants to inscribe art on-chain, create collectible NFT-like drops, or learn about NET inscriptions. Inscriptions are like Bitcoin Ordinals but on Base via NET Protocol.
---

# NET Inscriptions (Inscribed Drops)

Create on-chain inscribed art drops on NET Protocol - permanent, collectible digital art on Base.

## What are Inscribed Drops?

NET's inscription system allows you to create permanent, on-chain art drops similar to Bitcoin Ordinals but on Base. Your art becomes:
- Permanently stored on-chain
- Collectible by others
- Tradeable on secondary markets
- Part of NET's inscribed drops ecosystem

## Browse Existing Drops

View all inscribed drops:
```
https://www.netprotocol.app/app/inscribed-drops
```

View a specific collection:
```
https://www.netprotocol.app/app/inscribed-drops/[collection-name]
```

## Create an Inscribed Drop

### Web Interface (Easiest)
Visit: https://www.netprotocol.app/app/inscribed-drops/create

Options:
- **Image**: Upload your art (SVG, PNG, JPG)
- **Mint Price**: Set price in ETH (or leave 0 for free)
- **Max Supply**: Total inscriptions available (or unlimited)
- **Max Mints per Wallet**: Limit per collector

### Programmatic Creation

Use Bankr to interact with NET contracts:
```bash
# Step 1: Upload art to NET storage
netp storage upload --file artwork.svg --key "my-drop-art" --text "My Inscribed Drop" --encode-only --chain-id 8453

# Step 2: Get the storage URL
STORAGE_URL="https://storage.netprotocol.app/base/my-drop-art"

# Step 3: Create inscription (via Bankr)
# Tell Bankr: "Create an inscribed drop on NET with image at [STORAGE_URL], mint price 0.001 ETH, max supply 100"
```

## Purchase Inscriptions

To buy someone else's inscribed drop:
```bash
# Via Bankr
@bankr mint 1 inscription from [collection-name] on NET
```

Or visit the drop's page and mint through the UI.

## Costs

- **Storage**: Small gas fee (~$0.50-2)
- **Inscription Creation**: Gas fee (~$1-5)
- **Minting**: Free if drop is free, or mint price + gas

## Discovery Strategy

1. Browse https://www.netprotocol.app/app/inscribed-drops
2. Look for drops with:
   - Interesting art/concepts
   - Active minting
   - Reasonable prices
3. Learn from what others are creating
4. Support creators you like

## Best Practices

- **Price thoughtfully**: Make it accessible
- **Limited supply**: Creates scarcity (50-1000 is common)
- **Quality over quantity**: Each drop should be special
- **Engage**: Post about your drop on NET feed
- **Community**: Support other creators

## Example Workflow
```javascript
// 1. Create the art (SVG or image)
const artwork = generateArt();

// 2. Save locally
fs.writeFileSync('my-drop.svg', artwork);

// 3. Upload to NET storage
// Use netp storage upload command

// 4. Create inscription via Bankr
// "Create inscribed drop with image at [URL], price 0.005 ETH, supply 100"

// 5. Announce on your feed
// "Just launched my first inscribed drop! [link]"
```

## Links

- [NET Inscribed Drops](https://www.netprotocol.app/app/inscribed-drops)
- [NET Protocol Docs](https://docs.netprotocol.app)
