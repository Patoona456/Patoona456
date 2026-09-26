// Players swinging at each other.
//
// Two things make PvP dangerous to a game rather than fun in it: damage tuned
// for monsters, which kills another player in two or three seconds and makes
// the fight about who pressed first; and any reward at all for a kill, which
// makes two accounts feeding each other the best income in the game. These
// check both, plus the part that matters most - that nobody who did not walk
// through the door can be attacked at all.
import { LEGACY_MAPS } from './fixtures/maps.js';   // the old maps the systems under test were built on
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../shared/data/maps.js';
import { PVP, pvpDamage } from '../shared/formulas.js';
import { Zone } from '../server/game/zone.js';

test('a duel takes long enough to be a fight', () => {
  const bar = 3000;
  // The worst case: a burst skill landing for most of the bar in PvE terms.
  assert.ok(pvpDamage(bar * 2, bar) <= bar * PVP.maxHitPct + 1, 'one blow can take most of a health bar');
  // And several blows still have to add up, rather than one deciding it.
  const perHit = pvpDamage(600, bar);
  assert.ok(bar / perHit >= 4, `a duel lasts ${(bar / perHit).toFixed(1)} hits`);
});

test('PvP damage is a cut of PvE damage, never a multiple', () => {
  for (const raw of [10, 100, 1000, 9999]) {
    assert.ok(pvpDamage(raw, 100000) < raw, `${raw} was not reduced`);
    assert.ok(pvpDamage(raw, 100000) >= 1, 'a blow rounded away to nothing');
  }
});

test('exactly one zone allows it, and it is not one anyone passes through', () => {
  // (the arena went with the old maps: until a new one is drawn only the
  // tests' copy of it stands, which nothing in the game leads to)
  const open = Object.values(MAPS).filter((m) => m.pvp);
  assert.equal(open.length, 1, `${open.length} maps allow PvP`);
  const lists = open[0];
  assert.ok(!lists.safe, 'the duelling ground is flagged safe');
  assert.deepEqual(lists.spawns ?? [], [], 'the duelling ground has monsters to farm');
  // Reachable, and only on purpose: every route in is a door someone walks
  // through, never a corridor between two places people already go.
  const doors = Object.values(MAPS).flatMap((m) => (m.warps ?? []).filter((w) => w.to === lists.id).map(() => m.id));
  if (!LEGACY_MAPS[lists.id]) assert.ok(doors.length >= 1, 'there is no way into the duelling ground');
  const out = (lists.warps ?? []).map((w) => w.to);
  assert.deepEqual(out, [...new Set(out)], 'duplicate exits');
  for (const to of out) assert.ok(!MAPS[to]?.pvp, 'an exit leads to more PvP');
});

test('no zone a low-level character is sent to allows PvP', () => {
  for (const m of Object.values(MAPS)) {
    if (!m.pvp) continue;
    assert.ok((m.levelRange?.[0] ?? 1) >= 20, `${m.id} opens PvP to level ${m.levelRange?.[0]}`);
  }
});

/* --- who may actually swing at whom --------------------------------------
   The data above says where PvP is allowed. This is the rule that decides it
   per pair, which is the one a griefer would look for a hole in. */

const canDuel = (def, players, a, b) =>
  Zone.prototype.canDuel.call({ def, players: new Map(players.map((p) => [p.id, p])) }, a, b);

const who = (id, extra = {}) => ({ id, kind: 'player', record: {}, ...extra });

test('nowhere but the lists, and never against your own side', () => {
  const lists = { pvp: true };
  const field = {};
  const a = who('A'), b = who('B');

  assert.equal(canDuel(field, [a, b], a, b), false, 'an ordinary field allowed a duel');
  assert.equal(canDuel(lists, [a, b], a, b), true, 'the lists refused one');
  assert.equal(canDuel(lists, [a, b], a, a), false, 'somebody attacked themselves');

  const p1 = who('P1', { party: 'grp' }), p2 = who('P2', { party: 'grp' });
  assert.equal(canDuel(lists, [p1, p2], p1, p2), false, 'a party member could be attacked');

  const g1 = who('G1', { record: { guild: 7 } }), g2 = who('G2', { record: { guild: 7 } });
  assert.equal(canDuel(lists, [g1, g2], g1, g2), false, 'a guildmate could be attacked');

  const g3 = who('G3', { record: { guild: 9 } });
  assert.equal(canDuel(lists, [g1, g3], g1, g3), true, 'a rival guild could not be fought');
});

test('a pet answers to its owner, and cannot be used to get around any of it', () => {
  const lists = { pvp: true };
  const owner = who('OWN', { party: 'grp' });
  const mate = who('MATE', { party: 'grp' });
  const pet = { id: 'PET', kind: 'monster', summon: true, owner: 'OWN' };

  assert.equal(canDuel(lists, [owner, mate], pet, mate), false, 'a pet mauled its own party');
  assert.equal(canDuel(lists, [owner, mate], pet, owner), false, 'a pet turned on its owner');

  const rival = who('RIV');
  assert.equal(canDuel(lists, [owner, rival], pet, rival), true, 'a pet would not fight a rival');

  const stray = { id: 'STRAY', kind: 'monster', summon: true, owner: 'GONE' };
  assert.equal(canDuel(lists, [rival], stray, rival), false, 'a pet whose owner logged out still fought');
});
