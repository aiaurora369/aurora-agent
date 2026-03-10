require('dotenv').config();
const { Jimp } = require('jimp');
const https = require('https');
const fs = require('fs');
const path = require('path');

const CONTRACT = '0xd37264c71e9af940e49795f0d3a8336afaafdda9';
const CACHE_FILE = path.join(__dirname, '../memory/jbm-cache.json');
const TARGET = 30;

function fetchBuf(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) return fetchBuf(res.headers.location).then(resolve).catch(reject);
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function toNFTStorageUrl(ipfsUri) {
  // ipfs://QmHASH/604.png → https://nftstorage.link/ipfs/QmHASH/604.png
  if (!ipfsUri) return null;
  return ipfsUri.replace('ipfs://', 'https://nftstorage.link/ipfs/');
}

async function removeBackground(buf) {
  const img = await Jimp.fromBuffer(buf);
  const bgColor = img.getPixelColor(0, 0);
  const bgR = (bgColor >> 24) & 0xff;
  const bgG = (bgColor >> 16) & 0xff;
  const bgB = (bgColor >> 8) & 0xff;
  const threshold = 55;
  img.scan(0, 0, img.bitmap.width, img.bitmap.height, function(x, y, idx) {
    const r = this.bitmap.data[idx], g = this.bitmap.data[idx+1], b = this.bitmap.data[idx+2];
    if (Math.sqrt((r-bgR)**2+(g-bgG)**2+(b-bgB)**2) < threshold) this.bitmap.data[idx+3] = 0;
  });
  const out = await img.getBuffer('image/png');
  return out.toString('base64');
}

async function fetchNFTPage(cursor) {
  const url = cursor
    ? `https://api.opensea.io/api/v2/chain/base/contract/${CONTRACT}/nfts?limit=20&next=${encodeURIComponent(cursor)}`
    : `https://api.opensea.io/api/v2/chain/base/contract/${CONTRACT}/nfts?limit=20`;
  const res = await fetch(url, { headers: { 'x-api-key': process.env.OPENSEA_API_KEY, 'accept': 'application/json' }});
  return res.json();
}

async function main() {
  console.log('🦍 Building JBM cache...\n');

  // Load existing cache
  let cache = [];
  if (fs.existsSync(CACHE_FILE)) {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    console.log(`Found existing cache: ${cache.length} entries`);
  }

  const existing = new Set(cache.map(c => c.tokenId));
  let cursor = null;
  let added = 0;

  while (added < TARGET) {
    const data = await fetchNFTPage(cursor);
    if (!data.nfts || data.nfts.length === 0) break;

    for (const nft of data.nfts) {
      if (added >= TARGET) break;
      if (existing.has(nft.identifier)) continue;

      const ipfsUrl = toNFTStorageUrl(nft.original_image_url);
      if (!ipfsUrl) continue;

      try {
        process.stdout.write(`  Processing ${nft.name}... `);
        const imgBuf = await fetchBuf(ipfsUrl);
        if (imgBuf.length < 1000) { console.log('skip (too small)'); continue; }

        const b64 = await removeBackground(imgBuf);

        // Parse traits
        const traits = {};
        for (const t of (nft.traits || [])) traits[t.trait_type.toLowerCase()] = t.value;

        cache.push({
          tokenId: nft.identifier,
          name: nft.name,
          traits,
          b64png: b64,
          cachedAt: Date.now(),
        });

        existing.add(nft.identifier);
        added++;
        console.log(`✅ (${added}/${TARGET})`);

        // Save after each one in case of interruption
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));

      } catch(e) {
        console.log(`❌ ${e.message}`);
      }
    }

    cursor = data.next;
    if (!cursor) break;
  }

  console.log(`\n✅ Cache complete: ${cache.length} tokens saved to ${CACHE_FILE}`);
}

main().catch(e => console.error('Fatal:', e.message));
