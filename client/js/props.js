// Procedural scenery sprites. Each prop is drawn once into a small offscreen
// canvas (anchor = bottom centre) and then blitted, so the world gets detail
// without shipping a single extra byte of art.

const cache = new Map();
export const GLOWING = new Set(['torch', 'campfire', 'lamp', 'crystal', 'brazier']);

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
  // --- town furniture: rounded, shaded, and never a bare rectangle ---------
  barrel: (g, w, h) => {
    const cx = w / 2, base = h - 3;
    shadow(g, w, h, 8);
    const body = g.createLinearGradient(cx - 8, 0, cx + 8, 0);
    body.addColorStop(0, '#6b4a28'); body.addColorStop(0.42, '#a77a45'); body.addColorStop(1, '#5e4023');
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(cx - 6, base - 18);
    g.quadraticCurveTo(cx - 9, base - 10, cx - 6, base - 1);
    g.lineTo(cx + 6, base - 1);
    g.quadraticCurveTo(cx + 9, base - 10, cx + 6, base - 18);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(60,44,26,0.85)';
    for (const y of [base - 14, base - 7]) {
      g.beginPath(); g.ellipse(cx, y, 8.2, 2.1, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#c69a5c';
    g.beginPath(); g.ellipse(cx, base - 18, 6.2, 2.4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath(); g.ellipse(cx, base - 17.4, 4.6, 1.5, 0, 0, Math.PI * 2); g.fill();
  },
  crate: (g, w, h) => {
    const cx = w / 2, base = h - 3;
    shadow(g, w, h, 8);
    const face = g.createLinearGradient(0, base - 16, 0, base);
    face.addColorStop(0, '#a37f4c'); face.addColorStop(1, '#6d5029');
    g.fillStyle = face;
    g.beginPath();
    g.moveTo(cx - 8, base - 15);
    g.lineTo(cx + 8, base - 15);
    g.quadraticCurveTo(cx + 9, base - 8, cx + 8, base - 1);
    g.lineTo(cx - 8, base - 1);
    g.quadraticCurveTo(cx - 9, base - 8, cx - 8, base - 15);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,230,190,0.30)';
    g.fillRect(cx - 8, base - 15, 16, 2);
    g.strokeStyle = 'rgba(70,50,28,0.75)'; g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(cx - 7, base - 14); g.lineTo(cx + 7, base - 2);
    g.moveTo(cx + 7, base - 14); g.lineTo(cx - 7, base - 2);
    g.stroke();
    g.strokeStyle = 'rgba(40,28,16,0.5)';
    g.strokeRect(cx - 8, base - 15, 16, 14);
  },
  sack: (g, w, h) => {
    const cx = w / 2, base = h - 3;
    shadow(g, w, h, 7);
    const cloth = g.createRadialGradient(cx - 3, base - 12, 1, cx, base - 7, 11);
    cloth.addColorStop(0, '#d9c79c'); cloth.addColorStop(1, '#9d8a60');
    g.fillStyle = cloth;
    g.beginPath();
    g.moveTo(cx - 7, base - 1);
    g.quadraticCurveTo(cx - 9, base - 12, cx - 3, base - 15);
    g.quadraticCurveTo(cx, base - 19, cx + 3, base - 15);
    g.quadraticCurveTo(cx + 9, base - 12, cx + 7, base - 1);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(90,74,44,0.7)'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(cx - 4, base - 14); g.quadraticCurveTo(cx, base - 12, cx + 4, base - 14); g.stroke();
  },
  lamp: (g, w, h) => {
    const cx = w / 2, base = h - 3;
    shadow(g, w, h, 6);
    // tapered iron post with a curl at the top
    g.strokeStyle = '#2a2f3a'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, base - 2); g.lineTo(cx, base - 34); g.stroke();
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx - 5, base - 6); g.quadraticCurveTo(cx, base - 10, cx + 5, base - 6); g.stroke();
    // lantern housing
    g.fillStyle = '#39404e';
    g.beginPath();
    g.moveTo(cx - 5, base - 34); g.lineTo(cx + 5, base - 34);
    g.lineTo(cx + 4, base - 44); g.lineTo(cx - 4, base - 44);
    g.closePath(); g.fill();
    g.fillStyle = '#2a2f3a';
    g.beginPath(); g.moveTo(cx - 6, base - 44); g.lineTo(cx + 6, base - 44); g.lineTo(cx, base - 49); g.closePath(); g.fill();
    // glass and flame
    const glow = g.createRadialGradient(cx, base - 39, 0.5, cx, base - 39, 6);
    glow.addColorStop(0, '#fff2c0'); glow.addColorStop(1, 'rgba(255,176,58,0.15)');
    g.fillStyle = glow;
    g.beginPath(); g.ellipse(cx, base - 39, 4.2, 5, 0, 0, Math.PI * 2); g.fill();
    g.save();
    g.globalAlpha = 0.35; g.filter = 'blur(4px)'; g.fillStyle = '#ffcf8a';
    g.beginPath(); g.arc(cx, base - 39, 9, 0, Math.PI * 2); g.fill();
    g.restore();
  },
  bench: (g, w, h) => {
    const cx = w / 2, base = h - 3;
    shadow(g, w, h, 11);
    g.fillStyle = '#5c4326';
    g.fillRect(cx - 9, base - 7, 3, 6);
    g.fillRect(cx + 6, base - 7, 3, 6);
    const plank = g.createLinearGradient(0, base - 11, 0, base - 6);
    plank.addColorStop(0, '#9c7745'); plank.addColorStop(1, '#75552e');
    g.fillStyle = plank;
    g.beginPath();
    g.moveTo(cx - 12, base - 10);
    g.lineTo(cx + 12, base - 10);
    g.quadraticCurveTo(cx + 14, base - 8, cx + 12, base - 6);
    g.lineTo(cx - 12, base - 6);
    g.quadraticCurveTo(cx - 14, base - 8, cx - 12, base - 10);
    g.closePath(); g.fill();
    // backrest, leaning back a touch
    g.fillStyle = '#8a6a3d';
    g.beginPath();
    g.moveTo(cx - 11, base - 11); g.lineTo(cx + 11, base - 11);
    g.lineTo(cx + 10, base - 18); g.lineTo(cx - 10, base - 18);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,235,200,0.22)';
    g.fillRect(cx - 10, base - 18, 20, 1.6);
  },
  flowerpot: (g, w, h) => {
    const cx = w / 2, base = h - 3;
    shadow(g, w, h, 7);
    const clay = g.createLinearGradient(cx - 6, 0, cx + 6, 0);
    clay.addColorStop(0, '#7b4a2c'); clay.addColorStop(0.45, '#a9683d'); clay.addColorStop(1, '#6d4025');
    g.fillStyle = clay;
    g.beginPath();
    g.moveTo(cx - 6, base - 10); g.lineTo(cx + 6, base - 10);
    g.lineTo(cx + 4.5, base - 1); g.lineTo(cx - 4.5, base - 1);
    g.closePath(); g.fill();
    g.fillStyle = '#b8764a';
    g.beginPath(); g.ellipse(cx, base - 10, 6.4, 1.8, 0, 0, Math.PI * 2); g.fill();
    // planting
    for (const [dx, dy, r, c] of [[-3, -13, 3.4, '#2f6b32'], [3, -13, 3.2, '#3d8140'], [0, -16, 3, '#356f35']]) {
      blob(g, cx + dx, base + dy, r, c);
    }
    blob(g, cx - 2, base - 18, 1.8, '#e07aa8');
    blob(g, cx + 3, base - 17, 1.6, '#f0c355');
  },
  sign: (g, w, h) => {
    const cx = w / 2, base = h - 3;
    shadow(g, w, h, 6);
    g.strokeStyle = '#4a3520'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, base - 2); g.lineTo(cx, base - 22); g.stroke();
    const board = g.createLinearGradient(0, base - 34, 0, base - 22);
    board.addColorStop(0, '#9c7745'); board.addColorStop(1, '#70522c');
    g.fillStyle = board;
    g.beginPath();
    g.moveTo(cx - 10, base - 33);
    g.lineTo(cx + 10, base - 33);
    g.quadraticCurveTo(cx + 12, base - 28, cx + 10, base - 23);
    g.lineTo(cx - 10, base - 23);
    g.quadraticCurveTo(cx - 12, base - 28, cx - 10, base - 33);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,240,210,0.25)';
    g.fillRect(cx - 9, base - 32, 18, 1.5);
    g.fillStyle = 'rgba(58,40,22,0.75)';
    for (let i = 0; i < 3; i++) g.fillRect(cx - 7, base - 30 + i * 3, 14 - i * 5, 1.4);
  },
  cart: (g, w, h) => {
    const cx = w / 2, base = h - 3;
    shadow(g, w, h, 13);
    // bed
    const bed = g.createLinearGradient(0, base - 17, 0, base - 7);
    bed.addColorStop(0, '#9c7745'); bed.addColorStop(1, '#6d5029');
    g.fillStyle = bed;
    g.beginPath();
    g.moveTo(cx - 13, base - 16);
    g.lineTo(cx + 13, base - 16);
    g.quadraticCurveTo(cx + 15, base - 12, cx + 12, base - 8);
    g.lineTo(cx - 12, base - 8);
    g.quadraticCurveTo(cx - 15, base - 12, cx - 13, base - 16);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,238,205,0.22)';
    g.fillRect(cx - 12, base - 16, 24, 1.6);
    // load
    blob(g, cx - 5, base - 19, 3.6, '#7f9a4a');
    blob(g, cx + 1, base - 20, 3.2, '#c0553f');
    blob(g, cx + 6, base - 19, 3, '#d9a441');
    // wheels with a hub
    for (const dx of [-8, 8]) {
      blob(g, cx + dx, base - 4, 4.6, '#4a3520');
      blob(g, cx + dx, base - 4, 2.6, '#7a5a37');
      blob(g, cx + dx, base - 4, 1, '#c69a5c');
    }
    // shaft
    g.strokeStyle = '#5c4326'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx + 12, base - 12); g.lineTo(cx + 20, base - 9); g.stroke();
  },
  well: (g, w, h) => {
    const cx = w / 2, base = h - 3;
    shadow(g, w, h, 12);
    // stone ring
    const ring = g.createLinearGradient(0, base - 16, 0, base - 2);
    ring.addColorStop(0, '#8d8479'); ring.addColorStop(1, '#5f584e');
    g.fillStyle = ring;
    g.beginPath(); g.ellipse(cx, base - 6, 12, 6.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6e675c';
    g.beginPath(); g.ellipse(cx, base - 9, 11, 5.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#20303a';
    g.beginPath(); g.ellipse(cx, base - 9, 8, 3.8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(120,180,210,0.35)';
    g.beginPath(); g.ellipse(cx - 1, base - 9, 5, 2.2, 0, 0, Math.PI * 2); g.fill();
    // posts and little roof
    g.strokeStyle = '#5c4326'; g.lineWidth = 2.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - 9, base - 10); g.lineTo(cx - 8, base - 26); g.stroke();
    g.beginPath(); g.moveTo(cx + 9, base - 10); g.lineTo(cx + 8, base - 26); g.stroke();
    g.fillStyle = '#7d4a3a';
    g.beginPath();
    g.moveTo(cx - 13, base - 25);
    g.quadraticCurveTo(cx, base - 34, cx + 13, base - 25);
    g.quadraticCurveTo(cx, base - 29, cx - 13, base - 25);
    g.closePath(); g.fill();
    // bucket on a rope
    g.strokeStyle = '#3c3430'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(cx, base - 26); g.lineTo(cx, base - 17); g.stroke();
    g.fillStyle = '#7a5a37';
    g.fillRect(cx - 3, base - 17, 6, 5);
  },
  planter: (g, w, h) => {
    const cx = w / 2, base = h - 3;
    shadow(g, w, h, 12);
    const box = g.createLinearGradient(0, base - 12, 0, base - 1);
    box.addColorStop(0, '#8a6a3d'); box.addColorStop(1, '#5c4326');
    g.fillStyle = box;
    g.beginPath();
    g.moveTo(cx - 13, base - 11);
    g.lineTo(cx + 13, base - 11);
    g.quadraticCurveTo(cx + 14, base - 6, cx + 12, base - 1);
    g.lineTo(cx - 12, base - 1);
    g.quadraticCurveTo(cx - 14, base - 6, cx - 13, base - 11);
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,238,205,0.2)';
    g.fillRect(cx - 13, base - 11, 26, 1.6);
    for (const [dx, r, c] of [[-9, 4.2, '#2f6b32'], [-3, 5, '#3d8140'], [3, 4.6, '#25542a'], [9, 4, '#3d8140']]) {
      blob(g, cx + dx, base - 14, r, c);
    }
    blob(g, cx - 6, base - 17, 2, '#e07aa8');
    blob(g, cx + 5, base - 17, 1.8, '#f0c355');
    blob(g, cx + 1, base - 19, 1.6, '#dfe6f2');
  },
  awning: (g, w, h) => {
    // a striped canopy on two poles, for market corners
    const cx = w / 2, base = h - 3;
    shadow(g, w, h, 11);
    g.strokeStyle = '#5c4326'; g.lineWidth = 2.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - 11, base - 2); g.lineTo(cx - 10, base - 22); g.stroke();
    g.beginPath(); g.moveTo(cx + 11, base - 2); g.lineTo(cx + 10, base - 22); g.stroke();
    const stripes = 5;
    for (let i = 0; i < stripes; i++) {
      const x0 = cx - 13 + (26 / stripes) * i, x1 = cx - 13 + (26 / stripes) * (i + 1);
      g.fillStyle = i % 2 ? '#4f7fa8' : '#eadfc4';
      g.beginPath();
      g.moveTo(x0, base - 22);
      g.lineTo(x1, base - 22);
      g.lineTo(x1, base - 17);
      g.quadraticCurveTo((x0 + x1) / 2, base - 13, x0, base - 17);
      g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(cx - 13, base - 18, 26, 1.5);
  },
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

/** Four market stands: different cloth, different goods, different wear. */
const STALL_LOOKS = [
  { cloth: ['#c85c50', '#f2e6cd'], trim: '#8d3f36', goods: 'fruit' },
  { cloth: ['#4f7fa8', '#eadfc4'], trim: '#36597a', goods: 'fish' },
  { cloth: ['#6f9a52', '#f0ead2'], trim: '#4c6c39', goods: 'herbs' },
  { cloth: ['#b08a3c', '#f5ecd2'], trim: '#7d5f24', goods: 'pots' },
];

function drawStall(g, w, h, _roof, _sign, variant = 0) {
  const look = STALL_LOOKS[variant % STALL_LOOKS.length];
  const base = h - 4;
  g.save();
  g.filter = 'blur(5px)';
  g.fillStyle = 'rgba(0,0,0,0.34)';
  g.beginPath(); g.ellipse(w / 2, base + 1, w * 0.44, 8, 0, 0, Math.PI * 2); g.fill();
  g.restore();

  // posts, tapered and slightly uneven so it reads as built by hand
  g.strokeStyle = PAL.woodDark; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(8, base - 2); g.lineTo(7.5, base - 34); g.stroke();
  g.beginPath(); g.moveTo(w - 8, base - 2); g.lineTo(w - 7, base - 34); g.stroke();

  // counter with a rounded front edge and a plank seam
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
  g.fillStyle = 'rgba(255,240,210,0.16)';
  g.fillRect(4, base - 16, w - 8, 3);
  g.strokeStyle = 'rgba(60,42,24,0.35)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(4, base - 9); g.lineTo(w - 4, base - 9); g.stroke();
  // cloth hanging over the front edge
  g.fillStyle = look.cloth[0];
  g.globalAlpha = 0.9;
  g.beginPath();
  g.moveTo(w * 0.12, base - 3);
  g.quadraticCurveTo(w * 0.3, base + 3, w * 0.48, base - 3);
  g.lineTo(w * 0.48, base - 8); g.lineTo(w * 0.12, base - 8);
  g.closePath(); g.fill();
  g.globalAlpha = 1;

  // scalloped awning: a row of arcs instead of a straight cloth edge
  const aw = w - 2, ax = 1, ay = base - 44, ah = 13;
  const stripes = Math.max(4, Math.round(aw / 13));
  for (let i = 0; i < stripes; i++) {
    const x0 = ax + (aw / stripes) * i, x1 = ax + (aw / stripes) * (i + 1);
    g.fillStyle = i % 2 ? look.cloth[0] : look.cloth[1];
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
  g.fillStyle = look.trim;
  g.beginPath();
  g.moveTo(ax, ay); g.lineTo(ax + aw, ay);
  g.quadraticCurveTo(ax + aw / 2, ay - 5, ax, ay);
  g.closePath(); g.fill();
  // shade thrown onto the counter by the awning
  g.save();
  g.globalAlpha = 0.18; g.filter = 'blur(3px)'; g.fillStyle = '#000';
  g.fillRect(6, base - 20, w - 12, 5);
  g.restore();

  // goods on the counter: each stand sells something different
  const gx = (t) => w * t;
  if (look.goods === 'fruit') {
    g.fillStyle = '#8a6a3a';
    g.beginPath(); g.ellipse(gx(0.26), base - 20, 8, 4, 0, 0, Math.PI * 2); g.fill();
    blob(g, gx(0.22), base - 22, 3.2, '#c0553f');
    blob(g, gx(0.29), base - 22, 3, '#d9a441');
    blob(g, gx(0.26), base - 25, 2.8, '#c0553f');
    blob(g, gx(0.68), base - 21, 4, '#7f9a4a');
    blob(g, gx(0.76), base - 20, 3.4, '#a8c057');
  } else if (look.goods === 'fish') {
    for (const [t, tilt] of [[0.28, -0.3], [0.44, 0.2], [0.68, -0.15]]) {
      g.save();
      g.translate(gx(t), base - 20);
      g.rotate(tilt);
      g.fillStyle = '#9fb6c4';
      g.beginPath(); g.ellipse(0, 0, 7, 2.6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#7b93a4';
      g.beginPath(); g.moveTo(6, 0); g.lineTo(10, -2.6); g.lineTo(10, 2.6); g.closePath(); g.fill();
      blob(g, -4, -0.6, 0.8, '#26323a');
      g.restore();
    }
  } else if (look.goods === 'herbs') {
    for (const [t, c] of [[0.24, '#4f8a3f'], [0.38, '#6ca34c'], [0.66, '#3f7a44'], [0.78, '#83b05a']]) {
      g.strokeStyle = c; g.lineWidth = 1.4;
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo(gx(t), base - 17);
        g.quadraticCurveTo(gx(t) + i * 1.6, base - 23, gx(t) + i * 3.4, base - 27);
        g.stroke();
      }
      blob(g, gx(t), base - 17, 2, '#8a6a3a');
    }
  } else {
    for (const [t, r, c] of [[0.24, 5, '#a9683d'], [0.36, 4, '#7b4a2c'], [0.66, 5.5, '#946040'], [0.78, 3.6, '#a9683d']]) {
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(gx(t) - r, base - 17);
      g.quadraticCurveTo(gx(t) - r - 1.5, base - 22, gx(t), base - 24);
      g.quadraticCurveTo(gx(t) + r + 1.5, base - 22, gx(t) + r, base - 17);
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,235,200,0.25)';
      g.beginPath(); g.ellipse(gx(t) - r * 0.35, base - 21, r * 0.3, 1.4, 0, 0, Math.PI * 2); g.fill();
    }
  }
}

function drawFountain(g, w, h) {
  const cx = w / 2, cy = h - h * 0.40;
  const rx = w * 0.47, ry = h * 0.30;

  g.save();
  g.filter = 'blur(6px)';
  g.fillStyle = 'rgba(0,0,0,0.32)';
  g.beginPath(); g.ellipse(cx, cy + ry * 0.75, rx * 1.02, ry * 0.55, 0, 0, Math.PI * 2); g.fill();
  g.restore();

  // --- outer basin: stone blocks laid in a ring ---------------------------
  const rim = g.createLinearGradient(0, cy - ry, 0, cy + ry);
  rim.addColorStop(0, '#a49b8b');
  rim.addColorStop(0.55, '#8a8172');
  rim.addColorStop(1, '#5e574c');
  g.fillStyle = rim;
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
  // joints between the blocks
  g.save();
  g.strokeStyle = 'rgba(60,54,46,0.45)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * rx * 0.82, cy + Math.sin(a) * ry * 0.82);
    g.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    g.stroke();
  }
  g.restore();
  // lip highlight
  g.strokeStyle = 'rgba(255,248,230,0.35)';
  g.lineWidth = 2;
  g.beginPath(); g.ellipse(cx, cy - 1.5, rx * 0.99, ry * 0.97, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();

  // inner wall, then the water
  g.fillStyle = '#6f6759';
  g.beginPath(); g.ellipse(cx, cy + 1, rx * 0.84, ry * 0.76, 0, 0, Math.PI * 2); g.fill();
  const water = g.createRadialGradient(cx - rx * 0.2, cy - ry * 0.3, 2, cx, cy, rx * 0.8);
  water.addColorStop(0, '#7cc4e0');
  water.addColorStop(0.6, '#3f86ae');
  water.addColorStop(1, '#23607f');
  g.fillStyle = water;
  g.beginPath(); g.ellipse(cx, cy + 1, rx * 0.78, ry * 0.68, 0, 0, Math.PI * 2); g.fill();
  // ripples
  g.save();
  g.strokeStyle = 'rgba(220,245,255,0.35)';
  g.lineWidth = 1.2;
  for (const t of [0.34, 0.52, 0.7]) {
    g.beginPath(); g.ellipse(cx, cy + 2, rx * t, ry * t * 0.8, 0, 0, Math.PI * 2); g.stroke();
  }
  g.restore();
  g.fillStyle = 'rgba(255,255,255,0.32)';
  g.beginPath(); g.ellipse(cx - rx * 0.28, cy - ry * 0.22, rx * 0.22, ry * 0.12, -0.3, 0, Math.PI * 2); g.fill();

  // --- pedestal and upper bowl -------------------------------------------
  const colH = h * 0.30;
  g.fillStyle = '#7d7466';
  g.beginPath();
  g.moveTo(cx - 7, cy - 2);
  g.quadraticCurveTo(cx - 5, cy - colH * 0.6, cx - 5, cy - colH);
  g.lineTo(cx + 5, cy - colH);
  g.quadraticCurveTo(cx + 5, cy - colH * 0.6, cx + 7, cy - 2);
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,250,235,0.20)';
  g.fillRect(cx - 6, cy - colH, 3, colH - 2);

  const bowlY = cy - colH;
  g.fillStyle = '#948a7b';
  g.beginPath(); g.ellipse(cx, bowlY, rx * 0.36, ry * 0.22, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4f9cc0';
  g.beginPath(); g.ellipse(cx, bowlY - 1, rx * 0.28, ry * 0.15, 0, 0, Math.PI * 2); g.fill();

  // jet and the water falling back into the basin
  g.save();
  g.globalAlpha = 0.55;
  g.strokeStyle = '#d6f1ff';
  g.lineWidth = 2.4;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx, bowlY - 4);
  g.quadraticCurveTo(cx, bowlY - 18, cx, bowlY - 22);
  g.stroke();
  g.lineWidth = 1.8;
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx, bowlY - 21);
    g.quadraticCurveTo(cx + dir * rx * 0.34, bowlY - 10, cx + dir * rx * 0.42, cy - 2);
    g.stroke();
    g.beginPath();
    g.moveTo(cx + dir * rx * 0.2, bowlY + 2);
    g.quadraticCurveTo(cx + dir * rx * 0.3, cy - ry * 0.4, cx + dir * rx * 0.3, cy - 3);
    g.stroke();
  }
  g.restore();
  blob(g, cx, bowlY - 23, 4.5, 'rgba(214,241,255,0.75)');
  // splash rings where the water lands
  g.save();
  g.globalAlpha = 0.4;
  g.strokeStyle = '#eaf8ff';
  g.lineWidth = 1;
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + dir * rx * 0.4, cy, 5, 2.2, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();

  // moss where the stone stays wet
  g.save();
  g.globalAlpha = 0.35;
  g.fillStyle = PAL.moss;
  for (const [t, r] of [[0.15, 5], [0.62, 4], [0.88, 3.4]]) {
    const a = t * Math.PI * 2;
    g.beginPath();
    g.ellipse(cx + Math.cos(a) * rx * 0.92, cy + Math.sin(a) * ry * 0.92, r, r * 0.5, a, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** Coursed stone: rows of blocks with staggered joints, shaded per block. */
function stonework(g, x, y, w, h, top, bottom, seed) {
  const grad = g.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, top); grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(x, y, w, h);
  let s = seed;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const rowH = 9;
  for (let ry = 0, row = 0; ry < h; ry += rowH, row++) {
    let bx = x - (row % 2 ? 7 : 0);
    while (bx < x + w) {
      const bw = 12 + Math.floor(rnd() * 8);
      g.fillStyle = `rgba(255,255,255,${0.03 + rnd() * 0.08})`;
      g.fillRect(Math.max(x, bx) + 1, y + ry + 1, Math.min(bw, x + w - bx) - 2, rowH - 2);
      g.fillStyle = 'rgba(40,36,34,0.45)';
      g.fillRect(Math.max(x, bx), y + ry, 1, rowH);
      bx += bw;
    }
    g.fillStyle = 'rgba(40,36,34,0.45)';
    g.fillRect(x, y + ry, w, 1);
  }
}

/**
 * A stretch of city wall. Laid east-west it shows its walkway and the face
 * that looks into town; north-south it is seen from above, so it is walkway
 * between two rows of merlons.
 */
function drawRampart(g, w, h) {
  const across = w >= h;
  const C = { top: '#b3aea4', face: '#97918a', deep: '#5d5852', walk: '#a39d92' };
  if (across) {
    const merlon = 14, walkH = 22;
    stonework(g, 0, merlon + walkH, w, h - merlon - walkH - 2, C.face, C.deep, w * 7 + h);
    g.fillStyle = C.walk;
    g.fillRect(0, merlon, w, walkH);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, merlon + walkH - 3, w, 3);
    for (let x = 2; x < w - 4; x += 20) {
      stonework(g, x, 2, 11, merlon, C.top, C.face, x + 3);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(x, merlon, 11, 2);
    }
  } else {
    stonework(g, 0, 12, w, h - 14, C.walk, shade(C.walk, -18), w + h * 3);
    for (const x of [0, w - 12]) {
      for (let y = 14; y < h - 12; y += 20) stonework(g, x, y, 12, 12, C.top, C.face, y + x);
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(x === 0 ? 12 : w - 14, 12, 2, h - 14);
    }
    stonework(g, 0, h - 26, w, 24, C.face, C.deep, h);
  }
}

