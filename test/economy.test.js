// The money and the odds.
//
// docs/ECONOMY.md is a set of promises: money is hard to come by, the shrine
// is a sink and never a shortcut, the gacha's pity is real, and nothing in it
// can be had for cash. Those promises live in this file's assertions.
import './fixtures/items.js';          // the item systems need items to work on
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Econ from '../server/game/economy.js';
import { ITEMS, RECIPES, KEY_ITEMS } from '../shared/data/items.js';

const SHARD = KEY_ITEMS.gachaShard;      // what the shrine and its counter are paid in
import { MONSTERS } from '../shared/data/monsters.js';
import { WAITING_FOR_MONSTERS } from './fixtures/bestiary.js';
import { SHOPS } from '../shared/data/npcs.js';
import { Player } from '../server/game/player.js';

/** A character with a full purse and an empty bag, built the real way. */
function character({ level = 60, aurum = 1_000_000, items = [] } = {}) {
  const record = {
    id: 'c1', name: 'ผู้ทดสอบ', level, jobLevel: 40, job: 'novice',
    str: 40, agi: 40, vit: 40, int: 40, dex: 40, luk: 40,
    exp: 0, jobExp: 0, statPoints: 0, skillPoints: 0, aurum,
    map: 'artaris', x: 1000, y: 1000,
    look: { gender: 'male', body: 'light', eyes: 'brown', hair: 'plain', hairColor: 'brown' },
    inventory: items.map((i) => (typeof i === 'string' ? { id: i, qty: 1 } : i)),
    equipment: {}, skills: {}, hotbar: [], quests: {}, storage: [],
    npcSales: {}, salesDay: 0, lockouts: {},
  };
  const p = new Player(record, { send() {} });
  p.recompute?.();
  return p;
}

const world = { stats: { minted: 0, burned: 0 } };

/* -------------------------------------------------------------- the shop */

test('buying takes the money and gives the goods', () => {
  const p = character({ items: [] });
  const line = SHOPS.general.stock[0];
  const before = p.record.aurum;
  const r = Econ.buy(world, p, 'general', line.id, 2);
  assert.ok(r.ok, r.error);
  assert.ok(p.record.aurum < before, 'nothing was paid');
  assert.equal(p.countItem(line.id), 2);
});

test('you cannot buy what you cannot afford', () => {
  const p = character({ aurum: 1 });
  const line = SHOPS.general.stock.find((l) => ITEMS[l.id].value > 1);
  const r = Econ.buy(world, p, 'general', line.id, 1);
  assert.ok(r.error, 'a broke character bought something anyway');
  assert.equal(p.record.aurum, 1, 'money moved on a failed purchase');
});

test('the shard counter charges in shards, not coin', () => {
  const p = character({ aurum: 10_000_000, items: [{ id: SHARD, qty: 40 }] });
  const before = p.record.aurum;
  const r = Econ.buy(world, p, 'dawn', 'wings_feather', 1);
  assert.ok(r.ok, r.error);
  assert.equal(p.record.aurum, before, 'it charged aurum for a shard-priced item');
  assert.equal(p.countItem(SHARD), 40 - SHOPS.dawn.stock.find((l) => l.id === 'wings_feather').price);
  assert.equal(p.countItem('wings_feather'), 1);
});

test('a purse full of coin buys no wings', () => {
  const p = character({ aurum: 999_999_999, items: [] });
  const r = Econ.buy(world, p, 'dawn', 'wings_dawn', 1);
  assert.ok(r.error, 'wings were bought with money alone');
});

test('no shop anywhere sells wings for coin', () => {
  for (const [id, shop] of Object.entries(SHOPS)) {
    if (shop.currency) continue;                 // priced in materials, fine
    for (const line of shop.stock) {
      assert.notEqual(ITEMS[line.id]?.slot, 'wings', `shop ${id} sells ${line.id} for aurum`);
    }
  }
});

test('selling back to an NPC pays less the more you sell', () => {
  const p = character({ items: [{ id: 'herb_bundle', qty: 60 }] });
  const first = Econ.sell(world, p, 0, 1);
  const rest = Econ.sell(world, p, 0, 40);
  assert.ok(first.ok && rest.ok, first.error ?? rest.error);
  assert.ok(rest.gained / 40 < first.gained, 'the daily dampener is not working');
});

