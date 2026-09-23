import sys, cv2, numpy as np, json
S = sys.argv[1]
src = cv2.imread(f'{S}/pt/town.png').astype(np.float32)
H, W = src.shape[:2]
# rough windows (x, y, w, h); 'fit' ones are tightened to the cream box inside
LABELS = [
  (690, 20, 160, 65), (440, 185, 140, 80), (940, 200, 155, 70), (165, 205, 140, 65), (1160, 222, 115, 60),
  (168, 425, 102, 72), (420, 462, 125, 65), (690, 470, 160, 60), (1290, 410, 138, 72), (1015, 500, 140, 65),
  (598, 590, 128, 60), (840, 600, 98, 60), (32, 588, 165, 60), (1345, 585, 158, 70), (178, 765, 135, 62),
  (692, 815, 125, 62),
]
ICONS = [  # round badges above the shop signs
  (210, 164, 58, 58), (482, 162, 56, 56), (985, 165, 58, 58), (1195, 183, 50, 50), (193, 390, 54, 52),
  (1328, 376, 58, 52), (1062, 462, 56, 52), (636, 552, 64, 52), (214, 724, 60, 56),
]
CORNERS = [(0, 0, 312, 108), (985, 0, 322, 148), (1318, 0, 218, 212), (0, 905, 280, 119), (1228, 895, 308, 129)]

def tighten(x, y, w, h):
    win = src[y:y+h, x:x+w]
    b, g, r = win[..., 0], win[..., 1], win[..., 2]
    cream = (r > 200) & (g > 180) & (b > 140) & (r - b > 12)
    ys, xs = np.nonzero(cream)
    if len(xs) < 50: return (x, y, w, h)
    return (x + xs.min() - 5, y + ys.min() - 5, xs.max() - xs.min() + 11, ys.max() - ys.min() + 11)

targets = [tighten(*r) for r in LABELS] + ICONS + CORNERS
out = src.copy()
hole = np.zeros((H, W), np.uint8)
for x, y, w, h in targets: hole[max(0,y):y+h, max(0,x):x+w] = 1

RING = 10
for (x, y, w, h) in sorted(targets, key=lambda r: r[2] * r[3]):
    x, y = max(0, x), max(0, y); w, h = min(w, W - x), min(h, H - y)
    ring = np.zeros((H, W), bool)
    rx0, ry0, rx1, ry1 = max(0, x-RING), max(0, y-RING), min(W, x+w+RING), min(H, y+h+RING)
    ring[ry0:ry1, rx0:rx1] = True; ring[y:y+h, x:x+w] = False
    ring &= hole == 0
    rys, rxs = np.nonzero(ring)
    best, bo = None, None
    span = max(w, h) * 2 + 80
    for dy in range(-span, span + 1, 6):
        for dx in range(-span, span + 1, 6):
            if abs(dx) < w * 0.6 and abs(dy) < h * 0.6: continue
            sx0, sy0 = rx0 + dx, ry0 + dy
            if sx0 < 0 or sy0 < 0 or rx1 + dx > W or ry1 + dy > H: continue
            if hole[y+dy:y+h+dy, x+dx:x+w+dx].any(): continue
            d = out[rys + dy, rxs + dx] - out[rys, rxs]
            score = float((d * d).mean()) if len(rys) else 0
            if best is None or score < best: best, bo = score, (dx, dy)
    if bo is None:
        print('no source for', (x, y, w, h)); continue
    dx, dy = bo
    patch = out[y+dy-RING//2:y+h+dy+RING//2, x+dx-RING//2:x+w+dx+RING//2] if y+dy-RING//2 >= 0 and x+dx-RING//2 >= 0 else None
    # feathered paste: full inside the hole, fading over the ring
    m = np.zeros((h + RING, w + RING), np.float32); m[RING//2:-RING//2 or None, RING//2:-RING//2 or None] = 1
    m = cv2.GaussianBlur(m, (0, 0), 3); m = np.maximum(m, np.pad(np.ones((h, w), np.float32), RING//2))
    X0, Y0 = x - RING//2, y - RING//2
    if X0 < 0 or Y0 < 0 or patch is None or patch.shape[:2] != m.shape or Y0 + m.shape[0] > H or X0 + m.shape[1] > W:
        out[y:y+h, x:x+w] = out[y+dy:y+h+dy, x+dx:x+w+dx]
    else:
        dst = out[Y0:Y0+m.shape[0], X0:X0+m.shape[1]]
        out[Y0:Y0+m.shape[0], X0:X0+m.shape[1]] = dst * (1 - m[..., None]) + patch * m[..., None]
    hole[y:y+h, x:x+w] = 0
cv2.imwrite(f'{S}/pt/clean.png', np.clip(out, 0, 255).astype(np.uint8))
json.dump(targets, open(f'{S}/pt/targets.json', 'w'))
print('done', len(targets))
