/* app.js — Meditation Timer
   Audio engine (Web Audio API), drift-free timer, Media Session, custom time, PWA.

   Lock-screen reliability:
   All audio events that must fire while the phone is locked — the end-of-session
   fade-out, the triple end bell, and the interval beats — are scheduled on the
   AudioContext hardware clock at session start (source.start(when) / gain ramps).
   The Web Audio clock keeps running while the screen is off; requestAnimationFrame
   and setTimeout do NOT. rAF is therefore used only to update the visible countdown
   and to drive UI cleanup once the screen is visible again. */

'use strict';

const APP_VERSION = 'v26.08.30';   // format vYY.MM.DD — keep in lockstep with sw.js + index.html

// ── Sound catalogue ──────────────────────────────────────────────────────────
//
// type: 'loop'     — audio element loops continuously throughout the session.
//                    Fades run on the shared gain node.
// type: 'interval' — a bell hit is scheduled every intervalMs on the audio clock
//                    (no looping media element). Beats run through the gain node
//                    so they fade in/out with the session.

const SOUNDS = [
  {
    id: 'bowls',
    label: 'Soundtrack',
    sub: 'continuous track',
    file: './resources/bowls long interval.mp3',
    type: 'loop',
  },
  {
    id: 'bowl-bell',
    label: 'Interval bell',
    sub: 'every 1 min',
    file: './resources/Single bowl sound.mp3',
    type: 'interval',
    intervalMs: 60000,
  },
];

// ── Fade constants (seconds) ─────────────────────────────────────────────────

const FADE_IN  = 8;
const FADE_OUT = 10;

const PAUSE_FADE_OUT = 2;    // user-initiated stop/pause
const RESUME_FADE_IN = 0.5;  // resume after pause

// End-of-session bells: three strikes, spaced.
const END_BELL_OFFSETS = [0, 0.4, 0.8];

// Interval bell pitch variation: each beat is randomly detuned by a sample drawn
// from N(0, BELL_DETUNE_SD²) in cents. ±15 cents (1 SD) is subtle — audibly
// different each strike without sounding out of tune. End bells are not detuned.
const BELL_DETUNE_SD = 15;

function randn() {
  // Box-Muller transform: two uniform samples → one standard-normal sample.
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ── State ────────────────────────────────────────────────────────────────────

let selectedSound     = SOUNDS[0];
let selectedMinutes   = 15;
let state             = 'idle';   // idle | playing | paused | finishing
let sessionDurationMs = 0;
let elapsedMs         = 0;
let startTimestamp    = null;
let rafId             = null;
let bgFadeTimeout     = null;      // delayed audio.pause() after a user-initiated fade-out
let endHoldTimeout    = null;      // wall-clock backstop for releasing the audio session

// ── Audio setup ──────────────────────────────────────────────────────────────

let audioCtx    = null;
let gainNode    = null;
let audioEl     = null;
let mediaSource = null;

let bellBuffer  = null;            // decoded PCM for interval beats + end-of-session bells
let bellFailed  = false;           // the bell could not be fetched/decoded (offline, 404)
let scheduledSources = [];         // AudioBufferSourceNodes scheduled ahead on the audio clock
let keepAliveSrc = null;           // silent looping source that keeps the context awake

let silentEl  = null;              // silent looping <audio> — keeps the iOS audio session alive
let silentUrl = null;              // blob: URL for the generated silent clip

function ensureAudio() {
  if (audioEl) return;

  audioEl = new Audio();
  audioEl.crossOrigin = 'anonymous';
  audioEl.src = selectedSound.file;
  audioEl.loop = selectedSound.type === 'loop';
  audioEl.preload = 'metadata';

  const Ctx = window.AudioContext || window.webkitAudioContext;
  // latencyHint:'playback' is the biggest battery win available here. In Chrome it maps
  // to AAUDIO_PERFORMANCE_MODE_POWER_SAVING on Android and to a ~21 ms (1024-frame)
  // buffer instead of the raw hardware buffer — roughly 47 device callbacks per second
  // instead of 200-500. Nothing here is latency-sensitive: every bell is scheduled
  // minutes ahead of when it rings. renderSizeHint (Chrome 153+) aligns the render
  // quantum with the device burst; unknown dictionary members are simply ignored.
  try       { audioCtx = new Ctx({ latencyHint: 'playback', renderSizeHint: 'hardware' }); }
  catch (e) { audioCtx = new Ctx(); }

  // iOS/Safari only (16.4+). WebKit interrupts an AudioContext as soon as the page is
  // backgrounded *unless* the audio session type is 'playback' — that exact property is
  // the condition in WebCore's shouldOverrideBackgroundPlaybackRestriction(). Without it
  // an iPhone session ends in silence the moment the screen locks.
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch {}

  // If the OS suspends the context — audio focus lost to a call or a notification while
  // the screen is off — every pre-scheduled bell, including the end bell, is dead until
  // it is resumed. Nothing else in the app was watching for this.
  audioCtx.onstatechange = () => {
    if (!audioCtx || audioReleased) return;
    // iOS reports 'interrupted' (a phone call, Siri), Android 'suspended'. Only the
    // latter used to be handled, so one incoming call silently ended the session.
    const stalled = audioCtx.state === 'suspended' || audioCtx.state === 'interrupted';
    if (stalled && (state === 'playing' || state === 'finishing')) {
      audioCtx.resume().catch(() => {});
    }
  };

  mediaSource = audioCtx.createMediaElementSource(audioEl);
  gainNode = audioCtx.createGain();
  gainNode.gain.value = 0;
  mediaSource.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  // Pre-decode the bell so it can be scheduled via the audio clock.
  // AudioBufferSourceNode.start() is driven by the Web Audio engine, so it fires
  // reliably on a locked screen — plain Audio elements do not.
  //
  // Race guard: if the user starts a session before decode finishes, bellBuffer is
  // null and scheduleHit silently drops every hit. When the buffer arrives we check
  // whether a session is already running and reschedule from the current position.
  loadBell(0);
}

// The bell is not optional — it IS the end chime and every interval beat. A single
// transient failure used to leave bellBuffer null forever, so every later session ended
// in silence with no indication why.
function loadBell(attempt) {
  fetch('./resources/Single bowl sound.mp3', attempt ? { cache: 'reload' } : undefined)
    .then(r => { if (!r.ok) throw new Error('bell ' + r.status); return r.arrayBuffer(); })
    .then(buf => audioCtx.decodeAudioData(buf))
    .then(decoded => {
      bellBuffer = decoded;
      bellFailed = false;
      if ((state === 'playing' || state === 'finishing') && audioCtx && startTimestamp !== null) {
        const elapsed = elapsedMs + (performance.now() - startTimestamp);
        const remaining = Math.max(0, sessionDurationMs - elapsed);
        if (remaining > 0) {
          clearScheduledSources();
          // scheduleAudioFrom reads the GLOBAL elapsedMs for the beat grid and the fade,
          // and that is only updated on pause, so it was still 0 here: the 8 s fade-in
          // restarted and the beats were laid down from the wrong origin. Sync it, then
          // restore, so the pause/resume bookkeeping is untouched.
          const savedElapsed = elapsedMs;
          const savedStart = startTimestamp;
          elapsedMs = elapsed;
          startTimestamp = performance.now();
          scheduleAudioFrom(remaining, true);
          elapsedMs = savedElapsed;
          startTimestamp = savedStart;
        }
      }
    })
    .catch(() => {
      bellFailed = true;
      if (attempt < 4) {
        setTimeout(() => loadBell(attempt + 1), 1000 * Math.pow(2, attempt));  // 1s,2s,4s,8s
        return;
      }
      if (state === 'idle') setStatus('bell unavailable — reconnect once to save it offline');
    });
}

// Schedule one bell strike at an absolute AudioContext time.
//   throughGain  true  → routed through the fade gain (interval beats fade in/out)
//   throughGain  false → routed straight to the output (end bells always full volume)
//   detuneCents        → optional pitch offset in cents (0 = no change)
function scheduleHit(ctxTime, throughGain, detuneCents = 0) {
  if (!audioCtx || !bellBuffer) return null;
  const src = audioCtx.createBufferSource();
  src.buffer = bellBuffer;
  if (detuneCents !== 0) src.detune.value = detuneCents;
  // Bells that bypass the fade go through a headroom gain instead of straight to the
  // destination: three overlapping copies of a hot sample summed to 1.0 clipped audibly
  // on the single most important sound in the app.
  src.connect(throughGain ? gainNode : bellOutGain());
  src.start(ctxTime);
  src.onended = () => { scheduledSources = scheduledSources.filter(s => s !== src); };
  scheduledSources.push(src);
  return src;
}

let bellOut = null;

// ~5 dB of headroom — enough for three overlapping strikes without clipping.
function bellOutGain() {
  if (!bellOut) {
    bellOut = audioCtx.createGain();
    bellOut.gain.value = 0.55;
    bellOut.connect(audioCtx.destination);
  }
  return bellOut;
}

// Stop and forget every source we scheduled ahead (used on pause / stop / sound switch).
function clearScheduledSources() {
  scheduledSources.forEach(s => {
    // Detach first: stop() fires onended, and an end-of-session callback must not run
    // just because the user paused or switched sounds.
    try { s.onended = null; } catch {}
    try { s.stop(); } catch {}
    try { s.disconnect(); } catch {}
  });
  scheduledSources = [];
}

// Keep-alive between scheduled events while the screen is locked — important for
// 'interval' mode, which has no continuously-playing media element of its own.
//
// Deliberately NOT digital silence. Chrome exempts a page from background
// freezing only while it counts as "playing audio" (documented:
// developer.chrome.com/docs/web-platform/page-lifecycle-api) — a frozen page's
// AudioContext stops too, so scheduled bells die with it. That audibility check
// is power-based: a literal all-zero stream does not qualify, confirmed by prior
// art solving this exact problem (github.com/t-mullen/silent-audio). SoundAnnoyer
// v26.06.19 shipped a zero-filled keep-alive and died on lock exactly this way.
// A faint 25 Hz tone — clearly nonzero, but far below the human hearing threshold
// at that frequency — fixes it while staying imperceptible. See
// knowledge/locked-screen-audio.md for the full writeup, including the caveat
// that the amplitude below is an engineering safety margin, not a verified
// Chromium constant.
const KEEPALIVE_FREQ = 25;    // Hz
const KEEPALIVE_AMP  = 0.002; // Chrome's audibility gate is exact: mean-square power
                              // >= -72.24719896 dBFS, i.e. RMS >= 2^-12 (1/4096), in
                              // services/audio/output_stream.cc. A 0.002 sine has RMS
                              // 1.41e-3 -> -57 dBFS: 15 dB of margin, still ~57 dB
                              // below full scale. Never lower this, never zero it.

function startKeepAlive() {
  if (!audioCtx) return;
  stopKeepAlive();
  const sr  = audioCtx.sampleRate;
  const len = sr * 2;                               // 2 s = 50 full cycles at 25 Hz
  const buf = audioCtx.createBuffer(1, len, sr);
  const ch  = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    ch[i] = Math.sin(2 * Math.PI * KEEPALIVE_FREQ * (i / sr)) * KEEPALIVE_AMP;
  }
  keepAliveSrc = audioCtx.createBufferSource();
  keepAliveSrc.buffer = buf;
  keepAliveSrc.loop = true;
  keepAliveSrc.connect(audioCtx.destination);
  keepAliveSrc.start();
}

