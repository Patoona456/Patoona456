// Zone definitions + the deterministic terrain generator.
// The server builds the tile grid at boot and ships it to clients RLE-encoded,
// so the generator only has to be right once.

export const TILES = {
  GRASS: 0, PATH: 1, WATER: 2, TREE: 3, ROCK: 4, SAND: 5,
  FLOOR: 6, WALL: 7, BRIDGE: 8, SNOW: 9, LAVA: 10, FLOWER: 11, ASH: 12, MOSS: 13,
};
export const BLOCKING = new Set([TILES.WATER, TILES.TREE, TILES.ROCK, TILES.WALL, TILES.LAVA]);
export const HAZARD = { [TILES.LAVA]: { dps: 40, element: 'ember' } };

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
    width: 64, height: 48, seed: 1001, safe: true, theme: 'town',
    spawnPoint: [32, 26],
    warps: [
      { x: 32, y: 45, w: 4, h: 2, to: 'greenmire', at: [40, 8], label: 'ทุ่งกรีนไมร์' },
      { x: 2, y: 24, w: 2, h: 4, to: 'ashfen', at: [72, 40], label: 'หนองเถ้า' },
    ],
    npcs: [
      { id: 'vendor', name: 'พ่อค้าเมล', role: 'shop', x: 21, y: 20, shop: 'general', look: { body: 'female/light', hair: 'ponytail/brown', torso: 'shirt_teal', legs: 'pants_white', feet: 'shoes_black' } },
      { id: 'smith', name: 'ช่างตีเหล็กบอร์ก', role: 'smith', x: 42, y: 20, look: { body: 'male/dark', hair: 'messy/black', torso: 'leather', legs: 'pants_red', feet: 'metal', hands: 'metal_gloves' } },
      { id: 'banker', name: 'ผู้ดูแลคลังลีน่า', role: 'storage', x: 21, y: 28, look: { body: 'female/tanned', hair: 'long/black', torso: 'shirt_white', legs: 'pants_white', feet: 'shoes_black' } },
      { id: 'broker', name: 'นายหน้าคาสเซล', role: 'market', x: 42, y: 28, look: { body: 'male/light', hair: 'plain/blonde', torso: 'shirt_maroon', legs: 'pants_teal', feet: 'shoes_brown', head: 'cloth_hood' } },
      { id: 'healer', name: 'นักบวชอีริน', role: 'healer', x: 32, y: 15, look: { body: 'female/light', hair: 'plain/white', torso: 'shirt_white', legs: 'pants_white', feet: 'shoes_black', head: 'cloth_hood' } },
      { id: 'guide', name: 'ครูฝึกฮาลด์', role: 'trainer', x: 32, y: 30, look: { body: 'male/tanned', hair: 'ponytail/black', torso: 'chain', legs: 'metal', feet: 'metal', weapon: 'spear' } },
      { id: 'warper', name: 'นักเดินทางวิน', role: 'warp', x: 36, y: 24, look: { body: 'male/darkelf', hair: 'long/white', torso: 'shirt_maroon', legs: 'pants_white', feet: 'shoes_black' } },
      { id: 'board', name: 'กระดานภารกิจ', role: 'quests', x: 28, y: 24, look: null },
    ],
    spawns: [],
    // hand-placed town: footprints become walls, the client draws the buildings
    structures: [
      { kind: 'house', x: 29, y: 10, w: 6, h: 4, roof: '#b0b4c0', sign: 'วิหาร' },
      { kind: 'house', x: 19, y: 15, w: 5, h: 4, roof: '#8c4a3a', sign: 'ร้านค้า' },
      { kind: 'house', x: 40, y: 15, w: 5, h: 4, roof: '#6a5a8c', sign: 'โรงตีเหล็ก' },
      { kind: 'house', x: 19, y: 30, w: 5, h: 4, roof: '#4a7a6a', sign: 'คลัง' },
      { kind: 'house', x: 40, y: 30, w: 5, h: 4, roof: '#8c7a3a', sign: 'ตลาด' },
      { kind: 'stall', x: 26, y: 20, w: 3, h: 2 },
      { kind: 'stall', x: 36, y: 20, w: 3, h: 2 },
      { kind: 'stall', x: 26, y: 28, w: 3, h: 2 },
      { kind: 'stall', x: 36, y: 28, w: 3, h: 2 },
      { kind: 'fountain', x: 31, y: 23, w: 3, h: 3 },
    ],
  },

  greenmire: {
    id: 'greenmire', name: 'Greenmire Flats', nameTh: 'ทุ่งกรีนไมร์', kind: 'field',
    width: 80, height: 64, seed: 2002, theme: 'grass', levelRange: [1, 10],
    spawnPoint: [40, 6],
    warps: [
      { x: 38, y: 2, w: 4, h: 2, to: 'emberhold', at: [32, 42], label: 'เอมเบอร์โฮลด์' },
      { x: 76, y: 30, w: 2, h: 4, to: 'ashfen', at: [8, 32], label: 'หนองเถ้า' },
    ],
    spawns: [
      { mob: 'mire_slime', count: 26 },
      { mob: 'ember_wisp', count: 7 },
    ],
  },

  ashfen: {
    id: 'ashfen', name: 'Ashfen Marsh', nameTh: 'หนองเถ้า', kind: 'field',
    width: 80, height: 64, seed: 3003, theme: 'marsh', levelRange: [10, 22],
    spawnPoint: [8, 32],
    warps: [
      { x: 2, y: 30, w: 2, h: 4, to: 'greenmire', at: [72, 32], label: 'ทุ่งกรีนไมร์' },
      { x: 76, y: 38, w: 2, h: 4, to: 'emberhold', at: [8, 26], label: 'เอมเบอร์โฮลด์' },
      { x: 40, y: 60, w: 4, h: 2, to: 'gravebound', at: [30, 6], label: 'สุสานกราฟบาวด์' },
    ],
    spawns: [
      { mob: 'husk', count: 22 },
      { mob: 'bandit_scout', count: 16 },
      { mob: 'ember_wisp', count: 6 },
    ],
  },

  gravebound: {
    id: 'gravebound', name: 'Gravebound Hollow', nameTh: 'สุสานกราฟบาวด์', kind: 'cave',
    width: 72, height: 72, seed: 4004, theme: 'crypt', levelRange: [18, 32],
    spawnPoint: [30, 6],
    warps: [
      { x: 28, y: 2, w: 4, h: 2, to: 'ashfen', at: [40, 56], label: 'หนองเถ้า' },
      { x: 60, y: 64, w: 4, h: 2, to: 'orcwatch', at: [8, 8], label: 'สันเขาออร์ควอช' },
    ],
    spawns: [
      { mob: 'gravebound', count: 28 },
      { mob: 'husk', count: 12 },
    ],
  },

  orcwatch: {
    id: 'orcwatch', name: 'Orcwatch Ridge', nameTh: 'สันเขาออร์ควอช', kind: 'field',
    width: 88, height: 72, seed: 5005, theme: 'rock', levelRange: [26, 45],
    spawnPoint: [8, 8],
    warps: [
      { x: 4, y: 4, w: 4, h: 2, to: 'gravebound', at: [60, 60], label: 'สุสานกราฟบาวด์' },
      { x: 82, y: 60, w: 4, h: 4, to: 'frostvault', at: [14, 14], label: 'ห้องนิรภัยเยือกแข็ง' },
    ],
    spawns: [
      { mob: 'orc_scout', count: 26 },
      { mob: 'dark_raider', count: 18 },
      { mob: 'orc_warlord', count: 1, area: [70, 20, 14, 14], boss: true },
    ],
  },

  frostvault: {
    id: 'frostvault', name: 'Frostvault Depths', nameTh: 'ห้องนิรภัยเยือกแข็ง', kind: 'cave',
    width: 80, height: 80, seed: 6006, theme: 'ice', levelRange: [40, 60],
    spawnPoint: [14, 14],
    warps: [
      { x: 6, y: 6, w: 4, h: 4, to: 'orcwatch', at: [78, 58], label: 'สันเขาออร์ควอช' },
      { x: 70, y: 70, w: 4, h: 4, to: 'vhaal', at: [24, 41], label: 'ห้องบัลลังก์วาล' },
    ],
    spawns: [
      { mob: 'frost_husk', count: 30 },
      { mob: 'crimson_orc', count: 14 },
    ],
  },

  vhaal: {
    id: 'vhaal', name: "Vhaal's Throne", nameTh: 'ห้องบัลลังก์วาล', kind: 'boss',
    width: 48, height: 48, seed: 7007, theme: 'crypt', levelRange: [60, 70],
    spawnPoint: [24, 44],
    warps: [{ x: 22, y: 45, w: 4, h: 2, to: 'frostvault', at: [70, 68], label: 'ห้องนิรภัยเยือกแข็ง' }],
    spawns: [
      { mob: 'skeleton_king', count: 1, area: [16, 10, 16, 16], boss: true },
      { mob: 'gravebound', count: 10 },
    ],
  },
};

