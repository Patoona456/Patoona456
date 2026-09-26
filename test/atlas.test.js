// The icon sheets: every item's 'sheet#cell' finds a picture, and the merged
// weapons file is laid out the way shared/atlas.js says it is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { ITEMS } from '../shared/data/items.js';
import { ATLASES, MERGED_COLS, atlasFile, atlasRect } from '../shared/atlas.js';

const ui = (f) => new URL(`../assets/ui/${f}.webp`, import.meta.url);

/** Width and height of a WebP, from its header (lossless, lossy, or extended). */
function webpSize(buf) {
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
  }
  if (kind === 'VP8X') return { w: buf.readUIntLE(24, 3) + 1, h: buf.readUIntLE(27, 3) + 1 };
  return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
}

test('every item with sheet art points at a sheet and a cell that exist', () => {
  for (const it of Object.values(ITEMS)) {
    const [sheet, cell] = (it.art ?? '').split('#');
    if (cell == null) continue;
    const a = ATLASES[sheet];
    assert.ok(a, `${it.id} names the unknown sheet ${sheet}`);
    assert.ok(existsSync(ui(atlasFile(sheet))), `${it.id}: ${atlasFile(sheet)}.webp is missing`);
    if (a.count != null) assert.ok(+cell < a.count, `${it.id} is cell ${cell} of a ${a.count}-cell sheet`);
  }
});

test('the sheets merged into one file sit on rows of their own, inside it', () => {
  const byFile = {};
  for (const [name, a] of Object.entries(ATLASES)) if (a.in) (byFile[a.in] ??= []).push([name, a]);
  for (const [file, sheets] of Object.entries(byFile)) {
    const { w, h } = webpSize(readFileSync(ui(file)));
    const cell = w / MERGED_COLS;
    assert.equal(cell, Math.round(cell), `${file}.webp is not ${MERGED_COLS} whole cells across`);
    const taken = new Map();
    for (const [name, a] of sheets) {
      assert.ok(a.cols <= MERGED_COLS);
      const rows = Math.ceil(a.count / a.cols);
      for (let r = a.row; r < a.row + rows; r++) {
        assert.ok(!taken.has(r), `${name} and ${taken.get(r)} share row ${r} of ${file}`);
        taken.set(r, name);
      }
      const last = atlasRect(name, a.count - 1, w);
      assert.ok(last.sy + last.size <= h, `${name} runs off the bottom of ${file}.webp`);
    }
  }
});
