/*
    app.js: Application logic for Harm Reduction Protocols Dashboard.
    Handles: Navigation, content rendering, expandable items, color theming, Chart.js config (dark mode),
             scroll-reactive OKLCH background gradient, effect timeline legend.
    Depends on: data.js (must be loaded first), Chart.js CDN, Tailwind CDN.
*/

// Display order by pharmacological class (stimulants → empathogens → psychedelics → dissociatives → depressants → opioids)
const SUBSTANCE_ORDER = ['sober', 'caffeine', 'cocaine', 'amphetamine', 'methamphetamine', 'mdma', '4mmc', 'cmc', 'lsd', 'mushrooms', '2cb', 'dmt', 'ketamine', 'nitrous', 'poppers', 'cannabis', 'alcohol', 'ghb', 'gbl', 'benzodiazepines', 'heroin'];

// State
let currentProtocol = 'sober';
let riskChart = null;
let durationChart = null;
let currentIntensity = 'common';
let currentRouteIndex = 0;
let _durationRoutes = null; // current routes used in duration chart (for tooltip access)
let currentTab = 'tab-protocol';

// DOM refs (assigned after DOMContentLoaded)
let navContainer, modeDisplay, introModifier, contentBefore, contentDuring,
    focusDuring, contentAfter, contentNextMorning,
    emergencyFlags, riskList, riskCanvas, durationCanvas, activeHeader,
    activeHeaderName, activeHeaderType, activeHeaderEmoji,
    sectionCards, sectionBadges, focusBorderEl,
    dosingPanel, dosingCard, routeButtons,
    doseNote, doseWarning, doseSourceLink, doseDisplayText;

document.addEventListener('DOMContentLoaded', async () => {
    // Cache DOM
    navContainer = document.getElementById('substance-nav');
    modeDisplay = document.getElementById('current-mode-display');
    introModifier = document.getElementById('intro-modifier');
    contentBefore = document.getElementById('content-before');
    contentDuring = document.getElementById('content-during');
    focusDuring = document.getElementById('focus-during');
    contentAfter = document.getElementById('content-after');
    contentNextMorning = document.getElementById('content-next-morning');
    emergencyFlags = document.getElementById('emergency-flags');
    riskList = document.getElementById('risk-list');
    riskCanvas = document.getElementById('riskChart').getContext('2d');
    durationCanvas = document.getElementById('durationBar').getContext('2d');
    activeHeader = document.getElementById('active-substance-header');
    activeHeaderName = document.getElementById('active-substance-name');
    activeHeaderType = document.getElementById('active-substance-type');
    activeHeaderEmoji = document.getElementById('active-substance-emoji');
    sectionCards = document.querySelectorAll('.section-card');
    sectionBadges = document.querySelectorAll('.section-badge');
    focusBorderEl = document.getElementById('focus-border');

    // Dosing panel DOM refs
    dosingPanel = document.getElementById('dosing-panel');
    dosingCard = document.getElementById('dosing-card');
    routeButtons = document.getElementById('route-buttons');
    doseNote = document.getElementById('dose-note');
    doseWarning = document.getElementById('dose-warning');
    doseSourceLink = document.getElementById('dose-source-link');
    doseDisplayText = document.getElementById('dose-display-text');

    const riskInfoBtn = document.getElementById('risk-info-btn');
    if (riskInfoBtn) riskInfoBtn.addEventListener('click', toggleRiskInfo);

    // Sticky Header Scroll Listener
    window.addEventListener('scroll', () => {
        const stickyHeader = document.getElementById('sticky-header');
        if (window.scrollY > 300) {
            stickyHeader.classList.remove('-translate-y-full');
        } else {
            stickyHeader.classList.add('-translate-y-full');
        }
    });

    // Load data
    const data = await loadProtocolData();
    if (!data) return;

    // Load combo data (non-blocking, combos are supplementary)
    await loadComboData();

    initNavigation();
    loadProtocol('sober');
});

// --- Navigation ---
function initNavigation() {
    const activeCount = SUBSTANCE_ORDER.filter(id => protocols[id]).length;
    const isOdd = activeCount % 2 !== 0;

    SUBSTANCE_ORDER.forEach(id => {
        const proto = protocols[id];
        if (!proto) return;
        const btn = document.createElement('button');
        btn.innerHTML = `<span class="text-base mr-1">${proto.emoji}</span> ${proto.name}`;
        btn.dataset.id = proto.id;

        // If odd total count, sober button spans full width on mobile (2-col grid)
        if (isOdd && id === 'sober') {
            btn.dataset.wide = '1';
        }

        applyButtonDefault(btn, proto.color);

        btn.onmouseenter = () => {
            if (btn.dataset.id !== currentProtocol) applyButtonHover(btn, proto.color);
        };
        btn.onmouseleave = () => {
            if (btn.dataset.id !== currentProtocol) {
                applyButtonDefault(btn, proto.color);
            }
        };

        btn.onclick = () => loadProtocol(proto.id);
        navContainer.appendChild(btn);
    });
}

// --- Folder Themes ---
const FOLDER_THEMES = {
    'tab-risk': {
        bg: '#33110b', // Deep poppy red
        border: '#662211',
        text: '#ff8a66'
    },
    'tab-protocol': {
        bg: '#0d1b2a', // Deep poppy blue
        border: '#1a365d',
        text: '#66ccff'
    },
    'tab-combos': {
        bg: '#250d30', // Deep poppy purple
        border: '#4a1b60',
        text: '#d18aef'
    }
};

// Tab order for slide direction (Protocol leads, the practical guide comes first)
const TAB_ORDER = ['tab-protocol', 'tab-risk', 'tab-combos'];

