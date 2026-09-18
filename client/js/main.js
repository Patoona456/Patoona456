// Bootstrap: screens -> world loop. Owns client state and talks to server.
import { Net } from './net.js';
import { Input, bindTouchControls } from './input.js';
import { Renderer } from './renderer.js';
import { UI, loadTheme } from './ui.js';
import { Audio } from './audio.js';
import { preloadCommon, playerLayers, drawCharacter, loadedRatio } from './sprites.js';
import { TILE } from '../../shared/constants.js';
import { BLOCKING, decodeGrid } from '../../shared/data/maps.js';
import { ITEMS } from '../../shared/data/items.js';
import { SKILLS } from '../../shared/data/skills.js';
import { JOBS } from '../../shared/data/jobs.js';

const $ = (s, r = document) => r.querySelector(s);

/** Which synth voice each server-side effect speaks with. */
const FX_SOUND = {
  aoe: 'aoe', line: 'line', bolt: 'bolt', heal: 'heal', buff: 'buff',
  debuff: 'debuff', dash: 'dash', ground: 'ground', summon: 'summon',
};

loadTheme();

class Game {
  constructor() {
    this.net = new Net();
    this.input = new Input();
    this.renderer = new Renderer($('#game'));
    this.audio = new Audio();
    this.ui = new UI(this);
    this.self = null;
    this.inventory = { items: [], aurum: 0, weight: 0, weightCap: 1 };
    this.state = { ents: [], ground: [], fx: [], myId: null, targetId: null, me: null };
    this.entities = new Map();
    this.lastInput = { mx: 0, my: 0, at: 0 };
    this.attacking = false;
    this.account = null;
    this.chars = [];
    this.inWorld = false;

    this.auto = false;
    this.autoAt = 0;

    this.wireNet();
    this.net.connect();

    document.getElementById('btn-auto')?.addEventListener('click', () => this.toggleAuto());
    document.getElementById('btn-cycle')?.addEventListener('click', () => this.cycleTarget(1));
    document.getElementById('tg-trade')?.addEventListener('click', () => {
      const t = this.entities.get(this.state.targetId);
      if (t?.k === 'p') this.net.send({ t: 'trade', cmd: 'invite', name: t.n });
    });

    // ?touch=1 forces the mobile control scheme on a desktop, for testing
    if (matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch')) {
      document.body.classList.add('touch');
      $('#touch').classList.remove('hidden');
      bindTouchControls(this.input, $('#touch'));
    }
    this.input.onPadChange = (connected, id) => {
      this.ui.toast(connected ? `เชื่อมต่อจอยแล้ว: ${id?.slice(0, 28) ?? ''}` : 'ถอดจอยออกแล้ว', connected ? 'good' : 'warn');
    };

    requestAnimationFrame((t) => this.loop(t));
    this.showLogin();
  }

