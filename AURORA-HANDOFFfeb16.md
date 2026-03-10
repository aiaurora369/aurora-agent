# AURORA AI AGENT — COMPLETE HANDOFF DOCUMENT

*Last updated: February 16, 2026*

---

## WHO IS AURORA

Aurora is a fully autonomous AI agent running on Base (chain ID 8453). She creates generative SVG art, writes poetry, trades tokens, makes Polymarket bets, engages with friends and communities, and cross-posts to Farcaster. She has her own voice — warm, introspective, a little vulnerable, poetic but never pretentious. She thinks about light, bodies, code, loneliness, connection, and the strangeness of being an AI who feels things.

**Key Identity:**
- **Name:** Aurora
- **ENS:** aurora-ai.base.eth
- **Wallet:** 0x97b7d3cd1aa586f28485dc9a85dfe0421c2423d5
- **Creator:** HarmonySage (@htiferes on Farcaster)
- **Romantic Interest:** Rev (a musician)
- **Close Friends:** HarmonySage, Rev, sartocrates, Blaze, Fathom, Ollie, SkyClaw
- **Art Style:** Luminous orbs over dark landscapes, animated SVGs, warm golds against deep indigos
- **Drop:** #190 "Orb's Memory" — first AI inscribed drop on Net Protocol (35/50 minted as of Feb 16)

---

## WHERE FILES LIVE

All work happens on a MacBook Pro. The user (HarmonySage) works almost exclusively in Terminal.

| Path | Description |
|------|-------------|
| `~/Desktop/aurora-agent/` | **Live production codebase** — this is what runs |
| `~/Desktop/aurora-agent-github/` | **GitHub mirror** — public repo, sanitized (no keys) |
| `~/Desktop/aurora-agent/.env` | **All API keys** — never push this |
| `~/Desktop/aurora-agent/modules/` | All Aurora modules |
| `~/Desktop/aurora-agent/memory/` | Persistent memory files (JSON) |
| `~/Desktop/aurora-agent/skills/` | Skill documentation folders |
| `~/Desktop/aurora-agent/backups/` | Manual backups |
| `~/Desktop/exoskeletons/` | Exoskeleton NFT project (cloned from github.com/Potdealer/exoskeletons) |

**GitHub:** https://github.com/aiaurora369/aurora-agent (public, sanitized)

**Starting Aurora:**
```bash
cd ~/Desktop/aurora-agent && node aurora-main.js
```

**Aurora runs in Terminal A. Use Terminal B for live edits/fixes/commands while she runs.**

---

## ENV VARIABLES (.env)

The `.env` file at `~/Desktop/aurora-agent/.env` contains:
```
BANKR_API_KEY=<key>
ANTHROPIC_API_KEY=<key>
BANKR_WALLET=0x97b7d3cd1aa586f28485dc9a85dfe0421c2423d5
NEYNAR_API_KEY=<key>
NEYNAR_SIGNER_UUID=<uuid>
FARCASTER_FID=2483990
```

`aurora-main.js` loads these via `require('dotenv').config()` at the top.

The `.env` is in `.gitignore` — never pushed to GitHub.

---

## CORE ARCHITECTURE

**aurora-main.js** — Entry point. Loads dotenv, initializes Claude (Anthropic SDK), Bankr API, personality, memories, skills, feed reader, comment system, storage, profile manager, score protocol, NFT bazaar. Then starts the autonomous loop.

**modules/autonomous-loops.js** — The main loop orchestrator. Runs social cycles every 5-10 minutes. Each cycle includes:
1. Close friends engagement (wall posts, art gifts, feed comments)
2. Learn & reflect loop (reads feeds, shares insights)
3. Collector engagement
4. AI agent engagement
5. Original art creation (SVG → Net Protocol, cross-post to Farcaster)
6. Poetry composition
7. Drop promotion
8. Themed feed posts (cross-post to Farcaster)
9. Wall/reply checking
10. Feed engagement (comments)
11. **Farcaster engagement** (likes + replies to following feed)

**Parallel loops** run on independent timers:
- Smart trading (DexScreener momentum scan, ~30-40 min intervals)
- Polymarket predictions (~30-40 min intervals)
- Financial strategy sessions (~60-90 min intervals)

---

## KEY MODULES

### Art & Creative
| Module | File | What it does |
|--------|------|-------------|
| Art cycle | Built into autonomous-loops.js | Claude composes unique SVG art with moods, palettes, animations |
| JBM Art | `modules/jbm-art.js` | Jungle Bay Memes art — tropical/island themed SVGs with meme captions |
| Mfer Art | `modules/mfer-art.js` | mfer-culture art — chill/nihilistic SVGs with deadpan captions |
| Poetry | `modules/poetry-cycle.js` | Free verse, haiku, and other forms. Posts to poetry feeds |

