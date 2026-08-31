/* sw.js — /sound-annoyer/ retirement worker.
   The app moved to /poltergeist/. A cache-first worker outlives its app: the old one
   would go on serving the old shell from its cache forever, so the redirect stub next to
   this file would never actually be seen. This worker exists only to stand down.

   It deletes ONLY caches under the old prefix. caches.keys() is per ORIGIN, so deleting
   anything else here would wipe the new app (poltergeist-*) or the meditation timer,
   including its 44 MB user-downloaded soundtrack. */
'use strict';

const OLD_PREFIX = 'sound-annoyer-';
const NEW_URL    = '/poltergeist/';

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith(OLD_PREFIX)).map(k => caches.delete(k)));
    await self.registration.unregister();
    // Push any window still sitting on the old URL over to the new one immediately,
    // rather than making the user reload to discover the move.
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const c of clients) { try { await c.navigate(NEW_URL); } catch {} }
  })());
});

// No fetch handler on purpose: nothing here should be served from cache any more.
