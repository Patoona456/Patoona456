// Which way something is pointing.
//
// The game was built on four directions because the LPC art has four: the
// server computed one of {up, left, down, right} and everything downstream
// assumed that was all there was. The new art has eight, and eight is not a
// setting you can flip - it is a different number in the one field every
// entity sends on every snapshot, read by the renderer, the aim indicator,
// the skill cone and the footstep dust.
//
// So facing is now always computed as one of eight, in the order the new
// sheets are laid out, and a layout that only has four rows maps those eight
// down to its own. Old art keeps working, new art gets the full circle, and
// there is exactly one place that knows how to turn a vector into a facing.

/**
 * The eight, in sheet order: Front(down), Down-Left, Left, Up-Left,
 * Back(up), Up-Right, Right, Down-Right.
 *
 * Screen space, so +y is down. This order is not arbitrary - it is the
 * column order of the asset sheets, and writing it down here is what lets a
 * sheet be read without a translation table per file.
 */
export const DIR8 = ['down', 'downleft', 'left', 'upleft', 'up', 'upright', 'right', 'downright'];

/**
 * Unit vector for each facing, for aim cones, dust and knockback.
 *
 * The diagonals use SQRT1_2 rather than a rounded 0.7071: a truncated one is
 * half a percent short of unit length, and these get multiplied by distances
 * to decide where a skill lands.
 */
const D = Math.SQRT1_2;
export const DIR8_VEC = [
  [0, 1],                          // down
  [-D, D],                         // down-left
  [-1, 0],                         // left
  [-D, -D],                        // up-left
  [0, -1],                         // up
  [D, -D],                         // up-right
  [1, 0],                          // right
  [D, D],                          // down-right
];

/** The old four, kept because the LPC sheets are laid out in this order. */
export const DIR4 = ['up', 'left', 'down', 'right'];
export const DIR4_VEC = [[0, -1], [-1, 0], [0, 1], [1, 0]];

/**
 * Turn a movement or aim vector into one of the eight.
 *
 * Bucketed by angle rather than by comparing |dx| to |dy|, because the old
 * comparison cannot express a diagonal at all - it always collapsed to an
 * axis, which is exactly the information the new art needs kept.
 */
export function facing8(dx, dy) {
  if (!dx && !dy) return 0;
  // Angle measured from "down", turning toward "left", which is the order
  // the sheet columns run in.
  const a = Math.atan2(-dx, dy);                 // 0 = down, +pi/2 = left
  const step = Math.round(a / (Math.PI / 4));    // eighths of a turn
  return ((step % 8) + 8) % 8;
}

/** Facing from one point toward another. */
export function facingTo(from, to) {
  return facing8(to.x - from.x, to.y - from.y);
}

/**
 * Collapse eight onto the four an LPC sheet has.
 *
 * Diagonals read as the horizontal of the pair: a character walking down-left
 * looks better facing left than facing the camera, and every side-view sprite
 * set in this genre makes the same choice.
 */
export const DIR8_TO_DIR4 = [
  2,  // down        -> down
  1,  // down-left   -> left
  1,  // left        -> left
  1,  // up-left     -> left
  0,  // up          -> up
  3,  // up-right    -> right
  3,  // right       -> right
  3,  // down-right  -> right
];

export function toDir4(facing) { return DIR8_TO_DIR4[((facing % 8) + 8) % 8] ?? 2; }

/** The unit vector a facing points along, whichever count it came from. */
export function vecOf(facing) { return DIR8_VEC[((facing % 8) + 8) % 8] ?? DIR8_VEC[0]; }
