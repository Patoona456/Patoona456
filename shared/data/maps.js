// Zone definitions + the deterministic terrain generator.
// The server builds the tile grid at boot and ships it to clients RLE-encoded,
// so the generator only has to be right once.

import { EMBERHOLD_OBSTACLES } from './emberhold-obstacles.js';
import { GREENMIRE_OBSTACLES } from './greenmire-obstacles.js';

export const TILES = {
  GRASS: 0, PATH: 1, WATER: 2, TREE: 3, ROCK: 4, SAND: 5,
  FLOOR: 6, WALL: 7, BRIDGE: 8, SNOW: 9, LAVA: 10, FLOWER: 11, ASH: 12, MOSS: 13,
};
export const BLOCKING = new Set([TILES.WATER, TILES.TREE, TILES.ROCK, TILES.WALL, TILES.LAVA]);
export const HAZARD = { [TILES.LAVA]: { dps: 40, element: 'fire' } };

/** tiny deterministic PRNG (mulberry32) */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** value-noise on a grid, smooth enough for terrain masks */
function noise2d(w, h, scale, seed) {
  const r = rng(seed);
  const gw = Math.ceil(w / scale) + 2, gh = Math.ceil(h / scale) + 2;
  const g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const out = new Float32Array(w * h);
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const fx = x / scale, fy = y / scale;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = smooth(fx - x0), ty = smooth(fy - y0);
      const a = g[y0 * gw + x0], b = g[y0 * gw + x0 + 1];
      const c = g[(y0 + 1) * gw + x0], d = g[(y0 + 1) * gw + x0 + 1];
      out[y * w + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
    }
  }
  return out;
}

