/* app.js — Meditation Timer
   Audio engine (Web Audio API), drift-free timer, Media Session, custom time, PWA.

   The session is random bells only (v26.10.22: the soundtrack mode was removed). Every
   sound is a decoded bell strike on the audio clock.

   Lock-screen reliability:
   All audio events that must fire while the phone is locked — every random-bell strike
   and the triple end bell — are scheduled on the AudioContext hardware clock at session
   start (source.start(when) / gain ramps). The Web Audio clock keeps running while the
   screen is off; requestAnimationFrame and setTimeout do NOT. rAF is therefore used only
   to update the visible countdown and to drive UI cleanup once the screen is visible again. */

'use strict';

const APP_VERSION = 'v26.10.22e';   // format vYY.MM.DD — keep in lockstep with sw.js + index.html

const PAUSE_FADE_OUT = 2;    // user-initiated stop/pause: each sounding bell fades over this

// End-of-session chime: ONE bell (RANDOM_BELLS[CHIME_BELL], the G3 "Bright") struck three
// times. Each strike damps the one before it over CHIME_DAMP and restarts the file from
// its start, so the strikes never pile up. Before v26.10.22 the chime was 'Single bowl sound.mp3',
// three overlapping copies; that recording has a stray tone ~24 s in (a ~474 Hz partial
// that is not one of the bowl's, jumping in by +35 dB), heard as a beep after the bell.
const END_BELL_OFFSETS = [0, 0.4, 0.8];
const CHIME_DAMP = 0.025;    // seconds

// The end bell is the G3 recording (bell-4-g3, 20 s), played as recorded (rate 1). Chosen
// by ear in v26.10.22c from three candidates (C3 28 s, C3 −27¢ 22 s, G3 20 s) that a
// v26.10.22b Settings section offered for trying; that section is gone again. All three
// had been scanned for tones that are not partials of the bell (the old chime's fault).
const CHIME_BELL = 2;

// ── State ────────────────────────────────────────────────────────────────────

const DURATION_KEY = 'meditation-duration';
const FREQ_KEY     = 'meditation-bell-frequency';   // bell frequency level, 0 … 5
const MODE_KEY     = 'meditation-bell-mode';        // bell behavior: 'random' | 'fixed'
// Keys older builds wrote. Never read for state (one is migrated once); Delete app still
// removes them: 'meditation-sound' (the retired Soundtrack / Random switch),
// 'meditation-bells' (the 1 … 3 amount, now level + 1), 'meditation-end-bell' (the
// v26.10.22b end bell choice).
const LEGACY_SOUND_KEY = 'meditation-sound';
const LEGACY_BELLS_KEY = 'meditation-bells';
const LEGACY_END_KEY   = 'meditation-end-bell';

let selectedMinutes   = 15;
let state             = 'idle';   // idle | playing | paused | finishing
let sessionDurationMs = 0;
let elapsedMs         = 0;
let startTimestamp    = null;
let rafId             = null;
let bgFadeTimeout     = null;      // stops the keep-alives once a pause fade has landed
let endHoldTimeout    = null;      // wall-clock backstop for releasing the audio session
let endUiTimeout      = null;      // onSessionEnd's delayed UI reset — tracked so a Stop +
                                   // Begin inside it cannot reset a NEW session to idle
let quietAt           = 0;         // performance.now() by which the last sound (a stop fade,
                                   // the end chime) has finished: updates reload after it

// ── Audio setup ──────────────────────────────────────────────────────────────

let audioCtx    = null;

let scheduledSources = [];         // AudioBufferSourceNodes scheduled ahead on the audio clock
let keepAliveSrc = null;           // silent looping source that keeps the context awake

let silentEl  = null;              // silent looping <audio> — keeps the iOS audio session alive
let silentUrl = null;              // blob: URL for the generated silent clip

function ensureAudio() {
  if (audioCtx) return;

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

  // Pre-decode the bells (the end chime is one of them) so they can be scheduled via the
  // audio clock. AudioBufferSourceNode.start() is driven by the Web Audio engine, so it
  // fires reliably on a locked screen — plain Audio elements do not. A session begun
  // before the decode lands is re-laid by loadRandomBells once it does.
  loadRandomBells();
}

// ── Scheduled sources ────────────────────────────────────────────────────────
//
// Every decoded strike — a random bell or an end bell — is an AudioBufferSourceNode with
// its OWN gain stage (src.__g) and its start time (src.__when). That is what lets every
// stop path fade exactly the sound that is ringing, on its own, and nothing else:
//
//   dropPendingSources()  — stop what has not started yet (silent, so no click), keep
//                           what is sounding (a late-decode resync must not touch it)
//   releaseSources()      — the same, then fade each sounding one over PAUSE_FADE_OUT and
//                           stop it at the end of the fade, on the audio clock
//   clearScheduledSources() — hard stop. Only the X uses it: the context closes anyway.
//
// It used to be one shared fader for everything, which forced the choice between cutting
// a ringing bell (sound switch, Begin during the previous end chime, a late bell decode)
// and letting it swell back up under the next session.

function scheduleBuffer(buffer, when, level, dest, rate = 1) {
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  if (rate !== 1) src.playbackRate.value = rate;
  const g = audioCtx.createGain();
  g.gain.value = level;
  src.connect(g);
  g.connect(dest);
  src.start(when);
  src.__g = g;
  src.__when = when;
  src.onended = () => {
    scheduledSources = scheduledSources.filter(s => s !== src);
    try { g.disconnect(); } catch {}
  };
  scheduledSources.push(src);
  return src;
}

// The end chime's decoded bell, or null while the set is still loading.
function chimeBuffer() {
  return randomBuffers ? randomBuffers[CHIME_BELL] : null;
}

// The triple end bell: the same file struck three times, as recorded (no pitch shift), at
// its loudness-matched level. Every strike after the first damps the one still ringing
// over CHIME_DAMP, landing on 0 exactly as the next one starts, so it is one bell rung
// again — never three copies stacked (and so no headroom stage is needed either).
function scheduleChime(end) {
  if (!audioCtx || !chimeBuffer()) return;
  const level = RANDOM_BELLS[CHIME_BELL].gain;
  let prev = null;
  END_BELL_OFFSETS.forEach(off => {
    const when = end + off;
    if (prev) {
      const g = prev.__g.gain;
      g.setValueAtTime(level, Math.max(prev.__when, when - CHIME_DAMP));
      g.linearRampToValueAtTime(0, when);
      prev.stop(when);
    }
    prev = scheduleBuffer(chimeBuffer(), when, level, audioCtx.destination);
  });
}

function stopSource(s) {
  try { s.onended = null; } catch {}   // stop() fires onended: the end sentinel must not
  try { s.stop(); } catch {}           // release the session because the user paused
  try { s.disconnect(); } catch {}
  try { if (s.__g) s.__g.disconnect(); } catch {}
}

function dropPendingSources() {
  const now = audioCtx ? audioCtx.currentTime : Infinity;
  scheduledSources = scheduledSources.filter(s => {
    if (s.__when > now) { stopSource(s); return false; }
    return true;
  });
}

function releaseSources() {
  dropPendingSources();
  if (audioCtx) {
    const t = audioCtx.currentTime;
    scheduledSources.forEach(s => {
      try {
        const g = s.__g.gain;
        const v = g.value;                 // read before cancelling (see scheduleAudioFrom)
        g.cancelScheduledValues(t);
        g.setValueAtTime(v, t);
        g.exponentialRampToValueAtTime(0.001, t + PAUSE_FADE_OUT);
        s.stop(t + PAUSE_FADE_OUT);        // at −60 dB: inaudible, and on the audio clock
      } catch { stopSource(s); }
    });
  }
  // Forgotten, not stopped: each one's own onended disconnects it once the fade is done.
  scheduledSources = [];
}

function clearScheduledSources() {
  scheduledSources.forEach(stopSource);
  scheduledSources = [];
}

// ── Random bells ─────────────────────────────────────────────────────────────
//
// The session model studied in resources/bells.html (its "Tuned 3" tab), shipped: three
// denoised bell recordings (G3 −27¢ and C4 retired — the palette's two shortest tails),
// loudness-matched, each pitched live across ±3 semitones (strikes under MIN_RING
// dropped), the whole session sampled in one go at start, never the same bell at the same pitch twice in a row, and the ending
// protected — the last bell rings out, a 3 s gap, then the existing triple chime. Every
// strike is an AudioBufferSourceNode scheduled on the audio clock up front, so the whole
// session (including its ending) survives a locked screen exactly like the end bell
// always has.
//
// Measured metadata (resources/sources.md): ring40/ring50 in seconds, gain = loudness
// match from stereo RMS (quietest bell = 1.0). `file` has no extension: '.flac' first,
// '.mp3' (320 kbps twins, same loudness to 0.1 dB) where FLAC cannot be decoded.
// Peaks after `gain` are ≤ 0.50 FS (bell-2 −3.3 dBFS × 0.72), and strikes never overlap
// by construction, so the bells need no headroom stage of their own.

