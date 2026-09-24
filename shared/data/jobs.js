// Emberfall job tree. Ragnarok-shaped (Novice -> 1st -> 2nd) but our own
// classes, our own numbers. Everything here is data: adding a job is a patch.

export const JOBS = {
  novice: {
    id: 'novice', tier: 0, name: 'Novice', nameTh: 'ผู้แรกเริ่ม',
    desc: 'ยังไม่เลือกทาง สถิติกลางๆ ทุกด้าน', hpMod: 0.9, spMod: 0.85, speedMod: 1,
    weapons: ['sword', 'dagger', 'wand'], next: ['vanguard', 'wayfarer', 'marksman', 'runecaster', 'warden'],
    // the first choice is a base level, not a job level: everyone reaches it
    advance: { level: 10 },
    skills: ['first_aid', 'shove'],
  },
  vanguard: {
    id: 'vanguard', tier: 1, name: 'Vanguard', nameTh: 'ทหารหน้า',
    desc: 'แนวหน้า เลือดหนา ถือดาบ-หอกและโล่ ดึงศัตรูและกันความเสียหายให้ทีม',
    pitch: 'ยืนหน้าสุด กินความเสียหายแทนทีม แล้วตอบกลับด้วยหอกและโล่',
    play: 'เลือดหนาที่สุดในเกม ดึงศัตรูด้วย "ยั่วยุ" แล้วยืนรับด้วย "ท่าตั้งรับ" — ตีไม่แรงที่สุดแต่ตายยากที่สุด',
    forWho: 'ชอบยืนกลางวง เล่นเป็นคนเปิดหน้าให้เพื่อน',
    starterKit: [],
    trial: 'q_trial_vanguard',
    hpMod: 1.35, spMod: 0.7, speedMod: 0.98,
    weapons: ['sword', 'spear', 'axe'], growth: { str: 3, vit: 3, dex: 1 },
    next: ['bulwark', 'ravager'], advance: { level: 45, jobLevel: 40 }, jobLevelToAdvance: 45,
    skills: ['cleave', 'bulwark_stance', 'taunt', 'skewer', 'iron_will'],
  },
  wayfarer: {
    id: 'wayfarer', tier: 1, name: 'Wayfarer', nameTh: 'นักเดินเงา',
    desc: 'เร็ว หลบเก่ง คริติคอลสูง ถนัดมีดคู่และการลอบโจมตีจากด้านหลัง',
    pitch: 'เร็ว ลื่น หายตัว แล้วโผล่หลังศัตรูพร้อมมีดสองเล่ม',
    play: 'พึ่งการหลบและคริติคอล ไม่ใช่เลือด ใช้ "ก้าวเงา" เข้าออกวง และ "แทงหลัง" ทำดาเมจก้อนใหญ่',
    forWho: 'ชอบดาเมจแรงต่อครั้ง แลกกับตัวบาง ต้องขยับตลอด',
    starterKit: [],
    trial: 'q_trial_wayfarer',
    hpMod: 1.0, spMod: 0.85, speedMod: 1.08,
    weapons: ['dagger', 'throwing'], growth: { agi: 3, str: 2, luk: 2 },
    next: ['nightblade', 'trickster'], advance: { level: 45, jobLevel: 40 }, jobLevelToAdvance: 45,
    skills: ['backstab', 'shadow_step', 'venom_edge', 'evasion', 'pilfer'],
  },
  marksman: {
    id: 'marksman', tier: 1, name: 'Marksman', nameTh: 'พรานธนู',
    desc: 'ยิงไกล ดาเมจต่อนัดสูง ต้องใช้ลูกธนูเป็นทรัพยากร',
    pitch: 'จบเกมตั้งแต่ศัตรูยังเดินมาไม่ถึง',
    play: 'ยิงไกลที่สุด ดาเมจต่อนัดสูง แต่ลูกธนูคือทรัพยากรจริง ต้องซื้อและพกให้พอ',
    forWho: 'ชอบยืนหลัง คุมระยะ และวางแผนก่อนยิง',
    starterKit: [],
    trial: 'q_trial_marksman',
    hpMod: 1.05, spMod: 0.9, speedMod: 1.02,
    weapons: ['bow', 'throwing'], growth: { dex: 3, agi: 2, str: 1 },
    next: ['sharpshooter', 'beastcaller'], advance: { level: 45, jobLevel: 40 }, jobLevelToAdvance: 45,
    skills: ['aimed_shot', 'volley', 'pinning_arrow', 'hawk_eye', 'ember_arrow'],
  },
  runecaster: {
    id: 'runecaster', tier: 1, name: 'Runecaster', nameTh: 'นักร่ายรูน',
    desc: 'เวทย์โจมตีหลายธาตุ ดาเมจสูงแต่ตัวบาง ต้องจัดการมานาให้ดี',
    pitch: 'สามธาตุในมือเดียว ระเบิดทั้งกลุ่มได้ แต่โดนสองทีก็ล้ม',
    play: 'ดาเมจกลุ่มสูงสุดในเกม เล่นกับตารางธาตุ (ไฟ/น้ำแข็ง/สายฟ้า) และต้องจัดการมานาเอง',
    forWho: 'ชอบคิดเรื่องธาตุและตำแหน่งยืน มากกว่าการกดรัว',
    starterKit: [],
    trial: 'q_trial_runecaster',
    hpMod: 0.8, spMod: 1.45, speedMod: 0.98,
    weapons: ['staff', 'wand'], growth: { int: 4, dex: 2 },
    next: ['arcanist', 'stormsinger'], advance: { level: 45, jobLevel: 40 }, jobLevelToAdvance: 45,
    skills: ['ember_bolt', 'frost_nail', 'storm_sigil', 'mana_font', 'runic_ward'],
  },
  warden: {
    id: 'warden', tier: 1, name: 'Warden', nameTh: 'ผู้พิทักษ์',
    desc: 'สายสนับสนุน ฮีล บัฟ และเวทย์แสงที่แรงมากกับอันเดด',
    pitch: 'คนที่ทำให้ทั้งปาร์ตี้ไม่ตาย และเป็นฝันร้ายของอันเดด',
    play: 'ฮีล บัฟ ล้างสถานะ และเวทย์แสงที่แรงเป็นพิเศษกับอันเดด เล่นคนเดียวก็ได้ แต่เปล่งประกายในปาร์ตี้',
    forWho: 'ชอบดูแลคนอื่น และอยากเป็นที่ต้องการของทุกปาร์ตี้',
    starterKit: [],
    trial: 'q_trial_warden',
    hpMod: 1.1, spMod: 1.25, speedMod: 1,
    weapons: ['staff', 'wand', 'knuckle'], growth: { int: 3, vit: 2, dex: 1 },
    next: ['hierophant', 'oathkeeper'], advance: { level: 45, jobLevel: 40 }, jobLevelToAdvance: 45,
    skills: ['mend', 'radiant_smite', 'blessing', 'sanctuary', 'purge'],
  },

  // --- tier 2 -----------------------------------------------------------
  bulwark: {
    id: 'bulwark', tier: 2, name: 'Bulwark', nameTh: 'กำแพงเหล็ก', from: 'vanguard',
    desc: 'แท็งก์เต็มตัว ลดดาเมจให้ทีมและสะท้อนความเสียหาย',
    hpMod: 1.6, spMod: 0.8, speedMod: 0.95, weapons: ['sword', 'spear', 'axe'],
    growth: { vit: 4, str: 2 }, next: [],
    skills: ['shield_crush', 'aegis', 'thorn_guard', 'unbreakable'],
  },
  ravager: {
    id: 'ravager', tier: 2, name: 'Ravager', nameTh: 'ผู้บ้าคลั่ง', from: 'vanguard',
    desc: 'ทิ้งการป้องกัน แลกกับดาเมจมหาศาลและเลือดที่ดูดกลับ',
    hpMod: 1.45, spMod: 0.7, speedMod: 1.02, weapons: ['greatsword', 'axe', 'spear'],
    growth: { str: 4, vit: 2 }, next: [],
    skills: ['bloodthirst', 'whirlwind', 'reckless_charge'],
  },
  nightblade: {
    id: 'nightblade', tier: 2, name: 'Nightblade', nameTh: 'ใบมีดราตรี', from: 'wayfarer',
    desc: 'ล่องหน ลอบสังหาร ดาเมจแตกตัวเมื่อโจมตีจากเงา',
    hpMod: 1.05, spMod: 0.95, speedMod: 1.12, weapons: ['dagger', 'sword'],
    growth: { agi: 4, luk: 2 }, next: [],
    skills: ['cloak', 'mortal_strike', 'grim_harvest'],
  },
  trickster: {
    id: 'trickster', tier: 2, name: 'Trickster', nameTh: 'จอมกล', from: 'wayfarer',
    desc: 'ดีบัฟ ขโมย และควบคุมสนามรบด้วยกับดัก',
    hpMod: 1.0, spMod: 1.05, speedMod: 1.1, weapons: ['dagger', 'throwing', 'bow'],
    growth: { luk: 4, agi: 2 }, next: [],
    skills: ['cutpurse_strike', 'smoke_bomb', 'snare_trap', 'sleight'],
  },
  sharpshooter: {
    id: 'sharpshooter', tier: 2, name: 'Sharpshooter', nameTh: 'มือแม่นปืนธนู', from: 'marksman',
    desc: 'ยิงไกลสุดในเกม ทะลุเป็นแนวและคริติคอลระยะไกล',
    hpMod: 1.05, spMod: 0.95, speedMod: 1.02, weapons: ['bow', 'throwing'],
    growth: { dex: 4, agi: 2 }, next: [],
    skills: ['piercing_shot', 'rain_of_arrows', 'steady_aim'],
  },
  beastcaller: {
    id: 'beastcaller', tier: 2, name: 'Beastcaller', nameTh: 'ผู้เรียกสัตว์', from: 'marksman',
    desc: 'สู้คู่กับสัตว์เลี้ยง แบ่งเบาดาเมจและช่วยดึงศัตรู',
    hpMod: 1.15, spMod: 1.0, speedMod: 1.04, weapons: ['bow', 'spear'],
    growth: { dex: 3, vit: 2, luk: 1 }, next: [],
    skills: ['call_companion', 'wild_bond', 'ember_arrow'],
  },
  arcanist: {
    id: 'arcanist', tier: 2, name: 'Arcanist', nameTh: 'จอมเวทย์รูน', from: 'runecaster',
    desc: 'เวทย์วงกว้าง ร่ายนาน แต่เคลียร์ฝูงได้เร็วที่สุด',
    hpMod: 0.85, spMod: 1.6, speedMod: 0.96, weapons: ['staff', 'wand'],
    growth: { int: 5, dex: 1 }, next: [],
    skills: ['meteor_rune', 'glacial_field', 'rune_overload'],
  },
  stormsinger: {
    id: 'stormsinger', tier: 2, name: 'Stormsinger', nameTh: 'ผู้ขับสายฟ้า', from: 'runecaster',
    desc: 'เวทย์สายฟ้าต่อเนื่อง เร็ว ร่ายสั้น เด้งใส่หลายเป้า',
    hpMod: 0.9, spMod: 1.5, speedMod: 1.02, weapons: ['wand', 'staff'],
    growth: { int: 4, agi: 2 }, next: [],
    skills: ['chain_spark', 'wind_cutter', 'tempest_veil', 'thunder_step'],
  },
  hierophant: {
    id: 'hierophant', tier: 2, name: 'Hierophant', nameTh: 'สาธุคุณ', from: 'warden',
    desc: 'ฮีลเลอร์สูงสุด ชุบชีวิต และบัฟทั้งปาร์ตี้',
    hpMod: 1.15, spMod: 1.4, speedMod: 1, weapons: ['staff', 'wand'],
    growth: { int: 4, vit: 2 }, next: [],
    skills: ['dawnfire', 'greater_mend', 'revive', 'aura_of_dawn'],
  },
  oathkeeper: {
    id: 'oathkeeper', tier: 2, name: 'Oathkeeper', nameTh: 'ผู้ถือคำสาบาน', from: 'warden',
    desc: 'สายตีผสมแสง ทนทาน เหมาะกับดันเจี้ยนอันเดด',
    hpMod: 1.3, spMod: 1.1, speedMod: 0.99, weapons: ['sword', 'knuckle', 'wand'],
    growth: { str: 3, vit: 2, int: 2 }, next: [],
    skills: ['oath_strike', 'earth_spike', 'consecrate', 'shield_of_vows'],
  },
};

export const STARTING_STATS = { str: 5, agi: 5, vit: 5, int: 5, dex: 5, luk: 5 };

export function jobOf(id) { return JOBS[id] ?? JOBS.novice; }

export function jobChain(id) {
  const chain = [];
  let cur = JOBS[id];
  while (cur) { chain.unshift(cur); cur = cur.from ? JOBS[cur.from] : (cur.tier > 0 ? JOBS.novice : null); }
  return chain;
}

/** Every skill a character of this job may learn (own + inherited). */
export function availableSkills(jobId) {
  const out = [];
  for (const j of jobChain(jobId)) for (const s of j.skills ?? []) if (!out.includes(s)) out.push(s);
  return out;
}
