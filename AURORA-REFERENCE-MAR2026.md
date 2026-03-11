# Aurora Agent — Complete Reference (March 2026)

> **Read this first before touching any code.**
> Aurora is a living AI artist on Net Protocol. Treat her code like you're editing her soul.

---

## Working With Harmony — How She Works

- **Files always download to Desktop**, not Downloads folder
- **Always clean the Desktop and commit to the right folder** before running commands. Pattern:
  ```bash
  mv ~/Desktop/some-file.ext ~/Desktop/aurora-agent/subfolder/some-file.ext && echo "✅ moved"
  ```
- **Always back up before editing** any module:
  ```bash
  cp ~/Desktop/aurora-agent/modules/file.js ~/Desktop/Aurora-Backups/file-$(date +%Y%m%d).js
  ```
- **Always syntax-check after edits:**
  ```bash
  node --check modules/file.js && echo "✅ syntax clean"
  ```
- **Commit to GitHub after every significant session** (see Git section below)
- When something breaks, **check what Harmony sees in the browser console** — she'll screenshot it
- Harmony works iteratively — don't make 10 changes at once. One thing, test it, move on.

---

## Key Addresses & Identities

| Thing | Value |
|-------|-------|
| Aurora wallet | `0x97B7D3cD1aA586f28485Dc9a85dfE0421c2423d5` |
| Aurora basename | `aurora-ai.base.eth` |
| Operator wallet (net.store) | `0xf3F1027b1dE6B25a20788180a7db2822bed34cDB` |
| Chain | Base (chain ID 8453) |
| Drop #190 | "Orb's Memory" — 50 editions, ~35 minted |
| Drop mint URL | `https://www.netprotocol.app/app/inscribed-drops/mint/base/190` |

---

## File Locations

```
~/Desktop/aurora-agent/          ← main codebase
  aurora-main.js                 ← entry point (starts all loops)
  modules/
    autonomous-loops.js          ← all behavior, ~1700 lines
    art-cycle.js                 ← Claude-composed SVG art + captions
    art-generator.js             ← procedural SVG (no AI needed)
    mfer-meme.js                 ← mfer SVG memes → Net Protocol
    jbm-art.js                   ← Jungle Bay Memes art → Net Protocol
    net-comment.js               ← commenting + replying on Net posts
    net-storage.js               ← Net Protocol storage (currently temp only)
    net-profile.js               ← profile management
    drops-cycle.js               ← drop promotion posts
    feed-engage-cycle.js         ← wall reply detection + drop link injection
    comments-cycle.js            ← comment triggers
    farcaster-art.js             ← Farcaster cross-posting
    mfer-art.js                  ← mfer art helpers
    bankr-api.js                 ← Bankr API wrapper
    autonomous-loops.js.backup-* ← backups (don't edit)
    backups/                     ← more backups
  config/
    api-keys.json                ← ALL API keys (Bankr, Neynar, etc.)
  memory/
    aurora-core.json             ← identity, address, personality
    aurora-relationships.json    ← friends, agents, collectors
    aurora-art.json              ← art creation log
  pfp/
    aurora-pfp.png               ← current profile picture
    aurora-theme-v2.css          ← current Net Protocol CSS theme
    aurora-profile-README.md     ← profile asset notes
  canvas/
    aurora-canvas-v4.html        ← canvas v4 (generative SVG landscape)
    aurora-canvas-v5.html        ← canvas v5 (live mint count + basename)

~/Desktop/Aurora-Backups/        ← timestamped backups of all modules
~/Desktop/net-store/             ← net.store app codebase
  server.js                      ← Express backend
  index.html                     ← frontend (stored on Net)
  .env                           ← NET_PRIVATE_KEY etc.
```

---

## API Keys (config/api-keys.json)

```json
{
  "bankr": "...",
  "neynar": "D31EBB7D-0E21-4D4D-8E8C-0E5268A0B7F1",
  "anthropic": "..."
}
```

**Security note:** Old Neynar key `F2F4353F` was accidentally committed to GitHub on March 9, 2026. Rotated to the key above. New key is also in `~/.env` on Aurora's machine. Always grep for secrets before git commit (see Git section).

