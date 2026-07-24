/*
    comboData.js — Drug combination data layer.
    Loads TripSit combos.json and provides lookup functions.
    Source: https://combo.tripsit.me / https://github.com/TripSit/drugs
*/

let comboData = null;

// ────────────────────────────────────────────
// Mapping: app substance ID → combos.json key
// ────────────────────────────────────────────
const COMBO_KEY_MAP = {
    'alcohol':         'alcohol',
    'caffeine':        'caffeine',
    'cannabis':        'cannabis',
    'mdma':            'mdma',
    'cocaine':         'cocaine',
    'amphetamine':     'amphetamines',
    'ketamine':        'ketamine',
    'lsd':             'lsd',
    'mushrooms':       'mushrooms',
    '2cb':             '2c-x',
    '4mmc':            'mephedrone',
    'cmc':             'mephedrone',
    'ghb':             'ghb/gbl',
    'gbl':             'ghb/gbl',
    'heroin':          'opioids',
    'methamphetamine': 'amphetamines'
};

// (COMBO_DISPLAY_INFO removed to strictly only use app substances)

// ────────────────────────────────────────────
// Risk levels — sort order and visual metadata
// ────────────────────────────────────────────
const RISK_LEVELS = {
    'Dangerous':              { order: 1, label: 'DANGEROUS',             icon: '☠️', color: '#ef4444' },
    'Unsafe':                 { order: 2, label: 'UNSAFE',                icon: '⚠️', color: '#f97316' },
    'Caution':                { order: 3, label: 'CAUTION',               icon: '⚡', color: '#eab308' },
    'Low Risk & Synergy':     { order: 4, label: 'LOW RISK · SYNERGY',    icon: '🔗', color: '#22c55e' },
    'Low Risk & Decrease':    { order: 5, label: 'LOW RISK · DECREASE',   icon: '📉', color: '#6b7280' },
    'Low Risk & No Synergy':  { order: 6, label: 'LOW RISK',              icon: '✅', color: '#6b7280' }
};

const RISK_GROUP_HEADERS = {
    1: '☠️ Dangerous Combinations',
    2: '⚠️ Unsafe Combinations',
    3: '⚡ Caution Required',
    4: '🔗 Low Risk — Synergy',
    5: '📉 Low Risk — Decreased Effects',
    6: '✅ Low Risk — Neutral'
};

// ────────────────────────────────────────────
// Curated combinations — fill documented gaps in TripSit's dataset.
// TripSit has no entries for several mephedrone (4-MMC) pairings, so the
// most relevant ones are supplied here, each source-cited and flagged
// `curated:true` so the UI can mark them as non-TripSit. Used only as a
// fallback when TripSit has no entry for the pair (see getComboEntry).
// ────────────────────────────────────────────
const CURATED_COMBOS = {
    'mephedrone': {
        'amphetamines': {
            status: 'Unsafe',
            note: "Two strong stimulants stacked together. PsychonautWiki warns this can drive heart rate and blood pressure to dangerous levels and compounds hyperthermia and neurotoxicity. Best avoided — if combined, keep doses low and watch for chest pain or overheating.",
            curated: true,
            sources: [
                { title: 'PsychonautWiki — Mephedrone', url: 'https://psychonautwiki.org/wiki/Mephedrone' },
                { title: 'checkit! — 4-MMC / Mephedron', url: 'https://checkit.wien/substanz/mephedron-4-mmc/' }
            ]
        },
        'cocaine': {
            status: 'Unsafe',
            note: "Both are potent stimulants; PsychonautWiki specifically flags mephedrone + cocaine as able to push heart rate and blood pressure to dangerous levels. Cocaine adds vasoconstriction and cardiotoxicity on top of mephedrone's own cardiac strain.",
            curated: true,
            sources: [
                { title: 'PsychonautWiki — Mephedrone', url: 'https://psychonautwiki.org/wiki/Mephedrone' }
            ]
        },
        'alcohol': {
            status: 'Caution',
            note: "Mephedrone masks alcohol's depressant effects, making accidental over-drinking easy. Animal studies also suggest co-use may worsen neurotoxicity (not confirmed in humans). Pace alcohol carefully and keep hydrated.",
            curated: true,
            sources: [
                { title: 'PsychonautWiki — Mephedrone', url: 'https://psychonautwiki.org/wiki/Mephedrone' },
                { title: 'Neurotoxicity Induced by Mephedrone — Review (PMC/NIH)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5771050/' }
            ]
        },
        'ketamine': {
            status: 'Caution',
            note: "Stimulant + dissociative. Both can provoke confusion, mania or psychosis, and PsychonautWiki notes the risk may be multiplied when combined. Stimulation can also mask ketamine's sedation, encouraging redosing. Use low doses in a calm setting.",
            curated: true,
            sources: [
                { title: 'PsychonautWiki — Mephedrone', url: 'https://psychonautwiki.org/wiki/Mephedrone' }
            ]
        }
    }
};

