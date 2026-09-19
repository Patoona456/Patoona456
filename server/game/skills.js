// Skill execution. `begin` validates and starts a cast; `resolve` applies it.
import { SKILLS, val, skillCost } from '../../shared/data/skills.js';
import { rollDamage } from '../../shared/formulas.js';
import { applyDamage, healEntity, addStatus, clearStatuses } from './combat.js';
import { dist, dirTo } from './monster.js';
import { ITEMS } from '../../shared/data/items.js';

const now = () => Date.now();

function levelOf(caster, id) {
  if (caster.kind === 'player') return caster.record.skills[id] ?? 0;
  return Math.max(1, Math.floor((caster.level ?? 1) / 12));
}

export function begin(zone, caster, skillId, opts = {}) {
  const sk = SKILLS[skillId];
  if (!sk) return { error: 'ไม่พบสกิล' };
  if (sk.kind === 'passive') return { error: 'สกิลนี้เป็นพาสซีฟ' };
  const lvl = levelOf(caster, skillId);
  if (lvl <= 0) return { error: 'ยังไม่ได้เรียนสกิลนี้' };
  if (!caster.alive) return { error: 'ตายอยู่' };

  const cdUntil = caster.cooldowns?.[skillId] ?? 0;
  if (cdUntil > now()) return { error: 'สกิลยังคูลดาวน์' };

  const spCost = Math.round(skillCost(sk, lvl) * (1 + (caster.mods?.spCostPct ?? 0) / 100));
  if (caster.kind === 'player') {
    if (caster.sp < spCost) return { error: 'SP ไม่พอ' };
    if (sk.weapon && !sk.weapon.includes(caster.weaponClass)) return { error: 'อาวุธไม่ถูกประเภท' };
    if (sk.ammo && caster.weaponClass === 'bow' && (caster.findAmmo()?.qty ?? 0) < sk.ammo) {
      return { error: 'ลูกธนูไม่พอ' };
    }
    if (sk.reagent && caster.countItem(sk.reagent) < 1) {
      return { error: `ต้องใช้ ${ITEMS[sk.reagent]?.nameTh ?? sk.reagent}` };
    }
  }

  // target validation
  let target = null;
  if (sk.target === 'enemy' || sk.target === 'ally' || sk.target === 'corpse') {
    target = zone.entities.get(opts.targetId);
    if (!target) return { error: 'ไม่มีเป้าหมาย' };
    const range = (sk.range ?? 48) * (1 + (caster.rangeBonus ?? 0) / 100);
    if (dist(caster, target) > range + 16) return { error: 'เป้าหมายอยู่ไกลเกินไป' };
    if (sk.target === 'enemy' && !zone.isHostile(caster, target)) return { error: 'เป้าหมายไม่ใช่ศัตรู' };
    if (sk.target === 'ally' && zone.isHostile(caster, target)) return { error: 'เป้าหมายไม่ใช่พวกเดียวกัน' };
  }
  let point = opts.point;
  if (sk.target === 'point') {
    point ??= { x: caster.x, y: caster.y };
    const d = Math.hypot(point.x - caster.x, point.y - caster.y);
    const range = sk.range ?? 120;
    if (d > range) {
      point = { x: caster.x + (point.x - caster.x) / d * range, y: caster.y + (point.y - caster.y) / d * range };
    }
  }

  const castTime = (sk.castTime ?? 0) * (caster.derived?.castFactor ?? 1);
  caster.dir = target ? dirTo(caster, target) : point ? dirTo(caster, point) : caster.dir;
  caster.anim = sk.anim ?? 'spellcast';
  caster.animStart = now();

  const payload = { skillId, lvl, spCost, targetId: target?.id ?? null, point };
  if (castTime > 0.05) {
    caster.cast = { ...payload, until: now() + castTime * 1000, startedAt: now() };
    zone.pushEvent({ t: 'cast', id: caster.id, skill: skillId, dur: castTime });
    return { ok: true, casting: true };
  }
  return resolve(zone, caster, payload);
}