const RANDOM_BELLS = [
  { label: 'C3 −27¢', file: './resources/random/bell-1-c3-flat', ring40: 20.7, ring50: 21.4, gain: 1.00 },
  { label: 'C3',      file: './resources/random/bell-2-c3',      ring40: 28.0, ring50: 28.0, gain: 0.72 },
  { label: 'G3 −1¢',  file: './resources/random/bell-4-g3',      ring40: 18.7, ring50: 19.5, gain: 0.67 },
];
const RANDOM_OFFS    = [-3, -2, -1, 0, 1, 2, 3];   // every bell — the C4's −4…0 retired with it
const RANDOM_GAP     = 3;      // ring-out gap before the triple chime

// playbackRate pitches a strike AND shortens it by the same factor (2^(semi/12)), so the
// top of the window holds the shortest strikes. Anything audible for less than MIN_RING
// seconds (ring40 / rate) reads as a bell that ends early and is never struck during a
// session (v26.10.22b): G3 at +1, +2, +3 (17.7, 16.7, 15.7 s) and C3 −27¢ at +3 (17.4 s).
// 17 strikes remain; the shortest is C3 −27¢ at +2 (18.4 s).
const MIN_RING = 18;

// Bell frequency (on the Meditate page): how long the app waits between strikes, always
// counted from the previous bell's audible ring-out (ring40), so bells never overlap.
// `wait` is the level's nominal wait in seconds: shown in Settings, and in Fixed mode
// (Settings → Bell behavior) it IS the wait, exactly. In Random mode (the default) a wait
// is `floor` + a truncated-exponential draw (mean `mean`), capped so no strike-to-strike
// distance exceeds `maxgap`; floor/mean are tuned so the measured mean silence matches
// `wait` (sampler, 3000 × 15 min: 59.9 / 29.8 / 14.9 / 8.1 / 3.1 s). `minGap` is the
// least the pulled-in final bell may follow the previous ring-out (Random mode's ending
// rule, see sampleRandomPlan). Level 0: no bells, only the end chime. v26.10.22c evened
// the steps out (they were ≈ 80 / 36 / 15 / 6 / 2 s).
const BELL_LEVELS = [
  { id: 0, label: 'No bells' },
  { id: 1, label: 'Very rare bells',     wait: 60, floor: 30, mean: 32,  maxgap: 200, minGap: 15 },
  { id: 2, label: 'Rare bells',          wait: 30, floor: 15, mean: 16,  maxgap: 100, minGap: 8 },
  { id: 3, label: 'Some bells',          wait: 15, floor: 8,  mean: 8,   maxgap: 56,  minGap: 1 },   // the default
  { id: 4, label: 'Frequent bells',      wait: 8,  floor: 4,  mean: 4.3, maxgap: 44,  minGap: 1 },
  { id: 5, label: 'Very frequent bells', wait: 3,  floor: 1,  mean: 2,   maxgap: 36,  minGap: 1 },
];
const DEFAULT_LEVEL = 3;        // 15 s; marked on the slider
let bellLevel = DEFAULT_LEVEL;  // id of the chosen entry; restored from localStorage at init

let bellMode  = 'random';   // Settings → Bell behavior: 'random' | 'fixed'

function currentLevel() {
  return BELL_LEVELS.find(l => l.id === bellLevel) || BELL_LEVELS[DEFAULT_LEVEL];
}

const RANDOM_POOL = [];
RANDOM_BELLS.forEach((b, bi) => {
  RANDOM_OFFS.forEach(semi => {
    const rate = Math.pow(2, semi / 12);
    if (b.ring40 / rate < MIN_RING) return;
    RANDOM_POOL.push({ bi, semi, rate, ring: b.ring40 / rate });
  });
});

let randomBuffers = null;   // decoded AudioBuffers, index-aligned with RANDOM_BELLS
let randomPlan    = null;   // the sampled schedule for the running session: [{t, pool}]
let randomLoading = false;  // a fetch + decode of the set is in flight (init and Begin both
                            // ask; without this each one decoded ~30 MB again)
let randomCodec   = 'flac'; // 'mp3' for the rest of the page's life once FLAC fails to decode

