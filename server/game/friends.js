// Friends, whispers and blocking.
//
// A friend list is written on each character (record.friends, by character
// id) so it survives restarts and both sides always agree: adding and
// removing touch both records together. A request only lives on the online
// target's session - it is a knock on the door, not a letter.
//
// Blocking is one-sided and quiet: the blocked player's say/whisper lines,
// party invites, friend requests and trade requests never reach you, and
// they are simply told the player is not accepting.
import { db, markDirty } from '../persistence.js';

export const MAX_FRIENDS = 50;
const REQUEST_MS = 120000;

const friendsOf = (rec) => (rec.friends ??= []);
const blockedOf = (rec) => (rec.blocked ??= []);
const cid = (p) => String(p.record.id);

/** Does `p` refuse everything from `from`? */
export function blocks(p, from) {
  return !!from && blockedOf(p.record).includes(cid(from));
}

export function request(world, p, name) {
  const target = world.playerByName(String(name ?? ''));
  if (!target) return { error: 'ไม่พบผู้เล่นคนนี้ (ต้องออนไลน์อยู่)' };
  if (target === p) return { error: 'เพิ่มตัวเองเป็นเพื่อนไม่ได้' };
  if (friendsOf(p.record).includes(cid(target))) return { error: 'เป็นเพื่อนกันอยู่แล้ว' };
  if (friendsOf(p.record).length >= MAX_FRIENDS) return { error: `รายชื่อเพื่อนเต็ม (${MAX_FRIENDS})` };
  if (blockedOf(p.record).includes(cid(target))) return { error: 'ปลดบล็อกผู้เล่นคนนี้ก่อน' };
  if (blocks(target, p)) return { error: 'ผู้เล่นไม่รับคำขอเป็นเพื่อน' };
  target.friendRequests = (target.friendRequests ?? []).filter((r) => r.charId !== cid(p) && Date.now() - r.at < REQUEST_MS);
  target.friendRequests.push({ charId: cid(p), from: p.name, level: p.record.level, at: Date.now() });
  target.conn?.send(state(world, target));
  return { ok: true, name: target.name };
}

export function accept(world, p, charId) {
  const req = (p.friendRequests ?? []).find((r) => r.charId === String(charId) && Date.now() - r.at < REQUEST_MS);
  if (!req) return { error: 'คำขอหมดอายุแล้ว' };
  p.friendRequests = p.friendRequests.filter((r) => r !== req);
  const other = db.characters[req.charId];
  if (!other) return { error: 'ไม่พบผู้เล่น' };
  if (friendsOf(p.record).length >= MAX_FRIENDS || friendsOf(other).length >= MAX_FRIENDS) return { error: 'รายชื่อเพื่อนเต็ม' };
  if (!friendsOf(p.record).includes(req.charId)) friendsOf(p.record).push(req.charId);
  if (!friendsOf(other).includes(cid(p))) friendsOf(other).push(cid(p));
  markDirty();
  return { ok: true, name: other.name, charId: req.charId };
}

export function decline(p, charId) {
  p.friendRequests = (p.friendRequests ?? []).filter((r) => r.charId !== String(charId));
  return { ok: true };
}

export function remove(p, charId) {
  charId = String(charId);
  const rec = p.record;
  rec.friends = friendsOf(rec).filter((c) => c !== charId);
  const other = db.characters[charId];
  if (other) other.friends = friendsOf(other).filter((c) => c !== cid(p));
  markDirty();
  return { ok: true };
}

export function block(world, p, name) {
  const target = world.playerByName(String(name ?? ''))
    ?? Object.values(db.characters).find((c) => c.name.toLowerCase() === String(name ?? '').toLowerCase());
  const targetId = target ? String(target.record?.id ?? target.id) : null;
  if (!targetId || !db.characters[targetId]) return { error: 'ไม่พบผู้เล่นคนนี้' };
  if (targetId === cid(p)) return { error: 'บล็อกตัวเองไม่ได้' };
  remove(p, targetId);
  if (!blockedOf(p.record).includes(targetId)) blockedOf(p.record).push(targetId);
  p.friendRequests = (p.friendRequests ?? []).filter((r) => r.charId !== targetId);
  markDirty();
  return { ok: true, name: db.characters[targetId].name };
}

export function unblock(p, charId) {
  p.record.blocked = blockedOf(p.record).filter((c) => c !== String(charId));
  markDirty();
  return { ok: true };
}

/** A whisper: only to someone online who has not blocked you. */
export function whisper(world, p, name, text) {
  const target = world.playerByName(String(name ?? ''));
  if (!target) return { error: `${name} ไม่ได้ออนไลน์` };
  if (target === p) return { error: 'กระซิบหาตัวเองไม่ได้' };
  if (blocks(target, p)) return { error: 'ผู้เล่นไม่รับข้อความ' };
  const ts = Date.now();
  target.conn?.send({ t: 'chatMsg', ch: 'whisper', from: p.name, text, ts });
  p.conn?.send({ t: 'chatMsg', ch: 'whisper', from: p.name, to: target.name, text, ts });
  return { ok: true };
}

export function state(world, p) {
  const row = (charId) => {
    const on = world.playerByCharId(charId);
    const rec = db.characters[charId];
    if (!rec) return null;
    return {
      charId, name: rec.name, level: on ? on.record.level : rec.level, job: rec.job,
      online: !!on, map: on ? on.record.map : null, lastSeen: rec.lastSeen ?? null,
      party: on ? !!on.party : false,
    };
  };
  const now = Date.now();
  return {
    t: 'friendState',
    friends: friendsOf(p.record).map(row).filter(Boolean)
      .sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name)),
    blocked: blockedOf(p.record).map((c) => ({ charId: c, name: db.characters[c]?.name ?? '?' })),
    requests: (p.friendRequests ?? []).filter((r) => now - r.at < REQUEST_MS),
  };
}
