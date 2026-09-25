// Canvas renderer: procedural terrain tiles + LPC paper-doll entities.
import { TILE, SPRITE, LEVEL_AGGRO_GAP } from '../../shared/constants.js';
import { vecOf, toDir4 } from '../../shared/facing.js';
import { TILES, MAPS, decodeGrid, generateProps, hash2 } from '../../shared/data/maps.js';
import { propSprite, GLOWING } from './props.js';
import { buildTerrain } from './terrain.js';
import { ITEMS, RARITY_COLORS } from '../../shared/data/items.js';
import { drawCharacter, drawBlob, drawRefineGlow, drawOverlaySheet, playerLayers, monsterLayers, npcLayers, drawPicture,
  drawMobFrames, mobAnimMs, drawMobFx } from './sprites.js';
import { glowTier, hasOverlay } from '../../shared/refineglow.js';
import { drawWings } from './wings.js';
import { drawBehind, drawInFront, apparelOf } from './apparel.js';
import { Particles } from './particles.js';
import { skyAt } from '../../shared/daycycle.js';
import { drawSkillFx, lifeOf, scorchOf, drawScorch, debrisOf, drawWarning } from './skillfx.js';
import { Weather } from './weather.js';
import { look as elLook, rgba as elRgba } from '../../shared/elements.js';
import { UI_BASE } from './icons.js';
import { CHIBI_WALK, frameAt } from '../../shared/sheets.js';
import { CHIBI_FISTS } from '../../shared/data/chibi.js';
import { SWING } from '../../shared/data/swing.js';
import { MOB_ART } from '../../shared/data/mobart.js';
import { DROP_ART } from '../../shared/data/dropart.js';
import { prefs, onPref } from './prefs.js';
import { atlasFile, atlasRect, ATLAS_FILES } from '../../shared/atlas.js';

const uiImages = new Map();
/** One of the painted HUD words (miss, critical, levelup), loaded once. */
function uiImage(name) {
  let img = uiImages.get(name);
  if (!img) { img = new Image(); img.src = `${UI_BASE}/${name}.webp`; uiImages.set(name, img); }
  return img;
}
// fetched up front: a word that loads on its first use would miss that hit
// the market booth from the shop sheet, and the lantern hung beside it
const STALL_ART = typeof Image !== 'undefined' ? { stall: uiImage('stall'), lantern: uiImage('lantern') } : null;
// lock-on, picked, and friendly target reticles, side by side in one strip
const RETICLES = typeof Image !== 'undefined' ? uiImage('reticles') : null;

// Monster loot drawn from the drop sheet (tools/slice-drops.py): an item whose
// `loot` names a row there falls, lies and is picked up as that row; aurum is gold.
const DROPS = typeof Image !== 'undefined' ? uiImage(DROP_ART.file) : null;
const LOOT_SIZE = 32;         // world px a drop-sheet cell is drawn at (loot reads smaller than a slime)
const LOOT_FRAME_MS = 60;     // the fall (13 frames) is over in under a second
// which colour of pick-up swirl each kind of loot goes up in, and for how long
const PICKUP_SWIRL = { jelly: 'water', crystal: 'water', gold: 'gold', cap: 'nature', herb: 'nature', ncrystal: 'nature',
  leaf: 'leaf', shell: 'shell', honey: 'honey', stinger: 'stinger', wcrystal: 'wcrystal',
  meat: 'meat', hide: 'hide', tusk: 'tusk', sleaf: 'sleaf', essence: 'essence' };
const PICKUP_MS = 480;
/**
 * Where a painted monster is drawn relative to where it stands. A flyer
 * (`sprite.fly`) hovers that high over its shadow with a lazy bob, rising
 * out of the ground as it spawns; a lunger (`sprite.lunge`) darts that far
 * toward whatever it faces when it strikes, and back.
 */
function mobOffset(e, anim, elapsed, now) {
  let dx = 0, dy = 0;
  const fly = e.sprite.fly ?? 0;
  if (fly) {
    const rise = anim === 'spawn' ? Math.min(1, elapsed / mobAnimMs(e.sprite.key, 'spawn')) : 1;
    dy -= (fly + Math.sin(now / 190 + (e.id.charCodeAt(e.id.length - 1) ?? 0)) * 2.5) * rise;
  }
  const lunge = e.sprite.lunge ?? 0;
  if (lunge && (anim === 'slash' || anim === 'thrust')) {
    const k = Math.min(1, elapsed / Math.max(1, mobAnimMs(e.sprite.key, 'attack')));
    const [vx, vy] = vecOf(e.d ?? 0);
    const out = Math.sin(Math.PI * k) * lunge;
    dx += vx * out; dy += vy * out * 0.6;
  }
  return { dx, dy };
}

const lootKind = (g) => (g.id === '__aurum' ? 'gold' : ITEMS[g.id]?.loot ?? null);
/** Which of the four piles on the sheet an amount lies as. */
function lootTier(kind, qty) {
  if (kind === 'gold') return qty >= 1000 ? 1000 : qty >= 100 ? 100 : qty >= 10 ? 10 : 1;
  return qty >= 10 ? 4 : qty >= 5 ? 3 : qty >= 2 ? 2 : 1;
}
const RETICLE_CELLS = ['lock', 'pick', 'ally'];
const BOOTH_W = 88;            // world px: a little under three tiles
const BOOTH_COUNTER = 0.52;    // where the counter top sits, as a share of the art's height

/** The atlas cell a player's weapon is painted in, if its item has one. */
function heldArt(e) {
  const [file, cell] = (ITEMS[e.eq?.weapon]?.art ?? '').split('#');
  if (cell == null) return null;
  const img = uiImage(atlasFile(file));
  const bow = ITEMS[e.eq?.weapon]?.wclass === 'bow';
  return img.naturalWidth ? { img, file, cell: +cell, bow } : null;
}

/**
 * How the weapon fist holds its blade in each of the chibi's four rows
 * (down, left, up, right): which side the blade points to at rest and which
 * it cuts toward, how far it is tipped up from level at rest (radians), and
 * whether the fist is over the body. Facing the camera or away, the blade
 * stands up beside the body, leaning out. In the side views the visible arm
 * hangs at the back, so the sword is carried the way a walking swordsman
 * carries it: low at the hip, pointed ahead, the blade across the front of
 * the body - drawn after the body, with the fist painted back over the grip.
 * Where the fist is, frame by frame, is measured off the art
 * (shared/data/chibi.js).
 */
const CHIBI_GRIP = [
  { side: 1, cut: 1, over: false, rest: 1.2 },     // down
  { side: -1, cut: -1, over: true, rest: 0.6 },    // left
  { side: 1, cut: 1, over: false, rest: 1.2 },     // up
  { side: 1, cut: 1, over: true, rest: 0.6 },      // right
];
/**
 * How far a chibi travels over one walk cycle, in screen pixels at scale 1.
 * The drawn stride is shorter, but a cadence that matched it exactly reads
 * as frantic at running speed; this lands on ~12 frames a second at base
 * speed and the feet barely slide.
 */
const CHIBI_STRIDE = 72;
// a monster in the middle of these is not interrupted by a flinch
const ONE_SHOT_MOB = new Set(['slash', 'thrust', 'shoot', 'spellcast', 'spawn', 'skill']);
const CHIBI_CYCLE_MS = (CHIBI_WALK.anims.walk.frames / CHIBI_WALK.anims.walk.fps) * 1000;
/**
 * A bow is gripped by its handle (the middle of the limb, where the riser
 * is) in the fist the character shows, standing up, with the string toward
 * the body and the limb bowing away from it. It goes on after the body and
 * the fist is painted back over the handle, so the hand is plainly round the
 * bow and never on the string. `side` mirrors it so the limb faces outward;
 * `rest` tips it from level as for swords.
 */
const BOW_POSE = [
  { rest: 1.4, side: 1 },     // down
  { rest: 1.45, side: 1 },    // left
  { rest: 1.4, side: 1 },     // up
  { rest: 1.45, side: -1 },   // right
];
/** Which way a bow's limb faces while shooting, per row (the target's side). */
const SHOOT_SIDE = [1, -1, 1, 1];
/** Tip to tip, in screen pixels: a bow stands taller in the hand than a sword. */
const BOW_LEN = 23;
/** Pommel to tip, in screen pixels, on a ~50px chibi: about half its height. */
const HELD_LEN = 26;
/** The fist's radius in frame pixels, for painting it back over the grip. */
const FIST_R = 8;

/** The chibi row for this facing: the layout folds the eight onto four. */
function chibiRow(e) { return CHIBI_WALK.dirMap[((e.d ?? 0) % 8 + 8) % 8]; }

/** The grip for this facing (so the draw order can ask before the body goes on). */
export function chibiHand(e) { return CHIBI_GRIP[chibiRow(e)]; }

/** The frame of the sword swing a chibi is on, or -1 if it is not swinging a sword. */
function swingFrame(e, anim, elapsed, held) {
  if (anim !== 'slash' || !held || held.bow) return -1;
  return frameAt(CHIBI_WALK, 'slash', elapsed, false);
}

/**
 * The cut's crescent: a sweep of light from where the blade was on the frame
 * before to where it is now, thick at the tip and thinning toward the hand,
 * fading as the frame plays out. Coloured by the blade's refine or element
 * light when it has one.
 */
