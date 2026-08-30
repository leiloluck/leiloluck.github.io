# How to Make a Web App Installable & Offline-Capable

> **Canonical reference implementation in this repo:** `sound-annoyer/`  
> **Also follows this pattern:** `meditation-timer/`  
> **Tech:** Plain HTML, CSS, JS. No framework. No build step. No npm.

---

## 1. What You're Building

A web page that becomes a **real app** on someone's phone:

- 📱 Has its own icon on the home screen — just like a native app.
- 🚀 Opens in its own window — no browser chrome, no URL bar.
- 📡 Works **completely offline** after the first visit.
- 🔄 **Never gets stuck on a stale version.** When you deploy an update, every user gets it automatically the next time they open the app.
- 🛠️ Has a manual **Update** button for emergency cache clearing.
- 📋 Has a **date-based version number** so you always know what's running.

The whole system is ~200 lines of JS across two files (`sw.js` and the PWA section of `app.js`) plus a JSON manifest and a few HTML meta tags.

---

## 2. The Four Files You Touch

```
my-app/
  manifest.json     ← tells the OS: "this is an app, here's its icon"
  sw.js             ← service worker: cache strategy + update lifecycle
  index.html        ← meta tags + install/update buttons in the footer
  js/app.js         ← APP_VERSION + install/update logic + SW registration
```

Every new app in this repo copies this same pattern.

---

## 3. `manifest.json` — The App's Identity Card

This is what the OS reads to know how to display your app. It controls the icon, the name, the splash screen color, and whether it opens standalone.

```json
{
  "name": "My App",
  "short_name": "MyApp",
  "description": "What it does.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0b0f1a",
  "theme_color": "#0b0f1a",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },
    { "src": "icons/icon.svg",   "sizes": "any",       "type": "image/svg+xml", "purpose": "any" }
  ]
}
```

### What each field does

| Field | Purpose | Gotcha |
|---|---|---|
| `name` | Long name, shown on the splash screen | Keep under ~45 chars |
| `short_name` | Shown under the icon on the home screen | Keep under ~12 chars |
| `start_url` | What URL opens when you tap the icon | `"./"` means "the app folder root" |
| `scope` | What URLs "belong" to this app | Must be same-origin; `"./"` scopes to the app folder |
| `display` | `"standalone"` = no browser chrome | `"fullscreen"` hides even the status bar — usually too aggressive |
| `orientation` | `"portrait"` or `"any"` | Only a hint; the OS may ignore it |
| `background_color` | Splash screen background | Should match your app's `body` background |
| `theme_color` | Status bar / task switcher color | Android uses this; iOS uses the meta tag |
| `icons` | At least 192×192 and 512×512 PNGs | The 512px one doubles as the maskable icon |

### Icons You Need

Create these four files in `icons/`:

| File | Size | Used for |
|---|---|---|
| `icon-192.png` | 192×192 | Android home screen |
| `icon-512.png` | 512×512 | Android splash screen, PWA install prompt |
| `icon-180.png` | 180×180 | iOS home screen (Apple touch icon) |
| `icon.svg` | any | Modern browsers, maskable fallback |

> **Tip:** The SVG icon can be a simple emoji in an SVG wrapper. SoundAnnoyer uses `😈`. Meditation Timer uses `🧘`. This works because `purpose: "any"` doesn't require it to be maskable.

---

## 4. `index.html` — The Meta Tags

```html
<!-- Link to the manifest — required for Android + desktop -->
<link rel="manifest" href="manifest.json">

<!-- Theme color for the status bar -->
<meta name="theme-color" content="#0b0f1a">

<!-- These three meta tags are what make iOS treat it as an installable PWA -->
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">

<!-- Name shown under the iOS home screen icon -->
<meta name="apple-mobile-web-app-title" content="MyApp">

<!-- iOS home screen icon — MUST be exactly 180×180 -->
<link rel="apple-touch-icon" href="icons/icon-180.png">
```

### Why the Apple tags matter

Without `apple-mobile-web-app-capable`, Safari treats the page as a regular website — no "Add to Home Screen" option, and if bookmarked to home screen it opens in Safari, not standalone. The `apple-mobile-web-app-status-bar-style` controls whether the status bar blends into your app (`black-translucent` lets your background color show through).

---

## 5. `sw.js` — The Service Worker (Cache + Updates)

This is the engine. The service worker sits between the browser and the network and decides what to serve.

### The Strategy: Network-First for App Shell, Cache-First for Assets

