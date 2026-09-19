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
import { applyDamage, healEntity, statusMods, addStatus } from './combat.js';
import { dist, dist2 } from './monster.js';

const SCRIPTS = {};

/** ms between the warning appearing and the floor erupting. */
const TELL = 1300;

/**
 * Mark a patch of floor. `fire` runs when the timer expires, with the list of
 * players still standing in it.
 */
function telegraph(zone, m, { x, y, r, el = 'holy', delay = TELL, label = null, fire }) {
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
        zone.pushEvent({ t: 'fx', fx: 'line', el: 'earth', x: a.x, y: a.y - 20, tx: m.x, ty: m.y - 20 });
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
        x: m.x, y: m.y, r, el: 'fire', delay, label: 'ถอยออกไป',
        fire: (hit) => {
          zone.pushEvent({ t: 'fx', fx: 'nova', el: 'fire', x: m.x, y: m.y, r });
          for (const p of hit) applyDamage(zone, m, p, Math.floor(m.derived.atk * 3.2), { element: 'fire', magic: true });
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
    x: on.x, y: on.y, r: 96, el: 'holy', label: 'หลบ!',
    fire: (hit) => {
      zone.pushEvent({ t: 'fx', fx: 'aoe', el: 'holy', x: on.x, y: on.y, r: 96 });
      for (const p of hit) applyDamage(zone, m, p, Math.floor(m.derived.atk * 2.4), { element: 'holy', magic: true });
    },
  });
};

/**
 * Gruum, Orc Warlord.
 *
 * The Warden asks a party to spread out and to split its damage. Gruum asks
 * the opposite of the first and something new for the second, so that knowing
 * one fight does not mean knowing the other:
 *
 *   Charge   - he picks the player *furthest* from him and runs the line
 *              between them, hurting everything on the way. Standing at range
 *              is what makes it dangerous, so the room cannot simply back off.
 *   Warband  - he calls orcs who do not heal him, they sharpen him: every one
 *              still standing is a flat bonus to his attack. Ignoring them
 *              does not stall the fight, it loses it.
 *   Pyres    - fires that stay lit, shrinking the floor rather than punishing
 *              a single beat of it.
 */
