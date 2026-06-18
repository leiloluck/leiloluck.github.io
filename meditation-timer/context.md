# Meditation Timer

A minimalist meditation timer PWA. The user selects a sound and a duration; audio fades in at the start and fades out at the end. Installable on Android + iPhone, offline-first.

**Version:** v26.06.19 (format `vYY.MM.DD` — year.month.day; bump on every change, in
lockstep across `index.html`, `sw.js` `VERSION`, and `js/app.js` `APP_VERSION`).

---

## Files

| File | Role |
|---|---|
| `index.html` | App shell, all markup, PWA meta tags |
| `css/styles.css` | Warm dark palette, diagonal gradient, responsive layout |
| `js/app.js` | Everything: audio engine, timer, beat scheduler, UI, PWA logic |
| `sw.js` | Service worker: cache-first shell, streaming audio |
| `manifest.json` | PWA manifest (standalone, amber theme) |
| `icons/` | PNG icons (192, 512, 180) + SVG |
| `resources/` | Audio files |

---

## State Machine

The app has one global `state` variable with four values:

```
idle ──[Begin]──► playing ──[Pause]──► paused ──[Resume]──► playing
                    │                                         │
              [timer ends]                              [timer ends]
                    │                                         │
                    ▼                                         ▼
                finishing ──[fade complete]──► idle
```

- `idle` — no session running; UI shows selected duration
- `playing` — rAF loop ticking, audio running, gain at 1
- `paused` — rAF stopped, gain faded to 0, audio element paused
- `finishing` — session timer hit 0 OR fade-out started; play button disabled; audio fading to 0

State transitions happen in: `startSession`, `pauseSession`, `resumeSession`, `stopSession`, `onSessionEnd`, and `tick` (which flips `playing → finishing` when the fade-out window is reached).

---

## Audio Engine

All audio goes through a single Web Audio API graph:

```
AudioElement ──► MediaElementSource ──► GainNode ──► AudioContext.destination
```

The `GainNode` is the only volume control. All fades (session start, session end, pause, resume) are scheduled as Web Audio gain ramps — never via `setInterval` or CSS transitions.

`ensureAudio()` creates the audio element and the full graph lazily (first call only). Switching sounds destroys the entire graph (`audioCtx.close()`) and nulls all references so the next `ensureAudio()` starts fresh.

**Important:** `gainNode.gain.value` reflects the current instantaneous value. Always call `cancelScheduledValues(audioCtx.currentTime)` before setting new ramps to avoid conflicting schedules.

### Lock-screen scheduling (critical)

`requestAnimationFrame` and `setTimeout` are frozen by the OS while the phone is
locked or the tab is backgrounded. The **Web Audio hardware clock keeps running**
(as long as the context is not suspended). Therefore every audio event that must
fire while the screen is off is placed on the audio clock at session start, not
triggered by a JS timer:

- **Fade-out** — scheduled as a `linearRampToValueAtTime(0, …)` landing exactly at
  the session end, set inside `scheduleAudioFrom()`.
- **Triple end bell** — three `AudioBufferSourceNode`s started at `end`, `end+0.4`,
  `end+0.8` (`END_BELL_OFFSETS`), routed straight to the destination so they ring at
  full volume after the session audio has faded out.
- **Interval beats** — one buffer source per beat, scheduled across the whole
  session, routed through the gain node so they fade with the envelope.

`scheduleAudioFrom(remainingMs, resuming)` (re)builds this entire schedule from
`audioCtx.currentTime`. It is called by `startSession` (`resuming=false`) and
`resumeSession` (`resuming=true`).

`scheduledSources[]` holds every source scheduled ahead; `clearScheduledSources()`
stops and forgets them all on **pause**, **stop**, and **sound switch** so stale
beats never leak into a later session.

**Keeping the context awake.** Two layers:

