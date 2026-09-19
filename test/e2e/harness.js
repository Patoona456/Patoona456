// Shared plumbing for the browser tests.
//
// These need three things the unit tests do not: a real server, a real
// browser, and a character standing in the world. All three are expensive, so
// each test file sets them up once and shares them.
//
// Playwright is an optional dependency. If it is not installed the e2e tests
// skip rather than fail, so `npm test` still works on a clean checkout.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PORT = Number(process.env.EMBERFALL_TEST_PORT ?? 8199);
export const BASE = `http://127.0.0.1:${PORT}`;

/** Playwright, or null when it is not installed. */
export async function playwright() {
  try {
    return await import('playwright');
  } catch {
    return null;
  }
}

export const skipWithoutPlaywright = {
  skip: 'playwright is not installed (npm i -D playwright && npx playwright install chromium)',
};

/** Start the game server on a scratch database, and stop it again afterwards. */
export async function startServer() {
  const data = await mkdtemp(path.join(tmpdir(), 'emberfall-test-'));
  const proc = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
    cwd: ROOT,
    env: {
      ...process.env, PORT: String(PORT), EMBERFALL_DATA: data, EMBERFALL_DEV: '1',
      // the tests all register from 127.0.0.1; the per-address cap is proved
      // on purpose in security.test.js, not tripped over by everything else
      EMBERFALL_MAX_ACCOUNTS_PER_IP: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = [];
  proc.stdout.on('data', (d) => log.push(String(d)));
  proc.stderr.on('data', (d) => log.push(String(d)));

  // wait for it to answer, rather than guessing at a sleep
  const deadline = Date.now() + 20000;
  for (;;) {
    if (Date.now() > deadline) {
      proc.kill('SIGKILL');
      throw new Error(`server never came up:\n${log.join('')}`);
    }
    try {
      const res = await fetch(BASE, { signal: AbortSignal.timeout(1000) });
      if (res.ok) break;
    } catch { /* not listening yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }

  return {
    log,
    async stop() {
      proc.kill('SIGTERM');
      await new Promise((r) => { proc.on('exit', r); setTimeout(r, 3000); });
      await rm(data, { recursive: true, force: true });
    },
  };
}

/** Launch a browser. Honours EMBERFALL_CHROMIUM for sandboxed CI images. */
export async function startBrowser(pw) {
  const executablePath = process.env.EMBERFALL_CHROMIUM || undefined;
  return pw.chromium.launch({ executablePath, args: ['--no-sandbox'] });
}

/**
 * Register, make a character, and walk into the world. Returns the page plus
 * the errors it has collected, which every test asserts on.
 */
export async function join(browser, { viewport = { width: 1280, height: 800 }, touch = false } = {}) {
  const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    // the font CDN is not reachable from a sandboxed test runner, and a
    // missing favicon is not a game bug
    if (/CERT|favicon|fonts\.googleapis/.test(text)) return;
    errors.push(text);
  });

  await page.goto(BASE + (touch ? '/?touch=1' : '/'), { waitUntil: 'networkidle' });

  // On a phone held upright the game offers to go landscape, and that offer
  // covers the login form. Wave it away first - the same thing a player does.
  const gate = await page.evaluate(() => !document.querySelector('#rotate')?.classList.contains('hidden'));
  if (gate) {
    await page.click('#btn-stay-portrait');
    // the gate hides itself with a class, so wait on the class, not on
    // visibility - a display:none element is never "visible"
    await page.waitForFunction(
      () => document.querySelector('#rotate')?.classList.contains('hidden'),
      null, { timeout: 5000 },
    );
  }

  const tag = Math.floor(Math.random() * 1e9).toString(36);
  await page.fill('#acc', 't' + tag);
  await page.fill('#pw', 'pass1234');
  await page.click('#btn-reg');
  await page.waitForSelector('text=+ สร้างตัวละครใหม่', { timeout: 10000 });
  await page.getByText('+ สร้างตัวละครใหม่').click();
  await page.waitForSelector('#cprev');
  await page.fill('#cname', 'ท' + tag.slice(0, 6));
  await page.click('#btn-create');
  await page.waitForSelector('.char-card', { timeout: 10000 });
  await page.click('.char-card');
  await page.waitForSelector('#hud:not(.hidden)', { timeout: 10000 });
  await page.waitForFunction(() => window.__game?.state?.me, null, { timeout: 10000 });
  return { page, errors, ctx };
}

/** Everything the client knows about itself right now. */
export const snapshot = (page) => page.evaluate(() => {
  const g = window.__game;
  return {
    name: g.self?.name, level: g.self?.level, hp: g.self?.hp, maxHp: g.self?.maxHp,
    zone: g.renderer.zone?.id, entities: (g.state.ents ?? []).length,
    aurum: g.self?.aurum,
  };
});
