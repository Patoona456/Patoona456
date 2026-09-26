// What a body cannot walk through, finer than the tile grid: the ground a
// house, a stall, a lamp post or a pillar actually stands on. The tile grid
// says where there is ground at all (not water, not a wall); these say where
// something stands on it. A map's `solids` are [x, y, w, h] in tiles, and
// may be fractional - a lamp post is a third of a tile.
import { TILE } from './constants.js';

const cache = new WeakMap();

/** A test for "is (x, y), in world px, inside something solid?" for a map. */
export function solidsOf(map) {
  let hit = cache.get(map);
  if (hit) return hit;
  const list = map?.solids ?? [];
  if (!list.length) {
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
      const rs = buckets.get(Math.floor(py / TILE) * 4096 + Math.floor(px / TILE));
      if (!rs) return false;
      for (const r of rs) if (px >= r[0] && px < r[2] && py >= r[1] && py < r[3]) return true;
      return false;
    };
  }
  cache.set(map, hit);
  return hit;
}
