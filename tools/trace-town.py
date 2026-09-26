#!/usr/bin/env python3
"""Trace where a character may stand in Emberhold.

    python3 tools/trace-town.py [overlay.png]

Two pictures of the same town, the same size and in register:
  assets/maps/source/emberhold2/layout.png  the walk plan: paving, stairs and
                                            bridges between walls, lawns and water
  assets/maps/source/emberhold3/full.png    the painted town on that plan, with
                                            houses and stalls on the lawns
A tile is open where the plan has paving (or is one of the stairs and joins
listed below, whose step shadows read as walls) and the painting still has
paving there - a house that spills over the plan's path closes it. The
fountain's basin is closed by hand. Only ground joined to the square is kept.
Writes shared/data/emberhold-obstacles.js (90x60, '#' blocked).
"""
import os
import sys
from collections import deque

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..')
PLAN = 'assets/maps/source/emberhold2/layout.png'
TOWN = 'assets/maps/source/emberhold3/full.png'
COLS, ROWS = 90, 60
SEED = (45, 34)                        # the square below the fountain
# x, y, w, h in tiles: stairs, the bridge heads and the castle gate
FORCE_OPEN = [
    (31, 10, 4, 4), (13, 23, 4, 5), (75, 5, 4, 4), (55, 10, 3, 4), (74, 22, 4, 5), (9, 33, 2, 3),
    (22, 32, 4, 4), (42, 38, 6, 5), (64, 51, 5, 9), (42, 49, 6, 5), (65, 32, 4, 4), (13, 4, 4, 5),
    (43, 3, 5, 4), (9, 29, 4, 3), (78, 29, 5, 3), (58, 43, 6, 5),
    (56, 42, 8, 1), (57, 40, 2, 3), (34, 20, 4, 3),     # paving the shade of a stall or roof hides
]
FORCE_BLOCK = []
# the fountain's round basin: centre and radii in px of the 1x picture
FOUNTAIN = (770, 490, 84, 64)
# the lamp posts and banners: the tile each stands on (see POSTS in build-town.py)
import importlib.util
_spec = importlib.util.spec_from_file_location('build_town', os.path.join(os.path.dirname(__file__), 'build-town.py'))
_bt = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_bt)
POSTS = _bt.POSTS        # the fountain basin (its statue rises over the path behind: see build-town.py)


def tile_share(mask, inset=(0.2, 0.8, 0.3, 0.95)):
    """How much of each tile's middle (where the feet are) the mask covers."""
    H, W = mask.shape
    tw, th = W / COLS, H / ROWS
    out = np.zeros((ROWS, COLS))
    x0, x1, y0, y1 = inset
    for y in range(ROWS):
        for x in range(COLS):
            out[y, x] = mask[int((y + y0) * th):int((y + y1) * th), int((x + x0) * tw):int((x + x1) * tw)].mean()
    return out


