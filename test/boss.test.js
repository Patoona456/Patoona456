// The Warden's scripted fight.
//
// A boss whose mechanics are a random skill roll cannot be learned, so this
// one runs to a script - and a script is exactly the kind of thing that
// breaks quietly. These drive tickBoss directly with a stub zone so each
// phase can be forced without grinding a 145,000 hp monster down for real.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tickBoss, resetBoss } from '../server/game/boss.js';
import { MONSTERS } from '../shared/data/monsters.js';

const def = MONSTERS.reliquary_warden;
/** Block for `ms` without a timer, so the boss's wall-clock timers advance. */
const wait = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function fight(defId = 'reliquary_warden') {
  const bossDef = MONSTERS[defId];
  const events = [];
  const spawned = [];
  const player = (name, x, y) => ({
    id: name, name, kind: 'player', alive: true, x, y,
    hp: 9000, maxHp: 9000, statuses: [], mods: {}, record: { level: 68 },
    derived: { def: 100, mdef: 100, softDef: 30, softMdef: 30, level: 68, maxHp: 9000 },
    conn: { send() {} }, wearGear() {},
  });
  const tank = player('TANK', 0, 0);
  const away = player('AWAY', 2000, 2000);

  const zone = {
    // the real Zone keeps players in both collections; the AI reads `entities`
    players: new Map([['TANK', tank], ['AWAY', away]]),
    entities: new Map([['TANK', tank], ['AWAY', away]]),
    pushEvent(e) { events.push(e); },
    spawnMonster(id, x, y) {
      const a = {
        id: 'add' + spawned.length, defId: id, def: MONSTERS[id], alive: true,
        hp: 16000, maxHp: 16000, x, y, statuses: [], mods: {}, derived: { level: 64 },
      };
      spawned.push(a);
      this.entities.set(a.id, a);
      return a;
    },
    nearestWalkable: (x, y) => ({ x, y }),
  };

  const m = {
    id: 'boss', name: bossDef.nameTh, defId, def: bossDef, alive: true,
    hp: bossDef.hp, maxHp: bossDef.hp, x: 0, y: 0, statuses: [], mods: {},
    derived: { atk: bossDef.atk, matk: bossDef.matk, level: bossDef.level, maxHp: bossDef.hp },
    target: 'TANK', element: bossDef.element, threat: new Map(),
  };
  zone.entities.set('boss', m);
  const tick = () => tickBoss(zone, m, Date.now());
  return { zone, m, def: bossDef, tank, away, events, spawned, tick };
}

test('it warns before it hits, and only hits what is standing in the mark', (t) => {
  // Judgement picks its victim at random. Pin the roll so the test is about
  // the mechanic and not about who it happened to choose.
  const real = Math.random;
  Math.random = () => 0;
  t.after(() => { Math.random = real; });

  const f = fight();
  f.tick();                      // enters phase one and arms the first mechanic
  wait(1300);
  const before = f.events.length;
  f.tick();                      // raises the telegraph
  const warns = f.events.slice(before).filter((e) => e.t === 'warn');
  assert.equal(warns.length, 1, 'no warning was raised');
  assert.ok(warns[0].ms >= 800, 'the warning is too brief to react to');
  assert.ok(warns[0].r > 0);
  assert.equal(f.tank.hp, 9000, 'it dealt damage while it was still only a warning');

  wait(1400);
  f.tick();                      // the timer expires
  assert.ok(f.tank.hp < 9000, 'standing in the mark cost nothing');
  assert.equal(f.away.hp, 9000, 'someone across the room was hit anyway');
});

test('the anchors heal it until they are broken', () => {
  const f = fight();
  f.m.hp = Math.floor(def.hp * 0.5);       // phase two
  const before = f.events.length;
  f.tick();
  assert.equal(f.spawned.length, 2, 'the anchors did not appear');
  assert.ok(f.events.slice(before).some((e) => e.t === 'boss'), 'the room was not told what happened');
  assert.notEqual(f.spawned[0].x, f.spawned[1].x, 'both anchors landed on the same side');

  const hp = f.m.hp;
  wait(1100);
  f.tick();
  assert.ok(f.m.hp > hp, 'the anchors are not healing it');

  for (const a of f.spawned) a.alive = false;
  wait(1100);
  const healed = f.m.hp;
  f.tick();
  assert.equal(f.m.hp, healed, 'it kept healing after both anchors died');
});

test('the last phase makes the middle of the room lethal', () => {
  const f = fight();
  f.m.hp = Math.floor(def.hp * 0.2);
  f.tick();                       // enters phase three
  f.m.mechCount = 1;              // next mechanic is the collapse
  wait(1300);
  const before = f.events.length;
  f.tick();
  const rings = f.events.slice(before).filter((e) => e.t === 'warn');
  assert.equal(rings.length, 2, 'the collapse should telegraph two rings');
  assert.ok(rings[1].r > rings[0].r, 'the rings should grow outward');
  assert.ok(rings[1].ms > rings[0].ms, 'the outer ring should land later than the inner one');
});

test('it gets angrier as it goes, and never goes backwards', () => {
  const f = fight();
  f.tick();
  assert.equal(f.m.phase, 1);
  f.m.hp = Math.floor(def.hp * 0.5);
  f.tick();
  assert.equal(f.m.phase, 2);
  f.m.hp = Math.floor(def.hp * 0.2);
  f.tick();
  assert.equal(f.m.phase, 3);
  assert.ok((f.m.mods.atkPct ?? 0) > 0, 'the last phase should hit harder');
});

