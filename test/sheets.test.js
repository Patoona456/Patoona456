// Sheet layouts, and the refine tiers that ride on them.
//
// The renderer used to read frame size and row positions from global
// constants, which meant every asset in the game had to be drawn on one grid.
// Art arriving on a different grid is now a layout description rather than a
// renderer change - and a description is a thing that can be wrong, so this
// checks the arithmetic that everything on screen depends on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LPC, defineLayout, layoutOf, frameAt, rowAt, frameRect, fits } from '../shared/sheets.js';
import { GLOW_TIERS, glowTier, tierSheet } from '../shared/refineglow.js';
import { DIR8, DIR8_VEC, facing8, facingTo, toDir4, vecOf } from '../shared/facing.js';
import { SPRITE, SHEET_COLS, ANIM } from '../shared/constants.js';

test('the built-in layout still describes the art the game ships with', () => {
  assert.equal(LPC.frame.w, SPRITE);
  assert.equal(LPC.frame.h, SPRITE);
  assert.equal(LPC.cols, SHEET_COLS);
  assert.ok(fits(LPC, 832, 1344), 'the universal LPC sheet no longer fits its own layout');
  for (const [name, a] of Object.entries(ANIM)) {
    assert.deepEqual(
      { row: LPC.anims[name].row, frames: LPC.anims[name].frames, fps: LPC.anims[name].fps },
      { row: a.row, frames: a.frames, fps: a.fps },
      `${name} drifted from shared/constants.js`,
    );
  }
});

test('every animation fits inside the sheet it claims to be on', () => {
  for (const layout of [LPC]) {
    for (const [name, a] of Object.entries(layout.anims)) {
      assert.ok(a.frames <= layout.cols, `${name} wants ${a.frames} frames of ${layout.cols}`);
      const lastRow = a.single ? a.row : a.row + (layout.dirRows - 1);
      assert.ok(lastRow < layout.rows, `${name} runs past the bottom of the sheet`);
    }
  }
});

test('a frame is read from the layout, not from a constant', () => {
  // `dir` is one of the eight now; an LPC sheet folds it onto its four, so
  // facing 2 (left) lands on the LPC left row, which is row 1 of the four.
  const r = frameRect(LPC, 'walk', DIR8.indexOf('left'), 0);
  assert.equal(r.sw, 64);
  assert.equal(r.sy, LPC.anims.walk.row * 64 + 1 * 64);

  // Art on another grid: nothing about it is 64, and it still works out.
  const big = defineLayout('test-big', {
    frame: { w: 96, h: 128 }, cols: 6, rows: 4, dirRows: 1,
    anims: { walk: { row: 1, frames: 6, fps: 8 }, idle: { row: 0, frames: 1, fps: 1 } },
  });
  assert.equal(layoutOf('test-big'), big);
  const b = frameRect(big, 'walk', 3, 0);
  assert.equal(b.sw, 96);
  assert.equal(b.sh, 128);
  assert.equal(b.sy, 128, 'a one-direction sheet still offset by facing');
  assert.ok(fits(big, 576, 512));
});

test('an unknown layout or animation falls back instead of throwing', () => {
  assert.equal(layoutOf('no-such-layout'), LPC);
  assert.doesNotThrow(() => frameRect(LPC, 'no-such-anim', 2, 100));
  const partial = defineLayout('test-partial', { anims: { walk: { row: 0, frames: 4, fps: 8 } } });
  assert.equal(partial.anims.hurt.row, LPC.anims.hurt.row, 'a partial layout lost the rest of its animations');
});

test('frames advance, loop, and stop when they are meant to', () => {
  const walk = LPC.anims.walk;
  assert.equal(frameAt(LPC, 'walk', 0), 0);
  assert.equal(frameAt(LPC, 'walk', (1000 / walk.fps) * 2 + 1), 2);
  // Looping wraps; a one-shot holds its last frame however long you wait.
  assert.equal(frameAt(LPC, 'walk', (1000 / walk.fps) * walk.frames + 1), 0);
  assert.equal(frameAt(LPC, 'hurt', 60000, false), LPC.anims.hurt.frames - 1);
  assert.equal(rowAt(LPC, 'hurt', 3), LPC.anims.hurt.row, 'a single-row animation turned with the player');
});

test('the refine tiers climb, and the fire ones come first', () => {
  assert.equal(glowTier(0), null, 'an unrefined weapon glows');
  let last = null;
  for (const t of GLOW_TIERS) {
    assert.ok(t.at >= 1, 'a tier applies below +1');
    if (last) {
      assert.ok(t.at > last.at, `tier at +${t.at} does not come after +${last.at}`);
      assert.ok(t.aura > last.aura, `+${t.at} is not brighter than +${last.at}`);
    }
    assert.ok(t.name && t.nameEn, `the tier at +${t.at} has no name`);
    assert.equal(t.color.length, 3);
    last = t;
  }
  assert.deepEqual(GLOW_TIERS.slice(0, 4).map((t) => t.at), [1, 3, 5, 7],
    'the fire tiers are not at +1 +3 +5 +7');
});

test('a tier with no art falls back to the aura rather than going dark', () => {
  for (const t of GLOW_TIERS) {
    if (t.sheet) continue;
    assert.ok(t.aura > 0, `+${t.at} has neither art nor an aura, so it would be invisible`);
  }
  assert.equal(tierSheet(0), null);
  assert.equal(tierSheet(5), GLOW_TIERS.find((t) => t.at === 5).sheet ?? null);
});