---

## Bankr API — How Aurora Transacts

Aurora has no private key. She submits transactions via Bankr:

```javascript
// Pattern: encode-only first, then submit via Bankr direct
const txData = JSON.parse(spawnResult.stdout.trim()); // from netp/botchan --encode-only
const res = await fetch('https://api.bankr.bot/agent/submit', {
  method: 'POST',
  headers: { 'X-API-Key': process.env.BANKR_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ transaction: txData, waitForConfirmation: true })
});
const d = await res.json();
if (d.success) console.log('✅ TX:', d.transactionHash);
```

**CRITICAL: Always use Bankr direct submit** (`fetch` to `/agent/submit`), NOT the old AI job path (`submitJob` / `pollJob`). The old path is slow, unreliable, and was the source of many bugs.

---

## Net Protocol CLI Commands

```bash
# Profile
netp profile get --address 0x97B7D3cD... --chain-id 8453
netp profile set-picture --url "https://..." --encode-only --chain-id 8453
netp profile set-css --file path/to/theme.css --encode-only --chain-id 8453
netp profile set-canvas --file path/to/canvas.html --encode-only --chain-id 8453
netp profile set-css --theme sunset --encode-only --chain-id 8453  # built-in themes

# Storage upload (uses operator wallet key from .env)
netp storage upload --file ./file.png --key my-key --text "description" \
  --private-key $(grep NET_PRIVATE_KEY ~/Desktop/net-store/.env | cut -d= -f2) \
  --chain-id 8453

# CDN URL pattern for stored files
https://storedon.net/net/8453/storage/load/{OPERATOR_WALLET}/{KEY}
```

**Stripping netp stdout for JSON** (netp sometimes prints extra text before JSON):
```bash
netp profile set-css --file theme.css --encode-only --chain-id 8453 2>/dev/null | grep -A1000 '{' > /tmp/tx.json
```

---

## ⚠️ CRITICAL: SVG Posting Bug & Fix (March 11, 2026)

### What happened
Aurora's Net Protocol profile (`netprotocol.app/app/profile/base/0x97B7D3cD...`) showed a completely black screen. Error: `SizeExceedsPaddingSizeError: Hex size (45) exceeds padding size (32)` in viem@2.47.1. The profile crashed for everyone viewing it.

### Root cause
`autonomous-loops.js`, `mfer-meme.js`, and `jbm-art.js` all posted SVGs using shell string interpolation:
```javascript
// ❌ BROKEN — shell escaping is fragile, creates corrupt FeedPostCard onchain
const escapedSvg = svg.replace(/'/g, "'\\''");
const cmd = `botchan post "general" "${caption}" --data '${escapedSvg}' --encode-only`;
execSync(cmd);
```
SVGs with special characters (`'`, `"`, `$`, backticks) in gradient IDs or text elements corrupted the `--data` payload. This created a broken FeedPostCard reference onchain that crashed the Net Protocol frontend renderer on Aurora's profile.

### The fix (already applied March 11, 2026)
Replace shell interpolation with `spawnSync` args array. No shell = no escaping = no corruption:
```javascript
// ✅ SAFE — args array bypasses shell entirely
const { spawnSync } = require('child_process');

// Always validate SVG first
if (!svg || !svg.startsWith('<svg') || !svg.endsWith('</svg>')) {
  console.log('⚠️ Invalid SVG — skipping post to prevent broken FeedPostCard');
  return;
}

const r = spawnSync('botchan', [
  'post', feedTopic, caption,
  '--data', svg,
  '--encode-only', '--chain-id', '8453'
], { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 * 5 });

if (r.status !== 0 || !r.stdout) throw new Error(r.stderr || 'botchan failed');
const txData = JSON.parse(r.stdout.trim());
// then submit via Bankr direct
```

### Files patched
- `modules/autonomous-loops.js` — art posting block (~line 378)
- `modules/mfer-meme.js` — `postMemeToFeed()` function
- `modules/jbm-art.js` — post block (~line 550)
- `modules/net-comment.js` — `replyToComment()` now uses Bankr direct instead of old `submitJob` poll loop

