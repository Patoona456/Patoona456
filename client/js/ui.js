// All DOM: HUD, chat, panels. The game loop only calls into this module.
import { ITEMS, RECIPES, RARITY_COLORS, CRAFTING_INPUTS, isEquip, socketsOf, cardFits } from '../../shared/data/items.js';
import { SKILLS, val, skillCost } from '../../shared/data/skills.js';
import { JOBS } from '../../shared/data/jobs.js';
import { QUESTS } from '../../shared/data/quests.js';
import { MONSTERS } from '../../shared/data/monsters.js';
import { WARP_ROUTES } from '../../shared/data/npcs.js';
import { TILES } from '../../shared/data/maps.js';
import { TILE } from '../../shared/constants.js';
import { refineChance, refineCost, npcSellPrice } from '../../shared/formulas.js';
import { itemIcon, skillIcon, icon, UI_BASE } from './icons.js';
import { playerLayers, drawCharacter, drawRefineGlow, loadedRatio } from './sprites.js';
import { drawWings } from './wings.js';
import { drawBehind, drawInFront, apparelOf } from './apparel.js';
import { SLOTS, slotName } from '../../shared/constants.js';
import { ZOOM_STEPS } from './renderer.js';
import { gameClock, skyAt } from '../../shared/daycycle.js';
import { glowTier, glowCss, specialMarks, signatureOf, SPECIAL_MARKS, SIGNATURES } from '../../shared/refineglow.js';
import { WEAPON_CLASSES } from '../../shared/weapons.js';
import { MAPS } from '../../shared/data/maps.js';