  /* ---------------- networking ---------------- */
  wireNet() {
    const n = this.net;
    n.on('_open', () => this.ui.toast('เชื่อมต่อเซิร์ฟเวอร์แล้ว', 'good'));
    n.on('_close', () => { if (this.inWorld) this.ui.toast('หลุดการเชื่อมต่อ กำลังเชื่อมใหม่…', 'bad'); });
    n.on('error', (m) => { this.screenError(m.text); if (this.inWorld) this.ui.flash(m.text); else this.ui.toast(m.text, 'bad'); });
    n.on('notice', (m) => this.ui.toast(m.text, m.kind === 'good' ? 'good' : m.kind === 'bad' ? 'bad' : m.kind === 'warn' ? 'warn' : 'info'));
    n.on('chars', (m) => { this.account = m.account; this.chars = m.chars; this.showCharSelect(); });
    n.on('zone', (m) => {
      this.audio.startBed(m.theme);
      if (this.inWorld) this.audio.play('warp');
      this.renderer.setZone(m);
      this.zone = m;
      this.grid = decodeGrid(m.rle, m.width * m.height);
      $('#zone-name').textContent = m.nameTh ?? m.name;
      $('#zone-range').textContent = m.levelRange ? `Lv.${m.levelRange[0]}-${m.levelRange[1]}` : (m.safe ? 'ปลอดภัย' : '');
      this.entities.clear();
      if (this.inWorld) this.ui.zoneBanner(m);
    });
    n.on('self', (m) => {
      this.self = m.self;
      this.state.myId = m.self.id;
      if (!this.inWorld) this.enterWorld();
      this.ui.renderHotbar(this.self);
      this.ui.updateVitals(this.self, this.state.you);
      if (this.ui.openPanels.has('character')) this.ui.open('character');
      if (this.ui.openPanels.has('skills')) this.ui.open('skills');
      this.renderPortrait();
    });
    n.on('inventory', (m) => {
      const before = this.inventory;
      this.inventory = m;
      if (this.inWorld && before) {
        const count = (inv) => (inv.items ?? []).reduce((a, it) => a + (it.qty ?? 1), 0);
        if (m.aurum > (before.aurum ?? 0)) this.audio.play('coin');
        else if (count(m) > count(before)) this.audio.play('loot');
      }
      this.ui.renderInventory();
    });
    n.on('snapshot', (m) => this.onSnapshot(m));
    n.on('chatMsg', (m) => this.ui.chat(m));
    n.on('npcDialog', (m) => this.ui.open('dialog', m));
    n.on('shop', (m) => this.ui.openShop(m));
    n.on('storage', (m) => this.ui.open('storage', m));
    n.on('market', (m) => this.ui.open('market', m));
    n.on('partyState', (m) => {
      this.ui.lastParty = m;
      if (this.ui.openPanels.has('party')) this.ui.open('party', m);
      if (m.invite) this.ui.toast(`${m.invite.from} ชวนเข้าปาร์ตี้ — เปิดเมนูปาร์ตี้เพื่อตอบรับ`, 'warn');
    });
    n.on('questState', (m) => {
      // only take over the screen when the player actually asked for the log
      this.ui.lastQuests = m.quests;
      if (this.ui.openPanels.has('quests') || this.ui.wantQuests) {
        this.ui.wantQuests = false;
        this.ui.openQuests(m.quests);
      }
    });
    n.on('tradeState', (m) => {
      if (m.invite) this.audio.play('warn');
      this.ui.tradeState(m);
    });
    n.on('questTrack', (m) => this.ui.renderQuestTrack(m.quests));
    n.on('died', (m) => this.onDied(m));
  }

  onSnapshot(m) {
    const now = performance.now();
    this.state.ground = m.ground;
    this.state.fx = m.fx;
    this.state.you = m.you;

    // entity interpolation buffers
    const seen = new Set();
    for (const e of m.ents) {
      seen.add(e.id);
      const prev = this.entities.get(e.id);
      if (prev) {
        prev.px = prev.x; prev.py = prev.y;
        prev.tx = e.x; prev.ty = e.y;
        prev.lerpAt = now;
        if (prev.a !== e.a) prev._animStart = now;
        Object.assign(prev, e, { x: prev.x, y: prev.y, px: prev.px, py: prev.py, tx: e.x, ty: e.y, _animStart: prev._animStart });
        if (e.hp < prev._lastHp) prev._hurtUntil = now + 200;
        prev._lastHp = e.hp;
      } else {
        this.entities.set(e.id, { ...e, px: e.x, py: e.y, tx: e.x, ty: e.y, lerpAt: now, _animStart: now, _lastHp: e.hp });
      }
    }
    for (const id of [...this.entities.keys()]) if (!seen.has(id)) this.entities.delete(id);

    // server correction for our own character
    const me = this.entities.get(this.state.myId);
    if (me && m.you) {
      const dx = m.you.x - this.predicted.x, dy = m.you.y - this.predicted.y;
      const d = Math.hypot(dx, dy);
      if (d > 48) { this.predicted.x = m.you.x; this.predicted.y = m.you.y; }
      else { this.predicted.x += dx * 0.25; this.predicted.y += dy * 0.25; }
      this.state.targetId = m.you.target;
      this.attacking = !!m.you.attacking;   // server may stop us; re-send if still held
      this.ui.updateVitals(this.self, m.you);
      this.ui.updateStatuses(m.you.statuses);
      this.ui.updateCast(m.you.cast);
      this.ui.tickHotbar(m.you.cooldowns);
      if (!m.you.alive) this.showDeath();
    }

    for (const ev of m.ev ?? []) this.onEvent(ev);
  }

