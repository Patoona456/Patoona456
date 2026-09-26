#!/usr/bin/env python3
"""Cuts a monster animation sheet into one atlas the client plays frame by frame.

    python3 tools/slice-mob.py blue_slime [preview.png]

The sheets are painted: every animation is a row of frames on a soft blue
backdrop, with a title card above. The creature is told from the backdrop by
colour (see MOBS[..]['solid']), holes inside it are filled, and each row is
split into frames where a run of empty columns falls between them.

Every frame of an animation goes into a cell of one size, lined up on the
creature's feet (the bottom of its largest piece) and the middle of that piece,
so a frame never jumps against the next. Writes:

    assets/mob/<key>.webp            the atlas, one animation per row
    shared/data/mobart.js            the cell size and frame counts, per sheet
"""
import json
import os
import re
import sys
import cv2
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')

MOBS = {
    'blue_slime': {
        'src': 'assets/mob/source/blue_slime_sheet.png',
        # the slime's blue has almost no red in it; the backdrop's always does
        'solid': lambda R, G, B: ((R < 34) & (B > 40)) | ((R > 170) & (G > 130) & (B < 150)),
        'x0': 182,
        # name, top, bottom, frames
        'rows': [('idle', 174, 282, 9), ('walk', 294, 396, 9), ('run', 412, 510, 6), ('attack', 524, 652, 7),
                 ('hit', 660, 768, 8), ('death', 776, 876, 8), ('spawn', 886, 1012, 10)],
        # the sheet faces left
        'faces': 'left',
        'scale': .5,
        # atlas pixels to world pixels: a body about thirty wide, knee-high to a player
        'show': .56,
    },
    'mushroom': {
        'src': 'assets/mob/source/mushroom_sheet.png',
        # painted on a transparent sheet: the picture's own alpha is the mask
        'alpha': True,
        'x0': 196,
        'rows': [('idle', 18, 126, 8), ('walk', 151, 250, 9), ('run', 277, 379, 8), ('attack', 392, 522, 8),
                 ('skill', 522, 674, 7), ('hit', 684, 799, 8), ('death', 808, 897, 9), ('spawn', 912, 1007, 10)],
        'faces': 'left',
        'scale': .5,
        # a little bigger than the slime: the cap is about thirty-six across
        'show': .58,
    },
    'caterpillar': {
        'src': 'assets/mob/source/caterpillar_sheet.png',
        'alpha': True,
        # the row labels end at 150; the item panel under the rows is not cut
        'x0': 150,
        'rows': [('idle', 12, 105, 9), ('walk', 113, 209, 9), ('run', 216, 312, 8), ('attack', 331, 433, 8),
                 ('skill', 433, 553, 7), ('hit', 556, 651, 9), ('death', 663, 753, 8), ('spawn', 761, 856, 8)],
        'faces': 'left',
        'scale': .5,
        # long and low: about forty across, a head shorter than the mushroom
        'show': .56,
    },
    'forest_bee': {
        'src': 'assets/mob/source/bee_sheet.png',
        'alpha': True,
        'x0': 170,
        # the sheet's FLY and MOVE rows are the walk and run of a flyer
        'rows': [('idle', 13, 97, 10), ('walk', 118, 206, 12), ('run', 234, 309, 8), ('attack', 332, 428, 11),
                 ('skill', 428, 550, 8), ('hit', 554, 652, 9), ('death', 657, 737, 10), ('spawn', 744, 859, 9)],
        'faces': 'left',
        'scale': .5,
        # about the slime's size; it flies above its shadow
        'show': .6,
    },
    'forest_spirit': {
        'src': 'assets/mob/source/spirit_sheet.png',
        'alpha': True,
        'x0': 162,
        # the bolt and the vines are painted beside the attack and skill rows;
        # they are cut apart into their own strip (see FX below)
        'rows': [('idle', 8, 124, 6, (262, 1000)), ('walk', 124, 221, 8, (162, 965)), ('run', 124, 221, 8, (162, 965)),
                 ('attack', 221, 318, 6, (162, 770)), ('skill', 318, 440, 6, (162, 830)),
                 ('hit', 440, 540, 6, (162, 810)),
                 # it melts into a heap of leaves that scatter: no body to find
                 # in the last frames, so the columns are given
                 ('death', 540, 626, 9, (162, 1160, [277, 376, 483, 593, 721, 832, 950, 1036])),
                 ('spawn', 626, 745, 8, (162, 1010))],
        # Effects painted on the sheet, cut into their own strip,
        # assets/mob/<key>_fx.webp: top, bottom, left, right, the columns
        # between frames, and the point of the frame that sits on the spot
        # (the bolt's middle flies along its path; the vines grow from the ring)
        'fx': {
            'bolt': (222, 302, 785, 1536, [866, 992, 1113, 1237, 1340, 1424], 'middle'),
            'vine': (312, 494, 826, 1536, [924, 1040, 1157, 1249, 1340, 1432], 466),
        },
        'faces': 'left',
        'scale': .5,
        # a sprout about the mushroom's size, floating a little off the grass
        'show': .6,
    },
    'alpha_wolf': {
        'src': 'assets/mob/source/alpha_wolf_sheet.png',
        'alpha': True,
        'x0': 100,
        # the title card and the row labels
        'blank': [(0, 0, 305, 118), (305, 5, 120, 45), (0, 120, 120, 46), (0, 230, 184, 46), (0, 320, 253, 46),
                  (0, 424, 184, 46), (0, 537, 191, 47), (0, 679, 124, 46), (0, 748, 138, 42), (0, 835, 138, 46),
                  (0, 911, 138, 46)],
        # its skills have rows of their own: leap, howl, enrage
        'rows': [('idle', 40, 130, 8, (300, 1480)), ('walk', 132, 235, 10, (100, 1420)),
                 ('run', 236, 326, 9, (185, 1510, [329, 473, 625, 777, 929, 1073, 1217, 1353])), ('attack', 326, 432, 6, (110, 978)),
                 ('leap', 438, 556, 5, (100, 1065, None, [(470, 536, 170, 20)])),
                 # the howl's rings reach down beside the hit row: that row is cleared out of it
                 ('howl', 563, 722, 8, (60, 1500, None, [(100, 684, 830, 40)])),
                 ('hit', 684, 756, 6, (120, 920)), ('enrage', 755, 848, 6, (115, 962)),
                 ('death', 848, 912, 4, (120, 815, [290, 445, 625])),
                 # a portal opens, the wolf steps out (a stray portal frame between is left out)
                 ('spawn', 912, 1016, 10, (80, 1536, [163, 281, 407, 535, 675, 795, 894, 971, 1151, 1310],
                                            [(1151, 912, 159, 104)]))],
        'fx': {
            'claw': (326, 440, 985, 1470, [1133, 1240, 1370], 'middle'),
            'impact': (430, 562, 1069, 1528, [1253, 1414], 540),
            'rage': (755, 850, 960, 1532, [1051, 1156, 1268, 1366], 'middle'),
        },
        'faces': 'left',
        'scale': .5,
        # the mini boss: half again the boar's size
        'show': 1,
    },
    'tree_guardian': {
        'src': 'assets/mob/source/tree_guardian_sheet.png',
        'alpha': True,
        'x0': 145,
        'blank': [(0, 0, 262, 116), (20, 112, 130, 82), (20, 200, 130, 82), (20, 297, 130, 82), (20, 397, 130, 82),
                  (20, 527, 130, 82), (20, 642, 130, 82), (20, 737, 130, 82), (20, 836, 130, 82), (20, 925, 130, 82)],
        # every row is given its columns: bark and leaves touch from frame to frame
        'rows': [('idle', 5, 112, 9, (264, 1300, [375, 487, 597, 709, 825, 940, 1057, 1176])),
                 ('walk', 115, 208, 8, (145, 1060, [265, 378, 486, 601, 717, 831, 946])),
                 ('attack', 212, 322, 8, (145, 1030, [262, 366, 470, 558, 660, 772, 896])),
                 ('spike', 325, 433, 6, (145, 733, [255, 357, 461, 557, 642])),
                 # it spins itself into the tornado: the whole row is the move
                 ('tornado', 436, 530, 10, (145, 1515, [270, 398, 519, 636, 748, 855, 969, 1096, 1239])),
                 ('summon', 532, 664, 5, (145, 663, [260, 364, 477, 561])),
                 ('hit', 666, 737, 5, (145, 710, [258, 366, 474, 590])),
                 ('enrage', 738, 833, 6, (145, 905, [258, 383, 500, 629, 766])),
                 ('death', 836, 922, 9, (145, 1375, [255, 356, 458, 562, 670, 781, 900, 1083])),
                 # the portal glows and it rises out of it (the sheet's last, standing
                 # frame is painted at twice the size, so the rise ends the row)
                 ('spawn', 924, 1008, 7, (145, 932, [253, 368, 476, 585, 699, 813]))],
        'fx': {
            'swipe': (212, 322, 1036, 1440, [1096, 1168, 1240, 1330], 'middle'),
            'spikes': (325, 433, 737, 1512, [831, 938, 1050, 1200, 1368], 425),
            'rage': (680, 833, 905, 1520, [984, 1051, 1163, 1323], 825),
        },
        'faces': 'left',
        # painted small and drawn large: grown by Real-ESRGAN and stored at
        # twice the sheet's size, so it is sharp on screen (the same size as
        # before: 0.5 x 1.9 = 2 x 0.475)
        'esrgan': True,
        'scale': 2,
        # the boss: towers over the wolf
        'show': .475,
    },
    # The trees the guardian calls up: they grow out of the ground and mend it
    # while they stand. Cut from the same sheet's summon row.
    'guardian_sapling': {
        'src': 'assets/mob/source/tree_guardian_sheet.png',
        'alpha': True,
        'x0': 663,
        'rows': [('idle', 532, 664, 2, (1243, 1525, [1377])),
                 ('walk', 532, 664, 1, (1377, 1525)),
                 ('hit', 532, 664, 1, (1377, 1525)),
                 ('death', 532, 664, 6, (663, 1243, [739, 820, 916, 1015, 1117])),
                 ('spawn', 532, 664, 8, (663, 1525, [739, 820, 916, 1015, 1117, 1243, 1377]))],
        # it withers back the way it grew
        'reverse': ['death'],
        'faces': 'left',
        'esrgan': True,
        'scale': 2,
        'show': .275,
    },
    # Amberwood's first: a slime of fallen leaves. Its sheet is transparent;
    # the title card and row labels are cleared, and each row given its
    # extent where the sheet runs effects on past the frames
    'autumn_slime': {
        'src': 'assets/mob/source/autumn_slime_sheet.png',
        'alpha': True,
        'x0': 180,
        'blank': [(0, 0, 330, 100), (0, 100, 180, 924)],
        'rows': [('idle', 106, 188, 12), ('walk', 193, 274, 11),
                 # it rolls a few frames, then the row is the leaf trail alone
                 ('run', 280, 366, 5, (180, 880)),
                 ('attack', 366, 450, 10),
                 # Leaf Spin: whirls round itself (played for its spinning burst)
                 ('tornado', 455, 543, 10),
                 # Leaf Burst: leaves blow up out of the ground under it
                 ('skill', 546, 648, 11),
                 ('hit', 652, 736, 9), ('enrage', 736, 826, 10),
                 ('death', 833, 906, 11), ('spawn', 909, 1003, 10)],
        'faces': 'left',
        # painted at about the size it is drawn: stored whole, so it stays sharp
        'scale': 1,
        'show': .32,
    },
    'wild_boar': {
        'src': 'assets/mob/source/boar_sheet.png',
        'alpha': True,
        'x0': 160,
        'rows': [('idle', 10, 103, 10), ('walk', 113, 208, 10), ('run', 217, 315, 8), ('attack', 330, 435, 8),
                 ('skill', 445, 562, 7), ('hit', 574, 670, 8), ('death', 676, 765, 8), ('spawn', 772, 875, 8)],
        'faces': 'left',
        'scale': .5,
        # the biggest thing in the field so far: about fifty across
        'show': .62,
    },
}


