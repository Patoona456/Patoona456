// The swordsman's ladders: the common starters and the rare sheet on
// five-level steps from Lv.1 to Lv.120, and the epic and legendary sheets over
// the same span: a grade is not a band. And the weapon boxes that hold them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, SWORDS, RARE_SWORDS, EPIC_SWORDS, LEGENDARY_SWORDS, MYTHIC_SWORDS, WEAPON_BOXES, BOX_ODDS } from '../shared/data/items.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { SHOPS } from '../shared/data/npcs.js';

const byLevel = (set) => Object.values(set).sort((a, b) => a.level - b.level);

test('each ladder runs its span, climbing, one picture each', () => {
  for (const [set, n, from, to] of [[SWORDS, 24, 1, 120], [RARE_SWORDS, 25, 1, 120], [EPIC_SWORDS, 23, 1, 120], [LEGENDARY_SWORDS, 25, 1, 120], [MYTHIC_SWORDS, 26, 1, 120]]) {
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

test('a legendary sword beats the epic one of its level, and stays within reach of it', () => {
  const epics = byLevel(EPIC_SWORDS), commons = byLevel(SWORDS);
  for (const l of byLevel(LEGENDARY_SWORDS)) {
    const e = epics.filter((w) => w.level <= l.level).pop();
    const c = commons.filter((w) => w.level <= l.level).pop();
    assert.ok(l.atk > e.atk, `${l.id} (${l.atk}) is not above ${e.id} (${e.atk})`);
    assert.ok(l.atk < c.atk * 1.8, `${l.id} leaves the other ladders behind`);
    assert.equal(l.rarity, 'legendary');
  }
});

test('legendary swords are found, never bought: every one drops or comes out of a box, rarest of all', () => {
  const sold = new Set(Object.values(SHOPS).flatMap((s) => s.stock.map((l) => l.id)));
  const chance = {};
  for (const m of Object.values(MONSTERS)) for (const d of m.drops) if (!m.boss) chance[d.id] = Math.max(chance[d.id] ?? 0, d.chance);
  const anyDrop = new Set(Object.values(MONSTERS).flatMap((m) => m.drops.map((d) => d.id)));
  const boxed = new Set(Object.values(WEAPON_BOXES).flatMap((b) => b.opens.map((o) => o.id)));
  for (const l of Object.values(LEGENDARY_SWORDS)) {
    assert.ok(!sold.has(l.id), `${l.id} is on a shelf`);
    assert.ok(anyDrop.has(l.id) || boxed.has(l.id), `${l.id} cannot be had`);
  }
  const top = (set) => Math.max(...Object.values(set).map((w) => chance[w.id] ?? 0));
  assert.ok(top(LEGENDARY_SWORDS) < top(EPIC_SWORDS), 'a legendary is as easy to find as an epic');
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

test('every grade starts at Lv.1: a new character can find an epic or a legendary', () => {
  for (const set of [RARE_SWORDS, EPIC_SWORDS, LEGENDARY_SWORDS, MYTHIC_SWORDS]) assert.equal(byLevel(set)[0].level, 1);
});

test('the weapon boxes hold every grade of their band, the better ones more rarely', () => {
  const grades = ['common', 'rare', 'epic', 'legendary', 'mythic'];
  const covered = new Set();
  for (const box of Object.values(WEAPON_BOXES)) {
    const [from, to] = box.band;
    const share = Object.fromEntries(grades.map((g) => [g, 0]));
    for (const o of box.opens) {
      const w = ITEMS[o.id];
      assert.ok(w?.wclass === 'sword', `${box.id} holds the unknown ${o.id}`);
      assert.ok(w.level >= from && w.level <= to, `${box.id} holds ${o.id} from outside its band`);
      share[w.rarity] += o.weight;
      covered.add(o.id);
    }
    for (const g of grades) assert.ok(Math.abs(share[g] - BOX_ODDS[g]) < 1e-9, `${box.id}: ${g} is ${share[g]}, not ${BOX_ODDS[g]}`);
    for (let i = 1; i < grades.length; i++) assert.ok(share[grades[i]] < share[grades[i - 1]], `${box.id}: ${grades[i]} is no rarer`);
  }
  // between them the boxes hold every sword there is
  for (const set of [SWORDS, RARE_SWORDS, EPIC_SWORDS, LEGENDARY_SWORDS, MYTHIC_SWORDS]) {
    for (const w of Object.values(set)) assert.ok(covered.has(w.id), `no box holds ${w.id}`);
  }
});

test('weapon boxes drop in the field and from bosses, and the ticket counter has them', () => {
  const drops = new Set(Object.values(MONSTERS).flatMap((m) => m.drops.map((d) => d.id)));
  const bossDrops = new Set(Object.values(MONSTERS).filter((m) => m.boss).flatMap((m) => m.drops.map((d) => d.id)));
  const counter = new Set(SHOPS.dawn.stock.map((l) => l.id));
  assert.ok(drops.has('box_weapon_1') && drops.has('box_weapon_2'), 'the field drops no weapon box');
  assert.ok([...bossDrops].some((id) => WEAPON_BOXES[id]), 'no boss drops a weapon box');
  for (const id of Object.keys(WEAPON_BOXES)) assert.ok(counter.has(id), `${id} is not at the ticket counter`);
});

test('a mythic sword beats the legendary one of its level, and there is one at the level cap', () => {
  const legends = byLevel(LEGENDARY_SWORDS), commons = byLevel(SWORDS);
  for (const m of byLevel(MYTHIC_SWORDS)) {
    const l = legends.filter((w) => w.level <= m.level).pop();
    const c = commons.filter((w) => w.level <= m.level).pop();
    assert.ok(m.atk > l.atk, `${m.id} (${m.atk}) is not above ${l.id} (${l.atk})`);
    assert.ok(m.atk < c.atk * 2, `${m.id} leaves everything behind`);
    assert.equal(m.rarity, 'mythic');
  }
  assert.ok(MYTHIC_SWORDS.sword_mythic_99, 'no mythic at the level cap');
});

test('mythic is the rarest grade: rarer from monsters than legendary, never sold', () => {
  const sold = new Set(Object.values(SHOPS).flatMap((s) => s.stock.map((l) => l.id)));
  const chance = {};
  for (const m of Object.values(MONSTERS)) for (const d of m.drops) if (!m.boss) chance[d.id] = Math.max(chance[d.id] ?? 0, d.chance);
  const top = (set) => Math.max(...Object.values(set).map((w) => chance[w.id] ?? 0));
  assert.ok(top(MYTHIC_SWORDS) < top(LEGENDARY_SWORDS), 'a mythic is as easy to find as a legendary');
  for (const m of Object.values(MYTHIC_SWORDS)) assert.ok(!sold.has(m.id), `${m.id} is on a shelf`);
});
