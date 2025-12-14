#!/usr/bin/env node

/**
 * OSC Frame Viewer - Receive game frames via OSC and display in terminal
 * Usage: osc_frame_viewer.js [port]
 */

const osc = require('osc');

const PORT = process.argv[2] ? parseInt(process.argv[2]) : 1984;

console.log(`\nOSC Frame Viewer`);
console.log(`Listening on UDP port ${PORT}`);
console.log(`Waiting for /game/frame messages...\n`);

// Hide cursor
process.stdout.write('\x1b[?25l');

// Show cursor on exit
process.on('exit', () => {
    process.stdout.write('\x1b[?25h');
    console.log('\nViewer stopped');
});

process.on('SIGINT', () => {
    process.exit(0);
});

const udpPort = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: PORT,
    metadata: true
});

udpPort.on("ready", () => {
    console.log(`Ready! Listening for frames...`);
    // Clear screen after ready message
    setTimeout(() => {
        process.stdout.write('\x1b[2J\x1b[H');
    }, 500);
});

udpPort.on("message", (oscMsg) => {
    if (oscMsg.address === '/game/frame') {
        // Frame data is sent as a string
        const frameData = oscMsg.args[0].value;

        // Move cursor to home and print frame
        process.stdout.write('\x1b[H');
        process.stdout.write(frameData);
    } else if (oscMsg.address === '/game/meta') {
        // Optional: handle metadata (FPS, entity count, etc.)
        // For now, just ignore to keep display clean
    }
});

udpPort.on("error", (err) => {
    console.error("Error: ", err);
});

udpPort.open();
