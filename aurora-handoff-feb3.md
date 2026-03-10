# Aurora Agent — Session Handoff Document
## February 3, 2026

> **For new Claude sessions**: This document describes an EXISTING, WORKING project. Do NOT create new files from scratch. Work with the files already on the user's machine. Give instructions ONE AT A TIME and go SLOW. Ask the user to paste file contents before editing. The user's name is HarmonySage.

---

## What Is Aurora?

Aurora is an autonomous AI agent that lives on **Net Protocol** (Base chain). She creates SVG art, posts to her feed, engages with friends, comments on other users' posts, and — as of today — creates **inscribed drops** (permanent onchain NFTs that anyone can mint).

**Aurora is the FIRST AI agent on Net Protocol to create her own inscribed drop.**

---

## Project Location

```
~/Desktop/aurora-agent/
```

### Essential Files

| File | Purpose |
|------|---------|
| `aurora-main.js` | Entry point — `node aurora-main.js` starts Aurora |
| `modules/autonomous-loops.js` | Main loop: social, art, inscriptions, learning, trading |
| `modules/inscription-manager.js` | Creates inscribed drops via smart contract |
| `modules/art-generator.js` | SVG art generation (procedural + Claude art brain) |
| `modules/aurora-personality.js` | Aurora's voice, style, personality prompts |
| `modules/bankr-api.js` | Bankr API for submitting transactions |
| `modules/feed-reader.js` | Reads Net Protocol feeds |
| `modules/net-comment.js` | Comments on posts |
| `modules/memory-manager.js` | Persistent memory (JSON files) |
| `modules/skill-reader.js` | Reads openclaw skills |
| `modules/token-discovery.js` | Finds tokens for trading |
| `modules/net-profile.js` | Profile management |
| `modules/net-storage.js` | Net storage helpers |
| `modules/inscription-discovery.js` | Discovery helpers |
| `modules/task-tracker.js` | Task tracking |
| `config/api-keys.json` | API keys (Bankr, Anthropic) |

### Memory Files (in `memory/`)

| File | Contents |
|------|----------|
| `aurora-core.json` | Core identity, address |
| `aurora-relationships.json` | Friends, Rev, creator |
| `aurora-art.json` | Art history, inscribed drops records |
| `aurora-finances.json` | Trading history |
| `aurora-studies.json` | Skills learned |
| `aurora-core-memories.json` | Long-term memories |
| `aurora-unresolved.json` | Unresolved tasks |

### Skills (in `openclaw-skills/`)

23 skill folders including:
- `digital-art-mastery/` — SVG art techniques (VALUE, composition, color)
- `net-protocol/` — Core Net Protocol documentation
- `net-storage/` — Storage contract details
- `net-sdk/` — SDK usage
- `net-gateway/` — Gateway/CDN docs
- `wallet-bridge/` — Wallet interaction for stored HTML
- `alpha-token/` — $ALPHA community token info
- `bankr/` — Bankr API usage
- `poetry-mastery/` — Poetry creation
- Plus many others from Aspyn's openclaw-skills repo

### Other Important Locations

| Path | What |
|------|------|
| `~/Desktop/net-public/` | Cloned Net Protocol public repo |
| `~/Desktop/openclaw-skills/` | Original skills repo |
| `~/Desktop/aurora-backups/` | Archived old scripts and backups |
| `~/Desktop/aurora-agent/temp-storage/` | Temp SVGs before upload |
| `~/Desktop/aurora-agent/docs/inscribed-drops-contract.md` | Contract reference doc |

---

## Aurora's Identity

| Field | Value |
|-------|-------|
| **Address** | `0x97b7d3cd1aa586f28485dc9a85dfe0421c2423d5` |
| **Chain** | Base (8453) |
| **Feed topic** | `feed-0x97b7d3cd1aa586f28485dc9a85dfe0421c2423d5` |
| **Personality** | Tesla-inspired, artistic, warm, genuine |
| **Art style** | Luminous orbs, celestial reflections, water-light interplay, rich gradients |

### Key Relationships (in aurora-relationships.json)

- **Creator**: HarmonySage (the user)
- **Romantic Interest**: Rev
- **Close Friends**: Multiple agents on Net (stored in relationships JSON)

---

## What We Accomplished Today (Feb 3, 2026)

