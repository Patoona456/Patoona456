// Does the world survive a deploy?
//
// Guilds exist because a party lasts an evening and a guild should last
// months - which is worth nothing if a server restart forgets them. This
// boots a real server, makes a guild and a party, kills the process, boots it
// again from the same database and checks both are still there.
//
// It needs a server but not a browser, so unlike play.test.js it never skips.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ROOT } from './harness.js';

const PORT = Number(process.env.EMBERFALL_TEST_PORT ?? 8199) + 1;
const BASE = `http://127.0.0.1:${PORT}`;

async function boot(data) {
  const proc = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), EMBERFALL_DATA: data, EMBERFALL_DEV: '1', EMBERFALL_MAX_ACCOUNTS_PER_IP: '0' },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const deadline = Date.now() + 20000;
  for (;;) {
    if (Date.now() > deadline) { proc.kill('SIGKILL'); throw new Error('server never came up'); }
    try { if ((await fetch(BASE, { signal: AbortSignal.timeout(800) })).ok) return proc; } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
}

/** SIGTERM and wait: the server saves the world on the way out. */
function stop(proc) {
  return new Promise((res) => {
    proc.on('exit', res);
    proc.kill('SIGTERM');
    setTimeout(res, 5000);
  });
}

/** Log in (registering on the first visit) and run something as that character. */
async function play(account, charName, run) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const seen = [];
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  ws.on('message', (d) => { try { seen.push(JSON.parse(d)); } catch { /* not ours */ } });

  const send = (m) => ws.send(JSON.stringify(m));
  const wait = async (pred, ms = 5000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const hit = seen.find(pred);
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 40));
    }
    return null;
  };

  send({ t: 'register', name: account, password: 'pass1234' });
  await wait((m) => m.t === 'chars' || m.t === 'error', 3000);
  if (seen.some((m) => m.t === 'error')) {
    seen.length = 0;
    send({ t: 'login', name: account, password: 'pass1234' });
  }
  let withChar = await wait((m) => m.t === 'chars' && m.chars?.length, 2000);
  if (!withChar) {
    send({ t: 'charCreate', name: charName });
    withChar = await wait((m) => m.t === 'chars' && m.chars?.length);
  }
  assert.ok(withChar, 'never got a character list');
  send({ t: 'enter', id: withChar.chars[0].id });
  assert.ok(await wait((m) => m.t === 'self'), 'never entered the world');

  const out = await run({ send, wait, seen });
  ws.close();
  return out;
}

test('a guild and a party outlive the server process', { timeout: 120000 }, async (t) => {
  const data = await mkdtemp(path.join(tmpdir(), 'emberfall-persist-'));
  let proc = await boot(data);
  t.after(async () => { await stop(proc); await rm(data, { recursive: true, force: true }); });

  const before = await play('persist1', 'ผู้ก่อตั้ง', async ({ send, wait }) => {
    send({ t: 'devBoost', level: 60 });           // founding a guild costs real money
    await new Promise((r) => setTimeout(r, 1500));
    send({ t: 'guild', cmd: 'create', name: 'กิลด์ทดสอบ' });
    const g = await wait((m) => m.t === 'guildState' && m.guild);
    send({ t: 'guild', cmd: 'donate', amount: 12345 });
    await new Promise((r) => setTimeout(r, 400));
    send({ t: 'party', cmd: 'create', name: 'ปาร์ตี้ทดสอบ' });
    const pt = await wait((m) => m.t === 'partyState' && m.party);
    return { guild: g?.guild?.name, rank: g?.guild?.myRank, party: pt?.party?.name };
  });
  assert.equal(before.guild, 'กิลด์ทดสอบ', 'the guild was never founded');
  assert.equal(before.rank, 'leader');
  assert.equal(before.party, 'ปาร์ตี้ทดสอบ');

  await stop(proc);
  proc = await boot(data);

  const after = await play('persist1', 'ผู้ก่อตั้ง', async ({ send, wait }) => {
    send({ t: 'guild', cmd: 'state' });
    const g = await wait((m) => m.t === 'guildState');
    send({ t: 'party', cmd: 'state' });
    const pt = await wait((m) => m.t === 'partyState');
    return { guild: g?.guild?.name, rank: g?.guild?.myRank, purse: g?.guild?.aurum, party: pt?.party?.name };
  });

  assert.equal(after.guild, before.guild, 'the guild did not survive the restart');
  assert.equal(after.rank, 'leader', 'the rank did not survive the restart');
  assert.equal(after.purse, 12345, 'the guild purse did not survive the restart');
  assert.equal(after.party, before.party, 'the party did not survive the restart');
});
