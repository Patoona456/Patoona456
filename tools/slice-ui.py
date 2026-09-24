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


def grab(box, pad=6, iters=6, fill_holes=True, img=None, whole=False):
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
        # one piece, unless it is meant to come apart (the dot under a "!")
        keep = [1 + np.argmax(st[1:, 4])] if not whole else [i for i in range(1, n) if st[i, 4] > 20]
        m = np.where(np.isin(lab, keep), 255, 0).astype(np.uint8)
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


def save(name, rgba, scale=1.0, quality=92):
    im = Image.fromarray(rgba)
    if scale != 1.0:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=quality, method=6)


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
    'levelup': (462, 826, 680, 906), 'questclear': (700, 813, 858, 898),
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

# (item art used to be cut here; items now wait for their own sheet)
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


# status icons (the harmful ones come from the combat sheet: ail_*)
for k, b in {'st_sword': (891, 873, 919, 902), 'st_shield': (921, 873, 949, 902),
             'st_plus': (982, 873, 1010, 902)}.items():
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

# buy-back glyph, and the market stall + lantern players' stalls are drawn with
save('shop_buyback_icon', grab((29, 192, 51, 217), pad=3, img=shop)[0])
stall, _ = grab((1093, 848, 1271, 1004), pad=5, img=shop)
save('stall', stall)
print('stall', stall.shape[1], 'x', stall.shape[0])