test('leashing takes its summoned help and its pending blows with it', () => {
  const f = fight();
  f.m.hp = Math.floor(def.hp * 0.5);
  f.tick();
  wait(1300);
  f.tick();
  assert.ok(f.spawned.length > 0);
  resetBoss(f.zone, f.m);
  assert.equal(f.m.phase, null);
  assert.equal(f.m.pending.length, 0);
  assert.equal(f.m.anchors.length, 0);
  assert.equal(f.m.mods.atkPct, 0);
  for (const a of f.spawned) assert.equal(f.zone.entities.has(a.id), false, 'an anchor was left behind');
});

test('a monster without a script is left alone', () => {
  const f = fight();
  f.m.def = { ...def, script: undefined };
  const before = f.events.length;
  f.tick();
  assert.equal(f.events.length, before, 'tickBoss acted on a monster that has no script');
});

/* --- Gruum -------------------------------------------------------------- */

test('the warlord charges whoever stood furthest away, not whoever he was hitting', () => {
  const f = fight('orc_warlord');
  f.tick();                                    // phase one, arms the first mechanic
  wait(1500);
  const before = f.events.length;
  f.tick();
  const warns = f.events.slice(before).filter((e) => e.t === 'warn');
  assert.ok(warns.length >= 3, `a charge should mark a lane, got ${warns.length} marks`);
  // The lane runs from the boss toward AWAY (2000,2000), not toward his target.
  const last = warns[warns.length - 1];
  assert.ok(last.x > 500 && last.y > 500, `the lane went to ${last.x},${last.y} instead of downfield`);
  assert.equal(f.away.hp, 9000, 'it hit before the warning expired');

  wait(2200);
  f.tick();
  assert.ok(f.away.hp < 9000, 'standing at the end of the lane cost nothing');
});

test('the warband sharpens him, and stops when it is cleared', () => {
  const f = fight('orc_warlord');
  f.m.hp = Math.floor(f.def.hp * 0.5);         // phase two
  f.tick();                                    // announces the horn
  wait(1500);
  f.tick();                                    // and they arrive
  assert.ok(f.spawned.length >= 2, 'no warband appeared');
  assert.ok((f.m.mods.atkPct ?? 0) > 0, 'the warband is not making him hit harder');

  const sharpened = f.m.mods.atkPct;
  for (const a of f.spawned) a.alive = false;
  f.tick();
  assert.ok((f.m.mods.atkPct ?? 0) < sharpened, 'he stayed sharpened after the warband died');
});

test('a leashed warlord does not hand the next party a lit floor', () => {
  const f = fight('orc_warlord');
  f.m.hp = Math.floor(f.def.hp * 0.2);         // phase three
  f.tick();
  f.m.pyres = [{ x: 0, y: 0, r: 110 }];
  resetBoss(f.zone, f.m);
  assert.deepEqual(f.m.pyres, [], 'the fires were still burning');
  assert.deepEqual(f.m.warband, [], 'the warband survived the reset');
  assert.equal(f.m.mods.atkPct, 0, 'he reset still sharpened');
  for (const a of f.spawned) assert.ok(!f.zone.entities.has(a.id), 'a summon outlived the reset');
});

/* --- Vhaal -------------------------------------------------------------- */

test('the king kills the rim and spares the middle, the opposite of the Warden', () => {
  const f = fight('skeleton_king');
  f.tank.x = 0; f.tank.y = 0;                  // at the throne
  f.away.x = 220; f.away.y = 0;                // out on the rim, inside the ring
  f.tick();
  wait(1500);
  f.tick();                                    // raises the rings
  wait(2400);
  f.tick();                                    // they land
  assert.equal(f.tank.hp, 9000, 'standing at the throne was punished');
  assert.ok(f.away.hp < 9000, 'standing on the rim was safe');
});

test('the tether bills two players for standing apart, and stops when they close up', () => {
  const f = fight('skeleton_king');
  f.m.hp = Math.floor(f.def.hp * 0.4);         // phase two
  // Drive mechanics until the tether is the one that comes up.
  for (let i = 0; i < 6 && !f.m.tether; i++) { f.m.nextMechanicAt = 0; f.tick(); }
  assert.ok(f.m.tether, 'the tether never went out');
  assert.ok(f.tank.statuses.some((s) => s.key === 'vhaal_tether'), 'nobody was told they were tethered');

  f.away.x = 2000; f.away.y = 2000;            // stretched
  const hp = f.tank.hp;
  wait(1600);
  f.tick();
  assert.ok(f.tank.hp < hp, 'the tether did not bite while stretched');

  f.away.x = f.tank.x + 20; f.away.y = f.tank.y;
  const closed = f.tank.hp;
  wait(1100);
  f.tick();
  assert.equal(f.tank.hp, closed, 'it kept biting after they closed up');
});

test('the court keeps standing back up in the last quarter', () => {
  const f = fight('skeleton_king');
  f.m.hp = Math.floor(f.def.hp * 0.15);        // phase three
  f.tick();
  assert.ok(f.spawned.length >= 1, 'the court never rose');
  assert.ok(f.m.mods.atkPct > 0, 'he did not enrage at a quarter');
});
