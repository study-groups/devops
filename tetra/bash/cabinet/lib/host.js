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
const fs = require('fs');
const path = require('path');

// TSM runtime visibility (one-liner pattern)
const tsm = (d) => process.env.TSM_PROCESS_DIR &&
    fs.writeFileSync(path.join(process.env.TSM_PROCESS_DIR, 'runtime.json'), JSON.stringify(d));

const MAX_PLAYERS = 4;
const MAX_SPECTATORS = 4;

// =============================================================================
// CONNECTION - Transport-layer identity (socket, fingerprint)
// =============================================================================

class Connection {
  static nextId = 1;

  constructor(ws, req, options = {}) {
    this.id = Connection.nextId++;
    this.ws = ws;
    this.createdAt = Date.now();

    // Server-observed address
    const remoteAddr = req?.socket?.remoteAddress?.replace('::ffff:', '') || 'unknown';
    const remotePort = req?.socket?.remotePort || 0;

    this.fingerprint = options.collectFingerprint ? {
      serverSeen: `${remoteAddr}:${remotePort}`,
      ip: remoteAddr,
      port: remotePort,
      clientStun: null,
      natType: null
    } : null;
  }

  setStunInfo(stun) {
    if (!this.fingerprint || !stun) return;
    this.fingerprint.clientStun = stun;
    if (stun.ip === this.fingerprint.ip) {
      this.fingerprint.natType = stun.port === this.fingerprint.port ? 'none' : 'symmetric';
    } else {
      this.fingerprint.natType = 'full';
    }
  }

  get isOpen() { return this.ws.readyState === WebSocket.OPEN; }

  send(data) {
    if (this.isOpen) {
      this.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }
}

// =============================================================================
// PLAYER - Game-layer identity (slot, name, inputs)
// =============================================================================

class Player {
  constructor(connection, options = {}) {
    this.connection = connection;
    this.id = connection.id;
    this.slot = options.slot || 'pending';
    this.cid = options.cid || null;
    this.nick = options.nick || null;
    this.visits = options.visits || 1;
    this.joinedAt = Date.now();
    this.lastInput = Date.now();
  }

  get fingerprint() { return this.connection.fingerprint; }
  get ws() { return this.connection.ws; }

  send(data) { this.connection.send(data); }

  updateInput() { this.lastInput = Date.now(); }

  idleSeconds() { return Math.floor((Date.now() - this.lastInput) / 1000); }

  toPublic() {
    return {
      id: this.id,
      slot: this.slot,
      cid: this.cid,
      nick: this.nick,
      visits: this.visits,
      idle: this.idleSeconds()
    };
  }
}

class Host {
  constructor(options = {}) {
    this.port = options.port || 8080;
    this.quasarUrl = options.quasar || null;
    this.driver = options.driver || null;
    this.httpServer = options.server || null;  // Optional HTTP server to attach to
    this.maxPlayers = options.maxPlayers || MAX_PLAYERS;
    this.maxSpectators = options.maxSpectators || MAX_SPECTATORS;
    this.autoRespawn = options.autoRespawn !== false;  // Default: true
    this.respawnDelay = options.respawnDelay || 1000;  // ms
    this.collectFingerprint = options.collectFingerprint || false;  // STUN fingerprinting flag

    // Build slot list based on maxPlayers
    this.slots = [];
    this.slotConnections = {};
    for (let i = 1; i <= this.maxPlayers; i++) {
      const slot = `p${i}`;
      this.slots.push(slot);
      this.slotConnections[slot] = new Set();
    }

    // Player connections: Map<ws, {id, slot, cid, nick, joinedAt, lastInput}>
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
      this._startDriver();
    }
    console.log(`[host] Started on port ${this.port}`);
    return this;
  }

  stop() {
    this.autoRespawn = false;  // Prevent respawn on intentional stop
    if (this.driver) this.driver.stop();
    if (this.wss) this.wss.close();
    if (this.quasarWs) this.quasarWs.close();
    console.log('[host] Stopped');
  }