def lift(img, box, ring=36, thresh=38, crop=True):
    """For pieces GrabCut loses against the backdrop (bronze on brown): paint
    the backdrop in from a ring around the box, blur it, and keep what differs."""
    x0, y0, x1, y1 = box
    X0, Y0 = max(0, x0 - ring), max(0, y0 - ring)
    X1, Y1 = min(img.shape[1], x1 + ring), min(img.shape[0], y1 + ring)
    big = img[Y0:Y1, X0:X1]
    inside = np.zeros(big.shape[:2], np.uint8)
    inside[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0] = 255
    bg = cv2.GaussianBlur(cv2.inpaint(big, inside, 15, cv2.INPAINT_TELEA), (0, 0), 6)
    d = np.abs(big.astype(np.int16) - bg.astype(np.int16)).sum(2)
    a = np.clip((d - thresh) * 6, 0, 255).astype(np.uint8)
    a[inside == 0] = 0
    a = cv2.morphologyEx(a, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats((a > 100).astype(np.uint8))
    keep = np.zeros_like(a)
    for i in range(1, n):
        if st[i, 4] > 30:
            keep[lab == i] = 255
    a = np.minimum(a, cv2.dilate(keep, np.ones((3, 3), np.uint8)))
    rgba = cv2.cvtColor(big, cv2.COLOR_BGR2RGBA)
    rgba[:, :, 3] = a
    return trim(rgba) if crop else rgba[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0]


save('lantern', lift(shop, (1272, 925, 1338, 1016)))


# ============================================================================
# Fourth sheet: quests and NPC dialogue (assets/ui/source/quest_sheet.png)
# ============================================================================
qs = cv2.imread(os.path.join(ROOT, 'assets/ui/source/quest_sheet.png'))

# portraits for the dialogue window
for k, x in {'priest': 25, 'elder': 131, 'merchant': 237, 'mage': 342, 'tinker': 447, 'girl': 554}.items():
    art = cv2.cvtColor(qs[61:183, x + 6:x + 91], cv2.COLOR_BGR2RGB)
    Image.fromarray(art).save(os.path.join(OUT, 'npc_face_' + k + '.webp'), 'WEBP', quality=92)

# markers over quest givers' heads, and the interaction glyphs
for k, b in {'mark_main': (1256, 338, 1280, 390), 'mark_sub': (1326, 338, 1350, 390),
             'mark_daily': (1398, 338, 1422, 390), 'mark_event': (1473, 338, 1497, 390),
             'mark_ready': (1246, 435, 1287, 490), 'mark_talk': (1309, 438, 1360, 487),
             'mark_progress': (1384, 435, 1437, 490), 'mark_done': (1461, 435, 1512, 487),
             'act_talk': (1244, 585, 1295, 637), 'act_hand': (1315, 583, 1362, 637),
             'act_look': (1383, 583, 1437, 637), 'act_gear': (1455, 583, 1510, 637)}.items():
    save(k, grab(b, pad=4, img=qs, whole=k.startswith('mark_'))[0])

# the window close button
save('close_x', grab((1489, 843, 1522, 876), pad=3, img=qs)[0])

# quest complete banner
save('quest_complete', grab((942, 352, 1219, 478), pad=5, img=qs)[0])

# the empty speech box, its name tab top left
save('dlg_box', grab((1017, 42, 1248, 162), pad=4, img=qs)[0])

# dialogue choice bar: bubble cap, a clean middle, the right cap
bar = qs[48:88, 1270:1518]
choice = np.concatenate([bar[:, :56]] + [bar[:, 188:192]] * 20 + [bar[:, 224:]], axis=1)
save('dlg_choice', rounded(np.ascontiguousarray(choice), (0, 0, choice.shape[1], choice.shape[0]), r=5))

# quest kind glyphs for the log's rows
for k, b in {'qk_main': (38, 366, 88, 420), 'qk_sub': (40, 430, 86, 487), 'qk_daily': (38, 498, 88, 552),
             'qk_event': (38, 568, 88, 626)}.items():
    save(k, grab(b, pad=3, img=qs)[0])

# reward tiles
REWARD = {'exp': (0, 0), 'coin': (1, 0), 'gem': (2, 0), 'chest': (3, 0), 'scroll': (0, 1), 'potion': (1, 1),
          'armor': (2, 1), 'leaf': (3, 1), 'crystal': (0, 2), 'crest': (1, 2), 'book': (2, 2), 'gift': (3, 2)}
RC, RR = [976, 1041, 1106, 1172], [842, 900, 956]
for k, (c, r) in REWARD.items():
    save('rw_' + k, rounded(qs, (RC[c], RR[r], RC[c] + 58, RR[r] + 54), r=5))

# quest buttons whose words are ours
QB = {'qb_accept': (0, 0), 'qb_turnin': (1, 0), 'qb_navigate': (2, 1), 'qb_stop': (3, 1), 'qb_close': (2, 2)}
BC, BR = [25, 142, 258, 371], [845, 896, 949]
for k, (c, r) in QB.items():
    save(k, rounded(qs, (BC[c], BR[r], BC[c] + 108, BR[r] + 44), r=6))

# the plate NPC names sit on in the world
tag = qs[763:795, 1059:1195]
plate = np.concatenate([tag[:, :22]] + [tag[:, 22:26]] * 12 + [tag[:, 112:]], axis=1)
save('npc_plate', rounded(np.ascontiguousarray(plate), (0, 0, plate.shape[1], plate.shape[0]), r=4))
print('quest sheet done')


# ============================================================================
# Fifth sheet: party and friends (assets/ui/source/party_sheet.png)
# ============================================================================
ps = cv2.imread(os.path.join(ROOT, 'assets/ui/source/party_sheet.png'))

# party roles
for k, b in {'role_leader': (952, 764, 1002, 806), 'role_tank': (1036, 764, 1076, 808),
             'role_dps': (1104, 764, 1146, 808), 'role_support': (1248, 762, 1292, 808)}.items():
    save(k, grab(b, pad=4, img=ps)[0])
save('role_healer', lift(ps, (1168, 762, 1214, 808), thresh=60))

# party buttons whose words are ours
for k, b in {'pb_create': (797, 17, 1017, 73), 'pb_invite': (797, 89, 971, 146),
             'pb_kick': (987, 89, 1157, 146), 'pb_lead': (1173, 89, 1337, 146)}.items():
    save(k, rounded(ps, b, r=6))

# presence dots: online, offline, in game, away, fighting
for k, b in {'dot_online': (806, 324, 830, 349), 'dot_offline': (942, 324, 966, 349),
             'dot_busy': (1081, 324, 1105, 349), 'dot_away': (1226, 324, 1250, 349)}.items():
    save(k, grab(b, pad=3, img=ps)[0])

# friend action glyphs
for k, b in {'fa_whisper': (1365, 404, 1402, 442), 'fa_profile': (1366, 460, 1400, 497),
             'fa_group': (1364, 516, 1404, 553), 'fa_remove': (1364, 570, 1402, 608)}.items():
    save(k, grab(b, pad=3, img=ps)[0])
save('fa_block', lift(ps, (1364, 623, 1402, 660), ring=12, thresh=60))

# the crest over invitation cards
save('invite_crest', lift(ps, (512, 368, 718, 432), thresh=44))

# stamps: joined, left, new friend
save('party_joined', grab((488, 650, 746, 735), pad=5, img=ps)[0])
save('party_left', grab((772, 656, 994, 735), pad=5, img=ps)[0])
save('new_friend', grab((1256, 650, 1528, 750), pad=5, img=ps)[0])

# portrait rings for party frames: gold for the leader, steel for the rest
def ring_cut(box, cx, cy, r):
    rgba = lift(ps, box, ring=20, thresh=40)
    full = np.zeros((box[3] - box[1] + 80, box[2] - box[0] + 80, 4), np.uint8)
    # lift() trims; redo the punch in its own frame by locating the dark disc
    h, w = rgba.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    dark = rgba[:, :, :3].max(axis=2) < 40
    ys, xs = np.nonzero(dark)
    my, mx = ys.mean(), xs.mean()
    rgba[np.hypot(xx - mx, yy - my) < r, 3] = 0
    return rgba
save('pring_gold', ring_cut((10, 900, 88, 998), 0, 0, 27))
save('pring_steel', ring_cut((100, 903, 170, 988), 0, 0, 26))
print('party sheet done')


# ============================================================================
# Sixth sheet: guilds (assets/ui/source/guild_sheet.png)
# ============================================================================
gs = cv2.imread(os.path.join(ROOT, 'assets/ui/source/guild_sheet.png'))

save('guild_crest', grab((26, 38, 166, 160), pad=4, img=gs)[0])
for k, x in {'lion': 1192, 'eagle': 1260, 'spirit': 1330, 'tree': 1398, 'skull': 1464}.items():
    save('emblem_' + k, grab((x, 10, x + 60, 138), pad=4, img=gs)[0] if k in ('lion', 'eagle', 'spirit')
         else lift(gs, (x, 10, x + 60, 138), ring=14, thresh=40))

# the window's tab pictograms (white on the tab) - brightness becomes alpha
for k, (x0, y0) in {'info': (478, 28), 'members': (603, 28), 'skills': (727, 28), 'quests': (852, 28),
                    'vault': (975, 28), 'war': (1097, 28)}.items():
    save('gtab_' + k, glyph(gs, (x0, y0, x0 + 38, y0 + 36), thresh=150))

# guild skills
for k, (x, y) in {'atk': (955, 283), 'hp': (1013, 283), 'def': (1071, 283),
                  'exp': (955, 349), 'crit': (1013, 349), 'mdef': (1071, 349)}.items():
    save('gskill_' + k, rounded(gs, (x, y, x + 50, y + 51), r=4))

# rank marks for the roster
for k, b in {'rank_leader': (203, 316, 238, 346), 'rank_officer': (204, 368, 236, 400),
             'rank_member': (204, 423, 236, 453), 'rank_recruit': (204, 530, 236, 560),
             'rank_veteran': (670, 797, 732, 862)}.items():
    save(k, grab(b, pad=4, img=gs)[0])

save('gq_check', grab((1149, 283, 1177, 312), pad=3, img=gs)[0])
for k, y in {'glog_join': 523, 'glog_give': 557, 'glog_leave': 591, 'glog_up': 624}.items():
    save(k, grab((832, y, 854, y + 21), pad=2, img=gs)[0])

# the war card's castle, above its lettering
war = cv2.cvtColor(gs[520:564, 1190:1510], cv2.COLOR_BGR2RGB)
Image.fromarray(war).save(os.path.join(OUT, 'guild_war.webp'), 'WEBP', quality=90)

# welcome stamp: the chibi and her bubble
save('guild_welcome', lift(gs, (14, 904, 168, 1000), thresh=46))

# buttons whose words are ours
for k, b in {'gb_invite': (28, 618, 176, 660), 'gb_kick': (186, 618, 332, 660),
             'gb_promote': (342, 618, 489, 660), 'gb_join': (19, 682, 181, 728),
             'gb_leave': (194, 682, 353, 728), 'gb_emblem': (781, 387, 911, 421)}.items():
    save(k, rounded(gs, b, r=6))
print('guild sheet done')

# weekly titles, and the other three chibi speech bubbles
for k, b in {'gtitle_warrior': (412, 795, 466, 864), 'gtitle_donor': (498, 797, 556, 864),
             'gtitle_helper': (586, 797, 644, 864)}.items():
    save(k, grab(b, pad=4, img=gs)[0])
for k, b in {'guild_bubble_strong': (178, 904, 332, 1000), 'guild_bubble_family': (338, 902, 508, 1000),
             'guild_bubble_fight': (512, 904, 670, 1000)}.items():
    save(k, lift(gs, b, thresh=46))
print('guild extras done')


# ============================================================================
# Seventh sheet: the forge (assets/ui/source/refine_sheet.png)
# ============================================================================
rs = cv2.imread(os.path.join(ROOT, 'assets/ui/source/refine_sheet.png'))


def card(img, box, hole, fade=16):
    """A result card cut as a rectangle whose edges melt away, with the
    painted sword in its frame replaced by a dark well for our own icon."""
    x0, y0, x1, y1 = box
    sub = img[y0:y1, x0:x1].copy()
    hx0, hy0, hx1, hy1 = [v - o for v, o in zip(hole, (x0, y0, x0, y0))]
    well = np.zeros((hy1 - hy0, hx1 - hx0, 3), np.uint8)
    yy = np.linspace(0, 1, hy1 - hy0)[:, None, None]
    well[:] = (np.array([46, 34, 28]) * (1 - yy) + np.array([22, 16, 14]) * yy).astype(np.uint8)
    sub[hy0:hy1, hx0:hx1] = well
    h, w = sub.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    edge = np.minimum.reduce([xx, yy, w - 1 - xx, h - 1 - yy]).astype(np.float32)
    a = np.clip(edge / fade, 0, 1) ** 1.5 * 255
    rgba = cv2.cvtColor(sub, cv2.COLOR_BGR2RGBA)
    rgba[:, :, 3] = a.astype(np.uint8)
    return rgba


save('forge_success', card(rs, (855, 0, 1125, 196), (952, 102, 1024, 172)))
save('forge_fail', card(rs, (1140, 28, 1290, 198), (1180, 104, 1250, 176)))
save('forge_down', card(rs, (1305, 22, 1535, 198), (1388, 102, 1458, 172)))
save('forge_frame', card(rs, (270, 82, 400, 200), (298, 108, 372, 178), fade=10))

for k, b in {'chance_green': (925, 480, 1030, 575), 'chance_red': (1170, 480, 1280, 575)}.items():
    clean = erase_text(rs, (b[0] + 12, b[1] + 14, b[2] - 12, b[3] - 16), thresh=165)
    save(k, grab(b, pad=4, img=clean)[0])
# the gold one's lettering is the colour of its shield; recolour the clean green instead
clean = erase_text(rs, (937, 494, 1018, 559), thresh=165)
green, _ = grab((925, 480, 1030, 575), pad=4, img=clean)
hsv = cv2.cvtColor(cv2.cvtColor(green, cv2.COLOR_RGBA2RGB), cv2.COLOR_RGB2HSV).astype(np.int16)
fill = (hsv[:, :, 0] > 35) & (hsv[:, :, 0] < 95)
hsv[:, :, 0] = np.where(fill, 20, hsv[:, :, 0])
hsv[:, :, 2] = np.where(fill, np.clip(hsv[:, :, 2] * 1.25, 0, 255), hsv[:, :, 2])
gold = cv2.cvtColor(cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB), cv2.COLOR_RGB2RGBA)
gold[:, :, 3] = green[:, :, 3]
save('chance_gold', gold)

