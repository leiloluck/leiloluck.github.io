# Context — Pig Game Track App

> Subpage of **leiloluck.github.io**. Read this before touching any file in this folder.
> `docs/README.md` has the full technical history (caches, install, icons, layout);
> this file is the short brief.

## What it is

A soundboard for the Pig game: background music for each phase of a game (Start, Mid,
End, Victory) plus short sound effects. Music loops; effects play over it; a balance
slider trades music against effects. Installable PWA, usable offline.

## Where it lives

Moved on **2026-09-18** from `marcelpadilla.com/Pig_Game/` (repo `marcelpadilla.github.io`)
to **`leiloluck.github.io/pig-game/`**. The old address keeps two files as a migration shim:
a redirect `index.html` and a retirement `service-worker.js`, which deletes the old
`pig-game-*` caches there, unregisters itself and sends open windows here. The
`/Projects/Pig_Game/` shim from the earlier move points here directly too. The footer 🐖🐖 on
marcelpadilla.com links here.

The move changed the **origin**, and Cache Storage is per origin, so nothing downloaded at
the old address could be carried over. Old installs have to be installed again from here.
`manifest.webmanifest` `id` is `/pig-game/`.

## Files

Only what the browser needs at the top level sits in the root (since 26.11.22b);
everything else is in a folder.

| Path | Role |
|---|---|
| `index.html` | Everything: markup, inline CSS, inline JS (player, tabs, install, offline library, close) |
| `service-worker.js` | Shell network-first (4 s timeout) → cache; audio cache-first with Range support; precaches the sound effects. Must stay in the root: a worker only controls pages at or below its own folder. |
| `manifest.webmanifest` | Install metadata; `id` is `/pig-game/` |
| `context.md` | This brief (every app folder in the repo has one in its root) |
| `js/version.js` | `APP_VERSION` (`YY.MM.DD`), read by the page and `importScripts`'d by the worker. **Bump on every change.** |
| `icons/` | `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon-180.png` |
| `audio/` | ~940 MB of mp3s in `start game/`, `mid game/`, `end game/`, `victory/`, `sounds/`, plus `audio-files.json`, the track index (each file's `bytes` included). The worker routes by `.mp3`, so the index is still served as shell, not cached as audio. |
| `tools/` | `generate_audio_index.py` (rebuilds `audio/audio-files.json`; run after adding or renaming tracks), `create_icons.py` (writes `icons/`), `convert_mp3_128.cmd` (re-encodes mp3s in the folder it is run in) |
| `docs/` | Older write-ups: `README.md` (technical history) and the original guides (quick start, deploy, PWA install, colour notes). Not loaded by the app. |

The version lives in `js/version.js` only, so `tools/check_versions.py` at the repo root
(which expects `sw.js` + `js/app.js` + `index.html`) does not check this app.

## Offline

- **Verified** (2026-09-21, real browser, origin made unreachable): the shell loads with no
  network, the precached sound effects play, and a Range request for a cached mp3 returns a
  correct `206`.
- "Am I offline?" is **never** `navigator.onLine` alone — that flag is true on a wifi that
  leads nowhere, which is this app's normal habitat. `checkNetwork()` / `isOffline()` in
  `index.html` keep a cached verdict from a real `manifest.webmanifest?probe=` request, and
  the cloud markers, the dimming, the playback messages and the download guard all read it.
- Sound effects (~1.6 MB) are precached on install.
- Music (~940 MB, mostly one-hour tracks) is fetched by **Download for offline**: resumable,
  one file at a time streamed into `pig-game-audio`, size-verified, with a storage check
  and a screen wake lock. Tracks not yet saved show a ☁ and are dimmed offline.
- The owner decided (2026-09-18) to keep the audio as is. 13 of the one-hour tracks are a
  2-7 minute tune repeated; trimming them to one cycle would cut the library to roughly
  100-200 MB with no audible difference, since the app loops music. Not done on purpose.

## Header, install note, close

- One row on every phone: title (shrinks, never wraps), then only what applies: a **library
  icon** (outlined cloud while tracks still stream, green cloud with a tick once everything
  is downloaded; tap opens Settings; it replaced the cloud on every tile), an **Install**
  pill (only in a browser tab that has not installed the app), an **Update** pill (only
  when a newer version exists: a waiting worker, or a newer `js/version.js` on the server,
  compared as strings so a local build never offers a downgrade), and the **red X**. The
  version lives in Settings. The status line floats under the header.
- `installHint()` shows a note under the header only when the current browser cannot
  install a real app: Android anything-but-Chrome/Samsung-Internet → "Open this page in
  Chrome…"; iPhone in-app browsers or iOS < 16.4 outside Safari → "Open this page in Safari…".
  (Android: only Chrome with Google services and Samsung Internet on Samsung phones mint a
  WebAPK; others add a browser shortcut. iOS 16.4+: Safari, Chrome, Edge and Firefox can all
  Add to Home Screen.) Same logic as poltergeist.exe and the meditation timer.
- **X** → `shutdownApp()`: stops music and effects, releases the media elements, the seek
  timer, the lock-screen controls, any running download and the wake lock, then
  `window.close()`. In a plain tab (where close is refused) a "Closed" screen offers
  **Open again**.

## Tabs, Settings and the player

- Seven equal tabs: **All** (the default; every category, phases in order, effects last),
  Start, Mid, End, Victory, Sounds, Settings. The active tab gets a pill behind its icon.
- **Pager** (26.11.22c, `initializeTabLogic()` / `goTo()` / `enableSwipe()`): the page never
  scrolls (`body` is one screen tall, `overflow: hidden`); each tab is an absolutely placed,
  self-scrolling `.panel` with `contain: strict`. At rest the current panel is at 0 and its
  two neighbours a full width either side, already rendered. A swipe moves them 1:1 with the
  finger (once per animation frame), a release or a tab tap slides the pair with a 300 ms
  transform transition, and the order **wraps** at both ends. Only `transform` ever changes,
  so a switch costs ~1 ms of main-thread work instead of the ~20 ms relayout of the old
  show/hide cards, never moves the URL bar, and each tab keeps its own scroll position.
  Touch and pen only, screen edges left to the OS back gesture, vertical drags stay
  scrolling (`touch-action: pan-y` on the panels). Arrow keys step on a desktop.
  A track appears in All and in its phase tab, so per-track updates use `querySelectorAll`.
- **funny** is pinned first in Start (`PINNED_FIRST` in `tools/generate_audio_index.py`),
  so it is the first track of the app, and Play with nothing loaded starts it on any tab.
- **System bars**: `theme_color`, `background_color`, the `theme-color` meta, the header and
  the tab bar are all `#10061a`, so Android's status bar and gesture bar blend in (they were
  pink from the old manifest). An installed app picks up manifest colour changes when
  Chrome next refreshes it; reinstalling shows them at once.
