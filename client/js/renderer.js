// Canvas renderer: procedural terrain tiles + LPC paper-doll entities.
import { TILE, SPRITE } from '../../shared/constants.js';
import { TILES, decodeGrid, generateProps, hash2 } from '../../shared/data/maps.js';
import { propSprite, GLOWING } from './props.js';
import { ITEMS, RARITY_COLORS } from '../../shared/data/items.js';
import { drawCharacter, drawBlob, playerLayers, monsterLayers, npcLayers } from './sprites.js';

const rand = (seed) => {
  let a = seed >>> 0;
  return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
};

/** Tile art is generated once into 32x32 canvases - no tileset asset needed. */
function makeTile(kind, theme, variant = 0) {
  const c = document.createElement('canvas');
  c.width = c.height = TILE;
  const g = c.getContext('2d');
  const r = rand(kind * 7919 + theme.length * 13 + variant * 104729);
  const palettes = {
    [TILES.GRASS]: ['#3f6b3a', '#47773f', '#355c31'],
    [TILES.PATH]: ['#7a6a4e', '#857459', '#6d5e45'],
    [TILES.WATER]: ['#274b6d', '#2d5880', '#1f3d59'],
    [TILES.TREE]: ['#244224', '#1c351d', '#2e5230'],
    [TILES.ROCK]: ['#5a5a63', '#4a4a52', '#6a6a74'],
    [TILES.SAND]: ['#a8996c', '#b5a678', '#9a8b60'],
    [TILES.FLOOR]: ['#4a4650', '#524d59', '#413d47'],
    [TILES.WALL]: ['#2a2830', '#232129', '#332f3a'],
    [TILES.BRIDGE]: ['#6b4f34', '#77593c', '#5d442c'],
    [TILES.SNOW]: ['#cdd8e4', '#dae3ee', '#bfcbd9'],
    [TILES.LAVA]: ['#8c2f10', '#b84a16', '#6d2209'],
    [TILES.FLOWER]: ['#3f6b3a', '#47773f', '#c26a8c'],
    [TILES.ASH]: ['#4a4440', '#565049', '#3e3936'],
    [TILES.MOSS]: ['#3d5a3c', '#456348', '#334c33'],
  };
  if (theme === 'town') {
    palettes[TILES.FLOOR] = ['#9a8f7c', '#a89d88', '#8b806e'];   // warm cobble, not dungeon stone
    palettes[TILES.WALL] = ['#6d6355', '#5b5246', '#7d7365'];
  }
  const pal = palettes[kind] ?? palettes[TILES.GRASS];
  g.fillStyle = pal[0];
  g.fillRect(0, 0, TILE, TILE);
  for (let i = 0; i < 46; i++) {
    g.fillStyle = pal[1 + (r() < 0.5 ? 0 : 1)];
    g.globalAlpha = 0.25 + r() * 0.4;
    const s = 1 + Math.floor(r() * 3);
    g.fillRect(Math.floor(r() * TILE), Math.floor(r() * TILE), s, s);
  }
  g.globalAlpha = 1;

  if (kind === TILES.TREE) {
    // offset and resize per variant so a forest never looks like a grid
    const ox = [0, -4, 5][variant % 3], oy = [0, 3, -2][variant % 3];
    const rr = [12, 10, 13][variant % 3];
    g.fillStyle = '#2b1d12';
    g.fillRect(14 + ox, 18 + oy, 4, 12);
    g.fillStyle = '#254a25';
    g.beginPath(); g.arc(16 + ox, 16 + oy, rr, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2f5a2e';
    g.beginPath(); g.arc(14 + ox, 14 + oy, rr * 0.78, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3d7038';
    g.beginPath(); g.arc(12 + ox, 12 + oy, rr * 0.5, 0, Math.PI * 2); g.fill();
  } else if (kind === TILES.ROCK || kind === TILES.WALL) {
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.strokeRect(0.5, 0.5, TILE - 1, TILE - 1);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.fillRect(2, 2, TILE - 4, 3);
  } else if (kind === TILES.FLOWER) {
    for (let i = 0; i < 4; i++) {
      g.fillStyle = ['#e0d060', '#d86e9a', '#cfd7ea'][Math.floor(r() * 3)];
      g.fillRect(4 + Math.floor(r() * 24), 4 + Math.floor(r() * 24), 2, 2);
    }
  }
  return c;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.zoom = 2;
    this.camera = { x: 0, y: 0 };
    this.tiles = new Map();
    this.zone = null;
    this.grid = null;
    this.floaters = [];
    this.fx = [];
    this.shake = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.floor(innerWidth * dpr);
    this.canvas.height = Math.floor(innerHeight * dpr);
    this.canvas.style.width = innerWidth + 'px';
    this.canvas.style.height = innerHeight + 'px';
    this.dpr = dpr;
    this.zoom = innerWidth < 720 ? 2 : innerWidth < 1400 ? 2.25 : 2.6;
    this.ctx.imageSmoothingEnabled = false;
  }

  setZone(zonePayload) {
    this.zone = zonePayload;
    this.grid = decodeGrid(zonePayload.rle, zonePayload.width * zonePayload.height);
    this.tiles.clear();
    // three variants per tile kind kills the obvious repeating grid
    for (const kind of Object.values(TILES)) {
      this.tiles.set(kind, [0, 1, 2].map((v) => makeTile(kind, zonePayload.theme ?? 'grass', v)));
    }
    this.props = generateProps(
      { width: zonePayload.width, height: zonePayload.height, seed: zonePayload.seed ?? 1,
        theme: zonePayload.theme ?? 'grass', kind: zonePayload.kind,
        structures: zonePayload.structures ?? [] },
      this.grid
    ).sort((a, b) => a.y - b.y);
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

    this.drawTerrain(ctx, halfW, halfH);
    this.drawWarps(ctx, now);
    this.drawGroundFx(ctx, state, now);
    this.drawProps(ctx, visibleProps, false, now);
    this.drawGroundItems(ctx, state, now);
    this.drawEntities(ctx, state, now, visibleProps);
    this.drawFx(ctx, now);
    this.drawAmbience(ctx, view, visibleProps, state, now);
    ctx.restore();

    this.drawFloaters(ctx, s);
  }

  drawTerrain(ctx, halfW, halfH) {
    const x0 = Math.max(0, Math.floor((this.camera.x - halfW) / TILE) - 1);
    const y0 = Math.max(0, Math.floor((this.camera.y - halfH) / TILE) - 1);
    const x1 = Math.min(this.zone.width - 1, Math.ceil((this.camera.x + halfW) / TILE) + 1);
    const y1 = Math.min(this.zone.height - 1, Math.ceil((this.camera.y + halfH) / TILE) + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = this.grid[y * this.zone.width + x];
        const set = this.tiles.get(t) ?? this.tiles.get(TILES.GRASS);
        const v = (hash2(x, y, this.zone.seed ?? 1) * 3) | 0;
        ctx.drawImage(set[v] ?? set[0], x * TILE, y * TILE);
      }
    }
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

      // shadow
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      if (e.k === 'm' && e.sprite?.kind === 'blob') {
        drawBlob(ctx, e.sprite, { x: e.x, y: e.y, t: now + (e.id.charCodeAt(1) * 97), hurt });
      } else {
        const layers = e.k === 'p' ? playerLayers(e.look, e.eq ?? {})
          : e.k === 'n' ? npcLayers(e.look)
          : monsterLayers(e.sprite);
        if (layers) {
          drawCharacter(ctx, layers, {
            x: e.x, y: e.y, anim, dir: e.d ?? 2, elapsed,
            scale: e.sprite?.scale ?? 1,
            alpha: e.inv ? 0.35 : 1,
            tint: e.sprite?.tint ?? null,
            flash: hurt,
          });
        }
      }

      this.drawNameplate(ctx, e, state, now);
    }
  }

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
    const tint = {
      crypt: 'rgba(12,10,26,0.52)', ice: 'rgba(90,150,200,0.20)', marsh: 'rgba(48,66,44,0.22)',
      rock: 'rgba(80,60,40,0.12)', grass: 'rgba(30,50,70,0.06)', town: 'rgba(255,205,140,0.05)',
    }[theme];
    if (tint) {
      ctx.save();
      ctx.fillStyle = tint;
      ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
      ctx.restore();
    }

    const lights = [];
    for (const p of props) if (GLOWING.has(p.kind)) lights.push({ x: p.x, y: p.y - 22 * p.scale, r: 90, c: '255,190,120' });
    for (const w of this.zone.warps ?? []) {
      lights.push({ x: (w.x + w.w / 2) * TILE, y: (w.y + w.h / 2) * TILE, r: 120, c: '150,215,255' });
    }
    if (theme === 'crypt' || theme === 'ice') {
      const me = state.me;
      if (me) lights.push({ x: me.x, y: me.y - 16, r: 150, c: '255,225,180' });
    }
    if (!lights.length) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      if (l.x < view.x0 - l.r || l.x > view.x1 + l.r || l.y < view.y0 - l.r || l.y > view.y1 + l.r) continue;
      const flicker = 0.82 + Math.sin(now / 130 + l.x) * 0.1;
      const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, l.r);
      g.addColorStop(0, `rgba(${l.c},${0.34 * flicker})`);
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
