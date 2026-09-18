#!/usr/bin/env python3
"""
Generate audio-files.json from the audio directory structure.
Run this script whenever you add new audio files to automatically update the website.

Usage: python generate_audio_index.py
"""

import os
import json
from pathlib import Path
import math

# Define the category mapping and their display properties
CATEGORIES = {
    "start game": {
        "title": "Start Game",
        "type": "music"
    },
    "mid game": {
        "title": "Mid Game", 
        "type": "music"
    },
    "end game": {
        "title": "End Game",
        "type": "music"
    },
    "victory": {
        "title": "Victory",
        "type": "music"
    },
    "sounds": {
        "title": "Sound Effects",
        "type": "sound"
    },
    "more sounds": {
        "title": "More Sound Effects",
        "type": "sound"
    }
}

def rgb_to_hex(r, g, b):
    """Convert RGB values (0-255) to hex color string."""
    return f"#{int(r):02x}{int(g):02x}{int(b):02x}"

def oklch_to_srgb(l, c, h):
    """
    Convert OKLCH to sRGB.
    L: Lightness (0-1)
    C: Chroma (0-0.4 typical, max ~0.5)
    H: Hue (0-360 degrees)
    Returns: (r, g, b) values in 0-1 range
    """
    # Convert OKLCH to OKLab
    h_rad = math.radians(h)
    a = c * math.cos(h_rad)
    b = c * math.sin(h_rad)
    
    # Convert OKLab to linear RGB
    l_ = l + 0.3963377774 * a + 0.2158037573 * b
    m_ = l - 0.1055613458 * a - 0.0638541728 * b
    s_ = l - 0.0894841775 * a - 1.2914855480 * b
    
    l = l_ * l_ * l_
    m = m_ * m_ * m_
    s = s_ * s_ * s_
    
    r_linear = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g_linear = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    b_linear = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    
    # Convert linear RGB to sRGB (gamma correction)
    def linear_to_srgb(x):
        if x <= 0.0031308:
            return 12.92 * x
        else:
            return 1.055 * (x ** (1/2.4)) - 0.055
    
    r = linear_to_srgb(r_linear)
    g = linear_to_srgb(g_linear)
    b = linear_to_srgb(b_linear)
    
    # Clamp to valid range
    r = max(0, min(1, r))
    g = max(0, min(1, g))
    b = max(0, min(1, b))
    
    return r, g, b

def generate_rainbow_gradient(num_colors):
    """
    Generate a rainbow gradient using OKLCH color space for perceptually uniform brightness.
    OKLCH provides better perceptual uniformity than HSV/HSL.
    
    Parameters:
    - L (Lightness): Fixed at 0.65 for good contrast with white text
    - C (Chroma): Fixed at 0.2 for vivid but not oversaturated colors
    - H (Hue): Rotates 0° to 360° for full rainbow
    
    Returns list of hex color strings.
    """
    if num_colors <= 0:
        return []
    if num_colors == 1:
        # A single red color
        r, g, b = oklch_to_srgb(0.65, 0.2, 25)  # L, C, H
        return [rgb_to_hex(r * 255, g * 255, b * 255)]

    colors = []
    # Fixed lightness (L) at 0.65 for consistent brightness
    # Fixed chroma (C) at 0.2 for vivid colors with good saturation
    lightness = 0.65
    chroma = 0.2
    
    for i in range(num_colors):
        # Rotate hue from 30° (red) to 300° (purple) - visible spectrum
        # In OKLCH: 30° = red, 100° = yellow, 145° = green, 230° = blue, 300° = purple
        hue = 30 + (i / (num_colors - 1)) * 270
        r, g, b = oklch_to_srgb(lightness, chroma, hue)
        colors.append(rgb_to_hex(r * 255, g * 255, b * 255))
    
    return colors

