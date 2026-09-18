// Procedural scenery sprites. Each prop is drawn once into a small offscreen
// canvas (anchor = bottom centre) and then blitted, so the world gets detail
// without shipping a single extra byte of art.

const cache = new Map();
export const GLOWING = new Set(['torch', 'campfire', 'lamp', 'crystal']);

const PAL = {
  bark: '#4a3526', barkDark: '#33241a', leaf: '#2f6b32', leaf2: '#3d8140', leaf3: '#25542a',
  dead: '#6b6153', stone: '#6a6a74', stoneDark: '#4a4a52', stoneLight: '#878792',
  bone: '#d9d2bd', boneDark: '#a8a08a', ice: '#9fdcff', iceDark: '#5fa9d8',
  snow: '#e8f1f8', ash: '#57514c', wood: '#7a5a37', woodDark: '#573f26',
  cloth: '#8a3b3b', gold: '#d9b45a', flame: '#ffb347', flameHot: '#ffe08a',
  moss: '#3f6b3a', reed: '#6f7c3a',
};

function make(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  return c;
}
const rect = (g, x, y, w, h, fill) => { g.fillStyle = fill; g.fillRect(x, y, w, h); };
function blob(g, x, y, r, fill) {
  g.fillStyle = fill;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}
function shadow(g, w, h, rx = 9) {
  g.save();
  g.globalAlpha = 0.25; g.fillStyle = '#000';
  g.beginPath(); g.ellipse(w / 2, h - 3, rx, rx * 0.36, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

const DRAW = {
  tree: (g, w, h) => {
    shadow(g, w, h, 10);
    rect(g, w / 2 - 3, h - 18, 6, 16, PAL.bark);
    rect(g, w / 2 - 3, h - 18, 2, 16, PAL.barkDark);
    blob(g, w / 2, h - 28, 13, PAL.leaf3);
    blob(g, w / 2 - 6, h - 32, 10, PAL.leaf);
    blob(g, w / 2 + 6, h - 31, 9, PAL.leaf2);
    blob(g, w / 2 - 1, h - 39, 9, PAL.leaf2);
  },
  deadtree: (g, w, h) => {
    shadow(g, w, h, 8);
    rect(g, w / 2 - 2, h - 30, 5, 28, PAL.dead);
    g.strokeStyle = PAL.dead; g.lineWidth = 2;
    for (const [dx, dy] of [[-9, -12], [9, -14], [-6, -22], [7, -24]]) {
      g.beginPath(); g.moveTo(w / 2, h - 22); g.lineTo(w / 2 + dx, h - 22 + dy); g.stroke();
    }
  },
  bush: (g, w, h) => { shadow(g, w, h, 8); blob(g, w / 2 - 4, h - 8, 7, PAL.leaf3); blob(g, w / 2 + 4, h - 9, 7, PAL.leaf); blob(g, w / 2, h - 13, 7, PAL.leaf2); },
  flowers: (g, w, h) => {
    for (let i = 0; i < 6; i++) {
      const x = 6 + (i * 5) % 20, y = h - 4 - (i % 3) * 4;
      rect(g, x, y - 4, 1, 4, PAL.moss);
      rect(g, x - 1, y - 6, 3, 3, ['#e0d060', '#d86e9a', '#cfd7ea', '#e88a4a'][i % 4]);
    }
  },
  grass: (g, w, h) => {
    g.strokeStyle = PAL.moss; g.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const x = 5 + i * 3.5;
      g.beginPath(); g.moveTo(x, h - 2); g.quadraticCurveTo(x + 2, h - 8, x + (i % 2 ? 4 : -3), h - 12); g.stroke();
    }
  },
  reeds: (g, w, h) => {
    g.strokeStyle = PAL.reed; g.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const x = 7 + i * 3.6;
      g.beginPath(); g.moveTo(x, h - 2); g.lineTo(x + (i % 2 ? 3 : -2), h - 18); g.stroke();
      rect(g, x + (i % 2 ? 2 : -3), h - 22, 2, 5, '#8a7a3a');
    }
  },
  stump: (g, w, h) => { shadow(g, w, h, 7); rect(g, w / 2 - 6, h - 10, 12, 8, PAL.barkDark); g.fillStyle = PAL.bark; g.beginPath(); g.ellipse(w / 2, h - 10, 6, 2.6, 0, 0, Math.PI * 2); g.fill(); },
  rock: (g, w, h) => { shadow(g, w, h, 7); g.fillStyle = PAL.stone; g.beginPath(); g.moveTo(w / 2 - 8, h - 2); g.lineTo(w / 2 - 5, h - 10); g.lineTo(w / 2 + 3, h - 12); g.lineTo(w / 2 + 8, h - 3); g.closePath(); g.fill(); rect(g, w / 2 - 4, h - 9, 5, 2, PAL.stoneLight); },
  boulder: (g, w, h) => { shadow(g, w, h, 11); g.fillStyle = PAL.stoneDark; g.beginPath(); g.moveTo(w / 2 - 12, h - 2); g.lineTo(w / 2 - 9, h - 15); g.lineTo(w / 2 + 2, h - 19); g.lineTo(w / 2 + 12, h - 4); g.closePath(); g.fill(); g.fillStyle = PAL.stone; g.fillRect(w / 2 - 6, h - 14, 8, 4); },
  spike: (g, w, h) => { shadow(g, w, h, 7); g.fillStyle = PAL.stoneDark; g.beginPath(); g.moveTo(w / 2 - 7, h - 2); g.lineTo(w / 2, h - 30); g.lineTo(w / 2 + 7, h - 2); g.closePath(); g.fill(); g.fillStyle = PAL.stone; g.beginPath(); g.moveTo(w / 2 - 2, h - 2); g.lineTo(w / 2, h - 28); g.lineTo(w / 2 + 3, h - 2); g.closePath(); g.fill(); },
  mushroom: (g, w, h) => { rect(g, w / 2 - 2, h - 9, 4, 8, '#e8e0cf'); g.fillStyle = '#b5423c'; g.beginPath(); g.ellipse(w / 2, h - 10, 7, 5, 0, Math.PI, 0); g.fill(); blob(g, w / 2 - 3, h - 12, 1.4, '#f0e6d2'); blob(g, w / 2 + 3, h - 11, 1.2, '#f0e6d2'); },
  ashpile: (g, w, h) => { g.fillStyle = PAL.ash; g.beginPath(); g.ellipse(w / 2, h - 4, 10, 4.5, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#726a63'; for (let i = 0; i < 6; i++) g.fillRect(w / 2 - 8 + i * 3, h - 7 - (i % 2), 2, 2); },
  snowpile: (g, w, h) => { g.fillStyle = PAL.snow; g.beginPath(); g.ellipse(w / 2, h - 5, 11, 5.5, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(w / 2 - 3, h - 8, 5, 3, 0, 0, Math.PI * 2); g.fill(); },
  bones: (g, w, h) => {
    g.strokeStyle = PAL.bone; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(w / 2 - 7, h - 5); g.lineTo(w / 2 + 7, h - 9); g.stroke();
    g.beginPath(); g.moveTo(w / 2 - 6, h - 10); g.lineTo(w / 2 + 6, h - 4); g.stroke();
  },
  skull: (g, w, h) => {
    blob(g, w / 2, h - 8, 6, PAL.bone);
    rect(g, w / 2 - 4, h - 5, 8, 4, PAL.bone);
    rect(g, w / 2 - 3, h - 9, 2, 3, '#33302a'); rect(g, w / 2 + 1, h - 9, 2, 3, '#33302a');
  },
  rubble: (g, w, h) => { for (let i = 0; i < 4; i++) { const x = w / 2 - 8 + i * 5, y = h - 4 - (i % 2) * 3; g.fillStyle = i % 2 ? PAL.stone : PAL.stoneDark; g.fillRect(x, y, 5, 4); } },
  grave: (g, w, h) => {
    shadow(g, w, h, 8);
    g.fillStyle = PAL.stoneDark;
    g.fillRect(w / 2 - 6, h - 18, 12, 16);
    g.beginPath(); g.arc(w / 2, h - 18, 6, Math.PI, 0); g.fill();
    g.fillStyle = PAL.stoneLight; g.fillRect(w / 2 - 3, h - 14, 6, 2); g.fillRect(w / 2 - 1, h - 16, 2, 6);
  },
  pillar: (g, w, h) => {
    shadow(g, w, h, 9);
    rect(g, w / 2 - 7, h - 40, 14, 38, PAL.stoneDark);
    rect(g, w / 2 - 7, h - 40, 4, 38, PAL.stone);
    rect(g, w / 2 - 9, h - 44, 18, 5, PAL.stone);
    rect(g, w / 2 - 9, h - 4, 18, 4, PAL.stone);
  },
  torch: (g, w, h) => {
    rect(g, w / 2 - 1.5, h - 24, 3, 22, PAL.woodDark);
    blob(g, w / 2, h - 27, 5, PAL.flame);
    blob(g, w / 2, h - 28, 2.6, PAL.flameHot);
  },
  campfire: (g, w, h) => {
    g.strokeStyle = PAL.woodDark; g.lineWidth = 3;
    g.beginPath(); g.moveTo(w / 2 - 7, h - 3); g.lineTo(w / 2 + 7, h - 8); g.stroke();
    g.beginPath(); g.moveTo(w / 2 - 7, h - 8); g.lineTo(w / 2 + 7, h - 3); g.stroke();
    blob(g, w / 2, h - 11, 5.5, PAL.flame); blob(g, w / 2, h - 13, 3, PAL.flameHot);
  },
  totem: (g, w, h) => {
    shadow(g, w, h, 8);
    for (let i = 0; i < 3; i++) rect(g, w / 2 - 7, h - 12 - i * 11, 14, 10, i % 2 ? PAL.wood : PAL.woodDark);
    rect(g, w / 2 - 4, h - 30, 3, 3, PAL.gold); rect(g, w / 2 + 1, h - 30, 3, 3, PAL.gold);
  },
  banner: (g, w, h) => {
    rect(g, w / 2 - 1, h - 42, 2, 40, PAL.woodDark);
    g.fillStyle = PAL.cloth;
    g.beginPath(); g.moveTo(w / 2 + 1, h - 40); g.lineTo(w / 2 + 13, h - 40); g.lineTo(w / 2 + 13, h - 22); g.lineTo(w / 2 + 7, h - 26); g.lineTo(w / 2 + 1, h - 22); g.closePath(); g.fill();
    rect(g, w / 2 + 5, h - 35, 4, 4, PAL.gold);
  },
  iceshard: (g, w, h) => { g.fillStyle = PAL.iceDark; g.beginPath(); g.moveTo(w / 2 - 7, h - 2); g.lineTo(w / 2 - 2, h - 16); g.lineTo(w / 2 + 6, h - 3); g.closePath(); g.fill(); g.fillStyle = PAL.ice; g.beginPath(); g.moveTo(w / 2 - 3, h - 2); g.lineTo(w / 2 - 1, h - 14); g.lineTo(w / 2 + 3, h - 3); g.closePath(); g.fill(); },
  crystal: (g, w, h) => { shadow(g, w, h, 7); g.fillStyle = PAL.iceDark; g.beginPath(); g.moveTo(w / 2 - 6, h - 4); g.lineTo(w / 2 - 3, h - 28); g.lineTo(w / 2 + 2, h - 32); g.lineTo(w / 2 + 7, h - 5); g.closePath(); g.fill(); g.fillStyle = PAL.ice; g.beginPath(); g.moveTo(w / 2 - 1, h - 5); g.lineTo(w / 2 + 1, h - 29); g.lineTo(w / 2 + 4, h - 6); g.closePath(); g.fill(); },
  icicle: (g, w, h) => { g.fillStyle = PAL.ice; g.beginPath(); g.moveTo(w / 2 - 4, h - 26); g.lineTo(w / 2 + 4, h - 26); g.lineTo(w / 2, h - 6); g.closePath(); g.fill(); },
  barrel: (g, w, h) => { shadow(g, w, h, 7); rect(g, w / 2 - 6, h - 16, 12, 14, PAL.wood); rect(g, w / 2 - 6, h - 13, 12, 2, PAL.woodDark); rect(g, w / 2 - 6, h - 7, 12, 2, PAL.woodDark); },
  crate: (g, w, h) => { shadow(g, w, h, 7); rect(g, w / 2 - 7, h - 15, 14, 13, PAL.wood); g.strokeStyle = PAL.woodDark; g.lineWidth = 1.5; g.beginPath(); g.moveTo(w / 2 - 7, h - 15); g.lineTo(w / 2 + 7, h - 2); g.moveTo(w / 2 + 7, h - 15); g.lineTo(w / 2 - 7, h - 2); g.stroke(); },
  lamp: (g, w, h) => { rect(g, w / 2 - 1.5, h - 34, 3, 32, '#2f3440'); rect(g, w / 2 - 5, h - 42, 10, 9, '#3b4250'); blob(g, w / 2, h - 37, 3.4, PAL.flameHot); },
  bench: (g, w, h) => { shadow(g, w, h, 9); rect(g, w / 2 - 10, h - 9, 20, 4, PAL.wood); rect(g, w / 2 - 9, h - 5, 3, 4, PAL.woodDark); rect(g, w / 2 + 6, h - 5, 3, 4, PAL.woodDark); rect(g, w / 2 - 10, h - 16, 20, 3, PAL.wood); },
  flowerpot: (g, w, h) => { rect(g, w / 2 - 5, h - 9, 10, 8, '#8a5a3a'); blob(g, w / 2 - 3, h - 12, 3, PAL.leaf2); blob(g, w / 2 + 3, h - 12, 3, PAL.leaf); blob(g, w / 2, h - 15, 2.4, '#d86e9a'); },
  sign: (g, w, h) => { rect(g, w / 2 - 1.5, h - 24, 3, 22, PAL.woodDark); rect(g, w / 2 - 10, h - 32, 20, 10, PAL.wood); g.fillStyle = PAL.woodDark; for (let i = 0; i < 3; i++) g.fillRect(w / 2 - 7, h - 29 + i * 3, 14 - i * 4, 1.5); },
  cart: (g, w, h) => { shadow(g, w, h, 12); rect(g, w / 2 - 12, h - 14, 24, 8, PAL.wood); blob(g, w / 2 - 7, h - 5, 4, PAL.woodDark); blob(g, w / 2 + 7, h - 5, 4, PAL.woodDark); rect(g, w / 2 - 12, h - 18, 24, 4, PAL.woodDark); },
};


/* ---------------- terrain overlays (big, organic, per-variant) ------------- */

function softBlob(g, x, y, rx, ry, fill, blur = 0) {
  g.save();
  if (blur) g.filter = `blur(${blur}px)`;
  g.fillStyle = fill;
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

function drawCanopy(g, w, h, variant = 0, snow = false) {
  const cx = w / 2, groundY = h - 4;
  // soft ground shadow
  softBlob(g, cx, groundY - 2, 20, 7, 'rgba(0,0,0,0.30)', 4);
  // trunk: slightly curved, not a rectangle
  g.fillStyle = '#41301f';
  g.beginPath();
  g.moveTo(cx - 5, groundY);
  g.quadraticCurveTo(cx - 3, groundY - 20, cx - 4, groundY - 34);
  g.lineTo(cx + 4, groundY - 34);
  g.quadraticCurveTo(cx + 3, groundY - 20, cx + 6, groundY);
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(cx + 1, groundY - 34, 4, 34);

  const shapes = [
    [[0, -52, 30, 25], [-20, -44, 22, 18], [21, -42, 20, 17], [-6, -64, 22, 17]],
    [[0, -48, 26, 24], [-17, -38, 19, 16], [18, -40, 21, 18], [4, -62, 18, 15]],
    [[0, -56, 33, 22], [-23, -46, 20, 17], [24, -48, 18, 16], [-2, -68, 19, 14]],
  ][variant % 3];
  const dark = snow ? '#3d5a52' : '#22491f';
  const mid = snow ? '#4a6c62' : '#2f6a2b';
  const lit = snow ? '#5c8478' : '#438a38';
  for (const [dx, dy, rx, ry] of shapes) softBlob(g, cx + dx, groundY + dy, rx, ry, dark, 2);
  for (const [dx, dy, rx, ry] of shapes) softBlob(g, cx + dx - 2, groundY + dy - 3, rx * 0.86, ry * 0.86, mid, 1.5);
  for (const [dx, dy, rx, ry] of shapes.slice(0, 3)) softBlob(g, cx + dx - 5, groundY + dy - 7, rx * 0.5, ry * 0.5, lit, 2);
  if (snow) for (const [dx, dy, rx, ry] of shapes) softBlob(g, cx + dx - 4, groundY + dy - 9, rx * 0.55, ry * 0.3, 'rgba(235,245,255,0.85)', 2);
}

function drawOutcrop(g, w, h, variant = 0, snow = false) {
  const cx = w / 2, groundY = h - 3;
  softBlob(g, cx, groundY - 1, 24, 8, 'rgba(0,0,0,0.32)', 5);
  const forms = [
    [[0, -18, 26, 19], [-15, -10, 15, 11], [14, -12, 13, 10]],
    [[2, -22, 22, 22], [-14, -12, 14, 12], [15, -9, 12, 9]],
    [[-2, -16, 29, 16], [16, -20, 14, 14], [-17, -12, 12, 10]],
  ][variant % 3];
  for (const [dx, dy, rx, ry] of forms) softBlob(g, cx + dx, groundY + dy, rx, ry, '#4e4e57', 1.5);
  for (const [dx, dy, rx, ry] of forms) softBlob(g, cx + dx - 2, groundY + dy - 4, rx * 0.8, ry * 0.75, '#63636e', 1);
  for (const [dx, dy, rx, ry] of forms.slice(0, 2)) softBlob(g, cx + dx - 5, groundY + dy - 8, rx * 0.42, ry * 0.35, '#7d7d8a', 2);
  if (snow) for (const [dx, dy, rx, ry] of forms) softBlob(g, cx + dx - 3, groundY + dy - 9, rx * 0.7, ry * 0.32, 'rgba(232,242,252,0.9)', 2.5);
  // a few chips at the base
  g.fillStyle = '#585862';
  g.beginPath(); g.ellipse(cx - 22, groundY - 4, 5, 3, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx + 21, groundY - 5, 4, 2.6, 0, 0, Math.PI * 2); g.fill();
}

const BIG = {
  canopy: { w: 96, h: 108, draw: drawCanopy },
  outcrop: { w: 72, h: 64, draw: drawOutcrop },
};

/* ---------------- buildings (size comes from the map data) ---------------- */

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((c) => Math.max(0, Math.min(255, Math.round(c + amount))));
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`;
}

function drawHouse(g, w, h, roofColor = '#8c4a3a', sign = '') {
  const roofH = Math.round(h * 0.44);
  const wallTop = roofH - 2;
  const base = h - 4;

  // ground shadow, so the building sits in the world instead of on it
  g.save();
  g.filter = 'blur(6px)';
  g.fillStyle = 'rgba(0,0,0,0.38)';
  g.beginPath(); g.ellipse(w / 2, base + 2, w * 0.46, 11, 0, 0, Math.PI * 2); g.fill();
  g.restore();

  // --- walls: gently rounded box with a vertical light falloff -------------
  const wx = 7, ww = w - 14, r = 9;
  const wallGrad = g.createLinearGradient(0, wallTop, 0, base);
  wallGrad.addColorStop(0, '#d8c4a4');
  wallGrad.addColorStop(0.55, '#c6ae8c');
  wallGrad.addColorStop(1, '#a58f73');
  g.fillStyle = wallGrad;
  g.beginPath();
  g.moveTo(wx, wallTop + r);
  g.quadraticCurveTo(wx, wallTop, wx + r, wallTop);
  g.lineTo(wx + ww - r, wallTop);
  g.quadraticCurveTo(wx + ww, wallTop, wx + ww, wallTop + r);
  g.lineTo(wx + ww, base - 4);
  g.quadraticCurveTo(wx + ww, base, wx + ww - 5, base);
  g.lineTo(wx + 5, base);
  g.quadraticCurveTo(wx, base, wx, base - 4);
  g.closePath();
  g.fill();

  // timber frame, softened
  g.save();
  g.globalAlpha = 0.5;
  g.strokeStyle = '#7d6549';
  g.lineWidth = 3;
  g.lineCap = 'round';
  for (let x = wx + 16; x < wx + ww - 10; x += 24) {
    g.beginPath(); g.moveTo(x, wallTop + 8); g.lineTo(x, base - 6); g.stroke();
  }
  g.restore();
  // stone plinth
  g.fillStyle = 'rgba(90,78,62,0.5)';
  g.beginPath();
  g.moveTo(wx, base - 7); g.lineTo(wx + ww, base - 7);
  g.quadraticCurveTo(wx + ww, base, wx + ww - 5, base);
  g.lineTo(wx + 5, base); g.quadraticCurveTo(wx, base, wx, base - 7);
  g.closePath(); g.fill();

  // --- roof: curved gable with overhanging, rounded eaves ------------------
  const eaveY = roofH + 6, peakY = 3;
  const light = shade(roofColor, 26), dark = shade(roofColor, -34);
  g.fillStyle = light;
  g.beginPath();
  g.moveTo(2, eaveY);
  g.quadraticCurveTo(w * 0.22, eaveY - roofH * 0.42, w / 2, peakY);
  g.quadraticCurveTo(w * 0.78, eaveY - roofH * 0.42, w - 2, eaveY);
  g.quadraticCurveTo(w / 2, eaveY + 9, 2, eaveY);
  g.closePath();
  g.fill();
  // shaded right half
  g.save();
  g.beginPath();
  g.moveTo(w / 2, peakY);
  g.quadraticCurveTo(w * 0.78, eaveY - roofH * 0.42, w - 2, eaveY);
  g.quadraticCurveTo(w * 0.75, eaveY + 7, w / 2, eaveY + 4);
  g.closePath();
  g.fillStyle = dark;
  g.globalAlpha = 0.55;
  g.fill();
  g.restore();
  // shingle rows
  g.save();
  g.globalAlpha = 0.16;
  g.strokeStyle = '#000';
  g.lineWidth = 1.5;
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    g.beginPath();
    g.moveTo(2 + t * (w / 2 - 6), eaveY - t * (eaveY - peakY) * 0.5);
    g.quadraticCurveTo(w / 2, eaveY - t * (eaveY - peakY) * 0.86, w - 2 - t * (w / 2 - 6), eaveY - t * (eaveY - peakY) * 0.5);
    g.stroke();
  }
  g.restore();
  // ridge highlight + eave shadow on the wall
  g.strokeStyle = 'rgba(255,255,255,0.22)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(w / 2 - 9, peakY + 5); g.quadraticCurveTo(w / 2, peakY + 1, w / 2 + 9, peakY + 5);
  g.stroke();
  g.save();
  g.filter = 'blur(4px)';
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(wx, eaveY + 2, ww, 9);
  g.restore();

  // chimney with a puff of smoke
  const chX = w * 0.74;
  g.fillStyle = '#6b5a4c';
  g.fillRect(chX, peakY + roofH * 0.18, 9, roofH * 0.42);
  g.fillStyle = '#7d6c5c';
  g.fillRect(chX - 1, peakY + roofH * 0.18, 11, 4);
  g.save();
  g.globalAlpha = 0.28; g.filter = 'blur(3px)'; g.fillStyle = '#cfd6de';
  g.beginPath(); g.arc(chX + 5, peakY + 2, 7, 0, Math.PI * 2); g.fill();
  g.restore();

  // --- door: arched, with a warm spill on the ground -----------------------
  const dw = 18, dx = (w - dw) / 2, dTop = base - 30;
  g.fillStyle = '#4a3career'.slice(0, 7);
  g.fillStyle = '#4a3320';
  g.beginPath();
  g.moveTo(dx, base - 2);
  g.lineTo(dx, dTop + 8);
  g.quadraticCurveTo(dx + dw / 2, dTop - 6, dx + dw, dTop + 8);
  g.lineTo(dx + dw, base - 2);
  g.closePath();
  g.fill();
  g.fillStyle = '#6d4d2c';
  g.beginPath();
  g.moveTo(dx + 2, base - 2);
  g.lineTo(dx + 2, dTop + 9);
  g.quadraticCurveTo(dx + dw / 2, dTop - 3, dx + dw - 2, dTop + 9);
  g.lineTo(dx + dw - 2, base - 2);
  g.closePath();
  g.fill();
  blob(g, dx + dw - 5, base - 15, 1.5, PAL.gold);

  // --- windows: arched, lit from inside ------------------------------------
  for (const cx of [dx - 24, dx + dw + 24]) {
    if (cx < 12 || cx > w - 12) continue;
    const wy = base - 34, ww2 = 15, wh = 15;
    g.fillStyle = '#4a3320';
    g.beginPath();
    g.moveTo(cx - ww2 / 2, wy + wh);
    g.lineTo(cx - ww2 / 2, wy + 5);
    g.quadraticCurveTo(cx, wy - 5, cx + ww2 / 2, wy + 5);
    g.lineTo(cx + ww2 / 2, wy + wh);
    g.closePath(); g.fill();
    g.fillStyle = '#f0c980';
    g.beginPath();
    g.moveTo(cx - ww2 / 2 + 2, wy + wh - 2);
    g.lineTo(cx - ww2 / 2 + 2, wy + 6);
    g.quadraticCurveTo(cx, wy - 2, cx + ww2 / 2 - 2, wy + 6);
    g.lineTo(cx + ww2 / 2 - 2, wy + wh - 2);
    g.closePath(); g.fill();
    g.strokeStyle = '#4a3320'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(cx, wy - 1); g.lineTo(cx, wy + wh - 2); g.stroke();
    g.save();
    g.globalAlpha = 0.25; g.filter = 'blur(5px)'; g.fillStyle = '#ffcf8a';
    g.beginPath(); g.arc(cx, wy + 6, 13, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  // --- hanging sign on a curved bracket ------------------------------------
  if (sign) {
    const sw = Math.max(50, sign.length * 9 + 14), sh = 16;
    const sx = (w - sw) / 2, sy = base - 56;
    g.strokeStyle = '#3c3430'; g.lineWidth = 2;
    g.beginPath();
    g.moveTo(w / 2 - sw / 2 + 6, sy - 6); g.quadraticCurveTo(w / 2, sy - 12, w / 2 + sw / 2 - 6, sy - 6);
    g.stroke();
    g.beginPath(); g.moveTo(sx + 8, sy - 7); g.lineTo(sx + 8, sy); g.moveTo(sx + sw - 8, sy - 7); g.lineTo(sx + sw - 8, sy); g.stroke();
    g.fillStyle = '#5a3f26';
    g.beginPath();
    g.moveTo(sx + 4, sy); g.lineTo(sx + sw - 4, sy);
    g.quadraticCurveTo(sx + sw, sy, sx + sw, sy + 4);
    g.lineTo(sx + sw, sy + sh - 4);
    g.quadraticCurveTo(sx + sw, sy + sh, sx + sw - 4, sy + sh);
    g.lineTo(sx + 4, sy + sh);
    g.quadraticCurveTo(sx, sy + sh, sx, sy + sh - 4);
    g.lineTo(sx, sy + 4);
    g.quadraticCurveTo(sx, sy, sx + 4, sy);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.fillRect(sx + 3, sy + 2, sw - 6, 3);
    g.fillStyle = '#f2ddb0';
    g.font = '11px system-ui, "Noto Sans Thai", sans-serif';
    g.textAlign = 'center';
    g.fillText(sign, w / 2, sy + 12);
  }
}

function drawStall(g, w, h) {
  const base = h - 4;
  g.save();
  g.filter = 'blur(5px)';
  g.fillStyle = 'rgba(0,0,0,0.34)';
  g.beginPath(); g.ellipse(w / 2, base + 1, w * 0.44, 8, 0, 0, Math.PI * 2); g.fill();
  g.restore();

  // posts
  g.fillStyle = PAL.woodDark;
  g.fillRect(6, base - 34, 4, 32);
  g.fillRect(w - 10, base - 34, 4, 32);

  // counter with a rounded front edge
  const cGrad = g.createLinearGradient(0, base - 18, 0, base);
  cGrad.addColorStop(0, '#96703f');
  cGrad.addColorStop(1, '#6c4f2c');
  g.fillStyle = cGrad;
  g.beginPath();
  g.moveTo(4, base - 16);
  g.lineTo(w - 4, base - 16);
  g.quadraticCurveTo(w - 1, base - 16, w - 2, base - 10);
  g.lineTo(w - 4, base - 2);
  g.lineTo(4, base - 2);
  g.lineTo(2, base - 10);
  g.quadraticCurveTo(1, base - 16, 4, base - 16);
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.fillRect(4, base - 16, w - 8, 3);

  // scalloped awning: a row of arcs instead of a straight cloth edge
  const aw = w - 2, ax = 1, ay = base - 44, ah = 13;
  const stripes = Math.max(4, Math.round(aw / 13));
  for (let i = 0; i < stripes; i++) {
    const x0 = ax + (aw / stripes) * i, x1 = ax + (aw / stripes) * (i + 1);
    g.fillStyle = i % 2 ? '#c85c50' : '#f2e6cd';
    g.beginPath();
    g.moveTo(x0, ay);
    g.lineTo(x1, ay);
    g.lineTo(x1, ay + ah);
    g.quadraticCurveTo((x0 + x1) / 2, ay + ah + 6, x0, ay + ah);
    g.closePath();
    g.fill();
  }
  g.fillStyle = 'rgba(0,0,0,0.20)';
  g.fillRect(ax, ay + ah - 1, aw, 2);
  g.fillStyle = '#8d3f36';
  g.beginPath();
  g.moveTo(ax, ay); g.lineTo(ax + aw, ay);
  g.quadraticCurveTo(ax + aw / 2, ay - 5, ax, ay);
  g.closePath(); g.fill();

  // goods
  g.fillStyle = '#8a6a3a';
  g.beginPath(); g.ellipse(w * 0.3, base - 20, 7, 4, 0, 0, Math.PI * 2); g.fill();
  blob(g, w * 0.66, base - 21, 4.5, '#c0553f');
  blob(g, w * 0.74, base - 19, 3.5, '#d9a441');
}

function drawFountain(g, w, h) {
  const cx = w / 2, cy = h - h * 0.42;
  g.save();
  g.filter = 'blur(5px)';
  g.fillStyle = 'rgba(0,0,0,0.30)';
  g.beginPath(); g.ellipse(cx, cy + h * 0.22, w * 0.46, h * 0.16, 0, 0, Math.PI * 2); g.fill();
  g.restore();

  const rim = g.createLinearGradient(0, cy - h * 0.3, 0, cy + h * 0.3);
  rim.addColorStop(0, '#9b9384');
  rim.addColorStop(1, '#6a6357');
  g.fillStyle = rim;
  g.beginPath(); g.ellipse(cx, cy, w * 0.47, h * 0.31, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#7d7568';
  g.beginPath(); g.ellipse(cx, cy - 2, w * 0.42, h * 0.26, 0, 0, Math.PI * 2); g.fill();

  const water = g.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, w * 0.4);
  water.addColorStop(0, '#6fb6d8');
  water.addColorStop(1, '#2d6c92');
  g.fillStyle = water;
  g.beginPath(); g.ellipse(cx, cy, w * 0.37, h * 0.22, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath(); g.ellipse(cx - 6, cy - 4, w * 0.13, h * 0.05, -0.3, 0, Math.PI * 2); g.fill();

  // pedestal + spout
  g.fillStyle = '#8b8376';
  g.beginPath();
  g.moveTo(cx - 5, cy); g.lineTo(cx - 3, cy - h * 0.3);
  g.lineTo(cx + 3, cy - h * 0.3); g.lineTo(cx + 5, cy);
  g.closePath(); g.fill();
  blob(g, cx, cy - h * 0.33, 6, '#8fd0ee');
  g.save();
  g.globalAlpha = 0.5;
  g.strokeStyle = '#bfe6f7';
  g.lineWidth = 2;
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx, cy - h * 0.33);
    g.quadraticCurveTo(cx + dir * 14, cy - h * 0.22, cx + dir * 16, cy - 2);
    g.stroke();
  }
  g.restore();
}

const SIZED = { house: drawHouse, stall: drawStall, fountain: drawFountain };

/** `prop` may be a plain kind string or a full prop record (buildings). */
export function propSprite(prop) {
  const kind = typeof prop === 'string' ? prop : prop.kind;
  const big = BIG[kind];
  if (big) {
    const key = `${kind}:${prop.variant ?? 0}:${prop.snow ? 1 : 0}`;
    let c = cache.get(key);
    if (!c) {
      c = make(big.w, big.h, (g, w, h) => big.draw(g, w, h, prop.variant ?? 0, !!prop.snow));
      cache.set(key, c);
    }
    return c;
  }
  const sized = SIZED[kind];
  const key = sized
    ? `${kind}:${prop.w}x${prop.h}:${prop.roof ?? ''}:${prop.sign ?? ''}`
    : kind;
  let c = cache.get(key);
  if (c) return c;
  if (sized) {
    const w = Math.round(prop.w), h = Math.round(prop.h + (kind === 'house' ? 26 : 12));
    c = make(w, h, (g) => sized(g, w, h, prop.roof, prop.sign));
  } else {
    const draw = DRAW[kind] ?? DRAW.rock;
    c = make(32, 48, (g, w, h) => draw(g, w, h));
  }
  cache.set(key, c);
  return c;
}