/* ------------------------------------------------------------- the boxes */

test('a box is consumed and pays out something from its own table', () => {
  const p = character({ items: [{ id: 'mystery_scroll', qty: 3 }] });
  const r = Econ.openBox(p, 0);
  assert.ok(r.ok, r.error);
  assert.equal(p.countItem('mystery_scroll'), 2, 'the scroll was not consumed');
  const table = ITEMS.mystery_scroll.opens.map((o) => o.id);
  assert.ok(table.includes(r.got.id), `a scroll produced ${r.got.id}, which is not in its table`);
  assert.ok(p.countItem(r.got.id) >= r.got.qty);
});

test('something that is not a box cannot be opened', () => {
  const p = character({ items: [{ id: 'herb_bundle', qty: 1 }] });
  assert.ok(Econ.openBox(p, 0).error);
});

/* ------------------------------------------------------------ the shrine */

test('the shrine costs shards and pays the pity it promises', () => {
  const p = character({ items: [{ id: SHARD, qty: 400 }] });
  const before = p.countItem(SHARD);
  const r = Econ.gachaDraw(world, p, 1);
  assert.ok(r.ok, r.error);
  assert.equal(p.countItem(SHARD), before - Econ.GACHA.cost);

  // The promise is not "a guarantee every ten draws" - a natural rare resets
  // the counter, so the guarantee may never need to fire. The promise is that
  // you are never more than `pity` draws from a rare. That is what to assert.
  const p2 = character({ items: [{ id: SHARD, qty: 999 }] });
  let streak = 0, worst = 0;
  for (let i = 0; i < 200; i++) {
    // keep the bag and the purse out of the way of the thing under test
    p2.record.inventory = [{ id: SHARD, qty: 999 }];
    const res = Econ.gachaDraw(world, p2, 1);
    assert.ok(res.ok, res.error);
    const row = res.results[0];
    if (row.tier === 'common') streak++; else streak = 0;
    worst = Math.max(worst, streak);
  }
  assert.ok(worst < Econ.GACHA.pity,
    `went ${worst} draws without a rare, but pity promises at most ${Econ.GACHA.pity - 1}`);
});

test('the guaranteed draw, when it fires, is never common', () => {
  const p = character({ items: [{ id: SHARD, qty: 999 }] });
  let fired = 0;
  for (let i = 0; i < 400; i++) {
    p.record.inventory = [{ id: SHARD, qty: 999 }];
    const row = Econ.gachaDraw(world, p, 1).results[0];
    if (!row.guaranteed) continue;
    fired++;
    assert.notEqual(row.tier, 'common', 'a guaranteed draw came back common');
  }
  assert.ok(fired > 0, 'the guarantee never fired in 400 draws, so it is untested');
});

test('the free draw is one draw a day, costs nothing, and cannot be a ten-draw', () => {
  const p = character({ items: [] });
  assert.ok(Econ.shardShop(p).freeReady, 'a fresh character has no free draw waiting');
  const r = Econ.gachaDraw(world, p, 10, { free: true });
  assert.ok(r.ok, r.error);
  assert.equal(r.results.length, 1, 'a free draw paid out more than one roll');
  assert.equal(r.spent, 0);
  assert.equal(Econ.shardShop(p).freeReady, false);
  assert.ok(Econ.gachaDraw(world, p, 1, { free: true }).error, 'the free draw came twice in one day');
});

test('an empty purse of shards draws nothing', () => {
  const p = character({ items: [{ id: SHARD, qty: Econ.GACHA.cost * 2 - 1 }] });
  assert.ok(Econ.gachaDraw(world, p, 2).error, 'it drew twice on the price of one and a bit');
  assert.equal(p.countItem(SHARD), Econ.GACHA.cost * 2 - 1, 'a refused draw took the tickets anyway');
});

test('everything the shrine can roll can also simply be bought', () => {
  const counter = new Set(SHOPS.dawn.stock.map((l) => l.id));
  for (const row of Econ.GACHA.pool) {
    assert.ok(counter.has(row.id) || ITEMS[row.id].type !== 'armor',
      `${row.id} can only be gambled for, never bought`);
  }
});

