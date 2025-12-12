#!/usr/bin/env node

/**
 * traks_midi.js - Unified MIDI/OSC to game input translator
 *
 * Listens to OSC multicast from midi-bridge service and translates
 * MIDI fader movements to tank control commands.
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
 *
 * OUTPUT:
 *   - "V:player:velocity" commands (e.g., "V:1:2" = P1 velocity +2)
 *   - Turn keys: a/d for P1, j/l for P2
 *
 * Environment:
 *   TRAKS_OSC_PORT     - UDP port (default: 1983)
 *   TRAKS_OSC_MULTICAST - Multicast group (default: 239.1.1.1)
 *   TRAKS_VERBOSE      - "1" for debug logging
 *   P1_LEFT/P1_RIGHT   - P1 CC numbers (default: 40/41)
 *   P2_LEFT/P2_RIGHT   - P2 CC numbers (default: 46/47)
 */

const osc = require('osc');
const dgram = require('dgram');
const fs = require('fs');

// ============================================================================
// CONFIGURATION (shared with traks_config.sh)
// ============================================================================

const CONFIG = {
    // OSC network
    OSC_PORT: parseInt(process.env.TRAKS_OSC_PORT) || 1983,
    OSC_HOST: '0.0.0.0',
    OSC_MULTICAST: process.env.TRAKS_OSC_MULTICAST || '239.1.1.1',

    // MIDI interpretation
    FADER_CENTER: 64,
    DEADZONE: 20,
    TURN_THRESHOLD: 40,
    TURN_DEBOUNCE_MS: 200,

    // Output rate (slower = less interference with keyboard)
    TICK_RATE_MS: 300,

    // CC assignments
    P1_LEFT_CC: parseInt(process.env.P1_LEFT) || 40,
    P1_RIGHT_CC: parseInt(process.env.P1_RIGHT) || 41,
    P2_LEFT_CC: parseInt(process.env.P2_LEFT) || 46,
    P2_RIGHT_CC: parseInt(process.env.P2_RIGHT) || 47,

    // Debug
    VERBOSE: process.env.TRAKS_VERBOSE === '1',
};

// Game control buttons (optional CC triggers)
const BUTTON_MAP = {
    52: 'p',   // Play/unpause
    53: ' ',   // Pause (space)
    54: 'q',   // Quit
    50: 'h',   // Help
};

// ============================================================================
// STATE
// ============================================================================

const state = {
    p1: {
        leftFader: CONFIG.FADER_CENTER,
        rightFader: CONFIG.FADER_CENTER,
        lastTurnTime: 0,
        lastVelocity: 0,  // Track last sent velocity
    },
    p2: {
        leftFader: CONFIG.FADER_CENTER,
        rightFader: CONFIG.FADER_CENTER,
        lastTurnTime: 0,
        lastVelocity: 0,  // Track last sent velocity
    },
};

// ============================================================================
// LOGGING
// ============================================================================

function log(...args) {
    if (CONFIG.VERBOSE) {
        console.error('[MIDI]', ...args);
    }
}

// ============================================================================
// FADER TO VELOCITY CONVERSION
// ============================================================================

/**
 * Convert fader average to velocity (-3 to +3).
 *
 * Physical: faders pushed away = high values (>64)
 * Intent: pushed away = forward = positive velocity
 */
function fadersToVelocity(leftFader, rightFader) {
    const leftDisp = leftFader - CONFIG.FADER_CENTER;
    const rightDisp = rightFader - CONFIG.FADER_CENTER;
    const avgDisp = (leftDisp + rightDisp) / 2;

    if (Math.abs(avgDisp) < CONFIG.DEADZONE) {
        return 0;
    }

    // Map to -3..+3 range
    if (avgDisp > 0) {
        if (avgDisp > 50) return 3;
        if (avgDisp > 30) return 2;
        return 1;
    } else {
        if (avgDisp < -50) return -3;
        if (avgDisp < -30) return -2;
        return -1;
    }
}

/**
 * Detect turn intent from fader differential.
 *
 * If right fader is pushed more than left = turn right
 * If left fader is pushed more than right = turn left
 */
function fadersToTurn(leftFader, rightFader) {
    const diff = rightFader - leftFader;

    if (Math.abs(diff) < CONFIG.TURN_THRESHOLD) {
        return 0;
    }

    return diff > 0 ? 1 : -1;
}

// ============================================================================
// OUTPUT
// ============================================================================

