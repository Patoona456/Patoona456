// Quest balance.
//
// The rule docs/ECONOMY.md commits to is that a quest is a bonus for
// following the story, not a way around playing it: its experience should be
// worth roughly one to three times the hunting it asks for. A quest that pays
// ten times the grind quietly turns the whole level curve into a formality,
// and it is invisible in review - the number looks like all the others.
import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTS } from '../shared/data/quests.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { WAITING_FOR_MONSTERS } from './fixtures/bestiary.js';
import { MAPS } from '../shared/data/maps.js';
import { ITEMS, RECIPES } from '../shared/data/items.js';
import { SHOPS } from '../shared/data/npcs.js';
import { baseExpToNext } from '../shared/formulas.js';

/** The experience you earn just by completing a quest's kill objectives. */
function grindExp(q) {
  let exp = 0;
  for (const o of q.objectives ?? []) {
    if (o.type !== 'kill') continue;
    exp += (MONSTERS[o.mob]?.exp ?? 0) * (o.count ?? 1);
  }
  return exp;
}

const oneTime = Object.values(QUESTS).filter((q) => !q.repeatable);
const dailies = Object.values(QUESTS).filter((q) => q.repeatable === 'daily');

test('every quest pays something for doing it', () => {
  for (const q of Object.values(QUESTS)) {
    const r = q.rewards ?? {};
    assert.ok((r.exp ?? 0) > 0 || (r.aurum ?? 0) > 0 || (r.items ?? []).length,
      `${q.id} pays nothing at all`);
  }
});

test('no quest pays wildly more experience than the hunting it asks for', () => {
  const bad = [];
  for (const q of oneTime) {
    const grind = grindExp(q);
    if (grind < 200) continue;                 // collect-only or trivial: nothing to compare
    const ratio = (q.rewards.exp ?? 0) / grind;
    if (ratio > 4) bad.push(`${q.id}: pays ${ratio.toFixed(1)}x the grind`);
  }
  assert.deepEqual(bad, [], `quests that skip the game:\n  ${bad.join('\n  ')}`);
});

test('a daily is worth clearly less than the one-time quests beside it', () => {
  for (const d of dailies) {
    const band = oneTime.filter((q) => Math.abs((q.minLevel ?? 1) - (d.minLevel ?? 1)) <= 8);
    if (!band.length) continue;
    const median = band.map((q) => q.rewards.aurum ?? 0).sort((a, b) => a - b)[Math.floor(band.length / 2)];
    if (!median) continue;
    assert.ok((d.rewards.aurum ?? 0) <= median,
      `${d.id} pays ${d.rewards.aurum} a day, more than the one-time quests around it (${median})`);
  }
});

test('no single quest hands over a whole level', () => {
  for (const q of Object.values(QUESTS)) {
    const need = baseExpToNext(q.minLevel ?? 1);
    assert.ok((q.rewards.exp ?? 0) < need * 3,
      `${q.id} pays ${q.rewards.exp} XP at level ${q.minLevel}, where a level costs ${need}`);
  }
});

test('quests send you somewhere your level belongs', () => {
  for (const q of Object.values(QUESTS)) {
    const zone = MAPS[q.zone];
    if (!zone?.levelRange) continue;
    const [lo, hi] = zone.levelRange;
    const lv = q.minLevel ?? 1;
    assert.ok(lv >= lo - 6 && lv <= hi + 2,
      `${q.id} is for level ${lv} but sends you to ${q.zone} (${lo}-${hi})`);
  }
});

test('a quest never asks for a monster that does not live in its zone', () => {
  for (const q of Object.values(QUESTS)) {
    const zone = MAPS[q.zone];
    if (!zone) continue;
    const here = new Set((zone.spawns ?? []).map((s) => s.mob));
    for (const o of q.objectives ?? []) {
      if (o.type !== 'kill') continue;
      assert.ok(here.has(o.mob), `${q.id} asks for ${o.mob}, which does not spawn in ${q.zone}`);
    }
  }
});

test('a quest never asks you to collect something nothing drops', () => {
  // everything a player can end up holding, by any route
  const obtainable = new Set();
  for (const m of Object.values(MONSTERS)) for (const d of m.drops ?? []) obtainable.add(d.id);
  for (const def of Object.values(ITEMS)) for (const row of def.opens ?? []) obtainable.add(row.id);
  for (const shop of Object.values(SHOPS)) for (const l of shop.stock) obtainable.add(l.id);
  for (const r of Object.values(RECIPES)) obtainable.add(r.out.id);

  for (const q of Object.values(QUESTS)) {
    for (const o of q.objectives ?? []) {
      if (o.type !== 'collect') continue;
      assert.ok(obtainable.has(o.item),
        `${q.id} wants ${o.item}, which nothing drops, sells, opens into or crafts`);
    }
  }
});

test('the level bands all have something to do', { skip: WAITING_FOR_MONSTERS }, () => {
  const bands = [[1, 9], [10, 19], [20, 29], [30, 39], [40, 49], [50, 59], [60, 70]];
  const thin = [];
  for (const [lo, hi] of bands) {
    const n = Object.values(QUESTS).filter((q) => (q.minLevel ?? 1) >= lo && (q.minLevel ?? 1) <= hi).length;
    if (n < 2) thin.push(`Lv${lo}-${hi}: ${n} quest(s)`);
  }
  assert.deepEqual(thin, [], `level bands with nothing to do:\n  ${thin.join('\n  ')}`);
});

test('the endgame chain is reachable: every quest has a giver the world contains', () => {
  const npcIds = new Set();
  const npcRoles = new Set();
  for (const m of Object.values(MAPS)) {
    for (const npc of m.npcs ?? []) { npcIds.add(npc.id); npcRoles.add(npc.role); }
  }
  for (const q of Object.values(QUESTS)) {
    assert.ok(npcIds.has(q.giver) || npcRoles.has(q.giver),
      `${q.id} is given by "${q.giver}", who is nowhere in the world`);
  }
});

test('weekly quests line up with the bosses they ask for', () => {
  for (const q of Object.values(QUESTS)) {
    if (q.repeatable !== 'weekly') continue;
    const bosses = (q.objectives ?? []).filter((o) => o.type === 'kill' && MONSTERS[o.mob]?.boss);
    assert.ok(bosses.length, `${q.id} repeats weekly but does not ask for a boss`);
    for (const o of bosses) assert.equal(o.count, 1, `${q.id} asks for ${o.count} bosses in a week`);
  }
});
