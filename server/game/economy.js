// Everything that moves Aurum. The design goal: many small sinks, few faucets.
import { ITEMS, RECIPES, CRAFTING_INPUTS, isEquip, socketsOf, cardFits } from '../../shared/data/items.js';
import { SHOPS, HEAL_PRICE_PER_LEVEL, STORAGE_FEE, WARP_ROUTES, RESET_STAT_PRICE, RESET_SKILL_PRICE } from '../../shared/data/npcs.js';
import { npcSellPrice, marketTax, refineChance, refineCost, refineRisk, refineStones, transferFee, transferResult, transferCompatible } from '../../shared/formulas.js';
import { MAX_REFINE } from '../../shared/refineglow.js';
import { STARTING_STATS } from '../../shared/data/jobs.js';
import { db, markDirty } from '../persistence.js';

const today = () => Math.floor(Date.now() / 86400000);

/**
 * Aurum leaving the world for good.
 *
 * `source` is what makes the dashboard worth having: a single "burned"
 * counter tells you money is leaving, but not whether the sinks you
 * *designed* are the ones doing the work. If refining is 90% of the burn and
 * the travel fee is 0.1%, the travel fee is decoration.
 */
export function burn(world, amount, source = 'other') {
  world.stats.burned += amount;
  world.stats.burnBy = world.stats.burnBy ?? {};
  world.stats.burnBy[source] = (world.stats.burnBy[source] ?? 0) + amount;
}

/** Aurum coming into the world from nothing. Same reasoning as `burn`. */
export function mint(world, amount, source = 'other') {
  world.stats.minted += amount;
  world.stats.mintBy = world.stats.mintBy ?? {};
  world.stats.mintBy[source] = (world.stats.mintBy[source] ?? 0) + amount;
}

/* ---------------- shops ---------------- */
export function shopPayload(shopId) {
  const shop = SHOPS[shopId];
  if (!shop) return null;
  return {
    t: 'shop', id: shop.id, name: shop.name, services: shop.services ?? [],
    currency: shop.currency ?? null,
    stock: shop.stock.map((s) => {
      const it = ITEMS[s.id];
      return {
        id: s.id,
        price: shop.currency ? (s.price ?? 1) : it.value,
        stock: s.stock ?? 99, name: it.nameTh ?? it.name, type: it.type,
      };
    }),
  };
}

export function buy(world, p, shopId, itemId, qty) {
  const shop = SHOPS[shopId];
  const line = shop?.stock.find((s) => s.id === itemId);
  if (!line) return { error: 'ร้านนี้ไม่มีของชิ้นนี้' };
  qty = Math.max(1, Math.min(999, Math.floor(qty) || 1));
  const def = ITEMS[itemId];
  if (p.weight() + (def.weight ?? 1) * qty > p.weightCap) return { error: 'น้ำหนักเกิน' };

  // some counters trade in a material rather than coin
  if (shop.currency) {
    const price = (line.price ?? 1) * qty;
    const cur = ITEMS[shop.currency];
    if (p.countItem(shop.currency) < price) return { error: `ต้องใช้${cur?.nameTh ?? shop.currency} ${price} ชิ้น` };
    if (!p.addItem(itemId, qty)) return { error: 'กระเป๋าเต็ม' };
    p.removeItemById(shop.currency, price);
    markDirty();
    return { ok: true, spent: price, currency: shop.currency };
  }

  const total = def.value * qty;
  if (p.record.aurum < total) return { error: 'ออรัมไม่พอ' };
  if (!p.addItem(itemId, qty)) return { error: 'กระเป๋าเต็ม' };
  p.record.aurum -= total;
  burn(world, total, 'shop');
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
  const dampen = (isEquip(def) || def.type === 'card') ? 'equip' : CRAFTING_INPUTS.has(def.id);
  for (let i = 0; i < qty; i++) gained += npcSellPrice(def.value, soldToday + i, def.rarity, dampen);
  // broken / worn gear is worth less
  if (isEquip(def) && st.dur !== undefined) gained = Math.floor(gained * (0.4 + 0.6 * (st.dur / (def.durability ?? 100))));

  p.record.npcSales[st.id] = soldToday + qty;
  // kept for buy-back at exactly what was paid, so a mis-click costs nothing;
  // the copy carries refine, durability and cards along with the id
  p.buyback ??= [];
  p.buyback.unshift({ stack: { ...st, qty }, price: gained });
  if (p.buyback.length > BUYBACK_KEEP) p.buyback.length = BUYBACK_KEEP;
  p.removeItemAt(index, qty);
  p.record.aurum += gained;
  mint(world, gained, 'npc-sell');
  markDirty();
  return { ok: true, gained, dampened: soldToday > 5 };
}

