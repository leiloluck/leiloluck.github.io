/* sw.js — Meditation Timer service worker (offline-first)
   App shell: cache-first — boots and runs with zero network once installed. Freshness
   comes from the SW lifecycle: bump VERSION → new cache precached → it takes over and
   the page reloads once (see js/app.js). The in-app Update button is the manual jump.
   Audio (.mp3): NOT precached (the soundtrack is ~44 MB). Streamed on first load via
   native range requests; served from cache once fully downloaded (the "Download for
   offline" button fetches the whole file so it works without a connection). */

'use strict';

const VERSION = 'v26.06.19';
const CACHE   = `meditation-timer-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
];

// ── Install: pre-cache app shell ─────────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: evict old caches ───────────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('.mp3')) {
    event.respondWith(serveAudio(request));
    return;
  }

  event.respondWith(serveShell(request));
});

// Cache-first for the app shell: instant, works fully offline. On a miss we fetch and
// cache (so anything not precached still becomes available offline after one online
// load). Navigations fall back to the cached shell so the app always opens.
async function serveShell(request) {
  const cache = await caches.open(CACHE);

  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // Offline navigation to an uncached path → fall back to the cached app shell.
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    return new Response('Offline — content not cached.', { status: 503 });
  }
}

// Audio strategy:
// - If a full response is already cached: serve it. Browsers accept 200 in place
//   of 206 for <audio loop>, which avoids the Cache API / range-request mismatch.
// - If not cached AND this is a range request: let it through to the network so
//   the browser can stream naturally without downloading the full 44 MB first.
// - If not cached AND this is a full request (e.g. "Download for offline" button):
//   fetch, cache the 200 response, return it.
async function serveAudio(request) {
  const cache = await caches.open(CACHE);
  const cacheKey = new Request(request.url); // no Range header — match the stored full response

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const isRange = request.headers.has('range');

  try {
    if (isRange) {
      // Pass range request through natively — browser handles streaming
      return await fetch(request);
    }

    // Full request (no Range header): fetch, cache, return
    const response = await fetch(cacheKey);
    if (response.status === 200) {
      cache.put(cacheKey, response.clone());
    }
    return response;
  } catch {
    return new Response('Audio not available offline.', { status: 503 });
  }
}

// Lets the in-app Update flow activate a freshly installed worker immediately.
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
