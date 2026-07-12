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
- [ ] **Interval options** — a **5 second** option (for debugging), then less
      frequent presets (**30 s**, **1 min**, etc.), plus a **Custom** option to set
      any interval.
- [ ] **No immediate repeats** — when multiple sounds are selected, never play the
      same sound twice in a row (shuffle with anti-repeat). If only one sound is
      selected, it may repeat every time.
- [ ] **Runs until stopped** — start/stop control; keeps going indefinitely.
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
- **Keep-alive.** A continuous **faint 25 Hz tone, clearly nonzero but very quiet**
  loops for the whole session (a Web Audio buffer plus a looping `<audio>` element
  carrying the same clip). It must **NOT** be digital silence: Chrome exempts a page
  from background freezing only while it counts as "playing audio" (documented in
  Chrome's Page Lifecycle API), and that audibility check is power-based — a literal
  all-zero stream does not qualify, confirmed by prior art solving this exact
  problem (`t-mullen/silent-audio`). A frozen page's AudioContext stops too, killing
  every pre-scheduled sound. (v26.06.19 shipped a zero-filled buffer and died on
  lock exactly this way.) 25 Hz at this level stays imperceptible in the room: small
  speakers physically can't reproduce it, and it sits below the human hearing
  threshold at that frequency even on big ones — unlike the broadband noise of an
  earlier build, which became audible hiss on a cranked speaker. Full writeup incl.
  sources: `knowledge/locked-screen-audio.md`. Waking the speaker
  is still the primer's job — see below.
- **Wake primer.** ~0.6 s before each real sound, a short, quiet primer tone is
  scheduled. This is what actually wakes a dozing BT speaker so the sound's onset
  isn't clipped — it's brief and tied to each sound, not a continuous noise floor.
  (Trade-off: if a specific speaker sleeps hard during a long gap, its first onset
  after waking could be slightly soft; the primer minimises this.)
- **Media Session API** metadata is set so the OS treats this as active media
  playback (helps keep the session alive and shows on the lock screen).

### Randomization

- `gap = base × U(0.5, 1.5)` when randomize is on (default), floored to a sane
  minimum. Average stays ≈ the chosen interval, but timing is unpredictable.
- A toggle can switch to exact, fixed intervals.

### Offline-first + freshness

- **Cache-first service worker** (`sw.js`). On install it precaches the whole shell,
  the icons, **and every sound**, so the installed app boots and plays with zero
  network. Every same-origin request is served from cache first (instant, offline).
- Freshness comes from the **SW lifecycle**, not a per-launch network hit: bump
  `VERSION` → the new worker precaches a new version-keyed cache in the background →
  it takes over and the page reloads **once** when it gains control (never
  mid-session). Registered with `updateViaCache:'none'` so a bumped `sw.js` is
  detected promptly behind GitHub Pages' HTTP caching.
- The **Update** button (and the tappable **version** label) are the manual jump to
  newest: online they wipe caches + unregister the SW and reload; **offline they do
  nothing destructive** (wiping with no network would brick the app) and just confirm
  the cached build. This offline guard is essential — do not remove it.

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
| `css/styles.css` | Theme, tabbed layout, single-page scroll, responsive. |
| `js/app.js` | Audio engine, random scheduler, anti-repeat shuffle, tabs, smart install (native prompt / iOS instructions), offline-safe update, BT wake. |
| `manifest.json` | PWA manifest. |
| `sw.js` | Service worker: cache-first / offline-first, precaches shell + all sounds, version-keyed cache. |
| `icons/` | `icon.svg` + `icon-192/512/180.png`. |
| `resources/` | Owner-supplied `.mp3` sounds (see its `README.md`). |

## Versioning

Bump the version on **every** change, in lockstep, in three places:
`index.html` (the Settings `.version` button), `sw.js` (`VERSION`), and `js/app.js`
(`APP_VERSION`). Format `vYY.MM.DD` (year.month.day, e.g. `v26.06.18`).