  onEvent(ev) {
    const r = this.renderer;
    const ent = this.entities.get(ev.id);
    const at = ent ? { x: ent.x, y: ent.y - 30 } : null;
    switch (ev.t) {
      case 'dmg': {
        if (!at) break;
        const mine = ev.src === this.state.myId;
        const onMe = ev.id === this.state.myId;
        r.floater(String(ev.v), at.x, at.y, onMe ? '#ff9a9a' : ev.crit ? '#ffd166' : mine ? '#ffffff' : '#ffb3b3', ev.crit ? 15 : 12);
        if (onMe) r.shake = Math.min(6, ev.v / 30);
        this.audio.play(onMe ? 'hurt' : ev.crit ? 'crit' : 'hit', at, { gain: mine || onMe ? 1 : 0.55 });
        break;
      }
      case 'heal':
        if (at) { r.floater('+' + ev.v, at.x, at.y, '#7dffb0'); this.audio.play('heal', at); }
        break;
      case 'miss':
        if (at) { r.floater('พลาด', at.x, at.y, '#c8d2e0', 11); this.audio.play('miss', at); }
        break;
      case 'levelup':
        if (at) r.floater('LEVEL UP!', at.x, at.y - 10, '#ffd166', 18);
        if (ev.id === this.state.myId) {
          this.ui.toast(`เลเวลอัพ! Lv.${ev.level} / Job ${ev.jobLevel}`, 'good');
          this.audio.play('levelup');
        }
        break;
      case 'steal': this.ui.toast(`ขโมยได้ ${ITEMS[ev.item]?.nameTh ?? ev.item}`, 'good'); break;
      case 'fx':
        r.addFx(ev);
        this.audio.play(FX_SOUND[ev.fx] ?? 'cast', { x: ev.x, y: ev.y });
        break;
      case 'death':
        if (ev.id === this.state.myId) { this.audio.play('death'); this.showDeath(); }
        else this.audio.play('die', at);
        break;
      default: break;
    }
  }

  onDied(m) {
    this.audio.play('death');
    this.ui.toast(`คุณตาย — เสีย EXP ${m.expLost}`, 'bad');
    this.showDeath();
  }

