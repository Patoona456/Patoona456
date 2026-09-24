// Item and skill icons, drawn from shapes instead of image files.
//
// Every icon is authored on a 32x32 grid, rendered once into a cached canvas
// per (kind, rarity, size) and reused. Nothing here needs an art asset, which
// keeps the download small and lets a new item pick up an icon for free.
import { ITEMS } from '../../shared/data/items.js';
import { SKILLS } from '../../shared/data/skills.js';

export const RARITY = {
  common: '#cfd8dc', uncommon: '#66bb6a', rare: '#42a5f5',
  epic: '#ab47bc', legendary: '#ffa726',
};

const cache = new Map();

/** Painted pieces cut from the HUD sheet (tools/slice-ui.py). */
export const UI_BASE = '/assets/ui';

// Icon kinds that have painted art on the HUD sheet. Everything else keeps
// its drawn shape, so a new skill or item still gets an icon for free.
const ART = {
  fire: 'skill_fire', storm: 'skill_storm', frost: 'skill_frost', heal: 'skill_heal',
  light: 'skill_light', debuff: 'skill_debuff', poison: 'skill_debuff', slash: 'skill_slash',
  aoe: 'skill_aoe', pierce: 'skill_pierce', guard: 'skill_guard', dash: 'skill_dash',
  summon: 'skill_summon', shout: 'skill_summon',
};
// Items that get painted art of their own, by id. Empty until the new item
// sheet is cut; until then every item draws its kind's shape.
const ITEM_ART = {};
const artImages = new Map();
function artImage(name) {
  let img = artImages.get(name);
  if (!img) {
    img = new Image();
    img.src = `${UI_BASE}/${name}.webp`;
    artImages.set(name, img);
  }
  return img;
}
/** Atlases: many icons in one file, as equal square cells, `cols` across. */
const ATLAS = { potions: { cols: 8 }, scrolls: { cols: 8 }, swords: { cols: 6 }, swords_rare: { cols: 8 } };
/** Paint the sheet art over a canvas now, or as soon as it has loaded. */
function paintArt(canvas, name) {
  // 'potions#12' is cell 12 of the potions atlas
  const [file, cellId] = name.split('#');
  const img = artImage(file);
  const square = name.startsWith('skill_');
  const draw = () => {
    if (!img.naturalWidth) return;
    const g = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    g.clearRect(0, 0, w, h);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    if (cellId != null && ATLAS[file]) {
      const cols = ATLAS[file].cols, cell = img.naturalWidth / cols, i = +cellId;
      g.drawImage(img, (i % cols) * cell, Math.floor(i / cols) * cell, cell, cell, w * 0.03, h * 0.03, w * 0.94, h * 0.94);
      return;
    }
    if (square) { g.drawImage(img, 0, 0, w, h); return; }
    const k = Math.min(w / img.naturalWidth, h / img.naturalHeight) * 0.94;
    const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
    g.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  };
  if (img.complete) draw();
  else img.addEventListener('load', draw, { once: true });
}
const px = (c, x, y, w, h, fill) => { c.fillStyle = fill; c.fillRect(x, y, w, h); };
const disc = (c, x, y, r, fill) => { c.fillStyle = fill; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };

