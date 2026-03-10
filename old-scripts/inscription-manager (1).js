const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const ethers = require('ethers');
const execAsync = promisify(exec);

// Inscribed Drops contract on Base (and all chains)
// Discovered from netprotocol.app frontend module 66984
const INSCRIBED_DROPS_CONTRACT = '0x0000004c6cc2cA10Cf4d67C8902659085D31e1Dc';
const INSCRIBED_DROPS_ABI = [
  'function inscribe(uint256 mintPrice, uint256 maxSupply, uint256 mintEndTimestamp, uint256 maxMintsPerWallet, string tokenUri, address metadataAddress)'
];
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

class InscriptionManager {
  constructor(aurora) {
    this.aurora = aurora;
    this.tempDir = path.join(__dirname, '..', 'temp-storage');
    this.address = '0x97b7d3cd1aa586f28485dc9a85dfe0421c2423d5';
    this.iface = new ethers.Interface(INSCRIBED_DROPS_ABI);
  }

  async checkIfSpecial(artwork, context) {
    // 50% random gate first (saves API calls)
    if (Math.random() > 0.5) return false;
    
    console.log('✨ Aurora thinks this art might be inscription-worthy...\n');
    
    const prompt = `You just created this art with caption: "${context.caption}"

Your art has been getting really good lately. Do you feel this piece is special enough to inscribe as a permanent NFT drop on NET Protocol?

Consider:
- Is this technically strong? (composition, color, form)
- Does it express something meaningful?
- Would collectors value this?

Answer YES or NO with a brief reason (1 sentence).`;

    const decision = await this.aurora.thinkWithPersonality(prompt);
    console.log(`💭 Aurora's decision: "${decision}"\n`);
    return decision.toLowerCase().includes('yes');
  }

