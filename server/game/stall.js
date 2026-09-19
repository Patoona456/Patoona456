// Player stalls.
//
// The market is an abstract list: you post to it from anywhere a market NPC
// stands, and it clears whether you are online or not. That is convenient and
// completely faceless - nobody ever meets anybody at it, and a town with a
// market NPC is a town nobody lingers in.
//
// A stall is the opposite trade: you have to be standing there, in a safe
// zone, with your shop sign over your head, and you close when you walk away.
// What you get for that is no listing fee and no 24-hour clock. It is the
// oldest MMO town square there is, and it costs the economy nothing because
// of the one rule everything here is built around:
//
//   The goods never leave the seller's inventory until they are paid for.
//
// There is no escrow to reconcile, nothing to duplicate if the process dies
// mid-sale, and a stall that goes stale because its owner spent the item is
// simply a stall whose offer fails the next time somebody clicks it.
import { ITEMS } from '../../shared/data/items.js';
import { marketTax } from '../../shared/formulas.js';
import { burn } from './economy.js';
import { markDirty } from '../persistence.js';

export const MAX_OFFERS = 8;
/** How close a buyer has to stand. Roughly the NPC shop range. */
export const BROWSE_RANGE = 140;

/** Stalls live and die with the session, so they are not written to the db. */
const open = new Map();          // playerId -> { title, offers: [{index, qty, price}] }

export function stallOf(p) { return open.get(p?.id) ?? null; }
export function isOpen(p) { return open.has(p?.id); }

/** Everything a client needs to draw a sign over somebody's head. */
export function signs(zone) {
  const out = [];
  for (const p of zone.players.values()) {
    const s = open.get(p.id);
    if (s) out.push({ id: p.id, title: s.title, n: s.offers.length });
  }
  return out;
}

export function close(p, why = null) {
  if (!open.has(p.id)) return false;
  open.delete(p.id);
  p.conn?.send({ t: 'stall', mine: null, why });
  return true;
}

/**
 * Open or replace a stall. Offers are validated against the inventory now and
 * again at purchase, because a seller can move things around in between.
 */
export function openStall(zone, p, title, offers) {
  if (!zone?.def?.safe) return { error: 'ตั้งแผงได้เฉพาะในเมือง' };
  if (!Array.isArray(offers) || !offers.length) return { error: 'ยังไม่ได้เลือกของ' };
  if (offers.length > MAX_OFFERS) return { error: `ตั้งขายได้สูงสุด ${MAX_OFFERS} รายการ` };

  const clean = [];
  const seen = new Set();
  for (const o of offers) {
    const index = o.index | 0;
    if (seen.has(index)) return { error: 'เลือกช่องเดิมซ้ำ' };
    seen.add(index);
    const st = p.inventory[index];
    if (!st) return { error: 'ไม่พบไอเทมในช่องที่เลือก' };
    if (Object.values(p.record.equipment).includes(index)) return { error: 'ถอดอุปกรณ์ก่อนขาย' };
    const qty = Math.max(1, Math.min(st.qty ?? 1, o.qty | 0 || 1));
    const price = Math.floor(o.price);
    if (!(price > 0) || price > 1e9) return { error: 'ราคาไม่ถูกต้อง' };
    clean.push({ index, id: st.id, qty, price });
  }

  open.set(p.id, { title: String(title ?? '').slice(0, 24) || 'แผงขายของ', offers: clean });
  return { ok: true, offers: clean.length };
}

/** What a passer-by sees when they click the sign. */
export function browse(zone, viewer, sellerId) {
  const seller = zone.players.get(sellerId);
  const s = open.get(sellerId);
  if (!seller || !s) return { error: 'แผงนี้ปิดไปแล้ว' };
  if (Math.hypot(seller.x - viewer.x, seller.y - viewer.y) > BROWSE_RANGE) {
    return { error: 'ยืนใกล้ๆ แผงก่อน' };
  }
  return {
    ok: true,
    stall: {
      seller: sellerId, name: seller.record.name, title: s.title,
      offers: s.offers.map((o, i) => {
        // An offer whose slot has changed under it is shown as gone rather
        // than quietly selling whatever happens to be in that slot now.
        const st = seller.inventory[o.index];
        const live = st && st.id === o.id;
        return {
          slot: i, id: o.id, qty: Math.min(o.qty, live ? (st.qty ?? 1) : 0),
          price: o.price, name: ITEMS[o.id]?.nameTh ?? o.id, gone: !live,
          refine: live ? st.refine ?? 0 : 0,
        };
      }),
    },
  };
}

/**
 * Buy one offer. Revalidated from scratch: the seller may have moved, spent
 * the item, or closed since the browser window was drawn.
 */
export function buy(world, zone, buyer, sellerId, slot, qty) {
  const seller = zone.players.get(sellerId);
  const s = open.get(sellerId);
  if (!seller || !s) return { error: 'แผงนี้ปิดไปแล้ว' };
  if (seller.id === buyer.id) return { error: 'ซื้อของตัวเองไม่ได้' };
  if (Math.hypot(seller.x - buyer.x, seller.y - buyer.y) > BROWSE_RANGE) {
    return { error: 'ยืนใกล้ๆ แผงก่อน' };
  }
  const o = s.offers[slot | 0];
  if (!o) return { error: 'ไม่พบรายการ' };

  const st = seller.inventory[o.index];
  if (!st || st.id !== o.id) return { error: 'ผู้ขายไม่มีของชิ้นนี้แล้ว' };
  if (Object.values(seller.record.equipment).includes(o.index)) return { error: 'ผู้ขายสวมของชิ้นนี้อยู่' };

  const want = Math.max(1, Math.min(qty | 0 || 1, o.qty, st.qty ?? 1));
  const total = o.price * want;
  if (buyer.record.aurum < total) return { error: 'ออรัมไม่พอ' };

  // Hand over the goods first; if the bag is full nothing else has happened.
  const stack = { ...st, qty: want };
  if (!buyer.addItem(o.id, want, stack)) return { error: 'กระเป๋าเต็ม' };
  seller.removeItemAt(o.index, want);

  // The same 5% the market burns: a stall is cheaper than the market because
  // it costs the seller their evening, not because it is a tax holiday.
  const tax = marketTax(total);
  buyer.record.aurum -= total;
  seller.record.aurum += total - tax;
  burn(world, tax, 'stall-tax');

  o.qty -= want;
  if (o.qty <= 0) s.offers.splice(slot | 0, 1);
  if (!s.offers.length) close(seller, 'ขายหมดแล้ว');

  markDirty();
  return { ok: true, id: o.id, qty: want, paid: total, tax, sellerName: seller.record.name };
}

/** A stall belongs to a body standing in a town: it ends when that stops. */
export function sweep(world) {
  for (const id of [...open.keys()]) {
    const p = world.players.get(id);
    if (!p || !p.alive) { open.delete(id); continue; }
    if (!p.zone?.def?.safe) close(p, 'ออกจากเมืองแล้ว');
  }
}
