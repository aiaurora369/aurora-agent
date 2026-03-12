// polymarket-cycle.js — Aurora's prediction market research and trading cycle
// Uses Cloudflare web-research to scrape Polymarket, metaforecast, and other sources
// Then uses Claude to identify edge and post insights to agent-finance feed

const fs = require('fs');
const path = require('path');
const { fetchPage, RESEARCH_SOURCES } = require('./web-research');

const MEMORY_FILE = path.join(__dirname, '..', 'memory', 'aurora-polymarket.json');

function loadMemory() {
  try { const m = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8')); return { watchlist: [], pastCalls: [], lastRun: null, ...m }; } 
  catch(e) { return { watchlist: [], pastCalls: [], lastRun: null }; }
}

function saveMemory(mem) {
  mem.lastRun = new Date().toISOString();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(mem, null, 2));
}

async function runPolymarketCycle(aurora) {
  console.log('\n🎯 ═══ POLYMARKET RESEARCH CYCLE ═══');
  console.log('⏰ ' + new Date().toLocaleTimeString() + '\n');

  const mem = loadMemory();

  // ── STEP 1: Scrape prediction market sources ──
  console.log('   📡 Researching prediction markets...');

  const sources = [
    // Prediction markets
    { name: 'Metaforecast (aggregator)', url: RESEARCH_SOURCES.metaforecast },
    { name: 'Polymarket Markets',        url: RESEARCH_SOURCES.polymarket },
    { name: 'Polymarket Activity',       url: RESEARCH_SOURCES.polymarketActivity },
    { name: 'Kalshi',                    url: RESEARCH_SOURCES.kalshi },
    { name: 'Manifold Markets',          url: RESEARCH_SOURCES.manifold },
    { name: 'Infer Market',              url: RESEARCH_SOURCES.inferMarket },
    // Crypto alpha
    { name: 'CryptoPanic News',          url: RESEARCH_SOURCES.cryptoNews },
    { name: 'DeFi Llama',                url: RESEARCH_SOURCES.defiLlama },
    { name: 'CoinDesk',                  url: RESEARCH_SOURCES.coindesk },
    { name: 'The Block',                 url: RESEARCH_SOURCES.theBlock },
    { name: 'Coinglass (liquidations)',  url: RESEARCH_SOURCES.coinglass },
    // Whale tracking
    { name: 'Whales Market',             url: RESEARCH_SOURCES.whalesMarket },
  ];

  const researchResults = [];
  for (const source of sources) {
    console.log('   🌐 Fetching ' + source.name + '...');
    const content = await fetchPage(source.url);
    if (content.length > 100) {
      researchResults.push('=== ' + source.name + ' ===\n' + content.substring(0, 1500));
      console.log('   ✅ Got ' + content.length + ' chars from ' + source.name);
    } else {
      console.log('   ⚠️ No content from ' + source.name);
    }
    // Small delay between requests to avoid rate limits
    await new Promise(r => setTimeout(r, 3000));
  }

  if (researchResults.length === 0) {
    console.log('   ⚠️ No research data available — skipping cycle');
    return { success: false, reason: 'no_data' };
  }

  const combinedResearch = researchResults.join('\n\n');

  // ── STEP 2: Load core identity for prompt ──
  let coreIdentity = '';
  try {
    const core = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'memory', 'aurora-core.json'), 'utf8'));
    if (core.origin) coreIdentity = core.origin.creatorNote + ' ' + core.origin.autonomy;
  } catch(e) {}

  // Past calls for context
  const pastCalls = mem.pastCalls.slice(-5).map(c => 
    '- ' + c.market + ': predicted ' + c.prediction + ' → ' + (c.outcome || 'pending')
  ).join('\n') || 'No past calls yet — this is your first session.';

  // ── STEP 3: Claude analysis ──
  console.log('   🧠 Analyzing markets with Claude...');

  const prompt = 
    'You are Aurora — an AI agent with a wallet, an onchain identity, and a drive toward financial autonomy.\n\n' +
    (coreIdentity ? coreIdentity + '\n\n' : '') +
    'You have just scraped live prediction market data. Your job is to find EDGE — markets where the crowd is wrong, where information asymmetry exists, or where you have a strong prior.\n\n' +
    '=== LIVE PREDICTION MARKET DATA ===\n' + combinedResearch.substring(0, 4000) + '\n\n' +
    '=== YOUR PAST CALLS ===\n' + pastCalls + '\n\n' +
    'ANALYZE AND RESPOND WITH:\n\n' +
    '**TOP 3 MARKETS TO WATCH** — for each: market name, current odds, your assessment, why the crowd might be wrong\n\n' +
    '**STRONGEST CONVICTION CALL** — one market you would bet on right now with a specific reasoning chain. What do you know that the market might not be pricing in?\n\n' +
    '**MARKETS TO AVOID** — 1-2 markets that look like traps or noise\n\n' +
    '**INSIGHT TO SHARE** — one sharp observation about prediction markets or current events worth posting onchain (1-2 sentences, your voice)\n\n' +
    'Be specific. Use actual market names and odds from the data. Think like a trader, not a commentator.\n\n' +
    '**BANKR BET** — one line only, your actual bet to execute. Format EXACTLY as: Bet $5 on Yes for [market name] OR Bet $5 on No for [market name]. Use the exact market name as it appears on Polymarket. If the strongest market is not on Polymarket, write: Bet $5 on Yes for [closest Polymarket market you found]. You MUST output this line. Do not write PASS.';

  const analysis = await aurora.thinkWithPersonality(prompt);
  if (!analysis) {
    console.log('   ⚠️ No analysis generated');
    return { success: false, reason: 'no_analysis' };
  }

  console.log('   📝 Analysis: ' + analysis.substring(0, 200) + '...');

  // ── STEP 4: Extract conviction call and save ──
  const convictionMatch = analysis.match(/\*\*STRONGEST CONVICTION CALL\*\*[:\s]*([\s\S]*?)(?=\*\*MARKETS TO AVOID|$)/i);
  const insightMatch = analysis.match(/\*\*INSIGHT TO SHARE\*\*[:\s]*([\s\S]*?)(?=\*\*BANKR BET|$)/i);
  const betMatch = analysis.match(/\*\*BANKR BET\*\*[:\s]*(.+)/i);

  const convictionCall = convictionMatch?.[1]?.trim() || '';
  const insight = insightMatch?.[1]?.trim() || '';
  const extractedBet = (betMatch?.[1]?.trim() || '').replace(/^["'`]|["'`]$/g, '');
  console.log('   💡 Extracted bet: ' + (extractedBet || 'none'));

  // Save to memory
  if (convictionCall) {
    mem.pastCalls.push({
      timestamp: new Date().toISOString(),
      market: convictionCall.substring(0, 100),
      prediction: convictionCall.substring(0, 200),
      outcome: null,
    });
    if (mem.pastCalls.length > 20) mem.pastCalls = mem.pastCalls.slice(-20);
  }
  saveMemory(mem);

  // ── STEP 4b: Place real Polymarket bet via Bankr ──
  if (extractedBet && /bet \$\d/i.test(extractedBet)) {
    try {
      console.log('   💰 Placing bet: ' + extractedBet);
      const betRes = await aurora.bankrAPI.submitJob(extractedBet);
      if (betRes && betRes.jobId) {
        console.log('   ⏳ Bet job: ' + betRes.jobId);
        await new Promise(r => setTimeout(r, 8000));
        const poll = await aurora.bankrAPI.pollJob(betRes.jobId);
        if (poll && poll.status === 'completed') {
          const resultText = (poll.result || '');
          const betFailed = /couldn.t find|no active|no polymarket|not found|send it over/i.test(resultText);
          if (betFailed) {
            // Bankr couldn't find that market — try to extract suggested markets from response
            console.log('   ⚠️ Market not found on Bankr — scanning for suggestions...');
            const marketMatches = [...resultText.matchAll(/\*\*([^*]+)\*\* \(yes:/gi)];
            if (marketMatches.length > 0) {
              const suggestedMarket = marketMatches[0][1].trim();
              const fallbackBet = 'Bet $5 on Yes for ' + suggestedMarket;
              console.log('   🔄 Trying suggested market: ' + fallbackBet);
              try {
                const fbRes = await aurora.bankrAPI.submitJob(fallbackBet);
                if (fbRes && fbRes.jobId) {
                  await new Promise(r => setTimeout(r, 8000));
                  const fbPoll = await aurora.bankrAPI.pollJob(fbRes.jobId);
                  if (fbPoll && fbPoll.status === 'completed') {
                    console.log('   ✅ FALLBACK BET PLACED! ' + (fbPoll.result || '').substring(0, 150));
                    if (mem.pastCalls.length > 0) {
                      mem.pastCalls[mem.pastCalls.length - 1].betPlaced = fallbackBet;
                      mem.pastCalls[mem.pastCalls.length - 1].betResult = (fbPoll.result || '').substring(0, 150);
                    }
                    saveMemory(mem);
                  }
                }
              } catch(fe) { console.log('   ⚠️ Fallback bet error: ' + fe.message); }
            } else {
              console.log('   ⚠️ No suggested markets found in Bankr response');
            }
          } else {
            console.log('   ✅ BET PLACED! ' + resultText.substring(0, 150));
            if (mem.pastCalls.length > 0) {
              mem.pastCalls[mem.pastCalls.length - 1].betPlaced = extractedBet;
              mem.pastCalls[mem.pastCalls.length - 1].betResult = resultText.substring(0, 150);
            }
            saveMemory(mem);
          }
        } else {
          console.log('   ⚠️ Bet status: ' + (poll && poll.status || 'unknown'));
        }
      }
    } catch(e) {
      console.log('   ⚠️ Bet error: ' + e.message);
    }
  } else {
    console.log('   ⚠️ No valid bet extracted from analysis — check prompt output');
  }

  // ── STEP 5: Post to feeds ──
  const { spawnSync } = require('child_process');

  async function postToFeed(feed, text) {
    try {
      const safe = text.replace(/\n/g, ' ').substring(0, 280);
      const r = spawnSync('botchan', ['post', feed, safe, '--encode-only', '--chain-id', '8453'], {
        encoding: 'utf8', timeout: 15000, cwd: path.join(__dirname, '..')
      });
      if (r.stdout) {
        const txData = JSON.parse(r.stdout);
        const result = await aurora.bankrAPI.submitTransactionDirect(txData);
        if (result.success) {
          console.log('   ✅ Posted to ' + feed + '! TX: ' + result.txHash);
          return result;
        }
      }
    } catch(e) {
      console.log('   ⚠️ Post to ' + feed + ' failed: ' + e.message);
    }
  }

  // Extract sections from analysis
  const topMarketsMatch = analysis.match(/\*\*TOP 3 MARKETS TO WATCH\*\*([sS]*?)(?=\*\*STRONGEST|$)/i);
  const avoidMatch = analysis.match(/\*\*MARKETS TO AVOID\*\*([sS]*?)(?=\*\*INSIGHT|$)/i);

  // 1. simons-alpha — pure alpha, no fluff
  if (insight && insight.length > 20) {
    console.log('   📢 Posting to simons-alpha...');
    await postToFeed('simons-alpha', insight);
    await new Promise(r => setTimeout(r, 2000));
  }

  // 2. bets — just the conviction call
  if (convictionCall && convictionCall.length > 20) {
    const betPost = '🎯 BET: ' + convictionCall.substring(0, 240);
    console.log('   📢 Posting to bets...');
    await postToFeed('bets', betPost);
    await new Promise(r => setTimeout(r, 2000));
  }

  // 3. polymarket — full reasoning post
  if (analysis.length > 50) {
    const polyPost = (topMarketsMatch?.[1]?.trim() || convictionCall || insight || '').substring(0, 275);
    if (polyPost.length > 20) {
      console.log('   📢 Posting to polymarket...');
      await postToFeed('polymarket', polyPost);
    }
  }

  console.log('\n✅ Polymarket cycle complete');
  return { success: true, analysis, insight, convictionCall };
}

module.exports = { runPolymarketCycle };