// --- Tabs ---
window.switchTab = function(tabId) {
    const newIndex = TAB_ORDER.indexOf(tabId);
    const oldIndex = TAB_ORDER.indexOf(currentTab);
    const shouldAnimate = oldIndex !== newIndex && oldIndex >= 0;
    const goingRight = newIndex > oldIndex;

    currentTab = tabId;
    const theme = FOLDER_THEMES[tabId];

    // Hide all tab contents completely
    document.querySelectorAll('.tab-content').forEach(el => {
        el.style.display = 'none';
        el.classList.add('hidden');
        el.classList.remove('block');
        el.classList.remove('tab-slide-in-right', 'tab-slide-in-left');
    });

    // Show target tab content with slide animation
    const target = document.getElementById(tabId);
    if (target) {
        target.style.display = 'block';
        target.classList.remove('hidden');
        target.classList.add('block');
        if (shouldAnimate) {
            target.classList.add(goingRight ? 'tab-slide-in-right' : 'tab-slide-in-left');
        }
    }

    // Charts are built while their tab is display:none, so Chart.js measures a
    // 0x0 container and writes width:0;height:0 onto the canvas. Resizing once the
    // tab is actually on screen is what makes the chart appear.
    if (riskChart) riskChart.resize();
    if (durationChart) durationChart.resize();

    // Update the folder body background and border
    const folderBody = document.getElementById('tab-folder-body');
    if (folderBody) {
        folderBody.style.background = `linear-gradient(to bottom, ${theme.bg} 0%, rgba(13,13,12,0) 100%)`;
        folderBody.style.borderColor = theme.border;
        folderBody.style.borderBottomColor = 'transparent';
    }

    // Update tab buttons. Each tab wears its own colour so they read as distinct even
    // at rest; the active one deepens, lifts, and merges its bottom edge into the panel.
    const tabBase = 'tab-btn flex-1 max-w-[150px] py-3 px-2 sm:px-4 text-[13px] sm:text-sm font-bold transition-all rounded-t-xl border-2 relative';
    document.querySelectorAll('.tab-btn').forEach(btn => {
        const btnTabId = btn.id.replace('btn-', '');
        const btnTheme = FOLDER_THEMES[btnTabId] || theme;
        if (btn.id === 'btn-' + tabId) {
            // Active tab: deep fill, raised, bottom border merges into the folder body
            btn.className = tabBase + ' z-20 translate-y-[1px] shadow-[0_-6px_18px_rgba(0,0,0,0.35)]';
            btn.style.backgroundColor = theme.bg;
            btn.style.borderColor = theme.border;
            btn.style.borderBottomColor = 'transparent';
            btn.style.color = theme.text;
        } else {
            // Inactive tab: its own colour, muted (tinted fill, colour text + outline)
            btn.className = tabBase + ' z-10';
            btn.style.backgroundColor = hexAlpha(btnTheme.text, 0.06);
            btn.style.borderColor = hexAlpha(btnTheme.border, 0.7);
            btn.style.borderBottomColor = theme.border;
            btn.style.color = hexAlpha(btnTheme.text, 0.75);
        }
    });
};

// Rest and selected states are deliberately far apart. At rest a button is a dim
// outline on near-black; selected, it is filled solid with its accent, carries
// text in whichever of black/white contrasts, and sits inside a bright ring plus
// a wide glow. The reader should never have to compare two buttons to tell which
// one is on.
function applyButtonDefault(btn, color) {
    btn.className = 'p-3 text-sm font-bold transition-all duration-150 border-2 cursor-pointer rounded-xl';
    if (btn.dataset.wide) btn.className += ' col-span-2 sm:col-span-1';
    btn.style.backgroundColor = 'rgba(255,255,255,0.025)';
    btn.style.borderColor = hexAlpha(color, 0.3);
    btn.style.color = mixHex(color, '#ffffff', 0.3);
    btn.style.opacity = '0.6';
    btn.style.boxShadow = '0 3px 0 rgba(0,0,0,0.5)';
    btn.style.transform = 'translateY(0)';
}

function applyButtonHover(btn, color) {
    btn.style.backgroundColor = hexAlpha(color, 0.16);
    btn.style.borderColor = hexAlpha(color, 0.75);
    btn.style.color = mixHex(color, '#ffffff', 0.2);
    btn.style.opacity = '0.95';
    btn.style.boxShadow = `0 3px 0 rgba(0,0,0,0.5), 0 0 14px ${hexAlpha(color, 0.25)}`;
    btn.style.transform = 'translateY(0)';
}

function applyButtonActive(btn, color) {
    btn.className = 'p-3 text-sm font-bold transition-all duration-150 border-2 cursor-pointer rounded-xl nav-btn-active';
    if (btn.dataset.wide) btn.className += ' col-span-2 sm:col-span-1';
    const fill = selectedFill(color);
    btn.style.backgroundColor = fill;
    btn.style.borderColor = mixHex(fill, '#ffffff', 0.6);
    btn.style.color = contrastText(fill);
    btn.style.opacity = '1';
    btn.style.boxShadow = `0 0 0 3px ${hexAlpha(color, 0.35)}, 0 5px 0 rgba(0,0,0,0.55), 0 0 24px ${hexAlpha(color, 0.8)}, 0 0 60px ${hexAlpha(color, 0.4)}`;
    btn.style.transform = 'translateY(-2px)';
}


