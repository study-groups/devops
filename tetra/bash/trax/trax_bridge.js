#!/usr/bin/env node

/**
 * Trax Bridge - Connects trax bash game to Quasar server
 *
 * Spawns trax game, parses stdout for display frames,
 * calculates sound state, and forwards to quasar_server.
 *
 * Usage:
 *   node trax_bridge.js [--server ws://localhost:1985/ws]
 */

const { spawn } = require('child_process');
const WebSocket = require('ws');
const path = require('path');

// Optional PTY support for proper terminal emulation
let pty;
try {
  pty = require('node-pty');
} catch (e) {
  console.log('[bridge] node-pty not found, using spawn fallback');
  console.log('[bridge] For full trax support: npm install node-pty');
}

// Configuration
const QUASAR_URL = process.argv.includes('--server')
  ? process.argv[process.argv.indexOf('--server') + 1]
  : 'ws://localhost:1985/ws?role=game';

// Bridge now lives in trax directory with the game
const TRAX_PATH = process.env.TRAX_PATH ||
  path.join(__dirname, 'trax.sh');

const TRAX_SOUND_CONFIG = path.join(__dirname, 'trax_sound.json');

const FRAME_RATE = 15;
const FRAME_INTERVAL = 1000 / FRAME_RATE;

/**
 * TraxBridge - Game adapter for trax
 */
class TraxBridge {
  constructor() {
    this.ws = null;
    this.gameProcess = null;
    this.frameBuffer = '';
    this.frameSeq = 0;

    // Game state for sound calculation
    this.gameState = {
      p1: { velocity: 0, x: 8, y: 10 },
      p2: { velocity: 0, x: 50, y: 10 },
      lastTriggers: []
    };

    // Game running flag - only play sound when game is active
    this.gameRunning = false;

    // Sound state - only voices 0-1 for TRAX engines
    // Voices 2-3 reserved for UI sounds (clank, pickup)
    this.soundState = {
      mode: 'tia',
      v: {
        0: { g: 0, f: 28, w: 3, v: 0 },   // P1 engine (silent)
        1: { g: 0, f: 28, w: 3, v: 0 }    // P2 engine (silent)
        // DO NOT send voices 2-3, they belong to UI
      }
    };

    this.connect();
  }

