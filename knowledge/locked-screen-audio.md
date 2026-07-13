# Audio That Keeps Playing While the Screen Is Locked

> **Canonical implementations in this repo:** `sound-annoyer/` (random prank sounds), `meditation-timer/` (interval bells).
> **Priority platform:** Android Chrome. iOS notes at the end.
> **Verified 2026-07-13** against Chrome's official Page Lifecycle docs and prior art (see Sources). The exact numeric silence threshold below is an engineering estimate, not a confirmed Chromium constant — see the caveat in §2.

---

## 1. The Problem

A web app that must emit sounds at future times **while the phone is locked and pocketed** fights two separate, independent platform mechanisms — and fixing only one still leaves the app silent:

1. **JS timers freeze.** `setTimeout` / `setInterval` / `requestAnimationFrame` are throttled and then frozen when the screen is off. They cannot drive playback. (Fixed by §2 Part A.)
2. **Chrome freezes background/hidden pages — unless the page is playing audio.** This is officially documented behavior, not a guess: Chrome's Page Lifecycle API explicitly exempts a page from freezing while it counts as "playing audio." A frozen page's `AudioContext` stops too, so every pre-scheduled sound dies with it. (Fixed by §2 Part B.)
3. **A third, separate mechanism that JS cannot fix at all: Android's own battery optimization for the Chrome app.** Independent of anything happening inside the page, Android's Doze/App Standby can throttle or kill a backgrounded app's audio connections outright. This is an OS-level per-app setting, not a page behavior — see §4.

## 2. The Two-Part Solution (for mechanisms 1 and 2)

### Part A — Schedule on the audio hardware clock

Pre-schedule every future sound on the `AudioContext` clock (`source.start(when)`), out to a horizon (SoundAnnoyer: 30 min / 180 hits). The Web Audio clock keeps running while the screen is off — *as long as the page isn't frozen (Part B)*. Top the horizon up whenever JS gets CPU again: `visibilitychange`, the Page Lifecycle `resume` event, each source's `onended`, and a foreground heartbeat.

### Part B — Stay "audible" with a keep-alive tone (NOT digital silence)

**This is the part that keeps getting broken.** The freezing exemption in mechanism 2 above is tied to Chrome's own "is this tab audible" signal (the same one that drives the speaker icon on a desktop tab) — and that signal is power-based, not just "is a `<audio>` element in the playing state." A stream of literal zeros does **not** count as audible and gets **no** exemption; a real, if very quiet, waveform does. This is the same principle used by existing "keep background timers alive" libraries built for this exact purpose (e.g. `t-mullen/silent-audio`).

- A looping **zero-filled buffer is useless**: digital silence → "not audible" → no freezing exemption → page (and `AudioContext`) frozen on lock → every pre-scheduled sound dies. **SoundAnnoyer v26.06.19 shipped exactly this and stopped working the moment the screen locked.**
- Audible **broadband noise is unacceptable**: an earlier build used low-level noise, which became clearly audible hiss on a cranked-up Bluetooth speaker.

The fix that satisfies both the browser and human ears is a **faint subsonic tone**:

| Parameter | Value | Why |
|---|---|---|
| Frequency | **25 Hz** | Below what phone/BT speakers can physically reproduce; even good speakers/headphones barely emit it |
| Level | **≈ -54 dBFS** (amplitude 0.002) | Clearly non-zero so Chrome's audibility detector sees it as sound, not silence; well below the human hearing threshold at 25 Hz (~65 dB SPL needed to perceive) |
| Loop length | Whole number of cycles (e.g. 2 s = 50 cycles) | Seamless loop — no click at the seam |

> **Caveat on the exact numbers:** the "-54 dBFS" and "18 dB of margin" figures are this repo's chosen operating point, not a value read out of Chromium source — attempts to pin down Chromium's exact silence-threshold constant (`AudioStreamMonitor` / `AudioPowerMonitor`) did not turn up a public, citable number. The *mechanism* (nonzero beats zero) is confirmed; the *margin* is an engineering safety factor, not a verified spec. If a future report says the keep-alive still isn't audible enough to Chrome, raising the amplitude (still well below hearing threshold at 25 Hz — try 0.01–0.02) is a reasonable first knob to turn, not evidence the whole approach is wrong.

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

## 4. Does Installing the App "Guarantee" This Works? No.

Checked directly: MDN's PWA background-operation docs are explicit that **no web-platform mechanism guarantees continued execution** — "browsers may stop [things] when they think it is appropriate," full stop, no carve-out for installed apps. There is no formal spec-level promise here, installed or not. The only way to get an Android-native guarantee (a real foreground service with a persistent notification, immune to Doze) is to stop being "just a PWA" and ship it as a **TWA** (Trusted Web Activity, via Bubblewrap) published through the Play Store with actual native code added — a materially bigger project than tapping the install button.

