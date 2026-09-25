// Bootstrap: screens -> world loop. Owns client state and talks to server.
import { Net } from './net.js';
import { vecOf } from '../../shared/facing.js';
import { Input, bindTouchControls } from './input.js';
import { Renderer, ZOOM_STEPS } from './renderer.js';
import { UI, loadTheme, GIVER_ROLE, questKind, bossPhase } from './ui.js';
import { Audio } from './audio.js';
import { findPath, zoneRoute, warpTo, sourceOf, huntingGround, homeOf } from './autowalk.js';
import { preloadCommon, playerLayers, drawCharacter, loadedRatio } from './sprites.js';
import { TILE } from '../../shared/constants.js';
import { BLOCKING, decodeGrid } from '../../shared/data/maps.js';
import { ITEMS } from '../../shared/data/items.js';
import { rgba as elRgba, triple as elTriple } from '../../shared/elements.js';
import { SKILLS } from '../../shared/data/skills.js';
import { JOBS, STARTING_STATS } from '../../shared/data/jobs.js';
import { deriveStats } from '../../shared/formulas.js';
import { AdminPanel } from './admin.js';

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
    this.nav = null;          // the quest we are walking to, see startQuestNav

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
      this.watchOrientation();
    }
    this.syncLayout();
    addEventListener('resize', () => this.syncLayout());
    this.input.onPadChange = (connected, id) => {
      this.ui.toast(connected ? `เชื่อมต่อจอยแล้ว: ${id?.slice(0, 28) ?? ''}` : 'ถอดจอยออกแล้ว', connected ? 'good' : 'warn');
    };

    requestAnimationFrame((t) => this.loop(t));
    this.showLogin();
  }

  /**
   * `landscape-ui` drives the compact, wide layout. A media query cannot
   * see a page we rotated ourselves, so the class is set here instead.
   */
  syncLayout() {
    // the compact layout is for phones on their side and for genuinely short
    // windows - a desktop browser is wide, but it is not short
    const touch = document.body.classList.contains('touch');
    const phoneOnItsSide = touch && innerWidth > innerHeight;
    const compact = this.forcedLandscape || phoneOnItsSide || innerHeight <= 520;
    document.body.classList.toggle('landscape-ui', compact);
    // Phones differ a lot in size: the whole HUD scales with the screen so a
    // small phone gets small buttons instead of a screen full of them. The
    // turned page swaps the sides, so measure the long and short edge.
    const long = this.forcedLandscape ? innerHeight : Math.max(innerWidth, innerHeight);
    const short = this.forcedLandscape ? innerWidth : Math.min(innerWidth, innerHeight);
    const k = compact ? Math.max(0.58, Math.min(1, long / 1000, short / 480)) : 1;
    const root = document.documentElement.style;
    root.setProperty('--hud-k', k.toFixed(3));
    // thumbs do not shrink with the screen: the touch pad keeps a size you can hit
    root.setProperty('--touch-k', Math.max(0.82, Math.min(1, k * 1.2)).toFixed(3));
    root.setProperty('--ui-k', compact ? Math.max(0.62, Math.min(0.8, k * 0.92)).toFixed(3) : '1');
  }

  /** Turn the whole page a quarter turn, for browsers that will not. */
  setForcedLandscape(on) {
    this.forcedLandscape = on;
    document.body.classList.toggle('forced-landscape', on);
    this.input.rotated = on;
    this.syncLayout();
    this.renderer.resize();
  }

  /**
   * The game wants a wide screen: on a phone held upright there is no room
   * for both the world and the controls. Ask for a rotate, try to do it for
   * them, and if the browser refuses - an iframe, or iOS, which has no lock
   * API - turn the page ourselves.
   */
  watchOrientation() {
    // The game is landscape only. A phone held upright gets the page turned a
    // quarter for it straight away - no question first - and the first tap
    // also asks the browser for fullscreen and a real landscape lock, which
    // replaces our turned page as soon as the screen actually rotates.
    $('#rotate')?.classList.add('hidden');
    const portrait = () => innerHeight > innerWidth;
    const touch = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    const update = () => {
      const want = touch() && portrait();
      if (want !== !!this.forcedLandscape) this.setForcedLandscape(want);
      else this.syncLayout();
    };
    const lockOnce = async () => {
      if (!touch()) return;
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
      } catch { /* refused: the turned page stays */ }
      try { await screen.orientation?.lock?.('landscape'); } catch { /* iOS / iframes cannot lock */ }
      setTimeout(update, 350);
    };
    addEventListener('pointerdown', lockOnce, { once: true });
    addEventListener('resize', update);
    addEventListener('orientationchange', () => setTimeout(update, 120));
    screen.orientation?.addEventListener?.('change', update);
    update();
  }

  /* ---------------- networking ---------------- */
  wireNet() {
    const n = this.net;
    n.on('_open', () => this.ui.toast('เชื่อมต่อเซิร์ฟเวอร์แล้ว', 'good'));
    n.on('_close', () => { if (this.inWorld) this.ui.toast('หลุดการเชื่อมต่อ กำลังเชื่อมใหม่…', 'bad'); });
    n.on('error', (m) => { this.screenError(m.text); if (this.inWorld) this.ui.flash(m.text); else this.ui.toast(m.text, 'bad'); });
    n.on('notice', (m) => {
      this.ui.toast(m.text, m.kind === 'good' ? 'good' : m.kind === 'bad' ? 'bad' : m.kind === 'warn' ? 'warn' : 'info');
      // a door that needs a party is not something to keep walking into
      if (m.gate && this.nav) this.stopNav('ประตูนี้ต้องมีปาร์ตี้ — หยุดเดินอัตโนมัติแล้ว');
    });
    n.on('chars', (m) => { this.account = m.account; this.chars = m.chars; this.showCharSelect(); });
    n.on('zone', (m) => {
      this.audio.startBed(m.theme);
      if (this.inWorld) this.audio.play('warp');
      this.renderer.setZone(m);
      this.ui.updateClock();                 // the new zone may have its own sky
      this.zone = m;
      this.grid = decodeGrid(m.rle, m.width * m.height);
      $('#zone-name').textContent = m.nameTh ?? m.name;
      $('#zone-range').textContent = m.levelRange ? `Lv.${m.levelRange[0]}-${m.levelRange[1]}` : (m.safe ? 'ปลอดภัย' : '');
      this.entities.clear();
      if (this.inWorld) this.ui.zoneBanner(m);
      if (this.nav) setTimeout(() => this.planNav(), 400);
    });
    n.on('self', (m) => {
      this.self = m.self;
      (this.admin ??= new AdminPanel(this)).sync(this.self);
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
      this.ui.noteSeen(m, false);            // the first bag of the session is the NEW baseline
      if (this.inWorld && before) {
        const count = (inv) => (inv.items ?? []).reduce((a, it) => a + (it.qty ?? 1), 0);
        if (m.aurum > (before.aurum ?? 0)) this.audio.play('coin');
        else if (count(m) > count(before)) this.audio.play('loot');
      }
      this.ui.renderInventory();
      // the portrait wears what is equipped, and the worn items live here
      if (this.self) this.renderPortrait();
    });
    n.on('snapshot', (m) => this.onSnapshot(m));
    n.on('chatMsg', (m) => this.ui.chat(m));
    n.on('npcDialog', (m) => this.ui.open('dialog', m));
    n.on('shop', (m) => this.ui.openShop(m));
    n.on('gachaResult', (m) => this.ui.showGachaResult(m));
    n.on('worldNotice', (m) => this.ui.worldNotice(m));
    n.on('boxOpened', (m) => {
      this.audio.play(m.rarity === 'common' ? 'loot' : 'levelup');
      this.ui.renderInventory();
    });
    n.on('storage', (m) => this.ui.open('storage', m));
    n.on('market', (m) => this.ui.open('market', m));
    n.on('partyState', (m) => {
      const hadInvite = this.ui.lastParty?.invite?.at;
      this.ui.lastParty = m;
      this.ui.renderPartyFrames();
      // the once-a-second refresh keeps the frames live; the window only
      // redraws when it is on the party tab and nothing is being typed
      if (this.ui.openPanels.has('party') && (this.ui.socialTab ?? 'party') === 'party'
        && document.activeElement?.tagName !== 'INPUT') this.ui.openParty(m);
      if (m.invite && m.invite.at !== hadInvite) this.ui.popInvite('party', m.invite);
    });
    n.on('friendState', (m) => this.ui.setFriends(m));
    n.on('partyJoined', () => this.ui.stamp('party_joined'));
    n.on('partyLeft', () => { this.ui.lastParty = { party: null }; this.ui.renderPartyFrames(); this.ui.stamp('party_left'); });
    n.on('newFriend', (m) => { this.ui.stamp('new_friend'); this.ui.toast(`${m.name} เป็นเพื่อนกับคุณแล้ว`, 'good'); });
    n.on('stall', (m) => {
      if (m.view !== undefined) return m.view ? this.ui.open('stallView', m.view) : this.ui.close('stallView');
      this.ui.lastStall = m;
      if (m.why) this.ui.toast(m.why, 'info');
      if (this.ui.openPanels.has('stall')) this.ui.open('stall', m);
    });
    n.on('guildState', (m) => {
      this.ui.lastGuild = m;
      if (this.ui.openPanels.has('guild') && document.activeElement?.tagName !== 'INPUT') this.ui.open('guild', m);
      if (m.invite) this.ui.popInvite('guild', m.invite);
    });
    n.on('guildJoined', () => this.ui.stamp('guild_welcome'));
    n.on('guildGoal', (m) => { this.ui.stamp('guild_bubble_strong'); this.ui.toast(`ภารกิจกิลด์สำเร็จ: ${m.name}`, 'good'); });
    n.on('guildLevelUp', (m) => { this.ui.stamp('h2_fx_levelup'); this.ui.toast(`กิลด์เลเวลอัพเป็น Lv.${m.level}!`, 'good'); });
    n.on('questState', (m) => {
      // only take over the screen when the player actually asked for the log
      this.ui.lastQuests = m.quests;
      if (this.ui.openPanels.has('quests') || this.ui.wantQuests) {
        this.ui.wantQuests = false;
        this.ui.openQuests(m.quests);
      }
      // the job window shows trial progress, so it wants the fresh log too
      if (this.ui.openPanels.has('jobchange')) this.ui.openJobChange();
      this.updateQuestMarks();
    });
    n.on('tradeState', (m) => {
      if (m.invite) this.audio.play('warn');
      this.ui.tradeState(m);
    });
    n.on('questTrack', (m) => { this.ui.renderQuestTrack(m.quests); this.updateQuestMarks(); });
    n.on('questClear', () => this.ui.stamp('h2_fx_questclear'));
    n.on('buyback', (m) => this.ui.setBuyback(m.items));
    n.on('refineResult', (m) => this.ui.onRefineResult(m));
    n.on('died', (m) => this.onDied(m));
  }

  onSnapshot(m) {
    const now = performance.now();
    this.state.ground = m.ground;
    this.state.fx = m.fx;
    this.state.stalls = m.stalls ?? [];
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
        // a new swing restarts the animation even when its name is unchanged
        if (prev.a !== e.a || (e.ast !== undefined && e.ast !== prev.ast)) prev._animStart = now;
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
      this.state.lockOn = this.attacking;
      this.ui.updateVitals(this.self, m.you);
      this.ui.updateStatuses(m.you.statuses);
      this.ui.updateCast(m.you.cast);
      this.ui.tickHotbar(m.you.cooldowns);
      if (!m.you.alive) this.ui.showDeath(this.lastDeath ?? {});
      else { this.lastDeath = null; this.ui.hideDeath(); }
    }

    this.watchBosses();
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
        const el = ev.el ?? 'neutral';
        r.floater(String(ev.v), at.x, at.y,
          onMe ? '#ff9a9a' : ev.crit ? elRgba(el, 'core', 1) : mine ? '#ffffff' : '#ffb3b3',
          ev.crit ? 17 : 12, { crit: ev.crit, digits: mine && !onMe });
        if (mine && !onMe) this.ui.comboHit();
        if (ev.crit) r.floater('CRITICAL', at.x, at.y - 16, '#ff6a4a', 26, { vx: 0, crit: true, img: 'h2_fx_critical' });
        // the blow shoves the body, bursts in its own element, and a crit
        // holds the frame for a moment
        r.impact(ev.id, { x: ent.x, y: ent.y, from: this.entities.get(ev.src), el, crit: !!ev.crit });
        if (onMe) r.shake = Math.min(6, ev.v / 30);
        else if (ev.crit && mine) r.shake = Math.max(r.shake, 3);
        this.audio.play(onMe ? 'hurt' : ev.crit ? 'crit' : 'hit', at, { gain: mine || onMe ? 1 : 0.55 });
        r.spark(ent.x, ent.y - 16, ev.crit
          ? { color: elTriple(el, 'core'), n: 14, power: 1.8 }
          : onMe ? { color: '255,140,140', n: 5 } : { color: elTriple(el, 'main'), n: 6 });
        break;
      }
      case 'heal':
        if (at) {
          r.floater('+' + ev.v, at.x, at.y, '#7dffb0');
          r.spark(ent.x, ent.y - 18, { color: '140,255,180', n: 6, power: 0.7 });
          this.audio.play('heal', at);
        }
        break;
      case 'miss':
        if (at) { r.floater('พลาด', at.x, at.y, '#c8d2e0', 20, { img: 'h2_fx_miss' }); this.audio.play('miss', at); }
        break;
      case 'levelup':
        if (ent) r.ascend(ent, { mine: ev.id === this.state.myId });
        if (at) r.floater('LEVEL UP!', at.x, at.y - 10, '#ffd166', 44, { vx: 0, img: 'h2_fx_levelup' });
        if (ev.id === this.state.myId) {
          this.ui.toast(`เลเวลอัพ! Lv.${ev.level} / Job ${ev.jobLevel}`, 'good');
          this.net.send({ t: 'quest', cmd: 'list' });   // new work may have opened up
          this.audio.play('levelup');
        }
        break;
      case 'ascend':
        if (ent) r.ascend(ent, { big: true, mine: ev.id === this.state.myId });
        if (at) r.floater(ev.jobTh ?? 'JOB CHANGE', at.x, at.y - 14, '#ffe9a0', 20, { vx: 0 });
        this.audio.play('levelup', at, { gain: 1.3 });
        break;
      case 'steal': this.ui.toast(`ขโมยได้ ${ITEMS[ev.item]?.nameTh ?? ev.item}`, 'good'); break;
      case 'fx':
        r.addFx(ev);
        this.audio.play(FX_SOUND[ev.fx] ?? 'cast', { x: ev.x, y: ev.y });
        break;
      case 'warn':
        r.warn(ev);
        this.audio.play('cast', { x: ev.x, y: ev.y }, { gain: 0.5 });
        break;
      case 'boss': {
        // the fight talks: phase changes and what to do about them
        this.ui.chat({ ch: 'system', text: ev.say });
        const phase = ent ? bossPhase(ent) : 0;
        const was = this.bossSeen?.get(ev.id);
        if (ent && phase !== was && phase > 1) {
          this.bossSeen?.set(ev.id, phase);
          this.ui.banner('phase', `Phase ${phase} เปลี่ยน!!`, ev.say);
        } else this.ui.banner('aoe', ev.say);
        break;
      }
      case 'death':
        if (ent) r.death(ent, { el: ev.el, boss: !!ev.boss, me: ev.id === this.state.myId });
        if (ev.id === this.state.myId) { this.audio.play('death'); this.ui.showDeath(this.lastDeath ?? {}); }
        else if (ev.boss && ent) {
          this.bossSeen?.delete(ev.id);
          const me = this.entities.get(this.state.myId);
          if (me && this.state.you?.alive && Math.hypot(me.x - ent.x, me.y - ent.y) < 700) {
            this.ui.banner('victory', `โค่น ${ent.n} แล้ว!!`, 'ตรวจดูของดรอปรอบตัว');
          }
        }
        else this.audio.play('die', at, ev.boss ? { gain: 1.4 } : undefined);
        break;
      default: break;
    }
  }

  onDied(m) {
    this.audio.play('death');
    this.lastDeath = m;
    this.ui.hideDeath();          // a screen opened by the death event lacks who did it
    this.ui.showDeath(m);
  }

  /**
   * Bosses announce themselves: a banner the first time one comes into view,
   * another when the fight turns a phase, and Victory when it falls near you.
   */
  watchBosses() {
    this.bossSeen ??= new Map();
    for (const e of this.entities.values()) {
      if (!e.boss || e.k !== 'm' || e.hp <= 0) continue;
      if (!this.bossSeen.has(e.id)) {
        this.bossSeen.set(e.id, bossPhase(e));
        this.ui.banner('boss', 'BOSS', `${e.n} กำลังเข้าสู่สนาม!`);
      }
    }
  }

  /* ---------------- world loop ---------------- */
  /**
   * Who has something for you: a gold "?" over anyone waiting on a finished
   * quest, otherwise a "!" coloured by the best new quest they offer.
   */
  updateQuestMarks() {
    const marks = {};
    const rank = { ready: 5, main: 4, daily: 3, event: 2, sub: 1 };
    const put = (giver, kind) => {
      const role = GIVER_ROLE[giver] ?? giver;
      if (rank[kind] > (rank[marks[role]] ?? 0)) marks[role] = kind;
    };
    for (const q of this.ui.trackedQuests ?? []) if (q.done) put(q.giver, 'ready');
    for (const q of this.ui.lastQuests ?? []) if (!q.state || q.state.done) put(q.giver, questKind(q));
    this.state.questMarks = marks;
  }

  enterWorld() {
    if (!this.inWorld) this.net.send({ t: 'quest', cmd: 'list' });   // for the marks over givers' heads
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
    this.updateNav(t);
    this.updateAuto(t);
    this.predictMovement(dt);
    this.interpolate(t);

    const me = this.entities.get(this.state.myId);
    if (me) { me.x = this.predicted.x; me.y = this.predicted.y; }
    this.state.ents = [...this.entities.values()];
    this.state.me = this.predicted;
    // the renderer marks whatever is far enough above you to hunt on sight
    this.state.myLevel = this.self?.level ?? 1;

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
      this.input.autoStick(0, 0);
      if (this.attacking) { this.attacking = false; this.net.send({ t: 'attack', on: false }); }
    }
  }

  /* ---------------- auto-travel ---------------- */

  /**
   * Walk to what a quest is asking for. Kill and collect objectives head for
   * the ground the monster lives on - crossing zones through the warps when
   * it is somewhere else - and switch auto-battle on when they arrive.
   * Anything finished heads back to whoever handed it out.
   */
  startQuestNav(quest) {
    if (this.nav?.questId === quest.id) return this.stopNav('ยกเลิกเดินอัตโนมัติ');
    this.nav = { questId: quest.id, quest, phase: 'travel', path: null, at: 0, said: false };
    this.ui.toast(`เดินอัตโนมัติ: ${quest.name}`, 'good');
    this.ui.renderQuestTrack(this.ui.trackedQuests);
    this.planNav();
  }

  stopNav(reason) {
    if (!this.nav) return;
    this.nav = null;
    this.input.autoStick(0, 0);
    if (reason) this.ui.toast(reason, 'info');
    this.ui.renderQuestTrack(this.ui.trackedQuests);
  }

  /** Where does this quest want us right now? */
  navTarget() {
    const nav = this.nav;
    if (!nav) return null;
    const q = nav.quest;
    const tracked = (this.ui.trackedQuests ?? []).find((x) => x.id === q.id);
    const done = tracked ? tracked.done : false;

    // finished: go and hand it in
    if (done || nav.phase === 'return') {
      const giverRole = GIVER_ROLE[q.giver] ?? 'quests';
      return { map: q.giverMap ?? 'emberhold', role: giverRole, kind: 'turnin' };
    }

    // a kill or collect objective: go where that monster lives
    for (const o of q.objectives ?? []) {
      const mob = o.type === 'kill' ? o.mob : o.type === 'collect' ? sourceOf(o.item, this.zone?.id) : null;
      if (!mob) continue;
      const map = homeOf(mob) ?? q.zone ?? this.zone?.id;
      return { map, mob, kind: 'hunt' };
    }
    return { map: q.zone ?? 'emberhold', kind: 'travel' };
  }

  /** Lay out the next leg: a path in this zone, or the warp that leaves it. */
  planNav() {
    const nav = this.nav;
    if (!nav || !this.zone || !this.grid) return;
    const target = this.navTarget();
    if (!target) return this.stopNav(null);
    nav.target = target;

    let goal = null;
    if (target.map !== this.zone.id) {
      const route = zoneRoute(this.zone.id, target.map);
      if (!route) return this.stopNav('ไปโซนนั้นด้วยการเดินไม่ได้');
      goal = warpTo(this.zone, route[1]);
      nav.leg = 'warp';
    } else if (target.kind === 'turnin') {
      const npc = [...this.entities.values()].find((e) => e.k === 'n' && e.role === target.role);
      goal = npc ? { x: npc.x, y: npc.y } : null;
      nav.npcId = npc?.id ?? null;
      nav.leg = 'npc';
    } else if (target.mob) {
      const live = [...this.entities.values()]
        .filter((e) => e.k === 'm' && e.hp > 0 && e.def === target.mob)
        .sort((a, b) => Math.hypot(a.x - this.predicted.x, a.y - this.predicted.y)
          - Math.hypot(b.x - this.predicted.x, b.y - this.predicted.y))[0];
      goal = live ? { x: live.x, y: live.y } : huntingGround(this.zone.id, target.mob);
      nav.leg = 'hunt';
    } else {
      goal = { x: (this.zone.width / 2) * TILE, y: (this.zone.height / 2) * TILE };
      nav.leg = 'travel';
    }
    if (!goal) return this.stopNav('หาจุดหมายไม่เจอ');

    nav.goal = goal;
    nav.path = findPath(this.grid, this.zone.width, this.zone.height, this.predicted, goal) ?? [];
    nav.index = 0;
  }

  /** Steer along the planned path, one waypoint at a time. */
  updateNav(now) {
    const nav = this.nav;
    if (!nav || !this.inWorld) return;
    if (this.input.manualRecently() || this.ui.openPanels.size > 1) return;   // the player is driving
    if (!this.state.you?.alive) return this.stopNav('ตายระหว่างทาง — หยุดเดินอัตโนมัติ');

    // once the fighting starts, auto-battle does the steering until the
    // objective ticks over - two systems pushing the stick is one too many
    if (nav.phase === 'fight') {
      const tracked = (this.ui.trackedQuests ?? []).find((x) => x.id === nav.questId);
      if (tracked?.done) {
        nav.phase = 'return';
        if (this.auto) this.toggleAuto();
        this.planNav();
      } else if (!this.auto) {
        this.toggleAuto();
      }
      return;
    }

    // re-plan a few times a second: monsters move, and zones change under us
    if (now - nav.at > 900) {
      nav.at = now;
      this.planNav();
    }
    if (!nav.path) return;

    const me = this.predicted;
    const wp = nav.path[nav.index];
    if (!wp) return this.arriveNav();
    const dx = wp.x - me.x, dy = wp.y - me.y;
    const d = Math.hypot(dx, dy);
    if (d < 20) { nav.index++; return; }
    this.input.autoStick(dx / d, dy / d);
  }

  /** The path ran out: fight, talk, or wait for the warp to take us. */
  arriveNav() {
    const nav = this.nav;
    if (!nav) return;
    this.input.autoStick(0, 0);
    if (nav.leg === 'warp') return;              // standing on the pad; the server warps us

    if (nav.leg === 'npc') {
      const tracked = (this.ui.trackedQuests ?? []).find((x) => x.id === nav.questId);
      if (nav.npcId) this.net.send({ t: 'npcInteract', id: nav.npcId });
      if (tracked?.done) this.net.send({ t: 'quest', cmd: 'complete', id: nav.questId });
      this.ui.close('dialog');
      this.stopNav('ส่งภารกิจแล้ว');
      return;
    }
    if (nav.leg === 'hunt') {
      nav.phase = 'fight';
      if (!this.auto) this.toggleAuto();           // arrived at the hunting ground
      if (!nav.said) { nav.said = true; this.ui.toast('ถึงจุดล่าแล้ว — เปิดสู้อัตโนมัติให้', 'good'); }
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
    const manual = this.input.manualRecently();

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
      if (!manual) this.input.autoStick(0, 0);
      if (this.attacking) { this.attacking = false; this.net.send({ t: 'attack', on: false }); }
      return;
    }

    if (this.state.targetId !== best.id) {
      this.state.targetId = best.id;
      this.net.send({ t: 'target', id: best.id });
    }
    const reach = (this.self?.derived?.attackRange ?? 40) + 20;
    if (!manual) {
      if (bestD > reach) this.input.autoStick((best.x - me.x) / bestD, (best.y - me.y) / bestD);
      else this.input.autoStick(0, 0);
    }
    if (!this.attacking) { this.attacking = true; this.net.send({ t: 'attack', on: true, id: best.id }); }

    // spend a ready skill - only the ones the player allowed auto to use,
    // in hotbar order, and a heal only when it is actually needed
    if (now - (this.autoSkillAt ?? 0) < 700) return;
    const cds = you.cooldowns ?? {};
    const hpPct = (you.hp ?? this.self?.hp ?? 1) / Math.max(1, you.maxHp ?? this.self?.maxHp ?? 1);
    const pick = (this.self?.hotbar ?? []).map((id, i) => ({ id, i, sk: SKILLS[id] })).find((x) => {
      if (!x.sk || x.sk.kind === 'passive' || (cds[x.id] ?? 0) >= Date.now()) return false;
      if (!this.autoSkillOn(x.id)) return false;
      if (x.sk.kind === 'heal') return hpPct < 0.5;
      if (x.sk.target === 'enemy' || x.sk.target === 'point') return bestD <= (x.sk.range ?? 60) + 40;
      return bestD <= reach + 60;          // self-centred bursts: only with a foe in reach
    });
    if (pick) { this.autoSkillAt = now; this.useHotbar(pick.i); }
  }

  /** May auto-battle cast this skill? Attacks yes, heals yes (below half HP),
   *  buffs/dashes/revives no - unless the player flipped it in the skills window. */
  autoSkillOn(id) {
    const own = this.autoPrefs()[id];
    if (own !== undefined) return own;
    const kind = SKILLS[id]?.kind;
    return !['buff', 'dash', 'revive', 'summon', 'passive'].includes(kind);
  }

  setAutoSkill(id, on) {
    const prefs = this.autoPrefs();
    prefs[id] = !!on;
    try { localStorage.setItem('ef.autoSkills', JSON.stringify(prefs)); } catch { /* private mode */ }
  }

  autoPrefs() {
    if (!this._autoPrefs) {
      try { this._autoPrefs = JSON.parse(localStorage.getItem('ef.autoSkills') ?? '{}') ?? {}; }
      catch { this._autoPrefs = {}; }
    }
    return this._autoPrefs;
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
      else if (this.state.you?.cast) this.net.send({ t: 'castCancel' });
      else if (this.ui.openPanels.size) this.ui.closeTop();
      else { this.state.targetId = null; this.net.send({ t: 'target', id: null }); }
    }
    if (inp.consume('zoomOut')) this.setZoom(this.renderer.zoomStep - 1);
    if (inp.consume('zoomIn')) this.setZoom(this.renderer.zoomStep + 1);
    if (inp.consume('zoomCycle')) this.setZoom((this.renderer.zoomStep + 1) % ZOOM_STEPS.length);
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
    // A stall answers to the same button an NPC shop does, because to the
    // person walking up to it that is exactly what it is.
    const stall = this.nearestStall(120);
    if (stall) return this.net.send({ t: 'stallBrowse', seller: stall.id });
    this.pickupNearest();
  }

  nearestStall(range) {
    const me = this.predicted;
    let best = null, bestD = range;
    for (const sg of this.state.stalls ?? []) {
      if (sg.id === this.state.myId) continue;
      const e = this.entities.get(sg.id);
      if (!e) continue;
      const d = Math.hypot(e.x - me.x, e.y - me.y);
      if (d < bestD) { best = sg; bestD = d; }
    }
    return best;
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
        const face = vecOf(this.entities.get(this.state.myId)?.d ?? 0);
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
      const chibi = this.self.look?.style === 'chibi';
      drawCharacter(ctx, layers, { x: 17, y: 32, anim: 'idle', dir: 0, elapsed: 0, scale: chibi ? 0.65 : 1 });
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
    $('#screen').classList.remove('creating');
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
      const layers = playerLayers(c.look, c.worn ?? {});
      const paint = () => {
        ctx.clearRect(0, 0, 52, 52);
        drawCharacter(ctx, layers, { x: 26, y: 46, anim: 'idle', dir: 0, elapsed: 0, scale: c.look?.style === 'chibi' ? 0.9 : 1 });
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
    const look = { style: 'chibi', gender: 'male', body: 'light', hair: 'plain', chibiHair: 'spiky', hairColor: 'brown', eyes: 'brown' };
    const stats = { ...STARTING_STATS };
    // dir is one of the eight (shared/facing.js DIR8): 0 faces the camera
    const view = { dir: 0, anim: 'walk', spin: true };
    const body = $('#screen-body');
    $('#screen').classList.add('creating');
    body.innerHTML = `
      <div class="cc">
        <div class="cc-left">
          <div class="cc-stage"><canvas id="cprev" width="220" height="220"></canvas></div>
          <div class="opts" id="o-dir"></div>
          <div class="opts" id="o-anim"></div>
          <button class="btn" id="btn-random">🎲 สุ่มรูปลักษณ์</button>
        </div>
        <div class="cc-right">
          <div class="field">
            <label>ชื่อตัวละคร <span class="muted" id="name-hint">3–16 ตัวอักษร</span></label>
            <div class="opts"><input id="cname" type="text" maxlength="16"><button class="btn" id="btn-roll-name">สุ่มชื่อ</button></div>
          </div>
          <div class="field"><label>สไตล์ตัวละคร <span class="muted" id="style-hint"></span></label><div class="opts" id="o-style"></div></div>
          <div class="field lpc-only"><label>เพศ</label><div class="opts" id="o-gender"></div></div>
          <div class="field lpc-only"><label>ผิว</label><div class="opts" id="o-body"></div></div>
          <div class="field lpc-only"><label>ทรงผม</label><div class="opts" id="o-hair"></div></div>
          <div class="field chibi-only"><label>ทรงผม</label><div class="opts" id="o-chibiHair"></div></div>
          <div class="field"><label>สีผม</label><div class="opts" id="o-hairColor"></div></div>
          <div class="field lpc-only"><label>สีตา</label><div class="opts" id="o-eyes"></div></div>
          <div class="field"><label>เมืองเริ่มต้น</label><div class="opts" id="o-start"></div></div>
          <hr>
          <div class="field"><label>แนวทางเริ่มต้น <span class="muted">แจกแต้มให้ก่อน ปรับเองได้</span></label>
            <div class="opts" id="o-path"></div></div>
          <div class="field">
            <label>แต้มสถิติ <span class="muted" id="pts-left"></span></label>
            <div id="statrows"></div>
          </div>
          <div class="cc-derived" id="derived"></div>
        </div>
      </div>
      <p class="muted">เริ่มเป็น "ผู้แรกเริ่ม" — พอ <b>เลเวล 10</b> ไปหาครูฝึกฮาลด์ที่เอมเบอร์โฮลด์เพื่อเลือกอาชีพ
        สถิติที่แจกตอนนี้แค่ทำให้ช่วงต้นถนัดมือ ไม่ได้ล็อกอาชีพในอนาคต</p>
      <div class="opts"><button class="btn primary" id="btn-create">สร้าง</button><button class="btn" id="btn-back">ย้อนกลับ</button></div>`;

    /* ---- the preview: turns on its own so every side gets seen ---- */
    const cv = $('#cprev'), ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    let elapsed = 0, spinAt = 0;
    const paint = (now) => {
      if (!document.body.contains(cv)) return;
      elapsed += 16;
      if (view.spin && now - spinAt > 1100) { view.dir = (view.dir + 1) % 8; spinAt = now; markDir(); }
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.save();
      ctx.scale(2.6, 2.6);
      drawCharacter(ctx, playerLayers(look, {}), {
        x: 42, y: look.style === 'chibi' ? 80 : 62, anim: view.anim, dir: view.dir, elapsed: elapsed * 4,
      });
      ctx.restore();
      requestAnimationFrame(paint);
    };
    requestAnimationFrame(paint);

    /* ---- appearance ---- */
    const options = {
      style: [['chibi', 'Chibi (แบบ RO)'], ['lpc', 'LPC (แต่งตัวได้)']],
      gender: [['male', 'ชาย'], ['female', 'หญิง']],
      body: [['light', 'ขาว'], ['tanned', 'แทน'], ['dark', 'เข้ม'], ['darkelf', 'ดาร์กเอลฟ์']],
      hair: [['plain', 'เรียบ'], ['messy', 'ยุ่ง'], ['long', 'ยาว'], ['ponytail', 'หางม้า']],
      chibiHair: [['spiky', 'ผมชี้'], ['bald', 'หัวโล้น']],
      hairColor: [['black', 'ดำ'], ['brown', 'น้ำตาล'], ['blonde', 'ทอง'], ['white', 'ขาว']],
      eyes: [['blue', 'ฟ้า'], ['brown', 'น้ำตาล'], ['green', 'เขียว'], ['red', 'แดง']],
    };
    const markLook = () => {
      for (const [key, vals] of Object.entries(options)) {
        const box = $('#o-' + key);
        [...box.children].forEach((b, i) => b.classList.toggle('sel', vals[i][0] === look[key]));
      }
    };
    for (const [key, vals] of Object.entries(options)) {
      const box = $('#o-' + key);
      for (const [v, label] of vals) {
        const b = document.createElement('button');
        b.className = 'opt';
        b.textContent = label;
        b.onclick = () => { look[key] = v; markLook(); markStyle(); this.audio.play('ui'); };
        box.append(b);
      }
    }
    // the chibi is one drawn body with its hair as a layer over it, so the
    // LPC skin, eye and hairstyle choices would change nothing on it
    const markStyle = () => {
      const chibi = look.style === 'chibi';
      body.querySelectorAll('.lpc-only').forEach((el) => { el.hidden = chibi; });
      body.querySelectorAll('.chibi-only').forEach((el) => { el.hidden = !chibi; });
      body.querySelector('#o-hairColor').parentElement.hidden = chibi && look.chibiHair === 'bald';
      $('#style-hint').textContent = chibi ? 'ผมกับหมวกเป็นเลเยอร์แยก เปลี่ยนได้' : 'ชุดที่ใส่เห็นบนตัว';
    };
    markLook();
    markStyle();

    /* ---- starting location ---- */
    let startMap = 'emberhold';
    const startOpts = [['emberhold', 'เอมเบอร์โฮลด์ (ศูนย์รวม)'], ['millhaven', 'มิลเฮเวน (เมืองเล็ก)']];
    const startBox = $('#o-start');
    for (const [id, label] of startOpts) {
      const b = document.createElement('button');
      b.className = 'opt' + (id === startMap ? ' sel' : '');
      b.textContent = label;
      b.onclick = () => {
        startMap = id;
        [...startBox.children].forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
        this.audio.play('ui');
      };
      startBox.append(b);
    }

    /* ---- camera-ish controls for the preview ---- */
    const dirBox = $('#o-dir');
    const dirs = [['⬆ หลัง', 4], ['⬅ ซ้าย', 2], ['⬇ หน้า', 0], ['➡ ขวา', 6]];
    const markDir = () => [...dirBox.children].forEach((b, i) => b.classList.toggle('sel', dirs[i][1] === view.dir));
    for (const [label, d] of dirs) {
      const b = document.createElement('button');
      b.className = 'opt';
      b.textContent = label;
      b.onclick = () => { view.dir = d; view.spin = false; markDir(); };
      dirBox.append(b);
    }
    markDir();
    const animBox = $('#o-anim');
    for (const [id, label] of [['idle', 'ยืน'], ['walk', 'เดิน'], ['slash', 'ฟัน'], ['spellcast', 'ร่ายเวท']]) {
      const b = document.createElement('button');
      b.className = 'opt' + (view.anim === id ? ' sel' : '');
      b.textContent = label;
      b.onclick = () => {
        view.anim = id;
        [...animBox.children].forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
      };
      animBox.append(b);
    }

    /* ---- starting stats: the server accepts any spread totalling 30 ---- */
    const TOTAL = Object.values(STARTING_STATS).reduce((a, v) => a + v, 0);
    const STAT_LABELS = { str: 'STR พลัง', agi: 'AGI ว่องไว', vit: 'VIT อึด', int: 'INT ปัญญา', dex: 'DEX แม่นยำ', luk: 'LUK โชค' };
    const PATHS = [
      ['สมดุล', { str: 5, agi: 5, vit: 5, int: 5, dex: 5, luk: 5 }],
      ['บุกหน้า', { str: 9, agi: 4, vit: 8, int: 1, dex: 5, luk: 3 }],
      ['ว่องไว', { str: 6, agi: 9, vit: 4, int: 1, dex: 5, luk: 5 }],
      ['แม่นธนู', { str: 5, agi: 6, vit: 4, int: 1, dex: 10, luk: 4 }],
      ['เวทมนตร์', { str: 1, agi: 3, vit: 4, int: 11, dex: 8, luk: 3 }],
      ['อึดทน', { str: 5, agi: 3, vit: 12, int: 3, dex: 4, luk: 3 }],
    ];
    const spent = () => Object.values(stats).reduce((a, v) => a + v, 0);
    const rows = $('#statrows');
    const redrawStats = () => {
      const left = TOTAL - spent();
      $('#pts-left').textContent = `เหลือ ${left} แต้ม (คนละ 1–12)`;
      rows.innerHTML = '';
      for (const key of Object.keys(STARTING_STATS)) {
        const row = document.createElement('div');
        row.className = 'statrow';
        row.innerHTML = `<span>${STAT_LABELS[key]}</span><b class="num" id="s-${key}">${stats[key]}</b>`;
        const minus = document.createElement('button');
        minus.className = 'opt'; minus.textContent = '−';
        minus.disabled = stats[key] <= 1;
        minus.onclick = () => { stats[key]--; redrawStats(); };
        const plus = document.createElement('button');
        plus.className = 'opt'; plus.textContent = '+';
        plus.disabled = left <= 0 || stats[key] >= 12;
        plus.onclick = () => { stats[key]++; redrawStats(); };
        row.append(minus, plus);
        rows.append(row);
      }
      // what those points actually buy, at level 1 as a Novice
      const d = deriveStats({ level: 1, jobLevel: 1, ...stats }, JOBS.novice);
      $('#derived').innerHTML = `
        <div><span>HP</span><b class="num">${d.maxHp}</b></div>
        <div><span>SP</span><b class="num">${d.maxSp}</b></div>
        <div><span>ATK</span><b class="num">${d.atk}</b></div>
        <div><span>MATK</span><b class="num">${d.matk}</b></div>
        <div><span>แม่น</span><b class="num">${d.hit}</b></div>
        <div><span>หลบ</span><b class="num">${d.flee}</b></div>
        <div><span>คริ</span><b class="num">${d.crit}%</b></div>
        <div><span>ความเร็ว</span><b class="num">${Math.round(d.moveSpeed)}</b></div>`;
      $('#btn-create').disabled = left !== 0;
    };
    const pathBox = $('#o-path');
    for (const [label, spread] of PATHS) {
      const b = document.createElement('button');
      b.className = 'opt';
      b.textContent = label;
      b.onclick = () => {
        Object.assign(stats, spread);
        [...pathBox.children].forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
        this.audio.play('ui');
        redrawStats();
      };
      pathBox.append(b);
    }
    pathBox.firstChild.classList.add('sel');
    redrawStats();

    /* ---- name ---- */
    const name = $('#cname');
    const SYL_A = ['อา', 'เว', 'คา', 'ธี', 'รู', 'ไซ', 'มิ', 'เอล', 'ทา', 'นอ'];
    const SYL_B = ['ริน', 'ดอร์', 'ลิส', 'แวน', 'เธีย', 'มาร์', 'เนล', 'ซอร์', 'ฟีน', 'เรน'];
    const checkName = () => {
      const v = name.value.trim();
      const ok = /^[A-Za-z0-9_\u0e00-\u0e7f]{3,16}$/.test(v);
      $('#name-hint').textContent = !v ? '3–16 ตัวอักษร' : ok ? '✔ ใช้ได้' : 'ใช้ได้เฉพาะ ไทย/อังกฤษ/ตัวเลข/_ ยาว 3–16';
      $('#name-hint').style.color = !v ? '' : ok ? 'var(--good)' : 'var(--bad)';
    };
    name.addEventListener('input', checkName);
    $('#btn-roll-name').onclick = () => {
      const pick = (a) => a[Math.floor(Math.random() * a.length)];
      name.value = pick(SYL_A) + pick(SYL_B);
      checkName();
    };

    $('#btn-random').onclick = () => {
      for (const [key, vals] of Object.entries(options)) {
        if (key !== 'style') look[key] = vals[Math.floor(Math.random() * vals.length)][0];
      }
      markLook();
      this.audio.play('ui');
    };

    $('#btn-create').onclick = () => {
      this.screenError('');
      this.audio.play('good');
      this.net.send({ t: 'charCreate', name: name.value.trim(), ...look, stats, startMap });
    };
    $('#btn-back').onclick = () => { $('#screen').classList.remove('creating'); this.showCharSelect(); };
  }
}

// exposed for debugging and for automated smoke tests
window.__game = new Game();
// exposed for automated tests: the same pathfinder the game steers itself with
window.__findPath = findPath;
