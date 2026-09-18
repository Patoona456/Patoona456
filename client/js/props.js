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

/* ---------------- buildings (size comes from the map data) ---------------- */

function drawHouse(g, w, h, roofColor = '#8c4a3a', sign = '') {
  const roofH = Math.round(h * 0.42);
  const wallTop = roofH;
  // body
  rect(g, 6, wallTop, w - 12, h - wallTop - 2, '#c9b291');
  rect(g, 6, wallTop, w - 12, 3, '#a89377');
  g.fillStyle = '#7d6549';                       // timber frame
  for (let x = 12; x < w - 12; x += 22) g.fillRect(x, wallTop + 4, 3, h - wallTop - 8);
  rect(g, 6, h - 6, w - 12, 4, '#6b5a44');
  // roof: solid gable, darker on the right slope, with an eave band
  g.fillStyle = roofColor;
  g.beginPath(); g.moveTo(0, roofH + 6); g.lineTo(w / 2, 2); g.lineTo(w, roofH + 6); g.closePath(); g.fill();
  g.save();
  g.globalAlpha = 0.22; g.fillStyle = '#000';
  g.beginPath(); g.moveTo(w / 2, 2); g.lineTo(w, roofH + 6); g.lineTo(w / 2, roofH + 6); g.closePath(); g.fill();
  g.restore();
  g.fillStyle = roofColor;
  rect(g, 0, roofH + 4, w, 5, roofColor);
  g.globalAlpha = 0.3; rect(g, 0, roofH + 7, w, 3, '#000'); g.globalAlpha = 1;
  g.globalAlpha = 0.18; rect(g, 0, roofH + 4, w, 2, '#fff'); g.globalAlpha = 1;
  // door + windows
  const dw = 16, dx = (w - dw) / 2;
  rect(g, dx, h - 24, dw, 22, '#5b3f28');
  rect(g, dx + 2, h - 22, dw - 4, 20, '#75542f');
  blob(g, dx + dw - 5, h - 13, 1.4, PAL.gold);
  for (const wx of [dx - 22, dx + dw + 6]) {
    if (wx < 8 || wx + 14 > w - 8) continue;
    rect(g, wx, h - 26, 14, 12, '#3d4a5c');
    rect(g, wx + 1, h - 25, 12, 10, '#6f92b8');
    rect(g, wx + 6, h - 25, 2, 10, '#3d4a5c');
  }
  // hanging sign
  if (sign) {
    const sw = Math.max(46, sign.length * 9 + 12);
    const sx = (w - sw) / 2, sy = h - 44;
    rect(g, sx, sy, sw, 15, '#43301f');
    rect(g, sx + 1, sy + 1, sw - 2, 13, '#6b4a2c');
    g.fillStyle = '#f0dcae';
    g.font = '10px system-ui, "Noto Sans Thai", sans-serif';
    g.textAlign = 'center';
    g.fillText(sign, w / 2, sy + 11);
  }
}

function drawStall(g, w, h) {
  rect(g, 4, h - 16, w - 8, 12, PAL.wood);          // counter
  rect(g, 4, h - 16, w - 8, 3, PAL.woodDark);
  rect(g, 6, h - 34, 3, 20, PAL.woodDark);          // posts
  rect(g, w - 9, h - 34, 3, 20, PAL.woodDark);
  for (let i = 0; i < Math.ceil(w / 12); i++) {     // striped awning
    rect(g, 2 + i * 12, h - 40, 12, 9, i % 2 ? '#c85c50' : '#f0e2c8');
  }
  rect(g, 2, h - 31, w - 4, 3, '#8d3f36');
  rect(g, 10, h - 22, 9, 7, '#8a6a3a');             // goods on the counter
  blob(g, w - 16, h - 19, 4, '#c0553f');
}

function drawFountain(g, w, h) {
  const cx = w / 2, cy = h - h * 0.42;
  g.fillStyle = PAL.stoneDark;
  g.beginPath(); g.ellipse(cx, cy, w * 0.46, h * 0.3, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2f6d95';
  g.beginPath(); g.ellipse(cx, cy, w * 0.37, h * 0.23, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4e9ac4';
  g.beginPath(); g.ellipse(cx - 4, cy - 3, w * 0.16, h * 0.08, 0, 0, Math.PI * 2); g.fill();
  rect(g, cx - 4, cy - h * 0.34, 8, h * 0.3, PAL.stone);
  blob(g, cx, cy - h * 0.36, 6, '#8fd0ee');
}

const SIZED = { house: drawHouse, stall: drawStall, fountain: drawFountain };

/** `prop` may be a plain kind string or a full prop record (buildings). */
export function propSprite(prop) {
  const kind = typeof prop === 'string' ? prop : prop.kind;
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