  connect() {
    console.log(`[bridge] Connecting to ${QUASAR_URL}`);

    this.ws = new WebSocket(QUASAR_URL);

    this.ws.on('open', () => {
      console.log('[bridge] Connected to quasar server');

      // Register as game source
      this.ws.send(JSON.stringify({
        t: 'register',
        gameType: 'trax'
      }));

      // Start game
      this.startGame();
    });

    this.ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg);
        this.handleServerMessage(data);
      } catch (e) {
        // Ignore parse errors
      }
    });

    this.ws.on('close', () => {
      console.log('[bridge] Disconnected from server');
      this.stopGame();
      setTimeout(() => this.connect(), 2000);
    });

    this.ws.on('error', (err) => {
      console.error('[bridge] WebSocket error:', err.message);
    });
  }

  handleServerMessage(data) {
    // Forward input to game via stdin
    if (data.t === 'input' && this.gameProcess) {
      const key = this.translateKey(data);
      if (key) {
        this.gameProcess.stdin.write(key);
      }
    }
  }

  translateKey(input) {
    // Map browser keys to trax input
    const keyMap = {
      'w': 'w',       // P1 forward
      's': 's',       // P1 backward
      'a': 'a',       // P1 turn left
      'd': 'd',       // P1 turn right
      'ArrowUp': 'i',    // P2 forward
      'ArrowDown': 'k',  // P2 backward
      'ArrowLeft': 'j',  // P2 turn left
      'ArrowRight': 'l', // P2 turn right
      'q': 'q',       // Quit
      'p': 'p',       // Pause
      'r': 'r'        // Reset
    };

    return keyMap[input.key] || keyMap[input.code] || '';
  }

  startGame() {
    console.log(`[bridge] Starting trax: ${TRAX_PATH}`);

    // Check if trax exists
    const fs = require('fs');
    if (!fs.existsSync(TRAX_PATH)) {
      console.error(`[bridge] Trax not found at ${TRAX_PATH}`);
      console.log('[bridge] Running in demo mode...');
      this.startDemoMode();
      return;
    }

    // Use PTY if available for proper terminal emulation
    if (pty) {
      console.log('[bridge] Using PTY for terminal emulation');
      this.gameProcess = pty.spawn('bash', [TRAX_PATH], {
        name: 'xterm-256color',
        cols: 60,
        rows: 24,
        cwd: path.dirname(TRAX_PATH),
        env: {
          ...process.env,
          TERM: 'xterm-256color'
        }
      });

      this.gameProcess.onData((data) => {
        this.processGameOutput(data);
      });

      this.gameProcess.onExit(({ exitCode }) => {
        console.log(`[bridge] Game exited with code ${exitCode}`);
        this.gameProcess = null;
      });
    } else {
      // Fallback: run in demo mode since trax needs a terminal
      console.log('[bridge] No PTY available, running demo mode');
      console.log('[bridge] Install node-pty for actual trax: npm install node-pty');
      this.startDemoMode();
    }
  }

  startDemoMode() {
    // Generate demo frames for testing without actual game
    let tick = 0;

    const demoInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        clearInterval(demoInterval);
        return;
      }

      tick++;

      // Animate demo
      const p1x = 8 + Math.floor(Math.sin(tick * 0.1) * 5);
      const p2x = 50 + Math.floor(Math.cos(tick * 0.1) * 5);

      // Update game state
      this.gameState.p1.velocity = Math.floor(Math.sin(tick * 0.05) * 3);
      this.gameState.p2.velocity = Math.floor(Math.cos(tick * 0.05) * 3);

      // Generate display
      const display = this.generateDemoDisplay(p1x, p2x, tick);

      // Calculate sound
      this.calculateSound();

      // Check for triggers
      const triggers = [];
      if (tick % 60 === 0) triggers.push('pew');
      if (tick % 120 === 0) triggers.push('boom');

      // Send frame
      this.sendFrame(display, triggers);

    }, FRAME_INTERVAL);
  }

  generateDemoDisplay(p1x, p2x, tick) {
    const lines = [];
    const width = 60;
    const height = 24;

    // Border
    lines.push('=' .repeat(width));

    // Title
    const title = ' TRAX - DEMO MODE ';
    const padding = Math.floor((width - title.length) / 2);
    lines.push(' '.repeat(padding) + title);

    lines.push('=' .repeat(width));

    // Arena
    for (let y = 0; y < height - 6; y++) {
      let line = '|';

      for (let x = 1; x < width - 1; x++) {
        if (y === 10 && x >= p1x - 1 && x <= p1x + 1) {
          line += ['<', 'O', '>'][x - p1x + 1] || ' ';
        } else if (y === 10 && x >= p2x - 1 && x <= p2x + 1) {
          line += ['<', 'X', '>'][x - p2x + 1] || ' ';
        } else if (y === 10 && x === 30) {
          line += '*';  // Food
        } else {
          line += ' ';
        }
      }

      line += '|';
      lines.push(line);
    }

    // Bottom border
    lines.push('=' .repeat(width));

    // Status line
    const v1 = this.gameState.p1.velocity;
    const v2 = this.gameState.p2.velocity;
    const status = ` P1: vel=${v1}  |  P2: vel=${v2}  |  Tick: ${tick}`;
    lines.push(status.padEnd(width));

    lines.push('=' .repeat(width));

    return lines.join('\n');
  }

  processGameOutput(data) {
    // Accumulate output
    this.frameBuffer += data;

    // Debug: log data received
    if (!this.frameCount) this.frameCount = 0;
    this.frameCount++;
    if (this.frameCount <= 3) {
      console.log(`[bridge] Game output #${this.frameCount}: ${data.length} bytes`);
    }

    // Detect frame boundary: look for cursor home \x1b[H in the NEW data
    // If new data starts with home, previous buffer is a complete frame
    const homeSeq = '\x1b[H';
    if (data.includes(homeSeq) && this.frameBuffer.length > data.length + 100) {
      // Find where the new home sequence starts
      const homeIdx = this.frameBuffer.lastIndexOf(homeSeq);
      if (homeIdx > 100) {
        const completeFrame = this.frameBuffer.substring(0, homeIdx);
        this.frameBuffer = this.frameBuffer.substring(homeIdx);
        this.parseFrame(completeFrame);
      }
    }
  }

  parseFrame(output) {
    // Debug
    if (!this.parseCount) this.parseCount = 0;
    this.parseCount++;
    if (this.parseCount <= 3) {
      console.log(`[bridge] parseFrame #${this.parseCount}, output: ${output.length} bytes`);
    }

    // Parse game output for state updates
    // This depends on trax_render.sh format

    // Look for velocity indicators in output - indicates game is running
    const v1Match = output.match(/P1.*vel[=:]?\s*(-?\d+)/i);
    const v2Match = output.match(/P2.*vel[=:]?\s*(-?\d+)/i);

    // Detect game running state from output
    if (v1Match || v2Match || output.includes('speed')) {
      if (!this.gameRunning) {
        console.log('[bridge] Game detected as running - enabling sound');
      }
      this.gameRunning = true;
    }

    if (v1Match) this.gameState.p1.velocity = parseInt(v1Match[1]);
    if (v2Match) this.gameState.p2.velocity = parseInt(v2Match[1]);

    // Look for events
    const triggers = [];
    if (output.includes('scored')) triggers.push('score');
    if (output.includes('hit')) triggers.push('hit');
    if (output.includes('fire')) triggers.push('pew');

    // Calculate sound from state
    this.calculateSound();

    // Send frame
    this.sendFrame(output, triggers);
  }

  calculateSound() {
    // Don't play sound until game is detected as running
    if (!this.gameRunning) {
      // Keep all gates off
      this.soundState.v[0] = { g: 0, f: 28, w: 3, v: 0 };
      this.soundState.v[1] = { g: 0, f: 28, w: 3, v: 0 };
      // Only voices 0-1 - leave 2-3 for UI
      return;
    }

    // Load sound config from game directory (cached)
    if (!this.soundConfig) {
      try {
        this.soundConfig = require(TRAX_SOUND_CONFIG);
        console.log('[bridge] Loaded sound config from trax_sound.json');
      } catch (e) {
        console.log('[bridge] No sound config, using defaults');
        this.soundConfig = null;
      }
    }

    const cfg = this.soundConfig?.engine;
    const speeds = cfg?.speeds || {};
    const baseWave = cfg?.waveform || 3;
    const maxWave = cfg?.waveformMax || 5;

    // P1 Engine (Voice 0)
    const v1 = Math.abs(this.gameState.p1.velocity);
    const s1 = speeds[String(v1)] || speeds[String(Math.min(v1, 3))];
    if (s1) {
      this.soundState.v[0] = {
        g: s1.gate,
        f: s1.freq,
        w: v1 >= 3 ? maxWave : baseWave,
        v: s1.vol
      };
    } else {
      // Fallback: silent when stopped, scale with speed
      this.soundState.v[0] = v1 === 0
        ? { g: 0, f: 28, w: baseWave, v: 0 }
        : { g: 1, f: 28 - v1 * 4, w: baseWave, v: v1 * 3 };
    }

    // P2 Engine (Voice 1)
    const v2 = Math.abs(this.gameState.p2.velocity);
    const s2 = speeds[String(v2)] || speeds[String(Math.min(v2, 3))];
    if (s2) {
      this.soundState.v[1] = {
        g: s2.gate,
        f: s2.freq,
        w: v2 >= 3 ? maxWave : baseWave,
        v: s2.vol
      };
    } else {
      this.soundState.v[1] = v2 === 0
        ? { g: 0, f: 28, w: baseWave, v: 0 }
        : { g: 1, f: 28 - v2 * 4, w: baseWave, v: v2 * 3 };
    }
  }

  sendFrame(display, triggers = []) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (!this.warnedWsClosed) {
        console.log('[bridge] WS not open, cannot send frame');
        this.warnedWsClosed = true;
      }
      return;
    }

    this.frameSeq++;
    if (this.frameSeq <= 3) {
      console.log(`[bridge] Sending frame #${this.frameSeq}, display: ${display.length} bytes`);
    }

    const frame = {
      t: 'frame',
      seq: this.frameSeq,
      ts: Date.now(),
      display: display,
      snd: {
        ...this.soundState,
        trig: triggers
      }
    };

    this.ws.send(JSON.stringify(frame));
  }

  stopGame() {
    if (this.gameProcess) {
      if (pty && this.gameProcess.kill) {
        this.gameProcess.kill();
      } else if (this.gameProcess.kill) {
        this.gameProcess.kill();
      }
      this.gameProcess = null;
    }
  }

  shutdown() {
    console.log('[bridge] Shutting down...');
    this.stopGame();
    if (this.ws) this.ws.close();
    process.exit(0);
  }
}

// Main
console.log('');
console.log('========================================');
console.log('  Trax Bridge - Quasar Game Adapter');
console.log('========================================');
console.log('');

const bridge = new TraxBridge();

process.on('SIGINT', () => bridge.shutdown());
process.on('SIGTERM', () => bridge.shutdown());

module.exports = { TraxBridge };
