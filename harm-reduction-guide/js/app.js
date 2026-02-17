/*
    app.js — Application logic for Harm Reduction Protocols Dashboard.
    Handles: Navigation, content rendering, expandable items, color theming, Chart.js config (dark mode).
    Depends on: data.js (must be loaded first), Chart.js CDN, Tailwind CDN.
*/

// State
let currentProtocol = 'sober';
let chartMode = 'radar'; // 'radar' or 'histogram'
let riskChart = null;
let durationChart = null;

// DOM refs (assigned after DOMContentLoaded)
let navContainer, modeDisplay, introModifier, contentBefore, contentDuring,
    focusDuring, contentAfter, contentNextMorning, sleepStrategyText,
    emergencyFlags, riskList, riskCanvas, durationCanvas, activeHeader,
    activeHeaderName, activeHeaderType, activeHeaderEmoji,
    sectionCards, sectionBadges, focusBorderEl;
let btnViewRadar, btnViewHistogram;

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

    // Chart toggle buttons
    btnViewRadar = document.getElementById('view-radar');
    btnViewHistogram = document.getElementById('view-histogram');

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
    initChartToggle();
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

function initChartToggle() {
    btnViewRadar.onclick = () => {
        if (chartMode !== 'radar') {
            chartMode = 'radar';
            updateToggleUI();
            updateCharts(protocols[currentProtocol]);
        }
    };

    btnViewHistogram.onclick = () => {
        if (chartMode !== 'histogram') {
            chartMode = 'histogram';
            updateToggleUI();
            updateCharts(protocols[currentProtocol]);
        }
    };
}

function updateToggleUI() {
    const activeClass = "bg-[#3a3a38] text-white shadow-sm";
    const inactiveClass = "text-gray-400 hover:text-gray-200";

    if (chartMode === 'radar') {
        btnViewRadar.className = `px-3 py-1 text-xs font-medium rounded-md transition-all ${activeClass}`;
        btnViewHistogram.className = `px-3 py-1 text-xs font-medium rounded-md transition-all ${inactiveClass}`;
    } else {
        btnViewRadar.className = `px-3 py-1 text-xs font-medium rounded-md transition-all ${inactiveClass}`;
        btnViewHistogram.className = `px-3 py-1 text-xs font-medium rounded-md transition-all ${activeClass}`;
    }
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

    // 4. Render expandable lists
    renderExpandableList(contentBefore, data.phases.before, data.color);
    renderExpandableList(contentDuring, data.phases.during.items, data.color);
    renderExpandableList(contentAfter, data.phases.after, data.color);
    renderExpandableList(contentNextMorning, data.phases.next_morning, data.color);

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

// --- Expandable List Rendering ---
function renderExpandableList(element, items, color) {
    element.innerHTML = items.map((item, i) => {
        const shortFormatted = item.short.replace(/^([^:]+):/, '<strong class="text-gray-200">$1:</strong>');
        const uid = `exp-${element.id}-${i}`;
        // Use [+] and [-] symbols
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
                    </div>
                </div>
            </div>
        </li>`;
    }).join('');
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
        const targetType = chartMode === 'radar' ? 'radar' : 'bar';
        if (currentType !== targetType) {
            riskChart.destroy();
            riskChart = null;
        }
    }

    if (!riskChart) {
        // CREATE NEW CHART
        if (chartMode === 'radar') {
            createRadarChart(data, labels, scores, darkGridColor, darkLabelColor);
        } else {
            createHistogramChart(data, labels, scores, darkGridColor, darkLabelColor);
        }
    } else {
        // UPDATE EXISTING CHART
        if (chartMode === 'radar') {
            riskChart.data.datasets[0].data = scores;
            riskChart.data.datasets[0].borderColor = data.color;
            riskChart.data.datasets[0].backgroundColor = hexAlpha(data.color, 0.2);
            riskChart.data.datasets[0].pointBackgroundColor = data.color;
            riskChart.data.datasets[0].label = data.name;
            riskChart.data.datasets[0].pointHoverBorderColor = data.color;
        } else {
            // Update Histogram data & color
            riskChart.data.datasets[0].data = scores;
            riskChart.data.datasets[0].backgroundColor = scores.map(getHistogramColor);
            riskChart.data.datasets[0].borderColor = scores.map(getHistogramColor).map(c => c.replace('0.7)', '1)'));
            riskChart.data.datasets[0].label = data.name;
        }
        riskChart.update();
    }

    // Duration Bar (Unchanged)
    updateDurationChart(data, darkGridColor, darkLabelColor);
}

function createRadarChart(data, labels, scores, gridColor, labelColor) {
    riskChart = new Chart(riskCanvas, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: data.name,
                data: scores,
                fill: true,
                backgroundColor: hexAlpha(data.color, 0.2),
                borderColor: data.color,
                pointBackgroundColor: data.color,
                pointBorderColor: '#1a1a19',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: data.color
            }]
        },
        options: {
            scales: {
                r: {
                    angleLines: { color: gridColor },
                    grid: { color: gridColor },
                    pointLabels: {
                        font: { size: 10, family: 'system-ui, sans-serif' },
                        color: labelColor
                    },
                    ticks: { display: false },
                    suggestedMin: 0,
                    suggestedMax: 10
                }
            },
            plugins: { legend: { display: false } },
            animation: { duration: 400 }
        }
    });
}

function getHistogramColor(score) {
    // Green (0-3), Yellow (4-6), Red (7-10)
    if (score <= 3) return 'rgba(34, 197, 94, 0.7)'; // green-500
    if (score <= 6) return 'rgba(234, 179, 8, 0.7)'; // yellow-500
    return 'rgba(239, 68, 68, 0.7)'; // red-500
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
                    max: 10,
                    grid: { color: gridColor },
                    ticks: {
                        color: labelColor,
                        stepSize: 2, // Force strictly even spacing: 0, 2, 4, 6, 8, 10
                        callback: function (value) {
                            if (value === 0) return '0 (None)';
                            if (value === 2) return '2 (Low)';
                            if (value === 4) return '4';
                            if (value === 5) return '5 (Mid)';
                            if (value === 6) return '6';
                            if (value === 8) return '8 (High)';
                            if (value === 10) return '10 (Very High)';
                            return value;
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
    if (durationChart) {
        durationChart.data.datasets[0].data = [data.duration];
        durationChart.data.datasets[0].backgroundColor = data.color;
        durationChart.update();
    } else {
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
                    x: {
                        beginAtZero: true,
                        max: 14,
                        grid: { color: darkGridColor },
                        ticks: { color: darkLabelColor }
                    },
                    y: {
                        grid: { display: false },
                        display: false
                    }
                },
                plugins: { legend: { display: false } },
                maintainAspectRatio: false
            }
        });
    }
}

// --- Utilities ---
function hexAlpha(hex, alpha) {
    // Convert hex to rgba
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}
