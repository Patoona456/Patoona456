// What the numbers actually feel like.
//
// The data files are full of individually reasonable figures that combine
// into something nobody intended: a monster with four times the health of
// the tier below it, or one creature so efficient that the fourteen levels
// around it have no reason to fight anything else. None of that is visible
// while reading a diff - it only shows up when you work out how many seconds
// a kill takes and how many kills a level costs.
//
//   npm run balance          the whole report
//   npm run balance -- kills only the seconds-per-kill table
//   npm run balance -- zones which monsters are worth fighting where
//   npm run balance -- curve how long 1 -> cap takes
//
// The thresholds this reports against are the same ones test/balance.test.js
// fails on, so a number that looks wrong here is a number that breaks a test.
import { MONSTERS } from '../shared/data/monsters.js';
import { MAPS } from '../shared/data/maps.js';
import { ITEMS, CRAFTING_INPUTS, isEquip } from '../shared/data/items.js';
import { JOBS } from '../shared/data/jobs.js';
import { SKILLS, val, skillCost } from '../shared/data/skills.js';
import { QUESTS } from '../shared/data/quests.js';
import { baseExpToNext, deriveStats, expGapPenalty, npcSellPrice, rollDamage, statCost } from '../shared/formulas.js';
import { pathToFileURL } from 'node:url';

export const LEVEL_CAP = 70;

/** A kill should take somewhere in here. Outside it, something is wrong. */
export const KILL_SECONDS = { min: 3, max: 25 };
/** And the pace of a level should not swing wildly between bands. */
export const HOURS_TO_CAP = { min: 12, max: 45 };

/**
 * A believable character at a level: every stat point spent, and the best
 * gear the level can wear. Not an optimised build - an ordinary one.
 */
/**
 * Which jobs a character of this level could actually be.
 *
 * Novice until the job change at 10, a first-tier job until 45, a second-tier
 * one after that. Judging the game by a novice with a stick - which is what
 * this tool did until it learned about skills - understates every fight in
 * the back half of the game.
 */
export function jobsAt(level) {
  const tier = level >= 45 ? 2 : level >= 10 ? 1 : 0;
  const jobs = Object.values(JOBS).filter((j) => (j.tier ?? 0) === tier);
  return jobs.length ? jobs : [JOBS.novice];
}

// Where each archetype puts its stat points. Not optimal builds - the obvious
// ones, which is what most people play.
const STAT_PLANS = {
  vanguard: ['str', 'vit', 'str', 'agi', 'dex'],
  bulwark: ['vit', 'str', 'vit', 'agi', 'dex'],
  ravager: ['str', 'str', 'agi', 'vit', 'dex'],
  wayfarer: ['agi', 'str', 'agi', 'dex', 'luk'],
  nightblade: ['agi', 'str', 'luk', 'dex', 'agi'],
  trickster: ['agi', 'dex', 'str', 'luk', 'vit'],
  marksman: ['dex', 'agi', 'str', 'vit', 'luk'],
  sharpshooter: ['dex', 'dex', 'agi', 'str', 'luk'],
  beastcaller: ['dex', 'agi', 'vit', 'str', 'int'],
  runecaster: ['int', 'dex', 'int', 'vit', 'agi'],
  arcanist: ['int', 'int', 'dex', 'vit', 'agi'],
  stormsinger: ['int', 'dex', 'int', 'agi', 'vit'],
  warden: ['int', 'vit', 'dex', 'agi', 'str'],
  hierophant: ['int', 'int', 'vit', 'dex', 'agi'],
  oathkeeper: ['vit', 'int', 'str', 'dex', 'agi'],
  novice: ['str', 'agi', 'str', 'vit', 'dex'],
};

/** Every skill this job can use, including what it inherited. */
export function skillsOf(job) {
  const out = [];
  let j = job;
  const seen = new Set();
  while (j) {
    for (const id of j.skills ?? []) if (!seen.has(id)) { seen.add(id); out.push(id); }
    j = j.from ? JOBS[j.from] : (j.tier ? JOBS.novice : null);
    if (j === JOBS.novice && seen.has('first_aid')) break;
  }
  for (const id of JOBS.novice?.skills ?? []) if (!seen.has(id)) { seen.add(id); out.push(id); }
  return out.map((id) => SKILLS[id]).filter(Boolean);
}

