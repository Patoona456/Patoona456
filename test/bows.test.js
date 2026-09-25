// The archer's plain bows: one ladder from Lv.1 to Lv.120, a touch softer
// than the sword of the same level and much longer in reach.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BOWS, SWORDS, WEAPON_BOXES } from '../shared/data/items.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { WAITING_FOR_MONSTERS } from './fixtures/bestiary.js';
import { SHOPS } from '../shared/data/npcs.js';
import { JOBS } from '../shared/data/jobs.js';

const byLevel = (set) => Object.values(set).sort((a, b) => a.level - b.level);

test('twenty-one bows, Lv.1 to Lv.120, each stronger, longer and on its own picture', () => {
  const list = byLevel(BOWS);
  assert.equal(list.length, 21);
  assert.equal(list[0].level, 1);
  assert.equal(list.at(-1).level, 120);
  assert.equal(new Set(list.map((b) => b.art)).size, 21);
  for (let i = 1; i < list.length; i++) {
    assert.ok(list[i].atk > list[i - 1].atk, `${list[i].id} is no stronger`);
    assert.ok(list[i].range >= list[i - 1].range, `${list[i].id} reaches less far`);
  }
  for (const b of list) {
    assert.equal(b.wclass, 'bow');
    assert.ok(b.twoHanded);
  }
});

test('a bow trades a little damage for a lot of reach against the sword of its level', () => {
  const swords = byLevel(SWORDS);
  for (const b of byLevel(BOWS)) {
    const s = swords.filter((w) => w.level <= b.level).pop();
    assert.ok(b.atk < s.atk, `${b.id} (${b.atk}) hits as hard as ${s.id} (${s.atk})`);
    assert.ok(b.atk > s.atk * 0.8, `${b.id} is too soft to be worth drawing`);
    assert.ok(b.range > s.range * 3, `${b.id} barely outreaches a sword`);
  }
});

test('the jobs that shoot can find a bow: the smith, the field and the boxes', { skip: WAITING_FOR_MONSTERS }, () => {
  assert.ok(Object.values(JOBS).some((j) => j.weapons?.includes('bow')), 'no job uses a bow');
  const smith = new Set(SHOPS.smith.stock.map((l) => l.id));
  const drops = new Set(Object.values(MONSTERS).flatMap((m) => m.drops.map((d) => d.id)));
  const boxed = new Set(Object.values(WEAPON_BOXES).flatMap((b) => b.opens.map((o) => o.id)));
  assert.ok(byLevel(BOWS).filter((b) => smith.has(b.id)).length >= 15, 'the smith sells hardly any bows');
  for (const b of Object.values(BOWS)) assert.ok(boxed.has(b.id), `no weapon box holds ${b.id}`);
  assert.ok(Object.values(BOWS).filter((b) => drops.has(b.id)).length >= 8, 'bows hardly drop');
});