// --- Load Protocol ---
function loadProtocol(id) {
    currentProtocol = id;
    const data = protocols[id];

    // 1. Update nav buttons
    Array.from(navContainer.children).forEach(btn => {
        const proto = protocols[btn.dataset.id];
        if (btn.dataset.id === id) {
            applyButtonActive(btn, data.color);
        } else {
            applyButtonDefault(btn, proto.color);
        }
    });

    // 2. Active substance header
    activeHeaderName.textContent = data.name;
    activeHeaderType.textContent = data.type;
    activeHeaderEmoji.textContent = data.emoji;
    activeHeader.style.backgroundColor = hexAlpha(data.color, 0.1);
    activeHeader.style.borderColor = hexAlpha(data.color, 0.35);
    activeHeaderName.style.color = data.color;

    // 2b. Background accent shift: subtle radial glow matching selected substance
    document.documentElement.style.setProperty('--accent-color', data.color);
    if (data.id === 'sober') {
        document.documentElement.classList.remove('accent-active');
    } else {
        document.documentElement.classList.add('accent-active');
    }

    // 2a. Tabs Update (keep current tab, apply color)
    switchTab(currentTab);

    // 2a. Dosing panel
    currentRouteIndex = 0;
    currentIntensity = 'common';
    renderDosingPanel(data);

    // 2b. Sticky Header Update
    document.getElementById('sticky-name').textContent = data.name;
    document.getElementById('sticky-type').textContent = data.type;
    document.getElementById('sticky-emoji').textContent = data.emoji;
    document.getElementById('sticky-name').style.color = data.color;


    // 3. Update header mode display
    modeDisplay.textContent = data.name;
    modeDisplay.style.color = data.color;
    introModifier.textContent = `Displaying protocols for: ${data.name} (${data.type})`;
    introModifier.style.color = data.color;

    // 4. Render expandable lists (support both flat arrays and { essential, bonus } objects)
    renderSection(contentBefore, data.phases.before, data.color);
    const duringData = data.phases.during.essential
        ? { essential: data.phases.during.essential, bonus: data.phases.during.bonus }
        : data.phases.during.items;
    renderSection(contentDuring, duringData, data.color);
    renderSection(contentAfter, data.phases.after, data.color);
    renderSection(contentNextMorning, data.phases.next_morning, data.color);

    // 5. Focus text
    focusDuring.textContent = data.phases.during.focus;

    // 6. Color-themed section borders
    sectionCards.forEach(card => {
        card.style.borderColor = hexAlpha(data.color, 0.3);
    });
    sectionBadges.forEach(badge => {
        badge.style.backgroundColor = hexAlpha(data.color, 0.18);
        badge.style.color = data.color;
    });
    if (focusBorderEl) {
        focusBorderEl.style.borderLeftColor = data.color;
        focusBorderEl.style.backgroundColor = hexAlpha(data.color, 0.05);
    }

    // 7. Risks + sober context panel
    const soberPanel = document.getElementById('sober-context-panel');
    if (id === 'sober') {
        emergencyFlags.classList.add('hidden');
        if (doseDisplayText) doseDisplayText.classList.add('hidden');
        if (soberPanel) soberPanel.classList.remove('hidden');
    } else {
        emergencyFlags.classList.remove('hidden');
        riskList.innerHTML = data.risks.map(r => `<li>${r}</li>`).join('');
        if (soberPanel) soberPanel.classList.add('hidden');
    }

    // 8. Charts
    updateCharts(data, id === 'sober');
    renderRiskMeta(data);

    // 9. Drug Combinations
    renderCombosSection(data);
    renderDangerCombos(data);
}

// --- Dosing Panel ---
// Not every dose table comes from PsychonautWiki: six of them cite SaferParty,
// Jellinek or TripSit, so the link has to name whatever it actually points at.
const DOSE_SOURCE_NAMES = {
    'psychonautwiki.org': 'PsychonautWiki',
    'www.saferparty.ch': 'SaferParty',
    'en.saferparty.ch': 'SaferParty',
    'www.jellinek.nl': 'Jellinek',
    'wiki.tripsit.me': 'TripSit',
    'drugchecking.berlin': 'Drugchecking Berlin',
    'checkit.wien': 'checkit! Wien'
};

function renderDosingPanel(data) {
    if (!data.dosing || data.id === 'sober') {
        dosingPanel.classList.add('hidden');
        if (durationChart) { durationChart.destroy(); durationChart = null; }
        renderTimelineLegend(null);
        const headerDoseEl = document.getElementById('current-dose-display');
        if (headerDoseEl) headerDoseEl.textContent = '';
        return;
    }
    dosingPanel.classList.remove('hidden');
    dosingCard.style.borderColor = hexAlpha(data.color, 0.35);

    const routeNames = Object.keys(data.dosing);
    const defaultIdx = data.routes ? data.routes.findIndex(r => r.isDefault) : 0;
    currentRouteIndex = defaultIdx >= 0 ? defaultIdx : 0;

    routeButtons.innerHTML = routeNames.map((name, i) => {
        const route = data.routes ? data.routes.find(r => r.name === name) : null;
        const emoji = route && route.emoji ? route.emoji : '💊';
        const label = route && route.displayName ? route.displayName : name;
        return `<button class="route-btn" data-route="${i}" onclick="setRoute(${i})">${emoji} ${label}</button>`;
    }).join('');

    updateDosingDisplay(data);
}

