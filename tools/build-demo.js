#!/usr/bin/env node
/**
 * Builds the single-page, offline build of the game:
 *
 *   node tools/build-demo.js [outDir]        # default: dist/demo
 *
 * It copies the client, the shared data and the *real* server into one folder
 * and adds an import map that swaps three modules for browser stand-ins
 * (demo/): the websocket client becomes an in-page loopback, the JSON file
 * store becomes localStorage, and node:crypto becomes a tiny digest. Serve the
 * folder with any static server - there is no backend.
 */
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] ?? path.join(root, 'dist', 'demo'));

const CLIENT = ['main', 'input', 'renderer', 'sprites', 'props', 'terrain', 'ui', 'icons', 'audio', 'particles'];

await mkdir(path.join(out, 'client', 'js'), { recursive: true });
for (const f of CLIENT) {
  let src = await readFile(path.join(root, 'client', 'js', `${f}.js`), 'utf8');
  // published artifacts live under a path prefix, so assets are referenced relatively
  src = src.replace("const BASE = '/assets/lpc';", "const BASE = 'assets/lpc';");
  await writeFile(path.join(out, 'client', 'js', `${f}.js`), src);
}
await cp(path.join(root, 'shared'), path.join(out, 'shared'), { recursive: true });
await cp(path.join(root, 'server', 'game'), path.join(out, 'server', 'game'), { recursive: true });
for (const f of ['net.js', 'accounts.js']) {
  await cp(path.join(root, 'server', f), path.join(out, 'server', f));
}
await cp(path.join(root, 'demo'), path.join(out, 'demo'), { recursive: true });
await cp(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true });

const css = await readFile(path.join(root, 'client', 'css', 'style.css'), 'utf8');
const html = await readFile(path.join(root, 'client', 'index.html'), 'utf8');
const body = '<canvas id="game"></canvas>' + html.split('<canvas id="game"></canvas>')[1].split('<script')[0];
const shell = await readFile(path.join(root, 'demo', 'page.html'), 'utf8');

await writeFile(
  path.join(out, 'index.html'),
  shell.replace('/*STYLE*/', css).replace('<!--BODY-->', body)
);

console.log(`demo build -> ${path.relative(root, out)}`);
console.log('serve it with any static file server, e.g.  npx serve dist/demo');
