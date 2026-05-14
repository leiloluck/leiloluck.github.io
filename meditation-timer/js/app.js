/* app.js — Meditation Timer
   Audio engine (Web Audio API), drift-free timer, Media Session, custom time, PWA. */

'use strict';

// ── Sound catalogue ──────────────────────────────────────────────────────────
//
// type: 'loop'     — audio element loops continuously throughout the session.
// type: 'interval' — sound plays once per intervalMs. Looping is managed by the
//                    beat scheduler below, not by the audio element itself.

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

// ── State ────────────────────────────────────────────────────────────────────

let selectedSound     = SOUNDS[0];
let selectedMinutes   = 15;
let state             = 'idle';   // idle | playing | paused | finishing
let sessionDurationMs = 0;
let elapsedMs         = 0;
let startTimestamp    = null;
let rafId             = null;
let fadeOutTimeout    = null;
let bgFadeTimeout     = null;      // delayed audio.pause() after user-initiated fade-out
let intervalBeatTimeout = null;    // pending next beat for 'interval' sounds

// ── Audio setup ──────────────────────────────────────────────────────────────

let audioCtx    = null;
let gainNode    = null;
let audioEl     = null;
let mediaSource = null;

let dongAudio1  = null;
let dongAudio2  = null;
let dongAudio3  = null;

function ensureAudio() {
  if (audioEl) return;

  audioEl = new Audio();
  audioEl.crossOrigin = 'anonymous';
  audioEl.src = selectedSound.file;
  audioEl.loop = selectedSound.type === 'loop';
  audioEl.preload = 'metadata';

  dongAudio1 = new Audio('./resources/Single bowl sound.mp3');
  dongAudio1.preload = 'auto';
  dongAudio2 = new Audio('./resources/Single bowl sound.mp3');
  dongAudio2.preload = 'auto';
  dongAudio3 = new Audio('./resources/Single bowl sound.mp3');
  dongAudio3.preload = 'auto';

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  mediaSource = audioCtx.createMediaElementSource(audioEl);
  gainNode = audioCtx.createGain();
  gainNode.gain.value = 0;
  mediaSource.connect(gainNode);
  gainNode.connect(audioCtx.destination);
}

// ── Timer loop ───────────────────────────────────────────────────────────────

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

// ── Interval beat scheduler ──────────────────────────────────────────────────
// Used only when selectedSound.type === 'interval'.
// Plays the sound at t=0, then every intervalMs thereafter.
// The gain node (shared with loop sounds) controls all fade in/out.

function playIntervalBeat() {
  audioEl.currentTime = 0;
  if (audioEl.paused) audioEl.play().catch(() => {});
}

function scheduleIntervalBeat(delayMs) {
  intervalBeatTimeout = setTimeout(() => {
    if (state !== 'playing') return;
    playIntervalBeat();
    scheduleIntervalBeat(selectedSound.intervalMs);
  }, delayMs);
}

function startIntervalBeats() {
  playIntervalBeat();
  scheduleIntervalBeat(selectedSound.intervalMs);
}

// Called on resume. Determines whether the sound should be mid-play or silent,
// then fires the next beat at the correct time within the current cycle.
function resumeIntervalBeats() {
  const positionMs = elapsedMs % selectedSound.intervalMs;
  const audioDurationMs = isFinite(audioEl.duration) ? audioEl.duration * 1000 : 0;

  if (positionMs < audioDurationMs && audioEl.paused) {
    audioEl.play().catch(() => {});
  }

  scheduleIntervalBeat(selectedSound.intervalMs - positionMs);
}

// ── Session lifecycle ────────────────────────────────────────────────────────

function startSession() {
  if (state !== 'idle') return;

  clearTimeout(bgFadeTimeout);
  ensureAudio();
  audioCtx.resume();

  sessionDurationMs = selectedMinutes * 60 * 1000;
  elapsedMs = 0;

  const fades = scaledFades(sessionDurationMs);

  gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + fades.in);

  if (selectedSound.type === 'interval') {
    startIntervalBeats();
  } else {
    audioEl.currentTime = 0;
    audioEl.play().catch(() => {});
  }

  setMediaSession();
  navigator.mediaSession && (navigator.mediaSession.playbackState = 'playing');

  state = 'playing';
  startTimestamp = performance.now();

  scheduleUnfadeOut(sessionDurationMs, fades.out);

  setPlayBtn('pause');
  setStatus('');

  rafId = requestAnimationFrame(tick);
}

