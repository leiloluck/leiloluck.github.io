# Data Gathering Browse Log

Tracking all browsing activity for harm reduction data gathering.

---

## SaferParty.ch (saferparty.ch)

Swiss harm reduction organization. Content primarily in **German**.

### Substance Index
- **URL:** https://www.saferparty.ch/substanzen
- **Date browsed:** 2026-02-19
- **Notes:** Full substance index page. Contains links to all individual substance pages organized by category (Psychedelika, Stimulanzien, Downer, Dissoziativa, Cannabinoide, Medikamente, NPS, Opioide, Pflanzliche Drogen).

### Substance Pages Downloaded

| # | Substance | SaferParty Name | URL | Status | File |
|---|-----------|----------------|-----|--------|------|
| 1 | Alcohol | Alkohol | https://www.saferparty.ch/substanzen/alkohol | ✅ Downloaded | `saferparty/alkohol.md` |
| 2 | Cannabis | Cannabis | https://www.saferparty.ch/substanzen/cannabis | ✅ Downloaded | `saferparty/cannabis.md` |
| 3 | Ketamine | Ketamin | https://www.saferparty.ch/substanzen/ketamin | ✅ Downloaded | `saferparty/ketamin.md` |
| 4 | MDMA | MDMA | https://www.saferparty.ch/substanzen/mdma | ✅ Downloaded | `saferparty/mdma.md` |
| 5 | LSD | LSD | https://www.saferparty.ch/substanzen/lsd | ✅ Downloaded | `saferparty/lsd.md` |
| 6 | Mushrooms | Psilocybin / Psilocin (Pilze) | https://www.saferparty.ch/substanzen/psilocybin | ✅ Downloaded | `saferparty/psilocybin.md` |
| 7 | Cocaine | Kokain | https://www.saferparty.ch/substanzen/kokain | ✅ Downloaded | `saferparty/kokain.md` |
| 8 | Amphetamine | Amphetamin - Speed | https://www.saferparty.ch/substanzen/amphetamin-speed | ✅ Downloaded | `saferparty/amphetamin-speed.md` |
| 9 | Caffeine | Koffein | https://www.saferparty.ch/substanzen/koffein | ✅ Downloaded | `saferparty/koffein.md` |
| 10 | 2C-B | 2C-B (2C-x) | https://www.saferparty.ch/substanzen/2c-b-2c-x | ✅ Downloaded | `saferparty/2c-b-2c-x.md` |

### Content Structure per Page
Each SaferParty substance page contains:
- **Beschreibung** (Description)
- **Wirkung** (Effects)
- **Dauer** (Duration) — onset, duration of effects, after-effects
- **Dosierung** (Dosage) — dose ranges, appearance forms
- **Risiken** (Risks) — including Langzeitrisiken (long-term risks)
- **Safer Use** guidelines
- **Mischkonsum** (Drug Combinations) — specific interaction warnings
- **Sex** — sex-related risks (some substances)
- **Notfall** (Emergency) — emergency number 144

---

## DanceSafe (dancesafe.org)

US-based harm reduction organization. Content in **English**.

### Substance Pages Downloaded

| # | Substance | URL | Status | File |
|---|-----------|-----|--------|------|
| 1 | Alcohol | https://dancesafe.org/alcohol/ | ✅ Downloaded | `dancesafe/alcohol.md` |
| 2 | Cannabis | https://dancesafe.org/marijuana/ | ✅ Downloaded | `dancesafe/cannabis.md` |
| 3 | Ketamine | https://dancesafe.org/ketamine/ | ✅ Downloaded | `dancesafe/ketamine.md` |
| 4 | MDMA | https://dancesafe.org/mdma/ | ✅ Downloaded | `dancesafe/mdma.md` |
| 5 | LSD | https://dancesafe.org/lsd/ | ✅ Downloaded | `dancesafe/lsd.md` |
| 6 | Mushrooms | https://dancesafe.org/magic-mushrooms/ | ✅ Downloaded | `dancesafe/mushrooms.md` |
| 7 | Cocaine | https://dancesafe.org/cocaine/ | ✅ Downloaded | `dancesafe/cocaine.md` |
| 8 | 2C-B | https://dancesafe.org/2c-b/ | ✅ Downloaded | `dancesafe/2c-b.md` |
| 9 | Caffeine | https://dancesafe.org/caffeine/ | ⚠️ Limited | `dancesafe/caffeine.md` |

### Notes
- **No dedicated Amphetamine page.** The `/speed/` URL redirects to a Methamphetamine page.
- **Caffeine** page is a brief blog post, not a full drug info card like the others.
- Each full DanceSafe drug page contains: What is it?, Effects, Typical dose, Be careful!, and More harm reduction tips.

