// The world: owns every zone, drives the tick, routes chat and warps.
import { Zone } from './zone.js';
import { MAPS } from '../../shared/data/maps.js';
import { ITEMS } from '../../shared/data/items.js';
import { MONSTERS } from '../../shared/data/monsters.js';
import { bookReward, rewardText, BOOK_SETS, PIECES, pieceChance, pieceCount, missingPieces, bookEntries } from '../../shared/data/monsterbook.js';
import { TICK_MS, SNAPSHOT_HZ, TILE } from '../../shared/constants.js';
import { db, markDirty, save, closeStore } from '../persistence.js';
import { sweepMarket } from './economy.js';
import * as Quests from './quests.js';
import * as Party from './party.js';
import * as Friends from './friends.js';
import * as Trade from './trade.js';
import * as Guild from './guild.js';
import * as Siege from './siege.js';
import * as Stall from './stall.js';

/** Remember every map a character has set foot in: fast travel needs it. */
function visit(p, mapId) {
  const v = (p.record.visited ??= []);
  if (!v.includes(mapId)) { v.push(mapId); markDirty(); }
}

/**
 * Market listings and guild vaults outlive any one character, so they are
 * swept here: goods the item table no longer has are gone. A listing that
 * already sold stays, because its seller is still owed the money.
 */
export function purgeWorldItems() {
  let changed = false;
  if (Array.isArray(db.market)) {
    const kept = db.market.filter((l) => l.sold || ITEMS[l.id]);
    changed ||= kept.length !== db.market.length;
    db.market = kept;
  }
  for (const g of Object.values(db.guilds ?? {})) {
    if (!Array.isArray(g.vault)) continue;
    const kept = g.vault.filter((st) => st && ITEMS[st.id]);
    changed ||= kept.length !== g.vault.length;
    g.vault = kept;
  }
  if (changed) markDirty();
  return changed;
}

export class World {
  constructor() {
    purgeWorldItems();
    this.zones = new Map();
    this.players = new Map();          // playerId -> Player
    this.byCharId = new Map();
    this.stats = { minted: 0, burned: 0, started: Date.now() };
    for (const id of Object.keys(MAPS)) this.zones.set(id, new Zone(id, this));
    this.lastTick = Date.now();
    this.snapshotAcc = 0;
    this.tickHandle = null;
  }

  start() {
    this.tickHandle = setInterval(() => this.tick(), TICK_MS);
    this.sweeper = setInterval(() => { sweepMarket(); Guild.chargeUpkeep(this); Party.sweep(); Stall.sweep(this); }, 60000);
    Party.sweep();      // clear out whatever a previous run left behind
    // a trade dies when either side walks off, dies or disconnects
    this.tradeSweeper = setInterval(() => Trade.sweep(this), 500);
    // The siege counts in whole seconds of standing still, so it gets its own
    // beat rather than riding the 20Hz tick and dividing by twenty.
    this.siegeTicker = setInterval(() => {
      const zone = this.zones.get(Siege.SIEGE_MAP);
      if (!zone) return;
      const ev = Siege.tick(zone, Date.now());
      if (!ev) return;
      zone.pushEvent(ev);
      if (ev.phase === 'taken' || ev.phase === 'open') {
        for (const p of this.players.values()) p.conn?.send(ev);
      }
    }, 1000);
    this.tradeSweeper.unref?.();
    this.sweeper.unref?.();
    this.siegeTicker.unref?.();
  }

  stop() {
    clearInterval(this.tickHandle);
    clearInterval(this.sweeper);
    clearInterval(this.tradeSweeper);
    clearInterval(this.siegeTicker);
  }

  zone(id) { return this.zones.get(id); }
  playerByName(name) {
    const lower = String(name).toLowerCase();
    for (const p of this.players.values()) if (p.name.toLowerCase() === lower) return p;
    return null;
  }
  playerByCharId(cid) { return this.byCharId.get(String(cid)); }

