// A long run, to find what a short one cannot.
//
// Everything else in this repo checks behaviour at a moment: a formula, a
// rule, a fight, a snapshot. None of that catches the failures that only
// appear after an hour - a map that grows a key per kill, a counter that
// drifts, a save path that throws quietly and stops writing. That last one
// actually happened here: the world stopped persisting on any server where
// nobody had founded a guild, and it went unnoticed across several commits
// because `save()` logs one line and carries on.
//
//   npm run soak                10 bots, 3 minutes
//   npm run soak -- 20 30       20 bots, 30 minutes
//
// The bots fight, die, respawn and buy things, and the run watches three
// things that should be flat: heap, entity count, and whether the world is
// still being written to disk.
import { WebSocket } from 'ws';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** What must still be true after a long run. */
export const LIMITS = {
  /** Heap may grow while caches warm, but not without bound. */
  heapGrowthFactor: 2.5,
  /** The database file has to keep changing, or nothing is being saved. */
  mustKeepSaving: true,
};

function bot(port, tag, stats) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const me = { ws, entered: false, kills: 0, deaths: 0, close: () => { try { ws.close(); } catch { /* gone */ } } };
  let charId = null;
  let target = null;

  ws.on('error', () => { stats.socketErrors++; });
  ws.on('open', () => ws.send(JSON.stringify({ t: 'register', name: tag, password: 'pass1234' })));
  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'chars') {
      if (!m.chars?.length) return ws.send(JSON.stringify({ t: 'charCreate', name: 'ซ' + tag.slice(-6) }));
      if (charId) return;
      charId = m.chars[0].id;
      return ws.send(JSON.stringify({ t: 'enter', id: charId }));
    }
    if (m.t === 'self') {
      me.entered = true;
      // straight out to the field, where there is something to fight
      ws.send(JSON.stringify({ t: 'devWarp', map: 'greenmire' }));
      return;
    }
    if (m.t === 'died') { me.deaths++; stats.deaths++; setTimeout(() => ws.send(JSON.stringify({ t: 'respawn' })), 800); return; }
    if (m.t === 'snapshot') {
      stats.snapshots++;
      const mobs = (m.ents ?? []).filter((e) => e.k === 'm' && e.hp > 0);
      const you = m.you;
      if (!you?.alive) return;
      if (!mobs.length) {
        // nothing here: wander, which also exercises interest management
        const a = Date.now() / 700 + tag.length;
        return ws.send(JSON.stringify({ t: 'input', mx: Math.cos(a), my: Math.sin(a) }));
      }
      const near = mobs.reduce((a, b) =>
        Math.hypot(b.x - you.x, b.y - you.y) < Math.hypot(a.x - you.x, a.y - you.y) ? b : a);
      const dx = near.x - you.x, dy = near.y - you.y;
      const d = Math.hypot(dx, dy) || 1;
      if (target !== near.id) { target = near.id; ws.send(JSON.stringify({ t: 'target', id: near.id })); }
      if (d > 34) ws.send(JSON.stringify({ t: 'input', mx: dx / d, my: dy / d }));
      else {
        ws.send(JSON.stringify({ t: 'input', mx: 0, my: 0 }));
        ws.send(JSON.stringify({ t: 'attack', on: true, id: near.id }));
      }
    }
  });
  return me;
}

