// LPC sheet loading + paper-doll composition.
// Every sheet is 13x21 frames of 64x64; see assets/lpc/CREDITS.md.
import { SPRITE, ANIM, SHEET_COLS } from '../../shared/constants.js';
import { LPC, layoutOf, frameAt, rowAt, frameRect, fits } from '../../shared/sheets.js';
import { ITEMS } from '../../shared/data/items.js';
import { MOB_ART } from '../../shared/data/mobart.js';

const BASE = '/assets/lpc';
const MOB_BASE = '/assets/mob';
const cache = new Map();      // url -> { img, ready, failed }
const tinted = new Map();

export function sheet(url) {
  let entry = cache.get(url);
  if (entry) return entry;
  entry = { img: new Image(), ready: false, failed: false, url };
  entry.img.onload = () => { entry.ready = true; };
  entry.img.onerror = () => { entry.failed = true; };
  entry.img.src = url;
  cache.set(url, entry);
  return entry;
}

export function preload(urls) { for (const u of urls) sheet(urlOf(u)); }

/** A layer entry is either a plain url or `{ url, tint }`. */
export function urlOf(v) { return typeof v === 'string' ? v : v?.url ?? null; }

/**
 * A recoloured copy of a whole sheet, built once and kept.
 *
 * The art set tops out at one golden tier, so every endgame piece would look
 * like every other endgame piece. Tinting the sheet rather than the frame
 * costs one canvas per colour instead of one composite per character per
 * frame, which is what lets a whole late-game armour set exist without a
 * single new image file.
 */