function drawSwingArc(ctx, from, to, len, t, rgb, sweep) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) > 2.6 && Math.sign(d) !== sweep) d += sweep * Math.PI * 2;
  if (Math.abs(d) < 0.15) return;
  const outer = len * 1.08, inner = len * 0.42, steps = 14;
  const col = rgb ? rgb.join(',') : '255,250,235';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.85 * (1 - t * 0.7);
  const g = ctx.createRadialGradient(0, 0, inner, 0, 0, outer);
  g.addColorStop(0, `rgba(${col},0)`);
  g.addColorStop(0.55, `rgba(${col},0.35)`);
  g.addColorStop(1, `rgba(${col},0.95)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  // the outer edge runs the whole sweep; the inner edge comes back toward the
  // outer one at the trailing end, so the crescent tapers behind the blade
  for (let i = 0; i <= steps; i++) {
    const a = from + (d * i) / steps;
    ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
  }
  for (let i = steps; i >= 0; i--) {
    const a = from + (d * i) / steps;
    const r = inner + (outer - inner) * (1 - i / steps) * 0.85;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** The fist's centre on screen, following the arm through the walk. */
function chibiFist(e, anim, elapsed) {
  const row = chibiRow(e);
  const col = anim === 'walk' ? frameAt(CHIBI_WALK, 'walk', elapsed)
    : anim === 'shoot' || anim === 'slash' ? CHIBI_WALK.anims[anim].start + frameAt(CHIBI_WALK, anim, elapsed, false)
      : CHIBI_WALK.anims.idle.start;
  const [fx, fy] = CHIBI_FISTS[row][col] ?? CHIBI_FISTS[row][0];
  const { w, h } = CHIBI_WALK.frame;
  const sc = (e.sprite?.scale ?? 1) * CHIBI_WALK.drawScale;
  return { x: e.x + (fx - w / 2) * sc, y: e.y + (fy - CHIBI_WALK.anchor * h) * sc, r: FIST_R * sc };
}

/**
 * Where to hold a picture from the sheets: every sword is drawn a little
 * differently (longer, shorter, not quite on the diagonal, not centred in its
 * cell), so a fixed spot in the cell puts the fist on the guard of one and
 * beside the pommel of the next. This reads the picture once: its long axis,
 * which end is the tip, where the guard is (the widest part of the lower
 * half), and the middle of the grip between guard and pommel. All in cell
 * units, so it is the same at any atlas size.
 */
const GRIPS = new Map();
const GRIP_FALLBACK = { x: 0.24, y: 0.76, angle: -Math.PI / 4, len: 1.2 };
function gripOf(img, file, cell, bow = false) {
  const key = `${file}#${cell}${bow ? ':bow' : ''}`;
  if (GRIPS.has(key)) return GRIPS.get(key);
  let g = GRIP_FALLBACK;
  try {
    const n = 96;
    const cv = document.createElement('canvas');
    cv.width = cv.height = n;
    const c = cv.getContext('2d', { willReadFrequently: true });
    const { sx, sy, size } = atlasRect(file, cell, img.naturalWidth);
    c.drawImage(img, sx, sy, size, size, 0, 0, n, n);
    const px = c.getImageData(0, 0, n, n).data;
    const xs = [], ys = [];
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) if (px[(y * n + x) * 4 + 3] > 128) { xs.push(x + 0.5); ys.push(y + 0.5); }
    }
    if (xs.length > 40) {
      const m = xs.length;
      let mx = 0, my = 0;
      for (let i = 0; i < m; i++) { mx += xs[i]; my += ys[i]; }
      mx /= m; my /= m;
      let cxx = 0, cyy = 0, cxy = 0;
      for (let i = 0; i < m; i++) {
        const dx = xs[i] - mx, dy = ys[i] - my;
        cxx += dx * dx; cyy += dy * dy; cxy += dx * dy;
      }
      // the long axis runs pommel to tip: the sheets draw the pommel at the
      // lower left and the tip at the upper right, so take the pixels furthest
      // each way along that diagonal (wide guards and wings would pull a
      // best-fit line off the blade)
      const diag = new Float32Array(m);
      for (let i = 0; i < m; i++) diag[i] = xs[i] - ys[i];
      const sorted = Float32Array.from(diag).sort();
      const pommelAt = sorted[Math.floor(m * 0.01)], tipAt = sorted[Math.ceil(m * 0.99) - 1];
      let px = 0, py = 0, pn = 0, tx = 0, ty = 0, tn = 0;
      for (let i = 0; i < m; i++) {
        if (diag[i] <= pommelAt) { px += xs[i]; py += ys[i]; pn++; }
        if (diag[i] >= tipAt) { tx += xs[i]; ty += ys[i]; tn++; }
      }
      let ax = tx / tn - px / pn, ay = ty / tn - py / pn;
      const al = Math.hypot(ax, ay) || 1;
      ax /= al; ay /= al;
      if (!(ax - ay > 0)) {                                   // a picture drawn some other way
        const th = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
        ax = Math.cos(th); ay = Math.sin(th);
        if (ax - ay < 0) { ax = -ax; ay = -ay; }
      }
      const t = new Float32Array(m), u = new Float32Array(m);
      let tmin = Infinity, tmax = -Infinity;
      for (let i = 0; i < m; i++) {
        const dx = xs[i] - mx, dy = ys[i] - my;
        t[i] = dx * ax + dy * ay; u[i] = -dx * ay + dy * ax;
        if (t[i] < tmin) tmin = t[i];
        if (t[i] > tmax) tmax = t[i];
      }
      const len = tmax - tmin;
      // how wide the picture is at each step along the axis
      const bins = Math.ceil(len) + 1;
      const lo = new Float32Array(bins).fill(Infinity), hi = new Float32Array(bins).fill(-Infinity);
      for (let i = 0; i < m; i++) {
        const b = Math.floor(t[i] - tmin);
        if (u[i] < lo[b]) lo[b] = u[i];
        if (u[i] > hi[b]) hi[b] = u[i];
      }
      let guard = Math.round(len * 0.2), widest = -1;
      for (let b = Math.round(len * 0.08); b <= Math.round(len * 0.42); b++) {
        const wdt = hi[b] - lo[b];
        if (wdt > widest + 0.5) { widest = wdt; guard = b; }
      }
      // a sword is held just under its guard; a bow at the middle of its limb
      const tg = bow ? len * 0.5 : Math.max(2, guard * 0.55);
      let su = 0, k = 0;
      for (let i = 0; i < m; i++) if (Math.abs(t[i] - tmin - tg) <= 1.5) { su += u[i]; k++; }
      const ug = k ? su / k : 0;
      const at = tmin + tg;
      g = { x: (mx + at * ax - ug * ay) / n, y: (my + at * ay + ug * ax) / n, angle: Math.atan2(ay, ax), len: len / n };
    }
  } catch { /* an unreadable picture keeps the old guess */ }
  GRIPS.set(key, g);
  return g;
}

/**
 * A weapon from the icon sheets, in a chibi's fist. The picture is turned so
 * its own grip sits in the fist and its blade leans up and outward, the same
 * length whatever the sheet drew; mirrored when the blade should lean left.
 * A swing raises it back and cuts down through the facing, then settles.
 */
function drawHeld(ctx, held, e, anim, elapsed, now) {
  const { img, file, cell, bow } = held;
  const hand = chibiHand(e);
  const pose = bow ? BOW_POSE[chibiRow(e)] : null;
  const fist = chibiFist(e, anim, elapsed);
  // shooting, the bow stands up in the reaching hand with its limb toward
  // the target: in profile that is ahead, the other way from walking
  const shooting = bow && anim === 'shoot';
  const side = shooting ? SHOOT_SIDE[chibiRow(e)] : pose?.side;
  const walking = anim === 'walk';
  // a sword swing has frames of its own: the blade's angle comes from them
  const sf = swingFrame(e, anim, elapsed, held);
  const swing = !bow && sf < 0 && (anim === 'slash' || anim === 'thrust');
  // the art's blades point up at 45 degrees; `angle` turns from there
  const rest = Math.PI / 4 - (shooting ? Math.PI / 2 : pose?.rest ?? hand.rest);
  let angle = rest + (walking ? Math.sin(now / 124) * 0.06 : 0);
  if (swing) {
    // wind up, cut, recover: from rest up and back over the shoulder, down
    // through the facing, then back to rest - whichever way this facing rests
    const k = Math.min(1, elapsed / 300);
    angle = k < 0.25 ? rest + (k / 0.25) * (-1.2 - rest)
      : k < 0.6 ? -1.2 + ((k - 0.25) / 0.35) * 2.3
        : 1.1 + ((k - 0.6) / 0.4) * (rest - 1.1);
  }
  const grip = gripOf(img, file, cell, bow);
  const len = (bow ? BOW_LEN : HELD_LEN) * (e.sprite?.scale ?? 1);
  const k = len / grip.len;                       // screen pixels per cell
  ctx.save();
  if (e.inv) ctx.globalAlpha = 0.35;
  // a 160px picture shrunk to a hand's width: the cheap filter turns it to mush
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(fist.x, fist.y);
  // refine and element light the blade itself: the tier's colour leaned
  // toward the element, breathing, brighter in the swing
  const tier = glowTier(e.wr);
  const el = ITEMS[e.eq?.weapon]?.element;
  const elemental = el && el !== 'neutral' ? elLook(el).main : null;
  const rgb = tier ? (elemental ? mixRgb(tier.color, elemental, 0.55) : tier.color) : elemental;
  if (sf >= 0) {
    const row = chibiRow(e);
    const deg = SWING.angle[row];
    const th = (deg[sf] * Math.PI) / 180;
    if (SWING.arc.includes(sf)) {
      const perFrame = 1000 / CHIBI_WALK.anims.slash.fps;
      const t = Math.min(1, (elapsed - sf * perFrame) / perFrame);
      drawSwingArc(ctx, (deg[sf - 1] * Math.PI) / 180, th, len, t, rgb, SWING.sweep[row]);
    }
    // the picture's own axis onto the blade's, mirrored along the blade when
    // it points left so its guard and edge stay the right way up
    ctx.rotate(th);
    if (Math.cos(th) < 0) ctx.scale(1, -1);
    ctx.rotate(-grip.angle);
  } else {
    ctx.scale(pose ? side : swing ? hand.cut : hand.side, 1);
  }
  if (swing && angle > -1.2 && elapsed < 190) {
    // the cut leaves a thin trail behind the tip
    const tip = len * 0.85, from = -Math.PI / 4 - 1.2, to = -Math.PI / 4 + angle;
    const g = ctx.createLinearGradient(Math.cos(from) * tip, Math.sin(from) * tip, Math.cos(to) * tip, Math.sin(to) * tip);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,250,230,0.75)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, tip, from, to);
    ctx.stroke();
  }
  // turn the picture's own axis onto the held angle, about its grip
  if (sf < 0) ctx.rotate(-Math.PI / 4 + angle - grip.angle);
  const { sx, sy, size } = atlasRect(file, cell, img.naturalWidth);
  const dx = -grip.x * k, dy = -grip.y * k;
  if (rgb) {
    const pulse = 0.7 + 0.3 * Math.sin(now / 480 + e.x * 0.05);
    const power = (tier ? 0.45 + tier.aura * 0.35 : 0.35) * pulse * (swing || sf >= 0 ? 1.4 : 1);
    ctx.save();
    ctx.shadowColor = `rgba(${rgb.join(',')},${Math.min(1, power).toFixed(2)})`;
    ctx.shadowBlur = 4 + (tier?.aura ?? 0.5) * 6;
    ctx.drawImage(img, sx, sy, size, size, dx, dy, k, k);
    ctx.restore();
  }
  ctx.drawImage(img, sx, sy, size, size, dx, dy, k, k);
  ctx.restore();
}