/* ============================ item shapes ============================ */
export const SHAPES = {
  blade(c) {
    px(c, 14, 4, 5, 18, '#d6dde8'); px(c, 14, 4, 2, 18, '#f2f6fb'); px(c, 13, 6, 1, 14, '#8b94a3');
    px(c, 10, 21, 13, 3, '#7a5a37'); px(c, 15, 24, 3, 7, '#4a3520'); px(c, 14, 30, 5, 2, '#c9a227');
  },
  spear(c) {
    px(c, 15, 2, 3, 11, '#dfe6ef'); px(c, 14, 6, 5, 4, '#b9c2cf');
    px(c, 16, 12, 2, 19, '#7a5a37'); px(c, 14, 12, 6, 2, '#c9a227');
  },
  bow(c) {
    c.strokeStyle = '#8a6a3a'; c.lineWidth = 3;
    c.beginPath(); c.arc(20, 16, 12, Math.PI * 0.62, Math.PI * 1.38); c.stroke();
    c.strokeStyle = '#e8eef6'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(13, 6); c.lineTo(13, 26); c.stroke();
    px(c, 12, 15, 14, 2, '#dfe6ef');
  },
  rod(c) {
    px(c, 15, 10, 3, 21, '#6b4f34');
    disc(c, 16, 8, 6, '#7dd0ff');
    disc(c, 14, 6, 2, 'rgba(255,255,255,.65)');
  },
  shield(c) {
    c.fillStyle = '#8c939f';
    c.beginPath(); c.moveTo(6, 5); c.lineTo(26, 5); c.lineTo(26, 18);
    c.quadraticCurveTo(16, 30, 6, 18); c.closePath(); c.fill();
    c.fillStyle = '#c9a227';
    c.beginPath(); c.moveTo(10, 8); c.lineTo(22, 8); c.lineTo(22, 17);
    c.quadraticCurveTo(16, 25, 10, 17); c.closePath(); c.fill();
  },
  helm(c) {
    c.fillStyle = '#b6c0cf'; c.beginPath(); c.arc(16, 15, 11, Math.PI, 0); c.fill();
    px(c, 5, 15, 22, 9, '#94a0b0');
    px(c, 12, 15, 8, 9, '#1d232e');          // visor slit
    px(c, 5, 22, 22, 4, '#707c8c');
    px(c, 15, 2, 3, 6, '#e0b64a');           // crest
    px(c, 5, 15, 22, 2, '#dfe7f0');
  },
  hood(c) {
    c.fillStyle = '#6b5f7a'; c.beginPath(); c.arc(16, 15, 11, Math.PI, 0); c.fill();
    c.fillStyle = '#7d6f8d'; c.beginPath(); c.moveTo(5, 15); c.lineTo(27, 15); c.lineTo(23, 27); c.lineTo(9, 27); c.closePath(); c.fill();
    px(c, 12, 15, 8, 7, '#241f2c');
  },
  armor(c) {
    c.fillStyle = '#8fa3bd'; c.beginPath();                 // breastplate
    c.moveTo(9, 8); c.lineTo(23, 8); c.lineTo(25, 15); c.lineTo(22, 28); c.lineTo(10, 28); c.lineTo(7, 15);
    c.closePath(); c.fill();
    disc(c, 7, 10, 5, '#6d819c'); disc(c, 25, 10, 5, '#6d819c');   // pauldrons
    px(c, 15, 8, 3, 20, '#6b7e98');
    px(c, 9, 17, 14, 2, '#5d6e86');
    px(c, 9, 8, 14, 2, '#c3d3e6');
  },
  robe(c) {
    c.fillStyle = '#8c4a6b'; c.beginPath();
    c.moveTo(10, 5); c.lineTo(22, 5); c.lineTo(26, 27); c.lineTo(6, 27); c.closePath(); c.fill();
    px(c, 14, 5, 4, 22, '#a35c80'); px(c, 6, 24, 20, 3, '#c9a227');
  },
  legs(c) {
    px(c, 7, 6, 18, 6, '#8a94a6');                          // waist
    c.fillStyle = '#6f7a8c';
    c.beginPath(); c.moveTo(7, 12); c.lineTo(14, 12); c.lineTo(13, 29); c.lineTo(8, 29); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(18, 12); c.lineTo(25, 12); c.lineTo(24, 29); c.lineTo(19, 29); c.closePath(); c.fill();
    px(c, 7, 6, 18, 2, '#b9c4d4'); px(c, 14, 12, 4, 6, '#3c434f');
  },
  boots(c) {
    px(c, 6, 6, 8, 14, '#8a6440'); px(c, 4, 19, 13, 6, '#463122');   // left boot + sole
    px(c, 18, 6, 8, 14, '#8a6440'); px(c, 16, 19, 13, 6, '#463122');
    px(c, 6, 6, 8, 3, '#b0855a'); px(c, 18, 6, 8, 3, '#b0855a');
    px(c, 4, 24, 13, 2, '#2c1e14'); px(c, 16, 24, 13, 2, '#2c1e14');
  },
  gloves(c) {
    for (const x of [5, 18]) {
      c.fillStyle = '#a7b2c2';
      c.beginPath();
      c.moveTo(x, 12); c.quadraticCurveTo(x + 4, 6, x + 9, 12); c.lineTo(x + 9, 23);
      c.lineTo(x, 23); c.closePath(); c.fill();
      px(c, x, 20, 9, 4, '#c9a227');                        // cuff
      px(c, x + 3, 12, 2, 8, '#7f8b9c');                     // finger seam
    }
  },
  belt(c) { px(c, 4, 13, 24, 7, '#6b4f34'); px(c, 13, 11, 8, 11, '#c9a227'); px(c, 15, 14, 4, 5, '#3a2c18'); },
  // The five places the art boards added. A breastplate reads as heavier
  // than the shirt it goes over, so it keeps the rivets and loses the neck.
  harness(c) {
    c.fillStyle = '#9aa6b6'; c.beginPath();
    c.moveTo(8, 9); c.lineTo(24, 9); c.lineTo(24, 16); c.lineTo(20, 27); c.lineTo(12, 27); c.lineTo(8, 16);
    c.closePath(); c.fill();
    px(c, 8, 9, 16, 2, '#d3dde9');
    px(c, 8, 16, 16, 2, '#65717f');
    for (const x of [10, 21]) { disc(c, x, 12, 2.4, '#5d6a79'); disc(c, x, 23, 2.4, '#5d6a79'); }
    px(c, 15, 11, 2, 15, '#7d8a9a');
  },
  cloak(c) {
    c.fillStyle = '#5d4f7a'; c.beginPath();
    c.moveTo(11, 6); c.lineTo(21, 6); c.lineTo(27, 27); c.lineTo(19, 24); c.lineTo(16, 28);
    c.lineTo(13, 24); c.lineTo(5, 27); c.closePath(); c.fill();
    px(c, 11, 6, 10, 3, '#8a79ad');                         // collar
    disc(c, 16, 8, 2.2, '#e0b64a');                         // clasp
  },
  scarf(c) {
    px(c, 5, 12, 22, 6, '#b8503f');
    c.fillStyle = '#8f3a2d';
    c.beginPath(); c.moveTo(18, 18); c.lineTo(26, 22); c.lineTo(17, 27); c.closePath(); c.fill();
    px(c, 5, 12, 22, 2, '#d4705f');
  },
  glasses(c) {
    c.strokeStyle = '#cfd6df'; c.lineWidth = 2.4;
    c.fillStyle = 'rgba(150,205,255,.35)';
    for (const x of [10, 22]) { c.beginPath(); c.arc(x, 16, 5.5, 0, Math.PI * 2); c.fill(); c.stroke(); }
    c.beginPath(); c.moveTo(15.5, 16); c.lineTo(16.5, 16); c.stroke();
    c.beginPath(); c.moveTo(4.5, 14); c.lineTo(2, 12); c.moveTo(27.5, 14); c.lineTo(30, 12); c.stroke();
  },
  // Wings fell through to the breastplate glyph, which is what every wing in
  // the game has been showing in the bag since they were added.
  wings(c) {
    for (const side of [-1, 1]) {
      c.save(); c.translate(16, 16); c.scale(side, 1);
      c.fillStyle = '#e9d9a8'; c.beginPath();
      c.moveTo(1, -6); c.quadraticCurveTo(13, -10, 14, 2);
      c.quadraticCurveTo(9, 0, 1, 7); c.closePath(); c.fill();
      c.fillStyle = '#c0aa74'; c.beginPath();
      c.moveTo(1, 0); c.quadraticCurveTo(9, -1, 13, 1);
      c.quadraticCurveTo(8, 2, 1, 7); c.closePath(); c.fill();
      c.restore();
    }
    px(c, 15, 8, 2, 16, '#9a8a5c');
  },
  mask(c) {
    c.fillStyle = '#cbbf9a'; c.beginPath();
    c.moveTo(7, 8); c.lineTo(25, 8); c.lineTo(25, 17); c.lineTo(16, 28); c.lineTo(7, 17);
    c.closePath(); c.fill();
    px(c, 7, 8, 18, 2, '#e6dcc0');
    px(c, 10, 13, 4, 3, '#3a3327'); px(c, 18, 13, 4, 3, '#3a3327');   // eye holes
    px(c, 14, 19, 4, 4, '#3a3327');
  },
  ring(c) {
    c.strokeStyle = '#e0b64a'; c.lineWidth = 4; c.beginPath(); c.arc(16, 19, 8, 0, Math.PI * 2); c.stroke();
    disc(c, 16, 9, 4.5, '#ff6b8a');
  },
  potion(c, tint = '#d94b4b') {
    px(c, 13, 4, 6, 4, '#c9c2b0');
    c.fillStyle = '#cfd8dc';
    c.beginPath(); c.moveTo(12, 8); c.lineTo(20, 8); c.lineTo(24, 18); c.lineTo(24, 28);
    c.lineTo(8, 28); c.lineTo(8, 18); c.closePath(); c.fill();
    px(c, 10, 17, 12, 9, tint);
    px(c, 11, 11, 2, 6, 'rgba(255,255,255,.45)');
  },
  mana(c) { SHAPES.potion(c, '#4b8fd9'); },
  antidote(c) { SHAPES.potion(c, '#6fbf5a'); },
  food(c) {
    c.fillStyle = '#b5723a'; c.beginPath(); c.ellipse(16, 18, 11, 7, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#d99a58'; c.beginPath(); c.ellipse(14, 16, 6, 3.5, -0.3, 0, Math.PI * 2); c.fill();
    px(c, 21, 20, 8, 3, '#e8dcc0');
  },
  scroll(c) {
    px(c, 8, 7, 16, 18, '#e8dcc0'); px(c, 8, 5, 16, 3, '#b8a882'); px(c, 8, 24, 16, 3, '#b8a882');
    for (let i = 0; i < 4; i++) px(c, 11, 10 + i * 4, 10 - i, 1.6, '#8a7b5c');
  },
  arrow(c) {
    px(c, 15, 6, 2, 20, '#8a6a3a');
    c.fillStyle = '#dfe6ef'; c.beginPath(); c.moveTo(16, 2); c.lineTo(21, 10); c.lineTo(11, 10); c.closePath(); c.fill();
    c.fillStyle = '#c85c50'; c.beginPath(); c.moveTo(16, 24); c.lineTo(21, 30); c.lineTo(11, 30); c.closePath(); c.fill();
  },
  ore(c) {
    c.fillStyle = '#6a6a74'; c.beginPath();
    c.moveTo(6, 24); c.lineTo(10, 11); c.lineTo(22, 8); c.lineTo(27, 20); c.lineTo(18, 27); c.closePath(); c.fill();
    c.fillStyle = '#8b94a3'; c.beginPath(); c.moveTo(11, 19); c.lineTo(14, 12); c.lineTo(21, 11); c.closePath(); c.fill();
  },
  ingot(c) {
    c.fillStyle = '#9aa3b1'; c.beginPath();
    c.moveTo(6, 22); c.lineTo(10, 13); c.lineTo(24, 13); c.lineTo(28, 22); c.closePath(); c.fill();
    px(c, 10, 13, 14, 3, '#c2cad6'); px(c, 6, 22, 22, 3, '#6d7684');
  },
  bone(c) {
    c.strokeStyle = '#d9d2bd'; c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(9, 22); c.lineTo(23, 10); c.stroke();
    c.lineWidth = 3; c.beginPath(); c.moveTo(8, 10); c.lineTo(24, 22); c.stroke();
  },
  herb(c) {
    c.strokeStyle = '#4b8a3a'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(16, 28); c.lineTo(16, 12); c.stroke();
    c.fillStyle = '#5ea34a';
    for (const s of [-1, 1]) { c.beginPath(); c.ellipse(16 + s * 6, 16, 6, 3.4, s * 0.7, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#8fd06a'; c.beginPath(); c.ellipse(16, 10, 4, 5, 0, 0, Math.PI * 2); c.fill();
  },
  pelt(c) {
    c.fillStyle = '#8a6a48'; c.beginPath();
    c.moveTo(10, 6); c.quadraticCurveTo(4, 16, 9, 27); c.lineTo(23, 27);
    c.quadraticCurveTo(28, 16, 22, 6); c.quadraticCurveTo(16, 11, 10, 6); c.closePath(); c.fill();
    c.fillStyle = '#a3805c'; c.beginPath(); c.ellipse(16, 18, 5, 7, 0, 0, Math.PI * 2); c.fill();
  },
  fang(c) {
    c.fillStyle = '#efe9d8'; c.beginPath();
    c.moveTo(12, 5); c.lineTo(20, 7); c.lineTo(17, 28); c.quadraticCurveTo(14, 20, 12, 5); c.closePath(); c.fill();
    px(c, 12, 5, 8, 3, '#c7c0ad');
  },
  rope(c) {
    c.strokeStyle = '#a8905c'; c.lineWidth = 3;
    c.beginPath(); c.arc(16, 18, 8, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#8a7548'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(16, 4); c.quadraticCurveTo(22, 8, 20, 12); c.stroke();
  },
  sinew(c) {
    c.strokeStyle = '#9c7f6e'; c.lineWidth = 3; c.lineCap = 'round';
    for (const o of [-4, 0, 4]) {
      c.beginPath(); c.moveTo(8 + o, 26); c.quadraticCurveTo(16 + o, 16, 10 + o, 6); c.stroke();
    }
  },
  cinder(c) {
    const g = c.createRadialGradient(16, 18, 2, 16, 18, 13);
    g.addColorStop(0, '#ffd08a'); g.addColorStop(0.5, '#ff8a3d'); g.addColorStop(1, 'rgba(120,30,10,0)');
    c.fillStyle = g; c.beginPath(); c.arc(16, 18, 13, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3a2a22'; c.beginPath(); c.ellipse(16, 24, 8, 3, 0, 0, Math.PI * 2); c.fill();
  },
  tear(c) {
    c.fillStyle = '#9fdcff'; c.beginPath();
    c.moveTo(16, 4); c.quadraticCurveTo(26, 18, 16, 28); c.quadraticCurveTo(6, 18, 16, 4); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(13, 17, 2.5, 5, -0.3, 0, Math.PI * 2); c.fill();
  },
  quill(c) {
    c.strokeStyle = '#7dd0ff'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(9, 27); c.quadraticCurveTo(20, 20, 23, 5); c.stroke();
    c.fillStyle = 'rgba(125,208,255,.55)';
    c.beginPath(); c.moveTo(23, 5); c.quadraticCurveTo(13, 12, 12, 24); c.quadraticCurveTo(21, 18, 23, 5); c.closePath(); c.fill();
  },
  whetstone(c) {
    c.fillStyle = '#6f6a7d'; c.beginPath();
    c.moveTo(5, 21); c.lineTo(12, 11); c.lineTo(27, 12); c.lineTo(21, 23); c.closePath(); c.fill();
    c.strokeStyle = '#c9a227'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(10, 18); c.lineTo(16, 14); c.lineTo(14, 19); c.lineTo(21, 16); c.stroke();
  },
  oil(c) {
    px(c, 14, 3, 4, 5, '#c9a227');
    c.fillStyle = '#d8c48a'; c.beginPath();
    c.moveTo(11, 8); c.quadraticCurveTo(5, 18, 11, 27); c.lineTo(21, 27);
    c.quadraticCurveTo(27, 18, 21, 8); c.closePath(); c.fill();
    px(c, 11, 17, 10, 10, '#e8b74a');
    disc(c, 16, 14, 2.4, 'rgba(255,255,255,.6)');
  },
  shard(c) {
    const g = c.createLinearGradient(10, 4, 22, 28);
    g.addColorStop(0, '#fff3cf'); g.addColorStop(1, '#ffb03a');
    c.fillStyle = g; c.beginPath();
    c.moveTo(16, 3); c.lineTo(23, 15); c.lineTo(16, 29); c.lineTo(9, 15); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath();
    c.moveTo(16, 6); c.lineTo(20, 15); c.lineTo(16, 22); c.closePath(); c.fill();
  },
  crown(c) {
    c.fillStyle = '#e0b64a'; c.beginPath();
    c.moveTo(5, 24); c.lineTo(7, 9); c.lineTo(12, 16); c.lineTo(16, 6); c.lineTo(20, 16);
    c.lineTo(25, 9); c.lineTo(27, 24); c.closePath(); c.fill();
    px(c, 5, 24, 22, 3, '#a8822c');
    disc(c, 16, 20, 2, '#c85c50');
    c.fillStyle = '#2a2a2a'; px(c, 12, 12, 2, 8, 'rgba(0,0,0,.25)');
  },
  tooth(c) {
    c.fillStyle = '#e4dcc4'; c.beginPath();
    c.moveTo(10, 6); c.lineTo(22, 6); c.lineTo(19, 18); c.lineTo(16, 27); c.lineTo(13, 18); c.closePath(); c.fill();
    px(c, 10, 6, 12, 3, '#c3b99c');
  },
  crate(c) { px(c, 6, 8, 20, 18, '#7a5a37'); px(c, 6, 8, 20, 3, '#96703f'); px(c, 14, 8, 4, 18, '#5c4227'); },
};

/* ============================ skill shapes ============================ */
const SKILL_SHAPES = {
  slash(c) {
    c.strokeStyle = '#ffd08a'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.arc(16, 20, 11, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    c.strokeStyle = '#fff6e0'; c.lineWidth = 1.4;
    c.beginPath(); c.arc(16, 20, 8, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  },
  pierce(c) {
    c.strokeStyle = '#9fdcff'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(6, 26); c.lineTo(23, 9); c.stroke();
    c.fillStyle = '#e8f6ff'; c.beginPath(); c.moveTo(27, 5); c.lineTo(27, 13); c.lineTo(19, 12); c.closePath(); c.fill();
  },
  shout(c) {
    c.strokeStyle = '#ff8a3d'; c.lineWidth = 2;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(11, 16, 6 + i * 5, -0.9, 0.9); c.stroke(); }
    disc(c, 9, 16, 4, '#ffd08a');
  },
  guard(c) {
    c.globalAlpha = 0.32; disc(c, 16, 17, 12, '#7dd0ff'); c.globalAlpha = 1;
    c.strokeStyle = '#7dd0ff'; c.lineWidth = 2;
    c.beginPath(); c.arc(16, 17, 12, 0, Math.PI * 2); c.stroke();
    SHAPES.shield(c);
  },
  heal(c) {
    px(c, 13, 7, 6, 18, '#7dffb0'); px(c, 7, 13, 18, 6, '#7dffb0');
    px(c, 15, 9, 2, 14, 'rgba(255,255,255,.55)');
  },
  fire(c) {
    const g = c.createRadialGradient(16, 20, 2, 16, 18, 13);
    g.addColorStop(0, '#fff0c0'); g.addColorStop(0.45, '#ff8a3d'); g.addColorStop(1, 'rgba(160,40,10,0)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(16, 3); c.quadraticCurveTo(27, 16, 16, 29); c.quadraticCurveTo(5, 16, 16, 3); c.fill();
  },
  frost(c) {
    c.strokeStyle = '#9fdcff'; c.lineWidth = 2.4; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      c.beginPath();
      c.moveTo(16 - Math.cos(a) * 11, 16 - Math.sin(a) * 11);
      c.lineTo(16 + Math.cos(a) * 11, 16 + Math.sin(a) * 11);
      c.stroke();
    }
    disc(c, 16, 16, 3, '#e8f6ff');
  },
  storm(c) {
    c.fillStyle = '#ffe9a0'; c.beginPath();
    c.moveTo(18, 3); c.lineTo(9, 18); c.lineTo(15, 18); c.lineTo(13, 29);
    c.lineTo(23, 13); c.lineTo(17, 13); c.closePath(); c.fill();
  },
  shot(c) {
    c.strokeStyle = '#cfd8dc'; c.lineWidth = 1.6;
    c.beginPath(); c.arc(16, 16, 11, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(16, 3); c.lineTo(16, 10); c.moveTo(16, 22); c.lineTo(16, 29);
    c.moveTo(3, 16); c.lineTo(10, 16); c.moveTo(22, 16); c.lineTo(29, 16); c.stroke();
    disc(c, 16, 16, 3.4, '#ff6b6b');
  },
  volley(c) {
    c.strokeStyle = '#cfd8dc'; c.lineWidth = 2; c.lineCap = 'round';
    for (const o of [-7, 0, 7]) {
      c.beginPath(); c.moveTo(6 + o, 27); c.lineTo(12 + o, 7); c.stroke();
      c.fillStyle = '#e8eef6';
      c.beginPath(); c.moveTo(12 + o, 4); c.lineTo(16 + o, 11); c.lineTo(9 + o, 10); c.closePath(); c.fill();
    }
  },
  dash(c) {
    c.strokeStyle = '#c9b6ff'; c.lineWidth = 2.6; c.lineCap = 'round';
    for (const y of [10, 16, 22]) { c.beginPath(); c.moveTo(4, y); c.lineTo(16, y); c.stroke(); }
    c.fillStyle = '#e4dcff';
    c.beginPath(); c.moveTo(19, 5); c.lineTo(29, 16); c.lineTo(19, 27); c.closePath(); c.fill();
  },
  stealth(c) {
    c.fillStyle = '#5a5f7a'; c.beginPath();
    c.moveTo(6, 12); c.quadraticCurveTo(16, 6, 26, 12); c.quadraticCurveTo(22, 26, 16, 28);
    c.quadraticCurveTo(10, 26, 6, 12); c.closePath(); c.fill();
    disc(c, 12, 15, 2, '#d7e3ff'); disc(c, 20, 15, 2, '#d7e3ff');
  },
  aoe(c) {
    c.strokeStyle = '#ffd08a'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(16, 20, 12, 6, 0, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = 0.28; c.fillStyle = '#ffb03a';
    c.beginPath(); c.ellipse(16, 20, 12, 6, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    c.fillStyle = '#ff8a3d';
    c.beginPath(); c.moveTo(16, 3); c.lineTo(20, 14); c.lineTo(12, 14); c.closePath(); c.fill();
  },
  buff(c) {
    c.fillStyle = '#9be8a6'; c.beginPath();
    c.moveTo(16, 4); c.lineTo(26, 16); c.lineTo(20, 16); c.lineTo(20, 28);
    c.lineTo(12, 28); c.lineTo(12, 16); c.lineTo(6, 16); c.closePath(); c.fill();
  },
  debuff(c) {
    c.fillStyle = '#e88a9a'; c.beginPath();
    c.moveTo(16, 28); c.lineTo(26, 16); c.lineTo(20, 16); c.lineTo(20, 4);
    c.lineTo(12, 4); c.lineTo(12, 16); c.lineTo(6, 16); c.closePath(); c.fill();
  },
  poison(c) {
    disc(c, 16, 18, 10, '#6fbf5a');
    c.fillStyle = '#123'; disc(c, 12, 15, 2, '#1d2b18'); disc(c, 20, 15, 2, '#1d2b18');
    c.fillStyle = '#1d2b18'; px(c, 12, 21, 9, 2, '#1d2b18');
  },
  trap(c) {
    c.strokeStyle = '#a8905c'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(16, 20, 10, 5, 0, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#cfd8dc'; c.lineWidth = 1.6;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      c.beginPath();
      c.moveTo(16 + Math.cos(a) * 10, 20 + Math.sin(a) * 5);
      c.lineTo(16 + Math.cos(a) * 7, 20 + Math.sin(a) * 3.5 - 5);
      c.stroke();
    }
  },
  summon(c) {
    disc(c, 16, 20, 7, '#8d8d9a');
    disc(c, 10, 12, 3.4, '#8d8d9a'); disc(c, 22, 12, 3.4, '#8d8d9a');
    disc(c, 7, 20, 3, '#8d8d9a'); disc(c, 25, 20, 3, '#8d8d9a');
  },
  revive(c) {
    const g = c.createRadialGradient(16, 16, 2, 16, 16, 14);
    g.addColorStop(0, '#fff6d8'); g.addColorStop(1, 'rgba(255,220,140,0)');
    c.fillStyle = g; c.fillRect(0, 0, 32, 32);
    px(c, 14, 8, 4, 18, '#ffe9a0'); px(c, 9, 13, 14, 4, '#ffe9a0');
  },
  light(c) {
    const g = c.createRadialGradient(16, 16, 1, 16, 16, 14);
    g.addColorStop(0, '#fffbe8'); g.addColorStop(0.5, '#ffd77a'); g.addColorStop(1, 'rgba(255,190,90,0)');
    c.fillStyle = g; c.beginPath(); c.arc(16, 16, 14, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#fff3cf'; c.lineWidth = 2; c.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      c.beginPath();
      c.moveTo(16 + Math.cos(a) * 8, 16 + Math.sin(a) * 8);
      c.lineTo(16 + Math.cos(a) * 14, 16 + Math.sin(a) * 14);
      c.stroke();
    }
  },
  passive(c) {
    c.fillStyle = '#c9b6ff'; c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 5 : 12;
      c[i ? 'lineTo' : 'moveTo'](16 + Math.cos(a) * r, 16 + Math.sin(a) * r);
    }
    c.closePath(); c.fill();
  },
  steal(c) {
    c.fillStyle = '#c9a227'; c.beginPath();
    c.moveTo(10, 12); c.quadraticCurveTo(16, 6, 22, 12); c.lineTo(24, 27); c.lineTo(8, 27); c.closePath(); c.fill();
    px(c, 14, 15, 4, 7, '#6b5320');
  },
};

/* ================= mapping game data onto those shapes ================= */
// Items that draw as a shape other than their type's, by id.
const ITEM_OVERRIDE = {};

export function itemIconKind(id) {
  const it = ITEMS[id];
  if (!it) return 'crate';
  if (ITEM_OVERRIDE[id]) return ITEM_OVERRIDE[id];
  if (it.type === 'weapon') {
    // every class draws as the nearest of the four weapon shapes
    const w = it.wclass ?? 'sword';
    return { sword: 'blade', greatsword: 'blade', dagger: 'blade', axe: 'blade', special: 'blade',
      throwing: 'blade', staff: 'rod', wand: 'rod', knuckle: 'gloves' }[w] ?? w;
  }
  if (it.type === 'ammo') return 'arrow';
  if (it.type === 'consumable') return 'potion';
  if (it.type === 'material') return 'ore';
  if (it.type === 'armor') {
    if (it.slot === 'head') return id.includes('hood') ? 'hood' : 'helm';
    if (it.slot === 'accessory') return 'ring';
    return {
      torso: 'armor', legs: 'legs', feet: 'boots', hands: 'gloves', belt: 'belt', offhand: 'shield',
      armor: 'harness', cloak: 'cloak', scarf: 'scarf', glasses: 'glasses', mask: 'mask', wings: 'wings',
    }[it.slot] ?? 'armor';
  }
  return 'crate';
}

const SKILL_OVERRIDE = {
  first_aid: 'heal', shove: 'shout', cleave: 'slash', skewer: 'pierce', taunt: 'shout',
  bulwark_stance: 'guard', iron_will: 'passive', backstab: 'pierce', shadow_step: 'dash',
  venom_edge: 'poison', evasion: 'passive', pilfer: 'steal', aimed_shot: 'shot',
  volley: 'volley', pinning_arrow: 'trap', hawk_eye: 'passive', ember_arrow: 'fire',
  ember_bolt: 'fire', frost_nail: 'frost', storm_sigil: 'storm', mana_font: 'buff',
  runic_ward: 'guard', mend: 'heal', radiant_smite: 'light', blessing: 'buff',
  sanctuary: 'light', purge: 'heal', aegis: 'guard', thorn_guard: 'guard',
  unbreakable: 'guard', bloodthirst: 'buff', whirlwind: 'slash', reckless_charge: 'dash',
  cloak: 'stealth', mortal_strike: 'pierce', grim_harvest: 'slash', smoke_bomb: 'stealth',
  snare_trap: 'trap', sleight: 'passive', piercing_shot: 'shot', rain_of_arrows: 'volley',
  steady_aim: 'passive', meteor_rune: 'fire', glacial_field: 'frost', rune_overload: 'buff',
  chain_spark: 'storm', tempest_veil: 'storm', thunder_step: 'dash', greater_mend: 'heal',
  revive: 'revive', aura_of_dawn: 'light', oath_strike: 'light', consecrate: 'light',
  shield_of_vows: 'guard', call_companion: 'summon', wild_bond: 'passive',
};

export function skillIconKind(id) {
  if (SKILL_OVERRIDE[id]) return SKILL_OVERRIDE[id];
  const sk = SKILLS[id];
  if (!sk) return 'passive';
  if (sk.kind === 'passive') return 'passive';
  if (sk.kind === 'heal') return 'heal';
  if (sk.kind === 'buff') return 'buff';
  if (sk.kind === 'debuff') return 'debuff';
  if (sk.kind === 'dash') return 'dash';
  if (sk.kind === 'summon') return 'summon';
  if (sk.element === 'fire') return 'fire';
  if (sk.element === 'ice') return 'frost';
  if (sk.element === 'lightning') return 'storm';
  if (sk.element === 'holy') return 'light';
  return sk.kind === 'aoe' || sk.kind === 'ground' ? 'aoe' : 'slash';
}

/* ============================ rendering ============================ */
function render(kind, rarity, size) {
  const c = document.createElement('canvas');
  // drawn at the screen's own density (at least 2x, at most 3x) so painted
  // art stays sharp on phones as well as on desktop retina
  const k = Math.min(3, Math.max(2, Math.ceil(globalThis.devicePixelRatio ?? 2)));
  c.width = c.height = size * k;
  c.style.width = c.style.height = size + 'px';
  const g = c.getContext('2d');
  g.setTransform((size * k) / 32, 0, 0, (size * k) / 32, 0, 0);
  if (rarity && RARITY[rarity] && rarity !== 'common') {
    const grad = g.createRadialGradient(16, 16, 2, 16, 16, 17);
    grad.addColorStop(0, RARITY[rarity] + '55');
    grad.addColorStop(1, RARITY[rarity] + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
  }
  (SHAPES[kind] ?? SKILL_SHAPES[kind] ?? SHAPES.crate)(g);
  return c;
}

/** A cached <canvas> for one icon. Clone it before putting it in the DOM twice. */
export function icon(kind, { rarity = null, size = 32, art = null } = {}) {
  const key = `${kind}|${rarity}|${size}`;
  let c = cache.get(key);
  if (!c) { c = render(kind, rarity, size); cache.set(key, c); }
  const copy = document.createElement('canvas');
  copy.width = c.width; copy.height = c.height;
  copy.style.width = copy.style.height = size + 'px';
  copy.className = 'icon';
  copy.getContext('2d').drawImage(c, 0, 0);
  if (art ?? ART[kind]) paintArt(copy, art ?? ART[kind]);
  return copy;
}

export const itemIcon = (id, opts = {}) => icon(itemIconKind(id), { rarity: ITEMS[id]?.rarity, art: ITEM_ART[id] ?? ITEMS[id]?.art, ...opts });
export const skillIcon = (id, opts = {}) => icon(skillIconKind(id), opts);