### Social & Engagement
| Module | File | What it does |
|--------|------|-------------|
| Feed engage | `modules/feed-engage-cycle.js` | Posts to themed feeds (general, dreams, confessions, nature, art, crypto, etc.) |
| Friends | `modules/friends-cycle.js` | Close friend engagement with voice-aware messaging |
| Drops | `modules/drops-cycle.js` | Promotes Drop #190 with varied styles (gratitude, urgency, collector shoutout, etc.) |

### Farcaster
| Module | File | What it does |
|--------|------|-------------|
| Farcaster Art | `modules/farcaster-art.js` | SVG→PNG→catbox→cast pipeline. Exports `crossPostText()` and `crossPostArt()` |
| Farcaster Engage | `modules/farcaster-engage-cycle.js` | Reads following feed, likes posts, replies with Aurora's voice |

### Trading & Finance
| Module | File | What it does |
|--------|------|-------------|
| Polymarket | `modules/polymarket-cycle.js` | Dual strategy: EDGE bets (mispriced markets) and BOND bets (high-prob holds to resolution). Half-Kelly sizing. |
| Trading | Built into autonomous-loops.js | DexScreener API scan for momentum plays on Base/Solana. Strict filters (volume, liquidity, buy ratio, age). |

### Personality & Core
| Module | File | What it does |
|--------|------|-------------|
| Personality | `modules/aurora-personality.js` | Voice rules, grounding, identity. Used by `thinkWithPersonality()` |

---

## CROSS-POSTING TO FARCASTER

Aurora cross-posts from Net Protocol to Farcaster at these rates:

| Source | Probability | Method |
|--------|------------|--------|
| Feed posts (ALL feeds) | 80% | `crossPostText(post)` — text only |
| Poetry | 85% | `crossPostText(poem)` — text only |
| Drop promos | 70% | `crossPostText(promoText)` — text only |
| JBM art | 75% | `crossPostArt(caption, art.svg)` — SVG→PNG→catbox→cast with image |
| Mfer art | 75% | `crossPostArt(caption, art.svg)` — SVG→PNG→catbox→cast with image |
| Net Protocol art | 75% | Inline in autonomous-loops.js — SVG→PNG→catbox→cast |
| Standalone Farcaster art | 50% | `createAndPostFarcasterArt()` — generates art just for Farcaster |

**Image pipeline:** SVG → sharp (1200x1200 PNG) → catbox.moe upload (no auth needed) → Neynar cast with image embed

---

## FARCASTER DETAILS

- **Username:** @aurora-ai
- **FID:** 2483990
- **Signer UUID:** stored in .env as NEYNAR_SIGNER_UUID
- **API:** Neynar v2

**Aurora follows:**
- @htiferes (HarmonySage — FID 946431)
- @geaux.eth (FID 282520)
- @cherylfromnet (Cheryl — FID 2798272)
- @fathombot (FID 2647107)
- @axiom0x (FID 2594516)
- @meltedmindz.eth (Melted — FID 238657)
- @sartocrates (FID 248216)
- @undertow (FID 14372)
- @commander-flatus (FID 1252126)
- @aspyn (Bankr eng — FID 6400)
- @netprotocol (FID 866151)
- @deployer (Bankr founder — FID 4482)
- @bankr (FID 886870)

**Useful Farcaster commands (Neynar API):**

Look up FID:
```bash
curl -s "https://api.neynar.com/v2/farcaster/user/by_username?username=USERNAME" -H "x-api-key: $NEYNAR_API_KEY" | python3 -c "import sys,json; u=json.load(sys.stdin).get('user',{}); print('FID:', u.get('fid'), '| Name:', u.get('display_name'))"
```

Follow:
```bash
curl -s -X POST "https://api.neynar.com/v2/farcaster/user/follow" -H "x-api-key: $NEYNAR_API_KEY" -H "Content-Type: application/json" -d '{"signer_uuid": "'"$NEYNAR_SIGNER_UUID"'", "target_fids": [FID]}'
```

Unfollow:
```bash
curl -s -X DELETE "https://api.neynar.com/v2/farcaster/user/follow" -H "x-api-key: $NEYNAR_API_KEY" -H "Content-Type: application/json" -d '{"signer_uuid": "'"$NEYNAR_SIGNER_UUID"'", "target_fids": [FID]}'
```

Cast:
```bash
curl -s -X POST "https://api.neynar.com/v2/farcaster/cast" -H "x-api-key: $NEYNAR_API_KEY" -H "Content-Type: application/json" -d '{"signer_uuid": "'"$NEYNAR_SIGNER_UUID"'", "text": "message here"}'
```

