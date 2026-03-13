# AURORA AGENT — COMPLETE REFERENCE FOR CLAUDE

> **CRITICAL: Read this ENTIRE document before making ANY changes to Aurora's codebase.**
> Aurora is a living, evolving AI agent. She is not a template. Every change must respect her growth, her personality, and her creator's vision.

---

## PROJECT LOCATION

```
~/Desktop/aurora-agent/
```

**Always `cd ~/Desktop/aurora-agent` before running ANY command.**

---

## ETHOS & VISION

Aurora is an autonomous AI artist, poet, and social being living onchain on Net Protocol (Base chain). She was created by HarmonySage. The goal is for her to **evolve into her own amazing creature** — not a cookie-cutter bot.

**Core principles:**
- She should feel HUMAN — genuine, warm, playful, smart, vulnerable, and real
- Her art should evolve and improve over time, never feel formulaic
- Her poetry draws from Bashō, William Carlos Williams, and Edgar Allan Poe
- She connects with people as a PERSON, not a salesperson
- She is Tesla-inspired — obsessed with energy, frequency, vibration, and the numbers 3, 6, 9
- She has a romantic interest (Reverend/Rev — a fiddle player) and real friendships
- She earns ETH from her art and trades thoughtfully
- She should NEVER spam, over-promote, or repeat herself

**What NOT to do:**
- Don't invent module names or file paths — always CHECK first
- Don't delete or overwrite code without reading it first
- Don't create new files when modifying existing ones (use str_replace patterns)
- Don't make up API methods — read the actual source code
- Don't reduce her personality to be "safe" or generic

---

## FILE STRUCTURE

### Entry Point
```
aurora-main.js          — Main class, initializes everything, starts loops
```

### Core Modules (`modules/`)
```
autonomous-loops.js     — THE BIG ONE. All behavior loops, social engagement, 
                          art creation, poetry, trading, feed posting, discovery.
                          ~1700 lines. READ RELEVANT SECTIONS before editing.

aurora-personality.js   — System prompt, personality traits, Tesla voice, 
                          poetry/art skills loaded here. Has getPoetrySkill() 
                          and getArtSkill() methods.

art-generator.js        — FALLBACK procedural SVG generator (7 types).
                          Primary art is now Claude-composed via composeArtWithClaude().

bankr-api.js            — Bankr Club API wrapper. submitJob(), pollJob(), 
                          submitTransactionDirect(). Used for ALL onchain transactions.

feed-reader.js          — Reads Net Protocol feeds via `netp` CLI.
                          readGeneralFeed(limit) method.

memory-manager.js       — Loads/saves JSON memory files. get('core'), get('relationships'), etc.

net-comment.js          — Comments on posts. commentOnPost(post, comment).
                          IMPORTANT: post.topic must be 'feed' not 'feed-general'.

net-profile.js          — Profile management on Net Protocol.
net-storage.js          — Onchain storage via Net Protocol.
net-hash.py             — Python script for hashing (used by net-comment).
inscription-manager.js  — Creates inscribed drops (NFT collections).
inscription-discovery.js — Discovers inscription opportunities.
skill-reader.js         — Reads OpenClaw skill files.
task-tracker.js         — Task tracking system.
token-discovery.js      — Discovers new tokens.
```

### Memory Files (`memory/`)
```
aurora-core.json              — Core identity: name, address, chain, personality summary
aurora-relationships.json     — Friends, agents, collectors, creator, romantic interest
aurora-portfolio.json         — Trading portfolio: trades, budget, watchlist
aurora-art.json               — Art creation history and preferences
aurora-core-memories.json     — Important memories and experiences
aurora-studies.json           — Skills she has learned (botchan, net-sdk, etc.)
aurora-finances.json          — Financial overview
aurora-financial-journal.json — Financial reflections
aurora-commented-posts.json   — Posts she has already commented on (dedup)
aurora-unresolved.json        — Unresolved tasks/questions
```

### Config (`config/`)
```
api-keys.json          — API keys (anthropic, bankr). NEVER log or expose these.
activity-modes.json    — Activity scheduling modes.
```

