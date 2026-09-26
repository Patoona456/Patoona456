#!/usr/bin/env python3
"""
Lift a drop sheet painted over a backdrop (no transparency) off it, for
tools/slice-drops.py, which finds every piece by its transparency.

    pip install rembg onnxruntime      # once; the model downloads on first use
    python3 tools/matte-drops.py autumn_slime

Reads assets/ui/source/painted/<key>_drops.png and writes
assets/ui/source/<key>_drops.png. The backdrop is a glowing gradient much the
colour of the loot, with beams of light over each falling frame, so no colour
key parts them: each box below is handed on its own to a background-removal
model (BiRefNet), which keeps the loot and drops the beams. A box marked `glow`
(the pick-up's closing sparkle, a white star on a pale ground, which the model
takes for background) is lifted by its brightness instead.
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')

def frames(y0, y1, *xs):
    """A row of frames, each its own box between the given columns (the model
    loses a frame among its neighbours, or takes a faint one for backdrop)."""
    return [(a, y0, b, y1) for a, b in zip(xs, xs[1:])]


# per sheet: boxes (x0, y0, x1, y1[, 'glow']) holding the pieces
DROP_X = (222, 300, 385, 468, 552, 645, 748)
GROUND_X = (755, 855, 955, 1060, 1165)
PICKUP_X = (1172, 1263, 1354, 1445)
SHEETS = {
    'autumn_slime': [
        # per item: its portrait (above its name plate), its fall, lying on
        # the ground, its pick-up, and the sparkle closing the pick-up
        (40, 25, 200, 140), *frames(85, 245, *DROP_X), *frames(130, 240, *GROUND_X), *frames(100, 245, *PICKUP_X),
        (1440, 140, 1530, 240, 'glow'),
        (22, 262, 212, 395), *frames(330, 490, *DROP_X), *frames(380, 485, *GROUND_X), *frames(340, 490, *PICKUP_X),
        (1440, 385, 1530, 485, 'glow'),
        (56, 505, 190, 650), *frames(580, 745, *DROP_X), *frames(610, 725, *GROUND_X), *frames(595, 745, *PICKUP_X),
        (1440, 625, 1530, 725, 'glow'),
    ],
}


def main(key):
    from rembg import new_session, remove
    src = Image.open(os.path.join(ROOT, f'assets/ui/source/painted/{key}_drops.png')).convert('RGB')
    out = Image.new('RGBA', src.size, (0, 0, 0, 0))
    session = new_session('birefnet-general-lite')
    for x0, y0, x1, y1, *kind in SHEETS[key]:
        box = src.crop((x0, y0, x1, y1))
        if kind == ['glow']:
            a = np.asarray(box, np.float32)
            lum = a.min(2)                   # white, not just bright yellow
            alpha = np.clip((lum - 150) / 90, 0, 1) * 255
            piece = Image.fromarray(np.dstack([a, alpha]).astype(np.uint8), 'RGBA')
        else:
            piece = remove(box, session=session)
            # where the model is unsure it goes see-through: firm that up,
            # and drop the faint wisps of backdrop it half keeps
            a = np.asarray(piece).copy()
            a[..., 3] = (np.clip((a[..., 3].astype(np.float32) - 45) / 105, 0, 1) * 255).astype(np.uint8)
            piece = Image.fromarray(a, 'RGBA')
        out.alpha_composite(piece, (x0, y0))
    dst = os.path.join(ROOT, f'assets/ui/source/{key}_drops.png')
    out.save(dst)
    print('->', dst)


if __name__ == '__main__':
    main(sys.argv[1])