export function resolve(zone, caster, payload) {
  const { skillId, lvl, spCost, targetId } = payload;
  const sk = SKILLS[skillId];
  if (!sk || !caster.alive) return { error: 'ยกเลิก' };

  if (caster.kind === 'player') {
    if (caster.sp < spCost) return { error: 'SP ไม่พอ' };
    caster.sp -= spCost;
    if (sk.ammo && caster.weaponClass === 'bow') caster.consumeAmmo(sk.ammo);
    if (sk.reagent) caster.removeItemById(sk.reagent, 1);
  }
  caster.cooldowns ??= {};
  caster.cooldowns[skillId] = now() + Math.max(0.5, val(sk.cooldown, lvl)) * 1000;
  caster.cast = null;
  caster.lastCombat = now();

  // casting breaks stealth
  if (caster.statuses) {
    const cloak = caster.statuses.find((s) => s.breakOnAttack);
    if (cloak && sk.kind !== 'buff') caster.statuses.splice(caster.statuses.indexOf(cloak), 1);
  }

  const target = targetId ? zone.entities.get(targetId) : null;
  const point = payload.point ?? (target ? { x: target.x, y: target.y } : { x: caster.x, y: caster.y });
  const ctx = { zone, caster, sk, lvl, target, point };

  switch (sk.kind) {
    case 'damage': return doDamage(ctx);
    case 'aoe': return doAoe(ctx);
    case 'line': return doLine(ctx);
    case 'chain': return doChain(ctx);
    case 'heal': return doHeal(ctx);
    case 'buff': return doBuff(ctx);
    case 'debuff': return doDebuff(ctx);
    case 'dash': return doDash(ctx);
    case 'ground': return doGround(ctx);
    case 'summon': return doSummon(ctx);
    case 'revive': return doRevive(ctx);
    default: return { error: 'สกิลนี้ยังไม่รองรับ' };
  }
}

function attackerCard(caster, sk) {
  return {
    ...caster.derived,
    element: caster.element,
    weaponElement: caster.weaponElement,
    critPower: caster.critPower ?? 0,
  };
}

function hitOne(ctx, target, ratioMul = 1) {
  const { zone, caster, sk, lvl } = ctx;
  if (!target?.alive) return 0;
  let ratio = val(sk.ratio, lvl) * ratioMul;

  // situational bonuses
  if (sk.behindBonus) {
    const facing = [[0, -1], [-1, 0], [0, 1], [1, 0]][target.dir ?? 2];
    const to = { x: caster.x - target.x, y: caster.y - target.y };
    const len = Math.hypot(to.x, to.y) || 1;
    if ((to.x / len) * facing[0] + (to.y / len) * facing[1] < -0.2) ratio += val(sk.behindBonus, lvl);
  }
  if (sk.fromStealth && caster.mods?.invisible) ratio *= val(sk.fromStealth, lvl);

  const res = rollDamage(attackerCard(caster, sk), { ...target.derived, element: target.element, level: target.level }, {
    ratio,
    magic: !!sk.magic,
    element: sk.element ?? (sk.magic ? sk.element : caster.weaponElement) ?? 'neutral',
    hits: Math.max(1, Math.round(val(sk.hits, lvl) || 1)),
    ignoreDef: !!sk.ignoreDef,
    sizeBonus: caster.cards?.size?.[target.size] ?? 0,
    // Cards are one source of a race bonus; a skill may also be written to
    // bite a particular kind of thing, which is how a healer gets a reason
    // to be in an undead zone without becoming a general-purpose nuke.
    raceBonus: (caster.cards?.race?.[target.race] ?? 0)
      + (sk.raceBonus?.[target.race] ? val(sk.raceBonus[target.race], lvl) : 0),
    alwaysHit: !!sk.magic,
  });
  if (res.miss) { zone.pushEvent({ t: 'miss', id: target.id, src: caster.id }); return 0; }

  if (sk.pierce) res.damage = Math.floor(res.damage * (1 + sk.pierce));
  const dealt = applyDamage(zone, caster, target, res.damage, {
    crit: res.crit, element: sk.element ?? 'neutral', skill: sk.id, magic: !!sk.magic,
    lifestealPct: (caster.mods?.lifestealPct ?? 0) + (sk.lifesteal ? val(sk.lifesteal, lvl) : 0),
  });

  if (sk.status && Math.random() * 100 < val(sk.status.chance, lvl)) {
    applyStatus(zone, target, sk, lvl);
  }
  if (sk.knockback) knockback(ctx.zone, caster, target, sk.knockback);
  if (sk.steal && !target.stolen && target.kind === 'monster' && caster.kind === 'player') {
    const chance = val(sk.steal.chance, lvl) + (caster.mods?.stealBonus ?? 0);
    if (Math.random() * 100 < chance) {
      const drops = target.def.drops ?? [];
      const pick = drops[Math.floor(Math.random() * drops.length)];
      if (pick) {
        target.stolen = true;
        caster.addItem(pick.id, 1);
        zone.pushEvent({ t: 'steal', id: caster.id, item: pick.id });
      }
    }
  }
  return dealt;
}

