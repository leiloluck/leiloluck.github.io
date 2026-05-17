import json

html_content = """<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Elektro Schemata Viewer</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        :root {
            --bg-color: #0f172a;
            --panel-bg: #1e293b;
            --text-color: #f8fafc;
            --accent: #38bdf8;
            --accent-hover: #0284c7;
            --line-color: #38bdf8;
            --wall-color: #94a3b8; /* Lighter wall for better visibility */
            --point-color: #facc15;
            --overlay-opacity: 0.6; /* Increased for better visibility */
        }

        body {
            margin: 0;
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            display: flex;
            height: 100vh;
            overflow: hidden;
        }

        .sidebar {
            width: 280px;
            background-color: var(--panel-bg);
            padding: 24px 0;
            display: flex;
            flex-direction: column;
            border-right: 1px solid #334155;
            box-shadow: 2px 0 10px rgba(0,0,0,0.2);
            z-index: 100;
        }

        .sidebar h1 {
            font-size: 1.1rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            padding: 0 24px;
            margin-bottom: 24px;
            color: var(--accent);
        }

        .nav-btn {
            background: none;
            border: none;
            color: var(--text-color);
            padding: 16px 24px;
            text-align: left;
            cursor: pointer;
            font-size: 0.95rem;
            font-weight: 500;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .nav-btn:hover { background-color: #334155; }
        .nav-btn.active {
            background-color: #334155;
            border-left: 4px solid var(--accent);
            color: var(--accent);
        }

        .main {
            flex: 1;
            display: flex;
            flex-direction: column;
            position: relative;
        }

        .toolbar {
            height: 70px;
            background-color: rgba(30, 41, 59, 0.8);
            backdrop-filter: blur(8px);
            border-bottom: 1px solid #334155;
            display: flex;
            align-items: center;
            padding: 0 32px;
            justify-content: space-between;
            z-index: 50;
        }

        .toolbar h2 { margin: 0; font-size: 1.4rem; font-weight: 600; }

        .toggle-btn {
            background-color: transparent;
            color: var(--text-color);
            border: 2px solid var(--accent);
            padding: 10px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .toggle-btn:hover { background-color: rgba(56, 189, 248, 0.1); }
        .toggle-btn.active { 
            background-color: var(--accent);
            color: #0f172a;
            box-shadow: 0 0 15px rgba(56, 189, 248, 0.4);
        }

        .viewer {
            flex: 1;
            position: relative;
            overflow: auto;
            display: flex;
            justify-content: center;
            align-items: center;
            background: radial-gradient(circle at center, #1e293b 0%, #0f172a 100%);
            padding: 20px;
        }

        .page-wrapper {
            position: relative;
            background-color: #fff; /* White background to match paper */
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            border: 1px solid #334155;
            display: none;
            max-width: 100%;
            max-height: 100%;
        }

        .page-wrapper.active { display: block; }
        
        /* A4 Aspect Ratio classes */
        .a4-portrait {
            width: 70vh;
            height: calc(70vh * 1.414); /* 1:1.414 */
        }
        .a4-landscape {
            height: 80vh;
            width: calc(80vh * 1.414); /* 1.414:1 */
        }

        .original-img {
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            object-fit: fill; /* Force fill to match the A4 div exactly */
            opacity: 0;
            transition: opacity 0.4s;
            pointer-events: none;
            z-index: 10;
        }
        
        .original-img.show { opacity: var(--overlay-opacity); }

        .digital-layer {
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 20; /* SVG is on top */
            mix-blend-mode: multiply; /* Make sure SVG lines multiply on the white background/image */
        }
        
        /* SVG Styling */
        svg { width: 100%; height: 100%; display: block; }
        .wall { stroke: #1e293b; stroke-width: 0.005; fill: none; stroke-linecap: round; stroke-linejoin: round; } /* Relative stroke width based on viewBox 0 0 1 1 */
        .wire { stroke: #0284c7; stroke-width: 0.003; fill: none; stroke-linecap: round; }
        
        /* Electrician symbols */
        .symbol-text { font-family: 'Inter', sans-serif; font-size: 0.02px; font-weight: 600; fill: #0f172a; }
        .symbol-subtext { font-family: 'Inter', sans-serif; font-size: 0.015px; fill: #334155; }
        
        /* Tooltip Panel */
        .description-panel {
            position: absolute;
            bottom: 24px;
            right: 24px;
            background: rgba(15, 23, 42, 0.85);
            padding: 24px;
            border-radius: 12px;
            width: 320px;
            border: 1px solid #334155;
            z-index: 100;
            backdrop-filter: blur(12px);
            color: #f8fafc;
        }
        .description-panel h3 { margin-top: 0; color: var(--accent); border-bottom: 1px solid #334155; padding-bottom: 12px; }
        .description-panel p { font-size: 0.95rem; line-height: 1.6; color: #cbd5e1; }
        
        /* Page 1 List overrides */
        .digital-layer-html {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 20;
            padding: 5%; box-sizing: border-box; color: #0f172a;
        }
        .mat-list { list-style: none; padding: 0; }
        .mat-list li { border-bottom: 1px solid #cbd5e1; padding: 10px 0; display: flex; justify-content: space-between; font-size: 1.5vh; }
        .color-dot { display: inline-block; width: 1vh; height: 1vh; border-radius: 50%; margin-right: 8px; border: 1px solid #000; }
    </style>
</head>
<body>
    <div class="sidebar">
        <h1>Schemata</h1>
        <button class="nav-btn active" data-target="page1">Material Liste</button>
        <button class="nav-btn" data-target="page2">Bad / Lager / Büro</button>
        <button class="nav-btn" data-target="page3">Hauptraum</button>
        <button class="nav-btn" data-target="page4">Eingang</button>
        <button class="nav-btn" data-target="page5">Empore</button>
    </div>
    
    <div class="main">
        <div class="toolbar">
            <h2 id="current-title">Material Liste</h2>
            <button id="overlay-btn" class="toggle-btn">Zeichnung Einblenden</button>
        </div>
        
        <div class="viewer">
            
            <!-- PAGE 1: Portrait -->
            <div class="page-wrapper a4-portrait active" id="page1">
                <img src="page_01.jpg" class="original-img show"> <!-- Show by default for adjustments -->
                <div class="digital-layer-html">
                    <h2 style="font-size: 3vh;">MATERIAL LISTE ELEKTRO</h2>
                    <ul class="mat-list">
                        <li><strong>KIR ROHR M 20 + BRIDEN</strong> <span>100m</span></li>
                        <li><strong>Waco klemmen 3er/5er</strong> <span>200 Stk / 100 Stk</span></li>
                        <li><strong>DOSEN T13 2fach 1 mal geschaltet</strong> <span>17 Stk</span></li>
                        <li><strong>Dosen T13 2fach</strong> <span>15 Stk</span></li>
                        <li><strong>Schalter S3 2fach</strong> <span>2 Stk</span></li>
                        <li><strong>Schalter S3/S0</strong> <span>4 Stk</span></li>
                        <li><strong>1 Dose Aussen S x T13 (Nass)</strong> <span>1 Stk</span></li>
                        <li><strong>Abzweigdosen nicht zu klein</strong> <span>20 Stk</span></li>
                    </ul>
                    <div style="margin-top: 2vh;">
                        <ul class="mat-list">
                            <li><span><i class="color-dot" style="background: linear-gradient(90deg, #4ade80 50%, #facc15 50%);"></i> Erde</span> <span>grün / gelb</span></li>
                            <li><span><i class="color-dot" style="background: #38bdf8;"></i> Null</span> <span>blau</span></li>
                            <li><span><i class="color-dot" style="background: #a16207;"></i> Phase</span> <span>braun</span></li>
                            <li><span><i class="color-dot" style="background: #ffffff;"></i> gesch. Phase</span> <span>weiss / orange</span></li>
                            <li><span><i class="color-dot" style="background: #f472b6;"></i> Schema 3</span> <span>rosa / hellgrün</span></li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <!-- PAGE 2: Landscape -->
            <div class="page-wrapper a4-landscape" id="page2">
                <img src="page_02.jpg" class="original-img">
                <div class="digital-layer">
                    <svg viewBox="0 0 1 0.707" preserveAspectRatio="none">
                        <!-- Wall outlines -->
                        <path class="wall" d="M 0.38 0.08 L 0.38 0.14 L 0.68 0.21 L 0.69 0.31 L 0.68 0.45 L 0.64 0.45" />
                        <path class="wall" d="M 0.47 0.45 L 0.45 0.45 L 0.45 0.38 L 0.40 0.38" />
                        <path class="wall" d="M 0.45 0.58 L 0.65 0.58 L 0.65 0.45" />
                        
                        <!-- Wires -->
                        <path class="wire" d="M 0.44 0.10 L 0.56 0.28 L 0.56 0.35" />
                        <path class="wire" d="M 0.40 0.38 L 0.55 0.38 L 0.65 0.38" />
                        <path class="wire" d="M 0.45 0.45 L 0.45 0.50 L 0.42 0.50 L 0.42 0.57" />
                        
                        <!-- Symbols (using standard approximations: circle for switch, Y for socket) -->
                        <circle cx="0.435" cy="0.08" r="0.008" fill="none" stroke="#000" stroke-width="0.002" />
                        <text x="0.45" y="0.08" class="symbol-text">Y2</text>
                        
                        <text x="0.55" y="0.36" class="symbol-text">Y2</text>
                        <text x="0.67" y="0.37" class="symbol-text">Y3 Nass</text>
                        
                        <text x="0.48" y="0.34" class="symbol-text">D2 D1</text>
                        <text x="0.38" y="0.38" class="symbol-text">C</text>
                        
                        <!-- Labels -->
                        <text x="0.72" y="0.10" class="symbol-text">BAD</text>
                        <text x="0.72" y="0.13" class="symbol-text">LAGER</text>
                        <text x="0.72" y="0.16" class="symbol-text">BÜRO</text>
                        
                        <text x="0.32" y="0.48" class="symbol-text">Boiler schalter</text>
                        <text x="0.50" y="0.50" class="symbol-text">WASCHMASCHINE</text>
                    </svg>
                    <div class="description-panel">
                        <h3>Bad / Lager / Büro</h3>
                        <p>Installationsplan mit zentralem Verteiler D1/D2, Waschmaschinenanschluss, Boiler-Schalter und Nassraum-Steckdosen.</p>
                    </div>
                </div>
            </div>

            <!-- PAGE 3: Landscape -->
            <div class="page-wrapper a4-landscape" id="page3">
                <img src="page_03.jpg" class="original-img">
                <div class="digital-layer">
                    <svg viewBox="0 0 1 0.707" preserveAspectRatio="none">
                        <!-- 3D Room Box -->
                        <path class="wall" d="M 0.25 0.09 L 0.88 0.05 L 0.80 0.18 L 0.18 0.19 Z" />
                        <path class="wall" d="M 0.18 0.19 L 0.80 0.18 L 0.85 0.46 L 0.18 0.49 Z" />
                        <path class="wall" d="M 0.18 0.49 L 0.85 0.46 L 0.88 0.58 L 0.28 0.59 Z" />
                        
                        <!-- Ceiling & Wall Points -->
                        <circle cx="0.43" cy="0.09" r="0.005" fill="#facc15" />
                        <text x="0.38" y="0.10" class="symbol-text">Y 1+1</text>
                        
                        <circle cx="0.59" cy="0.08" r="0.005" fill="#facc15" />
                        <text x="0.54" y="0.09" class="symbol-text">Y 1+1</text>
                        
                        <circle cx="0.74" cy="0.06" r="0.005" fill="#facc15" />
                        <text x="0.69" y="0.07" class="symbol-text">Y 1+1</text>

                        <!-- Middle points -->
                        <circle cx="0.22" cy="0.28" r="0.005" fill="#facc15" />
                        <text x="0.18" y="0.29" class="symbol-text">Y 1+1</text>
                        
                        <circle cx="0.21" cy="0.40" r="0.005" fill="#facc15" />
                        <text x="0.17" y="0.41" class="symbol-text">Y 1+1</text>

                        <!-- Floor drops -->
                        <path class="wire" d="M 0.42 0.48 L 0.42 0.56" />
                        <text x="0.43" y="0.45" class="symbol-text">Y 1+1</text>
                        
                        <path class="wire" d="M 0.59 0.47 L 0.59 0.55" />
                        <text x="0.60" y="0.46" class="symbol-text">Y 1+1</text>

                        <!-- Nodes A & B -->
                        <circle cx="0.28" cy="0.62" r="0.005" fill="none" stroke="#000" stroke-width="0.002" />
                        <text x="0.27" y="0.65" class="symbol-text" font-size="0.03px">A</text>
                        
                        <rect x="0.86" y="0.50" width="0.01" height="0.01" fill="none" stroke="#000" stroke-width="0.002" />
                        <text x="0.88" y="0.51" class="symbol-text" font-size="0.03px">B</text>

                        <text x="0.40" y="0.04" class="symbol-text" font-size="0.04px">HAUPTRAUM</text>
                    </svg>
                    <div class="description-panel">
                        <h3>Hauptraum</h3>
                        <p>3D-Darstellung des Hauptraums mit Positionen der Deckenleuchten (Y 1+1) und den Referenzknoten A und B.</p>
                    </div>
                </div>
            </div>

            <!-- PAGE 4: Landscape -->
            <div class="page-wrapper a4-landscape" id="page4">
                <img src="page_04.jpg" class="original-img">
                <div class="digital-layer">
                    <svg viewBox="0 0 1 0.707" preserveAspectRatio="none">
                        <!-- House outline -->
                        <path class="wall" d="M 0.20 0.28 L 0.48 0.29 L 0.47 0.51 L 0.20 0.51 Z" />
                        <path class="wall" d="M 0.27 0.17 L 0.20 0.28" />
                        <path class="wall" d="M 0.47 0.51 L 0.52 0.57" />
                        
                        <!-- Arch -->
                        <path class="wall" d="M 0.48 0.29 Q 0.65 0.35 0.47 0.51" />
                        
                        <!-- Node A & Wiring -->
                        <text x="0.51" y="0.18" class="symbol-text" font-size="0.03px">A</text>
                        <rect x="0.51" y="0.21" width="0.015" height="0.015" fill="none" stroke="#000" stroke-width="0.002" />
                        
                        <path class="wire" d="M 0.52 0.22 L 0.57 0.27 L 0.69 0.32" />
                        <path class="wire" d="M 0.57 0.27 L 0.68 0.44" />
                        
                        <circle cx="0.69" cy="0.32" r="0.005" fill="#facc15" />
                        <text x="0.71" y="0.34" class="symbol-text">X1 WANDLAMPE</text>
                        
                        <polygon points="0.69,0.44 0.74,0.42 0.74,0.46" fill="none" stroke="#000" stroke-width="0.002" />
                        <text x="0.74" y="0.41" class="symbol-text">X1 AUSSENLAMPE</text>

                        <text x="0.67" y="0.11" class="symbol-text" font-size="0.04px">EINGANG</text>
                    </svg>
                    <div class="description-panel">
                        <h3>Eingang</h3>
                        <p>Außenbeleuchtung am Eingangsbereich, verbunden über Referenzpunkt A. Wandlampe und Außenlampe (X1).</p>
                    </div>
                </div>
            </div>

            <!-- PAGE 5: Landscape -->
            <div class="page-wrapper a4-landscape" id="page5">
                <img src="page_05.jpg" class="original-img">
                <div class="digital-layer">
                    <svg viewBox="0 0 1 0.707" preserveAspectRatio="none">
                        <!-- Outline -->
                        <path class="wall" d="M 0.33 0.21 L 0.50 0.21 L 0.62 0.28 L 0.62 0.34 L 0.46 0.42 L 0.46 0.52 L 0.33 0.51 Z" />
                        
                        <!-- Nodes B, C -->
                        <rect x="0.28" y="0.39" width="0.015" height="0.015" fill="none" stroke="#000" stroke-width="0.002" />
                        <text x="0.28" y="0.38" class="symbol-text" font-size="0.03px">C</text>
                        
                        <rect x="0.30" y="0.47" width="0.012" height="0.012" fill="none" stroke="#000" stroke-width="0.002" />
                        <text x="0.28" y="0.46" class="symbol-text" font-size="0.03px">B</text>

                        <!-- Wires -->
                        <path class="wire" d="M 0.30 0.48 L 0.34 0.48 L 0.34 0.39 L 0.44 0.39 L 0.56 0.39" />
                        <path class="wire" d="M 0.44 0.39 L 0.44 0.42" />
                        
                        <!-- Inner nodes -->
                        <text x="0.43" y="0.36" class="symbol-text">D1</text>
                        <text x="0.42" y="0.42" class="symbol-text">D2</text>
                        
                        <circle cx="0.47" cy="0.41" r="0.005" fill="none" stroke="#000" stroke-width="0.002" />
                        <text x="0.50" y="0.43" class="symbol-text">Venti</text>
                        
                        <text x="0.59" y="0.39" class="symbol-text">Kühlschrank / Herd</text>
                        <circle cx="0.57" cy="0.38" r="0.005" fill="none" stroke="#000" stroke-width="0.002" />

                        <text x="0.68" y="0.21" class="symbol-text" font-size="0.03px">EMPORE</text>
                    </svg>
                    <div class="description-panel">
                        <h3>Empore</h3>
                        <p>Elektroplan für die Empore. Anschlüsse für Ventilator, Kühlschrank und Herd. Verbindung über die Knoten B und C.</p>
                    </div>
                </div>
            </div>

        </div>
    </div>

    <script>
        const navBtns = document.querySelectorAll('.nav-btn');
        const pages = document.querySelectorAll('.page-wrapper');
        const overlayBtn = document.getElementById('overlay-btn');
        const titleEl = document.getElementById('current-title');
        
        let overlayActive = true; // Default to true so user can align

        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                navBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                titleEl.textContent = btn.textContent.trim();
                
                const targetId = btn.getAttribute('data-target');
                pages.forEach(p => p.classList.remove('active'));
                document.getElementById(targetId).classList.add('active');
            });
        });

        overlayBtn.addEventListener('click', () => {
            overlayActive = !overlayActive;
            if(overlayActive) {
                overlayBtn.classList.add('active');
                overlayBtn.textContent = 'Zeichnung Ausblenden';
                document.querySelectorAll('.original-img').forEach(img => img.classList.add('show'));
            } else {
                overlayBtn.classList.remove('active');
                overlayBtn.textContent = 'Zeichnung Einblenden';
                document.querySelectorAll('.original-img').forEach(img => img.classList.remove('show'));
            }
        });
        
        // init
        overlayBtn.classList.add('active');
        overlayBtn.textContent = 'Zeichnung Ausblenden';
    </script>
</body>
</html>
"""

with open("index.html", "w") as f:
    f.write(html_content)
