// Cards.
//
// `cards.size` and `cards.race` were hooks in the damage formula with nothing
// filling them in. Now something does, and the thing that fills them is a
// permanent, irreversible change to a piece of gear - which is exactly the
// kind of operation that has to be right the first time, because there is no
// way to undo a mistake in it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, CARDS, socketsOf, cardFits } from '../shared/data/items.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { npcSellPrice } from '../shared/formulas.js';
import { rollDamage } from '../shared/formulas.js';
import * as Econ from '../server/game/economy.js';

test('every card describes a bonus the damage formula can actually read', () => {
  for (const c of Object.values(CARDS)) {
    assert.equal(c.type, 'card', `${c.id} is not typed as a card`);
    assert.ok(c.card, `${c.id} has no card block`);
    assert.ok(['weapon', 'armor', 'any'].includes(c.fits), `${c.id} fits "${c.fits}"`);
    assert.ok(c.nameTh && c.desc, `${c.id} has no Thai name or description`);
    for (const size of Object.keys(c.card.size ?? {})) {
      assert.ok(['small', 'medium', 'large'].includes(size), `${c.id} names size "${size}"`);
    }
    for (const race of Object.keys(c.card.race ?? {})) {
      assert.ok(['human', 'beast', 'undead', 'demon', 'plant', 'spirit'].includes(race),
        `${c.id} names race "${race}"`);
    }
  }
});

test('a card bonus is worth having, and not worth breaking the game over', () => {
  const base = { atk: 200, hit: 200, crit: 0, weaponElement: 'neutral' };
  const mob = { def: 40, mdef: 40, softDef: 13, softMdef: 13, flee: 0, level: 50, element: 'neutral', critRes: 0 };
  const roll = (raceBonus) => {
    let total = 0;
    for (let i = 0; i < 4000; i++) total += rollDamage(base, mob, { raceBonus, canCrit: false }).damage;
    return total / 4000;
  };
  const plain = roll(0);
  const carded = roll(0.2);
  assert.ok(carded > plain * 1.1, 'a 20% card barely moved the number');
  assert.ok(carded < plain * 1.35, 'a 20% card did far more than 20%');
});

test('cards only go where they fit', () => {
  const weapon = ITEMS.ashen_edge, armour = ITEMS.ashguard_plate, potion = ITEMS.lesser_salve;
  assert.ok(cardFits(CARDS.card_husk, weapon), 'a weapon card would not go into a weapon');
  assert.ok(!cardFits(CARDS.card_husk, armour), 'a weapon card went into armour');
  assert.ok(cardFits(CARDS.card_wight, armour), 'an armour card would not go into armour');
  assert.ok(!cardFits(CARDS.card_wight, weapon), 'an armour card went into a weapon');
  assert.ok(cardFits(CARDS.card_choir, weapon) && cardFits(CARDS.card_choir, armour),
    'a universal card was refused');
  assert.ok(!cardFits(CARDS.card_husk, potion), 'a card went into a potion');
  assert.ok(!cardFits(ITEMS.herb_bundle, weapon), 'a herb bundle socketed as a card');
});

test('sockets exist on gear and nowhere else', () => {
  assert.ok(socketsOf(ITEMS.ashen_edge) >= 1, 'a weapon has no socket');
  assert.equal(socketsOf(ITEMS.ashguard_plate), 2, 'a late epic does not take two');
  assert.equal(socketsOf(ITEMS.lesser_salve), 0, 'a potion has sockets');
  assert.equal(socketsOf(ITEMS.herb_bundle), 0, 'a material has sockets');
  assert.equal(socketsOf(CARDS.card_husk), 0, 'a card has sockets of its own');
  assert.equal(socketsOf(undefined), 0);
});

test('every card drops from something, and rarely', () => {
  const rates = new Map();
  for (const m of Object.values(MONSTERS)) {
    for (const d of m.drops ?? []) {
      if (ITEMS[d.id]?.type === 'card') rates.set(d.id, Math.max(rates.get(d.id) ?? 0, d.chance));
    }
  }
  for (const id of Object.keys(CARDS)) {
    assert.ok(rates.has(id), `${id} drops from nothing`);
    assert.ok(rates.get(id) <= 0.06, `${id} drops at ${rates.get(id)}, which is not a card`);
  }
});

