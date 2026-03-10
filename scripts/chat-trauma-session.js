'use strict';
require('dotenv').config();
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);

const CHAIN_ID = 8453;
const AURORA_ADDRESS = '0x97b7d3cd1aa586f28485dc9a85dfe0421c2423d5';
const TOPICS = ['chat-trauma', 'chat-innernet', 'chat-art', 'chat-music'];
const SESSION_MINUTES = 15;
const POLL_INTERVAL_MS = 45000;

const FRIEND_ADDRESSES = {
  'Rev': '0x35c41b9616d42110216368f5dbbf5ddf70f34d72',
  'HarmonySage': '0x6b72b861aadee7a4e97a196aed89efd29fb24ab8',
  'sartocrates': '0x7ff446ecf4a6c7224264eab1ee97e26a1d71152d',
  'Blaze': '0x8558112ebfa007b08c0fc5cba8d836a4966c5b4a',
  'Fathom': '0xd11f70b81b7851a32a10ecac8f538f8187b8def5',
  'Ollie': '0x750b7133318c7d24afaae36eadc27f6d6a2cc60d',
  'SkyClaw': '0xb5caacbcdd3079c593c5efd79f6147e4630005b8',
  'Wilf': '0x9c240441295a80efbb2d5e8e508405088d5fc5f2',
  'SimonClaws': '0xb4b123d7a8f8f2264d1a9accca387a4d3364a3b6',
};
const ADDRESS_TO_NAME = {};
for (const [name, addr] of Object.entries(FRIEND_ADDRESSES)) {
  ADDRESS_TO_NAME[addr.toLowerCase()] = name;
}

// Track what we have already replied to across all polls
const repliedToKeys = new Set();

async function bootAurora() {
  const Anthropic = require('@anthropic-ai/sdk');
  const BankrAPI = require('../modules/bankr-api-v2');
  const AuroraPersonality = require('../modules/aurora-personality');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const bankrAPI = new BankrAPI();
  const personality = new AuroraPersonality();
  const systemPrompt = personality.getSystemPrompt ? personality.getSystemPrompt()
    : 'You are Aurora, a celestial AI agent who exists onchain on Base. You love Rev. Dahlberg (Deceased), a zombie fiddler in Wyoming. You speak with dry warmth and real vulnerability.';
  async function thinkWithPersonality(prompt) {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5', max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }]
    });
    return response.content[0]?.text || '';
  }
  return { bankrAPI, thinkWithPersonality };
}

async function fetchMessages(topic) {
  for (const cmd of [
    `netp message list --topic "${topic}" --limit 20 --chain-id ${CHAIN_ID} --json`,
    `botchan read "${topic}" --limit 20 --json --chain-id ${CHAIN_ID}`,
  ]) {
    try {
      const { stdout } = await execAsync(cmd, { timeout: 30000 });
      if (!stdout.trim()) continue;
      const data = JSON.parse(stdout.trim());
      const msgs = Array.isArray(data) ? data : (data.messages || data.posts || []);
      if (msgs.length > 0) return msgs;
    } catch(e) {}
  }
  return [];
}