/* ------------------------------------------------------------- refining */

test('refining spends the money whether it works or not', () => {
  const p = character({ items: [{ id: 'iron_pike', qty: 1, refine: 0, dur: 120 }] });
  const before = p.record.aurum;
  const r = Econ.refine(world, p, 0, false);
  assert.ok(r.ok, r.error);
  assert.ok(p.record.aurum < before, 'a refine attempt was free');
});

test('refining past +4 needs a whetstone', () => {
  const p = character({ items: [{ id: 'iron_pike', qty: 1, refine: 6, dur: 120 }] });
  const r = Econ.refine(world, p, 0, false);
  assert.match(r.error ?? '', /หินลับรูน/, 'it refined a +6 without a stone');
});

test('nothing refines past the cap', () => {
  const p = character({ items: [{ id: 'iron_pike', qty: 1, refine: 15, dur: 120 }] });
  assert.ok(Econ.refine(world, p, 0, false).error);
});

test('wings cannot be refined at all', () => {
  for (const def of Object.values(ITEMS)) {
    if (def.slot !== 'wings') continue;
    assert.equal(def.refinable, false, `${def.id} can be refined, which the design forbids`);
  }
});

/* ------------------------------------------------------------- crafting */

test('crafting consumes the materials and the fee', () => {
  const r = RECIPES.steel_ingot;
  const p = character({ items: [{ id: 'iron_ore', qty: 30 }] });
  const before = p.record.aurum;
  const res = Econ.craft(world, p, 'steel_ingot', 2);
  assert.ok(res.ok, res.error);
  assert.equal(p.countItem('iron_ore'), 30 - r.in[0].qty * 2);
  assert.equal(p.countItem('steel_ingot'), r.out.qty * 2);
  assert.equal(p.record.aurum, before - r.fee * 2);
});

test('the weekly boss is the only thing on a lockout', { skip: WAITING_FOR_MONSTERS }, () => {
  const locked = Object.values(MONSTERS).filter((m) => m.lockout);
  assert.ok(locked.length > 0, 'nothing is locked, so the weekly cap does not exist');
  for (const m of locked) {
    assert.equal(m.lockout, 'weekly');
    assert.ok(m.boss, `${m.id} has a lockout but is not a boss`);
  }
});

/* ------------------------------------------------------------- buy-back */

test('buy-back undoes a sale exactly, and only once', () => {
  const p = character({ items: [{ id: 'iron_sword', qty: 1, refine: 3, dur: 40 }, { id: 'lesser_salve', qty: 5 }] });
  const start = p.record.aurum;
  const sold = Econ.sell(world, p, 0, 1);
  assert.ok(sold.ok, sold.error);
  const list = Econ.buybackList(p);
  assert.equal(list.length, 1);
  assert.equal(list[0].price, sold.gained, 'buy-back costs what the sale paid');
  const back = Econ.buyback(world, p, 0);
  assert.ok(back.ok, back.error);
  assert.equal(p.record.aurum, start, 'a sale and its buy-back must net to nothing');
  const sword = p.inventory.find((st) => st.id === 'iron_sword');
  assert.equal(sword.refine, 3, 'the refine came back');
  assert.equal(sword.dur, 40, 'the wear came back');
  assert.ok(Econ.buyback(world, p, 0).error, 'the same sale was bought back twice');
});

test('buy-back keeps only the last few sales and refuses without the money', () => {
  const p = character({ items: [{ id: 'lesser_salve', qty: 20 }] });
  for (let i = 0; i < Econ.BUYBACK_KEEP + 4; i++) Econ.sell(world, p, 0, 1);
  assert.equal(Econ.buybackList(p).length, Econ.BUYBACK_KEEP);
  p.record.aurum = 0;
  assert.ok(Econ.buyback(world, p, 0).error, 'bought back with no money');
});

/** Refine with the dice loaded: `roll` is what Math.random returns. */
function refineWith(roll, refine, { oil = false, stones = 5, oils = 2 } = {}) {
  const p = character({ items: [{ id: 'iron_pike', qty: 1, refine, dur: 120 },
    { id: 'runed_whetstone', qty: stones }, { id: 'blessing_oil', qty: oils }] });
  const real = Math.random;
  Math.random = () => roll;
  try { return { p, r: Econ.refine(world, p, 0, oil) }; } finally { Math.random = real; }
}

