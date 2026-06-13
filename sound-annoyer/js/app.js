/* app.js — SoundAnnoyer
   Fires prank sounds through a (Bluetooth) speaker at random intervals while the
   phone is locked. See ../context.md for the full brief.

   Locked-screen reliability:
   setTimeout / requestAnimationFrame are throttled or frozen when the screen is
   off, so they cannot drive playback. Every upcoming sound is therefore
   PRE-SCHEDULED on the AudioContext hardware clock via source.start(when) — that
   clock keeps running while locked. We schedule out to a horizon and top it up
   whenever the app gets CPU again (visible / heartbeat).

   Bluetooth standby:
   BT speakers drop to standby when idle and clip the start of the next sound. Two
   defences — (1) a continuous SILENT keep-alive stream holds the audio output / BT
   link open without making any sound (an active stream of digital silence is enough
   to stop the link going idle, and it stays inaudible even at high speaker volume),
   and (2) a short "wake primer" tone is scheduled just before every real sound so a
   speaker that did doze off is awake by the time the sound plays. */

'use strict';

const APP_VERSION = 'v10.06.11';

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
  { ms: 30000,   label: '30s', tag: '' },
  { ms: 60000,   label: '1m',  tag: '' },
  { ms: 120000,  label: '2m',  tag: '' },
  { ms: 240000,  label: '4m',  tag: '' },
  { ms: 360000,  label: '6m',  tag: '' },
  { ms: 480000,  label: '8m',  tag: '' },
  { ms: 600000,  label: '10m', tag: '' },
  { ms: 1200000, label: '20m', tag: '' },
];

// ── Scheduling constants ─────────────────────────────────────────────────────

const PRIMER_LEAD  = 0.6;     // s — wake primer fires this long before each sound
const HORIZON_SEC  = 1800;    // schedule up to 30 min ahead (survives a locked screen)
const MAX_AHEAD    = 180;     // …but never queue more than this many hits at once
const MIN_GAP_MS   = 1500;    // floor so randomization can't bunch sounds up
const PRIMER_AMP   = 0.05;    // quiet BT wake blip (only fires briefly before a sound)
const PRIMER_FREQ  = 120;     // Hz — low, felt more than heard
const PRIMER_DUR   = 0.13;    // s

// ── State ────────────────────────────────────────────────────────────────────

let running       = false;
let selectedIntervalMs = 30000;
let customSeconds = null;
let randomize     = true;
let testMode      = false;       // when on, tapping a sound previews it (no arm/disarm)
let startWithSound = true;       // UNLEASH fires one sound at once (vs. a discreet start)
const armed       = new Set();   // ids of active sounds

let audioCtx     = null;
let masterGain   = null;
let primerGain   = null;
let primerBuffer = null;
let keepAliveSrc = null;
let silentEl     = null;
let silentUrl    = null;

let scheduled        = [];   // { soundSrc, primerSrc, when, soundId }
let nextHitTime      = 0;    // ctx time of the next hit still to be scheduled
let lastScheduledId  = null; // anti-repeat
let heartbeatId      = null;

// ── Audio setup ──────────────────────────────────────────────────────────────

function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 1;
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
      renderSounds();
    })
    .catch(() => loadFirstAvailable(sound, i + 1));
}

// ── Keep-alive ───────────────────────────────────────────────────────────────
// Holds the audio output (and the BT link) open between sounds so scheduled events
// keep firing while locked. Completely SILENT — never audible, even at high volume.

function startKeepAlive() {
  if (!audioCtx) return;
  stopKeepAlive();

  // A zero-filled looping buffer: an active stream of digital silence keeps the
  // output device / Bluetooth link from going idle, while producing no sound at all.
  // (Earlier builds mixed low-level noise in here; cranked up on a speaker that
  // turned into audible hiss. The per-sound primer in scheduleHit() does the actual
  // speaker wake-up now.)
  const sr  = audioCtx.sampleRate;
  const buf = audioCtx.createBuffer(1, sr * 2, sr); // zero-filled = pure silence

  keepAliveSrc = audioCtx.createBufferSource();
  keepAliveSrc.buffer = buf;
  keepAliveSrc.loop = true;
  keepAliveSrc.connect(audioCtx.destination);
  keepAliveSrc.start();

  // A real, playing <audio> element keeps the platform audio session alive where a
  // Web Audio buffer alone is not enough (notably iOS). Cheap insurance.
  startSilentEl();
}

function stopKeepAlive() {
  if (keepAliveSrc) {
    try { keepAliveSrc.stop(); } catch {}
    try { keepAliveSrc.disconnect(); } catch {}
    keepAliveSrc = null;
  }
  if (silentEl) silentEl.pause();
}

function startSilentEl() {
  if (!silentEl) {
    silentUrl = URL.createObjectURL(makeSilentWavBlob());
    silentEl = new Audio(silentUrl);
    silentEl.loop = true;
  }
  silentEl.currentTime = 0;
  silentEl.play().catch(() => {});
}

