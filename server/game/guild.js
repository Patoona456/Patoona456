// Guilds.
//
// A party lasts an evening: you form one to clear the Reliquary, the weekly
// lockout fires, and everyone goes home. A guild is the thing that makes the
// same people show up again on Thursday, which is what an MMO actually runs
// on. So unlike parties - which live in a Map and evaporate on restart -
// guilds are written to the database and survive a deploy.
//
// Three things here are deliberate and worth defending:
//
//   Ranks gate the vault, not the chat. Anyone can talk; only trusted ranks
//   can take. A guild vault without withdrawal limits is a bag that the first
//   stranger empties, and one such incident kills a guild.
//
//   The vault moves goods, it does not make them. Nothing is created on
//   deposit or withdrawal, so it cannot inflate anything. It is a convenience
//   and a trust exercise, never a faucet.
//
//   Founding costs money and upkeep keeps costing it. That is the point: a
//   guild is a standing drain on the richest players in the game, which is
//   exactly where a scarce-currency economy wants a sink.
import { db, markDirty } from '../persistence.js';
import { ITEMS } from '../../shared/data/items.js';
import { burn } from './economy.js';
import * as Siege from './siege.js';
import { GUILD_MAX_LEVEL, guildExpToNext, guildCapacity, killGuildExp, GUILD_SKILLS, skillsAt, GUILD_QUESTS, EMBLEMS } from '../../shared/data/guild.js';

/** Founding fee, and what it costs to keep the doors open each week. */
export const GUILD_COST = 250_000;
export const GUILD_UPKEEP = 40_000;
export const UPKEEP_PERIOD = 7 * 86400000;
export const MAX_MEMBERS = guildCapacity(GUILD_MAX_LEVEL);
const capOf = (g) => guildCapacity(g.level ?? 1);
export const VAULT_SLOTS = 200;

/**
 * Ranks, least to most trusted. `take` is the one that matters - it is the
 * difference between a vault and a free-for-all.
 */
export const RANKS = [
  { id: 'recruit', nameTh: 'ผู้มาใหม่', take: 0, invite: false, kick: false, manage: false },
  { id: 'member', nameTh: 'สมาชิก', take: 3, invite: false, kick: false, manage: false },
  { id: 'veteran', nameTh: 'รุ่นพี่', take: 10, invite: true, kick: false, manage: false },
  { id: 'officer', nameTh: 'ผู้ช่วยหัวหน้า', take: 30, invite: true, kick: true, manage: false },
  { id: 'leader', nameTh: 'หัวหน้ากิลด์', take: Infinity, invite: true, kick: true, manage: true },
];
const rankOf = (id) => RANKS.find((r) => r.id === id) ?? RANKS[0];
const rankIndex = (id) => Math.max(0, RANKS.findIndex((r) => r.id === id));

const guilds = () => (db.guilds ??= {});
export const byId = (id) => guilds()[String(id)] ?? null;

/** The guild a character belongs to, or null. */
export function of(p) {
  const id = p?.record?.guild;
  return id ? byId(id) : null;
}

function member(g, charId) {
  return g?.members?.find((m) => String(m.charId) === String(charId)) ?? null;
}