function pickRandomBell(prev, pool = RANDOM_POOL) {
  for (let i = 0; i < 40; i++) {
    const e = pool[Math.floor(Math.random() * pool.length)];
    if (!prev || e.bi !== prev.bi || e.semi !== prev.semi) return e;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// Truncated exponential on [0,b] via inverse CDF — the mass past the cap is re-spread
// smoothly, never piled into a spike at the limit (see resources/sources.md).
function truncExp(rand, a, b, theta) {
  const u = rand();
  const Fb = 1 - Math.exp(-(b - a) / theta);
  return a - theta * Math.log(1 - u * Fb);
}

// Sample the whole session instantly. End rule: nothing may collide with the ending —
// a candidate that cannot ring out before D − GAP is pulled in to just fit; if even that
// fails it is dropped, and the last bell is shifted so its ring ends exactly at D − GAP:
// last bell rings out → little gap → triple chime.
//
// The opening strike obeys the same rule. Every full session (≥ 1 min) fits any bell; a
// late decode re-samples only the REMAINDER, and with too little left a strike at t = 0
// would still be ringing over the chime — so it opens with a bell that fits, or not at all.
//
// `after` (a bell frequency or behavior change mid-session): the strike that is ringing or
// last rang, with `t` relative to now (≤ 0). The plan then continues from it under the new
// setting — no strike at t = 0, nothing before now, and the bell that is ringing is never
// touched.
//
// Fixed mode: every wait is exactly `amt.wait` after the previous ring-out, and nothing is
// pulled in or shifted at the end — a bell that would not ring out before D − GAP is
// simply not struck; the session waits in silence for the triple chime.
function sampleRandomPlan(durSec, amt = currentLevel(), after = null, mode = bellMode) {
  if (!amt.wait) return [];                                   // level 0: no bells
  const deadline = durSec - RANDOM_GAP;
  const evs = [];
  let prev = after;
  if (!prev) {
    const fits = RANDOM_POOL.filter(e => e.ring <= deadline);
    if (!fits.length) return [];
    prev = { t: 0, pool: pickRandomBell(null, fits) };       // a sound right at the start
    evs.push(prev);
  }
  if (mode === 'fixed') {
    for (;;) {
      const cand = { pool: pickRandomBell(prev.pool) };
      cand.t = Math.max(0, prev.t + prev.pool.ring + amt.wait);
      if (cand.t + cand.pool.ring > deadline) return evs;
      evs.push(cand);
      prev = cand;
    }
  }
  for (;;) {
    const cand = { pool: pickRandomBell(prev.pool) };
    const b = Math.max(0.001, amt.maxgap - prev.pool.ring - amt.floor);
    // Never in the past: after a switch to a busier level the new wait may already be over.
    const t = Math.max(0, prev.t + prev.pool.ring + amt.floor + truncExp(Math.random, 0, b, amt.mean));
    if (t + cand.pool.ring <= deadline) { cand.t = t; evs.push(cand); prev = cand; continue; }
    const tFit = deadline - cand.pool.ring;
    if (tFit >= Math.max(0, prev.t + prev.pool.ring + amt.minGap)) { cand.t = tFit; evs.push(cand); }
    break;
  }
  if (evs.length > (after ? 0 : 1)) {
    const last = evs[evs.length - 1];
    const pause = deadline - (last.t + last.pool.ring);
    if (pause > 0.05) last.t += pause;
  }
  return evs;
}

// One strike: the bell's buffer resampled by playbackRate (pitch and decay scale
// together, exactly like the study page), loudness-matched by its own gain stage.
function scheduleRandomHit(when, pool) {
  return scheduleBuffer(randomBuffers[pool.bi], when, RANDOM_BELLS[pool.bi].gain,
                        audioCtx.destination, pool.rate);
}

// FLAC first. WebKit's decodeAudioData hands FLAC to AVFoundation (AudioFileReaderCocoa
// maps it to audio/flac), so iOS 11+ should decode it — but that is not verified on a
// device, and a failure would mean a silent random mode on iPhone. So a DECODE failure
// (not a network one) switches the page to the 320 kbps MP3 twins for good.
async function loadRandomBell(ctx, b, stale) {
  for (;;) {
    const codec = randomCodec;
    const url = b.file + '.' + codec;
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ' ' + r.status);
    // The MP3 twins are not precached (only an engine without FLAC needs them). A fetch
    // made before the worker controls the page bypasses its audio cache, so store them
    // here — otherwise the first offline session on that phone would have no bells.
    if (codec === 'mp3') cacheAudioCopy(url, r.clone());
    const buf = await r.arrayBuffer();
    if (stale()) return null;
    try {
      return await ctx.decodeAudioData(buf);
    } catch (e) {
      if (codec !== 'flac' || stale()) throw e;
      if (randomCodec === 'flac') randomCodec = 'mp3';   // retry this bell as MP3
    }
  }
}

function cacheAudioCopy(url, resp) {
  if (!('caches' in window)) return;
  const key = new Request(new URL(url, location.href).href);
  caches.open(AUDIO_CACHE)
    .then(c => c.match(key).then(hit => hit || c.put(key, resp)))
    .catch(() => {});
}

function loadRandomBells(attempt = 0) {
  if (randomBuffers || randomLoading || !audioCtx) return;
  randomLoading = true;
  // A load belongs to the context that started it. After the close button tears the graph
  // down (audioCtx -> null), a load still in flight must neither decode into a dead context
  // nor keep retrying and re-fill the memory that was just released.
  const ctx = audioCtx;
  const stale = () => closing || ctx !== audioCtx;
  // The first bell is the codec probe; the other two follow in parallel. An engine that
  // cannot decode FLAC therefore fetches one FLAC, not three.
  loadRandomBell(ctx, RANDOM_BELLS[0], stale)
    .then(first => first && Promise.all(
      [first, ...RANDOM_BELLS.slice(1).map(b => loadRandomBell(ctx, b, stale))]))
    .then(buffers => {
      randomLoading = false;
      if (!buffers || stale() || buffers.some(x => !x)) return;
      randomBuffers = buffers;
      // The decode landed after the session began: nothing has rung yet and there is no
      // end chime either, so re-sample the remainder — translated by the elapsed time so a
      // strike lands right now (or on resume, if paused), instead of the session opening
      // in silence until the first full wait of the original plan elapses — and re-lay it.
      if ((state === 'playing' || state === 'paused') && audioCtx && startTimestamp !== null) {
        const elapsed = state === 'playing'
          ? elapsedMs + (performance.now() - startTimestamp) : elapsedMs;
        const remaining = sessionDurationMs - elapsed;
        if (remaining > 0) {
          const shift = elapsed / 1000;
          randomPlan = sampleRandomPlan(remaining / 1000).map(ev => ({ t: ev.t + shift, pool: ev.pool }));
          if (state === 'playing') resyncRunningSession(elapsed);
        }
        setStatus(state === 'paused' ? 'paused' : '');
      }
    })
    .catch(() => {
      randomLoading = false;
      if (stale()) return;
      // Retry quietly first (1 s, 2 s, 4 s): a first visit races the worker's own precache
      // of the same files, and one dropped fetch should not put a message on screen.
      if (attempt < 3) {
        setTimeout(() => { if (!stale()) loadRandomBells(attempt + 1); }, 1000 * Math.pow(2, attempt));
        return;
      }
      // Said in every state: during a session the status line would otherwise keep
      // promising "loading bells…". The next Begin tries again.
      setStatus('Bells unavailable. Connect once to save them.');
    });
}

// Rebuild the running session's schedule in place (a late decode landed). Only what has
// not started is replaced — a bell already ringing keeps ringing (scheduleAudioFrom skips
// plan events in the past, so it is not struck twice). scheduleAudioFrom reads the GLOBAL
// elapsedMs for its origin, so sync it first, then restore the pause/resume bookkeeping.
function resyncRunningSession(elapsed) {
  dropPendingSources();
  const savedElapsed = elapsedMs;
  const savedStart = startTimestamp;
  elapsedMs = elapsed;
  startTimestamp = performance.now();
  scheduleAudioFrom(Math.max(0, sessionDurationMs - elapsed));
  elapsedMs = savedElapsed;
  startTimestamp = savedStart;
}

// Keep-alive between scheduled events while the screen is locked — essential for
// a bells-only session, which has no continuously-playing media element of its own.
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
// exactly the case here (bells only, no looping track). A Web Audio buffer
// is not enough to hold the audio session open on iOS; a real, playing <audio>
// element is. So we generate a tiny WAV carrying the same faint keep-alive tone
// (as a blob: URL, since the CSP allows blob: but not data: for media) and loop it
// for the whole session. This keeps the session — and therefore the
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

function startSilentKeepAlive() {
  ensureSilentEl();
  silentEl.currentTime = 0;
  silentEl.play().catch(() => {});
}

function stopSilentKeepAlive() {
  if (silentEl) silentEl.pause();
}

// ── Audio scheduling ─────────────────────────────────────────────────────────
// Schedules the entire remaining session — the random bells' plan plus the triple end
// bell — on the audio clock, starting from audioCtx.currentTime. Called at session start,
// on every resume, and by a resync (a late decode, a bell frequency change). Because every
// event is placed on the hardware clock, the session ends (and the bells ring) even if
// the screen locks. There are no session fades: the bells ARE the session, and the ending
// is protected by the sampled plan (last bell rings out → 3 s gap → triple chime).

function scheduleAudioFrom(remainingMs) {
  const t0      = audioCtx.currentTime;

  // Never negative: a resume after the session should already have ended, or a clock
  // jump, otherwise makes every scheduled bell fire at once.
  const remSec  = Math.max(0, remainingMs) / 1000;
  const elapsedSec = elapsedMs / 1000;

  // ── Random bells — the whole session's plan, sampled at start ──
  if (randomPlan && randomBuffers) {
    randomPlan.forEach(ev => {
      const when = t0 + (ev.t - elapsedSec);
      if (when < t0 - 0.001) return;              // already rang (resume / resync)
      scheduleRandomHit(Math.max(t0, when), ev.pool);
    });
  }

  // ── Triple end bell ──
  scheduleChime(t0 + remSec);

  // ── End-of-session sentinel ──
  // The visible timer runs on requestAnimationFrame, which is frozen while the screen is
  // off — so onSessionEnd() does not run until the user picks the phone up again, and
  // until then the keep-alives and the whole audio graph stay live, draining the battery
  // for as long as the phone stays in a pocket. This silent
  // source is scheduled on the audio clock like everything else that must survive a
  // locked screen; its onended is the one end-of-session signal that actually fires on
  // time. It also covers the case where the bell failed to load and there is no end bell
  // whose completion we could hang this off.
  scheduleEndSentinel(t0 + remSec + endBellTail());
}

// How long after the nominal end the last end bell is still sounding. The chime bell is
// ~28 s, not a short ding, so a fixed few seconds here would tear the audio session down
// while the final bell was still ringing — which on Android 17 means the foreground
// service goes away and the bell is silently muted mid-strike.
function endBellTail() {
  const last = Math.max(...END_BELL_OFFSETS);
  const dur  = chimeBuffer() ? chimeBuffer().duration : 30;
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
  const at = Math.max(audioCtx.currentTime, when);
  src.start(at);
  src.__g = mute;
  src.__when = at;      // in the future until the session is over: pause/stop drop it
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

  updateCountdown(remainingMs);

  if (remainingMs <= 0) {
    onSessionEnd();
    return;
  }

  rafId = requestAnimationFrame(tick);
}

// ── Session lifecycle ────────────────────────────────────────────────────────

function startSession() {
  if (state !== 'idle') return;

  clearTimeout(endHoldTimeout);      // a pending release from the previous session
  clearTimeout(endUiTimeout);
  clearTimeout(bgFadeTimeout);
  // The previous session's end chime may still be ringing (it lasts ~29 s and the UI comes
  // back after 3.5 s), or a stopped bell may still be fading: fade, never cut.
  releaseSources();
  ensureAudio();
  audioCtx.resume();

  sessionDurationMs = selectedMinutes * 60 * 1000;
  elapsedMs = 0;
  state = 'playing';
  startTimestamp = performance.now();

  audioReleased = false;
  startKeepAlive();
  // The faint <audio> keep-alive: the one real media element, which holds the platform
  // audio session (iOS, Android 17) between strikes. See ensureSilentEl().
  startSilentKeepAlive();

  // Sample the entire session now — every wait, pitch and the protected ending are decided
  // before the first strike rings.
  randomPlan = sampleRandomPlan(sessionDurationMs / 1000);
  if (!randomBuffers) loadRandomBells();

  setMediaSession();
  updateMediaPosition();
  navigator.mediaSession && (navigator.mediaSession.playbackState = 'playing');

  scheduleAudioFrom(sessionDurationMs);

  setPlayBtn('pause');
  // Until the bells have decoded there is no strike and no end chime yet (loadRandomBells
  // re-lays the session when they land, or says that they could not be loaded).
  setStatus(randomBuffers ? '' : 'loading bells…');

  rafId = requestAnimationFrame(tick);
}

function pauseSession() {
  if (state !== 'playing' && state !== 'finishing') return;

  elapsedMs += (performance.now() - startTimestamp);
  cancelAnimationFrame(rafId);
  clearTimeout(bgFadeTimeout);
  clearTimeout(endHoldTimeout);
  // Strikes that have not started are dropped; the one sounding (a random bell, or the end
  // chime if the lock screen pauses during it) fades over 2 s on its own gain. Resume
  // re-lays the rest of the plan; an interrupted bell is not struck again.
  releaseSources();
  bgFadeTimeout = setTimeout(() => {
    if (state === 'paused') {
      stopKeepAlive();
      stopSilentKeepAlive();
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

  navigator.mediaSession && (navigator.mediaSession.playbackState = 'playing');
  state = 'playing';
  startTimestamp = performance.now();

  scheduleAudioFrom(sessionDurationMs - elapsedMs);
  updateMediaPosition();

  setPlayBtn('pause');
  setStatus('');
  rafId = requestAnimationFrame(tick);
}

// Every way out of a running session — Reset, a duration change — comes through here, so
// this is the one place the no-cut rule has to hold for them.
function stopSession() {
  if (state === 'idle') return;

  cancelAnimationFrame(rafId);
  clearTimeout(bgFadeTimeout);
  clearTimeout(endHoldTimeout);
  clearTimeout(endUiTimeout);
  releaseSources();
  stopKeepAlive();
  stopSilentKeepAlive();

  navigator.mediaSession && (navigator.mediaSession.playbackState = 'none');

  resetUI();
  quietAt = performance.now() + PAUSE_FADE_OUT * 1000 + 600;
  applyUpdateIfSafe();               // waits for quietAt: the stop fade finishes first
}

function onSessionEnd() {
  cancelAnimationFrame(rafId);
  state = 'finishing';

  document.body.classList.add('session-complete');

  // The bells and the triple end bell were scheduled on the audio clock back at
  // session start, so they ring on time — even if the screen was locked when the
  // timer ran out. Here we only tidy up the UI and stop the silent playback once
  // the page is visible again.
  if (audioCtx) audioCtx.resume();

  // The end chime rings from the nominal end for endBellTail(); an update must not reload
  // over it. Computed from the session clock, so a late onSessionEnd (screen was off)
  // does not push it out.
  if (startTimestamp !== null) {
    quietAt = startTimestamp + (sessionDurationMs - elapsedMs) + endBellTail() * 1000;
  }

  // Two different clocks, on purpose.
  //
  // The UI comes back quickly — the user should not have to wait out a 28-second bowl
  // before they can start another session. The AUDIO is released separately, once the end
  // bells have actually finished; normally the audio-clock sentinel does that (it is the
  // only thing that fires on time with the screen off), and endHoldTimeout is just the
  // wall-clock backstop for when the sentinel never runs.
  clearTimeout(endUiTimeout);        // tick() can arrive here twice (visibilitychange)
  endUiTimeout = setTimeout(() => {
    resetUI();
    document.body.classList.remove('session-complete');
    setStatus('session complete');
    setTimeout(() => { if (elStatus.textContent === 'session complete') setStatus(''); }, 3000);
    applyUpdateIfSafe(3600);   // a build that landed mid-session applies once the
                               // "session complete" line has been read and the chime is done
  }, 3500);

  clearTimeout(endHoldTimeout);
  endHoldTimeout = setTimeout(releaseAudioHold, endBellTail() * 1000);
}

// ── Close ────────────────────────────────────────────────────────────────────
//
// Same contract as poltergeist.exe's X. A web page cannot terminate its own OS process;
// no browser exposes that, and on Android the system alone decides when to reclaim one.
// What it CAN do is stop holding things, which is what actually matters:
//
//   * no scheduled bells, no keep-alive tone, no silent <audio> loop, no timers
//   * no lock-screen media controls (the notification would otherwise outlive the app)
//   * no open audio output stream: audioCtx.close(), not suspend(), is what hands the
//     device back and drops the partial wakelock
//   * no decoded audio: closing a context does NOT free an AudioBuffer (it lives as long
//     as something references it), so the bells' decoded PCM and the keep-alive blob are
//     released explicitly
//
// Then window.close(). Per spec a script may only close a window it opened, but an
// INSTALLED app window qualifies, so this really closes the app there; in a plain tab it
// silently does nothing, so a "closed" screen explains that instead of a dead button.
let closing = false;
let deleting = false;   // set by deleteApp(): shutdownApp then skips the close() screen

function shutdownApp() {
  closing = true;
  audioReleased = true;           // first: stops the pause-guards restarting playback

  cancelAnimationFrame(rafId);
  clearTimeout(bgFadeTimeout);
  clearTimeout(endHoldTimeout);
  clearTimeout(endUiTimeout);
  // The one deliberate hard stop: the X releases the device NOW, and ctx.close() below
  // silences everything regardless (an installed window is closed outright).
  clearScheduledSources();
  stopKeepAlive();

  if ('mediaSession' in navigator) {
    try {
      ['play', 'pause', 'stop'].forEach(a => navigator.mediaSession.setActionHandler(a, null));
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    } catch {}
  }

  // The keep-alive element: pause AND detach the source, or the browser keeps the stream
  // alive.
  if (silentEl) {
    try { silentEl.pause(); silentEl.removeAttribute('src'); silentEl.load(); } catch {}
  }
  silentEl = null;
  if (silentUrl) { try { URL.revokeObjectURL(silentUrl); } catch {} silentUrl = null; }

  randomBuffers = null;
  randomPlan = null;
  randomLoading = false;   // an in-flight load sees the context change and drops its result

  // close(), not suspend(). Null it too: ensureAudio() rebuilds everything from scratch if
  // the window survives and the app is opened again.
  if (audioCtx) {
    const ctx = audioCtx;
    audioCtx = null;
    try { ctx.onstatechange = null; ctx.close(); } catch {}
  }

  // iOS: give the 'playback' audio-session category back.
  try { if (navigator.audioSession) navigator.audioSession.type = 'auto'; } catch {}

  state = 'idle';
  elapsedMs = 0;
  startTimestamp = null;
  document.body.classList.remove('session-complete');
  setStatus('');
  closeCustomTimeModal();
  closeInstallModal();

  if (deleting) return;   // deleteApp() shows its own screen; the window must stay open

  try { window.close(); } catch {}

  // Still here a moment later? Then close() was refused (a browser tab). Say so.
  setTimeout(() => {
    if (!closing) return;
    elClosedSub.textContent = isStandalone()
      ? 'Swipe the app away to finish.'
      : 'Close this tab to finish.';
    elClosedLayer.classList.remove('hidden');
    document.body.classList.add('modal-open');
    elReopenBtn.focus();
  }, 250);
}

// The window survived and the user wants it back: rebuild the audio graph, reload the bells.
function reopenApp() {
  closing = false;
  elClosedLayer.classList.add('hidden');
  document.body.classList.remove('modal-open');
  resetUI();
  setStatus('');
  ensureAudio();
  applyUpdateIfSafe();
  showTab('meditate');   // land back on the practice screen, not wherever Settings was left
}

// ── Media Session API ────────────────────────────────────────────────────────

function setMediaSession() {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title:  'Meditation Session',
    artist: 'Random bells',
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
  // The notification's stop/close control shuts the app down entirely, the same as the
  // in-app X, so it can be closed from the lock screen without opening it first.
  navigator.mediaSession.setActionHandler('stop',  shutdownApp);
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
  try { localStorage.setItem(DURATION_KEY, String(min)); } catch {}
  renderDurations();
  showIdleCountdown();
}

// ── UI helpers ───────────────────────────────────────────────────────────────

const elCountdown     = document.getElementById('countdown');
const elEnsoArc       = document.getElementById('enso-arc');
const elCloseBtn      = document.getElementById('close-btn');
const elClosedLayer   = document.getElementById('closed-layer');
const elClosedSub     = document.getElementById('closed-sub');
const elReopenBtn     = document.getElementById('reopen-btn');
const elDeletedLayer  = document.getElementById('deleted-layer');
const elDeletedSub    = document.getElementById('deleted-sub');
const elDeletedReopen = document.getElementById('deleted-reopen-btn');
const elDurationLabel = document.getElementById('duration-label');
const elStatus        = document.getElementById('status');
const elPlayBtn       = document.getElementById('btn-play');
const elResetBtn      = document.getElementById('btn-reset');
const elLevelSlider   = document.getElementById('level-slider');
const elLevelTrack    = document.getElementById('level-track');
const elLevelFill     = document.getElementById('level-fill');
const elLevelThumb    = document.getElementById('level-thumb');
const elLevelTicks    = document.getElementById('level-ticks');
const elLevelGlyphs   = document.getElementById('level-glyphs');
const elLevelWait     = document.getElementById('level-wait');
const elLevelTable    = document.getElementById('level-table');
const elLevelLabel    = document.getElementById('level-label');
const elLevelWaitHead = document.getElementById('level-wait-head');
const elModeGroup     = document.getElementById('mode-group');
const elDurationGroup = document.getElementById('duration-group');
const elInstallBtn    = document.getElementById('install-btn');
const elInstallBanner = document.getElementById('install-banner');
const elInstallNote   = document.getElementById('install-note');
const elInstallStatus = document.getElementById('install-status');
const elTabMeditate   = document.getElementById('tab-meditate');
const elTabSettings   = document.getElementById('tab-settings');
const elPanelMeditate = document.getElementById('panel-meditate');
const elPanelSettings = document.getElementById('panel-settings');
const elUpdateBtn     = document.getElementById('update-btn');
const elDeleteBtn     = document.getElementById('delete-btn');
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
  renderClock(text);
  // The ring advances on the same once-a-second beat; its CSS transition is exactly one
  // second long, so the steps join up into one continuous stroke.
  if (sessionDurationMs > 0) setEnsoProgress(1 - ms / sessionDurationMs);
}

// Each character in its own fixed-width cell. The Mincho face has proportional digits,
// so plain text made the whole clock shuffle sideways every second.
function renderClock(text) {
  const frag = document.createDocumentFragment();
  for (const ch of text) {
    const span = document.createElement('span');
    span.className = ch === ':' ? 'c' : 'd';
    span.textContent = ch;
    frag.appendChild(span);
  }
  elCountdown.replaceChildren(frag);
}

// The ensō shows the time that remains. The mask circle starts just behind the brush's
// first touch, and as the session elapses the ink fades from that end, following the
// stroke, so the dry-brush tail is the last of it to go. The stroke only spans ~94 of the
// mask's 100 units (the rest is the open gap), hence the scale. Starting a session
// therefore changes nothing on screen; the circle simply begins to go. null = whole.
function setEnsoProgress(fraction) {
  if (!elEnsoArc) return;
  const f = fraction === null ? 0 : Math.min(1, Math.max(0, fraction));
  elEnsoArc.style.strokeDashoffset = (-94 * f).toFixed(2);
}

function showIdleCountdown() {
  const m = String(Math.floor(selectedMinutes)).padStart(2, '0');
  lastCountdownText = `${m}:00`;
  renderClock(lastCountdownText);
  elDurationLabel.textContent = `${selectedMinutes} min`;
  setEnsoProgress(null);
}

function setStatus(msg) {
  elStatus.textContent = msg;
}

// The body carries the run state for CSS: .running breathes the ensō, .paused holds it.
function setRunClass(mode) {
  document.body.classList.toggle('running', mode === 'pause');
  document.body.classList.toggle('paused',  mode === 'resume');
}

function setPlayBtn(mode) {
  setRunClass(mode);
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

// ── Bell frequency (Meditate page) ───────────────────────────────────────────
// A slider with six points (v26.10.22d, chosen from the prototype in resources/bells.html;
// it replaced six buttons): none, then one to five bells — more bells = a shorter wait
// between strikes. While dragging, the thumb follows the finger and the readout (bells,
// popping as a level is passed, and the wait) previews the nearest level; on release the
// thumb glides to that point and the level is committed. Only the commit touches the
// session: a running session re-samples what is still to come (setBellLevel), and the
// bell that is ringing is never touched. Tapping the track jumps to the nearest point;
// arrow keys / Home / End step through them.

const BELL_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6a1.2 1.2 0 0 1 1.2 1.2v.5a6.3 6.3 0 0 1 5 6.2v3.7l1.8 2.7c.4.7 0 1.5-.8 1.5H4.8c-.8 0-1.2-.8-.8-1.5L5.8 14v-3.5a6.3 6.3 0 0 1 5-6.2v-.5A1.2 1.2 0 0 1 12 2.6z"/><circle cx="12" cy="20.2" r="1.9"/></svg>';
const NONE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

const LEVEL_LAST = BELL_LEVELS.length - 1;
let levelShown  = -1;      // the level the readout shows (previews the drag; -1 = not yet)
let levelDrag   = false;   // a finger / mouse is dragging the thumb

// The words follow Settings → Bell behavior: "Random bell frequency" / "Average wait"
// in Random mode, "Bell frequency" / "Wait" in Fixed mode.
function levelWaitText(id) {
  const l = BELL_LEVELS[id];
  if (!l.wait) return 'No bells, only the end bell';
  return (bellMode === 'fixed' ? 'Wait ' : 'Average wait ') + l.wait + ' s';
}

// Stops on the track and their light-gray wait labels, once; then the pointer and key
// handlers. A thin vertical line through the default point (DEFAULT_LEVEL, 15 s) marks
// it; it sits under that point's dot and the thumb.
function buildLevelSlider() {
  const mark = document.createElement('span');
  mark.className = 'freq-default';
  mark.style.left = (DEFAULT_LEVEL / LEVEL_LAST * 100) + '%';
  mark.title = 'Default';
  elLevelTrack.appendChild(mark);
  BELL_LEVELS.forEach((l, i) => {
    const dot = document.createElement('span');
    dot.className = 'freq-stop';
    dot.style.left = (i / LEVEL_LAST * 100) + '%';
    elLevelTrack.appendChild(dot);
    const tick = document.createElement('span');
    tick.style.left = (i / LEVEL_LAST * 100) + '%';
    tick.innerHTML = l.wait ? `${l.wait} s` : '&#x2715;';
    elLevelTicks.appendChild(tick);
  });

  // Pointer x → slider position in level units (0 … LEVEL_LAST), continuous.
  const toPos = x => {
    const r = elLevelTrack.getBoundingClientRect();
    return Math.max(0, Math.min(LEVEL_LAST, (x - r.left) / r.width * LEVEL_LAST));
  };
  let moved = false, x0 = 0, pos = 0;
  elLevelSlider.addEventListener('pointerdown', e => {
    if (!e.isPrimary) return;
    levelDrag = true; moved = false; x0 = e.clientX; pos = bellLevel;
    try { elLevelSlider.setPointerCapture(e.pointerId); } catch {}
  });
  elLevelSlider.addEventListener('pointermove', e => {
    if (!levelDrag) return;
    if (!moved && Math.abs(e.clientX - x0) < 4) return;
    moved = true;
    pos = toPos(e.clientX);
    placeLevelThumb(pos, false);
    showLevel(Math.round(pos));
  });
  const release = (e, commit) => {
    if (!levelDrag) return;
    levelDrag = false;
    // A tap jumps to the nearest point, a drag glides to where it was let go; a cancelled
    // gesture (the OS took the pointer) goes back to the committed level.
    const target = !commit ? bellLevel : Math.round(moved ? pos : toPos(e.clientX));
    if (target === bellLevel) renderLevels(true);
    else setBellLevel(target);
  };
  elLevelSlider.addEventListener('pointerup', e => release(e, true));
  elLevelSlider.addEventListener('pointercancel', e => release(e, false));
  elLevelSlider.addEventListener('keydown', e => {
    const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
    let t = null;
    if (step) t = Math.max(0, Math.min(LEVEL_LAST, bellLevel + step));
    if (e.key === 'Home') t = 0;
    if (e.key === 'End') t = LEVEL_LAST;
    if (t === null) return;
    e.preventDefault();
    e.stopPropagation();    // never also a tab switch
    setBellLevel(t);
  });
}

function placeLevelThumb(p, animate) {
  elLevelSlider.classList.toggle('anim', !!animate);
  const f = p / LEVEL_LAST;
  elLevelThumb.style.left = `calc(12px + (100% - 24px) * ${f})`;
  elLevelFill.style.width = (f * 100) + '%';
}

// The readout, the lit points and ticks, and the a11y value for one level. Pops the bells
// when the level shown changes (not on the first paint).
function showLevel(id) {
  const changed = levelShown !== -1 && id !== levelShown;
  levelShown = id;
  elLevelGlyphs.innerHTML = id ? BELL_SVG.repeat(id) : NONE_SVG;
  elLevelWait.textContent = levelWaitText(id);
  [...elLevelTrack.querySelectorAll('.freq-stop')].forEach((d, i) => d.classList.toggle('on', i <= id));
  [...elLevelTicks.children].forEach((t, i) => t.classList.toggle('on', i === id));
  elLevelSlider.setAttribute('aria-valuenow', String(id));
  elLevelSlider.setAttribute('aria-valuetext', levelWaitText(id));
  if (changed) {                                // restart the pop animation
    elLevelGlyphs.classList.remove('pop');
    void elLevelGlyphs.offsetWidth;
    elLevelGlyphs.classList.add('pop');
  }
}

function renderLevels(animate = false) {
  elLevelLabel.textContent = bellMode === 'fixed' ? 'Bell frequency' : 'Random bell frequency';
  showLevel(bellLevel);
  if (!levelDrag) placeLevelThumb(bellLevel, animate);
}

function setBellLevel(id) {
  if (id === bellLevel) return;
  bellLevel = id;
  try { localStorage.setItem(FREQ_KEY, String(id)); } catch {}
  renderLevels(true);
  if (state === 'playing' || state === 'paused') resampleRunningPlan();
}

// Re-sample the rest of a running (or paused) session under the new level. Strikes that
// already rang stay in the plan (scheduleAudioFrom skips them); the new part continues
// from the last one, so a bell that is ringing rings out in full and the next one keeps
// the new level's wait after it. The ending rule still holds (sampleRandomPlan).
function resampleRunningPlan() {
  if (!randomPlan || startTimestamp === null) return;
  const elapsed = state === 'playing'
    ? elapsedMs + (performance.now() - startTimestamp) : elapsedMs;
  const now = elapsed / 1000;
  const remaining = sessionDurationMs / 1000 - now;
  if (remaining <= 0) return;
  const past = randomPlan.filter(ev => ev.t <= now);
  const last = past[past.length - 1];
  const after = last ? { t: last.t - now, pool: last.pool } : null;
  const next = sampleRandomPlan(remaining, currentLevel(), after)
    .map(ev => ({ t: ev.t + now, pool: ev.pool }));
  randomPlan = past.concat(next);
  if (state === 'playing' && randomBuffers) resyncRunningSession(elapsed);
}

// Settings explains the levels in words: one row per level, its glyphs and its wait.
function renderLevelTable() {
  elLevelWaitHead.textContent = bellMode === 'fixed' ? 'Wait time' : 'Average wait time';
  elLevelTable.innerHTML = '';
  BELL_LEVELS.forEach(l => {
    const tr = document.createElement('tr');
    const glyphs = document.createElement('td');
    glyphs.className = 'freq-glyphs';
    glyphs.innerHTML = l.id ? BELL_SVG.repeat(l.id) : NONE_SVG;
    glyphs.setAttribute('aria-label', l.label);
    const text = document.createElement('td');
    text.textContent = l.wait ? `${l.wait} s` + (l.id === 3 ? ' (default)' : '') : 'No bells, only the end bell';
    tr.append(glyphs, text);
    elLevelTable.appendChild(tr);
  });
}

// ── Bell behavior (Settings) ─────────────────────────────────────────────────
// Random (default): waits drawn around the level's average. Fixed: exactly the level's
// wait every time. Either way the bell and its pitch are random, and a change applies at
// once, like a frequency change (the ringing bell is never touched).

const BELL_MODES = [
  { id: 'random', label: 'Random' },
  { id: 'fixed',  label: 'Fixed' },
];

function renderModes() {
  elModeGroup.innerHTML = '';
  BELL_MODES.forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'btn' + (m.id === bellMode ? ' selected' : '');
    btn.type = 'button';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', m.id === bellMode ? 'true' : 'false');
    btn.textContent = m.label;
    btn.addEventListener('click', () => setBellMode(m.id));
    elModeGroup.appendChild(btn);
  });
}

function setBellMode(id) {
  if (id === bellMode) return;
  bellMode = id;
  try { localStorage.setItem(MODE_KEY, id); } catch {}
  renderModes();
  renderLevels();
  renderLevelTable();
  if (state === 'playing' || state === 'paused') resampleRunningPlan();
}

// ── Duration buttons ─────────────────────────────────────────────────────────

const PRESETS = [5, 10, 15, 20, 25];

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
  setSelectedDuration(val);   // also remembers it as the last-used duration
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
  if (closing) return;
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

// ── Tabs ─────────────────────────────────────────────────────────────────────
// Meditate (the whole practice screen) and Settings (the manual, bells amount, app).
// A session already running keeps running while Settings is open — nothing here touches
// state — so checking on an update mid-session is harmless.
//
// The two pages sit side by side on a track and one CSS variable, --p on .app (0 =
// Meditate, 1 = Settings), positions both the track and the tab highlight. A tab tap sets
// it (CSS eases it); a swipe sets it continuously while the finger is down and lets go to
// the nearest page on release. The page that is not showing is `inert`.

const elApp   = document.querySelector('.app');
const elPager = document.getElementById('pager');
let currentTab = 0;

const TABS = [
  { name: 'meditate', tab: () => elTabMeditate, panel: () => elPanelMeditate },
  { name: 'settings', tab: () => elTabSettings, panel: () => elPanelSettings },
];

function showTab(name) {
  const idx = Math.max(0, TABS.findIndex(t => t.name === name));
  const changed = idx !== currentTab;
  currentTab = idx;
  TABS.forEach((t, i) => {
    const on = i === idx;
    t.tab().setAttribute('aria-selected', on ? 'true' : 'false');
    t.panel().inert = !on;
    if (on && changed) t.panel().scrollTop = 0;   // arrive at the top of the page
  });
  elApp.style.setProperty('--p', String(idx));
}

TABS.forEach((t, i) => {
  t.tab().addEventListener('click', () => showTab(t.name));
  // Arrow keys move between tabs, like any tablist.
  t.tab().addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const j = Math.max(0, Math.min(TABS.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
    showTab(TABS[j].name);
    TABS[j].tab().focus();
    e.preventDefault();
  });
});

// Swipe between the pages. Touch and pen only (a mouse drag would fight text selection);
// vertical movement is left to the page's own scrolling — `touch-action: pan-y` in the
// CSS means the browser never claims a horizontal gesture. Past a quarter of the width,
// or a quick flick, it commits to the neighbour; otherwise it springs back.
(function enableSwipe() {
  const COMMIT = 0.25;      // fraction of the page width
  const FLICK  = 0.35;      // px per ms
  let id = null, mode = 'idle';   // idle | pending | drag
  let x0 = 0, y0 = 0, lastX = 0, lastT = 0, vx = 0, width = 1, dx = 0, swallow = false;

  const finish = commit => {
    elApp.classList.remove('dragging');
    let target = currentTab;
    if (commit && (Math.abs(dx) > width * COMMIT || Math.abs(vx) > FLICK)) {
      const dir = Math.abs(vx) > FLICK ? (vx < 0 ? 1 : -1) : (dx < 0 ? 1 : -1);
      target = currentTab + dir;
    }
    showTab(TABS[Math.max(0, Math.min(TABS.length - 1, target))].name);
  };

  elPager.addEventListener('pointerdown', e => {
    if (closing || !e.isPrimary || e.pointerType === 'mouse') return;
    if (e.target.closest && e.target.closest('#level-slider')) return;   // the slider's own drag
    id = e.pointerId; mode = 'pending';
    x0 = lastX = e.clientX; y0 = e.clientY; lastT = e.timeStamp;
    vx = 0; dx = 0; width = elPager.clientWidth || 1;
  });

  elPager.addEventListener('pointermove', e => {
    if (e.pointerId !== id || mode === 'idle') return;
    dx = e.clientX - x0;
    const dy = e.clientY - y0;
    if (mode === 'pending') {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { mode = 'idle'; return; }   // a scroll
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      mode = 'drag';
      try { elPager.setPointerCapture(id); } catch {}
      elApp.classList.add('dragging');
    }
    const dt = e.timeStamp - lastT;
    if (dt > 0) vx = 0.7 * vx + 0.3 * ((e.clientX - lastX) / dt);
    lastX = e.clientX; lastT = e.timeStamp;
    // Dragging left (dx < 0) moves toward Settings. Past either end it resists.
    const last = TABS.length - 1;
    let p = currentTab - dx / width;
    if (p < 0) p = p / 3; else if (p > last) p = last + (p - last) / 3;
    elApp.style.setProperty('--p', p.toFixed(4));
  });

  const end = (e, commit) => {
    if (e.pointerId !== id) return;
    const wasDrag = mode === 'drag';
    id = null; mode = 'idle';
    if (!wasDrag) return;
    swallow = true;                      // the lift after a drag must not tap a button
    setTimeout(() => { swallow = false; }, 60);
    finish(commit);
  };
  elPager.addEventListener('pointerup', e => end(e, true));
  elPager.addEventListener('pointercancel', e => end(e, false));
  elPager.addEventListener('click', e => {
    if (swallow) { e.stopPropagation(); e.preventDefault(); }
  }, true);
})();

// ── Play button handler ──────────────────────────────────────────────────────

elPlayBtn.addEventListener('click', () => {
  if (state === 'idle')          startSession();
  else if (state === 'playing')  pauseSession();
  else if (state === 'paused')   resumeSession();
});

elResetBtn.addEventListener('click', () => {
  stopSession();
});

elCloseBtn.addEventListener('click', shutdownApp);
elReopenBtn.addEventListener('click', reopenApp);

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
  navigator.brave.isBrave().then(v => { isBrave = !!v; renderInstallAdvice(); }).catch(() => {});
}

// ── Which browser can install this properly? ─────────────────────────────────
//
// Shared by poltergeist.exe, the meditation timer and the Pig Game (same rules, own copy
// in each app so each stays self-contained and offline):
//  * Android: only Chrome (with Google services) and Samsung Internet (on Samsung phones)
//    mint a WebAPK, a real installed app with offline storage of its own. Brave, Firefox,
//    Edge, Opera and in-app browsers only add a shortcut that opens the site in them.
//  * iPhone: since iOS 16.4 Safari, Chrome, Edge and Firefox can all Add to Home Screen,
//    so only in-app browsers (Instagram, WhatsApp, ...) and older iOS need Safari.
// Returns { text, wrong }: `wrong` = this browser cannot install it, say so up front.
function installAdvice() {
  if (isStandalone()) return { text: '', wrong: false };
  const ua = navigator.userAgent || '';
  const inApp = /FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|musical_ly|WhatsApp|GSA\/|; wv\)/i.test(ua);
  if (/android/i.test(ua)) {
    if (/SamsungBrowser/i.test(ua) && !inApp) {
      return { text: '✓ Samsung Internet can install it. Tap Install.', wrong: false };
    }
    const chrome = /Chrome\/\d/.test(ua) && !inApp && !isBrave &&
      !/EdgA|OPR\/|Opera|Firefox|YaBrowser|Vivaldi|DuckDuckGo|UCBrowser|MiuiBrowser|HuaweiBrowser/i.test(ua);
    return chrome
      ? { text: '✓ You are in Chrome. Tap Install.', wrong: false }
      : { text: '📲 This browser cannot. Open the page in Chrome.', wrong: true };
  }
  if (isIOS()) {
    const m = ua.match(/OS (\d+)_(\d+)/);
    const ver = m ? parseInt(m[1], 10) + parseInt(m[2], 10) / 100 : 99;   // iPadOS reports as Mac
    const safari = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) && !inApp;
    if (inApp || (!safari && ver < 16.04)) {
      return { text: '📲 This browser cannot. Open the page in Safari.', wrong: true };
    }
    return { text: 'Tap Share, then Add to Home Screen.', wrong: false };
  }
  return { text: '', wrong: false };   // desktop: the Install button covers it
}

