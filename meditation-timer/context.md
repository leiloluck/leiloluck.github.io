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

**Keeping the context awake.** Two layers that do *different* jobs — both run in
**both** sound modes (as of v26.08.30; `startSilentKeepAlive()` used to be
interval-only, which is a large part of why the end bell went missing):

- `startKeepAlive()` loops a faint **25 Hz Web Audio tone at amplitude 0.002**. Its job
  is to clear Chrome's audibility gate — an exact constant, mean-square power
  ≥ `-72.24719896` dBFS (RMS ≥ 2⁻¹²), in `services/audio/output_stream.cc`. Ours sits
  at −57 dBFS, 15 dB clear. Passing that gate is what stops Chrome throttling timers
  and **freezing the page**; a frozen page's AudioContext stops too, and every
  pre-scheduled bell dies with it. It must never be digital silence.
- `startSilentKeepAlive()` loops a real `<audio>` element carrying the same faint tone
  from a generated 10-second WAV `Blob` (served as a `blob:` URL because the CSP
  permits `blob:` but not `data:` media). Its job is the **platform audio session**.
  On iOS, WebKit suspends the AudioContext whenever no media element is playing. On
  **Android 17** (stable 2026-06-16) background audio without a foreground service is
  *silently muted*, and Chrome only runs its `mediaPlayback` foreground service while a
  media notification is showing — which requires a real media element **longer than
  5 seconds**. A bare AudioContext is `kAmbient` and is explicitly ignored for Android
  audio focus. The 10 s clip length is therefore load-bearing.

  **Why it must run in `loop` mode too, even though the soundtrack is a media element:**
  the soundtrack goes through the fade gain, so it is silent for the last 10 seconds of
  every session — exactly when the end bell is due. This element bypasses the gain node.

Both keep-alives are torn down on pause, stop, end, and sound switch.

**Recovering a suspended context.** `audioCtx.onstatechange` resumes the context if the
OS suspends it (audio focus lost to a call or a notification), and a `visibilitychange`
handler does the same on return to the foreground. The Page Lifecycle `resume` event
only fires after an actual *freeze* — it does not fire on a plain suspend — so without
these a single interruption silently ended the session in total silence. This was the
concrete cause of "turning off the screen doesn't bring the final sound".

**`navigator.audioSession.type = 'playback'`** is set when available (Safari 16.4+).
WebKit's `shouldOverrideBackgroundPlaybackRestriction()` returns true *only* for that
session type, so it is the one lever that makes backgrounded playback work on iPhone.

**Ending the session is also on the audio clock.** `tick()` (the rAF loop) only updates
the visible countdown and disables the play button during the fade-out. While the screen
is off it does not run at all — so `onSessionEnd()` does not run either, and the old
build kept the keep-alive, the soundtrack element and the whole graph alive until the
user next picked the phone up. `scheduleAudioFrom()` now also schedules a silent
one-frame **end sentinel** at `end + 4 s`; its `onended` calls `releaseAudioHold()`,
which stops both keep-alives, pauses the track and zeroes the gain. `onSessionEnd()`
calls the same function when the screen comes back — it is idempotent.

**The bell is decoded at page load, not at session start.** `scheduleHit()` drops every
hit while `bellBuffer` is `null`, and the 1.5 MB bell used to only start downloading
inside `startSession()` — so the first session of every page load scheduled no interval
beats and no end bell, and relied on a re-schedule once the decode landed. `ensureAudio()`
now runs during init. The bell is also **precached by the service worker**, because it is
not background music: it *is* the end chime, and without it the session ends in silence.
A failed decode is surfaced in the status line instead of being swallowed.

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
  the newest build. It escalates gently: probe real connectivity → hand over an already
  waiting worker → `reg.update()` → and only if the page's `APP_VERSION` still disagrees
  with the worker's `VERSION`, wipe *this app's* caches and re-register. **Offline-safe:
  do not remove this guard** — wiping caches with no network bricks the app. The probe
  fetches an actual byte rather than trusting `navigator.onLine`, which reports `true`
  on a captive portal or a dead uplink.
