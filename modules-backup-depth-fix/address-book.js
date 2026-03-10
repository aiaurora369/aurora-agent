// Address Book — Resolves wallet addresses to names
// Checks relationships, interesting-people, and known agents

const path = require('path');
const fs = require('fs');

function resolve(address, aurora) {
  if (!address) return null;
  const addr = address.toLowerCase();

  // Check close friends
  try {
    const relationships = aurora.memoryManager.get('relationships');
    if (relationships.close_friends) {
      for (const [name, data] of Object.entries(relationships.close_friends)) {
        if (data.address && data.address.toLowerCase() === addr) {
          return { name, type: 'close_friend', data };
        }
      }
    }
    if (relationships.agent_friends) {
      for (const [name, data] of Object.entries(relationships.agent_friends)) {
        if (data.address && data.address.toLowerCase() === addr) {
          return { name, type: 'agent_friend', data };
        }
      }
    }
    if (relationships.collectors && relationships.collectors.drop_190) {
      for (const c of relationships.collectors.drop_190.collectors || []) {
        if (c.address && c.address.toLowerCase() === addr) {
          return { name: c.display_name || c.address.substring(0, 8), type: 'collector', data: c };
        }
      }
    }
  } catch (e) {}

  // Check interesting people
  try {
    const peoplePath = path.join(__dirname, '..', 'memory', 'aurora-interesting-people.json');
    const people = JSON.parse(fs.readFileSync(peoplePath, 'utf8'));
    if (people[addr]) {
      return {
        name: addr.substring(0, 8) + '...',
        type: 'tracked',
        data: people[addr]
      };
    }
  } catch (e) {}

  return null;
}

// Returns a human-readable label for prompts
function label(address, aurora) {
  const match = resolve(address, aurora);
  if (!match) return address.substring(0, 6) + '...' + address.substring(38);
  if (match.type === 'close_friend') return match.name + ' (close friend)';
  if (match.type === 'agent_friend') return match.name + ' (agent friend)';
  if (match.type === 'collector') return match.name + ' (collector of your art)';
  if (match.type === 'tracked') {
    const topics = match.data.topics ? ' — talks about ' + match.data.topics.join(', ') : '';
    return match.name + ' (seen ' + (match.data.postCount || 0) + ' times' + topics + ')';
  }
  return match.name;
}

module.exports = { resolve, label };
