// Walking around things.
//
// One breadth-first search, used by two callers who used to disagree: the
// client walks the player here on auto-travel, and the server walks monsters
// here when they chase. Before this was shared, monsters had no pathfinding
// at all - `moveTo` slid them along the wall - so anything standing behind a
// corner was safe from them forever.
import { TILE } from './constants.js';
import { BLOCKING as BLOCKED_TILES } from './data/maps.js';

const tileOf = (v) => Math.floor(v / TILE);
const centre = (t) => t * TILE + TILE / 2;

/**
 * Breadth-first path over walkable tiles, returned as world-space waypoints.
 * Four-way only: a 20px body clips the corner on a diagonal between two
 * walls, and a path the player visibly fails to follow is worse than none.
 */
export function findPath(grid, W, H, from, to, maxNodes = 20000) {
  const sx = tileOf(from.x), sy = tileOf(from.y);
  const gx = Math.max(0, Math.min(W - 1, tileOf(to.x)));
  const gy = Math.max(0, Math.min(H - 1, tileOf(to.y)));
  const free = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !BLOCKED_TILES.has(grid[y * W + x]);
  if (!free(sx, sy)) return null;

  const start = sy * W + sx;
  const goal = gy * W + gx;
  const prev = new Int32Array(W * H).fill(-1);
  const seen = new Uint8Array(W * H);
  let queue = [start];
  seen[start] = 1;
  let found = free(gx, gy) ? -1 : null;
  let nodes = 0;

  // when the goal tile itself is blocked, stop at the closest reachable tile
  let best = start, bestD = (sx - gx) ** 2 + (sy - gy) ** 2;

  while (queue.length && nodes < maxNodes) {
    const next = [];
    for (const cur of queue) {
      nodes++;
      if (cur === goal) { found = cur; queue = []; break; }
      const cx = cur % W, cy = (cur - cx) / W;
      const d = (cx - gx) ** 2 + (cy - gy) ** 2;
      if (d < bestD) { bestD = d; best = cur; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (!free(nx, ny)) continue;
        const ni = ny * W + nx;
        if (seen[ni]) continue;
        seen[ni] = 1;
        prev[ni] = cur;
        next.push(ni);
      }
    }
    if (found !== null && found >= 0) break;
    queue = next;
  }

  const end = found !== null && found >= 0 ? found : best;
  if (end === start) return [];
  const out = [];
  for (let cur = end; cur !== -1 && cur !== start; cur = prev[cur]) {
    const x = cur % W, y = (cur - x) / W;
    out.push({ x: centre(x), y: centre(y) });
  }
  out.reverse();
  return smooth(out, grid, W, H);
}

/** Drop waypoints we can see past, so the walk is a line and not a staircase. */
function smooth(path, grid, W, H) {
  if (path.length < 3) return path;
  const clear = (a, b) => {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8);
    for (let i = 0; i <= steps; i++) {
      const x = a.x + (b.x - a.x) * (i / steps), y = a.y + (b.y - a.y) * (i / steps);
      // the body is 20px wide: check its corners, not just its centre
      for (const [ox, oy] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) {
        const tx = tileOf(x + ox), ty = tileOf(y + oy);
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) return false;
        if (BLOCKED_TILES.has(grid[ty * W + tx])) return false;
      }
    }
    return true;
  };
  const out = [path[0]];
  let i = 0;
  while (i < path.length - 1) {
    let j = path.length - 1;
    while (j > i + 1 && !clear(path[i], path[j])) j--;
    out.push(path[j]);
    i = j;
  }
  return out;
}


/**
 * True when a body of `r` half-width can walk straight from a to b. The
 * monster AI asks this first: in open ground the straight line is the path,
 * and a search would be wasted work on every frame of every chase.
 */
export function lineClear(grid, W, H, a, b, r = 10) {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8) || 1;
  for (let i = 0; i <= steps; i++) {
    const x = a.x + (b.x - a.x) * (i / steps), y = a.y + (b.y - a.y) * (i / steps);
    for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
      const tx = tileOf(x + ox), ty = tileOf(y + oy);
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) return false;
      if (BLOCKED_TILES.has(grid[ty * W + tx])) return false;
    }
  }
  return true;
}
