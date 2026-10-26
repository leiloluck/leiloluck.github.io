# candidates/ — replacement candidates under audition

Files here are **not live**: the app only plays what the top level of `../` and the
`files:` lists in `js/app.js` say. Audition everything with
**[../dev.html](../dev.html)** (renamed from `sounds.html` on 2026-10-26).

## Result of the 2026-10-12 meow audition

- **Winner:** "Cute Kitten Meow" ([Freesound 448084](https://freesound.org/people/Breviceps/sounds/448084/)
  by Breviceps, CC0) — promoted to **`../kitty-meow.mp3`**, and it is the Cat sound in
  the app since **v26.10.12d**. The old `../cat-meow.mp3` stays in the repo as the
  second entry in the Cat `files:` list, purely an offline fallback for installs that
  predate the swap.
- **Discarded by the owner:** the three BigSoundBank little-meow takes (s0494, s1472,
  s1473). Removed from the repo.

## 2026-10-26 laughter + ghost audition

Round 1 (#1-#12) was heard the same day. **Keepers:** #1, #2, #3, #5, #6, #9 (once the
clapping was cut), #11, #12. **Rejected by the owner:** #4, #7, #8, #10 (files stay here
until the owner says delete them; the dev page lists them under "Rejected earlier").
Round 2 added #13-#26 (more kids, adults and crowds) and #27-#32 (ghost "woo woo" and moans),
pending verdict. None is in the app yet; listen on **[../dev.html](../dev.html)** and pick by
number.

Sources are Freesound previews (128 kbps mp3, the only version available without a login);
each sound's page was checked to show the CC0 1.0 dedication. Processing (`laugh-NN-*`,
`ghost-NN-*`): leading silence cut to ~40 ms, 25 ms fade-in, capped at 3.6 s (ghosts 4.5 s),
gain to -14 LUFS with a limiter so the encoded file peaks <= -1 dBTP, mono 44.1 kHz 192k mp3.
Endings: a clip that would be cut is cut at the quietest gap in its last 0.7 s (so it ends
after a finished "ha") and faded 0.3 s; ghosts that are capped fade 0.5 s. A few clips
only reach about -17 LUFS (#9, #17) because dense crowd noise is peak-limited.

Round-1 fixes after feedback: #1's last "ha" had been squashed by a fixed 0.35 s fade (now it
keeps its natural tail); #2 now ends in a gap instead of mid-laugh; #9 is cut at 3.2 s of the
original, before the applause (spectrogram: dense broadband stripes from ~3.3 s). A few faint
early ticks remain in #9.

