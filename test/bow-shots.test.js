// A bow shoots with an empty quiver: arrows are not in the item set (and may
// never be), so they are a bonus when carried, never a price for firing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../server/game/world.js';
import { Player } from '../server/game/player.js';
import * as Skills from '../server/game/skills.js';

function archer(zone) {
  const record = {
    id: 'a1', name: 'นักธนู', level: 40, jobLevel: 30, job: 'marksman',
    str: 20, agi: 30, vit: 20, int: 10, dex: 40, luk: 10,
    exp: 0, jobExp: 0, statPoints: 0, skillPoints: 0, aurum: 0,
    map: zone.id, x: 1000, y: 1000, savePoint: { map: 'artaris', x: 960, y: 736 },
    look: { gender: 'male' }, inventory: [{ id: 'ranger_bow', qty: 1 }], equipment: {},
    skills: { aimed_shot: 3 }, hotbar: [], quests: {}, storage: [], npcSales: {}, salesDay: 0, lockouts: {},
  };
  const p = new Player(record, { send() {} });
  const eq = p.equip(0);
  assert.ok(!eq?.error, eq?.error);
  p.recompute();
  p.zone = zone;
  zone.addPlayer(p);
  return p;
}

test('a bow with no arrows in the bag still shoots, and so do its skills', () => {
  const w = new World();
  try {
    const zone = w.zone('greenmire');
    const p = archer(zone);
    assert.equal(p.weaponClass, 'bow');
    assert.equal(p.findAmmo(), null);
    const m = zone.spawnMonster(Object.values(zone.def.spawns ?? [])[0]?.mob ?? 'mire_slime', p.x + 120, p.y);
    m.hp = m.maxHp = 1e6;
    // a single arrow can miss (hit vs flee is a roll), so give it a few draws
    p.targetId = m.id; p.attacking = true;
    for (let i = 0; i < 20 && m.hp >= 1e6; i++) {
      p.nextAttackAt = 0;
      zone.updatePlayers(0.05, Date.now());
    }
    assert.ok(m.hp < 1e6, 'the bow did not loose a shot');
    assert.ok(p.attacking, 'it stopped attacking for want of arrows');

    p.sp = p.maxSp;
    const r = Skills.begin(zone, p, 'aimed_shot', { targetId: m.id });
    assert.ok(!r?.error, r?.error);
  } finally { w.stop(); }
});

test('whatever is in the first bag slot can be worn: a new character holds its starter sword', () => {
  // server/accounts.js starts everyone this way: the practice sword in slot 0,
  // worn. Slot 0 used to read as "nothing worn", so every new character
  // fought bare-handed.
  const record = {
    id: 'n1', name: 'มือใหม่', level: 1, jobLevel: 1, job: 'novice',
    str: 5, agi: 5, vit: 5, int: 5, dex: 5, luk: 5, exp: 0, jobExp: 0, statPoints: 0, skillPoints: 1, aurum: 500,
    map: 'artaris', x: 0, y: 0, savePoint: { map: 'artaris', x: 0, y: 0 }, look: {},
    inventory: [{ id: 'wooden_sword', qty: 1, refine: 0, dur: 120 }, { id: 'hp_potion_s', qty: 5 }],
    equipment: { weapon: 0 },
    skills: {}, hotbar: [], quests: {}, storage: [], npcSales: {}, salesDay: 0, lockouts: {},
  };
  const p = new Player(record, { send() {} });
  p.recompute();
  assert.ok(p.equippedItem('weapon'), 'slot 0 reads as empty');
  assert.equal(p.weaponClass, 'sword', 'the starter sword in slot 0 counts as nothing worn');
});
