#!/usr/bin/env python3
"""
Cut the monsters' item + drop sheets into one atlas the game draws loot from.

    python3 tools/slice-drops.py

Each sheet (assets/ui/source/*_drops.png, with real transparency) holds the
item icons over name labels, one row per item of it falling to the ground,
the loot lying there by amount (or, on sheets without such a row, the icons'
tiers standing in for it), and pick-up swirls. The left column of the lower
rows is row labels.

Every piece is found by its transparency: a row is a band of opaque pixels, a
frame a run of opaque columns inside it. All frames of one row share one scale
and stand on the row's baseline, so an animation plays in place. A name of
None leaves that piece out (a second gold, say - the slime sheet's is used).

All sheets go into one file, so a new monster's loot costs the demo no files:
assets/ui/drops.webp (square cells, COLS across) and shared/data/dropart.js.
"""
import json
import os

import cv2
import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), '..')
CELL = 96
COLS = 10

# per sheet: where its row labels end, and (group, band, names or a frame count[, first column[, end column]])
SHEETS = [
    ('assets/ui/source/slime_drops.png', 176, [
        ('icon', (22, 193), ['jelly_1', 'jelly_2', 'jelly_3', 'jelly_3b', 'jelly_4',
                             'crystal_1', 'crystal_2', 'crystal_3', 'crystal_3b', 'crystal_5',
                             'gold_1', 'gold_10', 'gold_100', 'gold_1000']),
        ('fall_jelly', (422, 505), None),
        ('fall_crystal', (525, 627), None),
        ('fall_gold', (634, 725), None),
        ('ground', (759, 873), ['jelly_1', 'jelly_2', 'jelly_3', 'jelly_4',
                                'crystal_1', 'crystal_2', 'crystal_3', 'crystal_4',
                                'gold_1', 'gold_10', 'gold_100', 'gold_1000']),
        ('pickup', (889, 1003), ['water'] * 8 + ['gold'] * 4),
    ]),
    # The mushroom's: no row of loot lying about, so its four tiers of each
    # item are cut twice - fitted to a square as icons, and at one shared
    # scale standing on the floor as the piles by amount.
    ('assets/ui/source/mushroom_drops.png', 230, [
        ('icon', (12, 156), ['cap_1', 'cap_2', 'cap_3', 'cap_4', 'herb_1', 'herb_2', 'herb_3', 'herb_4']),
        ('icon', (206, 350), ['ncrystal_1', 'ncrystal_2', 'ncrystal_3', 'ncrystal_4', None, None, None, None]),
        ('ground', (12, 156), ['cap_1', 'cap_2', 'cap_3', 'cap_4', 'herb_1', 'herb_2', 'herb_3', 'herb_4'], 0),
        ('ground', (206, 350), ['ncrystal_1', 'ncrystal_2', 'ncrystal_3', 'ncrystal_4', None, None, None, None], 0),
        ('fall_cap', (414, 522), 10),
        ('fall_herb', (532, 643), None),
        ('fall_ncrystal', (643, 763), None),
        # blue, green, gold, then all three at once: only the green is new
        ('pickup', (892, 1015), [None] * 3 + ['nature'] * 2 + [None] * 6),
    ]),
    # The caterpillar's: one band per item holding its fall, its piles on the
    # ground and its pick-up swirl side by side between labels, so each is cut
    # from its own run of columns. The crystal and the gold are ones we have.
    ('assets/ui/source/caterpillar_drops.png', 190, [
        ('icon', (150, 255), ['leaf_1'], 245, 330),
        ('fall_leaf', (267, 355), 5, 190, 570),
        ('ground', (267, 355), ['leaf_1', 'leaf_2', 'leaf_3', 'leaf_4'], 722, 1062),
        ('pickup', (267, 355), ['leaf'] * 4, 1222, 1536),
        ('icon', (377, 475), ['shell_1'], 252, 340),
        ('fall_shell', (488, 577), 5, 190, 570),
        ('ground', (488, 577), ['shell_1', 'shell_2', 'shell_3', 'shell_4'], 722, 1062),
        ('pickup', (488, 577), ['shell'] * 4, 1222, 1536),
    ]),
    # The bee's: laid out like the caterpillar's. The piles on the ground lie
    # at a slant and share columns, so they are found as separate shapes; the
    # honey icon is the drop in the top row. Its wind crystal is green here.
    ('assets/ui/source/bee_drops.png', 200, [
        ('icon', (40, 160), ['honey_1'], 850, 925),
        ('fall_honey', (236, 330), 6, 200, 690),
        ('ground', (236, 330), [None, None, 'honey_2', 'honey_1', 'honey_3', 'honey_4'], 690, 1188,
         {'blobs': True, 'thr': 150}),
        ('pickup', (236, 330), ['honey'] * 4, 1190, 1536),
        ('icon', (405, 508), [None, None, None, 'stinger_1', None, None], 690, 1188, {'blobs': True, 'thr': 150}),
        ('fall_stinger', (405, 508), 6, 200, 664, {'blobs': True, 'thr': 150}),
        ('ground', (405, 508), ['stinger_1', None, 'stinger_2', None, 'stinger_3', 'stinger_4'], 690, 1188,
         {'blobs': True, 'thr': 150}),
        ('pickup', (405, 508), ['stinger'] * 4, 1190, 1536, {'thr': 200}),
        ('icon', (596, 722), ['wcrystal_1', None, None, None, None], 690, 1188, {'blobs': True, 'thr': 200}),
        ('fall_wcrystal', (596, 722), 6, 205, 690),
        ('ground', (596, 722), ['wcrystal_1', 'wcrystal_2', 'wcrystal_3', 'wcrystal_4', None], 690, 1188,
         {'blobs': True, 'thr': 200}),
        ('pickup', (596, 722), ['wcrystal'] * 4, 1190, 1536, {'thr': 150}),
    ]),
]


