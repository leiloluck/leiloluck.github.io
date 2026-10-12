# candidates/ — replacement candidates under audition

Files here are **not live**: the app only plays what the top level of `../` and the
`files:` lists in `js/app.js` say. Audition everything with
**[../sounds.html](../sounds.html)**.

## Result of the 2026-10-12 meow audition

- **Winner:** "Cute Kitten Meow" ([Freesound 448084](https://freesound.org/people/Breviceps/sounds/448084/)
  by Breviceps, CC0) — promoted to **`../kitty-meow.mp3`**, and it is the Cat sound in
  the app since **v26.10.12d**. The old `../cat-meow.mp3` stays in the repo as the
  second entry in the Cat `files:` list, purely an offline fallback for installs that
  predate the swap.
- **Discarded by the owner:** the three BigSoundBank little-meow takes (s0494, s1472,
  s1473). Removed from the repo.

## Auditioning a new candidate

1. Drop the file in this folder under whatever name the source uses.
2. Normalize it to the app's loudness. `normalize_sounds.py` only scans the **top
   level** of `resources/`, so either run the two-pass ffmpeg `loudnorm` by hand
   (target −14 LUFS, TP ≤ −1 dBTP, 44.1 kHz mono, 192k mp3) or move the file up, run
   the script, and move it back.
3. Add an entry to the `CANDIDATES` list in `../sounds.html` (title, file, meta with
   length/source/licence, source URL) and a row in the table below.
4. Rate it on the workshop page, copy the feedback report, and hand it over.

## Licence rules

Only CC0 / public-domain (or otherwise clearly reusable) files go in here — this folder
is served on the public site. Always record source and licence below.

| File | Length | Source | Licence |
|---|---|---|---|
| *(none right now)* | | | |