/** How many recent sales a player can still undo. Lives on the session, not the save. */
export const BUYBACK_KEEP = 8;

/** What the buy-back tab shows. */
export function buybackList(p) {
  return (p.buyback ?? []).map((b, i) => ({
    i, id: b.stack.id, qty: b.stack.qty ?? 1, refine: b.stack.refine ?? 0, price: b.price,
  }));
}

/**
 * Undo a sale: the same stack back, for the same aurum. Neutral both ways,
 * so it cannot be farmed - it only forgives a mis-click.
 */
export function buyback(world, p, index) {
  const b = p.buyback?.[index];
  if (!b) return { error: 'ไม่พบของที่ขายไป' };
  if (p.record.aurum < b.price) return { error: 'ออรัมไม่พอ' };
  const def = ITEMS[b.stack.id];
  if (!def) return { error: 'ไอเทมไม่ถูกต้อง' };
  const qty = b.stack.qty ?? 1;
  if (p.weight() + (def.weight ?? 1) * qty > p.weightCap) return { error: 'น้ำหนักเกิน' };
  if ((def.stack ?? 1) > 1 && !b.stack.refine) {
    if (!p.addItem(b.stack.id, qty)) return { error: 'กระเป๋าเต็ม' };
  } else {
    if (p.inventory.length >= 100) return { error: 'กระเป๋าเต็ม' };
    p.inventory.push({ ...b.stack });
  }
  p.buyback.splice(index, 1);
  p.record.aurum -= b.price;
  burn(world, b.price, 'buyback');
  markDirty();
  return { ok: true, spent: b.price, name: def.nameTh ?? def.name };
}

/* ---------------- boxes & the gacha shrine ---------------- */

/** Roll one entry out of a weighted table. */
function rollTable(table) {
  const total = table.reduce((a, o) => a + o.weight, 0);
  let pick = Math.random() * total;
  for (const o of table) {
    if (pick < o.weight) return o;
    pick -= o.weight;
  }
  return table[table.length - 1];
}

const qtyOf = (q) => (Array.isArray(q) ? q[0] + Math.floor(Math.random() * (q[1] - q[0] + 1)) : (q ?? 1));

/** Open a box item in the player's bag. */
export function openBox(p, index) {
  const st = p.inventory[index];
  if (!st) return { error: 'ไม่พบไอเทม' };
  const def = ITEMS[st.id];
  if (!def?.box) return { error: 'ไอเทมนี้เปิดไม่ได้' };
  if (p.inventory.length >= 99) return { error: 'กระเป๋าเต็มเกินไป เปิดไม่ได้' };

  const roll = rollTable(def.opens);
  const qty = qtyOf(roll.qty);
  p.removeItemAt(index, 1);
  p.addItem(roll.id, qty);
  markDirty();
  return { ok: true, box: st.id, got: { id: roll.id, qty }, rarity: ITEMS[roll.id]?.rarity ?? 'common' };
}

/**
 * The Dawn Shrine: pay shards, draw from the pool.
 *
 * Nothing here can be bought with real money, and nothing in the pool is
 * stronger than what a boss drops - it is a *sink* for the rarest currency
 * in the game, not a second progression track. Pity is hard: every tenth
 * draw is a guaranteed rare-or-better, and the counter is on the record so
 * it survives logging out.
 */
