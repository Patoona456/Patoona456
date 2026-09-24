# Chibi art

All of it is supplied by the project owner (not LPC, and not covered by the LPC
licences in `assets/lpc/`).

- `source/base_male.png`: the bald base board, 8 walk frames x 4 facings.
  `tools/slice-base.py` cuts it to `body/base_male.png` (128x192 frames,
  8 across, rows down/left/up/right), fits the hair layers in `hair/`, and
  writes the head and fist positions to `shared/data/chibi.js`.
- `source/hero_brown.png`: the first walk board, with its hair painted on.
  `source/hero_brown_grid.png` is it re-cut onto a grid by
  `tools/slice-chibi.py`; the hair in `hair/spiky_*.png` is lifted off it.

Re-run `python3 tools/slice-base.py` after editing either source.
