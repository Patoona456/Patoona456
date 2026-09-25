// The monster book: which monsters it lists, how many kills fill in each
// page, and what a finished page is worth.
//
// A page is finished at its `rates` threshold. Each finished page gives a
// small permanent bonus to the character that finished it, and finishing
// every monster of a region gives one more. None of it is an item, so none of
// it can be traded or inflate the market: it is earned by hunting, per
// character, and a spare character has to earn its own.
import { MONSTERS } from './monsters.js';
import { MOB_ART } from './mobart.js';
import { MAPS } from './maps.js';

/** Painted monsters only: the ones the book can draw. Lowest level first, bosses after their peers. */
export function bookEntries() {
  return Object.values(MONSTERS)
    .filter((m) => m.sprite?.kind === 'frames' && MOB_ART[m.sprite.key] && !m.summon)
    .sort((a, b) => a.level - b.level || (a.boss ? 1 : 0) - (b.boss ? 1 : 0));
}

/** Kills needed for each page: its numbers, what it drops, how often (which finishes it). */
export function bookReveal(m) {
  return m.boss ? { info: 1, drops: 1, rates: 3 } : { info: 1, drops: 10, rates: 50 };
}

/** What a finished page gives, for good. */
export function bookReward(m) {
  if (m.boss && !m.mini) return { maxHp: 60, atk: 3, matk: 3, def: 2, mdef: 2 };
  if (m.boss) return { maxHp: 40, atk: 2, matk: 2, def: 1 };
  return { maxHp: 15, atk: 1, matk: 1 };
}

/** Finishing every monster that lives in a region. (A boss's summons are not counted.) */
export const BOOK_SETS = [
  { id: 'greenmire', zone: 'greenmire', name: 'นักล่าแห่งกรีนไมร์', reward: { expPct: 3 } },
];
export function setMembers(set) {
  return [...new Set((MAPS[set.zone]?.spawns ?? []).map((s) => s.mob))].filter((id) => MONSTERS[id]);
}

export const isFinished = (id, kills) => (kills?.[id] ?? 0) >= bookReveal(MONSTERS[id]).rates;

/** Everything the book gives a character with these kills. */
export function bookBonus(kills = {}) {
  const out = { maxHp: 0, atk: 0, matk: 0, def: 0, mdef: 0, expPct: 0, pages: [], sets: [] };
  const add = (r) => { for (const [k, v] of Object.entries(r)) out[k] = (out[k] ?? 0) + v; };
  for (const m of bookEntries()) {
    if (!isFinished(m.id, kills)) continue;
    out.pages.push(m.id);
    add(bookReward(m));
  }
  for (const set of BOOK_SETS) {
    const members = setMembers(set);
    if (members.length && members.every((id) => isFinished(id, kills))) {
      out.sets.push(set.id);
      add(set.reward);
    }
  }
  return out;
}

/** The bonus in words, for the book and the notices. */
export function rewardText(r) {
  const names = { maxHp: 'HP', atk: 'ATK', matk: 'MATK', def: 'DEF', mdef: 'MDEF' };
  const bits = Object.entries(r).filter(([k, v]) => names[k] && v).map(([k, v]) => `${names[k]} +${v}`);
  if (r.expPct) bits.push(`EXP +${r.expPct}%`);
  return bits.join(' · ');
}
