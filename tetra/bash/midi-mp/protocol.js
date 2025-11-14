/**
 * midi-mp Protocol Definitions
 *
 * Standard message formats for MIDI Multiplayer Protocol
 */

/**
 * Message Types
 */
const MessageType = {
  CONTROL: 'control',          // MIDI control message
  PLAYER_JOIN: 'player.join',  // Player joined
  PLAYER_LEAVE: 'player.leave', // Player left
  STATE_SNAPSHOT: 'state.snapshot', // Full state sync
  ROUTE_SET: 'route.set',      // Set routing rule
  ERROR: 'error'               // Error message
};

/**
 * Routing Modes
 */
const RoutingMode = {
  BROADCAST: 'broadcast',      // All players get all messages
  SPLIT: 'split',              // Route by control ranges
  PER_PLAYER: 'per-player',    // Each player has assigned controls
  AGGREGATE: 'aggregate'       // Combine multiple controllers
};

/**
 * Message Builders
 */

/**
 * Build a control message
 * @param {Object} midiData - Raw MIDI data
 * @param {Object} options - Additional options (mapped, event, etc.)
 */
function buildControlMessage(midiData, options = {}) {
  const message = {
    type: MessageType.CONTROL,
    source: options.source || 'midi-bridge',
    midi: {
      type: midiData.type,      // 'cc', 'note', 'program', 'pitchbend'
      channel: midiData.channel,
      value: midiData.value
    },
    timestamp: Date.now()
  };

  // Add controller/note number
  if (midiData.type === 'cc') {
    message.midi.controller = midiData.controller;
  } else if (midiData.type === 'note') {
    message.midi.note = midiData.note;
    message.midi.velocity = midiData.velocity;
  }

  // Add mapped semantic if available
  if (options.mapped) {
    message.mapped = {
      variant: options.mapped.variant,
      semantic: options.mapped.semantic,
      normalized: options.mapped.normalized
    };
  }

  // Add event name if transformed
  if (options.event) {
    message.event = options.event;
  }

  // Add normalized value if transformed
  if (options.normalized !== undefined) {
    message.normalized = options.normalized;
  }

  return message;
}

/**
 * Build a player join message
 */
function buildPlayerJoinMessage(playerId, metadata = {}) {
  return {
    type: MessageType.PLAYER_JOIN,
    playerId,
    metadata: {
      name: metadata.name || playerId,
      color: metadata.color || '#FFFFFF',
      ...metadata
    },
    timestamp: Date.now()
  };
}

/**
 * Build a player leave message
 */
function buildPlayerLeaveMessage(playerId, reason = null) {
  return {
    type: MessageType.PLAYER_LEAVE,
    playerId,
    reason,
    timestamp: Date.now()
  };
}

/**
 * Build a state snapshot message
 */
function buildStateSnapshotMessage(state, players) {
  return {
    type: MessageType.STATE_SNAPSHOT,
    controls: state.controls || {},
    players: players.map(p => ({
      id: p.id,
      metadata: p.metadata
    })),
    timestamp: Date.now()
  };
}

/**
 * Build a route set message
 */
function buildRouteSetMessage(route) {
  return {
    type: MessageType.ROUTE_SET,
    route: {
      source: route.source,      // OSC address pattern
      targets: route.targets,    // Array of player IDs
      transform: route.transform // Transform name or config
    },
    timestamp: Date.now()
  };
}

/**
 * Build an error message
 */
function buildErrorMessage(code, message, details = {}) {
  return {
    type: MessageType.ERROR,
    error: {
      code,
      message,
      details
    },
    timestamp: Date.now()
  };
}

/**
 * Message Validators
 */

function validateControlMessage(msg) {
  if (msg.type !== MessageType.CONTROL) {
    return {valid: false, error: 'Invalid message type'};
  }

  if (!msg.midi || !msg.midi.type) {
    return {valid: false, error: 'Missing MIDI data'};
  }

  const validTypes = ['cc', 'note', 'program', 'pitchbend'];
  if (!validTypes.includes(msg.midi.type)) {
    return {valid: false, error: 'Invalid MIDI type'};
  }

  if (msg.midi.channel < 1 || msg.midi.channel > 16) {
    return {valid: false, error: 'Invalid MIDI channel'};
  }

  return {valid: true};
}

function validatePlayerJoinMessage(msg) {
  if (msg.type !== MessageType.PLAYER_JOIN) {
    return {valid: false, error: 'Invalid message type'};
  }

  if (!msg.playerId) {
    return {valid: false, error: 'Missing player ID'};
  }

  return {valid: true};
}

/**
 * OSC Address Helpers
 */

