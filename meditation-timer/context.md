# Meditation Timer

A minimalist meditation timer PWA. The user selects a sound and a duration; audio fades in at the start and fades out at the end. Installable, offline-capable.

**Version:** v09.06.26

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

## PWA Install Flow

```
First visit (Android Chrome):
  → beforeinstallprompt fires → deferredInstallPrompt stored
  → if NOT already installed: "Install" button appears

User clicks "Install":
  → deferredInstallPrompt.prompt() → native install dialog
  → if accepted: appinstalled event fires
    → localStorage.setItem('meditation-pwa-installed', '1')
    → button label changes to "Update"

Next launch (standalone / installed):
  → isStandalone = true (matchMedia or localStorage flag)
  → showUpdateBtn() called immediately at load
  → button shows "Update" from the start
```

`isStandalone` combines three checks with `||`:
1. `window.matchMedia('(display-mode: standalone)').matches` — reliable on Android Chrome
2. `window.navigator.standalone === true` — iOS Safari only
3. `localStorage.getItem('meditation-pwa-installed') === '1'` — fallback (persists across sessions)

Clicking "Update" when `deferredInstallPrompt` is null: clears all caches, unregisters the service worker, reloads → fresh install on next load.

**Android Chrome:** Fully supported. HTTPS (GitHub Pages) satisfies the PWA requirement. `beforeinstallprompt`, `appinstalled`, `display: standalone`, and Media Session API all work.

**iOS Safari:** Install is manual (Share → Add to Home Screen). `beforeinstallprompt` does NOT fire on iOS, so the Install button never appears. Standalone detection via `navigator.standalone`. No lock screen media controls.

---

## Service Worker (`sw.js`)

Cache name includes `VERSION` constant — bump it to force cache invalidation after any file change.

**App shell** (HTML, CSS, JS, manifest, icons): pre-cached on install event via `PRECACHE` array, then served **network-first** (`serveShell`). When online, every launch fetches the newest file and refreshes the cache; when offline, the cached copy is served, and uncached navigations fall back to `./index.html`. This guarantees an online user always runs the latest deploy rather than a stale cached version.

**Auto-update:** the SW calls `skipWaiting()` + `clients.claim()`, and `app.js` reloads the page once on `controllerchange` (guarded so it never fires on first install or mid-session) and calls `registration.update()` on load and on each `visibilitychange` to visible. Net effect: a freshly deployed version is picked up within one launch and never interrupts a running session.

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
| `meditation-pwa-installed` | `'1'` after PWA install; used to show Update button |
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
