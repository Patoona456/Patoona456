// The store has to survive the world as it actually is.
//
// It is the one module where a failure is silent: `save()` catches, logs one
// line and carries on, so a world that cannot be written looks exactly like a
// world that is being written - until the process restarts and everything
// since boot is gone. That happened: a counter that nothing had incremented
// yet was `undefined`, JSON.stringify gave back `undefined`, SQLite refused
// to bind it, and every save on every server without a guild threw inside the
// transaction.
import './fixtures/items.js';          // the item systems need items to work on
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openStore } from '../server/store-sqlite.js';

/** The shape persistence.js starts from, before anything has happened. */
const emptyWorld = () => ({
  version: 1,
  accounts: {}, characters: {}, storage: {}, guilds: {}, parties: {},
  market: [], stats: { created: Date.now() }, nextCharId: 1,
});

async function scratch(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'afo-store-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('a brand new world saves, before anyone has done anything', async (t) => {
  const store = openStore(await scratch(t));
  t.after(() => store.close());
  store.write(emptyWorld());        // this is the one that used to throw
});

test('a world saves whether or not its optional counters exist', async (t) => {
  const store = openStore(await scratch(t));
  t.after(() => store.close());
  for (const extra of [
    {},
    { nextGuildId: 3 },
    { nextPartyId: 7 },
    { nextGuildId: 3, nextPartyId: 7 },
    { nextGuildId: undefined, nextPartyId: undefined },
  ]) {
    store.write({ ...emptyWorld(), ...extra });
  }
});

test('what goes in comes back out', async (t) => {
  const dir = await scratch(t);
  const store = openStore(dir);
  const world = emptyWorld();
  world.accounts.someone = { key: 'someone', name: 'ใครสักคน', chars: ['1'], created: 1 };
  world.characters['1'] = { id: '1', name: 'ตัวละคร', level: 42, aurum: 999, guild: 'g1' };
  world.guilds.g1 = { id: 'g1', name: 'กิลด์', leader: '1', members: [{ charId: '1', rank: 'leader' }], aurum: 5, vault: [] };
  world.parties.pt1 = { id: 'pt1', name: 'ปาร์ตี้', leader: '1', members: ['1'], seen: 123 };
  world.storage.someone = { items: [{ id: 'lesser_salve', qty: 4 }], aurum: 10 };
  world.market = [{ uid: 'm1', id: 'iron_pike', qty: 1, price: 500, sold: false }];
  world.nextCharId = 9;
  world.nextGuildId = 2;
  world.nextPartyId = 4;
  store.write(world);
  store.close();

  const reopened = openStore(dir);
  t.after(() => reopened.close());
  const back = reopened.read({});
  assert.equal(back.accounts.someone.name, 'ใครสักคน');
  assert.equal(back.characters['1'].aurum, 999);
  assert.equal(back.guilds.g1.name, 'กิลด์', 'the guild did not come back');
  assert.equal(back.parties.pt1.name, 'ปาร์ตี้', 'the party did not come back');
  assert.equal(back.storage.someone.aurum, 10);
  assert.equal(back.market.length, 1);
  assert.equal(back.nextGuildId, 2);
  assert.equal(back.nextPartyId, 4);
});

test('deleting something removes its row rather than leaving a ghost', async (t) => {
  const dir = await scratch(t);
  const store = openStore(dir);
  const world = emptyWorld();
  world.guilds.g1 = { id: 'g1', name: 'ยุบแล้ว', members: [] };
  world.parties.pt1 = { id: 'pt1', name: 'เลิกแล้ว', members: [] };
  store.write(world);

  delete world.guilds.g1;
  delete world.parties.pt1;
  store.write(world);
  store.close();

  const reopened = openStore(dir);
  t.after(() => reopened.close());
  const back = reopened.read({});
  assert.deepEqual(Object.keys(back.guilds), [], 'a disbanded guild was left in the database');
  assert.deepEqual(Object.keys(back.parties), [], 'a finished party was left in the database');
});

test('saving twice with nothing changed is not an error', async (t) => {
  const store = openStore(await scratch(t));
  t.after(() => store.close());
  const world = emptyWorld();
  world.characters['1'] = { id: '1', name: 'เดิม', level: 1 };
  store.write(world);
  store.write(world);
  store.write(world);
});
