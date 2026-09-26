// Weather, drawn over the world in screen space.
//
// The ambient particles in particles.js live in the world: leaves and snow
// that drift past at the same scale as the characters. Weather is the other
// half - rain that falls the length of the screen, fog that rolls across it,
// lightning that whitens everything at once. It is drawn in screen space on
// purpose, so zooming out does not turn a downpour into a drizzle.
//
// Nothing here is sent by the server. Each zone theme has a fixed sky, and
// the storm rhythm runs off the wall clock, so every client in the marsh sees
// the same flash within a frame of everyone else - the same trick the day and
// night cycle uses.
import { FROST_ATLAS } from './ambient.js';

const frostImg = new Image();
let frostAsked = false;
function frostAtlas() {
  if (!frostAsked) { frostAsked = true; frostImg.src = 'assets/fx/frost.webp'; }
  return frostImg.complete && frostImg.naturalWidth > 0 ? frostImg : null;
}

const SKIES = {
  marsh: { kind: 'rain', drops: 150, speed: 950, slant: -0.34, len: 26, color: '170,200,220', alpha: 0.30, storm: true },
  // the frost pass: a blizzard - snow driven on the wind, flakes turning in
  // it, drifts of blown snow sweeping across, frost creeping in at the edges
  ice:   { kind: 'snow', drops: 230, speed: 200, slant: 0.9, len: 0, color: '235,248,255', alpha: 0.6, gust: true,
    blizzard: { flakes: 22, gusts: 3, frost: 0.35 } },
  crypt: { kind: 'fog', banks: 5, speed: 12, color: '90,80,120', alpha: 0.20 },
  rock:  { kind: 'fog', banks: 3, speed: 8, color: '120,96,70', alpha: 0.10 },
  // the lava highlands: grey ash and dust drifting down across the screen,
  // embers rising through it, and a warm haze at the bottom
  ash:   { kind: 'ash', drops: 150, embers: 40, speed: 34, color: '175,165,160', ember: '255,150,60', alpha: 0.75, gust: true },
  grass: null,
  town: null,
  hall: null,
};

// One lightning strike per cycle, at a fixed offset, so it is the same for
// everyone without a single byte crossing the wire.
const STORM_CYCLE = 17000;
const FLASH_MS = 380;

export class Weather {
  constructor() {
    this.theme = null;
    this.sky = null;
    this.drops = [];
    this.banks = [];
    this.last = 0;
  }

  setTheme(theme) {
    if (this.theme === theme) return;
    this.theme = theme;
    this.sky = SKIES[theme] ?? null;
    this.drops = [];
    this.banks = [];
    this.embers = [];
    this.flakes = [];
    this.gusts = [];
  }

  /** How bright the sky is right now, 0..1. The zone tint reads this. */
  flash(nowMs = Date.now()) {
    if (!this.sky?.storm) return 0;
    const t = nowMs % STORM_CYCLE;
    if (t > FLASH_MS) return 0;
    // two strikes in quick succession, the second weaker
    const k = t / FLASH_MS;
    const a = Math.max(0, 1 - k * 6);
    const b = k > 0.22 && k < 0.48 ? Math.max(0, 1 - (k - 0.22) * 9) * 0.6 : 0;
    return Math.max(a, b);
  }