/** Build the tile grid for a map. Same input => same output, always. */
export function buildGrid(map) {
  const { width: w, height: h, seed, theme } = map;
  const g = new Uint8Array(w * h);
  const r = rng(seed);
  const base = noise2d(w, h, 9, seed);
  const detail = noise2d(w, h, 3.5, seed ^ 0x9e37);

  const T = TILES;
  const ground = { town: T.GRASS, grass: T.GRASS, marsh: T.MOSS, crypt: T.FLOOR, rock: T.SAND, ice: T.SNOW }[theme] ?? T.GRASS;
  const solid = { crypt: T.WALL, ice: T.WALL, rock: T.ROCK }[theme] ?? T.TREE;

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
  const path = theme === 'crypt' || theme === 'ice' ? T.FLOOR : T.PATH;
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
    for (const st of map.structures ?? []) {
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

  // clear warp pads and the spawn point
  const clear = (x, y, ww = 2, hh = 2) => {
    for (let y2 = y - 1; y2 < y + hh + 1; y2++)
      for (let x2 = x - 1; x2 < x + ww + 1; x2++)
        if (x2 > 0 && y2 > 0 && x2 < w - 1 && y2 < h - 1) g[y2 * w + x2] = path;
  };
  for (const wp of map.warps ?? []) clear(wp.x, wp.y, wp.w, wp.h);
  if (map.spawnPoint) clear(map.spawnPoint[0] - 2, map.spawnPoint[1] - 2, 5, 5);
  for (const npc of map.npcs ?? []) clear(npc.x - 1, npc.y - 1, 3, 3);
  for (const sp of map.spawns ?? []) if (sp.area) clear(sp.area[0], sp.area[1], sp.area[2], sp.area[3]);

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
export const TALL_PROPS = new Set(['tree', 'deadtree', 'pillar', 'lamp', 'totem', 'crystal', 'sign', 'banner', 'icicle', 'spike']);

export function generateProps(map, grid) {
  const structures = (map.structures ?? []).map((st) => ({
    x: (st.x + st.w / 2) * 32,
    y: (st.y + st.h) * 32,
    kind: st.kind,
    w: st.w * 32,
    h: st.h * 32,
    roof: st.roof,
    sign: st.sign,
    scale: 1,
    flip: 0,
    tall: st.kind !== 'fountain',
  }));
  const set = PROP_SETS[map.theme] ?? PROP_SETS.grass;
  const total = set.reduce((n, [, w]) => n + w, 0);
  const density = map.kind === 'town' ? 0.06 : 0.13;
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
  return structures.concat(props);
}
