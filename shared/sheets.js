import { DIR8_TO_DIR4 } from './facing.js';

// What shape a spritesheet is.
//
// Every sheet in this game was the Universal LPC layout - 64x64 frames, 13
// columns, 21 rows, with a fixed row for each action - and those numbers were
// constants read directly by the renderer. That is fine right up until
// somebody hands you art drawn to a different grid, at which point nothing
// fits and there is no seam to adapt at.
//
// A layout is now a named description, and a sheet says which one it follows.
// Art that does not match LPC is a new entry here rather than a change to the
// renderer, and mixing layouts in one world costs nothing: the drawing code
// asks the layout where a frame is instead of working it out from constants.

/** The layout every existing asset follows. */
export const LPC = {
  id: 'lpc',
  frame: { w: 64, h: 64 },
  cols: 13,
  rows: 21,
  /** Where the feet sit, as a fraction of frame height, for ground alignment. */
  anchor: 0.82,
  anims: {
    spellcast: { row: 0, frames: 7, fps: 12 },
    thrust: { row: 4, frames: 8, fps: 14 },
    walk: { row: 8, frames: 9, fps: 10 },
    slash: { row: 12, frames: 6, fps: 14 },
    shoot: { row: 16, frames: 13, fps: 16 },
    hurt: { row: 20, frames: 6, fps: 8, single: true },
    idle: { row: 8, frames: 1, fps: 1 },
  },
  /** Four rows per action: up, left, down, right. */
  dirRows: 4,
  /** Facing is always one of eight; this is how this sheet folds them. */
  dirMap: DIR8_TO_DIR4,
};

/**
 * The layout the new art is drawn to.
 *
 * Taken from the spec on the asset boards: 128x128 frames, a character about
 * 96 tall standing on a bottom-centre pivot, and eight directions in the
 * column order DIR8 already names. Eleven actions rather than LPC's six, and
 * they are different actions - there is a run, two attacks, a death, a sit
 * and a victory pose, none of which the old sheets had.
 *
 * `frames` per action is left at 1 until the real sheets arrive and can be
 * measured: a board preview shows one image per cell, which says nothing
 * about how many frames the animation actually has. Everything else here is
 * stated outright in the spec panel, so it is written down rather than
 * guessed, and `npm run sheet` will confirm the grid against a real file.
 */
export const CHIBI8 = {
  id: 'chibi8',
  aliases: null,           // filled in below, once CHIBI_ALIASES exists
  frame: { w: 128, h: 128 },
  cols: 1,                 // measured from the first real sheet
  rows: 88,                // 11 actions x 8 directions
  /** The art stands on the bottom edge of its frame, not floating in it. */
  anchor: 1.0,
  dirRows: 8,
  dirMap: null,            // eight rows means the facing is the row
  anims: {
    idle: { row: 0, frames: 1, fps: 6 },
    walk: { row: 8, frames: 1, fps: 10 },
    run: { row: 16, frames: 1, fps: 14 },
    attack1: { row: 24, frames: 1, fps: 14 },
    attack2: { row: 32, frames: 1, fps: 14 },
    skill: { row: 40, frames: 1, fps: 12 },
    hurt: { row: 48, frames: 1, fps: 10, single: true },
    die: { row: 56, frames: 1, fps: 8, single: true },
    sit: { row: 64, frames: 1, fps: 4 },
    victory: { row: 72, frames: 1, fps: 8 },
    emote: { row: 80, frames: 1, fps: 8 },
  },
};

/**
 * What the engine's action names mean on a sheet that has different ones.
 *
 * The game asks for `slash` because that is what a sword swing has always
 * been called here; the new art calls it `attack1`. Rather than rename every
 * call site - and every skill definition, which is data players' characters
 * are built on - a layout may say what its own name for a thing is.
 */
export const CHIBI_ALIASES = {
  slash: 'attack1',
  thrust: 'attack2',
  shoot: 'attack2',
  spellcast: 'skill',
};

CHIBI8.aliases = CHIBI_ALIASES;

