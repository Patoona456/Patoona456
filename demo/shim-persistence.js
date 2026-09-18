// Browser stand-in for server/persistence.js.
// The whole world lives in memory and is mirrored into localStorage so a
// single-player demo remembers your character between visits.
const KEY = 'emberfall-demo-world-v1';

const empty = () => ({
  version: 1, accounts: {}, characters: {}, market: [], storage: {},
  stats: { created: Date.now(), aurumMinted: 0, aurumBurned: 0 }, nextCharId: 1,
});

export const db = empty();
let dirty = false;

export async function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(db, empty(), JSON.parse(raw));
  } catch {
    Object.assign(db, empty());       // private window, blocked storage, bad JSON
  }
}

export function markDirty() { dirty = true; }

export async function save(force = false) {
  if (!dirty && !force) return;
  dirty = false;
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage unavailable */ }
}

export function startAutosave(ms = 8000) {
  const t = setInterval(() => save(), ms);
  addEventListener('pagehide', () => save(true));
  return t;
}

export function wipe() {
  Object.assign(db, empty());
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** The real store closes a SQLite handle here; the browser has nothing to close. */
export function closeStore() {}
