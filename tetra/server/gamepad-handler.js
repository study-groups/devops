#!/usr/bin/env node

/**
 * Gamepad Handler for Tetra TUI
 *
 * Reads gamepad input using node-hid and provides both:
 * 1. Raw gamepad data via API (buttons, axes as raw values)
 * 2. Mapped keyboard events written to named pipe
 *
 * Architecture:
 *   Gamepad -> node-hid -> Raw Data -> {API, Mapper} -> Named Pipe -> Bash TUI
 *
 * Design Philosophy:
 * - Optional: Gracefully degrades when no gamepad present
 * - Layered: Raw input -> Mapping -> Output (separation of concerns)
 * - API-first: Expose raw data, let consumers decide semantics
 */

const HID = require('node-hid');
const fs = require('fs');
const path = require('path');

// Configuration
const PIPE_PATH = process.env.TETRA_GAMEPAD_PIPE || '/tmp/tetra-gamepad.fifo';
const POLL_RATE = 60; // Hz
const DEADZONE = 0.15; // Analog stick deadzone

// Button mapping: Gamepad buttons -> Keyboard keys
const BUTTON_MAP = {
  // Face buttons (standard gamepad)
  0: '\n',      // A button -> Enter (execute action)
  1: '\x1b',    // B button -> ESC (back/cancel)
  2: 'c',       // X button -> Clear content
  3: 'v',       // Y button -> View mode toggle

  // Shoulder buttons
  4: 'e',       // L1 -> Navigate environment left
  5: 'E',       // R1 -> Navigate environment right
  6: 'd',       // L2 -> Navigate mode left
  7: 'D',       // R2 -> Navigate mode right

  // Special buttons
  8: 'q',       // Select -> Quit
  9: 'h',       // Start -> Toggle header size
  10: 'o',      // L3 (stick press) -> Toggle oscillator
  11: '/',      // R3 (stick press) -> Toggle REPL

  // D-pad
  12: '\x1b[A', // D-pad Up -> Arrow up
  13: '\x1b[B', // D-pad Down -> Arrow down
  14: '\x1b[D', // D-pad Left -> Arrow left
  15: '\x1b[C', // D-pad Right -> Arrow right
};

// Axis mapping for analog sticks
const AXIS_MAP = {
  // Left stick (typically axis 0 and 1)
  0: { neg: 'a', pos: 'A' },  // X-axis: left/right action navigation
  1: { neg: 'i', pos: 'k' },  // Y-axis: up/down action navigation

  // Right stick (typically axis 2 and 3)
  2: { neg: '\x1b[D', pos: '\x1b[C' }, // X-axis: left/right arrow (oscillator)
  3: { neg: 'm', pos: 'M' },            // Y-axis: mode navigation
};

class GamepadHandler {
  constructor(options = {}) {
    this.device = null;
    this.pipeStream = null;
    this.lastAxisState = {};
    this.buttonState = {};
    this.running = false;
    this.optional = options.optional !== false; // Default to optional
    this.enablePipe = options.pipe !== false;   // Default to enabled
    this.enableMapping = options.mapping !== false; // Default to enabled

    // Raw state (exposed via API)
    this.rawState = {
      buttons: new Array(16).fill(false),
      axes: new Array(4).fill(0),
      timestamp: Date.now(),
      connected: false
    };

    // Event listeners for raw data
    this.listeners = {
      button: [],
      axis: [],
      raw: [],
      connect: [],
      disconnect: []
    };
  }

  /**
   * Initialize the gamepad handler
   */
  async init() {
    console.log('🎮 Initializing Tetra Gamepad Handler...');
    console.log(`   Mode: ${this.optional ? 'optional' : 'required'}`);
    console.log(`   Pipe: ${this.enablePipe ? 'enabled' : 'disabled'}`);
    console.log(`   Mapping: ${this.enableMapping ? 'enabled' : 'raw only'}`);

    try {
      // Create named pipe if enabled
      if (this.enablePipe) {
        await this.createPipe();
        this.openPipe();
      }

      // Find and connect to gamepad
      await this.connectGamepad();

      console.log('✅ Gamepad handler initialized');
      if (this.enablePipe) {
        console.log(`   Pipe: ${PIPE_PATH}`);
      }
      console.log(`   Poll rate: ${POLL_RATE} Hz`);
    } catch (error) {
      if (this.optional) {
        console.log('⚠️  Gamepad not available (optional mode)');
        console.log(`   ${error.message}`);
        console.log('   Server will continue without gamepad support');
      } else {
        throw error;
      }
    }
  }

