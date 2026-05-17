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
| 11 | Heroin | Heroin | https://www.saferparty.ch/substanzen/heroin | ✅ Downloaded | `saferparty/heroin.md` |
| 12 | Methamphetamine | Methamphetamin | https://www.saferparty.ch/substanzen/methamphetamin | ✅ Downloaded | `saferparty/methamphetamin.md` |

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
| 11 | Heroin | https://wiki.tripsit.me/wiki/Heroin | ✅ Downloaded | `tripsit/heroin.md` |

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

---

## checkit! Wien (checkit.wien)

Austrian drug checking and harm reduction service, operating since 1997. Project of Suchthilfe Wien gGmbH. Content primarily in **German**.

### About
- **Location:** Gumpendorfer Straße 8, 1060 Vienna, Austria
- **Services:** Anonymous, free, confidential drug checking (chemical analysis), substance information, counseling, outreach at nightlife events
- **URL:** https://checkit.wien
- **Date browsed:** 2026-03-31

### Substance Pages Downloaded

| # | Substance | checkit! Name | URL | Status | File |
|---|-----------|--------------|-----|--------|------|
| 1 | MDMA | Ecstasy / MDMA | https://checkit.wien/substanz/ecstasy-mdma/ | ✅ Downloaded | `checkit/mdma.md` |
| 2 | Cocaine | Kokain | https://checkit.wien/substanz/kokain/ | ✅ Downloaded | `checkit/cocaine.md` |
| 3 | Ketamine | Ketamin | https://checkit.wien/substanz/ketamin/ | ✅ Downloaded | `checkit/ketamine.md` |
| 4 | Amphetamine | Speed / Amphetamin | https://checkit.wien/substanz/speed-amphetamin/ | ✅ Downloaded | `checkit/amphetamine.md` |
| 5 | LSD | LSD | https://checkit.wien/substanz/lsd/ | ✅ Downloaded | `checkit/lsd.md` |
| 6 | Cannabis | Cannabis | https://checkit.wien/substanz/cannabis/ | ✅ Downloaded | `checkit/cannabis.md` |
| 7 | 2C-B | 2C-B | https://checkit.wien/substanz/2c-b/ | ✅ Downloaded | `checkit/2c-b.md` |
| 8 | Mephedron | Mephedron (4-MMC) | https://checkit.wien/substanz/mephedron-4-mmc/ | ✅ Downloaded | `checkit/mephedron.md` |
| 9 | Alcohol | Alkohol | https://checkit.wien/substanz/alkohol/ | ✅ Downloaded | `checkit/alcohol.md` |
| 10 | Mushrooms | Pilze (Psilocybin) | https://checkit.wien/substanz/pilze/ | ✅ Downloaded | `checkit/mushrooms.md` |
| 11 | GHB/GBL | GHB/GBL | https://checkit.wien/substanz/ghb-gbl/ | ✅ Downloaded | `checkit/ghb-gbl.md` |
| 12 | Heroin | Heroin | https://checkit.wien/substanz/heroin/ | ✅ Downloaded | `checkit/heroin.md` |
| 13 | Methamphetamine | Methamphetamin | https://checkit.wien/substanz/methamphetamin/ | ✅ Downloaded | `checkit/methamphetamine.md` |

### Content Structure per Page
Each checkit! substance page contains:
- **Beschreibung** (Description) — chemical class, appearance, forms
- **Wirkung** (Effects) — desired and undesired effects, mechanism of action
- **Dauer** (Duration) — onset, peak, total duration by route
- **Dosierung** (Dosage) — dose ranges where available
- **Risiken / Langzeitfolgen** (Risks / Long-term consequences)
- **Kontraindikationen** (Contraindications — when never to use)
- **Mischkonsum** (Drug Combinations) — specific interaction warnings
- **Risikoreduzierung** (Safer Use) — harm reduction guidelines

### Additional Pages Available (not yet downloaded)
32 substance pages total, including: 25B-NBOMe, 25C-NBOMe, 5-MeO-DMT, Anabole Steroide, Benzos, DMT, DOB, DOM, Edibles, Methadon, MXE, MDPV, Opium, Research Chemicals, Synthetische Cannabinoide, Synthetische Opioide.

---

## Drugchecking Berlin (drugchecking.berlin)

Berlin's publicly funded drug checking service. Content in **German**.

### About
- **Funded by:** Berlin Senate Department for Science, Health, and Care
- **Evaluated by:** Charité Berlin
- **Partners:** Fixpunkt gGmbH, Schwulenberatung Berlin, vista - Misfit
- **URL:** https://drugchecking.berlin
- **Date browsed:** 2026-03-31