  // Start/restart the driver with auto-respawn support
  _startDriver() {
    this.driver.onFrame((frame) => this._handleFrame(frame));
    this.driver.onExit((code) => {
      console.log(`[host] Game exited with code ${code}`);
      if (this.autoRespawn) {
        console.log(`[host] Respawning game in ${this.respawnDelay}ms...`);
        this._broadcast({ t: 'game.respawn', delay: this.respawnDelay });
        setTimeout(() => {
          if (this.autoRespawn) {
            console.log('[host] Respawning game');
            this.driver.start();
          }
        }, this.respawnDelay);
      }
    });
    this.driver.start();
  }

  // Event handlers
  onPlayerJoin(callback) { this._onPlayerJoin = callback; }
  onPlayerLeave(callback) { this._onPlayerLeave = callback; }
  onInput(callback) { this._onInput = callback; }

  // Check if slot is valid player slot
  _isPlayerSlot(slot) {
    return this.slots.includes(slot);
  }

  // Assign player to slot (supports takeover and sharing)
  _assignSlot(requestSlot = '', takeover = false, share = false) {
    // Share mode: join requested slot even if occupied
    if (share && this._isPlayerSlot(requestSlot)) {
      return requestSlot;
    }

    // Takeover mode: boot existing player from slot
    if (takeover && this._isPlayerSlot(requestSlot)) {
      return requestSlot;  // Will handle eviction in caller
    }

    // Specific slot request (no takeover)
    if (this._isPlayerSlot(requestSlot)) {
      const taken = [...this.players.values()].some(p => p.slot === requestSlot);
      if (!taken) return requestSlot;
      // Slot taken, fall through to auto-assign
    }

    // Auto-assign: find first open slot
    for (const slot of this.slots) {
      const taken = [...this.players.values()].some(p => p.slot === slot);
      if (!taken) return slot;
    }

    // All player slots full, check spectator limit
    if (this.spectators.size < this.maxSpectators) {
      return 'spectator';
    }

    // Server full
    return 'rejected';
  }

  // Get existing player in a slot (for takeover)
  _getSlotOccupant(slot) {
    for (const [ws, player] of this.players.entries()) {
      if (player.slot === slot) return { ws, player };
    }
    return null;
  }

