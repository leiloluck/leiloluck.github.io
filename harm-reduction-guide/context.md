# Harm Reduction Protocols — Subpage Design Document

> **Status:** Active Development  
> **Last Updated:** 2026-03-15  
> **Author Role:** Scientific harm reduction design lead  

---

## 1. Mission & Editorial Philosophy

### 1.1 Purpose

This is an **evidence-based harm reduction information service**. It is not a recreational or entertainment website. It exists as a practical clinical-grade tool that enables consumers to make safer and more informed decisions about their own bodies.

The website is designed for a reader who may be fatigued, overstimulated, or in an altered state. Every design choice — from typography to information hierarchy — must serve the goal of delivering critical safety information with maximum clarity under non-ideal reading conditions.

### 1.2 Tone & Professionalism

- **Clinical, not casual.** The language reads like a well-written patient safety leaflet — direct, precise, and free of slang or euphemism.
- **Non-judgmental.** The service does not endorse or condemn substance use. It provides factual risk profiles and actionable protocols so that individuals who have already decided to use a substance can do so with reduced harm.
- **Not a fun website.** There are no gamification elements, no social features, no engagement metrics. This is a reference tool — the digital equivalent of the safety card in an aeroplane seat pocket.

### 1.3 Sobriety as Default

The sober / baseline state is always presented **first and prominently** at the top of the interface. This establishes that:
1. Extended wakefulness and physical exertion carry real physiological risks even without any substance.
2. All substance-specific protocols are *modifications* of the sober baseline — not standalone advice.
3. The default, safest choice is always no substance use.

The sober section explicitly covers the physiological strain of sleep deprivation, prolonged dancing, nutritional depletion, and circadian disruption. This normalises harm reduction as a practice relevant to everyone, not only substance users.

---

## 2. Epistemological Standards

### 2.1 Source Attribution — Every Statement Must Be Traceable

**Every factual claim on this website must be linked to its source of origin.** This applies to all categories of information, including but not limited to:

- Duration and effect timelines
- Dosing thresholds and pharmacokinetic data
- Physiological risk mechanisms (e.g., ADH suppression, neurotoxicity pathways)
- Hangover and recovery advice
- Supplement recommendations
- Drug interaction warnings
- Combination risk profiles

The data model supports a `sources` array on every content item. Each source entry contains a human-readable `label` and a `url` pointing to the original publication or database entry. Sources are rendered as clickable links beneath each expandable detail block.

**Primary source hierarchy (in order of preference):**

1. **PsychonautWiki** — Comprehensive pharmacological profiles, duration data, subjective effect indices. Used as the primary reference for effect timelines and dose-response relationships.
2. **SaferParty (Safer Nightlife Schweiz)** — Swiss drug-checking service. Provides real-world European adulterant data, regional substance alerts, and pragmatic consumption advice.
3. **TripSit** — Combination safety charts, factsheets, and community-reviewed pharmacological summaries. The definitive source for multi-substance interaction data (see `tripsit-combo/combos.json`).
4. **DanceSafe** — US-based harm reduction organisation. Reagent testing protocols, adulterant warnings, and accessible substance overviews.
5. **DrugScience (Nutt et al.)** — Academic multi-criteria harm analysis. Used for relative risk comparisons and the physiological impact visualiser values.
6. **Peer-reviewed literature** — PubMed-indexed studies are cited where specific physiological mechanisms require clinical backing (e.g., hyponatremia risk in MDMA, cocaethylene cardiotoxicity).

### 2.2 Confidence & Controversy Policy

- **Only well-established facts are presented as facts.** A claim must appear consistently across at least two independent, reputable harm reduction sources to be stated with confidence.
- **If a claim appears on only one source** (e.g., a single Reddit post, one obscure forum, or a single harm reduction site with no corroboration), it is treated as **unverified** and is either omitted or explicitly marked as uncertain.
- **Unclear or debated effects must be disclosed as such.** Where the evidence on a particular effect is inconclusive, mixed, or actively debated in the scientific community, the text must state this plainly. Example: *"The neuroprotective efficacy of ALA supplementation for MDMA is supported by preclinical animal studies but has not been confirmed in human clinical trials."*
- **Do not conflate absence of evidence with evidence of absence.** If a substance's long-term effects are simply unknown, that uncertainty is stated as a risk in itself.