function stopKeepAlive() {
  if (!keepAliveSrc) return;
  try { keepAliveSrc.stop(); } catch {}
  try { keepAliveSrc.disconnect(); } catch {}
  keepAliveSrc = null;
}

// iOS suspends the AudioContext the moment no media element is playing — which is
// exactly the case in 'interval' mode (no looping soundtrack). A Web Audio buffer
// is not enough to hold the audio session open on iOS; a real, playing <audio>
// element is. So we generate a tiny WAV carrying the same faint keep-alive tone
// (as a blob: URL, since the CSP allows blob: but not data: for media) and loop it
// for the whole interval session. This keeps the session — and therefore the
// scheduled bells — alive while the screen is locked, and on Android its faint
// audibility stops the page from being frozen (see the keep-alive note above).

function makeKeepAliveWavBlob(seconds = 10, sampleRate = 8000) {
  const numSamples = Math.floor(seconds * sampleRate);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);             // fmt chunk size
  view.setUint16(20, 1, true);              // PCM
  view.setUint16(22, 1, true);              // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);              // block align
  view.setUint16(34, 16, true);             // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  for (let i = 0; i < numSamples; i++) {    // faint 25 Hz tone, whole cycles → seamless loop
    const s = Math.sin(2 * Math.PI * KEEPALIVE_FREQ * (i / sampleRate)) * KEEPALIVE_AMP;
    view.setInt16(44 + i * 2, Math.round(s * 32767), true);
  }
  return new Blob([view], { type: 'audio/wav' });
}

function ensureSilentEl() {
  if (silentEl) return;
  silentUrl = URL.createObjectURL(makeKeepAliveWavBlob());
  silentEl = new Audio(silentUrl);
  silentEl.loop = true;
  // Played directly (not through the AudioContext): its job is to keep the
  // platform audio session active so the context's scheduled bells keep firing.
  // If the OS pauses it (transient audio-focus loss: a notification, the lock
  // event itself), take playback back — otherwise the session dies while locked.
  silentEl.addEventListener('pause', () => {
    if (audioReleased) return;
    if (state !== 'playing' && state !== 'finishing') return;
    setTimeout(() => {
      if ((state === 'playing' || state === 'finishing') && silentEl && silentEl.paused) {
        silentEl.play().catch(() => {});
      }
    }, 400);
  });
}

// The soundtrack element needs the same defence. If Android takes audio focus away for a
// moment (an incoming notification, the lock event itself) it pauses the element, and
// nothing here used to give it back — the track stayed silent for the rest of the session
// and the page lost its strongest "this tab is playing media" signal, which is exactly
// what lets Android freeze the page and kill the pre-scheduled end bell.
function guardTrackPlayback() {
  if (!audioEl || audioEl.dataset.guarded) return;
  audioEl.dataset.guarded = '1';
  audioEl.addEventListener('pause', () => {
    if (audioReleased) return;
    if (state !== 'playing' && state !== 'finishing') return;
    if (selectedSound.type !== 'loop') return;
    setTimeout(() => {
      if ((state === 'playing' || state === 'finishing') && audioEl && audioEl.paused) {
        audioEl.play().catch(() => {});
      }
    }, 400);
  });
}

function startSilentKeepAlive() {
  ensureSilentEl();
  silentEl.currentTime = 0;
  silentEl.play().catch(() => {});
}

function stopSilentKeepAlive() {
  if (silentEl) silentEl.pause();
}

