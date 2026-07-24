# AI Context — leiloluck.github.io

> The authoritative, always-loaded agent instructions live in the root
> [`/CLAUDE.md`](../CLAUDE.md). This file is a short orientation map — read
> `/CLAUDE.md` first, then the relevant subpage's own `context.md`.

## What this site is

`leiloluck.github.io` is a GitHub Pages site: a root entry point plus several
**independent subpages**, each in its own folder with entirely different content.
Plain HTML/CSS/JS, no build step unless a subpage says otherwise.

## Subpages

| Folder | What it is | Read first |
|---|---|---|
| `harm-reduction-guide/` | Evidence-based harm-reduction protocols for festival/nightlife settings. 17 substances, sourced dosing, a regrounded risk chart, drug-combination data. | `harm-reduction-guide/context.md` |
| `your-final-words/` | Minimalist reflective writing-exercise web app. | `your-final-words/context.md` |
| `sound-annoyer/`, `meditation-timer/` | Installable PWA utilities (date-based `vYY.MM.DD` versioning). | their `context.md` |

(Subpages are added over time — confirm the current set by listing the repo root.)

## Working conventions (summary — see `/CLAUDE.md` for the full text)

- **Context first.** Before editing a subpage, read its `context.md`.
- **Sources.** Factual claims are cited; downloaded reference material lives under
  the subpage's `resources/` (e.g. `harm-reduction-guide/resources/` and its
  `sources.md`).
- **Safety.** Don't delete without explicit permission; only work on assigned tasks.
- **Versioning.** Where a subpage carries a version, use `vYY.MM.DD` (with a letter
  suffix for same-day iterations, e.g. `v26.07.24b`) and bump it on every change.
- **Style.** Dark, minimal, intentional; must read well on mobile and desktop.

## Technical / deployment

See [`technical.md`](technical.md).
