/**
 * tetra-input.js - Unified input protocol for tetra/controldeck
 *
 * Single input format used across all tetra systems:
 * - controldeck (gamepad, MIDI, hand tracking)
 * - cabinet (game hosting)
 * - join.html (web client)
 *
 * UNIFIED FORMAT:
 *   { t: 'input', src: 'gamepad', ctrl: 'left-x', val: 0.4 }
 *   { t: 'input', src: 'keyboard', ctrl: 'KeyW', val: 1, pressed: true }
 *   { t: 'input', src: 'midi', ctrl: 'cc:1', val: 0.5 }
 *
 * STANDARD CONTROL NAMES (ctrl):
 *   Gamepad axes:    left-x, left-y, right-x, right-y
 *   Gamepad buttons: a, b, x, y, l1, r1, l2, r2, start, select,
 *                    dpad-up, dpad-down, dpad-left, dpad-right
 *   Keyboard:        KeyW, KeyA, ArrowUp, Space, etc. (KeyboardEvent.code)
 *   MIDI:            cc:0-127, note:0-127, pitch, mod
 *   Touch/Hand:      hand-x, hand-y, hand-theta, hand-spread
 */

// Sources
const SRC = {
  GAMEPAD: 'gamepad',
  KEYBOARD: 'keyboard',
  MIDI: 'midi',
  TOUCH: 'touch'
};

// Standard gamepad controls
const CTRL = {
  // Axes
  LEFT_X: 'left-x',
  LEFT_Y: 'left-y',
  RIGHT_X: 'right-x',
  RIGHT_Y: 'right-y',
  // Buttons
  A: 'a', B: 'b', X: 'x', Y: 'y',
  L1: 'l1', R1: 'r1', L2: 'l2', R2: 'r2',
  START: 'start', SELECT: 'select',
  DPAD_UP: 'dpad-up', DPAD_DOWN: 'dpad-down',
  DPAD_LEFT: 'dpad-left', DPAD_RIGHT: 'dpad-right',
  // Hand tracking
  HAND_X: 'hand-x', HAND_Y: 'hand-y',
  HAND_THETA: 'hand-theta', HAND_SPREAD: 'hand-spread'
};

// Deadzone threshold (ignore small movements)
const DEADZONE = 0.15;

// Repeat rate for analog-to-discrete (ms between repeats at full deflection)
const REPEAT_RATE = 100;

// Response curves
const CURVES = {
  linear: (val) => val,
  quadratic: (val) => Math.sign(val) * val * val,
  cubic: (val) => val * val * val
};

/**
 * Create a unified input message
 */
function createInput(src, ctrl, val, pressed = null) {
  const msg = { t: 'input', src, ctrl, val };
  if (pressed !== null) msg.pressed = pressed;
  return msg;
}

/**
 * Check if a message is a valid input message
 */
function isInput(msg) {
  return msg && msg.t === 'input' && msg.ctrl !== undefined;
}

/**
 * Check if input is an axis (continuous value)
 */
function isAxis(ctrl) {
  return ['left-x', 'left-y', 'right-x', 'right-y',
          'hand-x', 'hand-y', 'hand-theta', 'hand-spread'].includes(ctrl) ||
         ctrl.startsWith('cc:');
}

/**
 * Apply deadzone to analog value
 */
function applyDeadzone(val, deadzone = DEADZONE) {
  if (Math.abs(val) < deadzone) return 0;
  const sign = Math.sign(val);
  const scaled = (Math.abs(val) - deadzone) / (1 - deadzone);
  return sign * scaled;
}

/**
 * Apply response curve to analog value
 */
function applyCurve(val, curve = 'linear') {
  const fn = CURVES[curve] || CURVES.linear;
  return fn(val);
}

/**
 * AxisToKeys - Converts analog axis to key repeats
 *
 * Usage:
 *   const converter = new AxisToKeys({
 *     positive: 'w',  // key for positive axis
 *     negative: 's'   // key for negative axis
 *   });
 *   converter.onKey(key => driver.sendKey(key));
 *   converter.update(0.8);  // Will emit 'w' repeatedly
 */
