# Audio That Keeps Playing While the Screen Is Locked

> **Canonical implementations in this repo:** `sound-annoyer/` (random prank sounds), `meditation-timer/` (interval bells).
> **Priority platform:** Android Chrome. iOS notes at the end.
> **Verified 2026-08-30** against Chromium and WebKit source, and Android 17's background-audio
> hardening notice. This revision replaces two things the earlier draft got wrong or left vague:
> the silence threshold is now a **known exact constant**, not an estimate (§2), and being
> "audible to Chrome" is **no longer sufficient on Android 17** (§2.5) — the `<audio>` element is
> now the load-bearing part, not the redundant one.

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

**The threshold is an exact, readable constant — no guessing needed.** In `services/audio/output_stream.cc`:

```cpp
static constexpr float kSilenceThresholdDBFS = -72.24719896f;
```

That is `10·log₁₀(2⁻²⁴)` exactly, applied to **mean-square power** (an EWMA of x², 10 ms time constant, polled at 15 Hz), not amplitude. So:

| Signal | Minimum that counts as audible |
|---|---|
| any waveform | **RMS ≥ 2⁻¹² = 1/4096 ≈ 2.441×10⁻⁴** |
| sine wave | peak amplitude ≥ √2/4096 ≈ 3.45×10⁻⁴ |
| DC offset | \|offset\| ≥ 2.441×10⁻⁴ |

**Our 25 Hz / amplitude 0.002 tone has RMS 1.41×10⁻³ → −57 dBFS → 15 dB of margin over the gate**, while still sitting ~57 dB below full scale. It is comfortably correct. Do not tune it downward toward the gate (the EWMA plus the 100 ms glitch tolerance makes a marginal signal fragile), and never to zero.

Beware a decoy: Blink has a *second*, much looser `IsAudible()` in `audio_context.cc` that is simply `energy > 0`. It drives metrics only. The −72.25 dBFS gate in the audio service is the one that governs throttling and freezing.

- A looping **zero-filled buffer is useless**: digital silence → "not audible" → no freezing exemption → page (and `AudioContext`) frozen on lock → every pre-scheduled sound dies. **SoundAnnoyer v26.06.19 shipped exactly this and stopped working the moment the screen locked.**
- Audible **broadband noise is unacceptable**: an earlier build used low-level noise, which became clearly audible hiss on a cranked-up Bluetooth speaker.

The fix that satisfies both the browser and human ears is a **faint subsonic tone**:

| Parameter | Value | Why |
|---|---|---|
| Frequency | **25 Hz** | Below what phone/BT speakers can physically reproduce; even good speakers/headphones barely emit it |
| Level | **≈ -54 dBFS** (amplitude 0.002) | Clearly non-zero so Chrome's audibility detector sees it as sound, not silence; well below the human hearing threshold at 25 Hz (~65 dB SPL needed to perceive) |
| Loop length | Whole number of cycles (e.g. 2 s = 50 cycles) | Seamless loop — no click at the seam |

> **Superseded:** an earlier revision of this document said the threshold could not be pinned down and that the margin was guesswork. It can be pinned down — `kSilenceThresholdDBFS = -72.24719896f` in `services/audio/output_stream.cc`, applied to mean-square power. The table above is derived from it, and our operating point clears it by 15 dB. No guessing required.

Play it through **both**:
1. A looping `AudioBufferSourceNode` → clears Chrome's audibility gate, so the renderer is neither throttled nor frozen.
2. A looping **`<audio>` element** (10 s WAV built in JS, served as a `blob:` URL — CSP must allow `media-src blob:`) → earns Android audio focus, the media notification and the foreground service.

These are **not** interchangeable, and neither alone is enough on a current Android — see §2.5.

### Part B.5 — Android 17 changed the rules: the `<audio>` element is now mandatory

*(New for 2026. This is the most important thing in this document.)*

