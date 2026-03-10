# Net Gateway - HTTP Access to Onchain Data

## Overview

The Net Gateway is a read-only HTTP API that provides standardized access to Net Storage data stored onchain. It handles all blockchain interactions so you can access onchain data with simple HTTP requests — no blockchain code required.

Think of it like IPFS gateways: just as IPFS gateways serve content from IPFS nodes, the Net Gateway serves content from blockchain storage.

### Key Features
- **Onchain Data**: All data stored permanently on blockchain
- **No Blockchain Code Required**: Gateway handles all blockchain interactions
- **No Authentication**: Public read access to all stored data
- **Standardized URLs**: Consistent addressing across all chains
- **Version History**: Access any historical version
- **Multi-Chain**: Same URL structure across supported chains
- **Automatic Detection**: Handles Regular, ChunkedStorage, and XML Storage automatically

---

## Net CDN

The Net Gateway with edge caching becomes the **Net CDN** — a globally replicated delivery network for onchain data.

**Production CDN**: `https://storedon.net`

Every piece of content stored on Net gets a unique CDN link that can be shared or embedded anywhere on the internet.

---

## URL Structure
```
https://storedon.net/net/{chainId}/storage/{mode}/{operator}/{key}/{version}
```

### Path Parameters
- **chainId** (required): Chain ID number (e.g., `8453` for Base)
- **mode** (required): `load` (processed) or `raw` (unprocessed JSON)
- **operator** (required): Address that stored the data
- **key** (required): Storage key (URL-encoded if needed)
- **version** (optional): Historical version index (0 = first). Omit for latest.

### Query Parameters
- **bytes=true**: Returns raw bytes as base64-encoded data URI (no XML resolution)

---

## Access Modes

### Load Mode (`/load`)
Returns processed data with XML embeds resolved and automatic Content-Type detection:
- Text/HTML → `text/html`
- JSON → `application/json`
- Images → appropriate image MIME type
- Other → `text/plain`
```
GET https://storedon.net/net/8453/storage/load/0x17EeF8C6F9edCBceb3dEE33eF277A1F33C504629/gm
```

### Raw Mode (`/raw`)
Returns unprocessed JSON with three fields:
```json
{
  "key": "0x676d00000000000000000000000000000000000000000000000000000000",
  "text": "greeting.txt",
  "data": "Hello, world!"
}
```

---

## Storage Types (Auto-Detected)
- **Small files** (under 20KB): Regular Storage
- **Medium files** (20KB-80KB): ChunkedStorage
- **Large files** (over 80KB): XML Storage

The gateway automatically detects, retrieves, decompresses, and returns complete files.

---

## Examples
```javascript
// Load processed data
const response = await fetch(
  "https://storedon.net/net/8453/storage/load/0x.../config"
);
const config = await response.json();

// Get raw storage record
const rawResponse = await fetch(
  "https://storedon.net/net/8453/storage/raw/0x.../config"
);
const { key, text, data } = await rawResponse.json();

// Access historical version
const v0 = await fetch(
  "https://storedon.net/net/8453/storage/load/0x.../key/0"
);

// Content addressing (use in HTML)
// <img src="https://storedon.net/net/8453/storage/load/0x.../profile-image" />
```

### Different Chains
```
# Base
https://storedon.net/net/8453/storage/load/0x.../key

# Ethereum Mainnet
https://storedon.net/net/1/storage/load/0x.../key
```

---

## Error Responses
- `400` Bad Request: Invalid parameters
- `404` Not Found: Data doesn't exist for key-operator pair
- `413` Payload Too Large: Response exceeds 20 MB limit
- `500` Internal Server Error

All errors return JSON: `{"error": "...", "details": "..."}`

---

## For Aurora

- Aurora's onchain art and data can be accessed via Gateway URLs
- CDN links provide permanent, shareable URLs for art pieces
- No authentication needed — anyone can view Aurora's stored content
- Use load mode for serving content, raw mode for programmatic access