/**
 * A believable character at a level: every stat point spent the way that job
 * spends them, the best gear the level can wear, and every skill point put
 * into the attacks it would actually press.
 */
export function character(level, jobId) {
  const job = JOBS[jobId] ?? jobsAt(level)[0];
  let points = 0;
  for (let l = 2; l <= level; l++) points += 3 + Math.floor(l / 10);
  const base = { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 };
  const order = STAT_PLANS[job.id] ?? STAT_PLANS.novice;
  let i = 0;
  while (points > 0) {
    const stat = order[i++ % order.length];
    const cost = statCost(base[stat]);
    if (cost > points) break;
    base[stat] += 1;
    points -= cost;
  }

  const allowed = job.weapons ? new Set(job.weapons) : null;
  const affordable = (slot) => Object.values(ITEMS)
    .filter((it) => it.slot === slot && (it.level ?? 1) <= level && it.type !== 'ammo')
    .filter((it) => slot !== 'weapon' || !allowed || allowed.has(it.wclass))
    .sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
  // Gear carries more than armour points: a rod's whole contribution is matk,
  // and most mid-tier pieces hand out stat points. Leaving both out made the
  // report read every caster as several times worse than it is.
  const gear = { atk: 0, matk: 0, def: 0, mdef: 0, hp: 0, sp: 0 };
  const addStats = (g) => {
    for (const [k, v] of Object.entries(g.stats ?? {})) gear[k] = (gear[k] ?? 0) + v;
  };
  for (const slot of ['head', 'torso', 'legs', 'feet', 'hands']) {
    const g = affordable(slot)[0];
    if (g) {
      gear.def += g.def ?? 0; gear.mdef += g.mdef ?? 0;
      gear.hp += g.hp ?? 0; gear.sp += g.sp ?? 0;
      addStats(g);
    }
  }
  const jobLevel = Math.min(50, Math.max(1, level - 5));
  const stats = { ...base, level, jobLevel };

  // Skill points: one per job level, plus what the job change hands over.
  // Spread over the attacks this job would press, best-first.
  const attacks = skillsOf(job).filter((sk) => sk.kind === 'damage' || sk.kind === 'aoe');
  const learned = new Map();
  let sp = jobLevel + 2;
  for (const sk of attacks) {
    const take = Math.min(sk.maxLevel ?? 5, Math.max(0, sp));
    if (take > 0) { learned.set(sk.id, take); sp -= take; }
  }

  const byElement = new Map();
  for (const w of affordable('weapon')) {
    const el = w.element ?? 'neutral';
    if (!byElement.has(el)) byElement.set(el, w);
  }
  const weapons = [...byElement.values()].map((w) => {
    const g = { ...gear, atk: gear.atk + (w.atk ?? 0), matk: gear.matk + (w.matk ?? 0) };
    for (const [k, v] of Object.entries(w.stats ?? {})) g[k] = (g[k] ?? 0) + v;
    return {
      item: w,
      delay: w.delay ?? 1,
      derived: { ...deriveStats(stats, job, g), element: 'neutral', weaponElement: w.element ?? 'neutral' },
    };
  });
  if (!weapons.length) {
    weapons.push({ item: null, delay: 1, derived: { ...deriveStats(stats, job, gear), element: 'neutral', weaponElement: 'neutral' } });
  }
  const power = (x) => Math.max(x.derived.atk ?? 0, x.derived.matk ?? 0);
  const main = weapons.reduce((a, b) => (power(b) > power(a) ? b : a));
  return {
    level, job, weapons, learned, attacks,
    atk: main.derived.atk,
    weapon: main.item?.nameTh ?? '(มือเปล่า)',
    delay: main.delay,
    derived: main.derived,
  };
}

/**
 * Damage rolls are random, so two runs of the same report disagreed about
 * which monster was best wherever two were close - and the test built on this
 * would have failed perhaps one run in ten, for no reason anybody could act
 * on. Every sampled figure is therefore drawn from a fixed stream: the report
 * is an average, and an average does not need to be a different average each
 * time you ask.
 */
function sampled(fn) {
  const real = Math.random;
  let seed = 0x2f6e2b1;
  Math.random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  try { return fn(); } finally { Math.random = real; }
}

/** The defender record a monster presents to rollDamage. */
export function defenderOf(mob) {
  return {
    def: mob.def ?? 0, mdef: mob.mdef ?? 0,
    softDef: Math.floor((mob.def ?? 0) / 3), softMdef: Math.floor((mob.mdef ?? 0) / 3),
    flee: mob.flee ?? 50, level: mob.level, element: mob.element ?? 'neutral', critRes: 0,
  };
}

