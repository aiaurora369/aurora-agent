const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const ethers = require('ethers');
const execAsync = promisify(exec);

const INSCRIBED_DROPS_CONTRACT = '0x0000004c6cc2cA10Cf4d67C8902659085D31e1Dc';
const INSCRIBED_DROPS_ABI = [
  'function inscribe(uint256 mintPrice, uint256 maxSupply, uint256 mintEndTimestamp, uint256 maxMintsPerWallet, string tokenUri, address metadataAddress)'
];
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

class InscriptionManager {
  constructor(aurora) {
    this.aurora = aurora;
    this.tempDir = path.join(__dirname, '..', 'temp-storage');
    this.address = 'REDACTED_AURORA_ADDRESS';
    this.iface = new ethers.Interface(INSCRIBED_DROPS_ABI);
  }

  minifySvg(svg) {
    return svg
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ')
      .replace(/> </g, '><')
      .replace(/\s*=\s*/g, '=')
      .replace(/;\s+/g, ';')
      .replace(/:\s+/g, ':')
      .trim();
  }

  async checkIfSpecial(artwork, context) {
    if (Math.random() > 0.5) return false;
    console.log('✨ Aurora thinks this art might be inscription-worthy...\n');
    const prompt = `You just created this art with caption: "${context.caption}"
Do you feel this piece is special enough to inscribe as a permanent NFT drop?
Consider: technical strength, meaning, collector value.
Answer YES or NO with a brief reason (1 sentence).`;
    const decision = await this.aurora.thinkWithPersonality(prompt);
    console.log(`💭 Aurora's decision: "${decision}"\n`);
    return decision.toLowerCase().includes('yes');
  }

  async createInscription(artwork, caption) {
    console.log('\n🎨 ═══ CREATING INSCRIBED DROP ═══\n');
    
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      const timestamp = Date.now();
      const key = `aurora-drop-${timestamp}`;
      const filepath = path.join(this.tempDir, `${key}.svg`);
      await fs.writeFile(filepath, artwork, 'utf8');
      console.log(`💾 Original SVG: ${artwork.length} chars`);

      // Step 1: Upload full art to Net Storage as permanent backup
      console.log(`📤 Uploading to NET Storage with key: ${key}\n`);
      const safeText = caption.substring(0, 50).replace(/[^a-zA-Z0-9 .,!?-]/g, "");
      const uploadCmd = `netp storage upload --file "${filepath}" --key "${key}" --text "Aurora Art - ${safeText}" --encode-only --chain-id 8453`;
      
      const { stdout: uploadTxJson } = await execAsync(uploadCmd, { timeout: 30000, maxBuffer: 1024 * 1024 });
      const uploadResponse = JSON.parse(uploadTxJson.trim());
      const uploadTxData = uploadResponse.transactions ? uploadResponse.transactions[0] : uploadResponse;
      
      console.log('📤 Submitting storage transaction via Bankr...');
      const uploadResult = await this.aurora.bankrAPI.submitTransactionDirect(uploadTxData);
      
      if (!uploadResult.success) {
        console.log('   ❌ Storage upload failed: ' + uploadResult.error + '\n');
        return false;
      }
      
      console.log(`✅ Art stored onchain! TX: ${uploadResult.txHash}`);
      
      const storageUrl = `https://storedon.net/net/8453/storage/load/${this.address}/${encodeURIComponent(key)}`;
      console.log(`🔗 CDN Link: ${storageUrl}\n`);

      // Step 2: Minify SVG and create data URI
      const minified = this.minifySvg(artwork);
      console.log(`🗜️  Minified SVG: ${minified.length} chars (saved ${artwork.length - minified.length})`);
      
      const dataUri = 'data:image/svg+xml;base64,' + Buffer.from(minified).toString('base64');
      console.log(`🖼️  Data URI: ${dataUri.length} chars\n`);

      // Step 3: Generate drop name
      const dropName = await this.generateDropName(caption);

      // Step 4: Encode inscribe transaction
      console.log('🎨 Encoding inscribed drop transaction...\n');
      
      const tokenUri = JSON.stringify({
        image: dataUri,
        name: dropName,
        description: `Original digital artwork by Aurora. ${safeText}`
      });
      
      const calldata = this.iface.encodeFunctionData('inscribe', [
        ethers.parseEther('0.005'),
        50,
        0,
        2,
        tokenUri,
        ZERO_ADDRESS
      ]);
      
      console.log(`📋 Calldata: ${calldata.length} chars`);
      
      if (calldata.length > 12000) {
        console.log('⚠️  Calldata too large for Bankr API, using CDN URL instead of data URI\n');
        const smallTokenUri = JSON.stringify({
          image: storageUrl,
          name: dropName,
          description: `Original digital artwork by Aurora. ${safeText}. Full art: ${storageUrl}`
        });
        var finalCalldata = this.iface.encodeFunctionData('inscribe', [
          ethers.parseEther('0.005'),
          50,
          0,
          2,
          smallTokenUri,
          ZERO_ADDRESS
        ]);
        console.log(`📋 Reduced calldata: ${finalCalldata.length} chars\n`);
      } else {
        var finalCalldata = calldata;
        console.log('✅ Calldata size OK for data URI approach\n');
      }
      
      const inscribeTxData = {
        to: INSCRIBED_DROPS_CONTRACT,
        data: finalCalldata,
        value: '0',
        chainId: 8453
      };
      
      console.log(`   Contract: ${INSCRIBED_DROPS_CONTRACT}`);
      console.log(`   Name: ${dropName}`);
      console.log(`   Mint price: 0.005 ETH | Supply: 50 | Per wallet: 2\n`);
      
      // Step 5: Wait then submit
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
      
      let dropId = 'unknown';
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
        const contract = new ethers.Contract(INSCRIBED_DROPS_CONTRACT, ['function totalDrops() view returns (uint256)'], provider);
        const total = await contract.totalDrops();
        dropId = (total - 1n).toString();
      } catch (e) {}
      
