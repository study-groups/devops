#!/usr/bin/env node

/**
 * Quasar Server - PT100 MERIDIAN Game System
 *
 * Receives game frames and OSC sound commands, broadcasts to browser clients.
 * Manages game bridge spawning for 256 MIDI-MP channels.
 *
 * Ports:
 *   HTTP/WS: 1985 (default)
 *   OSC IN:  1986 (sound commands from games)
 *
 * Usage:
 *   node quasar_server.js
 *   PORT=1985 OSC_IN=1986 node quasar_server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Optional dependencies - graceful fallback
let WebSocket, osc;
try {
  WebSocket = require('ws');
} catch (e) {
  console.log('[quasar] ws module not found, WebSocket disabled');
  console.log('[quasar] Install with: npm install ws');
}

try {
  osc = require('osc');
} catch (e) {
  console.log('[quasar] osc module not found, OSC disabled');
  console.log('[quasar] Install with: npm install osc');
}

// Configuration
const PORT = parseInt(process.env.PORT || 1985);
const OSC_IN = parseInt(process.env.OSC_IN || 1986);
const TETRA_SRC = process.env.TETRA_SRC || path.join(process.env.HOME, 'src/devops/tetra');
const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');
const PULSAR_BIN = process.env.PULSAR_BIN || path.join(TETRA_SRC, 'bash/pulsar/engine/bin/pulsar_slots');

// Game bridge registry
const GAME_BRIDGES = {
  fireball: {
    name: 'FIREBALL',
    bridge: path.join(TETRA_SRC, 'bash/game/games/pulsar/pulsar-game.js'),
    type: 'osc'
  },
  pulsar: {
    name: 'PULSAR',
    bridge: path.join(TETRA_SRC, 'bash/game/games/pulsar/pulsar-game.js'),
    type: 'osc'
  },
  cymatica: {
    name: 'CYMATICA',
    bridge: path.join(TETRA_SRC, 'bash/midi-mp/cymatica-app.js'),
    type: 'websocket'
  },
  asciimouth: {
    name: 'ASCIIMOUTH',
    bridge: path.join(TETRA_SRC, 'bash/game/games/formant/estoface-bridge.js'),
    type: 'osc'
  },
  pong: {
    name: 'PONG',
    bridge: null,  // Built-in browser game
    type: 'builtin'
  }
};

/**
 * QuasarServer - PT100 MERIDIAN Game System
 */
class QuasarServer {
  constructor(config = {}) {
    this.config = {
      httpPort: config.httpPort || PORT,
      oscInPort: config.oscInPort || OSC_IN,
      verbose: config.verbose || false,
      ...config
    };

    // Connected browser clients
    this.clients = new Set();

    // Connected game sources (can send frames)
    this.gameSources = new Map(); // ws -> { gameType, lastFrame }

    // Current sound state (for new client sync)
    this.soundState = {
      mode: 'tia',
      v: [
        { g: 0, f: 0, w: 0, v: 0 },
        { g: 0, f: 0, w: 0, v: 0 },
        { g: 0, f: 0, w: 0, v: 0 },
        { g: 0, f: 0, w: 0, v: 0 }
      ]
    };

    // Stats
    this.stats = {
      framesRelayed: 0,
      oscMessages: 0,
      clientsConnected: 0,
      bridgesSpawned: 0,
      startedAt: Date.now()
    };

    // Active game bridges: channel -> { process, game, clientWs }
    this.bridges = new Map();

    // PULSAR subprocess (shared across all slots)
    this.pulsar = null;
    this.pulsarBuffer = '';
    this.pulsarCallbacks = new Map(); // slot -> callback for responses

    // Per-slot state: slot -> { fps, timer, cols, rows, sprites }
    this.slots = new Array(256).fill(null);

    this.setupHTTP();
    if (osc) this.setupOSC();
  }

  setupHTTP() {
    this.server = http.createServer((req, res) => {
      this.handleHTTP(req, res);
    });

    if (WebSocket) {
      this.wss = new WebSocket.Server({
        server: this.server,
        path: '/ws'
      });

      this.wss.on('connection', (ws, req) => {
        this.handleWSConnection(ws, req);
      });
    }

    this.server.listen(this.config.httpPort, '0.0.0.0', () => {
      this.log(`HTTP server on http://localhost:${this.config.httpPort}`);
      if (WebSocket) {
        this.log(`WebSocket on ws://localhost:${this.config.httpPort}/ws`);
      }
    });
  }