  addPlayer(p) {
    this.players.set(p.id, p);
    this.byCharId.set(p.record.id, p);
    const zone = this.zone(p.record.map) ?? this.zone('artaris');
    // a map that no longer exists (renamed, or gone) sends them home, and
    // a save point on one is moved there too, or dying would lose them
    if (zone.id !== p.record.map) p.record.map = zone.id;
    if (p.record.savePoint && !MAPS[p.record.savePoint.map]) p.record.savePoint = { ...p.record.savePoint, map: zone.id };
    // a character logging in where the map has since grown a wall would be
    // stuck there forever: put them on the nearest ground they fit on
    const spot = zone.nearestWalkable(p.x, p.y);
    if (spot.x !== p.x || spot.y !== p.y) {
      p.x = spot.x; p.y = spot.y;
      p.record.x = spot.x; p.record.y = spot.y;
      markDirty();
    }
    zone.addPlayer(p);
    visit(p, zone.id);
    p.conn.send(zone.zonePayload());
    p.conn.send({ t: 'self', self: p.selfState() });
    this.broadcastChat({ ch: 'system', text: `${p.name} เข้าสู่โลก` });
    this.tellFriends(p, `เพื่อน ${p.name} ออนไลน์แล้ว`);
    p.conn.send(Friends.state(this, p));
  }

  removePlayer(p) {
    p.persist();
    Trade.cancel(this, p, 'อีกฝ่ายออกจากเกม');
    Stall.close(p);                       // a shopkeeper who logged out is not a shop
    // the party is written down now, so logging off is not leaving it - a
    // group survives one member's connection dropping mid-dungeon
    p.zone?.removePlayer(p);
    this.players.delete(p.id);
    this.byCharId.delete(p.record.id);
    this.tellFriends(p, `เพื่อน ${p.name} ออฟไลน์แล้ว`);
    markDirty();
  }

  /**
   * The Reliquary doors only open for a group. Returns the reason to refuse,
   * or null to let them through.
   *
   * The check counts party members *in the zone they are leaving*, which is
   * the honest test: a party list with five names in five different towns is
   * not a party, and the dungeon is built on the assumption that the people
   * who walk in walk in together.
   */
  partyGate(p, mapId) {
    const need = MAPS[mapId]?.party ?? 0;
    if (!need) return null;
    // a Reliquary pass opens the door for one trip, party or not
    const pass = (p.inventory ?? []).findIndex((st) => ITEMS[st.id]?.dungeonPass);
    if (pass >= 0 && !this.partyHere(p, need)) {
      const name = ITEMS[p.inventory[pass].id].nameTh;
      p.removeItemAt(pass, 1);
      p.conn?.send({ t: 'notice', kind: 'good', text: `ใช้${name} — ประตูเปิดให้` });
      return null;
    }
    if (!p.party) return `ประตูนี้เปิดให้เฉพาะปาร์ตี้ ${need} คนขึ้นไป — หาเพื่อนก่อน`;
    const here = [...(p.zone?.players.values() ?? [])]
      .filter((o) => o.party === p.party && o.alive).length;

    if (here < need) return `ต้องมีเพื่อนร่วมปาร์ตี้อยู่ด้วยกันอย่างน้อย ${need} คน (ตอนนี้ ${here})`;
    return null;
  }

  /** Whether enough of `p`'s party stands here to open a party door. */
  partyHere(p, need) {
    if (!p.party) return false;
    return [...(p.zone?.players.values() ?? [])].filter((o) => o.party === p.party && o.alive).length >= need;
  }

