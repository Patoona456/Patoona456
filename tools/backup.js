// Hot backup of the live world: safe to run while the server is up.
//
//   node tools/backup.js [destination]
//
// Uses SQLite's own online backup, so the copy is consistent even mid-write.
// On the JSON backend it just copies world.json.
import { backup, DatabaseSync } from 'node:sqlite';
import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const DIR = process.env.EMBERFALL_DATA ?? path.resolve('data');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = process.argv[2] ?? path.join(DIR, 'backups');
await mkdir(outDir, { recursive: true });

const sqliteFile = path.join(DIR, 'world.sqlite');
const jsonFile = path.join(DIR, 'world.json');

if (existsSync(sqliteFile)) {
  const src = new DatabaseSync(sqliteFile, { readOnly: true });
  const dest = path.join(outDir, `world-${stamp}.sqlite`);
  await backup(src, dest);
  src.close();
  console.log('backed up ->', dest);
} else if (existsSync(jsonFile)) {
  const dest = path.join(outDir, `world-${stamp}.json`);
  await copyFile(jsonFile, dest);
  console.log('backed up ->', dest);
} else {
  console.error('no world found in', DIR);
  process.exit(1);
}
