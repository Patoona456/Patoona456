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
// Bands (one-time / daily): Lv 1-9 in Greenmire, 300-900 / 250. Each new
// map brings its own band.

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
