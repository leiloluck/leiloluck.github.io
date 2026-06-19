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

const APP_VERSION = 'v26.06.19';   // format vYY.MM.DD — keep in lockstep with sw.js + index.html

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

// ── Audio setup ──────────────────────────────────────────────────────────────

let audioCtx    = null;
let gainNode    = null;
let audioEl     = null;
let mediaSource = null;

let bellBuffer  = null;            // decoded PCM for interval beats + end-of-session bells
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

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
  fetch('./resources/Single bowl sound.mp3')
    .then(r => r.arrayBuffer())
    .then(buf => audioCtx.decodeAudioData(buf))
    .then(decoded => {
      bellBuffer = decoded;
      if ((state === 'playing' || state === 'finishing') && audioCtx && startTimestamp !== null) {
        const elapsed = elapsedMs + (performance.now() - startTimestamp);
        const remaining = Math.max(0, sessionDurationMs - elapsed);
        if (remaining > 0) {
          clearScheduledSources();
          scheduleAudioFrom(remaining, true);
        }
      }
    })
    .catch(() => {});
}

// Schedule one bell strike at an absolute AudioContext time.
//   throughGain  true  → routed through the fade gain (interval beats fade in/out)
//   throughGain  false → routed straight to the output (end bells always full volume)
//   detuneCents        → optional pitch offset in cents (0 = no change)
function scheduleHit(ctxTime, throughGain, detuneCents = 0) {
  if (!audioCtx || !bellBuffer) return;
  const src = audioCtx.createBufferSource();
  src.buffer = bellBuffer;
  if (detuneCents !== 0) src.detune.value = detuneCents;
  src.connect(throughGain ? gainNode : audioCtx.destination);
  src.start(ctxTime);
  src.onended = () => { scheduledSources = scheduledSources.filter(s => s !== src); };
  scheduledSources.push(src);
}

// Stop and forget every source we scheduled ahead (used on pause / stop / sound switch).
function clearScheduledSources() {
  scheduledSources.forEach(s => {
    try { s.stop(); } catch {}
    try { s.disconnect(); } catch {}
  });
  scheduledSources = [];
}

// A silent looping buffer keeps the AudioContext from being suspended between
// events while the screen is locked — important for 'interval' mode, which has
// no continuously-playing media element of its own.
function startKeepAlive() {
  if (!audioCtx) return;
  stopKeepAlive();
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
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
// exactly the case in 'interval' mode (no looping soundtrack). A Web Audio silent
// buffer is not enough to hold the audio session open on iOS; a real, playing
// <audio> element is. So we generate a tiny silent WAV (as a blob: URL, since the
// CSP allows blob: but not data: for media) and loop it silently for the whole
// interval session. This keeps the session — and therefore the scheduled bells —
// alive while the screen is locked.

function makeSilentWavBlob(seconds = 1, sampleRate = 8000) {
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
  view.setUint32(40, numSamples * 2, true); // samples left zero-filled → silence
  return new Blob([view], { type: 'audio/wav' });
}

function ensureSilentEl() {
  if (silentEl) return;
  silentUrl = URL.createObjectURL(makeSilentWavBlob());
  silentEl = new Audio(silentUrl);
  silentEl.loop = true;
  // Played directly (not through the AudioContext): its only job is to keep the
  // platform audio session active so the context's scheduled bells keep firing.
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
  const remSec  = remainingMs / 1000;
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
      if (when >= t0 - 0.001) {
        scheduleHit(Math.max(t0, when), true, randn() * BELL_DETUNE_SD);
      }
    }
  }

  // ── Triple end bell (full volume, bypassing the fade) ──
  END_BELL_OFFSETS.forEach(off => scheduleHit(t0 + remSec + off, false));
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
  clearScheduledSources();
  ensureAudio();
  audioCtx.resume();

  sessionDurationMs = selectedMinutes * 60 * 1000;
  elapsedMs = 0;
  state = 'playing';
  startTimestamp = performance.now();

  startKeepAlive();
  if (selectedSound.type === 'loop') {
    audioEl.currentTime = 0;
    audioEl.play().catch(() => {});
  } else {
    // Interval mode has no looping media element — keep the iOS session alive.
    startSilentKeepAlive();
  }

  setMediaSession();
  updateMediaPosition();
  navigator.mediaSession && (navigator.mediaSession.playbackState = 'playing');

  scheduleAudioFrom(sessionDurationMs, false);

  setPlayBtn('pause');
  setStatus('');

  rafId = requestAnimationFrame(tick);
}

function pauseSession() {
  if (state !== 'playing' && state !== 'finishing') return;

  elapsedMs += (performance.now() - startTimestamp);
  cancelAnimationFrame(rafId);
  clearTimeout(bgFadeTimeout);
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

  startKeepAlive();
  if (selectedSound.type === 'loop') {
    if (audioEl.paused) audioEl.play().catch(() => {});
  } else {
    startSilentKeepAlive();
  }

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

  setTimeout(() => {
    if (audioEl) audioEl.pause();
    stopKeepAlive();
    stopSilentKeepAlive();
    if (gainNode) {
      gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    }
    navigator.mediaSession && (navigator.mediaSession.playbackState = 'none');
    resetUI();
    document.body.classList.remove('session-complete');
    setStatus('session complete');
    setTimeout(() => setStatus(''), 3000);
  }, 3500);
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
  navigator.mediaSession.setActionHandler('pause', pauseSession);
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
  const savedMin = parseInt(localStorage.getItem(CUSTOM_KEY), 10);
  if (!savedMin || savedMin < 1 || savedMin > 180) return null;
  return savedMin;
}

