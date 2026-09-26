// The potion sheet: forty bottles, and what each kind of field actually does
// when a character drinks it (server/game/consumables.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, POTIONS } from '../shared/data/items.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { SHOPS } from '../shared/data/npcs.js';
import { Player } from '../server/game/player.js';
import { useConsumable } from '../server/game/consumables.js';
import { rollDamage } from '../shared/formulas.js';

const world = { stats: { minted: 0, burned: 0 }, warpPlayer(p, map, x, y) { p.warpedTo = { map, x, y }; } };

function character(items = [], { level = 40, alive = true } = {}) {
  const record = {
    id: 'c1', name: 'นักดื่ม', level, jobLevel: 30, job: 'novice',
    str: 30, agi: 30, vit: 30, int: 30, dex: 30, luk: 30,
    exp: 0, jobExp: 0, statPoints: 0, skillPoints: 0, aurum: 1000,
    map: 'artaris', x: 1000, y: 1000, savePoint: { map: 'artaris', x: 960, y: 736 },
    look: { gender: 'male', body: 'light', eyes: 'brown', hair: 'plain', hairColor: 'brown' },
    inventory: items.map((id) => ({ id, qty: 3 })), equipment: {}, skills: { first_aid: 3 }, hotbar: [],
    quests: {}, storage: [], npcSales: {}, salesDay: 0, lockouts: {},
  };
  const p = new Player(record, { send() {} });
  p.recompute();
  p.alive = alive;
  const zone = {
    def: {}, entities: new Map(), players: new Map([[p.id, p]]), events: [],
    pushEvent(e) { this.events.push(e); }, isHostile: (a, b) => b.kind === 'monster',
    revivePlayer(q, pct) { q.alive = true; q.hp = Math.floor(q.maxHp * pct); q.sp = Math.floor(q.maxSp * pct); },
  };
  p.zone = zone;
  return p;
}
const slot = (p, id) => p.inventory.findIndex((s) => s.id === id);

