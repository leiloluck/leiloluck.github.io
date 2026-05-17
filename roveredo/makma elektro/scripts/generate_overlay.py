from PIL import Image, ImageDraw

# Absolute coordinates for 8861x6234
points = {
    # Walls
    "w1": (3300, 500),
    "w2": (4200, 500),
    "w3": (4200, 1200),
    "w4": (5100, 1200),
    "w5": (6100, 1800),
    "w6": (6200, 2700),
    "w7": (4500, 3300),
    "w8": (4100, 3300),
    
    # lower room
    "w9": (4100, 4000),
    "w10": (5900, 4000),
    "w11": (5900, 4900),
    "w12": (4100, 4900),
}

walls = [
    ["w1", "w2", "w3", "w4", "w5", "w6", "w7", "w8"],
    ["w8", "w9"],
    ["w7", "w10"],
    ["w9", "w10", "w11", "w12", "w9"],
]

img = Image.open('page_02.jpg')
scale = 10
img = img.resize((img.width // scale, img.height // scale))
draw = ImageDraw.Draw(img)

for path in walls:
    for i in range(len(path) - 1):
        p1 = points[path[i]]
        p2 = points[path[i+1]]
        x1, y1 = p1[0] // scale, p1[1] // scale
        x2, y2 = p2[0] // scale, p2[1] // scale
        draw.line([x1, y1, x2, y2], fill="red", width=3)

for name, p in points.items():
    x, y = p[0] // scale, p[1] // scale
    draw.ellipse([x-5, y-5, x+5, y+5], fill="blue")
    draw.text((x+8, y-8), name, fill="blue")

img.save('debug_overlay.jpg')