- `startKeepAlive()` plays a silent looping Web Audio buffer for the whole session.
  Enough on Android/desktop; harmless in `loop` mode (which already has continuous
  media).
- `startSilentKeepAlive()` (interval mode only) plays a real silent looping
  `<audio>` element built from a generated WAV `Blob` (`makeSilentWavBlob`, served
  as a `blob:` URL because the CSP permits `blob:` but not `data:` media). **iOS
  suspends the AudioContext whenever no media element is playing**, and a Web Audio
  buffer does not count — only a playing `<audio>` element holds the platform audio
  session open. This is what makes interval-mode bells survive a locked screen on
  iPhone. Both keep-alives are torn down on pause/stop/end and on sound switch.

`tick()` (the rAF loop) now only updates the visible countdown and disables the
play button during the fade-out window. If the screen is locked it simply doesn't
run; the audio still ends correctly because it was scheduled on the audio clock.
`onSessionEnd()` no longer plays anything — it only tidies up the UI and stops the
silent playback once the page is visible again.

### Fade types

| Scenario | Type | Duration |
|---|---|---|
| Session start | `linearRampToValueAtTime` 0→1 | 8 s |
| Session end | `linearRampToValueAtTime` 1→0 | 10 s |
| Pause / Stop | `exponentialRampToValueAtTime` 1→0.001 | 2 s |
| Resume | `exponentialRampToValueAtTime` 0.001→1 | 0.5 s |

For sessions shorter than 25 s, all fade durations are scaled proportionally (`scaledFades()`).

The end-of-session fade is **not** fired by a timer. It is scheduled up front inside `scheduleAudioFrom()` as a gain ramp landing on zero exactly at the session end, so it runs even while the screen is locked. `tick()` only mirrors it in the UI: once the remaining time enters the fade-out window it sets state `'finishing'` and disables the play button.

`bgFadeTimeout` is a `setTimeout` that fires after a pause/stop fade to call `audioEl.pause()`. It must be cleared with `clearTimeout(bgFadeTimeout)` on resume to prevent the audio element being paused mid-resume.

---

## Sound Types

Each entry in `SOUNDS` has a `type` field that changes how the audio is played:

### `type: 'loop'`
`audioEl.loop = true`. The audio element handles repetition natively. `startSession` calls `audioEl.play()` once. `resumeSession` calls `audioEl.play()` to resume from the paused position.

### `type: 'interval'`
No media element playback. Each beat is a pre-decoded `bellBuffer` scheduled on the
audio clock by `scheduleAudioFrom()` (a buffer source per beat at `n * intervalMs`,
routed through the gain node so beats fade with the envelope). This replaced the old
`setTimeout` + `audioEl` approach, which silently stopped advancing whenever the
screen was locked. `startKeepAlive()` keeps the context alive between beats.

---

## Timer

`requestAnimationFrame` loop (`tick(now)`). Each frame computes:
```
elapsed = elapsedMs + (now - startTimestamp)
remaining = sessionDurationMs - elapsed
```

`elapsedMs` accumulates across pauses. On pause: `elapsedMs += performance.now() - startTimestamp`. On resume: `startTimestamp = performance.now()`.

The rAF loop is cancelled with `cancelAnimationFrame(rafId)` on pause, stop, and session end. It drives the **display only** — the audio schedule is independent (see Lock-screen scheduling above), so a frozen rAF loop never affects whether the session ends or the bells ring.

---

## PWA install / update / version

This mirrors the SoundAnnoyer app so both behave the same. Three footer controls plus a
tappable version label:

- **Install app** — a *smart* button. If the browser queued a `beforeinstallprompt`
  (Android / desktop) it fires the native install dialog. Otherwise (iPhone Safari,
  which never fires it) it opens an **install-instructions modal** with platform steps
  (`installSteps()` detects iOS / Android / desktop). When the app is already running
  standalone the button shows "✓ Installed" and is disabled. `isStandalone()` =
  `matchMedia('(display-mode: standalone)')` `||` `navigator.standalone` (no localStorage
  flag — viewing in a browser correctly still offers install).
