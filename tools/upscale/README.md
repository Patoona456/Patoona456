# Upscaling town art

The town picture and building sprites are AI art at a low resolution; on a
phone the camera enlarges them ~5x. They are upscaled once, offline, with
Real-ESRGAN (x4plus, 4x) and stored at 2x.

Needs `torch` (CPU is fine), `opencv-python-headless`, `numpy`, and the
`RealESRGAN_x4plus.pth` weights (not committed, 67 MB).

    python3 esrgan.py RealESRGAN_x4plus.pth 4 base.png base_x4.png
    # then shrink base_x4.png to 2x (3072x2048) and save as WebP q92

    ESRGAN_WEIGHTS=RealESRGAN_x4plus.pth python3 buildings.py ../../assets/maps/emberhold
    # upscales every building PNG in place to 2x (alpha resized separately)

Run buildings.py on the original cut-outs only once; running it again
doubles them again.