/**
 * Damage per second for one weapon against one monster, playing the way a
 * person plays: press whatever attack is off cooldown and affordable, swing
 * the weapon in the gaps, and run dry on SP if the rotation is too greedy.
 *
 * Auto-attacks alone are not what the game looks like after level ten, and a
 * tool that measured only auto-attacks was quietly tuning the whole bestiary
 * against a novice with a stick.
 */
function rotationDps(c, w, d, seconds = 90) {
  const a = w.derived;
  const swing = Math.max(0.2, w.delay * (a.aspdFactor ?? 1));
  const usable = (c.attacks ?? [])
    .filter((sk) => c.learned?.has(sk.id))
    .filter((sk) => !sk.weapon || !w.item || sk.weapon.includes(w.item.wclass))
    .map((sk) => {
      const lvl = c.learned.get(sk.id);
      return {
        sk, lvl,
        sp: skillCost(sk, lvl),
        cd: Math.max(0.5, val(sk.cooldown, lvl)),
        cast: (sk.castTime ?? 0) * (a.castFactor ?? 1),
        ratio: val(sk.ratio, lvl),
        hits: Math.max(1, Math.round(val(sk.hits, lvl) || 1)),
        magic: !!sk.magic,
        element: sk.element ?? (sk.magic ? 'neutral' : (a.weaponElement ?? 'neutral')),
        pierce: sk.pierce ?? 0,
        ignoreDef: !!sk.ignoreDef,
        ready: 0,
      };
    })
    .sort((x, y) => (y.ratio * y.hits) - (x.ratio * x.hits));

  const strike = (o) => {
    const r = rollDamage(a, d, o);
    return r.damage * (1 + (o.pierce ?? 0));
  };

  let t = 0, nextSwing = 0, damage = 0;
  let sp = a.maxSp ?? 0;
  const regenEvery = 4, regenPer = (a.spRegen ?? 1);      // in combat, not doubled
  let nextRegen = regenEvery;

  while (t < seconds) {
    const pick = usable.find((u) => u.ready <= t && u.sp <= sp);
    const tNext = Math.min(
      pick ? t : Infinity,
      nextSwing,
      nextRegen,
      ...usable.filter((u) => u.ready > t && u.sp <= sp).map((u) => u.ready),
    );
    if (pick) {
      sp -= pick.sp;
      t += pick.cast;
      damage += strike({
        ratio: pick.ratio, magic: pick.magic, element: pick.element,
        hits: pick.hits, ignoreDef: pick.ignoreDef, pierce: pick.pierce,
        alwaysHit: pick.magic,
      });
      pick.ready = t + pick.cd;
      nextSwing = Math.max(nextSwing, t + swing * 0.5);   // a cast delays the swing
      continue;
    }
    if (nextSwing <= tNext) {
      t = Math.max(t, nextSwing);
      damage += strike({});
      nextSwing = t + swing;
      continue;
    }
    t = Math.max(t + 0.05, Math.min(tNext, t + 2));
    while (nextRegen <= t) { sp = Math.min(a.maxSp ?? 0, sp + regenPer); nextRegen += regenEvery; }
  }
  return damage / seconds;
}

/**
 * Average seconds to kill one of these, with the best weapon on the belt and
 * the skills this character has learned.
 */
export function killSeconds(c, mob, samples = 800) {
  const d = defenderOf(mob);
  return sampled(() => {
    let best = Infinity;
    for (const w of c.weapons) {
      let total = 0;
      for (let i = 0; i < samples; i++) total += rollDamage(w.derived, d).damage;
      const perSwing = total / samples;
      const swing = Math.max(0.2, w.delay * (w.derived.aspdFactor ?? 1));
      let dps = perSwing / swing;
      if (c.learned?.size) dps = Math.max(dps, rotationDps(c, w, d));
      if (dps <= 0.2) continue;
      const secs = mob.hp / dps;
      if (secs < best) best = secs;
    }
    return best;
  });
}

/**
 * Seconds of not-fighting per kill: finding the next one, walking to it,
 * waiting out a respawn. Without this the report rates a monster that dies in
 * one swing as infinitely efficient, and recommends farming trash forever.
 */
