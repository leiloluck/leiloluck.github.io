# Sources Log — Meditation Timer (bell acoustics study)

Bell-extraction and synthesis study, 2026-10-10. Mirrored files live in
`resources/sources/`. Cited by URL only (not mirrored) where noted.

## Locally mirrored

- `sources/terwagne-bush-2011-tibetan-singing-bowls.pdf` — Terwagne & Bush (2011),
  *Tibetan singing bowls*, MIT Open Access / arXiv 1106.6348. Physics of bowl
  vibration: standing-wave modes, nonlinear beating, Faraday waves. Supports: bowls
  sing in sustained standing-wave modes; the sound is dominated by a small number of
  stable partials.
- `sources/sabat-2022-frequency-response-singing-bowls.pdf` — B. Sabat (2022),
  *Frequency response and nodal mapping of singing bowls*, senior thesis, BYU-Idaho.
  Spectra of seven hand-hammered bowls at the strike. Supports: **each bowl's
  fundamental is a pair of close partials a few Hz apart (e.g. 292 Hz + 302 Hz)**,
  which is heard as slow beating; higher modes stack above it.
- `sources/park-2021-beating-singing-bowl-brainwaves.html` — Park et al. (2021),
  *Does the Sound of a Singing Bowl Synchronize Meditational Brainwaves in the
  Listeners?*, PMC10298245. Measured acoustics used here only: one bowl with
  fundamental 482.61 Hz, spectral components at 773/1102/1465/1871 Hz, **beating at
  6.68 Hz**, decaying to inaudibility over ~50 s.

## External (cited by URL, not mirrored)

- Inácio, Henrique & Antunes (2003), *The Dynamics of Tibetan Singing Bowls*,
  Revista de Acústica 35 — https://www.academia.edu/18993357/
  Modal-frequency tables for four bowls: every mode is a **pair** (splits of
  1–11 Hz), frequency ratios of the first mode families ≈ **1 : 2.7–2.9 : 5.2–5.7**,
  modal damping ratios 0.002–0.015 % (very slow decay).
- Gallager, *Discrete Stochastic Processes*, ch. 2.2 "Definition and Properties of a
  Poisson Process", Engineering LibreTexts — https://eng.libretexts.org/Bookshelves/Electrical_Engineering/Signal_Processing_and_Modeling/Discrete_Stochastic_Processes_(Gallager)/02%3A_Poisson_Processes/2.02%3A_Definition_and_Properties_of_a_Poisson_Process
  Basis for the interval-distribution recommendation (Tuned tab): a Poisson process
  has **exponential inter-arrival times and is memoryless** — the wait does not depend
  on how long one has already waited. That is the mathematically "unpredictable"
  interval model; we sample it as a **truncated** exponential (floor = ring-out +
  margin; default hard cut-off at twice the longest sound — 2 × 28 s = 56 s gap),
  re-normalised so the cut probability mass is re-spread over the shorter waits
  instead of piling up at the limit.
- Sun et al. (2010), *Perception of randomness: On the time of streaks* —
  https://pubmed.ncbi.nlm.nih.gov/20728080
  People systematically treat streaks in genuinely random sequences as evidence of a
  *non-random* process. Supports capping the exponential tail: without a cap, real
  randomness produces occasional long gaps and tight clusters that listeners read as
  "the app is broken" or "it's repeating".
- Traer et al., *A perceptually inspired generative model of rigid-body contact
  sounds*, DAFx 2019 (paper 57) — https://dafx.de/paper-archive/2019/DAFx2019_paper_57.pdf
  Used for the strike model on the Generated tab: an impact sound is **modal part
  plus a transient** modelled as **decaying noise bands**; listener tests show
  modes-only and transient-only synthetics are both heard as fake, both together
  are convincing. The exciter's contact time filters the attack (soft mallet = duller).
- *Physical modelling techniques for … sound synthesis of historical bells*,
  npj Heritage Science (2021) — https://www.nature.com/articles/s40494-021-00620-2
  Clapper/strike contact time is extremely short (0.2–0.5 ms) and the excitation
  (hardness, mass, position) determines which modes are loud — supports keeping a
  bright, brief attack for hard strikes and a dull swell for soft ones.
- Mindful Store (2024), *A guide to singing bowl tones and frequencies* —
  https://mindfulstore.com.au/blogs/learn/singing-bowl-tones-and-frequencies
  Size ↔ frequency ranges: most bowls sound **100–800 Hz** fundamentals; large bowls
  (20 cm+) sit **under 250 Hz**; medium (12–20 cm) 200–400 Hz.
