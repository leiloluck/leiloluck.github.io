/* sw.js — Meditation Timer service worker
   App shell: cache-first (pre-cached on install).
   Audio (.mp3): native streaming on first load; served from cache once downloaded.
   Explicitly avoids intercepting range requests before caching, so the browser
   can stream the file naturally without buffering the whole 44 MB first. */

'use strict';

const VERSION = 'v4';
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
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('.mp3')) {
    event.respondWith(serveAudio(request));
    return;
  }

  event.respondWith(serveShell(request));
});

// Stale-while-revalidate for app shell
async function serveShell(request) {
  const cache = await caches.open(CACHE);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => {
    // Ignore offline errors
  });

  return cachedResponse || fetchPromise || new Response('Offline — content not cached.', { status: 503 });
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
