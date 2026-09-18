// All DOM: HUD, chat, panels. The game loop only calls into this module.
import { ITEMS, RECIPES, RARITY_COLORS } from '../../shared/data/items.js';
import { SKILLS, val, skillCost } from '../../shared/data/skills.js';
import { JOBS } from '../../shared/data/jobs.js';
import { QUESTS } from '../../shared/data/quests.js';
import { WARP_ROUTES } from '../../shared/data/npcs.js';
import { TILES } from '../../shared/data/maps.js';
import { TILE } from '../../shared/constants.js';
import { refineChance, refineCost, npcSellPrice } from '../../shared/formulas.js';

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

    for (const b of document.querySelectorAll('#menu-buttons button')) {
      b.addEventListener('click', () => this.toggle(b.dataset.panel));
    }
    addEventListener('keydown', (e) => {
      if (game.input.textMode) return;
      const map = { KeyC: 'character', KeyI: 'inventory', KeyK: 'skills', KeyJ: 'quests', KeyP: 'party', F1: 'help' };
      if (map[e.code]) { e.preventDefault(); this.toggle(map[e.code]); }
      if (e.code === 'Enter') { e.preventDefault(); $('#chat-input').focus(); }
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
    $('#me-name').textContent = self.name;
    $('#me-job').textContent = `${JOBS[self.job]?.nameTh ?? self.job} Lv.${you?.level ?? self.level}/J${you?.jobLevel ?? self.jobLevel}`;
    setBar('#bar-hp', '#txt-hp', hp, maxHp);
    setBar('#bar-sp', '#txt-sp', sp, maxSp);
    setBar('#bar-exp', '#txt-exp', you?.exp ?? self.exp, self.expNext, 'EXP');
    setBar('#bar-jexp', '#txt-jexp', you?.jobExp ?? self.jobExp, self.jobExpNext, 'อาชีพ');
    $('#aurum').textContent = fmt(you?.aurum ?? self.aurum);
    const over = (you?.weight ?? 0) > (you?.weightCap ?? 1);
    $('#netinfo').innerHTML = `ping ${this.game.net.ping}ms · น้ำหนัก <span style="color:${over ? 'var(--bad)' : 'inherit'}">${fmt(you?.weight ?? 0)}/${fmt(you?.weightCap ?? 0)}</span>`;
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
      slot.append(el('span', '', sk ? `${sk.nameTh}<br><small class="muted">Lv${self.skills[skillId] ?? 0}</small>` : '—'));
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
        const cd = el('div', 'cd', Math.ceil((until - now) / 1000));
        slot.append(cd);
      }
    });
  }

  minimap(state, renderer) {
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
    const p = el('div', 'panel');
    const head = el('header');
    head.append(el('h2', '', title));
    const x = el('button', 'close', '✕');
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
    if (!self && name !== 'help') return;
    switch (name) {
      case 'character': return this.openCharacter(self);
      case 'inventory': return this.openInventory();
      case 'skills': return this.openSkills(self);
      case 'quests':
        this.game.net.send({ t: 'quest', cmd: 'list' });
        return this.openQuests(this.lastQuests ?? []);
      case 'party':
        this.game.net.send({ t: 'party', cmd: 'state' });
        return this.openParty(this.lastParty);
      case 'help': return this.openHelp();
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
    const stats = el('div', 'grid cols-2');
    const left = el('div');
    left.innerHTML = `<h3 style="margin:0 0 8px">สเตตัสหลัก <small class="muted">แต้มเหลือ ${self.statPoints}</small></h3>`;
    for (const k of ['str', 'agi', 'vit', 'int', 'dex', 'luk']) {
      const row = el('div', 'row');
      row.innerHTML = `<span><b>${k.toUpperCase()}</b> ${self.base[k]}</span>`;
      const b = el('button', 'btn', `+ (${self.statCosts[k]})`);
      b.disabled = self.statPoints < self.statCosts[k];
      b.addEventListener('click', () => this.game.net.send({ t: 'allocStat', stat: k }));
      row.append(b);
      left.append(row);
    }
    const right = el('div');
    right.innerHTML = `
      <h3 style="margin:0 0 8px">ค่าที่ได้จริง</h3>
      ${statRow('ATK', d.atk)}${statRow('MATK', d.matk)}
      ${statRow('DEF', `${d.def} (+${d.softDef})`)}${statRow('MDEF', `${d.mdef} (+${d.softMdef})`)}
      ${statRow('HIT', d.hit)}${statRow('FLEE', d.flee)}
      ${statRow('CRIT', d.crit + '%')}${statRow('ความเร็วโจมตี', (1 / d.aspdFactor).toFixed(2) + 'x')}
      ${statRow('ความเร็วเดิน', Math.round(d.moveSpeed))}
      ${statRow('ลดเวลาร่าย', Math.round((1 - d.castFactor) * 100) + '%')}
      ${statRow('น้ำหนักสูงสุด', fmt(self.weightCap ?? d.weight))}`;
    stats.append(left, right);

    const job = JOBS[self.job];
    const info = el('div');
    info.innerHTML = `<div class="row"><span>อาชีพ</span><b>${job?.nameTh} (${job?.name})</b></div>
      <div class="muted" style="padding:4px 0">${job?.desc ?? ''}</div>
      <div class="row"><span>อาวุธที่ใช้ได้</span><b>${(job?.weapons ?? []).join(', ')}</b></div>`;
    if (job?.next?.length) {
      info.append(el('div', 'muted', `สายต่อไป: ${job.next.map((j) => JOBS[j].nameTh).join(' / ')} (คุยกับครูฝึกเมื่อ Job Lv. ${job.jobLevelToAdvance})`));
    }
    wrap.append(info, el('hr'), stats);
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
    const wrap = $('#inv-body');
    if (!wrap) return;
    const inv = this.game.inventory ?? { items: [] };
    wrap.innerHTML = '';
    const head = el('div', 'row');
    head.innerHTML = `<span>ออรัม <b style="color:var(--gold)">${fmt(inv.aurum)}</b></span>
      <span class="muted">น้ำหนัก ${fmt(inv.weight)}/${fmt(inv.weightCap)}</span>`;
    wrap.append(head);

    const list = el('div', 'item-list');
    for (const it of inv.items) {
      const node = el('div', 'item' + (this.selectedInv === it.i ? ' sel' : ''));
      node.innerHTML = `<div class="ico">${iconFor(it)}</div>
        <div class="nm"><b class="rarity-${it.rarity ?? 'common'}">${esc(it.name)}${it.refine ? ` +${it.refine}` : ''}</b>
        <span class="muted">${it.qty > 1 ? 'x' + it.qty + ' · ' : ''}${it.equipped ? 'สวมอยู่ · ' : ''}${it.dur !== undefined ? `คงทน ${it.dur}/${it.maxDur}` : ''}</span></div>`;
      node.addEventListener('click', () => { this.selectedInv = it.i; this.renderInventory(); });
      node.addEventListener('dblclick', () => this.useInvItem(it));
      list.append(node);
    }
    wrap.append(list);

    const sel = inv.items.find((x) => x.i === this.selectedInv);
    if (sel) wrap.append(this.itemActions(sel));
    return wrap;
  }

  itemActions(it) {
    const box = el('div');
    box.style.marginTop = '10px';
    box.append(el('div', 'muted', itemTooltip(it)));
    const actions = el('div', 'opts');
    actions.style.marginTop = '8px';
    const add = (label, fn, cls = 'btn') => {
      const b = el('button', cls, label);
      b.addEventListener('click', fn);
      actions.append(b);
    };
    if (it.type === 'weapon' || it.type === 'armor') {
      if (it.equipped) add('ถอด', () => this.game.net.send({ t: 'unequip', slot: it.equipped }));
      else add('สวมใส่', () => this.game.net.send({ t: 'equip', index: it.i }), 'btn primary');
    }
    if (it.type === 'consumable') add('ใช้', () => this.game.net.send({ t: 'useItem', index: it.i }), 'btn primary');
    add('ทิ้ง', () => {
      if (confirm(`ทิ้ง ${it.name} ?`)) this.game.net.send({ t: 'dropItem', index: it.i, qty: it.qty });
    }, 'btn danger');
    box.append(actions);
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
      info.innerHTML = `<b>${sk.nameTh}</b> <span class="muted">${sk.name} · Lv.${lvl}/${sk.maxLevel ?? 5}</span>
        <div class="muted">${sk.desc ?? ''}</div>
        <div class="muted">${lvl ? skillNumbers(sk, lvl) : 'ยังไม่ได้เรียน'}</div>`;
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

  openShop(d) {
    if (d.mode === 'refine') return this.openRefine();
    if (d.mode === 'repair') return this.openRepair();
    if (d.mode === 'craft') return this.openCraft();
    if (d.mode === 'warp') return this.openWarp(d);
    if (d.mode === 'sell') return this.openSell();
    this.lastShop = d;
    const wrap = el('div');
    const tabs = el('div', 'opts');
    const buyTab = el('button', 'btn primary', 'ซื้อ');
    const sellTab = el('button', 'btn', 'ขาย');
    tabs.append(buyTab, sellTab);
    const body = el('div');
    wrap.append(tabs, body);

    const renderBuy = () => {
      body.innerHTML = '';
      const t = el('table');
      t.innerHTML = '<tr><th>ไอเทม</th><th>ราคา</th><th>สต็อก</th><th></th></tr>';
      for (const s of d.stock) {
        const tr = el('tr');
        tr.innerHTML = `<td>${esc(s.name)}</td><td style="color:var(--gold)">${fmt(s.price)}</td><td class="muted">${s.stock}</td>`;
        const td = el('td');
        const qty = el('input');
        qty.type = 'number'; qty.value = 1; qty.min = 1; qty.style.width = '64px';
        const b = el('button', 'btn primary', 'ซื้อ');
        b.addEventListener('click', () => this.game.net.send({ t: 'shopBuy', shop: d.id, id: s.id, qty: Number(qty.value) || 1 }));
        td.append(qty, b);
        tr.append(td);
        t.append(tr);
      }
      body.append(t);
    };
    const renderSell = () => {
      body.innerHTML = '';
      body.append(el('div', 'muted', 'NPC รับซื้อที่ ~28% ของมูลค่าอ้างอิง และราคาจะตกลงถ้าขายของชิ้นเดิมซ้ำๆ ในวันเดียว — ขายให้ผู้เล่นได้ราคาดีกว่าเสมอ'));
      const t = el('table');
      t.innerHTML = '<tr><th>ไอเทม</th><th>ได้รับ/ชิ้น</th><th></th></tr>';
      for (const it of this.game.inventory.items) {
        if (it.equipped) continue;
        const tr = el('tr');
        tr.innerHTML = `<td>${esc(it.name)} ${it.qty > 1 ? `x${it.qty}` : ''}</td>
          <td style="color:var(--gold)">${fmt(npcSellPrice(it.value ?? 0, 0))}</td>`;
        const td = el('td');
        const b = el('button', 'btn', 'ขาย');
        b.addEventListener('click', () => this.game.net.send({ t: 'shopSell', index: it.i, qty: it.qty }));
        td.append(b);
        tr.append(td);
        t.append(tr);
      }
      body.append(t);
    };
    buyTab.addEventListener('click', () => { buyTab.className = 'btn primary'; sellTab.className = 'btn'; renderBuy(); });
    sellTab.addEventListener('click', () => { sellTab.className = 'btn primary'; buyTab.className = 'btn'; renderSell(); });
    renderBuy();
    return this.panel('shop', d.name ?? 'ร้านค้า', wrap);
  }

  openSell() {
    const wrap = el('div');
    const t = el('table');
    t.innerHTML = '<tr><th>ไอเทม</th><th>ได้รับ/ชิ้น</th><th></th></tr>';
    for (const it of this.game.inventory.items) {
      if (it.equipped) continue;
      const tr = el('tr');
      tr.innerHTML = `<td>${esc(it.name)} ${it.qty > 1 ? `x${it.qty}` : ''}</td><td style="color:var(--gold)">${fmt(npcSellPrice(it.value ?? 0, 0))}</td>`;
      const td = el('td');
      const b = el('button', 'btn', 'ขาย');
      b.addEventListener('click', () => this.game.net.send({ t: 'shopSell', index: it.i, qty: it.qty }));
      td.append(b); tr.append(td); t.append(tr);
    }
    wrap.append(t);
    return this.panel('shop', 'ขายของ', wrap);
  }

  openRefine() {
    const wrap = el('div');
    wrap.append(el('div', 'muted', 'ตีบวกคือบ่อดูดออรัมหลักของเกม — +4 ขึ้นไปต้องใช้หินลับรูน และล้มเหลวที่ +8 ขึ้นไปของจะแตก (ใช้น้ำมันศักดิ์สิทธิ์กันได้ 1 ครั้ง)'));
    const t = el('table');
    t.innerHTML = '<tr><th>อุปกรณ์</th><th>โอกาสสำเร็จ</th><th>ค่าใช้จ่าย</th><th></th></tr>';
    for (const it of this.game.inventory.items) {
      const def = ITEMS[it.id];
      if (!def?.refinable) continue;
      const lvl = it.refine ?? 0;
      const tr = el('tr');
      tr.innerHTML = `<td>${esc(it.name)} +${lvl}</td>
        <td>${Math.round(refineChance(lvl) * 100)}%</td>
        <td style="color:var(--gold)">${fmt(refineCost(def.value, lvl))}</td>`;
      const td = el('td');
      const b = el('button', 'btn primary', 'ตีบวก');
      b.addEventListener('click', () => this.game.net.send({ t: 'refine', index: it.i, oil: false }));
      const b2 = el('button', 'btn', '+น้ำมัน');
      b2.addEventListener('click', () => this.game.net.send({ t: 'refine', index: it.i, oil: true }));
      td.append(b, b2); tr.append(td); t.append(tr);
    }
    wrap.append(t);
    return this.panel('shop', 'ตีบวกอุปกรณ์', wrap);
  }

  openRepair() {
    const wrap = el('div');
    const t = el('table');
    t.innerHTML = '<tr><th>อุปกรณ์</th><th>ความคงทน</th><th></th></tr>';
    for (const it of this.game.inventory.items) {
      if (it.dur === undefined) continue;
      const tr = el('tr');
      tr.innerHTML = `<td>${esc(it.name)}</td><td>${it.dur}/${it.maxDur}</td>`;
      const td = el('td');
      const b = el('button', 'btn primary', 'ซ่อม');
      b.disabled = it.dur >= it.maxDur;
      b.addEventListener('click', () => this.game.net.send({ t: 'repair', index: it.i }));
      td.append(b); tr.append(td); t.append(tr);
    }
    wrap.append(t);
    return this.panel('shop', 'ซ่อมอุปกรณ์', wrap);
  }

  openCraft() {
    const wrap = el('div');
    for (const [id, r] of Object.entries(RECIPES)) {
      const row = el('div', 'row');
      row.innerHTML = `<div><b>${itemName(r.out.id)} x${r.out.qty}</b>
        <div class="muted">ใช้: ${r.in.map((i) => `${itemName(i.id)} x${i.qty}`).join(', ')} · ค่าธรรมเนียม ${fmt(r.fee)} AU</div></div>`;
      const btn = el('button', 'btn primary', 'คราฟต์');
      btn.addEventListener('click', () => this.game.net.send({ t: 'npcAction', action: 'craftDo', recipe: id, times: 1 }));
      row.append(btn);
      wrap.append(row);
    }
    return this.panel('shop', 'คราฟต์', wrap);
  }

  openWarp(d) {
    const wrap = el('div');
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
    const wrap = el('div');
    const grid = el('div', 'grid cols-2');
    const mine = el('div');
    mine.innerHTML = '<h3>กระเป๋า</h3>';
    for (const it of this.game.inventory.items) {
      if (it.equipped) continue;
      const row = el('div', 'row');
      row.innerHTML = `<span>${esc(it.name)} ${it.qty > 1 ? `x${it.qty}` : ''}</span>`;
      const b = el('button', 'btn', '→ ฝาก');
      b.addEventListener('click', () => this.game.net.send({ t: 'storageMove', dir: 'in', index: it.i, qty: it.qty }));
      row.append(b);
      mine.append(row);
    }
    const store = el('div');
    store.innerHTML = '<h3>คลังเก็บของ</h3>';
    (d.storage?.items ?? []).forEach((it, i) => {
      const row = el('div', 'row');
      row.innerHTML = `<span>${itemName(it.id)} ${it.qty > 1 ? `x${it.qty}` : ''}${it.refine ? ` +${it.refine}` : ''}</span>`;
      const b = el('button', 'btn', 'ถอน ←');
      b.addEventListener('click', () => this.game.net.send({ t: 'storageMove', dir: 'out', index: i, qty: it.qty }));
      row.append(b);
      store.append(row);
    });
    grid.append(mine, store);
    wrap.append(grid);
    return this.panel('storage', 'คลังเก็บของ', wrap);
  }

  openMarket(d) {
    const wrap = el('div');
    wrap.append(el('div', 'muted', 'ตลาดผู้เล่น — หักภาษี 5% ทั้งตอนลงขายและตอนขายได้ ประกาศหมดอายุใน 24 ชม.'));
    const tabs = el('div', 'opts');
    const buy = el('button', 'btn primary', 'ซื้อ');
    const sell = el('button', 'btn', 'ลงขาย');
    tabs.append(buy, sell);
    const body = el('div');
    wrap.append(tabs, body);

    const renderBuy = () => {
      body.innerHTML = '';
      const t = el('table');
      t.innerHTML = '<tr><th>ไอเทม</th><th>จำนวน</th><th>ราคา</th><th>ต่อชิ้น</th><th>ผู้ขาย</th><th></th></tr>';
      for (const l of d.listings ?? []) {
        const tr = el('tr');
        tr.innerHTML = `<td class="rarity-${l.rarity ?? 'common'}">${esc(l.name)}${l.refine ? ` +${l.refine}` : ''}</td>
          <td>${l.qty}</td><td style="color:var(--gold)">${fmt(l.price)}</td>
          <td class="muted">${fmt(l.unit)} <small>(อ้างอิง ${fmt(l.ref)})</small></td><td class="muted">${esc(l.seller)}</td>`;
        const td = el('td');
        const isMine = l.seller === this.game.self?.name;
        const b = el('button', 'btn ' + (isMine ? 'danger' : 'primary'), isMine ? 'ยกเลิก' : 'ซื้อ');
        b.addEventListener('click', () => this.game.net.send(isMine
          ? { t: 'marketCancel', uid: l.uid } : { t: 'marketBuy', uid: l.uid }));
        td.append(b); tr.append(td); t.append(tr);
      }
      body.append(t);
    };
    const renderSell = () => {
      body.innerHTML = '';
      const t = el('table');
      t.innerHTML = '<tr><th>ไอเทม</th><th>จำนวน</th><th>ราคารวม</th><th></th></tr>';
      for (const it of this.game.inventory.items) {
        if (it.equipped) continue;
        const tr = el('tr');
        tr.innerHTML = `<td>${esc(it.name)}${it.refine ? ` +${it.refine}` : ''}</td>`;
        const qtyTd = el('td'), priceTd = el('td'), actTd = el('td');
        const qty = el('input'); qty.type = 'number'; qty.min = 1; qty.max = it.qty; qty.value = it.qty; qty.style.width = '70px';
        const price = el('input'); price.type = 'number'; price.min = 1; price.value = Math.max(1, Math.round((it.value ?? 10) * it.qty * 0.8)); price.style.width = '110px';
        for (const inp of [qty, price]) {
          inp.addEventListener('focus', () => { this.game.input.textMode = true; });
          inp.addEventListener('blur', () => { this.game.input.textMode = false; });
        }
        const b = el('button', 'btn primary', 'ลงขาย');
        b.addEventListener('click', () => this.game.net.send({
          t: 'marketPost', index: it.i, qty: Number(qty.value) || 1, price: Number(price.value) || 1,
        }));
        qtyTd.append(qty); priceTd.append(price); actTd.append(b);
        tr.append(qtyTd, priceTd, actTd);
        t.append(tr);
      }
      body.append(t);
    };
    buy.addEventListener('click', () => { buy.className = 'btn primary'; sell.className = 'btn'; renderBuy(); });
    sell.addEventListener('click', () => { sell.className = 'btn primary'; buy.className = 'btn'; renderSell(); });
    renderBuy();
    return this.panel('market', 'ตลาดผู้เล่น', wrap);
  }

  openHelp() {
    const wrap = el('div');
    wrap.innerHTML = `
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
    return this.panel('help', 'วิธีเล่น', wrap);
  }
}

/* ---------------- helpers ---------------- */
function setBar(barSel, txtSel, cur, max, label) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
  $(barSel).style.width = pct + '%';
  const t = $(txtSel);
  if (t) t.textContent = label ? `${label} ${pct.toFixed(1)}%` : `${fmt(Math.floor(cur))} / ${fmt(max)}`;
}
const statRow = (k, v) => `<div class="row"><span class="muted">${k}</span><b>${v}</b></div>`;
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function iconFor(it) {
  return { weapon: '⚔', armor: '🛡', consumable: '🧪', material: '🔩', ammo: '🏹' }[it.type] ?? '📦';
}
function itemTooltip(it) {
  const parts = [];
  if (it.level) parts.push(`ต้องเลเวล ${it.level}`);
  if (it.atk) parts.push(`ATK ${it.atk}`);
  if (it.matk) parts.push(`MATK ${it.matk}`);
  if (it.def) parts.push(`DEF ${it.def}`);
  if (it.mdef) parts.push(`MDEF ${it.mdef}`);
  if (it.stats) for (const [k, v] of Object.entries(it.stats)) parts.push(`${k.toUpperCase()} +${v}`);
  if (it.weight) parts.push(`น้ำหนัก ${it.weight}`);
  if (it.value) parts.push(`มูลค่าอ้างอิง ${fmt(it.value)} AU`);
  return `${it.desc ? it.desc + ' · ' : ''}${parts.join(' · ')}`;
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
