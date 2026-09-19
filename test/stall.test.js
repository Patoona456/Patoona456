// Player stalls.
//
// Anything that moves goods between two people is a place where goods get
// made by accident. A stall is safer than most because the item never leaves
// the seller's bag until it is paid for - but that only holds if every path
// through it is checked, including the ones a seller can create by shuffling
// their inventory while somebody is looking at the window.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Stall from '../server/game/stall.js';
import { ITEMS } from '../shared/data/items.js';

function person(id, name, items = [], aurum = 100000) {
  const p = {
    id, alive: true, x: 0, y: 0,
    inventory: items.slice(),
    record: { id: 'c' + id, name, aurum, equipment: {} },
    conn: { send() {} },
    addItem(itemId, qty) {
      if (p.bagFull) return false;
      p.inventory.push({ id: itemId, qty });
      return true;
    },
    removeItemAt(index, qty) {
      const st = p.inventory[index];
      if (!st) return;
      st.qty -= qty;
      if (st.qty <= 0) p.inventory[index] = null;
    },
  };
  return p;
}

function town(players, safe = true) {
  return { def: { safe }, players: new Map(players.map((p) => [p.id, p])) };
}
const world = { stats: { minted: 0, burned: 0 } };

test('a stall only opens in town', () => {
  const seller = person('S', 'Seller', [{ id: 'herb_bundle', qty: 10 }]);
  const field = town([seller], false);
  const r = Stall.openStall(field, seller, 'ของถูก', [{ index: 0, qty: 5, price: 100 }]);
  assert.ok(r.error, 'a stall opened in the field');
  assert.ok(!Stall.isOpen(seller));
});

test('what is listed stays in the seller\'s bag until somebody pays', () => {
  const seller = person('S', 'Seller', [{ id: 'herb_bundle', qty: 10 }]);
  const zone = town([seller]);
  Stall.openStall(zone, seller, 'ของถูก', [{ index: 0, qty: 5, price: 100 }]);
  assert.equal(seller.inventory[0].qty, 10, 'listing took the goods out of the bag');
  Stall.close(seller);
  assert.equal(seller.inventory[0].qty, 10, 'closing gave back something it never held');
});

test('a sale moves goods and money once, and burns the tax', () => {
  const seller = person('S', 'Seller', [{ id: 'herb_bundle', qty: 10 }], 0);
  const buyer = person('B', 'Buyer', [], 1000);
  const zone = town([seller, buyer]);
  Stall.openStall(zone, seller, 'ของถูก', [{ index: 0, qty: 5, price: 100 }]);

  const before = seller.record.aurum + buyer.record.aurum;
  const r = Stall.buy(world, zone, buyer, 'S', 0, 2);
  assert.ok(!r.error, r.error);
  assert.equal(seller.inventory[0].qty, 8, 'the seller kept what was sold');
  assert.equal(buyer.inventory.at(-1).qty, 2, 'the buyer did not receive it');
  assert.equal(buyer.record.aurum, 800, 'the buyer was charged the wrong amount');
  assert.equal(seller.record.aurum, 200 - r.tax, 'the seller was paid the wrong amount');
  // A trade moves money between two people; it never adds any. The only
  // change to the total is the tax, which leaves the game entirely.
  assert.ok(r.tax > 0, 'the sale was untaxed');
  assert.equal(seller.record.aurum + buyer.record.aurum, before - r.tax,
    'the trade created or lost Aurum beyond the tax');
});

test('a full bag loses nobody anything', () => {
  const seller = person('S', 'Seller', [{ id: 'herb_bundle', qty: 10 }], 0);
  const buyer = person('B', 'Buyer', [], 1000);
  buyer.bagFull = true;
  const zone = town([seller, buyer]);
  Stall.openStall(zone, seller, 'ของถูก', [{ index: 0, qty: 5, price: 100 }]);

  const r = Stall.buy(world, zone, buyer, 'S', 0, 2);
  assert.ok(r.error, 'it sold into a full bag');
  assert.equal(buyer.record.aurum, 1000, 'the buyer paid for nothing');
  assert.equal(seller.inventory[0].qty, 10, 'the seller lost goods to a failed sale');
});

