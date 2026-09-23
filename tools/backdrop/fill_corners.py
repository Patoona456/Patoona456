import sys, cv2, numpy as np
S = sys.argv[1]
rng = np.random.default_rng(7)
img = cv2.imread(f'{S}/pt/clean5.png').astype(np.float32)
H, W = img.shape[:2]
CORNERS = [(0, 0, 312, 108), (985, 0, 322, 150), (1318, 0, 218, 214), (0, 903, 282, 121), (1226, 893, 310, 131)]
hole = np.zeros((H, W), bool)
for x, y, w, h in CORNERS: hole[y:y+h, x:x+w] = True
# canopy outside the walls, with no logos in it
import json
inside = lambda x, y: any(cx - 48 < x < cx + cw and cy - 48 < y < cy + ch for cx, cy, cw, ch in CORNERS)
atlas = [img[y:y+48, x:x+48].copy() for x, y in json.load(open(f'{S}/pt/forest.json')) if not inside(x, y)]
print('forest samples', len(atlas))
P, R = 33, 16
for (cx, cy, cw, ch) in CORNERS:
    X0, Y0, X1, Y1 = max(0, cx - 24), max(0, cy - 24), min(W, cx + cw + 24), min(H, cy + ch + 24)
    while True:
        hw = hole[Y0:Y1, X0:X1]
        if not hw.any(): break
        known = (~hw).astype(np.float32)
        conf = cv2.boxFilter(known, -1, (P, P), normalize=True)
        edge = hw & (cv2.dilate(known, np.ones((3, 3), np.uint8)) > 0)
        if not edge.any(): edge = hw
        cand = np.where(edge, conf, -1)
        yy, xx = np.unravel_index(np.argmax(cand), cand.shape)
        ty = min(max(Y0 + yy, R), H - R - 1); tx = min(max(X0 + xx, R), W - R - 1)
        tm = (~hole[ty-R:ty+R+1, tx-R:tx+R+1]).astype(np.float32)
        tm3 = np.repeat(tm[..., None], 3, 2)
        tpl = img[ty-R:ty+R+1, tx-R:tx+R+1] * tm3
        best = None
        for part in atlas:
            if part.shape[0] < P or part.shape[1] < P: continue
            if tm.sum() < 1:
                sy, sx = rng.integers(0, part.shape[0]-P+1), rng.integers(0, part.shape[1]-P+1); sc = 0.0
            else:
                res = cv2.matchTemplate(part, tpl, cv2.TM_SQDIFF, mask=tm3)
                res = res + rng.random(res.shape) * (res.std() + 1) * 0.15
                sy, sx = np.unravel_index(np.argmin(res), res.shape); sc = float(res[sy, sx])
            if best is None or sc < best[0]: best = (sc, part[sy:sy+P, sx:sx+P])
        miss = hole[ty-R:ty+R+1, tx-R:tx+R+1]
        img[ty-R:ty+R+1, tx-R:tx+R+1][miss] = best[1][miss]
        hole[ty-R:ty+R+1, tx-R:tx+R+1] = False
cv2.imwrite(f'{S}/pt/clean6.png', np.clip(img, 0, 255).astype(np.uint8))
print('ok')
