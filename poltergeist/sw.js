/* sw.js — poltergeist.exe service worker (offline-first, self-updating)

   Two goals that pull against each other, and how they are both met:

   1. "Works perfectly offline once installed."
      On install we precache the whole shell, the icons AND every sound, and every
      same-origin GET is served cache-first. A cold start with zero network works.

   2. "Never stuck on a stale build."
      Freshness comes from the worker lifecycle, not from a per-launch network hit:
      bump VERSION -> a new version-keyed cache is precached in the background -> the
      new worker takes over and the page reloads once (see js/app.js).

   Two subtle things this file gets right — do not "simplify" them away:

   * PRECACHE USES cache:'reload'. A plain cache.addAll() fetches through the browser's
     HTTP cache. GitHub Pages serves assets with a short max-age, so a worker installing
     shortly after a deploy could precache the OLD bytes into the NEW version's cache —
     pinning the app to a stale build *under a fresh version number*, permanently,
     because cache-first never revalidates. cache:'reload' bypasses the HTTP cache so
     the precache is always the real, freshly deployed file. This was the actual cause
     of "I open the app and get the old version".

   * OLD-CACHE EVICTION IS PREFIX-SCOPED. caches.keys() is per ORIGIN, not per app, and
     leiloluck.github.io hosts several apps. Deleting every key that isn't ours wiped the
     Meditation Timer's cache (including its 44 MB downloaded soundtrack) every time this
     app updated. Only ever delete keys starting with CACHE_PREFIX.

   * THE SOUNDS LIVE IN THEIR OWN, UNVERSIONED CACHE. They are 1.3 MB and they change far
     less often than the code. Keeping them in the version-keyed cache meant every single
     version bump silently re-downloaded all of them over mobile data. AUDIO_CACHE is
     never versioned and never evicted; new files are added on install, missing ones are
     fetched on demand by the fetch handler. */

'use strict';

const VERSION      = 'v26.08.31g';
const CACHE_PREFIX = 'poltergeist-';           // never touch caches outside this prefix
const CACHE        = CACHE_PREFIX + VERSION;
const AUDIO_CACHE  = CACHE_PREFIX + 'sounds';    // unversioned on purpose — see header

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
  './icons/icon-maskable-512.png',
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

// Always fetch precache entries from the network, never the HTTP cache. See header.
const fresh = url => new Request(url, { cache: 'reload' });

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL.map(fresh));                              // must all succeed

    // Sounds go into the persistent cache, best-effort, and only if not already there:
    // a renamed or removed file must not block the install, and an unchanged one must not
    // be re-downloaded just because the code changed.
    const audio = await caches.open(AUDIO_CACHE);
    await Promise.allSettled(SOUNDS.map(async u => {
      const key = new Request(new URL(u, self.location).href);
      if (await audio.match(key)) return;
      return audio.add(fresh(u));
    }));
    // NO skipWaiting() here — deliberately. The shell is served cache-first, so a worker
    // that activates mid-session starts handing new CSS/JS to a page still running the
    // old code. Instead the new worker waits, the old one keeps serving a self-consistent
    // build until the session is over, and the page sends SKIP_WAITING when it is safe
    // (js/app.js). Defer the switch, not the reload.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // AUDIO_CACHE is deliberately spared — see the header.
    await Promise.all(
      keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE && k !== AUDIO_CACHE)
          .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
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
  const url = new URL(request.url);

  // The page's connectivity probe (js/app.js isReallyOnline) must always hit the real
  // network and must never be stored — otherwise a cached 200 would make an offline
  // device look online and the Update button could wipe the caches with no way back.
  if (url.searchParams.has('probe')) return fetch(request);

  // Sounds are served from (and added to) the persistent cache; everything else from the
  // version-keyed shell cache.
  const isSound = url.pathname.endsWith('.mp3');
  const cache = await caches.open(isSound ? AUDIO_CACHE : CACHE);
  const key = new Request(request.url); // ignore Range header for matching (audio)
  // ignoreSearch: a URL that picks up a ?utm_…/?ref= tail is still the same document, and
  // missing the cache there would serve fresh HTML against old cached JS.
  const cached = await cache.match(key, { ignoreSearch: !isSound });
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && res.status === 200 && res.type === 'basic') {
      cache.put(key, res.clone());
    }
    return res;
  } catch {
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    return new Response('Offline - not cached.', { status: 503 });
  }
}

// Page <-> worker messages.
//   SKIP_WAITING — let the in-app Update flow activate a freshly installed worker.
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
