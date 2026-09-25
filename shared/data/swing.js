// How a sword sits in the chibi's hands through the swing (columns 19-28 of
// assets/chibi/body/base_male.png, cut by tools/slice-base.py).
//
// The body is drawn with bare hands round a grip that is not there; the sword
// is the item's own picture, put in the fist (CHIBI_FISTS) at the angle below,
// so every sword in the game swings the same way without a frame of its own.
//
// Per row (down, left, up, right), one entry per frame: ready, grip, draw
// back, raised, cut, cut through, follow through, ease, return, ready.
//   angle   where the blade points from the fist, in degrees on screen
//           (0 right, 90 down, 180 left, -90 up)
//   behind  the blade goes behind the body (seen from the back, the hands
//           are in front of it)
// The cut leaves a crescent over the frames listed in `arc`, swept from the
// previous frame's blade to this one's - the short way round, except for a
// cut of near a half turn, which sweeps the way `sweep` says for its row
// (1 clockwise on screen, -1 anticlockwise), so it passes in front.
export const SWING = {
  angle: [
    [135, 140, -120, -100, 80, 10, 160, 125, 60, 60],          // down
    [150, -115, -150, -50, 120, 150, 165, 140, 130, 150],      // left
    [-75, -60, -100, -80, 20, 10, 40, 60, 140, -75],           // up
    [30, -65, -30, -130, 60, 30, 15, 40, 50, 30],              // right
  ],
  behind: [
    [],
    [],
    [0, 9],
    [],
  ],
  arc: [4, 5, 6],
  sweep: [1, -1, 1, 1],
};
