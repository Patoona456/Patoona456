// What moves in a painted scene: water that shimmers, twinkles and pours,
// and flames that flicker. The painting stays still; these are drawn over it.
// All the pieces sit in one atlas, assets/fx/ambient.webp, cut and packed by
// tools/slice-ambient.py (the demo counts its files, so it is one).
//
// Water: where it is is read off the map's own painting (the blue in it), so
// a map needs no mask file; where each fall is comes from `waterFx.falls`, in
// tiles. Flames: a map's structure with `flame: 'brazier' | 'blue'` plays the
// strip where it stands.
import { TILE } from '../../shared/constants.js';

// Where each piece sits in the atlas: [x, y, w, h], or for a strip [x, y] and its cell
const ATLAS = {
  caustic: [0, 0, 256, 256],
  curtain: [256, 0, 186, 76],
  splash: [0, 256],
  bubbles: [0, 370],
  sparkle: [0, 484],
};
/** The flames: where the strip starts, its cell, how many frames, and ms a frame. */
export const FLAMES = {
  brazier: { at: [450, 0], cell: [88, 150], frames: 7, ms: 90 },
  blue: { at: [1066, 0], cell: [84, 156], frames: 4, ms: 120 },
};
const SPLASH_CELL = [145, 114], SPLASH_FRAMES = 7;
const BUBBLE_CELL = [55, 114], BUBBLE_FRAMES = 7;
const SPARKLE_CELL = [184, 150], SPARKLE_FRAMES = 8, SPARKLE_ROWS = 4;
const SPARKLE_MS = 95;               // a frame of a twinkle
const SPARKLE_DENSITY = 1 / 5000;    // twinkles alive per world px² of water in view
const CAUSTIC_RES = 0.5;             // the light layer is drawn at half size: it is soft anyway
const CURTAIN_SPEED = 0.16;          // world px a millisecond the falls pour at

const images = new Map();
function img(url) {
  let im = images.get(url);
  if (!im) { im = new Image(); im.src = url; images.set(url, im); }
  return im;
}
const ready = (im) => im?.complete && im.naturalWidth > 0;
const ATLAS_URL = 'assets/fx/ambient.webp';

/** One frame of a flame, standing on (x, y) in world px, `h` tall. */
export function drawFlame(ctx, kind, x, y, h, now, phase = 0) {
  const f = FLAMES[kind];
  const atlas = img(ATLAS_URL);
  if (!f || !ready(atlas)) return;
  const [cw, ch] = f.cell;
  const fr = Math.floor(now / f.ms + phase) % f.frames;
  const w = h * cw / ch;
  ctx.drawImage(atlas, f.at[0] + fr * cw, f.at[1], cw, ch, x - w / 2, y - h, w, h);
}

/**
 * Where a painting is water, as a canvas at half its size (white,
 * alpha = water) and the same as bytes. The blue of rivers and moats; the
 * blue-grey of stone passes in specks, so only real stretches are kept.
 */
function waterMask(art) {
  const w = Math.max(1, Math.round(art.naturalWidth / 2)), h = Math.max(1, Math.round(art.naturalHeight / 2));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(art, 0, 0, w, h);
  const img = g.getImageData(0, 0, w, h), d = img.data;
  let m = new Uint8Array(w * h);
  for (let i = 0; i < m.length; i++) {
    const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2];
    m[i] = b > r + 40 && b > gg + 5 && b > 120 ? 1 : 0;
  }
  // keep off the banks: a water pixel needs water all round it
  const e = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      e[i] = m[i] & m[i - 1] & m[i + 1] & m[i - w] & m[i + w] & m[i - w - 1] & m[i - w + 1] & m[i + w - 1] & m[i + w + 1];
    }
  }
  m = e;
  // drop the specks: flood each patch and keep the big ones
  const MIN = Math.round(w * h / 2400);
  const seen = new Uint8Array(w * h), stack = [], patch = [];
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || seen[s]) continue;
    patch.length = 0; stack.push(s); seen[s] = 1;
    while (stack.length) {
      const i = stack.pop(); patch.push(i);
      const x = i % w;
      for (const n of [i - w, i + w, x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1]) {
        if (n >= 0 && n < m.length && m[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
      }
    }
    if (patch.length < MIN) for (const i of patch) m[i] = 0;
  }
  for (let i = 0; i < m.length; i++) {
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255;
    d[i * 4 + 3] = m[i] ? 255 : 0;
  }
  g.putImageData(img, 0, 0);
  const a = new Uint8Array(w * h);
  for (let i = 0; i < a.length; i++) a[i] = m[i] ? 255 : 0;
  return { canvas: c, w, h, a };
}