export async function run({ bots = 10, minutes = 3, port = 8320 } = {}) {
  const data = await mkdtemp(path.join(tmpdir(), 'afo-soak-'));
  const proc = spawn(process.execPath, ['--expose-gc', path.join(ROOT, 'server', 'index.js')], {
    cwd: ROOT,
    env: {
      ...process.env, PORT: String(port), AFO_DATA: data, AFO_DEV: '1',
      AFO_MAX_ACCOUNTS_PER_IP: '0', AFO_ADMIN_TOKEN: 'soak',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = [];
  proc.stdout.on('data', (d) => log.push(String(d)));
  proc.stderr.on('data', (d) => log.push(String(d)));

  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 25000;
  for (;;) {
    if (Date.now() > deadline) { proc.kill('SIGKILL'); throw new Error('server never came up'); }
    try { if ((await fetch(base, { signal: AbortSignal.timeout(800) })).ok) break; } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }

  const stats = { snapshots: 0, deaths: 0, socketErrors: 0 };
  const all = [];
  const samples = [];
  try {
    for (let i = 0; i < bots; i++) {
      all.push(bot(port, `soak${Date.now().toString(36)}${i}`, stats));
      await new Promise((r) => setTimeout(r, 150));
    }
    await new Promise((r) => setTimeout(r, 6000));

    // The store writes world.sqlite, and WAL means most of a save lands in
    // the -wal sidecar first - watching only the main file reports a server
    // that is saving perfectly well as one that has stopped.
    const dbFiles = ['world.sqlite', 'world.sqlite-wal', 'world.json'].map((f) => path.join(data, f));
    const sample = async () => {
      let heap = 0, ents = 0;
      try {
        const res = await fetch(`${base}/admin/stats.json?token=soak`, {
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
          const j = await res.json();
          heap = j.heapUsed ?? 0;
          ents = j.entities ?? 0;
        }
      } catch { /* the dashboard is optional for this */ }
      let dbSize = 0, dbMtime = 0;
      for (const f of dbFiles) {
        try {
          const st = await stat(f);
          dbSize += st.size;
          dbMtime = Math.max(dbMtime, st.mtimeMs);
        } catch { /* this one does not exist, which is fine */ }
      }
      samples.push({ at: Date.now(), heap, ents, dbSize, dbMtime, snapshots: stats.snapshots });
    };

    await sample();
    const until = Date.now() + minutes * 60000;
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, Math.min(15000, Math.max(1000, until - Date.now()))));
      await sample();
    }

    const first = samples[0], last = samples[samples.length - 1];
    const elapsed = (last.at - first.at) / 1000;
    return {
      bots, entered: all.filter((b) => b.entered).length, minutes,
      elapsed, samples, stats,
      heapGrowth: first.heap ? last.heap / first.heap : null,
      stillSaving: last.dbMtime > first.dbMtime || last.dbSize > first.dbSize,
      crashed: proc.exitCode !== null,
      log: log.join(''),
    };
  } finally {
    for (const b of all) b.close();
    await new Promise((r) => setTimeout(r, 300));
    proc.kill('SIGTERM');
    await new Promise((r) => { proc.on('exit', r); setTimeout(r, 5000); });
    await rm(data, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const bots = Number(process.argv[2] ?? 10);
  const minutes = Number(process.argv[3] ?? 3);
  console.log(`\nปล่อยบอท ${bots} ตัว เล่นต่อเนื่อง ${minutes} นาที\n`);
  const r = await run({ bots, minutes });
  const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
  console.log(`เข้าโลกได้        ${r.entered}/${r.bots}`);
  console.log(`สแนปช็อตที่ได้รับ  ${r.stats.snapshots.toLocaleString()}`);
  console.log(`ตายและฟื้น        ${r.stats.deaths}`);
  console.log(`ซ็อกเก็ตพัง       ${r.stats.socketErrors}`);
  for (const s of r.samples) {
    console.log(`  +${Math.round((s.at - r.samples[0].at) / 1000)}s  heap ${mb(s.heap)}  entities ${s.ents}  db ${mb(s.dbSize)}`);
  }
  const heapOk = r.heapGrowth == null || r.heapGrowth <= LIMITS.heapGrowthFactor;
  console.log(`\nheap โต            ${r.heapGrowth ? r.heapGrowth.toFixed(2) + ' เท่า' : '(อ่านไม่ได้)'} ${heapOk ? '' : '<< รั่ว'}`);
  console.log(`ยังเซฟลงดิสก์อยู่   ${r.stillSaving ? 'ใช่' : 'ไม่ << โลกไม่ถูกบันทึก'}`);
  console.log(`เซิร์ฟเวอร์ล่ม      ${r.crashed ? 'ใช่' : 'ไม่'}`);
  const ok = heapOk && r.stillSaving && !r.crashed && r.stats.socketErrors === 0;
  console.log(`\n${ok ? 'ผ่าน' : '<< ตกเกณฑ์'}\n`);
  if (!ok) process.exitCode = 1;
}