---

## DrugScience (drugscience.org.uk)

UK-based. Prof. David Nutt's organization. Scientific approach to drug policy and education.

### Status: ❌ Content inaccessible

DrugScience.org.uk is built on **Wix** (JavaScript-rendered). All content is loaded dynamically via client-side JavaScript and stored in a Wix `DrugInfo` data collection. **No readable text is extractable via HTTP tools** — only the Wix JS framework shell is returned.

- The site uses a dynamic router at `/drugs/{title}` pulling from a `DrugInfo` Wix Data collection.
- Accessible URLs (return 200 but no text): `/drugs/alcohol`, `/drugs/cannabis`, `/drugs/ketamine`, `/drugs/caffeine`
- URLs returning 404: `/drugs/mdma`, `/drugs/lsd`, `/drugs/cocaine`, `/drugs/psilocybin`, `/drugs/amphetamine`, `/drugs/2c-b`
- Wix Data API at `/_api/cloud-data/` requires authentication (returns 400).
- Browser-based access also failed due to `$HOME` environment variable not being set in the runtime environment.

**The site also has dedicated static pages** (e.g., `/alcohol`, `/cannabis`, `/mdma`, `/lsd`, `/cocaine`, `/psilocybin`, `/amphetamine`, `/caffeine`, `/ketamine`, `/2c-b`) but these are also Wix-rendered and contain no extractable text.

**Recommendation:** DrugScience content must be gathered manually by visiting the site in a web browser, or by using a tool that can execute JavaScript (e.g., Playwright/Puppeteer with proper environment setup).

## TripSit (tripsit.me)

Community-driven harm reduction project. Content in **English**. MediaWiki-based wiki accessible via HTTP.

### Substance Pages Downloaded

| # | Substance | URL | Status | File |
|---|-----------|-----|--------|------|
| 1 | Alcohol | https://wiki.tripsit.me/wiki/Alcohol | ✅ Downloaded | `tripsit/alcohol.md` |
| 2 | Cannabis | https://wiki.tripsit.me/wiki/Cannabis | ✅ Downloaded | `tripsit/cannabis.md` |
| 3 | Ketamine | https://wiki.tripsit.me/wiki/Ketamine | ✅ Downloaded | `tripsit/ketamine.md` |
| 4 | MDMA | https://wiki.tripsit.me/wiki/MDMA | ✅ Downloaded | `tripsit/mdma.md` |
| 5 | LSD | https://wiki.tripsit.me/wiki/LSD | ✅ Downloaded | `tripsit/lsd.md` |
| 6 | Mushrooms | https://wiki.tripsit.me/wiki/Mushrooms | ✅ Downloaded | `tripsit/mushrooms.md` |
| 7 | Cocaine | https://wiki.tripsit.me/wiki/Cocaine | ✅ Downloaded | `tripsit/cocaine.md` |
| 8 | Amphetamine | https://wiki.tripsit.me/wiki/Amphetamine | ✅ Downloaded | `tripsit/amphetamine.md` |
| 9 | Caffeine | https://wiki.tripsit.me/wiki/Caffeine | ✅ Downloaded | `tripsit/caffeine.md` |
| 10 | 2C-X | https://wiki.tripsit.me/wiki/2C-X | ✅ Downloaded | `tripsit/2c-x.md` |

### Content Structure per Page
Each TripSit wiki substance page typically contains:
- **Intro/Description** — Overview and pharmacology
- **History** — Historical context and discovery
- **Dosage** — Route-specific dose ranges
- **Effects** — Categorized as Positive, Neutral, Negative, After Effects
- **Harm Reduction** — Safety guidelines and drug interaction warnings
- **Chemistry and Pharmacology** — Mechanism of action, LD50, pharmacokinetics
- **Legal Status** — Country-specific scheduling

### Drug Combination Chart Data

| File | Source | Status |
|------|--------|--------|
| `tripsit-combo/combos.json` (496KB) | https://github.com/TripSit/drugs | ✅ Downloaded |
| `tripsit-combo/README.md` | https://wiki.tripsit.me/wiki/Drug_combinations | ✅ Created |

The combo JSON contains structured interaction data for all substance pairs with:
- **Status categories:** Dangerous, Unsafe, Caution, Low Risk & Synergy, Low Risk & No Synergy, Low Risk & Decrease
- **Notes** explaining each interaction
- **Academic sources/citations** for many entries

Attribution: TripSit (https://combo.tripsit.me). Data is free for non-commercial use with attribution.
