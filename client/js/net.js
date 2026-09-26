// Thin websocket client with reconnect + a handler table.
export class Net {
  constructor(url) {
    this.url = url ?? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    this.handlers = new Map();
    this.queue = [];
    this.ws = null;
    this.connected = false;
    this.ping = 0;
    this.reconnectDelay = 1000;
  }

  on(type, fn) { this.handlers.set(type, fn); return this; }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectDelay = 1000;
      for (const m of this.queue.splice(0)) this.send(m);
      this.handlers.get('_open')?.();
      this.pingTimer = setInterval(() => this.send({ t: 'ping', ts: Date.now() }), 5000);
    };
    this.ws.onclose = () => {
      this.connected = false;
      clearInterval(this.pingTimer);
      this.handlers.get('_close')?.();
      setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(10000, this.reconnectDelay * 1.7);
    };
    this.ws.onerror = () => { /* onclose does the work */ };
    this.ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'pong') { this.ping = Date.now() - m.ts; return; }
      const h = this.handlers.get(m.t);
      if (h) h(m); else this.handlers.get('_any')?.(m);
    };
  }

  send(obj) {
    if (!this.connected) { this.queue.push(obj); return; }
    try { this.ws.send(JSON.stringify(obj)); } catch { this.queue.push(obj); }
  }
}
