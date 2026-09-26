// The mushroom's burst: the first area attack a new player meets.
//
// It is only a lesson if stepping out works. These drive Zone#tickBurst with a
// stub zone and explicit times, so the warning, the root and the hit can each
// be checked without a real fight.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Zone } from '../server/game/zone.js';
import { MONSTERS } from '../shared/data/monsters.js';

const b = MONSTERS.mushroom.burst;

function setup() {
  const events = [];
  const player = (id, x, y) => ({
    id, name: id, kind: 'player', alive: true, x, y,
    hp: 500, maxHp: 500, statuses: [], mods: {}, record: { level: 3 },
    derived: { def: 2, mdef: 2, softDef: 1, softMdef: 1, level: 3, maxHp: 500 },
    conn: { send() {} }, wearGear() {},
  });
  const stays = player('STAYS', 30, 0);
  const steps = player('STEPS', 20, 0);
  const zone = {
    players: new Map([['STAYS', stays], ['STEPS', steps]]),
    entities: new Map([['STAYS', stays], ['STEPS', steps]]),
    pushEvent(e) { events.push(e); },
    tickBurst: Zone.prototype.tickBurst,
  };
  const m = {
    id: 'm1', kind: 'monster', def: MONSTERS.mushroom, alive: true, x: 0, y: 0,
    anim: 'idle', nextAttackAt: 0, statuses: [], mods: {},
    derived: { atk: MONSTERS.mushroom.atk, level: 3 },
  };
  return { zone, m, stays, steps, events };
}

test('a mushroom warns, roots itself, and hits only who stays in the circle', () => {
  const { zone, m, stays, steps, events } = setup();
  const t0 = 1_000_000;
  zone.tickBurst(m, stays, t0);                       // the fight starts: no burst yet
  assert.equal(events.length, 0);
  const t1 = t0 + b.every / 2;
  zone.tickBurst(m, stays, t1);                       // half a cooldown in, it goes
  const warn = events.find((e) => e.t === 'warn');
  assert.ok(warn, 'a warning goes out first');
  assert.equal(warn.r, b.radius);
  assert.equal(warn.ms, b.tell);
  assert.equal(m.anim, 'skill');
  assert.ok(m.castUntil > t1 + b.tell, 'it stands its ground until after it lands');
  assert.ok(m.nextAttackAt >= m.castUntil, 'no tackle in the middle of the burst');

  steps.x = b.radius + 40;                             // one player walks out of the ring
  zone.tickBurst(m, stays, t1 + b.tell - 1);           // not yet
  assert.equal(stays.hp, 500);
  zone.tickBurst(m, stays, t1 + b.tell);               // now it lands
  assert.ok(stays.hp < 500, 'the one who stayed is hit');
  assert.equal(steps.hp, 500, 'the one who stepped out is not');
  assert.ok(events.some((e) => e.t === 'fx' && e.fx === 'aoe'));
});

test('a mushroom does not burst at a target out of reach, nor twice in a cooldown', () => {
  const { zone, m, stays, events } = setup();
  stays.x = b.reach + 50;
  const t0 = 2_000_000;
  zone.tickBurst(m, stays, t0);
  zone.tickBurst(m, stays, t0 + b.every);
  assert.equal(events.filter((e) => e.t === 'warn').length, 0, 'too far away to bother');

  stays.x = 20;
  zone.tickBurst(m, stays, t0 + b.every * 2);          // arms the cooldown
  zone.tickBurst(m, stays, t0 + b.every * 3);          // bursts
  zone.tickBurst(m, stays, t0 + b.every * 3 + 1000);   // still cooling down
  assert.equal(events.filter((e) => e.t === 'warn').length, 1);
});
