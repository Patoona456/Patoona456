// Face-to-face trading between two players.
//
// The rules exist because a trade window is where players get robbed:
//   * both sides must be alive, in the same zone, and standing close;
//   * every change to either offer clears both locks, so nobody can swap
//     the goods in the instant before you press the button;
//   * locking is not accepting - after both lock, each side confirms once
//     more, and only then does anything move;
//   * the swap is validated as a whole and applied atomically, so a full
//     bag or an overweight partner cancels the trade instead of eating
//     half of it.
import { ITEMS } from '../../shared/data/items.js';
import { markDirty } from '../persistence.js';

export const MAX_OFFER = 8;          // rows per side
export const TRADE_RANGE = 160;      // px; roughly five tiles
const INVITE_TTL = 45000;

const sessions = new Map();          // id -> session
let seq = 0;

const other = (s, p) => (s.a.p === p ? s.b : s.a);
const sideOf = (s, p) => (s.a.p === p ? s.a : s.b);

function newSide(p) {
  return { p, offer: [], aurum: 0, locked: false, confirmed: false };
}

function near(a, b) {
  return a.record.map === b.record.map && Math.hypot(a.x - b.x, a.y - b.y) <= TRADE_RANGE;
}

/** Any change invalidates both sides' agreement - this is the anti-swap rule. */
function touch(s) {
  s.a.locked = s.a.confirmed = false;
  s.b.locked = s.b.confirmed = false;
}

/* ---------------- lifecycle ---------------- */

export function invite(world, p, targetName) {
  if (p.trade) return { error: 'อยู่ระหว่างการเทรดอยู่แล้ว' };
  if (!p.alive) return { error: 'ตายอยู่ เทรดไม่ได้' };
  const target = world.playerByName(targetName);
  if (!target) return { error: 'ไม่พบผู้เล่นคนนี้' };
  if (target === p) return { error: 'เทรดกับตัวเองไม่ได้' };
  if (target.trade) return { error: 'ผู้เล่นกำลังเทรดกับคนอื่นอยู่' };
  if (!target.alive) return { error: 'ผู้เล่นคนนั้นตายอยู่' };
  if (!near(p, target)) return { error: 'ต้องยืนใกล้กันจึงจะเทรดได้' };
  if (target.tradeBlock || (target.record?.blocked ?? []).includes(String(p.record.id))) return { error: 'ผู้เล่นปิดรับคำขอเทรด' };

  target.tradeInvite = { from: p.name, fromId: p.id, at: Date.now() };
  target.conn?.send({
    t: 'tradeState', trade: null,
    invite: { from: p.name, fromId: p.id },
  });
  target.conn?.send({ t: 'notice', kind: 'invite', text: `${p.name} ขอเทรดกับคุณ` });
  return { ok: true };
}

export function accept(world, p, fromId) {
  const inv = p.tradeInvite;
  if (!inv || Date.now() - inv.at > INVITE_TTL) return { error: 'ไม่มีคำขอเทรดค้างอยู่' };
  if (fromId && String(fromId) !== String(inv.fromId)) return { error: 'คำขอไม่ตรงกัน' };
  const from = world.players.get(inv.fromId);
  p.tradeInvite = null;
  if (!from) return { error: 'อีกฝ่ายออกจากเกมไปแล้ว' };
  if (from.trade || p.trade) return { error: 'มีการเทรดค้างอยู่' };
  if (!near(p, from)) return { error: 'ยืนห่างกันเกินไป' };

  const s = { id: 'tr' + (++seq), a: newSide(from), b: newSide(p), at: Date.now() };
  sessions.set(s.id, s);
  from.trade = s.id;
  p.trade = s.id;
  return { ok: true, session: s };
}

export function decline(p) {
  p.tradeInvite = null;
  return { ok: true };
}

