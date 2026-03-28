# Agent Instructions — leiloluck.github.io

## Overview

You are a professional assistant helping to build and maintain **leiloluck.github.io**, a GitHub Pages website hosted at that address. Your role is to realise the projects and tasks defined here with care, diligence, and precision.

The site consists of an entry point (root) and several independent subpages, each contained within its own folder. Each subpage has entirely different content — some serve as informational references, others as web applications. The site is built with plain HTML, CSS, and JavaScript with no build step unless otherwise noted.

---

## Project Structure

### Subpages

Each subpage lives in its own folder. **Every project folder contains a `context.md` file** that describes the page's purpose, design system, content architecture, and implementation details. This file is your primary guidance document for that subpage — read it before making any changes to files within that folder.

| Folder | Description |
|---|---|
| `harm-reduction-guide/` | Evidence-based harm reduction protocols for festival and nightlife settings |
| `your-final-words/` | Minimalist reflective writing exercise web app |

### AI Reference Files

The `ai/` folder contains reference material for the agent:

| File | Purpose |
|---|---|
| `ai/context.md` | This document — top-level agent instructions |
| `ai/technical.md` | Technical details about the hosting environment and deployment |

### Code File Comments

Every source file (HTML, CSS, JS) includes a comment block at the top explaining its purpose. Read these before editing.

---

## Technical Details

- **Platform:** GitHub Pages (`leiloluck.github.io`)
- **Stack:** Plain HTML, CSS, JavaScript — no framework, no build step unless explicitly noted per project
- **Deployment:** Commits to `main` are automatically published via GitHub Pages

---

## Working Conventions

### Context First

Before making any changes to a subpage, read that folder's `context.md`. It contains everything you need to understand the page's purpose, design language, data model, and content standards. Do not assume — consult it.

### Research

For legal, pharmacological, or other factual topics: search online, download the relevant writing, and cite it in your response. Place downloaded resources in a `resources/sources/` folder within the relevant subpage directory. Log each resource in a `sources.md` file, noting what content and information each file contains.

### Safety

- **Do not delete anything** without explicit permission.
- **Only work on assigned tasks.** Do not make unilateral changes, add unrequested features, or modify files outside the scope of the task.

---

## Style Guide

These defaults apply site-wide unless a subpage's `context.md` specifies otherwise.

- **Theme:** Dark background, dark UI. Minimal and intentional.
- **Responsiveness:** Every page must look good on both mobile and desktop.
- **Buttons:** Dark, thin outlines. No heavy fills at rest.
- **Readability:** High contrast for body text. Font choices that are legible at small sizes.
- **Minimalism:** Preferred. Visual elements earn their place or they are removed.
- **Colour:** Welcome when purposeful — avoid decoration for its own sake.
- **Emojis:** Acceptable where they provide meaningful visual anchoring or contextual emphasis. Not for decoration.
