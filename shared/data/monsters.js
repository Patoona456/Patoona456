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
    hp: 60, atk: 8, def: 2, mdef: 1, hit: 55, flee: 72, exp: 6, jobExp: 4,
    element: 'verdant', race: 'plant', size: 'small', speed: 48, respawn: 12,
    attackDelay: 1.9,
    sprite: { kind: 'blob', color: '#6fae52', scale: 0.8 },
    drops: [
      { id: 'mystery_scroll', chance: 0.015 },
      { id: 'herb_bundle', chance: 0.45, qty: [1, 2] },
      { id: 'rat_pelt', chance: 0.18 },
    ],
    aurum: { chance: 0.20, min: 1, max: 3 },
  }),
  ember_wisp: M({
    id: 'ember_wisp', name: 'Ember Wisp', nameTh: 'ดวงไฟเร่ร่อน', level: 6,
    hp: 70, atk: 20, matk: 24, def: 3, mdef: 14, hit: 65, flee: 84, exp: 26, jobExp: 16,
    element: 'ember', race: 'spirit', size: 'small', speed: 96, attackRange: 130,
    // passive in the starter field: new characters should choose their fights
    attackDelay: 2.0, aggressive: false, aggroRange: 170, respawn: 20,
    sprite: { kind: 'blob', color: '#ff8a3d', glow: true, scale: 0.7, float: true },
    drops: [
      { id: 'mystery_scroll', chance: 0.02 },
      { id: 'ember_cinder', chance: 0.07 },
      { id: 'herb_bundle', chance: 0.25 },
    ],
    aurum: { chance: 0.15, min: 2, max: 6 },
  }),
  husk: M({
    id: 'husk', name: 'Ashen Husk', nameTh: 'ซากเถ้า', level: 10,
    hp: 170, atk: 38, def: 9, mdef: 6, hit: 62, flee: 77, exp: 84, jobExp: 52,
    element: 'shade', race: 'undead', speed: 58, aggressive: true, aggroRange: 190, respawn: 22,
    sprite: { kind: 'sheet', key: 'ghoul' },
    drops: [
      { id: 'mystery_scroll', chance: 0.025 },
      { id: 'bone_chip', chance: 0.32 },
      { id: 'rat_pelt', chance: 0.30 },
      { id: 'lesser_salve', chance: 0.05 },
    ],
    aurum: { chance: 0.12, min: 3, max: 9 },
  }),
  bandit_scout: M({
    id: 'bandit_scout', name: 'Bandit Scout', nameTh: 'โจรสอดแนม', level: 14,
    hp: 160, atk: 43, def: 14, mdef: 8, hit: 70, flee: 86, exp: 144, jobExp: 89,
    race: 'human', speed: 88, aggressive: true, aggroRange: 210, attackDelay: 1.35, respawn: 25,
    sprite: {
      kind: 'compose', body: 'male/tanned',
      layers: { torso: 'leather', legs: 'pants_red', feet: 'shoes_brown', head: 'cloth_hood', weapon: 'dagger' },
    },
    drops: [
      { id: 'mystery_scroll', chance: 0.03 },
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
    hp: 390, atk: 62, def: 22, mdef: 12, hit: 71, flee: 87, exp: 264, jobExp: 164,
    element: 'shade', race: 'undead', speed: 66, aggressive: true, aggroRange: 200, respawn: 28,
    sprite: { kind: 'sheet', key: 'skeleton' },
    drops: [
      { id: 'mystery_scroll', chance: 0.03 },
      { id: 'bone_chip', chance: 0.45, qty: [1, 3] },
      { id: 'iron_ore', chance: 0.22 },
      { id: 'chain_coif', chance: 0.02 },
      { id: 'shard_dawn', chance: 0.004 },
    ],
    aurum: { chance: 0.18, min: 5, max: 14 },
  }),
  orc_scout: M({
    id: 'orc_scout', name: 'Orc Scout', nameTh: 'ออร์คลูกไล่', level: 27,
    hp: 1060, atk: 73, def: 30, mdef: 14, hit: 79, flee: 89, exp: 546, jobExp: 339,
    race: 'demon', size: 'large', speed: 76, aggressive: true, aggroRange: 220,
    attackDelay: 1.7, respawn: 30,
    sprite: { kind: 'sheet', key: 'orc', layers: { weapon: 'spear' } },
    drops: [
      { id: 'mystery_scroll', chance: 0.035 },
      { id: 'orc_tooth', chance: 0.40 },
      { id: 'iron_ore', chance: 0.30, qty: [1, 2] },
      { id: 'iron_pike', chance: 0.02 },
    ],
    aurum: { chance: 0.22, min: 9, max: 25 },
  }),
  dark_raider: M({
    id: 'dark_raider', name: 'Dusk Raider', nameTh: 'นักบุกยามพลบ', level: 34,
    hp: 330, atk: 78, matk: 45, def: 34, mdef: 30, hit: 88, flee: 107, exp: 610, jobExp: 378,
    element: 'shade', race: 'human', speed: 104, aggressive: true, aggroRange: 240,
    attackDelay: 1.15, respawn: 35,
    sprite: {
      kind: 'compose', body: 'male/darkelf',
      layers: { torso: 'chain', legs: 'pants_teal', feet: 'shoes_black', head: 'chainhat', weapon: 'dagger' },
    },
    drops: [
      { id: 'mystery_scroll', chance: 0.04 },
      { id: 'ghoul_sinew', chance: 0.28 },
      { id: 'steel_ingot', chance: 0.12 },
      { id: 'hunters_fang', chance: 0.012 },
      { id: 'runed_whetstone', chance: 0.03 },
    ],
    aurum: { chance: 0.45, min: 18, max: 48 },
  }),
  frost_husk: M({
    id: 'frost_husk', name: 'Rime Husk', nameTh: 'ซากเยือกแข็ง', level: 42,
    hp: 3150, atk: 154, matk: 118, def: 42, mdef: 48, hit: 89, flee: 105, exp: 786, jobExp: 487,
    element: 'frost', race: 'undead', speed: 62, aggressive: true, aggroRange: 210, respawn: 40,
    sprite: { kind: 'sheet', key: 'ghoul', tint: '#8fd7ff' },
    drops: [
      { id: 'mystery_scroll', chance: 0.045 },
      { id: 'frost_tear', chance: 0.10 },
      { id: 'bone_chip', chance: 0.50, qty: [2, 4] },
      { id: 'steel_ingot', chance: 0.15 },
      { id: 'shard_dawn', chance: 0.01 },
    ],
    aurum: { chance: 0.25, min: 15, max: 40 },
  }),
  crimson_orc: M({
    id: 'crimson_orc', name: 'Crimson Orc', nameTh: 'ออร์คเลือดเดือด', level: 50,
    hp: 2460, atk: 122, def: 54, mdef: 34, hit: 98, flee: 111, exp: 1370, jobExp: 849,
    element: 'ember', race: 'demon', size: 'large', speed: 84, aggressive: true,
    aggroRange: 260, attackDelay: 1.5, respawn: 45,
    sprite: { kind: 'sheet', key: 'red_orc', layers: { weapon: 'longspear' }, scale: 1.1 },
    drops: [
      { id: 'mystery_scroll', chance: 0.05 },
      { id: 'orc_tooth', chance: 0.55, qty: [1, 3] },
      { id: 'ember_cinder', chance: 0.18 },
      { id: 'runed_whetstone', chance: 0.06 },
      { id: 'warden_halberd', chance: 0.01 },
    ],
    aurum: { chance: 0.35, min: 30, max: 70 },
  }),

  dusk_bat: M({
    id: 'dusk_bat', name: 'Dusk Flitter', nameTh: 'ค้างคาวสนธยา', level: 4,
    hp: 40, atk: 16, def: 2, mdef: 6, hit: 67, flee: 90, exp: 14, jobExp: 9,
    element: 'shade', race: 'beast', size: 'small', speed: 128, respawn: 14,
    aggressive: true, aggroRange: 140, attackDelay: 1.2,
    sprite: { kind: 'blob', color: '#6b5a8c', scale: 0.62, float: true },
    drops: [
      { id: 'mystery_scroll', chance: 0.015 },
      { id: 'rat_pelt', chance: 0.35 },
      { id: 'herb_bundle', chance: 0.20 },
    ],
    aurum: { chance: 0.18, min: 1, max: 4 },
  }),
  thistle_sprite: M({
    id: 'thistle_sprite', name: 'Thistle Sprite', nameTh: 'ภูตหนาม', level: 9,
    hp: 160, atk: 30, matk: 44, def: 6, mdef: 22, hit: 63, flee: 82, exp: 46, jobExp: 29,
    element: 'verdant', race: 'plant', size: 'small', speed: 72, attackRange: 140,
    attackDelay: 2.2, respawn: 24,
    sprite: { kind: 'blob', color: '#8ad06a', glow: true, scale: 0.78, float: true },
    skills: ['venom_edge'],
    drops: [
      { id: 'mystery_scroll', chance: 0.02 },
      { id: 'herb_bundle', chance: 0.55, qty: [1, 3] },
      { id: 'frost_tear', chance: 0.02 },
      { id: 'antidote', chance: 0.06 },
    ],
    aurum: { chance: 0.16, min: 2, max: 7 },
  }),
  marsh_lurker: M({
    id: 'marsh_lurker', name: 'Marsh Lurker', nameTh: 'ผู้ซุ่มหนองน้ำ', level: 17,
    hp: 360, atk: 59, def: 18, mdef: 10, hit: 69, flee: 84, exp: 196, jobExp: 122,
    element: 'verdant', race: 'human', speed: 64, aggressive: true, aggroRange: 120,
    attackDelay: 1.5, respawn: 26,
    sprite: {
      kind: 'compose', body: 'male/dark',
      layers: { torso: 'shirt_brown', legs: 'pants_teal', feet: 'shoes_brown', weapon: 'spear' },
    },
    drops: [
      { id: 'mystery_scroll', chance: 0.03 },
      { id: 'bandit_rope', chance: 0.30 },
      { id: 'herb_bundle', chance: 0.40, qty: [1, 2] },
      { id: 'worn_spear', chance: 0.03 },
    ],
    aurum: { chance: 0.30, min: 6, max: 16 },
  }),
  bone_archer: M({
    id: 'bone_archer', name: 'Bone Archer', nameTh: 'นักธนูกระดูก', level: 24,
    hp: 520, atk: 95, def: 16, mdef: 14, hit: 75, flee: 91, exp: 346, jobExp: 215,
    element: 'shade', race: 'undead', speed: 70, aggressive: true, aggroRange: 250,
    attackRange: 170, attackDelay: 2.0, respawn: 30,
    sprite: { kind: 'sheet', key: 'skeleton', layers: { weapon: 'bow' } },
    drops: [
      { id: 'mystery_scroll', chance: 0.03 },
      { id: 'bone_chip', chance: 0.40, qty: [1, 2] },
      { id: 'wooden_arrow', chance: 0.50, qty: [20, 60] },
      { id: 'short_bow', chance: 0.02 },
    ],
    aurum: { chance: 0.20, min: 6, max: 18 },
  }),
  crypt_warden: M({
    id: 'crypt_warden', name: 'Crypt Warden', nameTh: 'ผู้เฝ้าสุสาน', level: 31,
    hp: 670, atk: 95, def: 42, mdef: 25, hit: 80, flee: 89, exp: 714, jobExp: 443,
    element: 'shade', race: 'undead', size: 'large', speed: 62, aggressive: true,
    aggroRange: 210, attackRange: 62, attackDelay: 2.1, respawn: 48,
    sprite: {
      kind: 'sheet', key: 'skeleton', scale: 1.18,
      layers: { head: 'metal_helm', torso: 'plate', weapon: 'longspear' },
    },
    skills: ['cleave'],
    drops: [
      { id: 'mystery_scroll', chance: 0.04 },
      { id: 'bone_chip', chance: 0.60, qty: [2, 4] },
      { id: 'steel_ingot', chance: 0.14 },
      { id: 'chain_coif', chance: 0.035 },
      { id: 'runed_whetstone', chance: 0.02 },
      { id: 'shard_dawn', chance: 0.008 },
    ],
    aurum: { chance: 0.35, min: 14, max: 38 },
  }),
  orc_shaman: M({
    id: 'orc_shaman', name: 'Orc Shaman', nameTh: 'หมอผีออร์ค', level: 33,
    hp: 600, atk: 65, matk: 126, def: 24, mdef: 46, hit: 82, flee: 99, exp: 558, jobExp: 346,
    element: 'ember', race: 'demon', speed: 72, aggressive: true, aggroRange: 250,
    attackRange: 160, attackDelay: 2.4, respawn: 36,
    sprite: { kind: 'sheet', key: 'orc', layers: { weapon: 'wand', head: 'cloth_hood' } },
    skills: ['ember_bolt', 'storm_sigil'],
    drops: [
      { id: 'mystery_scroll', chance: 0.04 },
      { id: 'orc_tooth', chance: 0.45 },
      { id: 'ember_cinder', chance: 0.12 },
      { id: 'oak_rod', chance: 0.025 },
      { id: 'mana_draught', chance: 0.10 },
    ],
    aurum: { chance: 0.40, min: 16, max: 44 },
  }),
  frost_wight: M({
    id: 'frost_wight', name: 'Frost Wight', nameTh: 'ภูตเยือกแข็ง', level: 46,
    hp: 3330, atk: 127, matk: 136, def: 46, mdef: 62, hit: 97, flee: 115, exp: 932, jobExp: 578,
    element: 'frost', race: 'undead', speed: 96, aggressive: true, aggroRange: 240,
    attackRange: 150, attackDelay: 1.8, respawn: 44,
    sprite: { kind: 'sheet', key: 'ghoul', tint: '#cfe8ff', scale: 1.05, layers: { weapon: 'wand' } },
    skills: ['frost_nail'],
    drops: [
      { id: 'mystery_scroll', chance: 0.05 },
      { id: 'frost_tear', chance: 0.16 },
      { id: 'ghoul_sinew', chance: 0.30 },
      { id: 'runed_whetstone', chance: 0.05 },
      { id: 'blessing_oil', chance: 0.012 },
    ],
    aurum: { chance: 0.30, min: 20, max: 52 },
  }),

  /* ---------------- filling out the bands ----------------
     Every zone used to hold three or four kinds of monster, so a player saw
     every face a zone had inside three minutes. These are the ones in
     between: each uses a body `drawBlob` can draw or an LPC sheet dressed
     differently, so none of them needed a new art file. */

  bog_crawler: M({
    id: 'bog_crawler', name: 'Bog Crawler', nameTh: 'ตะขาบหนอง', level: 12,
    hp: 180, atk: 45, def: 12, mdef: 6, hit: 71, flee: 92, exp: 82, jobExp: 51,
    element: 'verdant', race: 'beast', size: 'small', speed: 104, aggressive: true,
    aggroRange: 190, attackDelay: 1.1, respawn: 20,
    sprite: { kind: 'blob', shape: 'crawler', color: '#6d7a3a', dark: '#39421c', scale: 0.85 },
    drops: [
      { id: 'mystery_scroll', chance: 0.018 },
      { id: 'herb_bundle', chance: 0.30, qty: [1, 3] },
      { id: 'rat_pelt', chance: 0.22 },
    ],
    aurum: { chance: 0.16, min: 6, max: 18 },
  }),
  fen_spore: M({
    id: 'fen_spore', name: 'Fen Spore', nameTh: 'สปอร์หนองน้ำ', level: 16,
    hp: 280, atk: 44, matk: 78, def: 10, mdef: 26, hit: 65, flee: 83, exp: 130, jobExp: 81,
    element: 'verdant', race: 'plant', size: 'small', speed: 44, respawn: 22,
    attackRange: 120, attackDelay: 2.1,
    sprite: { kind: 'blob', shape: 'floater', color: '#9ad06a', float: true, scale: 0.9 },
    drops: [
      { id: 'mystery_scroll', chance: 0.02 },
      { id: 'herb_bundle', chance: 0.38, qty: [2, 4] },
    ],
    aurum: { chance: 0.14, min: 8, max: 22 },
  }),
  grave_moth: M({
    id: 'grave_moth', name: 'Grave Moth', nameTh: 'ผีเสื้อสุสาน', level: 22,
    hp: 280, atk: 67, def: 16, mdef: 34, hit: 82, flee: 105, exp: 226, jobExp: 140,
    element: 'shade', race: 'beast', size: 'small', speed: 128, aggressive: true,
    aggroRange: 210, attackDelay: 1.2, respawn: 26,
    sprite: { kind: 'blob', shape: 'floater', color: '#7a6a9c', float: true, scale: 0.85 },
    drops: [
      { id: 'mystery_scroll', chance: 0.02 },
      { id: 'bone_chip', chance: 0.28, qty: [1, 2] },
    ],
    aurum: { chance: 0.20, min: 12, max: 30 },
  }),
  tomb_robber: M({
    id: 'tomb_robber', name: 'Tomb Robber', nameTh: 'โจรปล้นสุสาน', level: 26,
    hp: 710, atk: 64, def: 26, mdef: 18, hit: 81, flee: 99, exp: 390, jobExp: 242,
    element: 'neutral', race: 'human', speed: 100, aggressive: true,
    aggroRange: 230, attackDelay: 1.3, respawn: 34,
    sprite: { kind: 'compose', body: 'male/tanned', scale: 1,
      layers: { torso: 'leather', legs: 'pants_red', feet: 'shoes_brown', head: 'cloth_hood', weapon: 'dagger' } },
    drops: [
      { id: 'mystery_scroll', chance: 0.025 },
      { id: 'iron_ore', chance: 0.24, qty: [1, 3] },
      { id: 'bronze_shortblade', chance: 0.03 },
    ],
    aurum: { chance: 0.45, min: 26, max: 70 },
  }),
  cairn_wisp: M({
    id: 'cairn_wisp', name: 'Cairn Wisp', nameTh: 'ดวงไฟกองหิน', level: 30,
    hp: 400, atk: 53, matk: 107, def: 14, mdef: 60, hit: 83, flee: 104, exp: 372, jobExp: 231,
    element: 'shade', race: 'undead', size: 'small', speed: 92, aggressive: true,
    aggroRange: 250, attackRange: 150, attackDelay: 1.9, respawn: 30,
    sprite: { kind: 'blob', shape: 'wisp', color: '#8f6ad0', glow: true, float: true, scale: 0.9 },
    drops: [
      { id: 'mystery_scroll', chance: 0.025 },
      { id: 'bone_chip', chance: 0.30, qty: [1, 3] },
      { id: 'mana_draught', chance: 0.10 },
    ],
    aurum: { chance: 0.24, min: 18, max: 46 },
  }),
  ridge_hound: M({
    id: 'ridge_hound', name: 'Ridge Hound', nameTh: 'หมาป่าสันเขา', level: 36,
    hp: 540, atk: 77, def: 34, mdef: 22, hit: 94, flee: 114, exp: 628, jobExp: 389,
    element: 'neutral', race: 'beast', speed: 138, aggressive: true,
    aggroRange: 280, attackDelay: 1.0, respawn: 34,
    sprite: { kind: 'blob', shape: 'crawler', color: '#8a6a4a', dark: '#4a3424', scale: 1.05 },
    drops: [
      { id: 'mystery_scroll', chance: 0.03 },
      { id: 'wolf_fang', chance: 0.34, qty: [1, 2] },
    ],
    aurum: { chance: 0.30, min: 30, max: 76 },
  }),
  stone_grub: M({
    id: 'stone_grub', name: 'Stone Grub', nameTh: 'หนอนหิน', level: 39,
    hp: 1770, atk: 168, def: 49, mdef: 23, hit: 83, flee: 94, exp: 980, jobExp: 608,
    element: 'neutral', race: 'beast', size: 'large', speed: 42, respawn: 46,
    attackDelay: 2.3,
    sprite: { kind: 'blob', shape: 'spiky', color: '#9a8c74', dark: '#5c5342', scale: 1.25 },
    drops: [
      { id: 'mystery_scroll', chance: 0.03 },
      { id: 'iron_ore', chance: 0.40, qty: [2, 5] },
      { id: 'steel_ingot', chance: 0.12 },
    ],
    aurum: { chance: 0.26, min: 28, max: 72 },
  }),
  rime_shard: M({
    id: 'rime_shard', name: 'Rime Shard', nameTh: 'สะเก็ดเหมันต์', level: 43,
    hp: 3250, atk: 97, matk: 127, def: 34, mdef: 78, hit: 92, flee: 111, exp: 850, jobExp: 527,
    element: 'frost', race: 'formless', speed: 86, aggressive: true,
    aggroRange: 250, attackRange: 140, attackDelay: 1.8, respawn: 40,
    sprite: { kind: 'blob', shape: 'shard', color: '#a8dcff', dark: '#5b93c4', float: true, glow: true, scale: 1.05 },
    drops: [
      { id: 'mystery_scroll', chance: 0.03 },
      { id: 'frost_tear', chance: 0.20 },
      { id: 'runed_whetstone', chance: 0.05 },
    ],
    aurum: { chance: 0.30, min: 40, max: 96 },
  }),
  glacier_maw: M({
    id: 'glacier_maw', name: 'Glacier Maw', nameTh: 'เขี้ยวธารน้ำแข็ง', level: 48,
    hp: 5080, atk: 165, def: 57, mdef: 61, hit: 95, flee: 107, exp: 1306, jobExp: 810,
    element: 'frost', race: 'beast', size: 'large', speed: 74, aggressive: true,
    aggroRange: 240, attackDelay: 2.0, respawn: 56,
    sprite: { kind: 'blob', shape: 'spiky', color: '#7fb8d8', dark: '#35607c', scale: 1.35 },
    drops: [
      { id: 'mystery_scroll', chance: 0.035 },
      { id: 'frost_tear', chance: 0.26, qty: [1, 2] },
      { id: 'steel_ingot', chance: 0.20, qty: [1, 3] },
    ],
    aurum: { chance: 0.36, min: 55, max: 130 },
  }),
  hoar_stalker: M({
    id: 'hoar_stalker', name: 'Hoar Stalker', nameTh: 'นักล่าเกล็ดน้ำแข็ง', level: 52,
    hp: 3690, atk: 127, def: 46, mdef: 52, hit: 107, flee: 128, exp: 1110, jobExp: 688,
    element: 'frost', race: 'human', speed: 132, aggressive: true,
    aggroRange: 300, attackDelay: 1.05, respawn: 52,
    sprite: { kind: 'compose', body: 'female/darkelf', scale: 1.05,
      layers: { torso: 'leather', legs: 'pants_white', feet: 'shoes_black', head: 'leather_cap', weapon: 'dagger' } },
    drops: [
      { id: 'mystery_scroll', chance: 0.04 },
      { id: 'frost_tear', chance: 0.22 },
      { id: 'runed_whetstone', chance: 0.08 },
      { id: 'shard_dawn', chance: 0.006 },
    ],
    aurum: { chance: 0.42, min: 70, max: 165 },
  }),
  vault_sentry: M({
    id: 'vault_sentry', name: 'Vault Sentry', nameTh: 'ยามห้องนิรภัย', level: 56,
    hp: 3620, atk: 204, def: 62, mdef: 88, hit: 101, flee: 113, exp: 1688, jobExp: 1047,
    element: 'neutral', race: 'undead', size: 'large', speed: 68, aggressive: true,
    aggroRange: 250, attackDelay: 2.1, respawn: 70,
    sprite: { kind: 'sheet', key: 'skeleton', tint: '#b8c4d0', scale: 1.3,
      layers: { head: 'metal_helm', torso: 'plate', weapon: 'spear' } },
    drops: [
      { id: 'mystery_scroll', chance: 0.04 },
      { id: 'steel_ingot', chance: 0.32, qty: [2, 4] },
      { id: 'runed_whetstone', chance: 0.12 },
      { id: 'shard_dawn', chance: 0.008 },
    ],
    aurum: { chance: 0.48, min: 90, max: 210 },
  }),
  ember_revenant: M({
    id: 'ember_revenant', name: 'Ember Revenant', nameTh: 'ผีคืนชีพเพลิง', level: 58,
    hp: 3430, atk: 129, matk: 160, def: 54, mdef: 96, hit: 106, flee: 126, exp: 1272, jobExp: 789,
    element: 'ember', race: 'undead', speed: 96, aggressive: true,
    aggroRange: 290, attackRange: 160, attackDelay: 1.7, respawn: 74,
    sprite: { kind: 'blob', shape: 'wisp', color: '#ff7a3d', glow: true, float: true, scale: 1.2 },
    skills: ['ember_bolt'],
    drops: [
      { id: 'mystery_scroll', chance: 0.045 },
      { id: 'ember_cinder', chance: 0.26, qty: [1, 2] },
      { id: 'blessing_oil', chance: 0.02 },
      { id: 'shard_dawn', chance: 0.01 },
    ],
    aurum: { chance: 0.46, min: 95, max: 225 },
  }),

  /* ---------------- Vhaal's court: the solo endgame ----------------
     The throne room is a level 60-70 zone whose guards were level 20-31 -
     a whole band of the game with nothing in it to fight, because every
     monster that belonged there had been put inside the party dungeon.
     These are its own court: soloable, and paced like the rest of the game. */

  throne_knight: M({
    id: 'throne_knight', name: 'Throne Knight', nameTh: 'อัศวินบัลลังก์', level: 61,
    hp: 2630, atk: 186, def: 68, mdef: 56, hit: 107, flee: 126, exp: 1372, jobExp: 851,
    element: 'shade', race: 'undead', speed: 84, aggressive: true,
    aggroRange: 260, attackDelay: 1.6, respawn: 60,
    sprite: { kind: 'sheet', key: 'skeleton', tint: '#c8b9d8', scale: 1.15,
      layers: { head: 'chainhat', torso: 'chain', weapon: 'spear' } },
    drops: [
      { id: 'mystery_scroll', chance: 0.045 },
      { id: 'bone_chip', chance: 0.34, qty: [2, 4] },
      { id: 'runed_whetstone', chance: 0.10 },
      { id: 'shard_dawn', chance: 0.01 },
    ],
    aurum: { chance: 0.48, min: 100, max: 230 },
  }),
  pyre_wisp: M({
    id: 'pyre_wisp', name: 'Pyre Wisp', nameTh: 'ดวงไฟเชิงตะกอน', level: 63,
    hp: 2700, atk: 129, matk: 194, def: 34, mdef: 88, hit: 114, flee: 140, exp: 1058, jobExp: 656,
    element: 'ember', race: 'formless', size: 'small', speed: 126, aggressive: true,
    aggroRange: 300, attackRange: 150, attackDelay: 1.4, respawn: 48,
    sprite: { kind: 'blob', shape: 'wisp', color: '#ffb05a', glow: true, float: true, scale: 1 },
    drops: [
      { id: 'mystery_scroll', chance: 0.045 },
      { id: 'ember_cinder', chance: 0.28, qty: [1, 3] },
      { id: 'mana_draught', chance: 0.18, qty: [1, 2] },
    ],
    aurum: { chance: 0.40, min: 80, max: 190 },
  }),
  crown_thrall: M({
    id: 'crown_thrall', name: 'Crown Thrall', nameTh: 'ข้ารับใช้มงกุฎ', level: 66,
    hp: 9830, atk: 198, def: 62, mdef: 72, hit: 110, flee: 123, exp: 2000, jobExp: 1240,
    element: 'shade', race: 'undead', size: 'large', speed: 76, aggressive: true,
    aggroRange: 270, attackDelay: 1.9, respawn: 76,
    sprite: { kind: 'sheet', key: 'ghoul', tint: '#9a86b8', scale: 1.3,
      layers: { head: 'golden_helm', torso: 'plate' } },
    drops: [
      { id: 'mystery_scroll', chance: 0.05 },
      { id: 'steel_ingot', chance: 0.32, qty: [2, 5] },
      { id: 'blessing_oil', chance: 0.035 },
      { id: 'shard_dawn', chance: 0.02 },
    ],
    aurum: { chance: 0.52, min: 130, max: 300 },
  }),
  bone_choirmaster: M({
    id: 'bone_choirmaster', name: 'Bone Choirmaster', nameTh: 'ผู้นำขับร้องกระดูก', level: 69,
    hp: 7210, atk: 132, matk: 188, def: 58, mdef: 112, hit: 114, flee: 135, exp: 1630, jobExp: 1011,
    element: 'shade', race: 'undead', speed: 92, aggressive: true,
    aggroRange: 310, attackRange: 175, attackDelay: 1.7, respawn: 80,
    sprite: { kind: 'sheet', key: 'skeleton', tint: '#d8c8a8', scale: 1.2,
      layers: { head: 'cloth_hood', weapon: 'wand' } },
    skills: ['grim_harvest'],
    drops: [
      { id: 'mystery_scroll', chance: 0.05 },
      { id: 'bone_chip', chance: 0.36, qty: [3, 6] },
      { id: 'runed_whetstone', chance: 0.16 },
      { id: 'shard_dawn', chance: 0.025 },
      { id: 'blessing_oil', chance: 0.03 },
    ],
    aurum: { chance: 0.55, min: 150, max: 340 },
  }),

  /* ---------------- Sunken Reliquary (party dungeon, 60+) ----------------
     Each of these answers a different solo habit. The sentinel punishes
     standing still, the choirmaster punishes ignoring a caster, the anchor
     punishes fighting one thing at a time, and the shade punishes letting
     anything reach the back line. Alone you can beat any one of them; the
     dungeon never sends one. */
  reliquary_sentinel: M({
    id: 'reliquary_sentinel', name: 'Reliquary Sentinel', nameTh: 'ทหารยามหีบศพ', level: 62,
    hp: 9800, atk: 372, def: 96, mdef: 58, hit: 107, flee: 119, exp: 5400, jobExp: 3300,
    element: 'radiant', race: 'undead', size: 'large', speed: 74, aggressive: true,
    aggroRange: 260, attackDelay: 1.7, respawn: 70,
    sprite: { kind: 'sheet', key: 'skeleton', tint: '#e8dcc0', scale: 1.22, layers: { head: 'metal_helm', torso: 'plate', weapon: 'longspear' } },
    drops: [
      { id: 'reliquary_seal', chance: 0.22 },
      { id: 'runed_whetstone', chance: 0.16, qty: [1, 2] },
      { id: 'mystery_scroll', chance: 0.05 },
    ],
    aurum: { chance: 0.35, min: 60, max: 150 },
  }),
  reliquary_choir: M({
    id: 'reliquary_choir', name: 'Choir of Ash', nameTh: 'คณะขับร้องเถ้า', level: 63,
    hp: 5600, atk: 210, matk: 428, def: 44, mdef: 104, hit: 109, flee: 129, exp: 5000, jobExp: 3100,
    element: 'shade', race: 'undead', speed: 88, aggressive: true, aggroRange: 300,
    attackRange: 190, attackDelay: 2.0, respawn: 70,
    sprite: { kind: 'sheet', key: 'ghoul', tint: '#b79ad8', scale: 1.05, layers: { head: 'cloth_hood', weapon: 'wand' } },
    skills: ['grim_harvest'],
    drops: [
      { id: 'reliquary_seal', chance: 0.20 },
      { id: 'mana_draught', chance: 0.20, qty: [1, 3] },
      { id: 'mystery_scroll', chance: 0.05 },
    ],
    aurum: { chance: 0.35, min: 55, max: 140 },
  }),
  reliquary_anchor: M({
    id: 'reliquary_anchor', name: 'Grave Anchor', nameTh: 'สมอหลุมศพ', level: 64,
    hp: 16000, atk: 300, def: 104, mdef: 96, hit: 104, flee: 116, exp: 15000, jobExp: 9300,
    element: 'neutral', race: 'undead', size: 'large', speed: 52, aggressive: true,
    aggroRange: 220, attackRange: 56, attackDelay: 2.2, respawn: 90,
    sprite: { kind: 'sheet', key: 'skeleton', tint: '#9aa4b0', scale: 1.4, layers: { torso: 'plate', head: 'chainhat' } },
    drops: [
      { id: 'reliquary_seal', chance: 0.30 },
      { id: 'steel_ingot', chance: 0.30, qty: [2, 4] },
      { id: 'blessing_oil', chance: 0.05 },
    ],
    aurum: { chance: 0.45, min: 90, max: 210 },
  }),
  reliquary_shade: M({
    id: 'reliquary_shade', name: 'Cloister Shade', nameTh: 'เงาระเบียง', level: 63,
    hp: 4200, atk: 402, def: 38, mdef: 50, hit: 115, flee: 141, exp: 4600, jobExp: 2900,
    element: 'shade', race: 'undead', size: 'small', speed: 132, aggressive: true,
    aggroRange: 340, attackDelay: 1.0, respawn: 60,
    sprite: { kind: 'blob', color: '#6a4a86', scale: 0.95 },
    drops: [
      { id: 'reliquary_seal', chance: 0.18 },
      { id: 'shard_dawn', chance: 0.02 },
      { id: 'mystery_scroll', chance: 0.05 },
    ],
    aurum: { chance: 0.30, min: 50, max: 130 },
  }),

  /* ---------------- bosses ---------------- */
  orc_warlord: M({
    id: 'orc_warlord', name: 'Orc Warlord Gruum', nameTh: 'จอมทัพออร์ค กรูม', level: 55,
    boss: true, hp: 30000, atk: 355, def: 80, mdef: 55, hit: 111, flee: 122,
    exp: 26000, jobExp: 16000, element: 'ember', race: 'demon', size: 'large',
    speed: 92, aggressive: true, aggroRange: 380, attackDelay: 1.3, respawn: 3600,
    sprite: { kind: 'sheet', key: 'red_orc', layers: { weapon: 'longspear' }, scale: 1.45 },
    skills: ['whirlwind', 'reckless_charge'],
    drops: [
      { id: 'boss_casket', chance: 1.0 },
      { id: 'skeleton_crown', chance: 0.30 },
      { id: 'runed_whetstone', chance: 1.0, qty: [2, 5] },
      { id: 'glacier_lance', chance: 0.04 },
      { id: 'blessing_oil', chance: 0.10 },
      { id: 'emberheart_amulet', chance: 0.02 },
    ],
    aurum: { chance: 1.0, min: 2500, max: 6000 },
  }),
  reliquary_warden: M({
    id: 'reliquary_warden', name: 'Warden of the Reliquary', nameTh: 'ผู้เฝ้าหีบศพ', level: 68,
    boss: true, hp: 145000, atk: 470, matk: 400, def: 110, mdef: 100, hit: 119, flee: 132,
    exp: 78000, jobExp: 50000, element: 'radiant', race: 'undead', size: 'large',
    speed: 80, aggressive: true, aggroRange: 460, attackRange: 56, attackDelay: 1.4,
    respawn: 900, lockout: 'weekly',
    sprite: {
      kind: 'sheet', key: 'skeleton', tint: '#ffe6b0', scale: 1.7,
      layers: { head: 'golden_helm', torso: 'plate_arms', hands: 'golden_gloves', weapon: 'longspear' },
    },
    // the fight is scripted in server/game/boss.js, not left to the random
    // skill roll every other monster uses
    script: 'warden',
    drops: [
      { id: 'reliquary_seal', chance: 1.0, qty: [4, 7] },
      { id: 'boss_casket', chance: 1.0 },
      { id: 'dawn_casket', chance: 0.5 },
      { id: 'warden_halberd', chance: 0.06 },
      { id: 'ashguard_plate', chance: 0.05 },
      { id: 'blessing_oil', chance: 0.4, qty: [1, 2] },
      { id: 'shard_dawn', chance: 1.0, qty: [4, 10] },
    ],
    aurum: { chance: 1.0, min: 4000, max: 9000 },
  }),
  skeleton_king: M({
    id: 'skeleton_king', name: 'Skeleton King Vhaal', nameTh: 'ราชันโครงกระดูก วาล', level: 65,
    boss: true, hp: 52000, atk: 430, matk: 350, def: 95, mdef: 90, hit: 118, flee: 130,
    exp: 52000, jobExp: 32000, element: 'shade', race: 'undead', size: 'large',
    speed: 86, aggressive: true, aggroRange: 400, attackDelay: 1.25, respawn: 5400,
    sprite: {
      kind: 'sheet', key: 'skeleton', scale: 1.5,
      layers: { head: 'golden_helm', torso: 'plate', weapon: 'longspear' },
    },
    skills: ['grim_harvest', 'meteor_rune'],
    drops: [
      { id: 'boss_casket', chance: 1.0 },
      { id: 'dawn_casket', chance: 0.35 },
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
    hp: 300, atk: 40, def: 12, mdef: 8, hit: 66, flee: 83, exp: 0, jobExp: 0,
    race: 'beast', speed: 132, attackDelay: 1.1, summon: true,
    sprite: { kind: 'blob', color: '#8d8d9a', scale: 0.9 },
  }),
};

export function monster(id) { return MONSTERS[id]; }
