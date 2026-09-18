// Terrain painter.
//
// The map is rendered ONCE into an offscreen canvas at zone load, which buys
// us expensive-but-pretty work: every material is laid down through a blurred
// mask so patches blend into each other instead of meeting at hard 32px tile
// edges, cliffs get a front face and a drop shadow, and shorelines get foam.
// Per frame the renderer just blits the visible rectangle.
import { TILE } from '../../shared/constants.js';
import { TILES, BLOCKING, hash2 } from '../../shared/data/maps.js';

const T = TILES;

/** base = the material that covers the whole map before anything else. */
const THEME_BASE = { grass: T.GRASS, town: T.GRASS, marsh: T.MOSS, crypt: T.FLOOR, rock: T.SAND, ice: T.SNOW };

/** paint order; later materials sit on top of earlier ones */
const ORDER = [T.MOSS, T.GRASS, T.ASH, T.SAND, T.SNOW, T.FLOWER, T.PATH, T.FLOOR, T.BRIDGE, T.WATER, T.LAVA];

const PALETTES = {
  [T.GRASS]: ['#3a6634', '#47783e', '#2f5a2c', '#568b49'],
  [T.MOSS]: ['#3d5a3c', '#456348', '#334c33', '#4d7046'],
  [T.PATH]: ['#7a6a4d', '#877659', '#6a5b42', '#948268'],
  [T.WATER]: ['#2b5578', '#31618a', '#224561', '#3d7099'],
  [T.SAND]: ['#a8996c', '#b5a678', '#9a8b60', '#c0b189'],
  [T.FLOOR]: ['#4a4650', '#524d59', '#413d47', '#5b5664'],
  [T.WALL]: ['#2f2c38', '#272430', '#3a3644', '#454052'],
  [T.BRIDGE]: ['#6b4f34', '#77593c', '#5d442c', '#84653f'],
  [T.SNOW]: ['#cdd8e4', '#dae3ee', '#bfcbd9', '#e6eef6'],
  [T.LAVA]: ['#93300f', '#c05018', '#6d2209', '#e0761f'],
  [T.FLOWER]: ['#43703d', '#4d7f45', '#3a6236', '#5b8a4f'],
  [T.ASH]: ['#4d4743', '#59534c', '#403b38', '#655d55'],
  [T.ROCK]: ['#5f5f69', '#6e6e79', '#4e4e57', '#7c7c88'],
  [T.TREE]: ['#2f5a2e', '#387036', '#254a25', '#44803f'],
};
const TOWN_OVERRIDE = {
  [T.FLOOR]: ['#9a8f7c', '#a89d88', '#8b806e', '#b5aa95'],
  [T.WALL]: ['#6d6355', '#5b5246', '#7d7365', '#8a8071'],
};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/**
 * The town square is laid, not grown: real cobbles with mortar between them,
 * worn smooth in places. Anything else gets the organic mottle below.
 */
