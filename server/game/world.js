// The world: owns every zone, drives the tick, routes chat and warps.
import { Zone } from './zone.js';
import { MAPS } from '../../shared/data/maps.js';
import { TICK_MS, SNAPSHOT_HZ, TILE } from '../../shared/constants.js';
import { db, markDirty, save } from '../persistence.js';
import { sweepMarket } from './economy.js';
import * as Quests from './quests.js';
import * as Party from './party.js';

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
    this.sweeper = setInterval(() => sweepMarket(), 60000);
    this.sweeper.unref?.();
  }

  stop() {
    clearInterval(this.tickHandle);
    clearInterval(this.sweeper);
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
    zone.addPlayer(p);
    p.conn.send(zone.zonePayload());
    p.conn.send({ t: 'self', self: p.selfState() });
    this.broadcastChat({ ch: 'system', text: `${p.name} เข้าสู่โลก` });
  }

  removePlayer(p) {
    p.persist();
    Party.leave(this, p);
    p.zone?.removePlayer(p);
    this.players.delete(p.id);
    this.byCharId.delete(p.record.id);
    markDirty();
  }

  warpPlayer(p, mapId, x, y) {
    const target = this.zone(mapId);
    if (!target) return;
    p.zone?.removePlayer(p);
    p.record.map = mapId;
    p.x = x; p.y = y;
    if (!target.walkable(p.x, p.y)) {
      const pos = target.randomWalkable();
      p.x = pos.x; p.y = pos.y;
    }
    p.targetId = null;
    p.attacking = false;
    p.cast = null;
    target.addPlayer(p);
    if (target.def.safe) p.record.savePoint = { map: mapId, x: p.x, y: p.y };
    p.conn.send(target.zonePayload());
    p.conn.send({ t: 'self', self: p.selfState() });
    markDirty();
  }

  respawn(p) {
    const sp = p.record.savePoint ?? { map: 'emberhold', x: 32 * TILE, y: 26 * TILE };
    p.alive = true;
    p.hp = Math.max(1, Math.floor(p.maxHp * 0.3));
    p.sp = Math.max(1, Math.floor(p.maxSp * 0.3));
    p.statuses = [];
    p.anim = 'idle';
    this.warpPlayer(p, sp.map, sp.x, sp.y);
  }

  onKill(p, monster) { Quests.onKill(p, monster.defId); }

  broadcastChat(msg) {
    const packet = { t: 'chatMsg', ...msg, ts: Date.now() };
    for (const p of this.players.values()) {
      if (msg.ch === 'say' && p.record.map !== msg.map) continue;
      if (msg.ch === 'party' && p.party !== msg.party) continue;
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
          aurum: p.record.aurum, alive: p.alive, target: p.targetId,
          cast: p.cast ? { skill: p.cast.skillId, until: p.cast.until } : null,
          cooldowns: p.cooldowns, weight: p.weight(), weightCap: p.weightCap,
          statuses: p.statuses.map((s) => ({ type: s.type, icon: s.icon, until: s.until, beneficial: !!s.beneficial })),
        };
        p.conn.send(snap);
      }
    }
  }

  async shutdown() {
    for (const p of this.players.values()) p.persist();
    this.stop();
    await save(true);
  }
}
