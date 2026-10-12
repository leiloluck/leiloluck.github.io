#!/usr/bin/env python3
"""
Create the PWA icons for the Pig Game app.

One artwork, four files: a full-bleed #f8b4c0 ("normal pink") tile carrying the pig's
features - two dark eyes, a deeper-pink snout, two dark nostrils. There is no face
outline and no bright ring; the tile itself is the face. The features sit inside the
central 80% (Android's maskable safe zone), so the same drawing works for "any",
"maskable" and the iOS 180px icon.

Drawn at 4x and downsampled with LANCZOS: PIL's ellipse is not antialiased, and the
jagged edges showed at home-screen size.

Run:  python create_icons.py
"""

from PIL import Image, ImageDraw
import os

BG    = (248, 180, 192, 255)   # #f8b4c0 - the normal pink tile
INK   = (17, 24, 39, 255)      # #111827 - eyes and nostrils
SNOUT = (242, 141, 192, 255)   # #f28dc0 - deeper pink, reads as a snout on the tile

SS = 4                         # supersampling factor


def create_icon(size, filename):
    """Draw the pig face at `size` px and save it as a PNG."""
    s = size * SS
    img = Image.new('RGBA', (s, s), BG)
    draw = ImageDraw.Draw(img)
    c = s / 2

    def dot(x, y, rx, ry, fill):
        draw.ellipse([x - rx, y - ry, x + rx, y + ry], fill=fill)

    # Eyes: two dark dots above the centre.
    dot(c - 0.250 * s, c - 0.155 * s, 0.075 * s, 0.075 * s, INK)
    dot(c + 0.250 * s, c - 0.155 * s, 0.075 * s, 0.075 * s, INK)

    # Snout: one big deeper-pink oval under them.
    dot(c, c + 0.155 * s, 0.270 * s, 0.205 * s, SNOUT)

    # Nostrils: two dark dots inside the snout.
    dot(c - 0.085 * s, c + 0.155 * s, 0.048 * s, 0.082 * s, INK)
    dot(c + 0.085 * s, c + 0.155 * s, 0.048 * s, 0.082 * s, INK)

    img = img.resize((size, size), Image.LANCZOS)
    img.save(filename, 'PNG', optimize=True)
    print(f"created {os.path.basename(filename)} ({size}x{size})")


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    for size, name in (
        (192, 'icon-192.png'),
        (512, 'icon-512.png'),
        (512, 'icon-maskable-512.png'),
        (180, 'apple-touch-icon-180.png'),
    ):
        create_icon(size, os.path.join(here, name))


if __name__ == '__main__':
    main()
