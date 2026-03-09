/*
    app.js — Application logic for Harm Reduction Protocols Dashboard.
    Handles: Navigation, content rendering, expandable items, color theming, Chart.js config (dark mode).
    Depends on: data.js (must be loaded first), Chart.js CDN, Tailwind CDN.
*/

// State
let currentProtocol = 'sober';
let riskChart = null;
let durationChart = null;

// DOM refs (assigned after DOMContentLoaded)
let navContainer, modeDisplay, introModifier, contentBefore, contentDuring,
    focusDuring, contentAfter, contentNextMorning, sleepStrategyText,
    emergencyFlags, riskList, riskCanvas, durationCanvas, activeHeader,
    activeHeaderName, activeHeaderType, activeHeaderEmoji,
    sectionCards, sectionBadges, focusBorderEl;

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
    sleepStrategyText = document.getElementById('sleep-strategy-text');
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
    Object.values(protocols).forEach(proto => {
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
    sleepStrategyText.textContent = data.sleep_strategy;

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
    } else {
        emergencyFlags.classList.remove('hidden');
        emergencyFlags.style.backgroundColor = hexAlpha('#ef4444', 0.06);
        emergencyFlags.style.borderColor = hexAlpha('#ef4444', 0.2);
        riskList.innerHTML = data.risks.map(r => `<li>${r}</li>`).join('');
    }

    // 8. Charts
    updateCharts(data);
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
function updateCharts(data) {
    const scores = [
        data.visualizer.neurotoxicity,
        data.visualizer.cardiotoxicity,
        data.visualizer.dehydration,
        data.visualizer.sleep_deprivation,
        data.visualizer.impulsivity
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
    updateDurationChart(data, darkGridColor, darkLabelColor);
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
                            if (v >= 4) t = 'Moderate';
                            if (v >= 7) t = 'High';
                            if (v >= 9) t = 'Very High';
                            return `${t} (${v}/10)`;
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

    const inputRoutes = data.routes || (data.duration_phases ? [{ name: 'Effect Timeline', phases: data.duration_phases }] : null);

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
            barThickness: inputRoutes.length === 1 ? 36 : 24
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
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: darkLabelColor,
                        font: { size: 10 },
                        boxWidth: 12,
                        padding: 8
                    }
                },
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
