#!/usr/bin/env python3
"""Trace which tiles of a painted field can be walked on.

    python3 tools/trace-field.py greenmire [overlay.png]

A painted map is one picture; the game still needs to know where a character
may stand. The picture is split into the map's tile grid and each pixel is
sorted by colour: the dirt paths, the open grass and the wooden stairs and
bridges are ground; tree canopy, water, the grey cliff faces and boulders are
not. A tile is blocked when too little of it is ground. Pockets of ground no
path reaches (a clearing walled in by trees, the little islands) are closed
too, so nothing can be stranded there.

Writes shared/data/<id>-obstacles.js (one string per row, '#' blocked) and
assets/maps/<id>.webp (the picture the game draws).
"""
import os
import sys
from collections import deque

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')

FIELDS = {
    'greenmire': {
        # stitched by tools/stitch-greenmire.py from the full picture and its six close-ups
        'src': 'assets/maps/source/greenmire2/stitched.png',
        'cols': 90, 'rows': 60,
        # the picture the game draws under the streamed tiles: half size is plenty
        'backdrop_scale': 0.5,
        'seed': (44, 3),
        # the wooden stairs and bridges: dark planks the colour sort calls cliff
        'force_open': [(43, 24, 3, 4), (43, 35, 4, 3), (43, 52, 4, 4), (86, 21, 3, 3), (87, 39, 2, 3)],
        'force_block': [],
    },
    'amberwood': {
        # Monster Field 02, one 1536x1024 painting: autumn woods cut by
        # rivers, dirt clearings joined by paths and bridges, a ruined stone
        # plaza in the north-east
        'src': 'assets/maps/source/amberwood/full.png',
        'cols': 90, 'rows': 60,
        'backdrop_scale': 1,
        'seed': (2, 28),
        'classify': 'autumn',
        'close_gaps': 0.25,
        # the plank bridges and the stone stairs: dark, and sorted as cliff
        # (and the stone bridges and the plaza's worn paving, sorted as rough)
        'force_open': [(20, 21, 3, 3), (24, 29, 3, 3), (35, 31, 3, 3), (35, 48, 3, 3), (13, 48, 2, 3),
                       (50, 10, 3, 5),
                       (0, 27, 8, 3),            # the west stone bridge
                       (78, 41, 12, 3),          # the east stone bridge
                       (69, 15, 10, 11),         # the plaza
                       (82, 21, 8, 2),           # the plaza's east aqueduct
                       (78, 21, 5, 2),           # ...and where it meets the plaza
                       (58, 22, 5, 3), (62, 21, 7, 2),   # the plaza's west aqueduct, curving up to it
                       (26, 9, 3, 3),            # the north path, past the tree over it
                       (35, 30, 6, 3),           # off the middle plank bridge, east
                       (10, 30, 4, 3),           # the west road down to the south-west clearing
                       (18, 44, 6, 3),           # the big south-west clearing onto the south road
                       (27, 6, 3, 3), (26, 11, 3, 2),    # the north path's bends, by the north clearing
                       (46, 27, 4, 3),           # the middle road, where a tree leans over it
                       (28, 49, 3, 2), (31, 48, 4, 3),   # the south road, west of the plank bridge
                       (49, 20, 4, 3),           # the stairs path down to the middle road
                       (57, 24, 3, 3), (58, 27, 3, 4),   # the road south from the plaza bridge
                       (46, 17, 4, 3),           # the stairs path's foot
                       (38, 49, 4, 3), (40, 50, 4, 3),   # the south road, east of the plank bridge
                       (48, 13, 4, 3),           # the top of the stairs path
                       (60, 31, 4, 3),           # the road down to the south-east clearing
                       (43, 51, 3, 2), (61, 50, 3, 2)],  # the south road's two ends in the shade
        'force_block': [],
    },
    'obsidian': {
        # Monster Field 03, one 1536x1024 painting: black rock over lava,
        # ash-brown clearings joined by dirt roads, stone stairs and bridges,
        # a horned arena in the south-east
        'src': 'assets/maps/source/obsidian/full.png',
        'cols': 90, 'rows': 60,
        'backdrop_scale': 1,
        'seed': (25, 22),
        'classify': 'ash',
        'close_gaps': 0.25,
        # the stone stairs and bridges (grey, sorted as rock), and roads
        # darkened by the lava's glow
        # the grey stone stairs and bridges sort as rock: the gaps they leave in
        # the roads are closed across anything that is not lava (bridge_gaps)
        'bridge_gaps': 7,
        'force_open': [(0, 15, 11, 3), (11, 13, 3, 3),          # the west road in, and up to the north loop
                       (12, 31, 3, 3), (14, 32, 6, 3), (18, 34, 3, 2),                  # the south-west bridge
                       (35, 25, 6, 3), (39, 22, 3, 5),                                  # the middle bridge and stairs
                       (38, 8, 5, 2), (37, 10, 3, 5),                                   # the north clearing's west stairs
                       (50, 8, 3, 4), (51, 11, 3, 4), (52, 14, 3, 3),                   # ...and its east stairs
                       (79, 15, 11, 3),                                                 # the east bridge out
                       (66, 24, 4, 3), (69, 26, 4, 3), (72, 27, 4, 3), (74, 28, 3, 6),  # down to the arena's north stairs
                       (45, 33, 4, 3), (47, 34, 4, 3), (50, 35, 4, 3), (53, 36, 4, 3), (56, 37, 4, 3), (58, 38, 3, 3),  # the long bridge
                       (36, 33, 3, 4), (38, 32, 6, 2),                                  # the stairs up from the south-west clearing
                       (24, 46, 3, 3), (26, 48, 6, 3), (31, 49, 8, 3), (38, 50, 8, 3), (45, 51, 5, 3),  # the south road
                       (79, 45, 4, 3), (81, 47, 4, 3), (83, 49, 4, 3), (85, 51, 4, 3), (87, 52, 3, 3),  # the arena's south-east gate
                       (77, 43, 4, 4),                                                  # ...from the arena floor
                       (60, 16, 5, 4),                                                  # the road into the east clearing
                       (13, 12, 5, 2), (39, 18, 3, 3),                                  # the north loop's two ends
                       (41, 7, 3, 3),                                                   # the west stairs' top
                       (48, 52, 4, 4)],                                                 # the south road's end
        'lava_after': 0.5,     # and whatever of those stands over lava is shut again,
        # but for the bridge heads, where the lava glows up round the planks
        'force_after': [(45, 33, 4, 2), (62, 20, 3, 3), (63, 22, 2, 2), (29, 13, 3, 2), (38, 7, 4, 2),
                        (70, 26, 4, 3), (52, 35, 4, 3), (80, 45, 4, 4)],
        'force_block': [],
    },
}