  update(now, w, h) {
    const sky = this.sky;
    if (!sky) return;
    const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
    this.last = now;

    if (sky.kind === 'rain' || sky.kind === 'snow') {
      while (this.drops.length < sky.drops) this.drops.push(this.spawn(w, h, true));
      while (this.drops.length > sky.drops) this.drops.pop();
      // snow wanders on a slow gust; rain comes down hard and straight
      const gust = sky.gust ? Math.sin(now / 2600) * 0.6 + Math.sin(now / 900) * 0.25 : 0;
      for (const d of this.drops) {
        d.y += sky.speed * d.z * dt;
        d.x += sky.speed * d.z * (sky.slant + gust) * dt;
        if (d.y > h + 20 || d.x < -40 || d.x > w + 40) Object.assign(d, this.spawn(w, h, false));
      }
      const bz = sky.blizzard;
      if (bz) {
        // the wind: a steady push with gusts on top, the flakes and drifts ride it
        this.wind = 0.9 + Math.max(0, Math.sin(now / 4200)) * 1.4 + Math.sin(now / 1300) * 0.3;
        this.flakes ??= [];
        while (this.flakes.length < bz.flakes) this.flakes.push(this.spawnFlake(w, h, true));
        for (const f of this.flakes) {
          f.y += f.v * dt;
          f.x += (f.v * this.wind + Math.sin(now / 800 + f.seed * 4) * 20) * dt;
          f.rot += f.spin * dt;
          if (f.y > h + 30 || f.x > w + 40) Object.assign(f, this.spawnFlake(w, h, false));
        }
        this.gusts ??= [];
        this.gusts = this.gusts.filter((g) => g.x < w + g.w);
        if (this.gusts.length < bz.gusts && Math.random() < dt * 0.8 * this.wind) this.gusts.push(this.spawnGust(w, h));
        for (const g of this.gusts) g.x += g.v * this.wind * dt;
      }
    } else if (sky.kind === 'ash') {
      while (this.drops.length < sky.drops) this.drops.push(this.spawn(w, h, true));
      this.embers ??= [];
      while (this.embers.length < sky.embers) this.embers.push(this.spawnEmber(w, h, true));
      const gust = Math.sin(now / 3100) * 0.7 + Math.sin(now / 1100) * 0.3;
      for (const d of this.drops) {
        // ash falls slowly and wanders, each flake on its own sway
        d.y += sky.speed * d.z * dt;
        d.x += (sky.speed * (0.5 + gust) * d.z + Math.sin(now / 700 + d.seed * 6) * 14) * dt;
        if (d.y > h + 20 || d.x < -40 || d.x > w + 40) Object.assign(d, this.spawn(w, h, false));
      }
      for (const e of this.embers) {
        e.y -= e.v * dt;
        e.x += (Math.sin(now / 500 + e.seed * 5) * 18 + gust * 12) * dt;
        e.life -= dt;
        if (e.life <= 0 || e.y < -20) Object.assign(e, this.spawnEmber(w, h, false));
      }
    } else if (sky.kind === 'fog') {
      while (this.banks.length < sky.banks) this.banks.push(this.spawnBank(w, h));
      for (const b of this.banks) {
        b.x += sky.speed * b.z * dt;
        if (b.x - b.r > w + 60) { b.x = -b.r - 60; b.y = Math.random() * h; }
      }
    }
  }

  spawn(w, h, anywhere) {
    return {
      x: Math.random() * (w + 80) - 40,
      y: anywhere ? Math.random() * h : -20 - Math.random() * 40,
      z: 0.6 + Math.random() * 0.7,          // depth: near drops fall faster
      r: 0.8 + Math.random() * 1.4,
      seed: Math.random() * 10,
    };
  }

  spawnFlake(w, h, anywhere) {
    return {
      x: anywhere ? Math.random() * w : -40 - Math.random() * w * 0.3,
      y: anywhere ? Math.random() * h : Math.random() * h * 0.8 - 40,
      v: 40 + Math.random() * 70, size: 0.25 + Math.random() * 0.35,
      rot: Math.random() * 6, spin: (Math.random() - 0.5) * 2, f: Math.floor(Math.random() * 10), seed: Math.random() * 10,
    };
  }

  spawnGust(w, h) {
    const k = 2 + Math.random() * 2.5;
    return { x: -192 * k, y: Math.random() * h * 0.9, w: 192 * k, h: 72 * k, v: 260 + Math.random() * 220,
      f: Math.floor(Math.random() * 6), alpha: 0.25 + Math.random() * 0.25, flip: Math.random() < 0.5 };
  }

  spawnEmber(w, h, anywhere) {
    const life = 3 + Math.random() * 4;
    return {
      x: Math.random() * w, y: anywhere ? Math.random() * h : h + 10,
      v: 30 + Math.random() * 60, r: 0.8 + Math.random() * 1.6,
      life, max: life, seed: Math.random() * 10,
    };
  }

  spawnBank(w, h) {
    return {
      x: Math.random() * w, y: Math.random() * h,
      r: 120 + Math.random() * 180, z: 0.5 + Math.random(),
    };
  }

