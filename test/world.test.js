// Rules that live in the server's world simulation.
//
// Each of these was a bug once, or guards a rule the design documents make a
// promise about. They run against the real World and Zone objects, with stub
// players, so there is no browser and no network in the way.
import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../server/game/world.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { MAPS, buildGrid, BLOCKING, TILES } from '../shared/data/maps.js';
import { findPath, lineClear } from '../shared/pathfind.js';
import { TILE, LEVEL_AGGRO_GAP } from '../shared/constants.js';

/** A player-shaped stub: enough for the AI and the reward code to run. */
function stubPlayer(id, level, zone, x = 1000, y = 1000) {
  const p = {
    id, name: id, kind: 'player', alive: true, x, y, party: null, zone,
    hp: 9000, maxHp: 9000, sp: 100, maxSp: 100, statuses: [], mods: {}, cast: null,
    record: { id: 'c' + id, level, exp: 0, jobExp: 0, quests: {}, lockouts: {} },
    derived: { level, maxHp: 9000 }, notices: [],
    conn: { send(m) { if (m.t === 'notice') p.notices.push(m.text); } },
    gainExp(e, j) { p.record.exp += e; p.record.jobExp += j; },
    wearGear() {},
  };
  return p;
}

function freshWorld() {
  const w = new World();
  return w;
}

/* ------------------------------------------------------- the party door */

test('the party door counts who is actually standing here', (t) => {
  const w = freshWorld();
  t.after(() => w.stop());
  const zone = w.zone('frostvault');
  const A = stubPlayer('A', 65, zone);
  const B = stubPlayer('B', 65, zone);
  zone.players.set('A', A);

  assert.match(w.partyGate(A, 'reliquary1'), /ปาร์ตี้/, 'a partyless player should be refused');

  A.party = 'pt1';
  assert.ok(w.partyGate(A, 'reliquary1'), 'a party of one is still one person');

  zone.players.set('B', B);
  B.party = 'pt1';
  assert.equal(w.partyGate(A, 'reliquary1'), null, 'two together should open the door');

  B.party = 'pt2';
  assert.ok(w.partyGate(A, 'reliquary1'), 'a stranger in the room is not your party');

  B.party = 'pt1';
  B.alive = false;
  assert.ok(w.partyGate(A, 'reliquary1'), 'a corpse does not count');

  B.alive = true;
  zone.players.delete('B');
  w.zone('emberhold').players.set('B', B);
  B.zone = w.zone('emberhold');
  assert.ok(w.partyGate(A, 'reliquary1'), 'a party member in another town is not here');

  assert.equal(w.partyGate(A, 'greenmire'), null, 'ordinary zones have no door');
});

/* ------------------------------------------------------ the weekly lockout */

test('a locked boss pays its hoard once a week, and experience every time', (t) => {
  const w = freshWorld();
  t.after(() => w.stop());
  const zone = w.zone('reliquary3');
  const p = stubPlayer('P', 68, zone);
  zone.players.set('P', p);
  zone.entities.set('P', p);

  const kill = () => {
    zone.ground.length = 0;
    const before = p.record.exp;
    zone.awardKill({
      id: 'b' + Math.random(), kind: 'monster', defId: 'reliquary_warden',
      def: MONSTERS.reliquary_warden, name: 'boss', level: 68,
      x: p.x, y: p.y, alive: true, tapped: new Set(['P']), boss: true,
    }, p);
    return { drops: zone.ground.length, exp: p.record.exp - before };
  };

  const first = kill();
  assert.ok(first.drops > 0, 'the first kill of the week should pay out');
  assert.ok(first.exp > 0);

  const second = kill();
  assert.equal(second.drops, 0, 'a second kill in the same week must not pay again');
  assert.ok(second.exp > 0, 'helping a friend clear it should still be worth something');
  assert.ok(second.exp < first.exp / 2, 'but clearly less than the first');

  p.record.lockouts.reliquary_warden = '2000-01-03';     // a fortnight ago
  assert.ok(kill().drops > 0, 'a new week should pay again');
});

