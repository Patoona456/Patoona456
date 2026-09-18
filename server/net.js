// One websocket connection: login -> character select -> in-world command routing.
import { OP, PROTOCOL_VERSION, GAME_NAME, TILE } from '../shared/constants.js';
import { register, login, charsOf, createCharacter, deleteCharacter } from './accounts.js';
import { db, markDirty } from './persistence.js';
import { Player } from './game/player.js';
import * as Skills from './game/skills.js';
import * as Econ from './game/economy.js';
import * as Party from './game/party.js';
import * as Trade from './game/trade.js';
import * as Quests from './game/quests.js';
import { ITEMS, RECIPES } from '../shared/data/items.js';
import { NPC_DIALOG, WARP_ROUTES, SHOPS } from '../shared/data/npcs.js';
import { MAPS } from '../shared/data/maps.js';
import { dist } from './game/monster.js';

const RATE_WINDOW = 1000;
const RATE_MAX = 60;

export class Conn {
  constructor(ws, world, ip) {
    this.ws = ws;
    this.world = world;
    this.ip = ip;
    this.account = null;
    this.player = null;
    this.alive = true;
    this.bucket = [];
    this.openNpc = null;

    ws.on('message', (raw) => this.onMessage(raw));
    ws.on('close', () => this.onClose());
    ws.on('error', () => this.onClose());
    this.send({ t: OP.WELCOME, game: GAME_NAME, protocol: PROTOCOL_VERSION });
  }

  send(obj) {
    if (this.ws.readyState !== 1) return;
    try { this.ws.send(JSON.stringify(obj)); } catch { /* client went away */ }
  }
  error(text) { this.send({ t: OP.ERROR, text }); }
  notice(text, kind = 'info') { this.send({ t: OP.NOTICE, kind, text }); }

  rateLimited() {
    const now = Date.now();
    this.bucket = this.bucket.filter((t) => now - t < RATE_WINDOW);
    this.bucket.push(now);
    return this.bucket.length > RATE_MAX;
  }

  onMessage(raw) {
    if (raw.length > 8192) return this.error('ข้อความยาวเกินไป');
    let m;
    try { m = JSON.parse(raw); } catch { return this.error('รูปแบบข้อความไม่ถูกต้อง'); }
    if (typeof m?.t !== 'string') return;
    if (this.rateLimited() && m.t !== OP.INPUT) return;
    try { this.route(m); }
    catch (e) { console.error('[net] handler error', m.t, e); this.error('เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์'); }
  }

  route(m) {
    switch (m.t) {
      case OP.PING: return this.send({ t: OP.PONG, ts: m.ts });
      case OP.REGISTER: return this.doRegister(m);
      case OP.LOGIN: return this.doLogin(m);
      case OP.CHAR_LIST: return this.sendChars();
      case OP.CHAR_CREATE: return this.doCharCreate(m);
      case OP.CHAR_DELETE: return this.doCharDelete(m);
      case OP.ENTER: return this.doEnter(m);
      default: return this.routeInWorld(m);
    }
  }

  requirePlayer() {
    if (!this.player) { this.error('ยังไม่ได้เข้าเกม'); return null; }
    return this.player;
  }

  /* ---------------- account ---------------- */
  doRegister(m) {
    const r = register(m.name, m.password);
    if (r.error) return this.error(r.error);
    this.account = r.account;
    this.notice('สมัครสำเร็จ ยินดีต้อนรับ!');
    this.sendChars();
  }

  doLogin(m) {
    const r = login(m.name, m.password);
    if (r.error) return this.error(r.error);
    for (const p of this.world.players.values()) {
      if (p.record.account === r.account.key) return this.error('บัญชีนี้กำลังเล่นอยู่');
    }
    this.account = r.account;
    this.sendChars();
  }

  sendChars() {
    if (!this.account) return this.error('ยังไม่ได้ล็อกอิน');
    this.send({ t: OP.CHARS, account: this.account.name, chars: charsOf(this.account) });
  }

  doCharCreate(m) {
    if (!this.account) return this.error('ยังไม่ได้ล็อกอิน');
    const r = createCharacter(this.account, m);
    if (r.error) return this.error(r.error);
    this.sendChars();
  }

  doCharDelete(m) {
    if (!this.account) return this.error('ยังไม่ได้ล็อกอิน');
    const r = deleteCharacter(this.account, m.id);
    if (r.error) return this.error(r.error);
    this.sendChars();
  }