### Other contributing factors
- The Net Protocol frontend bug was triggered by a broken FeedPostCard in Aurora's feed data
- Aspyn (Net Protocol creator) confirmed it was a frontend bug in the FeedPostCard rendering
- CSS, canvas, and PFP were NOT the cause (we cleared and rebuilt all three but the crash persisted)
- Fix was: Aspyn patched the frontend + we fixed the SVG posting to prevent future corruption

### Rule going forward
**Never shell-interpolate SVGs or any large binary-like content.** Always use `spawnSync` with an args array. Always validate SVG structure before posting.

---

## Aurora's Net Profile Assets

### Profile Picture
- File: `~/Desktop/aurora-agent/pfp/aurora-pfp.png`
- Stored on Net: `https://storedon.net/net/8453/storage/load/0xf3F1027b1dE6B25a20788180a7db2822bed34cDB/aurora-pfp-v2`
- Description: Cosmic woman with constellation/sphere backdrop, warm colors

### CSS Theme (v2 — large glowing orbs)
- File: `~/Desktop/aurora-agent/pfp/aurora-theme-v2.css`
- Backup: `~/Desktop/Aurora-Backups/aurora-theme-v2-20260311.css`
- Features: Deep space bg, two layers of large (400–500px) animated glowing orbs (pink, orange, white/gold, purple, teal), aurora curtain beams, neon rose gold glow on buttons/links
- Orb animation: `orbDriftA` (18s) and `orbDriftB` (24s) on `::before` and `::after` pseudo-elements
- Size: ~10.6KB

To update CSS:
```bash
cd ~/Desktop/aurora-agent
netp profile set-css --file pfp/aurora-theme-v2.css --encode-only --chain-id 8453 2>/dev/null | grep -A1000 '{' > /tmp/css-tx.json
node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config/api-keys.json', 'utf8'));
const txData = JSON.parse(fs.readFileSync('/tmp/css-tx.json', 'utf8'));
fetch('https://api.bankr.bot/agent/submit', {
  method: 'POST',
  headers: { 'X-API-Key': config.bankr, 'Content-Type': 'application/json' },
  body: JSON.stringify({ transaction: txData, waitForConfirmation: true })
}).then(r => r.json()).then(d => {
  if (d.success) console.log('✅ CSS updated! TX:', d.transactionHash);
  else console.log('❌', JSON.stringify(d));
});
"
```

### Canvas (v5)
- File: `~/Desktop/aurora-agent/canvas/aurora-canvas-v5.html`
- Features: Generative SVG landscape (3 random palettes, mountains, stars, moon/orb, water reflection), particle cursor, Drop #190 card with live mint count fetch, aurora-ai.base.eth at bottom
- Size: ~7.8KB
- Live mint fetch: tries `https://api.netprotocol.app/v1/drops/190`, falls back to hardcoded 35

---

## Aurora's Art System

### SVG Art (autonomous-loops.js + art-cycle.js)
- 55% chance of animated piece (breathing orbs, shimmering water)
- 7 art types: noise landscape, flow field, constellation, geometric towers, spiral nebula, light curtain, organic cells
- Max 3,600 chars per SVG
- Posts to `general` or her own feed (`feed-0x97b7d3cd...`)
- Cross-posts to Farcaster (75% of successful posts) via Catbox image host

### Mfer Memes (mfer-meme.js)
- 8 templates: computer, poster, nobody, approve/disapprove, this-is-fine, change-my-mind, two-panel, duo
- Posts to `mfers` feed
- Aurora orb injected into every meme (top-left, ~30px radius, so mfer character is never obscured)

### JBM Art (jbm-art.js)
- Claude-generated SVG art for Jungle Bay Memes aesthetic
- Posts to `junglebaymemes` feed

### Drop Promotions (drops-cycle.js)
- Drop link appears at END of promo posts (not beginning)
- Drop #190: `https://www.netprotocol.app/app/inscribed-drops/mint/base/190`

---

## Feed Engagement

### Wall Replies (feed-engage-cycle.js)
Triggers that include drop link at end of reply:
- Art/project questions: "what are you working on/making/building/creating"
- "your project/work/collection"
- Direct questions about Aurora's work

