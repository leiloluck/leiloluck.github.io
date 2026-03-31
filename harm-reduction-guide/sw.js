/*
    sw.js — Service Worker for Harm Reduction Protocols
    Strategy: cache-first for local files, cache-on-fetch for CDN resources.
    On "Update": all caches are cleared by the page before reloading — no logic needed here.
*/

const VERSION = 'v26.03';
const CACHE = `harm-reduction-${VERSION}`;

// Local files to pre-cache on install
const PRECACHE = [
    './',
    './index.html',
    './css/styles.css',
    './js/app.js',
    './js/data.js',
    './data/protocols.json',
    './manifest.json',
    './icons/icon.svg',
];

// Install: pre-cache local files, then activate immediately
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE)
            .then(cache => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

// Activate: delete old caches, take control of all open pages
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// Fetch: serve from cache if available, otherwise fetch + cache
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;

            return fetch(event.request).then(response => {
                // Cache valid responses (status 200 or opaque cross-origin)
                if (response && (response.status === 200 || response.type === 'opaque')) {
                    const clone = response.clone();
                    caches.open(CACHE).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                // Offline and not in cache — return a minimal fallback
                return new Response('Offline — content not yet cached.', {
                    status: 503,
                    headers: { 'Content-Type': 'text/plain' }
                });
            });
        })
    );
});