  warpPlayer(p, mapId, x, y) {
    const target = this.zone(mapId);
    if (!target) return;
    Stall.close(p, 'ย้ายแผนที่แล้ว');     // and neither is one that walked away
    p.zone?.removePlayer(p);
    p.record.map = mapId;
    p.x = x; p.y = y;
    if (!target.walkable(p.x, p.y)) {
      const near = target.nearestWalkable(p.x, p.y);
      p.x = near.x; p.y = near.y;
    }
    p.targetId = null;
    p.attacking = false;
    p.cast = null;
    p.warpSafeUntil = Date.now() + 1200;
    p.padArmed = false;            // must step off a pad before one fires again
    // the client forgets every entity when a zone payload lands, so the
    // server must forget what it told it too, or names and looks never resend
    p.seenIdentity = null;
    target.addPlayer(p);
    visit(p, mapId);
    // turning up to the siege while it is open is one of the guild's weekly goals
    if (mapId === Siege.SIEGE_MAP && Siege.status().open) Guild.progress(this, Guild.of(p), 'war', 1);
    if (target.def.safe) p.record.savePoint = { map: mapId, x: p.x, y: p.y };
    p.conn.send(target.zonePayload());
    p.conn.send({ t: 'self', self: p.selfState() });
    markDirty();
  }

  respawn(p) {
    const sp = p.record.savePoint ?? { map: 'artaris', x: 45 * TILE, y: 35 * TILE };
    p.alive = true;
    p.hp = Math.max(1, Math.floor(p.maxHp * 0.3));
    p.sp = Math.max(1, Math.floor(p.maxSp * 0.3));
    p.statuses = [];
    p.anim = 'idle';
    this.warpPlayer(p, sp.map, sp.x, sp.y);
  }

  /** Tell everyone online who lists `p` as a friend, and refresh their list. */
  tellFriends(p, text) {
    const me = String(p.record.id);
    for (const o of this.players.values()) {
      if (o === p || !(o.record.friends ?? []).includes(me)) continue;
      o.conn?.send({ t: 'notice', kind: 'info', text });
      o.conn?.send(Friends.state(this, o));
    }
  }

  /** Player-facing escape hatch: free a character wedged in scenery. */
  unstick(p) {
    const zone = p.zone ?? this.zone(p.record.map);
    if (!zone) return { error: 'ไม่พบโซน' };
    if (zone.walkable(p.x, p.y)) return { ok: true, moved: false };
    const spot = zone.nearestWalkable(p.x, p.y);
    p.x = spot.x; p.y = spot.y;
    p.record.x = spot.x; p.record.y = spot.y;
    markDirty();
    p.conn?.send({ t: 'self', self: p.selfState() });
    return { ok: true, moved: true };
  }

  /**
   * A kill's roll for a jigsaw piece of its monster's picture: one this
   * character is still missing, straight into the book. The piece that
   * finishes the picture pays its reward, and maybe a region's.
   */
  rollPiece(p, monster, roll = Math.random()) {
    const def = MONSTERS[monster.defId];
    if (!def || !bookEntries().some((m) => m.id === def.id)) return null;
    const jigsaw = p.record.jigsaw ??= {};
    const missing = missingPieces(jigsaw[def.id]);
    if (!missing.length || roll >= pieceChance(def)) return null;
    const idx = missing[Math.floor(Math.random() * missing.length)];
    jigsaw[def.id] = (jigsaw[def.id] ?? 0) | (1 << idx);
    const have = pieceCount(jigsaw[def.id]);
    p.conn?.send({ t: 'piece', def: def.id, idx, mask: jigsaw[def.id] });
    p.conn?.send({ t: 'notice', kind: 'good', text: `ได้ชิ้นจิ๊กซอ ${def.nameTh} (${have}/${PIECES})` });
    if (have === PIECES) {
      const setsBefore = new Set(p.book?.sets ?? []);
      p.recompute?.();
      p.conn?.send({ t: 'notice', kind: 'good', text: `สมุดมอนสเตอร์: ภาพ ${def.nameTh} ครบแล้ว! ได้รับ ${rewardText(bookReward(def))} ถาวร` });
      for (const set of BOOK_SETS) {
        if (!setsBefore.has(set.id) && (p.book?.sets ?? []).includes(set.id)) {
          p.conn?.send({ t: 'notice', kind: 'good', text: `สมุดมอนสเตอร์: ${set.name}! ภาพมอนทั้งภูมิภาคครบ ได้รับ ${rewardText(set.reward)} ถาวร` });
        }
      }
      p.conn?.send({ t: 'self', self: p.selfState?.() });
    }
    markDirty();
    return idx;
  }

