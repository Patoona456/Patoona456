// Derived-stat + damage math. Pure functions, shared so the client can show
// honest tooltips while the server stays authoritative.
import { clamp, ELEMENT_TABLE, MAX_MOVE_SPEED, BASE_MOVE_SPEED } from './constants.js';
import { canonical as canonicalElement } from './elements.js';

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

/**
 * How much of a monster's experience actually lands, given the level gap.
 *
 * A flat band with a cliff at its edge produced the worst outcome the balance
 * report can show: one cheap low-level monster staying the single best thing
 * to kill for twenty-five levels, because a character could outlevel it by a
 * dozen and still collect every point. The falloff below you is therefore
 * smooth and steep, while anything at or above your level pays in full - the
 * risk is its own argument. Being dragged onto something far out of reach is
 * leeching, and pays accordingly.
 */
export function expGapPenalty(playerLevel, mobLevel) {
  const gap = mobLevel - playerLevel;
  if (gap >= -4) return Math.min(1, Math.max(0.25, Math.pow(0.9, gap - 14)));
  return Math.max(0.05, Math.pow(0.86, -gap - 4));
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

  // Health has to grow fast enough that a same-level monster costs a fraction
  // of the bar rather than most of it. On the old curve a level-70 character
  // had under a thousand health against monsters hitting for two hundred and
  // fifty, so every solo fight in the last twenty levels was a coin flip and
  // the balance report could not find a single survivable hunting ground.
  const maxHp = Math.floor(
    (45 + lv * 16 + s.vit * 6 + lv * s.vit * 0.3 + jl * 3) * (job.hpMod ?? 1)
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
  const softMdef = Math.floor(s.vit * 0.45 + s.int * 0.35 + lv / 6);
  const def = (gear.def || 0);            // hard def: % reduction source
  // Magic resistance has to have a floor that armour and INT only add to.
  // Hard def is a diminishing reduction against a denominator that grows with
  // the defender's own level, so a stat sourced purely from gear and INT ends
  // up at zero for anyone who skips both - and seven items in the whole game
  // carry mdef. A level-70 character in full plate was being two-shot by any
  // caster. This baseline lands magic at roughly the same ~1/3 reduction that
  // ordinary armour already gives against weapons; INT builds and mdef gear
  // go above it, as they should.
  const mdef = Math.floor(lv * 2.2 + s.vit * 1.2 + s.int * 2) + (gear.mdef || 0);

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
  //
  // At one percent of the bar a tick, refilling took over three minutes at
  // every level, which made potions the only real way to recover and put the
  // economy permanently in the red. Resting is meant to be the free option
  // that costs time; potions are what you buy to skip the sitting down.
  const hpRegen = Math.max(1, Math.floor(maxHp / 35 + s.vit / 5));
  // SP is what makes a rotation a rotation. At a ninetieth of the pool a tick
  // a level-70 character regained three quarters of a point a second against
  // skills costing twenty to seventy, so every job in the game opened with
  // its skills and then auto-attacked - which is exactly how the balance
  // report read the whole bestiary before it learned about skills at all.
  const spRegen = Math.max(1, Math.floor(maxSp / 18 + s.int / 4));

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

/**
 * How much of a blow lands on another player.
 *
 * PvE damage is tuned so that a level-70 character takes a monster down in
 * fifteen seconds. Two level-70 characters pointed at each other with the
 * same numbers kill in two or three, which is not a fight, it is a coin toss
 * decided by who clicked first. Everything is scaled back and the floor is
 * raised, so gear still matters but nobody is deleted before they can answer.
 *
 * The cap on a single blow is the important half: without it, one burst skill
 * with a high ratio ends a duel before the telegraph finishes drawing.
 */
export const PVP = { scale: 0.42, maxHitPct: 0.28 };
export function pvpDamage(raw, targetMaxHp) {
  const scaled = Math.max(1, Math.floor(raw * PVP.scale));
  return Math.min(scaled, Math.max(1, Math.floor(targetMaxHp * PVP.maxHitPct)));
}

export function elementMultiplier(attackEl = 'neutral', defenseEl = 'neutral') {
  // Canonicalised on the way in: saved characters carry item stacks tagged
  // with the names the elements had before they were renamed to match the
  // art, and a flame sword that quietly became neutral is a bug nobody would
  // report as one.
  const a = canonicalElement(attackEl), d = canonicalElement(defenseEl);
  return ELEMENT_TABLE[a]?.[d] ?? 1;
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

  // element, and whatever resistance the defender drank against it
  const el = o.element ?? (magic ? a.element : a.weaponElement) ?? 'neutral';
  dmg *= elementMultiplier(el, d.element ?? 'neutral');
  if (d.resist) dmg *= 1 - Math.min(0.8, (d.resist[el] ?? 0) + (d.resist.all ?? 0));

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
//
// The fraction also falls away sharply with rarity, and that is the single
// most important number in the economy. At a flat 28% the vendor was an
// unlimited coin faucet: a blessing oil is worth 12,000, so dropping one
// printed 3,360 Aurum out of nothing, and an hour of level-60 hunting paid
// forty thousand - more than a whole week of boss quests, in a game whose
// premise is that money is hard to come by. Worse, it set a price floor that
// no player would ever bid above, so the crafting materials the whole economy
// is supposed to revolve around had no player market at all.
//
// Common junk still liquidates at a fair rate, because carrying ten kinds of
// ore around is not interesting. Anything a crafter actually wants has to be
// sold to a crafter.
export const NPC_BUY_RATE = {
  common: 0.28, uncommon: 0.09, rare: 0.04, epic: 0.02, legendary: 0.01, mythic: 0.005,
};
// A recipe ingredient - and a piece of gear - is worth what another player
// will pay, never what a vendor will. Rarity alone was not enough: a steel
// ingot is tagged common and worth 750, so at the junk rate it alone paid 235
// Aurum a kill at level 70. Equipment is the same faucet wearing a helmet: a
// plate cuirass liquidates for thousands, and the shops deliberately do not
// sell gear above uncommon precisely so that players trade it instead.
export const CRAFT_INPUT_BUY_RATE = 0.05;
// Gear goes lower still. A drop worth two hundred thousand liquidates for a
// few thousand, which is a fair consolation for a duplicate and nowhere near
// a reason to farm one. What a piece of gear is worth is wearing it, or what
// another player will pay - and the market only exists if the vendor refuses.
export const EQUIP_BUY_RATE = 0.015;
export function npcSellPrice(refValue, soldToday = 0, rarity = 'common', dampen = false) {
  let rate = NPC_BUY_RATE[rarity] ?? NPC_BUY_RATE.common;
  if (dampen === 'equip') rate = Math.min(rate, EQUIP_BUY_RATE);
  else if (dampen) rate = Math.min(rate, CRAFT_INPUT_BUY_RATE);
  const base = refValue * rate;
  const decay = Math.pow(0.94, Math.max(0, soldToday - 5));
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
/**
 * What a failure costs, by the level you are refining *from*. Four bands,
 * named the way the forge window shows them:
 *   safe        +0..+2  cannot fail
 *   recommended +3..+4  a failure changes nothing but the money and stone
 *   risky       +5..+7  a failure drops the item one level
 *   danger      +8..+14 a failure destroys it
 * A protect item (blessing oil) turns any failure into "nothing happens".
 */
export function refineRisk(level) {
  if (level < 3) return { band: 'safe', onFail: 'none' };
  if (level < 5) return { band: 'recommended', onFail: 'unchanged' };
  if (level < 8) return { band: 'risky', onFail: 'down' };
  return { band: 'danger', onFail: 'break' };
}
/** Runed whetstones one attempt eats: none below +4, two from +10. */
export function refineStones(level) {
  return level < 4 ? 0 : level < 10 ? 1 : 2;
}
/** What the refine itself adds to an item (the same sums the server uses). */
export function refineBonus(refine = 0) {
  const b = refine + Math.max(0, refine - 7) * 1.5;
  return { atk: b * 2, matk: b * 1.5, def: b, mdef: b * 0.5 };
}
/**
 * Moving a refine from one item to another of the same kind. The new item
 * keeps the level up to +7; past that one level is lost on the way, so a
 * high refine still has to be earned and refined gear keeps its price.
 * The fee is a quarter of what refining the new item that far would have
 * cost in aurum, plus one whetstone per three levels moved.
 */
export function transferResult(level) {
  return level <= 7 ? level : level - 1;
}
export function transferFee(targetValue, level) {
  let sum = 0;
  for (let l = 0; l < level; l++) sum += refineCost(targetValue, l);
  return { aurum: Math.floor(sum * 0.25), stones: Math.floor(level / 3) };
}
/** Items that can trade a refine: both weapons, or both worn in one slot. */
export function transferCompatible(a, b) {
  if (!a || !b) return false;
  if (a.type === 'weapon' || b.type === 'weapon') return a.type === 'weapon' && b.type === 'weapon';
  return a.slot === b.slot;
}
export function refineCost(refValue, level) {
  return Math.floor(refValue * 0.15 + 120 * Math.pow(1.35, level));
}

/**
 * Getting up where you fell, instead of walking back from town. It costs
 * aurum that scales with level, and only once every few minutes, so a priest
 * in the party still matters and a wall you keep dying on stays a wall.
 */
export const REVIVE_HERE_COOLDOWN_MS = 5 * 60 * 1000;
export const REVIVE_HERE_HP = 0.3;
export function reviveHereCost(level) {
  return Math.max(100, Math.round((level | 0) * 30));
}
