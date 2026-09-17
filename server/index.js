// Entry point: static file server for the client + the game websocket.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { load, save, startAutosave } from './persistence.js';
import { World } from './game/world.js';
import { Conn } from './net.js';
import { GAME_NAME } from '../shared/constants.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

// Only these top-level folders are ever served.
const SERVE_DIRS = ['client', 'shared', 'assets'];

async function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/client/index.html';
  if (urlPath === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, game: GAME_NAME, players: world.players.size }));
  }

  const rel = path.normalize(urlPath).replace(/^([/\\])+/, '');
  const top = rel.split(/[/\\]/)[0];
  if (!SERVE_DIRS.includes(top)) {
    res.writeHead(404); return res.end('not found');
  }
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }

  try {
    const s = await stat(file);
    if (s.isDirectory()) { res.writeHead(404); return res.end('not found'); }
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': top === 'assets' ? 'public, max-age=86400' : 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}

await load();
const world = new World();
world.start();

const server = http.createServer((req, res) => { serveStatic(req, res); });
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  new Conn(ws, world, ip);
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);
heartbeat.unref?.();

startAutosave();

server.listen(PORT, HOST, () => {
  console.log(`[${GAME_NAME}] http://localhost:${PORT}  (ws://localhost:${PORT}/ws)`);
  console.log(`[world] ${world.zones.size} zones online`);
});

let shuttingDown = false;
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('\n[server] shutting down, saving world...');
    await world.shutdown();
    wss.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
process.on('unhandledRejection', (e) => console.error('[unhandled]', e));
