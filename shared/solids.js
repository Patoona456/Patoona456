// What a body cannot walk through, finer than the tile grid: the ground a
// house, a stall, a lamp post or a pillar actually stands on. The tile grid
// says where there is ground at all (not water, not a wall); these say where
// something stands on it. A map's `solids` are [x, y, w, h] in tiles, and
// may be fractional - a lamp post is a third of a tile. A map may also carry
// a `fine` grid: where a body may stand at all, 8 world px a cell, one bit a
// cell (1 = shut), base64, row by row - walls, ledges and water traced finer
// than a tile.
import { TILE } from './constants.js';

const cache = new WeakMap();

/** A test for "is (x, y), in world px, inside something solid?" for a map. */
export function solidsOf(map) {
  let hit = cache.get(map);
  if (hit) return hit;
  const list = map?.solids ?? [];
  const fine = map?.fine ? decodeFine(map.fine) : null;
  if (!list.length && !fine) {
    hit = () => false;
  } else {
    // bucketed by tile, so a test looks at the few rects near it
    const buckets = new Map();
    for (const [x, y, w, h] of list) {
      const r = [x * TILE, y * TILE, (x + w) * TILE, (y + h) * TILE];
      for (let ty = Math.floor(y); ty < Math.ceil(y + h); ty++) {
        for (let tx = Math.floor(x); tx < Math.ceil(x + w); tx++) {
          const k = ty * 4096 + tx;
          if (!buckets.has(k)) buckets.set(k, []);
          buckets.get(k).push(r);
        }
      }
    }
    hit = (px, py) => {
      if (fine) {
        const cx = Math.floor(px / fine.cell), cy = Math.floor(py / fine.cell);
        if (cx < 0 || cy < 0 || cx >= fine.cols || cy >= fine.rows) return true;
        const i = cy * fine.cols + cx;
        if (fine.bytes[i >> 3] & (0x80 >> (i & 7))) return true;
      }
      const rs = buckets.get(Math.floor(py / TILE) * 4096 + Math.floor(px / TILE));
      if (!rs) return false;
      for (const r of rs) if (px >= r[0] && px < r[2] && py >= r[1] && py < r[3]) return true;
      return false;
    };
  }
  cache.set(map, hit);
  return hit;
}

function decodeFine(f) {
  const bin = typeof atob === 'function' ? atob(f.bits) : Buffer.from(f.bits, 'base64').toString('binary');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { cell: f.cell, cols: f.cols, rows: f.rows, bytes };
}