/** Draw the booth around a stall keeper: 'back' is all of it, 'front' just the counter. */
function drawBooth(ctx, e, art, part) {
  const img = art.stall;
  if (!img?.naturalWidth) return;
  const w = BOOTH_W, h = w * (img.naturalHeight / img.naturalWidth);
  // the keeper stands behind the counter, so it sits a little in front of their feet
  const x = e.x - w / 2, bottom = e.y + 17;
  if (part === 'back') {
    ctx.drawImage(img, x, bottom - h, w, h);
    const lamp = art.lantern;
    if (lamp?.naturalWidth) {
      const lh = 26, lw = lh * (lamp.naturalWidth / lamp.naturalHeight);
      const lx = x + w - 6, ly = bottom - h * 0.8;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(lx + lw / 2, ly + lh * 0.62, 1, lx + lw / 2, ly + lh * 0.62, 22);
      g.addColorStop(0, 'rgba(255,190,90,0.35)');
      g.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(lx - 16, ly - 10, lw + 32, lh + 24);
      ctx.restore();
      ctx.drawImage(lamp, lx, ly, lw, lh);
    }
    return;
  }
  const sy = img.naturalHeight * BOOTH_COUNTER;
  ctx.drawImage(img, 0, sy, img.naturalWidth, img.naturalHeight - sy, x, bottom - h * (1 - BOOTH_COUNTER), w, h * (1 - BOOTH_COUNTER));
}

// quest-giver marks and the plate NPC names sit on, from the quest sheet
const MARKS = typeof Image !== 'undefined'
  ? Object.fromEntries(['main', 'sub', 'daily', 'event', 'ready'].map((k) => [k, uiImage('mark_' + k)])) : {};
const NPC_PLATE = typeof Image !== 'undefined' ? uiImage('npc_plate') : null;

const DIGITS = [];
if (typeof Image !== 'undefined') {
  for (const name of ['h2_fx_miss', 'h2_fx_critical', 'h2_fx_levelup', ...ATLAS_FILES]) uiImage(name);
  for (let i = 0; i < 10; i++) DIGITS.push(uiImage('digit_' + i));
}
const digitsReady = () => DIGITS.length === 10 && DIGITS.every((d) => d.naturalWidth);

// Camera distance: three steps the player picks (ไกล / กลาง / ใกล้).
export const ZOOM_STEPS = [
  { key: 'xfar', label: 'ไกลมาก', note: 'เห็นทั้งย่าน เหมาะกับจอมือถือแนวนอน', mul: 0.46 },
  { key: 'far', label: 'ไกล', note: 'เห็นสนามรบกว้าง', mul: 0.62 },
  { key: 'mid', label: 'กลาง', note: 'ระยะมาตรฐาน', mul: 0.80 },
  { key: 'near', label: 'ใกล้', note: 'เห็นตัวละครชัดที่สุด', mul: 1.00 },
];
const ZOOM_KEY = 'emberfall-zoom';

/** Blend two [r,g,b] triples; `t` is how far toward `b` to go. */
function mixRgb(a, b, t) {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
}
const DEFAULT_ZOOM = ZOOM_STEPS.findIndex((z) => z.key === 'mid');

/**
 * Remembered by key, not by index: adding a step at the front must not
 * silently move everyone's camera. Older builds stored the index, so those
 * three values are translated once.
 */
function savedZoomStep() {
  try {
    const raw = localStorage.getItem(ZOOM_KEY);
    if (raw === null) return DEFAULT_ZOOM;
    const byKey = ZOOM_STEPS.findIndex((z) => z.key === raw);
    if (byKey >= 0) return byKey;
    const legacy = ['far', 'mid', 'near'][Number(raw)];
    const migrated = ZOOM_STEPS.findIndex((z) => z.key === legacy);
    if (migrated >= 0) return migrated;
  } catch { /* no storage */ }
  return DEFAULT_ZOOM;
}

// How far each soft prop leans, as a horizontal skew.
const SWAY = {
  grass: 0.10, flowers: 0.08, reeds: 0.09, mushroom: 0.04,
  bush: 0.035, tree: 0.022, deadtree: 0.018, banner: 0.05,
};

