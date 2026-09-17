// Damage application, status effects, aggro bookkeeping.
import { rollDamage } from '../../shared/formulas.js';

export const STATUS_DEFS = {
  poison:   { icon: '☠', dot: true, element: 'verdant' },
  burn:     { icon: '🔥', dot: true, element: 'ember' },
  chill:    { icon: '❄', slow: true },
  root:     { icon: '⛓', root: true },
  stun:     { icon: '💫', stun: true },
  shield:   { icon: '🛡', absorb: true },
  buff:     { icon: '↑' },
  debuff:   { icon: '↓' },
};

export function addStatus(target, status) {
  target.statuses ??= [];
  const existing = target.statuses.find((s) => s.key === status.key);
  if (existing) Object.assign(existing, status);
  else target.statuses.push(status);
}

export function hasStatus(target, type) {
  return (target.statuses ?? []).some((s) => s.type === type);
}

export function clearStatuses(target, only = null) {
  if (!target.statuses) return;
  target.statuses = target.statuses.filter((s) =>
    s.type === 'shield' || s.beneficial || (only && !only.includes(s.type)));
}

export function statusMods(target) {
  const m = { slowPct: 0, rooted: false, stunned: false, invisible: false };
  for (const s of target.statuses ?? []) {
    if (s.slowPct) m.slowPct += s.slowPct;
    if (s.type === 'root') m.rooted = true;
    if (s.type === 'stun') m.stunned = true;
    if (s.mods?.invisible) m.invisible = true;
  }
  return m;
}

/** Absorb through shields first, then HP. Returns damage actually taken. */
export function applyDamage(zone, attacker, target, amount, opts = {}) {
  if (!target.alive || amount <= 0) return 0;

  // Aegis / stance style flat reduction
  const taken = target.mods?.dmgTakenPct ?? 0;
  amount = Math.max(1, Math.floor(amount * (1 + taken / 100)));

  let remaining = amount;
  for (const s of target.statuses ?? []) {
    if (s.type === 'shield' && s.amount > 0) {
      const used = Math.min(s.amount, remaining);
      s.amount -= used;
      remaining -= used;
      if (remaining <= 0) break;
    }
  }
  if (target.statuses) target.statuses = target.statuses.filter((s) => s.type !== 'shield' || s.amount > 0);

  if (target.mods?.minHpGuard && target.hp - remaining < 1) remaining = Math.max(0, target.hp - 1);

  target.hp = Math.max(0, target.hp - remaining);
  target.lastCombat = Date.now();
  if (attacker) attacker.lastCombat = Date.now();

  zone.pushEvent({
    t: 'dmg', id: target.id, v: remaining, crit: !!opts.crit, el: opts.element ?? 'neutral',
    src: attacker?.id ?? null, skill: opts.skill ?? null,
  });

  // threat + loot/exp rights
  if (attacker && target.kind === 'monster') {
    const claimant = attacker.kind === 'player' ? attacker.id : attacker.owner;
    if (claimant) target.tapped?.add(claimant);
    target.threat ??= new Map();
    target.threat.set(attacker.id, (target.threat.get(attacker.id) ?? 0) + remaining + (opts.aggro ?? 0));
    if (!target.target || (target.threat.get(attacker.id) ?? 0) > (target.threat.get(target.target) ?? 0) * 1.25) {
      target.target = attacker.id;
    }
  }

  // reflect
  if (attacker && !opts.magic && target.mods?.reflectPct) {
    const back = Math.floor(remaining * target.mods.reflectPct / 100);
    if (back > 0 && attacker.alive) applyDamage(zone, null, attacker, back, { element: 'neutral', skill: 'reflect' });
  }

  // lifesteal
  if (attacker && opts.lifestealPct) {
    healEntity(zone, attacker, Math.floor(remaining * opts.lifestealPct / 100));
  }

  if (target.hp <= 0) zone.onDeath(target, attacker);
  return remaining;
}

export function healEntity(zone, target, amount) {
  if (!target?.alive || amount <= 0) return 0;
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + Math.floor(amount));
  const healed = target.hp - before;
  if (healed > 0) zone.pushEvent({ t: 'heal', id: target.id, v: healed });
  return healed;
}

/** A plain weapon swing. */
export function basicAttack(zone, attacker, target) {
  const a = attacker.derived, d = target.derived;
  const res = rollDamage(
    { ...a, element: attacker.element, weaponElement: attacker.weaponElement, critPower: attacker.critPower ?? 0 },
    { ...d, element: target.element, level: target.level },
    {
      ratio: 1,
      magic: false,
      element: attacker.weaponElement ?? 'neutral',
      sizeBonus: attacker.cards?.size?.[target.size] ?? 0,
      raceBonus: attacker.cards?.race?.[target.race] ?? 0,
      lifestealPct: attacker.mods?.lifestealPct ?? 0,
    }
  );
  if (res.miss) {
    zone.pushEvent({ t: 'miss', id: target.id, src: attacker.id });
    if (target.kind === 'monster') {
      target.threat ??= new Map();
      target.threat.set(attacker.id, (target.threat.get(attacker.id) ?? 0) + 1);
      target.target ??= attacker.id;
    }
    return 0;
  }
  return applyDamage(zone, attacker, target, res.damage, {
    crit: res.crit, element: attacker.weaponElement ?? 'neutral',
    lifestealPct: attacker.mods?.lifestealPct ?? 0,
  });
}