function pauseSession() {
  if (state !== 'playing' && state !== 'finishing') return;

  elapsedMs += (performance.now() - startTimestamp);
  cancelAnimationFrame(rafId);
  clearTimeout(fadeOutTimeout);
  clearTimeout(bgFadeTimeout);
  clearTimeout(intervalBeatTimeout);

  gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
  gainNode.gain.setValueAtTime(Math.max(gainNode.gain.value, 0.001), audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + PAUSE_FADE_OUT);
  bgFadeTimeout = setTimeout(() => {
    if (state === 'paused') {
      audioEl.pause();
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

  if (selectedSound.type === 'interval') {
    resumeIntervalBeats();
  } else {
    if (audioEl.paused) audioEl.play().catch(() => {});
  }

  navigator.mediaSession && (navigator.mediaSession.playbackState = 'playing');
  state = 'playing';

  const remainingMs = sessionDurationMs - elapsedMs;
  const fades = scaledFades(sessionDurationMs);

  gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
  gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);

  if (elapsedMs < fades.in * 1000) {
    const timeLeft = Math.max(RESUME_FADE_IN, fades.in - elapsedMs / 1000);
    gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + timeLeft);
  } else {
    gainNode.gain.exponentialRampToValueAtTime(1, audioCtx.currentTime + RESUME_FADE_IN);
  }

  scheduleUnfadeOut(remainingMs, fades.out);

  startTimestamp = performance.now();
  setPlayBtn('pause');
  setStatus('');
  rafId = requestAnimationFrame(tick);
}

function stopSession() {
  if (state === 'idle') return;

  cancelAnimationFrame(rafId);
  clearTimeout(fadeOutTimeout);
  clearTimeout(bgFadeTimeout);
  clearTimeout(intervalBeatTimeout);

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
  } else {
    audioEl && audioEl.pause();
  }

  resetUI();
}

