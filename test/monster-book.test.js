// The monster book's jigsaw: each kill may drop a piece of its monster's
// picture, always a missing one, straight into the book; a finished picture
// is a small permanent bonus, a finished region one more, and none of it is
// an item anybody can trade.
import './fixtures/items.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../server/game/player.js';
import { World } from '../server/game/world.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { bookEntries, bookReward, bookBonus, BOOK_SETS, setMembers, PIECES, pieceChance, pieceCount } from '../shared/data/monsterbook.js';

const FULL = (1 << PIECES) - 1;

function character(jigsaw = {}) {
  const record = {
    id: 'm1', name: 'นักล่า', level: 10, jobLevel: 10, job: 'novice',
    str: 10, agi: 10, vit: 10, int: 10, dex: 10, luk: 10,
    exp: 0, jobExp: 0, statPoints: 0, skillPoints: 0, aurum: 0,
    map: 'greenmire', x: 1000, y: 1000,
    look: { gender: 'male', body: 'light', eyes: 'brown', hair: 'plain', hairColor: 'brown' },
    inventory: [], equipment: {}, skills: {}, hotbar: [], quests: {}, storage: [],
    npcSales: {}, salesDay: 0, lockouts: {}, kills: {}, jigsaw,
  };
  const sent = [];
  const p = new Player(record, { send: (m) => sent.push(m) });
  p.recompute();
  return { p, sent };
}

test('a picture pays nothing until its ninth piece, then its reward for good', () => {
  const before = character({ blue_slime: FULL & ~1 }).p.derived;
  const after = character({ blue_slime: FULL }).p.derived;
  const r = bookReward(MONSTERS.blue_slime);
  assert.equal(after.atk - before.atk, r.atk);
  assert.equal(after.maxHp - before.maxHp, r.maxHp);
});

test('a kill drops a piece only on its roll, and always one still missing', (t) => {
  const w = new World();
  t.after(() => w.stop?.());
  const { p } = character({ blue_slime: FULL & ~(1 << 4) });   // only piece 4 left
  const chance = pieceChance(MONSTERS.blue_slime);
  assert.equal(w.rollPiece(p, { defId: 'blue_slime' }, chance + 0.01), null, 'no piece off the roll');
  assert.equal(w.rollPiece(p, { defId: 'blue_slime' }, 0), 4, 'the missing one');
  assert.equal(w.rollPiece(p, { defId: 'blue_slime' }, 0), null, 'nothing once it is whole');
});

test('bosses drop pieces far more often, and pay more, than a field monster', () => {
  assert.ok(pieceChance(MONSTERS.tree_guardian) > pieceChance(MONSTERS.alpha_wolf));
  assert.ok(pieceChance(MONSTERS.alpha_wolf) > pieceChance(MONSTERS.wild_boar));
  const boss = bookReward(MONSTERS.tree_guardian), mini = bookReward(MONSTERS.alpha_wolf), field = bookReward(MONSTERS.blue_slime);
  assert.ok(boss.atk > mini.atk && mini.atk > field.atk);
  // a field picture is a long hunt, not an afternoon
  assert.ok(PIECES / pieceChance(MONSTERS.blue_slime) >= 100);
});

test('finishing all of Greenmire pays the region too, and the book stays modest', () => {
  const set = BOOK_SETS.find((s) => s.id === 'greenmire');
  const jigsaw = Object.fromEntries(setMembers(set).map((id) => [id, FULL]));
  const b = bookBonus(jigsaw);
  assert.ok(b.sets.includes('greenmire'));
  assert.equal(b.expPct, set.reward.expPct);
  assert.ok(!bookBonus({ ...jigsaw, tree_guardian: FULL >> 1 }).sets.length, 'every piece of every one, boss included');
  const all = bookBonus(Object.fromEntries(bookEntries().map((m) => [m.id, FULL])));
  assert.ok(all.atk <= 20 && all.maxHp <= 300, JSON.stringify(all));
});

test('the piece that finishes a picture tells the player and pays at once', (t) => {
  const w = new World();
  t.after(() => w.stop?.());
  const { p, sent } = character({ blue_slime: FULL & ~1 });
  const atk = p.derived.atk;
  w.rollPiece(p, { defId: 'blue_slime' }, 0);
  assert.equal(pieceCount(p.record.jigsaw.blue_slime), PIECES);
  assert.equal(p.derived.atk, atk + bookReward(MONSTERS.blue_slime).atk);
  assert.ok(sent.some((m) => m.t === 'piece'));
  assert.ok(sent.some((m) => m.t === 'notice' && /ครบ/.test(m.text)));
  assert.ok(sent.some((m) => m.t === 'self' && m.self.book.pages.includes('blue_slime')));
});
