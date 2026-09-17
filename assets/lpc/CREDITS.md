# Art credits

Every sprite sheet under `assets/lpc/` comes from the
**Universal LPC Spritesheet** collection:

* Upstream: <https://github.com/makrohn/Universal-LPC-spritesheet>
* Origin: the Liberated Pixel Cup (<https://lpc.opengameart.org>)
* Licenses: **CC-BY-SA 3.0** *and* **GPL 3.0** (dual licensed) — see
  `cc-by-sa-3.0.txt` and `gpl-3.0.txt` in this folder.
* Full per-layer attribution list: `AUTHORS.txt` in this folder
  (Luke Mehl, Johannes Sjölund, Marcel van de Steeg, Manuel Riecke,
  Thane Brimhall, Matthew Krohn, Daniel Eddeland, and many others).

The sheets were copied unmodified by `tools/import-lpc.js` using the
mapping in `tools/lpc-manifest.json`; only the file names and folder
layout changed. Because the art is share-alike, any redistribution of
this game must keep this folder (including `AUTHORS.txt`) intact.

Layout of every sheet: 832x1344 px = 13 columns x 21 rows of 64x64
frames. Row groups, in order:

| Rows  | Animation  | Frames |
|-------|------------|--------|
| 0-3   | spellcast  | 7      |
| 4-7   | thrust     | 8      |
| 8-11  | walk       | 9      |
| 12-15 | slash      | 6      |
| 16-19 | shoot      | 13     |
| 20    | hurt/death | 6      |

Within each group the four rows are: up, left, down, right.