export const MAPS = {
  emberhold: {
    id: 'emberhold', name: 'Emberhold', nameTh: 'เอมเบอร์โฮลด์', kind: 'town',
    width: 90, height: 60, seed: 1001, safe: true, theme: 'town',
    // One painting of the walled town (assets/maps/source/emberhold3/full.png,
    // 1536x1024, 17px a tile) on the walk plan it was drawn over
    // (emberhold2/layout.png); tools/trace-town.py traces where people may
    // stand from the two. The 1x picture is the placeholder and minimap; the
    // ground drawn up close is the same picture upscaled 4x by Real-ESRGAN,
    // in 2048px tiles fetched near the camera (tools/build-town.py).
    backdrop: 'assets/maps/emberhold.webp',
    backdropTiles: { dir: 'assets/maps/emberhold/ground', size: 2048, bleed: 2, cols: 3, rows: 2, width: 6144, height: 4096 },
    walk: [[0, 0, 90, 60]],
    obstacles: EMBERHOLD_OBSTACLES,
    // the moat and the canals shimmer; no falls in town
    waterFx: { falls: [] },
    spawnPoint: [45, 35],
    // Five ways out: the castle gate at the head of the avenue, the grand
    // stair south to the fields, the two canal bridges, and the north-east
    // stair up to the lists. The north-west stair and the south-east landing
    // stay closed for now (a harbour, later).
    warps: [
      { x: 43, y: 3, w: 5, h: 1, to: 'castle', at: [23, 27], label: 'ปราสาท' },
      { x: 42, y: 58, w: 5, h: 2, to: 'greenmire', at: [44, 3], label: 'ทุ่งกรีนไมร์' },
      { x: 0, y: 29, w: 1, h: 2, to: 'ashfen', at: [72, 40], label: 'หนองเถ้า' },
      { x: 88, y: 29, w: 2, h: 2, to: 'millhaven', at: [40, 6], label: 'มิลเฮเวน' },
      { x: 75, y: 1, w: 3, h: 2, to: 'ashen_lists', at: [22, 39], label: 'ลานประลองเถ้า (PvP)' },
    ],
    // The houses, the lamp posts and the banners are part of the painting;
    // these are the same cut out of it (tools/build-town.py), drawn again over
    // whoever walks behind them.
    structures: [
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [0, 0, 760, 900], x: 17.58, y: 4.39, w: 11.13, h: 13.18, walk: true },   // nw_house
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [762, 0, 792, 708], x: 22.27, y: 17.29, w: 11.60, h: 10.37, walk: true },   // w_house
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [1556, 0, 1172, 768], x: 57.71, y: 6.45, w: 17.17, h: 11.25, walk: true },   // ne_row
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [2730, 0, 840, 768], x: 56.13, y: 17.58, w: 12.30, h: 11.25, walk: true },   // e_hall
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [0, 902, 612, 576], x: 11.43, y: 32.70, w: 8.96, h: 8.44, walk: true },   // sw_cottages
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [614, 902, 452, 808], x: 17.29, y: 39.84, w: 6.62, h: 11.84, walk: true },   // sw_house
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [1068, 902, 856, 848], x: 28.01, y: 39.84, w: 12.54, h: 12.42, walk: true },   // s_row
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [1926, 902, 480, 736], x: 51.09, y: 41.72, w: 7.03, h: 10.78, walk: true },   // s_house
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [2408, 902, 964, 1056], x: 62.99, y: 33.87, w: 14.12, h: 15.47, walk: true },   // chapel
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [0, 1960, 728, 824], x: 39.84, y: 20.62, w: 10.66, h: 12.07, walk: true },   // fountain
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [730, 1960, 392, 728], x: 84.26, y: 2.34, w: 5.74, h: 10.66, walk: true },   // e_edge
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [1124, 1960, 248, 416], x: 0.00, y: 5.16, w: 3.63, h: 6.09, walk: true },   // w_edge
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [1374, 1960, 104, 348], x: 39.43, y: 6.15, w: 1.52, h: 5.10, walk: true },   // post0
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [1480, 1960, 104, 348], x: 49.10, y: 6.15, w: 1.52, h: 5.10, walk: true },   // post1
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [1586, 1960, 104, 328], x: 39.55, y: 13.01, w: 1.52, h: 4.80, walk: true },   // post2
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [1692, 1960, 104, 328], x: 48.34, y: 13.01, w: 1.52, h: 4.80, walk: true },   // post3
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [1798, 1960, 104, 228], x: 40.72, y: 2.64, w: 1.52, h: 3.34, walk: true },   // post4
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [1904, 1960, 104, 228], x: 47.29, y: 2.64, w: 1.52, h: 3.34, walk: true },   // post5
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [2010, 1960, 104, 368], x: 35.16, y: 26.66, w: 1.52, h: 5.39, walk: true },   // post6
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [2116, 1960, 104, 368], x: 53.44, y: 26.66, w: 1.52, h: 5.39, walk: true },   // post7
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [2222, 1960, 104, 208], x: 35.10, y: 33.69, w: 1.52, h: 3.05, walk: true },   // post8
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [2328, 1960, 104, 208], x: 53.44, y: 33.69, w: 1.52, h: 3.05, walk: true },   // post9
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [2434, 1960, 104, 328], x: 40.08, y: 37.03, w: 1.52, h: 4.80, walk: true },   // post10
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [2540, 1960, 104, 328], x: 48.52, y: 37.03, w: 1.52, h: 4.80, walk: true },   // post11
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [2646, 1960, 104, 348], x: 41.19, y: 48.81, w: 1.52, h: 5.10, walk: true },   // post12
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [2752, 1960, 104, 348], x: 47.29, y: 48.81, w: 1.52, h: 5.10, walk: true },   // post13
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [2858, 1960, 104, 308], x: 39.43, y: 55.37, w: 1.52, h: 4.51, walk: true },   // post14
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [2964, 1960, 104, 308], x: 49.04, y: 55.37, w: 1.52, h: 4.51, walk: true },   // post15
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [3070, 1960, 104, 308], x: 49.10, y: 44.36, w: 1.52, h: 4.51, walk: true },   // post16
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [3176, 1960, 104, 288], x: 39.55, y: 53.03, w: 1.52, h: 4.22, walk: true },   // post17
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [3282, 1960, 104, 288], x: 48.93, y: 53.03, w: 1.52, h: 4.22, walk: true },   // post18
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [3388, 1960, 104, 268], x: 11.72, y: 17.99, w: 1.52, h: 3.93, walk: true },   // post19
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [3494, 1960, 104, 368], x: 11.37, y: 22.27, w: 1.52, h: 5.39, walk: true },   // post20
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [3600, 1960, 104, 308], x: 11.72, y: 27.36, w: 1.52, h: 4.51, walk: true },   // post21
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [3706, 1960, 104, 308], x: 18.34, y: 17.40, w: 1.52, h: 4.51, walk: true },   // post22
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [3812, 1960, 104, 328], x: 18.34, y: 23.91, w: 1.52, h: 4.80, walk: true },   // post23
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [3918, 1960, 104, 208], x: 18.46, y: 30.47, w: 1.52, h: 3.05, walk: true },   // post24
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [0, 2786, 104, 308], x: 11.07, y: 2.29, w: 1.52, h: 4.51, walk: true },   // post25
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [106, 2786, 104, 248], x: 16.58, y: 1.88, w: 1.52, h: 3.63, walk: true },   // post26
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [212, 2786, 104, 328], x: 29.47, y: 4.98, w: 1.52, h: 4.80, walk: true },   // post27
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [318, 2786, 104, 348], x: 30.76, y: 9.20, w: 1.52, h: 5.10, walk: true },   // post28
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [424, 2786, 104, 308], x: 70.14, y: 17.99, w: 1.52, h: 4.51, walk: true },   // post29
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [530, 2786, 104, 388], x: 72.19, y: 23.26, w: 1.52, h: 5.68, walk: true },   // post30
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [636, 2786, 104, 428], x: 79.98, y: 15.06, w: 1.52, h: 6.27, walk: true },   // post31
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [742, 2786, 104, 288], x: 78.75, y: 2.34, w: 1.52, h: 4.22, walk: true },   // post32
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [848, 2786, 104, 248], x: 73.36, y: 3.22, w: 1.52, h: 3.63, walk: true },   // post33
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [954, 2786, 104, 228], x: 0.00, y: 33.11, w: 1.52, h: 3.34, walk: true },   // post34
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [1060, 2786, 104, 248], x: 7.15, y: 31.76, w: 1.52, h: 3.63, walk: true },   // post35
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [1166, 2786, 104, 248], x: 74.53, y: 31.17, w: 1.52, h: 3.63, walk: true },   // post36
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [1272, 2786, 104, 248], x: 81.39, y: 31.17, w: 1.52, h: 3.63, walk: true },   // post37
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [1378, 2786, 104, 368], x: 68.44, y: 51.86, w: 1.52, h: 5.39, walk: true },   // post38
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [1484, 2786, 104, 168], x: 68.38, y: 57.54, w: 1.52, h: 2.46, walk: true },   // post39
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [1590, 2786, 104, 188], x: 18.52, y: 51.74, w: 1.52, h: 2.75, walk: true },   // post40
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [1696, 2786, 104, 188], x: 31.88, y: 50.98, w: 1.52, h: 2.75, walk: true },   // post41
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [1802, 2786, 104, 248], x: 85.37, y: 14.36, w: 1.52, h: 3.63, walk: true },   // post42
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [1908, 2786, 104, 288], x: 78.46, y: 22.27, w: 1.52, h: 4.22, walk: true },   // post43
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [2014, 2786, 104, 228], x: 8.73, y: 4.98, w: 1.52, h: 3.34, walk: true },   // post44
      { kind: 'decor', img: 'assets/maps/emberhold/roofs.webp', crop: [2120, 2786, 104, 208], x: 9.79, y: 8.09, w: 1.52, h: 3.05, walk: true },   // post45
    ],
    npcs: [
      { id: 'smith', name: 'ช่างตีเหล็กบอร์ก', role: 'smith', x: 31, y: 17, look: { anim: 'blacksmith' } },
      { id: 'apothecary', name: 'แม่ค้าโรซ่า', role: 'shop', x: 28, y: 28, shop: 'apothecary', look: { anim: 'potion' } },
      { id: 'weaponer', name: 'พ่อค้าอาวุธเรนัลด์', role: 'shop', x: 66, y: 34, shop: 'smith', look: { anim: 'weapon' } },
      { id: 'vendor', name: 'พ่อค้าเมล', role: 'shop', x: 64, y: 19, shop: 'general', look: { pic: 'alchemist' } },
      { id: 'banker', name: 'ผู้ดูแลคลังลีน่า', role: 'storage', x: 62, y: 29, look: { pic: 'dwarf' } },
      { id: 'healer', name: 'นักบวชอีริน', role: 'healer', x: 69, y: 49, look: { pic: 'nun' } },
      { id: 'broker', name: 'นายหน้าคาสเซล', role: 'market', x: 26, y: 30, look: { pic: 'peddler' } },
      { id: 'oracle', name: 'ผู้ดูแลศาลรุ่งอรุณ', role: 'gacha', x: 52, y: 26, look: { pic: 'shrinemaiden' } },
      { id: 'board', name: 'กระดานภารกิจ', role: 'quests', x: 38, y: 28, look: { pic: 'postman' } },
      { id: 'warper', name: 'นักเดินทางวิน', role: 'warp', x: 52, y: 34, look: { pic: 'wizard' } },
      { id: 'guide', name: 'ครูฝึกฮาลด์', role: 'trainer', x: 41, y: 8, look: { pic: 'knight' } },
    ],
    // people out and about; they wander near home and stop to rest
    walkers: [
      { name: 'ชาวนาทอม', pic: 'farmer', x: 20, y: 30, range: 5 },
      { name: 'หนูมีมี่', pic: 'bunnygirl', x: 55, y: 30, range: 5 },
      { name: 'เนโกะ', pic: 'catgirl', x: 36, y: 31, range: 4 },
      { name: 'นักเดินทางคาอิ', pic: 'traveller', x: 70, y: 30, range: 5 },
      { name: 'พ่อครัวบิน', pic: 'chef', x: 45, y: 15, range: 4 },
    ],
    spawns: [],
  },

  castle: {
    id: 'castle', name: 'Emberhold Castle', nameTh: 'ปราสาทเอมเบอร์โฮลด์', kind: 'town',
    width: 48, height: 32, seed: 1002, safe: true, theme: 'hall',
    // The throne hall, one painting (assets/maps/source/castle/hall.png) at a
    // world px a pixel. castle.webp is that painting with the dressing cut
    // from the decor sheet packed underneath (tools/build-castle.py); the
    // floor is drawn from its top and each piece from its `crop`.
    backdrop: 'assets/maps/castle.webp',
    walk: [
      [5, 6, 38, 18],                                   // the hall floor
      [22, 24, 4, 8],                                   // the steps down to the door
      [22, 4, 4, 2],                                    // the steps up to the throne
    ],
    block: [
      [16, 8, 5, 5], [27, 8, 5, 5], [16, 16, 5, 6], [27, 16, 5, 6],   // the four banner pillars and their candles
      [17, 6, 2, 1], [29, 6, 2, 1],                                   // the armour either side of the throne
      [5, 6, 1, 1], [42, 6, 1, 1], [5, 22, 1, 2], [42, 22, 1, 2],     // the potted trees in the corners
      [6, 6, 4, 2], [6, 21, 4, 3], [38, 6, 5, 2],                     // spear rack, sword table, bookcase
      [6, 12, 2, 2], [13, 12, 2, 2],                                  // the blue flames
      [20, 22, 2, 2], [26, 22, 2, 2],                                 // the braziers by the door
    ],
    spawnPoint: [23, 27],
    warps: [
      { x: 22, y: 30, w: 4, h: 2, to: 'emberhold', at: [45, 6], label: 'ออกสู่เมือง' },
    ],
    // Not much: the hall is the picture. The west wing is where a path is
    // chosen (arms on the walls, the blue fire of the oath), the east wing
    // is the royal library with the quests of the crown, and two braziers
    // light the door. Every piece stands on footing blocked above.
    structures: [
      { kind: 'decor', img: 'assets/maps/castle.webp', crop: [370, 1024, 141, 158], x: 8.3, y: 12.22, w: 4.41, h: 4.94, flat: true, walk: true },
      { kind: 'decor', img: 'assets/maps/castle.webp', crop: [515, 1024, 149, 84], x: 35.17, y: 13.38, w: 4.66, h: 2.63, flat: true, walk: true },
      { kind: 'decor', img: 'assets/maps/castle.webp', crop: [0, 1024, 102, 96], x: 6.22, y: 4.81, w: 3.19, h: 3.0, walk: true },
      { kind: 'decor', img: 'assets/maps/castle.webp', crop: [106, 1024, 132, 98], x: 5.91, y: 21.0, w: 4.13, h: 3.06, walk: true },
      { kind: 'decor', img: 'assets/maps/castle.webp', crop: [242, 1024, 124, 82], x: 38.37, y: 5.25, w: 3.88, h: 2.56, walk: true },
      { kind: 'flame', flame: 'blue', x: 6.62, y: 10.94, w: 1.52, h: 2.81, walk: true },
      { kind: 'flame', flame: 'blue', x: 13.24, y: 10.94, w: 1.52, h: 2.81, walk: true },
      { kind: 'flame', flame: 'brazier', x: 20.52, y: 21.72, w: 1.47, h: 2.5, walk: true },
      { kind: 'flame', flame: 'brazier', x: 26.02, y: 21.72, w: 1.47, h: 2.5, walk: true },
    ],
    npcs: [
      { id: 'princess', name: 'เจ้าหญิงเซเลน่า', role: 'townsfolk', x: 23, y: 5, look: { pic: 'princess' } },
      { id: 'royal_trainer', name: 'ปรมาจารย์ออลริค', role: 'trainer', x: 10, y: 14, look: { pic: 'knight' } },
      { id: 'royal_board', name: 'บรรณารักษ์หลวงเอลวิน', role: 'quests', x: 37, y: 14, look: { pic: 'wizard' } },
    ],
    spawns: [],
  },

  millhaven: {
    id: 'millhaven', name: 'Millhaven', nameTh: 'มิลเฮเวน', kind: 'town',
    width: 80, height: 64, seed: 1002, safe: true, theme: 'town', levelRange: [1, 20],
    spawnPoint: [40, 32],
    warps: [
      { x: 40, y: 61, w: 4, h: 2, to: 'greenmire', at: [87, 7], label: 'ทุ่งกรีนไมร์' },
      { x: 76, y: 32, w: 2, h: 4, to: 'ashfen', at: [8, 32], label: 'หนองเถ้า' },
      { x: 2, y: 32, w: 2, h: 4, to: 'ravenholm', at: [4, 36], label: 'เรเวนโฮล์ม' },
      { x: 38, y: 2, w: 4, h: 2, to: 'emberhold', at: [86, 30], label: 'เอมเบอร์โฮลด์' },
    ],
    npcs: [
      // North district (Merchant area)
      { id: 'merchant', name: 'ผู้ค้าร็อก', role: 'vendor', x: 20, y: 14, shop: 'general', look: { pic: 'grocer' } },
      { id: 'mh_smith', name: 'ช่างตีเหล็กกอร์ด', role: 'smith', x: 60, y: 14, look: { pic: 'blacksmith' } },
      // Central plaza (Services)
      { id: 'mh_healer', name: 'พยาบาลแมร์', role: 'healer', x: 40, y: 24, look: { pic: 'florist' } },
      { id: 'mh_trainer', name: 'มาสเตอร์ ยูเร', role: 'trainer', x: 40, y: 18, look: { pic: 'ranger' } },
      { id: 'mh_banker', name: 'คำนายตัง', role: 'banker', x: 40, y: 40, look: { pic: 'grandma' } },
      { id: 'mh_board', name: 'กระดานภารกิจ', role: 'board', x: 36, y: 28, look: { pic: 'postman' } },
      { id: 'mh_warper', name: 'นักท่องเที่ยวเลิน', role: 'warper', x: 44, y: 28, look: { pic: 'traveller' } },
      { id: 'mh_broker', name: 'นายหน้าวิลเลียม', role: 'broker', x: 20, y: 50, look: { pic: 'catgirl' } },
    ],
    spawns: [],
    structures: [
      // North zone: merchant & blacksmith
      { kind: 'house', x: 12, y: 8, w: 8, h: 5, roof: '#8c4a3a', sign: 'ร้านค้า' },
      { kind: 'house', x: 56, y: 8, w: 8, h: 5, roof: '#6d4a3a', sign: 'โรงตีเหล็ก' },
      // Central zone: services
      { kind: 'house', x: 32, y: 6, w: 6, h: 4, roof: '#5a6a8c', sign: 'ศาลาฝึก' },
      { kind: 'house', x: 32, y: 36, w: 6, h: 4, roof: '#4a7a6a', sign: 'คลัง' },
      { kind: 'house', x: 44, y: 36, w: 6, h: 4, roof: '#7a6a4a', sign: 'ตลาด' },
      // South zone: inns & guild
      { kind: 'house', x: 12, y: 44, w: 7, h: 5, roof: '#8c7a3a', sign: 'โรงแรม' },
      { kind: 'house', x: 56, y: 44, w: 7, h: 5, roof: '#6a5a8c', sign: 'สมาคม' },
      // Stalls & decorative
      { kind: 'stall', x: 28, y: 24, w: 3, h: 2, variant: 0 },
      { kind: 'stall', x: 48, y: 24, w: 3, h: 2, variant: 1 },
      { kind: 'stall', x: 20, y: 32, w: 3, h: 2, variant: 2 },
      { kind: 'stall', x: 57, y: 32, w: 3, h: 2, variant: 3 },
      // Central fountain
      { kind: 'fountain', x: 37, y: 26, w: 6, h: 6 },
      // Water feature: river running through
      { kind: 'fountain', x: 5, y: 20, w: 3, h: 3 },
      { kind: 'fountain', x: 72, y: 44, w: 4, h: 4 },
    ],
    decor: [
      // Lantern rings around plaza and zones
      ['lamp', 32, 20], ['lamp', 48, 20], ['lamp', 32, 36], ['lamp', 48, 36],
      ['lamp', 14, 14], ['lamp', 66, 14], ['lamp', 14, 50], ['lamp', 66, 50],
      // Benches around plaza
      ['bench', 35, 22], ['bench', 45, 22], ['bench', 35, 38], ['bench', 45, 38],
      // Planters scattered
      ['planter', 38, 16], ['planter', 42, 16], ['planter', 40, 44],
      ['planter', 20, 30], ['planter', 60, 30],
      // Market clutter: barrels, crates, sacks
      ['barrel', 18, 14], ['barrel', 62, 14], ['crate', 22, 12], ['crate', 64, 12],
      ['sack', 20, 16], ['sack', 66, 18], ['cart', 16, 50], ['cart', 64, 50],
      ['barrel', 18, 50], ['barrel', 68, 50], ['crate', 14, 48], ['crate', 70, 48],
      // Signs and banners at entry points
      ['banner', 35, 60], ['banner', 45, 60], ['sign', 2, 32], ['sign', 78, 32],
      ['sign', 40, 10], ['banner', 14, 40], ['banner', 66, 40],
      // Well features
      ['well', 10, 22], ['well', 70, 46],
      // Trees framing edges (sparse)
      ['tree', 8, 10], ['tree', 72, 10], ['tree', 8, 54], ['tree', 72, 54],
    ],
  },

  ravenholm: {
    id: 'ravenholm', name: 'Ravenholm', nameTh: 'เรเวนโฮล์ม', kind: 'town',
    width: 88, height: 72, seed: 1003, safe: true, theme: 'town', levelRange: [25, 50],
    spawnPoint: [44, 36],
    warps: [
      { x: 44, y: 69, w: 4, h: 2, to: 'ashfen', at: [40, 8], label: 'หนองเถ้า' },
      { x: 84, y: 36, w: 2, h: 4, to: 'gravebound', at: [12, 36], label: 'สุสานกราฟบาวด์' },
      { x: 2, y: 36, w: 2, h: 4, to: 'millhaven', at: [4, 32], label: 'มิลเฮเวน' },
      { x: 44, y: 4, w: 4, h: 2, to: 'orcwatch', at: [44, 12], label: 'สันเขาออร์ควอช' },
    ],
    npcs: [
      // North district: High-end shops
      { id: 'rh_vendor', name: 'ผู้ค้าเมืองอลฮัลลา', role: 'vendor', x: 24, y: 16, shop: 'general', look: { pic: 'chef' } },
      { id: 'rh_smith', name: 'หลักแรงแห่งเรเวนโฮล์ม', role: 'smith', x: 64, y: 16, look: { pic: 'dwarf' } },
      // Central North: Training & jobs
      { id: 'rh_trainer', name: 'คุณพ่อแก่วยืนกราน', role: 'trainer', x: 44, y: 12, look: { pic: 'swordmaiden' } },
      // Central plaza: Services
      { id: 'rh_healer', name: 'บาทหลวงอิเรน', role: 'healer', x: 24, y: 36, look: { pic: 'maid' } },
      { id: 'rh_banker', name: 'ผู้เฝ้าธนคลังแองเชล', role: 'banker', x: 64, y: 36, look: { pic: 'panda' } },
      { id: 'rh_board', name: 'กระดานภารกิจหลัก', role: 'board', x: 35, y: 32, look: { pic: 'postman' } },
      { id: 'rh_warper', name: 'พ่อค้ารถบัสเสน', role: 'warper', x: 48, y: 32, look: { pic: 'witch' } },
      // East: Guild & broker
      { id: 'rh_broker', name: 'สำนักนายหน้าตรึนดัล', role: 'broker', x: 75, y: 37, look: { pic: 'rogue' } },
      // South district: Oracle & premium services
      { id: 'rh_oracle', name: 'สูตรนางกายา', role: 'oracle', x: 20, y: 56, look: { pic: 'princess' } },
    ],
    spawns: [],
    structures: [
      // North zone: High-end merchant & blacksmith
      { kind: 'house', x: 8, y: 8, w: 10, h: 6, roof: '#8c4a3a', sign: 'บ้านค้าหลัก' },
      { kind: 'house', x: 56, y: 8, w: 10, h: 6, roof: '#6d4a3a', sign: 'โรงเชื่อมแชมเบอร์' },
      // Central north: Training temple
      { kind: 'house', x: 36, y: 4, w: 8, h: 5, roof: '#5a6a8c', sign: 'วิหารสงคราม' },
      // Central: Service buildings
      { kind: 'house', x: 8, y: 30, w: 10, h: 7, roof: '#4a7a6a', sign: 'ศาสตร์สงคราม' },
      { kind: 'house', x: 70, y: 30, w: 10, h: 7, roof: '#7a6a4a', sign: 'สมาคมพ่อค้า' },
      // South zone: Guild hall & Oracle shrine
      { kind: 'house', x: 8, y: 50, w: 12, h: 7, roof: '#8c7a3a', sign: 'สมาคมสามัญ' },
      { kind: 'house', x: 68, y: 50, w: 12, h: 7, roof: '#6a5a8c', sign: 'ศาลรุ่งอรุณ' },
      // Marketplace stalls: Three rows
      { kind: 'stall', x: 30, y: 24, w: 4, h: 2, variant: 0 },
      { kind: 'stall', x: 54, y: 24, w: 4, h: 2, variant: 1 },
      { kind: 'stall', x: 30, y: 44, w: 4, h: 2, variant: 2 },
      { kind: 'stall', x: 54, y: 44, w: 4, h: 2, variant: 3 },
      // Central fountain plaza
      { kind: 'fountain', x: 38, y: 28, w: 8, h: 8 },
      // Water features: Twin ponds
      { kind: 'fountain', x: 14, y: 20, w: 4, h: 4 },
      { kind: 'fountain', x: 70, y: 20, w: 4, h: 4 },
    ],
    decor: [
      // Grand lantern setup: Inner circle
      ['lamp', 36, 24], ['lamp', 52, 24], ['lamp', 36, 44], ['lamp', 52, 44],
      // Outer lantern ring
      ['lamp', 18, 16], ['lamp', 70, 16], ['lamp', 18, 56], ['lamp', 70, 56],
      // Zone markers
      ['lamp', 14, 36], ['lamp', 74, 36],
      // Benches at plazas
      ['bench', 34, 20], ['bench', 54, 20], ['bench', 34, 48], ['bench', 54, 48],
      ['bench', 40, 28], ['bench', 48, 28], ['bench', 40, 44], ['bench', 48, 44],
      // Planters: abundant greenery
      ['planter', 42, 12], ['planter', 46, 12], ['planter', 40, 52], ['planter', 48, 52],
      ['planter', 20, 24], ['planter', 68, 24], ['planter', 20, 48], ['planter', 68, 48],
      // Market scene: chaos of commerce
      ['barrel', 16, 16], ['barrel', 72, 16], ['barrel', 16, 56], ['barrel', 72, 56],
      ['crate', 20, 14], ['crate', 76, 14], ['crate', 20, 58], ['crate', 76, 58],
      ['sack', 14, 20], ['sack', 74, 20], ['sack', 14, 52], ['sack', 74, 52],
      ['cart', 12, 36], ['cart', 76, 36], ['awning', 32, 28], ['awning', 56, 28],
      // Signage at main entrances
      ['banner', 40, 62], ['banner', 48, 62], ['sign', 2, 36], ['sign', 86, 36],
      ['banner', 40, 2], ['sign', 44, 68],
      // Wells as gathering points
      ['well', 20, 28], ['well', 68, 28], ['well', 44, 16],
      // Trees framing perimeter
      ['tree', 6, 12], ['tree', 82, 12], ['tree', 6, 60], ['tree', 82, 60],
      ['bush', 10, 8], ['bush', 78, 8], ['bush', 10, 64], ['bush', 78, 64],
    ],
  },

  greenmire: {
    id: 'greenmire', name: 'Greenmire Flats', nameTh: 'ทุ่งกรีนไมร์', kind: 'field',
    width: 90, height: 60, seed: 2002, theme: 'grass', levelRange: [1, 10],
    // One painting stitched from the full map and five close-ups
    // (tools/stitch-greenmire.py, 2928x1952, 32.5px a tile): meadows and dirt
    // paths between wooded ledges and rivers, a hill ringed by cliffs in the
    // north and an island of old ruins in the south. Where a character may
    // stand is traced off it by tools/trace-field.py into greenmire-obstacles.js.
    backdrop: 'assets/maps/greenmire.webp',
    backdropTiles: { dir: 'assets/maps/greenmire/ground', size: 1464, tileW: 1464, tileH: 1952, bleed: 2, cols: 2, rows: 1, width: 2928, height: 1952 },
    // its rivers set moving (client/js/ambient.js): the water is read off the
    // painting's blue, and the falls, in tiles, are where the painting pours
    waterFx: {
      falls: [
        { x: 11.1, y: 0.4, w: 1.8, h: 3.3 },    // the north-west falls
        { x: 14.1, y: 1.0, w: 0.9, h: 2.4 },    // and the thin one beside them
        { x: 73.4, y: 0.3, w: 1.8, h: 3.4 },    // the north-east falls
        { x: 26.1, y: 40.3, w: 2.3, h: 3.7, bubbles: false },   // by the west bridge to the ruins
        { x: 66.7, y: 42.8, w: 2.0, h: 4.0 },   // east of the ruins
      ],
    },
    walk: [[0, 0, 90, 60]],
    obstacles: GREENMIRE_OBSTACLES,
    spawnPoint: [44, 4],
    // Three of the painted gates: the town road comes in at the north stairs,
    // Millhaven's at the north-east stairs, and the way on to the harder marsh
    // is the south gate below the ruins, so a new player crosses the whole
    // field first. The north-west stairs stay closed.
    warps: [
      { x: 43, y: 0, w: 3, h: 1, to: 'emberhold', at: [45, 55], label: 'เอมเบอร์โฮลด์' },  // the north stairs
      { x: 88, y: 2, w: 2, h: 2, to: 'millhaven', at: [40, 59], label: 'มิลเฮเวน' },        // the north-east stairs
      { x: 44, y: 58, w: 3, h: 2, to: 'ashfen', at: [5, 32], label: 'หนองเถ้า' },          // the south gate
    ],
    // Rings, harder toward the middle and the south: slimes (Lv1) on the
    // meadows by the two northern gates, mushrooms (Lv3) and caterpillars
    // (Lv4) down both flanks, bees (Lv5, the only ones that start a fight)
    // on the crossroads under the hill, boars (Lv6) on the lower flanks and
    // forest spirits (Lv8) along the south road to the marsh gate. The two
    // bosses hold the middle: the Alpha Wolf the hilltop, reached only by
    // its stairs, and the Tree Guardian the ruins island between its two
    // bridges. The gate meadows stay quiet.
    spawns: [
      { mob: 'blue_slime', count: 4, area: [25, 5, 12, 6] },     // west of the north stairs
      { mob: 'blue_slime', count: 4, area: [50, 6, 10, 5] },     // east of the north stairs
      { mob: 'blue_slime', count: 5, area: [4, 8, 12, 6] },      // the north-west meadow
      { mob: 'blue_slime', count: 4, area: [60, 9, 12, 7] },     // the north-east meadow
      { mob: 'blue_slime', count: 3, area: [80, 12, 9, 7] },     // below Millhaven's stairs
      { mob: 'mushroom', count: 4, area: [2, 14, 16, 12] },      // the west flank
      { mob: 'caterpillar', count: 2, area: [2, 14, 16, 12] },
      { mob: 'mushroom', count: 3, area: [24, 13, 12, 12] },     // between the river and the hill
      { mob: 'blue_slime', count: 2, area: [24, 13, 12, 12] },
      { mob: 'mushroom', count: 3, area: [58, 15, 14, 12] },     // the east flank
      { mob: 'caterpillar', count: 3, area: [58, 15, 14, 12] },
      { mob: 'caterpillar', count: 2, area: [81, 23, 9, 8] },    // across the east river
      { mob: 'mushroom', count: 1, area: [81, 23, 9, 8] },
      { mob: 'forest_bee', count: 3, area: [25, 24, 16, 8] },    // the crossroads under the hill
      { mob: 'caterpillar', count: 2, area: [25, 24, 16, 8] },
      { mob: 'forest_bee', count: 3, area: [50, 27, 16, 8] },
      { mob: 'mushroom', count: 2, area: [50, 27, 16, 8] },
      { mob: 'wild_boar', count: 3, area: [3, 31, 14, 12] },     // the lower west flank
      { mob: 'forest_bee', count: 2, area: [3, 31, 14, 12] },
      { mob: 'wild_boar', count: 3, area: [68, 31, 12, 10] },    // the lower east flank
      { mob: 'wild_boar', count: 2, area: [4, 44, 20, 8] },      // the south-west woods
      { mob: 'forest_spirit', count: 2, area: [4, 44, 20, 8] },
      { mob: 'forest_spirit', count: 3, area: [63, 44, 20, 10] }, // the south-east woods
      { mob: 'wild_boar', count: 2, area: [63, 44, 20, 10] },
      { mob: 'forest_spirit', count: 3, area: [16, 52, 24, 6] },  // the south road, both sides of the gate
      { mob: 'forest_spirit', count: 3, area: [52, 53, 24, 5] },
      { mob: 'alpha_wolf', count: 1, area: [42, 14, 12, 6] },     // the mini boss, on the hilltop
      { mob: 'tree_guardian', count: 1, area: [43, 42, 7, 5] },   // the boss, on the ruins island
    ],
  },

  ashfen: {
    id: 'ashfen', name: 'Ashfen Marsh', nameTh: 'หนองเถ้า', kind: 'field',
    width: 80, height: 64, seed: 3003, theme: 'marsh', levelRange: [10, 22],
    spawnPoint: [8, 32],
    warps: [
      { x: 2, y: 30, w: 2, h: 4, to: 'greenmire', at: [45, 56], label: 'ทุ่งกรีนไมร์' },
      { x: 76, y: 38, w: 2, h: 4, to: 'emberhold', at: [3, 30], label: 'เอมเบอร์โฮลด์' },
      { x: 40, y: 60, w: 4, h: 2, to: 'gravebound', at: [30, 6], label: 'สุสานกราฟบาวด์' },
    ],
    spawns: [],
  },

  gravebound: {
    id: 'gravebound', name: 'Gravebound Hollow', nameTh: 'สุสานกราฟบาวด์', kind: 'cave',
    width: 72, height: 72, seed: 4004, theme: 'crypt', levelRange: [18, 32],
    spawnPoint: [30, 6],
    warps: [
      { x: 28, y: 2, w: 4, h: 2, to: 'ashfen', at: [40, 56], label: 'หนองเถ้า' },
      { x: 60, y: 64, w: 4, h: 2, to: 'orcwatch', at: [8, 8], label: 'สันเขาออร์ควอช' },
    ],
    spawns: [],
  },

  orcwatch: {
    id: 'orcwatch', name: 'Orcwatch Ridge', nameTh: 'สันเขาออร์ควอช', kind: 'field',
    width: 88, height: 72, seed: 5005, theme: 'rock', levelRange: [26, 45],
    spawnPoint: [8, 8],
    warps: [
      { x: 4, y: 4, w: 4, h: 2, to: 'gravebound', at: [60, 60], label: 'สุสานกราฟบาวด์' },
      { x: 82, y: 60, w: 4, h: 4, to: 'frostvault', at: [14, 14], label: 'ห้องนิรภัยเยือกแข็ง' },
    ],
    spawns: [],
  },

  frostvault: {
    id: 'frostvault', name: 'Frostvault Depths', nameTh: 'ห้องนิรภัยเยือกแข็ง', kind: 'cave',
    width: 80, height: 80, seed: 6006, theme: 'ice', levelRange: [40, 60],
    spawnPoint: [14, 14],
    warps: [
      { x: 6, y: 6, w: 4, h: 4, to: 'orcwatch', at: [78, 58], label: 'สันเขาออร์ควอช' },
      { x: 70, y: 70, w: 4, h: 4, to: 'vhaal', at: [24, 41], label: 'ห้องบัลลังก์วาล' },
      { x: 8, y: 70, w: 4, h: 4, to: 'reliquary1', at: [9, 24], label: 'หีบศพจม (ปาร์ตี้ 2 คน)' },
    ],
    spawns: [],
  },

  /* ---------------- The Sunken Reliquary: a party dungeon, three floors ----
     Hand-drawn rather than generated. Corridors are two tiles wide so a
     party moves in file and the person in front is the person who gets hit,
     and every hall has pillars: cover to break line of sight, and something
     the monsters' pathfinding has to actually solve. */
  reliquary1: {
    id: 'reliquary1', name: 'Sunken Reliquary - Cloister', nameTh: 'หีบศพจม - ระเบียงคด',
    kind: 'dungeon', width: 64, height: 48, seed: 8001, theme: 'crypt', levelRange: [60, 70],
    party: 2,                       // the door will not open for fewer
    spawnPoint: [9, 24],
    warps: [
      { x: 4, y: 22, w: 3, h: 4, to: 'frostvault', at: [13, 71], label: 'ห้องนิรภัยเยือกแข็ง' },
      { x: 58, y: 22, w: 3, h: 4, to: 'reliquary2', at: [9, 30], label: 'ชั้นสอง — ห้องสวด' },
    ],
    rooms: [
      { x: 3, y: 20, w: 9, h: 9 },                       // entry
      { x: 18, y: 8, w: 16, h: 14, pillars: 4 },         // north hall
      { x: 18, y: 28, w: 16, h: 14, pillars: 4 },        // south hall
      { x: 40, y: 18, w: 18, h: 14, pillars: 5 },        // west approach
    ],
    halls: [
      { from: [12, 23], to: [18, 13] },
      { from: [12, 24], to: [18, 33] },
      { from: [33, 14], to: [40, 23] },
      { from: [33, 34], to: [40, 25] },
      { from: [25, 21], to: [25, 29], vfirst: true },    // a shortcut between halls
    ],
    spawns: [],
  },
  reliquary2: {
    id: 'reliquary2', name: 'Sunken Reliquary - Choir', nameTh: 'หีบศพจม - ห้องสวด',
    kind: 'dungeon', width: 64, height: 64, seed: 8002, theme: 'crypt', levelRange: [62, 70],
    party: 2,
    spawnPoint: [9, 30],
    warps: [
      { x: 4, y: 28, w: 3, h: 4, to: 'reliquary1', at: [55, 24], label: 'ชั้นหนึ่ง — ระเบียงคด' },
      { x: 57, y: 30, w: 3, h: 4, to: 'reliquary3', at: [26, 52], label: 'ชั้นสาม — ห้องหีบ' },
    ],
    rooms: [
      { x: 4, y: 26, w: 8, h: 9 },
      { x: 16, y: 6, w: 14, h: 12, pillars: 4 },
      { x: 16, y: 44, w: 14, h: 14, pillars: 4 },
      { x: 24, y: 24, w: 18, h: 14, pillars: 6 },        // the long room, most of the fight
      { x: 46, y: 26, w: 12, h: 12, pillars: 4 },
    ],
    halls: [
      { from: [12, 29], to: [24, 29] },
      { from: [22, 17], to: [30, 25], vfirst: true },
      { from: [22, 43], to: [30, 36], vfirst: true },
      { from: [41, 30], to: [46, 30] },
      { from: [52, 37], to: [52, 44], vfirst: true },
      { from: [30, 44], to: [52, 44] },
    ],
    hazards: [
      { x: 33, y: 29, w: 4, h: 4, tile: 'LAVA' },        // the brazier pit in the middle
    ],
    spawns: [],
  },
  reliquary3: {
    id: 'reliquary3', name: 'Sunken Reliquary - Vault', nameTh: 'หีบศพจม - ห้องหีบ',
    kind: 'dungeon', width: 52, height: 60, seed: 8003, theme: 'crypt', levelRange: [64, 70],
    party: 2,
    spawnPoint: [26, 52],
    warps: [
      { x: 24, y: 55, w: 4, h: 3, to: 'reliquary2', at: [54, 31], label: 'ชั้นสอง — ห้องสวด' },
    ],
    rooms: [
      { x: 22, y: 50, w: 8, h: 8 },                      // the way in
      { x: 10, y: 10, w: 32, h: 32, pillars: 8 },        // the arena: wide, four pillars
    ],
    halls: [
      { from: [25, 49], to: [25, 42], vfirst: true },
    ],
    spawns: [],
  },

  // The only ground in the world where players may swing at each other, and
  // the only way in is a door you walk through on purpose. Opting in by
  // geography rather than by a toggle means nobody is ever jumped in a field
  // they went to for experience, and the fortress the guilds contest sits
  // here, so the siege and the duelling ground are the same place.
  ashen_lists: {
    id: 'ashen_lists', name: 'The Ashen Lists', nameTh: 'ลานประลองเถ้า',
    width: 44, height: 44, seed: 4411, theme: 'ember', levelRange: [40, 70],
    pvp: true,
    spawnPoint: [22, 40],
    warps: [{ x: 20, y: 41, w: 4, h: 2, to: 'emberhold', at: [76, 5], label: 'เอมเบอร์โฮลด์' }],
    spawns: [],
  },

  vhaal: {
    id: 'vhaal', name: "Vhaal's Throne", nameTh: 'ห้องบัลลังก์วาล', kind: 'boss',
    width: 48, height: 48, seed: 7007, theme: 'crypt', levelRange: [60, 70],
    spawnPoint: [24, 44],
    warps: [{ x: 22, y: 45, w: 4, h: 2, to: 'frostvault', at: [70, 68], label: 'ห้องนิรภัยเยือกแข็ง' }],
    spawns: [],
  },
};

