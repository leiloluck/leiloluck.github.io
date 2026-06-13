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
- [ ] **Always serves the newest version** — opening the site must never get stuck
      on a stale cached build. Pushing a change must show up on the phone.
- [ ] **"Update to newest version" button** — manual escape hatch in case the auto
      refresh hasn't happened.
- [ ] **Installable as an offline PWA** — Install button → open as app → works
      offline. **Android is the priority** platform.
- [ ] **Version number tied to the current date** — format `vDD.MM.YY`
      (e.g. `v09.06.26`). Bump it on every change.
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
- **Keep-alive.** A continuous **SILENT** (zero-filled) buffer loops for the whole
  session, plus a silent looping `<audio>` element. An *active stream of digital
  silence* is enough to keep the OS audio output / BT link from going idle, and it
  stays inaudible even when the speaker is cranked. (An earlier build mixed low-level
  noise in here to keep speakers awake; at high volume that turned into audible hiss,
  so it was removed. Waking the speaker is the primer's job — see below.)
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

### Freshness / updates

- **Service worker is network-first for the app shell** (`sw.js`): an online launch
  always fetches the freshest HTML/CSS/JS, falling back to cache only when offline.
- On load the page pulls any new service worker and reloads once when it takes
  control (never mid-session).
- A manual **Update** button clears all caches, unregisters the SW, and reloads —
  the guaranteed way to jump to the newest build.

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

### Fit on screen (no stranded footer)

- The page is a fixed-height frame (`body { height:100dvh; overflow:hidden }`); it
  never scrolls, so the footer (Install / Update / version) is always on screen.
- The **sound list is the only scrollable region** — it flexes to fill leftover
  height and scrolls internally if there are ever more sounds than fit. Everything
  else (hero, launch, intervals, toggles, footer) stays pinned.
- The same problem is fixed in `../meditation-timer/` by making its footer
  `position: sticky; bottom: 0` so Install / Update / version can't fall below the
  fold there either.

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
| `index.html` | UI shell, CSP, PWA meta. No inline scripts/styles. |
| `css/styles.css` | Gremlin theme + responsive layout. |
| `js/app.js` | Audio engine, random scheduler, anti-repeat shuffle, PWA/install/update, BT wake. |
| `manifest.json` | PWA manifest (Android-first). |
| `sw.js` | Service worker: network-first shell, offline cache, version-keyed cache. |
| `icons/` | `icon.svg` + `icon-192/512/180.png`. |
| `resources/` | Owner-supplied `.mp3` sounds (see its `README.md`). |

## Versioning

Bump the version on **every** change, in lockstep, in three places:
`index.html` (footer `.version`), `sw.js` (`VERSION`), and `js/app.js`
(`APP_VERSION`). Format `vDD.MM.YY`.