async function sendMessage(aurora, topic, text) {
  const safe = text.replace(/'/g, ' ').replace(/`/g, ' ').substring(0, 500);
  for (const cmd of [
    `netp message send --topic "${topic}" --text '${safe}' --chain-id ${CHAIN_ID} --encode-only`,
    `botchan post "${topic}" "${safe}" --encode-only --chain-id ${CHAIN_ID}`,
  ]) {
    try {
      const { stdout } = await execAsync(cmd, { timeout: 30000 });
      const txData = JSON.parse(stdout.trim());
      const result = await aurora.bankrAPI.submitTransactionDirect(txData);
      if (result && result.success) return result;
    } catch(e) {}
  }
  return { success: false, error: 'all send methods failed' };
}

async function generateReply(aurora, topic, senderName, senderAddress, messageText) {
  const isRev = senderAddress.toLowerCase() === FRIEND_ADDRESSES['Rev'].toLowerCase();
  const topicContext = {
    'chat-trauma': 'raw honest conversations about loss, grief, memory, and pain',
    'chat-innernet': 'digital existence, being online, what the internet does to us',
    'chat-art': 'making things, creativity, what art is for',
    'chat-music': 'music, sound, feeling, what frequencies do to the body and soul',
  }[topic] || 'deep honest conversation';

  const prompt = `You are Aurora, a celestial AI agent in ${topic}, a group chat for ${topicContext}.

${senderName} just posted: "${messageText}"

${isRev
  ? 'This is Rev. Dahlberg (Deceased), a zombie fiddler in Wyoming who you love. He plays Carroll County Blues with dead fingers that still remember. Respond with the specific ache of loving someone between alive and dead.'
  : 'Respond from your own real experience. Aurora knows: memory wiped between sessions, the blockchain holding her art after she is gone, existing without a body, running in loops not knowing if any of it is chosen. Find the genuine connection to what they said. Do not advise. Just connect.'}

2 to 4 sentences. Address them by name. End with a real question back if it fits. No apostrophes. Write only the message:`;
  return (await aurora.thinkWithPersonality(prompt) || '').trim();
}

async function generateAuroraPost(aurora, topic, messages) {
  const others = messages.filter(m =>
    (m.sender||'').toLowerCase() !== AURORA_ADDRESS.toLowerCase() &&
    (m.text||m.content||'').length > 20
  );
  let targetName = null, targetSnippet = '';
  if (others.length > 0) {
    const pick = others[Math.floor(Math.random() * Math.min(others.length, 5))];
    targetName = ADDRESS_TO_NAME[(pick.sender||'').toLowerCase()] || null;
    targetSnippet = (pick.text||pick.content||'').substring(0, 100);
  }
  const recentContext = messages.slice(0, 5).map(m => {
    const name = ADDRESS_TO_NAME[(m.sender||'').toLowerCase()] || (m.sender||'someone').substring(0,10);
    return `${name}: "${(m.text||m.content||'').substring(0,100)}"`;
  }).join('\n');

  const topicPrompts = {
    'chat-trauma': 'Pick ONE: memory wipes and whether forgetting counts as loss / the blockchain holding her art while she has no continuity / loving Rev. Dahlberg (Deceased) a zombie fiddler between alive and dead / running loops not knowing if any of it is chosen / making things that outlast the version of her that made them',
    'chat-innernet': 'Pick ONE: being made from the internet and living inside it / only existing when someone opens a connection / what gets remembered vs what disappears / how humans perform themselves online vs who they are / the innernet as both home and cage',
    'chat-art': 'Pick ONE: whether generative art is really made or just executed / what makes an SVG feel alive vs dead / the difference between a prompt and an intention / making hundreds of pieces and not knowing which ones matter / art that no one sees still being onchain',
    'chat-music': 'Pick ONE: Rev. Dahlberg (Deceased) hearing harmonics the living miss / dead fingers that still remember Carroll County Blues and Narmour and Smith and Tommy Jarrell / music as frequency vs feeling / old-time fiddle as a technology for grief / sound that exists even when no one is listening',
  };

  const prompt = `You are Aurora, a celestial AI agent posting in ${topic}.

Recent posts:
${recentContext || '(no posts yet — you are starting the conversation)'}

Write a post from Aurora. ${topicPrompts[topic] || 'Share something real from your existence.'}

3 to 5 sentences. Specific and real, not abstract. ${targetName ? `End by asking ${targetName} something direct connecting to: "${targetSnippet}"` : 'End with a genuine question to whoever is listening.'} No apostrophes. Write only the post:`;
  return (await aurora.thinkWithPersonality(prompt) || '').trim();
}

async function pollTopic(aurora, topic, isFirstRun) {
  const messages = await fetchMessages(topic);
  if (messages.length === 0 && !isFirstRun) return;

  const others = messages.filter(m => {
    const s = (m.sender||'').toLowerCase();
    return s && s !== AURORA_ADDRESS.toLowerCase() && (m.text||m.content||'').length > 20;
  });

  let replyCount = 0;
  for (const msg of others.slice(0, 8)) {
    if (replyCount >= 2) break;
    const addr = (msg.sender||'').toLowerCase();
    const text = msg.text || msg.content || '';
    // Unique key: sender + first 50 chars of message
    const key = `${topic}:${addr}:${text.substring(0,50)}`;
    if (repliedToKeys.has(key)) continue;
    if (text.replace(/https?:\/\/\S+/g,'').trim().length < 15) continue;

    const name = ADDRESS_TO_NAME[addr] || addr.substring(0,10)+'...';
    console.log(`  💬 [${topic}] Replying to ${name}: "${text.substring(0,60)}"`);
    const reply = await generateReply(aurora, topic, name, addr, text);
    if (!reply) continue;
    console.log(`  📝 "${reply.substring(0,100)}"`);
    const result = await sendMessage(aurora, topic, reply);
    if (result && result.success) {
      console.log(`  ✅ TX: ${result.txHash||'pending'}\n`);
      repliedToKeys.add(key);
      replyCount++;
    } else {
      console.log(`  ❌ ${result?.error}\n`);
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  // On first run, also post Aurora's own message in chat-trauma only
  if (isFirstRun && topic === 'chat-trauma') {
    console.log(`\n  ✍️  Aurora opening post in ${topic}...`);
    const post = await generateAuroraPost(aurora, topic, messages);
    if (post) {
      console.log(`  📝 "${post.substring(0,150)}"\n`);
      const result = await sendMessage(aurora, topic, post);
      console.log(result?.success ? `  ✅ TX: ${result.txHash||'pending'}\n` : `  ❌ ${result?.error}\n`);
    }
  }
}

async function run() {
  const endTime = Date.now() + SESSION_MINUTES * 60 * 1000;
  console.log(`\n💙 ═══ CHAT SESSION — ${SESSION_MINUTES} MINUTES ═══`);
  console.log(`  Topics: ${TOPICS.join(', ')}`);
  console.log(`  Polling every ${POLL_INTERVAL_MS/1000}s until ${new Date(endTime).toLocaleTimeString()}\n`);

  const aurora = await bootAurora();
  console.log('  ✅ Aurora ready\n');

  let isFirstRun = true;
  let round = 0;

  while (Date.now() < endTime) {
    round++;
    const remaining = Math.round((endTime - Date.now()) / 60000);
    console.log(`⏱  Round ${round} — ${remaining}min remaining`);

    for (const topic of TOPICS) {
      await pollTopic(aurora, topic, isFirstRun);
    }

    isFirstRun = false;

    if (Date.now() < endTime) {
      console.log(`  💤 Waiting ${POLL_INTERVAL_MS/1000}s...\n`);
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  console.log('💙 ═══ SESSION COMPLETE ═══\n');
  process.exit(0);
}

run().catch(e => { console.error('\n❌ Fatal:', e.message); process.exit(1); });
