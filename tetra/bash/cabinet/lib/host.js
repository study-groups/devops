/**
 * host.js - Generic WebSocket host for multiplayer game sessions
 *
 * Runs a WebSocket server for local player connections.
 * Manages player slots (p1, p2, spectators).
 * Broadcasts game frames to all connected clients.
 * Optionally connects to Quasar relay for internet play.
 *
 * Usage:
 *   const host = new Host({ port: 8080, driver });
 *   host.start();
 */

const WebSocket = require('ws');

const SLOTS = ['p1', 'p2'];

class Host {
  constructor(options = {}) {
    this.port = options.port || 8080;
    this.quasarUrl = options.quasar || null;
    this.driver = options.driver || null;
    this.httpServer = options.server || null;  // Optional HTTP server to attach to

    // Player connections: Map<ws, {id, slot, joinedAt}>
    this.players = new Map();
    this.spectators = new Set();
    this.nextPlayerId = 1;

    // Callbacks
    this._onPlayerJoin = null;
    this._onPlayerLeave = null;
    this._onInput = null;

    // Servers
    this.wss = null;
    this.quasarWs = null;

    // Frame state
    this.lastFrame = null;
    this.frameSeq = 0;
  }

  start() {
    this._startLocalServer();
    if (this.quasarUrl) {
      this._connectQuasar();
    }
    if (this.driver) {
      this.driver.onFrame((frame) => this._handleFrame(frame));
      this.driver.start();
    }
    console.log(`[host] Started on port ${this.port}`);
    return this;
  }

  stop() {
    if (this.driver) this.driver.stop();
    if (this.wss) this.wss.close();
    if (this.quasarWs) this.quasarWs.close();
    console.log('[host] Stopped');
  }

  // Event handlers
  onPlayerJoin(callback) { this._onPlayerJoin = callback; }
  onPlayerLeave(callback) { this._onPlayerLeave = callback; }
  onInput(callback) { this._onInput = callback; }

  // Assign player to slot or spectator
  _assignSlot() {
    for (const slot of SLOTS) {
      const taken = [...this.players.values()].some(p => p.slot === slot);
      if (!taken) return slot;
    }
    return 'spectator';
  }

  // Start local WebSocket server
  _startLocalServer() {
    // Attach to HTTP server if provided, otherwise create standalone
    if (this.httpServer) {
      this.wss = new WebSocket.Server({ server: this.httpServer });
    } else {
      this.wss = new WebSocket.Server({ port: this.port });
    }

    this.wss.on('connection', (ws, req) => {
      const playerId = this.nextPlayerId++;
      const slot = this._assignSlot();
      const player = { id: playerId, slot, joinedAt: Date.now() };

      if (slot === 'spectator') {
        this.spectators.add(ws);
      } else {
        this.players.set(ws, player);
      }

      console.log(`[host] Player ${playerId} connected as ${slot}`);

      // Send welcome message
      ws.send(JSON.stringify({
        t: 'welcome',
        playerId,
        slot,
        players: this._getPlayerList()
      }));

      // Broadcast player joined
      this._broadcastPlayerList();

      // Send last frame if available
      if (this.lastFrame) {
        ws.send(JSON.stringify(this.lastFrame));
      }

      if (this._onPlayerJoin) {
        this._onPlayerJoin(player, ws);
      }

      ws.on('message', (msg) => {
        try {
          const data = JSON.parse(msg);
          this._handleClientMessage(ws, player, data);
        } catch (e) {
          // Ignore parse errors
        }
      });

      ws.on('close', () => {
        this.players.delete(ws);
        this.spectators.delete(ws);
        console.log(`[host] Player ${playerId} disconnected`);
        this._broadcastPlayerList();
        if (this._onPlayerLeave) {
          this._onPlayerLeave(player);
        }
      });
    });

    this.wss.on('error', (err) => {
      console.error('[host] Server error:', err.message);
    });
  }

  // Handle messages from local clients
  _handleClientMessage(ws, player, data) {
    if (data.t === 'input') {
      // Route input to driver
      if (this.driver && player.slot !== 'spectator') {
        this.driver.sendInput(player.slot, data);
      }
      if (this._onInput) {
        this._onInput(player, data);
      }
    }
  }

  // Connect to Quasar relay for internet play
  _connectQuasar() {
    console.log(`[host] Connecting to Quasar: ${this.quasarUrl}`);

    this.quasarWs = new WebSocket(this.quasarUrl);

    this.quasarWs.on('open', () => {
      console.log('[host] Connected to Quasar relay');
      this.quasarWs.send(JSON.stringify({
        t: 'register',
        role: 'host',
        gameType: this.driver?.gameType || 'unknown'
      }));
    });

    this.quasarWs.on('message', (msg) => {
      try {
        const data = JSON.parse(msg);
        this._handleQuasarMessage(data);
      } catch (e) {
        // Ignore parse errors
      }
    });

    this.quasarWs.on('close', () => {
      console.log('[host] Disconnected from Quasar');
      // Reconnect after delay
      setTimeout(() => this._connectQuasar(), 2000);
    });

    this.quasarWs.on('error', (err) => {
      console.error('[host] Quasar error:', err.message);
    });
  }

  // Handle messages from Quasar relay
  _handleQuasarMessage(data) {
    if (data.t === 'input') {
      // Input from remote player via Quasar
      if (this.driver) {
        const slot = data.slot || 'p2'; // Default remote to p2
        this.driver.sendInput(slot, data);
      }
    } else if (data.t === 'game.reset') {
      if (this.driver) {
        this.driver.sendKey('r');
      }
    }
  }

  // Handle frame from driver
  _handleFrame(frame) {
    this.frameSeq++;
    const message = {
      t: 'frame',
      seq: this.frameSeq,
      ts: Date.now(),
      ...frame
    };

    this.lastFrame = message;
    this._broadcast(message);
  }

  // Broadcast to all connected clients
  _broadcast(data) {
    const msg = JSON.stringify(data);

    // Local clients
    for (const ws of this.players.keys()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
    for (const ws of this.spectators) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }

    // Quasar relay
    if (this.quasarWs && this.quasarWs.readyState === WebSocket.OPEN) {
      this.quasarWs.send(msg);
    }
  }

  _getPlayerList() {
    return [...this.players.values()].map(p => ({
      id: p.id,
      slot: p.slot
    }));
  }

  _broadcastPlayerList() {
    this._broadcast({
      t: 'players',
      players: this._getPlayerList(),
      spectators: this.spectators.size
    });
  }
}

module.exports = { Host };
