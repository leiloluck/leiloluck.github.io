/* app.js — poltergeist.exe
   Fires prank sounds through a (Bluetooth) speaker at random intervals while the
   phone is locked. See ../context.md for the full brief.

   Locked-screen reliability:
   setTimeout / requestAnimationFrame are throttled or frozen when the screen is
   off, so they cannot drive playback. Every upcoming sound is therefore
   PRE-SCHEDULED on the AudioContext hardware clock via source.start(when) — that
   clock keeps running while locked. We schedule out to a horizon and top it up
   whenever the app gets CPU again (visible / heartbeat).

   Bluetooth standby + surviving the locked screen:
   BT speakers drop to standby when idle and clip the start of the next sound, and
   Chrome exempts a page from its background-freezing behavior only while the page
   counts as "playing audio" (documented: developer.chrome.com/docs/web-platform/
   page-lifecycle-api) — a frozen page's AudioContext stops too. That audibility
   check is power-based, not just "is a media element playing": a literal
   all-zero stream does NOT qualify (confirmed by prior art solving this exact
   problem, e.g. github.com/t-mullen/silent-audio), only a genuinely nonzero
   signal does. One keep-alive handles both problems: a continuous 25 Hz tone,
   clearly nonzero but at a very low amplitude — inaudible in the room (small
   speakers can't reproduce 25 Hz, and the level sits below the human hearing
   threshold at that frequency even on big ones). See knowledge/locked-screen-
   audio.md for the full writeup, including the caveat that the exact dBFS
   numbers below are an engineering safety margin, not a verified Chromium
   constant. A short "wake primer" tone is additionally scheduled just before
   every real sound so a speaker that dozed off mid-gap is awake by the time the
   sound plays.

   Separately, on Android, per-app battery optimization for Chrome itself can cut
   background audio regardless of anything this page does — that is an OS-level
   setting (Settings → Apps → Chrome → Battery → Unrestricted), not something any
   in-page trick can fix. See knowledge/locked-screen-audio.md §4. */

'use strict';

const APP_VERSION = 'v26.08.31g';

// ── Sound catalogue ──────────────────────────────────────────────────────────
// Drop real files into resources/ (see resources/README.md). Until a matching file
// exists, a synthesized stand-in is used so every button works and the app is
// testable. `synth(ctx)` returns an AudioBuffer; `files` lists candidate filenames
// (English + Spanish) - the first one that decodes wins, so it doesn't matter which
// naming you drop in.

// Ordered so animals are grouped together (and the two birds sit side by side),
// then human sounds, then mechanical/object sounds — easier to scan.
const SOUNDS = [
  // — animals: mammals —
  { id: 'cat',          name: 'Cat',          tag: 'meow',    emoji: '🐱', synth: synthMeow,
    files: ['cat-meow.mp3', 'gato-miau.mp3', 'meow.mp3'] },
  { id: 'dog',          name: 'Dog',          tag: 'bark',    emoji: '🐶', synth: synthBark,
    files: ['dog-bark.mp3', 'bark.mp3', 'ladrido.mp3'] },
  { id: 'mouse',        name: 'Mouse',        tag: 'squeak',  emoji: '🐭', synth: synthBlip,
    files: ['mouse-squeak.mp3', 'mouse.mp3', 'raton.mp3'] },
  // — animals: birds (kept adjacent) —
  { id: 'bird',         name: 'Sparrow',      tag: 'chirp',   emoji: '🐦', synth: synthBird,
    files: ['bird-chirp.mp3', 'sparrow.mp3', 'pajaro.mp3'] },
  { id: 'morningbirds', name: 'Morning birds',tag: 'garden',  emoji: '🐤', synth: synthBird,
    files: ['morning-birds.mp3', 'garden-birds.mp3'] },
  // — animals: insects —
  { id: 'crickets',     name: 'Crickets',     tag: 'awkward', emoji: '🦗', synth: synthBlip,
    files: ['crickets.mp3', 'grillos.mp3'] },
  { id: 'mosquito',     name: 'Mosquito',     tag: 'buzz',    emoji: '🦟', synth: synthBlip,
    files: ['mosquito.mp3', 'mosquito-buzz.mp3'] },
  // — human —
  { id: 'sneeze',       name: 'Sneeze',       tag: 'achoo',   emoji: '🤧', synth: synthBlip,
    files: ['sneeze.mp3', 'estornudo.mp3'] },
  { id: 'gasp',         name: 'Crowd gasp',   tag: 'shock',   emoji: '😱', synth: synthBlip,
    files: ['crowd-gasp.mp3', 'gasp.mp3'] },
  // — mechanical / objects —
  { id: 'knock',        name: 'Knock',        tag: 'on wood', emoji: '🚪', synth: synthKnock,
    files: ['knock.mp3', 'knock-on-wood.mp3', 'toque.mp3'] },
  { id: 'ding',         name: 'Ding',         tag: 'notify',  emoji: '🛎️', synth: synthDoorbell,
    files: ['ding.mp3', 'doorbell.mp3', 'timbre.mp3'] },
  { id: 'vibrate',      name: 'Vibrate',      tag: 'phone',   emoji: '📳', synth: synthBlip,
    files: ['phone-vibrate.mp3', 'vibrate.mp3'] },
];

// ── Interval presets (ms) ────────────────────────────────────────────────────

const PRESETS = [
  { ms: 5000,    label: '5 sec',  tag: '' },
  { ms: 30000,   label: '30 sec', tag: '' },
  { ms: 60000,   label: '1 min',  tag: '' },
  { ms: 120000,  label: '2 min',  tag: '' },
  { ms: 240000,  label: '4 min',  tag: '' },
  { ms: 360000,  label: '6 min',  tag: '' },
  { ms: 480000,  label: '8 min',  tag: '' },
  { ms: 600000,  label: '10 min', tag: '' },
  { ms: 1200000, label: '20 min', tag: '' },
];

// ── Scheduling constants ─────────────────────────────────────────────────────

const PRIMER_LEAD  = 0.6;     // s — wake primer fires this long before each sound
const FIRST_LEAD   = 0.75;    // s — an immediate sound still gets a full primer first
// A frozen page's AudioContext stops rendering, so pre-scheduling cannot outlive a
// freeze anyway; the horizon only has to cover JS being *throttled*, which is at worst
// one wake-up a minute. Ten minutes is ample, and halving it halves the number of source
// nodes hanging off the audio graph for the whole session.
const HORIZON_SEC  = 600;     // schedule 10 min ahead
const MAX_AHEAD    = 90;      // …but never queue more than this many hits at once
const MIN_GAP_MS   = 1500;    // floor so randomization can't bunch sounds up
const PRIMER_AMP   = 0.05;    // quiet BT wake blip (only fires briefly before a sound)
const PRIMER_FREQ  = 120;     // Hz — low, felt more than heard
const PRIMER_DUR   = 0.13;    // s

const HEARTBEAT_MS = 60000;   // schedule-top-up safety net (see startHeartbeat)

const KEEPALIVE_FREQ = 25;    // Hz — subsonic; real speakers can't reproduce it
const KEEPALIVE_AMP  = 0.002; // Chrome's audibility gate is exact: mean-square power
                              // >= -72.24719896 dBFS, i.e. RMS >= 2^-12 (1/4096), in
                              // services/audio/output_stream.cc. A 0.002 sine has RMS
                              // 1.41e-3 -> -57 dBFS: 15 dB of margin over the gate,
                              // and still ~57 dB below full scale, so inaudible.
                              // Do NOT lower this toward the gate, and NEVER to zero.

// ── State ────────────────────────────────────────────────────────────────────

let running       = false;
let selectedIntervalMs = 240000;   // default: 4 min (a preset, so a button is preselected)
let customSeconds = null;
let randomize     = true;
let testMode      = false;       // when on, tapping a sound previews it (no arm/disarm)
let startWithSound = true;       // UNLEASH fires one sound at once (vs. a discreet start)
const armed       = new Set();   // ids of active sounds

let audioCtx     = null;
let masterGain   = null;
let volumePct    = 80;      // app-only gain, 0-100. NOT the system volume.
let primerGain   = null;
let primerBuffer = null;
let keepAliveSrc = null;
let keepAliveEl  = null;   // looping <audio> carrying the faint keep-alive tone
let keepAliveUrl = null;   // blob: URL for the generated keep-alive clip

let scheduled        = [];   // { soundSrc, primerSrc, when, soundId }
let nextHitTime      = 0;    // ctx time of the next hit still to be scheduled
let recentIds        = [];   // most-recent-first ids of scheduled hits (anti-repeat)
let heartbeatId      = null;

// ── Audio setup ──────────────────────────────────────────────────────────────

function ensureAudio() {
  if (audioCtx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  // latencyHint:'playback' is the single biggest battery win available here, and it is
  // not just a hint: in Chrome it maps to AAUDIO_PERFORMANCE_MODE_POWER_SAVING on
  // Android and to a ~21 ms (1024-frame) buffer instead of the raw hardware buffer.
  // That is roughly 47 device callbacks per second instead of 200-500 — a 5-10x cut in
  // CPU wakeups, for free, because nothing here is latency-sensitive: every sound is
  // scheduled seconds to minutes ahead of when it plays.
  // renderSizeHint aligns the render quantum with the device burst (Chrome 153+);
  // unknown dictionary members are ignored, so older engines just skip it.
  for (const opts of [{ latencyHint: 'playback', renderSizeHint: 'hardware' },
                      { latencyHint: 'playback' },
                      undefined]) {
    try { audioCtx = opts ? new Ctx(opts) : new Ctx(); break; } catch (e) { /* try simpler */ }
  }

  // iOS/Safari only (16.4+). WebKit backgrounds an AudioContext the instant the page is
  // hidden *unless* the audio session type is 'playback' — this exact property is the
  // literal condition in WebCore's shouldOverrideBackgroundPlaybackRestriction(). It is
  // the one lever that makes locked-screen playback work at all on an iPhone.
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch {}

  // If the OS suspends the context (audio focus lost to a call/notification while
  // locked), every pre-scheduled sound is dead until it is resumed. Take it back.
  audioCtx.onstatechange = () => {
    if (!running || !audioCtx) return;
    // iOS reports 'interrupted' (a phone call, Siri); Android reports 'suspended'.
    // Handling only the latter meant one incoming call silently ended the session.
    if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
      audioCtx.resume().then(fillSchedule).catch(() => {});
    }
  };

  masterGain = audioCtx.createGain();
  masterGain.gain.value = volumeGain();
  masterGain.connect(audioCtx.destination);

  primerGain = audioCtx.createGain();
  primerGain.gain.value = PRIMER_AMP;
  primerGain.connect(audioCtx.destination);

  primerBuffer = makePrimerBuffer();
  prepareSounds();
}

