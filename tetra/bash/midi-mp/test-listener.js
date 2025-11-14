#!/usr/bin/env node

/**
 * Simple test listener for midi-mp
 *
 * Usage: node test-listener.js [config.json]
 *
 * This subscribes to the router and logs all routed messages
 */

const { MidiMpRouter } = require('./router');

const configFile = process.argv[2] || './examples/cymatica.json';

console.log('\n╔═══════════════════════════════════════╗');
console.log('║   midi-mp Test Listener               ║');
console.log('╚═══════════════════════════════════════╝\n');

try {
  const config = require(configFile);
  console.log(`Config: ${configFile}`);
  console.log(`Mode: ${config.mode}\n`);

  const router = new MidiMpRouter({
    ...config,
    verbose: false  // We'll handle logging
  });

  router.on('ready', () => {
    console.log('✓ Router ready');
    console.log(`Listening: ${config.oscHost || '0.0.0.0'}:${config.oscPort || 57121}`);
    console.log('\nWaiting for MIDI messages...\n');
    console.log('Move a MIDI controller to see routed events\n');
  });

  router.on('message', (msg) => {
    // Log formatted message
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);

    if (msg.event) {
      // Transformed event
      console.log(`[${timestamp}] Event: ${msg.event}`);
      if (msg.normalized !== undefined) {
        console.log(`           Value: ${msg.normalized.toFixed(2)}`);
      }
      if (msg.midi) {
        console.log(`           MIDI: ${msg.midi.type} ch:${msg.midi.channel} #${msg.midi.controller || msg.midi.note} = ${msg.midi.value}`);
      }
    } else if (msg.type === 'control') {
      // Raw control
      const {type, channel, value} = msg.midi;
      const num = msg.midi.controller || msg.midi.note;
      console.log(`[${timestamp}] MIDI: ${type} ch:${channel} #${num} = ${value}`);

      if (msg.mapped) {
        console.log(`           Mapped: ${msg.mapped.variant}/${msg.mapped.semantic} = ${msg.mapped.normalized.toFixed(3)}`);
      }
    }

    console.log('');  // Blank line between messages
  });

  router.on('player.join', ({playerId, metadata}) => {
    console.log(`\n→ Player joined: ${playerId} (${metadata.name})\n`);
  });

  router.on('player.leave', ({playerId}) => {
    console.log(`\n← Player left: ${playerId}\n`);
  });

  router.on('error', (err) => {
    console.error(`\n✗ Error: ${err.message}\n`);
  });

  // Status reporting
  setInterval(() => {
    const status = router.getStatus();
    if (status.stats.messagesReceived > 0) {
      process.stdout.write(`\r[Stats] Received: ${status.stats.messagesReceived} | Routed: ${status.stats.messagesRouted} | Players: ${status.players}     `);
    }
  }, 1000);

  process.on('SIGINT', () => {
    console.log('\n\nShutting down...');
    const status = router.getStatus();
    console.log('\nFinal Stats:');
    console.log(`  Messages received: ${status.stats.messagesReceived}`);
    console.log(`  Messages routed: ${status.stats.messagesRouted}`);
    console.log(`  Players connected: ${status.players}`);
    console.log('');
    router.close();
    process.exit(0);
  });

} catch (err) {
  console.error(`✗ Failed to start: ${err.message}`);
  console.error(`\nUsage: node test-listener.js [config.json]`);
  console.error(`\nAvailable configs:`);
  console.error(`  examples/broadcast.json`);
  console.error(`  examples/cymatica.json`);
  console.error(`  examples/vj-split.json`);
  console.error(`  examples/collaborative-daw.json\n`);
  process.exit(1);
}
