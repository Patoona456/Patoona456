// Wings, drawn in code like every other asset in this game.
//
// Six styles, each a pair of wings with three flap frames, rendered once
// into small canvases and then blitted behind the character. They face the
// three poses the LPC sheets need - seen from behind, from the front, and
// from the side - so a flying cloak never looks pasted on.
const cache = new Map();

export const WING_STYLES = {
  feather: { nameTh: 'ปีกนางฟ้า', colors: ['#f6f2e6', '#d9d2c0', '#fff'], kind: 'feather' },
  raven:   { nameTh: 'ปีกอีกา', colors: ['#3a3a48', '#21212b', '#5b5b6e'], kind: 'feather' },
  bat:     { nameTh: 'ปีกค้างคาว', colors: ['#5a2b3c', '#361a25', '#7b3b52'], kind: 'membrane' },
  ember:   { nameTh: 'ปีกเปลวไฟ', colors: ['#ff9b3d', '#e2521a', '#ffd27a'], kind: 'flame', glow: '255,150,60' },
  frost:   { nameTh: 'ปีกน้ำแข็ง', colors: ['#bfe9ff', '#7cc0e6', '#ffffff'], kind: 'crystal', glow: '150,220,255' },
  dawn:    { nameTh: 'ปีกรุ่งอรุณ', colors: ['#ffe9a8', '#ffb03a', '#fff6d8'], kind: 'feather', glow: '255,205,110' },
};

// The body sprite is 64px tall; wings need to read at a glance from a
// zoomed-out phone, so they span wider than the character and sit at
// shoulder height rather than behind the hips.
const W = 128, H = 96;
const REACH = 1.7;         // how far past the shoulders the feathers go

function canvas() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  return c;
}

/** One half-wing, mirrored by the caller. `open` is 0..1 (folded..spread). */
function halfWing(g, style, open, side) {
  const [main, dark, light] = style.colors;
  const spread = 0.45 + open * 0.55;
  g.save();
  g.translate(W / 2, H * 0.44);
  g.scale(side * REACH, REACH);
  g.rotate(0.06 + (1 - open) * 0.45);   // swept out and a little down, not up like a halo

  if (style.kind === 'membrane') {
    // bat: three fingers with skin stretched between them
    g.fillStyle = main;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(16 * spread, -14 * spread, 30 * spread, -6 * spread);
    g.quadraticCurveTo(22 * spread, 2, 26 * spread, 12 * spread);
    g.quadraticCurveTo(16 * spread, 4, 12 * spread, 14 * spread);
    g.quadraticCurveTo(6 * spread, 6, 0, 10);
    g.closePath();
    g.fill();
    g.strokeStyle = dark; g.lineWidth = 1.6; g.lineJoin = 'round';
    g.stroke();
    g.strokeStyle = dark; g.lineWidth = 1;
    for (const t of [0.45, 0.75]) {
      g.beginPath();
      g.moveTo(0, 1);
      g.quadraticCurveTo(14 * spread * t, -6 * spread, 26 * spread * t, 10 * spread * t);
      g.stroke();
    }
  } else if (style.kind === 'crystal') {
    // shards fanned out, lit along one edge
    for (let i = 0; i < 4; i++) {
      const a = -0.85 + i * 0.36;
      const len = (26 - i * 3) * spread;
      g.save();
      g.rotate(a);
      g.fillStyle = i % 2 ? main : light;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(len, -3.5);
      g.lineTo(len + 4, 0);
      g.lineTo(len, 3.5);
      g.closePath();
      g.fill();
      g.strokeStyle = dark; g.lineWidth = 0.8; g.stroke();
      g.restore();
    }
  } else if (style.kind === 'flame') {
    // tongues of fire, longest in the middle
    for (let i = 0; i < 5; i++) {
      const a = -0.95 + i * 0.3;
      const len = (14 + Math.sin(i * 1.7) * 6 + open * 14) * (1 + spread * 0.5);
      g.save();
      g.rotate(a);
      const grad = g.createLinearGradient(0, 0, len, 0);
      grad.addColorStop(0, dark);
      grad.addColorStop(0.5, main);
      grad.addColorStop(1, light);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, -3);
      g.quadraticCurveTo(len * 0.6, -6, len, 0);
      g.quadraticCurveTo(len * 0.6, 6, 0, 3);
      g.closePath();
      g.fill();
      g.restore();
    }
  } else {
    // feathers: three rows, the longest at the bottom
    for (let row = 0; row < 3; row++) {
      const count = 5 - row;
      for (let i = 0; i < count; i++) {
        const a = -0.72 + i * (1.62 / count) + row * 0.14;
        const len = (30 - row * 7) * spread - i * 1.5;
        g.save();
        g.rotate(a);
        g.fillStyle = row === 0 ? light : row === 1 ? main : dark;
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(len * 0.5, -4.5, len, -1);
        g.quadraticCurveTo(len * 0.5, 3.5, 0, 3);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 0.7; g.stroke();
        g.restore();
      }
    }
  }
  g.restore();
}

/**
 * @param pose 'back' (facing away), 'front', or 'side'
 * @param frame 0..2 flap position
 */
function render(styleId, pose, frame) {
  const style = WING_STYLES[styleId] ?? WING_STYLES.feather;
  const c = canvas();
  const g = c.getContext('2d');
  const open = [1, 0.78, 0.58][frame % 3];

  if (style.glow) {
    g.save();
    g.filter = 'blur(6px)';
    g.fillStyle = `rgba(${style.glow},0.45)`;
    g.beginPath();
    g.ellipse(W / 2, H * 0.44, 46 * open, 26 * open, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  if (pose === 'side') {
    // only the far wing shows, and it sits tighter to the body
    g.save();
    g.globalAlpha = 0.85;
    halfWing(g, style, open * 0.7, -1);
    g.restore();
  } else {
    const shrink = pose === 'front' ? 0.72 : 1;      // in front, they peek out
    g.save();
    g.translate(W / 2, H * 0.44);
    g.scale(shrink, shrink);
    g.translate(-W / 2, -H * 0.44);
    halfWing(g, style, open, -1);
    halfWing(g, style, open, 1);
    g.restore();
  }
  return c;
}

/** Cached sprite for a style, pose and flap frame. */
export function wingSprite(styleId, pose, frame) {
  const key = `${styleId}:${pose}:${frame}`;
  let c = cache.get(key);
  if (!c) { c = render(styleId, pose, frame); cache.set(key, c); }
  return c;
}

/** Draw the wings behind a character standing at (x, y). */
export function drawWings(ctx, styleId, { x, y, dir = 2, t = 0, scale = 1, moving = false }) {
  const pose = dir === 0 ? 'back' : dir === 2 ? 'front' : 'side';
  const speed = moving ? 150 : 260;
  const frame = Math.floor(t / speed) % 3;
  const img = wingSprite(styleId, pose, frame);
  const w = img.width * scale, h = img.height * scale;
  ctx.save();
  if (dir === 3) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
  // shoulder height: the top third of the body, not the feet
  ctx.drawImage(img, Math.round(x - w / 2), Math.round(y - h * 0.64), w, h);
  ctx.restore();
}
