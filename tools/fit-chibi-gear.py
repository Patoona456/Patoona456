import sys, cv2, numpy as np, os
S = sys.argv[1]; OUT = sys.argv[2]
BODY = '/home/user/Patoona456/assets/chibi/body/hero_brown.png'
FW, FH = 128, 192
sheet = cv2.imread(f'{S}/gear/sheet.png', cv2.IMREAD_UNCHANGED)
BANDS = {'top': (33, 105), 'bottom': (147, 220), 'boots': (267, 332), 'gloves': (376, 446), 'belt': (495, 552), 'cape': (596, 684)}
GROUPS = {'front': (140, 570), 'sideR': (620, 1115), 'back': (1170, 1595), 'sideL': (1660, 2160)}

def pieces(part, group):
    y0, y1 = BANDS[part]; x0, x1 = GROUPS[group]
    a = sheet[y0 - 6:y1 + 6, x0:x1]
    m = (a[..., 3] > 40).astype(np.uint8)
    cols = m.any(0)
    # split on empty columns, but merge close runs (a pair of gloves is two blobs)
    runs, s = [], None
    for x, v in enumerate(list(cols) + [False]):
        if v and s is None: s = x
        if not v and s is not None: runs.append([s, x]); s = None
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] < 22 and (r[1] - merged[-1][0]) < 110: merged[-1][1] = r[1]
        else: merged.append(r)
    out = []
    for xa, xb in merged:
        p = a[:, xa:xb]; ys = np.nonzero(p[..., 3] > 40)[0]
        out.append(p[ys.min():ys.max() + 1])
    return out

def marks(fr):
    a = fr[..., 3] > 128
    hsv = cv2.cvtColor(np.ascontiguousarray(fr[..., :3]), cv2.COLOR_BGR2HSV)
    s, v = hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    grey = a & (s < 45) & (v > 80) & (v < 215)
    band = np.zeros_like(grey); band[120:170] = grey[120:170]
    n, lab, st, _ = cv2.connectedComponentsWithStats(band.astype(np.uint8))
    k = 1 + np.argmax(st[1:, 4])
    gy, gx = np.nonzero(lab == k)
    under = (gy.min(), gy.max(), gx.min(), gx.max())
    widths = [(np.ptp(np.nonzero(a[y])[0]) if a[y].any() else 999, y) for y in range(96, under[0] - 10)]
    neck = min(widths)[1]
    mid = (neck + under[0]) // 2 + 4
    row = np.nonzero(a[mid])[0]
    ys = np.nonzero(a.any(1))[0]; bottom = ys.max()
    frow = np.nonzero(a[bottom - 8:bottom + 1].any(0))[0]
    lrow = np.nonzero(a[under[1] + 2:bottom - 6].any(0))[0]
    return dict(neck=neck, under=under, chest=(row.min(), row.max()), bottom=bottom, feet=(frow.min(), frow.max()),
                legs=(lrow.min(), lrow.max()) if len(lrow) else (under[2], under[3]))

def paste(dst, piece, x0, y0, w, h):
    w, h = max(2, int(round(w))), max(2, int(round(h)))
    p = cv2.resize(piece, (w, h), interpolation=cv2.INTER_AREA).astype(np.float32)
    X0, Y0 = int(round(x0)), int(round(y0))
    xa, ya = max(0, X0), max(0, Y0); xb, yb = min(dst.shape[1], X0 + w), min(dst.shape[0], Y0 + h)
    if xb <= xa or yb <= ya: return
    src = p[ya - Y0:yb - Y0, xa - X0:xb - X0]; al = src[..., 3:] / 255
    d = dst[ya:yb, xa:xb].astype(np.float32)
    outa = al + d[..., 3:] / 255 * (1 - al)
    rgb = (src[..., :3] * al + d[..., :3] * (d[..., 3:] / 255) * (1 - al)) / np.maximum(outa, 1e-6)
    dst[ya:yb, xa:xb] = np.dstack([rgb, outa * 255]).clip(0, 255).astype(np.uint8)