/**
 * Rooms joined by corridors, for maps that declare `kind: 'dungeon'`.
 *
 * The other zones are noise fields with a path carved through them, which
 * suits open country but makes a poor dungeon: noise has no doorways, and a
 * corridor you cannot see the end of is what makes a dungeon tense. These
 * are hand-placed instead - every room and every link is written down in the
 * map - so the layout is the same for everyone and the fights can be built
 * around specific corners.
 */
function buildDungeon(map) {
  const { width: w, height: h } = map;
  const T = TILES;
  const g = new Uint8Array(w * h).fill(T.WALL);

  const carveRect = (x, y, rw, rh, tile) => {
    for (let y2 = y; y2 < y + rh; y2++) {
      for (let x2 = x; x2 < x + rw; x2++) {
        if (x2 < 1 || y2 < 1 || x2 >= w - 1 || y2 >= h - 1) continue;
        g[y2 * w + x2] = tile;
      }
    }
  };

  for (const rm of map.rooms ?? []) {
    carveRect(rm.x, rm.y, rm.w, rm.h, rm.tile ?? T.FLOOR);
    // a pillar grid inside the larger halls: cover to break line of sight,
    // and something for a path to have to go around
    if (rm.pillars) {
      for (let py = rm.y + 2; py < rm.y + rm.h - 2; py += rm.pillars) {
        for (let px = rm.x + 2; px < rm.x + rm.w - 2; px += rm.pillars) {
          g[py * w + px] = T.WALL;
        }
      }
    }
  }

  // corridors: L-shaped, horizontal leg first unless told otherwise
  for (const c of map.halls ?? []) {
    const wide = c.w ?? 2;
    const [x1, y1] = c.from, [x2, y2] = c.to;
    if (c.vfirst) {
      carveRect(x1, Math.min(y1, y2), wide, Math.abs(y2 - y1) + wide, T.FLOOR);
      carveRect(Math.min(x1, x2), y2, Math.abs(x2 - x1) + wide, wide, T.FLOOR);
    } else {
      carveRect(Math.min(x1, x2), y1, Math.abs(x2 - x1) + wide, wide, T.FLOOR);
      carveRect(x2, Math.min(y1, y2), wide, Math.abs(y2 - y1) + wide, T.FLOOR);
    }
  }

  for (const hz of map.hazards ?? []) carveRect(hz.x, hz.y, hz.w, hz.h, TILES[hz.tile] ?? T.LAVA);
  return g;
}