function cobbleTexture() {
  const c = canvas(96, 96);
  const g = c.getContext('2d');
  let seed = 20240917;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

  g.fillStyle = '#6f6350';                       // warm mortar underneath
  g.fillRect(0, 0, 96, 96);

  const stone = (x, y, rx, ry, rot, tone) => {
    const grad = g.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 0.5, x, y, rx * 1.15);
    grad.addColorStop(0, tone[0]);
    grad.addColorStop(1, tone[1]);
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(60,54,44,0.35)';
    g.lineWidth = 0.8;
    g.stroke();
  };

  const TONES = [
    ['#c8bb9c', '#a2937a'], ['#bcae8f', '#97896f'], ['#d1c4a4', '#ab9d81'],
    ['#b3a68c', '#8e816a'], ['#d8cbab', '#b2a58a'],
  ];
  // brick-ish rows, jittered so no two stones line up perfectly
  const rows = 10, cols = 9;
  for (let ry = 0; ry < rows; ry++) {
    for (let cx2 = 0; cx2 < cols; cx2++) {
      const offset = ry % 2 ? (96 / cols) / 2 : 0;
      const x = cx2 * (96 / cols) + offset + (rnd() - 0.5) * 3;
      const y = ry * (96 / rows) + (rnd() - 0.5) * 3;
      const rx = 5.2 + rnd() * 1.3, r2 = 3.7 + rnd() * 1.0;
      const tone = TONES[Math.floor(rnd() * TONES.length)];
      const rot = (rnd() - 0.5) * 0.5;
      stone(x, y, rx, r2, rot, tone);
      for (const [ox, oy] of [[-96, 0], [96, 0], [0, -96], [0, 96]]) {
        if (x + ox > -12 && x + ox < 108 && y + oy > -12 && y + oy < 108) stone(x + ox, y + oy, rx, r2, rot, tone);
      }
    }
  }
  // damp patches and a little grit in the joints
  for (let i = 0; i < 14; i++) {
    g.globalAlpha = 0.05 + rnd() * 0.06;
    g.fillStyle = i % 2 ? '#3d4a52' : '#e8dcc0';
    const x = rnd() * 96, y = rnd() * 96, r = 6 + rnd() * 14;
    g.beginPath(); g.ellipse(x, y, r, r * 0.7, rnd() * 3, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  return c;
}

/** One 96x96 sheet holding three organic variants of a material, used as a pattern. */
function materialTexture(kind, theme) {
  if (theme === 'town' && kind === T.FLOOR) return cobbleTexture();
  const pal = (theme === 'town' && TOWN_OVERRIDE[kind]) || PALETTES[kind] || PALETTES[T.GRASS];
  const c = canvas(96, 96);
  const g = c.getContext('2d');
  g.fillStyle = pal[0];
  g.fillRect(0, 0, 96, 96);
  // soft mottling instead of pixel confetti: overlapping translucent blobs
  let seed = kind * 7919 + theme.length * 131;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 30; i++) {
    g.globalAlpha = 0.07 + rnd() * 0.10;
    g.fillStyle = pal[1 + Math.floor(rnd() * 3)];
    const x = rnd() * 96, y = rnd() * 96, r = 3 + rnd() * 9;
    g.beginPath(); g.ellipse(x, y, r, r * (0.6 + rnd() * 0.5), rnd() * 3, 0, Math.PI * 2); g.fill();
    // wrap the blob so the pattern tiles seamlessly
    for (const [ox, oy] of [[-96, 0], [96, 0], [0, -96], [0, 96]]) {
      g.beginPath(); g.ellipse(x + ox, y + oy, r, r * 0.7, 0, 0, Math.PI * 2); g.fill();
    }
  }
  // fine grain keeps the surface from going to mush at 2x zoom
  for (let i = 0; i < 260; i++) {
    g.globalAlpha = 0.05 + rnd() * 0.10;
    g.fillStyle = pal[1 + Math.floor(rnd() * 3)];
    g.fillRect(Math.floor(rnd() * 96), Math.floor(rnd() * 96), 1 + Math.floor(rnd() * 2), 1 + Math.floor(rnd() * 2));
  }
  g.globalAlpha = 1;
  return c;
}

/** Rounded tile path: a corner is only rounded when both of its neighbours differ. */
function tilePath(g, x, y, same, r) {
  const px = x * TILE, py = y * TILE, s = TILE;
  const n = same(x, y - 1), sD = same(x, y + 1), w = same(x - 1, y), e = same(x + 1, y);
  const tl = !n && !w ? r : 0, tr = !n && !e ? r : 0;
  const br = !sD && !e ? r : 0, bl = !sD && !w ? r : 0;
  g.moveTo(px + tl, py);
  g.lineTo(px + s - tr, py);
  if (tr) g.quadraticCurveTo(px + s, py, px + s, py + tr);
  g.lineTo(px + s, py + s - br);
  if (br) g.quadraticCurveTo(px + s, py + s, px + s - br, py + s);
  g.lineTo(px + bl, py + s);
  if (bl) g.quadraticCurveTo(px, py + s, px, py + s - bl);
  g.lineTo(px, py + tl);
  if (tl) g.quadraticCurveTo(px, py, px + tl, py);
  g.closePath();
}

/**
 * @returns {{canvas: HTMLCanvasElement, water: number[][], overlays: object[]}}
 *          overlays are tall pieces (tree canopies, boulders) the renderer
 *          y-sorts with the entities so characters can walk behind them.
 */