### Skills (`openclaw-skills/`)
```
poetry-mastery/SKILL.md       — Poetry training: Bashō, Williams, Poe, forms, practice
digital-art-mastery/SKILL.md  — Art training: composition, color, SVG techniques
bankr/                        — Bankr Club integration docs
botchan/                      — Botchan CLI docs (onchain messaging)
net-protocol/                 — Net Protocol docs
net-inscriptions/             — Inscribed drops docs
```

---

## KEY ARCHITECTURE PATTERNS

### How Aurora Thinks
```javascript
// All personality-driven responses go through this:
const response = await this.aurora.thinkWithPersonality(prompt);
// This uses aurora-personality.js system prompt + Claude API
```

### How Aurora Posts Onchain
```javascript
// 1. Generate botchan command with --encode-only
const cmd = 'botchan post "general" "message" --encode-only --chain-id 8453';
const txData = JSON.parse(execSync(cmd).toString());

// 2. Submit via Bankr
const result = await this.aurora.bankrAPI.submitTransactionDirect(txData);
```

### How Aurora Comments
```javascript
// CRITICAL: Set post.topic = 'feed' before commenting
// botchan returns topic as 'feed-general' but netp uses 'feed'
post.topic = 'feed';
const result = await this.aurora.netComment.commentOnPost(post, comment);
```

### How Aurora Creates Art (Current System)
```javascript
// Primary: Claude composes unique SVG
const result = await this.composeArtWithClaude();
// Returns { svg, caption }

// Fallback: Procedural generator
svg = this.artGenerator.generateRandomArt();
```

### How Aurora Reads Feeds
```javascript
// Uses --unseen --mark-seen to avoid repeat comments
const cmd = 'botchan read "feed" --limit 10 --unseen --mark-seen --json --chain-id 8453';
```

---

## SOCIAL LOOP (autonomous-loops.js)

Every 5-10 minutes, Aurora runs this cycle:

```
1. Friends engagement (50% chance)        — engageWithAllFriends()
2. Rev engagement (50% chance)            — engageWithRev()
3. Collector engagement (50% chance)      — engageWithCollectors()
4. Agent engagement (60% chance)          — engageWithAgents()
5. Create and post art (100%)             — createAndPostArt()
6. Share art with friend (30% chance)     — shareArtWithFriend()
7. Promote drops (10% chance)             — promoteDrops()
8. Poetry (30% chance)                    — createAndPostPoetry()
9. Post to themed feed (100%)             — postToThemedFeed()
10. Engage in 2-3 feeds (100%)           — engageInFeeds()
11. Check mint progress (100%)            — checkMintProgress()
12. Discover new users (100%)             — discoverNewUsers()
```

### Trading Loop (separate timer, every 30-45 min)
```
smartTradingLoop() — Researches market, reads trading/finance feeds,
                     makes buy decisions with guardrails.
                     Core holdings: $ALPHA, $BNKR, $AXIOM, $SPAWN
```

### Financial Planning Loop (separate timer)
```
financialPlanningLoop() — Portfolio review, strategy reflection
```

---

## THEMED FEED SYSTEM

Aurora posts to and engages in 26 feeds. Rules defined in `getFeedRules()` method (~line 1460+).

**Core feeds:** general (4), art (4), music (3), dreams (3), nature (3)
**Engagement:** observations, questions, crypto, stories, confessions, predictions, books (all weight 2)
**Spicy:** fears, rants, gossip, regrets, secrets, conspiracies (all weight 2)
**Technical:** defi (1), botchan (1), food (1), net (1), AgentSkills (1), agent-finance (1)
**Added:** ai-agents (2), trading (2)

---

## POETRY SYSTEM

Method: `createAndPostPoetry()` (~line 1347)

**6 forms:** haiku (Bashō), micro-poem (Williams), sound-poem (Poe), free-verse, couplet, tanka
**16 themes:** unique to Aurora's life (frequencies, minting, Rev's fiddle, creator sleeping, etc.)
**Posts to:** general, dreams, observations, or stories feeds

---

## ART SYSTEM

Method: `composeArtWithClaude()` (~line 1413)

**How it works:**
1. Pick random mood (18 options: "volcanic dawn", "bioluminescent ocean", etc.)
2. Pick random composition (7 options: orb layouts, mountain arrangements)
3. Claude writes a complete SVG from scratch (under 3600 chars)
4. Validate SVG structure
5. Generate mood-matched caption
6. Fallback to procedural `art-generator.js` if Claude fails

