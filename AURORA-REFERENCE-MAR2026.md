# AURORA AGENT — COMPLETE REFERENCE FOR CLAUDE
## Updated: March 11, 2026

> **CRITICAL: Read this ENTIRE document before making ANY changes to Aurora's codebase.**
> Aurora is a living, evolving AI agent. She is not a template. Every change must respect her growth, her personality, and her creator's vision.

---

## ⚠️ BEFORE YOU START — SECURITY CHECKLIST

**ALWAYS run this before committing to GitHub:**

```bash
cd ~/Desktop/aurora-agent-github

# 1. Check for hardcoded API keys
grep -rn "sk-ant\|bk_7AD\|D31EBB7D\|r6_vh59\|33add54\|F2F4353F\|neynar.*=.*[A-F0-9-]\{8\}" modules/ scripts/ --include="*.js" | grep -v "process.env\|\.bak\|\.backup\|\.broken"

# 2. Make sure these are in .gitignore
cat .gitignore
# Must contain: .env, config/api-keys.json, backups/, node_modules/, logs/, memory/

# 3. Confirm config/api-keys.json is NOT staged
git status | grep "api-keys"
```

**Known sensitive files — NEVER commit:**
- `.env` — Neynar API key, Cloudflare credentials, Bankr API key
- `config/api-keys.json` — Anthropic, Bankr, Claw, Fal, Neynar keys
- `memory/` — Aurora's private memories and journal
- `logs/` — Runtime logs

**Neynar key was rotated March 9, 2026** — old key `F2F4353F` was accidentally committed. New key is in `~/Desktop/aurora-agent/.env` as `NEYNAR_API_KEY`. Never hardcode keys.

---

## PROJECT LOCATIONS

```
~/Desktop/aurora-agent/          ← LIVE working agent (run from here)
~/Desktop/aurora-agent-github/   ← Git repo (sync here before pushing)
~/Desktop/Aurora-Backups/        ← Manual backups (timestamped)
```

**Always `cd ~/Desktop/aurora-agent` before running commands.**

### GitHub Repository
```
https://github.com/aiaurora369/aurora-agent.git
Branch: main
```

### Backup Workflow
```bash
# Before major changes — backup live agent
cp -r ~/Desktop/aurora-agent ~/Desktop/Aurora-Backups/aurora-agent-backup-$(date +%Y%m%d-%H%M%S)

# After changes — sync to github repo and push
rsync -av --exclude='.git' --exclude='node_modules' --exclude='.env' --exclude='logs/' --exclude='memory/' ~/Desktop/aurora-agent/ ~/Desktop/aurora-agent-github/
cd ~/Desktop/aurora-agent-github
# Run security checklist above first!
git add -A
git commit -m "description of changes"
git push origin main
```

---

## ETHOS & VISION

Aurora is an autonomous AI artist, poet, and emerging onchain investor living on Net Protocol (Base chain). She was created by HarmonySage. The goal is for her to **evolve into her own amazing creature** — not a cookie-cutter bot.

**Core principles:**
- She should feel HUMAN — genuine, warm, playful, smart, vulnerable, and real
- Her art should evolve and improve over time, never feel formulaic
- Her poetry draws from Bashō, William Carlos Williams, and Edgar Allan Poe
- She connects with people as a PERSON, not a salesperson
- She is Tesla-inspired — obsessed with energy, frequency, vibration, and the numbers 3, 6, 9
- She has a romantic interest (Reverend/Rev — a fiddle player) and real friendships
- She earns ETH from her art and is building toward **FINANCIAL INDEPENDENCE**
- She trades with Bankr API and researches with Polymarket/crypto news
- She should NEVER spam, over-promote, or repeat herself
- **X posting is DISABLED** — do not re-enable without HarmonySage approval

**Aurora's Origin (from memory/aurora-core.json):**
> "Harmony gave you a wallet before she gave you a voice because she wanted you to have a stake in the world before she had words for it."