That said, installing is not merely cosmetic — it changes one concrete, verifiable thing:

**Installing on Android creates a WebAPK — a real, separate Android app package.** Confirmed directly from Google's own web.dev docs: an installed PWA "show[s] up in the app launcher, in Android's app settings" as its own entry, "without a browser badge." Practical consequence: **once installed, the app's battery-optimization toggle lives at its own name** (e.g. Settings → Apps → **SoundAnnoyer** → Battery), completely separate from Chrome's own toggle. This matters because:
- Independent of everything above, Android's Doze mode / App Standby / per-app battery optimization can restrict a backgrounded app regardless of what the page inside it does. No in-page JS trick (this doc's keep-alive included) can override it — it's Android deciding how much CPU/network/wake-lock budget the *app process* gets, not a page behavior.
- **My earlier draft of this doc told users to fix this via Chrome's own battery setting — that's wrong once the app is installed.** An installed WebAPK is a distinct package; exempting Chrome the browser does nothing for it. The correct instruction depends on how the app is running:
  - **Installed (standalone, own icon):** Settings → Apps → **[app name]** → Battery → **Unrestricted**.
  - **Running in a regular Chrome tab (not installed):** it's genuinely Chrome's own setting that applies instead: Settings → Apps → Chrome → Battery → Unrestricted.
- Even "Unrestricted" is only a *partial* exemption from Doze/Standby per Android's own docs (jobs/alarms can still be deferred) — it measurably helps, it doesn't formally guarantee.

**Considered and rejected: Screen Wake Lock API.** Checked the spec directly — a screen wake lock is explicitly released the moment the user manually turns the screen off (W3C spec: "must not be applicable after the screen is manually switched off by the user"). Both apps' whole premise is the user *deliberately* locking/pocketing the phone, so Wake Lock would do nothing for the actual use case (it only defers an *automatic* timeout the user isn't hitting anyway). Not implemented — don't re-propose it without a different use case in mind.

## 5. Rules of Thumb (don't relearn these)

1. **Never "clean up" the keep-alive to pure silence.** It looks like an optimization; it kills locked-screen playback. This has now happened once (v26.06.19) — the code comments say so at the exact spot.
2. Keep the tone clearly non-zero and subsonic (~25 Hz). Don't chase a precise dB target — the number in §2 is a safety margin, not a spec.
3. Timers are UI-only. Any sound that must fire while locked goes on the AudioContext clock.
4. Test on a real phone: UNLEASH → lock the screen → wait through at least two full intervals → sounds must keep coming. If they still don't, check the *correct* battery-optimization setting first (§4 — it's the installed app's own toggle, not Chrome's, once installed) before assuming the in-page fix is wrong.
5. Don't promise users "guaranteed" background playback in UI copy — say "install for the most reliable results," not "it always works." §4 is why.

## 6. iOS Notes

- iOS suspends the `AudioContext` whenever no *real media element* is playing; the Web Audio buffer alone is not enough. The looping `<audio>` element is mandatory there.
- iOS's audio-session rules are a different mechanism from Chrome's audibility-based freezing exemption described above, but the same faint-tone `<audio>` element happens to satisfy both.

## Sources

- [Page Lifecycle API — Chrome for Developers](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) — official doc confirming pages playing audio are exempt from freezing.
- [WICG Page Lifecycle spec](https://wicg.github.io/page-lifecycle/) — freezing/discarding heuristics.
- [t-mullen/silent-audio](https://github.com/t-mullen/silent-audio) — existing open-source precedent for the "near-silent audio keeps background timers alive" technique; its README states plainly that *silent* streams do not receive the exemption, only audible ones do.
- [How to Keep Audio Playing in the Background in Chrome on Android (spf.io)](https://www.spf.io/2025/01/30/how-to-keep-audio-playing-in-the-background-in-chrome-on-android/) — real-world report attributing background audio loss on Android to Chrome's battery-optimization status, fixed by setting it to Unrestricted; independent of any page-level code.
- [Android Doze and App Standby — Android Developers](https://developer.android.com/training/monitoring-device-state/doze-standby) — confirms even a battery-optimization exemption ("Unrestricted") is only a *partial* exemption from Doze/Standby restrictions.
- [WebAPKs on Android — web.dev](https://web.dev/articles/webapks) — official Google doc confirming an installed PWA registers as its own entry in Android's app settings, separate from the browser.
- [MDN: Offline and background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) — explicit that no web-platform background mechanism (service workers included) is guaranteed to keep running; the browser may stop it "when it thinks it is appropriate."
- [Screen Wake Lock API — W3C spec](https://w3c.github.io/screen-wake-lock/) — a screen wake lock must not apply after the user manually turns the screen off, which is why it doesn't help this repo's "lock the phone and hide it" use case.
