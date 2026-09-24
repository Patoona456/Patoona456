#!/usr/bin/env python3
"""
Cut the bald chibi base (assets/chibi/source/base_male.png) onto the game's grid,
and fit a hair layer to it.

    python3 tools/slice-base.py

The board is 4 rows (down, left, up, right) of 8 walk frames on a painted
background. Each frame is lifted with GrabCut, then pasted into a 128x192 cell
with its feet on one baseline and its head over the cell's centre, so the
walk bobs the way the artist drew it but does not drift sideways by however
much the board's spacing wandered. The cycle is turned so that frame 0 is the
most closed stride of each row: that frame doubles as the standing pose.

Hair: the old walk board (source/hero_brown_grid.png, as cut by
tools/slice-chibi.py) had its hair painted on. That
hair is lifted off it once per facing, scaled to the new skull and set on the
head of every frame, then recoloured, so hair is a layer that can be changed
(or left off) rather than part of the body. Hats and hoods get the same
treatment from the head anchors this writes to shared/data/chibi.js.

Output:
  assets/chibi/body/base_male.png        8 cols x 4 rows of 128x192
  assets/chibi/hair/spiky_<colour>.png   same grid
  shared/data/chibi.js                   head and fist positions per frame
Needs OpenCV, NumPy and Pillow.
"""
import json, os
import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets/chibi/source/base_male.png')
CELL_W, CELL_H, BASELINE = 128, 192, 184
# where each frame sits on the board, read off its number labels
XS = [190, 330, 470, 615, 755, 895, 1040, 1180]
ROWS = [(128, 278), (292, 448), (462, 620), (634, 795)]   # down, left, up, right
HALF_W = 72


def lift(im, cx, y0, y1):
    x0, x1 = cx - HALF_W, cx + HALF_W
    pad = 8
    sub = im[y0 - pad:y1 + pad, x0 - pad:x1 + pad].copy()
    mask = np.zeros(sub.shape[:2], np.uint8)
    bg, fg = np.zeros((1, 65)), np.zeros((1, 65))
    cv2.grabCut(sub, mask, (pad, pad, x1 - x0, y1 - y0), bg, fg, 8, cv2.GC_INIT_WITH_RECT)
    m = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    m = np.where(lab == 1 + np.argmax(st[1:, 4]), 255, 0).astype(np.uint8)
    ff = m.copy()
    cv2.floodFill(ff, np.zeros((m.shape[0] + 2, m.shape[1] + 2), np.uint8), (0, 0), 255)
    m = m | cv2.bitwise_not(ff)
    # a soft rim a pixel wide, so it does not shimmer when shrunk
    m = cv2.GaussianBlur(m, (3, 3), 0)
    rgba = cv2.cvtColor(sub, cv2.COLOR_BGR2RGBA)
    rgba[:, :, 3] = m
    return rgba


def head_of(a):
    """The skull: the rows above the neck. Returns centre x, top y, width, and the neck row."""
    solid = a > 128
    ys = np.nonzero(solid.any(1))[0]
    top, bot = ys[0], ys[-1]
    widths = [(np.ptp(solid[y].nonzero()[0]) + 1) if solid[y].any() else 0 for y in range(a.shape[0])]
    # the neck is the narrowest row between a third and two thirds of the way down the head+body
    lo, hi = top + int((bot - top) * 0.30), top + int((bot - top) * 0.62)
    neck = lo + int(np.argmin(widths[lo:hi]))
    head = solid[top:neck]
    xs = np.nonzero(head.any(0))[0]
    return {'cx': (xs[0] + xs[-1]) / 2, 'top': int(top), 'w': int(xs[-1] - xs[0] + 1), 'neck': int(neck), 'bot': int(bot)}