/** Build the tile grid for a map. Same input => same output, always. */
/**
 * Lay a map out from a list of rectangles instead of noise, for places that
 * are built rather than grown. Ops run in order, later ones on top:
 *   { tile: 'FLOOR', rect: [x, y, w, h] }            fill it
 *   { tile: 'TREE', rect: [...], density: 0.6 }      scatter it, deterministically
 * Anything no op covers is grass.
 */
function paintLayout(g, map) {
  const { width: w, height: h, seed } = map;
  g.fill(TILES.GRASS);
  for (const op of map.paint) {
    const tile = TILES[op.tile];
    if (tile === undefined) throw new Error(`${map.id}: unknown tile ${op.tile}`);
    const [x0, y0, rw, rh] = op.rect ?? [0, 0, w, h];
    for (let y = Math.max(0, y0); y < Math.min(h, y0 + rh); y++) {
      for (let x = Math.max(0, x0); x < Math.min(w, x0 + rw); x++) {
        if (op.density !== undefined && hash2(x, y, seed ^ 0x3c1) >= op.density) continue;
        g[y * w + x] = tile;
      }
    }
  }
}

/**
 * A map drawn as one picture (`backdrop`) has no terrain to grow: the art is
 * the ground. What can be walked is listed by hand as rectangles over the
 * picture - streets, squares, stairs - and everything else is solid.
 */
