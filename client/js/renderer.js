// Canvas renderer: procedural terrain tiles + LPC paper-doll entities.
import { TILE, SPRITE } from '../../shared/constants.js';
import { TILES, decodeGrid } from '../../shared/data/maps.js';
import { ITEMS, RARITY_COLORS } from '../../shared/data/items.js';
import { drawCharacter, drawBlob, playerLayers, monsterLayers, npcLayers } from './sprites.js';

const rand = (seed) => {
  let a = seed >>> 0;
  return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
};

/** Tile art is generated once into 32x32 canvases - no tileset asset needed. */
function makeTile(kind, theme) {
  const c = document.createElement('canvas');
  c.width = c.height = TILE;
  const g = c.getContext('2d');
  const r = rand(kind * 7919 + theme.length * 13);
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
    g.fillStyle = '#2b1d12';
    g.fillRect(14, 20, 4, 10);
    g.fillStyle = '#2f5a2e';
    g.beginPath(); g.arc(16, 16, 12, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3d7038';
    g.beginPath(); g.arc(13, 13, 7, 0, Math.PI * 2); g.fill();
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
    for (const kind of Object.values(TILES)) this.tiles.set(kind, makeTile(kind, zonePayload.theme ?? 'grass'));
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

    this.drawTerrain(ctx, halfW, halfH);
    this.drawWarps(ctx, now);
    this.drawGroundFx(ctx, state, now);
    this.drawGroundItems(ctx, state, now);
    this.drawEntities(ctx, state, now);
    this.drawFx(ctx, now);
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
        const img = this.tiles.get(t) ?? this.tiles.get(TILES.GRASS);
        ctx.drawImage(img, x * TILE, y * TILE);
      }
    }
  }

  drawWarps(ctx, now) {
    for (const w of this.zone.warps ?? []) {
      const pulse = 0.35 + Math.sin(now / 400) * 0.15;
      ctx.fillStyle = `rgba(120,200,255,${pulse})`;
      ctx.fillRect(w.x * TILE, w.y * TILE, w.w * TILE, w.h * TILE);
      ctx.strokeStyle = 'rgba(180,230,255,0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(w.x * TILE, w.y * TILE, w.w * TILE, w.h * TILE);
      ctx.fillStyle = '#cfeaff';
      ctx.font = '8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(w.label ?? w.to, (w.x + w.w / 2) * TILE, w.y * TILE - 3);
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

  drawEntities(ctx, state, now) {
    const ents = [...(state.ents ?? [])].sort((a, b) => a.y - b.y);
    for (const e of ents) {
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