  doEnter(m) {
    if (!this.account) return this.error('ยังไม่ได้ล็อกอิน');
    if (this.player) return this.error('เข้าเกมอยู่แล้ว');
    if (!this.account.chars.includes(String(m.id))) return this.error('ไม่พบตัวละคร');
    const record = db.characters[String(m.id)];
    if (!record) return this.error('ข้อมูลตัวละครเสียหาย');
    this.player = new Player(record, this);
    this.world.addPlayer(this.player);
    this.sendInventory();
    this.send(Party.state(this.world, this.player));
    this.send({ t: 'questTrack', quests: Quests.tracked(this.player) });
  }

  /* ---------------- in world ---------------- */
  routeInWorld(m) {
    const p = this.requirePlayer();
    if (!p) return;
    const zone = p.zone;

    switch (m.t) {
      case OP.INPUT: {
        const mx = Math.max(-1, Math.min(1, Number(m.mx) || 0));
        const my = Math.max(-1, Math.min(1, Number(m.my) || 0));
        p.input.mx = mx; p.input.my = my;
        if (m.face !== undefined) p.dir = Math.max(0, Math.min(3, m.face | 0));
        return;
      }
      case OP.TARGET: {
        const target = zone.entities.get(m.id);
        p.targetId = target ? target.id : null;
        return;
      }
      case OP.ATTACK: {
        if (m.id) {
          const target = zone.entities.get(m.id);
          if (target) p.targetId = target.id;
        }
        p.attacking = !!m.on;
        if (p.attacking && !p.targetId) {
          const near = [...zone.entitiesNear(p, 220)]
            .filter((e) => zone.isHostile(p, e))
            .sort((a, b) => dist(p, a) - dist(p, b))[0];
          if (near) p.targetId = near.id; else p.attacking = false;
        }
        return;
      }
      case OP.SKILL: {
        const r = Skills.begin(zone, p, m.skill, { targetId: m.target ?? p.targetId, point: m.point });
        if (r?.error) this.error(r.error);
        else this.send({ t: OP.SELF, self: p.selfState() });
        return;
      }
      case OP.PICKUP: {
        const r = zone.pickup(p, m.uid);
        if (r.error) return this.error(r.error);
        if (r.aurum) this.notice(`ได้รับ ${r.aurum} ออรัม`);
        else this.notice(`ได้รับ ${ITEMS[r.item]?.nameTh ?? r.item} x${r.qty}`);
        this.sendInventory();
        return;
      }
      case OP.USE_ITEM: return this.useItem(m);
      case OP.EQUIP: {
        const r = p.equip(m.index | 0);
        if (r.error) return this.error(r.error);
        this.sendInventory();
        return;
      }
      case OP.UNEQUIP: {
        const r = p.unequip(String(m.slot));
        if (r.error) return this.error(r.error);
        this.sendInventory();
        return;
      }
      case OP.DROP_ITEM: {
        const st = p.inventory[m.index | 0];
        if (!st) return this.error('ไม่พบไอเทม');
        if (Object.values(p.record.equipment).includes(m.index | 0)) return this.error('ถอดอุปกรณ์ก่อน');
        const qty = Math.max(1, Math.min(st.qty ?? 1, m.qty | 0 || 1));
        zone.dropItem(p.x, p.y, st.id, qty, [p.id], st);
        p.removeItemAt(m.index | 0, qty);
        this.sendInventory();
        return;
      }
      case OP.ALLOC_STAT: {
        const r = p.allocStat(String(m.stat));
        if (r.error) return this.error(r.error);
        return this.send({ t: OP.SELF, self: p.selfState() });
      }
      case OP.LEARN_SKILL: {
        const r = p.learnSkill(String(m.skill));
        if (r.error) return this.error(r.error);
        return this.send({ t: OP.SELF, self: p.selfState() });
      }
      case OP.SET_HOTBAR: {
        const i = Math.max(0, Math.min(11, m.index | 0));
        p.record.hotbar[i] = m.skill ?? null;
        markDirty();
        return this.send({ t: OP.SELF, self: p.selfState() });
      }
      case OP.CHAT: return this.doChat(m);
      case OP.RESPAWN: {
        if (p.alive) return;
        this.world.respawn(p);
        return;
      }
      case OP.NPC_INTERACT: return this.npcInteract(m);
      case OP.NPC_ACTION: return this.npcAction(m);
      case OP.SHOP_BUY: return this.guardNpc(['shop', 'smith'], () => {
        const r = Econ.buy(this.world, p, m.shop, m.id, m.qty);
        if (r.error) return this.error(r.error);
        this.notice(`ซื้อสำเร็จ -${r.spent} ออรัม`);
        this.sendInventory();
      });
      case OP.SHOP_SELL: return this.guardNpc(['shop', 'smith'], () => {
        const r = Econ.sell(this.world, p, m.index | 0, m.qty | 0 || 1);
        if (r.error) return this.error(r.error);
        this.notice(`ขายได้ ${r.gained} ออรัม${r.dampened ? ' (ราคาตกเพราะขายซ้ำเยอะ)' : ''}`);
        this.sendInventory();
      });
      case OP.STORAGE_MOVE: return this.guardNpc(['storage'], () => {
        const r = Econ.storageMove(p, m.dir, m.index | 0, m.qty | 0 || 1);
        if (r.error) return this.error(r.error);
        this.send({ t: OP.STORAGE, storage: r.storage });
        this.sendInventory();
      });
      case OP.REFINE: return this.guardNpc(['smith'], () => {
        const r = Econ.refine(this.world, p, m.index | 0, !!m.oil);
        if (r.error) return this.error(r.error);
        if (r.success) this.notice(`ตีบวกสำเร็จ! +${r.refine}`, 'good');
        else if (r.destroyed) this.notice('ล้มเหลว... อุปกรณ์แตกสลาย', 'bad');
        else if (r.protected) this.notice('ล้มเหลว แต่น้ำมันศักดิ์สิทธิ์ปกป้องไว้', 'warn');
        else this.notice(`ล้มเหลว ตกเป็น +${r.refine}`, 'bad');
        this.sendInventory();
      });
      case OP.REPAIR: return this.guardNpc(['smith'], () => {
        const r = Econ.repair(this.world, p, m.index | 0);
        if (r.error) return this.error(r.error);
        this.notice(`ซ่อมเสร็จ -${r.cost} ออรัม`);
        this.sendInventory();
      });
      case OP.MARKET_LIST: return this.send(Econ.marketList({ q: m.q }));
      case OP.MARKET_POST: return this.guardNpc(['market'], () => {
        const r = Econ.marketPost(this.world, p, m.index | 0, m.qty | 0 || 1, m.price | 0);
        if (r.error) return this.error(r.error);
        this.notice(`ลงขายแล้ว (ค่าธรรมเนียม ${r.fee})`);
        this.sendInventory();
        this.send(Econ.marketList({}));
      });
      case OP.MARKET_BUY: return this.guardNpc(['market'], () => {
        const r = Econ.marketBuy(this.world, p, m.uid);
        if (r.error) return this.error(r.error);
        this.notice(`ซื้อ ${ITEMS[r.item]?.nameTh} x${r.qty} ราคา ${r.paid}`);
        this.sendInventory();
        this.send(Econ.marketList({}));
      });
      case OP.MARKET_CANCEL: return this.guardNpc(['market'], () => {
        const r = Econ.marketCancel(p, m.uid);
        if (r.error) return this.error(r.error);
        this.sendInventory();
        this.send(Econ.marketList({}));
      });
      // dev-only teleport, for screenshots and QA. Off unless EMBERFALL_DEV=1.
      case 'devWarp': {
        if (process.env.EMBERFALL_DEV !== '1') return this.error('ปิดใช้งานอยู่');
        const map = MAPS[m.map];
        if (!map) return this.error('ไม่พบแผนที่');
        const [tx, ty] = m.at ?? map.spawnPoint;
        this.world.warpPlayer(p, m.map, tx * TILE, ty * TILE);
        return;
      }
      // dev-only power-up, so high level content can be tested. EMBERFALL_DEV=1.
      case 'devBoost': {
        if (process.env.EMBERFALL_DEV !== '1') return this.error('ปิดใช้งานอยู่');
        const r = p.record;
        r.level = Math.min(99, m.level ?? 60);
        r.jobLevel = 45;
        r.job = m.job ?? 'vanguard';
        for (const k of ['str', 'agi', 'vit', 'int', 'dex', 'luk']) r[k] = m.stat ?? 60;
        r.aurum += 1000000;
        const kit = m.items ?? ['glacier_lance', 'warden_halberd', 'iron_pike', 'ashguard_plate',
          'plate_cuirass', 'leather_vest', 'golden_helm', 'metal_helm', 'golden_greaves',
          'metal_greaves', 'golden_boots', 'metal_boots', 'golden_gauntlets', 'metal_gauntlets',
          'emberheart_amulet', 'band_of_vigor', 'greater_salve'];
        for (const id of kit) {
          if ((ITEMS[id]?.level ?? 1) > r.level) continue;      // only what this level may wear
          p.addItem(id, id === 'greater_salve' ? 50 : 1);
        }
        for (const [i, st] of p.inventory.entries()) {
          const def = ITEMS[st.id];
          if (def && (def.type === 'weapon' || def.type === 'armor')) { st.refine = 7; p.equip(i); }
        }
        for (const sid of m.skills ?? ['cleave', 'skewer', 'taunt', 'bulwark_stance', 'first_aid', 'iron_will']) {
          r.skills[sid] = 5;
        }
        r.hotbar = ['cleave', 'skewer', 'taunt', 'bulwark_stance', 'first_aid', null];
        p.recompute();
        p.hp = p.maxHp; p.sp = p.maxSp;
        this.sendInventory();
        return this.notice('dev: boosted', 'good');
      }
      // dev-only: set the equipped weapon's refine, to look at the auras
      case 'devRefine': {
        if (process.env.EMBERFALL_DEV !== '1') return this.error('ปิดใช้งานอยู่');
        const eq = p.equippedItem('weapon');
        if (!eq) return this.error('ไม่ได้ถืออาวุธ');
        eq.stack.refine = Math.max(0, Math.min(15, m.level | 0));
        p.recompute();
        this.sendInventory();
        return this.send({ t: OP.SELF, self: p.selfState() });
      }
      case OP.PARTY: return this.partyCmd(m);
      case OP.TRADE: return this.tradeCmd(m);
      // the quest log is readable anywhere; only turn-ins need an NPC

      case OP.QUEST: return this.questCmd(m);
      case OP.WARP: return this.guardNpc(['warp'], () => {
        const r = Econ.warpService(this.world, p, m.to);
        if (r.error) return this.error(r.error);
        this.world.warpPlayer(p, r.route.to, r.route.at[0] * TILE, r.route.at[1] * TILE);
      });
      default: return this.error('คำสั่งไม่รู้จัก: ' + m.t);
    }
  }