  setupOSC() {
    this.oscIn = new osc.UDPPort({
      localAddress: '0.0.0.0',
      localPort: this.config.oscInPort,
      broadcast: true,
      metadata: true
    });

    this.oscIn.on('ready', () => {
      this.log(`OSC listening on :${this.config.oscInPort}`);
    });

    this.oscIn.on('message', (msg, timeTag, info) => {
      this.handleOSCMessage(msg, info);
    });

    this.oscIn.on('error', (err) => {
      this.log(`OSC error: ${err.message}`, 'error');
    });

    this.oscIn.open();
  }

  handleHTTP(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    // API Routes
    if (url.pathname === '/api/status') {
      return this.apiStatus(res);
    }

    // Serve static files from browser/
    const staticFiles = {
      '/': 'index.html',
      '/index.html': 'index.html',
      '/quasar.js': 'quasar.js',
      '/tia-worklet.js': 'tia-worklet.js',
      '/terminal.js': 'terminal.js',
      '/presets.js': 'presets.js',
      '/fonts/FiraCode-Regular.woff2': 'fonts/FiraCode-Regular.woff2',
      '/fonts/fonts.css': 'fonts/fonts.css'
    };

    const filename = staticFiles[url.pathname];
    if (filename) {
      return this.serveFile(res, filename);
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  serveFile(res, filename) {
    const filePath = path.join(__dirname, 'browser', filename);
    const ext = path.extname(filename);

    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.woff2': 'font/woff2'
    };

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end(`File not found: ${filename}`);
      } else {
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
        res.end(content);
      }
    });
  }

  apiStatus(res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      uptime: Date.now() - this.stats.startedAt,
      clients: this.clients.size,
      gameSources: this.gameSources.size,
      stats: this.stats,
      soundState: this.soundState
    }));
  }

  handleWSConnection(ws, req) {
    const clientIp = req.socket.remoteAddress;
    const isGameSource = req.url.includes('role=game');

    if (isGameSource) {
      this.gameSources.set(ws, { gameType: 'unknown', lastFrame: null });
      this.log(`Game source connected: ${clientIp}`);
    } else {
      this.clients.add(ws);
      this.stats.clientsConnected++;
      this.log(`Browser client connected: ${clientIp} (total: ${this.clients.size})`);

      // Send current sound state to new client
      ws.send(JSON.stringify({
        t: 'sync',
        snd: this.soundState
      }));
    }

    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg);
        this.handleWSMessage(ws, data, isGameSource);
      } catch (e) {
        this.log(`WS parse error: ${e.message}`, 'error');
      }
    });

    ws.on('close', () => {
      if (isGameSource) {
        this.gameSources.delete(ws);
        this.log(`Game source disconnected: ${clientIp}`);
      } else {
        this.clients.delete(ws);
        this.log(`Browser client disconnected: ${clientIp} (total: ${this.clients.size})`);
      }
    });

    ws.on('error', (err) => {
      this.log(`WS error: ${err.message}`, 'error');
    });
  }

  handleWSMessage(ws, data, isGameSource) {
    const { t: type } = data;

    if (isGameSource) {
      // Game source sending frames
      if (type === 'frame') {
        this.relayFrame(data);
      } else if (type === 'register') {
        const source = this.gameSources.get(ws);
        if (source) {
          source.gameType = data.gameType || 'unknown';
          this.log(`Game registered: ${source.gameType}`);
        }
      }
    } else {
      // Browser client sending input or commands
      if (type === 'input') {
        // Forward input to game sources
        this.gameSources.forEach((source, gameWs) => {
          if (gameWs.readyState === WebSocket.OPEN) {
            gameWs.send(JSON.stringify(data));
          }
        });
      } else if (type === 'bridge.spawn') {
        this.handleBridgeSpawn(ws, data);
      } else if (type === 'screen') {
        // Browser reporting its current screen state
        this.currentScreen = data.screen || '';
      } else if (type === 'ping') {
        ws.send(JSON.stringify({ t: 'pong', ts: Date.now() }));
      }
    }
  }

  handleBridgeSpawn(ws, data) {
    const { game, channel } = data;
    const slot = channel || 0;

    this.log(`Bridge spawn request: game=${game}, slot=${slot}`);

    const bridgeConfig = GAME_BRIDGES[game];
    if (!bridgeConfig) {
      ws.send(JSON.stringify({
        t: 'bridge.error',
        game,
        error: 'Unknown game'
      }));
      return;
    }

    if (bridgeConfig.type === 'builtin') {
      // Built-in browser game (e.g., PONG)
      ws.send(JSON.stringify({
        t: 'bridge.ready',
        game,
        slot,
        status: 'builtin'
      }));
      return;
    }

    // For pulsar-based games, use the internal PULSAR subprocess
    if (game === 'fireball' || game === 'pulsar') {
      if (this.initSlot(slot, 60, 24, 15)) {
        // Spawn demo sprites for FIREBALL/PULSAR
        this.spawnSprite(slot, 'pulsar', 30, 12, { len0: 4, dtheta: 0.1, valence: 1 });
        this.spawnSprite(slot, 'pulsar', 50, 12, { len0: 4, dtheta: -0.1, valence: 2 });

        ws.send(JSON.stringify({
          t: 'bridge.ready',
          game,
          slot,
          status: 'ok'
        }));
      } else {
        ws.send(JSON.stringify({
          t: 'bridge.error',
          game,
          slot,
          error: 'Failed to initialize slot (PULSAR binary not found)'
        }));
      }
      return;
    }

    // For other games, try to spawn their bridge process
    const fs = require('fs');
    if (!bridgeConfig.bridge || !fs.existsSync(bridgeConfig.bridge)) {
      this.log(`Bridge not found: ${bridgeConfig.bridge}`, 'error');
      ws.send(JSON.stringify({
        t: 'bridge.error',
        game,
        error: `Bridge not found: ${bridgeConfig.bridge}`
      }));
      return;
    }

    // Spawn the bridge process
    const { spawn } = require('child_process');
    const bridgeProcess = spawn('node', [bridgeConfig.bridge], {
      env: {
        ...process.env,
        QUASAR_WS: `ws://localhost:${this.config.httpPort}/ws?role=game`,
        GAME_SLOT: String(slot)
      }
    });

    bridgeProcess.stdout.on('data', (data) => {
      this.log(`[${game}] ${data.toString().trim()}`);
    });

    bridgeProcess.stderr.on('data', (data) => {
      this.log(`[${game}] ${data.toString().trim()}`, 'error');
    });

    bridgeProcess.on('close', (code) => {
      this.log(`[${game}] Bridge exited with code ${code}`);
      this.bridges.delete(slot);
    });

    // Store bridge reference
    this.bridges.set(slot, { process: bridgeProcess, game, clientWs: ws });
    this.stats.bridgesSpawned++;

    ws.send(JSON.stringify({
      t: 'bridge.ready',
      game,
      slot,
      status: 'spawned'
    }));
  }

  relayFrame(frame) {
    this.stats.framesRelayed++;

    // Debug: log first few frames
    if (this.stats.framesRelayed <= 3) {
      this.log(`Frame #${this.stats.framesRelayed} received, clients: ${this.clients.size}`);
    }

    // Update sound state for new client sync
    if (frame.snd) {
      if (frame.snd.mode) this.soundState.mode = frame.snd.mode;
      if (frame.snd.v) this.soundState.v = frame.snd.v;
    }

    // Broadcast to all browser clients
    const frameStr = JSON.stringify(frame);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(frameStr);
      }
    });
  }

  handleOSCMessage(msg, info) {
    this.stats.oscMessages++;
    const parts = msg.address.split('/').filter(Boolean);

    if (this.config.verbose) {
      this.log(`OSC: ${msg.address} ${JSON.stringify(msg.args.map(a => a.value))}`);
    }

    // /quasar/{voice}/set {gate} {freq} {wave} {vol}
    // /quasar/{voice}/gate {0|1}
    // /quasar/mode {tia|pwm|sidplus}
    // /quasar/trigger/{name}

    if (parts[0] !== 'quasar') return;

    const args = msg.args.map(a => a.value);

    if (parts[1] === 'mode') {
      this.soundState.mode = args[0];
      this.broadcastSound({ mode: args[0] });
    } else if (parts[1] === 'trigger') {
      const triggerName = parts[2];
      const voice = args[0];
      this.broadcastSound({ trig: [{ name: triggerName, voice }] });
    } else {
      // Voice command: /quasar/0/set or /quasar/0/gate
      const voiceNum = parseInt(parts[1]);
      if (voiceNum >= 0 && voiceNum < 4) {
        const cmd = parts[2];
        if (cmd === 'set' && args.length >= 4) {
          const [gate, freq, wave, vol] = args;
          this.soundState.v[voiceNum] = { g: gate, f: freq, w: wave, v: vol };
          this.broadcastSound({ v: this.soundState.v });
        } else if (cmd === 'gate') {
          this.soundState.v[voiceNum].g = args[0];
          this.broadcastSound({ v: this.soundState.v });
        }
      }
    }
  }

  broadcastSound(sndUpdate) {
    const msg = JSON.stringify({ t: 'snd', snd: sndUpdate });
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }

  log(msg, level = 'info') {
    const prefix = level === 'error' ? '!' : '*';
    const timestamp = new Date().toISOString().substring(11, 19);
    console.log(`[${timestamp}] ${prefix} ${msg}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // PULSAR Subprocess Management
  // ═══════════════════════════════════════════════════════════════

  spawnPulsar() {
    if (this.pulsar) return true;

    try {
      const { spawn } = require('child_process');
      this.pulsar = spawn(PULSAR_BIN, [], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.pulsar.stdout.on('data', (data) => {
        this.handlePulsarOutput(data.toString());
      });

      this.pulsar.stderr.on('data', (data) => {
        this.log(`PULSAR stderr: ${data.toString().trim()}`, 'info');
      });

      this.pulsar.on('close', (code) => {
        this.log(`PULSAR exited with code ${code}`, code ? 'error' : 'info');
        this.unregisterPulsarFromTSM();
        this.pulsar = null;
        // Clear all slots
        this.slots.fill(null);
      });

      this.pulsar.on('error', (err) => {
        this.log(`PULSAR spawn error: ${err.message}`, 'error');
        this.pulsar = null;
      });

      this.log(`PULSAR spawned: ${PULSAR_BIN} (PID: ${this.pulsar.pid})`);

      // Register with TSM
      this.registerPulsarWithTSM();

      return true;
    } catch (err) {
      this.log(`Failed to spawn PULSAR: ${err.message}`, 'error');
      return false;
    }
  }

  registerPulsarWithTSM() {
    if (!this.pulsar) return;

    const TSM_RUNTIME = path.join(TETRA_DIR, 'tsm/runtime');
    const processDir = path.join(TSM_RUNTIME, 'processes/pulsar');
    const pidFile = path.join(processDir, 'pulsar.pid');
    const metaFile = path.join(processDir, 'meta.json');

    // Read next TSM ID and increment
    let tsmId = 99;
    const nextIdFile = path.join(TSM_RUNTIME, 'next_id');
    try {
      if (fs.existsSync(nextIdFile)) {
        tsmId = parseInt(fs.readFileSync(nextIdFile, 'utf8').trim()) || 99;
        fs.writeFileSync(nextIdFile, String(tsmId + 1));
      }
    } catch (err) {
      // Ignore, use default
    }

    // Build parent name from quasar port
    const parentName = `quasar-${this.config.httpPort}`;

    const meta = {
      tsm_id: tsmId,
      org: 'tetra',
      name: 'pulsar',
      pid: this.pulsar.pid,
      command: PULSAR_BIN,
      port: null,
      port_type: 'pipe',
      cwd: path.dirname(PULSAR_BIN),
      interpreter: PULSAR_BIN,
      process_type: 'binary',
      service_type: 'subprocess',
      env_file: '',
      prehook: '',
      status: 'online',
      start_time: Math.floor(Date.now() / 1000),
      restarts: 0,
      unstable_restarts: 0,
      parent: parentName,
      socket_path: null,
      children: [],
      git: null
    };

    try {
      // Create process directory
      fs.mkdirSync(processDir, { recursive: true });

      // Write PID file
      fs.writeFileSync(pidFile, String(this.pulsar.pid));

      // Write meta.json
      fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));

      // Create empty log files
      fs.writeFileSync(path.join(processDir, 'current.out'), '');
      fs.writeFileSync(path.join(processDir, 'current.err'), '');

      this.log(`TSM registered: pulsar (TSM ID: ${tsmId}, PID: ${this.pulsar.pid}, parent: ${parentName})`);
    } catch (err) {
      this.log(`TSM registration failed: ${err.message}`, 'error');
    }
  }

  unregisterPulsarFromTSM() {
    const processDir = path.join(TETRA_DIR, 'tsm/runtime/processes/pulsar');
    try {
      if (fs.existsSync(processDir)) {
        fs.rmSync(processDir, { recursive: true, force: true });
        this.log('TSM unregistered: pulsar');
      }
    } catch (err) {
      this.log(`TSM unregister failed: ${err.message}`, 'error');
    }
  }

  handlePulsarOutput(data) {
    this.pulsarBuffer += data;

    // Process complete lines
    let newlineIdx;
    while ((newlineIdx = this.pulsarBuffer.indexOf('\n')) !== -1) {
      const line = this.pulsarBuffer.slice(0, newlineIdx);
      this.pulsarBuffer = this.pulsarBuffer.slice(newlineIdx + 1);
      this.handlePulsarLine(line);
    }
  }

  handlePulsarLine(line) {
    // Check for frame data (accumulate until END_FRAME)
    if (this.currentFrame !== undefined) {
      if (line === 'END_FRAME') {
        // Frame complete - broadcast to clients
        const frameData = this.currentFrame;
        const slot = this.currentFrameSlot;
        this.currentFrame = undefined;
        this.currentFrameSlot = undefined;

        this.broadcastPulsarFrame(slot, frameData);
      } else {
        this.currentFrame.push(line);
      }
      return;
    }

    // Check for response to start frame capture
    if (line.startsWith('|') || line.startsWith('=')) {
      this.currentFrame = [line];
      return;
    }

    // Log other responses
    if (this.config.verbose) {
      this.log(`PULSAR: ${line}`);
    }
  }

  sendToPulsar(cmd) {
    if (!this.pulsar) {
      if (!this.spawnPulsar()) return false;
    }
    this.pulsar.stdin.write(cmd + '\n');
    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  // Slot Management
  // ═══════════════════════════════════════════════════════════════

  initSlot(slot, cols = 60, rows = 24, fps = 15) {
    if (slot < 0 || slot >= 256) return false;

    if (!this.spawnPulsar()) return false;

    this.sendToPulsar(`${slot} INIT ${cols} ${rows} ${fps}`);

    this.slots[slot] = {
      fps,
      cols,
      rows,
      timer: null,
      sprites: []
    };

    // Start tick timer for this slot
    const interval = Math.floor(1000 / fps);
    this.slots[slot].timer = setInterval(() => {
      this.tickSlot(slot, interval);
    }, interval);

    this.log(`Slot ${slot} initialized: ${cols}x${rows} @ ${fps}fps`);
    return true;
  }

  destroySlot(slot) {
    if (slot < 0 || slot >= 256 || !this.slots[slot]) return;

    // Stop timer
    if (this.slots[slot].timer) {
      clearInterval(this.slots[slot].timer);
    }

    // Tell PULSAR to destroy slot
    this.sendToPulsar(`${slot} DESTROY`);

    this.slots[slot] = null;
    this.log(`Slot ${slot} destroyed`);
  }

  tickSlot(slot, ms) {
    if (!this.slots[slot]) return;

    this.currentFrameSlot = slot;
    this.sendToPulsar(`${slot} TICK ${ms}`);
    this.sendToPulsar(`${slot} RENDER`);
  }

  spawnSprite(slot, type, x, y, params = {}) {
    if (!this.slots[slot]) return null;

    const len0 = params.len0 || 4;
    const dtheta = params.dtheta || 0.1;
    const valence = params.valence || 1;

    this.sendToPulsar(`${slot} SPAWN ${type} ${x} ${y} ${len0} ${dtheta} ${valence}`);
    return true;
  }

  broadcastPulsarFrame(slot, frameLines) {
    const frame = {
      t: 'frame',
      slot,
      display: frameLines.join('\n'),
      ts: Date.now()
    };

    // Update current screen for /api/screen
    this.currentScreen = frame.display;

    const frameStr = JSON.stringify(frame);
    this.stats.framesRelayed++;

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(frameStr);
      }
    });
  }

  shutdown() {
    this.log('Shutting down...');

    if (this.oscIn) this.oscIn.close();

    if (this.wss) {
      this.wss.clients.forEach(client => client.close());
      this.wss.close();
    }

    this.server.close(() => {
      this.log('Shutdown complete');
      process.exit(0);
    });

    setTimeout(() => process.exit(1), 5000);
  }
}

// Main
console.log('');
console.log('========================================');
console.log('  Quasar Audio Server');
console.log('========================================');
console.log('');

const server = new QuasarServer({
  verbose: process.argv.includes('-v') || process.argv.includes('--verbose')
});

console.log('');
console.log('OSC Commands:');
console.log('  /quasar/{voice}/set {gate} {freq} {wave} {vol}');
console.log('  /quasar/{voice}/gate {0|1}');
console.log('  /quasar/mode {tia|pwm|sidplus}');
console.log('  /quasar/trigger/{name}');
console.log('');
console.log('Press Ctrl+C to stop');
console.log('');

process.on('SIGINT', () => server.shutdown());
process.on('SIGTERM', () => server.shutdown());

module.exports = { QuasarServer };