// ── Audio scheduling ─────────────────────────────────────────────────────────
// Schedules the entire remaining session — fade envelope, interval beats, and the
// triple end bell — on the audio clock, starting from audioCtx.currentTime. Called
// at session start and again on every resume. Because every event is placed on the
// hardware clock, the session ends (and the bells ring) even if the screen locks.

function scheduleAudioFrom(remainingMs, resuming) {
  const t0      = audioCtx.currentTime;
  // Never negative: a resume after the session should already have ended, or a clock
  // jump, otherwise makes every scheduled bell fire at once and throws RangeError out of
  // the gain ramps below.
  const remSec  = Math.max(0, remainingMs) / 1000;
  const totalSec = sessionDurationMs / 1000;
  const elapsedSec = elapsedMs / 1000;
  const fades   = scaledFades(sessionDurationMs);

  // ── Gain envelope ──
  gainNode.gain.cancelScheduledValues(t0);
  const startGain = resuming ? Math.max(gainNode.gain.value, 0.0001) : 0;
  gainNode.gain.setValueAtTime(startGain, t0);

  let fadeInEnd;
  if (!resuming) {
    gainNode.gain.linearRampToValueAtTime(1, t0 + fades.in);
    fadeInEnd = t0 + fades.in;
  } else if (elapsedMs < fades.in * 1000) {
    const timeLeft = Math.max(RESUME_FADE_IN, fades.in - elapsedSec);
    gainNode.gain.linearRampToValueAtTime(1, t0 + timeLeft);
    fadeInEnd = t0 + timeLeft;
  } else {
    gainNode.gain.linearRampToValueAtTime(1, t0 + RESUME_FADE_IN);
    fadeInEnd = t0 + RESUME_FADE_IN;
  }

  // Hold at full, then fade out to land on zero exactly at the end.
  const fadeOutAnchor = Math.max(fadeInEnd, t0 + Math.max(0, remSec - fades.out));
  gainNode.gain.setValueAtTime(1, fadeOutAnchor);
  gainNode.gain.linearRampToValueAtTime(0, t0 + remSec);

  // ── Interval beats (faded, through the gain node, with subtle pitch variation) ──
  if (selectedSound.type === 'interval') {
    const intervalSec = selectedSound.intervalMs / 1000;
    const firstN = resuming ? Math.ceil(elapsedSec / intervalSec) : 0;
    for (let n = firstN; n * intervalSec < totalSec; n++) {
      const when = t0 + (n * intervalSec - elapsedSec);
      if (when < t0 - 0.001) continue;
      // The opening strike lands exactly where the 8 s fade-in starts from gain 0, so
      // routing it through the envelope made it inaudible — the session began in silence.
      // Send that one past the fade; every later beat rides the envelope as intended.
      const throughFade = !(n === 0 && !resuming);
      scheduleHit(Math.max(t0, when), throughFade, randn() * BELL_DETUNE_SD);
    }
  }

  // ── Triple end bell (full volume, bypassing the fade) ──
  END_BELL_OFFSETS.forEach(off => scheduleHit(t0 + remSec + off, false));

  // ── End-of-session sentinel ──
  // The visible timer runs on requestAnimationFrame, which is frozen while the screen is
  // off — so onSessionEnd() does not run until the user picks the phone up again, and
  // until then the keep-alive, the soundtrack element and the whole audio graph stay
  // live, draining the battery for as long as the phone stays in a pocket. This silent
  // source is scheduled on the audio clock like everything else that must survive a
  // locked screen; its onended is the one end-of-session signal that actually fires on
  // time. It also covers the case where the bell failed to load and there is no end bell
  // whose completion we could hang this off.
  scheduleEndSentinel(t0 + remSec + endBellTail());
}

// How long after the nominal end the last end bell is still sounding. The bowl sample is
// ~39 s, not a short ding, so a fixed few seconds here would tear the audio session down
// while the final bell was still ringing — which on Android 17 means the foreground
// service goes away and the bell is silently muted mid-strike.
function endBellTail() {
  const last = Math.max(...END_BELL_OFFSETS);
  const dur  = bellBuffer ? bellBuffer.duration : 40;
  return last + dur + 1.5;
}

function scheduleEndSentinel(when) {
  if (!audioCtx) return;
  const buf = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);   // one silent frame
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const mute = audioCtx.createGain();
  mute.gain.value = 0;
  src.connect(mute);
  mute.connect(audioCtx.destination);
  src.start(Math.max(audioCtx.currentTime, when));
  src.onended = () => {
    scheduledSources = scheduledSources.filter(x => x !== src);
    releaseAudioHold();
  };
  scheduledSources.push(src);
}

// Let go of everything that holds the platform audio session open. Idempotent: reached
// from the audio clock (sentinel above) when the screen is off, and from onSessionEnd()
// when the user is looking at the screen.
let audioReleased = false;   // set by releaseAudioHold; the pause guards must respect it

function releaseAudioHold() {
  // Must come FIRST: the two `pause` listeners below restart playback 400 ms after any
  // pause while state is 'playing'/'finishing' — and with the screen off, rAF is frozen,
  // so state is still 'playing' here. Without this flag they immediately undid everything
  // this function does, and the phone kept the audio device open indefinitely.
  audioReleased = true;
  stopKeepAlive();
  stopSilentKeepAlive();
  if (audioEl) audioEl.pause();
  if (gainNode && audioCtx) {
    try {
      gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    } catch {}
  }
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  // Let the CPU sleep. An open output stream holds a partial wakelock (roughly 12 mW ->
  // 70 mW on an idle device), and nothing else releases it until the page is closed.
  if (audioCtx && audioCtx.state === 'running') audioCtx.suspend().catch(() => {});
}

// ── Timer loop ───────────────────────────────────────────────────────────────
// Drives the visible countdown only. All audio is already scheduled on the audio
// clock, so this loop freezing while the screen is locked is harmless.

function tick(now) {
  if (state !== 'playing' && state !== 'finishing') return;

  const elapsed = elapsedMs + (now - startTimestamp);
  const remainingMs = Math.max(0, sessionDurationMs - elapsed);
  const fades = scaledFades(sessionDurationMs);

  updateCountdown(remainingMs);

  // Reflect the fade-out window in the UI (pause is locked out during fade-out).
  if (state === 'playing' && remainingMs <= fades.out * 1000) {
    state = 'finishing';
    setPlayBtn('disabled');
  }

  if (remainingMs <= 0) {
    onSessionEnd();
    return;
  }

  rafId = requestAnimationFrame(tick);
}

// ── Session lifecycle ────────────────────────────────────────────────────────

function startSession() {
  if (state !== 'idle') return;

  clearTimeout(bgFadeTimeout);
  clearTimeout(endHoldTimeout);      // a pending release from the previous session
  clearScheduledSources();
  ensureAudio();
  audioCtx.resume();

  sessionDurationMs = selectedMinutes * 60 * 1000;
  elapsedMs = 0;
  state = 'playing';
  startTimestamp = performance.now();

  audioReleased = false;
  startKeepAlive();
  // The faint <audio> keep-alive runs in BOTH modes now. It used to be interval-only, on
  // the assumption that the soundtrack element was signal enough in loop mode — but the
  // soundtrack is routed through the fade gain, so it goes silent during the final 10 s
  // fade-out, right before the end bell is due. That is the moment the page most needs to
  // still count as "playing audio". This element bypasses the gain node entirely.
  startSilentKeepAlive();
  guardTrackPlayback();
  if (selectedSound.type === 'loop') {
    audioEl.currentTime = 0;
    audioEl.play().catch(() => {});
  }

  setMediaSession();
  updateMediaPosition();
  navigator.mediaSession && (navigator.mediaSession.playbackState = 'playing');

  scheduleAudioFrom(sessionDurationMs, false);

  setPlayBtn('pause');
  // If the bell never loaded there will be no interval beats and no end chime. Say so
  // rather than letting the session run its course and end in silence.
  setStatus(bellBuffer ? '' : (bellFailed ? 'no bell — check your connection' : 'loading bell…'));

  rafId = requestAnimationFrame(tick);
}

