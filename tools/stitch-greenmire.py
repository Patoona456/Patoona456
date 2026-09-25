#!/usr/bin/env python3
"""Greenmire's ground, stitched from its full picture and six close-ups.

    python3 tools/stitch-greenmire.py

The picture (assets/maps/source/greenmire2/full.png, 1536x1024) is cropped to
the map (below its title bar, and to 3:2 so a tile is square) and rebuilt at
twice the size from the close-ups (zoom1-6.png) by tools/stitch-map.py.
Where each close-up sits was found by feature matching and refined with ECC;
the matrices below map close-up pixels to pixels of the cropped map, with how
well each fits (a redrawn close-up that strays from the map counts for less;
zoom3 strays too far and is left out). The white warp marks are painted out.
Writes assets/maps/source/greenmire2/stitched.png (2928x1952: 90x60 tiles of
32.5px), which tools/trace-field.py then traces.
"""
import importlib.util
import os
import numpy as np

ROOT = os.path.join(os.path.dirname(__file__), '..')
spec = importlib.util.spec_from_file_location('stitch', os.path.join(ROOT, 'tools/stitch-map.py'))
stitch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stitch)

CROP = (36, 48, 1500, 1024)       # x0, y0, x1, y1 of the map in full.png
ZOOMS = {
    1: ([[0.576705, -0.002977, -32.452], [-0.001316, 0.576601, 355.678]], 0.97),
    2: ([[0.480058, -0.000488, 893.625], [-0.001672, 0.465899, 0.824]], 0.89),
    4: ([[0.598977, -0.000731, 345.284], [-0.003773, 0.514862, -14.429]], 0.81),
    5: ([[0.449262, -0.000851, -35.054], [-0.000448, 0.451697, 1.216]], 0.96),
    6: ([[0.551337, 0.006645, 379.792], [-0.000711, 0.502266, 387.414]], 0.82),
}
# the white marks, in stitched pixels: x, y, radius
MARKS = [(151, 159, 24), (1445, 24, 24), (2883, 161, 24), (1464, 1825, 24)]

if __name__ == '__main__':
    src = os.path.join(ROOT, 'assets/maps/source/greenmire2')
    t = {i: (np.array(M, np.float32), q) for i, (M, q) in ZOOMS.items()}
    stitch.main(src, t, os.path.join(src, 'stitched.png'), CROP, erase=MARKS)
    print('stitched', src + '/stitched.png')
