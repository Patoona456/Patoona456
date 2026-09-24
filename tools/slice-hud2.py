#!/usr/bin/env python3
"""Cuts the second-generation HUD out of the four transparent master sheets
(assets/ui/source/hud2_[abcd].png) into assets/ui/h2_*.webp.

    python3 tools/slice-hud2.py [preview.png]

The sheets carry real alpha, so most pieces are a plain crop. Text painted
into a piece ("Lv. 99", "123,456", button captions) is wiped by copying a
clean column of the same piece across it - every plate and bar on these
sheets shades top-to-bottom only, so one column rebuilds the whole run.
"""
import os
import sys
import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets/ui')
SHEETS = {k: np.array(Image.open(os.path.join(ROOT, f'assets/ui/source/hud2_{k}.png')).convert('RGBA'))
          for k in 'abcde'}
made = {}


def crop(s, box):
    x0, y0, x1, y1 = box
    return SHEETS[s][y0:y1, x0:x1].copy()


def trim(rgba, pad=1):
    ys, xs = np.nonzero(rgba[:, :, 3] > 10)
    y0, y1 = max(0, ys.min() - pad), min(rgba.shape[0], ys.max() + 1 + pad)
    x0, x1 = max(0, xs.min() - pad), min(rgba.shape[1], xs.max() + 1 + pad)
    return rgba[y0:y1, x0:x1]


def solid(rgba):
    """The sheets fade everything to ~253 alpha; pieces should be opaque."""
    a = rgba[:, :, 3].astype(np.float32)
    rgba[:, :, 3] = np.clip(a * 255 / 253, 0, 255).astype(np.uint8)
    return rgba


def smear(rgba, box, src_x=None):
    """Rebuild box (piece coordinates) from one clean column."""
    x0, y0, x1, y1 = box
    sx = x0 - 1 if src_x is None else src_x
    rgba[y0:y1, x0:x1] = rgba[y0:y1, sx:sx + 1]
    return rgba


def smear_rows(rgba, box, src_y=None):
    x0, y0, x1, y1 = box
    sy = y0 - 1 if src_y is None else src_y
    rgba[y0:y1, x0:x1] = rgba[sy:sy + 1, x0:x1]
    return rgba


def disc(rgba, cx, cy, r, inside=True, soft=1.5):
    """Keep (or cut) a disc, with a soft edge."""
    h, w = rgba.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.hypot(xx - cx, yy - cy)
    k = np.clip((r - d) / soft + 0.5, 0, 1) if inside else np.clip((d - r) / soft + 0.5, 0, 1)
    rgba[:, :, 3] = (rgba[:, :, 3] * k).astype(np.uint8)
    return rgba


def key_dark(rgba, ref, tol=30, soft=18):
    """Lift an icon off a flat dark panel."""
    rgb = rgba[:, :, :3].astype(np.float32)
    d = np.linalg.norm(rgb - np.array(ref, np.float32), axis=2)
    k = np.clip((d - tol) / soft, 0, 1)
    k = cv2.morphologyEx((k * 255).astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)) / 255
    n, lab, st, _ = cv2.connectedComponentsWithStats((k > 0.3).astype(np.uint8))
    if n > 1:
        big = 1 + np.argmax(st[1:, 4])
        keep = np.isin(lab, [i for i in range(1, n) if st[i, 4] > st[big, 4] * 0.08])
        k = k * keep
    rgba[:, :, 3] = (rgba[:, :, 3] * k).astype(np.uint8)
    return rgba


