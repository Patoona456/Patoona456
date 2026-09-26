import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db, markDirty } from './persistence.js';
import { STARTING_STATS, JOBS } from '../shared/data/jobs.js';
import { MAPS } from '../shared/data/maps.js';

const NAME_RE = /^[A-Za-z0-9_฀-๿]{3,16}$/;
const MAX_CHARS = 4;

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') };
}

/**
 * How many accounts one address may open, and over what window.
 *
 * The point is not to stop a determined person - an address is cheap - but to
 * stop the *easy* version: a loop that opens a hundred characters to farm
 * starting Aurum, or to sit on names. Set AFO_MAX_ACCOUNTS_PER_IP=0 to
 * turn it off for a LAN game, where every player shares one address.
 */
const MAX_PER_IP = Number(process.env.AFO_MAX_ACCOUNTS_PER_IP ?? 5);
const IP_WINDOW_MS = 24 * 3600000;

export function register(name, password, ip = null) {
  name = String(name ?? '').trim();
  if (!NAME_RE.test(name)) return { error: 'ชื่อบัญชีต้องยาว 3-16 ตัว (อังกฤษ/ไทย/ตัวเลข/_)' };
  if (String(password ?? '').length < 4) return { error: 'รหัสผ่านสั้นเกินไป (อย่างน้อย 4 ตัว)' };
  const key = name.toLowerCase();
  if (db.accounts[key]) return { error: 'มีบัญชีนี้อยู่แล้ว' };

  if (MAX_PER_IP > 0 && ip) {
    const since = Date.now() - IP_WINDOW_MS;
    const recent = Object.values(db.accounts)
      .filter((a) => a.ip === ip && (a.created ?? 0) > since).length;
    if (recent >= MAX_PER_IP) {
      return { error: `สมัครจากที่อยู่นี้ครบ ${MAX_PER_IP} บัญชีแล้ว ลองใหม่พรุ่งนี้` };
    }
  }

  const { salt, hash } = hashPassword(password);
  db.accounts[key] = { name, key, salt, hash, created: Date.now(), chars: [], ip: ip ?? null };
  db.storage[key] = { items: [], aurum: 0 };
  markDirty();
  return { account: db.accounts[key] };
}

export function login(name, password) {
  const key = String(name ?? '').trim().toLowerCase();
  const acc = db.accounts[key];
  if (!acc) return { error: 'ไม่พบบัญชีนี้' };
  if (acc.banned) return { error: 'บัญชีถูกระงับ' };
  const { hash } = hashPassword(password, acc.salt);
  const a = Buffer.from(hash, 'hex'), b = Buffer.from(acc.hash, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { error: 'รหัสผ่านไม่ถูกต้อง' };
  return { account: acc };
}

export function charsOf(acc) {
  return acc.chars.map((id) => db.characters[id]).filter(Boolean).map(summary);
}

export function summary(c) {
  // what the character is wearing, so the select screen can draw them dressed
  const worn = {};
  for (const [slot, idx] of Object.entries(c.equipment ?? {})) {
    const st = c.inventory?.[idx];
    if (st) worn[slot] = st.id;
  }
  return {
    id: c.id, name: c.name, job: c.job, level: c.level, jobLevel: c.jobLevel,
    map: c.map, look: c.look, aurum: c.aurum, worn,
  };
}

export function nameTaken(name) {
  const lower = String(name).toLowerCase();
  return Object.values(db.characters).some((c) => c.name.toLowerCase() === lower);
}

export function createCharacter(acc, { name, gender, body, hair, chibiHair, hairColor, eyes, style, stats, startMap }) {
  if (acc.chars.length >= MAX_CHARS) return { error: `สร้างได้สูงสุด ${MAX_CHARS} ตัวละคร` };
  name = String(name ?? '').trim();
  if (!NAME_RE.test(name)) return { error: 'ชื่อตัวละครต้องยาว 3-16 ตัว' };
  if (nameTaken(name)) return { error: 'ชื่อนี้ถูกใช้ไปแล้ว' };

  gender = gender === 'female' ? 'female' : 'male';
  const look = {
    gender,
    body: ['light', 'tanned', 'dark', 'darkelf'].includes(body) ? body : 'light',
    hair: ['plain', 'messy', 'long', 'ponytail'].includes(hair) ? hair : 'plain',
    hairColor: ['black', 'brown', 'blonde', 'white'].includes(hairColor) ? hairColor : 'brown',
    eyes: ['blue', 'brown', 'green', 'red'].includes(eyes) ? eyes : 'brown',
  };
  // 'chibi' draws the character from assets/chibi instead of the LPC layers
  if (style === 'chibi') {
    look.style = 'chibi';
    look.chibi = 'base_male';
    look.chibiHair = chibiHair === 'bald' ? 'bald' : 'spiky';
  }

  // Optional custom start spread; must total the same 30 points.
  const base = { ...STARTING_STATS };
  if (stats && typeof stats === 'object') {
    let total = 0;
    for (const k of Object.keys(base)) {
      const v = Math.floor(Number(stats[k]));
      if (!Number.isFinite(v) || v < 1 || v > 12) { total = -1; break; }
      total += v;
    }
    if (total === 30) for (const k of Object.keys(base)) base[k] = Math.floor(Number(stats[k]));
  }

  // Starting location: Artaris, the one town there is
  const validStarts = ['artaris'];
  const mapId = validStarts.includes(startMap) ? startMap : 'artaris';
  const start = MAPS[mapId];
  const id = String(db.nextCharId++);
  const c = {
    id, account: acc.key, name, look,
    job: 'novice', level: 1, jobLevel: 1, exp: 0, jobExp: 0,
    statPoints: 0, skillPoints: 1,
    ...base,
    hp: null, sp: null,           // filled from derived stats on first spawn
    map: mapId, x: start.spawnPoint[0] * 32, y: start.spawnPoint[1] * 32,
    savePoint: { map: mapId, x: start.spawnPoint[0] * 32, y: start.spawnPoint[1] * 32 },
    aurum: 500,                   // a deliberately thin starting purse
    // a practice sword in hand and a few bottles; armour waits on its sheet
    inventory: [{ id: 'wooden_sword', qty: 1, refine: 0, dur: 120 }, { id: 'hp_potion_s', qty: 5 }],
    equipment: { weapon: 0 },
    skills: {},
    hotbar: [null, null, null, null, null, 'first_aid'],   // 1-4 are for attacks
    quests: {},
    playtime: 0, created: Date.now(), lastSeen: Date.now(),
    npcSales: {},                 // itemId -> count sold today (price dampener)
    salesDay: 0,
    lockouts: {},                 // bossId -> the week its hoard was claimed
    guild: null,                  // guild id, or null
  };
  db.characters[id] = c;
  acc.chars.push(id);
  markDirty();
  return { character: c };
}

export function deleteCharacter(acc, charId) {
  const idx = acc.chars.indexOf(String(charId));
  if (idx < 0) return { error: 'ไม่พบตัวละคร' };
  acc.chars.splice(idx, 1);
  delete db.characters[String(charId)];
  markDirty();
  return { ok: true };
}

export function jobLabel(id) { return JOBS[id]?.nameTh ?? id; }
