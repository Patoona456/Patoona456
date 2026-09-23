// Every reference in the game data must point at something that exists.
//
// This is the cheapest test in the suite and it has already caught the kind
// of bug that only shows up as a silent 404 in someone's browser: an NPC
// dressed in a sprite the asset set does not contain. Data files reference
// each other by bare string ids, so nothing but a pass like this notices
// when one is renamed or misspelled.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ITEMS, RECIPES } from '../shared/data/items.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { SKILLS } from '../shared/data/skills.js';
import { JOBS } from '../shared/data/jobs.js';
import { QUESTS } from '../shared/data/quests.js';
import { MAPS } from '../shared/data/maps.js';
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
