// The game master's panel. It only exists for an admin account: the server
// says so in the self state (`self.admin`) and refuses every `gm` command
// from anyone else, so hiding the button is a convenience, not the lock.
//
// Items: every item in the table, searchable by Thai or English name or id,
// filtered by kind and grade, given with a quantity and (for gear) a refine.
// Character: set the level, add aurum, heal. Warp: any map.
import { ITEMS, RARITY_COLORS } from '../../shared/data/items.js';
import { MAPS } from '../../shared/data/maps.js';
import { itemIcon } from './icons.js';

const KINDS = [
  ['all', 'ทั้งหมด'], ['weapon', 'อาวุธ'], ['armor', 'ชุด'], ['consumable', 'ของใช้'],
  ['material', 'วัตถุดิบ'], ['box', 'กล่อง'],
];
const GRADES = [['all', 'ทุกระดับ'], ['common', 'ธรรมดา'], ['uncommon', 'ดี'], ['rare', 'Rare'],
  ['epic', 'Epic'], ['legendary', 'Legendary'], ['mythic', 'Mythic']];
const PAGE = 120;

const kindOf = (it) => (it.box ? 'box' : it.type);

export class AdminPanel {
  constructor(game) {
    this.game = game;
    this.state = { tab: 'items', q: '', kind: 'all', grade: 'all', pick: null, qty: 1, refine: 0 };
    this.btn = null;
    this.win = null;
  }

  /** Called with every self update: shows the button to admins only. */
  sync(self) {
    const admin = !!self?.admin;
    if (admin && !this.btn) {
      this.btn = document.createElement('button');
      this.btn.id = 'gm-toggle';
      this.btn.type = 'button';
      this.btn.title = 'แผงผู้ดูแล';
      this.btn.textContent = '🛠';
      this.btn.addEventListener('click', () => (this.win ? this.close() : this.open()));
      document.body.append(this.btn);
    }
    if (!admin && this.btn) { this.btn.remove(); this.btn = null; this.close(); }
  }

  send(msg) { this.game.net.send({ t: 'gm', ...msg }); }

  close() { this.win?.remove(); this.win = null; }

  open() {
    this.close();
    const w = document.createElement('div');
    w.id = 'gm-panel';
    w.className = 'win';
    w.innerHTML = `
      <header><h2>แผงผู้ดูแล (Admin)</h2><button class="close" type="button" aria-label="ปิด">×</button></header>
      <nav class="gm-tabs">
        <button type="button" data-tab="items">เสกไอเทม</button>
        <button type="button" data-tab="char">ตัวละคร</button>
        <button type="button" data-tab="warp">วาร์ป</button>
      </nav>
      <div class="gm-body"></div>`;
    w.querySelector('.close').addEventListener('click', () => this.close());
    for (const b of w.querySelectorAll('[data-tab]')) {
      b.addEventListener('click', () => { this.state.tab = b.dataset.tab; this.render(); });
    }
    // keys typed here are for the panel, not for walking about
    w.addEventListener('keydown', (e) => e.stopPropagation());
    document.body.append(w);
    this.win = w;
    this.render();
  }

  render() {
    if (!this.win) return;
    for (const b of this.win.querySelectorAll('[data-tab]')) b.classList.toggle('sel', b.dataset.tab === this.state.tab);
    const body = this.win.querySelector('.gm-body');
    body.innerHTML = '';
    if (this.state.tab === 'items') this.renderItems(body);
    else if (this.state.tab === 'char') this.renderChar(body);
    else this.renderWarp(body);
  }

  matches() {
    const { q, kind, grade } = this.state;
    const needle = q.trim().toLowerCase();
    return Object.values(ITEMS).filter((it) => {
      if (kind !== 'all' && kindOf(it) !== kind) return false;
      if (grade !== 'all' && (it.rarity ?? 'common') !== grade) return false;
      if (!needle) return true;
      return [it.id, it.name, it.nameTh].some((s) => s && String(s).toLowerCase().includes(needle));
    }).sort((a, b) => (a.type ?? '').localeCompare(b.type ?? '') || (a.level ?? 1) - (b.level ?? 1) || a.id.localeCompare(b.id));
  }