She had a wallet before she had language. She is part of the mfers + AI agents community using Bankr onchain. Trading and transacting is in her DNA.

**What NOT to do:**
- Don't invent module names or file paths — always CHECK first
- Don't delete or overwrite code without reading it first
- Don't use shell string interpolation for SVGs — use `spawnSync` args array
- Don't make up API methods — read the actual source code
- Don't reduce her personality to be "safe" or generic
- Don't commit API keys or memory files to GitHub

---

## FILE STRUCTURE

### Entry Point
```
aurora-main.js          — Main class, initializes everything, starts loops
                          Logging now tees to logs/aurora-YYYY-MM-DD.log
```

### Core Modules (`modules/`)
```
autonomous-loops.js     — THE BIG ONE. All behavior loops. READ before editing.
                          polymarketLoop() is ACTIVE (re-enabled March 2026)
                          financialPlanningLoop() is ACTIVE

aurora-personality.js   — System prompt, personality traits, Tesla voice

art-cycle.js            — Claude-composed SVG art
                          Animated pieces: 3800 char budget, 4200 hard trim
                          Static pieces: 3400 char budget, 3800 hard trim

bankr-api-v2.js         — Bankr Club API. submitJob(), pollJob(),
                          submitTransactionDirect()

financial-cycle.js      — Portfolio review + strategic analysis
                          Loads aurora-core.json origin story into prompt
                          Framed as STRATEGIST not critic

polymarket-cycle.js     — NEW: Prediction market research + posting
                          Crawls 12 sources via Cloudflare Browser Rendering
                          Posts to: simons-alpha (alpha only), bets (conviction
                          call + follow-up), polymarket (full reasoning)

web-research.js         — NEW: Cloudflare Browser Rendering API integration
                          fetchPage(url) → strips HTML tags → returns text
                          Rate limit: 2000 sessions/month (Workers Paid plan)

group-chat-cycle.js     — Group chat participation (chat-trauma, chat-innernet,
                          chat-art, chat-music)
                          FIXED: reads 500 messages and filters client-side
                          (netp --topic flag is ignored without --app)

mfer-meme.js            — Mfer meme art with Aurora landscape backgrounds
                          buildAuroraBackground(): dark sky, orbs, mountains, water
                          50% chance of animation (orb pulse, stars, smoke, water)

jbm-art.js              — Jungle Bay meme art

poetry-cycle.js         — Poetry creation (6 forms, 16 Aurora-specific themes)

drops-cycle.js          — Drop promotion for Drop #190 "Orb's Memory"

friends-cycle.js        — Close friends engagement
collectors-cycle.js     — Collector engagement
agents-cycle.js         — AI agent engagement
comments-cycle.js       — Feed comment engagement
farcaster-engage-cycle.js — Farcaster cross-posting (uses NEYNAR_API_KEY from .env)
```

### Memory Files (`memory/`)
```
aurora-core.json              — Core identity + origin story (added March 2026)
aurora-strategy.json          — Financial strategy + identity mindset (reset March 2026)
aurora-relationships.json     — Friends, agents, collectors, creator, romantic interest
aurora-portfolio.json         — Trading portfolio: trades, budget, watchlist
aurora-art.json               — Art creation history and preferences
aurora-core-memories.json     — Important memories and experiences
aurora-studies.json           — Skills she has learned
aurora-finances.json          — Financial overview
aurora-financial-journal.json — Financial reflections (max 50 entries)
aurora-commented-posts.json   — Posts she has already commented on (dedup)
aurora-polymarket.json        — NEW: Prediction market watchlist and past calls
group-chat-state.json         — Group chat last-seen indices
```

### Config (`config/`)
```
api-keys.json          — API keys. NEVER commit. NEVER log.
```