for k, b in {'risk_safe': (1020, 820, 1135, 858), 'risk_recommended': (1150, 820, 1265, 858),
             'risk_risky': (1283, 820, 1395, 858), 'risk_danger': (1410, 820, 1528, 858)}.items():
    save(k, rounded(rs, b, r=14))

for i, x in enumerate([1080, 1158, 1235, 1312, 1392, 1472]):
    save(f'forge_sword_{i}', lift(rs, (x - 36, 636, x + 36, 722), ring=10, thresh=34))

for k, b in {'mat_enhance': (28, 627, 98, 697), 'mat_protect': (278, 627, 348, 697)}.items():
    save(k, rounded(rs, b, r=5))

for k, b in {'fb_enhance': (208, 433, 457, 475), 'fb_confirm': (865, 413, 970, 455),
             'fb_cancel': (983, 413, 1080, 455)}.items():
    save(k, rounded(rs, b, r=6))
print('forge sheet done')


# ============================================================================
# Eighth sheet: the shrine / gacha (assets/ui/source/gacha_sheet.png)
# ============================================================================
gg = cv2.imread(os.path.join(ROOT, 'assets/ui/source/gacha_sheet.png'))

save('gacha_banner', card(gg, (20, 14, 500, 282), (0, 0, 0, 0), fade=18))
for k, x in {'R': 568, 'SR': 652, 'SSR': 732, 'UR': 815, 'LR': 896}.items():
    save('grade_' + k, grab((x - 36, 364, x + 36, 438), pad=4, img=gg)[0])
