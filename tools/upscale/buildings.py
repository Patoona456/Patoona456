import sys, glob, os, cv2, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from esrgan import load, run
net = load(os.environ.get('ESRGAN_WEIGHTS', 'RealESRGAN_x4plus.pth'), 4)
for f in sorted(glob.glob(sys.argv[1] + '/*.png')):
    im = cv2.imread(f, cv2.IMREAD_UNCHANGED)
    h, w = im.shape[:2]
    a = im[..., 3].astype(np.float32) / 255
    # premultiply onto a neutral grey so the edges do not grow a coloured halo
    rgb = (im[..., :3] * a[..., None] + 128 * (1 - a[..., None])).astype(np.uint8)
    big = run(net, rgb, 4, tile=200)
    big = cv2.resize(big, (w * 2, h * 2), interpolation=cv2.INTER_AREA)
    al = cv2.resize(im[..., 3], (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
    out = np.dstack([big, al])
    cv2.imwrite(f, out, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    print('\n', os.path.basename(f), w, h, '->', w * 2, h * 2)
