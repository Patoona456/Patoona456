// Dead simple durable store: one JSON file, atomic writes, debounced saves.
// Swap this module for a real database later - nothing else knows the shape.
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';

const DIR = process.env.EMBERFALL_DATA ?? path.resolve('data');
const FILE = path.join(DIR, 'world.json');

const empty = () => ({
  version: 1,
  accounts: {},          // name -> { name, salt, hash, created, chars: [charId], banned }
  characters: {},        // id -> character record
  market: [],            // consignment listings
  storage: {},           // accountName -> { items: [], aurum }
  stats: { created: Date.now(), aurumMinted: 0, aurumBurned: 0 },
  nextCharId: 1,
});

export const db = empty();
let dirty = false;
let saving = false;

export async function load() {
  await mkdir(DIR, { recursive: true });
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
    const tmp = FILE + '.tmp';
    await writeFile(tmp, JSON.stringify(db));
    await rename(tmp, FILE);
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
