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
    if not m.any():
        raise SystemExit(f'GrabCut found nothing in {box}')
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


# ============================================================================
# Second sheet: inventory / general UI (assets/ui/source/inv_sheet.png)
# ============================================================================
inv = cv2.imread(os.path.join(ROOT, 'assets/ui/source/inv_sheet.png'))

# slot frames, one per rarity
for k, b in {'common': (1035, 47, 1084, 96), 'uncommon': (1094, 47, 1143, 96), 'rare': (1155, 47, 1203, 96),
             'epic': (1214, 47, 1263, 96), 'legendary': (1274, 47, 1323, 96)}.items():
    save('slot_' + k, grab(b, pad=4, img=inv)[0])

# greyed "nothing worn here" glyphs for the paper doll, keyed off the tile
GHOST = {'head': (0, 0), 'torso': (1, 0), 'legs': (2, 0), 'hands': (0, 1), 'armor': (1, 1),
         'weapon': (2, 1), 'offhand': (0, 2), 'accessory': (1, 2), 'scarf': (2, 2)}
COLS, ROWS = [1346, 1408, 1470], [46, 108, 170, 232]
for k, (c, r) in GHOST.items():
    tile = inv[ROWS[r] + 7:ROWS[r] + 46, COLS[c] + 7:COLS[c] + 46]
    lum = cv2.cvtColor(tile, cv2.COLOR_BGR2GRAY).astype(np.float32)
    bg = np.median(np.concatenate([lum[:3].ravel(), lum[-3:].ravel()]))
    a = np.clip((lum - bg - 10) * 5, 0, 255).astype(np.uint8)
    rgba = cv2.cvtColor(tile, cv2.COLOR_BGR2RGBA)
    rgba[:, :, 3] = a
    save('ghost_' + k, trim(rgba))

# more item art (inside the rarity frames, stack counts painted out)
for k, (x0, y0, x1, y1) in {'stew': (1153, 169, 1202, 220), 'herb': (1273, 169, 1322, 220),
                            'map': (1213, 169, 1262, 220), 'crystal': (1032, 231, 1082, 282),
                            'chest': (1153, 231, 1202, 282),
                            'key': (1213, 231, 1262, 282), 'goldchest': (1273, 231, 1322, 282)}.items():
    clean = erase_text(inv, (x0 + 24, y0 + 30, x1 - 2, y1 - 2), thresh=185)
    save('item_' + k, grab((x0 + 7, y0 + 6, x1 - 7, y1 - 7), pad=3, img=clean)[0])

# status icons
for k, b in {'st_sword': (891, 873, 919, 902), 'st_shield': (921, 873, 949, 902), 'st_heart': (951, 873, 980, 902),
             'st_plus': (982, 873, 1010, 902), 'st_wing': (1013, 873, 1042, 902), 'st_skull': (891, 906, 918, 936),
             'st_sleep': (921, 906, 950, 936), 'st_fire': (952, 906, 980, 936), 'st_frost': (983, 906, 1011, 936),
             'st_bolt': (1015, 906, 1042, 936)}.items():
    save(k, grab(b, pad=4, img=inv)[0])

# gold digits 0-9: keep the lit glyph and a thin dark rim, drop the tile
DIGIT_X = [(665, 678), (688, 696), (708, 719), (731, 742), (753, 765), (776, 787), (797, 810),
           (820, 831), (842, 854), (864, 877)]   # lit columns of each numeral, measured
