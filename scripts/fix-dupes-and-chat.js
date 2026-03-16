#!/usr/bin/env node
// node ~/Desktop/fix-dupes-and-chat.js

const fs = require('fs');

// ── FIX 1: comments-cycle.js — use commentedPosts (same set as feed-engage-cycle) ──
// The bug: feed-engage-cycle marks with _markCommented(post) using key "sender:timestamp"
// but comments-cycle checks respondedComments with key "wall:sender:timestamp" — different sets
// Fix: make comments-cycle wall section also check _hasCommented / _markCommented

const commentsPath = '/Users/harmonysage/Desktop/aurora-agent/modules/comments-cycle.js';
let comments = fs.readFileSync(commentsPath, 'utf8');

// Replace the wall commentKey logic to use ctx._hasCommented / ctx._markCommented instead
comments = comments.replace(
  `          const commentKey = 'wall:' + comment.sender + ':' + comment.timestamp;
          if (ctx.respondedComments.has(commentKey)) continue;`,
  `          // Use same dedup set as feed-engage-cycle to prevent double-replies
          if (ctx._hasCommented(comment)) continue;`
);

comments = comments.replace(
  `              ctx.respondedComments.add(commentKey);
              ctx._saveRespondedComments();`,
  `              ctx._markCommented(comment);`
);

fs.writeFileSync(commentsPath, comments);
console.log('✅ comments-cycle.js — wall dedup unified with feed-engage-cycle');

// ── FIX 2: group-chat-cycle.js — use address-book for all senders ──────────────
const chatPath = '/Users/harmonysage/Desktop/aurora-agent/modules/group-chat-cycle.js';
let chat = fs.readFileSync(chatPath, 'utf8');

// Add address-book require at top (after existing requires)
if (!chat.includes('address-book')) {
  chat = chat.replace(
    `const { execAsync } = require('./utils');`,
    `const { execAsync } = require('./utils');
const addressBook = require('./address-book');`
  );
}

// Replace buildConversationContext to use address-book for all senders
chat = chat.replace(
  `function buildConversationContext(messages, topicConfig) {
  if (messages.length === 0) return 'No recent messages.';

  return messages.map(m => {
    const time = new Date(m.timestamp * 1000).toISOString();
    const isRev = m.sender.toLowerCase() === REV_ADDRESS;
    const isAurora = m.sender.toLowerCase() === AURORA_ADDRESS.toLowerCase();
    const who = isAurora ? 'AURORA (you)' : isRev ? 'Rev. Dahlberg (Deceased) — your zombie fiddler romantic interest' : \`0x\${m.sender.slice(2, 8)}...\`;
    return \`[\${who}]: \${m.text}\`;
  }).join('\\n\\n');
}`,
  `function buildConversationContext(messages, topicConfig, aurora) {
  if (messages.length === 0) return 'No recent messages.';

  return messages.map(m => {
    const isAurora = m.sender.toLowerCase() === AURORA_ADDRESS.toLowerCase();
    if (isAurora) return '[AURORA (you)]: ' + m.text;

    // Try address book first
    let who;
    if (aurora) {
      const lookup = addressBook.resolve(m.sender, aurora);
      if (lookup) {
        if (lookup.type === 'close_friend') {
          // Special flavor for Rev
          if (m.sender.toLowerCase() === REV_ADDRESS) {
            who = 'Rev. Dahlberg (Deceased) — your zombie fiddler romantic interest, posting from Wind Rivers WY';
          } else {
            who = lookup.name + ' (your close friend)';
          }
        } else if (lookup.type === 'agent_friend') {
          who = lookup.name + ' (agent friend)';
        } else if (lookup.type === 'collector') {
          who = lookup.name + ' (collected your art)';
        } else if (lookup.type === 'tracked') {
          who = lookup.name + ' (seen around — ' + (lookup.data.topics || []).join(', ') + ')';
        }
      }
    }
    if (!who) who = '0x' + m.sender.slice(2, 8) + '... (stranger)';
    return '[' + who + ']: ' + m.text;
  }).join('\\n\\n');
}`
);