// Build a short, soft, low tone used to wake a sleeping Bluetooth speaker.
function makePrimerBuffer() {
  const sr  = audioCtx.sampleRate;
  const len = Math.floor(sr * PRIMER_DUR);
  const buf = audioCtx.createBuffer(1, len, sr);
  const ch  = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    // Hann window so the blip has no click at on/offset.
    const env = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (len - 1));
    ch[i] = Math.sin(2 * Math.PI * PRIMER_FREQ * t) * env;
  }
  return buf;
}

// Synthesize a stand-in for every sound immediately, then try to replace each with
// the first real file that decodes. Buffers therefore always exist by the time we
// play; a real file silently takes over once found.
function prepareSounds() {
  SOUNDS.forEach(sound => {
    sound.buffer = sound.synth(audioCtx);
    sound.isDemo = true;
    loadFirstAvailable(sound, 0);
  });
  renderSounds();
}

function loadFirstAvailable(sound, i) {
  if (i >= sound.files.length) return; // none found → keep the synth stand-in
  fetch(`./resources/${sound.files[i]}`)
    .then(r => { if (!r.ok) throw new Error('missing'); return r.arrayBuffer(); })
    .then(buf => audioCtx.decodeAudioData(buf))
    .then(decoded => {
      sound.buffer = decoded;
      sound.isDemo = false;
      sound.loadedFile = sound.files[i];
      // Update just this button. The old code called renderSounds() here, which wipes and
      // rebuilds all twelve — once per sound as its mp3 lands, so the whole grid was torn
      // down a dozen times during boot. A tap that landed on a button in the moment
      // between its removal and its replacement went nowhere.
      refreshSoundBtn(sound);
    })
    .catch(() => loadFirstAvailable(sound, i + 1));
}

// ── Keep-alive ───────────────────────────────────────────────────────────────
// Holds the audio output (and the BT link) open between sounds AND keeps the page
// counted as "playing audio" so Android doesn't freeze it when the screen locks.
// Inaudible in practice, but deliberately NOT digital silence — see header comment.

function startKeepAlive() {
  if (!audioCtx) return;
  stopKeepAlive();

  // Faint 25 Hz tone. v26.06.19 used a zero-filled buffer here (after an earlier
  // audible-hiss complaint) and that is exactly what broke locked-screen playback:
  // Chrome treats an all-zero output as "not audible", drops the media wakelock,
  // and Android freezes the page + AudioContext on lock — no scheduled sound ever
  // fires again. Do NOT "optimize" this back to pure silence. The loop is a whole
  // number of cycles, so it repeats seamlessly.
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

  // A real, playing <audio> element carries the same faint tone: it keeps the
  // platform audio session alive where a Web Audio buffer alone is not enough
  // (notably iOS), and it is the strongest "this tab plays media" signal on
  // Android. Redundant with the buffer above on purpose — either alone keeps the
  // page alive if the other is muted or fails.
  startKeepAliveEl();
}

function stopKeepAlive() {
  if (keepAliveSrc) {
    try { keepAliveSrc.stop(); } catch {}
    try { keepAliveSrc.disconnect(); } catch {}
    keepAliveSrc = null;
  }
  if (keepAliveEl) keepAliveEl.pause();
}

function startKeepAliveEl() {
  if (!keepAliveEl) {
    keepAliveUrl = URL.createObjectURL(makeKeepAliveWavBlob());
    keepAliveEl = new Audio(keepAliveUrl);
    keepAliveEl.loop = true;
    // If the OS pauses it (transient audio-focus loss: a notification, the lock
    // event itself), take playback back — while locked, losing this element lets
    // Android freeze the page and the whole session goes quiet.
    keepAliveEl.addEventListener('pause', () => {
      if (!running) return;
      setTimeout(() => {
        if (running && keepAliveEl && keepAliveEl.paused) keepAliveEl.play().catch(() => {});
      }, 400);
    });
  }
  keepAliveEl.currentTime = 0;
  keepAliveEl.play().catch(() => {});
}

// 10 s mono WAV of the faint keep-alive tone (250 full cycles at 25 Hz, so it
// loops seamlessly). Served as a blob: URL — the CSP allows blob: media, not data:.
function makeKeepAliveWavBlob(seconds = 10, sampleRate = 8000) {
  const n = Math.floor(seconds * sampleRate);
  const buffer = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buffer);
  const w = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); view.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); w(36, 'data');
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.sin(2 * Math.PI * KEEPALIVE_FREQ * (i / sampleRate)) * KEEPALIVE_AMP;
    view.setInt16(44 + i * 2, Math.round(s * 32767), true);
  }
  return new Blob([view], { type: 'audio/wav' });
}

// ── Volume ───────────────────────────────────────────────────────────────────
// This is the app's OWN gain node, entirely separate from the device volume, so the
// prank can sit quietly underneath music that is already playing. Perceived loudness is
// roughly the cube of the amplitude ratio, so a linear slider feels wrong at the quiet
// end; squaring it gives a usable taper without needing a real dB curve.
function volumeGain() {
  const v = Math.min(100, Math.max(0, volumePct)) / 100;
  return v * v;
}

function applyVolume(save) {
  if (masterGain && audioCtx) {
    // Ramp rather than jump: a step change on a live gain node clicks audibly.
    try {
      masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
      masterGain.gain.setTargetAtTime(volumeGain(), audioCtx.currentTime, 0.02);
    } catch { masterGain.gain.value = volumeGain(); }
  }
  if (elVolumeValue) elVolumeValue.textContent = volumePct + '%';
  // Drives the navy fill behind the thumb (see --fill in styles.css).
  if (elVolume) elVolume.style.setProperty('--vol', String(volumePct / 100));
  if (save) saveState();
}

// ── Scheduling ───────────────────────────────────────────────────────────────

function computeGapMs(lastSound) {
  const base = selectedIntervalMs;
  const gap = randomize ? base * (0.75 + Math.random() * 0.5) : base;
  // Never let the next hit start before the previous clip has finished — at the 5-second
  // preset a three-second sound would otherwise talk over itself.
  const clipMs = lastSound && lastSound.buffer ? lastSound.buffer.duration * 1000 : 0;
  return Math.max(MIN_GAP_MS, clipMs + 250, gap);
}

function getArmedSounds() {
  return SOUNDS.filter(s => armed.has(s.id) && s.buffer);
}

// How many of the most recently scheduled sounds to keep out of the running.
const AVOID_RECENT = 2;

function rememberPick(id) {
  recentIds.unshift(id);
  if (recentIds.length > AVOID_RECENT) recentIds.length = AVOID_RECENT;
}

// Pick the next sound, avoiding the ones just played so a listener never hears the same
// clip twice running (or an A-B-A bounce once there are enough sounds to do better).
//
// We can only ever ban N-1 of N armed sounds, or there would be nothing left to choose:
//   1 armed  -> ban none, it repeats (there is no alternative)
//   2 armed  -> ban the last one     -> strict alternation
//   3+ armed -> ban the last two
// Note that at exactly 3 armed sounds this leaves a single candidate every time, so the
// ORDER becomes a fixed rotation — the randomness then lives entirely in the interval.
// Arm a fourth sound to get an unpredictable order back.
function pickNextSound(list) {
  if (list.length === 1) return list[0];
  const ban  = new Set(recentIds.slice(0, Math.min(AVOID_RECENT, list.length - 1)));
  const pool = list.filter(s => !ban.has(s.id));
  // pool cannot be empty by construction; fall back rather than return undefined if a
  // future change to the ban rule ever makes it so.
  const from = pool.length ? pool : list;
  return from[Math.floor(Math.random() * from.length)];
}

// Schedule one sound (plus its wake primer) at an absolute AudioContext time.
function scheduleHit(sound, when) {
  const now = audioCtx.currentTime;

  // Wake primer just before the sound (skip if there isn't room before `when`).
  let primerSrc = null;
  const primerAt = when - PRIMER_LEAD;
  if (primerAt > now) {
    primerSrc = audioCtx.createBufferSource();
    primerSrc.buffer = primerBuffer;
    primerSrc.connect(primerGain);
    primerSrc.start(primerAt);
  }

  const soundSrc = audioCtx.createBufferSource();
  soundSrc.buffer = sound.buffer;
  soundSrc.connect(masterGain);
  soundSrc.start(Math.max(now, when));

  const entry = { soundSrc, primerSrc, when, soundId: sound.id };
  soundSrc.onended = () => {
    scheduled = scheduled.filter(e => e !== entry);
    fillSchedule();   // top up as each one completes (foreground)
  };
  scheduled.push(entry);
  return entry;
}