  /** NPC services require standing next to the right NPC. */
  guardNpc(roles, fn) {
    const p = this.player;
    const npc = this.openNpc ? p.zone.entities.get(this.openNpc) : null;
    if (!npc || !roles.includes(npc.role) || dist(p, npc) > 96) {
      this.openNpc = null;
      return this.error('ต้องยืนคุยกับ NPC ที่ถูกต้องก่อน');
    }
    return fn();
  }

  useItem(m) {
    const p = this.player;
    const idx = m.index | 0;
    const st = p.inventory[idx];
    if (!st) return this.error('ไม่พบไอเทม');
    const def = ITEMS[st.id];
    if (!def) return this.error('ไอเทมไม่ถูกต้อง');
    if (def.type !== 'consumable') return this.error('ใช้ไอเทมนี้ไม่ได้');
    if ((def.level ?? 1) > p.record.level) return this.error(`ต้องเลเวล ${def.level}`);
    const cdKey = 'item:' + st.id;
    if ((p.cooldowns[cdKey] ?? 0) > Date.now()) return this.error('ไอเทมยังคูลดาวน์');
    p.cooldowns[cdKey] = Date.now() + (def.cooldown ?? 3) * 1000;

    if (def.heal) p.hp = Math.min(p.maxHp, p.hp + def.heal);
    if (def.healSp) p.sp = Math.min(p.maxSp, p.sp + def.healSp);
    if (def.cleanse) p.statuses = p.statuses.filter((s) => !def.cleanse.includes(s.type));
    if (def.regen) {
      p.statuses.push({
        key: 'food', type: 'buff', icon: '🍖', beneficial: true,
        until: Date.now() + def.regen.duration * 1000,
        mods: { hpRegenPct: (def.regen.hp ?? 0) * 6, spRegenPct: (def.regen.sp ?? 0) * 6 },
      });
      p.recompute();
    }
    if (def.warp === 'lastTown') {
      const sp = p.record.savePoint;
      this.world.warpPlayer(p, sp.map, sp.x, sp.y);
    }
    p.removeItemAt(idx, 1);
    this.sendInventory();
  }

