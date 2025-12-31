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

    // Player connections: Map<ws, {id, slot, cid, nick, joinedAt, lastInput}>
    this.players = new Map();
    this.spectators = new Set();
    this.nextPlayerId = 1;

    // Slot sharing: Map<slot, Set<ws>> - multiple connections per slot
    this.slotConnections = { p1: new Set(), p2: new Set() };

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

  // Assign player to slot (supports takeover and sharing)
  _assignSlot(requestSlot = '', takeover = false, share = false) {
    // Share mode: join requested slot even if occupied
    if (share && (requestSlot === 'p1' || requestSlot === 'p2')) {
      return requestSlot;
    }

    // Takeover mode: boot existing player from slot
    if (takeover && (requestSlot === 'p1' || requestSlot === 'p2')) {
      return requestSlot;  // Will handle eviction in caller
    }

    // Specific slot request (no takeover)
    if (requestSlot === 'p1' || requestSlot === 'p2') {
      const taken = [...this.players.values()].some(p => p.slot === requestSlot);
      if (!taken) return requestSlot;
      // Slot taken, fall through to auto-assign
    }

    // Auto-assign: find first open slot
    for (const slot of SLOTS) {
      const taken = [...this.players.values()].some(p => p.slot === slot);
      if (!taken) return slot;
    }
    return 'spectator';
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
      // Start as pending until identify message received
      const player = {
        id: playerId,
        slot: 'pending',
        cid: null,
        nick: null,
        visits: 0,
        joinedAt: Date.now(),
        lastInput: Date.now()
      };

      // Temporarily track connection
      this.players.set(ws, player);

      console.log(`[host] Player ${playerId} connected (awaiting identity)`);

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

            // Track slot connections (for sharing)
            if (slot === 'p1' || slot === 'p2') {
              this.slotConnections[slot].add(ws);
            } else {
              this.spectators.add(ws);
            }

            console.log(`[host] ${player.nick} (${player.cid}) assigned to ${slot} (visits: ${player.visits})`);

            // Send updated welcome
            ws.send(JSON.stringify({
              t: 'welcome',
              playerId,
              slot,
              cid: player.cid,
              nick: player.nick,
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
        if (slot === 'p1' || slot === 'p2') {
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
  }
}

module.exports = { Host };
