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
 *   QUASAR_PORT=1985 OSC_IN=1986 node quasar_server.js
 */

const http = require('http');
const path = require('path');

// Optional dependencies
let WebSocket;
try {
  WebSocket = require('ws');
} catch (e) {
  console.log('[quasar] ws module not found, WebSocket disabled');
}

// Match system modules
let MatchRegistry, Matchmaker, Doctor, MonogramManager, ScoreManager;
try {
  ({ MatchRegistry } = require('./lib/match_registry'));
  ({ Matchmaker } = require('./lib/matchmaker'));
  ({ Doctor } = require('./lib/doctor'));
  ({ MonogramManager } = require('../scores/monogram'));
  ({ ScoreManager } = require('../scores/scores'));
  console.log('[quasar] Match system modules loaded');
} catch (e) {
  console.log('[quasar] Match system modules not found:', e.message);
}

// New modular components
const { HTTPRouter } = require('./lib/http_router');
const { WSProtocol, MasterTick } = require('./lib/ws_protocol');
const { OSCHandler } = require('./lib/osc_handler');
const { PulsarEngine } = require('./lib/pulsar_engine');
const { SlotManager } = require('./lib/slot_manager');
const { BridgeFactory } = require('./lib/bridge_factory');

// Configuration - QUASAR_PORT takes precedence over generic PORT
const PORT = parseInt(process.env.QUASAR_PORT || 1985);
const OSC_IN = parseInt(process.env.OSC_IN || 1986);
const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');

/**
 * QuasarServer - PT100 MERIDIAN Game System (Modular Architecture)
 */
class QuasarServer {
  constructor(config = {}) {
    this.config = {
      httpPort: config.httpPort || PORT,
      oscInPort: config.oscInPort || OSC_IN,
      verbose: config.verbose || false,
      ...config
    };

    // Core state
    this.clients = new Map();  // ws -> { id, connectedAt, latency, stats }
    this.gameSources = new Map();
    this.currentScreen = '';
    this.lastFrame = null;     // Latest frame for pull mode
    this.lastFrameTs = 0;      // Timestamp of last frame
    this.soundState = {
      mode: 'tia',
      v: [
        { g: 0, f: 0, w: 0, v: 0 },
        { g: 0, f: 0, w: 0, v: 0 },
        { g: 0, f: 0, w: 0, v: 0 },
        { g: 0, f: 0, w: 0, v: 0 }
      ]
    };
    this.stats = {
      framesRelayed: 0,
      oscMessages: 0,
      clientsConnected: 0,
      bridgesSpawned: 0,
      startedAt: Date.now()
    };

    // Initialize modules
    this.initModules();
    this.initMatchSystem();
    this.setupHTTP();
  }

  initModules() {
    // HTTP Router
    this.httpRouter = new HTTPRouter(this);

    // WebSocket Protocol
    this.wsProtocol = new WSProtocol(this);

    // OSC Handler
    this.oscHandler = new OSCHandler(this, {
      oscInPort: this.config.oscInPort,
      verbose: this.config.verbose
    });

    // PULSAR Engine
    this.pulsarEngine = new PulsarEngine(this, {
      verbose: this.config.verbose
    });

    // Slot Manager (depends on PulsarEngine)
    this.slotManager = new SlotManager(this, this.pulsarEngine);

    // Bridge Factory (depends on SlotManager)
    this.bridgeFactory = new BridgeFactory(this);

    // Master Tick for synchronized multiplayer (disabled by default)
    this.masterTick = new MasterTick(this, {
      fps: 15
    });

    this.log('Modules initialized');
  }

  /**
   * Enable master tick for synchronized multiplayer
   */
  enableMasterTick(fps = 15) {
    this.masterTick.setFps(fps);
    this.masterTick.start();
  }

  /**
   * Disable master tick
   */
  disableMasterTick() {
    this.masterTick.stop();
  }

  initMatchSystem() {
    if (!MatchRegistry) {
      this.log('Match system disabled (modules not loaded)');
      return;
    }

    const dataDir = path.join(TETRA_DIR, 'scores');

    this.matchRegistry = new MatchRegistry();
    this.matchmaker = new Matchmaker(this.matchRegistry);
    this.doctor = new Doctor(this.matchRegistry);
    this.monogramManager = new MonogramManager({ dataDir });
    this.scoreManager = new ScoreManager({ dataDir });

    this.wireMatchEvents();
    this.matchmaker.start();
    this.doctor.start();

    this.log('Match system initialized');
    this.log(`  - Registry: 240 slots`);
    this.log(`  - Monograms: ${this.monogramManager.getGlobalStats().uniqueMonograms} assigned`);
  }