def classify_ash(rgb):
    """Per pixel, for the lava highlands: the ash-brown dirt and the arena's
    cracked stone are ground - warm, middling in saturation and light, and
    smooth; the lava is too saturated or too dark, the rock too rough."""
    img = cv2.GaussianBlur(rgb, (0, 0), 1.2)
    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV).astype(np.int32)
    h, s, v = hsv[..., 0] * 2, hsv[..., 1], hsv[..., 2]
    lum = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    mu = cv2.blur(lum, (9, 9))
    sd = np.sqrt(np.maximum(cv2.blur(lum * lum, (9, 9)) - mu * mu, 0))
    g = (h >= 12) & (h <= 48) & (s >= 55) & (s <= 160) & (v >= 105) & (v <= 215) & (sd < 20)
    return g.astype(np.float32)


def classify_autumn(rgb):
    """Per pixel, for the autumn woods: the tan dirt and yellow-green grass
    and the pale paving are ground, when smooth - the orange and red canopy
    has the dirt's colours, but not its calm."""
    img = cv2.GaussianBlur(rgb, (0, 0), 1.2)
    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV).astype(np.int32)
    h, s, v = hsv[..., 0] * 2, hsv[..., 1], hsv[..., 2]
    R, G, B = [img[..., i].astype(np.int32) for i in range(3)]
    lum = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    mu = cv2.blur(lum, (9, 9))
    sd = np.sqrt(np.maximum(cv2.blur(lum * lum, (9, 9)) - mu * mu, 0))
    dirt = (h >= 25) & (h <= 58) & (v >= 150) & (s >= 50) & (s <= 200)
    grass = (h > 58) & (h <= 95) & (v >= 120) & (s >= 60)
    pave = (s < 75) & (v >= 165)
    water = (B > R + 25) & (B > G)
    return ((dirt | grass | pave) & ~water & (sd < 22)).astype(np.float32)


def classify(rgb):
    """Per pixel: 1 ground, 0 blocked."""
    img = cv2.GaussianBlur(rgb, (0, 0), 1.6)
    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV).astype(np.int32)
    h, s, v = hsv[..., 0] * 2, hsv[..., 1], hsv[..., 2]
    R, G, B = [img[..., i].astype(np.int32) for i in range(3)]
    dirt = (h >= 22) & (h <= 50) & (v >= 150) & (s >= 60)
    grass = (h > 50) & (h <= 95) & (v >= 150) & (s >= 90)
    wood = (h >= 14) & (h < 40) & (v >= 110) & (v < 225) & (s >= 70) & (R - B > 60)
    water = (B > R + 30) & (B > G - 10)
    grey = (s < 70) & (v < 170)
    dark = v < 120
    ground = (dirt | grass | wood) & ~water & ~grey & ~dark
    return ground.astype(np.float32)