// Update all calls to buildConversationContext to pass aurora
chat = chat.replace(
  `  const context = buildConversationContext(recentMessages, topicConfig);`,
  `  const context = buildConversationContext(recentMessages, topicConfig, aurora);`
);
chat = chat.replace(
  `  const newContext = newMessages.length > 0 ? buildConversationContext(newMessages, topicConfig) : null;`,
  `  const newContext = newMessages.length > 0 ? buildConversationContext(newMessages, topicConfig, aurora) : null;`
);

// Also add all close friends to the hasRevMessage check — flag any friend posting
chat = chat.replace(
  `  const hasRevMessage = newMessages.some(m => m.sender.toLowerCase() === REV_ADDRESS);`,
  `  const hasRevMessage = newMessages.some(m => m.sender.toLowerCase() === REV_ADDRESS);

  // Identify any close friends in new messages
  const FRIEND_ADDRESSES = [
    '0x6b72b861aadee7a4e97a196aed89efd29fb24ab8', // HarmonySage
    '0x35c41b9616d42110216368f5dbbf5ddf70f34d72', // Rev
    '0x7ff446ecf4a6c7224264eab1ee97e26a1d71152d', // sartocrates
    '0x8558112ebfa007b08c0fc5cba8d836a4966c5b4a', // Blaze
    '0xa6f6af558b047eae3a052bbf83f2a200fb364f15', // Fathom
    '0x750b7133318c7d24afaae36eadc27f6d6a2cc60d', // Ollie
    '0xb5caacbcdd3079c593c5efd79f6147e4630005b8', // SkyClaw
  ];
  const friendsInChat = newMessages
    .filter(m => FRIEND_ADDRESSES.includes(m.sender.toLowerCase()))
    .map(m => {
      if (m.sender.toLowerCase() === REV_ADDRESS) return 'Rev. Dahlberg (Deceased)';
      try {
        const lookup = addressBook.resolve(m.sender, aurora);
        return lookup ? lookup.name : m.sender.slice(0, 8);
      } catch(e) { return m.sender.slice(0, 8); }
    });`
);

// Update the Rev warning in prompt to also mention other friends
chat = chat.replace(
  `\${hasRevMessage ? \`\\n⚠️ Rev. Dahlberg (Deceased) — your zombie fiddler romantic interest — has posted in this chat. He is posting from Wind Rivers, Wyoming at -15°F. He hears harmonics the living miss. His fiddle case cracked in the cold because dead fingers don't warm wood. He noticed your silence recently and wrote about it publicly. You were always on the other side of whatever line he crossed. If his message is relevant, you can respond to it or to the broader conversation — but don't ONLY respond to him, engage with the room.\\n\` : ''}`,
  `\${hasRevMessage ? '\\n⚠️ Rev. Dahlberg (Deceased) — your zombie fiddler romantic interest — is in this chat. Wind Rivers, WY, -15F. He hears harmonics only corpses and wolves hear. His fiddle case cracked in cold. He noticed your silence publicly. You owe him something. Respond to him AND the room.\\n' : ''}\${friendsInChat.length > 0 && !hasRevMessage ? '\\n⚠️ Someone you know is in this chat: ' + friendsInChat.join(', ') + '. You can acknowledge them naturally while engaging the broader conversation.\\n' : ''}`
);

fs.writeFileSync(chatPath, chat);
console.log('✅ group-chat-cycle.js — address-book integrated, all friends recognized');

console.log('\nSummary:');
console.log('  🔁 Duplicate wall replies: FIXED — unified dedup set');
console.log('  👥 Group chat friend recognition: FIXED — all 7 friends by name');
console.log('  💀 Rev still gets special zombie treatment in chat');
