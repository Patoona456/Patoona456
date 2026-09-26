// SQLite backend for the world store, on Node's built-in node:sqlite - no
// dependency to install and no extra process to run.
//
// The game code only ever touches the in-memory `db` object; this module
// loads it on boot and writes back what changed. Records are stored one row
// per entity as JSON, which keeps the schema stable while item, quest and
// skill shapes are still moving.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const TABLES = [
  // [table, primary key column, db property, how to key a record]
  ['accounts', 'key', 'accounts', (row) => row.key],
  ['characters', 'id', 'characters', (row) => row.id],
  ['storage', 'account', 'storage', null],      // keyed by its map key
  ['guilds', 'id', 'guilds', (row) => row.id],
  ['parties', 'id', 'parties', (row) => row.id],
];

export function openStore(dir) {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'world.sqlite');
  const sql = new DatabaseSync(file);

  // WAL keeps readers out of the writer's way and survives a hard kill.
  sql.exec('PRAGMA journal_mode = WAL');
  sql.exec('PRAGMA synchronous = NORMAL');
  sql.exec(`
    CREATE TABLE IF NOT EXISTS accounts   (key TEXT PRIMARY KEY, json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS characters (id  TEXT PRIMARY KEY, json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS storage    (account TEXT PRIMARY KEY, json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS guilds     (id      TEXT PRIMARY KEY, json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS parties    (id      TEXT PRIMARY KEY, json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS market     (uid TEXT PRIMARY KEY, json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS meta       (key TEXT PRIMARY KEY, json TEXT NOT NULL);
  `);

  const put = Object.fromEntries(['accounts', 'characters', 'storage', 'guilds', 'parties'].map((t) => [t,
    sql.prepare(`INSERT INTO ${t} VALUES (?, ?) ON CONFLICT DO UPDATE SET json = excluded.json`)]));
  const del = Object.fromEntries(['accounts', 'characters', 'storage', 'guilds', 'parties'].map((t) => [t,
    sql.prepare(`DELETE FROM ${t} WHERE ${TABLES.find((x) => x[0] === t)[1]} = ?`)]));
  const putMarket = sql.prepare('INSERT INTO market VALUES (?, ?) ON CONFLICT DO UPDATE SET json = excluded.json');
  const putMeta = sql.prepare('INSERT INTO meta VALUES (?, ?) ON CONFLICT DO UPDATE SET json = excluded.json');

  // last written text per row, so a save only touches what actually changed
  const seen = { accounts: new Map(), characters: new Map(), storage: new Map(), guilds: new Map(), parties: new Map(), market: new Map() };

  function read(db) {
    for (const [table, , prop] of TABLES) {
      const out = {};
      for (const row of sql.prepare(`SELECT * FROM ${table}`).all()) {
        const key = String(row[TABLES.find((t) => t[0] === table)[1]]);
        out[key] = JSON.parse(row.json);
        seen[table].set(key, row.json);
      }
      db[prop] = out;
    }
    db.market = sql.prepare('SELECT * FROM market').all().map((r) => {
      seen.market.set(String(r.uid), r.json);
      return JSON.parse(r.json);
    });
    for (const row of sql.prepare('SELECT * FROM meta').all()) {
      db[row.key] = JSON.parse(row.json);
    }
    return db;
  }

  function write(db) {
    sql.exec('BEGIN');
    try {
      for (const [table, , prop, keyOf] of TABLES) {
        const live = db[prop] ?? {};
        for (const [key, value] of Object.entries(live)) {
          const id = keyOf ? String(keyOf(value) ?? key) : String(key);
          const json = JSON.stringify(value);
          if (seen[table].get(id) === json) continue;
          put[table].run(id, json);
          seen[table].set(id, json);
        }
        for (const key of [...seen[table].keys()]) {
          if (live[key] === undefined) { del[table].run(key); seen[table].delete(key); }
        }
      }

      // the market is a list; rewrite it only when its contents moved
      const listings = new Map((db.market ?? []).map((l) => [String(l.uid), JSON.stringify(l)]));
      for (const [uid, json] of listings) {
        if (seen.market.get(uid) === json) continue;
        putMarket.run(uid, json);
        seen.market.set(uid, json);
      }
      for (const uid of [...seen.market.keys()]) {
        if (!listings.has(uid)) { sql.prepare('DELETE FROM market WHERE uid = ?').run(uid); seen.market.delete(uid); }
      }

      // A counter that nothing has needed yet is `undefined`, and
      // JSON.stringify(undefined) is undefined, which SQLite cannot bind -
      // that threw inside the transaction and silently stopped the whole
      // world from saving on any server where nobody had founded a guild.
      for (const key of ['version', 'stats', 'nextCharId', 'nextGuildId', 'nextPartyId', 'siege']) {
        const value = db[key];
        if (value === undefined) continue;
        putMeta.run(key, JSON.stringify(value));
      }
      sql.exec('COMMIT');
    } catch (e) {
      sql.exec('ROLLBACK');
      throw e;
    }
  }

  const isEmpty = () => sql.prepare('SELECT COUNT(*) AS n FROM accounts').get().n === 0
    && sql.prepare('SELECT COUNT(*) AS n FROM characters').get().n === 0;

  return { file, read, write, isEmpty, close: () => sql.close() };
}