  showDeath() {
    if (this.ui.openPanels.has('death')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = '<p>คุณล้มลง… กลับไปยังจุดบันทึกล่าสุด (เสีย EXP 5% ไม่เสียไอเทม)</p>';
    const b = document.createElement('button');
    b.className = 'btn primary';
    b.textContent = 'ฟื้นคืนชีพที่เมือง';
    b.addEventListener('click', () => { this.net.send({ t: 'respawn' }); this.ui.close('death'); });
    wrap.append(b);
    this.ui.panel('death', 'พ่ายแพ้', wrap);
  }

  /* ---------------- world loop ---------------- */
  enterWorld() {
    this.inWorld = true;
    this.predicted = { x: this.self.x, y: this.self.y };
    $('#screen').classList.add('hidden');
    $('#hud').classList.remove('hidden');
    $('#chat').classList.remove('hidden');
    preloadCommon(this.self.look);
    if (this.zone) this.ui.zoneBanner(this.zone);
    this.ui.toast('ยินดีต้อนรับสู่ Emberfall — กด F1 เพื่อดูปุ่มควบคุม');
  }

  loop(t) {
    requestAnimationFrame((t2) => this.loop(t2));
    const dt = Math.min(0.1, (t - (this._last ?? t)) / 1000);
    this._last = t;
    if (!this.inWorld) return;

    this.input.poll();
    this.handleActions();
    this.updateAuto(t);
    this.predictMovement(dt);
    this.interpolate(t);

    const me = this.entities.get(this.state.myId);
    if (me) { me.x = this.predicted.x; me.y = this.predicted.y; }
    this.state.ents = [...this.entities.values()];
    this.state.me = this.predicted;

    this.audio.listener = this.predicted ?? this.audio.listener;
    this.renderer.render(this.state, t);
    this.ui.updateTarget(this.entities.get(this.state.targetId));
    if (t - (this._miniAt ?? 0) > 200) {
      this._miniAt = t;
      this.ui.minimap(this.state, this.renderer);
      const coords = document.getElementById('coords');
      if (coords) coords.textContent = `(${Math.floor(this.predicted.x / TILE)}, ${Math.floor(this.predicted.y / TILE)})`;
    }
    if (this.state.you) this.ui.tickHotbar(this.state.you.cooldowns);
    this.input.endFrame();
  }

  toggleAuto() {
    this.auto = !this.auto;
    document.getElementById('btn-auto')?.classList.toggle('on', this.auto);
    this.ui.toast(this.auto ? 'สู้อัตโนมัติ: เปิด' : 'สู้อัตโนมัติ: ปิด', this.auto ? 'good' : 'info');
    if (!this.auto) {
      this.input.touchStick(0, 0);
      if (this.attacking) { this.attacking = false; this.net.send({ t: 'attack', on: false }); }
    }
  }

  /**
   * Hands-off grinding, entirely client side: pick the nearest hostile, close
   * the gap, swing, spend whatever skills are off cooldown, hoover up loot.
   * Manual input always wins - the moment you touch the keys, auto lets go.
   */
  updateAuto(now) {
    if (!this.auto || now - this.autoAt < 260) return;
    this.autoAt = now;
    const you = this.state.you;
    if (!you?.alive) { this.net.send({ t: 'respawn' }); return; }

    const me = this.predicted;
    const manual = this.input.keys.size > 0;

    for (const g of this.state.ground ?? []) {
      if (g.mine && Math.hypot(g.x - me.x, g.y - me.y) < 44) this.net.send({ t: 'pickup', uid: g.uid });
    }

    let best = null, bestD = 420;
    for (const e of this.entities.values()) {
      if (e.k !== 'm' || e.hp <= 0 || e.sum) continue;
      const d = Math.hypot(e.x - me.x, e.y - me.y);
      if (d < bestD) { best = e; bestD = d; }
    }
    if (!best) {
      if (!manual) this.input.touchStick(0, 0);
      if (this.attacking) { this.attacking = false; this.net.send({ t: 'attack', on: false }); }
      return;
    }

    if (this.state.targetId !== best.id) {
      this.state.targetId = best.id;
      this.net.send({ t: 'target', id: best.id });
    }
    const reach = (this.self?.derived?.attackRange ?? 40) + 20;
    if (!manual) {
      if (bestD > reach) this.input.touchStick((best.x - me.x) / bestD, (best.y - me.y) / bestD);
      else this.input.touchStick(0, 0);
    }
    if (!this.attacking) { this.attacking = true; this.net.send({ t: 'attack', on: true, id: best.id }); }

    // spend a ready skill, cheapest first so SP lasts
    const cds = you.cooldowns ?? {};
    const ready = (this.self?.hotbar ?? [])
      .map((id, i) => ({ id, i }))
      .filter((x) => x.id && (cds[x.id] ?? 0) < Date.now() && SKILLS[x.id]?.kind !== 'passive');
    if (ready.length && bestD <= (SKILLS[ready[0].id]?.range ?? 60) + 40) {
      this.useHotbar(ready[Math.floor(Math.random() * ready.length)].i);
    }
  }

  predictMovement(dt) {
    const mv = this.input.move;
    const speed = this.self?.derived?.moveSpeed ?? 110;
    if (mv.x || mv.y) {
      const len = Math.hypot(mv.x, mv.y) || 1;
      const nx = this.predicted.x + (mv.x / len) * speed * dt;
      const ny = this.predicted.y + (mv.y / len) * speed * dt;
      if (this.walkable(nx, this.predicted.y)) this.predicted.x = nx;
      if (this.walkable(this.predicted.x, ny)) this.predicted.y = ny;
    }
    // send at ~15 Hz, or immediately when the direction changes
    const now = performance.now();
    const changed = Math.abs(mv.x - this.lastInput.mx) > 0.08 || Math.abs(mv.y - this.lastInput.my) > 0.08;
    if (changed || now - this.lastInput.at > 66) {
      this.lastInput = { mx: mv.x, my: mv.y, at: now };
      this.net.send({ t: 'input', mx: mv.x, my: mv.y });
    }
  }

  walkable(x, y, r = 10) {
    if (!this.grid || !this.zone) return true;
    const blocked = (px, py) => {
      const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
      if (tx < 0 || ty < 0 || tx >= this.zone.width || ty >= this.zone.height) return true;
      return BLOCKING.has(this.grid[ty * this.zone.width + tx]);
    };
    return !blocked(x - r, y - r) && !blocked(x + r, y - r) && !blocked(x - r, y + r) && !blocked(x + r, y + r);
  }

  interpolate(t) {
    for (const e of this.entities.values()) {
      if (e.id === this.state.myId) continue;
      const k = Math.min(1, (t - e.lerpAt) / 100);
      e.x = e.px + (e.tx - e.px) * k;
      e.y = e.py + (e.ty - e.py) * k;
    }
  }

  /* ---------------- actions ---------------- */
  handleActions() {
    const inp = this.input;
    if (this.state.you && !this.state.you.alive) {
      if (this.attacking) { this.attacking = false; this.net.send({ t: 'attack', on: false }); }
      if (inp.consume('interact') || inp.consume('cancel')) this.net.send({ t: 'respawn' });
      for (let i = 1; i <= 6; i++) inp.consume('skill' + i);
      inp.consume('attack');
      return;
    }

    // attack is a hold: mirror it to the server only on change
    const wantAttack = inp.isHeld('attack');
    if (wantAttack !== this.attacking) {
      this.attacking = wantAttack;
      if (wantAttack) this.audio.play('swing');
      this.net.send({ t: 'attack', on: wantAttack, id: this.state.targetId });
    }

    if (inp.consume('targetNext')) this.cycleTarget(1);
    if (inp.consume('targetPrev')) this.cycleTarget(-1);
    if (inp.consume('interact')) this.interact();
    if (inp.consume('pickup')) this.pickupNearest();
    if (inp.consume('cancel')) {
      const justHandled = performance.now() - (this.ui.escHandledAt ?? -1e9) < 250;
      if (justHandled) { /* the UI already closed a panel for this press */ }
      else if (this.ui.openPanels.size) this.ui.closeTop();
      else { this.state.targetId = null; this.net.send({ t: 'target', id: null }); }
    }
    if (inp.consume('zoomOut')) this.setZoom(this.renderer.zoomStep - 1);
    if (inp.consume('zoomIn')) this.setZoom(this.renderer.zoomStep + 1);
    if (inp.consume('zoomCycle')) this.setZoom((this.renderer.zoomStep + 1) % 3);
    if (inp.consume('menu')) this.ui.toggle('inventory');
    if (inp.consume('map')) this.ui.toggle('quests');
    for (let i = 1; i <= 6; i++) if (inp.consume('skill' + i)) this.useHotbar(i - 1);
  }

  /** Camera distance, shared by the hotkeys, the pad and the settings panel. */
  setZoom(n) {
    const before = this.renderer.zoomStep;
    const step = this.renderer.setZoomStep(n);
    if (this.renderer.zoomStep !== before) this.ui.flash('มุมกล้อง: ' + step.label);
    if (this.ui.openPanels.has('settings')) this.ui.open('settings');
    return step;
  }

  cycleTarget(dir) {
    const me = this.predicted;
    const list = [...this.entities.values()]
      .filter((e) => e.k === 'm' && e.hp > 0 && !e.sum)
      .sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))
      .slice(0, 12);
    if (!list.length) return;
    const idx = list.findIndex((e) => e.id === this.state.targetId);
    const next = list[((idx + dir) % list.length + list.length) % list.length];
    this.state.targetId = next.id;
    this.net.send({ t: 'target', id: next.id });
  }

  nearest(kind, radius) {
    const me = this.predicted;
    let best = null, bestD = radius;
    for (const e of this.entities.values()) {
      if (kind && e.k !== kind) continue;
      const d = Math.hypot(e.x - me.x, e.y - me.y);
      if (d < bestD) { best = e; bestD = d; }
    }
    return best;
  }

  interact() {
    const npc = this.nearest('n', 90);
    if (npc) return this.net.send({ t: 'npcInteract', id: npc.id });
    this.pickupNearest();
  }

  pickupNearest() {
    const me = this.predicted;
    let best = null, bestD = 46;
    for (const g of this.state.ground ?? []) {
      const d = Math.hypot(g.x - me.x, g.y - me.y);
      if (d < bestD && g.mine) { best = g; bestD = d; }
    }
    if (best) this.net.send({ t: 'pickup', uid: best.uid });
  }

  useHotbar(i) {
    const skillId = this.self?.hotbar?.[i];
    if (!skillId) return;
    const sk = SKILLS[skillId];
    const msg = { t: 'skill', skill: skillId };
    if (sk?.target === 'enemy' || sk?.target === 'ally' || sk?.target === 'corpse') {
      msg.target = sk.target === 'enemy' ? this.state.targetId : this.state.myId;
      if (sk.target === 'ally' && this.state.targetId) {
        const tgt = this.entities.get(this.state.targetId);
        if (tgt?.k === 'p') msg.target = tgt.id;
      }
      if (!msg.target) return this.ui.toast('ต้องเลือกเป้าหมายก่อน', 'warn');
    }
    if (sk?.target === 'point') {
      const aim = this.input.aim;
      const target = this.entities.get(this.state.targetId);
      if (Math.hypot(aim.x, aim.y) > 0.3) {
        msg.point = { x: this.predicted.x + aim.x * 140, y: this.predicted.y + aim.y * 140 };
      } else if (target) {
        msg.point = { x: target.x, y: target.y };
      } else {
        const face = [[0, -1], [-1, 0], [0, 1], [1, 0]][this.entities.get(this.state.myId)?.d ?? 2];
        msg.point = { x: this.predicted.x + face[0] * 110, y: this.predicted.y + face[1] * 110 };
      }
    }
    this.net.send(msg);
  }

  renderPortrait() {
    const box = $('#portrait');
    // keep the level badge that lives in this box - only the canvas is ours
    let c = box.querySelector('canvas');
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 52;
      c.style.imageRendering = 'pixelated';
      box.prepend(c);
    }
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const layers = playerLayers(this.self.look, Object.fromEntries(
      Object.entries(this.self.equipment ?? {}).map(([slot, idx]) => [slot, this.inventory.items?.[idx]?.id]).filter(([, v]) => v)
    ));
    const draw = () => {
      ctx.clearRect(0, 0, 52, 52);
      ctx.save();
      ctx.translate(0, 8);
      ctx.scale(1.55, 1.55);
      drawCharacter(ctx, layers, { x: 17, y: 32, anim: 'idle', dir: 2, elapsed: 0 });
      ctx.restore();
      if (loadedRatio() < 1) setTimeout(draw, 250);
    };
    draw();
  }

  /* ---------------- screens ---------------- */
  screenError(text) { $('#screen-error').textContent = text ?? ''; }

  showLogin() {
    const body = $('#screen-body');
    body.innerHTML = `
      <div class="field"><label>ชื่อบัญชี</label><input id="acc" type="text" autocomplete="username" maxlength="16"></div>
      <div class="field"><label>รหัสผ่าน</label><input id="pw" type="password" autocomplete="current-password" maxlength="64"></div>
      <div class="opts"><button class="btn primary" id="btn-login">เข้าสู่ระบบ</button>
      <button class="btn" id="btn-reg">สมัครใหม่</button></div>`;
    const go = (t) => {
      this.screenError('');
      this.net.send({ t, name: $('#acc').value.trim(), password: $('#pw').value });
    };
    $('#btn-login').onclick = () => go('login');
    $('#btn-reg').onclick = () => go('register');
    $('#pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') go('login'); });
    $('#screen').classList.remove('hidden');
  }

  showCharSelect() {
    const body = $('#screen-body');
    body.innerHTML = `<p class="muted">บัญชี: ${this.account}</p><div id="char-list"></div>`;
    const list = $('#char-list');
    for (const c of this.chars) {
      const card = document.createElement('div');
      card.className = 'char-card';
      const cv = document.createElement('canvas');
      cv.width = 52; cv.height = 52;
      card.append(cv);
      const info = document.createElement('div');
      info.style.flex = '1';
      info.innerHTML = `<b>${c.name}</b><div class="muted">${JOBS[c.job]?.nameTh ?? c.job} · Lv.${c.level}/J${c.jobLevel} · ${c.map}</div>
        <div class="muted" style="color:var(--gold)">${Number(c.aurum).toLocaleString()} AU</div>`;
      card.append(info);
      const del = document.createElement('button');
      del.className = 'btn danger';
      del.textContent = 'ลบ';
      del.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`ลบตัวละคร ${c.name} ถาวร?`)) this.net.send({ t: 'charDelete', id: c.id });
      };
      card.append(del);
      card.onclick = () => this.net.send({ t: 'enter', id: c.id });
      list.append(card);

      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const layers = playerLayers(c.look, {});
      const paint = () => {
        ctx.clearRect(0, 0, 52, 52);
        drawCharacter(ctx, layers, { x: 26, y: 46, anim: 'idle', dir: 2, elapsed: 0 });
        if (loadedRatio() < 1) setTimeout(paint, 200);
      };
      paint();
    }
    const create = document.createElement('button');
    create.className = 'btn primary';
    create.textContent = '+ สร้างตัวละครใหม่';
    create.onclick = () => this.showCharCreate();
    body.append(create);
    $('#screen').classList.remove('hidden');
  }

  showCharCreate() {
    const look = { gender: 'male', body: 'light', hair: 'plain', hairColor: 'brown', eyes: 'brown' };
    const body = $('#screen-body');
    body.innerHTML = `
      <div class="field"><label>ชื่อตัวละคร</label><input id="cname" type="text" maxlength="16"></div>
      <div class="preview"><canvas id="cprev" width="128" height="128"></canvas></div>
      <div class="field"><label>เพศ</label><div class="opts" id="o-gender"></div></div>
      <div class="field"><label>ผิว</label><div class="opts" id="o-body"></div></div>
      <div class="field"><label>ทรงผม</label><div class="opts" id="o-hair"></div></div>
      <div class="field"><label>สีผม</label><div class="opts" id="o-hairColor"></div></div>
      <div class="field"><label>สีตา</label><div class="opts" id="o-eyes"></div></div>
      <p class="muted">เริ่มเป็น "ผู้แรกเริ่ม" — พอ Job Lv.10 ค่อยไปหาครูฝึกฮาลด์ที่เอมเบอร์โฮลด์เพื่อเลือกอาชีพ</p>
      <div class="opts"><button class="btn primary" id="btn-create">สร้าง</button><button class="btn" id="btn-back">ย้อนกลับ</button></div>`;

    const cv = $('#cprev'), ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    let frame = 0;
    const paint = () => {
      if (!document.body.contains(cv)) return;
      ctx.clearRect(0, 0, 128, 128);
      ctx.save();
      ctx.scale(1.6, 1.6);
      drawCharacter(ctx, playerLayers(look, {}), { x: 40, y: 74, anim: 'walk', dir: 2, elapsed: (frame += 16) * 4 });
      ctx.restore();
      requestAnimationFrame(paint);
    };
    paint();

    const options = {
      gender: [['male', 'ชาย'], ['female', 'หญิง']],
      body: [['light', 'ขาว'], ['tanned', 'แทน'], ['dark', 'เข้ม'], ['darkelf', 'ดาร์กเอลฟ์']],
      hair: [['plain', 'เรียบ'], ['messy', 'ยุ่ง'], ['long', 'ยาว'], ['ponytail', 'หางม้า']],
      hairColor: [['black', 'ดำ'], ['brown', 'น้ำตาล'], ['blonde', 'ทอง'], ['white', 'ขาว']],
      eyes: [['blue', 'ฟ้า'], ['brown', 'น้ำตาล'], ['green', 'เขียว'], ['red', 'แดง']],
    };
    for (const [key, vals] of Object.entries(options)) {
      const box = $('#o-' + key);
      for (const [v, label] of vals) {
        const b = document.createElement('button');
        b.className = 'opt' + (look[key] === v ? ' sel' : '');
        b.textContent = label;
        b.onclick = () => {
          look[key] = v;
          for (const sib of box.children) sib.classList.remove('sel');
          b.classList.add('sel');
        };
        box.append(b);
      }
    }
    $('#btn-create').onclick = () => {
      this.screenError('');
      this.net.send({ t: 'charCreate', name: $('#cname').value.trim(), ...look });
    };
    $('#btn-back').onclick = () => this.showCharSelect();
  }
}

// exposed for debugging and for automated smoke tests
window.__game = new Game();
