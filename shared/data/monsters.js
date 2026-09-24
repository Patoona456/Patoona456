import { SWORDS, RARE_SWORDS, EPIC_SWORDS, LEGENDARY_SWORDS, MYTHIC_SWORDS, WEAPON_BOXES } from './items.js';
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
    element: 'earth', race: 'plant', size: 'small', speed: 48, respawn: 12,
    attackDelay: 1.9,
    sprite: { kind: 'blob', color: '#6fae52', scale: 0.8 },
    drops: [],
    aurum: { chance: 0.20, min: 1, max: 3 },
  }),
  ember_wisp: M({
    id: 'ember_wisp', name: 'Ember Wisp', nameTh: 'ดวงไฟเร่ร่อน', level: 6,
    hp: 80, atk: 20, matk: 24, def: 3, mdef: 14, hit: 65, flee: 84, exp: 24, jobExp: 15,
    element: 'fire', race: 'spirit', size: 'small', speed: 96, attackRange: 130,
    // passive in the starter field: new characters should choose their fights
    attackDelay: 2.0, aggressive: false, aggroRange: 170, respawn: 20,
    sprite: { kind: 'blob', color: '#ff8a3d', glow: true, scale: 0.7, float: true },
    drops: [],
    aurum: { chance: 0.15, min: 2, max: 6 },
  }),
  bristle_boar: M({
    id: 'bristle_boar', name: 'Bristle Boar', nameTh: 'หมูป่าขนแข็ง', level: 7,
    hp: 130, atk: 30, def: 7, mdef: 4, hit: 61, flee: 75, exp: 46, jobExp: 29,
    // Passive, like everything else with teeth in the starter field: a fresh
    // character has sixty-three health and this takes eleven seconds to kill
    // while dealing enough to end them in five. New players pick their fights.
    element: 'earth', race: 'beast', speed: 66, aggressive: false,
    aggroRange: 150, attackDelay: 1.8, respawn: 20,
    sprite: { kind: 'blob', shape: 'spiky', color: '#8a6a4a', scale: 0.95 },
    drops: [],
    aurum: { chance: 0.30, min: 5, max: 14 },
  }),
  husk: M({
    id: 'husk', name: 'Ashen Husk', nameTh: 'ซากเถ้า', level: 10,
    hp: 150, atk: 38, def: 9, mdef: 6, hit: 62, flee: 77, exp: 80, jobExp: 50,
    element: 'dark', race: 'undead', speed: 58, aggressive: true, aggroRange: 190, respawn: 22,
    sprite: { kind: 'sheet', key: 'ghoul' },
    drops: [],
    aurum: { chance: 0.30, min: 8, max: 22 },
  }),
  bandit_scout: M({
    id: 'bandit_scout', name: 'Bandit Scout', nameTh: 'โจรสอดแนม', level: 14,
    hp: 260, atk: 43, def: 14, mdef: 8, hit: 70, flee: 86, exp: 144, jobExp: 89,
    race: 'human', speed: 88, aggressive: true, aggroRange: 210, attackDelay: 1.35, respawn: 25,
    sprite: {
      kind: 'compose', body: 'male/tanned',
      layers: { torso: 'leather', legs: 'pants_red', feet: 'shoes_brown', head: 'cloth_hood', weapon: 'dagger' },
    },
    drops: [],
    // bandits are the only reliable coin source, and deliberately not much
    aurum: { chance: 0.55, min: 8, max: 22 },
  }),
  gravebound: M({
    id: 'gravebound', name: 'Gravebound', nameTh: 'โครงกระดูกพันธนาการ', level: 20,
    hp: 440, atk: 62, def: 22, mdef: 12, hit: 71, flee: 87, exp: 258, jobExp: 160,
    element: 'dark', race: 'undead', speed: 66, aggressive: true, aggroRange: 200, respawn: 28,
    sprite: { kind: 'sheet', key: 'skeleton' },
    drops: [],
    aurum: { chance: 0.18, min: 5, max: 14 },
  }),
  orc_scout: M({
    id: 'orc_scout', name: 'Orc Scout', nameTh: 'ออร์คลูกไล่', level: 27,
    hp: 1170, atk: 73, def: 30, mdef: 14, hit: 79, flee: 89, exp: 558, jobExp: 346,
    race: 'demon', size: 'large', speed: 76, aggressive: true, aggroRange: 220,
    attackDelay: 1.7, respawn: 30,
    sprite: { kind: 'sheet', key: 'orc', layers: { weapon: 'spear' } },
    drops: [],
    aurum: { chance: 0.22, min: 9, max: 25 },
  }),
  dark_raider: M({
    id: 'dark_raider', name: 'Dusk Raider', nameTh: 'นักบุกยามพลบ', level: 34,
    hp: 770, atk: 78, matk: 45, def: 34, mdef: 30, hit: 88, flee: 107, exp: 592, jobExp: 367,
    element: 'dark', race: 'human', speed: 104, aggressive: true, aggroRange: 240,
    attackDelay: 1.15, respawn: 35,
    sprite: {
      kind: 'compose', body: 'male/darkelf',
      layers: { torso: 'chain', legs: 'pants_teal', feet: 'shoes_black', head: 'chainhat', weapon: 'dagger' },
    },
    drops: [],
    aurum: { chance: 0.45, min: 18, max: 48 },
  }),
  frost_husk: M({
    id: 'frost_husk', name: 'Rime Husk', nameTh: 'ซากเยือกแข็ง', level: 42,
    hp: 3500, atk: 154, matk: 118, def: 42, mdef: 48, hit: 89, flee: 105, exp: 808, jobExp: 501,
    element: 'ice', race: 'undead', speed: 62, aggressive: true, aggroRange: 210, respawn: 40,
    sprite: { kind: 'sheet', key: 'ghoul', tint: '#8fd7ff' },
    drops: [],
    aurum: { chance: 0.25, min: 15, max: 40 },
  }),
  crimson_orc: M({
    id: 'crimson_orc', name: 'Crimson Orc', nameTh: 'ออร์คเลือดเดือด', level: 50,
    hp: 3350, atk: 122, def: 54, mdef: 34, hit: 98, flee: 111, exp: 1400, jobExp: 868,
    element: 'fire', race: 'demon', size: 'large', speed: 84, aggressive: true,
    aggroRange: 260, attackDelay: 1.5, respawn: 45,
    sprite: { kind: 'sheet', key: 'red_orc', layers: { weapon: 'longspear' }, scale: 1.1 },
    drops: [],
    aurum: { chance: 0.35, min: 30, max: 70 },
  }),

  dusk_bat: M({
    id: 'dusk_bat', name: 'Dusk Flitter', nameTh: 'ค้างคาวสนธยา', level: 4,
    hp: 50, atk: 9, def: 2, mdef: 6, hit: 67, flee: 90, exp: 14, jobExp: 9,
    element: 'wind', race: 'beast', size: 'small', speed: 128, respawn: 14,
    // The first thing in the game that picks a fight with you, and the only
    // aggressive spawn in the starter field. It has to be losable to, not a
    // coin flip: a brand-new character has sixty-three health.
    aggressive: true, aggroRange: 140, attackDelay: 1.9,
    sprite: { kind: 'blob', color: '#6b5a8c', scale: 0.62, float: true },
    drops: [],
    aurum: { chance: 0.30, min: 3, max: 9 },
  }),
  thistle_sprite: M({
    id: 'thistle_sprite', name: 'Thistle Sprite', nameTh: 'ภูตหนาม', level: 9,
    // 115 HP was tuned against a novice who, through an accident of the old
    // four-class weapon table, was holding a caster's rod: `rod` reached
    // level 9 and `blade` stopped at 8, so the gear picker handed a starting
    // fighter the wand. With `dagger` and `wand` as separate classes the
    // novice swings a knife like it always should have, and this had to grow
    // to stay a fight rather than a formality.
    hp: 132, atk: 30, matk: 44, def: 6, mdef: 22, hit: 63, flee: 82, exp: 54, jobExp: 33,
    element: 'earth', race: 'plant', size: 'small', speed: 72, attackRange: 140,
    attackDelay: 2.2, respawn: 24,
    sprite: { kind: 'blob', color: '#8ad06a', glow: true, scale: 0.78, float: true },
    skills: ['venom_edge'],
    drops: [],
    aurum: { chance: 0.16, min: 2, max: 7 },
  }),
  marsh_lurker: M({
    id: 'marsh_lurker', name: 'Marsh Lurker', nameTh: 'ผู้ซุ่มหนองน้ำ', level: 17,
    hp: 320, atk: 59, def: 18, mdef: 10, hit: 69, flee: 84, exp: 196, jobExp: 122,
    element: 'earth', race: 'human', speed: 64, aggressive: true, aggroRange: 120,
    attackDelay: 1.5, respawn: 26,
    sprite: {
      kind: 'compose', body: 'male/dark',
      layers: { torso: 'shirt_brown', legs: 'pants_teal', feet: 'shoes_brown', weapon: 'spear' },
    },
    drops: [],
    aurum: { chance: 0.30, min: 6, max: 16 },
  }),
  bone_archer: M({
    id: 'bone_archer', name: 'Bone Archer', nameTh: 'นักธนูกระดูก', level: 24,
    hp: 610, atk: 95, def: 16, mdef: 14, hit: 75, flee: 91, exp: 344, jobExp: 213,
    element: 'dark', race: 'undead', speed: 70, aggressive: true, aggroRange: 250,
    attackRange: 170, attackDelay: 2.0, respawn: 30,
    sprite: { kind: 'sheet', key: 'skeleton', layers: { weapon: 'bow' } },
    drops: [],
    aurum: { chance: 0.20, min: 6, max: 18 },
  }),
  crypt_warden: M({
    id: 'crypt_warden', name: 'Crypt Warden', nameTh: 'ผู้เฝ้าสุสาน', level: 31,
    hp: 1020, atk: 95, def: 42, mdef: 25, hit: 80, flee: 89, exp: 690, jobExp: 428,
    element: 'dark', race: 'undead', size: 'large', speed: 62, aggressive: true,
    aggroRange: 210, attackRange: 62, attackDelay: 2.1, respawn: 48,
    sprite: {
      kind: 'sheet', key: 'skeleton', scale: 1.18,
      layers: { head: 'metal_helm', torso: 'plate', weapon: 'longspear' },
    },
    skills: ['cleave'],
    drops: [],
    aurum: { chance: 0.35, min: 14, max: 38 },
  }),
  orc_shaman: M({
    id: 'orc_shaman', name: 'Orc Shaman', nameTh: 'หมอผีออร์ค', level: 33,
    hp: 1090, atk: 65, matk: 126, def: 24, mdef: 46, hit: 82, flee: 99, exp: 560, jobExp: 347,
    element: 'fire', race: 'demon', speed: 72, aggressive: true, aggroRange: 250,
    attackRange: 160, attackDelay: 2.4, respawn: 36,
    sprite: { kind: 'sheet', key: 'orc', layers: { weapon: 'wand', head: 'cloth_hood' } },
    skills: ['ember_bolt', 'storm_sigil'],
    drops: [],
    aurum: { chance: 0.40, min: 16, max: 44 },
  }),
  frost_wight: M({
    id: 'frost_wight', name: 'Frost Wight', nameTh: 'ภูตเยือกแข็ง', level: 46,
    hp: 3760, atk: 127, matk: 136, def: 46, mdef: 62, hit: 97, flee: 115, exp: 922, jobExp: 572,
    element: 'ice', race: 'undead', speed: 96, aggressive: true, aggroRange: 240,
    attackRange: 150, attackDelay: 1.8, respawn: 44,
    sprite: { kind: 'sheet', key: 'ghoul', tint: '#cfe8ff', scale: 1.05, layers: { weapon: 'wand' } },
    skills: ['frost_nail'],
    drops: [],
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
    element: 'earth', race: 'beast', size: 'small', speed: 104, aggressive: true,
    aggroRange: 190, attackDelay: 1.1, respawn: 20,
    sprite: { kind: 'blob', shape: 'crawler', color: '#6d7a3a', dark: '#39421c', scale: 0.85 },
    drops: [],
    aurum: { chance: 0.30, min: 14, max: 34 },
  }),
  fen_spore: M({
    id: 'fen_spore', name: 'Fen Spore', nameTh: 'สปอร์หนองน้ำ', level: 16,
    hp: 250, atk: 44, matk: 78, def: 10, mdef: 26, hit: 65, flee: 83, exp: 126, jobExp: 78,
    element: 'earth', race: 'plant', size: 'small', speed: 44, respawn: 22,
    attackRange: 120, attackDelay: 2.1,
    sprite: { kind: 'blob', shape: 'floater', color: '#9ad06a', float: true, scale: 0.9 },
    drops: [],
    aurum: { chance: 0.30, min: 20, max: 44 },
  }),
  grave_moth: M({
    id: 'grave_moth', name: 'Grave Moth', nameTh: 'ผีเสื้อสุสาน', level: 22,
    hp: 320, atk: 67, def: 16, mdef: 34, hit: 82, flee: 105, exp: 216, jobExp: 134,
    element: 'wind', race: 'beast', size: 'small', speed: 128, aggressive: true,
    aggroRange: 210, attackDelay: 1.2, respawn: 26,
    sprite: { kind: 'blob', shape: 'floater', color: '#7a6a9c', float: true, scale: 0.85 },
    drops: [],
    aurum: { chance: 0.32, min: 26, max: 58 },
  }),
  tomb_robber: M({
    id: 'tomb_robber', name: 'Tomb Robber', nameTh: 'โจรปล้นสุสาน', level: 26,
    hp: 870, atk: 64, def: 26, mdef: 18, hit: 81, flee: 99, exp: 392, jobExp: 243,
    element: 'neutral', race: 'human', speed: 100, aggressive: true,
    aggroRange: 230, attackDelay: 1.3, respawn: 34,
    sprite: { kind: 'compose', body: 'male/tanned', scale: 1,
      layers: { torso: 'leather', legs: 'pants_red', feet: 'shoes_brown', head: 'cloth_hood', weapon: 'dagger' } },
    drops: [],
    aurum: { chance: 0.45, min: 26, max: 70 },
  }),
  cairn_wisp: M({
    id: 'cairn_wisp', name: 'Cairn Wisp', nameTh: 'ดวงไฟกองหิน', level: 30,
    hp: 570, atk: 53, matk: 107, def: 14, mdef: 60, hit: 83, flee: 104, exp: 350, jobExp: 217,
    element: 'dark', race: 'undead', size: 'small', speed: 92, aggressive: true,
    aggroRange: 250, attackRange: 150, attackDelay: 1.9, respawn: 30,
    sprite: { kind: 'blob', shape: 'wisp', color: '#8f6ad0', glow: true, float: true, scale: 0.9 },
    drops: [],
    aurum: { chance: 0.24, min: 18, max: 46 },
  }),
  ridge_hound: M({
    id: 'ridge_hound', name: 'Ridge Hound', nameTh: 'หมาป่าสันเขา', level: 36,
    hp: 1110, atk: 77, def: 34, mdef: 22, hit: 94, flee: 114, exp: 644, jobExp: 399,
    element: 'lightning', race: 'beast', speed: 138, aggressive: true,
    aggroRange: 280, attackDelay: 1.0, respawn: 34,
    sprite: { kind: 'blob', shape: 'crawler', color: '#8a6a4a', dark: '#4a3424', scale: 1.05 },
    drops: [],
    aurum: { chance: 0.30, min: 30, max: 76 },
  }),
  stone_grub: M({
    id: 'stone_grub', name: 'Stone Grub', nameTh: 'หนอนหิน', level: 39,
    hp: 1830, atk: 168, def: 49, mdef: 23, hit: 83, flee: 94, exp: 976, jobExp: 605,
    element: 'neutral', race: 'beast', size: 'large', speed: 42, respawn: 46,
    attackDelay: 2.3,
    sprite: { kind: 'blob', shape: 'spiky', color: '#9a8c74', dark: '#5c5342', scale: 1.25 },
    drops: [],
    aurum: { chance: 0.26, min: 28, max: 72 },
  }),
  rime_shard: M({
    id: 'rime_shard', name: 'Rime Shard', nameTh: 'สะเก็ดเหมันต์', level: 43,
    hp: 3540, atk: 97, matk: 127, def: 34, mdef: 78, hit: 92, flee: 111, exp: 836, jobExp: 518,
    element: 'ice', race: 'formless', speed: 86, aggressive: true,
    aggroRange: 250, attackRange: 140, attackDelay: 1.8, respawn: 40,
    sprite: { kind: 'blob', shape: 'shard', color: '#a8dcff', dark: '#5b93c4', float: true, glow: true, scale: 1.05 },
    drops: [],
    aurum: { chance: 0.30, min: 40, max: 96 },
  }),
  glacier_maw: M({
    id: 'glacier_maw', name: 'Glacier Maw', nameTh: 'เขี้ยวธารน้ำแข็ง', level: 48,
    hp: 5270, atk: 165, def: 57, mdef: 61, hit: 95, flee: 107, exp: 1320, jobExp: 818,
    element: 'ice', race: 'beast', size: 'large', speed: 74, aggressive: true,
    aggroRange: 240, attackDelay: 2.0, respawn: 56,
    sprite: { kind: 'blob', shape: 'spiky', color: '#7fb8d8', dark: '#35607c', scale: 1.35 },
    drops: [],
    aurum: { chance: 0.36, min: 55, max: 130 },
  }),
  hoar_stalker: M({
    id: 'hoar_stalker', name: 'Hoar Stalker', nameTh: 'นักล่าเกล็ดน้ำแข็ง', level: 52,
    hp: 4050, atk: 127, def: 46, mdef: 52, hit: 107, flee: 128, exp: 1096, jobExp: 680,
    element: 'ice', race: 'human', speed: 132, aggressive: true,
    aggroRange: 300, attackDelay: 1.05, respawn: 52,
    sprite: { kind: 'compose', body: 'female/darkelf', scale: 1.05,
      layers: { torso: 'leather', legs: 'pants_white', feet: 'shoes_black', head: 'leather_cap', weapon: 'dagger' } },
    drops: [],
    aurum: { chance: 0.42, min: 70, max: 165 },
  }),
  vault_sentry: M({
    id: 'vault_sentry', name: 'Vault Sentry', nameTh: 'ยามห้องนิรภัย', level: 56,
    hp: 4890, atk: 204, def: 62, mdef: 88, hit: 101, flee: 113, exp: 1646, jobExp: 1021,
    element: 'neutral', race: 'undead', size: 'large', speed: 68, aggressive: true,
    aggroRange: 250, attackDelay: 2.1, respawn: 70,
    sprite: { kind: 'sheet', key: 'skeleton', tint: '#b8c4d0', scale: 1.3,
      layers: { head: 'metal_helm', torso: 'plate', weapon: 'spear' } },
    drops: [],
    aurum: { chance: 0.48, min: 90, max: 210 },
  }),
  ember_revenant: M({
    id: 'ember_revenant', name: 'Ember Revenant', nameTh: 'ผีคืนชีพเพลิง', level: 58,
    hp: 3690, atk: 129, matk: 160, def: 54, mdef: 96, hit: 106, flee: 126, exp: 1280, jobExp: 794,
    element: 'fire', race: 'undead', speed: 96, aggressive: true,
    aggroRange: 290, attackRange: 160, attackDelay: 1.7, respawn: 74,
    sprite: { kind: 'blob', shape: 'wisp', color: '#ff7a3d', glow: true, float: true, scale: 1.2 },
    skills: ['ember_bolt'],
    drops: [],
    aurum: { chance: 0.46, min: 95, max: 225 },
  }),

  /* ---------------- Vhaal's court: the solo endgame ----------------
     The throne room is a level 60-70 zone whose guards were level 20-31 -
     a whole band of the game with nothing in it to fight, because every
     monster that belonged there had been put inside the party dungeon.
     These are its own court: soloable, and paced like the rest of the game. */

  throne_knight: M({
    id: 'throne_knight', name: 'Throne Knight', nameTh: 'อัศวินบัลลังก์', level: 61,
    hp: 4550, atk: 186, def: 68, mdef: 56, hit: 107, flee: 126, exp: 1374, jobExp: 852,
    element: 'dark', race: 'undead', speed: 84, aggressive: true,
    aggroRange: 260, attackDelay: 1.6, respawn: 60,
    sprite: { kind: 'sheet', key: 'skeleton', tint: '#c8b9d8', scale: 1.15,
      layers: { head: 'chainhat', torso: 'chain', weapon: 'spear' } },
    drops: [],
    aurum: { chance: 0.48, min: 100, max: 230 },
  }),
  pyre_wisp: M({
    id: 'pyre_wisp', name: 'Pyre Wisp', nameTh: 'ดวงไฟเชิงตะกอน', level: 63,
    hp: 3670, atk: 129, matk: 194, def: 34, mdef: 88, hit: 114, flee: 140, exp: 1036, jobExp: 642,
    element: 'fire', race: 'formless', size: 'small', speed: 126, aggressive: true,
    aggroRange: 300, attackRange: 150, attackDelay: 1.4, respawn: 48,
    sprite: { kind: 'blob', shape: 'wisp', color: '#ffb05a', glow: true, float: true, scale: 1 },
    drops: [],
    aurum: { chance: 0.40, min: 80, max: 190 },
  }),
  crown_thrall: M({
    id: 'crown_thrall', name: 'Crown Thrall', nameTh: 'ข้ารับใช้มงกุฎ', level: 66,
    hp: 9010, atk: 198, def: 62, mdef: 72, hit: 110, flee: 123, exp: 2068, jobExp: 1282,
    element: 'dark', race: 'undead', size: 'large', speed: 76, aggressive: true,
    aggroRange: 270, attackDelay: 1.9, respawn: 76,
    sprite: { kind: 'sheet', key: 'ghoul', tint: '#9a86b8', scale: 1.3,
      layers: { head: 'golden_helm', torso: 'plate' } },
    drops: [],
    aurum: { chance: 0.52, min: 130, max: 300 },
  }),
  bone_choirmaster: M({
    id: 'bone_choirmaster', name: 'Bone Choirmaster', nameTh: 'ผู้นำขับร้องกระดูก', level: 69,
    hp: 6580, atk: 132, matk: 188, def: 58, mdef: 112, hit: 114, flee: 135, exp: 1628, jobExp: 1009,
    element: 'dark', race: 'undead', speed: 92, aggressive: true,
    aggroRange: 310, attackRange: 175, attackDelay: 1.7, respawn: 80,
    sprite: { kind: 'sheet', key: 'skeleton', tint: '#d8c8a8', scale: 1.2,
      layers: { head: 'cloth_hood', weapon: 'wand' } },
    skills: ['grim_harvest'],
    drops: [],
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
    element: 'holy', race: 'undead', size: 'large', speed: 74, aggressive: true,
    aggroRange: 260, attackDelay: 1.7, respawn: 70,
    sprite: { kind: 'sheet', key: 'skeleton', tint: '#e8dcc0', scale: 1.22, layers: { head: 'metal_helm', torso: 'plate', weapon: 'longspear' } },
    drops: [],
    aurum: { chance: 0.35, min: 60, max: 150 },
  }),
  reliquary_choir: M({
    id: 'reliquary_choir', name: 'Choir of Ash', nameTh: 'คณะขับร้องเถ้า', level: 63,
    hp: 5600, atk: 210, matk: 428, def: 44, mdef: 104, hit: 109, flee: 129, exp: 5000, jobExp: 3100,
    element: 'dark', race: 'undead', speed: 88, aggressive: true, aggroRange: 300,
    attackRange: 190, attackDelay: 2.0, respawn: 70,
    sprite: { kind: 'sheet', key: 'ghoul', tint: '#b79ad8', scale: 1.05, layers: { head: 'cloth_hood', weapon: 'wand' } },
    skills: ['grim_harvest'],
    drops: [],
    aurum: { chance: 0.35, min: 55, max: 140 },
  }),
  reliquary_anchor: M({
    id: 'reliquary_anchor', name: 'Grave Anchor', nameTh: 'สมอหลุมศพ', level: 64,
    hp: 16000, atk: 300, def: 104, mdef: 96, hit: 104, flee: 116, exp: 15000, jobExp: 9300,
    element: 'neutral', race: 'undead', size: 'large', speed: 52, aggressive: true,
    aggroRange: 220, attackRange: 56, attackDelay: 2.2, respawn: 90,
    sprite: { kind: 'sheet', key: 'skeleton', tint: '#9aa4b0', scale: 1.4, layers: { torso: 'plate', head: 'chainhat' } },
    drops: [],
    aurum: { chance: 0.45, min: 90, max: 210 },
  }),
  reliquary_shade: M({
    id: 'reliquary_shade', name: 'Cloister Shade', nameTh: 'เงาระเบียง', level: 63,
    hp: 4200, atk: 402, def: 38, mdef: 50, hit: 115, flee: 141, exp: 4600, jobExp: 2900,
    element: 'dark', race: 'undead', size: 'small', speed: 132, aggressive: true,
    aggroRange: 340, attackDelay: 1.0, respawn: 60,
    sprite: { kind: 'blob', color: '#6a4a86', scale: 0.95 },
    drops: [],
    aurum: { chance: 0.30, min: 50, max: 130 },
  }),

  /* ---------------- bosses ---------------- */
  orc_warlord: M({
    id: 'orc_warlord', name: 'Orc Warlord Gruum', nameTh: 'จอมทัพออร์ค กรูม', level: 55,
    boss: true, hp: 30000, atk: 355, def: 80, mdef: 55, hit: 111, flee: 122,
    exp: 26000, jobExp: 16000, element: 'fire', race: 'demon', size: 'large',
    script: 'warlord', phases: [0.66, 0.3],
    speed: 92, aggressive: true, aggroRange: 380, attackDelay: 1.3, respawn: 3600,
    sprite: { kind: 'sheet', key: 'red_orc', layers: { weapon: 'longspear' }, scale: 1.45 },
    skills: ['whirlwind', 'reckless_charge'],
    drops: [],
    aurum: { chance: 1.0, min: 2500, max: 6000 },
  }),
  reliquary_warden: M({
    id: 'reliquary_warden', name: 'Warden of the Reliquary', nameTh: 'ผู้เฝ้าหีบศพ', level: 68,
    boss: true, hp: 145000, atk: 470, matk: 400, def: 110, mdef: 100, hit: 119, flee: 132,
    exp: 78000, jobExp: 50000, element: 'holy', race: 'undead', size: 'large',
    speed: 80, aggressive: true, aggroRange: 460, attackRange: 56, attackDelay: 1.4,
    respawn: 900, lockout: 'weekly',
    sprite: {
      kind: 'sheet', key: 'skeleton', tint: '#ffe6b0', scale: 1.7,
      layers: { head: 'golden_helm', torso: 'plate_arms', hands: 'golden_gloves', weapon: 'longspear' },
    },
    // the fight is scripted in server/game/boss.js, not left to the random
    // skill roll every other monster uses
    script: 'warden', phases: [0.66, 0.3],
    drops: [],
    aurum: { chance: 1.0, min: 4000, max: 9000 },
  }),
  skeleton_king: M({
    id: 'skeleton_king', name: 'Skeleton King Vhaal', nameTh: 'ราชันโครงกระดูก วาล', level: 65,
    boss: true, hp: 52000, atk: 430, matk: 350, def: 95, mdef: 90, hit: 118, flee: 130,
    exp: 52000, jobExp: 32000, element: 'dark', race: 'undead', size: 'large',
    script: 'vhaal', phases: [0.6, 0.25],
    speed: 86, aggressive: true, aggroRange: 400, attackDelay: 1.25, respawn: 5400,
    sprite: {
      kind: 'sheet', key: 'skeleton', scale: 1.5,
      layers: { head: 'golden_helm', torso: 'plate', weapon: 'longspear' },
    },
    skills: ['grim_harvest', 'meteor_rune'],
    drops: [],
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
