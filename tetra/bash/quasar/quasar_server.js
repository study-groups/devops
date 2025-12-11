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
const PULSAR_BIN = process.env.PULSAR_BIN || path.join(TETRA_SRC, 'bash/pulsar/engine/bin/pulsar_slots');

// Game bridge registry
const GAME_BRIDGES = {
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
  estoface: {
    name: 'ESTOFACE',
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
      '/presets.js': 'presets.js'
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
      '.json': 'application/json'
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
      // Browser client sending input
      if (type === 'input') {
        // Forward input to game sources
        this.gameSources.forEach((source, gameWs) => {
          if (gameWs.readyState === WebSocket.OPEN) {
            gameWs.send(JSON.stringify(data));
          }
        });
      } else if (type === 'ping') {
        ws.send(JSON.stringify({ t: 'pong', ts: Date.now() }));
      }
    }
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


