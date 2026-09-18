// Quests. Deliberately few and chunky: they are the *other* Aurum faucet,
// and they teach a system rather than padding a kill counter.

export const QUESTS = {
  q_first_blood: {
    id: 'q_first_blood', name: 'ก้าวแรกในโคลน', giver: 'board', minLevel: 1,
    desc: 'ล่าสไลม์โคลน 10 ตัวในทุ่งกรีนไมร์',
    objectives: [{ type: 'kill', mob: 'mire_slime', count: 10 }],
    rewards: { exp: 120, jobExp: 80, aurum: 300, items: [{ id: 'lesser_salve', qty: 5 }] },
  },
  q_herbalist: {
    id: 'q_herbalist', name: 'ฝากซื้อสมุนไพร', giver: 'board', minLevel: 3,
    desc: 'เก็บมัดสมุนไพร 15 ชิ้นมาส่งนักบวชอีริน',
    objectives: [{ type: 'collect', item: 'herb_bundle', count: 15 }],
    rewards: { exp: 200, jobExp: 140, aurum: 450, items: [{ id: 'herbal_stew', qty: 3 }] },
  },
  q_job_path: {
    id: 'q_job_path', name: 'เลือกทางของตัวเอง', giver: 'trainer', minLevel: 1,
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
    desc: 'ดวงไฟเร่ร่อนลอยเร็วและหนีเก่ง ไล่ดับให้ได้ 15 ดวง',
    objectives: [{ type: 'kill', mob: 'ember_wisp', count: 15 }],
    rewards: { exp: 900, jobExp: 700, aurum: 800, skillPoints: 1,
      items: [{ id: 'bronze_shortblade', qty: 1 }, { id: 'greater_salve', qty: 5 }] },
  },
  q_trial_marksman: {
    id: 'q_trial_marksman', name: 'ยิงจากที่ไกล', giver: 'trainer', minLevel: 10, path: 'marksman',
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
    desc: 'กำจัดโจรสอดแนม 20 ตัว และนำเชือกขาดรุ่ย 10 เส้นมาเป็นหลักฐาน',
    objectives: [
      { type: 'kill', mob: 'bandit_scout', count: 20 },
      { type: 'collect', item: 'bandit_rope', count: 10 },
    ],
    rewards: { exp: 2600, jobExp: 1600, aurum: 2500, items: [{ id: 'leather_vest', qty: 1 }] },
  },
  q_gravebound: {
    id: 'q_gravebound', name: 'เสียงจากสุสาน', giver: 'board', minLevel: 18,
    desc: 'ปราบโครงกระดูกพันธนาการ 30 ตัว',
    objectives: [{ type: 'kill', mob: 'gravebound', count: 30 }],
    rewards: { exp: 8000, jobExp: 5000, aurum: 6000, items: [{ id: 'runed_whetstone', qty: 1 }] },
  },
  q_forge_lesson: {
    id: 'q_forge_lesson', name: 'บทเรียนช่างเหล็ก', giver: 'smith', minLevel: 10,
    desc: 'คราฟต์แท่งเหล็กกล้า 3 แท่ง แล้วนำกลับมาให้บอร์ก',
    objectives: [{ type: 'collect', item: 'steel_ingot', count: 3 }],
    rewards: { exp: 1200, jobExp: 900, aurum: 1200, items: [{ id: 'blessing_oil', qty: 1 }] },
  },
  q_warlord: {
    id: 'q_warlord', name: 'หัวของจอมทัพ', giver: 'board', minLevel: 45, repeatable: 'weekly',
    desc: 'ปราบจอมทัพออร์ค กรูม',
    objectives: [{ type: 'kill', mob: 'orc_warlord', count: 1 }],
    rewards: { exp: 40000, jobExp: 25000, aurum: 25000, items: [{ id: 'blessing_oil', qty: 2 }] },
  },
  q_vhaal: {
    id: 'q_vhaal', name: 'ราชันที่ไม่ยอมหลับ', giver: 'board', minLevel: 58, repeatable: 'weekly',
    desc: 'ปราบราชันโครงกระดูก วาล',
    objectives: [{ type: 'kill', mob: 'skeleton_king', count: 1 }],
    rewards: { exp: 90000, jobExp: 60000, aurum: 60000, items: [{ id: 'shard_dawn', qty: 5 }] },
  },
};