const rand = (seed) => {
  let a = seed >>> 0;
  return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.zoomStep = savedZoomStep();
    this.zoom = 2;
    this.camera = { x: 0, y: 0 };
    this.zone = null;
    this.grid = null;
    this.floaters = [];
    this.fx = [];
    this.mobFx = [];
    this.scorch = [];                // floor marks effects leave behind
    this.warnings = [];              // patches of floor about to become lethal
    this.particles = new Particles();
    this.weather = new Weather();
    this.lurch = new Map();          // entity id -> the blow it is still reeling from
    this.freezeUntil = 0;            // hit-stop: the animation clock holds here
    this.flashUntil = 0;
    this.steps = new Map();          // entity id -> when its next dust puff is due
    this.sparkAt = new Map();        // entity id -> when its weapon next throws a spark
    this.elemAt = new Map();         // entity id -> when its weapon next breathes its element
    this.shake = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
    onPref((key) => { if (key === 'quality') this.resize(); });
  }

  resize() {
    // battery saver draws at one pixel per CSS pixel: a quarter of the work on a phone
    const dpr = prefs.quality === 'saver' ? 1 : Math.min(2, devicePixelRatio || 1);
    // when the page itself is turned a quarter, width and height swap
    const rotated = document.body.classList.contains('forced-landscape');
    const w = rotated ? innerHeight : innerWidth;
    const h = rotated ? innerWidth : innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.dpr = dpr;
    this.applyZoom();
    this.ctx.imageSmoothingEnabled = false;
  }

  /** Base zoom follows the window; the player's step scales it. */
  applyZoom() {
    const wide = document.body.classList.contains('forced-landscape') ? innerHeight : innerWidth;
    const base = wide < 720 ? 2 : wide < 1400 ? 2.25 : 2.6;
    const step = ZOOM_STEPS[this.zoomStep] ?? ZOOM_STEPS[1];
    this.zoom = Math.round(base * step.mul * 100) / 100;
  }

  /** Pick a camera distance (0 = ไกล, 1 = กลาง, 2 = ใกล้). Returns the step. */
  setZoomStep(n) {
    this.zoomStep = Math.max(0, Math.min(ZOOM_STEPS.length - 1, n | 0));
    this.applyZoom();
    try { localStorage.setItem(ZOOM_KEY, ZOOM_STEPS[this.zoomStep].key); } catch { /* no storage */ }
    return ZOOM_STEPS[this.zoomStep];
  }

  /** Step in or out by one; wraps at the ends so one button can cycle. */
  nudgeZoom(dir, wrap = false) {
    const n = this.zoomStep + dir;
    if (wrap) return this.setZoomStep((n + ZOOM_STEPS.length) % ZOOM_STEPS.length);
    return this.setZoomStep(n);
  }

  setZone(zonePayload) {
    this.zone = zonePayload;
    this.tileCache = new Map();          // let the last map's sharp tiles go
    this.particles.setTheme(zonePayload.theme);
    this.steps.clear();
    this.grid = decodeGrid(zonePayload.rle, zonePayload.width * zonePayload.height);

    const painted = buildTerrain(zonePayload, this.grid);
    this.terrain = painted.canvas;
    this.water = painted.water;
    this.backdrop = painted.backdrop ?? null;

    const scenery = generateProps(
      { width: zonePayload.width, height: zonePayload.height, seed: zonePayload.seed ?? 1,
        theme: zonePayload.theme ?? 'grass', kind: zonePayload.kind,
        structures: zonePayload.structures ?? [], decor: zonePayload.decor ?? [],
        paint: zonePayload.laidOut ? [] : undefined },
      this.grid
    );
    this.props = scenery.concat(painted.overlays).sort((a, b) => a.y - b.y);
    this._miniCache = null;
    this.warnings.length = 0;
    this.scorch.length = 0;
    this.weather.setTheme(this.zone.theme ?? 'grass');
  }

  /**
   * A number thrown off a hit. It is launched rather than slid: an initial
   * upward kick plus gravity, with a sideways drift that alternates so a
   * stream of hits fans out instead of stacking into an unreadable pile.
   */
  floater(text, x, y, color = '#fff', size = 12, opts = {}) {
    // numbers can be switched off; words (LEVEL UP, MISS, ...) always show
    if (!prefs.dmg && /^[+-]?[\d,]+!?$/.test(String(text))) return;
    this._fanSide = -(this._fanSide ?? 1);
    this.floaters.push({
      text, x, y, color, size, t: performance.now(),
      life: opts.crit ? 1100 : 850,
      vx: (opts.vx ?? this._fanSide * (10 + Math.random() * 14)),
      vy: opts.crit ? -92 : -64,
      g: 150,
      pop: opts.crit ? 1.55 : 1.2,        // how much bigger it starts
      img: opts.img ? uiImage(opts.img) : null,   // a painted word instead of text
      digits: !!opts.digits && /^\d+$/.test(text), // the sheet's gold numerals
    });
  }

  /**
   * Something was hit. The body lurches away from the blow, an impact burst
   * goes off in the attacker's element, and a critical stops the world for a
   * few frames - the oldest trick there is for making a hit land.
   */
  impact(id, { x, y, from, el = 'neutral', crit = false, big = false } = {}) {
    let dx = 0, dy = -1;
    if (from) {
      dx = x - from.x; dy = y - from.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy /= d;
    }
    this.lurch.set(id, { t: performance.now(), dx, dy, power: crit ? 7 : big ? 5 : 3 });
    this.addFx({ fx: 'impact', el, x, y: y - 20, r: crit ? 34 : 22, life: crit ? 300 : 220 });
    if (crit) {
      this.freezeUntil = performance.now() + 60;
      this.flashUntil = performance.now() + 90;
      this.flashEl = el;
    }
  }

  /**
   * A skill went off. The effect gets a stable seed (so its jitter does not
   * crawl), its own lifetime, a burst of debris and, if it touched the floor,
   * a mark that outlives it.
   */
  addFx(fx) {
    // an effect painted on a monster's own sheet: played from its strip
    if (fx.fx === 'mobart') { this.mobFx.push({ ...fx, t: performance.now() }); return; }
    const f = { ...fx, t: performance.now(), seed: Math.random() * 6.28, life: fx.life ?? lifeOf(fx) };
    this.fx.push(f);
    const mark = scorchOf(f);
    if (mark) this.scorch.push({ ...mark, t: f.t });
    const d = debrisOf(f);
    const at = f.tx != null ? { x: (f.x + f.tx) / 2, y: (f.y + f.ty) / 2 } : f;
    this.particles.spark(at.x, at.y - 10, d);
  }

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
    // hit-stop. Only the *animation* clock is held; positions keep
    // interpolating, so the world never desyncs from the server for it.
    if (now < this.freezeUntil) now = this._frozenAt ?? (this._frozenAt = now);
    else this._frozenAt = null;
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
    if (!prefs.shake) this.shake = 0;
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
      // by extent, not anchor: a building whose foot is off-screen can still
      // fill half of it
      ? this.props.filter((p) => {
        const hw = (p.w ?? 0) / 2;
        return p.x + hw > view.x0 && p.x - hw < view.x1
          && p.y > view.y0 && p.y - (p.h ?? 0) - 80 < view.y1;
      })
      : [];

    this.drawTerrain(ctx, halfW, halfH, now);
    this.drawWarps(ctx, now);
    drawScorch(ctx, this.scorch, now);
    this.drawWarnings(ctx, now);
    this.drawGroundFx(ctx, state, now);
    this.drawProps(ctx, visibleProps, false, now);
    this.drawGroundItems(ctx, state, now);
    this.drawEntities(ctx, state, now, visibleProps);
    this.drawFx(ctx, now);
    this.drawMobFx(ctx, state, now);
    this.particles.update(now, view);
    this.particles.draw(ctx, now);
    this.drawAmbience(ctx, view, visibleProps, state, now);
    this.particles.drawGlow(ctx);
    ctx.restore();

    if (prefs.quality !== 'saver') {
      this.weather.update(now, this.canvas.width, this.canvas.height);
      this.weather.draw(ctx, now, this.canvas.width, this.canvas.height);
    }
    this.drawVignette(ctx);
    this.drawCritFlash(ctx, now);
    this.drawFloaters(ctx, s);
  }

  drawTerrain(ctx, halfW, halfH, now) {
    if (!this.terrain) return;
    const x0 = Math.max(0, Math.floor(this.camera.x - halfW) - TILE);
    const y0 = Math.max(0, Math.floor(this.camera.y - halfH) - TILE);
    const x1 = Math.min(this.terrain.width, Math.ceil(this.camera.x + halfW) + TILE);
    const y1 = Math.min(this.terrain.height, Math.ceil(this.camera.y + halfH) + TILE);
    if (x1 <= x0 || y1 <= y0) return;
    const art = this.backdrop;
    if (art?.complete && art.naturalWidth) {
      // Straight from the painting in one step (going via the world-sized
      // canvas resampled it twice and smeared it on phones). The painting is
      // stored upscaled, so a high-quality filter keeps it crisp.
      const k = art.naturalWidth / this.terrain.width;
      ctx.save();
      // pixel art keeps its pixels: a filter would soften every edge the
      // painter drew (the tiles are then the same pixels, just blown up)
      ctx.imageSmoothingEnabled = !this.zone?.pixelArt;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(art, x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k, x0, y0, x1 - x0, y1 - y0);
      this.drawBackdropTiles(ctx, x0, y0, x1, y1);
      ctx.restore();
    } else {
      ctx.drawImage(this.terrain, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    }
    this.drawWaterShimmer(ctx, x0, y0, x1, y1, now);
  }

  /** Water is painted flat; the movement is added live so it never looks dead. */
  drawWaterShimmer(ctx, x0, y0, x1, y1, now) {
    if (!this.water?.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [tx, ty] of this.water) {
      const px = tx * TILE, py = ty * TILE;
      if (px + TILE < x0 || px > x1 || py + TILE < y0 || py > y1) continue;
      const t = now / 900 + tx * 0.7 + ty * 0.4;
      const a = 0.05 + Math.sin(t) * 0.035;
      if (a <= 0) continue;
      ctx.fillStyle = `rgba(190,225,255,${a})`;
      ctx.beginPath();
      ctx.ellipse(px + TILE / 2 + Math.sin(t * 1.3) * 5, py + TILE / 2 + Math.cos(t) * 3,
        TILE * 0.42, TILE * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Which gate a warp is drawn as, by where it leads: a town gets the
   * bannered stone arch, open country the vine arch, a crypt the skull gate,
   * a boss lair the burning one, the ice caves the crystal ring, the
   * Reliquary the void, and the duelling ground the winged gold.
   */
  warpStyle(to) {
    const m = MAPS[to];
    if (!m) return 'city';
    if (m.pvp || to === 'ashen_lists') return 'holy';
    if (m.kind === 'town') return 'city';
    if (m.kind === 'boss') return 'boss';
    if (m.kind === 'dungeon') return 'void';
    if (m.theme === 'ice') return 'ice';
    if (m.kind === 'cave') return 'dungeon';
    return 'nature';
  }

  drawWarps(ctx, now) {
    this.warpArt ??= new Map();
    for (const w of this.zone.warps ?? []) {
      const cx = (w.x + w.w / 2) * TILE, cy = (w.y + w.h / 2) * TILE;
      const foot = (w.y + w.h) * TILE - 4;
      const style = this.warpStyle(w.to);
      let art = this.warpArt.get(style);
      if (!art) {
        art = new Image();
        art.src = `assets/warp/${style}.webp`;
        this.warpArt.set(style, art);
      }
      let top = foot - 64;
      if (art.complete && art.naturalWidth) {
        // eight frames side by side; a gate is ~2 tiles wide whatever the pad
        const fw = art.naturalWidth / 8, fh = art.naturalHeight;
        const frame = Math.floor(now / 110) % 8;
        const dw = 72, dh = dw * (fh / fw);
        top = foot - dh;
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(art, frame * fw, 0, fw, fh, cx - dw / 2, top, dw, dh);
        ctx.restore();
      }

      ctx.save();
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      const label = `\u27A4 ${w.label ?? w.to}`;
      ctx.strokeText(label, cx, top - 4);
      ctx.fillStyle = '#d8f2ff';
      ctx.fillText(label, cx, top - 4);
      ctx.restore();
    }
  }

  /** Lingering zones a skill left on the floor - poison clouds, storm runes. */
  drawGroundFx(ctx, state, now) {
    for (const f of state.fx ?? []) {
      const el = f.el ?? 'neutral';
      const L = elLook(el);
      const left = (f.until - Date.now()) / 1000;
      const dying = left < 1.2 ? Math.max(0, left / 1.2) : 1;     // warns before it lapses
      const beat = 0.62 + Math.sin(now / 340 + f.x * 0.03) * 0.18;
      ctx.save();
      ctx.globalAlpha = dying;

      // the pool of colour
      const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, f.r);
      g.addColorStop(0, elRgba(el, 'main', 0.30 * beat));
      g.addColorStop(0.72, elRgba(el, 'deep', 0.20 * beat));
      g.addColorStop(1, elRgba(el, 'deep', 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.62, 0, 0, Math.PI * 2); ctx.fill();

      // its edge, turning slowly so the zone never looks like a decal
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = elRgba(el, 'main', 0.55 * beat);
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(now / 2600 * (1 + L.spin));
      ctx.strokeStyle = elRgba(el, 'core', 0.4 * beat);
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * f.r * 0.62, Math.sin(a) * f.r * 0.38);
        ctx.lineTo(Math.cos(a) * f.r * 0.96, Math.sin(a) * f.r * 0.59);
        ctx.stroke();
      }
      ctx.restore();
      ctx.restore();

      // the zone breathes out its own element
      if (Math.random() < 0.10 * dying) {
        const a = Math.random() * Math.PI * 2, rr = Math.random() * f.r;
        this.particles.spark(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr * 0.62,
          { color: L.main.join(','), n: 1, power: 0.35 });
      }
    }
  }

  /**
   * The sharp version of a painted map: tiles of the picture at 4x, each
   * loaded the first time it comes into view (the whole thing decoded at once
   * is ~100MB, too much for a phone). Until a tile arrives the low-res picture
   * drawn underneath shows through, so nothing ever flashes empty.
   */
  drawBackdropTiles(ctx, x0, y0, x1, y1) {
    const bt = this.zone?.backdropTiles;
    if (!bt) return;
    this.tileCache ??= new Map();
    const k = bt.width / this.terrain.width;          // picture px per world px
    // a tile is `size` square unless the map gives it a width and height of its own
    const tw = bt.tileW ?? bt.size, th = bt.tileH ?? bt.size;
    const worldW = tw / k, worldH = th / k;
    const tx0 = Math.max(0, Math.floor(x0 / worldW)), tx1 = Math.min(bt.cols - 1, Math.floor((x1 - 1) / worldW));
    const ty0 = Math.max(0, Math.floor(y0 / worldH)), ty1 = Math.min(bt.rows - 1, Math.floor((y1 - 1) / worldH));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const url = `${bt.dir}/${tx}_${ty}.webp`;
        let img = this.tileCache.get(url);
        if (!img) {
          img = new Image();
          img.src = url;
          this.tileCache.set(url, img);
        }
        if (!img.complete || !img.naturalWidth) continue;
        // the bleed is sampled by the filter at the edges but not drawn, so
        // neighbouring tiles meet without a seam
        ctx.drawImage(img, bt.bleed, bt.bleed, tw, th,
          tx * worldW, ty * worldH, worldW, worldH);
      }
    }
  }

  /** A building drawn as art rather than code: stood on its foot, at its size. */
  drawPictureProp(ctx, p) {
    this.pictures ??= new Map();
    let pic = this.pictures.get(p.img);
    if (!pic) {
      pic = new Image();
      pic.src = p.img;
      this.pictures.set(p.img, pic);
    }
    if (!pic.complete || !pic.naturalWidth) return;
    // building art is stored upscaled: filter it, don't block it up
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(pic, Math.round(p.x - p.w / 2), Math.round(p.y - p.h), p.w, p.h);
    ctx.imageSmoothingEnabled = smooth;
  }

  drawGroundItems(ctx, state, now) {
    this.loot ??= new Map();          // uid -> when it started falling, what it is, where
    this.pickups ??= [];              // swirls where loot was taken
    const seen = new Set();
    for (const g of state.ground ?? []) {
      seen.add(g.uid);
      const kind = lootKind(g);
      let l = this.loot.get(g.uid);
      if (!l) {
        l = { start: g.age != null ? now - g.age : -Infinity, kind };
        this.loot.set(g.uid, l);
      }
      Object.assign(l, { x: g.x, y: g.y, mine: g.mine });
      if (kind && DROPS?.naturalWidth) {
        this.drawLoot(ctx, g, kind, now - l.start);
        continue;
      }
      const bob = Math.sin(now / 300 + g.x) * 2;
      const isAurum = g.id === '__aurum';
      const def = ITEMS[g.id];
      ctx.save();
      ctx.translate(g.x, g.y + bob);
      ctx.globalAlpha = g.mine ? 1 : 0.45;
      ctx.fillStyle = isAurum ? '#f2c14e' : (RARITY_COLORS[def?.rarity] ?? '#cfd8dc');
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      // an item with painted art lies there as itself: 'potions#12' is a cell of an atlas
      const [file, cell] = (def?.art ?? '').split('#');
      const atlas = cell != null && file ? uiImage(atlasFile(file)) : null;
      if (isAurum) { ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      else if (atlas?.naturalWidth) {
        const { sx, sy, size } = atlasRect(file, cell, atlas.naturalWidth);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
        ctx.drawImage(atlas, sx, sy, size, size, -9, -12, 18, 18);
      } else { ctx.fillRect(-4, -4, 8, 8); ctx.strokeRect(-4, -4, 8, 8); }
      ctx.restore();
    }
    // Loot that vanished next to us was picked up (by us or the one beside
    // us): it goes up in a swirl. Loot that left the view far away just goes.
    const me = state.me;
    for (const [uid, l] of this.loot) {
      if (seen.has(uid)) continue;
      this.loot.delete(uid);
      if (l.kind && me && Math.hypot(l.x - me.x, l.y - me.y) < 72) {
        this.pickups.push({ x: l.x, y: l.y, swirl: PICKUP_SWIRL[l.kind] ?? 'water', start: now });
      }
    }
    this.drawPickups(ctx, now);
  }

  /** One cell of the drop sheet, standing on (x, y), `size` world px square. */
  drawDropCell(ctx, cell, x, y, size) {
    const { cell: c, cols, floor } = DROP_ART;
    const k = size / c;
    ctx.drawImage(DROPS, (cell % cols) * c, Math.floor(cell / cols) * c, c, c,
      Math.round(x - size / 2), Math.round(y - size + floor * k), size, size);
  }

  /** Loot from the drop sheet: it falls in first, then lies there by amount. */
  drawLoot(ctx, g, kind, age) {
    const fall = DROP_ART.cells['fall_' + kind];
    const f = Math.floor(age / LOOT_FRAME_MS);
    ctx.save();
    ctx.globalAlpha = g.mine ? 1 : 0.45;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (fall && f >= 0 && f < fall.length) {
      this.drawDropCell(ctx, fall[f], g.x, g.y + 6, LOOT_SIZE);
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1;
      // a sheet may draw fewer than four piles: the biggest it has stands in
      let t = lootTier(kind, g.qty), cell;
      while ((cell = DROP_ART.cells.ground[`${kind}_${t}`]) == null && t > 1) t = kind === 'gold' ? t / 10 : t - 1;
      this.drawDropCell(ctx, cell, g.x, g.y + 6, LOOT_SIZE);
    }
    ctx.restore();
  }

  drawPickups(ctx, now) {
    if (!this.pickups.length || !DROPS?.naturalWidth) return;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    this.pickups = this.pickups.filter((p) => {
      const frames = DROP_ART.cells.pickup[p.swirl];
      // every swirl lasts as long, however many frames its sheet drew it in
      const f = Math.floor((now - p.start) / (PICKUP_MS / frames.length));
      if (f >= frames.length) return false;
      this.drawDropCell(ctx, frames[f], p.x, p.y + 8, LOOT_SIZE * 1.3);
      return true;
    });
    ctx.restore();
  }

  drawProps(ctx, props, tall, now) {
    for (const p of props) {
      if (!!p.tall !== tall) continue;
      this.drawProp(ctx, p, now);
    }
  }

  drawProp(ctx, p, now) {
    if (p.img) return this.drawPictureProp(ctx, p);
    const img = propSprite(p.w ? p : p.kind);
    const w = img.width * (p.w ? 1 : p.scale), h = img.height * (p.w ? 1 : p.scale);
    ctx.save();
    if (p.flip) { ctx.translate(p.x, 0); ctx.scale(-1, 1); ctx.translate(-p.x, 0); }
    // soft growth leans in the wind, pivoting on its base
    const sway = SWAY[p.kind];
    if (sway) {
      const a = Math.sin(now / 900 + p.x * 0.05 + p.y * 0.03) * sway;
      ctx.translate(p.x, p.y + 6);
      ctx.transform(1, 0, a, 1, 0, 0);
      ctx.translate(-p.x, -(p.y + 6));
    }
    ctx.drawImage(img, Math.round(p.x - w / 2), Math.round(p.y - h + 6), w, h);
    ctx.restore();
  }

  drawEntities(ctx, state, now, props = []) {
    // tall scenery shares the painter's-order list so characters walk behind it
    const ents = [...(state.ents ?? []), ...props.filter((p) => p.tall).map((p) => ({ _prop: p, y: p.y })),
      ...(this.corpses ?? []).map((c) => ({ _corpse: c, y: c.y - 1 }))]
      .sort((a, b) => a.y - b.y);
    for (const e of ents) {
      if (e._prop) { this.drawProp(ctx, e._prop, now); continue; }
      if (e._corpse) {
        const c = e._corpse, age = performance.now() - c.t;
        if (age < c.ms + 600) {
          // a flyer comes down to the ground as it dies
          const lift = (c.sprite.fly ?? 0) * Math.max(0, 1 - age / c.ms);
          drawMobFrames(ctx, c.sprite, { x: c.x, y: c.y - lift, anim: 'death', elapsed: age, flip: c.flip,
            alpha: age < c.ms ? 1 : 1 - (age - c.ms) / 600 });
        }
        continue;
      }
      if (e._gone) continue;
      const anim = e.a ?? 'idle';
      // a weapon faster than its animation plays the swing quicker, rather
      // than looping half of it
      let elapsed = (now - (e._animStart ?? now)) * (e.as ?? 1);
      const hurt = e._hurtUntil && e._hurtUntil > now ? (e._hurtUntil - now) / 200 : 0;

      // reeling from a blow: a short shove away from whoever landed it
      const lu = this.lurch.get(e.id);
      let ox = 0, oy = 0;
      if (lu) {
        const lk = (now - lu.t) / 170;
        if (lk >= 1) this.lurch.delete(e.id);
        else {
          const push = Math.sin((1 - lk) * Math.PI) * lu.power;
          ox = lu.dx * push; oy = lu.dy * push;
        }
      }
      // the chibi sheet has only a walk, so a swing is a hop toward the target
      const chibi = e.k === 'p' && e.look?.style === 'chibi';
      // a chibi's walk is paced by the ground it covers, not the clock, so
      // its feet keep up with it at any speed instead of skating
      if (chibi) {
        const moved = e._lx == null ? 0 : Math.hypot(e.x - e._lx, e.y - e._ly);
        if (moved < 48) e._stride = (e._stride ?? 0) + moved;   // a warp is not a step
        e._lx = e.x; e._ly = e.y;
        if (anim === 'walk') elapsed = (e._stride / (CHIBI_STRIDE * (e.sprite?.scale ?? 1))) * CHIBI_CYCLE_MS;
      }
      // (a bow shot and a sword swing have frames of their own)
      if (chibi && (anim === 'thrust' || anim === 'spellcast')) {
        const k = Math.min(1, elapsed / 260);
        const [vx, vy] = vecOf(e.d ?? 0);
        const reach = Math.sin(k * Math.PI) * (anim === 'spellcast' ? 2 : 6);
        ox += vx * reach; oy += vy * reach - Math.sin(k * Math.PI) * 3;
      }
      if (ox || oy) { ctx.save(); ctx.translate(ox, oy); }

      // shadow: sized with the sprite, softened at the rim
      const sc = e.sprite?.scale ?? 1;
      const rx = (e.k === 'n' ? 9 : 10) * sc;
      ctx.save();
      ctx.globalAlpha = e.inv ? 0.10 : 0.30;
      const sg = ctx.createRadialGradient(e.x, e.y + 2, 0, e.x, e.y + 2, rx);
      sg.addColorStop(0, '#000');
      sg.addColorStop(0.65, 'rgba(0,0,0,0.75)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.save();
      ctx.translate(e.x, e.y + 2); ctx.scale(1, 0.4); ctx.translate(-e.x, -(e.y + 2));
      ctx.beginPath(); ctx.arc(e.x, e.y + 2, rx, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.restore();

      if (anim === 'walk') this.footstep(e, now);

      if (e.k === 'm' && e.sprite?.kind === 'frames') {
        const d = e.d ?? 0;
        e._faceLeft = d >= 1 && d <= 3 ? true : d >= 5 && d <= 7 ? false : e._faceLeft;
        // a blow that lands between swings plays the flinch over whatever it was doing
        const hitMs = now - (e._hitAt ?? -1e9);
        const flinch = hitMs < mobAnimMs(e.sprite.key, 'hit') && !ONE_SHOT_MOB.has(anim);
        const { dx, dy } = mobOffset(e, anim, elapsed, now);
        drawMobFrames(ctx, e.sprite, {
          x: e.x + dx, y: e.y + dy, flip: !e._faceLeft, flash: hurt,
          anim: flinch ? 'hit' : anim, elapsed: flinch ? hitMs : elapsed,
          alpha: e.inv ? 0.35 : 1,
        });
      } else if (e.k === 'm' && e.sprite?.kind === 'blob') {
        drawBlob(ctx, e.sprite, { x: e.x, y: e.y, t: now + (e.id.charCodeAt(1) * 97), hurt });
      } else {
        const layers = e.k === 'p' ? playerLayers(e.look, e.eq ?? {})
          : e.k === 'n' ? npcLayers(e.look)
          : monsterLayers(e.sprite);
        if (layers?.pic) {
          // a walking picture hops a little with each step and turns to face
          // left or right (it has no side or back view)
          const walking = anim === 'walk';
          const d = e.d ?? 0;
          if (walking) e._faceLeft = d >= 1 && d <= 3 ? true : d >= 5 && d <= 7 ? false : e._faceLeft;
          drawPicture(ctx, layers.pic, {
            x: e.x, y: e.y, flash: hurt, flip: !!e._faceLeft,
            // two steps a second, each townsperson on their own beat
            step: walking ? now / 160 + (e.id.charCodeAt(e.id.length - 1) ?? 0) : null,
          });
        } else if (layers) {
          const scale = e.sprite?.scale ?? 1;
          // wings sit behind the body, and beat faster while you run
          const wing = ITEMS[e.eq?.wings]?.wing;
          if (wing) {
            drawWings(ctx, wing.style, {
              x: e.x, y: e.y, dir: toDir4(e.d ?? 0), t: now + (e.id.charCodeAt(1) ?? 0) * 37,
              scale: scale * (wing.scale ?? 1), moving: anim === 'walk',
            });
          }
          // The four slots drawn in code rather than from a sheet. The cloak
          // hangs behind the body, so it goes on before it; the scarf, the
          // glasses and the mask go over the top further down.
          // (fitted to the LPC body, so a chibi goes without for now)
          const worn = chibi ? apparelOf({}, ITEMS) : apparelOf(e.eq, ITEMS);
          const dress = {
            x: e.x, y: e.y, dir: toDir4(e.d ?? 0), scale,
            t: now + (e.id.charCodeAt(1) ?? 0) * 37, moving: anim === 'walk',
          };
          // a player keeping a stall stands inside a market booth: the back
          // of it goes on first, its counter after, so they lean over it
          const booth = e.k === 'p' && (state.stalls ?? []).some((sg) => sg.id === e.id) ? STALL_ART : null;
          if (booth) drawBooth(ctx, e, booth, 'back');
          drawBehind(ctx, worn, dress);
          // the chibi body has no weapon layer: its weapon is the item's own art, held
          // standing, a chibi breathes: a slow rise and fall from the feet up
          const breathe = chibi && anim === 'idle' && !e.inv;
          if (breathe) {
            const b = 1 + Math.sin(now / 640 + (e.id.charCodeAt(1) ?? 0)) * 0.012;
            ctx.save();
            ctx.translate(e.x, e.y); ctx.scale(1 / Math.sqrt(b), b); ctx.translate(-e.x, -e.y);
          }
          const held = chibi ? heldArt(e) : null;
          // a bow always goes on after the body, gripped by the fist painted
          // over it; in a sword swing each frame says which side of the body
          // the blade is on
          const sf = swingFrame(e, anim, elapsed, held);
          const over = held && (sf >= 0 ? !SWING.behind[chibiRow(e)].includes(sf) : held.bow || chibiHand(e).over);
          if (held && !over) drawHeld(ctx, held, e, anim, elapsed, now);
          const body = {
            x: e.x, y: e.y, anim, dir: e.d ?? 0, elapsed,
            scale,
            alpha: e.inv ? 0.35 : 1,
            tint: e.sprite?.tint ?? null,
            flash: hurt,
          };
          drawCharacter(ctx, layers, body);
          if (over) {
            // across the body the sword goes on top, and the fist back over its grip
            drawHeld(ctx, held, e, anim, elapsed, now);
            const f = chibiFist(e, anim, elapsed);
            ctx.save();
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
            ctx.clip();
            drawCharacter(ctx, layers, body);
            ctx.restore();
          }
          if (breathe) ctx.restore();
          drawInFront(ctx, worn, dress);
          if (booth) drawBooth(ctx, e, booth, 'front');
          if (e.k === 'p') this.drawWeaponGlow(ctx, e, layers, anim, elapsed, scale, now);
        }
      }

      if (ox || oy) ctx.restore();
      this.drawNameplate(ctx, e, state, now);
    }
  }

  /**
   * Refined weapons burn: a blurred bloom pass, a crisp one on top, and
   * sparks that come off the blade at the levels people actually chase.
   */
  /**
   * What a weapon looks like in someone's hands. Two things stack here and
   * they answer different questions: the refine tier says how much was
   * *spent* on it (brightness, ground light, spark rate), the element says
   * what it *is* (hue, and how the flourish behaves). A +0 flame sword still
   * burns; a +12 plain sword still blazes white.
   */
  drawWeaponGlow(ctx, e, layers, anim, elapsed, scale, now) {
    if (e.inv) return;
    // a chibi holds its weapon as a picture, which carries its own glow (drawHeld);
    // lighting the body's layers here would light the whole body
    if (e.look?.style === 'chibi') return;
    const tier = glowTier(e.wr);
    const el = ITEMS[e.eq?.weapon]?.element;
    const elemental = el && el !== 'neutral' ? el : null;
    if (!tier && !elemental) return;

    const swinging0 = anim === 'slash' || anim === 'thrust' || anim === 'shoot';
    // an unrefined elemental weapon still gets a low, steady burn
    if (elemental) this.drawWeaponElement(ctx, e, layers, el, { anim, elapsed, scale, now, swinging: swinging0, tier });
    if (!tier) return;

    // the tier's own colour, leaned toward the element when there is one
    const base = elemental ? mixRgb(tier.color, elLook(el).main, 0.55) : tier.color;
    const colour = `rgb(${base.join(',')})`;
    // breathing, plus a kick while swinging
    const swinging = anim === 'slash' || anim === 'thrust' || anim === 'shoot';
    const pulse = 0.72 + 0.28 * Math.sin(now / (520 / tier.pulse) + e.x * 0.05);
    const power = tier.aura * pulse * (swinging ? 1.45 : 1);

    const opts = { x: e.x, y: e.y, anim, dir: e.d ?? 0, elapsed, scale, color: colour };

    // A tier with art plays it over the wielder. The code-drawn aura below
    // still runs underneath at a lower weight, so a tier whose sheet has not
    // been drawn yet does not simply go dark - art is added one tier at a
    // time, and every level in between has to keep looking like something.
    const art = tier.sheet
      ? drawOverlaySheet(ctx, tier.sheet, { ...opts, alpha: Math.min(1, power * 1.1), loopMs: tier.loopMs ?? 0 })
      : false;
    const weight = art ? 0.35 : 1;

    // wide bloom, tight bloom, then the blade itself lit up
    drawRefineGlow(ctx, layers, { ...opts, alpha: power * 0.75 * weight, blur: 7 + tier.aura * 7 });
    drawRefineGlow(ctx, layers, { ...opts, alpha: power * 0.70 * weight, blur: 2.5 });
    drawRefineGlow(ctx, layers, { ...opts, alpha: Math.min(0.95, power * 0.9) * weight, blur: 0 });

    // light cast on the ground around the wielder, once the tier is drawing
    // the `circle` primitive - which tier does is the table's call, not a
    // threshold guessed at here
    if (tier.light && hasOverlay(tier, 'circle')) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const r = tier.light * (0.85 + pulse * 0.25);
      const g = ctx.createRadialGradient(e.x, e.y - 6, 1, e.x, e.y - 6, r);
      g.addColorStop(0, `rgba(${base.join(',')},${0.26 * power})`);
      g.addColorStop(0.45, `rgba(${base.join(',')},${0.10 * power})`);
      g.addColorStop(1, `rgba(${base.join(',')},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(e.x, e.y - 6, r, 0, Math.PI * 2); ctx.fill();
      // a ring of light on the floor, so the tier reads even in daylight
      ctx.globalAlpha = 0.5 * power;
      ctx.strokeStyle = `rgba(${base.join(',')},0.55)`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + 2, 14 + tier.trail * 8, (14 + tier.trail * 8) * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // embers drifting off the blade
    if (tier.sparks && hasOverlay(tier, 'spark')) {
      const due = this.sparkAt.get(e.id) ?? 0;
      const gap = (swinging ? 110 : 420) / tier.sparks;
      if (now >= due) {
        this.sparkAt.set(e.id, now + gap * (0.6 + Math.random() * 0.8));
        const side = vecOf(e.d ?? 0);
        this.particles.spark(
          e.x + side[0] * 12 + (Math.random() - 0.5) * 10,
          e.y - 26 + side[1] * 6 + (Math.random() - 0.5) * 10,
          { color: base.join(','), n: swinging ? 3 : 1, power: 0.5 + tier.trail },
        );
      }
    }
  }

  /**
   * The elemental half of a weapon's look: a coloured burn along the blade,
   * and a flourish that behaves like the element rather than merely being
   * tinted like it. Fire rises and accelerates, frost sinks and lingers,
   * storm snaps out and dies, shade pours downward and fades.
   */
  drawWeaponElement(ctx, e, layers, el, { anim, elapsed, scale, now, swinging, tier }) {
    const L = elLook(el);
    // a plain elemental weapon burns low; a refined one burns with it
    const strength = 0.5 + (tier?.aura ?? 0) * 0.5;
    const pulse = 0.7 + 0.3 * Math.sin(now / 340 + e.x * 0.05);
    const power = strength * pulse * (swinging ? 1.5 : 1);
    const opts = { x: e.x, y: e.y, anim, dir: e.d ?? 0, elapsed, scale, color: `rgb(${L.main.join(',')})` };
    drawRefineGlow(ctx, layers, { ...opts, alpha: power * 0.5, blur: 6 });
    drawRefineGlow(ctx, layers, { ...opts, alpha: power * 0.55, blur: 1.5 });

    // the flourish, metered so a crowd of elemental weapons stays cheap
    const due = this.elemAt.get(e.id) ?? 0;
    if (now < due) return;
    const gap = (swinging ? 55 : 130) / (0.6 + strength);
    this.elemAt.set(e.id, now + gap * (0.6 + Math.random() * 0.8));

    const side = vecOf(e.d ?? 0);
    const bx = e.x + side[0] * 12 + (Math.random() - 0.5) * 12;
    const by = e.y - 26 + side[1] * 6 + (Math.random() - 0.5) * 12;
    const main = L.main.join(','), core = L.core.join(',');

    if (el === 'fire') {
      // embers climb and speed up as they go
      this.particles.mote(bx, by, { color: Math.random() < 0.4 ? core : main, g: -90, vy: -18, r: 1.2 + Math.random() * 1.4, life: 0.7, alpha: 0.9 });
    } else if (el === 'ice') {
      // vapour slides off the blade and settles toward the floor
      this.particles.mote(bx, by, { color: Math.random() < 0.5 ? core : main, g: 26, vx: (Math.random() - 0.5) * 12, vy: 8, r: 1.8 + Math.random() * 2.0, life: 1.1, alpha: 0.75 });
    } else if (el === 'lightning') {
      // a snap of sparks, gone almost at once
      this.particles.spark(bx, by, { color: Math.random() < 0.5 ? core : main, n: 2, power: 0.8 });
    } else if (el === 'dark') {
      // smoke pouring down off the edge
      this.particles.mote(bx, by, { color: main, g: 18, vx: (Math.random() - 0.5) * 8, vy: 14, r: 2.2 + Math.random() * 2.4, life: 0.9, alpha: 0.6 });
    } else if (el === 'holy') {
      // motes that hang in the air rather than falling
      this.particles.mote(bx, by, { color: Math.random() < 0.5 ? core : main, g: -14, vy: -10, r: 1.1 + Math.random(), life: 1.0, alpha: 0.8 });
    } else {
      // verdant: seeds drifting sideways on the wind
      this.particles.mote(bx, by, { color: main, g: 30, vx: (Math.random() - 0.5) * 26, vy: -6, r: 1.3 + Math.random(), life: 0.9, alpha: 0.7 });
    }
  }

  /** One puff every couple of strides, per entity. */
  footstep(e, now) {
    const due = this.steps.get(e.id) ?? 0;
    if (now < due) return;
    this.steps.set(e.id, now + 260 + Math.random() * 120);
    if (due) this.particles.step(e.x, e.y + 1);
  }

  /** A single bright frame on a critical, tinted by the element that landed it. */
  drawCritFlash(ctx, now) {
    if (now >= this.flashUntil) return;
    const k = (this.flashUntil - now) / 90;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = k * 0.16;
    ctx.fillStyle = elRgba(this.flashEl ?? 'neutral', 'core', 1);
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  /** A soft frame so the eye settles in the middle of the screen. */
  drawVignette(ctx) {
    const w = this.canvas.width, h = this.canvas.height;
    if (!this._vig || this._vig.w !== w || this._vig.h !== h) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.38, w / 2, h / 2, Math.max(w, h) * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.34)');
      this._vig = { w, h, g };
    }
    ctx.save();
    ctx.fillStyle = this._vig.g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /**
   * A character came up a level, or took a whole new job. Both are a pillar
   * of dawn-light; the job change is simply bigger, longer and loud enough
   * that the people standing nearby look over.
   */
  ascend(e, { big = false, mine = false } = {}) {
    this.addFx({ fx: 'ascend', el: 'holy', x: e.x, y: e.y, big, life: big ? 2000 : 1300 });
    this.particles.ring(e.x, e.y, { color: '255,225,150', n: big ? 34 : 18, power: big ? 1.5 : 0.9 });
    for (let i = 0; i < (big ? 3 : 1); i++) {
      setTimeout(() => this.particles.spark(e.x, e.y - 20, {
        color: '255,236,190', n: big ? 16 : 9, power: 1.1,
      }), i * 180);
    }
    if (mine) {
      this.shake = Math.max(this.shake, big ? 8 : 3);
      this.flashUntil = performance.now() + (big ? 200 : 110);
      this.flashEl = 'holy';
    }
  }

  /** Hit sparks, called from the game when damage lands. */
  spark(x, y, opts) { this.particles.spark(x, y, opts); }
  poof(x, y, color) { this.particles.poof(x, y, color); }

  /**
   * Something died. An ordinary kill breaks apart and settles; a boss gets
   * the whole treatment - a nova in its own element, a shockwave along the
   * ground, a bleached frame and a camera that will not hold still. The
   * difference is deliberate: if every kill looked like this one, none would.
   */
  death(e, { el = 'neutral', boss = false, me = false } = {}) {
    const L = elLook(el);
    const scale = e.sprite?.scale ?? 1;
    const at = { x: e.x, y: e.y - 16 * scale };

    // painted monsters melt away on their own death row, then fade
    if (e.k === 'm' && e.sprite?.kind === 'frames') {
      const ms = mobAnimMs(e.sprite.key, 'death');
      this.corpses = (this.corpses ?? []).filter((c) => performance.now() - c.t < c.ms + 600);
      this.corpses.push({ sprite: e.sprite, x: e.x, y: e.y, flip: !e._faceLeft, t: performance.now(), ms });
      e._gone = true;          // the live body stays in the snapshot a moment longer
      this.particles.poof(at.x, at.y, L.deep.join(','));
      return;
    }

    if (boss) {
      this.addFx({ fx: 'nova', el, x: at.x, y: at.y, r: 120, life: 900 });
      this.addFx({ fx: 'impact', el, x: at.x, y: at.y, r: 80, life: 520 });
      this.particles.ring(e.x, e.y, { color: L.core.join(','), n: 40, power: 1.8 });
      this.particles.shatter(at.x, at.y, { color: L.main.join(','), n: 34, power: 2.1, spread: 24 });
      this.particles.poof(at.x, at.y, L.deep.join(','));
      this.scorch.push({ x: e.x, y: e.y, r: 110, el, life: 4000, t: performance.now() });
      this.shake = 14;
      this.flashUntil = performance.now() + 220;
      this.flashEl = el;
      this.freezeUntil = performance.now() + 110;
      return;
    }

    this.particles.shatter(at.x, at.y, {
      color: me ? '200,120,120' : L.main.join(','),
      n: 12, power: 0.9 * scale, spread: 9 * scale,
    });
    this.particles.poof(at.x, at.y, me ? '200,120,120' : L.deep.join(','));
    this.addFx({ fx: 'impact', el, x: at.x, y: at.y, r: 20 * scale, life: 260 });
  }

  drawNameplate(ctx, e, state, now) {
    const isMe = e.id === state.myId;
    const isTarget = e.id === state.targetId;
    const chibi = e.k === 'p' && e.look?.style === 'chibi';   // a big head, a little taller than LPC
    const painted = e.k === 'n' && e.look?.pic;   // painted NPCs stand ~52px tall
    const art = e.sprite?.kind === 'frames' ? MOB_ART[e.sprite.key] : null;
    const top = e.y - (e.sprite?.fly ?? 0) - (art ? art.top * (e.sprite.scale ?? 1) + 12
      : e.sprite?.scale ? 46 * e.sprite.scale : chibi ? 52 : painted ? 56 : 44);

    if (isTarget) {
      // the sheet's reticles: red once you are hitting it, gold while it is
      // only picked, blue on a player or anyone else who is not a foe
      const kind = e.k !== 'm' ? 'ally' : state.lockOn ? 'lock' : 'pick';
      const img = RETICLES;
      if (img?.naturalWidth) {
        const cell = img.naturalHeight, sx = RETICLE_CELLS.indexOf(kind) * cell;
        const size = (e.boss ? 62 : 38) * (kind === 'lock' ? 1 + Math.sin(now / 140) * 0.04 : 1);
        const cy = e.y - (e.boss ? 22 : chibi ? 18 : 14);
        ctx.save();
        ctx.globalAlpha = kind === 'lock' ? 0.92 : 0.8;
        ctx.translate(e.x, cy);
        ctx.rotate(kind === 'lock' ? 0 : now / 2400);
        ctx.drawImage(img, sx, 0, cell, cell, -size / 2, -size / 2, size, size);
        ctx.restore();
      } else {
        ctx.save();
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.lineDashOffset = -now / 60;
        ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, 14, 6, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
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

    // A shop sign, so a stall is a thing you notice walking past rather than
    // a row in a list. Drawn above the health bar and under the name.
    const stall = e.k === 'p' && (state.stalls ?? []).find((sg) => sg.id === e.id);
    if (stall) {
      ctx.save();
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const label = `\u{1F6D2} ${stall.title}`;
      const w = ctx.measureText(label).width + 10;
      const y = top - 16;
      ctx.fillStyle = 'rgba(24,18,10,0.82)';
      ctx.strokeStyle = '#e8b45a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect?.(e.x - w / 2, y - 10, w, 13, 3) ?? ctx.rect(e.x - w / 2, y - 10, w, 13);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f2d79a';
      ctx.fillText(label, e.x, y);
      ctx.restore();
    }

    // Anything this far above you attacks on sight, whether or not its kind
    // normally does. That rule is invisible unless we say so, and an invisible
    // rule that kills you is just an ambush - so the plate says it plainly.
    const hunts = e.k === 'm' && !e.sum && (e.lv ?? 0) - (state.myLevel ?? 1) > LEVEL_AGGRO_GAP;

    ctx.font = (e.boss ? 'bold 9px' : '8px') + ' system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    const plated = e.k === 'n' && NPC_PLATE?.naturalWidth;
    const label = e.k === 'm' ? `${hunts ? '\u203c ' : ''}${e.n} Lv${e.lv}` : e.k === 'n' && !plated ? `[${e.n}]` : `${e.n}`;
    if (plated) {
      // townsfolk and shopkeepers wear the sheet's name plate
      const w = ctx.measureText(label).width + 12;
      ctx.drawImage(NPC_PLATE, e.x - w / 2, top - 12, w, 11);
      // and whoever has work for you says so over their head
      const mark = MARKS[state.questMarks?.[e.role]];
      if (mark?.naturalWidth) {
        const h = 22, mw = h * (mark.naturalWidth / mark.naturalHeight);
        const bob = Math.sin(now / 260 + e.x * 0.01) * 2;
        ctx.drawImage(mark, e.x - mw / 2, top - 37 + bob, mw, h);
      }
    }
    // other players' names can be hidden; the one you have picked keeps its name
    if (e.k !== 'p' || isMe || isTarget || prefs.names) {
      ctx.strokeText(label, e.x, top - 4);
      ctx.fillStyle = plated ? '#f6ecd6' : e.k === 'n' ? '#9fe0b0'
        : e.k === 'm' ? (hunts ? '#ff8a8a' : e.boss ? '#ffb45e' : '#ffd9d9')
          : (isMe ? '#b9f6c7' : '#cfe4ff');
      ctx.fillText(label, e.x, top - 4);
    }

    // and a slow pulse under its feet, readable from across the screen where
    // an eight-pixel name plate is not
    if (hunts) {
      const beat = 0.35 + 0.25 * Math.sin(now / 320 + e.x * 0.05);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,90,90,${beat})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + 2, 16, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (e.st) {
      ctx.font = '8px system-ui, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(e.st, e.x, top - 13);
    }
  }

  /** A boss is about to hit this floor. Added by the game from a `warn` event. */
  warn(w) {
    this.warnings.push({ ...w, t: performance.now() });
  }

  drawWarnings(ctx, now) {
    for (let i = this.warnings.length - 1; i >= 0; i--) {
      const w = this.warnings[i];
      if (now - w.t > w.ms) { this.warnings.splice(i, 1); continue; }
      drawWarning(ctx, w, now);
    }
  }

  /** One-shot skill effects, drawn by element in skillfx.js. */
  drawFx(ctx, now) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      const age = now - f.t;
      if (age > f.life) { this.fx.splice(i, 1); continue; }
      drawSkillFx(ctx, f, age);
    }
  }

  /**
   * Effects cut from a monster's sheet. A bolt waits for the swing to let go,
   * flies at whoever it was loosed at (following them as they move) and
   * bursts on arrival; vines grow out of the floor where the ring was.
   */
  drawMobFx(ctx, state, now) {
    for (let i = this.mobFx.length - 1; i >= 0; i--) {
      const f = this.mobFx[i];
      const age = now - f.t;
      if (f.name === 'bolt') {
        const flown = age - (f.delay ?? 0);
        if (flown < 0) continue;
        const to = f.target && (state.ents ?? []).find((e) => e.id === f.target);
        const tx = to ? to.x : f.tx, ty = (to ? to.y : f.ty) - 18;
        const sx = f.x, sy = f.y - 24;
        const p = flown / Math.max(1, f.ms);
        if (p < 1) {
          const x = sx + (tx - sx) * p, y = sy + (ty - sy) * p;
          drawMobFx(ctx, f.mob, 'bolt', Math.floor(flown / 70) % 5, x, y, { angle: Math.atan2(ty - sy, tx - sx) });
          if (Math.random() < 0.35) this.particles.spark(x, y, { color: '150,255,120', n: 1, power: 0.4 });
          continue;
        }
        const burst = (flown - f.ms) / 220;
        if (burst >= 1) { this.mobFx.splice(i, 1); continue; }
        drawMobFx(ctx, f.mob, 'bolt', 5 + Math.floor(burst * 2), tx, ty, { scale: 1.2 });
        continue;
      }
      // anything else plays its strip once at 11 fps where it was put, then fades
      const n = MOB_ART[f.mob]?.fx?.[f.name]?.n ?? 1;
      const frame = Math.floor(age / 90);
      const fade = Math.max(0, (age - n * 90) / 250);
      if (fade >= 1) { this.mobFx.splice(i, 1); continue; }
      drawMobFx(ctx, f.mob, f.name, frame, f.x, f.y, { scale: 1.5, alpha: 1 - fade });
    }
  }

  /** Per-theme colour grade, vignette, and additive lights from props/portals. */
  drawAmbience(ctx, view, props, state, now) {
    const theme = this.zone.theme ?? 'grass';
    const w = view.x1 - view.x0, h = view.y1 - view.y0;

    // the zone's own colour, always on
    const tint = {
      crypt: 'rgba(12,10,26,0.52)', ice: 'rgba(90,150,200,0.20)', marsh: 'rgba(48,66,44,0.22)',
      rock: 'rgba(80,60,40,0.12)', grass: 'rgba(30,50,70,0.06)', town: 'rgba(255,205,140,0.05)',
    }[theme];
    if (tint) {
      ctx.save();
      ctx.fillStyle = tint;
      ctx.fillRect(view.x0, view.y0, w, h);
      ctx.restore();
    }

    // time of day on top of it, skipped underground where there is no sky
    const sky = skyAt(Date.now());
    const underground = theme === 'crypt';
    // The full-strength night grade was tuned for the code-drawn tiles; over
    // painted art it just muddies everything. Towns have lit streets, so
    // night there is a touch of blue; out in the wilds it is darker.
    const nightScale = theme === 'town' ? 0.4 : 0.7;
    if (!underground && sky.alpha > 0.005) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgba(${sky.rgb.join(',')},${sky.alpha * nightScale})`;
      ctx.fillRect(view.x0, view.y0, w, h);
      ctx.restore();
      if (sky.phase > 0.24 && sky.phase < 0.36) {        // dawn wash
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,170,90,${0.05 * (1 - sky.lamp)})`;
        ctx.fillRect(view.x0, view.y0, w, h);
        ctx.restore();
      }
    }

    // lamps matter more after dark; underground they are always lit
    const lampNeed = underground ? 1 : Math.max(0.18, sky.lamp);
    const lights = [];
    for (const p of props) {
      if (GLOWING.has(p.kind)) lights.push({ x: p.x, y: p.y - 22 * p.scale, r: 90 + 40 * lampNeed, c: '255,190,120', i: 0.34 * (0.45 + lampNeed) });
    }
    for (const w2 of this.zone.warps ?? []) {
      lights.push({ x: (w2.x + w2.w / 2) * TILE, y: (w2.y + w2.h / 2) * TILE, r: 120, c: '150,215,255', i: 0.34 });
    }
    const me = state.me;
    // a lantern of your own, once it is dark enough to need one
    const carry = underground || theme === 'ice' ? 1 : lampNeed;
    if (me && carry > 0.3) lights.push({ x: me.x, y: me.y - 16, r: 120 + 50 * carry, c: '255,225,180', i: 0.30 * carry });
    if (!lights.length) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      if (l.x < view.x0 - l.r || l.x > view.x1 + l.r || l.y < view.y0 - l.r || l.y > view.y1 + l.r) continue;
      const flicker = 0.82 + Math.sin(now / 130 + l.x) * 0.1;
      const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, l.r);
      g.addColorStop(0, `rgba(${l.c},${(l.i ?? 0.34) * flicker})`);
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
      const t = age / 1000;
      const [sx, sy] = this.worldToScreen(f.x + f.vx * t, f.y + f.vy * t + f.g * t * t * 0.5);
      ctx.globalAlpha = 1 - k * k;
      // it punches in at full size, then settles - the number itself lands
      const grow = k < 0.16 ? f.pop - (f.pop - 1) * (k / 0.16) : 1;
      if (f.img?.naturalWidth) {
        const h = f.size * grow * this.dpr;
        const w = h * (f.img.naturalWidth / f.img.naturalHeight);
        ctx.drawImage(f.img, sx - w / 2, sy - h * 0.8, w, h);
        continue;
      }
      if (f.digits && digitsReady()) {
        const h = f.size * 1.35 * grow * this.dpr;
        const glyphs = [...f.text].map((c) => DIGITS[+c]);
        const ws = glyphs.map((g) => h * (g.naturalWidth / g.naturalHeight));
        const gap = -h * 0.08;
        let x = sx - (ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1)) / 2;
        glyphs.forEach((g, i) => { ctx.drawImage(g, x, sy - h * 0.8, ws[i], h); x += ws[i] + gap; });
        continue;
      }
      ctx.font = `bold ${Math.round(f.size * grow * this.dpr)}px system-ui, sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.strokeText(f.text, sx, sy);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, sx, sy);
    }
    ctx.restore();
  }
}
