#!/usr/bin/env python3
"""Cuts the HUD pieces out of the painted UI sheet (assets/ui/source/hud_sheet.png).

    python3 tools/slice-ui.py

The sheet is one flat picture on a blurred backdrop, so every piece is lifted
out with GrabCut (seeded from a box around it) and saved with alpha to
assets/ui/. Text baked into a piece ("9999", "Prontera", "99") is painted
over so the game can write its own.
"""
import os
import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets/ui/source/hud_sheet.png')
OUT = os.path.join(ROOT, 'assets/ui')
sheet = cv2.imread(SRC)


def grab(box, pad=6, iters=6, fill_holes=True, img=None):
    img = sheet if img is None else img
    x0, y0, x1, y1 = box
    X0, Y0 = max(0, x0 - pad), max(0, y0 - pad)
    X1, Y1 = min(img.shape[1], x1 + pad), min(img.shape[0], y1 + pad)
    sub = img[Y0:Y1, X0:X1].copy()
    mask = np.zeros(sub.shape[:2], np.uint8)
    bg, fg = np.zeros((1, 65)), np.zeros((1, 65))
    cv2.grabCut(sub, mask, (x0 - X0, y0 - Y0, x1 - x0, y1 - y0), bg, fg, iters, cv2.GC_INIT_WITH_RECT)
    m = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    if n > 1:
        m = np.where(lab == 1 + np.argmax(st[1:, 4]), 255, 0).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    if fill_holes:
        ff = m.copy()
        cv2.floodFill(ff, np.zeros((m.shape[0] + 2, m.shape[1] + 2), np.uint8), (0, 0), 255)
        m = m | cv2.bitwise_not(ff)
    m = cv2.GaussianBlur(m, (3, 3), 0)
    rgba = cv2.cvtColor(sub, cv2.COLOR_BGR2RGBA)
    rgba[:, :, 3] = m
    return trim(rgba), (X0, Y0)


def trim(rgba):
    ys, xs = np.nonzero(rgba[:, :, 3] > 8)
    return rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def save(name, rgba, scale=1.0):
    im = Image.fromarray(rgba)
    if scale != 1.0:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=92, method=6)


def erase_text(img, box, thresh=150):
    """Inpaint bright lettering inside box on a copy of the sheet."""
    out = img.copy()
    x0, y0, x1, y1 = box
    region = out[y0:y1, x0:x1]
    m = (region.min(axis=2) > thresh).astype(np.uint8) * 255
    m = cv2.dilate(m, np.ones((5, 5), np.uint8))
    out[y0:y1, x0:x1] = cv2.inpaint(region, m, 5, cv2.INPAINT_TELEA)
    return out


# ---- menu rail icons (panel id -> box) ----
MENU = {
    'character': (880, 103, 944, 172), 'inventory': (797, 103, 865, 172),
    'quests': (716, 105, 786, 170), 'settings': (1165, 105, 1230, 170),
    'skills': (1443, 462, 1510, 522), 'stall': (1443, 283, 1512, 347),
    'party': (1445, 625, 1510, 675), 'guild': (1447, 703, 1507, 762),
}
for k, b in MENU.items():
    save('menu_' + k, grab(b)[0])

# ---- wallet, badges and big words ----
for k, b in {
    'coin': (458, 17, 500, 58), 'gem_blue': (675, 18, 717, 56), 'gem_red': (866, 18, 905, 57),
    'boss': (17, 842, 95, 893), 'levelup': (462, 826, 680, 906), 'questclear': (700, 813, 858, 898),
    'miss': (874, 828, 963, 882), 'critical': (980, 806, 1114, 880),
    'auto': (1004, 379, 1123, 501), 'knob': (959, 689, 1071, 798),
    'slot': (905, 276, 963, 335), 'on': (1234, 404, 1302, 454),
}.items():
    save(k, grab(b)[0])

# ---- portrait ring: an empty gold circle, hollow in the middle ----
crop = sheet[164:268, 98:198]
mm = np.zeros(crop.shape[:2], np.uint8)
cv2.grabCut(crop.copy(), mm, (6, 6, 88, 92), np.zeros((1, 65)), np.zeros((1, 65)), 6, cv2.GC_INIT_WITH_RECT)
band = np.where((mm == 1) | (mm == 3), 255, 0).astype(np.uint8)
yy, xx = np.mgrid[0:crop.shape[0], 0:crop.shape[1]]
band[np.hypot(xx - 50, yy - 50.5) < 35.5] = 0
sub = cv2.cvtColor(crop, cv2.COLOR_BGR2RGBA)
sub[:, :, 3] = cv2.GaussianBlur(band, (3, 3), 0)
save('ring', trim(sub))