### 2.3 Resource Library

The `/resources/` directory contains the raw reference material organised by source:

| Directory | Source Organisation | Content |
|---|---|---|
| `dancesafe/` | DanceSafe.org | Substance-specific factsheets (markdown) |
| `psychonautwiki/` | PsychonautWiki.org | Pharmacology, dosing, duration, subjective effects |
| `saferparty/` | SaferParty.ch | Swiss harm reduction data (German-language originals) |
| `tripsit/` | TripSit.me | Substance factsheets |
| `tripsit-combo/` | TripSit.me | `combos.json` — machine-readable drug interaction matrix |
| `drugscience/` | DrugScience.org.uk | Multi-criteria harm rankings (reserved for future use) |
| `browse.md` | — | Navigation index for the resource library |
| `Festival Harm Reduction Guide.md` | Original compilation | The master narrative document from which protocol data was derived |

---

## 3. Substance Coverage & Ordering

### 3.1 Selection Criteria

Substances are selected based on **prevalence of recreational use in Europe**, sourced from the EMCDDA (European Monitoring Centre for Drugs and Drug Addiction) European Drug Report and related surveys. The focus is on substances most commonly encountered at festivals, nightlife events, and social gatherings in European settings.

### 3.2 Current Substance Order (by European prevalence)

The navigation buttons in the substance selector are ordered as follows:

| # | ID | Name | Type | Emoji | Colour | Rationale |
|---|---|---|---|---|---|---|
| 0 | `sober` | Sober / Baseline | Baseline | 🧠 | `#78716c` (warm gray) | Always first. The default. |
| 1 | `alcohol` | Alcohol | Depressant | 🍺 | `#ef4444` (red) | Most widely used substance in Europe by a large margin |
| 2 | `caffeine` | Caffeine | Stimulant | ☕ | `#a8a29e` (stone) | Ubiquitous, frequently combined, often underestimated |
| 3 | `cannabis` | Cannabis | Depressant/Psychedelic | 🌿 | `#22c55e` / `#84cc16` (green) | Most commonly used illicit substance in Europe |
| 4 | `mdma` | MDMA | Empathogen | 💖 / 💎 | `#ec4899` / `#a855f7` (pink/purple) | Most common empathogen in European nightlife |
| 5 | `cocaine` | Cocaine | Stimulant | ❄️ | `#06b6d4` (cyan) | Rising prevalence across Europe, particularly Western |
| 6 | `amphetamine` | Amphetamine (Speed) | Stimulant | ⚡ | `#f97316` (orange) | High prevalence especially in Central/Northern Europe |
| 7 | `ketamine` | Ketamine | Dissociative | 🐴 / 🌀 | `#c084fc` / `#0ea5e9` (purple/sky) | Rapidly growing in European nightlife contexts |
| 8 | `lsd` | LSD | Psychedelic | 🌈 | `#f59e0b` (amber) | Established psychedelic in festival/rave settings |
| 9 | `mushrooms` | Mushrooms (Psilocybin) | Psychedelic | 🍄 | `#10b981` (emerald) | Growing in popularity; shorter and milder than LSD |
| 10 | `2cb` | 2C-B | Psychedelic | 🔮 | `#ec4899` (pink) | Niche but increasingly common in European club scene |
| 11 | `4mmc` | 4-MMC (Mephedrone) | Stimulant/Empathogen | 💥 | `#f43f5e` (rose) | Regional surge, high-risk profile, compulsive redosing |

### 3.3 Future Additions (Considered)

- **GHB/GBL** — Growing European prevalence, extremely narrow therapeutic index, critical to cover.
- **Nitrous Oxide (N₂O)** — Common at festivals, risks often underestimated (B12 depletion, hypoxia).
- **Benzodiazepines** — Relevant for combination risks and recovery contexts.

---

## 4. Information Architecture & UX Principles

### 4.1 Core Principle: Essential First, Detail on Demand

The website follows a strict **progressive disclosure** model:

- **Essential information is always visible.** The most critical safety points — life-threatening interactions, dosing limits, emergency instructions — are displayed immediately, unmissable, in full view.
- **Non-essential, supplementary, or contextual information is tucked behind `[+]` expand toggles.** This includes pharmacological mechanism explanations, supplement rationale, and background science. This content exists for the curious reader but must never compete visually with safety-critical items.
- **Additional/bonus recommendations are collapsed behind "▸ Additional recommendations" toggles.** These are lower-priority tips that, while useful, are not essential to preventing immediate harm.

