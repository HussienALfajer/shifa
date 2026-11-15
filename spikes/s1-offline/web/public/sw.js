// App-shell service worker: a reload or browser restart opens the prototype offline. Same-origin
// GETs outside the API are cached as they load (network first, cache when the network fails).
// API calls (commands, pull, auth, PowerSync) are never cached.
const CACHE = 's1-shell-v1';
const API = ['/auth', '/commands', '/sync', '/report', '/powersync', '/.well-known'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(['/', '/index.html']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (API.some((p) => url.pathname.startsWith(p))) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => {
        const hit = await caches.match(event.request);
        if (hit) return hit;
        if (event.request.mode === 'navigate') {
          const shell = await caches.match('/index.html');
          if (shell) return shell;
        }
        return new Response('offline', { status: 503 });
      }),
  );
});
