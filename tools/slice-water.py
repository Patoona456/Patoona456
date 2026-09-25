#!/usr/bin/env python3
"""Cut the water sheet into the pieces the renderer animates over a painted map.

    python3 tools/slice-water.py

All in one atlas, assets/fx/water.webp (the layout is ATLAS in
client/js/water.js), from assets/fx/source/water-sheet.png (1536x1024,
transparent ground) and water-sparkle-sheet.png:
  caustic   256x256 at (0, 0): the light on the water, from the nine surface
            patches, stamped round a torus so it repeats without a seam
  curtain   at (256, 0): falling streaks from the widest curtain, cut so the
            bottom runs on into the top - scrolled down over a painted fall
  splash    a strip at (0, 256): the seven splashes where a fall lands
  bubbles   a strip under it: the seven bubble puffs
  sparkle   under that: four rows of eight twinkles (stars, a net of light,
            long glints, another net), light only, lifted off the sheet's blue
And for each map listed in MAPS, the map's water as a mask:
  assets/maps/<id>/water.webp   quarter size, white where the painting is water
"""
import os

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SHEET = 'assets/fx/source/water-sheet.png'
OUT = 'assets/fx'

CURTAIN = (226, 412, 468, 568)     # x0, x1, y0, y1: the streaks of the wide curtain, lip and foam left out
CURTAIN_H = 76                     # the height that repeats; the rest is blended into its top
SPLASH = [(9, 154), (168, 309), (323, 468), (483, 624), (642, 781), (802, 928), (952, 1077)]
SPLASH_Y = (606, 720)
BUBBLES = [(1104, 1152), (1160, 1215), (1236, 1284), (1294, 1346), (1354, 1408), (1412, 1462), (1468, 1512)]
BUBBLES_Y = (606, 720)
PATCHES = [(11, 174), (183, 334), (343, 494), (503, 659), (670, 826), (835, 991), (1001, 1155), (1165, 1326), (1338, 1521)]
PATCH_Y = (735, 815)
CAUSTIC = 256
SPARKLE_SHEET = 'assets/fx/source/water-sparkle-sheet.png'
SPARKLE_X = [120 + 185 * i for i in range(8)]     # frame centres, left to right
SPARKLE_Y = [160, 399, 632, 873]                   # row centres
SPARKLE_CELL = (184, 150)

MAPS = {'greenmire': 'assets/maps/source/greenmire2/stitched.png'}