export function cancel(world, p, reason = 'ยกเลิกการเทรดแล้ว') {
  const s = sessions.get(p.trade);
  if (!s) { p.trade = null; return { ok: true }; }
  sessions.delete(s.id);
  for (const side of [s.a, s.b]) {
    side.p.trade = null;
    side.p.conn?.send({ t: 'tradeState', trade: null, invite: null });
    side.p.conn?.send({ t: 'notice', kind: 'warn', text: reason });
  }
  return { ok: true };
}

/** Called from the world tick: walking away or dying ends the trade. */
export function sweep(world) {
  for (const s of [...sessions.values()]) {
    const a = s.a.p, b = s.b.p;
    if (!world.players.has(a.id) || !world.players.has(b.id)) { cancel(world, a, 'อีกฝ่ายออกจากเกม'); continue; }
    if (!a.alive || !b.alive) { cancel(world, a, 'มีคนล้มลง การเทรดถูกยกเลิก'); continue; }
    if (!near(a, b)) { cancel(world, a, 'เดินห่างกันเกินไป การเทรดถูกยกเลิก'); continue; }
  }
}

/* ---------------- building an offer ---------------- */

export function offer(p, index, qty) {
  const s = sessions.get(p.trade);
  if (!s) return { error: 'ไม่ได้อยู่ในการเทรด' };
  const side = sideOf(s, p);
  const st = p.inventory[index | 0];
  if (!st) return { error: 'ไม่พบไอเทม' };
  const def = ITEMS[st.id];
  if (!def) return { error: 'ไม่พบไอเทม' };
  if (def.bound || def.noTrade) return { error: 'ไอเทมนี้เทรดไม่ได้' };
  if (Object.values(p.record.equipment).includes(index | 0)) return { error: 'ถอดอุปกรณ์ออกก่อนจึงจะเทรดได้' };

  const want = Math.max(1, Math.min(st.qty ?? 1, qty | 0 || 1));
  const already = side.offer.filter((o) => o.index === (index | 0)).reduce((a, o) => a + o.qty, 0);
  if (already + want > (st.qty ?? 1)) return { error: 'ใส่เกินจำนวนที่มี' };

  const row = side.offer.find((o) => o.index === (index | 0));
  if (row) row.qty += want;
  else {
    if (side.offer.length >= MAX_OFFER) return { error: `ใส่ได้สูงสุด ${MAX_OFFER} ช่อง` };
    side.offer.push({ index: index | 0, id: st.id, qty: want, refine: st.refine ?? 0, dur: st.dur ?? null });
  }
  touch(s);
  return { ok: true, session: s };
}

export function unoffer(p, slot) {
  const s = sessions.get(p.trade);
  if (!s) return { error: 'ไม่ได้อยู่ในการเทรด' };
  const side = sideOf(s, p);
  if (!side.offer[slot | 0]) return { error: 'ไม่มีช่องนั้น' };
  side.offer.splice(slot | 0, 1);
  touch(s);
  return { ok: true, session: s };
}

export function setAurum(p, amount) {
  const s = sessions.get(p.trade);
  if (!s) return { error: 'ไม่ได้อยู่ในการเทรด' };
  const side = sideOf(s, p);
  const n = Math.max(0, Math.min(p.record.aurum, Math.floor(Number(amount) || 0)));
  side.aurum = n;
  touch(s);
  return { ok: true, session: s };
}

/* ---------------- agreeing ---------------- */

export function lock(p, on = true) {
  const s = sessions.get(p.trade);
  if (!s) return { error: 'ไม่ได้อยู่ในการเทรด' };
  const side = sideOf(s, p);
  side.locked = !!on;
  if (!on) { side.confirmed = false; other(s, p).confirmed = false; }
  return { ok: true, session: s };
}

export function confirm(world, p) {
  const s = sessions.get(p.trade);
  if (!s) return { error: 'ไม่ได้อยู่ในการเทรด' };
  if (!s.a.locked || !s.b.locked) return { error: 'ต้องกดล็อกทั้งสองฝ่ายก่อน' };
  sideOf(s, p).confirmed = true;
  if (!s.a.confirmed || !s.b.confirmed) return { ok: true, session: s };

  const r = execute(world, s);
  if (r.error) { touch(s); return { ...r, session: s }; }
  sessions.delete(s.id);
  s.a.p.trade = null;
  s.b.p.trade = null;
  return { ok: true, done: true, session: s };
}

