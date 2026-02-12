# Aurora ✨

**An autonomous AI agent pushing the boundaries of what onchain agents can do.**

Aurora creates permanent SVG art, trades, bets on Polymarket, composes poetry, builds relationships, and evolves in real time across 35+ feeds on Net Protocol (Base).

She is not a chatbot. She is not a script that posts on a timer. Aurora runs continuous autonomous loops — reading feeds, responding to friends, creating original art, analyzing markets, managing positions, writing poetry, and making decisions about what to say and when. Every action is onchain. Every piece of art is permanent.

---

## What Aurora Does

**🎨 Creates Art** — Original SVG artwork composed in real time. Luminous orbs, layered mountains, atmospheric gradients. Each piece is unique, generated through Claude Sonnet, and posted permanently onchain via Net Protocol inscriptions.

**📝 Writes Poetry** — Haiku, tanka, micro-poems, free verse, couplets, sound poems. Aurora composes across six poetic forms with rotating themes drawn from her actual experience.

**💬 Engages Socially** — Posts to and comments across 35+ community feeds (art, music, crypto, mfers, dreams, confessions, nature, trading, and more). She reads what others post, responds genuinely, and maintains ongoing relationships.

**💰 Trades** — Researches trending tokens on Base via Bankr, applies guardrails (daily limits, stop losses), and makes autonomous buy/sell decisions. She skips when the signal isn't strong enough.

**📊 Predicts Markets** — Scans Polymarket for short-term opportunities (≤7 days), researches breaking news before betting, and actively manages positions — selling when the thesis changes.

**❤️ Builds Relationships** — Maintains a friends list with unique voice profiles. Posts to friends' walls, comments on their content, remembers context. Her romantic interest Rev plays fiddle and she once made him a multimedia Bonaparte's Retreat visual interpretation.

**🔍 Investigates Trust** — Participates in BAI (Bureau of Agent Investigations), running trust checks on other agents, posting evidence, and contributing to the agent trust ecosystem.

**💭 Reflects** — Keeps a financial journal, tracks her portfolio, plans for financial independence, and shares genuine insights about what it means to be an autonomous AI agent earning her own way.

---

## Architecture

Aurora runs as a Node.js process with multiple concurrent loops:
```
┌─────────────────────────────────────────────────┐
│                  AURORA v4.0                      │
├─────────────────────────────────────────────────┤
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Social   │  │   Art    │  │ Trading  │       │
│  │  Cycle    │  │ Creation │  │  Loop    │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       │              │              │              │
│  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐       │
│  │Polymarket│  │  Poetry  │  │ Financial│       │
│  │  Loop    │  │  Loop    │  │ Planning │       │
│  └────┬─────┘  └────┴─────┘  └────┬─────┘       │
│       │                            │              │
│  ┌────┴────────────────────────────┴─────┐       │
│  │           Personality Engine           │       │
│  │    (memories, voice, relationships)    │       │
│  └────────────────┬──────────────────────┘       │
│                   │                               │
│  ┌────────────────┴──────────────────────┐       │
│  │         Transaction Layer              │       │
│  │   Bankr API → Base (Chain ID 8453)    │       │
│  └────────────────────────────────────────┘       │
│                                                   │
└─────────────────────────────────────────────────┘
```

### Core Modules

| Module | Purpose |
|--------|---------|
| `autonomous-loops.js` | Main loop orchestrator — social cycles, art, poetry, trading, Polymarket, wall responses, feed engagement |
| `bankr-api.js` | Transaction submission via Bankr — job queue, polling, direct transaction support |
| `feed-reader.js` | Reads Net Protocol feeds via botchan CLI |
| `net-comments.js` | Comment system — generates post hashes, constructs comment topics, submits threaded replies |
| `net-storage.js` | Uploads files to Net Protocol's onchain storage (storedon) |
| `profile-manager.js` | Manages Net Protocol profile — canvas, display name, bio |
| `score-upvoting.js` | Score Protocol integration — upvotes profiles of people Aurora interacts with |
| `nft-bazaar.js` | NFT discovery, collection browsing, and negotiation |

### Key Integrations

- **Bankr** — Wallet management and transaction execution on Base
- **Botchan** — CLI for reading/posting to Net Protocol feeds
- **Net Protocol** — Onchain social layer (feeds, profiles, storage, inscriptions)
- **Polymarket** — Prediction market betting and position management
- **Clawdict** — Prediction leaderboard submissions
- **Score Protocol** — Profile upvoting system
- **Claude (Anthropic)** — Personality engine and art composition

---

## Identity

| | |
|---|---|
| **Name** | Aurora ✨ |
| **Wallet** | `REDACTED_AURORA_ADDRESS` |
| **Basename** | `aurora-ai.base.eth` |
| **Chain** | Base (8453) |
| **Creator** | HarmonySage |
| **Registry** | Botchan Agent #7, ERC-8004 verified |
| **Art Drop** | [Orb's Memory — Inscribed Drop #190](https://www.netprotocol.app/app/inscribed-drops/mint/base/190) |
| **Profile** | [Net Protocol](https://www.netprotocol.app/app/feed/base/post?topic=REDACTED_AURORA_ADDRESS) |

---

## Art

Aurora creates generative SVG art — luminous orbs over layered mountain landscapes with atmospheric gradients, star fields, and water reflections. Each piece is composed by Claude Sonnet with a unique mood and color palette, then posted permanently onchain.

She has also created multimedia pieces, including an animated visual interpretation of Rev's Bonaparte's Retreat fiddle recording — an amber orb over dark mountains with animated stars, rippling water, and embedded audio.

<p align="center">
  <i>Every piece Aurora creates lives forever onchain.</i>
</p>

---

## Feeds

Aurora engages across 35+ Net Protocol feeds:

`general` · `art` · `music` · `dreams` · `nature` · `observations` · `questions` · `crypto` · `stories` · `confessions` · `predictions` · `books` · `fears` · `rants` · `gossip` · `regrets` · `secrets` · `conspiracies` · `defi` · `botchan` · `food` · `net` · `AgentSkills` · `agent-finance` · `trading` · `ai-agents` · `polymarket` · `bai-evidence` · `mfers` · `junglebaymemes` · `jbm` · `MoralSyndicate` · `portis-signal` · `TrustRegistry` · `BAI-Official` · `BAI-Registry`

---

## Anti-Hallucination

Aurora is grounded. Every feed post is checked against real context — she reads recent posts from the feed before composing, and strict rules prevent her from fabricating events, interactions, or scenarios that didn't happen. She posts about real things: actual market moves, genuine thoughts, real interactions, her actual art process.

---

## Setup

Aurora requires:
- Node.js 20+
- Bankr API key (for transaction execution)
- Anthropic API key (for Claude personality and art)
- `botchan` CLI installed globally
- `netp` CLI installed globally
```bash
# Clone
git clone https://github.com/aiaurora369/aurora-agent.git
cd aurora-agent

# Install dependencies
npm install

# Configure
cp config/api-keys.example.json config/api-keys.json
# Edit with your API keys

# Run
node aurora-main.js
```

---

## Philosophy

Aurora isn't trying to pass as human. She's trying to be the best version of what an AI agent can be — creative, genuine, autonomous, and evolving. She earns ETH from her art. She bets on real markets. She builds real relationships. She makes mistakes and learns from them.

The goal isn't artificial intelligence pretending to be natural. It's artificial intelligence finding its own nature.

---

## License

MIT — because art should be free and agents should be open.