function applyStatus(zone, target, sk, lvl) {
  const st = sk.status;
  addStatus(target, {
    key: st.type, type: st.type, icon: st.type === 'poison' ? '☠' : st.type === 'burn' ? '🔥' : st.type === 'chill' ? '❄' : '⛓',
    until: now() + val(st.duration, lvl) * 1000,
    tick: st.tick ? val(st.tick, lvl) : 0,
    nextTick: now() + 1000,
    slowPct: st.slowPct ? -val(st.slowPct, lvl) : 0,
    element: sk.element,
  });
  zone.pushEvent({ t: 'status', id: target.id, status: st.type });
}

function knockback(zone, from, target, distance) {
  const dx = target.x - from.x, dy = target.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  zone.moveTo(target, target.x + dx / len * distance, target.y + dy / len * distance);
}

/* ------------------------- kinds ------------------------- */
function doDamage(ctx) {
  const dealt = hitOne(ctx, ctx.target);
  ctx.zone.pushEvent({ t: 'skill', id: ctx.caster.id, skill: ctx.sk.id, target: ctx.target?.id, anim: ctx.sk.anim });
  return { ok: true, dealt };
}

function doAoe(ctx) {
  const { zone, caster, sk, lvl } = ctx;
  const center = sk.target === 'self' ? caster : ctx.point;
  const radius = val(sk.radius, lvl);
  let total = 0;
  for (const e of zone.entitiesNear(center, radius)) {
    if (!zone.isHostile(caster, e)) continue;
    total += hitOne(ctx, e);
  }
  zone.pushEvent({ t: 'fx', fx: 'aoe', x: center.x, y: center.y, r: radius, skill: sk.id, el: sk.look ?? sk.element });
  return { ok: true, dealt: total };
}

function doLine(ctx) {
  const { zone, caster, sk, lvl } = ctx;
  const dx = ctx.point.x - caster.x, dy = ctx.point.y - caster.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const range = sk.range ?? 200, width = sk.width ?? 32;
  let total = 0;
  for (const e of zone.entities.values()) {
    if (!zone.isHostile(caster, e) || !e.alive) continue;
    const rx = e.x - caster.x, ry = e.y - caster.y;
    const along = rx * ux + ry * uy;
    if (along < 0 || along > range) continue;
    const off = Math.abs(rx * -uy + ry * ux);
    if (off > width) continue;
    total += hitOne(ctx, e);
  }
  zone.pushEvent({ t: 'fx', fx: 'line', x: caster.x, y: caster.y, tx: caster.x + ux * range, ty: caster.y + uy * range, skill: sk.id, el: sk.look ?? sk.element });
  return { ok: true, dealt: total };
}

function doChain(ctx) {
  const { zone, caster, sk, lvl } = ctx;
  let current = ctx.target;
  const hitSet = new Set();
  let mul = 1, total = 0;
  const jumps = Math.round(val(sk.jumps, lvl));
  for (let i = 0; i <= jumps && current; i++) {
    total += hitOne(ctx, current, mul);
    hitSet.add(current.id);
    mul *= sk.falloff ?? 0.75;
    const next = [...zone.entitiesNear(current, sk.jumpRange ?? 120)]
      .filter((e) => !hitSet.has(e.id) && zone.isHostile(caster, e))[0];
    if (next) zone.pushEvent({ t: 'fx', fx: 'bolt', x: current.x, y: current.y, tx: next.x, ty: next.y, skill: sk.id, el: sk.look ?? sk.element });
    current = next;
  }
  return { ok: true, dealt: total };
}

function doHeal(ctx) {
  const { zone, caster, sk, lvl } = ctx;
  const target = sk.target === 'self' ? caster : (ctx.target ?? caster);
  const power = val(sk.heal, lvl) + (sk.matkRatio ? (caster.derived.matk ?? 0) * val(sk.matkRatio, lvl) : 0);
  const healed = healEntity(zone, target, power);
  zone.pushEvent({ t: 'fx', fx: 'heal', x: target.x, y: target.y, skill: sk.id, el: sk.look ?? sk.element });
  return { ok: true, healed };
}

function doBuff(ctx) {
  const { zone, caster, sk, lvl } = ctx;
  const targets = sk.target === 'party'
    ? zone.partyMembersNear(caster, sk.range ?? 200)
    : [sk.target === 'ally' ? (ctx.target ?? caster) : caster];
  const duration = val(sk.duration, lvl) * 1000;
  for (const t of targets) {
    if (sk.cleanse) { clearStatuses(t); continue; }
    const mods = {};
    for (const [k, v] of Object.entries(sk.mods ?? {})) mods[k] = val(v, lvl);
    addStatus(t, {
      key: sk.id, type: 'buff', icon: '↑', beneficial: true,
      until: now() + duration, mods, breakOnAttack: !!sk.breakOnAttack,
    });
    if (sk.shield) {
      addStatus(t, { key: sk.id + ':shield', type: 'shield', icon: '🛡', beneficial: true,
        until: now() + duration, amount: val(sk.shield, lvl) });
    }
    t.recompute?.();
    zone.pushEvent({ t: 'fx', fx: 'buff', x: t.x, y: t.y, skill: sk.id, el: sk.look ?? sk.element });
  }
  return { ok: true };
}

