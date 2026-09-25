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


def main(key, preview=None):
    cfg = MOBS[key]
    rgba = np.array(Image.open(os.path.join(ROOT, cfg['src'])).convert('RGBA'))
    rgb = rgba[..., :3]
    frames = {}
    for anim, y0, y1, count in cfg['rows']:
        band = rgb[y0:y1, cfg['x0']:]
        if cfg.get('alpha'):
            alpha = rgba[y0:y1, cfg['x0']:, 3]
            # solid already: filling "holes" here would wall in the gaps
            # between frames wherever leaves bridge them above and below
            m = (alpha > 100).astype(np.uint8)
        else:
            m = mask_of(band, cfg['solid'])
        out = []
        split = frames_by_columns if cfg.get('alpha') else frames_of
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
        frames[anim] = out

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
    im = Image.fromarray(atlas)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    os.makedirs(os.path.join(ROOT, 'assets/mob'), exist_ok=True)
    im.save(os.path.join(ROOT, f'assets/mob/{key}.webp'), 'WEBP', quality=90, method=6)

    # how tall it stands at rest, in world pixels: where its name goes
    top = round(max(f['fy'] for f in frames['idle']) * k * cfg['show'])
    entry = {'cell': [round(cw * k), round(ch * k)], 'foot': round(foot * k), 'faces': cfg['faces'], 'show': cfg['show'],
             'top': top,
             'anims': [[a, len(fs)] for a, fs in frames.items()]}
    write_manifest(key, entry)
    if preview:
        bg = Image.new('RGBA', im.size, (70, 120, 60, 255))
        bg.alpha_composite(im)
        bg.convert('RGB').save(preview)
    print(key, {a: len(fs) for a, fs in frames.items()}, 'cell', entry['cell'], 'atlas', im.size)


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