function updateDosingDisplay(data) {
    if (!data.dosing) return;
    const color = data.color;
    const routeNames = Object.keys(data.dosing);
    const routeName = routeNames[currentRouteIndex] || routeNames[0];
    const dose = data.dosing[routeName];
    if (!dose) return;

    const unit = dose.unit || 'mg';

    // Update route button states
    routeButtons.querySelectorAll('.route-btn').forEach((btn, i) => {
        if (i === currentRouteIndex) {
            const fill = selectedFill(color);
            btn.style.backgroundColor = fill;
            btn.style.borderColor = mixHex(fill, '#ffffff', 0.6);
            btn.style.color = contrastText(fill);
            btn.style.opacity = '1';
            btn.style.boxShadow = `0 0 0 3px ${hexAlpha(color, 0.3)}, 0 4px 0 rgba(0,0,0,0.5), 0 0 20px ${hexAlpha(color, 0.7)}`;
            btn.style.transform = 'translateY(-2px)';
        } else {
            btn.style.backgroundColor = 'rgba(255,255,255,0.025)';
            btn.style.borderColor = 'rgba(255,255,255,0.14)';
            btn.style.color = 'rgba(255,255,255,0.45)';
            btn.style.opacity = '0.7';
            btn.style.boxShadow = '0 3px 0 rgba(0,0,0,0.5)';
            btn.style.transform = 'translateY(0)';
        }
    });

    // The unit is stated once above the row; the buttons carry numbers only, so a
    // long unit string ('mg diazepam-eq.') can no longer overflow five small boxes.
    const unitLabel = document.getElementById('dose-unit-label');
    if (unitLabel) {
        unitLabel.textContent = unit;
        unitLabel.style.color = hexAlpha(color, 0.9);
    }

    // Populate tier button values (numbers only)
    document.getElementById('val-threshold').textContent = dose.threshold != null ? `${dose.threshold}` : '–';
    document.getElementById('val-light').textContent = dose.light ? `${dose.light.min}–${dose.light.max}` : '–';
    document.getElementById('val-common').textContent = dose.common ? `${dose.common.min}–${dose.common.max}` : '–';
    document.getElementById('val-strong').textContent = dose.strong ? `${dose.strong.min}–${dose.strong.max}` : '–';
    document.getElementById('val-heavy').textContent = dose.heavy != null ? `${dose.heavy}+` : '–';

    // Highlight selected tier button
    const tiers = ['threshold', 'light', 'common', 'strong', 'heavy'];
    tiers.forEach(lvl => {
        const btn = document.getElementById('tier-' + lvl);
        if (!btn) return;
        const tierColor = getComputedStyle(btn).getPropertyValue('--tier-color').trim();
        const tc = tierColor || color;
        if (lvl === currentIntensity) {
            const fill = selectedFill(tc);
            btn.style.backgroundColor = fill;
            btn.style.borderColor = mixHex(fill, '#ffffff', 0.6);
            btn.style.color = contrastText(fill);
            btn.style.opacity = '1';
            btn.style.boxShadow = `0 0 0 3px ${hexAlpha(tc, 0.3)}, 0 4px 0 rgba(0,0,0,0.5), 0 0 20px ${hexAlpha(tc, 0.7)}`;
            btn.style.transform = 'translateY(-2px)';
        } else {
            btn.style.backgroundColor = 'rgba(255,255,255,0.025)';
            btn.style.borderColor = hexAlpha(tc, 0.28);
            btn.style.color = mixHex(tc, '#ffffff', 0.3);
            btn.style.opacity = '0.6';
            btn.style.boxShadow = '0 3px 0 rgba(0,0,0,0.5)';
            btn.style.transform = 'translateY(0)';
        }
    });

    // Dose display text (below risk profile chart)
    if (doseDisplayText) {
        const tierColors = { threshold: '#6b7280', light: '#22c55e', common: '#eab308', strong: '#f97316', heavy: '#ef4444' };
        const tierLabels = { threshold: 'Threshold', light: 'Light', common: 'Common', strong: 'Strong', heavy: 'Heavy' };
        let doseRange = '–';
        if (currentIntensity === 'threshold' && dose.threshold != null) doseRange = `${dose.threshold} ${unit}`;
        else if (currentIntensity === 'heavy' && dose.heavy != null) doseRange = `${dose.heavy}+ ${unit}`;
        else if (dose[currentIntensity]) doseRange = `${dose[currentIntensity].min}–${dose[currentIntensity].max} ${unit}`;
        const tierColor = tierColors[currentIntensity] || color;
        doseDisplayText.textContent = `DOSE: ${tierLabels[currentIntensity]} · ${doseRange}`;
        doseDisplayText.style.color = tierColor;
        doseDisplayText.classList.remove('hidden');
    }

    // Dose note
    if (dose.note) {
        doseNote.textContent = dose.note;
        doseNote.classList.remove('hidden');
    } else {
        doseNote.classList.add('hidden');
    }

    // High-dose warning for strong + heavy
    if (currentIntensity === 'strong' || currentIntensity === 'heavy') {
        const warnings = {
            mdma: 'Above ~150 mg, side-effects and neurotoxicity climb with little extra euphoria.',
            cocaine: 'Higher doses raise the risk of cardiac strain and compulsive redosing.',
            amphetamine: 'Higher doses raise cardiovascular strain and overheating risk.',
            '4mmc': 'Higher doses strongly increase the urge to redose and the cardiac strain.',
            'cmc': 'Higher doses sharply increase the urge to redose and the cardiac strain.',
            '2cb': 'At this range effects can become overwhelming, so a calm setting helps.',
            ketamine: 'This approaches the "k-hole" (full dissociation), so it is best not to be alone.',
            lsd: 'Higher doses make challenging experiences more likely, so your mindset and setting matter more.',
            alcohol: 'Heavy doses strongly impair coordination; if vomiting, lie on your side (aspiration risk).',
            benzodiazepines: 'Higher doses deepen sedation and, with any other depressant, the risk of stopped breathing.',
            dmt: 'This is breakthrough territory, total and overwhelming. Have a sober sitter and stay seated or lying down.',
            nitrous: 'More balloons in one session raise the cumulative nerve-damage and hypoxia risk, not the high.'
        };
        if (warnings[data.id]) {
            doseWarning.textContent = warnings[data.id];
            doseWarning.classList.remove('hidden');
        } else {
            doseWarning.classList.add('hidden');
        }
    } else {
        doseWarning.classList.add('hidden');
    }

    // Source link
    if (dose.source) {
        const host = new URL(dose.source).hostname;
        const sourceName = DOSE_SOURCE_NAMES[host] || host.replace(/^www\./, '');
        doseSourceLink.href = dose.source;
        doseSourceLink.textContent = `Source: ${sourceName}, ${data.name} dosing`;
        doseSourceLink.parentElement.classList.remove('hidden');
    }

    // Header dose display
    const headerDoseEl = document.getElementById('current-dose-display');
    if (headerDoseEl) {
        const tierLabels = { threshold: 'Threshold', light: 'Light', common: 'Common', strong: 'Strong', heavy: 'Heavy' };
        let doseStr = '';
        if (currentIntensity === 'threshold' && dose.threshold != null) doseStr = `${dose.threshold} ${unit}`;
        else if (currentIntensity === 'heavy' && dose.heavy != null) doseStr = `${dose.heavy}+ ${unit}`;
        else if (dose[currentIntensity]) doseStr = `${dose[currentIntensity].min}–${dose[currentIntensity].max} ${unit}`;
        headerDoseEl.textContent = doseStr ? `${routeName} · ${tierLabels[currentIntensity]} · ${doseStr}` : '';
        headerDoseEl.style.color = hexAlpha(color, 0.65);
    }
}

