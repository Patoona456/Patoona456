// The swordsman's two ladders: the common starters every five levels, and
// the rare sheet spread over the same range.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SWORDS, RARE_SWORDS } from '../shared/data/items.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { SHOPS } from '../shared/data/npcs.js';

const byLevel = (set) => Object.values(set).sort((a, b) => a.level - b.level);

test('both ladders run Lv.1 to Lv.120, climbing, one picture each', () => {
  for (const [set, n] of [[SWORDS, 24], [RARE_SWORDS, 26]]) {
    const list = byLevel(set);
    assert.equal(list.length, n);
    assert.equal(list[0].level, 1);
    assert.equal(list.at(-1).level, 120);
    assert.equal(new Set(list.map((w) => w.art)).size, n, 'two swords share a picture');
    for (let i = 1; i < list.length; i++) {
      assert.ok(list[i].level > list[i - 1].level, `${list[i].id} is not later than ${list[i - 1].id}`);
      assert.ok(list[i].atk > list[i - 1].atk, `${list[i].id} is no stronger than ${list[i - 1].id}`);
    }
  }
});

test('a rare sword beats the common sword you could hold at its level', () => {
  const commons = byLevel(SWORDS);
  for (const r of byLevel(RARE_SWORDS)) {
    const c = commons.filter((w) => w.level <= r.level).pop();
    assert.ok(r.atk > c.atk, `${r.id} (${r.atk}) is not above ${c.id} (${c.atk})`);
    assert.ok(r.atk < c.atk * 1.5, `${r.id} makes the common ladder pointless`);
  }
});

test('rare swords are found, not bought from the smith', () => {
  const smith = new Set(SHOPS.smith.stock.map((l) => l.id));
  const drops = new Set(Object.values(MONSTERS).flatMap((m) => m.drops.map((d) => d.id)));
  const tickets = new Set(SHOPS.dawn.stock.map((l) => l.id));
  for (const r of Object.values(RARE_SWORDS)) {
    assert.ok(!smith.has(r.id), `the smith sells ${r.id}`);
    assert.ok(drops.has(r.id) || tickets.has(r.id), `${r.id} cannot be had at all`);
  }
});
