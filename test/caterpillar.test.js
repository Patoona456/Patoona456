// The caterpillar's charge: a lane is marked, then it rolls down it.
//
// Driven through Zone#tickCharge with a stub zone on open ground, so the lane,
// the roll and who it hits can be checked tick by tick.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Zone } from '../server/game/zone.js';
import { MONSTERS } from '../shared/data/monsters.js';

const c = MONSTERS.caterpillar.charge;

function setup() {
  const events = [];
  const player = (id, x, y) => ({
    id, name: id, kind: 'player', alive: true, x, y,
    hp: 500, maxHp: 500, statuses: [], mods: {}, record: { level: 4 },
    derived: { def: 2, mdef: 2, softDef: 1, softMdef: 1, level: 4, maxHp: 500 },
    conn: { send() {} }, wearGear() {},
  });
  const target = player('TARGET', 120, 0);
  const aside = player('ASIDE', 60, 80);                // well off the lane
  const zone = {
    players: new Map([['TARGET', target], ['ASIDE', aside]]),
    entities: new Map([['TARGET', target], ['ASIDE', aside]]),
    pushEvent(e) { events.push(e); },
    moveTo(e, x, y) { e.x = x; e.y = y; },             // open ground
    tickCharge: Zone.prototype.tickCharge,
  };
  const m = {
    id: 'm1', kind: 'monster', def: MONSTERS.caterpillar, alive: true, x: 0, y: 0,
    anim: 'idle', nextAttackAt: 0, statuses: [], mods: {},
    derived: { atk: MONSTERS.caterpillar.atk, level: 4 },
  };
  return { zone, m, target, aside, events };
}

/** Run the zone clock forward in 50ms ticks. */
function run(zone, m, target, from, ms) {
  let t = from;
  for (; t <= from + ms; t += 50) zone.tickCharge(m, target, t, 0.05);
  return t;
}

test('a caterpillar marks a lane, rolls down it, and hits who is in it once', () => {
  const { zone, m, target, aside, events } = setup();
  const t0 = 1_000_000;
  zone.tickCharge(m, target, t0, 0.05);               // the fight starts: arms the cooldown
  const t1 = t0 + c.every / 2;
  zone.tickCharge(m, target, t1, 0.05);
  const warn = events.find((e) => e.t === 'warn');
  assert.ok(warn && warn.tx != null, 'a lane goes out first');
  assert.ok(warn.tx > target.x, 'the lane runs on through where the target stood');
  assert.equal(m.anim, 'skill');
  assert.equal(m.x, 0, 'it waits out the tell curled up where it is');

  run(zone, m, target, t1 + 50, c.tell - 100);
  assert.equal(m.x, 0, 'still waiting');
  assert.equal(target.hp, 500);

  run(zone, m, target, t1 + c.tell, 2000);            // rolls the lane
  assert.ok(m.x > target.x, 'it rolled past where the target stood');
  assert.equal(m.charging, null, 'and stopped at the end of the lane');
  const hitOnce = 500 - target.hp;
  assert.ok(hitOnce > 0, 'the one in the lane is hit');
  assert.ok(hitOnce < m.derived.atk * c.power * 1.2 + 1, 'once, not every tick it overlaps');
  assert.equal(aside.hp, 500, 'the one beside the lane is not');
  assert.ok(m.castUntil > t1 + c.tell && m.castUntil < Number.MAX_SAFE_INTEGER, 'it unrolls, then fights on');
});

test('a caterpillar does not charge a target out of reach', () => {
  const { zone, m, target, events } = setup();
  const t0 = 2_000_000;
  for (const x of [c.max + 60, c.max + 200]) {
    target.x = x;
    zone.tickCharge(m, target, t0, 0.05);
    zone.tickCharge(m, target, t0 + c.every, 0.05);
  }
  assert.equal(events.filter((e) => e.t === 'warn').length, 0);
});
