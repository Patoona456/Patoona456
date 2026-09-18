// Unified input: gamepad first, touch second, keyboard third.
// Everything upstream only ever sees "actions" and two analog sticks.

export const ACTIONS = [
  'attack', 'interact', 'cancel', 'targetNext', 'targetPrev',
  'skill1', 'skill2', 'skill3', 'skill4', 'skill5', 'skill6',
  'menu', 'map', 'chat', 'sit', 'pickup',
  'zoomIn', 'zoomOut', 'zoomCycle',
];

const KEYMAP = {
  Space: 'attack', KeyE: 'interact', Escape: 'cancel', Tab: 'targetNext', KeyQ: 'targetPrev',
  Digit1: 'skill1', Digit2: 'skill2', Digit3: 'skill3', Digit4: 'skill4', Digit5: 'skill5', Digit6: 'skill6',
  KeyZ: 'pickup', KeyX: 'sit',
  Minus: 'zoomOut', NumpadSubtract: 'zoomOut',
  Equal: 'zoomIn', NumpadAdd: 'zoomIn',
};

// Standard gamepad layout.
const PAD_BUTTONS = {
  0: 'interact', 1: 'cancel', 2: 'attack', 3: 'pickup',
  4: 'targetPrev', 5: 'targetNext',
  8: 'map', 9: 'menu', 11: 'zoomCycle',
  12: 'skill1', 13: 'skill2', 14: 'skill3', 15: 'skill4',
};
const MOD_BUTTON = 6;       // LT: shifts the d-pad to skills 5/6
const ATTACK_TRIGGER = 7;   // RT: hold to keep attacking

export class Input {
  constructor() {
    this.move = { x: 0, y: 0 };
    this.aim = { x: 0, y: 0 };
    this.held = new Set();
    this.pressed = new Set();     // edge, cleared by consume()
    this.released = new Set();
    this.padIndex = null;
    this.rotated = false;         // true while the page is force-rotated
    this.manualAt = -1e9;         // last time a human pushed the stick
    this.padMoving = false;
    this.lastSource = 'keyboard';
    this.keys = new Set();
    this.touch = { move: { x: 0, y: 0 }, buttons: new Set() };
    this.textMode = false;

    addEventListener('keydown', (e) => this.onKey(e, true));
    addEventListener('keyup', (e) => this.onKey(e, false));
    addEventListener('gamepadconnected', (e) => {
      this.padIndex = e.gamepad.index;
      this.lastSource = 'gamepad';
      this.onPadChange?.(true, e.gamepad.id);
    });
    addEventListener('gamepaddisconnected', () => {
      this.padIndex = null;
    this.rotated = false;         // true while the page is force-rotated
    this.manualAt = -1e9;         // last time a human pushed the stick
    this.padMoving = false;
      this.onPadChange?.(false);
    });
    addEventListener('blur', () => { this.keys.clear(); this.held.clear(); });
  }

  onKey(e, down) {
    if (this.textMode && down && e.code !== 'Escape' && e.code !== 'Enter') return;
    const action = KEYMAP[e.code];
    const dir = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' }[e.code];
    if (!action && !dir) return;
    if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
    this.lastSource = 'keyboard';
    if (down) this.keys.add(e.code); else this.keys.delete(e.code);
    if (action) this.setAction(action, down);
  }

  setAction(action, down) {
    if (down) {
      if (!this.held.has(action)) this.pressed.add(action);
      this.held.add(action);
    } else if (this.held.has(action)) {
      this.held.delete(action);
      this.released.add(action);
    }
  }

  /** Called by the touch UI: a real thumb, which outranks any automation. */
  touchStick(x, y) {
    this.touch.move.x = x; this.touch.move.y = y;
    if (x || y) { this.lastSource = 'touch'; this.manualAt = performance.now(); }
  }

  /** Called by auto-battle and auto-travel. Never counts as manual input. */
  autoStick(x, y) { this.touch.move.x = x; this.touch.move.y = y; }

  /** True while the player is driving: the automations stand down. */
  manualRecently(ms = 1200) {
    if (this.keys.size) return true;
    if (this.padMoving) return true;
    return performance.now() - (this.manualAt ?? -1e9) < ms;
  }
  touchButton(action, down) { this.lastSource = 'touch'; this.setAction(action, down); }

