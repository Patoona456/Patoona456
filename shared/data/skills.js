// Skill book. A skill is pure data; server/game/skills.js interprets it.
//
// kind:
//   'damage'  - single target damage (physical unless magic:true)
//   'aoe'     - damage in a radius around the target point / caster
//   'heal'    - restore HP to self or an ally
//   'buff'    - timed modifier on self / party
//   'debuff'  - timed modifier on an enemy
//   'dash'    - reposition
//   'summon'  - spawn a friendly entity
//
// Numeric fields written as [base, perLevel] scale with the learned level.

const S = (o) => ({ maxLevel: 5, castTime: 0, cooldown: [3, -0.1], range: 48, anim: 'slash', element: 'neutral', ...o });

export const SKILLS = {
  /* ---------------- Novice ---------------- */
  first_aid: S({
    id: 'first_aid', name: 'First Aid', nameTh: 'ปฐมพยาบาล', kind: 'heal', look: 'earth', target: 'self',
    maxLevel: 3, sp: [8, 2], heal: [22, 18], castTime: 0.6, cooldown: [12, -1], anim: 'spellcast',
    desc: 'ฟื้นเลือดตัวเองเล็กน้อย ทุกอาชีพเรียนได้',
  }),
  shove: S({
    id: 'shove', name: 'Shove', nameTh: 'ผลัก', kind: 'damage', look: 'neutral', target: 'enemy',
    maxLevel: 3, sp: [5, 1], ratio: [1.1, 0.25], knockback: 48, cooldown: [6, -0.5], anim: 'thrust',
    desc: 'ดันศัตรูให้ถอยหลัง ใช้หนีได้',
  }),

  /* ---------------- Vanguard ---------------- */
  cleave: S({
    id: 'cleave', name: 'Cleave', nameTh: 'ฟันกวาด', kind: 'aoe', look: 'neutral', target: 'self',
    sp: [10, 3], ratio: [1.3, 0.35], radius: [60, 6], cooldown: [5, -0.3], anim: 'slash',
    weapon: ['blade', 'spear', 'rod'], desc: 'ฟันกวาดรอบตัว โดนทุกตัวในระยะ',
  }),
  skewer: S({
    id: 'skewer', name: 'Skewer', nameTh: 'แทงทะลวง', kind: 'damage', look: 'neutral', target: 'enemy',
    sp: [12, 3], ratio: [1.8, 0.55], range: 72, cooldown: [7, -0.4], anim: 'thrust',
    weapon: ['spear', 'blade'], pierce: 0.3, desc: 'แทงแรง เจาะเกราะ 30%',
  }),
  taunt: S({
    id: 'taunt', name: 'Taunt', nameTh: 'ยั่วยุ', kind: 'debuff', look: 'fire', target: 'enemy',
    maxLevel: 3, sp: [8, 2], radius: [96, 16], aggro: [600, 400], duration: [6, 1],
    cooldown: [14, -1], anim: 'spellcast', desc: 'ดึงความสนใจมอนสเตอร์รอบตัวมาที่ตัวเอง',
  }),
  bulwark_stance: S({
    id: 'bulwark_stance', name: 'Bulwark Stance', nameTh: 'ท่ายืนกำแพง', kind: 'buff', look: 'holy', target: 'self',
    sp: [14, 3], duration: [20, 4], cooldown: [30, -1], anim: 'spellcast',
    mods: { defPct: [10, 4], speedPct: [-12, 1] }, desc: 'ลดดาเมจที่ได้รับ แลกกับความเร็วเดิน',
  }),
  iron_will: S({
    id: 'iron_will', name: 'Iron Will', nameTh: 'ใจเหล็ก', kind: 'passive', look: 'holy',
    maxLevel: 5, mods: { maxHpPct: [3, 3], statusRes: [5, 5] }, desc: 'พาสซีฟ: เลือดสูงสุด + ต้านสถานะผิดปกติ',
  }),

  /* ---------------- Wayfarer ---------------- */
  backstab: S({
    id: 'backstab', name: 'Backstab', nameTh: 'ลอบแทงหลัง', kind: 'damage', look: 'dark', target: 'enemy',
    sp: [10, 3], ratio: [1.5, 0.5], behindBonus: [0.8, 0.3], range: 40, cooldown: [6, -0.4],
    anim: 'thrust', weapon: ['blade'], desc: 'แรงขึ้นมากเมื่อโจมตีจากด้านหลัง',
  }),
  shadow_step: S({
    id: 'shadow_step', name: 'Shadow Step', nameTh: 'ก้าวเงา', kind: 'dash', look: 'dark', target: 'point',
    maxLevel: 3, sp: [12, 2], distance: [120, 30], cooldown: [10, -1.5], anim: 'spellcast',
    desc: 'พุ่งไปตามทิศที่หัน ผ่านศัตรูได้',
  }),
  venom_edge: S({
    id: 'venom_edge', name: 'Venom Edge', nameTh: 'คมพิษ', kind: 'damage', target: 'enemy',
    sp: [11, 3], ratio: [1.1, 0.25], range: 40, cooldown: [9, -0.5], anim: 'slash',
    status: { type: 'poison', chance: [40, 10], duration: [8, 1], tick: [8, 4] },
    element: 'earth', desc: 'ติดพิษ ทำดาเมจต่อเนื่อง',
  }),
  evasion: S({
    id: 'evasion', name: 'Evasion', nameTh: 'ตัวลื่น', kind: 'passive', look: 'dark',
    mods: { fleeFlat: [6, 6], speedPct: [1, 1] }, desc: 'พาสซีฟ: หลบและความเร็วเพิ่ม',
  }),
  pilfer: S({
    id: 'pilfer', name: 'Pilfer', nameTh: 'ล้วงกระเป๋า', kind: 'damage', look: 'dark', target: 'enemy',
    maxLevel: 5, sp: [10, 2], ratio: [0.6, 0.1], range: 40, cooldown: [20, -1], anim: 'thrust',
    steal: { chance: [12, 4] }, desc: 'มีโอกาสขโมยของจากมอนสเตอร์ (ครั้งเดียวต่อตัว)',
  }),

  /* ---------------- Marksman ---------------- */
  aimed_shot: S({
    id: 'aimed_shot', name: 'Aimed Shot', nameTh: 'ยิงเล็ง', kind: 'damage', look: 'neutral', target: 'enemy',
    sp: [10, 3], ratio: [1.6, 0.5], range: 220, castTime: 0.5, cooldown: [5, -0.3],
    anim: 'shoot', weapon: ['bow'], ammo: 1, desc: 'ยิงแม่นหนึ่งนัด ระยะไกล',
  }),
  volley: S({
    id: 'volley', name: 'Volley', nameTh: 'ระดมยิง', kind: 'aoe', look: 'neutral', target: 'point',
    sp: [18, 5], ratio: [0.85, 0.2], radius: [72, 8], range: 220, castTime: 0.8,
    cooldown: [12, -0.6], anim: 'shoot', weapon: ['bow'], ammo: 3, hits: [3, 1],
    desc: 'ยิงลงพื้นที่ โดนทุกตัวหลายนัด',
  }),
  pinning_arrow: S({
    id: 'pinning_arrow', name: 'Pinning Arrow', nameTh: 'ธนูตรึง', kind: 'damage', look: 'neutral', target: 'enemy',
    maxLevel: 3, sp: [12, 3], ratio: [1.0, 0.2], range: 200, cooldown: [14, -1], anim: 'shoot',
    weapon: ['bow'], ammo: 1, status: { type: 'root', chance: [70, 10], duration: [2.5, 0.5] },
    desc: 'ตรึงศัตรูให้เคลื่อนที่ไม่ได้ชั่วครู่',
  }),
  hawk_eye: S({
    id: 'hawk_eye', name: "Hawk's Eye", nameTh: 'ตาเหยี่ยว', kind: 'passive', look: 'holy',
    mods: { hitFlat: [5, 5], rangePct: [4, 4] }, desc: 'พาสซีฟ: ความแม่นและระยะยิงเพิ่ม',
  }),
  ember_arrow: S({
    id: 'ember_arrow', name: 'Ember Arrow', nameTh: 'ธนูอังคาร', kind: 'damage', target: 'enemy',
    sp: [14, 4], ratio: [1.4, 0.4], range: 200, cooldown: [8, -0.4], anim: 'shoot',
    weapon: ['bow'], ammo: 1, element: 'fire',
    status: { type: 'burn', chance: [50, 8], duration: [6, 0.5], tick: [10, 5] },
    desc: 'ธนูไฟ ติดไหม้ต่อเนื่อง',
  }),

  /* ---------------- Runecaster ---------------- */
  ember_bolt: S({
    id: 'ember_bolt', name: 'Ember Bolt', nameTh: 'ลูกไฟรูน', kind: 'damage', target: 'enemy',
    sp: [12, 4], ratio: [1.5, 0.55], range: 190, castTime: 0.7, cooldown: [3, -0.15],
    anim: 'spellcast', magic: true, element: 'fire', desc: 'เวทย์ไฟพื้นฐาน ร่ายเร็ว',
  }),
  frost_nail: S({
    id: 'frost_nail', name: 'Frost Nail', nameTh: 'ตะปูน้ำแข็ง', kind: 'damage', target: 'enemy',
    sp: [14, 4], ratio: [1.3, 0.45], range: 190, castTime: 0.8, cooldown: [6, -0.3],
    anim: 'spellcast', magic: true, element: 'ice',
    status: { type: 'chill', chance: [60, 8], duration: [4, 0.5], slowPct: [25, 5] },
    desc: 'ชะลอความเร็วศัตรู',
  }),
  storm_sigil: S({
    id: 'storm_sigil', name: 'Storm Sigil', nameTh: 'รูนพายุ', kind: 'aoe', target: 'point',
    sp: [24, 6], ratio: [1.1, 0.35], radius: [80, 8], range: 180, castTime: 1.4,
    cooldown: [12, -0.5], anim: 'spellcast', magic: true, element: 'lightning', hits: [2, 0.5],
    desc: 'เรียกสายฟ้าลงพื้นที่ โดนหลายครั้ง',
  }),
  mana_font: S({
    id: 'mana_font', name: 'Mana Font', nameTh: 'บ่อมานา', kind: 'buff', look: 'lightning', target: 'self',
    sp: [0, 0], duration: [18, 3], cooldown: [60, -2], anim: 'spellcast',
    mods: { spRegenPct: [40, 20] }, desc: 'ฟื้นมานาเร็วขึ้นชั่วคราว',
  }),
  runic_ward: S({
    id: 'runic_ward', name: 'Runic Ward', nameTh: 'โล่รูน', kind: 'buff', look: 'lightning', target: 'ally',
    sp: [20, 5], duration: [15, 2], cooldown: [25, -1], anim: 'spellcast', range: 120,
    shield: [40, 35], desc: 'สร้างโล่ดูดซับดาเมจให้เป้าหมาย',
  }),

  /* ---------------- Warden ---------------- */
  mend: S({
    id: 'mend', name: 'Mend', nameTh: 'สมานแผล', kind: 'heal', look: 'earth', target: 'ally',
    sp: [14, 4], heal: [45, 40], matkRatio: [1.0, 0.25], range: 150, castTime: 0.9,
    cooldown: [2.5, -0.1], anim: 'spellcast', desc: 'ฟื้นเลือดเป้าหมาย แรงตาม INT',
  }),
  radiant_smite: S({
    id: 'radiant_smite', name: 'Radiant Smite', nameTh: 'ทุบแสง', kind: 'damage', target: 'enemy',
    sp: [16, 4], ratio: [1.4, 0.45], range: 140, castTime: 0.6, cooldown: [5, -0.2],
    anim: 'spellcast', magic: true, element: 'holy', desc: 'แรงเป็นพิเศษกับอันเดดและปีศาจ',
  }),
  blessing: S({
    id: 'blessing', name: 'Blessing', nameTh: 'พร', kind: 'buff', look: 'holy', target: 'party',
    sp: [22, 5], duration: [90, 15], cooldown: [30, -1], anim: 'spellcast', range: 180,
    mods: { strFlat: [1, 1], intFlat: [1, 1], dexFlat: [1, 1] }, desc: 'บัฟทั้งปาร์ตี้ในระยะ',
  }),
  // The Hierophant owned three skills and not one of them did damage, so the
  // only attack it had was the Warden's smite and a rod it barely swings. It
  // levelled three times slower than an Arcanist. This is not a general nuke:
  // it bites the undead specifically, which is what the last thirty levels of
  // the world are made of, so the healer gets a place to solo rather than a
  // second damage career.
  dawnfire: S({
    id: 'dawnfire', name: 'Dawnfire', nameTh: 'เพลิงอรุณ', kind: 'aoe', look: 'holy', target: 'point',
    sp: [26, 6], ratio: [2.2, 0.6], radius: [92, 8], range: 200, magic: true, element: 'holy',
    raceBonus: { undead: [0.6, 0.15] }, castTime: 0.5, cooldown: [7, -0.4], anim: 'spellcast',
    desc: 'แสงอรุณแผดเผาเป็นวง แรงเป็นพิเศษกับอันเดด',
  }),
  sanctuary: S({
    id: 'sanctuary', name: 'Sanctuary', nameTh: 'เขตศักดิ์สิทธิ์', kind: 'ground', look: 'holy', target: 'point',
    sp: [30, 6], duration: [12, 1], radius: [72, 6], range: 140, castTime: 1.2,
    cooldown: [40, -1], anim: 'spellcast', healTick: [18, 12],
    desc: 'วางพื้นที่ฟื้นเลือดให้พวกพ้องที่ยืนอยู่',
  }),
  purge: S({
    id: 'purge', name: 'Purge', nameTh: 'ชำระล้าง', kind: 'buff', look: 'holy', target: 'ally',
    maxLevel: 3, sp: [18, 4], cleanse: true, cooldown: [16, -2], range: 150, anim: 'spellcast',
    desc: 'ล้างสถานะผิดปกติของเป้าหมาย',
  }),

  /* ---------------- Tier 2 ---------------- */
  aegis: S({
    id: 'aegis', name: 'Aegis', nameTh: 'อีจิส', kind: 'buff', look: 'holy', target: 'party', maxLevel: 5,
    sp: [40, 8], duration: [12, 1], cooldown: [60, -2], range: 200, anim: 'spellcast',
    mods: { dmgTakenPct: [-12, -3] }, desc: 'ลดดาเมจที่ทั้งปาร์ตี้ได้รับ',
  }),
  thorn_guard: S({
    id: 'thorn_guard', name: 'Thorn Guard', nameTh: 'เกราะหนาม', kind: 'buff', look: 'earth', target: 'self',
    sp: [26, 5], duration: [20, 2], cooldown: [35, -1], anim: 'spellcast',
    mods: { reflectPct: [12, 5] }, desc: 'สะท้อนดาเมจกายภาพกลับไปบางส่วน',
  }),
  unbreakable: S({
    id: 'unbreakable', name: 'Unbreakable', nameTh: 'ไม่แตกสลาย', kind: 'buff', look: 'holy', target: 'self',
    maxLevel: 3, sp: [50, 10], duration: [6, 1], cooldown: [180, -20], anim: 'spellcast',
    mods: { minHpGuard: 1 }, desc: 'ไม่ตายจากดาเมจใดๆ ชั่วครู่ (เหลือ 1 HP)',
  }),
  bloodthirst: S({
    id: 'bloodthirst', name: 'Bloodthirst', nameTh: 'กระหายเลือด', kind: 'buff', look: 'dark', target: 'self',
    sp: [30, 6], duration: [15, 2], cooldown: [45, -1], anim: 'spellcast',
    mods: { atkPct: [15, 5], lifestealPct: [6, 3], defPct: [-20, 0] },
    desc: 'ตีแรงและดูดเลือด แต่ป้องกันลดลง',
  }),
  whirlwind: S({
    id: 'whirlwind', name: 'Whirlwind', nameTh: 'พายุหมุน', kind: 'aoe', look: 'neutral', target: 'self',
    sp: [28, 6], ratio: [1.1, 0.3], radius: [84, 8], hits: [3, 0.5], cooldown: [14, -0.5],
    anim: 'slash', desc: 'หมุนฟันรอบตัวหลายครั้ง',
  }),
  reckless_charge: S({
    id: 'reckless_charge', name: 'Reckless Charge', nameTh: 'พุ่งชนบ้าคลั่ง', kind: 'dash', look: 'fire',
    target: 'point', sp: [22, 4], distance: [160, 20], ratio: [1.6, 0.4], radius: 48,
    cooldown: [16, -1], anim: 'thrust', desc: 'พุ่งชนทะลุ ทำดาเมจระหว่างทาง',
  }),
  cloak: S({
    id: 'cloak', name: 'Cloak', nameTh: 'ล่องหน', kind: 'buff', look: 'dark', target: 'self', maxLevel: 5,
    sp: [24, 4], duration: [10, 2], cooldown: [30, -2], anim: 'spellcast',
    mods: { invisible: 1, speedPct: [-20, 4] }, breakOnAttack: true,
    desc: 'ล่องหน มอนสเตอร์มองไม่เห็น หลุดเมื่อโจมตี',
  }),
  mortal_strike: S({
    id: 'mortal_strike', name: 'Mortal Strike', nameTh: 'ดาบสังหาร', kind: 'damage', look: 'neutral', target: 'enemy',
    // Eighteen seconds made the Nightblade's signature move something it
    // pressed twice a fight, so its rotation was really the Wayfarer's
    // backstab and a worse weapon than the Trickster's bow. It levelled
    // twice as slowly as its own sibling branch. Still the longest cooldown
    // of any attack in the game, and still the hardest single hit.
    sp: [30, 6], ratio: [2.8, 0.95], range: 40, cooldown: [11, -0.7], anim: 'thrust',
    weapon: ['blade'], fromStealth: [1.5, 0.2], desc: 'ดาเมจสูงมากเมื่อออกจากการล่องหน',
  }),
  grim_harvest: S({
    id: 'grim_harvest', name: 'Grim Harvest', nameTh: 'เก็บเกี่ยวมรณะ', kind: 'aoe', target: 'self',
    sp: [36, 7], ratio: [1.5, 0.45], radius: [90, 6], cooldown: [16, -0.8], anim: 'slash',
    element: 'dark', lifesteal: [20, 5], desc: 'ดูดเลือดจากทุกเป้าหมายรอบตัว',
  }),
  // The Bulwark and the Trickster each owned three skills and not one of them
  // was an attack, so both leaned entirely on what the tier below gave them.
  // Neither of these is a damage career: the Bulwark's scales with how much
  // punishment it has absorbed, and the Trickster's pays in what it steals.
  shield_crush: S({
    id: 'shield_crush', name: 'Shield Crush', nameTh: 'ทุบด้วยโล่', kind: 'damage', look: 'holy', target: 'enemy',
    sp: [22, 5], ratio: [1.9, 0.55], range: 46, cooldown: [7, -0.4], anim: 'slash',
    weapon: ['blade', 'spear', 'rod'], aggro: [400, 200],
    desc: 'ทุบด้วยโล่ ดึงความสนใจไปพร้อมกัน — แรงขึ้นตามค่า DEF',
    scaleWith: 'def',
  }),
  cutpurse_strike: S({
    id: 'cutpurse_strike', name: 'Cutpurse Strike', nameTh: 'ฟันชิงทรัพย์', kind: 'damage', look: 'dark', target: 'enemy',
    sp: [18, 4], ratio: [2.2, 0.6], range: 44, cooldown: [6, -0.35], anim: 'thrust',
    weapon: ['blade', 'bow'], lifesteal: [8, 2],
    desc: 'ฟันแล้วฉกติดมือ ดูดเลือดเล็กน้อย',
  }),
  smoke_bomb: S({
    id: 'smoke_bomb', name: 'Smoke Bomb', nameTh: 'ระเบิดควัน', kind: 'debuff', look: 'dark', target: 'self',
    sp: [26, 5], radius: [96, 8], duration: [6, 1], cooldown: [30, -1], anim: 'spellcast',
    mods: { targetFleePct: [-30, -5] }, desc: 'ศัตรูรอบตัวยิงพลาดง่ายขึ้น',
  }),
  snare_trap: S({
    id: 'snare_trap', name: 'Snare Trap', nameTh: 'กับดักบ่วง', kind: 'ground', look: 'earth', target: 'point',
    sp: [20, 4], duration: [30, 5], radius: [40, 4], range: 90, cooldown: [20, -1],
    anim: 'thrust', trap: { type: 'root', duration: [3, 0.5] }, desc: 'วางกับดักตรึงศัตรูที่เหยียบ',
  }),
  sleight: S({
    id: 'sleight', name: 'Sleight', nameTh: 'มือไว', kind: 'passive', look: 'dark',
    mods: { lukFlat: [2, 2], stealBonus: [5, 5] }, desc: 'พาสซีฟ: LUK และโอกาสขโมยเพิ่ม',
  }),
  piercing_shot: S({
    id: 'piercing_shot', name: 'Piercing Shot', nameTh: 'ยิงทะลุแนว', kind: 'line', look: 'neutral', target: 'point',
    sp: [30, 6], ratio: [1.7, 0.5], range: 260, width: 32, castTime: 0.7, cooldown: [12, -0.5],
    anim: 'shoot', weapon: ['bow'], ammo: 2, desc: 'ลูกธนูทะลุศัตรูเป็นแนวตรง',
  }),
  rain_of_arrows: S({
    id: 'rain_of_arrows', name: 'Rain of Arrows', nameTh: 'ห่าธนู', kind: 'ground', look: 'neutral', target: 'point',
    sp: [45, 9], ratio: [0.6, 0.18], radius: [96, 8], range: 240, duration: [5, 0.5],
    tickRate: 0.6, cooldown: [30, -1], anim: 'shoot', weapon: ['bow'], ammo: 6,
    desc: 'ฝนธนูตกต่อเนื่องในพื้นที่',
  }),
  steady_aim: S({
    id: 'steady_aim', name: 'Steady Aim', nameTh: 'เล็งนิ่ง', kind: 'passive', look: 'holy',
    mods: { critFlat: [3, 3], rangePct: [3, 3] }, desc: 'พาสซีฟ: คริติคอลและระยะยิง',
  }),
  meteor_rune: S({
    id: 'meteor_rune', name: 'Meteor Rune', nameTh: 'รูนอุกกาบาต', kind: 'ground', target: 'point',
    sp: [60, 12], ratio: [1.5, 0.5], radius: [110, 10], range: 200, castTime: 2.4,
    duration: [4, 0.4], tickRate: 1.0, cooldown: [40, -1], anim: 'spellcast', magic: true,
    element: 'fire', desc: 'อุกกาบาตตกซ้ำๆ ในพื้นที่กว้าง',
  }),
  glacial_field: S({
    id: 'glacial_field', name: 'Glacial Field', nameTh: 'ลานน้ำแข็ง', kind: 'ground', target: 'point',
    sp: [50, 10], ratio: [0.8, 0.25], radius: [100, 8], range: 190, castTime: 1.6,
    duration: [8, 1], tickRate: 1.0, cooldown: [36, -1], anim: 'spellcast', magic: true,
    element: 'ice', status: { type: 'chill', chance: [100, 0], duration: [2, 0], slowPct: [40, 4] },
    desc: 'พื้นที่น้ำแข็ง ทำดาเมจและชะลอ',
  }),
  rune_overload: S({
    id: 'rune_overload', name: 'Rune Overload', nameTh: 'รูนโอเวอร์โหลด', kind: 'buff', look: 'lightning', target: 'self',
    sp: [0, 0], duration: [12, 1], cooldown: [70, -2], anim: 'spellcast',
    mods: { matkPct: [20, 6], spCostPct: [30, 5] }, desc: 'เวทย์แรงขึ้นแต่เปลือง SP มากขึ้น',
  }),
  // Wind and earth arrived with the art sheets, which name both - and an
  // element with no skill, no weapon and no monster is not an element, it is
  // a row in a table. These two are straight off the skill sheet.
  wind_cutter: S({
    id: 'wind_cutter', name: 'Wind Cutter', nameTh: 'ใบมีดวายุ', kind: 'damage', look: 'wind', target: 'enemy',
    sp: [20, 5], ratio: [2.4, 0.7], range: 190, castTime: 0.4, cooldown: [6, -0.3],
    anim: 'spellcast', magic: true, element: 'wind',
    desc: 'ใบมีดลมพุ่งตรง ร่ายเร็วและยิงไกล',
  }),
  earth_spike: S({
    id: 'earth_spike', name: 'Earth Spike', nameTh: 'หอกปฐพี', kind: 'aoe', look: 'earth', target: 'point',
    sp: [30, 7], ratio: [2.0, 0.6], radius: [86, 8], range: 170, castTime: 0.7, cooldown: [9, -0.4],
    anim: 'spellcast', magic: true, element: 'earth', hits: [2, 0.4],
    desc: 'หินแหลมแทงขึ้นจากพื้นเป็นวง โดนสองครั้ง',
  }),
  chain_spark: S({
    id: 'chain_spark', name: 'Chain Spark', nameTh: 'สายฟ้าเด้ง', kind: 'chain', target: 'enemy',
    sp: [26, 6], ratio: [1.2, 0.4], range: 180, jumps: [2, 1], jumpRange: 120, falloff: 0.75,
    castTime: 0.8, cooldown: [8, -0.3], anim: 'spellcast', magic: true, element: 'lightning',
    desc: 'สายฟ้ากระโดดต่อไปยังศัตรูข้างเคียง',
  }),
  tempest_veil: S({
    id: 'tempest_veil', name: 'Tempest Veil', nameTh: 'ม่านพายุ', kind: 'buff', look: 'lightning', target: 'self',
    sp: [34, 7], duration: [16, 2], cooldown: [45, -1], anim: 'spellcast',
    mods: { castPct: [15, 5], shockAura: [10, 6] }, desc: 'ร่ายเร็วขึ้น และช็อตศัตรูที่เข้าใกล้',
  }),
  thunder_step: S({
    id: 'thunder_step', name: 'Thunder Step', nameTh: 'ย่างสายฟ้า', kind: 'dash', target: 'point',
    maxLevel: 3, sp: [20, 4], distance: [140, 30], ratio: [1.0, 0.3], radius: 56,
    cooldown: [14, -1.5], anim: 'spellcast', magic: true, element: 'lightning',
    desc: 'วาร์ปสั้นๆ ทิ้งดาเมจไว้ที่จุดเดิม',
  }),
  greater_mend: S({
    id: 'greater_mend', name: 'Greater Mend', nameTh: 'สมานใหญ่', kind: 'heal', look: 'earth', target: 'ally',
    sp: [40, 9], heal: [120, 90], matkRatio: [1.8, 0.4], range: 160, castTime: 1.4,
    cooldown: [6, -0.2], anim: 'spellcast', desc: 'ฟื้นเลือดจำนวนมาก',
  }),
  revive: S({
    id: 'revive', name: 'Revive', nameTh: 'ชุบชีวิต', kind: 'revive', look: 'holy', target: 'corpse',
    maxLevel: 3, sp: [80, 15], hpPct: [20, 15], range: 100, castTime: 4, cooldown: [120, -20],
    anim: 'spellcast', reagent: 'shard_dawn', desc: 'ชุบเพื่อนที่ตายในที่เกิดเหตุ (ใช้เศษรุ่งอรุณ 1 ชิ้น)',
  }),
  aura_of_dawn: S({
    id: 'aura_of_dawn', name: 'Aura of Dawn', nameTh: 'ออร่าอรุณ', kind: 'buff', look: 'holy', target: 'party',
    sp: [50, 10], duration: [30, 4], cooldown: [90, -2], range: 200, anim: 'spellcast',
    mods: { hpRegenPct: [40, 15], statusRes: [15, 5] }, desc: 'ฟื้นเลือดต่อเนื่องให้ทั้งปาร์ตี้',
  }),
  oath_strike: S({
    id: 'oath_strike', name: 'Oath Strike', nameTh: 'หมัดคำสาบาน', kind: 'damage', target: 'enemy',
    sp: [28, 6], ratio: [1.9, 0.6], range: 48, cooldown: [9, -0.4], anim: 'slash',
    element: 'holy', desc: 'ดาเมจกายภาพธาตุแสง',
  }),
  consecrate: S({
    id: 'consecrate', name: 'Consecrate', nameTh: 'ชำระพื้นดิน', kind: 'ground', target: 'point',
    sp: [38, 8], ratio: [0.9, 0.3], radius: [90, 8], range: 120, duration: [8, 1], tickRate: 1,
    cooldown: [30, -1], anim: 'spellcast', magic: true, element: 'holy',
    desc: 'พื้นที่ศักดิ์สิทธิ์ เผาอันเดดต่อเนื่อง',
  }),
  shield_of_vows: S({
    id: 'shield_of_vows', name: 'Shield of Vows', nameTh: 'โล่คำสาบาน', kind: 'buff', look: 'holy', target: 'ally',
    sp: [32, 7], duration: [14, 2], cooldown: [28, -1], range: 140, anim: 'spellcast',
    shield: [80, 60], mods: { dmgTakenPct: [-8, -2] }, desc: 'โล่ดูดซับ + ลดดาเมจให้เป้าหมาย',
  }),
  call_companion: S({
    id: 'call_companion', name: 'Call Companion', nameTh: 'เรียกสัตว์คู่ใจ', kind: 'summon', look: 'earth',
    target: 'self', maxLevel: 5, sp: [45, 8], duration: [120, 30], cooldown: [90, -5],
    anim: 'spellcast', summon: { id: 'companion_wolf', levelPct: [60, 8] },
    desc: 'เรียกหมาป่ามาช่วยสู้',
  }),
  wild_bond: S({
    id: 'wild_bond', name: 'Wild Bond', nameTh: 'สายใยป่า', kind: 'passive', look: 'earth',
    mods: { summonStatPct: [10, 10], hpRegenPct: [5, 5] }, desc: 'พาสซีฟ: สัตว์เลี้ยงแข็งแกร่งขึ้น',
  }),
};

/** value of a [base, perLevel] pair at a learned level */
export function val(field, level) {
  if (field == null) return 0;
  if (Array.isArray(field)) return field[0] + field[1] * (level - 1);
  return field;
}

export function skillCost(skill, level) {
  return Math.max(0, Math.round(val(skill.sp, level)));
}
