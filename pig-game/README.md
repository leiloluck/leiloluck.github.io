# Pig Game Track App - Audio Management

## Overview

This app dynamically loads audio files from the `audio/` folder structure. No need to manually edit HTML for each new sound!

## Folder Structure

```
audio/
├── start game/     (Background music for game start)
├── mid game/       (Background music for mid-game)
├── end game/       (Background music for end-game)
├── victory/        (Victory music)
├── sounds/         (Sound effects)
└── more sounds/    (Additional sound effects)
```

## Adding New Audio Files

### Quick Steps:
1. Add your `.mp3` file to the appropriate folder in `audio/`
2. Run: `python generate_audio_index.py`
3. Commit and push `audio-files.json` and the new audio file
4. Done! The button will appear automatically on the website

### Example:
```bash
# Add a new sound effect
# Copy new_sound.mp3 to audio/sounds/

# Generate updated JSON
python generate_audio_index.py

# Commit changes
git add audio/sounds/new_sound.mp3 audio-files.json
git commit -m "Add new sound effect"
git push
```

## How It Works

1. **Python Script** (`generate_audio_index.py`):
   - Scans all folders in `audio/`
   - Generates `audio-files.json` with file paths, colors, icons, and display names
   - Automatically assigns icons based on filename keywords

2. **JavaScript** (in `index.html`):
   - Loads `audio-files.json` on page load
   - Dynamically creates buttons with proper styling
   - Connects click handlers for music and sound effects

3. **GitHub Pages**:
   - Serves all static files (HTML, JSON, MP3s)
   - No server-side processing needed

## File Naming

The display name is automatically generated from the filename:
- `funny.mp3` → "funny"
- `Spinning_Monkeys.mp3` → "Spinning Monkeys"
- `O Fortuna 2.mp3` → "O Fortuna 2"

## Icon Assignment

Icons are automatically assigned based on keywords in the filename:
- "monkey" → 🐒
- "millionaire" → 💰
- "fortuna" → 🎵
- "boom" → 🔊
- etc.

You can customize icon mappings in `generate_audio_index.py` in the `ICON_MAP` dictionary.

## Color Schemes

Each category has a predefined rainbow color scheme that cycles through buttons. You can customize these in the `CATEGORIES` dictionary in `generate_audio_index.py`.

## Troubleshooting

**Q: New file doesn't appear on website?**
- Make sure you ran `generate_audio_index.py`
- Check that `audio-files.json` was updated
- Clear your browser cache or use incognito mode

**Q: Want to change the icon for a file?**
- Edit the `ICON_MAP` in `generate_audio_index.py`
- Re-run the script

**Q: Want to reorganize categories?**
- Move files to different folders in `audio/`
- Re-run `generate_audio_index.py`

## Development

To modify the Python script:
- Icons: Edit `ICON_MAP` dictionary
- Colors: Edit `CATEGORIES` dictionary
- Display names: Modify `clean_filename()` function

## Deployment

The app is fully static and works on GitHub Pages without any build process beyond running the Python script locally before committing.

---

## PWA: install, offline and updates (v26.08.30)

### Versioning
`version.js` holds `APP_VERSION` and is the single source of truth — `index.html` reads it
for the badge and `service-worker.js` `importScripts()`es it for the cache name. **Bump it
on every deploy.** The browser only reinstalls a service worker whose script changed
byte-for-byte, so an unbumped deploy is invisible to everyone who already has the app.

Registration uses `{ updateViaCache: 'none' }`. This is not optional here: the Chrome
default (`'imports'`) bypasses the HTTP cache for `service-worker.js` itself but **not**
for `importScripts('./version.js')` — so a `version.js` served from GitHub Pages'
10-minute HTTP cache made the new worker compute the *old* cache name and the update
quietly did nothing.

### Caches
- `pig-game-shell-v<APP_VERSION>` — the shell. **Network-first**, which is safe here only
  because all the CSS and JS are inlined into `index.html`: there is one shell file, so
  there is nothing to skew. (An app with separate unhashed `app.js`/`styles.css` must use
  cache-first from a version-keyed cache instead — fresh HTML plus stale JS is worse than
  slightly-old-but-consistent.) Network-first now races a 4-second timeout, so a stalled
  connection falls back to the cache instead of hanging the launch.
- `pig-game-audio` — the downloaded library. **Unversioned and never evicted**, so a
  version bump never costs the user hundreds of MB again.

Precaching uses `cache: 'reload'` to bypass the HTTP cache — GitHub Pages serves
everything `max-age=600`, so a plain `addAll()` shortly after a deploy can bake
10-minute-old bytes into the new version's cache. `install` no longer calls
`skipWaiting()` synchronously (it could activate, and `activate` deletes the previous
shell cache, before the precache had finished) and no longer swallows a failed
`addAll()` — a failed install must leave the *previous* worker in charge.

### Install
The button is **always visible** unless the app is already running standalone. It used to
be `display:none` until `beforeinstallprompt` fired, and that event is unreliable by
design — it never fires on iOS, is skipped when Chrome's engagement heuristic is not met,
and does not fire inside a Custom Tab. When there is no live prompt the button opens a
sheet with platform-specific steps.

**Brave on Android is a special case.** It fires `beforeinstallprompt` like any Chromium
browser, but it has no WebAPK minting server, so the result is a plain home-screen
shortcut: no app-drawer entry, no entry under Settings → Apps, no per-app battery setting.
The sheet says so and points at Chrome; "Install here anyway" is still offered. Desktop
Brave is unaffected and gets the native prompt directly.