for i, (gx0, gx1) in enumerate(DIGIT_X):
    tile = inv[976:1010, gx0 - 4:gx1 + 5]
    hsv = cv2.cvtColor(tile, cv2.COLOR_BGR2HSV)
    glyph = ((hsv[:, :, 2] > 150)).astype(np.uint8) * 255
    n, lab, st, _ = cv2.connectedComponentsWithStats(glyph)
    if n > 1:  # the numeral is the biggest bright blob; tile highlights are specks
        big = 1 + np.argmax(st[1:, 4])
        glyph = np.where(lab == big, 255, 0).astype(np.uint8)
        # holes of 0/4/6/8/9 are inside the blob's box - keep other bright bits there
    rim = cv2.dilate(glyph, np.ones((5, 5), np.uint8))
    rgba = cv2.cvtColor(tile, cv2.COLOR_BGR2RGBA)
    rgba[:, :, :3] = np.where(glyph[..., None] > 0, rgba[:, :, :3], (40, 22, 8))
    rgba[:, :, 3] = cv2.GaussianBlur(rim, (3, 3), 0)
    save(f'digit_{i}', trim(rgba))

# notice banners (toasts): caps from the sheet, the lettered middle rebuilt
# from a clean column so the game can write its own line
for k, (y0, y1) in {'blue': (684, 722), 'green': (718, 756), 'purple': (751, 790)}.items():
    left, mid, right = inv[y0:y1, 286:336], inv[y0:y1, 468:474], inv[y0:y1, 536:576]
    strip = np.concatenate([left] + [mid] * 10 + [right], axis=1)
    mm = np.zeros(strip.shape[:2], np.uint8)
    cv2.grabCut(strip.copy(), mm, (7, 3, strip.shape[1] - 14, strip.shape[0] - 6),
                np.zeros((1, 65)), np.zeros((1, 65)), 6, cv2.GC_INIT_WITH_RECT)
    a = np.where((mm == 1) | (mm == 3), 255, 0).astype(np.uint8)
    ff = a.copy()
    cv2.floodFill(ff, np.zeros((a.shape[0] + 2, a.shape[1] + 2), np.uint8), (0, 0), 255)
    a = a | cv2.bitwise_not(ff)
    rgba = cv2.cvtColor(strip, cv2.COLOR_BGR2RGBA)
    rgba[:, :, 3] = cv2.GaussianBlur(a, (3, 3), 0)
    save('notice_' + k, trim(rgba))

# plain button faces, and the four item buttons whose words match ours
for k, b in {'btn_dark': (194, 981, 230, 1006), 'btn_blue': (237, 981, 273, 1006),
             'btn_green': (281, 981, 317, 1006), 'btn_red': (325, 981, 362, 1006)}.items():
    save(k, grab(b, pad=4, img=inv)[0])
# the item buttons are plain rounded squares, so a drawn mask beats GrabCut
for k, (x0, y0, x1, y1) in {'act_use': (1248, 339, 1311, 401), 'act_equip': (1321, 339, 1385, 401),
                            'act_unequip': (1395, 339, 1459, 401), 'act_drop': (1466, 339, 1530, 401)}.items():
    w, h = x1 - x0, y1 - y0
    m = np.zeros((h * 4, w * 4), np.uint8)
    cv2.rectangle(m, (28, 28), (w * 4 - 29, h * 4 - 29), 255, -1)
    m = cv2.GaussianBlur(cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (48, 48))), (5, 5), 0)
    rgba = cv2.cvtColor(inv[y0:y1, x0:x1], cv2.COLOR_BGR2RGBA)
    rgba[:, :, 3] = cv2.resize(m, (w, h), interpolation=cv2.INTER_AREA)
    save(k, rgba)

# the winged name plate, lettering removed, for the zone title
plate = erase_text(inv, (462, 885, 616, 920), thresh=140)
save('nameplate', grab((428, 858, 648, 932), pad=5, img=plate)[0])
print('second sheet done')


# ============================================================================
# Third sheet: shop / NPC store (assets/ui/source/shop_sheet.png)
# ============================================================================
shop = cv2.imread(os.path.join(ROOT, 'assets/ui/source/shop_sheet.png'))