// The one line every phone visitor to Settings reads: the browser requirement first, then
// what THIS browser needs to do (installAdvice). Settings always shows it on Android and
// iOS, wrong browser or right, since that is where install lives. The Meditate tab shows
// the advice alone, and only when this browser cannot install the app at all — the one
// case worth interrupting a session-in-progress screen for. On desktop the plain Install
// button needs no note, and inside the installed app there is nothing left to install.
const INSTALL_REQUIREMENT = 'For offline use, install with Chrome on Android or Safari on iOS.';

function renderInstallAdvice() {
  const { text, wrong } = installAdvice();
  if (elInstallNote) {
    const mobile = isIOS() || /android/i.test(navigator.userAgent || '');
    const show = mobile && !isStandalone();
    elInstallNote.hidden = !show;
    if (show) elInstallNote.textContent = text ? `${INSTALL_REQUIREMENT} ${text}` : INSTALL_REQUIREMENT;
  }
  if (elInstallBanner) { elInstallBanner.textContent = wrong ? text : ''; elInstallBanner.hidden = !wrong; }
}

const INSTALLED_KEY = 'meditation-installed';

function wasInstalled() {
  try { return localStorage.getItem(INSTALLED_KEY) === '1'; } catch { return false; }
}

// Install and offline are ONE thing here: an installed copy is only worth having if it
// works without a connection. The worker precaches the shell and the bells (~4 MB) on its
// own, best-effort; the one button re-fetches any bell that precache missed — installing
// also saves them, and inside the installed app it finishes the save.
let audioSaved  = false;   // every bell is in our audio cache (see refreshOfflineState)
let offlineBusy = false;   // a save is running; it owns the status line until it ends

