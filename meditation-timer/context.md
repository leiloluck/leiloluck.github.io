# Meditation Timer

A minimalist meditation timer PWA. The user selects a sound and a duration; audio fades in at the start and fades out at the end. Installable on Android + iPhone, offline-first.

**Version:** v26.10.17 (format `vYY.MM.DD` — year.month.day; bump on every change, in
lockstep across `index.html`, `sw.js` `VERSION`, `js/app.js` `APP_VERSION` and this file).

---

## Files

| File | Role |
|---|---|
| `index.html` | App shell, all markup, PWA meta tags |
| `css/styles.css` | Zen skin (sumi / kinari / gold / shu), ensō hero, breathing animation, responsive layout |
| `js/app.js` | Everything: audio engine, timer, bell scheduler, UI, PWA logic |
| `sw.js` | Service worker: cache-first shell, streaming audio |
| `manifest.json` | PWA manifest (standalone, amber theme) |
| `icons/` | App icon: the brushed gold ensō centred on a 10:10 clock; PNG (192, 512, 180, maskable 512) + SVG |
| `fonts/` | Self-hosted Latin subsets: Shippori Mincho 700, Zen Maru Gothic 500/700 + their OFL licences |
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

All audio goes through one Web Audio graph (since v26.10.14 every scheduled strike has its
own gain stage — see "Scheduled sources" below):

```
soundtrack <audio> ──► MediaElementSource ──► gainNode (track fader) ──► destination
random strike ──► AudioBufferSource ──► own GainNode (loudness match) ───► destination
end bell      ──► AudioBufferSource ──► own GainNode ──► bellOut (0.55) ─► destination
end sentinel  ──► AudioBufferSource ──► own GainNode (0, silent) ────────► destination
keep-alive 25 Hz ──► AudioBufferSource (loop) ──────────────────────────► destination
keep-alive <audio> (blob: WAV, plays outside the graph)
```

`gainNode` fades only the soundtrack (loop mode); random mode never touches it. All fades
are Web Audio gain ramps — never `setInterval` or CSS transitions.

`ensureAudio()` creates the audio element and the full graph lazily (first call only, at
init). The element always carries the soundtrack (`TRACK_FILE`); switching sounds never
touches the graph or the element (v26.10.14: the old src swap mid-fade was a hard cut).

**Important:** read `gain.value` *before* `cancelScheduledValues()` — cancelling drops the
ramp in progress, and the value then reverts to the ramp's start, not where it had got to.
Every fade (`fadeTrackOut`, `releaseSources`, `scheduleAudioFrom`) does it in that order.

### Lock-screen scheduling (critical)

`requestAnimationFrame` and `setTimeout` are frozen by the OS while the phone is
locked or the tab is backgrounded. The **Web Audio hardware clock keeps running**
(as long as the context is not suspended). Therefore every audio event that must
fire while the screen is off is placed on the audio clock at session start, not
triggered by a JS timer:

- **Fade-out** — scheduled as a `linearRampToValueAtTime(0, …)` landing exactly at
  the session end, set inside `scheduleAudioFrom()`.
- **Triple end bell** — three `AudioBufferSourceNode`s started at `end`, `end+0.4`,
  `end+0.8` (`END_BELL_OFFSETS`), through the `bellOut` headroom gain (0.55, ~5 dB, so
  three overlapping strikes cannot clip), bypassing the soundtrack fade so they ring at
  full volume after it has faded out.
- **Random strikes** — one buffer source per strike of the sampled plan (random mode).

`scheduleAudioFrom(remainingMs, resuming)` (re)builds this entire schedule from
`audioCtx.currentTime`. It is called by `startSession` (`resuming=false`),
`resumeSession` (`resuming=true`) and `resyncRunningSession` (a late decode).

### Scheduled sources and the no-cut rule

`scheduledSources[]` holds every buffer source scheduled ahead. Each carries its own gain
stage (`src.__g`) and start time (`src.__when`), set by `scheduleBuffer()`:

