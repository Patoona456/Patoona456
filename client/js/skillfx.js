// Skill effects, drawn per element.
//
// Before this file every skill in the game shared five primitive shapes: a
// thin circle for anything with a radius, a straight line for anything with a
// direction, and three small rings. Fifty-six skills looked like five.
//
// Now the *shape* comes from what the skill does (`fx`) and the *look* comes
// from its element, so a fire nova and an ice nova are the same motion in two
// completely different palettes. Everything is drawn in the same four passes:
//
//   1. bloom   - two wide faint additive passes underneath, for the light
//   2. body    - the crisp shape, the part the eye actually reads
//   3. core    - a smaller, near-white copy, so the middle looks hot
//   4. debris  - sparks, shards or motes thrown off by the shape
//
// A ground scorch is left behind by the effects that hit the floor, and it
// fades on its own clock - the effect is gone long before the mark is.
import { look, rgba } from '../../shared/elements.js';

const TAU = Math.PI * 2;

/** Effects that leave a mark on the floor, and how long the mark lasts. */
const SCORCH = { aoe: 900, ground: 1600, debuff: 700, nova: 900 };

/* ============================ helpers ============================ */

function ease(k) { return 1 - (1 - k) * (1 - k); }        // fast then settle
function eased(k) { return k * k; }                        // slow then rush

/** Deterministic jitter so a shape does not crawl between frames. */
function wob(seed, i, n = 1) {
  return Math.sin(seed * 12.9898 + i * 78.233) * n;
}

/**
 * A ring of spikes: the workhorse behind every radial effect. `shape` decides
 * whether the spikes lick like flame, stab like ice or fork like lightning.
 */
function spikes(ctx, el, { x, y, r, k, count, shape, seed = 0, len = 1, width = 1 }) {
  const L = look(el);
  ctx.lineWidth = 2 * width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + L.spin * k * 3 + seed;
    const wobble = wob(seed + i, i, 0.22);
    const reach = r * (0.82 + wob(seed, i, 0.18)) * len;
    const cx = x + Math.cos(a) * r, cy = y + Math.sin(a) * r * 0.62;
    const ex = x + Math.cos(a + wobble) * reach, ey = y + Math.sin(a + wobble) * reach * 0.62;

    ctx.beginPath();
    if (shape === 'flame') {
      // a tongue: wide at the ring, pinched at the tip, bent sideways
      const mx = (cx + ex) / 2 - Math.sin(a) * 7 * width, my = (cy + ey) / 2 + Math.cos(a) * 5 * width;
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(mx, my, ex, ey - 6 * width);
      ctx.quadraticCurveTo(mx + 3, my + 3, cx, cy);
    } else if (shape === 'shard') {
      // a splinter of ice, flat on one side
      const nx = -Math.sin(a) * 3.4 * width, ny = Math.cos(a) * 3.4 * width;
      ctx.moveTo(cx + nx, cy + ny);
      ctx.lineTo(ex, ey);
      ctx.lineTo(cx - nx, cy - ny);
      ctx.closePath();
    } else if (shape === 'arc') {
      // lightning: three jagged steps out from the ring
      ctx.moveTo(cx, cy);
      for (let s = 1; s <= 3; s++) {
        const t = s / 3;
        const j = wob(seed + i * 3, s, 9) * (1 - t) * width;
        ctx.lineTo(cx + (ex - cx) * t - Math.sin(a) * j, cy + (ey - cy) * t + Math.cos(a) * j);
      }
    } else if (shape === 'ray') {
      // a clean spear of light
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
    } else if (shape === 'smoke') {
      // a curl that folds back on itself
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(
        cx + (ex - cx) * 0.6 - Math.sin(a) * 12 * width,
        cy + (ey - cy) * 0.6 + Math.cos(a) * 9 * width, ex, ey,
      );
    } else {
      // motes and plain slashes: a short dash
      ctx.moveTo(cx + (ex - cx) * 0.4, cy + (ey - cy) * 0.4);
      ctx.lineTo(ex, ey);
    }
    if (shape === 'shard' || shape === 'flame') ctx.fill(); else ctx.stroke();
  }
}