  onKill(p, monster) {
    // the monster book: how many of each this character has brought down
    const kills = p.record.kills ??= {};
    kills[monster.defId] = (kills[monster.defId] ?? 0) + 1;
    p.conn?.send({ t: 'kill', def: monster.defId, n: kills[monster.defId] });
    Quests.onKill(p, monster.defId);
    Guild.onKill(this, p, monster.level ?? 1);
  }

  broadcastChat(msg) {
    const packet = { t: 'chatMsg', ...msg, ts: Date.now() };
    for (const p of this.players.values()) {
      if (msg.ch === 'say' && p.record.map !== msg.map) continue;
      if (msg.ch === 'party' && p.party !== msg.party) continue;
      if (msg.ch === 'guild' && p.record.guild !== msg.guild) continue;
      if (msg.fromChar && (p.record.blocked ?? []).includes(msg.fromChar)) continue;
      p.conn.send(packet);
    }
  }

  tick() {
    const t = Date.now();
    const dt = Math.min(0.25, (t - this.lastTick) / 1000);
    this.lastTick = t;

    for (const zone of this.zones.values()) {
      if (!zone.players.size && zone.id !== 'artaris') {
        // idle zones still respawn + expire loot, but skip AI work
        zone.updateRespawns(t);
        zone.updateGround(t);
        continue;
      }
      zone.update(dt);
    }

    this.snapshotAcc += dt;
    if (this.snapshotAcc >= 1 / SNAPSHOT_HZ) {
      this.snapshotAcc = 0;
      this.broadcastSnapshots();
    }
  }

  broadcastSnapshots() {
    for (const zone of this.zones.values()) {
      if (!zone.players.size) { zone.drainEvents(); continue; }
      const events = zone.drainEvents();
      zone.refreshStallSigns();          // once per tick, not once per player
      for (const p of zone.players.values()) {
        const snap = zone.snapshotFor(p);
        snap.ev = events;
        snap.you = {
          hp: p.hp, sp: p.sp, maxHp: p.maxHp, maxSp: p.maxSp, x: Math.round(p.x), y: Math.round(p.y),
          exp: p.record.exp, jobExp: p.record.jobExp, level: p.record.level, jobLevel: p.record.jobLevel,
          aurum: p.record.aurum, alive: p.alive, target: p.targetId, attacking: p.attacking,
          cast: p.cast ? { skill: p.cast.skillId, until: p.cast.until, started: p.cast.startedAt } : null,
          cooldowns: p.cooldowns, weight: p.weight(), weightCap: p.weightCap,
          statuses: p.statuses.map((s) => ({ type: s.type, key: s.key, icon: s.icon, until: s.until, beneficial: !!s.beneficial, item: s.item, mods: s.mods ? Object.keys(s.mods) : undefined })),
        };
        p.conn.send(snap);
        // party frames want live health, but a second's lag is fine
        if (p.party && Date.now() - (p.partySentAt ?? 0) > 1000) {
          p.partySentAt = Date.now();
          p.conn.send(Party.state(this, p));
        }
        if (p.questsDirty && Date.now() - (p.questsSentAt ?? 0) > 1000) {
          p.questsDirty = false;
          p.questsSentAt = Date.now();
          p.conn.send({ t: 'questTrack', quests: Quests.tracked(p) });
        }
      }
    }
  }

  async shutdown() {
    for (const p of this.players.values()) p.persist();
    this.stop();
    await save(true);
    closeStore();
  }
}