def undot(rgba):
    """Paint out the red notification dot in an icon's top-right corner."""
    h, w = rgba.shape[:2]
    r, g, b = [rgba[:, :, i].astype(int) for i in range(3)]
    red = (r > 170) & (g < 90) & (b < 90)
    zone = np.zeros_like(red)
    zone[: int(h * .38), int(w * .6):] = True
    m = (red & zone).astype(np.uint8) * 255
    if not m.any():
        return rgba
    m = cv2.dilate(m, np.ones((7, 7), np.uint8))
    # the dot hangs off the icon: where it sat on nothing, leave nothing
    ys, xs = np.nonzero(m)
    cx, cy, rr = xs.mean(), ys.mean(), max(np.ptp(xs), np.ptp(ys)) / 2 + 2
    yy, xx = np.mgrid[0:h, 0:w]
    dot = np.hypot(xx - cx, yy - cy) <= rr
    bgr = cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2BGR)
    fixed = cv2.inpaint(bgr, dot.astype(np.uint8) * 255, 5, cv2.INPAINT_TELEA)
    rgba[:, :, :3] = cv2.cvtColor(fixed, cv2.COLOR_BGR2RGB)
    # alpha: what the icon's own outline would have been - mirror from the left half
    a = rgba[:, :, 3].copy()
    a2 = cv2.inpaint(a, dot.astype(np.uint8) * 255, 5, cv2.INPAINT_TELEA)
    rgba[:, :, 3] = np.where(dot, np.minimum(a2, 255), a)
    return rgba


def icon_above_plate(rgba, frac=.7):
    """Top-row icons stand on a caption plate; keep the picture, fade its foot."""
    h = rgba.shape[0]
    cut = int(h * frac)
    rgba = rgba[:cut].copy()
    fade = np.linspace(1, 0, 5)
    rgba[cut - 5:, :, 3] = (rgba[cut - 5:, :, 3] * fade[:, None]).astype(np.uint8)
    return trim(rgba)


def main_blob(rgba):
    """Drop crumbs of neighbouring pieces that fell inside the box."""
    m = (rgba[:, :, 3] > 40).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    if n > 2:
        big = 1 + np.argmax(st[1:, 4])
        rgba[:, :, 3] = np.where(cv2.dilate((lab == big).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0, rgba[:, :, 3], 0)
    return trim(rgba)


def save(name, rgba, width=None, quality=90):
    im = Image.fromarray(rgba)
    if width and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, f'h2_{name}.webp'), 'WEBP', quality=quality, method=6)
    made[name] = im


# ------------------------------------------------------------ vitals plate
v = solid(crop('c', (12, 7, 592, 268)))
# wipe "Lv. 99", then empty the three bars back to a dark track: rebuild
# each from a clean column of its fill, then drain the colour out of it
v = smear(v, (176, 52, 262, 82), 264)                      # level text
for y0, y1 in ((95, 122), (138, 165), (177, 196)):
    v = smear(v, (250, y0, 540, y1), 248)
    box = v[y0 - 2:y1 + 2, 228:550]
    rgb = box[:, :, :3].astype(np.float32)
    mx, mn = rgb.max(2), rgb.min(2)
    sat = (mx - mn) / np.maximum(mx, 1)
    luma = rgb @ np.array([.3, .59, .11], np.float32)
    dark = np.stack([14 + luma * .10, 16 + luma * .10, 22 + luma * .12], 2)
    k = np.clip((sat - .25) / .2, 0, 1)[:, :, None]
    box[:, :, :3] = (rgb * (1 - k) + dark * k).astype(np.uint8)
save('vitals', v, 480)

# ------------------------------------------------------------ minimap ring
m = solid(crop('c', (1204, 8, 1480, 353)))
cx, cy, rin = 1341 - 1204, 159 - 8, 117
h, w = m.shape[:2]
yy, xx = np.mgrid[0:h, 0:w]
inner = np.hypot(xx - cx, yy - cy) < rin
keep = np.zeros_like(inner)
keep[258:, :] = True                                       # name plate
for bx, by, br in ((1251, 70, 29), (1445, 203, 24), (1432, 255, 24)):   # sun, +, -
    keep |= np.hypot(xx - (bx - 1204), yy - (by - 8)) < br
