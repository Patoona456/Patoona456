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
//   warpTo              a map id: its spawn point
//   randomTeleport      somewhere else on this map
//   summonMonster       one of this field's own monsters, hostile, one-shot
//   summonPet           { id, levelPct, secs } - a summon of your own
//   reviveOther         HP share for the nearest fallen friend
//   endow               the weapon's element while the buff lasts
//   party               the buff goes to every party member nearby as well
//   setSave             the save point, here
//   dailyReset          daily quests can be taken again
//   lockoutReset        weekly boss rewards can be earned again
//   identify            what the target monster is, and what it drops
//   gachaRoll: 'rare'   a shrine draw from SR up, straight from the bag
//   refineLuck / refineGuard / warpTicket / dungeonPass are spent elsewhere
//   (the smith, the warper, the Reliquary door), never drunk.
import { ITEMS } from '../../shared/data/items.js';
import { MAPS } from '../../shared/data/maps.js';
import { MONSTERS } from '../../shared/data/monsters.js';
import { QUESTS } from '../../shared/data/quests.js';
import { TILE } from '../../shared/constants.js';
import { addStatus } from './combat.js';
import * as Econ from './economy.js';

/** Where a scroll that moves you may not be read. */
const noTeleport = (def) => !!(def?.party || def?.pvp || def?.siege || def?.kind === 'dungeon' || def?.kind === 'boss');

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
  if (def.refineLuck || def.refineGuard) return { error: 'ใช้ที่ช่างตีเหล็กตอนตีบวก' };
  if (def.warpTicket) return { error: 'ยื่นให้ผู้ดูแลวาร์ปแทนค่าเดินทาง' };
  if (def.dungeonPass) return { error: 'ใช้เองที่ประตูหีบศพ — แค่พกไว้ในกระเป๋า' };
  const zdef = p.zone?.def ?? {};
  if ((def.randomTeleport || def.setSave) && noTeleport(zdef)) return { error: 'ใช้ในพื้นที่นี้ไม่ได้' };
  if (def.warpTo && !MAPS[def.warpTo]) return { error: 'ไม่พบปลายทาง' };
  let fodder = null;
  if (def.summonMonster) {
    const pool = (zdef.spawns ?? []).filter((sp) => !sp.boss && MONSTERS[sp.mob] && !MONSTERS[sp.mob].boss);
    if (zdef.safe || !['field', 'cave'].includes(zdef.kind) || !pool.length) return { error: 'ใช้ได้เฉพาะในทุ่งล่า' };
    fodder = pool[Math.floor(Math.random() * pool.length)].mob;
  }
  let fallen = null;
  if (def.reviveOther) {
    for (const o of p.zone?.players.values() ?? []) {
      if (o === p || o.alive || Math.hypot(o.x - p.x, o.y - p.y) > 160) continue;
      if (!fallen || Math.hypot(o.x - p.x, o.y - p.y) < Math.hypot(fallen.x - p.x, fallen.y - p.y)) fallen = o;
    }
    if (!fallen) return { error: 'ไม่มีใครล้มอยู่ใกล้ ๆ' };
  }
  let seen = null;
  if (def.identify) {
    seen = p.targetId ? p.zone?.entities.get(p.targetId) : null;
    if (seen?.kind !== 'monster') return { error: 'เลือกมอนสเตอร์เป็นเป้าหมายก่อน' };
  }
  if (def.dailyReset && !dailiesDone(p).length) return { error: 'ยังไม่มีเควสต์รายวันที่ส่งไป' };
  if (def.lockoutReset && !Object.keys(p.record.lockouts ?? {}).length) return { error: 'สัปดาห์นี้ยังไม่ได้รับรางวัลบอสเลย' };
  if (def.gachaRoll && !Econ.GACHA.pool.some((o) => ITEMS[o.id] && o.tier !== 'common')) return { error: 'ศาลยังไม่มีรางวัลให้สุ่ม' };
  if (def.reset === 'skills' && !Object.values(p.record.skills ?? {}).some(Boolean)) return { error: 'ยังไม่มีสกิลให้รีเซ็ต' };

  let notice = null;
  if (def.revive) {
    p.statuses = [];
    p.zone.revivePlayer(p, def.revive);
    notice = `${def.nameTh}: ฟื้นคืนชีพที่เดิม`;
  }
  const brew = 1 + (p.mods?.potionPct ?? 0) / 100;      // the alchemist's tome
  if (def.heal) p.hp = Math.min(p.maxHp, p.hp + Math.round(def.heal * brew));
  if (def.healSp) p.sp = Math.min(p.maxSp, p.sp + Math.round(def.healSp * brew));
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
    // elemental books share one slot: a new element replaces the old one
    const key = def.endow ? 'endow' : 'potion:' + def.id;
    const who = def.party ? partyNear(p) : [p];
    for (const q of who) {
      addStatus(q, {
        key, type: 'buff', icon: def.buff.icon, beneficial: true, item: def.id,
        until: now + def.buff.secs * 1000, mods: { ...def.buff.mods },
        ...(def.endow ? { endow: def.endow } : {}),
        ...(def.breakOnAttack ? { breakOnAttack: true } : {}),
      });
      if (q !== p) { q.recompute(); q.conn?.send({ t: 'notice', kind: 'good', text: `${p.name} ใช้${def.nameTh}ให้ปาร์ตี้` }); }
    }
    if (def.party) notice = `${def.nameTh}: ได้ผล ${who.length} คน`;
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

  if (fodder) {
    const at = p.zone.nearestWalkable ? p.zone.nearestWalkable(p.x + 60, p.y) : { x: p.x + 60, y: p.y };
    const m = p.zone.spawnMonster(fodder, at.x, at.y, {});
    m.oneShot = true;            // killed once, gone: it does not join the respawn table
    m.target = p.id;
    p.zone.pushEvent({ t: 'fx', fx: 'summon', x: m.x, y: m.y, el: 'dark' });
    notice = `${m.name} ปรากฏตัว!`;
  }
  if (def.summonPet) {
    p.zone.despawnSummonsOf?.(p.id);
    const m = p.zone.spawnMonster(def.summonPet.id, p.x + 24, p.y, {
      summon: true, owner: p.id, duration: def.summonPet.secs,
      levelPct: def.summonPet.levelPct * (1 + (p.mods?.summonStatPct ?? 0) / 100),
    });
    p.zone.pushEvent({ t: 'fx', fx: 'summon', x: m.x, y: m.y, el: 'earth' });
  }
  if (fallen) {
    p.zone.revivePlayer(fallen, def.reviveOther);
    fallen.conn?.send({ t: 'notice', kind: 'good', text: `${p.name} ชุบชีวิตคุณด้วย${def.nameTh}` });
    notice = `ชุบชีวิต ${fallen.name} แล้ว`;
  }
  if (def.setSave) {
    p.record.savePoint = { map: p.record.map, x: Math.round(p.x), y: Math.round(p.y) };
    notice = 'บันทึกจุดเกิดใหม่ตรงนี้แล้ว';
  }
  if (def.dailyReset) {
    const done = dailiesDone(p);
    for (const id of done) delete p.record.quests[id];
    notice = `รับเควสต์รายวันใหม่ได้ ${done.length} เควสต์`;
  }
  if (def.lockoutReset) {
    p.record.lockouts = {};
    notice = 'ตีบอสประจำสัปดาห์รับรางวัลได้อีกรอบ';
  }
  if (seen) notice = identifyText(seen);
  if (def.gachaRoll) {
    const r = Econ.gachaFreeRoll(p, def.gachaRoll);
    notice = `${def.nameTh}: ได้ ${ITEMS[r.id]?.nameTh ?? r.id} x${r.qty} [${r.grade}]`;
  }

  p.cooldowns[cdKey] = now + (def.cooldown ?? 3) * 1000;
  p.removeItemAt(idx, 1);
  p.recompute();
  if (def.warp === 'save') {
    const sp = p.record.savePoint;
    if (sp) world.warpPlayer(p, sp.map, sp.x, sp.y);
  }
  if (def.warpTo) {
    const [tx, ty] = MAPS[def.warpTo].spawnPoint;
    world.warpPlayer(p, def.warpTo, tx * TILE, ty * TILE);
  }
  if (def.randomTeleport) {
    const z = p.zone;
    for (let i = 0; i < 40; i++) {
      const x = (2 + Math.random() * (z.def.width - 4)) * TILE, y = (2 + Math.random() * (z.def.height - 4)) * TILE;
      if (!z.walkable || z.walkable(x, y)) { p.x = x; p.y = y; p.warpSafeUntil = now + 800; break; }
    }
    p.conn?.send({ t: 'self', self: p.selfState() });
  }
  return { ok: true, notice, item: def.id };
}

