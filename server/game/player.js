// The live, in-world representation of a character record.
import { deriveStats, baseExpToNext, jobExpToNext, statCost } from '../../shared/formulas.js';
import { ITEMS, isEquip, RETIRED_ITEMS } from '../../shared/data/items.js';
import { JOBS, jobOf, availableSkills } from '../../shared/data/jobs.js';
import * as Guild from './guild.js';
import * as Siege from './siege.js';
import { SKILLS, val } from '../../shared/data/skills.js';
import { MAX_BASE_LEVEL, MAX_JOB_LEVEL, SLOTS, STAT_CAP, TILE } from '../../shared/constants.js';
import { markDirty } from '../persistence.js';
import { jobCanHold } from '../../shared/weapons.js';

let seq = 0;

/**
 * Drop whatever a save holds that the item table no longer has - the whole
 * old item set was cleared for a new one - and keep the equipment slots
 * pointing at the rows they pointed at before.
 */
/** Bag expansion: each step carries this much more, bought with aurum. */
export const BAG_STEP = 300;
export const BAG_MAX = 10;
export const bagCost = (level) => 20000 * (level + 1);

export function purgeUnknownItems(record) {
  const keep = (st) => st && ITEMS[st.id];
  const inv = record.inventory ?? [];
  const moved = new Map();
  const next = [];
  inv.forEach((st, i) => { if (keep(st)) { moved.set(i, next.length); next.push(st); } });
  let changed = next.length !== inv.length;
  record.inventory = next;
  for (const [slot, idx] of Object.entries(record.equipment ?? {})) {
    if (moved.has(idx)) { if (moved.get(idx) !== idx) changed = true; record.equipment[slot] = moved.get(idx); }
    else { delete record.equipment[slot]; changed = true; }
  }
  if (record.storage) {
    const kept = record.storage.filter(keep);
    changed ||= kept.length !== record.storage.length;
    record.storage = kept;
  }
  for (const st of record.inventory.concat(record.storage ?? [])) {
    if (Array.isArray(st.cards) && st.cards.some((c) => c && !ITEMS[c])) {
      st.cards = st.cards.map((c) => (c && ITEMS[c] ? c : null));
      changed = true;
    }
  }
  if (Array.isArray(record.hotbarItems)) record.hotbarItems = record.hotbarItems.filter((id) => ITEMS[id]);
  if (changed) markDirty();
  return changed;
}

export class Player {
  constructor(record, conn) {
    this.kind = 'player';
    this.id = 'p' + (++seq);
    this.record = record;
    for (const st of [...(record.inventory ?? []), ...(record.storage ?? [])]) {
      if (st && RETIRED_ITEMS[st.id]) st.id = RETIRED_ITEMS[st.id];
    }
    purgeUnknownItems(record);
    this.conn = conn;
    this.name = record.name;
    this.look = record.look;
    this.x = record.x; this.y = record.y;
    this.dir = 0; this.anim = 'idle'; this.animStart = 0;   // DIR8: facing the camera
    this.animUntil = 0; this.animSpeed = 1;   // one-shot swing bookkeeping
    this.alive = true;
    this.statuses = [];
    this.cooldowns = {};          // skillId -> timestamp ms
    this.input = { mx: 0, my: 0 };
    this.attacking = false;
    this.targetId = null;
    this.nextAttackAt = 0;
    this.cast = null;             // { skill, level, until, targetId, point }
    this.lastCombat = 0;
    this.regenAt = 0;
    // Which party this character is in. Backed by the record rather than the
    // instance, so a server restart does not dissolve everyone's group - the
    // rest of the server keeps using `p.party` and never has to know.
    Object.defineProperty(this, 'party', {
      get: () => this.record.party ?? null,
      set: (v) => { this.record.party = v ?? null; },
    });
    this.trade = null;           // trade session id, see game/trade.js
    this.tradeInvite = null;
    this.mods = {};
    this.cards = { size: {}, race: {} };
    this.element = 'neutral';
    this.size = 'medium';
    this.race = 'human';
    this.recompute();
    this.hp = record.hp ?? this.maxHp;
    this.sp = record.sp ?? this.maxSp;
    if (this.hp <= 0) this.hp = this.maxHp;
  }

  get level() { return this.record.level; }
  get maxHp() { return this.derived.maxHp; }
  get maxSp() { return this.derived.maxSp; }