m[:, :, 3] = np.where(inner & ~keep, 0, m[:, :, 3])
# the globe/mail/target buttons outside the ring go their own way, and a
# corner of the boss frame that strays into the box
m[:, :, 3] = np.where((xx < 40) & (yy > 270), 0, m[:, :, 3])
m = smear(m, (70, 256, 205, 314), 68)                     # zone name and coordinates
# the ring is a touch egg-shaped: whatever dark map edge is left inside it goes too
lum = m[:, :, :3].astype(int).sum(2)
m[:, :, 3] = np.where((np.hypot(xx - cx, yy - cy) < 127) & (lum < 270) & ~keep, 0, m[:, :, 3])
keep[:34, cx - 30:cx + 30] = True                          # the gem on top
m[:, :, 3] = np.where((np.hypot(xx - cx, yy - cy) > 137) & ~keep, 0, m[:, :, 3])
save('minimap', m, 300)

# ------------------------------------------------------------ touch controls (sheet C)
joy = solid(crop('c', (20, 540, 331, 848)))
save('joy_base', joy, 220)
knob = disc(solid(crop('c', (118, 636, 234, 752))), 58, 58, 56)
save('joy_knob', trim(knob), 100)
for name, box in {
    'btn_auto': (1073, 606, 1219, 754), 'btn_attack': (1230, 641, 1431, 843),
    'btn_dash': (1196, 541, 1291, 640), 'btn_target': (1307, 538, 1401, 635),
    'btn_cycle': (1417, 593, 1523, 699), 'btn_swords': (1129, 758, 1234, 864),
    'btn_up': (1427, 758, 1524, 857), 'btn_horse': (1081, 895, 1159, 975),
    'btn_wing': (1172, 895, 1250, 975), 'btn_aim': (1262, 895, 1341, 976),
    'btn_party': (1354, 895, 1432, 975), 'btn_star': (1442, 895, 1520, 975),
}.items():
    save(name, main_blob(solid(crop('c', box))), 180)

# an empty gold ring for skills: the attack button with its middle cut out
ring = solid(crop('c', (1230, 641, 1431, 843)))
rh, rw = ring.shape[:2]
ring = disc(ring, rw / 2 - 1, rh / 2 + 1, 80, inside=False)
save('ring', main_blob(ring), 160)

# empty slot: a "+" cell with the + wiped
slot = solid(crop('c', (388, 758, 472, 842)))
slot = smear(slot, (22, 18, 62, 66), 20)
save('slot', trim(slot), 96)
lock = solid(crop('c', (931, 758, 1016, 842)))
save('slot_lock', trim(lock), 96)

# ------------------------------------------------------------ icons: menu rail and top row
for name, (s, box, fix) in {
    'm_quests': ('a', (1162, 331, 1221, 405), 0), 'm_party': ('a', (1000, 247, 1057, 320), 0),
    'm_guild': ('a', (1080, 246, 1140, 320), 0), 'm_stall': ('a', (997, 416, 1059, 497), 0),
    'm_settings': ('a', (1158, 417, 1219, 497), 0), 'm_friends': ('a', (919, 246, 979, 320), 0),
    'm_pet': ('a', (1157, 245, 1225, 320), 1), 'm_mount': ('a', (918, 328, 980, 406), 0),
    'm_costume': ('a', (999, 328, 1058, 406), 0), 'm_craft': ('a', (1078, 416, 1139, 497), 0),
    'm_bag': ('d', (1174, 13, 1234, 97), 0), 'm_more': ('d', (1247, 14, 1300, 98), 0),
    't_gacha': ('a', (1014, 34, 1071, 122), 1), 't_event': ('d', (1027, 13, 1090, 97), 0),
    't_quest': ('d', (1101, 14, 1160, 97), 0), 't_shop': ('d', (954, 13, 1015, 97), 0),
    't_rank': ('a', (1286, 34, 1342, 121), 1), 't_mail': ('a', (1411, 34, 1469, 121), 1),
}.items():
    ic = solid(crop(s, box))
    ic = icon_above_plate(ic)
    if fix:
        ic = undot(ic)
    save(name, trim(ic), 96)

