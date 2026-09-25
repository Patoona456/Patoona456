// The forest spirit: the first monster that fights from range.
//
// Its bolt only hits when it arrives, and its vines come up under the target
// rather than round its own feet. Driven through the Zone methods with a stub
// zone and explicit times, as the mushroom and caterpillar tests are.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Zone } from '../server/game/zone.js';
import { MONSTERS } from '../shared/data/monsters.js';

const def = MONSTERS.forest_spirit;

function setup() {
  const events = [];
  const player = (id, x, y) => ({
    id, name: id, kind: 'player', alive: true, x, y,
    hp: 500, maxHp: 500, statuses: [], mods: {}, record: { level: 8 },
    derived: { def: 2, mdef: 2, softDef: 1, softMdef: 1, level: 8, maxHp: 500, flee: 0 },
    conn: { send() {} }, wearGear() {},
  });
  const target = player('TARGET', 140, 0);
  const zone = {
    players: new Map([['TARGET', target]]),
    entities: new Map([['TARGET', target]]),
    pushEvent(e) { events.push(e); },
    shoot: Zone.prototype.shoot,
    tickShots: Zone.prototype.tickShots,
    tickBurst: Zone.prototype.tickBurst,
  };
  target.zone = zone;
  const m = {
    id: 'm1', kind: 'monster', def, alive: true, x: 0, y: 0, level: def.level,
    anim: 'idle', nextAttackAt: 0, statuses: [], mods: {},
    derived: { atk: def.atk, hit: 500, level: def.level, crit: 0 },
  };
  return { zone, m, target, events };
}

test('a forest spirit fights from range and keeps its distance', () => {
  assert.ok(def.attackRange >= 120, 'it shoots from well outside melee');
  assert.ok(def.kite > 40 && def.kite < def.attackRange, 'it backs off only from someone close');
});

test('a spirit bolt flies to its target and only hits when it lands', () => {
  const { zone, m, target, events } = setup();
  const t0 = 1_000_000;
  zone.shoot(m, target, t0);
  const bolt = events.find((e) => e.fx === 'mobart' && e.name === 'bolt');
  assert.ok(bolt, 'the bolt goes out as an effect cut from the sheet');
  assert.equal(bolt.target, 'TARGET');
  const flight = def.shot.lead + (140 / def.shot.speed) * 1000;
  assert.ok(Math.abs(bolt.delay + bolt.ms - flight) < 1);

  zone.tickShots(m, t0 + flight - 10);
  assert.equal(target.hp, 500, 'not yet: it is still in the air');
  zone.tickShots(m, t0 + flight);
  assert.ok(target.hp < 500 || events.some((e) => e.t === 'miss'), 'it lands');
  assert.equal(m.shots.length, 0);
});

test('a spirit bolt fizzles if its target is gone before it lands', () => {
  const { zone, m, target } = setup();
  zone.shoot(m, target, 0);
  target.alive = false;
  zone.tickShots(m, 5000);
  assert.equal(target.hp, 500);
});

test('the vines come up under the target and hold whoever stays', () => {
  const { zone, m, target, events } = setup();
  const b = def.burst;
  const t0 = 2_000_000;
  zone.tickBurst(m, target, t0);                       // arms the cooldown
  const t1 = t0 + b.every / 2;
  zone.tickBurst(m, target, t1);
  const warn = events.find((e) => e.t === 'warn');
  assert.ok(warn, 'a ring is marked first');
  assert.equal(warn.x, target.x, 'under the target, not the spirit');
  assert.equal(m.x, 0, 'the spirit itself stays put');

  zone.tickBurst(m, target, t1 + b.tell);
  assert.ok(target.hp < 500, 'who stayed in the ring is hit');
  assert.ok(target.statuses.some((s) => s.type === 'root'), 'and held by the vines');
  assert.ok(events.some((e) => e.fx === 'mobart' && e.name === 'vine'), 'the vines are drawn from the sheet');
});

test('stepping out of the ring dodges the vines', () => {
  const { zone, m, target } = setup();
  const b = def.burst;
  zone.tickBurst(m, target, 0);
  zone.tickBurst(m, target, b.every / 2);
  target.x += b.radius + 30;
  zone.tickBurst(m, target, b.every / 2 + b.tell);
  assert.equal(target.hp, 500);
  assert.equal(target.statuses.length, 0);
});
