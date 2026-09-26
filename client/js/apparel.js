// Cloaks, scarves, glasses and masks - drawn in code, like the wings.
//
// The art boards have sheets for all four and we have none, and the last two
// rounds of work were spent fixing weapons that pointed at art which could
// not draw them. An invisible slot is worse than a simple one: if a player
// buys a cloak and nothing changes on screen, the slot may as well not exist.
//
// So these are shapes, not sheets. They are small on purpose - a scarf is a
// band and a tail, a mask is a shape over the lower face - and they read at
// the zoom the game is actually played at rather than up close. When real
// sheets arrive, each of these becomes an art layer and the function here
// goes away; docs/ART.md says so.
//
// Everything is positioned against the character's feet at (x, y) with a
// 64px body, so a scaled or chibi character keeps its collar in the right
// place.
const HEAD_Y = -50;          // middle of the head, in body pixels above the feet
const NECK_Y = -38;

/** Facing 0 up, 1 left, 2 down, 3 right - the LPC row order. */
const isBack = (dir) => dir === 0;
const isSide = (dir) => dir === 1 || dir === 3;

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((v) => Math.max(0, Math.min(255, Math.round(v + amount))));
  return `rgb(${c.join(',')})`;
}

const CLOAK_STYLES = {
  wool:   { main: '#6b5a48', edge: '#4a3c30', glow: null },
  pelt:   { main: '#7c6a52', edge: '#4f412f', glow: null, ragged: true },
  shadow: { main: '#2b2436', edge: '#151020', glow: null, ragged: true },
  dawn:   { main: '#e9c887', edge: '#b98c3c', glow: '255,205,110' },
};

/**
 * A cloak hangs behind the character, so it is drawn before the body. It
 * sways with movement and spreads a little when seen from the back.
 */
export function drawCloak(ctx, style, { x, y, dir = 2, t = 0, scale = 1, moving = false }) {
  const s = CLOAK_STYLES[style] ?? CLOAK_STYLES.wool;
  const sway = Math.sin(t / (moving ? 130 : 420)) * (moving ? 3.2 : 1.1);
  const width = (isBack(dir) ? 17 : isSide(dir) ? 8 : 12) * scale;
  const top = y + NECK_Y * scale;
  const bottom = y - 6 * scale;

  ctx.save();
  if (s.glow) {
    ctx.shadowColor = `rgba(${s.glow},0.55)`;
    ctx.shadowBlur = 8 * scale;
  }
  ctx.beginPath();
  ctx.moveTo(x - width, top);
  ctx.lineTo(x + width, top);
  if (s.ragged) {
    // a torn hem: three points instead of one smooth curve
    ctx.lineTo(x + width * 1.15 + sway, bottom - 5 * scale);
    ctx.lineTo(x + width * 0.4 + sway, bottom);
    ctx.lineTo(x, bottom - 4 * scale);
    ctx.lineTo(x - width * 0.4 + sway, bottom);
    ctx.lineTo(x - width * 1.15 + sway, bottom - 5 * scale);
  } else {
    ctx.quadraticCurveTo(x + width * 1.2 + sway, bottom - 6 * scale, x + width * 0.75 + sway, bottom);
    ctx.lineTo(x - width * 0.75 + sway, bottom);
    ctx.quadraticCurveTo(x - width * 1.2 + sway, bottom - 6 * scale, x - width, top);
  }
  ctx.closePath();
  ctx.fillStyle = s.main;
  ctx.fill();
  ctx.lineWidth = Math.max(1, scale);
  ctx.strokeStyle = s.edge;
  ctx.stroke();
  ctx.restore();
}