function setRoute(index) {
    currentRouteIndex = index;
    const data = protocols[currentProtocol];
    updateDosingDisplay(data);
    updateCharts(data);
}

function setIntensity(level) {
    currentIntensity = level;
    const data = protocols[currentProtocol];
    updateDosingDisplay(data);
    updateCharts(data);
}

// --- Section Rendering (Essential + Bonus) ---
function renderSection(element, data, color) {
    if (Array.isArray(data)) {
        renderItemList(element, data, color, 'ess');
        return;
    }
    const essentialItems = data.essential || [];
    const bonusItems = data.bonus || [];

    let html = renderItemListHtml(essentialItems, element.id, color, 'ess');

    if (bonusItems.length > 0) {
        const bonusId = `bonus-${element.id}`;
        html += `
        <li class="mt-3">
            <button onclick="toggleBonus('${bonusId}')" class="flex items-center gap-2 text-xs font-medium opacity-50 hover:opacity-90 transition-opacity" style="color:${color}">
                <span class="inline-block w-4 h-[1px] opacity-30" style="background:${color}"></span>
                <span id="btn-${bonusId}">▸ Additional recommendations</span>
                <span class="inline-block flex-1 h-[1px] opacity-15" style="background:${color}"></span>
            </button>
            <ul id="${bonusId}" class="bonus-section mt-2 space-y-2" style="display:none;">
                ${renderItemListHtml(bonusItems, element.id, color, 'bon')}
            </ul>
        </li>`;
    }

    element.innerHTML = html;
}

function renderItemList(element, items, color, prefix) {
    element.innerHTML = renderItemListHtml(items, element.id, color, prefix);
}

function renderItemListHtml(items, elementId, color, prefix) {
    return items.map((item, i) => {
        const shortFormatted = item.short.replace(/^([^:]+):/, '<strong class="text-gray-200">$1:</strong>');
        const uid = `exp-${prefix}-${elementId}-${i}`;
        const sourcesHtml = item.sources ? `
            <div class="mt-2 pl-3 flex flex-wrap gap-2">
                ${item.sources.map(s => `<a href="${s.url}" target="_blank" rel="noopener" class="text-[10px] opacity-50 hover:opacity-90 underline transition-opacity" style="color:${color}">${s.label}</a>`).join('')}
            </div>` : '';
        return `
        <li class="text-sm text-gray-400">
            <div class="flex items-start">
                <span class="mr-2 mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:${hexAlpha(color, 0.5)}"></span>
                <div class="flex-1">
                    <span>${shortFormatted}</span>
                    <button onclick="toggleExpand('${uid}')" class="expand-toggle ml-1 text-xs opacity-60 hover:opacity-100 transition-opacity font-mono" style="color:${color}">
                        <span id="btn-${uid}">[+]</span>
                    </button>
                    <div id="${uid}" class="expandable-detail">
                        <p class="mt-2 text-xs text-gray-500 leading-relaxed pl-0 border-l-2 pl-3" style="border-color:${hexAlpha(color, 0.3)}">${item.detail}</p>
                        ${sourcesHtml}
                    </div>
                </div>
            </div>
        </li>`;
    }).join('');
}

function toggleBonus(bonusId) {
    const el = document.getElementById(bonusId);
    const btn = document.getElementById('btn-' + bonusId);
    if (el.style.display === 'none') {
        el.style.display = '';
        btn.textContent = '▾ Additional recommendations';
    } else {
        el.style.display = 'none';
        btn.textContent = '▸ Additional recommendations';
    }
}

function toggleExpand(uid) {
    const el = document.getElementById(uid);
    const btn = document.getElementById('btn-' + uid);
    if (el.classList.contains('open')) {
        el.classList.remove('open');
        btn.textContent = '[+]';
    } else {
        el.classList.add('open');
        btn.textContent = '[-]';
    }
}