```
┌─────────────────────────────────────────────────────────┐
│  Network-First (HTML, CSS, JS, manifest, icons)         │
│  ┌──────────┐     ┌──────────┐     ┌──────────────────┐ │
│  │ Request  │ ──► │ Network  │ ──► │ Serve fresh copy │ │
│  │          │     │ (online) │     │ + update cache   │ │
│  └──────────┘     └──────────┘     └──────────────────┘ │
│       │                                              │
│       │               ┌──────────┐                    │
│       └───────────────│ Network  │                    │
│                       │ (offline)│                    │
│                       └──────────┘                    │
│                            │                          │
│                            ▼                          │
│                       ┌──────────┐                    │
│                       │  Cache   │                    │
│                       │ (fallback)│                   │
│                       └──────────┘                    │
├─────────────────────────────────────────────────────────┤
│  Cache-First (audio, images, large static files)       │
│  ┌──────────┐     ┌──────────┐     ┌──────────────────┐ │
│  │ Request  │ ──► │  Cache   │ ──► │ Serve from cache │ │
│  │          │     │ (hit)    │     │ (instant)        │ │
│  └──────────┘     └──────────┘     └──────────────────┘ │
│       │                                              │
│       │               ┌──────────┐                    │
│       └───────────────│  Cache   │                    │
│                       │ (miss)   │                    │
│                       └──────────┘                    │
│                            │                          │
│                            ▼                          │
│                       ┌──────────┐                    │
│                       │ Network  │                    │
│                       │ fetch →  │                    │
│                       │ cache it │                    │
│                       └──────────┘                    │
└─────────────────────────────────────────────────────────┘
```

### ⚠️ Correction (v26.08.30): network-first is the WRONG default for an interdependent shell

The reasoning above — "cache-first means users get stuck on old versions" — is the intuitive answer and it is wrong for the shell of a no-build app. Both apps here are now **cache-first from a version-keyed cache**, and that is the correct architecture. Here is why:

`index.html` references `js/app.js` and `css/styles.css` by **unhashed** names. With no build step there are no content hashes, so those three files have no way to prove they belong to the same deploy. GitHub Pages puts a flat `max-age=600` on all of them.

- **Network-first for navigations is a skew trap.** You fetch a fresh `index.html`, but `app.js` comes from the browser's HTTP cache and is up to 10 minutes older. New HTML + old JS = a silently broken UI. This is Jake Archibald's `max-age` race condition, reproduced inside your own service worker.
- **Stale-while-revalidate has exactly the same problem** — HTML and JS revalidate on independent schedules, so you will eventually pair v3 HTML with v2 JS.
- **Cache-first from one atomically-populated, version-named cache is internally consistent by construction.** The whole shell is written by a single `addAll()` into `myapp-<version>`; every request is served from that one cache; the set therefore always matches itself. It is also what "must work fully offline" actually requires: zero network on the critical path, no timeouts, no race with a captive portal.

Freshness then comes **exclusively from the worker lifecycle**: a new `sw.js` → a new cache name → a new atomic precache → a clean switch-over. See `versioning.md` §8–9 for the two bugs that made this fail in practice (`cache: 'reload'`, and prefix-scoping the eviction).

**Network-first is still right for *leaf* resources** with no version coupling — a standalone JSON feed, a single icon. Never for a shell whose parts must match. (Pig Game is network-first because its CSS and JS are inlined into `index.html`, so there is only one shell file and nothing to skew.)

### Why Cache-First for assets too?

Large files (44 MB meditation soundtrack, MP3 sounds) don't change. Re-downloading them on every load is wasteful and slow. Cache-first serves them instantly.

### The Full `sw.js`