  poll() {
    // keyboard movement
    let kx = 0, ky = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ky -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ky += 1;

    let mx = kx, my = ky, ax = 0, ay = 0;
    if (this.touch.move.x || this.touch.move.y) { mx = this.touch.move.x; my = this.touch.move.y; }

    const pads = navigator.getGamepads?.() ?? [];
    const pad = this.padIndex != null ? pads[this.padIndex] : pads.find((p) => p?.connected);
    if (pad) {
      if (this.padIndex == null) this.padIndex = pad.index;
      const dz = (v) => (Math.abs(v) < 0.22 ? 0 : (Math.abs(v) - 0.22) / 0.78 * Math.sign(v));
      const px = dz(pad.axes[0] ?? 0), py = dz(pad.axes[1] ?? 0);
      this.padMoving = !!(px || py);
      if (px || py) { mx = px; my = py; this.lastSource = 'gamepad'; }
      ax = dz(pad.axes[2] ?? 0); ay = dz(pad.axes[3] ?? 0);

      const mod = pad.buttons[MOD_BUTTON]?.pressed;
      for (const [idx, action] of Object.entries(PAD_BUTTONS)) {
        let a = action;
        if (mod && a === 'skill1') a = 'skill5';
        if (mod && a === 'skill2') a = 'skill6';
        const pressed = !!pad.buttons[idx]?.pressed;
        if (pressed) this.lastSource = 'gamepad';
        this.setAction(a, pressed);
      }
      this.setAction('attack', !!pad.buttons[ATTACK_TRIGGER]?.pressed || !!pad.buttons[2]?.pressed);
    }

    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    this.move.x = mx; this.move.y = my;
    this.aim.x = ax; this.aim.y = ay;
    return this.move;
  }

  isHeld(a) { return this.held.has(a); }
  consume(a) { const had = this.pressed.has(a); this.pressed.delete(a); return had; }
  consumeReleased(a) { const had = this.released.has(a); this.released.delete(a); return had; }
  endFrame() { this.pressed.clear(); this.released.clear(); }
}

/** Binds the on-screen joystick + button pad (mobile). */
export function bindTouchControls(input, root) {
  const stick = root.querySelector('#stick');
  const knob = root.querySelector('#stick-knob');
  let sid = null, cx = 0, cy = 0;
  const R = 52;

  const start = (e) => {
    const t = e.changedTouches ? e.changedTouches[0] : e;
    sid = t.identifier ?? 'mouse';
    const r = stick.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    move(e);
  };
  const move = (e) => {
    const t = [...(e.changedTouches ?? [e])].find((x) => (x.identifier ?? 'mouse') === sid);
    if (!t) return;
    let dx = t.clientX - cx, dy = t.clientY - cy;
    // the page is turned a quarter clockwise, so undo that on the thumb vector
    if (input.rotated) { const sx = dx; dx = dy; dy = -sx; }
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, R);
    dx = dx / len * clamped; dy = dy / len * clamped;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.touchStick(dx / R, dy / R);
    e.preventDefault();
  };
  const end = () => { sid = null; knob.style.transform = 'translate(0,0)'; input.touchStick(0, 0); };

  stick.addEventListener('touchstart', start, { passive: false });
  stick.addEventListener('touchmove', move, { passive: false });
  stick.addEventListener('touchend', end);
  stick.addEventListener('touchcancel', end);
  stick.addEventListener('mousedown', start);
  addEventListener('mousemove', (e) => sid && move(e));
  addEventListener('mouseup', () => sid && end());

  for (const btn of root.querySelectorAll('[data-action]')) {
    const action = btn.dataset.action;
    const down = (e) => { e.preventDefault(); btn.classList.add('down'); input.touchButton(action, true); };
    const up = (e) => { e?.preventDefault?.(); btn.classList.remove('down'); input.touchButton(action, false); };
    btn.addEventListener('touchstart', down, { passive: false });
    btn.addEventListener('touchend', up);
    btn.addEventListener('touchcancel', up);
    btn.addEventListener('mousedown', down);
    btn.addEventListener('mouseup', up);
    btn.addEventListener('mouseleave', up);
  }
}