SCRIPTS.warlord = (zone, m, t) => {
  const pct = m.hp / m.maxHp;
  const phase = pct > 0.66 ? 1 : pct > 0.3 ? 2 : 3;
  const living = () => [...zone.players.values()].filter((p) => p.alive && !statusMods(p).invisible);

  if (phase !== m.phase) {
    m.phase = phase;
    m.nextMechanicAt = t + 1400;
    if (phase === 2) {
      zone.pushEvent({ t: 'boss', id: m.id, say: 'กรูมเป่าเขาสัตว์ — หมู่รบของเขากำลังมา!' });
    }
    if (phase === 3) {
      zone.pushEvent({ t: 'boss', id: m.id, say: 'กรูมจุดไฟทั่วลาน — ที่ยืนกำลังจะหมด!' });
    }
  }

  // ---- the warband sharpens him while it stands ----
  // Recomputed rather than accumulated, and again the moment any of them are
  // called, so the horn and the bonus are the same event to anyone watching.
  const sharpen = () => {
    m.warband = (m.warband ?? []).filter((id) => zone.entities.get(id)?.alive);
    m.mods.atkPct = m.warband.length * 12 + (phase === 3 ? 20 : 0);
  };
  sharpen();

  // ---- lit ground keeps burning ----
  if (m.pyres?.length && t >= (m.nextPyreTickAt ?? 0)) {
    m.nextPyreTickAt = t + 1000;
    for (const f of m.pyres) {
      for (const p of inside(zone, f.x, f.y, f.r)) {
        applyDamage(zone, m, p, Math.floor(m.derived.atk * 0.55), { element: 'fire', magic: true });
      }
    }
  }

  const now = Date.now();
  for (let i = m.pending.length - 1; i >= 0; i--) {
    const q = m.pending[i];
    if (now < q.at) continue;
    m.pending.splice(i, 1);
    q.fire(inside(zone, q.x, q.y, q.r));
  }

  const target = m.target ? zone.entities.get(m.target) : null;
  if (!target || t < (m.nextMechanicAt ?? 0)) return;
  m.mechCount = (m.mechCount ?? 0) + 1;

  // ---- call the warband, if it has thinned ----
  if (phase >= 2 && m.warband.length < (phase === 3 ? 4 : 2)) {
    m.nextMechanicAt = t + 8000;
    const want = (phase === 3 ? 4 : 2) - m.warband.length;
    for (let i = 0; i < want; i++) {
      const a = 2 * Math.PI * (i / want) + m.mechCount;
      const at = zone.nearestWalkable
        ? zone.nearestWalkable(m.x + Math.cos(a) * 170, m.y + Math.sin(a) * 170)
        : { x: m.x + Math.cos(a) * 170, y: m.y + Math.sin(a) * 170 };
      const mob = zone.spawnMonster(phase === 3 ? 'crimson_orc' : 'orc_scout', at.x, at.y, {});
      mob.warbandOf = m.id;
      m.warband.push(mob.id);
      zone.pushEvent({ t: 'fx', fx: 'summon', el: 'fire', x: at.x, y: at.y });
    }
    sharpen();
    zone.pushEvent({ t: 'boss', id: m.id, say: 'ฆ่าหมู่รบ! ทุกตัวที่ยืนอยู่ทำให้กรูมแรงขึ้น' });
    return;
  }

  // ---- light a pyre, permanently ----
  if (phase === 3 && m.mechCount % 3 === 0) {
    m.nextMechanicAt = t + 7000;
    m.pyres ??= [];
    const on = living()[Math.floor(Math.random() * Math.max(1, living().length))];
    if (!on) return;
    telegraph(zone, m, {
      x: on.x, y: on.y, r: 110, el: 'fire', label: 'ไฟจะไม่ดับ',
      fire: () => {
        m.pyres.push({ x: on.x, y: on.y, r: 110 });
        zone.pushEvent({ t: 'fx', fx: 'ground', el: 'fire', x: on.x, y: on.y, r: 110 });
      },
    });
    return;
  }

  // ---- the charge: down the line to whoever stood furthest away ----
  m.nextMechanicAt = t + (phase === 1 ? 6500 : 5000);
  const pool = living();
  if (!pool.length) return;
  const far = pool.reduce((a, b) => (dist(m, b) > dist(m, a) ? b : a));
  const dx = far.x - m.x, dy = far.y - m.y;
  const len = Math.hypot(dx, dy) || 1;
  zone.pushEvent({ t: 'boss', id: m.id, say: 'กรูมเล็งไปที่คนที่ยืนไกลที่สุด!' });
  // Marked as a line of overlapping circles: the telegraph the client already
  // draws is a disc, and four of them read as a lane without new artwork.
  for (let i = 1; i <= 4; i++) {
    const fx = m.x + (dx / len) * (len * i / 4), fy = m.y + (dy / len) * (len * i / 4);
    telegraph(zone, m, {
      x: fx, y: fy, r: 78, el: 'fire', delay: TELL + i * 90, label: i === 4 ? 'ออกจากแนว!' : null,
      fire: (hit) => {
        zone.pushEvent({ t: 'fx', fx: 'nova', el: 'fire', x: fx, y: fy, r: 78 });
        for (const p of hit) applyDamage(zone, m, p, Math.floor(m.derived.atk * 2.1), { element: 'fire' });
      },
    });
  }
};

/**
 * Vhaal, the King Who Will Not Sleep.
 *
 * Where Gruum punishes standing apart, Vhaal punishes it the other way round,
 * so a party that learned one has to unlearn it:
 *
 *   Grave chill - a ring that grows outward from the throne. The safe ground
 *                 is the middle, which is where the Warden's collapse killed
 *                 you, and there is exactly one beat to decide.
 *   Tether      - two players bound by a cord of cold. It hurts them both
 *                 while they are far apart, so the fight has to close up.
 *   The court   - below a quarter he raises his thralls, and keeps raising
 *                 them, so the damage has to be finished rather than paced.
 */