  /**
   * API: Get current raw gamepad state
   */
  getRawState() {
    return { ...this.rawState };
  }

  /**
   * API: Subscribe to gamepad events
   */
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  /**
   * API: Remove event listener
   */
  off(event, callback) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(callback);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all listeners
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  /**
   * Create named pipe (FIFO) for IPC with Bash
   */
  async createPipe() {
    try {
      // Remove old pipe if exists
      if (fs.existsSync(PIPE_PATH)) {
        fs.unlinkSync(PIPE_PATH);
        console.log(`🗑️  Removed old pipe: ${PIPE_PATH}`);
      }

      // Create new pipe using mkfifo
      const { execSync } = require('child_process');
      execSync(`mkfifo ${PIPE_PATH}`);
      console.log(`📡 Created named pipe: ${PIPE_PATH}`);
    } catch (error) {
      console.error('❌ Failed to create pipe:', error.message);
      throw error;
    }
  }

  /**
   * Open the named pipe for writing
   */
  openPipe() {
    try {
      // Open pipe in non-blocking mode
      this.pipeStream = fs.createWriteStream(PIPE_PATH, {
        flags: 'w',
        encoding: 'utf8'
      });

      this.pipeStream.on('error', (error) => {
        if (error.code === 'EPIPE') {
          console.log('⚠️  Pipe reader disconnected, waiting for reconnection...');
        } else {
          console.error('❌ Pipe error:', error);
        }
      });

      console.log('📝 Opened pipe for writing');
    } catch (error) {
      console.error('❌ Failed to open pipe:', error.message);
      throw error;
    }
  }

  /**
   * Find and connect to the first available gamepad
   */
  connectGamepad() {
    const devices = HID.devices();
    console.log(`🔍 Found ${devices.length} HID devices`);

    // Look for gamepad/joystick devices ONLY
    // Exclude mice/trackpads (usage 0x02) and keyboards (usage 0x06)
    const gamepadDevices = devices.filter(d =>
      (d.usage === 0x05 || d.usage === 0x04) && // Gamepad or Joystick only
      d.usagePage === 0x01 // Generic Desktop
    );

    if (gamepadDevices.length === 0) {
      console.log('⚠️  No gamepad found. Waiting for connection...');
      console.log('   Available devices:');
      devices.slice(0, 10).forEach(d => {
        console.log(`   - ${d.product || 'Unknown'} (vendor: ${d.vendorId}, product: ${d.productId})`);
      });

      // Set up polling to detect gamepad connection
      setTimeout(() => this.connectGamepad(), 2000);
      return;
    }

    const gamepad = gamepadDevices[0];
    console.log(`🎮 Connecting to: ${gamepad.product || 'Unknown Gamepad'}`);
    console.log(`   Vendor: ${gamepad.vendorId}, Product: ${gamepad.productId}`);

    try {
      this.device = new HID.HID(gamepad.path);

      // Set up data handler
      this.device.on('data', (data) => this.handleGamepadData(data));

      this.device.on('error', (error) => {
        console.error('❌ Gamepad error:', error);
        this.device = null;
        // Try to reconnect
        setTimeout(() => this.connectGamepad(), 2000);
      });

      this.running = true;
      console.log('✅ Gamepad connected and ready');
    } catch (error) {
      console.error('❌ Failed to connect to gamepad:', error.message);
      setTimeout(() => this.connectGamepad(), 2000);
    }
  }

