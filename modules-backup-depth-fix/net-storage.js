const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const execAsync = promisify(exec);

class NetStorage {
  constructor(bankrAPI, chainId = 8453) {
    this.bankr = bankrAPI;
    this.chainId = chainId;
    this.storageDir = path.join(__dirname, '..', 'temp-storage');
  }

  async ensureStorageDir() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {}
  }

  async uploadSVG(svgContent, name) {
    try {
      await this.ensureStorageDir();
      const filename = name.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '-' + Date.now() + '.svg';
      const filepath = path.join(this.storageDir, filename);
      await fs.writeFile(filepath, svgContent, 'utf8');
      console.log('Saved temp SVG');
      return { success: true, storageUrl: 'temp://' + filename };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = NetStorage;
