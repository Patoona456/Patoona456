#!/usr/bin/env python3
"""Emberhold's ground, and the buildings lifted off it so people walk behind them.

    python3 tools/build-town.py TOWN_X4.png

TOWN_X4.png is assets/maps/source/emberhold3/full.png (1536x1024) upscaled 4x
by Real-ESRGAN (tools/upscale/esrgan.py). Writes:
  assets/maps/emberhold.webp          the 1x picture: placeholder while tiles load, and the minimap
  assets/maps/emberhold/ground/*.webp the 4x picture in 2048px tiles, 2px bleed
  assets/maps/emberhold/roofs.webp    each building (and the fountain's statue) cut out of
                                      the 4x picture, packed in one sheet
and prints the `structures` for shared/data/maps.js. The town is one
painting, so a house on it would be drawn under whoever walks behind it; the
cut-out is drawn again over them, sorted by the house's front. It keeps what
stands on ground nobody walks on, and elsewhere only what is not paving - so
the roof that hangs over a path covers you, the path itself does not.
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
TOWN = 'assets/maps/source/emberhold3/full.png'
COLS, ROWS = 90, 60
K = 4                                   # the upscale
SHEET_W = 4096
# x0, y0, x1, y1 on the 1x picture; the bottom edge is the building's front
BUILDINGS = {
    'nw_house': (300, 75, 490, 300),
    'w_house': (380, 295, 578, 472),
    'ne_row': (985, 110, 1278, 302),
    'e_hall': (958, 300, 1168, 492),
    'sw_cottages': (195, 558, 348, 702),
    'sw_house': (295, 680, 408, 882),
    's_row': (478, 680, 692, 892),
    's_house': (872, 712, 992, 896),
    'chapel': (1075, 578, 1316, 842),
    'fountain': (680, 352, 862, 558),
    'e_edge': (1438, 40, 1536, 222),
    'w_edge': (0, 88, 62, 192),
}


def obstacles():
    rows = [ln.split("'")[1] for ln in open(os.path.join(ROOT, 'shared/data/emberhold-obstacles.js')) if ln.startswith("  '")]
    return np.array([[c == '#' for c in r] for r in rows])


def main(big):
    small = np.array(Image.open(os.path.join(ROOT, TOWN)).convert('RGB'))
    H, W = small.shape[:2]
    Image.fromarray(small).save(os.path.join(ROOT, 'assets/maps/emberhold.webp'), 'WEBP', quality=90, method=6)
    x4 = Image.open(big).convert('RGB')
    assert x4.size == (W * K, H * K), x4.size
    # the ground, in tiles the renderer streams in
    tiles = os.path.join(ROOT, 'assets/maps/emberhold/ground')
    os.makedirs(tiles, exist_ok=True)
    a = np.array(x4)
    pad = cv2.copyMakeBorder(a, 2, 2, 2, 2, cv2.BORDER_REPLICATE)
    for ty in range(H * K // 2048):
        for tx in range(W * K // 2048):
            t = pad[ty * 2048:ty * 2048 + 2052, tx * 2048:tx * 2048 + 2052]
            Image.fromarray(t).save(os.path.join(tiles, f'{tx}_{ty}.webp'), 'WEBP', quality=88, method=6)

    # what counts as paving on the 1x picture
    hsv = cv2.cvtColor(cv2.GaussianBlur(small, (0, 0), 1.0), cv2.COLOR_RGB2HSV).astype(int)
    h, s, v = hsv[..., 0] * 2, hsv[..., 1], hsv[..., 2]
    pave = (s < 90) & (v >= 150) & ((h <= 45) | (s < 30))
    blocked = cv2.resize(obstacles().astype(np.uint8), (W, H), interpolation=cv2.INTER_NEAREST).astype(bool)
    keep = blocked | ~pave
    keep = cv2.morphologyEx(keep.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))

    # shelf-pack the cut-outs
    cuts, x, y, row = [], 0, 0, 0
    for name, (x0, y0, x1, y1) in BUILDINGS.items():
        w, hh = (x1 - x0) * K, (y1 - y0) * K
        if x + w > SHEET_W:
            x, y, row = 0, y + row + 2, 0
        cuts.append((name, (x0, y0, x1, y1), (x, y, w, hh)))
        x, row = x + w + 2, max(row, hh)
    sheet = Image.new('RGBA', (SHEET_W, y + row))
    tile = W / COLS
    print('    structures: [')
    for name, (x0, y0, x1, y1), (sx, sy, w, hh) in cuts:
        m = keep[y0:y1, x0:x1].astype(np.float32)
        m = cv2.resize(m, (w, hh), interpolation=cv2.INTER_LINEAR)
        m = cv2.GaussianBlur(m, (0, 0), 1.2)
        rgb = np.array(x4.crop((x0 * K, y0 * K, x1 * K, y1 * K)))
        piece = np.dstack([rgb, (np.clip(m * 1.3, 0, 1) * 255).astype(np.uint8)])
        sheet.alpha_composite(Image.fromarray(piece), (sx, sy))
        print(f"      {{ kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [{sx}, {sy}, {w}, {hh}], "
              f"x: {x0 / tile:.2f}, y: {y0 / tile:.2f}, w: {(x1 - x0) / tile:.2f}, h: {(y1 - y0) / tile:.2f}, walk: true }},   // {name}")
    print('    ],')
    sheet.save(os.path.join(ROOT, 'assets/maps/emberhold/roofs.webp'), 'WEBP', quality=88, method=6)
    print('roofs.webp', sheet.size)


if __name__ == '__main__':
    main(sys.argv[1])
