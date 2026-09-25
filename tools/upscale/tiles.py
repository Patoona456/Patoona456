#!/usr/bin/env python3
"""
Cut an upscaled map picture into the tiles the renderer streams in.

    python3 tiles.py BIG.png OUT_DIR [SIZE] [BLEED]

Each tile is SIZE px of the picture plus BLEED px copied from its
neighbours on every side (edge pixels repeated at the border), saved as
OUT_DIR/<col>_<row>.webp. The bleed is sampled by the filter but never
drawn, so neighbouring tiles meet without a seam. Matches `backdropTiles`
in shared/data/maps.js: { size: SIZE, bleed: BLEED, cols, rows, width, height }.
"""
import os
import sys

import cv2
import numpy as np

src, out = sys.argv[1], sys.argv[2]
size = int(sys.argv[3]) if len(sys.argv) > 3 else 2048
bleed = int(sys.argv[4]) if len(sys.argv) > 4 else 2
im = cv2.imread(src, cv2.IMREAD_COLOR)
h, w = im.shape[:2]
padded = cv2.copyMakeBorder(im, bleed, bleed, bleed, bleed, cv2.BORDER_REPLICATE)
os.makedirs(out, exist_ok=True)
cols, rows = (w + size - 1) // size, (h + size - 1) // size
for ty in range(rows):
    for tx in range(cols):
        x0, y0 = tx * size, ty * size
        tile = padded[y0:y0 + size + 2 * bleed, x0:x0 + size + 2 * bleed]
        if tile.shape[0] < size + 2 * bleed or tile.shape[1] < size + 2 * bleed:
            full = np.zeros((size + 2 * bleed, size + 2 * bleed, 3), np.uint8)
            full[:tile.shape[0], :tile.shape[1]] = tile
            tile = full
        cv2.imwrite(os.path.join(out, f'{tx}_{ty}.webp'), tile, [cv2.IMWRITE_WEBP_QUALITY, 88])
print(f'{cols}x{rows} tiles of {size}px (+{bleed} bleed) from {w}x{h}')