function walkGrid(map) {
  const { width: w, height: h } = map;
  const g = new Uint8Array(w * h).fill(TILES.WALL);
  const fill = (tile, [x0, y0, rw, rh]) => {
    for (let y = Math.max(0, y0); y < Math.min(h, y0 + rh); y++) {
      for (let x = Math.max(0, x0); x < Math.min(w, x0 + rw); x++) g[y * w + x] = tile;
    }
  };
  for (const r of map.walk) fill(TILES.FLOOR, r);
  for (const r of map.block ?? []) fill(TILES.WALL, r);
  (map.obstacles ?? []).forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#' && y < h && x < w) g[y * w + x] = TILES.WALL;
  });
  return g;
}

export function buildGrid(map) {
  if (map.walk) return walkGrid(map);
  if (map.kind === 'dungeon') {
    const g = buildDungeon(map);
    // the same pads every other map gets: a warp or a spawn must be standable
    const open = (x, y, ww = 2, hh = 2) => {
      for (let y2 = y - 1; y2 < y + hh + 1; y2++) {
        for (let x2 = x - 1; x2 < x + ww + 1; x2++) {
          if (x2 <= 0 || y2 <= 0 || x2 >= map.width - 1 || y2 >= map.height - 1) continue;
          const i = y2 * map.width + x2;
          if (BLOCKING.has(g[i])) g[i] = TILES.FLOOR;
        }
      }
    };
    for (const wp of map.warps ?? []) open(wp.x, wp.y, wp.w, wp.h);
    if (map.spawnPoint) open(map.spawnPoint[0] - 2, map.spawnPoint[1] - 2, 5, 5);
    for (const sp of map.spawns ?? []) if (sp.area) open(sp.area[0], sp.area[1], sp.area[2], sp.area[3]);
    return g;
  }
  const { width: w, height: h, seed, theme } = map;
  const g = new Uint8Array(w * h);
  const r = rng(seed);
  const base = noise2d(w, h, 9, seed);
  const detail = noise2d(w, h, 3.5, seed ^ 0x9e37);

  const T = TILES;
  const ground = { town: T.GRASS, grass: T.GRASS, marsh: T.MOSS, crypt: T.FLOOR, rock: T.SAND, ice: T.SNOW }[theme] ?? T.GRASS;
  const solid = { crypt: T.WALL, ice: T.WALL, rock: T.ROCK }[theme] ?? T.TREE;

  const path = theme === 'crypt' || theme === 'ice' ? T.FLOOR : T.PATH;
  // A hand-laid map says what goes where; everything else grows from noise.
  if (map.paint) paintLayout(g, map);
  else {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const n = base[i] * 0.72 + detail[i] * 0.28;
        const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
        let t = ground;

        if (theme === 'crypt' || theme === 'ice') {
          // cave: carve rooms out of rock
          t = n > 0.45 ? T.FLOOR : T.WALL;
          if (theme === 'ice' && t === T.FLOOR && detail[i] > 0.78) t = T.WATER;
        } else {
          if (n < 0.28) t = T.WATER;
          else if (n < 0.34) t = theme === 'ice' ? T.SNOW : T.SAND;
          else if (n > 0.74) t = solid;
          else if (detail[i] > 0.88) t = T.FLOWER;
          else if (theme === 'marsh' && detail[i] < 0.16) t = T.WATER;
          else if (theme === 'rock' && detail[i] > 0.80) t = T.ROCK;
        }
        if (edge < 2) t = theme === 'crypt' || theme === 'ice' ? T.WALL : solid;
        g[i] = t;
      }
    }

    // a walkable path/plaza through the middle so zones are never bisected
    const carve = (x, y, rad, tile) => {
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1) continue;
          if (dx * dx + dy * dy > rad * rad) continue;
          g[ny * w + nx] = tile;
        }
      }
    };
    const roadWidth = map.kind === 'town' ? 2 : 0;   // fields get a thin trail, not a highway
    let cx = 2, cy = Math.floor(h / 2);
    const steps = w + h;
    for (let s = 0; s < steps; s++) {
      carve(cx, cy, roadWidth, path);
      if (r() < 0.62 && cx < w - 3) cx++;
      else cy += r() < 0.5 ? 1 : -1;
      cy = Math.max(3, Math.min(h - 4, cy));
    }
    // vertical spine
    cx = Math.floor(w / 2);
    for (let y2 = 2; y2 < h - 2; y2++) carve(cx, y2, map.kind === 'town' ? 2 : 1, path);

    if (map.kind === 'town') {
      carve(Math.floor(w / 2), Math.floor(h / 2), 11, T.FLOOR);
      // the roads keep their dirt outside the square, but the square is all stone
      const px = Math.floor(w / 2), py = Math.floor(h / 2);
      for (let y2 = py - 13; y2 <= py + 13; y2++) {
        for (let x2 = px - 13; x2 <= px + 13; x2++) {
          if (x2 < 1 || y2 < 1 || x2 >= w - 1 || y2 >= h - 1) continue;
          const d = (x2 - px) ** 2 + (y2 - py) ** 2;
          if (d <= 13 * 13 && g[y2 * w + x2] === T.PATH) g[y2 * w + x2] = T.FLOOR;
        }
      }
    }
  }

  // clear warp pads and the spawn point
  // Only open what is actually blocked: stamping a dirt pad over ground that
  // already works punched holes in the town square.
  const openTile = map.kind === 'town' ? T.FLOOR : path;
  const clear = (x, y, ww = 2, hh = 2) => {
    for (let y2 = y - 1; y2 < y + hh + 1; y2++) {
      for (let x2 = x - 1; x2 < x + ww + 1; x2++) {
        if (x2 <= 0 || y2 <= 0 || x2 >= w - 1 || y2 >= h - 1) continue;
        const i = y2 * w + x2;
        if (!BLOCKING.has(g[i])) continue;
        g[i] = openTile;
      }
    }
  };
  for (const wp of map.warps ?? []) clear(wp.x, wp.y, wp.w, wp.h);
  if (map.spawnPoint) clear(map.spawnPoint[0] - 2, map.spawnPoint[1] - 2, 5, 5);
  for (const npc of map.npcs ?? []) clear(npc.x - 1, npc.y - 1, 3, 3);
  for (const sp of map.spawns ?? []) if (sp.area) clear(sp.area[0], sp.area[1], sp.area[2], sp.area[3]);

  // buildings last: a doorway or an NPC pad must never eat a wall
  if (map.kind === 'town') {
    for (const st of map.structures ?? []) {
      if (st.walk) continue;              // dressing whose footing is in the map's own blocks
      for (let y2 = st.y; y2 < st.y + st.h; y2++) {
        for (let x2 = st.x; x2 < st.x + st.w; x2++) {
          if (x2 < 1 || y2 < 1 || x2 >= w - 1 || y2 >= h - 1) continue;
          g[y2 * w + x2] = st.kind === 'fountain' ? T.WATER : T.WALL;
        }
      }
      if (st.kind === 'house') {
        // doorway on the plaza-facing side
        const doorX = st.x + Math.floor(st.w / 2);
        const doorY = st.y < h / 2 ? st.y + st.h - 1 : st.y;
        g[doorY * w + doorX] = T.FLOOR;
      }
    }
  }

  return g;
}