/**
 * Build OSC address from MIDI data
 */
function buildOscAddress(midiType, channel, num) {
  if (midiType === 'cc') {
    return `/midi/raw/cc/${channel}/${num}`;
  } else if (midiType === 'note') {
    return `/midi/raw/note/${channel}/${num}`;
  } else if (midiType === 'program') {
    return `/midi/raw/program/${channel}`;
  } else if (midiType === 'pitchbend') {
    return `/midi/raw/pitchbend/${channel}`;
  }
  return null;
}

/**
 * Parse OSC address to MIDI data
 */
function parseOscAddress(address) {
  const parts = address.split('/').filter(Boolean);

  if (parts[0] !== 'midi') return null;

  if (parts[1] === 'raw') {
    // /midi/raw/cc/1/40
    const type = parts[2];
    const channel = parseInt(parts[3]);
    const num = parts[4] ? parseInt(parts[4]) : null;

    return {
      messageType: 'raw',
      type,
      channel,
      [type === 'cc' ? 'controller' : 'note']: num
    };
  } else if (parts[1] === 'mapped') {
    // /midi/mapped/a/VOLUME_1
    const variant = parts[2];
    const semantic = parts[3];

    return {
      messageType: 'mapped',
      variant,
      semantic
    };
  }

  return null;
}

/**
 * Config Helpers
 */

/**
 * Validate router config
 */
function validateRouterConfig(config) {
  const errors = [];

  // Check mode
  const validModes = Object.values(RoutingMode);
  if (config.mode && !validModes.includes(config.mode)) {
    errors.push(`Invalid mode: ${config.mode}. Must be one of: ${validModes.join(', ')}`);
  }

  // Check filter
  if (config.filter) {
    if (config.filter.channel && (config.filter.channel < 1 || config.filter.channel > 16)) {
      errors.push('Invalid filter.channel: must be 1-16');
    }
  }

  // Check routes
  if (config.routes && !Array.isArray(config.routes)) {
    errors.push('routes must be an array');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Example Configs
 */

const ExampleConfigs = {
  // Broadcast to all players
  broadcast: {
    mode: RoutingMode.BROADCAST,
    oscHost: '0.0.0.0',
    oscPort: 57121,
    verbose: true
  },

  // Rhythm game - filter and transform
  rhythmGame: {
    mode: RoutingMode.BROADCAST,
    oscHost: '0.0.0.0',
    oscPort: 57121,
    filter: {
      cc: [40, 41, 42],
      channel: 1
    },
    transform: {
      '/midi/raw/cc/1/40': {
        event: 'game.beat',
        normalize: [0, 1]
      },
      '/midi/raw/cc/1/41': {
        event: 'game.tempo',
        normalize: [60, 200]
      }
    },
    verbose: true
  },

  // VJ split - different controls to different screens
  vjSplit: {
    mode: RoutingMode.SPLIT,
    oscHost: '0.0.0.0',
    oscPort: 57121,
    routes: [
      {
        player: 'screen-left',
        controls: {cc: [1, 2, 3]},
        transform: {
          '/midi/raw/cc/1/1': 'brightness',
          '/midi/raw/cc/1/2': 'hue',
          '/midi/raw/cc/1/3': 'saturation'
        }
      },
      {
        player: 'screen-right',
        controls: {cc: [4, 5, 6]},
        transform: {
          '/midi/raw/cc/1/4': 'brightness',
          '/midi/raw/cc/1/5': 'hue',
          '/midi/raw/cc/1/6': 'saturation'
        }
      }
    ],
    verbose: true
  },

  // Per-player mode - each player controls their own instrument
  collaborative: {
    mode: RoutingMode.PER_PLAYER,
    oscHost: '0.0.0.0',
    oscPort: 57121,
    routes: [
      {
        player: 'bassist',
        controls: {cc: [20, 21, 22, 23, 24, 25, 26, 27, 28, 29]},
        channel: 2
      },
      {
        player: 'drummer',
        controls: {cc: [30, 31, 32, 33, 34, 35, 36, 37, 38, 39]},
        channel: 3
      }
    ],
    verbose: true
  }
};

module.exports = {
  // Types
  MessageType,
  RoutingMode,

  // Builders
  buildControlMessage,
  buildPlayerJoinMessage,
  buildPlayerLeaveMessage,
  buildStateSnapshotMessage,
  buildRouteSetMessage,
  buildErrorMessage,

  // Validators
  validateControlMessage,
  validatePlayerJoinMessage,
  validateRouterConfig,

  // Helpers
  buildOscAddress,
  parseOscAddress,

  // Examples
  ExampleConfigs
};