export const GACHA = {
  cost: 2,                       // shard_dawn per draw
  pity: 10,                      // draws until a guaranteed SSR or better
  // Five grades, named the way the shrine window shows them. `tier` is
  // what the pity counts: anything SSR and up resets it.
  pool: [
    { id: 'runed_whetstone', qty: [1, 3], weight: 26, grade: 'R' },
    { id: 'greater_salve', qty: [5, 10], weight: 16, grade: 'R' },
    { id: 'mana_draught', qty: [5, 10], weight: 12, grade: 'R' },
    { id: 'blessing_oil', qty: [1, 2], weight: 14, grade: 'SR' },
    { id: 'mystery_scroll', qty: [2, 4], weight: 10, grade: 'SR' },
    { id: 'boss_casket', qty: 1, weight: 6, grade: 'SSR' },
    { id: 'wings_feather', qty: 1, weight: 5, grade: 'SSR' },
    { id: 'wings_raven', qty: 1, weight: 5, grade: 'SSR' },
    { id: 'wings_bat', qty: 1, weight: 3, grade: 'UR' },
    { id: 'wings_frost', qty: 1, weight: 2, grade: 'UR' },
    { id: 'wings_ember', qty: 1, weight: 0.8, grade: 'LR' },
    { id: 'wings_dawn', qty: 1, weight: 0.2, grade: 'LR' },
  ].map((o) => ({ ...o, tier: o.grade === 'LR' ? 'legendary' : ['SSR', 'UR'].includes(o.grade) ? 'rare' : 'common' })),
  // Every draw is a point; points unlock a chest at each milestone, and the
  // track starts over after the last one. Small things - the shrine is a
  // sink, and the track only softens a long unlucky run.
  pointsMax: 200,
  milestones: [
    { at: 50, items: [{ id: 'runed_whetstone', qty: 3 }] },
    { at: 100, items: [{ id: 'blessing_oil', qty: 2 }] },
    { at: 150, items: [{ id: 'boss_casket', qty: 1 }] },
    { at: 200, items: [{ id: 'wings_frost', qty: 1 }] },
  ],
};
const GRADE_RANK = { R: 0, SR: 1, SSR: 2, UR: 3, LR: 4 };

export function gachaDraw(world, p, times = 1) {
  const n = Math.max(1, Math.min(10, times | 0));
  const cost = GACHA.cost * n;
  if (p.countItem('shard_dawn') < cost) return { error: `ต้องใช้เศษรุ่งอรุณ ${cost} ชิ้น` };
  if (p.inventory.length + n >= 100) return { error: 'กระเป๋าเต็ม' };
  p.removeItemById('shard_dawn', cost);

  const r = p.record;
  r.gachaPity = r.gachaPity ?? 0;
  r.gachaPoints = r.gachaPoints ?? 0;
  const results = [];
  for (let i = 0; i < n; i++) {
    r.gachaPity++;
    const guaranteed = r.gachaPity >= GACHA.pity;
    const table = guaranteed ? GACHA.pool.filter((o) => o.tier !== 'common') : GACHA.pool;
    const roll = rollTable(table);
    if (roll.tier !== 'common') r.gachaPity = 0;
    const qty = qtyOf(roll.qty);
    p.addItem(roll.id, qty);
    results.push({ id: roll.id, qty, tier: roll.tier, grade: roll.grade, guaranteed });
  }
  // a ten-draw always holds at least one SR; upgrade its worst roll if not
  if (n === 10 && !results.some((x) => GRADE_RANK[x.grade] >= 1)) {
    const sr = rollTable(GACHA.pool.filter((o) => o.grade === 'SR'));
    const worst = results[results.length - 1];
    p.removeItemById(worst.id, worst.qty);
    const qty = qtyOf(sr.qty);
    p.addItem(sr.id, qty);
    results[results.length - 1] = { id: sr.id, qty, tier: sr.tier, grade: sr.grade, guaranteed: true };
  }
  r.gachaPoints = Math.min(GACHA.pointsMax, r.gachaPoints + n);
  // the notable pulls are remembered, newest first
  const at = Date.now();
  r.gachaLog = [...results.filter((x) => GRADE_RANK[x.grade] >= 1).map((x) => ({ id: x.id, grade: x.grade, at })).reverse(),
    ...(r.gachaLog ?? [])].slice(0, 20);
  markDirty();
  return { ok: true, results, spent: cost, pity: GACHA.pity - r.gachaPity, points: r.gachaPoints };
}

/** Claim every milestone reached; after the last one the track restarts. */
export function gachaClaim(p) {
  const r = p.record;
  const claimed = new Set(r.gachaClaimed ?? []);
  const due = GACHA.milestones.filter((m) => (r.gachaPoints ?? 0) >= m.at && !claimed.has(m.at));
  if (!due.length) return { error: 'ยังไม่มีรางวัลให้รับ' };
  const got = [];
  for (const m of due) {
    for (const it of m.items) { p.addItem(it.id, it.qty); got.push(it); }
    claimed.add(m.at);
  }
  r.gachaClaimed = [...claimed];
  if (claimed.has(GACHA.pointsMax)) { r.gachaPoints = 0; r.gachaClaimed = []; }
  markDirty();
  return { ok: true, got };
}

