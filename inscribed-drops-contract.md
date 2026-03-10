# Inscribed Drops Contract Reference

## Contract Address (Same on all chains)
`0x0000004c6cc2cA10Cf4d67C8902659085D31e1Dc`

## OpenSea
- Mainnet: https://opensea.io/collection/inscribed-dynamic-drops
- Testnet: https://testnets.opensea.io/collection/inscribed-drops-8

## Key Function: inscribe

```solidity
function inscribe(
    uint256 mintPrice,         // Price in wei (e.g., 0.005 ETH = 5000000000000000)
    uint256 maxSupply,         // 0 = open edition
    uint256 mintEndTimestamp,  // 0 = open forever (unix timestamp)
    uint256 maxMintsPerWallet, // 0 = unlimited
    string tokenUri,           // JSON string: {"image":"url","name":"...","description":"..."}
    address metadataAddress    // 0x0000000000000000000000000000000000000000 if using direct inscription
)
```

## Other Key Functions

```solidity
function mint(uint256 id, uint256 quantity) external payable
function totalDrops() external view returns (uint256)
function totalSupply(uint256 id) external view returns (uint256 supply)
function mintedPerWallet(uint256 id, address user) external view returns (uint256 minted)
function balanceOf(address owner, uint256 id) external view returns (uint256 result)
function uri(uint256 id) external view returns (string)
```

## Also Found: Second Contract
`0x00000000dC08e06366Bdf2E9a2f966Fa0e229C7e` (variable `u` in module 66984, likely a helper/reader contract)

## Token URI Format
The `tokenUri` parameter is a JSON-stringified object:
```json
{
  "image": "https://storedon.net/net/8453/storage/load/{operator}/{key}",
  "name": "Aurora Art - Drop Name",
  "description": "Description of the artwork"
}
```

For fully onchain art, use a data URI for the image field.

## Source
Discovered by reverse-engineering the frontend JavaScript at:
- Page: https://www.netprotocol.app/app/inscribed-drops/create
- JS Bundle: static/chunks/2641-611d214805c7dc31.js
- Module ID: 66984
- Exports: ay (main contract), wb (second contract), kY, Ht, v (OpenSea URL)

## Full ABI (partial - key entries)
```json
[
  {"type":"constructor","inputs":[],"stateMutability":"nonpayable"},
  {"type":"function","name":"NET_APP_NAME","inputs":[],"outputs":[{"name":"","type":"string"}],"stateMutability":"view"},
  {"type":"function","name":"inscribe","inputs":[{"name":"mintPrice","type":"uint256"},{"name":"maxSupply","type":"uint256"},{"name":"mintEndTimestamp","type":"uint256"},{"name":"maxMintsPerWallet","type":"uint256"},{"name":"tokenUri","type":"string"},{"name":"metadataAddress","type":"address"}],"outputs":[],"stateMutability":"nonpayable"},
  {"type":"function","name":"mint","inputs":[{"name":"id","type":"uint256"},{"name":"quantity","type":"uint256"}],"outputs":[],"stateMutability":"payable"},
  {"type":"function","name":"totalDrops","inputs":[],"outputs":[{"name":"","type":"uint256"}],"stateMutability":"view"},
  {"type":"function","name":"totalSupply","inputs":[{"name":"id","type":"uint256"}],"outputs":[{"name":"supply","type":"uint256"}],"stateMutability":"view"},
  {"type":"function","name":"mintedPerWallet","inputs":[{"name":"id","type":"uint256"},{"name":"user","type":"address"}],"outputs":[{"name":"minted","type":"uint256"}],"stateMutability":"view"},
  {"type":"function","name":"balanceOf","inputs":[{"name":"owner","type":"address"},{"name":"id","type":"uint256"}],"outputs":[{"name":"result","type":"uint256"}],"stateMutability":"view"},
  {"type":"function","name":"uri","inputs":[{"name":"id","type":"uint256"}],"outputs":[{"name":"","type":"string"}],"stateMutability":"view"},
  {"type":"function","name":"feeBps","inputs":[],"outputs":[{"name":"","type":"uint256"}],"stateMutability":"view"},
  {"type":"function","name":"setFeeBps","inputs":[{"name":"newFeeBps","type":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},
  {"type":"function","name":"owner","inputs":[],"outputs":[{"name":"","type":"address"}],"stateMutability":"view"},
  {"type":"function","name":"name","inputs":[],"outputs":[{"name":"","type":"string"}],"stateMutability":"pure"},
  {"type":"function","name":"symbol","inputs":[],"outputs":[{"name":"","type":"string"}],"stateMutability":"pure"}
]
```

## Date Discovered
February 3, 2026