def main(key, overlay=None):
    cfg = FIELDS[key]
    rgb = np.array(Image.open(os.path.join(ROOT, cfg['src'])).convert('RGB'))
    H, W = rgb.shape[:2]
    cols, rows = cfg['cols'], cfg['rows']
    g = {'autumn': classify_autumn, 'ash': classify_ash}.get(cfg.get('classify'), classify)(rgb)
    share = cv2.resize(g, (cols, rows), interpolation=cv2.INTER_AREA)
    # the middle of a tile is where the feet are; weigh it over the corners
    core = np.zeros((rows, cols), np.float32)
    tw, th = W / cols, H / rows
    for y in range(rows):
        for x in range(cols):
            y0, y1 = int((y + 0.2) * th), int((y + 0.8) * th)
            x0, x1 = int((x + 0.2) * tw), int((x + 0.8) * tw)
            core[y, x] = g[y0:y1, x0:x1].mean()
    open_ = (share * 0.4 + core * 0.6) >= 0.55
    if cfg.get('close_gaps'):
        # a path painted narrow, or shaded by a tree beside it, comes out
        # broken by a tile here and there: close those one-tile gaps where the
        # tile has some ground in it
        closed = cv2.morphologyEx(open_.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)) > 0
        open_ |= closed & ((share * 0.4 + core * 0.6) >= cfg['close_gaps'])
    if cfg.get('bridge_gaps'):
        img = cv2.GaussianBlur(rgb, (0, 0), 1.2)
        hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV).astype(np.int32)
        lava = ((hsv[..., 1] > 150) & (hsv[..., 2] > 140)) | ((hsv[..., 0] * 2 < 25) & (hsv[..., 1] > 120) & (hsv[..., 2] > 110))
        lava_share = cv2.resize(lava.astype(np.float32), (cols, rows), interpolation=cv2.INTER_AREA)
        # and the black rock: a stair or bridge is grey stone, lighter than it
        dark_share = cv2.resize((hsv[..., 2] < 85).astype(np.float32), (cols, rows), interpolation=cv2.INTER_AREA)
        span = (lava_share < 0.3) & (dark_share < 0.4)
        k = cfg['bridge_gaps']
        for _ in range(2):
            for ker in (np.ones((1, k), np.uint8), np.ones((k, 1), np.uint8)):
                closed = cv2.morphologyEx(open_.astype(np.uint8), cv2.MORPH_CLOSE, ker) > 0
                open_ |= closed & span
    for x, y, w, h in cfg['force_open']:
        open_[y:y + h, x:x + w] = True
    if cfg.get('lava_after'):
        open_ &= lava_share < cfg['lava_after']
        for x, y, w, h in cfg.get('force_after', []):
            open_[y:y + h, x:x + w] = True
    for x, y, w, h in cfg['force_block']:
        open_[y:y + h, x:x + w] = False
    # keep only the ground joined to where people arrive
    sx, sy = cfg['seed']
    seen = np.zeros_like(open_)
    q = deque([(sx, sy)])
    seen[sy, sx] = True
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < cols and 0 <= ny < rows and open_[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((nx, ny))
    lines = [''.join('.' if seen[y, x] else '#' for x in range(cols)) for y in range(rows)]
    const = key.upper() + '_OBSTACLES'
    with open(os.path.join(ROOT, f'shared/data/{key}-obstacles.js'), 'w') as fp:
        fp.write(f'// Generated by tools/trace-field.py from {cfg["src"]} - do not edit by hand.\n')
        fp.write("// One string per map row; '#' is a tile nobody may stand on.\n")
        fp.write(f'export const {const} = [\n')
        for ln in lines:
            fp.write(f"  '{ln}',\n")
        fp.write('];\n')
    bk = Image.fromarray(rgb)
    if cfg.get('backdrop_scale'):
        bk = bk.resize((round(W * cfg['backdrop_scale']), round(H * cfg['backdrop_scale'])), Image.LANCZOS)
    bk.save(os.path.join(ROOT, f'assets/maps/{key}.webp'), 'WEBP', quality=90, method=6)
    if overlay:
        k = 2 if W < 2000 else 1
        ov = Image.fromarray(rgb).resize((W * k, H * k), Image.LANCZOS).convert('RGBA')
        lay = np.zeros((rows, cols, 4), np.uint8)
        lay[~open_] = (0, 0, 0, 150)               # blocked by what is painted there
        lay[open_ & ~seen] = (255, 0, 0, 130)      # ground, but cut off from the rest
        lay = Image.fromarray(lay).resize((W * k, H * k), Image.NEAREST)
        ov.alpha_composite(lay)
        from PIL import ImageDraw
        d = ImageDraw.Draw(ov)
        for x in range(cols + 1):
            X = round(x * tw * k)
            d.line([(X, 0), (X, H * k)], fill=(255, 255, 255, 90) if x % 5 else (255, 255, 0, 200))
            if x % 5 == 0 and x < cols:
                d.text((X + 2, 2), str(x), fill=(255, 255, 0))
        for y in range(rows + 1):
            Y = round(y * th * k)
            d.line([(0, Y), (W * k, Y)], fill=(255, 255, 255, 90) if y % 5 else (255, 255, 0, 200))
            if y % 5 == 0 and y < rows:
                d.text((2, Y + 2), str(y), fill=(255, 255, 0))
        ov.convert('RGB').save(overlay)
    print(key, int(seen.sum()), 'open tiles of', cols * rows)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