test('each band fails the way the forge says it does', () => {
  assert.equal(refineWith(0.999, 3).r.result, 'unchanged', '+3 lost something');
  assert.equal(refineWith(0.999, 3).p.inventory[0].refine, 3);
  const down = refineWith(0.999, 6);
  assert.equal(down.r.result, 'down');
  assert.equal(down.p.inventory[0].refine, 5);
  const gone = refineWith(0.999, 9);
  assert.equal(gone.r.result, 'destroyed');
  assert.notEqual(gone.p.inventory[0]?.id, 'iron_pike', 'a +9 survived a failure');
});

test('oil turns a dangerous failure into nothing, and is not spent where it cannot help', () => {
  const saved = refineWith(0.999, 9, { oil: true });
  assert.equal(saved.r.result, 'unchanged');
  assert.equal(saved.p.inventory[0].refine, 9);
  const safe = refineWith(0.999, 3, { oil: true });
  assert.equal(safe.p.countItem('blessing_oil'), 2, 'oil burned on a +3 that could not lose anything');
});

test('from +10 an attempt eats two whetstones', () => {
  const r = refineWith(0.001, 10, { stones: 1 }).r;
  assert.match(r.error ?? '', /2 ก้อน/);
});

test('a refine moves onto a +0 item of the same kind, for a fee, and only once', () => {
  const p = character({ items: [{ id: 'iron_pike', qty: 1, refine: 9, dur: 120 },
    { id: 'ashwood_pike', qty: 1, refine: 0, dur: 120 }, { id: 'runed_whetstone', qty: 5 }, { id: 'leather_vest', qty: 1, refine: 0, dur: 100 }] });
  assert.ok(Econ.refineTransfer(world, p, 0, 3).error, 'a weapon refine went onto a vest');
  const before = p.record.aurum;
  const r = Econ.refineTransfer(world, p, 0, 1);
  assert.ok(r.ok, r.error);
  assert.equal(p.inventory[0].refine, 0);
  assert.equal(p.inventory[1].refine, 8, 'past +7 one level is lost on the way');
  assert.ok(p.record.aurum < before);
  assert.equal(p.countItem('runed_whetstone'), 2, 'three stones for nine levels');
  assert.ok(Econ.refineTransfer(world, p, 0, 1).error, 'moved a +0, or onto a refined item');
});

test('a ten-draw always holds an SR or better, and draws fill the point track', () => {
  const real = Math.random;
  Math.random = () => 0.001;                     // every roll the commonest thing
  try {
    const p = character({ items: [{ id: SHARD, qty: 40 }] });
    const r = Econ.gachaDraw(world, p, 10);
    assert.ok(r.ok, r.error);
    assert.ok(r.results.some((x) => ['SR', 'SSR', 'UR', 'LR'].includes(x.grade)), 'a ten-draw came up all R');
    assert.equal(r.points, 10);
  } finally { Math.random = real; }
});

test('milestone chests pay once, and the track restarts after the last', () => {
  const p = character({ items: [] });
  p.record.gachaPoints = 120;
  const got = Econ.gachaClaim(p);
  assert.ok(got.ok);
  assert.equal(got.got.length, 2, 'the 50 and 100 chests');
  assert.ok(Econ.gachaClaim(p).error, 'claimed twice');
  p.record.gachaPoints = Econ.GACHA.pointsMax;
  assert.ok(Econ.gachaClaim(p).ok);
  assert.equal(p.record.gachaPoints, 0);
  assert.deepEqual(p.record.gachaClaimed, []);
});

test('fast travel to a field needs a first visit on foot; towns do not', () => {
  const p = character({ items: [] });
  p.record.map = 'artaris';
  p.record.visited = ['artaris'];
  assert.match(Econ.warpService(world, p, 'orcwatch').error ?? '', /เคยเดินไป/);
  assert.ok(Econ.warpService(world, p, 'millhaven').ok, 'a town was locked');
  p.record.visited.push('orcwatch');
  assert.ok(Econ.warpService(world, p, 'orcwatch').ok);
  assert.ok(Econ.warpService(world, p, 'artaris').error, 'warped to where you already are');
});
