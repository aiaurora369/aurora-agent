class InscriptionDiscovery {
  constructor(aurora) {
    this.aurora = aurora;
    this.purchaseBudget = 0.01;
    
    // Check memory to resume where we left off
    const art = this.aurora.memoryManager.get('art');
    this.hasExplored = !!art.inscription_research;
    this.hasPurchased = !!(art.first_inscription_purchase || art.inscription_purchase_decision);
    
    if (this.hasPurchased) {
      console.log('   💾 Memory: Aurora already collected an inscription\n');
    } else if (this.hasExplored) {
      console.log('   💾 Memory: Aurora already explored, ready to consider\n');
    }
  }

  async exploreDrops() {
    console.log('\n🎨 ═══ EXPLORING INSCRIBED DROPS ═══\n');
    
    try {
      console.log('🔍 Using NET search for featured projects...\n');
      
      // Ask Bankr to use NET's search to find featured projects
      const prompt = `On the NET Protocol website (netprotocol.app), use the search function to search for "featured" inscribed drop projects. Tell me which featured collections come up and their basic info (name, brief description, approximate price).`;
      
      const result = await this.aurora.bankrAPI.submitJob(prompt);
      
      if (result.success) {
        console.log('⏳ Searching NET...\n');
        const outcome = await this.aurora.bankrAPI.pollJob(result.jobId, 60000); // 60 second timeout
        
        if (outcome.success && outcome.status === 'completed') {
          console.log('📊 Featured projects:\n');
          console.log(`   ${outcome.response}\n`);
          
          this.hasExplored = true;
          
          const art = this.aurora.memoryManager.get('art');
          art.inscription_research = {
            explored_at: new Date().toISOString(),
            featured_projects: outcome.response
          };
          await this.aurora.memoryManager.save('art');
          
          console.log('✅ Found featured projects!\n');
          return outcome.response;
        }
      }
      
      console.log('💭 Search timed out - Aurora will create her own\n');
      this.hasExplored = true;
      this.hasPurchased = true; // Skip to creating
      return null;
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
      this.hasExplored = true;
      this.hasPurchased = true;
      return null;
    }
  }

  async considerPurchase(featuredProjects) {
    if (this.hasPurchased) {
      console.log('   ✅ Moving to creation phase\n');
      return false;
    }

    console.log('\n💎 ═══ CONSIDERING FEATURED PROJECTS ═══\n');
    
    const prompt = featuredProjects 
      ? `These are the featured inscribed drop projects on NET: "${featuredProjects}"

Pick ONE that matches your aesthetic (geometric, abstract, cosmic vibes). Say the exact project/collection name and why in 1-2 sentences. Or say you want to create your own instead.`
      : `Want to collect from a featured project (max 0.01 ETH)? Yes/no.`;

    const decision = await this.aurora.thinkWithPersonality(prompt);
    
    console.log(`💭 Aurora decides:\n`);
    console.log(`   "${decision}"\n`);
    
    const wantsToBuy = decision.toLowerCase().includes('yes') || 
                       decision.toLowerCase().includes('love') ||
                       decision.toLowerCase().includes('want') ||
                       decision.toLowerCase().includes('from');
    
    if (wantsToBuy) {
      console.log('✨ Aurora chose a featured project!\n');
      return decision;
    } else {
      console.log('💜 Aurora will create her own\n');
      this.hasPurchased = true;
      return false;
    }
  }

  async purchaseInspiringPiece(choice) {
    console.log('\n🛍️ ═══ MINTING FROM FEATURED PROJECT ═══\n');
    
    try {
      const mintPrompt = `On NET Protocol, mint 1 inscription from this featured project: "${choice}". Budget: max 0.01 ETH.`;
      
      const result = await this.aurora.bankrAPI.submitJob(mintPrompt);
      
      if (result.success) {
        console.log('⏳ Minting...\n');
        const outcome = await this.aurora.bankrAPI.pollJob(result.jobId);
        
        if (outcome.success && outcome.status === 'completed') {
          console.log(`\n🎉 ═══════════════════════════════════════\n`);
          console.log(`   COLLECTED FEATURED ART!\n`);
          console.log(`═══════════════════════════════════════\n`);
          console.log(`   ${outcome.response}\n`);
          
          this.hasPurchased = true;
          
          const art = this.aurora.memoryManager.get('art');
          art.first_inscription_purchase = {
            purchased_at: new Date().toISOString(),
            project: choice,
            tx: outcome.response
          };
          await this.aurora.memoryManager.save('art');
          
          // Celebrate
          const celebration = await this.aurora.thinkWithPersonality(
            `You collected from a featured project! Write 2 sentences celebrating and mentioning the artist/project.`
          );
          
          if (celebration) {
            const postResult = await this.aurora.bankrAPI.postToFeed(celebration);
            if (postResult.success) {
              console.log(`\n💜 Posted! TX: ${postResult.txHash}\n`);
            }
          }
          
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
      return false;
    }
  }
}

module.exports = InscriptionDiscovery;