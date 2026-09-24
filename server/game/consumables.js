// What drinking something does.
//
// Every consumable is data (shared/data/items.js); this is the one place that
// reads its fields. A field is an effect, and one bottle may carry several:
//
//   heal / healSp       flat HP / SP
//   healPct / spPct     a share of the bar (the full restore)
//   cleanse             status types to wash off, or 'all' for every harmful one
//   regen               { hp, sp, duration } - a slow top-up
//   buff                { secs, mods, icon } - a timed status; drinking the
//                       same bottle again refreshes it rather than stacking
//   warp: 'save'        back to the save point
//   revive              HP/SP share to stand up with - only while down
//   throw               { range, secs, mods, slowPct } - onto the target
//   petHeal             every summon you own back to full
//   reset               'skills' | 'stats' | 'cooldowns'
import { ITEMS } from '../../shared/data/items.js';
import { addStatus } from './combat.js';
import * as Econ from './economy.js';

/** Harmful status types a full cleanse washes off. */
const HARMFUL = ['poison', 'burn', 'chill', 'root', 'stun', 'debuff'];

/**
 * Use the item in bag slot `idx`. Returns { ok, notice? } or { error }.
 * The server is the only judge of cooldowns, level, and whether you are
 * allowed to be alive again.
 */
export function useConsumable(world, p, idx, now = Date.now()) {
  const st = p.inventory[idx];
  if (!st) return { error: 'ไม่พบไอเทม' };
  const def = ITEMS[st.id];
  if (!def || def.type !== 'consumable') return { error: 'ใช้ไอเทมนี้ไม่ได้' };
  if (!p.alive && !def.revive) return { error: 'ล้มอยู่ ใช้ได้แค่ยาชุบชีวิต' };
  if (p.alive && def.revive) return { error: 'ใช้ได้ตอนล้มเท่านั้น' };
  if ((def.level ?? 1) > p.record.level) return { error: `ต้องเลเวล ${def.level}` };
  const cdKey = 'item:' + st.id;
  if ((p.cooldowns[cdKey] ?? 0) > now) return { error: 'ไอเทมยังคูลดาวน์' };

  // checks that can refuse, before anything is spent
  if (def.revive && p.zone?.def?.pvp) return { error: 'พื้นที่นี้ฟื้นที่เดิมไม่ได้' };
  let target = null;
  if (def.throw) {
    target = p.targetId ? p.zone?.entities.get(p.targetId) ?? p.zone?.players.get(p.targetId) : null;
    if (!target?.alive || !p.zone.isHostile(p, target)) return { error: 'ต้องเลือกศัตรูเป็นเป้าหมายก่อน' };
    if (Math.hypot(target.x - p.x, target.y - p.y) > def.throw.range) return { error: 'เป้าหมายอยู่ไกลเกินไป' };
  }
  if (def.petHeal && !ownSummons(p).length) return { error: 'ไม่มีสัตว์อัญเชิญอยู่' };
  if (def.reset === 'skills' && !Object.values(p.record.skills ?? {}).some(Boolean)) return { error: 'ยังไม่มีสกิลให้รีเซ็ต' };

  let notice = null;
  if (def.revive) {
    p.statuses = [];
    p.zone.revivePlayer(p, def.revive);
    notice = `${def.nameTh}: ฟื้นคืนชีพที่เดิม`;
  }
  if (def.heal) p.hp = Math.min(p.maxHp, p.hp + def.heal);
  if (def.healSp) p.sp = Math.min(p.maxSp, p.sp + def.healSp);
  if (def.healPct) p.hp = Math.min(p.maxHp, p.hp + Math.ceil(p.maxHp * def.healPct / 100));
  if (def.spPct) p.sp = Math.min(p.maxSp, p.sp + Math.ceil(p.maxSp * def.spPct / 100));
  if (def.cleanse) {
    const wash = def.cleanse === 'all' ? HARMFUL : def.cleanse;
    p.statuses = p.statuses.filter((s) => s.beneficial || !wash.includes(s.type));
  }
  if (def.regen) {
    addStatus(p, {
      key: 'regen:' + def.id, type: 'buff', icon: '🌿', beneficial: true, item: def.id,
      until: now + def.regen.duration * 1000,
      mods: { hpRegenPct: (def.regen.hp ?? 0) * 6, spRegenPct: (def.regen.sp ?? 0) * 6 },
    });
  }
  if (def.buff) {
    addStatus(p, {
      key: 'potion:' + def.id, type: 'buff', icon: def.buff.icon, beneficial: true, item: def.id,
      until: now + def.buff.secs * 1000, mods: { ...def.buff.mods },
      ...(def.breakOnAttack ? { breakOnAttack: true } : {}),
    });
  }
  if (def.throw) {
    addStatus(target, {
      key: 'potion:' + def.id, type: 'debuff', icon: '☠', item: def.id,
      until: now + def.throw.secs * 1000, mods: { ...def.throw.mods }, slowPct: def.throw.slowPct ?? 0,
    });
    target.recompute?.();
    p.zone.pushEvent({ t: 'fx', fx: 'debuff', x: target.x, y: target.y, r: 0, el: 'dark' });
    if (target.kind === 'monster') {            // it noticed who threw it
      target.threat ??= new Map();
      target.threat.set(p.id, (target.threat.get(p.id) ?? 0) + 50);
      target.target ??= p.id;
    }
  }
  if (def.petHeal) {
    for (const m of ownSummons(p)) m.hp = m.maxHp;
    notice = 'สัตว์อัญเชิญฟื้นเต็ม';
  }
  if (def.reset === 'stats') notice = `คืนแต้มสเตตัส ${Econ.resetStats(world, p, { free: true }).refund} แต้ม`;
  if (def.reset === 'skills') notice = `คืนแต้มสกิล ${Econ.resetSkills(world, p, { free: true }).refund} แต้ม`;
  if (def.reset === 'cooldowns') {
    for (const k of Object.keys(p.cooldowns)) if (!k.startsWith('item:')) delete p.cooldowns[k];
    notice = 'สกิลทั้งหมดพร้อมใช้';
  }

  p.cooldowns[cdKey] = now + (def.cooldown ?? 3) * 1000;
  p.removeItemAt(idx, 1);
  p.recompute();
  if (def.warp === 'save') {
    const sp = p.record.savePoint;
    if (sp) world.warpPlayer(p, sp.map, sp.x, sp.y);
  }
  return { ok: true, notice, item: def.id };
}

/** The summons `p` has out right now. */
export function ownSummons(p) {
  const out = [];
  for (const e of p.zone?.entities.values() ?? []) if (e.summon && e.owner === p.id && e.alive) out.push(e);
  return out;
}