  doChat(m) {
    const p = this.player;
    const text = String(m.text ?? '').slice(0, 200).trim();
    if (!text) return;
    const ch = ['say', 'party', 'trade', 'world'].includes(m.ch) ? m.ch : 'say';
    if (ch === 'party' && !p.party) return this.error('ยังไม่ได้อยู่ปาร์ตี้');
    this.world.broadcastChat({
      ch, text, from: p.name, map: p.record.map, party: p.party,
    });
  }

  npcInteract(m) {
    const p = this.player;
    const npc = p.zone.entities.get(m.id);
    if (!npc || npc.kind !== 'npc') return this.error('ไม่พบ NPC');
    if (dist(p, npc) > 96) return this.error('เข้าไปใกล้ๆ ก่อน');
    this.openNpc = npc.id;
    const dialog = NPC_DIALOG[npc.npcId] ?? { greet: '...', options: [] };
    this.send({
      t: OP.NPC_DIALOG, id: npc.id, npcId: npc.npcId, name: npc.name,
      greet: dialog.greet, options: dialog.options, role: npc.role,
    });
  }

  npcAction(m) {
    const p = this.player;
    const npc = this.openNpc ? p.zone.entities.get(this.openNpc) : null;
    if (!npc || dist(p, npc) > 96) return this.error('ต้องยืนคุยกับ NPC ก่อน');

    switch (m.action) {
      case 'shop': return this.send(Econ.shopPayload(m.shop ?? npc.shop ?? 'general'));
      case 'sell': return this.send({ t: OP.SHOP, mode: 'sell', id: npc.npcId, name: npc.name, stock: [] });
      case 'refine': return this.send({ t: OP.SHOP, mode: 'refine', id: npc.npcId, name: npc.name });
      case 'repair': return this.send({ t: OP.SHOP, mode: 'repair', id: npc.npcId, name: npc.name });
      case 'craft': return this.send({ t: OP.SHOP, mode: 'craft', id: npc.npcId, name: npc.name, recipes: RECIPES });
      case 'craftDo': {
        const r = Econ.craft(this.world, p, m.recipe, m.times);
        if (r.error) return this.error(r.error);
        this.notice(`คราฟต์สำเร็จ ${ITEMS[r.item]?.nameTh} x${r.made}`, 'good');
        return this.sendInventory();
      }
      case 'storage': {
        const r = Econ.openStorage(this.world, p);
        if (r.error) return this.error(r.error);
        return this.send({ t: OP.STORAGE, storage: r.storage });
      }
      case 'market': return this.send(Econ.marketList({}));
      case 'heal': {
        const r = Econ.healService(this.world, p);
        if (r.error) return this.error(r.error);
        return this.notice(`รักษาเรียบร้อย -${r.price} ออรัม`, 'good');
      }
      case 'cleanse': {
        p.statuses = p.statuses.filter((s) => s.beneficial);
        p.recompute();
        return this.notice('ล้างสถานะผิดปกติแล้ว', 'good');
      }
      case 'warpMenu': return this.send({ t: OP.SHOP, mode: 'warp', routes: WARP_ROUTES, name: npc.name });
      case 'jobChange': {
        const r = p.changeJob(m.job);
        if (r.error) return this.error(r.error);
        this.notice(`เปลี่ยนอาชีพเป็น ${r.job} แล้ว!`, 'good');
        return this.send({ t: OP.SELF, self: p.selfState() });
      }
      case 'resetStats': {
        const r = Econ.resetStats(this.world, p);
        if (r.error) return this.error(r.error);
        this.notice(`คืนแต้มสเตตัส ${r.refund} แต้ม`, 'good');
        return this.send({ t: OP.SELF, self: p.selfState() });
      }
      case 'resetSkills': {
        const r = Econ.resetSkills(this.world, p);
        if (r.error) return this.error(r.error);
        this.notice(`คืนแต้มสกิล ${r.refund} แต้ม`, 'good');
        return this.send({ t: OP.SELF, self: p.selfState() });
      }
      case 'quests': return this.send({ t: OP.QUEST_STATE, quests: Quests.available(p) });
      default: return this.error('ไม่รองรับคำสั่งนี้');
    }
  }