for k, x in {'R': 83, 'SR': 190, 'SSR': 300, 'UR': 420, 'LR': 545}.items():
    save('beam_' + k, lift(gg, (x - 58, 728, x + 58, 820), ring=8, thresh=30))
for i, x in enumerate([755, 815, 878, 943]):
    save(f'gchest_{i}', grab((x - 28, 904, x + 28, 966), pad=3, img=gg)[0])
save('tag_pickup', grab((1316, 928, 1372, 992), pad=4, img=gg)[0])
save('tag_rateup', grab((1386, 928, 1442, 992), pad=4, img=gg)[0])


def reveal_card(img, box):
    """The SSR reveal with its silhouette and its baked 'SSR' painted out, a
    soft golden glow left where our icon and grade badge will sit."""
    x0, y0, x1, y1 = box
    base = img[y0:y1, x0:x1].copy()
    h, w = base.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = 248 - x0, 515 - y0
    oval = ((((xx - cx) / 78) ** 2 + ((yy - cy) / 72) ** 2) < 1) & (yy < 596 - y0)
    title = (xx > 175 - x0) & (xx < 320 - x0) & (yy > 396 - y0) & (yy < 452 - y0)
    m = ((oval | title) * 255).astype(np.uint8)
    base = cv2.inpaint(base, m, 11, cv2.INPAINT_TELEA)
    # the silhouette's dark wings become the same warm light as the wings behind
    wide = ((((xx - cx) / 150) ** 2 + ((yy - cy) / 110) ** 2) < 1) & (yy < 598 - y0)
    lum = cv2.cvtColor(base, cv2.COLOR_BGR2GRAY)
    dark = (wide & (lum < 150)).astype(np.float32)
    dark = cv2.GaussianBlur(dark, (0, 0), 3)[..., None]
    light = np.array([150, 222, 255], np.float32)
    base = np.clip(base * (1 - dark * 0.8) + light * dark * 0.8, 0, 255).astype(np.uint8)
    r = np.hypot((xx - cx) / 110, (yy - cy) / 90)
    t = np.clip(1 - r, 0, 1)[..., None] ** 1.3
    glow = np.array([120, 214, 255], np.float32)            # BGR warm gold
    base = np.clip(base * (1 - t * 0.6) + glow * t * 0.6, 0, 255).astype(np.uint8)
    edge = np.minimum.reduce([xx, yy, w - 1 - xx, h - 1 - yy]).astype(np.float32)
    rgba = cv2.cvtColor(base, cv2.COLOR_BGR2RGBA)
    rgba[:, :, 3] = (np.clip(edge / 14, 0, 1) ** 1.5 * 255).astype(np.uint8)
    return rgba