test('an unlocked boss pays every time', (t) => {
  const w = freshWorld();
  t.after(() => w.stop());
  const zone = w.zone('vhaal');
  const p = stubPlayer('P', 68, zone);
  zone.players.set('P', p);
  zone.entities.set('P', p);
  const kill = () => {
    zone.ground.length = 0;
    zone.awardKill({
      id: 'b' + Math.random(), kind: 'monster', defId: 'skeleton_king',
      def: MONSTERS.skeleton_king, name: 'boss', level: 65,
      x: p.x, y: p.y, alive: true, tapped: new Set(['P']), boss: true,
    }, p);
    return zone.ground.length;
  };
  assert.ok(kill() > 0);
  assert.ok(kill() > 0, 'skeleton_king has no lockout and should keep paying');
});

/* --------------------------------------------------------------- aggro */

test('a monster far above you hunts on sight, and sees you coming from further', (t) => {
  const w = freshWorld();
  t.after(() => w.stop());
  const zone = w.zone('greenmire');
  const def = MONSTERS.frost_husk;

  const starts = (playerLevel, distPx, passive) => {
    for (const id of [...zone.entities.keys()]) zone.entities.delete(id);
    zone.players.clear();
    const p = stubPlayer('P', playerLevel, zone);
    zone.players.set('P', p);
    zone.entities.set('P', p);
    const m = zone.spawnMonster('frost_husk', p.x + distPx, p.y, {});
    if (passive) m.def = { ...m.def, aggressive: false };
    m.nextThinkAt = 0;
    for (let i = 0; i < 3; i++) zone.updateMonsters(0.05, Date.now() + i * 500);
    return !!m.target;
  };

  // the placid case: the level gap is the whole reason it moves
  assert.equal(starts(def.level, 60, true), false, 'a placid monster at your level should ignore you');
  assert.equal(starts(def.level - LEVEL_AGGRO_GAP, 60, true), false, 'exactly ten levels is still inside the fence');
  assert.equal(starts(def.level - LEVEL_AGGRO_GAP - 1, 60, true), true, 'one past the fence and it comes');

  // and the range grows with the gap
  const reach = (playerLevel) => {
    let lo = 0, hi = 1200;
    while (hi - lo > 8) {
      const mid = (lo + hi) / 2;
      if (starts(playerLevel, mid, false)) lo = mid; else hi = mid;
    }
    return lo;
  };
  const even = reach(def.level);
  const far = reach(def.level - 30);
  assert.ok(far > even * 1.6, `a thirty level gap should roughly double the range (${even} -> ${far})`);
  assert.ok(far < even * 2.4, `but not more than double (${even} -> ${far})`);
});

test('a summoned pet never turns on its owner, however low their level', (t) => {
  const w = freshWorld();
  t.after(() => w.stop());
  const zone = w.zone('greenmire');
  const p = stubPlayer('P', 1, zone);
  zone.players.set('P', p);
  zone.entities.set('P', p);
  const pet = zone.spawnMonster('companion_wolf', p.x + 30, p.y, { summon: true, owner: 'P' });
  pet.level = 90;                       // absurd, to make the point
  pet.nextThinkAt = 0;
  for (let i = 0; i < 3; i++) zone.updateMonsters(0.05, Date.now() + i * 500);
  assert.notEqual(pet.target, 'P', 'the pet went for its owner');
});

/* ---------------------------------------------------------- pathfinding */

test('a chasing monster walks around a wall instead of into it', (t) => {
  const w = freshWorld();
  t.after(() => w.stop());
  const zone = w.zone('gravebound');
  const W = zone.width, H = zone.height;
  zone.grid.fill(TILES.FLOOR);
  for (let x = 6; x < W - 2; x++) zone.grid[20 * W + x] = TILES.WALL;   // one gap, far left

  const run = (stepFn) => {
    const m = { x: 30 * TILE, y: 10 * TILE, speed: 90, path: null };
    const target = { x: 30 * TILE, y: 30 * TILE };
    let closest = Infinity;
    for (let i = 0; i < 3000; i++) {
      const step = stepFn(m, target, i * 50);
      zone.moveTo(m, m.x + step.x * 90 * 0.05, m.y + step.y * 90 * 0.05);
      closest = Math.min(closest, Math.hypot(m.x - target.x, m.y - target.y));
      if (closest < 16) break;
    }
    return closest;
  };

  const straight = run((m, target) => {
    const d = Math.hypot(target.x - m.x, target.y - m.y) || 1;
    return { x: (target.x - m.x) / d, y: (target.y - m.y) / d };
  });
  const pathed = run((m, target, t2) => zone.chaseStep(m, target, t2));

  assert.ok(straight > 200, 'the control case should get stuck on the wall');
  assert.ok(pathed < 16, `pathfinding failed to get round the wall (closest ${Math.round(pathed)}px)`);
});

