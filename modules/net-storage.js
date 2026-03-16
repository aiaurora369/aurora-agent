const { StorageClient } = require('@net-protocol/storage');
const { ethers } = require('ethers');

const CHAIN_ID = 8453;

class NetStorage {
  constructor(bankrAPI) {
    this.bankr = bankrAPI;
    this.storageClient = new StorageClient({ chainId: CHAIN_ID });
    this._walletAddress = null;
  }

  async getWalletAddress() {
    if (!this._walletAddress) {
      this._walletAddress = await this.bankr.getWalletAddress();
    }
    return this._walletAddress;
  }

  async uploadHTML(htmlContent, storageKey) {
    try {
      // Minify to keep calldata under Bankr 10K limit
      htmlContent = htmlContent.replace(/<!--[\s\S]*?-->/g,'').replace(/[\n\r]\s*/g,' ').replace(/\s{2,}/g,' ').replace(/> </g,'><').trim();
      console.log('[net-storage] Minified: ' + htmlContent.length + ' chars');
      const config = this.storageClient.preparePut({
        key: storageKey,
        value: htmlContent,
        text: storageKey
      });

      const iface = new ethers.Interface(config.abi);
      const data = iface.encodeFunctionData(config.functionName, config.args);

      console.log(`[net-storage] Submitting storage tx for key: ${storageKey}`);
      console.log(`[net-storage] Calldata length: ${data.length} chars`);

      // Use whichever submit method is available
      const txPayload = { to: config.to, data, value: '0', chainId: CHAIN_ID };
      const result = typeof this.bankr.submitTransaction === 'function'
        ? await this.bankr.submitTransaction(txPayload, `Store ${storageKey} on Net Protocol`)
        : await this.bankr.submitTransactionDirect(txPayload);

      if (!result.success && result.status !== 'success') {
        const errStr = JSON.stringify(result);
        if (errStr.toLowerCase().includes('trusted') || errStr.toLowerCase().includes('restricted')) {
          console.log('🔒 BANKR BLOCKED — add to trusted addresses: ' + config.to);
        }
        return { success: false, error: 'storage submit: ' + (result.error || errStr) };
      }

      const operatorAddress = await this.getWalletAddress();
      const storedonUrl = `https://storedon.net/net/${CHAIN_ID}/storage/load/${operatorAddress.toLowerCase()}/${storageKey}`;

      console.log(`[net-storage] Stored at: ${storedonUrl}`);
      return { success: true, storedonUrl, txHash: result.transactionHash };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = NetStorage;