def mask_of(rgb, solid):
    R, G, B = (rgb[..., i].astype(np.int32) for i in range(3))
    m = solid(R, G, B).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    return fill_holes(m)


def fill_holes(m):
    # fill what the outline encloses: flood the outside, keep everything else
    h, w = m.shape
    flood = m.copy()
    ff = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(flood, ff, (0, 0), 2)
    return (flood != 2).astype(np.uint8)


def frames_of(m, count):
    """The frames of one row, as a label mask per frame.

    Frames are not evenly spaced and their splashes and bubbles drift into
    the gaps, so columns cannot be cut blindly. The `count` biggest pieces
    that stand apart are the bodies; every other piece belongs to the body
    whose span it is nearest."""
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    pieces = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= 14]
    sep = .55 * m.shape[1] / count
    cx = lambda i: st[i, 0] + st[i, 2] / 2
    bodies = []
    for i in sorted(pieces, key=lambda i: -st[i, cv2.CC_STAT_AREA]):
        if all(abs(cx(i) - cx(b)) >= sep for b in bodies):
            bodies.append(i)
        if len(bodies) == count:
            break
    bodies.sort(key=cx)
    owner = {b: b for b in bodies}
    for i in pieces:
        if i in owner:
            continue
        c = cx(i)
        owner[i] = min(bodies, key=lambda b: max(st[b, 0] - c, c - st[b, 0] - st[b, 2], 0))
    return [(b, np.isin(lab, [i for i, o in owner.items() if o == b]).astype(np.uint8), st[b]) for b in bodies]


