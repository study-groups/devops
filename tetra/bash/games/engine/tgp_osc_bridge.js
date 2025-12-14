#!/usr/bin/env node

/**
 * TGP to OSC Bridge
 * Reads frames from TGP Unix socket and broadcasts via OSC UDP
 * This is the "adapter pattern" - converts between two protocols
 */

const osc = require('osc');
const net = require('net');
const fs = require('fs');

const SESSION = process.argv[2] || 'pulsar';
const OSC_HOST = process.argv[3] || 'localhost';
const OSC_PORT = parseInt(process.argv[4]) || 1984;

const FRAME_SOCK = `/tmp/tgp_${SESSION}_frame.sock`;

console.log(`\nTGP→OSC Bridge`);
console.log(`Session: ${SESSION}`);
console.log(`TGP socket: ${FRAME_SOCK}`);
console.log(`OSC target: ${OSC_HOST}:${OSC_PORT}`);
console.log(`\nWaiting for TGP socket...\n`);

// Create OSC UDP port
const udpPort = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 0,
    metadata: true
});

udpPort.open();

// Wait for socket to exist
function waitForSocket() {
    if (!fs.existsSync(FRAME_SOCK)) {
        setTimeout(waitForSocket, 500);
        return;
    }

    console.log(`✓ TGP socket found`);
    console.log(`✓ Connecting to TGP frame socket...\n`);
    connectToTGP();
}

let frameCount = 0;
let lastLogTime = Date.now();

function connectToTGP() {
    const client = net.createConnection(FRAME_SOCK);

    client.on('connect', () => {
        console.log(`✓ Connected to TGP socket`);
        console.log(`✓ Broadcasting frames via OSC to ${OSC_HOST}:${OSC_PORT}`);
        console.log(`\nBridge active! Press Ctrl+C to stop\n`);
    });

    client.on('data', (data) => {
        try {
            // Parse TGP message
            // Header: type(1) flags(1) seq(2) len(4) = 8 bytes
            if (data.length < 8) return;

            const type = data.readUInt8(0);
            const len = data.readUInt32BE(4);

            // TGP_FRAME_FULL = 0x20
            if (type === 0x20) {
                // Skip header (8 bytes) + Frame_Full struct (~32 bytes)
                const headerSize = 8;
                const structSize = 32;
                const frameDataStart = headerSize + structSize;

                if (data.length > frameDataStart) {
                    const frameData = data.slice(frameDataStart).toString('utf8');

                    // Send via OSC
                    udpPort.send({
                        address: '/game/frame',
                        args: [
                            { type: 's', value: frameData }
                        ]
                    }, OSC_HOST, OSC_PORT);

                    frameCount++;

                    // Log progress every second
                    const now = Date.now();
                    if (now - lastLogTime > 1000) {
                        process.stdout.write(`\rFrames forwarded: ${frameCount}`);
                        lastLogTime = now;
                    }
                }
            }
        } catch (err) {
            // Silently ignore parse errors
        }
    });

    client.on('error', (err) => {
        console.error(`\nSocket error: ${err.message}`);
        console.log(`Reconnecting in 2 seconds...`);
        setTimeout(connectToTGP, 2000);
    });

    client.on('end', () => {
        console.log(`\nTGP socket closed`);
        console.log(`Reconnecting in 2 seconds...`);
        setTimeout(connectToTGP, 2000);
    });
}

// Start
waitForSocket();

// Handle exit
process.on('SIGINT', () => {
    console.log(`\n\nBridge stopped (${frameCount} frames forwarded)`);
    udpPort.close();
    process.exit(0);
});