/** Small painted details so a surface still reads up close. */
function drawDecals(ctx, cells, at, theme, seed) {
  const T_ = T;
  const put = (kind, fn, chance) => {
    const e = cells.get(kind);
    if (!e) return;
    for (let i = 0; i < e.list.length; i += 2) {
      const x = e.list[i], y = e.list[i + 1];
      const h = hash2(x, y, seed ^ 0xdeca);
      if (h > chance) continue;
      const h2 = hash2(x, y, seed ^ 0x4c1a);
      ctx.save();
      ctx.translate(x * TILE + h2 * TILE, y * TILE + hash2(x, y, seed ^ 0x9b2) * TILE);
      fn(ctx, h, h2);
      ctx.restore();
    }
  };

  // grass blades
  const blades = (g, h) => {
    g.strokeStyle = `rgba(${h > 0.5 ? '120,168,96' : '70,116,60'},0.55)`;
    g.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(i * 3, 0);
      g.quadraticCurveTo(i * 3 + 1.5, -4, i * 3 + (i % 2 ? 3.5 : -2.5), -7 - h * 3);
      g.stroke();
    }
  };
  put(T_.GRASS, blades, 0.5);
  put(T_.MOSS, blades, 0.45);
  put(T_.FLOWER, (g, h, h2) => {
    blades(g, h);
    g.fillStyle = ['#e2d268', '#d97fa2', '#dfe6f2', '#e9975a'][Math.floor(h2 * 4)];
    g.beginPath(); g.arc(1, -8, 1.6, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(5, -6, 1.4, 0, Math.PI * 2); g.fill();
  }, 0.85);

  // pebbles and cart ruts
  const pebbles = (g, h, h2) => {
    g.fillStyle = `rgba(${h > 0.5 ? '150,136,110' : '96,86,68'},0.55)`;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.ellipse(i * 4 - 3, (i % 2) * 3, 1.6 + h2, 1.1 + h2 * 0.6, 0, 0, Math.PI * 2);
      g.fill();
    }
  };
  put(T_.PATH, pebbles, 0.42);
  put(T_.SAND, (g, h) => {
    g.strokeStyle = 'rgba(210,196,158,0.4)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(-8, 0); g.quadraticCurveTo(0, -3 - h * 3, 9, 0);
    g.stroke();
  }, 0.5);

  // flagstone cracks
  put(T_.FLOOR, (g, h, h2) => {
    g.strokeStyle = `rgba(0,0,0,${theme === 'town' ? 0.16 : 0.28})`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(-9, -4); g.lineTo(-2, 1 + h * 3); g.lineTo(8, -2 - h2 * 3);
    g.stroke();
  }, 0.45);

  // snow sparkle + drift shading
  put(T_.SNOW, (g, h, h2) => {
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillRect(0, 0, 1, 1);
    g.fillStyle = 'rgba(150,178,205,0.30)';
    g.beginPath(); g.ellipse(2, 2, 7 + h * 6, 2.5 + h2 * 2, 0, 0, Math.PI * 2); g.fill();
  }, 0.4);

  put(T_.ASH, (g, h) => {
    g.fillStyle = 'rgba(30,26,24,0.3)';
    g.beginPath(); g.ellipse(0, 0, 5 + h * 5, 2.5, 0, 0, Math.PI * 2); g.fill();
  }, 0.4);
}

