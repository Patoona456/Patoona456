// The game master's tools: spawn any item, set a level, top up aurum, warp.
//
// Only an admin account may use them. An account is an admin when its name is
// in AFO_ADMINS (comma-separated), or when someone logged into it has
// typed `/admin <AFO_ADMIN_TOKEN>` in chat; `/admin off` gives it back.
// With neither variable set nobody is an admin, which is the safe default.
// Everything here goes through the same inventory and warp code as play does,
// and aurum an admin creates is counted as minted, so the economy dashboard
// still reconciles.
import { ITEMS, isEquip } from '../../shared/data/items.js';
import { MAPS } from '../../shared/data/maps.js';
import { TILE } from '../../shared/constants.js';
import { MAX_REFINE } from '../../shared/refineglow.js';
import { mint } from './economy.js';

const env = (k) => (globalThis.process?.env?.[k] ?? '');

/** Is this account a game master? */
export function isAdmin(account) {
  if (!account) return false;
  if (account.admin === true) return true;
  const list = env('AFO_ADMINS').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(account.key ?? String(account.name ?? '').toLowerCase());
}

/** `/admin <token>`: true when the token is right. Constant-time-ish compare. */
export function tokenOk(given) {
  const token = env('AFO_ADMIN_TOKEN');
  if (!token || typeof given !== 'string' || given.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

const MAX_LEVEL = 99;

/**
 * One admin command. `m.op` is what to do:
 *   give  { id, qty, refine }   any item, any amount (equipment one row each)
 *   level { level }             base level, with stat points to spend
 *   aurum { amount }            add (or, negative, take) aurum
 *   heal                        full HP and SP
 *   warp  { map }               to a map's arrival point
 */
export function gmCommand(world, p, m) {
  switch (m.op) {
    case 'give': {
      const def = ITEMS[m.id];
      if (!def) return { error: 'ไม่พบไอเทมนี้' };
      const equip = isEquip(def);
      const qty = Math.max(1, Math.min(equip ? 20 : 9999, m.qty | 0 || 1));
      const refine = def.refinable ? Math.max(0, Math.min(MAX_REFINE, m.refine | 0)) : 0;
      // (an admin is not held to the weight limit; the bag still has 100 rows)
      if (!p.addItem(def.id, qty, { ...(equip ? { refine } : {}), force: true })) return { error: 'กระเป๋าเต็ม' };
      return { ok: true, notice: `เสก ${def.nameTh ?? def.name}${refine ? ` +${refine}` : ''} x${qty}` };
    }
    case 'level': {
      const lv = Math.max(1, Math.min(MAX_LEVEL, m.level | 0));
      const r = p.record;
      const gained = lv - r.level;
      r.level = lv;
      r.exp = 0;
      if (gained > 0) r.statPoints = (r.statPoints ?? 0) + gained * 5;
      p.recompute();
      p.hp = p.maxHp; p.sp = p.maxSp;
      return { ok: true, notice: `ตั้งเลเวลเป็น ${lv}` };
    }
    case 'aurum': {
      const amount = Math.max(-1e9, Math.min(1e9, Math.trunc(Number(m.amount) || 0)));
      const r = p.record;
      const next = Math.max(0, r.aurum + amount);
      if (next > r.aurum) mint(world, next - r.aurum, 'gm');
      r.aurum = next;
      return { ok: true, notice: `ออรัม ${amount >= 0 ? '+' : ''}${amount.toLocaleString()}` };
    }
    case 'heal':
      p.hp = p.maxHp; p.sp = p.maxSp;
      return { ok: true, notice: 'ฟื้น HP/SP เต็ม' };
    case 'warp': {
      const map = MAPS[m.map];
      if (!map) return { error: 'ไม่พบแผนที่' };
      const [tx, ty] = map.spawnPoint;
      world.warpPlayer(p, m.map, tx * TILE, ty * TILE);
      return { ok: true };
    }
    default:
      return { error: 'ไม่รู้จักคำสั่ง' };
  }
}