### Substance Pages Downloaded

| # | Substance | URL | Status | File |
|---|-----------|-----|--------|------|
| 1 | MDMA/Ecstasy | https://drugchecking.berlin/substanzen/mdma-ecstasy | ✅ Downloaded | `drugchecking-berlin/mdma.md` |
| 2 | Cocaine & Crack | https://drugchecking.berlin/substanzen/kokain-crack | ✅ Downloaded | `drugchecking-berlin/cocaine.md` |
| 3 | Ketamine | https://drugchecking.berlin/substanzen/ketamin | ✅ Downloaded | `drugchecking-berlin/ketamine.md` |
| 4 | Amphetamine/Speed | https://drugchecking.berlin/substanzen/amphetamin-speed | ✅ Downloaded | `drugchecking-berlin/amphetamine.md` |
| 5 | Heroin/Diamorphin | https://drugchecking.berlin/substanzen/diamorphin-heroin | ✅ Downloaded | `drugchecking-berlin/heroin.md` |
| 6 | Methamphetamine/Crystal | https://drugchecking.berlin/substanzen/methamphetamin-crystal | ✅ Downloaded | `drugchecking-berlin/methamphetamine.md` |

### Special Content

| Content | URL | Status | File |
|---------|-----|--------|------|
| First Aid / Emergency Protocols | https://drugchecking.berlin/substanzen/erste-hilfe | ✅ Downloaded | `drugchecking-berlin/erste-hilfe.md` |
| Drug Alerts (March 2026) | https://drugchecking.berlin/aktuelle-warnungen | ✅ Downloaded | `drugchecking-berlin/alerts-2026-03.md` |

### Content Structure per Page
Each Drugchecking Berlin substance page contains:
- **Substanz** (Description) — chemical class, forms, adulterants found
- **Konsumformen** (Routes of administration) — with onset and duration
- **Dosierungen** (Dosage) — route-specific dose ranges
- **Wirkungen** (Effects) — mechanism, desired effects
- **Nebenwirkungen** (Side effects) — acute, after-effects, long-term
- **Nachweiszeiten** (Detection times) — blood, urine, saliva
- **Safer Use** — harm reduction guidelines
- **Wechselwirkungen** (Drug combinations/interactions)
- **Kontraindikationen** (Contraindications)
- **Strategien für Sex unter Substanzeinfluss** (Sexual health / chemsex guidance)

### Drug Alerts Summary (March 2026)
Key patterns from Berlin drug checking:
- **Massive mislabeling in cathinone market:** 3-MMC and 4-MMC frequently contain entirely different substances
- **N-Ethylpentedron** and **2-MMC** commonly substituted for mephedron
- **4-CMC (Clephedrone)** found as adulterant/substitute
- **High-dose MDMA tablets** circulating
- **Tusi/Tucibi** ("pink cocaine") MDMA-ketamine mixtures found

### Additional Pages Available (not yet downloaded)
2C-B, Alkohol, Cannabis, GHB/GBL, LSD, Mephedron, Psilocybin/Zauberpilze.

---

## Energy Control (energycontrol.org)

Spanish harm reduction program by Asociación Bienestar y Desarrollo (ABD). Content in **Spanish**.

### About
- **Location:** Spain (Cataluña, Andalucía, Madrid, Islas Baleares)
- **Services:** Drug checking / substance analysis (in-person and by mail), international analysis service (energycontrol-international.org), substance information, outreach at festivals
- **URL:** https://energycontrol.org
- **Date browsed:** 2026-03-31

### Substance Pages Downloaded

| # | Substance | URL | Status | File |
|---|-----------|-----|--------|------|
| 1 | MDMA | https://energycontrol.org/sustancias/mdma/ | ✅ Downloaded | `energycontrol/mdma.md` |
| 2 | Cocaine | https://energycontrol.org/sustancias/cocaina/ | ✅ Downloaded | `energycontrol/cocaine.md` |
| 3 | Ketamine | https://energycontrol.org/sustancias/ketamina/ | ✅ Downloaded | `energycontrol/ketamine.md` |
| 4 | LSD | https://energycontrol.org/sustancias/lsd/ | ✅ Downloaded | `energycontrol/lsd.md` |

### Content Structure per Page
Each Energy Control substance page contains:
- **Descripción** (Description) — history, chemistry, forms
- **Efectos deseados** (Desired effects)
- **Dosificación** (Dosage) — route-specific dose ranges with low/medium/high
- **Duración** (Duration) — onset, peak, total
- **Riesgos** (Risks) — common, serious/toxic, overdose
- **Interacciones** (Drug interactions) — detailed combination warnings including medication interactions
- **Recomendaciones** (Harm reduction recommendations) — extensive, practical guidelines

