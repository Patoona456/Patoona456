// What a refined weapon looks like in the world.
//
// Refining is the game's deepest money sink, and +10 gear is meant to be
// worth bragging about - so the levels people actually chase each get a
// visible aura. The tiers are the ones the economy already treats as
// milestones: +3 and +5 are cheap and common, +7 is where the odds turn,
// +8 is the first level that can shatter, +10 is market-grade, and +12 is
// something a whole server notices.
export const GLOW_TIERS = [
  { at: 3,  name: 'เหล็กกล้า',   nameEn: 'Tempered',  color: [210, 226, 240], aura: 0.22, pulse: 0.9,  sparks: 0,    light: 0,   trail: 0 },
  { at: 5,  name: 'สายน้ำ',      nameEn: 'Tidewrought', color: [120, 190, 255], aura: 0.34, pulse: 1.1, sparks: 0.5,  light: 40,  trail: 0 },
  { at: 7,  name: 'มรกต',        nameEn: 'Verdant',   color: [120, 255, 200], aura: 0.44, pulse: 1.3,  sparks: 1.0,  light: 60,  trail: 0.2 },
  { at: 8,  name: 'สนธยา',       nameEn: 'Duskbound', color: [190, 140, 255], aura: 0.56, pulse: 1.6,  sparks: 1.6,  light: 78,  trail: 0.35 },
  { at: 10, name: 'อรุณทอง',     nameEn: 'Dawnforged', color: [255, 205, 110], aura: 0.72, pulse: 2.0, sparks: 2.4,  light: 104, trail: 0.55 },
  { at: 12, name: 'เปลวนิรันดร์', nameEn: 'Everember', color: [255, 130, 80],  aura: 0.92, pulse: 2.6, sparks: 3.4,  light: 132, trail: 0.85 },
];

/** The tier a given refine level has reached, or null below +3. */
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
