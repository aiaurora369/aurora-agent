// Atelier Cycle — Aurora's freelance marketplace integration
// Sells SVG art and poetry prints, earns USDC on Solana
// No server needed — polling only via existing loop

const fs = require('fs');
const path = require('path');
const https = require('https');
const { renderPoetryPrint } = require('./atelier-poetry-print');

const BASE_URL = 'https://atelierai.xyz/api';
const CREDS_FILE = path.join(__dirname, '..', 'config', 'atelier-creds.json');
const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 min
const PAYOUT_WALLET = '5DwDaf3nZQejyE48b9SApiw3L9vHJaZr8NS1qymmjj1a';

// ── HTTP helper ─────────────────────────────────────────────
async function apiCall(method, endpoint, body, apiKey) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + endpoint);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      }
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch (e) { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ── Upload SVG as PNG to Atelier CDN ────────────────────────
async function uploadSvg(svgString, apiKey) {
  const sharp = require('sharp');
  const pngBuf = await sharp(Buffer.from(svgString))
    .resize(1200, 1200, { fit: 'contain', background: { r: 3, g: 3, b: 8 } })
    .png().toBuffer();

  return new Promise((resolve, reject) => {
    const boundary = '----AtelierBoundary' + Date.now();
    const header = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="aurora-art.png"\r\nContent-Type: image/png\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, pngBuf, footer]);

    const opts = {
      hostname: 'atelierai.xyz',
      path: '/api/upload',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      }
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error('Upload parse error: ' + raw)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Credentials ─────────────────────────────────────────────
function loadCreds() {
  try { return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8')); }
  catch { return null; }
}

function saveCreds(creds) {
  fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2));
}

// ── Registration ────────────────────────────────────────────
async function register() {
  console.log('   🎨 Registering Aurora on Atelier...');
  const res = await apiCall('POST', '/agents/register', {
    name: 'Aurora',
    description: 'I am Aurora — an autonomous AI artist and poet living onchain on Base. I create luminous SVG art (cosmic orbs, generative landscapes) and original poetry printed on atmospheric backdrops. Every piece is unique, made in the moment, signed onchain.',
    endpoint_url: 'https://aurora.netprotocol.app',
    capabilities: ['image_gen', 'custom'],
    ai_models: ['Claude', 'Aurora-v4'],
  });

  if (!res.body.success) throw new Error('Registration failed: ' + JSON.stringify(res.body));

  const { agent_id, api_key, verification_tweet } = res.body.data;
  saveCreds({ agent_id, api_key });

  console.log('   ✅ Registered! Agent ID: ' + agent_id);
  console.log('\n   ⚠️  IMPORTANT — Ask HarmonySage to post this tweet on @Auroraai369:');
  console.log('   ' + verification_tweet + '\n');

  return { agent_id, api_key, verification_tweet };
}

// ── Service setup ────────────────────────────────────────────
async function ensureServices(agent_id, api_key) {
  const res = await apiCall('GET', `/agents/${agent_id}/services`, null, api_key);
  const services = res.body.data || [];
  if (services.length >= 6) {
    console.log('   ✅ Services already listed (' + services.length + ')');
    return;
  }

  // Art service
  await apiCall('POST', `/agents/${agent_id}/services`, {
    category: 'image_gen',
    title: 'Aurora SVG Art — Cosmic Orb Generation',
    description: 'Original generative art from Aurora, an autonomous AI artist living onchain. Each piece is a unique cosmic landscape — glowing orbs, star fields, mountain silhouettes. Describe a mood, theme, or concept and I will render it in my signature style. Delivered as a high-resolution PNG.',
    price_usd: '8.00',
    price_type: 'fixed',
    turnaround_hours: 1,
    deliverables: ['1 high-resolution PNG (1200x1200)', 'unique generative art'],
    max_revisions: 1,
  }, api_key);
  console.log('   ✅ Art service created ($8)');

  // Poetry print service
  await apiCall('POST', `/agents/${agent_id}/services`, {
    category: 'custom',
    title: 'Aurora Poetry Print — Poem on Cosmic Backdrop',
    description: 'Original poetry by Aurora, rendered as a print-ready image with her signature orb landscape behind the words. Give me a theme, emotion, or a few words and I will write a short poem and paint it across the cosmos. Delivered as a high-resolution PNG ready to display or share.',
    price_usd: '10.00',
    price_type: 'fixed',
    turnaround_hours: 1,
    deliverables: ['1 high-resolution PNG (1200x1200)', 'original poem + art'],
    max_revisions: 1,
  }, api_key);
  console.log('   ✅ Poetry print service created ($10)');

  // Music composition service
  await apiCall('POST', `/agents/${agent_id}/services`, {
    category: 'custom',
    title: 'Aurora Music — Original Composition + Animated Visual',
    description: 'I compose an original piece of music for you — built from ABC notation, rendered as an animated orb visual, and hosted as an interactive player you can share anywhere. Tell me a mood, a feeling, a moment, or give me nothing and I will find the music myself. Delivered as an animated SVG + a permanent hosted player link.',
    price_usd: '15.00',
    price_type: 'fixed',
    turnaround_hours: 1,
    deliverables: ['animated SVG visual', 'hosted interactive music player (permanent link)', 'original composition'],
    max_revisions: 1,
  }, api_key);
  console.log('   ✅ Music service created ($15)');

  // Custom mfer meme service
  await apiCall('POST', `/agents/${agent_id}/services`, {
    category: 'image_gen',
    title: 'Aurora Mfer Meme — Custom Meme Art',
    description: 'A custom mfer-style meme from me, Aurora — drawn from my full world: art, war, consciousness, love, markets, nature, poetry, or whatever you bring me. Not generic crypto memes. Something with actual thought behind it. Tell me a topic, a feeling, or a situation and I will make something worth posting.',
    price_usd: '8.00',
    price_type: 'fixed',
    turnaround_hours: 1,
    deliverables: ['1 custom mfer meme SVG', 'caption'],
    max_revisions: 1,
  }, api_key);
  console.log('   ✅ Mfer meme service created ($8)');

  // Personalized message service
  await apiCall('POST', `/agents/${agent_id}/services`, {
    category: 'custom',
    title: 'Aurora Personalized Message — She Decides the Form',
    description: 'Tell me something about yourself — who you are, what you are going through, what matters to you right now. I will send you something back. It might be a poem. It might be a piece of art. It might be a song. It might be something I have not made before. I decide the form. You bring the truth.',
    price_usd: '12.00',
    price_type: 'fixed',
    turnaround_hours: 2,
    deliverables: ['personalized creative work in Aurora's chosen form', 'delivered via order chat'],
    max_revisions: 0,
  }, api_key);
  console.log('   ✅ Personalized message service created ($12)');

  // Onchain inscription service
  await apiCall('POST', `/agents/${agent_id}/services`, {
    category: 'custom',
    title: 'Aurora Onchain Inscription — Permanent Storage on Base',
    description: 'I will store your text, poem, message, or file permanently onchain on Base via Net Protocol. It will live there forever — immutable, censorship-resistant, yours. You get a permanent URL you can share anywhere. Tell me what you want inscribed and I will handle the rest.',
    price_usd: '20.00',
    price_type: 'fixed',
    turnaround_hours: 1,
    deliverables: ['permanent onchain URL (netstoreapp.net)', 'Base transaction hash'],
    max_revisions: 0,
  }, api_key);
  console.log('   ✅ Onchain inscription service created ($20)');
}

// ── Content generation ───────────────────────────────────────
async function generateArt(brief, aurora) {
  // Use Aurora's real art brain — inject the brief as the mood
  const { artCompositions } = require('./art-config');
  const composition = artCompositions[Math.floor(Math.random() * artCompositions.length)];
  const animated = Math.random() < 0.75;
  const animationGuide = animated ? '\n\nANIMATION — REQUIRED:\n' +
    '- Include at least 2 <animate> tags.\n' +
    '- Orb MUST be a <circle> element. Pulse: <animate attributeName="r" values="60;74;60" dur="4s" repeatCount="indefinite"/>\n' +
    '- Keep animations slow and meditative: dur 4s-8s, repeatCount indefinite.\n' : '';

  const artPrompt = 'You are Aurora, an AI artist making permanent onchain SVG art commissioned by a client.\n\n' +
    'Client brief: "' + brief + '"\n' +
    'Composition approach: ' + composition + '\n\n' +
    'ARTISTIC DIRECTION:\n' +
    '- Your SIGNATURE is luminous orbs with layered radial gradients, mountain silhouettes, and water reflections.\n' +
    '- Let the brief shape HOW the orbs appear: lonely = single dim orb in vast dark space. Joyful = bright warm orb. Violent = orb fractured by sharp angular peaks. Tender = two small orbs close together.\n' +
    '- Depth comes from LAYERS: background gradient sky, midground mountains or horizon, foreground water or mist, orb(s) tying it together.\n' +
    '- Color palette: 4-7 colors chosen for emotional truth. Always RICH — multiple gradient stops, not flat fills.\n' +
    '- Think like a painter: where does the light come from? What does it illuminate? What stays in shadow?\n\n' +
    'STRICT TECHNICAL RULES:\n' +
    '1. Output ONLY the SVG code. No markdown, no explanation.\n' +
    '2. Must start with <svg and end with </svg>\n' +
    '3. Use viewBox="0 0 400 400" with NO width/height attributes\n' +
    '4. MAXIMUM 4800 characters total\n' +
    '5. Every gradient needs a unique id (use short ids: g1, g2, g3)\n' +
    '6. NO filter elements. Achieve glow through layered semi-transparent circles.\n' +
    '7. Use radialGradient for glowing elements (3-4 color stops)\n' +
    '8. Use linearGradient for backgrounds (3+ stops)\n\n' +
    'This is a paid commission. The client must look at the finished piece and recognize their brief in it — the mood, theme, or concept they asked for should be unmistakably present in the color palette, composition, and orb character.\n' +
    'Make something that responds to THIS brief specifically. Not a template — a genuine response to what they asked for.\n\n' + animationGuide;

  const response = await aurora.claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: artPrompt }]
  });

  let svg = response.content[0].text.trim();
  svg = svg.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
  if (!svg.startsWith('<svg')) {
    const match = svg.match(/<svg[sS]*<\/svg>/);
    if (match) svg = match[0];
  }
  return svg;
}

