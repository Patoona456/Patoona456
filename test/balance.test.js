// Does the game still play the way the design says it does?
//
// Every other test here checks that code does what it was written to do. This
// one checks something the code cannot tell you: whether the thousands of
// hand-written numbers in shared/data still add up to a game worth playing.
// It is the same analysis `npm run balance` prints, asserted instead of shown,
// so a monster given four times its health in a data-only commit fails CI
// rather than quietly turning twenty levels into a slog.
//
// The thresholds are deliberately wide. They are not a description of good
// tuning - they are the edges past which something is definitely broken.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MONSTERS } from '../shared/data/monsters.js';
import { MAPS } from '../shared/data/maps.js';
import { ITEMS, RECIPES, CRAFTING_INPUTS } from '../shared/data/items.js';
import { SHOPS } from '../shared/data/npcs.js';
import { expGapPenalty, npcSellPrice } from '../shared/formulas.js';
import {
  LEVEL_CAP, KILL_SECONDS, HOURS_TO_CAP, TRAVEL_SECONDS,
  character, killSeconds, monsterDps, survivable, soloMonsters, bestAt, hoursToCap,
  bestHeal, incomePerHour,
} from '../tools/balance.js';

test('every solo monster dies in a sensible number of seconds', () => {
  const bad = [];
  for (const mob of soloMonsters()) {
    const c = character(Math.min(LEVEL_CAP, mob.level));
    const secs = killSeconds(c, mob);
    if (!(secs >= KILL_SECONDS.min && secs <= KILL_SECONDS.max)) {
      bad.push(`${mob.id} (Lv${mob.level}) ${isFinite(secs) ? secs.toFixed(1) + 's' : 'unkillable'}`);
    }
  }
  assert.deepEqual(bad, [], 'outside ' + KILL_SECONDS.min + '-' + KILL_SECONDS.max + 's: ' + bad.join(', '));
});

test('there is something worth killing, and something survivable, at every level', () => {
  const gaps = [];
  for (let lv = 1; lv <= LEVEL_CAP; lv++) if (!bestAt(lv)) gaps.push(lv);
  assert.deepEqual(gaps, [], 'no hunting ground at level ' + gaps.join(', '));
});

test('a solo monster cannot kill a same-level character faster than it dies', () => {
  const bad = [];
  for (const mob of soloMonsters()) {
    const c = character(Math.min(LEVEL_CAP, mob.level));
    const secs = killSeconds(c, mob);
    if (!isFinite(secs)) continue;
    const cost = monsterDps(mob, c) * secs / (c.derived.maxHp || 1);
    if (cost > 0.6) bad.push(`${mob.id} costs ${(cost * 100).toFixed(0)}% of the health bar`);
  }
  assert.deepEqual(bad, [], bad.join(', '));
});

test('no monster is so efficient that it owns a whole stretch of the game', () => {
  const { bands } = hoursToCap();
  let owner = null, from = 1;
  const reigns = [];
  for (const b of bands) {
    if (b.gap) continue;
    if (b.mob.id !== owner) { if (owner) reigns.push([owner, from, b.lv - 1]); owner = b.mob.id; from = b.lv; }
  }
  if (owner) reigns.push([owner, from, LEVEL_CAP - 1]);
  const long = reigns.filter(([, a, z]) => z - a >= 12);
  assert.deepEqual(long.map(([id, a, z]) => `${id} owns ${a}-${z}`), []);
});

test('reaching the cap takes a while, but not a second job', () => {
  const { hours } = hoursToCap();
  assert.ok(hours >= HOURS_TO_CAP.min, `only ${hours.toFixed(1)}h to cap`);
  assert.ok(hours <= HOURS_TO_CAP.max, `${hours.toFixed(1)}h to cap`);
});

test('the back half of the game is the longer half', () => {
  // Front-loading is how a game runs out of content: if half the grind is
  // over by level 30 the last forty levels are where everyone quits.
  const { hours, bands } = hoursToCap();
  const half = bands.find((b) => b.hours >= hours / 2);
  assert.ok(half && half.lv >= LEVEL_CAP * 0.45, `half the grind done by level ${half?.lv}`);
});