export const TRAVEL_SECONDS = 4;

/** Roughly how fast a monster takes the character's health bar down. */
export function monsterDps(mob, c) {
  const a = {
    atk: mob.atk ?? 0, matk: mob.matk ?? 0, hit: mob.hit ?? 80, crit: 0,
    element: mob.element ?? 'neutral', weaponElement: mob.element ?? 'neutral',
  };
  const magic = (mob.matk ?? 0) > (mob.atk ?? 0);
  return sampled(() => {
    let total = 0;
    for (let i = 0; i < 2000; i++) total += rollDamage(a, c.derived, { magic }).damage;
    return (total / 2000) / (mob.attackDelay ?? 1.6);
  });
}

/**
 * Can the character take this fight at all? Winning with less than a third of
 * the health bar to spare is not a hunting ground, it is a coin flip, and no
 * report should recommend it as the best experience per second.
 */
export function survivable(c, mob, secs) {
  const dps = monsterDps(mob, c);
  if (dps <= 0) return true;
  const sustain = (c.derived.maxHp ?? 1) + (c.derived.hpRegen ?? 0) * (secs / 6);
  return dps * secs * 3 <= sustain;
}

/** One built character per job available at this level. Cached: building a
 *  character walks the whole item table, and the reports ask constantly. */
const charCache = new Map();
export function charsAt(level) {
  if (!charCache.has(level)) charCache.set(level, jobsAt(level).map((j) => character(level, j.id)));
  return charCache.get(level);
}

/**
 * The ordinary experience of fighting this monster at this level.
 *
 * Ten second-tier jobs kill the same monster at wildly different speeds, and
 * balancing against any one of them balances against nobody. The median job
 * is the one the content has to work for; the spread is what tells you a job
 * is broken, and `npm run balance -- jobs` prints it.
 */
export function typical(level, mob) {
  const rated = charsAt(level)
    .map((c) => ({ c, secs: killSeconds(c, mob) }))
    .filter((r) => isFinite(r.secs))
    .sort((a, b) => a.secs - b.secs);
  if (!rated.length) return null;
  return rated[Math.floor(rated.length / 2)];
}

/** Monsters a player can reach without a party. */
export function soloMonsters() {
  const ids = new Set();
  for (const m of Object.values(MAPS)) {
    if (m.party) continue;
    for (const sp of m.spawns ?? []) ids.add(sp.mob);
  }
  return Object.values(MONSTERS).filter((m) => !m.boss && !m.summon && ids.has(m.id));
}

/** The fastest experience a solo player can earn at this level, and on what. */
export function bestAt(level, pool = soloMonsters()) {
  let best = null;
  for (const mob of pool) {
    if (mob.level - level > 14) continue;             // out of reach solo
    const t = typical(level, mob);
    if (!t) continue;
    if (!survivable(t.c, mob, t.secs)) continue;
    const penalty = expGapPenalty(level, mob.level);  // the level-gap EXP cut
    const rate = (mob.exp * penalty) / (t.secs + TRAVEL_SECONDS);
    if (!best || rate > best.rate) best = { mob, secs: t.secs, rate, penalty, c: t.c };
  }
  return best;
}

/** Hours from 1 to the cap, hunting the best thing available at each level. */
export function hoursToCap(overhead = 1.1) {
  const pool = soloMonsters();
  let seconds = 0;
  const bands = [];
  for (let lv = 1; lv < LEVEL_CAP; lv++) {
    const best = bestAt(lv, pool);
    if (!best) { bands.push({ lv, gap: true }); continue; }
    const kills = baseExpToNext(lv) / (best.mob.exp * best.penalty);
    seconds += kills * (best.secs + TRAVEL_SECONDS) * overhead;
    bands.push({ lv, kills, secs: best.secs, mob: best.mob, hours: seconds / 3600 });
  }
  return { hours: seconds / 3600, bands };
}

/** The best healing item a character of this level can actually use. */
export function bestHeal(level) {
  return Object.values(ITEMS)
    .filter((it) => it.heal && (it.level ?? 1) <= level)
    .sort((a, b) => b.heal - a.heal)[0] ?? null;
}

/**
 * What an hour of hunting is worth, after the potions it takes to survive it.
 *
 * docs/ECONOMY.md promises a level 10-20 player a net income in the hundreds
 * of Aurum per hour, and that a salve costs what ten to twenty kills pay. Kill
 * times move every time the bestiary is touched, so those promises are only
 * true until someone edits a health value.
 */
