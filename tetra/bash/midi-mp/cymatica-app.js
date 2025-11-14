#!/usr/bin/env node

/**
 * Cymatica - Cymatics Visualization App (Skeleton)
 *
 * Consumer application for MIDI-MP protocol
 * Listens on port 3000 (default) for transformed OSC messages
 *
 * Process Chain:
 *   MIDI Controller → midi-1983 (:57121) → midi-mp-2020 (:2020) → cymatica-3000 (:3000)
 */

const osc = require('osc');

// Configuration
const config = {
  localAddress: "0.0.0.0",
  localPort: parseInt(process.env.PORT || process.argv[2] || 2020),
  metadata: true
};

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  Cymatica - Cymatics Visualization App (Skeleton)         ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');
console.log(`Listening on UDP port: ${config.localPort}`);
console.log('Waiting for OSC messages from midi-mp-2020...\n');

// Create UDP port
const udpPort = new osc.UDPPort(config);

// Message handler
udpPort.on("message", (oscMsg, timeTag, info) => {
  const timestamp = new Date().toISOString().substring(11, 23);

  console.log(`[${timestamp}] ${oscMsg.address}`);

  // Parse semantic events from midi-mp
  if (oscMsg.address.startsWith('/midi-mp/event/')) {
    handleSemanticEvent(oscMsg);
  }
  // Handle raw MIDI if passed through
  else if (oscMsg.address.startsWith('/midi/raw/')) {
    handleRawMidi(oscMsg);
  }
  // Unknown format
  else {
    console.log(`  Unknown format:`, oscMsg);
  }

  console.log('');
});

// Handle semantic events (transformed by midi-mp)
function handleSemanticEvent(oscMsg) {
  const eventType = oscMsg.address.replace('/midi-mp/event/', '');
  const value = oscMsg.args[0];

  console.log(`  Event: ${eventType}`);
  console.log(`  Value: ${value}`);

  // Cymatics-specific event handling
  switch(eventType) {
    case 'cymatics.frequency':
      updateFrequency(value);
      break;
    case 'cymatics.amplitude':
      updateAmplitude(value);
      break;
    case 'cymatics.pattern':
      updatePattern(value);
      break;
    case 'cymatics.particle_density':
      updateParticleDensity(value);
      break;
    case 'cymatics.damping':
      updateDamping(value);
      break;
    case 'cymatics.phase':
      updatePhase(value);
      break;
    case 'cymatics.resonance':
      updateResonance(value);
      break;
    case 'cymatics.waveform':
      updateWaveform(value);
      break;
    default:
      console.log(`  (No handler for ${eventType})`);
  }
}

// Handle raw MIDI messages
function handleRawMidi(oscMsg) {
  // Parse OSC address: /midi/raw/cc/1/40 or /midi/raw/note/1/60
  const parts = oscMsg.address.split('/');
  const messageType = parts[3]; // cc or note
  const channel = parts[4];
  const number = parts[5];
  const value = oscMsg.args[0];

  console.log(`  Type: ${messageType}, Channel: ${channel}, Number: ${number}, Value: ${value}`);
}

// Cymatics visualization stubs (to be implemented)
function updateFrequency(hz) {
  console.log(`  → Setting frequency to ${hz} Hz`);
  // TODO: Update audio oscillator frequency
}

function updateAmplitude(amp) {
  console.log(`  → Setting amplitude to ${amp}`);
  // TODO: Update audio gain
}

function updatePattern(pattern) {
  console.log(`  → Switching to pattern ${pattern}`);
  // TODO: Change cymatics pattern (Chladni figures)
}

function updateParticleDensity(density) {
  console.log(`  → Setting particle density to ${density}`);
  // TODO: Update particle system density
}

function updateDamping(damping) {
  console.log(`  → Setting damping to ${damping}`);
  // TODO: Update wave damping coefficient
}

function updatePhase(phase) {
  console.log(`  → Setting phase to ${phase} radians`);
  // TODO: Update wave phase offset
}

function updateResonance(resonance) {
  console.log(`  → Setting resonance to ${resonance}`);
  // TODO: Update resonance filter
}

function updateWaveform(waveform) {
  const waveforms = ['sine', 'square', 'sawtooth', 'triangle', 'noise'];
  const waveIndex = Math.floor(waveform);
  console.log(`  → Switching to ${waveforms[waveIndex] || 'sine'} waveform`);
  // TODO: Update oscillator waveform type
}

// Error handler
udpPort.on("error", (err) => {
  console.error("Error:", err);
});

// Ready handler
udpPort.on("ready", () => {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Cymatica Ready - Listening for OSC messages              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('Expected events from midi-mp-2020:');
  console.log('  • cymatics.frequency       - Oscillator frequency (Hz)');
  console.log('  • cymatics.amplitude       - Wave amplitude (0-1)');
  console.log('  • cymatics.pattern         - Pattern selection (0-1)');
  console.log('  • cymatics.particle_density - Particle count');
  console.log('  • cymatics.damping         - Wave damping (0-1)');
  console.log('  • cymatics.phase           - Phase offset (radians)');
  console.log('  • cymatics.resonance       - Resonance filter (0-1)');
  console.log('  • cymatics.waveform        - Waveform type (0-4)');
  console.log('\nMove controls 40-47 on your MIDI controller to see events.\n');
});

// Open the port
try {
  udpPort.open();
} catch (err) {
  console.error("Failed to open UDP port:", err);
  process.exit(1);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down Cymatica...');
  udpPort.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nShutting down Cymatica...');
  udpPort.close();
  process.exit(0);
});