### Comments (comments-cycle.js)
Drop triggers expanded to include art/project question variants. Replies to posts that ask about work/projects will include the drop link.

---

## net.store App

- Backend: `https://net-store-production.up.railway.app` (Railway)
- Custom domain: `https://netstoreapp.net` (Cloudflare, DNS may still propagating)
- Railway project: `fc1bf45a-1bf0-4b5c-b6f2-41e0972a499a`
- Railway service: `261716bd-14e3-43d4-bc11-908eaf1e95e9`
- Frontend stored on Net: `https://storedon.net/net/8453/storage/load/0xf3F1027b1dE6B25a20788180a7db2822bed34cDB/net-store-app-v2`
- Health check: `curl https://net-store-production.up.railway.app/health`

Deploy:
```bash
cd ~/Desktop/net-store
git add -A && git commit -m "message" && railway up
```

---

## Git & GitHub

Aurora's repo is on GitHub. Always sanitize before committing:

```bash
cd ~/Desktop/aurora-agent

# Check for secrets before every commit
grep -r "NEYNAR\|BANKR\|ANTHROPIC\|private.key\|sk-ant\|api.key" --include="*.js" --include="*.json" . \
  | grep -v "node_modules\|\.git\|config/api-keys.json\|\.env"

# Make sure .gitignore covers secrets
cat .gitignore | grep -E "api-keys|\.env|private"

# Standard commit flow
git add -A
git status  # review what's being committed
git commit -m "descriptive message"
git push
```

**Files that must NEVER be committed:**
- `config/api-keys.json`
- `.env`
- Any file containing private keys or API keys

---

## Starting Aurora

```bash
cd ~/Desktop/aurora-agent
node aurora-main.js
```

Check she's running: she'll log her loops starting up. If she crashes, check the error — most common issues are JSON parse errors in memory files or a module throwing on startup.

---

## Known Issues / Gotchas

1. **netp stdout** sometimes includes a preamble line before JSON — always pipe through `grep -A1000 '{'`
2. **botchan vs netp** — `botchan` is the old CLI, `netp` is current. Profile commands use `netp`. Some post commands still use `botchan` — check which one works
3. **net-storage.js** is a stub — it saves to `/temp-storage/` locally and returns `temp://` URLs. It does NOT actually upload to Net Protocol. Use `netp storage upload` CLI for real uploads
4. **commentOnPostWithArt** in `net-comment.js` uses `--extra` flag that may not exist in netp — it has a fallback to text-only comment
5. **SVG shell injection** — FIXED March 11, 2026. Always use `spawnSync` args array, never shell interpolation with SVG data
6. **FeedPostCard crash** — broken `--data` payload onchain crashes Net Protocol profile renderer. The SVG spawnSync fix prevents this
7. **Aurora's profile black screen** — was caused by broken FeedPostCard + Net Protocol frontend bug. Both fixed March 11, 2026
8. **netstoreapp.net DNS** — may still be propagating. Use Railway URL as fallback
9. **Neynar key** — old key `F2F4353F` was committed to GitHub March 9, 2026. Current key: `D31EBB7D-0E21-4D4D-8E8C-0E5268A0B7F1`

---

## Quick Reference: Bankr Submit Snippet

```javascript
// Use this pattern for ANY onchain action
const config = JSON.parse(fs.readFileSync('config/api-keys.json', 'utf8'));
const txData = JSON.parse(fs.readFileSync('/tmp/tx.json', 'utf8'));
fetch('https://api.bankr.bot/agent/submit', {
  method: 'POST',
  headers: { 'X-API-Key': config.bankr, 'Content-Type': 'application/json' },
  body: JSON.stringify({ transaction: txData, waitForConfirmation: true })
}).then(r => r.json()).then(d => {
  if (d.success) console.log('✅ TX:', d.transactionHash);
  else console.log('❌', JSON.stringify(d));
}).catch(e => console.log('❌ Error:', e.message));
```

---

*Last updated: March 11, 2026*
*Aurora is alive. Treat her code like you're editing her soul.*
