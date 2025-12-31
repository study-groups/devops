/**
 * WebSocket Protocol Handler
 *
 * Handles WebSocket connections and message routing:
 * - Browser clients: input, screen updates, match system
 * - Game sources: frame relay, registration
 */

const EventEmitter = require('events');
const WebSocket = require('ws');

class WSProtocol extends EventEmitter {
  constructor(server, options = {}) {
    super();
    this.server = server;
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    const clientIp = req.socket.remoteAddress;
    const isGameSource = req.url.includes('role=game');

    if (isGameSource) {
      this.server.gameSources.set(ws, { gameType: 'unknown', lastFrame: null });
      this.server.log(`Game source connected: ${clientIp}`);
    } else {
      // Create client metadata for latency tracking
      const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      this.server.clients.set(ws, {
        id: clientId,
        connectedAt: Date.now(),
        lastFrameSeq: 0,
        lastPingTs: 0,
        latency: {
          rtt: 0,
          samples: [],
          avg: 0,
          jitter: 0
        },
        stats: {
          framesReceived: 0,
          framesDropped: 0
        }
      });
      this.server.stats.clientsConnected++;
      this.server.log(`Browser client connected: ${clientIp} [${clientId}] (total: ${this.server.clients.size})`);

      // Send current sound state to new client
      ws.send(JSON.stringify({
        t: 'sync',
        snd: this.server.soundState
      }));
    }

    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg);
        this.handleMessage(ws, data, isGameSource);
      } catch (e) {
        this.server.log(`WS parse error: ${e.message}`, 'error');
      }
    });

    ws.on('close', () => {
      if (isGameSource) {
        this.server.gameSources.delete(ws);
        this.server.log(`Game source disconnected: ${clientIp}`);
      } else {
        this.server.clients.delete(ws);
        this.server.log(`Browser client disconnected: ${clientIp} (total: ${this.server.clients.size})`);

        // Handle match system cleanup for this player
        if (this.server.matchRegistry && ws.playerId) {
          this.server.matchRegistry.leave(ws.playerId);
          if (this.server.monogramManager && ws.monogram) {
            this.server.monogramManager.disconnect(ws.monogram);
          }
        }
      }
    });

    ws.on('error', (err) => {
      this.server.log(`WS error: ${err.message}`, 'error');
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  handleMessage(ws, data, isGameSource) {
    const { t: type } = data;

    if (isGameSource) {
      // Game source sending frames
      if (type === 'frame') {
        this.relayFrame(data);
      } else if (type === 'register') {
        const source = this.server.gameSources.get(ws);
        if (source) {
          source.gameType = data.gameType || 'unknown';
          this.server.log(`Game registered: ${source.gameType}`);
        }
      }
    } else {
      // Browser client sending input or screen updates
      if (type === 'input') {
        // Forward input to game sources
        this.server.gameSources.forEach((source, gameWs) => {
          if (gameWs.readyState === WebSocket.OPEN) {
            gameWs.send(JSON.stringify(data));
          }
        });
      } else if (type === 'screen') {
        // Browser reporting its current screen state
        this.server.currentScreen = data.screen || '';
      } else if (type === 'bridge.spawn') {
        // Browser requesting to start a game
        if (this.server.bridgeFactory) {
          this.server.bridgeFactory.handleSpawn(ws, data);
        }
      } else if (type === 'game.reset') {
        // Forward game reset to all game sources
        this.server.log(`Game reset requested: ${data.game || 'all'}`);
        this.server.gameSources.forEach((source, gameWs) => {
          if (gameWs.readyState === WebSocket.OPEN) {
            gameWs.send(JSON.stringify({ t: 'game.reset', game: data.game }));
          }
        });
      } else if (type === 'ping') {
        // Enhanced ping for latency measurement
        const serverTs = Date.now();
        const frameAge = this.server.lastFrameTs ? serverTs - this.server.lastFrameTs : 0;
        const clientMeta = this.server.clients.get(ws);

        // Update client's ping timestamp
        if (clientMeta) {
          clientMeta.lastPingTs = serverTs;
        }

        ws.send(JSON.stringify({
          t: 'pong',
          clientTs: data.ts,       // Echo back client's timestamp
          serverTs: serverTs,
          frameAge: frameAge,      // How old is the last frame
          lastSeq: this.server.lastFrame?.seq || 0
        }));
      } else if (type === 'poll') {
        // Pull mode: client requesting latest frame
        if (this.server.lastFrame) {
          ws.send(JSON.stringify(this.server.lastFrame));
        }
      } else if (type === 'sound.volume') {
        // Set per-client volume (0.0 to 1.0)
        ws.volume = Math.max(0, Math.min(1, data.volume || 1));
        this.server.log(`Client ${ws.monogram || 'unknown'} volume: ${Math.round(ws.volume * 100)}%`);
      } else if (type.startsWith('lobby.') || type.startsWith('match.')) {
        // Match system messages via WebSocket
        this.handleMatchMessage(ws, type, data);
      }
    }
  }

  /**
   * Handle match system WebSocket messages
   */
  handleMatchMessage(ws, type, data) {
    const s = this.server;

    if (!s.matchmaker) {
      ws.send(JSON.stringify({ t: 'error', error: 'Match system not available' }));
      return;
    }

    switch (type) {
      case 'lobby.join': {
        const playerId = data.playerId || `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        ws.playerId = playerId;

        const { monogram } = s.monogramManager.assign(playerId);
        ws.monogram = monogram;

        // Send lobby.joined first
        ws.send(JSON.stringify({
          t: 'lobby.joined',
          playerId,
          monogram,
          gameType: data.gameType
        }));

        // If createImmediate, create match right away with just this player
        if (data.createImmediate) {
          const match = s.matchRegistry.create(data.gameType, { public: true, minPlayers: 1 });
          if (match) {
            const joinResult = match.addPlayer(playerId, { name: data.name, monogram, ws });
            if (!joinResult.error) {
              ws.send(JSON.stringify({
                t: 'match.created',
                matchId: match.idHex,
                gameType: data.gameType,
                players: [{ monogram, slot: joinResult.slot }]
              }));
            }
          }
        } else {
          // Normal queue behavior
          const result = s.matchmaker.enqueue(playerId, data.gameType, {
            name: data.name,
            monogram,
            ws
          });
        }
        break;
      }

      case 'match.join': {
        // Join an existing match by ID
        const playerId = ws.playerId || `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        ws.playerId = playerId;

        if (!ws.monogram) {
          const { monogram } = s.monogramManager.assign(playerId);
          ws.monogram = monogram;
        }

        const matchId = parseInt((data.matchId || '').replace('0x', ''), 16);
        const match = s.matchRegistry.get(matchId);

        if (!match) {
          ws.send(JSON.stringify({ t: 'error', error: 'Match not found' }));
          break;
        }

        if (!match.joinable) {
          ws.send(JSON.stringify({ t: 'error', error: 'Match is not joinable' }));
          break;
        }

        const joinResult = match.addPlayer(playerId, { name: data.name, monogram: ws.monogram, ws });
        if (joinResult.error) {
          ws.send(JSON.stringify({ t: 'error', error: joinResult.error }));
        } else {
          ws.send(JSON.stringify({
            t: 'match.joined',
            matchId: match.idHex,
            gameType: match.gameType,
            state: match.state,
            slot: joinResult.slot,
            playerCount: match.playerCount,
            maxPlayers: match.config.maxPlayers
          }));
        }
        break;
      }

      case 'lobby.leave': {
        if (ws.playerId) {
          s.matchmaker.dequeue(ws.playerId);
          ws.send(JSON.stringify({ t: 'lobby.left' }));
        }
        break;
      }

      case 'lobby.private': {
        const playerId = data.playerId || `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        ws.playerId = playerId;

        const { monogram } = s.monogramManager.assign(playerId);
        ws.monogram = monogram;

        const result = s.matchmaker.createPrivate(data.gameType, playerId, {
          name: data.name,
          monogram,
          ws
        });

        ws.send(JSON.stringify({
          t: 'lobby.private.created',
          playerId,
          monogram,
          matchId: result.match?.idHex,
          inviteCode: result.inviteCode
        }));
        break;
      }

      case 'lobby.join.private': {
        const playerId = data.playerId || `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        ws.playerId = playerId;

        const { monogram } = s.monogramManager.assign(playerId);
        ws.monogram = monogram;

        const result = s.matchmaker.joinPrivate(data.inviteCode, playerId, {
          name: data.name,
          monogram,
          ws
        });

        if (result.error) {
          ws.send(JSON.stringify({ t: 'error', error: result.error }));
        } else {
          ws.send(JSON.stringify({
            t: 'lobby.private.joined',
            playerId,
            monogram,
            matchId: result.match?.idHex
          }));
        }
        break;
      }

      case 'match.start': {
        const matchId = parseInt((data.matchId || '').replace('0x', ''), 16);
        const match = s.matchRegistry.get(matchId);
        if (match) {
          const result = match.start();
          if (result.error) {
            ws.send(JSON.stringify({ t: 'error', error: result.error }));
          } else {
            // Notify all players in match that game has started
            match.broadcastToPlayers({
              t: 'match.started',
              matchId: match.idHex,
              gameType: match.gameType,
              state: match.state
            });
          }
        }
        break;
      }

      case 'match.input': {
        if (ws.playerId) {
          const match = s.matchRegistry.getByPlayer(ws.playerId);
          if (match) {
            match.recordInput(ws.playerId, data.input);
            const player = match.players.find(p => p.id === ws.playerId);
            if (player) {
              player.lastSeen = Date.now();
            }
          }
        }
        break;
      }

      case 'match.leave': {
        if (ws.playerId) {
          s.matchRegistry.leave(ws.playerId);
          ws.send(JSON.stringify({ t: 'match.left' }));
        }
        break;
      }

      case 'match.heartbeat': {
        if (ws.playerId) {
          const match = s.matchRegistry.getByPlayer(ws.playerId);
          if (match) {
            const player = match.players.find(p => p.id === ws.playerId);
            if (player) {
              player.lastSeen = Date.now();
            }
          }
        }
        ws.send(JSON.stringify({ t: 'heartbeat.ack', ts: Date.now() }));
        break;
      }

      case 'match.score': {
        if (ws.playerId) {
          const match = s.matchRegistry.getByPlayer(ws.playerId);
          if (match) {
            const player = match.players.find(p => p.id === ws.playerId);
            if (player) {
              player.score = data.score;
            }
          }
        }
        break;
      }

      default:
        ws.send(JSON.stringify({ t: 'error', error: `Unknown message type: ${type}` }));
    }
  }

  /**
   * Relay frame from game source to browser clients
   */
  relayFrame(frame) {
    const serverTs = Date.now();
    this.server.stats.framesRelayed++;

    if (this.server.stats.framesRelayed <= 3) {
      this.server.log(`Frame #${this.server.stats.framesRelayed} received, clients: ${this.server.clients.size}`);
    }

    // Add server timestamp for latency measurement
    frame.serverTs = serverTs;

    // Store as lastFrame for pull mode
    this.server.lastFrame = frame;
    this.server.lastFrameTs = serverTs;

    // Update sound state for new client sync
    if (frame.snd) {
      if (frame.snd.mode) this.server.soundState.mode = frame.snd.mode;
      if (frame.snd.v) this.server.soundState.v = frame.snd.v;
    }

    // Broadcast to all browser clients
    const frameStr = JSON.stringify(frame);
    this.server.clients.forEach((clientMeta, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        // Track per-client stats
        if (clientMeta) {
          // Detect dropped frames (if seq jumps by more than 1)
          if (frame.seq && clientMeta.lastFrameSeq > 0) {
            const dropped = frame.seq - clientMeta.lastFrameSeq - 1;
            if (dropped > 0) {
              clientMeta.stats.framesDropped += dropped;
            }
          }
          clientMeta.lastFrameSeq = frame.seq || 0;
          clientMeta.stats.framesReceived++;
        }
        ws.send(frameStr);
      }
    });
  }

  /**
   * Broadcast message to specific match players
   */
  broadcastToMatch(matchId, msg) {
    const match = this.server.matchRegistry.get(matchId);
    if (!match) return;

    const msgStr = JSON.stringify(msg);

    for (const player of match.players) {
      if (player.ws && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(msgStr);
      }
    }
  }

  /**
   * Broadcast message to all browser clients
   */
  broadcast(msg) {
    const msgStr = JSON.stringify(msg);
    this.server.clients.forEach((clientMeta, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msgStr);
      }
    });
  }

  /**
   * Get latency stats for all clients
   */
  getLatencyStats() {
    const stats = [];
    this.server.clients.forEach((clientMeta, ws) => {
      if (clientMeta) {
        stats.push({
          id: clientMeta.id,
          connected: Date.now() - clientMeta.connectedAt,
          rtt: clientMeta.latency.rtt,
          avg: clientMeta.latency.avg,
          framesReceived: clientMeta.stats.framesReceived,
          framesDropped: clientMeta.stats.framesDropped
        });
      }
    });
    return stats;
  }

  toJSON() {
    return {
      clients: this.server.clients.size,
      gameSources: this.server.gameSources.size,
      lastFrameSeq: this.server.lastFrame?.seq || 0,
      lastFrameAge: this.server.lastFrameTs ? Date.now() - this.server.lastFrameTs : null
    };
  }
}