// Fill the schedule out to the horizon (bounded by MAX_AHEAD).
function fillSchedule() {
  if (!running || !audioCtx) return;

  const now = audioCtx.currentTime;
  // Only drop entries whose onended must have been missed (a very long sound is well
  // under a minute). Anything more aggressive than this makes a playing sound
  // unreachable by clearScheduled(), so STOP stops scheduling but not the noise.
  scheduled = scheduled.filter(e => e.when > now - 60);

  const list = getArmedSounds();
  if (list.length === 0) { stopAnnoying(); return; }

  // If the page was frozen (or simply backgrounded) for longer than the horizon,
  // nextHitTime is far in the past. Without this clamp the loop below would queue
  // every missed hit and scheduleHit would collapse them all onto `now` — a wall of
  // up to MAX_AHEAD sounds firing simultaneously the moment the phone wakes up.
  // Drop the backlog and resume one fresh gap from here.
  if (nextHitTime < now) nextHitTime = now + computeGapMs() / 1000;

  while (nextHitTime < now + HORIZON_SEC && scheduled.length < MAX_AHEAD) {
    const sound = pickNextSound(list);
    scheduleHit(sound, nextHitTime);
    rememberPick(sound.id);
    nextHitTime += computeGapMs(sound) / 1000;
  }
}

// Drop every hit that has not started yet and rebuild the horizon from the current
// settings. Used when the armed sounds or the interval change mid-session: without it the
// already-scheduled 30 minutes of hits keep using the OLD settings and the change appears
// to do nothing at all.
function rescheduleFromNow() {
  if (!running || !audioCtx) return;
  const now = audioCtx.currentTime;
  const keep = [];
  scheduled.forEach(e => {
    if (e.when <= now + 0.05) { keep.push(e); return; }   // already started — let it finish
    [e.soundSrc, e.primerSrc].forEach(src => {
      if (!src) return;
      try { src.onended = null; } catch {}
      try { src.stop(); } catch {}
      try { src.disconnect(); } catch {}
    });
  });
  scheduled = keep;
  // The hits we just dropped never made a sound, so they must not count as "recently
  // played" — otherwise toggling a sound mid-session bans clips the listener never heard.
  // `keep` is in ascending time order, so the tail is the most recent.
  recentIds = keep.slice(-AVOID_RECENT).map(e => e.soundId).reverse();
  const list = getArmedSounds();
  if (!list.length) { stopAnnoying(); return; }
  nextHitTime = now + computeGapMs() / 1000;
  fillSchedule();
  updateRunningStatus();
}

function clearScheduled() {
  scheduled.forEach(e => {
    [e.soundSrc, e.primerSrc].forEach(s => {
      if (!s) return;
      try { s.onended = null; } catch {}
      try { s.stop(); } catch {}
      try { s.disconnect(); } catch {}
    });
  });
  scheduled = [];
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

function startAnnoying() {
  if (running) return;
  ensureAudio();
  audioCtx.resume();

  const list = getArmedSounds();
  if (list.length === 0) {
    flashStatus('arm at least one sound');
    return;
  }

  // Test mode and a live session are mutually exclusive: renderTestMode() already stops a
  // run when test mode is switched on, but UNLEASH could still start one while it was on,
  // leaving every sound tap playing a preview instead of arming.
  if (testMode) {
    testMode = false;
    saveState();
    renderTestMode();
  }

  running = true;
  document.body.classList.add('running');
  // If a close was refused (a plain tab) the app is still alive and in use again, so
  // let deferred updates through once more.
  closing = false;
  recentIds = [];
  clearScheduled();
  startKeepAlive();
  setMediaSession();

  if (startWithSound) {
    // Fire one sound right away (confirms it works / lets you gauge the volume).
    const first     = pickNextSound(list);
    // Far enough out to leave room for the wake primer. The Bluetooth speaker has been
    // idle up to this point, so this is the hit that most needs waking — and it was the
    // one hit that never got a primer at all.
    const firstWhen = audioCtx.currentTime + FIRST_LEAD;
    const entry     = scheduleHit(first, firstWhen);
    if (entry) entry.fired = true;      // flashed right here; don't flash again on the tick
    onFiredVisible(first);
    rememberPick(first.id);
    nextHitTime = firstWhen + (first.buffer?.duration ?? 0.5) + computeGapMs(first) / 1000;
  } else {
    // Discreet start: stay silent for the first interval so hitting UNLEASH isn't
    // given away by an immediate sound.
    nextHitTime = audioCtx.currentTime + computeGapMs() / 1000;
  }
  fillSchedule();
  startHeartbeat();

  setLaunchBtn();
  updateRunningStatus();
}

function stopAnnoying() {
  if (!running) return;
  running = false;
  document.body.classList.remove('running');

  clearScheduled();
  stopKeepAlive();
  stopHeartbeat();
  // 'none' would dismiss the notification outright, taking Resume with it. 'paused'
  // keeps the shade entry alive for as long as the platform chooses to hold it, so
  // Resume stays reachable. setMediaSession() below rebinds the handlers.
  // An open output stream holds a partial wakelock (roughly 12 mW -> 70 mW on an idle
  // device). Nothing released it before, so STOP left the phone awake indefinitely.
  // ensureAudio() / resume() bring it straight back on the next UNLEASH.
  if (audioCtx && audioCtx.state === 'running') audioCtx.suspend().catch(() => {});

  setLaunchBtn();
  setMediaSession();          // flip the shade to Resume
  elHeroStatus.textContent = 'stopped, no sounds';
  elHeroSub.textContent = '';
  setHeroIdleArt();

  applyUpdateIfSafe(1500);   // a new build that landed mid-session lands now
}

// ── Close ────────────────────────────────────────────────────────────────────
//
// A web page cannot terminate its own OS process. Nothing in any browser exposes that,
// and on Android the system alone decides when to reclaim a process. What it CAN do is
// make the app stop holding things, which is the part that actually matters here: no
// queued sounds, no keep-alive, no lock-screen controls, and above all no open audio
// output stream — that last one is what pins a partial wakelock and keeps the phone from
// sleeping. After this the app is inert whether or not the window itself goes away.
//
// window.close() then closes the window. Per spec a script may only close a window it
// opened — but an INSTALLED app window counts, which is precisely why installing matters.
// In an ordinary browser tab it silently does nothing, so we detect that and say so
// rather than leaving a button that looks broken.
let closing = false;

function shutdownApp() {
  closing = true;
  stopAnnoying();          // no-op when idle; stops the queue and suspends when running
  stopHeartbeat();
  stopKeepAlive();

  // Drop the lock-screen controls, or the media notification outlives the app.
  if ('mediaSession' in navigator) {
    try {
      ['play', 'pause', 'stop', 'previoustrack', 'nexttrack']
        .forEach(a => navigator.mediaSession.setActionHandler(a, null));
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    } catch {}
  }

  // Release the keep-alive element and the blob: URL backing it.
  if (keepAliveEl) {
    try { keepAliveEl.pause(); keepAliveEl.removeAttribute('src'); keepAliveEl.load(); } catch {}
  }
  if (keepAliveUrl) {
    try { URL.revokeObjectURL(keepAliveUrl); } catch {}
    keepAliveUrl = null;
  }

  // close(), not suspend(): this is what hands the audio device back to the OS. Null the
  // reference too — ensureAudio() early-returns on a truthy audioCtx, so leaving a closed
  // one there would make UNLEASH silently dead if the window turns out to survive.
  if (audioCtx) {
    const ctx = audioCtx;
    audioCtx = null;
    try { ctx.close(); } catch {}
  }

  try { window.close(); } catch {}

  // Still running a frame later? Then close() was refused — a plain tab. Say so.
  setTimeout(() => {
    if (!closing) return;
    elHeroEmoji.textContent  = '😴';
    elHeroStatus.textContent = 'closed, audio released';
    elHeroSub.textContent    = isStandalone()
      ? 'Swipe the app away to finish.'
      : 'A browser tab cannot close itself - close it yourself. Install the app for a real close.';
  }, 250);
}


// Two separate jobs, deliberately split so neither costs battery when it isn't needed:
//
//   * The countdown is cosmetic. It runs on requestAnimationFrame, which the browser
//     stops entirely the moment the page is hidden — so a pocketed phone spends zero
//     CPU on it. (The old build ran a 1 Hz setInterval that kept ticking, resuming the
//     context and writing to the DOM every second forever.)
//   * Topping the schedule up is not cosmetic, but it barely needs to run: every
//     scheduled sound tops the horizon up again from its own `onended`, and we also
//     top up on visibilitychange and on Page Lifecycle `resume`. The interval below is
//     only a safety net, so it ticks slowly.
function startHeartbeat() {
  stopHeartbeat();
  heartbeatId = setInterval(() => {
    if (!running) return;
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    fillSchedule();
  }, HEARTBEAT_MS);
  startCountdownLoop();
}

function stopHeartbeat() {
  if (heartbeatId) { clearInterval(heartbeatId); heartbeatId = null; }
  stopCountdownLoop();
}

let countdownRaf = null;
let lastCountdownPaint = 0;

function startCountdownLoop() {
  stopCountdownLoop();
  const frame = ts => {
    if (!running) { countdownRaf = null; return; }
    // The countdown only shows whole seconds; repainting it 60x a second is wasted work.
    if (ts - lastCountdownPaint >= 250) { lastCountdownPaint = ts; updateRunningStatus(); }
    countdownRaf = requestAnimationFrame(frame);
  };
  countdownRaf = requestAnimationFrame(frame);
}

function stopCountdownLoop() {
  if (countdownRaf) { cancelAnimationFrame(countdownRaf); countdownRaf = null; }
}

// ── Sound tap: arm/disarm, or preview in test mode ───────────────────────────

function onSoundClick(sound, btn) {
  if (testMode) previewSound(sound, btn);
  else          toggleSound(sound.id);
}

let previewStopTimer = null;

// Play a single sound right now (used by test mode). Goes through the same primer +
// keep-alive path as a real hit, so what you hear is what people will hear.
function previewSound(sound, btn) {
  ensureAudio();
  audioCtx.resume();
  startKeepAlive();
  const entry = scheduleHit(sound, audioCtx.currentTime + FIRST_LEAD);
  if (entry) entry.fired = true;
  onFiredVisible(sound);

  if (btn) {
    btn.classList.remove('playing');
    void btn.offsetWidth;          // restart the pulse if tapped rapidly
    btn.classList.add('playing');
    setTimeout(() => btn.classList.remove('playing'), 420);
  }

  // Drop the keep-alive shortly after the preview so we don't hold the session open
  // when the app isn't actually running.
  clearTimeout(previewStopTimer);
  previewStopTimer = setTimeout(() => { if (!running) stopKeepAlive(); }, 2500);
}

// ── Media Session ────────────────────────────────────────────────────────────

// Lock-screen / notification-shade controls.
//
// The Media Session API has a fixed vocabulary of actions; there is no "close" action, so
// the three the user wants map onto the three that exist:
//   play  -> resume   (shown only while stopped)
//   pause -> stop     (shown only while running)
//   stop  -> close the app entirely (shutdownApp)
// play and pause never appear together: the platform picks one based on playbackState,
// which is exactly the alternation we want. Setting a handler to null REMOVES the button,
// so the shade only ever offers the action that makes sense right now.
function setMediaSession() {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title:  'poltergeist.exe',
      artist: running ? 'running, sounds incoming' : 'stopped, no sounds',
      album:  'active noise confuser',
      artwork: [
        { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
  } catch {}
  updateMediaSessionState();
}

function updateMediaSessionState() {
  if (!('mediaSession' in navigator)) return;
  const set = (action, fn) => {
    // An unsupported action throws rather than no-oping, and one throw would skip every
    // handler after it, so each is guarded independently.
    try { navigator.mediaSession.setActionHandler(action, fn); } catch {}
  };
  navigator.mediaSession.playbackState = running ? 'playing' : 'paused';
  set('play',  running ? null : () => startAnnoying());
  set('pause', running ? () => stopAnnoying() : null);
  set('stop',  () => shutdownApp());
  // Nothing here is seekable; leaving these bound would put dead scrub buttons in the
  // shade and push the ones that matter off the compact view.
  ['seekbackward', 'seekforward', 'seekto', 'previoustrack', 'nexttrack'].forEach(a => set(a, null));
}

// ── Synthesized stand-in sounds ──────────────────────────────────────────────
// Rough but recognisable; only used until the real mp3s are dropped in.

function synthMeow(ctx) {
  const sr = ctx.sampleRate, dur = 0.6, len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr), ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const f = 520 + 240 * Math.sin(Math.PI * t / dur) + 18 * Math.sin(2 * Math.PI * 11 * t);
    const env = Math.sin(Math.PI * t / dur);
    let s = Math.sin(2 * Math.PI * f * t) * 0.6 + Math.sin(2 * Math.PI * f * 2 * t) * 0.2;
    ch[i] = s * env * 0.7;
  }
  return buf;
}