/** Round tower with a conical roof, the kind that stands on a wall corner. */
function drawTower(g, w, h, roofColor = '#3f5f9e') {
  const cx = w / 2, bodyTop = 78, base = h - 4, rx = w / 2 - 8;
  g.save();
  g.filter = 'blur(6px)';
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.beginPath(); g.ellipse(cx, base, rx + 4, 12, 0, 0, Math.PI * 2); g.fill();
  g.restore();

  // the drum: coursed stone, lit from the left so it reads as round
  g.save();
  g.beginPath();
  g.ellipse(cx, bodyTop, rx, 10, 0, Math.PI, 0);
  g.lineTo(cx + rx, base - 8);
  g.ellipse(cx, base - 8, rx, 10, 0, 0, Math.PI);
  g.closePath();
  g.clip();
  stonework(g, cx - rx, bodyTop - 10, rx * 2, base - bodyTop + 10, '#b8b3a8', '#7d7870', w * 11);
  const round = g.createLinearGradient(cx - rx, 0, cx + rx, 0);
  round.addColorStop(0, 'rgba(255,255,255,0.18)');
  round.addColorStop(0.4, 'rgba(255,255,255,0)');
  round.addColorStop(1, 'rgba(0,0,0,0.42)');
  g.fillStyle = round;
  g.fillRect(cx - rx, bodyTop - 10, rx * 2, base - bodyTop + 10);
  g.restore();
  // arrow slit and a window with a warm light
  g.fillStyle = '#26221f';
  g.fillRect(cx - 2, bodyTop + 20, 4, 14);
  g.fillStyle = '#e8b85a';
  g.fillRect(cx - 4, bodyTop + 44, 8, 10);
  g.fillStyle = '#4a3a2a';
  g.fillRect(cx - 5, bodyTop + 43, 10, 1);

  // crenellated ring under the roof
  g.fillStyle = '#a8a39a';
  g.beginPath(); g.ellipse(cx, bodyTop, rx + 5, 12, 0, 0, Math.PI * 2); g.fill();
  for (let a = Math.PI * 0.08; a < Math.PI; a += Math.PI / 5) {
    const mx = cx - Math.cos(a) * (rx + 2);
    g.fillStyle = a > Math.PI / 2 ? '#8a857d' : '#c2bdb2';
    g.fillRect(mx - 5, bodyTop + Math.sin(a) * 9 - 8, 10, 10);
  }

  // conical roof, split light/dark down the middle
  const peak = 4, eave = bodyTop + 2;
  g.fillStyle = shade(roofColor, 30);
  g.beginPath();
  g.moveTo(cx, peak);
  g.lineTo(cx + rx + 9, eave);
  g.quadraticCurveTo(cx, eave + 14, cx - rx - 9, eave);
  g.closePath(); g.fill();
  g.fillStyle = shade(roofColor, -30);
  g.beginPath();
  g.moveTo(cx, peak);
  g.lineTo(cx + rx + 9, eave);
  g.quadraticCurveTo(cx + rx * 0.5, eave + 11, cx + 4, eave + 7);
  g.closePath(); g.fill();
  g.save();
  g.globalAlpha = 0.18; g.strokeStyle = '#000'; g.lineWidth = 1.2;
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    g.beginPath();
    g.moveTo(cx - (rx + 9) * t, peak + (eave - peak) * t);
    g.quadraticCurveTo(cx, peak + (eave - peak) * t + 12 * t, cx + (rx + 9) * t, peak + (eave - peak) * t);
    g.stroke();
  }
  g.restore();
  // finial pennant
  g.fillStyle = '#d9b44a';
  g.fillRect(cx - 1, peak - 2, 2, 5);
}

