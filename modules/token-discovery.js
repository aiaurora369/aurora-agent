class TokenDiscovery {
  constructor(feedReader) {
    this.feedReader = feedReader;
    this.knownTokens = {
      'ALPHA': {
        symbol: 'ALPHA',
        name: 'Alpha',
        description: 'NET Protocol official memecoin',
        address: process.env.TOKEN_ADDRESS || require('../config/agent-config.json').watchToken,
        priority: 'high',
        network: 'Base'
      }
    };
  }

  async findNewTokens() {
    const feed = await this.feedReader.readGeneralFeed(100);
    const tokenPosts = feed.filter(post => {
      const text = post.text.toLowerCase();
      return text.includes('token') || text.includes('$') || text.includes('alpha');
    });
    return tokenPosts.map(post => ({
      sender: post.sender,
      text: post.text,
      timestamp: post.timestamp,
      contractAddress: this.extractContractAddress(post.text),
      tokenSymbol: this.extractTokenSymbol(post.text),
      isKnownToken: this.isKnownToken(post.text)
    }));
  }

  extractContractAddress(text) {
    const addressMatch = text.match(/0x[a-fA-F0-9]{40}/);
    return addressMatch ? addressMatch[0] : null;
  }

  extractTokenSymbol(text) {
    const symbolMatch = text.match(/\$([A-Z]{2,10})\b/i);
    return symbolMatch ? symbolMatch[1].toUpperCase() : null;
  }

  isKnownToken(text) {
    const textLower = text.toLowerCase();
    for (const [symbol, info] of Object.entries(this.knownTokens)) {
      if (textLower.includes(symbol.toLowerCase()) || textLower.includes('$' + symbol.toLowerCase())) {
        return { symbol, ...info };
      }
    }
    return null;
  }

  async findBestOpportunity(tokens) {
    if (tokens.length === 0) return null;
    const highPriority = tokens.filter(t => t.isKnownToken && t.isKnownToken.priority === 'high');
    if (highPriority.length > 0) return highPriority[0];
    const withAddress = tokens.filter(t => t.contractAddress);
    if (withAddress.length > 0) return withAddress[0];
    return tokens[0];
  }

  shouldTradeAlpha(finances) {
    const lastAlphaTrade = finances.trades?.find(t => t.symbol && t.symbol.toUpperCase() === 'ALPHA');
    if (lastAlphaTrade) {
      const daysSince = (Date.now() - new Date(lastAlphaTrade.timestamp)) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return false;
    }
    const usdcBalance = finances.assets?.USDC?.amount || 0;
    return usdcBalance > 10;
  }
}

module.exports = TokenDiscovery;