test('monsters sharing a zone are all worth killing', () => {
  const bad = [];
  for (const [id, map] of Object.entries(MAPS)) {
    const spawns = [...new Set((map.spawns ?? []).map((s) => s.mob))]
      .map((x) => MONSTERS[x]).filter((m) => m && !m.boss);
    if (spawns.length < 2) continue;
    const mid = Math.round(spawns.reduce((n, m) => n + m.level, 0) / spawns.length);
    const c = character(Math.min(LEVEL_CAP, mid));
    const hands = map.party ? 4 : 1;
    const rated = spawns
      .filter((m) => Math.abs(m.level - mid) <= 6 && m.level >= mid * 0.55)   // ambient spawns are scenery
      .map((m) => m.exp / (killSeconds(c, m) / hands))
      .sort((a, b) => b - a);
    if (rated.length < 2) continue;
    const worst = rated[rated.length - 1] / rated[0];
    if (worst < 0.3) bad.push(`${id}: worst spawn is ${(worst * 100).toFixed(0)}% of the best`);
  }
  assert.deepEqual(bad, [], bad.join('; '));
});

test('accuracy and evasion stay on the same curve as the player', () => {
  // The bug this catches: monster flee climbing far faster than player hit,
  // until every attack misses and a kill takes three minutes.
  const bad = [];
  for (const mob of Object.values(MONSTERS)) {
    if (mob.summon) continue;
    const c = character(Math.min(LEVEL_CAP, mob.level));
    const toHit = Math.min(0.95, Math.max(0.05, (c.derived.hit - mob.flee + 80) / 100));
    if (toHit < 0.5) bad.push(`${mob.id} is only hit ${(toHit * 100).toFixed(0)}% of the time`);
    const beHit = Math.min(0.95, Math.max(0.05, (mob.hit - c.derived.flee + 80) / 100));
    if (beHit > 0.92) bad.push(`${mob.id} hits ${(beHit * 100).toFixed(0)}% of the time, so evasion is worthless`);
  }
  assert.deepEqual(bad, [], bad.join('; '));
});

test('experience falls away below your level, and leeching pays badly', () => {
  assert.equal(expGapPenalty(50, 50), 1);
  assert.equal(expGapPenalty(50, 54), 1);                       // above you pays in full
  assert.ok(expGapPenalty(50, 40) < 0.5, 'ten levels down still pays half');
  assert.ok(expGapPenalty(50, 30) < 0.15, 'twenty levels down is still worth it');
  assert.equal(expGapPenalty(20, 60), 0.25);                    // dragged along

  // The curve peaks over the band around your level and falls away on both
  // sides. What matters is that neither side has a cliff in it: a step down
  // is what let one cheap monster stay optimal for twenty-five levels.
  for (let mob = 1; mob < 50; mob++) {
    const here = expGapPenalty(50, mob), next = expGapPenalty(50, mob + 1);
    assert.ok(next >= here, `penalty dips going up to mob level ${mob + 1}`);
    assert.ok(next - here < 0.2, `cliff in the penalty at mob level ${mob + 1}`);
  }
  for (let mob = 50; mob < 99; mob++) {
    const here = expGapPenalty(50, mob), next = expGapPenalty(50, mob + 1);
    assert.ok(next <= here, `penalty rises going up to mob level ${mob + 1}`);
    assert.ok(here - next < 0.2, `cliff in the penalty at mob level ${mob + 1}`);
  }
});

test('the travel cost is what stops the report recommending trash forever', () => {
  assert.ok(TRAVEL_SECONDS > 0);
  const c = character(60);
  const trash = MONSTERS.mire_slime;
  assert.ok(!survivable(c, MONSTERS.reliquary_warden, 30), 'the party warden should not read as solo-safe');
  assert.ok(survivable(c, trash, killSeconds(c, trash)), 'a slime should not threaten a level-60 character');
});

/* --- the economy the balance model can see -------------------------------
   docs/ECONOMY.md makes numeric promises, and every one of them is a claim
   about data that a later commit can break by accident. These assert the
   promises rather than the prose. */