function synthBark(ctx) {
  const sr = ctx.sampleRate, dur = 0.5, len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr), ch = buf.getChannelData(0);
  const barks = [0.0, 0.26];
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let s = 0;
    barks.forEach(b => {
      const lt = t - b;
      if (lt >= 0 && lt < 0.16) {
        const env = Math.exp(-lt * 22) * (1 - Math.exp(-lt * 400));
        const f = 220 - 120 * lt;
        s += (Math.sin(2 * Math.PI * f * lt) + (Math.random() * 2 - 1) * 0.5) * env;
      }
    });
    ch[i] = s * 0.8;
  }
  return buf;
}

function synthDoorbell(ctx) {
  const sr = ctx.sampleRate, dur = 1.4, len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr), ch = buf.getChannelData(0);
  const tones = [{ at: 0.0, f: 660 }, { at: 0.5, f: 524 }];
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let s = 0;
    tones.forEach(tn => {
      const lt = t - tn.at;
      if (lt >= 0) {
        const env = Math.exp(-lt * 3.2);
        s += (Math.sin(2 * Math.PI * tn.f * lt) * 0.7 + Math.sin(2 * Math.PI * tn.f * 2 * lt) * 0.2) * env;
      }
    });
    ch[i] = s * 0.55;
  }
  return buf;
}

// Generic stand-in for sounds without a hand-tuned synth. Only ever heard if the
// real mp3 is missing — a neutral two-tone blip so the button still does something.
function synthBlip(ctx) {
  const sr = ctx.sampleRate, dur = 0.35, len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr), ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sr, env = Math.sin(Math.PI * t / dur);
    ch[i] = (Math.sin(2 * Math.PI * 740 * t) * 0.5 + Math.sin(2 * Math.PI * 988 * t) * 0.3) * env * 0.6;
  }
  return buf;
}

function synthBird(ctx) {
  const sr = ctx.sampleRate, dur = 0.5, len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr), ch = buf.getChannelData(0);
  const chirps = [0.0, 0.16, 0.30];
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let s = 0;
    chirps.forEach(c => {
      const lt = t - c;
      if (lt >= 0 && lt < 0.1) {
        const env = Math.sin(Math.PI * lt / 0.1);
        const f = 2600 + 1600 * lt / 0.1;            // quick upward whistle
        s += Math.sin(2 * Math.PI * f * lt) * env;
      }
    });
    ch[i] = s * 0.5;
  }
  return buf;
}

function synthKnock(ctx) {
  const sr = ctx.sampleRate, dur = 0.7, len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr), ch = buf.getChannelData(0);
  const knocks = [0.0, 0.18, 0.36];
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let s = 0;
    knocks.forEach(k => {
      const lt = t - k;
      if (lt >= 0 && lt < 0.08) {
        const env = Math.exp(-lt * 80);
        s += ((Math.random() * 2 - 1) * 0.6 + Math.sin(2 * Math.PI * 90 * lt) * 0.8) * env;
      }
    });
    ch[i] = s * 0.9;
  }
  return buf;
}

// ── UI: elements ─────────────────────────────────────────────────────────────

const elHeroEmoji   = document.getElementById('hero-emoji');
// The hero holds inline pixel art at rest, but it is ALSO the flash target when a
// sound fires (it briefly shows that sound's emoji). Snapshot the art once at load so
// the idle look can be restored, instead of being destroyed by the first flash.
const HERO_IDLE_ART = elHeroEmoji.innerHTML;
function setHeroIdleArt() { elHeroEmoji.innerHTML = HERO_IDLE_ART; }
const elHeroStatus  = document.getElementById('hero-status');
const elHeroSub     = document.getElementById('hero-sub');
const elLaunch      = document.getElementById('btn-launch');
const elSkip        = document.getElementById('btn-skip');
const elVolume      = document.getElementById('volume');
const elVolumeValue = document.getElementById('volume-value');
const elSoundGroup  = document.getElementById('sound-group');
const elSoundHint   = document.getElementById('sound-hint');
const elSelectAllBtn = document.getElementById('select-all-btn');
const elIntervalGroup = document.getElementById('interval-group');
const elRandomToggle  = document.getElementById('randomize-toggle');
const elRandomSub   = document.getElementById('randomize-sub');
const elTestToggle  = document.getElementById('testmode-toggle');
const elTestSub     = document.getElementById('testmode-sub');
const elStartToggle = document.getElementById('startsound-toggle');
const elStartSub    = document.getElementById('startsound-sub');
const elInstallBtn  = document.getElementById('install-btn');
const elUpdateBtn   = document.getElementById('update-btn');
const elVersion     = document.getElementById('version');
const elHelpBtn     = document.getElementById('help-btn');
const elOfflineBadge= document.getElementById('offline-badge');

// Tabs
const elTabAnnoy     = document.getElementById('tab-annoy');
const elTabSettings  = document.getElementById('tab-settings');
const elPanelAnnoy   = document.getElementById('panel-annoy');
const elPanelSettings= document.getElementById('panel-settings');
const elTabInfo      = document.getElementById('tab-info');
const elPanelInfo    = document.getElementById('panel-info');

// Install instructions modal
const elInstallModalLayer   = document.getElementById('install-modal-layer');
const elInstallModal        = document.getElementById('install-modal');
const elInstallModalDismiss = document.getElementById('install-modal-dismiss');
const elInstallSummary      = document.getElementById('install-modal-summary');
const elInstallSteps        = document.getElementById('install-steps');
const elInstallCloseBtn     = document.getElementById('install-close-btn');
const elCloseBtn            = document.getElementById('close-btn');
// Wired here, not beside shutdownApp(): the handle is a `const` declared in this
// block, so referencing it any earlier is a temporal-dead-zone ReferenceError
// that aborts the whole script at load and leaves the page completely dead.
elCloseBtn.addEventListener('click', shutdownApp);
const elInstallProceedBtn   = document.getElementById('install-proceed-btn');
const elOpenChromeBtn       = document.getElementById('open-chrome-btn');

const elHelpModalLayer   = document.getElementById('help-modal-layer');
const elHelpModal        = document.getElementById('help-modal');
const elHelpModalDismiss = document.getElementById('help-modal-dismiss');
const elHelpDetailsBtn   = document.getElementById('help-details-btn');
const elHelpDetails      = document.getElementById('help-details');
const elHelpCloseBtn     = document.getElementById('help-close-btn');

const elModalLayer  = document.getElementById('custom-modal-layer');
const elModal       = document.getElementById('custom-modal');
const elModalDismiss= document.getElementById('custom-modal-dismiss');
const elCustomForm  = document.getElementById('custom-form');
const elCustomValue = document.getElementById('custom-value');
const elCustomError = document.getElementById('custom-error');
const elCustomCancel= document.getElementById('custom-cancel');
const elKeypad      = document.querySelector('.custom-keypad');

elVersion.textContent = APP_VERSION;

// ── UI: status ───────────────────────────────────────────────────────────────

let statusFlashTimer = null;

function flashStatus(msg) {
  elHeroStatus.textContent = msg;
  clearTimeout(statusFlashTimer);
  statusFlashTimer = setTimeout(() => {
    if (!running) elHeroStatus.textContent = idleStatus();
  }, 2200);
}