function saveCustomTime(min) {
  localStorage.setItem(CUSTOM_KEY, String(min));
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
const elCustomModalLayer = document.getElementById('custom-modal-layer');
const elCustomModal = document.getElementById('custom-modal');
const elCustomModalDismiss = document.getElementById('custom-modal-dismiss');
const elCustomDurationForm = document.getElementById('custom-duration-form');
const elCustomDurationValue = document.getElementById('custom-duration-value');
const elCustomDurationError = document.getElementById('custom-duration-error');
const elCustomDurationCancel = document.getElementById('custom-duration-cancel');
const elCustomKeypad = document.querySelector('.custom-keypad');

let customDurationDraft = '';

function updateCountdown(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  elCountdown.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function showIdleCountdown() {
  const m = String(Math.floor(selectedMinutes)).padStart(2, '0');
  elCountdown.textContent = `${m}:00`;
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
      if (audioEl) {
        clearScheduledSources();
        stopKeepAlive();
        stopSilentKeepAlive();
        audioEl.pause();
        audioEl = null; mediaSource = null; gainNode = null;
        if (audioCtx) { audioCtx.close(); audioCtx = null; }
        bellBuffer = null;
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
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
}

function isIOS() {
  const ua = navigator.userAgent || '';
  // iPadOS 13+ reports as desktop Safari, so also treat touch-capable Mac as iOS.
  return /iphone|ipad|ipod/i.test(ua)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function refreshInstallUI() {
  if (isStandalone()) {
    elInstallBtn.textContent = '✓ Installed';
    elInstallBtn.disabled = true;
  } else {
    elInstallBtn.textContent = 'Install app';
    elInstallBtn.disabled = false;
  }
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();          // keep our own button in charge of the prompt
  deferredInstallPrompt = e;
  window.deferredInstallPrompt = e;
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  closeInstallModal();
  refreshInstallUI();
});

elInstallBtn.addEventListener('click', async () => {
  if (isStandalone()) return;
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    refreshInstallUI();
  } else {
    openInstallModal();        // iOS, or Android/desktop with no live prompt
  }
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

// ── PWA: update (offline-safe) ───────────────────────────────────────────────
// Online  → wipe caches + service workers and reload to the freshest build.
// Offline → do NOTHING destructive (wiping with no network would brick the app);
//           just confirm we're still running from the offline cache.

let updateMsgTimer = null;

function flashUpdateMsg(msg) {
  elUpdateBtn.textContent = msg;
  clearTimeout(updateMsgTimer);
  updateMsgTimer = setTimeout(() => { elUpdateBtn.textContent = 'Update'; }, 2600);
}

async function runUpdate() {
  if (navigator.onLine === false) {
    flashUpdateMsg('Offline — cached ✓');
    return;
  }
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
}

elUpdateBtn.addEventListener('click', runUpdate);
elVersion.addEventListener('click', runUpdate);   // tappable version checks for updates

// ── Offline audio download ───────────────────────────────────────────────────

const AUDIO_CACHED_KEY = 'meditation-audio-cached';

async function isAudioCached() {
  if (!('caches' in window)) return false;
  try {
    const names = await caches.keys();
    for (const name of names) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      if (keys.some(r => r.url.includes('.mp3'))) return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function initOfflineBtn() {
  if (localStorage.getItem(AUDIO_CACHED_KEY) === '1' || await isAudioCached()) {
    markAudioReady();
    return;
  }
  elOfflineBtn.classList.remove('hidden');
}

function markAudioReady() {
  elOfflineBtn.textContent = 'Audio offline ✓';
  elOfflineBtn.disabled = true;
  elOfflineBtn.classList.remove('hidden');
  localStorage.setItem(AUDIO_CACHED_KEY, '1');
}

elOfflineBtn.addEventListener('click', async () => {
  // Download every audio file so the full app (incl. the long soundtrack) works
  // without a connection. The app shell itself is already cached by the SW; this
  // pulls in the large .mp3s, which are too big to precache on install.
  elOfflineBtn.textContent = 'Downloading…';
  elOfflineBtn.disabled = true;
  try {
    const audioUrls = [...new Set(SOUNDS.map(s => s.file).concat(['./resources/Single bowl sound.mp3']))];
    await Promise.all(audioUrls.map(async url => {
      const resp = await fetch(new Request(url));
      if (!resp.ok) throw new Error('fetch failed');
      await resp.arrayBuffer();
    }));
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

// ── Service worker: register + keep the app up to date ────────────────────────
// The SW (see sw.js) is cache-first / offline-first for the app shell. Freshness
// comes from the worker lifecycle: we pull in a new worker promptly and reload the
// page once when it takes control — never mid-session.

if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;       // first install claiming the page — nothing to reload to
    if (refreshing) return;
    if (state !== 'idle') return;     // never interrupt a running meditation
    refreshing = true;
    window.location.reload();
  });

  // updateViaCache:'none' → the sw.js script is always revalidated on update checks,
  // so a bumped VERSION is detected promptly even behind GitHub Pages' HTTP caching.
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => {
    reg.update();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update();
    });
  }).catch(() => {});
}