test('line of sight sees through open floor and not through walls', () => {
  const m = MAPS.gravebound;
  const g = buildGrid(m);
  const W = m.width, H = m.height;
  const solid = new Uint8Array(g);
  solid.fill(TILES.FLOOR);
  for (let y = 0; y < H; y++) solid[y * W + 20] = TILES.WALL;
  const a = { x: 10 * TILE, y: 10 * TILE }, b = { x: 30 * TILE, y: 10 * TILE };
  assert.equal(lineClear(solid, W, H, a, b), false, 'a wall between them should block');
  const open = new Uint8Array(g.length).fill(TILES.FLOOR);
  assert.equal(lineClear(open, W, H, a, b), true, 'open floor should not block');
});

/* ----------------------------------------------------------------- maps */

test('every zone is walkable from end to end', () => {
  for (const [id, m] of Object.entries(MAPS)) {
    const g = buildGrid(m);
    const W = m.width, H = m.height;
    const free = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !BLOCKING.has(g[y * W + x]);
    const [sx, sy] = m.spawnPoint ?? [Math.floor(W / 2), Math.floor(H / 2)];
    assert.ok(free(sx, sy), `${id}: the spawn point is inside a wall`);

    const seen = new Uint8Array(W * H);
    let queue = [sy * W + sx];
    seen[queue[0]] = 1;
    let reached = 1;
    while (queue.length) {
      const next = [];
      for (const cur of queue) {
        const cx = cur % W, cy = (cur - cx) / W;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (!free(nx, ny)) continue;
          const i = ny * W + nx;
          if (seen[i]) continue;
          seen[i] = 1; reached++; next.push(i);
        }
      }
      queue = next;
    }

    // every warp pad and every spawn area has to be somewhere you can walk to
    for (const wp of m.warps ?? []) {
      const tx = Math.floor(wp.x + wp.w / 2), ty = Math.floor(wp.y + wp.h / 2);
      assert.ok(free(tx, ty) && seen[ty * W + tx], `${id}: the warp to ${wp.to} is walled off from the spawn`);
    }
    for (const sp of m.spawns ?? []) {
      if (!sp.area) continue;
      const tx = Math.floor(sp.area[0] + sp.area[2] / 2), ty = Math.floor(sp.area[1] + sp.area[3] / 2);
      assert.ok(free(tx, ty) && seen[ty * W + tx], `${id}: the ${sp.mob} spawn is walled off from the spawn point`);
    }

    // and for the hand-drawn floors, the whole floor must be reachable
    if (m.kind === 'dungeon') {
      let walkable = 0;
      for (let i = 0; i < g.length; i++) if (!BLOCKING.has(g[i])) walkable++;
      assert.equal(reached, walkable, `${id}: ${walkable - reached} tiles are sealed off from the entrance`);
    }
  }
});

test('a party can walk from the entrance of each dungeon floor to its exit', () => {
  for (const id of Object.keys(MAPS).filter((k) => MAPS[k].kind === 'dungeon')) {
    const m = MAPS[id];
    const warps = m.warps ?? [];
    if (warps.length < 2) continue;
    const g = buildGrid(m);
    const mid = (w) => ({ x: (w.x + w.w / 2) * TILE, y: (w.y + w.h / 2) * TILE });
    const path = findPath(g, m.width, m.height, mid(warps[0]), mid(warps[1]));
    assert.ok(path && path.length, `${id}: there is no route from one door to the other`);
  }
});

test('the dungeon is the only thing that asks for a party', () => {
  for (const [id, m] of Object.entries(MAPS)) {
    if (!m.party) continue;
    assert.equal(m.kind, 'dungeon', `${id} demands a party but is not a dungeon`);
    assert.ok(m.party >= 2, `${id} asks for a party of ${m.party}`);
  }
});
