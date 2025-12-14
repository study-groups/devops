#!/usr/bin/env node

/**
 * Pulsar OSC Listener
 * Receives OSC from midi-mp and controls the game
 *
 * Pattern: Same as osc_repl_listener.js in bash/midi
 */

const osc = require('osc');

const OSC_PORT = parseInt(process.argv[2]) || 57121;

console.log(`\n🎮 Pulsar OSC Listener`);
console.log(`Listening on UDP :${OSC_PORT}`);
console.log(`Waiting for OSC from midi-mp...\n`);

// Create OSC UDP receiver
const udpPort = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: OSC_PORT,
    metadata: true
});

// Current state
const state = {
    spawn_trigger: 0,
    frequency: 0.5,
    rotation: 0.6,
    amplitude: 6,
    length: 18,
    x: 80,
    y: 48,
    valence: 0
};

udpPort.on("ready", () => {
    console.log(`✓ Ready! Listening for pulsar.* events`);
    console.log(`\nCurrent state:`);
    displayState();
});

udpPort.on("message", (oscMsg) => {
    // Filter for pulsar events
    if (!oscMsg.address.startsWith('/midi-mp/event/pulsar.')) {
        return;
    }

    const event = oscMsg.address.replace('/midi-mp/event/', '');
    const value = oscMsg.args[0].value;

    // Update state
    switch (event) {
        case 'pulsar.spawn':
            state.spawn_trigger = value;
            if (value > 0.8) {
                console.log(`\n🌟 SPAWN TRIGGER! Creating new pulsar...`);
                spawnPulsar();
            }
            break;

        case 'pulsar.frequency':
            state.frequency = value;
            console.log(`⚡ Frequency: ${value.toFixed(2)} Hz`);
            break;

        case 'pulsar.rotation':
            state.rotation = value;
            console.log(`🔄 Rotation: ${value.toFixed(2)}`);
            break;

        case 'pulsar.amplitude':
            state.amplitude = Math.round(value);
            console.log(`📊 Amplitude: ${state.amplitude}`);
            break;

        case 'pulsar.length':
            state.length = Math.round(value);
            console.log(`📏 Length: ${state.length}`);
            break;

        case 'pulsar.x_position':
            state.x = Math.round(value);
            console.log(`↔️  X: ${state.x}`);
            break;

        case 'pulsar.y_position':
            state.y = Math.round(value);
            console.log(`↕️  Y: ${state.y}`);
            break;

        case 'pulsar.valence':
            state.valence = Math.round(value);
            const colors = ['Cyan', 'Green', 'Yellow', 'Red', 'Magenta', 'Blue'];
            console.log(`🎨 Color: ${colors[state.valence] || 'Cyan'}`);
            break;
    }
});

function spawnPulsar() {
    console.log(`\nSpawning pulsar with:`);
    console.log(`  Position: (${state.x}, ${state.y})`);
    console.log(`  Length: ${state.length}`);
    console.log(`  Amplitude: ${state.amplitude}`);
    console.log(`  Frequency: ${state.frequency.toFixed(2)} Hz`);
    console.log(`  Rotation: ${state.rotation.toFixed(2)}`);
    console.log(`  Valence: ${state.valence}`);

    // TODO: Send to game engine via TGP or direct protocol
    // For now, just log
}

function displayState() {
    console.log(`  Frequency: ${state.frequency.toFixed(2)} Hz`);
    console.log(`  Rotation: ${state.rotation.toFixed(2)}`);
    console.log(`  Amplitude: ${state.amplitude}`);
    console.log(`  Length: ${state.length}`);
    console.log(`  Position: (${state.x}, ${state.y})`);
    console.log(`  Valence: ${state.valence}`);
    console.log();
}

udpPort.on("error", (err) => {
    console.error("Error:", err);
});

udpPort.open();

// Handle exit
process.on('SIGINT', () => {
    console.log(`\n\nListener stopped\n`);
    udpPort.close();
    process.exit(0);
});