- **Download for offline** — fetches the large `.mp3` (the soundtrack is ~44 MB, too big
  to precache) so the full app works without a connection; shows "Audio offline ✓" once
  cached. It now checks **this app's own caches** for the actual soundtrack URL. The old
  version asked "is any `.mp3` cached anywhere on the origin?" — and SoundAnnoyer, same
  origin, caches twelve of them, so the button reported "already downloaded" for a file
  that had never been fetched and the app failed silently offline.

**Android Chrome:** native prompt + `appinstalled` + `display: standalone` + Media Session.
**iOS Safari:** no `beforeinstallprompt`, so Install opens the Add-to-Home-Screen steps;
standalone detected via `navigator.standalone`; no lock-screen media controls.

---

## Service Worker (`sw.js`)

Cache name includes `VERSION` constant — bump it to force cache invalidation after any file change.

**App shell** (HTML, CSS, JS, manifest, icons): pre-cached on the install event via `PRECACHE`, then served **cache-first** (`serveShell`) so the installed app boots and runs with zero network. On a cache miss it fetches and caches; uncached navigations fall back to `./index.html`.

### Caches

Two caches, and the split matters:

- `meditation-timer-<VERSION>` — the shell. Version-keyed, replaced wholesale on every
  bump, so index.html / app.js / styles.css always come from one deploy and cannot skew.
- `meditation-timer-audio` — the bell and (once downloaded) the ~44 MB soundtrack.
  **Unversioned and never evicted.** It used to live in the versioned cache, so every
  single version bump silently threw away a 44 MB download the user had deliberately
  asked for.

`caches.keys()` is per **origin**, not per app, and this site hosts several. Every
deletion — `activate`, `hardReset()`, anywhere — is prefix-scoped *and* skips the audio
cache. The same applies to anything that *reads* the origin's storage: `isAudioCached()`
checks the specific `type: 'loop'` file in our own audio cache. It previously asked "is
any .mp3 cached anywhere?", which SoundAnnoyer's twelve sounds answered for it, and then
matched any `SOUNDS[].file` — which the precached bell answered for it. Either way the
button reported "Audio offline ✓" for a soundtrack that had never been fetched.

**Precaching uses `cache: 'reload'`.** A plain `addAll()` fetches through the browser's HTTP cache, and GitHub Pages serves everything `Cache-Control: max-age=600` — so a worker installing within ten minutes of a deploy could bake *old* bytes into the *new* version's cache and, because cache-first never revalidates, pin the app to a stale build under a fresh version number permanently. This was the real cause of "I open it and get the old version".

**Old-cache eviction is prefix-scoped** to `meditation-timer-`. `caches.keys()` is per-origin and this site hosts several apps; the old unscoped filter deleted SoundAnnoyer's cache on every update here, and SoundAnnoyer's returned the favour by deleting the 44 MB soundtrack the user had explicitly downloaded.

**The bell (`Single bowl sound.mp3`, 1.5 MB) IS precached** — into the *audio* cache, best-effort, and only if not already there. Keeping it out of the atomic shell `addAll` means a flaky connection can't block a shell update; keeping it out of the versioned cache means it isn't re-downloaded on every bump. Only the ~44 MB soundtrack is left for the user to fetch on demand. See the audio-engine section for why the bell must be offline at all.

**Freshness / auto-update:** comes from the SW lifecycle, not a per-launch network hit. The SW deliberately does **not** call `skipWaiting()` on install: the shell is cache-first, so a worker that activates mid-session would serve new JS/CSS to a page running the old code. Instead the new worker waits, and `app.js` sends it `SKIP_WAITING` the moment `state === 'idle'` — from session stop, session end, and on becoming visible — after which `controllerchange` reloads unconditionally. The previous build had this backwards: it let the worker take over immediately and deferred the *reload*, which was then simply dropped, so an update arriving during a session never landed at all.

`app.js` registers with `updateViaCache:'none'` and re-checks on load, on foreground and on `online`, throttled to once a minute. It also compares its own `APP_VERSION` against the worker's `VERSION` and self-heals a mismatch once per browsing session.

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
