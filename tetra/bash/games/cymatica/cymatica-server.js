#!/usr/bin/env node

/**
 * Cymatica Web Server
 *
 * Express + WebSocket server for browser-based cymatics visualization
 * Bridges OSC/UDP (MIDI-MP) ↔ WebSocket (browser)
 * Supports bidirectional control
 *
 * Architecture:
 *   Local: MIDI → midi.js :1983 → midi-mp :2020
 *                                      ↓
 *                              (this server :3400)
 *                                      ↓
 *                           Browser (WebSocket client)
 *
 * Cloud Setup:
 *   Local midi-mp :2020 → SSH tunnel → Cloud localhost:2020
 *                                             ↓
 *                                   (this server :3400)
 *                                             ↓
 *                                    nginx :443 (HTTPS)
 *                                             ↓
 *                                    Browser (WebSocket)
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const osc = require('osc');
const path = require('path');

// Configuration from environment or defaults
const config = {
  // Web server config
  httpPort: parseInt(process.env.HTTP_PORT || process.argv[2] || 3400),

  // OSC config (receives from midi-mp)
  oscLocalAddress: process.env.OSC_HOST || "0.0.0.0",
  oscLocalPort: parseInt(process.env.OSC_PORT || 2020),

  // Static files
  publicDir: path.join(__dirname, 'public', 'cymatica'),

  metadata: true
};

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  Cymatica Web Server                                      ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');
console.log(`HTTP Server:  http://0.0.0.0:${config.httpPort}`);
console.log(`WebSocket:    ws://0.0.0.0:${config.httpPort}/ws`);
console.log(`OSC Listen:   UDP ${config.oscLocalAddress}:${config.oscLocalPort}`);
console.log(`Static Files: ${config.publicDir}\n`);

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.static(config.publicDir));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'cymatica',
    oscPort: config.oscLocalPort,
    wsClients: wss.clients.size,
    uptime: process.uptime()
  });
});

// API endpoint to get current state
app.get('/api/state', (req, res) => {
  res.json({
    parameters: currentState,
    connected: wss.clients.size > 0
  });
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({
  server,
  path: '/ws'
});

// Track current cymatics state
const currentState = {
  frequency: 440,
  amplitude: 0.5,
  pattern: 0,
  particle_density: 5000,
  damping: 0.5,
  phase: 0,
  resonance: 0.5,
  waveform: 0
};

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WebSocket] Client connected from ${clientIp}`);
  console.log(`[WebSocket] Total clients: ${wss.clients.size}`);

  // Send current state to new client
  ws.send(JSON.stringify({
    type: 'state',
    data: currentState
  }));

  // Handle messages from browser
  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      handleBrowserMessage(msg, ws);
    } catch (err) {
      console.error('[WebSocket] Invalid JSON:', err);
    }
  });

  ws.on('close', () => {
    console.log(`[WebSocket] Client disconnected from ${clientIp}`);
    console.log(`[WebSocket] Total clients: ${wss.clients.size}`);
  });

  ws.on('error', (err) => {
    console.error('[WebSocket] Error:', err);
  });
});

// Handle messages from browser (bidirectional control)
function handleBrowserMessage(msg, ws) {
  console.log(`[Browser → OSC] ${msg.type}:`, msg.data);

  switch (msg.type) {
    case 'control':
      // Browser wants to control a parameter
      sendOscControl(msg.data.parameter, msg.data.value);
      break;

    case 'preset':
      // Load a preset configuration
      loadPreset(msg.data.presetId);
      break;

    case 'ping':
      // Heartbeat
      ws.send(JSON.stringify({ type: 'pong' }));
      break;

    default:
      console.log(`[Browser] Unknown message type: ${msg.type}`);
  }
}

// Send OSC control message back to midi-mp
function sendOscControl(parameter, value) {
  // Map parameter to OSC address
  const oscAddress = `/cymatica/control/${parameter}`;

  udpPort.send({
    address: oscAddress,
    args: [{ type: 'f', value: parseFloat(value) }]
  }, config.oscLocalAddress, config.oscLocalPort);

  console.log(`[OSC Send] ${oscAddress} = ${value}`);
}

// Load a preset
function loadPreset(presetId) {
  const presets = {
    'chladni': {
      frequency: 440,
      amplitude: 0.7,
      pattern: 0.3,
      particle_density: 8000,
      damping: 0.3,
      phase: 0,
      resonance: 0.8,
      waveform: 0
    },
    'ripple': {
      frequency: 220,
      amplitude: 0.5,
      pattern: 0.7,
      particle_density: 3000,
      damping: 0.7,
      phase: 1.57,
      resonance: 0.3,
      waveform: 0
    },
    'chaos': {
      frequency: 880,
      amplitude: 0.9,
      pattern: 0.9,
      particle_density: 10000,
      damping: 0.1,
      phase: 3.14,
      resonance: 0.9,
      waveform: 4
    }
  };

  const preset = presets[presetId];
  if (preset) {
    Object.entries(preset).forEach(([param, value]) => {
      sendOscControl(param, value);
    });
    console.log(`[Preset] Loaded: ${presetId}`);
  }
}

// Create OSC UDP port (receives from midi-mp)
const udpPort = new osc.UDPPort({
  localAddress: config.oscLocalAddress,
  localPort: config.oscLocalPort,
  metadata: config.metadata
});

// OSC message handler (from midi-mp)
udpPort.on("message", (oscMsg, timeTag, info) => {
  const timestamp = new Date().toISOString().substring(11, 23);

  // Handle semantic events from midi-mp
  if (oscMsg.address.startsWith('/midi-mp/event/')) {
    const eventType = oscMsg.address.replace('/midi-mp/event/', '');
    const value = oscMsg.args[0];

    console.log(`[${timestamp}] ${eventType} = ${value}`);

    // Update state
    if (eventType.startsWith('cymatics.')) {
      const param = eventType.replace('cymatics.', '');
      currentState[param] = value;

      // Broadcast to all WebSocket clients
      broadcastToClients({
        type: 'parameter',
        data: {
          parameter: param,
          value: value,
          timestamp: Date.now()
        }
      });
    }
  }
  // Handle control feedback (from our own OSC sends)
  else if (oscMsg.address.startsWith('/cymatica/control/')) {
    const param = oscMsg.address.replace('/cymatica/control/', '');
    const value = oscMsg.args[0];

    console.log(`[${timestamp}] Control feedback: ${param} = ${value}`);
    currentState[param] = value;

    broadcastToClients({
      type: 'parameter',
      data: {
        parameter: param,
        value: value,
        timestamp: Date.now()
      }
    });
  }
});

// Broadcast message to all connected WebSocket clients
function broadcastToClients(message) {
  const msgStr = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msgStr);
    }
  });
}

// OSC error handler
udpPort.on("error", (err) => {
  console.error("[OSC] Error:", err);
});

// OSC ready handler
udpPort.on("ready", () => {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  OSC Port Ready - Listening for MIDI-MP events            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
});

// Start HTTP server
server.listen(config.httpPort, '0.0.0.0', () => {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  HTTP Server Ready                                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log(`Visit: http://localhost:${config.httpPort}\n`);
});

// Open OSC port
try {
  udpPort.open();
} catch (err) {
  console.error("Failed to open UDP port:", err);
  process.exit(1);
}

// Graceful shutdown
function shutdown() {
  console.log('\n\nShutting down Cymatica server...');

  // Close WebSocket connections
  wss.clients.forEach((client) => {
    client.close();
  });

  // Close servers
  udpPort.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  // Force exit after 5 seconds
  setTimeout(() => {
    console.log('Forcing exit...');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
