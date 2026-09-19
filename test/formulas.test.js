// The maths the whole game balances on.
//
// These are the numbers docs/ECONOMY.md makes promises about. If one of them
// moves, the promise is broken somewhere - so the test asserts the *shape*
// (monotonic, bounded, the right side of a threshold) rather than exact
// values, which would make every deliberate tuning pass a failure.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  baseExpToNext, jobExpToNext, statCost, hitChance, elementMultiplier,
  npcSellPrice, marketTax, refineChance, refineCost, deriveStats,
} from '../shared/formulas.js';
import { ELEMENTS, ELEMENT_TABLE } from '../shared/constants.js';

test('experience curves only ever go up', () => {
  for (let lv = 1; lv < 99; lv++) {
    assert.ok(baseExpToNext(lv + 1) > baseExpToNext(lv), `base curve dipped at ${lv}`);
    assert.ok(jobExpToNext(lv + 1) > jobExpToNext(lv), `job curve dipped at ${lv}`);
  }
});

test('levels are content, not a formality: 1-99 costs over a million XP', () => {
  let total = 0;
  for (let lv = 1; lv < 99; lv++) total += baseExpToNext(lv);
  assert.ok(total > 1_000_000, `only ${total} XP to cap`);
});

test('stat points get dearer as the stat grows', () => {
  assert.equal(statCost(1), 2);
  for (let s = 1; s < 99; s++) assert.ok(statCost(s + 1) >= statCost(s));
  assert.ok(statCost(90) > statCost(10));
});

test('hit chance stays inside its clamps', () => {
  for (const [hit, flee] of [[0, 9999], [9999, 0], [100, 100], [80, 60]]) {
    const c = hitChance(hit, flee);
    assert.ok(c >= 0 && c <= 1, `${hit}v${flee} -> ${c}`);
  }
  assert.ok(hitChance(300, 50) > hitChance(50, 300), 'more HIT should beat more FLEE');
});

test('the element table is square, complete and symmetric in shape', () => {
  for (const a of ELEMENTS) {
    assert.ok(ELEMENT_TABLE[a], `no row for ${a}`);
    for (const d of ELEMENTS) {
      const v = ELEMENT_TABLE[a][d];
      assert.equal(typeof v, 'number', `${a} vs ${d} missing`);
      assert.ok(v > 0 && v <= 2, `${a} vs ${d} = ${v} is outside the sane range`);
      assert.equal(elementMultiplier(a, d), v);
    }
  }
});

test('every element is weak to something and strong against something', () => {
  for (const a of ELEMENTS) {
    if (a === 'neutral') continue;               // neutral is deliberately flat
    const row = Object.values(ELEMENT_TABLE[a]);
    assert.ok(Math.max(...row) > 1, `${a} is never effective`);
    const column = ELEMENTS.map((x) => ELEMENT_TABLE[x][a]);
    assert.ok(Math.max(...column) > 1, `nothing counters ${a}`);
  }
});

test('an unknown element is treated as neutral rather than throwing', () => {
  assert.equal(elementMultiplier('nonsense', 'fire'), 1);
  assert.equal(elementMultiplier('fire', 'nonsense'), 1);
});

test('selling the same thing to an NPC pays less each time', () => {
  const first = npcSellPrice(1000, 0);
  const tenth = npcSellPrice(1000, 10);
  const fiftieth = npcSellPrice(1000, 50);
  assert.ok(first > tenth && tenth > fiftieth, 'the dampener is not damping');
  assert.ok(first <= 1000 * 0.4, 'NPCs should never be a good price');
  assert.ok(fiftieth >= 0, 'the price must not go negative');
});

test('the market takes a cut, and the cut grows with the price', () => {
  assert.ok(marketTax(1000) > 0);
  assert.ok(marketTax(100000) > marketTax(1000));
});

test('refining gets harder and costlier the higher it goes', () => {
  for (let lv = 0; lv < 14; lv++) {
    assert.ok(refineChance(lv) >= refineChance(lv + 1), `odds rose at +${lv}`);
    assert.ok(refineCost(10000, lv) <= refineCost(10000, lv + 1), `cost fell at +${lv}`);
  }
  assert.ok(refineChance(0) <= 1 && refineChance(14) > 0, 'odds left the 0..1 range');
  assert.ok(refineChance(10) < 0.5, '+10 should be a gamble, not a formality');
});

test('derived stats grow with the stat that feeds them', () => {
  const job = { hpMod: 1, spMod: 1 };
  const base = { level: 50, jobLevel: 30, str: 30, agi: 30, vit: 30, int: 30, dex: 30, luk: 30 };
  const a = deriveStats(base, job);
  const b = deriveStats({ ...base, vit: 60 }, job);
  const c = deriveStats({ ...base, str: 60 }, job);
  assert.ok(b.maxHp > a.maxHp, 'VIT did not raise HP');
  assert.ok(c.atk > a.atk, 'STR did not raise ATK');
  assert.ok(a.maxHp > 0 && a.maxSp > 0 && a.atk > 0);
});