// --- Drug Combinations Section ---
function renderCombosSection(data) {
    const section = document.getElementById('combos-section');
    const list = document.getElementById('combos-list');
    const placeholder = document.getElementById('combos-placeholder');

    if (!section || !list) return;

    function showPlaceholder(msg) {
        section.classList.add('hidden');
        if (placeholder) { placeholder.textContent = msg; placeholder.classList.remove('hidden'); }
    }

    // Sober baseline: no substance selected yet.
    if (data.id === 'sober') {
        showPlaceholder('Drug combinations will be displayed here once you select a substance.');
        return;
    }

    // Substances with no combination data (e.g. poppers, not in the TripSit chart):
    // point the reader to the Protocol tab instead of showing an empty panel.
    const combos = comboData ? getSubstanceCombos(data.id) : [];
    if (combos.length === 0) {
        showPlaceholder(`No combination chart is available for ${data.name}. See the Protocol tab for its key interaction warnings.`);
        return;
    }

    if (placeholder) placeholder.classList.add('hidden');
    section.classList.remove('hidden');

    // Apply substance color to section card border
    const card = section.querySelector('.section-card');
    if (card) card.style.borderColor = hexAlpha(data.color, 0.3);

    let html = '';
    let lastGroup = null;

    combos.forEach((combo, i) => {
        const risk = combo.riskInfo;

        // Group header when risk level changes
        if (risk.order !== lastGroup) {
            lastGroup = risk.order;
            html += `<div class="combo-group-header">${RISK_GROUP_HEADERS[risk.order] || ''}</div>`;
        }

        const uid = `combo-${data.id}-${i}`;
        const hasDetail = combo.note || (combo.sources && combo.sources.length > 0);
        const nameColor = combo.displayColor || '#d1d5db';

        // Source links HTML
        let sourcesHtml = '';
        if (combo.sources && combo.sources.length > 0) {
            sourcesHtml = `<div class="mt-2 pl-3 flex flex-wrap gap-x-3 gap-y-1">`
                + combo.sources.map(s => {
                    const label = s.title || s.author || 'Source';
                    return `<a href="${s.url}" target="_blank" rel="noopener" class="text-[10px] opacity-50 hover:opacity-90 underline transition-opacity" style="color:${data.color}">${label}</a>`;
                }).join('')
                + `</div>`;
        }
        if (combo.curated) {
            sourcesHtml += `<div class="mt-1 pl-3 text-[10px] italic opacity-40" style="color:${data.color}">Curated from the cited sources. This pairing is not in the TripSit dataset.</div>`;
        } else {
            sourcesHtml += `<div class="mt-1 pl-3"><a href="https://combo.tripsit.me" target="_blank" rel="noopener" class="text-[10px] opacity-30 hover:opacity-60 underline transition-opacity" style="color:${data.color}">TripSit Drug Combination Chart</a></div>`;
        }

        html += `
        <div class="combo-item" style="border-left:3px solid ${risk.color};background:${hexAlpha(risk.color, 0.04)}">
            <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-2 flex-wrap min-w-0">
                    <span class="combo-badge" style="color:${risk.color}">${risk.icon} ${risk.label}</span>
                    <span class="text-gray-600">·</span>
                    <span class="text-sm">
                        ${combo.displayEmoji}
                        <span class="font-semibold" style="color:${nameColor}">${combo.displayName}</span>
                        ${combo.curated ? `<span class="text-[9px] uppercase tracking-wider opacity-40 ml-1" title="Not in the TripSit dataset; curated from cited sources" style="color:${data.color}">curated</span>` : ''}
                    </span>
                </div>
                ${hasDetail ? `
                <button onclick="toggleExpand('${uid}')" class="expand-toggle ml-1 text-xs opacity-60 hover:opacity-100 transition-opacity font-mono flex-shrink-0" style="color:${data.color}">
                    <span id="btn-${uid}">[+]</span>
                </button>` : ''}
            </div>
            ${hasDetail ? `
            <div id="${uid}" class="expandable-detail">
                ${combo.note ? `<p class="mt-2 text-xs text-gray-500 leading-relaxed pl-3 border-l-2" style="border-color:${hexAlpha(risk.color, 0.3)}">${combo.note}</p>` : ''}
                ${sourcesHtml}
            </div>` : ''}
        </div>`;
    });

    list.innerHTML = html;
}

// Axis definitions, shown in the risk-chart tooltip so each axis states its
// scope explicitly (the labels are deliberately narrow proxies, not catch-alls).
const AXIS_DESC = {
    'Overdose / Lethality': 'Risk of dying from the drug itself: overdose, stopped breathing, or a small gap between a normal dose and a dangerous one.',
    'Neurotoxicity': 'Risk of direct, lasting damage to neural tissue.',
    'Cardiotoxicity': 'Strain on the heart and blood vessels: heart rate, blood pressure, narrowed vessels.',
    'Fluid & heat balance': 'Losing control of fluids, salts or body temperature. This can fail in both directions: too little water, or too much of it.',
    'Sleep Disruption': 'How strongly it blocks or spoils sleep around the time you use. Not the same as long-term sleep harm.',
    'Compulsion': 'Loss of control over your own behaviour: disinhibition and the pull to keep redosing.'
};

// --- Charts (Dark Mode) ---
function updateCharts(data, skipDuration = false) {
    // Risk profile is a fixed per-substance estimate, deliberately NOT scaled by
    // the dose tier. A uniform multiplier would fake a dose-response the data can't
    // support. Higher doses raise every risk (especially overdose); that is stated
    // in the caption rather than drawn as precise bar movement.
    const v = data.visualizer;
    const raw = [
        v.lethality != null ? v.lethality : 0,
        v.neurotoxicity,
        v.cardiotoxicity,
        v.dehydration,
        v.sleep_deprivation,
        v.impulsivity
    ];
    // Draw the band, not the number. The page states these are five coarse bands,
    // so a 7 and an 8 must render at the same length: bar length was quietly
    // implying a precision the bands disclaim.
    const scores = raw.map(bandMidpoint);

    const labels = ['Overdose / Lethality', 'Neurotoxicity', 'Cardiotoxicity', 'Fluid & heat balance', 'Sleep Disruption', 'Compulsion'];
    const darkGridColor = 'rgba(255,255,255,0.06)';
    const darkLabelColor = '#71717a'; // zinc-500

    if (riskChart) {
        const currentType = riskChart.config.type;
        if (currentType !== 'bar') {
            riskChart.destroy();
            riskChart = null;
        }
    }

    if (!riskChart) {
        createHistogramChart(data, labels, scores, darkGridColor, darkLabelColor);
    } else {
        riskChart.data.datasets[0].data = scores;
        riskChart.data.datasets[0].backgroundColor = scores.map(getHistogramColor);
        riskChart.data.datasets[0].borderColor = scores.map(getHistogramColor).map(c => c.replace('0.7)', '1)'));
        riskChart.data.datasets[0].label = data.name;
        riskChart.update();
    }

    if (!skipDuration) updateDurationChart(data, darkGridColor, darkLabelColor);
}

