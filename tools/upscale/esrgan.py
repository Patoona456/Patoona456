# Minimal RRDBNet (the Real-ESRGAN generator), enough to load its weights.
import sys, torch, torch.nn as nn, torch.nn.functional as F, cv2, numpy as np

class RDB(nn.Module):
    def __init__(s, nf=64, gc=32):
        super().__init__()
        s.conv1 = nn.Conv2d(nf, gc, 3, 1, 1); s.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1)
        s.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1); s.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1)
        s.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1); s.l = nn.LeakyReLU(0.2, True)
    def forward(s, x):
        x1 = s.l(s.conv1(x)); x2 = s.l(s.conv2(torch.cat((x, x1), 1)))
        x3 = s.l(s.conv3(torch.cat((x, x1, x2), 1))); x4 = s.l(s.conv4(torch.cat((x, x1, x2, x3), 1)))
        return s.conv5(torch.cat((x, x1, x2, x3, x4), 1)) * 0.2 + x
class RRDB(nn.Module):
    def __init__(s, nf=64, gc=32):
        super().__init__(); s.rdb1, s.rdb2, s.rdb3 = RDB(nf, gc), RDB(nf, gc), RDB(nf, gc)
    def forward(s, x): return s.rdb3(s.rdb2(s.rdb1(x))) * 0.2 + x
class RRDBNet(nn.Module):
    def __init__(s, scale, nb=23, nf=64, gc=32):
        super().__init__(); s.scale = scale
        cin = 3 * (4 if scale == 2 else 1)
        s.conv_first = nn.Conv2d(cin, nf, 3, 1, 1)
        s.body = nn.Sequential(*[RRDB(nf, gc) for _ in range(nb)])
        s.conv_body = nn.Conv2d(nf, nf, 3, 1, 1)
        s.conv_up1 = nn.Conv2d(nf, nf, 3, 1, 1); s.conv_up2 = nn.Conv2d(nf, nf, 3, 1, 1)
        s.conv_hr = nn.Conv2d(nf, nf, 3, 1, 1); s.conv_last = nn.Conv2d(nf, 3, 3, 1, 1)
        s.l = nn.LeakyReLU(0.2, True)
    def forward(s, x):
        if s.scale == 2: x = F.pixel_unshuffle(x, 2)
        f = s.conv_first(x); f = f + s.conv_body(s.body(f))
        f = s.l(s.conv_up1(F.interpolate(f, scale_factor=2, mode='nearest')))
        f = s.l(s.conv_up2(F.interpolate(f, scale_factor=2, mode='nearest')))
        return s.conv_last(s.l(s.conv_hr(f)))

def load(path, scale):
    net = RRDBNet(scale); sd = torch.load(path, map_location='cpu')
    sd = sd.get('params_ema', sd.get('params', sd))
    # ai-forever checkpoints use slightly different key names
    ren = {}
    for k, v in sd.items():
        k2 = k.replace('RDB1', 'rdb1').replace('RDB2', 'rdb2').replace('RDB3', 'rdb3').replace('trunk_conv', 'conv_body') \
              .replace('RRDB_trunk', 'body').replace('upconv1', 'conv_up1').replace('upconv2', 'conv_up2').replace('HRconv', 'conv_hr')
        ren[k2] = v
    net.load_state_dict(ren, strict=True); net.eval(); return net

def run(net, img, scale, tile=256, pad=12):
    h, w = img.shape[:2]
    x = torch.from_numpy(img[..., ::-1].copy()).permute(2, 0, 1).float().unsqueeze(0) / 255
    out = torch.zeros(1, 3, h * scale, w * scale)
    torch.set_num_threads(max(1, torch.get_num_threads()))
    with torch.no_grad():
        for y0 in range(0, h, tile):
            for x0 in range(0, w, tile):
                ya, xa = max(0, y0 - pad), max(0, x0 - pad)
                yb, xb = min(h, y0 + tile + pad), min(w, x0 + tile + pad)
                o = net(x[..., ya:yb, xa:xb])
                oy, ox = (y0 - ya) * scale, (x0 - xa) * scale
                th, tw = (min(h, y0 + tile) - y0) * scale, (min(w, x0 + tile) - x0) * scale
                out[..., y0*scale:y0*scale+th, x0*scale:x0*scale+tw] = o[..., oy:oy+th, ox:ox+tw]
                print('.', end='', flush=True)
    o = (out[0].clamp(0, 1).permute(1, 2, 0).numpy()[..., ::-1] * 255).round().astype(np.uint8)
    return o

if __name__ == '__main__':
    model, scale, src, dst = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
    net = load(model, scale)
    img = cv2.imread(src)
    cv2.imwrite(dst, run(net, img, scale))
    print('\nok', dst)
