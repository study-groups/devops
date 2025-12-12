#!/usr/bin/env node

/**
 * traks_osc_listener.js - MIDI-to-game-keys translator with tank controls
 *
 * Listens to OSC multicast from midi-bridge service (239.1.1.1:1983)
 *
 * OSC Address format: /midi/raw/cc/{channel}/{controller} {value}
 *
 * TANK CONTROLS:
 *   CC 40 = left track,  CC 41 = right track (P1)
 *   CC 46 = left track,  CC 47 = right track (P2)
 *   Both center (64) = stop
 *   Both forward = move forward
 *   Both back = move backward
 *   Differential = turn
 */

const osc = require('osc');
const dgram = require('dgram');
const fs = require('fs');

// Configuration
const OSC_PORT = parseInt(process.env.TRAKS_OSC_PORT) || 1983;
const OSC_HOST = '0.0.0.0';
const OSC_MULTICAST = process.env.TRAKS_OSC_MULTICAST || '239.1.1.1';
const VERBOSE = process.env.TRAKS_VERBOSE === '1';

// Tank control config
const DEADZONE = 20;
const CENTER = 64;
const TICK_RATE = 150;  // ms between outputs
const TURN_THRESHOLD = 2;  // number of turn inputs before actually turning

// CC assignments
const P1_LEFT_CC = parseInt(process.env.P1_LEFT) || 40;
const P1_RIGHT_CC = parseInt(process.env.P1_RIGHT) || 41;
const P2_LEFT_CC = parseInt(process.env.P2_LEFT) || 46;
const P2_RIGHT_CC = parseInt(process.env.P2_RIGHT) || 47;

function log(msg) {
    if (VERBOSE) console.error(msg);
}

// Track states with turn counters
const tank = {
    p1: { left: CENTER, right: CENTER, turnCount: 0, lastTurnDir: 0 },
    p2: { left: CENTER, right: CENTER, turnCount: 0, lastTurnDir: 0 },
};

// Game controls CC mapping
const controlMap = {
    52: 'p',   // play (unpause)
    53: ' ',   // pause (toggle)
    54: 'q',   // quit
    50: 'h',   // help
};

// Convert fader average to velocity (-3 to +3)
function fadersToVelocity(left, right) {
    const l = left - CENTER;
    const r = right - CENTER;
    const avg = (l + r) / 2;

    if (Math.abs(avg) < DEADZONE) return 0;

    if (avg > 0) {
        if (avg > 50) return 3;
        if (avg > 30) return 2;
        return 1;
    } else {
        if (avg < -50) return -3;
        if (avg < -30) return -2;
        return -1;
    }
}

// Detect turn from fader differential
function fadersToTurn(left, right) {
    const diff = right - left;
    if (Math.abs(diff) < DEADZONE * 3) return 0;
    return diff > 0 ? 1 : -1;
}

// Get turn key (with threshold/debounce)
function getTurnKey(turn, player, tankState) {
    const keys = player === 1
        ? { left: 'd', right: 'a' }
        : { left: 'l', right: 'j' };

    if (turn !== 0) {
        if (turn === tankState.lastTurnDir) {
            tankState.turnCount++;
        } else {
            tankState.turnCount = 1;
            tankState.lastTurnDir = turn;
        }

        if (tankState.turnCount >= TURN_THRESHOLD) {
            tankState.turnCount = 0;
            return turn < 0 ? keys.left : keys.right;
        }
    } else {
        tankState.turnCount = 0;
        tankState.lastTurnDir = 0;
    }

    return '';
}

// Write string to stdout
function write(str) {
    if (str) {
        fs.writeSync(1, str);
    }
}

// Output movement at fixed rate
function outputMovement() {
    // Player 1 - send velocity command (always, so neutral = 0 = stop)
    const vel1 = fadersToVelocity(tank.p1.left, tank.p1.right);
    write(`V:1:${vel1}\n`);
    log(`[P1] V:1:${vel1} (L=${tank.p1.left} R=${tank.p1.right})`);

    // Player 1 - turn (only when turning)
    const turn1 = fadersToTurn(tank.p1.left, tank.p1.right);
    const turnKey1 = getTurnKey(turn1, 1, tank.p1);
    if (turnKey1) {
        write(turnKey1 + '\n');
        log(`[P1] turn: ${turnKey1}`);
    }

    // Player 2 - send velocity command
    const vel2 = fadersToVelocity(tank.p2.left, tank.p2.right);
    write(`V:2:${vel2}\n`);
    log(`[P2] V:2:${vel2} (L=${tank.p2.left} R=${tank.p2.right})`);

    // Player 2 - turn
    const turn2 = fadersToTurn(tank.p2.left, tank.p2.right);
    const turnKey2 = getTurnKey(turn2, 2, tank.p2);
    if (turnKey2) {
        write(turnKey2 + '\n');
        log(`[P2] turn: ${turnKey2}`);
    }
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
        const cc = parseInt(parts[4]);
        const value = args[0];

        // Player 1 tank controls
        if (cc === P1_LEFT_CC) tank.p1.left = value;
        if (cc === P1_RIGHT_CC) tank.p1.right = value;

        // Player 2 tank controls
        if (cc === P2_LEFT_CC) tank.p2.left = value;
        if (cc === P2_RIGHT_CC) tank.p2.right = value;

        // Game controls (trigger on value > center)
        if (controlMap[cc] && value > CENTER) {
            writeKey(controlMap[cc]);
        }
    }
}

// Main
function main() {
    // Disable stdout buffering
    if (process.stdout._handle && process.stdout._handle.setBlocking) {
        process.stdout._handle.setBlocking(true);
    }

    log('[traks_osc] Starting...');
    log(`[traks_osc] P1: CC${P1_LEFT_CC},${P1_RIGHT_CC}  P2: CC${P2_LEFT_CC},${P2_RIGHT_CC}`);
    log(`[traks_osc] Multicast: ${OSC_MULTICAST}:${OSC_PORT}`);
    log(`[traks_osc] Tick rate: ${TICK_RATE}ms`);

    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    socket.on('error', (err) => {
        log(`[traks_osc] Socket error: ${err.message}`);
    });

    socket.on('listening', () => {
        try {
            socket.addMembership(OSC_MULTICAST);
            log(`[traks_osc] Joined multicast`);
        } catch (err) {
            log(`[traks_osc] Failed to join multicast: ${err.message}`);
        }
    });

    socket.bind(OSC_PORT, OSC_HOST);

    const udpPort = new osc.UDPPort({
        socket: socket,
        metadata: true
    });

    udpPort.on('message', handleOSCMessage);
    udpPort.on('error', (err) => log(`[traks_osc] OSC error: ${err.message}`));
    udpPort.open();

    // Movement loop
    setInterval(outputMovement, TICK_RATE);

    process.on('SIGTERM', () => process.exit(0));
    process.on('SIGINT', () => process.exit(0));
}

main();