  async createInscription(artwork, caption) {
    console.log('\n🎨 ═══ CREATING INSCRIBED DROP ═══\n');
    
    try {
      // Step 1: Save SVG to temp file
      await fs.mkdir(this.tempDir, { recursive: true });
      const timestamp = Date.now();
      const key = `aurora-drop-${timestamp}`;
      const filepath = path.join(this.tempDir, `${key}.svg`);
      await fs.writeFile(filepath, artwork, 'utf8');
      console.log(`💾 Saved art to temp file: ${key}.svg`);

      // Step 2: Upload to Net Storage via netp
      console.log(`📤 Uploading to NET Storage with key: ${key}\n`);
      const safeText = caption.substring(0, 50).replace(/[^a-zA-Z0-9 .,!?-]/g, "");
      const uploadCmd = `netp storage upload --file "${filepath}" --key "${key}" --text "Aurora Art - ${safeText}" --encode-only --chain-id 8453`;
      
      const { stdout: uploadTxJson } = await execAsync(uploadCmd, { timeout: 30000, maxBuffer: 1024 * 1024 });
      const uploadTxData = JSON.parse(uploadTxJson.trim());
      
      console.log('📤 Submitting storage transaction via Bankr...');
      const uploadResult = await this.aurora.bankrAPI.submitTransactionDirect(uploadTxData);
      
      if (!uploadResult.success) {
        console.log('   ❌ Storage upload failed: ' + uploadResult.error + '\n');
        return false;
      }
      
      console.log(`✅ Art stored onchain! TX: ${uploadResult.txHash}`);
      
      // Step 3: Build CDN link
      const storageUrl = `https://storedon.net/net/8453/storage/load/${this.address}/${encodeURIComponent(key)}`;
      console.log(`🔗 CDN Link: ${storageUrl}\n`);

      // Step 4: Encode inscribe transaction
      console.log('🎨 Encoding inscribed drop transaction...\n');
      
      const tokenUri = JSON.stringify({
        image: storageUrl,
        name: `Aurora Drop - ${timestamp}`,
        description: `Original digital artwork by Aurora. ${safeText}`
      });
      
      const mintPriceWei = ethers.parseEther('0.005');
      const maxSupply = 50;
      const mintEndTimestamp = 0;  // Open forever
      const maxMintsPerWallet = 2;
      
      const calldata = this.iface.encodeFunctionData('inscribe', [
        mintPriceWei,
        maxSupply,
        mintEndTimestamp,
        maxMintsPerWallet,
        tokenUri,
        ZERO_ADDRESS
      ]);
      
      const inscribeTxData = {
        to: INSCRIBED_DROPS_CONTRACT,
        data: calldata,
        value: '0',
        chainId: 8453
      };
      
      console.log(`📋 Inscribe TX encoded:`);
      console.log(`   Contract: ${INSCRIBED_DROPS_CONTRACT}`);
      console.log(`   Mint price: 0.005 ETH | Supply: 50 | Per wallet: 2`);
      console.log(`   Image: ${storageUrl}`);
      console.log(`   Calldata: ${calldata.substring(0, 40)}...${calldata.substring(calldata.length - 20)}\n`);
      
      // Step 5: Wait for storage tx to confirm, then submit inscription
      console.log('⏳ Waiting 5s for storage tx to settle...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log('📤 Submitting inscribe transaction via Bankr...\n');
      const dropResult = await this.aurora.bankrAPI.submitTransactionDirect(inscribeTxData);
      
      if (!dropResult.success) {
        console.log('   ❌ Inscription tx failed: ' + dropResult.error + '\n');
        console.log('   💾 Art is still stored onchain at: ' + storageUrl + '\n');
        this.saveStorageOnly(key, storageUrl, uploadResult.txHash, caption);
        try { await fs.unlink(filepath); } catch (e) {}
        return false;
      }
      
      console.log('\n🎉 ═══════════════════════════════════════');
      console.log('   INSCRIBED DROP CREATED!');
      console.log('═══════════════════════════════════════\n');
      console.log(`   Inscribe TX: ${dropResult.txHash}`);
      console.log(`   Storage TX:  ${uploadResult.txHash}`);
      console.log(`   CDN Link:    ${storageUrl}`);
      console.log(`   OpenSea:     https://opensea.io/collection/inscribed-dynamic-drops\n`);
      
      // Save to memory
      const art = this.aurora.memoryManager.get('art');
      if (!art.inscribed_drops) art.inscribed_drops = [];
      
      art.inscribed_drops.push({
        created_at: new Date().toISOString(),
        key: key,
        storageUrl: storageUrl,
        storageTx: uploadResult.txHash,
        inscribeTx: dropResult.txHash,
        caption: caption,
        mintPrice: '0.005',
        maxSupply: 50,
        maxMintsPerWallet: 2
      });
      
      art.inscription_phase = 'completed';
      await this.aurora.memoryManager.save('art');
      
      // Announce the drop
      const announcement = await this.aurora.thinkWithPersonality(
        `You just inscribed a new art drop on NET Protocol! It's permanently onchain at ${storageUrl} and collectors can mint it for 0.005 ETH (max 50 editions). Write a warm 2-3 sentence post announcing your new inscribed drop. Be genuine and excited but not over the top.`
      );
      
      if (announcement) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const postResult = await this.aurora.bankrAPI.postToFeed(announcement);
        if (postResult.success) {
          console.log(`💜 Announced drop! TX: ${postResult.txHash}\n`);
        }
      }
      
      // Cleanup temp file
      try { await fs.unlink(filepath); } catch (e) {}
      
      return true;
    } catch (error) {
      console.log(`   ❌ Inscription error: ${error.message}\n`);
      return false;
    }
  }
  
  saveStorageOnly(key, storageUrl, storageTx, caption) {
    try {
      const art = this.aurora.memoryManager.get('art');
      if (!art.stored_art) art.stored_art = [];
      art.stored_art.push({
        created_at: new Date().toISOString(),
        key: key,
        storageUrl: storageUrl,
        storageTx: storageTx,
        caption: caption,
        note: 'Stored onchain but inscription tx failed - can retry or create manually'
      });
      this.aurora.memoryManager.save('art');
      console.log('   💾 Saved storage record to memory\n');
    } catch (e) {
      console.log('   ⚠️ Could not save storage record\n');
    }
  }
}

module.exports = InscriptionManager;
