// Every reference in the game data must point at something that exists.
//
// This is the cheapest test in the suite and it has already caught the kind
// of bug that only shows up as a silent 404 in someone's browser: an NPC
// dressed in a sprite the asset set does not contain. Data files reference
// each other by bare string ids, so nothing but a pass like this notices
// when one is renamed or misspelled.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ITEMS, RECIPES, RETIRED_ITEMS } from '../shared/data/items.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { SKILLS } from '../shared/data/skills.js';
import { JOBS } from '../shared/data/jobs.js';
import { QUESTS } from '../shared/data/quests.js';
import { MAPS, buildGrid, BLOCKING } from '../shared/data/maps.js';
import { SHOPS, NPC_DIALOG } from '../shared/data/npcs.js';
import { ELEMENTS } from '../shared/constants.js';
import { ELEMENT_LOOK } from '../shared/elements.js';
import { playerLayers, npcLayers, monsterLayers, urlOf } from '../client/js/sprites.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** `/assets/lpc/...` as the browser asks for it -> a path on disk. */
const onDisk = (url) => path.join(root, url.replace(/^\//, ''));

/* ------------------------------------------------------------------ items */

test('every item id matches the key it is filed under', () => {
  for (const [key, def] of Object.entries(ITEMS)) assert.equal(def.id, key, `${key} is filed as ${def.id}`);
});

test('every box opens into items that exist', () => {
  for (const def of Object.values(ITEMS)) {
    for (const row of def.opens ?? []) {
      assert.ok(ITEMS[row.id], `${def.id} can open into the unknown item ${row.id}`);
      assert.ok(row.weight > 0, `${def.id} -> ${row.id} has no weight`);
    }
  }
});

test('every recipe uses and produces real items', () => {
  for (const [key, r] of Object.entries(RECIPES)) {
    assert.ok(ITEMS[r.out.id], `recipe ${key} makes the unknown item ${r.out.id}`);
    for (const m of r.in) assert.ok(ITEMS[m.id], `recipe ${key} needs the unknown item ${m.id}`);
  }
});

test('every shop sells things that exist, in a currency that exists', () => {
  for (const [key, shop] of Object.entries(SHOPS)) {
    // a shelf with nothing on it is waiting for the new item sheet, and so is
    // the item it will be priced in
    if (!shop.stock.length) continue;
    if (shop.currency) assert.ok(ITEMS[shop.currency], `shop ${key} is priced in the unknown item ${shop.currency}`);
    for (const line of shop.stock) {
      assert.ok(ITEMS[line.id], `shop ${key} sells the unknown item ${line.id}`);
      if (shop.currency) assert.ok(line.price > 0, `shop ${key}: ${line.id} has no price`);
    }
  }
});

test('anything with an element uses one the game knows', () => {
  for (const set of [ITEMS, MONSTERS, SKILLS]) {
    for (const def of Object.values(set)) {
      if (!def.element) continue;
      assert.ok(ELEMENTS.includes(def.element), `${def.id} has the unknown element ${def.element}`);
    }
  }
  for (const def of Object.values(SKILLS)) {
    if (!def.look) continue;
    assert.ok(ELEMENTS.includes(def.look), `skill ${def.id} looks like the unknown element ${def.look}`);
  }
});

test('every element the combat table knows has a look to draw it with', () => {
  for (const el of ELEMENTS) assert.ok(ELEMENT_LOOK[el], `no look defined for ${el}`);
});

/* --------------------------------------------------------------- monsters */

test('every monster drops and casts things that exist', () => {
  for (const m of Object.values(MONSTERS)) {
    for (const d of m.drops ?? []) {
      assert.ok(ITEMS[d.id], `${m.id} drops the unknown item ${d.id}`);
      assert.ok(d.chance > 0 && d.chance <= 1, `${m.id} -> ${d.id} has a silly chance ${d.chance}`);
    }
    for (const s of m.skills ?? []) assert.ok(SKILLS[s], `${m.id} casts the unknown skill ${s}`);
    if (m.aurum) assert.ok(m.aurum.max >= m.aurum.min, `${m.id} drops negative aurum`);
  }
});

/* ------------------------------------------------------------------- jobs */

test('every job teaches real skills and starts with real gear', () => {
  for (const j of Object.values(JOBS)) {
    for (const s of j.skills ?? []) assert.ok(SKILLS[s], `job ${j.id} teaches the unknown skill ${s}`);
    for (const k of j.starterKit ?? []) assert.ok(ITEMS[k.id], `job ${j.id} starts with the unknown item ${k.id}`);
    for (const n of j.next ?? []) assert.ok(JOBS[n], `job ${j.id} advances into the unknown job ${n}`);
    if (j.trial?.mob) assert.ok(MONSTERS[j.trial.mob], `job ${j.id} trial hunts the unknown monster ${j.trial.mob}`);
    if (j.trial?.item) assert.ok(ITEMS[j.trial.item], `job ${j.id} trial collects the unknown item ${j.trial.item}`);
  }
});

/* ----------------------------------------------------------------- quests */

test('every quest points at real monsters, items and zones', () => {
  for (const q of Object.values(QUESTS)) {
    assert.equal(q.id, Object.keys(QUESTS).find((k) => QUESTS[k] === q), `${q.id} is misfiled`);
    if (q.zone) assert.ok(MAPS[q.zone], `${q.id} sends you to the unknown zone ${q.zone}`);
    for (const o of q.objectives ?? []) {
      if (o.mob) assert.ok(MONSTERS[o.mob], `${q.id} hunts the unknown monster ${o.mob}`);
      if (o.item) assert.ok(ITEMS[o.item], `${q.id} collects the unknown item ${o.item}`);
      assert.ok((o.count ?? 1) > 0, `${q.id} asks for none of something`);
    }
    for (const it of q.rewards?.items ?? []) assert.ok(ITEMS[it.id], `${q.id} rewards the unknown item ${it.id}`);
  }
});

/* ------------------------------------------------------------------- maps */

test('every warp leads to a map that exists', () => {
  for (const [id, m] of Object.entries(MAPS)) {
    for (const w of m.warps ?? []) {
      assert.ok(MAPS[w.to], `${id} warps to the unknown map ${w.to}`);
      assert.ok(w.at?.length === 2, `${id} -> ${w.to} has no arrival point`);
    }
  }
});

test('nobody arrives standing on a warp pad', () => {
  const onPad = (map, tx, ty) => (map.warps ?? []).some(
    (w) => tx >= w.x && tx < w.x + w.w && ty >= w.y && ty < w.y + w.h,
  );
  for (const [id, m] of Object.entries(MAPS)) {
    if (m.spawnPoint) {
      assert.ok(!onPad(m, ...m.spawnPoint), `${id}: the spawn point sits on a warp pad, so players bounce straight out`);
    }
    for (const w of m.warps ?? []) {
      assert.ok(!onPad(MAPS[w.to], w.at[0], w.at[1]),
        `${id} -> ${w.to}: you arrive standing on a pad, which throws you back`);
    }
  }
});

test('every spawn names a monster that exists', () => {
  for (const [id, m] of Object.entries(MAPS)) {
    for (const sp of m.spawns ?? []) {
      assert.ok(MONSTERS[sp.mob], `${id} spawns the unknown monster ${sp.mob}`);
      assert.ok(sp.count > 0, `${id} spawns none of ${sp.mob}`);
    }
  }
});

test('every NPC has somewhere to shop and something to say', () => {
  for (const [id, m] of Object.entries(MAPS)) {
    for (const npc of m.npcs ?? []) {
      if (npc.shop) assert.ok(SHOPS[npc.shop], `${id}: ${npc.id} tends the unknown shop ${npc.shop}`);
      assert.ok(NPC_DIALOG[npc.id] ?? NPC_DIALOG[npc.role],
        `${id}: ${npc.id} (role ${npc.role}) has no dialog, so talking to them does nothing`);
    }
  }
});

/* ---------------------------------------------------------------- sprites */

test('every sprite the game asks for is a file that exists', () => {
  const missing = new Set();
  // A layer entry is a url, or `{ url, tint }` once a piece is recoloured.
  const check = (entry, who) => {
    const url = urlOf(entry);
    if (url && !existsSync(onDisk(url))) missing.add(`${url}  (${who})`);
  };

  for (const [id, m] of Object.entries(MAPS)) {
    for (const npc of m.npcs ?? []) {
      for (const url of Object.values(npcLayers(npc.look) ?? {})) check(url, `NPC ${npc.id} in ${id}`);
    }
  }
  for (const mob of Object.values(MONSTERS)) {
    for (const url of Object.values(monsterLayers(mob.sprite) ?? {})) check(url, `monster ${mob.id}`);
  }
  // Items go through playerLayers, not layerUrl, because that is where the
  // one-gender-only fallback is applied - testing the raw url would report a
  // miss the game already handles, and miss one it does not.
  for (const item of Object.values(ITEMS)) {
    if (!item.sprite || !item.slot) continue;
    for (const gender of ['male', 'female']) {
      const look = { gender, body: 'light', eyes: 'brown', hair: 'plain', hairColor: 'brown' };
      const layers = playerLayers(look, { [item.slot]: item.id });
      for (const url of Object.values(layers)) check(url, `item ${item.id} worn by a ${gender}`);
    }
  }
  assert.equal(missing.size, 0, `missing sprite files:\n  ${[...missing].join('\n  ')}`);
});

test('a default character is fully dressed in files that exist', () => {
  for (const gender of ['male', 'female']) {
    const layers = playerLayers({ gender, body: 'light', eyes: 'brown', hair: 'plain', hairColor: 'brown' }, {});
    for (const [slot, url] of Object.entries(layers)) {
      assert.ok(existsSync(onDisk(url)), `${gender} ${slot}: ${url} is missing`);
    }
  }
});

test('the chibi body sheet is the grid its layout says', async () => {
  const { readFileSync } = await import('node:fs');
  const { CHIBI_WALK, fits } = await import('../shared/sheets.js');
  const url = urlOf(playerLayers({ style: 'chibi' }).body);
  const png = readFileSync(onDisk(url));
  // width and height sit in the IHDR chunk, right after the 8-byte signature
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  assert.ok(fits(CHIBI_WALK, w, h), `${url} is ${w}x${h}, layout wants `
    + `${CHIBI_WALK.frame.w * CHIBI_WALK.cols}x${CHIBI_WALK.frame.h * CHIBI_WALK.rows}`);
});

test('in every town, each keeper and each way out can be walked to from the spawn', () => {
  for (const m of Object.values(MAPS)) {
    if (m.kind !== 'town') continue;
    const g = buildGrid(m), W = m.width, H = m.height;
    const onPad = (x, y) => m.warps.some((w) => x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h);
    const seen = new Uint8Array(W * H);
    const start = m.spawnPoint[1] * W + m.spawnPoint[0];
    const queue = [start];
    seen[start] = 1;
    while (queue.length) {
      const i = queue.pop(), x = i % W, y = (i / W) | 0;
      if (onPad(x, y)) continue;            // stepping on a pad leaves the map
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, j = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[j] || BLOCKING.has(g[j])) continue;
        seen[j] = 1;
        queue.push(j);
      }
    }
    const near = (cx, cy, r) => {
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (seen[y * W + x]) return true;
      return false;
    };
    for (const n of m.npcs) assert.ok(near(n.x, n.y, 2), `${m.id}: nobody can reach ${n.id} at ${n.x},${n.y}`);
    for (const w of m.warps) {
      assert.ok(near(w.x + (w.w >> 1), w.y + (w.h >> 1), 2), `${m.id}: the way to ${w.to} cannot be reached`);
    }
  }
});

