// The scroll sheet: refine luck and wards at the smith, tickets at the
// warper and the shrine, and everything that is read from the bag.
import './fixtures/maps.js';           // the old maps the systems under test were built on
import './fixtures/items.js';          // a sword to refine
import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, SCROLLS } from '../shared/data/items.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { SHOPS } from '../shared/data/npcs.js';
import { Player } from '../server/game/player.js';
import { useConsumable } from '../server/game/consumables.js';
import * as Econ from '../server/game/economy.js';
import { QUESTS } from '../shared/data/quests.js';

const world = { stats: { minted: 0, burned: 0 }, warpPlayer(p, map, x, y) { p.warpedTo = { map, x, y }; } };

function character(items = [], { level = 50, map = 'greenmire' } = {}) {
  const record = {
    id: 'c1', name: 'นักอ่าน', level, jobLevel: 30, job: 'novice',
    str: 30, agi: 30, vit: 30, int: 30, dex: 30, luk: 30,
    exp: 0, jobExp: 0, statPoints: 0, skillPoints: 0, aurum: 1_000_000,
    map, x: 1000, y: 1000, savePoint: { map: 'artaris', x: 960, y: 736 },
    look: { gender: 'male', body: 'light', eyes: 'brown', hair: 'plain', hairColor: 'brown' },
    inventory: items.map((i) => (typeof i === 'string' ? { id: i, qty: 3 } : i)), equipment: {}, skills: {}, hotbar: [],
    quests: {}, storage: [], npcSales: {}, salesDay: 0, lockouts: {},
  };
  const p = new Player(record, { send() {} });
  p.recompute();
  p.zone = {
    def: { kind: 'field', width: 60, height: 40, spawns: [{ mob: 'blue_slime', count: 5 }] },
    entities: new Map(), players: new Map([[p.id, p]]), events: [],
    pushEvent(e) { this.events.push(e); }, walkable: () => true, isHostile: () => true,
    spawnMonster(id, x, y, opts) { const m = { id: 'm' + this.entities.size, def: MONSTERS[id], name: id, x, y, ...opts, alive: true }; this.entities.set(m.id, m); return m; },
    revivePlayer(q, pct) { q.alive = true; q.hp = Math.floor(q.maxHp * pct); },
  };
  return p;
}
const slot = (p, id) => p.inventory.findIndex((s) => s.id === id);

test('the sheet is forty-eight pieces, each scroll on its own cell', () => {
  // (two of the forty-eight - the voyage scroll and the arena pass - went
  // with the maps they led to; their cells stand empty)
  const cells = Object.values(SCROLLS).map((d) => d.art);
  assert.equal(cells.length, 46);
  assert.equal(new Set(cells).size, 46);
  assert.ok(cells.every((c) => Number(c.split('#')[1]) < 48));
  for (const d of Object.values(SCROLLS)) assert.ok(d.nameTh && d.desc && d.value > 0, `${d.id} is incomplete`);
});

test('a refine scroll adds its points to one attempt, and is spent', () => {
  // at +12 the odds are 9%; the +5% scroll makes it 14%
  const trials = 4000;
  let wins = 0;
  const p = character([{ id: 'iron_sword', qty: 1, refine: 12 }, { id: 'refine_luck_5', qty: trials }, { id: 'guard_break', qty: trials },
    { id: 'runed_whetstone', qty: 2 * trials }]);
  for (let i = 0; i < trials; i++) {
    p.inventory[0].refine = 12;
    p.record.aurum = 1_000_000;           // the fee is not what is under test
    const r = Econ.refine(world, p, 0, { luck: 'refine_luck_5', guard: true });
    assert.ok(r.ok, r.error);
    if (r.success) wins++;
  }
  assert.ok(Math.abs(wins / trials - 0.14) < 0.025, `won ${(wins / trials * 100).toFixed(1)}%, expected about 14%`);
  assert.equal(p.countItem('refine_luck_5'), 0, 'a scroll survived its attempt');
});

