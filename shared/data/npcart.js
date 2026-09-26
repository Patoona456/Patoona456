// Painted townspeople that move: each is one strip of equal frames in
// assets/npc/<key>.webp, cut by tools/slice-npc.py, stood on its foot at the
// bottom middle of the cell. `height` is how tall the cell is drawn, in world
// px; `seq` the order the frames play in (a loop), at `fps` - slow on
// purpose: a townsperson at work, not a character in a fight (a loop of 32
// frames takes about seven seconds).
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);

export const NPC_ART = {
  // the sheet's order: waits at the anvil (1-8, twice), forges a blade
  // (9-16), looks it over, polishes it and has a drink (17-24)
  blacksmith: {
    cell: [194, 192], frames: 24, height: 80, fps: 4.5,
    seq: [...range(0, 8), ...range(0, 24)],
  },
  // at her counter: tends her bottles (1-8), brews at the cauldron (9-16),
  // hands out potions, packs a basket, writes her ledger (17-24)
  potion: {
    cell: [182, 192], frames: 24, height: 82, fps: 4.5,
    seq: [...range(0, 8), ...range(0, 24)],
  },
  // at his stall: shows his wares (1-8), polishes and shows off a sword
  // (9-16), a spear, the till, his books (17-24)
  weapon: {
    cell: [192, 192], frames: 24, height: 84, fps: 4.5,
    seq: [...range(0, 8), ...range(0, 24)],
  },
  // among her racks: greets, reads the order book (1-8), shines helmets and
  // a breastplate, shows a shield (9-16), dresses a stand, opens a chest (17-24)
  armor: {
    cell: [213, 192], frames: 24, height: 84, fps: 4.5,
    seq: [...range(0, 8), ...range(0, 24)],
  },
  // under her striped awning: waves, weighs goods (1-8), fetches potions,
  // scrolls and herbs to order (9-16), wraps a gift, counts coin (17-24)
  general: {
    cell: [197, 192], frames: 24, height: 90, fps: 4.5,
    seq: [...range(0, 8), ...range(0, 24)],
  },
  // the royal class master, an elf mage with her staff (tools/slice-npc-fx.py):
  // at rest, gathering light, a circle under her feet, the rite and its
  // stars, and back to rest (1-60). Her feet stand `foot` of the way down the
  // cell, the circle below them; slower than the tradesfolk, it is a rite
  jobmaster: {
    cell: [176, 192], frames: 60, height: 90, fps: 6, foot: 153 / 175,
    seq: range(0, 60),
  },
};
