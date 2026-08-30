/* sw.js — Meditation Timer service worker (offline-first, self-updating)

   App shell: cache-first from a version-keyed cache — boots and runs with zero network
   once installed, and every part of the shell always comes from the same deploy.

   Freshness comes from the worker lifecycle: bump VERSION -> a new cache is precached in
   the background -> the page switches to it and reloads once, between sessions (js/app.js).

   Three things here are load-bearing — do not "simplify" them away:

   * PRECACHE USES cache:'reload'. A plain cache.addAll() fetches through the browser's
     HTTP cache, and GitHub Pages serves everything with Cache-Control: max-age=600. A
     worker installing shortly after a deploy could therefore bake up-to-10-minute-old
     bytes into the NEW version's cache — pinning the app to a stale build under a fresh
     version number, permanently, because cache-first never revalidates.

   * OLD-CACHE EVICTION IS PREFIX-SCOPED. caches.keys() is per ORIGIN, not per app.
     Deleting every key that wasn't ours wiped SoundAnnoyer's cache on every update here
     (and SoundAnnoyer returned the favour, wiping the 44 MB soundtrack downloaded by the
     "Save audio offline" button). Only ever delete keys starting with CACHE_PREFIX.

   * AUDIO LIVES IN ITS OWN, UNVERSIONED CACHE. The soundtrack is ~44 MB and the user
     downloads it deliberately. If it sat in the version-keyed shell cache, every single
     version bump would evict it and they would have to fetch 44 MB again — over mobile
     data, silently. AUDIO_CACHE is never versioned and never evicted.

   * THE BELL IS PRECACHED (into AUDIO_CACHE, best-effort). 'Single bowl sound.mp3'
     (1.5 MB) is not background music: it is the end-of-session chime and every interval
     beat, decoded into an AudioBuffer and scheduled on the audio clock. If it can't be
     fetched, scheduleHit() drops every hit and the session ends in silence — so it must
     work offline. It is added best-effort and OUTSIDE the atomic shell addAll(), so a
     flaky connection can't block a shell update, and it is not re-downloaded on every
     version bump. */

'use strict';

const VERSION      = 'v26.08.30';
const CACHE_PREFIX = 'meditation-timer-';        // never touch caches outside this prefix
const CACHE        = CACHE_PREFIX + VERSION;
const AUDIO_CACHE  = CACHE_PREFIX + 'audio';     // unversioned on purpose — see header

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
  './icons/icon-maskable-512.png',
];

// Not part of the atomic shell: added best-effort into the persistent audio cache.
const BELL = './resources/Single bowl sound.mp3';

// Always fetch precache entries from the network, never the HTTP cache. See header.
const fresh = url => new Request(url, { cache: 'reload' });

// ── Install: pre-cache app shell ─────────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PRECACHE.map(fresh));                 // atomic: all or nothing

    // The bell goes into the persistent audio cache, best-effort. Keeping it out of the
    // addAll above means a flaky connection can't block the shell update, and keeping it
    // out of the versioned cache means it is not re-fetched on every bump.
    const audio = await caches.open(AUDIO_CACHE);
    if (!(await audio.match(new Request(new URL(BELL, self.location).href)))) {
      try { await audio.add(fresh(BELL)); } catch {}
    }
    // NO skipWaiting() here — deliberately. The shell is served cache-first, so a worker
    // that activates mid-session hands new CSS/JS to a page still running the old code.
    // The new worker waits; the page sends SKIP_WAITING once no session is running.
  })());
});

// ── Activate: evict our own old caches ───────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // AUDIO_CACHE is deliberately spared: it holds the 44 MB soundtrack the user chose to
    // download, and re-fetching that on every version bump would be inexcusable.
    await Promise.all(
      keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE && k !== AUDIO_CACHE)
          .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// ── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // The page's connectivity probe must always reach the real network and must never be
  // stored: a cached 200 would make an offline device look online, and the Update button
  // could then wipe the caches with no way to refill them.
  if (url.searchParams.has('probe')) { event.respondWith(fetch(request)); return; }

  if (url.pathname.endsWith('.mp3')) {
    event.respondWith(serveAudio(event));
    return;
  }

  event.respondWith(serveShell(request));
});

// Cache-first for the app shell: instant, works fully offline. On a miss we fetch and
// cache (so anything not precached still becomes available offline after one online
// load). Navigations fall back to the cached shell so the app always opens.
async function serveShell(request) {
  const cache = await caches.open(CACHE);

  // ignoreSearch: a link with a ?utm_… or ?ref= tail is the same shell document. Without
  // it that navigation misses the cache and fetches fresh HTML that then loads old cached
  // JS from the same cache — exactly the version skew cache-first exists to prevent.
  const cached = await cache.match(request, { ignoreSearch: true });
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
// - If not cached AND this is a full request (e.g. "Save audio offline" button):
//   fetch, cache the 200 response, return it.
async function serveAudio(event) {
  const request = event.request;
  const cache = await caches.open(AUDIO_CACHE);
  const cacheKey = new Request(request.url); // no Range header — match the stored full response

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const isRange = request.headers.has('range');

  try {
    if (isRange) {
      // Pass range request through natively — browser handles streaming
      return await fetch(request);
    }

    // Full request (no Range header): fetch, cache, return.
    const response = await fetch(cacheKey);
    if (response.status === 200) {
      // waitUntil, not fire-and-forget: writing 44 MB takes a while, and without this the
      // worker can be killed mid-write — leaving a partial cache while the page has
      // already reported "Audio offline ✓".
      event.waitUntil(cache.put(cacheKey, response.clone()));
    }
    return response;
  } catch {
    return new Response('Audio not available offline.', { status: 503 });
  }
}

// Page <-> worker messages.
//   SKIP_WAITING — the page tells a waiting worker it is safe to take over.
//   GET_VERSION  — the page compares this against its own APP_VERSION to detect a
//                  stale-shell mismatch and self-heal (see js/app.js).
self.addEventListener('message', event => {
  const data = event.data;
  const type = typeof data === 'string' ? data : (data && data.type);
  if (type === 'SKIP_WAITING') self.skipWaiting();
  if (type === 'GET_VERSION' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ version: VERSION, cache: CACHE });
  }
});
