// Renders index.html to an MP4 (1080x1920, 30fps, seamless loop).
// Usage: NODE_PATH=<dir with playwright> node render.cjs [out.mp4] [fps]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

(async () => {
  const out = path.resolve(process.argv[2] || 'visual_spin.mp4');
  const fps = Number(process.argv[3] || 30);
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + path.resolve(__dirname, 'index.html') + '?capture');
  const duration = await page.evaluate(() => window.DURATION);
  const frames = Math.round(duration * fps);

  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps),
    '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'medium', '-movflags', '+faststart', out],
    { stdio: ['pipe', 'inherit', 'inherit'] });

  for (let i = 0; i < frames; i++) {
    const png = await page.evaluate((t) => { window.renderFrame(t); return document.getElementById('c').toDataURL('image/png'); }, i / fps);
    const buf = Buffer.from(png.split(',')[1], 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 30 === 0) console.log(`frame ${i}/${frames}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  console.log('wrote', out);
})();