/** The shard counter, shown next to the shrine. */
export function shardShop(p) {
  const r = p.record;
  return {
    cost: GACHA.cost,
    have: p.countItem('shard_dawn'),
    pity: GACHA.pity - (r.gachaPity ?? 0),
    pityMax: GACHA.pity,
    points: r.gachaPoints ?? 0,
    pointsMax: GACHA.pointsMax,
    milestones: GACHA.milestones.map((m) => ({ ...m, claimed: (r.gachaClaimed ?? []).includes(m.at) })),
    log: r.gachaLog ?? [],
    pool: GACHA.pool.map((o) => ({ id: o.id, qty: o.qty, tier: o.tier, grade: o.grade, chance: o.weight })),
  };
}

/* ---------------- refine ---------------- */
/**
 * Put a card into a piece of gear, for good.
 *
 * There is no un-socket, and there is deliberately no item that provides one.
 * A card that can be moved is a card one person owns and rotates through
 * whatever they are wearing; a card that commits makes the piece it went into
 * a particular thing that somebody built, which is the only way a crafting
 * and trading economy produces objects worth talking about.
 */
export function socket(world, p, gearIndex, cardIndex) {
  const gear = p.inventory[gearIndex];
  const card = p.inventory[cardIndex];
  if (!gear || !card) return { error: 'ไม่พบไอเทม' };
  if (gearIndex === cardIndex) return { error: 'เลือกคนละช่อง' };
  const gearDef = ITEMS[gear.id], cardDef = ITEMS[card.id];
  if (!gearDef || !cardDef) return { error: 'ไอเทมไม่ถูกต้อง' };
  if (cardDef.type !== 'card') return { error: 'ช่องที่สองต้องเป็นการ์ด' };
  if (!cardFits(cardDef, gearDef)) return { error: 'การ์ดนี้ใส่กับของชิ้นนี้ไม่ได้' };

  const max = socketsOf(gearDef);
  if (max <= 0) return { error: 'ของชิ้นนี้ไม่มีรูใส่การ์ด' };
  const fitted = gear.cards ?? [];
  if (fitted.length >= max) return { error: `ใส่ได้สูงสุด ${max} ใบ` };
  if (fitted.includes(card.id)) return { error: 'ใส่การ์ดใบเดิมซ้ำไม่ได้' };

  // A stack of identical gear has to be split, or one card would bless all of
  // them. Gear never stacks in this game, but the check costs nothing and the
  // day somebody makes it stack is the day this would silently duplicate.
  if ((gear.qty ?? 1) > 1) return { error: 'แยกของออกเป็นชิ้นเดียวก่อน' };

  gear.cards = [...fitted, card.id];
  p.removeItemAt(cardIndex, 1);
  p.recompute();
  markDirty();
  return { ok: true, gear: gear.id, card: card.id, used: gear.cards.length, max };
}

export function refine(world, p, index, useOil) {
  const st = p.inventory[index];
  if (!st) return { error: 'ไม่พบไอเทม' };
  const def = ITEMS[st.id];
  if (!def || !def.refinable) return { error: 'ไอเทมนี้ตีบวกไม่ได้' };
  const lvl = st.refine ?? 0;
  if (lvl >= MAX_REFINE) return { error: `ตีบวกสูงสุดแล้ว (+${MAX_REFINE})` };

  const cost = refineCost(def.value, lvl);
  if (p.record.aurum < cost) return { error: `ต้องใช้ ${cost.toLocaleString()} ออรัม` };
  const stones = refineStones(lvl);
  if (p.countItem('runed_whetstone') < stones) return { error: `ต้องใช้หินลับรูน ${stones} ก้อน` };
  const risk = refineRisk(lvl);
  // oil only matters where a failure costs something; never burn it for nothing
  const oil = useOil && (risk.onFail === 'down' || risk.onFail === 'break');
  if (oil && p.countItem('blessing_oil') < 1) return { error: 'ไม่มีน้ำมันศักดิ์สิทธิ์' };

  p.record.aurum -= cost;
  burn(world, cost, 'refine');
  if (stones) p.removeItemById('runed_whetstone', stones);
  if (oil) p.removeItemById('blessing_oil', 1);

  const base = { ok: true, id: st.id, from: lvl, cost, stones, oil };
  if (Math.random() < refineChance(lvl)) {
    st.refine = lvl + 1;
    p.recompute();
    markDirty();
    return { ...base, success: true, result: 'success', refine: st.refine };
  }
  if (oil || risk.onFail === 'none' || risk.onFail === 'unchanged') {
    markDirty();
    return { ...base, success: false, result: 'unchanged', protected: oil, refine: lvl };
  }
  if (risk.onFail === 'break') {
    p.removeItemAt(index, 1);
    p.recompute();
    markDirty();
    return { ...base, success: false, result: 'destroyed', destroyed: true, refine: lvl };
  }
  st.refine = lvl - 1;
  p.recompute();
  markDirty();
  return { ...base, success: false, result: 'down', refine: st.refine };
}

