#!/usr/bin/env python3
"""
Cut a board of helmets, drawn on heads four ways round, into pieces a chibi
wears on its own head in every frame.

    python3 tools/slice-helmets.py            # writes the atlas and the table
    python3 tools/slice-helmets.py preview    # and a sheet of them worn, to check by eye

The board (assets/chibi/source/gear/swordsman_helmet.png) has one block per
tier - Front, Left, Back, Right over name plates - on a painted grey checker.
Each piece is found as what is not checker (the plates and tier labels are
blanked first), lifted off by filling the checker in from its edges, and has
the head it was painted on taken out: the face and the neck (skin, and what
the skin closes round - eyes, brows, the chin line), so the wearer's own face
shows under the brim and through the visor. The hair under the helmet stays:
it is part of how a helmet sits, and the wearer's own spiky hair would stick
through the metal.

The pieces go into one square-celled atlas, assets/ui/helmets.webp - four
across (the game's rows: down, left, up, right), one row per tier - which is
also the item icons (a tier's Front). shared/data/headgear.js says where each
sits on the head: the renderer sets it on the skull of whatever frame the
body is showing (shared/data/chibi.js), scaled with the skull, so a helmet
follows the walk's bob and the sword swing without a sheet of its own.

With the sword raised over the head (the swing's fourth frame), the arms pass
in front of the helmet: those arms are cut off the body into the atlas too,
and drawn back over it.
"""
import importlib.util
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets/chibi/source/gear/swordsman_helmet.png')
TIERS = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 100, 110, 120]
CELL = 144          # atlas cell, in pixels of the chibi's 192x224 frame
# sheet pixels -> frame pixels, on the standing skull's width
K = 1.3
# per facing (the board's Front, Left, Back, Right = the game's down, left,
# up, right): where the piece's anchor - the middle of its lower part, at its
# bottom (the neck, cut by the name plate) - lands against the standing
# skull's centre and neck row. Worn, it follows the skull's centre and top:
# the neck row and width measured on a swing frame take in the arms, so a
# helmet keeps one size, as the hair does.
FIT = [
    {'dx': 0, 'dy': 10},
    {'dx': 0, 'dy': 10},
    {'dx': 0, 'dy': 10},
    {'dx': 0, 'dy': 10},
]
# the swing's frame with the arms up over the head, by row (see slice-base.py)
RAISED_COL = 22


def hsv_of(bgr):
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(int)