- Tiles are an equal-width **grid** (2 / 3 / 4 columns for music, 3 / 4 for effects); a lone
  last tile is centred only where the column count is odd, otherwise left-aligned. It never
  stretches across the row.
- **Settings**, compact, top to bottom: the app (icon, name, version, one line, one button:
  Install app / Update now / Check for updates), the offline library, **Share**, Delete app.
  **Download for offline** lives here only. Delete offline files empties `pig-game-audio`
  only, so the shell still launches offline (`deleteOfflineFiles()`). Delete app
  (`deleteApp()`) is prefix-scoped throughout, because Cache Storage and localStorage are
  per ORIGIN and the other apps share it, and never reloads. A web page cannot remove its
  own home-screen icon, so the deleted screen says to.
- **Share** (same block in the meditation timer, poltergeist.exe and Your Final Words):
  Copy link always; the native share sheet (`navigator.share`, AbortError ignored) where it
  exists, otherwise direct WhatsApp (`wa.me/?text=`) and Telegram (`t.me/share/url`) links.
- **Player**: a floating card above the tab bar. Track icon (in the track's colour), name and
  phase; previous / play-pause / next as inline SVG (play with nothing loaded starts the
  first track of the visible tab); a buffering ring on play while loading; under it the
  seek bar (thin track, played part filled via `--p`) between elapsed and total time.
- The loaded track keeps a rainbow ring (`.is-current`), spinning while it plays
  (`.is-playing`), via an `@property --pig-angle` conic gradient.

## Style

Deliberately loud and colourful (it is a party game), an explicit exception to the
site's dark-minimal default. The page is deep plum under two oversized layers of soft
colour blobs that orbit slowly (`body::before/::after`, transform and opacity only, so the
GPU moves ready-made layers and nothing repaints). Cards are translucent without
`backdrop-filter`, which would be recomputed every frame over a moving background. The
drift keeps running under reduced motion at half speed, at the owner's request. Button colours come from the OKLCH rainbow in
`tools/generate_audio_index.py`. The Music/SFX balance bar is drawn on the range *track*
pseudo-elements, because the generic `input[type="range"]` rule outranks the class.
