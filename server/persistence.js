// Durable store for the whole world.
//
// The rest of the server only ever touches the in-memory `db` object and
// calls markDirty(); this module decides where that lands. Two backends:
//
//   sqlite (default) - node:sqlite, one row per account/character/listing,
//                      written in a transaction, only what changed
//   json             - one file, atomic rename, whole world each save
//
// Pick with AFO_STORE=sqlite|json. A world.json left over from the
// JSON backend is imported once, so upgrading does not lose anyone.
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const DIR = process.env.AFO_DATA ?? path.resolve('data');
const FILE = path.join(DIR, 'world.json');
const WANT = (process.env.AFO_STORE ?? 'sqlite').toLowerCase();

const empty = () => ({
  version: 1,
  accounts: {},          // name -> { name, salt, hash, created, chars: [charId], banned }
  characters: {},        // id -> character record
  market: [],            // consignment listings
  storage: {},           // accountName -> { items: [], aurum }
  guilds: {},            // id -> { id, name, leader, members, vault, aurum, upkeep }
  parties: {},           // id -> { id, name, leader, members, seen }
  stats: { created: Date.now(), aurumMinted: 0, aurumBurned: 0 },
  nextCharId: 1,
});

export const db = empty();
let dirty = false;
let saving = false;
let store = null;        // sqlite handle, or null when running on JSON

export async function load() {
  await mkdir(DIR, { recursive: true });
  Object.assign(db, empty());

  if (WANT === 'sqlite') {
    try {
      const { openStore } = await import('./store-sqlite.js');
      store = openStore(DIR);
      const fresh = store.isEmpty();
      if (fresh && existsSync(FILE)) {
        // one-time migration from the old single-file world
        try {
          Object.assign(db, empty(), JSON.parse(await readFile(FILE, 'utf8')));
          store.write(db);
          console.log(`[db] migrated ${Object.keys(db.characters).length} characters from world.json into sqlite`);
        } catch (e) {
          console.warn('[db] migration failed, starting fresh:', e.message);
          Object.assign(db, empty());
        }
      } else {
        store.read(db);
      }
      console.log(`[db] sqlite ${store.file}: ${Object.keys(db.accounts).length} accounts, ${Object.keys(db.characters).length} characters`);
      return;
    } catch (e) {
      console.warn('[db] sqlite unavailable, falling back to json:', e.message);
      store = null;
    }
  }

  try {
    const raw = JSON.parse(await readFile(FILE, 'utf8'));
    Object.assign(db, empty(), raw);
    console.log(`[db] loaded ${Object.keys(db.accounts).length} accounts, ${Object.keys(db.characters).length} characters`);
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('[db] load failed, starting fresh:', e.message);
    Object.assign(db, empty());
    await save(true);
  }
}

export function markDirty() { dirty = true; }

export async function save(force = false) {
  if (saving || (!dirty && !force)) return;
  saving = true; dirty = false;
  try {
    if (store) store.write(db);
    else {
      const tmp = FILE + '.tmp';
      await writeFile(tmp, JSON.stringify(db));
      await rename(tmp, FILE);
    }
  } catch (e) {
    console.error('[db] save failed:', e.message);
    dirty = true;
  } finally {
    saving = false;
  }
}

export function startAutosave(intervalMs = 15000) {
  const t = setInterval(() => { save(); }, intervalMs);
  t.unref?.();
  return t;
}

/** Called on shutdown, after the last save. */
export function closeStore() {
  store?.close();
  store = null;
}
