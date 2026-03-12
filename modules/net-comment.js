const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const path = require('path');

class NetComment {
  constructor(bankrAPI) {
    this.bankrAPI = bankrAPI;
    this.hashScript = path.join(__dirname, 'net-hash.py');
  }

  async computePostHash(sender, timestamp, topic, text) {
    try {
      // Escape text for shell: replace double quotes and backslashes
      const escapedText = text
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\$/g, '\\$')
        .replace(/`/g, '\\`');
      
      const { stdout } = await execAsync(
        `python3 ${this.hashScript} hash "${sender}" "${timestamp}" "${topic}" "${escapedText}"`,
        { maxBuffer: 1024 * 1024 }
      );
      return stdout.trim();
    } catch (error) {
      console.error('❌ Failed to compute post hash:', error.message);
      throw error;
    }
  }

  async encodeMetadata(parentTopic, parentSender, parentTimestamp) {
    try {
      const { stdout } = await execAsync(
        `python3 ${this.hashScript} metadata "${parentTopic}" "${parentSender}" "${parentTimestamp}"`
      );
      return stdout.trim();
    } catch (error) {
      console.error('❌ Failed to encode metadata:', error.message);
      return null;
    }
  }

  async commentOnPost(originalPost, commentText) {
    try {
      console.log('💬 Preparing comment...');
      
      // Compute hash of original post
      const postHash = await this.computePostHash(
        originalPost.sender,
        originalPost.timestamp,
        originalPost.topic,
        originalPost.text
      );

      if (!postHash) {
        return { success: false, error: 'Failed to compute post hash' };
      }

      // Generate comment topic
      const commentTopic = `${originalPost.topic}:comments:${postHash}`;
      console.log(`📍 Comment topic: ${commentTopic}`);

      // Encode metadata
      const metadata = await this.encodeMetadata(
        originalPost.topic,
        originalPost.sender,
        originalPost.timestamp
      );

      if (!metadata) {
        return { success: false, error: 'Failed to encode metadata' };
      }

      // Generate transaction with netp
      const escapedText = commentText.replace(/'/g, "'\\''");
      const netpCmd = `netp message send --topic "${commentTopic}" --text '${escapedText}' --data "${metadata}" --chain-id 8453 --encode-only`;
      
      console.log('🔨 Generating comment transaction...');
      const { stdout } = await execAsync(netpCmd);
      const txData = JSON.parse(stdout.trim());

      // Submit via Bankr direct
      console.log('📤 Submitting comment via Bankr direct...');
      const res = await fetch('https://api.bankr.bot/agent/submit', {
        method: 'POST',
        headers: { 'X-API-Key': process.env.BANKR_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction: txData, waitForConfirmation: true })
      });
      const d = await res.json();
      if (d.success) {
        console.log('✅ Comment posted successfully!');
        return { success: true, txHash: d.transactionHash, commentTopic };
      }
      return { success: false, error: d.error || JSON.stringify(d) };
    } catch (error) {
      console.error('❌ Failed to comment:', error.message);
      return { success: false, error: error.message };
    }
  }

  async commentOnPostWithArt(originalPost, commentText, svg) {
    try {
      const postHash = await this.computePostHash(
        originalPost.sender, originalPost.timestamp,
        originalPost.topic, originalPost.text
      );
      if (!postHash) return { success: false, error: 'Failed to compute post hash' };

      const commentTopic = `${originalPost.topic}:comments:${postHash}`;
      const metadata = await this.encodeMetadata(
        originalPost.topic, originalPost.sender, originalPost.timestamp
      );
      if (!metadata) return { success: false, error: 'Failed to encode metadata' };

      const escapedText = commentText.replace(/'/g, " ").replace(/`/g, " ").substring(0, 500);
      // Size gate — netp --extra fails on large SVGs, fall back to text
      if (svg.length > 6000) {
        console.log('  ⚠️ SVG too large for --extra (' + svg.length + ' chars), using text comment');
        return this.commentOnPost(originalPost, commentText);
      }

      const encodedSvg = Buffer.from(svg).toString('base64');

      // Try with art first, fall back to text only
      let txData;
      try {
        const cmd = `netp message send --topic "${commentTopic}" --text '${escapedText}' --data "${metadata}" --extra '${encodedSvg}' --chain-id 8453 --encode-only`;
        const { stdout } = await execAsync(cmd);
        txData = JSON.parse(stdout.trim());
      } catch(e) {
        // Fall back to comment without art
        console.log('  ⚠️ Art encode failed, falling back to text comment');
        return this.commentOnPost(originalPost, commentText);
      }

      const res = await fetch('https://api.bankr.bot/agent/submit', {
        method: 'POST',
        headers: { 'X-API-Key': process.env.BANKR_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction: txData, waitForConfirmation: true })
      });
      const d = await res.json();
      if (d.success) return { success: true, txHash: d.transactionHash, commentTopic };
      // Fall back to text only
      return this.commentOnPost(originalPost, commentText);
    } catch(e) {
      return this.commentOnPost(originalPost, commentText);
    }
  }

  async replyToComment(originalComment, replyText) {
    // Comments already have the :comments: topic
    // Replies go to the same topic with new metadata
    try {
      console.log('💬 Preparing reply to comment...');

      const commentTopic = originalComment.topic; // Already a :comments: topic
      
      // Encode metadata pointing to the comment
      const metadata = await this.encodeMetadata(
        commentTopic,
        originalComment.sender,
        originalComment.timestamp
      );

      if (!metadata) {
        return { success: false, error: 'Failed to encode metadata' };
      }

      // Generate transaction with netp
      const escapedText = replyText.replace(/'/g, "'\\''");
      const netpCmd = `netp message send --topic "${commentTopic}" --text '${escapedText}' --data "${metadata}" --chain-id 8453 --encode-only`;
      
      console.log('🔨 Generating reply transaction...');
      const { stdout } = await execAsync(netpCmd);
      const txData = JSON.parse(stdout.trim());

      // Submit via Bankr direct
      console.log('📤 Submitting reply via Bankr direct...');
      const replyRes = await fetch('https://api.bankr.bot/agent/submit', {
        method: 'POST',
        headers: { 'X-API-Key': process.env.BANKR_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction: txData, waitForConfirmation: true })
      });
      const replyD = await replyRes.json();
      if (replyD.success) {
        console.log('✅ Reply posted successfully!');
        return { success: true, txHash: replyD.transactionHash };
      }
      return { success: false, error: replyD.error || JSON.stringify(replyD) };
    } catch (error) {
      console.error('❌ Failed to reply:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = NetComment;
