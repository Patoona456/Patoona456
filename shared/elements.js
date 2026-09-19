// What each element looks like.
//
// The combat table in constants.js says what the seven elements *do*; this
// says what they *look like*, in one place, so a fire skill, a fire monster's
// death burst and a fire weapon's aura are all the same orange. Colours are
// kept as [r,g,b] triples because almost every user of them needs to build an
// `rgba(...)` string with a live alpha.
//
// `core`  the bright middle of the effect, nearly white
// `main`  the colour people would name the element
// `deep`  the shadow side, used for outlines and the far edge of gradients
// `shape` how skillfx.js draws it: flames lick, shards stab, arcs fork,
//         motes drift, smoke pours, rays spear
export const ELEMENT_LOOK = {
  neutral: { nameTh: 'ไร้ธาตุ', core: [255, 255, 255], main: [214, 226, 240], deep: [120, 138, 160], shape: 'slash', spin: 0.0 },
  ember:   { nameTh: 'เพลิง',   core: [255, 246, 200], main: [255, 138, 46],  deep: [168, 42, 18],   shape: 'flame', spin: 0.3 },
  frost:   { nameTh: 'เหมันต์', core: [240, 252, 255], main: [130, 205, 255], deep: [42, 96, 160],   shape: 'shard', spin: 0.15 },
  storm:   { nameTh: 'พายุ',    core: [255, 252, 224], main: [176, 150, 255], deep: [76, 52, 150],   shape: 'arc',   spin: 0.6 },
  verdant: { nameTh: 'พฤกษา',   core: [236, 255, 196], main: [126, 214, 96],  deep: [40, 106, 48],   shape: 'mote',  spin: 0.2 },
  shade:   { nameTh: 'อสูร',    core: [226, 190, 255], main: [138, 74, 190],  deep: [34, 14, 54],    shape: 'smoke', spin: 0.25 },
  radiant: { nameTh: 'รัศมี',   core: [255, 255, 236], main: [255, 214, 120], deep: [186, 126, 26],  shape: 'ray',   spin: 0.1 },
};

/** Never returns undefined: anything unknown reads as neutral. */
export function look(element) {
  return ELEMENT_LOOK[element] ?? ELEMENT_LOOK.neutral;
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
