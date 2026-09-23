import sys, cv2, numpy as np
S = sys.argv[1]
ns = {}
exec(open(f'{S}/pt/clean.py').read().split('def tighten')[0].split("H, W = src.shape[:2]")[1], ns)
LABELS, ICONS = ns['LABELS'], ns['ICONS']
img = cv2.imread(f'{S}/pt/town.png').astype(np.float32)
H, W = img.shape[:2]
def tighten(x, y, w, h):
    win = img[y:y+h, x:x+w]
    b, g, r = win[..., 0], win[..., 1], win[..., 2]
    cream = (r > 200) & (g > 180) & (b > 140) & (r - b > 12)
    ys, xs = np.nonzero(cream)
    if len(xs) < 50: return (x, y, w, h)
    return (x + xs.min() - 4, y + ys.min() - 4, xs.max() - xs.min() + 9, ys.max() - ys.min() + 9)
hole = np.zeros((H, W), bool)
for x, y, w, h in [tighten(*r) for r in LABELS]: hole[y:y+h, x:x+w] = True
for x, y, w, h in ICONS:
    m = np.zeros((H, W), np.uint8); cv2.ellipse(m, ((x + w / 2, y + h / 2), (w + 4, h + 4), 0), 1, -1); hole |= m.astype(bool)
P, R, MARGIN = 17, 8, 80
# the south-gate sign sits on the stairs: carry the steps down through it
# (6 steps of ~7px), leaving only the tower edges either side to synthesise
for y in range(811, 882):
    img[y, 723:810] = img[y - 42, 723:810]
    hole[y, 723:810] = False
# the corner logos: never a source, filled last
CORNERS = [(0, 0, 312, 108), (985, 0, 322, 148), (1318, 0, 218, 212), (0, 905, 280, 119), (1228, 895, 308, 129)]
# the corner logos are never a source (their letters would be copied in);
# corners.py fills them afterwards
CORNERS = [(0, 0, 312, 108), (985, 0, 322, 150), (1318, 0, 218, 214), (0, 903, 282, 121), (1226, 893, 310, 131)]
forbid = np.zeros((H, W), bool)
for x, y, w, h in CORNERS: forbid[y:y+h, x:x+w] = True
# where a sign is ringed by other scenery, keep its sources inside this box

n, lab, stats, _ = cv2.connectedComponentsWithStats(hole.astype(np.uint8))
BIG = 1e5
order = sorted(range(1, n), key=lambda i: stats[i][4])
for i in order:
    x, y, w, h, _ = stats[i]
    X0, Y0, X1, Y1 = max(0, x - MARGIN), max(0, y - MARGIN), min(W, x + w + MARGIN), min(H, y + h + MARGIN)
    if x < 330 and x + w > 174 and 740 < y < 800: X0, Y0, X1, Y1 = 100, 640, 330, 880   # training ground, not the canal
    while True:
        hw = hole[Y0:Y1, X0:X1]
        if not hw.any(): break
        # boundary pixel with the most known neighbours goes first
        known = (~hw).astype(np.float32)
        conf = cv2.boxFilter(known, -1, (P, P), normalize=True)
        edge = hw & (cv2.dilate(known, np.ones((3, 3), np.uint8)) > 0)
        cand = np.where(edge, conf, -1)
        cy, cx = np.unravel_index(np.argmax(cand), cand.shape)
        cy = min(max(cy, R), hw.shape[0] - R - 1); cx = min(max(cx, R), hw.shape[1] - R - 1)
        ty, tx = Y0 + cy, X0 + cx
        tpl = img[ty-R:ty+R+1, tx-R:tx+R+1].copy()
        tm = (~hole[ty-R:ty+R+1, tx-R:tx+R+1]).astype(np.float32)
        tm3 = np.repeat(tm[..., None], 3, 2)
        win = img[Y0:Y1, X0:X1].copy()
        win[hole[Y0:Y1, X0:X1] | forbid[Y0:Y1, X0:X1]] = BIG            # sources may not include the hole
        res = cv2.matchTemplate(win, tpl * tm3, cv2.TM_SQDIFF, mask=tm3)
        # the template window itself would match trivially where known; that's fine
        res[~np.isfinite(res)] = np.inf
        # a source patch may not overlap the hole at all (it would copy the label back)
        ii = cv2.integral((hw | forbid[Y0:Y1, X0:X1]).astype(np.uint8))
        hs = ii[P:, P:] - ii[:-P, P:] - ii[P:, :-P] + ii[:-P, :-P]
        res[hs[:res.shape[0], :res.shape[1]] > 0] = np.inf
        sy, sx = np.unravel_index(np.argmin(res), res.shape)
        src = img[Y0+sy:Y0+sy+P, X0+sx:X0+sx+P]
        miss = hole[ty-R:ty+R+1, tx-R:tx+R+1]
        img[ty-R:ty+R+1, tx-R:tx+R+1][miss] = src[miss]
        hole[ty-R:ty+R+1, tx-R:tx+R+1] = False
cv2.imwrite(f'{S}/pt/clean5.png', np.clip(img, 0, 255).astype(np.uint8))
print('ok')