def stride(a):
    """How far apart the feet are: the width of the bottom eighth of the figure."""
    solid = a > 128
    ys = np.nonzero(solid.any(1))[0]
    band = solid[ys[-1] - (ys[-1] - ys[0]) // 8:ys[-1] + 1]
    xs = np.nonzero(band.any(0))[0]
    return xs[-1] - xs[0]


def main():
    im = cv2.imread(SRC)
    frames = [[lift(im, cx, y0, y1) for cx in XS] for (y0, y1) in ROWS]
    sheet = np.zeros((CELL_H * 4, CELL_W * 8, 4), np.uint8)
    heads = []
    for r, row in enumerate(frames):
        k = int(np.argmin([stride(f[:, :, 3]) for f in row]))
        row = row[k:] + row[:k]
        hs = []
        for c, f in enumerate(row):
            h = head_of(f[:, :, 3])
            dx = int(round(CELL_W / 2 - h['cx']))
            dy = BASELINE - h['bot']
            H, W = f.shape[:2]
            cell = np.zeros((CELL_H, CELL_W, 4), np.uint8)
            sx0, sy0 = max(0, -dx), max(0, -dy)
            tx0, ty0 = max(0, dx), max(0, dy)
            w = min(W - sx0, CELL_W - tx0)
            hgt = min(H - sy0, CELL_H - ty0)
            cell[ty0:ty0 + hgt, tx0:tx0 + w] = f[sy0:sy0 + hgt, sx0:sx0 + w]
            sheet[r * CELL_H:(r + 1) * CELL_H, c * CELL_W:(c + 1) * CELL_W] = cell
            hs.append({'cx': h['cx'] + dx, 'top': h['top'] + dy, 'w': h['w'], 'neck': h['neck'] + dy})
        heads.append(hs)
    return sheet, heads


HAIR_ROWS = [0, 2, 4, 6]      # down, left, up, right on the old DIR8 sheet
# how each facing's hair sits on the new skull: width as a share of the
# head's, and the offset of its top-centre from the head's top-centre
HAIR_FIT = [
    {'w': 1.16, 'dx': 0, 'dy': -8},     # down
    {'w': 1.20, 'dx': 4, 'dy': -8},     # left
    {'w': 1.13, 'dx': 0, 'dy': -8},     # up
    {'w': 1.20, 'dx': -4, 'dy': -8},    # right
]
HAIR_COLOURS = {
    # target colour of the hair's mid tone, as RGB
    'brown': None,
    'black': (58, 50, 58),
    'blonde': (226, 184, 104),
    'white': (222, 222, 230),
}


def old_hair():
    """The hair painted on the old board, one picture per facing, trimmed."""
    body = cv2.imread(os.path.join(ROOT, 'assets/chibi/source/hero_brown_grid.png'), cv2.IMREAD_UNCHANGED)
    out = []
    for r in HAIR_ROWS:
        f = body[r * 192:(r + 1) * 192, 0:128].copy()
        a = f[:, :, 3]
        b, g, rr = [f[:, :, i].astype(int) for i in range(3)]
        lum = (rr * 3 + g * 6 + b) / 10
        skin = (lum > 150) & (rr - b > 45) & (rr > 215)
        hairish = ((a > 60) & (rr - b > 18) & ~skin & (lum < 200)).astype(np.uint8) * 255
        hairish[104 if r == 4 else 100:] = 0          # the neck and chin below it
        op = cv2.morphologyEx(hairish, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        n, lab, st, _ = cv2.connectedComponentsWithStats(op)
        m = np.where(lab == 1 + np.argmax(st[1:, 4]), 255, 0).astype(np.uint8)
        # grow back the strands and the outline the opening shaved off
        for _ in range(3):
            m = cv2.dilate(m, np.ones((3, 3), np.uint8)) & hairish
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
        f[:, :, 3] = np.minimum(a, m)
        ys, xs = np.nonzero(f[:, :, 3] > 8)
        out.append(cv2.cvtColor(f[ys.min():ys.max() + 1, xs.min():xs.max() + 1], cv2.COLOR_BGRA2RGBA))
    return out


def recolour(rgba, target):
    """Move the hair's hue and brightness to another colour, keeping its shading."""
    if target is None:
        return rgba
    out = rgba.copy()
    rgb = rgba[:, :, :3].astype(np.float32)
    lum = rgb @ np.array([0.3, 0.59, 0.11], np.float32)
    solid = rgba[:, :, 3] > 128
    mid = float(np.median(lum[solid]))
    t = np.array(target, np.float32)
    tl = float(t @ np.array([0.3, 0.59, 0.11], np.float32))
    # shade relative to the mid tone, applied to the target colour
    k = (lum / max(mid, 1))[..., None]
    # shadows go deeper than a straight scale, so pale hair keeps its outline
    col = np.where(k <= 1, t * np.power(k, 1.5 if tl > 150 else 1.0), t + (255 - t) * np.clip((k - 1) * mid / max(255 - mid, 1), 0, 1) * (1 if tl < 200 else 0.4))
    out[:, :, :3] = np.clip(col, 0, 255).astype(np.uint8)
    return out


def place(dst, piece, x0, y0):
    """Alpha-over a piece into a cell at an integer offset, clipped to the cell."""
    H, W = piece.shape[:2]
    sx0, sy0 = max(0, -x0), max(0, -y0)
    tx0, ty0 = max(0, x0), max(0, y0)
    w = min(W - sx0, dst.shape[1] - tx0)
    h = min(H - sy0, dst.shape[0] - ty0)
    if w <= 0 or h <= 0:
        return
    src = piece[sy0:sy0 + h, sx0:sx0 + w].astype(np.float32)
    d = dst[ty0:ty0 + h, tx0:tx0 + w].astype(np.float32)
    a = src[:, :, 3:4] / 255
    d[:, :, :3] = src[:, :, :3] * a + d[:, :, :3] * (1 - a)
    d[:, :, 3:4] = src[:, :, 3:4] + d[:, :, 3:4] * (1 - a)
    dst[ty0:ty0 + h, tx0:tx0 + w] = d.astype(np.uint8)


def hair_sheet(heads, pieces, colour):
    sheet = np.zeros((CELL_H * 4, CELL_W * 8, 4), np.uint8)
    for r, row in enumerate(heads):
        fit = HAIR_FIT[r]
        base = recolour(pieces[r], HAIR_COLOURS[colour])
        w = round(row[0]['w'] * fit['w'])
        scaled = np.array(Image.fromarray(base).resize((w, round(base.shape[0] * w / base.shape[1])), Image.LANCZOS))
        for c, h in enumerate(row):
            cell = sheet[r * CELL_H:(r + 1) * CELL_H, c * CELL_W:(c + 1) * CELL_W]
            place(cell, scaled, round(h['cx'] + fit['dx'] - w / 2), h['top'] + fit['dy'])
    return sheet


# the weapon fist on frame 0 of each row, found by eye; the rest are tracked
FIST_SEED = [(87, 148), (84, 145), (87, 144), (43, 142)]


def track_fists(sheet, r_patch=7, reach=(16, 10)):
    """Follow the fist through the walk: the best match for frame 0's fist in
    each later frame, searched near where it was in the frame before."""
    img = sheet.astype(np.float32)
    out = []
    for r, (x, y) in enumerate(FIST_SEED):
        oy = r * CELL_H
        ref = img[oy + y - r_patch:oy + y + r_patch + 1, x - r_patch:x + r_patch + 1]
        row, px, py = [], x, y
        for c in range(8):
            ox = c * CELL_W
            best = None
            for dy in range(-reach[1], reach[1] + 1):
                for dx in range(-reach[0], reach[0] + 1):
                    X, Y = ox + px + dx, oy + py + dy
                    patch = img[Y - r_patch:Y + r_patch + 1, X - r_patch:X + r_patch + 1]
                    if patch.shape != ref.shape:
                        continue
                    d = float(((patch - ref) ** 2).sum())
                    if best is None or d < best[0]:
                        best = (d, px + dx, py + dy)
            _, px, py = best if c else (0, x, y)
            row.append([int(px), int(py)])
        out.append(row)
    return out


def write_table(heads, fists):
    rows = ['down', 'left', 'up', 'right']
    with open(os.path.join(ROOT, 'shared/data/chibi.js'), 'w') as fp:
        fp.write('// Generated by tools/slice-base.py from assets/chibi/source/base_male.png.\n')
        fp.write('// Per row (down, left, up, right) and walk frame, in pixels of the 128x192 cell.\n\n')
        fp.write('/** The skull: centre x, top of the head, width, and the neck row. Hats and hair sit on this. */\n')
        fp.write('export const CHIBI_HEADS = [\n')
        for name, row in zip(rows, heads):
            cells = ', '.join(f"{{ x: {round(h['cx'])}, top: {h['top']}, w: {h['w']}, neck: {h['neck']} }}" for h in row)
            fp.write(f'  [{cells}], // {name}\n')
        fp.write('];\n\n/** The weapon fist\'s centre. */\nexport const CHIBI_FISTS = [\n')
        for name, row in zip(rows, fists):
            fp.write(f"  {json.dumps(row)}, // {name}\n")
        fp.write('];\n')


if __name__ == '__main__':
    import sys
    sheet, heads = main()
    pieces = old_hair()
    os.makedirs(os.path.join(ROOT, 'assets/chibi/hair'), exist_ok=True)
    Image.fromarray(sheet).save(os.path.join(ROOT, 'assets/chibi/body/base_male.png'), optimize=True)
    for colour in HAIR_COLOURS:
        Image.fromarray(hair_sheet(heads, pieces, colour)).save(os.path.join(ROOT, f'assets/chibi/hair/spiky_{colour}.png'), optimize=True)
    fists = track_fists(sheet)
    write_table(heads, fists)
    print('wrote base_male, hair x', len(HAIR_COLOURS), 'and shared/data/chibi.js')
    for row in fists: print(row)
