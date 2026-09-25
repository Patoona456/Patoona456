# Upscaling town art

The town and field pictures and building sprites are AI art at a low resolution; on a
phone the camera enlarges them ~5x. They are upscaled once, offline, with
Real-ESRGAN (x4plus, 4x) and sharpened. Buildings are stored at 4x as WebP; the ground is cut into 2048px tiles of the 4x picture (assets/maps/emberhold/ground, 2px bleed) plus a 1x WebP used as placeholder and minimap.

Needs `torch` (CPU is fine), `opencv-python-headless`, `numpy`, and the
`RealESRGAN_x4plus.pth` weights (not committed, 67 MB).

    python3 esrgan.py RealESRGAN_x4plus.pth 4 base.png base_x4.png
    # then shrink base_x4.png to 2x (3072x2048) and save as WebP q92

    ESRGAN_WEIGHTS=RealESRGAN_x4plus.pth python3 buildings.py ../../assets/maps/emberhold
    # upscales every building PNG in place to 2x (alpha resized separately)

Run buildings.py on the original cut-outs only once; running it again
doubles them again.

Fields painted as pixel art (Greenmire) skip Real-ESRGAN: it repaints the
grass and cobbles soft. They are blown up 3x nearest-neighbour instead (so a
lossy WebP cannot smear colour across single pixels), cut with `tiles.py`,
and drawn unfiltered (`pixelArt: true` on the map):

    python3 -c "from PIL import Image; Image.open('../../assets/maps/source/greenmire.png').convert('RGB').resize((4608, 3072), Image.NEAREST).save('big_x3.png')"
    python3 tiles.py big_x3.png ../../assets/maps/greenmire/ground 2304x3072 2