```javascript
/* sw.js — Service Worker for [App Name]
   Shell: network-first (fresh when online, cached fallback when offline).
   Media: cache-first (served instantly once downloaded).
   Bump VERSION on every deploy to evict the old cache. */

'use strict';

const VERSION = 'vYY.MM.DD';  // ← date-based: year.month.day
const CACHE   = `my-app-${VERSION}`;

// Files that are cached on install — the "app shell"
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

// ═══════════════════════════════════════════════════════════════════
// INSTALL — pre-cache the app shell
// ═══════════════════════════════════════════════════════════════════

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())  // take control immediately, don't wait for tabs to close
  );
});

// ═══════════════════════════════════════════════════════════════════
// ACTIVATE — delete old caches, claim all clients
// ═══════════════════════════════════════════════════════════════════

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE)       // delete every cache except the current one
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())     // take control of all open tabs
  );
});

// ═══════════════════════════════════════════════════════════════════
// FETCH — route requests to the right strategy
// ═══════════════════════════════════════════════════════════════════

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept same-origin requests
  if (url.origin !== self.location.origin) return;

  // Media files: cache-first
  if (url.pathname.endsWith('.mp3')) {
    event.respondWith(serveCacheFirst(request));
    return;
  }

  // Everything else (app shell): network-first
  event.respondWith(serveNetworkFirst(request));
});

// ── Network-First ──────────────────────────────────────────────────
// Try network → if online, serve fresh + update cache
//               → if offline, serve from cache
//               → if not cached either, fall back to index.html (for SPA nav)

async function serveNetworkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.status === 200) {
      cache.put(request, fresh.clone());  // update the cache in the background
    }
    return fresh;
  } catch {
    // Network failed — try cache
    const cached = await cache.match(request);
    if (cached) return cached;

    // Navigation request to an uncached URL → serve the app shell
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }

    return new Response('Offline — content not cached.', { status: 503 });
  }
}

// ── Cache-First ────────────────────────────────────────────────────
// Try cache → if found, serve instantly
//            → if not, fetch from network + store in cache for next time

async function serveCacheFirst(request) {
  const cache = await caches.open(CACHE);
  const key = new Request(request.url);  // strip Range header for cache matching
  const cached = await cache.match(key);
  if (cached) return cached;

  try {
    const resp = await fetch(request);
    if (resp.status === 200) cache.put(key, resp.clone());
    return resp;
  } catch {
    return new Response('Asset not available offline.', { status: 503 });
  }
}
```

### The Three Lifecycle Events Explained

