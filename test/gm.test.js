// The game master's tools: who may use them, and that they do what they say.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdmin, tokenOk, gmCommand } from '../server/game/gm.js';
import { Player } from '../server/game/player.js';
import { ITEMS } from '../shared/data/items.js';

function withEnv(vars, fn) {
  const old = {};
  for (const [k, v] of Object.entries(vars)) { old[k] = process.env[k]; if (v == null) delete process.env[k]; else process.env[k] = v; }
  try { return fn(); } finally {
    for (const [k, v] of Object.entries(old)) { if (v == null) delete process.env[k]; else process.env[k] = v; }
  }
}

function character() {
  const record = {
    id: 'g1', name: 'ผู้ดูแล', level: 10, jobLevel: 1, job: 'novice',
    str: 5, agi: 5, vit: 5, int: 5, dex: 5, luk: 5, exp: 0, jobExp: 0, statPoints: 0, skillPoints: 0, aurum: 100,
    map: 'artaris', x: 0, y: 0, savePoint: { map: 'artaris', x: 0, y: 0 }, look: {},
    inventory: [], equipment: {}, skills: {}, hotbar: [], quests: {}, storage: [], npcSales: {}, salesDay: 0, lockouts: {},
  };
  const p = new Player(record, { send() {} });
  p.recompute();
  return p;
}
const world = { stats: { minted: 0, burned: 0 }, warpPlayer(p, map) { p.warped = map; } };

test('nobody is an admin unless the server says so', () => {
  withEnv({ AFO_ADMINS: null, AFO_ADMIN_TOKEN: null }, () => {
    assert.equal(isAdmin({ key: 'someone' }), false);
    assert.equal(isAdmin(null), false);
    assert.equal(tokenOk(''), false, 'an unset token let an empty guess in');
    assert.equal(tokenOk(undefined), false);
  });
  withEnv({ AFO_ADMINS: 'Boss, other' }, () => {
    assert.equal(isAdmin({ key: 'boss' }), true);
    assert.equal(isAdmin({ key: 'someone' }), false);
  });
  withEnv({ AFO_ADMIN_TOKEN: 'sesame' }, () => {
    assert.equal(tokenOk('sesame'), true);
    assert.equal(tokenOk('sesamE'), false);
    assert.equal(tokenOk('sesame!'), false);
  });
  assert.equal(isAdmin({ key: 'x', admin: true }), true);
});

test('an admin can conjure any item in the table, gear refined, stacks in bulk', () => {
  const p = character();
  for (const id of ['sword_mythic_120', 'hp_potion_s', 'box_weapon_3', 'heavenbreaker_bow']) {
    assert.ok(ITEMS[id], `${id} left the item table; pick another for this test`);
  }
  assert.ok(gmCommand(world, p, { op: 'give', id: 'sword_mythic_120', qty: 1, refine: 12 }).ok);
  const sword = p.inventory.find((s) => s.id === 'sword_mythic_120');
  assert.equal(sword.refine, 12, 'the refine was not applied');
  assert.ok(gmCommand(world, p, { op: 'give', id: 'hp_potion_s', qty: 500 }).ok);
  assert.equal(p.countItem('hp_potion_s'), 500);
  // not held to the weight limit
  assert.ok(gmCommand(world, p, { op: 'give', id: 'box_weapon_3', qty: 990 }).ok);
  assert.match(gmCommand(world, p, { op: 'give', id: 'no_such_thing' }).error, /ไม่พบ/);
});

test('level, aurum, heal and warp do what they say, and new aurum is counted', () => {
  const p = character();
  assert.ok(gmCommand(world, p, { op: 'level', level: 80 }).ok);
  assert.equal(p.record.level, 80);
  assert.equal(p.record.statPoints, 70 * 5);
  assert.equal(gmCommand(world, p, { op: 'level', level: 500 }).ok, true);
  assert.equal(p.record.level, 99, 'the level went past the cap');
  const minted = world.stats.minted;
  gmCommand(world, p, { op: 'aurum', amount: 1000000 });
  assert.equal(p.record.aurum, 1000100);
  assert.equal(world.stats.minted - minted, 1000000, 'aurum from nowhere was not counted as minted');
  gmCommand(world, p, { op: 'aurum', amount: -5e9 });
  assert.equal(p.record.aurum, 1000100 - 1e9 < 0 ? 0 : p.record.aurum);
  p.hp = 1;
  gmCommand(world, p, { op: 'heal' });
  assert.equal(p.hp, p.maxHp);
  assert.ok(gmCommand(world, p, { op: 'warp', map: 'greenmire' }).ok);
  assert.equal(p.warped, 'greenmire');
});