- Hydrogenaudio Knowledgebase, *Gapless playback* —
  https://wiki.hydrogenaud.io/index.php?title=Gapless_playback
  MP3 audio is coded in 1152-sample granules (~24 ms at 48 kHz) and every encoder adds
  delay/padding; a stream-copied slice that starts mid-granule has a first granule the
  decoder must reconstruct without full context. Measured in this project: the same
  member file's first 20 ms decoded **22 dB apart** in ffmpeg vs libmpg123. Basis for
  the chord-onset investigation (Tuned tab § 3 of `resources/bells.html`): the baked
  chords carry the ffmpeg reconstruction of that fragile first granule from all
  members; the re-cut demo files instead start from true silence.

## How the sources relate to the extracted bells

The six extracted bells (129–262 Hz fundamentals) are in large-bowl range; their
measured structure matches the literature: fundamental mode pairs beating at
1.3–5.8 Hz, upper-mode ratios of 1 : 2.80–2.84 : 5.2–5.5 (: 8.0 : 11.3), and decay
time constants of ~2–19 s. These measured values drive the synthesis model on the
Generated tab of `resources/bells.html`.

## Bluetooth crackle investigation (2026-10-11)

Intermittent crackling on Bluetooth speakers, browser-only, never at the same moment
in the file — investigated for the "Crackle test (A/B)" section of `bells.html`.

- Chromium issue tracker, *WebAudio inserts zero filled parts into buffers supplied by
  getUserMedia* — https://issues.chromium.org/40103985
  If the audio output is exactly silence for ~30 s+, Chrome drops the hardware output
  stream (the audibility gate lives in `services/audio/output_stream.cc`). Exact zeros
  keep no device alive — a keep-alive must be a **faint nonzero** signal. This is why
  the page's link-warm tone is a 25 Hz oscillator at amplitude 0.002 (−54 dBFS),
  matching the shipping app's `startKeepAlive()`.
- Chromium issue 528232605, *Intermittent audio crackling during live streaming on
  Chromebooks* — https://issues.chromium.org/issues/528232605
  Reproduces **only** in Chromium browsers; Firefox clean. Crackle on a Chromium audio
  path is a known class of bug, not a file problem.
- The Geek Page (2026-07), *Fix Bluetooth Audio Stuttering in Chrome/Edge (Windows 11)*
  — https://thegeekpage.com/fix-bluetooth-audio-stuttering-in-chrome-edge-windows-11
  Why only the browser: Chromium sandboxes the audio service, adding latency on top of
  Bluetooth's own; Windows audio "enhancements" and the Hands-Free (HFP) profile add
  more. Fixes: `--disable-features=AudioServiceSandbox` on the shortcut, disable browser
  hardware acceleration, turn off audio enhancements, disable Hands-free Telephony on
  the device, restart the audio service.
- MDN, *AudioPlaybackStats* — https://developer.mozilla.org/en-US/docs/Web/API/AudioPlaybackStats
  Definition and causes of underruns (clicks/pops/dropouts): the audio pipeline can't
  feed the device fast enough — CPU load or device wake-up, not source content.
- Verified locally with Chrome headless: `createMediaElementSource` on a `file://` media
  element logs *"MediaElementAudioSource outputs zeroes due to CORS access restrictions"*
  — a live Web Audio limiter cannot process local files, so the A/B "safe" versions are
  pre-rendered (`bell_00X_safe.flac`: 5 ms fade-in + `alimiter limit=0.891 level=false`),
   verified bit-transparent below the ceiling.

## Denoise investigation (2026-10-11)

For the "Denoise test" section of `bells.html`. Goal: remove the steady hiss in the bell
tails without touching the bell itself.

- FFmpeg Micro (2026-09), *FFmpeg Can Remove Background Noise. arnndn Breaks in Docker.* —
  https://www.ffmpeg-micro.com/blog/ffmpeg-can-remove-background-noise-arnndn-breaks-in-docker
  The three native filters compared: `afftdn` (FFT spectral subtraction — HVAC hum, tape
  hiss, mic self-noise), `anlmdn` (non-local means — **steady broadband hiss, low-level
  grain**), `arnndn` (RNN **speech** model, needs an external `.rnnn`). Also documents
  `asendcmd=0.0 afftdn sn start, … sn stop` for sampling a noise profile from a known-silent
  file region.
