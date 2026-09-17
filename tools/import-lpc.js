#!/usr/bin/env node
/**
 * Imports the curated Universal-LPC-spritesheet subset used by Emberfall Online.
 *
 *   git clone --depth 1 https://github.com/makrohn/Universal-LPC-spritesheet.git
 *   npm run import-lpc -- ./Universal-LPC-spritesheet
 *
 * Every sheet in the upstream repo is the "universal" 832x1344 layout
 * (13 columns x 21 rows of 64x64 frames), which is what client/js/sprites.js
 * expects, so importing is a plain copy driven by tools/lpc-manifest.json.
 */
import { mkdir, copyFile, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.resolve(process.argv[2] ?? './Universal-LPC-spritesheet');
const out = path.join(root, 'assets', 'lpc');

const manifest = JSON.parse(await readFile(path.join(root, 'tools', 'lpc-manifest.json'), 'utf8'));

let copied = 0;
const missing = [];
for (const [from, to] of Object.entries(manifest.files)) {
  const abs = path.join(src, from);
  try {
    await stat(abs);
  } catch {
    missing.push(from);
    continue;
  }
  const dest = path.join(out, to);
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(abs, dest);
  copied++;
}

const index = {
  source: 'https://github.com/makrohn/Universal-LPC-spritesheet',
  license: 'CC-BY-SA 3.0 / GPL 3.0 (see assets/lpc/CREDITS.md)',
  sheet: manifest.sheet,
  files: Object.values(manifest.files).sort(),
};
await mkdir(out, { recursive: true });
await writeFile(path.join(out, 'index.json'), JSON.stringify(index, null, 2));

console.log(`imported ${copied} sheets -> ${path.relative(root, out)}`);
if (missing.length) {
  console.warn(`missing ${missing.length} source file(s):`);
  for (const m of missing) console.warn('  - ' + m);
  process.exitCode = missing.length === Object.keys(manifest.files).length ? 1 : 0;
}
