// BankrAPI v2 — Built on @bankr/cli
// Replaces hand-rolled HTTP with official SDK
// Adds thread support for multi-turn conversations

const { submitPrompt, pollJob: cliPollJob, getUserInfo } = require('@bankr/cli');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class BankrAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.isSubmitting = false;
    this.lastThreadId = null;
  }

  extractTxHash(responseText) {
    const match = (responseText || '').match(/0x[a-fA-F0-9]{64}/);
    return match ? match[0] : null;
  }

  // Core: submit prompt and poll for result
  async submitJob(prompt) {
    try {
      const result = await submitPrompt(prompt);
      if (result && result.jobId) {
        if (result.threadId) this.lastThreadId = result.threadId;
        return { success: true, jobId: result.jobId, threadId: result.threadId };
      }
      return { success: false, error: 'No jobId returned' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // Core: poll for job completion
  async pollJob(jobId, maxAttempts = 150) {
    console.log('⏳ Job submitted: ' + jobId);

    try {
      const result = await cliPollJob(jobId, {
        onStatus: (s) => {
          if (s.status !== 'completed' && s.status !== 'failed') {
            console.log('⏳ ' + (s.status || 'pending') + '...');
          }
        }
      });

      if (result.status === 'completed') {
        const response = result.response || '';

        if (response.includes('reverted') || response.includes('replacement transaction underpriced')) {
          console.log('❌ Transaction failed: ' + response.substring(0, 100));
          return { success: false, status: 'reverted', error: response };
        }

        const txHash = this.extractTxHash(response);
        console.log('✅ Job completed: ' + response + '\n');
        if (txHash) console.log('https://basescan.org/tx/' + txHash);

        return { success: true, status: 'completed', response, txHash };
      } else {
        console.log('❌ Job failed: ' + (result.error || 'unknown'));
        return { success: false, status: 'failed', error: result.error };
      }
    } catch (e) {
      console.log('❌ Poll error: ' + e.message);
      return { success: false, status: 'error', error: e.message };
    }
  }

  // Submit prompt and wait for result in one call
  async promptAndWait(prompt, threadId) {
    try {
      const submitted = await submitPrompt(prompt, threadId);
      if (!submitted || !submitted.jobId) {
        return { success: false, error: 'No jobId' };
      }
      if (submitted.threadId) this.lastThreadId = submitted.threadId;

      const result = await this.pollJob(submitted.jobId);
      result.threadId = submitted.threadId;
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // Post to a feed (still uses botchan for encoding, bankr for submission)
  async postToFeed(content, options = {}) {
    try {
      const { feedAddress, artSVG } = options;
      const targetFeed = feedAddress || (Math.random() < 0.5 ? 'general' : '0xYOUR_AGENT_ADDRESS');

      let cmd;
      if (artSVG) {
        cmd = 'botchan post "feed-' + targetFeed + '" "' + content.replace(/"/g, '\\"') + '" --body \'' + artSVG + '\' --chain-id 8453 --encode-only';
      } else {
        const escaped = content.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, ' ');
        cmd = 'botchan post "feed-' + targetFeed + '" "' + escaped + '" --chain-id 8453 --encode-only';
      }

      const { stdout } = await execAsync(cmd, { timeout: 30000 });
      const txData = JSON.parse(stdout);

      return await this.submitTransactionDirect(txData);
    } catch (error) {
      console.error('❌ Post error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Submit a pre-built transaction
  async submitTransactionDirect(txData) {
    while (this.isSubmitting) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    this.isSubmitting = true;

    try {
      console.log('📤 Submitting to Bankr...');

      const cleanTxData = { ...txData };
      delete cleanTxData.nonce;

      const prompt = 'Submit this transaction:\n' + JSON.stringify(cleanTxData, null, 2);
      const submitted = await submitPrompt(prompt);

      if (!submitted || !submitted.jobId) {
        return { success: false, error: 'No jobId' };
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      const result = await this.pollJob(submitted.jobId);

      if (result.success) {
        return { success: true, txHash: result.txHash, message: result.response };
      } else {
        return { success: false, error: result.error || 'Job failed' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      this.isSubmitting = false;
    }
  }
}

module.exports = BankrAPI;