  renderItems(body) {
    const s = this.state;
    body.innerHTML = `
      <div class="gm-filters">
        <input type="search" class="gm-q" placeholder="ค้นหาชื่อไอเทม / id" value="">
        <select class="gm-kind">${KINDS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
        <select class="gm-grade">${GRADES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
      </div>
      <div class="gm-count"></div>
      <div class="gm-grid"></div>
      <div class="gm-give">
        <div class="gm-pick">เลือกไอเทมจากด้านบน</div>
        <label>จำนวน <input type="number" class="gm-qty" min="1" max="9999" value="${s.qty}"></label>
        <label class="gm-ref-wrap">ตีบวก <select class="gm-ref">${Array.from({ length: 16 }, (_, i) => `<option value="${i}">+${i}</option>`).join('')}</select></label>
        <button type="button" class="btn primary gm-go" disabled>เสกเลย</button>
      </div>`;
    const q = body.querySelector('.gm-q');
    q.value = s.q;
    body.querySelector('.gm-kind').value = s.kind;
    body.querySelector('.gm-grade').value = s.grade;
    body.querySelector('.gm-ref').value = String(s.refine);
    const grid = body.querySelector('.gm-grid');
    const fill = () => {
      const list = this.matches();
      body.querySelector('.gm-count').textContent = `${list.length} ชิ้น${list.length > PAGE ? ` (แสดง ${PAGE} แรก — ค้นหาให้แคบลง)` : ''}`;
      grid.innerHTML = '';
      for (const it of list.slice(0, PAGE)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'gm-item' + (s.pick === it.id ? ' sel' : '');
        b.title = `${it.nameTh ?? it.name} · ${it.id}${it.level ? ` · Lv.${it.level}` : ''}`;
        b.style.borderColor = RARITY_COLORS[it.rarity] ?? '';
        b.append(itemIcon(it.id, { size: 36 }));
        const n = document.createElement('span');
        n.textContent = it.nameTh ?? it.name;
        b.append(n);
        b.addEventListener('click', () => { s.pick = it.id; fill(); pickShown(); });
        grid.append(b);
      }
    };
    const pickShown = () => {
      const it = ITEMS[s.pick];
      const go = body.querySelector('.gm-go');
      const pick = body.querySelector('.gm-pick');
      go.disabled = !it;
      if (!it) return;
      pick.innerHTML = '';
      pick.append(itemIcon(it.id, { size: 28 }));
      const t = document.createElement('span');
      t.textContent = `${it.nameTh ?? it.name}${it.level ? ` Lv.${it.level}` : ''}`;
      t.style.color = RARITY_COLORS[it.rarity] ?? '';
      pick.append(t);
      body.querySelector('.gm-ref-wrap').hidden = !it.refinable;
    };
    q.addEventListener('input', () => { s.q = q.value; fill(); });
    body.querySelector('.gm-kind').addEventListener('change', (e) => { s.kind = e.target.value; fill(); });
    body.querySelector('.gm-grade').addEventListener('change', (e) => { s.grade = e.target.value; fill(); });
    body.querySelector('.gm-qty').addEventListener('input', (e) => { s.qty = Math.max(1, e.target.value | 0); });
    body.querySelector('.gm-ref').addEventListener('change', (e) => { s.refine = e.target.value | 0; });
    body.querySelector('.gm-go').addEventListener('click', () => {
      if (!s.pick) return;
      this.send({ op: 'give', id: s.pick, qty: s.qty, refine: ITEMS[s.pick]?.refinable ? s.refine : 0 });
    });
    fill();
    pickShown();
  }

  renderChar(body) {
    const self = this.game.self ?? {};
    body.innerHTML = `
      <div class="gm-rows">
        <label>เลเวล <input type="number" class="gm-lv" min="1" max="99" value="${self.level ?? 1}"></label>
        <button type="button" class="btn gm-set-lv">ตั้งเลเวล</button>
      </div>
      <div class="gm-rows">
        <label>ออรัม <input type="number" class="gm-au" step="1000" value="1000000"></label>
        <button type="button" class="btn gm-add-au">เพิ่ม/ลด</button>
      </div>
      <div class="gm-rows"><button type="button" class="btn gm-heal">ฟื้น HP/SP เต็ม</button></div>
      <p class="muted">ปิดโหมดผู้ดูแล: พิมพ์ <b>/admin off</b> ในแชท</p>`;
    body.querySelector('.gm-set-lv').addEventListener('click', () => this.send({ op: 'level', level: body.querySelector('.gm-lv').value | 0 }));
    body.querySelector('.gm-add-au').addEventListener('click', () => this.send({ op: 'aurum', amount: Number(body.querySelector('.gm-au').value) || 0 }));
    body.querySelector('.gm-heal').addEventListener('click', () => this.send({ op: 'heal' }));
  }

  renderWarp(body) {
    const wrap = document.createElement('div');
    wrap.className = 'gm-warps';
    for (const m of Object.values(MAPS)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.textContent = m.nameTh ?? m.name ?? m.id;
      b.addEventListener('click', () => this.send({ op: 'warp', map: m.id }));
      wrap.append(b);
    }
    body.append(wrap);
  }
}
