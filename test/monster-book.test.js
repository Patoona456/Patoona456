// The monster book's rewards: a finished page is a small permanent bonus, a
// finished region one more, and none of it is an item anybody can trade.
import './fixtures/items.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../server/game/player.js';
import { World } from '../server/game/world.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { bookEntries, bookReveal, bookReward, bookBonus, BOOK_SETS, setMembers } from '../shared/data/monsterbook.js';

function character(kills = {}) {
  const record = {
    id: 'm1', name: 'นักล่า', level: 10, jobLevel: 10, job: 'novice',
    str: 10, agi: 10, vit: 10, int: 10, dex: 10, luk: 10,
    exp: 0, jobExp: 0, statPoints: 0, skillPoints: 0, aurum: 0,
    map: 'greenmire', x: 1000, y: 1000,
    look: { gender: 'male', body: 'light', eyes: 'brown', hair: 'plain', hairColor: 'brown' },
    inventory: [], equipment: {}, skills: {}, hotbar: [], quests: {}, storage: [],
    npcSales: {}, salesDay: 0, lockouts: {}, kills,
  };
  const sent = [];
  const p = new Player(record, { send: (m) => sent.push(m) });
  p.recompute();
  return { p, sent };
}

test('a page pays nothing until it is finished, then its reward for good', () => {
  const slime = MONSTERS.blue_slime;
  const need = bookReveal(slime).rates;
  const before = character({ blue_slime: need - 1 }).p.derived;
  const after = character({ blue_slime: need }).p.derived;
  const r = bookReward(slime);
  assert.equal(after.atk - before.atk, r.atk);
  assert.equal(after.maxHp - before.maxHp, r.maxHp);
});

test('bosses finish in a few kills and pay more than a field monster', () => {
  const boss = bookReward(MONSTERS.tree_guardian), mini = bookReward(MONSTERS.alpha_wolf), field = bookReward(MONSTERS.blue_slime);
  assert.ok(boss.atk > mini.atk && mini.atk > field.atk);
  assert.ok(bookReveal(MONSTERS.tree_guardian).rates <= 5);
});

test('finishing all of Greenmire pays the region too, and the book stays modest', () => {
  const set = BOOK_SETS.find((s) => s.id === 'greenmire');
  const kills = Object.fromEntries(setMembers(set).map((id) => [id, 999]));
  const b = bookBonus(kills);
  assert.ok(b.sets.includes('greenmire'));
  assert.equal(b.expPct, set.reward.expPct);
  assert.ok(!bookBonus({ ...kills, tree_guardian: 0 }).sets.length, 'every one of them, boss included');
  // the whole book is a nudge, not a second weapon
  const all = bookBonus(Object.fromEntries(bookEntries().map((m) => [m.id, 9999])));
  assert.ok(all.atk <= 20 && all.maxHp <= 300, JSON.stringify(all));
});

test('the kill that finishes a page tells the player and pays at once', (t) => {
  const w = new World();
  t.after(() => w.stop?.());
  const need = bookReveal(MONSTERS.blue_slime).rates;
  const { p, sent } = character({ blue_slime: need - 1 });
  const atk = p.derived.atk;
  w.onKill(p, { defId: 'blue_slime', level: 1 });
  assert.equal(p.derived.atk, atk + bookReward(MONSTERS.blue_slime).atk);
  assert.ok(sent.some((m) => m.t === 'notice' && /ครบ/.test(m.text)));
  assert.ok(sent.some((m) => m.t === 'self' && m.self.book.pages.includes('blue_slime')));
  sent.length = 0;
  w.onKill(p, { defId: 'blue_slime', level: 1 });
  assert.ok(!sent.some((m) => m.t === 'notice'), 'once');
});