  /* ---------------- stats ---------------- */
  equippedItem(slot) {
    const ref = this.record.equipment[slot];
    // an index, and 0 is a real one: a new character's starter sword is there
    if (ref == null) return null;
    const stack = this.record.inventory[ref];
    if (!stack) return null;
    const def = ITEMS[stack.id];
    return def ? { stack, def, index: ref } : null;
  }

  gearBonuses() {
    const g = { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0, atk: 0, matk: 0, def: 0, mdef: 0,
      hit: 0, flee: 0, crit: 0, hp: 0, sp: 0, speed: 0, cast: 0, aspd: 0, weightCap: null };
    // Rebuilt from scratch every time, or unequipping a card keeps its bonus.
    this.cards = { size: {}, race: {} };
    let weightCapBonus = 0;
    this.weaponElement = 'neutral';
    this.weaponDelay = 1.2;
    this.attackRange = 40;
    this.weaponClass = null;

    for (const slot of SLOTS) {
      const eq = this.equippedItem(slot);
      if (!eq) continue;
      const { def, stack } = eq;
      const broken = stack.dur !== undefined && stack.dur <= 0;
      const refMul = broken ? 0 : 1;
      const refine = stack.refine ?? 0;
      // refine: +2 ATK or +1 DEF per level, compounding a little past +7
      const refBonus = refine + Math.max(0, refine - 7) * 1.5;

      for (const k of ['str', 'agi', 'vit', 'int', 'dex', 'luk']) g[k] += (def.stats?.[k] ?? 0) * refMul;
      g.atk += ((def.atk ?? 0) + refBonus * 2) * refMul;
      g.matk += ((def.matk ?? 0) + refBonus * 1.5) * refMul;
      g.def += ((def.def ?? 0) + refBonus) * refMul;
      g.mdef += ((def.mdef ?? 0) + refBonus * 0.5) * refMul;
      g.hit += (def.hit ?? 0) * refMul;
      g.flee += (def.flee ?? 0) * refMul;
      g.crit += (def.crit ?? 0) * refMul;
      g.hp += (def.hp ?? 0) * refMul;
      g.sp += (def.sp ?? 0) * refMul;
      g.speed += (def.speed ?? 0) * refMul;
      g.cast += (def.cast ?? 0) * refMul;
      weightCapBonus += def.weightCapBonus ?? 0;

      // Sockets. A card's bonus is not scaled by refine and does not die with
      // a broken item's stats: it is the card that is doing the work, not the
      // gear, and the two are only ever separated by destroying one of them.
      for (const cid of stack.cards ?? []) {
        const c = ITEMS[cid]?.card;
        if (!c) continue;
        for (const [k, v] of Object.entries(c.stats ?? {})) g[k] += v;
        for (const k of ['atk', 'matk', 'def', 'mdef', 'hit', 'flee', 'crit', 'hp', 'sp', 'speed', 'cast', 'aspd']) {
          if (c[k]) g[k] += c[k];
        }
        for (const [size, v] of Object.entries(c.size ?? {})) {
          this.cards.size[size] = (this.cards.size[size] ?? 0) + v;
        }
        for (const [race, v] of Object.entries(c.race ?? {})) {
          this.cards.race[race] = (this.cards.race[race] ?? 0) + v;
        }
      }

      if (slot === 'weapon' && !broken) {
        this.weaponElement = def.element ?? 'neutral';
        this.weaponDelay = def.delay ?? 1.2;
        this.attackRange = def.range ?? 40;
        this.weaponClass = def.wclass ?? null;
      }
    }

    // ammo adds to bow damage
    if (this.weaponClass === 'bow') {
      const ammo = this.findAmmo();
      if (ammo) {
        g.atk += ITEMS[ammo.id].atk ?? 0;
        if (ITEMS[ammo.id].element) this.weaponElement = ITEMS[ammo.id].element;
      }
    }

    // passive skills
    for (const [sid, lvl] of Object.entries(this.record.skills)) {
      const sk = SKILLS[sid];
      if (!sk || sk.kind !== 'passive' || !lvl) continue;
      const m = sk.mods ?? {};
      if (m.fleeFlat) g.flee += val(m.fleeFlat, lvl);
      if (m.hitFlat) g.hit += val(m.hitFlat, lvl);
      if (m.critFlat) g.crit += val(m.critFlat, lvl);
      if (m.lukFlat) g.luk += val(m.lukFlat, lvl);
      if (m.speedPct) g.speed += val(m.speedPct, lvl);
      if (m.maxHpPct) g.hpPct = (g.hpPct ?? 0) + val(m.maxHpPct, lvl);
    }

    g.weightCap = 2000 + (this.record.str + g.str) * 30 + this.record.level * 10 + weightCapBonus
      + (this.record.bagLevel ?? 0) * BAG_STEP;
    return g;
  }

