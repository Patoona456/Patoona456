// What each element looks like.
//
// The combat table in constants.js says what the eight elements *do*; this
// says what they *look like*, in one place, so a fire skill, a fire monster's
// death burst and a fire weapon's aura are all the same orange. Colours are
// kept as [r,g,b] triples because almost every user of them needs to build an
// `rgba(...)` string with a live alpha.
//
// The eight are the ones the art sheets are drawn for, and their names are
// the sheets' names: an element the art calls Fire is called fire here, so
// that wiring an effect to an element never needs a translation table.
//
// `core`  the bright middle of the effect, nearly white
// `main`  the colour people would name the element
// `deep`  the shadow side, used for outlines and the far edge of gradients
// `shape` how skillfx.js draws it: flames lick, shards stab, arcs fork,
//         motes drift, smoke pours, rays spear, dust rolls
export const ELEMENT_LOOK = {
  neutral:   { nameTh: 'ไร้ธาตุ', nameEn: 'Normal',    core: [255, 255, 255], main: [214, 226, 240], deep: [120, 138, 160], shape: 'slash', spin: 0.0 },
  fire:      { nameTh: 'เพลิง',   nameEn: 'Fire',      core: [255, 246, 200], main: [255, 138, 46],  deep: [168, 42, 18],   shape: 'flame', spin: 0.3 },
  ice:       { nameTh: 'เหมันต์', nameEn: 'Ice',       core: [240, 252, 255], main: [130, 205, 255], deep: [42, 96, 160],   shape: 'shard', spin: 0.15 },
  lightning: { nameTh: 'สายฟ้า',  nameEn: 'Lightning', core: [255, 252, 224], main: [255, 226, 96],  deep: [150, 108, 20],  shape: 'arc',   spin: 0.6 },
  earth:     { nameTh: 'ปฐพี',    nameEn: 'Earth',     core: [246, 232, 198], main: [178, 132, 74],  deep: [88, 58, 30],    shape: 'dust',  spin: 0.1 },
  wind:      { nameTh: 'วายุ',    nameEn: 'Wind',      core: [236, 255, 240], main: [126, 214, 150], deep: [40, 106, 76],   shape: 'mote',  spin: 0.45 },
  holy:      { nameTh: 'รัศมี',   nameEn: 'Holy',      core: [255, 255, 236], main: [255, 214, 120], deep: [186, 126, 26],  shape: 'ray',   spin: 0.1 },
  dark:      { nameTh: 'อสูร',    nameEn: 'Dark',      core: [226, 190, 255], main: [138, 74, 190],  deep: [34, 14, 54],    shape: 'smoke', spin: 0.25 },
};

/**
 * What the elements used to be called.
 *
 * Kept because saved characters carry item stacks and monsters carry element
 * tags that were written before the rename, and a world that loads an old
 * save must not quietly turn every flame sword neutral.
 */
export const ELEMENT_ALIASES = {
  ember: 'fire', frost: 'ice', storm: 'lightning', radiant: 'holy', shade: 'dark',
  // Verdant was plants and growing things; the sheets have no such element,
  // and of their eight it is earth that covers the same ground.
  verdant: 'earth',
};

/** An element name as it is now, whatever it used to be. */
export function canonical(element) {
  if (!element) return 'neutral';
  return ELEMENT_LOOK[element] ? element : (ELEMENT_ALIASES[element] ?? 'neutral');
}

/** Never returns undefined: anything unknown reads as neutral. */
export function look(element) {
  return ELEMENT_LOOK[canonical(element)] ?? ELEMENT_LOOK.neutral;
}

/** `rgba()` for one of the three tones of an element. */
export function rgba(element, tone = 'main', alpha = 1) {
  const c = look(element)[tone] ?? look(element).main;
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

/** "r,g,b" - the form the particle system takes. */
export function triple(element, tone = 'main') {
  return look(element)[tone].join(',');
}