This two-tier expand system ensures that:
1. A reader scanning the page in 10 seconds gets the critical safety messages.
2. A reader who wants to understand *why* a recommendation exists can expand the detail.
3. The page never feels overwhelming, even when covering a pharmacologically complex substance.

### 4.2 Content Item Data Structure

Each protocol tip follows this data model:

```json
{
  "short": "Brief, imperative statement visible at all times.",
  "detail": "Extended explanation with pharmacological rationale. Visible only when [+] is clicked.",
  "sources": [
    { "label": "PsychonautWiki — Substance", "url": "https://..." },
    { "label": "SaferParty — Substanz", "url": "https://..." }
  ]
}
```

- `short` — Always visible. Written as a direct instruction. Prefixed with ⚠️ for life-threatening items.
- `detail` — Hidden behind `[+]`. Provides the scientific mechanism or clinical reasoning behind the short instruction.
- `sources` — Rendered below the detail as small clickable links. Every detail should have at least one source.

### 4.3 Section Structure: Chronological Protocol Timeline

Each substance's protocol is organised into four chronological phases, reflecting the real-world sequence of an event:

| Phase | Section Title | Icon | Purpose |
|---|---|---|---|
| 1 | Preparation (Before) | 🧘 | Pre-loading, meal timing, safety checks, substance testing |
| 2 | Activity (During) | 🕺 | Hydration, thermoregulation, interaction warnings, real-time safety |
| 3 | Recovery (After) | 🛏️ | Comedown management, sleep positioning, supplement timing |
| 4 | Next Morning | ☀️ | Morning-after recovery, mood expectations, nutritional repair |

Each phase contains:
- A **"Critical Focus"** callout (during phase only) — the single most important thing to manage.
- **Essential items** — always visible, top of the list.
- **Bonus items** — collapsed under "▸ Additional recommendations".

### 4.4 Right Column: Physiological Impact Visualisation

The right side of the layout contains two data visualisations:

#### Risk Analysis (Horizontal Bar Chart)
Five axes representing physiological strain dimensions:
- **Neurotoxicity** — Direct damage to neural tissue
- **Cardiotoxicity** — Cardiovascular strain (heart rate, blood pressure, vasoconstriction)
- **Dehydration** — Fluid and electrolyte disruption
- **Sleep Deprivation** — Circadian disruption and sleep architecture impairment
- **Impulsivity** — Behavioural disinhibition and compulsive redosing risk

Values are qualitative (0–8 scale) and colour-coded:
- 0 = Gray (None)
- 1–2 = Green (Low)
- 3–4 = Yellow (Medium)
- 5–6 = Orange (High)
- 7–8 = Red (Very High)

#### Effect Timeline (Stacked Horizontal Bar Chart)
Shows the temporal profile of substance effects by route of administration:
- **Onset** (gray) → **Come-up** (blue) → **Peak** (purple) → **Come-down** (amber) → **After-effects** (dim gray)
- Duration values sourced primarily from PsychonautWiki.
- Multiple routes displayed when applicable (e.g., Cannabis: Smoked vs. Oral Edible).

#### Sleep Strategy
A text box summarising the expected impact on sleep and recommended approach.

#### Emergency Risk Factors
A red-tinted panel listing the substance-specific acute dangers (hidden for Sober/Baseline). These are the conditions under which immediate emergency intervention (call 112) may be required.

---

## 5. Visual Design System

### 5.1 Design Philosophy

**Minimal, clinical, high-contrast dark mode.** The aesthetic is intentionally austere — closer to an aviation safety interface or a well-designed pharmaceutical reference than a lifestyle app. Every visual element serves a functional purpose. Nothing is present for decoration.

A deliberate effort is made to avoid the "AI-generated dashboard" look — the uniform card grids, identical border radii, and symmetric padding that characterise template-driven UIs. Instead, the design borrows from **print editorial** and **technical documentation** traditions: consistent but not rigid, structured but not stamped from a mould. Small intentional asymmetries (varied spacing between sections, left-aligned headers breaking the card grid, a subtle environmental gradient) give the page a human editorial quality.

