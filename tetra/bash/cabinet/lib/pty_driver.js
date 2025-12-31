/**
 * pty_driver.js - Generic PTY driver for script-based games
 *
 * Spawns a game process via node-pty, handles stdin/stdout,
 * detects frame markers, and provides clean environment setup.
 *
 * Usage:
 *   const driver = new PtyDriver({
 *     command: './game.sh',
 *     cwd: '/path/to/game'
 *   });
 *   driver.onFrame(frame => console.log(frame));
 *   driver.start();
 */

const path = require('path');

// Optional PTY support
let pty;
try {
  pty = require('node-pty');
} catch (e) {
  console.log('[pty_driver] node-pty not found, PTY games unavailable');
  console.log('[pty_driver] Install with: npm install node-pty');
}

// Default frame marker (can be overridden)
const DEFAULT_FRAME_MARKER = '\x1b_FRAME\x1b\\';

class PtyDriver {
  constructor(options = {}) {
    this.command = options.command;
    this.args = options.args || [];
    this.cwd = options.cwd || process.cwd();
    this.env = options.env || {};
    this.cols = options.cols || 60;
    this.rows = options.rows || 24;
    this.frameMarker = options.frameMarker || DEFAULT_FRAME_MARKER;
    this.gameType = options.gameType || 'unknown';

    this.process = null;
    this.buffer = '';
    this._onFrame = null;
    this._onExit = null;
  }

  onFrame(callback) { this._onFrame = callback; }
  onExit(callback) { this._onExit = callback; }

  start() {
    if (!pty) {
      console.error('[pty_driver] Cannot start: node-pty not available');
      return this;
    }

    if (!this.command) {
      console.error('[pty_driver] Cannot start: no command specified');
      return this;
    }

    // Resolve command to absolute path
    const fs = require('fs');
    let cmdPath = this.command;
    if (!path.isAbsolute(cmdPath)) {
      cmdPath = path.resolve(this.cwd, cmdPath);
    }

    if (!fs.existsSync(cmdPath)) {
      console.error(`[pty_driver] Command not found: ${cmdPath}`);
      return this;
    }

    console.log(`[pty_driver] Starting: ${cmdPath}`);
    console.log(`[pty_driver] CWD: ${this.cwd}`);

    // Build clean environment
    const cleanEnv = this._buildEnv();

    // Spawn via PTY - use bash from PATH
    const bashPath = process.env.SHELL || '/bin/bash';
    this.process = pty.spawn(bashPath, [cmdPath, ...this.args], {
      name: 'xterm-256color',
      cols: this.cols,
      rows: this.rows,
      cwd: this.cwd,
      env: cleanEnv
    });

    this.process.onData((data) => {
      this._processOutput(data);
    });

    this.process.onExit(({ exitCode }) => {
      console.log(`[pty_driver] Process exited with code ${exitCode}`);
      this.process = null;
      if (this._onExit) this._onExit(exitCode);
    });

    return this;
  }

  stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
      console.log('[pty_driver] Process stopped');
    }
  }

  // Send a key to the game
  sendKey(key) {
    if (this.process) {
      this.process.write(key);
    }
  }

  // Send input (to be overridden by game-specific drivers)
  sendInput(slot, input) {
    // Default: just send the key if present
    if (input.key) {
      this.sendKey(input.key);
    }
  }

  // Process output from PTY
  _processOutput(data) {
    this.buffer += data;

    // Look for frame markers
    let markerPos;
    while ((markerPos = this.buffer.indexOf(this.frameMarker)) !== -1) {
      const frameData = this.buffer.slice(0, markerPos);
      this.buffer = this.buffer.slice(markerPos + this.frameMarker.length);

      if (frameData.length > 0 && this._onFrame) {
        const frame = this.parseFrame(frameData);
        if (frame) {
          this._onFrame(frame);
        }
      }
    }
  }

  // Parse frame data (override in subclass for game-specific parsing)
  parseFrame(rawData) {
    return {
      display: rawData
    };
  }

  // Build clean environment for spawned process
  _buildEnv() {
    const tetraSrc = process.env.TETRA_SRC ||
      path.resolve(process.env.HOME, 'src/devops/tetra');

    return {
      HOME: process.env.HOME,
      PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin',
      SHELL: '/bin/bash',
      USER: process.env.USER,
      TERM: 'xterm-256color',
      TETRA_SRC: tetraSrc,
      ...this.env
    };
  }
}

module.exports = { PtyDriver, DEFAULT_FRAME_MARKER };