// None / Low / Moderate / High / Very High -> the middle of each band.
function bandMidpoint(score) {
    if (score <= 0) return 0;
    if (score <= 2) return 1;
    if (score <= 4) return 3;
    if (score <= 6) return 5;
    return 7;
}

function getHistogramColor(score) {
    if (score === 0) return 'rgba(156, 163, 175, 0.7)'; // gray
    if (score <= 2) return 'rgba(34, 197, 94, 0.7)';    // green
    if (score <= 4) return 'rgba(234, 179, 8, 0.7)';    // yellow
    if (score <= 6) return 'rgba(249, 115, 22, 0.7)';   // orange
    return 'rgba(239, 68, 68, 0.7)';                    // red
}

function createHistogramChart(data, labels, scores, gridColor, labelColor) {
    riskChart = new Chart(riskCanvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: data.name,
                data: scores,
                backgroundColor: scores.map(getHistogramColor),
                borderColor: scores.map(getHistogramColor).map(c => c.replace('0.7)', '1)')),
                borderWidth: 1,
                borderRadius: 0
            }]
        },
        options: {
            indexAxis: 'y',
            scales: {
                x: {
                    min: 0,
                    max: 8,
                    grid: { color: gridColor },
                    ticks: {
                        color: labelColor,
                        autoSkip: false,
                        maxTicksLimit: 6,
                        stepSize: 2,
                        callback: function (value) {
                            if (value === 0) return 'None';
                            if (value === 2) return 'Low';
                            if (value === 4) return 'Moderate';
                            if (value === 6) return 'High';
                            if (value === 8) return 'Very High';
                            return '';
                        }
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: labelColor, font: { weight: 'bold' } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        afterTitle: function (items) {
                            return items && items[0] ? (AXIS_DESC[items[0].label] || '') : '';
                        },
                        label: function (context) {
                            const v = context.raw;
                            let t = 'None';
                            if (v > 0) t = 'Low';
                            if (v > 2) t = 'Moderate';
                            if (v > 4) t = 'High';
                            if (v > 6) t = 'Very High';
                            return t;
                        }
                    }
                }
            },
            maintainAspectRatio: false,
            animation: { duration: 400 }
        }
    });
}

// Phase display metadata
const PHASE_ORDER = ['onset', 'come_up', 'peak', 'come_down', 'after_effects'];
const PHASE_COLORS = {
    onset: 'rgba(156,163,175,0.55)',
    come_up: 'rgba(96,165,250,0.65)',
    peak: 'rgba(168,85,247,0.75)',
    come_down: 'rgba(251,191,36,0.65)',
    after_effects: 'rgba(107,114,128,0.45)'
};
const PHASE_NAMES = {
    onset: 'Onset',
    come_up: 'Come-up',
    peak: 'Peak',
    come_down: 'Come-down',
    after_effects: 'After-effects'
};

function updateDurationChart(data, darkGridColor, darkLabelColor) {
    const allRoutes = data.routes || (data.duration_phases ? [{ name: 'Effect Timeline', phases: data.duration_phases }] : null);

    let inputRoutes = allRoutes;
    if (allRoutes && allRoutes.length > 1) {
        const idx = Math.min(currentRouteIndex, allRoutes.length - 1);
        inputRoutes = [allRoutes[idx]];
    }

    if (!inputRoutes || inputRoutes.every(r => !r.phases)) {
        if (durationChart) { durationChart.destroy(); durationChart = null; }
        renderTimelineLegend(null);
        return;
    }

    _durationRoutes = inputRoutes;
    const newLabels = inputRoutes.map(r => r.name);

    // Always keep all 5 phase datasets (0 = invisible segment, allows smooth morphing)
    const newDatasets = PHASE_ORDER.map(p => ({
        _phaseKey: p,
        label: PHASE_NAMES[p],
        data: inputRoutes.map(r => r.phases && r.phases[p] ? r.phases[p].max : 0),
        backgroundColor: PHASE_COLORS[p],
        borderWidth: 0,
        borderRadius: 0,
        barThickness: 36
    }));

    if (durationChart) {
        // Update in place for a smooth morph, no restart animation
        durationChart.data.labels = newLabels;
        PHASE_ORDER.forEach((p, i) => {
            durationChart.data.datasets[i].data = newDatasets[i].data;
        });
        durationChart.update({ duration: 350, easing: 'easeInOutQuart' });
        renderTimelineLegend(inputRoutes);
        return;
    }

    // Create new chart
    durationChart = new Chart(durationCanvas, {
        type: 'bar',
        data: {
            labels: newLabels,
            datasets: newDatasets
        },
        options: {
            indexAxis: 'y',
            scales: {
                x: {
                    stacked: true,
                    beginAtZero: true,
                    grid: { color: darkGridColor },
                    ticks: {
                        color: darkLabelColor,
                        callback: v => v + 'h'
                    },
                    title: {
                        display: true,
                        text: 'Hours',
                        color: darkLabelColor,
                        font: { size: 11 }
                    }
                },
                y: {
                    stacked: true,
                    grid: { display: false },
                    ticks: {
                        color: darkLabelColor,
                        font: { weight: 'bold' }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const routes = _durationRoutes;
                            if (!routes) return '';
                            const phaseKey = PHASE_ORDER[context.datasetIndex];
                            const route = routes[context.dataIndex];
                            if (route && route.phases && route.phases[phaseKey]) {
                                const phase = route.phases[phaseKey];
                                return `${PHASE_NAMES[phaseKey]}: ${formatPhaseDuration(phase.min)}–${formatPhaseDuration(phase.max)}`;
                            }
                            return '';
                        }
                    }
                }
            },
            maintainAspectRatio: false,
            animation: { duration: 400 }
        }
    });
    renderTimelineLegend(inputRoutes);
}