function makeSilentWavBlob(seconds = 1, sampleRate = 8000) {
  const n = Math.floor(seconds * sampleRate);
  const buffer = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buffer);
  const w = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); view.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); w(36, 'data');
  view.setUint32(40, n * 2, true); // samples left zero → silence
  return new Blob([view], { type: 'audio/wav' });
}

// ── Scheduling ───────────────────────────────────────────────────────────────

function computeGapMs() {
  const base = selectedIntervalMs;
  const gap = randomize ? base * (0.75 + Math.random() * 0.5) : base;
  return Math.max(MIN_GAP_MS, gap);
}

function getArmedSounds() {
  return SOUNDS.filter(s => armed.has(s.id) && s.buffer);
}

function pickNextSound(list) {
  if (list.length === 1) return list[0];
  let pick;
  do { pick = list[Math.floor(Math.random() * list.length)]; }
  while (pick.id === lastScheduledId);
  return pick;
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
    if (document.visibilityState === 'visible') onFiredVisible(sound);
    fillSchedule();   // top up as each one completes (foreground)
  };
  scheduled.push(entry);
}

// Fill the schedule out to the horizon (bounded by MAX_AHEAD).
function fillSchedule() {
  if (!running || !audioCtx) return;

  const now = audioCtx.currentTime;
  scheduled = scheduled.filter(e => e.when > now - 1);

  const list = getArmedSounds();
  if (list.length === 0) { stopAnnoying(); return; }

  while (nextHitTime < now + HORIZON_SEC && scheduled.length < MAX_AHEAD) {
    const sound = pickNextSound(list);
    scheduleHit(sound, nextHitTime);
    lastScheduledId = sound.id;
    nextHitTime += computeGapMs() / 1000;
  }
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

  running = true;
  document.body.classList.add('running');
  lastScheduledId = null;
  clearScheduled();
  startKeepAlive();
  setMediaSession();

  if (startWithSound) {
    // Fire one sound right away (confirms it works / lets you gauge the volume).
    const first     = pickNextSound(list);
    const firstWhen = audioCtx.currentTime + 0.1;
    scheduleHit(first, firstWhen);
    onFiredVisible(first);
    lastScheduledId = first.id;
    nextHitTime = firstWhen + (first.buffer?.duration ?? 0.5) + computeGapMs() / 1000;
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
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';

  setLaunchBtn();
  elHeroStatus.textContent = 'stopped - silence restored';
  elHeroSub.textContent = '';
  elHeroEmoji.textContent = '😼';
}

function startHeartbeat() {
  stopHeartbeat();
  // Foreground tick: tops up the schedule and updates the countdown. Throttled when
  // locked, which is fine — the pre-scheduled horizon carries the locked screen.
  heartbeatId = setInterval(() => {
    if (!running) return;
    audioCtx.resume();
    fillSchedule();
    updateRunningStatus();
  }, 1000);
}

function stopHeartbeat() {
  if (heartbeatId) { clearInterval(heartbeatId); heartbeatId = null; }
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
  scheduleHit(sound, audioCtx.currentTime + PRIMER_LEAD + 0.05);
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

function setMediaSession() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title:  'SoundAnnoyer',
    artist: 'armed & dangerous',
    album:  'chaos incoming',
    artwork: [
      { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  });
  navigator.mediaSession.playbackState = 'playing';
  navigator.mediaSession.setActionHandler('play',  startAnnoying);
  navigator.mediaSession.setActionHandler('pause', stopAnnoying);
  navigator.mediaSession.setActionHandler('stop',  stopAnnoying);
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
const elHeroStatus  = document.getElementById('hero-status');
const elHeroSub     = document.getElementById('hero-sub');
const elLaunch      = document.getElementById('btn-launch');
const elSoundGroup  = document.getElementById('sound-group');
const elSoundHint   = document.getElementById('sound-hint');
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
  if (testMode) return 'test mode - tap a sound to hear it';
  return getArmedSoundsCount() === 0 ? 'arm at least one sound' : 'idle - ready when you are';
}

function getArmedSoundsCount() {
  return SOUNDS.filter(s => armed.has(s.id)).length;
}

function updateRunningStatus() {
  if (!running) return;
  elHeroStatus.textContent = 'ARMED - chaos incoming';
  const now = audioCtx.currentTime;
  const upcoming = scheduled
    .map(e => e.when)
    .filter(w => w > now)
    .sort((a, b) => a - b)[0];
  if (upcoming) {
    elHeroSub.textContent = `next sound in ~${Math.ceil(upcoming - now)}s`;
  } else {
    elHeroSub.textContent = 'scheduling…';
  }
}

function onFiredVisible(sound) {
  elHeroEmoji.textContent = sound.emoji;
  document.body.classList.remove('fired');
  void document.body.offsetWidth; // restart the animation
  document.body.classList.add('fired');
  setTimeout(() => document.body.classList.remove('fired'), 380);
}

function setLaunchBtn() {
  elLaunch.textContent = running ? 'STOP THE MADNESS' : 'UNLEASH';
}

// ── UI: sound buttons ────────────────────────────────────────────────────────

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
    elSoundGroup.appendChild(btn);
  });
}

