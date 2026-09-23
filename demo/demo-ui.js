// Demo-only conveniences: one-click start, zone jumps, and a reset.
// None of this exists in the real client - it is here so the page can be
// tried in a minute instead of an evening.
import { wipe } from './shim-persistence.js';
import { MAPS } from '../shared/data/maps.js';

const until = (test, ms = 8000) => new Promise((res, rej) => {
  const t0 = Date.now();
  const tick = () => {
    if (test()) return res(true);
    if (Date.now() - t0 > ms) return rej(new Error('timeout'));
    setTimeout(tick, 60);
  };
  tick();
});

const ACC_KEY = 'emberfall-demo-account';

async function quickStart(button) {
  const g = window.__game;
  button.disabled = true;
  button.textContent = 'กำลังสร้างโลก…';
  try {
    let account = null;
    try { account = localStorage.getItem(ACC_KEY); } catch { /* no storage */ }
    if (account) {
      g.net.send({ t: 'login', name: account, password: 'demo' });
      try { await until(() => g.account); } catch { account = null; }
    }
    if (!account) {
      account = 'demo' + Date.now().toString(36);
      g.net.send({ t: 'register', name: account, password: 'demo' });
      await until(() => g.account);
      try { localStorage.setItem(ACC_KEY, account); } catch { /* no storage */ }
    }
    if (!g.chars.length) {
      const looks = [
        { gender: 'male', body: 'light', hair: 'messy', hairColor: 'brown', eyes: 'brown' },
        { gender: 'female', body: 'tanned', hair: 'ponytail', hairColor: 'black', eyes: 'green' },
        { gender: 'male', body: 'dark', hair: 'plain', hairColor: 'black', eyes: 'brown' },
        { gender: 'female', body: 'darkelf', hair: 'long', hairColor: 'white', eyes: 'red' },
      ];
      g.net.send({
        t: 'charCreate',
        name: 'นักผจญภัย' + Math.floor(1000 + Math.random() * 8999),
        ...looks[Math.floor(Math.random() * looks.length)],
        style: 'chibi',
      });
      await until(() => g.chars.length);
    }
    g.net.send({ t: 'enter', id: g.chars[0].id });
    await until(() => g.inWorld);
    document.getElementById('demo-intro')?.remove();
  } catch (e) {
    button.disabled = false;
    button.textContent = 'ลองอีกครั้ง';
    console.error(e);
  }
}

function bar() {
  const el = document.createElement('div');
  el.id = 'demo-bar';
  el.innerHTML = `
    <button id="demo-toggle" type="button" title="แผงทดสอบ">🧪</button>
    <div id="demo-tools" hidden>
      <p>แผงนี้มีเฉพาะในเดโม — ใช้ข้ามการไต่เลเวลเพื่อดูเนื้อหาท้ายเกม</p>
      <div class="demo-row" id="demo-zones"></div>
      <div class="demo-row">
        <button type="button" data-boost="45">ปลุกพลัง Lv.45</button>
        <button type="button" data-boost="70">Lv.70 เต็มยศ</button>
        <button type="button" id="demo-reset">เริ่มใหม่ทั้งหมด</button>
      </div>
    </div>`;
  document.body.append(el);

  const tools = el.querySelector('#demo-tools');
  el.querySelector('#demo-toggle').addEventListener('click', () => { tools.hidden = !tools.hidden; });

  const zones = el.querySelector('#demo-zones');
  for (const m of Object.values(MAPS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = m.nameTh;
    b.addEventListener('click', () => window.__game?.net.send({ t: 'devWarp', map: m.id }));
    zones.append(b);
  }
  el.querySelector('#demo-reset').addEventListener('click', () => {
    if (!confirm('ลบตัวละครและเริ่มใหม่ทั้งหมด?')) return;
    wipe();
    try { localStorage.removeItem(ACC_KEY); } catch { /* ignore */ }
    location.reload();
  });
  for (const b of el.querySelectorAll('[data-boost]')) {
    b.addEventListener('click', () => window.__game?.net.send({
      t: 'devBoost', level: Number(b.dataset.boost), job: 'vanguard',
    }));
  }
}

export function startDemo() {
  const btn = document.getElementById('demo-play');
  btn?.addEventListener('click', () => quickStart(btn));
  bar();
}