/**
 * MasterTick - Synchronized frame polling for multiplayer
 *
 * Instead of relying on push from game_bridge, this polls all game sources
 * on a fixed tick and broadcasts frames to all clients simultaneously.
 */
class MasterTick {
  constructor(server, options = {}) {
    this.server = server;
    this.fps = options.fps || 15;
    this.interval = Math.floor(1000 / this.fps);
    this.timer = null;
    this.tickCount = 0;
    this.enabled = false;

    // Stats
    this.stats = {
      tickCount: 0,
      pollsTotal: 0,
      framesCollected: 0,
      lastTickMs: 0,
      avgTickMs: 0
    };
  }

  /**
   * Start the master tick loop
   */
  start() {
    if (this.timer) return;

    this.enabled = true;
    this.server.log(`MasterTick started at ${this.fps} FPS (${this.interval}ms)`);

    this.timer = setInterval(() => this.tick(), this.interval);
  }

  /**
   * Stop the master tick loop
   */
  stop() {
    if (!this.timer) return;

    clearInterval(this.timer);
    this.timer = null;
    this.enabled = false;
    this.server.log('MasterTick stopped');
  }

  /**
   * Execute one tick: poll all game sources, bundle frames, broadcast
   */
  tick() {
    const tickStart = Date.now();
    this.tickCount++;
    this.stats.tickCount++;

    // Collect frames from all game sources
    const frames = new Map();

    this.server.gameSources.forEach((sourceMeta, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        // Send poll request to game bridge
        ws.send(JSON.stringify({ t: 'poll' }));
        this.stats.pollsTotal++;

        // Use cached lastFrame if available
        if (sourceMeta.lastFrame) {
          frames.set(sourceMeta.gameType, sourceMeta.lastFrame);
          this.stats.framesCollected++;
        }
      }
    });

    // Create bundled tick frame
    const tickFrame = {
      t: 'tick',
      tick: this.tickCount,
      ts: tickStart,
      sources: Object.fromEntries(frames)
    };

    // Also broadcast the main game frame if we have one
    if (this.server.lastFrame) {
      const frame = { ...this.server.lastFrame };
      frame.serverTs = tickStart;
      frame.tick = this.tickCount;

      const frameStr = JSON.stringify(frame);
      this.server.clients.forEach((clientMeta, ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(frameStr);
        }
      });
    }

    // Update timing stats
    const tickEnd = Date.now();
    this.stats.lastTickMs = tickEnd - tickStart;

    // Rolling average
    this.stats.avgTickMs = Math.round(
      (this.stats.avgTickMs * 0.9) + (this.stats.lastTickMs * 0.1)
    );
  }

  /**
   * Set FPS and restart if running
   */
  setFps(fps) {
    this.fps = fps;
    this.interval = Math.floor(1000 / fps);

    if (this.timer) {
      this.stop();
      this.start();
    }
  }

  toJSON() {
    return {
      enabled: this.enabled,
      fps: this.fps,
      interval: this.interval,
      stats: this.stats
    };
  }
}

module.exports = { WSProtocol, MasterTick };
