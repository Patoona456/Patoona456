// How many people can actually be in here at once.
//
// This exists for the same reason `npm run balance` does: a number nobody can
// reproduce is a number nobody has. The capacity of this server was measured
// once, by hand, early on - and then the snapshot path grew shop signs, the
// world grew a siege that ticks every second, and every attack started asking
// whether the two parties may duel. None of that was measured, because the
// script that measured it was never written down.
//
//   npm run load                 150 clients, 30 seconds
//   npm run load -- 300 60       300 clients, 60 seconds
//
// The clients are raw sockets, not browsers: what is being measured is the
// server, and a browser would cap the run at however many Chromiums fit in
// memory. They count what arrives and throw it away immediately - an earlier
// version of this buffered every packet and ran the *test* out of memory at
// two hundred clients, which measured nothing except itself.
import { WebSocket } from 'ws';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** What a healthy server owes its players, whatever else it is doing. */
export const TARGET = {
  /** Snapshots a second, per client. The server aims for ten. */
  snapshotsPerSecond: 7,
  /** The slowest single gap between snapshots anybody may see, in ms. */
  worstGapMs: 1200,
};

async function boot(port, data) {
  const proc = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
    cwd: ROOT,
    env: {
      ...process.env, PORT: String(port), AFO_DATA: data, AFO_DEV: '1',
      AFO_MAX_ACCOUNTS_PER_IP: '0',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const deadline = Date.now() + 25000;
  for (;;) {
    if (Date.now() > deadline) { proc.kill('SIGKILL'); throw new Error('server never came up'); }
    try {
      if ((await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(800) })).ok) return proc;
    } catch { /* not listening yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
}

/**
 * One client: registers, enters the world, then walks in a circle and swings
 * at whatever is nearby, which is what an actual player's traffic looks like.
 */
function client(port, tag) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const me = {
    ws, snapshots: 0, bytes: 0, worstGap: 0, last: 0, entered: false, failed: null,
    close: () => { try { ws.close(); } catch { /* already gone */ } },
  };
  let charId = null;

  ws.on('error', (e) => { me.failed ??= e.message; });
  ws.on('open', () => ws.send(JSON.stringify({ t: 'register', name: tag, password: 'pass1234' })));
  ws.on('message', (raw) => {
    me.bytes += raw.length;
    let m;
    // Parsed and dropped on the floor. Nothing is kept: the point is to be a
    // load, not to have an opinion about what came back.
    try { m = JSON.parse(raw); } catch { return; }

    if (m.t === 'snapshot') {
      const now = Date.now();
      if (me.last) me.worstGap = Math.max(me.worstGap, now - me.last);
      me.last = now;
      me.snapshots++;
      return;
    }
    if (m.t === 'chars') {
      if (!m.chars?.length) return ws.send(JSON.stringify({ t: 'charCreate', name: 'ท' + tag.slice(-6) }));
      if (charId) return;
      charId = m.chars[0].id;
      return ws.send(JSON.stringify({ t: 'enter', id: charId }));
    }
    if (m.t === 'self') me.entered = true;
  });
  return me;
}

export async function run({ clients = 150, seconds = 30, port = 8300 } = {}) {
  const data = await mkdtemp(path.join(tmpdir(), 'afo-load-'));
  const proc = await boot(port, data);
  const all = [];
  try {
    // Ramp rather than stampede: a hundred and fifty simultaneous registrations
    // measures the login path, which is not what this is for.
    for (let i = 0; i < clients; i++) {
      all.push(client(port, `load${Date.now().toString(36)}${i}`));
      if (i % 10 === 9) await new Promise((r) => setTimeout(r, 120));
    }
    const settle = Date.now() + 8000;
    while (Date.now() < settle && all.filter((c) => c.entered).length < clients * 0.9) {
      await new Promise((r) => setTimeout(r, 200));
    }

    const live = all.filter((c) => c.entered);
    for (const c of live) c.snapshots = 0, c.worstGap = 0, c.last = 0, c.bytes = 0;

    // Everybody moves, because a world where nobody moves does no interest
    // management and measures the wrong thing entirely.
    const walking = setInterval(() => {
      const a = Date.now() / 900;
      for (const c of live) {
        if (c.ws.readyState !== 1) continue;
        c.ws.send(JSON.stringify({ t: 'input', mx: Math.cos(a), my: Math.sin(a) }));
      }
    }, 250);

    const started = Date.now();
    await new Promise((r) => setTimeout(r, seconds * 1000));
    clearInterval(walking);
    const elapsed = (Date.now() - started) / 1000;

    const got = live.filter((c) => c.snapshots > 0);
    const rates = got.map((c) => c.snapshots / elapsed).sort((a, b) => a - b);
    const gaps = got.map((c) => c.worstGap).sort((a, b) => a - b);
    const bytes = got.reduce((n, c) => n + c.bytes, 0);
    const pick = (arr, q) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * q))] : 0;

    return {
      asked: clients,
      entered: live.length,
      receiving: got.length,
      seconds: elapsed,
      rate: { worst: pick(rates, 0), p10: pick(rates, 0.1), median: pick(rates, 0.5) },
      worstGapMs: pick(gaps, 0.99),
      kbPerClientPerSecond: got.length ? bytes / got.length / elapsed / 1024 : 0,
    };
  } finally {
    for (const c of all) c.close();
    await new Promise((r) => setTimeout(r, 300));
    proc.kill('SIGTERM');
    await new Promise((r) => { proc.on('exit', r); setTimeout(r, 4000); });
    await rm(data, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const clients = Number(process.argv[2] ?? 150);
  const seconds = Number(process.argv[3] ?? 30);
  console.log(`\nกำลังวัด: ${clients} ไคลเอนต์ ${seconds} วินาที (เป้า ≥${TARGET.snapshotsPerSecond} สแนปช็อต/วินาที)\n`);
  const r = await run({ clients, seconds });
  const ok = r.rate.p10 >= TARGET.snapshotsPerSecond && r.worstGapMs <= TARGET.worstGapMs;
  console.log(`เข้าโลกได้            ${r.entered}/${r.asked}`);
  console.log(`ได้รับสแนปช็อต        ${r.receiving}`);
  console.log(`สแนปช็อต/วินาที       แย่สุด ${r.rate.worst.toFixed(1)} · p10 ${r.rate.p10.toFixed(1)} · กลาง ${r.rate.median.toFixed(1)}`);
  console.log(`ช่องว่างยาวสุด (p99)  ${r.worstGapMs} ms`);
  console.log(`แบนด์วิดท์            ${r.kbPerClientPerSecond.toFixed(1)} KB/วินาที/คน`);
  console.log(`\n${ok ? 'ผ่าน' : '<< ตกเกณฑ์'}\n`);
  if (!ok) process.exitCode = 1;
}
