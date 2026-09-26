#!/usr/bin/env python3
"""The chibi's eight-way walk, Ragnarok style.

    python3 tools/build-walk8.py

assets/chibi/source/walk8-sheet.png is the bald base in eight facings, but
its legs barely move from frame to frame: played, the figure glides. So only
its standing pose is used per facing (the body, the head, the arms), and the
legs are the old four-way walk's (assets/chibi/body/base_male.png, whose legs
really step): each of its eight frames' legs cut below the shorts, brought to
this body's size and skin tone, hung from this body's hem, and the body
raised and lowered on them as the old body was - so a foot is always on the
ground and never below it. The diagonals take the side walk's legs. A ninth
column is the standing frame.

The spiky hair of the old eight-way board is set on every head, scaled to
the skull, in each colour; and the weapon fist is carried along with the
head from the standing pose of the old sheet.

Output:
  assets/chibi/body/base_male_walk8.png   9 cols x 8 rows (down, dl, left, ul, up, ur, right, dr)
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
FRAMES = 8
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


OLD = os.path.join(ROOT, 'assets/chibi/body/base_male.png')
# the old four-way walk whose legs each facing borrows (its rows: down, left, up, right)
LEG_ROW = {'down': 0, 'dl': 1, 'left': 1, 'ul': 1, 'up': 2, 'ur': 3, 'right': 3, 'dr': 3}


def standing(a, f, s):
    """The standing figure set in a cell: head over the middle, feet on BASE."""
    piece = crop(a, f)
    pw, ph = max(1, round(piece.shape[1] * s)), max(1, round(piece.shape[0] * s))
    piece = np.array(Image.fromarray(piece).resize((pw, ph), Image.LANCZOS))
    piece[..., 3] = np.where(piece[..., 3] < 24, 0, piece[..., 3])
    hd = sb.head_of(piece[..., 3])
    ys = np.nonzero((piece[..., 3] > 60).any(1))[0]
    cell = np.zeros((H, W, 4), np.uint8)
    sb.place(cell, piece, round(W / 2 - hd['cx']), BASE - 1 - int(ys[-1]))
    return cell


def split(fig, grey_v=190):
    """The hem of the shorts, and what hangs below it and reaches the ground
    (the legs, not a fist)."""
    al = fig[..., 3]
    hsv = cv2.cvtColor(fig[..., :3], cv2.COLOR_RGB2HSV).astype(int)
    ys = np.nonzero((al > 60).any(1))[0]
    top, bot = ys[0], ys[-1]
    grey = (hsv[..., 1] < 50) & (hsv[..., 2] > 40) & (hsv[..., 2] < grey_v) & (al > 150)
    grey[:top + int((bot - top) * 0.5)] = False
    hem = int(np.nonzero(grey.sum(1) > 4)[0].max())
    below = (al > 20).astype(np.uint8)
    below[:hem + 1] = 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(below)
    leg = np.zeros(al.shape, bool)
    for i in range(1, n):
        if st[i][1] + st[i][3] > hem + 10 and st[i][4] > 60:
            leg |= lab == i
        elif st[i][4] <= 60:
            leg |= lab == i               # scraps of the leg's edge go with it
    return hem, leg


def skin(img, m):
    """The lit skin's colour: bright, warm, solid pixels."""
    hsv = cv2.cvtColor(img[..., :3], cv2.COLOR_RGB2HSV)
    ok = m & (img[..., 3] > 220) & (hsv[..., 2] > 150) & (hsv[..., 1] > 40)
    return np.median(img[..., :3][ok].astype(np.float32), 0)


def legs(old, row, col, mask_fn=split):
    """One frame of the old walk: its legs alone (tucked a few rows up under
    the shorts) and its hem."""
    f = old[row * H:(row + 1) * H, col * W:(col + 1) * W]
    hem, leg = mask_fn(f, 235)
    piece = f.copy()
    piece[..., 3] = np.where(leg, piece[..., 3], 0)
    # the first rows under the hem carry the old shorts' pale fringe: they
    # are painted over with the leg a little lower, and carried up under the hem
    src = piece[hem + 4]
    for y in range(hem - 3, hem + 4):
        piece[y] = np.where((src[:, 3:4] > 0) & ((piece[y, :, 3:4] > 0) | (y <= hem)), src, piece[y])
    return piece, hem, leg


