#!/usr/bin/env python3
"""Cut a painted NPC animation sheet into one strip of equal frames.

    python3 tools/slice-npc.py blacksmith

A sheet is rows of frames on a transparent ground, read left to right, top
to bottom. Each frame is found by where the ground is empty around it, and
stood on its foot: the middle of what touches the bottom (the stool, the
anvil's stump) lines up in every frame, so the set piece stays put and only
the character moves. Where a sheet names its `anchor` (a box on one frame
round the set piece) that is found in every frame instead, by matching. Writes assets/npc/<key>.webp and prints the entry for
shared/data/npcart.js.
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SHEETS = {
    # key: (sheet, height, anchor = (frame, x0, y0, x1, y1) within that frame)
    'blacksmith': ('assets/npc/source/blacksmith-sheet.png', 78, (0, 5, 130, 105, 220)),   # the anvil's stump
}
OUT_H = 192                              # stored frame height, px


def runs(v, min_len=20):
    out, s = [], None
    for i, c in enumerate(v):
        if c and s is None:
            s = i
        if not c and s is not None:
            if i - s >= min_len:
                out.append((s, i))
            s = None
    if s is not None and len(v) - s >= min_len:
        out.append((s, len(v)))
    return out


def main(key):
    src, height, anchor = SHEETS[key]
    sheet = Image.open(os.path.join(ROOT, src)).convert('RGBA')
    a = np.array(sheet)
    # the painter's red matte bleeds into the half-clear edge pixels: take
    # them down to nothing so no red rim shows on the street
    alpha = a[..., 3]
    soft = alpha < 150
    a[..., 3] = np.where(soft, (alpha * np.clip((alpha - 60) / 90, 0, 1)).astype(np.uint8), alpha)
    m = a[..., 3] > 40
    import cv2
    # A sheet may number its frames with little tags under each one. They
    # sit on a grid: the tags that stand alone give its rows and columns,
    # and every cell of that grid is cleared, the ones touching a frame too.
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8))
    tags = [st[i] for i in range(1, n) if st[i][3] < 40 and st[i][2] < 70 and st[i][4] > 300]
    if tags:
        cols = sorted({int(t[0]) for t in tags})
        rows = sorted({int(t[1]) for t in tags})
        tw, th = max(int(t[2]) for t in tags), max(int(t[3]) for t in tags)
        merge = lambda v: [x for i, x in enumerate(v) if i == 0 or x - v[i - 1] > 8]
        for ty in merge(rows):
            for tx in merge(cols):
                a[ty - 2:ty + th + 3, tx - 3:tx + tw + 4, 3] = 0
        m = a[..., 3] > 40
        n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8))
    boxes = [st[i] for i in range(1, n) if st[i][4] > 5000]
    # read in rows: a frame belongs to the row its middle is in
    band = max(b[3] for b in boxes) * 0.8
    boxes.sort(key=lambda b: (round((b[1] + b[3] / 2) / band), b[0]))
    frames = []
    for x0, y0, w, h, _ in boxes:
        x1, y1 = x0 + w, y0 + h
        low = m[y1 - 12:y1, x0:x1]
        c = np.where(low.any(0))[0]
        frames.append((x0, y0, x1, y1, x0 + (c[0] + c[-1]) / 2))
    if anchor:
        gray = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2GRAY).astype(np.float32) * (a[..., 3] > 40)
        fi, ax0, ay0, ax1, ay1 = anchor
        rx, ry = frames[fi][0], frames[fi][1]
        tpl = gray[ry + ay0:ry + ay1, rx + ax0:rx + ax1]
        ref = rx + (ax0 + ax1) / 2
        moved = []
        for (x0, y0, x1, y1, _) in frames:
            win = gray[max(0, y0 - 10):y1 + 10, max(0, x0 - 40):x1 + 40]
            r = cv2.matchTemplate(win, tpl, cv2.TM_CCOEFF_NORMED)
            _, _, _, (mx, my) = cv2.minMaxLoc(r)
            cx = max(0, x0 - 40) + mx + (ax1 - ax0) / 2
            # the stump's middle stands where the reference frame's does
            moved.append((x0, y0, x1, y1, cx))
        frames = moved
    # one cell for all: widest reach either side of the foot, tallest frame
    left = max(f[4] - f[0] for f in frames)
    right = max(f[2] - f[4] for f in frames)
    tall = max(f[3] - f[1] for f in frames)
    cw, ch = int(np.ceil(left + right)) + 4, int(tall) + 2
    k = OUT_H / ch
    W, H = round(cw * k), OUT_H
    strip = Image.new('RGBA', (W * len(frames), H))
    clean = Image.fromarray(a)
    for i, (x0, y0, x1, y1, foot) in enumerate(frames):
        cell = Image.new('RGBA', (cw, ch))
        cell.alpha_composite(clean.crop((x0, y0, x1, y1)), (int(round(left + 2 - (foot - x0))), ch - (y1 - y0)))
        strip.alpha_composite(cell.resize((W, H), Image.LANCZOS), (i * W, 0))
    strip.save(os.path.join(ROOT, f'assets/npc/{key}.webp'), 'WEBP', quality=90, method=6)
    print(f"  {key}: {{ cell: [{W}, {H}], frames: {len(frames)}, height: {height} }},")


if __name__ == '__main__':
    main(sys.argv[1])