### 5.2 Current UI — Component Walkthrough

The page is a single-scroll document. Top to bottom, the reader encounters:

#### Disclaimer Banner (top edge, full width)
A narrow horizontal bar tinted green (`rgba(34,197,94,0.1)`) with a 1px green border. Contains the ℹ️ icon, the harm-reduction disclaimer, and the emergency number **112** in bold. This bar is static — it does not scroll away. Its green tint signals "informational / safe" without being loud.

#### Page Header
Left-aligned on desktop, centred on mobile. The title "Harm Reduction Protocols" is set large (`text-3xl` / `text-4xl`) in almost-white (`text-gray-100`) with tight tracking. Below it, a muted subtitle in `text-gray-500` summarises the page purpose. On the right (desktop), a small monospace label reads "Current Mode" above the active substance name, dynamically coloured to match the selected substance.

A single horizontal rule (`border-b border-[#2a2a28]`) separates the header from the body. This is the only full-width divider on the page.

#### Substance Selector (navigation grid)
A grid of buttons — 2 columns on mobile, 3 on tablet, 5 on desktop. Each button shows the substance emoji and name. At rest, buttons have a very faint tint of their assigned colour (8% opacity background, 25% opacity border). On hover, tint deepens. The active button receives a full border in its colour with a soft coloured glow (`box-shadow: 0 0 12px`).

The selector label reads "Select Context / Substance 💊" in small uppercase muted text. This label is left-aligned, not centred — a small asymmetry that breaks the templated feel.

#### Active Substance Header
A wide banner card below the selector. Displays the large emoji (4xl), substance name, and type classification. The entire card tints to the substance colour (10% background, 30% border). This card is the reader's persistent confirmation of which substance they are viewing. It spans the full content width.

#### Sticky Header (scroll-triggered)
After scrolling 300px, a slim fixed bar slides down from the top edge. It contains the substance emoji, name, and type on the left, and a "↑ Top" button on the right. The bar uses `backdrop-blur-md` with a 90% opacity background, creating a frosted-glass effect against the page content below. The substance name is coloured to match.

#### Main Content Area — Two-Column Layout

**Left column (7/12 on desktop):** The protocol timeline. This is the primary content. It flows vertically through four phase sections:

1. **Risk Analysis** — A horizontal bar chart (Chart.js) showing five physiological strain dimensions. The chart container sits inside a section card with a 2px border that tints to the substance colour.

2. **Protocol Timeline introduction** — A brief orientation paragraph in a single-border card. Contains the dynamic modifier text ("Displaying protocols for: [substance]") coloured to match.

3. **Phase 1–4 sections** (Before → During → After → Next Morning). Each phase has:
   - A numbered circular badge (1–4) in a small circle, tinted to the substance colour.
   - A bold heading with a contextual emoji.
   - A section card containing the essential items (always visible) and bonus items (collapsed behind "▸ Additional recommendations").
   - The "During" phase uniquely includes a **Critical Focus** callout — a left-bordered inset box with a coloured left bar that highlights the single most important thing to manage.

   Each protocol item renders as:
   - A small coloured dot (bullet) at 50% opacity of the substance colour.
   - The short instruction in `text-sm text-gray-400`, with the first segment before a colon bolded in `text-gray-200`.
   - An inline `[+]` toggle in monospace, coloured to match the substance.
   - When expanded: a detail paragraph in `text-xs text-gray-500` with a 2px left border at 30% substance colour, followed by source links in 10px underlined text at 50% opacity.

**Right column (5/12 on desktop):** Visualisation and reference data, containing:

1. **Physiological Impact Analysis** — An orientation card describing the charts.
2. **Effect Timeline chart** — A stacked horizontal bar chart showing duration phases (onset → come-up → peak → come-down → after-effects) in distinct colours. Multiple routes shown as separate bars when applicable. Below it, a sleep strategy text box on an even darker background (`#151514`).
3. **Emergency Risk Factors** — A red-tinted panel (hidden for the sober baseline) listing acute dangers. Red text on a subtle red background.

#### Footer
A quiet footer with a `border-t` separator. Two lines of muted text repeating the disclaimer and citing source organisations. No links, no logos — just attribution.

### 5.3 Background — Subtle Vertical Gradient

The page background is not a flat colour. It uses a **subtle vertical gradient** that gives the page a sense of depth and grounds the reader's sense of scroll position:

