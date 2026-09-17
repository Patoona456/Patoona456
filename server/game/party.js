// Parties are in-memory only: they last for the session, like a dungeon group.
let seq = 0;
export const parties = new Map();   // id -> { id, name, leader, members:Set<charId> }

export function create(p, name) {
  if (p.party) return { error: 'อยู่ในปาร์ตี้แล้ว' };
  const id = 'pt' + (++seq);
  parties.set(id, { id, name: name || `${p.name}'s party`, leader: p.record.id, members: new Set([p.record.id]) });
  p.party = id;
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
  const pt = parties.get(p.party);
  if (pt.members.size >= 6) return { error: 'ปาร์ตี้เต็ม (6 คน)' };
  target.pendingInvite = { party: p.party, from: p.name, at: Date.now() };
  target.conn?.send({ t: 'notice', kind: 'invite', text: `${p.name} ชวนคุณเข้าปาร์ตี้ (ตอบรับในเมนูปาร์ตี้)` , party: p.party });
  return { ok: true };
}

export function accept(world, p) {
  const inv = p.pendingInvite;
  if (!inv || Date.now() - inv.at > 60000) return { error: 'ไม่มีคำเชิญค้างอยู่' };
  const pt = parties.get(inv.party);
  if (!pt) return { error: 'ปาร์ตี้ถูกยุบไปแล้ว' };
  if (pt.members.size >= 6) return { error: 'ปาร์ตี้เต็ม' };
  pt.members.add(p.record.id);
  p.party = pt.id;
  p.pendingInvite = null;
  return { ok: true, id: pt.id };
}

export function leave(world, p) {
  const pt = parties.get(p.party);
  p.party = null;
  if (!pt) return { ok: true };
  pt.members.delete(p.record.id);
  if (pt.leader === p.record.id) {
    const next = [...pt.members][0];
    if (next) pt.leader = next; else parties.delete(pt.id);
  }
  return { ok: true };
}

export function state(world, p) {
  const pt = parties.get(p.party);
  if (!pt) return { t: 'partyState', party: null, invite: p.pendingInvite ?? null };
  const members = [...pt.members].map((cid) => {
    const m = world.playerByCharId(cid);
    return m ? {
      charId: cid, id: m.id, name: m.name, level: m.record.level, job: m.record.job,
      hp: m.hp, maxHp: m.maxHp, sp: m.sp, maxSp: m.maxSp, map: m.record.map,
      x: Math.round(m.x), y: Math.round(m.y), online: true,
    } : { charId: cid, name: '(ออฟไลน์)', online: false };
  });
  return { t: 'partyState', party: { id: pt.id, name: pt.name, leader: pt.leader, members }, invite: p.pendingInvite ?? null };
}