/** A pool of light under a radial effect: what makes it read as mass. */
function disc(ctx, el, x, y, r, alpha) {
  if (alpha <= 0 || r <= 0) return;
  const was = ctx.fillStyle;                 // the shape's own fill must survive this
  const g = ctx.createRadialGradient(x, y, 1, x, y, r);
  g.addColorStop(0, rgba(el, 'core', alpha * 0.75));
  g.addColorStop(0.4, rgba(el, 'main', alpha * 0.9));
  g.addColorStop(1, rgba(el, 'main', 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.62, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = was;
}

/** The flat ellipse every radial effect is built on. */
function ring(ctx, x, y, r, width) {
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.62, 0, 0, TAU);
  ctx.stroke();
}

/** A bolt or beam between two points, drawn in the element's manner. */
function stroke(ctx, el, { x, y, tx, ty, k, shape, seed = 0, width = 1 }) {
  const dx = tx - x, dy = ty - y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  ctx.lineWidth = 4 * width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (shape === 'arc') {
    // forked lightning: the bolt zig-zags and throws one branch
    const steps = 7;
    ctx.moveTo(x, y);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const j = s === steps ? 0 : wob(seed, s, 11) * width;
      ctx.lineTo(x + dx * t + nx * j, y + dy * t + ny * j);
    }
    const bt = 0.55;
    ctx.moveTo(x + dx * bt, y + dy * bt);
    ctx.lineTo(x + dx * (bt + 0.2) + nx * 16 * width, y + dy * (bt + 0.2) + ny * 16 * width);
  } else if (shape === 'flame' || shape === 'smoke') {
    // a rolling billow rather than a straight line
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + dx * 0.5 + nx * 14 * width, y + dy * 0.5 + ny * 14 * width, tx, ty);
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + dx * 0.5 - nx * 9 * width, y + dy * 0.5 - ny * 9 * width, tx, ty);
  } else if (shape === 'shard') {
    // a lance: thick at the caster, a point at the target
    ctx.moveTo(x + nx * 5 * width, y + ny * 5 * width);
    ctx.lineTo(tx, ty);
    ctx.lineTo(x - nx * 5 * width, y - ny * 5 * width);
    ctx.closePath();
    ctx.fill();
    return;
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(tx, ty);
  }
  ctx.stroke();
  void k;
}

/* ============================ the shapes ============================ */

/**
 * One effect, drawn once. `pass` is 'bloom' | 'body' | 'core' and only
 * changes colour and line weight - the geometry is identical, which is what
 * makes the three passes line up.
 */