function pauseSession() {
  if (state !== 'playing' && state !== 'finishing') return;

  elapsedMs += (performance.now() - startTimestamp);
  cancelAnimationFrame(rafId);
  clearTimeout(bgFadeTimeout);
  clearTimeout(endHoldTimeout);
  clearScheduledSources();

  gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
  gainNode.gain.setValueAtTime(Math.max(gainNode.gain.value, 0.001), audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + PAUSE_FADE_OUT);
  bgFadeTimeout = setTimeout(() => {
    if (state === 'paused') {
      if (audioEl) audioEl.pause();
      stopKeepAlive();
      stopSilentKeepAlive();
      gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    }
  }, PAUSE_FADE_OUT * 1000 + 50);

  navigator.mediaSession && (navigator.mediaSession.playbackState = 'paused');
  state = 'paused';
  setPlayBtn('resume');
  setStatus('paused');
}

function resumeSession() {
  if (state !== 'paused') return;

  clearTimeout(bgFadeTimeout);
  audioCtx.resume();

  audioReleased = false;
  startKeepAlive();
  startSilentKeepAlive();
  guardTrackPlayback();
  if (selectedSound.type === 'loop' && audioEl.paused) audioEl.play().catch(() => {});

  navigator.mediaSession && (navigator.mediaSession.playbackState = 'playing');
  state = 'playing';
  startTimestamp = performance.now();

  scheduleAudioFrom(sessionDurationMs - elapsedMs, true);
  updateMediaPosition();

  setPlayBtn('pause');
  setStatus('');
  rafId = requestAnimationFrame(tick);
}

function stopSession() {
  if (state === 'idle') return;

  cancelAnimationFrame(rafId);
  clearTimeout(bgFadeTimeout);
  clearTimeout(endHoldTimeout);
  clearScheduledSources();
  stopKeepAlive();
  stopSilentKeepAlive();

  navigator.mediaSession && (navigator.mediaSession.playbackState = 'none');

  if (gainNode) {
    gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    gainNode.gain.setValueAtTime(Math.max(gainNode.gain.value, 0.001), audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + PAUSE_FADE_OUT);
    bgFadeTimeout = setTimeout(() => {
      if (audioEl) audioEl.pause();
      if (gainNode) {
        gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      }
    }, PAUSE_FADE_OUT * 1000 + 50);
  } else if (audioEl) {
    audioEl.pause();
  }

  resetUI();
  applyUpdateIfSafe(PAUSE_FADE_OUT * 1000 + 600);   // let the stop fade finish first
}

function onSessionEnd() {
  cancelAnimationFrame(rafId);
  state = 'finishing';

  document.body.classList.add('session-complete');

  // The fade-out and the triple bell were scheduled on the audio clock back at
  // session start, so they have already played — even if the screen was locked
  // when the timer ran out. Here we only tidy up the UI and stop the silent
  // playback once the page is visible again.
  if (audioCtx) audioCtx.resume();

  // Two different clocks, on purpose.
  //
  // The UI comes back quickly — the user should not have to wait out a 39-second bowl
  // before they can start another session. The AUDIO is released separately, once the end
  // bells have actually finished; normally the audio-clock sentinel does that (it is the
  // only thing that fires on time with the screen off), and endHoldTimeout is just the
  // wall-clock backstop for when the sentinel never runs.
  setTimeout(() => {
    resetUI();
    document.body.classList.remove('session-complete');
    setStatus('session complete');
    setTimeout(() => setStatus(''), 3000);
    applyUpdateIfSafe(3600);   // a build that landed mid-session applies once the
                               // "session complete" line has been read
  }, 3500);

  clearTimeout(endHoldTimeout);
  endHoldTimeout = setTimeout(releaseAudioHold, endBellTail() * 1000);
}

// ── Gain helpers ─────────────────────────────────────────────────────────────

function scaledFades(durationMs) {
  const sec = durationMs / 1000;
  if (sec < 25) {
    const scale = sec / 25;
    return { in: FADE_IN * scale, out: FADE_OUT * scale };
  }
  return { in: FADE_IN, out: FADE_OUT };
}

// ── Media Session API ────────────────────────────────────────────────────────

function setMediaSession() {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title:  'Meditation Session',
    artist: selectedSound.label,
    album:  'Meditation Timer',
    artwork: [
      { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  });

  navigator.mediaSession.setActionHandler('play',  resumeSession);
  navigator.mediaSession.setActionHandler('pause', () => {
    // Pausing tears down every pre-scheduled source, end bells included. From the lock
    // screen that is invisible, so make it obvious the moment the screen comes back.
    pauseSession();
    setStatus('paused from the lock screen');
  });
  navigator.mediaSession.setActionHandler('stop',  stopSession);
}

// Surface the countdown on the lock screen where the platform supports it.
function updateMediaPosition() {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
  try {
    navigator.mediaSession.setPositionState({
      duration: sessionDurationMs / 1000,
      position: Math.min(elapsedMs, sessionDurationMs) / 1000,
      playbackRate: 1,
    });
  } catch {}
}

// ── Custom time (localStorage) ───────────────────────────────────────────────

const CUSTOM_KEY = 'meditation-custom-min';

function loadCustomTime() {
  let raw = null;
  try { raw = localStorage.getItem(CUSTOM_KEY); } catch { return null; }
  const savedMin = parseInt(raw, 10);
  if (!savedMin || savedMin < 1 || savedMin > 180) return null;
  return savedMin;
}

function saveCustomTime(min) {
  try { localStorage.setItem(CUSTOM_KEY, String(min)); } catch {}
}

function isPresetDuration(min) {
  return PRESETS.includes(min);
}

function getSelectableCustomTime() {
  const savedMin = loadCustomTime();
  return savedMin && !isPresetDuration(savedMin) ? savedMin : null;
}

function setSelectedDuration(min) {
  if (state !== 'idle') stopSession();
  selectedMinutes = min;
  renderDurations();
  showIdleCountdown();
}

// ── UI helpers ───────────────────────────────────────────────────────────────

const elCountdown     = document.getElementById('countdown');
const elDurationLabel = document.getElementById('duration-label');
const elStatus        = document.getElementById('status');
const elPlayBtn       = document.getElementById('btn-play');
const elResetBtn      = document.getElementById('btn-reset');
const elSoundGroup    = document.getElementById('sound-group');
const elDurationGroup = document.getElementById('duration-group');
const elInstallBtn    = document.getElementById('install-btn');
const elUpdateBtn     = document.getElementById('update-btn');
const elOfflineBtn    = document.getElementById('offline-btn');
const elVersion       = document.getElementById('version');
const elInstallModalLayer   = document.getElementById('install-modal-layer');
const elInstallModal        = document.getElementById('install-modal');
const elInstallModalDismiss = document.getElementById('install-modal-dismiss');
const elInstallSteps        = document.getElementById('install-steps');
const elInstallCloseBtn     = document.getElementById('install-close-btn');
const elInstallProceedBtn   = document.getElementById('install-proceed-btn');
const elCustomModalLayer = document.getElementById('custom-modal-layer');
const elCustomModal = document.getElementById('custom-modal');
const elCustomModalDismiss = document.getElementById('custom-modal-dismiss');
const elCustomDurationForm = document.getElementById('custom-duration-form');
const elCustomDurationValue = document.getElementById('custom-duration-value');
const elCustomDurationError = document.getElementById('custom-duration-error');
const elCustomDurationCancel = document.getElementById('custom-duration-cancel');
const elCustomKeypad = document.querySelector('.custom-keypad');

