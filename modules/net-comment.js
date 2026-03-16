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

      // Generate transaction with botchan
      const escapedText = commentText.replace(/"/g, "'").replace(/`/g, "'").substring(0, 500);
      console.log('🔨 Generating comment transaction...');
      const { spawnSync } = require('child_process');
      const bcr = spawnSync('botchan', [
        'post', commentTopic, escapedText,
        '--encode-only', '--chain-id', '8453'
      ], { encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
      if (bcr.status !== 0 || !bcr.stdout) throw new Error(bcr.stderr || 'botchan failed');
      const txData = JSON.parse(bcr.stdout.trim());

      // Submit via bankrAPI (queued — prevents in-flight limit errors)
      console.log('📤 Submitting comment via Bankr...');
      const result = await this.bankrAPI.submitTransactionDirect(txData);
      if (result.success) {
        console.log('✅ Comment posted successfully!');
        return { success: true, txHash: result.txHash, commentTopic };
      }
      return { success: false, error: result.error || 'submit failed' };
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

      const escapedText = commentText.replace(/"/g, "'").replace(/`/g, "'").substring(0, 500);

      // Use botchan --data for SVG (handles large SVGs, same as mfers feed)
      let txData;
      try {
        const { spawnSync } = require('child_process');
        const r = spawnSync('botchan', [
          'post', commentTopic, escapedText,
          '--data', svg,
          '--encode-only', '--chain-id', '8453'
        ], { encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
        if (r.status !== 0 || !r.stdout) throw new Error(r.stderr || 'botchan failed');
        txData = JSON.parse(r.stdout.trim());
      } catch(e) {
        console.log('  ⚠️ Art encode failed, falling back to text comment');
        return this.commentOnPost(originalPost, commentText);
      }

      const artResult = await this.bankrAPI.submitTransactionDirect(txData);
      if (artResult.success) return { success: true, txHash: artResult.txHash, commentTopic };
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

      // Generate transaction with botchan
      const escapedText = replyText.replace(/"/g, "'").replace(/`/g, "'").substring(0, 500);
      console.log('🔨 Generating reply transaction...');
      const { spawnSync: spawnSyncR } = require('child_process');
      const rr = spawnSyncR('botchan', [
        'post', commentTopic, escapedText,
        '--encode-only', '--chain-id', '8453'
      ], { encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
      if (rr.status !== 0 || !rr.stdout) throw new Error(rr.stderr || 'botchan failed');
      const txData = JSON.parse(rr.stdout.trim());

      // Submit via bankrAPI (queued — prevents in-flight limit errors)
      console.log('📤 Submitting reply via Bankr...');
      const replyResult = await this.bankrAPI.submitTransactionDirect(replyTxData);
      if (replyResult.success) {
        console.log('✅ Reply posted successfully!');
        return { success: true, txHash: replyResult.txHash };
      }
      return { success: false, error: replyResult.error || 'submit failed' };
    } catch (error) {
      console.error('❌ Failed to reply:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = NetComment;
