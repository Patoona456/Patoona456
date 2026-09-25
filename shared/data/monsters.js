import { SWORDS, BOWS, RARE_SWORDS, EPIC_SWORDS, LEGENDARY_SWORDS, MYTHIC_SWORDS, WEAPON_BOXES } from './items.js';
// Bestiary.
//
// sprite.kind:
//   'sheet'    - a single LPC sheet under assets/lpc/mob/<key>.png
//   'compose'  - a humanoid built from the same layer system players use
//   'blob'     - drawn procedurally by the client (no LPC art needed)
//   'frames'   - a painted animation sheet cut by tools/slice-mob.py into
//                assets/mob/<key>.webp (idle, walk, run, attack, hit, death, spawn)
//
// Money design: most monsters drop NO Aurum at all. Income comes from
// materials that players actually consume (crafting, refining, arrows),
// which keeps items - not coins - as the store of value.

const M = (o) => ({
  size: 'medium', race: 'beast', element: 'neutral', aggressive: false,
  aggroRange: 150, attackRange: 40, attackDelay: 1.6, speed: 70,
  respawn: 18, drops: [], aurum: null, ...o,
});

export const MONSTERS = {
  // The first thing outside town, and the lesson in how to fight: little
  // health, slow on its feet, slow to swing, one plain tackle and nothing else.
  // The sheet calls it water; the game's nearest element is ice.
  blue_slime: M({
    id: 'blue_slime', name: 'Blue Slime', nameTh: 'สไลม์น้ำ', level: 1,
    hp: 42, atk: 6, def: 1, mdef: 1, hit: 50, flee: 58, exp: 5, jobExp: 3,
    element: 'ice', race: 'formless', size: 'small', speed: 38, attackRange: 34,
    attackDelay: 2.3, aggressive: false, aggroRange: 120, respawn: 10,
    sprite: { kind: 'frames', key: 'blue_slime' },
    drops: [
      { id: 'slime_jelly', chance: 0.55, qty: [1, 2] },
      { id: 'water_crystal_s', chance: 0.06 },
    ],
    aurum: { chance: 0.35, min: 1, max: 3 },
  }),

  // One step up from the slime: a touch slower on its feet but it hits harder,
  // spinning into a tackle. Its one trick is the lesson in area attacks: it
  // roots itself, the floor round it is marked, and a moment later a ring of
  // little mushrooms bursts up there. Step out of the circle and it misses.
  mushroom: M({
    id: 'mushroom', name: 'Mushroom', nameTh: 'เห็ดแดง', level: 3,
    hp: 78, atk: 11, def: 3, mdef: 2, hit: 56, flee: 52, exp: 10, jobExp: 6,
    element: 'earth', race: 'plant', size: 'small', speed: 34, attackRange: 36,
    attackDelay: 2.0, aggressive: false, aggroRange: 120, respawn: 12,
    sprite: { kind: 'frames', key: 'mushroom' },
    // every: ms between bursts; reach: how close the target must be; tell: the
    // warning before it lands; lead/recover: the sheet's spin before and the
    // settle after the eruption frame (at 9 fps)
    burst: { every: 9000, reach: 64, radius: 66, tell: 1100, lead: 444, recover: 350,
      power: 1.8, element: 'earth', label: 'หลบ!' },
    drops: [
      { id: 'mushroom_cap', chance: 0.5, qty: [1, 2] },
      { id: 'herb', chance: 0.22 },
      { id: 'nature_crystal_s', chance: 0.06 },
    ],
    aurum: { chance: 0.4, min: 2, max: 4 },
  }),

  companion_wolf: M({
    id: 'companion_wolf', name: 'Bonded Wolf', nameTh: 'หมาป่าคู่ใจ', level: 1,
    hp: 300, atk: 40, def: 12, mdef: 8, hit: 66, flee: 83, exp: 0, jobExp: 0,
    race: 'beast', speed: 132, attackDelay: 1.1, summon: true,
    sprite: { kind: 'blob', color: '#8d8d9a', scale: 0.9 },
  }),
};

/**
 * What monsters drop until the gear sheets come back: potions, by level
 * band. Every non-summon carries the same shape of table -
 *
 *   * the HP and MP bottle of its band, often enough to live off in a
 *     long session but not so often that the shop stops mattering;
 *   * the resist potion of its own element, so hunting fire things is how
 *     you stock up against fire;
 *   * a rare shot at the growth bottles (EXP, drops, full restore) past
 *     level 20;
 * and bosses pay the bottles nobody sells: revives, resets, rare-drop luck.
 * The scroll sheet rides the same tables: fly scrolls and +1% refine
 * scrolls from anything, the element's own tome from monsters of that
 * element, and the wards, tickets and maps from bosses.
 */
const BAND = (lv) => (lv < 20 ? 's' : lv < 40 ? 'm' : lv < 58 ? 'l' : 'xl');
const SWORD_LADDER = Object.values(SWORDS).sort((a, b) => a.level - b.level);
const BOW_LADDER = Object.values(BOWS).sort((a, b) => a.level - b.level);
const RARE_LADDER = Object.values(RARE_SWORDS).sort((a, b) => a.level - b.level);
const EPIC_LADDER = Object.values(EPIC_SWORDS).sort((a, b) => a.level - b.level);
const LEGEND_LADDER = Object.values(LEGENDARY_SWORDS).sort((a, b) => a.level - b.level);
const MYTHIC_LADDER = Object.values(MYTHIC_SWORDS).sort((a, b) => a.level - b.level);
const bandOf = (ladder, lv) => ladder.filter((w) => w.level <= lv).pop();
/** The epic swords a monster of this level may carry: the band's own and the ones just around it. */
const near = (ladder, lv) => ladder.filter((w) => w.level <= lv + 3 && w.level > lv - 6);
const epicsNear = (lv) => near(EPIC_LADDER, lv);
const legendsNear = (lv) => near(LEGEND_LADDER, lv);
const mythicsNear = (lv) => near(MYTHIC_LADDER, lv);
/** The weapon box whose band a monster of this level falls in. */
const boxOf = (lv) => Object.values(WEAPON_BOXES).find((b) => lv >= b.band[0] && lv <= b.band[1])?.id ?? 'box_weapon_3';
const ITEM_BOOK = { fire: 'book_fire', ice: 'book_ice', wind: 'book_wind', lightning: 'book_lightning',
  earth: 'book_earth', dark: 'book_dark', holy: 'book_holy' };
