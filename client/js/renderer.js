// Canvas renderer: procedural terrain tiles + LPC paper-doll entities.
import { TILE, SPRITE } from '../../shared/constants.js';
import { TILES, decodeGrid, generateProps, hash2 } from '../../shared/data/maps.js';
import { propSprite, GLOWING } from './props.js';
import { buildTerrain } from './terrain.js';
import { ITEMS, RARITY_COLORS } from '../../shared/data/items.js';
import { drawCharacter, drawBlob, drawRefineGlow, playerLayers, monsterLayers, npcLayers } from './sprites.js';
import { glowTier } from '../../shared/refineglow.js';
import { Particles } from './particles.js';
import { skyAt } from '../../shared/daycycle.js';

// Camera distance: three steps the player picks (ไกล / กลาง / ใกล้).
export const ZOOM_STEPS = [
  { key: 'xfar', label: 'ไกลมาก', note: 'เห็นทั้งย่าน เหมาะกับจอมือถือแนวนอน', mul: 0.46 },
  { key: 'far', label: 'ไกล', note: 'เห็นสนามรบกว้าง', mul: 0.62 },
  { key: 'mid', label: 'กลาง', note: 'ระยะมาตรฐาน', mul: 0.80 },
  { key: 'near', label: 'ใกล้', note: 'เห็นตัวละครชัดที่สุด', mul: 1.00 },
];
const ZOOM_KEY = 'emberfall-zoom';
const DEFAULT_ZOOM = ZOOM_STEPS.findIndex((z) => z.key === 'mid');

/**
 * Remembered by key, not by index: adding a step at the front must not
 * silently move everyone's camera. Older builds stored the index, so those
 * three values are translated once.
 */
function savedZoomStep() {
  try {
    const raw = localStorage.getItem(ZOOM_KEY);
    if (raw === null) return DEFAULT_ZOOM;
    const byKey = ZOOM_STEPS.findIndex((z) => z.key === raw);
    if (byKey >= 0) return byKey;
    const legacy = ['far', 'mid', 'near'][Number(raw)];
    const migrated = ZOOM_STEPS.findIndex((z) => z.key === legacy);
    if (migrated >= 0) return migrated;
  } catch { /* no storage */ }
  return DEFAULT_ZOOM;
}

// How far each soft prop leans, as a horizontal skew.
const SWAY = {
  grass: 0.10, flowers: 0.08, reeds: 0.09, mushroom: 0.04,
  bush: 0.035, tree: 0.022, deadtree: 0.018, banner: 0.05,
};

