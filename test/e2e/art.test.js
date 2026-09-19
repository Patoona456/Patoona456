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
// simply absent from it. That is a convention, not an error - a bow lives on
// your back until you shoot - so the rule here is narrow and load-bearing:
// whatever pose a class SWINGS with, its sheet must have pixels for.
import test from 'node:test';
import assert from 'node:assert/strict';
import { playwright, startServer, startBrowser, BASE, skipWithoutPlaywright } from './harness.js';
import { ITEMS } from '../../shared/data/items.js';
import { swingAnim, WEAPON_CLASSES } from '../../shared/weapons.js';
import { ANIM } from '../../shared/constants.js';

const pw = await playwright();

test('weapon art', skipWithoutPlaywright.skip && !pw ? skipWithoutPlaywright : {}, async (t) => {
  if (!pw) return;
  const server = await startServer();
  const browser = await startBrowser(pw);
  t.after(async () => { await browser.close(); await server.stop(); });

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  /** How many non-transparent pixels a sheet has in one pose, facing down. */
  const inkOf = (url, row) => page.evaluate(async ([u, r]) => {
    const img = new Image();
    try {
      await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('404')); img.src = u; });
    } catch { return -1; }
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    // the busiest frame of the pose, so a sheet is not judged by a wind-up
    let best = 0;
    for (let col = 0; col < 6; col++) {
      const d = g.getImageData(col * 64, r * 64, 64, 64).data;
      let n = 0;
      for (let p = 3; p < d.length; p += 4) if (d[p] > 8) n++;
      if (n > best) best = n;
    }
    return best;
  }, [url, row]);

  const urlOf = (sprite, gender) => {
    const either = ['bow', 'recurvebow', 'greatbow', 'longspear', 'arrow'].includes(sprite.key);
    return `${BASE}/assets/lpc/weapon/${either ? 'either' : gender}/${sprite.key}.png`;
  };

  await t.test('every weapon is drawn in the pose it swings with', async () => {
    const weapons = Object.values(ITEMS).filter((it) => it.slot === 'weapon' && it.sprite);
    assert.ok(weapons.length > 20, 'the item table lost its weapons');
    const bad = [];
    const cache = new Map();
    for (const it of weapons) {
      const anim = swingAnim(it.wclass);
      const row = ANIM[anim].row + 2;                      // +2 is facing down
      // `gendered: false` sheets live under either/; the rest exist per
      // gender, and a sheet missing for one gender is its own failure
      const genders = it.sprite.gendered === false ? ['either'] : ['male', 'female'];
      for (const g of genders) {
        const url = urlOf(it.sprite, g);
        const key = url + '#' + row;
        if (!cache.has(key)) cache.set(key, await inkOf(url, row));
        const ink = cache.get(key);
        if (ink === -1) {
          // a gender the art set never shipped is allowed only when the item
          // names the fallback the client actually uses
          if (!it.sprite.fallback) bad.push(`${it.id}: no ${g} sheet for ${it.sprite.key} and no fallback`);
          continue;
        }
        if (ink <= 0) bad.push(`${it.id} (${it.wclass}) swings '${anim}' but ${it.sprite.key}/${g} has no ${anim} frames`);
      }
    }
    assert.deepEqual(bad, [], bad.join('; '));
  });

  await t.test('every class swings with a pose the sheets actually have', async () => {
    // The refine aura is painted from the weapon layer, so a class whose
    // swing pose is empty loses its +15 as well as its weapon.
    for (const [id, cls] of Object.entries(WEAPON_CLASSES)) {
      assert.ok(ANIM[cls.anim], `${id} swings with an animation that does not exist: ${cls.anim}`);
    }
    // the sheet the client falls back to must be drawable in every pose a
    // fallback could be asked for
    const dagger = await inkOf(`${BASE}/assets/lpc/weapon/male/dagger.png`, ANIM.slash.row + 2);
    assert.ok(dagger > 0, 'the dagger sheet, which most placeholders borrow, has no slash frames');
  });

  t.after(async () => { await ctx.close(); });
});
