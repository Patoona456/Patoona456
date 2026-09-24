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
import { ITEMS, RECIPES, CRAFTING_INPUTS, isEquip } from '../shared/data/items.js';
import { SHOPS } from '../shared/data/npcs.js';
import { QUESTS } from '../shared/data/quests.js';
import { JOBS } from '../shared/data/jobs.js';
import { GACHA } from '../server/game/economy.js';
import { expGapPenalty, npcSellPrice } from '../shared/formulas.js';
import { SKILLS, val, skillCost } from '../shared/data/skills.js';
import { ELEMENT_TABLE } from '../shared/constants.js';
import {
  LEVEL_CAP, KILL_SECONDS, HOURS_TO_CAP, TRAVEL_SECONDS,
  character, killSeconds, monsterDps, survivable, soloMonsters, bestAt, hoursToCap,
  bestHeal, incomePerHour, typical, charsAt,
} from '../tools/balance.js';

// These check the whole item set - gear at every level, a weapon for every job,
// what fights cost wearing it. The old set was cleared for the new item
// sheet, so they wait until the table has gear in it again.
const WAITING_FOR_ITEMS = !Object.values(ITEMS).some((it) => it.type === 'armor')
  && 'the item set is only partly in (no armour yet): waiting for the rest of the sheets';

test('every solo monster dies in a sensible number of seconds', { skip: WAITING_FOR_ITEMS }, () => {
  // Measured by the median job of that level, which is what the reports and
  // the tuning pass use. Ten second-tier jobs kill the same thing at very
  // different speeds; holding every one of them to the same band would mean
  // a tank must kill as fast as an arcanist, which is not the game.
  const bad = [];
  for (const mob of soloMonsters()) {
    const t = typical(Math.min(LEVEL_CAP, mob.level), mob);
    const secs = t ? t.secs : Infinity;
    if (!(secs >= KILL_SECONDS.min && secs <= KILL_SECONDS.max)) {
      bad.push(`${mob.id} (Lv${mob.level}) ${isFinite(secs) ? secs.toFixed(1) + 's' : 'unkillable'}`);
    }
  }
  assert.deepEqual(bad, [], 'outside ' + KILL_SECONDS.min + '-' + KILL_SECONDS.max + 's: ' + bad.join(', '));
});

test('there is something worth killing, and something survivable, at every level', { skip: WAITING_FOR_ITEMS }, () => {
  const gaps = [];
  for (let lv = 1; lv <= LEVEL_CAP; lv++) if (!bestAt(lv)) gaps.push(lv);
  assert.deepEqual(gaps, [], 'no hunting ground at level ' + gaps.join(', '));
});