function idleStatus() {
  if (testMode) return 'test mode, tap a sound to hear it';
  return getArmedSoundsCount() === 0 ? 'select at least one sound' : 'active noise confuser';
}

function getArmedSoundsCount() {
  return SOUNDS.filter(s => armed.has(s.id)).length;
}

// "3:58" for a minute or more, "45 sec" under a minute.
function formatCountdown(sec) {
  sec = Math.max(0, Math.ceil(sec));
  if (sec < 60) return `${sec} sec`;
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

let lastCountdownText = '';

function updateRunningStatus() {
  if (!running) return;
  elHeroStatus.textContent = 'running, sounds incoming';
  const now = audioCtx.currentTime;

  // Flash the emoji when a hit actually STARTS. It used to be driven by onended, so the
  // visual arrived when the sound finished — up to ten seconds late on a long clip.
  scheduled.forEach(e => {
    if (!e.fired && e.when <= now) {
      e.fired = true;
      if (document.visibilityState === 'visible') {
        const sound = SOUNDS.find(x => x.id === e.soundId);
        if (sound) onFiredVisible(sound);
      }
    }
  });

  const next = scheduled
    .filter(e => e.when > now)
    .sort((a, b) => a.when - b.when)[0];
  let text;
  if (next) {
    // Name what is coming, not what just played. The prankster wants to know what to
    // expect; the victims are the ones who should be surprised.
    const s = SOUNDS.find(x => x.id === next.soundId);
    const label = s ? s.name.toLowerCase() : 'a sound';
    text = `next sound: ${label} in ${formatCountdown(next.when - now)}`;
  } else {
    text = 'scheduling…';
  }
  // Only touch the DOM when the displayed value actually changes: hero-sub is
  // aria-live="polite", and rewriting it four times a second made a screen reader read
  // the countdown continuously.
  if (text !== lastCountdownText) {
    lastCountdownText = text;
    elHeroSub.textContent = text;
  }
}

function onFiredVisible(sound) {
  // The hero used to swap in the fired sound's emoji, which destroyed the pixel art and
  // told you what had ALREADY played. The upcoming sound is named in hero-sub instead;
  // here we only pulse the artwork.
  document.body.classList.remove('fired');
  void document.body.offsetWidth; // restart the animation
  document.body.classList.add('fired');
  setTimeout(() => document.body.classList.remove('fired'), 380);
}

function setLaunchBtn() {
  elLaunch.textContent = running ? 'Stop' : 'Activate';
  elSkip.classList.toggle('hidden', !running);
}

// ── UI: sound buttons ────────────────────────────────────────────────────────

// Rebuild the whole grid. Only for changes that affect every button (test mode, a fresh
// load of saved state) — for a single sound use refreshSoundBtn().
function renderSounds() {
  elSoundGroup.innerHTML = '';
  SOUNDS.forEach(sound => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sound-btn' + (armed.has(sound.id) ? ' armed' : '') + (sound.isDemo ? ' demo' : '');
    btn.setAttribute('aria-pressed', armed.has(sound.id) ? 'true' : 'false');

    const emoji = document.createElement('span');
    emoji.className = 's-emoji';
    emoji.textContent = sound.emoji;

    const label = document.createElement('span');
    label.className = 's-label';
    const name = document.createElement('span');
    name.className = 's-name';
    name.textContent = sound.name;
    label.append(name);   // sub-text intentionally omitted — just the name

    btn.append(emoji, label);
    btn.addEventListener('click', () => onSoundClick(sound, btn));
    sound.btn = btn;
    elSoundGroup.appendChild(btn);
  });
}

// In-place state update for one sound's button — no teardown, so a tap in flight is
// never lost and the pulse animation isn't interrupted.
function refreshSoundBtn(sound) {
  const btn = sound.btn;
  if (!btn) return;
  btn.classList.toggle('armed', armed.has(sound.id));
  btn.classList.toggle('demo', !!sound.isDemo);
  btn.setAttribute('aria-pressed', armed.has(sound.id) ? 'true' : 'false');
}

function toggleSound(id) {
  if (armed.has(id)) armed.delete(id); else armed.add(id);
  saveState();
  const sound = SOUNDS.find(s => s.id === id);
  if (sound) refreshSoundBtn(sound);      // in place: never rebuild under the finger
  updateSelectAllBtn();
  setLaunchBtn();
  if (!running) elHeroStatus.textContent = idleStatus();
  else rescheduleFromNow();               // takes effect immediately, not in 30 minutes
}

// ── UI: interval buttons ─────────────────────────────────────────────────────

function renderIntervals() {
  elIntervalGroup.innerHTML = '';

  PRESETS.forEach(p => {
    const btn = makeIntervalBtn(p.label, p.tag, selectedIntervalMs === p.ms && !isCustomSelected());
    btn.addEventListener('click', () => setInterval_(p.ms));
    elIntervalGroup.appendChild(btn);
  });

  // Custom cell: sized in fitCustomCell() once the grid has actually laid out.
  const label = customSeconds ? formatMinutes(customSeconds) : 'Custom';
  const tag = customSeconds ? 'custom' : 'set';
  elCustomCell = makeIntervalBtn(label, tag, isCustomSelected());
  elCustomCell.addEventListener('click', openCustomModal);
  elIntervalGroup.appendChild(elCustomCell);
  fitCustomCell();
}

// The Custom button swallows the empty tail of the last preset row: 3 free cells -> it
// spans 3, 1 free cell -> it takes that one, a full row -> it gets its own row entire.
//
// The span cannot be written as a static rule. The grid is repeat(auto-fill, minmax(...)),
// so the column count is decided by the available width at layout time and changes when
// the window resizes or the phone rotates. The only honest source is the computed style
// after layout, which is why this is measured rather than declared.
let elCustomCell = null;

function gridColumnCount(el) {
  // getComputedStyle resolves auto-fill to the used track list ("84px 84px ..."), so the
  // number of entries IS the column count. A hidden panel has no tracks: it reports
  // "none", and we simply wait for the ResizeObserver to fire when the tab is shown.
  const tracks = getComputedStyle(el).gridTemplateColumns;
  if (!tracks || tracks === 'none') return 0;
  return tracks.split(' ').filter(Boolean).length;
}

function fitCustomCell() {
  if (!elCustomCell) return;
  const cols = gridColumnCount(elIntervalGroup);
  if (!cols) return;
  const tail = PRESETS.length % cols;               // cells already used in the last row
  const span = tail === 0 ? cols : cols - tail;     // exact fit, so it never wraps early
  const value = span > 1 ? `span ${span}` : '';
  // Only write on a real change: this runs from a ResizeObserver, and an unconditional
  // style write on every callback is how you get a resize loop.
  if (elCustomCell.style.gridColumn !== value) elCustomCell.style.gridColumn = value;
}

if (window.ResizeObserver) {
  new ResizeObserver(() => fitCustomCell()).observe(elIntervalGroup);
} else {
  window.addEventListener('resize', fitCustomCell);
}

function makeIntervalBtn(label, tag, selected) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'interval-btn' + (selected ? ' selected' : '');
  const main = document.createElement('span');
  main.textContent = label;
  btn.appendChild(main);
  if (tag) {
    const t = document.createElement('span');
    t.className = 'i-tag';
    t.textContent = tag;
    btn.appendChild(t);
  }
  return btn;
}

function isCustomSelected() {
  return customSeconds != null && selectedIntervalMs === customSeconds * 1000
    && !PRESETS.some(p => p.ms === selectedIntervalMs);
}

function setInterval_(ms) {
  selectedIntervalMs = ms;
  saveState();
  renderIntervals();
  rescheduleFromNow();   // a running session picks the new gap up straight away
}

function formatSeconds(sec) {
  if (sec % 60 === 0 && sec >= 60) return `${sec / 60}m`;
  return `${sec}s`;
}

// For the Custom button label: prefer minutes when the value is exact minutes.
function formatMinutes(sec) {
  if (sec % 60 === 0 && sec >= 60) return `${sec / 60} min`;
  return `${sec} sec`;
}

// ── UI: custom interval modal ────────────────────────────────────────────────

let customDraft = '';
let customUnit  = 'min'; // 'min' (default) or 'sec'

const elCustomUnitBtn = document.getElementById('custom-unit-btn');

function openCustomModal() {
  // Convert stored seconds to display unit
  if (customSeconds) {
    if (customUnit === 'min' && customSeconds % 60 === 0) {
      customDraft = String(customSeconds / 60);
    } else {
      customUnit  = 'sec';
      customDraft = String(customSeconds);
    }
  } else {
    customDraft = '';
  }
  elCustomError.textContent = '';
  renderCustomDisplay();
  elModalLayer.classList.remove('hidden');
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => elModal.focus());
}

function closeCustomModal() {
  elModalLayer.classList.add('hidden');
  document.body.classList.remove('modal-open');
  elCustomError.textContent = '';
}

function renderCustomDisplay() {
  elCustomValue.textContent = customDraft || '--';
  // Seconds were always supported, but a lone "MIN" reads as a unit label rather than a
  // control, so nobody found the switch. Show both options with the active one latched.
  elCustomUnitBtn.innerHTML = '';
  for (const u of ['sec', 'min']) {
    const span = document.createElement('span');
    span.className = 'unit-opt' + (customUnit === u ? ' on' : '');
    span.textContent = u.toUpperCase();
    elCustomUnitBtn.appendChild(span);
  }
  elCustomUnitBtn.setAttribute('aria-label',
    'Unit: ' + (customUnit === 'min' ? 'minutes' : 'seconds') + '. Tap to switch.');
}

