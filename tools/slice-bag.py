#!/usr/bin/env python3
"""Cuts the bag window out of the inventory components sheet
(assets/ui/source/inv_sheet2.png) into assets/ui/bag_*.webp.

    python3 tools/slice-bag.py [preview.png]

Tabs and sort chips are painted with their words. Each comes in the
sheet's one state (the first gold, the rest dark), so both states are
rebuilt: the plate is wiped to a blank, and the icon-and-word glyph lifted
off it is laid on the other colour's plate in that plate's ink.
"""
import os
import sys
import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets/ui')
SHEET = np.array(Image.open(os.path.join(ROOT, 'assets/ui/source/inv_sheet2.png')).convert('RGBA'))
made = {}


def crop(box):
    x0, y0, x1, y1 = box
    a = SHEET[y0:y1, x0:x1].copy()
    a[:, :, 3] = np.clip(a[:, :, 3].astype(np.float32) * 255 / 253, 0, 255).astype(np.uint8)
    return a


def trim(rgba, pad=1):
    ys, xs = np.nonzero(rgba[:, :, 3] > 10)
    return rgba[max(0, ys.min() - pad):ys.max() + 1 + pad, max(0, xs.min() - pad):xs.max() + 1 + pad]


def save(name, rgba, width=None):
    im = Image.fromarray(rgba)
    if width and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, f'bag_{name}.webp'), 'WEBP', quality=90, method=6)
    made[name] = im


def smear(rgba, box, src):
    x0, y0, x1, y1 = box
    rgba[y0:y1, x0:x1] = rgba[y0:y1, src:src + 1]
    return rgba


def inner(rgba, fx=.14, fy=.2):
    h, w = rgba.shape[:2]
    return int(w * fx), int(h * fy), int(w * (1 - fx)), int(h * (1 - fy))


def glyph(rgba, dark_ink):
    """Alpha mask of the icon + word painted on a plate."""
    x0, y0, x1, y1 = inner(rgba)
    lum = rgba[:, :, :3].astype(np.float32) @ np.array([.3, .59, .11], np.float32)
    ref = np.median(lum[y0:y1, x0:x0 + 4])
    k = (ref - lum) / 70 if dark_ink else (lum - ref) / 70
    k = np.clip(k - .25, 0, 1)
    m = np.zeros_like(k)
    m[y0:y1, x0:x1] = k[y0:y1, x0:x1]
    return m


def blank(rgba):
    x0, y0, x1, y1 = inner(rgba, .1, .1)
    return smear(rgba.copy(), (x0, y0, x1, y1), x0 - 1)


def ink(base, mask, rgb):
    out = base.copy()
    col = np.array(rgb, np.float32)
    k = mask[:, :, None]
    out[:, :, :3] = (out[:, :, :3] * (1 - k) + col * k).astype(np.uint8)
    return out


def fit(img, shape):
    h, w = shape[:2]
    return np.array(Image.fromarray(img).resize((w, h), Image.LANCZOS))


GOLD_INK, LIGHT_INK = (58, 34, 4), (236, 240, 246)


def icon_of(src, region, dark_ink, cut=105):
    """Lift just the icon (no word) off a plate, in light and dark ink."""
    h, w = src.shape[:2]
    fx0, fy0, fx1, fy1 = region
    x0, y0, x1, y1 = int(w * fx0), int(h * fy0), int(w * fx1), int(h * fy1)
    lum = src[:, :, :3].astype(np.float32) @ np.array([.3, .59, .11], np.float32)
    ref = np.median(lum[y0:y1, x0:x0 + 3])
    # ink on gold is dark in absolute terms; ink on the dark plate is bright relative to it
    k = (np.clip((cut - lum) / 30, 0, 1) if dark_ink else np.clip((lum - ref) / 45 - .3, 0, 1))[y0:y1, x0:x1]
    out = {}
    for name, rgb in (('light', LIGHT_INK), ('dark', GOLD_INK)):
        ic = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
        ic[:, :, :3] = rgb
        ic[:, :, 3] = (k * 255).astype(np.uint8)
        out[name] = trim(ic)
    return out


def plates(boxes, prefix, region, cut=105, first_dark=True):
    """Blank gold and dark plates, plus each entry's icon in both inks."""
    on0 = crop(boxes[0][1])
    save(f'{prefix}_on', blank(on0))
    save(f'{prefix}_off', blank(crop(boxes[1][1])))
    for i, (key, box) in enumerate(boxes):
        ic = icon_of(crop(box), region, dark_ink=(i == 0 and first_dark), cut=cut)
        save(f'{prefix}_i_{key}', ic['light'])
        save(f'{prefix}_i_{key}_d', ic['dark'])