function refreshInstallUI() {
  renderInstallAdvice();
  if (offlineBusy) return;
  if (isStandalone()) {
    // Definitive: we ARE the installed app.
    if (audioSaved) {
      elInstallBtn.textContent = '✓ Installed';
      elInstallBtn.disabled = true;
      elInstallStatus.textContent = 'Works offline.';
    } else {
      elInstallBtn.textContent = 'Save for offline · 4 MB';
      elInstallBtn.disabled = false;
      elInstallStatus.textContent = 'Save the bells to use it offline.';
    }
    return;
  }
  // isStandalone() is only true inside the installed app, so the ordinary tab the user
  // installed FROM used to keep offering to install something they already had. The
  // remembered appinstalled flag fixes the label — but deliberately does NOT disable the
  // button. A remembered flag can outlive the install (uninstalled, app data cleared,
  // second device), and a permanently dead Install button is precisely the "install
  // doesn't work" symptom this pass exists to remove.
  elInstallBtn.textContent = wasInstalled() ? '✓ Installed · install again' : 'Install app';
  elInstallBtn.disabled = false;
  elInstallStatus.textContent = (wasInstalled()
    ? 'Installed. This is the browser copy.'
    : 'Install it to open it like an app.')
    + (audioSaved ? ' Works offline.' : ' Also saves the bells for offline use.');
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

elInstallBtn.addEventListener('click', () => {
  // Inside the installed app the button only finishes the offline save.
  if (isStandalone()) { if (!audioSaved && !offlineBusy) saveOffline(); return; }
  // In the browser, install and offline are one action. The save runs on its own (it owns
  // the status line); the install flow below is unaffected by it.
  if (!audioSaved && !offlineBusy) saveOffline();
  // Brave DOES fire beforeinstallprompt (it is Chromium) but only ever produces a
  // home-screen shortcut. Going straight to the native dialog would silently hand the
  // user the worse outcome with no explanation, so on Brave show the sheet first.
  if (deferredInstallPrompt && !isBrave) { firePrompt(); return; }
  openInstallModal();          // iOS, Brave, or no live prompt
});

function installSteps() {
  // Since iOS 16.4 Chrome, Edge and Firefox can Add to Home Screen too, so "open Safari"
  // is only a step where installAdvice() says this browser cannot (in-app, older iOS).
  const wrong = installAdvice().wrong;
  if (isIOS()) {
    return [
      ...(wrong ? ['Open this page in Safari first.'] : []),
      'Tap the Share button (the square with an arrow).',
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
      ...(wrong ? ['This browser only adds a shortcut. Open this page in Chrome first.'] : []),
      'Open the browser menu (⋮, top-right).',
      'Tap "Install app" or "Add to Home screen".',
      'Confirm. It installs and opens on its own.',
    ];
  }
  return [
    'Click the install icon in the address bar (⊕ / a small screen icon).',
    'Or open the browser menu and choose "Install Meditation Timer".',
    'Confirm.',
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
    elUpdateBtn.textContent = 'Check for updates';
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
    if (document.visibilityState !== 'hidden') flashUpdateMsg('Update stalled, retry');
  }, 8000);
}

