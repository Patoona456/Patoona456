// The world: owns every zone, drives the tick, routes chat and warps.
import { Zone } from './zone.js';
import { MAPS } from '../../shared/data/maps.js';
import { TICK_MS, SNAPSHOT_HZ, TILE } from '../../shared/constants.js';
import { db, markDirty, save, closeStore } from '../persistence.js';
import { sweepMarket } from './economy.js';
import * as Quests from './quests.js';
import * as Party from './party.js';
import * as Trade from './trade.js';
import * as Guild from './guild.js';
import * as Siege from './siege.js';

export class World {
  constructor() {
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
    this.sweeper = setInterval(() => { sweepMarket(); Guild.chargeUpkeep(this); Party.sweep(); }, 60000);
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
    const zone = this.zone(p.record.map) ?? this.zone('emberhold');
    // a character logging in where the map has since grown a wall would be
    // stuck there forever: put them on the nearest ground they fit on
    const spot = zone.nearestWalkable(p.x, p.y);
    if (spot.x !== p.x || spot.y !== p.y) {
      p.x = spot.x; p.y = spot.y;
      p.record.x = spot.x; p.record.y = spot.y;
      markDirty();
    }
    zone.addPlayer(p);
    p.conn.send(zone.zonePayload());
    p.conn.send({ t: 'self', self: p.selfState() });
    this.broadcastChat({ ch: 'system', text: `${p.name} เข้าสู่โลก` });
  }

  removePlayer(p) {
    p.persist();
    Trade.cancel(this, p, 'อีกฝ่ายออกจากเกม');
    // the party is written down now, so logging off is not leaving it - a
    // group survives one member's connection dropping mid-dungeon
    p.zone?.removePlayer(p);
    this.players.delete(p.id);
    this.byCharId.delete(p.record.id);
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
    if (!p.party) return `ประตูนี้เปิดให้เฉพาะปาร์ตี้ ${need} คนขึ้นไป — หาเพื่อนก่อน`;
    const here = [...(p.zone?.players.values() ?? [])]
      .filter((o) => o.party === p.party && o.alive).length;

    if (here < need) return `ต้องมีเพื่อนร่วมปาร์ตี้อยู่ด้วยกันอย่างน้อย ${need} คน (ตอนนี้ ${here})`;
    return null;
  }

  warpPlayer(p, mapId, x, y) {
    const target = this.zone(mapId);
    if (!target) return;
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
    target.addPlayer(p);
    if (target.def.safe) p.record.savePoint = { map: mapId, x: p.x, y: p.y };
    p.conn.send(target.zonePayload());
    p.conn.send({ t: 'self', self: p.selfState() });
    markDirty();
  }

  respawn(p) {
    const sp = p.record.savePoint ?? { map: 'emberhold', x: 32 * TILE, y: 28 * TILE };
    p.alive = true;
    p.hp = Math.max(1, Math.floor(p.maxHp * 0.3));
    p.sp = Math.max(1, Math.floor(p.maxSp * 0.3));
    p.statuses = [];
    p.anim = 'idle';
    this.warpPlayer(p, sp.map, sp.x, sp.y);
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

  onKill(p, monster) { Quests.onKill(p, monster.defId); }

  broadcastChat(msg) {
    const packet = { t: 'chatMsg', ...msg, ts: Date.now() };
    for (const p of this.players.values()) {
      if (msg.ch === 'say' && p.record.map !== msg.map) continue;
      if (msg.ch === 'party' && p.party !== msg.party) continue;
      if (msg.ch === 'guild' && p.record.guild !== msg.guild) continue;
      p.conn.send(packet);
    }
  }

  tick() {
    const t = Date.now();
    const dt = Math.min(0.25, (t - this.lastTick) / 1000);
    this.lastTick = t;

    for (const zone of this.zones.values()) {
      if (!zone.players.size && zone.id !== 'emberhold') {
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
      for (const p of zone.players.values()) {
        const snap = zone.snapshotFor(p);
        snap.ev = events;
        snap.you = {
          hp: p.hp, sp: p.sp, maxHp: p.maxHp, maxSp: p.maxSp, x: Math.round(p.x), y: Math.round(p.y),
          exp: p.record.exp, jobExp: p.record.jobExp, level: p.record.level, jobLevel: p.record.jobLevel,
          aurum: p.record.aurum, alive: p.alive, target: p.targetId, attacking: p.attacking,
          cast: p.cast ? { skill: p.cast.skillId, until: p.cast.until } : null,
          cooldowns: p.cooldowns, weight: p.weight(), weightCap: p.weightCap,
          statuses: p.statuses.map((s) => ({ type: s.type, icon: s.icon, until: s.until, beneficial: !!s.beneficial })),
        };
        p.conn.send(snap);
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
