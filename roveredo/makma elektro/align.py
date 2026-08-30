import numpy as np
from PIL import Image
import os

def align(img_path, png_path):
    img = Image.open(img_path).convert('L')
    png = Image.open(png_path).convert('L')
    
    # Resize img to png size
    w, h = png.size
    img = img.resize((w, h), Image.Resampling.LANCZOS)
    
    # Convert to masks (dark pixels)
    img_arr = np.array(img) < 128
    png_arr = np.array(png) < 128
    
    best_score = -1
    best_params = (1.0, 0, 0)
    
    # Search range
    scales = np.linspace(0.97, 1.03, 7)
    tx_range = np.linspace(-30, 30, 7).astype(int)
    ty_range = np.linspace(-30, 30, 7).astype(int)
    
    for s in scales:
        sw, sh = int(w * s), int(h * s)
        scaled_img = img.resize((sw, sh), Image.Resampling.LANCZOS)
        scaled_arr = np.array(scaled_img) < 128
        
        for tx in tx_range:
            for ty in ty_range:
                # Calculate overlap
                y1, y2 = max(0, ty), min(h, sh + ty)
                x1, x2 = max(0, tx), min(w, sw + tx)
                
                sy1, sy2 = max(0, -ty), min(sh, h - ty)
                sx1, sx2 = max(0, -tx), min(sw, w - tx)
                
                if y2 <= y1 or x2 <= x1: continue
                
                overlap = np.logical_and(png_arr[y1:y2, x1:x2], scaled_arr[sy1:sy2, sx1:sx2]).sum()
                if overlap > best_score:
                    best_score = overlap
                    best_params = (s, tx, ty)
                    
    return best_params

for i in range(1, 6):
    img_p = f"img/page_{i:02d}.jpg"
    png_p = f"/tmp/page_{i:02d}.svg.png"
    if os.path.exists(img_p) and os.path.exists(png_p):
        s, tx, ty = align(img_p, png_p)
        print(f"Page {i:02d}: scale({s:.3f}) translate({tx}px, {ty}px)")
