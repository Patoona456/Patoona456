#!/usr/bin/env python3
"""
Give painted map art more life: more saturation, a gentle S-curve on
contrast, and a lift to the shadows. The AI-upscaled pictures come out a
little flat and grey, and the stone paving that fills most of the screen is
grey to begin with, so on a phone the town read as washed out.

    python3 vivid.py FILE [FILE...]      # rewrites each WebP/PNG in place

Keeps alpha. Run once per file.
"""
import sys, cv2, numpy as np

SAT, CONTRAST = 1.25, 0.16

def vivid(bgr):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    s = hsv[..., 1] / 255
    # only what already has colour gets more: grass, roofs, water, flowers.
    # Near-grey stone stays grey - boosting it turns the paving salmon.
    w = np.clip((s - 0.22) / 0.2, 0, 1)
    hsv[..., 1] = np.clip(255 * (s + w * (SAT - 1) * s * (1 - s) * 2.2), 0, 255)
    out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32) / 255
    out = out + CONTRAST * np.sin((out - 0.5) * np.pi) * 0.5        # S-curve round mid-grey
    return (np.clip(out, 0, 1) * 255).round().astype(np.uint8)

for f in sys.argv[1:]:
    im = cv2.imread(f, cv2.IMREAD_UNCHANGED)
    rgb = vivid(im[..., :3])
    im = np.dstack([rgb, im[..., 3]]) if im.shape[2] == 4 else rgb
    ok = cv2.imwrite(f, im, [cv2.IMWRITE_WEBP_QUALITY, 90] if f.endswith('.webp') else [])
    print(f, 'ok' if ok else 'FAILED')
