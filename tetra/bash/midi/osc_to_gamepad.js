#!/usr/bin/env node

/**
 * osc_to_gamepad.js - OSC to Unix gamepad socket bridge
 *
 * Listens to OSC multicast on 1983 and converts CC messages to gp_msg
 * structs sent to a Unix domain socket (for games like estoface).
 *
 * This bridges the midi-1983 OSC transport to legacy gamepad socket consumers.
 *
 * Input (OSC):
 *   /midi/raw/cc/{channel}/{cc} {value}
 *
 * Output:
 *   gp_msg struct to Unix DGRAM socket
 *
 * CC Mapping (default - gamepad virtual CCs on channel 16):
 *   CC 100 → Left stick X
 *   CC 101 → Left stick Y
 *   CC 102 → Right stick X
 *   CC 103 → Right stick Y
 *   CC 104 → Left trigger
 *   CC 105 → Right trigger
 *
 * Also accepts real MIDI on channel 1:
 *   CC 40-45 → Same axis mapping
 *
 * Usage:
 *   node osc_to_gamepad.js /tmp/estoface_gamepad.sock
 */

const dgram = require('dgram');
const fs = require('fs');
const net = require('net');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    OSC_PORT: parseInt(process.env.OSC_PORT) || 1983,
    OSC_MULTICAST: process.env.OSC_MULTICAST || '239.1.1.1',

    SOCKET_PATH: process.argv[2] || '/tmp/estoface_gamepad.sock',

    // MIDI channel 1 - real faders
    MIDI_CHANNEL: 1,
    MIDI_CC_BASE: 40,

    // Gamepad channel 16 - virtual CCs from gamepad.js
    GAMEPAD_CHANNEL: 16,
    GAMEPAD_CC_BASE: 100,

    VERBOSE: process.env.VERBOSE === '1',

    // Send rate (ms)
    SEND_RATE: 20,
};

// ============================================================================
// STATE
// ============================================================================

const state = {
    // Axes as int16 (-32768 to 32767)
    axes: new Int16Array(6),  // LX, LY, RX, RY, LT, RT
    buttons: 0,
    seq: 0,

    // Unix socket
    socket: null,
    socketAddr: null,
};

// ============================================================================
// LOGGING
// ============================================================================

function log(...args) {
    if (CONFIG.VERBOSE) {
        console.error('[osc_to_gp]', ...args);
    }
}

// ============================================================================
// CC TO AXIS CONVERSION
// ============================================================================

/**
 * Convert MIDI CC (0-127) to int16 axis (-32768 to 32767)
 * CC 64 = center (0)
 */
function ccToAxis(cc) {
    // 0 → -32768, 64 → 0, 127 → 32767
    return Math.round(((cc - 64) / 63.5) * 32767);
}

/**
 * Convert MIDI CC (0-127) to trigger axis (-32768 to 32767)
 * CC 0 = released (-32768), CC 127 = pressed (32767)
 */
function ccToTrigger(cc) {
    return Math.round(((cc / 127) * 2 - 1) * 32767);
}

// ============================================================================
// GAMEPAD MESSAGE
// ============================================================================

/**
 * Create gp_msg buffer
 *
 * struct gp_msg {
 *     uint32_t version;        // = 1
 *     uint32_t player_id;      // 0
 *     uint32_t seq;
 *     uint32_t buttons;
 *     int16_t  axes[6];        // LX, LY, RX, RY, LT, RT
 *     uint16_t n_axes;         // 6
 *     uint64_t t_mono_ns;
 * };
 */
function createGpMsg() {
    const buf = Buffer.alloc(40);
    let offset = 0;

    // version
    buf.writeUInt32LE(1, offset); offset += 4;
    // player_id
    buf.writeUInt32LE(0, offset); offset += 4;
    // seq
    buf.writeUInt32LE(state.seq++, offset); offset += 4;
    // buttons
    buf.writeUInt32LE(state.buttons, offset); offset += 4;

    // axes[6]
    for (let i = 0; i < 6; i++) {
        buf.writeInt16LE(state.axes[i], offset);
        offset += 2;
    }

    // n_axes
    buf.writeUInt16LE(6, offset); offset += 2;
    // padding
    offset += 2;

    // t_mono_ns
    const ns = BigInt(Date.now()) * 1000000n;
    buf.writeBigUInt64LE(ns, offset);

    return buf;
}

// ============================================================================
// UNIX SOCKET
// ============================================================================

function initSocket() {
    state.socket = dgram.createSocket('udp4');

    // For Unix sockets, we need to use sendto with the path
    // Node's dgram doesn't support unix directly, so we use a raw socket
    const unix = require('unix-dgram');

    state.socket = unix.createSocket('unix_dgram');

    state.socket.on('error', (err) => {
        if (err.code !== 'ENOENT' && err.code !== 'ECONNREFUSED') {
            console.error('[osc_to_gp] Socket error:', err.message);
        }
    });

    log('Socket target:', CONFIG.SOCKET_PATH);
}

