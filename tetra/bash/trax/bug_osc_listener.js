#!/usr/bin/env node

/**
 * bug_osc_listener.js - MIDI-to-game-keys translator with tank controls
 *
 * Listens to OSC multicast from midi-bridge service (239.1.1.1:1983)
 *
 * OSC Address format: /midi/raw/cc/{channel}/{controller} {value}
 *
 * TANK CONTROLS (Player 1):
 *   CC 40 = left track,  CC 41 = right track
 *   Both 64 = stop (deadzone)
 *   Both 127 = forward
 *   Both 0 = backward
 *   Left 0, Right 127 = spin right
 *   Left 127, Right 0 = spin left
 *   Differential = curved path
 */

const osc = require('osc');
const dgram = require('dgram');

// Configuration
const OSC_PORT = parseInt(process.env.BUG_OSC_PORT) || 1983;
const OSC_HOST = '0.0.0.0';
const OSC_MULTICAST = process.env.BUG_OSC_MULTICAST || '239.1.1.1';
const VERBOSE = process.env.BUG_VERBOSE === '1';
const LOG_FIFO = process.env.BUG_LOG_FIFO || '/tmp/bug_log';

// Tank control config
const DEADZONE = 15;
const CENTER = 64;
const TICK_RATE = 50;

// CC assignments - configure via env vars
// P1: CC 40,41  P2: CC 46,47
const P1_LEFT_CC = parseInt(process.env.P1_LEFT) || 40;
const P1_RIGHT_CC = parseInt(process.env.P1_RIGHT) || 41;
const P2_LEFT_CC = parseInt(process.env.P2_LEFT) || 46;
const P2_RIGHT_CC = parseInt(process.env.P2_RIGHT) || 47;

function log(msg) {
    if (VERBOSE) console.error(msg);
}

// Track states
const tank = {
    p1: { left: CENTER, right: CENTER },
    p2: { left: CENTER, right: CENTER },
};

// Game controls CC mapping
const controlMap = {
    52: 'p',   // play (unpause)
    53: ' ',   // pause (toggle)
    54: 'q',   // quit
    50: 'h',   // help
};

// Compute direction from tank tracks
function computeTankDirection(left, right) {
    const l = left - CENTER;
    const r = right - CENTER;

    const lDead = Math.abs(l) < DEADZONE;
    const rDead = Math.abs(r) < DEADZONE;

    if (lDead && rDead) {
        return { forward: 0, turn: 0 };
    }

    const avg = (l + r) / 2;
    const diff = r - l;

    let forward = 0;
    let turn = 0;

    if (Math.abs(avg) > DEADZONE) {
        forward = avg > 0 ? 1 : -1;
    }

    if (Math.abs(diff) > DEADZONE * 2) {
        turn = diff > 0 ? 1 : -1;
    }

    if (Math.abs(diff) > 100) {
        forward = 0;  // Pure spin
    }

    return { forward, turn };
}

// Map direction to keys
function directionToKeys(dir, player) {
    const keys = player === 1
        ? { up: 'w', down: 's', left: 'a', right: 'd' }
        : { up: 'i', down: 'k', left: 'j', right: 'l' };

    let output = '';
    if (dir.forward > 0) output += keys.up;
    if (dir.forward < 0) output += keys.down;
    if (dir.turn < 0) output += keys.left;
    if (dir.turn > 0) output += keys.right;

    return output;
}

// Write key and flush immediately
const fs = require('fs');
function writeKey(key) {
    fs.writeSync(1, key);  // fd 1 = stdout, synchronous write
}

// Output movement at fixed rate
function outputMovement() {
    const dir1 = computeTankDirection(tank.p1.left, tank.p1.right);
    const keys1 = directionToKeys(dir1, 1);
    if (keys1) writeKey(keys1);

    const dir2 = computeTankDirection(tank.p2.left, tank.p2.right);
    const keys2 = directionToKeys(dir2, 2);
    if (keys2) writeKey(keys2);
}

// Handle OSC message
function handleOSCMessage(oscMsg) {
    const address = oscMsg.address;
    const args = oscMsg.args.map(arg => typeof arg === 'object' ? arg.value : arg);

    // Parse: /midi/raw/cc/{channel}/{controller}
    const parts = address.split('/').filter(p => p.length > 0);

    if (parts[0] !== 'midi') return;

    log(`[osc] ${address} ${args.join(' ')}`);

    if (parts[1] === 'raw' && parts[2] === 'cc') {
        const channel = parseInt(parts[3]);
        const cc = parseInt(parts[4]);
        const value = args[0];

        // Player 1 tank controls
        if (cc === P1_LEFT_CC) {
            tank.p1.left = value;
            log(`[tank] P1 left=${value}`);
        }
        if (cc === P1_RIGHT_CC) {
            tank.p1.right = value;
            log(`[tank] P1 right=${value}`);
        }

        // Player 2 tank controls
        if (cc === P2_LEFT_CC) tank.p2.left = value;
        if (cc === P2_RIGHT_CC) tank.p2.right = value;

        // Game controls
        if (controlMap[cc] && value > CENTER) {
            writeKey(controlMap[cc]);
        }
    }
}

// Main
function main() {
    // Disable stdout buffering for FIFO/pipe output
    if (process.stdout._handle && process.stdout._handle.setBlocking) {
        process.stdout._handle.setBlocking(true);
    }

    log('[bug_osc] Tank controls: CC40,41 / CC46,47');
    log('[bug_osc] Connecting to ' + OSC_MULTICAST + ':' + OSC_PORT);

    // Create UDP socket
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    socket.on('error', (err) => {
        log(`[bug_osc] Socket error: ${err.message}`);
    });

    socket.on('listening', () => {
        try {
            socket.addMembership(OSC_MULTICAST);
            log(`[bug_osc] Joined multicast ${OSC_MULTICAST}:${OSC_PORT}`);
        } catch (err) {
            log(`[bug_osc] Failed to join multicast: ${err.message}`);
        }
    });

    // Bind first
    socket.bind(OSC_PORT, OSC_HOST);

    // Create OSC port using the socket
    const udpPort = new osc.UDPPort({
        socket: socket,
        metadata: true
    });

    udpPort.on('message', (oscMsg) => {
        handleOSCMessage(oscMsg);
    });

    udpPort.on('error', (err) => {
        log(`[bug_osc] OSC error: ${err.message}`);
    });

    udpPort.open();

    // Start movement loop
    setInterval(outputMovement, TICK_RATE);

    // Graceful shutdown
    process.on('SIGTERM', () => process.exit(0));
    process.on('SIGINT', () => process.exit(0));
}

main();