Android 17 (stable **2026-06-16**, API 37) shipped **background audio hardening**: an app may only play audio while it has a visible activity **or a foreground service** that isn't `SHORT_SERVICE`. Violations are **silent** — `AudioTrack.write()` is muted, with no error anywhere.

Chrome only runs its `mediaPlayback` foreground service while it is showing a **media notification**, and that notification has two hard conditions:

1. The sound comes from a real **`<audio>`/`<video>` element**. A bare `AudioContext` registers as `MediaContentType::kAmbient`, and `MediaSessionImpl::AddAmbientPlayer()` contains a literal `#if BUILDFLAG(IS_ANDROID) return true;` — *"Ambient players are completely ignored for Android audio focus."*
2. The media is **longer than 5 seconds** (`DurationToMediaContentType()`: duration `0` or `> 5 s` → `kPersistent`).

**Therefore, on Android 17, a Web-Audio-only keep-alive is muted at the HAL the moment the screen goes off** — and once muted, Chrome's power monitor sees zeros, the audibility exemption is lost, and the page is frozen ~30 s later. Everything scheduled on the `AudioContext` dies with it.

So the two keep-alive halves are **not** redundant belt-and-braces, as the earlier draft said. They do different jobs and you need both:

| Half | What it earns | Requirement |
|---|---|---|
| Looping **`<audio>` element** (our 10 s WAV blob) | Android audio focus → media notification → `mediaPlayback` foreground service → survives Android 17 hardening and Doze | must be a media element, **duration > 5 s**, actually `playing` |
| **AudioContext** output ≥ −72.25 dBFS | Chrome's own exemption: no timer throttling, no intensive wake-up throttling, no page freezing, renderer pinned at `kUserBlocking` so the LMK won't reap it | power above the exact gate in §2 |

**Traps to avoid:**
- Routing Web Audio into an `<audio>` via `srcObject = ctx.createMediaStreamDestination().stream` does **not** work. `WebMediaPlayerMS` hard-codes `kOneShot`, and `IsControllable()` is false for one-shot-only players — you get focus but no notification and no FGS.
- A keep-alive clip **≤ 5 s long** gets no notification either. Ours is 10 s deliberately.
- `navigator.mediaSession` alone grants nothing. It is metadata on top of an existing player. Set it (it makes the notification legible and gives the user a stop button) but do not mistake it for the exemption.
- Don't run the keep-alive in a cross-origin iframe without `allow="media-playback-while-not-visible"`.

### Part B.6 — Do not suspend the context between events

It looks like the obvious battery optimisation and it is a trap. `AudioContext.suspend()` closes the device stream, so: t+2 s the tab indicator clears, t+30 s the scheduler moves `kRecentlyAudible → kSilent`, t+30 s+1 min (5 min on Android) the **page is frozen** — and the `setTimeout` meant to `resume()` it never fires. On Android 17 a background `resume()` with no FGS is refused anyway. The hard ceiling on any silent gap is ~90 s with default Finch values, and it is not portable. Keep the context running.

### Part C — Defensive recovery

- `pause` listener on the keep-alive `<audio>` element: if the OS pauses it (transient audio-focus loss: a notification, the lock event itself), retry `.play()` after ~400 ms while a session is running. Guard so deliberate stops don't retrigger it.
- **`pause` listener on the soundtrack element too**, not just the keep-alive. The Meditation Timer only guarded the keep-alive, so a notification arriving mid-session paused the 44 MB soundtrack for good and cost the page its strongest media signal. Fixed v26.08.30.
- `document.addEventListener('resume', …)` (Page Lifecycle): if the page got frozen anyway, `audioCtx.resume()` + top up the schedule on thaw.
- **`audioCtx.onstatechange` → `resume()` if suspended, and a `visibilitychange` resume.** The Page Lifecycle `resume` event only fires after an actual *freeze*; it does not fire when the OS merely *suspends* the context after an audio-focus loss (a phone call, another app). Without one of these the context stays suspended for the rest of the session and every scheduled sound is lost. This was the concrete reason the Meditation Timer's final bell did not ring — SoundAnnoyer had a 1 Hz `audioCtx.resume()` heartbeat that papered over it, and the Meditation Timer had nothing.
- **Anything that must fire at the end of a session must be on the audio clock, including the teardown.** The Meditation Timer's cleanup hung off a `requestAnimationFrame` countdown, which is frozen while the screen is off — so a session that ended in a pocket kept the keep-alive, the soundtrack element and the whole graph running until the user next looked at the phone. Schedule a silent one-frame `AudioBufferSourceNode` at the end time and hang the teardown off its `onended`.
- Media Session API metadata + `playbackState = 'playing'`: OS treats the page as a media player, shows lock-screen controls, helps retain audio focus.