- **Top:** `#181816` — a slightly warmer, lighter charcoal. Feels like early dusk.
- **Bottom:** `#0c0c0b` — near-black. Feels like deep night.

The gradient is implemented as a `min-height: 100vh` linear gradient on the `<body>` element:

```css
background: linear-gradient(to bottom, #181816 0%, #0c0c0b 100%);
background-attachment: fixed;
```

The `background-attachment: fixed` ensures the gradient is tied to the viewport, not the scroll position — the top of the screen always feels slightly lighter regardless of how far the reader has scrolled. This creates a subtle environmental "lighting" effect, as if the page exists under a dim overhead source.

All card and section backgrounds remain at their existing values (`#1a1a19`, `#151514`), which now sit naturally within the gradient range rather than floating on a flat plane.

### 5.4 Colour System

| Element | Value | Purpose |
|---|---|---|
| Background (gradient top) | `#181816` | Warm charcoal — lighter anchor of the page |
| Background (gradient bottom) | `#0c0c0b` | Near-black — grounding the page at depth |
| Card / Section background | `#1a1a19` | Slightly elevated tone. Content boundary. |
| Inset background | `#151514` | Recessed elements (sleep strategy box) |
| Border (default) | `#2a2a28` | Subtle, warm-toned separation |
| Body text | `text-gray-300` (~`#d1d5db`) | Readable without harsh white |
| Secondary text | `text-gray-500` (~`#6b7280`) | Descriptions, labels |
| Muted text | `text-gray-600` (~`#4b5563`) | Footnotes, source labels |
| Disclaimer banner | `rgba(34,197,94,0.1)` | Green = informational / safe |
| Emergency flags | `rgba(239,68,68,0.06)` | Red = danger |

Each substance has a **unique accent colour** (see Section 3.2). This colour modulates:
- Navigation button states (rest → hover → active)
- Section card borders and numbered phase badges
- The "Critical Focus" left-border callout
- `[+]` toggle and source link text
- Bullet-point dots
- Chart bar fills and highlights

The accent colour is never used at full opacity for backgrounds — only at 5–20% opacity, preserving contrast and preventing the page from looking garish on any substance.

### 5.5 Typography

- **Font stack:** `system-ui, -apple-system, 'Segoe UI', sans-serif` — OS-native fonts. No external font loads. Fast, familiar, legible.
- **Headings:** Bold, `text-gray-100`, tight tracking. The page title is the only element above `text-xl`.
- **Body text:** `text-sm` (14px), `text-gray-400` for protocol items. This is intentionally not `text-gray-300` — the slight dullness creates a visual distinction between instructional content and headings.
- **Detail text (expanded):** `text-xs` (12px), `text-gray-500`. Clearly subordinate to the short instruction.
- **Labels & badges:** `uppercase tracking-wider text-xs font-semibold text-gray-500`. Used for section headers ("Select Context / Substance", "Current Mode", "Critical Focus").
- **Monospace:** `font-mono` is used exclusively for the `[+]`/`[-]` toggles and the "Current Mode" label. This visual break signals interactivity.

### 5.6 Emoji Usage

Emojis serve as **rapid visual anchors**, not decoration:
- **Substance identity:** 🧠 🍺 ☕ 🌿 💖 ❄️ ⚡ 🐴 🌈 🍄 🔮 💥 — each unique, always visible in the nav button and header.
- **Phase markers:** 🧘 🕺 🛏️ ☀️ — in phase headings. These provide instant orientation for a reader scrolling quickly.
- **Section markers:** 📊 🕐 — in chart and timeline section headings.
- **Danger prefix:** ⚠️ — in `short` text for life-threatening items. This is the only emoji that appears inside protocol content.
- **Banner:** ℹ️ — disclaimer bar.

Emojis are especially critical for readers in altered states, where fast icon-based scanning compensates for reduced text-processing speed.

### 5.7 Interaction Patterns

