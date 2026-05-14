/*
    sw.js — Service Worker for Harm Reduction Protocols
    Strategy: stale-while-revalidate — serve cached immediately, update cache in background.
    On version bump: old caches are evicted during activate; controllerchange triggers a page reload.
*/

const VERSION = 'v14.05.26';
const CACHE = `harm-reduction-${VERSION}`;

// Local files to pre-cache on install
const PRECACHE = [
    './',
    './index.html',
    './css/styles.css',
    './js/app.js',
    './js/data.js',
    './js/comboData.js',
    './data/protocols.json',
    './resources/tripsit-combo/combos.json',
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

// Fetch: stale-while-revalidate — serve cached immediately, refresh cache in background
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    event.respondWith(serveRequest(event.request));
});

async function serveRequest(request) {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);

    const networkPromise = fetch(request).then(response => {
        if (response && (response.status === 200 || response.type === 'opaque')) {
            cache.put(request, response.clone());
        }
        return response;
    }).catch(() => null);

    return cached || networkPromise || new Response('Offline — content not yet cached.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
    });
}
