// Sound. Everything here is synthesised with WebAudio at runtime - the game
// ships no audio files, so a zone's music weighs nothing and never 404s.
//
// Three buses: master -> (sfx | music). Volumes live in localStorage.
// The context starts suspended until the first gesture, which browsers require.

const KEY = 'emberfall-audio';
const DEFAULTS = { master: 0.7, sfx: 0.8, music: 0.45, muted: false };

// Pentatonic-ish scale, so anything we arpeggiate lands in key.
const NOTE = (semi) => 220 * Math.pow(2, semi / 12);

/** Per-zone-theme colour for the ambient bed. */
const BEDS = {
  town:  { root: -5, chord: [0, 7, 12, 16], wind: 0.05, bright: 1600, sway: 0.05 },
  grass: { root: -3, chord: [0, 7, 12, 19], wind: 0.12, bright: 2600, sway: 0.07 },
  marsh: { root: -7, chord: [0, 3, 10, 15], wind: 0.16, bright: 900, sway: 0.06 },
  crypt: { root: -12, chord: [0, 5, 7, 12], wind: 0.10, bright: 500, sway: 0.03 },
  rock:  { root: -10, chord: [0, 3, 7, 14], wind: 0.14, bright: 800, sway: 0.04 },
  ice:   { root: -2, chord: [0, 4, 7, 11], wind: 0.20, bright: 3200, sway: 0.05 },
};

export class Audio {
  constructor() {
    this.settings = { ...DEFAULTS, ...load() };
    this.ctx = null;
    this.bed = null;
    this.bedTheme = null;
    this.lastAt = new Map();   // sound -> time, so a burst of hits is one hit
    this.listener = { x: 0, y: 0 };
    const wake = () => this.resume();
    for (const ev of ['pointerdown', 'keydown', 'touchstart', 'gamepadconnected']) {
      addEventListener(ev, wake, { passive: true });
    }
  }

  /* ---------------- plumbing ---------------- */