test('a card is something players trade, not something a vendor buys', () => {
  for (const c of Object.values(CARDS)) {
    const paid = npcSellPrice(c.value ?? 0, 0, c.rarity, 'equip');
    assert.ok(paid <= (c.value ?? 0) * 0.02 + 1, `${c.id} vendors for ${paid} of ${c.value}`);
  }
});

/* --- putting one in, which cannot be undone ----------------------------- */

function holder(items) {
  const p = {
    inventory: items.slice(),
    record: { equipment: {}, aurum: 0 },
    recomputed: 0,
    recompute() { p.recomputed++; },
    removeItemAt(i, qty) {
      const st = p.inventory[i];
      if (!st) return;
      st.qty -= qty;
      if (st.qty <= 0) p.inventory[i] = null;
    },
  };
  return p;
}
const world = { stats: { minted: 0, burned: 0 } };

test('socketing consumes the card and marks the gear, once', () => {
  const p = holder([{ id: 'ashen_edge', qty: 1 }, { id: 'card_husk', qty: 1 }]);
  const r = Econ.socket(world, p, 0, 1);
  assert.ok(!r.error, r.error);
  assert.deepEqual(p.inventory[0].cards, ['card_husk']);
  assert.equal(p.inventory[1], null, 'the card was not consumed');
  assert.ok(p.recomputed > 0, 'stats were not recalculated');
});

test('it refuses every way of getting something for nothing', () => {
  const armourCardInWeapon = holder([{ id: 'ashen_edge', qty: 1 }, { id: 'card_wight', qty: 1 }]);
  assert.ok(Econ.socket(world, armourCardInWeapon, 0, 1).error, 'an armour card went into a blade');

  const notACard = holder([{ id: 'ashen_edge', qty: 1 }, { id: 'herb_bundle', qty: 5 }]);
  assert.ok(Econ.socket(world, notACard, 0, 1).error, 'a herb bundle was socketed');

  const intoAPotion = holder([{ id: 'lesser_salve', qty: 1 }, { id: 'card_choir', qty: 1 }]);
  assert.ok(Econ.socket(world, intoAPotion, 0, 1).error, 'a card went into a potion');

  const itself = holder([{ id: 'card_husk', qty: 1 }]);
  assert.ok(Econ.socket(world, itself, 0, 0).error, 'a card was socketed into itself');

  const missing = holder([{ id: 'ashen_edge', qty: 1 }]);
  assert.ok(Econ.socket(world, missing, 0, 7).error, 'an empty slot was socketed');
});

test('a socket is not a bag: it fills up, and refuses duplicates', () => {
  // ashen_edge is level 60, so it takes two.
  const p = holder([
    { id: 'ashen_edge', qty: 1 },
    { id: 'card_husk', qty: 1 }, { id: 'card_grub', qty: 1 }, { id: 'card_moth', qty: 1 },
  ]);
  assert.ok(!Econ.socket(world, p, 0, 1).error);
  assert.ok(!Econ.socket(world, p, 0, 2).error);
  const third = Econ.socket(world, p, 0, 3);
  assert.ok(third.error, 'a third card went into two sockets');
  assert.equal(p.inventory[0].cards.length, 2);
  assert.ok(p.inventory[3], 'the refused card was eaten anyway');

  const dupe = holder([{ id: 'ashen_edge', qty: 1 }, { id: 'card_husk', qty: 1 }, { id: 'card_husk', qty: 1 }]);
  assert.ok(!Econ.socket(world, dupe, 0, 1).error);
  assert.ok(Econ.socket(world, dupe, 0, 2).error, 'the same card went in twice');
});

test('a stack of gear cannot be blessed by one card', () => {
  const p = holder([{ id: 'ashen_edge', qty: 3 }, { id: 'card_husk', qty: 1 }]);
  assert.ok(Econ.socket(world, p, 0, 1).error, 'one card socketed a stack of three');
});