let customDurationDraft = '';

let lastCountdownText = '';

function updateCountdown(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const text = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  // rAF runs at 60 Hz; the text changes once a second. Skip the other 59 DOM writes.
  if (text === lastCountdownText) return;
  lastCountdownText = text;
  elCountdown.textContent = text;
}

function showIdleCountdown() {
  const m = String(Math.floor(selectedMinutes)).padStart(2, '0');
  lastCountdownText = `${m}:00`;
  elCountdown.textContent = lastCountdownText;
  elDurationLabel.textContent = `${selectedMinutes} min`;
}

function setStatus(msg) {
  elStatus.textContent = msg;
}

function setPlayBtn(mode) {
  if (mode === 'play') {
    elPlayBtn.disabled = false;
    elPlayBtn.textContent = 'Begin';
    elResetBtn.classList.add('hidden');
  } else if (mode === 'pause') {
    elPlayBtn.disabled = false;
    elPlayBtn.textContent = 'Pause';
    elResetBtn.classList.remove('hidden');
  } else if (mode === 'resume') {
    elPlayBtn.disabled = false;
    elPlayBtn.textContent = 'Resume';
    elResetBtn.classList.remove('hidden');
  } else if (mode === 'disabled') {
    elPlayBtn.disabled = true;
    elPlayBtn.textContent = 'Fading out…';
    elResetBtn.classList.remove('hidden');
  }
}

function resetUI() {
  state = 'idle';
  elapsedMs = 0;
  startTimestamp = null;
  document.body.classList.remove('session-complete');
  showIdleCountdown();
  setPlayBtn('play');
}

// ── Sound buttons ────────────────────────────────────────────────────────────

function renderSounds() {
  elSoundGroup.innerHTML = '';
  SOUNDS.forEach(sound => {
    const btn = document.createElement('button');
    btn.className = 'btn' + (sound === selectedSound ? ' selected' : '');
    btn.type = 'button';

    const label = document.createElement('span');
    label.textContent = sound.label;
    btn.appendChild(label);

    const sub = document.createElement('span');
    sub.className = 'btn-detail';
    sub.textContent = sound.sub;
    btn.appendChild(sub);

    btn.addEventListener('click', () => {
      if (state !== 'idle') stopSession();
      selectedSound = sound;
      renderSounds();
      // Re-point the existing element instead of tearing the whole graph down. The old
      // code closed the AudioContext and dropped bellBuffer, which meant the next session
      // had to re-fetch and re-decode the 1.5 MB bell from scratch — reintroducing the
      // race where a session starts with no bell and therefore no end chime. A
      // MediaElementSourceNode follows its element's src, so a swap is all that is needed.
      if (audioEl) {
        clearScheduledSources();
        stopKeepAlive();
        stopSilentKeepAlive();
        audioEl.pause();
        audioEl.src  = selectedSound.file;
        audioEl.loop = selectedSound.type === 'loop';
        if (gainNode && audioCtx) {
          gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
          gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        }
      }
    });
    elSoundGroup.appendChild(btn);
  });
}

// ── Duration buttons ─────────────────────────────────────────────────────────

const PRESETS = [5, 10, 15, 20];

function renderDurations() {
  elDurationGroup.innerHTML = '';

  PRESETS.forEach(min => {
    const btn = document.createElement('button');
    btn.className = 'btn' + (min === selectedMinutes ? ' selected' : '');
    btn.type = 'button';
    btn.textContent = `${min} min`;
    btn.addEventListener('click', () => setSelectedDuration(min));
    elDurationGroup.appendChild(btn);
  });

  appendCustomBtn();
}

function appendCustomBtn() {
  const savedMin = loadCustomTime();
  const selectableCustomMin = getSelectableCustomTime();
  const isCustomSelected = selectableCustomMin && selectedMinutes === selectableCustomMin;

  if (selectableCustomMin) {
    const selectBtn = document.createElement('button');
    selectBtn.className = 'btn' + (isCustomSelected ? ' selected' : '');
    selectBtn.type = 'button';
    selectBtn.dataset.custom = 'saved';

    const label = document.createElement('span');
    label.textContent = `${selectableCustomMin} min`;
    selectBtn.appendChild(label);

    const sub = document.createElement('span');
    sub.className = 'btn-detail';
    sub.textContent = 'Custom';
    selectBtn.appendChild(sub);

    selectBtn.addEventListener('click', () => setSelectedDuration(selectableCustomMin));

    elDurationGroup.appendChild(selectBtn);
  }

  const editBtn = document.createElement('button');
  editBtn.className = 'btn';
  editBtn.type = 'button';
  editBtn.dataset.custom = 'edit';

  const editLabel = document.createElement('span');
  editLabel.textContent = 'Custom';
  editBtn.appendChild(editLabel);

  const editSub = document.createElement('span');
  editSub.className = 'btn-detail';
  editSub.textContent = savedMin ? 'Update time' : 'Create time';
  editBtn.appendChild(editSub);

  editBtn.addEventListener('click', () => {
    if (state !== 'idle') stopSession();
    openCustomTimeModal(savedMin);
  });

  elDurationGroup.appendChild(editBtn);
}

function openCustomTimeModal(currentMin) {
  const activeCustomMin = !isPresetDuration(selectedMinutes) ? selectedMinutes : currentMin;

  customDurationDraft = activeCustomMin ? String(activeCustomMin) : '';
  elCustomDurationError.textContent = '';
  renderCustomDurationDisplay();
  elCustomModalLayer.classList.remove('hidden');
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => elCustomModal.focus());
}

function closeCustomTimeModal() {
  elCustomModalLayer.classList.add('hidden');
  document.body.classList.remove('modal-open');
  elCustomDurationError.textContent = '';
}

function renderCustomDurationDisplay() {
  elCustomDurationValue.textContent = customDurationDraft || '--';
}

function applyCustomKey(key) {
  if (customDurationDraft.length >= 3) return;

  if (customDurationDraft === '0') {
    customDurationDraft = key;
  } else {
    customDurationDraft += key;
  }

  renderCustomDurationDisplay();
}

function clearCustomDraft() {
  customDurationDraft = '';
  renderCustomDurationDisplay();
}

function backspaceCustomDraft() {
  customDurationDraft = customDurationDraft.slice(0, -1);
  renderCustomDurationDisplay();
}

function submitCustomTime() {
  const val = parseInt(customDurationDraft, 10);

  if (!val || val < 1 || val > 180) {
    elCustomDurationError.textContent = 'Enter a whole number between 1 and 180.';
    return;
  }

  saveCustomTime(val);
  selectedMinutes = val;
  renderDurations();
  showIdleCountdown();
  closeCustomTimeModal();
}

elCustomDurationForm.addEventListener('submit', event => {
  event.preventDefault();
  submitCustomTime();
});

