// Quests: the other Aurum faucet, and the game's map of where to go next.
//
// Balance rules the whole list obeys:
//   * one-time quests pay roughly what a focused session in that zone pays,
//     so they lead the player forward rather than replacing the grind;
//   * a daily pays about a third of a one-time quest in its band, because it
//     comes back tomorrow - repeatable money is the easiest way to wreck a
//     scarce-currency economy;
//   * every quest names a `zone`, which is also what the auto-walk follows.
//
// Bands (one-time / daily):
//   Lv 1-9   Greenmire    300-900     / 250
//   Lv 10-17 Ashfen       1.2k-3k     / 900
//   Lv 18-25 Gravebound   6k-8k       / 2.4k
//   Lv 26-39 Orcwatch     9k-16k      / 4.5k
//   Lv 40-55 Frostvault   20k-32k     / 8k
//   Lv 56-70 Vhaal        45k+, plus the weekly bosses

export const QUESTS = {
  q_first_blood: {
    id: 'q_first_blood', name: 'ก้าวแรกในโคลน', giver: 'board', minLevel: 1,
    zone: 'greenmire',
    desc: 'ล่าสไลม์โคลน 10 ตัวในทุ่งกรีนไมร์',
    objectives: [{ type: 'kill', mob: 'mire_slime', count: 10 }],
    rewards: { exp: 120, jobExp: 80, aurum: 300, items: [{ id: 'lesser_salve', qty: 5 }] },
  },
  q_herbalist: {
    id: 'q_herbalist', name: 'ฝากซื้อสมุนไพร', giver: 'board', minLevel: 3,
    zone: 'greenmire',
    desc: 'เก็บมัดสมุนไพร 15 ชิ้นมาส่งนักบวชอีริน',
    objectives: [{ type: 'collect', item: 'herb_bundle', count: 15 }],
    rewards: { exp: 200, jobExp: 140, aurum: 450, items: [{ id: 'herbal_stew', qty: 3 }] },
  },
  q_job_path: {
    id: 'q_job_path', name: 'เลือกทางของตัวเอง', giver: 'trainer', minLevel: 1,
    zone: 'emberhold',
    desc: 'ไปถึงเลเวล 10 แล้วกลับมาหาครูฝึกฮาลด์เพื่อเลือกอาชีพ',
    objectives: [{ type: 'level', count: 10 }],
    rewards: { exp: 300, jobExp: 200, aurum: 500, unlock: 'jobChange' },
  },

  /* --- บททดสอบของแต่ละสาย ---------------------------------------------
     เปลี่ยนอาชีพได้เลยที่เลเวล 10 โดยไม่ต้องทำบททดสอบ แต่ใครทำก่อนเปลี่ยน
     จะได้ของเริ่มต้นชุดใหญ่ แต้มสกิลเพิ่ม และเงินก้อนแรกที่ใช้ได้จริง
     ทุกบทออกแบบให้จบได้ในทุ่งกรีนไมร์/หนองเถ้าด้วยเลเวล 10 */
  q_trial_vanguard: {
    id: 'q_trial_vanguard', name: 'ยืนให้อยู่', giver: 'trainer', minLevel: 10, path: 'vanguard',
    zone: 'ashfen',
    desc: 'ซากเถ้าตีเจ็บและไม่ถอย ล่ามันให้ได้ 12 ตัว แล้วเอาเศษกระดูก 8 ชิ้นมาเป็นเครื่องยืนยัน',
    objectives: [
      { type: 'kill', mob: 'husk', count: 12 },
      { type: 'collect', item: 'bone_chip', count: 8 },
    ],
    rewards: { exp: 900, jobExp: 700, aurum: 800, skillPoints: 1,
      items: [{ id: 'wooden_shield', qty: 1 }, { id: 'greater_salve', qty: 5 }] },
  },
  q_trial_wayfarer: {
    id: 'q_trial_wayfarer', name: 'ไล่ให้ทัน', giver: 'trainer', minLevel: 10, path: 'wayfarer',
    zone: 'greenmire',
    desc: 'ดวงไฟเร่ร่อนลอยเร็วและหนีเก่ง ไล่ดับให้ได้ 15 ดวง',
    objectives: [{ type: 'kill', mob: 'ember_wisp', count: 15 }],
    rewards: { exp: 900, jobExp: 700, aurum: 800, skillPoints: 1,
      items: [{ id: 'bronze_shortblade', qty: 1 }, { id: 'greater_salve', qty: 5 }] },
  },
  q_trial_marksman: {
    id: 'q_trial_marksman', name: 'ยิงจากที่ไกล', giver: 'trainer', minLevel: 10, path: 'marksman',
    zone: 'greenmire',
    desc: 'ล่าสไลม์โคลน 20 ตัว และเอาหนังหนู 8 ผืนมาทำสายธนู',
    objectives: [
      { type: 'kill', mob: 'mire_slime', count: 20 },
      { type: 'collect', item: 'rat_pelt', count: 8 },
    ],
    rewards: { exp: 900, jobExp: 700, aurum: 800, skillPoints: 1,
      items: [{ id: 'wooden_arrow', qty: 600 }, { id: 'greater_salve', qty: 5 }] },
  },
  q_trial_runecaster: {
    id: 'q_trial_runecaster', name: 'หมึกรูน', giver: 'trainer', minLevel: 10, path: 'runecaster',
    zone: 'greenmire',
    desc: 'หมึกรูนต้องใช้ถ่านอังคาร 2 ก้อนกับมัดสมุนไพร 15 มัด',
    objectives: [
      { type: 'collect', item: 'ember_cinder', count: 2 },
      { type: 'collect', item: 'herb_bundle', count: 15 },
    ],
    rewards: { exp: 900, jobExp: 700, aurum: 800, skillPoints: 1,
      items: [{ id: 'mana_draught', qty: 8 }, { id: 'greater_salve', qty: 4 }] },
  },
  q_trial_warden: {
    id: 'q_trial_warden', name: 'มือที่รักษา', giver: 'trainer', minLevel: 10, path: 'warden',
    zone: 'greenmire',
    desc: 'เตรียมยาให้คนทั้งเมือง: มัดสมุนไพร 20 มัด และเศษกระดูก 10 ชิ้นสำหรับเครื่องราง',
    objectives: [
      { type: 'collect', item: 'herb_bundle', count: 20 },
      { type: 'collect', item: 'bone_chip', count: 10 },
    ],
    rewards: { exp: 900, jobExp: 700, aurum: 800, skillPoints: 1,
      items: [{ id: 'herbal_stew', qty: 5 }, { id: 'greater_salve', qty: 4 }] },
  },
  q_bandit_trouble: {
    id: 'q_bandit_trouble', name: 'ปัญหาโจร', giver: 'board', minLevel: 12,
    zone: 'ashfen',
    desc: 'กำจัดโจรสอดแนม 20 ตัว และนำเชือกขาดรุ่ย 10 เส้นมาเป็นหลักฐาน',
    objectives: [
      { type: 'kill', mob: 'bandit_scout', count: 20 },
      { type: 'collect', item: 'bandit_rope', count: 10 },
    ],
    rewards: { exp: 2600, jobExp: 1600, aurum: 2500, items: [{ id: 'leather_vest', qty: 1 }] },
  },
  q_gravebound: {
    id: 'q_gravebound', name: 'เสียงจากสุสาน', giver: 'board', minLevel: 18,
    zone: 'gravebound',
    desc: 'ปราบโครงกระดูกพันธนาการ 30 ตัว',
    objectives: [{ type: 'kill', mob: 'gravebound', count: 30 }],
    rewards: { exp: 8000, jobExp: 5000, aurum: 6000, items: [{ id: 'runed_whetstone', qty: 1 }] },
  },
  q_forge_lesson: {
    id: 'q_forge_lesson', name: 'บทเรียนช่างเหล็ก', giver: 'smith', minLevel: 10,
    zone: 'emberhold',
    desc: 'คราฟต์แท่งเหล็กกล้า 3 แท่ง แล้วนำกลับมาให้บอร์ก',
    objectives: [{ type: 'collect', item: 'steel_ingot', count: 3 }],
    rewards: { exp: 1200, jobExp: 900, aurum: 1200, items: [{ id: 'blessing_oil', qty: 1 }] },
  },

  /* --- ทุ่งกรีนไมร์ (1-9) ------------------------------------------------ */
  q_bat_nuisance: {
    id: 'q_bat_nuisance', name: 'ค้างคาวกวนเมือง', giver: 'board', minLevel: 4, zone: 'greenmire',
    desc: 'ค้างคาวยามพลบบินเข้าเมืองทุกคืน ไล่ตีให้ได้ 12 ตัว',
    objectives: [{ type: 'kill', mob: 'dusk_bat', count: 12 }],
    rewards: { exp: 330, jobExp: 200, aurum: 450, items: [{ id: 'lesser_salve', qty: 5 }] },
  },
  q_wisp_lights: {
    id: 'q_wisp_lights', name: 'ไฟที่ไม่ควรมี', giver: 'board', minLevel: 6, zone: 'greenmire',
    desc: 'ดวงไฟเร่ร่อนล่อคนหลงทางตอนกลางคืน ดับให้ได้ 14 ดวง และเก็บถ่านอังคาร 2 ก้อน',
    objectives: [
      { type: 'kill', mob: 'ember_wisp', count: 14 },
      { type: 'collect', item: 'ember_cinder', count: 2 },
    ],
    rewards: { exp: 700, jobExp: 420, aurum: 700, items: [{ id: 'mana_draught', qty: 3 }] },
  },
  q_thistle_field: {
    id: 'q_thistle_field', name: 'หนามในทุ่ง', giver: 'healer', minLevel: 8, zone: 'greenmire',
    desc: 'ภูตหนามทำชาวไร่บาดเจ็บทุกวัน จัดการ 12 ตัว แล้วเอายาแก้พิษ 3 ขวดมาให้อีริน',
    objectives: [
      { type: 'kill', mob: 'thistle_sprite', count: 12 },
      { type: 'collect', item: 'antidote', count: 3 },
    ],
    rewards: { exp: 900, jobExp: 560, aurum: 900, items: [{ id: 'herbal_stew', qty: 3 }] },
  },
  q_daily_greenmire: {
    id: 'q_daily_greenmire', name: 'งานประจำวัน: ทุ่งกรีนไมร์', giver: 'board', minLevel: 3,
    zone: 'greenmire', repeatable: 'daily',
    desc: 'เก็บมัดสมุนไพร 12 มัดส่งคลังเมือง (ทำได้ใหม่ทุกวัน)',
    objectives: [{ type: 'collect', item: 'herb_bundle', count: 12 }],
    rewards: { exp: 260, jobExp: 160, aurum: 250 },
  },

  /* --- หนองเถ้า (10-17) -------------------------------------------------- */
  q_husk_ash: {
    id: 'q_husk_ash', name: 'เถ้าที่ยังเดินได้', giver: 'board', minLevel: 11, zone: 'ashfen',
    desc: 'ซากเถ้าเดินออกจากหนองมาถึงทางเกวียน ล่าให้ได้ 18 ตัว และเก็บเศษกระดูก 12 ชิ้น',
    objectives: [
      { type: 'kill', mob: 'husk', count: 18 },
      { type: 'collect', item: 'bone_chip', count: 12 },
    ],
    rewards: { exp: 1800, jobExp: 1100, aurum: 1800, items: [{ id: 'greater_salve', qty: 5 }] },
  },
  q_first_refine: {
    id: 'q_first_refine', name: 'บทเรียนแรกของการตีบวก', giver: 'smith', minLevel: 12, zone: 'emberhold',
    desc: 'ตีบวกอุปกรณ์ชิ้นไหนก็ได้ให้ถึง +4 แล้วกลับมาอวดบอร์ก',
    objectives: [{ type: 'refine', count: 4 }],
    rewards: { exp: 2000, jobExp: 1200, aurum: 2000, items: [{ id: 'runed_whetstone', qty: 2 }] },
  },
  q_marsh_lurker: {
    id: 'q_marsh_lurker', name: 'เงาใต้ผิวน้ำ', giver: 'board', minLevel: 16, zone: 'ashfen',
    desc: 'ตัวลากโคลนลากคนหายไปสามคนแล้ว ล่าให้ได้ 14 ตัว',
    objectives: [{ type: 'kill', mob: 'marsh_lurker', count: 14 }],
    rewards: { exp: 3200, jobExp: 2000, aurum: 3000, items: [{ id: 'chain_coif', qty: 1 }] },
  },
  q_daily_ashfen: {
    id: 'q_daily_ashfen', name: 'งานประจำวัน: หนองเถ้า', giver: 'board', minLevel: 12,
    zone: 'ashfen', repeatable: 'daily',
    desc: 'ส่งเชือกขาดรุ่ย 8 เส้นให้กองลาดตระเวน (ทำได้ใหม่ทุกวัน)',
    objectives: [{ type: 'collect', item: 'bandit_rope', count: 8 }],
    rewards: { exp: 1100, jobExp: 700, aurum: 900 },
  },

  /* --- สุสานกราฟบาวด์ (18-25) -------------------------------------------- */
  q_bone_archers: {
    id: 'q_bone_archers', name: 'ธนูที่ไม่มีตา', giver: 'board', minLevel: 22, zone: 'gravebound',
    desc: 'นักธนูกระดูกยิงทุกอย่างที่ขยับ ปราบ 20 ตัว และเก็บลูกธนูที่มันทิ้งไว้ 60 ดอก',
    objectives: [
      { type: 'kill', mob: 'bone_archer', count: 20 },
      { type: 'collect', item: 'wooden_arrow', count: 60 },
    ],
    rewards: { exp: 7000, jobExp: 4400, aurum: 7000, items: [{ id: 'recurve_bow', qty: 1 }] },
  },
  q_crypt_seal: {
    id: 'q_crypt_seal', name: 'ผนึกที่ร้าว', giver: 'healer', minLevel: 28, zone: 'gravebound',
    desc: 'ผู้เฝ้าสุสานคือกุญแจของผนึก ทำลาย 12 ตัว แล้วนำเศษรุ่งอรุณ 1 ชิ้นมาซ่อมผนึก',
    objectives: [
      { type: 'kill', mob: 'crypt_warden', count: 12 },
      { type: 'collect', item: 'shard_dawn', count: 1 },
    ],
    rewards: { exp: 11000, jobExp: 7000, aurum: 8000, items: [{ id: 'blessing_oil', qty: 1 }] },
  },
  q_daily_gravebound: {
    id: 'q_daily_gravebound', name: 'งานประจำวัน: สุสาน', giver: 'board', minLevel: 20,
    zone: 'gravebound', repeatable: 'daily',
    desc: 'เก็บเศษกระดูก 25 ชิ้นให้นักบวช (ทำได้ใหม่ทุกวัน)',
    objectives: [{ type: 'collect', item: 'bone_chip', count: 25 }],
    rewards: { exp: 3600, jobExp: 2200, aurum: 2400 },
  },

  /* --- สันเขาออร์ควอช (26-39) -------------------------------------------- */
  q_orc_scouts: {
    id: 'q_orc_scouts', name: 'ลูกไล่ของกรูม', giver: 'board', minLevel: 27, zone: 'orcwatch',
    desc: 'ตัดกำลังลูกไล่ออร์ค 25 ตัว และเก็บเขี้ยวออร์ค 15 ซี่มาเป็นหลักฐาน',
    objectives: [
      { type: 'kill', mob: 'orc_scout', count: 25 },
      { type: 'collect', item: 'orc_tooth', count: 15 },
    ],
    rewards: { exp: 14000, jobExp: 8600, aurum: 9000, items: [{ id: 'steel_ingot', qty: 3 }] },
  },
  q_shaman_totem: {
    id: 'q_shaman_totem', name: 'เสาโทเท็มที่ต้องล้ม', giver: 'board', minLevel: 32, zone: 'orcwatch',
    desc: 'หมอผีออร์คปลุกไฟให้ทั้งค่าย ล้มให้ได้ 14 ตัว',
    objectives: [{ type: 'kill', mob: 'orc_shaman', count: 14 }],
    rewards: { exp: 20000, jobExp: 12500, aurum: 13000, items: [{ id: 'runed_whetstone', qty: 2 }] },
  },
  q_dusk_raiders: {
    id: 'q_dusk_raiders', name: 'นักบุกยามพลบ', giver: 'board', minLevel: 35, zone: 'orcwatch',
    desc: 'กองโจรยามพลบปล้นขบวนเสบียง ปราบ 18 ตัว และเอาเอ็นปีศาจ 10 เส้นมาส่ง',
    objectives: [
      { type: 'kill', mob: 'dark_raider', count: 18 },
      { type: 'collect', item: 'ghoul_sinew', count: 10 },
    ],
    rewards: { exp: 26000, jobExp: 16000, aurum: 16000, items: [{ id: 'blessing_oil', qty: 1 }] },
  },
  q_daily_orcwatch: {
    id: 'q_daily_orcwatch', name: 'งานประจำวัน: สันเขา', giver: 'board', minLevel: 28,
    zone: 'orcwatch', repeatable: 'daily',
    desc: 'ส่งเขี้ยวออร์ค 20 ซี่ให้กองรักษาการณ์ (ทำได้ใหม่ทุกวัน)',
    objectives: [{ type: 'collect', item: 'orc_tooth', count: 20 }],
    rewards: { exp: 12000, jobExp: 7500, aurum: 4500 },
  },

  /* --- ห้องนิรภัยเยือกแข็ง (40-55) --------------------------------------- */
  q_frost_husks: {
    id: 'q_frost_husks', name: 'ความหนาวที่เดินได้', giver: 'board', minLevel: 42, zone: 'frostvault',
    desc: 'ซากเยือกแข็ง 24 ตัว และหยดน้ำตาน้ำแข็ง 8 หยดสำหรับงานช่าง',
    objectives: [
      { type: 'kill', mob: 'frost_husk', count: 24 },
      { type: 'collect', item: 'frost_tear', count: 8 },
    ],
    rewards: { exp: 42000, jobExp: 26000, aurum: 20000, items: [{ id: 'steel_ingot', qty: 5 }] },
  },
  q_wight_hunt: {
    id: 'q_wight_hunt', name: 'ผู้เฝ้าห้องนิรภัย', giver: 'board', minLevel: 46, zone: 'frostvault',
    desc: 'วิญญาณเยือกแข็ง 16 ตน ขวางทางเข้าห้องใน',
    objectives: [{ type: 'kill', mob: 'frost_wight', count: 16 }],
    rewards: { exp: 48000, jobExp: 30000, aurum: 26000, items: [{ id: 'blessing_oil', qty: 2 }] },
  },
  q_crimson_line: {
    id: 'q_crimson_line', name: 'แนวเลือดเดือด', giver: 'board', minLevel: 50, zone: 'frostvault',
    desc: 'ออร์คเลือดเดือด 14 ตัว และเขี้ยวออร์ค 20 ซี่ — กรูมส่งกำลังหนุนมาถึงที่นี่แล้ว',
    objectives: [
      { type: 'kill', mob: 'crimson_orc', count: 14 },
      { type: 'collect', item: 'orc_tooth', count: 20 },
    ],
    rewards: { exp: 60000, jobExp: 38000, aurum: 32000, items: [{ id: 'runed_whetstone', qty: 3 }] },
  },

  q_daily_frostvault: {
    id: 'q_daily_frostvault', name: 'งานประจำวัน: ห้องนิรภัย', giver: 'board', minLevel: 42,
    zone: 'frostvault', repeatable: 'daily',
    desc: 'ส่งน้ำตาน้ำแข็ง 10 หยดให้ช่างตีเหล็ก (ทำได้ใหม่ทุกวัน)',
    objectives: [{ type: 'collect', item: 'frost_tear', count: 10 }],
    rewards: { exp: 30000, jobExp: 19000, aurum: 8000 },
  },

  /* --- ห้องบัลลังก์วาล (56-70) ------------------------------------------- */
  q_vhaal_court: {
    id: 'q_vhaal_court', name: 'ราชสำนักที่ตายแล้ว', giver: 'board', minLevel: 60, zone: 'vhaal',
    desc: 'กวาดบริวารของวาล: โครงกระดูกพันธนาการ 30 ตัว และผู้เฝ้าสุสาน 12 ตน',
    objectives: [
      { type: 'kill', mob: 'gravebound', count: 30 },
      { type: 'kill', mob: 'crypt_warden', count: 12 },
    ],
    // the court is full of low-level bones: the pay follows the fight, not the zone
    rewards: { exp: 40000, jobExp: 25000, aurum: 24000, items: [{ id: 'shard_dawn', qty: 2 }] },
  },
  q_warlord: {
    id: 'q_warlord', name: 'หัวของจอมทัพ', giver: 'board', minLevel: 45, repeatable: 'weekly',
    zone: 'orcwatch',
    desc: 'ปราบจอมทัพออร์ค กรูม',
    objectives: [{ type: 'kill', mob: 'orc_warlord', count: 1 }],
    rewards: { exp: 40000, jobExp: 25000, aurum: 25000, items: [{ id: 'blessing_oil', qty: 2 }] },
  },
  q_vhaal: {
    id: 'q_vhaal', name: 'ราชันที่ไม่ยอมหลับ', giver: 'board', minLevel: 58, repeatable: 'weekly',
    zone: 'vhaal',
    desc: 'ปราบราชันโครงกระดูก วาล',
    objectives: [{ type: 'kill', mob: 'skeleton_king', count: 1 }],
    rewards: { exp: 90000, jobExp: 60000, aurum: 60000, items: [{ id: 'shard_dawn', qty: 5 }] },
  },

  /* ---------------- Lv60-70: the Sunken Reliquary line ----------------
     The last band used to hold one quest, which meant the last ten levels of
     a seventy level game had nothing to follow. This chain walks a player
     through the dungeon a floor at a time, and it is deliberately paid at
     roughly one to one and a half times the hunting it asks for: at this
     level a single fight is worth thousands, so the old three-times rule
     would hand over a level and a half per turn-in. The chain leads; the
     grind is still what levels you. */

  q_reliquary_rumour: {
    id: 'q_reliquary_rumour', name: 'ข่าวลือจากใต้น้ำแข็ง', giver: 'board', minLevel: 60,
    zone: 'reliquary1',
    desc: 'ใต้ห้องนิรภัยมีประตูที่เปิดได้เฉพาะตอนมีเพื่อน — เข้าไปดูว่ามีอะไรอยู่ข้างใน ' +
      'กวาดทหารยามหีบศพ 8 ตน และเงาระเบียง 10 ตน',
    objectives: [
      { type: 'kill', mob: 'reliquary_sentinel', count: 8 },
      { type: 'kill', mob: 'reliquary_shade', count: 10 },
    ],
    rewards: { exp: 100000, jobExp: 62000, aurum: 34000, items: [{ id: 'greater_salve', qty: 10 }] },
  },
  q_reliquary_seals: {
    id: 'q_reliquary_seals', name: 'ตราที่ยังไม่แตก', giver: 'smith', minLevel: 61,
    zone: 'reliquary1',
    desc: 'ช่างตีเหล็กบอร์กอยากได้ตราผนึกหีบศพ 8 อัน เขาบอกว่าหลอมเป็นน้ำมันศักดิ์สิทธิ์ได้',
    objectives: [{ type: 'collect', item: 'reliquary_seal', count: 8 }],
    rewards: { exp: 64000, jobExp: 40000, aurum: 30000, items: [{ id: 'blessing_oil', qty: 1 }] },
  },
  q_reliquary_choir: {
    id: 'q_reliquary_choir', name: 'เสียงสวดที่ไม่มีคนสวด', giver: 'board', minLevel: 63,
    zone: 'reliquary2',
    desc: 'ชั้นสองมีเสียงร้องดังออกมาตลอดเวลา ทั้งที่ไม่มีใครอยู่ — ปิดปากคณะขับร้องเถ้า 12 ตน ' +
      'และทุบสมอหลุมศพ 5 ตัวที่ตรึงพวกมันไว้',
    objectives: [
      { type: 'kill', mob: 'reliquary_choir', count: 12 },
      { type: 'kill', mob: 'reliquary_anchor', count: 5 },
    ],
    rewards: { exp: 118000, jobExp: 74000, aurum: 42000, items: [{ id: 'runed_whetstone', qty: 3 }] },
  },
  q_reliquary_warden: {
    id: 'q_reliquary_warden', name: 'ผู้ที่ยังเฝ้าอยู่', giver: 'board', minLevel: 65,
    zone: 'reliquary3', repeatable: 'weekly',
    desc: 'ปราบผู้เฝ้าหีบศพที่ชั้นล่างสุด — ไปคนเดียวไม่ได้ และสัปดาห์หนึ่งได้รางวัลครั้งเดียว',
    objectives: [{ type: 'kill', mob: 'reliquary_warden', count: 1 }],
    rewards: { exp: 110000, jobExp: 70000, aurum: 55000, items: [{ id: 'reliquary_seal', qty: 2 }] },
  },
  q_dawn_crown: {
    id: 'q_dawn_crown', name: 'มงกุฎที่ยังไม่มีเจ้าของ', giver: 'oracle', minLevel: 67,
    zone: 'reliquary3',
    desc: 'ผู้ดูแลศาลบอกว่าหีบศพจมกับศาลรุ่งอรุณเคยเป็นที่เดียวกัน — เอาตราผนึก 12 อัน ' +
      'กับเศษรุ่งอรุณ 6 ชิ้นมาให้ แล้วจะเล่าให้ฟัง',
    objectives: [
      { type: 'collect', item: 'reliquary_seal', count: 12 },
      { type: 'collect', item: 'shard_dawn', count: 6 },
    ],
    rewards: { exp: 140000, jobExp: 88000, aurum: 70000, items: [{ id: 'blessing_oil', qty: 3 }] },
  },
  q_daily_reliquary: {
    id: 'q_daily_reliquary', name: 'งานประจำวัน: หีบศพจม', giver: 'board', minLevel: 62,
    zone: 'reliquary1', repeatable: 'daily',
    desc: 'กวาดทางเดินชั้นหนึ่งให้โล่ง: อะไรก็ได้ในระเบียงคด 15 ตน',
    objectives: [{ type: 'kill', mob: 'reliquary_shade', count: 15 }],
    rewards: { exp: 34000, jobExp: 21000, aurum: 11000, items: [{ id: 'greater_salve', qty: 4 }] },
  },
};
