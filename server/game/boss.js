// Scripted boss fights.
//
// Every other monster in the game runs the same loop: walk at the nearest
// player, swing, occasionally roll a random skill. That is fine for a
// wandering ghoul and hopeless for a fight meant to need four people, because
// nothing in it can be *learned* - a random skill roll is not a mechanic, it
// is weather.
//
// A scripted boss instead does things in an order, warns before the ones that
// hurt, and asks for something a single body cannot provide. The Warden's
// three demands:
//
//   Judgement  - a ring on the floor, telegraphed for a beat before it fires.
//                Solvable alone; it just teaches people to read the floor.
//   Anchors    - two Grave Anchors that pour the boss's health back while
//                they live. One person cannot out-damage two healers and the
//                boss at once, so somebody has to peel off and break them.
//   Collapse   - rings centred on the boss that leave only the outer floor
//                safe, so the party has to be spread when it lands.
//
// Telegraphs go out as `warn` events, which the client draws as a mark that
// fills up. The damage is applied here when the timer expires: the client is
// never trusted with whether anyone dodged.
import { applyDamage, healEntity, statusMods } from './combat.js';
import { dist, dist2 } from './monster.js';

const SCRIPTS = {};

/** ms between the warning appearing and the floor erupting. */
const TELL = 1300;

/**
 * Mark a patch of floor. `fire` runs when the timer expires, with the list of
 * players still standing in it.
 */
function telegraph(zone, m, { x, y, r, el = 'radiant', delay = TELL, label = null, fire }) {
  zone.pushEvent({ t: 'warn', x: Math.round(x), y: Math.round(y), r: Math.round(r), el, ms: delay, label });
  m.pending.push({ at: Date.now() + delay, x, y, r, fire });
}

/** Players inside a circle, alive and visible. */
function inside(zone, x, y, r) {
  const out = [];
  for (const p of zone.players.values()) {
    if (!p.alive) continue;
    if (dist2(p, { x, y }) <= r * r) out.push(p);
  }
  return out;
}

SCRIPTS.warden = (zone, m, t) => {
  const pct = m.hp / m.maxHp;
  const target = m.target ? zone.entities.get(m.target) : null;

  // ---- phase changes, announced so the room can react ----
  const phase = pct > 0.66 ? 1 : pct > 0.3 ? 2 : 3;
  if (phase !== m.phase) {
    m.phase = phase;
    m.nextMechanicAt = t + 1200;
    if (phase === 2) {
      // two anchors, placed on opposite sides: nobody can cover both alone
      m.anchors = [];
      for (const [dx, dy] of [[-150, -110], [150, 110]]) {
        const pos = zone.nearestWalkable
          ? zone.nearestWalkable(m.x + dx, m.y + dy)
          : { x: m.x + dx, y: m.y + dy };
        const a = zone.spawnMonster('reliquary_anchor', pos.x, pos.y, {});
        a.wardenAnchor = m.id;
        m.anchors.push(a.id);
      }
      zone.pushEvent({ t: 'boss', id: m.id, say: 'ผู้เฝ้าหีบศพเรียกสมอหลุมศพขึ้นมา — ทำลายมันก่อน!' });
    }
    if (phase === 3) {
      m.mods.atkPct = (m.mods.atkPct ?? 0) + 25;
      zone.pushEvent({ t: 'boss', id: m.id, say: 'ผู้เฝ้าหีบศพเริ่มคลั่ง — ห้องกำลังถล่ม!' });
    }
  }

  // ---- anchors heal the boss while they stand ----
  if (m.anchors?.length && t >= (m.nextAnchorTickAt ?? 0)) {
    m.nextAnchorTickAt = t + 1000;
    const alive = m.anchors.filter((id) => zone.entities.get(id)?.alive);
    if (alive.length) {
      healEntity(zone, m, Math.floor(m.maxHp * 0.012 * alive.length));
      for (const id of alive) {
        const a = zone.entities.get(id);
        zone.pushEvent({ t: 'fx', fx: 'line', el: 'verdant', x: a.x, y: a.y - 20, tx: m.x, ty: m.y - 20 });
      }
    } else if (m.anchors.length) {
      m.anchors = [];
      zone.pushEvent({ t: 'boss', id: m.id, say: 'สมอหลุมศพแตกหมดแล้ว!' });
    }
  }

  // ---- resolve anything whose timer has run out ----
  const now = Date.now();
  for (let i = m.pending.length - 1; i >= 0; i--) {
    const q = m.pending[i];
    if (now < q.at) continue;
    m.pending.splice(i, 1);
    q.fire(inside(zone, q.x, q.y, q.r));
  }

  if (!target || t < (m.nextMechanicAt ?? 0)) return;

  // ---- pick the next mechanic ----
  if (m.phase === 3 && (m.mechCount ?? 0) % 2 === 1) {
    // Collapse: the middle becomes lethal, the rim does not
    m.mechCount = (m.mechCount ?? 0) + 1;
    m.nextMechanicAt = t + 9000;
    zone.pushEvent({ t: 'boss', id: m.id, say: 'กระจายตัว!' });
    for (const [r, delay] of [[130, TELL], [230, TELL + 700]]) {
      telegraph(zone, m, {
        x: m.x, y: m.y, r, el: 'ember', delay, label: 'ถอยออกไป',
        fire: (hit) => {
          zone.pushEvent({ t: 'fx', fx: 'nova', el: 'ember', x: m.x, y: m.y, r });
          for (const p of hit) applyDamage(zone, m, p, Math.floor(m.derived.atk * 3.2), { element: 'ember', magic: true });
        },
      });
    }
    return;
  }

  // Judgement: a ring under somebody, anywhere in the room
  m.mechCount = (m.mechCount ?? 0) + 1;
  m.nextMechanicAt = t + (m.phase === 1 ? 7000 : 5200);
  const pick = [...zone.players.values()].filter((p) => p.alive && !statusMods(p).invisible);
  if (!pick.length) return;
  const on = pick[Math.floor(Math.random() * pick.length)];
  telegraph(zone, m, {
    x: on.x, y: on.y, r: 96, el: 'radiant', label: 'หลบ!',
    fire: (hit) => {
      zone.pushEvent({ t: 'fx', fx: 'aoe', el: 'radiant', x: on.x, y: on.y, r: 96 });
      for (const p of hit) applyDamage(zone, m, p, Math.floor(m.derived.atk * 2.4), { element: 'radiant', magic: true });
    },
  });
};

/** Called once per tick for every living monster that declares a script. */
export function tickBoss(zone, m, t) {
  const fn = SCRIPTS[m.def.script];
  if (!fn) return;
  m.pending ??= [];
  fn(zone, m, t);
}

/** A boss reset (leash) must take its summoned help with it. */
export function resetBoss(zone, m) {
  for (const id of m.anchors ?? []) zone.entities.delete(id);
  m.anchors = [];
  m.pending = [];
  m.phase = null;
  m.mechCount = 0;
  if (m.mods) m.mods.atkPct = 0;
  void dist;
}