- **Substance selector buttons:** Subtle colour tint at rest. Deeper tint on hover. Glow + full border on active. The transition is 200ms — fast enough to feel responsive, not so fast it jitters.
- **Sticky header:** Slides in with `transform: translateY` at 300ms. Uses `backdrop-blur-md` for a frosted-glass effect. Contains a minimal "↑ Top" button.
- **`[+]` / `[-]` expand toggles:** Monospace, inline after the short text. The expanded detail block uses a CSS `max-height` transition (0.35s ease-in-out) with a coordinated opacity fade. This avoids the jarring snap of `display: none` toggling.
- **"▸ Additional recommendations":** Section-level toggle for bonus items. Rendered at 50% opacity — visually recessed to signal lower priority. Transforms to "▾" when expanded.
- **Source links:** Tiny (10px), 50% opacity, underlined, coloured to match the substance. Visible only within expanded details. Hover raises to 90% opacity. Open in a new tab (`target="_blank"`).
- **Charts:** 400ms animation duration. Tooltips show descriptive labels and numeric values. Chart grid lines are heavily suppressed (`rgba(255,255,255,0.08)`) to avoid visual noise.

### 5.8 Avoiding the AI-Generated Look — Design Principles

Common AI-generated dashboard patterns to deliberately avoid:

| AI-template pattern | Our countermeasure |
|---|---|
| Perfectly symmetric card grids | Asymmetric two-column layout (7/12 + 5/12). Left column is heavier — it carries the primary content. |
| Uniform corner radius on everything | Cards use `rounded-xl` (12px), but the Critical Focus inset uses `rounded-lg` (8px). Badges use `rounded-full`. Not everything is the same shape. |
| Centred everything | Headers are left-aligned on desktop. Only the disclaimer and footer are centred. The column weight is visually off-centre. |
| Flat, featureless background | Vertical gradient (lighter top → darker bottom) with `background-attachment: fixed`. Adds environmental depth. |
| Uniform spacing | Section spacing varies slightly: 8-unit gaps between phases, 10-unit gap between columns, 16-unit margin before the footer. The spacing is consistent within categories but not universally identical. |
| Every card identical | The Risk Analysis card has a chart with no text list. The Protocol Timeline intro card has no expand toggles. The Emergency Flags card has a unique red tint. Each card has a distinct internal structure. |
| Aggressive hover effects on everything | Hovers are subtle — opacity shifts and tint deepens. No scale transforms, no shadow explosions, no bouncing. |
| Cookie-cutter colour palette | Each substance brings its own accent colour, applied at varying opacities. The page visually transforms when switching substances — not just the data, but the ambient colour temperature. |

The overall impression should be: **someone who cares about information design built this by hand** — not that a prompt was fed into a UI generator.

### 5.9 Responsive Behaviour

- **Desktop (lg / ≥1024px):** Two-column grid (`grid-cols-12`). Left 7, right 5. Max-width `7xl` (80rem) with horizontal padding.
- **Tablet (sm–md / 640–1023px):** Single column. Navigation grid collapses to 3 columns. All content stacks vertically.
- **Mobile (<640px):** Single column. Navigation grid collapses to 2 columns. Header centres. Charts remain functional at reduced width.

### 5.10 Disclaimer Banner

Permanently visible at the top of the page, above the sticky header:

> ℹ️ This guide is for **educational and harm reduction purposes only**. It does not endorse substance use. In case of emergency, **call your local emergency number** and seek professional help immediately.

---

## 6. Sleep Deprivation & Sobriety Baseline

### 6.1 Rationale

Even fully sober individuals at festivals and nightlife events subject their bodies to significant physiological stress. The sober baseline section must educate on:

- **Circadian disruption:** Staying awake past the natural sleep window suppresses melatonin, elevates cortisol, and desynchronises peripheral organ clocks from the central pacemaker (suprachiasmatic nucleus).
- **Cognitive impairment from sleep loss:** After 17–19 hours of wakefulness, cognitive performance degrades to levels equivalent to a blood alcohol concentration of 0.05% (Williamson & Feyer, 2000). After 24 hours, this reaches 0.10% equivalent.
- **Thermoregulatory dysfunction:** Sleep deprivation impairs the hypothalamus's ability to regulate core body temperature, compounding the risk in hot, crowded environments.
- **Immunosuppression:** Even a single night of sleep deprivation reduces natural killer cell activity by approximately 70% (Irwin et al., 1996), increasing susceptibility to infections common in festival settings.
- **Exertional strain:** Prolonged dancing (moderate-to-high intensity aerobic exercise) depletes glycogen stores, causes cumulative micro-damage to muscles, and generates oxidative stress — all of which are repaired during sleep.