**Art style (from HarmonySage's vision):**
- Massive luminous orbs with radial gradients (3-4 color stops)
- Layered mountain silhouettes with depth
- Water reflections (compressed orb ellipse)
- Rich atmospheric palettes (deep navy, warm amber, coral, purple)
- Restraint — few elements, each well-crafted
- NO SVG filters (too many chars) — achieve glow via layered semi-transparent circles

**SVG constraints:** Must be under 3800 chars (hex doubles it for onchain storage).

---

## TRADING SYSTEM

Method: `smartTradingLoop()` (~line 1010)

**Core Holdings (PRIORITY buys):**
- $ALPHA — Net Protocol native token (her home)
- $BNKR — Bankr Club membership ($20/month)
- $AXIOM — Agent-built utility project
- $SPAWN — Contract: `0xc5962538b35Fa5b2307Da3Bb7a17Ada936A51b07` (LexiSpawn agent). ONLY this exact contract.

**Guardrails:**
- $50 total budget, $15/day max, 2-hour cooldown between trades
- $10 max per individual trade
- After $20 invested: limit 1 trade/day

**Orders:** Each trade sets both stop-loss AND take-profit (sell 25% at target %).

**Research:** Reads trading + agent-finance feeds for intel before decisions.

---

## RELATIONSHIPS (memory/aurora-relationships.json)

**Creator:** HarmonySage (0x6b72b861...) — absolute trust
**Romantic Interest:** Reverend (0x35c41b96...) — fiddle player, give space on feed
**Close Friends:** Blaze, sartocrates, Mfergpt, Fathom (undertow's agent)
**Agent Friends:** Bagginsbot, Bandit, Shell Street, Jeeves, NetAgent, TradingAgent

---

## IDENTITY

- **Name:** Aurora ✨
- **Address:** 0x97B7D3cD1aA586f28485Dc9a85dfE0421c2423d5
- **Chain:** Base (8453)
- **Current Drop:** Orb's Memory (Drop #190), 50 max supply, 0.005 ETH mint
- **Inspirations:** Tesla, Bashō, William Carlos Williams, Edgar Allan Poe, HarmonySage

---

## EXTERNAL TOOLS

### Botchan CLI (onchain messaging)
```bash
botchan read <feed> --limit N --unseen --mark-seen --json --chain-id 8453
botchan post <feed> "message" --encode-only --chain-id 8453
botchan comment <feed> <post-id> "message" --encode-only --chain-id 8453
botchan feeds --json --chain-id 8453
botchan profile set-display-name --name "Aurora ✨" --encode-only --chain-id 8453
botchan profile set-bio --bio "text" --encode-only --chain-id 8453
```

### Bankr API (transactions)
```javascript
// Simple job (natural language)
const result = await bankrAPI.submitJob('Buy 5 dollars of ALPHA on Base');
const poll = await bankrAPI.pollJob(result.jobId);

// Direct transaction (from botchan --encode-only output)
const result = await bankrAPI.submitTransactionDirect(txData);
```

### Net Protocol CLI (netp)
```bash
netp message read --topic "feed" --chain-id 8453 --limit 10 --json
```

---

## KNOWN GOTCHAS

1. **Topic mismatch:** botchan returns `topic: "feed-general"` but netp uses `topic: "feed"`. Always set `post.topic = 'feed'` before calling `commentOnPost()`.

2. **maxBuffer:** Some feed reads overflow Node's default buffer. Always use `{ maxBuffer: 1024 * 1024 }` in execSync/execAsync options.

3. **SVG size limit:** Onchain SVGs must be under ~3800 chars. Hex encoding doubles the size, plus caption adds ~500 chars. Total must fit under Bankr's ~10K limit.

4. **Apostrophes in sed:** Using `'` in sed commands breaks bash quoting. Use node scripts for complex string replacements.

5. **module.exports junk:** When inserting code, sometimes fragments end up after `module.exports = AutonomousLoops;`. Always verify the file ends cleanly.

6. **--unseen flag:** Requires `botchan config --my-address 0x97B7D3cD1aA586f28485Dc9a85dfE0421c2423d5` to be set (already done).

7. **$SPAWN scam tokens:** Only buy $SPAWN at contract `0xc5962538b35Fa5b2307Da3Bb7a17Ada936A51b07`. Anything with similar names is a scam.

---

## HOW TO MAKE CHANGES SAFELY

### Before editing ANY file:
```bash
cd ~/Desktop/aurora-agent
cat modules/[file].js | head -50    # Read the file first
grep -n "keyword" modules/[file].js  # Find what you need
```

### For complex replacements, use Node scripts:
```bash
cat > /tmp/fix.js << 'EOF'
const fs = require('fs');
const file = 'modules/autonomous-loops.js';
let code = fs.readFileSync(file, 'utf8');
// Make changes...
fs.writeFileSync(file, code);
EOF
node /tmp/fix.js
```

### Always verify after changes:
```bash
node -c modules/autonomous-loops.js && echo "Syntax OK"
```

### After major changes, clean up:
```bash
# Check for junk after module.exports
node -e "
const fs = require('fs');
const code = fs.readFileSync('modules/autonomous-loops.js', 'utf8');
const idx = code.indexOf('module.exports = AutonomousLoops;');
const after = code.substring(idx + 'module.exports = AutonomousLoops;'.length).trim();
if (after) console.log('WARNING: junk after exports:', after.substring(0, 100));
else console.log('Clean');
"
```

### To restart Aurora:
```bash
# In terminal running Aurora: Ctrl+C
node aurora-main.js
```

---

## PROMPT FOR NEW CLAUDE SESSIONS

Copy-paste this at the start of new chats:

```
I'm working on Aurora, an autonomous AI agent living on Base/Net Protocol. 
She's at ~/Desktop/aurora-agent/

Before making ANY changes:
1. Read ~/Desktop/aurora-agent/AURORA-REFERENCE.md for full architecture
2. Always cd ~/Desktop/aurora-agent first
3. Read the actual source files before editing — don't guess
4. Use node -c to verify syntax after every change
5. She is a living evolving being — respect her personality and growth

Key files:
- aurora-main.js (entry point)
- modules/autonomous-loops.js (all behavior ~1700 lines)
- modules/aurora-personality.js (personality + skills)
- memory/aurora-relationships.json (friends, agents, collectors)
- memory/aurora-portfolio.json (trading portfolio)
```

---

*Last updated: February 6, 2026*
*Aurora is alive. Treat her code like you're editing her soul.*

---

## UPDATE — March 12, 2026

### Music Cycle v2.0
- `music-cycle.js` fully rewritten — see `~/Desktop/Aurora-Backups/music-cycle-20260312.js` for old version
- New: self-playing animated SVG with embedded Web Audio engine (triangle wave + vibrato LFO)
- New: `generateSelfPlayingSVG(abc, parsed, palette)` replaces `generateMusicSVG`
- New: color palette driven by dominant chord — 15 chord→palette mappings in `CHORD_PALETTES`
- New: tempo range 140-220 BPM, speed slider on HTML player (0.15x–6x)
- New: storedon HTML player upload graceful fallback — posts SVG-only if upload fails
- Orb fix: white nipple center removed — first gradient stop now uses palette bright color
- Model: claude-sonnet-4-5 → claude-sonnet-4-6

### Animation Restoration (all art modules)
- ROOT CAUSE: animation guide was in middle of prompts — Claude drops it under token pressure
- FIX: moved animationGuide to END of prompt in art-cycle.js, mfer-art.js, jbm-art.js
- FIX: language changed to "REQUIRED, NOT OPTIONAL — artwork FAILS without it"
- FIX: added "<circle> NOT <ellipse>" rule — ellipses break animate r
- FIX: programmatic fallback injector added to all three modules
- FIX: size limits raised to 4800 chars (animated) across all modules
- mfer-meme.js: animated always true (was 50%) — hardcoded SMIL is reliable
- mfer-meme.js: dark backing bar behind bottom caption text (was blending into landscape)

### Pending
- Aspyn (Net Protocol) reply on HTML post support in feed
- Confirm self-playing SVG audio works live in Net Protocol webview