def find_pieces(im):
    """Every piece's box, tier by tier, Front-Left-Back-Right."""
    h, s, v = np.moveaxis(hsv_of(im), 2, 0)
    checker = (s < 22) & (v > 195)
    # the name plates and tier labels: navy or black bars
    plate = (((h > 100) & (h < 130) & (s > 50) & (v < 120)) | ((v < 80) & (s < 90))).astype(np.uint8)
    fg = (~checker).astype(np.uint8)
    n, _, st, _ = cv2.connectedComponentsWithStats(plate)
    for x, y, w, hh, a in st[1:]:
        if a > 150 and w > 40 and hh < 45 and w > 1.6 * hh:
            fg[y - 4:y + hh + 4, x - 6:x + w + 6] = 0
    fg[:95, :430] = 0                   # the board's title
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, _, st, _ = cv2.connectedComponentsWithStats(fg)
    boxes = [list(st[i][:4]) for i in range(1, n) if st[i][4] > 1200]
    boxes.sort(key=lambda b: (b[1] + b[3] // 2) // 150 * 10000 + b[0])
    assert len(boxes) == len(TIERS) * 4, len(boxes)
    return boxes


def lift(im, box, pad=4):
    """The piece on its own: RGBA, the checker round it gone."""
    x, y, w, h = box
    c = im[y - pad:y + h + pad, x - pad:x + w + pad].copy()
    hs = hsv_of(c)
    bg = ((hs[..., 1] < 26) & (hs[..., 2] > 185)).astype(np.uint8)
    _, lab = cv2.connectedComponents(bg)
    edge = (set(lab[0]) | set(lab[-1]) | set(lab[:, 0]) | set(lab[:, -1])) - {0}
    alpha = np.where(np.isin(lab, list(edge)), 0, 255).astype(np.uint8)
    return c, alpha, hs


def fill_holes(m):
    f = m.copy()
    cv2.floodFill(f, np.zeros((m.shape[0] + 2, m.shape[1] + 2), np.uint8), (0, 0), 1)
    return m | (1 - f)


def unhead(c, alpha, hs):
    """Take the head the helmet was drawn on out of it: skin, and what the
    skin closes round that is not metal, plume or gilding."""
    H, S, V = hs[..., 0], hs[..., 1], hs[..., 2]
    solid = alpha > 0
    skin = (H >= 3) & (H <= 20) & (S >= 25) & (S <= 120) & (V >= 190) & solid
    # the face and neck are low down and sizeable; a shine on a leather cap
    # is the same colour, but small and up top
    n, lab, st, _ = cv2.connectedComponentsWithStats(skin.astype(np.uint8))
    skin = np.isin(lab, [i for i in range(1, n) if st[i][4] >= 25 and st[i][1] + st[i][3] > skin.shape[0] * 0.45])
    steel = (S < 70) & (V >= 60) & (V < 235)
    gold = (H >= 12) & (H <= 35) & (S > 100) & (V > 175)
    red = ((H < 8) | (H > 165)) & (S > 120)
    metal = steel | gold | red
    face = cv2.dilate(skin.astype(np.uint8), np.ones((5, 5), np.uint8))
    face = np.pad(face, 1)
    face = fill_holes(face)[1:-1, 1:-1] > 0
    out = solid & ~(skin | (face & ~metal))
    # the name plate's gilt rule, where the neck met it: a flat line along
    # the bottom, thinner than anything on a helmet
    m = out.astype(np.uint8)
    flat = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((1, 9), np.uint8))
    thick = cv2.dilate(cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)), np.ones((3, 3), np.uint8))
    rule = (flat > 0) & (thick == 0)
    rule[:-12] = False
    out &= ~rule
    # what is left hanging off on its own (a bit of plate edge, a stray
    # outline) goes too; the helmet is one piece, maybe with its plume apart
    n, lab, st, _ = cv2.connectedComponentsWithStats(out.astype(np.uint8))
    if n > 1:
        big = st[1:, 4].max()
        # (and a sliver of the tier label's rule, flat and thin)
        out = np.isin(lab, [i for i in range(1, n) if st[i][4] > max(40, big * 0.03) and st[i][3] > 6])
    a = np.where(out, 255, 0).astype(np.uint8)
    return cv2.cvtColor(np.dstack([c, a]), cv2.COLOR_BGRA2RGBA)


def anchor(rgba):
    """The middle of the piece's lower part, at its bottom row (the board's neck line)."""
    a = rgba[..., 3] > 0
    h = a.shape[0]
    low = a[int(h * 0.6):]
    xs = np.nonzero(low.any(0))[0]
    return (xs.min() + xs.max()) / 2, h


