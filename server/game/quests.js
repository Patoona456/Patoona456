// Quest tracking. State lives on the character record: { [id]: { step, counts, done, at } }
import { QUESTS } from '../../shared/data/quests.js';
import { ITEMS } from '../../shared/data/items.js';
import { markDirty } from '../persistence.js';

export function available(p) {
  return Object.values(QUESTS).filter((q) => {
    const st = p.record.quests[q.id];
    if (st?.done && !q.repeatable) return false;
    if (st?.done && q.repeatable === 'weekly' && Date.now() - st.at < 7 * 86400000) return false;
    return p.record.level >= (q.minLevel ?? 1);
  }).map((q) => ({
    ...q,
    state: p.record.quests[q.id] ?? null,
    progress: progressOf(p, q),
  }));
}

function progressOf(p, q) {
  const st = p.record.quests[q.id];
  return q.objectives.map((o, i) => {
    if (o.type === 'collect') return { have: p.countItem(o.item), need: o.count };
    if (o.type === 'jobLevel') return { have: p.record.jobLevel, need: o.count };
    return { have: st?.counts?.[i] ?? 0, need: o.count };
  });
}

export function accept(p, id) {
  const q = QUESTS[id];
  if (!q) return { error: 'ไม่พบภารกิจ' };
  if (p.record.level < (q.minLevel ?? 1)) return { error: `ต้องเลเวล ${q.minLevel}` };
  const st = p.record.quests[id];
  if (st && !st.done) return { error: 'รับภารกิจนี้ไปแล้ว' };
  if (st?.done && !q.repeatable) return { error: 'ทำภารกิจนี้ไปแล้ว' };
  p.record.quests[id] = { counts: {}, done: false, at: Date.now() };
  markDirty();
  return { ok: true };
}

export function onKill(p, mobId) {
  for (const [id, st] of Object.entries(p.record.quests)) {
    if (st.done) continue;
    const q = QUESTS[id];
    if (!q) continue;
    q.objectives.forEach((o, i) => {
      if (o.type === 'kill' && o.mob === mobId) {
        st.counts[i] = Math.min(o.count, (st.counts[i] ?? 0) + 1);
      }
    });
  }
  markDirty();
}

export function complete(world, p, id) {
  const q = QUESTS[id];
  const st = p.record.quests[id];
  if (!q || !st || st.done) return { error: 'ยังไม่ได้รับภารกิจนี้' };
  const prog = progressOf(p, q);
  if (prog.some((x) => x.have < x.need)) return { error: 'ภารกิจยังไม่เสร็จ' };

  // consume collect objectives
  for (const o of q.objectives) if (o.type === 'collect') p.removeItemById(o.item, o.count);

  const r = q.rewards ?? {};
  p.gainExp(r.exp ?? 0, r.jobExp ?? 0, p.zone);
  if (r.aurum) { p.record.aurum += r.aurum; world.stats.minted += r.aurum; }
  for (const it of r.items ?? []) p.addItem(it.id, it.qty);
  st.done = true;
  st.counts = {};
  st.at = Date.now();
  markDirty();
  return { ok: true, rewards: r, itemNames: (r.items ?? []).map((i) => ITEMS[i.id]?.nameTh) };
}