// A worker is still downloading. Hand over as soon as it finishes installing.
function awaitInstallThenHandOver(reg) {
  const sw = reg.installing;
  elUpdateBtn.textContent = 'Downloading…';
  sw.addEventListener('statechange', () => {
    if (sw.state === 'installed' && reg.waiting && state === 'idle') handOverToWaitingWorker(reg);
    else if (sw.state === 'redundant') flashUpdateMsg('Update failed, retry');
  });
  setTimeout(() => {
    if (elUpdateBtn.textContent === 'Downloading…') flashUpdateMsg('Still downloading…');
  }, 15000);
}

// Last resort: rebuild this app's shell from the network. Scoped three ways so it can
// only ever cost what it has to —
//   * this app's caches only (caches.keys() is per-origin, several apps share it),
//   * never the audio cache (the bells: re-fetching them offline is impossible),
//   * never before a second connectivity check, because the window between deleting the
//     shell and re-fetching it is the one moment the app has no offline copy at all.
async function hardReset() {
  if (!await isReallyOnline()) {           // re-check: the first probe may be seconds old
    flashUpdateMsg('Offline, kept cache');
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
      flashUpdateMsg('Offline, cached ✓');
      return;
    }

    const reg = swReg || ('serviceWorker' in navigator
      ? await navigator.serviceWorker.getRegistration()
      : null);

    // Applying an update reloads the page. Never do that during a meditation — remember
    // it and let the session end apply it.
    if (state !== 'idle' && reg && (reg.waiting || reg.installing)) {
      waitingReg = reg;
      flashUpdateMsg('Ready after this session');
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
        flashUpdateMsg('Ready after this session');
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
    flashUpdateMsg('Check failed, retry');
  } finally {
    updateBusy = false;
  }
}

