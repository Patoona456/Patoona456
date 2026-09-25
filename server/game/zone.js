// One running instance of a map: terrain, entities, spawns, ground loot.
import { MAPS, buildGrid, encodeGrid, TILES, BLOCKING, HAZARD, rng } from '../../shared/data/maps.js';
import { MONSTERS } from '../../shared/data/monsters.js';
import { ITEMS } from '../../shared/data/items.js';
import { TILE, AOI_RADIUS, ANIM, LEVEL_AGGRO_GAP } from '../../shared/constants.js';
import { Monster, dist, dist2, dirTo, LEASH } from './monster.js';
import { applyDamage, healEntity, basicAttack, statusMods, addStatus } from './combat.js';
import { mint, burn } from './economy.js';
import * as Skills from './skills.js';
import { tickBoss, resetBoss } from './boss.js';
import { findPath, lineClear } from '../../shared/pathfind.js';
import { expGapPenalty, reviveHereCost, REVIVE_HERE_COOLDOWN_MS, REVIVE_HERE_HP } from '../../shared/formulas.js';
import * as Stall from './stall.js';
import { facing8 } from '../../shared/facing.js';
import { swingAnim } from '../../shared/weapons.js';

const EMPTY_SIGNS = [];
const EMPTY_SEEN = new Map();

const now = () => Date.now();

/**
 * Which reset window we are in, as a sortable string.
 *
 * The week turns over on Monday 00:00 UTC for everyone, rather than rolling
 * seven days from each character's own kill: a fixed edge means a guild can
 * agree on "we run it Tuesday" without anybody's personal timer drifting.
 */