- `dropPendingSources()` — stops only sources that have not started (silent, so no click)
  and keeps the sounding ones. Used by `resyncRunningSession` (late decode): a bell that is
  already ringing keeps ringing, and `scheduleAudioFrom` skips plan events in the past so
  it is not struck twice.
- `releaseSources()` — the same, then ramps each sounding source's own gain to 0.001 over
  `PAUSE_FADE_OUT` (2 s, exponential) and `stop()`s it at the end of the ramp on the audio
  clock. Used by pause, stop (and so by sound switch and duration change, which go through
  `stopSession`) and Begin (the previous session's ~40 s end chime may still be ringing).
- `clearScheduledSources()` — hard stop. Only the X (`shutdownApp`) uses it; the context is
  closed straight after anyway.

**No sound is ever hard-cut** (the X excepted). Every audio path and every stop path:

| Stop path | Soundtrack (loop) | Random strike / end chime | Keep-alives |
|---|---|---|---|
| Pause (button, lock screen) | `fadeTrackOut` 2 s, element paused after | `releaseSources` 2 s | stopped after the fade |
| Stop / Reset | `fadeTrackOut` 2 s, element paused after | `releaseSources` 2 s | stopped (inaudible 25 Hz) |
| Sound switch, duration change | via `stopSession` (as Stop) | via `stopSession` | via `stopSession` |
| Begin while the last session still sounds | ramps up from the live level, no seek | `releaseSources` 2 s | restarted |
| Session end | 10 s fade lands on 0 at the end | last bell rings out → 3 s gap → chime rings out | released by the sentinel after the chime |
| Late decode (bell or random set) | envelope re-laid from the live level | `dropPendingSources` — ringing one untouched | untouched |
| Update reload | only when idle AND after `quietAt` | (same) | (same) |
| X close | hard stop + `ctx.close()` — deliberate | hard stop | released |

Peaks: random bells × their loudness gain are ≤ 0.50 FS (measured on the decoded
buffers), strikes never overlap by construction, and the chime path has the 0.55
headroom gain. The only overlap is a released (fading, ≤ −6 dB within 0.2 s) bell under a
fresh strike after an immediate Stop → Begin.

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
inside `startSession()` — so the first session of every page load scheduled no end bell,
and relied on a re-schedule once the decode landed. `ensureAudio()` now runs during init
(and so does `loadRandomBells()` when random is the mode on screen). The bell is also
**precached by the service worker**, because it is not background music: it *is* the end
chime, and without it the session ends in silence. A failed decode is surfaced in the
status line instead of being swallowed; `loadBell` retries 4× (1, 2, 4, 8 s, `cache:
'reload'`), and a decode landing mid-session re-lays the schedule via
`resyncRunningSession`.

### Fade types

| Scenario | Type | Duration |
|---|---|---|
| Session start | `linearRampToValueAtTime` 0→1 | 8 s |
| Session end | `linearRampToValueAtTime` 1→0 | 10 s |
| Pause / Stop (soundtrack, `fadeTrackOut`) | `exponentialRampToValueAtTime` 1→0.001 | 2 s |
| Pause / Stop / Begin (each sounding bell, `releaseSources`) | `exponentialRampToValueAtTime` level→0.001, then `stop()` | 2 s |
| Resume (soundtrack) | `linearRampToValueAtTime` →1 | 0.5 s |

For sessions shorter than 25 s, all fade durations are scaled proportionally (`scaledFades()`).

The end-of-session fade is **not** fired by a timer. It is scheduled up front inside `scheduleAudioFrom()` as a gain ramp landing on zero exactly at the session end, so it runs even while the screen is locked. `tick()` only mirrors it in the UI: once the remaining time enters the fade-out window it sets state `'finishing'` and disables the play button.

`bgFadeTimeout` is a `setTimeout` that fires after a pause/stop fade to call `audioEl.pause()`. It must be cleared with `clearTimeout(bgFadeTimeout)` on resume, and on a loop-mode Begin, to prevent the element being paused mid-session. A random-mode Begin leaves it pending on purpose: after a Soundtrack → Random switch it parks the still-fading track.

---

## Sound Types

Each entry in `SOUNDS` has a `type` field that changes how the audio is played:

### `type: 'loop'`
`audioEl.loop = true`. The audio element handles repetition natively. `startSession` calls `audioEl.play()` once. `resumeSession` calls `audioEl.play()` to resume from the paused position.

### `type: 'interval'` — retired in v26.10.14

The fixed 1-minute interval bell was hidden in v26.10.10 and replaced by random bells
(v26.10.12). v26.10.14 removed its code (`BELL_DETUNE_SD`, `randn()`, the interval branch
of `scheduleAudioFrom`, `scheduleHit`'s detune/through-gain paths) rather than keep an
untested path alive through the no-cut refactor. It is in git history at v26.10.13.
`Single bowl sound.mp3` stays — it is the end chime (`BELL_FILE`, not a `SOUNDS` entry).

### `type: 'random'`

Random bells (the second, beta-default Sound entry; the study behind it lives in
`resources/bells.html`'s "Tuned 3" tab and `resources/sources.md`). Three denoised,
loudness-matched bell recordings (`resources/random/*.flac`, lossless, ~3.9 MB total,
precached best-effort into the audio cache) — G3 −27¢ and C4 were retired as the
palette's two shortest tails (v26.10.17). No media element plays; every strike is a
decoded `AudioBufferSourceNode` whose `playbackRate` pitches it across ±3 semitones
(one palette of 3 bells × 7 pitches), with its own gain stage carrying the loudness
match.

- **Codec fallback (v26.10.14).** WebKit's `decodeAudioData` (AudioFileReaderCocoa.mm)
  maps FLAC to `audio/flac` and decodes it through AVFoundation, so iOS 11+ *should*
  decode it — unverified on a device. `loadRandomBell()` therefore tries `.flac`, and on a
  **decode** failure (not a network one) switches `randomCodec` to `'mp3'` for the page's
  life and loads the 320 kbps twins (`resources/random/*.mp3`, ~2.7 MB, same mean/peak
  level to 0.1 dB, ~−85 dB codec noise floor — 50 dB under the recordings' own hiss). The
  first bell is the probe, so a FLAC-less engine fetches one FLAC, not three. The twins are
  not precached; the page stores them in the audio cache itself on fallback (a first-visit
  fetch is not yet controlled by the worker). `RANDOM_BELLS[].file` has no extension.
- `loadRandomBells()` has an in-flight guard (`randomLoading`; init, the selector and Begin
  all ask) and drops its result if random mode was left meanwhile. A failure says so in
  the status line in every state; the next Begin or mode pick retries.

- **The whole session is sampled instantly at start** (`sampleRandomPlan`): a strike at
  t = 0, then waits = ring-out + 8 s floor + a truncated-exponential draw (mean 8 s, hard
  cap 56 s = 2 × the longest audible ring), and never the same bell at the same pitch
  twice in a row (`pickRandomBell`). **The wait clock starts when the bell crosses its
  audible threshold (`ring40`) — not when its file ends**: the silent tail (bell_001
  carries ~1.3 s of it) is never counted as waiting time, and no sound is ever cut —
  every strike plays its full buffer to its natural end.
- **The ending is protected by the sample, not by a fade.** Nothing may collide with the
  last 3 s: the final bell is pulled in / dropped so it rings out, a 3 s gap follows, then
  the existing triple chime (`END_BELL_OFFSETS`) rings at the nominal end. The pulled-in
  final bell is the one place the 8 s floor does not hold: it may follow the previous
  ring-out by as little as 1 s (`tFit >= prev.t + prev.ring + 1`, the study's "squeeze"
  rule, same in bells.html). There are no start/end fades — the bells ARE the session.
  `tick()`'s "finishing" flip is loop-mode only, so the UI never claims "Fading out…"
  while a bowl is still singing.
- **The opening strike must fit too** (v26.10.14): `sampleRandomPlan` opens with a bell
  whose ring ends before D − 3 s, or with none. Every full session (≥ 1 min) fits any bell;
  this matters for a late-decode remainder, which used to be able to strike a bell that
  rang straight over the chime.
- **Pause/stop never cut a ringing bell**: `releaseSources()` drops strikes that have not
  started and fades the sounding one (or the end chime) on its own gain over 2 s, stopping
  it when the fade lands. Resume re-schedules the remaining plan (`scheduleAudioFrom` skips
  events already past; a bell interrupted mid-ring is not restarted).
- A late decode re-samples the remainder of the session (translated so a strike lands
  immediately — or at resume, if paused — so the session never opens in silence waiting
  for a download) and re-lays it via `resyncRunningSession`, which leaves anything
  already sounding alone; switching away from the mode frees the ~30 MB of decoded
  PCM (`randomBuffers = null`).
- The last-used Sound mode and duration (preset or custom) come back on open
  (`localStorage`: `meditation-sound`, `meditation-duration`); with no stored preference
  the first open selects Random bells (beta), which sits second in the selector.
- **Amount (v26.10.15).** Settings → Random bells amount picks the wait profile:

  | Level | Buttons | floor | mean | max strike-to-strike | `minGap`† | ≈ strikes / 15 min |
  |---|---|---|---|---|---|---|
  | 1 scarce | one bell | 20 s | 20 s | 100 s | 8 s | 16 |
  | 2 default | two bells | 8 s | 8 s | 56 s | 1 s | 24 |
  | 3 frequent | three bells | 3 s | 3 s | 40 s | 1 s | 32 |

  † the least the pulled-in final bell may follow the previous ring-out (the ending rule
  above); level 1 asks for 8 s so a scarce session does not end with two bells in a row.
  Waits are always measured from the audible ring-out, and bells never overlap, at any
  level. `sampleRandomPlan(durSec, amt)` takes the level; the default argument follows
  `randomAmount`. A failed bell load retries quietly (1, 2, 4 s) before any message.

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
- **Delete app** — `deleteApp()` reuses `shutdownApp()`'s teardown (releasing every audio
  resource) but skips its close screen via the `deleting` flag, then unregisters this
  app's worker (scope-filtered), deletes every `meditation-timer-*` cache, its
  localStorage keys (`DELETE_KEYS` — every key in the table below plus the install and
  drift flags; the sound/duration keys were missing until v26.10.14) and any IndexedDB,
  and shows a "deleted" screen. Prefix-scoped,
  because Cache Storage and localStorage are per ORIGIN and this site hosts several apps.
  It never reloads (a reload would reinstall); removing the home-screen icon is the OS's
  to do, which no web page can automate.
- **Offline is part of Install** (v26.10.15: one button, no separate Offline section). An
  installed copy is only worth having if it works without a connection, and that needs the
  ~44 MB soundtrack (too big for the worker to precache). So `#install-btn` does both:
  in the browser one tap starts `saveOffline()` (progress "Saving for offline use… n of
  7" in `#install-status`) **and** runs the install flow (native prompt, or the steps
  modal); inside the installed app the same button reads "Save for offline · 44 MB" until
  the soundtrack is cached, then "✓ Installed" with "Works offline." (disabled). `audioSaved`
  comes from `isAudioCached()`, which checks **this app's own caches** for the actual
  soundtrack URL — the old "is any `.mp3` cached on the origin?" check was fooled by
  SoundAnnoyer's twelve and reported "downloaded" for a file never fetched. The soundtrack
  is the only large file: do not point `BIG_AUDIO` at anything the worker precaches.
- **Check for updates** and the tappable version sit in the same "App" section.

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
- `meditation-timer-audio` — the bell, the three FLAC bells, the MP3 twins (only on an
  engine that fell back) and (once downloaded) the ~44 MB soundtrack.
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

**Freshness / auto-update:** comes from the SW lifecycle, not a per-launch network hit. The SW deliberately does **not** call `skipWaiting()` on install: the shell is cache-first, so a worker that activates mid-session would serve new JS/CSS to a page running the old code. Instead the new worker waits, and `app.js` sends it `SKIP_WAITING` (`applyUpdateIfSafe`) once `state === 'idle'` **and** `performance.now() >= quietAt` — from session stop, session end, and on becoming visible — after which `controllerchange` reloads unconditionally. `quietAt` is when the last sound has finished: stop + 2.6 s, or the nominal end + `endBellTail()` (~41 s). Before v26.10.14 a waiting update reloaded ~7 s after the session end and cut the ~40 s end chime. The previous build had this backwards: it let the worker take over immediately and deferred the *reload*, which was then simply dropped, so an update arriving during a session never landed at all.

`app.js` registers with `updateViaCache:'none'` and re-checks on load, on foreground and on `online`, throttled to once a minute. It also compares its own `APP_VERSION` against the worker's `VERSION` and self-heals a mismatch once per browsing session.

**Audio (.mp3 / .flac)**: the soundtrack is NOT pre-cached (44 MB). Strategy for anything not already in the audio cache:
- If cached: serve full `200` response (browsers accept `200` in place of `206` for `<audio loop>`)
- If not cached + range request: pass through to network (native streaming)
- If not cached + full request (from "Download for offline" button): fetch, cache, return

The `serveAudio` function strips the `Range` header from the cache key so the stored full response matches all subsequent requests regardless of range headers.

---

## localStorage Keys

| Key | Purpose |
|---|---|
| `meditation-custom-min` | Saved custom duration (integer, minutes) |
| `meditation-audio-cached` | `'1'` while the soundtrack is in the audio cache (mirror of `isAudioCached()`, re-derived on every open) |
| `meditation-sound` | Last-used Sound mode id (`bowls` \| `random`) |
| `meditation-duration` | Last-used duration in minutes (preset or custom) |
| `meditation-bells` | Random bells amount: `1` one bell (scarce), `2` two (default), `3` three (frequent) |

---

## Design

Zen / wabi-sabi, researched against Japanese design principles: *kanso* (simplicity,
remove the non-essential), *ma* (active negative space) and the *ensō*, the Zen circle
drawn in one brushstroke, left open for impermanence. The palette comes from the
traditional Japanese colours, lightened where needed for contrast on a phone screen.

| Token | Value | Source colour |
|---|---|---|
| `--bg` | `#151310` | sumi (ink), warm black |
| `--text` | `#efe6d2` | kinari (unbleached silk) |
| `--accent` | `#d9ae68` | kincha / gold leaf |
| `--muted` | `#a79d89` | rikyū-nezumi, lifted (~6.8:1 on bg) |
| `--border` | `#3b352c` | |
| `--shu` | `#d0553a` | shu (vermilion): only the close control and the icon seal |

Background: a radial "lamp over paper" glow high on the page, falling off to ink.

**Type:** *Shippori Mincho* 700 (title, countdown, Begin) gives a brush-serif
voice; *Zen Maru Gothic* 500/700 (all controls and small text) is rounded and legible at
12 px. Both are SIL OFL and self-hosted as Latin subsets (~52 KB total), precached by the
worker, so they work offline and need no third-party request. Mincho digits are
proportional, so `renderClock()` puts each character in a fixed-width cell (`.d` / `.c`).
Otherwise the clock would shift sideways every second.

**Layout (v26.10.16: the page never scrolls).** `html` and `body` are `overflow: hidden`,
`body` is `100dvh`, and `.app` fills it; the pager is the one flexible child. In the
Meditate page the hero (`.countdown-section`, `container-type: size`) takes whatever height
the controls leave and the ring is sized from that box with container units
(`min(100cqw, 100cqh − 26px, 440px)`, countdown `19cqw`), so it scales down on a short
phone instead of pushing the controls off, and fills the room on a tall one. Spare height
that the width-limited ring cannot use goes *above* it (`::before`), so Begin always sits
right under the timer. Durations are a 3-column grid (5/10/15, then 20/25/Custom). Under
680 / 600 px tall the buttons and the Settings page tighten. The layout test (8 sizes from
320×568 to 768×1024) asserts no page scroll, no inner scroll, last control on screen and a
≤ 22 px gap between the status line and Begin; re-run it after any layout change. The old
"three bells close the session" hint under the ring is gone.

**Tabs and paging:** header, then two tabs (`TABS` + `showTab()` in app.js):
**Meditate** (the practice screen above) and **Settings**. The two pages sit side by side
on `.track` inside `.pager`; ONE CSS variable, `--p` on `.app` (0 = Meditate, 1 =
Settings), positions both the track (`translateX(--p × −50%)`) and the tab highlight
(`.tab-pill`, `translateX(--p × (100% + 6px))`), so they can never disagree. A tab tap just
sets `--p` and CSS eases it (0.38 s). **Swipe** (touch/pen only, `enableSwipe()`): while the
finger is down `.app.dragging` turns the easing off and `--p` follows 1:1 (resisting past
either end); on release it commits to the neighbour past 25 % of the width or at > 0.35
px/ms, else springs back. Vertical movement is never claimed (`touch-action: pan-y` on
`.pager` and on each `.panel`, which scrolls on its own), and the lift after a drag is
swallowed so it cannot tap a button. The page that is not showing is `inert` (and
`visibility: hidden` once its slide is done), so it is out of the tab order and the a11y
tree. Arrow keys move between tabs. `prefers-reduced-motion` switches pages without the
slide. A running session keeps running while Settings is open; `reopenApp()` always
returns to Meditate.

**Header and tabs:** the title is left-aligned; the top-right control is a pill reading
"Close app ×" (it is `shutdownApp`). The tabs are one connected, bordered track with a
single highlight pill inside it that slides between the halves (`--p`, see above) — not two
separate buttons.

**Settings, top to bottom:** **Manual** (three short lines; keep it short — the user asked
for less text, and an earlier version read as generated filler), **Random bells amount**,
**App** (a card with the app icon, name, tappable version and one status line; then
install + offline as one button, and Check for updates, and the `installAdvice()` note) and
**Delete app** at the very bottom. All in-app copy is deliberately plain and short, with
no em dashes. The Meditate tab only shows the install advice as a banner when this browser
cannot install at all.

**Random bells amount:** three buttons showing one, two or three bell glyphs (no text;
words in `aria-label`; `renderAmounts()`). More bells = a shorter wait between strikes
(`RANDOM_AMOUNTS`: floor/mean/maxgap/minGap). Measured yield over 15 min: ~17 / ~26 / ~36
strikes. It applies from the next session — a running session keeps its sampled plan, so
changing it can never touch a ringing bell. Stored as `meditation-bells`.

**Sound selector:** two buttons, "Soundtrack" and "Random bells", with no sub-line.

**Ensō hero / progress:** the brushstroke path (generated, identical to the icon) is inline
in `index.html` and drawn twice: a faint ghost, and the gold ink masked by `#enso-arc`.
`setEnsoProgress()` sets the mask's `stroke-dashoffset` once a second (with a 1 s linear
CSS transition), so the ink fades along the stroke as time passes and the dry-brush tail
goes last. Starting a session changes nothing on screen, and stop/end sweeps the circle
back in over 1.4 s.

**Running animation:** `setPlayBtn()` also sets `body.running` / `body.paused`. While running,
the ensō and a soft glow behind it *breathe* (10 s cycle, about six breaths a minute).
It animates transform/opacity only (compositor, zero cost when hidden). Paused holds and
dims it. `prefers-reduced-motion` disables the breathing and the ring transition.

**Icon (tidied v26.10.15):** the brushed gold ensō — the same stroke as the in-app
progress ring — around a clock reading 10:10, on sumi ink. The stroke is *translated* so
its least-squares-fitted centre (48.59, 49.02 in its own coordinates) lands exactly on the
hands' pivot at (50, 50) and scaled 1.08; before, the ring was centred ~1.5 units away
from the pivot, which read as "not aligned". The vermilion hanko seal and the 12 o'clock
index dot are gone; the hands are slightly bolder. The ring's outer edge is at radius
35.3, inside the 40-unit maskable safe radius. The maskable and iOS 180 px PNGs are the
same artwork full-bleed (no rounded corners; iOS rounds it); 192 / 512 keep the rounded
square on transparency. All four PNGs are rendered from `icon.svg` (headless Chrome
screenshot of the SVG at the target size). Bump the `?v=` query on the icon links in
`index.html` and `manifest.json` when the artwork changes, or phones keep the old one.

---

## Close button (X, top right)

`shutdownApp()`, the same contract as poltergeist.exe's X. A web page cannot terminate
its own OS process, so the X releases everything the app holds: rAF loop and timers,
every scheduled bell, both keep-alives, the Media Session handlers and metadata, the
soundtrack and keep-alive `<audio>` elements (paused **and** `src` removed, so their media
buffers go), the keep-alive `blob:` URL, every audio node, the decoded `bellBuffer`, and
finally `audioCtx.close()` (not `suspend()`: close is what hands the device back and drops
the partial wakelock). `navigator.audioSession.type` goes back to `'auto'`. Then
`window.close()`, which works for an installed app window and is ignored in a plain tab.
In that case a "Closed" screen explains it and offers **Open again** (`reopenApp()`), which
rebuilds the graph through `ensureAudio()`.

`closing` gates `applyUpdateIfSafe()` (a queued update must not reload a closed app) and
`loadBell()`: a bell load captures the context it started on and stops, retries included,
once that is no longer `audioCtx`. Otherwise a load still in flight would decode into a
dead context and refill the memory the X just released.

---

## Audio Files

| File | Duration | Type |
|---|---|---|
| `resources/bowls long interval.mp3` | ~44 MB, ~1 hr | `loop` |
| `resources/Single bowl sound.mp3` | ~1.5 MB, ~39 s | end chime (`BELL_FILE`), every mode |
| `resources/random/bell-1-c3-flat.flac` … `bell-4-g3.flac` (3 files: bells 1, 2, 4) | ~3.9 MB total, 20–28 s, 48 kHz/24-bit stereo | `random` mode — denoised recordings (spectral subtraction, see `resources/sources.md`); names carry the bell and pitch. G3 −27¢ and C4 retired in v26.10.17 (the palette's two shortest tails — see the study's "Tuned 3" tab) |
| `resources/random/*.mp3` (3 twins) | ~2.7 MB total | FLAC-less fallback: `ffmpeg -i x.flac -map_metadata -1 -c:a libmp3lame -b:a 320k x.mp3` (48 kHz kept; mean/peak identical to the FLAC within 0.1 dB). Re-encode them whenever a FLAC changes. |

All files have metadata stripped (`-map_metadata -1`; for MP3 sources with `-c:a copy`).

---

## Adding a New Sound

1. Drop MP3 into `resources/`. Strip metadata: `ffmpeg -i input.mp3 -map_metadata -1 -c:a copy output.mp3`.
2. Add an entry to `SOUNDS` in `js/app.js`:
   - Loop: `{ id, label, sub, file, type: 'loop' }` — note `TRACK_FILE` assumes ONE loop
     entry (the element never swaps src); a second soundtrack needs a src swap that waits
     for the stop fade to land.
3. Bump the version in all four places (see the top of this file).