# tabs (icon over the word) and sort chips (icon left of the word)
plates([('all', (29, 40, 175, 139)), ('equip', (180, 43, 335, 139)), ('use', (340, 43, 482, 139)),
        ('mat', (487, 43, 616, 138)), ('quest', (621, 43, 758, 138)), ('other', (762, 43, 909, 138))],
       'tab', (.25, .12, .75, .56))
plates([('latest', (30, 781, 170, 839)), ('level', (178, 782, 314, 839)), ('quality', (322, 782, 461, 839)),
        ('type', (469, 782, 606, 839)), ('name', (614, 782, 750, 839))], 'sort', (.08, .18, .34, .82), first_dark=False)
order = crop((757, 782, 994, 839))
save('order', smear(order, (18, 12, 175, 46), 17))           # "มากไปน้อย" wiped, the arrow kept

# search, the sort toggle
search = crop((929, 53, 1204, 117))
save('search', smear(search, (62, 12, 212, 52), 60))
save('sortbtn', crop((1297, 49, 1510, 118)))

# slots: the plain tile, and overlays with their middles cut out
tile = crop((30, 166, 141, 276))
save('slot', tile)


def ring(box, keep=None):
    r = crop(box)
    h, w = r.shape[:2]
    x0, y0, x1, y1 = int(w * .13), int(h * .13), int(w * .87), int(h * .87)
    hole = np.zeros((h, w), bool)
    hole[y0:y1, x0:x1] = True
    if keep:
        kx0, ky0, kx1, ky1 = keep
        hole[ky0:ky1, kx0:kx1] = False
    r[:, :, 3] = np.where(hole, 0, r[:, :, 3])
    return r


save('sel', ring((162, 166, 274, 277)))
save('can', ring((296, 166, 408, 277)))
can = ring((296, 166, 408, 277))
hsv = cv2.cvtColor(np.ascontiguousarray(can[:, :, :3]), cv2.COLOR_RGB2HSV)
hsv[:, :, 0] = np.where(hsv[:, :, 1] > 50, 62, hsv[:, :, 0])   # the blue glow, turned green: "worn"
eq = can.copy()
eq[:, :, :3] = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
save('eq', eq)
save('e', trim(crop((1452, 340, 1505, 393))))
save('new', trim(crop((1354, 340, 1435, 392))))
lock = crop((466, 200, 512, 246))
lum = lock[:, :, :3].astype(np.float32).mean(2)
lock[:, :, 3] = (np.clip((lum - 60) / 40, 0, 1) * 255).astype(np.uint8)
save('lock', trim(lock))
save('plus', crop((1435, 224, 1505, 295)))

# rarity frames: see-through in the middle, laid over the tile
save('r_common', crop((29, 327, 142, 442)))
magic = crop((161, 324, 274, 441))
save('r_rare', magic)
hsv = cv2.cvtColor(np.ascontiguousarray(magic[:, :, :3]), cv2.COLOR_RGB2HSV)
blue = (hsv[:, :, 0] > 90) & (hsv[:, :, 0] < 130) & (hsv[:, :, 1] > 60)
hsv[:, :, 0] = np.where(blue, 62, hsv[:, :, 0])
green = magic.copy()
green[:, :, :3] = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
save('r_uncommon', green)
save('r_epic', crop((294, 325, 409, 441)))
save('r_legendary', crop((430, 324, 551, 438)))
save('r_mythic', crop((728, 318, 876, 446)))

# weight bar: the words and the fill wiped back to an empty track
wbar = crop((1036, 777, 1450, 831))
save('weight', smear(wbar, (62, 12, 400, 42), 60))
save('wplus', crop((1455, 777, 1510, 832)))
save('expand', crop((1268, 496, 1510, 585)))

# painted action buttons and tags (their words are the point)
for name, box in {'use': (29, 614, 193, 681), 'equip': (203, 614, 354, 681), 'unequip': (363, 614, 506, 681),
                  'sell': (515, 614, 660, 681), 'drop': (669, 615, 807, 681), 'lockbtn': (816, 614, 958, 681),
                  'unlockbtn': (967, 614, 1126, 681)}.items():
    save(f'b_{name}', crop(box))
for name, box in {'new': (29, 933, 103, 973), 'equip': (121, 933, 202, 973), 'lock': (220, 934, 310, 973),
                  'bound': (685, 935, 787, 976), 'nosell': (805, 936, 972, 977)}.items():
    save(f'tag_{name}', crop(box))

if len(sys.argv) > 1:
    cells = list(made.items())
    cw, ch, cols = 170, 110, 9
    rows = (len(cells) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cw, rows * ch), (90, 60, 110, 255))
    for i, (n, im) in enumerate(cells):
        t = im.copy()
        t.thumbnail((cw - 8, ch - 8))
        sheet.alpha_composite(t, ((i % cols) * cw + 4, (i // cols) * ch + 4))
    sheet.convert('RGB').save(sys.argv[1])
print(len(made), 'pieces')