function toggleSound(id) {
  if (armed.has(id)) armed.delete(id); else armed.add(id);
  saveState();
  renderSounds();
  setLaunchBtn();
  if (!running) elHeroStatus.textContent = idleStatus();
  // Live update: if running, the change is picked up on the next fill cycle anyway.
}

// ── UI: interval buttons ─────────────────────────────────────────────────────

function renderIntervals() {
  elIntervalGroup.innerHTML = '';

  PRESETS.forEach(p => {
    const btn = makeIntervalBtn(p.label, p.tag, selectedIntervalMs === p.ms && !isCustomSelected());
    btn.addEventListener('click', () => setInterval_(p.ms, false));
    elIntervalGroup.appendChild(btn);
  });

  // Custom cell - spans the full row
  const label = customSeconds ? formatMinutes(customSeconds) : 'Custom';
  const tag = customSeconds ? 'custom' : 'set';
  const btn = makeIntervalBtn(label, tag, isCustomSelected());
  btn.style.gridColumn = '1 / -1';
  btn.addEventListener('click', openCustomModal);
  elIntervalGroup.appendChild(btn);
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

function setInterval_(ms, isCustom) {
  selectedIntervalMs = ms;
  saveState();
  renderIntervals();
}

function formatSeconds(sec) {
  if (sec % 60 === 0 && sec >= 60) return `${sec / 60}m`;
  return `${sec}s`;
}

// For the Custom button label: prefer minutes when the value is exact minutes.
function formatMinutes(sec) {
  if (sec % 60 === 0 && sec >= 60) return `${sec / 60}m`;
  return `${sec}s`;
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
  elCustomUnitBtn.textContent = customUnit === 'min' ? 'MIN' : 'SEC';
}

function toggleCustomUnit() {
  const val = parseInt(customDraft, 10);
  if (customUnit === 'min') {
    customUnit  = 'sec';
    customDraft = (val && val > 0) ? String(val * 60) : '';
  } else {
    const secs = val && val > 0 ? val : 0;
    if (secs > 0 && secs % 60 === 0) {
      customUnit  = 'min';
      customDraft = String(secs / 60);
    } else {
      customUnit  = 'min';
      customDraft = '';
    }
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

// ── Persistence ──────────────────────────────────────────────────────────────

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
    }));
  } catch {}
}

function loadState() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(STATE_KEY)); } catch {}
  if (s && Array.isArray(s.armed)) {
    s.armed.forEach(id => { if (SOUNDS.some(x => x.id === id)) armed.add(id); });
    if (typeof s.intervalMs === 'number') selectedIntervalMs = s.intervalMs;
    if (typeof s.customSeconds === 'number') customSeconds = s.customSeconds;
    if (typeof s.randomize === 'boolean') randomize = s.randomize;
    if (typeof s.testMode === 'boolean') testMode = s.testMode;
    if (typeof s.startWithSound === 'boolean') startWithSound = s.startWithSound;
  } else {
    // First run: arm everything, 30s, chaos on — works out of the box.
    SOUNDS.forEach(x => armed.add(x.id));
  }
}

// ── PWA: install + update ────────────────────────────────────────────────────

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  elInstallBtn.classList.remove('hidden');
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  elInstallBtn.classList.add('hidden');
});

elInstallBtn.addEventListener('click', async () => {
  if (!deferredPrompt) { elInstallBtn.classList.add('hidden'); return; }
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  elInstallBtn.classList.add('hidden');
});

// Hard update: wipe caches + service workers, then reload to the freshest build.
elUpdateBtn.addEventListener('click', async () => {
  elUpdateBtn.textContent = 'Updating…';
  elUpdateBtn.disabled = true;
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch {}
  window.location.reload();
});

// ── Init ─────────────────────────────────────────────────────────────────────

loadState();
renderSounds();
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
  if (document.visibilityState === 'visible' && running && audioCtx) {
    audioCtx.resume();
    fillSchedule();
    updateRunningStatus();
  }
});

// ── Service worker: register + stay on the newest build ───────────────────────
// network-first shell (sw.js) means an online launch fetches the freshest files.
// We also pull a new worker promptly and reload once when it takes control —
// never mid-session.

if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing || running) return;
    refreshing = true;
    window.location.reload();
  });

  navigator.serviceWorker.register('./sw.js').then(reg => {
    reg.update();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update();
    });
  }).catch(() => {});
}