test('a solo monster cannot kill a same-level character faster than it dies', { skip: WAITING_FOR_ITEMS }, () => {
  const bad = [];
  for (const mob of soloMonsters()) {
    const t = typical(Math.min(LEVEL_CAP, mob.level), mob);
    if (!t) continue;
    const cost = monsterDps(mob, t.c) * t.secs / (t.c.derived.maxHp || 1);
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

test('reaching the cap takes a while, but not a second job', { skip: WAITING_FOR_ITEMS }, () => {
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
    const hands = map.party ? 4 : 1;
    const rated = spawns
      .filter((m) => Math.abs(m.level - mid) <= 6 && m.level >= mid * 0.55)   // ambient spawns are scenery
      .map((m) => m.exp / ((typical(Math.min(LEVEL_CAP, mid), m)?.secs ?? Infinity) / hands))
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

test('healing keeps pace with the health bar', { skip: WAITING_FOR_ITEMS }, () => {
  const bad = [];
  for (let lv = 5; lv <= LEVEL_CAP; lv += 5) {
    const potion = bestHeal(lv);
    // The squishiest job is the one a potion has to be worth something to.
    const bar = Math.min(...charsAt(lv).map((c) => c.derived.maxHp));
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

test('income grows with level and no band is a dead zone', { skip: WAITING_FOR_ITEMS }, () => {
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

/* --- what the skill model made visible ----------------------------------
   None of these could be asserted while the balance model only understood
   auto-attacks, because until then every job looked the same. */

test('no job is left several times behind the others', { skip: WAITING_FOR_ITEMS }, () => {
  const bad = [];
  const pool = soloMonsters();
  for (const lv of [10, 20, 30, 40, 50, 60, 70]) {
    const near = pool.filter((m) => Math.abs(m.level - lv) <= 4);
    if (!near.length) continue;
    const times = charsAt(lv).map((c) => {
      const t = near.map((m) => killSeconds(c, m)).filter(isFinite).sort((a, b) => a - b);
      return { job: c.job.id, secs: t.length ? t[0] : Infinity };
    }).sort((a, b) => a.secs - b.secs);
    const spread = times[times.length - 1].secs / times[0].secs;
    // A tank is meant to kill slower than an arcanist. Several times slower
    // is not a trade-off, it is a job nobody can level.
    if (spread > 3.5) {
      bad.push(`level ${lv}: ${times[0].job} ${times[0].secs.toFixed(1)}s vs ${times[times.length - 1].job} ${times[times.length - 1].secs.toFixed(1)}s`);
    }
  }
  assert.deepEqual(bad, [], bad.join('; '));
});

test('every job can sustain a fight long enough to finish it', { skip: WAITING_FOR_ITEMS }, () => {
  // Kill speed alone says nothing: a squishy job that kills fast is fine, and
  // a tough one that kills slowly is fine. A job that dies before it finishes
  // is not, whichever side it fails on.
  const bad = [];
  for (const lv of [20, 40, 60, 70]) {
    const near = soloMonsters().filter((m) => Math.abs(m.level - lv) <= 4);
    if (!near.length) continue;
    for (const c of charsAt(lv)) {
      const kills = near.map((m) => {
        const secs = killSeconds(c, m);
        const dps = monsterDps(m, c);
        return dps > 0 && isFinite(secs) ? (c.derived.maxHp / dps) / secs : Infinity;
      }).sort((a, b) => b - a)[0];
      if (kills < 2) bad.push(`level ${lv} ${c.job.id} manages ${kills.toFixed(1)} kills a health bar`);
    }
  }
  assert.deepEqual(bad, [], bad.join('; '));
});

test('SP regenerates fast enough for skills to be the loop, not the opener', () => {
  const bad = [];
  for (const lv of [20, 40, 60, 70]) {
    for (const c of charsAt(lv)) {
      const cheapest = (c.attacks ?? [])
        .filter((sk) => c.learned?.has(sk.id))
        .map((sk) => ({ sp: skillCost(sk, c.learned.get(sk.id)), cd: Math.max(0.5, val(sk.cooldown, c.learned.get(sk.id))) }))
        .sort((a, b) => (a.sp / a.cd) - (b.sp / b.cd))[0];
      if (!cheapest) continue;
      const perSecond = (c.derived.spRegen ?? 1) / 4;             // in combat
      if (perSecond * cheapest.cd < cheapest.sp * 0.4) {
        bad.push(`level ${lv} ${c.job.id} regains ${(perSecond * cheapest.cd).toFixed(0)} SP per ${cheapest.cd.toFixed(0)}s against a ${cheapest.sp} SP skill`);
      }
    }
  }
  assert.deepEqual(bad, [], bad.join('; '));
});

test('every weapon class has a rung to climb at a similar pace', () => {
  const ladders = {};
  for (const it of Object.values(ITEMS)) {
    if (it.slot !== 'weapon') continue;
    (ladders[it.wclass] ??= []).push(it.level ?? 1);
  }
  const bad = [];
  for (const [wclass, levels] of Object.entries(ladders)) {
    levels.sort((a, b) => a - b);
    // A class whose best weapon stops well short of the cap leaves whoever
    // plays it swinging something the rest of the game has left behind.
    if (levels[levels.length - 1] < LEVEL_CAP - 12) {
      bad.push(`${wclass} stops at level ${levels[levels.length - 1]}`);
    }
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] - levels[i - 1] > 22) bad.push(`${wclass} has nothing between level ${levels[i - 1]} and ${levels[i]}`);
    }
  }
  assert.deepEqual(bad, [], bad.join('; '));
});

/* --- the gear ladder ----------------------------------------------------- */

test('every piece of equipment has some way to obtain it', () => {
  // Thirty-one pieces - most of the mid and late armour ladder, and four of
  // the best weapons in the game - existed only in the item table. They were
  // not rare, they were unreachable, and nothing in the codebase said so.
  const reachable = new Set();
  for (const m of Object.values(MONSTERS)) for (const d of m.drops ?? []) reachable.add(d.id);
  for (const r of Object.values(RECIPES)) reachable.add(r.out.id);
  for (const shop of Object.values(SHOPS)) for (const x of shop.stock ?? []) reachable.add(x.id);
  for (const q of Object.values(QUESTS)) for (const it of q.rewards?.items ?? []) reachable.add(it.id);
  for (const it of Object.values(ITEMS)) for (const o of it.opens ?? []) reachable.add(o.id);
  for (const j of Object.values(JOBS)) for (const k of j.starterKit ?? []) reachable.add(k.id);
  for (const g of GACHA.pool) reachable.add(g.id);

  const orphans = Object.values(ITEMS)
    .filter((it) => it.slot && !reachable.has(it.id))
    .map((it) => `${it.id} (Lv${it.level ?? 1} ${it.slot})`);
  assert.deepEqual(orphans, [], `no way to get: ${orphans.join(', ')}`);
});

test('no equipment slot runs out of upgrades before the cap', () => {
  const ladders = {};
  for (const it of Object.values(ITEMS)) {
    if (!it.slot || it.type === 'ammo') continue;
    (ladders[it.slot] ??= []).push(it.level ?? 1);
  }
  const bad = [];
  for (const [slot, levels] of Object.entries(ladders)) {
    levels.sort((a, b) => a - b);
    if (levels[levels.length - 1] < LEVEL_CAP - 12) {
      bad.push(`${slot} stops at level ${levels[levels.length - 1]}`);
    }
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] - levels[i - 1] > 26) bad.push(`${slot} has nothing between level ${levels[i - 1]} and ${levels[i]}`);
    }
  }
  assert.deepEqual(bad, [], bad.join('; '));
});

test('a better potion is always a higher-level potion', () => {
  // `bestHeal` picks by how much a thing restores, so a level-8 dish that
  // out-heals a level-25 potion quietly becomes the answer for twenty levels.
  const heals = Object.values(ITEMS).filter((it) => it.heal).sort((a, b) => (a.level ?? 1) - (b.level ?? 1));
  for (let i = 1; i < heals.length; i++) {
    assert.ok(heals[i].heal >= heals[i - 1].heal,
      `${heals[i].id} (Lv${heals[i].level}) heals ${heals[i].heal}, less than ${heals[i - 1].id} (Lv${heals[i - 1].level}) at ${heals[i - 1].heal}`);
  }
});

test('the vendor is not a way to cash out gear', () => {
  // Gear drops are worth a fortune on paper. If an NPC pays a real fraction
  // of that, farming a drop table prints money and no player market forms.
  for (const it of Object.values(ITEMS)) {
    if (!isEquip(it)) continue;
    const paid = npcSellPrice(it.value ?? 0, 0, it.rarity, 'equip');
    assert.ok(paid <= (it.value ?? 0) * 0.02 + 1,
      `${it.id} vendors for ${paid} against a value of ${it.value}`);
  }
});

test('the starter field never picks a fight a new character loses', { skip: WAITING_FOR_ITEMS }, () => {
  // A level-1 character has whatever health the curve gives them and a
  // training blade. Anything in the first zone that comes to them has to be
  // beatable by them; everything else in there has to wait to be attacked.
  const c = character(1);
  const first = MAPS.greenmire;
  const bad = [];
  for (const sp of first.spawns ?? []) {
    const m = MONSTERS[sp.mob];
    if (!m || !m.aggressive) continue;               // passive spawns are the player's choice
    const secs = killSeconds(c, m);
    const dps = monsterDps(m, c);
    const survive = dps > 0 ? c.derived.maxHp / dps : Infinity;
    if (!(survive > secs * 2)) {
      bad.push(`${m.id} kills a fresh character in ${survive.toFixed(0)}s and takes ${secs.toFixed(0)}s to kill`);
    }
  }
  assert.deepEqual(bad, [], bad.join('; '));
});

test('no weapon class is locked out of the element table', () => {
  // The Nightblade killed things twice as slowly as its own sibling branch,
  // and it was not its skills: every blade in the game was neutral or shade,
  // the last thirty levels of the world are shade, and the bow had a radiant
  // option. A class with no answer to the endgame's element is a class nobody
  // should pick, and no amount of skill tuning fixes it.
  const worst = { dark: 'holy' };              // what the endgame is made of
  // an elemental tome is read by any class: if one sets the answer, no class is locked out
  const tomes = new Set(Object.values(ITEMS).filter((it) => it.endow && it.type === 'consumable').map((it) => it.endow));
  const byClass = {};
  for (const it of Object.values(ITEMS)) {
    if (it.slot !== 'weapon') continue;
    (byClass[it.wclass] ??= []).push(it);
  }
  const bad = [];
  for (const [wclass, list] of Object.entries(byClass)) {
    for (const [enemyEl, answer] of Object.entries(worst)) {
      const late = list.filter((w) => (w.level ?? 1) >= LEVEL_CAP - 15);
      const best = Math.max(...late.map((w) => ELEMENT_TABLE[w.element ?? 'neutral']?.[enemyEl] ?? 1),
        ...[...tomes].map((el) => ELEMENT_TABLE[el]?.[enemyEl] ?? 1), 0);
      if (best < 1) bad.push(`${wclass} has nothing better than ${best.toFixed(2)}x against ${enemyEl} (wants ${answer})`);
    }
  }
  assert.deepEqual(bad, [], bad.join('; '));
});
