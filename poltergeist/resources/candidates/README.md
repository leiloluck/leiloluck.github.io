# candidates/ — meow replacement candidates

Four single-meow recordings to replace `../cat-meow.mp3` (the current one came from a
meme and is not great). Audition them, alongside the live sounds, with
**[../sounds.html](../sounds.html)** — play each one, rate it, and copy the feedback
report. All four are loudness-matched to the app's sounds (−14 LUFS, 44.1 kHz mono,
192 kbps mp3), so the comparison is fair.

| File | Length | Loudness | Source | Licence |
|---|---|---|---|---|
| `meow-1-bigsoundbank-0494.mp3` | 0.53 s | −14.4 LUFS | [BigSoundBank s0494 "Little Meow of a Cat #1"](https://bigsoundbank.com/little-meow-of-a-cat-s0494.html) (Joseph SARDIN) | CC0 |
| `meow-2-bigsoundbank-1472.mp3` | 1.02 s | −14.5 LUFS | [BigSoundBank s1472 "Little meow of a cat #2"](https://bigsoundbank.com/little-meow-of-a-cat-2-s1472.html) (Joseph SARDIN) | CC0 |
| `meow-3-bigsoundbank-1473.mp3` | 1.02 s | −14.3 LUFS | [BigSoundBank s1473 "Little meow of a cat #3"](https://bigsoundbank.com/little-meow-of-a-cat-3-s1473.html) (Joseph SARDIN) | CC0 |
| `meow-4-freesound-448084-cute-kitten.mp3` | 0.65 s | −14.3 LUFS | [Freesound 448084 "Cute Kitten Meow"](https://freesound.org/people/Breviceps/sounds/448084/) by Breviceps | CC0 |

CC0 is public-domain: no attribution required, commercial use allowed. The source and
licence are recorded here (and on the workshop page) anyway, so the provenance cannot
get lost.

**Once one is chosen:** move it over `../cat-meow.mp3` (or name it in the Cat entry's
`files:` list in `js/app.js`). Prefer a **new filename** for the swap: the installed
app's `poltergeist-sounds` cache is unversioned and cache-first, so a file replaced at
the same URL keeps serving the old bytes to existing installs. A new name (or the next
candidate untouched) sidesteps that. Then bump the app version. `normalize_sounds.py`
only scans the top level of `resources/`, so candidates were normalized by hand — the
loudness numbers above are measured on the final files.