def main(overlay=None):
    plan = np.array(Image.open(os.path.join(ROOT, PLAN)).convert('RGB'))
    town = np.array(Image.open(os.path.join(ROOT, TOWN)).convert('RGB'))
    # the plan: pale paving without the dark lines of a wall edge, or wood
    hsv = cv2.cvtColor(cv2.GaussianBlur(plan, (0, 0), 1), cv2.COLOR_RGB2HSV).astype(int)
    h, s, v = hsv[..., 0] * 2, hsv[..., 1], hsv[..., 2]
    lawn = (h > 45) & (h < 100) & (s > 110)
    wood = (h >= 15) & (h <= 40) & (s > 120) & (v > 90) & ~lawn
    pave = (s < 95) & (v >= 135) & (v >= 115)
    dark = v < 115
    plan_open = ((tile_share(pave, (0.15, 0.85, 0.15, 0.85)) > 0.5) & (tile_share(dark, (0.15, 0.85, 0.15, 0.85)) < 0.2)) \
        | (tile_share(wood, (0.15, 0.85, 0.15, 0.85)) > 0.5)
    plan_lawn = tile_share(lawn, (0.15, 0.85, 0.15, 0.85)) > 0.5
    # the painting: still paving
    hsv = cv2.cvtColor(cv2.GaussianBlur(town, (0, 0), 1.2), cv2.COLOR_RGB2HSV).astype(int)
    h, s, v = hsv[..., 0] * 2, hsv[..., 1], hsv[..., 2]
    town_pave = (s < 90) & (v >= 150) & ((h <= 45) | (s < 30))
    # Wherever there is a way, one can walk: paving on the plan or in the
    # painting, and the lots the houses and stalls stand on. Houses, stalls,
    # lamp posts and banners are walked through (they go see-through when
    # you are behind them); only the water and the walls stop you.
    # the water on the plan (the painting's blue roofs are not water)
    water = plan[..., 2].astype(int) > plan[..., 0].astype(int) + 60
    # the plan's own paving, strictly - its raised ledges, stone walls and
    # fences stay shut - and its lots, where the houses stand (they block by
    # their footings: tools/solids-town.py)
    strict = (tile_share(pave, (0.15, 0.85, 0.15, 0.85)) > 0.72) & (tile_share(dark, (0.15, 0.85, 0.15, 0.85)) < 0.06)
    open_ = (strict | (tile_share(wood, (0.15, 0.85, 0.15, 0.85)) > 0.5) | plan_lawn) & (tile_share(water) < 0.3)
    # a one-tile notch in a street is a place to snag on: fill it
    import cv2 as _cv
    open_ = _cv.morphologyEx(open_.astype(np.uint8), _cv.MORPH_CLOSE, np.ones((3, 3), np.uint8)).astype(bool) & (tile_share(water) < 0.3)
    for x, y, w, hh in FORCE_OPEN:
        open_[y:y + hh, x:x + w] = True
    for x, y, w, hh in FORCE_BLOCK:
        open_[y:y + hh, x:x + w] = False
    W, H = town.shape[1], town.shape[0]
    # The fine grid: 4 world px a cell, eight to a tile each way - fine enough
    # that a round basin is round. From the
    # plan at that size - paving, wood and the lots open; the raised ledges,
    # the walls and the water shut - with the thin kerb lines round the lots
    # (low enough to step over) opened again, the stairs and bridge heads
    # forced open and the fountain basin shut.
    F = 8
    fc, fr = COLS * F, ROWS * F
    hsvp = cv2.cvtColor(cv2.GaussianBlur(plan, (0, 0), 0.8), cv2.COLOR_RGB2HSV).astype(int)
    hp, sp, vp = hsvp[..., 0] * 2, hsvp[..., 1], hsvp[..., 2]
    lawn_p = (hp > 45) & (hp < 100) & (sp > 110)
    wood_p = (hp >= 15) & (hp <= 40) & (sp > 120) & (vp > 90) & ~lawn_p
    pave_p = (sp < 95) & (vp >= 140)
    water_p = plan[..., 2].astype(int) > plan[..., 0].astype(int) + 60
    openpx = (pave_p | wood_p | lawn_p) & ~water_p
    fine = cv2.resize(openpx.astype(np.float32), (fc, fr), interpolation=cv2.INTER_AREA) > 0.6
    shut = (~fine).astype(np.uint8)
    shut = cv2.morphologyEx(shut, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))        # kerbs go, walls stay
    # what is left shut in little islands is a kerb, a paving line or a
    # shadow the plan drew, not a wall: walls and ledges run on into each
    # other, and the posts, fences and houses are solids of their own
    n_, lab_, st_, _ = cv2.connectedComponentsWithStats(shut)
    small = np.zeros(n_, bool)
    small[1:] = st_[1:, cv2.CC_STAT_AREA] < 1200
    shut[small[lab_]] = 0
    wet = cv2.resize(water_p.astype(np.float32), (fc, fr), interpolation=cv2.INTER_AREA) > 0.4
    fine = ~shut.astype(bool) & ~wet
    for x, y, w, hh in FORCE_OPEN:
        fine[y * F:(y + hh) * F, x * F:(x + w) * F] = True
    for x, y, w, hh in FORCE_BLOCK:
        fine[y * F:(y + hh) * F, x * F:(x + w) * F] = False
    k = fc / plan.shape[1]
    fx, fy, frx, fry = FOUNTAIN
    yy, xx = np.mgrid[0:fr, 0:fc]
    fine &= ((xx + 0.5 - fx * k) / (frx * k)) ** 2 + ((yy + 0.5 - fy * k) / (fry * k)) ** 2 > 1
    sx, sy = SEED[0] * F + F // 2, SEED[1] * F + F // 2
    seen_f = np.zeros_like(fine)
    seen_f[sy, sx] = True
    q = deque([(sx, sy)])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < fc and 0 <= ny < fr and fine[ny, nx] and not seen_f[ny, nx]:
                seen_f[ny, nx] = True
                q.append((nx, ny))
    # the tile grid only says where there is ground at all: a tile with any
    # reachable fine cell is open, and the fine grid does the rest
    seen = seen_f.reshape(ROWS, F, COLS, F).any(axis=(1, 3))
    open_ = seen.copy()
    with open(os.path.join(ROOT, 'shared/data/emberhold-obstacles.js'), 'w') as fp:
        fp.write(f'// Generated by tools/trace-town.py from {PLAN} and {TOWN} - do not edit by hand.\n')
        fp.write("// One string per map row; '#' is a tile nobody may stand on.\n")
        fp.write('export const EMBERHOLD_OBSTACLES = [\n')
        for y in range(ROWS):
            fp.write("  '" + ''.join('.' if seen[y, x] else '#' for x in range(COLS)) + "',\n")
        fp.write('];\n')
    import base64
    bits = np.packbits((~seen_f).astype(np.uint8).ravel())
    with open(os.path.join(ROOT, 'shared/data/emberhold-fine.js'), 'w') as fp:
        fp.write(f'// Generated by tools/trace-town.py - do not edit by hand.\n')
        fp.write('// Where a body may stand in Emberhold, 4 world px a cell: one bit a cell,\n')
        fp.write('// row by row, 1 = shut (see shared/solids.js).\n')
        fp.write(f"export const EMBERHOLD_FINE = {{ cell: 4, cols: {fc}, rows: {fr}, bits: '{base64.b64encode(bits.tobytes()).decode()}' }};\n")
    if overlay:
        H, W = town.shape[:2]
        tw, th = W / COLS, H / ROWS
        ov = Image.fromarray(town).convert('RGBA')
        lay = np.zeros((fr, fc, 4), np.uint8)
        lay[~seen_f] = (0, 0, 0, 150)
        lay[fine & ~seen_f] = (255, 0, 0, 140)
        ov.alpha_composite(Image.fromarray(lay).resize((W, H), Image.NEAREST))
        d = ImageDraw.Draw(ov)
        for x in range(0, COLS + 1, 5):
            d.line([(x * tw, 0), (x * tw, H)], fill=(255, 255, 0, 140))
            d.text((x * tw + 2, 2), str(x), fill=(255, 255, 0))
        for y in range(0, ROWS + 1, 5):
            d.line([(0, y * th), (W, y * th)], fill=(255, 255, 0, 140))
            d.text((2, y * th + 2), str(y), fill=(255, 255, 0))
        ov.convert('RGB').save(overlay)
    print('emberhold', int(seen.sum()), 'open tiles of', COLS * ROWS, '-', int(seen_f.sum()), 'open fine cells of', fc * fr)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else None)
