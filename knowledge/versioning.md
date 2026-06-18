# Versioning Strategy for Installable PWAs

> **Applies to:** Every app in this repo with a service worker.  
> **Format:** `vYY.MM.DD` — year, month, day, separated by dots.  
> **Examples:** `v26.06.19` · `v10.06.11` · `v09b.06.26`

---

## 1. Why Date-Based Versioning?

Semantic versioning (`1.2.3`) answers the question "how big was this change?" But for a PWA that auto-updates, the question that matters is **"is my copy current?"**

| Semantic (`v1.2.3`) | Date-based (`v26.06.19`) |
|---|---|
| Was this a major, minor, or patch change? | When was this deployed? |
| Requires disciplined bump rules | Trivial: it's always today's date |
| You can be on `v1.2.3` and not know if that's old | `v26.03.15` in June → obviously stale |
| Meaningless to non-developers | Instantly readable by anyone |

The version is the date of deployment. If you deploy twice on the same day, add a letter suffix: `v26.06.19b`, `v26.06.19c`.

---

## 2. Where the Version Lives

**Three places. All must match.** This is non-negotiable. If they get out of sync, you get partial updates, stale caches, or a broken app.

### Location 1: `sw.js` — The Source of Truth

```javascript
const VERSION = 'v26.06.19';
const CACHE   = `my-app-${VERSION}`;
```

This is the version that **actually drives behavior**:
- On `install`: a new cache named `my-app-v26.06.19` is created.
- On `activate`: every cache that is NOT named `my-app-v26.06.19` is deleted.
- If you forget to bump this, **the SW itself stays on the old version** — even if HTML/JS are fresh from network-first fetch. The SW controls the cache, and the SW only updates when its own file changes.

### Location 2: `js/app.js` — The User-Facing Version

```javascript
const APP_VERSION = 'v26.06.19';
```

Displayed in the app footer. This is what the user sees. If it doesn't match the SW version, the user sees a version number that doesn't correspond to the actual cached code.

### Location 3: `index.html` — The Fallback

```html
<span class="version" id="version">v26.06.19</span>
```

This is shown before JavaScript loads. The JS then overwrites it with `APP_VERSION`. If JS fails to load (network error, CSP block, parse error), the user still sees a version number. This also means the version is visible in "View Source" — useful for debugging.

### The Sync Check

Before every deploy, verify:

```bash
# All three should return the same version string
grep "VERSION" sw.js
grep "APP_VERSION" js/app.js
grep "id=\"version\"" index.html
```

---

## 3. When to Bump the Version

Bump the version when **any pre-cached file changes**. The pre-cache list (in `sw.js`) is the definitive list:

```javascript
const PRECACHE = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/data.js',       // ← if your app has data files
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
];
```

| Changed file | Bump? | Why |
|---|---|---|
| `index.html` | ✅ Yes | In pre-cache list |
| `css/styles.css` | ✅ Yes | In pre-cache list |
| `js/app.js` | ✅ Yes | In pre-cache list |
| `js/data.js` | ✅ Yes | In pre-cache list |
| `manifest.json` | ✅ Yes | In pre-cache list |
| Any icon file | ✅ Yes | In pre-cache list |
| `sw.js` itself | ✅ Yes | The version IS in sw.js; changing it IS the bump |
| `resources/sound.mp3` | ❌ No | Not pre-cached; cached on first fetch |
| `context.md` | ❌ No | Not served to users |
| `README.md` | ❌ No | Not part of the app shell |
| `resources/sources/something.pdf` | ❌ No | Not pre-cached |

> **Rule of thumb:** If a user would see or feel the change, bump the version. If it's developer-only documentation, don't bother.

---

## 4. The Bump Checklist

A 4-step ritual performed before every deploy:

```
☐ 1. Change VERSION in sw.js
☐ 2. Change APP_VERSION in js/app.js
☐ 3. Change the fallback <span> in index.html
☐ 4. Verify all three match (grep or visual check)
```

