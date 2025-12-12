#!/usr/bin/env node

/**
 * traks_midi_stdin.js - MIDI to tank control translator
 *
 * PHYSICAL MODEL:
 *   - Two faders per player (left track, right track)
 *   - Fader center (64) = stopped
 *   - Fader pushed AWAY from user = values > 64 = FORWARD intent
 *   - Fader pulled TOWARD user = values < 64 = BACKWARD intent
 *
 * TANK MODEL:
 *   - velocity: -3 to +3
 *   - Positive velocity = tank moves in direction of arrow (forward)
 *   - Negative velocity = tank moves opposite to arrow (reverse)
 *
 * OUTPUT:
 *   - "V:player:velocity" commands (e.g., "V:1:2" = P1 velocity +2)
 *   - Turn keys: a/d for P1, j/l for P2
 *
 * Usage:
 *   tail -f /path/to/midi-bridge/current.out | node traks_midi_stdin.js
 */

const fs = require('fs');
const readline = require('readline');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    // MIDI CC assignments
    P1_LEFT_CC: parseInt(process.env.P1_LEFT) || 40,
    P1_RIGHT_CC: parseInt(process.env.P1_RIGHT) || 41,
    P2_LEFT_CC: parseInt(process.env.P2_LEFT) || 46,
    P2_RIGHT_CC: parseInt(process.env.P2_RIGHT) || 47,

    // Fader interpretation
    FADER_CENTER: 64,
    DEADZONE: 20,

    // Turn detection
    TURN_THRESHOLD: 40,      // Differential needed to trigger turn
    TURN_DEBOUNCE_MS: 200,   // Min time between turns

    // Output rate
    TICK_RATE_MS: 150,

    // Debug
    VERBOSE: process.env.TRAKS_VERBOSE === '1',
};

// Game control buttons (optional)
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
    p1: { leftFader: CONFIG.FADER_CENTER, rightFader: CONFIG.FADER_CENTER, lastTurnTime: 0 },
    p2: { leftFader: CONFIG.FADER_CENTER, rightFader: CONFIG.FADER_CENTER, lastTurnTime: 0 },
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
 * Convert fader average to velocity.
 *
 * Physical: faders pushed away = high values (>64)
 * Intent: pushed away = forward = positive velocity
 *
 * @param {number} leftFader - Left fader value (0-127)
 * @param {number} rightFader - Right fader value (0-127)
 * @returns {number} Velocity from -3 to +3
 */
function fadersToVelocity(leftFader, rightFader) {
    // Average displacement from center
    const leftDisp = leftFader - CONFIG.FADER_CENTER;
    const rightDisp = rightFader - CONFIG.FADER_CENTER;
    const avgDisp = (leftDisp + rightDisp) / 2;

    // Deadzone check
    if (Math.abs(avgDisp) < CONFIG.DEADZONE) {
        return 0;
    }

    // Just negate the whole thing
    const vel = Math.round(avgDisp / 21); // gives -3 to +3
    return vel;  // flip sign
}

/**
 * Detect turn intent from fader differential.
 *
 * If right fader is pushed more than left = turn right
 * If left fader is pushed more than right = turn left
 *
 * @param {number} leftFader - Left fader value (0-127)
 * @param {number} rightFader - Right fader value (0-127)
 * @returns {number} -1 (left), 0 (none), +1 (right)
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

    write(direction < 0 ? keys.left : keys.right);
}

// ============================================================================
// MAIN TICK
// ============================================================================

function processTick() {
    const now = Date.now();

    // Player 1
    const vel1 = fadersToVelocity(state.p1.leftFader, state.p1.rightFader);
    sendVelocity(1, vel1);

    const turn1 = fadersToTurn(state.p1.leftFader, state.p1.rightFader);
    if (turn1 !== 0 && (now - state.p1.lastTurnTime) > CONFIG.TURN_DEBOUNCE_MS) {
        sendTurn(1, turn1);
        state.p1.lastTurnTime = now;
    }

    // Player 2
    const vel2 = fadersToVelocity(state.p2.leftFader, state.p2.rightFader);
    sendVelocity(2, vel2);

    const turn2 = fadersToTurn(state.p2.leftFader, state.p2.rightFader);
    if (turn2 !== 0 && (now - state.p2.lastTurnTime) > CONFIG.TURN_DEBOUNCE_MS) {
        sendTurn(2, turn2);
        state.p2.lastTurnTime = now;
    }

    log(`P1: L=${state.p1.leftFader} R=${state.p1.rightFader} vel=${vel1} turn=${turn1}`);
    log(`P2: L=${state.p2.leftFader} R=${state.p2.rightFader} vel=${vel2} turn=${turn2}`);
}

// ============================================================================
// MIDI INPUT PARSING
// ============================================================================

function parseMidiLine(line) {
    // Format: "CC {channel} {controller} {value}"
    const match = line.match(/^CC\s+(\d+)\s+(\d+)\s+(\d+)/);
    if (!match) return null;

    return {
        channel: parseInt(match[1]),
        cc: parseInt(match[2]),
        value: parseInt(match[3]),
    };
}

function handleCC(cc, value) {
    // Update fader state
    if (cc === CONFIG.P1_LEFT_CC) state.p1.leftFader = value;
    if (cc === CONFIG.P1_RIGHT_CC) state.p1.rightFader = value;
    if (cc === CONFIG.P2_LEFT_CC) state.p2.leftFader = value;
    if (cc === CONFIG.P2_RIGHT_CC) state.p2.rightFader = value;

    // Button presses
    if (BUTTON_MAP[cc] && value > CONFIG.FADER_CENTER) {
        write(BUTTON_MAP[cc]);
    }

    log(`CC ${cc} = ${value}`);
}

// ============================================================================
// MAIN
// ============================================================================

log('Starting MIDI translator');
log(`P1 faders: CC${CONFIG.P1_LEFT_CC}, CC${CONFIG.P1_RIGHT_CC}`);
log(`P2 faders: CC${CONFIG.P2_LEFT_CC}, CC${CONFIG.P2_RIGHT_CC}`);

const rl = readline.createInterface({ input: process.stdin });

rl.on('line', (line) => {
    const parsed = parseMidiLine(line);
    if (parsed) {
        handleCC(parsed.cc, parsed.value);
    }
});

// Periodic tick for velocity output
setInterval(processTick, CONFIG.TICK_RATE_MS);

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