test('wards turn one failure into nothing, and are spent only where they help', () => {
  const p = character([{ id: 'iron_sword', qty: 1, refine: 2 }, { id: 'guard_down', qty: 1 }, { id: 'guard_break', qty: 1 },
    { id: 'runed_whetstone', qty: 10 }]);
  // +2 cannot fail: no ward is asked for or spent
  assert.ok(Econ.refine(world, p, 0, { guard: true }).ok);
  assert.equal(p.countItem('guard_down') + p.countItem('guard_break'), 2);
  // +6 fails down: the anti-drop ward is the one spent
  const orig = Math.random;
  Math.random = () => 0.999;
  try {
    p.inventory[0].refine = 6;
    const r = Econ.refine(world, p, 0, { guard: true });
    assert.equal(r.result, 'unchanged');
    assert.equal(p.inventory[0].refine, 6);
    assert.equal(p.countItem('guard_down'), 0);
    assert.equal(p.countItem('guard_break'), 1, 'the anti-break ward was spent on a drop');
    // +9 would break: the anti-break ward saves it
    p.inventory[0].refine = 9;
    assert.equal(Econ.refine(world, p, 0, { guard: true }).result, 'unchanged');
    assert.equal(p.countItem('iron_sword'), 1, 'the sword broke under a ward');
    // and without one the refine is refused rather than silently unguarded
    assert.match(Econ.refine(world, p, 0, { guard: true }).error, /ยันต์/);
  } finally { Math.random = orig; }
});

test('refine scrolls and wards are not read from the bag', () => {
  const p = character(['refine_luck_1', 'guard_down', 'warp_ticket', 'dungeon_pass']);
  for (const id of ['refine_luck_1', 'guard_down', 'warp_ticket', 'dungeon_pass']) {
    assert.ok(useConsumable(world, p, slot(p, id)).error, `${id} was used up from the bag`);
    assert.equal(p.countItem(id), 3);
  }
});

test('a travel ticket pays the warper instead of aurum', () => {
  const p = character(['warp_ticket'], { map: 'artaris' });
  p.record.visited = ['greenmire'];
  const before = p.record.aurum;
  const r = Econ.warpService(world, p, 'greenmire');
  assert.ok(r.ok, r.error);
  assert.equal(r.ticket, 'warp_ticket');
  assert.equal(p.record.aurum, before);
  assert.equal(p.countItem('warp_ticket'), 2);
});

test('a treasure map can pay in coin, and counts it as minted', () => {
  const w = { stats: { minted: 0, burned: 0 } };
  const orig = Math.random;
  Math.random = () => 0.01;                 // the first row: aurum
  try {
    const p = character(['treasure_map']);
    const before = p.record.aurum;
    const r = Econ.openBox(p, 0, w);
    assert.ok(r.ok, r.error);
    assert.equal(r.got.id, '__aurum');
    assert.equal(p.record.aurum - before, r.got.qty);
    assert.equal(w.stats.minted, r.got.qty);
  } finally { Math.random = orig; }
});

test('an elemental tome sets the weapon element, and a new one replaces it', () => {
  const p = character(['book_fire', 'book_ice']);
  assert.ok(useConsumable(world, p, slot(p, 'book_fire')).ok);
  assert.equal(p.weaponElement, 'fire');
  assert.ok(useConsumable(world, p, slot(p, 'book_ice')).ok);
  assert.equal(p.weaponElement, 'ice');
  assert.equal(p.statuses.filter((s) => s.endow).length, 1, 'two elements at once');
});

test('a party book reaches the party nearby, and nobody else', () => {
  const p = character(['book_party']);
  p.record.party = 'pt1';
  const near = character([]); near.record.party = 'pt1'; near.x = 1100;
  const far = character([]); far.record.party = 'pt1'; far.x = 3000;
  const stranger = character([]); stranger.x = 1050;
  for (const o of [near, far, stranger]) { o.id = 'p' + Math.random(); p.zone.players.set(o.id, o); }
  assert.ok(useConsumable(world, p, 0).ok);
  const has = (q) => q.statuses.some((s) => s.item === 'book_party');
  assert.ok(has(p) && has(near));
  assert.ok(!has(far) && !has(stranger));
});

