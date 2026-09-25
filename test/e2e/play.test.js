// The game, played in a real browser against a real server.
//
// These are slow, so they cover only what the unit tests cannot: that the
// client boots, that a character can be made and walked into the world, that
// the panels open, and that a fight actually exchanges damage. Anything that
// can be asserted without a browser belongs in the faster files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { playwright, startServer, startBrowser, join, snapshot, skipWithoutPlaywright } from './harness.js';

const pw = await playwright();

test('browser tests', skipWithoutPlaywright.skip && !pw ? skipWithoutPlaywright : {}, async (t) => {
  if (!pw) return;
  const server = await startServer();
  const browser = await startBrowser(pw);
  t.after(async () => { await browser.close(); await server.stop(); });

  await t.test('a new player can register, make a character and enter the world', async () => {
    const { page, errors, ctx } = await join(browser);
    const s = await snapshot(page);
    assert.equal(s.zone, 'emberhold', 'new characters should start in town');
    assert.equal(s.level, 1);
    assert.ok(s.maxHp > 0 && s.hp === s.maxHp, 'a new character should be at full health');
    assert.deepEqual(errors, [], 'the client logged errors while starting up');
    await ctx.close();
  });

  await t.test('after walking through a gate you still have a name', async () => {
    const { page, errors, ctx } = await join(browser);
    const myName = () => page.evaluate(() => {
      const g = window.__game;
      return g.entities.get(g.state.myId)?.n ?? null;
    });
    const expected = await page.evaluate(() => window.__game.self?.name);
    for (const map of ['greenmire', 'emberhold']) {
      await page.evaluate((m) => window.__game.net.send({ t: 'devWarp', map: m }), map);
      await page.waitForFunction((m) => window.__game.renderer.zone?.id === m, map, { timeout: 5000 });
      await page.waitForTimeout(400);
      assert.equal(await myName(), expected, `own name missing after arriving in ${map}`);
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  await t.test('every menu panel opens without throwing', async () => {
    const { page, errors, ctx } = await join(browser);
    for (const panel of ['character', 'inventory', 'skills', 'quests', 'party', 'settings']) {
      // the less-used panels fold away behind "more"
      if (await page.locator(`#menu-buttons .btn.more[data-panel="${panel}"]`).count()) await page.click('#menu-more');
      await page.click(`#menu-buttons .btn[data-panel="${panel}"]`);
      await page.waitForSelector('.win.window', { timeout: 5000 });
      const titles = await page.locator('.win.window > header h2').allTextContents();
      assert.ok(titles.some((t) => t.trim()), `the ${panel} panel opened with no title`);
      // Close through the UI's own API rather than the button: some panels
      // redraw themselves when fresh state arrives from the server, which
      // detaches the button mid-click. The close button itself is covered
      // separately below.
      await page.evaluate(() => {
        const ui = window.__game.ui;
        for (const name of [...ui.openPanels.keys()]) ui.close(name);
      });
      await page.waitForTimeout(120);
    }
    // and the close button works, on a panel that does not redraw itself
    await page.click('#menu-buttons .btn[data-panel="inventory"]');
    await page.waitForSelector('.win.window');
    await page.locator('.win.window .close').last().click();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.win.window').count(), 0, 'the close button did not close the window');

    assert.deepEqual(errors, [], 'opening the panels logged errors');
    await ctx.close();
  });

  await t.test('the paper doll has a slot for every place gear can go', async () => {
    const { page, ctx } = await join(browser);
    await page.click('#menu-buttons .btn[data-panel="character"]');
    await page.waitForSelector('.doll');
    const slots = await page.locator('.doll .doll-slot').count();
    const { SLOTS } = await import('../../shared/constants.js');
    assert.equal(slots, SLOTS.length, 'the doll and the slot list disagree');
    await ctx.close();
  });

  await t.test('a fight exchanges damage in both directions', async () => {
    const { page, errors, ctx } = await join(browser);
    // out to the field, then swing at whatever is nearest
    // (the slime meadow east of the north stairs: open ground, no river between)
    await page.evaluate(() => window.__game.net.send({ t: 'devWarp', map: 'greenmire', at: [54, 8] }));
    await page.waitForFunction(() => window.__game.renderer.zone?.id === 'greenmire', null, { timeout: 10000 });
    await page.waitForFunction(() => (window.__game.state.ents ?? []).some((e) => e.k === 'm'), null, { timeout: 15000 });

    const hit = await page.evaluate(async () => {
      const g = window.__game;
      const skip = new Set();
      const mob = () => (g.state.ents ?? []).filter((e) => e.k === 'm' && !skip.has(e.id))
        .sort((a, b) => Math.hypot(a.x - g.predicted.x, a.y - g.predicted.y)
          - Math.hypot(b.x - g.predicted.x, b.y - g.predicted.y))[0];
      let start = mob();
      if (!start) return { error: 'no monster in range' };
      let startHp = start.hp, best = Infinity, stuck = 0;
      g.net.send({ t: 'target', id: start.id });
      // Spawn points are random, so the walk to the nearest monster can be
      // most of the field. A budget tight enough to fail on an unlucky spawn
      // is a test that reports the weather, not the code.
      for (let i = 0; i < 300; i++) {
        const m = mob();
        if (!m) break;
        const dx = m.x - g.predicted.x, dy = m.y - g.predicted.y;
        const d = Math.hypot(dx, dy) || 1;
        // a monster behind a tree or across the river cannot be walked to
        // in a straight line: give up on it and try the next nearest
        if (m.id !== start.id) { start = m; startHp = m.hp; best = Infinity; stuck = 0; }
        if (d <= 30 || d < best - 2) { best = Math.min(best, d); stuck = 0; } else if (++stuck > 15) { skip.add(m.id); continue; }
        if (d > 30) g.net.send({ t: 'input', mx: dx / d, my: dy / d });
        else { g.net.send({ t: 'input', mx: 0, my: 0 }); g.net.send({ t: 'attack', on: true, id: m.id }); }
        await new Promise((r) => setTimeout(r, 100));
        const now = (g.state.ents ?? []).find((e) => e.id === start.id);
        if (!now || now.hp < startHp) return { damaged: true, from: startHp, to: now?.hp ?? 0 };
      }
      const m = mob();
      return { damaged: false, stillAway: m ? Math.round(Math.hypot(m.x - g.predicted.x, m.y - g.predicted.y)) : null };
    });
    assert.ok(hit.damaged, `no damage was dealt: ${JSON.stringify(hit)}`);
    assert.deepEqual(errors, [], 'fighting logged errors');
    await ctx.close();
  });

  await t.test('the phone layout puts nothing on top of anything else', async () => {
    for (const viewport of [{ width: 844, height: 390 }, { width: 412, height: 915 }]) {
      const { page, errors, ctx } = await join(browser, { viewport, touch: true });
      const boxes = await page.evaluate(() => {
        const ids = ['vitals', 'currencies', 'topright', 'stick', 'buttons', 'chat', 'actionbar', 'menu-buttons', 'expstrip'];
        return ids.map((id) => {
          const el = document.getElementById(id);
          if (!el || el.classList.contains('hidden')) return null;
          const r = el.getBoundingClientRect();
          return r.width && r.height ? { id, x: r.x, y: r.y, w: r.width, h: r.height } : null;
        }).filter(Boolean);
      });
      const overlaps = [];
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          const over = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          if (over) overlaps.push(`${a.id} over ${b.id}`);
        }
      }
      assert.deepEqual(overlaps, [], `${viewport.width}x${viewport.height}: HUD pieces sit on top of each other`);
      const off = boxes.filter((b) => b.x < 0 || b.y < 0 || b.x + b.w > viewport.width + 1 || b.y + b.h > viewport.height + 1);
      assert.deepEqual(off.map((b) => b.id), [], `${viewport.width}x${viewport.height}: HUD pieces hang off the screen`);
      assert.deepEqual(errors, [], `${viewport.width}x${viewport.height}: the client logged errors`);
      await ctx.close();
    }
  });
});
