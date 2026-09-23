// Guild levels, the skills they unlock, and the weekly goals.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Guild from '../server/game/guild.js';
import { db } from '../server/persistence.js';
import { guildExpToNext, GUILD_MAX_LEVEL, GUILD_QUESTS, guildCapacity } from '../shared/data/guild.js';

function guild(id) {
  db.guilds ??= {};
  db.guilds[id] = { id, name: id, members: [], level: 1, exp: 0, goals: {}, history: [] };
  return db.guilds[id];
}

test('guild EXP carries over levels and stops at the cap', () => {
  const g = guild('gtest1');
  Guild.addExp(null, g, guildExpToNext(1) + guildExpToNext(2) + 5);
  assert.equal(g.level, 3);
  assert.equal(g.exp, 5);
  Guild.addExp(null, g, 1e9);
  assert.equal(g.level, GUILD_MAX_LEVEL);
  assert.equal(g.exp, 0);
});

test('skills come with the level, and only to members', () => {
  const g = guild('gtest2');
  assert.deepEqual(Guild.skillsOf({ guild: 'gtest2' }).map((s) => s.id), []);
  g.level = 5;
  assert.deepEqual(Guild.skillsOf({ guild: 'gtest2' }).map((s) => s.id), ['hp', 'def', 'atk']);
  assert.deepEqual(Guild.skillsOf({ guild: null }), []);
});

test('a weekly goal pays its guild EXP once', () => {
  const g = guild('gtest3');
  const hunt = GUILD_QUESTS.find((q) => q.id === 'hunt');
  for (let i = 0; i < hunt.need + 50; i++) Guild.progress(null, g, 'hunt', 1);
  const paid = g.exp + [...Array(g.level - 1)].reduce((a, _, i) => a + guildExpToNext(i + 1), 0);
  assert.equal(paid, hunt.exp, 'the goal paid more or less than once');
});

test('the roster grows with the level', () => {
  assert.ok(guildCapacity(10) > guildCapacity(1));
  assert.equal(guildCapacity(1), 30);
});
