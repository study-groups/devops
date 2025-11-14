#!/usr/bin/env node

/**
 * midi-mp Router
 *
 * Multiplayer MIDI Protocol Router
 * Routes OSC MIDI messages to multiple players/consumers
 *
 * Core Concept: Defines HOW to route MIDI, not WHAT to do with it.
 */

const osc = require('osc');
const EventEmitter = require('events');

/**
 * Routing Modes:
 * - broadcast: All players get all messages
 * - split: Route based on control numbers
 * - per-player: Each player gets assigned controls
 * - aggregate: Combine multiple controllers
 */
class MidiMpRouter extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      mode: config.mode || 'broadcast',
      oscHost: config.oscHost || '0.0.0.0',
      oscPort: config.oscPort || 1983,           // Input port (listen for midi)
      outputPort: config.outputPort || 2020,     // Output port (broadcast to consumers)
      routes: config.routes || [],
      filter: config.filter || null,
      transform: config.transform || {},
      verbose: config.verbose || false
    };

    // Player registry: playerId -> connection info
    this.players = new Map();

    // Control state cache
    this.state = {
      controls: {},  // "cc/1/40" -> 127
      lastUpdate: null
    };

    // Stats
    this.stats = {
      messagesReceived: 0,
      messagesRouted: 0,
      playersConnected: 0
    };

    this.setupOscListener();
    this.setupOscBroadcaster();
  }

  setupOscListener() {
    // Input port - listens for messages from midi
    this.oscInputPort = new osc.UDPPort({
      localAddress: this.config.oscHost,
      localPort: this.config.oscPort,
      broadcast: true,
      metadata: true,
      reuseAddr: true  // Allow multiple listeners on same port
    });

    this.oscInputPort.on('ready', () => {
      this.log(`midi-mp router listening on ${this.config.oscHost}:${this.config.oscPort}`);
      this.log(`Broadcasting to port ${this.config.outputPort}`);
      this.log(`Mode: ${this.config.mode}`);
      this.emit('ready');
    });

    this.oscInputPort.on('message', (oscMsg) => {
      this.handleOscMessage(oscMsg);
    });

    this.oscInputPort.on('error', (err) => {
      this.log(`OSC Input Error: ${err.message}`, 'error');
      this.emit('error', err);
    });

    this.oscInputPort.open();
  }

  setupOscBroadcaster() {
    // Output port - broadcasts transformed messages to consumers
    this.oscOutputPort = new osc.UDPPort({
      localAddress: '0.0.0.0',
      localPort: 0,  // Ephemeral port for sending
      broadcast: true,
      metadata: true
    });

    this.oscOutputPort.on('ready', () => {
      this.log(`OSC broadcaster ready`);
    });

    this.oscOutputPort.on('error', (err) => {
      this.log(`OSC Output Error: ${err.message}`, 'error');
    });

    this.oscOutputPort.open();
  }

  handleOscMessage(oscMsg) {
    this.stats.messagesReceived++;

    // Parse OSC address
    const parts = oscMsg.address.split('/').filter(Boolean);

    // Handle different message types
    if (parts[0] === 'midi') {
      this.handleMidiMessage(oscMsg, parts);
    } else if (parts[0] === 'midi-mp') {
      this.handleControlMessage(oscMsg, parts);
    }
  }

  handleMidiMessage(oscMsg, parts) {
    // parts: ['midi', 'raw'/'mapped', type, ...]

    const messageType = parts[1]; // 'raw' or 'mapped'

    if (messageType === 'raw') {
      // /midi/raw/cc/1/40 [127]
      // /midi/raw/note/1/42 [127]
      this.handleRawMidi(oscMsg, parts);
    } else if (messageType === 'mapped') {
      // /midi/mapped/a/VOLUME_1 [0.503937]
      this.handleMappedMidi(oscMsg, parts);
    }
  }

  handleRawMidi(oscMsg, parts) {
    // parts: ['midi', 'raw', 'cc'/'note', channel, controller/note]
    const type = parts[2];
    const channel = parseInt(parts[3]);
    const num = parseInt(parts[4]);
    const value = oscMsg.args[0].value;

    // Apply filter if configured
    if (this.config.filter) {
      if (!this.passesFilter(type, channel, num)) {
        return;
      }
    }

    // Update state cache
    const stateKey = `${type}/${channel}/${num}`;
    this.state.controls[stateKey] = value;
    this.state.lastUpdate = Date.now();

    // Build midi-mp message
    const message = {
      type: 'control',
      source: 'midi-bridge',
      midi: {
        type,
        channel,
        [type === 'cc' ? 'controller' : 'note']: num,
        value
      },
      timestamp: Date.now()
    };

    // Apply transform if configured
    const transformed = this.applyTransform(oscMsg.address, message);

    // Route based on mode
    this.routeMessage(transformed);
  }

  handleMappedMidi(oscMsg, parts) {
    // parts: ['midi', 'mapped', variant, semantic]
    const variant = parts[2];
    const semantic = parts[3];
    const normalized = oscMsg.args[0].value;

    const message = {
      type: 'control',
      source: 'midi-bridge',
      mapped: {
        variant,
        semantic,
        normalized
      },
      timestamp: Date.now()
    };

    this.routeMessage(message);
  }

  handleControlMessage(oscMsg, parts) {
    // /midi-mp/player/join
    // /midi-mp/player/leave
    // /midi-mp/route/set

    const subsystem = parts[1];
    const action = parts[2];

    if (subsystem === 'player') {
      if (action === 'join') {
        this.handlePlayerJoin(oscMsg);
      } else if (action === 'leave') {
        this.handlePlayerLeave(oscMsg);
      }
    } else if (subsystem === 'route') {
      if (action === 'set') {
        this.handleRouteSet(oscMsg);
      }
    }
  }

  passesFilter(type, channel, num) {
    const filter = this.config.filter;

    if (filter.channel && channel !== filter.channel) {
      return false;
    }

    if (type === 'cc' && filter.cc) {
      if (!filter.cc.includes(num)) {
        return false;
      }
    }

    if (type === 'note' && filter.note) {
      if (!filter.note.includes(num)) {
        return false;
      }
    }

    return true;
  }

  applyTransform(oscAddress, message) {
    const transforms = this.config.transform;

    if (transforms[oscAddress]) {
      const transform = transforms[oscAddress];

      if (typeof transform === 'string') {
        // Simple string mapping: "/midi/cc/1/40" -> "game.beat"
        message.event = transform;
      } else if (typeof transform === 'object') {
        // Complex transform
        message.event = transform.event;
        if (transform.normalize) {
          const [min, max] = transform.normalize;
          const midiValue = message.midi.value;
          message.normalized = min + (midiValue / 127.0) * (max - min);
        }
      }
    }

    return message;
  }

  routeMessage(message) {
    switch (this.config.mode) {
      case 'broadcast':
        this.broadcast(message);
        break;

      case 'split':
        this.routeSplit(message);
        break;

      case 'per-player':
        this.routePerPlayer(message);
        break;

      case 'aggregate':
        this.routeAggregate(message);
        break;

      default:
        this.log(`Unknown routing mode: ${this.config.mode}`, 'error');
    }
  }

  broadcast(message) {
    // Broadcast to output port (UDP localhost for macOS compatibility)
    this.oscOutputPort.send({
      address: message.address,
      args: message.args
    }, '127.0.0.1', this.config.outputPort);

    this.stats.messagesRouted++;

    // Also send to registered players (legacy)
    this.players.forEach((player, playerId) => {
      this.sendToPlayer(playerId, player, message);
    });

    // Also emit as event for local consumers
    this.emit('message', message);

    if (message.event) {
      this.emit(message.event, message);
    }
  }

  routeSplit(message) {
    // Route based on control number ranges
    // Example: CC 1-8 -> player-left, CC 9-16 -> player-right

    const routes = this.config.routes;

    for (const route of routes) {
      if (this.messageMatchesRoute(message, route)) {
        const player = this.players.get(route.player);
        if (player) {
          this.sendToPlayer(route.player, player, message);
          this.stats.messagesRouted++;
        }
      }
    }
  }

  routePerPlayer(message) {
    // Each player has assigned controls
    const routes = this.config.routes;

    for (const route of routes) {
      if (this.messageMatchesRoute(message, route)) {
        const player = this.players.get(route.player);
        if (player) {
          this.sendToPlayer(route.player, player, message);
          this.stats.messagesRouted++;
        }
      }
    }
  }

  routeAggregate(message) {
    // Combine multiple inputs, weighted average
    // TODO: Implement aggregation logic
    this.broadcast(message);
  }

  messageMatchesRoute(message, route) {
    if (!message.midi) return false;

    const controls = route.controls;
    if (!controls) return true;

    if (message.midi.type === 'cc' && controls.cc) {
      return controls.cc.includes(message.midi.controller);
    }

    if (message.midi.type === 'note' && controls.note) {
      return controls.note.includes(message.midi.note);
    }

    return false;
  }

  sendToPlayer(playerId, player, message) {
    // TODO: Implement actual player connection (WebSocket, UDP, etc.)
    // For now, just emit event
    this.emit('player.message', {playerId, player, message});

    if (this.config.verbose) {
      this.log(`→ ${playerId}: ${JSON.stringify(message)}`);
    }
  }

  // Player Management

  addPlayer(playerId, metadata = {}) {
    this.players.set(playerId, {
      id: playerId,
      metadata,
      joinedAt: Date.now()
    });

    this.stats.playersConnected = this.players.size;
    this.log(`Player joined: ${playerId}`);

    this.emit('player.join', {playerId, metadata});

    // Send current state snapshot to new player
    this.sendStateSnapshot(playerId);
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      this.players.delete(playerId);
      this.stats.playersConnected = this.players.size;
      this.log(`Player left: ${playerId}`);
      this.emit('player.leave', {playerId});
    }
  }

  handlePlayerJoin(oscMsg) {
    // /midi-mp/player/join [playerId, name, color]
    const playerId = oscMsg.args[0]?.value;
    const name = oscMsg.args[1]?.value || playerId;
    const color = oscMsg.args[2]?.value || '#FFFFFF';

    this.addPlayer(playerId, {name, color});
  }

  handlePlayerLeave(oscMsg) {
    const playerId = oscMsg.args[0]?.value;
    this.removePlayer(playerId);
  }

  handleRouteSet(oscMsg) {
    // /midi-mp/route/set [JSON config]
    const configJson = oscMsg.args[0]?.value;
    try {
      const route = JSON.parse(configJson);
      this.config.routes.push(route);
      this.log(`Route added: ${JSON.stringify(route)}`);
    } catch (err) {
      this.log(`Failed to parse route config: ${err.message}`, 'error');
    }
  }

  sendStateSnapshot(playerId) {
    const snapshot = {
      type: 'state.snapshot',
      controls: this.state.controls,
      players: Array.from(this.players.entries()).map(([id, p]) => ({
        id,
        metadata: p.metadata
      })),
      timestamp: Date.now()
    };

    const player = this.players.get(playerId);
    if (player) {
      this.sendToPlayer(playerId, player, snapshot);
    }
  }

  // Status

  getStatus() {
    return {
      mode: this.config.mode,
      players: this.players.size,
      state: this.state,
      stats: this.stats
    };
  }

  // Logging

  log(msg, level = 'info') {
    if (!this.config.verbose && level === 'debug') return;

    const prefix = level === 'error' ? '✗' : level === 'debug' ? '·' : '•';
    console.error(`[midi-mp] ${prefix} ${msg}`);
  }

  // Cleanup

  close() {
    this.oscPort.close();
    this.players.clear();
    this.log('Router closed');
  }
}

module.exports = { MidiMpRouter };

// CLI Usage
if (require.main === module) {
  const configFile = process.argv[2] || './examples/broadcast.json';

  try {
    const config = require(configFile);
    const router = new MidiMpRouter(config);

    router.on('ready', () => {
      console.log('\n╔═══════════════════════════════════════╗');
      console.log('║   midi-mp Router Started              ║');
      console.log('╚═══════════════════════════════════════╝\n');
      console.log(`Mode: ${config.mode}`);
      console.log(`Listening: ${config.oscHost}:${config.oscPort}\n`);
      console.log('Press Ctrl+C to stop\n');
    });

    router.on('message', (msg) => {
      if (msg.event) {
        console.log(`Event: ${msg.event} = ${msg.normalized || msg.midi?.value || '?'}`);
      }
    });

    process.on('SIGINT', () => {
      console.log('\n\nShutting down...');
      router.close();
      process.exit(0);
    });

  } catch (err) {
    console.error(`Failed to load config: ${err.message}`);
    console.error(`Usage: node router.js [config.json]`);
    process.exit(1);
  }
}