That's it. Then commit and push to `main`. GitHub Pages auto-deploys.

---

## 5. How Auto-Update Works — The Full Sequence

This is what happens when a user who had `v26.06.18` opens the app after you deploy `v26.06.19`:

```
USER OPENS APP (ONLINE)
│
├─► Browser sends request for index.html
│     └─► SW: network-first → fetches from server → serves v26.06.19 HTML
│           └─► Also caches it (background)
│
├─► New HTML loads in browser
│     └─► <span id="version"> shows "v26.06.19"
│
├─► js/app.js executes
│     ├─► elVersion.textContent = 'v26.06.19'    (JS confirms the new version)
│     └─► Registers sw.js with updateViaCache:'none'
│
├─► Browser fetches sw.js from server
│     ├─► Compares byte-for-byte with the installed sw.js
│     └─► They differ! (new VERSION string)
│           │
│           ├─► install event fires
│           │     ├─► New cache created: 'my-app-v26.06.19'
│           │     ├─► All PRECACHE files cached fresh
│           │     └─► skipWaiting() → new SW activates immediately
│           │
│           ├─► activate event fires
│           │     ├─► Old cache 'my-app-v26.06.18' DELETED
│           │     └─► clients.claim() → new SW controls this tab
│           │
│           └─► controllerchange event fires in the page
│                 ├─► hadController? → yes, this isn't first install
│                 ├─► refreshing? → no, we haven't reloaded yet
│                 ├─► running? → no, the app is idle
│                 └─► window.location.reload()
│                       │
│                       └─► PAGE RELOADS (fresh, from network or new cache)
│                             └─► User sees v26.06.19 — update complete.
│
└─► Total elapsed time: ~2–5 seconds
```

### What if the user is offline?

```
USER OPENS APP (OFFLINE, AIRPLANE MODE)
│
├─► Browser sends request for index.html
│     └─► SW: network-first → network fails → serves v26.06.18 from cache
│
├─► Old HTML loads. Old app.js loads.
│     └─► Registers sw.js → fetches from network → also fails
│           └─► Old SW stays in control
│
└─► User sees v26.06.18. App works fully (offline).
      └─► Next time they're online, the auto-update sequence runs.
```

### What if a session is running?

```javascript
navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (!hadController) return;
  if (refreshing) return;
  if (state !== 'idle') return;  // ← DON'T RELOAD mid-session
  refreshing = true;
  window.location.reload();
});
```

If SoundAnnoyer is actively firing sounds, or Meditation Timer is mid-session, the auto-reload is suppressed. The update will apply on the NEXT page load (when the user stops and reopens).

---

## 6. The Manual Update Button — When Auto-Update Isn't Enough

Sometimes auto-update doesn't fire:
- The user has been offline for days, the SW update check fails repeatedly.
- A bug in the old SW prevents the new one from installing.
- The browser's SW lifecycle is stuck (rare, but happens).

The Update button is the escape hatch:

### Standard Update (sound-annoyer style)

```javascript
elUpdateBtn.addEventListener('click', async () => {
  elUpdateBtn.textContent = 'Updating…';
  elUpdateBtn.disabled = true;
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch {}
  window.location.reload();
});
```

### Offline-Safe Update (meditation-timer style)

```javascript
async function runUpdate() {
  if (navigator.onLine === false) {
    flashUpdateMsg('Offline — cached ✓');   // don't brick the app!
    return;
  }
  // ... same wipe + reload as above ...
}
```

**Why the offline check matters:** If the user is offline and you delete all caches + unregister the SW, there's nothing left to serve. The next page load would show a browser error. The offline-safe version instead confirms: "you're offline, but the cached version is running fine."

---

## 7. The Version as a Tappable Update Trigger

In `meditation-timer/`, the version number itself is clickable — it runs the update:

```javascript
elVersion.addEventListener('click', runUpdate);
```

This is a nice UX pattern: the version serves double duty as both an information display and an update trigger. Power users learn to tap the version to force-refresh.

