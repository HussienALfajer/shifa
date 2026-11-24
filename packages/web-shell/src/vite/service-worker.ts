// The apps' service worker (slice A-01-06, ADR-0010): the app shell only. Written by hand, not by
// Workbox: a dozen lines whose whole behaviour a test can read. It precaches the build's files
// at install, answers navigations network-first with the cached index.html as the fallback, and
// answers precached files from the cache. It never answers /api, another origin, a write, or a
// file it did not precache, and it never stores a response (offline data is A-05).
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

/** The precache: every emitted file but source maps, the worker itself and anything under api/. */
export function precacheList(files: readonly string[]): string[] {
  return files
    .filter((f) => f !== 'sw.js' && !f.endsWith('.map') && !/^api(?:\/|$)/.test(f))
    .map((f) => `/${f}`)
    .sort();
}

export function serviceWorkerSource(files: readonly string[], version: string): string {
  const precache = precacheList(files);
  return `// Generated at build by @shifa/web-shell (app shell only, no runtime caching).
const CACHE = ${JSON.stringify(`shifa-shell-${version}`)};
const PRECACHE = ${JSON.stringify(precache)};
const PRECACHED = new Set(PRECACHE);
const SHELL = '/index.html';
const API = '/api';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith('shifa-shell-') && k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// A cache can be evicted or refuse access: every answer settles, a miss as a network error.
const fromCache = (path) =>
  Promise.resolve()
    .then(() => caches.open(CACHE))
    .then((cache) => cache.match(path))
    .catch(() => undefined);
const failed = () => (typeof Response === 'function' ? Response.error() : undefined);

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === API || url.pathname.startsWith(API + '/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => fromCache(SHELL))
        .then((answer) => answer || failed()),
    );
    return;
  }
  if (PRECACHED.has(url.pathname)) {
    event.respondWith(
      fromCache(url.pathname)
        .then((hit) => hit || fetch(request))
        .catch(failed),
    );
  }
});
`;
}

/** Emits `sw.js` next to the build's files (build only; no worker in development). */
export function shellServiceWorker(): Plugin {
  return {
    name: 'shifa-shell-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle);
      const version = createHash('sha256')
        .update(precacheList(files).join('\n'))
        .digest('hex')
        .slice(0, 16);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: serviceWorkerSource(files, version),
      });
    },
  };
}
