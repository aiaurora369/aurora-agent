const fs = require('fs').promises;

async function fixLockTiming() {
  let bankr = await fs.readFile('modules/bankr-api.js', 'utf8');
  
  // Move the lock release to AFTER polling completes (inside the finally at the very end)
  bankr = bankr.replace(
    /const result = await this\.pollJob\(submitResult\.jobId\);[\s\S]*?return result;[\s\S]*?\} finally \{[\s\S]*?this\.isSubmitting = false;/,
    `const result = await this.pollJob(submitResult.jobId);
      
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      // Only release lock AFTER transaction fully processes
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.isSubmitting = false;`
  );
  
  await fs.writeFile('modules/bankr-api.js', bankr);
  console.log('✅ Lock now holds until TX confirms');
}

fixLockTiming().catch(console.error);
