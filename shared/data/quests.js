import { MONSTERS } from './monsters.js';
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
//   Lv 11-20 Amberwood    1.2k-3k, the bosses 3k-6k / 900

export const QUESTS = {
  q_first_blood: {
    id: 'q_first_blood', name: 'ก้าวแรกในโคลน', giver: 'board', minLevel: 1,
    zone: 'greenmire',
    desc: 'ล่าสไลม์น้ำ 10 ตัวในทุ่งกรีนไมร์',
    objectives: [{ type: 'kill', mob: 'blue_slime', count: 10 }],
    rewards: { exp: 120, jobExp: 80, aurum: 300, items: [{ id: 'hp_potion_s', qty: 5 }] },
  },
  q_herbalist: {
    id: 'q_herbalist', name: 'ฝากซื้อสมุนไพร', giver: 'board', minLevel: 3,
    zone: 'greenmire',
    desc: 'สไลม์น้ำกัดกินแปลงสมุนไพรของนักบวชอีริน ล่าให้ได้ 15 ตัว',
    objectives: [{ type: 'kill', mob: 'blue_slime', count: 15 }],
    rewards: { exp: 200, jobExp: 140, aurum: 450 },
  },
  q_job_path: {
    id: 'q_job_path', name: 'เลือกทางของตัวเอง', giver: 'trainer', minLevel: 1,
    zone: 'artaris',
    desc: 'ไปถึงเลเวล 10 แล้วไปหาปรมาจารย์เอเลนเดียในปราสาทอาร์ทาริสเพื่อเลือกอาชีพ',
    objectives: [{ type: 'level', count: 10 }],
    rewards: { exp: 300, jobExp: 200, aurum: 500, unlock: 'jobChange' },
  },

  q_first_refine: {
    id: 'q_first_refine', name: 'บทเรียนแรกของการตีบวก', giver: 'smith', minLevel: 12, zone: 'artaris',
    desc: 'ตีบวกอุปกรณ์ชิ้นไหนก็ได้ให้ถึง +4 แล้วกลับมาอวดบอร์ก',
    objectives: [{ type: 'refine', count: 4 }],
    rewards: { exp: 2000, jobExp: 1200, aurum: 2000 },
  },

  // Amberwood, over Greenmire's south gate: a hunt per creature, harder
  // going east, then its two bosses
  q_amber_bridge: {
    id: 'q_amber_bridge', name: 'ข้ามสะพานตะวันตก', giver: 'board', minLevel: 11, zone: 'amberwood',
    desc: 'สไลม์อำพันยึดทุ่งหญ้าหลังสะพานหินฝั่งตะวันตกของป่าอำพัน ล่าให้ได้ 20 ตัว',
    objectives: [{ type: 'kill', mob: 'amber_slime', count: 20 }],
    rewards: { exp: 1400, jobExp: 900, aurum: 1200, items: [{ id: 'hp_potion_s', qty: 10 }] },
  },
  q_crimson_caps: {
    id: 'q_crimson_caps', name: 'เห็ดใบแดง', giver: 'board', minLevel: 12, zone: 'amberwood',
    desc: 'เห็ดใบแดงงอกเต็มทางเดินฝั่งเหนือ เก็บกวาดให้ได้ 20 ต้น',
    objectives: [{ type: 'kill', mob: 'crimson_cap', count: 20 }],
    rewards: { exp: 1700, jobExp: 1000, aurum: 1400 },
  },
  q_autumn_crawlers: {
    id: 'q_autumn_crawlers', name: 'หนอนกินใบไม้ร่วง', giver: 'board', minLevel: 13, zone: 'amberwood',
    desc: 'หนอนใบไม้ร่วงกัดกินลานโล่งทั้งสองฝั่ง ปราบให้ได้ 20 ตัว',
    objectives: [{ type: 'kill', mob: 'autumn_crawler', count: 20 }],
    rewards: { exp: 2000, jobExp: 1200, aurum: 1600 },
  },
  q_amber_hornets: {
    id: 'q_amber_hornets', name: 'รังแตนเหนือถนนกลาง', giver: 'board', minLevel: 15, zone: 'amberwood',
    desc: 'แตนอำพันไล่ต่อยทุกคนที่เดินผ่านถนนกลางและทางขึ้นบันได ปราบให้ได้ 25 ตัว',
    objectives: [{ type: 'kill', mob: 'amber_hornet', count: 25 }],
    rewards: { exp: 2800, jobExp: 1700, aurum: 2200 },
  },
  q_ember_boars: {
    id: 'q_ember_boars', name: 'หมูป่าเปลวแดง', giver: 'board', minLevel: 16, zone: 'amberwood',
    desc: 'หมูป่าเปลวแดงพุ่งชนเกวียนบนถนนใต้ ล่าให้ได้ 20 ตัว',
    objectives: [{ type: 'kill', mob: 'ember_boar', count: 20 }],
    rewards: { exp: 3000, jobExp: 1800, aurum: 2400 },
  },
  q_dusk_ruins: {
    id: 'q_dusk_ruins', name: 'แสงสนธยาในซากเสา', giver: 'board', minLevel: 18, zone: 'amberwood',
    desc: 'ภูตสนธยาวนเวียนรอบซากเสาฝั่งตะวันออก ดับให้ได้ 25 ดวง',
    objectives: [{ type: 'kill', mob: 'dusk_wisp', count: 25 }],
    rewards: { exp: 3800, jobExp: 2300, aurum: 3000 },
  },
  q_ember_alpha: {
    id: 'q_ember_alpha', name: 'จ่าฝูงบนที่ราบสูง', giver: 'board', minLevel: 18, zone: 'amberwood',
    desc: 'ขึ้นบันไดหินไปที่ราบสูงทางเหนือ แล้วล้มจ่าฝูงหมาป่าเพลิง',
    objectives: [{ type: 'kill', mob: 'ember_alpha', count: 1 }],
    rewards: { exp: 1800, jobExp: 1100, aurum: 3000 },
  },
  q_amber_warden: {
    id: 'q_amber_warden', name: 'ผู้พิทักษ์ป่าอำพัน', giver: 'board', minLevel: 20, zone: 'amberwood',
    desc: 'ข้ามสะพานโค้งไปลานหินร้าง แล้วล้มผู้พิทักษ์ป่าอำพัน ชวนเพื่อนไปด้วยก็ดี',
    objectives: [{ type: 'kill', mob: 'amber_warden', count: 1 }],
    rewards: { exp: 5000, jobExp: 3000, aurum: 6000, items: [{ id: 'gacha_ticket', qty: 1 }] },
  },
  q_daily_amberwood: {
    id: 'q_daily_amberwood', name: 'งานประจำวัน: ป่าอำพัน', giver: 'board', minLevel: 12,
    zone: 'amberwood', repeatable: 'daily',
    desc: 'ล่าหมูป่าเปลวแดง 10 ตัว และแตนอำพัน 10 ตัว',
    objectives: [{ type: 'kill', mob: 'ember_boar', count: 10 }, { type: 'kill', mob: 'amber_hornet', count: 10 }],
    rewards: { exp: 1000, jobExp: 600, aurum: 900 },
  },
};

// The monsters come back one sheet at a time. A quest that asks for one not
// back yet is held out until it is, rather than offered and never finishable.
export const HELD_QUESTS = {};
for (const [id, q] of Object.entries(QUESTS)) {
  if (q.objectives.some((o) => o.type === 'kill' && !MONSTERS[o.mob])) {
    HELD_QUESTS[id] = q;
    delete QUESTS[id];
  }
}