// ────────────────────────────────────────────
// Loading
// ────────────────────────────────────────────
async function loadComboData() {
    try {
        const response = await fetch('resources/tripsit-combo/combos.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        comboData = await response.json();
        console.log('[comboData] Loaded combos.json');
        return comboData;
    } catch (err) {
        console.warn('[comboData] Failed to load combos.json:', err.message);
        return null;
    }
}

// ────────────────────────────────────────────
// Lookup — bidirectional
// ────────────────────────────────────────────
function getComboEntry(keyA, keyB) {
    // TripSit data takes precedence wherever it exists.
    if (comboData) {
        if (comboData[keyA] && comboData[keyA][keyB]) return comboData[keyA][keyB];
        if (comboData[keyB] && comboData[keyB][keyA]) return comboData[keyB][keyA];
    }
    // Curated fallback fills documented gaps (e.g. mephedrone pairings).
    if (CURATED_COMBOS[keyA] && CURATED_COMBOS[keyA][keyB]) return CURATED_COMBOS[keyA][keyB];
    if (CURATED_COMBOS[keyB] && CURATED_COMBOS[keyB][keyA]) return CURATED_COMBOS[keyB][keyA];
    return null;
}

// ────────────────────────────────────────────
// Main API: get all combos for a substance
// Returns sorted array of combo objects
// ────────────────────────────────────────────
function getSubstanceCombos(substanceId) {
    if (!comboData || substanceId === 'sober') return [];

    const myComboKey = COMBO_KEY_MAP[substanceId];
    if (!myComboKey) return [];

    const results = [];

    // Ensure app.js globals are available
    if (typeof SUBSTANCE_ORDER === 'undefined' || typeof protocols === 'undefined') {
        return [];
    }

    for (const otherId of SUBSTANCE_ORDER) {
        if (otherId === 'sober' || otherId === substanceId) continue;

        const otherComboKey = COMBO_KEY_MAP[otherId];
        if (!otherComboKey) continue;

        // Prevent comparing a combo category to itself (e.g. amphetamine vs methamphetamine)
        if (otherComboKey === myComboKey) continue;

        // Bidirectional lookup
        const entry = getComboEntry(myComboKey, otherComboKey);
        if (!entry) continue;

        const riskInfo = RISK_LEVELS[entry.status];
        if (!riskInfo) continue;

        const appProto = protocols[otherId];
        if (!appProto) continue;

        results.push({
            comboKey: otherComboKey,
            displayName: appProto.name,
            displayEmoji: appProto.emoji,
            displayColor: appProto.color,
            isAppSubstance: true,
            status: entry.status,
            note: entry.note || null,
            sources: entry.sources || null,
            curated: entry.curated || false,
            sortOrder: riskInfo.order,
            riskInfo
        });
    }

    // Sort: dangerous first, then alphabetically within same level
    results.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.displayName.localeCompare(b.displayName);
    });

    return results;
}