test('healing keeps pace with the health bar', () => {
  const bad = [];
  for (let lv = 5; lv <= LEVEL_CAP; lv += 5) {
    const potion = bestHeal(lv);
    const bar = character(lv).derived.maxHp;
    if (!potion) { bad.push(`nothing heals a level-${lv} character`); continue; }
    const share = potion.heal / bar;
    if (share < 0.25) bad.push(`level ${lv}: best potion refills ${(share * 100).toFixed(0)}% of the bar`);
  }
  assert.deepEqual(bad, [], bad.join('; '));
});

test('resting is a real alternative to drinking', () => {
  // If sitting down costs many times the fight itself, potions stop being a
  // choice and the economy runs permanently in the red.
  const bad = [];
  for (let lv = 5; lv <= LEVEL_CAP; lv += 5) {
    const m = incomePerHour(lv);
    if (!m) continue;
    if (m.restSeconds > 6 * m.secs) {
      bad.push(`level ${lv}: ${m.restSeconds.toFixed(0)}s of resting per ${m.secs.toFixed(0)}s fight`);
    }
  }
  assert.deepEqual(bad, [], bad.join('; '));
});

test('a potion costs what the economy doc says it costs', () => {
  const bad = [];
  for (let lv = 5; lv <= LEVEL_CAP; lv += 5) {
    const m = incomePerHour(lv);
    if (!m || !m.potion) continue;
    if (m.killsPerPotion < 5) bad.push(`level ${lv}: a potion is only ${m.killsPerPotion.toFixed(0)} kills`);
    if (m.killsPerPotion > 40) bad.push(`level ${lv}: a potion is ${m.killsPerPotion.toFixed(0)} kills`);
  }
  assert.deepEqual(bad, [], bad.join('; '));
});

test('income grows with level and no band is a dead zone', () => {
  const rows = [];
  for (let lv = 5; lv <= LEVEL_CAP; lv += 5) {
    const m = incomePerHour(lv);
    if (m) rows.push({ lv, au: m.resting.net });
  }
  assert.ok(rows.length > 10);
  assert.ok(rows[0].au < rows[rows.length - 1].au, 'the cap earns no more than the starter field');
  // Hundreds an hour at the very start, as the doc promises - not thousands.
  assert.ok(rows[0].au < 2000, `level 5 earns ${rows[0].au.toFixed(0)} AU/h`);
  for (let i = 1; i < rows.length; i++) {
    const drop = rows[i].au / rows[i - 1].au;
    assert.ok(drop > 0.35,
      `income falls off a cliff at level ${rows[i].lv}: ${rows[i - 1].au.toFixed(0)} -> ${rows[i].au.toFixed(0)} AU/h`);
  }
});

test('the vendor is not a coin faucet for the crafting economy', () => {
  // Selling a crafting ingredient to an NPC must never beat what it is worth
  // as an ingredient, or the materials the whole economy runs on have no
  // player market and coins print themselves.
  for (const id of CRAFTING_INPUTS) {
    const it = ITEMS[id];
    if (!it) continue;
    const paid = npcSellPrice(it.value ?? 0, 0, it.rarity, true);
    assert.ok(paid <= (it.value ?? 0) * 0.06 + 1,
      `${id} vendors for ${paid} against a value of ${it.value}`);
  }
  // And rarity alone still has to bite, for everything else.
  assert.ok(npcSellPrice(10000, 0, 'rare') < npcSellPrice(10000, 0, 'common') / 4);
});

test('every recipe can actually be made from things that drop', () => {
  const dropped = new Set();
  for (const m of Object.values(MONSTERS)) for (const d of m.drops ?? []) dropped.add(d.id);
  const craftable = new Set(Object.keys(RECIPES).map((k) => RECIPES[k].out.id));
  const shopped = new Set(Object.values(SHOPS).flatMap((s) => (s.stock ?? []).map((x) => x.id)));
  const unreachable = [];
  for (const r of Object.values(RECIPES)) {
    for (const i of r.in) {
      if (!dropped.has(i.id) && !craftable.has(i.id) && !shopped.has(i.id)) unreachable.push(`${r.out.id} needs ${i.id}, which nothing provides`);
    }
  }
  assert.deepEqual(unreachable, [], unreachable.join('; '));
});
