#!/usr/bin/env python3
"""Cut the lava sheets into one atlas, assets/fx/lava.webp.

    python3 tools/slice-lava.py

assets/fx/source/lava-a.png and lava-b.png are four rows of eight frames on a
clear ground (a lava river, a lava fall, a bubbling pool, an eruption; the
second sheet's last row is a field of sparks). Each row's frames are found by
the clear columns between them, stood on a common cell (bottom-centre) and
scaled down, and the painter's red matte is dropped from their soft edges.
The pieces the game plays (client/js/ambient.js, LavaFx):

  flow    a lava texture, mirrored into a seamless 256px tile, slid over the
          painting's lava
  fall    the lava fall, the rock round it taken off, poured over a painted fall
  burst   an eruption, played now and then out of the lava
  spark   the sparks, twinkling on the lava
"""
import json
import os

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets/fx/source')
OUT = os.path.join(ROOT, 'assets/fx/lava.webp')


def load(name):
    a = np.array(Image.open(os.path.join(SRC, name)).convert('RGBA')).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3]
    # the red matte in the half-clear edges: pure red, faint
    red = (rgb[..., 0] > 150) & (rgb[..., 1] < 70) & (rgb[..., 2] < 70)
    al = np.where(red & (al < 250), 0, al)
    a[..., 3] = al
    return a.clip(0, 255).astype(np.uint8)


def runs(v, mn):
    out, s = [], None
    for i, c in enumerate(v):
        if c and s is None:
            s = i
        if not c and s is not None:
            if i - s >= mn:
                out.append((s, i))
            s = None
    if s is not None and len(v) - s >= mn:
        out.append((s, len(v)))
    return out


def row_frames(a, band, n=8):
    y0, y1 = band
    al = a[y0:y1, :, 3] > 60
    cols = runs(al.sum(0) > 2, 30)
    if len(cols) != n:
        # the glow runs frame into frame: the eight stand in equal columns
        xs = np.nonzero(al.any(0))[0]
        step = (xs[-1] + 1 - xs[0]) / n
        cols = [(round(xs[0] + i * step), round(xs[0] + (i + 1) * step)) for i in range(n)]
    out = []
    for x0, x1 in cols:
        piece = a[y0:y1, x0:x1]
        ys = np.nonzero((piece[..., 3] > 60).any(1))[0]
        out.append(piece[ys[0]:ys[-1] + 1])
    return out


def cell(frames, h):
    """Every frame on one cell, bottom-centre, `h` px tall."""
    W = max(f.shape[1] for f in frames)
    H = max(f.shape[0] for f in frames)
    k = h / H
    cw, ch = round(W * k), h
    outs = []
    for f in frames:
        c = np.zeros((H, W, 4), np.uint8)
        x = (W - f.shape[1]) // 2
        c[H - f.shape[0]:, x:x + f.shape[1]] = f
        pm = c.astype(np.float32)
        pm[..., :3] *= pm[..., 3:4] / 255
        pm = cv2.resize(pm, (cw, ch), interpolation=cv2.INTER_AREA)
        al = pm[..., 3:4]
        pm[..., :3] = np.where(al > 0, pm[..., :3] * 255 / np.maximum(al, 1e-3), 0)
        outs.append(pm.clip(0, 255).astype(np.uint8))
    return outs, (cw, ch)


def lava_only(f):
    """The fall without its rock: only what glows (bright and warm)."""
    rgb = f[..., :3].astype(np.float32)
    lum = rgb @ np.float32([0.3, 0.59, 0.11])
    warm = rgb[..., 0] - rgb[..., 2]
    k = np.clip((lum - 110) / 70, 0, 1) * np.clip((warm - 60) / 60, 0, 1)
    g = f.copy()
    g[..., 3] = (f[..., 3] * k).astype(np.uint8)
    return g


def main():
    a, b = load('lava-a.png'), load('lava-b.png')
    ra = [(17, 289), (323, 611), (636, 846), (866, 1049)]
    rb = [(17, 293), (317, 562), (592, 796), (833, 1054)]
    falls, fall_cell = cell([lava_only(f) for f in row_frames(a, ra[1])], 180)
    bursts, burst_cell = cell(row_frames(a, ra[3]), 120)
    sparks, spark_cell = cell(row_frames(b, rb[3]), 120)
    # the flow: the middle of a pool frame, all lava, mirrored four ways so it tiles
    pool = row_frames(a, ra[2])[0]
    ph, pw = pool.shape[:2]
    s = min(ph, pw) // 3
    core = pool[ph // 2 - s // 2:ph // 2 + s // 2, pw // 2 - s // 2:pw // 2 + s // 2, :3]
    core = cv2.resize(core, (128, 128), interpolation=cv2.INTER_AREA)
    tile = np.vstack([np.hstack([core, core[:, ::-1]]), np.hstack([core[::-1], core[::-1, ::-1]])])
    tile = np.dstack([tile, np.full(tile.shape[:2], 255, np.uint8)])

    strips = [('flow', [tile], (256, 256)), ('fall', falls, fall_cell), ('burst', bursts, burst_cell), ('spark', sparks, spark_cell)]
    W = max(len(fs) * c[0] for _, fs, c in strips)
    H = sum(c[1] for _, _, c in strips)
    atlas = np.zeros((H, W, 4), np.uint8)
    y, table = 0, {}
    for name, fs, (cw, ch) in strips:
        for i, f in enumerate(fs):
            atlas[y:y + ch, i * cw:i * cw + cw] = f
        table[name] = {'at': [0, y], 'cell': [cw, ch], 'frames': len(fs)}
        y += ch
    Image.fromarray(atlas).save(OUT, 'WEBP', quality=88, method=6)
    print('lava.webp', atlas.shape[1], 'x', atlas.shape[0])
    print('const LAVA_ATLAS =', json.dumps(table))


if __name__ == '__main__':
    main()
