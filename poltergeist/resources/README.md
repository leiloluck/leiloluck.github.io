# resources/ — SoundAnnoyer sound files

Drop your `.mp3` files **here**. The app loads them automatically on the next
reload — no code change needed. Each sound accepts **several filenames** (English
or Spanish); the first one that decodes wins, so you don't have to match a single
exact name. Until a matching file is present, the app plays a synthesized stand-in
(the button shows a `demo synth` tag), so everything is testable right now.

| Button | Canonical filename (+ aliases) | Notes |
|---|---|---|
| 🐱 Cat | `cat-meow.mp3` (`gato-miau`, `meow`) | a meow |
| 🐶 Dog | `dog-bark.mp3` (`bark`, `ladrido`) | one or two barks |
| 🚪 Knock | `knock.mp3` (`knock-on-wood`, `toque`) | a few knocks |
| 🐦 Sparrow | `bird-chirp.mp3` (`sparrow`, `pajaro`) | a chirp or two |
| 🦗 Crickets | `crickets.mp3` (`grillos`) | the awkward-silence sound |
| 😱 Crowd gasp | `crowd-gasp.mp3` (`gasp`) | a shocked crowd |
| 🛎️ Ding | `ding.mp3` (`doorbell`, `timbre`) | a single bell ding |
| 🦟 Mosquito | `mosquito.mp3` (`mosquito-buzz`) | a buzzing fly-by |
| 🐭 Mouse | `mouse-squeak.mp3` (`mouse`, `raton`) | a squeak |
| 📳 Vibrate | `phone-vibrate.mp3` (`vibrate`) | a phone buzzing on a table |
| 🤧 Sneeze | `sneeze.mp3` (`estornudo`) | an achoo |
| 🐤 Morning birds | `morning-birds.mp3` (`garden-birds`) | gentle garden birds |

Each sound accepts any name in its `files:` list (`js/app.js`); the first that
decodes wins. Want another name? Add it there.

> All 12 files above are present, renamed to their canonical names, and
> loudness-normalized. ✓ There is no real **Doorbell** ding-dong yet — the closest
> is **Ding**. Drop a `doorbell.mp3` and it will be used for the Ding button, or add
> a dedicated entry in `SOUNDS`.

## Loudness — keep volumes consistent

So no sound is conspicuously quieter or louder than the next, every file is
normalized to the same perceived loudness (−14 LUFS, EBU R128) with the helper
script. **After dropping any new file, run:**

```
python tools/normalize_sounds.py
```

It auto-finds every audio file here, normalizes only the ones that need it (already-
on-target files are skipped, so it's safe to re-run), and prints a before/after
table. `--check` reports loudness without changing anything; `--force` re-encodes
everything. Requires `ffmpeg` on your PATH.

## Tips

- **Keep them short and punchy** (a fraction of a second to a couple of seconds).
  Short, sharp sounds are the most confusing when they come out of nowhere.
- **Trim leading silence** so the sound lands the instant it fires.
- **Normalize the volume** across files so none is conspicuously louder.
- `.mp3` is expected, but any format the browser can decode (`.ogg`, `.wav`,
  `.m4a`) also works **if** you add the matching name to that sound's `files:` list
  in `js/app.js` (`SOUNDS` array).

## Adding more sounds

1. Drop the new `.mp3` here.
2. Add an entry to the `SOUNDS` array in `js/app.js` (`id`, `name`, `tag`,
   `emoji`, a `files` list of accepted filenames, and a `synth` fallback — reuse
   any existing one).
3. Add the filename to `PRECACHE` in `sw.js` only if you want it cached on install;
   otherwise it is cached automatically the first time it plays.
4. Bump the version (`vDD.MM.YY`) in `index.html`, `sw.js`, and `js/app.js`.
