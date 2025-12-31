/**
 * Bridge Factory - Game bridge spawning and management
 *
 * Manages external game bridge processes (TRAX, FORMANT) and
 * built-in PULSAR engine games (MAGNETAR).
 */

const EventEmitter = require('events');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const TETRA_SRC = process.env.TETRA_SRC || path.join(process.env.HOME, 'src/devops/tetra');
const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');
const GAMES_DIR = path.join(TETRA_DIR, 'orgs/tetra/games');
const GAME_BRIDGE_BIN = path.join(TETRA_SRC, 'bash/games/game_bridge');

// Game bridge registry - uses game_bridge binary with bridge.json configs
const GAME_BRIDGES = {
  magnetar: {
    name: 'MAGNETAR',
    type: 'pulsar'  // Uses PULSAR engine directly
  },
  trax: {
    name: 'TRAX',
    type: 'game_bridge'  // Uses compiled game_bridge binary
  },
  quadrapole: {
    name: 'QUADRAPOLE',
    type: 'game_bridge'
  },
  formant: {
    name: 'FORMANT',
    type: 'game_bridge'
  }
};

class BridgeFactory extends EventEmitter {
  constructor(server, options = {}) {
    super();
    this.server = server;
    this.bridges = new Map();
    this.config = {
      bridges: { ...GAME_BRIDGES, ...options.bridges }
    };
  }

  /**
   * Handle bridge spawn request from WebSocket client
   */
  handleSpawn(ws, data) {
    const { game, channel } = data;
    const slot = channel || 0;

    this.server.log(`Bridge spawn request: game=${game}, slot=${slot}`);

    // For PULSAR engine-based games, initialize the slot directly
    if (game === 'magnetar') {
      return this.spawnMagnetar(ws, slot);
    }

    // For other games, check bridge registry
    const bridgeConfig = this.config.bridges[game];
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

    if (bridgeConfig.type === 'game_bridge') {
      // Use compiled game_bridge binary with bridge.json config
      this.spawnGameBridge(ws, game, slot);
      return;
    }

    // Spawn external bridge process (legacy)
    this.spawnExternal(ws, game, slot, bridgeConfig);
  }

  /**
   * Spawn game using compiled game_bridge binary
   * Reads config from $TETRA_DIR/orgs/tetra/games/<game>/bridge.json
   */
  spawnGameBridge(ws, game, slot) {
    const gameDir = path.join(GAMES_DIR, game);
    const bridgeConfig = path.join(gameDir, 'bridge.json');

    if (!fs.existsSync(GAME_BRIDGE_BIN)) {
      this.server.log(`game_bridge binary not found: ${GAME_BRIDGE_BIN}`, 'error');
      ws.send(JSON.stringify({
        t: 'bridge.error',
        game,
        error: `game_bridge binary not found`
      }));
      return;
    }

    if (!fs.existsSync(bridgeConfig)) {
      this.server.log(`bridge.json not found: ${bridgeConfig}`, 'error');
      ws.send(JSON.stringify({
        t: 'bridge.error',
        game,
        error: `Game config not found: ${game}`
      }));
      return;
    }

    this.server.log(`Spawning game_bridge for ${game}`);

    const bridgeProcess = spawn(GAME_BRIDGE_BIN, [game], {
      env: {
        ...process.env,
        TETRA_DIR,
        TETRA_SRC
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    bridgeProcess.stdout.on('data', (data) => {
      this.server.log(`[${game}] ${data.toString().trim()}`);
    });

    bridgeProcess.stderr.on('data', (data) => {
      this.server.log(`[${game}] ${data.toString().trim()}`);
    });

    bridgeProcess.on('close', (code) => {
      this.server.log(`[${game}] exited with code ${code}`);
      this.bridges.delete(`${game}-${slot}`);
      this.emit('bridgeClosed', { game, slot, code });
    });

    this.bridges.set(`${game}-${slot}`, bridgeProcess);
    this.server.stats.bridgesSpawned++;

    ws.send(JSON.stringify({
      t: 'bridge.ready',
      game,
      slot,
      status: 'spawned'
    }));

    this.emit('bridgeSpawned', { game, slot, process: bridgeProcess });
  }

  /**
   * Spawn MAGNETAR game using PULSAR engine
   */
  spawnMagnetar(ws, slot) {
    const game = 'magnetar';

    // Requires slotManager to be available
    if (!this.server.slotManager) {
      ws.send(JSON.stringify({
        t: 'bridge.error',
        game,
        slot,
        error: 'Slot manager not available'
      }));
      return;
    }

    if (this.server.slotManager.initSlot(slot, 60, 24, 15)) {
      // Spawn demo sprites for MAGNETAR
      this.server.slotManager.spawnSprite(slot, 'pulsar', 30, 12, { len0: 4, dtheta: 0.1, valence: 1 });
      this.server.slotManager.spawnSprite(slot, 'pulsar', 50, 12, { len0: 4, dtheta: -0.1, valence: 2 });

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
  }

  /**
   * Spawn external bridge process (TRAX, FORMANT, etc.)
   */
  spawnExternal(ws, game, slot, bridgeConfig) {
    if (!bridgeConfig.bridge || !fs.existsSync(bridgeConfig.bridge)) {
      ws.send(JSON.stringify({
        t: 'bridge.error',
        game,
        error: `Bridge not found: ${bridgeConfig.bridge}`
      }));
      return;
    }

    this.server.log(`Spawning bridge: ${bridgeConfig.bridge}`);

    const bridgeProcess = spawn('node', [bridgeConfig.bridge], {
      env: {
        ...process.env,
        TRAX_CHANNEL: String(slot)
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    bridgeProcess.stdout.on('data', (data) => {
      this.server.log(`[${game}-bridge] ${data.toString().trim()}`);
    });

    bridgeProcess.stderr.on('data', (data) => {
      this.server.log(`[${game}-bridge] ${data.toString().trim()}`);
    });

    bridgeProcess.on('close', (code) => {
      this.server.log(`[${game}-bridge] exited with code ${code}`);
      this.bridges.delete(`${game}-${slot}`);
      this.emit('bridgeClosed', { game, slot, code });
    });

    // Store reference for cleanup
    this.bridges.set(`${game}-${slot}`, bridgeProcess);
    this.server.stats.bridgesSpawned++;

    ws.send(JSON.stringify({
      t: 'bridge.ready',
      game,
      slot,
      status: 'spawned'
    }));

    this.emit('bridgeSpawned', { game, slot, process: bridgeProcess });
  }

  /**
   * Kill a specific bridge
   */
  kill(game, slot) {
    const key = `${game}-${slot}`;
    const proc = this.bridges.get(key);
    if (proc) {
      proc.kill();
      this.bridges.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Kill all bridges
   */
  killAll() {
    for (const [key, proc] of this.bridges) {
      proc.kill();
    }
    this.bridges.clear();
  }

  /**
   * Stop and cleanup
   */
  stop() {
    this.killAll();
  }

  toJSON() {
    const active = [];
    for (const [key] of this.bridges) {
      const [game, slot] = key.split('-');
      active.push({ game, slot: parseInt(slot) });
    }
    return {
      available: Object.keys(this.config.bridges),
      active
    };
  }
}

module.exports = { BridgeFactory, GAME_BRIDGES };