elCustomKeypad.addEventListener('click', event => {
  const target = event.target.closest('button');
  if (!target) return;

  elCustomDurationError.textContent = '';

  if (target.dataset.key) {
    applyCustomKey(target.dataset.key);
    return;
  }

  if (target.dataset.action === 'clear') {
    clearCustomDraft();
    return;
  }

  if (target.dataset.action === 'backspace') {
    backspaceCustomDraft();
  }
});

elCustomDurationCancel.addEventListener('click', closeCustomTimeModal);
elCustomModalDismiss.addEventListener('click', closeCustomTimeModal);

document.addEventListener('keydown', event => {
  if (!elInstallModalLayer.classList.contains('hidden')) {
    if (event.key === 'Escape') closeInstallModal();
    return;
  }

  if (elCustomModalLayer.classList.contains('hidden')) return;

  if (event.key === 'Escape') {
    closeCustomTimeModal();
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    submitCustomTime();
    return;
  }

  if (/^[0-9]$/.test(event.key)) {
    event.preventDefault();
    elCustomDurationError.textContent = '';
    applyCustomKey(event.key);
    return;
  }

  if (event.key === 'Backspace') {
    event.preventDefault();
    backspaceCustomDraft();
    return;
  }

  if (event.key === 'Delete') {
    event.preventDefault();
    clearCustomDraft();
  }
});

// ── Play button handler ──────────────────────────────────────────────────────

elPlayBtn.addEventListener('click', () => {
  if (state === 'idle')          startSession();
  else if (state === 'playing')  pauseSession();
  else if (state === 'paused')   resumeSession();
});

elResetBtn.addEventListener('click', () => {
  stopSession();
});

// ── PWA: install ─────────────────────────────────────────────────────────────
// Android / desktop fire `beforeinstallprompt` → we trigger the native prompt.
// iOS Safari never does, so the Install button instead opens step-by-step
// "Add to Home Screen" instructions. The button always shows unless already standalone.

let deferredInstallPrompt = window.deferredInstallPrompt || null;

function isStandalone() {
  // Not just 'standalone': display_override lists minimal-ui, and Android can launch a
  // WebAPK fullscreen. Any of them means we are running as an installed app.
  return ['standalone', 'minimal-ui', 'fullscreen', 'window-controls-overlay']
           .some(mode => window.matchMedia(`(display-mode: ${mode})`).matches)
      || window.navigator.standalone === true;
}

function isIOS() {
  const ua = navigator.userAgent || '';
  // iPadOS 13+ reports as desktop Safari, so also treat touch-capable Mac as iOS.
  return /iphone|ipad|ipod/i.test(ua)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Only Chrome (with Google Mobile Services) and Samsung Internet mint a WebAPK — a real
// Android app package. Brave fires beforeinstallprompt like any Chromium browser but only
// ever produces a home-screen shortcut, with no entry under Settings → Apps and therefore
// no per-app battery setting. That matters here: the end-of-session bell has to survive a
// locked screen.
let isBrave = false;
if (navigator.brave && navigator.brave.isBrave) {
  navigator.brave.isBrave().then(v => { isBrave = !!v; }).catch(() => {});
}

const INSTALLED_KEY = 'meditation-installed';

function wasInstalled() {
  try { return localStorage.getItem(INSTALLED_KEY) === '1'; } catch { return false; }
}

function refreshInstallUI() {
  if (isStandalone()) {
    // Definitive: we ARE the installed app.
    elInstallBtn.textContent = '✓ Installed';
    elInstallBtn.disabled = true;
    return;
  }
  // isStandalone() is only true inside the installed app, so the ordinary tab the user
  // installed FROM used to keep offering to install something they already had. The
  // remembered appinstalled flag fixes the label — but deliberately does NOT disable the
  // button. A remembered flag can outlive the install (uninstalled, app data cleared,
  // second device), and a permanently dead Install button is precisely the "install
  // doesn't work" symptom this pass exists to remove.
  elInstallBtn.textContent = wasInstalled() ? '✓ Installed — install again?' : 'Install app';
  elInstallBtn.disabled = false;
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();          // keep our own button in charge of the prompt
  deferredInstallPrompt = e;
  window.deferredInstallPrompt = e;
  // Chrome does not fire this event while the app IS installed, so receiving it proves
  // it is not — which is how the remembered flag recovers if the user uninstalls.
  try { localStorage.removeItem(INSTALLED_KEY); } catch {}
  refreshInstallUI();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  window.deferredInstallPrompt = null;
  try { localStorage.setItem(INSTALLED_KEY, '1'); } catch {}
  closeInstallModal();
  refreshInstallUI();
});

// The install button label must follow the display mode, which can flip after load.
window.matchMedia('(display-mode: standalone)').addEventListener?.('change', refreshInstallUI);

// prompt() is one-shot per event instance and needs transient user activation, so this
// must run inside a click handler.
async function firePrompt() {
  const e = deferredInstallPrompt;
  if (!e) return false;
  deferredInstallPrompt = null;
  window.deferredInstallPrompt = null;
  try {
    await e.prompt();
    await e.userChoice;
  } catch {
    // prompt() can reject without consuming the event (no transient activation, say).
    // Put it back so the next tap still gets the native dialog.
    deferredInstallPrompt = e;
    window.deferredInstallPrompt = e;
    refreshInstallUI();
    return false;
  }
  refreshInstallUI();
  return true;
}

elInstallBtn.addEventListener('click', async () => {
  if (isStandalone()) return;
  // Brave DOES fire beforeinstallprompt (it is Chromium) but only ever produces a
  // home-screen shortcut. Going straight to the native dialog would silently hand the
  // user the worse outcome with no explanation, so on Brave show the sheet first.
  if (deferredInstallPrompt && !isBrave) { firePrompt(); return; }
  openInstallModal();          // iOS, Brave, or no live prompt
});

function installSteps() {
  if (isIOS()) {
    return [
      'Open this page in Safari (not another browser).',
      'Tap the Share button — the square with an upward arrow.',
      'Choose "Add to Home Screen", then tap "Add".',
    ];
  }
  if (/android/i.test(navigator.userAgent || '')) {
    if (isBrave) {
      return [
        'Brave can only add a shortcut, not a real installed app.',
        'Open this page in Chrome for a proper install (and a reliable end bell).',
        'Then: menu (⋮) → "Install app" → Confirm.',
      ];
    }
    return [
      'Open the browser menu (⋮, top-right).',
      'Tap "Install app" or "Add to Home screen".',
      'Confirm — it installs and opens on its own.',
    ];
  }
  return [
    'Click the install icon in the address bar (⊕ / a small screen icon).',
    'Or open the browser menu and choose "Install Meditation Timer".',
    'Confirm — it opens as its own app.',
  ];
}

function openInstallModal() {
  elInstallSteps.innerHTML = '';
  installSteps().forEach(step => {
    const li = document.createElement('li');
    li.textContent = step;
    elInstallSteps.appendChild(li);
  });
  // Offer the native dialog as the explicit second choice when one is available.
  elInstallProceedBtn.classList.toggle('hidden', !deferredInstallPrompt);
  elInstallModalLayer.classList.remove('hidden');
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => elInstallModal.focus());
}

