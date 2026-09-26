// The Ancient Tree Guardian, Greenmire's boss: two floor moves on their own
// cooldowns, a spinning one that hits more than once, and saplings that mend
// it while they stand.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Zone } from '../server/game/zone.js';
import { Monster } from '../server/game/monster.js';
import { MONSTERS } from '../shared/data/monsters.js';

const def = MONSTERS.tree_guardian;
const [spikes, tornado] = def.burst;

function setup() {
  const events = [];
  const player = (id, x, y) => ({
    id, name: id, kind: 'player', alive: true, x, y,
    hp: 5000, maxHp: 5000, statuses: [], mods: {}, record: { level: 10 },
    derived: { def: 2, mdef: 2, softDef: 1, softMdef: 1, level: 10, maxHp: 5000 },
    conn: { send() {} }, wearGear() {},
  });
  const target = player('TARGET', 80, 0);
  const zone = {
    players: new Map([['TARGET', target]]),
    entities: new Map([['TARGET', target]]),
    pushEvent(e) { events.push(e); },
    walkable: () => true,
    spawnMonster(id, x, y) {
      const e = { id: 's' + this.entities.size, kind: 'monster', def: MONSTERS[id], alive: true, x, y, hp: 280, maxHp: 280 };
      this.entities.set(e.id, e);
      return e;
    },
  };
  for (const k of ['tickBurst', 'tickSummon', 'calm']) zone[k] = Zone.prototype[k];
  const m = {
    id: 'g1', kind: 'monster', def, alive: true, x: 0, y: 0, hp: 2000, maxHp: def.hp,
    anim: 'idle', nextAttackAt: 0, castUntil: 0, statuses: [], mods: {},
    derived: { atk: def.atk, level: def.level },
  };
  zone.entities.set(m.id, m);
  return { zone, m, target, events };
}

test('the guardian is a boss the players fight, not a pet', () => {
  const m = new Monster('tree_guardian', 0, 0);
  assert.equal(m.summon, false);
  assert.equal(m.boss, true);
});

test('its two floor moves keep their own cooldowns and never overlap', () => {
  const { zone, m, target, events } = setup();
  zone.tickBurst(m, target, 0);                        // arms both
  zone.tickBurst(m, target, spikes.every / 2);         // the spikes are due first
  const warns = () => events.filter((e) => e.t === 'warn');
  assert.equal(warns().length, 1);
  assert.equal(m.anim, 'spike');
  assert.equal(warns()[0].x, target.x, 'under the target');
  m.burstNext[1] = 0;                                  // the tornado due too...
  zone.tickBurst(m, target, spikes.every / 2 + 500);   // ...but the spikes still play
  assert.equal(warns().length, 1, 'no second move while the first plays');
  zone.tickBurst(m, target, m.castUntil + 1);
  assert.equal(warns().length, 2, 'then the tornado');
  assert.equal(m.anim, 'tornado');
  assert.deepEqual([warns()[1].x, warns()[1].y], [m.x, m.y], 'round itself');
});

test('the leaf tornado hits whoever stays three times', () => {
  const { zone, m, target } = setup();
  zone.tickBurst(m, target, 0);
  m.burstNext[0] = Infinity;                           // the spikes out of the way
  const t1 = tornado.every / 2;
  zone.tickBurst(m, target, t1);
  const hits = [];
  for (let t = t1; t <= t1 + tornado.tell + tornado.gap * 3; t += 50) {
    const before = target.hp;
    zone.tickBurst(m, target, t);
    if (target.hp < before) hits.push(t);
  }
  assert.equal(hits.length, tornado.pulses);
});

test('saplings grow, mend nothing themselves here, and go when the fight resets', () => {
  const { zone, m, target, events } = setup();
  const S = def.calls;
  zone.tickSummon(m, target, 0);                       // arms it
  zone.tickSummon(m, target, S.first);
  assert.equal(m.anim, 'summon');
  zone.tickSummon(m, target, S.first + S.tell);
  const trees = [...zone.entities.values()].filter((e) => e.guards === m.id);
  assert.equal(trees.length, S.count);
  assert.ok(events.some((e) => e.t === 'boss'), 'the field is told to cut them down');
  m.castUntil = 0;
  zone.tickSummon(m, target, S.first + S.every + 1);
  assert.equal([...zone.entities.values()].filter((e) => e.guards === m.id).length, S.count,
    'no more while the first ones stand');
  zone.calm(m);
  assert.equal([...zone.entities.values()].filter((e) => e.guards === m.id).length, 0);
});