def runs(mask, y0, y1, x0, gap=6, x1=None):
    col = mask[y0:y1, x0:x1].sum(0)
    out, start = [], None
    for x, v in enumerate(col):
        if v and start is None:
            start = x
        elif not v and start is not None:
            out.append([start + x0, x + x0])
            start = None
    if start is not None:
        out.append([start + x0, len(col) + x0])
    merged = []
    for s, e in out:
        if merged and s - merged[-1][1] < gap:
            merged[-1][1] = e
        else:
            merged.append([s, e])
    return merged


def blobs(im, y0, y1, x0, x1, thr):
    """The separate shapes in a band, left to right: each cut to its own box
    with its neighbours' pixels cleared out of it."""
    band = im[y0:y1, x0:x1]
    m = cv2.morphologyEx((band[..., 3] > thr).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    out = []
    for i in sorted((i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 300), key=lambda i: st[i, 0]):
        x, _, w, _, _ = st[i]
        mine = cv2.dilate((lab == i).astype(np.uint8), np.ones((9, 9), np.uint8))
        crop = band[:, x:x + w].copy()
        crop[..., 3] = crop[..., 3] * mine[:, x:x + w]
        out.append(crop)
    return out


def split_widest(im, y0, y1, spans, want):
    """Two pieces that touch (the gold stack against the purse): cut the
    widest run at its thinnest column until there are enough."""
    a = im[y0:y1, :, 3].astype(np.int32)
    while len(spans) < want:
        i = max(range(len(spans)), key=lambda k: spans[k][1] - spans[k][0])
        s, e = spans[i]
        inner = a[:, s + (e - s) // 5: e - (e - s) // 5].sum(0)
        cut = s + (e - s) // 5 + int(np.argmin(inner))
        spans[i:i + 1] = [[s, cut], [cut, e]]
    return spans


def main():
    pieces = []            # (group, name, rgba crop, scale)
    for src, label_x, rows, *opts in SHEETS:
        im = cv2.imread(os.path.join(ROOT, src), cv2.IMREAD_UNCHANGED)
        floor = (opts[0] if opts else {}).get('alpha_floor')   # a half see-through backing to drop
        if floor:
            a = im[..., 3].astype(np.float32)
            im[..., 3] = np.clip((a - floor) / (250 - floor) * 255, 0, 255).astype(np.uint8)
        mask = (im[..., 3] > 24).astype(np.uint8)
        for group, (y0, y1), names, *rest in rows:
            # a trailing dict tunes one row: `thr` the opacity a piece starts
            # at, `blobs` to find pieces as separate shapes rather than runs of
            # columns (for pieces lying at a slant that share columns)
            tune = rest.pop() if rest and isinstance(rest[-1], dict) else {}
            count = len(names) if isinstance(names, list) else names
            # icons start at the left edge; other rows past the row labels
            x0 = rest[0] if rest else 0 if group == 'icon' else label_x
            x1 = rest[1] if len(rest) > 1 else im.shape[1]
            thr = tune.get('thr', 24)
            if tune.get('blobs'):
                cuts = blobs(im, y0, y1, x0, x1, thr)
            else:
                spans = runs((im[..., 3] > thr).astype(np.uint8) if thr != 24 else mask, y0, y1, x0, x1=x1)
                if count and len(spans) < count:
                    spans = split_widest(im, y0, y1, spans, count)
                cuts = [im[y0:y1, s:e] for s, e in spans]
            if count:
                assert len(cuts) == count, (src, group, len(cuts), count)
            widest = max(c.shape[1] for c in cuts)
            k = (CELL - 6) / max(y1 - y0, widest)
            for i, crop in enumerate(cuts):
                name = names[i] if isinstance(names, list) else None
                if isinstance(names, list) and name is None:
                    continue
                kk = k
                if group == 'icon':
                    # an icon fills its own square: trim it and fit it alone
                    ys = np.where(crop[..., 3].max(1) > 24)[0]
                    crop = crop[ys[0]:ys[-1] + 1]
                    kk = (CELL - 8) / max(crop.shape[:2])
                pieces.append((group, name, crop, kk))

    rows = (len(pieces) + COLS - 1) // COLS
    atlas = np.zeros((rows * CELL, COLS * CELL, 4), np.uint8)
    meta = {}
    for n, (group, name, crop, k) in enumerate(pieces):
        h, w = crop.shape[:2]
        sw, sh = max(1, round(w * k)), max(1, round(h * k))
        small = cv2.resize(crop, (sw, sh), interpolation=cv2.INTER_AREA)
        cx, cy = (n % COLS) * CELL, (n // COLS) * CELL
        # centred across, standing on the cell's floor (3px up); icons centred
        px = cx + (CELL - sw) // 2
        py = cy + (CELL - sh) // 2 if group == 'icon' else cy + CELL - 3 - sh
        atlas[py:py + sh, px:px + sw] = small
        if name is None:
            meta.setdefault(group, []).append(n)           # an animation: frames in order
        elif group == 'pickup':
            meta.setdefault(group, {}).setdefault(name, []).append(n)
        else:
            meta.setdefault(group, {})[name] = n

    out = os.path.join(ROOT, 'assets/ui/drops.webp')
    cv2.imwrite(out, atlas, [cv2.IMWRITE_WEBP_QUALITY, 92])
    js = os.path.join(ROOT, 'shared/data/dropart.js')
    with open(js, 'w') as f:
        f.write('// Generated by tools/slice-drops.py from assets/ui/source/*_drops.png - do not edit by hand.\n')
        f.write('// Cells of assets/ui/drops.webp: square, CELL px, COLS across; each piece stands on\n')
        f.write('// its cell\'s floor (3px up), so frames of one row play in place; icons are centred.\n')
        f.write(f'export const DROP_ART = {json.dumps({"file": "drops", "cell": CELL, "cols": COLS, "floor": 3, "cells": meta}, indent=2)};\n')
    print(f'{len(pieces)} pieces -> {out} ({COLS * CELL}x{rows * CELL})')
    for g, v in meta.items():
        print(' ', g, len(v) if isinstance(v, list) else v)


if __name__ == '__main__':
    main()