test('a town painted as one picture ships that picture', () => {
  for (const m of Object.values(MAPS)) {
    if (!m.backdrop) continue;
    assert.ok(existsSync(onDisk(m.backdrop)), `${m.id}: ${m.backdrop} is missing`);
    assert.ok(m.walk?.length, `${m.id} has a backdrop but no walkable ground`);
  }
});

test('every building picture a map places exists', () => {
  for (const m of Object.values(MAPS)) {
    for (const st of m.structures ?? []) {
      if (st.img) assert.ok(existsSync(onDisk(st.img)), `${m.id}: ${st.img} is missing`);
    }
  }
});

test('no keeper stands inside a wall, a tree or a lamp', () => {
  for (const m of Object.values(MAPS)) {
    if (m.kind !== 'town') continue;
    const g = buildGrid(m);
    for (const n of m.npcs) {
      assert.ok(!BLOCKING.has(g[n.y * m.width + n.x]), `${m.id}: ${n.id} at ${n.x},${n.y} stands in scenery`);
    }
  }
});

test('every townsperson starts somewhere they can stand', () => {
  for (const m of Object.values(MAPS)) {
    const g = buildGrid(m);
    for (const w of m.walkers ?? []) {
      assert.ok(!BLOCKING.has(g[w.y * m.width + w.x]), `${m.id}: ${w.name} starts in scenery at ${w.x},${w.y}`);
    }
  }
});