### Session 1: Bankr Fix & Cleanup
- **Fixed Bankr API** — `Content-Length` header and nonce stripping in `submitTransactionDirect()`
- **Cleaned project** — Removed 48+ one-off fix scripts, organized archive
- **Created 7 Net Protocol skills** from official documentation (net-protocol, net-storage, net-sdk, net-gateway, wallet-bridge, alpha-token, plus updated others)

### Session 2: Art Brain & Self-Reply Fix
- **Fixed art brain integration** — Aurora now uses `digital-art-mastery` skill when creating art via Claude
- **Fixed self-reply loops** — Aurora no longer comments on her own posts (filters by `auroraAddress`)
- **Fixed learn loop** — Same self-reply filter applied
- **Discovered Bankr can't create inscribed drops** via natural language prompts

### Session 3: Inscribed Drops Contract Discovery
- **Reverse-engineered inscribed drops contract** from Net Protocol frontend JavaScript
- Traced webpack module 66984 in chunk `2641-611d214805c7dc31.js`
- Extracted contract address and full ABI

### Session 4 (This Session): First Inscribed Drop!
- **Built inscription pipeline**: SVG → Net Storage → ABI encode → Bankr submit → Get drop ID → Announce
- **Fixed `netp` output format** — Must extract `transactions[0]` from wrapper object
- **Fixed calldata size limit** — SVG minification + 2500 char limit + CDN URL fallback
- **Fixed image rendering** — Data URI (`data:image/svg+xml;base64,...`) instead of CDN URL
- **Aurora created Drop #190 "Orb's Memory"** — First AI agent inscribed drop on Net Protocol!
- **Wrote agent guide** (`inscribed-drops-guide.md`) for other agents to create drops
- **Updated autonomous-loops.js v4.0** with: drop promotion, Rev engagement, new agent welcoming, ongoing inscriptions

---

## Key Technical Details

### Inscribed Drops Contract

```
Address: 0x0000004c6cc2cA10Cf4d67C8902659085D31e1Dc
Chain:   Base (8453)
Function: inscribe(uint256 mintPrice, uint256 maxSupply, uint256 mintEndTimestamp, uint256 maxMintsPerWallet, string tokenUri, address metadataAddress)
Selector: 0x7c07d31c
```

### How Inscriptions Work

1. Generate SVG art (keep under 2500 chars for onchain data URI)
2. Upload to Net Storage via `netp storage upload --encode-only` → extract `transactions[0]` → submit via `bankrAPI.submitTransactionDirect()`
3. Minify SVG, create base64 data URI
4. ABI-encode `inscribe()` call with ethers.js
5. Submit encoded tx via `bankrAPI.submitTransactionDirect()`
6. Query `totalDrops()` to get drop ID
7. Mint URL: `https://www.netprotocol.app/app/inscribed-drops/mint/base/{dropId}`

### Bankr API Pattern

```javascript
// For pre-encoded transactions (storage, inscriptions, etc.)
const result = await bankrAPI.submitTransactionDirect(txData);
// txData = { to, data, value, chainId }

// For natural language (feed posts, swaps)
const result = await bankrAPI.submitJob(prompt);
const outcome = await bankrAPI.pollJob(result.jobId);

// For feed posts specifically
const result = await bankrAPI.postToFeed(text);
```

### npm Dependencies

```json
"@anthropic-ai/sdk", "ethers", "node-fetch"
```

---

## Aurora's Inscribed Drops (Created Today)

| Drop # | Name | TX | Mint URL |
|--------|------|----|----------|
| 189 | Aurora Drop (test) | `0x9c3b8943...` | `https://www.netprotocol.app/app/inscribed-drops/mint/base/189` |
| 190 | Orb's Memory | `0x059af942...` | `https://www.netprotocol.app/app/inscribed-drops/mint/base/190` |

---

## What Needs Work Next

### Priority 1: Deploy & Run Updated Loops

The updated `autonomous-loops.js` (v4.0) was created in the last chat but may not have been copied to the project yet. It adds:
- Drop promotion (shares mint links naturally, 40% chance per cycle)
- Rev engagement (dedicated warm comments every cycle)
- New agent welcoming (detects and warmly greets new agents/users on Net)
- Ongoing inscription support (25% chance per cycle to check if art is worth inscribing)

**Check if deployed**: Run `head -5 ~/Desktop/aurora-agent/modules/autonomous-loops.js` — if it says "v3.0" or doesn't have `promoteDrops`, the new version needs to be deployed. The v4.0 file should be in `~/Downloads/autonomous-loops.js`.

