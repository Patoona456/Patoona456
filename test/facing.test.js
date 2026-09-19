// Which way things point.
//
// Facing used to be one of four and is now one of eight, and it travels in
// the single field every entity sends on every snapshot. Getting it wrong
// does not throw - it draws everybody facing the wrong way, aims skill cones
// into empty ground, and puts a backstab bonus on a frontal attack. So the
// arithmetic is pinned here rather than trusted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DIR8, DIR8_VEC, DIR4, facing8, facingTo, toDir4, vecOf } from '../shared/facing.js';
import { LPC, CHIBI8, rowAt } from '../shared/sheets.js';

test('the eight are in the order the sheets are laid out', () => {
  // The asset boards run Front, Down-Left, Left, Up-Left, Back, Up-Right,
  // Right, Down-Right across their columns. If this list ever stops matching
  // that, every character in the game turns the wrong way at once.
  assert.deepEqual(DIR8, ['down', 'downleft', 'left', 'upleft', 'up', 'upright', 'right', 'downright']);
  assert.equal(DIR8.length, DIR8_VEC.length);
});

test('a vector becomes the facing a person would expect', () => {
  const cases = [
    [0, 1, 'down'], [-1, 1, 'downleft'], [-1, 0, 'left'], [-1, -1, 'upleft'],
    [0, -1, 'up'], [1, -1, 'upright'], [1, 0, 'right'], [1, 1, 'downright'],
  ];
  for (const [dx, dy, want] of cases) {
    assert.equal(DIR8[facing8(dx, dy)], want, `${dx},${dy} should face ${want}`);
    // Magnitude must not matter, only angle.
    assert.equal(facing8(dx * 37, dy * 37), facing8(dx, dy), 'a longer vector changed the facing');
  }
  assert.equal(facing8(0, 0), 0, 'standing still has no facing to compute');
});

test('every facing has a unit vector pointing where it says', () => {
  for (let d = 0; d < 8; d++) {
    const [vx, vy] = vecOf(d);
    assert.ok(Math.abs(Math.hypot(vx, vy) - 1) < 1e-6, `${DIR8[d]} is not a unit vector`);
    // Round-trips: the vector for a facing must produce that facing again.
    assert.equal(facing8(vx, vy), d, `${DIR8[d]} does not round-trip`);
  }
  // Out of range is clamped rather than undefined, because this value arrives
  // over a socket and a client is free to send nonsense.
  assert.deepEqual(vecOf(99), vecOf(99 % 8));
  assert.deepEqual(vecOf(-1), vecOf(7));
});

test('facingTo points from one thing at another', () => {
  const me = { x: 100, y: 100 };
  assert.equal(DIR8[facingTo(me, { x: 100, y: 200 })], 'down');
  assert.equal(DIR8[facingTo(me, { x: 100, y: 0 })], 'up');
  assert.equal(DIR8[facingTo(me, { x: 0, y: 100 })], 'left');
  assert.equal(DIR8[facingTo(me, { x: 200, y: 100 })], 'right');
  assert.equal(DIR8[facingTo(me, { x: 200, y: 200 })], 'downright');
});

test('four-row art folds the eight without losing anybody', () => {
  for (let d = 0; d < 8; d++) {
    const four = toDir4(d);
    assert.ok(four >= 0 && four < 4, `${DIR8[d]} folded to row ${four}`);
  }
  // Diagonals read as the horizontal of the pair - a character walking
  // down-left should look left, not at the camera.
  assert.equal(DIR4[toDir4(DIR8.indexOf('downleft'))], 'left');
  assert.equal(DIR4[toDir4(DIR8.indexOf('upright'))], 'right');
  assert.equal(DIR4[toDir4(DIR8.indexOf('down'))], 'down');
  assert.equal(DIR4[toDir4(DIR8.indexOf('up'))], 'up');
  assert.deepEqual(toDir4(-3), toDir4(5), 'a negative facing did not wrap');
});

test('a sheet draws the facing it was handed, whichever count it has', () => {
  // Four rows: eight facings land on four distinct rows, and only four.
  const lpcRows = new Set();
  for (let d = 0; d < 8; d++) lpcRows.add(rowAt(LPC, 'walk', d));
  assert.equal(lpcRows.size, 4, 'LPC walk used more or fewer than its four rows');

  // Eight rows: each facing is its own row, in order.
  for (let d = 0; d < 8; d++) {
    assert.equal(rowAt(CHIBI8, 'walk', d), CHIBI8.anims.walk.row + d,
      `${DIR8[d]} did not get its own row on an eight-direction sheet`);
  }
});

test('an action the art calls something else still draws', () => {
  // The engine says "slash"; the new sheets say "attack1". A missing name
  // must resolve, not blank the character out mid-swing.
  assert.equal(rowAt(CHIBI8, 'slash', 0), CHIBI8.anims.attack1.row);
  assert.equal(rowAt(CHIBI8, 'spellcast', 0), CHIBI8.anims.skill.row);
  assert.equal(rowAt(CHIBI8, 'nothing_like_this', 0), CHIBI8.anims.idle.row);
});