function weekKey(at = Date.now()) {
  const d = new Date(at);
  const day = (d.getUTCDay() + 6) % 7;               // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
const LOOT_LOCK_MS = 25000;     // finder keeps priority this long
const LOOT_LIFE_MS = 120000;

/** Animations that play once and then hand back to idle. */
const ONE_SHOT = new Set(['slash', 'thrust', 'shoot', 'hurt', 'spawn']);
const SPAWN_MS = 800;

/**
 * Start a swing that lasts exactly one attack.
 *
 * The animation used to be set and left running, so a character holding
 * attack swung continuously while damage landed on the weapon's own timer -
 * three swings at air for every hit. Now the swing is bounded by the attack
 * interval: it plays once per hit, sped up if the weapon is faster than the
 * animation, and the entity drops back to idle in between.
 */
function startSwing(e, anim, t, intervalMs) {
  const a = ANIM[anim] ?? ANIM.slash;
  const durMs = (a.frames / a.fps) * 1000;
  e.anim = anim;
  e.animStart = t;
  e.animSpeed = intervalMs > 0 && intervalMs < durMs ? durMs / intervalMs : 1;
  e.animUntil = t + Math.min(durMs, intervalMs || durMs);
}

/** True while a one-shot animation is still playing. */
function inOneShot(e, t) {
  return ONE_SHOT.has(e.anim) && e.animUntil > t;
}

export class Zone {
  constructor(id, world) {
    this.id = id;
    this.world = world;
    this.def = MAPS[id];
    this.width = this.def.width;
    this.height = this.def.height;
    this.grid = buildGrid(this.def);
    this.rle = encodeGrid(this.grid);
    this.entities = new Map();
    this.walkers = [];
    this.players = new Map();
    this.ground = [];            // dropped items
    this.effects = [];           // ground skill effects
    this.events = [];
    this.spawnQueue = [];        // { defId, at, anchor }
    this.rand = rng(this.def.seed ^ 0x1234);
    this.populate();
  }

  /* ---------------- terrain ---------------- */
  tileAt(x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return TILES.WALL;
    return this.grid[ty * this.width + tx];
  }

  blocked(x, y) { return BLOCKING.has(this.tileAt(x, y)); }

  walkable(x, y, r = 10) {
    return !this.blocked(x - r, y - r) && !this.blocked(x + r, y - r)
      && !this.blocked(x - r, y + r) && !this.blocked(x + r, y + r);
  }

  /**
   * The nearest spot a body actually fits, spiralling out from where it is.
   * Characters keep their saved position between sessions, so a map edit -
   * a bigger fountain, a new building - can leave someone wedged in scenery
   * they used to be standing beside.
   */
  nearestWalkable(x, y, maxTiles = 12) {
    if (this.walkable(x, y)) return { x, y };
    for (let ring = 1; ring <= maxTiles; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;   // ring edge only
          const nx = x + dx * TILE, ny = y + dy * TILE;
          if (this.walkable(nx, ny)) return { x: nx, y: ny };
        }
      }
    }
    return this.randomWalkable();
  }

  randomWalkable(area = null) {
    for (let i = 0; i < 400; i++) {
      const tx = area ? area[0] + Math.floor(this.rand() * area[2]) : 1 + Math.floor(this.rand() * (this.width - 2));
      const ty = area ? area[1] + Math.floor(this.rand() * area[3]) : 1 + Math.floor(this.rand() * (this.height - 2));
      const x = tx * TILE + TILE / 2, y = ty * TILE + TILE / 2;
      if (this.walkable(x, y)) return { x, y };
    }
    const sp = this.def.spawnPoint ?? [2, 2];
    return { x: sp[0] * TILE, y: sp[1] * TILE };
  }

  /** Axis-separated movement so entities slide along walls instead of sticking. */
  moveTo(e, nx, ny, allowBlocked = false) {
    const r = 10;
    if (allowBlocked) {
      // dashes may cross bodies but never solid terrain: step back until legal
      const steps = 8;
      let bx = e.x, by = e.y;
      for (let i = 1; i <= steps; i++) {
        const tx = e.x + (nx - e.x) * (i / steps), ty = e.y + (ny - e.y) * (i / steps);
        if (!this.walkable(tx, ty, r)) break;
        bx = tx; by = ty;
      }
      e.x = bx; e.y = by;
      return;
    }
    if (this.walkable(nx, e.y, r)) e.x = nx;
    if (this.walkable(e.x, ny, r)) e.y = ny;
    e.x = Math.max(TILE, Math.min((this.width - 1) * TILE, e.x));
    e.y = Math.max(TILE, Math.min((this.height - 1) * TILE, e.y));
  }

  /**
   * The unit vector a chasing monster should move along this tick.
   *
   * In the open, that is simply the direction of the target - searching a
   * grid every frame to walk in a straight line would be pure waste. Only
   * when something solid is between them does it fall back to a path, which
   * is kept and re-walked for half a second before being recomputed.
   */
  chaseStep(m, target, t) {
    const straight = () => {
      const d = dist(m, target) || 1;
      return { x: (target.x - m.x) / d, y: (target.y - m.y) / d };
    };
    if (lineClear(this.grid, this.width, this.height, m, target)) {
      m.path = null;
      return straight();
    }

    // re-plan when the path is stale, spent, or the target has moved off it
    const drifted = m.pathGoal && dist2(m.pathGoal, target) > (3 * TILE) ** 2;
    if (!m.path?.length || t >= (m.pathAt ?? 0) || drifted) {
      m.path = findPath(this.grid, this.width, this.height, m, target) ?? [];
      m.pathGoal = { x: target.x, y: target.y };
      m.pathAt = t + 500;
    }
    while (m.path.length && dist(m, m.path[0]) < 10) m.path.shift();
    if (!m.path.length) return straight();      // nowhere to go: push at it anyway
    const wp = m.path[0];
    const d = dist(m, wp) || 1;
    return { x: (wp.x - m.x) / d, y: (wp.y - m.y) / d };
  }

  /* ---------------- population ---------------- */
  populate() {
    for (const sp of this.def.spawns ?? []) {
      for (let i = 0; i < sp.count; i++) {
        const pos = this.randomWalkable(sp.area);
        this.spawnMonster(sp.mob, pos.x, pos.y, { area: sp.area });
      }
    }
    for (const npc of this.def.npcs ?? []) {
      const e = {
        kind: 'npc', id: 'n_' + npc.id, npcId: npc.id, name: npc.name, role: npc.role,
        x: npc.x * TILE + TILE / 2, y: npc.y * TILE + TILE / 2, dir: 0, anim: 'idle',
        alive: true, look: npc.look, shop: npc.shop,
        // An NPC never moves and never changes, so all of it is identity and
        // the motion half is the bare minimum needed to place it.
        netMotion() {
          return { id: this.id, k: 'n', x: Math.round(this.x), y: Math.round(this.y), d: this.dir, a: 'idle' };
        },
        netIdentity() {
          return { n: this.name, role: this.role, npcId: this.npcId, look: this.look };
        },
        netState() { return { ...this.netMotion(), ...this.netIdentity() }; },
      };
      this.entities.set(e.id, e);
    }
    // townsfolk: no shop, no quest, they just stroll about near home
    (this.def.walkers ?? []).forEach((w, i) => {
      const home = { x: w.x * TILE + TILE / 2, y: w.y * TILE + TILE / 2 };
      const e = {
        kind: 'npc', id: `n_walker${i}`, npcId: `walker${i}`, name: w.name, role: 'townsfolk',
        x: home.x, y: home.y, dir: 0, anim: 'idle', alive: true, look: { pic: w.pic },
        home, range: (w.range ?? 5) * TILE, target: null, restUntil: 0,
        netMotion() {
          return { id: this.id, k: 'n', x: Math.round(this.x), y: Math.round(this.y), d: this.dir, a: this.anim };
        },
        netIdentity() {
          return { n: this.name, role: this.role, npcId: this.npcId, look: this.look };
        },
        netState() { return { ...this.netMotion(), ...this.netIdentity() }; },
      };
      this.entities.set(e.id, e);
      this.walkers.push(e);
    });
  }

  /**
   * Walk, stop and look about, pick somewhere else nearby. A step that would
   * put them into a tree, a wall or a person-shaped obstacle ends the walk
   * there, so they turn round instead of sliding along scenery.
   */
  updateWalkers(dt, t) {
    const speed = 42;
    for (const w of this.walkers) {
      if (!w.target) {
        if (t < w.restUntil) continue;
        const a = Math.random() * Math.PI * 2, r = w.range * (0.3 + Math.random() * 0.7);
        const x = w.home.x + Math.cos(a) * r, y = w.home.y + Math.sin(a) * r;
        if (!this.walkable(x, y, 12) || !lineClear(this.grid, this.width, this.height, w, { x, y }, 12)) {
          w.restUntil = t + 400;
          continue;
        }
        w.target = { x, y };
        w.anim = 'walk';
      }
      const dx = w.target.x - w.x, dy = w.target.y - w.y, d = Math.hypot(dx, dy);
      const step = speed * dt;
      const nx = d <= step ? w.target.x : w.x + (dx / d) * step;
      const ny = d <= step ? w.target.y : w.y + (dy / d) * step;
      const blockedByPlayer = [...this.players.values()].some((p) => (p.x - nx) ** 2 + (p.y - ny) ** 2 < 18 * 18);
      if (d <= step || !this.walkable(nx, ny, 12) || blockedByPlayer) {
        w.target = null;
        w.anim = 'idle';
        w.restUntil = t + 1500 + Math.random() * 3500;
        if (d <= step) { w.x = nx; w.y = ny; }
        continue;
      }
      w.x = nx; w.y = ny;
      w.dir = facing8(dx, dy);
    }
  }

  spawnMonster(defId, x, y, opts = {}) {
    const m = new Monster(defId, x, y, { x, y }, opts);
    m.area = opts.area ?? null;
    this.entities.set(m.id, m);
    return m;
  }

  despawnSummonsOf(ownerId) {
    for (const e of [...this.entities.values()]) {
      if (e.kind === 'monster' && e.summon && e.owner === ownerId) this.entities.delete(e.id);
    }
  }

  addPlayer(p) {
    p.zone = this;
    this.entities.set(p.id, p);
    this.players.set(p.id, p);
  }

  removePlayer(p) {
    this.entities.delete(p.id);
    this.players.delete(p.id);
    this.despawnSummonsOf(p.id);
  }

  /* ---------------- queries ---------------- */
  *entitiesNear(point, radius) {
    const r2 = radius * radius;
    for (const e of this.entities.values()) {
      if (!e.alive || e.kind === 'npc') continue;
      if (dist2(point, e) <= r2) yield e;
    }
  }

  isHostile(a, b) {
    if (!a || !b || a === b || !b.alive || b.kind === 'npc') return false;
    const aSide = a.kind === 'player' || (a.kind === 'monster' && a.summon) ? 'good' : 'bad';
    const bSide = b.kind === 'player' || (b.kind === 'monster' && b.summon) ? 'good' : 'bad';
    if (aSide === bSide) return aSide === 'good' && this.canDuel(a, b);
    return true;
  }

  /**
   * Whether two people on the same side may swing at each other.
   *
   * Opt-in by geography, not by a flag a player can forget they left on: only
   * a map that declares `pvp` allows it at all, so nobody is ever surprised in
   * a field they went to for experience. Party and guild are excluded because
   * the alternative is one person ending a dungeon run out of spite, and a
   * summoned pet answers to whoever owns it.
   */
  canDuel(a, b) {
    if (!this.def.pvp) return false;
    const owner = (e) => (e.kind === 'player' ? e : this.players.get(e.owner));
    const pa = owner(a), pb = owner(b);
    if (!pa || !pb || pa === pb) return false;
    if (pa.party && pa.party === pb.party) return false;
    if (pa.record?.guild && pa.record.guild === pb.record?.guild) return false;
    return true;
  }

  partyMembersNear(p, radius) {
    const out = [p];
    if (p.kind !== 'player' || !p.party) return out;
    for (const other of this.players.values()) {
      if (other !== p && other.party === p.party && dist(p, other) <= radius && other.alive) out.push(other);
    }
    return out;
  }

  pushEvent(ev) { this.events.push(ev); }

  /* ---------------- loot ---------------- */
  dropItem(x, y, id, qty, ownerIds = [], extra = null) {
    const pos = this.walkable(x, y) ? { x, y } : this.randomWalkable();
    this.ground.push({
      uid: 'g' + Math.random().toString(36).slice(2, 9),
      id, qty, x: pos.x + (Math.random() - 0.5) * 24, y: pos.y + (Math.random() - 0.5) * 24,
      owners: ownerIds, lockUntil: now() + LOOT_LOCK_MS, until: now() + LOOT_LIFE_MS, extra,
    });
  }

  pickup(p, uid) {
    const idx = this.ground.findIndex((g) => g.uid === uid);
    if (idx < 0) return { error: 'ไอเทมหายไปแล้ว' };
    const g = this.ground[idx];
    if (dist(p, g) > 48) return { error: 'อยู่ไกลเกินไป' };
    if (g.lockUntil > now() && g.owners.length && !g.owners.includes(p.id)) {
      return { error: 'ยังเป็นสิทธิ์ของผู้เล่นอื่น' };
    }
    if (g.id === '__aurum') {
      p.record.aurum += g.qty;
      this.ground.splice(idx, 1);
      return { ok: true, aurum: g.qty };
    }
    if (p.overweight()) return { error: 'น้ำหนักเกิน เก็บของไม่ได้' };
    if (!p.addItem(g.id, g.qty, g.extra)) return { error: 'กระเป๋าเต็ม' };
    this.ground.splice(idx, 1);
    return { ok: true, item: g.id, qty: g.qty };
  }

  addGroundEffect(fx) { this.effects.push(fx); }

  /* ---------------- death ---------------- */
  onDeath(e, killer) {
    if (!e.alive) return;
    e.alive = false;
    e.hp = 0;
    e.anim = 'hurt';
    e.animUntil = now() + 400;
    e.cast = null;
    // the client dresses the death in the victim's own element, and gives a
    // boss a send-off an ordinary kill never gets
    this.pushEvent({
      t: 'death', id: e.id, by: killer?.id ?? null,
      el: e.def?.element ?? 'neutral', boss: e.boss ? 1 : 0,
    });

    if (e.kind === 'monster') {
      e.deadUntil = now() + (e.def.respawn ?? 20) * 1000;
      if (e.summon) this.entities.delete(e.id);
      else {
        this.awardKill(e, killer);
        if (e.oneShot) this.entities.delete(e.id);     // called by a scroll: no respawn
      }
    } else if (e.kind === 'player') {
      e.statuses = [];
      e.targetId = null;
      // Losing a duel is not dying. Charging the usual experience for it would
      // turn every PvP zone into a place to grief people out of a level, and
      // paying the winner anything at all would make two accounts feeding each
      // other the best income in the game. A duel settles nothing but the duel.
      const duel = killer?.kind === 'player' && this.canDuel(killer, e);
      const by = this.killerCard(killer);
      if (duel) {
        this.pushEvent({ t: 'duel', winner: killer.id, loser: e.id });
        e.conn?.send({ t: 'died', expLost: 0, duel: 1, by, here: this.reviveOffer(e) });
        killer.conn?.send({ t: 'duelWon', over: e.name });
        return;
      }
      // Death costs: 5% of current base EXP, and gear wear. No item loss -
      // losing gear on death would gut the player economy we are protecting.
      const lost = Math.floor(e.record.exp * 0.05);
      e.record.exp = Math.max(0, e.record.exp - lost);
      e.conn?.send({ t: 'died', expLost: lost, by, here: this.reviveOffer(e) });
    }
  }

  /** Who did it, for the death screen: a name, a level, and whether it was a boss. */
  killerCard(killer) {
    const k = killer?.owner ? this.players.get(killer.owner) ?? killer : killer;
    if (!k) return null;
    if (k.kind === 'player') return { n: k.name, lv: k.record?.level ?? 1, k: 'p' };
    return { n: k.name, lv: k.level ?? 1, k: 'm', boss: k.boss ? 1 : 0, def: k.defId };
  }

  /**
   * Why `p` cannot get up where they fell, or null if they can. Never in a
   * zone where players fight each other, never beside a boss that is still
   * fighting (that is what a priest is for), and once per cooldown.
   */
  reviveHereBlock(p, t = now()) {
    if (p.alive) return 'ยังไม่ได้ล้ม';
    if (this.def.pvp) return 'พื้นที่นี้ฟื้นที่เดิมไม่ได้';
    if ((p.reviveHereAt ?? 0) > t) return 'cooldown';
    for (const e of this.entities.values()) {
      if (e.kind === 'monster' && e.boss && e.alive && e.target && dist2(e, p) < 900 * 900) return 'บอสยังสู้อยู่ใกล้ ๆ';
    }
    return null;
  }

  /** What the death screen offers for getting up here. */
  reviveOffer(p, t = now()) {
    const why = this.reviveHereBlock(p, t);
    return {
      cost: reviveHereCost(p.record.level), readyAt: p.reviveHereAt ?? 0,
      ...(why && why !== 'cooldown' ? { no: why } : {}),
    };
  }

  /** Pay and stand up where you fell. */
  reviveHere(p, t = now()) {
    const why = this.reviveHereBlock(p, t);
    if (why === 'cooldown') return { error: `ฟื้นที่เดิมได้อีกครั้งใน ${Math.ceil((p.reviveHereAt - t) / 1000)} วินาที` };
    if (why) return { error: why };
    const cost = reviveHereCost(p.record.level);
    if ((p.record.aurum ?? 0) < cost) return { error: `ต้องใช้ ${cost} ออรัม` };
    p.record.aurum -= cost;
    burn(this.world, cost, 'revive');
    p.reviveHereAt = t + REVIVE_HERE_COOLDOWN_MS;
    p.statuses = [];
    this.revivePlayer(p, REVIVE_HERE_HP);
    return { ok: true, cost };
  }

  awardKill(m, killer) {
    const contributors = [...m.tapped].map((id) => this.players.get(id)).filter((p) => p?.alive !== undefined);
    const main = killer?.kind === 'player' ? killer : (killer?.owner ? this.players.get(killer.owner) : null);
    const party = main?.party;
    let share = contributors.length ? contributors : (main ? [main] : []);
    if (party) {
      const inParty = [...this.players.values()].filter((p) => p.party === party && dist(p, m) < AOI_RADIUS);
      if (inParty.length) share = inParty;
    }
    if (!share.length) return;

    // Party EXP: +10% per extra member, then split. Grouping is worth it,
    // leeching is not (everyone must be in range).
    const mult = 1 + 0.1 * (share.length - 1);
    const exp = (m.def.exp ?? 0) * mult / share.length;
    const jobExp = (m.def.jobExp ?? 0) * mult / share.length;
    const weekly = m.def.lockout === 'weekly' ? weekKey() : null;
    for (const p of share) {
      let penalty = expGapPenalty(p.record.level, m.level);   // no power-levelling
      if (weekly && (p.record.lockouts?.[m.defId] ?? null) === weekly) penalty *= 0.25;
      penalty *= 1 + (p.mods?.expPct ?? 0) / 100;          // an EXP potion
      p.gainExp(exp * penalty, jobExp * penalty, this);
      this.world.onKill(p, m);
    }

    // A locked boss pays its hoard to each character once a week. Repeat
    // kills still give a quarter of the experience - helping a friend clear
    // it should not be a waste of an evening - but the loot that feeds the
    // refine sink is capped by the calendar, not by how long you can play.
    let ownerIds = share.map((p) => p.id);
    if (m.def.lockout === 'weekly') {
      const key = weekKey();
      const fresh = share.filter((p) => (p.record.lockouts?.[m.defId] ?? null) !== key);
      for (const p of share) {
        const locked = !fresh.includes(p);
        p.conn?.send({
          t: 'notice', kind: locked ? 'warn' : 'good',
          text: locked
            ? `${m.name}: สัปดาห์นี้รับรางวัลไปแล้ว (ได้ EXP 25%)`
            : `${m.name}: ได้รางวัลประจำสัปดาห์แล้ว — ครั้งต่อไปสัปดาห์หน้า`,
        });
        if (locked) continue;
        p.record.lockouts = { ...(p.record.lockouts ?? {}), [m.defId]: key };
      }
      ownerIds = fresh.map((p) => p.id);
      if (!ownerIds.length) return;         // everyone had already claimed it
    }

    // drops: the luckiest bottle among the people who earned them counts
    const looters = share.filter((p) => ownerIds.includes(p.id));
    const best = (k) => Math.max(0, ...looters.map((p) => p.mods?.[k] ?? 0)) / 100;
    const dropMul = 1 + best('dropPct'), rareMul = 1 + best('rareDropPct'), aurumMul = 1 + best('aurumPct');
    for (const d of m.def.drops ?? []) {
      const chance = Math.min(1, d.chance * dropMul * (d.chance < 0.05 ? rareMul : 1));
      if (Math.random() > chance) continue;
      const qty = Array.isArray(d.qty) ? d.qty[0] + Math.floor(Math.random() * (d.qty[1] - d.qty[0] + 1)) : (d.qty ?? 1);
      this.dropItem(m.x, m.y, d.id, qty, ownerIds);
    }
    // aurum
    const au = m.def.aurum;
    if (au && Math.random() < au.chance) {
      const amount = Math.round((au.min + Math.floor(Math.random() * (au.max - au.min + 1))) * aurumMul);
      this.ground.push({
        uid: 'g' + Math.random().toString(36).slice(2, 9), id: '__aurum', qty: amount,
        x: m.x, y: m.y, owners: ownerIds, lockUntil: now() + LOOT_LOCK_MS, until: now() + LOOT_LIFE_MS,
      });
      mint(this.world, amount, 'monster-drop');
    }
  }

  revivePlayer(p, hpPct = 0.2) {
    p.alive = true;
    p.hp = Math.max(1, Math.floor(p.maxHp * hpPct));
    p.sp = Math.max(1, Math.floor(p.maxSp * hpPct));
    p.anim = 'idle';
    this.pushEvent({ t: 'revive', id: p.id });
  }

  /* ---------------- simulation ---------------- */
  update(dt) {
    const t = now();
    this.updateStatuses(t);
    this.updatePlayers(dt, t);
    this.updateWalkers(dt, t);
    this.updateMonsters(dt, t);
    this.updateEffects(t);
    this.updateGround(t);
    this.updateRespawns(t);
  }

  updateStatuses(t) {
    for (const e of this.entities.values()) {
      if (!e.statuses?.length) continue;
      let changed = false;
      for (const s of e.statuses) {
        if (s.tick && t >= (s.nextTick ?? 0)) {
          s.nextTick = t + 1000;
          if (e.alive) applyDamage(this, null, e, s.tick, { element: s.element ?? 'neutral', skill: s.type });
        }
        if (s.until && t > s.until) { s.expired = true; changed = true; }
      }
      if (changed) {
        e.statuses = e.statuses.filter((s) => !s.expired);
        e.recompute?.();
      }
    }
  }

  updatePlayers(dt, t) {
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const sm = statusMods(p);

      // finish casts
      if (p.cast && t >= p.cast.until) {
        const payload = p.cast;
        p.cast = null;
        const r = Skills.resolve(this, p, payload);
        if (r?.error) p.conn?.send({ t: 'error', text: r.error });
      }

      // movement
      const swinging = inOneShot(p, t);
      const moving = (p.input.mx || p.input.my) && !sm.rooted && !sm.stunned && !p.cast;
      if (moving) {
        let speed = p.derived.moveSpeed * (1 + sm.slowPct / 100);
        if (p.overweight()) speed *= 0.5;
        const len = Math.hypot(p.input.mx, p.input.my) || 1;
        const vx = p.input.mx / len, vy = p.input.my / len;
        this.moveTo(p, p.x + vx * speed * dt, p.y + vy * speed * dt);
        p.dir = facing8(vx, vy);
        if (!swinging) p.anim = 'walk';
        // moving cancels stealth-breaking? no - but it does cancel casts above
      } else if (!swinging && (p.anim === 'walk' || ONE_SHOT.has(p.anim))) {
        p.anim = 'idle';
      }

      // auto attack: hold the button and keep swinging, re-acquiring as
      // targets die so gamepad play never needs a re-press
      if (p.attacking && !p.cast && !sm.stunned) {
        let target = this.entities.get(p.targetId);
        if (!target?.alive || !this.isHostile(p, target)) {
          target = [...this.entitiesNear(p, 240)]
            .filter((e) => this.isHostile(p, e))
            .sort((a, b) => dist(p, a) - dist(p, b))[0] ?? null;
          p.targetId = target?.id ?? null;
          if (!target) p.attacking = false;
        }
        if (target) {
          const range = p.attackRange + 14;
          if (dist(p, target) <= range && t >= p.nextAttackAt) {
            const delay = Math.max(0.28, p.weaponDelay * p.derived.aspdFactor);
            p.nextAttackAt = t + delay * 1000;
            p.dir = dirTo(p, target);
            startSwing(p, swingAnim(p.weaponClass), t, delay * 1000);
            // a bow shoots whether or not there are arrows in the bag: arrows,
            // when there are any, are spent for their bonus, never required
            if (p.weaponClass === 'bow') p.consumeAmmo(1);
            {
              const cloak = p.statuses.find((s) => s.breakOnAttack);
              if (cloak) { p.statuses.splice(p.statuses.indexOf(cloak), 1); p.recompute(); }
              basicAttack(this, p, target);
              p.wearGear('attack');
              this.pushEvent({ t: 'swing', id: p.id, target: target.id, w: p.weaponClass });
            }
          }
        }
      }

      // hazards
      const haz = HAZARD[this.tileAt(p.x, p.y)];
      if (haz && t - (p.lastHazard ?? 0) > 1000) {
        p.lastHazard = t;
        applyDamage(this, null, p, haz.dps, { element: haz.element, skill: 'hazard' });
      }

      // regen every 4s, doubled out of combat
      if (t >= p.regenAt) {
        p.regenAt = t + 4000;
        const ooc = t - p.lastCombat > 8000 ? 2 : 1;
        const hpr = p.derived.hpRegen * ooc * (1 + (p.mods.hpRegenPct ?? 0) / 100);
        const spr = p.derived.spRegen * ooc * (1 + (p.mods.spRegenPct ?? 0) / 100);
        if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + Math.ceil(hpr));
        if (p.sp < p.maxSp) p.sp = Math.min(p.maxSp, p.sp + Math.ceil(spr));
      }

      // Warps. A timed grace period was not enough on its own: a map whose
      // arrival point sits on a pad sent the player straight back, and doing
      // nothing for a second did not help because they were still standing on
      // it when the second ran out. So a pad only fires once the player has
      // been seen off every pad on this map since they arrived.
      if (t < (p.warpSafeUntil ?? 0)) continue;
      const onPad = (this.def.warps ?? []).some((w) => {
        const wx = w.x * TILE, wy = w.y * TILE;
        return p.x >= wx && p.x <= wx + w.w * TILE && p.y >= wy && p.y <= wy + w.h * TILE;
      });
      if (!onPad) { p.padArmed = true; continue; }
      if (!p.padArmed) continue;
      for (const w of this.def.warps ?? []) {
        const wx = w.x * TILE, wy = w.y * TILE;
        if (p.x >= wx && p.x <= wx + w.w * TILE && p.y >= wy && p.y <= wy + w.h * TILE) {
          const gate = this.world.partyGate(p, w.to);
          if (gate) {
            // held at the door rather than bounced back and forth across it
            p.warpSafeUntil = t + 2500;
            p.conn?.send({ t: 'notice', text: gate, kind: 'warn', gate: true });
            break;
          }
          this.world.warpPlayer(p, w.to, w.at[0] * TILE, w.at[1] * TILE);
          break;
        }
      }
    }
  }

  updateMonsters(dt, t) {
    for (const m of this.entities.values()) {
      if (m.kind !== 'monster') continue;
      if (m.summon && m.expiresAt && t > m.expiresAt) { this.entities.delete(m.id); continue; }
      if (!m.alive) continue;

      const sm = statusMods(m);
      if (sm.stunned) continue;

      if (m.cast) {
        if (t < m.cast.until) continue;       // still channelling
        const payload = m.cast;
        m.cast = null;
        Skills.resolve(this, m, payload);
      }

      let target = m.target ? this.entities.get(m.target) : null;
      if (target && (!target.alive || target.zone !== this && target.kind === 'player')) target = null;
      if (target && statusMods(target).invisible) target = null;

      // a scripted boss runs its own fight on top of the ordinary AI
      if (m.def.script) tickBoss(this, m, t);

      // acquire
      if (!target && t >= m.nextThinkAt) {
        m.nextThinkAt = t + 400;
        if (m.summon) {
          const owner = this.players.get(m.owner);
          const near = owner ? [...this.entitiesNear(owner, 220)].find((e) => this.isHostile(m, e)) : null;
          if (near) { m.target = near.id; target = near; }
        } else {
          // Who this monster is willing to start on, and from how far.
          //
          // Two rules stack. A monster marked `aggressive` starts on anyone,
          // as before. On top of that, *any* monster - grazing or not - starts
          // on a player far enough beneath it, and the further beneath they
          // are the further off it notices them. That second rule is what
          // makes the level bands mean something: walking into the ice fields
          // at level 12 should not be a sightseeing trip, and it is the
          // distance that sells it. Something thirty levels above you should
          // be coming before you have finished reading its name.
          let best = null, bestD = Infinity;
          for (const p of this.players.values()) {
            if (!p.alive || statusMods(p).invisible) continue;
            const gap = m.level - p.record.level;
            const outclassed = gap > LEVEL_AGGRO_GAP;
            if (!m.def.aggressive && !outclassed) continue;
            // up to double the usual range, reached at twenty levels past the gap
            const reach = outclassed
              ? m.aggroRange * (1 + Math.min(1, (gap - LEVEL_AGGRO_GAP) / 20))
              : m.aggroRange;
            const d = dist(m, p);
            if (d < reach && d < bestD) { best = p; bestD = d; }
          }
          if (best) { m.target = best.id; target = best; m.threat.set(best.id, 1); }
        }
      }

      // leash
      if (target && dist(m, m.anchor) > LEASH * (m.boss ? 2 : 1)) {
        m.target = null; m.threat.clear(); target = null;
        m.hp = m.maxHp;   // full reset, classic leash behaviour
        m.tapped.clear();
        if (m.def.script) resetBoss(this, m);
      }

      const speed = m.speed * (1 + sm.slowPct / 100);
      if (target) {
        const d = dist(m, target);
        if (d > m.attackRange) {
          if (!sm.rooted) {
            const step = this.chaseStep(m, target, t);
            this.moveTo(m, m.x + step.x * speed * dt, m.y + step.y * speed * dt);
            // a painted sheet has a run of its own; the rest walk faster
            if (!inOneShot(m, t)) m.anim = m.def.sprite?.kind === 'frames' ? 'run' : 'walk';
          }
          m.dir = dirTo(m, target);
        } else if (t >= m.nextAttackAt) {
          const mDelay = (m.def.attackDelay ?? 1.6) * 1000;
          m.nextAttackAt = t + mDelay;
          m.dir = dirTo(m, target);
          startSwing(m, m.def.attackRange > 60 ? 'shoot' : 'slash', t, mDelay);
          // boss skills
          const skills = m.def.skills ?? [];
          if (skills.length && Math.random() < 0.3) {
            const sid = skills[Math.floor(Math.random() * skills.length)];
            Skills.begin(this, m, sid, { targetId: target.id, point: { x: target.x, y: target.y } });
          } else {
            basicAttack(this, m, target);
            if (target.kind === 'player') target.wearGear('defend');
          }
          this.pushEvent({ t: 'swing', id: m.id, target: target.id });
        } else if (!inOneShot(m, t)) {
          m.anim = 'idle';
        }
      } else {
        // wander (but not while still rising out of the ground)
        const rising = m.anim === 'spawn' && inOneShot(m, t);
        if (!rising && (!m.wanderTo || dist(m, m.wanderTo) < 8 || t > (m.wanderUntil ?? 0))) {
          if (Math.random() < 0.02 || !m.wanderTo) {
            const a = Math.random() * Math.PI * 2, r = 32 + Math.random() * 96;
            m.wanderTo = { x: m.anchor.x + Math.cos(a) * r, y: m.anchor.y + Math.sin(a) * r };
            m.wanderUntil = t + 4000;
          } else { m.anim = 'idle'; m.wanderTo = null; }
        }
        if (m.wanderTo && !rising) {
          const d = dist(m, m.wanderTo) || 1;
          this.moveTo(m, m.x + (m.wanderTo.x - m.x) / d * speed * 0.5 * dt, m.y + (m.wanderTo.y - m.y) / d * speed * 0.5 * dt);
          m.dir = dirTo(m, m.wanderTo);
          m.anim = 'walk';
        }
        // out-of-combat regen
        if (m.hp < m.maxHp && t - m.lastCombat > 6000) {
          m.hp = Math.min(m.maxHp, m.hp + Math.ceil(m.maxHp * 0.03));
        }
      }
    }
  }

  updateEffects(t) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      if (t > fx.until) { this.effects.splice(i, 1); continue; }
      if (t < fx.nextTick) continue;
      fx.nextTick = t + fx.tickRate;
      const owner = this.entities.get(fx.ownerId);
      for (const e of this.entitiesNear(fx, fx.radius)) {
        const hostile = owner ? this.isHostile(owner, e) : e.kind === 'monster';
        if (fx.healTick && !hostile) { healEntity(this, e, fx.healTick); continue; }
        if (!fx.ratio || !hostile) continue;
        const power = fx.magic ? (owner?.derived.matk ?? 20) : (owner?.derived.atk ?? 20);
        applyDamage(this, owner, e, Math.max(1, Math.floor(power * fx.ratio)), {
          element: fx.element ?? 'neutral', skill: fx.skill, magic: fx.magic,
        });
        if (fx.trap) {
          addStatus(e, { key: fx.trap.type, type: fx.trap.type, icon: '⛓', until: t + fx.trap.duration * 1000 });
          this.effects.splice(i, 1);
          break;
        }
      }
    }
  }

  updateGround(t) {
    for (let i = this.ground.length - 1; i >= 0; i--) {
      if (t > this.ground[i].until) this.ground.splice(i, 1);
    }
  }

  updateRespawns(t) {
    for (const m of this.entities.values()) {
      if (m.kind !== 'monster' || m.alive) continue;
      if (m.summon) { this.entities.delete(m.id); continue; }
      if (t < m.deadUntil) continue;
      const pos = this.randomWalkable(m.area);
      m.x = pos.x; m.y = pos.y;
      m.anchor = { x: pos.x, y: pos.y };
      m.hp = m.maxHp;
      m.alive = true;
      m.anim = 'idle';
      if (m.def.sprite?.kind === 'frames') {
        // a painted sheet has a row for coming back; play it through once
        m.anim = 'spawn'; m.animStart = t; m.animSpeed = 1; m.animUntil = t + SPAWN_MS;
        m.wanderTo = null;
      }
      m.target = null;
      m.threat.clear();
      m.tapped.clear();
      m.stolen = false;
      m.statuses = [];
    }
  }

  /* ---------------- snapshots ---------------- */

  /** Called once per tick, before the per-player snapshots are built. */
  refreshStallSigns() {
    this.stallSigns = Stall.signs(this);
  }

  snapshotFor(p) {
    const ents = [];
    // What this viewer already knows about each entity's appearance. The
    // client merges snapshots onto what it has, so anything unchanged can
    // simply be left out - and a name, a face and nine equipment slots are
    // unchanged essentially always. Rebuilt every snapshot rather than
    // updated, because the client drops entities that fall out of range and
    // the two sides have to forget in step or somebody turns invisible.
    const knew = p.seenIdentity ?? EMPTY_SEEN;
    const nowSeen = new Map();
    for (const e of this.entities.values()) {
      if (!e.alive && e.kind !== 'player') continue;
      if (e.kind === 'monster' && e.hp <= 0) continue;
      if (dist2(p, e) > AOI_RADIUS * AOI_RADIUS) continue;
      const idv = e.idv ?? 0;
      nowSeen.set(e.id, idv);
      const state = e.netMotion();
      if (knew.get(e.id) !== idv) Object.assign(state, e.netIdentity());
      ents.push(state);
    }
    p.seenIdentity = nowSeen;
    const ground = this.ground
      .filter((g) => dist2(p, g) < AOI_RADIUS * AOI_RADIUS)
      .map((g) => ({ uid: g.uid, id: g.id, qty: g.qty, x: Math.round(g.x), y: Math.round(g.y),
        mine: !g.owners.length || g.owners.includes(p.id) || g.lockUntil < now() ? 1 : 0 }));
    const fx = this.effects
      .filter((f) => dist2(p, f) < AOI_RADIUS * AOI_RADIUS)
      .map((f) => ({ skill: f.skill, x: Math.round(f.x), y: Math.round(f.y), r: Math.round(f.radius), until: f.until, el: f.look ?? f.element }));
    // Shop signs ride the snapshot so a stall is something you see in the
    // world and walk up to, rather than a row in yet another list. The list
    // is built once per tick by the caller: rebuilding it here would make
    // drawing signs quadratic in the number of people in a town.
    const open = this.stallSigns ?? EMPTY_SIGNS;
    const stalls = open.length
      ? open.filter((sg) => {
        const owner = this.players.get(sg.id);
        return owner && dist2(p, owner) < AOI_RADIUS * AOI_RADIUS;
      })
      : open;
    return { t: 'snapshot', map: this.id, ts: now(), ents, ground, fx, stalls };
  }

  zonePayload() {
    return {
      t: 'zone', id: this.id, name: this.def.name, nameTh: this.def.nameTh,
      width: this.width, height: this.height, theme: this.def.theme, kind: this.def.kind,
      seed: this.def.seed,   // the client regrows the scenery from this
      structures: this.def.structures ?? [],
      laidOut: !!(this.def.paint || this.def.backdrop),   // hand-dressed: no scattered clutter
      backdrop: this.def.backdrop ?? null,
      backdropTiles: this.def.backdropTiles ?? null,
      decor: this.def.decor ?? [],
      safe: !!this.def.safe, rle: this.rle,
      warps: (this.def.warps ?? []).map((w) => ({ x: w.x, y: w.y, w: w.w, h: w.h, label: w.label, to: w.to })),
      levelRange: this.def.levelRange ?? null,
    };
  }

  drainEvents() {
    const ev = this.events;
    this.events = [];
    return ev;
  }
}