function toggleCustomUnit() {
  const val = parseInt(customDraft, 10);
  if (customUnit === 'min') {
    customUnit  = 'sec';
    // min -> sec is exact, but the seconds field allows at most 3600.
    customDraft = (val && val > 0) ? String(Math.min(val * 60, 3600)) : '';
  } else {
    customUnit = 'min';
    // sec -> min used to blank the field for anything that wasn't a whole number of
    // minutes, so typing 90 and tapping MIN silently threw the number away. Round to the
    // nearest minute (never below 1) and keep the value.
    customDraft = (val && val > 0) ? String(Math.max(1, Math.min(360, Math.round(val / 60)))) : '';
  }
  elCustomError.textContent = '';
  renderCustomDisplay();
}

function applyKey(key) {
  const max = customUnit === 'min' ? 3 : 4; // max digits
  if (customDraft.length >= max) return;
  customDraft = customDraft === '0' ? key : customDraft + key;
  renderCustomDisplay();
}

function submitCustom() {
  const val = parseInt(customDraft, 10);
  if (customUnit === 'min') {
    if (!val || val < 1 || val > 360) {
      elCustomError.textContent = 'Enter 1 to 360 minutes.';
      return;
    }
    customSeconds = val * 60;
  } else {
    if (!val || val < 1 || val > 3600) {
      elCustomError.textContent = 'Enter 1 to 3600 seconds.';
      return;
    }
    customSeconds = val;
  }
  selectedIntervalMs = customSeconds * 1000;
  saveState();
  renderIntervals();
  rescheduleFromNow();
  closeCustomModal();
}

elCustomUnitBtn.addEventListener('click', toggleCustomUnit);

// ── UI: help modal ───────────────────────────────────────────────────────────

function openHelpModal() {
  elHelpModalLayer.classList.remove('hidden');
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => elHelpModal.focus());
}

function closeHelpModal() {
  elHelpModalLayer.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

elHelpBtn.addEventListener('click', openHelpModal);
elHelpModalDismiss.addEventListener('click', closeHelpModal);
elHelpCloseBtn.addEventListener('click', closeHelpModal);
elHelpDetailsBtn.addEventListener('click', () => {
  const nowHidden = elHelpDetails.classList.toggle('hidden');
  elHelpDetailsBtn.textContent = nowHidden ? '+ more details' : '- less';
});

// ── UI: tabs (Annoy / Settings / Info) ───────────────────────────────────────
// Pure show/hide. Defaults to Annoy on load so the countdown is visible while
// running. Table-driven so a fourth tab is one line, not another boolean.

const TABS = [
  { name: 'annoy',    tab: () => elTabAnnoy,    panel: () => elPanelAnnoy },
  { name: 'settings', tab: () => elTabSettings, panel: () => elPanelSettings },
  { name: 'info',     tab: () => elTabInfo,     panel: () => elPanelInfo },
];

function showTab(name) {
  const target = TABS.some(t => t.name === name) ? name : 'annoy';
  TABS.forEach(t => {
    const on = t.name === target;
    t.panel().classList.toggle('hidden', !on);
    t.tab().setAttribute('aria-selected', on ? 'true' : 'false');
  });
  // Jump back to the top when switching, in case the previous panel was scrolled.
  window.scrollTo(0, 0);
}

TABS.forEach(t => t.tab().addEventListener('click', () => showTab(t.name)));

// ────────────────────────────────────────────────────────────────────────────

elCustomForm.addEventListener('submit', e => { e.preventDefault(); submitCustom(); });
elKeypad.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  elCustomError.textContent = '';
  if (btn.dataset.key) applyKey(btn.dataset.key);
  else if (btn.dataset.action === 'clear') { customDraft = ''; renderCustomDisplay(); }
  else if (btn.dataset.action === 'backspace') { customDraft = customDraft.slice(0, -1); renderCustomDisplay(); }
});
elCustomCancel.addEventListener('click', closeCustomModal);
elModalDismiss.addEventListener('click', closeCustomModal);
document.addEventListener('keydown', e => {
  if (!elInstallModalLayer.classList.contains('hidden')) {
    if (e.key === 'Escape') closeInstallModal();
    return;
  }
  if (!elHelpModalLayer.classList.contains('hidden')) {
    if (e.key === 'Escape') closeHelpModal();
    return;
  }
  if (elModalLayer.classList.contains('hidden')) return;
  if (e.key === 'Escape') return closeCustomModal();
  if (e.key === 'Enter') { e.preventDefault(); return submitCustom(); }
  if (/^[0-9]$/.test(e.key)) { e.preventDefault(); elCustomError.textContent = ''; applyKey(e.key); }
  else if (e.key === 'Backspace') { e.preventDefault(); customDraft = customDraft.slice(0, -1); renderCustomDisplay(); }
});

// ── UI: randomize toggle ─────────────────────────────────────────────────────

function renderRandomize() {
  elRandomToggle.setAttribute('aria-checked', randomize ? 'true' : 'false');
  elRandomSub.textContent = randomize ? 'gaps wobble 0.75x-1.25x' : 'exact, fixed intervals';
}

elRandomToggle.addEventListener('click', () => {
  randomize = !randomize;
  saveState();
  renderRandomize();
  rescheduleFromNow();
});

// ── UI: test mode toggle ─────────────────────────────────────────────────────
// When on, tapping any sound plays it (preview) instead of arming/disarming.

function renderTestMode() {
  elTestToggle.setAttribute('aria-checked', testMode ? 'true' : 'false');
  elTestSub.textContent = testMode ? 'tap sounds to hear' : 'preview each sound';
  document.body.classList.toggle('test-mode', testMode);
  updateSoundHint();
  if (testMode && running) stopAnnoying(); // test mode exits active session
  if (!running) elHeroStatus.textContent = idleStatus();
}

function updateSoundHint() {
  elSoundHint.textContent = testMode ? '🔊 tap to hear' : 'tap to arm';
}

// Select all / Deselect all. One button, and its label states what the NEXT tap does,
// so it flips to "Deselect all" only once every sound is armed.
function allArmed() {
  return SOUNDS.length > 0 && armed.size >= SOUNDS.length;
}

function updateSelectAllBtn() {
  elSelectAllBtn.textContent = allArmed() ? 'Deselect all' : 'Select all';
}

function toggleSelectAll() {
  if (allArmed()) {
    armed.clear();
    // Never strand the app with nothing armed: UNLEASH would be dead and the reason
    // would not be obvious. Deselecting everything keeps the cat, the same floor the
    // first run starts from.
    armed.add((SOUNDS.find(x => x.id === 'cat') || SOUNDS[0]).id);
  } else {
    SOUNDS.forEach(x => armed.add(x.id));
  }
  saveState();
  SOUNDS.forEach(refreshSoundBtn);        // in place; never rebuild under the finger
  updateSelectAllBtn();
  setLaunchBtn();
  if (!running) elHeroStatus.textContent = idleStatus();
  else rescheduleFromNow();               // mid-session changes apply immediately
}

elSelectAllBtn.addEventListener('click', toggleSelectAll);

elTestToggle.addEventListener('click', () => {
  testMode = !testMode;
  saveState();
  renderTestMode();
});

// ── UI: start-with-a-sound toggle ────────────────────────────────────────────
// On  → UNLEASH fires one sound immediately (confirm it works / gauge volume).
// Off → stays silent for the first interval, so starting isn't given away.

function renderStartSound() {
  elStartToggle.setAttribute('aria-checked', startWithSound ? 'true' : 'false');
  elStartSub.textContent = startWithSound ? 'fires one instantly' : 'waits (discreet)';
}

elStartToggle.addEventListener('click', () => {
  startWithSound = !startWithSound;
  saveState();
  renderStartSound();
});

// ── Buttons: launch + test ───────────────────────────────────────────────────

elLaunch.addEventListener('click', () => { running ? stopAnnoying() : startAnnoying(); });

// Skip ahead: play a sound now and restart the countdown from this moment.
function skipNow() {
  if (!running || !audioCtx) return;
  const list = getArmedSounds();
  if (!list.length) return;
  audioCtx.resume();
  clearScheduled();
  const s = pickNextSound(list);
  const when = audioCtx.currentTime + FIRST_LEAD;   // room for the wake primer
  const entry = scheduleHit(s, when);
  if (entry) entry.fired = true;
  onFiredVisible(s);
  rememberPick(s.id);
  nextHitTime = when + (s.buffer?.duration ?? 0.5) + computeGapMs(s) / 1000;
  fillSchedule();
  updateRunningStatus();
}

elSkip.addEventListener('click', skipNow);

// Relative audio. 'input' fires continuously while dragging so the change is audible as
// you move; the write to storage is deferred to 'change' so a drag is one save, not fifty.
elVolume.addEventListener('input',  () => { volumePct = Number(elVolume.value); applyVolume(false); });
elVolume.addEventListener('change', () => { volumePct = Number(elVolume.value); applyVolume(true);  });

// ── Persistence ──────────────────────────────────────────────────────────────

// Storage keys keep their pre-rename names on purpose. localStorage is scoped to the
// ORIGIN, not the path, so reusing them carries armed sounds, interval and toggles
// across the move from /sound-annoyer/ to /poltergeist/. Renaming them would silently
// reset every setting for anyone who had used the app before.
const STATE_KEY = 'soundannoyer-state';

function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({
      armed: [...armed],
      intervalMs: selectedIntervalMs,
      customSeconds,
      randomize,
      testMode,
      startWithSound,
      volumePct,
    }));
  } catch {}
}

