/* sw.js — SoundAnnoyer service worker
   App shell: network-first (always newest when online, cached fallback offline).
   Sounds (.mp3): cache-on-first-fetch so the app works fully offline once a sound
   has played at least once. Missing mp3s never break install — only the shell is
   pre-cached. Bump VERSION on every change to evict the old cache. */

'use strict';

const VERSION = 'v09.06.26';
const CACHE   = `sound-annoyer-${VERSION}`;

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

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
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
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('.mp3')) {
    event.respondWith(serveAudio(request));
    return;
  }
  event.respondWith(serveShell(request));
});

// Network-first for the shell: an online launch always gets the freshest HTML/CSS/JS
// (so a freshly deployed version is used immediately); cache keeps it working offline.
async function serveShell(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.status === 200) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    return new Response('Offline — content not cached.', { status: 503 });
  }
}

// Cache-first for sounds: serve from cache once downloaded, otherwise fetch and
// store. Keeps the app fully functional offline after each sound has played once.
async function serveAudio(request) {
  const cache = await caches.open(CACHE);
  const key = new Request(request.url); // ignore Range header for matching
  const cached = await cache.match(key);
  if (cached) return cached;
  try {
    const resp = await fetch(key);
    if (resp.status === 200) cache.put(key, resp.clone());
    return resp;
  } catch {
    return new Response('Sound not available offline.', { status: 503 });
  }
}
