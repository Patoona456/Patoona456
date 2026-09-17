// Derived-stat + damage math. Pure functions, shared so the client can show
// honest tooltips while the server stays authoritative.
import { clamp, ELEMENT_TABLE, MAX_MOVE_SPEED, BASE_MOVE_SPEED } from './constants.js';

/** XP curves ------------------------------------------------------------- */
// Deliberately steeper than the usual idle-game curve: levels are content,
// not a formality. ~1.5M cumulative XP to 99.
export function baseExpToNext(level) {
  return Math.floor(28 * Math.pow(level, 2.05) + 40 * level + 60);
}
export function jobExpToNext(jobLevel) {
  return Math.floor(20 * Math.pow(jobLevel, 2.0) + 30 * jobLevel + 45);
}
// Cost of the next stat point, Ragnarok-style escalation.
export function statCost(current) {
  return Math.floor((current - 1) / 10) + 2;
}

/** Derived stats --------------------------------------------------------- */
export function deriveStats(c, job, gear = {}) {
  const lv = c.level, jl = c.jobLevel;
  const s = {
    str: c.str + (gear.str || 0),
    agi: c.agi + (gear.agi || 0),
    vit: c.vit + (gear.vit || 0),
    int: c.int + (gear.int || 0),
    dex: c.dex + (gear.dex || 0),
    luk: c.luk + (gear.luk || 0),
  };

  const maxHp = Math.floor(
    (40 + lv * 7 + s.vit * 5 + lv * s.vit * 0.14 + jl * 2) * (job.hpMod ?? 1)
  ) + (gear.hp || 0);
  const maxSp = Math.floor(
    (24 + lv * 2.4 + s.int * 4 + lv * s.int * 0.07 + jl * 1.2) * (job.spMod ?? 1)
  ) + (gear.sp || 0);

  const atk = Math.floor(
    s.str + s.str * s.str / 40 + s.dex / 4 + s.luk / 5 + lv / 4
  ) + (gear.atk || 0);
  const matk = Math.floor(
    s.int + s.int * s.int / 32 + s.dex / 6 + s.luk / 6 + lv / 4
  ) + (gear.matk || 0);

  const softDef = Math.floor(s.vit * 0.55 + lv / 6);
  const softMdef = Math.floor(s.int * 0.45 + s.vit * 0.2 + lv / 8);
  const def = (gear.def || 0);            // hard def: % reduction source
  const mdef = (gear.mdef || 0);

  const hit = Math.floor(80 + s.dex + lv / 2 + (gear.hit || 0));
  const flee = Math.floor(60 + s.agi + lv / 2.4 + (gear.flee || 0));
  const crit = +(1 + s.luk * 0.32 + (gear.crit || 0)).toFixed(2);
  const critRes = +(s.luk * 0.12).toFixed(2);

  // Attack delay in seconds for a weapon whose base delay is `weaponDelay`.
  const aspdFactor = clamp(1 - s.agi * 0.0042 - s.dex * 0.0011 - (gear.aspd || 0) / 100, 0.32, 1.2);

  // Cast time / cooldown reduction
  const castFactor = clamp(1 - s.dex * 0.0035 - s.int * 0.0015 - (gear.cast || 0) / 100, 0.2, 1);

  const moveSpeed = clamp(
    (BASE_MOVE_SPEED + s.agi * 0.55) * (1 + (gear.speed || 0) / 100) * (job.speedMod ?? 1),
    60, MAX_MOVE_SPEED
  );

  // Regen per 5s tick, out of combat is doubled by the caller.
  const hpRegen = Math.max(1, Math.floor(maxHp / 100 + s.vit / 5));
  const spRegen = Math.max(1, Math.floor(maxSp / 90 + s.int / 6));

  return {
    ...s, maxHp, maxSp, atk, matk, def, mdef, softDef, softMdef,
    hit, flee, crit, critRes, aspdFactor, castFactor, moveSpeed, hpRegen, spRegen,
    weight: gear.weightCap ?? (2000 + s.str * 30 + lv * 10),
  };
}

/** Combat ---------------------------------------------------------------- */
export function hitChance(attackerHit, defenderFlee) {
  return clamp((attackerHit - defenderFlee + 80) / 100, 0.05, 0.95);
}

export function elementMultiplier(attackEl = 'neutral', defenseEl = 'neutral') {
  return ELEMENT_TABLE[attackEl]?.[defenseEl] ?? 1;
}

/**
 * One damage roll.
 * @param {object} a attacker derived stats (+ element, sizeCard, raceCard)
 * @param {object} d defender derived stats (+ element, size, race)
 * @param {object} o {ratio, magic, ignoreDef, fixed, canCrit, hits}
 */
export function rollDamage(a, d, o = {}) {
  const ratio = o.ratio ?? 1;
  const magic = !!o.magic;
  const hits = o.hits ?? 1;

  if (!magic && !o.alwaysHit) {
    if (Math.random() > hitChance(a.hit, d.flee)) return { miss: true, damage: 0, hits: 0 };
  }

  const power = magic ? a.matk : a.atk;
  const variance = 0.9 + Math.random() * 0.2;
  let dmg = power * ratio * variance;

  // gear cards: bonus vs size / race
  dmg *= 1 + (o.sizeBonus ?? 0) + (o.raceBonus ?? 0);

  // element
  dmg *= elementMultiplier(o.element ?? (magic ? a.element : a.weaponElement) ?? 'neutral', d.element ?? 'neutral');

  // crit (physical only, ignores hard def)
  let crit = false;
  if (!magic && (o.canCrit ?? true)) {
    const chance = Math.max(0, a.crit - d.critRes) / 100;
    if (Math.random() < chance) { crit = true; dmg *= 1.5 + (a.critPower ?? 0); }
  }

  // hard def = diminishing % reduction, soft def = flat
  if (!o.ignoreDef) {
    const hard = magic ? d.mdef : d.def;
    const soft = magic ? d.softMdef : d.softDef;
    const reduction = hard / (hard + 120 + 4 * (d.level ?? 1));
    dmg *= 1 - (crit ? reduction * 0.5 : reduction);
    dmg -= crit ? soft * 0.5 : soft;
  }

  dmg = Math.max(1, Math.floor(dmg)) * hits;
  if (o.fixed) dmg = o.fixed * hits;
  return { miss: false, damage: dmg, crit, hits };
}

/** Item value / economy helpers ------------------------------------------ */
// NPCs pay a fraction of an item's reference value, and the fraction drops as
// the same NPC keeps buying the same thing today (anti-farm dampener).
export function npcSellPrice(refValue, soldToday = 0, softCap = 25) {
  const base = refValue * 0.28;
  const decay = Math.pow(0.94, Math.max(0, soldToday - softCap / 5));
  return Math.max(1, Math.floor(base * Math.min(1, decay)));
}

export function marketTax(price) {
  return Math.max(1, Math.ceil(price * 0.05));
}

/** Refine: risky, the main Aurum + material sink ------------------------- */
export const REFINE_ODDS = [
  1.00, 1.00, 1.00, 0.95, 0.85, 0.70, 0.55, 0.42, 0.32, 0.24,
  0.18, 0.13, 0.09, 0.06, 0.04, 0.02,
];
export function refineChance(level) {
  return REFINE_ODDS[Math.min(level, REFINE_ODDS.length - 1)];
}
export function refineCost(refValue, level) {
  return Math.floor(refValue * 0.15 + 120 * Math.pow(1.35, level));
}