## 3. Bluetooth Speaker Standby (related but different)

BT speakers drop to standby during silence and **clip the start** of the next sound. The keep-alive tone keeps the *link* open, but a dozed speaker still needs waking: schedule a short, quiet **primer blip** (~120 Hz, 0.13 s, amp 0.05) ~0.6 s before every real sound.

## 4. Does Installing the App "Guarantee" This Works? No.

Checked directly: MDN's PWA background-operation docs are explicit that **no web-platform mechanism guarantees continued execution** — "browsers may stop [things] when they think it is appropriate," full stop, no carve-out for installed apps. There is no formal spec-level promise here, installed or not. The only way to get an Android-native guarantee (a real foreground service with a persistent notification, immune to Doze) is to stop being "just a PWA" and ship it as a **TWA** (Trusted Web Activity, via Bubblewrap) published through the Play Store with actual native code added — a materially bigger project than tapping the install button.

That said, installing is not merely cosmetic — it changes one concrete, verifiable thing:

**…but which browser you install *from* decides whether you get a real app at all.** Only **Chrome** (on a device with Google Mobile Services) and **Samsung Internet** (on Samsung devices) mint a WebAPK. Firefox, Edge, Opera and **Brave** have no minting server they trust and produce a **home-screen shortcut** instead. Brave still fires `beforeinstallprompt` — it is Chromium — so an install button appears and appears to work, but the result is a shortcut: no app-drawer entry, **no entry under Settings → Apps, and therefore no per-app battery-optimization toggle**, plus unreliable `display: standalone`. For an app whose entire premise is surviving a locked screen, that is a meaningful downgrade, so both apps now detect Brave (`navigator.brave.isBrave()`) and say so in the install sheet. Tracking: brave-browser [#7357](https://github.com/brave/brave-browser/issues/7357), [#56133](https://github.com/brave/brave-browser/issues/56133).

**Installing on Android (from Chrome) creates a WebAPK — a real, separate Android app package.** Confirmed directly from Google's own web.dev docs: an installed PWA "show[s] up in the app launcher, in Android's app settings" as its own entry, "without a browser badge." Practical consequence: **once installed, the app's battery-optimization toggle lives at its own name** (e.g. Settings → Apps → **SoundAnnoyer** → Battery), completely separate from Chrome's own toggle. This matters because:
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

- **`navigator.audioSession.type = 'playback'` is the one lever that matters** (Safari 16.4+). It is not cosmetic: WebKit's `AudioContext::shouldOverrideBackgroundPlaybackRestriction()` returns true *if and only if* the audio session type is `playback` or `play-and-record`. Without it, backgrounding the page interrupts the context, full stop. Both apps now set it (feature-detected — Chrome/Firefox don't implement it).
- iOS suspends the `AudioContext` whenever no *real media element* is playing; the Web Audio buffer alone is not enough. The looping `<audio>` element is mandatory there too.
- iOS's audio-session rules are a different mechanism from Chrome's audibility-based freezing exemption described above, but the same faint-tone `<audio>` element happens to satisfy both.

## 7. Dead ends — checked, don't re-propose