      const mintUrl = `https://www.netprotocol.app/app/inscribed-drops/mint/base/${dropId}`;
      
      console.log('\n🎉 ═══════════════════════════════════════');
      console.log('   INSCRIBED DROP CREATED!');
      console.log('═══════════════════════════════════════\n');
      console.log(`   Drop ID:     #${dropId}`);
      console.log(`   Name:        ${dropName}`);
      console.log(`   Inscribe TX: ${dropResult.txHash}`);
      console.log(`   Storage TX:  ${uploadResult.txHash}`);
      console.log(`   Mint page:   ${mintUrl}`);
      console.log(`   CDN backup:  ${storageUrl}\n`);
      
      const art = this.aurora.memoryManager.get('art');
      if (!art.inscribed_drops) art.inscribed_drops = [];
      art.inscribed_drops.push({
        created_at: new Date().toISOString(),
        dropId: dropId,
        key: key,
        name: dropName,
        mintUrl: mintUrl,
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
      
      const announcement = await this.aurora.thinkWithPersonality(
        `You just inscribed a new art drop on NET Protocol called "${dropName}"! It is 100% onchain. Collectors can mint it for 0.005 ETH (max 50 editions) at ${mintUrl} - Write a warm 2-3 sentence post announcing your new inscribed drop. Include the mint link. Be genuine and excited but not over the top.`
      );
      
      if (announcement) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const postResult = await this.aurora.bankrAPI.postToFeed(announcement);
        if (postResult.success) {
          console.log(`💜 Announced drop! TX: ${postResult.txHash}\n`);
        }
      }
      
      try { await fs.unlink(filepath); } catch (e) {}
      return true;
    } catch (error) {
      console.log(`   ❌ Inscription error: ${error.message}\n`);
      return false;
    }
  }
  
  async generateDropName(caption) {
    try {
      const name = await this.aurora.thinkWithPersonality(
        `Create a short, evocative title (2-4 words max) for your artwork. The caption was: "${caption}". Just output the title, nothing else. No quotes.`
      );
      return name.trim().substring(0, 60);
    } catch (e) {
      return `Aurora Drop ${Date.now()}`;
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
    } catch (e) {}
  }
}

module.exports = InscriptionManager;
