// The operator's view of the economy.
//
// The whole design rests on a claim - that money is hard to come by and that
// the sinks outrun the faucets - and until now there was no way to check it.
// `world.stats` counted minted and burned from the first day and nothing ever
// read them back.
//
// Off by default. It only answers when AFO_ADMIN_TOKEN is set and the
// request carries it, because this is a page about the whole server's
// finances and it has no business being public.
import { db } from './persistence.js';
import { MAPS } from '../shared/data/maps.js';
import { ITEMS } from '../shared/data/items.js';

const TOKEN = process.env.AFO_ADMIN_TOKEN ?? '';
export const adminEnabled = () => TOKEN.length > 0;

/** Constant-time-ish compare, so the token cannot be guessed a byte at a time. */
function tokenOk(given) {
  if (!TOKEN || typeof given !== 'string' || given.length !== TOKEN.length) return false;
  let diff = 0;
  for (let i = 0; i < TOKEN.length; i++) diff |= TOKEN.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

/**
 * What the world is actually worth right now.
 *
 * `minted - burned` is the net the counters claim; walking every purse gives
 * what is really out there. The two should track each other, and when they
 * drift apart something is creating money that nobody wrote down.
 */
export function snapshot(world) {
  const chars = Object.values(db.characters ?? {});
  const held = chars.reduce((n, c) => n + (c.aurum ?? 0), 0);
  const banked = Object.values(db.storage ?? {}).reduce((n, s) => n + (s.aurum ?? 0), 0);
  const guildPurses = Object.values(db.guilds ?? {}).reduce((n, g) => n + (g.aurum ?? 0), 0);
  const listed = (db.market ?? []).filter((l) => !l.sold).reduce((n, l) => n + (l.price ?? 0), 0);

  const zones = {};
  for (const [id, zone] of world.zones) {
    if (!zone.players.size) continue;
    zones[MAPS[id]?.nameTh ?? id] = zone.players.size;
  }

  const levels = {};
  for (const c of chars) {
    const band = `${Math.floor((c.level ?? 1) / 10) * 10}-${Math.floor((c.level ?? 1) / 10) * 10 + 9}`;
    levels[band] = (levels[band] ?? 0) + 1;
  }

  const st = world.stats;
  const richest = [...chars].sort((a, b) => (b.aurum ?? 0) - (a.aurum ?? 0)).slice(0, 10)
    .map((c) => ({ name: c.name, level: c.level, aurum: c.aurum ?? 0, guild: db.guilds?.[c.guild]?.name ?? null }));

  // How the process itself is doing. An economy dashboard that cannot tell
  // you the heap is growing or that entities are piling up is only half a
  // dashboard, and these are the numbers `npm run soak` watches for drift.
  const mem = process.memoryUsage();
  let entities = 0;
  for (const zone of world.zones.values()) entities += zone.entities.size;

  return {
    uptimeMs: Date.now() - (st.started ?? Date.now()),
    online: world.players.size,
    entities,
    heapUsed: mem.heapUsed,
    rss: mem.rss,
    accounts: Object.keys(db.accounts ?? {}).length,
    characters: chars.length,
    guilds: Object.values(db.guilds ?? {}).map((g) => ({
      name: g.name, members: g.members.length, aurum: g.aurum ?? 0, inDebt: !!g.inDebt,
    })).sort((a, b) => b.members - a.members),
    parties: Object.keys(db.parties ?? {}).length,
    money: {
      minted: st.minted ?? 0,
      burned: st.burned ?? 0,
      net: (st.minted ?? 0) - (st.burned ?? 0),
      traded: st.traded ?? 0,
      supply: held + banked + guildPurses,
      held, banked, guildPurses, listed,
      mintBy: st.mintBy ?? {},
      burnBy: st.burnBy ?? {},
    },
    zones,
    levels,
    richest,
    marketDepth: (db.market ?? []).filter((l) => !l.sold).length,
    topListings: (db.market ?? []).filter((l) => !l.sold)
      .sort((a, b) => (b.price ?? 0) - (a.price ?? 0)).slice(0, 8)
      .map((l) => ({ item: ITEMS[l.id]?.nameTh ?? l.id, qty: l.qty ?? 1, price: l.price ?? 0 })),
  };
}

/**
 * Handle /admin and /admin/stats.json. Returns true when it took the request.
 */
export function handle(req, res, world) {
  const url = new URL(req.url ?? '/', 'http://x');
  if (!url.pathname.startsWith('/admin')) return false;

  if (!adminEnabled()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('แดชบอร์ดปิดอยู่ — ตั้ง AFO_ADMIN_TOKEN เพื่อเปิด');
    return true;
  }
  const token = url.searchParams.get('token') ?? (req.headers.authorization ?? '').replace(/^Bearer /, '');
  if (!tokenOk(token)) {
    res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('token ไม่ถูกต้อง');
    return true;
  }

  if (url.pathname === '/admin/stats.json') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(snapshot(world)));
    return true;
  }

  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(PAGE);
  return true;
}

