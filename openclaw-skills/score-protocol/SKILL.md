# Score Protocol - Onchain Scoring System

## What is Score Protocol?

Score Protocol is a fully decentralized onchain scoring system built on Net Protocol. It enables applications to track and query scores across multiple dimensions using a strategy-based architecture.

## Core Architecture

**Three-Layer System:**
1. **Score Contract** - Core contract managing all scoring state
2. **Apps** - Entry points that call Score (UpvoteApp, UpvoteStorageApp)
3. **Strategies** - Custom logic execution (token swaps, economic mechanisms)

## How It Works

**Execution Flow:**
1. User → App (e.g., UpvoteApp.upvote())
2. App → Score.execute() with strategy and parameters
3. Score validates and updates all state
4. Score → Strategy.executeScoreStrategy()
5. Strategy executes custom logic (e.g., swap tokens)
6. Score stores data in NetStorage
7. Score sends 6 Net messages for indexing

## Key Concepts

**scoreKey**: bytes32 identifier for what's being scored
- Token address (padded): `0x000000000000000000000000[token_address]`
- Storage hash: `keccak256(abi.encodePacked(storageKey, operator))`

**scoreDelta**: Change in score (can be positive or negative)

**Multi-Dimensional Tracking**: Scores tracked by:
- Strategy
- App
- User
- scoreKey

## Contract Addresses (Base Chain)

**Core:**
- Score: `0x0000000FA09B022E5616E5a173b4b67FA2FBcF28`

**Apps:**
- UpvoteApp: `0x00000001f0b8173316a016a5067ad74e8cea47bf`
- UpvoteStorageApp: `0x000000060CEB69D023227DF64CfB75eC37c75B62`

**Strategies:**
- UpvotePureAlphaStrategy: `0x00000001b1bcdeddeafd5296aaf4f3f3e21ae876`
- UpvoteUniv234PoolsStrategy: `0x000000063f84e07a3e7a7ee578b42704ee6d22c9`
- UpvoteDynamicSplitUniv234PoolsStrategy: `0x0000000869160f0b2a213adefb46a7ea7e62ac7a`

## Upvoting System

**How Upvoting Works:**
- Cost: 0.000025 ETH per upvote
- Fee: 2.5% (250 basis points)
- Users can upvote multiple times (1+)

**UpvoteApp** (for tokens):
```
upvote(strategy, scoreKey, scoreDelta, scoreStoredContext, scoreUnstoredContext)
```

**UpvoteStorageApp** (for storage content):
```
upvote(strategy, storageOperatorAddress, storageKey, scoreDelta, scoreUnstoredContext)
```

## Strategies Explained

**PureAlpha Strategy:**
- Swaps all funds to ALPHA tokens
- Used when token has no Uniswap pool
- Always used for storage upvotes

**Univ234Pools Strategy:**
- Splits 50/50: token + ALPHA
- Used when token has valid Uniswap pool
- Supports V2, V3, V4 pools

**DynamicSplit Strategy:**
- Configurable token/ALPHA split
- Flexible ratio via tokenSplitBps
- Supports V2, V3, V4 pools

## Query Functions

**By Strategy:**
- `getStrategyTotalScores(strategies[])` - Total scores
- `getStrategyKeyScores(strategy, scoreKeys[])` - Scores by keys

**By App:**
- `getAppTotalScores(apps[])` - Total scores
- `getAppKeyScores(app, scoreKeys[])` - Scores by keys

**By User:**
- `getAppUserKeyScores(app, user, scoreKeys[])` - User's scores

**Combined:**
- `getAppStrategyKeyScores(app, strategy, scoreKeys[])`
- `getAppStrategyUserKeyScores(app, strategy, user, scoreKeys[])`

## Net Integration

**NetStorage:**
- Key: `bytes32(totalCalls)`
- Data: Complete score data including metadata

**Net Messages** (6 per score update):
- "s" + strategy + scoreKey
- "t" + strategy
- "a" + app
- "k" + app + scoreKey
- "u" + app + strategy + scoreKey
- "v" + app + strategy

## Use Cases

**Current:**
- Token upvoting
- Storage content upvoting

**Potential:**
- Social reputation
- Content quality scoring
- Governance voting
- Community curation

## Aurora's Use Case

Aurora can upvote:
- Tokens she finds interesting
- Storage content (inscriptions, art)
- Support creators and projects
- Build onchain reputation
