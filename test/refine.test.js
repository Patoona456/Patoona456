// How a weapon says what it is.
//
// The art boards split a weapon's appearance into four independent things -
// how refined it is, what element it carries, what it does to people, and
// the one signature a legendary wears. They are four lists rather than one
// enum of every combination, and these tests are what stops them collapsing
// back into each other: a rung with no look, a mark no item ever earns, a
// signature that only exists in a table.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_REFINE, GLOW_TIERS, OVERLAYS, SPECIAL_MARKS, SIGNATURES,
  glowTier, glowCss, hasOverlay, specialMarks, signatureOf,
} from '../shared/refineglow.js';
import { REFINE_ODDS, refineChance } from '../shared/formulas.js';
import { ITEMS } from '../shared/data/items.js';
import { ELEMENTS } from '../shared/constants.js';

test('every level a player can actually reach has a look of its own', () => {
  // The visible tiers used to stop at seven while the cap was fifteen, so
  // eight of the levels people pay for looked exactly like the one below.
  assert.equal(GLOW_TIERS.length, MAX_REFINE);
  for (let r = 1; r <= MAX_REFINE; r++) {
    const t = glowTier(r);
    assert.ok(t, `+${r} has no tier`);
    assert.equal(t.at, r, `+${r} borrows the look of +${t.at}`);
  }
  assert.equal(glowTier(0), null, 'an unrefined weapon glows');
  assert.equal(glowCss(0), null);
  assert.ok(glowCss(1).startsWith('rgba('));
});

test('refining cannot go past the level the art stops at', () => {
  // The cap lives in one place now. When it moves, the table has to move
  // with it, or somebody reaches a level with no look at all.
  assert.ok(REFINE_ODDS.length > MAX_REFINE - 1, 'the odds run out before the cap');
  assert.ok(refineChance(MAX_REFINE - 1) > 0, 'the last rung is unreachable');
  assert.ok(refineChance(0) === 1, 'the first rung is not free');
  for (let i = 1; i < REFINE_ODDS.length; i++) {
    assert.ok(REFINE_ODDS[i] <= REFINE_ODDS[i - 1], `refining to +${i + 1} is easier than to +${i}`);
  }
});

test('a higher refine never looks like less', () => {
  let last = null;
  for (const t of GLOW_TIERS) {
    if (last) {
      assert.ok(t.aura > last.aura, `+${t.at} is dimmer than +${last.at}`);
      assert.ok(t.sparks >= last.sparks, `+${t.at} throws fewer sparks than +${last.at}`);
      assert.ok(t.light >= last.light, `+${t.at} casts less light than +${last.at}`);
      assert.ok(t.layers.length >= last.layers.length, `+${t.at} draws fewer layers than +${last.at}`);
    }
    last = t;
  }
});

test('the three bands run in order and nobody is left out', () => {
  const bands = [...new Set(GLOW_TIERS.map((t) => t.band))];
  assert.deepEqual(bands, ['ember', 'duskbound', 'everember']);
  // a band is a contiguous run, not a label sprinkled around
  for (const band of bands) {
    const at = GLOW_TIERS.filter((t) => t.band === band).map((t) => t.at);
    assert.deepEqual(at, at.map((_, i) => at[0] + i), `the ${band} band has a hole in it`);
  }
  // +8 is where a failed refine can shatter the weapon, so the fire ends there
  assert.equal(GLOW_TIERS.find((t) => t.at === 8).band, 'duskbound');
});

test('every tier draws something, out of the eight primitives', () => {
  for (const t of GLOW_TIERS) {
    assert.ok(t.layers.length, `+${t.at} draws nothing`);
    for (const l of t.layers) assert.ok(OVERLAYS.includes(l), `+${t.at} draws an unknown layer: ${l}`);
    assert.equal(new Set(t.layers).size, t.layers.length, `+${t.at} lists a layer twice`);
    assert.ok(t.name && t.nameEn, `+${t.at} has no name`);
  }
  assert.ok(hasOverlay(glowTier(15), 'flare'));
  assert.ok(!hasOverlay(glowTier(1), 'flare'), 'a +1 already draws everything');
  assert.ok(!hasOverlay(null, 'glow1'), 'an unrefined weapon draws a layer');
});

test('a tier that promises ground light also draws the ring', () => {
  // The renderer asks the table whether to draw the floor circle. A tier
  // with a light radius and no `circle` layer would silently lose it.
  for (const t of GLOW_TIERS) {
    if (t.light > 0) assert.ok(hasOverlay(t, 'circle'), `+${t.at} casts light with no circle layer`);
    if (t.sparks > 0) assert.ok(hasOverlay(t, 'spark'), `+${t.at} throws sparks with no spark layer`);
  }
});

test('every special mark is something an item in the world actually has', () => {
  // Eight marks in a table and four of them on nothing is a spec, not a
  // feature. This is the test that makes adding the ninth cost something.
  const seen = new Set();
  for (const it of Object.values(ITEMS)) for (const m of specialMarks(it)) seen.add(m);
  const missing = Object.keys(SPECIAL_MARKS).filter((m) => !seen.has(m));
  assert.deepEqual(missing, [], `no item wears: ${missing.join(', ')}`);
  for (const [id, m] of Object.entries(SPECIAL_MARKS)) {
    assert.ok(m.nameTh && m.nameEn, `${id} has no name`);
    assert.equal(m.color.length, 3);
  }
});

test('marks the stat block already states are never stated twice', () => {
  // `critical` and `lifesteal` are read off the numbers rather than written
  // out, so an item cannot claim to drink blood while healing nobody.
  for (const it of Object.values(ITEMS)) {
    const marks = specialMarks(it);
    assert.equal(marks.includes('lifesteal'), (it.lifesteal ?? 0) > 0, `${it.id} disagrees about lifesteal`);
    assert.equal(marks.includes('critical'), (it.crit ?? 0) >= 5, `${it.id} disagrees about crit`);
    assert.deepEqual(marks, [...new Set(marks)], `${it.id} lists a mark twice`);
    for (const m of marks) assert.ok(SPECIAL_MARKS[m], `${it.id} wears an unknown mark: ${m}`);
  }
});

test('a legendary gets its signature from its element, and nothing else gets one', () => {
  for (const [id, s] of Object.entries(SIGNATURES)) {
    assert.ok(ELEMENTS.includes(s.element), `${id} answers to an element that does not exist: ${s.element}`);
    assert.ok(s.nameTh && s.nameEn, `${id} has no name`);
  }
  const legendaries = Object.values(ITEMS).filter((it) => it.rarity === 'legendary' && it.slot);
  assert.ok(legendaries.length, 'nothing in the world is legendary');
  for (const it of Object.values(ITEMS)) {
    const sig = signatureOf(it);
    if (it.rarity !== 'legendary') { assert.equal(sig, null, `${it.id} is not legendary but has a signature`); continue; }
    if (!it.slot) continue;                       // boxes are legendary too, and wear nothing
    assert.ok(sig === null || SIGNATURES[sig], `${it.id} wears an unknown signature: ${sig}`);
  }
  // every element a legendary could carry has somewhere to land
  for (const el of ELEMENTS) {
    if (el === 'neutral') continue;
    assert.ok(signatureOf({ rarity: 'legendary', element: el }), `a legendary ${el} weapon wears nothing`);
  }
  // and the old element names still find theirs
  assert.equal(signatureOf({ rarity: 'legendary', element: 'shade' }), 'shadow_reaper');
});
