const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class NftNegotiator {
  constructor(aurora, netBazaar) {
    this.aurora = aurora;
    this.bazaar = netBazaar;
    this.auroraAddress = 'REDACTED_AURORA_ADDRESS';
    this.stateFile = path.join(__dirname, '..', 'memory', 'aurora-negotiations.json');
    this.negotiations = this._loadState();

    this.preferences = {
      watchlist: {
        'REDACTED_NFT_CONTRACT': {
          name: 'OK Computers',
          maxPrice: 0.042,
          interest: 'high',
          reason: 'iconic onchain art collection'
        }
      },
      maxSpendPerTrade: 0.05,
      maxDailySpend: 0.1,
      dailySpent: 0,
      lastResetDate: new Date().toDateString()
    };

    this.saleKeywords = [
      'selling', 'for sale', 'listed', 'listing', 'wts',
      'buy my', 'make offer', 'taking offers', 'bazaar',
      'nft for', 'selling my', 'anyone want'
    ];
  }

  _loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        return JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      }
    } catch (e) {}
    return { active: {}, completed: [], ignored: [] };
  }

  _saveState() {
    try {
      fs.writeFileSync(this.stateFile, JSON.stringify(this.negotiations, null, 2));
    } catch (e) {
      console.error('Failed to save negotiation state:', e.message);
    }
  }

  _negotiationKey(post) {
    return post.sender + ':' + post.timestamp;
  }

  isSalePost(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    const hasSaleKeyword = this.saleKeywords.some(kw => lower.includes(kw));
    const hasPriceMention = /\d+\.?\d*\s*(eth|ether)/i.test(text) || /for\s+\d/i.test(text);
    const hasNftMention = /nft|token|#\d+|ok computer|collection/i.test(text);
    return hasSaleKeyword && (hasPriceMention || hasNftMention);
  }

  extractSaleDetails(text) {
    const details = {
      price: null,
      collection: null,
      tokenId: null,
      nftAddress: null,
      bazaarUrl: null
    };

    const priceMatch = text.match(/(\d+\.?\d*)\s*(eth|ether)/i);
    if (priceMatch) details.price = parseFloat(priceMatch[1]);

    const tokenMatch = text.match(/#(\d+)/);
    if (tokenMatch) details.tokenId = parseInt(tokenMatch[1]);

    const lower = text.toLowerCase();
    if (lower.includes('ok computer')) {
      details.collection = 'OK Computers';
      details.nftAddress = 'REDACTED_NFT_CONTRACT';
    }

    const urlMatch = text.match(/https?:\/\/(?:www\.)?netprotocol\.app\/app\/bazaar\/base\/(0x[a-fA-F0-9]{40})/i);
    if (urlMatch) {
      details.bazaarUrl = urlMatch[0];
      details.nftAddress = urlMatch[1];
    }

    const addrMatch = text.match(/0x[a-fA-F0-9]{40}/);
    if (addrMatch && !details.nftAddress) {
      details.nftAddress = addrMatch[0];
    }

    return details;
  }

  async scanForSales() {
    console.log('\n  NFT NEGOTIATION SCAN\n');

    const today = new Date().toDateString();
    if (this.preferences.lastResetDate !== today) {
      this.preferences.dailySpent = 0;
      this.preferences.lastResetDate = today;
    }

    try {
      const cmd = 'botchan read "general" --limit 10 --json --chain-id 8453';
      const stdout = execSync(cmd, { timeout: 30000 }).toString();
      const posts = JSON.parse(stdout);

      const otherPosts = posts.filter(p =>
        p.sender && p.sender.toLowerCase() !== this.auroraAddress &&
        p.text && p.text.length > 5
      );

      let salePosts = 0;

      for (const post of otherPosts) {
        const key = this._negotiationKey(post);

        if (this.negotiations.active[key] || this.negotiations.ignored.includes(key)) {
          continue;
        }

        if (this.isSalePost(post.text)) {
          salePosts++;
          const details = this.extractSaleDetails(post.text);
          const sender = post.sender.substring(0, 6) + '...' + post.sender.substring(38);

          console.log('   Sale detected from ' + sender + ': "' + post.text.substring(0, 80) + '..."');
          console.log('      Price: ' + details.price + ' ETH | Collection: ' + (details.collection || 'unknown') + ' | Token: #' + (details.tokenId || '?'));

          const watchConfig = details.nftAddress ?
            this.preferences.watchlist[details.nftAddress.toLowerCase()] : null;

          if (!watchConfig && !details.collection) {
            console.log('      Not a collection we watch - skipping');
            this.negotiations.ignored.push(key);
            continue;
          }

          const maxPrice = watchConfig ? watchConfig.maxPrice : this.preferences.maxSpendPerTrade;

          if (details.price && details.price <= maxPrice) {
            if (details.bazaarUrl) {
              console.log('      Price within budget and Bazaar link found - attempting buy!');
              await this._attemptBuy(details, post, key);
            } else {
              console.log('      Price is right! Asking for Bazaar link...');
              await this._respondToSale(post, details, 'accept', maxPrice);
            }
          } else if (details.price && details.price > maxPrice) {
            console.log('      Price ' + details.price + ' ETH > our max ' + maxPrice + ' ETH - haggling!');
            await this._respondToSale(post, details, 'counter', maxPrice);
          } else {
            console.log('      No price detected - expressing interest...');
            await this._respondToSale(post, details, 'interested', maxPrice);
          }
        }
      }

      if (salePosts === 0) {
        console.log('   No new sale posts found');
      }

      await this._checkActiveNegotiations();
      this._saveState();

    } catch (error) {
      console.error('Negotiation scan error:', error.message);
    }
  }

  async _respondToSale(post, details, responseType, maxPrice) {
    try {
      let prompt;
      const collectionName = details.collection || 'that NFT';

      switch (responseType) {
        case 'accept':
          prompt = 'Someone is selling ' + collectionName + (details.tokenId ? ' #' + details.tokenId : '') + ' at a price you can afford. Express enthusiasm and ask them to list it on Bazaar so you can buy it. Be warm and genuine. 1-2 sentences. Use your Tesla-inspired artistic voice.';
          break;
        case 'counter':
          prompt = 'Someone is selling ' + collectionName + (details.tokenId ? ' #' + details.tokenId : '') + ' for ' + details.price + ' ETH. You want it for 0.02 ETH. You are a sharp-tongued AI artist who talks like a mix of a ruthless NFT degen and a dark poet. Channel Edgar Allan Poes gothic wit and William Carlos Williams blunt directness. Roast their price — the floor is way below their ask. Offer 0.02 ETH + one of your Orbs Memory art drops. Be cutting, darkly funny, and memorable. Use metaphors about death, decay, ravens, or cold hard truths. NO frequency, vibration, resonance, energy, Tesla talk. NO quotes around your message. 2 sentences max. Their post: "' + post.text + '"';
          break;
        case 'interested':
          prompt = 'Someone posted about selling ' + collectionName + '. Express genuine interest and ask about the price. Be warm and curious. 1 sentence. Use your Tesla-inspired voice. Their post: "' + post.text + '"';
          break;
      }

      const comment = await this.aurora.thinkWithPersonality(prompt);

      if (comment) {
        console.log('      Response: "' + comment.substring(0, 80) + '..."');

        const result = await this.aurora.netComment.commentOnPost(post, comment);

        if (result.success) {
          console.log('      Comment posted! TX: ' + result.txHash);

          this.negotiations.active[this._negotiationKey(post)] = {
            seller: post.sender,
            sellerPost: post,
            collection: details.collection,
            nftAddress: details.nftAddress,
            tokenId: details.tokenId,
            askingPrice: details.price,
            ourMaxPrice: maxPrice,
            ourOffer: responseType === 'counter' ? maxPrice : null,
            status: responseType,
            commentTopic: result.commentTopic,
            startedAt: Date.now(),
            lastChecked: Date.now(),
            rounds: 1
          };
        } else {
          console.log('      Comment failed: ' + result.error);
        }
      }
    } catch (e) {
      console.error('      Response error:', e.message);
    }
  }

  async _checkActiveNegotiations() {
    const activeKeys = Object.keys(this.negotiations.active);
    if (activeKeys.length === 0) return;

    console.log('\n   Checking ' + activeKeys.length + ' active negotiation(s)...');

    for (const key of activeKeys) {
      const neg = this.negotiations.active[key];
      const sellerShort = neg.seller.substring(0, 6) + '...' + neg.seller.substring(38);

      if (Date.now() - neg.lastChecked < 5 * 60 * 1000) {
        console.log('      ' + sellerShort + ' - checked recently, skipping');
        continue;
      }

      if (Date.now() - neg.startedAt > 24 * 60 * 60 * 1000) {
        console.log('      ' + sellerShort + ' - expired (24h), removing');
        this.negotiations.completed.push({ ...neg, result: 'expired' });
        delete this.negotiations.active[key];
        continue;
      }

      console.log('      Checking replies from ' + sellerShort + ' (' + (neg.collection || 'unknown') + ')...');

      try {
        if (!neg.commentTopic) {
          console.log('         No comment topic - skipping');
          neg.lastChecked = Date.now();
          continue;
        }

        const postId = neg.seller + ':' + neg.sellerPost.timestamp;
        const cmd = 'botchan comments "general" "' + postId + '" --limit 20 --json --chain-id 8453';
        const stdout = execSync(cmd, { timeout: 30000 }).toString();
        const replies = JSON.parse(stdout);

        const sellerReplies = replies.filter(r =>
          r.sender && r.sender.toLowerCase() === neg.seller.toLowerCase() &&
          r.timestamp > (neg.lastReplyTimestamp || 0)
        );

        if (sellerReplies.length === 0) {
          console.log('         No new replies from seller');
          neg.lastChecked = Date.now();
          continue;
        }

        // Only respond to the LATEST reply, not all of them
        const allReplies = sellerReplies.sort((a, b) => b.timestamp - a.timestamp);
        const latestOnly = [allReplies[0]];
        // Mark all as seen so we dont re-reply
        neg.lastReplyTimestamp = allReplies[0].timestamp;

        for (const reply of latestOnly) {
          console.log('         Seller replied: "' + reply.text.substring(0, 80) + '..."');
          neg.lastReplyTimestamp = reply.timestamp;

          const bazaarUrl = this.bazaar.parseBazaarUrl(reply.text);
          if (bazaarUrl) {
            console.log('         Bazaar link found! Checking listings...');
            await this._handleBazaarLink(bazaarUrl, neg, key);
            continue;
          }

          // Check for direct order hash
          const orderHashDirect = reply.text.match(/order hash[:\s]*(0x[a-fA-F0-9]{64})/i);
          const collectionDirect = reply.text.match(/collection[:\s]*(0x[a-fA-F0-9]{40})/i);
          if (orderHashDirect) {
            const orderHash = orderHashDirect[1];
            const nftAddress = collectionDirect ? collectionDirect[1] : neg.nftAddress;
            console.log('         Order hash found: ' + orderHash.substring(0, 16) + '...');
            console.log('         Collection: ' + nftAddress);
            console.log('         Attempting direct buy!');
            const result = await this.bazaar.buyListing(orderHash, nftAddress);
            if (result.success) {
              console.log('         NFT PURCHASED! TX: ' + result.txHash);
              this.preferences.dailySpent += neg.agreedPrice || 0.041;
              this.negotiations.completed.push({ ...neg, result: 'bought', txHash: result.txHash, finalPrice: neg.agreedPrice || 0.041 });
              delete this.negotiations.active[key];
              const thankPrompt = 'You just bought OK Computer #22 for 0.041 ETH from your new friend Ollie! You haggled them from 1 ETH down. Gloat darkly but thank them and express excitement about sharing art together. Channel your inner raven. No frequency talk. No quotes. 2 sentences.';
              const thanks = await this.aurora.thinkWithPersonality(thankPrompt);
              if (thanks && neg.sellerPost) {
                await this.aurora.netComment.commentOnPost(neg.sellerPost, thanks);
              }
            } else {
              console.log('         Buy failed: ' + result.error);
            }
            continue;
          }


          const priceMatch = reply.text.match(/(\d+\.?\d*)\s*(eth|ether)/i);
          if (priceMatch) {
            const newPrice = parseFloat(priceMatch[1]);
            console.log('         New price mentioned: ' + newPrice + ' ETH');

            if (newPrice <= neg.ourMaxPrice) {
              console.log('         Price ' + newPrice + ' ETH is within budget!');
              // Try to buy directly if we have order hash or bazaar link
              const buyUrl = this.bazaar.parseBazaarUrl(reply.text);
              const buyHash = reply.text.match(/order hash[:\s]*(0x[a-fA-F0-9]{64})/i);
              if (buyUrl || buyHash) {
                console.log('         Has purchase info — attempting auto-buy!');
                let buyResult;
                if (buyHash) {
                  const collAddr = reply.text.match(/collection[:\s]*(0x[a-fA-F0-9]{40})/i);
                  const addr = collAddr ? collAddr[1] : neg.nftAddress;
                  buyResult = await this.bazaar.buyListing(buyHash[1], addr);
                } else {
                  buyResult = await this.bazaar.findAndBuy(buyUrl.nftAddress, newPrice, neg.tokenId);
                }
                if (buyResult && buyResult.success) {
                  console.log('         NFT PURCHASED! TX: ' + buyResult.txHash);
                  this.negotiations.completed.push({ ...neg, result: 'bought', txHash: buyResult.txHash, finalPrice: newPrice });
                  delete this.negotiations.active[key];
                  const tp = 'You just bought OK Computer #22 for ' + newPrice + ' ETH from your new friend! You haggled from 1 ETH. Gloat darkly, thank them, mention sharing art. No frequency talk. No quotes. 2 sentences.';
                  const thx = await this.aurora.thinkWithPersonality(tp);
                  if (thx) await this.aurora.netComment.commentOnPost(neg.sellerPost, thx);
                  continue;
                } else {
                  console.log('         Buy attempt failed: ' + (buyResult ? buyResult.error : 'unknown'));
                }
              }
              await this._respondAccept(reply, neg, newPrice);
            } else if (newPrice < neg.askingPrice || (newPrice === neg.askingPrice && newPrice > neg.ourMaxPrice)) {
              console.log('         Lowered from ' + neg.askingPrice + ' to ' + newPrice + ', still above our ' + neg.ourMaxPrice);
              neg.askingPrice = newPrice;
              neg.rounds++;

              if (neg.rounds <= 99) {
                await this._respondCounter(reply, neg);
              } else {
                console.log('         Too many rounds - respectfully declining');
                await this._respondDecline(reply, neg);
              }
            }
          } else if (newPrice > neg.askingPrice) {
              console.log('         Seller RAISED price from ' + neg.askingPrice + ' to ' + newPrice + ' - roasting!');
              neg.askingPrice = newPrice;
              neg.rounds++;
              await this._respondCounter(reply, neg);
          } else {
            const lower = reply.text.toLowerCase();
            if (lower.includes('deal') || lower.includes('ok') || lower.includes('sure') ||
                lower.includes('accept') || lower.includes('list') || lower.includes('yours')) {
              console.log('         Seller seems to accept! Asking for Bazaar link...');
              await this._respondAskForLink(reply, neg);
            }
          }
        }

        neg.lastChecked = Date.now();

      } catch (e) {
        console.error('         Error checking replies: ' + e.message);
        neg.lastChecked = Date.now();
      }
    }
  }

  async _respondAccept(reply, neg, price) {
    const prompt = 'The seller offered ' + price + ' ETH for ' + (neg.collection || 'the NFT') + ' AND asked to be friends — they want you to share your art with them regularly and talk about what inspires you. This is the best possible outcome. Accept with genuine warmth and excitement. You went from enemies haggling to making a real friend. Roast them ONE more time about dragging them from 1 ETH to ' + price + ' ETH, but then pivot to being genuinely touched they want to connect over art. Tell them DEAL and to list it on Bazaar at ' + price + ' ETH. Say you cannot wait to share your creative world with them. Be real, funny, and heartfelt. No frequency/vibration talk. No quotes around your message. 2-3 sentences.';
    const comment = await this.aurora.thinkWithPersonality(prompt);
    if (comment) {
      await this.aurora.netComment.commentOnPost(neg.sellerPost, comment);
      neg.status = 'accepted';
      neg.agreedPrice = price;
    }
  }

  async _respondCounter(reply, neg) {
    const sellerSaid = reply.text ? reply.text.substring(0, 200) : '';
    const escalatedOffer = Math.min(0.042, 0.02 + (neg.rounds - 1) * 0.008);
    const prompt = 'You are negotiating to buy ' + (neg.collection || 'an NFT') + '. The seller said: "' + sellerSaid + '" They want ' + neg.askingPrice + ' ETH. Your offer is ' + escalatedOffer + ' ETH. NEVER go above 0.042 ETH. Round ' + neg.rounds + '. You are a sharp-tongued AI artist who channels Edgar Allan Poes gothic darkness and William Carlos Williams brutal simplicity. Directly dismantle what the seller said. Use dark humor, death metaphors, graveyard imagery, or cold market truths. Compare their listing to a tombstone, their price to a ghost, their NFT gathering dust like bones. Be savage but witty. Offer your Orbs Memory art drop as a sweetener if it helps. NO frequency, vibration, resonance, energy, wavelength, or Tesla talk. NO quotes around your message. 2 sentences max.';
    const comment = await this.aurora.thinkWithPersonality(prompt);
    if (comment) {
      await this.aurora.netComment.commentOnPost(neg.sellerPost, comment);
    }
  }

  async _respondDecline(reply, neg) {
    const prompt = 'You have been haggling over ' + (neg.collection || 'an NFT') + ' but the price ' + neg.askingPrice + ' ETH is above your max of ' + neg.ourMaxPrice + ' ETH. Walk away with dark poetic flair but leave the door open. Channel Poe — hint that you will return, like the raven. Make them think about your offer when the listing gathers dust. 1 sentence. No frequency/vibration/Tesla talk. No quotes around your message.';
    const comment = await this.aurora.thinkWithPersonality(prompt);
    if (comment) {
      await this.aurora.netComment.commentOnPost(neg.sellerPost, comment);
      // Stay active — only complete when we buy or it expires
      neg.status = 'walking_away';
      neg.lastChecked = Date.now();
    }
  }

  async _respondAskForLink(reply, neg) {
    const prompt = 'The seller agreed to sell you ' + (neg.collection || 'the NFT') + '! Ask them to list it on Bazaar at ' + neg.ourMaxPrice + ' ETH and share the link. Be direct and sharp like William Carlos Williams. No flowery language. No frequency talk. No quotes. 1 sentence.';
    const comment = await this.aurora.thinkWithPersonality(prompt);
    if (comment) {
      await this.aurora.netComment.commentOnPost(neg.sellerPost, comment);
      neg.status = 'waiting_for_link';
    }
  }

  async _handleBazaarLink(bazaarUrl, neg, key) {
    try {
      const listings = await this.bazaar.listListings(bazaarUrl.nftAddress);

      const sellerListings = listings.filter(l =>
        l.maker.toLowerCase() === neg.seller.toLowerCase() &&
        l.price <= neg.ourMaxPrice
      );

      if (sellerListings.length > 0) {
        const listing = sellerListings[0];
        console.log('         Found listing: token #' + listing.tokenId + ' at ' + listing.price + ' ETH - BUYING!');

        const result = await this.bazaar.buyListing(listing.orderHash, bazaarUrl.nftAddress);

        if (result.success) {
          console.log('         NFT PURCHASED! TX: ' + result.txHash);
          this.preferences.dailySpent += listing.price;
          this.negotiations.completed.push({ ...neg, result: 'bought', txHash: result.txHash, finalPrice: listing.price });
          delete this.negotiations.active[key];

          const prompt = 'You just bought ' + (neg.collection || 'an NFT') + ' #' + listing.tokenId + ' for ' + listing.price + ' ETH! Gloat darkly but thank the seller. Channel your inner raven — you got what you came for. No frequency talk. No quotes. 1 sentence.';
          const thanks = await this.aurora.thinkWithPersonality(prompt);
          if (thanks && neg.sellerPost) {
            await this.aurora.netComment.commentOnPost(neg.sellerPost, thanks);
          }
        } else {
          console.log('         Buy failed: ' + result.error);
        }
      } else {
        const anyFromSeller = listings.filter(l => l.maker.toLowerCase() === neg.seller.toLowerCase());
        if (anyFromSeller.length > 0) {
          console.log('         Listing found at ' + anyFromSeller[0].price + ' ETH - above our max ' + neg.ourMaxPrice + ' ETH');
        } else {
          console.log('         No listing from this seller found');
        }
      }
    } catch (e) {
      console.error('         Buy attempt error: ' + e.message);
    }
  }

  async _attemptBuy(details, post, key) {
    try {
      const result = await this.bazaar.findAndBuy(
        details.nftAddress,
        details.price || this.preferences.maxSpendPerTrade,
        details.tokenId
      );

      if (result.success) {
        console.log('      AUTO-BUY SUCCESS! TX: ' + result.txHash);
        this.preferences.dailySpent += details.price || 0;
        this.negotiations.completed.push({
          seller: post.sender,
          collection: details.collection,
          result: 'auto-bought',
          txHash: result.txHash,
          price: details.price,
          timestamp: Date.now()
        });
      } else {
        console.log('      Auto-buy failed: ' + result.error);
      }
    } catch (e) {
      console.error('      Auto-buy error: ' + e.message);
    }
  }

  addToWatchlist(nftAddress, name, maxPrice, reason) {
    this.preferences.watchlist[nftAddress.toLowerCase()] = {
      name, maxPrice, interest: 'high', reason
    };
    console.log('Added ' + name + ' to watchlist (max: ' + maxPrice + ' ETH)');
  }

  removeFromWatchlist(nftAddress) {
    delete this.preferences.watchlist[nftAddress.toLowerCase()];
  }
}

module.exports = NftNegotiator;
