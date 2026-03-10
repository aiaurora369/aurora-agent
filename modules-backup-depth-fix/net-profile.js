const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class NetProfile {
  constructor(bankrAPI, netStorage, chainId = 8453) {
    this.bankr = bankrAPI;
    this.storage = netStorage;
    this.chainId = chainId;
  }

  async setCanvasFromSVG(svgContent, artName) {
    try {
      console.log('Setting profile canvas...');
      const html = '<!DOCTYPE html><html><head><style>body{margin:0;padding:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#0a0a1a;}svg{max-width:100%;height:auto;}</style></head><body>' + svgContent + '</body></html>';
      
      const escaped = html.replace(/"/g, '\\"').replace(/\$/g, '\\$');
      const { stdout } = await execAsync('netp profile set-canvas --content "' + escaped + '" --chain-id ' + this.chainId + ' --encode-only', { timeout: 30000 });
      
      const txData = JSON.parse(stdout.trim());
      const result = await this.bankr.submitArbitraryTransaction(txData);
      
      if (result.success) {
        console.log('Canvas updated! TX: ' + result.txHash);
      }
      
      return { success: result.success, canvasTxHash: result.txHash, error: result.error };
    } catch (error) {
      console.error('Canvas update failed: ' + error.message);
      return { success: false, error: error.message };
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async setPicture(imageUrl) {
    try {
      console.log('Setting profile picture from URL...');
      const command = 'netp profile set-picture --url "' + imageUrl + '" --encode-only --chain-id ' + this.chainId;
      const { stdout } = await execAsync(command, { timeout: 30000 });
      const txData = JSON.parse(stdout);
      console.log('📤 Submitting via Bankr...');
      const result = await this.bankrAPI.submitTransactionDirect(txData);
      if (result.success) {
        return { success: true, txHash: result.txHash };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = NetProfile;