  /** Timed buffs/debuffs collapsed into one modifier object. */
  buffMods() {
    const m = { atkPct: 0, matkPct: 0, defPct: 0, speedPct: 0, dmgTakenPct: 0, reflectPct: 0,
      lifestealPct: 0, spRegenPct: 0, hpRegenPct: 0, castPct: 0, spCostPct: 0, minHpGuard: 0,
      invisible: 0, statusRes: 0, strFlat: 0, intFlat: 0, dexFlat: 0, agiFlat: 0, vitFlat: 0, lukFlat: 0,
      fleePct: 0, critFlat: 0, expPct: 0, dropPct: 0, rareDropPct: 0, aurumPct: 0, summonStatPct: 0,
      maxHpPct: 0, maxSpPct: 0, potionPct: 0 };
    for (const s of this.statuses) {
      if (!s.mods) continue;
      for (const [k, v] of Object.entries(s.mods)) m[k] = (m[k] ?? 0) + v;
    }
    return m;
  }

  recompute() {
    this.idv = (this.idv ?? 0) + 1;      // appearance may have changed
    const job = jobOf(this.record.job);
    const gear = this.gearBonuses();
    const bm = this.buffMods();
    gear.str += bm.strFlat; gear.int += bm.intFlat; gear.dex += bm.dexFlat;
    gear.agi += bm.agiFlat; gear.vit += bm.vitFlat; gear.luk += bm.lukFlat;

    const d = deriveStats(this.record, job, gear);
    if (gear.hpPct || bm.maxHpPct) d.maxHp = Math.floor(d.maxHp * (1 + ((gear.hpPct ?? 0) + bm.maxHpPct) / 100));
    if (bm.maxSpPct) d.maxSp = Math.floor(d.maxSp * (1 + bm.maxSpPct / 100));
    // an elemental tome sets the weapon's element while it lasts
    const endow = this.statuses.find((s) => s.endow);
    if (endow) this.weaponElement = endow.endow;
    d.atk = Math.floor(d.atk * (1 + bm.atkPct / 100));
    d.matk = Math.floor(d.matk * (1 + bm.matkPct / 100));
    d.def = Math.floor(d.def * (1 + bm.defPct / 100));
    d.flee = Math.floor(d.flee * (1 + bm.fleePct / 100));
    d.moveSpeed = Math.max(40, d.moveSpeed * (1 + bm.speedPct / 100));
    d.castFactor = Math.max(0.15, d.castFactor * (1 - bm.castPct / 100));
    d.crit += bm.critFlat;
    // elemental resistance from potions, as a share of the damage: res_fire, res_all
    d.resist = {};
    for (const [k, v] of Object.entries(bm)) if (k.startsWith('res_') && v) d.resist[k.slice(4)] = v / 100;
    // the guild's passive skills, carried by every member
    for (const s of Guild.skillsOf(this.record)) {
      for (const [k, v] of Object.entries(s.pct ?? {})) if (d[k] != null) d[k] = Math.floor(d[k] * (1 + v / 100));
      for (const [k, v] of Object.entries(s.flat ?? {})) if (d[k] != null) d[k] += v;
    }
    d.level = this.record.level;
    this.derived = d;
    this.mods = bm;
    this.weightCap = gear.weightCap;
    if (this.hp > d.maxHp) this.hp = d.maxHp;
    if (this.sp > d.maxSp) this.sp = d.maxSp;
    return d;
  }

  /* ---------------- inventory ---------------- */
  get inventory() { return this.record.inventory; }

  weight() {
    let w = 0;
    for (const st of this.inventory) w += (ITEMS[st.id]?.weight ?? 1) * (st.qty ?? 1);
    return Math.round(w);
  }

  overweight() { return this.weight() > this.weightCap; }

