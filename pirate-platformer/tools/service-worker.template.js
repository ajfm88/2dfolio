// Coral Corsairs service worker. tools/pwa-plugin.mjs copies this into
// dist/sw.js at build time and replaces the two placeholders. Not imported by src/.
const VERSION = '__CC_VERSION__';
const PRECACHE = __CC_PRECACHE__;
const CACHE_PREFIX = 'cc-';
const CACHE = CACHE_PREFIX + VERSION;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  // The game is one page: every navigation, with or without ?perf, gets the
  // cached shell.
  const key = request.mode === 'navigate' ? '/index.html' : request;
  // The precache holds one response per URL, and a server's Vary: Origin must not hide it from a crossorigin request.
  event.respondWith(caches.match(key, { ignoreVary: true }).then((hit) => hit || fetch(request)));
});