save('gacha_reveal', reveal_card(gg, (20, 392, 500, 676)))
print('gacha sheet done')


# ============================================================================
# Ninth sheet: world map & travel (assets/ui/source/worldmap_sheet.png)
# ============================================================================
wm = cv2.imread(os.path.join(ROOT, 'assets/ui/source/worldmap_sheet.png'))
# the painted continent, with its pins and name plates painted out so the
# game can place its own
# the painted continent as it is; the game lays its own plates exactly over
# the painted ones (their positions are in client/js/ui.js WORLD_SPOTS)
land = wm[90:575, 40:820].copy()
# the painted zoom buttons on its left edge do nothing here: paint them out
zm = np.zeros(land.shape[:2], np.uint8)
cv2.rectangle(zm, (0, 336), (62, 485), 255, -1)
land = cv2.inpaint(land, zm, 9, cv2.INPAINT_TELEA)
Image.fromarray(cv2.cvtColor(land, cv2.COLOR_BGR2RGB)).save(os.path.join(OUT, 'worldmap.webp'), 'WEBP', quality=88)

# area thumbnails (their captions left behind)
for i, k in enumerate(['kingdom', 'forest', 'desert', 'harbor', 'snow', 'volcano', 'shadow', 'sky']):
    x = 32 + i * 130
    art = cv2.cvtColor(wm[607:668, x:x + 120], cv2.COLOR_BGR2RGB)
    Image.fromarray(art).save(os.path.join(OUT, 'area_' + k + '.webp'), 'WEBP', quality=90)

# map pins and markers
for k, (x, y) in {'pin_me': (988, 770), 'pin_goal': (1060, 770), 'pin_quest': (1127, 770), 'pin_npc': (1190, 770),
                  'pin_boss': (1250, 770), 'pin_warp': (1413, 770), 'pin_town': (1477, 770),
                  'pin_shop': (989, 838), 'pin_smith': (1127, 838), 'pin_field': (1337, 838),
                  'pin_dungeon': (1408, 838), 'pin_harbor': (1477, 838)}.items():
    save(k, grab((x - 22, y - 24, x + 22, y + 22), pad=3, img=wm)[0])
for k, (x, y) in {'wx_day': (975, 955), 'wx_night': (1020, 955), 'wx_rain': (1063, 955), 'wx_snow': (1106, 955),
                  'wx_wind': (1147, 955), 'wx_fog': (1190, 955)}.items():
    save(k, grab((x - 18, y - 18, x + 18, y + 18), pad=3, img=wm)[0])
for k, b in {'area_open': (688, 758, 804, 804), 'area_danger': (688, 815, 804, 861)}.items():
    save(k, rounded(wm, b, r=6))
save('area_locked_glyph', grab((850, 778, 882, 812), pad=3, img=wm)[0])
save('wm_warp_btn', rounded(wm, (1432, 131, 1510, 172), r=6))
print('world map sheet done')


# ============================================================================
# Tenth sheet: combat, target & boss (assets/ui/source/combat_sheet*.png)
# ============================================================================
cb = cv2.imread(os.path.join(ROOT, 'assets/ui/source/combat_sheet.png'))
cb2 = cv2.imread(os.path.join(ROOT, 'assets/ui/source/combat_sheet2.png'))

# reticles drawn around the target: red = locked on (attacking), gold =
# picked, blue = a friend
def reticle(cx, cy, tint, r=50):
    """The sheet's white strokes, re-lit with a clean neon glow of their own
    colour: the haze they were painted on does not come along."""
    tile = cb[cy - r:cy + r, cx - r:cx + r]
    # a stroke is white - every channel high - while the glow and the haze
    # are saturated, so the weakest channel tells them apart
    white = tile.min(axis=2).astype(np.float32)
    stroke = np.clip((white - 135) / 70, 0, 1)
    yy, xx = np.mgrid[0:2 * r, 0:2 * r]
    stroke *= np.clip((r - 2 - np.hypot(xx - r, yy - r)) / 4, 0, 1)
    glow = np.clip(cv2.GaussianBlur(stroke, (0, 0), 2.6) * 3.4, 0, 1)
    a = np.maximum(stroke, glow * 0.85)
    col = np.array(tint, np.float32)
    rgb = col * (1 - stroke[..., None]) + 255 * stroke[..., None]
    rgba = np.dstack([rgb, a * 255]).astype(np.uint8)
    return trim(rgba)


