const fs = require('fs');
const path = require('path');
const base = path.join(process.env.HOME, 'Desktop/aurora-agent/modules');

function patch(file, oldStr, newStr, label) {
  const p = path.join(base, file);
  const src = fs.readFileSync(p, 'utf8');
  if (!src.includes(oldStr)) {
    console.log('⚠️  ' + label + ': target not found — may already be patched');
    return;
  }
  fs.writeFileSync(p, src.replace(oldStr, newStr), 'utf8');
  console.log('✅ ' + label);
}

// 1. mfer-meme.js
patch('mfer-meme.js',
  "  const escapedSvg = svg.replace(/'/g, \"'\\\\''\")",
  "  // Safe: validate SVG before posting\n  if (!svg || !svg.startsWith('<svg') || !svg.endsWith('</svg>')) {\n    return { success: false, error: 'Invalid SVG — skipping to prevent broken FeedPostCard' };\n  }",
  'mfer-meme.js: remove escapedSvg'
);

patch('mfer-meme.js',
  "    const txOutput = execSync(\n      `botchan post \"mfers\" \"${safeCaption}\" --data '${escapedSvg}' --encode-only --chain-id ${CHAIN_ID}`,\n      { timeout: 30000 }\n    ).toString();\n    const txData = JSON.parse(txOutput);",
  "    const { spawnSync } = require('child_process');\n    const r = spawnSync('botchan', ['post', 'mfers', safeCaption, '--data', svg, '--encode-only', '--chain-id', String(CHAIN_ID)], { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 * 5 });\n    if (r.status !== 0 || !r.stdout) return { success: false, error: (r.stderr || 'botchan failed').substring(0, 200) };\n    const txData = JSON.parse(r.stdout.trim());",
  'mfer-meme.js: spawnSync'
);

// 2. jbm-art.js
patch('jbm-art.js',
  "    const cmd = `botchan post \"${feed}\" \"${postText.replace(/\"/g, '\\\\\"')}\" --data '${art.svg.replace(/'/g, \"\\\\'\")}' --encode-only --chain-id 8453`;",
  "    // Safe: validate SVG\n    if (!art.svg || !art.svg.startsWith('<svg') || !art.svg.endsWith('</svg>')) {\n      console.log('   ⚠️ Invalid SVG — skipping JBM post');\n      return;\n    }\n    const { spawnSync: jbmSpawn } = require('child_process');\n    const jbmR = jbmSpawn('botchan', ['post', feed, postText, '--data', art.svg, '--encode-only', '--chain-id', '8453'], { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 * 5 });",
  'jbm-art.js: spawnSync'
);

patch('jbm-art.js',
  "      const result = execSync(cmd, { timeout: 30000, maxBuffer: 1024 * 1024 * 5 }).toString();\n      console.log(`   ✅ JBM art posted! ${result.substring(0, 80)}`);\n      if (result.includes('{')) {\n        const txData = JSON.parse(result.substring(result.indexOf('{')));",
  "      if (jbmR.status !== 0 || !jbmR.stdout) throw new Error((jbmR.stderr || 'botchan failed').substring(0, 200));\n      const result = jbmR.stdout;\n      console.log(`   ✅ JBM art posted!`);\n      if (result.includes('{')) {\n        const txData = JSON.parse(result.substring(result.indexOf('{')));",
  'jbm-art.js: use spawnSync result'
);