class AxisToKeys {
  constructor(options = {}) {
    this.positiveKey = options.positive;
    this.negativeKey = options.negative;
    this.deadzone = options.deadzone ?? DEADZONE;
    this.repeatRate = options.repeatRate ?? REPEAT_RATE;
    this.curve = options.curve || 'linear';

    this._onKey = null;
    this._interval = null;
    this._currentVal = 0;
  }

  onKey(callback) {
    this._onKey = callback;
  }

  update(val) {
    const processed = applyCurve(applyDeadzone(val, this.deadzone), this.curve);
    this._currentVal = processed;

    // Clear existing interval
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }

    if (processed === 0) return;

    // Determine key and rate based on magnitude
    const key = processed > 0 ? this.positiveKey : this.negativeKey;
    const magnitude = Math.abs(processed);
    const rate = this.repeatRate / magnitude; // Faster repeat for larger values

    // Emit immediately
    if (this._onKey && key) {
      this._onKey(key);
    }

    // Set up repeat interval
    this._interval = setInterval(() => {
      if (this._onKey && key) {
        this._onKey(key);
      }
    }, rate);
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    this._currentVal = 0;
  }
}

/**
 * InputRouter - Routes unified input messages to handlers
 *
 * Usage:
 *   const router = new InputRouter();
 *   router.mapAxis('left-y', 'w', 's');  // axis to keys
 *   router.mapButton('a', 'space');       // button to key
 *   router.onKey(key => game.sendKey(key));
 *   router.handle({ t: 'input', src: 'gamepad', ctrl: 'left-y', val: 0.8 });
 */
class InputRouter {
  constructor() {
    this.axisConverters = new Map();  // ctrl -> AxisToKeys
    this.buttonMap = new Map();       // ctrl -> key
    this._onKey = null;
  }

  onKey(callback) {
    this._onKey = callback;
  }

  // Map an axis to positive/negative keys
  mapAxis(ctrl, positive, negative, options = {}) {
    const converter = new AxisToKeys({ positive, negative, ...options });
    converter.onKey((key) => {
      if (this._onKey) this._onKey(key);
    });
    this.axisConverters.set(ctrl, converter);
    return this;
  }

  // Map a button to a key
  mapButton(ctrl, key) {
    this.buttonMap.set(ctrl, key);
    return this;
  }

  // Handle a unified input message
  handle(input) {
    if (!isInput(input)) return;

    const { src, ctrl, val, pressed } = input;

    // Check for axis converter
    const converter = this.axisConverters.get(ctrl);
    if (converter) {
      converter.update(val);
      return;
    }

    // Check for button mapping
    const mappedKey = this.buttonMap.get(ctrl);
    if (mappedKey && pressed) {
      if (this._onKey) this._onKey(mappedKey);
      return;
    }

    // Keyboard: pass through ctrl as key
    if (src === SRC.KEYBOARD && pressed) {
      // Convert KeyW -> w, ArrowUp -> ArrowUp
      const key = ctrl.startsWith('Key') ? ctrl.slice(3).toLowerCase() : ctrl;
      if (this._onKey) this._onKey(key);
      return;
    }

    // Gamepad button without mapping: use ctrl as key
    if (src === SRC.GAMEPAD && pressed && !isAxis(ctrl)) {
      if (this._onKey) this._onKey(ctrl);
      return;
    }
  }

  stop() {
    for (const converter of this.axisConverters.values()) {
      converter.stop();
    }
  }
}

module.exports = {
  // Constants
  SRC,
  CTRL,
  DEADZONE,
  REPEAT_RATE,
  CURVES,
  // Functions
  createInput,
  isInput,
  isAxis,
  applyDeadzone,
  applyCurve,
  // Classes
  AxisToKeys,
  InputRouter
};