/** A scarf sits on the collar, with one tail that lifts when you run. */
export function drawScarf(ctx, scarf, { x, y, dir = 2, t = 0, scale = 1, moving = false }) {
  const color = scarf?.color ?? '#b8503f';
  const w = (isSide(dir) ? 6 : 8) * scale;
  const yy = y + NECK_Y * scale;
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x - w), Math.round(yy), Math.round(w * 2), Math.round(3 * scale));
  // the tail, behind on the way up and beside you on the way round
  if (!isBack(dir)) {
    const lift = moving ? Math.sin(t / 110) * 3 * scale : Math.sin(t / 460) * 1.2 * scale;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, yy + 2 * scale);
    ctx.lineTo(x + w * 1.5, yy + 5 * scale - lift);
    ctx.lineTo(x + w * 0.6, yy + 8 * scale);
    ctx.closePath();
    ctx.fillStyle = shade(color, -28);
    ctx.fill();
  }
  ctx.restore();
}

/** Glasses, only when there is a face to put them on. */
export function drawGlasses(ctx, glasses, { x, y, dir = 2, scale = 1 }) {
  if (isBack(dir)) return;                     // the back of a head wears nothing
  const color = glasses?.color ?? '#cfd6df';
  const yy = y + HEAD_Y * scale + 2 * scale;
  const r = 2.4 * scale;
  const gap = (isSide(dir) ? 2.2 : 3.4) * scale;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, scale * 0.9);
  ctx.fillStyle = 'rgba(180,220,255,.28)';
  for (const side of isSide(dir) ? [dir === 3 ? 1 : -1] : [-1, 1]) {
    ctx.beginPath();
    if (glasses?.style === 'square') ctx.rect(x + side * gap - r, yy - r, r * 2, r * 2);
    else ctx.arc(x + side * gap, yy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (!isSide(dir)) {
    ctx.beginPath();
    ctx.moveTo(x - gap + r, yy);
    ctx.lineTo(x + gap - r, yy);
    ctx.stroke();
  }
  ctx.restore();
}

/** A mask covers the lower face, so it is drawn over the head art. */
export function drawMask(ctx, mask, { x, y, dir = 2, scale = 1 }) {
  if (isBack(dir)) return;
  const color = mask?.color ?? '#8d8578';
  const yy = y + HEAD_Y * scale + 5 * scale;
  const w = (isSide(dir) ? 4 : 5.5) * scale;
  ctx.save();
  ctx.fillStyle = color;
  if (mask?.style === 'beak') {
    ctx.beginPath();
    ctx.moveTo(x - w, yy - 2 * scale);
    ctx.lineTo(x + w, yy - 2 * scale);
    ctx.lineTo(x + (isSide(dir) ? w * 2.1 : 0), yy + 6 * scale);
    ctx.closePath();
    ctx.fill();
  } else if (mask?.style === 'skull') {
    ctx.fillRect(Math.round(x - w), Math.round(yy - 3 * scale), Math.round(w * 2), Math.round(7 * scale));
    ctx.fillStyle = shade(color, -90);
    const eye = 1.4 * scale;
    for (const side of isSide(dir) ? [dir === 3 ? 1 : -1] : [-1, 1]) {
      ctx.fillRect(Math.round(x + side * 2.4 * scale - eye / 2), Math.round(yy - 2 * scale), Math.round(eye), Math.round(eye));
    }
  } else {
    ctx.fillRect(Math.round(x - w), Math.round(yy - 1 * scale), Math.round(w * 2), Math.round(5 * scale));
  }
  ctx.restore();
}

/** Everything drawn behind the character. */
export function drawBehind(ctx, defs, opts) {
  if (defs.cloak) drawCloak(ctx, defs.cloak.style, opts);
}

/** Everything drawn over the character, back to front. */
export function drawInFront(ctx, defs, opts) {
  if (defs.scarf) drawScarf(ctx, defs.scarf, opts);
  if (defs.glasses) drawGlasses(ctx, defs.glasses, opts);
  if (defs.mask) drawMask(ctx, defs.mask, opts);
}

/** The code-drawn pieces a set of worn item ids amounts to. */
export function apparelOf(equipment, items) {
  const out = {};
  for (const key of ['cloak', 'scarf', 'glasses', 'mask']) {
    const def = items[equipment?.[key]];
    if (def?.[key]) out[key] = def[key];
  }
  return out;
}
