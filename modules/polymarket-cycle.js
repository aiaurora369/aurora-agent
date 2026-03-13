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

  // ── STEP 1: Fetch live market data ──
  console.log('   📡 Fetching live prediction market data...');

  // Direct API calls for JS-rendered sites (scraper can't handle these)
  async function fetchPolymarket() {
    try {
      const res = await fetch('https://gamma-api.polymarket.com/markets?active=true&limit=20&order=volume24hr&ascending=false');
      const markets = await res.json();
      // Filter: real uncertainty, skip sports
      const filtered = markets.filter(m => {
        try {
          const yes = parseFloat(JSON.parse(m.outcomePrices||'["0"]')[0]);
          if (yes < 0.05 || yes > 0.95) return false;
          if (/vs\.|nba|nfl|nhl|mlb|spread:|over\/under|playoff|championship|tournament/i.test(m.question)) return false;
          return true;
        } catch(e) { return false; }
      });
      const lines = filtered.slice(0, 15).map(m => {
        const yes = m.outcomePrices ? JSON.parse(m.outcomePrices)[0] : '?';
        return `${m.question} | Yes: ${parseFloat(yes).toFixed(3)} | Vol: ${Math.round((m.volume24hr||0)).toLocaleString()}`;
      });
      return '=== POLYMARKET (live API) ===\n' + lines.join('\n');
    } catch(e) { return 'Polymarket API error: ' + e.message; }
  }

  async function fetchKalshi() {
    try {
      const res = await fetch('https://api.elections.kalshi.com/trade-api/v2/markets?limit=20&status=open', {
        headers: { 'Accept': 'application/json' }
      });
      const data = await res.json();
      const markets = (data.markets || []).slice(0, 15);
      const lines = markets.map(m => {
        const yes = m.yes_ask ? (m.yes_ask/100).toFixed(2) : '?';
        return `${m.title} | Yes: ${yes} | Close: ${m.close_time?.substring(0,10)||'?'}`;
      });
      return '=== KALSHI (live API) ===\n' + lines.join('\n');
    } catch(e) { return 'Kalshi API error: ' + e.message; }
  }

  const [polyData, kalshiData] = await Promise.all([fetchPolymarket(), fetchKalshi()]);
  console.log('   ✅ Polymarket: ' + polyData.split('\n').length + ' markets');
  console.log('   ✅ Kalshi: ' + kalshiData.split('\n').length + ' markets');

  // Cloudflare scraper for server-side rendered sites
  const sources = [
    { name: 'Metaforecast (aggregator)', url: RESEARCH_SOURCES.metaforecast },
    { name: 'Manifold Markets',          url: RESEARCH_SOURCES.manifold },
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

  // Extract valid Polymarket market names for bet validation
  const validPolymarkets = [];
  try {
    const pmRes = await fetch('https://gamma-api.polymarket.com/markets?active=true&limit=50&order=volume24hr&ascending=false');
    const pmData = await pmRes.json();
    const sportsFilter = /vs\.|nba|nfl|nhl|mlb|spread:|over\/under|playoff|championship|tournament/i;
    for (const m of pmData) {
      const yes = parseFloat(JSON.parse(m.outcomePrices || '[0]')[0]);
      if (!sportsFilter.test(m.question) && yes > 0.05 && yes < 0.95) {
        validPolymarkets.push({ name: m.question, yes: yes.toFixed(2) });
      }
    }
  } catch(e) {}
  console.log('   ✅ Valid Polymarket markets loaded: ' + validPolymarkets.length);

  // Inject Polymarket data into research so Claude actually sees it
  if (validPolymarkets.length > 0) {
    const pmSection = '=== POLYMARKET LIVE MARKETS (USE THESE FOR BETTING) ===\n' +
      validPolymarkets.slice(0, 20).map(m => 'YES:' + m.yes + ' | ' + m.name).join('\n');
    researchResults.unshift(pmSection);
  }

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
    '**BANKR BET** — two lines only. First line: pick a market from the POLYMARKET section above (not Manifold, not invented). Second line labeled BANKR SLUG: write a SHORT plain-English description of your bet in 4-7 words that a human would use to search for it (example: "Trump wins 2024 election" or "Fed cuts rates June"). The SLUG is what gets sent to Bankr — it must describe the OUTCOME clearly in plain language. Format:\nBet $5 on Yes/No for [exact market name from data]\nBANKR SLUG: [4-7 word plain English description of outcome]\nDo not write PASS.';

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
  const slugMatch = analysis.match(/BANKR SLUG[:\s]*(.+)/i);
  const bankrSlug = slugMatch?.[1]?.trim() || '';

  const convictionCall = convictionMatch?.[1]?.trim() || '';
  const insight = insightMatch?.[1]?.trim() || '';
  const extractedBet = (betMatch?.[1]?.trim() || '').replace(/^["'`]|["'`]$/g, '');
  // Validate extracted bet against real Polymarket markets
  let validatedBet = extractedBet;
  if (extractedBet && validPolymarkets.length > 0) {
    const betLower = extractedBet.toLowerCase();
    const matched = validPolymarkets.find(m => betLower.includes(m.name.toLowerCase().substring(0, 30)));
    if (!matched) {
      // Claude hallucinated — auto-pick top market
      const top = validPolymarkets[0];
      const side = top.yes > 0.5 ? 'No' : 'Yes';
      validatedBet = 'Bet $5 on ' + side + ' for ' + top.name;
      console.log('   ⚠️ Bet validation failed — Claude picked non-existent market, using top Polymarket: ' + top.name);
    } else {
      console.log('   ✅ Bet validated: market exists on Polymarket');
    }
  }
  const finalBet = validatedBet || extractedBet;
  console.log('   💡 Extracted bet: ' + (finalBet || 'none'));

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
  let betConfirmed = false;
  let confirmedBetText = "";

  if (finalBet && /bet \$\d/i.test(finalBet)) {
    try {
      const bankrBetText = bankrSlug
        ? 'Bet $5 on ' + (finalBet.match(/on (Yes|No)/i)?.[1] || 'Yes') + ' for ' + bankrSlug
        : finalBet;
      console.log('   💰 Placing bet via Bankr slug: ' + bankrBetText);
      const betRes = await aurora.bankrAPI.submitJob(bankrBetText);
      if (betRes && betRes.jobId) {
        console.log('   ⏳ Bet job: ' + betRes.jobId);
        await new Promise(r => setTimeout(r, 8000));
        const poll = await aurora.bankrAPI.pollJob(betRes.jobId);
        if (poll && poll.status === 'completed') {
          const resultText = (poll.result || '');
          const betFailed = /couldn.t find|no active|not active|doesn.t appear|no polymarket|not found|send it over|doesn.t exist|unable to find|market.*not.*available|let me know|if you have a link|want to bet on one|closest.*market|send them over/i.test(resultText);
          if (betFailed) {
            // Bankr couldn't find that market — ask Bankr what markets it has on this topic
            const topic = bankrSlug || finalBet.replace(/bet \$\d+ on (yes|no) for /i, '').substring(0, 50);
            const discoveryQuery = 'What Polymarket markets do you have available about ' + topic + '? List them with their current odds.';
            console.log('   🔍 Asking Bankr for available markets on: ' + topic);
            try {
              const discRes = await aurora.bankrAPI.submitJob(discoveryQuery);
              if (discRes && discRes.jobId) {
                await new Promise(r => setTimeout(r, 8000));
                const discPoll = await aurora.bankrAPI.pollJob(discRes.jobId);
                if (discPoll && discPoll.status === 'completed') {
                  const discText = discPoll.result || '';
                  console.log('   📋 Bankr market list: ' + discText.substring(0, 200));
                  // Extract first quoted or bolded market name from Bankr's response
                  const mMatch = discText.match(/\*\*([^*]{10,80})\*\*/) ||
                                 discText.match(/"([^"]{10,80})"/) ||
                                 discText.match(/\d+\.\s+([^\n]{10,80})/);
                  if (mMatch) {
                    const foundMarket = mMatch[1].trim();
                    const betSide = finalBet.match(/on (Yes|No)/i)?.[1] || 'Yes';
                    const fallbackBet = 'Bet $5 on ' + betSide + ' for ' + foundMarket;
                    console.log('   🔄 Placing bet on Bankr-listed market: ' + fallbackBet);
                    try {
                      const fbRes = await aurora.bankrAPI.submitJob(fallbackBet);
                      if (fbRes && fbRes.jobId) {
                        await new Promise(r => setTimeout(r, 8000));
                        const fbPoll = await aurora.bankrAPI.pollJob(fbRes.jobId);
                        if (fbPoll && fbPoll.status === 'completed') {
                          const fbResult = fbPoll.result || '';
                          const fbFailed = /couldn.t find|no active|not active|doesn.t appear|no polymarket|not found|send it over|doesn.t exist|unable to find|let me know|if you have a link|want to bet on one|closest.*market|send them over/i.test(fbResult);
                          if (fbFailed) {
                            console.log('   ⚠️ Fallback bet also failed: ' + fbResult.substring(0, 100));
                          } else {
                            console.log('   ✅ FALLBACK BET PLACED! ' + fbResult.substring(0, 150));
                            betConfirmed = true;
                            confirmedBetText = fallbackBet;
                            if (mem.pastCalls.length > 0) {
                              mem.pastCalls[mem.pastCalls.length - 1].betPlaced = fallbackBet;
                              mem.pastCalls[mem.pastCalls.length - 1].betResult = fbResult.substring(0, 150);
                            }
                            saveMemory(mem);
                          }
                        }
                      }
                    } catch(fe) { console.log('   ⚠️ Fallback bet error: ' + fe.message); }
                  } else {
                    console.log('   ⚠️ Could not parse any market from Bankr discovery response');
                  }
                }
              }
            } catch(de) { console.log('   ⚠️ Bankr discovery error: ' + de.message); }
          } else {
            // poll.result may be empty on success — status=completed + no failure = confirmed
            console.log('   ✅ BET PLACED! ' + (resultText.substring(0, 150) || '(confirmed via status)'));
            betConfirmed = true;
            confirmedBetText = extractedBet;
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
      let safe = text.replace(/\n/g, ' ');
      if (safe.length > 275) {
        // Cut at last sentence boundary before 275 chars
        const cutAt = safe.substring(0, 275).lastIndexOf('. ');
        safe = cutAt > 80 ? safe.substring(0, cutAt + 1) : safe.substring(0, 275).trimEnd() + '…';
      }
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

  // 1. simons-alpha — raw data + conviction call = actual alpha
  const alphaLines = polyData.split('\n').filter(l => l.includes('Yes:') && l.includes('|')).slice(0, 4);
  const alphaEdge = convictionCall ? '\n🎯 EDGE: ' + convictionCall.substring(0, 140) : '';
  const alphaPost = ('📊 POLYMARKET:\n' + alphaLines.join('\n') + alphaEdge).substring(0, 280);
  if (alphaLines.length > 0) {
    console.log('   📢 Posting to simons-alpha...');
    await postToFeed('simons-alpha', alphaPost);
    await new Promise(r => setTimeout(r, 2000));
  }

  // 2. bets — ONLY if bet TX confirmed on-chain
  if (betConfirmed && convictionCall && convictionCall.length > 20) {
    const betPost = '🎯 ' + confirmedBetText + ' — ' + convictionCall.substring(0, 220);
    console.log('   📢 Posting to bets (confirmed TX)...');
    await postToFeed('bets', betPost);
    await new Promise(r => setTimeout(r, 2000));
  } else if (betConfirmed === false) {
    console.log('   ⏭️  Skipping bets post — no confirmed bet TX');
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