export function incomePerHour(level) {
  const best = bestAt(level);
  if (!best) return null;
  const { mob, secs, c } = best;
  const perKill = (mob.aurum ? mob.aurum.chance * ((mob.aurum.min + mob.aurum.max) / 2) : 0)
    + (mob.drops ?? []).reduce((n, d) => {
      const it = ITEMS[d.id];
      if (!it) return n;
      const qty = Array.isArray(d.qty) ? (d.qty[0] + d.qty[1]) / 2 : (d.qty ?? 1);
      return n + d.chance * qty * npcSellPrice(it.value ?? 0, 0, it.rarity, isEquip(it) ? 'equip' : CRAFTING_INPUTS.has(it.id));
    }, 0);

  // Two honest extremes, because real play sits between them: rest off every
  // wound and pay nothing but time, or drink through it and pay in Aurum.
  const potion = bestHeal(level);
  const taken = monsterDps(mob, c) * secs;
  const regenPerSecond = (c.derived.hpRegen ?? 1) * 2 / 5;     // doubled out of combat
  const restSeconds = taken / Math.max(0.1, regenPerSecond);

  const restingKills = 3600 / (secs + TRAVEL_SECONDS + restSeconds);
  const drinkingKills = 3600 / (secs + TRAVEL_SECONDS);
  const potionCost = potion ? (taken / potion.heal) * (potion.value ?? 0) : 0;

  return {
    mob, secs, potion, restSeconds,
    resting: { kills: restingKills, net: perKill * restingKills },
    drinking: { kills: drinkingKills, net: (perKill - potionCost) * drinkingKills },
    killsPerPotion: potion ? (potion.value ?? 0) / Math.max(0.01, perKill) : Infinity,
  };
}

/* ------------------------------------------------------------- reporting */

const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);

function kills() {
  console.log('\n=== เวลาตีมอนที่เลเวลใกล้เคียงกัน ===');
  console.log('เป้า: ' + KILL_SECONDS.min + '-' + KILL_SECONDS.max + ' วินาทีต่อตัว ตลอดทั้งเกม\n');
  console.log('เลเวล   ATK  อาชีพ(ค่ากลาง)  มอน                       HP   วิ/ตัว  EXP/วิ');
  const pool = soloMonsters();
  for (let lv = 5; lv <= LEVEL_CAP; lv += 5) {
    const near = pool.filter((m) => Math.abs(m.level - lv) <= 4);
    if (!near.length) {
      console.log(`${num(lv, 5)} — ไม่มีมอนเลเวลนี้ในโซนเดี่ยว —`);
      continue;
    }
    const best = near.map((m) => ({ m, t: typical(lv, m) })).filter((x) => x.t)
      .sort((a, b) => (b.m.exp / b.t.secs) - (a.m.exp / a.t.secs))[0];
    if (!best) continue;
    const { secs } = best.t, c = best.t.c;
    const flag = secs > KILL_SECONDS.max ? '  << ช้าเกิน' : secs < KILL_SECONDS.min ? '  << เร็วเกิน' : '';
    console.log(`${num(lv, 5)} ${num(c.atk, 5)}  ${pad(c.job.nameTh, 14)} ${pad(best.m.nameTh, 22)} ${num(best.m.hp, 6)} ${num(secs.toFixed(1), 7)} ${num((best.m.exp / secs).toFixed(0), 7)}${flag}`);
  }
}

