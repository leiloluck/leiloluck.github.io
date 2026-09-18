/* service-worker.js — Pig Game
   Offline strategy ported from the Leilo Lucky apps (sound-annoyer/sw.js):

   - App shell (HTML / JS / JSON / manifest / icons): NETWORK-FIRST. An online
     launch always gets the freshest deploy; the cache is only the offline
     fallback. The shell cache is versioned, so bumping APP_VERSION evicts it.

   - Audio (.mp3): CACHE-FIRST (cache-on-first-fetch) in a SEPARATE, UNVERSIONED
     cache. This is the only deviation from sound-annoyer, and it matters here:
     the "Download All" library is hundreds of MB, so it lives in its own cache
     that is never tied to the version and is never wiped on an app update.
     Range requests (iOS Safari) are served from the cached blob.

   - Sound effects (the whole "Sounds" category, ~1.6 MB) are precached into the audio
     cache on install, best-effort, so the buttons you press mid-game work offline from
     the first launch. Music is left to the page's "Download for offline" button.

   - The page's own downloads carry an `X-Pig-Download` header and are passed straight
     through. The page streams them into the cache itself; if this worker also stored
     them, one network stream was tee'd into two 40-90 MB cache writes at once, and the
     slower side buffered in memory until the phone killed the download.

   Bump APP_VERSION in version.js on every shell change to evict the old shell. */
'use strict';

importScripts('./version.js');

const CACHE_PREFIX = 'pig-game-';      // Cache Storage is per ORIGIN, not per app
const SHELL_CACHE  = `${CACHE_PREFIX}shell-v${APP_VERSION}`;
const AUDIO_CACHE  = `${CACHE_PREFIX}audio`; // intentionally unversioned: survives updates

// Only pre-cache the small core shell, NEVER the audio (hundreds of MB).
const CORE_ASSETS = [
  './',
  './index.html',
  './version.js',
  './audio-files.json',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon-180.png'
];

self.addEventListener('install', (e) => {
  console.log('Service Worker v' + APP_VERSION + ' installing...');
  // NOT skipWaiting() here — deliberately, and it used to be. Calling it synchronously
  // meant this worker could activate (and activate() then deletes the previous shell
  // cache) before waitUntil's precache had finished, leaving a window with no usable
  // cache at all. The page sends SKIP_WAITING when it is ready; see index.html.

  e.waitUntil(
    caches.open(SHELL_CACHE)
      // cache:'reload' bypasses the browser HTTP cache. GitHub Pages serves everything
      // with Cache-Control: max-age=600, so a plain addAll() shortly after a deploy can
      // bake up-to-10-minute-old bytes into the new version's cache.
      .then(cache => cache.addAll(CORE_ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => {
        console.log('Core shell cached');
        notifyClients('CACHE_COMPLETE');
      })
      // Best-effort: a failed sound must not fail the shell install.
      .then(() => precacheSounds().catch(err => console.warn('Sound precache skipped:', err)))
      // No .catch() here on purpose: a failed precache must FAIL the install, so the
      // previous worker and its complete cache stay active. Swallowing the error left a
      // half-populated cache in charge, which is how offline broke silently.
  );
});

// Every file in the "sound" categories of audio-files.json, into the persistent audio
// cache, skipping any already there. Small (short clips), so it is fine on mobile data.
async function precacheSounds() {
  const shell = await caches.open(SHELL_CACHE);
  const idx = await shell.match('./audio-files.json');
  if (!idx) return;
  const data = await idx.json();
  const audio = await caches.open(AUDIO_CACHE);
  for (const cat of data.categories || []) {
    if (cat.type !== 'sound') continue;
    for (const f of cat.files || []) {
      const url = new URL(encodeURI('./' + f.path), self.location).href;
      if (await audio.match(url, { ignoreSearch: true, ignoreVary: true })) continue;
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res.ok && res.type === 'basic') await audio.put(url, res);
      } catch { /* offline or flaky: the next install, or the page, retries */ }
    }
  }
}