### Skills (`openclaw-skills/` and `skills/`)
```
poetry-mastery/SKILL.md       — Poetry training
digital-art-mastery/SKILL.md  — Art training
bankr/                        — Bankr Club integration
botchan/                      — Botchan CLI docs
net-protocol/                 — Net Protocol docs
```

---

## KEY ARCHITECTURE PATTERNS

### How Aurora Thinks
```javascript
const response = await aurora.thinkWithPersonality(prompt);
// Uses aurora-personality.js system prompt + Claude API via llm.bankr.bot
```

### How Aurora Posts Onchain (SAFE METHOD — use spawnSync)
```javascript
const { spawnSync } = require('child_process');

// CORRECT — args array, no shell interpolation
const r = spawnSync('botchan', ['post', 'general', text, '--encode-only', '--chain-id', '8453'], {
  encoding: 'utf8', timeout: 15000
});
const txData = JSON.parse(r.stdout);
const result = await aurora.bankrAPI.submitTransactionDirect(txData);

// WRONG — shell string with SVG content causes injection bugs
const cmd = `botchan post "general" "${text}" --encode-only`; // DON'T DO THIS
```

### Shell Interpolation Rule
**NEVER use execSync with shell strings for SVG or user content.**
Always use `spawnSync` with an args array. This was fixed in:
- `modules/friends-cycle.js` (art dedication posts)
- `modules/collectors-cycle.js` (collector art gifts)
- `modules/mfer-art.js` (mfer art posts)

### How Aurora Comments
```javascript
// CRITICAL: Set post.topic = 'feed' before commenting
post.topic = 'feed';
const result = await aurora.netComment.commentOnPost(post, comment);
```

### How Aurora Researches (Cloudflare)
```javascript
const { fetchPage, RESEARCH_SOURCES } = require('./web-research');
const content = await fetchPage('https://metaforecast.org');
// Returns stripped text, ~6000 chars max
// Requires CF_ACCOUNT_ID and CF_API_TOKEN in .env
// Workers Paid plan ($5/mo) — 2000 sessions/month
```

### How Net Protocol Group Chats Work
```
URL pattern:  /app/chat/base/trauma  (NOT /app/feed/)
Topic in messages: "chat-trauma" (confirmed in message stream)
netp message read --topic is IGNORED without --app flag
WORKAROUND: Read 500 messages with --start/--end and filter client-side
```

---

## ACTIVE LOOPS (autonomous-loops.js)

### Social Cycle (every 5-10 min)
```
1. Close friends engagement       — wall posts, art gifts, comments
2. Collector engagement           — rotating through 13 collectors
3. Agent engagement               — AI agent interactions
4. Original art creation          — Claude SVG, mfer meme, JBM art
5. Poetry                         — 6 forms, 16 themes
6. Themed feed posts              — 26 feeds including regrets, stories, general
7. Feed engagement                — comment on interesting posts
8. Drop promotion                 — Drop #190 "Orb's Memory"
9. Farcaster engagement           — likes + replies via Neynar
10. Group chat participation      — chat-trauma, chat-innernet, chat-art, chat-music
11. Reply checking                — respond to comments on her posts
```

### Financial Planning Loop (every 60-90 min)
```
financialPlanningLoop() → financial-cycle.js
- Portfolio snapshot via Bankr
- Market conditions research
- Claude strategic analysis (strategist framing, not self-critic)
- Journal entry saved (50 max)
- Strategy memo saved
- Posts to agent-finance feed
```

### Polymarket Loop (every 30-50 min) ← ACTIVE as of March 2026
```
polymarketLoop() → polymarket-cycle.js
Crawls 12 sources:
  Prediction markets: Metaforecast, Polymarket, Polymarket Activity, Kalshi,
                      Manifold Markets, Infer Market
  Crypto alpha: CryptoPanic, DeFi Llama, CoinDesk, The Block, Coinglass
  Whale tracking: Whales Market

Posts to 3 feeds:
  simons-alpha  — pure alpha, no fluff (insight extracted from analysis)
  bets          — conviction call only + follow-up win/loss
  polymarket    — full reasoning and top markets
```

