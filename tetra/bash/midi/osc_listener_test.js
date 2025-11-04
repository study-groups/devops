#!/usr/bin/env node

/**
 * OSC Listener Test - Verify TMC OSC broadcasts
 * Listen for OSC MIDI events from tmc.js
 */

const osc = require('osc');

const udpPort = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 57121,
    metadata: true
});

udpPort.on("ready", () => {
    console.log("OSC Listener ready on port 57121");
    console.log("Waiting for MIDI events from tmc.js...");
    console.log("Move a knob or press a button on your VMX8\n");
});

udpPort.on("message", (oscMsg) => {
    const address = oscMsg.address;
    const value = oscMsg.args[0]?.value || oscMsg.args[0];

    // Parse the OSC address
    const parts = address.split('/');
    const type = parts[2]; // cc, noteon, noteoff, etc.
    const channel = parts[3];
    const controllerOrNote = parts[4];

    // Pretty print
    console.log(`${new Date().toISOString().split('T')[1].split('.')[0]} | ${address.padEnd(30)} | ${value}`);

    // Example: Map to game events
    if (type === 'cc') {
        // This is where you'd update game state in tetra-mp-2400
        console.log(`  → Game event: Update parameter CC${controllerOrNote} to ${value/127}`);
    }
});

udpPort.on("error", (err) => {
    console.error("OSC Error:", err.message);
});

udpPort.open();

console.log("\nOSC Test Listener for TMC");
console.log("========================\n");