# ---- minimap ring: punch the painted map out, clear the name plate ----
# The painted map is first flooded dark so GrabCut reads the whole disc as
# part of the frame; the hole is cut afterwards.
MX, MY, MCX, MCY, MR = 1256, 2, 1387, 137, 98.5
mimg = erase_text(sheet, (1318, 203, 1462, 250), thresh=120)
crop = mimg[MY:266, MX:1534].copy()
yy, xx = np.mgrid[0:crop.shape[0], 0:crop.shape[1]]
hole = (np.hypot(xx - (MCX - MX), yy - (MCY - MY)) < MR) & (yy < 199 - MY)
crop[hole] = (30, 28, 26)
mm = np.zeros(crop.shape[:2], np.uint8)
cv2.grabCut(crop, mm, (4, 4, crop.shape[1] - 8, crop.shape[0] - 8), np.zeros((1, 65)), np.zeros((1, 65)), 8, cv2.GC_INIT_WITH_RECT)
a = np.where((mm == 1) | (mm == 3), 255, 0).astype(np.uint8)
ff = a.copy()
cv2.floodFill(ff, np.zeros((a.shape[0] + 2, a.shape[1] + 2), np.uint8), (0, 0), 255)
a = a | cv2.bitwise_not(ff)
a[hole] = 0
full = cv2.cvtColor(crop, cv2.COLOR_BGR2RGBA)
full[:, :, 3] = cv2.GaussianBlur(a, (3, 3), 0)
full[203 - MY:249 - MY, 1316 - MX:1464 - MX, :3] = (26, 25, 24)
save('minimap', full)
print('minimap', full.shape[1], 'x', full.shape[0], 'hole', MCX - MX, MCY - MY, MR)

# ---- window frame (empty ornate dark panel) and the menu rail ----
save('frame', grab((455, 588, 778, 668))[0])
rail, _ = grab((1424, 273, 1533, 993))
rh, rw = rail.shape[:2]
body = rail[rh // 2, rw // 2, :3].copy()
rail[24:rh - 24, 12:rw - 12, :3] = np.median(rail[40:60, 14:18, :3].reshape(-1, 3), axis=0)
save('rail', rail)

# ---- skill art: the painted square without its gold frame ----
SKILL = {
    'fire': (335, 275, 420, 361), 'storm': (427, 275, 512, 361), 'frost': (519, 275, 604, 361),
    'heal': (610, 275, 695, 361), 'light': (702, 275, 787, 361), 'debuff': (796, 275, 881, 361),
    'slash': (334, 377, 419, 463), 'aoe': (427, 377, 512, 463), 'pierce': (519, 377, 604, 463),
    'guard': (612, 377, 697, 463), 'dash': (707, 377, 792, 463), 'summon': (800, 377, 885, 463),
}
for k, b in SKILL.items():
    tile, _ = grab(b, pad=4)
    h, w = tile.shape[:2]
    i = max(6, round(w * 0.085))
    art = cv2.cvtColor(tile[i:h - i, i:w - i], cv2.COLOR_RGBA2RGB)
    art = cv2.resize(art, (64, 64), interpolation=cv2.INTER_LANCZOS4)
    Image.fromarray(art).save(os.path.join(OUT, 'skill_' + k + '.webp'), 'WEBP', quality=92)

# ---- item art: the object only, with the stack count painted out ----
ITEM = {
    'potion': (335, 485, 408, 560), 'mana': (415, 485, 488, 560), 'antidote': (495, 485, 568, 560),
    'food': (575, 485, 648, 560), 'scroll': (655, 485, 728, 560), 'feather': (735, 485, 808, 560),
    'orb': (815, 485, 888, 560),
}
for k, (x0, y0, x1, y1) in ITEM.items():
    clean = erase_text(sheet, (x0 + 36, y0 + 44, x1 - 3, y1 - 3), thresh=175)
    obj, _ = grab((x0 + 8, y0 + 7, x1 - 8, y1 - 8), pad=4, img=clean)
    save('item_' + k, obj)
print('done')
