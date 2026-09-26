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

const SKIES = {
  marsh: { kind: 'rain', drops: 150, speed: 950, slant: -0.34, len: 26, color: '170,200,220', alpha: 0.30, storm: true },
  ice:   { kind: 'snow', drops: 190, speed: 190, slant: 0.5, len: 0, color: '235,248,255', alpha: 0.55, gust: true },
  crypt: { kind: 'fog', banks: 5, speed: 12, color: '90,80,120', alpha: 0.20 },
  rock:  { kind: 'fog', banks: 3, speed: 8, color: '120,96,70', alpha: 0.10 },
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
