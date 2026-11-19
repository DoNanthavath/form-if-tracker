// Renders public/favicon.svg into the PNG icon set using Playwright's Chromium.
// Usage: npm run icons   (requires `playwright` available to node)
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const targets = [
  { file: 'pwa-192.png', size: 192, pad: 0, round: true },
  { file: 'pwa-512.png', size: 512, pad: 0, round: true },
  { file: 'apple-touch-icon.png', size: 180, pad: 0, round: false },
  { file: 'pwa-maskable-512.png', size: 512, pad: 0.12, round: false },
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  // iOS & maskable icons must be full-bleed squares; drop the rounded corners.
  const body = t.round ? svg : svg.replace('rx="116"', 'rx="0"');
  const inner = Math.round(t.size * (1 - t.pad * 2));
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(`<html><body style="margin:0;background:${t.round ? 'transparent' : '#120609'};display:grid;place-items:center;width:${t.size}px;height:${t.size}px">
    <div style="width:${inner}px;height:${inner}px">${body.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`);
  await page.screenshot({ path: new URL(`../public/${t.file}`, import.meta.url).pathname, omitBackground: t.round });
  console.log('wrote', t.file);
}
await browser.close();