/** Zone ids to the names players see, for quest rows. */
const ZONE_NAMES = Object.fromEntries(Object.entries(MAPS).map(([id, m]) => [id, m.nameTh ?? m.name]));

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
    $('#mm-in')?.addEventListener('click', () => this.zoomMinimap(1));
    $('#mm-out')?.addEventListener('click', () => this.zoomMinimap(-1));
    addEventListener('keydown', (e) => {
      if (game.input.textMode) return;
      const map = { KeyC: 'character', KeyI: 'inventory', KeyK: 'skills', KeyJ: 'quests', KeyP: 'party', KeyG: 'guild', F1: 'settings', KeyT: 'trade', KeyV: 'stall' };
      if (e.code === 'KeyF') { this.socialTab = 'friends'; this.game.net.send({ t: 'friend', cmd: 'state' }); }
      if (e.code === 'KeyP') this.socialTab = 'party';
      if (e.code === 'KeyF') { e.preventDefault(); this.toggle('party'); }
      if (map[e.code]) { e.preventDefault(); this.toggle(map[e.code]); }
      if (e.code === 'Enter') { e.preventDefault(); $('#chat-input').focus(); }
      if (e.code === 'KeyM') {
        const muted = this.game.audio.toggleMute();
        this.toast(muted ? 'ปิดเสียงแล้ว (M)' : 'เปิดเสียงแล้ว (M)', muted ? 'warn' : 'good');
        if (this.openPanels.has('settings')) this.open('settings');
      }
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
    this.game.audio?.play(kind === 'good' ? 'good' : kind === 'bad' ? 'bad' : kind === 'warn' ? 'warn' : 'ui');
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
    this.game.audio?.play('bad', null, { gate: 0.25 });
    n.textContent = text;
    n.classList.remove('show');
    void n.offsetWidth;          // restart the animation
    n.classList.add('show');
    clearTimeout(this._flashT);
    this._flashT = setTimeout(() => n.classList.remove('show'), 1400);
  }

  chat(m) {
    const log = $('#chat-log');
    const prefix = m.ch === 'whisper' ? (m.to ? `[กระซิบถึง ${esc(m.to)}] ` : '[กระซิบ] ')
      : { say: '', party: '[ปาร์ตี้] ', trade: '[ซื้อขาย] ', world: '[โลก] ', system: '' }[m.ch] ?? '';
    const line = el('div', m.ch, `${prefix}${m.from ? `<b>${esc(m.from)}</b>: ` : ''}${esc(m.text)}`);
    line.dataset.ch = m.ch;
    if (this.chatFilter && this.chatFilter !== 'all' && this.chatFilter !== m.ch) line.hidden = true;
    log.append(line);
    while (log.childElementCount > 120) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  }

  /** A painted stamp (Quest Clear!) that pops in the middle and fades. */
  stamp(name) {
    let n = $('#stamp');
    if (!n) {
      n = el('img', '', '');
      n.id = 'stamp';
      n.alt = '';
      document.body.append(n);
    }
    n.src = `${UI_BASE}/${name}.webp`;
    n.classList.remove('show');
    void n.offsetWidth;
    n.classList.add('show');
    clearTimeout(this._stampT);
    this._stampT = setTimeout(() => n.classList.remove('show'), 1900);
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

    this.updateClock();

    const over = (you?.weight ?? 0) > (you?.weightCap ?? 1);
    $('#netinfo').innerHTML = `${this.game.net.ping}ms · <span style="color:${over ? 'var(--bad)' : 'inherit'}">${fmt(you?.weight ?? 0)}/${fmt(you?.weightCap ?? 0)}</span>`;
  }

  /** In-world time: one full day every 24 real minutes, shared by everyone. */
  updateClock() {
    const node = $('#clock');
    if (!node) return;
    const sky = skyAt();
    const p = sky.phase;
    const icon = p < 0.24 ? '🌙' : p < 0.30 ? '🌅' : p < 0.70 ? '🌤' : p < 0.80 ? '🌇' : '🌙';
    node.textContent = `${icon} ${gameClock().text}`;
    node.title = sky.night ? 'กลางคืน — คบไฟและโคมสว่างขึ้น' : 'กลางวัน';
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

      // one tap to walk there: the tracker is where people actually look
      const navving = this.game.nav?.questId === q.id;
      const go = el('button', 'btn qgo' + (navving ? ' primary' : ''), navving ? '■ หยุด' : '🧭 ไปเลย');
      go.addEventListener('click', (e) => { e.stopPropagation(); this.game.startQuestNav(q); });
      row.append(go);
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
      slot.addEventListener('click', () => { this.game.audio?.play('potion'); this.game.net.send({ t: 'useItem', index: it.i }); });
      box.append(slot);
    }
    for (let i = items.length; i < 2; i++) box.append(el('div', 'slot empty'));
  }

  updateTarget(ent) {
    const f = $('#target-frame');
    const tradeBtn = $('#tg-trade');
    if (tradeBtn) tradeBtn.classList.toggle('hidden', ent?.k !== 'p');
    if (!ent) { f.classList.add('hidden'); return; }
    f.classList.remove('hidden');
    f.classList.toggle('boss', !!ent.boss);
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
      const pic = STATUS_ART[s.key] ?? STATUS_ART[s.type];
      const node = el('div', s.beneficial ? 'good' : 'bad', pic ? '' : s.icon);
      if (pic) {
        const img = el('img', 'st-ico');
        img.src = `${UI_BASE}/${pic}.webp`;
        img.alt = s.icon;
        node.append(img);
      }
      box.append(node);
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
    // a painted town is its own map; tiles would only show the walkable mask
    const art = renderer.backdrop?.complete && renderer.backdrop.naturalWidth ? renderer.backdrop : null;
    const src = art ?? this._miniCache;
    const kx = (art ? art.naturalWidth : z.width) / z.width;
    const ky = (art ? art.naturalHeight : z.height) / z.height;
    g.imageSmoothingEnabled = !!art;
    // The round frame shows a square window around the player that the +/-
    // buttons widen or narrow; the square card shows the whole zone.
    let vx = 0, vy = 0, vw = z.width, vh = z.height;
    if (document.body.dataset.ui === 'ember') {
      const side = Math.max(z.width, z.height) / (this.miniZoom ?? 2);
      const me = state.me;
      vw = vh = side;
      vx = Math.max(Math.min(me.x / TILE - side / 2, z.width - side), Math.min(0, z.width - side));
      vy = Math.max(Math.min(me.y / TILE - side / 2, z.height - side), Math.min(0, z.height - side));
      if (z.width < side) vx = (z.width - side) / 2;
      if (z.height < side) vy = (z.height - side) / 2;
      g.fillStyle = '#1a1714';
      g.fillRect(0, 0, c.width, c.height);
    }
    const sx = c.width / vw, sy = c.height / vh;
    const ix = Math.max(0, vx), iy = Math.max(0, vy);
    const iw = Math.min(z.width, vx + vw) - ix, ih = Math.min(z.height, vy + vh) - iy;
    g.drawImage(src, ix * kx, iy * ky, iw * kx, ih * ky, (ix - vx) * sx, (iy - vy) * sy, iw * sx, ih * sy);
    for (const e of state.ents ?? []) {
      if (e.k === 'n') g.fillStyle = '#7dffb0';
      else if (e.k === 'm') g.fillStyle = e.boss ? '#ffb45e' : '#ff7a7a';
      else g.fillStyle = e.id === state.myId ? '#ffffff' : '#7fb2ff';
      const mine = e.id === state.myId;
      g.fillRect((e.x / TILE - vx) * sx - (mine ? 2 : 1), (e.y / TILE - vy) * sy - (mine ? 2 : 1), mine ? 5 : 3, mine ? 5 : 3);
    }
  }

  /** The +/- on the round map frame: how much of the zone it shows. */
  zoomMinimap(dir) {
    this.miniZoom = Math.max(1, Math.min(4, (this.miniZoom ?? 2) + dir));
  }

  /* ---------------- panel plumbing ---------------- */
  toggle(name, data) {
    if (this.openPanels.has(name)) this.close(name);
    else this.open(name, data);
  }

  close(name) {
    if (this.openPanels.has(name) && !this._silentClose) this.game.audio?.play('close');
    this.openPanels.get(name)?.remove();
    this.openPanels.delete(name);
  }

  closeTop() {
    const last = [...this.openPanels.keys()].pop();
    if (last) this.close(last);
  }

  panel(name, title, bodyNode) {
    const reopen = this.openPanels.has(name);   // a redraw is not a new window
    this._silentClose = true;
    this.close(name);
    this._silentClose = false;
    if (!reopen) this.game.audio?.play('open');
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
      case 'guild':
        this.game.net.send({ t: 'guild', cmd: 'state' });
        return this.openGuild(this.lastGuild);
      case 'settings': return this.openSettings();
      case 'jobchange': return this.openJobChange();
      case 'trade': return this.lastTrade ? this.openTrade(data ?? this.lastTrade) : this.openTradePicker();
      case 'tradePicker': return this.openTradePicker();
      case 'shop': return this.openShop(data);
      case 'market': return this.openMarket(data);
      case 'stall': return this.openStall(data ?? this.lastStall);
      case 'stallView': return this.openStallView(data);
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

    const LABELS = Object.fromEntries(SLOTS.map((s) => [s, slotName(s)]));
    const slotNode = (slot) => {
      const it = worn[slot];
      const node = el('div', 'slot doll-slot' + (it ? ` rarity-${it.rarity ?? 'common'}` : ' empty'));
      node.title = it ? `${it.name}${it.refine ? ` +${it.refine}` : ''} — คลิกเพื่อถอด` : LABELS[slot];
      if (it) {
        node.append(itemIcon(it.id, { size: 30 }));
        if (it.refine) { node.append(el('span', 'plus', '+' + it.refine)); markRefine(node, it.refine); }
        node.addEventListener('click', () => this.game.net.send({ t: 'unequip', slot }));
      } else if (GHOSTS.has(slot)) {
        // the sheet's grey outline of what goes here, the name on hover
        const img = el('img', 'ghost');
        img.src = `${UI_BASE}/ghost_${slot}.webp`;
        img.alt = LABELS[slot];
        node.append(img);
      } else {
        node.append(el('span', 'doll-label', LABELS[slot]));
      }
      return node;
    };
    // Fifteen slots, seven a side and two under the character. The columns
    // read head to foot so the doll matches where things are worn.
    for (const slot of ['head', 'glasses', 'mask', 'scarf', 'torso', 'armor', 'hands']) left.append(slotNode(slot));
    for (const slot of ['weapon', 'offhand', 'belt', 'legs', 'feet', 'cloak']) right.append(slotNode(slot));
    mid.append(slotNode('accessory'));
    mid.append(slotNode('wings'));
    gear.append(left, mid, right);

    const ctx = preview.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const layers = playerLayers(self.look, Object.fromEntries(
      Object.entries(worn).map(([slot, it]) => [slot, it.id])
    ));
    // the canvas is not in the document yet when this runs, so keep painting
    // until the sheets are decoded rather than bailing on the first frame
    let tries = 0;
    const wr = worn.weapon?.refine ?? 0;
    const tier = glowTier(wr);
    const paint = (t = 0) => {
      if (tries++ > 40 && !tier) return;
      ctx.clearRect(0, 0, 96, 116);
      ctx.save();
      ctx.scale(1.55, 1.55);
      const pose = { x: 31, y: 70, anim: 'idle', dir: 0, elapsed: 0 };
      const wing = worn.wings && ITEMS[worn.wings.id]?.wing;
      if (wing) drawWings(ctx, wing.style, { x: 31, y: 70, dir: 2, t, scale: wing.scale ?? 1 });
      // the code-drawn slots, same order the world draws them in
      const dress = { x: 31, y: 70, dir: 2, t, scale: 1, moving: false };
      const apparel = apparelOf(Object.fromEntries(
        Object.entries(worn).map(([slot, it]) => [slot, it.id])
      ), ITEMS);
      drawBehind(ctx, apparel, dress);
      drawCharacter(ctx, layers, pose);
      drawInFront(ctx, apparel, dress);
      if (tier) {
        // the same aura the world shows, so the doll matches the field
        const pulse = 0.72 + 0.28 * Math.sin(t / (520 / tier.pulse));
        const colour = `rgb(${tier.color.join(',')})`;
        drawRefineGlow(ctx, layers, { ...pose, color: colour, alpha: tier.aura * pulse * 0.55, blur: 4 });
        drawRefineGlow(ctx, layers, { ...pose, color: colour, alpha: tier.aura * pulse * 0.5 });
      }
      ctx.restore();
      if (!document.body.contains(preview)) return;
      if (tier) requestAnimationFrame(paint);
      else if (loadedRatio() < 1 || tries < 3) setTimeout(paint, 200);
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
      <div class="row"><span>อาวุธที่ใช้ได้</span><b>${(job?.weapons ?? []).map((w) => WEAPON_CLASSES[w]?.nameTh ?? w).join(', ')}</b></div>`;
    if (job?.next?.length) {
      info.append(el('div', 'muted', `สายต่อไป: ${job.next.map((j) => JOBS[j].nameTh).join(' / ')} (คุยกับครูฝึกเมื่อ Job Lv. ${job.advance?.jobLevel ?? job.jobLevelToAdvance ?? 10})`));
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
    const wallet = document.querySelector('.shop-wallet');
    if (wallet) wallet.querySelector('b').textContent = fmt(this.shopMoney({ currency: wallet.dataset.currency || null }));
    // a sale changes what is left to sell
    if (this.shopMode === 'sell' && this.openPanels.has('shop') && document.querySelector('.shop')) {
      this.renderShop(this.lastShop ?? { id: null, name: 'ขายของ', stock: [] }, 'sell');
    }
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
      if (it.refine) { node.append(el('span', 'plus', '+' + it.refine)); markRefine(node, it.refine); }
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
    if (it.refine) markRefine(ico, it.refine);
    const meta = el('div');
    meta.append(title);
    const auraTier = glowTier(it.refine ?? 0);
    if (auraTier) {
      const line = el('div', '', `✦ ออร่า${auraTier.name}`);
      line.style.color = glowCss(it.refine, 1);
      line.style.fontSize = '12px';
      meta.append(line);
    }
    // A weapon's look is four independent things (see shared/refineglow.js);
    // the tooltip says all of them, because a player who cannot tell why
    // their sword is glowing green has a mystery, not a feature.
    const sig = signatureOf(it);
    if (sig) {
      const line = el('div', '', `❖ ${SIGNATURES[sig].nameTh}`);
      line.style.color = `rgb(${SIGNATURES[sig].color.join(',')})`;
      line.style.fontSize = '12px';
      meta.append(line);
    }
    const marks = specialMarks(it);
    if (marks.length) {
      const line = el('div', '', marks.map((m) => `◆ ${SPECIAL_MARKS[m].nameTh}`).join(' '));
      line.style.color = `rgb(${SPECIAL_MARKS[marks[0]].color.join(',')})`;
      line.style.fontSize = '12px';
      meta.append(line);
    }
    meta.append(el('div', 'muted', [
      { weapon: 'อาวุธ', armor: 'เกราะ', consumable: 'ของใช้', material: 'วัตถุดิบ', ammo: 'กระสุน' }[it.type] ?? '',
      WEAPON_CLASSES[it.wclass]?.nameTh ?? it.wclass,
      it.twoHanded ? 'สองมือ' : '',
      it.level ? `ต้องเลเวล ${it.level}` : '',
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
    // `act` names the painted button the ember theme swaps in for the text
    const add = (label, fn, cls = 'btn', act = null) => {
      const b = el('button', cls + (act ? ` act act-${act}` : ''), label);
      if (act) b.setAttribute('aria-label', label);
      b.addEventListener('click', fn);
      box.append(b);
    };
    if (it.type === 'weapon' || it.type === 'armor') {
      if (it.equipped) add('ถอด', () => this.game.net.send({ t: 'unequip', slot: it.equipped }), 'btn', 'unequip');
      else add('สวมใส่', () => this.game.net.send({ t: 'equip', index: it.i }), 'btn primary', 'equip');
    }
    if (it.type === 'consumable') add('ใช้', () => { this.game.audio?.play('potion'); this.game.net.send({ t: 'useItem', index: it.i }); }, 'btn primary', 'use');
    add('ทิ้ง', () => {
      if (confirm(`ทิ้ง ${it.name} ?`)) this.game.net.send({ t: 'dropItem', index: it.i, qty: it.qty });
    }, 'btn danger', 'drop');
    return box;
  }

  useInvItem(it) {
    if (it.type === 'consumable') { this.game.audio?.play('potion'); this.game.net.send({ t: 'useItem', index: it.i }); }
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
  /**
   * The quest log: tabs by kind, a list on the left, and the chosen quest on
   * a parchment on the right with what it asks, what it pays and one button
   * for whatever the next step is.
   */
  openQuests(quests) {
    this.lastQuests = quests;
    const tracked = new Map((this.trackedQuests ?? []).map((q) => [q.id, q]));
    const all = (quests ?? []).map((q) => {
      const active = q.state && !q.state.done;
      const done = active && q.progress.every((p) => p.have >= p.need);
      return { ...q, kind: questKind(q), active, done: done || !!tracked.get(q.id)?.done };
    });
    const tab = this.questTab ?? 'all';
    const wrap = el('div', 'qlog');

    const tabs = el('div', 'qlog-tabs');
    for (const [key, label] of [['all', 'ทั้งหมด'], ['main', 'หลัก'], ['sub', 'รอง'], ['daily', 'รายวัน'], ['event', 'กิจกรรม']]) {
      const n = key === 'all' ? all.length : all.filter((q) => q.kind === key).length;
      const b = el('button', 'qlog-tab' + (tab === key ? ' on' : ''), `${label} <span class="num">${n}</span>`);
      b.addEventListener('click', () => { this.questTab = key; this.openQuests(this.lastQuests); });
      tabs.append(b);
    }
    wrap.append(tabs);

    const body = el('div', 'qlog-body');
    const list = el('div', 'qlog-list');
    // work in hand first, finished work at the very top
    const shown = all.filter((q) => tab === 'all' || q.kind === tab)
      .sort((a, b) => (b.done - a.done) || (b.active - a.active) || ((a.minLevel ?? 1) - (b.minLevel ?? 1)));
    if (!shown.length) list.append(el('div', 'muted', 'ยังไม่มีภารกิจในหมวดนี้'));
    const sel = shown.find((q) => q.id === this.questSel) ?? shown[0];
    for (const q of shown) {
      const row = el('div', 'qlog-row' + (q === sel ? ' sel' : ''));
      const ico = el('img', 'qlog-ico');
      ico.src = `${UI_BASE}/qk_${q.kind}.webp`;
      ico.alt = '';
      const text = el('div', 'qlog-text');
      text.append(el('div', 'qlog-name q-' + q.kind, `[${KIND_TH[q.kind]}] ${esc(q.name)}`));
      text.append(el('div', 'muted', `Lv. ${q.minLevel ?? 1} · ${q.active
        ? q.progress.map((p) => `${fmt(Math.min(p.have, p.need))}/${fmt(p.need)}`).join(' · ') : 'ยังไม่รับ'}`));
      const state = el('img', 'qlog-state');
      state.src = `${UI_BASE}/mark_${q.done ? 'ready' : q.active ? 'progress' : q.kind}.webp`;
      state.alt = q.done ? 'พร้อมส่ง' : q.active ? 'กำลังทำ' : 'ใหม่';
      row.append(ico, text, state);
      row.addEventListener('click', () => { this.questSel = q.id; this.openQuests(this.lastQuests); });
      list.append(row);
    }
    body.append(list);
    if (sel) body.append(this.questDetail(sel));
    wrap.append(body);
    return this.panel('quests', 'ภารกิจ', wrap);
  }

  questDetail(q) {
    const card = el('div', 'qlog-detail');
    card.append(el('div', 'qd-title', `[${KIND_TH[q.kind]}] ${esc(q.name)}`));
    const meta = [`Lv. ${q.minLevel ?? 1}+`, q.zone ? ZONE_NAMES[q.zone] ?? q.zone : '',
      q.repeatable ? (q.repeatable === 'daily' ? 'ทำได้ทุกวัน' : 'ทำได้ทุกสัปดาห์') : ''].filter(Boolean).join(' · ');
    card.append(el('div', 'qd-meta', esc(meta)));
    card.append(el('p', 'qd-desc', esc(q.desc)));

    card.append(el('div', 'qd-head', 'เป้าหมาย'));
    q.objectives.forEach((o, i) => {
      const pr = q.progress[i] ?? { have: 0, need: o.count };
      const ok = q.active && pr.have >= pr.need;
      const what = o.type === 'kill' ? `ล่า ${MONSTERS[o.mob]?.nameTh ?? MONSTERS[o.mob]?.name ?? o.mob}`
        : o.type === 'collect' ? `เก็บ ${ITEMS[o.item]?.nameTh ?? o.item}`
        : o.type === 'level' ? 'ไปให้ถึงเลเวล' : o.type === 'jobLevel' ? 'ไปให้ถึง Job Level'
        : o.type === 'refine' ? 'ตีบวกอุปกรณ์ถึง +' : o.type;
      const line = el('div', 'qd-obj' + (ok ? ' ok' : ''));
      line.textContent = `${ok ? '✔' : '◆'} ${what} (${fmt(q.active ? Math.min(pr.have, pr.need) : 0)}/${fmt(pr.need)})`;
      card.append(line);
    });

    card.append(el('div', 'qd-head', 'รางวัล'));
    const rewards = el('div', 'qd-rewards');
    const tile = (pic, label, node = null) => {
      const t = el('div', 'qd-tile');
      if (pic) { const i = el('img'); i.src = `${UI_BASE}/${pic}.webp`; i.alt = ''; t.append(i); }
      if (node) t.append(node);
      t.append(el('span', 'num', label));
      rewards.append(t);
    };
    const r = q.rewards ?? {};
    if (r.exp) tile('rw_exp', fmt(r.exp));
    if (r.jobExp) tile('rw_book', `Job ${fmt(r.jobExp)}`);
    if (r.aurum) tile('rw_coin', fmt(r.aurum));
    if (r.skillPoints) tile('rw_crest', `+${r.skillPoints} สกิล`);
    for (const it of r.items ?? []) {
      const s = el('div', 'slot rarity-' + (ITEMS[it.id]?.rarity ?? 'common'));
      s.append(itemIcon(it.id, { size: 28 }));
      s.title = ITEMS[it.id]?.nameTh ?? it.id;
      tile(null, `x${fmt(it.qty ?? 1)}`, s);
    }
    if (r.unlock) tile('rw_gift', 'ปลดล็อก');
    card.append(rewards);

    const acts = el('div', 'qd-actions');
    const btn = (cls, label, fn) => {
      const b = el('button', `btn qbtn2 ${cls}`, label);
      b.setAttribute('aria-label', label);
      b.addEventListener('click', fn);
      acts.append(b);
    };
    if (!q.active) {
      btn('qb-accept primary', 'รับเควส', () => this.game.net.send({ t: 'quest', cmd: 'accept', id: q.id }));
    } else if (q.done) {
      btn('qb-turnin primary', 'ส่งมอบ', () => this.game.net.send({ t: 'quest', cmd: 'complete', id: q.id }));
      btn('qb-navigate', 'นำทาง', () => { this.game.startQuestNav({ ...q, done: true }); this.close('quests'); });
    } else if (this.game.nav?.questId === q.id) {
      btn('qb-stop danger', 'ยกเลิก', () => { this.game.startQuestNav(q); this.openQuests(this.lastQuests); });
    } else {
      btn('qb-navigate', 'นำทาง', () => { this.game.startQuestNav({ ...q, done: false }); this.close('quests'); });
    }
    card.append(acts);
    return card;
  }

  /* ---------------- party & friends ---------------- */
  /** One window, three tabs: the party, your friends, and the way to the guild. */
  openParty(state) {
    this.lastParty = state ?? this.lastParty;
    const tab = this.socialTab ?? 'party';
    const wrap = el('div', 'social');
    const tabs = el('div', 'social-tabs');
    for (const [key, label, pic] of [['party', 'ปาร์ตี้', 'fa_group'], ['friends', 'เพื่อน', 'menu_party'], ['guild', 'กิลด์', 'menu_guild']]) {
      const b = el('button', 'social-tab' + (tab === key ? ' on' : ''));
      const i = el('img'); i.src = `${UI_BASE}/${pic}.webp`; i.alt = '';
      b.append(i, el('span', '', label));
      const reqs = key === 'friends' ? (this.lastFriends?.requests?.length ?? 0) : 0;
      if (reqs) b.append(el('b', 'social-badge num', String(reqs)));
      b.addEventListener('click', () => {
        if (key === 'guild') { this.close('party'); return this.open('guild'); }
        this.socialTab = key;
        if (key === 'friends') this.game.net.send({ t: 'friend', cmd: 'state' });
        this.openParty();
      });
      tabs.append(b);
    }
    wrap.append(tabs, tab === 'friends' ? this.friendsPane() : this.partyPane());
    return this.panel('party', tab === 'friends' ? 'เพื่อน' : 'ปาร์ตี้', wrap);
  }

  partyPane() {
    const state = this.lastParty;
    const pt = state?.party;
    const me = myCharId(pt, this.game.state.myId);
    const box = el('div', 'grid');
    if (state?.invite) box.append(this.inviteCard('party', state.invite));
    if (pt) {
      const lead = String(pt.leader) === me;
      box.append(el('div', 'row', `<b>${esc(pt.name)}</b><span class="muted">${pt.members.length}/6 คน · EXP รวม +${(pt.members.length - 1) * 10}%</span>`));
      for (const m of pt.members) {
        const row = el('div', 'pmember' + (m.online ? '' : ' off'));
        row.append(memberFace(m, String(pt.leader) === String(m.charId)));
        const info = el('div', 'pm-info');
        const top = el('div', 'pm-top');
        top.append(el('span', 'muted num', `Lv.${m.level}`), el('b', '', esc(m.name)));
        top.append(roleIcon(m.job));
        info.append(top);
        if (m.online) {
          info.append(bar('hp', m.hp, m.maxHp), bar('sp', m.sp, m.maxSp));
          info.append(el('div', 'muted pm-where', esc(ZONE_NAMES[m.map] ?? m.map ?? '')));
        } else info.append(el('div', 'muted', 'ออฟไลน์'));
        row.append(info);
        if (lead && String(m.charId) !== me) {
          const acts = el('div', 'pm-acts');
          acts.append(this.sheetBtn('pb-lead', 'ตั้งหัวหน้าทีม', () => this.game.net.send({ t: 'party', cmd: 'promote', charId: m.charId })));
          acts.append(this.sheetBtn('pb-kick', 'เตะออก', () => {
            if (confirm(`เชิญ ${m.name} ออกจากปาร์ตี้?`)) this.game.net.send({ t: 'party', cmd: 'kick', charId: m.charId });
          }));
          row.append(acts);
        }
        box.append(row);
      }
    } else {
      box.append(el('div', 'muted', 'ยังไม่ได้อยู่ปาร์ตี้ · ปาร์ตี้ได้ EXP รวม +10% ต่อสมาชิกหนึ่งคน (ต้องอยู่ในระยะ)'));
      box.append(this.sheetBtn('pb-create', 'สร้างปาร์ตี้', () => this.game.net.send({ t: 'party', cmd: 'create' })));
    }
    const form = el('div', 'social-form');
    const input = this.nameInput('ชื่อผู้เล่นที่จะเชิญ');
    form.append(input, this.sheetBtn('pb-invite', 'เชิญ', () => {
      if (input.value.trim()) this.game.net.send({ t: 'party', cmd: 'invite', name: input.value.trim() });
      input.value = '';
    }));
    box.append(form);
    const foot = el('div', 'opts');
    if (pt) {
      const leave = el('button', 'btn danger', 'ออกจากปาร์ตี้');
      leave.addEventListener('click', () => this.game.net.send({ t: 'party', cmd: 'leave' }));
      foot.append(leave);
    }
    const trade = el('button', 'btn', 'เทรดกับผู้เล่นใกล้ๆ');
    trade.addEventListener('click', () => this.openTradePicker());
    foot.append(trade);
    box.append(foot);
    return box;
  }

  friendsPane() {
    const fs = this.lastFriends ?? { friends: [], blocked: [], requests: [] };
    const sub = this.friendTab ?? 'list';
    const box = el('div', 'grid');
    const tabs = el('div', 'qlog-tabs');
    for (const [key, label, n] of [['list', 'เพื่อนของฉัน', fs.friends.length], ['add', 'เพิ่มเพื่อน', null],
      ['requests', 'คำร้องขอ', fs.requests.length], ['blocked', 'บล็อก', fs.blocked.length]]) {
      const b = el('button', 'qlog-tab' + (sub === key ? ' on' : ''), `${label}${n != null ? ` <span class="num">${n}</span>` : ''}`);
      b.addEventListener('click', () => { this.friendTab = key; this.openParty(); });
      tabs.append(b);
    }
    box.append(tabs);
    const act = (pic, title, fn) => {
      const b = el('button', 'btn fa-btn');
      b.title = title;
      b.setAttribute('aria-label', title);
      const i = el('img'); i.src = `${UI_BASE}/${pic}.webp`; i.alt = '';
      b.append(i);
      b.addEventListener('click', fn);
      return b;
    };
    if (sub === 'list') {
      if (!fs.friends.length) box.append(el('div', 'muted', 'ยังไม่มีเพื่อน — เพิ่มจากแท็บ "เพิ่มเพื่อน"'));
      for (const f of fs.friends) {
        const row = el('div', 'frow' + (f.online ? '' : ' off'));
        const dot = el('img', 'fdot'); dot.src = `${UI_BASE}/dot_${f.online ? (f.party ? 'busy' : 'online') : 'offline'}.webp`; dot.alt = '';
        const info = el('div', 'fr-info');
        info.append(el('b', '', esc(f.name)), el('div', 'muted num', `Lv.${f.level} ${JOBS[f.job]?.nameTh ?? ''}`));
        const st = el('div', 'fr-state ' + (f.online ? 'on' : ''), f.online
          ? (f.party ? 'อยู่ในปาร์ตี้' : 'ออนไลน์') + (f.map ? ` · ${esc(ZONE_NAMES[f.map] ?? f.map)}` : '')
          : `ออฟไลน์${f.lastSeen ? ` · ${ago(f.lastSeen)}` : ''}`);
        const acts = el('div', 'fr-acts');
        if (f.online) {
          acts.append(act('fa_whisper', 'กระซิบ', () => this.startWhisper(f.name)));
          acts.append(act('fa_group', 'เชิญเข้าปาร์ตี้', () => this.game.net.send({ t: 'party', cmd: 'invite', name: f.name })));
        }
        acts.append(act('fa_remove', 'ลบเพื่อน', () => {
          if (confirm(`ลบ ${f.name} ออกจากรายชื่อเพื่อน?`)) this.game.net.send({ t: 'friend', cmd: 'remove', charId: f.charId });
        }));
        acts.append(act('fa_block', 'บล็อก', () => {
          if (confirm(`บล็อก ${f.name}? จะไม่เห็นข้อความและคำเชิญจากผู้เล่นคนนี้`)) this.game.net.send({ t: 'friend', cmd: 'block', name: f.name });
        }));
        row.append(dot, info, st, acts);
        box.append(row);
      }
    } else if (sub === 'add') {
      const form = el('div', 'social-form');
      const input = this.nameInput('ชื่อผู้เล่น (ต้องออนไลน์อยู่)');
      const go = el('button', 'btn primary', 'เพิ่มเพื่อน');
      go.addEventListener('click', () => {
        if (input.value.trim()) this.game.net.send({ t: 'friend', cmd: 'request', name: input.value.trim() });
        input.value = '';
      });
      form.append(input, go);
      box.append(form, el('div', 'muted', `เพิ่มได้สูงสุด 50 คน · กระซิบหาใครก็ได้ด้วยการพิมพ์ /w ชื่อ ข้อความ ในช่องแชท`));
      // people standing nearby are the easiest to add
      const near = [...this.game.entities.values()].filter((e) => e.k === 'p' && e.id !== this.game.state.myId && e.n);
      const known = new Set(fs.friends.map((f) => f.name));
      for (const e of near.filter((e) => !known.has(e.n)).slice(0, 6)) {
        const row = el('div', 'row');
        row.append(el('span', '', `${esc(e.n)} <span class="muted">อยู่ใกล้ๆ</span>`));
        const b = el('button', 'btn', 'เพิ่ม');
        b.addEventListener('click', () => this.game.net.send({ t: 'friend', cmd: 'request', name: e.n }));
        row.append(b);
        box.append(row);
      }
    } else if (sub === 'requests') {
      if (!fs.requests.length) box.append(el('div', 'muted', 'ไม่มีคำร้องขอค้างอยู่'));
      for (const r of fs.requests) box.append(this.inviteCard('friend', r));
    } else {
      if (!fs.blocked.length) box.append(el('div', 'muted', 'ยังไม่ได้บล็อกใคร'));
      for (const b of fs.blocked) {
        const row = el('div', 'row');
        row.append(el('span', '', esc(b.name)));
        const un = el('button', 'btn', 'ปลดบล็อก');
        un.addEventListener('click', () => this.game.net.send({ t: 'friend', cmd: 'unblock', charId: b.charId }));
        row.append(un);
        box.append(row);
      }
      const form = el('div', 'social-form');
      const input = this.nameInput('ชื่อผู้เล่นที่จะบล็อก');
      const go = el('button', 'btn danger', 'บล็อก');
      go.addEventListener('click', () => {
        if (input.value.trim()) this.game.net.send({ t: 'friend', cmd: 'block', name: input.value.trim() });
        input.value = '';
      });
      form.append(input, go);
      box.append(form);
    }
    return box;
  }

  /** The crested invitation card: a party invite or a friend request. */
  inviteCard(kind, d) {
    const card = el('div', 'invite-card');
    const crest = el('img', 'invite-crest'); crest.src = `${UI_BASE}/invite_crest.webp`; crest.alt = '';
    card.append(crest, el('div', 'invite-title', kind === 'party' ? 'คำเชิญเข้าปาร์ตี้' : 'คำขอเป็นเพื่อน'));
    const body = el('div', 'invite-body');
    body.append(memberFace({ name: d.from }, false));
    const t = el('div');
    t.append(el('b', '', esc(d.from)), el('div', 'muted', kind === 'party' ? 'ต้องการเชิญคุณเข้าร่วมปาร์ตี้' : 'ต้องการเพิ่มคุณเป็นเพื่อน'));
    body.append(t);
    card.append(body);
    const acts = el('div', 'deal-actions');
    const yes = el('button', 'btn primary', 'ยอมรับ');
    const no = el('button', 'btn danger', 'ปฏิเสธ');
    const done = () => { card.remove(); if (this._popCard === card) this._popCard = null; };
    yes.addEventListener('click', () => {
      done();
      if (kind === 'party') this.game.net.send({ t: 'party', cmd: 'accept' });
      else this.game.net.send({ t: 'friend', cmd: 'accept', charId: d.charId });
    });
    no.addEventListener('click', () => {
      done();
      if (kind === 'party') this.game.net.send({ t: 'party', cmd: 'decline' });
      else this.game.net.send({ t: 'friend', cmd: 'decline', charId: d.charId });
    });
    acts.append(yes, no);
    card.append(acts);
    return card;
  }

  /** Pop an invitation over the game, unless the social window already shows it. */
  popInvite(kind, d) {
    if (this.openPanels.has('party')) return this.openParty();
    this._popCard?.remove();
    const card = this.inviteCard(kind, d);
    card.classList.add('pop');
    document.body.append(card);
    this._popCard = card;
    this.game.audio?.play('warn');
    clearTimeout(this._popT);
    this._popT = setTimeout(() => { if (this._popCard === card) { card.remove(); this._popCard = null; } }, 30000);
  }

  setFriends(m) {
    const before = new Set((this.lastFriends?.requests ?? []).map((r) => r.charId));
    this.lastFriends = m;
    const fresh = (m.requests ?? []).find((r) => !before.has(r.charId));
    if (fresh) this.popInvite('friend', fresh);
    if (this.openPanels.has('party')) this.openParty();
  }

  startWhisper(name) {
    this.close('party');
    const input = $('#chat-input');
    input.value = `/w ${name} `;
    input.focus();
  }

  /** Small party frames down the left of the HUD: everyone but you. */
  renderPartyFrames() {
    const box = $('#party-frames');
    if (!box) return;
    const pt = this.lastParty?.party;
    const me = myCharId(pt, this.game.state.myId);
    const others = (pt?.members ?? []).filter((m) => String(m.charId) !== me);
    document.body.classList.toggle('in-party', others.length > 0);
    box.classList.toggle('hidden', !others.length);
    box.innerHTML = '';
    for (const m of others) {
      const row = el('div', 'pf' + (m.online ? '' : ' off'));
      row.append(memberFace(m, String(pt.leader) === String(m.charId)));
      const info = el('div', 'pf-info');
      const top = el('div', 'pf-top');
      top.append(el('span', 'num', `Lv.${m.level}`), el('b', '', esc(m.name)), roleIcon(m.job));
      info.append(top);
      if (m.online) info.append(bar('hp', m.hp, m.maxHp), bar('sp', m.sp, m.maxSp));
      else info.append(el('div', 'muted', 'ออฟไลน์'));
      row.append(info);
      // tap a frame to target them - how a healer picks who to mend
      if (m.online && m.id) row.addEventListener('click', () => {
        this.game.state.targetId = m.id;
        this.game.net.send({ t: 'target', id: m.id });
      });
      box.append(row);
    }
    const rows = box.children.length;
    document.documentElement.style.setProperty('--pf-h', rows ? `${box.offsetHeight + 6}px` : '0px');
  }

  sheetBtn(cls, label, fn) {
    const b = el('button', `btn sheet-btn ${cls}`, label);
    b.setAttribute('aria-label', label);
    b.addEventListener('click', fn);
    return b;
  }

  nameInput(placeholder) {
    const input = el('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.addEventListener('focus', () => { this.game.input.textMode = true; });
    input.addEventListener('blur', () => { this.game.input.textMode = false; });
    return input;
  }

  /* ---------------- guild ---------------- */

  /**
   * The guild window. A party window is a list of six names; a guild window
   * has to carry the things that make a guild last - who is on, who can be
   * trusted with the vault, what the dues are, and what has been happening
   * while you were away.
   */
  openGuild(state) {
    this.lastGuild = state ?? this.lastGuild;
    const st = this.lastGuild;
    const wrap = el('div', 'grid');
    const send = (cmd, extra = {}) => this.game.net.send({ t: 'guild', cmd, ...extra });

    if (st?.invite) {
      const row = el('div', 'row');
      row.innerHTML = `<span>${esc(st.invite.from)} ชวนคุณเข้ากิลด์</span>`;
      const b = el('button', 'btn primary', 'ตอบรับ');
      b.addEventListener('click', () => send('accept'));
      row.append(b);
      wrap.append(row);
    }

    // The fortress reads the same whether or not you are in a guild: knowing
    // who holds it and when it can next be taken is half the reason to join one.
    if (st?.siege) {
      const s = st.siege;
      const box = el('div', 'row');
      const held = s.owner ? `<b>${esc(s.owner.name)}</b> ถือป้อมอยู่` : 'ยังไม่มีกิลด์ไหนถือป้อม';
      const when = s.open
        ? `<b style="color:var(--warn,#e8a33d)">ศึกกำลังเปิด</b>${s.holder ? ` · กำลังยึด ${Math.round(100 * s.progress / s.need)}%` : ''}`
        : `ศึกครั้งถัดไป ${new Date(s.nextAt).toLocaleString('th-TH', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`;
      box.innerHTML = `<span>🏰 ลานประลองเถ้า · ${held}<br><span class="muted">${when} · ผู้ถือป้อมไม่ต้องจ่ายค่าบำรุงสัปดาห์นั้น</span></span>`;
      wrap.append(box);
    }

    const g = st?.guild;
    if (!g) {
      wrap.append(el('div', 'muted',
        `ยังไม่ได้อยู่กิลด์ · กิลด์อยู่ข้ามวันข้ามสัปดาห์ ไม่เหมือนปาร์ตี้ที่อยู่แค่รอบเดียว<br>
         ค่าก่อตั้ง <b>${(st?.cost ?? 0).toLocaleString()}</b> ออรัม และมีค่าบำรุงรายสัปดาห์`));
      const form = el('div', 'row');
      const input = el('input');
      input.type = 'text';
      input.placeholder = 'ชื่อกิลด์ที่จะก่อตั้ง';
      input.maxLength = 24;
      this.textInput(input);
      const b = el('button', 'btn primary', 'ก่อตั้งกิลด์');
      b.addEventListener('click', () => {
        if (input.value.trim()) send('create', { name: input.value.trim() });
      });
      form.append(input, b);
      wrap.append(form);
      return this.panel('guild', 'กิลด์', wrap);
    }

    const myRank = st.ranks?.find((r) => r.id === g.myRank);
    const canInvite = ['veteran', 'officer', 'leader'].includes(g.myRank);
    const canKick = ['officer', 'leader'].includes(g.myRank);
    const isLeader = g.myRank === 'leader';

    /* --- the header: name, purse, dues --- */
    const head = el('div', 'grid');
    head.append(el('div', 'row',
      `<b>${esc(g.name)}</b><span class="muted">${g.members.length} คน · ยศของคุณ: ${esc(myRank?.nameTh ?? g.myRank)}</span>`));
    const days = Math.max(0, Math.ceil((g.upkeepDue - Date.now()) / 86400000));
    head.append(el('div', 'row',
      `<span class="muted">คลังกลาง</span><span class="num"><b>${(g.aurum ?? 0).toLocaleString()}</b> ออรัม</span>`));
    head.append(el('div', 'row',
      `<span class="muted">ค่าบำรุงรายสัปดาห์</span><span class="${g.inDebt ? 'rarity-legendary' : 'num'}">${
        g.inDebt ? 'ค้างจ่าย — คลังถูกล็อก' : `${g.upkeep.toLocaleString()} ออรัม · อีก ${days} วัน`}</span>`));
    wrap.append(head);

    if (g.notice) wrap.append(el('div', 'job-trial', esc(g.notice)));

    /* --- donating: the only way aurum gets into the purse --- */
    const give = el('div', 'row');
    const amount = el('input');
    amount.type = 'number';
    amount.min = '1';
    amount.placeholder = 'จำนวนออรัม';
    this.textInput(amount);
    const giveBtn = el('button', 'btn', 'บริจาคเข้าคลัง');
    giveBtn.addEventListener('click', () => {
      const n = Math.floor(Number(amount.value));
      if (n > 0) send('donate', { amount: n });
      amount.value = '';
    });
    give.append(amount, giveBtn);
    wrap.append(give);

    /* --- members --- */
    const roster = el('div', 'grid');
    roster.append(el('div', 'muted', 'สมาชิก'));
    for (const m of g.members) {
      const row = el('div', 'row');
      const rank = st.ranks?.find((r) => r.id === m.rank);
      row.innerHTML = `<span>${m.online ? '🟢' : '⚫'} ${esc(m.name)}
        <span class="muted">Lv.${m.level} ${esc(JOBS[m.job]?.nameTh ?? '')}</span></span>
        <span class="muted">${esc(rank?.nameTh ?? m.rank)}${m.online && m.map ? ` · ${esc(MAPS[m.map]?.nameTh ?? m.map)}` : ''}</span>`;
      const tools = el('div', 'opts');
      if (isLeader && m.rank !== 'leader') {
        const sel = el('select');
        for (const r of st.ranks) {
          if (r.id === 'leader') continue;
          const o = document.createElement('option');
          o.value = r.id; o.textContent = r.nameTh;
          if (r.id === m.rank) o.selected = true;
          sel.append(o);
        }
        sel.addEventListener('change', () => send('rank', { charId: m.charId, rank: sel.value }));
        tools.append(sel);
        const hand = el('button', 'btn ghost', 'โอนหัวหน้า');
        hand.addEventListener('click', () => send('rank', { charId: m.charId, rank: 'leader' }));
        tools.append(hand);
      }
      if (canKick && m.rank !== 'leader' && m.charId !== g.myCharId) {
        const k = el('button', 'btn danger', 'เชิญออก');
        k.addEventListener('click', () => send('kick', { charId: m.charId }));
        tools.append(k);
      }
      if (tools.childNodes.length) row.append(tools);
      roster.append(row);
    }
    wrap.append(roster);

    /* --- the vault, and what your rank may take from it --- */
    const vault = el('div', 'grid');
    const allowance = g.myAllowance < 0 ? 'ไม่จำกัด' : `${g.myTaken}/${g.myAllowance} ชิ้นในสัปดาห์นี้`;
    vault.append(el('div', 'row', `<span class="muted">คลังกิลด์</span><span class="muted">เบิกได้ ${allowance}</span>`));
    const grid = el('div', 'slot-grid');
    for (const it of g.vault) {
      const node = el('button', 'slot');
      node.append(itemIcon(it.id, { size: 30 }));
      if (it.qty > 1) node.append(el('span', 'qty', String(it.qty)));
      if (it.refine) node.append(el('span', 'plus', '+' + it.refine));
      node.title = `${ITEMS[it.id]?.nameTh ?? it.id} x${it.qty}`;
      node.addEventListener('click', () => send('vault', { dir: 'out', index: it.i, qty: 1 }));
      grid.append(node);
    }
    if (!g.vault.length) grid.append(el('div', 'muted', 'คลังว่าง'));
    vault.append(grid);
    const dep = el('button', 'btn', 'ฝากของจากกระเป๋า');
    dep.addEventListener('click', () => this.openGuildDeposit());
    vault.append(dep);
    wrap.append(vault);

    /* --- what happened while you were away --- */
    if (g.history?.length) {
      const log = el('div', 'grid');
      log.append(el('div', 'muted', 'ความเคลื่อนไหวล่าสุด'));
      for (const h of g.history.slice(0, 8)) {
        log.append(el('div', 'qprog', esc(h.text)));
      }
      wrap.append(log);
    }

    /* --- footer --- */
    const foot = el('div', 'row');
    if (canInvite) {
      const input = el('input');
      input.type = 'text';
      input.placeholder = 'ชื่อผู้เล่นที่จะชวน';
      this.textInput(input);
      const b = el('button', 'btn primary', 'ชวน');
      b.addEventListener('click', () => {
        if (input.value.trim()) send('invite', { name: input.value.trim() });
        input.value = '';
      });
      foot.append(input, b);
    }
    wrap.append(foot);

    if (isLeader) {
      const nrow = el('div', 'row');
      const ni = el('input');
      ni.type = 'text';
      ni.placeholder = 'ประกาศของกิลด์';
      ni.value = g.notice ?? '';
      ni.maxLength = 200;
      this.textInput(ni);
      const nb = el('button', 'btn', 'บันทึกประกาศ');
      nb.addEventListener('click', () => send('notice', { text: ni.value }));
      nrow.append(ni, nb);
      wrap.append(nrow);
    }

    const leave = el('button', 'btn danger', 'ออกจากกิลด์');
    leave.addEventListener('click', () => send('leave'));
    wrap.append(leave);

    return this.panel('guild', 'กิลด์', wrap);
  }

  /** Pick something out of the bag to put in the vault. */
  openGuildDeposit() {
    const wrap = el('div', 'grid');
    wrap.append(el('div', 'muted', 'เลือกของที่จะฝากเข้าคลังกิลด์'));
    const grid = el('div', 'slot-grid');
    for (const it of this.game.inventory.items ?? []) {
      const node = el('button', 'slot');
      node.append(itemIcon(it.id, { size: 30 }));
      if ((it.qty ?? 1) > 1) node.append(el('span', 'qty', String(it.qty)));
      node.title = `${ITEMS[it.id]?.nameTh ?? it.id} x${it.qty ?? 1}`;
      node.addEventListener('click', () => {
        this.game.net.send({ t: 'guild', cmd: 'vault', dir: 'in', index: it.i, qty: it.qty ?? 1 });
        this.close('guildDeposit');
      });
      grid.append(node);
    }
    if (!grid.childNodes.length) grid.append(el('div', 'muted', 'กระเป๋าว่าง'));
    wrap.append(grid);
    return this.panel('guildDeposit', 'ฝากเข้าคลังกิลด์', wrap);
  }

  /** Wire an input so typing in it does not drive the character. */
  textInput(node) {
    node.addEventListener('focus', () => { this.game.input.textMode = true; });
    node.addEventListener('blur', () => { this.game.input.textMode = false; });
    return node;
  }

  /* ---------------- NPC ---------------- */
  openDialog(d) {
    const wrap = el('div', 'dlg');
    const top = el('div', 'dlg-top');
    const face = NPC_FACES[d.npcId] ?? NPC_FACES[d.role];
    if (face) {
      const img = el('img', 'dlg-face');
      img.src = `${UI_BASE}/${face}.webp`;
      img.alt = d.name;
      top.append(img);
    }
    const box = el('div', 'dlg-box');
    box.append(el('div', 'dlg-name', esc(d.name)), el('div', 'dlg-text', esc(d.greet)));
    top.append(box);
    wrap.append(top);

    const choices = el('div', 'dlg-choices');
    const choice = (label, fn, mark = null) => {
      const b = el('button', 'dlg-choice');
      b.append(el('span', '', esc(label)));
      if (mark) {
        const m = el('img', 'dlg-mark');
        m.src = `${UI_BASE}/mark_${mark}.webp`;
        m.alt = '';
        b.append(m);
      }
      b.addEventListener('click', fn);
      choices.append(b);
    };
    // what this person has for you comes first: work to hand in, then new work
    const theirs = (q) => (GIVER_ROLE[q.giver] ?? q.giver) === d.role;
    for (const q of (this.trackedQuests ?? []).filter((q) => q.done && theirs(q))) {
      choice(`ส่งภารกิจ: ${q.name}`, () => {
        this.close('dialog');
        this.game.net.send({ t: 'quest', cmd: 'complete', id: q.id });
      }, 'ready');
    }
    for (const q of (this.lastQuests ?? []).filter((q) => (!q.state || q.state.done) && theirs(q)).slice(0, 3)) {
      choice(`ภารกิจใหม่: ${q.name}`, () => {
        this.close('dialog');
        this.questSel = q.id;
        this.open('quests');
      }, questKind(q));
    }
    for (const o of d.options ?? []) {
      choice(o.label, () => {
        this.close('dialog');
        if (o.action === 'jobChange') return this.openJobChange();
        if (o.action === 'quests') this.wantQuests = true;   // the answer opens the log
        this.game.net.send({ t: 'npcAction', action: o.action, shop: o.shop });
      });
    }
    choice('ไว้ก่อน ขอตัวก่อน', () => this.close('dialog'));
    wrap.append(choices);
    return this.panel('dialog', d.name, wrap);
  }

  /**
   * Choosing a path is the biggest decision a character makes, so the window
   * says what each one actually plays like - not just its stat block - and
   * shows the trial that pays extra for taking it.
   */
  openJobChange() {
    const self = this.game.self;
    const job = JOBS[self.job];
    const need = job.advance ?? { jobLevel: job.jobLevelToAdvance ?? 10 };
    const quests = this.lastQuests ?? [];
    const wrap = el('div', 'grid');

    const met = (!need.level || self.level >= need.level)
      && (!need.jobLevel || self.jobLevel >= need.jobLevel);
    const req = [
      need.level ? `เลเวล ${need.level}` : null,
      need.jobLevel ? `Job Level ${need.jobLevel}` : null,
    ].filter(Boolean).join(' และ ');
    const head = el('div', met ? '' : 'muted',
      met ? `✔ คุณพร้อมเลือกทางแล้ว (ต้องการ${req})`
        : `ยังไม่ถึงเกณฑ์: ต้องการ${req} — ตอนนี้เลเวล ${self.level} / Job ${self.jobLevel}`);
    head.style.color = met ? 'var(--good)' : '';
    wrap.append(head);
    wrap.append(el('div', 'muted', 'เลือกแล้วเปลี่ยนไม่ได้ (รีเซ็ตสกิลได้ แต่เปลี่ยนสายไม่ได้) · ทุกสายได้ชุดอุปกรณ์เริ่มต้นและสวมให้อัตโนมัติ'));

    for (const nid of job.next ?? []) {
      const n = JOBS[nid];
      const card = el('div', 'job-card');
      const title = el('div', 'job-head');
      title.innerHTML = `<b>${esc(n.nameTh)}</b> <span class="muted">${esc(n.name)}</span>`;
      card.append(title);
      if (n.pitch) card.append(el('div', 'job-pitch', esc(n.pitch)));

      const facts = el('div', 'job-facts');
      const growth = Object.entries(n.growth ?? {})
        .map(([k, v]) => `${k.toUpperCase()} +${v}`).join(' · ');
      const weapons = (n.weapons ?? []).map((w) => ({
        blade: 'ดาบ/มีด', spear: 'หอก', bow: 'ธนู', rod: 'คทา',
      }[w] ?? w)).join(' · ');
      for (const [k, v] of [
        ['เลือด', `${Math.round((n.hpMod ?? 1) * 100)}%`],
        ['มานา', `${Math.round((n.spMod ?? 1) * 100)}%`],
        ['ความเร็ว', `${Math.round((n.speedMod ?? 1) * 100)}%`],
        ['โตทาง', growth || '-'],
        ['อาวุธ', weapons || '-'],
      ]) {
        const row = el('div', 'job-fact');
        row.append(el('span', 'muted', k), el('span', '', v));
        facts.append(row);
      }
      card.append(facts);
      if (n.play) card.append(el('div', 'muted', esc(n.play)));
      if (n.forWho) card.append(el('div', 'job-for', '👤 เหมาะกับคน' + esc(n.forWho)));

      const skills = el('div', 'job-skills');
      for (const sid of (n.skills ?? []).slice(0, 5)) {
        const sk = SKILLS[sid];
        if (!sk) continue;
        const chip = el('span', 'chip');
        chip.append(skillIcon(sid, { size: 18 }));
        chip.append(el('span', '', esc(sk.nameTh ?? sk.name)));
        chip.title = sk.desc ?? '';
        skills.append(chip);
      }
      card.append(skills);

      const kit = (n.starterKit ?? []).map((it) => {
        const def = ITEMS[it.id];
        return `${def?.nameTh ?? it.id}${it.qty > 1 ? ` x${it.qty}` : ''}`;
      }).join(' · ');
      if (kit) card.append(el('div', 'muted', 'ชุดเริ่มต้น: ' + esc(kit)));

      // the trial: optional, but it pays
      const trial = n.trial && quests.find((q) => q.id === n.trial);
      const actions = el('div', 'opts');
      if (trial) {
        const done = trial.state?.done;
        const taken = trial.state && !trial.state.done;
        const prog = (trial.progress ?? []).map((x) => `${x.have}/${x.need}`).join(' · ');
        const line = el('div', done ? 'job-trial done' : 'job-trial',
          done ? `✔ ผ่านบททดสอบ "${esc(trial.name)}" แล้ว — เลือกสายนี้จะได้แต้มสกิลเพิ่ม 1`
            : `บททดสอบ "${esc(trial.name)}" · ${esc(trial.desc)}${taken ? ` — ความคืบหน้า ${prog}` : ' (ไม่บังคับ ทำแล้วได้ของชุดใหญ่ เงิน และแต้มสกิลเพิ่ม)'}`);
        card.append(line);
        if (!done && !taken) {
          const take = el('button', 'btn', 'รับบททดสอบ');
          take.addEventListener('click', () => {
            this.game.net.send({ t: 'quest', cmd: 'accept', id: trial.id });
            this.game.net.send({ t: 'quest', cmd: 'list' });
            setTimeout(() => this.open('jobchange'), 350);
          });
          actions.append(take);
        } else if (taken && (trial.progress ?? []).every((x) => x.have >= x.need)) {
          const claim = el('button', 'btn', 'ส่งบททดสอบ');
          claim.addEventListener('click', () => {
            this.game.net.send({ t: 'quest', cmd: 'complete', id: trial.id });
            this.game.net.send({ t: 'quest', cmd: 'list' });
            setTimeout(() => this.open('jobchange'), 350);
          });
          actions.append(claim);
        }
      }

      const pick = el('button', 'btn primary', 'เลือกทางนี้');
      pick.disabled = !met;
      pick.addEventListener('click', () => this.confirmJob(n));
      actions.append(pick);
      card.append(actions);
      wrap.append(card);
    }

    // the log is what tells us where each trial stands
    this.game.net.send({ t: 'quest', cmd: 'list' });
    return this.panel('jobchange', 'เลือกเส้นทางอาชีพ', wrap);
  }

  /** One last look before a permanent choice. */
  confirmJob(n) {
    const wrap = el('div', 'grid');
    wrap.append(el('div', '', `จะเป็น <b>${esc(n.nameTh)}</b> ใช่ไหม?`));
    wrap.append(el('div', 'muted', 'เปลี่ยนสายภายหลังไม่ได้ · Job Level จะเริ่มนับใหม่ที่ 1 และได้แต้มสกิลเพิ่มทันที'));
    const row = el('div', 'opts');
    const yes = el('button', 'btn primary', 'ยืนยัน');
    yes.addEventListener('click', () => {
      this.game.net.send({ t: 'npcAction', action: 'jobChange', job: n.id });
      this.close('jobconfirm');
      this.close('jobchange');
    });
    const no = el('button', 'btn', 'ขอคิดก่อน');
    no.addEventListener('click', () => this.close('jobconfirm'));
    row.append(yes, no);
    wrap.append(row);
    return this.panel('jobconfirm', 'ยืนยันการเลือกอาชีพ', wrap);
  }

  /** Small reusable picker: a grid of item slots plus a detail pane. */
  itemPicker({ items, onSelect, key = 'picker', empty = 'ไม่มีไอเทม' }) {
    // so a detail card can name the aura without every caller remembering to
    for (const e of items) {
      if (e.refine && e.item && e.item.refine === undefined) e.item = { ...e.item, refine: e.refine };
    }
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
      if (entry.refine) { node.append(el('span', 'plus', '+' + entry.refine)); markRefine(node, entry.refine); }
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
    const tier = glowTier(it.refine ?? 0);
    if (tier) {
      const line = el('div', '', `✦ ออร่า${tier.name} (+${it.refine})`);
      line.style.color = glowCss(it.refine, 1);
      line.style.fontSize = '12px';
      meta.append(line);
    }
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

  /**
   * Socketing, at the smith's bench next to refining - which is where it
   * belongs, because it is the same kind of decision: permanent, and made on
   * one specific object rather than on a type of object.
   */
  openSocket() {
    const wrap = el('div', 'grid');
    wrap.append(el('div', 'muted',
      'การ์ดที่ฝังแล้ว <b>ถอดออกไม่ได้</b> — เลือกของก่อน แล้วเลือกการ์ดที่จะฝัง'));
    const inv = this.game.inventory?.items ?? [];
    const gear = inv.filter((it) => socketsOf(ITEMS[it.id]) > 0);
    const cards = inv.filter((it) => ITEMS[it.id]?.type === 'card');
    if (!cards.length) wrap.append(el('div', 'muted', 'ยังไม่มีการ์ดในกระเป๋า'));

    wrap.append(this.itemPicker({
      key: 'socket',
      items: gear.map((it) => ({ id: it.i, item: it, refine: it.refine })),
      empty: 'ไม่มีของที่ฝังการ์ดได้',
      onSelect: (entry) => {
        const it = entry.item;
        const def = ITEMS[it.id];
        const max = socketsOf(def);
        const fitted = it.cards ?? [];
        const body = el('div', 'grid');
        for (const c of cards) {
          const cd = ITEMS[c.id];
          const row = el('div', 'row');
          row.innerHTML = `<span>${esc(cd.nameTh)}<br><span class="muted">${esc(cd.desc ?? '')}</span></span>`;
          const ok = cardFits(cd, def) && fitted.length < max && !fitted.includes(c.id);
          const b = el('button', ok ? 'btn primary' : 'btn', ok ? 'ฝัง' : 'ฝังไม่ได้');
          if (ok) {
            b.addEventListener('click', () => {
              this.game.audio?.play('forge');
              this.game.net.send({ t: 'socket', gear: it.i, card: c.i });
            });
          } else { b.disabled = true; }
          row.append(b);
          body.append(row);
        }
        return this.detailCard(it, [
          ['รูการ์ด', `${fitted.length}/${max}`],
          ['ฝังอยู่', fitted.length ? fitted.map((id) => ITEMS[id]?.nameTh ?? id).join(', ') : '—'],
        ], body, el('div', 'muted', 'ฝังแล้วถอดไม่ได้ คิดให้ดีก่อน'));
      },
    }));
    return this.panel('shop', 'ฝังการ์ด', wrap);
  }

  openShop(d) {
    if (d.mode === 'socket') return this.openSocket();
    if (d.mode === 'refine') return this.openRefine();
    if (d.mode === 'repair') return this.openRepair();
    if (d.mode === 'craft') return this.openCraft();
    if (d.mode === 'warp') return this.openWarp(d);
    if (d.mode === 'sell') return this.openSell(d);
    if (d.mode === 'gacha') return this.openGacha(d);
    this.lastShop = d;
    return this.renderShop(d, 'buy');
  }

  /**
   * The storefront: who is selling, what they sell sorted into shelves, and
   * a counter on the right where the amount and the total are settled
   * before anything is spent. Buying and selling share the window, so the
   * shopkeeper does not change when you turn around to sell.
   */
  renderShop(d, mode) {
    this.shopMode = mode;
    const keeper = SHOPKEEPERS[d.id] ?? SHOPKEEPERS.general;
    const wrap = el('div', 'shop');

    const head = el('div', 'shop-head');
    const face = el('img', 'shop-face');
    face.src = `${UI_BASE}/shopkeeper_${keeper.face}.webp`;
    face.alt = keeper.name;
    const talk = el('div', 'shop-talk');
    const line = mode === 'sell' ? keeper.sellLine : mode === 'buyback' ? BUYBACK_LINE : keeper.line;
    talk.append(el('b', '', esc(d.keeper ?? keeper.name)), el('span', '', esc(line)));
    const side = el('div', 'shop-side');
    const sign = el('img', 'shop-sign');
    sign.src = `${UI_BASE}/sign_${keeper.sign}.webp`;
    sign.alt = '';
    side.append(sign, this.shopWallet(d));
    head.append(face, talk, side);
    wrap.append(head);

    const modes = el('div', 'shop-modes');
    for (const [key, label, pic] of [['buy', 'ซื้อสินค้า', 'cat_all'], ['sell', 'ขายสินค้า', 'shop_sell_icon'],
      ['buyback', 'ซื้อคืน', 'shop_buyback_icon']]) {
      if (key !== 'buy' && d.currency) continue;           // the shard counter only takes shards
      if (key === 'buy' && !d.stock?.length) continue;     // a buyer-only counter has no shelves
      const b = el('button', 'btn shop-mode' + (mode === key ? ' primary' : ''));
      const img = el('img');
      img.src = `${UI_BASE}/${pic}.webp`;
      img.alt = '';
      b.append(img, el('span', '', label));
      b.addEventListener('click', () => { if (mode !== key) this.renderShop(d, key); });
      modes.append(b);
    }
    wrap.append(modes);
    wrap.append(mode === 'sell' ? this.sellPicker() : mode === 'buyback' ? this.buybackShelf() : this.shopShelves(d));
    return this.panel('shop', d.name ?? 'ร้านค้า', wrap);
  }

  /** What you have to spend here: aurum, or dawn shards at the shard counter. */
  shopWallet(d) {
    const box = el('div', 'shop-wallet');
    box.append(el('i', 'cur ' + (d.currency ? 'shard' : 'coin')), el('b', 'num', fmt(this.shopMoney(d))));
    box.dataset.currency = d.currency ?? '';
    return box;
  }

  shopMoney(d) {
    const inv = this.game.inventory ?? { items: [] };
    if (!d?.currency) return inv.aurum ?? 0;
    return (inv.items ?? []).filter((x) => x.id === d.currency).reduce((a, x) => a + (x.qty ?? 1), 0);
  }

  shopShelves(d) {
    const box = el('div', 'shop-main');
    const left = el('div', 'shop-left');
    const counter = el('div', 'shop-counter');
    const lvl = this.game.self?.level ?? 1;
    const all = d.stock.map((s) => ({ ...s, item: ITEMS[s.id] ?? { id: s.id, nameTh: s.name } }));
    const cat = (it) => it.type === 'weapon' ? 'weapon' : it.type === 'armor' ? 'armor'
      : it.type === 'consumable' ? 'consumable' : it.type === 'material' || it.type === 'ammo' ? 'material' : 'other';

    const cats = el('div', 'shop-cats');
    const present = new Set(all.map((e) => cat(e.item)));
    for (const [key, label] of SHOP_CATS) {
      if (key !== 'all' && !present.has(key)) continue;
      const b = el('button', 'shop-cat' + ((this.shopCat ?? 'all') === key ? ' on' : ''));
      b.title = label;
      const img = el('img');
      img.src = `${UI_BASE}/cat_${key}.webp`;
      img.alt = '';
      b.append(img, el('span', '', label));
      b.addEventListener('click', () => { this.shopCat = key; box.replaceWith(this.shopShelves(d)); });
      cats.append(b);
    }
    left.append(cats);

    const shelf = el('div', 'shop-grid');
    const shown = all.filter((e) => (this.shopCat ?? 'all') === 'all' || cat(e.item) === this.shopCat);
    if (!shown.length) shelf.append(el('div', 'muted', 'หมวดนี้ไม่มีสินค้า'));
    const select = (entry, card) => {
      this.pick ??= {};
      this.pick.shop = entry.id;
      for (const c of shelf.children) c.classList.remove('sel');
      card?.classList.add('sel');
      counter.innerHTML = '';
      counter.append(this.shopDeal(d, entry, () => { counter.innerHTML = ''; counter.append(el('div', 'muted', 'เลือกสินค้าเพื่อดูรายละเอียด')); card?.classList.remove('sel'); }));
    };
    for (const entry of shown) {
      const it = entry.item;
      const sold = entry.stock !== undefined && entry.stock <= 0;
      const card = el('div', 'shop-card' + (sold ? ' soldout' : ''));
      const slot = el('div', `slot rarity-${it.rarity ?? 'common'}`);
      slot.append(itemIcon(it.id, { size: 32 }));
      card.append(slot);
      const tag = sold ? 'soldout'
        : it.level && it.level <= lvl && it.level >= lvl - 8 && (it.type === 'weapon' || it.type === 'armor') ? 'pick'
        : entry.stock !== undefined && entry.stock <= 5 ? 'limited' : null;
      if (tag) {
        const t = el('img', 'shop-tag');
        t.src = `${UI_BASE}/tag_${tag}.webp`;
        t.alt = { soldout: 'หมด', pick: 'แนะนำ', limited: 'เหลือน้อย' }[tag];
        card.append(t);
      }
      const price = el('div', 'price');
      price.append(el('i', 'cur ' + (d.currency ? 'shard' : 'coin')), el('span', 'num', fmt(entry.price)));
      card.append(price);
      card.title = it.nameTh ?? it.name;
      card.addEventListener('click', () => select(entry, card));
      shelf.append(card);
    }
    left.append(shelf);
    box.append(left, counter);
    const first = shown.find((e) => e.id === this.pick?.shop) ?? shown[0];
    if (first) select(first, shelf.children[shown.indexOf(first)]);
    return box;
  }

  /** What you sold here this session, at the price you were paid for it. */
  buybackShelf() {
    const list = this.buyback ?? [];
    const box = el('div', 'shop-main');
    const left = el('div', 'shop-left');
    const counter = el('div', 'shop-counter');
    left.append(el('div', 'muted', `ของที่ขายไป ${list.length ? `${list.length} รายการล่าสุด` : ''} ซื้อคืนได้ในราคาเดียวกับที่ขาย จนกว่าจะออกจากเกม`));
    const shelf = el('div', 'shop-grid');
    if (!list.length) shelf.append(el('div', 'muted', 'ยังไม่ได้ขายอะไรไป'));
    const select = (b, card) => {
      for (const c of shelf.children) c.classList.remove('sel');
      card.classList.add('sel');
      const it = ITEMS[b.id] ?? { id: b.id, nameTh: b.id };
      const deal = el('div', 'win tip shop-deal');
      const head = el('div', 'deal-head');
      const ico = el('div', 'slot rarity-' + (it.rarity ?? 'common'));
      ico.append(itemIcon(b.id, { size: 34 }));
      const meta = el('div');
      meta.append(el('div', 'tname rarity-' + (it.rarity ?? 'common'), esc(it.nameTh ?? it.name) + (b.refine ? ` +${b.refine}` : '')));
      meta.append(el('div', 'muted', `จำนวน ${fmt(b.qty)}`));
      head.append(ico, meta);
      const row = el('div', 'deal-row');
      const m = el('span', 'deal-money');
      m.append(el('i', 'cur coin'), el('b', 'num', fmt(b.price)));
      row.append(el('span', 'muted', 'ราคาซื้อคืน'), m);
      const acts = el('div', 'deal-actions');
      const buy = el('button', 'btn primary sbtn sbtn-buy', 'ซื้อคืน');
      buy.setAttribute('aria-label', 'ซื้อคืน');
      buy.addEventListener('click', () => this.game.net.send({ t: 'shopBuyback', index: b.i }));
      acts.append(buy);
      deal.append(head, row, acts);
      counter.innerHTML = '';
      counter.append(deal);
    };
    for (const b of list) {
      const it = ITEMS[b.id] ?? {};
      const card = el('div', 'shop-card');
      const slot = el('div', `slot rarity-${it.rarity ?? 'common'}`);
      slot.append(itemIcon(b.id, { size: 32 }));
      if (b.qty > 1) slot.append(el('span', 'qty num', String(b.qty)));
      if (b.refine) slot.append(el('span', 'plus', '+' + b.refine));
      const price = el('div', 'price');
      price.append(el('i', 'cur coin'), el('span', 'num', fmt(b.price)));
      card.append(slot, price);
      card.title = it.nameTh ?? b.id;
      card.addEventListener('click', () => select(b, card));
      shelf.append(card);
    }
    left.append(shelf);
    box.append(left, counter);
    if (list.length) select(list[0], shelf.children[0]);
    return box;
  }

  /** A fresh buy-back list from the server; redraw the tab if it is showing. */
  setBuyback(items) {
    this.buyback = items ?? [];
    if (this.shopMode === 'buyback' && this.openPanels.has('shop') && document.querySelector('.shop')) {
      this.renderShop(this.lastShop ?? { id: null, name: 'ร้านค้า', stock: [] }, 'buyback');
    }
  }

  /** The counter: price, a quantity you can nudge, the total, then buy. */
  shopDeal(d, entry, onCancel) {
    const it = entry.item;
    const money = this.shopMoney(d);
    const most = Math.max(1, Math.min(entry.stock ?? 999, Math.floor(money / Math.max(1, entry.price)), 999));
    const deal = el('div', 'win tip shop-deal');
    const cur = d.currency ? 'shard' : 'coin';
    const head = el('div', 'deal-head');
    const ico = el('div', 'slot rarity-' + (it.rarity ?? 'common'));
    ico.append(itemIcon(it.id, { size: 34 }));
    const meta = el('div');
    meta.append(el('div', 'tname rarity-' + (it.rarity ?? 'common'), esc(it.nameTh ?? it.name)));
    const facts = [
      it.atk ? `พลังโจมตี +${it.atk}` : '', it.matk ? `พลังเวทย์ +${it.matk}` : '',
      it.def ? `ป้องกัน +${it.def}` : '', it.mdef ? `ต้านเวทย์ +${it.mdef}` : '',
      it.heal ? `ฟื้น HP ${it.heal}` : '', it.healSp ? `ฟื้น SP ${it.healSp}` : '',
      it.level ? `ต้องเลเวล ${it.level}` : '',
    ].filter(Boolean);
    if (facts.length) meta.append(el('div', 'muted', facts.join(' · ')));
    head.append(ico, meta);
    deal.append(head);
    if (it.desc) deal.append(el('div', 'flavour', esc(it.desc)));

    const q = this.qtyControl(most, (n) => { total.textContent = fmt(n * entry.price); });
    const row = (label, node) => { const r = el('div', 'deal-row'); r.append(el('span', 'muted', label), node); deal.append(r); };
    const money1 = (v) => { const m = el('span', 'deal-money'); m.append(el('i', 'cur ' + cur), el('b', 'num', v)); return m; };
    row('ราคา', money1(fmt(entry.price)));
    row('จำนวน', q.node);
    deal.append(q.quick);
    const tot = money1(fmt(entry.price));
    const total = tot.querySelector('b');
    row('ราคารวม', tot);
    if (entry.stock !== undefined) deal.append(el('div', 'muted deal-note', `คงเหลือในร้าน ${fmt(entry.stock)}`));

    const acts = el('div', 'deal-actions');
    const cancel = el('button', 'btn sbtn sbtn-cancel', 'ยกเลิก');
    cancel.setAttribute('aria-label', 'ยกเลิก');
    cancel.addEventListener('click', onCancel);
    const buy = el('button', 'btn primary sbtn sbtn-buy', 'ซื้อ');
    buy.setAttribute('aria-label', 'ซื้อ');
    buy.disabled = entry.stock !== undefined && entry.stock <= 0;
    buy.addEventListener('click', () => this.game.net.send({ t: 'shopBuy', shop: d.id, id: entry.id, qty: q.value() }));
    acts.append(cancel, buy);
    deal.append(acts);
    return deal;
  }

  /**
   * An amount between 1 and max: - / + steppers around a number, and the
   * +1 / +10 / +50 / +100 / MAX shortcuts under it.
   */
  qtyControl(max, onChange, start = 1) {
    let n = Math.min(max, Math.max(1, start));
    const node = el('div', 'qty-row');
    const minus = el('button', 'btn step', '−');
    const input = el('input', 'num');
    input.type = 'number'; input.min = 1; input.max = max; input.value = n;
    const plus = el('button', 'btn step', '+');
    const set = (v) => {
      n = Math.max(1, Math.min(max, Math.floor(Number(v)) || 1));
      input.value = n;
      onChange?.(n);
    };
    minus.addEventListener('click', () => set(n - 1));
    plus.addEventListener('click', () => set(n + 1));
    input.addEventListener('change', () => set(input.value));
    input.addEventListener('focus', () => { this.game.input.textMode = true; });
    input.addEventListener('blur', () => { this.game.input.textMode = false; });
    node.append(minus, input, plus);
    const quick = el('div', 'qty-quick');
    for (const [key, label, fn] of [['1', '+1', () => n + 1], ['10', '+10', () => n + 10], ['50', '+50', () => n + 50],
      ['100', '+100', () => n + 100], ['max', 'MAX', () => max]]) {
      const b = el('button', `btn qbtn q-${key}`, label);
      b.setAttribute('aria-label', label);
      b.addEventListener('click', () => set(fn()));
      quick.append(b);
    }
    return { node, quick, value: () => n };
  }

  sellPicker() {
    const items = (this.game.inventory?.items ?? []).filter((it) => !it.equipped);
    return this.itemPicker({
      key: 'sell',
      items: items.map((it) => ({ id: it.i, item: it, qty: it.qty, refine: it.refine })),
      empty: 'ไม่มีของให้ขาย',
      onSelect: (entry) => {
        const it = entry.item;
        const unit = npcSellPrice(it.value ?? 0, 0, it.rarity, (isEquip(it) || it.type === 'card') ? 'equip' : CRAFTING_INPUTS.has(it.id));
        const q = this.qtyControl(it.qty, (n) => { total.textContent = fmt(n * unit); }, it.qty);
        const total = el('b', 'num', fmt(unit * q.value()));
        const money = (b) => { const m = el('span', 'deal-money'); m.append(el('i', 'cur coin'), b); return m; };
        const qtyRow = el('div', 'deal-row');
        qtyRow.append(el('span', 'muted', 'จำนวน'), q.node);
        const totRow = el('div', 'deal-row');
        totRow.append(el('span', 'muted', 'ได้รับรวม'), money(total));
        const acts = el('div', 'deal-actions');
        const sell = el('button', 'btn primary sbtn sbtn-sell', 'ขาย');
        sell.setAttribute('aria-label', 'ขาย');
        sell.addEventListener('click', () => this.game.net.send({ t: 'shopSell', index: it.i, qty: q.value() }));
        acts.append(sell);
        const extra = el('div', 'grid');
        extra.style.gap = '6px';
        extra.append(qtyRow, q.quick, totRow,
          el('div', 'muted deal-note', 'NPC รับซื้อราว 28% ของมูลค่าอ้างอิง ขายของชิ้นเดิมซ้ำในวันเดียวราคาจะตก'));
        return this.detailCard(it, [
          ['ราคาขายต่อชิ้น', fmt(unit) + ' AU'],
          ['มูลค่าอ้างอิง', fmt(it.value ?? 0) + ' AU'],
        ], acts, extra);
      },
    });
  }

  openSell(d) {
    this.lastShop = { id: d?.id, name: d?.name ?? 'ขายของ', keeper: d?.keeper, stock: [] };
    return this.renderShop(this.lastShop, 'sell');
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
        go.addEventListener('click', () => { this.game.audio?.play('forge'); this.game.net.send({ t: 'refine', index: it.i, oil: false }); });
        const oil = el('button', 'btn', 'ใช้น้ำมันศักดิ์สิทธิ์');
        oil.addEventListener('click', () => { this.game.audio?.play('forge'); this.game.net.send({ t: 'refine', index: it.i, oil: true }); });
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
        go.addEventListener('click', () => { this.game.audio?.play('forge'); this.game.net.send({ t: 'repair', index: it.i }); });
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
      if (it.refine) { node.append(el('span', 'plus', '+' + it.refine)); markRefine(node, it.refine); }
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
      if (it.refine) { node.append(el('span', 'plus', '+' + it.refine)); markRefine(node, it.refine); }
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

  /* ---------------- player stalls ---------------- */

  /**
   * Your own stall: pick up to eight things out of your bag, price them, and
   * stand there. The goods stay in the bag - what is listed is a promise to
   * sell, not an escrow - so closing the window never has to give anything
   * back and nothing can be duplicated by a badly timed disconnect.
   */
  openStall(d) {
    const wrap = el('div', 'grid');
    const mine = d?.mine ?? null;
    wrap.append(el('div', 'muted',
      'ตั้งแผงได้เฉพาะในเมือง และต้องยืนเฝ้าเอง · ไม่มีค่าธรรมเนียมตอนตั้ง หักภาษี 5% เมื่อขายได้<br>' +
      'ของยังอยู่ในกระเป๋าคุณจนกว่าจะมีคนซื้อ เดินออกจากเมืองหรือออกเกมแล้วแผงปิดเอง'));

    if (mine) {
      const list = el('div', 'grid');
      for (const o of mine.offers) {
        const row = el('div', 'row');
        row.innerHTML = `<span>${esc(ITEMS[o.id]?.nameTh ?? o.id)} x${o.qty}</span><b>${o.price.toLocaleString()} AU</b>`;
        list.append(row);
      }
      wrap.append(el('div', 'muted', `กำลังเปิดแผง: <b>${esc(mine.title)}</b>`), list);
      const stop = el('button', 'btn', 'ปิดแผง');
      stop.addEventListener('click', () => { this.game.net.send({ t: 'stallClose' }); this.close('stall'); });
      wrap.append(stop);
      return this.panel('stall', 'แผงขายของ', wrap);
    }

    const title = el('input');
    title.type = 'text'; title.placeholder = 'ชื่อแผง'; title.maxLength = 24;
    this.textInput(title);
    wrap.append(title);

    // One row per inventory slot the player ticks, with its own price.
    const picked = new Map();
    const rows = el('div', 'grid');
    const inv = this.game.state.inventory ?? [];
    inv.forEach((st, index) => {
      if (!st) return;
      const def = ITEMS[st.id];
      if (!def) return;
      const row = el('div', 'row');
      const tick = el('input');
      tick.type = 'checkbox';
      const price = el('input');
      price.type = 'number'; price.min = 1; price.value = Math.max(1, def.value ?? 1);
      price.style.width = '110px';
      this.textInput(price);
      const sync = () => {
        if (tick.checked) picked.set(index, { index, qty: st.qty ?? 1, price: Math.max(1, price.value | 0) });
        else picked.delete(index);
      };
      tick.addEventListener('change', sync);
      price.addEventListener('input', sync);
      row.append(tick, el('span', '', `${def.nameTh} x${st.qty ?? 1}`), price);
      rows.append(row);
    });
    wrap.append(rows);

    const go = el('button', 'btn primary', 'เปิดแผง');
    go.addEventListener('click', () => {
      this.game.net.send({ t: 'stallOpen', title: title.value.trim(), offers: [...picked.values()] });
    });
    wrap.append(go);
    return this.panel('stall', 'ตั้งแผงขายของ', wrap);
  }

  /** Somebody else's stall, as seen by whoever walked up to the sign. */
  openStallView(view) {
    const wrap = el('div', 'grid');
    if (!view) {
      wrap.append(el('div', 'muted', 'แผงนี้ปิดไปแล้ว'));
      return this.panel('stallView', 'แผงขายของ', wrap);
    }
    wrap.append(el('div', 'muted', `<b>${esc(view.title)}</b> · ผู้ขาย ${esc(view.name)}`));
    for (const o of view.offers) {
      const row = el('div', 'row');
      const label = `${esc(o.name)}${o.refine ? ` +${o.refine}` : ''} x${o.qty}`;
      row.innerHTML = `<span>${label}</span><b>${o.price.toLocaleString()} AU</b>`;
      if (o.gone || o.qty <= 0) {
        row.append(el('span', 'muted', 'ขายไปแล้ว'));
      } else {
        const b = el('button', 'btn primary', 'ซื้อ');
        b.addEventListener('click', () =>
          this.game.net.send({ t: 'stallBuy', seller: view.seller, slot: o.slot, qty: o.qty }));
        row.append(b);
      }
      wrap.append(row);
    }
    return this.panel('stallView', 'แผงขายของ', wrap);
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
        if (l.refine) { ico.append(el('span', 'plus', '+' + l.refine)); markRefine(ico, l.refine); }
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

  /** Volume sliders. Everything is synthesised, so this is the whole mixer. */
  audioSettings() {
    const audio = this.game.audio;
    const box = el('div');
    box.innerHTML = '<h3 style="margin:0 0 6px">เสียง</h3>';
    const mute = el('button', 'btn' + (audio.settings.muted ? ' danger' : ''), audio.settings.muted ? 'ปิดเสียงอยู่' : 'เปิดเสียงอยู่');
    mute.addEventListener('click', () => { audio.toggleMute(); this.open('settings'); });
    box.append(mute);
    for (const [key, label] of [['master', 'เสียงรวม'], ['sfx', 'เอฟเฟกต์'], ['music', 'เพลงบรรยากาศ']]) {
      const row = el('div', 'row');
      const name = el('span', '', label);
      const val = el('span', 'muted num', Math.round(audio.settings[key] * 100) + '%');
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0'; slider.max = '100'; slider.step = '5';
      slider.value = String(Math.round(audio.settings[key] * 100));
      slider.style.width = '180px';
      slider.addEventListener('input', () => {
        audio.set(key, Number(slider.value) / 100);
        val.textContent = slider.value + '%';
      });
      // hearing the change is the only useful preview
      slider.addEventListener('change', () => audio.play(key === 'music' ? 'buff' : 'hit'));
      row.append(name, slider, val);
      box.append(row);
    }
    box.append(el('div', 'muted', 'เสียงทั้งหมดสังเคราะห์สดในเบราว์เซอร์ ไม่มีไฟล์เสียงให้โหลด'));
    return box;
  }

  /**
   * The Dawn Shrine. Shows the whole pool with real odds and how many draws
   * are left before the guaranteed one - a gacha that hides its numbers is
   * a gacha that is hiding something.
   */
  openGacha(d) {
    const wrap = el('div', 'grid');
    const shard = ITEMS.shard_dawn?.nameTh ?? 'เศษรุ่งอรุณ';
    const head = el('div', 'row');
    head.innerHTML = `<span>มี<b class="num"> ${fmt(d.have)}</b> ${esc(shard)}</span>
      <span class="muted">ครั้งละ ${d.cost} ชิ้น · การันตีของหายากในอีก <b>${d.pity}</b> ครั้ง</span>`;
    wrap.append(head);

    const roll = el('div', 'opts');
    for (const [times, label] of [[1, 'เสี่ยง 1 ครั้ง'], [10, 'เสี่ยง 10 ครั้ง']]) {
      const b = el('button', 'btn' + (times === 10 ? ' primary' : ''), `${label} (${d.cost * times})`);
      b.disabled = d.have < d.cost * times;
      b.addEventListener('click', () => this.game.net.send({ t: 'npcAction', action: 'gachaDraw', times }));
      roll.append(b);
    }
    wrap.append(roll);
    wrap.append(el('div', 'muted', 'ไม่มีอะไรในศาลที่ซื้อด้วยเงินจริงได้ และของทุกชิ้นหาได้จากบอสหรือร้านแลกเหมือนกัน — ศาลคือทางลัดที่ต้องเสี่ยง ไม่ใช่ทางเดียว'));

    const total = d.pool.reduce((a, o) => a + o.chance, 0);
    const list = el('div', 'grid');
    list.append(el('h3', '', 'โอกาสออกของแต่ละชิ้น'));
    for (const o of [...d.pool].sort((a, b) => a.chance - b.chance)) {
      const it = ITEMS[o.id] ?? { id: o.id, nameTh: o.id };
      const row = el('div', 'listing');
      const ico = el('div', 'slot rarity-' + (it.rarity ?? 'common'));
      ico.append(itemIcon(o.id, { size: 28 }));
      const qty = Array.isArray(o.qty) ? `x${o.qty[0]}-${o.qty[1]}` : o.qty > 1 ? `x${o.qty}` : '';
      row.append(ico,
        el('div', '', `<b class="rarity-${it.rarity ?? 'common'}">${esc(it.nameTh ?? it.name)}</b> ${qty}
          <div class="muted">${o.tier === 'legendary' ? 'ระดับตำนาน' : o.tier === 'rare' ? 'ของหายาก (นับในการันตี)' : 'ของทั่วไป'}</div>`),
        el('span', 'num', ((o.chance / total) * 100).toFixed(1) + '%'));
      list.append(row);
    }
    wrap.append(list);
    return this.panel('gacha', 'ศาลรุ่งอรุณ', wrap);
  }

  /** The draw animation: one card per pull, rare ones announced. */
  showGachaResult(m) {
    const wrap = el('div', 'grid');
    const grid = el('div', 'slot-grid');
    for (const r of m.results) {
      const it = ITEMS[r.id] ?? { id: r.id, nameTh: r.id };
      const node = el('div', 'slot rarity-' + (it.rarity ?? 'common') + (r.tier !== 'common' ? ' sel' : ''));
      node.append(itemIcon(r.id, { size: 32 }));
      if (r.qty > 1) node.append(el('span', 'qty num', String(r.qty)));
      node.title = `${it.nameTh ?? it.name}${r.guaranteed ? ' (การันตี)' : ''}`;
      grid.append(node);
    }
    wrap.append(grid);
    const best = m.results.find((r) => r.tier === 'legendary') ?? m.results.find((r) => r.tier === 'rare');
    wrap.append(el('div', best ? '' : 'muted', best
      ? `✦ ได้ ${esc(ITEMS[best.id]?.nameTh ?? best.id)}!`
      : 'รอบนี้ยังไม่มีของหายาก'));
    wrap.append(el('div', 'muted', `การันตีของหายากในอีก ${m.pity} ครั้ง`));
    this.game.audio?.play(best ? 'levelup' : 'ui');
    return this.panel('gachaResult', 'ผลการเสี่ยงทาย', wrap);
  }

  /* ---------------- player trading ---------------- */

  /** Server pushed a new trade state: open, refresh or close the window. */
  tradeState(m) {
    this.lastTrade = m.trade;
    this.tradeInvite = m.invite;
    if (m.trade) return this.openTrade(m.trade);
    this.close('trade');
    if (m.invite) this.openTradeInvite(m.invite);
    else this.close('tradeInvite');
  }

  openTradeInvite(inv) {
    const wrap = el('div');
    wrap.append(el('div', '', `<b>${esc(inv.from)}</b> ขอเทรดกับคุณ`));
    wrap.append(el('div', 'muted', 'ตรวจของทั้งสองฝั่งให้ดีก่อนกดล็อกและยืนยัน'));
    const row = el('div', 'row');
    const yes = el('button', 'btn primary', 'ยอมรับ');
    yes.addEventListener('click', () => {
      this.game.net.send({ t: 'trade', cmd: 'accept', fromId: inv.fromId });
      this.close('tradeInvite');
    });
    const no = el('button', 'btn', 'ปฏิเสธ');
    no.addEventListener('click', () => {
      this.game.net.send({ t: 'trade', cmd: 'decline' });
      this.close('tradeInvite');
    });
    row.append(yes, no);
    wrap.append(row);
    return this.panel('tradeInvite', 'คำขอเทรด', wrap);
  }

  /** Nearby players you can ask to trade - trading is face to face. */
  openTradePicker() {
    const me = this.game.predicted ?? { x: 0, y: 0 };
    const near = [...this.game.entities.values()]
      .filter((e) => e.k === 'p' && e.id !== this.game.state.myId)
      .map((e) => ({ e, d: Math.hypot(e.x - me.x, e.y - me.y) }))
      .filter((r) => r.d <= 160)
      .sort((a, b) => a.d - b.d);
    const wrap = el('div');
    wrap.append(el('div', 'muted', 'เทรดได้เฉพาะผู้เล่นที่ยืนใกล้กัน (ไม่เกิน 5 ช่อง) ถ้าเดินห่างออกไป การเทรดจะถูกยกเลิก'));
    if (!near.length) wrap.append(el('div', 'muted', 'ไม่มีผู้เล่นคนอื่นอยู่ใกล้ๆ'));
    for (const { e, d } of near) {
      const row = el('div', 'row');
      row.append(el('span', '', `${esc(e.n)} ${e.lv ? `<span class="muted">Lv.${e.lv}</span>` : ''}`));
      const b = el('button', 'btn primary', 'ขอเทรด');
      b.title = `ห่าง ${Math.round(d)} พิกเซล`;
      b.addEventListener('click', () => this.game.net.send({ t: 'trade', cmd: 'invite', name: e.n }));
      row.append(b);
      wrap.append(row);
    }
    const form = el('div', 'row');
    const input = el('input');
    input.type = 'text';
    input.placeholder = 'หรือพิมพ์ชื่อผู้เล่น';
    input.addEventListener('focus', () => { this.game.input.textMode = true; });
    input.addEventListener('blur', () => { this.game.input.textMode = false; });
    const go = el('button', 'btn', 'ขอเทรด');
    go.addEventListener('click', () => {
      if (input.value.trim()) this.game.net.send({ t: 'trade', cmd: 'invite', name: input.value.trim() });
      input.value = '';
    });
    form.append(input, go);
    wrap.append(form);
    return this.panel('tradePicker', 'ขอเทรด', wrap);
  }

  /** The window itself: my offer on the left, theirs on the right. */
  openTrade(tr) {
    const send = (msg) => this.game.net.send({ t: 'trade', ...msg });
    const wrap = el('div', 'grid');
    const cols = el('div', 'grid cols-2');
    cols.append(this.tradeSide(tr.me, true), this.tradeSide(tr.them, false));
    wrap.append(cols);

    if (!tr.me.locked) {
      const add = el('div', 'grid');
      add.append(el('h3', '', 'ใส่ของจากกระเป๋า'));
      const offered = new Map();
      for (const it of tr.me.items) offered.set(it.index, (offered.get(it.index) ?? 0) + it.qty);
      const items = (this.game.inventory?.items ?? [])
        .filter((it) => !it.equipped && (it.qty ?? 1) > (offered.get(it.i) ?? 0))
        .map((it) => ({ id: 'inv' + it.i, item: { ...(ITEMS[it.id] ?? {}), id: it.id }, qty: it.qty, refine: it.refine, inv: it }));
      add.append(this.itemPicker({
        key: 'trade',
        items,
        empty: 'ไม่มีของที่เทรดได้ (ถอดอุปกรณ์ที่ใส่อยู่ออกก่อน)',
        onSelect: (entry) => {
          const left = (entry.qty ?? 1) - (offered.get(entry.inv.i) ?? 0);
          const qty = el('input');
          qty.type = 'number'; qty.min = 1; qty.max = String(left); qty.value = '1';
          qty.style.width = '80px';
          return this.detailCard(entry.item, [
            ['มีอยู่', fmt(entry.qty ?? 1)],
            ['ใส่ได้อีก', fmt(left)],
            ...(entry.refine ? [['ตีบวก', '+' + entry.refine]] : []),
          ], [['ใส่ลงกองเทรด', () => send({ cmd: 'offer', index: entry.inv.i, qty: Number(qty.value) || 1 }), 'btn primary']], qty);
        },
      }));
      wrap.append(add);
    }

    // aurum: typed in, cleared whenever either side changes anything
    const money = el('div', 'row');
    money.append(el('span', '', 'ออรัมที่จะให้'));
    const au = el('input');
    au.type = 'number'; au.min = '0'; au.value = String(tr.me.aurum);
    au.style.width = '140px';
    au.disabled = tr.me.locked;
    au.addEventListener('focus', () => { this.game.input.textMode = true; });
    au.addEventListener('blur', () => { this.game.input.textMode = false; });
    const set = el('button', 'btn', 'ตั้งค่า');
    set.disabled = tr.me.locked;
    set.addEventListener('click', () => send({ cmd: 'aurum', amount: Number(au.value) || 0 }));
    money.append(au, set);
    wrap.append(money);

    const bothLocked = tr.me.locked && tr.them.locked;
    const status = el('div', 'muted', bothLocked
      ? (tr.me.confirmed ? 'รออีกฝ่ายกดยืนยัน…' : 'ตรวจของให้ครบแล้วกดยืนยันเพื่อปิดการเทรด')
      : 'แก้กองของเมื่อไหร่ ล็อกของทั้งสองฝ่ายจะถูกปลดทันที');
    wrap.append(status);

    const actions = el('div', 'opts');
    const lock = el('button', 'btn' + (tr.me.locked ? '' : ' primary'), tr.me.locked ? 'ปลดล็อก' : 'ล็อกกองของ');
    lock.addEventListener('click', () => send({ cmd: 'lock', on: !tr.me.locked }));
    const ok = el('button', 'btn primary', 'ยืนยันเทรด');
    ok.disabled = !bothLocked || tr.me.confirmed;
    ok.addEventListener('click', () => send({ cmd: 'confirm' }));
    const no = el('button', 'btn danger', 'ยกเลิก');
    no.addEventListener('click', () => send({ cmd: 'cancel' }));
    actions.append(lock, ok, no);
    wrap.append(actions);

    return this.panel('trade', `เทรดกับ ${tr.them.name}`, wrap);
  }

  tradeSide(side, mine) {
    const box = el('div', 'grid trade-side');
    const head = el('div', 'row');
    head.append(el('b', '', mine ? 'ของคุณ' : esc(side.name)));
    head.append(el('span', side.locked ? '' : 'muted',
      side.confirmed ? '✔ ยืนยันแล้ว' : side.locked ? '🔒 ล็อกแล้ว' : 'กำลังเลือก…'));
    box.append(head);
    const grid = el('div', 'slot-grid');
    for (const it of side.items) {
      const def = ITEMS[it.id] ?? {};
      const node = el('div', 'slot rarity-' + (def.rarity ?? 'common'));
      node.append(itemIcon(it.id, { size: 32 }));
      if (it.qty > 1) node.append(el('span', 'qty num', String(it.qty)));
      if (it.refine) { node.append(el('span', 'plus', '+' + it.refine)); markRefine(node, it.refine); }
      node.title = def.nameTh ?? it.id;
      if (mine && !side.locked) {
        node.style.cursor = 'pointer';
        node.addEventListener('click', () => this.game.net.send({ t: 'trade', cmd: 'unoffer', slot: it.slot }));
      }
      grid.append(node);
    }
    for (let i = side.items.length; i < 8; i++) grid.append(el('div', 'slot empty'));
    box.append(grid);
    box.append(el('div', side.aurum ? '' : 'muted', `ออรัม: <b class="num">${fmt(side.aurum)}</b>`));
    if (mine && side.items.length) box.append(el('div', 'muted', 'คลิกที่ของเพื่อเอาออก'));
    return box;
  }

  openSettings() {
    const wrap = el('div');
    const themes = el('div');
    themes.innerHTML = '<h3 style="margin:0 0 6px">หน้าตา UI</h3>';
    const row = el('div', 'opts');
    const current = document.body.dataset.ui ?? 'ember';
    for (const [key, label, note] of [
      ['ember', 'ทองคำ', 'กรอบทองลายวาด ไอคอนสีจากชีต UI หลัก'],
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

    const cam = el('div');
    cam.innerHTML = '<h3 style="margin:0 0 6px">ระยะกล้อง</h3>';
    const camRow = el('div', 'opts');
    const curStep = this.game.renderer?.zoomStep ?? 1;
    ZOOM_STEPS.forEach((z, i) => {
      const b = el('button', 'btn' + (curStep === i ? ' primary' : ''), z.label);
      b.title = z.note;
      b.addEventListener('click', () => this.game.setZoom(i));
      camRow.append(b);
    });
    cam.append(camRow);
    cam.append(el('div', 'muted', 'ปุ่มลัด: − / +  ·  จอยเกม: กดแกนอนาล็อกขวา'));
    wrap.append(cam, el('hr'));

    wrap.append(this.audioSettings(), el('hr'));

    const screenBox = el('div');
    screenBox.innerHTML = '<h3 style="margin:0 0 6px">การวางจอ</h3>';
    screenBox.append(el('div', 'muted', 'เกมเล่นแนวนอนเสมอ — ถ้าถือมือถือแนวตั้ง เกมจะหมุนภาพให้เป็นแนวนอนเอง ถือเครื่องตะแคงได้เลย'));
    wrap.append(screenBox, el('hr'));

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
        <tr><td>ระยะกล้อง ไกล/กลาง/ใกล้</td><td>กดอนาล็อกขวา</td><td>− / +</td><td>ตั้งค่า</td></tr>
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
  const ok = ['ember', 'pixel', 'ornate', 'glass'].includes(name) ? name : 'ember';
  document.body.dataset.ui = ok;
  try { localStorage.setItem(THEME_KEY, ok); } catch { /* no storage */ }
}

// A new key, so everyone meets the painted HUD once; the old key only ever
// held whatever the default was when the page first loaded.
const THEME_KEY = 'emberfall-ui-v2';

export function loadTheme() {
  let saved = 'ember';
  try { saved = localStorage.getItem(THEME_KEY) || 'ember'; } catch { /* no storage */ }
  setTheme(saved);
}

/* ---------------- helpers ---------------- */
/** What each path does in a group. */
const ROLE_OF = {
  vanguard: 'tank', bulwark: 'tank', oathkeeper: 'tank',
  warden: 'healer', hierophant: 'healer',
  trickster: 'support', beastcaller: 'support', stormsinger: 'support',
};
const ROLE_TH = { tank: 'แทงก์', dps: 'ดาเมจ', healer: 'ฮีลเลอร์', support: 'ซัพพอร์ต' };
function roleIcon(job) {
  const role = ROLE_OF[job] ?? 'dps';
  const i = el('img', 'role-ico');
  i.src = `${UI_BASE}/role_${role}.webp`;
  i.alt = ROLE_TH[role];
  i.title = `${ROLE_TH[role]} · ${JOBS[job]?.nameTh ?? ''}`;
  return i;
}
/** A ringed initial: gold ring and a crown for the leader. */
function memberFace(m, leader) {
  const f = el('div', 'mface' + (leader ? ' lead' : ''));
  f.append(el('span', '', esc((m.name ?? '?').slice(0, 1).toUpperCase())));
  const ring = el('img', 'mring'); ring.src = `${UI_BASE}/pring_${leader ? 'gold' : 'steel'}.webp`; ring.alt = '';
  f.append(ring);
  if (leader) { const c = el('img', 'mcrown'); c.src = `${UI_BASE}/role_leader.webp`; c.alt = 'หัวหน้า'; f.append(c); }
  return f;
}
function bar(kind, cur, max) {
  const b = el('div', `bar ${kind} small`);
  const i = el('i');
  i.style.width = `${max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0}%`;
  b.append(i);
  return b;
}
/** My character id inside a party list (the client knows its entity id). */
const myCharId = (pt, entityId) => String((pt?.members ?? []).find((m) => m.id === entityId)?.charId ?? '');
function ago(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 60) return `${Math.max(1, m)} นาทีก่อน`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} ชั่วโมงก่อน` : `${Math.floor(h / 24)} วันก่อน`;
}

/** A quest's giver, as the role that NPC stands in the world with. */
export const GIVER_ROLE = { board: 'quests', trainer: 'trainer', smith: 'smith', healer: 'healer',
  vendor: 'shop', banker: 'storage', broker: 'market', oracle: 'gacha' };
/** Main (the path the trainer sets), daily, event (weekly) or side. */
export const questKind = (q) => (q.giver === 'trainer' ? 'main'
  : q.repeatable === 'daily' ? 'daily' : q.repeatable ? 'event' : 'sub');
const KIND_TH = { main: 'หลัก', sub: 'รอง', daily: 'รายวัน', event: 'กิจกรรม' };
/** Faces for the dialogue window: by the NPC's own id first, then by role. */
const NPC_FACES = {
  healer: 'npc_face_priest', trainer: 'npc_face_elder', quests: 'npc_face_girl', board: 'npc_face_girl',
  smith: 'shopkeeper_smith', vendor: 'shopkeeper_general', shop: 'shopkeeper_general',
  apothecary: 'shopkeeper_maid', storage: 'npc_face_merchant', market: 'npc_face_tinker',
  warp: 'npc_face_mage', gacha: 'shopkeeper_mystic', oracle: 'shopkeeper_mystic',
};

/** Who stands behind each counter, from the shop sheet's portraits. */
const SHOPKEEPERS = {
  general: { face: 'general', sign: 'shop', name: 'พ่อค้า',
    line: 'ยินดีต้อนรับ! ของดีมีคุณภาพ เลือกดูได้เลย', sellLine: 'มีอะไรจะขายเหรอ? ของชิ้นเดิมขายซ้ำวันเดียวกันราคาจะตกนะ' },
  smith: { face: 'smith', sign: 'weapon', name: 'ช่างบอร์ก',
    line: 'เหล็กทุกชิ้นข้าตีเอง ใส่แล้วไม่ต้องกลัวใคร', sellLine: 'ของเก่าเอามาเถอะ ข้าหลอมใหม่ได้' },
  apothecary: { face: 'maid', sign: 'potion', name: 'แม่ค้าโรซ่า',
    line: 'ยาทุกขวดต้มเองกับมือค่ะ ก่อนออกไปล่าพกติดตัวไว้นะคะ', sellLine: 'มีสมุนไพรหรือของอื่นจะขายไหมคะ?' },
  dawn: { face: 'mystic', sign: 'etc', name: 'ผู้แลกเศษรุ่งอรุณ',
    line: 'เศษรุ่งอรุณ... แลกของที่หาที่ไหนไม่ได้', sellLine: '...' },
};
const BUYBACK_LINE = 'ขายผิดชิ้นเหรอ? ซื้อคืนได้ในราคาเดิม แต่ถ้าออกจากเกมไปแล้วก็หมดสิทธิ์นะ';
const SHOP_CATS = [['all', 'ทั้งหมด'], ['weapon', 'อาวุธ'], ['armor', 'ชุดเกราะ'],
  ['consumable', 'ไอเทมใช้สอย'], ['material', 'วัตถุดิบ'], ['other', 'อื่นๆ']];

/** Status (by key, then by type) -> painted icon from the UI sheet. */
const STATUS_ART = {
  food: 'st_plus', buff: 'st_sword', shield: 'st_shield', poison: 'st_skull',
  burn: 'st_fire', chill: 'st_frost', stun: 'st_bolt',
};
/** Empty paper-doll slots that have a grey outline on the sheet. */
const GHOSTS = new Set(['head', 'torso', 'legs', 'hands', 'armor', 'weapon', 'offhand', 'accessory', 'scarf']);

/** A refined item wears its aura in the bag too, in the same colour it glows. */
function markRefine(node, refine) {
  const tier = glowTier(refine);
  if (!tier) return;
  node.classList.add('refined');
  node.style.borderColor = glowCss(refine, 0.85);
  node.style.boxShadow = `inset 0 0 10px ${glowCss(refine, 0.35)}, 0 0 8px ${glowCss(refine, 0.30)}`;
  const plus = node.querySelector('.plus');
  if (plus) plus.style.color = glowCss(refine, 1);
  node.title = `${node.title ?? ''} · ${tier.name} (+${refine})`.trim();
}

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
