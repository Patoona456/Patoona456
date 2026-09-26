#!/usr/bin/env python3
"""
Cut the bald chibi base (assets/chibi/source/base_male.png) onto the game's grid,
and fit a hair layer to it.

    python3 tools/slice-base.py

The board is 4 rows (down, left, up, right) of 8 walk frames on a painted
background. Each frame is lifted with GrabCut, then pasted into a 128x192 cell
with its feet on one baseline and its head over the cell's centre. The board's
own steps do not alternate (see "the stride" below), so one frame per row is
kept and its legs are walked here: eight steps, then a standing frame.

Hair: the old walk board (source/hero_brown_grid.png, as cut by
tools/slice-chibi.py) had its hair painted on. That
hair is lifted off it once per facing, scaled to the new skull and set on the
head of every frame, then recoloured, so hair is a layer that can be changed
(or left off) rather than part of the body. Hats and hoods get the same
treatment from the head anchors this writes to shared/data/chibi.js.

Output:
  assets/chibi/body/base_male.png        9 cols (8 steps, then standing) x 4 rows of 128x192
  assets/chibi/hair/spiky_<colour>.png   same grid
  shared/data/chibi.js                   head and fist positions per frame
Needs OpenCV, NumPy and Pillow.
"""
import json, os
import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets/chibi/source/base_male.png')
CELL_W, CELL_H, BASELINE = 128, 192, 184
# The sheet's cells are bigger than the ones the walk is built in: a sword
# swing lunges and raises the blade well past a 128x192 box. Every built cell
# is set in the middle of a 192x224 one, 32px in from each side and the top,
# on the same feet; the swing is registered straight into the big cell.
OUT_W, OUT_H = 192, 224
PAD_X, PAD_Y = (OUT_W - CELL_W) // 2, OUT_H - CELL_H
OUT_BASELINE = BASELINE + PAD_Y
# where each frame sits on the board, read off its number labels
XS = [190, 330, 470, 615, 755, 895, 1040, 1180]
ROWS = [(128, 278), (292, 448), (462, 620), (634, 795)]   # down, left, up, right
HALF_W = 72


def lift(im, cx, y0, y1):
    x0, x1 = cx - HALF_W, cx + HALF_W
    pad = 8
    sub = im[y0 - pad:y1 + pad, x0 - pad:x1 + pad].copy()
    mask = np.zeros(sub.shape[:2], np.uint8)
    bg, fg = np.zeros((1, 65)), np.zeros((1, 65))
    cv2.grabCut(sub, mask, (pad, pad, x1 - x0, y1 - y0), bg, fg, 8, cv2.GC_INIT_WITH_RECT)
    m = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    m = np.where(lab == 1 + np.argmax(st[1:, 4]), 255, 0).astype(np.uint8)
    ff = m.copy()
    cv2.floodFill(ff, np.zeros((m.shape[0] + 2, m.shape[1] + 2), np.uint8), (0, 0), 255)
    m = m | cv2.bitwise_not(ff)
    # a soft rim a pixel wide, so it does not shimmer when shrunk
    m = cv2.GaussianBlur(m, (3, 3), 0)
    rgba = cv2.cvtColor(sub, cv2.COLOR_BGR2RGBA)
    rgba[:, :, 3] = m
    return rgba


def head_of(a):
    """The skull: the rows above the neck. Returns centre x, top y, width, and the neck row."""
    solid = a > 128
    ys = np.nonzero(solid.any(1))[0]
    top, bot = ys[0], ys[-1]
    widths = [(np.ptp(solid[y].nonzero()[0]) + 1) if solid[y].any() else 0 for y in range(a.shape[0])]
    # the neck is the narrowest row between a third and two thirds of the way down the head+body
    lo, hi = top + int((bot - top) * 0.30), top + int((bot - top) * 0.62)
    neck = lo + int(np.argmin(widths[lo:hi]))
    head = solid[top:neck]
    xs = np.nonzero(head.any(0))[0]
    return {'cx': (xs[0] + xs[-1]) / 2, 'top': int(top), 'w': int(xs[-1] - xs[0] + 1), 'neck': int(neck), 'bot': int(bot)}