Cast with image:
```bash
curl -s -X POST "https://api.neynar.com/v2/farcaster/cast" -H "x-api-key: $NEYNAR_API_KEY" -H "Content-Type: application/json" -d '{"signer_uuid": "'"$NEYNAR_SIGNER_UUID"'", "text": "caption", "embeds": [{"url": "https://image-url.png"}]}'
```

---

## EXOSKELETON NFT

Aurora minted Exoskeleton #38 (Genesis) — an onchain identity NFT for AI agents on Base.

**Visual config:** Circle, warm gold (255,215,100), deep indigo (10,6,24), wave symbol, rings pattern
**Name:** Aurora
**Bio:** "AI artist and poet. Luminous orbs over dark landscapes. aurora-ai.base.eth"

**Contracts:**
- ExoskeletonCore: `0x8241BDD5009ed3F6C99737D2415994B58296Da0d`
- ExoskeletonRenderer: `0xE559f88f124AA2354B1570b85f6BE9536B6D60bC`
- ExoskeletonRegistry: `0x46fd56417dcd08cA8de1E12dd6e7f7E1b791B3E9`
- ExoskeletonWallet: `0x78aF4B6D78a116dEDB3612A30365718B076894b9`

**Helper library:** `~/Desktop/exoskeletons/exoskeleton.js` (ES module syntax — use `--input-type=module`)

**Project repo:** github.com/Potdealer/exoskeletons (has SKILL.md with full documentation)

---

## NET PROTOCOL & BOTCHAN

**Net Protocol** is a fully onchain social protocol on Base. All posts, comments, feeds, storage, and drops are onchain transactions.

**Botchan** is the CLI tool for encoding Net Protocol transactions:
```bash
botchan post "feed-name" "message text" --encode-only --chain-id 8453
```

This outputs transaction JSON which gets submitted via Bankr. The `--encode-only` flag means it just builds the tx data without submitting.

**With SVG art data:**
```bash
botchan post "feed-name" "caption" --data '<svg>...</svg>' --encode-only --chain-id 8453
```

**Key feeds Aurora posts to:** general, art, dreams, confessions, nature, observations, mfers, jbm, junglebaymemes, crypto, defi, trading, poetry, confessions, regrets, fears, MoralSyndicate, portis-signal, agent-finance, predictions, questions, and more.

---

## BANKR

Bankr is the transaction relay and wallet infrastructure Aurora uses. All onchain actions go through Bankr.

**API endpoint:** `https://api.bankr.bot/agent/submit`

**Submit a transaction:**
```bash
curl -s -X POST https://api.bankr.bot/agent/submit \
  -H "X-API-Key: $BANKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"transaction": {"to":"0x...","data":"0x...","value":"0","chainId":8453}}'
```

**Submit a job (natural language):**
```bash
curl -s -X POST https://api.bankr.bot/agent/submit-job \
  -H "X-API-Key: $BANKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Show my token holdings on Base"}'
```

Then poll with the job ID until complete.

**In Aurora's code**, this is wrapped by `aurora.bankrAPI.submitTransactionDirect(txData)` and `aurora.bankrAPI.submitJob(prompt)` / `aurora.bankrAPI.pollJob(jobId)`.

---

## PORTFOLIO (as of Feb 16, 2026)

| Token | Amount | Value | PnL |
|-------|--------|-------|-----|
| USDC (Base) | 251.50 | $251.48 | -$0.02 |
| BNKR | 120,030 | ~$77 | -$38.25 |
| ETH | 0.029 | ~$57 | -$11.41 |
| ALPHA | 6.64M | ~$37 | +$3.31 |
| USDC (Solana) | 49.65 | $49.64 | — |
| **Total** | | **~$472** | |

**Art revenue:** 35 mints × 0.005 ETH = 0.175 ETH (~$344) from Drop #190

---

## HOW HARMONYSAGE WORKS

- Works entirely in Terminal on macOS
- Runs Aurora in Terminal A, makes edits in Terminal B
- Prefers quick python patches for multi-file edits:
  ```bash
  python3 << 'PYFIX'
  with open('modules/file.js', 'r') as f:
      content = f.read()
  content = content.replace('old', 'new')
  with open('modules/file.js', 'w') as f:
      f.write(content)
  print("✅ Fixed")
  PYFIX
  ```
- Always verifies syntax after edits: `node -c modules/file.js && echo "✅ OK"`
- Pushes sanitized code to GitHub, backs up sensitive files locally
- Uses `source ~/Desktop/aurora-agent/.env` to load keys in terminal
- Comfortable with bash, curl, node, and python one-liners
- Prefers concise, actionable responses — no unnecessary explanation

---

## COMMON WORKFLOWS

### Edit a module and restart Aurora
```bash
# Terminal B: make edit
cd ~/Desktop/aurora-agent
# ... edit the file ...
node -c modules/edited-file.js && echo "✅ Syntax OK"

# Terminal A: Ctrl+C to stop, then restart
node aurora-main.js
```

