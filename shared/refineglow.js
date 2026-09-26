// What a refined weapon looks like in the world.
//
// Refining is the game's deepest money sink, and a high refine is meant to
// be worth bragging about - so every level people can reach has a look of
// its own, from +1 to the cap. The art boards split a weapon's appearance
// into four independent things, and so does this file:
//
//   1. the refine tier   - how much was SPENT on it        (this table)
//   2. the element       - what it IS                      (shared/elements.js)
//   3. the special marks - what it DOES to people          (SPECIAL_MARKS)
//   4. the signature     - the one legendary flourish      (SIGNATURES)
//
// They compose. A +12 fire sword with lifesteal wears all three at once,
// which is the whole reason they are separate lists rather than one enum of
// every combination.
import { canonical as canonicalElement } from './elements.js';

/** The hard ceiling. Refining stops here; the odds do the discouraging. */
export const MAX_REFINE = 15;

/**
 * The eight primitives every effect is built out of. A tier names the ones
 * it uses, so the renderer decides what to draw from the table rather than
 * from a ladder of `if (tier.at >= n)`, and so art can arrive one primitive
 * at a time.
 */
export const OVERLAYS = ['glow1', 'glow2', 'particle', 'aura', 'slash', 'circle', 'flare', 'spark'];

/**
 * `sheet` is optional. When a tier names one, the renderer plays that art
 * over the wielder instead of only tinting the weapon layer; when it does
 * not, the code-drawn aura is used. Both can run at once, which is what lets
 * art be added one tier at a time rather than all or nothing - a +5 with art
 * and a +7 without still both look like something.
 *
 * `band` says which of the board's three ladders a level belongs to. The
 * first seven are fire, escalating from a spark to a weapon that lights the
 * room. +8 is where a failure can shatter the thing, so the fire gives way
 * to something colder and stranger. +12 and up is what a server notices.
 */
export const GLOW_TIERS = [
  { at: 1,  band: 'ember',     name: 'ประกายไฟ',     nameEn: 'Kindled',     color: [255, 196, 120], aura: 0.14, pulse: 0.8,  sparks: 0,    light: 0,   trail: 0,    layers: ['glow1'], sheet: null },
  { at: 2,  band: 'ember',     name: 'ถ่านแดง',      nameEn: 'Emberlit',    color: [255, 180, 104], aura: 0.20, pulse: 0.9,  sparks: 0.18, light: 14,  trail: 0,    layers: ['glow1', 'spark', 'circle'], sheet: null },
  { at: 3,  band: 'ember',     name: 'เปลวอ่อน',     nameEn: 'Smouldering', color: [255, 168, 88],  aura: 0.26, pulse: 1.0,  sparks: 0.4,  light: 30,  trail: 0,    layers: ['glow1', 'spark', 'circle'], sheet: null },
  { at: 4,  band: 'ember',     name: 'เปลวลุก',      nameEn: 'Flaring',     color: [255, 150, 74],  aura: 0.33, pulse: 1.15, sparks: 0.7,  light: 44,  trail: 0.1,  layers: ['glow1', 'glow2', 'spark', 'circle'], sheet: null },
  { at: 5,  band: 'ember',     name: 'เพลิงกล้า',    nameEn: 'Blazing',     color: [255, 132, 60],  aura: 0.40, pulse: 1.3,  sparks: 1.0,  light: 58,  trail: 0.2,  layers: ['glow1', 'glow2', 'spark', 'circle'], sheet: null },
  { at: 6,  band: 'ember',     name: 'เพลิงโหม',     nameEn: 'Roaring',     color: [255, 170, 96],  aura: 0.46, pulse: 1.45, sparks: 1.3,  light: 69,  trail: 0.28, layers: ['glow1', 'glow2', 'spark', 'circle', 'particle'], sheet: null },
  { at: 7,  band: 'ember',     name: 'เพลิงขาว',     nameEn: 'Whitefire',   color: [255, 224, 170], aura: 0.52, pulse: 1.6,  sparks: 1.6,  light: 80,  trail: 0.35, layers: ['glow1', 'glow2', 'spark', 'circle', 'particle'], sheet: null },

  { at: 8,  band: 'duskbound', name: 'สนธยา',        nameEn: 'Duskbound',   color: [190, 140, 255], aura: 0.62, pulse: 1.8,  sparks: 2.0,  light: 92,  trail: 0.45, layers: ['glow1', 'glow2', 'spark', 'circle', 'particle', 'aura'] },
  { at: 9,  band: 'duskbound', name: 'ราตรีลึก',     nameEn: 'Nightfallen', color: [176, 128, 248], aura: 0.67, pulse: 1.9,  sparks: 2.2,  light: 98,  trail: 0.50, layers: ['glow1', 'glow2', 'spark', 'circle', 'particle', 'aura'] },
  { at: 10, band: 'duskbound', name: 'อรุณทอง',      nameEn: 'Dawnforged',  color: [255, 205, 110], aura: 0.72, pulse: 2.0,  sparks: 2.4,  light: 104, trail: 0.55, layers: ['glow1', 'glow2', 'spark', 'circle', 'particle', 'aura', 'flare'] },
  { at: 11, band: 'duskbound', name: 'อรุณเพลิง',    nameEn: 'Dawnblaze',   color: [255, 186, 96],  aura: 0.82, pulse: 2.3,  sparks: 2.9,  light: 118, trail: 0.70, layers: ['glow1', 'glow2', 'spark', 'circle', 'particle', 'aura', 'flare'] },

  { at: 12, band: 'everember', name: 'เปลวนิรันดร์', nameEn: 'Everember',   color: [255, 130, 80],  aura: 0.92, pulse: 2.6,  sparks: 3.4,  light: 132, trail: 0.85, layers: ['glow1', 'glow2', 'spark', 'circle', 'particle', 'aura', 'flare', 'slash'] },
  { at: 13, band: 'everember', name: 'ดาวตก',        nameEn: 'Starfallen',  color: [255, 240, 196], aura: 1.00, pulse: 2.8,  sparks: 3.9,  light: 146, trail: 0.95, layers: ['glow1', 'glow2', 'spark', 'circle', 'particle', 'aura', 'flare', 'slash'] },
  { at: 14, band: 'everember', name: 'เพลิงมังกร',   nameEn: 'Dragonfire',  color: [255, 108, 52],  aura: 1.08, pulse: 3.0,  sparks: 4.4,  light: 160, trail: 1.05, layers: OVERLAYS },
  // Named after the world, and reachable by roughly one weapon in a
  // thousand attempts from +0. If anybody ever gets one, everybody sees it.
  { at: 15, band: 'everember', name: 'อาร์ทาเรีย', nameEn: 'Artaria',      color: [255, 236, 214], aura: 1.20, pulse: 3.3,  sparks: 5.2,  light: 180, trail: 1.20, layers: OVERLAYS },
];