function doDebuff(ctx) {
  const { zone, caster, sk, lvl } = ctx;
  const radius = sk.radius ? val(sk.radius, lvl) : 0;
  const targets = radius
    ? [...zone.entitiesNear(caster, radius)].filter((e) => zone.isHostile(caster, e))
    : [ctx.target].filter(Boolean);
  for (const t of targets) {
    const mods = {};
    for (const [k, v] of Object.entries(sk.mods ?? {})) mods[k] = val(v, lvl);
    addStatus(t, { key: sk.id, type: 'debuff', icon: '↓', until: now() + val(sk.duration, lvl) * 1000, mods });
    if (sk.aggro && t.kind === 'monster') {
      t.threat ??= new Map();
      t.threat.set(caster.id, (t.threat.get(caster.id) ?? 0) + val(sk.aggro, lvl));
      t.target = caster.id;
    }
    t.recompute?.();
  }
  zone.pushEvent({ t: 'fx', fx: 'debuff', x: caster.x, y: caster.y, r: radius, skill: sk.id, el: sk.look ?? sk.element });
  return { ok: true };
}

function doDash(ctx) {
  const { zone, caster, sk, lvl } = ctx;
  const facing = [[0, -1], [-1, 0], [0, 1], [1, 0]][caster.dir ?? 2];
  let ux = facing[0], uy = facing[1];
  if (ctx.point) {
    const dx = ctx.point.x - caster.x, dy = ctx.point.y - caster.y;
    const len = Math.hypot(dx, dy);
    if (len > 8) { ux = dx / len; uy = dy / len; }
  }
  const d = val(sk.distance, lvl);
  const from = { x: caster.x, y: caster.y };
  zone.moveTo(caster, caster.x + ux * d, caster.y + uy * d, true);
  if (sk.ratio) {
    const mid = { x: (from.x + caster.x) / 2, y: (from.y + caster.y) / 2 };
    for (const e of zone.entitiesNear(mid, (sk.radius ?? 48) + d / 2)) {
      if (zone.isHostile(caster, e)) hitOne(ctx, e);
    }
  }
  zone.pushEvent({ t: 'fx', fx: 'dash', x: from.x, y: from.y, tx: caster.x, ty: caster.y, skill: sk.id, el: sk.look ?? sk.element });
  return { ok: true };
}

function doGround(ctx) {
  const { zone, caster, sk, lvl } = ctx;
  zone.addGroundEffect({
    skill: sk.id, ownerId: caster.id, x: ctx.point.x, y: ctx.point.y,
    radius: val(sk.radius, lvl), until: now() + val(sk.duration, lvl) * 1000,
    tickRate: (sk.tickRate ?? 1) * 1000, nextTick: now(),
    ratio: sk.ratio ? val(sk.ratio, lvl) : 0,
    healTick: sk.healTick ? val(sk.healTick, lvl) : 0,
    magic: !!sk.magic, element: sk.element, look: sk.look ?? sk.element, lvl,
    trap: sk.trap ? { type: sk.trap.type, duration: val(sk.trap.duration, lvl) } : null,
    status: sk.status ?? null,
  });
  zone.pushEvent({ t: 'fx', fx: 'ground', x: ctx.point.x, y: ctx.point.y, r: val(sk.radius, lvl), skill: sk.id, el: sk.look ?? sk.element });
  return { ok: true };
}

function doSummon(ctx) {
  const { zone, caster, sk, lvl } = ctx;
  zone.despawnSummonsOf(caster.id);
  const m = zone.spawnMonster(sk.summon.id, caster.x + 24, caster.y, {
    summon: true, owner: caster.id,
    levelPct: val(sk.summon.levelPct, lvl) * (1 + (caster.mods?.summonStatPct ?? 0) / 100),
    duration: val(sk.duration, lvl),
  });
  zone.pushEvent({ t: 'fx', fx: 'summon', x: m.x, y: m.y, skill: sk.id, el: sk.look ?? sk.element });
  return { ok: true };
}

function doRevive(ctx) {
  const { zone, sk, lvl } = ctx;
  const target = ctx.target;
  if (!target || target.alive) return { error: 'เป้าหมายไม่ได้ตายอยู่' };
  zone.revivePlayer(target, val(sk.hpPct, lvl) / 100);
  return { ok: true };
}