def rounded(img, box, r=10):
    """A rounded-rect cut: for buttons and badges that are plain slabs."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    m = np.zeros((h * 4, w * 4), np.uint8)
    cv2.rectangle(m, (r * 4, r * 4), (w * 4 - r * 4 - 1, h * 4 - r * 4 - 1), 255, -1)
    m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (r * 8, r * 8)))
    rgba = cv2.cvtColor(img[y0:y1, x0:x1], cv2.COLOR_BGR2RGBA)
    rgba[:, :, 3] = cv2.resize(cv2.GaussianBlur(m, (5, 5), 0), (w, h), interpolation=cv2.INTER_AREA)
    return rgba


def glyph(img, box, thresh=165):
    """A white pictogram lifted off its tab: brightness becomes alpha."""
    x0, y0, x1, y1 = box
    tile = img[y0:y1, x0:x1]
    lum = cv2.cvtColor(tile, cv2.COLOR_BGR2GRAY).astype(np.float32)
    a = np.clip((lum - thresh) * 4, 0, 255).astype(np.uint8)
    rgba = np.dstack([np.full(a.shape, 255, np.uint8)] * 3 + [a])
    return trim(rgba)


# shopkeepers, picture only (their captions stay on the sheet)
PORTRAITS = {'maid': 20, 'smith': 122, 'apothecary': 225, 'mystic': 327, 'trader': 430, 'general': 534}
for k, x in PORTRAITS.items():
    art = cv2.cvtColor(shop[847:966, x + 3:x + 92], cv2.COLOR_BGR2RGB)
    Image.fromarray(art).save(os.path.join(OUT, 'shopkeeper_' + k + '.webp'), 'WEBP', quality=92)

# category pictograms, white, tinted by CSS
for k, b in {'all': (350, 448, 386, 482), 'weapon': (450, 450, 478, 478), 'armor': (543, 449, 576, 480),
             'consumable': (655, 447, 685, 482), 'material': (765, 449, 797, 481), 'other': (863, 447, 895, 483)}.items():
    save('cat_' + k, glyph(shop, b))
save('shop_sell_icon', grab((28, 140, 52, 170), pad=3, img=shop)[0])

# buttons whose words are ours: buy, sell, cancel, close, ok
for k, b in {'sbtn_buy': (962, 502, 1080, 552), 'sbtn_sell': (1102, 502, 1220, 552),
             'sbtn_cancel': (962, 562, 1080, 612), 'sbtn_close': (1102, 562, 1220, 612),
             'sbtn_ok': (1383, 562, 1502, 612)}.items():
    save(k, rounded(shop, b, r=7))

# quantity shortcuts
for k, b in {'q_1': (888, 734, 934, 777), 'q_10': (940, 734, 987, 777), 'q_50': (991, 734, 1039, 777),
             'q_100': (1042, 734, 1092, 777), 'q_max': (1096, 734, 1143, 777)}.items():
    save(k, rounded(shop, b, r=6))

# badges for the shelf
for k, b in {'tag_new': (960, 656, 1023, 689), 'tag_pick': (1050, 656, 1113, 689),
             'tag_sale': (1142, 656, 1209, 689), 'tag_soldout': (1238, 656, 1321, 689),
             'tag_limited': (1337, 656, 1419, 689), 'tag_event': (1438, 656, 1519, 689)}.items():
    save(k, rounded(shop, b, r=4))

# notification glyphs for toasts
for k, b in {'n_ok': (1171, 732, 1197, 760), 'n_err': (1350, 732, 1377, 760),
             'n_info': (1171, 774, 1197, 802), 'n_warn': (1350, 774, 1377, 802)}.items():
    save(k, grab(b, pad=3, img=shop)[0])

# hanging shop signs, one per kind of shop
for k, b in {'sign_shop': (657, 840, 742, 910), 'sign_potion': (760, 841, 848, 908),
             'sign_weapon': (862, 841, 950, 908), 'sign_armor': (967, 837, 1057, 905),
             'sign_accessory': (662, 927, 756, 995), 'sign_material': (776, 927, 870, 995),
             'sign_etc': (889, 927, 983, 995)}.items():
    save(k, grab(b, pad=4, img=shop)[0])
print('shop sheet done')