export function buildTerrain(zone, grid) {
  const t0 = performance.now();
  const W = zone.width, H = zone.height;
  const theme = zone.theme ?? 'grass';
  const out = canvas(W * TILE, H * TILE);
  const ctx = out.getContext('2d');
  const base = THEME_BASE[theme] ?? T.GRASS;

  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : grid[y * W + x]);
  const textures = new Map();
  const tex = (kind) => {
    if (!textures.has(kind)) textures.set(kind, ctx.createPattern(materialTexture(kind, theme), 'repeat'));
    return textures.get(kind);
  };

  ctx.fillStyle = tex(base);
  ctx.fillRect(0, 0, out.width, out.height);

  // two scratch buffers, reused by every pass; each pass blurs ONCE
  const mask = canvas(out.width, out.height);
  const mg = mask.getContext('2d');
  const layer = canvas(out.width, out.height);
  const lg = layer.getContext('2d');

  // tiles per material, plus the bounding box so passes only touch what they must
  const cells = new Map();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = grid[y * W + x];
      let e = cells.get(k);
      if (!e) cells.set(k, (e = { list: [], x0: W, y0: H, x1: 0, y1: 0 }));
      e.list.push(x, y);
      if (x < e.x0) e.x0 = x;
      if (y < e.y0) e.y0 = y;
      if (x > e.x1) e.x1 = x;
      if (y > e.y1) e.y1 = y;
    }
  }
  const boxOf = (e, pad = 2) => {
    const x = Math.max(0, (e.x0 - pad) * TILE), y = Math.max(0, (e.y0 - pad) * TILE);
    return [x, y,
      Math.min(out.width, (e.x1 + 1 + pad) * TILE) - x,
      Math.min(out.height, (e.y1 + 1 + pad) * TILE) - y];
  };

  /** Fill `paint` through the mask that `drawShapes` writes, softened once. */
  const stamp = (box, blur, drawShapes, paint, composite = 'source-over', alpha = 1) => {
    const [bx, by, bw, bh] = box;
    if (bw <= 0 || bh <= 0) return;
    mg.clearRect(bx, by, bw, bh);
    mg.fillStyle = '#fff';
    drawShapes(mg);
    lg.clearRect(bx, by, bw, bh);
    lg.save();
    if (blur) lg.filter = `blur(${blur}px)`;
    lg.drawImage(mask, bx, by, bw, bh, bx, by, bw, bh);
    lg.restore();
    lg.globalCompositeOperation = 'source-in';
    lg.fillStyle = paint;
    lg.fillRect(bx, by, bw, bh);
    lg.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalCompositeOperation = composite;
    ctx.globalAlpha = alpha;
    ctx.drawImage(layer, bx, by, bw, bh, bx, by, bw, bh);
    ctx.restore();
  };

  const pathAll = (g, kind, r) => {
    const e = cells.get(kind);
    const same = (x, y) => at(x, y) === kind;
    g.beginPath();
    for (let i = 0; i < e.list.length; i += 2) tilePath(g, e.list[i], e.list[i + 1], same, r);
  };

  // --- ground materials, blended into each other ----------------------------
  for (const kind of ORDER) {
    if (kind === base || !cells.has(kind)) continue;
    const e = cells.get(kind);
    const isWet = kind === T.WATER || kind === T.LAVA;
    const box = boxOf(e);

    // Shoreline first, as a blurred halo of the whole body: stroking the tile
    // paths instead would draw every internal edge and give the lake a grid.
    if (isWet) {
      stamp(box, 6, (g) => { pathAll(g, kind, 13); g.fill(); },
        kind === T.WATER ? 'rgba(228,216,178,0.55)' : 'rgba(255,170,70,0.55)');
      stamp(box, 3, (g) => { pathAll(g, kind, 13); g.fill(); }, 'rgba(0,0,0,0.30)');
    }
    stamp(box, isWet ? 2.5 : 3.5, (g) => { pathAll(g, kind, isWet ? 13 : 15); g.fill(); }, tex(kind));

    // depth: darker towards the middle of a body of water
    if (kind === T.WATER) {
      stamp(box, 7, (g) => {
        g.beginPath();
        for (let i = 0; i < e.list.length; i += 2) {
          const x = e.list[i], y = e.list[i + 1];
          const deep = at(x - 1, y) === kind && at(x + 1, y) === kind
            && at(x, y - 1) === kind && at(x, y + 1) === kind;
          if (deep) g.rect(x * TILE, y * TILE, TILE, TILE);
        }
        g.fill();
      }, 'rgba(10,28,48,0.45)');
    }
  }

  // --- ground beneath blocking tiles ---------------------------------------
  const groundOf = (kind) => {
    if (kind === T.TREE) return theme === 'marsh' ? T.MOSS : T.GRASS;
    if (kind === T.ROCK) return theme === 'ice' ? T.SNOW : T.SAND;
    return base;
  };
  for (const kind of [T.TREE, T.ROCK, T.WALL]) {
    if (!cells.has(kind)) continue;
    const under = kind === T.WALL ? T.WALL : groundOf(kind);
    if (under === base && kind !== T.WALL) continue;
    stamp(boxOf(cells.get(kind)), 3, (g) => { pathAll(g, kind, 14); g.fill(); }, tex(under));
  }

  // --- walls become cliffs: lit top, shaded face, soft shadow --------------
  if (cells.has(T.WALL)) {
    const pal = (theme === 'town' && TOWN_OVERRIDE[T.WALL]) || PALETTES[T.WALL];
    const e = cells.get(T.WALL);
    const box = boxOf(e, 3);
    // one blurred shadow pass for every exposed wall foot
    stamp(box, 6, (g) => {
      g.beginPath();
      for (let i = 0; i < e.list.length; i += 2) {
        const x = e.list[i], y = e.list[i + 1];
        if (at(x, y + 1) === T.WALL || at(x, y + 1) === -1) continue;
        g.rect(x * TILE - 2, y * TILE + TILE + 4, TILE + 4, 14);
      }
      g.fill();
    }, 'rgba(0,0,0,0.45)');

    for (let i = 0; i < e.list.length; i += 2) {
      const x = e.list[i], y = e.list[i + 1];
      const px = x * TILE, py = y * TILE;
      if (at(x, y - 1) !== T.WALL) {
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(px, py, TILE, 5);
      }
      const below = at(x, y + 1);
      if (below !== T.WALL && below !== -1) {
        const faceH = 14;
        const grad = ctx.createLinearGradient(0, py + TILE - 8, 0, py + TILE + faceH);
        grad.addColorStop(0, pal[2]);
        grad.addColorStop(1, '#141219');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(px, py + TILE - 8);
        ctx.lineTo(px + TILE, py + TILE - 8);
        ctx.lineTo(px + TILE, py + TILE + faceH * 0.7);
        ctx.quadraticCurveTo(px + TILE / 2, py + TILE + faceH * 1.15, px, py + TILE + faceH * 0.7);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // --- contact shadow under trees and rocks (one blur for all of them) ------
  const solids = [T.TREE, T.ROCK].filter((k) => cells.has(k));
  if (solids.length) {
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const k of solids) {
      const e = cells.get(k);
      x0 = Math.min(x0, e.x0); y0 = Math.min(y0, e.y0);
      x1 = Math.max(x1, e.x1); y1 = Math.max(y1, e.y1);
    }
    stamp(boxOf({ x0, y0, x1, y1 }, 2), 7, (g) => {
      g.beginPath();
      for (const k of solids) {
        const e = cells.get(k);
        for (let i = 0; i < e.list.length; i += 2) {
          const x = e.list[i], y = e.list[i + 1];
          g.moveTo(x * TILE + TILE, y * TILE + TILE * 0.72);
          g.ellipse(x * TILE + TILE / 2, y * TILE + TILE * 0.72, TILE * 0.6, TILE * 0.34, 0, 0, Math.PI * 2);
        }
      }
      g.fill();
    }, 'rgba(0,0,0,0.26)');
  }

  // --- close-up detail: blades, pebbles, cracks, sparkle -------------------
  drawDecals(ctx, cells, at, theme, zone.seed ?? 1);

  // A fountain's water is part of its sprite, so the basin's square of water
  // tiles must not show through around it: pave them back over.
  if (theme === 'town') {
    for (const st of zone.structures ?? []) {
      if (st.kind !== 'fountain') continue;
      ctx.save();
      ctx.fillStyle = tex(T.FLOOR);
      // one tile of margin, to bury the shoreline halo the water pass left
      ctx.fillRect((st.x - 1) * TILE, (st.y - 1) * TILE, (st.w + 2) * TILE, (st.h + 2) * TILE);
      ctx.restore();
    }
  }

  // --- the town square: wear, damp and a ring of paving round the middle ---
  if (theme === 'town' && cells.has(T.FLOOR)) {
    const e = cells.get(T.FLOOR);
    const box = boxOf(e, 1);
    const cx = ((e.x0 + e.x1) / 2 + 0.5) * TILE, cy = ((e.y0 + e.y1) / 2 + 0.5) * TILE;
    const clipToSquare = (g) => {
      g.globalCompositeOperation = 'destination-in';
      g.beginPath();
      pathAll(g, T.FLOOR, 12);
      g.fill();
      g.globalCompositeOperation = 'source-over';
    };

    // sun-bleached patches and damp ones, so the repeating cobble breaks up
    for (const [tone, alpha, count, seedOff] of [
      ['rgba(255,244,214,1)', 0.20, 16, 0x1a],
      ['rgba(52,60,70,1)', 0.14, 12, 0x2b],
    ]) {
      stamp(box, 26, (g) => {
        g.beginPath();
        for (let i = 0; i < count; i++) {
          const h = hash2(i * 5 + 1, i * 11 + 2, (zone.seed ?? 1) ^ seedOff);
          const h2 = hash2(i * 7 + 3, i * 3 + 5, (zone.seed ?? 1) ^ (seedOff + 1));
          const x = (e.x0 + h * (e.x1 - e.x0)) * TILE, y = (e.y0 + h2 * (e.y1 - e.y0)) * TILE;
          g.moveTo(x, y);
          g.ellipse(x, y, 40 + h * 90, 30 + h2 * 70, h * 3, 0, Math.PI * 2);
        }
        g.fill();
        clipToSquare(g);
      }, tone, 'overlay', alpha);
    }

    // paving laid in rings around the fountain, the way a real square is set
    stamp(box, 1.5, (g) => {
      g.strokeStyle = '#fff';
      for (let r = 44; r < 330; r += 46) {
        g.lineWidth = r % 92 === 44 ? 3 : 2;
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      }
      clipToSquare(g);
    }, 'rgba(70,62,50,1)', 'source-over', 0.22);

    // and the paths people actually walk: faint radial wear
    stamp(box, 8, (g) => {
      g.strokeStyle = '#fff';
      g.lineWidth = 26;
      g.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.3;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * 60, cy + Math.sin(a) * 60);
        g.lineTo(cx + Math.cos(a) * 330, cy + Math.sin(a) * 330);
        g.stroke();
      }
      clipToSquare(g);
    }, 'rgba(255,238,200,1)', 'overlay', 0.12);
  }

  // --- slow, large colour variation so nothing reads as flat ---------------
  stamp([0, 0, out.width, out.height], 42, (g) => {
    g.beginPath();
    for (let i = 0; i < Math.ceil((W * H) / 900); i++) {
      const h = hash2(i, i * 7 + 3, zone.seed ?? 1);
      const h2 = hash2(i * 13, i, (zone.seed ?? 1) ^ 0x77);
      g.moveTo(h * W * TILE, h2 * H * TILE);
      g.ellipse(h * W * TILE, h2 * H * TILE, 110 + h * 200, 80 + h2 * 160, 0, 0, Math.PI * 2);
    }
    g.fill();
  }, 'rgba(255,242,215,0.9)', 'overlay', 0.06);

  // --- tall pieces handed back for y-sorted drawing ------------------------
  const overlays = [];
  for (const kind of [T.TREE, T.ROCK]) {
    const e = cells.get(kind);
    if (!e) continue;
    for (let i = 0; i < e.list.length; i += 2) {
      const x = e.list[i], y = e.list[i + 1];
      const h = hash2(x, y, (zone.seed ?? 1) ^ 0xa17);
      const h2 = hash2(x, y, (zone.seed ?? 1) ^ 0x5bd);
      overlays.push({
        kind: kind === T.TREE ? 'canopy' : 'outcrop',
        x: x * TILE + TILE / 2 + (h - 0.5) * 10,
        y: y * TILE + TILE * 0.95 + (h2 - 0.5) * 6,
        scale: 0.88 + h * 0.42,
        flip: h2 > 0.5 ? 1 : 0,
        variant: Math.floor(h * 3),
        tall: true,
        snow: theme === 'ice',
      });
    }
  }

  // the animated shimmer skips fountain basins - their sprite owns that water
  const inFountain = (x, y) => (zone.structures ?? []).some((st) => st.kind === 'fountain'
    && x >= st.x && x < st.x + st.w && y >= st.y && y < st.y + st.h);
  const water = [];
  const wc = cells.get(T.WATER);
  if (wc) {
    for (let i = 0; i < wc.list.length; i += 2) {
      const x = wc.list[i], y = wc.list[i + 1];
      if (theme === 'town' && inFountain(x, y)) continue;
      water.push([x, y]);
    }
  }

  console.debug(`[terrain] ${zone.id} painted in ${Math.round(performance.now() - t0)}ms`);
  return { canvas: out, water, overlays };
}