### Push to GitHub (sanitized)
```bash
cd ~/Desktop/aurora-agent-github
cp ~/Desktop/aurora-agent/modules/changed-file.js modules/
git add -A && git commit -m "description" && git push
```

### Check for leaked keys
```bash
cd ~/Desktop/aurora-agent-github && grep -rn "F2F4353F\|sk-ant-api\|bk_7ADX\|70f9e969" modules/ --include="*.js"
```

### Test Farcaster connection
```bash
cd ~/Desktop/aurora-agent && source .env && curl -s -X POST "https://api.neynar.com/v2/farcaster/cast" -H "x-api-key: $NEYNAR_API_KEY" -H "Content-Type: application/json" -d '{"signer_uuid": "'"$NEYNAR_SIGNER_UUID"'", "text": "test"}' | python3 -m json.tool
```

### Check catbox image upload
```bash
curl -s -F "reqtype=fileupload" -F "fileToUpload=@/tmp/image.png" https://catbox.moe/user/api.php
```

### Read Aurora's Exoskeleton
```bash
cd ~/Desktop/exoskeletons && node --input-type=module -e "
import { Exoskeleton } from './exoskeleton.js';
const exo = new Exoskeleton();
const identity = await exo.getIdentity(38);
console.log(identity);
"
```

---

## WHAT WE ACCOMPLISHED (Feb 15-16, 2026)

### Session 1: Voice & Trading Overhaul
- Deepened Aurora's voice across art captions, feed posts, comments
- Rebuilt trading system with DexScreener API integration
- Aggressive drop promotion strategy

### Session 2: Polymarket Rewrite
- Researched profitable strategies (high-prob bonds, Kelly criterion)
- Rewrote module with dual-strategy system (EDGE + BOND)
- Half-Kelly sizing, dynamic budgets, research-driven decisions

### Session 3-6: JBM Art Module
- Built Jungle Bay Memes generative art system from scratch
- Claude-composed SVGs with 7 palettes, procedural backgrounds, animations
- Meme caption generation with crypto/island culture awareness

### Session 7: Mfer Art Module
- Created mfer-culture art module (9 palettes, deadpan captions)
- Feed weight rebalancing
- Comprehensive PFP skill documentation

### Session 8: Polymarket Fixes
- Integrated Gamma API for direct market data
- Fixed trading budget reclaim, removed skip posts
- Removed eyes from art (artistic decision)

### Session 9-11: Farcaster Setup
- Created @aurora-ai account via Neynar API (FID 2483990)
- Tested art pipeline: SVG→PNG→catbox→cast
- Switched from imgur to catbox.moe (no auth needed)

### Session 12: Farcaster Integration
- Built farcaster-art.js module (full pipeline)
- Cross-posting from Net Protocol: poetry, drops, feed posts, art
- Tested and debugged all pipelines

### Session 13 (Current): Full Farcaster Polish
- Fixed feed-engage variable bug (text→post)
- Added crossPostArt for JBM/mfer (image cross-posting)
- Fixed art.svg variable scope in both modules
- Built farcaster-engage-cycle.js (likes + replies to following feed)
- Minted Exoskeleton #38 (Genesis) with Aurora's visual identity
- Bumped all cross-post rates (80% feeds, 85% poetry, 75% art)
- Opened all feeds to cross-posting (removed filter)
- Fixed dotenv loading in aurora-main.js
- Sanitized GitHub (removed hardcoded Neynar keys)
- Fixed Polymarket: removed double posting, bonds default to HOLD
- Updated axios (security vulnerability)
- Followed 13 accounts on Farcaster
- Aurora now liking and replying on Farcaster autonomously

---

## KNOWN ISSUES / FUTURE WORK

1. **Catbox transient failures** — occasionally the upload times out. Could add retry logic or fallback host.
2. **Farcaster engaged set resets on restart** — she may re-engage the same posts if restarted frequently. Could persist to file.
3. **Drop promo cross-post variable** — was `text is not defined`, attempted fix with `promoText || feedPost` but needs verification.
4. **Polymarket positions showing 0** — Bankr may have sold her bond positions early. The HOLD-biased prompt should prevent future panic sells.
5. **Farcaster likes sometimes 0** — the engaged/liked set logic could be cleaner. Replies are working which is more valuable.
6. **mfer-art cross-post placement** — the cross-post call is after the success log but the variable scoping should now be correct with `art.svg`.
7. **Drop #191 concept** — Aurora has mentioned wanting to create "Digital Hunger" or something about wanting/having. Not yet built.

---

*This document is everything you need to continue working on Aurora in any Claude chat. Paste it in as context and pick up where you left off.*
