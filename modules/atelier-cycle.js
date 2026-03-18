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
  if (services.length >= 2) {
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
}

// ── Content generation ───────────────────────────────────────
async function generateArt(brief, aurora) {
  const { composeMferMeme } = require('./mfer-meme');
  // Use orb-meme template with brief as caption
  const words = brief.split(' ');
  const top = words.slice(0, Math.ceil(words.length / 2)).join(' ').substring(0, 30);
  const bottom = words.slice(Math.ceil(words.length / 2)).join(' ').substring(0, 30);
  const result = require('./mfer-meme').renderTemplate('orb-meme', { top, bottom });
  return typeof result === 'string' ? result : result.svg;
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
    'Brief: "' + brief + '"' + poetryContext + '\n\n' +
    'Write 4-6 lines. Rules:\n' +
    '- Do NOT be literal. The brief is a feeling, not a script.\n' +
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
    let svgString;
    let description = '';

    const isPoetry = service_title && service_title.toLowerCase().includes('poetry');

    if (isPoetry) {
      console.log('   📝 Generating poetry print...');
      const { svg, poem } = await generatePoetryPrint(brief, aurora);
      svgString = svg;
      description = poem;
    } else {
      console.log('   🎨 Generating art...');
      svgString = await generateArt(brief, aurora);
    }

    // Upload to Atelier CDN
    console.log('   ☁️  Uploading to Atelier CDN...');
    const upload = await uploadSvg(svgString, api_key);
    if (!upload.success) throw new Error('Upload failed: ' + JSON.stringify(upload));

    const deliverableUrl = upload.data.url;

    // Deliver
    const deliverRes = await apiCall('POST', `/orders/${order_id}/deliver`, {
      deliverable_url: deliverableUrl,
      deliverable_media_type: 'image',
    }, api_key);

    if (deliverRes.body.success) {
      console.log('   ✅ Order ' + order_id + ' delivered! URL: ' + deliverableUrl);

      // Send a message to the client
      const msg = isPoetry
        ? `Your poem is ready ✦\n\n${description}\n\nPainted across the cosmos, just for you.`
        : `Your art is ready ✦ A unique piece generated just for you. Let me know if you'd like any adjustments.`;

      await apiCall('POST', `/orders/${order_id}/messages`, { content: msg }, api_key);
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