function loadState() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STATE_KEY)); } catch {}
  if (s && Array.isArray(s.armed)) {
    s.armed.forEach(id => { if (SOUNDS.some(x => x.id === id)) armed.add(id); });
    // Saved ids that no longer exist (a renamed sound, an older schema) used to leave the
    // app with nothing armed and no hint why. Fall back to the first-run behaviour.
    if (!armed.size && s.armed.length) armed.add((SOUNDS.find(x => x.id === 'cat') || SOUNDS[0]).id);
    if (typeof s.intervalMs === 'number') selectedIntervalMs = s.intervalMs;
    if (typeof s.customSeconds === 'number') customSeconds = s.customSeconds;
    if (typeof s.randomize === 'boolean') randomize = s.randomize;
    if (typeof s.testMode === 'boolean') testMode = s.testMode;
    if (typeof s.startWithSound === 'boolean') startWithSound = s.startWithSound;
    if (typeof s.volumePct === 'number' && isFinite(s.volumePct))
      volumePct = Math.min(100, Math.max(0, Math.round(s.volumePct)));

    // Guarantee a button is always selected: if the saved interval is neither a
    // preset nor the saved custom value, fall back to the default.
    const matchesPreset = PRESETS.some(p => p.ms === selectedIntervalMs);
    const matchesCustom = customSeconds && selectedIntervalMs === customSeconds * 1000;
    if (!matchesPreset && !matchesCustom) selectedIntervalMs = 240000;
  } else {
    // First run: arm ONE sound (the cat — the app's signature prank), not all twelve.
    // Arming everything made the grid read as "all selected" at a glance and buried the
    // fact that these are choices; starting from one makes the toggling obvious.
    armed.add((SOUNDS.find(x => x.id === 'cat') || SOUNDS[0]).id);
  }
}

// ── PWA: install ─────────────────────────────────────────────────────────────
// Android / desktop fire `beforeinstallprompt` → we trigger the native prompt.
// iOS Safari never does, so the Install button instead opens step-by-step
// "Add to Home Screen" instructions. The button always shows (so iPhone users get
// it too) unless the app is already running standalone.

let deferredPrompt = window.deferredPrompt || null;

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

// Brave matters here in a way it doesn't for an ordinary PWA. Only Chrome (on a device
// with Google Mobile Services) and Samsung Internet mint a WebAPK — a real Android app
// package. Brave, despite being Chromium and despite firing beforeinstallprompt, only
// creates a home-screen shortcut. No app-drawer entry, and — the part that actually bites
// this app — no entry under Settings → Apps, so there is no per-app battery-optimization
// toggle to set to Unrestricted. Locked-screen playback is measurably less reliable there.
let isBrave = false;
if (navigator.brave && navigator.brave.isBrave) {
  navigator.brave.isBrave().then(v => { isBrave = !!v; }).catch(() => {});
}

const INSTALLED_KEY = 'soundannoyer-installed';

function wasInstalled() {
  try { return localStorage.getItem(INSTALLED_KEY) === '1'; } catch { return false; }
}

function refreshInstallUI() {
  if (isStandalone()) {
    // Definitive: we ARE the installed app. Nothing to do here.
    elInstallBtn.textContent = '✓ Installed';
    elInstallBtn.disabled = true;
    return;
  }
  // isStandalone() is only true inside the installed app, so the ordinary tab the user
  // installed FROM used to keep offering to install something they already had. The
  // remembered appinstalled flag fixes the label — but deliberately does NOT disable the
  // button. A remembered flag can outlive the install (they uninstalled, they cleared the
  // app, they are on a second device), and a permanently dead Install button is exactly
  // the "install is broken" symptom this whole pass exists to remove.
  elInstallBtn.textContent = wasInstalled() ? '✓ Installed, install again?' : '📲 Install to Home Screen';
  elInstallBtn.disabled = false;
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();          // keep our own button in charge of the prompt
  deferredPrompt = e;
  window.deferredPrompt = e;
  // Chrome does not fire this event while the app IS installed, so receiving it proves
  // it is not — which is how the remembered flag recovers if the user uninstalls.
  try { localStorage.removeItem(INSTALLED_KEY); } catch {}
  refreshInstallUI();
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  window.deferredPrompt = null;
  try { localStorage.setItem(INSTALLED_KEY, '1'); } catch {}
  closeInstallModal();
  refreshInstallUI();
});

// Fire the browser's own install dialog. prompt() is one-shot per event instance and
// needs transient user activation, so this must run inside a click handler.
async function firePrompt() {
  const e = deferredPrompt;
  if (!e) return false;
  deferredPrompt = null;
  window.deferredPrompt = null;
  try {
    await e.prompt();
    await e.userChoice;
  } catch {
    // prompt() can reject without consuming the event (no transient activation, for
    // instance). Put it back so the next tap still gets the native dialog rather than
    // silently doing nothing.
    deferredPrompt = e;
    window.deferredPrompt = e;
    refreshInstallUI();
    return false;
  }
  refreshInstallUI();
  return true;
}

elInstallBtn.addEventListener('click', async () => {
  if (isStandalone()) return;
  // Brave DOES fire beforeinstallprompt (it is Chromium) but only ever produces a
  // home-screen shortcut. Going straight to the native dialog there would silently give
  // the user the worse outcome and they would never see the explanation, so on Brave we
  // always show the sheet first and let them choose.
  if (deferredPrompt && !isBrave) { firePrompt(); return; }
  openInstallModal();          // iOS, Brave, or no live prompt
});

// Install instructions modal (platform-specific steps).
function installSteps() {
  if (isIOS()) {
    return [
      'Open this page in Safari (not another browser).',
      'Tap the Share button, the square with an upward arrow.',
      'Choose "Add to Home Screen", then tap "Add".',
    ];
  }
  if (/android/i.test(navigator.userAgent || '')) {
    if (isBrave) {
      return [
        'Brave can only add a shortcut, not a real installed app.',
        'For reliable locked-screen sounds, open this page in Chrome instead.',
        'Then: menu (⋮) → "Install app" → Confirm.',
      ];
    }
    return [
      'Open the browser menu (⋮, top-right).',
      'Tap "Install app" or "Add to Home screen".',
      'Confirm. It installs and runs offline.',
    ];
  }
  return [
    'Click the install icon in the address bar (⊕ / a small screen icon).',
    'Or open the browser menu and choose "Install poltergeist.exe".',
    'Confirm. It opens as its own app and runs offline.',
  ];
}

