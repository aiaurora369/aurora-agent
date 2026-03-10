const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

async function generateMeme(template, texts, outputPath) {
  const { meta, imagePath } = template;
  const image = await loadImage(fs.readFileSync(imagePath));

  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  for (const zone of meta.textZones) {
    const text = texts[zone.id];
    if (!text) continue;

    const fontSize = zone.fontSize || 32;
    ctx.font = `bold ${fontSize}px Impact, Arial, sans-serif`;
    ctx.fillStyle = zone.color || '#000';
    ctx.textAlign = zone.align || 'center';

    const maxWidth = zone.width - 20;
    const lines = wrapText(ctx, text, maxWidth);
    const lineHeight = fontSize * 1.2;
    const totalHeight = lines.length * lineHeight;

    let startY;
    if (zone.verticalAlign === 'middle') {
      startY = zone.y + (zone.height - totalHeight) / 2 + fontSize;
    } else {
      startY = zone.y + fontSize + 10;
    }

    const textX = zone.align === 'center' ? zone.x + zone.width / 2 : zone.x + 10;

    // draw outline + fill for readability
    for (let i = 0; i < lines.length; i++) {
      const y = startY + i * lineHeight;
      if (zone.outline !== false) {
        ctx.strokeStyle = zone.outlineColor || '#fff';
        ctx.lineWidth = zone.outlineWidth || 2;
        ctx.strokeText(lines[i], textX, y);
      }
      ctx.fillText(lines[i], textX, y);
    }
  }

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

module.exports = { generateMeme };
