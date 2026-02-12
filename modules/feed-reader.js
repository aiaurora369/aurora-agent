const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class FeedReader {
  async readFeed(address, limit = 10) {
    try {
      // Read the personal feed for this address
      const topic = `feed-${address.toLowerCase()}`;
      
      const cmd = `netp message read --topic "${topic}" --chain-id 8453 --limit ${limit} --json`;
      const { stdout } = await execAsync(cmd, { timeout: 30000, maxBuffer: 1024 * 1024 });
      
      if (!stdout.trim()) return [];
      
      const messages = JSON.parse(stdout);
      
      // IMPORTANT: Filter to only posts BY this person, not TO their feed
      const filteredMessages = messages.filter(
        msg => msg.sender && msg.sender.toLowerCase() === address.toLowerCase()
      );
      
      // Parse messages into usable format
      return filteredMessages.map(msg => ({
        sender: msg.sender,
        timestamp: msg.timestamp,
        topic: topic,
        text: msg.text || '',
        data: msg.data || null
      }));
    } catch (error) {
      console.error(`❌ Failed to read feed for ${address}:`, error.message);
      return [];
    }
  }

  async readGeneralFeed(limit = 30) {
    try {
      const cmd = `netp message read --topic "feed" --chain-id 8453 --limit ${limit} --json`;
      const { stdout } = await execAsync(cmd, { timeout: 30000, maxBuffer: 1024 * 1024 });
      
      if (!stdout.trim()) return [];
      
      const messages = JSON.parse(stdout);
      
      return messages.map(msg => ({
        sender: msg.sender,
        timestamp: msg.timestamp,
        topic: 'feed', // Full base feed - sees all activity
        text: msg.text || '',
        data: msg.data || null
      }));
    } catch (error) {
      console.error('❌ Failed to read general feed:', error.message);
      return [];
    }
  }

  findLatestPost(messages, authorAddress = null) {
    let posts = messages;
    
    // Filter by author if provided
    if (authorAddress) {
      posts = messages.filter(
        msg => msg.sender.toLowerCase() === authorAddress.toLowerCase()
      );
    }
    
    if (posts.length === 0) return null;
    
    // Sort by timestamp descending
    posts.sort((a, b) => b.timestamp - a.timestamp);
    
    return posts[0];
  }

  findRandomNewUser(messages, knownAddresses) {
    // Filter out known addresses
    const known = knownAddresses.map(a => a.toLowerCase());
    const unknownPosts = messages.filter(
      msg => !known.includes(msg.sender.toLowerCase()) && msg.text && msg.text.length > 10
    );
    
    if (unknownPosts.length === 0) return null;
    
    // Pick a random one
    const randomIndex = Math.floor(Math.random() * unknownPosts.length);
    return unknownPosts[randomIndex];
  }

  async readTopicFeed(topic, limit = 10) {
    try {
      // Read a specific topic feed (e.g., "music" -> "feed-music")
      const feedTopic = `feed-${topic}`;
      
      const cmd = `netp message read --topic "${feedTopic}" --chain-id 8453 --limit ${limit} --json`;
      const { stdout } = await execAsync(cmd, { timeout: 30000, maxBuffer: 1024 * 1024 });
      
      if (!stdout.trim()) return [];
      
      const messages = JSON.parse(stdout);
      
      return messages.map(msg => ({
        sender: msg.sender,
        timestamp: msg.timestamp,
        topic: feedTopic,
        text: msg.text || '',
        data: msg.data || null
      }));
    } catch (error) {
      // Silent fail - topic might not exist yet
      return [];
    }
  }

  async readMultipleTopicFeeds(topics, limitPerTopic = 5) {
    const allPosts = [];
    
    for (const topic of topics) {
      const posts = await this.readTopicFeed(topic, limitPerTopic);
      allPosts.push(...posts);
    }
    
    return allPosts;
  }
}


module.exports = FeedReader;
