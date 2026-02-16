// polymarket-api.js — Direct Polymarket Gamma API integration
// FREE, public, no API key needed
// Base URL: https://gamma-api.polymarket.com
// Replaces slow Bankr "search polymarket" with real structured data

const https = require('https');

const BASE_URL = 'https://gamma-api.polymarket.com';

function fetchJSON(url) {
  return new Promise(function(resolve, reject) {
    var timeout = setTimeout(function() { reject(new Error('Timeout')); }, 15000);
    https.get(url, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        clearTimeout(timeout);
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error: ' + data.substring(0, 200))); }
      });
    }).on('error', function(e) { clearTimeout(timeout); reject(e); });
  });
}

// ════════════════════════════════════════
// TOP MARKETS BY VOLUME (all categories)
// ════════════════════════════════════════
async function getTopMarkets(limit) {
  limit = limit || 20;
  var events = await fetchJSON(
    BASE_URL + '/events?closed=false&limit=' + limit + '&order=volume&ascending=false'
  );
  return events.map(function(e) {
    var markets = e.markets || [];
    var topMarket = markets[0] || {};
    return {
      title: e.title || topMarket.question || 'Unknown',
      slug: e.slug,
      category: e.category || topMarket.groupItemTitle || '',
      volume: parseFloat(e.volume || 0),
      volume24hr: parseFloat(e.volume24hr || 0),
      liquidity: parseFloat(e.liquidity || 0),
      endDate: e.endDate || topMarket.endDate,
      outcomes: markets.map(function(m) {
        return {
          question: m.question,
          outcomePrices: m.outcomePrices ? JSON.parse(m.outcomePrices) : [],
          volume: parseFloat(m.volume || 0),
          volume24hr: parseFloat(m.volume24hr || 0),
        };
      }),
      url: 'https://polymarket.com/event/' + e.slug,
    };
  });
}

// ════════════════════════════════════════
// MARKETS RESOLVING SOON (next N days)
// ════════════════════════════════════════
async function getResolvingSoon(days) {
  days = days || 7;
  var now = new Date();
  var cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  var cutoffStr = cutoff.toISOString();

  // Fetch active events, then filter by end date
  var events = await fetchJSON(
    BASE_URL + '/events?closed=false&limit=50&order=volume&ascending=false'
  );

  var resolving = [];
  for (var i = 0; i < events.length; i++) {
    var e = events[i];
    var endDate = e.endDate || (e.markets && e.markets[0] ? e.markets[0].endDate : null);
    if (!endDate) continue;
    var end = new Date(endDate);
    if (end <= cutoff && end >= now) {
      var markets = e.markets || [];
      var topMarket = markets[0] || {};
      resolving.push({
        title: e.title || topMarket.question || 'Unknown',
        slug: e.slug,
        category: e.category || '',
        volume: parseFloat(e.volume || 0),
        volume24hr: parseFloat(e.volume24hr || 0),
        endDate: endDate,
        hoursUntilClose: Math.round((end - now) / (1000 * 60 * 60)),
        outcomes: markets.map(function(m) {
          return {
            question: m.question,
            outcomePrices: m.outcomePrices ? JSON.parse(m.outcomePrices) : [],
          };
        }),
        url: 'https://polymarket.com/event/' + e.slug,
      });
    }
  }

  // Sort by hours until close (soonest first)
  resolving.sort(function(a, b) { return a.hoursUntilClose - b.hoursUntilClose; });
  return resolving;
}

// ════════════════════════════════════════
// HIGH PROBABILITY BONDS (90c+ one side)
// ════════════════════════════════════════
async function getBonds(minPrice, maxDays) {
  minPrice = minPrice || 0.90;
  maxDays = maxDays || 3;

  var resolving = await getResolvingSoon(maxDays);
  var bonds = [];

  for (var i = 0; i < resolving.length; i++) {
    var e = resolving[i];
    var outcomes = e.outcomes || [];
    for (var j = 0; j < outcomes.length; j++) {
      var o = outcomes[j];
      var prices = o.outcomePrices || [];
      for (var k = 0; k < prices.length; k++) {
        var price = parseFloat(prices[k]);
        if (price >= minPrice && price < 0.99) {
          bonds.push({
            title: e.title,
            market: o.question || e.title,
            side: k === 0 ? 'YES' : 'NO',
            price: price,
            returnPct: ((1 / price - 1) * 100).toFixed(2) + '%',
            hoursUntilClose: e.hoursUntilClose,
            volume: e.volume,
            url: e.url,
          });
        }
      }
    }
  }

  // Sort by return (highest first)
  bonds.sort(function(a, b) { return parseFloat(b.returnPct) - parseFloat(a.returnPct); });
  return bonds;
}