### Notes
- Energy Control pages are notably comprehensive, with detailed medication interaction warnings (HIV meds, antidepressants, beta-blockers, etc.)
- They emphasize "Drug, Set, Setting" framework throughout
- Their international drug checking service allows mail-in analysis from any country

### Additional Pages Available (not yet downloaded)
Alcohol, Caffeine, Cannabis, Cathinones, GHB, DMT, and many more (3 pages of substances on their index).

---

## The Loop (wearetheloop.org)

UK's first dedicated drug checking charity. Content in **English**.

### About
- **Location:** United Kingdom
- **Charity Number:** 1200533
- **Services:** Drug checking at festivals and nightlife events (MULTI approach), year-round onsite testing, training, research
- **URL:** https://wearetheloop.org
- **Date browsed:** 2026-03-31

### Content Downloaded

| Content | URL | Status | File |
|---------|-----|--------|------|
| Drug Alerts (2015–2025) | https://wearetheloop.org/drug-alerts | ✅ Downloaded | `theloop/drug-alerts.md` |

### Drug Alerts Key Findings
The Loop's drug alerts database provides crucial real-world UK festival testing data:
- **High-dose MDMA pills** consistently found (250–300+ mg, 2–3× common dose)
- **Widespread misselling**: ~30% of "MDMA" samples at some festivals were caffeine
- **Synthetic cathinones** (4-CMC, N-ethylpentylone, eutylone) sold as MDMA
- **Nitazenes** (2025): Synthetic opioids in pills linked to 2 deaths — most dangerous current threat
- **NBOMe** compounds sold as LSD (significant overdose risk)
- **DOx compounds** sold as LSD (effects lasting up to 48 hours)
- Identical-looking pills contained completely different drugs depending on color

### Notes
- The Loop does not publish individual substance information pages; their primary contribution is drug alert data from real-world testing
- Publications and posters/infographics available at `/publications` and `/posters-infographics`

---

## Jellinek (jellinek.nl)

Dutch addiction care and harm reduction organization. Content in **Dutch and English**.

### About
- **Location:** Amsterdam, Netherlands (part of Arkin mental health)
- **Helpline:** 088 505 1220
- **Services:** Substance information, addiction treatment, counseling, prevention, self-assessment tests
- **URL:** https://www.jellinek.nl/english/
- **Date browsed:** 2026-03-31

### Substance Pages Downloaded

| # | Substance | URL | Status | File |
|---|-----------|-----|--------|------|
| 1 | MDMA/XTC | https://www.jellinek.nl/en/alcohol-drugs-behavior/xtc-mdma/ | ✅ Downloaded | `jellinek/mdma.md` |
| 2 | Cocaine | https://www.jellinek.nl/en/alcohol-drugs-behavior/cocaine/ | ✅ Downloaded | `jellinek/cocaine.md` |
| 3 | Speed | https://www.jellinek.nl/en/alcohol-drugs-behavior/speed-amphetamine/ | ✅ Downloaded | `jellinek/speed.md` |
| 4 | GHB | https://www.jellinek.nl/en/alcohol-drugs-behavior/ghb/ | ✅ Downloaded | `jellinek/ghb.md` |
| 5 | Cannabis | https://www.jellinek.nl/en/alcohol-drugs-behavior/cannabis/ | ✅ Downloaded | `jellinek/cannabis.md` |
| 6 | 3-MMC | https://www.jellinek.nl/en/alcohol-drugs-behavior/3-mmc/ | ✅ Downloaded | `jellinek/3-mmc.md` |

### Content Structure per Page
Each Jellinek substance page contains:
- **What is it?** — Description and forms
- **Effects** — Using Drug/Set/Setting framework
- **Duration** — Onset and effects timeline
- **Dosage** — Route-specific ranges
- **Short-term risks** — Acute dangers
- **Long-term risks** — Chronic effects, dependence, withdrawal
- **Tips** — Practical safer use guidelines

### Notes
- Available in **English** — one of the few European sources with full English translations
- Emphasizes **Drug, Set, Setting** framework throughout
- Notable coverage of **addiction/withdrawal phases** (especially cocaine, GHB)
- Each substance also has a "Stop or cut down" sub-page with cessation guidance
- GHB coverage is particularly strong, emphasizing the extremely narrow therapeutic window

### Additional Pages Available (not yet downloaded)
Alcohol, Tranquillisers/Sleeping Pills, Tobacco/Nicotine.
