#!/usr/bin/env node

/**
 * Pulsar Game Bridge - MIDI-MP to Pulsar C Engine
 *
 * Subscribes to midi-mp router (port 2020) and translates
 * OSC events to Pulsar engine protocol commands.
 *
 * Usage: node pulsar-game-bridge.js <config> <game-binary-path>
 */

const osc = require('osc');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const CONFIG_FILE = process.argv[2] || path.join(__dirname, 'examples/pulsar-game.json');
const GAME_BIN = process.argv[3] || path.join(__dirname, '../game/engine/bin/pulsar');
const OSC_PORT = 2020; // Listen on midi-mp router output port

// Validate game binary
if (!fs.existsSync(GAME_BIN)) {
  console.error(`❌ Pulsar binary not found: ${GAME_BIN}`);
  console.error('Build the engine first: make -C $GAME_SRC/engine');
  process.exit(1);
}

// Load config
let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  console.log(`📋 Loaded config: ${CONFIG_FILE}`);
} catch (err) {
  console.error(`❌ Failed to load config: ${err.message}`);
  process.exit(1);
}

// Game state
const state = {
  engine: null,
  initialized: false,
  cols: 160,
  rows: 96,
  currentSprite: null,
  spriteParams: {
    mx: 80,
    my: 48,
    len0: 18,
    amp: 6,
    freq: 0.5,
    dtheta: 0.6,
    valence: 0
  }
};

// Start Pulsar C engine
function startPulsarEngine() {
  console.log(`🎮 Starting Pulsar engine: ${GAME_BIN}`);

  state.engine = spawn(GAME_BIN, [], {
    stdio: ['pipe', 'pipe', 'inherit']
  });

  state.engine.stdout.on('data', (data) => {
    const response = data.toString().trim();
    handleEngineResponse(response);
  });

  state.engine.on('error', (err) => {
    console.error(`❌ Engine error: ${err.message}`);
    process.exit(1);
  });

  state.engine.on('exit', (code) => {
    console.log(`⚠️  Pulsar engine exited with code ${code}`);
    process.exit(code);
  });

  // Initialize engine
  sendCommand(`INIT ${state.cols} ${state.rows}`);
}

// Send command to Pulsar engine
function sendCommand(cmd) {
  if (!state.engine || !state.engine.stdin.writable) {
    console.error(`⚠️  Engine not ready, skipping: ${cmd}`);
    return;
  }

  if (config.verbose) {
    console.log(`→ ${cmd}`);
  }

  state.engine.stdin.write(cmd + '\n');
}

// Handle engine responses
function handleEngineResponse(response) {
  if (config.verbose) {
    console.log(`← ${response}`);
  }

  if (response.startsWith('OK READY')) {
    console.log('✓ Pulsar engine ready');
  } else if (response.startsWith('OK INIT')) {
    state.initialized = true;
    console.log(`✓ Grid initialized: ${state.cols}×${state.rows}`);
  } else if (response.startsWith('ID')) {
    const id = parseInt(response.split(' ')[1]);
    state.currentSprite = id;
    console.log(`✓ Spawned sprite ID ${id}`);
  } else if (response.startsWith('OK')) {
    // Generic OK response
  } else if (response.startsWith('ERROR')) {
    console.error(`⚠️  Engine error: ${response}`);
  }
}

// Handle OSC messages from midi-mp router
function handleOSCMessage(oscMsg) {
  if (!state.initialized) {
    console.log('⏳ Waiting for engine initialization...');
    return;
  }

  const address = oscMsg.address;
  const value = oscMsg.args[0];

  if (config.verbose) {
    console.log(`📨 OSC: ${address} ${value}`);
  }

  // Parse event type from address
  // Format: /midi-mp/event/{event-name}
  if (!address.startsWith('/midi-mp/event/')) {
    return; // Ignore non-event messages
  }

  const event = address.replace('/midi-mp/event/', '');

  // Map events to Pulsar parameters
  switch (event) {
    case 'pulsar.spawn':
      // Spawn threshold - only spawn if value > 0.5
      if (value > 0.5) {
        spawnPulsar();
      }
      break;

    case 'pulsar.frequency':
      state.spriteParams.freq = value;
      if (state.currentSprite !== null) {
        sendCommand(`SET ${state.currentSprite} freq ${value}`);
      }
      break;

    case 'pulsar.rotation':
      state.spriteParams.dtheta = value;
      if (state.currentSprite !== null) {
        sendCommand(`SET ${state.currentSprite} dtheta ${value}`);
      }
      break;

    case 'pulsar.amplitude':
      state.spriteParams.amp = Math.round(value);
      if (state.currentSprite !== null) {
        sendCommand(`SET ${state.currentSprite} amp ${Math.round(value)}`);
      }
      break;

    case 'pulsar.length':
      state.spriteParams.len0 = Math.round(value);
      if (state.currentSprite !== null) {
        sendCommand(`SET ${state.currentSprite} len0 ${Math.round(value)}`);
      }
      break;

    case 'pulsar.x_position':
      state.spriteParams.mx = Math.round(value);
      if (state.currentSprite !== null) {
        sendCommand(`SET ${state.currentSprite} mx ${Math.round(value)}`);
      }
      break;

    case 'pulsar.y_position':
      state.spriteParams.my = Math.round(value);
      if (state.currentSprite !== null) {
        sendCommand(`SET ${state.currentSprite} my ${Math.round(value)}`);
      }
      break;

    case 'pulsar.valence':
      state.spriteParams.valence = Math.round(value);
      if (state.currentSprite !== null) {
        sendCommand(`SET ${state.currentSprite} valence ${Math.round(value)}`);
      }
      break;

    case 'pulsar.kill':
      if (state.currentSprite !== null) {
        sendCommand(`KILL ${state.currentSprite}`);
        state.currentSprite = null;
      }
      break;

    default:
      if (config.verbose) {
        console.log(`⚠️  Unknown event: ${event}`);
      }
  }
}

// Spawn a pulsar with current parameters
function spawnPulsar() {
  const { mx, my, len0, amp, freq, dtheta, valence } = state.spriteParams;
  const cmd = `SPAWN_PULSAR ${mx} ${my} ${len0} ${amp} ${freq} ${dtheta} ${valence}`;
  sendCommand(cmd);
}

// Setup OSC listener
function setupOSCListener() {
  const udpPort = new osc.UDPPort({
    localAddress: '0.0.0.0',
    localPort: OSC_PORT,
    metadata: true
  });

  udpPort.on('ready', () => {
    console.log(`🎵 Listening for OSC on UDP :${OSC_PORT}`);
    console.log(`📡 Waiting for midi-mp router messages...`);
  });

  udpPort.on('message', handleOSCMessage);

  udpPort.on('error', (err) => {
    console.error(`❌ OSC error: ${err.message}`);
    process.exit(1);
  });

  udpPort.open();
  return udpPort;
}

// Cleanup on exit
function cleanup() {
  console.log('\n🛑 Shutting down...');

  if (state.engine) {
    sendCommand('QUIT');
    state.engine.kill();
  }

  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Main
console.log('═══════════════════════════════════════');
console.log('🎮 Pulsar Game Bridge - MIDI-MP Edition');
console.log('═══════════════════════════════════════');

startPulsarEngine();
setupOSCListener();

// Start game loop after short delay
setTimeout(() => {
  if (state.initialized) {
    console.log('🎬 Starting game loop (30 FPS)');
    sendCommand('RUN 30');
  }
}, 1000);
