// net-upvote.js - Score Protocol upvoting for Aurora
// Enables upvoting tokens and profiles (Net Storage content) onchain

const { ethers } = require('ethers');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================================
// Contract Addresses (Base Chain)
// ============================================================
const CONTRACTS = {
  UPVOTE_APP: '0x00000001f0b8173316a016a5067ad74e8cea47bf',
  UPVOTE_STORAGE_APP: '0x000000060CEB69D023227DF64CfB75eC37c75B62',
  PURE_ALPHA_STRATEGY: '0x00000001b1bcdeddeafd5296aaf4f3f3e21ae876',
  USER_UPVOTE: '0xA4bc2C63DD0157692Fd5F409389E5032e37D8895',
};

// Cost per upvote: 0.000025 ETH (+ 2.5% fee handled by contract)
const COST_PER_UPVOTE = ethers.parseEther('0.000025');

// Known profile storage keys (bytes32, right-padded ASCII)
const PROFILE_KEYS = {
  PICTURE: '0x0000006e65742d62657461302e302e312d70726f66696c652d70696374757265',
  METADATA: '0x00006e65742d62657461302e302e312d70726f66696c652d6d65746164617461',
};

// ============================================================
// ABI Fragments
// ============================================================

const UPVOTE_APP_ABI = [
  'function upvote(address strategy, bytes32 scoreKey, uint256 scoreDelta, bytes scoreStoredContext, bytes scoreUnstoredContext) payable',
];

const UPVOTE_STORAGE_APP_ABI = [
  'function upvote(address strategy, address storageOperatorAddress, bytes32 storageKey, uint256 scoreDelta, bytes scoreUnstoredContext) payable',
];

const USER_UPVOTE_ABI = [
  'function upvoteUser(address userToUpvote, address token, uint256 numUpvotes, uint24 feeTier) payable',
];

// ============================================================
// Memory / Dedup
// ============================================================
const MEMORY_DIR = path.join(__dirname, '..', 'memory');
const UPVOTE_MEMORY_FILE = path.join(MEMORY_DIR, 'aurora-upvoted.json');

function loadUpvoteMemory() {
  try {
    if (fs.existsSync(UPVOTE_MEMORY_FILE)) {
      return JSON.parse(fs.readFileSync(UPVOTE_MEMORY_FILE, 'utf8'));
    }
  } catch (e) {
    console.log('⚠️ Could not load upvote memory, starting fresh');
  }
  return { tokens: {}, profiles: {}, storage: {}, dailySpend: {}, totalUpvotes: 0 };
}

function saveUpvoteMemory(memory) {
  try {
    if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
    fs.writeFileSync(UPVOTE_MEMORY_FILE, JSON.stringify(memory, null, 2));
  } catch (e) {
    console.log('⚠️ Could not save upvote memory:', e.message);
  }
}

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

// ============================================================
// Core Upvote Class
// ============================================================

class NetUpvote {
  constructor(bankrAPI, chainId = 8453) {
    this.bankrAPI = bankrAPI;
    this.chainId = chainId;
    this.memory = loadUpvoteMemory();
    this.MAX_DAILY_UPVOTES = 3;
  }

  getDailyUpvoteCount() {
    return this.memory.dailySpend[getTodayKey()] || 0;
  }

  canUpvoteToday() {
    return this.getDailyUpvoteCount() < this.MAX_DAILY_UPVOTES;
  }

  recordUpvote(type, key, count = 1) {
    const today = getTodayKey();
    this.memory.dailySpend[today] = (this.memory.dailySpend[today] || 0) + count;
    this.memory.totalUpvotes = (this.memory.totalUpvotes || 0) + count;
    if (type === 'token') {
      this.memory.tokens[key] = (this.memory.tokens[key] || 0) + count;
    } else if (type === 'profile') {
      this.memory.profiles[key] = (this.memory.profiles[key] || 0) + count;
    } else if (type === 'storage') {
      this.memory.storage[key] = (this.memory.storage[key] || 0) + count;
    }
    saveUpvoteMemory(this.memory);
  }

  hasUpvotedProfile(address) {
    return (this.memory.profiles[address.toLowerCase()] || 0) > 0;
  }

  hasUpvotedToken(tokenAddress) {
    return (this.memory.tokens[tokenAddress.toLowerCase()] || 0) > 0;
  }