function onSessionEnd() {
  cancelAnimationFrame(rafId);
  clearTimeout(fadeOutTimeout);
  clearTimeout(intervalBeatTimeout);
  state = 'finishing';

  document.body.classList.add('session-complete');

  // Triple bell — all three within one second
  if (dongAudio1) {
    dongAudio1.currentTime = 0;
    dongAudio1.play().catch(() => {});
  }
  setTimeout(() => {
    if (dongAudio2) {
      dongAudio2.currentTime = 0;
      dongAudio2.play().catch(() => {});
    }
  }, 400);
  setTimeout(() => {
    if (dongAudio3) {
      dongAudio3.currentTime = 0;
      dongAudio3.play().catch(() => {});
    }
  }, 800);

  // Fade-out ramp is already running via scheduleUnfadeOut.
  // Clean up sooner after the bells finish.
  setTimeout(() => {
    if (audioEl) audioEl.pause();
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

function scheduleUnfadeOut(remainingMs, fadeOutSec) {
  const delayMs = Math.max(0, remainingMs - fadeOutSec * 1000);
  fadeOutTimeout = setTimeout(() => {
    if (state !== 'playing') return;
    state = 'finishing';
    gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + fadeOutSec);
    setPlayBtn('disabled');
  }, delayMs);
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

// ── Custom time (localStorage) ───────────────────────────────────────────────

const CUSTOM_KEY = 'meditation-custom-min';

function loadCustomTime() {
  return parseInt(localStorage.getItem(CUSTOM_KEY), 10) || null;
}

function saveCustomTime(min) {
  localStorage.setItem(CUSTOM_KEY, String(min));
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
const elOfflineBtn    = document.getElementById('offline-btn');
const elCustomModalLayer = document.getElementById('custom-modal-layer');
const elCustomModalDismiss = document.getElementById('custom-modal-dismiss');
const elCustomDurationForm = document.getElementById('custom-duration-form');
const elCustomDurationInput = document.getElementById('custom-duration-input');
const elCustomDurationError = document.getElementById('custom-duration-error');
const elCustomDurationCancel = document.getElementById('custom-duration-cancel');

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
        audioEl.pause();
        audioEl = null; mediaSource = null; gainNode = null;
        if (audioCtx) { audioCtx.close(); audioCtx = null; }
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
    btn.textContent = `${min} min`;
    btn.addEventListener('click', () => {
      if (state !== 'idle') stopSession();
      selectedMinutes = min;
      renderDurations();
      showIdleCountdown();
    });
    elDurationGroup.appendChild(btn);
  });

  appendCustomBtn();
}

function appendCustomBtn() {
  const savedMin = loadCustomTime();
  const isCustomSelected = savedMin && !PRESETS.includes(savedMin) && selectedMinutes === savedMin;

  const btn = document.createElement('button');
  btn.className = 'btn' + (isCustomSelected ? ' selected' : '');
  btn.type = 'button';
  btn.dataset.custom = 'true';

  const label = document.createElement('span');
  label.textContent = 'Custom';
  btn.appendChild(label);

  if (savedMin) {
    const sub = document.createElement('span');
    sub.className = 'btn-detail';
    sub.textContent = `${savedMin} min`;
    btn.appendChild(sub);
  }

  btn.addEventListener('click', () => {
    if (state !== 'idle') stopSession();
    openCustomTimeModal(savedMin);
  });

  elDurationGroup.appendChild(btn);
}

function openCustomTimeModal(currentMin) {
  const activeCustomMin = !PRESETS.includes(selectedMinutes) ? selectedMinutes : currentMin;

  elCustomDurationInput.value = activeCustomMin ? String(activeCustomMin) : '';
  elCustomDurationError.textContent = '';
  elCustomModalLayer.classList.remove('hidden');
  document.body.classList.add('modal-open');

  requestAnimationFrame(() => {
    elCustomDurationInput.focus();
    elCustomDurationInput.select();
  });
}

function closeCustomTimeModal() {
  elCustomModalLayer.classList.add('hidden');
  document.body.classList.remove('modal-open');
  elCustomDurationError.textContent = '';
}

function submitCustomTime() {
  const val = parseInt(elCustomDurationInput.value, 10);

  if (!val || val < 1 || val > 180) {
    elCustomDurationError.textContent = 'Enter a whole number between 1 and 180.';
    elCustomDurationInput.focus();
    elCustomDurationInput.select();
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

elCustomDurationCancel.addEventListener('click', closeCustomTimeModal);
elCustomModalDismiss.addEventListener('click', closeCustomTimeModal);

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !elCustomModalLayer.classList.contains('hidden')) {
    closeCustomTimeModal();
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

// ── PWA install ──────────────────────────────────────────────────────────────

const INSTALLED_KEY = 'meditation-pwa-installed';
let deferredInstallPrompt = null;

const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true ||
  localStorage.getItem(INSTALLED_KEY) === '1';

if (isStandalone) showUpdateBtn();

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!isStandalone) showInstallBtn();
});

window.addEventListener('appinstalled', () => {
  localStorage.setItem(INSTALLED_KEY, '1');
  deferredInstallPrompt = null;
  showUpdateBtn();
});

function showInstallBtn() {
  elInstallBtn.textContent = 'Install';
  elInstallBtn.classList.remove('hidden');
}

function showUpdateBtn() {
  elInstallBtn.textContent = 'Update';
  elInstallBtn.classList.remove('hidden');
}

elInstallBtn.addEventListener('click', async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const result = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (result.outcome === 'accepted') showUpdateBtn();
  } else {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    window.location.reload();
  }
});

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
  elOfflineBtn.textContent = 'Downloading…';
  elOfflineBtn.disabled = true;
  try {
    const resp = await fetch(new Request(selectedSound.file));
    if (!resp.ok) throw new Error('fetch failed');
    await resp.arrayBuffer();
    markAudioReady();
  } catch {
    elOfflineBtn.textContent = 'Download failed — retry';
    elOfflineBtn.disabled = false;
  }
});

// ── Init ─────────────────────────────────────────────────────────────────────

renderSounds();
renderDurations();
showIdleCountdown();
initOfflineBtn();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
