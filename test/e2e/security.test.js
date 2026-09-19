// An adversarial client.
//
// Everything else in the suite drives the game the way a player would. This
// file opens a raw socket and lies: negative quantities, indices off the end
// of the bag, dev commands with dev mode off, movement vectors of nine
// hundred, trading with itself. The server is authoritative, and this is what
// proves it stays that way when someone refactors the validation out of a
// handler by accident.
//
// It also pins the registration limit, because "how many accounts can one
// address open" is a number that should never quietly become "as many as it
// likes" again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ROOT } from './harness.js';

const PORT = Number(process.env.EMBERFALL_TEST_PORT ?? 8199) + 2;
const BASE = `http://127.0.0.1:${PORT}`;

async function boot(data, env = {}) {
  const proc = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
    cwd: ROOT,
    // deliberately NOT EMBERFALL_DEV: the dev commands must be refused here
    env: { ...process.env, PORT: String(PORT), EMBERFALL_DATA: data, EMBERFALL_DEV: '', ...env },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const deadline = Date.now() + 20000;
  for (;;) {
    if (Date.now() > deadline) { proc.kill('SIGKILL'); throw new Error('server never came up'); }
    try { if ((await fetch(BASE, { signal: AbortSignal.timeout(800) })).ok) return proc; } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
}
const stop = (proc) => new Promise((res) => { proc.on('exit', res); proc.kill('SIGTERM'); setTimeout(res, 4000); });

/** A socket with no game client behind it. */
async function socket() {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const seen = [];
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  ws.on('message', (d) => { try { seen.push(JSON.parse(d)); } catch { /* not ours */ } });
  const send = (m) => ws.send(JSON.stringify(m));
  const settle = (ms = 400) => new Promise((r) => setTimeout(r, ms));
  const wait = async (pred, ms = 5000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const hit = seen.find(pred);
      if (hit) return hit;
      await settle(40);
    }
    return null;
  };
  return { ws, seen, send, wait, settle, close: () => ws.close() };
}

/** Register, make a character, walk into the world. */
async function enter(c, tag) {
  c.send({ t: 'register', name: tag, password: 'pass1234' });
  await c.wait((m) => m.t === 'chars');
  c.send({ t: 'charCreate', name: 'ท' + tag.slice(0, 6) });
  const list = await c.wait((m) => m.t === 'chars' && m.chars?.length);
  assert.ok(list, 'never got a character');
  c.send({ t: 'enter', id: list.chars[0].id });
  const self = await c.wait((m) => m.t === 'self');
  assert.ok(self, 'never entered the world');
  return self.self;
}

