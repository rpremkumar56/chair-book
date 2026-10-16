/* BookAssist service worker: the site opens without internet. Data calls always go to the network.
   build.py replaces 2026.10.16-0753-352190c, so every deploy gets a new cache and the old cache is deleted. */
const CACHE = 'bookassist-2026.10.16-0753-352190c';
const SHELL = ['./', './index.html', './manifest.json', './icon.svg', './icon-192.png', './supabase.min.js'];
self.addEventListener('install', e => {
  // cache: 'reload' skips the browser HTTP cache, so the new cache gets the new files.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const keep = (req, res) => { if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; };
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  // Never touch the database (Supabase) or non-GET calls.
  if (req.method !== 'GET' || url.hostname.endsWith('supabase.co')) return;
  if (url.origin === location.origin) {
    // version.json tells the app that a new deploy exists: always from the network, never cached.
    if (url.pathname.endsWith('/version.json')) { e.respondWith(fetch(req.url, { cache: 'no-store' })); return; }
    // The page: network first, so updates arrive; the cached copy when offline.
    if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) {
      // fetch(req.url): a navigate Request cannot take an init object.
      e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(r => keep(req, r))
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
      return;
    }
    // Other site files (library, icons, manifest): cache first. The cache changes with each deploy.
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => keep(req, res))));
  } else {
    // Fonts and the CDN copy of the database library: cache after first use.
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => keep(req, res))));
  }
});