/** A day-bucket key, so "taken this week" resets on a schedule everyone shares. */
function weekKey(at = Date.now()) {
  const d = new Date(at);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------- lifecycle */

export function create(world, p, name) {
  if (p.record.guild) return { error: 'อยู่ในกิลด์แล้ว' };
  const clean = String(name ?? '').trim().slice(0, 24);
  if (clean.length < 3) return { error: 'ชื่อกิลด์ต้องยาวอย่างน้อย 3 ตัวอักษร' };
  if (Object.values(guilds()).some((g) => g.name.toLowerCase() === clean.toLowerCase())) {
    return { error: 'ชื่อนี้มีกิลด์ใช้แล้ว' };
  }
  if (p.record.aurum < GUILD_COST) return { error: `ต้องใช้ ${GUILD_COST.toLocaleString()} ออรัมในการก่อตั้ง` };

  p.record.aurum -= GUILD_COST;
  burn(world, GUILD_COST, 'guild-found');

  const id = 'g' + (db.nextGuildId = (db.nextGuildId ?? 0) + 1);
  guilds()[id] = {
    id, name: clean, leader: String(p.record.id), created: Date.now(),
    members: [{ charId: String(p.record.id), name: p.name, rank: 'leader', joined: Date.now() }],
    vault: [], aurum: 0, notice: '', level: 1, exp: 0, emblem: 'lion', week: null, goals: {},
    upkeepDue: Date.now() + UPKEEP_PERIOD, inDebt: false,
    taken: {},                          // charId -> { week, n } withdrawal budget
  };
  p.record.guild = id;
  markDirty();
  return { ok: true, id };
}

export function invite(world, p, targetName) {
  const g = of(p);
  if (!g) return { error: 'ยังไม่ได้อยู่กิลด์' };
  if (!rankOf(member(g, p.record.id)?.rank).invite) return { error: 'ยศของคุณชวนคนเข้ากิลด์ไม่ได้' };
  if (g.members.length >= capOf(g)) return { error: `กิลด์เต็ม (${capOf(g)} คน)` };

  const target = world.playerByName(targetName);
  if (!target) return { error: 'ไม่พบผู้เล่นคนนี้ (ต้องออนไลน์อยู่)' };
  if (target.record.guild) return { error: 'ผู้เล่นคนนี้อยู่กิลด์อื่นแล้ว' };

  target.guildInvite = { guild: g.id, from: p.name, at: Date.now() };
  target.conn?.send({ ...state(world, target), invite: { from: p.name, guild: g.name, at: target.guildInvite.at } });
  return { ok: true };
}

export function accept(world, p) {
  const inv = p.guildInvite;
  if (!inv || Date.now() - inv.at > 120000) return { error: 'ไม่มีคำเชิญค้างอยู่' };
  if (p.record.guild) return { error: 'อยู่ในกิลด์แล้ว' };
  const g = byId(inv.guild);
  if (!g) return { error: 'กิลด์นี้ถูกยุบไปแล้ว' };
  if (g.members.length >= capOf(g)) return { error: 'กิลด์เต็ม' };

  g.members.push({ charId: String(p.record.id), name: p.name, rank: 'recruit', joined: Date.now() });
  p.record.guild = g.id;
  p.guildInvite = null;
  markDirty();
  announce(world, g, `${p.name} เข้าร่วมกิลด์แล้ว`);
  log(g, `${p.name} เข้าร่วมกิลด์`, 'join');
  p.recompute?.();                       // the guild's skills come with the door key
  return { ok: true, id: g.id };
}

export function decline(p) {
  p.guildInvite = null;
  return { ok: true };
}

export function leave(world, p) {
  const g = of(p);
  if (!g) return { error: 'ยังไม่ได้อยู่กิลด์' };
  if (String(g.leader) === String(p.record.id) && g.members.length > 1) {
    return { error: 'หัวหน้าต้องโอนตำแหน่งให้คนอื่นก่อนออกจากกิลด์' };
  }
  g.members = g.members.filter((m) => String(m.charId) !== String(p.record.id));
  p.record.guild = null;
  if (!g.members.length) {
    // the last one out takes the vault with them, rather than the world
    // quietly eating whatever is inside it
    returnVault(p, g);
    delete guilds()[g.id];
  } else {
    announce(world, g, `${p.name} ออกจากกิลด์แล้ว`);
    log(g, `${p.name} ออกจากกิลด์`, 'leave');
  }
  p.recompute?.();
  markDirty();
  return { ok: true };
}

export function kick(world, p, charId) {
  const g = of(p);
  if (!g) return { error: 'ยังไม่ได้อยู่กิลด์' };
  const me = member(g, p.record.id);
  const them = member(g, charId);
  if (!them) return { error: 'ไม่พบสมาชิกคนนี้' };
  if (!rankOf(me?.rank).kick) return { error: 'ยศของคุณเตะคนออกไม่ได้' };
  if (rankIndex(them.rank) >= rankIndex(me.rank)) return { error: 'เตะคนที่ยศเท่ากันหรือสูงกว่าไม่ได้' };

  g.members = g.members.filter((m) => String(m.charId) !== String(charId));
  const online = world.playerByCharId(String(charId));
  if (online) {
    online.record.guild = null;
    online.recompute?.();
    online.conn?.send({ t: 'notice', kind: 'bad', text: `คุณถูกเชิญออกจากกิลด์ ${g.name}` });
  }
  else {
    const rec = db.characters[String(charId)];
    if (rec) rec.guild = null;
  }
  markDirty();
  announce(world, g, `${them.name} ถูกเชิญออกจากกิลด์`);
  log(g, `${them.name} ถูกเชิญออกจากกิลด์`, 'leave');
  return { ok: true };
}

export function setRank(world, p, charId, rank) {
  const g = of(p);
  if (!g) return { error: 'ยังไม่ได้อยู่กิลด์' };
  const me = member(g, p.record.id);
  if (!rankOf(me?.rank).manage) return { error: 'มีแต่หัวหน้ากิลด์ที่เปลี่ยนยศได้' };
  const them = member(g, charId);
  if (!them) return { error: 'ไม่พบสมาชิกคนนี้' };
  if (!RANKS.some((r) => r.id === rank)) return { error: 'ไม่มียศนี้' };

  if (rank === 'leader') {
    // handing over the guild: there is only ever one leader
    them.rank = 'leader';
    me.rank = 'officer';
    g.leader = String(charId);
    announce(world, g, `${them.name} เป็นหัวหน้ากิลด์คนใหม่`);
  } else {
    if (String(them.charId) === String(g.leader)) return { error: 'ลดยศหัวหน้าเองไม่ได้ ให้โอนตำแหน่งแทน' };
    them.rank = rank;
    announce(world, g, `${them.name} ได้ยศ ${rankOf(rank).nameTh}`);
  }
  markDirty();
  return { ok: true };
}

export function setNotice(p, text) {
  const g = of(p);
  if (!g) return { error: 'ยังไม่ได้อยู่กิลด์' };
  if (!rankOf(member(g, p.record.id)?.rank).manage) return { error: 'มีแต่หัวหน้ากิลด์ที่แก้ประกาศได้' };
  g.notice = String(text ?? '').slice(0, 200);
  markDirty();
  return { ok: true };
}

/* -------------------------------------------------------------------- vault */

/**
 * Move an item between a character's bag and the guild vault.
 *
 * Nothing is created here. A withdrawal is also metered per week per rank,
 * which is the whole reason the vault is usable: a recruit cannot take, a
 * member can take a few things, and only the leader is unmetered.
 */
export function vaultMove(p, dir, index, qty) {
  const g = of(p);
  if (!g) return { error: 'ยังไม่ได้อยู่กิลด์' };
  if (g.inDebt) return { error: 'กิลด์ค้างค่าบำรุง — คลังถูกล็อกจนกว่าจะจ่าย' };
  const me = member(g, p.record.id);
  qty = Math.max(1, Math.floor(Number(qty)) || 1);

  if (dir === 'in') {
    const st = p.inventory[index];
    if (!st) return { error: 'ไม่พบไอเทม' };
    if (Object.values(p.record.equipment).includes(index)) return { error: 'ถอดอุปกรณ์ก่อน' };
    if ((g.vault ?? []).length >= VAULT_SLOTS) return { error: 'คลังกิลด์เต็ม' };
    qty = Math.min(qty, st.qty ?? 1);
    const def = ITEMS[st.id];
    const merge = (def?.stack ?? 1) > 1 && !st.refine
      ? g.vault.find((s) => s.id === st.id && !s.refine) : null;
    if (merge) merge.qty += qty; else g.vault.push({ ...st, qty });
    p.removeItemAt(index, qty);
    log(g, `${p.name} ฝาก ${ITEMS[st.id]?.nameTh ?? st.id} x${qty}`);
  } else {
    const allowance = rankOf(me?.rank).take;
    if (allowance <= 0) return { error: 'ยศของคุณเบิกของจากคลังไม่ได้' };
    const week = weekKey();
    const taken = g.taken?.[String(p.record.id)];
    const used = taken?.week === week ? taken.n : 0;
    if (used + qty > allowance) {
      return { error: `ยศ${rankOf(me?.rank).nameTh}เบิกได้สัปดาห์ละ ${allowance} ชิ้น (ใช้ไปแล้ว ${used})` };
    }
    const st = (g.vault ?? [])[index];
    if (!st) return { error: 'ไม่พบไอเทมในคลัง' };
    qty = Math.min(qty, st.qty ?? 1);
    if (!p.addItem(st.id, qty, st)) return { error: 'กระเป๋าเต็มหรือน้ำหนักเกิน' };
    if ((st.qty ?? 1) > qty) st.qty -= qty; else g.vault.splice(index, 1);
    g.taken = { ...(g.taken ?? {}), [String(p.record.id)]: { week, n: used + qty } };
    log(g, `${p.name} เบิก ${ITEMS[st.id]?.nameTh ?? st.id} x${qty}`);
  }
  markDirty();
  return { ok: true };
}

/** Aurum into the guild's purse. Only ever in - the purse pays the upkeep. */
export function donate(p, amount) {
  const g = of(p);
  if (!g) return { error: 'ยังไม่ได้อยู่กิลด์' };
  const n = Math.max(1, Math.min(p.record.aurum, Math.floor(Number(amount)) || 0));
  if (!n) return { error: 'ใส่จำนวนออรัมที่จะบริจาค' };
  p.record.aurum -= n;
  g.aurum = (g.aurum ?? 0) + n;
  if (g.inDebt && g.aurum >= GUILD_UPKEEP) {
    g.aurum -= GUILD_UPKEEP;
    g.inDebt = false;
    g.upkeepDue = Date.now() + UPKEEP_PERIOD;
    log(g, 'จ่ายค่าบำรุงแล้ว คลังกลับมาใช้ได้');
  }
  log(g, `${p.name} บริจาค ${n.toLocaleString()} ออรัม`, 'give');
  progress(null, g, 'donate', n);
  markDirty();
  return { ok: true, aurum: g.aurum };
}

/** The last member out is handed whatever is left, rather than it vanishing. */
function returnVault(p, g) {
  for (const st of g.vault ?? []) p.addItem(st.id, st.qty ?? 1, st);
  if (g.aurum) p.record.aurum += g.aurum;
}

function log(g, text, kind = null) {
  g.history = [{ text, at: Date.now(), kind }, ...(g.history ?? [])].slice(0, 30);
}

/* ------------------------------------------------------------ growth */

/** This week's goal counters, reset on the shared weekly schedule. */
function goals(g) {
  const week = weekKey();
  if (g.week !== week) { g.week = week; g.goals = {}; }
  return (g.goals ??= {});
}

/** Guild EXP, with the level-ups it causes told to everyone online. */
export function addExp(world, g, n) {
  if (!g || !(n > 0)) return;
  g.level ??= 1;
  g.exp = (g.exp ?? 0) + Math.floor(n);
  let up = false;
  while (g.level < GUILD_MAX_LEVEL && g.exp >= guildExpToNext(g.level)) {
    g.exp -= guildExpToNext(g.level);
    g.level++;
    up = true;
    const opened = GUILD_SKILLS.find((s) => s.level === g.level);
    log(g, `กิลด์เลเวลอัพเป็น Lv.${g.level}${opened ? ` — ปลดล็อกทักษะ${opened.nameTh}` : ''}`, 'up');
    if (world) announce(world, g, `กิลด์เลเวลอัพเป็น Lv.${g.level}!${opened ? ` ปลดล็อกทักษะ ${opened.nameTh} (${opened.desc})` : ''}`);
  }
  if (g.level >= GUILD_MAX_LEVEL) g.exp = 0;
  if (up && world) {
    for (const p of world.players.values()) {
      if (p.record.guild === g.id) { p.recompute(); p.conn?.send({ t: 'guildLevelUp', level: g.level }); }
    }
  }
  markDirty();
}

/** Progress on one of the week's goals; finishing it pays guild EXP once. */
export function progress(world, g, id, n = 1) {
  if (!g) return;
  const q = GUILD_QUESTS.find((x) => x.id === id);
  if (!q) return;
  const gl = goals(g);
  const before = gl[id] ?? 0;
  if (before >= q.need) return;
  gl[id] = Math.min(q.need, before + n);
  if (gl[id] >= q.need) {
    log(g, `ภารกิจกิลด์สำเร็จ: ${q.nameTh} (+${q.exp.toLocaleString()} EXP กิลด์)`, 'up');
    addExp(world, g, q.exp);
  }
  markDirty();
}

/** A member's kill feeds the guild a little, and the weekly hunt. */
export function onKill(world, p, monsterLevel) {
  const g = of(p);
  if (!g) return;
  addExp(world, g, killGuildExp(monsterLevel));
  progress(world, g, 'hunt', 1);
}

export function setEmblem(p, emblem) {
  const g = of(p);
  if (!g) return { error: 'ยังไม่ได้อยู่กิลด์' };
  if (!rankOf(member(g, p.record.id)?.rank).manage) return { error: 'มีแต่หัวหน้ากิลด์ที่เปลี่ยนตรากิลด์ได้' };
  if (!EMBLEMS.includes(emblem)) return { error: 'ไม่มีตรานี้' };
  g.emblem = emblem;
  markDirty();
  return { ok: true };
}

/** The skills a character carries from their guild (none without one). */
export function skillsOf(record) {
  const g = record?.guild ? byId(record.guild) : null;
  return g ? skillsAt(g.level ?? 1) : [];
}

/* ------------------------------------------------------------------ upkeep */

/**
 * Charge every guild its weekly dues. A guild that cannot pay is not
 * disbanded - that would punish a quiet week far too hard - its vault is
 * simply locked until somebody settles up.
 */
export function chargeUpkeep(world, at = Date.now()) {
  let charged = 0;
  for (const g of Object.values(guilds())) {
    if (at < (g.upkeepDue ?? 0)) continue;
    // Holding the fortress buys a week off the bill. The prize for a siege is
    // relief from a drain every other guild is still paying, not a payment -
    // paying the winner would make the strongest guild richer every week,
    // which is how a scarce-currency economy ends up with one guild in it.
    if (Siege.waivesUpkeep(g.id)) {
      g.upkeepDue = at + UPKEEP_PERIOD;
      g.inDebt = false;
      log(g, 'กิลด์ถือป้อมอยู่ — สัปดาห์นี้ไม่ต้องจ่ายค่าบำรุง');
      charged++;
      continue;
    }
    if ((g.aurum ?? 0) >= GUILD_UPKEEP) {
      g.aurum -= GUILD_UPKEEP;
      burn(world, GUILD_UPKEEP, 'guild-upkeep');
      g.upkeepDue = at + UPKEEP_PERIOD;
      g.inDebt = false;
      log(g, `หักค่าบำรุงประจำสัปดาห์ ${GUILD_UPKEEP.toLocaleString()} ออรัม`);
    } else {
      g.inDebt = true;
      g.upkeepDue = at + 86400000;        // ask again tomorrow
      log(g, 'ออรัมในคลังไม่พอจ่ายค่าบำรุง — คลังถูกล็อก');
      announce(world, g, `กิลด์ ${g.name} ค้างค่าบำรุง คลังถูกล็อกจนกว่าจะมีคนบริจาคครบ`);
    }
    charged++;
  }
  if (charged) markDirty();
  return charged;
}

/* -------------------------------------------------------------------- wire */

export function announce(world, g, text) {
  for (const p of world.players.values()) {
    if (p.record.guild === g.id) p.conn?.send({ t: 'chatMsg', ch: 'guild', text, from: 'กิลด์', ts: Date.now() });
  }
}

/** Everything the guild window shows. */
export function state(world, p) {
  const g = of(p);
  const siege = Siege.status();
  if (!g) return { t: 'guildState', guild: null, invite: p.guildInvite ?? null, cost: GUILD_COST, siege };
  const me = member(g, p.record.id);
  const week = weekKey();
  const taken = g.taken?.[String(p.record.id)];
  return {
    t: 'guildState',
    siege,
    guild: {
      id: g.id, name: g.name, notice: g.notice ?? '', aurum: g.aurum ?? 0,
      level: g.level ?? 1, exp: g.exp ?? 0, expToNext: guildExpToNext(g.level ?? 1),
      capacity: capOf(g), emblem: g.emblem ?? 'lion', created: g.created,
      leaderName: g.members.find((m) => m.rank === 'leader')?.name ?? '',
      goals: GUILD_QUESTS.map((q) => ({ ...q, have: goals(g)[q.id] ?? 0 })),
      upkeep: GUILD_UPKEEP, upkeepDue: g.upkeepDue, inDebt: !!g.inDebt,
      holdsFortress: Siege.waivesUpkeep(g.id),
      myCharId: String(p.record.id),
      myRank: me?.rank ?? 'recruit',
      // Infinity does not survive JSON - it comes out as null - so the
      // unlimited allowance travels as -1 and the window reads it as such
      myAllowance: rankOf(me?.rank).take === Infinity ? -1 : rankOf(me?.rank).take,
      myTaken: taken?.week === week ? taken.n : 0,
      members: g.members.map((m) => {
        const online = world.playerByCharId(String(m.charId));
        return {
          charId: m.charId, name: m.name, rank: m.rank,
          online: !!online,
          level: online?.record.level ?? db.characters[String(m.charId)]?.level ?? 1,
          job: online?.record.job ?? db.characters[String(m.charId)]?.job ?? 'novice',
          map: online?.record.map ?? null,
        };
      }).sort((a, b) => (b.online - a.online) || (rankIndex(b.rank) - rankIndex(a.rank))),
      vault: (g.vault ?? []).map((st, i) => ({ i, id: st.id, qty: st.qty ?? 1, refine: st.refine ?? 0 })),
      history: g.history ?? [],
    },
    ranks: RANKS.map((r) => ({ id: r.id, nameTh: r.nameTh, take: r.take === Infinity ? -1 : r.take })),
    invite: null,
    cost: GUILD_COST,
  };
}
