#!/usr/bin/env python3
"""Cut a glowing effect sheet (a warp circle, a burst of sparks) into a strip.

    python3 tools/slice-glow.py town

The sheets are light painted over a soft halo, a frame over a numbered tag
(a dark navy pill with a white number). The tags are found first; each one
says where its frame is (the frame stands on the tag, centred over it), so
every frame is cut from the same place relative to its tag and the circle
never slides. Then the light is kept and the ground dropped: the colour is
multiplied by its own coverage and the noisy cyan fringe the painter's
matte left is filtered out, and the strip is stored on black - the game
adds it to the ground ('lighter'), so black is nothing and the light is
light. Writes assets/warp/<key>.webp and prints its entry for renderer.js.
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SHEETS = {
    # key: (sheet, frame width and height above the tag, on the sheet)
    'town': ('assets/warp/source/town-sheet.png', 270, 226),
    'town_spark': ('assets/warp/source/town-spark-sheet.png', 270, 222),
}
OUT_H = 160


def main(key):
    src, cw, ch = SHEETS[key]
    a = np.array(Image.open(os.path.join(ROOT, src)).convert('RGBA'))
    rgb = a[..., :3].astype(np.float32)
    al = a[..., 3].astype(np.float32) / 255
    # the tags
    dark = ((a[..., :3].max(2) < 90) & (a[..., 3] > 150)).astype(np.uint8)
    dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, np.ones((5, 11), np.uint8))   # across the number
    dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(dark)
    tags = [st[i][:4] for i in range(1, n) if st[i][4] > 200 and 30 < st[i][2] < 110 and 15 < st[i][3] < 45]
    band = np.median([t[3] for t in tags]) * 3
    tags.sort(key=lambda t: (round(t[1] / band), t[0]))
    # light only. The painter backed every frame with a flat pale-blue
    # halo; added to the street it would be a white blob. What matters is
    # what is brighter than the halo round it - the rings, the streaks, the
    # stars - so the halo (the picture blurred wide) is taken off, and a
    # little of it put back as a soft glow.
    base = rgb * al[..., None]
    base = cv2.medianBlur(base.clip(0, 255).astype(np.uint8), 3).astype(np.float32)   # the matte's speckle
    halo = cv2.GaussianBlur(base, (0, 0), 14)
    light = np.clip(base - 0.9 * halo, 0, 255) * 1.6 + halo * 0.18
    for x, y, w, h in tags:                                   # the tags themselves go
        light[y - 4:y + h + 6, x - 6:x + w + 6] = 0
    k = OUT_H / ch
    W = round(cw * k)
    strip = np.zeros((OUT_H, W * len(tags), 3), np.float32)
    for i, (x, y, w, h) in enumerate(tags):
        cx = x + w / 2
        x0, y0 = int(round(cx - cw / 2)), int(y - ch)
        cell = np.zeros((ch, cw, 3), np.float32)
        sx0, sy0 = max(0, x0), max(0, y0)
        sx1, sy1 = min(a.shape[1], x0 + cw), min(a.shape[0], y0 + ch)
        cell[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = light[sy0:sy1, sx0:sx1]
        # what belongs to the next row's frame (above) or a neighbour is faded at the edges
        fade_x = np.clip(np.minimum(np.arange(cw), cw - 1 - np.arange(cw)) / 18, 0, 1)
        fade_y = np.clip(np.arange(ch) / 14, 0, 1)
        cell *= (fade_y[:, None] * fade_x[None, :])[..., None]
        strip[:, i * W:(i + 1) * W] = cv2.resize(cell, (W, OUT_H), interpolation=cv2.INTER_AREA)
    Image.fromarray(strip.clip(0, 255).astype(np.uint8)).save(
        os.path.join(ROOT, f'assets/warp/{key}.webp'), 'WEBP', quality=90, method=6)
    print(f"  {key}: {{ frames: {len(tags)}, cell: [{W}, {OUT_H}] }},")


if __name__ == '__main__':
    main(sys.argv[1])