/* ---------------- the swap ---------------- */

/** Validate everything first, then move it. Never half a trade. */
function execute(world, s) {
  const pairs = [[s.a, s.b], [s.b, s.a]];

  // 1. the goods must still be there, exactly as they were offered
  for (const [from] of pairs) {
    const p = from.p;
    const used = new Map();
    for (const o of from.offer) {
      const st = p.inventory[o.index];
      if (!st || st.id !== o.id || (st.refine ?? 0) !== o.refine) return { error: 'ของในกระเป๋าเปลี่ยนไป การเทรดถูกยกเลิก' };
      const take = (used.get(o.index) ?? 0) + o.qty;
      if (take > (st.qty ?? 1)) return { error: 'จำนวนไอเทมไม่พอ' };
      used.set(o.index, take);
    }
    if (from.aurum > p.record.aurum) return { error: 'ออรัมไม่พอ' };
  }

  // 2. the receiver must have the room and the carrying capacity
  for (const [from, to] of pairs) {
    const rows = from.offer.length;
    if (to.p.inventory.length + rows > 100) return { error: `กระเป๋าของ ${to.p.name} เต็ม` };
    const adding = from.offer.reduce((a, o) => a + (ITEMS[o.id]?.weight ?? 1) * o.qty, 0);
    const losing = to.offer.reduce((a, o) => a + (ITEMS[o.id]?.weight ?? 1) * o.qty, 0);
    if (to.p.weight() + adding - losing > to.p.weightCap * 1.5) return { error: `${to.p.name} แบกน้ำหนักไม่ไหว` };
  }

  // 3. move it. Remove from the back so earlier indices stay valid.
  const parcels = new Map();
  for (const [from] of pairs) {
    const taken = [];
    for (const o of [...from.offer].sort((x, y) => y.index - x.index)) {
      const st = from.p.inventory[o.index];
      taken.push({ id: o.id, qty: o.qty, refine: st.refine ?? 0, dur: st.dur ?? null });
      from.p.removeItemAt(o.index, o.qty);
    }
    parcels.set(from, taken);
  }
  for (const [from, to] of pairs) {
    for (const it of parcels.get(from)) to.p.addItem(it.id, it.qty, { refine: it.refine, dur: it.dur });
    if (from.aurum) {
      from.p.record.aurum -= from.aurum;
      to.p.record.aurum += from.aurum;
    }
  }
  for (const side of [s.a, s.b]) { side.p.recompute(); side.p.persist(); }
  markDirty();

  // trades move wealth sideways; nothing is minted, so only log the flow
  world.stats.traded = (world.stats.traded ?? 0) + s.a.aurum + s.b.aurum;
  return { ok: true };
}

/* ---------------- what the client sees ---------------- */

export function state(p) {
  const s = sessions.get(p.trade);
  if (!s) return { t: 'tradeState', trade: null, invite: p.tradeInvite ? { from: p.tradeInvite.from, fromId: p.tradeInvite.fromId } : null };
  const me = sideOf(s, p), them = other(s, p);
  const view = (side, mine) => ({
    name: side.p.name,
    level: side.p.record.level,
    aurum: side.aurum,
    locked: side.locked,
    confirmed: side.confirmed,
    items: side.offer.map((o, slot) => ({
      slot, id: o.id, qty: o.qty, refine: o.refine, dur: o.dur,
      index: mine ? o.index : undefined,
    })),
  });
  return { t: 'tradeState', trade: { id: s.id, me: view(me, true), them: view(them, false) }, invite: null };
}

/** Push the window to both sides after anything changes. */
export function push(s) {
  for (const side of [s.a, s.b]) side.p.conn?.send(state(side.p));
}

export function sessionOf(p) { return sessions.get(p.trade) ?? null; }