// --- Timeline Phase Legend ---
function renderTimelineLegend(inputRoutes) {
    const el = document.getElementById('timeline-legend');
    if (!el) return;

    if (!inputRoutes || inputRoutes.length === 0) {
        el.innerHTML = '';
        return;
    }

    const route = inputRoutes[0];
    if (!route.phases) {
        el.innerHTML = '';
        return;
    }

    const items = PHASE_ORDER
        .filter(p => route.phases[p] && route.phases[p].max > 0)
        .map(p => {
            const phase = route.phases[p];
            const minStr = formatPhaseDuration(phase.min);
            const maxStr = formatPhaseDuration(phase.max);
            const dur = (phase.min === 0 || phase.min == null) ? `~${maxStr}` : `${minStr}–${maxStr}`;
            return `<span class="legend-item" style="color:${PHASE_COLORS[p]}">
                <span class="legend-swatch" style="background:${PHASE_COLORS[p]}"></span>
                ${PHASE_NAMES[p]} · ${dur}
            </span>`;
        });

    el.innerHTML = items.join('');
}

function formatPhaseDuration(hours) {
    if (hours == null || hours === 0) return '0';
    if (hours < 1) {
        const mins = Math.round(hours * 60);
        return `${mins} min`;
    }
    if (hours === Math.floor(hours)) return `${hours}h`;
    return `${hours}h`;
}

// --- Utilities ---
function hexAlpha(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function hexToRgb(hex) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

// Mix a hex colour toward another by t (0..1). Used to lift dim accents to a
// readable weight at rest, and to lighten very dark accents enough to carry
// dark text when a button is selected.
function mixHex(hex, toward, t) {
    const a = hexToRgb(hex), b = hexToRgb(toward);
    const m = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    return '#' + m.map(v => v.toString(16).padStart(2, '0')).join('');
}

// WCAG relative luminance decides whether a filled button gets black or white text.
function luminance(hex) {
    const [r, g, b] = hexToRgb(hex).map(v => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastText(hex) {
    return luminance(hex) > 0.35 ? '#12120f' : '#ffffff';
}

// A selected button is filled with its accent at full strength. Very dark accents
// (deep indigo, crimson) are lifted first so the fill still reads as "lit up".
function selectedFill(hex) {
    return luminance(hex) < 0.14 ? mixHex(hex, '#ffffff', 0.3) : hex;
}

// --- Risk-profile provenance panel (the "i" beside the chart heading) ---
window.toggleRiskInfo = function() {
    const panel = document.getElementById('risk-info-panel');
    const btn = document.getElementById('risk-info-btn');
    if (!panel) return;
    const open = panel.hidden;
    panel.hidden = !open;
    if (btn) btn.setAttribute('aria-expanded', String(open));
};

// --- Risk-profile meta: per-substance rationale + independent MCDA harm score ---
function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function renderRiskMeta(data) {
    const rat = document.getElementById('risk-rationale');
    if (rat) rat.textContent = data.visualizer_note || '';

    const chip = document.getElementById('mcda-chip');
    if (!chip) return;
    if (data.mcda) {
        const m = data.mcda;
        const extra = m.note ? ` (${m.note})` : '';
        chip.innerHTML = '<span class="font-semibold text-gray-300">Independent expert harm ranking:</span> '
            + `${m.score}/100, ${ordinal(m.rank)} most harmful of ${m.of} drugs${extra}. `
            + '<span class="text-gray-500">Overall harm to self &amp; others; Nutt 2010.</span>';
    } else if (data.id === 'sober') {
        chip.innerHTML = '';
    } else {
        chip.innerHTML = '<span class="text-gray-500">Not assessed by the Nutt (2010) expert harm ranking.</span>';
    }
}

// --- Dangerous combinations, surfaced above the tabs (Dangerous + Unsafe tiers) ---
function renderDangerCombos(data) {
    const box = document.getElementById('danger-combos');
    const list = document.getElementById('danger-combos-list');
    if (!box || !list) return;
    if (data.id === 'sober' || typeof comboData === 'undefined' || !comboData) {
        box.classList.add('hidden');
        return;
    }
    const combos = getSubstanceCombos(data.id).filter(c => c.status === 'Dangerous' || c.status === 'Unsafe');
    if (!combos.length) {
        box.classList.add('hidden');
        return;
    }
    box.classList.remove('hidden');
    list.innerHTML = combos.map(c => {
        const r = c.riskInfo;
        return `<span class="danger-combo-chip" style="border-color:${hexAlpha(r.color, 0.55)};color:${r.color}">`
            + `${r.icon} ${c.displayEmoji} ${c.displayName} <span style="opacity:0.65">· ${r.label}</span></span>`;
    }).join('');
}
