import numpy as np
from PIL import Image
import os

def get_mask(path, size=None):
    img = Image.open(path).convert('L')
    if size:
        img = img.resize(size, Image.Resampling.LANCZOS)
    arr = np.array(img)
    return (arr < 128).astype(np.float32), img.size

def score_transform(mask_png, mask_img, s, tx, ty):
    h_p, w_p = mask_png.shape
    h_i, w_i = mask_img.shape
    
    # Scale img mask
    si_h, si_w = int(h_i * s), int(w_i * s)
    if si_h == 0 or si_w == 0: return -1
    
    # Simple resize of mask for speed in coarse search
    img_scaled = Image.fromarray(mask_img).resize((si_w, si_h), Image.Resampling.NEAREST)
    img_scaled = np.array(img_scaled)
    
    y1, y2 = max(0, ty), min(h_p, si_h + ty)
    x1, x2 = max(0, tx), min(w_p, si_w + tx)
    
    sy1, sy2 = max(0, -ty), min(si_h, h_p - ty)
    sx1, sx2 = max(0, -tx), min(si_w, w_p - tx)
    
    if y2 <= y1 or x2 <= x1: return 0
    
    return np.logical_and(mask_png[y1:y2, x1:x2], img_scaled[sy1:sy2, sx1:sx2]).sum()

mask_png, size_p = get_mask("/tmp/page_03.svg.png")
mask_img, size_i = get_mask("img/page_03.jpg", size=size_p)

best_score = -1
best_params = (1.0, 0, 0)

# Coarse search
scales = np.linspace(0.85, 1.15, 15)
txs = np.linspace(-400, 400, 20).astype(int)
tys = np.linspace(-400, 400, 20).astype(int)

for s in scales:
    for tx in txs:
        for ty in tys:
            sc = score_transform(mask_png, mask_img, s, tx, ty)
            if sc > best_score:
                best_score = sc
                best_params = (s, tx, ty)

# Refine
s_best, tx_best, ty_best = best_params
scales = np.linspace(s_best - 0.02, s_best + 0.02, 10)
txs = np.linspace(tx_best - 20, tx_best + 20, 10).astype(int)
tys = np.linspace(ty_best - 20, ty_best + 20, 10).astype(int)

for s in scales:
    for tx in txs:
        for ty in tys:
            sc = score_transform(mask_png, mask_img, s, tx, ty)
            if sc > best_score:
                best_score = sc
                best_params = (s, tx, ty)

s, tx, ty = best_params
w, h = size_p
print(f"Best: scale({s:.4f}) translate({tx/w*100:.2f}%, {ty/h*100:.2f}%) Score: {best_score}")
