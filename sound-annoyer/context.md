# Context — SoundAnnoyer

> Subpage of **leiloluck.github.io**. Read this before touching any file in this
> folder. It is the source of truth for what this app is and the constraints it
> must respect.

---

## The Objective (verbatim intent from the owner)

A sound app that lets you **toggle a set of prank sounds** — a cat meowing, a dog
barking, a doorbell ringing, knocking on wood/a door, etc. — and then plays them
through a (Bluetooth) speaker at **random intervals** while the phone is **locked
and pocketed**.

The use case: hide a Bluetooth speaker somewhere in a room. Every once in a while,
at an unpredictable interval, the app fires one of the selected sounds. People hear
a meow, look for the cat, find nothing. Silence for a while. Then a knock. They look
again. It is very funny. SoundAnnoyer is meant to be the **one and only tool**
needed to pull this off:

1. Open the app.
2. Tap which sounds to activate.
3. Choose how often (interval).
4. Tap **start**.
5. It keeps making sounds at random intervals until you stop it — even with the
   screen off.

---

## Hard Requirements (do not regress these)

These are the explicit asks. Treat them as a checklist.

- [ ] **Toggle sounds** — multi-select. Cat / dog / doorbell / knock to start; easy
      to add more.
- [ ] **Random intervals** — not a fixed metronome. The chosen interval is a *base*;
      each actual gap is randomized around it so it feels unpredictable.
- [x] **Interval options** — a **5 second** option (tagged `test`, for checking the rig
      before you hide the speaker), then less frequent presets (**30 s**, **1 min**, …),
      plus a **Custom** option (1–3600 s / 1–360 min) for anything else.
- [ ] **No immediate repeats** — when multiple sounds are selected, never play the
      same sound twice in a row (shuffle with anti-repeat). If only one sound is
      selected, it may repeat every time.
- [x] **Runs until stopped** — start/stop control; keeps going indefinitely. STOP also
      silences a clip that is *already playing*: entries stay in `scheduled` until their
      `onended` fires, so `clearScheduled()` can still reach them. (They used to be
      dropped one second after their start time, which left up to ten seconds of sound
      coming out of a hidden speaker after you pressed STOP.)
- [x] **Changes apply immediately** — arming or disarming a sound, changing the interval
      or toggling chaos timing while running calls `rescheduleFromNow()`, which drops
      every not-yet-started hit and rebuilds the horizon. Without it the queue still held
      up to 30 minutes of hits built from the *old* settings, so a change appeared to do
      nothing at all.
- [ ] **Works while the phone is locked / screen off.** This is the whole point.
      (Literal "phone turned off" = powered down is impossible for any web app;
      this means screen locked / app backgrounded.)
- [ ] **Bluetooth speaker reliability** — BT speakers drop to standby when idle and
      then *clip the start* of the next sound. The app must **wake the speaker**
      before each sound so it plays immediately and in full. See "Audio engine".
- [ ] **Lightweight.**
- [ ] **Works perfectly offline once installed** — no mandatory connection. The
      installed app must boot and run with zero network; when a connection exists it
      updates in the background; offline it keeps working from cache.
- [ ] **Serves the newest version when online** — a deployed change must reach the
      phone (on the next open, or instantly via the Update button). It must never get
      permanently stuck on a stale build.
- [ ] **"Update" button + tappable version** — manual escape hatch that jumps to the
      newest build (online); offline it is a no-op that confirms the cached build.
- [ ] **Installable on Android *and* iPhone** — a real home-screen install. Android /
      desktop use the native prompt; iPhone Safari has no prompt, so the Install button
      shows "Add to Home Screen" steps. Runs standalone + offline once installed.
      **Browser matters:** only Chrome (with Google Mobile Services) and Samsung
      Internet mint a WebAPK — a real Android app package. **Brave produces a shortcut
      instead**, so Android never gives the app its own entry under Settings → Apps and
      there is no per-app battery toggle to set to Unrestricted. Brave is detected and
      the install sheet says so.
- [ ] **Version number tied to the current date** — format `vYY.MM.DD`
      (e.g. `v26.06.18`, year.month.day). Bump it on every change.
- [ ] **Owner supplies the sound files** as `.mp3`s dropped into `resources/`. The
      app picks them up automatically (see `resources/README.md` for filenames).