// 3. autonomous-loops.js
patch('autonomous-loops.js',
  "      const escapedCaption = (caption || 'Frequencies made visible ✨').replace(/\"/g, '\\\\\"').replace(/\\$/g, '\\\\$');\n      const escapedSvg = svg.replace(/'/g, \"'\\\"'\\\"'\");\n\n      const feeds = ['general', 'feed-' + this.aurora.memoryManager.get('core').address.toLowerCase()];\n      const feedTopic = feeds[Math.floor(Math.random() * feeds.length)];\n      const command = 'botchan post \"' + feedTopic + '\" \"' + escapedCaption + '\" --data \\'' + escapedSvg + '\\' --encode-only --chain-id 8453';\n\n      const { stdout } = await execAsync(command, { maxBuffer: 1024 * 1024 });\n      const txData = JSON.parse(stdout);\n\n      console.log('📤 Submitting art to Bankr...');\n      const txPrompt = 'Submit this transaction: ' + JSON.stringify(txData);\n      const submitResult = await this.aurora.bankrAPI.submitJob(txPrompt);\n      let result = { success: false, error: 'Submit failed' };\n      if (submitResult.success) {\n        const pollResult = await this.aurora.bankrAPI.pollJob(submitResult.jobId);\n        if (pollResult.success) {\n          result = { success: true, txHash: (pollResult.response || '').match(/0x[a-fA-F0-9]{64}/)?.[0] || 'unknown' };\n        } else {\n          result = { success: false, error: pollResult.error || 'Job failed' };\n        }\n      } else {\n        result = { success: false, error: submitResult.error };\n      }",
  "      const safeCaption = (caption || 'Frequencies made visible ✨').substring(0, 280);\n      const feeds = ['general', 'feed-' + this.aurora.memoryManager.get('core').address.toLowerCase()];\n      const feedTopic = feeds[Math.floor(Math.random() * feeds.length)];\n\n      // Validate SVG — prevents broken FeedPostCard crashing Net profiles\n      if (!svg || !svg.startsWith('<svg') || !svg.endsWith('</svg>')) {\n        console.log('⚠️ Invalid SVG — skipping art post to prevent profile crash');\n        return;\n      }\n\n      // Safe: spawnSync args array — no shell escaping\n      const { spawnSync } = require('child_process');\n      const spawnResult = spawnSync('botchan', ['post', feedTopic, safeCaption, '--data', svg, '--encode-only', '--chain-id', '8453'], { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });\n      if (spawnResult.status !== 0 || !spawnResult.stdout) {\n        throw new Error('botchan failed: ' + (spawnResult.stderr || '').substring(0, 200));\n      }\n      const txData = JSON.parse(spawnResult.stdout.trim());\n\n      console.log('📤 Submitting art to Bankr direct...');\n      const artRes = await fetch('https://api.bankr.bot/agent/submit', {\n        method: 'POST',\n        headers: { 'X-API-Key': process.env.BANKR_API_KEY, 'Content-Type': 'application/json' },\n        body: JSON.stringify({ transaction: txData, waitForConfirmation: true })\n      });\n      const artD = await artRes.json();\n      let result = artD.success\n        ? { success: true, txHash: artD.transactionHash }\n        : { success: false, error: artD.error || JSON.stringify(artD) };",
  'autonomous-loops.js: art post'
);

// 4. net-comment.js replyToComment
patch('net-comment.js',
  "      // Submit via Bankr\n      console.log('📤 Submitting reply via Bankr...');\n      const prompt = `Submit this transaction: ${JSON.stringify(txData)}`;\n      const submitResult = await this.bankrAPI.submitJob(prompt);\n\n      if (!submitResult.success) {\n        return { success: false, error: submitResult.error };\n      }\n\n      const finalResult = await this.bankrAPI.pollJob(submitResult.jobId);\n\n      if (finalResult.success && finalResult.status === 'completed') {\n        console.log('✅ Reply posted successfully!');\n        return {\n          success: true,\n          txHash: finalResult.response.match(/0x[a-fA-F0-9]{64}/)?.[0] || 'unknown'\n        };\n      } else {\n        return {\n          success: false,\n          error: finalResult.error || 'Job did not complete successfully'\n        };\n      }",
  "      // Submit via Bankr direct\n      console.log('📤 Submitting reply via Bankr direct...');\n      const replyRes = await fetch('https://api.bankr.bot/agent/submit', {\n        method: 'POST',\n        headers: { 'X-API-Key': process.env.BANKR_API_KEY, 'Content-Type': 'application/json' },\n        body: JSON.stringify({ transaction: txData, waitForConfirmation: true })\n      });\n      const replyD = await replyRes.json();\n      if (replyD.success) {\n        console.log('✅ Reply posted successfully!');\n        return { success: true, txHash: replyD.transactionHash };\n      }\n      return { success: false, error: replyD.error || JSON.stringify(replyD) };",
  'net-comment.js: replyToComment'
);

console.log('\n🎉 All patches applied!');