  /** Build the graph on first use; browsers only allow this after a gesture. */
  resume() {
    if (!this.ctx) {
      const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      // a touch of glue so the loud moments do not clip
      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -10;
      this.limiter.ratio.value = 6;
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.master.connect(this.limiter).connect(this.ctx.destination);
      this.applyVolumes();
      if (this.bedTheme) this.startBed(this.bedTheme);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = this.settings;
    const g = s.muted ? 0 : s.master;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(g, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfx, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.music, t, 0.05);
  }

  set(key, value) {
    this.settings[key] = value;
    save(this.settings);
    this.resume();
    this.applyVolumes();
  }

  toggleMute() {
    this.set('muted', !this.settings.muted);
    if (!this.settings.muted) this.play('ui');
    return this.settings.muted;
  }

  /* ---------------- voices ---------------- */

  /** One oscillator with an envelope. Everything below is built from this. */
  tone({ freq = 440, to = null, type = 'sine', at = 0, dur = 0.2, gain = 0.2,
    attack = 0.005, bus = 'sfx', pan = 0, detune = 0, curve = 'exp' } = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(freq, t0);
    if (to && to !== freq) {
      if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
      else osc.frequency.linearRampToValueAtTime(Math.max(1, to), t0 + dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    this.route(g, bus, pan);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** Filtered noise: impacts, wind, footsteps. */
  noise({ at = 0, dur = 0.15, gain = 0.2, type = 'bandpass', freq = 1200, q = 1,
    to = null, bus = 'sfx', pan = 0 } = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + at;
    const len = Math.max(1, Math.floor(ctx.sampleRate * (dur + 0.02)));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(freq, t0);
    filt.Q.value = q;
    if (to) filt.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0001, gain), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(g);
    this.route(g, bus, pan);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  route(node, bus, pan) {
    const dest = bus === 'music' ? this.musicBus : this.sfxBus;
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(p).connect(dest);
    } else {
      node.connect(dest);
    }
  }

  /* ---------------- the sound list ---------------- */

  /**
   * Play a named sound. `where` is a world position: sounds off to the side
   * pan, and distant ones fade, so a fight across the screen stays readable.
   */
  play(name, where = null, opts = {}) {
    if (this.settings.muted) return;
    if (!this.ctx) { this.resume(); if (!this.ctx) return; }
    if (this.ctx.state !== 'running') return;

    // one voice per sound per 40ms - a five-hit combo should not sound like ten
    const now = this.ctx.currentTime;
    const gate = opts.gate ?? 0.04;
    if (now - (this.lastAt.get(name) ?? -9) < gate) return;
    this.lastAt.set(name, now);

    let pan = 0;
    let far = 1;
    if (where) {
      const dx = where.x - this.listener.x;
      const dy = where.y - this.listener.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 720) return;                       // out of earshot
      pan = Math.max(-0.8, Math.min(0.8, dx / 420));
      far = Math.max(0.15, 1 - dist / 720);
    }
    const v = (opts.gain ?? 1) * far;
    const S = SOUNDS[name];
    if (S) S(this, { pan, v, ...opts });
  }

  /* ---------------- ambient bed ---------------- */

  /** A slow pad plus wind, coloured by the zone theme. Restarts on zone change. */
  startBed(theme) {
    this.bedTheme = theme;
    if (!this.ctx) return;
    this.stopBed(1.2);
    const def = BEDS[theme] ?? BEDS.grass;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.5, t + 2.5);
    out.connect(this.musicBus);

    const nodes = [];
    // pad: a few detuned voices drifting against each other
    def.chord.forEach((semi, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.value = NOTE(def.root + semi) / (i === 0 ? 2 : 1);
      osc.detune.value = (i - 1.5) * 6;
      const g = ctx.createGain();
      g.gain.value = 0.10 / (i + 1);
      // each voice breathes on its own slow LFO, so the pad never sits still
      const lfo = ctx.createOscillator();
      lfo.frequency.value = def.sway * (0.6 + i * 0.25);
      const lg = ctx.createGain();
      lg.gain.value = g.gain.value * 0.7;
      lfo.connect(lg).connect(g.gain);
      osc.connect(g).connect(out);
      osc.start(t); lfo.start(t);
      nodes.push(osc, lfo);
    });

    // wind / room tone: looping noise through a lazy filter sweep
    const len = Math.floor(ctx.sampleRate * 4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last * 0.96 + (Math.random() * 2 - 1) * 0.04);   // brown-ish noise
      d[i] = last * 3;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = def.bright;
    filt.Q.value = 0.6;
    const wg = ctx.createGain();
    wg.gain.value = def.wind;
    const sweep = ctx.createOscillator();
    sweep.frequency.value = 0.06;
    const sg = ctx.createGain();
    sg.gain.value = def.bright * 0.4;
    sweep.connect(sg).connect(filt.frequency);
    src.connect(filt).connect(wg).connect(out);
    src.start(t); sweep.start(t);
    nodes.push(src, sweep);

    this.bed = { out, nodes };
  }

  stopBed(fade = 0.8) {
    const bed = this.bed;
    if (!bed || !this.ctx) return;
    this.bed = null;
    const t = this.ctx.currentTime;
    bed.out.gain.cancelScheduledValues(t);
    bed.out.gain.setValueAtTime(Math.max(0.0001, bed.out.gain.value), t);
    bed.out.gain.exponentialRampToValueAtTime(0.0001, t + fade);
    for (const n of bed.nodes) { try { n.stop(t + fade + 0.05); } catch { /* already stopped */ } }
  }
}

/* Each entry gets the engine and { pan, v }. Keep them short: a game sound
   that outlasts its animation feels like lag. */
const SOUNDS = {
  hit: (a, { pan, v }) => {
    a.noise({ dur: 0.09, gain: 0.30 * v, freq: 1800, to: 500, q: 0.8, pan });
    a.tone({ freq: 190, to: 90, type: 'square', dur: 0.09, gain: 0.10 * v, pan });
  },
  crit: (a, { pan, v }) => {
    a.noise({ dur: 0.14, gain: 0.34 * v, freq: 3200, to: 700, q: 0.7, pan });
    a.tone({ freq: 300, to: 110, type: 'sawtooth', dur: 0.16, gain: 0.14 * v, pan });
    a.tone({ freq: NOTE(19), to: NOTE(26), type: 'triangle', at: 0.02, dur: 0.18, gain: 0.10 * v, pan });
  },
  hurt: (a, { pan, v }) => {
    a.tone({ freq: 160, to: 62, type: 'sawtooth', dur: 0.26, gain: 0.20 * v, pan });
    a.noise({ dur: 0.18, gain: 0.18 * v, freq: 700, to: 200, pan });
  },
  miss: (a, { pan, v }) => a.noise({ dur: 0.10, gain: 0.12 * v, freq: 2600, to: 1400, q: 2, pan }),
  block: (a, { pan, v }) => {
    a.noise({ dur: 0.10, gain: 0.22 * v, freq: 4200, to: 2200, q: 1.5, pan });
    a.tone({ freq: 900, to: 620, type: 'square', dur: 0.08, gain: 0.07 * v, pan });
  },
  swing: (a, { pan, v }) => a.noise({ dur: 0.13, gain: 0.10 * v, type: 'bandpass', freq: 900, to: 2400, q: 0.8, pan }),
  die: (a, { pan, v }) => {
    a.tone({ freq: 260, to: 70, type: 'triangle', dur: 0.45, gain: 0.16 * v, pan });
    a.noise({ dur: 0.35, gain: 0.14 * v, freq: 1400, to: 200, pan });
  },

  heal: (a, { pan, v }) => {
    [0, 7, 12].forEach((s, i) => a.tone({ freq: NOTE(12 + s), type: 'sine', at: i * 0.05, dur: 0.30, gain: 0.11 * v, pan }));
  },
  buff: (a, { pan, v }) => {
    a.tone({ freq: NOTE(7), to: NOTE(19), type: 'triangle', dur: 0.40, gain: 0.10 * v, pan });
    a.noise({ dur: 0.40, gain: 0.05 * v, freq: 2600, to: 5200, q: 3, pan });
  },
  debuff: (a, { pan, v }) => a.tone({ freq: NOTE(10), to: NOTE(-6), type: 'sawtooth', dur: 0.42, gain: 0.10 * v, pan }),
  cast: (a, { pan, v }) => a.tone({ freq: NOTE(5), to: NOTE(17), type: 'sine', dur: 0.24, gain: 0.09 * v, pan }),
  bolt: (a, { pan, v }) => {
    a.tone({ freq: 1500, to: 400, type: 'sawtooth', dur: 0.16, gain: 0.11 * v, pan });
    a.noise({ dur: 0.14, gain: 0.16 * v, freq: 5200, to: 1600, q: 0.7, pan });
  },
  aoe: (a, { pan, v }) => {
    a.tone({ freq: 140, to: 44, type: 'sine', dur: 0.50, gain: 0.26 * v, pan });
    a.noise({ dur: 0.44, gain: 0.24 * v, type: 'lowpass', freq: 1400, to: 160, pan });
  },
  line: (a, { pan, v }) => a.noise({ dur: 0.26, gain: 0.16 * v, freq: 600, to: 3400, q: 0.9, pan }),
  ground: (a, { pan, v }) => {
    a.tone({ freq: 90, to: 50, type: 'triangle', dur: 0.55, gain: 0.18 * v, pan });
    a.noise({ dur: 0.5, gain: 0.12 * v, type: 'lowpass', freq: 900, to: 220, pan });
  },
  dash: (a, { pan, v }) => a.noise({ dur: 0.20, gain: 0.16 * v, freq: 400, to: 2800, q: 0.6, pan }),
  summon: (a, { pan, v }) => {
    [0, 5, 9, 12].forEach((s, i) => a.tone({ freq: NOTE(s), type: 'triangle', at: i * 0.06, dur: 0.30, gain: 0.09 * v, pan }));
  },

  levelup: (a, { v }) => {
    [0, 4, 7, 12, 16].forEach((s, i) => a.tone({ freq: NOTE(12 + s), type: 'triangle', at: i * 0.09, dur: 0.42, gain: 0.13 * v }));
    a.tone({ freq: NOTE(24), type: 'sine', at: 0.45, dur: 0.8, gain: 0.10 * v });
  },
  quest: (a, { v }) => [0, 7, 16].forEach((s, i) => a.tone({ freq: NOTE(12 + s), type: 'sine', at: i * 0.08, dur: 0.35, gain: 0.11 * v })),
  coin: (a, { v }) => {
    a.tone({ freq: NOTE(24), type: 'square', dur: 0.07, gain: 0.07 * v });
    a.tone({ freq: NOTE(31), type: 'square', at: 0.05, dur: 0.10, gain: 0.06 * v });
  },
  loot: (a, { pan, v }) => {
    a.tone({ freq: NOTE(19), to: NOTE(26), type: 'triangle', dur: 0.14, gain: 0.09 * v, pan });
    a.noise({ dur: 0.08, gain: 0.07 * v, freq: 3400, q: 2, pan });
  },
  potion: (a, { v }) => {
    a.tone({ freq: 700, to: 1500, type: 'sine', dur: 0.18, gain: 0.08 * v });
    a.noise({ dur: 0.22, gain: 0.07 * v, freq: 1800, to: 3600, q: 2 });
  },
  forge: (a, { v }) => {
    a.noise({ dur: 0.12, gain: 0.26 * v, freq: 2600, to: 900, q: 0.9 });
    a.tone({ freq: 420, to: 180, type: 'square', dur: 0.14, gain: 0.10 * v });
    a.tone({ freq: NOTE(28), type: 'sine', at: 0.10, dur: 0.30, gain: 0.07 * v });
  },
  fail: (a, { v }) => {
    a.tone({ freq: 240, to: 90, type: 'sawtooth', dur: 0.32, gain: 0.14 * v });
    a.noise({ dur: 0.24, gain: 0.12 * v, type: 'lowpass', freq: 900, to: 200 });
  },
  warp: (a, { v }) => {
    a.tone({ freq: NOTE(0), to: NOTE(24), type: 'sine', dur: 0.7, gain: 0.12 * v });
    a.noise({ dur: 0.7, gain: 0.10 * v, freq: 400, to: 4800, q: 1.2 });
  },
  death: (a, { v }) => {
    [0, -3, -7, -12].forEach((s, i) => a.tone({ freq: NOTE(12 + s), type: 'triangle', at: i * 0.14, dur: 0.6, gain: 0.13 * v }));
  },

  ui: (a, { v }) => a.tone({ freq: 900, type: 'square', dur: 0.035, gain: 0.05 * v }),
  open: (a, { v }) => {
    a.tone({ freq: 520, to: 780, type: 'triangle', dur: 0.10, gain: 0.06 * v });
    a.noise({ dur: 0.07, gain: 0.05 * v, freq: 2400, q: 1.5 });
  },
  close: (a, { v }) => a.tone({ freq: 640, to: 380, type: 'triangle', dur: 0.09, gain: 0.05 * v }),
  good: (a, { v }) => [0, 7].forEach((s, i) => a.tone({ freq: NOTE(19 + s), type: 'sine', at: i * 0.06, dur: 0.20, gain: 0.08 * v })),
  bad: (a, { v }) => a.tone({ freq: 340, to: 190, type: 'square', dur: 0.16, gain: 0.08 * v }),
  warn: (a, { v }) => a.tone({ freq: NOTE(14), type: 'triangle', dur: 0.12, gain: 0.07 * v }),
};

export const SOUND_NAMES = Object.keys(SOUNDS);

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; }
}
function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* no storage */ }
}