  /**
   * Handle incoming gamepad data
   */
  handleGamepadData(data) {
    if (!this.running) return;

    // Parse gamepad report (structure varies by controller)
    // Most gamepads use a standard HID report format

    // Buttons (typically bytes 4-5)
    const buttons = (data[5] << 8) | data[4];

    // Axes (typically bytes 0-3)
    const axes = {
      0: this.normalizeAxis(data[0]), // Left stick X
      1: this.normalizeAxis(data[1]), // Left stick Y
      2: this.normalizeAxis(data[2]), // Right stick X
      3: this.normalizeAxis(data[3]), // Right stick Y
    };

    // Update raw state
    this.rawState.timestamp = Date.now();
    this.rawState.connected = true;

    // Emit complete raw state for API consumers
    this.emit('raw', {
      buttons,
      axes,
      timestamp: this.rawState.timestamp
    });

    // Handle button presses (detect rising edge)
    for (let i = 0; i < 16; i++) {
      const pressed = (buttons & (1 << i)) !== 0;
      const wasPressed = this.buttonState[i] || false;

      // Update raw state
      this.rawState.buttons[i] = pressed;

      if (pressed && !wasPressed) {
        // Emit raw button press event
        this.emit('button', { button: i, pressed: true });

        // Handle mapped output if enabled
        if (this.enableMapping) {
          this.handleButton(i);
        }
      }

      this.buttonState[i] = pressed;
    }

    // Handle axes (with deadzone)
    for (const [axis, value] of Object.entries(axes)) {
      const axisNum = parseInt(axis);
      this.rawState.axes[axisNum] = value;

      // Emit raw axis event
      this.emit('axis', { axis: axisNum, value });

      // Handle mapped output if enabled
      if (this.enableMapping) {
        this.handleAxis(axisNum, value);
      }
    }
  }

  /**
   * Normalize axis value from 0-255 to -1.0 to 1.0
   */
  normalizeAxis(value) {
    return (value - 128) / 128.0;
  }

  /**
   * Handle button press
   */
  handleButton(button) {
    const key = BUTTON_MAP[button];
    if (key) {
      console.log(`🎮 Button ${button} -> '${key.replace('\x1b', 'ESC').replace('\n', 'ENTER')}'`);
      this.writeToPipe(key);
    }
  }

  /**
   * Handle axis movement
   */
  handleAxis(axis, value) {
    const mapping = AXIS_MAP[axis];
    if (!mapping) return;

    const lastValue = this.lastAxisState[axis] || 0;

    // Check for threshold crossing with hysteresis
    if (Math.abs(value) > DEADZONE && Math.abs(lastValue) <= DEADZONE) {
      // Entered active zone
      const key = value < 0 ? mapping.neg : mapping.pos;
      console.log(`🕹️  Axis ${axis} -> ${value.toFixed(2)} -> '${key.replace('\x1b', 'ESC')}'`);
      this.writeToPipe(key);
    }

    this.lastAxisState[axis] = value;
  }

  /**
   * Write key event to named pipe
   */
  writeToPipe(key) {
    if (!this.pipeStream || !this.pipeStream.writable) {
      return;
    }

    try {
      this.pipeStream.write(key);
    } catch (error) {
      console.error('❌ Failed to write to pipe:', error.message);
    }
  }

  /**
   * Cleanup and shutdown
   */
  cleanup() {
    console.log('🛑 Shutting down gamepad handler...');
    this.running = false;

    if (this.device) {
      this.device.close();
      this.device = null;
    }

    if (this.pipeStream) {
      this.pipeStream.end();
      this.pipeStream = null;
    }

    // Remove pipe
    try {
      if (fs.existsSync(PIPE_PATH)) {
        fs.unlinkSync(PIPE_PATH);
      }
    } catch (error) {
      // Ignore cleanup errors
    }

    console.log('✅ Cleanup complete');
  }
}

// Main entry point
async function main() {
  const handler = new GamepadHandler();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT');
    handler.cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM');
    handler.cleanup();
    process.exit(0);
  });

  try {
    await handler.init();
    console.log('🎮 Gamepad handler running. Press Ctrl+C to exit.');
    console.log('');
    console.log('Button Mapping:');
    console.log('  A (0)      -> Enter (execute)');
    console.log('  B (1)      -> ESC (back)');
    console.log('  X (2)      -> c (clear)');
    console.log('  Y (3)      -> v (view mode)');
    console.log('  L1 (4)     -> e (env left)');
    console.log('  R1 (5)     -> E (env right)');
    console.log('  L2 (6)     -> d (mode left)');
    console.log('  R2 (7)     -> D (mode right)');
    console.log('  Select (8) -> q (quit)');
    console.log('  Start (9)  -> h (header)');
    console.log('  D-pad      -> Arrow keys');
    console.log('  Left stick -> Action navigation (a/A, i/k)');
    console.log('  Right stick -> Oscillator control');
  } catch (error) {
    console.error('❌ Failed to initialize:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = GamepadHandler;
