#!/usr/bin/env python3
"""Cut a painted NPC sheet whose frames glow (spell light, a magic circle
round the feet) into one strip of equal frames.

    python3 tools/slice-npc-fx.py jobmaster

tools/slice-npc.py finds frames by the clear ground between them; here the
light runs from one frame into the next, so the frames are found by what is
solid (the figure is fully opaque, the light is not), read in rows. The
painter did not draw the figure in the same place in every frame, and the
light with it slides about, so every frame is brought onto the first by
matching the lower half of the figure (the robe and feet, which hold still)
- the figure stays put and its light with it. Each frame is cut from a fixed
window round the figure's foot, its sides faded where the next frame's light
reaches in. The painter's red matte is dropped from the soft edges.

Writes assets/npc/<key>.webp and prints its entry for shared/data/npcart.js.
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SHEETS = {
    # key: (sheet, frames, window w, h round the foot, how far below the foot
    # the window runs, and each row's size against the first - the painter
    # drew the rows at different sizes; read off by laying each row's first
    # frame over the first one's face and hair)
    'jobmaster': ('assets/npc/source/jobmaster-sheet.png', 60, 160, 175, 22, [1.0, 0.97, 0.95, 0.97, 0.88, 0.79]),
}
OUT_H = 192
FADE = 14                       # px of the window's sides faded out


def main(key):
    src, count, cw, ch, below, row_scale = SHEETS[key]
    a = np.array(Image.open(os.path.join(ROOT, src)).convert('RGBA'))
    rgb = a[..., :3].astype(int)
    # the painter's red matte, left in soft edges: gone (the gold light is
    # red too, but with its green well up)
    red = (rgb[..., 0] > 110) & (rgb[..., 1] < 95) & (rgb[..., 2] < 95) & (a[..., 3] < 235)
    a[..., 3] = np.where(red, 0, a[..., 3])
    # the figures: what is fully opaque
    solid = cv2.morphologyEx((a[..., 3] >= 250).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(solid)
    figs = [st[i] for i in range(1, n) if st[i][4] > 1500]
    assert len(figs) == count, (key, len(figs))
    band = np.median([f[3] for f in figs]) * 0.8
    figs.sort(key=lambda f: (round((f[1] + f[3] / 2) / band), f[0]))
    # each frame's foot: the middle of the figure's bottom rows
    feet = []
    for x, y, w, h, _ in figs:
        m = lab[y:y + h, x:x + w] > 0
        low = np.nonzero(m[h - 10:].any(0))[0]
        feet.append(np.array([x + (low[0] + low[-1]) / 2, y + h], np.float32))
    # Line every frame up on the first by its lower half (the robe and the
    # boots), at its row's size
    # (the outline of what is solid: the light over the robe brightens it but
    # never makes it any less solid)
    dark = cv2.GaussianBlur((a[..., 3] >= 250).astype(np.float32), (0, 0), 1.5)
    f0 = feet[0]
    tw, th = 90, 75
    tpl = dark[int(f0[1]) - th + 6:int(f0[1]) + 6, int(f0[0]) - tw // 2:int(f0[0]) + tw // 2]
    fits = [(1.0, f0)]
    R = 26
    per_row = count // len(row_scale)
    for i, p in enumerate(feet[1:], 1):
        best = None
        for sc in (row_scale[i // per_row],):
            x0, y0 = int(p[0] - (tw / 2 + R) * sc), int(p[1] - (th + R) * sc)
            x1, y1 = int(p[0] + (tw / 2 + R) * sc), int(p[1] + (R + 6) * sc)
            win = dark[max(0, y0):y1, max(0, x0):x1]
            win = cv2.resize(win, (max(tw + 1, round(win.shape[1] / sc)), max(th + 1, round(win.shape[0] / sc))), interpolation=cv2.INTER_AREA)
            res = cv2.matchTemplate(win, tpl, cv2.TM_CCOEFF_NORMED)
            _, v, _, (mx, my) = cv2.minMaxLoc(res)
            if best is None or v > best[0]:
                # frame 0's foot, found in this frame
                fx = max(0, x0) + (mx + tw / 2) * sc
                fy = max(0, y0) + (my + th - 6) * sc
                best = (v, sc, np.float32([fx, fy]))
        fits.append((best[1], best[2]))
    k = OUT_H / ch
    W = round(cw * k)
    strip = Image.new('RGBA', (W * count, OUT_H))
    fade = np.clip(np.minimum(np.arange(W), W - 1 - np.arange(W)) / (FADE * k), 0, 1).astype(np.float32)
    # (and the top, where tall light is cut by the window)
    fade_top = np.clip(np.arange(OUT_H) / (FADE * k), 0, 1).astype(np.float32)
    pm_all = a.astype(np.float32)
    pm_all[..., :3] *= pm_all[..., 3:4] / 255
    # what lies above a row's band (the feet and circle of the row above) is
    # the row above's, and is left out of this row's frames
    rows_y = [max(float(f[1]) for f in feet[r * per_row:(r + 1) * per_row]) for r in range(len(row_scale))]
    for i, (sc, F) in enumerate(fits):
        r = i // per_row
        pm = pm_all
        if r:
            pm = pm_all.copy()
            pm[:int(rows_y[r - 1]) + 20] = 0
        # this frame's foot to the window's foot, at frame 0's size
        g = k / sc
        M = np.float32([[g, 0, k * cw / 2 - g * F[0]], [0, g, k * (ch - below) - g * F[1]]])
        out = cv2.warpAffine(pm, M, (W, OUT_H), flags=cv2.INTER_AREA if g < 1 else cv2.INTER_CUBIC, borderValue=0)
        out = np.clip(out, 0, 255)
        out *= fade[None, :, None] * fade_top[:, None, None]
        al = out[..., 3:4]
        out[..., :3] = np.where(al > 0, out[..., :3] * 255 / np.maximum(al, 1e-3), 0)
        strip.alpha_composite(Image.fromarray(out.clip(0, 255).astype(np.uint8)), (i * W, 0))
    strip.save(os.path.join(ROOT, f'assets/npc/{key}.webp'), 'WEBP', quality=90, method=6)
    print(f"  {key}: {{ cell: [{W}, {OUT_H}], frames: {count} }},")
    print('  scales', [round(float(f[0]), 2) for f in fits])


if __name__ == '__main__':
    main(sys.argv[1])