export function tintedSheet(url, tint, strength = 0.42) {
  const key = `${url}|${tint}|${strength}`;
  const hit = tinted.get(key);
  if (hit) return hit;
  const src = sheet(url);
  const entry = { ready: false, img: null };
  tinted.set(key, entry);
  const build = () => {
    if (!src.img.width) return;
    const c = document.createElement('canvas');
    c.width = src.img.width; c.height = src.img.height;
    const g = c.getContext('2d');
    g.drawImage(src.img, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = strength;
    g.fillStyle = tint;
    g.fillRect(0, 0, c.width, c.height);
    entry.img = c; entry.ready = true;
  };
  if (src.ready) build();
  else src.img.addEventListener('load', build, { once: true });
  return entry;
}

export function loadedRatio() {
  let done = 0;
  for (const e of cache.values()) if (e.ready || e.failed) done++;
  return cache.size ? done / cache.size : 1;
}

/** Resolve a logical layer+key into a sheet URL (with a sensible fallback). */
export function layerUrl(layer, key, gender = 'male') {
  if (!key) return null;
  switch (layer) {
    case 'mob': return `${BASE}/mob/${key}.png`;
    case 'body': return key.includes('/') ? `${BASE}/body/${key}.png` : `${BASE}/body/${gender}/${key}.png`;
    case 'eyes': return `${BASE}/eyes/${gender}/${key}.png`;
    case 'hair': return `${BASE}/hair/${gender}/${key}.png`;     // key = "style/color"
    case 'weapon':
      return WEAPON_EITHER.has(key) ? `${BASE}/weapon/either/${key}.png` : `${BASE}/weapon/${gender}/${key}.png`;
    // Armour is worn over the shirt and has no sheets of its own yet, so it
    // borrows the torso folder. docs/ART.md lists this with the other
    // placeholders; when armour art lands, this case goes away.
    case 'armor': return `${BASE}/torso/${gender}/${key}.png`;
    default: return `${BASE}/${layer}/${gender}/${key}.png`;
  }
}
const WEAPON_EITHER = new Set(['bow', 'recurvebow', 'greatbow', 'longspear', 'arrow']);
// Keys the imported asset set only ships for one gender. The sheet we have
// for these is the female one, so a male character falls back to the item's
// `fallback` key rather than asking for a file that is not there.
const MALE_MISSING = new Set(['steelwand']);

/** Draw order, back to front. */
/**
 * Bottom to top. This is the LPC stacking the existing art was drawn for.
 *
 * The new sheets state their own order on the equip guide - base, top,
 * bottom, shoes, gloves, cloak, weapon, accessory - which is not this one:
 * it puts the shirt under the trousers and hangs a cloak behind the weapon.
 * A layout therefore carries its own order, and a character is drawn in the
 * order its body sheet asks for rather than in one global sequence.
 */
const ORDER = ['body', 'eyes', 'legs', 'feet', 'torso', 'armor', 'belt', 'hands', 'head', 'hair', 'weapon', 'offhand'];

/** The order stated on the new art's equip-layer guide. */
export const CHIBI_ORDER = [
  'body', 'eyes', 'hair', 'torso', 'legs', 'feet', 'hands',
  'back', 'armor', 'belt', 'head', 'face', 'neck', 'weapon', 'offhand', 'accessory',
];

/** The chibi walk body and the pieces cut to its grid. Hair goes over the
 *  body and a hat over the hair. The cape hangs behind a body facing the
 *  camera and over one facing away, so it is two sheets, one either side. */
const CHIBI_WALK_ORDER = ['cape_under', 'body', 'bottom', 'boots', 'top', 'belt', 'gloves', 'hair', 'head', 'cape_over'];
const ORDERS = { lpc: ORDER, chibi8: CHIBI_ORDER, chibi_walk: CHIBI_WALK_ORDER };
export function orderFor(layout) { return ORDERS[layout?.id] ?? ORDER; }

const CHIBI_BASE = '/assets/chibi';
/** The chibi bodies that exist; a look naming anything else gets the first. */
export const CHIBI_BODIES = ['base_male'];
/** Chibi hair: one cut so far, in the four colours the creator offers. */
export const CHIBI_HAIR_COLOURS = ['black', 'brown', 'blonde', 'white'];
export function chibiUrl(key) {
  const url = `${CHIBI_BASE}/body/${CHIBI_BODIES.includes(key) ? key : CHIBI_BODIES[0]}.png`;
  declareLayout(url, 'chibi_walk');
  return url;
}

/** Build the layer list for a player-shaped entity. */
export function playerLayers(look, equipment = {}) {
  // A chibi wears only pieces drawn for the chibi grid; LPC sheets are a
  // different size and would float off the body.
  if (look?.style === 'chibi') {
    const layers = { body: chibiUrl(look.chibi) };
    if (look.chibiHair !== 'bald') {
      const colour = CHIBI_HAIR_COLOURS.includes(look.hairColor) ? look.hairColor : 'brown';
      layers.hair = `${CHIBI_BASE}/hair/spiky_${colour}.png`;
      declareLayout(layers.hair, 'chibi_walk');
    }
    for (const itemId of Object.values(equipment)) {
      const c = ITEMS[itemId]?.chibi;
      if (!c) continue;                 // LPC-only art would not fit this body
      const names = c.layer === 'cape' ? [['cape_under', '_under'], ['cape_over', '_over']] : [[c.layer, '']];
      for (const [layer, suffix] of names) {
        const url = `${CHIBI_BASE}/gear/${c.key}${suffix}.webp`;
        declareLayout(url, 'chibi_walk');
        layers[layer] = url;
      }
    }
    return layers;
  }
  const g = look?.gender === 'female' ? 'female' : 'male';
  const layers = {
    body: layerUrl('body', look?.body ?? 'light', g),
    eyes: layerUrl('eyes', look?.eyes ?? 'brown', g),
    hair: layerUrl('hair', `${look?.hair ?? 'plain'}/${look?.hairColor ?? 'brown'}`, g),
  };
  for (const [slot, itemId] of Object.entries(equipment)) {
    const def = ITEMS[itemId];
    if (!def?.sprite) continue;
    let key = def.sprite.key;
    if (g === 'male' && MALE_MISSING.has(key) && def.sprite.fallback) key = def.sprite.fallback;
    const url = layerUrl(def.sprite.layer, key, def.sprite.gendered ? g : g);
    layers[def.sprite.layer] = def.sprite.tint ? { url, tint: def.sprite.tint } : url;
  }
  // a hat hides hair
  if (layers.head) delete layers.hair;
  return layers;
}

/** Layers for an NPC, whose look uses raw layer keys rather than item ids. */
const NPC_BASE = '/assets/npc';
/** How much of the painted NPC art makes one world pixel: ~210px art -> ~50px. */
export const NPC_PIC_SCALE = 0.24;

export function npcLayers(look) {
  if (!look) return null;
  // a painted townsperson is one picture, not a stack of LPC layers
  if (look.pic) return { pic: `${NPC_BASE}/${look.pic}.png` };
  const g = look.body?.startsWith('female') ? 'female' : 'male';
  const layers = { body: layerUrl('body', look.body ?? 'male/light') };
  if (look.hair) layers.hair = layerUrl('hair', look.hair, g);
  if (look.eyes) layers.eyes = layerUrl('eyes', look.eyes, g);
  for (const slot of ['torso', 'legs', 'feet', 'head', 'hands', 'belt', 'weapon', 'offhand']) {
    if (look[slot]) layers[slot] = layerUrl(slot, look[slot], g);
  }
  if (layers.head) delete layers.hair;
  return layers;
}

/** Layers for a monster. */
export function monsterLayers(sprite) {
  if (!sprite || sprite.kind !== 'sheet' && sprite.kind !== 'compose') return null;
  const layers = {};
  if (sprite.kind === 'sheet') layers.body = layerUrl('mob', sprite.key);
  else layers.body = layerUrl('body', sprite.body);
  for (const [slot, key] of Object.entries(sprite.layers ?? {})) {
    layers[slot] = layerUrl(slot === 'weapon' ? 'weapon' : slot, key, 'male');
  }
  if (layers.head) delete layers.hair;
  return layers;
}

/** Which column of the animation strip to draw right now. */
export function frameOf(animName, elapsedMs, looping = true, layout = LPC) {
  return frameAt(layout, animName, elapsedMs, looping);
}

export function rowOf(animName, dir, layout = LPC) {
  return rowAt(layout, animName, dir);
}

/**
 * Which layout a sheet follows.
 *
 * Declared per sheet rather than assumed for all of them, so art drawn to a
 * different grid is a line of configuration instead of a renderer change.
 * Anything unregistered is LPC, which is every asset that exists today.
 */
const sheetLayouts = new Map();
export function declareLayout(url, layoutId) { sheetLayouts.set(url, layoutOf(layoutId)); }
export function layoutFor(url) { return sheetLayouts.get(url) ?? LPC; }

/**
 * Warn once per sheet whose pixels do not match what it claims to be. A sheet
 * one row short does not fail, it draws somebody else's feet during the hurt
 * animation, and that is a miserable thing to debug from the symptom.
 */
const checked = new Set();
function checkGeometry(url, img, layout) {
  if (checked.has(url) || !img.width) return;
  checked.add(url);
  if (!fits(layout, img.width, img.height)) {
    console.warn(`[sprites] ${url} is ${img.width}x${img.height}, but layout "${layout.id}" `
      + `expects ${layout.frame.w * layout.cols}x${layout.frame.h * layout.rows}`);
  }
}

/** These play once and hold their last frame; the server hands back to idle. */
const ONE_SHOT = new Set(['hurt', 'slash', 'thrust', 'shoot']);

// A 64x64 scratch buffer for tinting a single layer (see drawRefineGlow).
let scratch = null;
function scratchCtx(w = SPRITE, h = SPRITE) {
  if (!scratch) scratch = document.createElement('canvas');
  // Resized rather than fixed at 64: a sheet on another grid has frames of
  // its own size, and clipping them to 64 would quietly crop the art.
  if (scratch.width !== w || scratch.height !== h) { scratch.width = w; scratch.height = h; }
  return scratch.getContext('2d');
}

/**
 * Light coming off a refined weapon: the weapon layer, tinted and drawn
 * again additively - so the glow follows the swing frame by frame instead
 * of floating next to the character.
 */
export function drawRefineGlow(ctx, layers, { x, y, anim = 'idle', dir = 2, elapsed = 0,
  scale = 1, color = '#ffffff', alpha = 0.5, blur = 0 } = {}) {
  const url = urlOf(layers?.weapon);
  if (!url) return false;
  const s = sheet(url);
  if (!s.ready) return false;

  const layout = layoutFor(url);
  const { sx, sy, sw, sh } = frameRect(layout, anim, dir, elapsed, !ONE_SHOT.has(anim));
  const g = scratchCtx(sw, sh);
  g.clearRect(0, 0, sw, sh);
  g.drawImage(s.img, sx, sy, sw, sh, 0, 0, sw, sh);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = color;
  g.fillRect(0, 0, sw, sh);
  g.globalCompositeOperation = 'source-over';

  const size = sh * scale;
  const dx = Math.round(x - (sw * scale) / 2);
  const dy = Math.round(y - size + size * (1 - layout.anchor));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  if (blur) ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(scratch, 0, 0, sw, sh, dx, dy, sw * scale, sh * scale);
  ctx.restore();
  return true;
}

/**
 * Play an effect sheet over a character, in step with whatever they are doing.
 *
 * This is how art-backed refine tiers land: a sheet drawn on the same grid as
 * the body, composited additively on top, so a flame follows the swing frame
 * by frame instead of floating beside it. A sheet with its own layout works
 * too - declareLayout() it and the frames are read from there.
 */
export function drawOverlaySheet(ctx, url, { x, y, anim = 'idle', dir = 2, elapsed = 0,
  scale = 1, alpha = 1, additive = true, loopMs = 0 } = {}) {
  if (!url) return false;
  const s = sheet(url);
  if (!s.ready) return false;
  const layout = layoutFor(url);
  checkGeometry(url, s.img, layout);
  // An effect may run on its own clock rather than the character's, which is
  // what a flame wants: it keeps burning while its wielder stands still.
  const t = loopMs > 0 ? (Date.now() % loopMs) : elapsed;
  const { sx, sy, sw, sh } = frameRect(layout, anim, dir, t, true);
  const size = sh * scale;
  const dx = Math.round(x - (sw * scale) / 2);
  const dy = Math.round(y - size + size * (1 - layout.anchor));
  ctx.save();
  if (additive) ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.drawImage(s.img, sx, sy, sw, sh, dx, dy, sw * scale, sh * scale);
  ctx.restore();
  return true;
}

/**
 * Draw one composed character.
 * @param ctx canvas 2d context
 * @param layers map of layer -> url (from playerLayers/monsterLayers)
 */
/** A small reusable canvas, cleared, for building one figure off screen. */
let figureCanvas = null;
function figureCtx(w, h) {
  figureCanvas ??= document.createElement('canvas');
  if (figureCanvas.width < w || figureCanvas.height < h) {
    figureCanvas.width = Math.max(figureCanvas.width, w);
    figureCanvas.height = Math.max(figureCanvas.height, h);
  }
  const g = figureCanvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, w, h);
  return g;
}