def load_base():
    spec = importlib.util.spec_from_file_location('slice_base', os.path.join(ROOT, 'tools/slice-base.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def heads_table():
    txt = open(os.path.join(ROOT, 'shared/data/chibi.js')).read()
    rows = []
    for line in txt.split('export const CHIBI_HEADS = [')[1].split('];')[0].strip().splitlines():
        cells = [dict(x=int(m[0]), top=int(m[1]), w=int(m[2]), neck=int(m[3]))
                 for m in __import__('re').findall(r'x: (\d+), top: (\d+), w: (\d+), neck: (\d+)', line)]
        rows.append(cells)
    return rows


def main(preview=False):
    im = cv2.imread(SRC)
    boxes = find_pieces(im)
    heads = heads_table()
    stand = [row[8] for row in heads]
    atlas = np.zeros((CELL * (len(TIERS) + 2), CELL * 4, 4), np.uint8)
    table = []
    for t, tier in enumerate(TIERS):
        row = []
        for f in range(4):
            piece = unhead(*lift(im, boxes[t * 4 + f]))
            ax, ay = anchor(piece)
            ph, pw = piece.shape[:2]
            w, h = round(pw * K), round(ph * K)
            big = np.array(Image.fromarray(piece).resize((w, h), Image.LANCZOS))
            assert w <= CELL and h <= CELL, (tier, f, w, h)
            ox, oy = (CELL - w) // 2, CELL - h
            atlas[t * CELL + oy:t * CELL + oy + h, f * CELL + ox:f * CELL + ox + w] = big
            # the cell's top-left, from the skull's centre and top
            fx, st = FIT[f], stand[f]
            row.append([round(fx['dx'] - ax * K - ox, 1), round(st['neck'] - st['top'] + fx['dy'] - ay * K - oy, 1)])
        table.append(row)
    # the raised arms, cut off the body, to draw back over the helmet
    base = load_base()
    body = np.array(Image.open(os.path.join(ROOT, 'assets/chibi/body/base_male.png')).convert('RGBA'))
    arms = []
    y0 = CELL * len(TIERS)
    for r in range(4):
        cell = body[r * 224:(r + 1) * 224, RAISED_COL * 192:(RAISED_COL + 1) * 192]
        m = base.arm_mask(cell, base.RAISED_ARMS[(r, RAISED_COL)])
        ys, xs = np.nonzero(m)
        bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        piece = np.where(m[..., None], cell, 0)[by0:by1, bx0:bx1]
        assert piece.shape[1] <= CELL and piece.shape[0] <= CELL * 2, piece.shape
        # stacked two cells tall per row, each in its own column
        atlas[y0:y0 + piece.shape[0], r * CELL:r * CELL + piece.shape[1]] = piece
        arms.append({'sx': r * CELL, 'sy': y0, 'w': int(piece.shape[1]), 'h': int(piece.shape[0]), 'x': int(bx0), 'y': int(by0)})
    Image.fromarray(atlas).save(os.path.join(ROOT, 'assets/ui/helmets.webp'), quality=92, method=6)
    with open(os.path.join(ROOT, 'shared/data/headgear.js'), 'w') as fp:
        fp.write('// Generated by tools/slice-helmets.py - do not edit by hand.\n')
        fp.write('// assets/ui/helmets.webp: square cells, `cell` px of the chibi frame, four across\n')
        fp.write('// (down, left, up, right) and one row per tier. `at` is each cell\'s top-left from\n')
        fp.write('// the skull\'s centre and neck row (shared/data/chibi.js), for the standing skull\'s\n')
        fp.write('// width `w0`; `arms` are the raised arms of the swing, drawn back over a helmet.\n')
        data = {'file': 'helmets', 'cell': CELL, 'raisedCol': RAISED_COL,
                'tiers': TIERS, 'at': table, 'arms': arms}
        fp.write(f'export const HEADGEAR = {json.dumps(data)};\n')
    print('helmets:', len(TIERS), 'tiers ->', atlas.shape[1], 'x', atlas.shape[0])
    if preview:
        write_preview(atlas, table, heads, body, arms)


def write_preview(atlas, table, heads, body, arms):
    """Every tier worn, standing four ways, and a walk and a swing frame."""
    cols = [8, 2, 22, 24]
    out = np.zeros((224 * len(TIERS), 192 * 4 * len(cols), 4), np.uint8)
    for t in range(len(TIERS)):
        for r in range(4):
            for j, c in enumerate(cols):
                cell = body[r * 224:(r + 1) * 224, c * 192:(c + 1) * 192].copy()
                hd = heads[r][c]
                pc = atlas[t * CELL:(t + 1) * CELL, r * CELL:(r + 1) * CELL]
                over(cell, pc, round(hd['x'] + table[t][r][0]), round(hd['top'] + table[t][r][1]))
                if c == RAISED_COL:
                    a = arms[r]
                    over(cell, atlas[a['sy']:a['sy'] + a['h'], a['sx']:a['sx'] + a['w']], a['x'], a['y'])
                out[t * 224:(t + 1) * 224, (r * len(cols) + j) * 192:(r * len(cols) + j + 1) * 192] = cell
    bg = np.zeros_like(out); bg[...] = (70, 110, 80, 255)
    a = out[..., 3:4] / 255
    comp = (out[..., :3] * a + bg[..., :3] * (1 - a)).astype(np.uint8)
    Image.fromarray(comp).save(os.path.join(ROOT, 'tools/data/helmets-preview.png'))


def over(dst, src, x0, y0):
    H, W = src.shape[:2]
    sx0, sy0, tx0, ty0 = max(0, -x0), max(0, -y0), max(0, x0), max(0, y0)
    w, h = min(W - sx0, dst.shape[1] - tx0), min(H - sy0, dst.shape[0] - ty0)
    if w <= 0 or h <= 0:
        return
    s = src[sy0:sy0 + h, sx0:sx0 + w].astype(np.float32)
    d = dst[ty0:ty0 + h, tx0:tx0 + w].astype(np.float32)
    a = s[..., 3:4] / 255
    d[..., :3] = s[..., :3] * a + d[..., :3] * (1 - a)
    d[..., 3:4] = s[..., 3:4] + d[..., 3:4] * (1 - a)
    dst[ty0:ty0 + h, tx0:tx0 + w] = d.astype(np.uint8)


if __name__ == '__main__':
    main(preview='preview' in sys.argv[1:])