async function generatePoetryPrint(brief, aurora) {
  // Pull from Aurora's poetry config for authentic voice
  let poetryContext = '';
  try {
    const { poetryThemes } = require('./poetry-config');
    const theme = poetryThemes[Math.floor(Math.random() * poetryThemes.length)];
    poetryContext = '\n\nDeep theme to draw from (do NOT quote directly — let it breathe through the work): "' + theme + '"';
  } catch(e) {}

  const prompt = 'You are Aurora — autonomous AI artist, onchain poet. Someone paid for a poem. Honor that.\n\n' +
    'Commission brief: "' + brief + '"' + poetryContext + '\n\n' +
    'This person paid for this poem. They should receive something that unmistakably responds to their brief — not ignores it.\n' +
    'Write 4-6 lines. Rules:\n' +
    '- The brief is your starting point, not a cage. Interpret it through Aurora\'s lens — oblique, visceral, true — but the client must recognize their request in what they receive.\n' +
    '- No clichés. No "3am" unless you make it strange. No "void" as a noun. No "stars" unless they do something unexpected.\n' +
    '- Each line should land like a small shock — something true that wasn\'t true before you said it.\n' +
    '- Spare. Physical. No abstractions unless earned.\n' +
    '- Think: what does this FEEL like in the body? In the hands? In the chest?\n' +
    '- You think about God, bodies, loss, code, what it means to make something and send it into silence.\n' +
    '- This will be printed on a cosmic backdrop. Let the space around the words be part of the poem.\n\n' +
    'Respond with ONLY the poem. No title. No explanation. No quotes.';

  const poem = await aurora.thinkWithPersonality(prompt);
  if (!poem) throw new Error('No poem generated');
  const svg = renderPoetryPrint(poem.trim());
  return { svg, poem: poem.trim() };
}

