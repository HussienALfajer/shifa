// The display's service worker (criterion 7, VOX-11): precaches the pack named in its URL
// (`sw.js?pack=<dir>`) into a cache per packVersion and answers every same-origin GET cache-first,
// so the page and its pack load with the network off. No third-party SW library.
// `?network=1` bypasses the cache (the page's VOX-11 manifest diff). Best effort: a missing pack
// never blocks install, the page then falls back to chime and flash.
declare const self: ServiceWorkerGlobalScope;

const PACK_PREFIX = 's6-pack-';
const packParam = new URL(self.location.href).searchParams.get('pack') ?? 'pack';
// Same-origin folder names only (the page applies the same rule).
const packDir = /^[a-z0-9-]{1,40}$/u.test(packParam) ? packParam : 'invalid-pack';

interface PackManifest {
  packVersion: string;
  clips: { file: string; status: string }[];
}

async function precachePack(): Promise<void> {
  const manifestUrl = new URL(`/${packDir}/manifest.json`, self.location.origin).href;
  const res = await fetch(manifestUrl, { cache: 'no-store' });
  if (!res.ok) return;
  const manifest = (await res.clone().json()) as PackManifest;
  const cache = await caches.open(`${PACK_PREFIX}${manifest.packVersion}`);
  await cache.put(manifestUrl, res);
  const urls = manifest.clips
    .filter((c) => c.status === 'ok')
    .map((c) => new URL(`/${packDir}/${c.file}`, self.location.origin).href);
  const missing: string[] = [];
  for (const url of urls) if (!(await cache.match(url))) missing.push(url);
  await cache.addAll(missing);
  // Older pack versions go once the new one is complete.
  for (const key of await caches.keys()) {
    if (key.startsWith(PACK_PREFIX) && key !== `${PACK_PREFIX}${manifest.packVersion}`) {
      await caches.delete(key);
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    precachePack()
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

async function cacheFirst(request: Request): Promise<Response> {
  const hit = await caches.match(request, {
    ignoreSearch: request.mode === 'navigate',
    ignoreVary: true,
  });
  if (hit) return hit;
  const res = await fetch(request);
  // A pack clip the install-time precache missed (a network blip) is stored now, so the pack
  // still becomes complete offline without a new service worker.
  const path = new URL(request.url).pathname;
  if (res.ok && path.startsWith(`/${packDir}/`) && path.endsWith('.wav')) {
    const packCache = (await caches.keys()).find((k) => k.startsWith(PACK_PREFIX));
    if (packCache) await (await caches.open(packCache)).put(request, res.clone());
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.searchParams.get('network') === '1') return; // straight to the network
  event.respondWith(cacheFirst(event.request));
});
