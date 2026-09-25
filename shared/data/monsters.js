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

  // The third step: slow and tough, so a fight with it lasts long enough for
  // its own trick to matter. Up close it rears and headbutts; from a little
  // way off it curls into a ball of leaves, a lane is marked through where you
  // stand, and it rolls down it. Step sideways out of the lane.
  caterpillar: M({
    id: 'caterpillar', name: 'Leaf Caterpillar', nameTh: 'หนอนใบไม้', level: 4,
    hp: 135, atk: 12, def: 6, mdef: 3, hit: 58, flee: 48, exp: 15, jobExp: 9,
    element: 'earth', race: 'beast', size: 'small', speed: 30, attackRange: 38,
    attackDelay: 2.2, aggressive: false, aggroRange: 120, respawn: 14,
    sprite: { kind: 'frames', key: 'caterpillar' },
    // every: ms between charges; min/max: how far off the target must be;
    // tell: the lane shows this long before it rolls; speed: px a second;
    // width: the lane; lead/recover: the burst frame and the unroll (9 fps)
    charge: { every: 11000, min: 0, max: 180, tell: 900, speed: 300, width: 40,
      power: 1.7, lead: 444, recover: 350, element: 'earth', label: 'หลบ!' },
    drops: [
      { id: 'caterpillar_leaf', chance: 0.5, qty: [1, 2] },
      { id: 'soft_shell', chance: 0.25 },
      { id: 'nature_crystal_s', chance: 0.07 },
    ],
    aurum: { chance: 0.45, min: 3, max: 5 },
  }),

  // The first flyer, and the lesson in fast attacks. It hovers over its
  // shadow, darts in to sting and pulls back, and it is hard to hit. Bees
  // guard their patch: come close and they come for you. Its trick is a
  // spinning dash with a short tell - the lane shows for barely half a
  // second, so it teaches reacting, not reading.
  forest_bee: M({
    id: 'forest_bee', name: 'Forest Bee', nameTh: 'ผึ้งป่า', level: 5,
    hp: 105, atk: 15, def: 3, mdef: 4, hit: 66, flee: 72, exp: 18, jobExp: 11,
    element: 'wind', race: 'beast', size: 'small', speed: 50, attackRange: 56,
    attackDelay: 1.5, aggressive: true, aggroRange: 100, respawn: 14,
    // fly: how high it hovers; lunge: how far it darts in when it stings
    sprite: { kind: 'frames', key: 'forest_bee', fly: 14, lunge: 26 },
    charge: { every: 8000, min: 0, max: 200, tell: 600, speed: 520, width: 34,
      power: 1.5, lead: 555, recover: 300, element: 'wind', label: 'หลบ!' },
    drops: [
      { id: 'honey', chance: 0.45, qty: [1, 2] },
      { id: 'bee_stinger', chance: 0.3 },
      { id: 'wind_crystal_s', chance: 0.06 },
    ],
    aurum: { chance: 0.5, min: 3, max: 6 },
  }),

  // Where the field starts to push back. It gores up close and hits hard;
  // its charge is the big one - it paws the ground while the lane shows, then
  // runs it flat out and hard. But a charge that misses leaves it standing
  // there a full second, winded: the opening to hit back.
  wild_boar: M({
    id: 'wild_boar', name: 'Wild Boar', nameTh: 'หมูป่า', level: 6,
    hp: 190, atk: 20, def: 8, mdef: 3, hit: 70, flee: 55, exp: 26, jobExp: 15,
    element: 'earth', race: 'beast', size: 'medium', speed: 44, attackRange: 42,
    attackDelay: 1.8, aggressive: false, aggroRange: 130, respawn: 16,
    sprite: { kind: 'frames', key: 'wild_boar' },
    // recover: how long it stands winded after the charge, the time to punish it
    charge: { every: 10000, min: 0, max: 220, tell: 1000, speed: 420, width: 44,
      power: 2.2, lead: 444, recover: 1000, element: 'earth', label: 'หลบ!' },
    drops: [
      { id: 'boar_meat', chance: 0.5, qty: [1, 2] },
      { id: 'boar_hide', chance: 0.3 },
      { id: 'boar_tusk', chance: 0.12 },
    ],
    aurum: { chance: 0.55, min: 4, max: 8 },
  }),

  // The first caster, and the change of pace: it does not come to you. It
  // floats back to keep its distance and throws Nature Bolts that fly to you
  // (the hit lands when the bolt does), so the fight is closing the gap. Its
  // trick is the first move that comes up under *you*: a ring marks your
  // feet, and vines burst out of it a moment later and hold whoever is
  // still standing there.
  forest_spirit: M({
    id: 'forest_spirit', name: 'Forest Spirit', nameTh: 'ภูตป่า', level: 8,
    hp: 210, atk: 24, def: 5, mdef: 12, hit: 74, flee: 62, exp: 36, jobExp: 21,
    element: 'earth', race: 'plant', size: 'small', speed: 52, attackRange: 150,
    attackDelay: 2.1, aggressive: false, aggroRange: 170, respawn: 16,
    // fly: it floats a hand above the grass
    sprite: { kind: 'frames', key: 'forest_spirit', fly: 6 },
    // kite: closer than this and it backs off between shots
    kite: 96,
    // shot: the bolt leaves the hand `lead` ms into the swing and flies at
    // `speed` px a second; `art` is its strip on the sheet
    shot: { speed: 340, lead: 300, art: 'bolt' },
    // at: 'target' - the ring is marked under the target, not the spirit;
    // root: how long the vines hold whoever they catch
    burst: { every: 10000, reach: 200, radius: 42, tell: 1200, lead: 555, recover: 300,
      power: 1.6, element: 'earth', label: 'หลบ!', at: 'target', root: 1500, art: 'vine' },
    drops: [
      { id: 'spirit_leaf', chance: 0.45, qty: [1, 2] },
      { id: 'forest_essence', chance: 0.2 },
      { id: 'nature_crystal_s', chance: 0.09 },
    ],
    aurum: { chance: 0.6, min: 5, max: 9 },
  }),

  // The field's mini boss, on the clearing in the middle of it. It fights up
  // close with bites and claws, and every move it has is read off the floor:
  // the leap marks where you stand and lands there, the howl marks a ring
  // round the wolf and slows whoever stays in it (and works the wolf up).
  // Below half health it rages once for good - harder, faster hits - so the
  // second half of the fight is the one to bring a friend for.
  alpha_wolf: M({
    id: 'alpha_wolf', name: 'Alpha Wolf', nameTh: 'จ่าฝูงหมาป่า', level: 9,
    hp: 1400, atk: 30, def: 10, mdef: 6, hit: 76, flee: 70, exp: 240, jobExp: 140,
    element: 'ice', race: 'beast', size: 'large', speed: 60, attackRange: 46,
    attackDelay: 1.5, aggressive: true, aggroRange: 170, respawn: 240,
    boss: true, mini: true, phases: [0.5],
    // hop: how high it arcs, and the leap's lead and air below, for the client
    sprite: { kind: 'frames', key: 'alpha_wolf', hop: [34, 375, 420] },
    claw: 'claw',
    // leap: at a target min..max away (close in too: it lands on you); the ring shows for tell+air ms; lead lands the
    // sheet's landing frame (8 fps) on the moment it lands
    leap: { every: 9000, min: 0, max: 260, tell: 800, air: 420, lead: 375, recover: 600, radius: 62,
      power: 2.0, element: 'ice', label: 'หลบ!', art: 'impact' },
    // howl: slow% for slowMs on who stays in the ring; the wolf hits `buff` harder for buffMs
    howl: { every: 15000, tell: 900, lead: 667, recover: 300, radius: 150, slow: 40, slowMs: 3000,
      buff: 0.2, buffMs: 8000, element: 'ice', label: 'ถอยออกจากวง!' },
    // enrage: at `at` of its health, once; atk and speed multiply, attackDelay by haste
    enrage: { at: 0.5, atk: 1.3, speed: 1.25, haste: 0.75, ms: 700, art: 'rage',
      say: 'จ่าฝูงหมาป่าคลั่ง! โจมตีแรงและเร็วขึ้น' },
    drops: [
      { id: 'wolf_fang', chance: 0.8, qty: [1, 3] },
      { id: 'alpha_fur', chance: 0.6, qty: [1, 2] },
      { id: 'beast_core', chance: 0.3 },
      { id: 'alpha_emblem', chance: 0.05 },
      // what every boss pays
      { id: 'revive_potion', chance: 0.1 },
      { id: 'guard_break', chance: 0.08 },
      { id: 'gacha_ticket', chance: 0.15 },
      { id: 'refine_luck_5', chance: 0.05 },
    ],
    aurum: { chance: 1, min: 40, max: 80 },
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