/** Run-length encode a grid for the wire. */
export function encodeGrid(g) {
  const out = [];
  let run = 1;
  for (let i = 1; i <= g.length; i++) {
    if (i < g.length && g[i] === g[i - 1] && run < 65535) { run++; continue; }
    out.push(g[i - 1], run);
    run = 1;
  }
  return out;
}

export function decodeGrid(rle, size) {
  const g = new Uint8Array(size);
  let i = 0;
  for (let k = 0; k < rle.length; k += 2) {
    const v = rle[k], n = rle[k + 1];
    g.fill(v, i, i + n);
    i += n;
  }
  return g;
}

/** stable per-tile hash, so decoration is identical on every client */
export function hash2(x, y, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2654435761);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Cosmetic scenery. Generated from the map seed on both sides, so it costs
 * nothing on the wire and never affects collision.
 * `tall` props are sorted with the entities so characters walk behind them.
 */
export const PROP_SETS = {
  town:  [['barrel', 1], ['crate', 1], ['lamp', 1.2], ['bench', 0.8], ['flowerpot', 1], ['sign', 0.6], ['cart', 0.5], ['banner', 0.8]],
  grass: [['tree', 3], ['bush', 2.5], ['flowers', 2], ['stump', 0.8], ['rock', 1.2], ['mushroom', 0.8], ['grass', 3]],
  marsh: [['deadtree', 2.4], ['reeds', 3], ['ashpile', 1.6], ['bones', 1], ['mushroom', 1.4], ['rock', 1], ['grass', 1.6]],
  crypt: [['pillar', 1.4], ['grave', 1.6], ['skull', 1.4], ['rubble', 2], ['torch', 1.2], ['banner', 0.7]],
  rock:  [['boulder', 2], ['spike', 1.6], ['bones', 1.2], ['totem', 0.7], ['campfire', 0.5], ['rubble', 1.6]],
  ice:   [['iceshard', 2.4], ['crystal', 1.4], ['snowpile', 2], ['icicle', 1.6], ['bones', 0.6]],
};
export const TALL_PROPS = new Set(['tree', 'deadtree', 'pillar', 'lamp', 'totem', 'crystal', 'sign', 'banner', 'icicle', 'spike', 'well', 'awning']);