test('a map drawn in sharp tiles ships every tile', () => {
  for (const m of Object.values(MAPS)) {
    const bt = m.backdropTiles;
    if (!bt) continue;
    assert.equal(bt.cols * bt.size, bt.width, `${m.id}: tiles do not cover the width`);
    assert.equal(bt.rows * bt.size, bt.height, `${m.id}: tiles do not cover the height`);
    for (let y = 0; y < bt.rows; y++) {
      for (let x = 0; x < bt.cols; x++) {
        assert.ok(existsSync(onDisk(`${bt.dir}/${x}_${y}.webp`)), `${m.id}: tile ${x},${y} is missing`);
      }
    }
  }
});

test('every gate style a warp can be drawn as has its picture', () => {
  for (const style of ['city', 'nature', 'dungeon', 'boss', 'holy', 'ice', 'void']) {
    assert.ok(existsSync(onDisk(`assets/warp/${style}.webp`)), `assets/warp/${style}.webp is missing`);
  }
});

test('a retired item always points at one that exists', () => {
  for (const [old, now] of Object.entries(RETIRED_ITEMS)) {
    assert.ok(!ITEMS[old], `${old} was retired but still exists`);
    assert.ok(ITEMS[now], `${old} is replaced by an unknown item`);
  }
});

test('every painted HUD piece the stylesheet and icons ask for is on disk', () => {
  const css = readFileSync(path.join(root, 'client/css/style.css'), 'utf8');
  const icons = readFileSync(path.join(root, 'client/js/icons.js'), 'utf8');
  const ui = readFileSync(path.join(root, 'client/js/ui.js'), 'utf8');
  const ghosts = ui.match(/const GHOSTS = new Set\(\[([^\]]*)\]/)[1].match(/\w+/g).map((g) => 'ghost_' + g);
  const names = new Set([
    ...[...css.matchAll(/url\(\.\.\/\.\.\/assets\/ui\/([\w-]+)\.webp\)/g)].map((m) => m[1]),
    ...[...icons.matchAll(/'((?:skill|item)_\w+)'/g)].map((m) => m[1]),
    ...[...ui.matchAll(/'(st_\w+)'/g)].map((m) => m[1]),
    ...ghosts, ...Array.from({ length: 10 }, (_, i) => 'digit_' + i),
    'miss', 'critical', 'levelup', 'questclear',
  ]);
  assert.ok(names.size > 20, `only found ${names.size} references`);
  for (const n of names) assert.ok(existsSync(path.join(root, 'assets/ui', n + '.webp')), `assets/ui/${n}.webp is missing`);
});