/**
 * The eight "what this weapon does to you" overlays. These are a property of
 * the item, not of its refine: a +0 dagger that drinks blood still shows it.
 *
 * Two of them are read straight off numbers the item already carries, so
 * they can never drift out of sync with the stat block. The rest are stated
 * by the item, because nothing else in the data encodes them.
 */
export const SPECIAL_MARKS = {
  critical:  { nameTh: 'คริติคอล',  nameEn: 'Critical',   color: [255, 226, 120] },
  poison:    { nameTh: 'พิษ',       nameEn: 'Poison',     color: [138, 204, 96] },
  bleed:     { nameTh: 'เลือดไหล',  nameEn: 'Bleed',      color: [214, 62, 62] },
  lifesteal: { nameTh: 'ดูดเลือด',  nameEn: 'Life Steal', color: [186, 46, 96] },
  manaburn:  { nameTh: 'เผามานา',   nameEn: 'Mana Burn',  color: [120, 166, 255] },
  curse:     { nameTh: 'คำสาป',     nameEn: 'Curse',      color: [150, 92, 200] },
  heal:      { nameTh: 'เยียวยา',   nameEn: 'Heal',       color: [140, 232, 168] },
  shield:    { nameTh: 'โล่',       nameEn: 'Shield',     color: [186, 214, 255] },
};

/**
 * The six signatures a legendary piece wears. Which one it gets follows from
 * its element rather than being chosen per item, so a legendary added later
 * arrives with the right flourish instead of none.
 */
export const SIGNATURES = {
  dragon_flame:  { nameTh: 'เปลวมังกร',    nameEn: 'Dragon Flame',  element: 'fire',      color: [255, 122, 48] },
  frost_nova:    { nameTh: 'โนวาเหมันต์',  nameEn: 'Frost Nova',    element: 'ice',       color: [140, 212, 255] },
  thunder_god:   { nameTh: 'เทพสายฟ้า',    nameEn: 'Thunder God',   element: 'lightning', color: [255, 232, 110] },
  nature_spirit: { nameTh: 'ภูตพนา',       nameEn: 'Nature Spirit', element: 'wind',      color: [132, 220, 156] },
  holy_light:    { nameTh: 'แสงศักดิ์สิทธิ์', nameEn: 'Holy Light',  element: 'holy',      color: [255, 226, 150] },
  shadow_reaper: { nameTh: 'เคียวเงา',     nameEn: 'Shadow Reaper', element: 'dark',      color: [146, 84, 196] },
};

const BY_ELEMENT = Object.fromEntries(Object.entries(SIGNATURES).map(([id, s]) => [s.element, id]));
// earth has no sheet of its own on the board; it rides with the nature one
BY_ELEMENT.earth = 'nature_spirit';

/** The tier a given refine level has reached, or null at +0. */
export function glowTier(refine = 0) {
  let found = null;
  for (const t of GLOW_TIERS) if (refine >= t.at) found = t;
  return found;
}

/** Whether a tier draws a given overlay primitive. */
export function hasOverlay(tier, name) {
  return !!tier && (tier.layers ?? []).includes(name);
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

/**
 * The special marks an item wears, in table order so two items with the same
 * marks always draw them the same way round.
 */
export function specialMarks(def) {
  if (!def) return [];
  const out = new Set(def.marks ?? []);
  if ((def.crit ?? 0) >= 5) out.add('critical');
  if ((def.lifesteal ?? 0) > 0) out.add('lifesteal');
  return Object.keys(SPECIAL_MARKS).filter((m) => out.has(m));
}

/** The signature a legendary (or mythic) piece wears, or null for everything else. */
export function signatureOf(def) {
  if (!def || (def.rarity !== 'legendary' && def.rarity !== 'mythic')) return null;
  return BY_ELEMENT[canonicalElement(def.element)] ?? null;
}