function openInstallModal() {
  elInstallSummary.textContent = isBrave
    ? 'Heads up: Brave only makes a shortcut, so Android gives the app no battery '
      + 'settings of its own, so sounds are more likely to stop while the screen is off. '
      + 'Install from Chrome for the reliable version.'
    : 'Install poltergeist.exe as an app. Works fully offline, and locked-screen playback '
      + 'is more reliable once installed.';
  elInstallSteps.innerHTML = '';
  installSteps().forEach(step => {
    const li = document.createElement('li');
    li.textContent = step;
    elInstallSteps.appendChild(li);
  });
  // Only Chrome (with Google Mobile Services) and Samsung Internet mint a WebAPK — a
  // real Android package with its own app-drawer and Settings -> Apps entry, and so its
  // own battery toggle. Brave makes a bare shortcut, so offer a one-tap hop to Chrome.
  const canHopToChrome = isBrave && /android/i.test(navigator.userAgent || '');
  elOpenChromeBtn.classList.toggle('hidden', !canHopToChrome);
  // Offer the native dialog as the explicit second choice when one is available.
  elInstallProceedBtn.classList.toggle('hidden', !deferredPrompt);
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

// Reopen this exact page in Chrome. An Android `intent:` URL with an explicit package is
// the only way a web page can hand itself to another browser; if Chrome is not installed
// the intent falls through to the Play Store listing via S.browser_fallback_url.
elOpenChromeBtn.addEventListener('click', () => {
  const here = location.href.replace(/^https?:\/\//, '');
  const store = 'https://play.google.com/store/apps/details?id=com.android.chrome';
  location.href = 'intent://' + here
    + '#Intent;scheme=https;package=com.android.chrome'
    + ';S.browser_fallback_url=' + encodeURIComponent(store) + ';end';
});

// ── PWA: update + freshness (offline-safe, app-scoped) ───────────────────────
//
// The contract from context.md: never permanently stuck on a stale build when online,
// never bricked when offline. Three mechanisms, weakest-to-strongest:
//
//   1. Automatic — the service worker lifecycle. A bumped VERSION in sw.js installs a
//      new worker, which precaches with cache:'reload' and takes over; controllerchange
//      then reloads us once into the new build (never mid-session).
//   2. Self-heal — if this page's APP_VERSION and the active worker's VERSION disagree,
//      the precache is serving a shell from a different deploy. That is the failure mode
//      that used to strand the app on an old build forever. We detect it and recover.
//   3. Manual — the Update button / tappable version, below.

const CACHE_PREFIX = 'poltergeist-';     // only ever touch OUR caches: caches.keys() is
                                         // per-origin and this site hosts several apps.
const AUDIO_CACHE = CACHE_PREFIX + 'sounds';   // must match sw.js — unversioned on purpose
const DRIFT_KEY = 'soundannoyer-drift-recovered';

let swReg = null;                        // our own registration, once it resolves

let updateMsgTimer = null;
let updateBusy = false;

function flashInstallStatus(msg, isOffline) {
  if (isOffline) elOfflineBadge.classList.add('is-offline');
  elUpdateBtn.textContent = msg;
  clearTimeout(updateMsgTimer);
  updateMsgTimer = setTimeout(() => {
    elUpdateBtn.textContent = 'Update';
    elUpdateBtn.disabled = false;
    refreshOfflineBadge();
  }, 2600);
}

// navigator.onLine only reports whether a network interface exists — a captive portal,
// a dead uplink or an offline BT-only connection all still say `true`. Deleting the
// caches on that word alone would brick the installed app, so probe a real byte.
async function isReallyOnline() {
  if (navigator.onLine === false) return false;
  try {
    const r = await fetch(`./manifest.json?probe=${Date.now()}`, { cache: 'no-store' });
    return r.ok;
  } catch { return false; }
}

// Ask the controlling worker which VERSION it was built from.
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

// Tell a waiting worker to take over. controllerchange then reloads the page. If that
// never happens (the worker failed to activate), un-stick the button rather than leaving
// it disabled and saying "Updating…" forever.
function handOverToWaitingWorker(reg) {
  elUpdateBtn.textContent = 'Updating…';
  reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  setTimeout(() => {
    if (document.visibilityState !== 'hidden') flashInstallStatus('Update stalled, retry', false);
  }, 8000);
}

// A worker is still downloading. Hand over as soon as it finishes installing.
function awaitInstallThenHandOver(reg) {
  const sw = reg.installing;
  elUpdateBtn.textContent = 'Downloading…';
  sw.addEventListener('statechange', () => {
    if (sw.state === 'installed' && reg.waiting && !running) handOverToWaitingWorker(reg);
    else if (sw.state === 'redundant') flashInstallStatus('Update failed, retry', false);
  });
  setTimeout(() => {
    if (elUpdateBtn.textContent === 'Downloading…') flashInstallStatus('Still downloading…', false);
  }, 15000);
}

// What VERSION does the deployed sw.js say, right now, over the network? This does not
// trust the registration, the cache, or the running page — which is exactly the point:
// it is the one check that can still tell "you are stale" when every local signal agrees
// with itself and is simply out of date.
async function deployedVersion() {
  try {
    const r = await fetch(`./sw.js?probe=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const m = (await r.text()).match(/const VERSION\s*=\s*'([^']+)'/);
    return m ? m[1] : null;
  } catch { return null; }
}

// Last resort: drop this app's caches and registration, then reload from the network.
// Only ever called after isReallyOnline() has confirmed a live connection.
async function hardReset() {
  // Re-check first: the window between deleting the shell and re-fetching it is the one
  // moment the app has no offline copy at all, and the earlier probe may be seconds old.
  if (!await isReallyOnline()) {
    flashInstallStatus('Offline, kept cache', true);
    return;
  }
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      // Never the sounds cache: those are unchanged assets and re-fetching 1.3 MB to
      // repair a code problem is pure waste (and breaks offline until it completes).
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
      flashInstallStatus('Offline, cached ✓', true);
      return;
    }

    const reg = swReg || ('serviceWorker' in navigator
      ? await navigator.serviceWorker.getRegistration()
      : null);

    // Applying an update reloads the page, which would cut a running session dead. The
    // whole point of this app is that it keeps going until you stop it, so a stray tap
    // must never end a prank: remember the update and let stopAnnoying() apply it.
    if (running && reg && (reg.waiting || reg.installing)) {
      waitingReg = reg;
      flashInstallStatus('Update ready, press Stop', false);
      return;
    }

    // A new build may already be installed and waiting from an earlier check.
    if (reg && reg.waiting) {
      handOverToWaitingWorker(reg);
      return;                           // controllerchange reloads us
    }

    // Non-destructive first: re-check sw.js. If a newer build is deployed the worker
    // installs and waits; we then hand over. Nothing is deleted, so a connection that
    // dies mid-check leaves the app fully intact.
    if (reg) {
      await reg.update();
      if (running && (reg.installing || reg.waiting)) {
        waitingReg = reg;
        flashInstallStatus('Update ready, press Stop', false);
        return;
      }
      if (reg.waiting)    { handOverToWaitingWorker(reg); return; }
      if (reg.installing) { awaitInstallThenHandOver(reg); return; }
    }

    // No newer worker was found. Before claiming we are current, verify it against the
    // deployed file rather than against local state — the failure this whole section
    // exists for is precisely "everything local agrees, and all of it is old".
    const swVersion = await getSwVersion();
    const live = await deployedVersion();
    if ((live && live !== APP_VERSION) || (swVersion && swVersion !== APP_VERSION)) {
      elUpdateBtn.textContent = 'Repairing…';
      await hardReset();
      return;
    }

    flashInstallStatus(`Newest ✓ ${APP_VERSION}`, false);
  } catch {
    flashInstallStatus('Check failed, retry', false);
  } finally {
    updateBusy = false;
  }
}

elUpdateBtn.addEventListener('click', runUpdate);
elVersion.addEventListener('click', runUpdate);   // the "date button" checks for updates

// Offline indicator in Settings.
function refreshOfflineBadge() {
  const offline = navigator.onLine === false;
  elOfflineBadge.textContent = offline ? '⚠ offline, running cached' : '✓ works offline';
  elOfflineBadge.classList.toggle('is-offline', offline);
}
window.addEventListener('online',  refreshOfflineBadge);
window.addEventListener('offline', refreshOfflineBadge);

// Keep the Install button label in sync if the app gets installed mid-session.
window.matchMedia('(display-mode: standalone)').addEventListener?.('change', refreshInstallUI);
refreshInstallUI();
refreshOfflineBadge();

// ── Init ─────────────────────────────────────────────────────────────────────

loadState();
elVolume.value = String(volumePct);
applyVolume(false);          // sync the readout before the graph exists; safe when null
renderSounds();
updateSelectAllBtn();
renderIntervals();
renderRandomize();
renderTestMode();
renderStartSound();
setLaunchBtn();
elHeroStatus.textContent = idleStatus();

// Create the audio graph + synth buffers up front so sounds are ready and the demo
// tags render. (Playback still waits for a user gesture to resume the context.)
ensureAudio();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (running && audioCtx) {
    audioCtx.resume().catch(() => {});
    fillSchedule();
    updateRunningStatus();
    startCountdownLoop();          // rAF is stopped while hidden; restart it
  }
  applyUpdateIfSafe();             // a build that landed mid-session applies once idle
});

// Page Lifecycle: if Android froze the page anyway (e.g. audio focus was lost
// while locked), top the schedule back up the moment the page is thawed.
document.addEventListener('resume', () => {
  if (running && audioCtx) {
    audioCtx.resume().catch(() => {});
    fillSchedule();
  }
});

// ── Service worker: register + stay on the newest build ───────────────────────
//
// Deliberate design (the previous build got this subtly wrong):
//
//   The shell is served cache-first from a version-keyed cache, so index.html, app.js
//   and styles.css are only ever internally consistent *within one cache*. A worker
//   that activates mid-session therefore starts serving the NEW shell to a page still
//   running the OLD code. So sw.js does not call skipWaiting() on install; the new
//   worker sits in `waiting` until this page says it is safe to switch, and then the
//   switch and the reload happen together.
//
//   Previously the reload was the thing that got deferred while the worker switched
//   immediately — and because the deferred reload was simply dropped, an update applied
//   during a session never landed at all.

let waitingReg = null;     // registration holding a worker that is ready to take over
let pendingReload = false; // another window switched workers while we were running

// A controller already exists → an 'installed' worker is an update, not a first install.
// 'redundant' means the install failed: stay quiet, the old worker still serves the app
// and the next check retries.
function watchInstalling(reg, sw) {
  sw.addEventListener('statechange', () => {
    if (sw.state === 'installed' && navigator.serviceWorker.controller) noteUpdateReady(reg);
  });
}

// Switch to the new build — but never while sounds are running.
function applyUpdateIfSafe(delayMs = 0) {
  if (closing) return;   // shutting down; a reload would resurrect the app
  // A worker swapped in by another window: just reload once we are idle.
  if (pendingReload && !running) {
    pendingReload = false;
    setTimeout(() => {
      // A session started during the delay: put the flag back rather than dropping the
      // reload on the floor. It lands the next time we are idle.
      if (running) { pendingReload = true; return; }
      window.location.reload();
    }, delayMs);
    return;
  }
  if (!waitingReg || running) return;
  const reg = waitingReg;
  waitingReg = null;
  // The handover reloads the page. Let the "stopped - silence restored" line be read
  // first — a reload landing straight on top of it looks like a crash.
  setTimeout(() => {
    if (running) { waitingReg = reg; return; }   // a new session started: wait again
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });   // → reload
  }, delayMs);
}

function noteUpdateReady(reg) {
  if (!reg || !reg.waiting) return;
  waitingReg = reg;
  applyUpdateIfSafe();
}

if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // !hadController = the very first worker claiming a fresh page; there is no newer
    // build to reload into, and reloading here would just be a gratuitous refresh.
    if (!hadController || reloading) return;
    // Within this window we control the timing (we only send SKIP_WAITING when idle), but
    // clients.claim() also fires here when ANOTHER window applies the update. Reloading
    // then would kill a prank running in this one. The new worker has already taken over
    // either way; running the loaded page a little longer against the new cache is
    // harmless, because nothing further is fetched during a session.
    if (running) { pendingReload = true; return; }
    reloading = true;
    window.location.reload();
  });

  // updateViaCache:'none' → the sw.js script is always revalidated on update checks, so
  // a bumped VERSION is detected promptly even behind GitHub Pages' max-age=600.
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => {
    swReg = reg;

    // A worker may already be waiting from a previous visit, or already be installing
    // from the browser's own navigation update check, before any event of ours fires.
    if (reg.waiting && navigator.serviceWorker.controller) noteUpdateReady(reg);
    else if (reg.installing) watchInstalling(reg, reg.installing);

    reg.addEventListener('updatefound', () => {
      if (reg.installing) watchInstalling(reg, reg.installing);
    });

    // Check for a new build on load, on foreground and when the network comes back —
    // throttled, since each check is a real network round trip.
    let lastCheck = 0;
    const check = () => {
      if (Date.now() - lastCheck < 60000) return;
      lastCheck = Date.now();
      reg.update().catch(() => {});
    };
    check();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    window.addEventListener('online', check);
  }).catch(() => {});

  // Self-heal the stale-shell trap: if the active worker was built from a different
  // deploy than this page's JS, the cache is serving a mismatched shell. Recover once
  // per browsing session (guarded so an inconsistent deploy can't cause a reload loop).
  navigator.serviceWorker.ready.then(async () => {
    const swVersion = await getSwVersion();
    if (!swVersion || swVersion === APP_VERSION) return;
    if (running) return;
    // Remember the exact pair we tried. If a deploy really is internally inconsistent,
    // repairing cannot fix it — and retrying every launch would mean wiping the cache and
    // reloading forever. Recording the pair (not just "tried once") means a LATER, genuine
    // mismatch is still repaired.
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