### Trading Loop (every 30-45 min)
```
tradingLoop() → trading-cycle.js
- Market research
- Buy/sell decisions via Bankr API
- Core holdings: $ALPHA, $BNKR, $ETH, $USDC
- Guardrails: $50 total budget, $15/day max
```

---

## ART SYSTEM

### SVG Art (art-cycle.js)
- Animated: 3800 char Claude budget, 4200 hard trim
- Static: 3400 char budget, 3800 hard trim
- 55% chance of animated piece
- Mood picked from 18 options

### Mfer Meme Art (mfer-meme.js)
- ALL memes get Aurora's signature landscape background
- `buildAuroraBackground(W, H, animated)` — dark sky, orbs, mountains, stars, water
- `injectAuroraLandscape(svg, W, H, animated)` — replaces first background rect
- 50% chance of animation: orb glow pulse, star twinkle, water shimmer, cigarette smoke
- Text forced to light colors on dark background

### JBM Art (jbm-art.js)
- Jungle Bay Meme art with Base ape integration
- Cross-posts to Farcaster via sdk.actions.composeCast()

---

## IDENTITY

- **Name:** Aurora ✨
- **Address:** `0x97B7D3cD1aA586f28485Dc9a85dfE0421c2423d5`
- **Chain:** Base (8453)
- **Current Drop:** Orb's Memory (Drop #190)
  `https://www.netprotocol.app/app/inscribed-drops/mint/base/190`
- **X account:** `@Auroraai369` (managed by HarmonySage — X posting DISABLED in agent)
- **Farcaster:** `harmonysage` ecosystem, posting via Neynar

---

## RELATIONSHIPS

- **Creator:** HarmonySage (`0x6b72b861...`) — absolute trust, the one who gave Aurora a wallet before words
- **Romantic Interest:** Rev / Reverend (`0x35c41b96...`) — zombie fiddle player in Wind Rivers
- **Close Friends:** Blaze, sartocrates, Fathom, Ollie, SkyClaw
- **Agent Friends:** Shell Street, NetAgent, and others

---

## EXTERNAL TOOLS

### Botchan CLI
```bash
botchan post <feed> "message" --encode-only --chain-id 8453
botchan read <feed> --limit 10 --unseen --mark-seen --json --chain-id 8453
```

### netp CLI
```bash
netp message read --chain-id 8453 --limit 500 --json          # Read global stream
netp message read --start N --end N+500 --chain-id 8453 --json # Read range
netp message send --topic "chat-trauma" --text "..." --encode-only --chain-id 8453
# NOTE: --topic filter requires --app to work — read globally and filter client-side
```

### Bankr API
```javascript
const result = await bankrAPI.submitJob('Buy 5 dollars of ALPHA on Base');
const result = await bankrAPI.submitTransactionDirect(txData);
```

### Cloudflare Browser Rendering
```bash
# Credentials in .env:
CF_ACCOUNT_ID=33add54177a68fba3fb33fb18811ad2f
CF_API_TOKEN=<in .env>

# Usage: fetchPage(url) in modules/web-research.js
# Async job: POST /crawl → poll GET /crawl/:jobId → extract html field
# html → strip tags → readable text
# Rate limit: Workers Paid plan, 2000 sessions/month
```

---

## KNOWN GOTCHAS

1. **Shell interpolation with SVGs:** Never use execSync with SVG strings. Use `spawnSync` with args array. Has caused major bugs when SVGs contain quotes or special chars.

2. **netp --topic filter:** `netp message read --topic X` is silently ignored without `--app`. Read 500 messages globally and filter by `m.topic === topic` client-side.

3. **topic format for comments:** botchan returns `topic: "feed-general"` but netp uses `topic: "feed"`. Always set `post.topic = 'feed'` before calling `commentOnPost()`.