def frames_by_columns(m, count):
    """Frames of a transparent sheet, where leaves, dust and swirls bridge one
    frame to the next so no piece stands alone. The bodies are found with the
    thin bits eroded away; each frame then owns the columns up to halfway to
    its neighbours' bodies."""
    core = cv2.erode(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
    n, lab, st, _ = cv2.connectedComponentsWithStats(core)
    sep = .55 * m.shape[1] / count
    cx = lambda i: st[i, 0] + st[i, 2] / 2
    bodies = []
    for i in sorted(range(1, n), key=lambda i: -st[i, cv2.CC_STAT_AREA]):
        if all(abs(cx(i) - cx(b)) >= sep for b in bodies):
            bodies.append(i)
        if len(bodies) == count:
            break
    bodies.sort(key=cx)
    cuts = [0] + [int((st[a, 0] + st[a, 2] + st[b, 0]) / 2) for a, b in zip(bodies, bodies[1:])] + [m.shape[1]]
    # A loose piece (a dust puff, a leaf, a glint) goes whole to the frame its
    # middle is in; only a piece that carries two bodies is cut at the column.
    pn, plab, pst, _ = cv2.connectedComponentsWithStats(m)
    body_px = np.isin(lab, bodies)
    owner = np.full(m.shape, -1, np.int32)
    for i in range(1, pn):
        piece = plab == i
        carried = set(lab[piece & body_px].tolist())
        if len(carried) > 1:
            continue                                  # cut by column below
        mid = pst[i, 0] + pst[i, 2] / 2
        k = next(j for j in range(len(bodies)) if mid < cuts[j + 1] or j == len(bodies) - 1)
        owner[piece] = k
    cols = np.searchsorted(cuts[1:-1], np.arange(m.shape[1]), side='right')
    owner = np.where((owner < 0) & (m > 0), cols[None, :], owner)
    out = []
    for k, b in enumerate(bodies):
        sub = (owner == k).astype(np.uint8)
        x, y, w, h, area = st[b]
        # the eroded body is 6px short on every side
        out.append((b, sub, (x - 6, y - 6, w + 12, h + 12, area)))
    return out


def frames_by_cuts(m, cuts):
    """Frames split at given columns, for a row whose last frames are only
    loose pieces. A frame stands on the bottom of its biggest piece."""
    edges = [0] + cuts + [m.shape[1]]
    out = []
    for a, b in zip(edges, edges[1:]):
        sub = np.zeros_like(m)
        sub[:, a:b] = m[:, a:b]
        if not sub.any():
            continue                                  # a column left out on purpose
        n, lab, st, _ = cv2.connectedComponentsWithStats(sub)
        big = max(range(1, n), key=lambda i: st[i, cv2.CC_STAT_AREA])
        xs = np.nonzero(sub.sum(0))[0]
        x, y, w, h, area = st[big]
        out.append((big, sub, (xs.min(), y, xs.max() + 1 - xs.min(), h, area)))
    return out


def resize(atlas, k, cfg):
    """The atlas brought to its stored size. A sheet painted small and drawn
    big (`esrgan: True`) is first grown 4x by Real-ESRGAN (tools/upscale;
    the weights path in ESRGAN_WEIGHTS), so it is sharp rather than
    stretched; the alpha is grown smoothly beside it."""
    im = Image.fromarray(atlas)
    size = (round(im.width * k), round(im.height * k))
    if not cfg.get('esrgan') or k <= 1:
        return im.resize(size, Image.LANCZOS)
    import sys
    sys.path.insert(0, os.path.join(ROOT, 'tools/upscale'))
    from esrgan import load, run
    net = load(os.environ.get('ESRGAN_WEIGHTS', 'RealESRGAN_x4plus.pth'), 4)
    a = atlas[..., 3:4].astype(np.float32) / 255
    # on a neutral grey, so the edges do not grow a coloured halo
    rgb = (atlas[..., :3] * a + 128 * (1 - a)).astype(np.uint8)[..., ::-1]
    big = run(net, np.ascontiguousarray(rgb), 4, tile=200)[..., ::-1]
    big = cv2.resize(big, size, interpolation=cv2.INTER_AREA)
    al = cv2.resize(atlas[..., 3], size, interpolation=cv2.INTER_CUBIC)
    return Image.fromarray(np.dstack([big, al]))


def main(key, preview=None):
    cfg = MOBS[key]
    rgba = np.array(Image.open(os.path.join(ROOT, cfg['src'])).convert('RGBA'))
    # the sheet's own labels, where they sit in the way of a row
    for x, y, w, h in cfg.get('blank', []):
        rgba[y:y + h, x:x + w, 3] = 0
    rgb = rgba[..., :3]
    frames = {}
    for anim, y0, y1, count, *span in cfg['rows']:
        # a row may carry its own columns, where the sheet puts something else beside it
        x0, x1, *extra = span[0] if span else (cfg['x0'], None)
        cuts = [extra[0]] if extra and extra[0] else []
        band = rgb[y0:y1, x0:x1]
        if cfg.get('alpha'):
            alpha = rgba[y0:y1, x0:x1, 3].copy()
            # another row reaching into this one's band is cleared (absolute rects)
            for bx, by, bw, bh in (extra[1] if len(extra) > 1 else []):
                alpha[max(0, by - y0):max(0, by + bh - y0), max(0, bx - x0):max(0, bx + bw - x0)] = 0
            # solid already: filling "holes" here would wall in the gaps
            # between frames wherever leaves bridge them above and below
            m = (alpha > 100).astype(np.uint8)
        else:
            m = mask_of(band, cfg['solid'])
        out = []
        split = frames_by_columns if cfg.get('alpha') else frames_of
        if cuts:
            split = lambda m, count: frames_by_cuts(m, [c - x0 for c in cuts[0]])
        for _, sub, (bx, by, bw, bh, _) in split(m, count):
            ys = np.nonzero(sub.sum(1))[0]
            xs = np.nonzero(sub.sum(0))[0]
            s, e = xs.min(), xs.max() + 1
            a = np.zeros((y1 - y0, e - s, 4), np.uint8)
            a[..., :3] = band[:, s:e]
            if cfg.get('alpha'):
                # the painter's own edges and glows, but only this frame's pieces
                near = cv2.dilate(sub[:, s:e], np.ones((7, 7), np.uint8))
                a[..., 3] = alpha[:, s:e] * near
            else:
                soft = cv2.GaussianBlur(sub[:, s:e].astype(np.float32), (3, 3), 0)
                a[..., 3] = (np.clip(soft * 1.4, 0, 1) * 255).astype(np.uint8)
            # the feet: the bottom and middle of the body
            out.append({'img': a[ys.min():ys.max() + 1], 'fx': bx + bw / 2 - s, 'fy': by + bh - ys.min()})
        frames[anim] = out[::-1] if anim in cfg.get('reverse', []) else out

    # one cell for the whole sheet, big enough for any frame placed on its feet
    left = max(f['fx'] for fs in frames.values() for f in fs)
    right = max(f['img'].shape[1] - f['fx'] for fs in frames.values() for f in fs)
    up = max(f['fy'] for fs in frames.values() for f in fs)
    down = max(f['img'].shape[0] - f['fy'] for fs in frames.values() for f in fs)
    half = int(np.ceil(max(left, right))) + 2
    cw, ch = half * 2, int(np.ceil(up + down)) + 4
    foot = int(np.ceil(up)) + 2
    cols = max(len(fs) for fs in frames.values())
    atlas = np.zeros((ch * len(frames), cw * cols, 4), np.uint8)
    for r, (anim, fs) in enumerate(frames.items()):
        for c, f in enumerate(fs):
            h, w = f['img'].shape[:2]
            ox = int(round(c * cw + half - f['fx']))
            oy = int(round(r * ch + foot - f['fy']))
            region = atlas[oy:oy + h, ox:ox + w]
            src = f['img']
            keep = src[..., 3:4] > region[..., 3:4]
            atlas[oy:oy + h, ox:ox + w] = np.where(keep, src, region)

    k = cfg['scale']
    im = resize(atlas, k, cfg)
    os.makedirs(os.path.join(ROOT, 'assets/mob'), exist_ok=True)
    im.save(os.path.join(ROOT, f'assets/mob/{key}.webp'), 'WEBP', quality=90, method=6)

    # how tall it stands at rest, in world pixels: where its name goes
    top = round(max(f['fy'] for f in frames['idle']) * k * cfg['show'])
    entry = {'cell': [round(cw * k), round(ch * k)], 'foot': round(foot * k), 'faces': cfg['faces'], 'show': cfg['show'],
             'top': top,
             'anims': [[a, len(fs)] for a, fs in frames.items()]}
    if cfg.get('fx'):
        entry['fx'] = cut_fx(key, rgba, cfg['fx'], k, cfg)
    write_manifest(key, entry)
    if preview:
        bg = Image.new('RGBA', im.size, (70, 120, 60, 255))
        bg.alpha_composite(im)
        bg.convert('RGB').save(preview)
    print(key, {a: len(fs) for a, fs in frames.items()}, 'cell', entry['cell'], 'atlas', im.size)


def cut_fx(key, rgba, fx, k, cfg={}):
    """The sheet's own effects as one strip per effect, every frame in a
    cell of the strip's size with the effect's anchor at the same point."""
    strips, out = [], {}
    for name, (y0, y1, x0, x1, cuts, anchor) in fx.items():
        band = rgba[y0:y1, x0:x1]
        edges = [0] + [c - x0 for c in cuts] + [x1 - x0]
        frames = []
        for a, b in zip(edges, edges[1:]):
            f = band[:, a:b].copy()
            xs = np.nonzero((f[..., 3] > 8).sum(0))[0]
            frames.append(f[:, xs.min():xs.max() + 1])
        ys = np.nonzero(sum((f[..., 3] > 8).sum(1) for f in frames))[0]
        top, bot = ys.min(), ys.max() + 1
        cw, ch = max(f.shape[1] for f in frames) + 2, bot - top
        strip = np.zeros((ch, cw * len(frames), 4), np.uint8)
        for i, f in enumerate(frames):
            ox = i * cw + (cw - f.shape[1]) // 2
            strip[:, ox:ox + f.shape[1]] = f[top:bot]
        ay = ch / 2 if anchor == 'middle' else anchor - y0 - top
        strips.append(strip)
        out[name] = {'n': len(frames), 'cell': [round(cw * k), round(ch * k)], 'anchor': [round(cw * k / 2), round(ay * k)]}
    width = max(s.shape[1] for s in strips)
    sheet = np.zeros((sum(s.shape[0] for s in strips), width, 4), np.uint8)
    y = 0
    for (name, o), s in zip(out.items(), strips):
        sheet[y:y + s.shape[0], :s.shape[1]] = s
        o['y'] = round(y * k)
        y += s.shape[0]
    im = resize(sheet, k, cfg)
    im.save(os.path.join(ROOT, f'assets/mob/{key}_fx.webp'), 'WEBP', quality=90, method=6)
    return out


def write_manifest(key, entry):
    path = os.path.join(ROOT, 'shared/data/mobart.js')
    art = {}
    if os.path.exists(path):
        m = re.search(r'export const MOB_ART = (\{.*\});', open(path).read(), re.S)
        if m:
            art = json.loads(m.group(1))
    art[key] = entry
    body = '{\n' + ',\n'.join(f'  {json.dumps(k)}: {json.dumps(v)}' for k, v in sorted(art.items())) + '\n}'
    open(path, 'w').write(
        '// Generated by tools/slice-mob.py - do not edit by hand.\n'
        '// Per sheet: the cell every frame sits in, the row its feet stand on,\n'
        '// the way the painting faces, how many world pixels one atlas pixel\n'
        '// covers, how tall it stands at rest, and each animation row with its frame count.\n'
        f'export const MOB_ART = {body};\n')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
