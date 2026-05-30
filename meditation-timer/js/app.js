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

let bellBuffer  = null;   // decoded PCM for end-of-session bells

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

  // Pre-decode bell audio so it can be scheduled via the audio clock
  // (AudioBufferSourceNode is reliable on locked screens; plain Audio is not)
  fetch('./resources/Single bowl sound.mp3')
    .then(r => r.arrayBuffer())
    .then(buf => audioCtx.decodeAudioData(buf))
    .then(decoded => { bellBuffer = decoded; })
    .catch(() => {});
}

function playBell(offsetSeconds) {
  if (!audioCtx || !bellBuffer) return;
  const src = audioCtx.createBufferSource();
  src.buffer = bellBuffer;
  // Connect directly to destination — bypasses the fade gainNode so bells
  // always play at full volume even when the session audio has faded to 0.
  src.connect(audioCtx.destination);
  src.start(audioCtx.currentTime + offsetSeconds);
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

  // Triple bell — scheduled via audio clock so they fire on a locked screen.
  // AudioBufferSourceNode.start() is handled by the Web Audio engine, not JS timers.
  if (audioCtx) audioCtx.resume(); // defensive: keep context running
  playBell(0);
  playBell(0.4);
  playBell(0.8);

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
const elOfflineBtn    = document.getElementById('offline-btn');
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
  // Step 1: trigger PWA install if the browser has queued a prompt (Android Chrome)
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (outcome === 'accepted') {
      localStorage.setItem(INSTALLED_KEY, '1');
      elInstallBtn.classList.add('hidden');
    }
  }

  // Step 2: download every audio file so the full app works without a connection
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

renderSounds();
renderDurations();
showIdleCountdown();
initOfflineBtn();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