  addItem(id, qty = 1, extra = null) {
    const def = ITEMS[id];
    if (!def || qty <= 0) return false;
    if (!extra?.force && this.weight() + (def.weight ?? 1) * qty > this.weightCap * 1.5) return false;
    const maxStack = def.stack ?? 1;

    if (maxStack > 1) {
      let left = qty;
      for (const st of this.inventory) {          // top up existing stacks first
        if (left <= 0) break;
        if (st.id !== id || st.refine) continue;
        const room = maxStack - (st.qty ?? 1);
        if (room <= 0) continue;
        const add = Math.min(room, left);
        st.qty = (st.qty ?? 1) + add;
        left -= add;
      }
      while (left > 0) {
        if (this.inventory.length >= 100) { markDirty(); return false; }
        const take = Math.min(maxStack, left);
        this.inventory.push({ id, qty: take });
        left -= take;
      }
    } else {
      for (let i = 0; i < qty; i++) {             // equipment: one row each
        if (this.inventory.length >= 100) { markDirty(); return false; }
        const row = { id, qty: 1 };
        if (isEquip(def)) {
          row.refine = extra?.refine ?? 0;
          row.dur = extra?.dur ?? def.durability ?? 100;
        }
        this.inventory.push(row);
      }
    }
    markDirty();
    return true;
  }

  removeItemAt(index, qty = 1) {
    const st = this.inventory[index];
    if (!st) return false;
    if ((st.qty ?? 1) > qty) { st.qty -= qty; markDirty(); return true; }
    // unequip if equipped, then splice and fix equipment indices
    for (const [slot, idx] of Object.entries(this.record.equipment)) {
      if (idx === index) delete this.record.equipment[slot];
    }
    this.inventory.splice(index, 1);
    for (const [slot, idx] of Object.entries(this.record.equipment)) {
      if (idx > index) this.record.equipment[slot] = idx - 1;
    }
    markDirty();
    this.recompute();
    return true;
  }

  countItem(id) {
    let n = 0;
    for (const st of this.inventory) if (st.id === id) n += st.qty ?? 1;
    return n;
  }

  removeItemById(id, qty = 1) {
    if (this.countItem(id) < qty) return false;
    let left = qty;
    for (let i = this.inventory.length - 1; i >= 0 && left > 0; i--) {
      const st = this.inventory[i];
      if (st.id !== id) continue;
      const take = Math.min(left, st.qty ?? 1);
      this.removeItemAt(i, take);
      left -= take;
    }
    return true;
  }

  findAmmo() {
    for (const st of this.inventory) {
      const def = ITEMS[st.id];
      if (def?.type === 'ammo' && def.ammoFor === this.weaponClass && st.qty > 0) return st;
    }
    return null;
  }

  consumeAmmo(n = 1) {
    if (n <= 0) return false;
    const st = this.findAmmo();
    if (!st || st.qty < n) return false;
    const idx = this.inventory.indexOf(st);
    this.removeItemAt(idx, n);
    return true;
  }

  equip(index) {
    const st = this.inventory[index];
    if (!st) return { error: 'ไม่พบไอเทม' };
    const def = ITEMS[st.id];
    if (!def || !isEquip(def)) return { error: 'ไอเทมนี้สวมใส่ไม่ได้' };
    if ((def.level ?? 1) > this.record.level) return { error: `ต้องเลเวล ${def.level}` };
    if (st.dur !== undefined && st.dur <= 0) return { error: 'อุปกรณ์พัง ต้องซ่อมก่อน' };
    const job = jobOf(this.record.job);
    if (def.type === 'weapon' && !jobCanHold(job, def.wclass)) {
      return { error: `อาชีพ ${job.nameTh} ใช้อาวุธประเภทนี้ไม่ได้` };
    }
    const slot = def.slot;
    if (this.record.equipment[slot] !== undefined) this.unequip(slot);
    if (def.twoHanded && this.record.equipment.offhand !== undefined) this.unequip('offhand');
    if (slot === 'offhand') {
      const w = this.equippedItem('weapon');
      if (w?.def.twoHanded) return { error: 'อาวุธสองมือใส่โล่ไม่ได้' };
    }
    this.record.equipment[slot] = index;
    markDirty();
    this.recompute();
    return { ok: true, slot };
  }

  unequip(slot) {
    if (this.record.equipment[slot] === undefined) return { error: 'ช่องนี้ว่างอยู่' };
    delete this.record.equipment[slot];
    markDirty();
    this.recompute();
    return { ok: true };
  }

  /** Durability: gear wears on hits taken / dealt. A steady Aurum sink. */
  wearGear(kind) {
    const slots = kind === 'attack' ? ['weapon'] : ['torso', 'head', 'legs', 'feet', 'hands', 'offhand'];
    for (const slot of slots) {
      if (Math.random() > 0.05) continue;
      const eq = this.equippedItem(slot);
      if (!eq || eq.stack.dur === undefined) continue;
      eq.stack.dur = Math.max(0, eq.stack.dur - 1);
      if (eq.stack.dur === 0) {
        this.recompute();
        this.conn?.send({ t: 'notice', kind: 'warn', text: `${ITEMS[eq.stack.id].nameTh} พังแล้ว! ไปซ่อมที่ช่างตีเหล็ก` });
      }
    }
  }

