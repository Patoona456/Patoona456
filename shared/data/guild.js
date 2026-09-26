// Guild growth: levels, the passive skills they unlock, and the weekly goals
// that feed them.
//
// Everything here is deliberately small. A guild's reward is being in one -
// a few percent that every member carries, a bigger roster - not a second
// progression track that makes guildless players second-class. Nothing here
// pays aurum: the economy has one faucet per activity and this is not one.

export const GUILD_MAX_LEVEL = 10;

/** Guild EXP needed to go from `level` to `level + 1`. */
export const guildExpToNext = (level) => (level >= GUILD_MAX_LEVEL ? 0 : Math.round(4000 * level ** 1.7));

/** A guild's roster grows with it. */
export const guildCapacity = (level) => 30 + 2 * (Math.max(1, level) - 1);

/** Guild EXP a member's kill is worth: tougher monsters count for more. */
export const killGuildExp = (monsterLevel) => Math.max(1, Math.round(monsterLevel / 6));

/**
 * Passive skills, unlocked by level and carried by every member.
 * `pct` values multiply the named stat; `flat` values add to it.
 */
export const GUILD_SKILLS = [
  { id: 'hp', level: 2, nameTh: 'ใจเดียวกัน', desc: 'HP สูงสุด +3%', pct: { maxHp: 3 } },
  { id: 'def', level: 3, nameTh: 'โล่ของพวกพ้อง', desc: 'ป้องกัน +3%', pct: { def: 3 } },
  { id: 'atk', level: 5, nameTh: 'ดาบคู่ใจ', desc: 'พลังโจมตีและพลังเวทย์ +3%', pct: { atk: 3, matk: 3 } },
  { id: 'exp', level: 6, nameTh: 'ความรุ่งเรือง', desc: 'EXP ที่ได้ +3%', exp: 3 },
  { id: 'crit', level: 8, nameTh: 'คมเงา', desc: 'คริติคอล +2', flat: { crit: 2 } },
  { id: 'mdef', level: 10, nameTh: 'ผนึกรูน', desc: 'ต้านเวทย์ +5%', pct: { mdef: 5 } },
];

export const skillsAt = (level) => GUILD_SKILLS.filter((s) => (level ?? 0) >= s.level);

/** This week's shared goals. Everyone's contribution counts toward one bar. */
export const GUILD_QUESTS = [
  { id: 'hunt', nameTh: 'กำจัดมอนสเตอร์', need: 500, exp: 3000 },
  { id: 'donate', nameTh: 'บริจาคเข้าคลังกิลด์ (ออรัม)', need: 50000, exp: 3000 },
  { id: 'war', nameTh: 'เข้าร่วมสงครามกิลด์', need: 1, exp: 2500 },
];

export const EMBLEMS = ['lion', 'eagle', 'spirit', 'tree', 'skull'];