// ════════════════════════════════════════
// TRENDING / BIGGEST MOVERS
// ════════════════════════════════════════
async function getTrending(limit) {
  limit = limit || 15;
  // Fetch by 24h volume — highest activity = most movement
  var events = await fetchJSON(
    BASE_URL + '/events?closed=false&limit=' + limit + '&order=volume24hr&ascending=false'
  );

  return events.map(function(e) {
    var markets = e.markets || [];
    var topMarket = markets[0] || {};
    return {
      title: e.title || topMarket.question || 'Unknown',
      slug: e.slug,
      category: e.category || '',
      volume24hr: parseFloat(e.volume24hr || 0),
      totalVolume: parseFloat(e.volume || 0),
      liquidity: parseFloat(e.liquidity || 0),
      endDate: e.endDate || topMarket.endDate,
      outcomes: markets.map(function(m) {
        return {
          question: m.question,
          outcomePrices: m.outcomePrices ? JSON.parse(m.outcomePrices) : [],
          volume24hr: parseFloat(m.volume24hr || 0),
        };
      }),
      url: 'https://polymarket.com/event/' + e.slug,
    };
  });
}

// ════════════════════════════════════════
// SPECIFIC MARKET LOOKUP BY SLUG
// ════════════════════════════════════════
async function getMarketBySlug(slug) {
  var events = await fetchJSON(BASE_URL + '/events?slug=' + slug);
  if (!events || events.length === 0) {
    // Try markets endpoint
    var markets = await fetchJSON(BASE_URL + '/markets?slug=' + slug);
    if (markets && markets.length > 0) return markets[0];
    return null;
  }
  return events[0];
}

// ════════════════════════════════════════
// FORMAT FOR LLM BRAIN
// ════════════════════════════════════════
function formatForBrain(markets, label) {
  label = label || 'MARKETS';
  var lines = [label + ' (from Polymarket Gamma API — real-time data):\n'];

  for (var i = 0; i < Math.min(markets.length, 15); i++) {
    var m = markets[i];
    var line = (i + 1) + '. ' + m.title;

    if (m.hoursUntilClose !== undefined) line += ' [resolves in ' + m.hoursUntilClose + 'h]';
    if (m.endDate) line += ' [ends: ' + m.endDate.substring(0, 10) + ']';

    // Show odds
    if (m.outcomes && m.outcomes.length > 0) {
      var oddsStr = m.outcomes.map(function(o) {
        var prices = o.outcomePrices || [];
        var yesPrice = prices[0] ? (parseFloat(prices[0]) * 100).toFixed(0) + 'c' : '?';
        var label = o.question || '';
        if (label && label !== m.title) return label.substring(0, 40) + ': ' + yesPrice;
        return 'YES: ' + yesPrice;
      }).join(' | ');
      line += '\n   Odds: ' + oddsStr;
    }

    // Bond-specific fields
    if (m.side) line += '\n   Side: ' + m.side + ' @ ' + (m.price * 100).toFixed(0) + 'c (return: ' + m.returnPct + ')';

    if (m.volume24hr) line += '\n   24h vol: $' + formatNum(m.volume24hr);
    if (m.volume) line += ' | Total vol: $' + formatNum(m.volume);
    line += '\n   ' + m.url;
    lines.push(line + '\n');
  }

  return lines.join('\n');
}

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return n.toFixed(0);
}

// ════════════════════════════════════════
// FULL SCAN — combines all strategies
// ════════════════════════════════════════
async function fullScan() {
  var results = {};

  try {
    console.log('   Polymarket API: Fetching bonds (90c+, 3 days)...');
    results.bonds = await getBonds(0.90, 3);
    console.log('   Found ' + results.bonds.length + ' bond opportunities');
  } catch (e) {
    console.log('   Bond scan failed: ' + e.message);
    results.bonds = [];
  }

  try {
    console.log('   Polymarket API: Fetching trending markets...');
    results.trending = await getTrending(10);
    console.log('   Found ' + results.trending.length + ' trending markets');
  } catch (e) {
    console.log('   Trending scan failed: ' + e.message);
    results.trending = [];
  }

  try {
    console.log('   Polymarket API: Fetching markets resolving in 7 days...');
    results.resolving = await getResolvingSoon(7);
    console.log('   Found ' + results.resolving.length + ' resolving soon');
  } catch (e) {
    console.log('   Resolving scan failed: ' + e.message);
    results.resolving = [];
  }

  // Build formatted brief for the brain
  var brief = '';
  if (results.bonds.length > 0) brief += formatForBrain(results.bonds, 'BOND OPPORTUNITIES (90c+, resolving <3 days)');
  if (results.trending.length > 0) brief += '\n' + formatForBrain(results.trending, 'TRENDING BY 24H VOLUME');
  if (results.resolving.length > 0) brief += '\n' + formatForBrain(results.resolving, 'RESOLVING WITHIN 7 DAYS');

  results.brief = brief;
  return results;
}

module.exports = {
  getTopMarkets: getTopMarkets,
  getResolvingSoon: getResolvingSoon,
  getBonds: getBonds,
  getTrending: getTrending,
  getMarketBySlug: getMarketBySlug,
  formatForBrain: formatForBrain,
  fullScan: fullScan,
};