/** A straw practice dummy on a post, for the training ground. */
DRAW.dummy = (g, w, h) => {
  const cx = w / 2, base = h - 3;
  shadow(g, w, h, 7);
  g.fillStyle = '#6b4a28';
  g.fillRect(cx - 2, base - 30, 4, 30);
  g.fillRect(cx - 11, base - 24, 22, 3);
  g.fillStyle = '#c9a55a';
  g.beginPath(); g.ellipse(cx, base - 22, 7, 9, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx, base - 35, 5, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#8a6a30'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(cx - 6, base - 22); g.lineTo(cx + 6, base - 22); g.stroke();
  g.strokeStyle = '#b3322b'; g.lineWidth = 1.5;
  g.beginPath(); g.arc(cx, base - 22, 3, 0, Math.PI * 2); g.stroke();
};

const SIZED = { house: drawHouse, stall: drawStall, fountain: drawFountain, rampart: drawRampart, tower: drawTower };
/** How far each sized kind's art rises above its footprint. */
const RISE = { house: 26, rampart: 14, tower: 78 };

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
    ? `${kind}:${prop.w}x${prop.h}:${prop.roof ?? ''}:${prop.sign ?? ''}:${prop.variant ?? 0}`
    : kind;
  let c = cache.get(key);
  if (c) return c;
  if (sized) {
    const w = Math.round(prop.w), h = Math.round(prop.h + (RISE[kind] ?? 12));
    c = make(w, h, (g) => sized(g, w, h, prop.roof, prop.sign, prop.variant ?? 0));
  } else {
    const draw = DRAW[kind] ?? DRAW.rock;
    c = make(32, 48, (g, w, h) => draw(g, w, h));
  }
  cache.set(key, c);
  return c;
}
