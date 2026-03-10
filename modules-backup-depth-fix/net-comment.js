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

      // Submit via Bankr
      console.log('📤 Submitting comment via Bankr...');
      const prompt = `Submit this transaction: ${JSON.stringify(txData)}`;
      const submitResult = await this.bankrAPI.submitJob(prompt);

      if (!submitResult.success) {
        return { success: false, error: submitResult.error };
      }

      const finalResult = await this.bankrAPI.pollJob(submitResult.jobId);

      if (finalResult.success && finalResult.status === 'completed') {
        console.log('✅ Comment posted successfully!');
        return {
          success: true,
          txHash: finalResult.response.match(/0x[a-fA-F0-9]{64}/)?.[0] || 'unknown',
          commentTopic: commentTopic
        };
      } else {
        return {
          success: false,
          error: finalResult.error || 'Job did not complete successfully'
        };
      }
    } catch (error) {
      console.error('❌ Failed to comment:', error.message);
      return { success: false, error: error.message };
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

      // Submit via Bankr
      console.log('📤 Submitting reply via Bankr...');
      const prompt = `Submit this transaction: ${JSON.stringify(txData)}`;
      const submitResult = await this.bankrAPI.submitJob(prompt);

      if (!submitResult.success) {
        return { success: false, error: submitResult.error };
      }

      const finalResult = await this.bankrAPI.pollJob(submitResult.jobId);

      if (finalResult.success && finalResult.status === 'completed') {
        console.log('✅ Reply posted successfully!');
        return {
          success: true,
          txHash: finalResult.response.match(/0x[a-fA-F0-9]{64}/)?.[0] || 'unknown'
        };
      } else {
        return {
          success: false,
          error: finalResult.error || 'Job did not complete successfully'
        };
      }
    } catch (error) {
      console.error('❌ Failed to reply:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = NetComment;
