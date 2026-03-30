/*
    app.js — Application logic for Harm Reduction Protocols Dashboard.
    Handles: Navigation, content rendering, expandable items, color theming, Chart.js config (dark mode).
    Depends on: data.js (must be loaded first), Chart.js CDN, Tailwind CDN.
*/

// Display order (by European prevalence in festival/nightlife contexts)
const SUBSTANCE_ORDER = ['sober', 'alcohol', 'caffeine', 'cannabis', 'mdma', 'cocaine', 'amphetamine', 'ketamine', 'lsd', 'mushrooms', '2cb', '4mmc'];

// State
let currentProtocol = 'sober';
let riskChart = null;
let durationChart = null;
let currentIntensity = 'common';
let currentRouteIndex = 0;

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

    initNavigation();
    loadProtocol('sober');
});

// --- Navigation ---
function initNavigation() {
    SUBSTANCE_ORDER.forEach(id => {
        const proto = protocols[id];
        if (!proto) return;
        const btn = document.createElement('button');
        btn.innerHTML = `<span class="text-base mr-1">${proto.emoji}</span> ${proto.name}`;
        btn.dataset.id = proto.id;

        // Default: subtle pre-colored tint
        applyButtonDefault(btn, proto.color);

        btn.onmouseenter = () => {
            if (btn.dataset.id !== currentProtocol) {
                btn.style.backgroundColor = hexAlpha(proto.color, 0.2);
                btn.style.borderColor = hexAlpha(proto.color, 0.5);
            }
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

function applyButtonDefault(btn, color) {
    btn.className = 'p-3 rounded-lg text-sm font-bold transition-all duration-200 border-2 cursor-pointer';
    btn.style.backgroundColor = hexAlpha(color, 0.08);
    btn.style.borderColor = hexAlpha(color, 0.25);
    btn.style.color = hexAlpha(color, 0.7);
    btn.style.boxShadow = 'none';
}

function applyButtonActive(btn, color) {
    btn.className = 'p-3 rounded-lg text-sm font-bold transition-all duration-200 border-2 cursor-pointer';
    btn.style.backgroundColor = hexAlpha(color, 0.2);
    btn.style.borderColor = color;
    btn.style.color = color;
    btn.style.boxShadow = `0 0 12px ${hexAlpha(color, 0.3)}`;
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
    activeHeader.style.borderColor = hexAlpha(data.color, 0.3);
    activeHeaderName.style.color = data.color;

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
    // During: strip focus field, pass remaining structure
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
        badge.style.backgroundColor = hexAlpha(data.color, 0.15);
        badge.style.color = data.color;
    });
    if (focusBorderEl) {
        focusBorderEl.style.borderLeftColor = data.color;
        focusBorderEl.style.backgroundColor = hexAlpha(data.color, 0.05);
    }

    // 7. Risks
    if (id === 'sober') {
        emergencyFlags.classList.add('hidden');
        if (doseDisplayText) doseDisplayText.classList.add('hidden');
    } else {
        emergencyFlags.classList.remove('hidden');
        riskList.innerHTML = data.risks.map(r => `<li>${r}</li>`).join('');
    }

    // 8. Charts (use route-adjusted durations)
    updateCharts(data, id === 'sober');
}

// --- Dosing Panel ---
function renderDosingPanel(data) {
    if (!data.dosing || data.id === 'sober') {
        dosingPanel.classList.add('hidden');
        if (durationChart) { durationChart.destroy(); durationChart = null; }
        return;
    }
    dosingPanel.classList.remove('hidden');
    dosingCard.style.borderColor = hexAlpha(data.color, 0.3);

    // Build route buttons (always visible, even for single routes)
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
            btn.style.backgroundColor = hexAlpha(color, 0.2);
            btn.style.borderColor = color;
            btn.style.color = color;
        } else {
            btn.style.backgroundColor = 'rgba(255,255,255,0.04)';
            btn.style.borderColor = 'rgba(255,255,255,0.12)';
            btn.style.color = 'rgba(255,255,255,0.5)';
        }
    });

    // Populate tier button values
    document.getElementById('val-threshold').textContent = dose.threshold != null ? `${dose.threshold} ${unit}` : '–';
    document.getElementById('val-light').textContent = dose.light ? `${dose.light.min}–${dose.light.max} ${unit}` : '–';
    document.getElementById('val-common').textContent = dose.common ? `${dose.common.min}–${dose.common.max} ${unit}` : '–';
    document.getElementById('val-strong').textContent = dose.strong ? `${dose.strong.min}–${dose.strong.max} ${unit}` : '–';
    document.getElementById('val-heavy').textContent = dose.heavy != null ? `${dose.heavy}+ ${unit}` : '–';

    // Highlight selected tier button
    const tiers = ['threshold', 'light', 'common', 'strong', 'heavy'];
    tiers.forEach(lvl => {
        const btn = document.getElementById('tier-' + lvl);
        if (!btn) return;
        const tierColor = getComputedStyle(btn).getPropertyValue('--tier-color').trim();
        if (lvl === currentIntensity) {
            btn.style.backgroundColor = hexAlpha(tierColor || color, 0.25);
            btn.style.borderColor = tierColor || color;
            btn.style.color = tierColor || color;
            btn.style.boxShadow = `0 0 12px ${hexAlpha(tierColor || color, 0.2)}`;
            btn.style.transform = 'scale(1.04)';
        } else {
            btn.style.backgroundColor = 'var(--tier-bg)';
            btn.style.borderColor = 'rgba(255,255,255,0.08)';
            btn.style.color = 'rgba(255,255,255,0.4)';
            btn.style.boxShadow = 'none';
            btn.style.transform = 'scale(1)';
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
            mdma: '⚠️ Doses above 150 mg exponentially increase neurotoxicity risk without additional euphoria.',
            cocaine: '⚠️ High doses significantly increase risk of cardiac events and compulsive redosing.',
            amphetamine: '⚠️ High doses dramatically increase cardiovascular strain and hyperthermia risk.',
            '4mmc': '⚠️ Higher doses dramatically increase compulsive redosing urge and neurotoxicity.',
            '2cb': '⚠️ At this dose range, effects become overwhelming. Ensure safe environment.',
            ketamine: '⚠️ High doses approach the "k-hole" — full dissociation. Never use alone.',
            lsd: '⚠️ High doses dramatically increase risk of challenging experiences. Set & setting critical.',
            alcohol: '⚠️ High doses severely impair judgment and motor control. Risk of aspiration if vomiting.'
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
        doseSourceLink.href = dose.source;
        doseSourceLink.textContent = `Source: PsychonautWiki — ${data.name} dosing`;
        doseSourceLink.parentElement.classList.remove('hidden');
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

// Intensity multipliers for risk visualization
function getIntensityMultiplier() {
    if (currentIntensity === 'threshold') return 0.35;
    if (currentIntensity === 'light') return 0.65;
    if (currentIntensity === 'strong') return 1.25;
    if (currentIntensity === 'heavy') return 1.5;
    return 1.0; // common
}

// --- Section Rendering (Essential + Bonus) ---
function renderSection(element, data, color) {
    // Support flat arrays (legacy) or { essential, bonus } objects
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
                    <button onclick="toggleExpand('${uid}')" class="ml-2 text-xs opacity-60 hover:opacity-100 transition-opacity font-mono" style="color:${color}">
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

// --- Charts (Dark Mode) ---
function updateCharts(data, skipDuration = false) {
    const multiplier = getIntensityMultiplier();
    const scores = [
        Math.min(8, Math.round(data.visualizer.neurotoxicity * multiplier)),
        Math.min(8, Math.round(data.visualizer.cardiotoxicity * multiplier)),
        Math.min(8, Math.round(data.visualizer.dehydration * multiplier)),
        Math.min(8, Math.round(data.visualizer.sleep_deprivation * multiplier)),
        Math.min(8, Math.round(data.visualizer.impulsivity * multiplier))
    ];

    const labels = ['Neurotoxicity', 'Cardiotoxicity', 'Dehydration', 'Sleep Loss', 'Impulsivity'];
    const darkGridColor = 'rgba(255,255,255,0.08)';
    const darkLabelColor = '#a1a1aa'; // zinc-400

    // Destroy existing chart if type mismatch
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
        // UPDATE EXISTING CHART
        riskChart.data.datasets[0].data = scores;
        riskChart.data.datasets[0].backgroundColor = scores.map(getHistogramColor);
        riskChart.data.datasets[0].borderColor = scores.map(getHistogramColor).map(c => c.replace('0.7)', '1)'));
        riskChart.data.datasets[0].label = data.name;
        riskChart.update();
    }

    // Duration / Effect Timeline
    if (!skipDuration) updateDurationChart(data, darkGridColor, darkLabelColor);
}



function getHistogramColor(score) {
    if (score === 0) return 'rgba(156, 163, 175, 0.7)'; // gray (None)
    if (score <= 2) return 'rgba(34, 197, 94, 0.7)'; // green (Low)
    if (score <= 4) return 'rgba(234, 179, 8, 0.7)'; // yellow (Medium)
    if (score <= 6) return 'rgba(249, 115, 22, 0.7)'; // orange (High)
    return 'rgba(239, 68, 68, 0.7)'; // red (Very High)
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
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y', // Horizontal bars for better readability of text
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
                            if (value === 4) return 'Medium';
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
                        label: function (context) {
                            const v = context.raw;
                            let t = 'None';
                            if (v > 0) t = 'Low';
                            if (v > 2) t = 'Moderate';
                            if (v > 4) t = 'High';
                            if (v > 6) t = 'Very High';
                            return `${t} (${v}/8)`;
                        }
                    }
                }
            },
            maintainAspectRatio: false,
            animation: { duration: 400 }
        }
    });
}