| Event | When it fires | What you do |
|---|---|---|
| `install` | First time the SW is registered, or when `sw.js` has changed | Pre-cache the app shell files. Call `skipWaiting()` so the new SW activates immediately (don't wait for tabs to close). |
| `activate` | After install, when the new SW takes control | Delete all old caches (they're named with the old version). Call `clients.claim()` to take control of all open tabs. |
| `fetch` | Every single network request the page makes | Decide: serve from network, serve from cache, or some combination. |

### Why `skipWaiting()` and `clients.claim()`?

Without them, the SW lifecycle is conservative:
- A new SW waits for all tabs using the old SW to close before activating.
- After activation, it only controls tabs opened *after* activation.

`skipWaiting()` + `clients.claim()` makes it aggressive — the new SW takes over immediately. This is what you want for an app that must always show the latest version.

---

## 6. `js/app.js` — Install Button, Update Button, Version Display, SW Registration

This is the client-side half of the PWA system. It lives in your main app JS file.

### 6a. Version Number

```javascript
const APP_VERSION = 'vYY.MM.DD';  // Must match sw.js VERSION and index.html <span>
```

Display it in the footer:
```javascript
elVersion.textContent = APP_VERSION;
```

And in HTML as a fallback before JS loads:
```html
<span class="version" id="version">vYY.MM.DD</span>
```

### 6b. Install Button

Android and desktop Chrome fire a `beforeinstallprompt` event when the PWA criteria are met. You capture this and show your own Install button (instead of letting Chrome's mini-infobar appear — which is easy to dismiss and never comes back).

```javascript
let deferredPrompt = null;

// Chrome says "this site is installable" → capture the event
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();          // suppress the mini-infobar
  deferredPrompt = e;          // save it for later
  elInstallBtn.classList.remove('hidden');
});

// User completed the install (via our button or Chrome's prompt)
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  elInstallBtn.classList.add('hidden');
});

// User taps our Install button
elInstallBtn.addEventListener('click', async () => {
  if (!deferredPrompt) {
    elInstallBtn.classList.add('hidden');
    return;
  }
  deferredPrompt.prompt();                    // show the native install dialog
  const { outcome } = await deferredPrompt.userChoice;
  // outcome is 'accepted' or 'dismissed'
  deferredPrompt = null;
  elInstallBtn.classList.add('hidden');
});
```

### 6c. iOS Install Instructions

iOS Safari never fires `beforeinstallprompt`. There's no programmatic way to trigger "Add to Home Screen." So when a user on iOS taps Install, you show them step-by-step instructions:

```javascript
function isIOS() {
  const ua = navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function installSteps() {
  if (isIOS()) {
    return [
      'Open this page in Safari (not another browser).',
      'Tap the Share button — the square with an upward arrow.',
      'Choose "Add to Home Screen", then tap "Add".',
    ];
  }
  if (/android/i.test(navigator.userAgent || '')) {
    return [
      'Open the browser menu (⋮, top-right).',
      'Tap "Install app" or "Add to Home screen".',
      'Confirm — it installs and opens on its own.',
    ];
  }
  return [
    'Click the install icon in the address bar.',
    'Or open the browser menu and choose "Install [App Name]".',
  ];
}
```

This is what `meditation-timer/` and `sound-annoyer/` both do — platform-specific guidance when the native prompt isn't available.

### 6d. Update Button — Manual (Nuclear Option)

Wipes all caches and service workers, then hard-reloads:

```javascript
elUpdateBtn.addEventListener('click', async () => {
  elUpdateBtn.textContent = 'Updating…';
  elUpdateBtn.disabled = true;

  try {
    // Delete every Cache API cache
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    // Unregister every service worker
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch {}

  window.location.reload();  // fresh start — no SW, no cache
});
```

> **Offline safety** (from `meditation-timer/`): Check `navigator.onLine` before wiping. If the user is offline, wiping the cache would brick the app — there's no network to reload from. Instead, just confirm the cached version is running:
> ```javascript
> if (navigator.onLine === false) {
>   flashUpdateMsg('Offline — cached ✓');
>   return;
> }
> ```

### 6e. Auto-Update — Silent Background Refresh

This is the magic that means users never have to think about updates. When you deploy a new version, the page reloads itself once, automatically.

```javascript
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;  // prevent infinite reload loops

  // When a new SW takes control, reload the page (once)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;   // first install — nothing to reload to
    if (refreshing) return;       // already reloading
    if (running) return;          // don't interrupt an active session
    refreshing = true;
    window.location.reload();
  });

  // Register the SW and check for updates
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .then(reg => {
      reg.update();  // check for new version immediately
      // Also check whenever the user returns to the tab
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update();
      });
    })
    .catch(() => {});
}
```

### The Auto-Update Sequence (Step by Step)

```
1. User opens the app (online).
2. Browser fetches index.html → network-first SW serves the newest HTML from server.
3. app.js loads, registers sw.js with updateViaCache:'none'.
4. Browser fetches sw.js from server → compares byte-by-byte with installed SW.
5. If identical → nothing happens.
6. If different (you bumped VERSION) →
   a. install event fires: new cache created, skipWaiting() called.
   b. activate event fires: old caches deleted, clients.claim() called.
   c. controllerchange event fires in the page.
   d. Page reloads → user is now on the new version.
7. Total time from "user opens app" to "app refreshes to new version": ~2-5 seconds.
```

### The Guards Explained

| Guard | Why |
|---|---|
| `!hadController` | On the very first visit, there's no "old" SW to replace. The `controllerchange` fires when the SW first claims the page — but there's nothing to reload *to*. Skip it. |
| `refreshing` | Without this, a `controllerchange` during reload could trigger another reload → infinite loop. |
| `running` | SoundAnnoyer and Meditation Timer both have active sessions. Mid-session reload would interrupt the user's experience. Wait until they stop. |

### `updateViaCache: 'none'` — Important

By default, the browser may cache `sw.js` according to its HTTP headers. GitHub Pages sets aggressive caching on some files. `updateViaCache: 'none'` tells the browser: "always go to the network when checking for SW updates." This ensures a bumped version is detected within hours, not days.

---

## 7. iOS-Specific Deep Dive

iOS Safari is the stricter platform. Several things work differently than on Android.

### What iOS Requires

| Requirement | How to meet it |
|---|---|
| Served over HTTPS | GitHub Pages does this automatically |
| `apple-mobile-web-app-capable` meta tag | `<meta name="apple-mobile-web-app-capable" content="yes">` |
| Apple touch icon (180×180) | `<link rel="apple-touch-icon" href="icons/icon-180.png">` |
| Manifest `display: standalone` | Respected since iOS 12.2 |
| CSP must allow `blob:` for media | `media-src 'self' blob:` (needed for silent keep-alive audio) |

### What iOS Cannot Do

- **No `beforeinstallprompt` event.** You cannot trigger an install prompt programmatically. Users must use "Add to Home Screen" from the Share sheet.
- **No persistent background audio.** iOS may suspend `AudioContext` when the screen locks unless a real `<audio>` element is actively playing. SoundAnnoyer and Meditation Timer both create a silent looping `<audio>` element (from a generated WAV blob) to hold the audio session open.
- **Service worker storage may be evicted.** iOS may delete SW caches after a few weeks of inactivity. The app still works — it just re-downloads on next online visit.

---

## 8. Offline Audio/Media Strategy

Large media files (MP3s) should NOT be in the `PRECACHE` array. Pre-caching a 44 MB file on install would be slow, waste bandwidth, and potentially fail.

Instead, use **cache-on-first-play**:

```javascript
// In sw.js — cache-first for mp3s
if (url.pathname.endsWith('.mp3')) {
  event.respondWith(serveCacheFirst(request));
  return;
}
```

The first time a sound plays (online), it's fetched, played, and cached. From then on, it plays instantly from cache. This means:
- The app installs fast (only the shell is pre-cached).
- Each sound is downloaded exactly once.
- After all sounds have played at least once, the app is fully offline.

For apps with very large audio that users might want to pre-download, add an explicit "Download for offline" button (as `meditation-timer/` does):

```javascript
elOfflineBtn.addEventListener('click', async () => {
  elOfflineBtn.textContent = 'Downloading…';
  const audioUrls = SOUNDS.map(s => s.file);
  await Promise.all(audioUrls.map(url => fetch(new Request(url))));
  // Now all audio is cached — app works fully offline
  elOfflineBtn.textContent = 'Audio offline ✓';
});
```

---

## 9. CSP (Content Security Policy)

Since the app shell is plain HTML/CSS/JS loaded from the same origin, a strict CSP is easy:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               img-src 'self' data:;
               media-src 'self' blob:;
               object-src 'none';
               base-uri 'self';
               form-action 'none'">
```

Key notes:
- `media-src 'self' blob:` — needed for the silent keep-alive audio generated via `URL.createObjectURL()`.
- `img-src 'self' data:` — needed if you use inline SVG favicons.
- No `script-src 'unsafe-inline'` — all JS is in external `.js` files.
- No `style-src 'unsafe-inline'` — inline styles applied by JS via `element.style.property = value` are NOT blocked by CSP (only `<style>` blocks and `style="..."` attributes are).

---

## 10. Testing Checklist

Run through this list on every new app and after major changes.

### Android (Chrome)
- [ ] Visit the site → after a few seconds, the Install button appears.
- [ ] Tap Install → native dialog appears → install.
- [ ] App opens standalone (no URL bar, no browser chrome).
- [ ] App icon appears on home screen with the correct icon.
- [ ] Turn on Airplane Mode → open the app → all core pages/functions work.
- [ ] Turn off Airplane Mode → open the app → it auto-refreshes to the latest version (if any).
- [ ] Run `console.log(navigator.serviceWorker.controller)` → not null.

### iOS (Safari)
- [ ] Open in Safari → tap Share → "Add to Home Screen" → app appears on home screen.
- [ ] Open from home screen → opens standalone (no Safari chrome).
- [ ] Status bar blends correctly (`black-translucent`).
- [ ] Turn on Airplane Mode → open the app → works offline.
- [ ] Icon on home screen is the 180×180 PNG (not a screenshot of the page).

### Desktop (Chrome/Edge)
- [ ] Install icon appears in the address bar (⊕).
- [ ] Install via browser menu → opens as standalone window.
- [ ] Offline test: DevTools → Network → Offline → page still loads.

### Update Flow
- [ ] Deploy a version bump → open the app on a device with the old version.
- [ ] Within 5 seconds, the app auto-refreshes to the new version.
- [ ] The version number in the footer matches the new deploy.
- [ ] If auto-refresh doesn't fire (rare), tap "Update" → app clears and reloads.

---

## 11. Common Pitfalls

| Problem | Cause | Fix |
|---|---|---|
| "Install" button never appears | Missing manifest, missing icons, or site not on HTTPS | Check DevTools → Application → Manifest for errors |
| App shows old version after deploy | SW `VERSION` wasn't bumped, or `skipWaiting()` not called | Bump VERSION in sw.js; ensure `skipWaiting()` is in the install handler |
| Infinite reload loop | `controllerchange` → reload → register → `controllerchange` → … | Add `refreshing` flag that prevents reload if already reloaded |
| iOS won't install | Missing `apple-mobile-web-app-capable` meta tag | Add all Apple meta tags; verify icon is exactly 180×180 |
| Offline doesn't work | Pre-cache list missing a file, or file 404s | Check DevTools → Application → Cache Storage → see what's cached |
| Audio doesn't play offline | Audio file not cached yet (first play was offline) | Pre-download audio with an explicit "Download for offline" button |
| SW not updating | Browser caching `sw.js` | Add `updateViaCache: 'none'` to the `register()` call |

---

## 12. Source References

- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps) — authoritative reference for all PWA APIs
- [MDN: Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) — lifecycle, events, cache API
- [MDN: Web App Manifests](https://developer.mozilla.org/en-US/docs/Web/Manifest) — every manifest field documented
- [web.dev: Install criteria](https://web.dev/install-criteria/) — what Chrome requires to fire `beforeinstallprompt`
- [web.dev: Offline cookbook](https://web.dev/offline-cookbook/) — caching strategy patterns (network-first, cache-first, stale-while-revalidate)
- [Safari Web Content Guide: Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html) — Apple's official PWA documentation
