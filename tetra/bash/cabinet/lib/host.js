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

const MAX_PLAYERS = 4;
const MAX_SPECTATORS = 4;

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
      const playerId = this.nextPlayerId++;

      // Capture server-observed address (what STUN would tell them)
      const remoteAddr = req.socket.remoteAddress?.replace('::ffff:', '') || 'unknown';
      const remotePort = req.socket.remotePort || 0;

      // Start as pending until identify message received
      const player = {
        id: playerId,
        slot: 'pending',
        cid: null,
        nick: null,
        visits: 0,
        joinedAt: Date.now(),
        lastInput: Date.now(),
        // Fingerprint data (populated if collectFingerprint enabled)
        fingerprint: this.collectFingerprint ? {
          serverSeen: `${remoteAddr}:${remotePort}`,
          ip: remoteAddr,
          port: remotePort,
          clientStun: null,  // Filled when client sends ident with stun info
          natType: null
        } : null
      };

      // Temporarily track connection
      this.players.set(ws, player);

      if (this.collectFingerprint) {
        console.log(`[host] Player ${playerId} connected from ${remoteAddr}:${remotePort} (awaiting identity)`);
      } else {
        console.log(`[host] Player ${playerId} connected (awaiting identity)`);
      }

      // Send welcome with pending slot (will update after identify)
      ws.send(JSON.stringify({
        t: 'welcome',
        playerId,
        slot: 'pending',
        players: this._getPlayerList()
      }));

      ws.on('message', (msg) => {
        try {
          const data = JSON.parse(msg);

          // Handle identity message
          if (data.t === 'identify') {
            player.cid = data.cid || `anon_${playerId}`;
            player.nick = data.nick || `Player${playerId}`;
            player.visits = data.visits || 1;

            // Process client STUN info if fingerprinting enabled
            if (this.collectFingerprint && player.fingerprint && data.stun) {
              player.fingerprint.clientStun = data.stun;
              // Detect NAT type by comparing server-seen port vs client STUN port
              if (data.stun.ip === player.fingerprint.ip) {
                if (data.stun.port === player.fingerprint.port) {
                  player.fingerprint.natType = 'none';  // No NAT or hairpin
                } else {
                  player.fingerprint.natType = 'symmetric';  // Port changes per destination
                }
              } else {
                player.fingerprint.natType = 'full';  // Different IP (carrier-grade NAT?)
              }
              console.log(`[host] ${player.cid} fingerprint: server=${player.fingerprint.serverSeen} stun=${data.stun.ip}:${data.stun.port} nat=${player.fingerprint.natType}`);
            }

            const requestSlot = data.requestSlot || '';
            const takeover = data.takeover || false;
            const share = requestSlot === 'share';

            // Assign slot with takeover/share support
            const slot = this._assignSlot(share ? '' : requestSlot, takeover, share);

            // Handle takeover eviction
            if (takeover && (requestSlot === 'p1' || requestSlot === 'p2')) {
              this._evictFromSlot(requestSlot, player);
            }

            player.slot = slot;

            // Handle rejected connection
            if (slot === 'rejected') {
              ws.send(JSON.stringify({ t: 'rejected', reason: 'Server full' }));
              ws.close();
              return;
            }

            // Track slot connections (for sharing)
            if (this._isPlayerSlot(slot)) {
              this.slotConnections[slot].add(ws);
            } else {
              this.spectators.add(ws);
            }

            console.log(`[host] ${player.nick} (${player.cid}) assigned to ${slot} (visits: ${player.visits})`);

            // Send updated welcome (no playerId - just slot)
            ws.send(JSON.stringify({
              t: 'welcome',
              slot,
              cid: player.cid,
              nick: player.nick,
              game: this.driver?.gameType || this.driver?.name || null,
              players: this._getPlayerList()
            }));

            this._broadcastPlayerList();

            // Send last frame
            if (this.lastFrame) {
              ws.send(JSON.stringify(this.lastFrame));
            }

            if (this._onPlayerJoin) {
              this._onPlayerJoin(player, ws);
            }
          } else {
            player.lastInput = Date.now();
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
        console.log(`[host] ${player.nick || 'Player ' + playerId} disconnected`);
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
      .filter(p => p.slot !== 'pending')  // Don't show pending connections
      .map(p => ({
        id: p.id,
        slot: p.slot,
        cid: p.cid,
        nick: p.nick,
        visits: p.visits,
        idle: Math.floor((Date.now() - p.lastInput) / 1000)  // Seconds since last input
      }));
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
    this._updateRuntime();
  }

  // Write runtime.json for TSM visibility
  _updateRuntime() {
    const tsmDir = process.env.TSM_PROCESS_DIR;
    if (!tsmDir) return;

    const data = {
      ws: {
        players: this.players.size,
        spectators: this.spectators.size
      },
      slots: {},
      updated: Date.now()
    };

    // Add per-slot connection counts
    for (const [slot, conns] of Object.entries(this.slotConnections)) {
      data.slots[slot] = conns.size;
    }

    try {
      fs.writeFileSync(
        path.join(tsmDir, 'runtime.json'),
        JSON.stringify(data)
      );
    } catch (e) {
      // Ignore write errors (dir may not exist yet)
    }
  }
}

module.exports = { Host };
