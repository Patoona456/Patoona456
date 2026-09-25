// Moving water over a painted map. The painting's rivers are still; this adds
// what a still picture cannot: light drifting across the surface, twinkles
// that come and go, and falls that pour. Everything is cut from the water
// sheets by tools/slice-water.py; where the water is comes from the map's
// mask (white where the painting is water), and where each fall is from the
// map's `waterFx.falls`, in tiles.
import { TILE } from '../../shared/constants.js';

const FX = 'assets/fx/';
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

export class WaterFx {
  /** `cfg` is a map's `waterFx`: { mask, falls: [{ x, y, w, h }] }; `worldW` the map's width in world px. */
  constructor(cfg, worldW) {
    this.cfg = cfg;
    this.worldW = worldW;
    this.mask = img(cfg.mask);
    this.caustic = img(FX + 'water_caustic.webp');
    this.sparkle = img(FX + 'water_sparkle.webp');
    this.curtain = img(FX + 'water_curtain.webp');
    this.splash = img(FX + 'water_splash.webp');
    this.bubbles = img(FX + 'water_bubbles.webp');
    this.twinkles = [];
    this.layer = document.createElement('canvas');
    this.fallCanvas = document.createElement('canvas');
    this.pixels = null;              // the mask's alpha, read once it has loaded
  }

  /** Is (x, y), in world px, open water? */
  isWater(x, y) {
    if (!this.pixels) {
      if (!ready(this.mask)) return false;
      try {
        const c = document.createElement('canvas');
        c.width = this.mask.naturalWidth; c.height = this.mask.naturalHeight;
        const g = c.getContext('2d');
        g.drawImage(this.mask, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        this.pixels = { w: c.width, h: c.height, a: new Uint8Array(c.width * c.height) };
        for (let i = 0; i < this.pixels.a.length; i++) this.pixels.a[i] = d[i * 4 + 3];
      } catch { this.pixels = { w: 1, h: 1, a: new Uint8Array(1) }; }
    }
    const k = this.pixels.w / this.worldW;
    const px = Math.floor(x * k), py = Math.floor(y * k);
    if (px < 0 || py < 0 || px >= this.pixels.w || py >= this.pixels.h) return false;
    return this.pixels.a[py * this.pixels.w + px] > 200;
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
    if (!ready(this.caustic) || !ready(this.mask)) return;
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
    this.pattern ??= o.createPattern(this.caustic, 'repeat');
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
    const k = this.mask.naturalWidth / this.worldW;
    o.globalAlpha = 1;
    o.globalCompositeOperation = 'destination-in';
    o.imageSmoothingEnabled = true;
    o.drawImage(this.mask, x0 * k, y0 * k, w * k, h * k, x0, y0, w, h);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.8 + Math.sin(t * 0.9) * 0.15;     // the light breathes a little
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(c, 0, 0, W, H, x0, y0, w, h);
    ctx.restore();
  }

  /** Twinkles come up here and there on the water, play once, and go. */
  drawTwinkles(ctx, x0, y0, x1, y1, now) {
    if (!ready(this.sparkle)) return;
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
      ctx.drawImage(this.sparkle, f * cw, s.row * ch, cw, ch, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.restore();
  }

  /** The curtain pours down over the painted fall, fading in under its lip and out into the foam; a splash plays where it lands. */
  drawFall(ctx, fx, fy, fw, fh, now, f) {
    if (ready(this.curtain)) {
      const c = this.fallCanvas;
      const W = Math.ceil(fw), H = Math.ceil(fh);
      if (c.width < W || c.height < H) { c.width = Math.max(c.width, W); c.height = Math.max(c.height, H); }
      const o = c.getContext('2d');
      o.setTransform(1, 0, 0, 1, 0, 0);
      o.globalCompositeOperation = 'source-over';
      o.clearRect(0, 0, c.width, c.height);
      const k = W / this.curtain.naturalWidth;
      const th = this.curtain.naturalHeight * k;
      const off = (now * CURTAIN_SPEED * (f.speed ?? 1)) % th;
      for (let y = off - th; y < H; y += th) o.drawImage(this.curtain, 0, Math.floor(y), W, Math.ceil(th) + 1);
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
    if (ready(this.splash)) {
      const [cw, ch] = SPLASH_CELL;
      const w = fw * 1.15, h = w * ch / cw;
      for (const [phase, flip, a] of [[0, 1, 0.7], [0.5, -1, 0.45]]) {
        const cycle = SPLASH_FRAMES * 80;
        const fr = Math.floor((((now / cycle) + phase) % 1) * SPLASH_FRAMES);
        ctx.save();
        ctx.translate(baseX, baseY + h * 0.08);
        ctx.scale(flip, 1);
        ctx.globalAlpha = a;
        ctx.drawImage(this.splash, fr * cw, 0, cw, ch, -w / 2, -h, w, h);
        ctx.restore();
      }
    }
    if (ready(this.bubbles) && f.bubbles !== false) {      // not where a bridge crosses the foot
      const [cw, ch] = BUBBLE_CELL;
      const w = fw * 0.5, h = w * ch / cw;
      const fr = Math.floor(now / 140) % BUBBLE_FRAMES;
      ctx.globalAlpha = 0.7;
      ctx.drawImage(this.bubbles, fr * cw, 0, cw, ch, baseX - fw * 0.55, baseY + h * 0.1, w, h);
      ctx.drawImage(this.bubbles, ((fr + 3) % BUBBLE_FRAMES) * cw, 0, cw, ch, baseX + fw * 0.1, baseY + h * 0.25, w, h);
    }
    ctx.restore();
  }
}
