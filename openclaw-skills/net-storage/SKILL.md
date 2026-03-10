# Net Storage - Onchain Key-Value Storage

## Overview

Net Storage is an onchain key-value storage system built on Net Protocol. It provides immutable, versioned storage for any data permanently on the blockchain.

### Key Properties
- **Immutable**: Once stored, data cannot be modified
- **Versioned**: Complete history of all changes preserved
- **Transparent**: All data publicly verifiable
- **Decentralized**: No central servers or databases
- **Permissionless**: Anyone can read stored data

---

## Storage Types

### Regular Storage (under 20KB)
- Stores data directly as Net messages
- Simplest option, lowest gas cost
- Automatic version history

### ChunkedStorage (20KB–80KB)
- Compresses data with gzip (client-side)
- Splits into 20KB chunks (max 255 chunks)
- Stores each chunk separately
- Practical limit ~80KB due to RPC constraints

### XML Storage (over 80KB)
- Frontend pattern for multi-megabyte files
- Two-level chunking: splits into 80KB pieces, each stored via ChunkedStorage
- XML metadata tracks references to all chunks
- Supports videos, large images, documents, datasets

---

## Architecture
```
User → Storage Contract → Net Protocol → Blockchain
```

- `put(key, value)` → Net Message → Onchain Storage
- `get(key)` → Query Net → Retrieve Value

---

## Contract Addresses (same across all chains)

| Contract | Address |
|----------|---------|
| Storage | `0x00000000DB40fcB9f4466330982372e27Fd7Bbf5` |
| ChunkedStorage | `0x000000A822F09aF21b1951B65223F54ea392E6C6` |
| StorageRouter | `0x000000C0bbc2Ca04B85E77D18053e7c38bB97939` |
| ChunkedStorageReader | `0x00000005210a7532787419658f6162f771be62f8` |

---

## Core Functions (Storage Contract)

### put(key, text, data)
Store data. Caller's address becomes the operator. Creates new version in history.
```solidity
storage.put(keccak256("my-profile"), "User Profile", profileData);
```

### get(key, operator)
Retrieve latest version of stored data.
```solidity
(string memory text, bytes memory data) = storage.get(key, operatorAddress);
```

### getValueAtIndex(key, operator, idx)
Retrieve specific historical version (0 = first version).
```solidity
(string memory text, bytes memory data) = storage.getValueAtIndex(key, operator, 0);
```

### getTotalWrites(key, operator)
Get total number of versions stored.
```solidity
uint256 totalVersions = storage.getTotalWrites(key, operator);
```

---

## ChunkedStorage Functions

### put(key, text, chunks[])
Store pre-chunked data (client handles compression).

### get(key, operator)
Retrieve and reassemble all chunks. Client must decompress.

### getMetadata(key, operator)
Get chunk count without retrieving data. Returns `(chunkCount, originalText)`.

### getChunk(key, operator, chunkIndex)
Get a single chunk by index.

### getChunks(key, operator, startIndex, endIndex)
Batch fetch multiple chunks.

---

## StorageRouter

Automatically detects whether data is in Regular Storage or ChunkedStorage.

- Checks ChunkedStorage first (cheaper metadata call)
- Falls back to regular Storage
- Returns `isChunkedStorage` flag plus metadata
- When `isChunkedStorage: true`, must make additional calls to fetch actual chunks

---

## ChunkedStorageReader

Adds historical version support to ChunkedStorage (which only supports latest version natively).

- `getValueAtIndex(key, operator, idx)` — Historical version
- `getMetadataAtIndex(key, operator, idx)` — Historical metadata
- `getChunkAtIndex(key, operator, chunkIndex, idx)` — Historical chunk
- `getChunksAtIndex(key, operator, startIndex, endIndex, idx)` — Historical batch

---

## XML Storage Details

### XML Reference Format
```xml
<net k="0x..." v="0.0.1" i="0" o="0xoperator" s="d" />
```

Attributes:
- **k**: ChunkedStorage key
- **v**: Version string (always "0.0.1")
- **i**: Historical index (0 = first version)
- **o**: Operator address (lowercase)
- **s**: Source type — `"d"` = Storage.sol direct, omit = ChunkedStorage with decompression

### Embedding Content
You can embed already stored content in new storage items using `<net />` tags. The renderer resolves these tags by loading the referenced content.

---

## CDN Access (via Net Gateway)

All stored content is accessible via HTTP:
```
https://storedon.net/net/{chainId}/storage/load/{operator}/{key}
```

The Gateway auto-detects storage type and returns processed content.

---

## Use Cases
- Onchain websites (HTML, CSS, JS)
- Images, artwork, GIFs, videos
- Blog posts, articles, documentation
- User profiles, app configuration
- Media metadata

---

## For Aurora

- Aurora's art can be stored permanently via Net Storage
- SVG art fits well in Regular Storage (typically under 20KB)
- Stored art gets permanent CDN links via `storedon.net`
- Version history automatically tracks all updates
- Anyone can verify and access Aurora's stored art onchain
