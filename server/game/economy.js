// Everything that moves Aurum. The design goal: many small sinks, few faucets.
import { ITEMS, RECIPES, isEquip } from '../../shared/data/items.js';
import { SHOPS, HEAL_PRICE_PER_LEVEL, STORAGE_FEE, WARP_ROUTES, RESET_STAT_PRICE, RESET_SKILL_PRICE } from '../../shared/data/npcs.js';
import { npcSellPrice, marketTax, refineChance, refineCost } from '../../shared/formulas.js';
import { STARTING_STATS } from '../../shared/data/jobs.js';
import { db, markDirty } from '../persistence.js';

const today = () => Math.floor(Date.now() / 86400000);

export function burn(world, amount) { world.stats.burned += amount; }

/* ---------------- shops ---------------- */
export function shopPayload(shopId) {
  const shop = SHOPS[shopId];
  if (!shop) return null;
  return {
    t: 'shop', id: shop.id, name: shop.name, services: shop.services ?? [],
    stock: shop.stock.map((s) => {
      const it = ITEMS[s.id];
      return { id: s.id, price: it.value, stock: s.stock ?? 99, name: it.nameTh ?? it.name, type: it.type };
    }),
  };
}

export function buy(world, p, shopId, itemId, qty) {
  const shop = SHOPS[shopId];
  const line = shop?.stock.find((s) => s.id === itemId);
  if (!line) return { error: 'ร้านนี้ไม่มีของชิ้นนี้' };
  qty = Math.max(1, Math.min(999, Math.floor(qty) || 1));
  const def = ITEMS[itemId];
  const total = def.value * qty;
  if (p.record.aurum < total) return { error: 'ออรัมไม่พอ' };
  if (p.weight() + (def.weight ?? 1) * qty > p.weightCap) return { error: 'น้ำหนักเกิน' };
  if (!p.addItem(itemId, qty)) return { error: 'กระเป๋าเต็ม' };
  p.record.aurum -= total;
  burn(world, total);
  markDirty();
  return { ok: true, spent: total };
}

export function sell(world, p, index, qty) {
  const st = p.inventory[index];
  if (!st) return { error: 'ไม่พบไอเทม' };
  const def = ITEMS[st.id];
  if (!def) return { error: 'ไอเทมไม่ถูกต้อง' };
  if (Object.values(p.record.equipment).includes(index)) return { error: 'ถอดอุปกรณ์ก่อนขาย' };
  qty = Math.max(1, Math.min(st.qty ?? 1, Math.floor(qty) || 1));

  if (p.record.salesDay !== today()) { p.record.salesDay = today(); p.record.npcSales = {}; }
  const soldToday = p.record.npcSales[st.id] ?? 0;

  let gained = 0;
  for (let i = 0; i < qty; i++) gained += npcSellPrice(def.value, soldToday + i);
  // broken / worn gear is worth less
  if (isEquip(def) && st.dur !== undefined) gained = Math.floor(gained * (0.4 + 0.6 * (st.dur / (def.durability ?? 100))));

  p.record.npcSales[st.id] = soldToday + qty;
  p.removeItemAt(index, qty);
  p.record.aurum += gained;
  world.stats.minted += gained;
  markDirty();
  return { ok: true, gained, dampened: soldToday > 5 };
}

/* ---------------- refine ---------------- */
export function refine(world, p, index, useOil) {
  const st = p.inventory[index];
  if (!st) return { error: 'ไม่พบไอเทม' };
  const def = ITEMS[st.id];
  if (!def || !def.refinable) return { error: 'ไอเทมนี้ตีบวกไม่ได้' };
  const lvl = st.refine ?? 0;
  if (lvl >= 15) return { error: 'ตีบวกสูงสุดแล้ว (+15)' };

  const cost = refineCost(def.value, lvl);
  if (p.record.aurum < cost) return { error: `ต้องใช้ ${cost} ออรัม` };

  const needStone = lvl >= 4;
  if (needStone && p.countItem('runed_whetstone') < 1) return { error: 'ต้องใช้หินลับรูน 1 ก้อน' };
  if (useOil && p.countItem('blessing_oil') < 1) return { error: 'ไม่มีน้ำมันศักดิ์สิทธิ์' };

  p.record.aurum -= cost;
  burn(world, cost);
  if (needStone) p.removeItemById('runed_whetstone', 1);
  if (useOil) p.removeItemById('blessing_oil', 1);

  const success = Math.random() < refineChance(lvl);
  if (success) {
    st.refine = lvl + 1;
    p.recompute();
    markDirty();
    return { ok: true, success: true, refine: st.refine };
  }
  // failure: the oil saves it, otherwise it drops a level (and breaks past +7)
  if (useOil) { markDirty(); return { ok: true, success: false, protected: true, refine: lvl }; }
  if (lvl >= 8) {
    p.removeItemAt(index, 1);
    markDirty();
    return { ok: true, success: false, destroyed: true };
  }
  st.refine = Math.max(0, lvl - 1);
  p.recompute();
  markDirty();
  return { ok: true, success: false, refine: st.refine };
}

