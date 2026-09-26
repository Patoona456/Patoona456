#!/usr/bin/env python3
"""The chibi's eight-way walk, Ragnarok style, from the walk sheet.

    python3 tools/build-walk8.py

assets/chibi/source/walk8-sheet.png: the bald base walking, twelve frames a
facing - down, up, left and right in full rows, the four diagonals smaller,
two to a row - on a transparent ground, a number tag under each frame.

Each frame is cut out (the tags cleared first), a duplicate the sheet drew
twice dropped, and set on the game's 192x224 grid: every facing brought to
the old body's height, its head over the cell's middle, its bob kept (each
frame's feet stay where they were against the row's baseline). A thirteenth
column is the standing frame - the one with the feet closest together.

The spiky hair of the old eight-way board is set on every head, scaled to
the skull, in each colour; and the weapon fist is carried along with the
head from the standing pose of the old sheet.

Output:
  assets/chibi/body/base_male_walk8.png   13 cols x 8 rows (down, dl, left, ul, up, ur, right, dr)
  assets/chibi/hair/spiky_<colour>_walk8.png
  shared/data/chibi-walk8.js              the fist per facing and frame
"""
import importlib.util
import os

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
spec = importlib.util.spec_from_file_location('sb', os.path.join(ROOT, 'tools/slice-base.py'))
sb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sb)

SRC = os.path.join(ROOT, 'assets/chibi/source/walk8-sheet.png')
W, H, BASE = 192, 224, 217
FRAMES = 12
HEIGHT = 146                     # crown to heel, as the old body
# which sheet row (by the height of its middle) and half holds each facing, in game order
FACINGS = ['down', 'dl', 'left', 'ul', 'up', 'ur', 'right', 'dr']
# how the hair sits on each facing's skull (width share, offset of its top-centre)
FIT = {
    'down': (1.16, 0, -8), 'dl': (1.18, 2, -8), 'left': (1.20, 4, -8), 'ul': (1.16, 2, -8),
    'up': (1.13, 0, -8), 'ur': (1.16, -2, -8), 'right': (1.20, -4, -8), 'dr': (1.18, -2, -8),
}
# the old board's eight rows, in the same order
OLD_HAIR_ROW = {f: i for i, f in enumerate(FACINGS)}
# the old four-row sheet's row whose weapon fist a facing borrows
FIST_ROW = {'down': 0, 'dl': 1, 'left': 1, 'ul': 1, 'up': 2, 'ur': 3, 'right': 3, 'dr': 3}


def frames_of(a):
    """Every figure on the sheet, grouped by facing, in reading order."""
    rgb = a[..., :3].astype(int)
    # the number tags: dark pills with white digits; cleared with a margin
    dark = ((rgb.max(2) < 80) & (a[..., 3] > 150)).astype(np.uint8)
    dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, np.ones((5, 9), np.uint8))
    dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(dark)
    for i in range(1, n):
        x, y, w, h, _ = st[i]
        box = rgb[y:y + h, x:x + w]
        # a tag has the white of its number in it; grey shorts do not
        if 20 <= w <= 70 and 12 <= h <= 34 and (box.min(2) > 200).mean() > 0.03:
            a[y - 3:y + h + 3, x - 4:x + w + 4, 3] = 0
    a[:, :125, 3] = 0                                         # the facing labels
    m = (a[..., 3] > 60).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    figs = [st[i] for i in range(1, n) if st[i][4] > 900 and st[i][3] > 60 and st[i][2] < 140]
    # label boxes in the middle of the diagonal rows ("DR", "UR")
    figs = [f for f in figs if not (f[3] < 80 and f[2] > 90)]
    rows = {}
    for x, y, w, h, _ in figs:
        mid = y + h / 2
        key = min([96, 280, 460, 630, 790, 915], key=lambda c: abs(c - mid))
        rows.setdefault(key, []).append((x, y, w, h))
    groups = {}
    order = {96: 'down', 280: 'up', 460: 'left', 630: 'right'}
    for k, fs in rows.items():
        fs.sort(key=lambda f: f[0])
        if k in order:
            groups[order[k]] = fs
        else:
            left = [f for f in fs if f[0] < 770]
            right = [f for f in fs if f[0] >= 770]
            groups['dl' if k == 790 else 'ul'] = left
            groups['dr' if k == 790 else 'ur'] = right
    return groups


def crop(a, f):
    x, y, w, h = f
    c = a[y:y + h, x:x + w].copy()
    return c


