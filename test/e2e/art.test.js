// Does the art the item table points at actually draw?
//
// This is the one thing that cannot be checked without decoding the sheets,
// and it is the exact bug the twelve-class split walked into: a greatsword
// pointed at the `longspear` sheet, which LPC draws for the thrust pose and
// nothing else - so the weapon, and the refine aura that is painted from the
// weapon layer, were invisible in every pose a greatsword ever plays. The
// item table looked right. The screen was empty.
//
// LPC sheets are drawn per pose, and a weapon that is not held in a pose is
// simply absent from it. That is a convention, not a fault - a bow lives on
// your back until you shoot - so the rules here are narrow and load-bearing:
// a class must declare the poses its art has, that declaration must match the
// PNGs, and nothing may ask a class for a melee pose it cannot draw.
import test from 'node:test';
import assert from 'node:assert/strict';
import { playwright, startServer, startBrowser, BASE, skipWithoutPlaywright } from './harness.js';
import { ITEMS } from '../../shared/data/items.js';
import { WEAPON_CLASSES, swingAnim, poseFor } from '../../shared/weapons.js';
import { JOBS, availableSkills } from '../../shared/data/jobs.js';
import { SKILLS } from '../../shared/data/skills.js';
import { ANIM } from '../../shared/constants.js';

const pw = await playwright();
const EITHER = ['bow', 'recurvebow', 'greatbow', 'longspear', 'arrow'];
const MEASURED = ['spellcast', 'thrust', 'walk', 'slash', 'shoot'];

// The weapon sheets are measured per item; with the old set cleared there is
// nothing to measure until the new item sheet brings weapons back.
const NO_WEAPONS = !Object.values(ITEMS).some((it) => it.slot === 'weapon' && it.sprite);

test('weapon art', skipWithoutPlaywright.skip && !pw ? skipWithoutPlaywright
  : NO_WEAPONS ? { skip: 'no weapons in the item table yet: waiting for the new item sheet' } : {}, async (t) => {
  if (!pw) return;
  const server = await startServer();
  const browser = await startBrowser(pw);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  t.after(async () => { await ctx.close(); await browser.close(); await server.stop(); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  /** Non-transparent pixels in a sheet's busiest frame of one pose, facing
   *  down. -1 means the file is not there at all. */
  const ink = (url, row) => page.evaluate(async ([u, r]) => {
    const img = new Image();
    try {
      await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('404')); img.src = u; });
    } catch { return -1; }
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    let best = 0;
    for (let col = 0; col < 6; col++) {
      const d = g.getImageData(col * 64, r * 64, 64, 64).data;
      let n = 0;
      for (let p = 3; p < d.length; p += 4) if (d[p] > 8) n++;
      if (n > best) best = n;
    }
    return best;
  }, [url, row]);

  const sheetUrl = (key, gender) => `${BASE}/assets/lpc/weapon/${EITHER.includes(key) ? 'either' : gender}/${key}.png`;

  /**
   * Which poses one item's art can be drawn in, per gender, resolving the
   * `fallback` the client swaps in for a gender the art set never shipped.
   */
  const posesOf = async (it) => {
    const out = [];
    for (const gender of (it.sprite.gendered === false ? ['either'] : ['male', 'female'])) {
      let key = it.sprite.key;
      if (await ink(sheetUrl(key, gender), ANIM.walk.row + 2) === -1) {
        if (!it.sprite.fallback) return { missing: `${it.sprite.key}/${gender}` };
        key = it.sprite.fallback;
        if (await ink(sheetUrl(key, gender), ANIM.walk.row + 2) === -1) return { missing: `fallback ${key}/${gender}` };
      }
      const set = new Set();
      for (const a of MEASURED) if (await ink(sheetUrl(key, gender), ANIM[a].row + 2) > 0) set.add(a);
      out.push(set);
    }
    // what holds for every gender, because a player picks one
    return { poses: out.reduce((a, b) => new Set([...a].filter((x) => b.has(x)))) };
  };

  const measured = new Map();       // wclass -> Set of poses every item of it has
  const problems = [];
  const weapons = Object.values(ITEMS).filter((it) => it.slot === 'weapon' && it.sprite);

  await t.test('every weapon has a sheet, for both genders or with a fallback', async () => {
    assert.ok(weapons.length > 20, 'the item table lost its weapons');
    for (const it of weapons) {
      const r = await posesOf(it);
      if (r.missing) { problems.push(`${it.id}: no ${r.missing}`); continue; }
      const cur = measured.get(it.wclass);
      measured.set(it.wclass, cur ? new Set([...cur].filter((x) => r.poses.has(x))) : r.poses);
    }
    assert.deepEqual(problems, [], problems.join('; '));
  });

  await t.test('what a class claims its art can do is what the PNGs can do', async () => {
    // `poses` is the table poseFor() reasons from. If it drifts from the art,
    // every rule built on it is guessing.
    const bad = [];
    for (const [id, cls] of Object.entries(WEAPON_CLASSES)) {
      const real = measured.get(id);
      if (!real) continue;                       // shield has no weapon-slot items
      const claimed = new Set(cls.poses ?? []);
      for (const p of claimed) if (!real.has(p)) bad.push(`${id} claims '${p}' but no ${id} sheet has it`);
      for (const p of real) if (!claimed.has(p)) bad.push(`${id} could draw '${p}' and does not say so`);
    }
    assert.deepEqual(bad, [], bad.join('; '));
  });

  await t.test('every weapon is drawn in the pose it swings with', async () => {
    const bad = [];
    for (const it of weapons) {
      const anim = swingAnim(it.wclass);
      const real = measured.get(it.wclass);
      if (real && !real.has(anim)) bad.push(`${it.id} (${it.wclass}) swings '${anim}' its sheet has no frames for`);
    }
    assert.deepEqual(bad, [], bad.join('; '));
  });

  await t.test('no job can cast a skill that empties its own hands', async () => {
    // A skill names one animation and is shared across classes whose art is
    // not: `skewer` thrusts, which the spear is drawn for and the sword is
    // not. poseFor() is what keeps the weapon on screen; this is what proves
    // it covers every skill a job can actually reach.
    const bad = [];
    for (const job of Object.values(JOBS)) {
      for (const id of availableSkills(job.id)) {
        const sk = SKILLS[id];
        if (!sk?.anim || sk.kind === 'passive') continue;
        for (const wclass of job.weapons ?? []) {
          const real = measured.get(wclass);
          if (!real) continue;
          const pose = poseFor(sk.anim, wclass);
          // spellcast and shoot are allowed to hide the weapon: that is how
          // LPC draws a cast, and the body animation still reads
          if (pose === 'spellcast' || pose === 'shoot') continue;
          if (!real.has(pose)) bad.push(`${job.id} casting ${id} with a ${wclass} plays '${pose}', which its art lacks`);
        }
      }
    }
    assert.deepEqual(bad, [], bad.join('; '));
  });
});
