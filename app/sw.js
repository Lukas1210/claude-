// Service Worker: macht die App offline-fähig und schnell.
// __BUILD__ wird beim Deploy durch die Commit-ID ersetzt, damit Updates erkannt werden.
const BUILD = '__BUILD__';
const CACHE = `cj-${BUILD}`;

// App-Hülle: wird bei der Installation vollständig geladen
const CORE = [
  './',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon.svg',
  'assets/geo/countries-110m.json',
  'config.js',
  'css/app.css',
  'index.html',
  'js/db.js',
  'js/events.js',
  'js/exif.js',
  'js/geo.js',
  'js/main.js',
  'js/model.js',
  'js/photos.js',
  'js/router.js',
  'js/store.js',
  'js/sync.js',
  'js/theme.js',
  'js/ui/components.js',
  'js/ui/dom.js',
  'js/ui/fx.js',
  'js/ui/icons.js',
  'js/ui/place-picker.js',
  'js/ui/sheet.js',
  'js/views/bucket.js',
  'js/views/calendar.js',
  'js/views/entries.js',
  'js/views/entry-detail.js',
  'js/views/entry-form.js',
  'js/views/event-detail.js',
  'js/views/event-form.js',
  'js/views/gallery.js',
  'js/views/globe.js',
  'js/views/home.js',
  'js/views/letters.js',
  'js/views/onboarding.js',
  'js/views/photo-viewer.js',
  'js/views/settings.js',
  'js/views/stats.js',
  'js/views/timeline.js',
  'manifest.webmanifest',
  'vendor/d3-array.min.js',
  'vendor/d3-geo.min.js',
  'vendor/topojson-client.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE.map((u) => new Request(u, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('cj-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, OpenStreetMap: immer direkt ins Netz

  // Seitenaufrufe: App-Hülle aus dem Cache
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match('./') || await cache.match('index.html');
      if (cached) return cached;
      return fetch(req);
    })());
    return;
  }

  // config.js: Netz zuerst (damit neue Zugangsdaten greifen), offline aus dem Cache
  if (url.pathname.endsWith('/config.js')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req, { cache: 'no-store' });
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return (await cache.match(req)) || Response.error();
      }
    })());
    return;
  }

  // Alles andere: Cache zuerst, sonst laden und für später merken
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  })());
});
