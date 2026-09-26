// One websocket connection: login -> character select -> in-world command routing.
import { OP, PROTOCOL_VERSION, GAME_NAME, TILE } from '../shared/constants.js';
import { register, login, charsOf, createCharacter, deleteCharacter } from './accounts.js';
import { db, markDirty } from './persistence.js';
import { Player, BAG_MAX, BAG_STEP, bagCost } from './game/player.js';
import * as Skills from './game/skills.js';
import * as Econ from './game/economy.js';
import * as Stall from './game/stall.js';
import * as Friends from './game/friends.js';
import * as Party from './game/party.js';
import * as Guild from './game/guild.js';
import * as Trade from './game/trade.js';
import * as Quests from './game/quests.js';
import { ITEMS, RECIPES } from '../shared/data/items.js';
import { useConsumable } from './game/consumables.js';
import { isAdmin, tokenOk, gmCommand } from './game/gm.js';
import { JOBS } from '../shared/data/jobs.js';
import { SKILLS } from '../shared/data/skills.js';
import { NPC_DIALOG, WARP_ROUTES, SHOPS } from '../shared/data/npcs.js';
import { MAPS } from '../shared/data/maps.js';
import { dist } from './game/monster.js';
import { DROPPED_LIFE_MS } from './game/zone.js';

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
    const r = register(m.name, m.password, this.ip);
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
    this.player.admin = isAdmin(this.account);
    this.world.addPlayer(this.player);
    this.sendInventory();
    this.send(Party.state(this.world, this.player));
    this.send(Guild.state(this.world, this.player));
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
        if (st.locked) return this.error('ไอเทมถูกล็อกอยู่ ปลดล็อกก่อน');
        const qty = Math.max(1, Math.min(st.qty ?? 1, m.qty | 0 || 1));
        zone.dropItem(p.x, p.y, st.id, qty, [p.id], st, { life: DROPPED_LIFE_MS });
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
        // a skill sits in one slot at a time; null (or the skill already
        // there) empties the slot; only learned, usable skills go in
        const i = Math.max(0, Math.min(5, m.index | 0));
        const bar = p.record.hotbar ?? (p.record.hotbar = []);
        while (bar.length < 6) bar.push(null);
        const id = m.skill ?? null;
        if (id !== null) {
          const sk = SKILLS[id];
          if (!sk || sk.kind === 'passive' || !(p.record.skills?.[id] > 0)) return this.error('ยังใช้สกิลนี้ไม่ได้');
        }
        if (id !== null && bar[i] === id) bar[i] = null;
        else {
          for (let k = 0; k < bar.length; k++) if (bar[k] === id && id !== null) bar[k] = null;
          bar[i] = id;
        }
        markDirty();
        return this.send({ t: OP.SELF, self: p.selfState() });
      }
      // a locked stack cannot be dropped, sold, listed or traded away
      case 'lockItem': {
        const st = p.inventory[m.index | 0];
        if (!st) return this.error('ไม่พบไอเทม');
        if (st.locked) delete st.locked;
        else st.locked = true;
        markDirty();
        return this.sendInventory();
      }
      case 'expandBag': {
        const r = Econ.expandBag(this.world, p);
        if (r.error) return this.error(r.error);
        this.notice(`ขยายกระเป๋าเป็นขั้น ${r.level} (-${r.cost.toLocaleString()} ออรัม)`, 'good');
        return this.sendInventory();
      }
      // the shrine from anywhere (the top bar), as well as from its keeper
      case 'gacha': {
        if (m.action === 'draw') return this.gachaDraw(m.times | 0 || 1, 'ศาลรุ่งอรุณ', !!m.free);
        if (m.action === 'claim') return this.gachaClaim('ศาลรุ่งอรุณ');
        return this.send({ t: OP.SHOP, mode: 'gacha', name: 'ศาลรุ่งอรุณ', ...Econ.shardShop(p) });
      }
      case OP.CHAT: return this.doChat(m);
      case OP.RESPAWN: {
        if (p.alive) return;
        if (m.here) {
          const r = p.zone.reviveHere(p);
          if (r.error) return this.notice(r.error, 'bad');
          this.send({ t: OP.SELF, self: p.selfState() });
          return this.notice(`ฟื้นคืนชีพที่เดิม (-${r.cost} ออรัม)`, 'good');
        }
        this.world.respawn(p);
        return;
      }
      case OP.CAST_CANCEL: {
        // letting go of a long cast is a choice, not a penalty: no cooldown
        // was started, so nothing is charged
        if (p.cast) { p.cast = null; p.anim = 'idle'; }
        return;
      }
      case OP.NPC_INTERACT: return this.npcInteract(m);
      case OP.NPC_ACTION: return this.npcAction(m);
      case OP.SHOP_BUY: return this.guardNpc(['shop', 'smith', 'gacha'], () => {
        const r = Econ.buy(this.world, p, m.shop, m.id, m.qty);
        if (r.error) return this.error(r.error);
        const unit = r.currency ? (ITEMS[r.currency]?.nameTh ?? r.currency) : 'ออรัม';
        this.notice(`ซื้อสำเร็จ -${r.spent} ${unit}`);
        this.sendInventory();
      });
      case OP.SHOP_SELL: return this.guardNpc(['shop', 'smith'], () => {
        const r = Econ.sell(this.world, p, m.index | 0, m.qty | 0 || 1);
        if (r.error) return this.error(r.error);
        this.notice(`ขายได้ ${r.gained} ออรัม${r.dampened ? ' (ราคาตกเพราะขายซ้ำเยอะ)' : ''}`);
        this.sendInventory();
        this.send({ t: 'buyback', items: Econ.buybackList(p) });
      });
      case OP.SHOP_BUYBACK: return this.guardNpc(['shop', 'smith'], () => {
        const r = Econ.buyback(this.world, p, m.index | 0);
        if (r.error) return this.error(r.error);
        this.notice(`ซื้อคืน ${r.name} -${r.spent} ออรัม`, 'good');
        this.sendInventory();
        this.send({ t: 'buyback', items: Econ.buybackList(p) });
      });
      case OP.STORAGE_MOVE: return this.guardNpc(['storage'], () => {
        const r = Econ.storageMove(p, m.dir, m.index | 0, m.qty | 0 || 1);
        if (r.error) return this.error(r.error);
        this.send({ t: OP.STORAGE, storage: r.storage });
        this.sendInventory();
      });
      case OP.REFINE: return this.guardNpc(['smith'], () => {
        const r = Econ.refine(this.world, p, m.index | 0, { guard: !!(m.guard ?? m.oil), luck: typeof m.luck === 'string' ? m.luck : null });
        if (r.error) return this.error(r.error);
        this.sendInventory();
        this.send({ t: OP.SELF, self: p.selfState() });
        // the forge window plays the result; the chat keeps a line of it
        this.send({ t: 'refineResult', result: r.result, id: r.id, from: r.from, to: r.refine, protected: !!r.protected });
        // a +10 and up is news
        if (r.success && r.refine >= 10) {
          this.world.broadcastChat({ ch: 'system', text: `${p.name} ตีบวก ${ITEMS[r.id]?.nameTh ?? r.id} สำเร็จเป็น +${r.refine}!` });
        }
      });
      case OP.REFINE_TRANSFER: return this.guardNpc(['smith'], () => {
        const r = Econ.refineTransfer(this.world, p, m.from | 0, m.to | 0);
        if (r.error) return this.error(r.error);
        this.sendInventory();
        this.send({ t: 'refineResult', result: 'transfer', id: r.toId, fromItem: r.fromId, from: r.from, to: r.to });
      });
      case OP.REPAIR: return this.guardNpc(['smith'], () => {
        const r = Econ.repair(this.world, p, m.index | 0);
        if (r.error) return this.error(r.error);
        this.notice(`ซ่อมเสร็จ -${r.cost} ออรัม`);
        this.sendInventory();
      });
      case OP.MARKET_LIST: return this.send(Econ.marketList({ q: m.q }));
      // A stall needs no NPC: the shopkeeper is another player, standing there.
      case OP.STALL_OPEN: {
        const r = Stall.openStall(p.zone, p, m.title, m.offers);
        if (r.error) return this.error(r.error);
        this.notice(`เปิดแผงแล้ว ${r.offers} รายการ`);
        return this.send({ t: 'stall', mine: Stall.stallOf(p) });
      }
      case OP.STALL_CLOSE:
        Stall.close(p, 'ปิดแผงแล้ว');
        return;
      case OP.STALL_BROWSE: {
        const r = Stall.browse(p.zone, p, m.seller);
        if (r.error) return this.error(r.error);
        return this.send({ t: 'stall', view: r.stall });
      }
      case OP.STALL_BUY: {
        const r = Stall.buy(this.world, p.zone, p, m.seller, m.slot | 0, m.qty | 0 || 1);
        if (r.error) return this.error(r.error);
        this.notice(`ซื้อ ${ITEMS[r.id]?.nameTh} x${r.qty} จาก ${r.sellerName} ราคา ${r.paid}`);
        this.sendInventory();
        const seller = p.zone.players.get(m.seller);
        seller?.conn?.send({ t: 'notice', text: `ขาย ${ITEMS[r.id]?.nameTh} x${r.qty} ได้ ${r.paid - r.tax} ออรัม` });
        if (seller?.conn?.sendInventory) seller.conn.sendInventory();
        const again = Stall.browse(p.zone, p, m.seller);
        return this.send({ t: 'stall', view: again.ok ? again.stall : null });
      }
      case OP.SOCKET: return this.guardNpc(['smith'], () => {
        const r = Econ.socket(this.world, p, m.gear | 0, m.card | 0);
        if (r.error) return this.error(r.error);
        this.notice(`ฝัง ${ITEMS[r.card]?.nameTh} ลง ${ITEMS[r.gear]?.nameTh} แล้ว (${r.used}/${r.max})`);
        this.sendInventory();
      });
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
        Econ.mint(this.world, 1000000, 'dev');   // counted, so the dashboard still reconciles
        // A QA session names the gear it wants to look at (`items`); ids the
        // item table does not have are skipped, and so is anything above
        // this level, rather than force-equipped.
        const kit = (m.items ?? []).filter((id) => ITEMS[id]);
        for (const id of kit) {
          if ((ITEMS[id]?.level ?? 1) > r.level) continue;      // only what this level may wear
          p.addItem(id, ITEMS[id].stack > 1 ? 10 : 1);
        }
        for (const [i, st] of p.inventory.entries()) {
          const def = ITEMS[st.id];
          if (!def || (def.type !== 'weapon' && def.type !== 'armor')) continue;
          if (def.refinable) st.refine = 7;    // a cloak cannot be refined; do not pretend
          p.equip(i);
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
      // the game master's tools, for admin accounts only (server/game/gm.js)
      case 'gm': {
        if (!p.admin || !isAdmin(this.account)) return this.error('เฉพาะผู้ดูแลเท่านั้น');
        const r = gmCommand(this.world, p, m);
        if (r.error) return this.error(r.error);
        p.recompute();
        this.sendInventory();
        this.send({ t: OP.SELF, self: p.selfState() });
        return r.notice ? this.notice(r.notice, 'good') : undefined;
      }
      case OP.PARTY: return this.partyCmd(m);
      case OP.FRIEND: return this.friendCmd(m);
      case OP.GUILD: return this.guildCmd(m);
      case OP.TRADE: return this.tradeCmd(m);
      // the quest log is readable anywhere; only turn-ins need an NPC

      case OP.QUEST: return this.questCmd(m);
      case OP.WARP: {
        // at the traveller, or from the world map while standing in a town
        const npc = this.openNpc ? p.zone.entities.get(this.openNpc) : null;
        const atWarper = npc?.role === 'warp' && dist(p, npc) <= 96;
        if (!atWarper && !p.zone?.def?.safe) return this.error('วาร์ปจากแผนที่โลกได้เฉพาะตอนอยู่ในเมือง — หรือคุยกับนักเดินทาง');
        if (!p.alive) return this.error('ตายอยู่ วาร์ปไม่ได้');
        const r = Econ.warpService(this.world, p, m.to);
        if (r.error) return this.error(r.error);
        this.world.warpPlayer(p, r.route.to, r.route.at[0] * TILE, r.route.at[1] * TILE);
        this.notice(r.ticket ? `วาร์ปไป ${r.route.label} ด้วย${ITEMS[r.ticket].nameTh}` : `วาร์ปไป ${r.route.label} -${r.route.price} ออรัม`);
        return this.sendInventory();
      }
      default: return this.error('คำสั่งไม่รู้จัก: ' + m.t);
    }
  }

  /** NPC services require standing next to the right NPC. */
  gachaDraw(times, name, free = false) {
    const p = this.player;
    const r = Econ.gachaDraw(this.world, p, times, { free });
    if (r.error) return this.error(r.error);
    this.send({ t: 'gachaResult', results: r.results, pity: r.pity, points: r.points });
    // UR and LR are news: everyone sees the name and what came out
    for (const x of r.results) {
      if (x.grade !== 'UR' && x.grade !== 'LR') continue;
      const packet = { t: 'worldNotice', who: p.name, id: x.id, grade: x.grade };
      for (const o of this.world.players.values()) o.conn?.send(packet);
      this.world.broadcastChat({ ch: 'system', text: `ยินดีด้วย! ${p.name} ได้รับ ${ITEMS[x.id]?.nameTh ?? x.id} (${x.grade}) จากศาลรุ่งอรุณ` });
    }
    this.sendInventory();
    this.send({ t: OP.SHOP, mode: 'gacha', name, ...Econ.shardShop(p) });
  }

  gachaClaim(name) {
    const p = this.player;
    const r = Econ.gachaClaim(p);
    if (r.error) return this.error(r.error);
    this.notice(`รับรางวัลแต้มสะสม: ${r.got.map((i) => `${ITEMS[i.id]?.nameTh ?? i.id} x${i.qty}`).join(', ')}`, 'good');
    this.sendInventory();
    this.send({ t: OP.SHOP, mode: 'gacha', name, ...Econ.shardShop(p) });
  }

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
    if (def.box) {
      const r = Econ.openBox(p, idx, this.world);
      if (r.error) return this.error(r.error);
      const got = r.got.id === '__aurum' ? { nameTh: 'ออรัม' } : ITEMS[r.got.id];
      this.notice(`เปิด${def.nameTh} ได้ ${got?.nameTh ?? r.got.id} x${r.got.qty}`, r.rarity === 'common' ? 'info' : 'good');
      this.send({ t: 'boxOpened', box: def.id, got: r.got, rarity: r.rarity });
      return this.sendInventory();
    }
    const r = useConsumable(this.world, p, idx);
    if (r.error) return this.error(r.error);
    if (r.notice) this.notice(r.notice, 'good');
    this.send({ t: OP.SELF, self: p.selfState() });
    this.sendInventory();
  }

  doChat(m) {
    const p = this.player;
    const text = String(m.text ?? '').slice(0, 200).trim();
    if (!text) return;
    // "/admin <token>" makes this account a game master; "/admin off" undoes it
    const adm = text.match(/^\/admin(?:\s+(\S+))?$/i);
    if (adm) {
      if (adm[1] === 'off') {
        if (this.account) { this.account.admin = false; markDirty(); }
        p.admin = isAdmin(this.account);
      } else if (tokenOk(adm[1])) {
        this.account.admin = true; markDirty();
        p.admin = true;
      } else return this.error('รหัสผู้ดูแลไม่ถูกต้อง');
      this.send({ t: OP.SELF, self: p.selfState() });
      return this.notice(p.admin ? 'เปิดโหมดผู้ดูแลแล้ว' : 'ปิดโหมดผู้ดูแลแล้ว', 'good');
    }
    // an escape hatch anyone can reach, in case scenery ever traps a character
    if (text === '/stuck' || text === '/unstuck') {
      const r = this.world.unstick(p);
      if (r.error) return this.error(r.error);
      return this.notice(r.moved ? 'ย้ายออกจากจุดที่ติดแล้ว' : 'ตรงนี้เดินได้ปกติอยู่แล้ว', r.moved ? 'good' : 'info');
    }

    // "/w name text" (or the whisper channel with a `to`) is a private line
    const w = text.match(/^\/(?:w|whisper|กระซิบ)\s+(\S+)\s+([\s\S]+)$/i);
    if (w || m.ch === 'whisper') {
      const to = w ? w[1] : m.to;
      const body = w ? w[2] : text;
      if (!to) return this.error('พิมพ์ /w ชื่อผู้เล่น ข้อความ');
      const r = Friends.whisper(this.world, p, to, body);
      if (r.error) return this.error(r.error);
      return;
    }
    const ch = ['say', 'party', 'guild', 'trade', 'world'].includes(m.ch) ? m.ch : 'say';
    if (ch === 'party' && !p.party) return this.error('ยังไม่ได้อยู่ปาร์ตี้');
    if (ch === 'guild' && !p.record.guild) return this.error('ยังไม่ได้อยู่กิลด์');
    this.world.broadcastChat({
      ch, text, from: p.name, fromChar: String(p.record.id), map: p.record.map, party: p.party, guild: p.record.guild,
    });
  }

  npcInteract(m) {
    const p = this.player;
    const npc = p.zone.entities.get(m.id);
    if (!npc || npc.kind !== 'npc') return this.error('ไม่พบ NPC');
    if (dist(p, npc) > 96) return this.error('เข้าไปใกล้ๆ ก่อน');
    this.openNpc = npc.id;
    // dialogs are keyed by npc id, but fall back to the role: the trainer is
    // placed as `guide`, which silently left him with nothing to say - and
    // with him went job changes and both respec services
    const dialog = NPC_DIALOG[npc.npcId] ?? NPC_DIALOG[npc.role];
    if (!dialog) console.warn(`[npc] no dialog for ${npc.npcId} (role ${npc.role})`);
    this.send({
      t: OP.NPC_DIALOG, id: npc.id, npcId: npc.npcId, name: npc.name,
      greet: dialog?.greet ?? '...', options: dialog?.options ?? [], role: npc.role,
    });
  }

  npcAction(m) {
    const p = this.player;
    const npc = this.openNpc ? p.zone.entities.get(this.openNpc) : null;
    if (!npc || dist(p, npc) > 96) return this.error('ต้องยืนคุยกับ NPC ก่อน');

    switch (m.action) {
      case 'shop': {
        const shop = Econ.shopPayload(m.shop ?? npc.shop ?? 'general');
        this.send({ t: 'buyback', items: Econ.buybackList(p) });
        return this.send(shop && { ...shop, keeper: npc.name });   // the window names who you are talking to
      }
      case 'sell':
        this.send({ t: 'buyback', items: Econ.buybackList(p) });
        return this.send({ t: OP.SHOP, mode: 'sell', id: npc.npcId, name: npc.name, keeper: npc.name, stock: [] });
      case 'refine': return this.send({ t: OP.SHOP, mode: 'refine', id: npc.npcId, name: npc.name });
      case 'socket': return this.send({ t: OP.SHOP, mode: 'socket', id: npc.npcId, name: npc.name });
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
      case 'gacha': return this.send({ t: OP.SHOP, mode: 'gacha', name: npc.name, ...Econ.shardShop(p) });
      case 'gachaDraw': return this.guardNpc(['gacha'], () => this.gachaDraw(m.times | 0 || 1, npc.name));
      case 'gachaClaim': return this.guardNpc(['gacha'], () => this.gachaClaim(npc.name));
      case 'jobChange': return this.guardNpc(['trainer'], () => {
        const r = p.changeJob(m.job);
        if (r.error) return this.error(r.error);
        const name = JOBS[r.job]?.nameTh ?? r.job;
        this.notice(`ยินดีด้วย! คุณคือ${name}แล้ว` + (r.trialDone ? ' (+1 แต้มสกิลจากบททดสอบ)' : ''), 'good');
        if (r.kit?.length) {
          this.notice('ได้รับชุดเริ่มต้นของอาชีพแล้ว — เปิดกระเป๋าดูได้เลย', 'good');
        }
        // everyone standing nearby sees the pillar, not just the person in it
        p.zone?.pushEvent({ t: 'ascend', id: p.id, job: r.job, jobTh: name });
        this.world.broadcastChat({ ch: 'system', text: `${p.name} ก้าวสู่เส้นทาง${name}` });
        this.sendInventory();
        return this.send({ t: OP.SELF, self: p.selfState() });
      });
      case 'resetStats': return this.guardNpc(['trainer'], () => {
        const r = Econ.resetStats(this.world, p);
        if (r.error) return this.error(r.error);
        this.notice(`คืนแต้มสเตตัส ${r.refund} แต้ม`, 'good');
        return this.send({ t: OP.SELF, self: p.selfState() });
      });
      case 'resetSkills': return this.guardNpc(['trainer'], () => {
        const r = Econ.resetSkills(this.world, p);
        if (r.error) return this.error(r.error);
        this.notice(`คืนแต้มสกิล ${r.refund} แต้ม`, 'good');
        return this.send({ t: OP.SELF, self: p.selfState() });
      });
      case 'quests': return this.send({ t: OP.QUEST_STATE, quests: Quests.available(p) });
      default: return this.error('ไม่รองรับคำสั่งนี้');
    }
  }

  /**
   * Guild commands. Everything that changes the roster refreshes the window
   * for everyone online in that guild, so nobody is looking at a stale list
   * of who is in the room with them.
   */
  guildCmd(m) {
    const p = this.player;
    let r;
    switch (m.cmd) {
      case 'create': r = Guild.create(this.world, p, m.name); break;
      case 'invite': r = Guild.invite(this.world, p, m.name); break;
      case 'accept': r = Guild.accept(this.world, p); break;
      case 'leave': r = Guild.leave(this.world, p); break;
      case 'kick': r = Guild.kick(this.world, p, m.charId); break;
      case 'rank': r = Guild.setRank(this.world, p, m.charId, String(m.rank)); break;
      case 'emblem': r = Guild.setEmblem(p, String(m.emblem)); break;
      case 'decline': r = Guild.decline(p); break;
      case 'notice': r = Guild.setNotice(p, m.text); break;
      case 'donate': r = Guild.donate(p, m.amount); break;
      case 'vault': r = Guild.vaultMove(p, m.dir === 'in' ? 'in' : 'out', m.index | 0, m.qty); break;
      case 'state': r = { ok: true }; break;
      default: return this.error('คำสั่งกิลด์ไม่ถูกต้อง');
    }
    if (r.error) return this.error(r.error);
    if (m.cmd === 'accept' || m.cmd === 'create') this.send({ t: 'guildJoined' });
    if (m.cmd === 'invite') this.notice(`ส่งคำเชิญเข้ากิลด์ถึง ${m.name} แล้ว`);
    if (m.cmd === 'vault' || m.cmd === 'donate' || m.cmd === 'create' || m.cmd === 'leave' || m.cmd === 'accept') {
      this.sendInventory();
      this.send({ t: OP.SELF, self: p.selfState() });
    }
    this.send(Guild.state(this.world, p));
    const gid = p.record.guild;
    if (!gid) return;
    for (const other of this.world.players.values()) {
      if (other !== p && other.record.guild === gid) other.conn.send(Guild.state(this.world, other));
    }
  }

  partyCmd(m) {
    const p = this.player;
    let r;
    switch (m.cmd) {
      case 'create': r = Party.create(p, m.name); break;
      case 'invite': r = Party.invite(this.world, p, m.name); break;
      case 'accept': r = Party.accept(this.world, p); break;
      case 'leave': {
        const was = p.party;
        r = Party.leave(this.world, p);
        if (!r.error) {
          this.send({ t: 'partyLeft' });
          for (const other of this.world.players.values()) {
            if (other.party && other.party === was) other.conn.send(Party.state(this.world, other));
          }
        }
        break;
      }
      case 'decline': r = Party.decline(p); break;
      case 'kick': r = Party.kick(this.world, p, m.charId); break;
      case 'promote': r = Party.promote(this.world, p, m.charId); break;
      case 'state': r = { ok: true }; break;
      default: return this.error('คำสั่งปาร์ตี้ไม่ถูกต้อง');
    }
    if (r.error) return this.error(r.error);
    if (m.cmd === 'accept') this.send({ t: 'partyJoined' });
    if (m.cmd === 'invite') this.notice(`ส่งคำเชิญถึง ${m.name} แล้ว`);
    this.send(Party.state(this.world, p));
    // refresh everyone else in the party
    for (const other of this.world.players.values()) {
      if (other !== p && other.party && other.party === p.party) other.conn.send(Party.state(this.world, other));
    }
  }

  friendCmd(m) {
    const p = this.player;
    const w = this.world;
    let r;
    switch (m.cmd) {
      case 'request': r = Friends.request(w, p, m.name); if (!r.error) this.notice(`ส่งคำขอเป็นเพื่อนถึง ${r.name} แล้ว`); break;
      case 'accept': {
        r = Friends.accept(w, p, m.charId);
        if (!r.error) {
          this.send({ t: 'newFriend', name: r.name });
          const other = w.playerByCharId(r.charId);
          if (other) {
            other.conn?.send({ t: 'newFriend', name: p.name });
            other.conn?.send(Friends.state(w, other));
          }
        }
        break;
      }
      case 'decline': r = Friends.decline(p, m.charId); break;
      case 'remove': {
        r = Friends.remove(p, m.charId);
        w.playerByCharId(String(m.charId))?.conn?.send(Friends.state(w, w.playerByCharId(String(m.charId))));
        break;
      }
      case 'block': r = Friends.block(w, p, m.name); if (!r.error) this.notice(`บล็อก ${r.name} แล้ว`); break;
      case 'unblock': r = Friends.unblock(p, m.charId); break;
      case 'state': r = { ok: true }; break;
      default: return this.error('คำสั่งเพื่อนไม่ถูกต้อง');
    }
    if (r.error) return this.error(r.error);
    this.send(Friends.state(w, p));
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
      this.send({ t: 'questClear', id: m.id });
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
          locked: !!st.locked,
        };
      }),
      aurum: p.record.aurum, weight: p.weight(), weightCap: p.weightCap,
      bag: { level: p.record.bagLevel ?? 0, max: BAG_MAX, step: BAG_STEP, cost: bagCost(p.record.bagLevel ?? 0) },
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
