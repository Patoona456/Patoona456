// What a refined weapon looks like in the world.
//
// Refining is the game's deepest money sink, and a high refine is meant to be
// worth bragging about - so the levels people actually chase each get a
// visible tier. The first four are fire, escalating from a spark at +1 to a
// white flame at +7, which is where the odds turn against you. Past that the
// weapon has stopped being about fire: +8 is the first level that can shatter
// it, +10 is market-grade, and +12 is something a whole server notices.
/**
 * `sheet` is optional. When a tier names one, the renderer plays that art
 * over the wielder instead of tinting the weapon layer; when it does not, the
 * code-drawn aura that has always been here is used. Both can run at once,
 * which is what lets art be added one tier at a time rather than all or
 * nothing - a +5 with art and a +7 without still both look like something.
 */
export const GLOW_TIERS = [
  // The first four are the fire tiers: +1 is a spark, +7 is a weapon that
  // lights the room. Each may carry a sheet; until one arrives the aura below
  // is drawn in code exactly as before.
  { at: 1,  name: 'ประกายไฟ',    nameEn: 'Kindled',   color: [255, 196, 120], aura: 0.14, pulse: 0.8,  sparks: 0,    light: 0,   trail: 0,    sheet: null },
  { at: 3,  name: 'เปลวอ่อน',    nameEn: 'Smouldering', color: [255, 168, 88], aura: 0.26, pulse: 1.0, sparks: 0.4,  light: 30,  trail: 0,    sheet: null },
  { at: 5,  name: 'เพลิงกล้า',   nameEn: 'Blazing',   color: [255, 132, 60],  aura: 0.40, pulse: 1.3,  sparks: 1.0,  light: 58,  trail: 0.2,  sheet: null },
  { at: 7,  name: 'เพลิงขาว',    nameEn: 'Whitefire', color: [255, 224, 170], aura: 0.52, pulse: 1.6,  sparks: 1.6,  light: 80,  trail: 0.35, sheet: null },
  { at: 8,  name: 'สนธยา',       nameEn: 'Duskbound', color: [190, 140, 255], aura: 0.62, pulse: 1.8,  sparks: 2.0,  light: 92,  trail: 0.45 },
  { at: 10, name: 'อรุณทอง',     nameEn: 'Dawnforged', color: [255, 205, 110], aura: 0.72, pulse: 2.0, sparks: 2.4,  light: 104, trail: 0.55 },
  { at: 12, name: 'เปลวนิรันดร์', nameEn: 'Everember', color: [255, 130, 80],  aura: 0.92, pulse: 2.6, sparks: 3.4,  light: 132, trail: 0.85 },
];

/** The tier a given refine level has reached, or null at +0. */
export function glowTier(refine = 0) {
  let found = null;
  for (const t of GLOW_TIERS) if (refine >= t.at) found = t;
  return found;
}

/** CSS colour for icons, name plates and tooltips. */
export function glowCss(refine = 0, alpha = 1) {
  const t = glowTier(refine);
  if (!t) return null;
  return `rgba(${t.color.join(',')},${alpha})`;
}

/**
 * Where a tier's art lives, once there is any.
 *
 * Kept as a function rather than a literal path so that adding art is one
 * line in the table above, and so a missing file is a tier that falls back to
 * the code-drawn aura rather than a broken image over somebody's head.
 */
export function tierSheet(refine = 0) {
  return glowTier(refine)?.sheet ?? null;
}
