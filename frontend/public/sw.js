/**
 * Service worker for the citizen PWA.
 *
 * Scope of what this is allowed to do, because getting it wrong in a warning system is worse
 * than having no offline support at all:
 *
 *   CACHED      the app shell -- the HTML document, the hashed JS/CSS bundles, icons, fonts.
 *               These are safe to serve stale: they are code, not readings.
 *
 *   NEVER       anything under /api, and any cross-origin request to the backend. A cached
 *   CACHED      risk score would show a villager "SAFE / 12" from an hour ago as if it were
 *               current. When the network is down the app must fail loudly instead: the
 *               citizen screen shows its offline banner and says the data is old.
 *
 * Navigations are network-first so a live visit always gets the newest shell, falling back to
 * the cached document when offline. Static assets are cache-first (they are content-hashed by
 * Vite, so a changed file has a new URL and can never be served stale).
 */

const CACHE = 'drainguard-shell-v1';
const SHELL = ['/', '/citizen', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Individually, so one 404 (an icon renamed, say) cannot fail the whole install.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Backend traffic is never touched -- neither the REST API nor the risk WebSocket upgrade.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) return;

  // Navigation: network first, cached shell as the offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return resp;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          // Any citizen deep link falls back to the cached shell; the router takes it from there.
          return cached || (await caches.match('/citizen')) || (await caches.match('/'));
        })
    );
    return;
  }

  // Hashed static assets: cache first, then fill the cache on the way back.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((resp) => {
          if (resp.ok && resp.type === 'basic') {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return resp;
        })
    )
  );
});
