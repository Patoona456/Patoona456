// The fifteen places a character wears something.
//
// Five of them are new, and the worry with adding a slot is not the slot -
// it is everything that already decided how many there are: a save written
// last week, a stat loop, a paper doll, a draw order. These tests are the
// ones that would have caught each of those going wrong.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SLOTS, SLOT_INFO, NEW_SLOTS, slotName } from '../shared/slots.js';
import { SLOTS as RE_EXPORTED } from '../shared/constants.js';
import { ITEMS } from '../shared/data/items.js';
import { LEVEL_CAP } from '../tools/balance.js';

test('every slot says what it is called and where it is drawn', () => {
  assert.equal(SLOTS.length, 15);
  for (const slot of SLOTS) {
    const info = SLOT_INFO[slot];
    assert.ok(info, `${slot} is in the list but not in the table`);
    assert.ok(info.nameTh && info.nameEn, `${slot} has no name`);
    assert.equal(slotName(slot), info.nameTh);
    // a slot is drawn from a sheet, drawn in code, or honestly invisible
    assert.ok(!(info.layer && info.drawn), `${slot} claims both a sheet and a shape`);
  }
  assert.deepEqual(RE_EXPORTED, SLOTS, 'constants.js and slots.js disagree about the slots');
});

test('a character saved before these slots existed still loads', () => {
  // Equipment is an object keyed by slot name, never a list, so a record
  // written when there were ten slots simply has five keys missing. If this
  // ever becomes positional, every old character puts their boots on their
  // head - which is why it is worth a test rather than a comment.
  const old = { weapon: 0, torso: 1, legs: 2, feet: 3 };
  const worn = Object.fromEntries(SLOTS.map((s) => [s, old[s]]).filter(([, v]) => v !== undefined));
  assert.deepEqual(worn, old, 'reading an old record through the new slot list changed it');
  for (const slot of NEW_SLOTS) assert.equal(old[slot], undefined, `${slot} would read as worn`);
});

test('the five new slots are the five the boards added', () => {
  assert.deepEqual(NEW_SLOTS, ['armor', 'cloak', 'scarf', 'glasses', 'mask']);
  for (const slot of NEW_SLOTS) assert.ok(SLOTS.includes(slot), `${slot} is new but not a slot`);
  // armour is the one worn over something else, and it says so
  assert.equal(SLOT_INFO.armor.over, 'torso');
});

test('every new slot has something to wear at every level', () => {
  const bad = [];
  for (const slot of NEW_SLOTS) {
    const levels = Object.values(ITEMS).filter((it) => it.slot === slot)
      .map((it) => it.level ?? 1).sort((a, b) => a - b);
    if (!levels.length) { bad.push(`${slot} has no items at all`); continue; }
    if (levels[levels.length - 1] < LEVEL_CAP - 12) bad.push(`${slot} stops at level ${levels[levels.length - 1]}`);
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] - levels[i - 1] > 26) bad.push(`${slot} has nothing between ${levels[i - 1]} and ${levels[i]}`);
    }
  }
  assert.deepEqual(bad, [], bad.join('; '));
});

test('the new slots are fashion, not a second weapon', () => {
  // If a cloak carried a weapon's worth of power then everyone wears the
  // same cloak and the slot is a tax rather than a choice. Armour is allowed
  // to buy defence, and pays for it in speed; none of the five carries ATK.
  const bad = [];
  for (const it of Object.values(ITEMS)) {
    if (!NEW_SLOTS.includes(it.slot)) continue;
    if (it.atk) bad.push(`${it.id} carries ${it.atk} ATK`);
    if (it.matk) bad.push(`${it.id} carries ${it.matk} MATK`);
    if (it.slot === 'armor' && (it.def ?? 0) > 0 && (it.speed ?? 0) >= 0) {
      bad.push(`${it.id} is armour that costs nothing to wear`);
    }
    const stats = Object.values(it.stats ?? {}).reduce((a, b) => a + b, 0);
    if (stats > 3) bad.push(`${it.id} hands out ${stats} stat points`);
  }
  assert.deepEqual(bad, [], bad.join('; '));
});

test('a slot drawn in code has a shape to draw', () => {
  // The whole reason these are code-drawn is that an invisible slot is worse
  // than a simple one. An item in a drawn slot that carries no shape would
  // be exactly that: bought, equipped, and nothing on screen.
  const bad = [];
  for (const it of Object.values(ITEMS)) {
    const info = SLOT_INFO[it.slot];
    if (!info?.drawn) continue;
    if (!it[info.drawn]) bad.push(`${it.id} is worn in ${it.slot} but has no ${info.drawn} to draw`);
  }
  assert.deepEqual(bad, [], bad.join('; '));
});