function sendGpMsg() {
    if (!state.socket) return;

    const msg = createGpMsg();

    try {
        state.socket.send(msg, CONFIG.SOCKET_PATH);
        log(`Sent seq=${state.seq-1} axes=[${state.axes.join(',')}]`);
    } catch (err) {
        // Ignore if target not listening
    }
}

// ============================================================================
// OSC HANDLING
// ============================================================================

function parseOSCMessage(buf) {
    try {
        let i = 0;
        while (i < buf.length && buf[i] !== 0) i++;
        const address = buf.toString('ascii', 0, i);

        i = Math.ceil((i + 1) / 4) * 4;

        if (buf[i] !== 0x2c) return null;
        i++;

        const types = [];
        while (i < buf.length && buf[i] !== 0) {
            types.push(String.fromCharCode(buf[i]));
            i++;
        }

        i = Math.ceil((i + 1) / 4) * 4;

        const args = [];
        for (const type of types) {
            if (type === 'i') {
                args.push(buf.readInt32BE(i));
                i += 4;
            } else if (type === 'f') {
                args.push(buf.readFloatBE(i));
                i += 4;
            }
        }

        return { address, args };
    } catch (e) {
        return null;
    }
}

function handleCC(channel, cc, value) {
    let axisIndex = -1;
    let isTrigger = false;

    // Check MIDI channel (real faders CC 40-45)
    if (channel === CONFIG.MIDI_CHANNEL) {
        axisIndex = cc - CONFIG.MIDI_CC_BASE;
        isTrigger = (axisIndex >= 4);
    }

    // Check Gamepad channel (virtual CCs 100-105)
    if (channel === CONFIG.GAMEPAD_CHANNEL) {
        axisIndex = cc - CONFIG.GAMEPAD_CC_BASE;
        isTrigger = (axisIndex >= 4);
    }

    if (axisIndex >= 0 && axisIndex < 6) {
        state.axes[axisIndex] = isTrigger ? ccToTrigger(value) : ccToAxis(value);
        log(`ch${channel} CC${cc}=${value} → axis[${axisIndex}]=${state.axes[axisIndex]}`);
    }
}

function handleOSCPacket(buf) {
    const msg = parseOSCMessage(buf);
    if (!msg) return;

    const { address, args } = msg;
    const parts = address.split('/').filter(p => p.length > 0);

    if (parts[0] !== 'midi') return;

    if (parts[1] === 'raw' && parts[2] === 'cc') {
        const channel = parseInt(parts[3]);
        const cc = parseInt(parts[4]);
        const value = args[0];

        if (!isNaN(channel) && !isNaN(cc) && typeof value === 'number') {
            handleCC(channel, cc, value);
        }
    }
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
    console.error('[osc_to_gp] Starting...');
    console.error(`[osc_to_gp] OSC: ${CONFIG.OSC_MULTICAST}:${CONFIG.OSC_PORT}`);
    console.error(`[osc_to_gp] Socket: ${CONFIG.SOCKET_PATH}`);
    console.error(`[osc_to_gp] MIDI ch${CONFIG.MIDI_CHANNEL} CC${CONFIG.MIDI_CC_BASE}-${CONFIG.MIDI_CC_BASE+5}`);
    console.error(`[osc_to_gp] Gamepad ch${CONFIG.GAMEPAD_CHANNEL} CC${CONFIG.GAMEPAD_CC_BASE}-${CONFIG.GAMEPAD_CC_BASE+5}`);

    // Try to load unix-dgram, fall back to spawning socat
    try {
        require('unix-dgram');
        initSocket();
    } catch (e) {
        console.error('[osc_to_gp] unix-dgram not available, using spawn approach');
        // Use child_process to send via socat or nc
        const { spawn } = require('child_process');

        state.sendViaSocat = (buf) => {
            const socat = spawn('socat', ['-', `UNIX-SENDTO:${CONFIG.SOCKET_PATH}`], {
                stdio: ['pipe', 'ignore', 'ignore']
            });
            socat.stdin.write(buf);
            socat.stdin.end();
        };
    }

    // OSC listener
    const udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    udp.on('listening', () => {
        try {
            udp.addMembership(CONFIG.OSC_MULTICAST);
            console.error('[osc_to_gp] Joined multicast group');
        } catch (err) {
            console.error('[osc_to_gp] Failed to join multicast:', err.message);
        }
    });

    udp.on('message', handleOSCPacket);
    udp.on('error', (err) => console.error('[osc_to_gp] UDP error:', err.message));

    udp.bind(CONFIG.OSC_PORT, '0.0.0.0');

    // Send loop
    setInterval(() => {
        if (state.socket) {
            sendGpMsg();
        } else if (state.sendViaSocat) {
            state.sendViaSocat(createGpMsg());
        }
    }, CONFIG.SEND_RATE);

    console.error('[osc_to_gp] Ready. Bridging OSC → gamepad socket.');

    process.on('SIGINT', () => process.exit(0));
    process.on('SIGTERM', () => process.exit(0));
}

main();
