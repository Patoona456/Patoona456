// Every place a character can wear something.
//
// The art boards describe fifteen, the game had ten, and the five that were
// missing are the ones that let a character look like a person rather than a
// set of stats: a cloak, a scarf, glasses, a mask, and armour worn *over* a
// shirt rather than instead of one.
//
// A slot says three things: what to call it, where it is drawn, and whether
// it is worn over something else. Keeping that in one table is what stops the
// server's stat loop, the client's paper doll and the renderer's layer order
// from each holding their own opinion of what a slot is - which is how the
// weapon classes went wrong before they were a table.
//
// `layer` names an LPC art layer, `drawn` names a shape drawn in code
// (client/js/apparel.js and wings.js), and a slot with neither is worn but
// not seen - an accessory is a ring, and a ring is two pixels.
export const SLOT_INFO = {
  weapon:    { nameTh: 'อาวุธ',          nameEn: 'Weapon',    layer: 'weapon' },
  offhand:   { nameTh: 'มือรอง',         nameEn: 'Offhand',   layer: 'offhand' },
  head:      { nameTh: 'ศีรษะ',          nameEn: 'Head',      layer: 'head' },
  torso:     { nameTh: 'ลำตัว',          nameEn: 'Top',       layer: 'torso' },
  // The board draws Armor as its own row over Top, and it is right to: a
  // breastplate over a shirt is how armour has always worked, and splitting
  // them means the shirt keeps mattering after the plate arrives.
  armor:     { nameTh: 'เกราะ',          nameEn: 'Armor',     layer: 'armor', over: 'torso' },
  hands:     { nameTh: 'มือ',            nameEn: 'Gloves',    layer: 'hands' },
  legs:      { nameTh: 'ขา',             nameEn: 'Bottom',    layer: 'legs' },
  feet:      { nameTh: 'เท้า',           nameEn: 'Shoes',     layer: 'feet' },
  belt:      { nameTh: 'เข็มขัด',        nameEn: 'Belt',      layer: 'belt' },
  cloak:     { nameTh: 'ผ้าคลุม',        nameEn: 'Cloak',     drawn: 'cloak' },
  scarf:     { nameTh: 'ผ้าพันคอ',       nameEn: 'Scarf',     drawn: 'scarf' },
  glasses:   { nameTh: 'แว่น',           nameEn: 'Glasses',   drawn: 'glasses' },
  mask:      { nameTh: 'หน้ากาก',        nameEn: 'Mask',      drawn: 'mask' },
  accessory: { nameTh: 'เครื่องประดับ',  nameEn: 'Accessory' },
  // `drawn` names the field on the item that carries the shape, and wings
  // have always spelled theirs `wing`. Matching the data beats renaming six
  // items and the renderer to match a table written afterwards.
  wings:     { nameTh: 'ปีก',            nameEn: 'Wings',     drawn: 'wing' },
};

/** The order the paper doll and the stat loop walk. */
export const SLOTS = Object.keys(SLOT_INFO);

/** The five the boards added, kept separate so a save written before them
 *  can be recognised rather than guessed at. */
export const NEW_SLOTS = ['armor', 'cloak', 'scarf', 'glasses', 'mask'];

export const slotName = (slot) => SLOT_INFO[slot]?.nameTh ?? slot;

/** Slots drawn by code rather than by a sheet, in back-to-front order. */
export const DRAWN_SLOTS = SLOTS.filter((s) => SLOT_INFO[s].drawn);