const rand = (seed) => {
  let a = seed >>> 0;
  return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.zoomStep = savedZoomStep();
    this.zoom = 2;
    this.camera = { x: 0, y: 0 };
    this.zone = null;
    this.grid = null;
    this.floaters = [];
    this.fx = [];
    this.particles = new Particles();
    this.steps = new Map();          // entity id -> when its next dust puff is due
    this.sparkAt = new Map();        // entity id -> when its weapon next throws a spark
    this.shake = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    // when the page itself is turned a quarter, width and height swap
    const rotated = document.body.classList.contains('forced-landscape');
    const w = rotated ? innerHeight : innerWidth;
    const h = rotated ? innerWidth : innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.dpr = dpr;
    this.applyZoom();
    this.ctx.imageSmoothingEnabled = false;
  }

  /** Base zoom follows the window; the player's step scales it. */
  applyZoom() {
    const wide = document.body.classList.contains('forced-landscape') ? innerHeight : innerWidth;
    const base = wide < 720 ? 2 : wide < 1400 ? 2.25 : 2.6;
    const step = ZOOM_STEPS[this.zoomStep] ?? ZOOM_STEPS[1];
    this.zoom = Math.round(base * step.mul * 100) / 100;
  }

  /** Pick a camera distance (0 = ไกล, 1 = กลาง, 2 = ใกล้). Returns the step. */
  setZoomStep(n) {
    this.zoomStep = Math.max(0, Math.min(ZOOM_STEPS.length - 1, n | 0));
    this.applyZoom();
    try { localStorage.setItem(ZOOM_KEY, ZOOM_STEPS[this.zoomStep].key); } catch { /* no storage */ }
    return ZOOM_STEPS[this.zoomStep];
  }

  /** Step in or out by one; wraps at the ends so one button can cycle. */
  nudgeZoom(dir, wrap = false) {
    const n = this.zoomStep + dir;
    if (wrap) return this.setZoomStep((n + ZOOM_STEPS.length) % ZOOM_STEPS.length);
    return this.setZoomStep(n);
  }

  setZone(zonePayload) {
    this.zone = zonePayload;
    this.particles.setTheme(zonePayload.theme);
    this.steps.clear();
    this.grid = decodeGrid(zonePayload.rle, zonePayload.width * zonePayload.height);

    const painted = buildTerrain(zonePayload, this.grid);
    this.terrain = painted.canvas;
    this.water = painted.water;

    const scenery = generateProps(
      { width: zonePayload.width, height: zonePayload.height, seed: zonePayload.seed ?? 1,
        theme: zonePayload.theme ?? 'grass', kind: zonePayload.kind,
        structures: zonePayload.structures ?? [], decor: zonePayload.decor ?? [] },
      this.grid
    );
    this.props = scenery.concat(painted.overlays).sort((a, b) => a.y - b.y);
    this._miniCache = null;
  }

  floater(text, x, y, color = '#fff', size = 12) {
    this.floaters.push({ text, x, y, color, size, t: performance.now(), life: 900, vy: -26 });
  }

  addFx(fx) { this.fx.push({ ...fx, t: performance.now() }); }

  worldToScreen(x, y) {
    const s = this.zoom * this.dpr;
    return [
      (x - this.camera.x) * s + this.canvas.width / 2,
      (y - this.camera.y) * s + this.canvas.height / 2,
    ];
  }

  screenToWorld(sx, sy) {
    const s = this.zoom * this.dpr;
    return [
      (sx * this.dpr - this.canvas.width / 2) / s + this.camera.x,
      (sy * this.dpr - this.canvas.height / 2) / s + this.camera.y,
    ];
  }

  render(state, now) {
    const ctx = this.ctx;
    const s = this.zoom * this.dpr;
    ctx.fillStyle = '#0b0d12';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.zone || !state.me) return;

    // camera follows with a touch of smoothing, clamped to the map
    const me = state.me;
    const halfW = this.canvas.width / 2 / s, halfH = this.canvas.height / 2 / s;
    const tx = Math.max(halfW, Math.min(this.zone.width * TILE - halfW, me.x));
    const ty = Math.max(halfH, Math.min(this.zone.height * TILE - halfH, me.y));
    this.camera.x += (tx - this.camera.x) * 0.18;
    this.camera.y += (ty - this.camera.y) * 0.18;
    if (this.shake > 0) {
      this.camera.x += (Math.random() - 0.5) * this.shake;
      this.camera.y += (Math.random() - 0.5) * this.shake;
      this.shake *= 0.85;
      if (this.shake < 0.2) this.shake = 0;
    }

    ctx.save();
    ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    ctx.scale(s, s);
    ctx.translate(-this.camera.x, -this.camera.y);

    const view = {
      x0: this.camera.x - halfW - 48, x1: this.camera.x + halfW + 48,
      y0: this.camera.y - halfH - 64, y1: this.camera.y + halfH + 64,
    };
    const visibleProps = this.props
      ? this.props.filter((p) => p.x > view.x0 && p.x < view.x1 && p.y > view.y0 && p.y < view.y1)
      : [];

    this.drawTerrain(ctx, halfW, halfH, now);
    this.drawWarps(ctx, now);
    this.drawGroundFx(ctx, state, now);
    this.drawProps(ctx, visibleProps, false, now);
    this.drawGroundItems(ctx, state, now);
    this.drawEntities(ctx, state, now, visibleProps);
    this.drawFx(ctx, now);
    this.particles.update(now, view);
    this.particles.draw(ctx, now);
    this.drawAmbience(ctx, view, visibleProps, state, now);
    this.particles.drawGlow(ctx);
    ctx.restore();

    this.drawVignette(ctx);
    this.drawFloaters(ctx, s);
  }

  drawTerrain(ctx, halfW, halfH, now) {
    if (!this.terrain) return;
    const x0 = Math.max(0, Math.floor(this.camera.x - halfW) - TILE);
    const y0 = Math.max(0, Math.floor(this.camera.y - halfH) - TILE);
    const x1 = Math.min(this.terrain.width, Math.ceil(this.camera.x + halfW) + TILE);
    const y1 = Math.min(this.terrain.height, Math.ceil(this.camera.y + halfH) + TILE);
    if (x1 <= x0 || y1 <= y0) return;
    ctx.drawImage(this.terrain, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    this.drawWaterShimmer(ctx, x0, y0, x1, y1, now);
  }

  /** Water is painted flat; the movement is added live so it never looks dead. */
  drawWaterShimmer(ctx, x0, y0, x1, y1, now) {
    if (!this.water?.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [tx, ty] of this.water) {
      const px = tx * TILE, py = ty * TILE;
      if (px + TILE < x0 || px > x1 || py + TILE < y0 || py > y1) continue;
      const t = now / 900 + tx * 0.7 + ty * 0.4;
      const a = 0.05 + Math.sin(t) * 0.035;
      if (a <= 0) continue;
      ctx.fillStyle = `rgba(190,225,255,${a})`;
      ctx.beginPath();
      ctx.ellipse(px + TILE / 2 + Math.sin(t * 1.3) * 5, py + TILE / 2 + Math.cos(t) * 3,
        TILE * 0.42, TILE * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawWarps(ctx, now) {
    for (const w of this.zone.warps ?? []) {
      const cx = (w.x + w.w / 2) * TILE, cy = (w.y + w.h / 2) * TILE;
      const rx = (w.w * TILE) / 2, ry = (w.h * TILE) / 2;
      const pulse = 0.5 + Math.sin(now / 420) * 0.18;

      ctx.save();
      // pad
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, Math.max(rx, ry));
      grad.addColorStop(0, `rgba(180,235,255,${0.55 * pulse + 0.2})`);
      grad.addColorStop(1, 'rgba(70,150,220,0.05)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(200,240,255,${pulse})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.lineDashOffset = -now / 90;
      ctx.stroke();
      ctx.setLineDash([]);

      // rising motes
      ctx.fillStyle = 'rgba(210,245,255,0.85)';
      for (let i = 0; i < 6; i++) {
        const t = ((now / 1400) + i / 6) % 1;
        const a = i * 1.7 + now / 900;
        ctx.globalAlpha = (1 - t) * 0.9;
        ctx.fillRect(cx + Math.cos(a) * rx * 0.7, cy + ry * 0.5 - t * (ry * 2 + 20), 2, 3);
      }
      ctx.globalAlpha = 1;

      // arch
      ctx.strokeStyle = 'rgba(150,215,255,0.75)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy + ry * 0.4, rx * 0.95, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();

      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      const label = `\u27A4 ${w.label ?? w.to}`;
      ctx.strokeText(label, cx, cy - ry - 8);
      ctx.fillStyle = '#d8f2ff';
      ctx.fillText(label, cx, cy - ry - 8);
      ctx.restore();
    }
  }

  drawGroundFx(ctx, state, now) {
    for (const f of state.fx ?? []) {
      const left = (f.until - Date.now()) / 1000;
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.sin(now / 200) * 0.08;
      ctx.fillStyle = '#ffb45e';
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#ffd9a0';
      ctx.stroke();
      ctx.restore();
    }
  }

  drawGroundItems(ctx, state, now) {
    for (const g of state.ground ?? []) {
      const bob = Math.sin(now / 300 + g.x) * 2;
      const isAurum = g.id === '__aurum';
      const def = ITEMS[g.id];
      ctx.save();
      ctx.translate(g.x, g.y + bob);
      ctx.globalAlpha = g.mine ? 1 : 0.45;
      ctx.fillStyle = isAurum ? '#f2c14e' : (RARITY_COLORS[def?.rarity] ?? '#cfd8dc');
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      if (isAurum) { ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      else { ctx.fillRect(-4, -4, 8, 8); ctx.strokeRect(-4, -4, 8, 8); }
      ctx.restore();
    }
  }

  drawProps(ctx, props, tall, now) {
    for (const p of props) {
      if (!!p.tall !== tall) continue;
      this.drawProp(ctx, p, now);
    }
  }

  drawProp(ctx, p, now) {
    const img = propSprite(p.w ? p : p.kind);
    const w = img.width * (p.w ? 1 : p.scale), h = img.height * (p.w ? 1 : p.scale);
    ctx.save();
    if (p.flip) { ctx.translate(p.x, 0); ctx.scale(-1, 1); ctx.translate(-p.x, 0); }
    // soft growth leans in the wind, pivoting on its base
    const sway = SWAY[p.kind];
    if (sway) {
      const a = Math.sin(now / 900 + p.x * 0.05 + p.y * 0.03) * sway;
      ctx.translate(p.x, p.y + 6);
      ctx.transform(1, 0, a, 1, 0, 0);
      ctx.translate(-p.x, -(p.y + 6));
    }
    ctx.drawImage(img, Math.round(p.x - w / 2), Math.round(p.y - h + 6), w, h);
    ctx.restore();
  }

  drawEntities(ctx, state, now, props = []) {
    // tall scenery shares the painter's-order list so characters walk behind it
    const ents = [...(state.ents ?? []), ...props.filter((p) => p.tall).map((p) => ({ _prop: p, y: p.y }))]
      .sort((a, b) => a.y - b.y);
    for (const e of ents) {
      if (e._prop) { this.drawProp(ctx, e._prop, now); continue; }
      const anim = e.a ?? 'idle';
      const elapsed = now - (e._animStart ?? now);
      const hurt = e._hurtUntil && e._hurtUntil > now ? (e._hurtUntil - now) / 200 : 0;

      // shadow: sized with the sprite, softened at the rim
      const sc = e.sprite?.scale ?? 1;
      const rx = (e.k === 'n' ? 9 : 10) * sc;
      ctx.save();
      ctx.globalAlpha = e.inv ? 0.10 : 0.30;
      const sg = ctx.createRadialGradient(e.x, e.y + 2, 0, e.x, e.y + 2, rx);
      sg.addColorStop(0, '#000');
      sg.addColorStop(0.65, 'rgba(0,0,0,0.75)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.save();
      ctx.translate(e.x, e.y + 2); ctx.scale(1, 0.4); ctx.translate(-e.x, -(e.y + 2));
      ctx.beginPath(); ctx.arc(e.x, e.y + 2, rx, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.restore();

      if (anim === 'walk') this.footstep(e, now);

      if (e.k === 'm' && e.sprite?.kind === 'blob') {
        drawBlob(ctx, e.sprite, { x: e.x, y: e.y, t: now + (e.id.charCodeAt(1) * 97), hurt });
      } else {
        const layers = e.k === 'p' ? playerLayers(e.look, e.eq ?? {})
          : e.k === 'n' ? npcLayers(e.look)
          : monsterLayers(e.sprite);
        if (layers) {
          const scale = e.sprite?.scale ?? 1;
          drawCharacter(ctx, layers, {
            x: e.x, y: e.y, anim, dir: e.d ?? 2, elapsed,
            scale,
            alpha: e.inv ? 0.35 : 1,
            tint: e.sprite?.tint ?? null,
            flash: hurt,
          });
          if (e.k === 'p' && e.wr) this.drawWeaponGlow(ctx, e, layers, anim, elapsed, scale, now);
        }
      }

      this.drawNameplate(ctx, e, state, now);
    }
  }

  /**
   * Refined weapons burn: a blurred bloom pass, a crisp one on top, and
   * sparks that come off the blade at the levels people actually chase.
   */
  drawWeaponGlow(ctx, e, layers, anim, elapsed, scale, now) {
    const tier = glowTier(e.wr);
    if (!tier || e.inv) return;
    const colour = `rgb(${tier.color.join(',')})`;
    // breathing, plus a kick while swinging
    const swinging = anim === 'slash' || anim === 'thrust' || anim === 'shoot';
    const pulse = 0.72 + 0.28 * Math.sin(now / (520 / tier.pulse) + e.x * 0.05);
    const power = tier.aura * pulse * (swinging ? 1.45 : 1);

    const opts = { x: e.x, y: e.y, anim, dir: e.d ?? 2, elapsed, scale, color: colour };
    // wide bloom, tight bloom, then the blade itself lit up
    drawRefineGlow(ctx, layers, { ...opts, alpha: power * 0.75, blur: 7 + tier.aura * 7 });
    drawRefineGlow(ctx, layers, { ...opts, alpha: power * 0.70, blur: 2.5 });
    drawRefineGlow(ctx, layers, { ...opts, alpha: Math.min(0.95, power * 0.9), blur: 0 });

    // light cast on the ground around the wielder, at the higher tiers
    if (tier.light) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const r = tier.light * (0.85 + pulse * 0.25);
      const g = ctx.createRadialGradient(e.x, e.y - 6, 1, e.x, e.y - 6, r);
      g.addColorStop(0, `rgba(${tier.color.join(',')},${0.26 * power})`);
      g.addColorStop(0.45, `rgba(${tier.color.join(',')},${0.10 * power})`);
      g.addColorStop(1, `rgba(${tier.color.join(',')},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(e.x, e.y - 6, r, 0, Math.PI * 2); ctx.fill();
      // a ring of light on the floor, so the tier reads even in daylight
      ctx.globalAlpha = 0.5 * power;
      ctx.strokeStyle = `rgba(${tier.color.join(',')},0.55)`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + 2, 14 + tier.trail * 8, (14 + tier.trail * 8) * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // embers drifting off the blade
    if (tier.sparks) {
      const due = this.sparkAt.get(e.id) ?? 0;
      const gap = (swinging ? 110 : 420) / tier.sparks;
      if (now >= due) {
        this.sparkAt.set(e.id, now + gap * (0.6 + Math.random() * 0.8));
        const side = [[0, -1], [-1, 0], [0, 1], [1, 0]][e.d ?? 2];
        this.particles.spark(
          e.x + side[0] * 12 + (Math.random() - 0.5) * 10,
          e.y - 26 + side[1] * 6 + (Math.random() - 0.5) * 10,
          { color: tier.color.join(','), n: swinging ? 3 : 1, power: 0.5 + tier.trail },
        );
      }
    }
  }

  /** One puff every couple of strides, per entity. */
  footstep(e, now) {
    const due = this.steps.get(e.id) ?? 0;
    if (now < due) return;
    this.steps.set(e.id, now + 260 + Math.random() * 120);
    if (due) this.particles.step(e.x, e.y + 1);
  }

  /** A soft frame so the eye settles in the middle of the screen. */
  drawVignette(ctx) {
    const w = this.canvas.width, h = this.canvas.height;
    if (!this._vig || this._vig.w !== w || this._vig.h !== h) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.38, w / 2, h / 2, Math.max(w, h) * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.34)');
      this._vig = { w, h, g };
    }
    ctx.save();
    ctx.fillStyle = this._vig.g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /** Hit sparks, called from the game when damage lands. */
  spark(x, y, opts) { this.particles.spark(x, y, opts); }
  poof(x, y, color) { this.particles.poof(x, y, color); }

  drawNameplate(ctx, e, state, now) {
    const isMe = e.id === state.myId;
    const isTarget = e.id === state.targetId;
    const top = e.y - (e.sprite?.scale ? 46 * e.sprite.scale : 44);

    if (isTarget) {
      ctx.save();
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.lineDashOffset = -now / 60;
      ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, 14, 6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // hp bar for monsters, players and the target
    if (e.k !== 'n' && (e.k === 'm' || isTarget || isMe || e.hp < e.mhp)) {
      const w = e.boss ? 44 : 26;
      const pct = Math.max(0, e.hp / e.mhp);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(e.x - w / 2 - 1, top - 1, w + 2, 5);
      ctx.fillStyle = e.k === 'p' ? (isMe ? '#5ad07a' : '#7fb2ff') : (e.boss ? '#ff8a3d' : '#e05555');
      ctx.fillRect(e.x - w / 2, top, w * pct, 3);
    }

    ctx.font = (e.boss ? 'bold 9px' : '8px') + ' system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    const label = e.k === 'm' ? `${e.n} Lv${e.lv}` : e.k === 'n' ? `[${e.n}]` : `${e.n}`;
    ctx.strokeText(label, e.x, top - 4);
    ctx.fillStyle = e.k === 'n' ? '#9fe0b0' : e.k === 'm' ? (e.boss ? '#ffb45e' : '#ffd9d9') : (isMe ? '#b9f6c7' : '#cfe4ff');
    ctx.fillText(label, e.x, top - 4);

    if (e.st) {
      ctx.font = '8px system-ui, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(e.st, e.x, top - 13);
    }
  }

  drawFx(ctx, now) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      const age = now - f.t;
      const life = f.life ?? 420;
      if (age > life) { this.fx.splice(i, 1); continue; }
      const k = age / life;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      switch (f.fx) {
        case 'aoe':
        case 'debuff':
        case 'ground':
          ctx.strokeStyle = '#ffd08a'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(f.x, f.y, (f.r ?? 40) * (0.4 + k * 0.8), 0, Math.PI * 2); ctx.stroke();
          break;
        case 'bolt':
        case 'line':
        case 'dash':
          ctx.strokeStyle = f.fx === 'dash' ? '#c9b6ff' : '#9fdcff';
          ctx.lineWidth = 3 * (1 - k);
          ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.tx, f.ty); ctx.stroke();
          break;
        case 'heal':
          ctx.fillStyle = '#7dffb0';
          for (let j = 0; j < 4; j++) {
            ctx.globalAlpha = (1 - k) * 0.8;
            ctx.fillRect(f.x - 10 + j * 6, f.y - 20 - k * 22 + (j % 2) * 4, 3, 3);
          }
          break;
        case 'buff':
          ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(f.x, f.y - 12, 16 * (1 - k * 0.4), 0, Math.PI * 2); ctx.stroke();
          break;
        case 'summon':
          ctx.strokeStyle = '#a0ffd0'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(f.x, f.y, 20 * k, 0, Math.PI * 2); ctx.stroke();
          break;
        default: break;
      }
      ctx.restore();
    }
  }

  /** Per-theme colour grade, vignette, and additive lights from props/portals. */
  drawAmbience(ctx, view, props, state, now) {
    const theme = this.zone.theme ?? 'grass';
    const w = view.x1 - view.x0, h = view.y1 - view.y0;

    // the zone's own colour, always on
    const tint = {
      crypt: 'rgba(12,10,26,0.52)', ice: 'rgba(90,150,200,0.20)', marsh: 'rgba(48,66,44,0.22)',
      rock: 'rgba(80,60,40,0.12)', grass: 'rgba(30,50,70,0.06)', town: 'rgba(255,205,140,0.05)',
    }[theme];
    if (tint) {
      ctx.save();
      ctx.fillStyle = tint;
      ctx.fillRect(view.x0, view.y0, w, h);
      ctx.restore();
    }

    // time of day on top of it, skipped underground where there is no sky
    const sky = skyAt(Date.now());
    const underground = theme === 'crypt';
    if (!underground && sky.alpha > 0.005) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgba(${sky.rgb.join(',')},${sky.alpha})`;
      ctx.fillRect(view.x0, view.y0, w, h);
      ctx.restore();
      if (sky.phase > 0.24 && sky.phase < 0.36) {        // dawn wash
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,170,90,${0.05 * (1 - sky.lamp)})`;
        ctx.fillRect(view.x0, view.y0, w, h);
        ctx.restore();
      }
    }

    // lamps matter more after dark; underground they are always lit
    const lampNeed = underground ? 1 : Math.max(0.18, sky.lamp);
    const lights = [];
    for (const p of props) {
      if (GLOWING.has(p.kind)) lights.push({ x: p.x, y: p.y - 22 * p.scale, r: 90 + 40 * lampNeed, c: '255,190,120', i: 0.34 * (0.45 + lampNeed) });
    }
    for (const w2 of this.zone.warps ?? []) {
      lights.push({ x: (w2.x + w2.w / 2) * TILE, y: (w2.y + w2.h / 2) * TILE, r: 120, c: '150,215,255', i: 0.34 });
    }
    const me = state.me;
    // a lantern of your own, once it is dark enough to need one
    const carry = underground || theme === 'ice' ? 1 : lampNeed;
    if (me && carry > 0.3) lights.push({ x: me.x, y: me.y - 16, r: 120 + 50 * carry, c: '255,225,180', i: 0.30 * carry });
    if (!lights.length) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      if (l.x < view.x0 - l.r || l.x > view.x1 + l.r || l.y < view.y0 - l.r || l.y > view.y1 + l.r) continue;
      const flicker = 0.82 + Math.sin(now / 130 + l.x) * 0.1;
      const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, l.r);
      g.addColorStop(0, `rgba(${l.c},${(l.i ?? 0.34) * flicker})`);
      g.addColorStop(1, `rgba(${l.c},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  drawFloaters(ctx, s) {
    const now = performance.now();
    ctx.save();
    ctx.textAlign = 'center';
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      const age = now - f.t;
      if (age > f.life) { this.floaters.splice(i, 1); continue; }
      const k = age / f.life;
      const [sx, sy] = this.worldToScreen(f.x, f.y + f.vy * k);
      ctx.globalAlpha = 1 - k * k;
      ctx.font = `bold ${f.size * this.dpr}px system-ui, sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.strokeText(f.text, sx, sy);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, sx, sy);
    }
    ctx.restore();
  }
}