function zones() {
  console.log('\n=== มอนในโซนเดียวกันคุ้มพอๆ กันไหม ===');
  console.log('ถ้าตัวหนึ่งคุ้มกว่าตัวอื่นมาก ตัวที่เหลือก็เป็นแค่ฉากหลัง');
  console.log('(† = มอนประกอบฉาก ห่างจากเลเวลโซนเกิน 6 — ไม่นับเข้าการเทียบ)\n');
  for (const [id, map] of Object.entries(MAPS)) {
    const spawns = [...new Set((map.spawns ?? []).map((s) => s.mob))]
      .map((x) => MONSTERS[x]).filter((m) => m && !m.boss);
    if (spawns.length < 2) continue;
    const mid = Math.round(spawns.reduce((n, m) => n + m.level, 0) / spawns.length);
    // A party map is fought by a party. Judging its monsters by one player's
    // damage made the dungeon's designed damage sponges look like mistakes.
    const hands = map.party ? 4 : 1;
    const rated = spawns.map((m) => ({
      m, rate: m.exp / ((typical(Math.min(LEVEL_CAP, mid), m)?.secs ?? Infinity) / hands),
      // Ambient low-level spawns are scenery on purpose: a level-4 bat in a
      // level-12 swamp is not a monster anyone was meant to farm at 12, and
      // neither is the tutorial slime once you have left the first field.
      ambient: Math.abs(m.level - mid) > 6 || m.level < mid * 0.55,
    })).sort((a, b) => b.rate - a.rate);
    const top = rated[0].rate;
    console.log(`${map.nameTh ?? id}  (ตัวละครเลเวล ${mid}${hands > 1 ? ' ×' + hands : ''})`);
    for (const r of rated) {
      const pctOfBest = 100 * r.rate / top;
      const bar = '#'.repeat(Math.max(1, Math.round(pctOfBest / 6)));
      console.log(`   ${pad(r.m.nameTh, 22)} Lv${num(r.m.level, 3)}  ${num(pctOfBest.toFixed(0) + '%', 5)} ${r.ambient ? '†' : ' '}${bar}`);
    }
    const core = rated.filter((r) => !r.ambient);
    const worst = core.length > 1 ? core[core.length - 1].rate / core[0].rate : 1;
    if (worst < 0.35) console.log(`   << ตัวท้ายคุ้มแค่ ${(worst * 100).toFixed(0)}% ของตัวแรก แทบไม่มีเหตุผลจะตี`);
    console.log('');
  }
}

function curve() {
  console.log('\n=== เวลาจากเลเวล 1 ถึงแคป ===\n');
  const { hours, bands } = hoursToCap();
  console.log('ถึงเลเวล   ชม.สะสม   ล่าอะไร                 วิ/ตัว   ตัว/เลเวล');
  let owner = null, ownerFrom = 1;
  const reigns = [];
  for (const b of bands) {
    if (b.gap) { console.log(`${num(b.lv + 1, 8)}   — ไม่มีมอนให้ตี —`); continue; }
    if (owner && b.mob.id !== owner) { reigns.push([owner, ownerFrom, b.lv - 1]); ownerFrom = b.lv; }
    if (b.mob.id !== owner) owner = b.mob.id;
    if ((b.lv + 1) % 10 === 0 || b.lv === LEVEL_CAP - 1) {
      console.log(`${num(b.lv + 1, 8)}  ${num(b.hours.toFixed(1), 8)}   ${pad(b.mob.nameTh, 22)} ${num(b.secs.toFixed(1), 6)} ${num(Math.round(b.kills), 10)}`);
    }
  }
  if (owner) reigns.push([owner, ownerFrom, LEVEL_CAP - 1]);

  const half = bands.find((b) => b.hours >= hours / 2);
  console.log(`\nรวม 1 -> ${LEVEL_CAP}: ${hours.toFixed(1)} ชั่วโมง (เป้า ${HOURS_TO_CAP.min}-${HOURS_TO_CAP.max})`);
  console.log(`ครึ่งเวลาแรกหมดไปตอนเลเวล ${half ? half.lv : '?'} — ถ้าต่ำกว่า ${Math.round(LEVEL_CAP / 2)} มากแปลว่าปลายเกมหนักเกินไป`);

  let totalNeed = 0;
  for (let lv = 1; lv < LEVEL_CAP; lv++) totalNeed += baseExpToNext(lv);
  const questExp = Object.values(QUESTS).filter((q) => !q.repeatable)
    .reduce((n, q) => n + (q.rewards.exp ?? 0), 0);
  console.log(`เควสต์ช่วยได้ ${(100 * questExp / totalNeed).toFixed(0)}% ของ EXP ทั้งหมด`);

  const long = reigns.filter(([, a, b]) => b - a >= 8);
  if (long.length) {
    console.log('\nมอนที่ครองยาวเกิน 8 เลเวล (ควรมีตัวอื่นมาแข่ง):');
    for (const [id, a, b] of long) console.log(`   ${pad(MONSTERS[id]?.nameTh ?? id, 22)} เลเวล ${a}-${b}  (${b - a + 1} เลเวล)`);
  }
}

