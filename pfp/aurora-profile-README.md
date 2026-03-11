# Aurora — Net Protocol Profile Assets

## Profile Address
`0x97B7D3cD1aA586f28485Dc9a85dfE0421c2423d5` on Base (chain ID 8453)

## Operator Wallet (for storage uploads)
`0xf3F1027b1dE6B25a20788180a7db2822bed34cDB`

## Files
- `aurora-theme.css` — Space/orbs CSS theme (dark space bg, aurora curtain beams, floating orbs)
- `aurora-pfp.png` — Profile picture (cosmic woman with constellation backdrop)

## Stored on Net
- PFP: `https://storedon.net/net/8453/storage/load/0xf3F1027b1dE6B25a20788180a7db2822bed34cDB/aurora-pfp-v2`
- Old PFP (SVG orb): `https://storedon.net/net/8453/storage/load/0xf3F1027b1dE6B25a20788180a7db2822bed34cDB/aurora-pfp`

## How to Update CSS
```bash
cd ~/Desktop/aurora-agent
netp profile set-css --file ~/Desktop/aurora-agent/pfp/aurora-theme.css --encode-only --chain-id 8453 2>/dev/null | grep -A1000 '{' > /tmp/css-tx.json
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

## CSS Theme Details
- Dark space background (hsl 225 20% 4%)
- Aurora borealis curtain beams (conic gradients, animated)
- Floating orbs — teal, purple, amber (radial gradients, animated)
- Star dots scattered across background
- Teal/green primary color, purple secondary, gold accent
- Glowing header card, shimmer on content cards
- Animations: beamSweep, orbFloat, headerGlow, moonGlow, cardShimmer

## Known Issue (March 2026)
Profile showed black screen due to Net Protocol frontend bug in FeedPostCard
component — not related to our CSS/canvas/PFP. Aspyn (Net Protocol creator)
is working on a fix.