  /**
   * Drawn after the world and its colour grade, before the HUD. `ctx` is in
   * screen pixels here, not world units.
   */
  draw(ctx, now, w, h) {
    const sky = this.sky;
    if (!sky) return;
    ctx.save();

    if (sky.kind === 'rain') {
      ctx.strokeStyle = `rgba(${sky.color},${sky.alpha})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (const d of this.drops) {
        const len = sky.len * d.z;
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + len * sky.slant, d.y + len);
      }
      ctx.stroke();
    } else if (sky.kind === 'snow') {
      ctx.fillStyle = `rgba(${sky.color},${sky.alpha})`;
      for (const d of this.drops) {
        ctx.globalAlpha = sky.alpha * (0.4 + d.z * 0.6);
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * d.z, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const bz = sky.blizzard, at = bz && frostAtlas();
      if (at) {
        // the drifts of blown snow, swept across the screen
        const G = FROST_ATLAS.gust, F = FROST_ATLAS.flake;
        for (const g of this.gusts ?? []) {
          ctx.save();
          ctx.globalAlpha = g.alpha;
          ctx.translate(g.x + g.w / 2, g.y);
          if (g.flip) ctx.scale(1, -1);
          ctx.drawImage(at, G.at[0] + g.f * G.cell[0], G.at[1], G.cell[0], G.cell[1], -g.w / 2, -g.h / 2, g.w, g.h);
          ctx.restore();
        }
        // flakes, turning as they go
        for (const f of this.flakes ?? []) {
          const s = F.cell[0] * f.size;
          ctx.save();
          ctx.globalAlpha = 0.85;
          ctx.translate(f.x, f.y);
          ctx.rotate(f.rot);
          ctx.drawImage(at, F.at[0] + f.f * F.cell[0], F.at[1], F.cell[0], F.cell[1], -s / 2, -s / 2, s, s);
          ctx.restore();
        }
        // frost at the edges of the screen, breathing with the wind
        const a = bz.frost * (0.8 + (this.wind ?? 1) * 0.12);
        const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.55);
        g.addColorStop(0, 'rgba(200,225,255,0)');
        g.addColorStop(1, `rgba(215,235,255,${a})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        // and a cold cast over everything
        ctx.fillStyle = 'rgba(120,160,220,0.06)';
        ctx.fillRect(0, 0, w, h);
      }
    } else if (sky.kind === 'ash') {
      // the haze: warm from below, where the lava is
      const g = ctx.createLinearGradient(0, h * 0.55, 0, h);
      g.addColorStop(0, 'rgba(255,90,30,0)');
      g.addColorStop(1, 'rgba(255,90,30,0.10)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // the ash: small grey flakes, a little flattened and turning
      ctx.fillStyle = `rgb(${sky.color})`;
      for (const d of this.drops) {
        ctx.globalAlpha = sky.alpha * (0.3 + d.z * 0.5);
        const rx = d.r * d.z * 1.9, ry = rx * (0.4 + Math.abs(Math.sin(now / 600 + d.seed)) * 0.6);
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, rx, ry, d.seed, 0, Math.PI * 2);
        ctx.fill();
      }
      // the embers, glowing, fading as they rise
      ctx.globalCompositeOperation = 'lighter';
      for (const e of this.embers ?? []) {
        const k = Math.min(1, e.life / e.max * 2) * (0.6 + Math.sin(now / 90 + e.seed * 9) * 0.4);
        const rr = e.r * 3;
        const gg = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, rr);
        gg.addColorStop(0, `rgba(255,230,160,${0.9 * k})`);
        gg.addColorStop(0.35, `rgba(${sky.ember},${0.6 * k})`);
        gg.addColorStop(1, `rgba(${sky.ember},0)`);
        ctx.globalAlpha = 1;
        ctx.fillStyle = gg;
        ctx.fillRect(e.x - rr, e.y - rr, rr * 2, rr * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    } else if (sky.kind === 'fog') {
      for (const b of this.banks) {
        const g = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, b.r);
        g.addColorStop(0, `rgba(${sky.color},${sky.alpha * b.z})`);
        g.addColorStop(1, `rgba(${sky.color},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // the strike itself: the whole screen, for a handful of frames
    const f = this.flash(Date.now());
    if (f > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(200,220,255,${f * 0.34})`;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }
}
