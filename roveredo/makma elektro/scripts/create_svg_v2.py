import json

svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8861 6234" width="8861" height="6234">
    <image href="page_02.jpg" x="0" y="0" width="8861" height="6234" opacity="0.6" />

    <style>
        .wall { stroke: #64748b; stroke-width: 25; fill: none; stroke-linecap: round; stroke-linejoin: round; }
        .wall-thin { stroke: #94a3b8; stroke-width: 15; fill: none; stroke-dasharray: 40 40; }
        .wire { stroke: #0284c7; stroke-width: 25; fill: none; stroke-linecap: round; }
        .symbol { stroke: #0284c7; stroke-width: 20; fill: none; stroke-linecap: round; }
        .text { font-family: 'Inter', sans-serif; font-size: 180px; fill: #0f172a; font-weight: 600; }
        .text-sm { font-family: 'Inter', sans-serif; font-size: 140px; fill: #0f172a; }
        .node { fill: #facc15; stroke: #ca8a04; stroke-width: 15; }
        .junction { fill: #fff; stroke: #0284c7; stroke-width: 15; }
    </style>

    <!-- Walls -->
    <path class="wall" d="M 3400 450 L 4350 400 L 4250 1250 L 5150 1250 L 6150 1850 L 6250 2750 L 4100 3250" />
    <path class="wall" d="M 4100 3250 L 4050 4050" />
    <!-- Lower Room -->
    <path class="wall" d="M 4050 4050 L 5900 4050 L 5950 4950 L 4100 4900 Z" />
    <!-- Line from lower room to upper diagonal -->
    <path class="wall" d="M 5900 4050 L 5550 3000" />

    <!-- Electrical Wires -->
    <!-- C to Junction Z -->
    <path class="wire" d="M 3350 3350 L 4100 3300" />
    
    <!-- Y2 Top Wire -->
    <path class="wire" d="M 3700 600 L 4350 400 L 4250 1250 L 4200 3250" />
    
    <!-- Junction Z to D1, D2 -->
    <path class="wire" d="M 4450 3250 L 4550 3000" />
    <path class="wire" d="M 4650 3250 L 4950 3050" />
    
    <!-- Lamp Top Wire (From D1) -->
    <path class="wire" d="M 4950 3050 L 5200 2300" />
    
    <!-- Junction Z to Lamp Bottom -->
    <path class="wire" d="M 4700 3350 L 5300 3600" />
    
    <!-- Junction Z to Y2 right -->
    <path class="wire" d="M 4750 3300 L 5650 3100" />
    
    <!-- Junction Z to Y3 Nass -->
    <path class="wire" d="M 4750 3300 L 6150 3050" />
    
    <!-- Junction Z to Boiler & WM switches -->
    <path class="wire" d="M 4100 3300 L 3800 3400 L 3650 4200" />
    <path class="wire" d="M 4150 3350 L 3900 3450 L 3650 4550" />
    
    <!-- Junction Z to WM Socket -->
    <path class="wire" d="M 4250 3350 L 4250 4850" />
    
    <!-- Schalter WM to WM lamp -->
    <path class="wire" d="M 3650 4550 L 4100 4600 L 5100 4400" />

    <!-- Nodes / Symbols -->
    <!-- C Node -->
    <circle cx="3350" cy="3350" r="40" class="node" />
    <text x="3100" y="3400" class="text">C</text>

    <!-- Junction Box Z -->
    <rect x="4100" y="3250" width="650" height="100" class="junction" />
    <text x="4350" y="3330" class="text">Z</text>

    <!-- D1, D2 -->
    <circle cx="4550" cy="3000" r="30" class="node" />
    <text x="4300" y="2900" class="text">D2</text>
    <circle cx="4950" cy="3050" r="30" class="node" />
    <text x="4800" y="2950" class="text">D1</text>

    <!-- Y2 Top -->
    <circle cx="3700" cy="600" r="50" class="symbol" />
    <path class="symbol" d="M 3700 550 L 3700 450 M 3650 450 L 3750 450" />
    <text x="3900" y="650" class="text">Y2</text>

    <!-- Lamp Top -->
    <path class="symbol" d="M 5100 2200 L 5300 2400 M 5100 2400 L 5300 2200" />

    <!-- Lamp Bottom -->
    <path class="symbol" d="M 5200 3500 L 5400 3700 M 5200 3700 L 5400 3500" />

    <!-- Y2 Right -->
    <circle cx="5650" cy="3100" r="50" class="symbol" />
    <path class="symbol" d="M 5650 3050 L 5650 2950 M 5600 2950 L 5700 2950" />
    <text x="5750" y="3050" class="text">Y2</text>

    <!-- Y3 Nass -->
    <circle cx="6150" cy="3050" r="50" class="symbol" />
    <path class="symbol" d="M 6150 3000 L 6150 2900 M 6100 2900 L 6200 2900" />
    <text x="6300" y="3200" class="text">Y3 Nass</text>

    <!-- Boiler Schalter -->
    <circle cx="3650" cy="4200" r="50" class="symbol" />
    <text x="2800" y="4100" class="text">Boiler</text>
    <text x="2800" y="4300" class="text">schalter</text>

    <!-- Schalter WM -->
    <circle cx="3650" cy="4550" r="50" class="symbol" />
    <text x="2800" y="4600" class="text">schalter</text>
    <text x="3100" y="4800" class="text">WM</text>

    <!-- WM Lamp -->
    <path class="symbol" d="M 5000 4300 L 5200 4500 M 5000 4500 L 5200 4300" />
    <text x="5300" y="4550" class="text-sm">WASCHMASCHINE</text>

    <!-- Y2 Bottom -->
    <circle cx="4250" cy="4850" r="50" class="symbol" />
    <path class="symbol" d="M 4250 4900 L 4250 5000 M 4200 5000 L 4300 5000" />
    <text x="4400" y="4900" class="text">Y2</text>
    <text x="4200" y="5200" class="text">1P geschaltet</text>

    <!-- Title -->
    <text x="6300" y="750" class="text" font-size="250">BAD</text>
    <text x="6300" y="1050" class="text" font-size="250">LAGER</text>
    <text x="6300" y="1350" class="text" font-size="250">BÜRO</text>
</svg>
"""

with open("page_02.svg", "w") as f:
    f.write(svg_content)
print("Updated page_02.svg")