/** Move one item's refine onto another of its kind (see transferFee). */
export function refineTransfer(world, p, fromIndex, toIndex) {
  const src = p.inventory[fromIndex], dst = p.inventory[toIndex];
  if (!src || !dst || fromIndex === toIndex) return { error: 'เลือกของต้นทางและปลายทางให้ถูก' };
  const a = ITEMS[src.id], b = ITEMS[dst.id];
  if (!a?.refinable || !b?.refinable) return { error: 'ไอเทมนี้ตีบวกไม่ได้' };
  if (!transferCompatible(a, b)) return { error: 'ถ่ายโอนได้เฉพาะของประเภทเดียวกัน (อาวุธกับอาวุธ หรือช่องสวมใส่เดียวกัน)' };
  const lvl = src.refine ?? 0;
  if (lvl < 1) return { error: 'ของต้นทางยังไม่ได้ตีบวก' };
  if ((dst.refine ?? 0) > 0) return { error: 'ของปลายทางต้องเป็น +0' };
  const fee = transferFee(b.value ?? 0, lvl);
  if (p.record.aurum < fee.aurum) return { error: `ต้องใช้ ${fee.aurum.toLocaleString()} ออรัม` };
  if (p.countItem('runed_whetstone') < fee.stones) return { error: `ต้องใช้หินลับรูน ${fee.stones} ก้อน` };
  p.record.aurum -= fee.aurum;
  burn(world, fee.aurum, 'refine-transfer');
  if (fee.stones) p.removeItemById('runed_whetstone', fee.stones);
  const to = transferResult(lvl);
  // removeItemById may have shifted rows, so find both again by identity
  src.refine = 0;
  dst.refine = to;
  p.recompute();
  markDirty();
  return { ok: true, from: lvl, to, fromId: src.id, toId: dst.id, fee };
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
  burn(world, cost, 'repair');
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
  burn(world, fee, 'craft');
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
  burn(world, STORAGE_FEE, 'storage');
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
  burn(world, fee, 'market-list');

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
  burn(world, tax, 'market-tax');
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
  burn(world, price, 'heal');
  p.hp = p.maxHp; p.sp = p.maxSp;
  markDirty();
  return { ok: true, price };
}

export function warpService(world, p, to) {
  const route = WARP_ROUTES.find((r) => r.to === to);
  if (!route) return { error: 'ไม่มีปลายทางนี้' };
  if (route.to === p.record.map) return { error: 'อยู่ที่นี่แล้ว' };
  if (route.needVisit && !(p.record.visited ?? []).includes(route.to)) return { error: 'ต้องเคยเดินไปถึงพื้นที่นี้ก่อน จึงจะวาร์ปได้' };
  if (p.record.aurum < route.price) return { error: `ค่าเดินทาง ${route.price} ออรัม` };
  p.record.aurum -= route.price;
  burn(world, route.price, 'travel');
  markDirty();
  return { ok: true, route };
}

export function resetStats(world, p) {
  if (p.record.aurum < RESET_STAT_PRICE) return { error: `ต้องใช้ ${RESET_STAT_PRICE} ออรัม` };
  p.record.aurum -= RESET_STAT_PRICE;
  burn(world, RESET_STAT_PRICE, 'reset-stats');
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
  burn(world, RESET_SKILL_PRICE, 'reset-skills');
  let pts = 0;
  for (const lvl of Object.values(p.record.skills)) pts += lvl;
  p.record.skills = {};
  p.record.skillPoints += pts;
  p.recompute();
  markDirty();
  return { ok: true, refund: pts };
}