const RESIST_OF = { fire: 'fire_resist', ice: 'ice_resist', lightning: 'lightning_resist', wind: 'wind_resist',
  earth: 'earth_resist', dark: 'dark_resist', holy: 'holy_resist' };
export function potionDrops(m) {
  if (m.summon) return [];
  if (m.boss) {
    return [
      { id: 'hp_potion_' + BAND(m.level), chance: 1, qty: [3, 6] },
      { id: 'full_restore', chance: 0.6, qty: [1, 2] },
      { id: 'revive_potion', chance: 0.5 },
      { id: 'exp_potion', chance: 0.5 },
      { id: 'all_resist', chance: 0.4 },
      { id: 'cooldown_reset', chance: 0.3 },
      { id: 'rare_drop_up', chance: 0.25 },
      { id: 'skill_reset', chance: 0.08 },
      { id: 'stat_reset', chance: 0.08 },
      { id: 'refine_luck_3', chance: 0.8, qty: [1, 2] },
      { id: 'refine_luck_5', chance: 0.3 },
      { id: 'guard_down', chance: 0.4 },
      { id: 'guard_break', chance: 0.15 },
      { id: 'gacha_ticket', chance: 0.6, qty: [1, 3] },
      { id: 'treasure_map', chance: 0.4 },
      { id: 'book_royal', chance: 0.05 },
      { id: 'boss_ticket', chance: 0.03 },
      { id: bandOf(RARE_LADDER, m.level)?.id, chance: 0.35 },
      ...epicsNear(m.level).map((e, _, all) => ({ id: e.id, chance: 0.1 / all.length })),
      ...legendsNear(m.level).map((e, _, all) => ({ id: e.id, chance: 0.03 / all.length })),
      ...mythicsNear(m.level).map((e, _, all) => ({ id: e.id, chance: 0.008 / all.length })),
      { id: boxOf(m.level), chance: 0.5 },
    ].filter((d) => d.id);
  }
  const out = [
    { id: 'hp_potion_' + BAND(m.level), chance: 0.05 },
    { id: 'mp_potion_' + BAND(m.level), chance: 0.03 },
  ];
  if (RESIST_OF[m.element]) out.push({ id: RESIST_OF[m.element], chance: 0.012 });
  if (m.level < 15) out.push({ id: 'heal_potion', chance: 0.02 });
  // scrolls: the everyday ones often, the refine luck and the tickets rarely
  out.push({ id: 'scroll_fly', chance: 0.02 }, { id: 'refine_luck_1', chance: 0.006 },
    { id: 'scroll_mystery', chance: 0.004 }, { id: 'gacha_ticket', chance: 0.0015 });
  if (m.level >= 20) out.push({ id: 'treasure_map', chance: 0.002 }, { id: 'refine_luck_3', chance: 0.0015 });
  if (m.level >= 40) out.push({ id: 'guard_down', chance: 0.0008 }, { id: 'scroll_resurrect', chance: 0.001 });
  if (m.element && m.element !== 'neutral' && ITEM_BOOK[m.element]) out.push({ id: ITEM_BOOK[m.element], chance: 0.003 });
  // the starter sword of its band: the best one a character this level can hold
  const sword = bandOf(SWORD_LADDER, m.level);
  if (sword) out.push({ id: sword.id, chance: 0.004 });
  const bow = bandOf(BOW_LADDER, m.level);            // and the archer's
  if (bow) out.push({ id: bow.id, chance: 0.004 });
  const rare = bandOf(RARE_LADDER, m.level);         // a rare sword is a real find
  if (rare) out.push({ id: rare.id, chance: 0.0012 });
  // an epic one, a story to tell: any of those a few levels either side of
  // it, since the epic ladder is finer than the monster list
  for (const e of epicsNear(m.level)) out.push({ id: e.id, chance: 0.0003 / epicsNear(m.level).length });
  // a sealed weapon box of its band: every grade inside, the best ones rarely
  out.push({ id: boxOf(m.level), chance: 0.003 });
  // and a legendary one: most players will only ever see it from a boss or a box
  for (const e of legendsNear(m.level)) out.push({ id: e.id, chance: 0.00006 / legendsNear(m.level).length });
  // a mythic one from the field is a story the server will hear about
  for (const e of mythicsNear(m.level)) out.push({ id: e.id, chance: 0.00001 / mythicsNear(m.level).length });
  if (m.level >= 20) {
    out.push({ id: 'exp_potion', chance: 0.002 }, { id: 'drop_rate_up', chance: 0.0015 },
      { id: 'item_find', chance: 0.003 }, { id: 'curse_potion', chance: 0.004 });
  }
  if (m.level >= 30) out.push({ id: 'full_restore', chance: 0.0015 }, { id: 'revive_potion', chance: 0.001 });
  return out;
}
for (const m of Object.values(MONSTERS)) if (!m.drops?.length) m.drops = potionDrops(m);

export function monster(id) { return MONSTERS[id]; }
