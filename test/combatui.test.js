// The server half of the combat screen: getting up where you fell, who the
// death screen says did it, and where a boss's phases turn.
import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../server/game/world.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { phaseOf } from '../server/game/boss.js';
import { reviveHereCost, REVIVE_HERE_COOLDOWN_MS } from '../shared/formulas.js';

function stubPlayer(id, level, zone, x = 1000, y = 1000) {
  const p = {
    id, name: id, kind: 'player', alive: false, x, y, party: null, zone,
    hp: 0, maxHp: 1000, sp: 0, maxSp: 100, statuses: [], mods: {}, cast: null,
    record: { id: 'c' + id, level, exp: 0, jobExp: 0, aurum: 10000 },
    conn: { send() {} },
  };
  return p;
}

test('reviving where you fell costs aurum, scales with level, and has a cooldown', (t) => {
  const w = new World();
  t.after(() => w.stop());
  const zone = w.zone('greenmire');
  const p = stubPlayer('A', 40, zone);
  zone.players.set('A', p);

  const cost = reviveHereCost(40);
  assert.ok(reviveHereCost(80) > cost && reviveHereCost(1) >= 100);
  const r = zone.reviveHere(p);
  assert.ok(r.ok, r.error);
  assert.equal(p.alive, true);
  assert.equal(p.hp, 300, 'back at 30% HP');
  assert.equal(p.record.aurum, 10000 - cost);

  p.alive = false;
  const again = zone.reviveHere(p);
  assert.match(again.error, /วินาที/, 'a second revive inside the cooldown is refused');
  assert.equal(p.record.aurum, 10000 - cost, 'and costs nothing');

  p.reviveHereAt = Date.now() - 1;
  p.record.aurum = cost - 1;
  assert.match(zone.reviveHere(p).error, /ออรัม/, 'not enough aurum');
  assert.equal(p.alive, false);
  assert.ok(REVIVE_HERE_COOLDOWN_MS >= 60_000);
});

test('no reviving in place in a PvP zone or beside a boss that is still fighting', (t) => {
  const w = new World();
  t.after(() => w.stop());
  const zone = w.zone('greenmire');
  const p = stubPlayer('A', 40, zone);
  zone.players.set('A', p);
  const boss = { id: 'b', kind: 'monster', boss: true, alive: true, target: 'A', x: 1100, y: 1000 };
  zone.entities.set('b', boss);
  assert.match(zone.reviveHere(p).error, /บอส/);
  assert.ok(zone.reviveOffer(p).no, 'the death screen is told why');
  boss.target = null;
  assert.ok(zone.reviveHere(p).ok, 'once the boss has nobody to fight, you may');

  zone.def = { ...zone.def, pvp: true };
  p.alive = false;
  p.reviveHereAt = 0;
  assert.match(zone.reviveHere(p).error, /พื้นที่นี้/);
});

test('the death screen names the killer, and the owner of a summon', (t) => {
  const w = new World();
  t.after(() => w.stop());
  const zone = w.zone('greenmire');
  const owner = stubPlayer('O', 50, zone);
  owner.alive = true;
  zone.players.set('O', owner);
  assert.deepEqual(zone.killerCard(owner), { n: 'O', lv: 50, k: 'p' });
  assert.equal(zone.killerCard({ owner: 'O', kind: 'monster', name: 'wolf' }).n, 'O');
  const card = zone.killerCard({ kind: 'monster', name: 'กรูม', level: 60, boss: true, defId: 'x' });
  assert.equal(card.boss, 1);
  assert.equal(zone.killerCard(null), null);
});

test('boss phases turn at the HP marks in its data', () => {
  for (const def of Object.values(MONSTERS).filter((m) => m.script)) {
    assert.ok(Array.isArray(def.phases) && def.phases.length, `${def.id ?? def.nameTh} lists its phase marks`);
    const m = { def, hp: 100, maxHp: 100 };
    assert.equal(phaseOf(m), 1);
    assert.equal(phaseOf(m, def.phases[0]), 2, 'the mark itself is already the next phase');
    assert.equal(phaseOf(m, 0.01), def.phases.length + 1);
  }
});
