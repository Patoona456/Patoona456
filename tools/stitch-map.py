#!/usr/bin/env python3
"""Stitch a painted field back together from its close-ups.

    python3 tools/stitch-map.py greenmire2 out.png

A field comes as one picture of the whole map (too small to show on its own
without going soft) and a handful of close-ups of its parts, each painted
again at about twice the size. The close-ups are not exact crops: they were
redrawn, so a tree or a rock can sit a little differently. So each one is
found on the map by its layout (the rivers, paths and cliffs), not its
details: a first guess from features or a sliding match, then refined by
correlation (ECC) as an affine warp.

The result is the map at SCALE times its size: the whole picture, enlarged,
as the ground, with each close-up laid over its own part, its colours matched
to the map, and neighbouring close-ups meeting along a narrow blend so no
tree is painted twice. A close-up that fits the map poorly counts for less.
"""
import sys
import cv2
import numpy as np

SCALE = 2
FEATHER = 120         # px of the canvas over which a close-up gives way at its edge
SEAM = 5              # px: how soft the seam between two pictures is


def main(src_dir, transforms, out, crop, scale=SCALE, erase=()):
    full = cv2.imread(f'{src_dir}/full.png')
    x0, y0, x1, y1 = crop
    C = full[y0:y1, x0:x1]
    H, W = (y1 - y0) * scale, (x1 - x0) * scale
    base = cv2.resize(C, (W, H), interpolation=cv2.INTER_CUBIC).astype(np.float32)
    layers, weights = [base], [np.full((H, W), 1e-3, np.float32)]
    for i, (M, quality) in transforms.items():
        Z = cv2.imread(f'{src_dir}/zoom{i}.png')
        M2 = (M * scale).astype(np.float32)
        warped = cv2.warpAffine(Z, M2, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_CONSTANT).astype(np.float32)
        inside = cv2.warpAffine(np.ones(Z.shape[:2], np.uint8), M2, (W, H), flags=cv2.INTER_NEAREST)
        if not inside.any():
            continue
        # colours: match each channel's mean and spread to the map under it
        m = inside > 0
        for c in range(3):
            a, b = warped[..., c][m], base[..., c][m]
            warped[..., c] = (warped[..., c] - a.mean()) * (b.std() / max(1e-3, a.std())) + b.mean()
        layers.append(np.clip(warped, 0, 255))
        # how far inside the close-up each pixel is, counted down by how well it fits the map
        dist = cv2.distanceTransform(inside, cv2.DIST_L2, 5)
        weights.append(np.clip(dist / FEATHER, 0, 1) ** 2 * quality)
    # Between close-ups each pixel belongs to one of them - the one it is
    # deepest inside - and they meet along a narrow soft seam: mixing two
    # redrawn pictures over a wide band would paint every tree twice. Where a
    # close-up gives way to the enlarged map there is no second drawing to
    # clash with, only a softer copy of the same one, so that edge fades
    # gently over FEATHER instead of cutting a straight line.
    zoom_w = np.stack(weights[1:]) if len(weights) > 1 else np.zeros((0, H, W), np.float32)
    if len(zoom_w):
        owner = zoom_w.argmax(0)
        acc = np.zeros((H, W, 3), np.float32)
        wsum = np.full((H, W), 1e-6, np.float32)
        for k, layer in enumerate(layers[1:]):
            w = cv2.GaussianBlur((owner == k).astype(np.float32), (0, 0), SEAM) * (zoom_w[k] > 0)
            acc += layer * w[..., None]
            wsum += w
        mosaic = acc / wsum[..., None]
        cover = np.clip(zoom_w.max(0) / zoom_w.max(), 0, 1)
        cover = cv2.GaussianBlur(cover, (0, 0), 3)[..., None]
        acc, wsum = mosaic * cover + base * (1 - cover), np.ones((H, W), np.float32)
    else:
        acc, wsum = base, np.ones((H, W), np.float32)
    img = np.clip(acc / wsum[..., None], 0, 255).astype(np.uint8)
    # the marks drawn on the pictures to say where things go (warp spots): painted out
    if erase:
        mask = np.zeros((H, W), np.uint8)
        for x, y, r in erase:
            cv2.circle(mask, (int(x), int(y)), int(r), 255, -1)
        img = cv2.inpaint(img, mask, 9, cv2.INPAINT_TELEA)
    cv2.imwrite(out, img)
    return img


if __name__ == '__main__':
    raise SystemExit('import main() from a per-map script')
