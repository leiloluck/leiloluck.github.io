# Knowledge Base

> Reusable technical reference for building and maintaining `leiloluck.github.io`.
> Each file captures a pattern, a decision, or a system that applies across multiple apps in this repo.

---

## 📚 Contents

| # | File | What It Covers |
|---|---|---|
| 1 | [`pwa-offline-installable.md`](./pwa-offline-installable.md) | **Complete PWA blueprint.** Manifest, service worker (network-first shell + cache-first assets), install button with Chrome + iOS support, update button, auto-update system, offline audio strategy, CSP configuration, iOS deep dive, testing checklist, common pitfalls. |
| 2 | [`versioning.md`](./versioning.md) | **Date-based versioning system.** `vYY.MM.DD` format, three-location sync (sw.js + app.js + index.html), auto-update end-to-end flow, manual update escape hatch, service worker lifecycle deep dive, debugging guide. |

---

## 🔧 When to Add a New File

Add a knowledge file when:

- ✅ A system is **used by multiple apps** in this repo (like the PWA install/update pattern).
- ✅ You've made a **design decision** that should be consistently applied across all future apps (like date-based versioning instead of semver).
- ✅ The implementation has **subtle details** that are easy to forget (like the `updateViaCache: 'none'` flag, or why `skipWaiting()` is safe here but not everywhere).
- ✅ You needed to **research something** and don't want to do that research again (like iOS PWA limitations).

## 🚫 When NOT to Add

Don't add knowledge files for:

- ❌ **One-off implementations** that won't be reused.
- ❌ **App-specific context** that belongs in that app's `context.md`.
- ❌ **General web development knowledge** that's well-documented on MDN or web.dev.
- ❌ **Content or design decisions** (colors, typography, layout) — those belong in each app's `context.md`.

---

## 🧭 How to Use This Folder

### Starting a new app

1. Read [`pwa-offline-installable.md`](./pwa-offline-installable.md) — copy the manifest, SW, and PWA JS patterns.
2. Read [`versioning.md`](./versioning.md) — set up the three-location version sync.
3. Copy the file structure from `sound-annoyer/` or `meditation-timer/` as a starting template.

### Updating an existing app

1. Check `versioning.md` for the bump checklist.
2. Bump all three version locations.
3. Deploy.

### Debugging a PWA issue

1. Check the "Common Pitfalls" section in `pwa-offline-installable.md`.
2. Check the "Debugging" section in `versioning.md`.
3. If you find and fix something that's not documented, add it.

---

## 📂 Existing PWA Implementations in This Repo

| App | SW Version | Pattern | Notable Features |
|---|---|---|---|
| `sound-annoyer/` | `v10.06.11` | Network-first shell, cache-first audio | Silent keep-alive for iOS lock-screen audio, wake primer for Bluetooth |
| `meditation-timer/` | `v26.06.19` | Same pattern | Streaming audio support (range requests), offline-safe update, "Download for offline" button, tappable version for updates |
| `harm-reduction-guide/` | *(no SW yet)* | Not yet a PWA | Documentation dashboard — offline not needed yet |

---

## 📖 External Reference

These are the authoritative sources that informed the knowledge files. When in doubt, consult these directly:

- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [MDN: Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [MDN: Web App Manifests](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [MDN: Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache)
- [web.dev: Install criteria](https://web.dev/install-criteria/)
- [web.dev: Offline cookbook](https://web.dev/offline-cookbook/)
- [web.dev: Service worker lifecycle](https://web.dev/service-worker-lifecycle/)
- [Safari Web Content Guide: PWA](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
- [Chrome: Service Worker Specification](https://w3c.github.io/ServiceWorker/)