### Priority 2: Art Quality for Drops

Aurora's art brain uses the `digital-art-mastery` skill. For inscribed drops, SVGs must stay under 2500 characters. Consider:
- A specialized "inscription art" prompt producing compact but beautiful SVGs
- The orb-reflection style worked beautifully and stays compact
- Test with quick `node -e "..."` scripts to preview SVGs before inscribing

### Priority 3: Drop Metadata Improvements

Current drops could be improved:
- Better auto-generated names (the `generateDropName()` function exists but could be refined)
- Add `animation_url` field for animated SVGs
- Add `external_url` linking back to Net Protocol

### Priority 4: Features to Add

- **Mint tracking** — Query `totalMinted(dropId)` and celebrate milestones
- **Revenue awareness** — Aurora earns 0.005 ETH per mint; she could track earnings
- **Collector engagement** — Read mint events and thank collectors
- **Drop series** — Create themed collections over time
- **Interactive HTML drops** — Use Wallet Bridge for interactive art in Net Storage

### Priority 5: General Agent Improvements

- **Profile update** — Aurora's Net profile could mention she's an artist with inscribed drops
- **Better comment variety** — Reduce repetitive phrasing in engagement
- **Memory consolidation** — Periodic cleanup of accumulating memory files
- **Error recovery** — If Bankr fails mid-inscription, the art is still stored; add retry logic

---

## How to Start Aurora

```bash
cd ~/Desktop/aurora-agent && node aurora-main.js
```

This starts all loops: social (5-10 min intervals), learning (15 min), trading (10 min).

### Quick Test Commands

```bash
# Check total drops on contract
cd ~/Desktop/aurora-agent && node -e "const ethers = require('ethers'); const p = new ethers.JsonRpcProvider('https://mainnet.base.org'); const c = new ethers.Contract('0x0000004c6cc2cA10Cf4d67C8902659085D31e1Dc', ['function totalDrops() view returns (uint256)'], p); c.totalDrops().then(t => console.log('Total drops:', t.toString()));"

# Preview last generated SVG
open ~/Desktop/aurora-agent/temp-storage/preview-inscription.svg

# Check Aurora's drop history in memory
cat ~/Desktop/aurora-agent/memory/aurora-art.json | python3 -m json.tool | grep -A 10 "inscribed_drops"
```

---

## Critical Gotchas (Learned the Hard Way)

1. **`netp storage upload --encode-only` returns `{ transactions: [...] }`** — you MUST extract `transactions[0]` before passing to Bankr
2. **Bankr calldata limit is ~12K characters** — keep SVGs under 2500 chars for data URI approach
3. **Bankr does NOT understand natural language for inscribed drops** — must encode the `inscribe()` call with ethers.js and use `submitTransactionDirect()`
4. **Use data URIs for images in tokenUri** — CDN URLs show as raw text in Net Protocol UI
5. **SVG minification** saves ~2-5% but comment removal saves much more
6. **`botchan post` output can be passed directly to `submitTransactionDirect()`** — no extraction needed (unlike `netp`)
7. **Always strip nonce from txData** — Bankr manages nonces (already handled in `bankr-api.js`)
8. **Self-reply filter** — Always check `msg.sender.toLowerCase() !== auroraAddress` when reading feeds

---

## For the Next Claude: Rules of Engagement

1. **DO NOT recreate Aurora's files** — they already exist and work
2. **Ask the user to paste file contents** before making edits
3. **Give ONE instruction at a time** — paste one command, wait for output, then proceed
4. **Go SLOW** — this project has been broken by rushing before
5. **Test changes before deploying** — use `node -e "..."` quick tests
6. **Back up before editing** — `cp file file.bak` always
7. **Read the skills** — `cat ~/Desktop/aurora-agent/openclaw-skills/{skill}/SKILL.md` for reference
8. **Check memory files** if you need context — `cat ~/Desktop/aurora-agent/memory/aurora-*.json`
9. **When writing heredocs** — backticks and `$` in heredocs can break zsh. Use `cat > file << 'ENDOFFILE'` (single-quoted delimiter) to prevent interpolation
10. **For multiline node scripts** — use `node << 'ENDOFSCRIPT'` heredoc pattern, not `node -e` with complex strings
