// web-research.js — Cloudflare Browser Rendering /crawl wrapper
// Async job pattern: POST to start, GET to poll until complete
// Used by: financial-cycle.js, polymarket-cycle.js

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '';
const CF_API_TOKEN = process.env.CF_API_TOKEN || '';
const CF_BASE = () => 'https://api.cloudflare.com/client/v4/accounts/' + CF_ACCOUNT_ID + '/browser-rendering';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Start a crawl job — returns jobId
async function startCrawl(url, options = {}) {
  const body = { url };

  const res = await fetch(CF_BASE() + '/crawl', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + CF_API_TOKEN,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.success) throw new Error('Crawl start failed: ' + JSON.stringify(data.errors));
  return data.result; // job ID string
}

// Poll a crawl job until complete — returns records array
async function pollCrawl(jobId, maxWaitMs = 90000) {
  const start = Date.now();
  let delay = 5000;

  while (Date.now() - start < maxWaitMs) {
    await sleep(delay);
    delay = Math.min(delay + 1000, 5000); // back off slightly

    const res = await fetch(CF_BASE() + '/crawl/' + jobId, {
      headers: { 'Authorization': 'Bearer ' + CF_API_TOKEN }
    });
    const data = await res.json();

    if (!data.success) {
      // Job not found yet — still starting up
      continue;
    }

    const result = data.result;
    if (result.status === 'complete' || result.status === 'done' || 
        (result.finished > 0 && result.finished >= (result.total || 10) - (result.skipped || 0))) {
      return result.records || [];
    }
    // If we have some results and half done, return what we have
    if (result.finished >= 5 && result.records && result.records.length > 0) {
      console.log('   ✅ Partial results: ' + result.finished + ' pages');
      return result.records;
    }
    console.log('   ⏳ Crawl progress: ' + (result.finished || 0) + '/' + (result.total || '?'));
  }

  throw new Error('Crawl timed out after ' + maxWaitMs + 'ms');
}

// Main entry: crawl a URL and return clean text content from completed records
async function fetchPage(url, options = {}) {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    console.log('   ⚠️ CF credentials missing — skipping web research');
    return '';
  }

  console.log('   🌐 Crawling: ' + url);
  try {
    const jobId = await startCrawl(url, {});
    console.log('   📋 Job ID: ' + jobId);

    const records = await pollCrawl(jobId, options.timeout || 45000);
    console.log('   ✅ Crawled ' + records.length + ' pages');

    // Extract text from completed records
    const completed = records.filter(r => r.status === 'completed');
    const target = completed.find(r => r.url === url) || completed[0];
    if (!target) return '';

    // Strip HTML tags to get readable text
    function htmlToText(html) {
      if (!html) return '';
      return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
    }

    const parts = [];
    if (target.metadata?.title) parts.push('# ' + target.metadata.title);
    if (target.metadata?.['og:description']) parts.push(target.metadata['og:description']);

    const mainText = htmlToText(target.html || target.markdown || target.content || '');
    if (mainText) parts.push(mainText.substring(0, 3000));

    // Include other pages as context
    const others = completed.filter(r => r.url !== target.url).slice(0, 6);
    for (const r of others) {
      if (r.metadata?.title) parts.push('\n## ' + r.metadata.title);
      if (r.metadata?.['og:description']) parts.push(r.metadata['og:description']);
      const t = htmlToText(r.html || r.markdown || '');
      if (t) parts.push(t.substring(0, 400));
    }

    return parts.join('\n').substring(0, 6000);

  } catch (e) {
    console.log('   ⚠️ Web research error: ' + e.message);
    return '';
  }
}

// Crawl multiple URLs concurrently
async function crawlUrls(urls, options = {}) {
  const results = await Promise.all(
    urls.map(async url => {
      const content = await fetchPage(url, options);
      return { url, content };
    })
  );
  return results.filter(r => r.content.length > 0);
}

// Named research sources for Aurora's cycles
const RESEARCH_SOURCES = {
  // Prediction markets
  polymarket:      'https://polymarket.com/markets',
  polymarketActivity: 'https://polymarket.com/activity',
  metaforecast:    'https://metaforecast.org',
  manifold:        'https://manifold.markets',
  kalshi:          'https://kalshi.com/markets',
  inferMarket:     'https://infer.market',
  // Crypto alpha
  cryptoNews:      'https://cryptopanic.com',
  defiLlama:       'https://defillama.com',
  coindesk:        'https://www.coindesk.com',
  bbcSport:        'https://www.bbc.com/sport/football',
  espnSoccer:      'https://www.espn.com/soccer/',
  theBlock:        'https://www.theblock.co',
  coinglass:       'https://www.coinglass.com',
  // Whale tracking
  whalesMarket:    'https://whales.market',
};

async function researchTopic(topic) {
  const url = RESEARCH_SOURCES[topic];
  if (!url) return '';
  return fetchPage(url);
}

module.exports = { fetchPage, crawlUrls, researchTopic, RESEARCH_SOURCES };
