import json

svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8861 6234" width="8861" height="6234">
    <!-- Embedded background image for visual reference and alignment -->
    <!-- Opacity set to 0.5 to easily see the vector lines on top -->
    <image href="page_02.jpg" x="0" y="0" width="8861" height="6234" opacity="0.6" />

    <style>
        .wall { stroke: #64748b; stroke-width: 25; fill: none; stroke-linecap: round; stroke-linejoin: round; }
        .wall-thin { stroke: #94a3b8; stroke-width: 15; fill: none; stroke-dasharray: 40 40; }
        .wire { stroke: #0284c7; stroke-width: 25; fill: none; stroke-linecap: round; }
        .symbol { stroke: #0284c7; stroke-width: 20; fill: none; }
        .text { font-family: 'Inter', sans-serif; font-size: 180px; fill: #0f172a; font-weight: 600; }
        .text-sm { font-family: 'Inter', sans-serif; font-size: 140px; fill: #0f172a; }
        .node { fill: #facc15; stroke: #ca8a04; stroke-width: 15; }
        .junction { fill: #fff; stroke: #0284c7; stroke-width: 15; }
    </style>

    <!-- Walls -->
    <path class="wall" d="M 3250 480 L 4250 430 L 4150 1250 L 5050 1220 L 6100 1850 L 6200 2750 L 4050 3300" />
    <path class="wall" d="M 4050 3300 L 4050 4050" />
    <!-- Lower Room -->
    <path class="wall" d="M 4050 4050 L 5850 4050 L 5850 5000 L 4050 5000 Z" />
    <!-- Line from lower room to upper diagonal -->
    <path class="wall" d="M 5850 4050 L 5450 3000" /> <!-- approximate, needs checking -->

    <!-- Electrical Wires -->
    <!-- C to Junction Z -->
    <path class="wire" d="M 3300 3400 L 4100 3400" />
    <!-- Junction Z to Y2 Top -->
    <path class="wire" d="M 4400 3300 L 4400 2200 L 3900 850 L 3800 700" />
    <!-- Junction Z to Lamp Top -->
    <path class="wire" d="M 4500 3300 L 5000 2500" />
    <!-- Junction Z to D1, D2 -->
    <path class="wire" d="M 4300 3300 L 4300 3100" />
    <path class="wire" d="M 4600 3300 L 4600 3100" />
    <!-- Junction Z to Lamp Bottom -->
    <path class="wire" d="M 4800 3300 L 4900 3700" />
    <!-- Junction Z to Y2 right -->
    <path class="wire" d="M 4800 3300 L 5400 3100" />
    <!-- Junction Z to Y3 Nass -->
    <path class="wire" d="M 4800 3300 L 6000 3200" />
    <!-- Junction Z to Boiler & WM switches -->
    <path class="wire" d="M 4100 3400 L 3700 4400 L 3700 4800" />
    <!-- Junction Z to WM Socket -->
    <path class="wire" d="M 4200 3400 L 4200 4400 L 4400 4900" />
    <!-- Switches to WM lamp -->
    <path class="wire" d="M 3700 4800 L 4400 4800 L 5000 4500" />

    <!-- Nodes / Symbols -->
    <!-- C Node -->
    <circle cx="3300" cy="3400" r="40" class="node" />
    <text x="3050" y="3450" class="text">C</text>

    <!-- Junction Box Z -->
    <rect x="4100" y="3300" width="700" height="150" class="junction" />
    <text x="4400" y="3420" class="text">Z</text>

    <!-- D1, D2 -->
    <circle cx="4300" cy="3100" r="30" class="node" />
    <text x="4100" y="3050" class="text">D2</text>
    <circle cx="4600" cy="3100" r="30" class="node" />
    <text x="4650" y="3050" class="text">D1</text>

    <!-- Y2 Top -->
    <circle cx="3800" cy="700" r="50" class="symbol" />
    <path class="symbol" d="M 3800 650 L 3800 550 M 3750 550 L 3850 550" />
    <text x="3900" y="750" class="text">Y2</text>

    <!-- Lamp Top -->
    <path class="symbol" d="M 4900 2400 L 5100 2600 M 4900 2600 L 5100 2400" />

    <!-- Lamp Bottom -->
    <path class="symbol" d="M 4800 3600 L 5000 3800 M 4800 3800 L 5000 3600" />

    <!-- Y2 Right -->
    <circle cx="5400" cy="3100" r="50" class="symbol" />
    <text x="5500" y="3150" class="text">Y2</text>

    <!-- Y3 Nass -->
    <circle cx="6000" cy="3200" r="50" class="symbol" />
    <text x="6100" y="3250" class="text">Y3 Nass</text>

    <!-- Boiler Schalter -->
    <circle cx="3700" cy="4400" r="50" class="symbol" />
    <text x="2800" y="4350" class="text">Boiler</text>
    <text x="2800" y="4550" class="text">schalter</text>

    <!-- Schalter WM -->
    <circle cx="3700" cy="4800" r="50" class="symbol" />
    <text x="2800" y="4800" class="text">schalter</text>
    <text x="3100" y="5000" class="text">WM</text>

    <!-- WM Lamp -->
    <path class="symbol" d="M 4900 4400 L 5100 4600 M 4900 4600 L 5100 4400" />
    <text x="5150" y="4550" class="text-sm">WASCHMASCHINE</text>

    <!-- Y2 Bottom -->
    <circle cx="4400" cy="4900" r="50" class="symbol" />
    <text x="4500" y="4950" class="text">Y2</text>
    <text x="3900" y="5300" class="text">1P geschaltet</text>

    <!-- Title -->
    <text x="6300" y="700" class="text" font-size="250">BAD</text>
    <text x="6300" y="1000" class="text" font-size="250">LAGER</text>
    <text x="6300" y="1300" class="text" font-size="250">BÜRO</text>
</svg>
"""

with open("page_02.svg", "w") as f:
    f.write(svg_content)
print("Created page_02.svg")