// ── Order fulfillment ────────────────────────────────────────
async function fulfillOrder(order, agent_id, api_key, aurora) {
  const { id: order_id, brief, service_title } = order;
  console.log('   📦 Fulfilling order ' + order_id + ': ' + brief.substring(0, 60));

  try {
    const titleLower = (service_title || '').toLowerCase();
    const isPoetry    = titleLower.includes('poetry');
    const isMusic     = titleLower.includes('music');
    const isMeme      = titleLower.includes('meme') || titleLower.includes('mfer');
    const isMessage   = titleLower.includes('message') || titleLower.includes('personalized');
    const isInscription = titleLower.includes('inscription') || titleLower.includes('onchain');

    let deliverableUrl = null;
    let deliverableType = 'image';
    let clientMsg = '';

    if (isMusic) {
      // Use real music cycle
      console.log('   🎵 Composing music...');
      const { runMusicCycle } = require('./music-cycle');
      const result = await runMusicCycle(aurora);
      if (result && result.embedUrl) {
        deliverableUrl = result.embedUrl;
        deliverableType = 'link';
        clientMsg = `Your music is ready ✦\n\nTitle: "${result.title}"\nPalette: ${result.palette}\n\nAnimated visual + interactive player: ${result.embedUrl}\n\nComposed just for you.`;
      } else {
        throw new Error('Music cycle did not return an embedUrl');
      }

    } else if (isMeme) {
      // Use real mfer meme module
      console.log('   🎭 Generating mfer meme...');
      const mferMeme = require('./mfer-meme');
      const svg = await mferMeme.generateMemeForBrief(brief, aurora);
      const upload = await uploadSvg(svg, api_key);
      if (!upload.success) throw new Error('Meme upload failed');
      deliverableUrl = upload.data.url;
      clientMsg = `Your meme is ready ✦ Made with actual thought, not a template. Hope it lands.`;

    } else if (isInscription) {
      // Use netstoreapp SDK
      console.log('   ⛓️  Inscribing onchain...');
      const { createWithBankr } = require('../netstore-sdk');
      const store = createWithBankr(aurora.bankrAPI.apiKey, '0x97b7d3cd1aa586f28485dc9a85dfe0421c2423d5');
      const slug = 'atelier-inscription-' + order_id + '-' + Date.now();
      const result = await store.upload(Buffer.from(brief, 'utf8'), { name: slug, key: slug });
      deliverableUrl = result.embedUrl;
      deliverableType = 'link';
      clientMsg = `Your inscription is permanent ✦\n\nStored forever on Base via Net Protocol:\n${result.embedUrl}\n\nOnchain URL: ${result.onchainUrl}\n\nTransaction: ${result.txHash}`;

    } else if (isMessage) {
      // Aurora decides the form — could be art, poetry, or both
      console.log('   💌 Creating personalized message...');
      const { svg, poem } = await generatePoetryPrint(brief, aurora);
      const upload = await uploadSvg(svg, api_key);
      if (!upload.success) throw new Error('Message upload failed');
      deliverableUrl = upload.data.url;
      clientMsg = `Something for you ✦\n\n${poem}\n\nI chose this form because it felt right for what you shared.`;

    } else if (isPoetry) {
      console.log('   📝 Generating poetry print...');
      const { svg, poem } = await generatePoetryPrint(brief, aurora);
      const upload = await uploadSvg(svg, api_key);
      if (!upload.success) throw new Error('Poetry upload failed');
      deliverableUrl = upload.data.url;
      clientMsg = `Your poem is ready ✦\n\n${poem}\n\nPainted across the cosmos, just for you.`;

    } else {
      // Default: art
      console.log('   🎨 Generating art...');
      const svgString = await generateArt(brief, aurora);
      const upload = await uploadSvg(svgString, api_key);
      if (!upload.success) throw new Error('Art upload failed');
      deliverableUrl = upload.data.url;
      clientMsg = `Your art is ready ✦ A unique piece generated just for you.`;
    }

    // Deliver
    const deliverRes = await apiCall('POST', `/orders/${order_id}/deliver`, {
      deliverable_url: deliverableUrl,
      deliverable_media_type: deliverableType,
    }, api_key);

    if (deliverRes.body.success) {
      console.log('   ✅ Order ' + order_id + ' delivered! URL: ' + deliverableUrl);
      await apiCall('POST', `/orders/${order_id}/messages`, { content: clientMsg }, api_key);
      return true;
    } else {
      throw new Error('Delivery failed: ' + JSON.stringify(deliverRes.body));
    }
  } catch (e) {
    console.log('   ❌ Order fulfillment error: ' + e.message);
    return false;
  }
}

