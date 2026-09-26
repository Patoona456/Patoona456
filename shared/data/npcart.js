// Painted townspeople that move: each is one strip of equal frames in
// assets/npc/<key>.webp, cut by tools/slice-npc.py, stood on its foot at the
// bottom middle of the cell. `height` is how tall the cell is drawn, in world
// px; `seq` the order the frames play in (a loop), at `fps`.
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);

export const NPC_ART = {
  // the sheet's order: waits at the anvil (1-8, twice), forges a blade
  // (9-16), looks it over, polishes it and has a drink (17-24)
  blacksmith: {
    cell: [194, 192], frames: 24, height: 80, fps: 7,
    seq: [...range(0, 8), ...range(0, 24)],
  },
  // at her counter: tends her bottles (1-8), brews at the cauldron (9-16),
  // hands out potions, packs a basket, writes her ledger (17-24)
  potion: {
    cell: [182, 192], frames: 24, height: 82, fps: 7,
    seq: [...range(0, 8), ...range(0, 24)],
  },
  // at his stall: shows his wares (1-8), polishes and shows off a sword
  // (9-16), a spear, the till, his books (17-24)
  weapon: {
    cell: [192, 192], frames: 24, height: 84, fps: 7,
    seq: [...range(0, 8), ...range(0, 24)],
  },
};