def strip(pieces, cell):
    """Pieces side by side in equal square cells, one file for the lot
    (the offline demo counts its files)."""
    out = np.zeros((cell, cell * len(pieces), 4), np.uint8)
    for i, p in enumerate(pieces):
        h, w = p.shape[:2]
        k = min(cell / w, cell / h, 1)
        if k < 1:
            # shrink premultiplied, or the colour hidden under clear pixels
            # (the sheet's background) bleeds into the edge as a halo
            a = p[:, :, 3:4].astype(np.float32) / 255
            pm = np.dstack([p[:, :, :3].astype(np.float32) * a, a * 255])
            size = (max(1, round(w * k)), max(1, round(h * k)))
            pm = cv2.resize(pm, size, interpolation=cv2.INTER_AREA)
            al = np.clip(pm[:, :, 3:4] / 255, 1e-6, 1)
            rgb = np.clip(pm[:, :, :3] / al, 0, 255)
            p = np.dstack([rgb, pm[:, :, 3:4]]).astype(np.uint8)
            h, w = p.shape[:2]
        y, x = (cell - h) // 2, i * cell + (cell - w) // 2
        out[y:y + h, x:x + w] = p
    return out


# lock, pick, ally - in that order (client/js/renderer.js RETICLE_CELLS)
save('reticles', strip([reticle(cx, 250, tint) for cx, tint in
                        [(855, (255, 60, 50)), (950, (255, 196, 40)), (1043, (50, 150, 255))]], 96))

# the ailments the game actually has, art only (captions stay on the sheet)
# stun, freeze, slow, curse, poison, burn - in that order (client/js/ui.js AILMENTS)
save('ailments', strip([cv2.cvtColor(cb[711:747, cx - 18:cx + 18], cv2.COLOR_BGR2RGBA)
                        for cx in (50, 107, 282, 341, 402, 464)], 36))

# warning plates, words painted out so the game writes its own
def erase_red(img, box):
    """Inpaint pink-red lettering (the BOSS / DANGER words) inside box."""
    out = img.copy()
    x0, y0, x1, y1 = box
    region = out[y0:y1, x0:x1]
    m = ((region[:, :, 2] > 165) | (region.min(axis=2) > 150)).astype(np.uint8) * 255
    m = cv2.dilate(m, np.ones((7, 7), np.uint8))
    out[y0:y1, x0:x1] = cv2.inpaint(region, m, 7, cv2.INPAINT_TELEA)
    return out


save('warn_boss', grab((1300, 410, 1512, 474), pad=4, img=erase_red(cb, (1376, 420, 1498, 468)))[0])
for k, b, t in [('warn_aoe', (1300, 483, 1512, 535), (1360, 490, 1500, 528)),
                ('warn_phase', (1305, 593, 1512, 647), (1365, 600, 1500, 640))]:
    save(k, grab(b, pad=4, img=erase_text(cb, t, thresh=165))[0])

save('boss_badge', grab((1262, 20, 1322, 84), pad=3, img=cb)[0])
save('ko_hero', lift(cb, (6, 866, 184, 1016), ring=20, thresh=34))
save('respawn_tomb', grab((712, 882, 866, 1006), pad=4, img=cb)[0])
save('revive_wings', grab((22, 920, 300, 1004), pad=4, img=cb2)[0])
save('victory', grab((1160, 848, 1392, 992), pad=4, img=cb2)[0])
print('combat sheet done')


# ============================================================================
# Eleventh sheet: potions & consumables (assets/ui/source/potion_sheet.png)
# ============================================================================
# Forty bottles, eight to a row, each over its caption. They go into one
# atlas - assets/ui/potions.webp, 8 x 5 cells of POTION_CELL - in reading
# order; shared/data/items.js names each item's cell ('potions#12').
pt = cv2.imread(os.path.join(ROOT, 'assets/ui/source/potion_sheet.png'))
POTION_CELL = 96
POTION_ROWS = [  # (top, caption top, bottle centres left to right)
    (12, 160, (105, 283, 480, 662, 877, 1057, 1240, 1422)),
    (216, 364, (104, 286, 479, 666, 871, 1061, 1250, 1435)),
    (410, 552, (108, 293, 486, 678, 873, 1065, 1250, 1438)),
    (596, 757, (112, 290, 471, 657, 865, 1058, 1256, 1442)),
    (796, 956, (108, 290, 485, 668, 868, 1049, 1240, 1435)),
]
atlas = np.zeros((POTION_CELL * 5, POTION_CELL * 8, 4), np.uint8)
for r, (top, cap, xs) in enumerate(POTION_ROWS):
    for c, cx in enumerate(xs):
        # the all-resist ring reaches out; four blue bottles sit on blue haze
        # that GrabCut would take along unless the box hugs them
        left, right = {(2, 7): (92, 92), (3, 1): (58, 62), (4, 1): (58, 62), (3, 6): (62, 66), (4, 7): (56, 62)}.get((r, c), (80, 80))
        bottle = grab((cx - left, top, cx + right, cap), pad=2, img=pt)[0]
        atlas[r * POTION_CELL:(r + 1) * POTION_CELL, c * POTION_CELL:(c + 1) * POTION_CELL] = strip([bottle], POTION_CELL)
