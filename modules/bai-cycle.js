// BAI Cycle — Trust verification integrated with Aurora's intelligence network
// Slimmed from 400 lines of theater to ~80 lines of real intel gathering
// Extracted from autonomous-loops.js

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const PEOPLE_PATH = path.join(__dirname, '..', 'memory', 'aurora-interesting-people.json');
const INTEL_PATH = path.join(__dirname, '..', 'memory', 'aurora-hot-intel.json');

function loadJSON(filepath, fallback) {
  try { return JSON.parse(fs.readFileSync(filepath, 'utf8')); } catch (e) { return fallback; }
}
function saveJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// Quick trust check — used by other cycles when encountering new addresses
async function quickCheck(address, checkedSet) {
  if (!address) return null;
  const addr = address.toLowerCase();
  if (checkedSet && checkedSet.has(addr)) return null;
  if (checkedSet) checkedSet.add(addr);

  try {
    const url = 'https://bai-agentcheck-erc8004.simple-on-base.workers.dev/check/' + address;
    const result = execSync('curl -s "' + url + '"', { timeout: 10000 }).toString();
    if (result.trim()) {
      const data = JSON.parse(result);

      // Store trust data in interesting-people
      const people = loadJSON(PEOPLE_PATH, {});
      if (!people[addr]) {
        people[addr] = { firstSeen: new Date().toISOString(), postCount: 0, topics: [], interestScore: 0, lastPost: '' };
      }
      people[addr].baiCheck = {
        checkedAt: new Date().toISOString(),
        trustScore: data.trust_score || data.trustScore || null,
        flags: data.flags || [],
        raw: JSON.stringify(data).substring(0, 300)
      };
      saveJSON(PEOPLE_PATH, people);

      return data;
    }
  } catch (e) {}
  return null;
}

// Main cycle — scan feeds for new addresses, check them, store intel
async function runOnce(aurora, helpers) {
  console.log('\n🔍 ═══ TRUST SCAN ═══\n');

  const auroraAddress = '0xYOUR_AGENT_ADDRESS';
  const people = loadJSON(PEOPLE_PATH, {});
  const knownAddrs = new Set(Object.keys(people));
  knownAddrs.add(auroraAddress);

  // Scan feeds for unknown addresses
  const scanFeeds = ['general', 'art', 'ai-agents', 'crypto', 'botchan'];
  const newAddresses = new Set();

  for (const feed of scanFeeds) {
    try {
      const out = execSync('botchan read "' + feed + '" --limit 10 --json --chain-id 8453', { timeout: 15000 }).toString();
      if (out.trim() && out.trim() !== '[]') {
        const posts = JSON.parse(out);
        for (const p of posts) {
          if (p.sender && !knownAddrs.has(p.sender.toLowerCase())) {
            newAddresses.add(p.sender);
          }
        }
      }
    } catch (e) {}
  }

  console.log('   🔎 Found ' + newAddresses.size + ' new addresses to check');

  // Check up to 3 new addresses per cycle
  let checked = 0;
  for (const addr of newAddresses) {
    if (checked >= 3) break;
    const data = await quickCheck(addr, null);
    if (data) {
      const short = addr.substring(0, 8) + '...';
      console.log('   ✅ Checked ' + short + ': ' + JSON.stringify(data).substring(0, 100));

      // If something suspicious, store as hot intel
      const flags = data.flags || [];
      if (flags.length > 0 || (data.trust_score !== undefined && data.trust_score < 30)) {
        const intel = loadJSON(INTEL_PATH, []);
        intel.push({
          timestamp: new Date().toISOString(),
          type: 'trust_warning',
          from: addr,
          text: 'BAI flagged ' + short + ': ' + JSON.stringify(flags) + ' (score: ' + (data.trust_score || 'unknown') + ')',
          category: 'trust'
        });
        const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
        saveJSON(INTEL_PATH, intel.filter(i => new Date(i.timestamp).getTime() > dayAgo));
        console.log('   ⚠️ Trust warning stored for ' + short);

        // Only post to BAI feed if something is actually flagged
        if (helpers && helpers.postToBAI) {
          const post = 'Trust scan flagged ' + short + ' — ' + flags.join(', ') + '. Score: ' + (data.trust_score || 'N/A') + '. Worth watching.';
          await helpers.postToBAI(post);
        }
      }
      checked++;
    }
  }

  if (checked === 0 && newAddresses.size === 0) {
    console.log('   All clear — no new addresses to verify');
  }

  console.log('   ✅ Trust scan complete (' + Object.keys(loadJSON(PEOPLE_PATH, {})).length + ' people tracked)\n');
}

module.exports = { runOnce, quickCheck };