def strip(sheet, boxes, y0, y1):
    """Equal cells, each piece centred at the bottom: one row the renderer steps through."""
    w = max(b - a for a, b in boxes)
    out = Image.new('RGBA', (w * len(boxes), y1 - y0))
    for i, (a, b) in enumerate(boxes):
        out.alpha_composite(sheet.crop((a, y0, b, y1)), (i * w + (w - (b - a)) // 2, 0))
    return out, w


def curtain(sheet):
    x0, x1, y0, y1 = CURTAIN
    band = np.array(sheet.crop((x0, y0, x1, y1))).astype(np.float32)
    # The streaks run straight down, so each column's average is the curtain
    # and what is left over is its grain. Only the grain is blended where the
    # repeat joins: blending the whole picture washes a pale band into it.
    col = band.mean(0, keepdims=True)
    grain = band - col
    H, B = CURTAIN_H, band.shape[0] - CURTAIN_H
    g = grain[:H].copy()
    for i in range(B):                       # the tail fades into the head, so row H-1 meets row 0
        k = i / B
        w = np.sqrt(k * k + (1 - k) * (1 - k))   # two blended grains are fainter: lift them back
        g[i] = (grain[i] * k + grain[H + i] * (1 - k)) / w
    out = np.repeat(col, H, 0) + g
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def caustic(sheet):
    """Just the bright threads of light on the surface patches, repeated without a seam."""
    rgb = np.array(sheet.convert('RGB')).astype(np.float32)
    lum = rgb.mean(2)
    glow = np.clip((lum - cv2.GaussianBlur(lum, (0, 0), 5)) * 3.2, 0, 255)
    rng = np.random.default_rng(7)
    acc = np.zeros((CAUSTIC, CAUSTIC), np.float32)
    crops = []
    for a, b in PATCHES:
        cx, cy = (a + b) // 2, (PATCH_Y[0] + PATCH_Y[1]) // 2
        crops.append(glow[cy - 22:cy + 22, cx - 48:cx + 48])   # well inside the oval
    for _ in range(90):
        c = crops[rng.integers(len(crops))]
        if rng.random() < 0.5:
            c = c[:, ::-1]
        h, w = c.shape
        # a soft-edged stamp, so no rectangle shows where it was laid
        win = np.outer(np.hanning(h), np.hanning(w)).astype(np.float32)
        x, y = rng.integers(CAUSTIC), rng.integers(CAUSTIC)
        ys = (np.arange(h) + y) % CAUSTIC
        xs = (np.arange(w) + x) % CAUSTIC
        acc[np.ix_(ys, xs)] = np.maximum(acc[np.ix_(ys, xs)], c * win)
    alpha = np.clip(acc * 1.4, 0, 255).astype(np.uint8)
    out = np.dstack([np.full_like(alpha, 225), np.full_like(alpha, 246), np.full_like(alpha, 255), alpha])
    return Image.fromarray(out)


def sparkle():
    """The light on the sheet's blue ground, lifted off it: what is brighter
    in red than the ground around it (the ground has next to none) is light."""
    rgb = np.array(Image.open(os.path.join(ROOT, SPARKLE_SHEET)).convert('RGB')).astype(np.float32)
    R = rgb[..., 0]
    light = np.clip((R - cv2.GaussianBlur(R, (0, 0), 25)) * 1.6, 0, 255)
    cw, ch = SPARKLE_CELL
    out = np.zeros((ch * len(SPARKLE_Y), cw * len(SPARKLE_X), 4), np.uint8)
    out[..., 0], out[..., 1], out[..., 2] = 235, 248, 255
    for r, cy in enumerate(SPARKLE_Y):
        for f, cx in enumerate(SPARKLE_X):
            cell = light[cy - ch // 2:cy + ch // 2, cx - cw // 2:cx + cw // 2]
            # fade the cell's edge, so a neighbour's stray glint is not cut square
            win = np.outer(np.hanning(ch) ** 0.3, np.hanning(cw) ** 0.3)
            out[r * ch:(r + 1) * ch, f * cw:(f + 1) * cw, 3] = (cell * win).astype(np.uint8)
    return Image.fromarray(out)


def water_mask(src):
    img = cv2.GaussianBlur(np.array(Image.open(src).convert('RGB')), (0, 0), 1.6)
    R, G, B = [img[..., i].astype(np.int32) for i in range(3)]
    water = ((B > R + 40) & (B > G + 5) & (B > 120)).astype(np.uint8) * 255
    water = cv2.morphologyEx(water, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    water = cv2.erode(water, np.ones((7, 7), np.uint8))     # keep off the banks
    # the blue-grey cliff stones pass the colour test in specks: only real
    # stretches of water are kept
    n, lab, stats, _ = cv2.connectedComponentsWithStats(water)
    keep = np.zeros(n, bool)
    keep[1:] = stats[1:, cv2.CC_STAT_AREA] >= 3000
    water = np.where(keep[lab], 255, 0).astype(np.uint8)
    h, w = water.shape
    small = cv2.resize(water, (w // 4, h // 4), interpolation=cv2.INTER_AREA)
    small = cv2.GaussianBlur(small, (0, 0), 1.2)
    return Image.fromarray(np.dstack([np.full_like(small, 255)] * 3 + [small]))


def main():
    sheet = Image.open(os.path.join(ROOT, SHEET)).convert('RGBA')
    save = lambda im, name: im.save(os.path.join(ROOT, OUT, name), 'WEBP', quality=90, method=6)
    c = curtain(sheet)
    s, sw = strip(sheet, SPLASH, *SPLASH_Y)
    b, bw = strip(sheet, BUBBLES, *BUBBLES_Y)
    k, sp = caustic(sheet), sparkle()
    # one atlas, one file: the demo counts its files. ATLAS in client/js/water.js must match.
    atlas = Image.new('RGBA', (max(sp.size[0], s.size[0]), 256 + s.size[1] + b.size[1] + sp.size[1]))
    atlas.alpha_composite(k, (0, 0))
    atlas.alpha_composite(c, (256, 0))
    atlas.alpha_composite(s, (0, 256))
    atlas.alpha_composite(b, (0, 256 + s.size[1]))
    atlas.alpha_composite(sp, (0, 256 + s.size[1] + b.size[1]))
    save(atlas, 'water.webp')
    print('atlas', atlas.size, 'curtain', c.size, 'splash', s.size, 'cell', sw, 'bubbles', b.size, 'cell', bw,
          'sparkle', sp.size, 'at y', 256 + s.size[1] + b.size[1])
    for key, src in MAPS.items():
        m = water_mask(os.path.join(ROOT, src))
        os.makedirs(os.path.join(ROOT, 'assets/maps', key), exist_ok=True)
        m.save(os.path.join(ROOT, 'assets/maps', key, 'water.webp'), 'WEBP', quality=85, method=6)
        print(key, 'water mask', m.size)


if __name__ == '__main__':
    main()