save('potions', atlas)
print('potion sheet done')


# ============================================================================
# Twelfth sheet: scrolls, spell books & tickets (assets/ui/source/scroll_sheet.png)
# ============================================================================
# Forty-eight pieces, eight to a row, no captions. One atlas again -
# assets/ui/scrolls.webp, 8 x 6 cells - in reading order ('scrolls#12').
sc = cv2.imread(os.path.join(ROOT, 'assets/ui/source/scroll_sheet.png'))
SCROLL_ROWS = [(14, 186), (188, 350), (356, 522), (524, 704), (700, 872), (864, 1020)]
SCROLL_XS = (110, 292, 482, 668, 860, 1058, 1246, 1432)
atlas = np.zeros((POTION_CELL * 6, POTION_CELL * 8, 4), np.uint8)
for r, (top, bottom) in enumerate(SCROLL_ROWS):
    for c, cx in enumerate(SCROLL_XS):
        if (r, c) == (1, 2):         # red on red: GrabCut keeps only the paper
            piece = lift(sc, (cx - 88, top + 12, cx + 88, bottom), ring=14, thresh=46)
        else:
            piece = grab((cx - 90, top, cx + 90, bottom), pad=2, img=sc)[0]
        atlas[r * POTION_CELL:(r + 1) * POTION_CELL, c * POTION_CELL:(c + 1) * POTION_CELL] = strip([piece], POTION_CELL)
save('scrolls', atlas)
print('scroll sheet done')


# ============================================================================
# Weapon sheets: one class, one ladder of starter weapons, one atlas each.
# The first is the swordsman's (assets/ui/source/sword_sheet.png): twenty-four
# swords, Lv.1 to Lv.120, six to a row, each with a "Lv." plate under its
# hilt. The plates are painted out before the cut, and the swords go into
# assets/ui/swords.webp (6 x 4 cells) in the sheet's order.
# ============================================================================
def outline_cut(img, box, dark=30, close=5):
    """For art drawn with a black outline on a haze: the outline is the
    edge. Fill in from the corners; whatever the fill cannot reach is the
    piece, outline included. The haze's own shadow never gets inside."""
    x0, y0, x1, y1 = box
    sub = img[y0:y1, x0:x1]
    lum = cv2.cvtColor(sub, cv2.COLOR_BGR2GRAY)
    line = (lum < dark).astype(np.uint8) * 255
    line = cv2.morphologyEx(line, cv2.MORPH_CLOSE, np.ones((close, close), np.uint8))
    h, w = line.shape
    reach = line.copy()
    ff = np.zeros((h + 2, w + 2), np.uint8)
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if reach[seed[1], seed[0]] == 0:
            cv2.floodFill(reach, ff, seed, 128)
    inside = (reach != 128).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(inside)
    if n > 1:
        inside = (lab == 1 + np.argmax(st[1:, 4])).astype(np.uint8)
    a = cv2.GaussianBlur(inside * 255, (3, 3), 0)
    rgba = cv2.cvtColor(sub, cv2.COLOR_BGR2RGBA)
    rgba[:, :, 3] = a
    return trim(rgba)


def weapon_sheet(src, out, cols, rows, cell_w, plate_y, plate_x=(86, 226), cell=160):
    img = cv2.imread(os.path.join(ROOT, 'assets/ui/source', src))
    mask = np.zeros(img.shape[:2], np.uint8)
    for (y0, y1) in plate_y:
        for c in range(cols):
            cv2.rectangle(mask, (c * cell_w + plate_x[0], y0), (c * cell_w + plate_x[1], y1), 255, -1)
    clean = cv2.inpaint(img, mask, 9, cv2.INPAINT_TELEA)
    atlas = np.zeros((cell * len(rows), cell * cols, 4), np.uint8)
    for r, (top, bottom) in enumerate(rows):
        for c in range(cols):
            box = (c * cell_w + 4, top, (c + 1) * cell_w - 2, bottom)
            # an outline with a gap lets the fill in and leaves a sliver, so
            # close the line harder until the piece is whole; GrabCut (which
            # keeps some shadow) is the last resort
            loose = grab((box[0] + 8, box[1], box[2] - 4, box[3]), pad=2, img=clean)[0]
            want = 0.6 * (loose[:, :, 3] > 128).sum()
            piece = loose
            for close in (5, 9, 13, 17):
                # the smallest fill that is still whole is the one without shadow
                cuts = [outline_cut(clean, box, dark=d, close=close) for d in (30, 22)]
                cuts = [x for x in cuts if (x[:, :, 3] > 128).sum() >= want]
                if cuts:
                    piece = min(cuts, key=lambda x: (x[:, :, 3] > 128).sum())
                    break
            atlas[r * cell:(r + 1) * cell, c * cell:(c + 1) * cell] = strip([piece], cell)
    save(out, atlas, quality=96)


weapon_sheet('sword_sheet.png', 'swords', cols=6, cell_w=256,
             rows=[(18, 252), (262, 500), (498, 738), (736, 990)],
             plate_y=[(210, 254), (457, 502), (693, 737), (940, 990)])