---

## 8. Service Worker Lifecycle: The Full Picture

The service worker lifecycle is the trickiest part of PWA development. Here's the complete state machine:

```
                    ┌─────────────┐
                    │  NO SW      │
                    │  (first     │
                    │   visit)    │
                    └──────┬──────┘
                           │ register('./sw.js')
                           ▼
                    ┌─────────────┐
                    │  INSTALLING │
                    │  (pre-cache │
                    │   files)    │
                    └──────┬──────┘
                           │ skipWaiting() ───────┐
                           │ (without it)         │
                           ▼                      ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  WAITING    │     │  ACTIVATING │
                    │  (for tabs  │     │  (delete    │
                    │   to close) │     │   old       │
                    └──────┬──────┘     │   caches)   │
                           │            └──────┬──────┘
                           │                   │ clients.claim()
                           ▼                   ▼
                    ┌─────────────────────────────────┐
                    │           ACTIVATED             │
                    │  (SW controls fetches for this  │
                    │   scope; controllerchange fires)│
                    └─────────────────────────────────┘
                           │
                           │ New sw.js detected
                           ▼
                    (INSTALLING new version...)
                           │
                           └──► same cycle repeats
```

### Without `skipWaiting()`

The new SW sits in `WAITING` until ALL tabs using the old SW are closed. This could be hours or days. The user keeps seeing the old version.

### With `skipWaiting()`

The new SW activates as soon as it finishes installing. `controllerchange` fires, and the page reloads. The user sees the new version within seconds.

### Why Doesn't Everyone Use `skipWaiting()`?

Because for a traditional multi-page website, an immediate reload could lose form data or interrupt a checkout flow. For a single-page PWA, the trade-off is worth it — freshness is more important than avoiding a one-time reload.

---

## 9. GitHub Pages & HTTP Caching

GitHub Pages sets `Cache-Control: max-age=600` (10 minutes) on most files. This means:

- The browser may serve a 10-minute-old `index.html` without even asking the server.
- But the network-first SW ignores this — it fetches from the network and gets whatever GitHub serves.
- `sw.js` itself respects HTTP caching UNLESS you use `updateViaCache: 'none'` in the register call.

**Recommendation:** Always use `updateViaCache: 'none'` for the SW registration:

```javascript
navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
```

This ensures the browser always revalidates `sw.js` with the server, so a bumped `VERSION` is detected on the next update check (which happens on load and on every visibility change).

---

## 10. Debugging: Is My Update Working?

### In Chrome DevTools

1. Open **Application** → **Service Workers**.
2. Look for your SW. It shows the current status and version.
3. Check "Update on reload" to force an update check on every page load.
4. Open **Application** → **Cache Storage** → see the cache names. They should match the VERSION in sw.js.

### In the Console

```javascript
// Is the SW controlling this page?
console.log(navigator.serviceWorker.controller);
// null → no SW in control (first visit, or SW failed)

// What caches exist?
caches.keys().then(keys => console.log(keys));
// Should show exactly one cache: 'my-app-v26.06.19'

// Force an update check
navigator.serviceWorker.getRegistration().then(r => r.update());
```

### Common Debugging Scenarios

| Symptom | Likely Cause | Check |
|---|---|---|
| Version shows new number but SW is old | `APP_VERSION` bumped but `sw.js` VERSION not bumped | Compare `navigator.serviceWorker.controller.scriptURL` with the deployed sw.js |
| Infinite reload loop | `refreshing` flag missing or not checked | Add `console.log` to `controllerchange` handler |
| SW shows as "redundant" | A previous SW threw an uncaught error during install | Check the SW's console (chrome://serviceworker-internals/) |
| Cache has multiple versions | `activate` handler not deleting old caches | Verify `keys.filter(k => k !== CACHE)` logic |
| Update doesn't happen for hours | HTTP caching on sw.js | Use `updateViaCache: 'none'` |
