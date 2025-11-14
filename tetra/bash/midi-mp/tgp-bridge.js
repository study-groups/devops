#!/usr/bin/env node

/**
 * TGP Bridge - Canonical MIDI-MP to Tetra Game Protocol Bridge
 *
 * Subscribes to midi-mp router (port 2020) and translates OSC events
 * to TGP (Tetra Game Protocol) commands for any compatible game.
 *
 * Usage: node tgp-bridge.js <map-file> <tgp-session>
 *
 * Example:
 *   node tgp-bridge.js maps/pulsar.json pulsar-main
 *
 * This connects to:
 *   - OSC input: UDP port 2020 (midi-mp output)
 *   - TGP output: Unix socket /tmp/tgp_<session>_cmd.sock
 */

const osc = require('osc');
const net = require('net');
const fs = require('fs');
const path = require('path');

// Configuration
const MAP_FILE = process.argv[2];
const TGP_SESSION = process.argv[3] || 'default';
const OSC_PORT = 2020; // midi-mp output port

if (!MAP_FILE) {
  console.error('Usage: node tgp-bridge.js <map-file> [tgp-session]');
  console.error('');
  console.error('Example:');
  console.error('  node tgp-bridge.js maps/pulsar.json pulsar-main');
  process.exit(1);
}

// TGP socket path
const TGP_CMD_SOCKET = `/tmp/tgp_${TGP_SESSION}_cmd.sock`;
const TGP_RESP_SOCKET = `/tmp/tgp_${TGP_SESSION}_resp.sock`;

// Load control map
let controlMap;
try {
  const mapPath = path.resolve(MAP_FILE);
  controlMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  console.log(`✓ Loaded control map: ${mapPath}`);
  console.log(`  Game: ${controlMap.game || 'unknown'}`);
  console.log(`  Events: ${Object.keys(controlMap.events || {}).length}`);
} catch (err) {
  console.error(`❌ Failed to load map file: ${err.message}`);
  process.exit(1);
}

// Game state (for stateful mappings)
const state = controlMap.initialState || {};

// TGP connection
let tgpSocket = null;
let tgpConnected = false;

// Connect to TGP command socket
function connectTGP() {
  console.log(`🔌 Connecting to TGP: ${TGP_CMD_SOCKET}`);

  tgpSocket = net.createConnection(TGP_CMD_SOCKET);

  tgpSocket.on('connect', () => {
    tgpConnected = true;
    console.log(`✓ TGP connected: ${TGP_SESSION}`);

    // Send initialization commands if defined
    if (controlMap.initCommands) {
      controlMap.initCommands.forEach(cmd => {
        sendTGPCommand(cmd);
      });
    }
  });

  tgpSocket.on('data', (data) => {
    // Handle TGP responses
    const response = data.toString().trim();
    if (controlMap.verbose) {
      console.log(`← TGP: ${response}`);
    }
  });

  tgpSocket.on('error', (err) => {
    console.error(`⚠️  TGP error: ${err.message}`);
    tgpConnected = false;
  });

  tgpSocket.on('close', () => {
    console.log(`🔌 TGP connection closed`);
    tgpConnected = false;

    // Reconnect after delay
    setTimeout(connectTGP, 2000);
  });
}

// Send command to TGP
function sendTGPCommand(cmd) {
  if (!tgpConnected || !tgpSocket) {
    console.error(`⚠️  TGP not connected, skipping: ${cmd}`);
    return;
  }

  if (controlMap.verbose) {
    console.log(`→ TGP: ${cmd}`);
  }

  tgpSocket.write(cmd + '\n');
}

// Handle OSC messages from midi-mp
function handleOSCMessage(oscMsg) {
  const address = oscMsg.address;
  const value = oscMsg.args[0];

  if (controlMap.verbose) {
    console.log(`📨 OSC: ${address} ${value}`);
  }

  // Parse event type from address
  // Format: /midi-mp/event/{event-name}
  if (!address.startsWith('/midi-mp/event/')) {
    return; // Ignore non-event messages
  }

  const eventName = address.replace('/midi-mp/event/', '');
  const eventConfig = controlMap.events[eventName];

  if (!eventConfig) {
    if (controlMap.verbose) {
      console.log(`⚠️  Unknown event: ${eventName}`);
    }
    return;
  }

  // Process event based on type
  const { type, command, threshold, stateful } = eventConfig;

  switch (type) {
    case 'trigger':
      // Trigger command if value exceeds threshold
      if (value > (threshold || 0.5)) {
        const cmd = interpolateCommand(command, { value, state });
        sendTGPCommand(cmd);
      }
      break;

    case 'continuous':
      // Send command with interpolated value
      const cmd = interpolateCommand(command, { value, state });
      sendTGPCommand(cmd);
      break;

    case 'stateful':
      // Update state and optionally send command
      if (stateful && stateful.stateKey) {
        state[stateful.stateKey] = value;
      }
      if (command) {
        const cmd = interpolateCommand(command, { value, state });
        sendTGPCommand(cmd);
      }
      break;

    case 'script':
      // Execute JavaScript function
      if (eventConfig.handler) {
        try {
          const handler = eval(`(${eventConfig.handler})`);
          handler({ value, state, sendCommand: sendTGPCommand });
        } catch (err) {
          console.error(`⚠️  Script error: ${err.message}`);
        }
      }
      break;

    default:
      console.error(`⚠️  Unknown event type: ${type}`);
  }
}

// Interpolate command template with values
function interpolateCommand(template, context) {
  let result = template;

  // Replace {{value}} with actual value
  result = result.replace(/\{\{value\}\}/g, context.value);

  // Replace {{value:round}} with rounded value
  result = result.replace(/\{\{value:round\}\}/g, Math.round(context.value));

  // Replace {{state.key}} with state values
  result = result.replace(/\{\{state\.(\w+)\}\}/g, (match, key) => {
    return context.state[key] !== undefined ? context.state[key] : match;
  });

  return result;
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
    console.log(`📡 Waiting for midi-mp events...`);
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

  if (tgpSocket) {
    tgpSocket.end();
  }

  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Main
console.log('═══════════════════════════════════════');
console.log('🎮 TGP Bridge - MIDI-MP Edition');
console.log('═══════════════════════════════════════');
console.log(`Map: ${MAP_FILE}`);
console.log(`Session: ${TGP_SESSION}`);
console.log('');

connectTGP();
setupOSCListener();
