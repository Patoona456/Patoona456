// Player preferences: the settings window writes them, the game reads them.
// Kept in this browser only; a missing or broken store just means defaults.

const KEY = 'ef.prefs';

export const PREF_DEFAULTS = {
  quality: 'high',      // 'high' | 'saver' - saver draws at 1x and skips the weather
  fps: 60,              // 60 | 30
  shake: true,          // the screen jolts on big hits
  dmg: true,            // damage and heal numbers float up
  names: true,          // other players' names over their heads
  autoLoot: true,       // walk over your loot to pick it up
  touch: 'normal',      // 'small' | 'normal' | 'large' - the on-screen pad
};

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}; } catch { return {}; }
}

export const prefs = { ...PREF_DEFAULTS, ...load() };

const listeners = new Set();

/** Change one preference, remember it, and tell whoever is listening. */
export function setPref(key, value) {
  if (!(key in PREF_DEFAULTS)) return;
  prefs[key] = value;
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* no storage */ }
  for (const fn of listeners) fn(key, value);
}

export function onPref(fn) { listeners.add(fn); }

/** How much bigger or smaller than usual the touch pad is drawn. */
export const TOUCH_SCALE = { small: 0.85, normal: 1, large: 1.18 };
