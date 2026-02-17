const puppeteer = require('puppeteer');
const fs = require('fs');
const { execSync } = require('child_process');

/**
 * Convert animated SVG to GIF using puppeteer + ffmpeg (if available)
 * Falls back to static PNG via sharp if ffmpeg not found
 */
async function svgToGif(svg, opts = {}) {
  const width = opts.width || 400;
  const height = opts.height || 400;
  const frames = opts.frames || 20;
  const duration = opts.duration || 4;
  const frameDelay = Math.round((duration / frames) * 1000);
  const tmpDir = '/tmp/aurora-gif-' + Date.now();

  // Check if ffmpeg is available
  try { execSync('which ffmpeg', { stdio: 'pipe' }); } catch {
    throw new Error('ffmpeg not installed — run: brew install ffmpeg');
  }

  let browser;
  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width, height });

    const html = `<!DOCTYPE html><html><head><style>
      * { margin: 0; padding: 0; }
      body { width: ${width}px; height: ${height}px; overflow: hidden; background: #000; }
      svg { width: ${width}px; height: ${height}px; }
    </style></head><body>${svg}</body></html>`;

    await page.setContent(html, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 500));

    // Capture frames
    for (let i = 0; i < frames; i++) {
      await page.screenshot({
        path: `${tmpDir}/frame-${String(i).padStart(3, '0')}.png`,
        type: 'png'
      });
      await new Promise(r => setTimeout(r, frameDelay));
    }

    await browser.close();
    browser = null;

    // Stitch frames into GIF with ffmpeg
    const fps = Math.round(frames / duration);
    const outPath = `${tmpDir}/output.gif`;
    execSync(
      `ffmpeg -y -framerate ${fps} -i ${tmpDir}/frame-%03d.png ` +
      `-vf "scale=${width}:${height}:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" ` +
      `-loop 0 ${outPath}`,
      { stdio: 'pipe', timeout: 30000 }
    );

    const gifBuf = fs.readFileSync(outPath);

    // Cleanup
    fs.readdirSync(tmpDir).forEach(f => fs.unlinkSync(`${tmpDir}/${f}`));
    fs.rmdirSync(tmpDir);

    console.log(`   🎬 GIF created: ${Math.round(gifBuf.length / 1024)}KB, ${frames} frames`);
    return gifBuf;
  } catch (e) {
    if (browser) await browser.close();
    try { fs.readdirSync(tmpDir).forEach(f => fs.unlinkSync(`${tmpDir}/${f}`)); fs.rmdirSync(tmpDir); } catch {}
    throw e;
  }
}

module.exports = { svgToGif };
