// All DOM: HUD, chat, panels. The game loop only calls into this module.
import { ITEMS, RECIPES, RARITY_COLORS } from '../../shared/data/items.js';
import { SKILLS, val, skillCost } from '../../shared/data/skills.js';
import { JOBS } from '../../shared/data/jobs.js';
import { QUESTS } from '../../shared/data/quests.js';
import { WARP_ROUTES } from '../../shared/data/npcs.js';
import { TILES } from '../../shared/data/maps.js';
import { TILE } from '../../shared/constants.js';
import { refineChance, refineCost, npcSellPrice } from '../../shared/formulas.js';
import { itemIcon, skillIcon, icon } from './icons.js';
import { playerLayers, drawCharacter, loadedRatio } from './sprites.js';
import { SLOTS } from '../../shared/constants.js';

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};
const fmt = (n) => Number(n ?? 0).toLocaleString('en-US');
const itemName = (id) => ITEMS[id]?.nameTh ?? ITEMS[id]?.name ?? id;

export class UI {
  constructor(game) {
    this.game = game;
    this.panels = $('#panels');
    this.openPanels = new Map();
    this.selectedInv = null;
    this.lastShop = null;

    $('#chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#chat-input');
      const text = input.value.trim();
      if (text) game.net.send({ t: 'chat', ch: $('#chat-ch').value, text });
      input.value = '';
      input.blur();
      game.input.textMode = false;
    });
    $('#chat-input').addEventListener('focus', () => { game.input.textMode = true; });
    $('#chat-input').addEventListener('blur', () => { game.input.textMode = false; });

    for (const tab of document.querySelectorAll('#chat-tabs .tab')) {
      tab.addEventListener('click', () => {
        this.chatFilter = tab.dataset.ch;
        for (const t of document.querySelectorAll('#chat-tabs .tab')) t.classList.toggle('on', t === tab);
        for (const line of document.querySelectorAll('#chat-log div')) {
          line.hidden = this.chatFilter !== 'all' && line.dataset.ch !== this.chatFilter;
        }
      });
    }
    $('#quest-toggle')?.addEventListener('click', () => $('#quest-track').classList.toggle('collapsed'));

    for (const b of document.querySelectorAll('#menu-buttons button')) {
      b.addEventListener('click', () => this.toggle(b.dataset.panel));
    }
    addEventListener('keydown', (e) => {
      if (game.input.textMode) return;
      const map = { KeyC: 'character', KeyI: 'inventory', KeyK: 'skills', KeyJ: 'quests', KeyP: 'party', F1: 'settings' };
      if (map[e.code]) { e.preventDefault(); this.toggle(map[e.code]); }
      if (e.code === 'Enter') { e.preventDefault(); $('#chat-input').focus(); }
      // Escape closes here, synchronously: leaving it to the game loop meant a
      // panel opened in the same breath got closed a frame later.
      if (e.code === 'Escape' && this.openPanels.size) {
        this.closeTop();
        this.escHandledAt = performance.now();
      }
    });
  }

  /* ---------------- toasts + chat ---------------- */
  /** Outcomes worth reading. Deduped, capped, and never more than a few. */
  toast(text, kind = 'info') {
    const box = $('#toasts');
    const last = box.lastElementChild;
    if (last && last.dataset.text === text && Date.now() - Number(last.dataset.at) < 2500) {
      const n = Number(last.dataset.n ?? 1) + 1;
      last.dataset.n = n;
      last.dataset.at = Date.now();
      last.textContent = `${text} x${n}`;
      return;
    }
    const n = el('div', 'toast ' + kind, text);
    n.dataset.text = text;
    n.dataset.at = Date.now();
    box.append(n);
    while (box.childElementCount > 3) box.firstChild.remove();
    setTimeout(() => n.remove(), 3200);
  }

  /** Refusals ("still on cooldown", "out of range"). One line, no stacking. */
  flash(text) {
    let n = $('#flash');
    if (!n) {
      n = el('div', '', '');
      n.id = 'flash';
      document.body.append(n);
    }
    n.textContent = text;
    n.classList.remove('show');
    void n.offsetWidth;          // restart the animation
    n.classList.add('show');
    clearTimeout(this._flashT);
    this._flashT = setTimeout(() => n.classList.remove('show'), 1400);
  }

  chat(m) {
    const log = $('#chat-log');
    const prefix = { say: '', party: '[ปาร์ตี้] ', trade: '[ซื้อขาย] ', world: '[โลก] ', system: '' }[m.ch] ?? '';
    const line = el('div', m.ch, `${prefix}${m.from ? `<b>${esc(m.from)}</b>: ` : ''}${esc(m.text)}`);
    line.dataset.ch = m.ch;
    if (this.chatFilter && this.chatFilter !== 'all' && this.chatFilter !== m.ch) line.hidden = true;
    log.append(line);
    while (log.childElementCount > 120) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  }

  /** Big fading title when you enter a zone, with its level bracket. */
  zoneBanner(zone) {
    let n = $('#zone-banner');
    if (!n) {
      n = el('div', '', '');
      n.id = 'zone-banner';
      document.body.append(n);
    }
    const range = zone.levelRange ? `<span>เลเวลแนะนำ ${zone.levelRange[0]}–${zone.levelRange[1]}</span>`
      : zone.safe ? '<span>เขตปลอดภัย</span>' : '';
    n.innerHTML = `<b>${esc(zone.nameTh ?? zone.name)}</b>${range}`;
    n.classList.remove('show');
    void n.offsetWidth;
    n.classList.add('show');
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => n.classList.remove('show'), 2600);
  }

  /* ---------------- HUD ---------------- */
  updateVitals(self, you) {
    const hp = you?.hp ?? self.hp, sp = you?.sp ?? self.sp;
    const maxHp = you?.maxHp ?? self.maxHp, maxSp = you?.maxSp ?? self.maxSp;
    const level = you?.level ?? self.level, jobLevel = you?.jobLevel ?? self.jobLevel;
    const d = self.derived ?? {};

    $('#me-name').textContent = self.name;
    $('#me-job').textContent = JOBS[self.job]?.nameTh ?? self.job;
    $('#me-level').textContent = level;
    setBar('#bar-hp', '#txt-hp', hp, maxHp);
    setBar('#bar-sp', '#txt-sp', sp, maxSp);

    // one number for "how strong am I", the way mobile MMOs summarise a build
    const cp = Math.round((d.atk ?? 0) + (d.matk ?? 0) * 0.8 + (d.def ?? 0) * 2.2
      + (d.mdef ?? 0) * 1.6 + (d.maxHp ?? 0) / 12 + (d.hit ?? 0) * 0.4 + (d.flee ?? 0) * 0.4);
    $('#me-cp').textContent = fmt(cp);
    $('#me-stats').textContent = `ATK ${fmt(d.atk ?? 0)} · DEF ${fmt(d.def ?? 0)}`;

    setBar('#bar-exp', '#txt-exp', you?.exp ?? self.exp, self.expNext, 'pct');
    setBar('#bar-jexp', '#txt-jexp', you?.jobExp ?? self.jobExp, self.jobExpNext, 'pct');
    $('#base-lv').textContent = `Base Lv.${level}`;
    $('#job-lv').textContent = `Job Lv.${jobLevel}`;

    $('#aurum').textContent = fmt(you?.aurum ?? self.aurum);
    const shards = (this.game.inventory?.items ?? []).find((x) => x.id === 'shard_dawn');
    $('#shards').textContent = fmt(shards?.qty ?? 0);

    const over = (you?.weight ?? 0) > (you?.weightCap ?? 1);
    $('#netinfo').innerHTML = `${this.game.net.ping}ms · <span style="color:${over ? 'var(--bad)' : 'inherit'}">${fmt(you?.weight ?? 0)}/${fmt(you?.weightCap ?? 0)}</span>`;
  }

  /** The quest tracker pinned to the left edge. */
  renderQuestTrack(list) {
    this.trackedQuests = list ?? [];
    const box = $('#quest-track');
    const out = $('#quest-list');
    if (!box || !out) return;
    if (!this.trackedQuests.length) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    out.innerHTML = '';
    for (const q of this.trackedQuests) {
      const row = el('div', 'qrow' + (q.done ? ' done' : ''));
      const name = el('div', 'qname');
      name.append(el('span', 'qtag ' + q.kind, { main: 'หลัก', sub: 'ย่อย', event: 'พิเศษ' }[q.kind] ?? 'ย่อย'));
      name.append(el('span', '', esc(q.name)));
      row.append(name);
      row.append(el('div', 'qprog', q.progress
        .map((pr) => `<b>${pr.have}</b>/${pr.need}`).join(' · ') + (q.done ? ' — พร้อมส่ง' : '')));
      row.addEventListener('click', () => this.toggle('quests'));
      out.append(row);
    }
  }

  /** Consumables parked next to the action bar. */
  renderQuickItems() {
    const box = $('#quick-items');
    if (!box) return;
    const items = (this.game.inventory?.items ?? []).filter((it) => it.type === 'consumable').slice(0, 4);
    box.innerHTML = '';
    for (const it of items) {
      const slot = el('div', 'slot');
      slot.append(itemIcon(it.id, { size: 28 }));
      slot.append(el('span', 'qty num', String(it.qty)));
      slot.title = it.name;
      slot.addEventListener('click', () => this.game.net.send({ t: 'useItem', index: it.i }));
      box.append(slot);
    }
    for (let i = items.length; i < 2; i++) box.append(el('div', 'slot empty'));
  }

  updateTarget(ent) {
    const f = $('#target-frame');
    if (!ent) { f.classList.add('hidden'); return; }
    f.classList.remove('hidden');
    $('#tg-name').textContent = ent.n;
    $('#tg-lv').textContent = ent.lv ? `Lv.${ent.lv}` : '';
    $('#tg-hp').style.width = Math.max(0, (ent.hp / ent.mhp) * 100) + '%';
    $('#tg-el').textContent = ent.k === 'm' ? `${fmt(ent.hp)} / ${fmt(ent.mhp)}` : '';
  }

  updateStatuses(list) {
    const box = $('#statuses');
    box.innerHTML = '';
    for (const s of list ?? []) {
      if (!s.icon) continue;
      box.append(el('div', s.beneficial ? 'good' : 'bad', s.icon));
    }
  }

  updateCast(cast) {
    const bar = $('#cast-bar');
    if (!cast) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    const total = cast.until - (cast.started ?? cast.until - 1000);
    const left = cast.until - Date.now();
    const pct = Math.max(0, Math.min(1, 1 - left / Math.max(1, total)));
    bar.querySelector('i').style.width = pct * 100 + '%';
    bar.querySelector('span').textContent = SKILLS[cast.skill]?.nameTh ?? cast.skill;
  }

  renderHotbar(self) {
    const bar = $('#hotbar');
    bar.innerHTML = '';
    (self.hotbar ?? []).forEach((skillId, i) => {
      const sk = SKILLS[skillId];
      const slot = el('div', 'slot' + (sk ? '' : ' empty'));
      slot.append(el('span', 'key', String(i + 1)));
      if (sk) {
        slot.append(skillIcon(skillId, { size: 34 }));
        slot.title = `${sk.nameTh} Lv.${self.skills[skillId] ?? 0}`;
      }
      slot.dataset.index = i;
      slot.addEventListener('click', () => this.game.useHotbar(i));
      bar.append(slot);
    });
    this.hotbarSlots = [...bar.children];
  }

  tickHotbar(cooldowns) {
    if (!this.hotbarSlots) return;
    const self = this.game.self;
    const now = Date.now();
    this.hotbarSlots.forEach((slot, i) => {
      const id = self?.hotbar?.[i];
      slot.querySelector('.cd')?.remove();
      if (!id) return;
      const until = cooldowns?.[id] ?? 0;
      if (until > now) {
        const left = (until - now) / 1000;
        const total = Math.max(left, this._cdTotal?.[id] ?? left);
        (this._cdTotal ??= {})[id] = until > (this._cdUntil?.[id] ?? 0) ? left : total;
        (this._cdUntil ??= {})[id] = until;
        const cd = el('div', 'cd', Math.ceil(left));
        cd.style.setProperty('--cd', `${Math.min(100, (left / Math.max(0.1, total)) * 100)}%`);
        slot.append(cd);
      }
    });
  }

  minimap(state, renderer) {   /* canvas is sized by the markup */
    const c = $('#minimap');
    if (!renderer.grid || !state.me) return;
    const g = c.getContext('2d');
    const z = renderer.zone;
    const sx = c.width / z.width, sy = c.height / z.height;
    if (!this._miniCache || this._miniZone !== z.id) {
      const off = document.createElement('canvas');
      off.width = z.width; off.height = z.height;
      const og = off.getContext('2d');
      const img = og.createImageData(z.width, z.height);
      const colors = {
        [TILES.WATER]: [40, 72, 108], [TILES.TREE]: [32, 58, 34], [TILES.ROCK]: [80, 80, 92],
        [TILES.WALL]: [28, 28, 36], [TILES.PATH]: [120, 104, 76], [TILES.FLOOR]: [70, 66, 78],
        [TILES.SNOW]: [190, 202, 216], [TILES.SAND]: [150, 136, 96], [TILES.LAVA]: [150, 60, 20],
      };
      for (let i = 0; i < z.width * z.height; i++) {
        const t = renderer.grid[i];
        const [r, gg, b] = colors[t] ?? [60, 96, 56];
        img.data.set([r, gg, b, 235], i * 4);
      }
      og.putImageData(img, 0, 0);
      this._miniCache = off;
      this._miniZone = z.id;
    }
    g.clearRect(0, 0, c.width, c.height);
    g.imageSmoothingEnabled = false;
    g.drawImage(this._miniCache, 0, 0, c.width, c.height);
    for (const e of state.ents ?? []) {
      if (e.k === 'n') g.fillStyle = '#7dffb0';
      else if (e.k === 'm') g.fillStyle = e.boss ? '#ffb45e' : '#ff7a7a';
      else g.fillStyle = e.id === state.myId ? '#ffffff' : '#7fb2ff';
      g.fillRect((e.x / TILE) * sx - 1, (e.y / TILE) * sy - 1, 3, 3);
    }
  }

  /* ---------------- panel plumbing ---------------- */
  toggle(name, data) {
    if (this.openPanels.has(name)) this.close(name);
    else this.open(name, data);
  }

  close(name) {
    this.openPanels.get(name)?.remove();
    this.openPanels.delete(name);
  }

  closeTop() {
    const last = [...this.openPanels.keys()].pop();
    if (last) this.close(last);
  }

  panel(name, title, bodyNode) {
    this.close(name);
    const p = el('div', 'win window');
    for (const c of ['tl', 'tr', 'bl', 'br']) p.append(el('span', 'corner ' + c));
    const head = el('header');
    head.append(el('h2', '', title));
    const x = el('button', 'close', '✕');
    x.setAttribute('aria-label', 'ปิด');
    x.addEventListener('click', () => this.close(name));
    head.append(x);
    const body = el('div', 'body');
    body.append(bodyNode);
    p.append(head, body);
    this.panels.append(p);
    this.openPanels.set(name, p);
    return p;
  }

  open(name, data) {
    const self = this.game.self;
    if (!self && name !== 'settings') return;
    switch (name) {
      case 'character': return this.openCharacter(self);
      case 'inventory': return this.openInventory();
      case 'skills': return this.openSkills(self);
      case 'quests':
        this.wantQuests = true;
        this.game.net.send({ t: 'quest', cmd: 'list' });
        return this.openQuests(this.lastQuests ?? []);
      case 'party':
        this.game.net.send({ t: 'party', cmd: 'state' });
        return this.openParty(this.lastParty);
      case 'settings': return this.openSettings();
      case 'shop': return this.openShop(data);
      case 'market': return this.openMarket(data);
      case 'storage': return this.openStorage(data);
      case 'dialog': return this.openDialog(data);
      default: return null;
    }
  }

  /* ---------------- character ---------------- */
  openCharacter(self) {
    const wrap = el('div');
    const d = self.derived;

    /* --- equipment doll: the character between two columns of slots --- */
    const gear = el('div', 'doll');
    const left = el('div', 'doll-col');
    const right = el('div', 'doll-col');
    const mid = el('div', 'doll-mid');

    const preview = document.createElement('canvas');
    preview.width = 96; preview.height = 116;
    preview.className = 'doll-view';
    mid.append(preview);
    const cp = el('div', 'doll-cp');
    cp.innerHTML = `<span class="label">CP</span> <b class="num">${fmt(Math.round(
      (d.atk ?? 0) + (d.matk ?? 0) * 0.8 + (d.def ?? 0) * 2.2 + (d.mdef ?? 0) * 1.6
      + (d.maxHp ?? 0) / 12 + (d.hit ?? 0) * 0.4 + (d.flee ?? 0) * 0.4))}</b>`;
    mid.append(cp);

    const worn = Object.fromEntries(Object.entries(self.equipment ?? {})
      .map(([slot, idx]) => [slot, this.game.inventory?.items?.find((x) => x.i === idx)])
      .filter(([, it]) => it));

    const LABELS = {
      head: 'ศีรษะ', torso: 'ลำตัว', hands: 'มือ', legs: 'ขา', feet: 'เท้า',
      weapon: 'อาวุธ', offhand: 'มือรอง', belt: 'เข็มขัด', accessory: 'เครื่องประดับ',
    };
    const slotNode = (slot) => {
      const it = worn[slot];
      const node = el('div', 'slot doll-slot' + (it ? ` rarity-${it.rarity ?? 'common'}` : ' empty'));
      node.title = it ? `${it.name}${it.refine ? ` +${it.refine}` : ''} — คลิกเพื่อถอด` : LABELS[slot];
      if (it) {
        node.append(itemIcon(it.id, { size: 30 }));
        if (it.refine) node.append(el('span', 'plus', '+' + it.refine));
        node.addEventListener('click', () => this.game.net.send({ t: 'unequip', slot }));
      } else {
        node.append(el('span', 'doll-label', LABELS[slot]));
      }
      return node;
    };
    for (const slot of ['head', 'torso', 'hands', 'belt']) left.append(slotNode(slot));
    for (const slot of ['weapon', 'offhand', 'legs', 'feet']) right.append(slotNode(slot));
    mid.append(slotNode('accessory'));
    gear.append(left, mid, right);

    const ctx = preview.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const layers = playerLayers(self.look, Object.fromEntries(
      Object.entries(worn).map(([slot, it]) => [slot, it.id])
    ));
    // the canvas is not in the document yet when this runs, so keep painting
    // until the sheets are decoded rather than bailing on the first frame
    let tries = 0;
    const paint = () => {
      if (tries++ > 40) return;
      ctx.clearRect(0, 0, 96, 116);
      ctx.save();
      ctx.scale(1.55, 1.55);
      drawCharacter(ctx, layers, { x: 31, y: 70, anim: 'idle', dir: 2, elapsed: 0 });
      ctx.restore();
      if (loadedRatio() < 1 || tries < 3) setTimeout(paint, 200);
    };
    paint();

    /* --- stats --- */
    const stats = el('div', 'grid cols-2');
    const statsLeft = el('div');
    statsLeft.innerHTML = `<h3 style="margin:0 0 6px">สเตตัสหลัก <small class="muted">แต้มเหลือ ${self.statPoints}</small></h3>`;
    for (const k of ['str', 'agi', 'vit', 'int', 'dex', 'luk']) {
      const row = el('div', 'row');
      row.innerHTML = `<span><b>${k.toUpperCase()}</b> <span class="num">${self.base[k]}</span></span>`;
      const b = el('button', 'btn', `+ (${self.statCosts[k]})`);
      b.disabled = self.statPoints < self.statCosts[k];
      b.addEventListener('click', () => this.game.net.send({ t: 'allocStat', stat: k }));
      row.append(b);
      statsLeft.append(row);
    }
    const statsRight = el('div');
    statsRight.innerHTML = `
      <h3 style="margin:0 0 6px">ค่าที่ได้จริง</h3>
      ${statRow('ATK', d.atk)}${statRow('MATK', d.matk)}
      ${statRow('DEF', `${d.def} (+${d.softDef})`)}${statRow('MDEF', `${d.mdef} (+${d.softMdef})`)}
      ${statRow('HIT', d.hit)}${statRow('FLEE', d.flee)}
      ${statRow('CRIT', d.crit + '%')}${statRow('ความเร็วโจมตี', (1 / d.aspdFactor).toFixed(2) + 'x')}
      ${statRow('ความเร็วเดิน', Math.round(d.moveSpeed))}
      ${statRow('ลดเวลาร่าย', Math.round((1 - d.castFactor) * 100) + '%')}
      ${statRow('น้ำหนักสูงสุด', fmt(self.weightCap ?? d.weight))}`;
    stats.append(statsLeft, statsRight);

    const job = JOBS[self.job];
    const info = el('div');
    info.innerHTML = `<div class="row"><span>อาชีพ</span><b>${job?.nameTh} (${job?.name})</b></div>
      <div class="muted" style="padding:4px 0">${job?.desc ?? ''}</div>
      <div class="row"><span>อาวุธที่ใช้ได้</span><b>${(job?.weapons ?? []).join(', ')}</b></div>`;
    if (job?.next?.length) {
      info.append(el('div', 'muted', `สายต่อไป: ${job.next.map((j) => JOBS[j].nameTh).join(' / ')} (คุยกับครูฝึกเมื่อ Job Lv. ${job.jobLevelToAdvance})`));
    }

    wrap.append(gear, info, stats);
    return this.panel('character', 'ตัวละคร', wrap);
  }

  /* ---------------- inventory ---------------- */
  openInventory() {
    const wrap = el('div');
    wrap.id = 'inv-body';
    this.panel('inventory', 'กระเป๋า', wrap);
    this.renderInventory();
  }

  renderInventory() {
    this.renderQuickItems();
    const wrap = $('#inv-body');
    if (!wrap) return;
    const inv = this.game.inventory ?? { items: [] };
    wrap.innerHTML = '';

    const head = el('div', 'row');
    head.innerHTML = `<span>ออรัม <b style="color:var(--accent)" class="num">${fmt(inv.aurum)}</b></span>
      <span class="muted num">น้ำหนัก ${fmt(inv.weight)} / ${fmt(inv.weightCap)}</span>`;
    wrap.append(head);

    const filters = el('div', 'opts');
    for (const [key, label] of [['all', 'ทั้งหมด'], ['weapon', 'อาวุธ'], ['armor', 'เกราะ'],
      ['consumable', 'ของใช้'], ['material', 'วัตถุดิบ']]) {
      const b = el('button', 'btn' + ((this.invFilter ?? 'all') === key ? ' primary' : ''), label);
      b.addEventListener('click', () => { this.invFilter = key; this.renderInventory(); });
      filters.append(b);
    }
    wrap.append(filters);

    const filter = this.invFilter ?? 'all';
    const shown = inv.items.filter((it) => filter === 'all'
      || (filter === 'armor' ? it.type === 'armor' : it.type === filter)
      || (filter === 'material' && it.type === 'ammo'));

    const grid = el('div', 'slot-grid');
    for (const it of shown) {
      const broken = it.dur !== undefined && it.dur <= 0;
      const node = el('div', `slot rarity-${it.rarity ?? 'common'}`
        + (this.selectedInv === it.i ? ' sel' : '') + (broken ? ' broken' : ''));
      node.append(itemIcon(it.id, { size: 34 }));
      if (it.qty > 1) node.append(el('span', 'qty num', String(it.qty)));
      if (it.refine) node.append(el('span', 'plus', '+' + it.refine));
      if (it.equipped) node.append(el('span', 'worn'));
      node.title = it.name;
      node.addEventListener('click', () => { this.selectedInv = it.i; this.renderInventory(); });
      node.addEventListener('dblclick', () => this.useInvItem(it));
      grid.append(node);
    }
    for (let i = shown.length; i < Math.max(24, Math.ceil(shown.length / 8) * 8); i++) {
      grid.append(el('div', 'slot empty'));
    }
    wrap.append(grid);

    const sel = inv.items.find((x) => x.i === this.selectedInv);
    wrap.append(sel ? this.itemCard(sel) : el('div', 'muted', 'เลือกไอเทมเพื่อดูรายละเอียด'));
    return wrap;
  }

  /** Tooltip-style detail card for one inventory entry. */
  itemCard(it) {
    const box = el('div', 'win tip');
    box.style.padding = '10px';
    const title = el('div', 'tname rarity-' + (it.rarity ?? 'common'),
      esc(it.name) + (it.refine ? ` +${it.refine}` : ''));
    const head = el('div', 'row');
    head.style.borderTop = 'none';
    const ico = el('div', 'slot rarity-' + (it.rarity ?? 'common'));
    ico.append(itemIcon(it.id, { size: 34 }));
    const meta = el('div');
    meta.append(title);
    meta.append(el('div', 'muted', [
      { weapon: 'อาวุธ', armor: 'เกราะ', consumable: 'ของใช้', material: 'วัตถุดิบ', ammo: 'กระสุน' }[it.type] ?? '',
      it.wclass, it.level ? `ต้องเลเวล ${it.level}` : '',
    ].filter(Boolean).join(' · ')));
    head.append(ico, meta);
    head.style.justifyContent = 'flex-start';
    head.style.gap = '10px';
    box.append(head);

    const stat = (k, v) => {
      const r = el('div', 'stat');
      r.append(el('span', 'muted', k), el('span', 'num', String(v)));
      box.append(r);
    };
    if (it.atk) stat('พลังโจมตี', it.atk + (it.refine ? ` (+${it.refine * 2})` : ''));
    if (it.matk) stat('พลังเวทย์', it.matk);
    if (it.def) stat('ป้องกัน', it.def + (it.refine ? ` (+${it.refine})` : ''));
    if (it.mdef) stat('ต้านเวทย์', it.mdef);
    for (const [k, v] of Object.entries(it.stats ?? {})) stat(k.toUpperCase(), '+' + v);
    if (it.dur !== undefined) stat('ความคงทน', `${it.dur} / ${it.maxDur}`);
    if (it.weight) stat('น้ำหนัก', it.weight);
    if (it.value) stat('มูลค่าอ้างอิง', fmt(it.value) + ' AU');
    if (it.desc) box.append(el('div', 'flavour', esc(it.desc)));

    box.append(this.itemActions(it));
    return box;
  }

  /** Buttons under the detail card. */
  itemActions(it) {
    const box = el('div', 'opts');
    box.style.marginTop = '8px';
    const add = (label, fn, cls = 'btn') => {
      const b = el('button', cls, label);
      b.addEventListener('click', fn);
      box.append(b);
    };
    if (it.type === 'weapon' || it.type === 'armor') {
      if (it.equipped) add('ถอด', () => this.game.net.send({ t: 'unequip', slot: it.equipped }));
      else add('สวมใส่', () => this.game.net.send({ t: 'equip', index: it.i }), 'btn primary');
    }
    if (it.type === 'consumable') add('ใช้', () => this.game.net.send({ t: 'useItem', index: it.i }), 'btn primary');
    add('ทิ้ง', () => {
      if (confirm(`ทิ้ง ${it.name} ?`)) this.game.net.send({ t: 'dropItem', index: it.i, qty: it.qty });
    }, 'btn danger');
    return box;
  }

  useInvItem(it) {
    if (it.type === 'consumable') this.game.net.send({ t: 'useItem', index: it.i });
    else if (it.equipped) this.game.net.send({ t: 'unequip', slot: it.equipped });
    else if (it.type === 'weapon' || it.type === 'armor') this.game.net.send({ t: 'equip', index: it.i });
  }

  /* ---------------- skills ---------------- */
  openSkills(self) {
    const wrap = el('div');
    wrap.append(el('div', 'row', `<span>แต้มสกิลเหลือ <b>${self.skillPoints}</b></span><span class="muted">คลิกสกิลเพื่อใส่ในแถบลัด</span>`));
    for (const id of self.available ?? []) {
      const sk = SKILLS[id];
      if (!sk) continue;
      const lvl = self.skills[id] ?? 0;
      const row = el('div', 'row');
      const info = el('div');
      info.style.display = 'flex';
      info.style.gap = '10px';
      const ico = el('div', 'slot');
      ico.style.width = ico.style.height = '40px';
      ico.append(skillIcon(id, { size: 28 }));
      info.append(ico);
      const text = el('div');
      text.innerHTML = `<b>${sk.nameTh}</b> <span class="muted">${sk.name} · Lv.${lvl}/${sk.maxLevel ?? 5}</span>
        <div class="muted">${sk.desc ?? ''}</div>
        <div class="muted">${lvl ? skillNumbers(sk, lvl) : 'ยังไม่ได้เรียน'}</div>`;
      info.append(text);
      const btns = el('div', 'opts');
      const up = el('button', 'btn primary', '+1');
      up.disabled = self.skillPoints < 1 || lvl >= (sk.maxLevel ?? 5);
      up.addEventListener('click', () => this.game.net.send({ t: 'learnSkill', skill: id }));
      btns.append(up);
      if (lvl > 0 && sk.kind !== 'passive') {
        for (let i = 0; i < 6; i++) {
          const b = el('button', 'opt', String(i + 1));
          b.addEventListener('click', () => this.game.net.send({ t: 'setHotbar', index: i, skill: id }));
          btns.append(b);
        }
      }
      row.append(info, btns);
      wrap.append(row);
    }
    return this.panel('skills', 'สกิล', wrap);
  }

  /* ---------------- quests ---------------- */
  openQuests(quests) {
    this.lastQuests = quests;
    const wrap = el('div');
    if (!quests?.length) wrap.append(el('div', 'muted', 'ยังไม่มีภารกิจที่รับได้'));
    for (const q of quests ?? []) {
      const row = el('div', 'row');
      const done = q.progress.every((p) => p.have >= p.need);
      const info = el('div');
      info.innerHTML = `<b>${esc(q.name)}</b> <span class="muted">Lv.${q.minLevel ?? 1}+</span>
        <div class="muted">${esc(q.desc)}</div>
        <div class="muted">${q.progress.map((p, i) => `${p.have}/${p.need}`).join(' · ')}
        · รางวัล: ${fmt(q.rewards.aurum ?? 0)} AU, EXP ${fmt(q.rewards.exp)}</div>`;
      const btns = el('div', 'opts');
      if (!q.state || q.state.done) {
        const b = el('button', 'btn primary', 'รับภารกิจ');
        b.addEventListener('click', () => this.game.net.send({ t: 'quest', cmd: 'accept', id: q.id }));
        btns.append(b);
      } else {
        const b = el('button', 'btn' + (done ? ' primary' : ''), done ? 'ส่งภารกิจ' : 'กำลังทำ');
        b.disabled = !done;
        b.addEventListener('click', () => this.game.net.send({ t: 'quest', cmd: 'complete', id: q.id }));
        btns.append(b);
      }
      row.append(info, btns);
      wrap.append(row);
    }
    return this.panel('quests', 'ภารกิจ', wrap);
  }

  /* ---------------- party ---------------- */
  openParty(state) {
    this.lastParty = state;
    const wrap = el('div');
    const pt = state?.party;
    if (state?.invite) {
      const row = el('div', 'row');
      row.innerHTML = `<span>${esc(state.invite.from)} ชวนคุณเข้าปาร์ตี้</span>`;
      const b = el('button', 'btn primary', 'ตอบรับ');
      b.addEventListener('click', () => this.game.net.send({ t: 'party', cmd: 'accept' }));
      row.append(b);
      wrap.append(row);
    }
    if (pt) {
      wrap.append(el('div', 'row', `<b>${esc(pt.name)}</b><span class="muted">${pt.members.length}/6 คน</span>`));
      for (const m of pt.members) {
        wrap.append(el('div', 'row', `<span>${esc(m.name)} ${m.online ? `Lv.${m.level} ${JOBS[m.job]?.nameTh ?? ''}` : ''}</span>
          <span class="muted">${m.online ? `${m.hp}/${m.maxHp} HP · ${m.map}` : 'ออฟไลน์'}</span>`));
      }
      const leave = el('button', 'btn danger', 'ออกจากปาร์ตี้');
      leave.addEventListener('click', () => this.game.net.send({ t: 'party', cmd: 'leave' }));
      wrap.append(leave);
    } else {
      wrap.append(el('div', 'muted', 'ยังไม่ได้อยู่ปาร์ตี้ · ปาร์ตี้ได้ EXP รวม +10% ต่อสมาชิกหนึ่งคน (ต้องอยู่ในระยะ)'));
    }
    const form = el('div', 'row');
    const input = el('input');
    input.type = 'text';
    input.placeholder = 'ชื่อผู้เล่นที่จะชวน';
    input.addEventListener('focus', () => { this.game.input.textMode = true; });
    input.addEventListener('blur', () => { this.game.input.textMode = false; });
    const b = el('button', 'btn primary', 'ชวน');
    b.addEventListener('click', () => {
      if (input.value.trim()) this.game.net.send({ t: 'party', cmd: 'invite', name: input.value.trim() });
      input.value = '';
    });
    form.append(input, b);
    wrap.append(form);
    return this.panel('party', 'ปาร์ตี้', wrap);
  }

  /* ---------------- NPC ---------------- */
  openDialog(d) {
    const wrap = el('div');
    wrap.append(el('p', '', esc(d.greet)));
    const opts = el('div', 'opts');
    for (const o of d.options ?? []) {
      const b = el('button', 'btn primary', o.label);
      b.addEventListener('click', () => {
        this.close('dialog');
        if (o.action === 'jobChange') return this.openJobChange();
        this.game.net.send({ t: 'npcAction', action: o.action, shop: o.shop });
      });
      opts.append(b);
    }
    wrap.append(opts);
    return this.panel('dialog', d.name, wrap);
  }

  openJobChange() {
    const self = this.game.self;
    const job = JOBS[self.job];
    const wrap = el('div');
    wrap.append(el('div', 'muted', `Job Level ปัจจุบัน: ${self.jobLevel} / ต้องการ ${job.jobLevelToAdvance ?? 10}`));
    for (const nid of job.next ?? []) {
      const n = JOBS[nid];
      const row = el('div', 'row');
      row.innerHTML = `<div><b>${n.nameTh}</b> <span class="muted">${n.name}</span><div class="muted">${n.desc}</div></div>`;
      const b = el('button', 'btn primary', 'เลือกอาชีพนี้');
      b.disabled = self.jobLevel < (job.jobLevelToAdvance ?? 10);
      b.addEventListener('click', () => {
        this.game.net.send({ t: 'npcAction', action: 'jobChange', job: nid });
        this.close('jobchange');
      });
      row.append(b);
      wrap.append(row);
    }
    return this.panel('jobchange', 'เปลี่ยนอาชีพ', wrap);
  }

  /** Small reusable picker: a grid of item slots plus a detail pane. */
  itemPicker({ items, onSelect, key = 'picker', empty = 'ไม่มีไอเทม' }) {
    const box = el('div', 'grid');
    const grid = el('div', 'slot-grid');
    const detail = el('div');
    if (!items.length) box.append(el('div', 'muted', empty));
    for (const entry of items) {
      const it = entry.item;
      const node = el('div', `slot rarity-${it.rarity ?? 'common'}`
        + (this.pick?.[key] === entry.id ? ' sel' : ''));
      node.append(itemIcon(it.id, { size: 32 }));
      if (entry.qty > 1) node.append(el('span', 'qty num', String(entry.qty)));
      if (entry.refine) node.append(el('span', 'plus', '+' + entry.refine));
      node.title = it.nameTh ?? it.name;
      node.addEventListener('click', () => {
        this.pick ??= {};
        this.pick[key] = entry.id;
        detail.innerHTML = '';
        detail.append(onSelect(entry));
        for (const sib of grid.children) sib.classList.remove('sel');
        node.classList.add('sel');
      });
      grid.append(node);
    }
    box.append(grid, detail);
    if (items.length) {
      const first = items.find((e) => e.id === this.pick?.[key]) ?? items[0];
      detail.append(onSelect(first));
      grid.children[items.indexOf(first)]?.classList.add('sel');
    }
    return box;
  }

  /** A titled detail card used by every shop-ish window. */
  detailCard(it, rows, actions, extra) {
    const card = el('div', 'win tip');
    card.style.padding = '10px';
    const head = el('div');
    head.style.cssText = 'display:flex;gap:10px;align-items:center';
    const ico = el('div', 'slot rarity-' + (it.rarity ?? 'common'));
    ico.append(itemIcon(it.id, { size: 32 }));
    const meta = el('div');
    meta.append(el('div', 'tname rarity-' + (it.rarity ?? 'common'), esc(it.nameTh ?? it.name)));
    if (it.desc) meta.append(el('div', 'muted', esc(it.desc)));
    head.append(ico, meta);
    card.append(head);
    for (const [k, v] of rows) {
      const r = el('div', 'stat');
      r.append(el('span', 'muted', k), el('span', 'num', String(v)));
      card.append(r);
    }
    if (extra) card.append(extra);
    if (actions) card.append(actions);
    return card;
  }

  openShop(d) {
    if (d.mode === 'refine') return this.openRefine();
    if (d.mode === 'repair') return this.openRepair();
    if (d.mode === 'craft') return this.openCraft();
    if (d.mode === 'warp') return this.openWarp(d);
    if (d.mode === 'sell') return this.openSell();
    this.lastShop = d;

    const wrap = el('div', 'grid');
    const tabs = el('div', 'opts');
    const buyTab = el('button', 'btn primary', 'ซื้อ');
    const sellTab = el('button', 'btn', 'ขาย');
    tabs.append(buyTab, sellTab);
    const body = el('div');
    wrap.append(tabs, body);

    const renderBuy = () => {
      body.innerHTML = '';
      body.append(this.itemPicker({
        key: 'shop',
        items: d.stock.map((s) => ({ id: s.id, item: ITEMS[s.id] ?? { id: s.id, nameTh: s.name }, qty: 1, stock: s.stock, price: s.price })),
        onSelect: (entry) => {
          const qty = el('input');
          qty.type = 'number'; qty.min = 1; qty.max = 999; qty.value = 1;
          qty.style.width = '80px';
          qty.addEventListener('focus', () => { this.game.input.textMode = true; });
          qty.addEventListener('blur', () => { this.game.input.textMode = false; });
          const actions = el('div', 'opts');
          actions.style.marginTop = '8px';
          const buy = el('button', 'btn primary', 'ซื้อ');
          buy.addEventListener('click', () => this.game.net.send({
            t: 'shopBuy', shop: d.id, id: entry.id, qty: Number(qty.value) || 1,
          }));
          actions.append(qty, buy);
          return this.detailCard(entry.item, [
            ['ราคา', fmt(entry.price) + ' AU'],
            ['คงเหลือ', fmt(entry.stock)],
            ...(entry.item.atk ? [['ATK', entry.item.atk]] : []),
            ...(entry.item.def ? [['DEF', entry.item.def]] : []),
            ...(entry.item.heal ? [['ฟื้น HP', entry.item.heal]] : []),
            ...(entry.item.level ? [['ต้องเลเวล', entry.item.level]] : []),
          ], actions);
        },
      }));
    };

    const renderSell = () => {
      body.innerHTML = '';
      body.append(el('div', 'muted', 'NPC รับซื้อราว 28% ของมูลค่าอ้างอิง และราคาจะตกถ้าขายของชิ้นเดิมซ้ำๆ ในวันเดียว'));
      body.append(this.sellPicker());
    };

    buyTab.addEventListener('click', () => { buyTab.className = 'btn primary'; sellTab.className = 'btn'; renderBuy(); });
    sellTab.addEventListener('click', () => { sellTab.className = 'btn primary'; buyTab.className = 'btn'; renderSell(); });
    renderBuy();
    return this.panel('shop', d.name ?? 'ร้านค้า', wrap);
  }

  sellPicker() {
    const items = (this.game.inventory?.items ?? []).filter((it) => !it.equipped);
    return this.itemPicker({
      key: 'sell',
      items: items.map((it) => ({ id: it.i, item: it, qty: it.qty, refine: it.refine })),
      empty: 'ไม่มีของให้ขาย',
      onSelect: (entry) => {
        const it = entry.item;
        const unit = npcSellPrice(it.value ?? 0, 0);
        const qty = el('input');
        qty.type = 'number'; qty.min = 1; qty.max = it.qty; qty.value = it.qty;
        qty.style.width = '80px';
        qty.addEventListener('focus', () => { this.game.input.textMode = true; });
        qty.addEventListener('blur', () => { this.game.input.textMode = false; });
        const actions = el('div', 'opts');
        actions.style.marginTop = '8px';
        const sell = el('button', 'btn primary', 'ขาย');
        sell.addEventListener('click', () => this.game.net.send({
          t: 'shopSell', index: it.i, qty: Number(qty.value) || 1,
        }));
        actions.append(qty, sell);
        return this.detailCard(it, [
          ['ได้รับต่อชิ้น', fmt(unit) + ' AU'],
          ['มูลค่าอ้างอิง', fmt(it.value ?? 0) + ' AU'],
          ['มีอยู่', fmt(it.qty)],
        ], actions);
      },
    });
  }

  openSell() {
    const wrap = el('div', 'grid');
    wrap.append(this.sellPicker());
    return this.panel('shop', 'ขายของ', wrap);
  }

  openRefine() {
    const wrap = el('div', 'grid');
    wrap.append(el('div', 'muted', 'ตีบวกคือบ่อดูดออรัมหลักของเกม — +4 ขึ้นไปต้องใช้หินลับรูน และล้มเหลวที่ +8 ขึ้นไปของจะแตก (น้ำมันศักดิ์สิทธิ์กันได้ 1 ครั้ง)'));
    const gear = (this.game.inventory?.items ?? []).filter((it) => ITEMS[it.id]?.refinable);
    wrap.append(this.itemPicker({
      key: 'refine',
      items: gear.map((it) => ({ id: it.i, item: it, refine: it.refine })),
      empty: 'ไม่มีอุปกรณ์ที่ตีบวกได้',
      onSelect: (entry) => {
        const it = entry.item;
        const lvl = it.refine ?? 0;
        const def = ITEMS[it.id];
        const chance = Math.round(refineChance(lvl) * 100);
        const actions = el('div', 'opts');
        actions.style.marginTop = '8px';
        const go = el('button', 'btn primary', `ตีบวกเป็น +${lvl + 1}`);
        go.addEventListener('click', () => this.game.net.send({ t: 'refine', index: it.i, oil: false }));
        const oil = el('button', 'btn', 'ใช้น้ำมันศักดิ์สิทธิ์');
        oil.addEventListener('click', () => this.game.net.send({ t: 'refine', index: it.i, oil: true }));
        actions.append(go, oil);
        const risk = el('div', 'muted');
        risk.textContent = lvl >= 8 ? 'ล้มเหลว = อุปกรณ์แตกสลาย'
          : lvl >= 1 ? 'ล้มเหลว = ตกลงหนึ่งขั้น' : 'ล้มเหลวไม่มีผลเสีย';
        return this.detailCard(it, [
          ['ระดับปัจจุบัน', '+' + lvl],
          ['โอกาสสำเร็จ', chance + '%'],
          ['ค่าใช้จ่าย', fmt(refineCost(def.value, lvl)) + ' AU'],
          ['วัตถุดิบ', lvl >= 4 ? 'หินลับรูน x1' : '—'],
        ], actions, risk);
      },
    }));
    return this.panel('shop', 'ตีบวกอุปกรณ์', wrap);
  }

  openRepair() {
    const wrap = el('div', 'grid');
    const worn = (this.game.inventory?.items ?? []).filter((it) => it.dur !== undefined && it.dur < it.maxDur);
    const all = el('button', 'btn', 'ซ่อมทั้งหมด');
    all.addEventListener('click', () => {
      for (const it of worn) this.game.net.send({ t: 'repair', index: it.i });
    });
    wrap.append(all);
    wrap.append(this.itemPicker({
      key: 'repair',
      items: worn.map((it) => ({ id: it.i, item: it, refine: it.refine })),
      empty: 'อุปกรณ์ทุกชิ้นยังสมบูรณ์',
      onSelect: (entry) => {
        const it = entry.item;
        const missing = it.maxDur - it.dur;
        const cost = Math.max(20, Math.floor((it.value ?? 0) * 0.004 * missing) + missing * 2);
        const actions = el('div', 'opts');
        actions.style.marginTop = '8px';
        const go = el('button', 'btn primary', 'ซ่อม');
        go.addEventListener('click', () => this.game.net.send({ t: 'repair', index: it.i }));
        actions.append(go);
        return this.detailCard(it, [
          ['ความคงทน', `${it.dur} / ${it.maxDur}`],
          ['ค่าซ่อม', fmt(cost) + ' AU'],
        ], actions);
      },
    }));
    return this.panel('shop', 'ซ่อมอุปกรณ์', wrap);
  }

  openCraft() {
    const wrap = el('div', 'grid');
    const have = (id) => (this.game.inventory?.items ?? [])
      .filter((x) => x.id === id).reduce((n, x) => n + x.qty, 0);
    for (const [id, r] of Object.entries(RECIPES)) {
      const card = el('div', 'craft-row');
      const out = el('div', 'slot rarity-' + (ITEMS[r.out.id]?.rarity ?? 'common'));
      out.append(itemIcon(r.out.id, { size: 32 }));
      if (r.out.qty > 1) out.append(el('span', 'qty num', String(r.out.qty)));
      const mid = el('div');
      mid.append(el('div', '', `<b>${itemName(r.out.id)}</b> x${r.out.qty}`));
      const mats = el('div', 'craft-mats');
      let ok = true;
      for (const need of r.in) {
        const n = have(need.id);
        if (n < need.qty) ok = false;
        const m = el('div', 'craft-mat' + (n < need.qty ? ' short' : ''));
        m.append(itemIcon(need.id, { size: 20 }));
        m.append(el('span', 'num', `${Math.min(n, need.qty)}/${need.qty}`));
        m.title = itemName(need.id);
        mats.append(m);
      }
      mid.append(mats);
      mid.append(el('div', 'muted', `ค่าธรรมเนียม ${fmt(r.fee)} AU`));
      const go = el('button', 'btn' + (ok ? ' primary' : ''), 'คราฟต์');
      go.disabled = !ok;
      go.addEventListener('click', () => this.game.net.send({ t: 'npcAction', action: 'craftDo', recipe: id, times: 1 }));
      card.append(out, mid, go);
      wrap.append(card);
    }
    return this.panel('shop', 'คราฟต์', wrap);
  }

  openWarp(d) {
    const wrap = el('div', 'grid');
    wrap.append(el('div', 'muted', 'ค่าเดินทางเป็นบ่อดูดออรัม — เดินเองฟรีเสมอ'));
    for (const r of d.routes ?? WARP_ROUTES) {
      const row = el('div', 'row');
      row.innerHTML = `<span>${esc(r.label)}</span>`;
      const b = el('button', 'btn primary', `${fmt(r.price)} AU`);
      b.addEventListener('click', () => this.game.net.send({ t: 'warp', to: r.to }));
      row.append(b);
      wrap.append(row);
    }
    return this.panel('shop', 'บริการเดินทาง', wrap);
  }

  openStorage(d) {
    const wrap = el('div', 'grid');
    const grid = el('div', 'grid cols-2');

    const mine = el('div');
    mine.append(el('h3', '', 'กระเป๋า'));
    const mineGrid = el('div', 'slot-grid');
    for (const it of (this.game.inventory?.items ?? [])) {
      if (it.equipped) continue;
      const node = el('div', `slot rarity-${it.rarity ?? 'common'}`);
      node.append(itemIcon(it.id, { size: 30 }));
      if (it.qty > 1) node.append(el('span', 'qty num', String(it.qty)));
      if (it.refine) node.append(el('span', 'plus', '+' + it.refine));
      node.title = `${it.name} — คลิกเพื่อฝาก`;
      node.addEventListener('click', () => this.game.net.send({ t: 'storageMove', dir: 'in', index: it.i, qty: it.qty }));
      mineGrid.append(node);
    }
    mine.append(mineGrid);

    const store = el('div');
    store.append(el('h3', '', 'คลังเก็บของ'));
    const storeGrid = el('div', 'slot-grid');
    (d.storage?.items ?? []).forEach((it, i) => {
      const def = ITEMS[it.id] ?? {};
      const node = el('div', `slot rarity-${def.rarity ?? 'common'}`);
      node.append(itemIcon(it.id, { size: 30 }));
      if ((it.qty ?? 1) > 1) node.append(el('span', 'qty num', String(it.qty)));
      if (it.refine) node.append(el('span', 'plus', '+' + it.refine));
      node.title = `${def.nameTh ?? it.id} — คลิกเพื่อถอน`;
      node.addEventListener('click', () => this.game.net.send({ t: 'storageMove', dir: 'out', index: i, qty: it.qty ?? 1 }));
      storeGrid.append(node);
    });
    if (!(d.storage?.items ?? []).length) store.append(el('div', 'muted', 'คลังว่างเปล่า'));
    store.append(storeGrid);

    grid.append(mine, store);
    wrap.append(grid);
    return this.panel('storage', 'คลังเก็บของ', wrap);
  }

  openMarket(d) {
    const wrap = el('div', 'grid');
    wrap.append(el('div', 'muted', 'ตลาดผู้เล่น — หักภาษี 5% ทั้งตอนลงขายและตอนขายได้ ประกาศหมดอายุใน 24 ชม.'));
    const tabs = el('div', 'opts');
    const buy = el('button', 'btn primary', 'ซื้อ');
    const sell = el('button', 'btn', 'ลงขาย');
    tabs.append(buy, sell);
    const body = el('div');
    wrap.append(tabs, body);

    const renderBuy = () => {
      body.innerHTML = '';
      const list = d.listings ?? [];
      if (!list.length) { body.append(el('div', 'muted', 'ยังไม่มีใครลงขาย')); return; }
      for (const l of list) {
        const row = el('div', 'listing');
        const ico = el('div', `slot rarity-${l.rarity ?? 'common'}`);
        ico.append(itemIcon(l.id, { size: 30 }));
        if (l.qty > 1) ico.append(el('span', 'qty num', String(l.qty)));
        if (l.refine) ico.append(el('span', 'plus', '+' + l.refine));
        const mid = el('div');
        mid.innerHTML = `<b class="rarity-${l.rarity ?? 'common'}">${esc(l.name)}${l.refine ? ` +${l.refine}` : ''}</b> <span class="muted">x${l.qty}</span>
          <div class="muted num">ชิ้นละ ${fmt(l.unit)} · อ้างอิง ${fmt(l.ref)} · ผู้ขาย ${esc(l.seller)}</div>`;
        const isMine = l.seller === this.game.self?.name;
        const b = el('button', 'btn ' + (isMine ? 'danger' : 'primary'),
          isMine ? 'ยกเลิก' : `${fmt(l.price)} AU`);
        b.addEventListener('click', () => this.game.net.send(isMine
          ? { t: 'marketCancel', uid: l.uid } : { t: 'marketBuy', uid: l.uid }));
        row.append(ico, mid, b);
        body.append(row);
      }
    };

    const renderSell = () => {
      body.innerHTML = '';
      const items = (this.game.inventory?.items ?? []).filter((it) => !it.equipped);
      body.append(this.itemPicker({
        key: 'market',
        items: items.map((it) => ({ id: it.i, item: it, qty: it.qty, refine: it.refine })),
        empty: 'ไม่มีของให้ลงขาย',
        onSelect: (entry) => {
          const it = entry.item;
          const qty = el('input');
          qty.type = 'number'; qty.min = 1; qty.max = it.qty; qty.value = it.qty;
          const price = el('input');
          price.type = 'number'; price.min = 1;
          price.value = Math.max(1, Math.round((it.value ?? 10) * it.qty * 0.8));
          for (const inp of [qty, price]) {
            inp.style.width = '110px';
            inp.addEventListener('focus', () => { this.game.input.textMode = true; });
            inp.addEventListener('blur', () => { this.game.input.textMode = false; });
          }
          const fields = el('div', 'grid');
          const r1 = el('div', 'row'); r1.append(el('span', 'muted', 'จำนวน'), qty);
          const r2 = el('div', 'row'); r2.append(el('span', 'muted', 'ราคารวม (AU)'), price);
          fields.append(r1, r2);
          const actions = el('div', 'opts');
          actions.style.marginTop = '8px';
          const go = el('button', 'btn primary', 'ลงขาย');
          go.addEventListener('click', () => this.game.net.send({
            t: 'marketPost', index: it.i, qty: Number(qty.value) || 1, price: Number(price.value) || 1,
          }));
          actions.append(go);
          return this.detailCard(it, [
            ['มูลค่าอ้างอิงต่อชิ้น', fmt(it.value ?? 0) + ' AU'],
            ['ค่าธรรมเนียมลงขาย', '5% ของราคาที่ตั้ง'],
          ], actions, fields);
        },
      }));
    };

    buy.addEventListener('click', () => { buy.className = 'btn primary'; sell.className = 'btn'; renderBuy(); });
    sell.addEventListener('click', () => { sell.className = 'btn primary'; buy.className = 'btn'; renderSell(); });
    renderBuy();
    return this.panel('market', 'ตลาดผู้เล่น', wrap);
  }

  openSettings() {
    const wrap = el('div');
    const themes = el('div');
    themes.innerHTML = '<h3 style="margin:0 0 6px">หน้าตา UI</h3>';
    const row = el('div', 'opts');
    const current = document.body.dataset.ui ?? 'pixel';
    for (const [key, label, note] of [
      ['pixel', 'พิกเซล', 'ขอบคม มุมบาก เข้ากับสไปรต์'],
      ['ornate', 'แฟนตาซี', 'หนังกับทอง แบบ MMO ยุคเก่า'],
      ['glass', 'มินิมอล', 'กระจกฝ้า บังฉากน้อยที่สุด'],
    ]) {
      const b = el('button', 'btn' + (current === key ? ' primary' : ''), label);
      b.title = note;
      b.addEventListener('click', () => { setTheme(key); this.open('settings'); });
      row.append(b);
    }
    themes.append(row);
    themes.append(el('div', 'muted', 'เปลี่ยนได้ตลอดเวลา ระบบจำค่าไว้ในเบราว์เซอร์นี้'));
    wrap.append(themes, el('hr'));

    const help = el('div');
    help.innerHTML = `
      <h3>ปุ่มควบคุม</h3>
      <table>
        <tr><th></th><th>จอยเกม</th><th>คีย์บอร์ด</th><th>มือถือ</th></tr>
        <tr><td>เดิน</td><td>อนาล็อกซ้าย</td><td>WASD / ลูกศร</td><td>จอยหลอกซ้าย</td></tr>
        <tr><td>โจมตี (ค้างไว้ได้)</td><td>X หรือ RT</td><td>Space</td><td>ปุ่ม ⚔</td></tr>
        <tr><td>คุย NPC / เก็บของ</td><td>A</td><td>E</td><td>ปุ่ม ✋</td></tr>
        <tr><td>สลับเป้าหมาย</td><td>LB / RB</td><td>Tab / Q</td><td>ปุ่ม 🎯</td></tr>
        <tr><td>สกิล 1-4</td><td>ปุ่มทิศ (D-pad)</td><td>1-4</td><td>ปุ่ม 1-4</td></tr>
        <tr><td>สกิล 5-6</td><td>LT + ทิศบน/ล่าง</td><td>5-6</td><td>—</td></tr>
        <tr><td>เมนู / ปิดหน้าต่าง</td><td>Start / B</td><td>I K C J P / Esc</td><td>ปุ่มมุมขวาล่าง</td></tr>
      </table>
      <h3>สิ่งที่ควรรู้</h3>
      <ul class="muted">
        <li>เงิน (ออรัม) หายากโดยตั้งใจ — มอนสเตอร์ส่วนใหญ่ไม่ดรอปเงิน รายได้จริงมาจากของที่ผู้เล่นคนอื่นต้องใช้</li>
        <li>NPC รับซื้อถูกมากและราคาตกถ้าขายซ้ำ ให้ขายของดีในตลาดผู้เล่น</li>
        <li>ตาย = เสีย EXP 5% ไม่เสียของ · อุปกรณ์สึกหรอและต้องจ่ายค่าซ่อม</li>
        <li>ตีบวกเสี่ยงของแตกตั้งแต่ +8 — ของ +10 ขึ้นไปจึงมีค่ามากในตลาด</li>
        <li>ปาร์ตี้ได้ EXP รวมเพิ่ม 10% ต่อสมาชิกหนึ่งคน (ต้องอยู่ใกล้กัน)</li>
        <li>ล่ามอนสเตอร์ที่เลเวลต่างจากเรามากจะได้ EXP ลดลง ป้องกันการพาวเวอร์เลเวล</li>
      </ul>`;
    wrap.append(help);
    return this.panel('settings', 'ตั้งค่าและวิธีเล่น', wrap);
  }
}