export function drawCharacter(ctx, layers, { x, y, anim = 'idle', dir = 2, elapsed = 0, scale = 1, alpha = 1, tint = null, flash = 0 }) {
  // Geometry comes from whichever layout the body sheet follows, so a
  // character drawn on a different grid lines up with its own equipment.
  const layout = layoutFor(urlOf(layers.body));
  scale *= layout.drawScale ?? 1;
  const size = layout.frame.h * scale;
  const dx = Math.round(x - (layout.frame.w * scale) / 2);
  const dy = Math.round(y - size + size * (1 - layout.anchor));

  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;
  // art drawn big and shrunk to fit turns to jagged noise without smoothing,
  // but smoothing art that ends up enlarged only blurs it
  if (layout.drawScale) {
    ctx.imageSmoothingEnabled = scale * ctx.getTransform().a < 1;
    ctx.imageSmoothingQuality = 'high';
  }
  const paint = (g, ox, oy) => {
    for (const layer of orderFor(layout)) {
      const entry = layers[layer];
      if (!entry) continue;
      const url = urlOf(entry);
      const plain = sheet(url);
      if (!plain.ready) continue;
      const own = layoutFor(url);
      checkGeometry(url, plain.img, own);
      const { sx, sy, sw, sh } = frameRect(own, anim, dir, elapsed, !ONE_SHOT.has(anim));
      // A tinted piece falls back to its untinted sheet until the recolour is
      // built, so gear never blinks out of existence for a frame.
      const t = entry.tint ? tintedSheet(url, entry.tint) : null;
      const img = t?.ready ? t.img : plain.img;
      g.drawImage(img, sx, sy, sw, sh, ox, oy, sw * scale, sh * scale);
    }
  };
  if (tint || flash) {
    // The colour has to land on the figure alone. Laid over the main canvas
    // with source-atop it lit up the ground behind as well - a white box
    // round anyone who was hit - so the figure is built on its own first.
    const w = Math.ceil(layout.frame.w * scale), h = Math.ceil(size);
    const g = figureCtx(w, h);
    g.imageSmoothingEnabled = ctx.imageSmoothingEnabled;
    g.imageSmoothingQuality = 'high';
    paint(g, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = flash ? flash * 0.6 : 0.35;
    g.fillStyle = flash ? '#ffffff' : tint;
    g.fillRect(0, 0, w, h);
    ctx.drawImage(g.canvas, 0, 0, w, h, dx, dy, w, h);
  } else {
    paint(ctx, dx, dy);
  }
  ctx.restore();
  return { dx, dy, size };
}

/** A painted NPC: stood on its feet, facing the camera whichever way it 'faces'. */
/** Where the legs start on a standing chibi picture, as a share of its height. */
const LEGS_AT = 0.8;

/**
 * A painted NPC. Standing, it is the picture. Walking, it is cut in three -
 * body, left leg, right leg - and stepped: the legs lift in turn, the body
 * rides up on each stride and rolls a little toward the leg it is on, so a
 * one-pose picture reads as somebody walking rather than sliding.
 * `step` is the stride phase in radians, or null when standing still.
 */
export function drawPicture(ctx, url, { x, y, alpha = 1, flash = 0, flip = false, step = null }) {
  const s = sheet(url);
  if (!s.ready) return null;
  const iw = s.img.width, ih = s.img.height;
  const w = iw * NPC_PIC_SCALE, h = ih * NPC_PIC_SCALE;
  const dx = x - w / 2, dy = y - h + 4;
  ctx.save();
  // the art only faces forward, so walking left is the same picture mirrored
  if (flip) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
  ctx.imageSmoothingEnabled = NPC_PIC_SCALE * ctx.getTransform().a < 1;
  if (alpha < 1) ctx.globalAlpha = alpha;
  if (step === null) {
    ctx.drawImage(s.img, Math.round(dx), Math.round(dy), w, h);
  } else {
    const p = Math.sin(step);
    const lift = 3.2;                               // world px a foot comes up
    // the leg pieces reach up under the body, so a gap never opens at the
    // hip when the body rides up
    const legY = ih * (LEGS_AT - 0.08), legH = ih - legY;
    const half = iw / 2;
    const liftL = Math.max(0, p) * lift, liftR = Math.max(0, -p) * lift;
    // feet first, so the body overlaps the top of the legs
    ctx.drawImage(s.img, 0, legY, half, legH, dx, dy + legY * NPC_PIC_SCALE - liftL, w / 2, legH * NPC_PIC_SCALE);
    ctx.drawImage(s.img, half, legY, half, legH, dx + w / 2, dy + legY * NPC_PIC_SCALE - liftR, w / 2, legH * NPC_PIC_SCALE);
    const bob = Math.abs(p) * 1.8;
    ctx.save();
    ctx.translate(x, y - h * 0.35);
    ctx.rotate(p * 0.045);
    const bodyH = ih * LEGS_AT;
    ctx.drawImage(s.img, 0, 0, iw, bodyH, -w / 2, -h * 0.65 + 4 - bob, w, bodyH * NPC_PIC_SCALE);
    ctx.restore();
  }
  if (flash) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = flash * 0.6;
    ctx.fillStyle = '#fff';
    ctx.fillRect(dx, dy, w, h);
  }
  ctx.restore();
  return { dx, dy, w, h };
}

