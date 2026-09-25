#!/usr/bin/env python3
"""
Cut a monster's item + drop sheet into one atlas the game draws loot from.

    python3 tools/slice-drops.py

The sheet (assets/ui/source/slime_drops.png, with real transparency) has, top
to bottom: the item icons over name labels, the same icons again without
labels (unused), then one row each of the item / crystal / gold falling to the
ground, the loot lying on the ground by amount, and the pick-up swirl in blue
and in gold. The left column of the lower rows is row labels.

Every piece is found by its transparency: a row is a band of opaque pixels, a
frame a run of opaque columns inside it. All frames of one row share one scale
and stand on the row's baseline, so an animation plays in place.

Writes assets/ui/drops.webp (square cells, COLS across) and
shared/data/dropart.js (which cells are what).
"""
import json
import os

import cv2
import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets/ui/source/slime_drops.png')
CELL = 96
COLS = 10
LABEL_X = 176          # the row labels of the lower rows sit left of this

# (group, sheet band, how the frames in it are named)
ROWS = [
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
]


def runs(mask, y0, y1, x0, gap=6):
    col = mask[y0:y1, x0:].sum(0)
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
    im = cv2.imread(SRC, cv2.IMREAD_UNCHANGED)
    mask = (im[..., 3] > 24).astype(np.uint8)
    pieces = []            # (group, name, rgba crop, scale, ground-y offset in the crop)
    for group, (y0, y1), names in ROWS:
        x0 = 0 if group == 'icon' else LABEL_X
        spans = runs(mask, y0, y1, x0)
        if names and len(spans) < len(names):
            spans = split_widest(im, y0, y1, spans, len(names))
        if names:
            assert len(spans) == len(names), (group, len(spans), len(names))
        widest = max(e - s for s, e in spans)
        k = (CELL - 6) / max(y1 - y0, widest)
        for i, (s, e) in enumerate(spans):
            crop = im[y0:y1, s:e]
            if group == 'icon':
                # an icon fills its own square: trim it and fit it alone
                ys = np.where(crop[..., 3].max(1) > 24)[0]
                crop = crop[ys[0]:ys[-1] + 1]
                k = (CELL - 8) / max(crop.shape[:2])
            pieces.append((group, names[i] if names else None, crop, k))

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
        f.write('// Generated by tools/slice-drops.py from assets/ui/source/slime_drops.png - do not edit by hand.\n')
        f.write('// Cells of assets/ui/drops.webp: square, CELL px, COLS across; each piece stands on\n')
        f.write('// its cell\'s floor (3px up), so frames of one row play in place; icons are centred.\n')
        f.write(f'export const DROP_ART = {json.dumps({"file": "drops", "cell": CELL, "cols": COLS, "floor": 3, "cells": meta}, indent=2)};\n')
    print(f'{len(pieces)} pieces -> {out} ({COLS * CELL}x{rows * CELL})')
    for g, v in meta.items():
        print(' ', g, len(v) if isinstance(v, list) else v)


if __name__ == '__main__':
    main()