SCRIPTS.vhaal = (zone, m, t) => {
  const pct = m.hp / m.maxHp;
  const phase = pct > 0.6 ? 1 : pct > 0.25 ? 2 : 3;
  const living = () => [...zone.players.values()].filter((p) => p.alive && !statusMods(p).invisible);

  if (phase !== m.phase) {
    m.phase = phase;
    m.nextMechanicAt = t + 1400;
    if (phase === 2) zone.pushEvent({ t: 'boss', id: m.id, say: 'วาลผูกสายเย็นระหว่างผู้บุกรุก — อย่าอยู่ห่างกัน!' });
    if (phase === 3) {
      m.mods.atkPct = (m.mods.atkPct ?? 0) + 20;
      zone.pushEvent({ t: 'boss', id: m.id, say: 'ราชสำนักของวาลลุกขึ้นยืน!' });
    }
  }

  // ---- the tether keeps billing while it is stretched ----
  if (m.tether && t >= (m.nextTetherTickAt ?? 0)) {
    m.nextTetherTickAt = t + 1000;
    const a = zone.entities.get(m.tether[0]), b = zone.entities.get(m.tether[1]);
    if (!a?.alive || !b?.alive || t > m.tetherUntil) {
      m.tether = null;
    } else {
      const apart = Math.hypot(a.x - b.x, a.y - b.y);
      zone.pushEvent({ t: 'fx', fx: 'line', el: 'ice', x: a.x, y: a.y - 20, tx: b.x, ty: b.y - 20 });
      if (apart > 160) {
        const bite = Math.floor(m.derived.atk * 0.5 * Math.min(3, apart / 160));
        applyDamage(zone, m, a, bite, { element: 'ice', magic: true });
        applyDamage(zone, m, b, bite, { element: 'ice', magic: true });
      }
    }
  }

  // ---- the court comes back up ----
  if (phase === 3 && t >= (m.nextRaiseAt ?? 0)) {
    m.nextRaiseAt = t + 12000;
    m.court = (m.court ?? []).filter((id) => zone.entities.get(id)?.alive);
    if (m.court.length < 4) {
      const a = 2 * Math.PI * Math.random();
      const at = zone.nearestWalkable
        ? zone.nearestWalkable(m.x + Math.cos(a) * 150, m.y + Math.sin(a) * 150)
        : { x: m.x + Math.cos(a) * 150, y: m.y + Math.sin(a) * 150 };
      const up = zone.spawnMonster('crown_thrall', at.x, at.y, {});
      up.courtOf = m.id;
      m.court.push(up.id);
      zone.pushEvent({ t: 'fx', fx: 'summon', el: 'dark', x: at.x, y: at.y });
    }
  }

  const now = Date.now();
  for (let i = m.pending.length - 1; i >= 0; i--) {
    const q = m.pending[i];
    if (now < q.at) continue;
    m.pending.splice(i, 1);
    q.fire(inside(zone, q.x, q.y, q.r));
  }

  const target = m.target ? zone.entities.get(m.target) : null;
  if (!target || t < (m.nextMechanicAt ?? 0)) return;
  m.mechCount = (m.mechCount ?? 0) + 1;

  // ---- bind two people together ----
  if (phase >= 2 && m.mechCount % 3 === 0) {
    const pool = living();
    if (pool.length >= 2) {
      m.nextMechanicAt = t + 9000;
      const i = Math.floor(Math.random() * pool.length);
      let j = Math.floor(Math.random() * (pool.length - 1));
      if (j >= i) j += 1;
      m.tether = [pool[i].id, pool[j].id];
      m.tetherUntil = t + 10000;
      m.nextTetherTickAt = t + 1500;
      for (const p of [pool[i], pool[j]]) {
        addStatus(p, { key: 'vhaal_tether', type: 'debuff', icon: '⛓', until: Date.now() + 10000 });
      }
      zone.pushEvent({ t: 'boss', id: m.id, say: 'สายเย็นถูกผูกแล้ว — เข้าหากัน!' });
      return;
    }
  }

  // ---- grave chill: the rim dies, the middle lives ----
  m.nextMechanicAt = t + (phase === 1 ? 7000 : 5400);
  zone.pushEvent({ t: 'boss', id: m.id, say: 'เข้ามาใกล้บัลลังก์!' });
  for (const [r, delay] of [[250, TELL], [170, TELL + 650]]) {
    telegraph(zone, m, {
      x: m.x, y: m.y, r, el: 'ice', delay, label: r === 250 ? 'เข้ามา!' : null,
      fire: (hit) => {
        zone.pushEvent({ t: 'fx', fx: 'nova', el: 'ice', x: m.x, y: m.y, r });
        // Only the ring between this circle and the next one in is lethal.
        for (const p of hit) {
          if (dist(m, p) < r - 80) continue;
          applyDamage(zone, m, p, Math.floor(m.derived.atk * 2.2), { element: 'ice', magic: true });
        }
      },
    });
  }
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
  // Everything a script can leave lying around: summons, lit ground, and the
  // cord between two players. A leash that forgets one of them hands the next
  // party a boss that is already sharpened, or a floor that is already on fire.
  for (const id of [...(m.anchors ?? []), ...(m.warband ?? []), ...(m.court ?? [])]) {
    zone.entities.delete(id);
  }
  m.anchors = [];
  m.warband = [];
  m.court = [];
  m.pyres = [];
  m.tether = null;
  m.pending = [];
  m.phase = null;
  m.mechCount = 0;
  if (m.mods) m.mods.atkPct = 0;
}