export function repair(world, p, index) {
  const st = p.inventory[index];
  if (!st || st.dur === undefined) return { error: 'ซ่อมไม่ได้' };
  const def = ITEMS[st.id];
  const max = def.durability ?? 100;
  if (st.dur >= max) return { error: 'ยังไม่สึกหรอ' };
  const missing = max - st.dur;
  const cost = Math.max(20, Math.floor(def.value * 0.004 * missing) + missing * 2);
  if (p.record.aurum < cost) return { error: `ต้องใช้ ${cost} ออรัม` };
  p.record.aurum -= cost;
  burn(world, cost);
  st.dur = max;
  p.recompute();
  markDirty();
  return { ok: true, cost };
}

export function craft(world, p, recipeId, times = 1) {
  const r = RECIPES[recipeId];
  if (!r) return { error: 'ไม่พบสูตร' };
  times = Math.max(1, Math.min(20, Math.floor(times) || 1));
  for (const need of r.in) {
    if (p.countItem(need.id) < need.qty * times) {
      return { error: `ขาด ${ITEMS[need.id].nameTh} x${need.qty * times - p.countItem(need.id)}` };
    }
  }
  const fee = r.fee * times;
  if (p.record.aurum < fee) return { error: `ค่าธรรมเนียม ${fee} ออรัม` };
  for (const need of r.in) p.removeItemById(need.id, need.qty * times);
  p.record.aurum -= fee;
  burn(world, fee);
  p.addItem(r.out.id, r.out.qty * times);
  markDirty();
  return { ok: true, made: r.out.qty * times, item: r.out.id };
}

/* ---------------- storage ---------------- */
export function storageOf(p) {
  db.storage[p.record.account] ??= { items: [], aurum: 0 };
  return db.storage[p.record.account];
}

export function openStorage(world, p) {
  if (p.record.aurum < STORAGE_FEE) return { error: `ค่าเปิดคลัง ${STORAGE_FEE} ออรัม` };
  p.record.aurum -= STORAGE_FEE;
  burn(world, STORAGE_FEE);
  markDirty();
  return { ok: true, storage: storageOf(p) };
}

export function storageMove(p, dir, index, qty) {
  const store = storageOf(p);
  qty = Math.max(1, Math.floor(qty) || 1);
  if (dir === 'in') {
    const st = p.inventory[index];
    if (!st) return { error: 'ไม่พบไอเทม' };
    if (Object.values(p.record.equipment).includes(index)) return { error: 'ถอดอุปกรณ์ก่อน' };
    if (store.items.length >= 300) return { error: 'คลังเต็ม' };
    qty = Math.min(qty, st.qty ?? 1);
    const copy = { ...st, qty };
    const def = ITEMS[st.id];
    const merge = (def.stack ?? 1) > 1 && !st.refine
      ? store.items.find((s) => s.id === st.id && !s.refine) : null;
    if (merge) merge.qty += qty; else store.items.push(copy);
    p.removeItemAt(index, qty);
  } else {
    const st = store.items[index];
    if (!st) return { error: 'ไม่พบไอเทมในคลัง' };
    qty = Math.min(qty, st.qty ?? 1);
    if (!p.addItem(st.id, qty, st)) return { error: 'กระเป๋าเต็มหรือน้ำหนักเกิน' };
    if ((st.qty ?? 1) > qty) st.qty -= qty; else store.items.splice(index, 1);
  }
  markDirty();
  return { ok: true, storage: store };
}

/* ---------------- player market (consignment) ---------------- */
export function marketList(filter = {}) {
  const out = db.market
    .filter((l) => !l.sold && l.until > Date.now())
    .filter((l) => !filter.q || (ITEMS[l.id]?.nameTh ?? '').includes(filter.q) || l.id.includes(filter.q))
    .slice(0, 200);
  return { t: 'market', listings: out.map(publicListing) };
}

function publicListing(l) {
  const it = ITEMS[l.id];
  return {
    uid: l.uid, id: l.id, name: it?.nameTh ?? l.id, qty: l.qty, price: l.price,
    refine: l.stack?.refine ?? 0, seller: l.sellerName, until: l.until,
    unit: Math.round(l.price / l.qty), ref: it?.value ?? 0, rarity: it?.rarity,
  };
}

