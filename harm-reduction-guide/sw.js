/* sw.js — Harm Reduction Guide (decommissioned)
   The harm-reduction guide is now a plain website with no offline caching or PWA
   install. This worker exists only to clean up previous installs: it activates
   immediately, deletes the old cache, then unregisters itself. Visitors who had
   the old worker are silently migrated to plain browser fetch on their next visit. */

'use strict';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k.startsWith('harm-reduction-')).map(k => caches.delete(k)))
      ),
      self.clients.claim(),
    ]).then(() => self.registration.unregister())
  );
});
