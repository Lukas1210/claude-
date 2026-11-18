// Gemeinsame Helfer für die End-to-End-Tests: Mini-Server, Browser im iPhone-Format,
// Testbilder (ohne Binärdateien im Repo), Onboarding und Beispieldaten.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..', 'app');
const TMP = path.join(os.tmpdir(), 'couple-journal-e2e');
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');
fs.mkdirSync(TMP, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};

/** Statischer Server für app/ auf einem freien Port (jeder Lauf = eigener Ursprung = frische Daten). */
function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(buf);
      });
    });
    srv.listen(0, () => resolve({ url: `http://localhost:${srv.address().port}/`, close: () => new Promise((r) => srv.close(r)) }));
  });
}

/** Prüf-Sammler für eine Testgruppe. */
function makeChecker(name) {
  const st = { name, passed: 0, failed: 0, failures: [] };
  st.check = (label, ok, extra = '') => {
    console.log(`  ${ok ? '✓' : '✗'} ${label}${extra ? ` (${extra})` : ''}`);
    if (ok) st.passed++; else { st.failed++; st.failures.push(label); }
  };
  return st;
}

/** Browser + Seite im iPhone-Format öffnen. */
async function openApp(server, { scheme = 'light', dpr = 1, nominatim = [], notch = false } = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    colorScheme: scheme, viewport: { width: 393, height: 852 }, deviceScaleFactor: dpr,
    isMobile: true, hasTouch: true, locale: 'de-DE', timezoneId: 'Europe/Berlin', acceptDownloads: true,
  });
  await ctx.route('**/nominatim.openstreetmap.org/**', (route) => route.fulfill({ json: nominatim }));
  if (notch) {
    await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = ':root{--safe-t:47px!important;--safe-b:34px!important}';
      document.head.appendChild(s);
    }));
  }
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await p.goto(server.url);
  await p.waitForSelector('.onb .step, #view > *', { timeout: 15000 });
  fs.mkdirSync(SHOTS, { recursive: true });
  return {
    browser, ctx, p, errors,
    S: (fn, arg) => p.evaluate(fn, arg),
    go: async (hash, wait = 800) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(wait); },
    scroll: async (y, wait = 400) => { await p.evaluate((y) => document.getElementById('scroller').scrollTo(0, y), y); await p.waitForTimeout(wait); },
    shot: (name) => p.screenshot({ path: path.join(SHOTS, `${name}.png`) }),
    /** Meldungen und Effekte entfernen, damit sie nicht über einem Screenshot liegen. */
    calm: () => p.evaluate(() => document.querySelectorAll('#toasts .toast, .fx-confetti, .fx-spark, .fx-ring').forEach((n) => n.remove())),
    iso: (n) => p.evaluate((n) => { const d = new Date(); d.setDate(d.getDate() + n); const z = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; }, n),
    close: () => browser.close(),
  };
}

/** Onboarding durchklicken (über data-Attribute, unabhängig von Texten). */
async function onboard(app, { a = 'Lukas', b = 'Mia', start = '2022-03-12' } = {}) {
  const { p } = app;
  await p.click('[data-go="names"]');
  await p.fill('#n-a', a);
  await p.fill('#n-b', b);
  await p.click('[data-go="start"]');
  await p.fill('#sd', start);
  await p.click('[data-go="done"]');
  await p.click('[data-go="finish"]');
  await p.waitForTimeout(1500);
}

// EXIF-Block (Aufnahmedatum + GPS) für Testbilder
function exifSegment(date, lat, lng) {
  const t = Buffer.alloc(178);
  t.write('II', 0); t.writeUInt16LE(42, 2); t.writeUInt32LE(8, 4);
  const entry = (off, tag, type, count, val) => { t.writeUInt16LE(tag, off); t.writeUInt16LE(type, off + 2); t.writeUInt32LE(count, off + 4); t.writeUInt32LE(val, off + 8); };
  t.writeUInt16LE(2, 8); entry(10, 0x8769, 4, 1, 38); entry(22, 0x8825, 4, 1, 76); t.writeUInt32LE(0, 34);
  t.writeUInt16LE(1, 38); entry(40, 0x9003, 2, 20, 56); t.writeUInt32LE(0, 52);
  t.write(`${date}\0`, 56, 'ascii');
  t.writeUInt16LE(4, 76);
  const dms = (v) => { v = Math.abs(v); const d = Math.floor(v); const m = Math.floor((v - d) * 60); const s = Math.round(((v - d) * 60 - m) * 60 * 100); return [[d, 1], [m, 1], [s, 100]]; };
  entry(78, 1, 2, 2, 0); t.write(lat >= 0 ? 'N' : 'S', 86, 'ascii');
  entry(90, 2, 5, 3, 130);
  entry(102, 3, 2, 2, 0); t.write(lng >= 0 ? 'E' : 'W', 110, 'ascii');
  entry(114, 4, 5, 3, 154); t.writeUInt32LE(0, 126);
  dms(lat).forEach(([n, d], i) => { t.writeUInt32LE(n, 130 + i * 8); t.writeUInt32LE(d, 134 + i * 8); });
  dms(lng).forEach(([n, d], i) => { t.writeUInt32LE(n, 154 + i * 8); t.writeUInt32LE(d, 158 + i * 8); });
  const head = Buffer.from([0xff, 0xe1, 0, 0]);
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), t]);
  head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([head, body]);
}