self.addEventListener('activate', (e) => {
  console.log('Service Worker v' + APP_VERSION + ' activating...');
  e.waitUntil(
    (async () => {
      // Take over first, THEN migrate. The rescue loop below walks every entry of every
      // old cache and can copy hundreds of MB; running it inside waitUntil blocked the
      // post-update navigation for minutes on a full library.
      await self.clients.claim();
      console.log('Service Worker activated and controlling pages');
      notifyClients('CACHE_UPDATED');
      migrateAndEvict();          // deliberately not awaited
    })()
  );
});

// Old cache generations (e.g. the legacy "pig-game-v5") may hold a fully downloaded audio
// library. Rescue every .mp3 into the persistent audio cache before deleting, so nobody
// has to re-download hundreds of MB. Runs in the background after activation.
async function migrateAndEvict() {
  try {
    const keys = await caches.keys();
    const audioCache = await caches.open(AUDIO_CACHE);
    for (const k of keys) {
      // Cache Storage is ORIGIN-wide and this origin hosts several apps: only ever
      // touch keys that are ours. The old filter deleted everything that was not the
      // current shell or audio cache.
      if (!k.startsWith(CACHE_PREFIX)) continue;
      if (k === SHELL_CACHE || k === AUDIO_CACHE) continue;
      try {
        const oldCache = await caches.open(k);
        for (const req of await oldCache.keys()) {
          if (!new URL(req.url).pathname.toLowerCase().endsWith('.mp3')) continue;
          if (await audioCache.match(req, { ignoreSearch: true, ignoreVary: true })) continue;
          const res = await oldCache.match(req);
          if (res) await audioCache.put(req, res);
        }
      } catch (err) {
        // Quota, or anything else: keep the old cache rather than deleting a library we
        // just failed to copy.
        console.warn('Audio migration failed, keeping old cache:', k, err);
        continue;
      }
      console.log('Deleting old cache:', k);
      await caches.delete(k);
    }
  } catch (err) {
    console.warn('Cache migration skipped:', err);
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Only handle our own scope
  if (!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;

  // The page's connectivity probe must always reach the real network and must never be
  // answered from the cache — serveShell falls back to the cache with ignoreSearch, so
  // an offline device would otherwise get a cached 200 and look online, and the Update
  // button would then wipe the shell cache with no way to refill it.
  if (url.searchParams.has('probe')) { e.respondWith(fetch(req)); return; }

  // The page is downloading this for offline itself (see header): hand it the network
  // response untouched, and do not store a second copy.
  if (req.headers.get('x-pig-download')) { e.respondWith(fetch(req)); return; }

  // Audio: cache-first, with Range support for iOS Safari.
  if (url.pathname.endsWith('.mp3')) {
    if (req.headers.get('range')) {
      e.respondWith(handleRangeRequest(req));
    } else {
      e.respondWith(serveAudio(req));
    }
    return;
  }

  // Everything else is the app shell: network-first.
  e.respondWith(serveShell(req));
});

// Network-first for the shell: an online launch always gets the freshest
// HTML/JS/JSON so a new deploy is used immediately; cache keeps it working offline.
async function serveShell(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    // Two things here:
    //  * cache:'no-cache' forces revalidation. A plain fetch() goes through the browser
    //    HTTP cache, and GitHub Pages serves everything max-age=600 — so "network-first"
    //    could return a ten-minute-old file AND write those stale bytes into the offline
    //    shell cache, which is the opposite of what network-first is for.
    //  * A timeout, because on a flaky connection a plain fetch() can hang for 30s+
    //    before failing and the app looks frozen on launch.
    const fresh = await withTimeout(
      fetch(new Request(req, { cache: 'no-cache' })),
      4000,
      // Landed after the deadline: cache it anyway so a slow connection still refreshes.
      (late) => {
        if (late && late.status === 200 && late.type === 'basic') cache.put(req, late.clone());
      }
    );
    if (fresh && fresh.status === 200 && fresh.type === 'basic') {
      cache.put(req, fresh.clone());
      return fresh;
    }
    // A 404 or a 5xx from a bad deploy (or a CDN hiccup) used to be passed straight
    // through, blanking the app even though a perfectly good copy was sitting in the
    // cache. Fall through to the cached copy instead.
    const fallback = await cache.match(req, { ignoreSearch: true });
    if (fallback) return fallback;
    return fresh;
  } catch {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    if (req.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    return new Response('Offline - content not cached.', { status: 503 });
  }
}

// Cache-first for sounds: serve from the persistent audio cache once downloaded,
// otherwise fetch and store. Keeps the app fully functional offline.
async function serveAudio(req) {
  const cache = await caches.open(AUDIO_CACHE);
  const key = new Request(req.url); // ignore Range header for matching
  const cached = await cache.match(key, { ignoreSearch: true, ignoreVary: true });
  if (cached) return cached;
  try {
    const res = await fetch(key);
    if (res && res.status === 200 && res.type === 'basic') {
      cache.put(key, res.clone());
    }
    return res;
  } catch {
    return new Response('Sound not available offline.', { status: 503 });
  }
}

// Race a promise against a deadline. Used to stop a stalled network request from
// holding the whole app launch hostage (see serveShell).
function withTimeout(promise, ms, onLate) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const t = setTimeout(() => { settled = true; reject(new Error('timeout')); }, ms);
    promise.then(v => {
      clearTimeout(t);
      // The request was not aborted, it was just slow. If it lands after we gave up, still
      // put it in the cache — otherwise a device that consistently times out fetches the
      // shell over and over and never actually refreshes its offline copy.
      if (settled) { if (onLate) onLate(v); return; }
      resolve(v);
    }, e => { clearTimeout(t); if (!settled) reject(e); });
  });
}

