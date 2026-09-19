// Parties: the grouping you make for one evening's work.
//
// A guild is the durable social unit (see guild.js); a party is the six
// people standing in the same dungeon right now. It used to live entirely in
// a Map, which meant a deploy dissolved every group on the server mid-run.
// Now it is written to the database like everything else, and instead of
// vanishing on restart it is pruned when nobody in it has been seen for a
// while - which is the behaviour people actually expect.
import { db, markDirty } from '../persistence.js';

const MAX_MEMBERS = 6;
/** A party nobody has touched for this long is over. */
const STALE_MS = 12 * 3600000;

const parties = () => (db.parties ??= {});
const get = (id) => (id ? parties()[String(id)] ?? null : null);

function touch(pt) {
  pt.seen = Date.now();
  markDirty();
}

export function create(p, name) {
  if (p.party) return { error: 'อยู่ในปาร์ตี้แล้ว' };
  const id = 'pt' + (db.nextPartyId = (db.nextPartyId ?? 0) + 1);
  parties()[id] = {
    id, name: String(name || `ปาร์ตี้ของ${p.name}`).slice(0, 24),
    leader: String(p.record.id), members: [String(p.record.id)], seen: Date.now(),
  };
  p.party = id;
  markDirty();
  return { ok: true, id };
}

export function invite(world, p, targetName) {
  if (!p.party) {
    const r = create(p);
    if (r.error) return r;
  }
  const target = world.playerByName(targetName);
  if (!target) return { error: 'ไม่พบผู้เล่นคนนี้' };
  if (target.party) return { error: 'ผู้เล่นอยู่ในปาร์ตี้อื่นแล้ว' };
  const pt = get(p.party);
  if (!pt) return { error: 'ปาร์ตี้ถูกยุบไปแล้ว' };
  if (pt.members.length >= MAX_MEMBERS) return { error: `ปาร์ตี้เต็ม (${MAX_MEMBERS} คน)` };
  target.pendingInvite = { party: p.party, from: p.name, at: Date.now() };
  target.conn?.send({ t: 'notice', kind: 'invite', text: `${p.name} ชวนคุณเข้าปาร์ตี้ (ตอบรับในเมนูปาร์ตี้)`, party: p.party });
  return { ok: true };
}

export function accept(world, p) {
  const inv = p.pendingInvite;
  if (!inv || Date.now() - inv.at > 60000) return { error: 'ไม่มีคำเชิญค้างอยู่' };
  if (p.party) return { error: 'อยู่ในปาร์ตี้แล้ว' };
  const pt = get(inv.party);
  if (!pt) return { error: 'ปาร์ตี้ถูกยุบไปแล้ว' };
  if (pt.members.length >= MAX_MEMBERS) return { error: 'ปาร์ตี้เต็ม' };
  if (!pt.members.includes(String(p.record.id))) pt.members.push(String(p.record.id));
  p.party = pt.id;
  p.pendingInvite = null;
  touch(pt);
  return { ok: true, id: pt.id };
}

export function leave(world, p) {
  const pt = get(p.party);
  p.party = null;
  if (!pt) { markDirty(); return { ok: true }; }
  pt.members = pt.members.filter((cid) => cid !== String(p.record.id));
  if (!pt.members.length) delete parties()[pt.id];
  else if (String(pt.leader) === String(p.record.id)) pt.leader = pt.members[0];
  markDirty();
  return { ok: true };
}

/**
 * Drop parties nobody has touched in half a day, and any member whose
 * character no longer exists. Called on boot and on the world's slow timer.
 */
export function sweep(now = Date.now()) {
  let dropped = 0;
  for (const pt of Object.values(parties())) {
    pt.members = (pt.members ?? []).filter((cid) => db.characters[String(cid)]);
    if (!pt.members.length || now - (pt.seen ?? 0) > STALE_MS) {
      for (const cid of pt.members) {
        const rec = db.characters[String(cid)];
        if (rec?.party === pt.id) rec.party = null;
      }
      delete parties()[pt.id];
      dropped++;
      continue;
    }
    if (!pt.members.includes(String(pt.leader))) pt.leader = pt.members[0];
  }
  if (dropped) markDirty();
  return dropped;
}

export function state(world, p) {
  const pt = get(p.party);
  if (!pt) return { t: 'partyState', party: null, invite: p.pendingInvite ?? null };
  touch(pt);
  const members = pt.members.map((cid) => {
    const m = world.playerByCharId(String(cid));
    if (m) {
      return {
        charId: cid, id: m.id, name: m.name, level: m.record.level, job: m.record.job,
        hp: m.hp, maxHp: m.maxHp, sp: m.sp, maxSp: m.maxSp, map: m.record.map,
        x: Math.round(m.x), y: Math.round(m.y), online: true,
      };
    }
    const rec = db.characters[String(cid)];
    return { charId: cid, name: rec?.name ?? '(ออฟไลน์)', level: rec?.level ?? 1, online: false };
  });
  return { t: 'partyState', party: { id: pt.id, name: pt.name, leader: pt.leader, members }, invite: p.pendingInvite ?? null };
}