export class WaterFx {
  /** `cfg` is a map's `waterFx`: { falls: [{ x, y, w, h }] }; `art` the map's painting; `worldW` its width in world px. */
  constructor(cfg, art, worldW) {
    this.cfg = cfg;
    this.art = art;
    this.worldW = worldW;
    this.atlas = img(ATLAS_URL);
    this.twinkles = [];
    this.layer = document.createElement('canvas');
    this.fallCanvas = document.createElement('canvas');
    this.mask = null;                // read off the painting once it has loaded
  }

  /** The water mask, made the first time the painting is there to read. */
  get water() {
    if (!this.mask && ready(this.art)) {
      try { this.mask = waterMask(this.art); } catch { this.mask = { canvas: null, w: 1, h: 1, a: new Uint8Array(1) }; }
    }
    return this.mask;
  }

  /** Is (x, y), in world px, open water? */
  isWater(x, y) {
    const m = this.water;
    if (!m) return false;
    const k = m.w / this.worldW;
    const px = Math.floor(x * k), py = Math.floor(y * k);
    if (px < 0 || py < 0 || px >= m.w || py >= m.h) return false;
    return m.a[py * m.w + px] > 200;
  }

  draw(ctx, x0, y0, x1, y1, now, saver = false) {
    if (!saver) this.drawLight(ctx, x0, y0, x1, y1, now);
    this.drawTwinkles(ctx, x0, y0, x1, y1, now);
    for (const f of this.cfg.falls ?? []) {
      const fx = f.x * TILE, fy = f.y * TILE, fw = f.w * TILE, fh = f.h * TILE;
      if (fx + fw * 1.5 < x0 || fx - fw * 0.5 > x1 || fy + fh * 1.6 < y0 || fy > y1) continue;
      this.drawFall(ctx, fx, fy, fw, fh, now, f);
    }
  }

  /** Two sheets of light sliding across each other, only where there is water. */
  drawLight(ctx, x0, y0, x1, y1, now) {
    const water = this.water;
    if (!ready(this.atlas) || !water?.canvas) return;
    const w = x1 - x0, h = y1 - y0;
    const W = Math.ceil(w * CAUSTIC_RES), H = Math.ceil(h * CAUSTIC_RES);
    const c = this.layer;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const o = c.getContext('2d');
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalCompositeOperation = 'source-over';
    o.globalAlpha = 1;
    o.clearRect(0, 0, W, H);
    o.setTransform(CAUSTIC_RES, 0, 0, CAUSTIC_RES, -x0 * CAUSTIC_RES, -y0 * CAUSTIC_RES);
    if (!this.pattern) {
      // a pattern repeats a whole image: the light gets a canvas of its own
      const [sx, sy, sw, sh] = ATLAS.caustic;
      const tile = document.createElement('canvas');
      tile.width = sw; tile.height = sh;
      tile.getContext('2d').drawImage(this.atlas, sx, sy, sw, sh, 0, 0, sw, sh);
      this.pattern = o.createPattern(tile, 'repeat');
    }
    const p = this.pattern;
    const t = now / 1000;
    if (p.setTransform) p.setTransform(new DOMMatrix().translate(t * 14, t * 6).scale(0.9));
    o.fillStyle = p;
    o.globalAlpha = 1;
    o.fillRect(x0, y0, w, h);
    if (p.setTransform) p.setTransform(new DOMMatrix().translate(-t * 10 + 97, t * 9 + 41).scale(1.25));
    o.globalAlpha = 0.8;
    o.fillRect(x0, y0, w, h);
    // then cut it to the water
    const k = water.w / this.worldW;
    o.globalAlpha = 1;
    o.globalCompositeOperation = 'destination-in';
    o.imageSmoothingEnabled = true;
    o.drawImage(water.canvas, x0 * k, y0 * k, w * k, h * k, x0, y0, w, h);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.8 + Math.sin(t * 0.9) * 0.15;     // the light breathes a little
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(c, 0, 0, W, H, x0, y0, w, h);
    ctx.restore();
  }

