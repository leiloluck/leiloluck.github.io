# Technical Notes — leiloluck.github.io

## Hosting & deployment
- **Platform:** GitHub Pages, served at `https://leiloluck.github.io`.
- **Deployment:** commits pushed to the `main` branch publish automatically. There
  is no CI build step — the repository is served as-is.
- **Stack:** plain HTML, CSS, and JavaScript. No framework or bundler unless a
  subpage documents one.

## Per-subpage notes

### `harm-reduction-guide/`
- **Rendering:** Tailwind CSS and Chart.js load from CDNs in `index.html` (no local
  build); custom CSS in `css/styles.css`.
- **Data:** the single source of truth is `data/protocols.json`. `js/data.js` fetches
  it at runtime and also carries an inline `_inlineProtocols` fallback for `file://`
  preview. **The fallback is generated from `protocols.json`, never hand-edited** —
  re-serialise with `JSON.stringify(…, null, 4)` and a deep-equal check keeps them
  identical. `js/comboData.js` loads the TripSit interaction matrix from
  `resources/tripsit-combo/combos.json`, with a small curated overlay for documented
  gaps.
- **PWA:** intentionally decommissioned — `sw.js` only unregisters any previously
  installed worker; there is no offline cache. The version is a footer stamp
  (`vYY.MM.DD`), not a service-worker cache key.
- **Privacy:** no analytics, cookies, or tracking.

### PWA subpages (`sound-annoyer/`, `meditation-timer/`, …)
- Installable PWAs with a service worker. The version constant appears in three
  places in lockstep — `index.html`, `sw.js` (`VERSION`), and `js/app.js`
  (`APP_VERSION`) — format `vYY.MM.DD`; bump all three on every change. See each
  subpage's `context.md` and the repo `knowledge/` notes.

## Local preview
- Because `harm-reduction-guide` uses `fetch()` for its JSON, opening `index.html`
  directly via `file://` falls back to the inline data (fetch is CORS-blocked). For a
  faithful preview, serve the folder over HTTP (e.g. `python -m http.server`) and open
  `http://localhost:8000/harm-reduction-guide/`.
