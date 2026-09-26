#!/usr/bin/env python3
"""The castle hall and the dressing it is given, as one picture.

    python3 tools/build-castle.py

assets/maps/castle.webp holds the painted hall (assets/maps/source/castle/
hall.png, 1536x1024, one world px a pixel: 48x32 tiles) with the pieces cut
from decor-sheet.png packed in a row underneath. The map draws the top as its
floor and each piece from its `crop` (see the castle in shared/data/maps.js);
one file, because the demo counts its files. The minimap reads only the top.
"""
import os

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = 'assets/maps/source/castle/'
# name: x, y, w, h on the decor sheet
PIECES = {
    'rack': (1116, 689, 102, 96),       # spears in a stand
    'table': (1090, 801, 132, 98),      # swords laid out on a draped table
    'shelf': (1389, 926, 124, 82),      # a bookcase
    'rug_blue': (646, 796, 141, 158),   # the royal rug
    'rug_red': (866, 858, 149, 84),     # a red rug (its top edge sits under candlesticks on the sheet: left off)
}


def main():
    hall = Image.open(os.path.join(ROOT, SRC, 'hall.png')).convert('RGBA')
    sheet = Image.open(os.path.join(ROOT, SRC, 'decor-sheet.png')).convert('RGBA')
    W, H = hall.size
    row = max(h for _, _, _, h in PIECES.values())
    out = Image.new('RGBA', (W, H + row))
    out.alpha_composite(hall, (0, 0))
    x = 0
    for name, (sx, sy, w, h) in PIECES.items():
        piece = np.array(sheet.crop((sx, sy, sx + w, sy + h)))
        piece[..., 3] = np.where(piece[..., 3] < 60, 0, piece[..., 3])   # the sheet's faint glow would show as a box
        out.alpha_composite(Image.fromarray(piece), (x, H))
        print(f"{name}: crop [{x}, {H}, {w}, {h}]")
        x += w + 4
    out.save(os.path.join(ROOT, 'assets/maps/castle.webp'), 'WEBP', quality=90, method=6)
    print('castle.webp', out.size)


if __name__ == '__main__':
    main()