elUpdateBtn.addEventListener('click', runUpdate);
elVersion.addEventListener('click', runUpdate);   // tappable version checks for updates

// ── Offline audio download ───────────────────────────────────────────────────

const AUDIO_CACHED_KEY = 'meditation-audio-cached';
const AUDIO_CACHE = CACHE_PREFIX + 'audio';   // must match sw.js — unversioned on purpose

// The bells (the end chime is one of them) are the only audio. Never walk EVERY cache on
// the origin looking for audio: SoundAnnoyer lives on the same origin and caches twelve
// .mp3s, which once made this report "saved" for files never fetched. Check the actual
// files, in our own audio cache, and require ALL of them. (The 44 MB soundtrack this
// used to check is gone since v26.10.22; sw.js evicts it.)
const OFFLINE_AUDIO = () => RANDOM_BELLS.map(b => b.file + '.' + randomCodec);

async function isAudioCached() {
  if (!('caches' in window)) return false;
  try {
    const cache = await caches.open(AUDIO_CACHE);
    for (const url of OFFLINE_AUDIO()) {
      const hit = await cache.match(new Request(new URL(url, location.href).href));
      if (!hit) return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Trust the cache, not the flag: a flag left over from a wiped cache would claim a
// set of bells that is no longer there.
async function refreshOfflineState() {
  audioSaved = await isAudioCached();
  try {
    if (audioSaved) localStorage.setItem(AUDIO_CACHED_KEY, '1');
    else localStorage.removeItem(AUDIO_CACHED_KEY);
  } catch {}
  refreshInstallUI();
}

// Fetch every bell so the app works without a connection. The shell and the FLAC bells are
// precached best-effort by the SW; this re-fetches any bell a flaky install missed (cached
// ones are instant), and the MP3 twins on an engine that fell back to them.
async function saveOffline() {
  offlineBusy = true;
  if (isStandalone()) elInstallBtn.disabled = true;   // in the browser it stays tappable: install
  const urls = OFFLINE_AUDIO();
  try {
    for (let i = 0; i < urls.length; i++) {
      elInstallStatus.textContent = `Saving for offline… ${i + 1} of ${urls.length}`;
      const resp = await fetch(new Request(urls[i]));   // no Range header → sw.js caches the full 200
      if (!resp.ok) throw new Error('fetch failed');
      await resp.arrayBuffer();
    }
    // Trust the cache, not the fetch — but give the worker time to finish writing. The
    // cache.put runs under event.waitUntil in sw.js and can still be in flight when the
    // page's fetch resolves, so checking immediately could report failure after a download
    // that had actually succeeded.
    elInstallStatus.textContent = 'Finishing…';
    let stored = false;
    for (let i = 0; i < 30 && !stored; i++) {          // up to ~30 s
      stored = await isAudioCached();
      if (!stored) await new Promise(r => setTimeout(r, 1000));
    }
    if (!stored) throw new Error('not stored');
    offlineBusy = false;
    await refreshOfflineState();
  } catch {
    offlineBusy = false;
    refreshInstallUI();
    elInstallStatus.textContent = 'Could not save. Check your connection and try again.';
  }
}

// ── Delete app ───────────────────────────────────────────────────────────────
//
// Removes everything this app put on the device: its service-worker registration, its
// Cache Storage (the shell and the precached bells), its
// localStorage keys and, best-effort, any IndexedDB it created.
//
// Two rules, both load-bearing:
//   * Cache Storage, localStorage, sessionStorage and IndexedDB are scoped to the
//     ORIGIN, not the path, and this origin hosts several apps. `localStorage.clear()`
//     or an unfiltered `caches.keys()` sweep would erase poltergeist.exe and the Pig
//     Game along with this app. Every step below is prefix-scoped.
//   * A web page CANNOT uninstall its own PWA. There is no API, and the home-screen
//     icon is the OS's to remove. What this does guarantee is that every byte the app
//     stored is gone and its worker is unregistered, so the icon becomes an empty shell
//     that reinstalls from scratch the next time the page is opened.
//
// The browser's HTTP cache is unreachable from script (Clear-Site-Data needs a response
// header, which a static GitHub Pages host cannot send). It is small and self-expiring.
const APP_SCOPE = new URL('./', location.href).pathname;   // '/meditation-timer/'
const DELETE_KEYS = [CUSTOM_KEY, INSTALLED_KEY, DRIFT_KEY, AUDIO_CACHED_KEY, DURATION_KEY, FREQ_KEY, MODE_KEY,
                     LEGACY_SOUND_KEY, LEGACY_BELLS_KEY, LEGACY_END_KEY];

async function usedBytes() {
  try { return navigator.storage && navigator.storage.estimate ? ((await navigator.storage.estimate()).usage || 0) : 0; }
  catch { return 0; }
}

// No app here uses IndexedDB today; this keeps the wipe honest if one ever does.
async function dropIndexedDB() {
  if (!('indexedDB' in window) || !indexedDB.databases) return;
  try {
    for (const db of await indexedDB.databases()) {
      if (db.name && (db.name.startsWith('meditation-timer') || db.name.startsWith('meditation'))) {
        indexedDB.deleteDatabase(db.name);
      }
    }
  } catch {}
}

async function deleteApp() {
  if (!confirm('Delete the app and its saved data from this device?')) return;

  elDeleteBtn.disabled = true;

  // Release every audio resource and stop all timers first (the same teardown the X
  // does), but keep the window so this screen can be shown.
  deleting = true;
  shutdownApp();

  const before = await usedBytes();

  // 1. This app's worker only. The scope filter is what protects the other apps' workers.
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs
      .filter(r => new URL(r.scope).pathname.startsWith(APP_SCOPE))
      .map(r => r.unregister()));
  } catch {}

  // 2. Cache Storage: only the caches this app created.
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX)).map(k => caches.delete(k)));
  } catch {}

  // 3. localStorage: explicit keys only, never clear().
  DELETE_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch {} });
  try {
    Object.keys(sessionStorage).filter(k => k.startsWith('meditation'))
      .forEach(k => sessionStorage.removeItem(k));
  } catch {}
  await dropIndexedDB();

  const freed = Math.max(0, before - await usedBytes());
  const mb = freed >= 1e9 ? (freed / 1e9).toFixed(1) + ' GB' : Math.round(freed / 1e6) + ' MB';

  // Never reload: that would re-fetch the shell and re-register the worker.
  elDeletedSub.textContent = (freed > 100000 ? `${mb} freed. ` : '')
    + 'Remove the icon from your home screen too.';
  elDeletedLayer.classList.remove('hidden');
  document.body.classList.add('modal-open');
  elDeletedReopen.focus();
}