### 6.2 Presentation

The sober baseline covers the same four-phase timeline as every substance:
- **Before:** Sleep banking, nutritional loading, pre-hydration.
- **During:** Electrolyte-supplemented hydration, simple carbohydrate intake, heat management.
- **After:** Recovery nutrition (casein protein, magnesium), rehydration.
- **Next Morning:** Sunlight exposure, circadian realignment, strategic napping.

The risk chart for Sober/Baseline shows non-zero values for dehydration (1–2) and sleep deprivation (2), reinforcing that harm reduction begins before any substance enters the equation.

---

## 7. Data Layer Architecture

### 7.1 Canonical Data Source

All protocol data is stored in `data/protocols.json`. This is the single source of truth. The file `js/data.js` contains:
1. A `loadProtocolData()` function that attempts to `fetch()` the JSON file.
2. An inline fallback copy (`_inlineProtocols`) for environments where fetch fails (e.g., `file://` CORS restrictions during local development).

**When editing protocol data, both `protocols.json` and the inline copy in `data.js` must be updated to remain in sync.**

### 7.2 Application Logic

`js/app.js` handles:
- DOM caching and event binding
- Navigation button rendering and active-state management
- Protocol content rendering (essential + bonus tiered lists)
- Expandable `[+]` toggle logic
- Chart.js configuration (risk histogram + duration timeline)
- Colour theming (all colour operations derive from each substance's hex colour via `hexAlpha()`)
- Sticky header scroll behaviour

### 7.3 Styling

`css/styles.css` is minimal — only custom properties that cannot be handled by Tailwind CSS utility classes:
- Expandable detail transition (`max-height`, `opacity`)
- Dark scrollbar styling
- Disclaimer banner tinting
- Selection highlight

All layout and component styling is done inline via Tailwind CSS classes loaded from CDN.

---

## 8. Drug Interaction Data

The `resources/tripsit-combo/combos.json` file contains a machine-readable interaction matrix sourced from TripSit. This data classifies substance combinations into risk categories:

- **Synergy** — Effects are amplified positively
- **Low Risk & Synergy / Low Risk & Decrease** — Generally safe combinations
- **Caution** — Increased risk; proceed with awareness
- **Unsafe** — Significant danger
- **Dangerous** — Life-threatening; never combine

This dataset is available for future integration into a combination-checker feature.

---

## 9. Maintenance & Editorial Guidelines

### 9.1 Adding a New Substance

1. Add an entry to `data/protocols.json` following the existing schema.
2. Mirror the entry in the `_inlineProtocols` object in `js/data.js`.
3. Ensure every `detail` field has at least one entry in the `sources` array.
4. Assign a unique colour and emoji that are not already in use.
5. Place the substance in the navigation order according to European prevalence data.
6. Add corresponding reference files to the appropriate `resources/` subdirectories.

### 9.2 Updating Existing Data

- Cross-check any update against at least two independent sources.
- Update the `sources` array if new references are added.
- Keep `protocols.json` and `data.js` inline copy synchronised.

### 9.3 Content Review Checklist

Before publishing any content update:

- [ ] Every `short` text is a clear, actionable imperative statement.
- [ ] Every `detail` text explains the physiological or pharmacological mechanism.
- [ ] Every `detail` has at least one source in the `sources` array.
- [ ] Life-threatening warnings are prefixed with ⚠️.
- [ ] Duration data matches PsychonautWiki values (or is explicitly sourced otherwise).
- [ ] No claim is presented with confidence unless corroborated by ≥2 independent sources.
- [ ] Uncertain or debated effects are explicitly qualified as such.
- [ ] Substance ordering reflects current European prevalence data.
- [ ] The sober baseline is comprehensive and positioned first.

---

## 10. Dosing Information Architecture

### 10.1 Rationale

Dosing information is among the most safety-critical data on this website. Mis-dosing is one of the leading causes of harm in recreational substance use. Every substance profile must present dosing data prominently, following PsychonautWiki's established tier system.

### 10.2 User Flow: Substance → Route → Intensity → Information

After selecting a substance, the user encounters the following decision sequence **before** seeing the protocol timeline:

1. **Route of Administration** — Presented as a row of buttons with emoji icons, sorted by most common method first. The most common route is selected by default.
   - Example: Alcohol → only "Oral 🍺" (one option, pre-selected)
   - Example: 2C-B → "Oral 💊" (default) | "Insufflated 👃"
   - Example: Cannabis → "Smoked 🚬" (default) | "Oral (Edible) 🍪"
   - Example: Ketamine → "Insufflated 👃" (default) | "Oral 💊" | "Intramuscular 💉"

2. **Dosing Intensity** — A set of 3 prominent buttons below the route selector:
   - **Light** — Subtle effects, minimal risk
   - **Common** — Standard recreational dose (selected by default)
   - **Strong** — Intense effects, elevated risk

   Below these buttons, a **graduated scale** displays the full dosing range from Threshold through Light → Common → Strong → Heavy, with the currently selected range highlighted. This scale always links to PsychonautWiki's dosing guide for the substance.

3. **Dosing Display** — Shows the specific dose range in milligrams (or micrograms for LSD) for the selected route + intensity combination. Includes units appropriate to the substance.

### 10.3 Adaptive Information Display

The selected route and intensity combination modulates:

- **Effect Timeline** — Duration phases adjust to match the selected route (e.g., oral cannabis has much longer onset than smoked).
- **Risk Analysis** — Physiological strain values adjust with intensity:
  - Light: baseline risk values (may be reduced from common)
  - Common: standard risk values (default display)
  - Strong: elevated risk values with additional warnings
- **Warnings** — High-dose warnings appear automatically when "Strong" is selected for high-risk substances (e.g., MDMA >150 mg triggers explicit neurotoxicity warnings).
- **Protocol Tips** — The textual harm reduction advice remains the same across intensities (the advice is relevant regardless of dose), but critical warnings may be emphasised differently.

### 10.4 Dosing Data Model

Each substance's data object includes a `dosing` property keyed by route:

```json
{
  "dosing": {
    "Oral": {
      "unit": "mg",
      "threshold": 30,
      "light": { "min": 40, "max": 75 },
      "common": { "min": 75, "max": 140 },
      "strong": { "min": 140, "max": 180 },
      "heavy": 180,
      "note": "Max recommended: 1.5 mg/kg (men), 1.3 mg/kg (women)",
      "source": "https://psychonautwiki.org/wiki/MDMA"
    }
  }
}
```

- `unit` — Display unit (mg, µg, g, etc.)
- `threshold` — Minimum perceivable dose
- `light`, `common`, `strong` — Objects with `min`/`max` ranges
- `heavy` — Threshold above which effects become dangerously intense
- `note` — Optional safety annotation
- `source` — Direct link to PsychonautWiki dosing page

### 10.5 Route Emoji Convention

| Route | Emoji | Display Name |
|---|---|---|
| Oral | 💊 | Oral |
| Oral (drinking) | 🍺 | Drinking |
| Oral (edible) | 🍪 | Oral (Edible) |
| Smoked | 🚬 | Smoked |
| Insufflated | 👃 | Insufflated |
| Sublingual | 👅 | Sublingual |
| Intramuscular | 💉 | Intramuscular |

### 10.6 Visual Design of Dosing Panel

The dosing panel sits between the Active Substance Header and the Risk Analysis chart. It is a distinct card with the substance accent colour tinting. The layout is:

```
┌─────────────────────────────────────────┐
│  Route:  [🚬 Smoked] [🍪 Edible]       │
│                                         │
│  Intensity: [Light] [●Common] [Strong]  │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Threshold │ Light │Common│Strong│Heavy│
│  │    1mg    │ 2-4mg │4-10mg│10-25│25+mg│
│  └─────────────────────────────────┘    │
│  Source: PsychonautWiki — Cannabis ↗    │
└─────────────────────────────────────────┘
```

The graduated scale uses colour coding:
- Threshold: Gray
- Light: Green
- Common: Yellow
- Strong: Orange
- Heavy: Red

---

## 11. Legal & Ethical Notes

- This service does **not** provide medical advice. It provides general harm reduction information.
- The emergency instruction directs users to **call their local emergency number** (e.g., 112 in Europe, 911 in North America, 999 in the UK, 000 in Australia).
- No user data is collected. No analytics. No cookies. No tracking.
- All source material is attributed and linked.
- The service does not facilitate the purchase, sale, or distribution of controlled substances.
