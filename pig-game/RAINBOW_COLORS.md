# Rainbow Gradient Color System 🌈

## Overview

The audio files are now automatically colored with a **rainbow gradient** that spans from **red to purple** across the visible spectrum!

## Color Spectrum

Each category gets its own gradient based on the number of files:
- **First file**: Red (#ff0000)
- **Middle files**: Yellow → Green → Cyan → Blue
- **Last file**: Purple (#7f00ff)

## How It Works

### HSV Color Space
The script uses the HSV (Hue, Saturation, Value) color model:
- **Hue**: 0° (red) → 270° (purple)
- **Saturation**: 100% (vivid colors)
- **Value**: 100% (maximum brightness)

### Gradient Calculation
For each category:
1. Count the number of MP3 files
2. Divide the 270° spectrum evenly
3. Generate colors at those intervals
4. Convert from HSV to RGB hex codes

## Example Gradients

### 6 Files (Start Game, Mid Game):
1. 🔴 Red (#ff0000) - 0°
2. 🟡 Yellow (#ffe500) - 54°
3. 🟢 Green (#32ff00) - 108°
4. 🩵 Cyan (#00ffb2) - 162°
5. 🔵 Blue (#0065ff) - 216°
6. 🟣 Purple (#7f00ff) - 270°

### 5 Files (End Game, Victory):
1. 🔴 Red (#ff0000) - 0°
2. 🟡 Yellow-Green (#dfff00) - 67.5°
3. 🟢 Green (#00ff3f) - 135°
4. 🔵 Cyan-Blue (#003fff) - 202.5°
5. 🟣 Purple (#bf00ff) - 270°

### 14 Files (Sound Effects):
1. 🔴 Red (#ff0000)
2. 🟠 Orange-Red
3. 🟠 Orange
4. 🟡 Yellow-Orange
5. 🟡 Yellow
6. 🟢 Yellow-Green
7. 🟢 Green
8. 🩵 Green-Cyan
9. 🩵 Cyan
10. 🔵 Cyan-Blue
11. 🔵 Blue
12. 🔵 Blue-Indigo
13. 🟣 Indigo
14. 🟣 Purple (#7f00ff)

## Benefits

✅ **Automatic**: Colors adjust to the number of files
✅ **Consistent**: Always red → purple progression
✅ **Visual**: Easy to see categories at a glance
✅ **Scalable**: Add 2 files or 20 files - gradient adapts
✅ **Spectrum-accurate**: Uses true visible light wavelengths

## Code

The gradient generation happens in `generate_rainbow_gradient()`:

```python
def generate_rainbow_gradient(num_colors):
    """
    Generate a rainbow gradient from red to purple.
    Uses HSV color space for smooth transitions.
    Hue goes from 0° (red) to 270° (purple).
    """
    colors = []
    for i in range(num_colors):
        # Map index to hue: 0° (red) to 270° (purple)
        hue = (i / (num_colors - 1)) * 270
        # Convert HSV to RGB...
```

## Future Customization

Want different gradients? Easy to modify:

### Cool Colors Only (Blue → Purple):
```python
hue = 180 + (i / (num_colors - 1)) * 90  # 180° to 270°
```

### Warm Colors Only (Red → Yellow):
```python
hue = (i / (num_colors - 1)) * 60  # 0° to 60°
```

### Full Rainbow (Red → Red):
```python
hue = (i / num_colors) * 360  # 0° to 360°
```

## Visual Comparison

### Before (Manual Colors):
- Fixed color arrays
- Required manual editing
- Inconsistent across categories
- Didn't scale with file count

### After (Rainbow Gradient):
- Automatic generation
- Perfect red → purple progression
- Consistent across all categories
- Scales automatically

## Technical Details

**Color Space**: HSV → RGB → Hex
**Range**: 0° to 270° (300° of visible spectrum)
**Formula**: `hue = (index / (count - 1)) * 270`
**Output**: Hex strings like `#ff0000`, `#7f00ff`

## Try It!

Add a new file and run the script:
```bash
python generate_audio_index.py
```

Watch how the gradient automatically adjusts to include your new file while maintaining the red → purple progression! 🌈✨