/**
 * The chibi walk board (assets/chibi/body), as cut by tools/slice-chibi.py:
 * four walk frames across, eight facings down in DIR8 order. It is drawn at
 * source resolution and shrunk on the way to the screen, so it stays sharp
 * when the camera zooms in. There is only a walk: every other action falls
 * back to idle, and the renderer lunges the body for attacks instead.
 */
export const CHIBI_WALK = {
  id: 'chibi_walk',
  aliases: {},
  frame: { w: 128, h: 192 },
  cols: 4,
  rows: 8,
  anchor: 184 / 192,
  drawScale: 0.27,   // ~47px tall, the height of an LPC NPC
  dirRows: 8,
  dirMap: null,
  anims: {
    idle: { row: 0, frames: 1, fps: 1 },
    walk: { row: 0, frames: 4, fps: 8 },
  },
};

export const LAYOUTS = { lpc: LPC, chibi8: CHIBI8, chibi_walk: CHIBI_WALK };

/**
 * Register a layout. Art that arrives on a different grid gets described here
 * once and then behaves like anything else.
 *
 * `anims` may be partial: anything left out falls back to LPC's timing, so a
 * sheet that only has a walk cycle still draws rather than throwing.
 */
export function defineLayout(id, spec) {
  const base = spec.basedOn ? LAYOUTS[spec.basedOn] ?? LPC : LPC;
  const layout = {
    ...base,
    ...spec,
    id,
    frame: { ...base.frame, ...(spec.frame ?? {}) },
    anims: { ...base.anims, ...(spec.anims ?? {}) },
    aliases: { ...(base.aliases ?? {}), ...(spec.aliases ?? {}) },
  };
  LAYOUTS[id] = layout;
  return layout;
}

export function layoutOf(id) { return LAYOUTS[id] ?? LPC; }

/** Which frame of an animation a given elapsed time lands on. */
/**
 * An animation on this sheet, by the engine's name for it.
 *
 * Falls through the sheet's own aliases, then to idle - so a sheet that has
 * no separate bow animation still draws something sensible when an archer
 * shoots, rather than a blank frame or a throw.
 */
export function animOf(layout, animName) {
  return layout.anims[animName]
    ?? layout.anims[layout.aliases?.[animName]]
    ?? layout.anims.idle
    ?? LPC.anims.idle;
}

export function frameAt(layout, animName, elapsedMs, looping = true) {
  const a = animOf(layout, animName);
  if (a.frames <= 1) return 0;
  const frame = Math.floor((elapsedMs / 1000) * a.fps);
  return looping ? frame % a.frames : Math.min(frame, a.frames - 1);
}

/**
 * Which row an animation plays on, for a facing.
 *
 * `dir` is always one of the eight. A sheet with eight rows uses it directly;
 * one with four folds it through its own map, so the caller never has to know
 * how many directions the art it is about to draw happens to have.
 */
export function rowAt(layout, animName, dir) {
  const a = animOf(layout, animName);
  if (a.single) return a.row;
  const span = layout.dirRows ?? 4;
  if (span <= 1) return a.row;
  const facing = ((dir % 8) + 8) % 8;
  const row = layout.dirMap ? (layout.dirMap[facing] ?? 0) : facing % span;
  return a.row + (row % span);
}

/** Where a frame sits inside the sheet, in pixels. */
export function frameRect(layout, animName, dir, elapsedMs, looping = true) {
  const col = frameAt(layout, animName, elapsedMs, looping);
  const row = rowAt(layout, animName, dir);
  return { sx: col * layout.frame.w, sy: row * layout.frame.h, sw: layout.frame.w, sh: layout.frame.h };
}

/**
 * Does this image actually match the layout it claims?
 *
 * Worth checking out loud rather than drawing garbage: a sheet one row short
 * renders as a character whose hurt animation is somebody else's feet, and
 * that is a confusing thing to debug from the symptom.
 */
export function fits(layout, width, height) {
  return width === layout.frame.w * layout.cols && height === layout.frame.h * layout.rows;
}