/** UI theme lives on <body data-ui>, remembered per browser. */
export function setTheme(name) {
  const ok = ['pixel', 'ornate', 'glass'].includes(name) ? name : 'pixel';
  document.body.dataset.ui = ok;
  try { localStorage.setItem('emberfall-ui', ok); } catch { /* no storage */ }
}

export function loadTheme() {
  let saved = 'pixel';
  try { saved = localStorage.getItem('emberfall-ui') || 'pixel'; } catch { /* no storage */ }
  setTheme(saved);
}

/* ---------------- helpers ---------------- */
function setBar(barSel, txtSel, cur, max, mode) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
  $(barSel).style.width = pct + '%';
  const t = txtSel && $(txtSel);
  if (t) t.textContent = mode === 'pct' ? `${pct.toFixed(2)}%` : `${fmt(Math.floor(cur))} / ${fmt(max)}`;
}
const statRow = (k, v) => `<div class="row"><span class="muted">${k}</span><b>${v}</b></div>`;
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function iconFor(it) {
  return { weapon: '⚔', armor: '🛡', consumable: '🧪', material: '🔩', ammo: '🏹' }[it.type] ?? '📦';
}
function skillNumbers(sk, lvl) {
  const bits = [`SP ${skillCost(sk, lvl)}`];
  if (sk.ratio) bits.push(`พลัง ${(val(sk.ratio, lvl) * 100).toFixed(0)}%`);
  if (sk.heal) bits.push(`ฟื้น ${val(sk.heal, lvl)}`);
  if (sk.duration) bits.push(`นาน ${val(sk.duration, lvl)}s`);
  if (sk.cooldown) bits.push(`คูลดาวน์ ${val(sk.cooldown, lvl).toFixed(1)}s`);
  if (sk.castTime) bits.push(`ร่าย ${sk.castTime}s`);
  return bits.join(' · ');
}