  wireMatchEvents() {
    // Matchmaker events
    this.matchmaker.on('matchCreated', ({ match, players }) => {
      this.log(`Match created: ${match.idHex} with ${players.length} players`);
      this.wsProtocol.broadcastToMatch(match.id, {
        t: 'match.created',
        matchId: match.idHex,
        gameType: match.gameType,
        players: players.map(p => ({ monogram: p.monogram, slot: p.slot }))
      });
    });

    this.matchmaker.on('matchReady', ({ match }) => {
      this.wsProtocol.broadcastToMatch(match.id, {
        t: 'match.ready',
        matchId: match.idHex
      });
    });

    // Registry events
    this.matchRegistry.on('playerJoined', ({ match, player }) => {
      this.wsProtocol.broadcastToMatch(match.id, {
        t: 'player.joined',
        matchId: match.idHex,
        player: { monogram: player.monogram, slot: player.slot }
      });
    });

    this.matchRegistry.on('playerLeft', ({ match, player }) => {
      this.wsProtocol.broadcastToMatch(match.id, {
        t: 'player.left',
        matchId: match.idHex,
        player: { monogram: player.monogram, slot: player.slot }
      });
    });

    this.matchRegistry.on('matchStarted', ({ match }) => {
      this.wsProtocol.broadcastToMatch(match.id, {
        t: 'match.started',
        matchId: match.idHex
      });
    });

    this.matchRegistry.on('matchEnded', ({ match, reason }) => {
      for (const player of match.players) {
        if (player.id && player.score !== undefined) {
          this.scoreManager.submit(match.gameType, player.monogram, player.score, {
            matchId: match.idHex,
            duration: Date.now() - match.started
          });
        }
      }

      this.wsProtocol.broadcastToMatch(match.id, {
        t: 'match.ended',
        matchId: match.idHex,
        reason
      });
    });

    // Doctor events
    this.doctor.on('evict', ({ match, monogram }) => {
      this.log(`Doctor evicted ${monogram} from match ${match}`);
    });

    this.doctor.on('action', ({ match, action }) => {
      if (this.config.verbose) {
        this.log(`Doctor action on ${match}: ${action.type}`);
      }
    });

    // Score events
    this.scoreManager.on('newHighScore', ({ gameType, monogram, score }) => {
      this.log(`New high score! ${monogram}: ${score} in ${gameType}`);
      this.wsProtocol.broadcast({
        t: 'highscore',
        gameType,
        monogram,
        score
      });
    });
  }

  setupHTTP() {
    this.server = http.createServer((req, res) => {
      this.httpRouter.handle(req, res);
    });

    if (WebSocket) {
      this.wss = new WebSocket.Server({
        server: this.server,
        path: '/ws'
      });

      this.wss.on('connection', (ws, req) => {
        this.wsProtocol.handleConnection(ws, req);
      });
    }

    this.server.listen(this.config.httpPort, '0.0.0.0', () => {
      this.log(`HTTP server on http://localhost:${this.config.httpPort}`);
      if (WebSocket) {
        this.log(`WebSocket on ws://localhost:${this.config.httpPort}/ws`);
      }
    });

    // Setup OSC
    this.oscHandler.setup();
  }

  log(msg, level = 'info') {
    const prefix = level === 'error' ? '!' : '*';
    const timestamp = new Date().toISOString().substring(11, 19);
    console.log(`[${timestamp}] ${prefix} ${msg}`);
  }

  shutdown() {
    this.log('Shutting down...');

    // Stop match system
    if (this.doctor) {
      this.doctor.stop();
      this.log('Doctor stopped');
    }

    // End all active matches
    if (this.matchRegistry) {
      const active = this.matchRegistry.getActive();
      for (const match of active) {
        this.matchRegistry.end(match.id, 'server_shutdown');
      }
      this.log(`Ended ${active.length} active matches`);
    }

    // Stop modules
    this.masterTick.stop();
    this.slotManager.stop();
    this.pulsarEngine.stop();
    this.oscHandler.stop();
    this.bridgeFactory.stop();

    this.log('Shutdown complete');
    process.exit(0);
  }
}

// ═══════════════════════════════════════════════════════════════
// Main Entry Point
// ═══════════════════════════════════════════════════════════════

const server = new QuasarServer({
  httpPort: PORT,
  oscInPort: OSC_IN,
  verbose: process.env.VERBOSE === '1'
});

// Graceful shutdown
process.on('SIGINT', () => server.shutdown());
process.on('SIGTERM', () => server.shutdown());

console.log(`
========================================
  Quasar Audio Server
========================================

PULSAR Mode: ${process.env.PULSAR_MODE || 'subprocess'}

OSC Commands:
  /quasar/{voice}/set {gate} {freq} {wave} {vol}
  /quasar/{voice}/gate {0|1}
  /quasar/mode {tia|pwm|sidplus}
  /quasar/trigger/{name}

Press Ctrl+C to stop
`);

module.exports = { QuasarServer };