/** Party members in reach (and `p` itself). */
function partyNear(p) {
  if (!p.party) return [p];
  return [...(p.zone?.players.values() ?? [])]
    .filter((o) => o.alive && o.party === p.party && Math.hypot(o.x - p.x, o.y - p.y) <= 400);
}

/** Daily quests `p` has handed in. */
function dailiesDone(p) {
  return Object.entries(p.record.quests ?? {})
    .filter(([id, st]) => st?.done && QUESTS[id]?.repeatable === 'daily').map(([id]) => id);
}

/** What an identify scroll reads off a monster. */
function identifyText(m) {
  const d = m.def ?? {};
  const EL = { neutral: 'ไร้ธาตุ', fire: 'ไฟ', ice: 'น้ำแข็ง', lightning: 'สายฟ้า', earth: 'ดิน', wind: 'ลม', holy: 'แสง', dark: 'มืด' };
  const drops = (d.drops ?? []).slice(0, 6)
    .map((x) => `${ITEMS[x.id]?.nameTh ?? x.id} ${(x.chance * 100).toFixed(x.chance < 0.01 ? 2 : 0)}%`).join(', ');
  return `${m.name} Lv${m.level} · ธาตุ${EL[d.element] ?? d.element} · ${d.race ?? '-'} · ${d.size ?? '-'} · HP ${m.hp}/${m.maxHp}`
    + (drops ? ` · ดรอป: ${drops}` : '');
}

/** The summons `p` has out right now. */
export function ownSummons(p) {
  const out = [];
  for (const e of p.zone?.entities.values() ?? []) if (e.summon && e.owner === p.id && e.alive) out.push(e);
  return out;
}