- FFmpeg filter docs, `afftdn` — https://ayosec.github.io/ffmpeg-filters-docs/5.1/Filters/Audio/afftdn.html
  Parameter reference (`nr` 0.01–97 dB, `nf` −80…−20 dB, `gs` gain-smooth radius to reduce
  musical-noise artefacts, `tn`/`tr` noise tracking).
- FFmpeg Trac wiki, *denoise* — https://trac.ffmpeg.org/wiki/denoise
  NLM compares small waveform patches against neighbours and averages only what repeats —
  the property that preserves periodic/tonal content while averaging random noise away.
- noisereducerai.com (2026-07), *DeepFilterNet vs RNNoise* and forasoft.com (2026-06),
  *Real-Time Noise Suppression…* — DeepFilterNet3 is the best open model overall but, like
  RNNoise, is **trained on speech**; both need extra model downloads/binaries.

**Measured on these files**: clip cuts begin ~20 ms before the strike (the source track is
gated with *digital silence* between strikes — verified: −240 dBFS 1-s windows — so no
room-tone profile exists anywhere in the source). The tail hiss is a constant 8–20 kHz band
at −37…−51 dBFS (loudest: flat C3, quietest: C4). Tested on bell_001 and bell_002: `anlmdn`
removes up to −50 dB of it with ring-level Δ0.00 dB and strongest-partial Δ≤0.11 dB;
`afftdn` variants cost 2.2–3.1 dB on the strike transient (audible dulling of the mallet
hit) and the `afftdn+anlmdn` combo the most. The flat bells (001, 003) reduce least —
their HF energy is structured (mallet friction + high partials; tail peak-to-median 95 dB
vs 37 dB for the tuned bells), which NLM correctly treats as signal.

**Wub-wub (musical noise) fix.** Spectral subtraction leaves broadband noise modulated
by its own fluctuating per-bin gains — an "underwater" warble. Measured as the std of the
4–8 kHz envelope over 3–16 s: original 2.1 dB, first ultra 10.2 dB. Raising `ad`
(adaptivity / gain-smoothing time) to 0.99 cut it to 7.3 dB *and* deepened removal
(−34.6 → −60.8 dB on the C3's stubborn band) with no extra tonal cost; `bm` band
spreading and a 45/55 dry/wet blend did not help (the dry path re-imports the noise).

**What the C3's noise is.** Its 4–8 kHz content has a random spectrum (off-zero
autocorrelation 0.02) but a loudness envelope that follows the bell (+0.89 correlation
with the LF envelope) — consistent with recorder gain-riding or MP3 noise allocation
scaling with the signal: the noise rises and falls with the sound rather than sitting at
a constant floor. That is why a stationary noise profile fails on it (and why the global
percentile gate did ~nothing) while a *tracking* denoiser works.

**Final variant menu** (clickable in the page): `bell_00X_den_f2/f3/f4.flac` —
`afftdn=nr=24|40|64:nf=-50:tn=1:gs=16|24|40` (strong/max), with ultra additionally
`ad=0.99` (hiss −24…−62 dB, ring Δ0.01 dB; strike loses 1.2–2.9 dB; on bell_003 one
partial is shaved 18→29 dB across the three — warned in the page). The old fixed-floor
"extreme" (`nf=-45:tn=0`, −64 dB at a partial cost of 10–11 dB) is dominated by the
smooth ultra on every metric and was dropped.

**Playback reference tones** (bottom of the page): `ref-sine-220.flac` (pure 220 Hz,
−9 dBFS) and `ref-bell-c3.flac` (modal model of bell_001's partials and decays, rendered
from first principles — never near a microphone, an MP3 encoder or a denoiser). If these
crackle too, the artefact is the playback chain (Bluetooth/browser), not the recordings.

**Rejected, measured.** DeepFilterNet3 0.5.6 (Windows binary, `-D --pf`) removed hiss by
16–95 dB but **deleted the bell's partials by 97–121 dB** — a speech-trained model hears
slowly-decaying tones as noise; unusable for this material. A custom Python spectral gate
failed both ways: a local time-window noise percentile tracks the decaying tone and gated
the bell itself (ring −14…−33 dB); a global per-bin percentile with a frequency-smoothed
noise envelope did ~nothing (0–2 dB) because this recording's noise floor *rises* mid-file
(4–8 kHz: −29 → −23 → −32 dBFS) so a stationary profile underestimates it. The tracking
(`tn=1`) in `afftdn` adapts to that — which is why it takes the spectral slot.
