// LPC sheet loading + paper-doll composition.
// Every sheet is 13x21 frames of 64x64; see assets/lpc/CREDITS.md.
import { SPRITE, ANIM, SHEET_COLS } from '../../shared/constants.js';
import { ITEMS } from '../../shared/data/items.js';

const BASE = '/assets/lpc';
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

export function preload(urls) { for (const u of urls) sheet(u); }

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
    default: return `${BASE}/${layer}/${gender}/${key}.png`;
  }
}
const WEAPON_EITHER = new Set(['bow', 'recurvebow', 'greatbow', 'longspear', 'arrow']);
// Keys the imported asset set only ships for one gender. The sheet we have
// for these is the female one, so a male character falls back to the item's
// `fallback` key rather than asking for a file that is not there.
const MALE_MISSING = new Set(['steelwand']);

/** Draw order, back to front. */
const ORDER = ['body', 'eyes', 'legs', 'feet', 'torso', 'belt', 'hands', 'head', 'hair', 'weapon', 'offhand'];

/** Build the layer list for a player-shaped entity. */
export function playerLayers(look, equipment = {}) {
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
    layers[def.sprite.layer] = url;
  }
  // a hat hides hair
  if (layers.head) delete layers.hair;
  return layers;
}

/** Layers for an NPC, whose look uses raw layer keys rather than item ids. */
export function npcLayers(look) {
  if (!look) return null;
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
export function frameOf(animName, elapsedMs, looping = true) {
  const a = ANIM[animName] ?? ANIM.idle;
  const frame = Math.floor((elapsedMs / 1000) * a.fps);
  if (a.frames <= 1) return 0;
  return looping ? frame % a.frames : Math.min(frame, a.frames - 1);
}

export function rowOf(animName, dir) {
  const a = ANIM[animName] ?? ANIM.idle;
  return a.single ? a.row : a.row + (dir & 3);
}

/** These play once and hold their last frame; the server hands back to idle. */
const ONE_SHOT = new Set(['hurt', 'slash', 'thrust', 'shoot']);

// A 64x64 scratch buffer for tinting a single layer (see drawRefineGlow).
let scratch = null;
function scratchCtx() {
  if (!scratch) {
    scratch = document.createElement('canvas');
    scratch.width = SPRITE; scratch.height = SPRITE;
  }
  return scratch.getContext('2d');
}

/**
 * Light coming off a refined weapon: the weapon layer, tinted and drawn
 * again additively - so the glow follows the swing frame by frame instead
 * of floating next to the character.
 */
export function drawRefineGlow(ctx, layers, { x, y, anim = 'idle', dir = 2, elapsed = 0,
  scale = 1, color = '#ffffff', alpha = 0.5, blur = 0 } = {}) {
  const url = layers?.weapon;
  if (!url) return false;
  const s = sheet(url);
  if (!s.ready) return false;

  const col = frameOf(anim, elapsed, !ONE_SHOT.has(anim));
  const row = rowOf(anim, dir);
  const g = scratchCtx();
  g.clearRect(0, 0, SPRITE, SPRITE);
  g.drawImage(s.img, col * SPRITE, row * SPRITE, SPRITE, SPRITE, 0, 0, SPRITE, SPRITE);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = color;
  g.fillRect(0, 0, SPRITE, SPRITE);
  g.globalCompositeOperation = 'source-over';

  const size = SPRITE * scale;
  const dx = Math.round(x - size / 2), dy = Math.round(y - size + size * 0.18);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  if (blur) ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(scratch, dx, dy, size, size);
  ctx.restore();
  return true;
}

/**
 * Draw one composed character.
 * @param ctx canvas 2d context
 * @param layers map of layer -> url (from playerLayers/monsterLayers)
 */
export function drawCharacter(ctx, layers, { x, y, anim = 'idle', dir = 2, elapsed = 0, scale = 1, alpha = 1, tint = null, flash = 0 }) {
  const col = frameOf(anim, elapsed, !ONE_SHOT.has(anim));
  const row = rowOf(anim, dir);
  const sx = col * SPRITE, sy = row * SPRITE;
  const size = SPRITE * scale;
  const dx = Math.round(x - size / 2), dy = Math.round(y - size + size * 0.18);

  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;
  for (const layer of ORDER) {
    const url = layers[layer];
    if (!url) continue;
    const s = sheet(url);
    if (!s.ready) continue;
    ctx.drawImage(s.img, sx, sy, SPRITE, SPRITE, dx, dy, size, size);
  }
  if (tint || flash) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = flash ? flash * 0.6 : 0.35;
    ctx.fillStyle = flash ? '#ffffff' : tint;
    ctx.fillRect(dx, dy, size, size);
  }
  ctx.restore();
  return { dx, dy, size };
}

/** Procedural blob monster (slimes, wisps, wolves) - no art required. */
export function drawBlob(ctx, sprite, { x, y, t, hurt = 0, scale = 1 }) {
  const r = 16 * (sprite.scale ?? 1) * scale;
  const bob = sprite.float ? Math.sin(t / 380) * 5 : Math.abs(Math.sin(t / 260)) * 2;
  const squash = 1 + Math.sin(t / 240) * 0.08;
  ctx.save();
  ctx.translate(x, y - r * 0.6 - bob);

  // shadow
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

  ctx.fillStyle = hurt ? '#ffffff' : sprite.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, r / squash, r * squash, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.35, r * 0.25, r * 0.18, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // eyes
  ctx.fillStyle = '#12141a';
  ctx.beginPath(); ctx.arc(-r * 0.3, 0, r * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Sheets worth having ready before the first frame. */
export function preloadCommon(look) {
  const urls = [
    layerUrl('body', 'light', 'male'), layerUrl('body', 'light', 'female'),
    layerUrl('mob', 'skeleton'), layerUrl('mob', 'ghoul'), layerUrl('mob', 'orc'), layerUrl('mob', 'red_orc'),
  ];
  if (look) Object.values(playerLayers(look, {})).forEach((u) => urls.push(u));
  preload(urls.filter(Boolean));
}
