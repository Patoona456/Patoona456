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
    // south of the fountain: a spawn that touches the basin corner wedges
    // the player's collision box against it
    spawnPoint: [32, 28],
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
      { id: 'oracle', name: 'ผู้ดูแลศาลรุ่งอรุณ', role: 'gacha', x: 27, y: 21, look: { body: 'female/darkelf', hair: 'long/white', torso: 'shirt_maroon', legs: 'pants_white', feet: 'shoes_black', head: 'cloth_hood' } },
    ],
    spawns: [],
    // hand-placed town: footprints become walls, the client draws the buildings.
    // Deliberately off-grid - a town that mirrors perfectly reads as a template.
    structures: [
      { kind: 'house', x: 27, y: 8, w: 8, h: 5, roof: '#b0b4c0', sign: 'วิหารรุ่งอรุณ' },
      { kind: 'house', x: 16, y: 14, w: 6, h: 4, roof: '#8c4a3a', sign: 'ร้านค้า' },
      { kind: 'house', x: 39, y: 13, w: 6, h: 5, roof: '#6a5a8c', sign: 'โรงตีเหล็ก' },
      { kind: 'house', x: 17, y: 29, w: 5, h: 4, roof: '#4a7a6a', sign: 'คลังสมบัติ' },
      { kind: 'house', x: 38, y: 29, w: 7, h: 4, roof: '#8c7a3a', sign: 'ตลาดกลาง' },
      { kind: 'house', x: 46, y: 21, w: 5, h: 4, roof: '#7a5a4a', sign: 'โรงเตี๊ยม' },
      { kind: 'house', x: 11, y: 21, w: 5, h: 4, roof: '#5a6a8c', sign: 'หอยาม' },
      { kind: 'house', x: 24, y: 36, w: 6, h: 4, roof: '#6d4a3a' },
      { kind: 'house', x: 35, y: 37, w: 5, h: 3, roof: '#4a6a5a' },
      // market row: uneven spacing, four different awnings
      { kind: 'stall', x: 25, y: 18, w: 3, h: 2, variant: 0 },
      { kind: 'stall', x: 35, y: 17, w: 3, h: 2, variant: 1 },
      { kind: 'stall', x: 24, y: 27, w: 3, h: 2, variant: 2 },
      { kind: 'stall', x: 25, y: 31, w: 4, h: 2, variant: 3 },
      { kind: 'stall', x: 26, y: 33, w: 3, h: 2, variant: 1 },
      { kind: 'fountain', x: 30, y: 22, w: 4, h: 4 },
    ],
    // props that do not block anything: lamps, benches, crates, greenery
    decor: [
      // lantern ring around the plaza
      ['lamp', 27, 20], ['lamp', 37, 20], ['lamp', 27, 28], ['lamp', 37, 28],
      ['lamp', 32, 17], ['lamp', 32, 31], ['lamp', 22, 24], ['lamp', 42, 24],
      // somewhere to sit, and something green to look at
      ['bench', 29, 20], ['bench', 36, 21], ['bench', 28, 29], ['bench', 34, 31],
      ['planter', 30, 17], ['planter', 34, 18], ['planter', 29, 31], ['planter', 35, 29],
      ['tree', 21, 12], ['tree', 45, 16], ['tree', 14, 33], ['tree', 47, 34], ['tree', 20, 40],
      ['bush', 23, 13], ['bush', 44, 18], ['bush', 16, 35],
      // working clutter around the shops
      ['well', 25, 24], ['cart', 42, 27], ['awning', 44, 20],
      ['barrel', 23, 18], ['barrel', 22, 19], ['crate', 38, 16], ['sack', 39, 17],
      ['crate', 19, 27], ['sack', 20, 28], ['barrel', 41, 32], ['crate', 42, 32],
      ['sack', 27, 34], ['barrel', 31, 35], ['crate', 26, 20], ['sack', 37, 29],
      // banners and signposts at the ways in and out
      ['banner', 30, 13], ['banner', 34, 13], ['sign', 32, 36], ['sign', 6, 24],
      ['banner', 22, 30], ['banner', 43, 21],
      ['flowerpot', 28, 12], ['flowerpot', 36, 12], ['flowerpot', 46, 25], ['flowerpot', 12, 25],
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
    // the north strip by the town gate stays gentle; anything that bites
    // lives further out, so a brand new character has somewhere to start
    spawns: [
      { mob: 'mire_slime', count: 24 },
      { mob: 'ember_wisp', count: 7, area: [4, 26, 72, 34] },
      { mob: 'dusk_bat', count: 10, area: [4, 30, 72, 30] },
      { mob: 'thistle_sprite', count: 8, area: [4, 34, 72, 26] },
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
      { mob: 'husk', count: 16 },
      { mob: 'bandit_scout', count: 14 },
      { mob: 'marsh_lurker', count: 10 },
      { mob: 'bog_crawler', count: 12 },
      { mob: 'fen_spore', count: 9 },
      { mob: 'thistle_sprite', count: 5 },
      { mob: 'dusk_bat', count: 5 },
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
      { mob: 'gravebound', count: 20 },
      { mob: 'husk', count: 8 },
      { mob: 'bone_archer', count: 12 },
      { mob: 'grave_moth', count: 11 },
      { mob: 'tomb_robber', count: 9 },
      { mob: 'cairn_wisp', count: 7 },
      { mob: 'crypt_warden', count: 6 },
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
      { mob: 'orc_scout', count: 20 },
      { mob: 'dark_raider', count: 14 },
      { mob: 'orc_shaman', count: 9 },
      { mob: 'ridge_hound', count: 12 },
      { mob: 'stone_grub', count: 8 },
      { mob: 'crypt_warden', count: 4 },
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
      { x: 8, y: 70, w: 4, h: 4, to: 'reliquary1', at: [9, 24], label: 'หีบศพจม (ปาร์ตี้ 2 คน)' },
    ],
    spawns: [
      { mob: 'frost_husk', count: 20 },
      { mob: 'crimson_orc', count: 10 },
      { mob: 'frost_wight', count: 12 },
      { mob: 'rime_shard', count: 12 },
      { mob: 'glacier_maw', count: 8 },
      { mob: 'hoar_stalker', count: 9 },
      { mob: 'vault_sentry', count: 6 },
      { mob: 'ember_revenant', count: 5 },
    ],
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
    spawns: [
      { mob: 'reliquary_sentinel', count: 4, area: [18, 8, 16, 14] },
      { mob: 'reliquary_shade', count: 5, area: [18, 28, 16, 14] },
      { mob: 'reliquary_choir', count: 3, area: [40, 18, 18, 14] },
      { mob: 'reliquary_sentinel', count: 2, area: [40, 18, 18, 14] },
    ],
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
    spawns: [
      { mob: 'reliquary_choir', count: 5, area: [16, 6, 14, 12] },
      { mob: 'reliquary_anchor', count: 2, area: [24, 24, 18, 14] },
      { mob: 'reliquary_shade', count: 6, area: [24, 24, 18, 14] },
      { mob: 'reliquary_sentinel', count: 4, area: [16, 44, 14, 14] },
      { mob: 'reliquary_choir', count: 3, area: [46, 26, 12, 12] },
    ],
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
    spawns: [
      { mob: 'reliquary_warden', count: 1, area: [22, 18, 8, 8], boss: true },
    ],
  },

  vhaal: {
    id: 'vhaal', name: "Vhaal's Throne", nameTh: 'ห้องบัลลังก์วาล', kind: 'boss',
    width: 48, height: 48, seed: 7007, theme: 'crypt', levelRange: [60, 70],
    spawnPoint: [24, 44],
    warps: [{ x: 22, y: 45, w: 4, h: 2, to: 'frostvault', at: [70, 68], label: 'ห้องนิรภัยเยือกแข็ง' }],
    spawns: [
      { mob: 'skeleton_king', count: 1, area: [16, 10, 16, 16], boss: true },
      { mob: 'gravebound', count: 8 },
      { mob: 'crypt_warden', count: 6 },
      { mob: 'bone_archer', count: 6 },
    ],
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
export function buildGrid(map) {
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
    scale: 1,
    flip: 0,
    tall: st.kind !== 'fountain',
  }));
  // hand-placed decor: exact tiles, no blocking, drawn like any other prop
  const decor = (map.decor ?? []).map(([kind, dx, dy, scale = 1, flip = 0]) => ({
    x: (dx + 0.5) * 32,
    y: (dy + 1) * 32,
    kind, scale, flip,
    tall: TALL_PROPS.has(kind),
  }));

  const set = PROP_SETS[map.theme] ?? PROP_SETS.grass;
  const total = set.reduce((n, [, w]) => n + w, 0);
  const density = map.kind === 'town' ? 0.07 : 0.17;
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
