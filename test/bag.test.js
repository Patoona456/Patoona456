// The bag: a locked stack stays put, and a bigger bag costs real money.
import './fixtures/items.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Econ from '../server/game/economy.js';
import * as Stall from '../server/game/stall.js';
import { ITEMS } from '../shared/data/items.js';
import { Player, BAG_STEP, BAG_MAX, bagCost } from '../server/game/player.js';

function character({ aurum = 1_000_000, items = [] } = {}) {
  const record = {
    id: 'b1', name: 'ผู้ทดสอบ', level: 40, jobLevel: 20, job: 'novice',
    str: 20, agi: 20, vit: 20, int: 20, dex: 20, luk: 20,
    exp: 0, jobExp: 0, statPoints: 0, skillPoints: 0, aurum,
    map: 'emberhold', x: 1000, y: 1000,
    look: { gender: 'male', body: 'light', eyes: 'brown', hair: 'plain', hairColor: 'brown' },
    inventory: items.map((id) => ({ id, qty: 3 })),
    equipment: {}, skills: {}, hotbar: [], quests: {}, storage: [],
    npcSales: {}, salesDay: 0, lockouts: {},
  };
  const p = new Player(record, { send() {} });
  p.recompute?.();
  return p;
}

const world = { stats: { minted: 0, burned: 0 } };
const anyItem = Object.keys(ITEMS).find((id) => ITEMS[id].value > 0 && ITEMS[id].type === 'material')
  ?? Object.keys(ITEMS).find((id) => ITEMS[id].value > 0);

test('a locked stack cannot be sold to a shop or put on a stall', () => {
  const p = character({ items: [anyItem] });
  p.inventory[0].locked = true;
  assert.match(Econ.sell(world, p, 0, 1).error ?? '', /ล็อก/);
  assert.match(Stall.openStall({ def: { safe: true } }, p, 'x', [{ index: 0, qty: 1, price: 10 }]).error ?? '', /ล็อก/);
  assert.equal(p.inventory[0].qty, 3, 'the stack moved anyway');
  delete p.inventory[0].locked;
  assert.ok(Econ.sell(world, p, 0, 1).ok, 'unlocking did not free it');
});

test('expanding the bag raises the weight limit and charges the listed price', () => {
  const p = character();
  const cap = p.weightCap, purse = p.record.aurum;
  const r = Econ.expandBag(world, p);
  assert.ok(r.ok, r.error);
  assert.equal(p.weightCap, cap + BAG_STEP);
  assert.equal(p.record.aurum, purse - bagCost(0));
  assert.ok(bagCost(1) > bagCost(0), 'every step should cost more than the last');
});

test('the bag stops growing at its cap, and a thin purse buys nothing', () => {
  const p = character({ aurum: 1e9 });
  for (let i = 0; i < BAG_MAX; i++) assert.ok(Econ.expandBag(world, p).ok);
  assert.ok(Econ.expandBag(world, p).error);
  const poor = character({ aurum: 10 });
  assert.ok(Econ.expandBag(world, poor).error);
  assert.equal(poor.record.bagLevel ?? 0, 0);
});