# Icon mapping for common words in filenames
ICON_MAP = {
    "funny": "😂",
    "monkey": "🐒",
    "monkeys": "🐒",
    "elevator": "⏹",
    "kahoot": "🎓",
    "game show": "🎤",
    "game_show": "🎤",
    "jeopardy": "🧠",
    "epic": "🎶",
    "casino": "🎰",
    "dark": "🌙",
    "night": "🌙",
    "medival": "⚔️",
    "medieval": "⚔️",
    "millionaire": "💰",
    "ultrakill": "💥",
    "fortuna": "🎵",
    "violin": "🎻",
    "winning": "🏆",
    "win": "🏆",
    "price": "🎉",
    "family": "👪",
    "feud": "👪",
    "credits": "🎓",
    "boom": "🔊",
    "horn": "📢",
    "applause": "👏",
    "bruh": "😐",
    "golf": "👍",
    "clap": "👍",
    "damage": "💥",
    "failure": "❌",
    "fortnite": "🕹️",
    "game over": "💀",
    "game_over": "💀",
    "pipes": "🚰",
    "rizz": "😏",
    "spongebob": "🍍",
    "wow": "😲",
    "happy music": "😊",
    "spanish flea": "🎺",
    "root beer": "🍺",
    "music": "🎵",
    "sound": "🔊",
    "rich": "💰",
    "baba box": "📦",
    "baba key": "🗝️",
    "animal chill": "🐾",
    "jazz": "🎷"
}

def get_icon_for_filename(filename):
    """Try to find an appropriate icon based on filename."""
    name_lower = filename.lower()
    for keyword, icon in ICON_MAP.items():
        if keyword in name_lower:
            return icon
    return "🎵"  # Default music icon

def clean_filename(filename):
    """Clean filename to create display name."""
    # Remove extension
    name = os.path.splitext(filename)[0]
    # Replace underscores with spaces
    name = name.replace("_", " ")
    return name

def scan_audio_directory():
    """Scan the audio directory and build the data structure."""
    script_dir = Path(__file__).parent
    audio_dir = script_dir / "audio"
    
    if not audio_dir.exists():
        print(f"Error: audio directory not found at {audio_dir}")
        return None
    
    result = {
        "categories": []
    }
    
    # Scan each category folder
    for category_folder, category_info in CATEGORIES.items():
        category_path = audio_dir / category_folder
        
        if not category_path.exists():
            print(f"Warning: Category folder '{category_folder}' not found, skipping...")
            continue
        
        files = []
        mp3_files = sorted([f for f in os.listdir(category_path) if f.endswith('.mp3')])
        
        if not mp3_files:
            print(f"Info: No MP3 files found in '{category_folder}', skipping...")
            continue
        
        # Generate rainbow gradient colors for this category
        colors = generate_rainbow_gradient(len(mp3_files))
        
        for idx, filename in enumerate(mp3_files):
            file_path = f"audio/{category_folder}/{filename}"
            display_name = clean_filename(filename)
            icon = get_icon_for_filename(filename)
            color = colors[idx]  # Use the gradient color
            
            files.append({
                "filename": filename,
                "path": file_path,
                "displayName": display_name,
                "icon": icon,
                "color": color,
                # Exact size, so the app can show what an offline download costs and
                # tell a complete cached copy from a truncated one.
                "bytes": (category_path / filename).stat().st_size
            })
        
        result["categories"].append({
            "id": category_folder,
            "title": category_info["title"],
            "type": category_info["type"],
            "files": files
        })
    
    return result

def main():
    print("Scanning audio directory...")
    data = scan_audio_directory()
    
    if data is None:
        print("Failed to scan audio directory.")
        return
    
    # Write JSON file
    output_file = Path(__file__).parent / "audio-files.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Successfully generated {output_file}")
    print(f"  Found {sum(len(cat['files']) for cat in data['categories'])} audio files")
    print(f"  across {len(data['categories'])} categories")
    
    # Print summary
    print("\nSummary:")
    for category in data["categories"]:
        print(f"  - {category['title']}: {len(category['files'])} files")

if __name__ == "__main__":
    main()