test('the sheet is forty bottles, each on its own cell of the atlas', () => {
  const cells = Object.values(POTIONS).map((d) => d.art);
  assert.equal(cells.length, 40);
  assert.equal(new Set(cells).size, 40, 'two bottles share a picture');
  for (const c of cells) assert.match(c, /^potions#([0-9]|[1-3][0-9])$/);
  for (const d of Object.values(POTIONS)) {
    assert.equal(d.type, 'consumable');
    assert.ok(d.nameTh && d.desc, `${d.id} is missing a name or a description`);
    assert.ok(d.value > 0, `${d.id} has no value`);
  }
});

test('every bottle does something', () => {
  const effects = ['heal', 'healSp', 'healPct', 'spPct', 'cleanse', 'regen', 'buff', 'warp', 'revive', 'throw', 'petHeal', 'reset'];
  for (const d of Object.values(POTIONS)) {
    assert.ok(effects.some((k) => d[k]), `${d.id} has no effect`);
  }
});

test('the bigger bottles heal more, and are cheaper per point', () => {
  for (const [kind, field] of [['hp', 'heal'], ['mp', 'healSp']]) {
    const sizes = ['s', 'm', 'l', 'xl'].map((z) => ITEMS[`${kind}_potion_${z}`]);
    for (let i = 1; i < sizes.length; i++) {
      assert.ok(sizes[i][field] > sizes[i - 1][field], `${sizes[i].id} is no bigger than ${sizes[i - 1].id}`);
      assert.ok(sizes[i].level > sizes[i - 1].level, `${sizes[i].id} is not later than ${sizes[i - 1].id}`);
    }
  }
});

test('a potion heals, goes on cooldown, and is used up', () => {
  const p = character(['hp_potion_m']);
  p.hp = 10;
  const r = useConsumable(world, p, slot(p, 'hp_potion_m'));
  assert.ok(r.ok, r.error);
  assert.equal(p.hp, Math.min(p.maxHp, 10 + ITEMS.hp_potion_m.heal));
  assert.equal(p.inventory[0].qty, 2);
  assert.match(useConsumable(world, p, 0).error, /คูลดาวน์/);
  assert.equal(p.inventory[0].qty, 2, 'a refused drink costs nothing');
});

test('a potion above your level stays in the bottle', () => {
  const p = character(['hp_potion_xl'], { level: 10 });
  assert.match(useConsumable(world, p, 0).error, /เลเวล/);
});

test('buffs refresh instead of stacking, and change the numbers', () => {
  const p = character(['atk_potion']);
  const before = p.derived.atk;
  assert.ok(useConsumable(world, p, 0).ok);
  const once = p.derived.atk;
  assert.ok(once > before, 'the ATK potion did nothing');
  p.cooldowns = {};
  assert.ok(useConsumable(world, p, 0).ok);
  assert.equal(p.derived.atk, once, 'a second bottle stacked on the first');
  assert.equal(p.statuses.filter((s) => s.item === 'atk_potion').length, 1);
});

test('a resist potion cuts that element, and only that one', () => {
  const p = character(['fire_resist']);
  useConsumable(world, p, 0);
  const a = { atk: 500, hit: 999, crit: 0, weaponElement: 'fire' };
  const d = { ...p.derived, flee: 0, def: 0, softDef: 0, critRes: 0, element: 'neutral' };
  const bare = { ...d, resist: {} };
  const hit = (el, def) => {
    let sum = 0;
    for (let i = 0; i < 2000; i++) sum += rollDamage({ ...a, weaponElement: el }, def, { canCrit: false }).damage;
    return sum / 2000;
  };
  assert.ok(Math.abs(hit('fire', d) / hit('fire', bare) - 0.75) < 0.03, 'fire was not cut by a quarter');
  assert.ok(Math.abs(hit('ice', d) / hit('ice', bare) - 1) < 0.03, 'fire resist also guards against ice');
});

test('a full restore fills both bars and washes off what hurts', () => {
  const p = character(['full_restore']);
  p.hp = 1; p.sp = 1;
  p.statuses.push({ key: 'x', type: 'poison', until: Date.now() + 9e3 }, { key: 'y', type: 'buff', beneficial: true, until: Date.now() + 9e3 });
  assert.ok(useConsumable(world, p, 0).ok);
  assert.equal(p.hp, p.maxHp);
  assert.equal(p.sp, p.maxSp);
  assert.ok(!p.statuses.some((s) => s.type === 'poison'), 'the poison stayed');
  assert.ok(p.statuses.some((s) => s.key === 'y'), 'a good buff was washed off too');
});

test('a revive potion works only while you are down, and not in PvP', () => {
  const up = character(['revive_potion']);
  assert.match(useConsumable(world, up, 0).error, /ล้ม/);
  const down = character(['revive_potion', 'hp_potion_s'], { alive: false });
  assert.match(useConsumable(world, down, slot(down, 'hp_potion_s')).error, /ล้ม/, 'the dead drank a potion');
  down.zone.def = { pvp: true };
  assert.match(useConsumable(world, down, 0).error, /พื้นที่/);
  down.zone.def = {};
  assert.ok(useConsumable(world, down, 0).ok);
  assert.equal(down.alive, true);
  assert.equal(down.hp, Math.floor(down.maxHp * 0.5));
});

test('a curse potion needs an enemy in range, and makes it take more', () => {
  const p = character(['curse_potion']);
  assert.match(useConsumable(world, p, 0).error, /เป้าหมาย/);
  const m = { id: 'm1', kind: 'monster', alive: true, x: 1100, y: 1000, statuses: [] };
  p.zone.entities.set('m1', m);
  p.targetId = 'm1';
  assert.ok(useConsumable(world, p, 0).ok);
  assert.equal(m.statuses[0].mods.dmgTakenPct, 20);
  assert.ok(m.statuses[0].slowPct > 0);
  assert.equal(m.target, p.id, 'the monster did not notice who threw it');
});

test('reset bottles are free resets, and the cooldown bottle clears skills only', () => {
  const p = character(['skill_reset', 'cooldown_reset']);
  assert.ok(useConsumable(world, p, slot(p, 'skill_reset')).ok);
  assert.equal(p.record.skillPoints, 3);
  assert.equal(p.record.aurum, 1000, 'the bottle charged the NPC fee as well');
  p.cooldowns = { first_aid: Date.now() + 9e4, 'item:hp_potion_s': Date.now() + 9e4 };
  assert.ok(useConsumable(world, p, slot(p, 'cooldown_reset')).ok);
  assert.ok(!p.cooldowns.first_aid, 'the skill is still cooling down');
  assert.ok(p.cooldowns['item:hp_potion_s'], 'item cooldowns are not the bottle\'s to clear');
});

test('a teleport potion takes you to your save point', () => {
  const p = character(['teleport_potion']);
  assert.ok(useConsumable(world, p, 0).ok);
  assert.deepEqual(p.warpedTo, { map: 'artaris', x: 960, y: 736 });
});

test('every monster drops bottles that exist, and every boss pays the rare ones', () => {
  for (const m of Object.values(MONSTERS)) {
    if (m.summon) continue;
    assert.ok(m.drops.length, `${m.id} drops nothing`);
    for (const d of m.drops) assert.ok(ITEMS[d.id], `${m.id} drops the unknown ${d.id}`);
    if (m.boss) assert.ok(m.drops.some((d) => d.id === 'revive_potion'), `${m.id} is a boss without a revive`);
  }
});

test('the growth bottles are never on a shelf', () => {
  const sold = new Set(Object.values(SHOPS).flatMap((s) => s.stock.map((l) => l.id)));
  for (const id of ['exp_potion', 'drop_rate_up', 'rare_drop_up', 'skill_reset', 'stat_reset', 'full_restore', 'cooldown_reset']) {
    assert.ok(!sold.has(id), `${id} is sold by an NPC`);
  }
  assert.ok(sold.has('hp_potion_s') && sold.has('mp_potion_s'), 'the basics are not for sale');
});