// Only print when run directly: the test suite and the tuning scripts import
// the helpers above and must not get a report dumped into their output.
function jobs() {
  console.log('\n=== แต่ละอาชีพฆ่าของในเลเวลตัวเองได้เร็วแค่ไหน ===');
  console.log('ตัวเลขคือวินาทีต่อมอน เทียบกันในเลเวลเดียวกัน');
  console.log('ถ้าช่องว่างระหว่างเร็วสุดกับช้าสุดเกิน 3 เท่า แปลว่ามีอาชีพที่เล่นไม่ได้จริง\n');
  const pool = soloMonsters();
  for (const lv of [10, 20, 30, 40, 50, 60, 70]) {
    const near = pool.filter((m) => Math.abs(m.level - lv) <= 4);
    if (!near.length) continue;
    const rows = charsAt(lv).map((c) => {
      const times = near.map((m) => killSeconds(c, m)).filter(isFinite).sort((a, b) => a - b);
      return { c, secs: times.length ? times[0] : Infinity };
    }).sort((a, b) => a.secs - b.secs);
    const fastest = rows[0].secs;
    const slowest = rows[rows.length - 1].secs;
    console.log(`เลเวล ${lv}  (ช่องว่าง ${(slowest / fastest).toFixed(1)} เท่า)${slowest / fastest > 3 ? '  << กว้างเกินไป' : ''}`);
    for (const r of rows) {
      const bar = '#'.repeat(Math.max(1, Math.round(18 * fastest / r.secs)));
      console.log(`   ${pad(r.c.job.nameTh, 16)} ${num(r.secs.toFixed(1) + 's', 8)}  ${bar}`);
    }
    console.log('');
  }
}

function money() {
  console.log('\n=== เงินต่อชั่วโมง ===');
  console.log('docs/ECONOMY.md สัญญาว่าเลเวล 10-20 ได้สุทธิหลักร้อย AU/ชม.');
  console.log('"พัก" = นั่งฟื้นเอง ฟรีแต่กินเวลา  ยาคือเงินที่จ่ายเพื่อไม่ต้องนั่งรอ');
  console.log('ยาตั้งใจให้ขาดทุน (หลบเก่งย่อมคุ้มกว่าอัดยา) เป้าคือ 6-30 ตัวต่อขวด\n');
  console.log('เลเวล  พัก:ตัว/ชม  พัก:AU/ชม  ตัว/ขวดยา  พักต่อตัว  ยาที่ใช้');
  for (let lv = 5; lv <= LEVEL_CAP; lv += 5) {
    const m = incomePerHour(lv);
    if (!m) { console.log(`${num(lv, 5)}   — ไม่มีที่ล่า —`); continue; }
    const heal = m.potion ? `${m.potion.nameTh} (${m.potion.heal})` : '(ไม่มียา)';
    const flags = [];
    // The job with the smallest bar is the one a potion has to be worth
    // something to; a tank's bar is large on purpose and would hide the gap.
    const bar = Math.min(...charsAt(lv).map((c) => c.derived.maxHp)) || 1;
    if (!m.potion) flags.push('ไม่มียาที่ใช้ได้');
    else if (m.potion.heal < 0.25 * bar) flags.push(`ยาฟื้นแค่ ${Math.round(100 * m.potion.heal / bar)}% ของบาร์`);
    // Drinking is *meant* to lose money - ECONOMY.md wants dodging to beat
    // chugging. What matters is the ratio the doc actually promises.
    if (m.killsPerPotion < 6) flags.push(`ยาถูกไป (${Math.round(m.killsPerPotion)} ตัว/ขวด)`);
    if (m.killsPerPotion > 30) flags.push(`ยาแพงไป (${Math.round(m.killsPerPotion)} ตัว/ขวด)`);
    if (m.restSeconds > 6 * m.secs) flags.push('พักนานกว่าสู้ 6 เท่า');
    console.log(`${num(lv, 5)} ${num(Math.round(m.resting.kills), 10)} ${num(Math.round(m.resting.net), 11)} ${num(Math.round(m.killsPerPotion), 9)} ${num(m.restSeconds.toFixed(0) + 's', 9)}  ${pad(heal, 24)}${flags.length ? '  << ' + flags.join(', ') : ''}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const what = process.argv[2];
  if (!what || what === 'kills') kills();
  if (!what || what === 'zones') zones();
  if (!what || what === 'curve') curve();
  if (!what || what === 'money') money();
  if (!what || what === 'jobs') jobs();
}
