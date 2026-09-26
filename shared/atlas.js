// Where an icon-sheet picture lives.
//
// Item art is named 'sheet#cell' (shared/data/items.js), and that name never
// changes. Some sheets are files of their own; the five sword grades share
// one file, weapons.webp, with the bows, to keep the demo under its file cap. This table is
// the only place that knows which is which, so the icons, the held weapon and
// the loot on the ground all find the same picture.
//
// A merged file is a grid of square cells, MERGED_COLS across; each sheet in
// it starts on its own row and keeps its own column count. Cut and merged by
// tools/slice-ui.py, whose WEAPON_SHEETS must list the same sheets in the
// same order.

export const MERGED_COLS = 8;

export const ATLASES = {
  potions: { cols: 8 },
  drops: { cols: 10 },        // monster loot: icons, falling, lying, picked up (tools/slice-drops.py)
  scrolls: { cols: 8 },
  // worn and icons: a tier a row, its Front first (tools/slice-helmets.py);
  // a piece stands on its cell's floor with room above for a plume, so its
  // icon is the lower middle of the cell, `zoom` times closer
  helmets: { cols: 4, zoom: 1.25 },
  swords: { in: 'weapons', cols: 6, row: 0, count: 24 },
  swords_rare: { in: 'weapons', cols: 8, row: 4, count: 25 },
  swords_epic: { in: 'weapons', cols: 8, row: 8, count: 23 },
  swords_legendary: { in: 'weapons', cols: 8, row: 11, count: 25 },
  swords_mythic: { in: 'weapons', cols: 8, row: 15, count: 26 },
  bows: { in: 'weapons', cols: 8, row: 19, count: 21 },
};

/** The file a sheet's pictures are in (without the .webp). */
export function atlasFile(sheet) {
  return ATLASES[sheet]?.in ?? sheet;
}

/** The square a picture occupies in its file, given that file's pixel width. */
export function atlasRect(sheet, cell, fileWidth) {
  const a = ATLASES[sheet];
  if (!a) return null;
  const size = fileWidth / (a.in ? MERGED_COLS : a.cols);
  const i = +cell;
  return { sx: (i % a.cols) * size, sy: ((a.row ?? 0) + Math.floor(i / a.cols)) * size, size };
}

/** Every file the sheets live in, for preloading. */
export const ATLAS_FILES = [...new Set(Object.keys(ATLASES).map(atlasFile))];
