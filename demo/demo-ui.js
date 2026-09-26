// Demo-only convenience: one-click start. The zone jumps and power-ups that
// used to live here are the admin panel now (client/js/admin.js), for admin
// accounts only.

const until = (test, ms = 8000) => new Promise((res, rej) => {
  const t0 = Date.now();
  const tick = () => {
    if (test()) return res(true);
    if (Date.now() - t0 > ms) return rej(new Error('timeout'));
    setTimeout(tick, 60);
  };
  tick();
});

const ACC_KEY = 'afo-demo-account';

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

export function startDemo() {
  const btn = document.getElementById('demo-play');
  btn?.addEventListener('click', () => quickStart(btn));
}