  /** Twinkles come up here and there on the water, play once, and go. */
  drawTwinkles(ctx, x0, y0, x1, y1, now) {
    if (!ready(this.atlas)) return;
    const life = SPARKLE_FRAMES * SPARKLE_MS;
    this.twinkles = this.twinkles.filter((s) => now - s.start < s.life && s.x > x0 - 64 && s.x < x1 + 64 && s.y > y0 - 64 && s.y < y1 + 64);
    // a few tries a frame to find water in view: the count follows how much of it there is
    this.waterShare ??= 0.3;
    let hits = 0;
    const tries = 6;
    for (let i = 0; i < tries; i++) {
      const x = x0 + Math.random() * (x1 - x0), y = y0 + Math.random() * (y1 - y0);
      if (!this.isWater(x, y)) continue;
      hits++;
      const want = (x1 - x0) * (y1 - y0) * this.waterShare * SPARKLE_DENSITY;
      if (this.twinkles.length >= want) continue;
      // stars and the long glints most, the nets of light less
      const r = Math.random();
      const row = r < 0.35 ? 0 : r < 0.7 ? 2 : r < 0.85 ? 1 : 3;
      this.twinkles.push({ x, y, row, start: now, life: life * (0.8 + Math.random() * 0.6),
        size: 0.22 + Math.random() * 0.14, flip: Math.random() < 0.5 });
    }
    this.waterShare = this.waterShare * 0.97 + (hits / tries) * 0.03;
    if (!this.twinkles.length) return;
    const [cw, ch] = SPARKLE_CELL;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    for (const s of this.twinkles) {
      const f = Math.min(SPARKLE_FRAMES - 1, Math.floor((now - s.start) / s.life * SPARKLE_FRAMES));
      const w = cw * s.size, h = ch * s.size;
      ctx.save();
      ctx.translate(s.x, s.y);
      if (s.flip) ctx.scale(-1, 1);
      ctx.globalAlpha = 0.9;
      ctx.drawImage(this.atlas, ATLAS.sparkle[0] + f * cw, ATLAS.sparkle[1] + s.row * ch, cw, ch, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.restore();
  }

  /** The curtain pours down over the painted fall, fading in under its lip and out into the foam; a splash plays where it lands. */
  drawFall(ctx, fx, fy, fw, fh, now, f) {
    if (!ready(this.atlas)) return;
    {
      const c = this.fallCanvas;
      const W = Math.ceil(fw), H = Math.ceil(fh);
      if (c.width < W || c.height < H) { c.width = Math.max(c.width, W); c.height = Math.max(c.height, H); }
      const o = c.getContext('2d');
      o.setTransform(1, 0, 0, 1, 0, 0);
      o.globalCompositeOperation = 'source-over';
      o.clearRect(0, 0, c.width, c.height);
      const [cx, cy, cw, ch] = ATLAS.curtain;
      const th = ch * W / cw;
      const off = (now * CURTAIN_SPEED * (f.speed ?? 1)) % th;
      for (let y = off - th; y < H; y += th) o.drawImage(this.atlas, cx, cy, cw, ch, 0, Math.floor(y), W, Math.ceil(th) + 1);
      // soft at the edges: under the lip, into the foam, and down both sides
      o.globalCompositeOperation = 'destination-in';
      const gv = o.createLinearGradient(0, 0, 0, H);
      gv.addColorStop(0, 'rgba(0,0,0,0)');
      gv.addColorStop(0.18, 'rgba(0,0,0,1)');
      gv.addColorStop(0.75, 'rgba(0,0,0,1)');
      gv.addColorStop(1, 'rgba(0,0,0,0)');
      o.fillStyle = gv;
      o.fillRect(0, 0, W, H);
      const gh = o.createLinearGradient(0, 0, W, 0);
      gh.addColorStop(0, 'rgba(0,0,0,0)');
      gh.addColorStop(0.15, 'rgba(0,0,0,1)');
      gh.addColorStop(0.85, 'rgba(0,0,0,1)');
      gh.addColorStop(1, 'rgba(0,0,0,0)');
      o.fillStyle = gh;
      o.fillRect(0, 0, W, H);
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.drawImage(c, 0, 0, W, H, fx + fw * 0.06, fy, fw * 0.88, fh);
      ctx.restore();
    }
    // where it lands: two splashes out of step, and bubbles coming up
    const baseX = fx + fw / 2, baseY = fy + fh;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    {
      const [cw, ch] = SPLASH_CELL;
      const w = fw * 1.15, h = w * ch / cw;
      for (const [phase, flip, a] of [[0, 1, 0.7], [0.5, -1, 0.45]]) {
        const cycle = SPLASH_FRAMES * 80;
        const fr = Math.floor((((now / cycle) + phase) % 1) * SPLASH_FRAMES);
        ctx.save();
        ctx.translate(baseX, baseY + h * 0.08);
        ctx.scale(flip, 1);
        ctx.globalAlpha = a;
        ctx.drawImage(this.atlas, ATLAS.splash[0] + fr * cw, ATLAS.splash[1], cw, ch, -w / 2, -h, w, h);
        ctx.restore();
      }
    }
    if (f.bubbles !== false) {      // not where a bridge crosses the foot
      const [cw, ch] = BUBBLE_CELL;
      const w = fw * 0.5, h = w * ch / cw;
      const fr = Math.floor(now / 140) % BUBBLE_FRAMES;
      ctx.globalAlpha = 0.7;
      const [bx, by] = ATLAS.bubbles;
      ctx.drawImage(this.atlas, bx + fr * cw, by, cw, ch, baseX - fw * 0.55, baseY + h * 0.1, w, h);
      ctx.drawImage(this.atlas, bx + ((fr + 3) % BUBBLE_FRAMES) * cw, by, cw, ch, baseX + fw * 0.1, baseY + h * 0.25, w, h);
    }
    ctx.restore();
  }
}
