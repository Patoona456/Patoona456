/* =============================================================
   AETHERION ONLINE — Procedural Scene Painter
   วาดภาพประกอบฉากแบบสุ่มมีเมล็ด (seeded) ทุกครั้งที่เรื่องดำเนินไป
   ไม่ต้องพึ่ง asset ภายนอก ทุกเฟรมคำนวณสดบน <canvas>
   ============================================================= */
(function (global) {
  'use strict';

  /* ---------- สุ่มแบบมีเมล็ด เพื่อให้ฉากเดิมได้ภาพเดิม ---------- */
  function hashSeed(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function makeRng(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  /* ---------- จานสีของแต่ละชั้นฟ้า / อารมณ์ฉาก ---------- */
  var PALETTES = {
    plaza:    { sky: ['#0b1233', '#20347a', '#6f7fd6'], sun: '#ffd9a0', ground: '#141a38', mist: '#8fa4ff', accent: '#7ef0ff' },
    dawn:     { sky: ['#2a1338', '#7b3363', '#ffb27a'], sun: '#fff0c2', ground: '#2a1630', mist: '#ffc6a0', accent: '#ffd76e' },
    dusk:     { sky: ['#12071f', '#5c1f4a', '#e0674f'], sun: '#ffb46b', ground: '#1a0c22', mist: '#ff9f7d', accent: '#ff7a5c' },
    night:    { sky: ['#03040f', '#0a1030', '#1d2a63'], sun: '#dbe6ff', ground: '#05070f', mist: '#5f6fb5', accent: '#9fd4ff' },
    forest:   { sky: ['#04140f', '#0d3a2c', '#3f8f6a'], sun: '#d8ffcf', ground: '#04150f', mist: '#6fd9a8', accent: '#a6ff8f' },
    ruin:     { sky: ['#160d0a', '#4a2318', '#a8613a'], sun: '#ffca8c', ground: '#180d09', mist: '#c98a5e', accent: '#ff9f4d' },
    abyss:    { sky: ['#0a0010', '#2e0038', '#6b1060'], sun: '#ff6ad5', ground: '#0a0012', mist: '#b45cff', accent: '#ff5cc8' },
    glacier:  { sky: ['#04121c', '#0f4460', '#79c9e6'], sun: '#eaffff', ground: '#07161f', mist: '#9fe4ff', accent: '#8ff3ff' },
    server:   { sky: ['#000505', '#003028', '#00c48c'], sun: '#c9ffe9', ground: '#001410', mist: '#00e0a0', accent: '#00ffc2' },
    blood:    { sky: ['#120003', '#4d0512', '#c11534'], sun: '#ffd0d0', ground: '#140005', mist: '#ff5a72', accent: '#ff2d55' },
    gold:     { sky: ['#1a1102', '#6b4a06', '#f0c23a'], sun: '#fff4c2', ground: '#1b1305', mist: '#ffd97a', accent: '#ffcf40' }
  };

  var TERRAIN = ['spires', 'peaks', 'ruins', 'trees', 'city', 'void', 'ice', 'grid'];

  /* ---------- ตัวช่วยวาด ---------- */
  function lerp(a, b, t) { return a + (b - a) * t; }

  function withAlpha(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function skyGradient(ctx, w, h, pal) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, pal.sky[0]);
    g.addColorStop(0.55, pal.sky[1]);
    g.addColorStop(1, pal.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function stars(ctx, w, h, rng, pal, count) {
    for (var i = 0; i < count; i++) {
      var x = rng() * w, y = rng() * h * 0.65, r = rng() * 1.6 + 0.2;
      ctx.globalAlpha = 0.25 + rng() * 0.75;
      ctx.fillStyle = rng() > 0.85 ? pal.accent : '#ffffff';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function celestial(ctx, w, h, rng, pal) {
    var cx = w * (0.15 + rng() * 0.7), cy = h * (0.14 + rng() * 0.22), r = h * (0.05 + rng() * 0.07);
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 6);
    g.addColorStop(0, withAlpha(pal.sun, 0.95));
    g.addColorStop(0.18, withAlpha(pal.sun, 0.45));
    g.addColorStop(1, withAlpha(pal.sun, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = pal.sun;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    return { x: cx, y: cy, r: r };
  }

  /* วงแหวนอีเธอร์ — สัญลักษณ์ประจำโลก Aetherion */
  function etherRings(ctx, w, h, rng, pal, sun) {
    var rings = 2 + Math.floor(rng() * 3);
    ctx.save();
    ctx.translate(sun.x, sun.y);
    ctx.rotate(-0.35 + rng() * 0.7);
    for (var i = 0; i < rings; i++) {
      var rx = sun.r * (3 + i * 1.7), ry = rx * (0.16 + rng() * 0.12);
      ctx.strokeStyle = withAlpha(pal.accent, 0.35 - i * 0.07);
      ctx.lineWidth = 1 + rng() * 2;
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function floatingIslands(ctx, w, h, rng, pal) {
    var n = 2 + Math.floor(rng() * 4);
    for (var i = 0; i < n; i++) {
      var x = rng() * w, y = h * (0.18 + rng() * 0.4), s = h * (0.03 + rng() * 0.09);
      var depth = 0.25 + rng() * 0.45;
      ctx.fillStyle = withAlpha(pal.ground, depth + 0.3);
      ctx.beginPath();
      ctx.moveTo(x - s, y);
      ctx.lineTo(x + s, y);
      ctx.lineTo(x + s * 0.35, y + s * 1.5);
      ctx.lineTo(x - s * 0.15, y + s * 2.1);
      ctx.lineTo(x - s * 0.7, y + s * 1.2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = withAlpha(pal.mist, depth * 0.5);
      ctx.fillRect(x - s, y - s * 0.12, s * 2, s * 0.14);
      // น้ำตกอีเธอร์ที่ไหลลงจากเกาะ
      if (rng() > 0.5) {
        ctx.strokeStyle = withAlpha(pal.accent, 0.18);
        ctx.lineWidth = s * 0.12;
        ctx.beginPath();
        ctx.moveTo(x + s * 0.1, y + s * 1.2);
        ctx.lineTo(x + s * 0.1 + (rng() - 0.5) * s, h);
        ctx.stroke();
      }
    }
  }

  /* ---------- แนวขอบฟ้าตามชนิดภูมิประเทศ ---------- */
  function ridge(ctx, w, h, rng, color, baseY, amp, step, jag) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    var y = baseY;
    for (var x = 0; x <= w + step; x += step) {
      y += (rng() - 0.5) * amp;
      y = Math.max(baseY - amp * jag, Math.min(baseY + amp * jag, y));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath(); ctx.fill();
  }

  function drawSpires(ctx, w, h, rng, pal, layer, color) {
    var baseY = h * (0.62 + layer * 0.08);
    ctx.fillStyle = color;
    var count = 6 + Math.floor(rng() * 10);
    for (var i = 0; i < count; i++) {
      var x = rng() * w, bw = w * (0.01 + rng() * 0.035), hh = h * (0.12 + rng() * 0.35) * (1 - layer * 0.3);
      ctx.beginPath();
      ctx.moveTo(x - bw, baseY);
      ctx.lineTo(x, baseY - hh);
      ctx.lineTo(x + bw, baseY);
      ctx.closePath(); ctx.fill();
      if (rng() > 0.7) {
        ctx.fillStyle = withAlpha(pal.accent, 0.5);
        ctx.fillRect(x - 1, baseY - hh - 4, 2, 4);
        ctx.fillStyle = color;
      }
    }
    ctx.fillRect(0, baseY, w, h - baseY);
  }

  function drawCity(ctx, w, h, rng, pal, layer, color) {
    var baseY = h * (0.66 + layer * 0.07);
    ctx.fillStyle = color;
    var x = -10;
    while (x < w) {
      var bw = w * (0.02 + rng() * 0.06), bh = h * (0.06 + rng() * 0.28) * (1 - layer * 0.35);
      ctx.fillRect(x, baseY - bh, bw, bh + (h - baseY));
      // หน้าต่างเรืองแสง
      if (layer === 0) {
        for (var wy = baseY - bh + 6; wy < baseY - 4; wy += 9) {
          for (var wx = x + 4; wx < x + bw - 4; wx += 7) {
            if (rng() > 0.55) {
              ctx.fillStyle = withAlpha(pal.accent, 0.15 + rng() * 0.6);
              ctx.fillRect(wx, wy, 2.5, 3.5);
              ctx.fillStyle = color;
            }
          }
        }
      }
      x += bw + w * 0.004;
    }
  }

  function drawTrees(ctx, w, h, rng, pal, layer, color) {
    var baseY = h * (0.68 + layer * 0.07);
    ctx.fillStyle = color;
    ctx.fillRect(0, baseY, w, h - baseY);
    var count = 18 + Math.floor(rng() * 26);
    for (var i = 0; i < count; i++) {
      var x = rng() * w, th = h * (0.08 + rng() * 0.22) * (1 - layer * 0.3), tw = th * 0.26;
      ctx.beginPath();
      ctx.moveTo(x, baseY - th);
      ctx.lineTo(x + tw, baseY + 2);
      ctx.lineTo(x - tw, baseY + 2);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawRuins(ctx, w, h, rng, pal, layer, color) {
    var baseY = h * (0.7 + layer * 0.06);
    ctx.fillStyle = color;
    ctx.fillRect(0, baseY, w, h - baseY);
    var count = 5 + Math.floor(rng() * 8);
    for (var i = 0; i < count; i++) {
      var x = rng() * w, cw = w * (0.008 + rng() * 0.014), ch = h * (0.06 + rng() * 0.26) * (1 - layer * 0.3);
      ctx.fillRect(x, baseY - ch, cw, ch);
      if (rng() > 0.5) ctx.fillRect(x - cw, baseY - ch - cw, cw * 3.4, cw * 1.2); // หัวเสาหัก
    }
    // ซุ้มประตูพัง
    if (layer === 0 && rng() > 0.4) {
      var ax = w * (0.2 + rng() * 0.6), aw = w * 0.09, ah = h * 0.22;
      ctx.fillRect(ax - aw, baseY - ah, aw * 0.22, ah);
      ctx.fillRect(ax + aw * 0.78, baseY - ah * 0.8, aw * 0.22, ah * 0.8);
    }
  }

  function drawIce(ctx, w, h, rng, pal, layer, color) {
    var baseY = h * (0.64 + layer * 0.08);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, h);
    var x = 0;
    while (x < w) {
      var pw = w * (0.05 + rng() * 0.12);
      ctx.lineTo(x + pw * 0.5, baseY - h * (0.03 + rng() * 0.2) * (1 - layer * 0.35));
      ctx.lineTo(x + pw, baseY);
      x += pw;
    }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  }

  function drawVoid(ctx, w, h, rng, pal, layer, color) {
    var cx = w * 0.5, cy = h * 0.45;
    ctx.strokeStyle = withAlpha(pal.accent, 0.25 - layer * 0.07);
    for (var i = 0; i < 14; i++) {
      ctx.lineWidth = 0.5 + rng() * 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * (0.05 + i * 0.045), h * (0.03 + i * 0.03), rng() * 0.4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.fillRect(0, h * (0.82 + layer * 0.05), w, h);
  }

  function drawGrid(ctx, w, h, rng, pal, layer, color) {
    var horizon = h * 0.62;
    ctx.fillStyle = color;
    ctx.fillRect(0, horizon, w, h - horizon);
    ctx.strokeStyle = withAlpha(pal.accent, 0.35 - layer * 0.1);
    ctx.lineWidth = 1;
    for (var i = -20; i <= 20; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * w * 0.02, horizon);
      ctx.lineTo(w / 2 + i * w * 0.35, h);
      ctx.stroke();
    }
    for (var k = 0; k < 16; k++) {
      var t = k / 16, y = horizon + Math.pow(t, 2.4) * (h - horizon);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  }

  var TERRAIN_FN = {
    spires: drawSpires, peaks: function (c, w, h, r, p, l, col) { ridge(c, w, h, r, col, h * (0.55 + l * 0.1), h * 0.06, w * 0.05, 2.2); },
    ruins: drawRuins, trees: drawTrees, city: drawCity, void: drawVoid, ice: drawIce, grid: drawGrid
  };

  /* ---------- เงาตัวละครหน้าฉาก ---------- */
  function silhouette(ctx, x, groundY, sc, color, pose) {
    ctx.save();
    ctx.translate(x, groundY);
    ctx.scale(sc, sc);
    ctx.fillStyle = color;
    // ลำตัว
    ctx.beginPath();
    ctx.moveTo(-7, 0); ctx.lineTo(-5, -26); ctx.lineTo(5, -26); ctx.lineTo(7, 0);
    ctx.closePath(); ctx.fill();
    // หัว
    ctx.beginPath(); ctx.arc(0, -33, 6, 0, Math.PI * 2); ctx.fill();
    // ผ้าคลุม
    ctx.beginPath();
    ctx.moveTo(-6, -26); ctx.lineTo(-14, 2); ctx.lineTo(-4, -2); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6, -26); ctx.lineTo(14, 2); ctx.lineTo(4, -2); ctx.closePath(); ctx.fill();
    if (pose === 'sword') {
      ctx.save(); ctx.rotate(-0.35);
      ctx.fillRect(7, -46, 3, 34);
      ctx.fillRect(2, -14, 13, 3);
      ctx.restore();
    } else if (pose === 'staff') {
      ctx.fillRect(9, -52, 2.5, 56);
      ctx.beginPath(); ctx.arc(10, -54, 5, 0, Math.PI * 2); ctx.fill();
    } else if (pose === 'bow') {
      ctx.beginPath();
      ctx.arc(11, -26, 16, -1.2, 1.2);
      ctx.lineWidth = 2.4; ctx.strokeStyle = color; ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- บอส / มอนสเตอร์เป็นเงาใหญ่ ---------- */
  function monster(ctx, w, h, rng, pal) {
    var cx = w * (0.35 + rng() * 0.3), base = h * 0.92, s = h * (0.0085 + rng() * 0.005);
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.save();
    ctx.translate(cx, base);
    ctx.scale(s * 14, s * 14);
    ctx.beginPath();
    ctx.moveTo(-14, 0); ctx.lineTo(-10, -20); ctx.lineTo(-16, -30);
    ctx.lineTo(-6, -26); ctx.lineTo(0, -40); ctx.lineTo(6, -26);
    ctx.lineTo(16, -30); ctx.lineTo(10, -20); ctx.lineTo(14, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // ดวงตาเรืองแสง
    ctx.fillStyle = pal.accent;
    ctx.shadowBlur = 18; ctx.shadowColor = pal.accent;
    ctx.beginPath(); ctx.arc(cx - s * 50, base - s * 400, s * 15, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + s * 50, base - s * 400, s * 15, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  /* ---------- เอฟเฟกต์รวม ---------- */
  function particles(ctx, w, h, rng, pal, n) {
    for (var i = 0; i < n; i++) {
      var x = rng() * w, y = rng() * h, r = rng() * 2.2 + 0.4;
      ctx.fillStyle = withAlpha(pal.accent, 0.1 + rng() * 0.5);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function fog(ctx, w, h, pal, strength) {
    var g = ctx.createLinearGradient(0, h * 0.45, 0, h);
    g.addColorStop(0, withAlpha(pal.mist, 0));
    g.addColorStop(1, withAlpha(pal.mist, strength));
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.45, w, h * 0.55);
  }

  function scanlines(ctx, w, h) {
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#000';
    for (var y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    ctx.globalAlpha = 1;
  }

  function vignette(ctx, w, h) {
    var g = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function glitch(ctx, w, h, rng, amount) {
    for (var i = 0; i < amount; i++) {
      var y = rng() * h, sh = 2 + rng() * 12, dx = (rng() - 0.5) * w * 0.09;
      try {
        var slice = ctx.getImageData(0, y, w, sh);
        ctx.putImageData(slice, dx, y);
      } catch (e) { /* canvas ถูก taint — ข้ามไป */ }
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255,45,85,0.16)' : 'rgba(0,255,194,0.16)';
      ctx.fillRect(0, y, w, sh * 0.5);
    }
  }

  /* =============================================================
     API หลัก: Art.paint(canvas, spec)
     spec = { seed, palette, terrain, mood, figures, boss, glitch, title }
     ============================================================= */
  function paint(canvas, spec) {
    spec = spec || {};
    var rng = makeRng(hashSeed(String(spec.seed || 'aetherion')));
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth || 960;
    var h = canvas.clientHeight || 420;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var pal = PALETTES[spec.palette] || PALETTES.plaza;
    var terrain = spec.terrain || TERRAIN[Math.floor(rng() * TERRAIN.length)];

    skyGradient(ctx, w, h, pal);
    if (spec.palette === 'night' || spec.palette === 'abyss' || spec.palette === 'server') {
      stars(ctx, w, h, rng, pal, 140);
    } else {
      stars(ctx, w, h, rng, pal, 40);
    }
    var sun = celestial(ctx, w, h, rng, pal);
    etherRings(ctx, w, h, rng, pal, sun);
    floatingIslands(ctx, w, h, rng, pal);

    // ภูมิประเทศ 3 ชั้น ไล่จากไกลไปใกล้
    var fn = TERRAIN_FN[terrain] || drawSpires;
    for (var layer = 2; layer >= 0; layer--) {
      var t = layer / 2;
      var col = 'rgba(' +
        Math.round(lerp(12, 70, t)) + ',' +
        Math.round(lerp(14, 86, t)) + ',' +
        Math.round(lerp(30, 130, t)) + ',' + (1 - t * 0.25) + ')';
      fn(ctx, w, h, rng, pal, layer, layer === 0 ? pal.ground : col);
    }

    fog(ctx, w, h, pal, spec.mood === 'calm' ? 0.18 : 0.34);
    if (spec.boss) monster(ctx, w, h, rng, pal);

    // ตัวละครหน้าฉาก
    var figures = spec.figures == null ? 1 + Math.floor(rng() * 3) : spec.figures;
    var poses = ['sword', 'staff', 'bow', 'none'];
    for (var i = 0; i < figures; i++) {
      var fx = w * (0.12 + rng() * 0.76);
      var fy = h * (0.88 + rng() * 0.08);
      silhouette(ctx, fx, fy, 0.9 + rng() * 0.8, 'rgba(0,0,0,0.88)', poses[Math.floor(rng() * poses.length)]);
    }

    particles(ctx, w, h, rng, pal, spec.mood === 'tense' ? 120 : 60);
    vignette(ctx, w, h);
    scanlines(ctx, w, h);
    if (spec.glitch) glitch(ctx, w, h, rng, spec.glitch);

    return { palette: pal, terrain: terrain };
  }

  global.Art = { paint: paint, PALETTES: PALETTES, TERRAIN: TERRAIN, hashSeed: hashSeed, makeRng: makeRng };
})(window);
