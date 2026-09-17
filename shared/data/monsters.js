// Bestiary.
//
// sprite.kind:
//   'sheet'    - a single LPC sheet under assets/lpc/mob/<key>.png
//   'compose'  - a humanoid built from the same layer system players use
//   'blob'     - drawn procedurally by the client (no LPC art needed)
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
  mire_slime: M({
    id: 'mire_slime', name: 'Mire Slime', nameTh: 'สไลม์โคลน', level: 2,
    hp: 60, atk: 12, def: 2, mdef: 1, hit: 78, flee: 42, exp: 14, jobExp: 8,
    element: 'verdant', race: 'plant', size: 'small', speed: 48, respawn: 12,
    sprite: { kind: 'blob', color: '#6fae52', scale: 0.8 },
    drops: [
      { id: 'herb_bundle', chance: 0.45, qty: [1, 2] },
      { id: 'rat_pelt', chance: 0.18 },
    ],
    aurum: { chance: 0.20, min: 1, max: 3 },
  }),
  ember_wisp: M({
    id: 'ember_wisp', name: 'Ember Wisp', nameTh: 'ดวงไฟเร่ร่อน', level: 6,
    hp: 120, atk: 26, matk: 30, def: 3, mdef: 14, hit: 90, flee: 66, exp: 38, jobExp: 22,
    element: 'ember', race: 'spirit', size: 'small', speed: 96, attackRange: 130,
    attackDelay: 2.0, aggressive: true, aggroRange: 170, respawn: 20,
    sprite: { kind: 'blob', color: '#ff8a3d', glow: true, scale: 0.7, float: true },
    drops: [
      { id: 'ember_cinder', chance: 0.07 },
      { id: 'herb_bundle', chance: 0.25 },
    ],
    aurum: { chance: 0.15, min: 2, max: 6 },
  }),
  husk: M({
    id: 'husk', name: 'Ashen Husk', nameTh: 'ซากเถ้า', level: 10,
    hp: 260, atk: 44, def: 9, mdef: 6, hit: 98, flee: 58, exp: 72, jobExp: 44,
    element: 'shade', race: 'undead', speed: 58, aggressive: true, aggroRange: 190, respawn: 22,
    sprite: { kind: 'sheet', key: 'ghoul' },
    drops: [
      { id: 'bone_chip', chance: 0.32 },
      { id: 'rat_pelt', chance: 0.30 },
      { id: 'lesser_salve', chance: 0.05 },
    ],
    aurum: { chance: 0.12, min: 3, max: 9 },
  }),
  bandit_scout: M({
    id: 'bandit_scout', name: 'Bandit Scout', nameTh: 'โจรสอดแนม', level: 14,
    hp: 380, atk: 62, def: 14, mdef: 8, hit: 106, flee: 82, exp: 118, jobExp: 70,
    race: 'human', speed: 88, aggressive: true, aggroRange: 210, attackDelay: 1.35, respawn: 25,
    sprite: {
      kind: 'compose', body: 'male/tanned',
      layers: { torso: 'leather', legs: 'pants_red', feet: 'shoes_brown', head: 'cloth_hood', weapon: 'dagger' },
    },
    drops: [
      { id: 'bandit_rope', chance: 0.35 },
      { id: 'iron_ore', chance: 0.20 },
      { id: 'training_blade', chance: 0.03 },
      { id: 'copper_ring', chance: 0.01 },
    ],
    // bandits are the only reliable coin source, and deliberately not much
    aurum: { chance: 0.55, min: 8, max: 22 },
  }),
  gravebound: M({
    id: 'gravebound', name: 'Gravebound', nameTh: 'โครงกระดูกพันธนาการ', level: 20,
    hp: 560, atk: 86, def: 22, mdef: 12, hit: 118, flee: 88, exp: 210, jobExp: 128,
    element: 'shade', race: 'undead', speed: 66, aggressive: true, aggroRange: 200, respawn: 28,
    sprite: { kind: 'sheet', key: 'skeleton' },
    drops: [
      { id: 'bone_chip', chance: 0.45, qty: [1, 3] },
      { id: 'iron_ore', chance: 0.22 },
      { id: 'chain_coif', chance: 0.02 },
      { id: 'shard_dawn', chance: 0.004 },
    ],
    aurum: { chance: 0.18, min: 5, max: 14 },
  }),
  orc_scout: M({
    id: 'orc_scout', name: 'Orc Scout', nameTh: 'ออร์คลูกไล่', level: 27,
    hp: 900, atk: 124, def: 30, mdef: 14, hit: 132, flee: 96, exp: 380, jobExp: 230,
    race: 'demon', size: 'large', speed: 76, aggressive: true, aggroRange: 220,
    attackDelay: 1.7, respawn: 30,
    sprite: { kind: 'sheet', key: 'orc', layers: { weapon: 'spear' } },
    drops: [
      { id: 'orc_tooth', chance: 0.40 },
      { id: 'iron_ore', chance: 0.30, qty: [1, 2] },
      { id: 'iron_pike', chance: 0.02 },
    ],
    aurum: { chance: 0.22, min: 9, max: 25 },
  }),
  dark_raider: M({
    id: 'dark_raider', name: 'Dusk Raider', nameTh: 'นักบุกยามพลบ', level: 34,
    hp: 1250, atk: 158, matk: 90, def: 34, mdef: 30, hit: 148, flee: 128, exp: 610, jobExp: 370,
    element: 'shade', race: 'human', speed: 104, aggressive: true, aggroRange: 240,
    attackDelay: 1.15, respawn: 35,
    sprite: {
      kind: 'compose', body: 'male/darkelf',
      layers: { torso: 'chain', legs: 'pants_teal', feet: 'shoes_black', head: 'chainhat', weapon: 'dagger' },
    },
    drops: [
      { id: 'ghoul_sinew', chance: 0.28 },
      { id: 'steel_ingot', chance: 0.12 },
      { id: 'hunters_fang', chance: 0.012 },
      { id: 'runed_whetstone', chance: 0.03 },
    ],
    aurum: { chance: 0.45, min: 18, max: 48 },
  }),
  frost_husk: M({
    id: 'frost_husk', name: 'Rime Husk', nameTh: 'ซากเยือกแข็ง', level: 42,
    hp: 1900, atk: 196, matk: 150, def: 42, mdef: 48, hit: 168, flee: 132, exp: 980, jobExp: 600,
    element: 'frost', race: 'undead', speed: 62, aggressive: true, aggroRange: 210, respawn: 40,
    sprite: { kind: 'sheet', key: 'ghoul', tint: '#8fd7ff' },
    drops: [
      { id: 'frost_tear', chance: 0.10 },
      { id: 'bone_chip', chance: 0.50, qty: [2, 4] },
      { id: 'steel_ingot', chance: 0.15 },
      { id: 'shard_dawn', chance: 0.01 },
    ],
    aurum: { chance: 0.25, min: 15, max: 40 },
  }),
  crimson_orc: M({
    id: 'crimson_orc', name: 'Crimson Orc', nameTh: 'ออร์คเลือดเดือด', level: 50,
    hp: 3200, atk: 268, def: 58, mdef: 34, hit: 190, flee: 150, exp: 1650, jobExp: 1000,
    element: 'ember', race: 'demon', size: 'large', speed: 84, aggressive: true,
    aggroRange: 260, attackDelay: 1.5, respawn: 45,
    sprite: { kind: 'sheet', key: 'red_orc', layers: { weapon: 'longspear' }, scale: 1.1 },
    drops: [
      { id: 'orc_tooth', chance: 0.55, qty: [1, 3] },
      { id: 'ember_cinder', chance: 0.18 },
      { id: 'runed_whetstone', chance: 0.06 },
      { id: 'warden_halberd', chance: 0.01 },
    ],
    aurum: { chance: 0.35, min: 30, max: 70 },
  }),

  /* ---------------- bosses ---------------- */
  orc_warlord: M({
    id: 'orc_warlord', name: 'Orc Warlord Gruum', nameTh: 'จอมทัพออร์ค กรูม', level: 55,
    boss: true, hp: 42000, atk: 420, def: 80, mdef: 55, hit: 220, flee: 165,
    exp: 26000, jobExp: 16000, element: 'ember', race: 'demon', size: 'large',
    speed: 92, aggressive: true, aggroRange: 380, attackDelay: 1.3, respawn: 3600,
    sprite: { kind: 'sheet', key: 'red_orc', layers: { weapon: 'longspear' }, scale: 1.45 },
    skills: ['whirlwind', 'reckless_charge'],
    drops: [
      { id: 'skeleton_crown', chance: 0.30 },
      { id: 'runed_whetstone', chance: 1.0, qty: [2, 5] },
      { id: 'glacier_lance', chance: 0.04 },
      { id: 'blessing_oil', chance: 0.10 },
      { id: 'emberheart_amulet', chance: 0.02 },
    ],
    aurum: { chance: 1.0, min: 2500, max: 6000 },
  }),
  skeleton_king: M({
    id: 'skeleton_king', name: 'Skeleton King Vhaal', nameTh: 'ราชันโครงกระดูก วาล', level: 65,
    boss: true, hp: 78000, atk: 520, matk: 420, def: 95, mdef: 90, hit: 250, flee: 190,
    exp: 52000, jobExp: 32000, element: 'shade', race: 'undead', size: 'large',
    speed: 86, aggressive: true, aggroRange: 400, attackDelay: 1.25, respawn: 5400,
    sprite: {
      kind: 'sheet', key: 'skeleton', scale: 1.5,
      layers: { head: 'golden_helm', torso: 'plate', weapon: 'longspear' },
    },
    skills: ['grim_harvest', 'meteor_rune'],
    drops: [
      { id: 'skeleton_crown', chance: 0.55 },
      { id: 'ashen_edge', chance: 0.05 },
      { id: 'ashguard_plate', chance: 0.04 },
      { id: 'shard_dawn', chance: 1.0, qty: [3, 8] },
      { id: 'blessing_oil', chance: 0.25 },
    ],
    aurum: { chance: 1.0, min: 5000, max: 12000 },
  }),

  /* ---------------- friendly summon ---------------- */
  companion_wolf: M({
    id: 'companion_wolf', name: 'Bonded Wolf', nameTh: 'หมาป่าคู่ใจ', level: 1,
    hp: 300, atk: 40, def: 12, mdef: 8, hit: 120, flee: 110, exp: 0, jobExp: 0,
    race: 'beast', speed: 132, attackDelay: 1.1, summon: true,
    sprite: { kind: 'blob', color: '#8d8d9a', scale: 0.9 },
  }),
};

export function monster(id) { return MONSTERS[id]; }