const IMAGE_SPECS = {
  paris: ['#1e293b', '#f59e0b', 'Paris'],
  pizza: ['#7c2d12', '#facc15', 'Pizza'],
  beach: ['#0369a1', '#fde68a', 'Strand'],
  concert: ['#312e81', '#ec4899', 'Live'],
  sunset: ['#4c1d95', '#fb923c', 'Abend'],
  us: ['#14532d', '#a3e635', 'Wir'],
};

/** Testbilder im Browser zeichnen und als JPEG-Dateien ablegen. */
async function makeImages(app, { exif = {} } = {}) {
  const data = await app.p.evaluate(async (specs) => {
    const out = {};
    for (const [k, [c1, c2, label]] of Object.entries(specs)) {
      const c = document.createElement('canvas');
      c.width = 1200; c.height = 900;
      const g = c.getContext('2d');
      const grad = g.createLinearGradient(0, 0, 1200, 900);
      grad.addColorStop(0, c1); grad.addColorStop(1, c2);
      g.fillStyle = grad; g.fillRect(0, 0, 1200, 900);
      g.globalAlpha = 0.22; g.fillStyle = '#fff';
      for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(120 + i * 125, 430 + Math.sin(i * 1.7) * 220, 50 + i * 9, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1; g.fillStyle = 'rgba(255,255,255,.92)'; g.font = 'bold 120px sans-serif'; g.fillText(label, 70, 830);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
      out[k] = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
    }
    return out;
  }, IMAGE_SPECS);
  const images = {};
  for (const [k, b64] of Object.entries(data)) {
    let buf = Buffer.from(b64, 'base64');
    if (exif[k]) buf = Buffer.concat([buf.subarray(0, 2), exifSegment(...exif[k]), buf.subarray(2)]);
    const file = path.join(TMP, `${k}.jpg`);
    fs.writeFileSync(file, buf);
    images[k] = { path: file, b64: buf.toString('base64') };
  }
  return images;
}

/** Realistische Beispieldaten (Erlebnisse, Reisen, Termine …) direkt über den Store anlegen. */
async function seed(app, images) {
  const b64 = Object.fromEntries(Object.entries(images).map(([k, v]) => [k, v.b64]));
  await app.p.evaluate(async (images) => {
    const S = await import('./js/store.js');
    const P = await import('./js/photos.js');
    const M = await import('./js/model.js');
    const file = (k) => new File([Uint8Array.from(atob(images[k]), (c) => c.charCodeAt(0))], `${k}.jpg`, { type: 'image/jpeg' });
    const photos = async (keys, entryId, date = null) => (await P.commitPhotos(await P.processFiles(keys.map(file)), entryId, date)).map((x) => x.id);
    await S.saveSettings({ birthdays: { a: '1998-12-03', b: '1999-04-21' }, home: { name: 'München', label: 'Bayern, Deutschland', city: 'München', lat: 48.1351, lng: 11.582, country: 'Deutschland', countryCode: 'DE' } });
    const pl = (name, city, cc, country, lat, lng) => ({ name, label: city === name ? country : `${city}, ${country}`, city, lat, lng, country, countryCode: cc });
    const R = (a, b, ca = '', cb = '') => ({ a: { value: a, comment: ca }, b: { value: b, comment: cb } });
    const E = async (category, title, date, place, ratings, extra = {}, more = {}, imgs = []) => {
      const id = S.uuid();
      const photoIds = imgs.length ? await photos(imgs, id, date) : [];
      await S.save('entry', { category, title, date, endDate: more.endDate || null, place, ratings, notes: more.notes || '', favorite: !!more.favorite, extra, photoIds, coverId: photoIds[0] || null }, { id });
      return id;
    };
    await E('trip', 'Rom', '2023-05-02', pl('Rom', 'Rom', 'IT', 'Italien', 41.9028, 12.4964), R(5, 4.5, 'Gelato jeden Tag'), { transport: '✈️ Flug', highlights: 'Sonnenuntergang auf der Spanischen Treppe' }, { endDate: '2023-05-06', favorite: true }, ['sunset']);
    await E('trip', 'Lissabon', '2024-09-10', pl('Lissabon', 'Lissabon', 'PT', 'Portugal', 38.7223, -9.1393), R(4.5, 5), { transport: '✈️ Flug' }, { endDate: '2024-09-15' }, ['beach', 'sunset']);
    await E('trip', 'Paris', '2022-06-14', pl('Paris', 'Paris', 'FR', 'Frankreich', 48.8566, 2.3522), R(5, 5, 'Eiffelturm bei Nacht'), { transport: '🚆 Zug' }, { endDate: '2022-06-18', favorite: true }, ['paris']);
    await E('food', 'Trattoria Da Mario', '2026-09-27', pl('Trattoria Da Mario', 'München', 'DE', 'Deutschland', 48.137, 11.575), R(4.5, 5, 'Beste Pasta der Stadt'), { meal: '🍷 Abendessen', cuisine: 'Italienisch', dish: 'Trüffel-Tagliatelle', price: '3', again: 'yes' }, {}, ['pizza']);
    await E('trip', 'New York City', '2025-04-02', pl('New York', 'New York', 'US', 'Vereinigte Staaten', 40.7128, -74.006), R(5, 5, '', 'Blick vom Rockefeller Center'), { transport: '✈️ Flug' }, { endDate: '2025-04-09', favorite: true });
    await E('trip', 'Bali', '2023-12-20', pl('Ubud', 'Ubud', 'ID', 'Indonesien', -8.5069, 115.2625), R(5, 4.5), { transport: '✈️ Flug' }, { endDate: '2024-01-03' });
    await E('trip', 'Kopenhagen', '2022-08-12', pl('Kopenhagen', 'Kopenhagen', 'DK', 'Dänemark', 55.6761, 12.5683), R(4, 4.5), { transport: '🚆 Zug' }, { endDate: '2022-08-14' });
    await E('trip', 'Wien', '2026-02-14', pl('Wien', 'Wien', 'AT', 'Österreich', 48.2082, 16.3738), R(4.5, 4), { transport: '🚆 Zug' }, { endDate: '2026-02-16' });
    await E('date', 'Sterne gucken am See', '2025-08-12', pl('Starnberger See', 'Starnberg', 'DE', 'Deutschland', 47.95, 11.33), R(5, 5, 'Sternschnuppe gesehen'), { mood: '🌙 Romantisch' }, { favorite: true, notes: 'Decke, Wein und die Perseiden.' });
    await E('date', 'Kochabend zu Hause', '2026-10-24', null, R(4, 4.5), { mood: '🥰 Gemütlich', cost: '25' }, {});
    await E('activity', 'Coldplay im Olympiastadion', '2024-07-22', pl('Olympiastadion', 'München', 'DE', 'Deutschland', 48.1731, 11.5466), R(5, 5), { mood: '🤩 Aufregend', cost: '180' }, {}, ['concert']);
    await E('activity', 'Ski-Wochenende', '2025-02-01', pl('Garmisch-Partenkirchen', 'Garmisch-Partenkirchen', 'DE', 'Deutschland', 47.4917, 11.0955), R(3.5, 4.5, 'Muskelkater'), { mood: '😂 Lustig' });
    await E('food', 'Sushi Omakase', '2025-10-03', pl('Sushi Sano', 'München', 'DE', 'Deutschland', 48.13, 11.57), R(4.5, 4), { meal: '🍷 Abendessen', cuisine: 'Japanisch', price: '4', again: 'yes' });
    await E('food', 'Brunch im Café Glück', '2026-06-07', pl('Café Glück', 'München', 'DE', 'Deutschland', 48.15, 11.58), R(3.5, 4), { meal: '🥐 Frühstück', price: '2', again: 'maybe' });
    await E('food', 'Burgerladen am Eck', '2026-03-03', pl('Burgerladen', 'München', 'DE', 'Deutschland', 48.14, 11.56), R(2, 4, 'Zu trocken', 'Pommes top'), { meal: '🍷 Abendessen', cuisine: 'Amerikanisch', price: '2', again: 'no' });
    await E('recipe', 'Pasta Aglio e Olio', '2026-10-30', null, R(5, 4), { cook: 'both', course: '🍝 Hauptgericht', time: '20', servings: '2', difficulty: '🙂 Einfach', ingredients: '200 g Spaghetti\n3 Knoblauchzehen\n1/2 TL Chiliflocken\n4 EL Olivenöl', steps: 'Spaghetti kochen\nKnoblauch in Öl anbraten\nAlles mischen', again: 'yes' }, { favorite: true }, ['pizza']);
    await E('gift', 'Polaroid-Kamera', '2024-11-08', null, R(5, null, 'Beste Überraschung'), { from: 'b', occasion: '🎂 Geburtstag' }, { favorite: true });
    await E('gift', 'Selbstgemachtes Fotobuch', '2025-03-12', null, R(null, 5), { from: 'a', occasion: '💞 Jahrestag', handmade: true });
    await E('gift', 'Konzertkarten', '2024-04-21', null, R(null, 5), { from: 'a', occasion: '🎂 Geburtstag', cost: '180' });
    const ms = async (emoji, title, date, text, imgs = []) => S.save('milestone', { emoji, title, date, text, photoIds: imgs.length ? await photos(imgs, null, date) : [] });
    await ms('☕️', 'Erstes Date', '2022-03-12', 'Kaffee, der kalt wurde, weil wir nicht aufhören konnten zu reden.');
    await ms('🏡', 'Zusammengezogen', '2024-04-01', 'Erste gemeinsame Wohnung – mit viel zu vielen Kartons.', ['us']);
    await ms('🐶', 'Luna zieht ein', '2025-06-15', 'Ab jetzt sind wir zu dritt.');
    await S.save('wish', { title: 'Polarlichter in Norwegen', category: 'trip', note: 'Am liebsten im Glas-Iglu', done: false });
    await S.save('wish', { title: 'Kochkurs in der Toskana', category: 'food', note: '', done: false });
    await S.save('wish', { title: 'Heißluftballon fahren', category: 'activity', note: '', done: true, doneAt: '2025-07-05' });
    await S.save('wish', { title: 'Salsa tanzen lernen', category: 'date', note: '', done: false });
    await S.save('letter', { from: 'b', to: 'a', text: 'Hey du,\n\ndanke für die letzten Jahre. Auf alles, was noch kommt.', openAt: null });
    await S.save('letter', { from: 'a', to: 'b', text: 'Für unseren 5. Jahrestag …', openAt: '2027-03-12' });
    await photos(['us'], null);
    const rel = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return M.isoDate(d); };
    const nextFri = (() => { const d = new Date(); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7)); return M.isoDate(d); })();
    const EV = (data) => S.save('event', { allDay: false, repeat: 'none', exdates: [], reminder: 60, notes: '', place: null, rsvp: { a: 'yes' }, entries: {}, ...data });
    await EV({ title: 'Sushi & Kino', category: 'date', date: rel(1), time: '19:30', endDate: rel(1), endTime: '23:00', place: pl('Mathäser Filmpalast', 'München', 'DE', 'Deutschland', 48.1395, 11.5626), rsvp: { a: 'yes', b: 'yes' }, notes: 'Tisch um 19:30 reserviert, Film um 21:00' });
    await EV({ title: 'Date-Night', category: 'date', date: nextFri, time: '20:00', endDate: nextFri, endTime: '23:00', repeat: 'weekly', rsvp: { a: 'yes', b: 'yes' } });
    await EV({ title: 'Abendessen bei Mias Eltern', category: 'people', date: rel(4), time: '18:00', endDate: rel(4), endTime: '21:30', rsvp: { a: 'yes' } });
    await EV({ title: 'Wochenende in Wien', category: 'trip', allDay: true, date: rel(12), endDate: rel(14), time: null, endTime: null, reminder: 1440, place: pl('Wien', 'Wien', 'AT', 'Österreich', 48.2082, 16.3738), rsvp: { a: 'yes', b: 'maybe' } });
    await EV({ title: 'Bowling mit Freunden', category: 'activity', date: rel(-3), time: '20:00', endDate: rel(-3), endTime: '22:30', rsvp: { a: 'yes', b: 'yes' } });
    await EV({ title: 'Zahnarzt', category: 'other', date: rel(6), time: '08:30', endDate: rel(6), endTime: '09:15', reminder: 60, rsvp: { a: 'yes', b: 'no' } });
    // Die Beispieldaten gelten als schon bekannt → keine Freischalt-Meldung beim nächsten Öffnen
    const A = await import('./js/views/awards.js');
    await S.setDevice({ seenAch: Object.fromEntries(A.currentResults().results.map((r) => [r.def.id, r.tier])) });
  }, b64);
  await app.p.waitForTimeout(800);
}

module.exports = { startServer, makeChecker, openApp, onboard, makeImages, seed, exifSegment, ROOT, TMP, SHOTS };
