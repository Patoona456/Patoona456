#!/usr/bin/env python3
"""
Turn a loose chibi walk board into a sheet the game can index.

    python3 tools/slice-chibi.py assets/chibi/source/hero_brown.png assets/chibi/body/hero_brown.png

The board is two bands of four groups, four walk frames per group, laid out
by eye rather than on a grid. Frames are found by their opaque pixels, then
each is pasted into a fixed 128x192 cell with its feet on one baseline, so
the walk does not bob by however much the artist's spacing drifted.

Output: 4 columns (walk frames) x 8 rows, rows in DIR8 order
(down, downleft, left, upleft, up, upright, right, downright).
Needs Pillow.
"""
import sys
from PIL import Image

CELL_W, CELL_H, BASELINE = 128, 192, 184
# (band, group) for each DIR8 row, read off the board
DIR_SOURCE = [(0, 0), (1, 0), (0, 1), (1, 1), (0, 2), (1, 2), (0, 3), (1, 3)]


def runs(flags):
    out, start = [], None
    for i, on in enumerate(list(flags) + [False]):
        if on and start is None:
            start = i
        if not on and start is not None:
            out.append((start, i - 1))
            start = None
    return out


def main(src, dst):
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    px = im.load()
    # faint edge noise from background removal: drop it before measuring
    for y in range(h):
        for x in range(w):
            if px[x, y][3] < 40:
                px[x, y] = (0, 0, 0, 0)

    solid = lambda x, y: px[x, y][3] > 128
    bands = runs(any(solid(x, y) for x in range(w)) for y in range(h))
    if len(bands) != 2:
        sys.exit(f'expected 2 bands of sprites, found {len(bands)}')

    frames = []  # frames[band] = list of 16 boxes
    for y0, y1 in bands:
        cols = runs(any(solid(x, y) for y in range(y0, y1 + 1)) for x in range(w))
        if len(cols) != 16:
            sys.exit(f'expected 16 frames in band {y0}-{y1}, found {len(cols)}')
        boxes = []
        for x0, x1 in cols:
            ys = [y for y in range(y0, y1 + 1) if any(solid(x, y) for x in range(x0, x1 + 1))]
            boxes.append((x0, ys[0], x1, ys[-1]))
        frames.append(boxes)

    out = Image.new('RGBA', (CELL_W * 4, CELL_H * 8), (0, 0, 0, 0))
    pad = 4
    for row, (band, group) in enumerate(DIR_SOURCE):
        for f in range(4):
            x0, y0, x1, y1 = frames[band][group * 4 + f]
            crop = im.crop((x0 - pad, y0 - pad, x1 + pad + 1, y1 + pad + 1))
            cx = f * CELL_W + (CELL_W - crop.width) // 2
            cy = row * CELL_H + BASELINE - (crop.height - pad)
            out.alpha_composite(crop, (cx, max(row * CELL_H, cy)))
    out.save(dst, optimize=True)
    print(f'{dst}: {out.width}x{out.height}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
