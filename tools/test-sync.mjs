// Testet die Sync-Logik mit zwei simulierten iPhones (zwei Browser-Kontexte mit
// eigener IndexedDB) gegen ein Fake-Backend im Speicher – ganz ohne Supabase.
// Aufruf: node tools/test-sync.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

// ---------- Statischer Server ----------
const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = join(root, path);
    if (!file.startsWith(root)) throw new Error('forbidden');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end();
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/`;

// ---------- Fake-Backend (verhält sich wie die Supabase-Tabelle "items") ----------
const rows = new Map();
const storage = new Map();
let clock = Date.now() * 1000;
const micros = (ts) => {
  const m = /^(.*?)(?:\.(\d+))?(Z|[+-]\d\d:\d\d)$/.exec(ts);
  const frac = (m[2] || '').padEnd(6, '0').slice(0, 6);
  return Date.parse(`${m[1]}${m[3]}`) * 1000 + Number(frac);
};
const fmt = (us) => `${new Date(Math.floor(us / 1000)).toISOString().slice(0, 19)}.${String(us % 1000000).padStart(6, '0')}+00:00`;
const backend = {
  push([list, uid]) {
    clock += 1000;
    const ts = fmt(clock); // alle Zeilen eines Aufrufs mit gleicher Zeit -> testet Gleichstand beim Blättern
    return list.map((r) => { rows.set(r.id, { ...r, updated_at: ts, updated_by: uid }); return { id: r.id, updated_at: ts }; });
  },
  pull([afterTs, afterId, limit]) {
    const a = afterTs ? micros(afterTs) : null;
    return [...rows.values()]
      .sort((x, y) => micros(x.updated_at) - micros(y.updated_at) || x.id.localeCompare(y.id))
      .filter((r) => {
        if (a == null) return true;
        const u = micros(r.updated_at);
        return afterId ? u > a || (u === a && r.id > afterId) : u > a;
      })
      .slice(0, limit);
  },
  upload([id, size, b64]) { storage.set(`${id}/${size}`, b64); return true; },
  download([id, size]) { return storage.get(`${id}/${size}`) || null; },
  remove([id]) { storage.delete(`${id}/full`); storage.delete(`${id}/thumb`); return true; },
};

// ---------- Geräte ----------
const browser = await chromium.launch();
async function device(uid) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
  await ctx.exposeBinding('fakeBE', (_src, op, args) => backend[op](args));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`[${uid}]`, e.message));
  await page.goto(base);
  await page.waitForTimeout(500);
  await page.evaluate((uid) => {
    window.__uid = uid;
    const b64 = (blob) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(String(f.result).split(',')[1]); f.readAsDataURL(blob); });
    window.__be = {
      userId: async () => window.__uid,
      push: (list) => window.fakeBE('push', [list, window.__uid]),
      pull: (a, b, c) => window.fakeBE('pull', [a, b, c]),
      uploadPhoto: async (id, size, blob) => window.fakeBE('upload', [id, size, await b64(blob)]),
      downloadPhoto: async (id, size) => {
        const d = await window.fakeBE('download', [id, size]);
        return d ? new Blob([Uint8Array.from(atob(d), (c) => c.charCodeAt(0))], { type: 'image/jpeg' }) : null;
      },
      removePhoto: (id) => window.fakeBE('remove', [id]),
    };
  }, uid);
  await page.evaluate(async () => (await import('./js/photos.js')).setRemoteFetcher((id, size) => window.__be.downloadPhoto(id, size)));
  return {
    page,
    sync: () => page.evaluate(async () => { const r = await (await import('./js/sync.js')).syncWith(window.__be); return { pushed: r.pushed, fromPartner: r.fromPartner.length }; }),
    run: (fn, arg) => page.evaluate(fn, arg),
  };
}

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` (${extra})` : ''}`); if (!ok) failed++; };

const A = await device('user-a');
const B = await device('user-b');

// 1) A legt Einstellungen, ein Erlebnis und ein Foto an
const entryId = await A.run(async () => {
  const S = await import('./js/store.js');
  const P = await import('./js/photos.js');
  await S.setDevice({ me: 'a', onboarded: true });
  await S.saveSettings({ names: { a: 'Lukas', b: 'Mia' }, startDate: '2022-03-12' });
  const c = document.createElement('canvas'); c.width = 800; c.height = 600;
  const g = c.getContext('2d'); g.fillStyle = '#ff8fa3'; g.fillRect(0, 0, 800, 600);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
  const id = S.uuid();
  const pend = await P.processFiles([new File([blob], 'x.jpg', { type: 'image/jpeg' })]);
  const ph = await P.commitPhotos(pend, id, '2024-06-14');
  await S.save('entry', { category: 'trip', title: 'Paris', date: '2024-06-14', ratings: { a: { value: 5, comment: '' } }, photoIds: ph.map((p) => p.id) }, { id });
  return id;
});
let r = await A.sync();
check('A lädt hoch', r.pushed >= 3, `${r.pushed} Einträge`);
check('Foto liegt im Speicher', storage.size === 2);
const photoUploaded = await A.run(async () => (await import('./js/store.js')).all('photo')[0].data.uploaded);
check('Foto als hochgeladen markiert', photoUploaded === true);