### Icons
- `icon-192.png` / `icon-512.png` — `purpose: "any"`, transparent.
- `icon-maskable-512.png` — `purpose: "maskable"`, **opaque with the artwork inside the
  inner 80% safe zone**. Reusing the transparent `any` art here gave the Android adaptive
  icon notched corners and a cropped badge.
- `apple-touch-icon-180.png` — **opaque**. iOS ignores alpha and applies its own mask, so
  the old transparent 192px icon rendered as a black square on the home screen.

Regenerate them with `create_icons.py`, or from `icon-512.png` with Pillow.

### Layout notes
`viewport-fit=cover` is set so `env(safe-area-inset-*)` is non-zero — required now that
Chrome 135+ draws Android web content edge-to-edge. The sticky header pads by
`safe-area-inset-top` (it is also needed for `black-translucent` on iOS), the fixed tab bar
pads by `safe-area-inset-bottom`, and `--tab-bar-h` / `--player-h` are measured in JS on
load, resize and font load so the bottom spacer always clears both bars. The previous
hardcoded 70px + 120px assumption clipped the last row of buttons.

## Offline library and the close button (v26.09.18)

The library is ~940 MB (most music tracks are one-hour versions), so offline has to
survive a sleeping phone, a dropped connection and a full disk. Why it never really
worked before, and what replaced it:

- **Sound effects are offline from the first launch.** The service worker precaches the
  whole "Sounds" category (~1.6 MB) into `pig-game-audio` on install, best-effort.
- **"Download for offline" resumes.** Files already cached at their full size are skipped.
  The old loop re-fetched *everything* with `cache: 'reload'` on every retry, so one
  dropped connection anywhere in 940 MB meant starting over.
- **One file at a time, streamed into the cache.** The body is piped through a byte
  counter straight into `cache.put()`. The old code ran three 40-90 MB files in parallel
  *and* the service worker cached each one again from a tee of the same stream, so the
  slower copy buffered in RAM until the phone killed the page. Downloads now carry an
  `X-Pig-Download` header and the worker passes them through untouched.
- **Verified.** `audio-files.json` now records each file's `bytes` (written by
  `generate_audio_index.py`). A download that ends short is deleted, never trusted.
- **Space and sleep.** `navigator.storage.estimate()` is shown and checked before
  starting, `storage.persist()` is requested, and a screen wake lock is held while
  downloading (a sleeping phone freezes the page and stalls the transfer). The button
  turns into **Stop**; stopping keeps everything finished so far.
- **Honest UI.** The section shows "N of 42 tracks saved · X MB left". A track that is not
  saved wears a small cloud; offline it is dimmed, and tapping it explains why instead of
  playing silence.

On iPhone the installed app has its own storage, separate from Safari: download from
inside the installed app, not from the Safari tab.

## Reachability, not `navigator.onLine` (v26.09.21a)

Audited offline end to end in a real browser (Chrome, cache warmed, then the origin made
unreachable). What worked: the shell loads from `pig-game-shell-*` with no network at all,
the 14 precached sound effects play, and a byte-range request for a cached `.mp3` comes
back `206` with a correct `Content-Range` — which is what iOS media playback needs
([web.dev](https://web.dev/articles/sw-range-requests),
[philna.sh](https://philna.sh/blog/2018/10/23/service-workers-beware-safaris-range-request/)).

What did **not** work: every offline behaviour hung off `navigator.onLine === false`, and
that flag only reports that a network interface exists. In the place this app is used —
festival wifi that leads nowhere, one bar of signal that carries nothing, a captive portal
— `onLine` stays `true`, so:

- no cloud markers and no dimming: the library looked fully playable;
- tapping an undownloaded track said "Could not play this track." instead of naming the
  actual reason;
- **"Download for offline" started anyway** and ground through the remaining 900 MB one
  failure at a time, finishing with "⚠️ 0 saved, 28 failed. Tap to retry just those."

Fixed by making one cached verdict from a real probe the single source of truth:

- `checkNetwork()` / `isOffline()` reuse the `manifest.webmanifest?probe=` request the
  update button already made. The verdict is cached ~15 s, parallel callers share one
  in-flight probe, and `onLine === false` is still believed immediately (never a false
  negative). Flipping the verdict repaints the markers, the dimming and the summary.
- Probed on launch, on every return to the foreground and on `online` — a phone that walks
  out of range fires no event at all.
- Playback errors name the real cause: a track that is not in the cache failed because the
  bytes had to come off the network, whatever `onLine` says.
- The download bails out after three back-to-back failures if the probe says the network
  is gone: "📴 Connection lost. 150 MB saved; tap to continue once you are back online."
  instead of a list of every remaining file.
- The worker now ignores non-`GET` requests. Cache Storage only holds `GET`, so
  `serveShell`'s `cache.put()` on the success path would have thrown a `TypeError`.

**Close (X, top right)** — `shutdownApp()`. A web page cannot end its own OS process, so
the X releases everything the app holds: the music element and its buffered media
(`removeAttribute('src')` + `load()`), every sound effect, the seek timer, the lock-screen
media controls, a running download and the wake lock. Then `window.close()`, which closes
an installed app window and is ignored in a plain browser tab, where a "Closed" screen
says so and offers **Open again**. `closing` also stops a waiting update from reloading a
closed app. Same contract as poltergeist.exe and the meditation timer on leiloluck.github.io.
