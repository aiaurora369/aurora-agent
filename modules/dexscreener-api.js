// DexScreener API — Real market data for Aurora's trading
// Covers Base, Solana, and Ethereum
// Free tier: 300 req/min for pair/token lookups, 60 req/min for boosts

const https = require('https');

const SUPPORTED_CHAINS = ['base', 'solana', 'ethereum'];

// Simple HTTPS GET that returns JSON
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('JSON parse failed: ' + data.substring(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// === TOP BOOSTED TOKENS (momentum signal) ===
async function getTopBoostedTokens() {
  try {
    const data = await fetchJSON('https://api.dexscreener.com/token-boosts/top/v1');
    if (!Array.isArray(data)) return [];

    // Filter to our supported chains and add boost rank
    return data
      .filter(t => SUPPORTED_CHAINS.includes(t.chainId))
      .slice(0, 30)
      .map((t, i) => ({
        rank: i + 1,
        chain: t.chainId,
        address: t.tokenAddress,
        description: (t.description || '').substring(0, 100),
        totalBoosts: t.totalAmount || 0,
        url: t.url || ''
      }));
  } catch (e) {
    console.log('   ⚠️ DexScreener boosts fetch failed: ' + e.message);
    return [];
  }
}

// === SEARCH FOR A TOKEN BY NAME/SYMBOL ===
async function searchToken(query) {
  try {
    const data = await fetchJSON('https://api.dexscreener.com/latest/dex/search?q=' + encodeURIComponent(query));
    if (!data.pairs || !Array.isArray(data.pairs)) return [];

    return data.pairs
      .filter(p => SUPPORTED_CHAINS.includes(p.chainId))
      .slice(0, 10)
      .map(formatPair);
  } catch (e) {
    console.log('   ⚠️ DexScreener search failed: ' + e.message);
    return [];
  }
}

// === GET TOKEN DATA BY CHAIN + ADDRESS ===
async function getTokenByAddress(chain, address) {
  try {
    const data = await fetchJSON('https://api.dexscreener.com/tokens/v1/' + chain + '/' + address);
    if (!Array.isArray(data) || data.length === 0) return null;

    // Return the highest-liquidity pair
    const sorted = data.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    return formatPair(sorted[0]);
  } catch (e) {
    console.log('   ⚠️ DexScreener token fetch failed: ' + e.message);
    return null;
  }
}

// === SCAN ALL CHAINS FOR MOMENTUM PLAYS ===
// This is the main function trading-cycle calls
async function scanForOpportunities(options = {}) {
  const {
    minLiquidityUSD = 50000,
    minVolume24h = 10000,
    minPriceChange5m = 0,       // positive = currently pumping
    minPriceChange1h = 2,       // at least 2% up in last hour
    maxPriceChange24h = 200,    // avoid tokens that already 10x'd
    minTxns24h = 100,
    chains = SUPPORTED_CHAINS
  } = options;

  console.log('   🔍 DexScreener: Scanning for momentum plays...');

  // Step 1: Get boosted tokens as starting universe
  const boosted = await getTopBoostedTokens();
  console.log('   📊 Found ' + boosted.length + ' boosted tokens on supported chains');

  if (boosted.length === 0) return [];

  // Step 2: Look up detailed data for top boosted tokens
  const opportunities = [];

  // Batch by chain (up to 30 addresses per call)
  for (const chain of chains) {
    const chainTokens = boosted.filter(t => t.chain === chain);
    if (chainTokens.length === 0) continue;

    const addresses = chainTokens.map(t => t.address).join(',');
    try {
      const pairs = await fetchJSON('https://api.dexscreener.com/tokens/v1/' + chain + '/' + addresses);
      if (!Array.isArray(pairs)) continue;

      for (const pair of pairs) {
        const formatted = formatPair(pair);
        if (!formatted) continue;

        // Apply filters
        if (formatted.liquidityUSD < minLiquidityUSD) continue;
        if (formatted.volume24h < minVolume24h) continue;
        if (formatted.priceChange1h < minPriceChange1h) continue;
        if (formatted.priceChange24h > maxPriceChange24h) continue;
        if (formatted.txns24h < minTxns24h) continue;
        if (formatted.priceChange5m < minPriceChange5m) continue;

        // Find boost rank
        const boostInfo = chainTokens.find(t => t.address.toLowerCase() === (pair.baseToken?.address || '').toLowerCase());
        formatted.boostRank = boostInfo ? boostInfo.rank : 99;
        formatted.totalBoosts = boostInfo ? boostInfo.totalBoosts : 0;

        opportunities.push(formatted);
      }
    } catch (e) {
      console.log('   ⚠️ Chain ' + chain + ' lookup failed: ' + e.message);
    }
  }

  // Sort by a composite score: volume * price change * boosts
  opportunities.sort((a, b) => {
    const scoreA = (a.volume24h / 10000) * Math.max(a.priceChange1h, 1) * Math.max(a.totalBoosts, 1);
    const scoreB = (b.volume24h / 10000) * Math.max(b.priceChange1h, 1) * Math.max(b.totalBoosts, 1);
    return scoreB - scoreA;
  });

  console.log('   ✅ ' + opportunities.length + ' tokens passed filters');
  return opportunities.slice(0, 10);
}

// === PRE-BUY VALIDATION ===
// Call this BEFORE executing any buy to confirm the token isn't a trap
async function validateBeforeBuy(symbol, chain) {
  console.log('   🔎 Validating ' + symbol + ' on ' + chain + ' before buy...');

  const results = await searchToken(symbol + ' ' + chain);
  if (results.length === 0) {
    return { valid: false, reason: 'Token not found on DexScreener' };
  }

  // Find the best match on the right chain
  const match = results.find(r => r.chain === chain) || results[0];

  const issues = [];
  if (match.liquidityUSD < 20000) issues.push('LOW LIQUIDITY ($' + Math.round(match.liquidityUSD) + ')');
  if (match.volume24h < 5000) issues.push('LOW VOLUME ($' + Math.round(match.volume24h) + ')');
  if (match.txns24h < 50) issues.push('LOW TXNS (' + match.txns24h + ' in 24h)');
  if (match.priceChange24h < -30) issues.push('DUMPING (' + match.priceChange24h.toFixed(1) + '% 24h)');
  if (match.priceChange1h < -10) issues.push('CRASHING (' + match.priceChange1h.toFixed(1) + '% 1h)');

  if (issues.length >= 2) {
    return { valid: false, reason: issues.join(', '), data: match };
  }

  return { valid: true, data: match, warnings: issues };
}

// Format a DexScreener pair into clean data
function formatPair(pair) {
  if (!pair || !pair.baseToken) return null;

  return {
    symbol: pair.baseToken.symbol || 'UNKNOWN',
    name: pair.baseToken.name || '',
    address: pair.baseToken.address || '',
    chain: pair.chainId || '',
    priceUSD: parseFloat(pair.priceUsd || 0),
    priceChange5m: pair.priceChange?.m5 || 0,
    priceChange1h: pair.priceChange?.h1 || 0,
    priceChange6h: pair.priceChange?.h6 || 0,
    priceChange24h: pair.priceChange?.h24 || 0,
    volume24h: pair.volume?.h24 || 0,
    volume6h: pair.volume?.h6 || 0,
    volume1h: pair.volume?.h1 || 0,
    liquidityUSD: pair.liquidity?.usd || 0,
    txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
    buys24h: pair.txns?.h24?.buys || 0,
    sells24h: pair.txns?.h24?.sells || 0,
    buyRatio: pair.txns?.h24?.buys && pair.txns?.h24?.sells
      ? (pair.txns.h24.buys / (pair.txns.h24.buys + pair.txns.h24.sells) * 100).toFixed(1)
      : '50.0',
    pairAddress: pair.pairAddress || '',
    dexId: pair.dexId || '',
    url: pair.url || '',
    fdv: pair.fdv || 0,
    marketCap: pair.marketCap || 0,
    pairCreatedAt: pair.pairCreatedAt || null
  };
}

// === HUMAN-READABLE SUMMARY FOR PROMPTS ===
function summarizeOpportunities(opportunities) {
  if (opportunities.length === 0) return 'No tokens passed momentum filters.';

  return opportunities.map((t, i) => {
    const age = t.pairCreatedAt
      ? Math.round((Date.now() - t.pairCreatedAt) / (1000 * 60 * 60)) + 'h old'
      : 'age unknown';
    return (i + 1) + '. $' + t.symbol + ' (' + t.chain + ')' +
      ' | Price: $' + t.priceUSD.toFixed(6) +
      ' | 1h: ' + (t.priceChange1h > 0 ? '+' : '') + t.priceChange1h.toFixed(1) + '%' +
      ' | 24h: ' + (t.priceChange24h > 0 ? '+' : '') + t.priceChange24h.toFixed(1) + '%' +
      ' | Vol 24h: $' + Math.round(t.volume24h).toLocaleString() +
      ' | Liq: $' + Math.round(t.liquidityUSD).toLocaleString() +
      ' | Txns: ' + t.txns24h + ' (buys ' + t.buyRatio + '%)' +
      ' | MCap: $' + Math.round(t.marketCap || t.fdv || 0).toLocaleString() +
      ' | ' + age;
  }).join('\n');
}

module.exports = {
  getTopBoostedTokens,
  searchToken,
  getTokenByAddress,
  scanForOpportunities,
  validateBeforeBuy,
  summarizeOpportunities,
  SUPPORTED_CHAINS
};