print('sword sheet done')


# Rare swords (assets/ui/source/sword_rare_sheet.png): twenty-five, Lv.1 to
# Lv.120 on the same five-level steps as the common ladder, each over a navy
# "Lv." plate. The plates are found by colour (they also give the order) and
# painted out. The backdrop is a smooth gradient with a soft glow behind
# each sword, so it is modelled - shrink the sheet hard, median it, grow it
# back, and the thin swords vanish while the gradient and glows stay - and a
# sword is whatever differs from it. Out: assets/ui/swords_rare.webp.
def plated_weapons(src, out, cols=8, cell=160, lo=40, hi=90, plate='navy'):
    raw = cv2.imread(os.path.join(ROOT, 'assets/ui/source', src), cv2.IMREAD_UNCHANGED)
    img = raw[:, :, :3]
    # a board that comes already cut out (the epic one) says where the art is
    # itself; measuring against the painted board is only for those that don't
    matte = raw[:, :, 3].astype(np.float32) if raw.shape[2] == 4 and raw[:, :, 3].min() < 16 else None
    b, g, r = [img[:, :, i].astype(int) for i in range(3)]
    lum = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(int)
    # the level plates: navy on the rare sheet, near-black violet on the epic one
    ink = (b - r > 25) & (lum < 90) if plate == 'navy' else (lum < 70) & (b - g > 20)
    n, lab, st, _ = cv2.connectedComponentsWithStats(ink.astype(np.uint8))
    plates = [st[i][:4] for i in range(1, n) if st[i, 2] > 70 and 18 < st[i, 3] < 50]
    plates.sort(key=lambda p: (p[1] // 100, p[0]))
    mask = np.zeros(img.shape[:2], np.uint8)
    for (x, y, w, h) in plates:
        cv2.rectangle(mask, (x - 8, y - 6), (x + w + 8, y + h + 6), 255, -1)
    clean = cv2.inpaint(img, mask, 9, cv2.INPAINT_TELEA)
    small = cv2.resize(clean, (clean.shape[1] // 8, clean.shape[0] // 8), interpolation=cv2.INTER_AREA)
    bg = cv2.resize(cv2.medianBlur(small, 9), (clean.shape[1], clean.shape[0]), interpolation=cv2.INTER_CUBIC)
    d = np.abs(clean.astype(int) - bg.astype(int)).sum(2).astype(np.float32)
    if matte is not None:
        d = matte                       # 0..255: lo/hi below become alpha thresholds
        lo, hi = 128, 250
    solid = (d > lo).astype(np.uint8)
    solid = cv2.morphologyEx(solid, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(solid)
    rows = (len(plates) + cols - 1) // cols
    atlas = np.zeros((cell * rows, cell * cols, 4), np.uint8)
    for k, (x, y, w, h) in enumerate(plates):
        # the biggest blob whose box comes down to the plate from above
        best, area = 0, 0
        for i in range(1, n):
            bx, by, bw, bh, a = st[i]
            # ...and ends at the plate, not a taller sword from the row below
            if a > area and bx < x + w and bx + bw > x and y - 40 < by + bh < y + h + 8 and by < y:
                best, area = i, a
        bx, by, bw, bh, _ = st[best]
        m = (lab[by:by + bh, bx:bx + bw] == best).astype(np.uint8) * 255
        ff = cv2.copyMakeBorder(m, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
        cv2.floodFill(ff, np.zeros((bh + 4, bw + 4), np.uint8), (0, 0), 255)
        m = m | cv2.bitwise_not(ff[1:-1, 1:-1])
        # solid inside, and a soft rim where the difference fades out
        rim = (np.clip((d[by:by + bh, bx:bx + bw] - lo) / (hi - lo), 0, 1) if matte is None
               else matte[by:by + bh, bx:bx + bw] / 255)
        inner = cv2.erode(m, np.ones((3, 3), np.uint8)) > 0
        alpha = np.where(inner, 1.0, rim * (m > 0))
        if matte is not None:
            # the matte's own gaps between the spikes are real: keep them open
            own = cv2.dilate((lab[by:by + bh, bx:bx + bw] == best).astype(np.uint8), np.ones((5, 5), np.uint8))
            alpha = rim * own
        rgba = cv2.cvtColor(img[by:by + bh, bx:bx + bw], cv2.COLOR_BGR2RGBA)
        rgba[:, :, 3] = (alpha * 255).astype(np.uint8)
        rr, cc = divmod(k, cols)
        atlas[rr * cell:(rr + 1) * cell, cc * cell:(cc + 1) * cell] = strip([trim(rgba)], cell)
    save(out, atlas, quality=96)
    return len(plates)


print('rare swords', plated_weapons('sword_rare_sheet.png', 'swords_rare'))
# Epic, Lv.45-70: 23 swords on a violet board; several plates are misnumbered,
# so the order on the board is the order of the ladder (shared/data/items.js)
print('epic swords', plated_weapons('swords_epic.png', 'swords_epic', plate='violet'))
