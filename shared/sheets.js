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
};

export const LAYOUTS = { lpc: LPC };

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
  };
  LAYOUTS[id] = layout;
  return layout;
}

export function layoutOf(id) { return LAYOUTS[id] ?? LPC; }

/** Which frame of an animation a given elapsed time lands on. */
export function frameAt(layout, animName, elapsedMs, looping = true) {
  const a = layout.anims[animName] ?? layout.anims.idle ?? LPC.anims.idle;
  if (a.frames <= 1) return 0;
  const frame = Math.floor((elapsedMs / 1000) * a.fps);
  return looping ? frame % a.frames : Math.min(frame, a.frames - 1);
}

/** Which row an animation plays on, for a facing. */
export function rowAt(layout, animName, dir) {
  const a = layout.anims[animName] ?? layout.anims.idle ?? LPC.anims.idle;
  if (a.single) return a.row;
  const span = layout.dirRows ?? 4;
  return a.row + (span > 1 ? dir % span : 0);
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
