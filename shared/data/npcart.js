// Painted townspeople that move: each is one strip of equal frames in
// assets/npc/<key>.webp, cut by tools/slice-npc.py, stood on its foot at the
// bottom middle of the cell. `height` is how tall the cell is drawn, in world
// px; `seq` the order the frames play in (a loop), at `fps`.
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);

export const NPC_ART = {
  // the sheet's order: waits at the anvil (1-8, twice), forges a blade
  // (9-16), looks it over, polishes it and has a drink (17-24)
  blacksmith: {
    cell: [229, 192], frames: 24, height: 80, fps: 7,
    seq: [...range(0, 8), ...range(0, 24)],
  },
};