---

## How the requirements are met (implementation notes)

### Audio engine — locked-screen + Bluetooth reliability

This is the hard part and mirrors the proven approach in `../meditation-timer/`.

- **Web Audio on the hardware clock.** `setTimeout`/`requestAnimationFrame` are
  throttled or frozen when the screen is off, so they cannot drive playback. Instead
  every upcoming sound is **pre-scheduled ahead of time** on the `AudioContext`
  clock via `source.start(when)`. The Web Audio engine keeps running while locked,
  so scheduled sounds still fire.
- **Rolling schedule horizon.** At start we schedule every hit (with its randomized
  gap and anti-repeat sound pick) out to a horizon (~30 min / capped count). Whenever
  the app gets CPU again (becomes visible, or a foreground heartbeat ticks) we
  *replenish* the horizon. A locked phone therefore keeps annoying people for the
  whole horizon even if JS never wakes; in practice the phone gets touched and the
  horizon is topped up continuously.
- **Keep-alive — two halves, each doing a different job.** Both run for the whole
  session and **neither is optional**:
  1. A **Web Audio 25 Hz tone at amplitude 0.002**. This clears Chrome's audibility
     gate, which is an exact constant: mean-square power ≥ `-72.24719896` dBFS, i.e.
     RMS ≥ 2⁻¹² (`services/audio/output_stream.cc`). Ours sits at −57 dBFS — 15 dB of
     margin — and is inaudible (small speakers can't reproduce 25 Hz at all). Clearing
     that gate is what stops Chrome throttling timers and **freezing the page**; a
     frozen page's AudioContext stops too and every pre-scheduled sound dies with it.
     It must **NOT** be digital silence — v26.06.19 shipped a zero-filled buffer and
     died on lock exactly this way.
  2. A looping **`<audio>` element** carrying the same faint tone, **10 seconds long**.
     Since **Android 17** (stable 2026-06-16) background audio without a foreground
     service is *silently muted*, and Chrome only runs its `mediaPlayback` foreground
     service while it shows a media notification — which requires a real media element
     with a duration **over 5 seconds**. A bare AudioContext is `kAmbient` and is
     explicitly ignored for Android audio focus. So on a current Android this element
     is what keeps the sound audible at all; the Web Audio half is what keeps the page
     unfrozen. The 10 s clip length is load-bearing, not arbitrary.

  Full writeup incl. sources: `knowledge/locked-screen-audio.md`. Waking the speaker
  is still the primer's job — see below.
- **Wake primer.** ~0.6 s before each real sound, a short, quiet primer tone is
  scheduled. This is what actually wakes a dozing BT speaker so the sound's onset
  isn't clipped — it's brief and tied to each sound, not a continuous noise floor.
  (Trade-off: if a specific speaker sleeps hard during a long gap, its first onset
  after waking could be slightly soft; the primer minimises this.)
- **Media Session API** metadata is set so the OS treats this as active media
  playback (helps keep the session alive and shows on the lock screen). It grants no
  exemption on its own — it is metadata on top of an existing player.
- **Battery.** `new AudioContext({ latencyHint: 'playback' })` is the single biggest
  win: on Android it selects `AAUDIO_PERFORMANCE_MODE_POWER_SAVING` and a ~21 ms
  buffer instead of the raw hardware buffer, cutting device callbacks from 200-500/s
  to ~47/s. Nothing here needs low latency. The countdown runs on
  `requestAnimationFrame` (which the browser stops dead when the page is hidden, so a
  pocketed phone spends nothing on it) rather than the old 1 Hz `setInterval`; the
  schedule top-up is driven by each sound's own `onended` with a 60 s interval only as
  a safety net. What remains — an open audio track holding the CPU out of suspend —
  is the unavoidable price of playing anything at all with the screen off.
- **Context recovery.** `audioCtx.onstatechange` resumes a context the OS suspended
  (audio focus lost to a call or notification), and `visibilitychange` + the Page
  Lifecycle `resume` event top the schedule back up. Without this a single interruption
  silently ended the session.
- **iOS.** `navigator.audioSession.type = 'playback'` is set when available. WebKit's
  `shouldOverrideBackgroundPlaybackRestriction()` returns true *only* for that session
  type, so it is the one lever that makes backgrounded playback possible on an iPhone.

### Randomization

- `gap = base × U(0.75, 1.25)` when randomize is on (default), floored to
  `MIN_GAP_MS`. Average stays ≈ the chosen interval, but timing is unpredictable.
  (The UI and the help text quote the same range; an earlier draft of this file said
  0.5–1.5, which never matched the code.)
- A toggle can switch to exact, fixed intervals.
- If the app is backgrounded for longer than the scheduling horizon, `nextHitTime`
  falls behind `currentTime`. It is clamped forward to one fresh gap on the next fill;
  without that clamp every missed hit was queued and collapsed onto the same instant,
  firing up to `MAX_AHEAD` sounds simultaneously when the phone woke up.

### Caches

Two caches, and the split matters:

- `sound-annoyer-<VERSION>` — the shell. Version-keyed, replaced wholesale on every bump,
  so index.html / app.js / styles.css are always from one deploy and can never skew.
- `sound-annoyer-sounds` — the twelve mp3s. **Unversioned and never evicted.** They are
  1.3 MB and change far less often than the code; keeping them in the versioned cache
  meant every bump silently re-downloaded all of them over mobile data.

`caches.keys()` is per **origin**, not per app, and this site hosts several. Every
deletion — in `activate`, in `hardReset()`, anywhere — must be prefix-scoped, and must
skip the sounds cache.

### Offline-first + freshness

- **Cache-first service worker** (`sw.js`). On install it precaches the whole shell,
  the icons, **and every sound**, so the installed app boots and plays with zero
  network. Every same-origin request is served from cache first (instant, offline).
- **Precaching uses `cache: 'reload'`.** This is not a detail. A plain `addAll()`
  fetches through the browser's HTTP cache, and GitHub Pages serves everything with
  `Cache-Control: max-age=600` — so a worker installing within ten minutes of a deploy
  could bake *old* bytes into the *new* version's cache and, because cache-first never
  revalidates, pin the app to a stale build under a fresh version number **forever**.
  That was the real cause of "I open it and get the old version".
- **Old-cache eviction is prefix-scoped** to `sound-annoyer-`. `caches.keys()` is
  per-origin, and this site hosts several apps: the old unscoped filter deleted the
  Meditation Timer's cache — including its 44 MB downloaded soundtrack — on every
  SoundAnnoyer update, and vice versa.
- **`skipWaiting()` is NOT called on install.** The shell is cache-first, so a worker
  that activates mid-session serves the new JS/CSS to a page running the old code. The
  new worker waits; `js/app.js` sends it `SKIP_WAITING` the moment no session is
  running, and the reload then follows unconditionally. An update that arrives during a
  run is applied when the run ends instead of being dropped (which is what the previous
  build did — it deferred the *reload* while letting the worker take over anyway).
- Registered with `updateViaCache:'none'` so a bumped `sw.js` is detected promptly.
- **Self-heal.** The page asks the active worker for its `VERSION` and compares it with
  `APP_VERSION`. A mismatch means the cache is serving a shell from a different deploy;
  the app repairs itself once per browsing session (guarded against reload loops).
- The **Update** button (and the tappable **version** label) escalate gently: probe
  real connectivity → hand over an already-waiting worker → `reg.update()` → only if
  the versions still disagree, wipe *this app's* caches and re-register. **Offline it
  does nothing destructive** and just confirms the cached build. That guard is
  essential — and it now probes a real byte rather than trusting `navigator.onLine`,
  which reports `true` on a captive portal or a dead uplink.
- `tools/check_versions.py` enforces the three-file version lockstep; run it before
  every push (`--bump` sets both apps to today).

### Sounds / resources

- `js/app.js` has a `SOUNDS` catalogue. Each sound lists several candidate
  filenames (`files: [...]`, English + Spanish); the first one that decodes from
  `resources/` wins, so the exact name dropped in doesn't matter.
- If no file matches, the app falls back to a **synthesized stand-in** so every
  button works and the app is testable before the real files are dropped in. Real
  files override the synth automatically once present.
- Current sounds (12, all supplied + normalized): Cat, Dog, Knock, Sparrow,
  Crickets, Crowd gasp, Ding, Mosquito, Mouse, Vibrate, Sneeze, Morning birds.
  (The placeholder Doorbell was dropped once real sounds arrived; "Ding" covers the
  bell niche, and a `doorbell.mp3` would be picked up by the Ding entry.)

### Test mode

- A **Test mode** toggle (next to Chaos timing). When on, tapping any sound *plays*
  it (a real preview through the primer + keep-alive path) instead of arming /
  disarming it. Clearly signalled: dashed sound borders, a pink toggle, the hint
  switches to "🔊 tap to hear", and the status line reads "test mode — tap a sound
  to hear it". Turn it off to go back to arming sounds for a run.

### Start with a sound

- Third toggle, **"Start with a sound"** (default **on**). On → UNLEASH fires one
  sound immediately (handy to confirm it works / gauge the volume). Off → the session
  stays silent for the first interval, so pressing UNLEASH isn't given away by an
  instant sound (discreet start). State is persisted like the other toggles.

### Two tabs + single-page scroll

- The UI is split into two tabs under a sticky segmented control:
  - **Annoy** — the entire app: hero/countdown, UNLEASH (+ skip), the sound grid, and
    the interval picker. Sized to fit one screen on common phones.
  - **Settings** — the three toggles (chaos / test / start-with-a-sound), the
    How-it-works / Install / Update buttons, and the version + offline badge.
- **There is no nested scroll container.** The whole page scrolls as one. The previous
  build made the sound grid its own `overflow:auto; overscroll-behavior:contain`
  scroller, which *trapped* touches: a finger landing on a sound button couldn't
  drag-scroll the page. The grid is now plain auto-height; if a tab is taller than the
  screen the page scrolls normally, and tapping a button never blocks that.
- Tappable controls carry `touch-action: manipulation` (crisp taps, no double-tap
  zoom, drags still scroll).

### Loudness normalization

- `tools/normalize_sounds.py` normalizes every file in `resources/` to a consistent
  perceived loudness (−14 LUFS, EBU R128 via ffmpeg `loudnorm`) so no sound is
  conspicuously louder/quieter than the next. It is idempotent (skips files already
  on target) and must be re-run after adding new files. See `resources/README.md`.
- Requires `ffmpeg` on PATH. This is a local authoring step, not part of the page.

---

## Style

Deliberately **not** the generic dark-AI-website look. SoundAnnoyer has a
mischievous "gremlin" personality: near-black background, acid-green + hot-pink
accents, monospace numerals, playful copy ("UNLEASH", "STOP THE MADNESS"), emoji as
the visual anchor for each sound (🐱 🐶 🔔 🚪). Still respects the site rules: dark,
high-contrast, thin-outline buttons, responsive on mobile and desktop, minimal but
with intent.

---

## File map

| File | Purpose |
|---|---|
| `index.html` | UI shell (two tab panels + modals), CSP, PWA meta. No inline scripts/styles. |
| `css/styles.css` | Theme, tabbed layout, single-page scroll, responsive. Sized in `svh`, not `dvh` — `dvh` is re-evaluated every time Chrome's URL bar slides, so a `dvh`-sized shell repaints mid-scroll. Every `:hover` rule is gated behind `@media (hover: hover) and (pointer: fine)`, because on touch `:hover` latches on tap and stays. |
| `js/app.js` | Audio engine, random scheduler, anti-repeat shuffle, tabs, smart install (native prompt / iOS instructions), offline-safe update, BT wake. |
| `manifest.json` | PWA manifest. |
| `sw.js` | Service worker: cache-first / offline-first, precaches shell + all sounds, version-keyed cache. |
| `icons/` | `icon.svg` + `icon-192/512/180.png`. |
| `resources/` | Owner-supplied `.mp3` sounds (see its `README.md`). |

## Versioning

Bump the version on **every** change, in lockstep, in three places:
`index.html` (the Settings `.version` button), `sw.js` (`VERSION`), and `js/app.js`
(`APP_VERSION`). Format `vYY.MM.DD` (year.month.day, e.g. `v26.06.18`).

Forgetting is silent and permanent — the browser only reinstalls a worker whose script
changed byte-for-byte, so an unbumped deploy never reaches anyone who already has the
app. Guard it:

```
python3 ../tools/check_versions.py          # verify lockstep across both apps
python3 ../tools/check_versions.py --bump   # set both to today
```

It also flags an app whose source files are newer than its version string.