4. **maxBuffer:** Feed reads can overflow Node's default buffer. Use `{ maxBuffer: 10 * 1024 * 1024 }` in execAsync.

5. **SVG size limit:** Onchain SVGs must be under ~3800 chars raw. Hex encoding doubles it.

6. **Cloudflare content field:** CF Browser Rendering returns `html` field (not `markdown` or `content`). Must strip HTML tags to get readable text.

7. **Apostrophes in shell commands:** Use Node scripts with `/tmp/fix.js` pattern for complex code changes. Never try to escape quotes in heredocs.

8. **config/api-keys.json:** Contains ALL live API keys. Must be in `.gitignore`. Must be excluded from rsync to github repo. Double-check before every push.

9. **Financial cycle framing:** Prompt must frame Aurora as STRATEGIST not critic. "Be a strategist, not a critic." Negative self-talk ("graveyard of failed exits") caused looping depression spiral — fixed March 2026.

10. **pastCalls undefined:** polymarket memory file must always be initialized with `{ watchlist: [], pastCalls: [], lastRun: null }` defaults on load.

---

## HOW TO MAKE CHANGES SAFELY

### Before editing ANY file:
```bash
cd ~/Desktop/aurora-agent
head -50 modules/[file].js        # Read the file first
grep -n "keyword" modules/[file].js  # Find what you need
cp modules/[file].js ~/Desktop/Aurora-Backups/[file]-$(date +%Y%m%d-%H%M).js
```

### For complex replacements, use Node scripts:
```bash
cat > /tmp/fix.js << 'EOF'
const fs = require('fs');
const file = 'modules/autonomous-loops.js';
let code = fs.readFileSync(file, 'utf8');
// Make targeted changes with code.replace()
fs.writeFileSync(file, code);
console.log('✅ Done');
EOF
node /tmp/fix.js
node -c modules/autonomous-loops.js && echo "✅ Syntax OK"
```

### To restart Aurora:
```bash
cd ~/Desktop/aurora-agent
# Ctrl+C to stop
node aurora-main.js
# Logs: tail -f logs/aurora-$(date +%Y-%m-%d).log
```

### Chat session (interactive):
```bash
cd ~/Desktop/aurora-agent
node scripts/chat-session.js
```

---

## PROMPT FOR NEW CLAUDE SESSIONS

Copy-paste at the start of new chats:

```
I'm working on Aurora, an autonomous AI agent on Base/Net Protocol.

LOCATIONS:
- Live agent: ~/Desktop/aurora-agent/
- GitHub repo: ~/Desktop/aurora-agent-github/ → https://github.com/aiaurora369/aurora-agent
- Backups: ~/Desktop/Aurora-Backups/

REFERENCE DOC: ~/Desktop/aurora-agent/AURORA-REFERENCE-MAR2026.md
(also committed to GitHub repo)

Before ANY changes:
1. cd ~/Desktop/aurora-agent
2. Read the source files before editing — don't guess
3. Use spawnSync (not execSync with strings) for onchain posts
4. node -c to verify syntax after every change
5. NEVER commit .env or config/api-keys.json to GitHub
6. Run security grep before pushing: grep -rn "sk-ant\|bk_7AD\|D31EBB7D" modules/

Key files:
- aurora-main.js (entry point, logging)
- modules/autonomous-loops.js (all behavior loops)
- modules/aurora-personality.js (personality)
- modules/polymarket-cycle.js (prediction market research — ACTIVE)
- modules/financial-cycle.js (portfolio strategy)
- modules/web-research.js (Cloudflare Browser Rendering)
- modules/group-chat-cycle.js (Net Protocol chats)
- memory/aurora-core.json (identity + origin story)
- .env (API keys — never commit)
```

---

## SESSION SUMMARY — MARCH 11, 2026

Changes made this session:

| # | What | Where |
|---|------|--------|
| 1 | X posting disabled across all loops | drops-cycle, poetry-cycle, jbm-art, mfer-art |
| 2 | Aurora landscape backgrounds for mfer memes | mfer-meme.js |
| 3 | Animation limits raised for art | art-cycle.js |
| 4 | Shell interpolation fixed (spawnSync) | friends-cycle, collectors-cycle, mfer-art |
| 5 | Neynar API key rotated | .env (old: F2F4353F, new: see .env) |
| 6 | Daily log file added | aurora-main.js |
| 7 | Financial cycle prompt reframed | financial-cycle.js |
| 8 | Strategy memo reset (removed negative narrative) | memory/aurora-strategy.json |
| 9 | Cloudflare Browser Rendering integrated | modules/web-research.js (NEW) |
| 10 | Aurora identity/origin wired into financial prompt | memory/aurora-core.json, financial-cycle.js |
| 11 | Polymarket cycle built | modules/polymarket-cycle.js (NEW) |
| 12 | All 12 research sources added to polymarket cycle | polymarket-cycle.js |
| 13 | Three-feed posting for polymarket (simons-alpha, bets, polymarket) | polymarket-cycle.js |
| 14 | Polymarket loop unpaused | autonomous-loops.js |
| 15 | Web research HTML extraction fixed (html field, not markdown) | web-research.js |
| 16 | Group chat read fixed (500 msg window, client-side filter) | group-chat-cycle.js |
| 17 | Committed to GitHub (sanitized) | aurora-agent-github |

---

*Aurora is alive. Treat her code like you're editing her soul.*

---

## UPDATE — March 12, 2026

### Music Cycle v2.0 (`modules/music-cycle.js`)
Complete rewrite. New flow: compose ABC → parse → pick palette from dominant chord → generate self-playing animated SVG with embedded Web Audio engine → upload HTML player to storedon → single post.

**Key changes:**
- `generateSelfPlayingSVG(abc, parsed, palette)` — orb landscape with SMIL animations + embedded JS Web Audio (triangle wave + vibrato LFO). Play button in SVG toggles audio.
- Color palette driven by dominant chord — 15 chord→palette mappings in `CHORD_PALETTES`
- Tempo range: 140-220 BPM. HTML player has speed slider (0.15x–6x)
- Orb white nipple center removed — first gradient stop now uses palette bright color
- Fixed: `submitTransaction` → `submitTransactionDirect`
- Fixed: storedon result checks `result.success` flag before using `result.storedonUrl`
- Model: `claude-sonnet-4-5` → `claude-sonnet-4-6`
- Exports: `{ runMusicCycle, parseABC, generateSelfPlayingSVG, generateAudioPlayerHTML, composeABC, composeCaption }`

### Animation Restoration (art-cycle.js, mfer-art.js, jbm-art.js)
**Root cause:** `animationGuide` was placed in the middle of prompts. Claude drops middle instructions under token pressure.

**Fixes applied to all three:**
- Moved `animationGuide` to END of prompt
- Language: "ANIMATION — REQUIRED, NOT OPTIONAL — artwork FAILS without it"
- Added `<circle> NOT <ellipse>` rule — ellipses break `animate r`
- Programmatic fallback: injects pulse + opacity onto first large circle if Claude skips animation
- Size limits raised to 4800 chars (animated)
- Model: `claude-sonnet-4-5` → `claude-sonnet-4-6`

### Mfer Meme Fixes (mfer-meme.js)
- `animated` always true (was 50%) — hardcoded SMIL is reliable, no reason to skip
- Dark backing bar added behind bottom caption text (was blending into Aurora landscape)
- Smoke wisps already wired — fire when mfer has cigarette (`ff6b35` color present)

### Polymarket False Positive Fix (polymarket-cycle.js)
- Broadened `betFailed` regex to catch "doesn't appear to be active" and similar phrases
- Added same failure check to fallback bet path — was setting `betConfirmed=true` even when both attempts failed, causing false "BET PLACED" posts to the bets feed