def main():
    a = np.array(Image.open(SRC).convert('RGBA'))
    old = np.array(Image.open(OLD).convert('RGBA'))
    groups = frames_of(a)
    body = np.zeros((H * 8, W * (FRAMES + 1), 4), np.uint8)
    heads = {}
    for r, face in enumerate(FACINGS):
        fs = groups[face]
        fig = standing(a, fs[0], HEIGHT / float(np.median([f[3] for f in fs])))
        hd = sb.head_of(fig[..., 3])
        hem, leg = split(fig)
        upper = fig.copy()
        upper[..., 3] = np.where(leg, 0, upper[..., 3])
        lr = LEG_ROW[face]
        # The walk is the old one's, step for step: its legs, brought to this
        # body's size and skin, hang from this body's hem; and the body rides
        # up and down on them as the old body did.
        ref_piece, ref, ref_leg = legs(old, lr, 0)
        oys, oxs = np.nonzero(ref_leg)
        nys, nxs = np.nonzero(leg)
        k = (BASE - 1 - hem) / float(oys.max() - ref)
        idle_piece, _, idle_leg = legs(old, lr, FRAMES)
        ix = np.nonzero(idle_leg.any(0))[0]
        kx = k * 1.1                     # a touch stockier, as this body is
        ocx, ncx = (ix[0] + ix[-1]) / 2, (nxs.min() + nxs.max()) / 2
        gain = skin(fig, leg) / skin(old[lr * H:(lr + 1) * H, :W], ref_leg)
        heads[face] = []
        for c in range(FRAMES + 1):
            piece, ohem, _ = legs(old, lr, c)
            # the colour of this body's skin
            rgb = piece[..., :3].astype(np.float32) * gain
            piece[..., :3] = rgb.clip(0, 255).astype(np.uint8)
            M = np.float32([[kx, 0, ncx - ocx * kx], [0, k, hem - ref * k]])
            pm = piece.astype(np.float32)
            pm[..., :3] *= pm[..., 3:4] / 255
            out = cv2.warpAffine(pm, M, (W, H), flags=cv2.INTER_AREA, borderValue=0)
            al = out[..., 3:4]
            out[..., :3] = np.where(al > 0, out[..., :3] * 255 / np.maximum(al, 1e-3), 0)
            out = out.clip(0, 255).astype(np.uint8)
            # the leg was cut square at the old hem; where its top shows past
            # the shorts (a leg swung back) the corners are rounded off
            bob = round((ohem - ref) * k)
            top = hem + bob + 9
            rounded = cv2.morphologyEx(out[..., 3], cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
            out[:top, :, 3] = np.minimum(out[:top, :, 3], rounded[:top])
            # what is tucked up under the hem stays under the shorts
            cover = np.roll(upper[..., 3], bob, 0) > 0
            out[:hem + bob + 1, :, 3] = np.where(cover[:hem + bob + 1], out[:hem + bob + 1, :, 3], 0)
            # and the shorts shade the top of the leg
            for d in range(6):
                y = hem + bob + 1 + d
                out[y, :, :3] = (out[y, :, :3] * (0.72 + 0.28 * d / 6)).astype(np.uint8)
            bob = round((ohem - ref) * k)
            cell = np.zeros((H, W, 4), np.uint8)
            sb.place(cell, out, 0, 0)
            sb.place(cell, upper, 0, bob)
            # feet on the ground, never under it
            ys = np.nonzero((cell[..., 3] > 60).any(1))[0]
            if ys[-1] > BASE - 1:
                cell = np.roll(cell, BASE - 1 - ys[-1], 0)
                bob += BASE - 1 - ys[-1]
            body[r * H:(r + 1) * H, c * W:(c + 1) * W] = cell
            heads[face].append({'cx': W / 2, 'top': hd['top'] + bob, 'w': hd['w']})
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
        fp.write('// ur, right, dr), 8 steps and the standing frame, in the 192x224 cell.\n')
        fp.write('export const CHIBI_FISTS8 = [\n')
        for face, row in zip(FACINGS, rows_out):
            fp.write('  [' + ', '.join(f'[{x}, {y}]' for x, y in row) + f'],   // {face}\n')
        fp.write('];\n')
    print('walk8 built')


if __name__ == '__main__':
    main()