/**
 * A monster cut from a painted animation sheet (tools/slice-mob.py): one
 * atlas row per animation, every frame in a cell of one size standing on the
 * same foot line.
 */
const MOB_ANIM = { idle: 'idle', walk: 'walk', run: 'run', slash: 'attack', thrust: 'attack', shoot: 'attack',
  spellcast: 'attack', hurt: 'hit', hit: 'hit', death: 'death', spawn: 'spawn', skill: 'skill',
  leap: 'leap', howl: 'howl', enrage: 'enrage' };
// frames a second; the ones marked once hold their last frame
const MOB_FPS = { idle: 8, walk: 11, run: 13, attack: 13, skill: 9, hit: 16, death: 11, spawn: 13,
  leap: 8, howl: 9, enrage: 9 };
const MOB_ONCE = new Set(['attack', 'skill', 'hit', 'death', 'spawn', 'leap', 'howl', 'enrage']);

/** How long one pass of an animation takes, in ms. */
export function mobAnimMs(key, anim) {
  const art = MOB_ART[key];
  const row = art?.anims.find(([a]) => a === anim);
  return row ? (row[1] / MOB_FPS[anim]) * 1000 : 0;
}

export function drawMobFrames(ctx, sprite, { x, y, anim = 'idle', elapsed = 0, flip = false,
  flash = 0, alpha = 1, scale = 1 } = {}) {
  const art = MOB_ART[sprite.key];
  if (!art) return false;
  const s = sheet(`${MOB_BASE}/${sprite.key}.webp`);
  if (!s.ready) return false;
  const name = MOB_ANIM[anim] ?? 'idle';
  let r = art.anims.findIndex(([a]) => a === name);
  if (r < 0) r = 0;
  const [row, count] = art.anims[r];
  let f = Math.floor((Math.max(0, elapsed) / 1000) * MOB_FPS[row]);
  f = MOB_ONCE.has(row) ? Math.min(f, count - 1) : f % count;
  const [cw, ch] = art.cell;
  const k = art.show * (sprite.scale ?? 1) * scale;
  const w = cw * k, h = ch * k;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  // the painting faces one way; turn it to face the other
  if (flip !== (art.faces === 'right')) ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(s.img, f * cw, r * ch, cw, ch, -w / 2, -art.foot * k, w, h);
  if (flash) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * Math.min(1, flash) * 0.55;
    ctx.drawImage(s.img, f * cw, r * ch, cw, ch, -w / 2, -art.foot * k, w, h);
  }
  ctx.restore();
  return true;
}