  /* ---------------- progression ---------------- */
  gainExp(exp, jobExp, zone) {
    const r = this.record;
    // Holding the fortress is worth something beyond a waived bill, and the
    // one reward that cannot distort a scarce-currency economy is the one
    // that is not currency. It is small, it is visible, and it is the reason
    // to turn up on Sunday rather than let somebody else have it.
    const guildExp = Guild.skillsOf(r).reduce((a, s) => a + (s.exp ?? 0), 0);
    if (guildExp) { exp *= 1 + guildExp / 100; jobExp *= 1 + guildExp / 100; }
    if (r.guild && Siege.waivesUpkeep(r.guild)) {
      exp *= 1 + Siege.HOLDER_EXP_BONUS;
      jobExp *= 1 + Siege.HOLDER_EXP_BONUS;
    }
    let levelled = false;
    if (r.level < MAX_BASE_LEVEL) {
      r.exp += Math.max(0, Math.floor(exp));
      while (r.level < MAX_BASE_LEVEL && r.exp >= baseExpToNext(r.level)) {
        r.exp -= baseExpToNext(r.level);
        r.level++;
        r.statPoints += 3 + Math.floor(r.level / 15);
        levelled = true;
      }
    }
    if (r.jobLevel < MAX_JOB_LEVEL) {
      r.jobExp += Math.max(0, Math.floor(jobExp));
      while (r.jobLevel < MAX_JOB_LEVEL && r.jobExp >= jobExpToNext(r.jobLevel)) {
        r.jobExp -= jobExpToNext(r.jobLevel);
        r.jobLevel++;
        r.skillPoints += 1;
        levelled = true;
      }
    }
    if (levelled) {
      this.recompute();
      this.hp = this.maxHp; this.sp = this.maxSp;
      zone?.pushEvent({ t: 'levelup', id: this.id, level: r.level, jobLevel: r.jobLevel });
    }
    markDirty();
    return levelled;
  }

  allocStat(stat) {
    const r = this.record;
    if (!['str', 'agi', 'vit', 'int', 'dex', 'luk'].includes(stat)) return { error: 'สเตตัสไม่ถูกต้อง' };
    if (r[stat] >= STAT_CAP) return { error: 'ถึงขีดสูงสุดแล้ว' };
    const cost = statCost(r[stat]);
    if (r.statPoints < cost) return { error: `ต้องใช้ ${cost} แต้ม` };
    r.statPoints -= cost;
    r[stat]++;
    markDirty();
    this.recompute();
    return { ok: true, cost };
  }

  learnSkill(skillId) {
    const r = this.record;
    const sk = SKILLS[skillId];
    if (!sk) return { error: 'ไม่พบสกิล' };
    if (!availableSkills(r.job).includes(skillId)) return { error: 'อาชีพนี้เรียนสกิลนี้ไม่ได้' };
    const cur = r.skills[skillId] ?? 0;
    if (cur >= (sk.maxLevel ?? 5)) return { error: 'สกิลเต็มระดับแล้ว' };
    if (r.skillPoints < 1) return { error: 'แต้มสกิลไม่พอ' };
    r.skillPoints--;
    r.skills[skillId] = cur + 1;
    // a freshly learned skill drops into the first free hotbar slot so it is
    // usable at once; the player can move or remove it from the skills window
    if (!cur && sk.kind !== 'passive') {
      const bar = r.hotbar ?? (r.hotbar = []);
      while (bar.length < 6) bar.push(null);
      const free = bar.indexOf(null);
      if (!bar.includes(skillId) && free >= 0) bar[free] = skillId;
    }
    markDirty();
    this.recompute();
    return { ok: true, level: cur + 1 };
  }