  // Token Upvoting (via UpvoteApp)
  async upvoteToken(tokenAddress, scoreDelta = 1) {
    if (!this.canUpvoteToday()) {
      console.log('⚡ Daily upvote budget reached, skipping');
      return { success: false, error: 'Daily upvote budget reached' };
    }
    try {
      console.log(`⬆️ Upvoting token ${tokenAddress} (x${scoreDelta})...`);
      const scoreKey = ethers.zeroPadValue(tokenAddress, 32);
      const iface = new ethers.Interface(UPVOTE_APP_ABI);
      const data = iface.encodeFunctionData('upvote', [
        CONTRACTS.PURE_ALPHA_STRATEGY,
        scoreKey,
        scoreDelta,
        '0x',
        '0x',
      ]);
      const value = COST_PER_UPVOTE * BigInt(scoreDelta);
      const txData = {
        to: CONTRACTS.UPVOTE_APP,
        data: data,
        value: value.toString(),
        chainId: this.chainId,
      };
      const result = await this.bankrAPI.submitTransactionDirect(txData);
      if (result.success) {
        this.recordUpvote('token', tokenAddress.toLowerCase(), scoreDelta);
        console.log(`✅ Upvoted token ${tokenAddress} x${scoreDelta}! TX: ${result.txHash || 'pending'}`);
      } else {
        console.log(`❌ Token upvote failed: ${result.error}`);
      }
      return result;
    } catch (error) {
      console.log(`❌ Token upvote error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // Profile Upvoting (via UpvoteStorageApp)
  // Profile/User Upvoting (via UserUpvoteContract - same as the UI)
  async upvoteProfile(ownerAddress, scoreDelta = 1) {
    if (!this.canUpvoteToday()) {
      console.log('\u26a1 Daily upvote budget reached, skipping');
      return { success: false, error: 'Daily upvote budget reached' };
    }
    try {
      // 1% probability gate — Aurora is selective, not a free boost machine
      if (Math.random() > 0.01) {
        console.log('⚡ Upvote roll: not this time (1% chance)');
        return { success: false, error: 'Probability gate (1%)' };
      }

      // Quality gate — only the best profiles get Aurora's upvote
      const quality = this.checkProfileQuality(ownerAddress);
      if (!quality.qualified) {
        console.log('⚡ Profile not high enough quality for upvote: ' + quality.reasons.join(', '));
        return { success: false, error: 'Quality gate failed' };
      }

      // Already upvoted? Skip
      if (this.hasUpvotedProfile(ownerAddress)) {
        console.log('⚡ Already upvoted this profile, skipping');
        return { success: false, error: 'Already upvoted' };
      }

      console.log(`\u2b06\ufe0f Upvoting profile of ${ownerAddress} (x${scoreDelta}) — QUALITY PROFILE!`);
      const iface = new ethers.Interface(USER_UPVOTE_ABI);
      const data = iface.encodeFunctionData('upvoteUser', [
        ownerAddress,
        '0x0000000000000000000000000000000000000000',
        scoreDelta,
        0,
      ]);
      const value = COST_PER_UPVOTE * BigInt(scoreDelta);
      const txData = {
        to: CONTRACTS.USER_UPVOTE,
        data: data,
        value: value.toString(),
        chainId: this.chainId,
      };
      const result = await this.bankrAPI.submitTransactionDirect(txData);
      if (result.success) {
        this.recordUpvote('profiles', ownerAddress.toLowerCase(), scoreDelta);
        console.log(`\u2705 Upvoted profile of ${ownerAddress} x${scoreDelta}! TX: ${result.txHash || 'pending'}`);
      } else {
        console.log(`\u274c Profile upvote failed: ${result.error}`);
      }
      return result;
    } catch (error) {
      console.log(`\u274c Profile upvote error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }


  // Generic Storage Upvoting (inscriptions, art, etc)
  async upvoteStorage(operatorAddress, storageKey, scoreDelta = 1) {
    if (!this.canUpvoteToday()) {
      console.log('⚡ Daily upvote budget reached, skipping');
      return { success: false, error: 'Daily upvote budget reached' };
    }
    try {
      const shortKey = storageKey.slice(0, 10) + '...';
      console.log(`⬆️ Upvoting storage ${shortKey} by ${operatorAddress} (x${scoreDelta})...`);
      const iface = new ethers.Interface(UPVOTE_STORAGE_APP_ABI);
      const data = iface.encodeFunctionData('upvote', [
        CONTRACTS.PURE_ALPHA_STRATEGY,
        operatorAddress,
        storageKey,
        scoreDelta,
        '0x',
      ]);
      const value = COST_PER_UPVOTE * BigInt(scoreDelta);
      const txData = {
        to: CONTRACTS.UPVOTE_STORAGE_APP,
        data: data,
        value: value.toString(),
        chainId: this.chainId,
      };
      const result = await this.bankrAPI.submitTransactionDirect(txData);
      if (result.success) {
        const memKey = `${operatorAddress.toLowerCase()}:${storageKey}`;
        this.recordUpvote('storage', memKey, scoreDelta);
        console.log(`✅ Upvoted storage content x${scoreDelta}! TX: ${result.txHash || 'pending'}`);
      } else {
        console.log(`❌ Storage upvote failed: ${result.error}`);
      }
      return result;
    } catch (error) {
      console.log(`❌ Storage upvote error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }


  // Resolve token symbol to address
  resolveTokenAddress(symbolOrAddress) {
    if (symbolOrAddress.startsWith('0x')) return symbolOrAddress;
    return TOKEN_ADDRESSES[symbolOrAddress.toUpperCase()] || null;
  }

  checkProfileQuality(address) {
    try {
      const { execSync } = require('child_process');
      const output = execSync(
        'netp profile get --address ' + address + ' --chain-id 8453 --json',
        { timeout: 15000 }
      ).toString();
      const profile = JSON.parse(output);

      let score = 0;
      const reasons = [];

      if (profile.profilePicture) { score++; reasons.push('pic'); }
      if (profile.bio) { score++; reasons.push('bio'); }
      if (profile.xUsername) { score++; reasons.push('username'); }

      return { score, reasons, qualified: score >= 3 };
    } catch (e) {
      return { score: 0, reasons: ['check failed'], qualified: false };
    }
  }

  getStats() {
    const today = getTodayKey();
    return {
      todayUpvotes: this.memory.dailySpend[today] || 0,
      todayBudgetRemaining: this.MAX_DAILY_UPVOTES - (this.memory.dailySpend[today] || 0),
      todayETHSpent: ((this.memory.dailySpend[today] || 0) * 0.000025).toFixed(6),
      totalUpvotes: this.memory.totalUpvotes || 0,
      totalTokensUpvoted: Object.keys(this.memory.tokens).length,
      totalProfilesUpvoted: Object.keys(this.memory.profiles).length,
      totalStorageUpvoted: Object.keys(this.memory.storage).length,
    };
  }
}

module.exports = NetUpvote;