  // Evict player from slot (for takeover)
  _evictFromSlot(slot, newPlayer) {
    const occupant = this._getSlotOccupant(slot);
    if (occupant) {
      occupant.player.slot = 'spectator';
      this.spectators.add(occupant.ws);
      this.slotConnections[slot]?.delete(occupant.ws);
      // Notify evicted player
      occupant.ws.send(JSON.stringify({
        t: 'takeover',
        oldCid: occupant.player.cid,
        newCid: newPlayer.cid,
        newNick: newPlayer.nick,
        slot
      }));
      console.log(`[host] ${occupant.player.nick || occupant.player.cid} evicted from ${slot} by ${newPlayer.nick || newPlayer.cid}`);
    }
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
      // Create transport-layer connection
      const connection = new Connection(ws, req, {
        collectFingerprint: this.collectFingerprint
      });

      // Create game-layer player (pending until identify)
      const player = new Player(connection);

      // Track by websocket for lookups
      this.players.set(ws, player);

      const fp = connection.fingerprint;
      if (fp) {
        console.log(`[host] Connection ${connection.id} from ${fp.serverSeen} (awaiting identity)`);
      } else {
        console.log(`[host] Connection ${connection.id} (awaiting identity)`);
      }

      // Send welcome with pending slot
      player.send({
        t: 'welcome',
        playerId: player.id,
        slot: 'pending',
        players: this._getPlayerList()
      });

      ws.on('message', (msg) => {
        try {
          const data = JSON.parse(msg);

          if (data.t === 'identify') {
            player.cid = data.cid || `anon_${player.id}`;
            player.nick = data.nick || `Player${player.id}`;
            player.visits = data.visits || 1;

            // Process STUN info via Connection
            if (data.stun) {
              connection.setStunInfo(data.stun);
              if (connection.fingerprint) {
                console.log(`[host] ${player.cid} fingerprint: server=${fp.serverSeen} stun=${data.stun.ip}:${data.stun.port} nat=${fp.natType}`);
              }
            }

            const requestSlot = data.requestSlot || '';
            const takeover = data.takeover || false;
            const share = requestSlot === 'share';

            const slot = this._assignSlot(share ? '' : requestSlot, takeover, share);

            if (takeover && (requestSlot === 'p1' || requestSlot === 'p2')) {
              this._evictFromSlot(requestSlot, player);
            }

            player.slot = slot;

            if (slot === 'rejected') {
              player.send({ t: 'rejected', reason: 'Server full' });
              ws.close();
              return;
            }

            if (this._isPlayerSlot(slot)) {
              this.slotConnections[slot].add(ws);
            } else {
              this.spectators.add(ws);
            }

            console.log(`[host] ${player.nick} (${player.cid}) assigned to ${slot} (visits: ${player.visits})`);

            player.send({
              t: 'welcome',
              slot,
              cid: player.cid,
              nick: player.nick,
              game: this.driver?.gameType || this.driver?.name || null,
              players: this._getPlayerList()
            });

            this._broadcastPlayerList();

            if (this.lastFrame) {
              player.send(this.lastFrame);
            }

            if (this._onPlayerJoin) {
              this._onPlayerJoin(player, ws);
            }
          } else {
            player.updateInput();
            this._handleClientMessage(ws, player, data);
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      ws.on('close', () => {
        const slot = player.slot;
        this.players.delete(ws);
        this.spectators.delete(ws);
        if (this._isPlayerSlot(slot)) {
          this.slotConnections[slot]?.delete(ws);
        }
        console.log(`[host] ${player.nick || 'Connection ' + player.id} disconnected`);
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
    } else if (data.t === 'query') {
      // Dev API: query host state
      if (data.what === 'players') {
        ws.send(JSON.stringify({
          t: 'players',
          players: this._getPlayerList(),
          spectators: this.spectators.size,
          slots: {
            p1: this.slotConnections.p1.size,
            p2: this.slotConnections.p2.size
          }
        }));
      } else if (data.what === 'state') {
        ws.send(JSON.stringify({
          t: 'state',
          ...this.getPlayersData(),
          frameSeq: this.frameSeq,
          hasDriver: !!this.driver
        }));
      }
    } else if (data.t === 'game.reset') {
      // Reset game (any player can trigger)
      if (this.driver && typeof this.driver.reset === 'function') {
        this.driver.reset();
        console.log(`[host] Game reset by ${player.nick || player.cid}`);
      } else if (this.driver) {
        // Fallback: send 'r' key as input
        this.driver.sendInput(player.slot, { key: 'r' });
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
    return [...this.players.values()]
      .filter(p => p.slot !== 'pending')
      .map(p => p.toPublic());
  }

  // Expose player data for dev API
  getPlayersData() {
    return {
      players: this._getPlayerList(),
      spectators: this.spectators.size,
      slots: {
        p1: this.slotConnections.p1.size,
        p2: this.slotConnections.p2.size
      }
    };
  }

  _broadcastPlayerList() {
    this._broadcast({
      t: 'players',
      players: this._getPlayerList(),
      spectators: this.spectators.size
    });
    // TSM runtime update
    const slots = {};
    for (const [slot, conns] of Object.entries(this.slotConnections)) {
      slots[slot] = conns.size;
    }
    tsm({ ws: { players: this.players.size, spectators: this.spectators.size }, slots, updated: Date.now() });
  }
}

module.exports = { Host, Connection, Player };
