#!/usr/bin/env node

/**
 * Pulsar Game - OSC to TGP Bridge
 *
 * Joins UDP multicast to receive raw MIDI OSC from midi.js,
 * maps to Pulsar-specific TGP commands, sends to pulsar-engine.
 *
 * Usage: node pulsar-game.js [control-map.json] [tgp-session]
 */

const osc = require('osc');
const dgram = require('dgram');
const net = require('net');
const fs = require('fs');
const path = require('path');

// Configuration
const CONTROL_MAP_FILE = process.argv[2] || path.join(__dirname, 'control-map.json');
const TGP_SESSION = process.argv[3] || 'pulsar';
const TGP_PID = process.argv[4]; // Optional: specific PID

// Find TGP socket (with or without PID)
function findTGPSocket() {
  const glob = require('fs').readdirSync('/tmp');
  const pattern = TGP_PID
    ? `tgp_${TGP_SESSION}_${TGP_PID}_cmd.sock`
    : new RegExp(`^tgp_${TGP_SESSION}_(\\d+)_cmd\\.sock$`);

  if (TGP_PID) {
    const sockPath = `/tmp/tgp_${TGP_SESSION}_${TGP_PID}_cmd.sock`;
    if (fs.existsSync(sockPath)) {
      return sockPath;
    }
    console.error(`❌ Socket not found: ${sockPath}`);
    return null;
  }

  // Find newest matching socket
  const matches = glob
    .filter(f => pattern.test(f))
    .map(f => ({
      path: `/tmp/${f}`,
      pid: parseInt(f.match(pattern)[1]),
      mtime: fs.statSync(`/tmp/${f}`).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (matches.length === 0) {
    console.error(`❌ No TGP sockets found for session: ${TGP_SESSION}`);
    console.error(`   Expected pattern: /tmp/tgp_${TGP_SESSION}_<PID>_cmd.sock`);
    return null;
  }

  const newest = matches[0];
  console.log(`✓ Found TGP socket: ${newest.path} (PID ${newest.pid})`);
  return newest.path;
}

// Load control map
let controlMap;
try {
  controlMap = JSON.parse(fs.readFileSync(CONTROL_MAP_FILE, 'utf8'));
  console.log(`✓ Loaded control map: ${CONTROL_MAP_FILE}`);
  console.log(`  Game: ${controlMap.game}`);
  console.log(`  Mappings: ${Object.keys(controlMap.mappings).length}`);
} catch (err) {
  console.error(`❌ Failed to load control map: ${err.message}`);
  process.exit(1);
}

// OSC multicast settings
const MULTICAST_ADDR = controlMap.oscSource.multicast;
const MULTICAST_PORT = controlMap.oscSource.port;

// TGP socket path (determined at runtime)
let TGP_CMD_SOCKET = null;

// Game state
const state = { ...controlMap.initialState };

// TGP connection
let tgpSocket = null;
let tgpConnected = false;

// Connect to TGP engine
function connectTGP() {
  // Find socket if not already determined
  if (!TGP_CMD_SOCKET) {
    TGP_CMD_SOCKET = findTGPSocket();
    if (!TGP_CMD_SOCKET) {
      console.error('Retrying in 2 seconds...');
      setTimeout(connectTGP, 2000);
      return;
    }
  }

  console.log(`🔌 Connecting to TGP: ${TGP_CMD_SOCKET}`);

  tgpSocket = net.createConnection(TGP_CMD_SOCKET);

  tgpSocket.on('connect', () => {
    tgpConnected = true;
    console.log(`✓ TGP connected: ${TGP_SESSION}`);

    // Send initialization commands
    if (controlMap.initCommands) {
      controlMap.initCommands.forEach(cmd => {
        sendTGPCommand(cmd);
      });
    }
  });

  tgpSocket.on('data', (data) => {
    const response = data.toString().trim();

    // Parse responses for sprite IDs
    if (response.startsWith('ID ')) {
      const id = parseInt(response.split(' ')[1]);
      state.currentSprite = id;
      console.log(`✓ Spawned sprite ID ${id}`);
    } else {
      console.log(`← TGP: ${response}`);
    }
  });

  tgpSocket.on('error', (err) => {
    console.error(`⚠️  TGP error: ${err.message}`);
    tgpConnected = false;
  });

  tgpSocket.on('close', () => {
    console.log(`🔌 TGP connection closed, reconnecting...`);
    tgpConnected = false;
    setTimeout(connectTGP, 2000);
  });
}

// Send command to TGP
function sendTGPCommand(cmd) {
  if (!tgpConnected || !tgpSocket) {
    console.error(`⚠️  TGP not connected, skipping: ${cmd}`);
    return;
  }

  console.log(`→ TGP: ${cmd}`);
  tgpSocket.write(cmd + '\n');
}

// Normalize value from one range to another
function normalize(value, fromRange, toRange) {
  const [fromMin, fromMax] = fromRange;
  const [toMin, toMax] = toRange;
  const normalized = (value - fromMin) / (fromMax - fromMin);
  return toMin + normalized * (toMax - toMin);
}

// Interpolate command template
function interpolateCommand(template, context) {
  let result = template;

  // {{value}} - raw value
  result = result.replace(/\{\{value\}\}/g, context.value);

  // {{value:round}} - rounded value
  result = result.replace(/\{\{value:round\}\}/g, Math.round(context.value));

  // {{state.key}} - state values
  result = result.replace(/\{\{state\.(\w+)\}\}/g, (match, key) => {
    return context.state[key] !== undefined ? context.state[key] : match;
  });

  return result;
}

// Handle OSC message
function handleOSCMessage(oscMsg) {
  const address = oscMsg.address;
  const rawValue = oscMsg.args[0];

  // Parse /midi/raw/cc/{channel}/{controller}
  if (!address.startsWith('/midi/raw/cc/')) {
    return; // Ignore non-CC messages for now
  }

  const parts = address.split('/');
  const channel = parts[4];
  const controller = parts[5];
  const mapKey = `cc.${channel}.${controller}`;

  const mapping = controlMap.mappings[mapKey];
  if (!mapping) {
    return; // Not mapped
  }

  console.log(`📨 OSC: ${address} ${rawValue} (${mapping.description})`);

  // Normalize value if specified
  let value = rawValue;
  if (mapping.normalize) {
    value = normalize(rawValue, mapping.normalize.from, mapping.normalize.to);
  }

  // Update state if specified
  if (mapping.state) {
    state[mapping.state] = value;
  }

  // Process based on type
  switch (mapping.type) {
    case 'trigger':
      // Only send command if threshold exceeded
      if (rawValue > mapping.threshold) {
        const cmd = interpolateCommand(mapping.command, { value, state });
        sendTGPCommand(cmd);
      }
      break;

    case 'continuous':
      // Send command with value (only if we have a current sprite for SET commands)
      if (mapping.command.includes('SET') && !state.currentSprite) {
        // Skip SET commands if no sprite spawned yet
        return;
      }
      const cmd = interpolateCommand(mapping.command, { value, state });
      sendTGPCommand(cmd);
      break;

    default:
      console.error(`⚠️  Unknown mapping type: ${mapping.type}`);
  }
}

// Setup OSC multicast listener
function setupOSCListener() {
  // Create UDP socket for multicast
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  // Create OSC port wrapper
  const oscPort = new osc.UDPPort({
    localAddress: '0.0.0.0',
    localPort: MULTICAST_PORT,
    socket: socket,
    metadata: true
  });

  oscPort.on('ready', () => {
    // Join multicast group
    socket.addMembership(MULTICAST_ADDR);
    console.log(`🎵 Joined multicast ${MULTICAST_ADDR}:${MULTICAST_PORT}`);
    console.log(`📡 Waiting for MIDI OSC messages...`);
  });

  oscPort.on('message', handleOSCMessage);

  oscPort.on('error', (err) => {
    console.error(`❌ OSC error: ${err.message}`);
    process.exit(1);
  });

  oscPort.open();
  return oscPort;
}

// Cleanup
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
console.log('🎮 Pulsar Game - OSC → TGP Bridge');
console.log('═══════════════════════════════════════');
console.log(`Session: ${TGP_SESSION}`);
console.log('');

connectTGP();
setupOSCListener();
