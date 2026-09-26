// Drop-in replacement for client/js/net.js.
// Instead of opening a websocket, it boots the real authoritative server in
// this page and hands the client a socket that loops straight back into it -
// same protocol, same code, no network.
import { World } from '../server/game/world.js';
import { Conn } from '../server/net.js';
import { load, startAutosave, save } from './shim-persistence.js';

let world = null;

async function boot() {
  if (world) return world;
  await load();
  world = new World();
  world.start();
  startAutosave();
  globalThis.__world = world;
  return world;
}

export class Net {
  constructor() {
    this.handlers = new Map();
    this.connected = false;
    this.ping = 0;
    this.local = true;
  }

  on(type, fn) { this.handlers.set(type, fn); return this; }

  async connect() {
    const w = await boot();
    const self = this;
    const socket = {
      readyState: 1,
      send(text) { queueMicrotask(() => self.receive(text)); },
      on(event, cb) { (this.listeners ??= {})[event] = cb; },
      close() { this.readyState = 3; },
      terminate() { this.readyState = 3; },
      ping() {},
    };
    this.socket = socket;
    this.conn = new Conn(socket, w, 'local');
    this.connected = true;
    this.handlers.get('_open')?.();
    addEventListener('pagehide', () => { try { this.conn.onClose(); save(true); } catch { /* leaving */ } });
  }

  receive(text) {
    let m;
    try { m = JSON.parse(text); } catch { return; }
    if (m.t === 'pong') { this.ping = Math.max(0, Date.now() - m.ts); return; }
    const h = this.handlers.get(m.t) ?? this.handlers.get('_any');
    h?.(m);
  }

  send(obj) {
    if (!this.conn) return;
    try { this.conn.onMessage(JSON.stringify(obj)); }
    catch (e) { console.error('[loopback]', obj?.t, e); }
  }
}
