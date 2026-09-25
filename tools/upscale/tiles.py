#!/usr/bin/env python3
"""
Cut an upscaled map picture into the tiles the renderer streams in.

    python3 tiles.py BIG.png OUT_DIR [SIZE|WxH] [BLEED]

Each tile is SIZE px square (or W by H) of the picture plus BLEED px copied from its
neighbours on every side (edge pixels repeated at the border), saved as
OUT_DIR/<col>_<row>.webp. The bleed is sampled by the filter but never
drawn, so neighbouring tiles meet without a seam. Matches `backdropTiles`
in shared/data/maps.js: { size: SIZE, bleed: BLEED, cols, rows, width, height },
with tileW/tileH for a tile that is not square. The tiles must cover the
picture exactly (the data tests check it), so pick a size that divides it.
"""
import os
import sys

import cv2

src, out = sys.argv[1], sys.argv[2]
spec = sys.argv[3] if len(sys.argv) > 3 else '2048'
tw, th = (int(v) for v in spec.split('x')) if 'x' in spec else (int(spec),) * 2
bleed = int(sys.argv[4]) if len(sys.argv) > 4 else 2
im = cv2.imread(src, cv2.IMREAD_COLOR)
h, w = im.shape[:2]
padded = cv2.copyMakeBorder(im, bleed, bleed, bleed, bleed, cv2.BORDER_REPLICATE)
os.makedirs(out, exist_ok=True)
if w % tw or h % th:
    sys.exit(f'{tw}x{th} tiles do not divide a {w}x{h} picture')
cols, rows = w // tw, h // th
for ty in range(rows):
    for tx in range(cols):
        x0, y0 = tx * tw, ty * th
        tile = padded[y0:y0 + th + 2 * bleed, x0:x0 + tw + 2 * bleed]
        cv2.imwrite(os.path.join(out, f'{tx}_{ty}.webp'), tile, [cv2.IMWRITE_WEBP_QUALITY, 88])
print(f'{cols}x{rows} tiles of {tw}x{th}px (+{bleed} bleed) from {w}x{h}')