# character and skills only exist inside the menu panel on sheet D
for name, box in {'m_character': (1070, 233, 1126, 298), 'm_skills': (1218, 244, 1274, 298)}.items():
    ic = crop('d', box)
    ic = key_dark(solid(ic), (38, 38, 42))
    save(name, main_blob(ic), 96)

save('t_map', main_blob(solid(crop('b', (1447, 15, 1511, 80)))), 96)

# currencies
save('coin', trim(disc(solid(crop('d', (410, 18, 460, 66))), 25, 24, 24)), 64)
save('gem_blue', trim(solid(crop('d', (616, 18, 664, 66)))), 64)
save('gem_pink', trim(solid(crop('d', (806, 16, 848, 66)))), 64)

# ------------------------------------------------------------ windows
# a nine-slice frame rebuilt from the character window's clean corners
win = solid(crop('d', (760, 215, 1034, 626)))
C = 32
tr = win[20:20 + C, 241:241 + C]                           # sheet (1001..1033, 235..267)
tl = tr[:, ::-1]
br = tr[::-1]
bl = tr[::-1, ::-1]
top = win[20:20 + C, 230:231]
bot = top[::-1]
right = win[335:336, 241:241 + C]
left = right[:, ::-1]
fill = win[335, 236]
S = 3 * C
nine = np.zeros((S, S, 4), np.uint8)
nine[:, :] = fill
nine[:C, :C], nine[:C, S - C:], nine[S - C:, :C], nine[S - C:, S - C:] = tl, tr, bl, br
nine[:C, C:S - C] = np.repeat(top, C, axis=1)
nine[S - C:, C:S - C] = np.repeat(bot, C, axis=1)
nine[C:S - C, :C] = np.repeat(left, C, axis=0)
nine[C:S - C, S - C:] = np.repeat(right, C, axis=0)
save('window', nine)

# the blue title plate, caption wiped
title = solid(crop('d', (774, 218, 928, 272)))
title = smear(title, (40, 12, 118, 44), 38)
save('title', trim(title))
save('close', trim(disc(solid(crop('d', (705, 220, 750, 266))), 22.5, 23, 21.5)), 64)

# buttons and tabs: shade runs top to bottom, so one column rebuilds them
for name, box, wipe in (
    ('b_gold', (779, 574, 850, 610), (6, 4, 65, 32)),
    ('b_blue', (548, 577, 633, 606), (6, 3, 79, 26)),
    ('b_red', (643, 577, 725, 606), (6, 3, 76, 26)),
    ('tab_on', (387, 287, 465, 322), (6, 4, 72, 31)),
    ('tab_off', (469, 287, 546, 322), (6, 4, 71, 31)),
):
    b = solid(crop('d', box))
    b = smear(b, wipe, wipe[0] - 1)
    save(name, b)

# ------------------------------------------------------------ banners for big moments
for name, (s, box) in {
    'fx_levelup': ('d', (482, 777, 654, 838)), 'fx_questclear': ('d', (754, 782, 917, 833)),
    'fx_miss': ('d', (936, 784, 999, 831)), 'fx_critical': ('d', (1105, 778, 1196, 837)),
}.items():
    save(name, trim(solid(crop(s, box))))

# ------------------------------------------------------------ status icons (buffs blue, debuffs red)
for row, (y0, kind) in enumerate(((312, 'buff'), (405, 'debuff'))):
    for i in range(8):
        x0 = 31 + i * 60
        ic = solid(crop('c', (x0, y0, x0 + 58, y0 + 50)))
        save(f'st_{kind}{i}', trim(ic), 48)

# ------------------------------------------------------------ the bag (sheet E)
def wipe_mid(rgba, x0=.2, x1=.8, y0=.2, y1=.8):
    """Captions sit in the middle of a plate that shades top to bottom."""
    h, w = rgba.shape[:2]
    return smear(rgba, (int(w * x0), int(h * y0), int(w * x1), int(h * y1)), int(w * x0) - 1)