Once a verdict is in, winners get a proper name (e.g. `laugh-kids.mp3`), move up to
`../`, go into the `SOUNDS` list in `js/app.js` and `PRECACHE` in `sw.js`, and the rest are
deleted from here (with the owner's say-so).

## Auditioning a new candidate

1. Drop the file in this folder under whatever name the source uses.
2. Normalize it to the app's loudness. `normalize_sounds.py` only scans the **top
   level** of `resources/`, so either run the two-pass ffmpeg `loudnorm` by hand
   (target −14 LUFS, TP ≤ −1 dBTP, 44.1 kHz mono, 192k mp3) or move the file up, run
   the script, and move it back.
3. Add an entry to the `CANDIDATES` list in `../dev.html` (title, file, meta with
   length/source/licence, source URL) and a row in the table below.
4. Rate it on the dev page (New sounds tab), copy the feedback report, and hand it over.

## Licence rules

Only CC0 / public-domain (or otherwise clearly reusable) files go in here — this folder
is served on the public site. Always record source and licence below.

| File | Length | Source | Licence |
|---|---|---|---|
| `laugh-01-kids.mp3` | 3.1 s | [Freesound 371342](https://freesound.org/s/371342/) by Iamgiorgio, "D2_kidslaughing" | CC0 |
| `laugh-02-kids.mp3` | 3.3 s (from 5.0) | [Freesound 365632](https://freesound.org/s/365632/) by OBXJohn, "Boy or Young Child Laughing" | CC0 |
| `laugh-03-kids.mp3` | 3.2 s | [Freesound 135387](https://freesound.org/s/135387/) by ashjenx, "child laughing" | CC0 |
| `laugh-04-kids.mp3` | 2.5 s | [Freesound 616088](https://freesound.org/s/616088/) by medyk3D, "Child's laugh 1" | CC0 |
| `laugh-05-adult.mp3` | 1.8 s | [Freesound 433921](https://freesound.org/s/433921/) by Kalibrk, "Woman laugh" | CC0 |
| `laugh-06-adult.mp3` | 2.4 s | [Freesound 475212](https://freesound.org/s/475212/) by jodybruchon, "female laughter - guffaw" | CC0 |
| `laugh-07-adult.mp3` | 3.3 s | [Freesound 720133](https://freesound.org/s/720133/) by JotrainG, "Wholesome Genuine Laugh (male)" | CC0 |
| `laugh-08-adult.mp3` | 3.6 s (from 5.5) | [Freesound 119459](https://freesound.org/s/119459/) by Eneasz, "Male Laughter" | CC0 |
| `laugh-09-sitcom.mp3` | 2.9 s (from 5.8; applause cut) | [Freesound 371562](https://freesound.org/s/371562/) by Kinoton, "Sitcom Laughter with Applause, Small Audience" | CC0 |
| `laugh-10-sitcom.mp3` | 3.4 s | [Freesound 17121](https://freesound.org/s/17121/) by cognito perceptu, "small audience laughter" | CC0 |
| `laugh-11-sitcom.mp3` | 2.8 s | [Freesound 324894](https://freesound.org/s/324894/), "Crowd laugh" (uploader account deleted) | CC0 |
| `laugh-12-sitcom.mp3` | 2.0 s | [Freesound 242244](https://freesound.org/s/242244/) by ehohnke, "ShortStockLaughter2" | CC0 |
| `laugh-13-kids.mp3` | 2.3 s | [Freesound 430815](https://freesound.org/s/430815/) by Ben Keaton, "Kids laugh" | CC0 |
| `laugh-14-kids.mp3` | 2.3 s | [Freesound 807751](https://freesound.org/s/807751/) by o_ultimo, "Classroom Kids laughing out loud" | CC0 |
| `laugh-15-kids.mp3` | 2.9 s (from 4.2) | [Freesound 164243](https://freesound.org/s/164243/) by caculo, "Young girl laughing uncontrollably" | CC0 |
| `laugh-16-kids.mp3` | 1.4 s | [Freesound 367493](https://freesound.org/s/367493/) by FunWithSound, "Child Giggle" | CC0 |
| `laugh-17-adult.mp3` | 3.1 s | [Freesound 93775](https://freesound.org/s/93775/) by rdneubauer, "Female Laugh" | CC0 |
| `laugh-18-adult.mp3` | 3.5 s | [Freesound 529818](https://freesound.org/s/529818/) by dastudiospr, "Laughing (male)" | CC0 |
| `laugh-19-adult.mp3` | 3.3 s | [Freesound 421723](https://freesound.org/s/421723/) by Navadaux, "Guffaw(laughing)" | CC0 |
| `laugh-20-adult.mp3` | 3.3 s | [Freesound 203719](https://freesound.org/s/203719/) by bwav, "Laughing male" | CC0 |
| `laugh-21-adult.mp3` | 2.8 s | [Freesound 377742](https://freesound.org/s/377742/) by BlueSiren, "Girl Chuckle" | CC0 |
| `laugh-22-crowd.mp3` | 3.5 s (from 4.4) | [Freesound 138112](https://freesound.org/s/138112/) by snakebarney, "Small Crowd Laughing" | CC0 |
| `laugh-23-crowd.mp3` | 3.6 s | [Freesound 618972](https://freesound.org/s/618972/) by mrrap4food, "Crowd small Laugh!" | CC0 |
| `laugh-24-crowd.mp3` | 3.4 s | [Freesound 262983](https://freesound.org/s/262983/) by Alcappuccino, "Audience_laughing50" | CC0 |
| `laugh-25-crowd.mp3` | 2.3 s | [Freesound 452749](https://freesound.org/s/452749/) by schots, "Laughter" | CC0 |
| `laugh-26-crowd.mp3` | 2.7 s | [Freesound 399089](https://freesound.org/s/399089/) by rwan0731, "3 people laughing together" | CC0 |
| `ghost-27-woo.mp3` | 3.8 s | [Freesound 541635](https://freesound.org/s/541635/) by mosaichorse, "Classic Ghost Sound" | CC0 |
| `ghost-28-woo.mp3` | 3.0 s | [Freesound 718952](https://freesound.org/s/718952/) by sierra721, "Woooooo_TreasureIsland" | CC0 |
| `ghost-29-woo.mp3` | 3.6 s | [Freesound 639426](https://freesound.org/s/639426/) by LaurenPonder, "Cartoony Ghost" | CC0 |
| `ghost-30-moan.mp3` | 4.5 s (from 5.0) | [Freesound 643741](https://freesound.org/s/643741/) by SnowFightStudios, "Ghostly Moan" | CC0 |
| `ghost-31-moan.mp3` | 2.0 s | [Freesound 448754](https://freesound.org/s/448754/) by LilMati, "Sad Ghost 01" | CC0 |
| `ghost-32-cry.mp3` | 4.5 s | [Freesound 267197](https://freesound.org/s/267197/) by BrainClaim, "Sad Lonely Ghost Crying" | CC0 |