self.addEventListener('message', (e) => {
  const type = typeof e.data === 'string' ? e.data : (e.data && e.data.type);
  if (type === 'SKIP_WAITING') self.skipWaiting();
  if (type === 'START_CACHING') {
    console.log('START_CACHING received (no-op, use Download All button)');
    notifyClients('CACHE_COMPLETE');
  }
});

async function handleRangeRequest(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const cachedResponse = await cache.match(request, { ignoreSearch: true, ignoreVary: true });

  if (!cachedResponse) {
    try {
      return await fetch(request);
    } catch (err) {
      return new Response('Offline', { status: 503 });
    }
  }

  const rangeHeader = request.headers.get('range');
  const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d+)?/);
  if (!rangeMatch) return cachedResponse;

  const blob = await cachedResponse.blob();
  const start = parseInt(rangeMatch[1], 10);
  const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : blob.size - 1;

  if (start >= blob.size) {
    return new Response('', {
      status: 416,
      statusText: 'Range Not Satisfiable',
      headers: { 'Content-Range': `bytes */${blob.size}` }
    });
  }

  const slicedBlob = blob.slice(start, end + 1);

  // Build the 206 headers from scratch. Spreading the cached response's headers carried
  // over the FULL file's Content-Length, and adding the slice length produced a combined,
  // malformed "91000000, 65536" — which broke scrubbing a cached track offline. The
  // ETag/Last-Modified of the whole file must not be echoed on a partial response either.
  const headers = new Headers();
  const type = cachedResponse.headers.get('Content-Type');
  if (type) headers.set('Content-Type', type);
  headers.set('Content-Range', `bytes ${start}-${end}/${blob.size}`);
  headers.set('Content-Length', String(slicedBlob.size));
  headers.set('Accept-Ranges', 'bytes');

  return new Response(slicedBlob, {
    status: 206,
    statusText: 'Partial Content',
    headers,
  });
}

function notifyClients(message) {
  self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
    .then(clients => clients.forEach(c => c.postMessage(message || 'CACHE_UPDATED')));
}