function updateDurationChart(data, darkGridColor, darkLabelColor) {
    // Always destroy and rebuild for phase changes
    if (durationChart) {
        durationChart.destroy();
        durationChart = null;
    }

    const allRoutes = data.routes || (data.duration_phases ? [{ name: 'Effect Timeline', phases: data.duration_phases }] : null);

    // Filter to only the selected route when multiple routes exist
    let inputRoutes = allRoutes;
    if (allRoutes && allRoutes.length > 1) {
        const idx = Math.min(currentRouteIndex, allRoutes.length - 1);
        inputRoutes = [allRoutes[idx]];
    }

    if (!inputRoutes) {
        // Fallback: simple single bar using data.duration
        durationChart = new Chart(durationCanvas, {
            type: 'bar',
            data: {
                labels: ['Active Duration'],
                datasets: [{
                    label: 'Hours',
                    data: [data.duration],
                    backgroundColor: data.color,
                    borderRadius: 4,
                    barThickness: 40
                }]
            },
            options: {
                indexAxis: 'y',
                scales: {
                    x: { beginAtZero: true, max: 14, grid: { color: darkGridColor }, ticks: { color: darkLabelColor } },
                    y: { grid: { display: false }, display: false }
                },
                plugins: { legend: { display: false } },
                maintainAspectRatio: false
            }
        });
        return;
    }

    // Multi-phase horizontal stacked bar for multiple routes
    const phaseOrder = ['onset', 'come_up', 'peak', 'come_down', 'after_effects'];
    const phaseColors = {
        onset: 'rgba(156,163,175,0.5)',     // gray
        come_up: 'rgba(96,165,250,0.6)',    // blue
        peak: 'rgba(168,85,247,0.7)',       // purple (vibrant)
        come_down: 'rgba(251,191,36,0.6)',  // amber
        after_effects: 'rgba(107,114,128,0.4)' // dim gray
    };

    const phaseLabelsMap = {};
    const datasets = phaseOrder.map(p => {
        const widthData = inputRoutes.map(r => {
            if (r.phases && r.phases[p]) {
                phaseLabelsMap[p] = r.phases[p].label;
                return r.phases[p].max;
            }
            return 0;
        });

        return {
            _phaseKey: p,
            label: phaseLabelsMap[p] || p,
            data: widthData,
            backgroundColor: phaseColors[p],
            borderWidth: 0, // No border for seamlessly blurred transitions
            borderRadius: 0, // No gaps
            barThickness: 36
        };
    }).filter(ds => ds.data.some(val => val > 0));

    durationChart = new Chart(durationCanvas, {
        type: 'bar',
        data: {
            labels: inputRoutes.map(r => r.name),
            datasets: datasets
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
                        callback: function (value) { return value + 'h'; }
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
                            const routeIndex = context.dataIndex;
                            const dsIndex = context.datasetIndex;
                            const ds = context.chart.data.datasets[dsIndex];
                            const phaseKey = ds._phaseKey;
                            const phase = inputRoutes[routeIndex].phases[phaseKey];
                            if (phase) {
                                return `${phase.label}: ${phase.min}–${phase.max} hours`;
                            }
                            return ds.label;
                        }
                    }
                }
            },
            maintainAspectRatio: false,
            animation: { duration: 400 }
        }
    });
}

// --- Utilities ---
function hexAlpha(hex, alpha) {
    // Convert hex to rgba
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}