test('the renewal scroll reopens handed-in dailies and nothing else', () => {
  // (no daily is in the game until the new maps bring theirs: a stand-in)
  QUESTS.q_test_daily = { id: 'q_test_daily', name: 'daily', giver: 'board', minLevel: 1, repeatable: 'daily',
    objectives: [{ type: 'kill', mob: 'blue_slime', count: 1 }], rewards: {} };
  try {
    const p = character(['scroll_daily_reset']);
    p.record.quests = { q_test_daily: { done: true, at: Date.now() }, q_first_blood: { done: true, at: Date.now() } };
    assert.ok(useConsumable(world, p, 0).ok);
    assert.ok(!p.record.quests.q_test_daily);
    assert.ok(p.record.quests.q_first_blood, 'a one-time quest was reopened');
  } finally {
    delete QUESTS.q_test_daily;
  }
});

test('the challenge writ clears the weekly boss rewards', () => {
  const p = character(['boss_ticket']);
  assert.match(useConsumable(world, p, 0).error, /บอส/);
  p.record.lockouts = { orc_warlord: '2026-W39' };
  assert.ok(useConsumable(world, p, 0).ok);
  assert.deepEqual(p.record.lockouts, {});
});

test('scrolls that move you refuse in dungeons, and the waypoint remembers the spot', () => {
  const p = character(['scroll_save', 'scroll_fly']);
  p.zone.def = { kind: 'dungeon', party: 2 };
  assert.ok(useConsumable(world, p, slot(p, 'scroll_save')).error);
  assert.ok(useConsumable(world, p, slot(p, 'scroll_fly')).error);
  p.zone.def = { kind: 'field', width: 60, height: 40 };
  assert.ok(useConsumable(world, p, slot(p, 'scroll_save')).ok);
  assert.deepEqual(p.record.savePoint, { map: 'greenmire', x: 1000, y: 1000 });
});

test('a summoning scroll calls this field\'s own monster, once, and only in the field', () => {
  const p = character(['scroll_summon']);
  assert.ok(useConsumable(world, p, 0).ok);
  const m = [...p.zone.entities.values()][0];
  assert.equal(m.def.id, 'blue_slime');
  assert.ok(m.oneShot, 'the summoned monster would respawn forever');
  p.cooldowns = {};
  p.zone.def = { kind: 'town', safe: true };
  assert.ok(useConsumable(world, p, 0).error);
});

test('the resurrection scroll lifts the nearest fallen friend', () => {
  const p = character(['scroll_resurrect']);
  assert.match(useConsumable(world, p, 0).error, /ล้ม/);
  const down = character([]); down.id = 'down'; down.alive = false; down.hp = 0; down.x = 1080;
  p.zone.players.set('down', down);
  assert.ok(useConsumable(world, p, 0).ok);
  assert.equal(down.alive, true);
  assert.ok(down.hp > 0);
});

test('the Reliquary pass opens a party door once', async () => {
  const { World } = await import('../server/game/world.js');
  const w = new World();
  try {
    const zone = w.zone('frostvault');
    const p = character(['dungeon_pass'], { map: 'frostvault' });
    p.zone = zone;
    p.record.inventory[0].qty = 1;
    zone.players.set(p.id, p);
    assert.equal(w.partyGate(p, 'reliquary1'), null, 'the pass did not open the door');
    assert.equal(p.countItem('dungeon_pass'), 0);
    assert.ok(w.partyGate(p, 'reliquary1'), 'one pass opened the door twice');
  } finally { w.stop(); }
});

test('the shrine is open again, and pays in its own tickets', () => {
  for (const row of Econ.GACHA.pool) assert.ok(ITEMS[row.id], `the shrine pays the unknown ${row.id}`);
  assert.ok(ITEMS[SHOPS.dawn.currency]?.id === 'gacha_ticket');
  const p = character([{ id: 'gacha_ticket', qty: 10 }]);
  const r = Econ.gachaDraw(world, p, 10);
  assert.ok(r.ok, r.error);
  assert.equal(p.countItem('gacha_ticket'), 0);
});

test('bosses pay the wards and the tickets', () => {
  for (const m of Object.values(MONSTERS).filter((x) => x.boss)) {
    for (const id of ['guard_break', 'gacha_ticket', 'refine_luck_5']) {
      assert.ok(m.drops.some((d) => d.id === id), `${m.id} never drops ${id}`);
    }
  }
});
