// The swordsman's ladders: the common starters and the rare sheet on
// five-level steps from Lv.1 to Lv.120, and the epic sheet from Lv.45 to Lv.70.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SWORDS, RARE_SWORDS, EPIC_SWORDS } from '../shared/data/items.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { SHOPS } from '../shared/data/npcs.js';

const byLevel = (set) => Object.values(set).sort((a, b) => a.level - b.level);

test('each ladder runs its span, climbing, one picture each', () => {
  for (const [set, n, from, to] of [[SWORDS, 24, 1, 120], [RARE_SWORDS, 25, 1, 120], [EPIC_SWORDS, 23, 45, 70]]) {
    const list = byLevel(set);
    assert.equal(list.length, n);
    assert.equal(list[0].level, from);
    assert.equal(list.at(-1).level, to);
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

test('an epic sword beats the rare one of its level, and is still a sword of that level', () => {
  const commons = byLevel(SWORDS), rares = byLevel(RARE_SWORDS);
  for (const e of byLevel(EPIC_SWORDS)) {
    const r = rares.filter((w) => w.level <= e.level).pop();
    const c = commons.filter((w) => w.level <= e.level).pop();
    assert.ok(e.atk > r.atk, `${e.id} (${e.atk}) is not above ${r.id} (${r.atk})`);
    assert.ok(e.atk < c.atk * 1.6, `${e.id} skips a whole tier`);
    assert.equal(e.rarity, 'epic');
  }
});

test('epic swords only drop, and bosses are the likeliest source', () => {
  const sold = new Set(Object.values(SHOPS).flatMap((s) => s.stock.map((l) => l.id)));
  const bossPays = new Set(Object.values(MONSTERS).filter((m) => m.boss).flatMap((m) => m.drops.map((d) => d.id)));
  const anyDrop = new Set(Object.values(MONSTERS).flatMap((m) => m.drops.map((d) => d.id)));
  for (const e of Object.values(EPIC_SWORDS)) assert.ok(!sold.has(e.id), `${e.id} is on a shelf`);
  assert.ok(Object.values(EPIC_SWORDS).some((e) => bossPays.has(e.id)), 'no boss pays an epic sword');
  assert.ok(Object.values(EPIC_SWORDS).filter((e) => anyDrop.has(e.id)).length >= 5, 'hardly any epic sword can drop');
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