function closeInstallModal() {
  elInstallModalLayer.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

elInstallModalDismiss.addEventListener('click', closeInstallModal);
elInstallCloseBtn.addEventListener('click', closeInstallModal);
elInstallProceedBtn.addEventListener('click', async () => {
  closeInstallModal();
  await firePrompt();
});

// ── PWA: update + freshness (offline-safe, app-scoped) ───────────────────────
//
// Never permanently stuck on a stale build when online; never bricked when offline.
// Three mechanisms, weakest to strongest:
//   1. Automatic — the service-worker lifecycle (see the registration block at the end).
//   2. Self-heal — if this page's APP_VERSION and the active worker's VERSION disagree,
//      the cache is serving a shell from a different deploy. Detect it and recover.
//   3. Manual — the Update button / tappable version, below.

const CACHE_PREFIX = 'meditation-timer-';   // caches.keys() is per-ORIGIN and this site
                                            // hosts several apps: only ever touch ours.
const DRIFT_KEY = 'meditation-drift-recovered';

let swReg = null;
let updateMsgTimer = null;
let updateBusy = false;

function flashUpdateMsg(msg) {
  elUpdateBtn.textContent = msg;
  clearTimeout(updateMsgTimer);
  updateMsgTimer = setTimeout(() => {
    elUpdateBtn.textContent = 'Update';
    elUpdateBtn.disabled = false;
  }, 2600);
}

// navigator.onLine only reports that a network interface exists — a captive portal or a
// dead uplink still says `true`. Wiping the caches on that word alone would brick the
// installed app, so probe a real byte. `probe` is excluded from the cache in sw.js.
async function isReallyOnline() {
  if (navigator.onLine === false) return false;
  try {
    const r = await fetch(`./manifest.json?probe=${Date.now()}`, { cache: 'no-store' });
    return r.ok;
  } catch { return false; }
}

function getSwVersion(timeoutMs = 2000) {
  return new Promise(resolve => {
    const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (!sw) return resolve(null);
    const ch = new MessageChannel();
    const done = setTimeout(() => resolve(null), timeoutMs);
    ch.port1.onmessage = e => { clearTimeout(done); resolve((e.data && e.data.version) || null); };
    try { sw.postMessage({ type: 'GET_VERSION' }, [ch.port2]); }
    catch { clearTimeout(done); resolve(null); }
  });
}

// What VERSION does the deployed sw.js say, right now, over the network? This trusts
// neither the registration, the cache, nor the running page — which is the point: it is
// the one check that can still say "you are stale" when every local signal agrees with
// itself and all of it is old.
async function deployedVersion() {
  try {
    const r = await fetch(`./sw.js?probe=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const m = (await r.text()).match(/const VERSION\s*=\s*'([^']+)'/);
    return m ? m[1] : null;
  } catch { return null; }
}

// Tell a waiting worker to take over. controllerchange then reloads the page. If that
// never happens, un-stick the button instead of leaving it disabled forever.
function handOverToWaitingWorker(reg) {
  elUpdateBtn.textContent = 'Updating…';
  reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  setTimeout(() => {
    if (document.visibilityState !== 'hidden') flashUpdateMsg('Update stalled — retry');
  }, 8000);
}

// A worker is still downloading. Hand over as soon as it finishes installing.
function awaitInstallThenHandOver(reg) {
  const sw = reg.installing;
  elUpdateBtn.textContent = 'Downloading…';
  sw.addEventListener('statechange', () => {
    if (sw.state === 'installed' && reg.waiting && state === 'idle') handOverToWaitingWorker(reg);
    else if (sw.state === 'redundant') flashUpdateMsg('Update failed — retry');
  });
  setTimeout(() => {
    if (elUpdateBtn.textContent === 'Downloading…') flashUpdateMsg('Still downloading…');
  }, 15000);
}

// Last resort: rebuild this app's shell from the network. Scoped three ways so it can
// only ever cost what it has to —
//   * this app's caches only (caches.keys() is per-origin, several apps share it),
//   * never the audio cache (that is the user's 44 MB deliberate download),
//   * never before a second connectivity check, because the window between deleting the
//     shell and re-fetching it is the one moment the app has no offline copy at all.
async function hardReset() {
  if (!await isReallyOnline()) {           // re-check: the first probe may be seconds old
    flashUpdateMsg('Offline — kept cache');
    return;
  }
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== AUDIO_CACHE)
            .map(k => caches.delete(k))
      );
    }
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();   // ours only
      if (reg) await reg.unregister();
    }
  } catch {}
  window.location.reload();
}

async function runUpdate() {
  if (updateBusy) return;
  updateBusy = true;
  elUpdateBtn.disabled = true;
  elUpdateBtn.textContent = 'Checking…';

  try {
    if (!await isReallyOnline()) {
      flashUpdateMsg('Offline — cached ✓');
      return;
    }

    const reg = swReg || ('serviceWorker' in navigator
      ? await navigator.serviceWorker.getRegistration()
      : null);

    // Applying an update reloads the page. Never do that during a meditation — remember
    // it and let the session end apply it.
    if (state !== 'idle' && reg && (reg.waiting || reg.installing)) {
      waitingReg = reg;
      flashUpdateMsg('Ready — after this session');
      return;
    }

    // A new build may already be installed and waiting from an earlier check.
    if (reg && reg.waiting) { handOverToWaitingWorker(reg); return; }

    // Non-destructive first: re-check sw.js. Nothing is deleted, so a connection that
    // drops mid-check leaves the installed app completely intact.
    if (reg) {
      await reg.update();
      if (state !== 'idle' && (reg.installing || reg.waiting)) {
        waitingReg = reg;
        flashUpdateMsg('Ready — after this session');
        return;
      }
      if (reg.waiting)    { handOverToWaitingWorker(reg); return; }
      if (reg.installing) { awaitInstallThenHandOver(reg); return; }
    }

    // No newer worker was found. Verify against the deployed file rather than local
    // state before claiming we are current — the failure this exists for is exactly
    // "everything local agrees, and all of it is old".
    const swVersion = await getSwVersion();
    const live = await deployedVersion();
    if ((live && live !== APP_VERSION) || (swVersion && swVersion !== APP_VERSION)) {
      elUpdateBtn.textContent = 'Repairing…';
      await hardReset();
      return;
    }

    flashUpdateMsg(`Newest ✓ ${APP_VERSION}`);
  } catch {
    flashUpdateMsg('Check failed — retry');
  } finally {
    updateBusy = false;
  }
}

elUpdateBtn.addEventListener('click', runUpdate);
elVersion.addEventListener('click', runUpdate);   // tappable version checks for updates

// ── Offline audio download ───────────────────────────────────────────────────

const AUDIO_CACHED_KEY = 'meditation-audio-cached';
const AUDIO_CACHE = CACHE_PREFIX + 'audio';   // must match sw.js — unversioned on purpose

// Only the streamed `loop` soundtrack is what this button downloads — the bell is small
// and the service worker precaches it. Two mistakes to avoid here, both of which shipped:
//
//  * Walking EVERY cache on the origin looking for any .mp3. SoundAnnoyer lives on the
//    same origin and caches twelve of them, so this said "already downloaded" for a
//    soundtrack that had never been fetched, hid the button, and the app failed offline.
//  * Matching any of SOUNDS[].file. The bell IS one of those entries and is precached, so
//    the check passed immediately and the 44 MB soundtrack could never be downloaded at all.
//
// Check the actual large file(s), in our own audio cache, and require ALL of them.
const BIG_AUDIO = SOUNDS.filter(s => s.type === 'loop').map(s => s.file);

async function isAudioCached() {
  if (!('caches' in window) || !BIG_AUDIO.length) return false;
  try {
    const cache = await caches.open(AUDIO_CACHE);
    for (const url of BIG_AUDIO) {
      const hit = await cache.match(new Request(new URL(url, location.href).href));
      if (!hit) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function initOfflineBtn() {
  // Trust the cache, not the flag: a flag left over from a wiped cache would hide the
  // button for a soundtrack that is no longer there.
  if (await isAudioCached()) { markAudioReady(); return; }
  localStorage.removeItem(AUDIO_CACHED_KEY);
  elOfflineBtn.classList.remove('hidden');
}

function markAudioReady() {
  elOfflineBtn.textContent = 'Audio offline ✓';
  elOfflineBtn.disabled = true;
  elOfflineBtn.classList.remove('hidden');
  try { localStorage.setItem(AUDIO_CACHED_KEY, '1'); } catch {}
}

elOfflineBtn.addEventListener('click', async () => {
  // Download every audio file so the full app (incl. the long soundtrack) works
  // without a connection. The app shell and the bell are already cached by the SW;
  // this pulls in the large .mp3, which is too big to precache on install.
  elOfflineBtn.textContent = 'Downloading…';
  elOfflineBtn.disabled = true;
  try {
    const audioUrls = [...new Set(SOUNDS.map(s => s.file).concat(['./resources/Single bowl sound.mp3']))];
    for (const url of audioUrls) {
      const resp = await fetch(new Request(url));     // no Range header → sw.js caches the full 200
      if (!resp.ok) throw new Error('fetch failed');
      await resp.arrayBuffer();
    }
    // Trust the cache, not the fetch — but give the worker time to finish writing. The
    // 44 MB cache.put runs under event.waitUntil in sw.js and is still in flight when the
    // page's fetch resolves, so checking immediately reported failure after a download
    // that had actually succeeded.
    elOfflineBtn.textContent = 'Saving…';
    let stored = false;
    for (let i = 0; i < 30 && !stored; i++) {          // up to ~30 s
      stored = await isAudioCached();
      if (!stored) await new Promise(r => setTimeout(r, 1000));
    }
    if (!stored) throw new Error('not stored');
    markAudioReady();
  } catch {
    elOfflineBtn.textContent = 'Download failed — retry';
    elOfflineBtn.disabled = false;
  }
});

// ── Init ─────────────────────────────────────────────────────────────────────

elVersion.textContent = APP_VERSION;
renderSounds();
renderDurations();
showIdleCountdown();
initOfflineBtn();
refreshInstallUI();

// Build the audio graph and start decoding the bell NOW rather than at session start.
// scheduleHit() drops every hit while bellBuffer is null, so a session that began before
// the 1.5 MB bell had decoded used to schedule no interval beats and no end bell at all,
// relying on a re-schedule once the decode landed. Doing it up front removes the race —
// and surfaces a failed download while the user is still looking at the screen.
ensureAudio();

// Page Lifecycle: if Android froze the page while locked (e.g. audio focus was
// lost), get the audio clock running again the moment the page is thawed.
document.addEventListener('resume', () => {
  if ((state === 'playing' || state === 'finishing') && audioCtx) audioCtx.resume();
});

// Coming back to the foreground is the other moment the context may need reviving — and
// the only one that fires when the OS merely suspended the context without freezing the
// page. Without this, a session interrupted by a phone call finished in silence.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if ((state === 'playing' || state === 'finishing') && audioCtx) {
    audioCtx.resume().catch(() => {});
    cancelAnimationFrame(rafId);            // a freeze can leave the loop dead
    rafId = requestAnimationFrame(tick);
  }
  applyUpdateIfSafe();
});

// ── Service worker: register + stay on the newest build ───────────────────────
//
// sw.js deliberately does NOT call skipWaiting() on install. The shell is served
// cache-first from a version-keyed cache, so a worker that activates mid-session starts
// serving the new CSS/JS to a page still running the old code. Instead the new worker
// waits, and this page hands it over the moment no meditation is running — so the switch
// and the reload happen together, and an update that arrives during a session is applied
// afterwards instead of being dropped (which is what used to happen).

let waitingReg = null;
let pendingReload = false;   // another window switched workers while we were running

function applyUpdateIfSafe(delayMs = 0) {
  if (pendingReload && state === 'idle') {
    pendingReload = false;
    setTimeout(() => {
      // A session started during the delay: put the flag back rather than dropping the
      // reload on the floor. It lands the next time we are idle.
      if (state !== 'idle') { pendingReload = true; return; }
      window.location.reload();
    }, delayMs);
    return;
  }
  if (!waitingReg) return;
  if (state !== 'idle') return;                 // never interrupt a running meditation
  const reg = waitingReg;
  waitingReg = null;
  // The handover reloads the page. Give the stop fade and the "session complete" line
  // time to finish first — a reload landing on top of them looks like a crash.
  setTimeout(() => {
    if (state !== 'idle') { waitingReg = reg; return; }   // a new session started: wait again
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  }, delayMs);
}

function noteUpdateReady(reg) {
  if (!reg || !reg.waiting) return;
  waitingReg = reg;
  applyUpdateIfSafe();
}

// A controller already exists → an 'installed' worker is an update, not a first install.
// 'redundant' means the install failed: stay quiet, the old worker still serves.
function watchInstalling(reg, sw) {
  sw.addEventListener('statechange', () => {
    if (sw.state === 'installed' && navigator.serviceWorker.controller) noteUpdateReady(reg);
  });
}

if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;    // first worker claiming a fresh page
    // clients.claim() also fires here when ANOTHER window applies the update, and
    // reloading then would destroy a meditation running in this one — including its
    // pre-scheduled end bells. The new worker has taken over either way; nothing further
    // is fetched during a session, so running on a little longer is harmless.
    if (state !== 'idle') { pendingReload = true; return; }
    reloading = true;
    window.location.reload();
  });

  // updateViaCache:'none' → the sw.js script is always revalidated on update checks, so
  // a bumped VERSION is detected promptly even behind GitHub Pages' max-age=600.
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => {
    swReg = reg;
    // A worker may already be waiting from a previous visit, or already installing from
    // the browser's own navigation update check, before any event of ours fires.
    if (reg.waiting && navigator.serviceWorker.controller) noteUpdateReady(reg);
    else if (reg.installing) watchInstalling(reg, reg.installing);

    reg.addEventListener('updatefound', () => {
      if (reg.installing) watchInstalling(reg, reg.installing);
    });

    let lastCheck = 0;
    const check = () => {
      if (Date.now() - lastCheck < 60000) return;   // each check is a network round trip
      lastCheck = Date.now();
      reg.update().catch(() => {});
    };
    check();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    window.addEventListener('online', check);
  }).catch(() => {});

  // Self-heal a mismatched shell (mechanism 2 above), once per browsing session so an
  // inconsistent deploy can never cause a reload loop.
  navigator.serviceWorker.ready.then(async () => {
    const swVersion = await getSwVersion();
    if (!swVersion || swVersion === APP_VERSION) return;
    if (state !== 'idle') return;
    // Record the exact pair we tried. If a deploy really is internally inconsistent,
    // repairing cannot fix it, and retrying every launch would wipe the cache and reload
    // forever. Keying on the pair means a LATER, genuine mismatch is still repaired.
    const pair = `${APP_VERSION}|${swVersion}`;
    try {
      if (localStorage.getItem(DRIFT_KEY) === pair) return;
      localStorage.setItem(DRIFT_KEY, pair);
    } catch {
      return;   // no storage → no loop protection → do not start one
    }
    if (await isReallyOnline()) hardReset();
  }).catch(() => {});
}