def stride(a):
    """How far apart the feet are: the width of the bottom eighth of the figure."""
    solid = a > 128
    ys = np.nonzero(solid.any(1))[0]
    band = solid[ys[-1] - (ys[-1] - ys[0]) // 8:ys[-1] + 1]
    xs = np.nonzero(band.any(0))[0]
    return xs[-1] - xs[0]


def register(f):
    """Paste a lifted frame into a cell: feet on the baseline, head over the centre."""
    h = head_of(f[:, :, 3])
    dx = int(round(CELL_W / 2 - h['cx']))
    dy = BASELINE - h['bot']
    H, W = f.shape[:2]
    cell = np.zeros((CELL_H, CELL_W, 4), np.uint8)
    sx0, sy0 = max(0, -dx), max(0, -dy)
    tx0, ty0 = max(0, dx), max(0, dy)
    w = min(W - sx0, CELL_W - tx0)
    hgt = min(H - sy0, CELL_H - ty0)
    cell[ty0:ty0 + hgt, tx0:tx0 + w] = f[sy0:sy0 + hgt, sx0:sx0 + w]
    return cell


# ---- the stride -------------------------------------------------------------
# The board's side views keep the same leg in front in all eight frames, and
# its front and back views barely lift a foot, so a walk drawn from them
# shuffles. The legs are cut off one frame at the hip and walked here instead:
# in the side views they swing past each other about the hip, the leg coming
# forward lifts its foot, and the body rides highest as they pass; facing the
# camera or away, the feet lift in turn and the body shifts over the one on the
# ground. Frame 0 is the legs passing; column 8 is the same pose with both
# feet down, which is the standing frame.
WALK_FRAMES = 8
IDLE_COL = WALK_FRAMES
SIDE_ROWS = (1, 3)
HIP_Y = {0: 150, 1: 146, 2: 150, 3: 146}      # where the legs are cut off, per row
# both fists on the base frames, where they hang near the hip line
HANDS = {0: [(40, 148), (87, 148)], 1: [(84, 145)], 2: [(41, 141), (87, 144)], 3: [(43, 142)]}
FOOT_LIFT = {'side': 6.0, 'front': 10.0}         # frame px at the top of a step
FRONT_BOB, FRONT_SWAY = 2.0, 2.0


def shorts_mask(f):
    """The grey shorts, closed into one piece: they stay on the body."""
    R, G, B = [f[:, :, i].astype(int) for i in range(3)]
    mx = np.maximum(np.maximum(R, G), B)
    mn = np.minimum(np.minimum(R, G), B)
    lum = (3 * R + 6 * G + B) / 10
    grey = (f[:, :, 3] > 100) & ((mx - mn) < 22) & (lum > 70) & (B >= R - 12)
    m = cv2.morphologyEx(grey.astype(np.uint8) * 255, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    return m > 0


def split_legs(f, r):
    """Body, and two leg pieces (full-cell RGBA), for one frame of row r."""
    a = f[:, :, 3] > 0
    shorts = shorts_mask(f)
    hip = HIP_Y[r]
    below = np.zeros_like(a)
    below[hip:] = True
    legs = a & below & ~shorts
    # the fists hang about the hip: keep them (and whatever touches them) on the body
    for fx, fy in HANDS.get(r, []):
        yy, xx = np.ogrid[:CELL_H, :CELL_W]
        legs &= (xx - fx) ** 2 + (yy - fy) ** 2 > 10 ** 2
    # only what reaches the ground is leg: a hand hanging by the hip stays on the body
    n, lab, st, _ = cv2.connectedComponentsWithStats(legs.astype(np.uint8))
    legs = np.isin(lab, [i for i in range(1, n) if st[i, 1] + st[i, 3] >= BASELINE - 4])
    # the dark rim along the shorts' hem is drawn on both, so the body keeps its edge
    # (only the dark rim: skin beside the shorts belongs to the legs, or it
    # stays behind as a pale sliver when they move)
    lum = f[:, :, :3].astype(int) @ np.array([3, 6, 1]) / 10
    rim = (cv2.dilate(shorts.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0) & (lum < 110)
    body_m = a & (~legs | shorts | rim)
    if r in SIDE_ROWS:
        # the feet come apart well before the hip: grow each foot back up its leg
        feet = np.zeros(a.shape, np.int32)
        low = legs.copy()
        low[:BASELINE - 12] = False
        n, lab, st, _ = cv2.connectedComponentsWithStats(low.astype(np.uint8))
        big = sorted(range(1, n), key=lambda i: -st[i, 4])[:2]
        for k, i in enumerate(sorted(big, key=lambda i: st[i, 0])):
            feet[lab == i] = k + 1
        markers = np.where(legs, feet, 0).astype(np.int32)
        markers[~legs] = 3                              # background and body: not a leg
        cv2.watershed(cv2.cvtColor(f[:, :, :3], cv2.COLOR_RGB2BGR), markers)
        sides = [(markers == 1) & legs, (markers == 2) & legs]
    else:
        # facing the camera or away the legs stand side by side: split in
        # the gap between them (the thinnest column near the middle), so
        # neither piece carries a sliver of the other leg
        cols = legs.sum(0)
        c0 = CELL_W // 2
        mid = c0 - 20 + int(np.argmin(cols[c0 - 20:c0 + 21]))
        left = legs.copy(); left[:, mid:] = False
        right = legs.copy(); right[:, :mid] = False
        sides = [left, right]
    piece = lambda m: np.where(m[..., None], f, 0).astype(np.uint8)
    return piece(body_m), [piece(m) for m in sides]


def extend_up(leg, hip, shorts, rows=14):
    """Smear a leg up from its own top edge, behind the shorts: its top sits
    under their hem, so turning or lifting it must not open a gap there. Only
    columns where the shorts come right down onto the leg; the rest of the
    leg's outline is its real edge. (Drawn behind the body, the smear shows
    only where a gap would have.)"""
    out = leg.copy()
    solid = out[:, :, 3] > 200
    for x in range(out.shape[1]):
        ys = np.nonzero(solid[:, x])[0]
        if not len(ys):
            continue
        y0 = ys[0]
        if not shorts[max(0, y0 - 4):y0 + 1, x].any():
            continue
        for y in range(max(0, min(y0, hip) - rows), y0):
            out[y, x] = out[y0, x]
    return out


def foot_of(leg):
    ys, xs = np.nonzero(leg[:, :, 3] > 100)
    foot = ys > ys.max() - 8
    return np.array([xs[foot].mean(), ys[foot].mean()])


def transform(piece, M):
    """Warp an RGBA piece with a 2x3 matrix, on premultiplied alpha so edges stay clean."""
    pm = piece.astype(np.float32)
    pm[:, :, :3] *= pm[:, :, 3:4] / 255
    out = cv2.warpAffine(pm, M, (CELL_W, CELL_H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    a = out[:, :, 3:4]
    out[:, :, :3] = np.where(a > 0, out[:, :, :3] * 255 / np.maximum(a, 1e-3), 0)
    return np.clip(out, 0, 255).astype(np.uint8)


def over(dst, src):
    a = src[:, :, 3:4].astype(np.float32) / 255
    out = dst.astype(np.float32)
    out[:, :, :3] = src[:, :, :3] * a + out[:, :, :3] * (1 - a)
    out[:, :, 3:4] = src[:, :, 3:4] + out[:, :, 3:4] * (1 - a)
    return out.astype(np.uint8)


def shade(piece, k):
    """The far leg, a little in shadow: darker, and warmer rather than greyer."""
    out = piece.copy()
    out[:, :, :3] = np.clip(out[:, :, :3].astype(np.float32) * np.array([k + 0.03, k - 0.02, k - 0.04]), 0, 255).astype(np.uint8)
    return out


def shift(dx, dy):
    return np.float32([[1, 0, dx], [0, 1, dy]])


def walk_side(f, r):
    """Eight steps and a stand from one side frame, legs swinging past each other."""
    hip = HIP_Y[r]
    body, legs = split_legs(f, r)
    fwd = -1 if r == 1 else 1                         # which way is forward in x
    # both legs hang from one hip joint, under the middle of the shorts
    sm = shorts_mask(f)
    ys, xs = np.nonzero(sm)
    piv = np.array([xs.mean(), ys.max() - 6.0])
    info = []
    for l in legs:
        v = foot_of(l) - piv
        info.append({'img': l, 'piv': piv, 'len': float(np.hypot(*v)), 'ang': float(np.arctan2(v[0] * fwd, v[1]))})
    front, back = sorted(info, key=lambda i: -i['ang'])
    a0 = 0.9 * (abs(front['ang']) + abs(back['ang'])) / 2
    L = (front['len'] + back['len']) / 2

    # a leg shows below the hip, or behind the shorts; nowhere else
    # (a little past the shorts' edge, so no hairline opens under the hem)
    under = cv2.dilate(sm.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0

    def leg_at(theta, lift, dy, far):
        src = front if theta >= 0 else back
        # turn the picture from its own angle to theta, about the hip; with
        # y down, a positive cv2 angle turns the foot toward +x
        deg = np.degrees(theta - src['ang']) * fwd
        M = cv2.getRotationMatrix2D(tuple(src['piv']), deg, 1.0)
        M[1, 2] += dy - lift
        # the far leg sits a little behind the near one, so the two read as two
        M[0, 2] -= fwd * 3 if far else 0
        img = transform(src['img'], M)
        keep = np.zeros(under.shape, bool)
        keep[hip + dy:] = True
        keep |= np.roll(under, dy, axis=0)
        img[~keep] = 0
        # filled up behind the shorts after turning, so the fill stays behind them
        img = extend_up(img, hip + dy, np.roll(sm, dy, axis=0))
        return shade(img, 0.9) if far else img

    frames, offs = [], []
    for k in range(WALK_FRAMES + 1):
        idle = k == IDLE_COL
        phi = 0.0 if idle else 2 * np.pi * k / WALK_FRAMES
        th = a0 * np.sin(phi)
        # the leg on its way forward is the one off the ground
        lift_near = 0 if idle else FOOT_LIFT['side'] * max(0.0, np.cos(phi)) ** 1.5
        lift_far = 0 if idle else FOOT_LIFT['side'] * max(0.0, -np.cos(phi)) ** 1.5
        bob = -round(L * (np.cos(th) - np.cos(a0)))
        cell = np.zeros((CELL_H, CELL_W, 4), np.uint8)
        cell = over(cell, leg_at(-th, lift_far, bob, True))
        cell = over(cell, leg_at(th, lift_near, bob, False))
        cell = over(cell, transform(body, shift(0, bob)))
        frames.append(cell)
        offs.append((0, bob))
    return frames, offs


def walk_front(f, r):
    """Eight steps and a stand facing the camera or away: the feet lift in turn."""
    hip = HIP_Y[r]
    body, (left, right) = split_legs(f, r)
    sm = shorts_mask(f)
    left, right = extend_up(left, hip, sm), extend_up(right, hip, sm)
    frames, offs = [], []
    for k in range(WALK_FRAMES + 1):
        idle = k == IDLE_COL
        phi = 0.0 if idle else 2 * np.pi * k / WALK_FRAMES
        sn = 0.0 if idle else np.sin(phi)
        lift_l = FOOT_LIFT['front'] * max(0.0, sn) ** 1.2
        lift_r = FOOT_LIFT['front'] * max(0.0, -sn) ** 1.2
        # the body settles onto the foot on the ground and leans over it
        # (settling, not rising: rising would lift the hem off the legs' cut)
        bob = round(FRONT_BOB * abs(sn))
        sway = round(FRONT_SWAY * sn)                 # left foot up: weight on the right
        cell = np.zeros((CELL_H, CELL_W, 4), np.uint8)
        cell = over(cell, transform(left, shift(0, -lift_l)))
        cell = over(cell, transform(right, shift(0, -lift_r)))
        cell = over(cell, transform(body, shift(sway, bob)))
        frames.append(cell)
        offs.append((sway, bob))
    return frames, offs


def main():
    """The sheet (9 columns: 8 steps and a stand), the head table, and each
    row's base frame and per-column body offsets (for the fist table)."""
    im = cv2.imread(SRC)
    lifted = [[register(lift(im, cx, y0, y1)) for cx in XS] for (y0, y1) in ROWS]
    sheet = np.zeros((CELL_H * 4, CELL_W * (WALK_FRAMES + 1), 4), np.uint8)
    heads, bases = [], []
    for r, row in enumerate(lifted):
        if r in SIDE_ROWS:
            # the frame with the legs furthest apart cuts most cleanly
            k = int(np.argmax([stride(c[:, :, 3]) for c in row]))
            frames, offs = walk_side(row[k], r)
        else:
            k = int(np.argmin([stride(c[:, :, 3]) for c in row]))
            frames, offs = walk_front(row[k], r)
        bases.append((row[k], offs))
        hs = []
        for c, cell in enumerate(frames):
            sheet[r * CELL_H:(r + 1) * CELL_H, c * CELL_W:(c + 1) * CELL_W] = cell
            h = head_of(cell[:, :, 3])
            hs.append({'cx': h['cx'], 'top': h['top'], 'w': h['w'], 'neck': h['neck']})
        heads.append(hs)
    return sheet, heads, bases


HAIR_ROWS = [0, 2, 4, 6]      # down, left, up, right on the old DIR8 sheet
# how each facing's hair sits on the new skull: width as a share of the
# head's, and the offset of its top-centre from the head's top-centre
HAIR_FIT = [
    {'w': 1.16, 'dx': 0, 'dy': -8},     # down
    {'w': 1.20, 'dx': 4, 'dy': -8},     # left
    {'w': 1.13, 'dx': 0, 'dy': -8},     # up
    {'w': 1.20, 'dx': -4, 'dy': -8},    # right
]
HAIR_COLOURS = {
    # target colour of the hair's mid tone, as RGB
    'brown': None,
    'black': (58, 50, 58),
    'blonde': (226, 184, 104),
    'white': (222, 222, 230),
}


def old_hair():
    """The hair painted on the old board, one picture per facing, trimmed."""
    body = cv2.imread(os.path.join(ROOT, 'assets/chibi/source/hero_brown_grid.png'), cv2.IMREAD_UNCHANGED)
    out = []
    for r in HAIR_ROWS:
        f = body[r * 192:(r + 1) * 192, 0:128].copy()
        a = f[:, :, 3]
        b, g, rr = [f[:, :, i].astype(int) for i in range(3)]
        lum = (rr * 3 + g * 6 + b) / 10
        skin = (lum > 150) & (rr - b > 45) & (rr > 215)
        hairish = ((a > 60) & (rr - b > 18) & ~skin & (lum < 200)).astype(np.uint8) * 255
        hairish[104 if r == 4 else 100:] = 0          # the neck and chin below it
        op = cv2.morphologyEx(hairish, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        n, lab, st, _ = cv2.connectedComponentsWithStats(op)
        m = np.where(lab == 1 + np.argmax(st[1:, 4]), 255, 0).astype(np.uint8)
        # grow back the strands and the outline the opening shaved off
        for _ in range(3):
            m = cv2.dilate(m, np.ones((3, 3), np.uint8)) & hairish
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
        f[:, :, 3] = np.minimum(a, m)
        ys, xs = np.nonzero(f[:, :, 3] > 8)
        out.append(cv2.cvtColor(f[ys.min():ys.max() + 1, xs.min():xs.max() + 1], cv2.COLOR_BGRA2RGBA))
    return out


def recolour(rgba, target):
    """Move the hair's hue and brightness to another colour, keeping its shading."""
    if target is None:
        return rgba
    out = rgba.copy()
    rgb = rgba[:, :, :3].astype(np.float32)
    lum = rgb @ np.array([0.3, 0.59, 0.11], np.float32)
    solid = rgba[:, :, 3] > 128
    mid = float(np.median(lum[solid]))
    t = np.array(target, np.float32)
    tl = float(t @ np.array([0.3, 0.59, 0.11], np.float32))
    # shade relative to the mid tone, applied to the target colour
    k = (lum / max(mid, 1))[..., None]
    # shadows go deeper than a straight scale, so pale hair keeps its outline
    col = np.where(k <= 1, t * np.power(k, 1.5 if tl > 150 else 1.0), t + (255 - t) * np.clip((k - 1) * mid / max(255 - mid, 1), 0, 1) * (1 if tl < 200 else 0.4))
    out[:, :, :3] = np.clip(col, 0, 255).astype(np.uint8)
    return out


def place(dst, piece, x0, y0):
    """Alpha-over a piece into a cell at an integer offset, clipped to the cell."""
    H, W = piece.shape[:2]
    sx0, sy0 = max(0, -x0), max(0, -y0)
    tx0, ty0 = max(0, x0), max(0, y0)
    w = min(W - sx0, dst.shape[1] - tx0)
    h = min(H - sy0, dst.shape[0] - ty0)
    if w <= 0 or h <= 0:
        return
    src = piece[sy0:sy0 + h, sx0:sx0 + w].astype(np.float32)
    d = dst[ty0:ty0 + h, tx0:tx0 + w].astype(np.float32)
    a = src[:, :, 3:4] / 255
    d[:, :, :3] = src[:, :, :3] * a + d[:, :, :3] * (1 - a)
    d[:, :, 3:4] = src[:, :, 3:4] + d[:, :, 3:4] * (1 - a)
    dst[ty0:ty0 + h, tx0:tx0 + w] = d.astype(np.uint8)


def hair_sheet(heads, pieces, colour, arms={}, cw=OUT_W, ch=OUT_H):
    CELL_W, CELL_H = cw, ch
    sheet = np.zeros((CELL_H * 4, CELL_W * len(heads[0]), 4), np.uint8)
    for r, row in enumerate(heads):
        fit = HAIR_FIT[r]
        base = recolour(pieces[r], HAIR_COLOURS[colour])
        w = round(row[0]['w'] * fit['w'])
        scaled = np.array(Image.fromarray(base).resize((w, round(base.shape[0] * w / base.shape[1])), Image.LANCZOS))
        for c, h in enumerate(row):
            cell = sheet[r * CELL_H:(r + 1) * CELL_H, c * CELL_W:(c + 1) * CELL_W]
            place(cell, scaled, round(h['cx'] + fit['dx'] - w / 2), h['top'] + fit['dy'])
            if (r, c) in arms:
                cell[:, :, 3] = np.where(arms[(r, c)], 0, cell[:, :, 3])
    return sheet


def arm_mask(cell, how):
    kind, spec = how
    if kind == 'band':
        x1, y1, x2, y2, rad = spec
        m = np.zeros(cell.shape[:2], np.uint8)
        cv2.line(m, (x1, y1), (x2, y2), 1, rad * 2)
        cv2.circle(m, (x1, y1), rad + 3, 1, -1)
        return m > 0
    return arm_fill(cell, spec)


def arm_fill(cell, seeds):
    """The raised arm, exactly: the pieces of the body between ink lines that
    the seed points (fist, forearm, upper arm) fall in, with their outline.
    The skull round the arm is on the other side of the arm's outline."""
    R, G, B = [cell[:, :, i].astype(int) for i in range(3)]
    solid = cell[:, :, 3] > 100
    ink = ((3 * R + 6 * G + B) / 10 < 110) & solid
    ink = cv2.morphologyEx(ink.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)) > 0
    n, lab = cv2.connectedComponents((solid & ~ink).astype(np.uint8))
    hit = {lab[y, x] for x, y in seeds if lab[y, x]}
    m = np.isin(lab, list(hit)).astype(np.uint8)
    m = cv2.dilate(m, np.ones((5, 5), np.uint8)) & (m | ink.astype(np.uint8))
    return m > 0


# With the sword raised the arms go up in front of the head (or, seen from
# behind, up past it), so the hair is cut away where each arm is, to let the
# hands show: points inside the arm (fist, forearm, upper arm), in cell pixels.
# From behind, the arm passes behind the head and only the fist is over it.
# In front of the head the arm's outline is broken where it meets the skull,
# so there the arm is its centre line, fist to shoulder, at its drawn width
# (x1, y1, x2, y2, half-width), a little wider round the fist. From behind,
# the arm passes behind the head and only the fist shows over it: that one is
# found by filling from points inside it.
RAISED_ARMS = {
    (0, 22): ('band', (79, 62, 96, 140, 8)),
    (1, 22): ('band', (78, 63, 90, 138, 8)),
    (2, 22): ('seeds', [(122, 52), (130, 87)]),
    (3, 22): ('band', (113, 57, 101, 133, 8)),
}


# the weapon fist on each row's base frame, found by eye; the body carries it
FIST_SEED = [(87, 148), (84, 145), (87, 144), (43, 142)]


def fists_of(bases):
    return [[[FIST_SEED[r][0] + dx, FIST_SEED[r][1] + dy] for dx, dy in offs] for r, (_, offs) in enumerate(bases)]


def write_table(heads, fists):
    rows = ['down', 'left', 'up', 'right']
    with open(os.path.join(ROOT, 'shared/data/chibi.js'), 'w') as fp:
        fp.write('// Generated by tools/slice-base.py from assets/chibi/source/base_male.png.\n')
        fp.write('// Per row (down, left, up, right) and column (8 walk frames, the standing frame,\n// 10 of a bow shot, 10 of a sword swing), in pixels of the 192x224 cell.\n\n')
        fp.write('/** The skull: centre x, top of the head, width, and the neck row. Hats and hair sit on this. */\n')
        fp.write('export const CHIBI_HEADS = [\n')
        for name, row in zip(rows, heads):
            cells = ', '.join(f"{{ x: {round(h['cx'])}, top: {h['top']}, w: {h['w']}, neck: {h['neck']} }}" for h in row)
            fp.write(f'  [{cells}], // {name}\n')
        fp.write('];\n\n/** The weapon fist\'s centre. */\nexport const CHIBI_FISTS = [\n')
        for name, row in zip(rows, fists):
            fp.write(f"  {json.dumps(row)}, // {name}\n")
        fp.write('];\n')


# ---- the bow shot -----------------------------------------------------------
# assets/chibi/source/base_shoot.png: ten frames of drawing and loosing a bow,
# in the same four rows, already cut out. It is drawn a little bigger than the
# walk board, so each row is scaled to the walk's own head width, set on the
# same baseline, and appended after the standing column (columns 9-18).
SHOOT_SRC = os.path.join(ROOT, 'assets/chibi/source/base_shoot.png')
SHOOT_FRAMES = 10
# which way the bow arm reaches in each row, as seen on screen: the character's
# left hand holds the bow (the board's red anchor), which is the viewer's right
# facing the camera and away, and the leading hand in profile
BOW_REACH = [1, -1, 1, 1]


def shoot_frames():
    raw = cv2.imread(SHOOT_SRC, cv2.IMREAD_UNCHANGED)
    rgba = cv2.cvtColor(raw, cv2.COLOR_BGRA2RGBA)
    n, lab, st, _ = cv2.connectedComponentsWithStats((raw[:, :, 3] > 128).astype(np.uint8))
    # the figures: tall pieces of a figure's size, not the legend or the labels
    figs = [i for i in range(1, n) if 150 < st[i, 3] < 200 and 80 < st[i, 2] < 130 and st[i, 0] > 100 and st[i, 0] < 1320]
    rows = {}
    for i in figs:
        rows.setdefault(int(st[i, 1] // 200), []).append(i)
    out = []
    for key in sorted(rows):
        ids = sorted(rows[key], key=lambda i: st[i, 0])
        assert len(ids) == SHOOT_FRAMES, (key, len(ids))
        row = []
        for i in ids:
            x, y, w, h = st[i, :4]
            piece = rgba[y:y + h, x:x + w].copy()
            piece[:, :, 3] = np.where(lab[y:y + h, x:x + w] == i, piece[:, :, 3], 0)
            row.append(piece)
        out.append(row)
    assert len(out) == 4
    return out


def scaled(piece, k):
    im = Image.fromarray(piece)
    return np.asarray(im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS))


def bow_hand(cell, r, head, relaxed=False):
    """The bow fist: the furthest point of the figure toward the bow side,
    between the neck and the hip, pulled back to the middle of the fist."""
    a = cell[:, :, 3] > 128
    # from the neck to a little below the waistband: the legs spread wide in
    # this pose and would otherwise pass for the reaching hand
    sm = shorts_mask(cell)
    rows_ = np.nonzero(sm.sum(1) > 15)[0]
    rows_ = rows_[rows_ > head['neck'] + 10]           # (grey in the eyes is not shorts)
    waist = int(rows_.min()) if len(rows_) else head['neck'] + 24
    # at ease (the first and last frames) the fist hangs by the waistband;
    # drawing, the arm is up at the shoulder, well above it
    band = np.zeros_like(a)
    # (facing the camera the bow is always below the chin: start at the neck)
    top = head['neck'] - (4 if relaxed or r == 0 else 16)
    band[top:waist + 10 if relaxed else waist - 4] = True
    ys, xs = np.nonzero(a & band)
    d = BOW_REACH[r]
    # furthest out, and of two points about as far out the lower one: a fist
    # hangs below the shoulder it belongs to
    score = d * xs + 0.35 * ys
    i = int(np.argmax(score))
    tx, ty = xs[i], ys[i]
    near = (np.abs(xs - tx) <= 7) & (np.abs(ys - ty) <= 9)
    return [int(round(tx - d * 6)), int(round(ys[near].mean()))]


def main_shoot(heads_walk):
    frames = shoot_frames()
    cells, heads, fists = [], [], []
    for r, row in enumerate(frames):
        k = heads_walk[r][-1]['w'] / head_of(row[0][:, :, 3])['w']
        rc, rh, rf = [], [], []
        for piece in row:
            cell = register(scaled(piece, k))
            h = head_of(cell[:, :, 3])
            rc.append(cell)
            rh.append({'cx': h['cx'], 'top': h['top'], 'w': h['w'], 'neck': h['neck']})
            rf.append(bow_hand(cell, r, h, relaxed=len(rf) in (0, SHOOT_FRAMES - 1)))
        cells.append(rc); heads.append(rh); fists.append(rf)
    return cells, heads, fists


# ---- the sword swing --------------------------------------------------------
# assets/chibi/source/base_slash.png: the swordsman's body alone, bare hands
# closed round a grip that is not there, so any sword can be put in them. The
# board has thirteen columns on a painted backdrop (its labels repeat 05, 06
# and 08); these ten are the swing's phases - ready, grip, draw back, raised,
# cut, cut through, follow through, ease, return, ready - and go in columns
# 19-28. The fist the sword sits in is set per frame in SLASH_FISTS below,
# read off the art and checked on tools/slash-preview output.
SLASH_SRC = os.path.join(ROOT, 'assets/chibi/source/base_slash.png')
SLASH_COLS = [0, 1, 2, 3, 4, 5, 7, 8, 10, 12]
# each board column's centre, per row, from its number label
SLASH_XS = [
    [145, 245, 350, 450, 555, 667, 782, 907, 1023, 1132, 1245, 1357, 1473],
    [144, 242, 349, 449, 553, 667, 782, 907, 1023, 1140, 1248, 1357, 1471],
    [144, 244, 350, 450, 555, 667, 782, 907, 1023, 1132, 1245, 1357, 1477],
    [139, 236, 339, 453, 553, 667, 782, 907, 1023, 1140, 1250, 1357, 1473],
]
SLASH_ROWS = [(60, 256), (298, 500), (543, 745), (786, 1000)]
SLASH_FRAMES = len(SLASH_COLS)
# The sword fist in each of the ten frames, in pixels of the sheet's 192x224
# cell, read off the cut frames by eye (where both hands close on the grip,
# the point between them). Facing away, the hands are hidden in front of the
# body at ready; the point is where they would be.
SLASH_FISTS = [
    [[96, 172], [84, 166], [56, 135], [76, 63], [94, 173], [136, 143], [40, 172], [62, 137], [132, 150], [91, 168]],   # down
    [[69, 159], [58, 148], [58, 135], [74, 63], [56, 146], [53, 143], [49, 146], [80, 157], [65, 153], [73, 155]],     # left
    [[104, 150], [136, 135], [137, 121], [121, 49], [134, 135], [139, 134], [159, 161], [146, 153], [67, 150], [104, 150]],  # up
    [[121, 153], [132, 139], [134, 135], [114, 62], [118, 144], [134, 139], [137, 135], [130, 155], [137, 143], [121, 152]],  # right
]


SLASH_HALF = 112


def lift_outlined(im, cx, y0, y1):
    """Lift a figure by its ink line. The outline round every figure is far
    darker than the backdrop behind it, so the backdrop is flooded in from the
    window's sides, stopping at the ink, and whatever it cannot reach is the
    figure; pinholes in the line are sealed with the smallest closing that
    leaves a whole, solid figure. Where the line has a real gap (under some
    raised arms) the flood still gets in, so anything it reached that is skin
    or the grey shorts - the backdrop is neither - is taken back, with the ink
    that edges it."""
    # (the board's left margin carries the row labels on a dark vignette)
    x0, x1 = max(cx - SLASH_HALF, 104), cx + SLASH_HALF
    clamped = x0 != cx - SLASH_HALF
    if clamped:          # and pulled in on the right, clear of the next figure along
        x1 = cx + 62
    sub = im[y0:y1, x0:x1].copy()
    b, g, r = [sub[:, :, i].astype(int) for i in range(3)]
    lum = (3 * r + 6 * g + b) / 10
    vignette = cv2.blur(lum.astype(np.float32), (41, 41)) < 95
    ink = ((lum < 72) & ~vignette).astype(np.uint8)
    h, w = ink.shape

    def solid(i):
        return st[i, 4] / float(st[i, 2] * st[i, 3])
    for k in (3, 5, 7, 9, 11, 13):
        ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
        wall = cv2.dilate(cv2.morphologyEx(ink, cv2.MORPH_CLOSE, ker), np.ones((3, 3), np.uint8))
        flood = wall.copy()
        ff = np.zeros((h + 2, w + 2), np.uint8)
        # from the sides: a raised fist or a foot may touch the top or bottom.
        # A window clamped at the margin cuts through the figure on its left
        # edge, so that one floods from the top instead.
        seeds = [(x, y) for y in range(h) for x in ((w - 1,) if clamped else (0, w - 1))]
        if clamped:
            seeds += [(x, 0) for x in range(w)]
        for x, y in seeds:
            if flood[y, x] == 0:
                cv2.floodFill(flood, ff, (x, y), 2)
        m = cv2.erode((flood != 2).astype(np.uint8), np.ones((3, 3), np.uint8))
        n, lab, st, _ = cv2.connectedComponentsWithStats(m)
        mids = [i for i in range(1, n) if abs(st[i, 0] + st[i, 2] / 2 - w / 2) < 40 and st[i, 4] > 1500]
        if not mids:
            continue
        big = max(mids, key=lambda i: st[i, 4])
        bx, by, bw, bh = st[big, :4]
        if bh > (y1 - y0) * 0.72 and (bx > 1 or clamped) and bx + bw < w - 1 and solid(big) > 0.2:
            break
    keep = [big] + [i for i in range(1, n) if i != big and st[i, 4] > st[big, 4] * 0.05 and solid(i) > 0.3
                    and abs(st[i, 0] + st[i, 2] / 2 - w / 2) < 45]
    m = np.isin(lab, keep).astype(np.uint8)

    # take back what a gap let the flood reach: skin and shorts touching the figure
    spread = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    shorts = (spread < 26) & (lum > 60) & (lum < 190) & (b >= r - 12) & ~vignette
    body = (((lum > 172) & (r > 200)) | shorts).astype(np.uint8)
    grown = m | body
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats(grown)
    core = np.unique(lab2[m > 0])
    grown = np.isin(lab2, core[core > 0]).astype(np.uint8)
    edge = cv2.dilate(grown, np.ones((5, 5), np.uint8)) & ink
    m = (grown | edge) * 255
    # fill the holes (from a zero border: the figure may touch the window's corner)
    fill = cv2.copyMakeBorder(m, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
    cv2.floodFill(fill, np.zeros((h + 4, w + 4), np.uint8), (0, 0), 255)
    m = m | cv2.bitwise_not(fill[1:-1, 1:-1])
    m = cv2.GaussianBlur(m, (3, 3), 0)
    rgba = cv2.cvtColor(sub, cv2.COLOR_BGR2RGBA)
    rgba[:, :, 3] = m
    return rgba


def slash_frames(heads_walk):
    im = cv2.imread(SLASH_SRC)
    cells, heads = [], []
    for r, (y0, y1) in enumerate(SLASH_ROWS):
        rc, rh = [], []
        k = None
        for c in SLASH_COLS:
            piece = lift_outlined(im, SLASH_XS[r][c], y0, y1)
            if k is None:        # one scale per row, from its first frame: the head matches the walk's
                k = heads_walk[r][-1]['w'] / head_of(piece[:, :, 3])['w']
            cell = register_out(scaled(piece, k))
            h = head_of(cell[:, :, 3])
            rc.append(cell)
            rh.append({'cx': h['cx'], 'top': h['top'], 'w': h['w'], 'neck': h['neck']})
        cells.append(rc); heads.append(rh)
    return cells, heads


def register_out(f):
    """register(), into the sheet's big cell."""
    h = head_of(f[:, :, 3])
    cell = np.zeros((OUT_H, OUT_W, 4), np.uint8)
    place(cell, f, int(round(OUT_W / 2 - h['cx'])), OUT_BASELINE - h['bot'])
    return cell


if __name__ == '__main__':
    sheet, heads, bases = main()
    s_cells, s_heads, s_fists = main_shoot(heads)
    x_cells, x_heads = slash_frames(heads)
    built = WALK_FRAMES + 1 + SHOOT_FRAMES
    out = np.zeros((OUT_H * 4, OUT_W * (built + SLASH_FRAMES), 4), np.uint8)
    shift = lambda h: {**h, 'cx': h['cx'] + PAD_X, 'top': h['top'] + PAD_Y, 'neck': h['neck'] + PAD_Y}
    fists = [w + sh for w, sh in zip(fists_of(bases), s_fists)]
    for r in range(4):
        small = [sheet[r * CELL_H:(r + 1) * CELL_H, c * CELL_W:(c + 1) * CELL_W] for c in range(WALK_FRAMES + 1)]
        for c, cell in enumerate(small + s_cells[r]):
            out[r * OUT_H + PAD_Y:(r + 1) * OUT_H, c * OUT_W + PAD_X:c * OUT_W + PAD_X + CELL_W] = cell
        for c, cell in enumerate(x_cells[r]):
            out[r * OUT_H:(r + 1) * OUT_H, (built + c) * OUT_W:(built + c + 1) * OUT_W] = cell
        heads[r] = [shift(h) for h in heads[r] + s_heads[r]] + x_heads[r]
        fists[r] = [[x + PAD_X, y + PAD_Y] for x, y in fists[r]] + SLASH_FISTS[r]
    pieces = old_hair()
    arms = {(r, c): arm_mask(out[r * OUT_H:(r + 1) * OUT_H, c * OUT_W:(c + 1) * OUT_W], line)
            for (r, c), line in RAISED_ARMS.items()}
    os.makedirs(os.path.join(ROOT, 'assets/chibi/hair'), exist_ok=True)
    Image.fromarray(out).save(os.path.join(ROOT, 'assets/chibi/body/base_male.png'), optimize=True)
    for colour in HAIR_COLOURS:
        Image.fromarray(hair_sheet(heads, pieces, colour, arms)).save(os.path.join(ROOT, f'assets/chibi/hair/spiky_{colour}.png'), optimize=True)
    write_table(heads, fists)
    print('wrote base_male, hair x', len(HAIR_COLOURS), 'and shared/data/chibi.js')