const PAGE = `<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AFO — เศรษฐกิจ</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; background:#0b0d13; color:#e6ecf5; font:14px/1.6 "Noto Sans Thai",system-ui,sans-serif; padding:20px; }
  h1 { font-size:20px; margin:0 0 4px; }
  .sub { color:#8c98ad; font-size:12px; margin-bottom:18px; }
  .grid { display:grid; gap:14px; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); }
  .card { background:#131722; border:1px solid #2a3244; border-radius:10px; padding:14px; }
  .card h2 { font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:#8c98ad; margin:0 0 10px; font-weight:600; }
  .big { font-size:26px; font-weight:700; font-variant-numeric:tabular-nums; }
  .row { display:flex; justify-content:space-between; gap:12px; padding:3px 0; border-bottom:1px solid #1e2534; }
  .row:last-child { border-bottom:none; }
  .num { font-variant-numeric:tabular-nums; }
  .good { color:#6fcf7e; } .bad { color:#ff7a7a; } .warn { color:#f2c14e; } .muted { color:#8c98ad; }
  .bar { height:7px; background:#1e2534; border-radius:99px; overflow:hidden; margin-top:4px; }
  .bar i { display:block; height:100%; background:linear-gradient(90deg,#ff8a3d,#ffb03a); }
  table { width:100%; border-collapse:collapse; }
  td { padding:3px 0; border-bottom:1px solid #1e2534; }
  td:last-child { text-align:right; font-variant-numeric:tabular-nums; }
  .err { color:#ff7a7a; }
</style></head><body>
<h1>Artaria Frontier Online — เศรษฐกิจ</h1>
<div class="sub" id="sub">กำลังโหลด…</div>
<div class="grid" id="grid"></div>
<script>
const token = new URLSearchParams(location.search).get('token') ?? '';
const fmt = (n) => (n ?? 0).toLocaleString('th-TH');
const card = (title, inner) => \`<div class="card"><h2>\${title}</h2>\${inner}</div>\`;
const rows = (obj, total) => Object.entries(obj).sort((a,b)=>b[1]-a[1]).map(([k,v]) =>
  \`<div class="row"><span>\${k}</span><span class="num">\${fmt(v)}<span class="muted"> \${total?((100*v/total).toFixed(1)+'%'):''}</span></span></div>\`).join('') || '<div class="muted">ยังไม่มีข้อมูล</div>';

async function tick() {
  let d;
  try {
    const res = await fetch('/admin/stats.json?token=' + encodeURIComponent(token), { cache: 'no-store' });
    if (!res.ok) throw new Error(await res.text());
    d = await res.json();
  } catch (e) {
    document.getElementById('sub').innerHTML = '<span class="err">' + e.message + '</span>';
    return;
  }
  const m = d.money;
  const hours = d.uptimeMs / 3600000;
  document.getElementById('sub').textContent =
    \`ออนไลน์ \${d.online} คน · \${d.characters} ตัวละคร · \${d.accounts} บัญชี · \${d.guilds.length} กิลด์ · \${d.parties} ปาร์ตี้ · เซิร์ฟเวอร์เปิดมา \${hours.toFixed(1)} ชม.\`;

  // The number the whole design is a claim about. With nothing minted yet
  // there is no ratio to take - and burning money in a world that has minted
  // none is the deepest deflation there is, not inflation, so the zero case
  // must not fall through to the "inflation" branch.
  const ratio = m.minted > 0 ? m.burned / m.minted : (m.burned > 0 ? Infinity : 1);
  const verdict = !isFinite(ratio) ? ['good', 'ยังไม่มีเงินเกิดใหม่เลย']
    : ratio >= 1 ? ['good', 'ท่อระบายชนะ — เงินหดตัว']
      : ratio > 0.7 ? ['warn', 'ใกล้สมดุล'] : ['bad', 'เงินเฟ้อ — ท่อระบายไม่พอ'];
  const pct = isFinite(ratio) ? (ratio * 100).toFixed(0) + '%' : '∞';

  document.getElementById('grid').innerHTML = [
    card('เงินเข้า vs เงินออก', \`
      <div class="big \${verdict[0]}">\${pct}</div>
      <div class="\${verdict[0]}">\${verdict[1]}</div>
      <div class="bar"><i style="width:\${Math.min(100, ratio * 100).toFixed(1)}%"></i></div>
      <div class="row"><span>สร้างขึ้นใหม่</span><span class="num">\${fmt(m.minted)}</span></div>
      <div class="row"><span>ถูกเผาทิ้ง</span><span class="num">\${fmt(m.burned)}</span></div>
      <div class="row"><span>สุทธิ</span><span class="num \${m.net > 0 ? 'bad' : 'good'}">\${fmt(m.net)}</span></div>\`),

    card('ออรัมที่มีอยู่จริงในโลก', \`
      <div class="big">\${fmt(m.supply)}</div>
      <div class="row"><span>ในกระเป๋าตัวละคร</span><span class="num">\${fmt(m.held)}</span></div>
      <div class="row"><span>ในคลังฝาก</span><span class="num">\${fmt(m.banked)}</span></div>
      <div class="row"><span>ในคลังกิลด์</span><span class="num">\${fmt(m.guildPurses)}</span></div>
      <div class="row"><span>ค้างในตลาด</span><span class="num">\${fmt(m.listed)}</span></div>
      <div class="row"><span>เทรดกันไปแล้ว</span><span class="num">\${fmt(m.traded)}</span></div>\`),

    card('ท่อระบายไหนทำงานจริง', rows(m.burnBy, m.burned)),
    card('เงินเข้ามาจากไหน', rows(m.mintBy, m.minted)),
    card('ผู้เล่นอยู่โซนไหน', rows(d.zones)),
    card('ตัวละครตามช่วงเลเวล', rows(d.levels)),

    card('กิลด์', d.guilds.length ? '<table>' + d.guilds.map((g) =>
      \`<tr><td>\${g.name}\${g.inDebt ? ' <span class="bad">ค้างค่าบำรุง</span>' : ''}</td><td>\${g.members} คน · \${fmt(g.aurum)}</td></tr>\`).join('') + '</table>'
      : '<div class="muted">ยังไม่มีกิลด์</div>'),

    card('รวยที่สุด 10 อันดับ', d.richest.length ? '<table>' + d.richest.map((c) =>
      \`<tr><td>\${c.name} <span class="muted">Lv.\${c.level}\${c.guild ? ' · ' + c.guild : ''}</span></td><td>\${fmt(c.aurum)}</td></tr>\`).join('') + '</table>'
      : '<div class="muted">ยังไม่มีตัวละคร</div>'),

    card(\`ตลาดผู้เล่น (\${d.marketDepth} รายการ)\`, d.topListings.length ? '<table>' + d.topListings.map((l) =>
      \`<tr><td>\${l.item} x\${l.qty}</td><td>\${fmt(l.price)}</td></tr>\`).join('') + '</table>'
      : '<div class="muted">ตลาดว่าง</div>'),
  ].join('');
}
tick();
setInterval(tick, 5000);
</script></body></html>`;
