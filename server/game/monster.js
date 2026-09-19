// Monster entity + AI. Simple, readable state machine: idle -> chase -> attack,
// with leashing back to the spawn anchor and a threat table for parties.
import { MONSTERS } from '../../shared/data/monsters.js';
import { facingTo } from '../../shared/facing.js';
import { TILE } from '../../shared/constants.js';

let seq = 0;

export class Monster {
  constructor(defId, x, y, anchor, opts = {}) {
    const def = MONSTERS[defId];
    this.kind = 'monster';
    this.id = 'm' + (++seq);
    this.defId = defId;
    this.def = def;
    this.name = def.nameTh ?? def.name;
    this.level = def.level * (opts.levelPct ? opts.levelPct / 100 : 1) | 0 || def.level;
    this.boss = !!def.boss;
    this.summon = !!def.summon || !!opts.summon;
    this.owner = opts.owner ?? null;
    this.expiresAt = opts.duration ? Date.now() + opts.duration * 1000 : 0;

    const scale = opts.levelPct ? opts.levelPct / 100 : 1;
    this.maxHp = Math.floor(def.hp * scale);
    this.hp = this.maxHp;
    this.derived = {
      atk: Math.floor((def.atk ?? 10) * scale), matk: Math.floor((def.matk ?? 0) * scale),
      def: def.def ?? 0, mdef: def.mdef ?? 0, softDef: Math.floor((def.def ?? 0) / 3),
      softMdef: Math.floor((def.mdef ?? 0) / 3),
      hit: def.hit ?? 80, flee: def.flee ?? 50, crit: 1, critRes: 0,
      maxHp: this.maxHp, level: this.level,
    };
    this.element = def.element ?? 'neutral';
    this.race = def.race ?? 'beast';
    this.size = def.size ?? 'medium';
    this.weaponElement = def.element ?? 'neutral';

    this.x = x; this.y = y;
    this.anchor = anchor ?? { x, y };
    this.dir = 2; this.anim = 'idle'; this.animStart = 0;
    this.animUntil = 0; this.animSpeed = 1;
    this.alive = true;
    this.statuses = [];
    this.mods = {};
    this.threat = new Map();
    this.target = null;
    this.nextAttackAt = 0;
    this.nextThinkAt = 0;
    this.wanderTo = null;
    this.deadUntil = 0;
    this.lastCombat = 0;
    this.tapped = new Set();      // who has hit it (loot / exp rights)
    this.stolen = false;
  }

  get aggroRange() { return this.def.aggroRange ?? 150; }
  get attackRange() { return this.def.attackRange ?? 40; }
  get speed() { return this.def.speed ?? 70; }

  /** What changes every tick. */
  netMotion() {
    return {
      id: this.id, k: 'm',
      x: Math.round(this.x), y: Math.round(this.y), d: this.dir, a: this.anim,
      ast: this.animStart, as: this.animSpeed !== 1 ? +this.animSpeed.toFixed(2) : undefined,
      hp: this.hp, mhp: this.maxHp,
      st: this.statuses.filter((s) => s.icon).map((s) => s.icon).join(''),
    };
  }

  /**
   * What never changes once it has spawned - which for a monster is all of
   * it. The whole sprite definition, with its layer table, was going out ten
   * times a second for every creature on screen.
   */
  netIdentity() {
    return {
      n: this.name, def: this.defId, lv: this.level,
      boss: this.boss ? 1 : 0, sprite: this.def.sprite, sum: this.summon ? 1 : 0,
    };
  }

  netState() { return { ...this.netMotion(), ...this.netIdentity() }; }
}

/** Distance helpers used by the AI and by skills. */
export const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
export const dist = (a, b) => Math.sqrt(dist2(a, b));
// Facing is one of eight now, in sheet order. A sheet with only four rows
// collapses them on its own; the server does not need to know which art the
// viewer happens to be running.
export const dirTo = (from, to) => facingTo(from, to);
export const LEASH = 16 * TILE;