  /**
   * Take a path. The first choice is gated on base level 10 - every
   * character gets there - and the new job arrives with the gear it needs
   * to function, because a Marksman without a bow cannot attack at all.
   * Finishing that path's trial first pays an extra skill point.
   */
  changeJob(jobId) {
    const r = this.record;
    const cur = jobOf(r.job);
    const next = JOBS[jobId];
    if (!cur.next?.includes(jobId) || !next) return { error: 'เปลี่ยนเป็นอาชีพนี้ไม่ได้' };

    const need = cur.advance ?? { jobLevel: cur.jobLevelToAdvance ?? 10 };
    if (need.level && r.level < need.level) return { error: `ต้องถึงเลเวล ${need.level} ก่อน` };
    if (need.jobLevel && r.jobLevel < need.jobLevel) return { error: `ต้องถึง Job Level ${need.jobLevel} ก่อน` };

    const trialDone = !!(next.trial && r.quests?.[next.trial]?.done);
    r.job = jobId;
    r.jobLevel = 1;
    r.jobExp = 0;
    r.skillPoints += 2 + (trialDone ? 1 : 0);

    const given = [];
    for (const it of next.starterKit ?? []) {
      if (this.addItem(it.id, it.qty)) given.push(it);
    }
    // wear what came in the kit, so the new job works on the walk out the door
    for (const [i, st] of this.inventory.entries()) {
      if (!given.some((g) => g.id === st.id)) continue;
      const def = ITEMS[st.id];
      if (def && isEquip(def) && !Object.values(r.equipment).includes(i)) this.equip(i);
    }

    markDirty();
    this.recompute();
    this.hp = this.maxHp; this.sp = this.maxSp;
    return { ok: true, job: jobId, trialDone, kit: given };
  }

  /* ---------------- serialization ---------------- */
  selfState() {
    const r = this.record;
    return {
      id: this.id, charId: r.id, name: r.name, look: r.look, job: r.job, admin: !!this.admin,
      level: r.level, jobLevel: r.jobLevel, exp: r.exp, jobExp: r.jobExp,
      expNext: baseExpToNext(r.level), jobExpNext: jobExpToNext(r.jobLevel),
      statPoints: r.statPoints, skillPoints: r.skillPoints,
      base: { str: r.str, agi: r.agi, vit: r.vit, int: r.int, dex: r.dex, luk: r.luk },
      statCosts: Object.fromEntries(['str', 'agi', 'vit', 'int', 'dex', 'luk'].map((k) => [k, statCost(r[k])])),
      derived: this.derived, hp: this.hp, sp: this.sp, maxHp: this.maxHp, maxSp: this.maxSp,
      aurum: r.aurum, weight: this.weight(), weightCap: this.weightCap,
      map: r.map, x: this.x, y: this.y, skills: r.skills, hotbar: r.hotbar,
      equipment: r.equipment, quests: r.quests, visited: r.visited ?? [],
      statuses: this.statuses.map((s) => ({ type: s.type, key: s.key, until: s.until, icon: s.icon, beneficial: !!s.beneficial })),
      cooldowns: this.cooldowns,
      jobInfo: { id: r.job, name: JOBS[r.job]?.name, nameTh: JOBS[r.job]?.nameTh, weapons: JOBS[r.job]?.weapons, next: JOBS[r.job]?.next },
      available: availableSkills(r.job),
    };
  }

  /** Compact per-tick view for other players. */
  /**
   * What changes ten times a second.
   *
   * Everything about a character that a viewer needs *constantly* is here,
   * and everything that almost never changes is in netIdentity. Sending a
   * name, a face, a job and nine equipment slots at 10Hz to everyone in sight
   * put a hundred and fifty players in one town at four hundred kilobytes a
   * second each - four hundred megabits off the server, for data that had not
   * changed since they logged in.
   */
  netMotion() {
    return {
      id: this.id, k: 'p', x: Math.round(this.x), y: Math.round(this.y),
      d: this.dir, a: this.anim, hp: this.hp, mhp: this.maxHp,
      ast: this.animStart, as: this.animSpeed !== 1 ? +this.animSpeed.toFixed(2) : undefined,
      st: this.statuses.filter((s) => s.icon).map((s) => s.icon).join(''),
      inv: this.mods.invisible ? 1 : 0,
    };
  }

  /** What changes when you equip something, level up, or change job. */
  netIdentity() {
    return {
      n: this.name, lv: this.record.level, job: this.record.job, look: this.look,
      eq: Object.fromEntries(Object.entries(this.record.equipment)
        .map(([slot, idx]) => [slot, this.inventory[idx]?.id])
        .filter(([, id]) => id)),
      // refine level of the weapon, so everyone can see what you carry
      wr: this.equippedItem('weapon')?.stack.refine ?? 0,
      party: this.party ?? null,
    };
  }

  netState() { return { ...this.netMotion(), ...this.netIdentity() }; }

  persist() {
    const r = this.record;
    r.x = this.x; r.y = this.y; r.hp = this.hp; r.sp = this.sp;
    r.lastSeen = Date.now();
    markDirty();
  }
}

export { TILE };