export function marketPost(world, p, index, qty, price) {
  const st = p.inventory[index];
  if (!st) return { error: 'ไม่พบไอเทม' };
  if (Object.values(p.record.equipment).includes(index)) return { error: 'ถอดอุปกรณ์ก่อนขาย' };
  qty = Math.max(1, Math.min(st.qty ?? 1, Math.floor(qty) || 1));
  price = Math.floor(price);
  if (!(price > 0) || price > 1e9) return { error: 'ราคาไม่ถูกต้อง' };
  const mine = db.market.filter((l) => l.seller === p.record.id && !l.sold && l.until > Date.now());
  if (mine.length >= 10) return { error: 'ลงขายได้สูงสุด 10 รายการ' };

  const fee = marketTax(price);
  if (p.record.aurum < fee) return { error: `ค่าธรรมเนียมลงขาย ${fee} ออรัม` };
  p.record.aurum -= fee;
  burn(world, fee);

  const stack = { ...st, qty };
  p.removeItemAt(index, qty);
  db.market.push({
    uid: 'l' + Math.random().toString(36).slice(2, 10),
    id: st.id, qty, price, stack, seller: p.record.id, sellerName: p.record.name,
    posted: Date.now(), until: Date.now() + 24 * 3600 * 1000, sold: false, escrow: 0,
  });
  markDirty();
  return { ok: true, fee };
}

export function marketBuy(world, p, uid) {
  const l = db.market.find((x) => x.uid === uid && !x.sold && x.until > Date.now());
  if (!l) return { error: 'รายการนี้ไม่มีแล้ว' };
  if (l.seller === p.record.id) return { error: 'ซื้อของตัวเองไม่ได้' };
  if (p.record.aurum < l.price) return { error: 'ออรัมไม่พอ' };
  if (!p.addItem(l.id, l.qty, l.stack)) return { error: 'กระเป๋าเต็ม' };

  p.record.aurum -= l.price;
  const tax = marketTax(l.price);
  burn(world, tax);
  l.sold = true;
  l.soldAt = Date.now();

  const seller = db.characters[l.seller];
  if (seller) seller.aurum += l.price - tax;   // credited even while offline
  markDirty();
  return { ok: true, item: l.id, qty: l.qty, paid: l.price };
}

export function marketCancel(p, uid) {
  const l = db.market.find((x) => x.uid === uid && x.seller === p.record.id && !x.sold);
  if (!l) return { error: 'ไม่พบรายการ' };
  if (!p.addItem(l.id, l.qty, l.stack)) return { error: 'กระเป๋าเต็ม' };
  db.market.splice(db.market.indexOf(l), 1);
  markDirty();
  return { ok: true };
}

/** Expired listings return goods to the seller's storage. */
export function sweepMarket() {
  const t = Date.now();
  for (let i = db.market.length - 1; i >= 0; i--) {
    const l = db.market[i];
    if (l.sold && t - l.soldAt > 7 * 86400000) { db.market.splice(i, 1); continue; }
    if (!l.sold && l.until < t) {
      const seller = db.characters[l.seller];
      if (seller) {
        db.storage[seller.account] ??= { items: [], aurum: 0 };
        db.storage[seller.account].items.push({ ...l.stack, qty: l.qty });
      }
      db.market.splice(i, 1);
    }
  }
  markDirty();
}

/* ---------------- misc services ---------------- */
export function healService(world, p) {
  const price = p.record.level * HEAL_PRICE_PER_LEVEL;
  if (p.record.aurum < price) return { error: `ค่ารักษา ${price} ออรัม` };
  p.record.aurum -= price;
  burn(world, price);
  p.hp = p.maxHp; p.sp = p.maxSp;
  markDirty();
  return { ok: true, price };
}

export function warpService(world, p, to) {
  const route = WARP_ROUTES.find((r) => r.to === to);
  if (!route) return { error: 'ไม่มีปลายทางนี้' };
  if (p.record.aurum < route.price) return { error: `ค่าเดินทาง ${route.price} ออรัม` };
  p.record.aurum -= route.price;
  burn(world, route.price);
  markDirty();
  return { ok: true, route };
}

export function resetStats(world, p) {
  if (p.record.aurum < RESET_STAT_PRICE) return { error: `ต้องใช้ ${RESET_STAT_PRICE} ออรัม` };
  p.record.aurum -= RESET_STAT_PRICE;
  burn(world, RESET_STAT_PRICE);
  let refund = 0;
  for (const k of Object.keys(STARTING_STATS)) {
    for (let v = p.record[k]; v > STARTING_STATS[k]; v--) refund += Math.floor((v - 2) / 10) + 2;
    p.record[k] = STARTING_STATS[k];
  }
  p.record.statPoints += refund;
  p.recompute();
  markDirty();
  return { ok: true, refund };
}

export function resetSkills(world, p) {
  if (p.record.aurum < RESET_SKILL_PRICE) return { error: `ต้องใช้ ${RESET_SKILL_PRICE} ออรัม` };
  p.record.aurum -= RESET_SKILL_PRICE;
  burn(world, RESET_SKILL_PRICE);
  let pts = 0;
  for (const lvl of Object.values(p.record.skills)) pts += lvl;
  p.record.skills = {};
  p.record.skillPoints += pts;
  p.recompute();
  markDirty();
  return { ok: true, refund: pts };
}