- **Update** and the **tappable version** both call `runUpdate()` — the manual jump to
  the newest build. **Offline-safe:** if `navigator.onLine === false` it does nothing
  destructive (wiping caches with no network would brick the app) and just flashes
  "Offline — cached ✓". Online it clears caches, unregisters the SW, and reloads. **Do
  not remove this offline guard.**
- **Download for offline** — fetches the large `.mp3`s (the soundtrack is ~44 MB, too big
  to precache) so the full app works without a connection; shows "Audio offline ✓" once
  cached. The app *shell* is already offline via the cache-first SW; this is only for the
  audio.

**Android Chrome:** native prompt + `appinstalled` + `display: standalone` + Media Session.
**iOS Safari:** no `beforeinstallprompt`, so Install opens the Add-to-Home-Screen steps;
standalone detected via `navigator.standalone`; no lock-screen media controls.

---

## Service Worker (`sw.js`)

Cache name includes `VERSION` constant — bump it to force cache invalidation after any file change.

**App shell** (HTML, CSS, JS, manifest, icons): pre-cached on the install event via `PRECACHE`, then served **cache-first** (`serveShell`) so the installed app boots and runs with zero network. On a cache miss it fetches and caches; uncached navigations fall back to `./index.html`.

**Freshness / auto-update:** comes from the SW lifecycle, not a per-launch network hit. The SW calls `skipWaiting()` + `clients.claim()`; `app.js` registers with `updateViaCache:'none'`, calls `registration.update()` on load and on each `visibilitychange` to visible, and reloads the page once on `controllerchange` (guarded so it never fires on first install or mid-session). So a bumped `VERSION` precaches a new version-keyed cache in the background and takes over within one launch — never interrupting a running session. The **Update** button / version tap are the manual jump (online only; see PWA section).

**Audio (.mp3)**: NOT pre-cached (files are large). Strategy:
- If cached: serve full `200` response (browsers accept `200` in place of `206` for `<audio loop>`)
- If not cached + range request: pass through to network (native streaming)
- If not cached + full request (from "Download for offline" button): fetch, cache, return

The `serveAudio` function strips the `Range` header from the cache key so the stored full response matches all subsequent requests regardless of range headers.

---

## localStorage Keys

| Key | Purpose |
|---|---|
| `meditation-custom-min` | Saved custom duration (integer, minutes) |
| `meditation-audio-cached` | `'1'` after "Download for offline" succeeds |

---

## Design

Diagonal dark-gold-to-black gradient background. Single-column layout, max-width 420px, centred. No scroll (`overflow: hidden`, `height: 100dvh`).

| Token | Value |
|---|---|
| Background | `linear-gradient(to bottom right, #3d2900, #000000)` |
| Surface | `#1e1710` |
| Border | `#3a2e22` |
| Accent | `#c9934a` |
| Text | `#f0e2cc` |
| Muted | `#8a7060` |

---

## Audio Files

| File | Duration | Type |
|---|---|---|
| `resources/bowls long interval.mp3` | ~44 MB, ~1 hr | `loop` |
| `resources/Single bowl sound.mp3` | ~1.5 MB, ~39 s | `interval` (60 s cycle) |

Both files have metadata stripped via `ffmpeg -i input.mp3 -map_metadata -1 -c:a copy output.mp3`.

---

## Adding a New Sound

1. Drop MP3 into `resources/`. Strip metadata: `ffmpeg -i input.mp3 -map_metadata -1 -c:a copy output.mp3`.
2. Add an entry to `SOUNDS` in `js/app.js`:
   - Loop: `{ id, label, sub, file, type: 'loop' }`
   - Interval: `{ id, label, sub, file, type: 'interval', intervalMs: 60000 }`
3. Bump `VERSION` in `sw.js` to bust the cache.
