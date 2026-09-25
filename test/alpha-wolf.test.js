// The Alpha Wolf, Greenmire's mini boss: the leap, the howl and the rage.
//
// Driven through the Zone methods with a stub zone and explicit times, as the
// other monster tests are.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Zone } from '../server/game/zone.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { Monster } from '../server/game/monster.js';

const def = MONSTERS.alpha_wolf;

function setup() {
  const events = [];
  const player = (id, x, y) => ({
    id, name: id, kind: 'player', alive: true, x, y,
    hp: 900, maxHp: 900, statuses: [], mods: {}, record: { level: 9 },
    derived: { def: 2, mdef: 2, softDef: 1, softMdef: 1, level: 9, maxHp: 900 },
    conn: { send() {} }, wearGear() {},
  });
  const target = player('TARGET', 200, 0);
  const aside = player('ASIDE', 200, 140);
  const zone = {
    players: new Map([['TARGET', target], ['ASIDE', aside]]),
    entities: new Map([['TARGET', target], ['ASIDE', aside]]),
    pushEvent(e) { events.push(e); },
  };
  for (const k of ['tickLeap', 'tickHowl', 'tickEnrage', 'furyAtk', 'calm']) zone[k] = Zone.prototype[k];
  const m = {
    id: 'w1', kind: 'monster', def, alive: true, x: 0, y: 0, hp: def.hp, maxHp: def.hp, speed: def.speed,
    anim: 'idle', nextAttackAt: 0, statuses: [], mods: {},
    derived: { atk: def.atk, level: def.level },
  };
  return { zone, m, target, aside, events };
}

test('the leap marks where you stand, flies there and lands on whoever stayed', () => {
  const { zone, m, target, aside, events } = setup();
  const L = def.leap;
  const t0 = 1_000_000;
  zone.tickLeap(m, target, t0);                        // arms the cooldown
  const t1 = t0 + L.every / 2;
  zone.tickLeap(m, target, t1);
  const warn = events.find((e) => e.t === 'warn');
  assert.ok(warn, 'a ring goes out first');
  assert.deepEqual([warn.x, warn.y], [200, 0], 'where the target stood');
  assert.equal(m.anim, 'leap');

  zone.tickLeap(m, target, t1 + L.tell - 10);
  assert.equal(m.x, 0, 'crouched through the tell');
  zone.tickLeap(m, target, t1 + L.tell + L.air / 2);
  assert.ok(m.x > 50 && m.x < 150, 'in the air, half way');
  zone.tickLeap(m, target, t1 + L.tell + L.air);
  assert.deepEqual([m.x, m.y], [200, 0], 'landed on the ring');
  assert.ok(target.hp < 900, 'who stayed in the ring is hit');
  assert.equal(aside.hp, 900, 'who was clear of it is not');
  assert.ok(events.some((e) => e.fx === 'mobart' && e.name === 'impact'));
  assert.ok(m.castUntil > t1 + L.tell + L.air, 'it recovers before fighting on');
});

test('a dodged leap lands on the ring, not on where the target ran', () => {
  const { zone, m, target } = setup();
  const L = def.leap;
  zone.tickLeap(m, target, 0);
  zone.tickLeap(m, target, L.every / 2);
  target.x = 200 + L.radius + 40;
  zone.tickLeap(m, target, L.every / 2 + L.tell + L.air);
  assert.equal(m.x, 200);
  assert.equal(target.hp, 900);
});

test('the howl slows who stays in the ring and works the wolf up for a while', () => {
  const { zone, m, target } = setup();
  const H = def.howl;
  target.x = 60;
  zone.tickHowl(m, target, 0);
  zone.tickHowl(m, target, H.every / 2);
  assert.equal(m.anim, 'howl');
  zone.tickHowl(m, target, H.every / 2 + H.tell);
  assert.ok(target.statuses.some((s) => s.slowPct === -H.slow), 'slowed');
  assert.equal(m.derived.atk, Math.floor(def.atk * (1 + H.buff)), 'the wolf hits harder');
  zone.tickHowl(m, target, H.every / 2 + H.tell + H.buffMs + 1);
  assert.equal(m.derived.atk, def.atk, 'and calms down again');
});

test('below half health it rages once, for good, until it is reset', () => {
  const { zone, m, events } = setup();
  const E = def.enrage;
  zone.tickEnrage(m, 0);
  assert.ok(!m.enraged, 'not at full health');
  m.hp = Math.floor(m.maxHp * E.at) - 1;
  zone.tickEnrage(m, 100);
  assert.ok(m.enraged);
  assert.equal(m.anim, 'enrage');
  assert.equal(m.derived.atk, Math.floor(def.atk * E.atk));
  const speedOf = Object.getOwnPropertyDescriptor(Monster.prototype, 'speed').get;
  assert.equal(speedOf.call(m), def.speed * E.speed, 'and runs faster');
  assert.ok(events.some((e) => e.t === 'boss'), 'the field is told');
  zone.tickEnrage(m, 5000);
  assert.equal(events.filter((e) => e.t === 'boss').length, 1, 'once');
  zone.calm(m);
  assert.ok(!m.enraged);
  assert.equal(m.derived.atk, def.atk);
  assert.equal(speedOf.call(m), def.speed);
});
