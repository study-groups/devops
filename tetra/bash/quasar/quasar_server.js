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
const TSM_META_DIR = process.env.TSM_META_DIR || path.join(TETRA_DIR, 'tsm/services');

// PULSAR mode: 'subprocess' (default) or 'fifo' (debuggable TSM service)
const PULSAR_MODE = process.env.PULSAR_MODE || 'subprocess';
const PULSAR_FIFO = process.env.PULSAR_FIFO || path.join(TETRA_DIR, 'tsm/runtime/pulsar.fifo');

const { execSync } = require('child_process');

// Game bridge registry
const GAME_BRIDGES = {
  magnetar: {
    name: 'MAGNETAR',
    bridge: path.join(TETRA_SRC, 'bash/game/games/magnetar/magnetar-bridge.js'),
    type: 'osc'
  },
  cymatica: {
    name: 'CYMATICA',
    bridge: path.join(TETRA_SRC, 'bash/midi-mp/cymatica-app.js'),
    type: 'websocket'
  },
  formant: {
    name: 'FORMANT',
    bridge: path.join(TETRA_SRC, 'bash/game/games/formant/formant-bridge.js'),
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

    // Current screen state (ASCII text for /api/screen)
    this.currentScreen = '';

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

    if (url.pathname === '/api/screen') {
      return this.apiScreen(res);
    }

    if (url.pathname === '/api/screen.png') {
      return this.apiScreenPng(res);
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

  apiScreen(res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(this.currentScreen || '(no screen data)');
  }

  apiScreenPng(res) {
    // Render ASCII to PNG using simple canvas-like approach
    const screen = this.currentScreen || '(no screen data)';
    const lines = screen.split('\n');
    const cols = 60;
    const rows = 24;
    const charWidth = 10;
    const charHeight = 20;
    const width = cols * charWidth;
    const height = rows * charHeight;

    // Create a simple PPM image (easy to generate, can convert to PNG)
    // For now, return a text representation with content-type hint
    // A proper implementation would use node-canvas or sharp

    // Simple solution: return as text/plain with ASCII art
    // Client can render it or we add node-canvas later
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'X-Screen-Cols': cols,
      'X-Screen-Rows': rows
    });
    res.end(screen);
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
      // Browser client sending input or screen updates
      if (type === 'input') {
        // Forward input to game sources
        this.gameSources.forEach((source, gameWs) => {
          if (gameWs.readyState === WebSocket.OPEN) {
            gameWs.send(JSON.stringify(data));
          }
        });
      } else if (type === 'screen') {
        // Browser reporting its current screen state
        this.currentScreen = data.screen || '';
      } else if (type === 'bridge.spawn') {
        // Browser requesting to start a game on a channel (slot)
        this.handleBridgeSpawn(ws, data);
      } else if (type === 'ping') {
        ws.send(JSON.stringify({ t: 'pong', ts: Date.now() }));
      }
    }
  }

  handleBridgeSpawn(ws, data) {
    const { game, channel } = data;
    const slot = channel || 0;

    this.log(`Bridge spawn request: game=${game}, slot=${slot}`);

    // For PULSAR engine-based games, initialize the slot directly
    if (game === 'magnetar') {
      if (this.initSlot(slot, 60, 24, 15)) {
        // Spawn demo sprites for MAGNETAR
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
          error: 'Failed to initialize slot'
        }));
      }
      return;
    }

    // For other games, check bridge registry
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

    // TODO: Spawn external bridge process for other games
    ws.send(JSON.stringify({
      t: 'bridge.error',
      game,
      error: 'External bridges not yet implemented'
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
  // PULSAR Management (subprocess or FIFO mode)
  // ═══════════════════════════════════════════════════════════════

  // Connect to PULSAR via FIFO (for debug mode)
  connectToPulsarFifo() {
    if (this.pulsarFifoFd) return true;

    try {
      // Ensure runtime directory exists
      const runtimeDir = path.dirname(PULSAR_FIFO);
      if (!fs.existsSync(runtimeDir)) {
        fs.mkdirSync(runtimeDir, { recursive: true });
      }

      // Create FIFO if needed
      if (!fs.existsSync(PULSAR_FIFO)) {
        execSync(`mkfifo "${PULSAR_FIFO}"`);
        this.log(`Created FIFO: ${PULSAR_FIFO}`);
      }

      // Ensure PULSAR is running via TSM
      this.ensurePulsarRunning();

      // Open FIFO for writing (O_WRONLY | O_NONBLOCK to avoid blocking)
      this.pulsarFifoFd = fs.openSync(PULSAR_FIFO, fs.constants.O_WRONLY | fs.constants.O_NONBLOCK);
      this.log(`Connected to PULSAR FIFO: ${PULSAR_FIFO}`);

      return true;
    } catch (err) {
      this.log(`Failed to connect to PULSAR FIFO: ${err.message}`, 'error');
      return false;
    }
  }

  // Ensure PULSAR is running via TSM (for FIFO mode)
  ensurePulsarRunning() {
    try {
      // Check if pulsar service is running
      execSync('tsm info pulsar 2>/dev/null', { stdio: 'ignore' });
      this.log('PULSAR already running via TSM');
    } catch {
      // Not running, start it
      this.log('Starting PULSAR via TSM...');
      try {
        execSync(`PULSAR_FIFO="${PULSAR_FIFO}" tsm start pulsar`, { stdio: 'inherit' });
      } catch (err) {
        this.log(`Failed to start PULSAR via TSM: ${err.message}`, 'error');
      }
    }
  }

  spawnPulsar() {
    // In FIFO mode, connect to FIFO instead of spawning
    if (PULSAR_MODE === 'fifo') {
      return this.connectToPulsarFifo();
    }

    if (this.pulsar) return true;

    try {
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
    const processDir = path.join(TSM_RUNTIME, 'processes/pulsar-child');
    const pidFile = path.join(processDir, 'pulsar-child.pid');
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

    // Get parent quasar's TSM ID
    const parentName = `quasar-${this.config.httpPort}`;
    let parentTsmId = null;
    try {
      const parentMetaFile = path.join(TSM_RUNTIME, `processes/${parentName}/meta.json`);
      if (fs.existsSync(parentMetaFile)) {
        const parentMeta = JSON.parse(fs.readFileSync(parentMetaFile, 'utf8'));
        parentTsmId = parentMeta.tsm_id || null;
      }
    } catch (err) {
      // Ignore, parent ID will be null
    }

    // Determine communication type
    const commType = PULSAR_MODE === 'fifo' ? 'fifo' : 'pipe';
    const commPath = PULSAR_MODE === 'fifo' ? PULSAR_FIFO : null;

    const meta = {
      tsm_id: tsmId,
      org: 'tetra',
      name: 'pulsar-child',
      pid: this.pulsar.pid,
      command: PULSAR_BIN,
      port: null,
      port_type: 'none',
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
      parent_tsm_id: parentTsmId,
      children: [],
      comm_type: commType,
      comm_path: commPath,
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

      this.log(`TSM registered: pulsar-child (TSM ID: ${tsmId}, PID: ${this.pulsar.pid})`);
    } catch (err) {
      this.log(`TSM registration failed: ${err.message}`, 'error');
    }
  }

  unregisterPulsarFromTSM() {
    const processDir = path.join(TETRA_DIR, 'tsm/runtime/processes/pulsar-child');
    try {
      if (fs.existsSync(processDir)) {
        // Remove directory recursively
        fs.rmSync(processDir, { recursive: true, force: true });
        this.log('TSM unregistered: pulsar-child');
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
    // When we see frame data starting (after RENDER command)
    if (line.startsWith('|') || line.startsWith('=')) {
      // This is the start of a frame
      this.currentFrame = [line];
      return;
    }

    // Log other responses
    if (this.config.verbose) {
      this.log(`PULSAR: ${line}`);
    }
  }

  sendToPulsar(cmd) {
    if (PULSAR_MODE === 'fifo') {
      // FIFO mode - write to named pipe
      if (!this.pulsarFifoFd) {
        if (!this.connectToPulsarFifo()) return false;
      }
      try {
        fs.writeSync(this.pulsarFifoFd, cmd + '\n');
        return true;
      } catch (err) {
        this.log(`FIFO write error: ${err.message}`, 'error');
        this.pulsarFifoFd = null;  // Reset for reconnect
        return false;
      }
    } else {
      // Subprocess mode - write to stdin
      if (!this.pulsar) {
        if (!this.spawnPulsar()) return false;
      }
      this.pulsar.stdin.write(cmd + '\n');
      return true;
    }
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

    // Stop all slot timers
    for (let i = 0; i < 256; i++) {
      if (this.slots[i] && this.slots[i].timer) {
        clearInterval(this.slots[i].timer);
      }
    }

    // Shutdown PULSAR
    if (PULSAR_MODE === 'fifo') {
      // FIFO mode - just close file descriptor, don't stop PULSAR service
      if (this.pulsarFifoFd) {
        try {
          fs.closeSync(this.pulsarFifoFd);
        } catch (err) {
          // Ignore close errors
        }
        this.pulsarFifoFd = null;
      }
    } else if (this.pulsar) {
      // Subprocess mode - send QUIT and kill
      this.sendToPulsar('QUIT');
      setTimeout(() => {
        if (this.pulsar) this.pulsar.kill();
      }, 1000);
    }

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
console.log(`PULSAR Mode: ${PULSAR_MODE}` + (PULSAR_MODE === 'fifo' ? ` (${PULSAR_FIFO})` : ''));
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