/** Procedural blob monster (slimes, wisps, wolves) - no art required. */
/**
 * Monsters with no LPC sheet, drawn in code.
 *
 * This used to draw exactly one thing - an ellipse with two eyes - so every
 * creature that was not a skeleton or an orc was the same blob in a different
 * colour. `sprite.shape` picks a body instead, which is what lets a zone hold
 * six kinds of monster that actually look like six kinds of monster.
 */
export function drawBlob(ctx, sprite, { x, y, t, hurt = 0, scale = 1 }) {
  const r = 16 * (sprite.scale ?? 1) * scale;
  const shape = sprite.shape ?? 'blob';
  const bob = sprite.float ? Math.sin(t / 380) * 5 : Math.abs(Math.sin(t / 260)) * 2;
  const squash = 1 + Math.sin(t / 240) * 0.08;
  const body = hurt ? '#ffffff' : sprite.color;

  ctx.save();
  ctx.translate(x, y - r * 0.6 - bob);

  // shadow, tight under whatever the body turns out to be
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.75 + bob, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (sprite.glow) {
    const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2);
    g.addColorStop(0, sprite.color + 'cc');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r * 2, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = body;
  const dark = sprite.dark ?? 'rgba(0,0,0,0.30)';

  if (shape === 'spiky') {
    // a ball of thorns: spikes first so the body caps their roots
    ctx.fillStyle = sprite.dark ?? body;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.sin(t / 700) * 0.1;
      const len = r * (1.35 + (i % 2) * 0.25);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.16) * r * 0.8, Math.sin(a - 0.16) * r * 0.8);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.lineTo(Math.cos(a + 0.16) * r * 0.8, Math.sin(a + 0.16) * r * 0.8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2); ctx.fill();
  } else if (shape === 'wisp') {
    // a flame: a teardrop that licks upward and never sits still
    const lick = Math.sin(t / 180) * r * 0.18;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.5 + lick);
    ctx.quadraticCurveTo(r * 0.95, -r * 0.2, r * 0.42, r * 0.7);
    ctx.quadraticCurveTo(0, r * 1.05, -r * 0.42, r * 0.7);
    ctx.quadraticCurveTo(-r * 0.95, -r * 0.2, 0, -r * 1.5 + lick);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.25, r * 0.28, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === 'crawler') {
    // low and many-legged: the legs scuttle out of phase with each other
    ctx.strokeStyle = sprite.dark ?? dark;
    ctx.lineWidth = Math.max(1.5, r * 0.13);
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1;
      const k = i % 3;
      const step = Math.sin(t / 150 + i * 1.9) * r * 0.3;
      ctx.beginPath();
      ctx.moveTo(side * r * 0.35, (k - 1) * r * 0.3);
      ctx.lineTo(side * r * 1.25, (k - 1) * r * 0.3 + step);
      ctx.stroke();
    }
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.95, r * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.1, r * 0.55, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === 'floater') {
    // a bell with tendrils trailing under it
    ctx.strokeStyle = body;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = Math.max(1.2, r * 0.1);
    for (let i = 0; i < 5; i++) {
      const ox = (i - 2) * r * 0.28;
      ctx.beginPath();
      ctx.moveTo(ox, r * 0.35);
      ctx.quadraticCurveTo(ox + Math.sin(t / 300 + i) * r * 0.3, r * 1.0, ox, r * 1.55);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.95, r * 0.75, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.25, -r * 0.3, r * 0.3, r * 0.16, -0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === 'shard') {
    // a floating cluster of crystal, turning slowly
    ctx.rotate(Math.sin(t / 900) * 0.25);
    for (const [sx, sy, sc] of [[0, 0, 1], [-0.6, 0.35, 0.55], [0.62, 0.3, 0.6]]) {
      ctx.fillStyle = sc === 1 ? body : (sprite.dark ?? body);
      ctx.beginPath();
      ctx.moveTo(sx * r, sy * r - r * 1.15 * sc);
      ctx.lineTo(sx * r + r * 0.5 * sc, sy * r);
      ctx.lineTo(sx * r, sy * r + r * 0.85 * sc);
      ctx.lineTo(sx * r - r * 0.5 * sc, sy * r);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.1); ctx.lineTo(r * 0.16, 0); ctx.lineTo(0, r * 0.8); ctx.closePath();
    ctx.fill();
  } else {
    // the original: a soft body that breathes
    ctx.beginPath();
    ctx.ellipse(0, 0, r / squash, r * squash, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.35, r * 0.25, r * 0.18, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // eyes, placed to suit the body they sit in
  if (shape !== 'shard') {
    const eye = shape === 'wisp' ? { y: r * 0.15, dx: 0.26, r: 0.1 }
      : shape === 'crawler' ? { y: -r * 0.1, dx: 0.28, r: 0.1 }
        : shape === 'floater' ? { y: -r * 0.2, dx: 0.3, r: 0.1 }
          : { y: 0, dx: 0.3, r: 0.12 };
    ctx.fillStyle = shape === 'wisp' ? '#2a1206' : '#12141a';
    ctx.beginPath(); ctx.arc(-r * eye.dx, eye.y, r * eye.r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * eye.dx, eye.y, r * eye.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/**
 * One frame of an effect painted on a monster's sheet (its `_fx` strip: a
 * bolt, vines), with the effect's anchor on (x, y), turned by `angle`.
 */
export function drawMobFx(ctx, key, name, frame, x, y, { angle = 0, scale = 1, alpha = 1 } = {}) {
  const art = MOB_ART[key];
  const fx = art?.fx?.[name];
  if (!fx) return false;
  const s = sheet(`${MOB_BASE}/${key}_fx.webp`);
  if (!s.ready) return false;
  const [cw, ch] = fx.cell;
  const k = art.show * scale;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (angle) ctx.rotate(angle);
  ctx.scale(k, k);
  ctx.drawImage(s.img, Math.min(frame, fx.n - 1) * cw, fx.y, cw, ch, -fx.anchor[0], -fx.anchor[1], cw, ch);
  ctx.restore();
  return true;
}

/** Sheets worth having ready before the first frame. */
export function preloadCommon(look) {
  const urls = [
    layerUrl('body', 'light', 'male'), layerUrl('body', 'light', 'female'),
    ...Object.keys(MOB_ART).map((key) => `${MOB_BASE}/${key}.webp`),
    ...Object.keys(MOB_ART).filter((key) => MOB_ART[key].fx).map((key) => `${MOB_BASE}/${key}_fx.webp`),
  ];
  if (look) Object.values(playerLayers(look, {})).forEach((u) => urls.push(u));
  preload(urls.filter(Boolean));
}
