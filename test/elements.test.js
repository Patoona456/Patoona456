// The eight elements.
//
// Renamed and re-tabled to match the art sheets, which means two separate
// things have to hold: the table has to be a game (a cycle nobody can opt out
// of, with no element strictly better than another), and the rename has to be
// invisible to characters saved before it happened.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ELEMENTS, ELEMENT_TABLE } from '../shared/constants.js';
import { ELEMENT_LOOK, ELEMENT_ALIASES, canonical, look } from '../shared/elements.js';
import { elementMultiplier } from '../shared/formulas.js';
import { ITEMS } from '../shared/data/items.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { SKILLS } from '../shared/data/skills.js';

/** The five that answer each other, in the order they beat each other. */
const CYCLE = ['fire', 'wind', 'earth', 'lightning', 'ice'];

test('the elements are the ones the art sheets are drawn for', () => {
  assert.deepEqual(ELEMENTS, ['neutral', 'fire', 'ice', 'lightning', 'earth', 'wind', 'holy', 'dark']);
  for (const e of ELEMENTS) {
    assert.ok(ELEMENT_LOOK[e], `${e} has no look`);
    assert.ok(ELEMENT_LOOK[e].nameTh && ELEMENT_LOOK[e].nameEn, `${e} is missing a name`);
    assert.ok(ELEMENT_TABLE[e], `${e} has no row in the combat table`);
  }
});

test('the table is complete in both directions', () => {
  for (const a of ELEMENTS) {
    for (const d of ELEMENTS) {
      const v = ELEMENT_TABLE[a][d];
      assert.equal(typeof v, 'number', `${a} vs ${d} is not a number`);
      assert.ok(v > 0 && v <= 2, `${a} vs ${d} is ${v}`);
    }
  }
});

test('the five-element cycle closes, and every link cuts both ways', () => {
  for (let i = 0; i < CYCLE.length; i++) {
    const a = CYCLE[i], b = CYCLE[(i + 1) % CYCLE.length];
    assert.ok(ELEMENT_TABLE[a][b] > 1.2, `${a} should beat ${b}`);
    assert.ok(ELEMENT_TABLE[b][a] < 0.9, `${b} should lose to ${a}`);
  }
  // Nothing in the cycle is simply better than anything else in it: every
  // one of them wins exactly one matchup inside the cycle and loses one.
  for (const a of CYCLE) {
    const wins = CYCLE.filter((b) => b !== a && ELEMENT_TABLE[a][b] > 1).length;
    const losses = CYCLE.filter((b) => b !== a && ELEMENT_TABLE[a][b] < 1 && ELEMENT_TABLE[a][a] !== ELEMENT_TABLE[a][b]).length;
    assert.equal(wins, 1, `${a} beats ${wins} of the cycle`);
    assert.ok(losses >= 1, `${a} loses to nothing`);
  }
});

test('nothing is the right tool against itself', () => {
  for (const e of ELEMENTS) {
    if (e === 'neutral') continue;
    assert.ok(ELEMENT_TABLE[e][e] <= 0.5, `${e} hits itself for ${ELEMENT_TABLE[e][e]}`);
  }
});

test('holy and dark answer each other and nothing else', () => {
  assert.ok(ELEMENT_TABLE.holy.dark >= 1.8, 'holy is not the answer to dark');
  assert.ok(ELEMENT_TABLE.dark.holy >= 1.5, 'dark cannot fight back');
  for (const e of CYCLE) {
    assert.ok(ELEMENT_TABLE.holy[e] <= 1, 'holy beats a cycle element too');
    assert.ok(ELEMENT_TABLE.dark[e] <= 1.1, 'dark beats a cycle element too');
  }
});

test('the old element names still mean what they meant', () => {
  // A character saved before the rename carries item stacks and a monster
  // carries a tag; if those quietly read as neutral, every flame sword in
  // every bank in the game loses its element and nobody reports it.
  assert.equal(canonical('ember'), 'fire');
  assert.equal(canonical('frost'), 'ice');
  assert.equal(canonical('storm'), 'lightning');
  assert.equal(canonical('radiant'), 'holy');
  assert.equal(canonical('shade'), 'dark');
  assert.equal(canonical('verdant'), 'earth');
  for (const [old, now] of Object.entries(ELEMENT_ALIASES)) {
    assert.ok(ELEMENT_LOOK[now], `${old} maps to ${now}, which does not exist`);
    assert.equal(look(old), look(now), `${old} does not look like ${now}`);
    // And the damage table has to agree, not just the colours.
    assert.equal(elementMultiplier(old, 'dark'), elementMultiplier(now, 'dark'),
      `${old} does not hit like ${now}`);
  }
  assert.equal(canonical(undefined), 'neutral');
  assert.equal(canonical('not-an-element'), 'neutral');
});

test('every element is something in the world, not just a row in a table', () => {
  const seen = {};
  const note = (el, what) => { (seen[el] ??= new Set()).add(what); };
  for (const it of Object.values(ITEMS)) if (it.element) note(canonical(it.element), 'item');
  for (const m of Object.values(MONSTERS)) note(canonical(m.element ?? 'neutral'), 'monster');
  for (const s of Object.values(SKILLS)) if (s.element) note(canonical(s.element), 'skill');

  const bare = [];
  for (const e of ELEMENTS) {
    if (e === 'neutral') continue;
    if (!seen[e]?.size) bare.push(`${e} exists nowhere in the game`);
    else if (!seen[e].has('monster')) bare.push(`${e} has no monster to use it against`);
  }
  assert.deepEqual(bare, [], bare.join('; '));
});
