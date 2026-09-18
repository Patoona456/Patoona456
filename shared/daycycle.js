// A day/night cycle every client agrees on without the server saying a word:
// it is a pure function of wall-clock time. One full day takes 24 real
// minutes, so a play session sees dawn, noon, dusk and night.
export const DAY_MS = 24 * 60 * 1000;

/** 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset. */
export function dayPhase(now = Date.now()) {
  return ((now % DAY_MS) + DAY_MS) % DAY_MS / DAY_MS;
}

/** Game clock as hours/minutes, for the HUD. */
export function gameClock(now = Date.now()) {
  const t = dayPhase(now) * 24;
  const h = Math.floor(t);
  const m = Math.floor((t - h) * 60);
  return { h, m, text: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
}

// Keyframes: phase -> [r, g, b, alpha of the tint, how much lamps are needed]
const KEYS = [
  [0.00, [10, 16, 44], 0.46, 1.00],    // midnight
  [0.21, [26, 26, 60], 0.38, 0.88],    // the last dark hour
  [0.27, [255, 150, 90], 0.22, 0.38],  // sunrise
  [0.34, [255, 210, 160], 0.07, 0.06],
  [0.50, [255, 255, 240], 0.00, 0.00], // noon
  [0.68, [255, 205, 155], 0.07, 0.06], // golden hour
  [0.75, [255, 140, 90], 0.18, 0.32],  // sunset
  [0.81, [90, 70, 115], 0.32, 0.72],   // dusk
  [0.87, [40, 40, 90], 0.40, 0.92],
  [1.00, [10, 16, 44], 0.46, 1.00],
];

/** Interpolated sky colour, tint strength and lamp need for a moment in time. */
export function skyAt(now = Date.now()) {
  const p = dayPhase(now);
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (p >= KEYS[i][0] && p <= KEYS[i + 1][0]) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  }
  const span = b[0] - a[0];
  const t = span > 0 ? (p - a[0]) / span : 0;
  const mix = (i) => Math.round(a[1][i] + (b[1][i] - a[1][i]) * t);
  return {
    phase: p,
    rgb: [mix(0), mix(1), mix(2)],
    alpha: a[2] + (b[2] - a[2]) * t,
    lamp: a[3] + (b[3] - a[3]) * t,
    night: p < 0.24 || p > 0.80,
  };
}
