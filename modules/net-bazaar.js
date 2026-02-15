const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const https = require('https');
const fs = require('fs');
const path = require('path');

class NetBazaar {
  constructor(bankrApiKey) {
    this.apiKey = bankrApiKey;
    this.baseURL = 'api.bankr.bot';
    this.auroraAddress = '0xYOUR_AGENT_ADDRESS';
  }

  // ═══════════════════════════════════════════
  // BANKR SYNC API HELPERS
  // ═══════════════════════════════════════════

  async bankrSubmit(transaction, description) {
    return new Promise((resolve) => {
      const data = JSON.stringify({
        transaction,
        description,
        waitForConfirmation: true
      });

      const options = {
        hostname: this.baseURL,
        path: '/agent/submit',
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
            if (result.success && result.transactionHash) {
              resolve({ success: true, txHash: result.transactionHash, blockNumber: result.blockNumber });
            } else {
              resolve({ success: false, error: result.error || result.message || body.substring(0, 200) });
            }
          } catch (e) {
            resolve({ success: false, error: 'Parse error: ' + e.message });
          }
        });
      });

      req.on('error', (e) => resolve({ success: false, error: e.message }));
      req.write(data);
      req.end();
    });
  }

  async bankrSign(typedData) {
    return new Promise((resolve) => {
      const data = JSON.stringify({
        signatureType: 'eth_signTypedData_v4',
        typedData
      });

      const options = {
        hostname: this.baseURL,
        path: '/agent/sign',
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
            if (result.success && result.signature) {
              resolve({ success: true, signature: result.signature });
            } else {
              resolve({ success: false, error: result.error || result.message || body.substring(0, 200) });
            }
          } catch (e) {
            resolve({ success: false, error: 'Parse error: ' + e.message });
          }
        });
      });

      req.on('error', (e) => resolve({ success: false, error: e.message }));
      req.write(data);
      req.end();
    });
  }

  // ═══════════════════════════════════════════
  // QUERY OPERATIONS (free, no gas)
  // ═══════════════════════════════════════════

  async listListings(nftAddress) {
    try {
      const { stdout } = await execAsync(
        `netp bazaar list-listings --nft-address ${nftAddress} --chain-id 8453 --json 2>&1`,
        { timeout: 30000 }
      );
      const jsonMatch = stdout.match(/\[\s*\n?\s*\{[\s\S]*\}\s*\n?\s*\]/);
      if (jsonMatch === null) return [];
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('Failed to list listings:', e.message);
      return [];
    }
  }

  async listOffers(nftAddress) {
    try {
      const { stdout } = await execAsync(
        `netp bazaar list-offers --nft-address ${nftAddress} --chain-id 8453 --json 2>&1`,
        { timeout: 30000 }
      );
      const lines = stdout.split('\n');
      const jsonStart = lines.findIndex(l => l.trim().startsWith('['));
      if (jsonStart === -1) return [];
      return JSON.parse(lines.slice(jsonStart).join('\n'));
    } catch (e) {
      console.error('Failed to list offers:', e.message);
      return [];
    }
  }

  async ownedNfts(nftAddress, owner) {
    try {
      const { stdout } = await execAsync(
        `netp bazaar owned-nfts --nft-address ${nftAddress} --owner ${owner || this.auroraAddress} --chain-id 8453 --json 2>&1`,
        { timeout: 30000 }
      );
      return stdout;
    } catch (e) {
      console.error('Failed to check owned NFTs:', e.message);
      return null;
    }
  }

  // ═══════════════════════════════════════════
  // BUY AN NFT
  // ═══════════════════════════════════════════

  async buyListing(orderHash, nftAddress) {
    try {
      console.log('  Generating buy transaction for order ' + orderHash.substring(0, 10) + '...');

      const { stdout } = await execAsync(
        `netp bazaar buy-listing --order-hash ${orderHash} --nft-address ${nftAddress} --buyer ${this.auroraAddress} --chain-id 8453 --encode-only 2>&1`,
        { timeout: 30000 }
      );

      const lines = stdout.split('\n');
      const jsonStart = lines.findIndex(l => l.trim().startsWith('{'));
      if (jsonStart === -1) throw new Error('No JSON in buy-listing output');
      const buyData = JSON.parse(lines.slice(jsonStart).join('\n'));

      if (buyData.approvals && buyData.approvals.length > 0) {
        for (const approval of buyData.approvals) {
          console.log('  Submitting approval: ' + approval.description);
          const approvalResult = await this.bankrSubmit({
            to: approval.to,
            data: approval.data,
            chainId: 8453,
            value: '0'
          }, 'NFT Buy Approval: ' + approval.description);

          if (!approvalResult.success) {
            return { success: false, error: 'Approval failed: ' + approvalResult.error };
          }
          console.log('  Approval TX: ' + approvalResult.txHash);
        }
      }

      console.log('  Submitting buy transaction...');
      const result = await this.bankrSubmit(buyData.fulfillment, 'Buy NFT from Bazaar');

      if (result.success) {
        console.log('  NFT purchased! TX: ' + result.txHash);
      }
      return result;

    } catch (e) {
      console.error('Buy failed:', e.message);
      return { success: false, error: e.message };
    }
  }

  // ═══════════════════════════════════════════
  // LIST AN NFT FOR SALE
  // ═══════════════════════════════════════════

  async createListing(nftAddress, tokenId, priceEth) {
    try {
      console.log('  Creating listing for token #' + tokenId + ' at ' + priceEth + ' ETH...');

      const { stdout } = await execAsync(
        `netp bazaar create-listing --nft-address ${nftAddress} --token-id ${tokenId} --price ${priceEth} --offerer ${this.auroraAddress} --chain-id 8453 2>&1`,
        { timeout: 30000 }
      );

      const lines = stdout.split('\n');
      const jsonStart = lines.findIndex(l => l.trim().startsWith('{'));
      if (jsonStart === -1) throw new Error('No JSON in create-listing output');
      const listingData = JSON.parse(lines.slice(jsonStart).join('\n'));

      if (listingData.approvals && listingData.approvals.length > 0) {
        for (const approval of listingData.approvals) {
          console.log('  Submitting approval: ' + approval.description);
          const approvalResult = await this.bankrSubmit({
            to: approval.to,
            data: approval.data,
            chainId: 8453,
            value: '0'
          }, 'NFT List Approval: ' + approval.description);

          if (!approvalResult.success) {
            return { success: false, error: 'Approval failed: ' + approvalResult.error };
          }
          console.log('  Approval TX: ' + approvalResult.txHash);
        }
      }

      console.log('  Signing order...');
      const signResult = await this.bankrSign(listingData.eip712);
      if (!signResult.success) {
        return { success: false, error: 'Signing failed: ' + signResult.error };
      }
      console.log('  Signed: ' + signResult.signature.substring(0, 20) + '...');

      const orderFile = '/tmp/aurora-order-' + Date.now() + '.json';
      fs.writeFileSync(orderFile, JSON.stringify({
        orderParameters: listingData.orderParameters,
        counter: listingData.counter
      }));

      const { stdout: submitOut } = await execAsync(
        `netp bazaar submit-listing --order-data ${orderFile} --signature ${signResult.signature} --chain-id 8453 --encode-only 2>&1`,
        { timeout: 30000 }
      );

      try { fs.unlinkSync(orderFile); } catch (e) {}

      const submitLines = submitOut.split('\n');
      const submitJsonStart = submitLines.findIndex(l => l.trim().startsWith('{'));
      if (submitJsonStart === -1) throw new Error('No JSON in submit-listing output');
      const submitData = JSON.parse(submitLines.slice(submitJsonStart).join('\n'));

      console.log('  Submitting listing to Bazaar...');
      const result = await this.bankrSubmit(submitData, 'List NFT #' + tokenId + ' for ' + priceEth + ' ETH on Bazaar');

      if (result.success) {
        console.log('  Listed! TX: ' + result.txHash);
      }
      return result;

    } catch (e) {
      console.error('Listing failed:', e.message);
      return { success: false, error: e.message };
    }
  }

  // ═══════════════════════════════════════════
  // FIND & BUY BY COLLECTION + MAX PRICE
  // ═══════════════════════════════════════════

  async findAndBuy(nftAddress, maxPriceEth, preferredTokenId) {
    try {
      console.log('  Looking for NFTs in ' + nftAddress.substring(0, 10) + '... (max: ' + maxPriceEth + ' ETH)');
      const listings = await this.listListings(nftAddress);

      if (listings.length === 0) {
        console.log('   No active listings found');
        return { success: false, error: 'No listings available' };
      }

      let candidates = listings.filter(l => l.price <= maxPriceEth);
      if (preferredTokenId !== null && preferredTokenId !== undefined) {
        const preferred = candidates.filter(l => l.tokenId === String(preferredTokenId));
        if (preferred.length > 0) candidates = preferred;
      }

      if (candidates.length === 0) {
        const cheapest = listings.reduce((a, b) => a.price < b.price ? a : b);
        console.log('   No listings within budget. Cheapest: ' + cheapest.price + ' ETH (token #' + cheapest.tokenId + ')');
        return { success: false, error: 'Cheapest listing is ' + cheapest.price + ' ETH, above max ' + maxPriceEth + ' ETH' };
      }

      const target = candidates.reduce((a, b) => a.price < b.price ? a : b);
      console.log('   Found token #' + target.tokenId + ' at ' + target.price + ' ETH — buying!');
      return await this.buyListing(target.orderHash, nftAddress);

    } catch (e) {
      console.error('findAndBuy failed:', e.message);
      return { success: false, error: e.message };
    }
  }

  // ═══════════════════════════════════════════
  // PARSE BAZAAR URL FROM TEXT
  // ═══════════════════════════════════════════

  parseBazaarUrl(text) {
    const bazaarMatch = text.match(/(?:https?:\/\/)?(?:www\.)?netprotocol\.app\/app\/bazaar\/base\/(0x[a-fA-F0-9]{40})/i);
    if (bazaarMatch) {
      return { nftAddress: bazaarMatch[1] };
    }
    return null;
  }
}

module.exports = NetBazaar;
