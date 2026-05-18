import json

svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9398 6408" width="9398" height="6408">
    <image href="../img/page_03.jpg" x="0" y="0" width="9398" height="6408" opacity="0.6" />

    <style>
        .wall { stroke: #64748b; stroke-width: 20; fill: none; stroke-linecap: round; stroke-linejoin: round; }
        .wall-thin { stroke: #94a3b8; stroke-width: 15; fill: none; stroke-dasharray: 40 40; }
        .wire { stroke: #0284c7; stroke-width: 25; fill: none; stroke-linecap: round; }
        .symbol { stroke: #0284c7; stroke-width: 20; fill: none; stroke-linecap: round; }
        .text { font-family: 'Inter', sans-serif; font-size: 180px; fill: #0f172a; font-weight: 600; }
        .text-sm { font-family: 'Inter', sans-serif; font-size: 140px; fill: #0f172a; }
        .node { fill: #facc15; stroke: #ca8a04; stroke-width: 15; }
        .junction { fill: #fff; stroke: #0284c7; stroke-width: 15; }
    </style>

    <!-- Title -->
    <text x="4300" y="600" class="text" font-size="300">HAUPTRAUM</text>

    <!-- Room Box Wireframe -->
    <!-- Top Back -->
    <path class="wall" d="M 3100 1250 L 7600 850" />
    <!-- Top Front -->
    <path class="wall" d="M 2550 2750 L 7300 2600" />
    <!-- Top Left -->
    <path class="wall" d="M 2550 2750 L 3100 1250" />
    <!-- Top Right -->
    <path class="wall" d="M 7300 2600 L 7900 900" />
    <!-- Front Left Vertical -->
    <path class="wall" d="M 2550 2750 L 2500 5500" />
    <!-- Back Left Vertical -->
    <path class="wall" d="M 3100 1250 L 3100 5000" />
    <!-- Front Right Vertical -->
    <path class="wall" d="M 7300 2600 L 7300 5200" />
    <!-- Back Right Vertical -->
    <path class="wall" d="M 7900 900 L 7900 5200" />

    <!-- Bottom Front -->
    <path class="wall" d="M 2500 5500 L 7800 5200" />
    <!-- Bottom Left -->
    <path class="wall" d="M 2500 5500 L 3100 5000" />
    <!-- Bottom Right -->
    <path class="wall" d="M 7300 5200 L 7900 5200" />

    <!-- Wires and Symbols -->
    
    <!-- Left ceiling nodes -->
    <circle cx="2650" cy="2750" r="30" class="node" />
    <text x="2600" y="2700" class="text">Y 1+1</text>
    
    <circle cx="2800" cy="2000" r="30" class="node" />
    <text x="2850" y="2000" class="text">Y 1+1</text>

    <circle cx="2950" cy="1300" r="30" class="node" />
    <text x="3000" y="1300" class="text">Y 1+1</text>

    <!-- Right ceiling nodes -->
    <circle cx="4300" cy="1150" r="30" class="node" />
    <text x="4100" y="1100" class="text">Y 1+1</text>

    <circle cx="5600" cy="1000" r="30" class="node" />
    <text x="5400" y="1000" class="text">Y 1+1</text>

    <circle cx="6700" cy="900" r="30" class="node" />
    <text x="6500" y="900" class="text">Y 1+1</text>
    
    <!-- Mid wall nodes -->
    <circle cx="4350" cy="4050" r="30" class="node" />
    <text x="4100" y="4000" class="text">Y 1+1</text>

    <circle cx="5850" cy="4050" r="30" class="node" />
    <text x="5400" y="4000" class="text">Y 1+1</text>

    <circle cx="6900" cy="4050" r="30" class="node" />
    <text x="6500" y="4000" class="text">Y 1+1</text>

    <!-- Bottom drops -->
    <!-- Drops from mid wall to floor -->
    <path class="wire" d="M 4050 4050 L 4000 5400" />
    <rect x="3900" y="5350" width="150" height="150" class="junction" />
    <text x="4200" y="5450" class="text">Y 1+1</text>
    <circle cx="4550" cy="5350" r="30" class="node" />

    <path class="wire" d="M 5200 4050 L 5200 5400" />
    <rect x="5100" y="5350" width="150" height="150" class="junction" />
    <text x="5350" y="5450" class="text">Y 1+1</text>
    <circle cx="5750" cy="5350" r="30" class="node" />

    <path class="wire" d="M 6400 4050 L 6400 5400" />
    <rect x="6300" y="5350" width="150" height="150" class="junction" />
    <text x="6550" y="5450" class="text">Y 1+1</text>
    <circle cx="6950" cy="5350" r="30" class="node" />

    <!-- A and B marks -->
    <text x="3200" y="6100" class="text" font-size="250">A</text>
    <text x="7900" y="5100" class="text" font-size="250">B</text>
    
</svg>
"""

with open("svg/page_03.svg", "w") as f:
    f.write(svg_content)