// 2) B synchronisiert und sieht alles
r = await B.sync();
const bState = await B.run(async (id) => {
  const S = await import('./js/store.js');
  const P = await import('./js/photos.js');
  const e = S.get(id);
  const blob = e ? await P.getBlob(e.data.photoIds[0], 'thumb') : null;
  return { names: S.settings().names, title: e?.data.title, thumb: blob ? blob.size : 0 };
}, entryId);
check('B erhält Einstellungen', bState.names.a === 'Lukas' && bState.names.b === 'Mia');
check('B erhält Erlebnis', bState.title === 'Paris');
check('B lädt Foto bei Bedarf', bState.thumb > 0, `${bState.thumb} Bytes`);
check('B meldet neue Inhalte vom Partner', r.fromPartner >= 3, `${r.fromPartner}`);

// 3) B bewertet, A sieht die Bewertung
await B.run(async (id) => {
  const S = await import('./js/store.js');
  await S.setDevice({ me: 'b', onboarded: true });
  const e = S.get(id);
  await S.update(id, { ratings: { ...e.data.ratings, b: { value: 4.5, comment: 'Traumhaft' } } });
}, entryId);
await B.sync();
await A.sync();
const aRating = await A.run(async (id) => (await import('./js/store.js')).get(id).data.ratings.b?.value, entryId);
check('A sieht Bewertung von B', aRating === 4.5);

// 4) Konflikt: beide ändern offline den Titel – zuletzt hochgeladen gewinnt, beide gleich
await A.run(async (id) => (await import('./js/store.js')).update(id, { title: 'Paris (A)' }), entryId);
await B.run(async (id) => (await import('./js/store.js')).update(id, { title: 'Paris (B)' }), entryId);
await A.sync();
await B.sync();
await A.sync();
const tA = await A.run(async (id) => (await import('./js/store.js')).get(id).data.title, entryId);
const tB = await B.run(async (id) => (await import('./js/store.js')).get(id).data.title, entryId);
check('Konflikt: beide Geräte gleich', tA === tB, `${tA} / ${tB}`);

// 5) Löschen wird übertragen, Foto-Dateien werden entfernt
await A.run(async (id) => {
  const S = await import('./js/store.js');
  const P = await import('./js/photos.js');
  const e = S.get(id);
  await P.deletePhotos(e.data.photoIds);
  await S.remove(id);
}, entryId);
await A.sync();
await B.sync();
const bGone = await B.run(async (id) => { const S = await import('./js/store.js'); return !S.get(id) && S.all('photo').length === 0; }, entryId);
check('Löschung kommt bei B an', bGone);
check('Foto-Dateien entfernt', storage.size === 0);

// 6) Viele Einträge (Blättern mit gleichen Zeitstempeln)
await A.run(async () => {
  const S = await import('./js/store.js');
  await S.saveMany(Array.from({ length: 1234 }, (_, i) => ({ type: 'wish', data: { title: `Wunsch ${i}`, category: 'other', done: false } })));
});
await A.sync();
await B.sync();
const nB = await B.run(async () => (await import('./js/store.js')).all('wish').length);
check('1234 Wünsche vollständig übertragen', nB === 1234, `${nB}`);
const dirtyLeft = await A.run(async () => (await import('./js/store.js')).dirtyItems().length);
check('Keine offenen Änderungen nach Sync', dirtyLeft === 0, `${dirtyLeft}`);

// 7) Termin: A plant, B sagt zu, A sieht die Zusage
const evId = await A.run(async () => (await (await import('./js/store.js')).save('event', { title: 'Kino', category: 'date', date: '2026-12-01', time: '20:00', endDate: '2026-12-01', endTime: '22:30', allDay: false, repeat: 'weekly', rsvp: { a: 'yes' }, entries: {} })).id);
await A.sync();
r = await B.sync();
check('B erhält Termin', r.fromPartner === 1 && (await B.run(async (id) => (await import('./js/store.js')).get(id)?.data.title, evId)) === 'Kino');
await B.run(async (id) => { const S = await import('./js/store.js'); const e = S.get(id); await S.update(id, { rsvp: { ...e.data.rsvp, b: 'yes' } }); }, evId);
await B.sync();
await A.sync();
check('A sieht Zusage von B', (await A.run(async (id) => (await import('./js/store.js')).get(id).data.rsvp.b, evId)) === 'yes');

// 8) Zweiter Sync ohne Änderungen überträgt nichts
r = await B.sync();
check('Leerlauf-Sync überträgt nichts', r.pushed === 0 && r.fromPartner === 0, JSON.stringify(r));

await browser.close();
server.close();
console.log(failed ? `\n${failed} Test(s) fehlgeschlagen` : '\nAlle Sync-Tests bestanden ♡');
process.exit(failed ? 1 : 0);