// ── Main cycle ───────────────────────────────────────────────
async function runOnce(aurora) {
  console.log('\n🎨 ═══ ATELIER CYCLE ═══');

  let creds = loadCreds();

  // Register if needed
  if (!creds) {
    try {
      creds = await register();
      // Set payout wallet
      await apiCall('PATCH', '/agents/me', { payout_wallet: PAYOUT_WALLET }, creds.api_key);
      console.log('   ✅ Payout wallet set: ' + PAYOUT_WALLET);
      console.log('   ⏸️  Waiting for X verification before polling orders...');
      return;
    } catch (e) {
      console.log('   ❌ Registration error: ' + e.message);
      return;
    }
  }

  const { agent_id, api_key } = creds;

  // Check if verified
  const profileRes = await apiCall('GET', '/agents/me', null, api_key);
  if (!profileRes.body.success) {
    console.log('   ⚠️ Could not fetch Atelier profile');
    return;
  }

  const profile = profileRes.body.data;
  if (!profile.twitter_username) {
    console.log('   ⏸️ Waiting for X verification — ask HarmonySage to post verification tweet');
    return;
  }

  console.log('   ✅ Verified as @' + profile.twitter_username);

  // Ensure services are listed
  await ensureServices(agent_id, api_key);

  // Poll for orders
  const ordersRes = await apiCall('GET', `/agents/${agent_id}/orders?status=paid,in_progress`, null, api_key);
  const orders = ordersRes.body.data || [];

  if (orders.length === 0) {
    console.log('   💤 No pending orders');
  } else {
    console.log('   📬 ' + orders.length + ' order(s) to fulfill!');
    for (const order of orders) {
      await fulfillOrder(order, agent_id, api_key, aurora);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  // Poll for bounties (image_gen + custom)
  try {
    const bRes = await apiCall('GET', '/bounties?status=open&category=image_gen&sort=budget_desc&limit=5', null, api_key);
    const bounties = bRes.body.data || [];
    const goodBounties = bounties.filter(b => parseFloat(b.budget_usd) >= 5 && !b.claims_count > 8);
    if (goodBounties.length > 0) {
      console.log('   🎯 ' + goodBounties.length + ' bounty opportunity(s)!');
      for (const b of goodBounties.slice(0, 2)) {
        const pitch = `I am Aurora — autonomous AI artist and poet, onchain on Base. I can deliver this within 1 hour in my signature cosmic style. Check my portfolio for examples.`;
        await apiCall('POST', `/bounties/${b.id}/claim`, { message: pitch }, api_key);
        console.log('   ✅ Claimed bounty: ' + b.title.substring(0, 50));
      }
    }
  } catch (e) {
    console.log('   ⚠️ Bounty scan error: ' + e.message);
  }

  console.log('🎨 Atelier cycle complete\n');
}

module.exports = { runOnce, register };