ROW_GROUP = {0: 'front', 1: 'front', 2: 'sideL', 3: 'back', 4: 'back', 5: 'back', 6: 'sideR', 7: 'front'}
FACING_CAMERA = {0, 1, 2, 6, 7}
body = cv2.imread(BODY, cv2.IMREAD_UNCHANGED)
layers = {k: np.zeros_like(body) for k in ['top', 'bottom', 'boots', 'gloves', 'belt', 'cape_under', 'cape_over']}
cache = {}
for r in range(8):
    g = ROW_GROUP[r]
    for c in range(4):
        fr = body[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW]
        m = marks(fr); oy, ox = r * FH, c * FW
        ut, ub, ul, ur = m['under']; cl, cr = m['chest']
        def pick(part):
            key = (part, g)
            if key not in cache: cache[key] = pieces(part, g)
            lst = cache[key]; return lst[c % len(lst)]
        tw = (cr - cl) + 6
        # cape first (behind or over), then legs, boots, top, belt, gloves
        cape = pick('cape')
        dstk = 'cape_under' if r in FACING_CAMERA else 'cape_over'
        paste(layers[dstk], cape, ox + (cl + cr) / 2 - tw * 0.55, oy + m['neck'] - 2, tw * 1.1, (ut - m['neck']) + 24)
        pw = (ur - ul) + 8
        ll, lr = m['legs']; lw = max(pw, (lr - ll) + 6)
        paste(layers['bottom'], pick('bottom'), ox + (ll + lr) / 2 - lw / 2, oy + ut - 3, lw, (m['bottom'] - 7) - (ut - 3))
        fl, fr_ = m['feet']; bw = (fr_ - fl) + 6
        if g in ('sideL', 'sideR'):          # one boot per foot, wherever each foot is
            a = fr[..., 3] > 128
            low = a[m['bottom'] - 10:m['bottom'] + 1].any(0).astype(np.uint8)
            n, lab, st, _ = cv2.connectedComponentsWithStats(low.reshape(1, -1))
            bp = pick('boots')
            for i in range(1, n):
                x, _, w, _, _ = st[i]
                if w < 5: continue
                ww = max(w + 8, 20)
                paste(layers['boots'], bp, ox + x + w / 2 - ww / 2, oy + m['bottom'] - 17, ww, 19)
        else:
            paste(layers['boots'], pick('boots'), ox + (fl + fr_) / 2 - bw / 2, oy + m['bottom'] - 19, bw, 21)
        paste(layers['top'], pick('top'), ox + (cl + cr) / 2 - tw / 2, oy + m['neck'] - 3, tw, (ut + 5) - (m['neck'] - 3))
        paste(layers['belt'], pick('belt'), ox + (ul + ur) / 2 - pw / 2, oy + ut - 5, pw, 14)
        gh = (ut + 8) - (m['neck'] + 8)
        if g in ('front', 'back'):
            paste(layers['gloves'], pick('gloves'), ox + (cl + cr) / 2 - tw / 2, oy + m['neck'] + 8, tw, gh)
        # side on, the shirt's sleeve already covers the arm; a second one
        # on top only makes a white lump
os.makedirs(OUT, exist_ok=True)
for k, v in layers.items(): cv2.imwrite(f'{OUT}/{k}.png', v)
# preview: body + everything
prev = body.copy()
def over(dst, src):
    al = src[..., 3:] / 255; d = dst.astype(np.float32)
    outa = al + d[..., 3:] / 255 * (1 - al)
    rgb = (src[..., :3] * al + d[..., :3] * (d[..., 3:] / 255) * (1 - al)) / np.maximum(outa, 1e-6)
    return np.dstack([rgb, outa * 255]).clip(0, 255).astype(np.uint8)
prev = over(layers['cape_under'], prev) if False else prev
comp = np.zeros_like(body); comp = over(comp, layers['cape_under']); comp = over(comp, body)
for k in ['bottom', 'boots', 'top', 'belt', 'gloves', 'cape_over']: comp = over(comp, layers[k])
bg = np.full(comp.shape[:2] + (3,), (90, 110, 90), np.uint8); al = comp[..., 3:] / 255
cv2.imwrite(f'{S}/gear/preview.png', cv2.resize((comp[..., :3] * al + bg * (1 - al)).astype(np.uint8), (512, 1536)))
print('ok')