export function generateProps(map, grid) {
  const structures = (map.structures ?? []).map((st) => ({
    x: (st.x + st.w / 2) * 32,
    y: (st.y + st.h) * 32,
    kind: st.kind,
    w: st.w * 32,
    h: st.h * 32,
    roof: st.roof,
    sign: st.sign,
    variant: st.variant ?? 0,
    img: st.img,
    crop: st.crop,           // [x, y, w, h] of a picture that holds several
    flame: st.flame,         // a flame strip that plays where it stands
    scale: 1,
    flip: 0,
    // a wall is ground-level stone; sorting a long one by its foot would put
    // it over the tower standing on its end. A rug lies under everyone.
    tall: !st.flat && st.kind !== 'fountain' && st.kind !== 'rampart',
  }));
  // a tower stands on the wall, so where they share a bottom edge it goes on top
  for (const st of structures) if (st.kind === 'tower') st.y += 1;
  // hand-placed decor: exact tiles, no blocking, drawn like any other prop
  const decor = (map.decor ?? []).map(([kind, dx, dy, scale = 1, flip = 0]) => ({
    x: (dx + 0.5) * 32,
    y: (dy + 1) * 32,
    kind, scale, flip,
    tall: TALL_PROPS.has(kind),
  }));

  const set = PROP_SETS[map.theme] ?? PROP_SETS.grass;
  const total = set.reduce((n, [, w]) => n + w, 0);
  // a laid-out map is dressed by hand; scattering clutter over it undoes that
  const density = map.paint ? 0 : map.kind === 'town' ? 0.07 : 0.17;
  const props = [];
  for (let y = 1; y < map.height - 1; y++) {
    for (let x = 1; x < map.width - 1; x++) {
      const t = grid[y * map.width + x];
      if (BLOCKING.has(t) || t === TILES.PATH || t === TILES.BRIDGE) continue;
      const h = hash2(x, y, map.seed);
      if (h > density) continue;
      // second hash picks the kind, third jitters position and size
      let pick = hash2(x, y, map.seed ^ 0x51ed) * total;
      let kind = set[0][0];
      for (const [k, w] of set) { if (pick < w) { kind = k; break; } pick -= w; }
      const j = hash2(x, y, map.seed ^ 0x2f1b);
      props.push({
        x: x * 32 + 8 + j * 16,
        y: y * 32 + 12 + hash2(x, y, map.seed ^ 0x77ab) * 16,
        kind,
        scale: 0.82 + j * 0.42,
        flip: hash2(x, y, map.seed ^ 0x1234) > 0.5 ? 1 : 0,
        tall: TALL_PROPS.has(kind),
      });
    }
  }
  return structures.concat(decor, props);
}
