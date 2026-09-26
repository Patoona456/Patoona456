#!/usr/bin/env python3
"""Cut the autumn leaf sheet into one atlas, assets/fx/leaves.webp.

    python3 tools/slice-leaves.py

assets/fx/source/leaves.png: rows of single leaves (the top two), clusters,
and leaves blurred by speed (the last two), on a clear ground edged in the
painter's red matte. Each leaf is found as a solid piece, the red dropped
from its edge, and set in a square cell (a streak in a wide one). Used by
weather.js for the leaves blowing across the screen in Amberwood.

  leaf    single leaves, tumbling as they drift
  streak  leaves blurred by the wind, for the gusts
"""
import json
import os

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets/fx/source/leaves.png')
OUT = os.path.join(ROOT, 'assets/fx/leaves.webp')
# name: (y bands, cell w, h, min area, keep at most)
PIECES = {
    'leaf': ([(30, 180), (178, 330)], 64, 64, 2500, 20),
    'streak': ([(780, 905), (915, 1045)], 128, 56, 3000, 10),
}


def clean(a):
    a = a.copy()
    rgb = a[..., :3].astype(int)
    red = (rgb[..., 0] > 150) & (rgb[..., 1] < 80) & (rgb[..., 2] < 80)
    # (only in the soft edge: a red leaf is red all through, and solid)
    a[..., 3] = np.where((red & (a[..., 3] < 245)) | (a[..., 3] < 90), 0, a[..., 3])
    return a


def pieces(a, name):
    bands, cw, ch, area, keep = PIECES[name]
    out = []
    for y0, y1 in bands:
        band = a[y0:y1]
        m = cv2.morphologyEx((band[..., 3] > 200).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        n, lab, st, _ = cv2.connectedComponentsWithStats(m)
        for i in sorted(range(1, n), key=lambda i: st[i][0]):
            x, y, w, h, ar = st[i]
            if ar < area:
                continue
            crop = band[y:y + h, x:x + w].copy()
            crop[..., 3] = np.where(lab[y:y + h, x:x + w] == i, crop[..., 3], 0)
            k = min(cw / w, ch / h)
            pm = crop.astype(np.float32)
            pm[..., :3] *= pm[..., 3:4] / 255
            pm = cv2.resize(pm, (max(1, round(w * k)), max(1, round(h * k))), interpolation=cv2.INTER_AREA)
            c = np.zeros((ch, cw, 4), np.float32)
            oy, ox = (ch - pm.shape[0]) // 2, (cw - pm.shape[1]) // 2
            c[oy:oy + pm.shape[0], ox:ox + pm.shape[1]] = pm
            al = c[..., 3:4]
            c[..., :3] = np.where(al > 0, c[..., :3] * 255 / np.maximum(al, 1e-3), 0)
            out.append(c.clip(0, 255).astype(np.uint8))
    return out[:keep], (cw, ch)


def main():
    a = clean(np.array(Image.open(SRC).convert('RGBA')))
    strips = [(name, *pieces(a, name)) for name in PIECES]
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
    print(json.dumps(table))


if __name__ == '__main__':
    main()