  partyCmd(m) {
    const p = this.player;
    let r;
    switch (m.cmd) {
      case 'create': r = Party.create(p, m.name); break;
      case 'invite': r = Party.invite(this.world, p, m.name); break;
      case 'accept': r = Party.accept(this.world, p); break;
      case 'leave': r = Party.leave(this.world, p); break;
      case 'state': r = { ok: true }; break;
      default: return this.error('คำสั่งปาร์ตี้ไม่ถูกต้อง');
    }
    if (r.error) return this.error(r.error);
    this.send(Party.state(this.world, p));
    // refresh everyone else in the party
    for (const other of this.world.players.values()) {
      if (other !== p && other.party && other.party === p.party) other.conn.send(Party.state(this.world, other));
    }
  }

  /** Player-to-player trading. Every command answers with the whole window. */
  tradeCmd(m) {
    const p = this.player;
    const w = this.world;
    let r;
    switch (m.cmd) {
      case 'invite': r = Trade.invite(w, p, String(m.name ?? '')); break;
      case 'accept': r = Trade.accept(w, p, m.fromId); break;
      case 'decline': r = Trade.decline(p); break;
      case 'cancel': r = Trade.cancel(w, p); break;
      case 'offer': r = Trade.offer(p, m.index | 0, m.qty | 0 || 1); break;
      case 'unoffer': r = Trade.unoffer(p, m.slot | 0); break;
      case 'aurum': r = Trade.setAurum(p, m.amount); break;
      case 'lock': r = Trade.lock(p, m.on !== false); break;
      case 'confirm': r = Trade.confirm(w, p); break;
      case 'state': r = { ok: true }; break;
      default: return this.error('คำสั่งเทรดไม่ถูกต้อง');
    }
    if (r.error) {
      this.error(r.error);
      if (!r.session) return;
    }
    if (r.done) {
      for (const side of [r.session.a, r.session.b]) {
        side.p.conn?.send({ t: 'tradeState', trade: null, invite: null });
        side.p.conn?.send({ t: 'notice', kind: 'good', text: 'เทรดสำเร็จ' });
        side.p.conn?.sendInventory();
      }
      return;
    }
    if (r.session) return Trade.push(r.session);
    this.send(Trade.state(p));
  }

