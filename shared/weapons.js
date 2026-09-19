// The twelve weapon classes the art sheets are drawn for.
//
// A weapon class is three things at once: what a job is allowed to hold,
// which animation a swing plays, and which sheet the renderer reaches for.
// All three used to be decided in different files from four hard-coded
// names, so adding a class meant editing the server, the client and the
// item table and hoping they agreed. They are one table now.
//
// `hands` is 1 or 2 - a two-handed class cannot also carry an offhand, and
// the item table repeats it per item because a class can have exceptions
// (a halberd is a two-handed spear; a short spear is not).
//
// `anim` names the attack animation for an ordinary swing. `slash` is the
// default because most things are swung; only reach weapons thrust and only
// bows shoot.
export const WEAPON_CLASSES = {
  sword:      { id: 'sword',      nameTh: 'ดาบ',          nameEn: 'Sword',      hands: 1, anim: 'slash',     magic: false },
  greatsword: { id: 'greatsword', nameTh: 'ดาบใหญ่',      nameEn: 'Greatsword', hands: 2, anim: 'slash',     magic: false },
  dagger:     { id: 'dagger',     nameTh: 'มีดสั้น',       nameEn: 'Dagger',     hands: 1, anim: 'slash',     magic: false },
  axe:        { id: 'axe',        nameTh: 'ขวาน',         nameEn: 'Axe',        hands: 1, anim: 'slash',     magic: false },
  spear:      { id: 'spear',      nameTh: 'หอก',          nameEn: 'Spear',      hands: 1, anim: 'thrust',    magic: false },
  bow:        { id: 'bow',        nameTh: 'ธนู',          nameEn: 'Bow',        hands: 2, anim: 'shoot',     magic: false },
  staff:      { id: 'staff',      nameTh: 'ไม้เท้า',       nameEn: 'Staff',      hands: 2, anim: 'spellcast', magic: true },
  wand:       { id: 'wand',       nameTh: 'คทา',          nameEn: 'Wand',       hands: 1, anim: 'spellcast', magic: true },
  knuckle:    { id: 'knuckle',    nameTh: 'สนับมือ',       nameEn: 'Knuckle',    hands: 1, anim: 'slash',     magic: false },
  throwing:   { id: 'throwing',   nameTh: 'อาวุธขว้าง',    nameEn: 'Throwing',   hands: 1, anim: 'thrust',    magic: false },
  // Shields live in the offhand, not the weapon slot. The class exists so
  // that shield art is addressed the same way every other piece of weapon
  // art is, and so a job's allow-list can say it out loud.
  shield:     { id: 'shield',     nameTh: 'โล่',          nameEn: 'Shield',     hands: 1, anim: 'slash',     magic: false, offhand: true },
  // The board's catch-all, and ours: a handful of uniques that belong to no
  // class and every job can hold. There is deliberately no ladder of them -
  // a special weapon is a thing that dropped once, not a rung.
  special:    { id: 'special',    nameTh: 'พิเศษ',        nameEn: 'Special',    hands: 1, anim: 'slash',     magic: false, anyJob: true },
};

/** The names the game had before the sheets arrived. */
export const WEAPON_ALIASES = { blade: 'dagger', rod: 'wand' };

export function canonicalWeapon(wclass) {
  if (!wclass) return null;
  return WEAPON_CLASSES[wclass] ? wclass : (WEAPON_ALIASES[wclass] ?? null);
}

/** Can a job hold this class? `special` is held by everyone, by design. */
export function jobCanHold(job, wclass) {
  const w = canonicalWeapon(wclass);
  if (!w) return true;                       // unclassed weapon: no restriction
  if (WEAPON_CLASSES[w].anyJob) return true;
  return (job?.weapons ?? []).includes(w);
}

/**
 * Does a weapon satisfy a skill's `weapon:` restriction?
 *
 * A special weapon satisfies every restriction for the same reason any job
 * may hold one: a unique that locked you out of your own skill bar would be
 * a downgrade wearing the word "legendary".
 */
export function weaponAllows(list, wclass) {
  if (!list?.length) return true;
  const w = canonicalWeapon(wclass);
  if (!w) return false;
  return w === 'special' || list.includes(w);
}

/** The attack animation a class swings with. */
export function swingAnim(wclass) {
  return WEAPON_CLASSES[canonicalWeapon(wclass)]?.anim ?? 'slash';
}