def twelve(a, fs):
    """Drop the frames the sheet drew twice, most alike to the one before first."""
    fs = list(fs)
    while len(fs) > FRAMES:
        crops = [cv2.resize(crop(a, f), (48, 96), interpolation=cv2.INTER_AREA).astype(np.float32) for f in fs]
        d = [np.abs(crops[i] - crops[i - 1]).mean() for i in range(1, len(fs))]
        fs.pop(1 + int(np.argmin(d)))
    return fs


def main():
    a = np.array(Image.open(SRC).convert('RGBA'))
    groups = frames_of(a)
    body = np.zeros((H * 8, W * (FRAMES + 1), 4), np.uint8)
    heads = {}
    for r, face in enumerate(FACINGS):
        fs = twelve(a, groups[face])
        assert len(fs) == FRAMES, (face, len(fs))
        base = float(np.median([f[1] + f[3] for f in fs]))
        s = HEIGHT / float(np.median([f[3] for f in fs]))
        spread = []
        heads[face] = []
        for c, f in enumerate(fs):
            piece = crop(a, f)
            pw, ph = max(1, round(piece.shape[1] * s)), max(1, round(piece.shape[0] * s))
            piece = np.array(Image.fromarray(piece).resize((pw, ph), Image.LANCZOS))
            hd = sb.head_of(piece[..., 3])
            x0 = round(W / 2 - hd['cx'])
            y0 = round(BASE - (base - f[1]) * s)
            cell = body[r * H:(r + 1) * H, c * W:(c + 1) * W]
            sb.place(cell, piece, x0, y0)
            heads[face].append({'cx': W / 2, 'top': y0 + hd['top'], 'w': hd['w']})
            feet = piece[int(ph * 0.85):, :, 3] > 60
            xs = np.nonzero(feet.any(0))[0]
            spread.append(int(np.ptp(xs)) if len(xs) else 999)
        # standing: the frame with the feet closest together
        k = int(np.argmin(spread))
        body[r * H:(r + 1) * H, FRAMES * W:(FRAMES + 1) * W] = body[r * H:(r + 1) * H, k * W:(k + 1) * W]
        heads[face].append(heads[face][k])
    Image.fromarray(body).save(os.path.join(ROOT, 'assets/chibi/body/base_male_walk8.png'), optimize=True)

    # hair
    sb.HAIR_ROWS = list(range(8))
    pieces = sb.old_hair()
    for colour in sb.HAIR_COLOURS:
        sheet = np.zeros_like(body)
        for r, face in enumerate(FACINGS):
            wk, dx, dy = FIT[face]
            src = sb.recolour(pieces[OLD_HAIR_ROW[face]], sb.HAIR_COLOURS[colour])
            for c, hd in enumerate(heads[face]):
                w = round(hd['w'] * wk)
                sc = np.array(Image.fromarray(src).resize((w, round(src.shape[0] * w / src.shape[1])), Image.LANCZOS))
                cell = sheet[r * H:(r + 1) * H, c * W:(c + 1) * W]
                sb.place(cell, sc, round(hd['cx'] + dx - w / 2), hd['top'] + dy)
        Image.fromarray(sheet).save(os.path.join(ROOT, f'assets/chibi/hair/spiky_{colour}_walk8.png'), optimize=True)

    # the weapon fist, carried with the head from the old standing pose
    import re
    txt = open(os.path.join(ROOT, 'shared/data/chibi.js')).read()
    old_heads = re.findall(r"\{ x: (\d+), top: (\d+)", txt)
    old_fists = re.findall(r"\[(\d+), (\d+)\]", txt.split('CHIBI_FISTS')[1])
    per_row = len(old_heads) // 4
    rows_out = []
    for face in FACINGS:
        r = FIST_ROW[face]
        ox, otop = map(int, old_heads[r * per_row + 8])
        fx, fy = map(int, old_fists[r * per_row + 8])
        rows_out.append([[round(fx - ox + hd['cx']), round(fy - otop + hd['top'])] for hd in heads[face]])
    with open(os.path.join(ROOT, 'shared/data/chibi-walk8.js'), 'w') as fp:
        fp.write('// Generated by tools/build-walk8.py - do not edit by hand.\n')
        fp.write('// The weapon fist on the eight-way walk: per facing (down, dl, left, ul, up,\n')
        fp.write('// ur, right, dr), 12 steps and the standing frame, in the 192x224 cell.\n')
        fp.write('export const CHIBI_FISTS8 = [\n')
        for face, row in zip(FACINGS, rows_out):
            fp.write('  [' + ', '.join(f'[{x}, {y}]' for x, y in row) + f'],   // {face}\n')
        fp.write('];\n')
    print('walk8 built')


if __name__ == '__main__':
    main()
