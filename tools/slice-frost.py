#!/usr/bin/env python3
"""Cut the frost sheets into one atlas, assets/fx/frost.webp.

    python3 tools/slice-frost.py

The sheets (assets/fx/source/frost-a.png, frost-c.png) are rows of glints,
stars, snowflakes and blown snow on a thick cyan glow. Only the light is
kept - how bright a pixel is becomes how solid it is, the glow round it
goes - and each piece in a row is found by its bright core, cut out and set
in a square cell. The strips (client/js/ambient.js FrostFx, weather.js):

  glint   small four-point twinkles, played as a twinkle on the ice
  star    large frost stars, for the brightest glints
  flake   snowflakes, drifting across the screen in the blizzard
  gust    long drifts of blown snow, swept across the screen by the wind
"""
import json
import os

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets/fx/source')
OUT = os.path.join(ROOT, 'assets/fx/frost.webp')
# name: (sheet, y band, cell px, min core area, how many to keep at most)
PIECES = {
    'glint': ('frost-a.png', (20, 125), 48, 30, 12),
    'star': ('frost-a.png', (150, 290), 64, 200, 8),
    'flake': ('frost-c.png', (228, 318), 48, 150, 10),
    'gust': ('frost-c.png', (700, 1070), (192, 72), 1500, 6),
}


def light(a):
    """Only the light: white where bright, clear where it was the glow."""
    rgb = a[..., :3].astype(np.float32)
    lum = rgb @ np.float32([0.3, 0.59, 0.11])
    sat = rgb.max(2) - rgb.min(2)
    k = np.clip((lum - 150) / 90, 0, 1) * np.clip(1 - (sat - 60) / 120, 0.3, 1) * (a[..., 3] / 255)
    out = np.zeros_like(a)
    out[..., :3] = np.clip(rgb * 0.5 + np.float32([200, 225, 255]) * 0.5, 0, 255).astype(np.uint8)
    out[..., 3] = (k * 255).astype(np.uint8)
    return out


def pieces(name):
    sheet, (y0, y1), cell, area, keep = PIECES[name]
    a = np.array(Image.open(os.path.join(SRC, sheet)).convert('RGBA'))[y0:y1]
    L = light(a)
    core = (L[..., 3] > 170).astype(np.uint8)
    core = cv2.dilate(core, np.ones((7, 7), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(core)
    boxes = sorted([st[i] for i in range(1, n) if st[i][4] >= area], key=lambda s: -s[4])[:keep]
    boxes.sort(key=lambda s: s[0])
    cw, ch = cell if isinstance(cell, tuple) else (cell, cell)
    out = []
    for x, y, w, h, _ in boxes:
        p = 6
        crop = L[max(0, y - p):y + h + p, max(0, x - p):x + w + p]
        k = min(cw / crop.shape[1], ch / crop.shape[0])
        pm = crop.astype(np.float32)
        pm[..., :3] *= pm[..., 3:4] / 255
        pm = cv2.resize(pm, (max(1, round(crop.shape[1] * k)), max(1, round(crop.shape[0] * k))), interpolation=cv2.INTER_AREA)
        c = np.zeros((ch, cw, 4), np.float32)
        oy, ox = (ch - pm.shape[0]) // 2, (cw - pm.shape[1]) // 2
        c[oy:oy + pm.shape[0], ox:ox + pm.shape[1]] = pm
        al = c[..., 3:4]
        c[..., :3] = np.where(al > 0, c[..., :3] * 255 / np.maximum(al, 1e-3), 0)
        out.append(c.clip(0, 255).astype(np.uint8))
    return out, (cw, ch)


def main():
    strips = [(name, *pieces(name)) for name in PIECES]
    W = max(len(fs) * c[0] for _, fs, c in strips)
    H = sum(c[1] for _, _, c in strips)
    atlas = np.zeros((H, W, 4), np.uint8)
    y, table = 0, {}
    for name, fs, (cw, ch) in strips:
        for i, f in enumerate(fs):
            atlas[y:y + ch, i * cw:(i + 1) * cw] = f
        table[name] = {'at': [0, y], 'cell': [cw, ch], 'frames': len(fs)}
        y += ch
    Image.fromarray(atlas).save(OUT, 'WEBP', quality=90, method=6)
    print('frost.webp', W, 'x', H)
    print(json.dumps(table))


if __name__ == '__main__':
    main()