function shape(ctx, f, k, pass) {
  const el = f.el ?? 'neutral';
  const L = look(el);
  const seed = f.seed ?? 0;
  const width = pass === 'haze' ? 4.2 : pass === 'bloom' ? 2.1 : pass === 'core' ? 0.5 : 1.35;
  const tone = pass === 'core' || pass === 'bloom' ? 'core' : 'main';
  const alpha = pass === 'body' ? 0.95 : 1;
  ctx.strokeStyle = rgba(el, tone, alpha);
  ctx.fillStyle = rgba(el, tone, alpha * 0.85);

  switch (f.fx) {
    case 'ascend': {
      // a pillar the character grows into: light climbs from the feet, rings
      // fall inward around them, and the ground keeps a bright footprint
      const big = f.big ? 1 : 0;
      const h = (68 + big * 54) * Math.min(1, k * 2.2);
      const halfW = (14 + big * 10) * width;
      const g = ctx.createLinearGradient(f.x, f.y + 4, f.x, f.y - h);
      g.addColorStop(0, rgba(el, 'core', alpha * 0.42));
      g.addColorStop(0.35, rgba(el, tone, alpha * 0.34));
      g.addColorStop(1, rgba(el, tone, 0));
      ctx.fillStyle = g;
      ctx.fillRect(f.x - halfW, f.y - h, halfW * 2, h + 4);

      // rings dropping down the pillar, three of them, evenly spaced
      for (let i = 0; i < 3 + big; i++) {
        const t = (k * 1.6 + i / (3 + big)) % 1;
        ctx.globalAlpha = Math.sin(t * Math.PI) * 0.9;
        ring(ctx, f.x, f.y - (1 - t) * h, (24 + big * 16) * (0.5 + t * 0.7), 2.4 * width);
      }
      ctx.globalAlpha = 1;

      // the flare at the floor, and the crown at the top
      disc(ctx, el, f.x, f.y, (34 + big * 26) * (0.6 + k), (1 - k) * 0.32);
      spikes(ctx, el, {
        x: f.x, y: f.y - h * 0.92, r: (8 + big * 8), k,
        count: 8 + big * 4, shape: 'ray', seed, len: 2.2 + big, width: width * 1.2,
      });
      break;
    }
    case 'impact': {
      // the moment of contact: a hard ring that snaps outward, a few shards
      // thrown along the blow, and nothing left behind
      const r = (f.r ?? 24) * (0.2 + eased(1 - (1 - k) * (1 - k)) * 1.6);
      ctx.lineWidth = 3.2 * width * (1 - k);
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, r, r * 0.72, 0, 0, TAU);
      ctx.stroke();
      spikes(ctx, el, { x: f.x, y: f.y, r: r * 0.5, k, count: 6, shape: L.shape, seed, len: 1.8, width: width * 1.2 });
      break;
    }
    case 'aoe':
    case 'nova': {
      const r = (f.r ?? 48) * (0.25 + ease(k) * 0.85);
      disc(ctx, el, f.x, f.y, r * 1.15, (1 - k) * (pass === 'body' ? 0.34 : 0.22));
      ring(ctx, f.x, f.y, r, 2.2 * width);
      spikes(ctx, el, { x: f.x, y: f.y, r: r * 0.72, k, count: 11, shape: L.shape, seed, len: 2.0, width: width * 1.5 });
      break;
    }
    case 'ground': {
      // a rune that draws itself, holds, then sinks
      const r = f.r ?? 60;
      const grow = Math.min(1, k * 3);
      disc(ctx, el, f.x, f.y, r * grow, 0.20);
      ring(ctx, f.x, f.y, r * grow, 2.8 * width);
      ring(ctx, f.x, f.y, r * grow * 0.66, 1.6 * width);
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(k * L.spin * 2);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * grow * 0.66, Math.sin(a) * r * grow * 0.41);
        ctx.lineTo(Math.cos(a) * r * grow, Math.sin(a) * r * grow * 0.62);
        ctx.stroke();
      }
      ctx.restore();
      spikes(ctx, el, { x: f.x, y: f.y, r: r * 0.5 * grow, k, count: 8, shape: L.shape, seed, len: 1.1, width });
      break;
    }
    case 'debuff': {
      // pulls inward instead of pushing out: the ring closes on the target
      const r = (f.r ?? 60) * (1.15 - ease(k) * 0.75);
      disc(ctx, el, f.x, f.y, r, k * 0.28);
      ring(ctx, f.x, f.y, r, 2.8 * width);
      spikes(ctx, el, { x: f.x, y: f.y, r, k, count: 10, shape: L.shape, seed, len: 0.55, width });
      break;
    }
    case 'bolt':
    case 'line':
      disc(ctx, el, f.tx ?? f.x, f.ty ?? f.y, 26 * (0.5 + ease(k)), (1 - k) * 0.4);
      stroke(ctx, el, { ...f, k, shape: L.shape, seed, width: width * 1.2 });
      break;
    case 'dash': {
      // the after-image of a body that moved
      const dx = f.tx - f.x, dy = f.ty - f.y;
      for (let i = 0; i < 5; i++) {
        const t = i / 5;
        ctx.globalAlpha = (1 - t) * (pass === 'bloom' ? 0.4 : 0.7);
        ctx.beginPath();
        ctx.ellipse(f.x + dx * t, f.y + dy * t - 18, 9 * width, 20 * width, 0, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      stroke(ctx, el, { ...f, k, shape: 'ray', seed, width: width * 0.6 });
      break;
    }
    case 'heal': {
      // a column of light with petals rising through it
      const h = 46;
      const g = ctx.createLinearGradient(f.x, f.y + 4, f.x, f.y - h);
      g.addColorStop(0, rgba(el, tone, alpha * 0.5));
      g.addColorStop(1, rgba(el, tone, 0));
      ctx.fillStyle = g;
      ctx.fillRect(f.x - 13 * width, f.y - h, 26 * width, h + 4);
      ring(ctx, f.x, f.y, 20 * (0.5 + k), 2 * width);
      for (let i = 0; i < 6; i++) {
        const t = (k + i / 6) % 1;
        const a = seed + i * 1.7;
        ctx.globalAlpha = (1 - t) * 0.9;
        ctx.beginPath();
        ctx.ellipse(f.x + Math.sin(a + t * 4) * 12, f.y - t * h, 2.6 * width, 3.6 * width, a, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'buff': {
      // two rings climbing the body, plus a halo at the head
      for (let i = 0; i < 2; i++) {
        const t = (k + i * 0.5) % 1;
        ctx.globalAlpha = Math.sin(t * Math.PI) * 0.95;
        ring(ctx, f.x, f.y - t * 44, 20 * (1 - t * 0.35), 2.2 * width);
      }
      ctx.globalAlpha = 1;
      spikes(ctx, el, { x: f.x, y: f.y - 46, r: 13, k, count: 7, shape: L.shape, seed, len: 0.8, width: width * 0.8 });
      break;
    }
    case 'summon': {
      // a seal that opens: two counter-rotating rings and a rising flare
      const r = 26 * (0.4 + ease(k));
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(k * 2.4);
      ring(ctx, 0, 0, r, 2.4 * width);
      ctx.rotate(-k * 4.8);
      ring(ctx, 0, 0, r * 0.6, 1.8 * width);
      ctx.restore();
      ctx.globalAlpha = 1 - k;
      const g = ctx.createLinearGradient(f.x, f.y, f.x, f.y - 54 * k);
      g.addColorStop(0, rgba(el, tone, alpha));
      g.addColorStop(1, rgba(el, tone, 0));
      ctx.fillStyle = g;
      ctx.fillRect(f.x - 9 * width, f.y - 54 * k, 18 * width, 54 * k);
      ctx.globalAlpha = 1;
      break;
    }
    default:
      ring(ctx, f.x, f.y, (f.r ?? 30) * (0.4 + k), 2 * width);
      break;
  }
}

/* ============================ public API ============================ */

/**
 * Draw one live effect. `age`/`life` are in ms; the caller owns the list.
 * Returns the debris budget it wants spawned on its first frame, so the
 * particle system stays the one place particles are born.
 */
export function drawSkillFx(ctx, f, age) {
  const life = f.life ?? lifeOf(f);
  // the frame clock can read a hair *before* the effect was created, so this
  // is clamped at both ends - a negative k would feed negative radii to the
  // canvas, which throws and takes the rest of the frame down with it
  const k = Math.max(0, Math.min(1, age / life));
  const fade = f.fx === 'ground' ? Math.min(1, (1 - k) * 3) : 1 - eased(k);
  if (fade <= 0) return;

  ctx.save();
  ctx.globalAlpha = fade;

  // 1. bloom. A real blur filter costs more than the whole rest of the frame
  // once several effects overlap, so the glow is faked the cheap way: the same
  // geometry drawn twice, very wide and very faint, added rather than painted.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = fade * 0.18;
  shape(ctx, f, k, 'haze');
  ctx.globalAlpha = fade * 0.30;
  shape(ctx, f, k, 'bloom');
  ctx.restore();

  // 2. the shape itself
  shape(ctx, f, k, 'body');

  // 3. a hot middle
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = fade * 0.85;
  shape(ctx, f, k, 'core');
  ctx.restore();

  ctx.restore();
}

/**
 * A patch of floor that is about to become dangerous.
 *
 * The whole point is that it must be readable at a glance while people are
 * fighting, so it does three things at once: an outline that is there from
 * the first frame, a fill that sweeps round like a clock so the remaining
 * time is a *quantity* and not a guess, and a rim that thickens as the
 * moment arrives. It is deliberately not pretty - it is a warning.
 */
export function drawWarning(ctx, w, now) {
  const k = Math.max(0, Math.min(1, (now - w.t) / w.ms));
  const el = w.el ?? 'radiant';
  ctx.save();

  // the ground inside it, sweeping full as the timer runs out
  ctx.beginPath();
  ctx.ellipse(w.x, w.y, w.r, w.r * 0.62, 0, 0, TAU);
  ctx.fillStyle = rgba(el, 'deep', 0.24);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(w.x, w.y);
  ctx.arc(w.x, w.y, w.r * 1.7, -Math.PI / 2, -Math.PI / 2 + TAU * k);
  ctx.closePath();
  ctx.fillStyle = rgba(el, 'main', 0.30);
  ctx.fill();
  ctx.restore();

  // the edge, which is what the eye actually catches
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 2 + k * 3.5;
  ctx.strokeStyle = rgba(el, k > 0.8 ? 'core' : 'main', 0.55 + k * 0.45);
  ctx.beginPath();
  ctx.ellipse(w.x, w.y, w.r, w.r * 0.62, 0, 0, TAU);
  ctx.stroke();

  // and a last flare in the final fifth, so it is impossible to miss
  if (k > 0.8) {
    ctx.globalAlpha = (k - 0.8) * 5;
    disc(ctx, el, w.x, w.y, w.r, 0.3);
  }
  ctx.restore();
}

/** How long each kind of effect should live, in ms. */
export function lifeOf(f) {
  return { ground: 1500, heal: 700, buff: 900, summon: 700, dash: 320, aoe: 520, nova: 520, impact: 220, ascend: 1400 }[f.fx] ?? 460;
}

/** A dark mark left on the floor, or null if this effect does not leave one. */
export function scorchOf(f) {
  const life = SCORCH[f.fx];
  if (!life) return null;
  return { x: f.x, y: f.y, r: (f.r ?? 48) * 0.9, el: f.el ?? 'neutral', life };
}

/** Draws the floor marks. Called before entities so characters stand on them. */
export function drawScorch(ctx, marks, now) {
  for (let i = marks.length - 1; i >= 0; i--) {
    const m = marks[i];
    const k = (now - m.t) / m.life;
    if (k >= 1) { marks.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = (1 - k) * 0.45;
    const g = ctx.createRadialGradient(m.x, m.y, 1, m.x, m.y, m.r);
    g.addColorStop(0, rgba(m.el, 'deep', 0.55));
    g.addColorStop(0.7, rgba(m.el, 'deep', 0.22));
    g.addColorStop(1, rgba(m.el, 'deep', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, m.r, m.r * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

/** How much debris an effect throws, and in what colour. */
export function debrisOf(f) {
  const el = f.el ?? 'neutral';
  const L = look(el);
  const n = { aoe: 14, nova: 16, ground: 10, bolt: 7, line: 8, dash: 6, heal: 7, buff: 6, summon: 9, debuff: 6, impact: 0, ascend: 22 }[f.fx] ?? 6;
  return { color: L.main.join(','), n, power: f.fx === 'aoe' || f.fx === 'nova' ? 1.6 : 1 };
}