def recolor_rim(rgba, hue=None, sat=1.0, val=1.0):
    """Turn the gold rim of a frame another colour (hue None = silver)."""
    hsv = cv2.cvtColor(np.ascontiguousarray(rgba[:, :, :3]), cv2.COLOR_RGB2HSV).astype(np.float32)
    gold = (hsv[:, :, 1] > 70) & (hsv[:, :, 0] > 8) & (hsv[:, :, 0] < 32)
    if hue is None:
        hsv[:, :, 1] = np.where(gold, hsv[:, :, 1] * .08, hsv[:, :, 1])
        hsv[:, :, 2] = np.where(gold, np.minimum(255, hsv[:, :, 2] * 1.05), hsv[:, :, 2])
    else:
        hsv[:, :, 0] = np.where(gold, hue, hsv[:, :, 0])
        hsv[:, :, 1] = np.where(gold, np.minimum(255, hsv[:, :, 1] * sat), hsv[:, :, 1])
        hsv[:, :, 2] = np.where(gold, np.minimum(255, hsv[:, :, 2] * val), hsv[:, :, 2])
    rgba[:, :, :3] = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
    return rgba


E = lambda box: trim(solid(crop('e', box)))
cell = E((1045, 805, 1088, 846))
save('inv_slot', cell.copy())
# the rim in each rarity's colour (OpenCV hue is 0..180)
for name, hue, sat, val in (('common', None, 1, 1), ('uncommon', 60, 1.1, 1.05), ('rare', 105, 1.2, 1.1),
                            ('epic', 140, 1.1, 1.1), ('legendary', 18, 1.3, 1.25), ('mythic', 176, 1.3, 1.1)):
    save(f'inv_slot_{name}', recolor_rim(cell.copy(), hue, sat, val))
save('inv_sel', E((1157, 805, 1201, 846)))
save('inv_check', E((987, 805, 1030, 846)))
save('inv_new', E((499, 734, 561, 772)))
lockpad = key_dark(solid(crop('e', (1119, 949, 1157, 993))), (38, 41, 49), tol=34)
save('inv_lock', main_blob(lockpad))
for name, box in (('tab', (22, 867, 198, 926)), ('tab_sel', (205, 867, 377, 926)), ('tab_off', (380, 867, 551, 926))):
    save(f'inv_{name}', wipe_mid(E(box), .16, .84, .22, .78))
for name, box in (('b_confirm', (27, 937, 175, 1004)), ('b_cancel', (184, 937, 331, 1004)),
                  ('b_ok', (341, 937, 492, 1004)), ('b_green', (501, 937, 669, 1005))):
    save(f'inv_{name}', wipe_mid(E(box), .14, .86, .2, .8))
for name, box in (('use', (680, 937, 806, 1004)), ('sell', (816, 937, 944, 1004)),
                  ('drop', (954, 937, 1086, 1004)), ('lockbtn', (1100, 937, 1253, 1004))):
    save(f'inv_{name}', E(box))
sort = E((1039, 870, 1190, 920))
save('inv_sort', smear(sort, (22, 10, 100, 40), 21))
search = E((1200, 869, 1511, 921))
save('inv_search', smear(search, (61, 17, 125, 41), 59))   # the placeholder

if len(sys.argv) > 1:
    # contact sheet for eyeballing
    cells = list(made.items())
    cw, ch, cols = 150, 150, 10
    rows = (len(cells) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cw, rows * ch), (90, 60, 110, 255))
    for i, (n, im) in enumerate(cells):
        t = im.copy()
        t.thumbnail((cw - 8, ch - 20))
        sheet.alpha_composite(t, ((i % cols) * cw + 4, (i // cols) * ch + 4))
    sheet.convert('RGB').save(sys.argv[1])
print(len(made), 'pieces')
