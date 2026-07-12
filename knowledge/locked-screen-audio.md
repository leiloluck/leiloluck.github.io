# Audio That Keeps Playing While the Screen Is Locked

> **Canonical implementations in this repo:** `sound-annoyer/` (random prank sounds), `meditation-timer/` (interval bells).
> **Priority platform:** Android Chrome. iOS notes at the end.

---

## 1. The Problem

A web app that must emit sounds at future times **while the phone is locked and pocketed** fights two separate platform mechanisms:

1. **JS timers freeze.** `setTimeout` / `setInterval` / `requestAnimationFrame` are throttled and then frozen when the screen is off. They cannot drive playback.
2. **The whole page gets frozen unless it is audibly playing media.** Android Chrome freezes background/locked pages — *including their `AudioContext`* — unless the page currently counts as "playing audio". A frozen page fires nothing, ever, until it is thawed.

## 2. The Two-Part Solution

### Part A — Schedule on the audio hardware clock

Pre-schedule every future sound on the `AudioContext` clock (`source.start(when)`), out to a horizon (SoundAnnoyer: 30 min / 180 hits). The Web Audio clock keeps running while the screen is off — *as long as the page isn't frozen (Part B)*. Top the horizon up whenever JS gets CPU again: `visibilitychange`, the Page Lifecycle `resume` event, each source's `onended`, and a foreground heartbeat.

### Part B — Stay "audible" with a keep-alive tone (NOT digital silence)

**This is the part that keeps getting broken.** Chrome decides a page is "playing audio" from the *measured output power*: only output above **≈ -72 dBFS** counts (Chromium's audio power monitor / silence threshold). Consequences:

- A looping **zero-filled buffer is useless**: digital silence → "not audible" → media wakelock dropped → page frozen on lock → every pre-scheduled sound dies. **SoundAnnoyer v26.06.19 shipped exactly this and stopped working the moment the screen locked.**
- Audible **broadband noise is unacceptable**: an earlier build used low-level noise, which became clearly audible hiss on a cranked-up Bluetooth speaker.

The solution that satisfies both the browser and human ears is a **faint subsonic tone**:

| Parameter | Value | Why |
|---|---|---|
| Frequency | **25 Hz** | Below what phone/BT speakers can physically reproduce; even good speakers/headphones barely emit it |
| Level | **≈ -54 dBFS** (amplitude 0.002) | 18 dB above Chrome's ≈ -72 dBFS audibility cutoff; below the human hearing threshold at 25 Hz (~65 dB SPL needed to perceive) |
| Loop length | Whole number of cycles (e.g. 2 s = 50 cycles) | Seamless loop — no click at the seam |

Play it through **both**:
1. A looping `AudioBufferSourceNode` → keeps the `AudioContext` graph pumping and the Bluetooth link out of standby.
2. A looping **`<audio>` element** (10 s WAV built in JS, served as a `blob:` URL — CSP must allow `media-src blob:`) → the strongest "this tab plays media" signal on Android, and the only thing iOS accepts for holding the audio session open.

Either alone keeps the page alive if the other fails — the redundancy is deliberate.

### Part C — Defensive recovery

- `pause` listener on the keep-alive `<audio>` element: if the OS pauses it (transient audio-focus loss: a notification, the lock event itself), retry `.play()` after ~400 ms while a session is running. Guard so deliberate stops don't retrigger it.
- `document.addEventListener('resume', …)` (Page Lifecycle): if the page got frozen anyway, `audioCtx.resume()` + top up the schedule on thaw.
- Media Session API metadata + `playbackState = 'playing'`: OS treats the page as a media player, shows lock-screen controls, helps retain audio focus.

## 3. Bluetooth Speaker Standby (related but different)

BT speakers drop to standby during silence and **clip the start** of the next sound. The keep-alive tone keeps the *link* open, but a dozed speaker still needs waking: schedule a short, quiet **primer blip** (~120 Hz, 0.13 s, amp 0.05) ~0.6 s before every real sound.

## 4. Rules of Thumb (don't relearn these)

1. **Never "clean up" the keep-alive to pure silence.** It looks like an optimization; it kills locked-screen playback. This has now happened once (v26.06.19) — the code comments say so at the exact spot.
2. **Never lower the tone below ≈ -70 dBFS** — Chrome stops counting it as audible.
3. **Never raise it above ≈ -45 dBFS or move it above ~40 Hz** — risk of an audible hum on capable speakers.
4. Timers are UI-only. Any sound that must fire while locked goes on the AudioContext clock.
5. Test on a real phone: UNLEASH → lock the screen → wait through at least two full intervals → sounds must keep coming.

## 5. iOS Notes

- iOS suspends the `AudioContext` whenever no *real media element* is playing; the Web Audio buffer alone is not enough. The looping `<audio>` element is mandatory there.
- iOS ignores the Chromium audibility threshold discussion above, but the same faint-tone element satisfies it too — one mechanism serves both platforms.