elDeleteBtn.addEventListener('click', () => {
  deleteApp().catch(err => {
    console.error('Delete app failed:', err);
    elDeleteBtn.disabled = false;
  });
});

elDeletedReopen.addEventListener('click', () => location.reload());

// ── Init ─────────────────────────────────────────────────────────────────────

elVersion.textContent = APP_VERSION;
// Coming back to the app shows the last settings used — the duration and bell frequency.
try {
  const savedMin = parseInt(localStorage.getItem(DURATION_KEY), 10);
  if (savedMin >= 1 && savedMin <= 180) selectedMinutes = savedMin;
} catch {}
try {
  let saved = localStorage.getItem(FREQ_KEY);
  // Once: carry over the old Settings amount (1 … 3 = today's levels 2 … 4).
  const old = parseInt(localStorage.getItem(LEGACY_BELLS_KEY), 10);
  if (saved === null && old >= 1 && old <= 3) {
    saved = String(old + 1);
    localStorage.setItem(FREQ_KEY, saved);
  }
  localStorage.removeItem(LEGACY_BELLS_KEY);
  localStorage.removeItem(LEGACY_SOUND_KEY);
  const level = parseInt(saved, 10);
  if (BELL_LEVELS.some(l => l.id === level)) bellLevel = level;
} catch {}
try {
  if (localStorage.getItem(MODE_KEY) === 'fixed') bellMode = 'fixed';
  localStorage.removeItem(LEGACY_END_KEY);
} catch {}
renderModes();
buildLevelSlider();
renderLevels();
renderLevelTable();
renderDurations();
showIdleCountdown();
refreshOfflineState();
refreshInstallUI();

// Build the audio graph and start decoding the bells NOW rather than at session start, so
// Begin strikes at once instead of opening on "loading bells…" — and a failed download is
// surfaced while the user is still looking at the screen.
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

let updateTimer = null;

// The handover reloads the page, and a reload stops every sound dead. So it waits for idle
// AND for quietAt: the 2 s stop fade, and the ~40 s end chime (idle comes back 3.5 s after
// the end while the bowl is still ringing — the reload used to cut it about 7 s in).
// The flags stay set until the moment it applies, so a session that starts meanwhile
// simply defers it to the next idle moment.
function applyUpdateIfSafe(delayMs = 0) {
  if (closing) return;   // shutting down: a reload would resurrect the closed app
  if (!pendingReload && !waitingReg) return;
  if (state !== 'idle') return;                 // never interrupt a running meditation
  clearTimeout(updateTimer);
  updateTimer = setTimeout(() => {
    if (closing || state !== 'idle') return;
    if (performance.now() < quietAt) { applyUpdateIfSafe(); return; }
    if (pendingReload) { pendingReload = false; window.location.reload(); return; }
    const reg = waitingReg;
    waitingReg = null;
    if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  }, Math.max(delayMs, quietAt - performance.now()));
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
    if (closing) return;          // the app was closed or deleted: do not reinstall it
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
