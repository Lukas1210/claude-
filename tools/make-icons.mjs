// Erzeugt App-Icons und iOS-Startbilder aus app/assets/icons/icon.svg.
// Aufruf: node tools/make-icons.mjs   (benötigt Playwright mit Chromium)
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const svg = readFileSync(`${root}/assets/icons/icon.svg`, 'utf8');
const svgData = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

// Aktuelle iPhones (CSS-Breite × Höhe @ Pixeldichte)
const DEVICES = [
  [440, 956, 3], // 16/17 Pro Max
  [402, 874, 3], // 16/17 Pro, 17
  [420, 912, 3], // iPhone Air
  [430, 932, 3], // 14 Pro Max, 15/16 Plus, 15 Pro Max
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16, 16e
  [428, 926, 3], // 12/13 Pro Max, 14 Plus
  [390, 844, 3], // 12, 13, 14, 12/13 Pro
  [375, 812, 3], // X, XS, 11 Pro, 12/13 mini
  [414, 896, 3], // XS Max, 11 Pro Max
  [414, 896, 2], // XR, 11
  [375, 667, 2], // SE, 8
];

const browser = await chromium.launch();
const page = await browser.newPage();

async function icon(size, file, { maskable = false } = {}) {
  await page.setViewportSize({ width: size, height: size });
  // Maskierbare Icons: Motiv in die sichere Zone (80 %) verkleinern, Hintergrund randlos
  const inner = maskable ? 0.8 : 1;
  const off = (size * (1 - inner)) / 2;
  const html = `<html><body style="margin:0;overflow:hidden;background:#e62e5c">
    <img src="${svgData}" style="position:absolute;left:0;top:0;width:${size}px;height:${size}px;display:block">
    ${maskable ? `<img src="${svgData}" style="position:absolute;left:${off}px;top:${off}px;width:${size * inner}px;height:${size * inner}px;display:block">` : ''}
  </body></html>`;
  await page.setContent(html, { waitUntil: 'load' });
  writeFileSync(file, await page.screenshot({ type: 'png' }));
}

mkdirSync(`${root}/assets/icons`, { recursive: true });
mkdirSync(`${root}/assets/splash`, { recursive: true });
await icon(180, `${root}/assets/icons/apple-touch-icon.png`);
await icon(192, `${root}/assets/icons/icon-192.png`);
await icon(512, `${root}/assets/icons/icon-512.png`);
await icon(512, `${root}/assets/icons/maskable-512.png`, { maskable: true });

const links = [];
const SCHEMES = { light: '#f2f2f7', dark: '#0b0b0e' };
for (const [w, h, dpr] of DEVICES) {
  for (const [scheme, bg] of Object.entries(SCHEMES)) {
    const pw = w * dpr, ph = h * dpr;
    const file = `splash-${pw}x${ph}-${scheme}.png`;
    // Ruhiges Startbild: einfarbiger Hintergrund wie die App, Icon in der Mitte
    const html = `<html><body style="margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${bg};display:grid;place-items:center">
      <img src="${svgData}" style="width:84px;height:84px;border-radius:19px;box-shadow:0 10px 30px -10px rgba(0,0,0,.35)"></body></html>`;
    const p2 = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    await p2.setContent(html, { waitUntil: 'load' });
    writeFileSync(`${root}/assets/splash/${file}`, await p2.screenshot({ type: 'png' }));
    await p2.close();
    links.push(`  <link rel="apple-touch-startup-image" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait) and (prefers-color-scheme: ${scheme})" href="assets/splash/${file}">`);
  }
}
await browser.close();

// Links in index.html eintragen
const indexPath = `${root}/index.html`;
const index = readFileSync(indexPath, 'utf8');
const updated = index.replace(/<!-- STARTUP-IMAGES:BEGIN -->[\s\S]*?<!-- STARTUP-IMAGES:END -->/, `<!-- STARTUP-IMAGES:BEGIN -->\n${links.join('\n')}\n  <!-- STARTUP-IMAGES:END -->`);
writeFileSync(indexPath, updated);
console.log(`Icons und ${links.length} Startbilder erzeugt.`);
