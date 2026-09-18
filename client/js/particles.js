// Atmosphere: the drifting bits that make a still frame feel alive.
//
// Two populations, both code-drawn:
//   * ambient - a bed of motes/leaves/snow/fireflies tied to the zone theme,
//     recycled around the camera so the count stays fixed no matter how far
//     the player walks;
//   * bursts - short-lived puffs and sparks spawned by the game (footsteps,
//     hits, deaths).
//
// Everything is drawn in world space, before the light pass.

const rnd = (a, b) => a + Math.random() * (b - a);

/** Per-theme look. `n` scales with the visible area, not the map. */
const WEATHER = {
  town:  { n: 34, kind: 'mote', color: '255,225,180', size: [0.6, 1.4], vy: [-5, -14], vx: [-6, 6], life: [4, 9], alpha: 0.30 },
  grass: { n: 40, kind: 'leaf', color: '150,200,120', size: [1.0, 2.2], vy: [4, 14], vx: [10, 26], life: [5, 10], alpha: 0.42, spin: true },
  marsh: { n: 30, kind: 'fly', color: '180,255,170', size: [0.8, 1.6], vy: [-4, 4], vx: [-8, 8], life: [3, 7], alpha: 0.6, blink: true },
  crypt: { n: 26, kind: 'mote', color: '190,180,220', size: [0.7, 1.6], vy: [-3, -10], vx: [-4, 4], life: [5, 11], alpha: 0.22 },
  rock:  { n: 30, kind: 'ash', color: '210,170,120', size: [0.7, 1.8], vy: [-2, 8], vx: [14, 34], life: [4, 8], alpha: 0.26 },
  ice:   { n: 64, kind: 'snow', color: '235,245,255', size: [1.0, 2.4], vy: [16, 34], vx: [-14, 10], life: [6, 12], alpha: 0.65, sway: true },
};

export class Particles {
  constructor() {
    this.theme = 'grass';
    this.ambient = [];
    this.bursts = [];
    this.last = 0;
  }

  setTheme(theme) {
    this.theme = WEATHER[theme] ? theme : 'grass';
    this.ambient.length = 0;      // refilled on the next frame, inside the view
  }

  get def() { return WEATHER[this.theme]; }

  /** Keep the ambient bed full and inside the camera box; age everything. */
  update(now, view) {
    const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
    this.last = now;
    const def = this.def;
    const w = view.x1 - view.x0, h = view.y1 - view.y0;

    while (this.ambient.length < def.n) this.ambient.push(this.spawnAmbient(view, true));
    while (this.ambient.length > def.n) this.ambient.pop();

    for (const p of this.ambient) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.sway) p.x += Math.sin(now / 600 + p.seed) * 14 * dt;
      if (p.spin) p.rot += p.spinRate * dt;
      // recycle: off the view box or aged out
      if (p.life <= 0 || p.x < view.x0 - 40 || p.x > view.x1 + 40 || p.y < view.y0 - 40 || p.y > view.y1 + 40) {
        Object.assign(p, this.spawnAmbient(view, false));
      }
      p.fade = Math.min(1, p.life / 1.2, (p.maxLife - p.life) / 0.8);
      void w; void h;
    }

    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life -= dt;
      if (b.life <= 0) { this.bursts.splice(i, 1); continue; }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += b.g * dt;
      b.vx *= 0.96;
    }
  }

  /**
   * A fresh ambient particle. `anywhere` fills the whole box on the first
   * frame; afterwards they enter from the edge the wind comes from.
   */
  spawnAmbient(view, anywhere) {
    const d = this.def;
    const vx = rnd(d.vx[0], d.vx[1]);
    const vy = rnd(d.vy[0], d.vy[1]);
    const life = rnd(d.life[0], d.life[1]);
    let x, y;
    if (anywhere) {
      x = rnd(view.x0, view.x1);
      y = rnd(view.y0, view.y1);
    } else if (Math.abs(vy) > Math.abs(vx)) {
      x = rnd(view.x0, view.x1);
      y = vy > 0 ? view.y0 - 20 : view.y1 + 20;
    } else {
      x = vx > 0 ? view.x0 - 20 : view.x1 + 20;
      y = rnd(view.y0, view.y1);
    }
    return {
      x, y, vx, vy, life, maxLife: life, fade: 0,
      r: rnd(d.size[0], d.size[1]),
      seed: Math.random() * 10,
      rot: Math.random() * Math.PI,
      spinRate: rnd(-2, 2),
      sway: !!d.sway, spin: !!d.spin,
    };
  }

  /* ---------------- bursts ---------------- */

  /** Dust kicked up by a walking character. */
  step(x, y) {
    for (let i = 0; i < 2; i++) {
      this.bursts.push({
        x: x + rnd(-3, 3), y: y + rnd(-1, 1), vx: rnd(-8, 8), vy: rnd(-6, -14),
        g: 26, r: rnd(1, 2.2), life: rnd(0.3, 0.5), maxLife: 0.5,
        color: '190,175,150', alpha: 0.35, shape: 'puff',
      });
    }
  }

  /** Sparks off a hit. Bigger and brighter for a critical. */
  spark(x, y, { color = '255,220,160', n = 6, power = 1 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rnd(40, 110) * power;
      this.bursts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 20,
        g: 160, r: rnd(0.8, 1.8) * power, life: rnd(0.18, 0.38), maxLife: 0.38,
        color, alpha: 0.9, shape: 'spark',
      });
    }
  }

  /** A soft ring plus motes when something dies. */
  poof(x, y, color = '120,120,140') {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      this.bursts.push({
        x, y, vx: Math.cos(a) * rnd(10, 45), vy: Math.sin(a) * rnd(6, 26) - 16,
        g: 30, r: rnd(1.4, 3), life: rnd(0.4, 0.8), maxLife: 0.8,
        color, alpha: 0.5, shape: 'puff',
      });
    }
  }

  /* ---------------- drawing ---------------- */

  draw(ctx, now) {
    const d = this.def;
    ctx.save();
    for (const p of this.ambient) {
      let alpha = d.alpha * p.fade;
      if (d.blink) alpha *= 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now / 220 + p.seed * 7));
      if (alpha <= 0.01) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${d.color})`;
      if (d.kind === 'leaf') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
        ctx.restore();
      } else if (d.kind === 'snow' || d.kind === 'fly' || d.kind === 'mote' || d.kind === 'ash') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const b of this.bursts) {
      const t = b.life / b.maxLife;
      ctx.globalAlpha = b.alpha * Math.min(1, t * 1.6);
      ctx.fillStyle = `rgb(${b.color})`;
      if (b.shape === 'spark') {
        ctx.fillRect(b.x - b.r / 2, b.y - b.r / 2, b.r, b.r);
      } else {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * (2 - t), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** Fireflies and snow read better with a little glow on top. */
  drawGlow(ctx) {
    const d = this.def;
    if (!d.blink) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.ambient) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 8);
      g.addColorStop(0, `rgba(${d.color},${0.18 * p.fade})`);
      g.addColorStop(1, `rgba(${d.color},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}
