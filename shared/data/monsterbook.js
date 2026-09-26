// The monster book: which monsters it lists, how each page fills in, and
// what a finished page is worth.
//
// Every page is a picture of its monster cut into a 3x3 jigsaw. Each kill
// may drop a piece - always one this character is still missing - straight
// into the book. The first kill opens the page; three pieces show what it
// drops, six how often, and all nine finish the picture, which gives a small
// permanent bonus. Finishing every monster of a region gives one more.
// Pieces are not items: they cannot be traded, so a spare character's pieces
// stay its own and nothing reaches the market.
import { MONSTERS } from './monsters.js';
import { MOB_ART } from './mobart.js';
import { MAPS } from './maps.js';

/** Painted monsters only: the ones the book can draw. Lowest level first, bosses after their peers. */
export function bookEntries() {
  return Object.values(MONSTERS)
    .filter((m) => m.sprite?.kind === 'frames' && MOB_ART[m.sprite.key] && !m.summon)
    .sort((a, b) => a.level - b.level || (a.boss ? 1 : 0) - (b.boss ? 1 : 0));
}

export const PIECES = 9;
const FULL = (1 << PIECES) - 1;

/** What opens each part of a page: kills for its numbers, pieces for the rest. */
export function bookReveal() {
  return { info: 1, drops: 3, rates: 6, done: PIECES };
}

/**
 * The chance a kill drops a piece. A field monster's picture takes about a
 * hundred and fifty kills; the mini boss's about twenty-five; the boss's
 * about eighteen - each of those a real fight.
 */
export function pieceChance(m) {
  if (m.boss && !m.mini) return 0.5;
  if (m.boss) return 0.35;
  if (m.mend) return 0.2;                    // a boss's saplings: only met in its fight
  return 0.06;
}

/** How many pieces a mask holds, and which ones are still missing. */
export const pieceCount = (mask = 0) => { let n = 0; for (let i = 0; i < PIECES; i++) if (mask & (1 << i)) n++; return n; };
export const missingPieces = (mask = 0) => [...Array(PIECES).keys()].filter((i) => !(mask & (1 << i)));

/** What a finished page gives, for good. */
export function bookReward(m) {
  if (m.boss && !m.mini) return { maxHp: 60, atk: 3, matk: 3, def: 2, mdef: 2 };
  if (m.boss) return { maxHp: 40, atk: 2, matk: 2, def: 1 };
  return { maxHp: 15, atk: 1, matk: 1 };
}

/** Finishing every monster that lives in a region. (A boss's summons are not counted.) */
export const BOOK_SETS = [
  { id: 'greenmire', zone: 'greenmire', name: 'นักล่าแห่งกรีนไมร์', reward: { expPct: 3 } },
  { id: 'amberwood', zone: 'amberwood', name: 'นักล่าแห่งป่าอำพัน', reward: { expPct: 3 } },
];
export function setMembers(set) {
  return [...new Set((MAPS[set.zone]?.spawns ?? []).map((s) => s.mob))].filter((id) => MONSTERS[id]);
}

export const isFinished = (id, jigsaw) => ((jigsaw?.[id] ?? 0) & FULL) === FULL;

/** Everything the book gives a character with these pictures. */
export function bookBonus(jigsaw = {}) {
  const out = { maxHp: 0, atk: 0, matk: 0, def: 0, mdef: 0, expPct: 0, pages: [], sets: [] };
  const add = (r) => { for (const [k, v] of Object.entries(r)) out[k] = (out[k] ?? 0) + v; };
  for (const m of bookEntries()) {
    if (!isFinished(m.id, jigsaw)) continue;
    out.pages.push(m.id);
    add(bookReward(m));
  }
  for (const set of BOOK_SETS) {
    const members = setMembers(set);
    if (members.length && members.every((id) => isFinished(id, jigsaw))) {
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
