// Quest tracking. State lives on the character record: { [id]: { step, counts, done, at } }
import { QUESTS } from '../../shared/data/quests.js';
import { ITEMS } from '../../shared/data/items.js';
import { JOBS } from '../../shared/data/jobs.js';
import { markDirty } from '../persistence.js';
import { mint } from './economy.js';

/** How long a repeatable quest stays on cooldown after it is handed in. */
const REPEAT_MS = { daily: 20 * 3600000, weekly: 7 * 86400000 };

export function available(p) {
  return Object.values(QUESTS).filter((q) => {
    const st = p.record.quests[q.id];
    if (st?.done && !q.repeatable) return false;
    if (st?.done && q.repeatable && Date.now() - st.at < REPEAT_MS[q.repeatable]) return false;
    // a path's trial is only on offer while that path is still open to you
    if (q.path && !(JOBS[p.record.job]?.next ?? []).includes(q.path)) return false;
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
    if (o.type === 'level') return { have: p.record.level, need: o.count };
    if (o.type === 'refine') return { have: st?.counts?.[i] ?? bestRefine(p), need: o.count };
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
  if (st?.done && q.repeatable && Date.now() - st.at < REPEAT_MS[q.repeatable]) {
    const left = Math.ceil((REPEAT_MS[q.repeatable] - (Date.now() - st.at)) / 3600000);
    return { error: `ภารกิจนี้ยังไม่รีเซ็ต (อีก ~${left} ชั่วโมง)` };
  }
  p.record.quests[id] = { counts: {}, done: false, at: Date.now() };
  markDirty();
  return { ok: true };
}

/** The highest refine the player is actually carrying right now. */
function bestRefine(p) {
  let best = 0;
  for (const st of p.inventory) if ((st.refine ?? 0) > best) best = st.refine;
  return best;
}

export function onKill(p, mobId) {
  for (const [id, st] of Object.entries(p.record.quests)) {
    if (st.done) continue;
    const q = QUESTS[id];
    if (!q) continue;
    q.objectives.forEach((o, i) => {
      if (o.type === 'kill' && o.mob === mobId) {
        const before = st.counts[i] ?? 0;
        st.counts[i] = Math.min(o.count, before + 1);
        if (st.counts[i] !== before) p.questsDirty = true;   // the tracker refreshes
      }
    });
  }
  markDirty();
}

/** Only the quests the player has taken and not finished, for the HUD tracker. */
export function tracked(p) {
  return Object.entries(p.record.quests)
    .filter(([id, st]) => !st.done && QUESTS[id])
    .map(([id]) => {
      const q = QUESTS[id];
      const progress = progressOf(p, q);
      return {
        id, name: q.name, kind: q.repeatable ? 'event' : (q.giver === 'trainer' ? 'main' : 'sub'),
        progress,
        // the client's auto-walk needs to know what and where, not just how far
        objectives: q.objectives,
        giver: q.giver, zone: q.zone ?? null, desc: q.desc,
        done: progress.every((x) => x.have >= x.need),
      };
    });
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
  if (r.skillPoints) p.record.skillPoints += r.skillPoints;
  if (r.aurum) { p.record.aurum += r.aurum; mint(world, r.aurum, 'quest'); }
  for (const it of r.items ?? []) p.addItem(it.id, it.qty);
  st.done = true;
  st.counts = {};
  st.at = Date.now();
  markDirty();
  return { ok: true, rewards: r, itemNames: (r.items ?? []).map((i) => ITEMS[i.id]?.nameTh) };
}
