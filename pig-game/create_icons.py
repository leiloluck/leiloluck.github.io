#!/usr/bin/env python3
"""
Create simple PWA icons for the Pig Game app.
This creates solid color icons with emoji for quick testing.

For production, replace these with custom designed icons!
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size, filename):
    """Create a pig face icon with pink circle, eyes, and snout."""
    # Create transparent background
    img = Image.new('RGBA', (size, size), color=(0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    center = size // 2
    
    # Main pink circle (pig face)
    face_radius = int(size * 0.42)  # 84% diameter
    face_bbox = [
        center - face_radius,
        center - face_radius,
        center + face_radius,
        center + face_radius
    ]
    draw.ellipse(face_bbox, fill='#f8b4c0')
    
    # Deep pink stroke (outline)
    stroke_width = max(6, size // 40)
    draw.ellipse(face_bbox, outline='#ff70b3', width=stroke_width)
    
    # Eyes (two black dots)
    eye_radius = int(size * 0.045)  # Small black dots
    eye_y = center - int(size * 0.1)  # Position above center
    eye_spacing = int(size * 0.15)  # Space between eyes
    
    # Left eye
    draw.ellipse([
        center - eye_spacing - eye_radius,
        eye_y - eye_radius,
        center - eye_spacing + eye_radius,
        eye_y + eye_radius
    ], fill='#111827')
    
    # Right eye
    draw.ellipse([
        center + eye_spacing - eye_radius,
        eye_y - eye_radius,
        center + eye_spacing + eye_radius,
        eye_y + eye_radius
    ], fill='#111827')
    
    # Snout (pink oval)
    snout_width = int(size * 0.16)
    snout_height = int(size * 0.12)
    snout_y = center + int(size * 0.08)
    snout_bbox = [
        center - snout_width,
        snout_y - snout_height,
        center + snout_width,
        snout_y + snout_height
    ]
    draw.ellipse(snout_bbox, fill="#f28dc0")
    
    # Nostril holes (two black ellipses)
    nostril_width = int(size * 0.03)
    nostril_height = int(size * 0.05)
    nostril_spacing = int(size * 0.05)
    
    # Left nostril
    draw.ellipse([
        center - nostril_spacing - nostril_width,
        snout_y - nostril_height // 2,
        center - nostril_spacing + nostril_width,
        snout_y + nostril_height // 2
    ], fill='#111827')
    
    # Right nostril
    draw.ellipse([
        center + nostril_spacing - nostril_width,
        snout_y - nostril_height // 2,
        center + nostril_spacing + nostril_width,
        snout_y + nostril_height // 2
    ], fill='#111827')
    
    # Save the image
    img.save(filename, 'PNG', optimize=True)
    print(f"✓ Created {filename} ({size}x{size})")

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    print("Creating PWA icons for Pig Game...")
    print("=" * 50)
    
    # Create 192x192 icon
    create_icon(192, os.path.join(script_dir, 'icon-192.png'))
    
    # Create 512x512 icon
    create_icon(512, os.path.join(script_dir, 'icon-512.png'))
    
    print("=" * 50)
    print("\n✅ Icons created successfully!")
    print("\n⚠️  NOTE: These are basic placeholder icons.")
    print("For a production app, create custom icons:")
    print("  1. Design a pig-themed icon in Figma/Photoshop")
    print("  2. Export as 512x512 PNG")
    print("  3. Use online tool: https://realfavicongenerator.net/")
    print("  4. Replace icon-192.png and icon-512.png")
    print("\nYour app is ready to install on Android!")

if __name__ == "__main__":
    try:
        main()
    except ImportError:
        print("ERROR: PIL (Pillow) not installed.")
        print("Install with: pip install Pillow")
        print("\nOr manually create these PNG files:")
        print("  - icon-192.png (192x192 pixels)")
        print("  - icon-512.png (512x512 pixels)")
        print("  - Use any image editor with a pig-themed design")
        print("  - Recommended colors: #f8b4c0 (pink) background")