test('a seller who spends the item cannot be made to sell something else', () => {
  const seller = person('S', 'Seller', [{ id: 'herb_bundle', qty: 10 }], 0);
  const buyer = person('B', 'Buyer', [], 100000);
  const zone = town([seller, buyer]);
  Stall.openStall(zone, seller, 'ของถูก', [{ index: 0, qty: 5, price: 100 }]);

  // The slot now holds something far more valuable than the herbs on offer.
  seller.inventory[0] = { id: 'skeleton_crown', qty: 1 };
  const r = Stall.buy(world, zone, buyer, 'S', 0, 1);
  assert.ok(r.error, 'a crown was sold at the price of a herb bundle');
  assert.equal(seller.inventory[0].id, 'skeleton_crown');

  // And browsing says so rather than showing a stale offer as live.
  const view = Stall.browse(zone, buyer, 'S');
  assert.ok(view.stall.offers[0].gone, 'a dead offer still reads as buyable');
});

test('you cannot buy from across town, or from yourself', () => {
  const seller = person('S', 'Seller', [{ id: 'herb_bundle', qty: 10 }], 0);
  const buyer = person('B', 'Buyer', [], 1000);
  const zone = town([seller, buyer]);
  Stall.openStall(zone, seller, 'ของถูก', [{ index: 0, qty: 5, price: 100 }]);

  buyer.x = Stall.BROWSE_RANGE + 50;
  assert.ok(Stall.buy(world, zone, buyer, 'S', 0, 1).error, 'bought from across town');
  assert.ok(Stall.browse(zone, buyer, 'S').error, 'browsed from across town');

  buyer.x = 0;
  assert.ok(Stall.buy(world, zone, seller, 'S', 0, 1).error, 'the seller bought their own goods');
});

test('prices and quantities that are not prices or quantities', () => {
  const seller = person('S', 'Seller', [{ id: 'herb_bundle', qty: 10 }]);
  const zone = town([seller]);
  for (const price of [0, -5, NaN, 1e12]) {
    assert.ok(Stall.openStall(zone, seller, 'x', [{ index: 0, qty: 1, price }]).error, `price ${price} was accepted`);
  }
  assert.ok(Stall.openStall(zone, seller, 'x', [{ index: 99, qty: 1, price: 10 }]).error, 'an empty slot was listed');
  assert.ok(Stall.openStall(zone, seller, 'x', [
    { index: 0, qty: 1, price: 10 }, { index: 0, qty: 1, price: 20 },
  ]).error, 'the same slot was listed twice');

  // A quantity beyond the stack is clamped, not refused - and never exceeds it.
  const ok = Stall.openStall(zone, seller, 'x', [{ index: 0, qty: 9999, price: 10 }]);
  assert.ok(ok.ok);
  assert.equal(Stall.stallOf(seller).offers[0].qty, 10);
});

test('more offers than a stall can hold', () => {
  const items = Array.from({ length: Stall.MAX_OFFERS + 2 }, () => ({ id: 'herb_bundle', qty: 1 }));
  const seller = person('S', 'Seller', items);
  const zone = town([seller]);
  const offers = items.map((_, index) => ({ index, qty: 1, price: 10 }));
  assert.ok(Stall.openStall(zone, seller, 'x', offers).error, 'a stall took more than its limit');
});

test('equipped gear cannot be sold out from under its wearer', () => {
  const seller = person('S', 'Seller', [{ id: 'training_blade', qty: 1 }]);
  seller.record.equipment = { weapon: 0 };
  const zone = town([seller]);
  assert.ok(Stall.openStall(zone, seller, 'x', [{ index: 0, qty: 1, price: 10 }]).error,
    'the sword in the seller\'s hand was listed');
  assert.ok(ITEMS.training_blade);
});
