# Cleaning the Emberhold backdrop

`assets/maps/source/emberhold.png` is the picture as supplied; the game uses
`assets/maps/emberhold.jpg`, which is that picture with the shop signs,
their round icons and the corner logos painted out.

The scripts expect a working folder `DIR` holding `pt/town.png` (the source),
and write their results there:

    python3 remove_signs.py DIR   # signs + icons -> pt/clean5.png (patch synthesis from nearby pixels)
    python3 fill_corners.py DIR   # corner logos  -> pt/clean6.png (forest patches, see forest.json)

`regions.py` holds the sign/icon rectangles. The last step (soft shade over
the corners, save as JPEG q92) is in the commit that added this folder.
Needs `opencv-contrib-python-headless` and `numpy`.