function write(str) {
    if (str) {
        fs.writeSync(1, str);
        log('OUT:', JSON.stringify(str));
    }
}

function sendVelocity(player, velocity) {
    write(`V:${player}:${velocity}\n`);
}

function sendTurn(player, direction) {
    // direction: -1 = left, +1 = right
    const keys = player === 1
        ? { left: 'a', right: 'd' }
        : { left: 'j', right: 'l' };

    write(direction < 0 ? keys.left + '\n' : keys.right + '\n');
}

// ============================================================================
// MAIN TICK
// ============================================================================

function processTick() {
    const now = Date.now();

    // Player 1 - only send velocity if changed
    const vel1 = fadersToVelocity(state.p1.leftFader, state.p1.rightFader);
    if (vel1 !== state.p1.lastVelocity) {
        sendVelocity(1, vel1);
        state.p1.lastVelocity = vel1;
    }

    const turn1 = fadersToTurn(state.p1.leftFader, state.p1.rightFader);
    if (turn1 !== 0 && (now - state.p1.lastTurnTime) > CONFIG.TURN_DEBOUNCE_MS) {
        sendTurn(1, turn1);
        state.p1.lastTurnTime = now;
    }

    // Player 2 - only send velocity if changed
    const vel2 = fadersToVelocity(state.p2.leftFader, state.p2.rightFader);
    if (vel2 !== state.p2.lastVelocity) {
        sendVelocity(2, vel2);
        state.p2.lastVelocity = vel2;
    }

    const turn2 = fadersToTurn(state.p2.leftFader, state.p2.rightFader);
    if (turn2 !== 0 && (now - state.p2.lastTurnTime) > CONFIG.TURN_DEBOUNCE_MS) {
        sendTurn(2, turn2);
        state.p2.lastTurnTime = now;
    }

    log(`P1: L=${state.p1.leftFader} R=${state.p1.rightFader} vel=${vel1} turn=${turn1}`);
    log(`P2: L=${state.p2.leftFader} R=${state.p2.rightFader} vel=${vel2} turn=${turn2}`);
}

// ============================================================================
// OSC MESSAGE HANDLING
// ============================================================================

function handleCC(cc, value) {
    // Update fader state
    if (cc === CONFIG.P1_LEFT_CC) state.p1.leftFader = value;
    if (cc === CONFIG.P1_RIGHT_CC) state.p1.rightFader = value;
    if (cc === CONFIG.P2_LEFT_CC) state.p2.leftFader = value;
    if (cc === CONFIG.P2_RIGHT_CC) state.p2.rightFader = value;

    // Button presses
    if (BUTTON_MAP[cc] && value > CONFIG.FADER_CENTER) {
        write(BUTTON_MAP[cc] + '\n');
    }

    log(`CC ${cc} = ${value}`);
}

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
        handleCC(cc, value);
    }
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
    // Disable stdout buffering
    if (process.stdout._handle && process.stdout._handle.setBlocking) {
        process.stdout._handle.setBlocking(true);
    }

    log('[traks_midi] Starting...');
    log(`[traks_midi] P1: CC${CONFIG.P1_LEFT_CC},${CONFIG.P1_RIGHT_CC}  P2: CC${CONFIG.P2_LEFT_CC},${CONFIG.P2_RIGHT_CC}`);
    log(`[traks_midi] Multicast: ${CONFIG.OSC_MULTICAST}:${CONFIG.OSC_PORT}`);
    log(`[traks_midi] Tick rate: ${CONFIG.TICK_RATE_MS}ms`);

    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    socket.on('error', (err) => {
        log(`[traks_midi] Socket error: ${err.message}`);
    });

    socket.on('listening', () => {
        try {
            socket.addMembership(CONFIG.OSC_MULTICAST);
            log(`[traks_midi] Joined multicast`);
        } catch (err) {
            log(`[traks_midi] Failed to join multicast: ${err.message}`);
        }
    });

    socket.bind(CONFIG.OSC_PORT, CONFIG.OSC_HOST);

    const udpPort = new osc.UDPPort({
        socket: socket,
        metadata: true
    });

    udpPort.on('message', handleOSCMessage);
    udpPort.on('error', (err) => log(`[traks_midi] OSC error: ${err.message}`));
    udpPort.open();

    // Movement loop
    setInterval(processTick, CONFIG.TICK_RATE_MS);

    process.on('SIGTERM', () => process.exit(0));
    process.on('SIGINT', () => process.exit(0));
}

main();
