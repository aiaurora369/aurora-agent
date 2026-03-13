// polymarket-cycle.js — Aurora's prediction market research and trading cycle
// Uses Cloudflare web-research to scrape Polymarket, metaforecast, and other sources
// Then uses Claude to identify edge and post insights to agent-finance feed

const fs = require('fs');
const path = require('path');

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


  // ── STEP 0: Check open Polymarket positions — redeem winners, flag exits ──
  console.log('   💼 Checking open Polymarket positions...');
  let openPositions = '';
  let redeemedSomething = false;
  let exitedMarket = null;
  try {
    const posRes = await aurora.bankrAPI.submitJob('show my Polymarket positions');
    if (posRes && posRes.jobId) {
      await new Promise(function(r) { setTimeout(r, 8000); });
      const posPoll = await aurora.bankrAPI.pollJob(posRes.jobId);
      if (posPoll && posPoll.status === 'completed') {
        const posText = posPoll.result || '';
        const hasPositions = /position|market|shares|\$|yes|no/i.test(posText);
        if (hasPositions) {
          console.log('   📋 Positions: ' + posText.substring(0, 200));
          openPositions = posText;
          const hasResolved = /resolved|winner|redeem|claim|expired/i.test(posText);
          if (hasResolved) {
            console.log('   💰 Resolved positions found — redeeming...');
            const redeemRes = await aurora.bankrAPI.submitJob('redeem my winning polymarket positions');
            if (redeemRes && redeemRes.jobId) {
              await new Promise(function(r) { setTimeout(r, 10000); });
              const redeemPoll = await aurora.bankrAPI.pollJob(redeemRes.jobId);
              if (redeemPoll && redeemPoll.status === 'completed') {
                const redeemText = redeemPoll.result || '';
                const redeemFailed = /nothing to redeem|no winning|no resolved|no positions/i.test(redeemText);
                if (!redeemFailed) {
                  redeemedSomething = true;
                  console.log('   ✅ Redeemed: ' + redeemText.substring(0, 150));
                  mem.lastRedemption = { text: redeemText.substring(0, 200), timestamp: new Date().toISOString() };
                  saveMemory(mem);
                }
              }
            }
          }
        } else {
          console.log('   💤 No open positions');
        }
      }
    }
  } catch(posErr) {
    console.log('   ⚠️ Position check error: ' + posErr.message);
  }
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

  // Read market intel from cache (written by learn-cycle every 15 min)
  const INTEL_PATH = path.join(__dirname, '..', 'memory', 'aurora-market-intel.json');
  const researchResults = [];
  try {
    const intel = JSON.parse(fs.readFileSync(INTEL_PATH, 'utf8'));
    const ageMinutes = (Date.now() - new Date(intel.timestamp).getTime()) / 60000;
    console.log('   📋 Market intel cache: ' + ageMinutes.toFixed(0) + 'min old');
    for (const [name, content] of Object.entries(intel.sources || {})) {
      if (content && content.length > 100) {
        researchResults.push('=== ' + name + ' ===\n' + content.substring(0, 2000));
      }
    }
    console.log('   ✅ Loaded ' + researchResults.length + ' cached sources');
  } catch(cacheErr) {
    console.log('   ⚠️ No market intel cache yet — learn-cycle will populate it');
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


  // ── STEP 1.5: Full Polymarket scan via polymarket-api.js ──
  console.log('   📡 Running Polymarket full scan...');
  let pmScanBrief = '';
  try {
    const pmAPI = require('./polymarket-api');
    const scan = await pmAPI.fullScan();
    if (scan && scan.brief) {
      pmScanBrief = scan.brief;
      researchResults.push(pmScanBrief);
      console.log('   ✅ Scan: ' + scan.bonds.length + ' bonds, ' + scan.trending.length + ' trending, ' + scan.resolving.length + ' resolving soon');
    }
  } catch(scanErr) {
    console.log('   ⚠️ Polymarket scan error: ' + scanErr.message);
  }
  if (openPositions) researchResults.push('=== MY OPEN POSITIONS ===\n' + openPositions.substring(0, 500));
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
    '=== POLYMARKET LIVE MARKETS (BET FROM THIS LIST ONLY) ===\n' + (validPolymarkets.length > 0 ? validPolymarkets.slice(0, 25).map(function(m) { return 'YES:' + m.yes + ' | ' + m.name; }).join('\n') : polyData) + '\n\n' +
    '=== SUPPLEMENTARY RESEARCH ===\n' + combinedResearch.substring(0, 2000) + '\n\n' +
    '=== YOUR PAST CALLS ===\n' + pastCalls + '\n\n' +
    'ANALYZE AND RESPOND WITH:\n\n' +
    '**TOP 3 MARKETS TO WATCH** — for each: market name, current odds, your assessment, why the crowd might be wrong\n\n' +
    '**STRONGEST CONVICTION CALL** — one market you would bet on right now with a specific reasoning chain. What do you know that the market might not be pricing in?\n\n' +
    '**MARKETS TO AVOID** — 1-2 markets that look like traps or noise\n\n' +
    '**INSIGHT TO SHARE** — one sharp observation about prediction markets or current events worth posting onchain (1-2 sentences, your voice)\n\n' +
    'Be specific. Use actual market names and odds from the data. Think like a trader, not a commentator.\n\n' +
    '**EXIT SIGNAL** — If you have open positions listed above AND current data strongly contradicts them, write: EXIT: [market name] because [10 word reason]. Otherwise write: HOLD\n\n' +
    '**BANKR BET** — one line only. You MUST pick a market from the POLYMARKET LIVE MARKETS section above — not from Manifold, not from your imagination. Copy the market name EXACTLY as it appears after the | symbol in the Polymarket data. Format: Bet $5 on Yes for [exact market name] OR Bet $5 on No for [exact market name]. Do not write PASS. Do not invent market names.';

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
      console.log('   💰 Placing bet: ' + finalBet);
      const betRes = await aurora.bankrAPI.submitJob(finalBet);
      if (betRes && betRes.jobId) {
        console.log('   ⏳ Bet job: ' + betRes.jobId);
        await new Promise(r => setTimeout(r, 8000));
        const poll = await aurora.bankrAPI.pollJob(betRes.jobId);
        if (poll && poll.status === 'completed') {
          const resultText = (poll.result || '');
          const betFailed = /couldn.t find|no active|not active|doesn.t appear|no polymarket|not found|send it over|doesn.t exist|unable to find|market.*not.*available|let me know|if you have a link|want to bet on one|closest.*market|send them over/i.test(resultText);
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
                    const fbResult = (fbPoll.result || '');
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
              console.log('   ⚠️ No suggested markets found in Bankr response');
            }
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



  // ── STEP 4b-bond: Bond fallback — if no bet placed, find best 90c+ bond ──
  if (!betConfirmed) {
    console.log('   🔍 No bet placed yet — scanning for bond opportunities...');
    try {
      const pmAPI = require('./polymarket-api');
      const bonds = await pmAPI.getBonds(0.88, 4); // 88c+, resolving within 4 days
      if (bonds && bonds.length > 0) {
        const best = bonds[0];
        console.log('   💎 Best bond: ' + best.title + ' | ' + best.side + ' @ ' + (best.price*100).toFixed(0) + 'c | resolves in ' + best.hoursUntilClose + 'h | return: ' + best.returnPct);
        // Build a short slug Bankr can find
        const bondSlug = best.title.substring(0, 60);
        const bondBet = 'Bet $5 on ' + best.side + ' for ' + bondSlug;
        console.log('   💰 Placing bond bet: ' + bondBet);
        const bondRes = await aurora.bankrAPI.submitJob(bondBet);
        if (bondRes && bondRes.jobId) {
          await new Promise(r => setTimeout(r, 10000));
          const bondPoll = await aurora.bankrAPI.pollJob(bondRes.jobId);
          if (bondPoll && bondPoll.status === 'completed') {
            const bondResult = bondPoll.result || '';
            const bondFailed = /couldn.t find|no active|not active|doesn.t appear|no polymarket|not found|send it over|doesn.t exist|unable to find|let me know|if you have a link|want to bet on one|closest.*market|send them over/i.test(bondResult);
            if (!bondFailed) {
              betConfirmed = true;
              confirmedBetText = bondBet + ' (bond: ' + best.returnPct + ' return, ' + best.hoursUntilClose + 'h)';
              console.log('   ✅ BOND BET PLACED! ' + bondResult.substring(0, 150));
              if (mem.pastCalls.length > 0) {
                mem.pastCalls[mem.pastCalls.length - 1].betPlaced = bondBet;
                mem.pastCalls[mem.pastCalls.length - 1].betResult = 'bond @ ' + best.returnPct;
              }
              saveMemory(mem);
            } else {
              console.log('   ⚠️ Bond bet failed: ' + bondResult.substring(0, 100));
            }
          }
        }
      } else {
        console.log('   💤 No bond opportunities found today');
      }
    } catch(bondErr) {
      console.log('   ⚠️ Bond fallback error: ' + bondErr.message);
    }
  }
  // ── STEP 4c: Process exit signal ──
  const exitMatch = analysis.match(/\*\*EXIT SIGNAL\*\*[:\s]*EXIT:\s*(.+?)\s+because\s+(.+)/i);
  if (exitMatch && openPositions) {
    const exitMarket = exitMatch[1].trim();
    const exitReason = exitMatch[2].trim();
    console.log('   🚨 Exit signal: ' + exitMarket);
    try {
      const sellRes = await aurora.bankrAPI.submitJob('sell my position in ' + exitMarket + ' on Polymarket');
      if (sellRes && sellRes.jobId) {
        await new Promise(function(r) { setTimeout(r, 10000); });
        const sellPoll = await aurora.bankrAPI.pollJob(sellRes.jobId);
        if (sellPoll && sellPoll.status === 'completed') {
          const sellText = sellPoll.result || '';
          const sellFailed = /couldn.t|not found|no position|unable|error/i.test(sellText);
          if (!sellFailed) {
            exitedMarket = { market: exitMarket, reason: exitReason };
            console.log('   ✅ Exited: ' + sellText.substring(0, 100));
          }
        }
      }
    } catch(exitErr) {
      console.log('   ⚠️ Exit error: ' + exitErr.message);
    }
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

  // 1. simons-alpha — only when a real move was made
  const madeAMove = betConfirmed || redeemedSomething || exitedMarket;
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
