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
    # key: (sheet, height, where the still part starts, as a share of the frame's height - or None)
    'blacksmith': ('assets/npc/source/blacksmith-sheet.png', 78, 'stump'),   # lined up on the anvil's stump
    'potion': ('assets/npc/source/potion-sheet.png', 80, None),
    'weapon': ('assets/npc/source/weapon-sheet.png', 82, None),
    'armor': ('assets/npc/source/armor-sheet.png', 82, None),
    'general': ('assets/npc/source/general-sheet.png', 86, None),
}
# sheets whose frame numbers are bare white digits: the y bands they sit in
NUMBERS = {'general': [(247, 270), (517, 540), (766, 792)]}
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
    # A sheet may number its frames with little tags under each one: pills
    # of one flat dark brown with a white number. That brown, solid through
    # a 9px square, is found nowhere else on a sheet (iron is grey, wood is
    # lighter and grained), so each pill is found even where it touches its
    # frame, and cleared with its number.
    rgb = a[..., :3].astype(int)
    R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    pill = ((R >= 22) & (R <= 70) & (G >= 8) & (G <= 42) & (B >= 4) & (B <= 34)
            & (R - B >= 12) & (np.abs(G - (R + B) / 2) < 12) & (a[..., 3] > 110)).astype(np.uint8)
    pill = cv2.morphologyEx(pill, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))       # across the number
    pill = cv2.morphologyEx(pill, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(pill)
    tags = [st[i][:4] for i in range(1, n) if 28 <= st[i][2] <= 70 and 16 <= st[i][3] <= 40 and st[i][4] > 0.6 * st[i][2] * st[i][3]]
    # a pill that runs into its frame's boots (the same brown) is not found
    # alone; the tags stand in a grid, so it is cleared where its row and
    # column say it is
    group = lambda v: [x for i, x in enumerate(v) if i == 0 or x - v[i - 1] > 12]
    if tags:
        tw, th = max(t[2] for t in tags), max(t[3] for t in tags)
        for ty in group(sorted(int(t[1]) for t in tags)):
            for tx in group(sorted(int(t[0]) for t in tags)):
                cell = pill[ty:ty + th, tx:tx + tw]
                if cell.size and cell.mean() > 0.5:
                    a[ty - 4:ty + th + 4, tx - 6:tx + tw + 6, 3] = 0
    # ...or with plain numbers: white, outlined in black, in a band under
    # each row (NUMBERS gives the bands' y ranges on the sheet). In a band,
    # the ink that sits under a frame's middle is the number.
    mn, mx_ = rgb.min(2), rgb.max(2)
    for y0_, y1_ in NUMBERS.get(key, ()):
        # the white fill of each digit pair, grown over its black outline
        white = ((mn > 200) & (a[..., 3] > 120)).astype(np.uint8)
        white[:y0_] = 0
        white[y1_:] = 0
        blob = cv2.dilate(white, np.ones((1, 9), np.uint8))      # the two digits of a number as one
        n2, lab2, st2, _ = cv2.connectedComponentsWithStats(blob)
        for i in range(1, n2):
            x, y, w, h, ar = st2[i]
            if 8 <= h <= 30 and w <= 50:
                a[y - 4:y + h + 4, x - 4:x + w + 4, 3] = 0
    m = a[..., 3] > 40
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8))
    boxes = [st[i] for i in range(1, n) if st[i][4] > 5000]
    # two frames drawn touching come out as one box twice as wide: cut it
    # at the thinnest column near its middle
    med = np.median([b_[2] for b_ in boxes])
    split = []
    for x, y, w, h, ar in boxes:
        if w > 1.6 * med:
            cols = m[y:y + h, x:x + w].sum(0)
            lo, hi = int(w * 0.35), int(w * 0.65)
            cut = lo + int(np.argmin(cols[lo:hi]))
            split += [(x, y, cut, h, ar), (x + cut, y, w - cut, h, ar)]
            # a scrap of one frame left on the other's side of the cut goes
            for sx, sw in ((x, cut), (x + cut, w - cut)):
                part = m[y:y + h, sx:sx + sw].astype(np.uint8)
                k2, l2, s2, _ = cv2.connectedComponentsWithStats(part)
                if k2 > 2:
                    big = 1 + int(np.argmax(s2[1:, 4]))
                    for j in range(1, k2):
                        if j != big and s2[j][4] > 40 and (s2[j][0] == 0 or s2[j][0] + s2[j][2] == sw):
                            a[y:y + h, sx:sx + sw, 3][l2 == j] = 0
            m = a[..., 3] > 40
        else:
            split.append((x, y, w, h, ar))
    boxes = split
    # read in rows: a frame belongs to the row its middle is in
    band = max(b[3] for b in boxes) * 0.8
    boxes.sort(key=lambda b: (round((b[1] + b[3] / 2) / band), b[0]))
    frames = []
    for x0, y0, w, h, _ in boxes:
        x1, y1 = x0 + w, y0 + h
        low = m[y1 - 12:y1, x0:x1]
        c = np.where(low.any(0))[0]
        frames.append((x0, y0, x1, y1, x0 + (c[0] + c[-1]) / 2))
    # Every frame is brought onto the first: the painter drew each row a
    # little bigger or smaller and a little to one side, and a set piece that
    # grows, shrinks or slides reads as jitter. Features on the lower part
    # (the anvil, the counter - what stands still) are matched frame to
    # frame, and a scale and shift fitted to them with the moving character
    # thrown out as outliers.
    clean = Image.fromarray(a)
    crops = [np.array(clean.crop((x0, y0, x1, y1))) for (x0, y0, x1, y1, _) in frames]
    ident = lambda dx=0.0, dy=0.0: np.float32([[1, 0, dx], [0, 1, dy]])
    if anchor == 'stump':
        # The set piece stands on a wooden stump or crate; the painter drew
        # it the same size in every frame but not in the same place. Its
        # wood (lower part, left of the character) is found by colour and
        # the frames are shifted so its middle and its foot line up.
        def stump(c):
            hsv = cv2.cvtColor(c[..., :3], cv2.COLOR_RGB2HSV).astype(int)
            wood = ((hsv[..., 0] * 2 >= 15) & (hsv[..., 0] * 2 <= 40) & (hsv[..., 1] > 90)
                    & (hsv[..., 2] > 60) & (c[..., 3] > 200)).astype(np.uint8)
            h, w = wood.shape
            y0 = int(h * 0.55)
            sub = cv2.morphologyEx(wood[y0:, :int(w * 0.62)], cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
            k_, _, s2, _ = cv2.connectedComponentsWithStats(sub)
            j = 1 + int(np.argmax(s2[1:, 4]))
            bx, by, bw, bh, _ = s2[j]
            return bx + bw / 2, y0 + by + bh
        pts_ = [stump(c) for c in crops]
        rx, ry = pts_[0]
        mats = [ident(rx - px, ry - py) for px, py in pts_]
    else:
        # stood on the middle of the foot, bottoms level
        f0 = frames[0]
        mats = [ident((f0[4] - f0[0]) - (f[4] - f[0]), (f0[3] - f0[1]) - (f[3] - f[1])) for f in frames]
    # one cell holding every frame, in the first frame's coordinates
    pts = []
    for c, M in zip(crops, mats):
        h, w = c.shape[:2]
        pts.append(cv2.transform(np.float32([[[0, 0], [w, 0], [0, h], [w, h]]]), M)[0])
    pts = np.concatenate(pts)
    ox, oy = np.floor(pts.min(0)) - 2
    cw, ch = int(np.ceil(pts[:, 0].max() - ox)) + 2, int(np.ceil(pts[:, 1].max() - oy)) + 2
    k = OUT_H / ch
    W, H = round(cw * k), OUT_H
    strip = Image.new('RGBA', (W * len(frames), H))
    for i, (c, M) in enumerate(zip(crops, mats)):
        S = np.float32([[k, 0, -ox * k], [0, k, -oy * k]])
        full = np.vstack([M, [0, 0, 1]])
        T = (np.vstack([S, [0, 0, 1]]) @ full)[:2]
        # premultiplied, so the clear edge does not drag dark into the art
        pm = c.astype(np.float32)
        pm[..., :3] *= pm[..., 3:4] / 255
        out = cv2.warpAffine(pm, T, (W, H), flags=cv2.INTER_AREA if k < 1 else cv2.INTER_LINEAR, borderValue=0)
        al = out[..., 3:4]
        out[..., :3] = np.where(al > 0, out[..., :3] * 255 / np.maximum(al, 1e-3), 0)
        strip.alpha_composite(Image.fromarray(out.clip(0, 255).astype(np.uint8)), (i * W, 0))
    strip.save(os.path.join(ROOT, f'assets/npc/{key}.webp'), 'WEBP', quality=90, method=6)
    print(f"  {key}: {{ cell: [{W}, {H}], frames: {len(frames)}, height: {height} }},")


if __name__ == '__main__':
    main(sys.argv[1])