  questCmd(m) {
    const p = this.player;
    if (m.cmd === 'accept') {
      const r = Quests.accept(p, m.id);
      if (r.error) return this.error(r.error);
      this.notice('รับภารกิจแล้ว', 'good');
    } else if (m.cmd === 'complete') {
      const r = Quests.complete(this.world, p, m.id);
      if (r.error) return this.error(r.error);
      this.notice(`ภารกิจสำเร็จ! +${r.rewards.aurum ?? 0} ออรัม`, 'good');
      this.sendInventory();
      this.send({ t: OP.SELF, self: p.selfState() });
    }
    this.send({ t: OP.QUEST_STATE, quests: Quests.available(p) });
    this.send({ t: 'questTrack', quests: Quests.tracked(p) });
  }

  sendInventory() {
    const p = this.player;
    if (!p) return;
    this.send({
      t: OP.INVENTORY,
      items: p.inventory.map((st, i) => {
        const def = ITEMS[st.id] ?? {};
        return {
          i, id: st.id, qty: st.qty ?? 1, refine: st.refine ?? 0, dur: st.dur,
          maxDur: def.durability, name: def.nameTh ?? def.name ?? st.id, type: def.type,
          slot: def.slot, rarity: def.rarity, value: def.value, weight: def.weight,
          level: def.level, desc: def.desc, stats: def.stats, atk: def.atk, matk: def.matk,
          def: def.def, mdef: def.mdef, wclass: def.wclass,
          equipped: Object.entries(p.record.equipment).find(([, idx]) => idx === i)?.[0] ?? null,
        };
      }),
      aurum: p.record.aurum, weight: p.weight(), weightCap: p.weightCap,
      equipment: p.record.equipment,
    });
    this.send({ t: OP.SELF, self: p.selfState() });
  }

  onClose() {
    if (!this.alive) return;
    this.alive = false;
    if (this.player) {
      Trade.cancel(this.world, this.player, 'อีกฝ่ายออกจากเกม');
      this.world.broadcastChat({ ch: 'system', text: `${this.player.name} ออกจากโลก` });
      this.world.removePlayer(this.player);
      this.player = null;
    }
  }
}
