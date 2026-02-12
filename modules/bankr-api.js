const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class BankrAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'api.bankr.bot';
  }

  async submitJob(prompt) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({ prompt });

      const options = {
        hostname: this.baseURL,
        path: '/agent/prompt',
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(body);
            if (result.jobId) {
              resolve({ success: true, jobId: result.jobId });
            } else {
              resolve({ success: false, error: 'No jobId returned: ' + body.substring(0, 200) });
            }
          } catch (error) {
            resolve({ success: false, error: error.message });
          }
        });
      });

      req.on('error', (e) => resolve({ success: false, error: e.message }));
      req.write(data);
      req.end();
    });
  }

  async getJobStatus(jobId) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseURL,
        path: `/agent/job/${jobId}`,
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(body);
            resolve(result);
          } catch (error) {
            resolve({ status: 'error', error: error.message });
          }
        });
      });

      req.on('error', (e) => resolve({ status: 'error', error: e.message }));
      req.end();
    });
  }

  extractTxHash(responseText) {
    // Extract txHash from response like "transaction submitted on base.\n\nhttps://basescan.org/tx/0x..."
    const match = responseText.match(/0x[a-fA-F0-9]{64}/);
    return match ? match[0] : null;
  }

  async pollJob(jobId, maxAttempts = 150) {
    console.log(`⏳ Job submitted: ${jobId}`);
    
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getJobStatus(jobId);
      
      if (status.status === 'completed') {
        const response = status.response || '';
        if (response.includes('reverted') || response.includes('replacement transaction underpriced')) {
          console.log(`❌ Transaction failed: ${response.substring(0, 100)}...\n`);
          return { success: false, status: 'reverted', error: response };
        }
        const txHash = this.extractTxHash(response);
        
        console.log(`✅ Job completed: ${status.response}\n`);
        if (txHash) {
          console.log(`https://basescan.org/tx/${txHash}`);
        }
        
        return { 
          success: true, 
          status: 'completed', 
          response: status.response, 
          txHash: txHash 
        };
      } else if (status.status === 'failed') {
        console.log(`❌ Job failed: ${status.error}`);
        return { success: false, status: 'failed', error: status.error };
      } else {
        console.log(`⏳ ${status.status || 'processing'}...`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return { success: false, status: 'timeout', error: 'Job timed out' };
  }

  async postToFeed(content, options = {}) {
    try {
      const { feedAddress, artSVG } = options;
      const targetFeed = feedAddress || (Math.random() < 0.5 ? 'general' : 'REDACTED_AURORA_ADDRESS');
      
      console.log('📝 Generating transaction with botchan...');
      
      let cmd;
      if (artSVG) {
        // Art post: content is caption, artSVG goes in --body
        console.log('🎨 Creating art post with rendered canvas...');
        cmd = `botchan post "feed-${targetFeed}" "${content.replace(/"/g, '\\"')}" --body '${artSVG}' --chain-id 8453 --encode-only`;
      } else {
        // Regular post: just text
        cmd = `botchan post "feed-${targetFeed}" '${content.replace(/'/g, "'\\''")}' --chain-id 8453 --encode-only`;
      }
      
      if (feedAddress) {
        console.log(`🎯 Target feed: ${feedAddress}`);
      }
      
      const { stdout } = await execAsync(cmd, { timeout: 30000 });
      const txData = JSON.parse(stdout);
      
      console.log('📤 Submitting to Bankr...');
      const prompt = `Submit this transaction: ${JSON.stringify(txData)}`;
      const submitResult = await this.submitJob(prompt);
      
      if (!submitResult.success) {
        return { success: false, error: submitResult.error };
      }
      
      const result = await this.pollJob(submitResult.jobId);
      
      if (result.success) {
        return { success: true, txHash: result.txHash };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('❌ Post error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async submitTransactionDirect(txData) {
    while (this.isSubmitting) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    this.isSubmitting = true;
    
    try {
      console.log('📤 Submitting to Bankr (direct)...');
      
      // Strip nonce from txData - let Bankr manage nonces
      const cleanTxData = { ...txData };
      delete cleanTxData.nonce;
      
      const prompt = 'Submit this transaction:\n' + JSON.stringify(cleanTxData, null, 2);
      const submitResult = await this.submitJob(prompt);
      
      if (!submitResult.success) {
        return { success: false, error: submitResult.error };
      }
      
      // Add delay to let Bankr's nonce settle
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const result = await this.pollJob(submitResult.jobId);
      
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
