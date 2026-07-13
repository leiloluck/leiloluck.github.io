/* sw.js — SoundAnnoyer service worker (offline-first)
   Once installed the app must run with ZERO network. So on install we precache the
   whole shell, the icons, AND every sound, and every same-origin request is served
   cache-first. Freshness comes from the SW lifecycle, not from hitting the network on
   each launch: bump VERSION → new cache precached in the background → it takes over and
   the page reloads once (see js/app.js). The in-app Update button is the manual jump to
   newest. Missing/renamed mp3s can't break install — sounds are added best-effort. */

'use strict';

const VERSION = 'v26.07.13c';
const CACHE   = `sound-annoyer-${VERSION}`;

// Critical app shell — install fails (and retries) if any of these can't be cached.
const SHELL = [
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

// Sounds — precached so the app is fully playable offline immediately. Added
// best-effort: a file that's been renamed/removed must not block the install.
const SOUNDS = [
  './resources/cat-meow.mp3',
  './resources/dog-bark.mp3',
  './resources/mouse-squeak.mp3',
  './resources/bird-chirp.mp3',
  './resources/morning-birds.mp3',
  './resources/crickets.mp3',
  './resources/mosquito.mp3',
  './resources/sneeze.mp3',
  './resources/crowd-gasp.mp3',
  './resources/knock.mp3',
  './resources/ding.mp3',
  './resources/phone-vibrate.mp3',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);                       // must all succeed
    await Promise.allSettled(SOUNDS.map(u => cache.add(u))); // best-effort
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(serve(request));
});

// Cache-first for everything same-origin: instant, works fully offline. On a miss we
// fetch and cache (so anything not precached still becomes available offline after one
// online load). Navigations fall back to the cached shell so the app always opens.
async function serve(request) {
  const cache = await caches.open(CACHE);
  const key = new Request(request.url); // ignore Range header for matching (audio)
  const cached = await cache.match(key);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.status === 200 && fresh.type === 'basic') {
      cache.put(key, fresh.clone());
    }
    return fresh;
  } catch {
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    return new Response('Offline - not cached.', { status: 503 });
  }
}

// Lets the in-app Update flow activate a freshly installed worker immediately.
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