| Mechanism | Status in 2026 |
|---|---|
| **Notification Triggers** (`TimestampTrigger`) | Development **ended**; Chrome pulled it. |
| **Periodic Background Sync** | Installed-PWA only, and the **minimum interval is 12 hours**. Useless for minute-precision. |
| **`setTimeout` inside a service worker** | Dies with the worker: default idle timeout 30 s, hard cap ~5 min. |
| **Screen Wake Lock** | Only a `screen` type exists, and it is released the moment the user turns the screen off. Irrelevant to this use case. |
| **`AudioContext.suspend()` between events** | See §2.6 — leads directly to a frozen page. |
| **Web Audio → MediaStream → `<audio>`** | `WebMediaPlayerMS` is `kOneShot`, so no notification and no foreground service. |
| **Web Push + `showNotification`** | The only architecturally correct *remote* alarm, but it needs a server and shows a notification, and precision is seconds-to-minutes. Viable as a recovery backstop, not as the timer. |

## Sources

- [Android 17: background audio hardening](https://developer.android.com/about/versions/17/changes/bg-audio) — the 2026 change that makes the `<audio>` element mandatory; failures are silent.
- [Chromium `services/audio/output_stream.cc`](https://github.com/chromium/chromium/blob/main/services/audio/output_stream.cc) — `kSilenceThresholdDBFS = -72.24719896f`, the exact audibility gate.
- [Chromium `media/base/audio_power_monitor.cc`](https://github.com/chromium/chromium/blob/main/media/base/audio_power_monitor.cc) — the mean-square power measurement the gate is applied to.
- [Chrome: background tabs](https://developer.chrome.com/blog/background_tabs) — "Silent audio streams do not grant exemptions."
- [Chrome: media notifications](https://developer.chrome.com/blog/media-notifications) — no notification for Web Audio unless played through an audio element; only media over five seconds.
- [Chromium `media/base/audio_latency.cc`](https://github.com/chromium/chromium/blob/main/media/base/audio_latency.cc) — what `latencyHint:'playback'` buys (POWER_SAVING mode, ~21 ms buffer).
- [WebKit `AudioContext.cpp`](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/webaudio/AudioContext.cpp) — `shouldOverrideBackgroundPlaybackRestriction()` requires `audioSession.type === 'playback'`.
- [web.dev: installation / WebAPK minting](https://web.dev/learn/pwa/installation) — which browsers mint a WebAPK and which only make a shortcut.
- [Page Lifecycle API — Chrome for Developers](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) — official doc confirming pages playing audio are exempt from freezing.
- [WICG Page Lifecycle spec](https://wicg.github.io/page-lifecycle/) — freezing/discarding heuristics.
- [t-mullen/silent-audio](https://github.com/t-mullen/silent-audio) — existing open-source precedent for the "near-silent audio keeps background timers alive" technique; its README states plainly that *silent* streams do not receive the exemption, only audible ones do.
- [How to Keep Audio Playing in the Background in Chrome on Android (spf.io)](https://www.spf.io/2025/01/30/how-to-keep-audio-playing-in-the-background-in-chrome-on-android/) — real-world report attributing background audio loss on Android to Chrome's battery-optimization status, fixed by setting it to Unrestricted; independent of any page-level code.
- [Android Doze and App Standby — Android Developers](https://developer.android.com/training/monitoring-device-state/doze-standby) — confirms even a battery-optimization exemption ("Unrestricted") is only a *partial* exemption from Doze/Standby restrictions.
- [WebAPKs on Android — web.dev](https://web.dev/articles/webapks) — official Google doc confirming an installed PWA registers as its own entry in Android's app settings, separate from the browser.
- [MDN: Offline and background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) — explicit that no web-platform background mechanism (service workers included) is guaranteed to keep running; the browser may stop it "when it thinks it is appropriate."
- [Screen Wake Lock API — W3C spec](https://w3c.github.io/screen-wake-lock/) — a screen wake lock must not apply after the user manually turns the screen off, which is why it doesn't help this repo's "lock the phone and hide it" use case.
