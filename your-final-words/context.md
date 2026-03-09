# Your Final Words

A minimalist dark-themed single-page website for a reflective writing exercise. Users are prompted to write fictional final words — a letter, a speech, a poem, anything they'd want someone to read if they weren't here tomorrow.

## Structure

- **index.html** — self-contained page (HTML + inline CSS + JS, no build step)
- **resources/hero.txt** — the subtitle text shown under the title
- **resources/exercise.txt** — the brief exercise description (always visible)
- **resources/details.txt** — extended description hidden behind a "Show More" toggle
- **resources/samples/manifest.json** — JSON array of sample filenames to display
- **resources/samples/*.txt** — sample texts (line 1 = title, line 2 = author or blank, line 3+ = body)

## Design

- Dark theme (#0a0a0a background), black and white palette
- Buttons: transparent with 1px white border, white-fill on hover
- Sans-serif (Inter/Helvetica) for UI; serif (Georgia) for letters and the writing area
- Responsive layout, max-width 760px

## Features

- **Writing area** with localStorage auto-save (survives refresh & browser close). Also saves on `beforeunload` and `pagehide` for extra safety. Clear button wipes saved text.
- **Next-step nudge** below the editor encouraging users to copy their text, save it, and send it to a trusted person.
- **Sample reader** overlay — loads .txt files at runtime, closes with ×, Escape, or clicking outside
- **Show More** toggle for detailed exercise description
- All descriptive copy lives in .txt files for easy editing without touching HTML

## Adding samples

1. Drop a .txt file in `resources/samples/`
2. Add its filename to `resources/samples/manifest.json`

File format:
```
Title
Author (or blank line)

Body text...
```