test('the server refuses a client that lies to it', { timeout: 120000 }, async (t) => {
  const data = await mkdtemp(path.join(tmpdir(), 'emberfall-sec-'));
  const proc = await boot(data);
  t.after(async () => { await stop(proc); await rm(data, { recursive: true, force: true }); });

  const c = await socket();
  t.after(() => c.close());
  const me = await enter(c, 'sec' + Math.floor(Math.random() * 1e9).toString(36));
  const startAurum = me.aurum;

  /** Send something dishonest and assert the server said no. */
  const refused = async (label, msg) => {
    const n = c.seen.length;
    c.send(msg);
    await c.settle();
    const replies = c.seen.slice(n);
    assert.ok(replies.some((m) => m.t === 'error'), `${label}: the server allowed it`);
  };

  await t.test('quantities that are not quantities', async () => {
    for (const [label, qty] of [['negative', -5], ['fractional', 1.9], ['enormous', 1e9], ['not a number', 'abc']]) {
      await refused(`buying a ${label} amount`, { t: 'shopBuy', shop: 'general', id: 'lesser_salve', qty });
    }
    await refused('selling a negative amount', { t: 'shopSell', index: 0, qty: -99 });
    await refused('a million gacha draws at once', { t: 'gachaDraw', times: 1000000 });
  });

  await t.test('indices that point nowhere', async () => {
    for (const index of [-1, 99999]) {
      await refused(`equipping index ${index}`, { t: 'equip', index });
      await refused(`refining index ${index}`, { t: 'refine', index });
    }
  });

  await t.test('doing business with an NPC who is nowhere near', async () => {
    await refused('buying with no shopkeeper in sight', { t: 'shopBuy', shop: 'general', id: 'lesser_salve', qty: 1 });
    await refused('opening the vault from the field', { t: 'storage' });
  });

  await t.test('dev commands when dev mode is off', async () => {
    await refused('devBoost', { t: 'devBoost', level: 99 });
    await refused('devWarp', { t: 'devWarp', map: 'vhaal' });
    await refused('devRefine', { t: 'devRefine', index: 0, refine: 12 });
  });

  await t.test('skills nobody learned, and skills nobody wrote', async () => {
    await refused('casting an unlearned skill', { t: 'skill', skill: 'meteor_rune' });
    await refused('casting a skill that does not exist', { t: 'skill', skill: '__nope' });
  });

  await t.test('stat points out of thin air', async () => {
    await refused('spending points I do not have', { t: 'addStat', stat: 'str', n: 9999 });
  });

  await t.test('trading with oneself, and listing at a negative price', async () => {
    await refused('trading with myself', { t: 'trade', cmd: 'invite', name: me.name });
    await refused('listing at a negative price', { t: 'market', cmd: 'list', index: 0, price: -1000, qty: 1 });
  });

  await t.test('a movement vector of nine hundred still moves at walking pace', async () => {
    const pos = () => c.seen.filter((m) => m.t === 'snapshot' && m.you).pop()?.you;
    await c.wait((m) => m.t === 'snapshot' && m.you);
    const before = { ...pos() };
    c.send({ t: 'input', mx: 999, my: 999 });
    await c.settle(1200);
    const after = pos();
    c.send({ t: 'input', mx: 0, my: 0 });
    const travelled = Math.hypot(after.x - before.x, after.y - before.y);
    // BASE_MOVE_SPEED is 108 px/s; a little over is timing slack, 3x is a hack
    assert.ok(travelled < 108 * 1.2 * 2.2,
      `moved ${travelled.toFixed(0)}px in ~1.2s, which is faster than the server should ever allow`);
  });

  await t.test('none of that made any money', async () => {
    const n = c.seen.length;
    c.send({ t: 'quests' });
    await c.settle(500);
    const self = c.seen.slice(n).filter((m) => m.t === 'self').pop()?.self
      ?? c.seen.filter((m) => m.t === 'self').pop()?.self;
    assert.ok(self, 'never saw the character state');
    assert.ok(self.aurum <= startAurum, `aurum went from ${startAurum} to ${self.aurum}`);
  });
});

test('one address cannot open unlimited accounts', { timeout: 120000 }, async (t) => {
  const data = await mkdtemp(path.join(tmpdir(), 'emberfall-ip-'));
  const proc = await boot(data, { EMBERFALL_MAX_ACCOUNTS_PER_IP: '3' });
  t.after(async () => { await stop(proc); await rm(data, { recursive: true, force: true }); });

  const results = [];
  for (let i = 1; i <= 5; i++) {
    const c = await socket();
    c.send({ t: 'register', name: 'ipuser' + i, password: 'pass1234' });
    await c.settle(500);
    results.push(c.seen.some((m) => m.t === 'error') ? 'refused' : 'created');
    c.close();
  }
  assert.deepEqual(results, ['created', 'created', 'created', 'refused', 'refused'],
    `the limit did not hold: ${results.join(', ')}`);
});

test('the admin dashboard is shut unless a token is configured', { timeout: 120000 }, async (t) => {
  const data = await mkdtemp(path.join(tmpdir(), 'emberfall-adm-'));
  let proc = await boot(data);
  t.after(async () => { await stop(proc); await rm(data, { recursive: true, force: true }); });

  assert.equal((await fetch(`${BASE}/admin`)).status, 404, 'the dashboard answered with no token configured');

  await stop(proc);
  proc = await boot(data, { EMBERFALL_ADMIN_TOKEN: 's3cret' });
  assert.equal((await fetch(`${BASE}/admin`)).status, 401, 'it served the page with no token');
  assert.equal((await fetch(`${BASE}/admin?token=wrong`)).status, 401, 'it accepted the wrong token');
  assert.equal((await fetch(`${BASE}/admin?token=s3cret`)).status, 200, 'it refused the right token');

  const stats = await (await fetch(`${BASE}/admin/stats.json?token=s3cret`)).json();
  assert.ok(typeof stats.money?.minted === 'number', 'the stats feed is missing its numbers');
  assert.ok(typeof stats.money?.burnBy === 'object', 'the stats feed is missing the sink breakdown');
});
