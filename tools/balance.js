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
import { ITEMS } from '../shared/data/items.js';
import { JOBS } from '../shared/data/jobs.js';
import { QUESTS } from '../shared/data/quests.js';
import { baseExpToNext, deriveStats, expGapPenalty, rollDamage, statCost } from '../shared/formulas.js';
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
export function character(level) {
  let points = 0;
  for (let l = 2; l <= level; l++) points += 3 + Math.floor(l / 10);
  const base = { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 };
  const order = ['str', 'agi', 'str', 'vit', 'dex'];
  let i = 0;
  while (points > 0) {
    const stat = order[i++ % order.length];
    const cost = statCost(base[stat]);
    if (cost > points) break;
    base[stat] += 1;
    points -= cost;
  }
  const affordable = (slot) => Object.values(ITEMS)
    .filter((it) => it.slot === slot && (it.level ?? 1) <= level && it.type !== 'ammo')
    .sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
  const gear = { atk: 0, def: 0, hp: 0 };
  for (const slot of ['head', 'torso', 'legs', 'feet', 'hands']) {
    const g = affordable(slot)[0];
    if (g) { gear.def += g.def ?? 0; gear.hp += g.hp ?? 0; }
  }
  const stats = { ...base, level, jobLevel: Math.min(50, level) };
  const job = JOBS.novice ?? { hpMod: 1, spMod: 1 };

  // A player at this level owns more than one weapon. Keeping the best of each
  // element is what anyone actually does - the element table swings damage by
  // up to 7x, so judging a monster against a single weapon says nothing about
  // whether that monster is worth fighting.
  const byElement = new Map();
  for (const w of affordable('weapon')) {
    const el = w.element ?? 'neutral';
    if (!byElement.has(el)) byElement.set(el, w);
  }
  const weapons = [...byElement.values()].map((w) => ({
    item: w,
    delay: w.delay ?? 1,
    derived: { ...deriveStats(stats, job, { ...gear, atk: w.atk ?? 0 }), element: 'neutral', weaponElement: w.element ?? 'neutral' },
  }));
  if (!weapons.length) {
    weapons.push({ item: null, delay: 1, derived: { ...deriveStats(stats, job, gear), element: 'neutral', weaponElement: 'neutral' } });
  }
  const main = weapons.reduce((a, b) => ((b.derived.atk ?? 0) > (a.derived.atk ?? 0) ? b : a));
  return {
    level,
    weapons,
    atk: main.derived.atk,
    weapon: main.item?.nameTh ?? '(มือเปล่า)',
    delay: main.delay,
    derived: main.derived,
  };
}

/** The defender record a monster presents to rollDamage. */
export function defenderOf(mob) {
  return {
    def: mob.def ?? 0, mdef: mob.mdef ?? 0,
    softDef: Math.floor((mob.def ?? 0) / 3), softMdef: Math.floor((mob.mdef ?? 0) / 3),
    flee: mob.flee ?? 50, level: mob.level, element: mob.element ?? 'neutral', critRes: 0,
  };
}

/** Average seconds to kill one of these, with the best weapon on the belt. */
export function killSeconds(c, mob, samples = 600) {
  const d = defenderOf(mob);
  let best = Infinity;
  for (const w of c.weapons) {
    let total = 0;
    for (let i = 0; i < samples; i++) total += rollDamage(w.derived, d).damage;
    const perSwing = total / samples;
    if (perSwing <= 1) continue;
    const secs = (mob.hp / perSwing) * w.delay * (w.derived.aspdFactor ?? 1);
    if (secs < best) best = secs;
  }
  return best;
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
  let total = 0;
  for (let i = 0; i < 300; i++) total += rollDamage(a, c.derived, { magic }).damage;
  return (total / 300) / (mob.attackDelay ?? 1.6);
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
  const c = character(level);
  let best = null;
  for (const mob of pool) {
    if (mob.level - level > 14) continue;             // out of reach solo
    const secs = killSeconds(c, mob);
    if (!isFinite(secs)) continue;
    if (!survivable(c, mob, secs)) continue;
    const penalty = expGapPenalty(level, mob.level);  // the level-gap EXP cut
    const rate = (mob.exp * penalty) / (secs + TRAVEL_SECONDS);
    if (!best || rate > best.rate) best = { mob, secs, rate, penalty, c };
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

/* ------------------------------------------------------------- reporting */

const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);

function kills() {
  console.log('\n=== เวลาตีมอนที่เลเวลใกล้เคียงกัน ===');
  console.log('เป้า: ' + KILL_SECONDS.min + '-' + KILL_SECONDS.max + ' วินาทีต่อตัว ตลอดทั้งเกม\n');
  console.log('เลเวล   ATK  อาวุธ                  มอน                       HP   วิ/ตัว  EXP/วิ');
  const pool = soloMonsters();
  for (let lv = 5; lv <= LEVEL_CAP; lv += 5) {
    const c = character(lv);
    const near = pool.filter((m) => Math.abs(m.level - lv) <= 4);
    if (!near.length) {
      console.log(`${num(lv, 5)} ${num(c.atk, 5)}  ${pad(c.weapon, 20)} — ไม่มีมอนเลเวลนี้ในโซนเดี่ยว —`);
      continue;
    }
    const best = near.map((m) => ({ m, s: killSeconds(c, m) }))
      .sort((a, b) => (b.m.exp / b.s) - (a.m.exp / a.s))[0];
    const flag = best.s > KILL_SECONDS.max ? '  << ช้าเกิน' : best.s < KILL_SECONDS.min ? '  << เร็วเกิน' : '';
    console.log(`${num(lv, 5)} ${num(c.atk, 5)}  ${pad(c.weapon, 20)} ${pad(best.m.nameTh, 22)} ${num(best.m.hp, 6)} ${num(best.s.toFixed(1), 7)} ${num((best.m.exp / best.s).toFixed(0), 7)}${flag}`);
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
    const c = character(mid);
    // A party map is fought by a party. Judging its monsters by one player's
    // damage made the dungeon's designed damage sponges look like mistakes.
    const hands = map.party ? 4 : 1;
    const rated = spawns.map((m) => ({
      m, rate: m.exp / (killSeconds(c, m) / hands),
      // Ambient low-level spawns are scenery on purpose: a level-4 bat in a
      // level-12 swamp is not a monster anyone was meant to farm at 12.
      ambient: Math.abs(m.level - mid) > 6,
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
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const what = process.argv[2];
  if (!what || what === 'kills') kills();
  if (!what || what === 'zones') zones();
  if (!what || what === 'curve') curve();
}
