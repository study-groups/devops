#!/usr/bin/env node

/**
 * gamepad.js - Gamepad to OSC bridge (unified with midi.js)
 *
 * Reads HID gamepad input and broadcasts via OSC multicast on port 1983.
 * Uses same transport as midi.js so games receive unified input from both.
 *
 * OSC Output (raw):
 *   /gamepad/raw/axis/{player}/{axis} {value}     - Axis movement (-1.0 to 1.0)
 *   /gamepad/raw/button/{player}/{button} {state} - Button press (0 or 1)
 *
 * OSC Output (as virtual CC for game compatibility):
 *   /midi/raw/cc/{channel}/{cc} {value}           - Axes mapped to CC 100-105
 *
 * Virtual CC Mapping (channel 16 = gamepad):
 *   CC 100 = Left stick X  (tongue frontness)
 *   CC 101 = Left stick Y  (tongue height)
 *   CC 102 = Right stick X (lip rounding)
 *   CC 103 = Right stick Y (jaw openness)
 *   CC 104 = Left trigger  (lip protrusion)
 *   CC 105 = Right trigger (lip compression)
 *
 * Environment:
 *   GAMEPAD_OSC_PORT      - OSC port (default: 1983)
 *   GAMEPAD_OSC_MULTICAST - Multicast group (default: 239.1.1.1)
 *   GAMEPAD_VERBOSE       - "1" for debug logging
 *   GAMEPAD_POLL_MS       - Poll rate in ms (default: 16 = ~60fps)
 *   GAMEPAD_CC_CHANNEL    - Virtual CC channel (default: 16)
 */

const HID = require('node-hid');
const dgram = require('dgram');
const osc = require('osc');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    OSC_PORT: parseInt(process.env.GAMEPAD_OSC_PORT) || 1983,
    OSC_HOST: '0.0.0.0',
    OSC_MULTICAST: process.env.GAMEPAD_OSC_MULTICAST || '239.1.1.1',

    POLL_MS: parseInt(process.env.GAMEPAD_POLL_MS) || 16,
    CC_CHANNEL: parseInt(process.env.GAMEPAD_CC_CHANNEL) || 16,

    // Virtual CC assignments for gamepad axes
    CC_LEFT_X:     100,
    CC_LEFT_Y:     101,
    CC_RIGHT_X:    102,
    CC_RIGHT_Y:    103,
    CC_LEFT_TRIG:  104,
    CC_RIGHT_TRIG: 105,

    // Deadzone for analog sticks
    DEADZONE: 0.1,

    VERBOSE: process.env.GAMEPAD_VERBOSE === '1',
};

// Known gamepad VID/PIDs
const KNOWN_GAMEPADS = [
    { vendorId: 0x054c, productId: 0x0ce6, name: 'DualSense' },
    { vendorId: 0x054c, productId: 0x09cc, name: 'DualShock 4' },
    { vendorId: 0x054c, productId: 0x05c4, name: 'DualShock 4 v1' },
    { vendorId: 0x045e, productId: 0x02fd, name: 'Xbox One S' },
    { vendorId: 0x045e, productId: 0x0b12, name: 'Xbox Series X' },
    { vendorId: 0x046d, productId: 0xc21d, name: 'Logitech F310' },
    { vendorId: 0x046d, productId: 0xc21e, name: 'Logitech F510' },
    { vendorId: 0x046d, productId: 0xc21f, name: 'Logitech F710' },
    { vendorId: 0x2dc8, productId: 0x3106, name: '8BitDo Pro 2' },
];

// ============================================================================
// STATE
// ============================================================================

const state = {
    device: null,
    deviceInfo: null,
    udpPort: null,

    // Current axis values (normalized -1.0 to 1.0)
    axes: {
        leftX: 0,
        leftY: 0,
        rightX: 0,
        rightY: 0,
        leftTrigger: 0,
        rightTrigger: 0,
    },

    // Previous values for change detection
    prevAxes: {
        leftX: 0,
        leftY: 0,
        rightX: 0,
        rightY: 0,
        leftTrigger: 0,
        rightTrigger: 0,
    },

    // Button state
    buttons: 0,
    prevButtons: 0,
};

// ============================================================================
// LOGGING
// ============================================================================

function log(...args) {
    if (CONFIG.VERBOSE) {
        console.error('[gamepad]', ...args);
    }
}

// ============================================================================
// HID DEVICE MANAGEMENT
// ============================================================================

function listDevices() {
    console.log('Available HID Devices:');
    console.log('======================\n');

    const devices = HID.devices();

    // Filter to likely gamepads
    const gamepads = devices.filter(d => {
        // Check known gamepad VID/PIDs
        const known = KNOWN_GAMEPADS.find(k =>
            k.vendorId === d.vendorId && k.productId === d.productId
        );
        if (known) return true;

        // Check usage page (gamepad = 0x05, joystick = 0x04)
        if (d.usagePage === 1 && (d.usage === 4 || d.usage === 5)) return true;

        // Check product name
        const name = (d.product || '').toLowerCase();
        return name.includes('gamepad') ||
               name.includes('controller') ||
               name.includes('joystick') ||
               name.includes('xbox') ||
               name.includes('playstation') ||
               name.includes('dualshock') ||
               name.includes('dualsense');
    });

    if (gamepads.length === 0) {
        console.log('  No gamepads found');
        console.log('\nAll HID devices:');
        devices.slice(0, 10).forEach((d, i) => {
            console.log(`  [${i}] ${d.manufacturer || 'Unknown'} - ${d.product || 'Unknown'}`);
            console.log(`      VID: 0x${d.vendorId.toString(16).padStart(4, '0')} PID: 0x${d.productId.toString(16).padStart(4, '0')}`);
        });
    } else {
        gamepads.forEach((d, i) => {
            const known = KNOWN_GAMEPADS.find(k =>
                k.vendorId === d.vendorId && k.productId === d.productId
            );
            const name = known ? known.name : d.product;
            console.log(`  [${i}] ${name}`);
            console.log(`      VID: 0x${d.vendorId.toString(16).padStart(4, '0')} PID: 0x${d.productId.toString(16).padStart(4, '0')}`);
            console.log(`      Path: ${d.path}`);
        });
    }
    console.log();
}

function findGamepad() {
    const devices = HID.devices();

    // Try known gamepads first
    for (const known of KNOWN_GAMEPADS) {
        const device = devices.find(d =>
            d.vendorId === known.vendorId &&
            d.productId === known.productId
        );
        if (device) {
            return { device, name: known.name };
        }
    }

    // Try by usage page
    const byUsage = devices.find(d =>
        d.usagePage === 1 && (d.usage === 4 || d.usage === 5)
    );
    if (byUsage) {
        return { device: byUsage, name: byUsage.product || 'Unknown Gamepad' };
    }

    return null;
}

function openGamepad(pathOrIndex) {
    try {
        if (pathOrIndex !== undefined) {
            // Open specific device
            if (typeof pathOrIndex === 'string') {
                state.device = new HID.HID(pathOrIndex);
                state.deviceInfo = { path: pathOrIndex, name: 'Custom' };
            } else {
                const devices = HID.devices().filter(d =>
                    d.usagePage === 1 && (d.usage === 4 || d.usage === 5)
                );
                if (pathOrIndex < devices.length) {
                    state.device = new HID.HID(devices[pathOrIndex].path);
                    state.deviceInfo = devices[pathOrIndex];
                }
            }
        } else {
            // Auto-detect
            const found = findGamepad();
            if (found) {
                state.device = new HID.HID(found.device.path);
                state.deviceInfo = found;
                log(`Opened gamepad: ${found.name}`);
            }
        }

        if (state.device) {
            state.device.on('data', handleHIDData);
            state.device.on('error', (err) => {
                console.error('[gamepad] Device error:', err.message);
            });
            return true;
        }
    } catch (err) {
        console.error('[gamepad] Failed to open device:', err.message);
    }
    return false;
}

// ============================================================================
// HID DATA PARSING
// ============================================================================

/**
 * Parse HID report data into normalized axis values.
 * This is controller-specific - we handle common formats.
 */
function handleHIDData(data) {
    // DualSense / DualShock 4 format (USB)
    // Byte 0: Report ID
    // Byte 1: Left stick X (0-255)
    // Byte 2: Left stick Y (0-255)
    // Byte 3: Right stick X (0-255)
    // Byte 4: Right stick Y (0-255)
    // Byte 5: L2 trigger (0-255)
    // Byte 6: R2 trigger (0-255)

    if (data.length >= 7) {
        // Normalize 0-255 to -1.0 to 1.0
        state.axes.leftX = normalizeAxis(data[1]);
        state.axes.leftY = normalizeAxis(data[2]);
        state.axes.rightX = normalizeAxis(data[3]);
        state.axes.rightY = normalizeAxis(data[4]);
        state.axes.leftTrigger = data[5] / 255.0;
        state.axes.rightTrigger = data[6] / 255.0;

        // Buttons (bytes 5-7 typically)
        if (data.length >= 9) {
            state.buttons = data[8] | (data[9] << 8);
        }
    }

    // Xbox format differs - detect by report structure
    // For now, the DualSense format covers most cases

    log(`Raw: LX=${state.axes.leftX.toFixed(2)} LY=${state.axes.leftY.toFixed(2)} ` +
        `RX=${state.axes.rightX.toFixed(2)} RY=${state.axes.rightY.toFixed(2)} ` +
        `LT=${state.axes.leftTrigger.toFixed(2)} RT=${state.axes.rightTrigger.toFixed(2)}`);
}

function normalizeAxis(value) {
    // Convert 0-255 to -1.0 to 1.0
    const normalized = (value - 128) / 127.0;

    // Apply deadzone
    if (Math.abs(normalized) < CONFIG.DEADZONE) {
        return 0;
    }

    return Math.max(-1, Math.min(1, normalized));
}

function axisToCC(value) {
    // Convert -1.0 to 1.0 into 0-127
    return Math.round((value + 1) * 63.5);
}

function triggerToCC(value) {
    // Convert 0.0 to 1.0 into 0-127
    return Math.round(value * 127);
}

// ============================================================================
// OSC BROADCAST
// ============================================================================

function initOSC() {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    socket.on('listening', () => {
        try {
            socket.addMembership(CONFIG.OSC_MULTICAST);
            log(`Joined multicast group ${CONFIG.OSC_MULTICAST}:${CONFIG.OSC_PORT}`);
        } catch (err) {
            log(`Failed to join multicast: ${err.message}`);
        }
    });

    socket.on('error', (err) => {
        console.error('[gamepad] Socket error:', err.message);
    });

    socket.bind(CONFIG.OSC_PORT, CONFIG.OSC_HOST);

    state.udpPort = new osc.UDPPort({
        socket: socket,
        broadcast: true,
        multicastTTL: 1,
        metadata: true
    });

    state.udpPort.on('ready', () => {
        log('OSC ready');
    });

    state.udpPort.on('error', (err) => {
        console.error('[gamepad] OSC error:', err.message);
    });

    state.udpPort.open();
}

function broadcastAxes() {
    if (!state.udpPort) return;

    const ch = CONFIG.CC_CHANNEL;
    const axes = state.axes;
    const prev = state.prevAxes;

    // Only broadcast if changed
    const changed = (name, cc, value, prevValue, isTrigger = false) => {
        const ccValue = isTrigger ? triggerToCC(value) : axisToCC(value);
        const prevCcValue = isTrigger ? triggerToCC(prevValue) : axisToCC(prevValue);

        if (ccValue !== prevCcValue) {
            // Broadcast as virtual CC (compatible with midi.js format)
            state.udpPort.send({
                address: `/midi/raw/cc/${ch}/${cc}`,
                args: [{ type: 'i', value: ccValue }]
            }, CONFIG.OSC_MULTICAST, CONFIG.OSC_PORT);

            // Also broadcast as raw gamepad
            state.udpPort.send({
                address: `/gamepad/raw/axis/0/${name}`,
                args: [{ type: 'f', value: value }]
            }, CONFIG.OSC_MULTICAST, CONFIG.OSC_PORT);

            log(`${name}: ${value.toFixed(2)} -> CC ${cc} = ${ccValue}`);
        }
    };

    changed('leftX', CONFIG.CC_LEFT_X, axes.leftX, prev.leftX);
    changed('leftY', CONFIG.CC_LEFT_Y, axes.leftY, prev.leftY);
    changed('rightX', CONFIG.CC_RIGHT_X, axes.rightX, prev.rightX);
    changed('rightY', CONFIG.CC_RIGHT_Y, axes.rightY, prev.rightY);
    changed('leftTrigger', CONFIG.CC_LEFT_TRIG, axes.leftTrigger, prev.leftTrigger, true);
    changed('rightTrigger', CONFIG.CC_RIGHT_TRIG, axes.rightTrigger, prev.rightTrigger, true);

    // Store previous state
    Object.assign(state.prevAxes, axes);

    // Buttons
    if (state.buttons !== state.prevButtons) {
        state.udpPort.send({
            address: `/gamepad/raw/buttons/0`,
            args: [{ type: 'i', value: state.buttons }]
        }, CONFIG.OSC_MULTICAST, CONFIG.OSC_PORT);
        state.prevButtons = state.buttons;
    }
}

function broadcastState() {
    if (!state.udpPort) return;

    const name = state.deviceInfo?.name || 'none';

    state.udpPort.send({
        address: '/gamepad/state/device',
        args: [{ type: 's', value: name }]
    }, CONFIG.OSC_MULTICAST, CONFIG.OSC_PORT);

    state.udpPort.send({
        address: '/gamepad/state/cc_channel',
        args: [{ type: 'i', value: CONFIG.CC_CHANNEL }]
    }, CONFIG.OSC_MULTICAST, CONFIG.OSC_PORT);

    log(`State: device=${name}, CC channel=${CONFIG.CC_CHANNEL}`);
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
    const args = process.argv.slice(2);

    // Handle --list
    if (args.includes('-l') || args.includes('--list')) {
        listDevices();
        process.exit(0);
    }

    // Handle --help
    if (args.includes('-h') || args.includes('--help')) {
        console.log(`
Usage: gamepad.js [OPTIONS]

Options:
  -l, --list              List available gamepad devices
  -d, --device PATH       Open specific device by path
  -v, --verbose           Verbose output
  -h, --help              Show this help

OSC Output:
  Broadcasts to ${CONFIG.OSC_MULTICAST}:${CONFIG.OSC_PORT}

  Raw gamepad events:
    /gamepad/raw/axis/{player}/{axis} {value}     (-1.0 to 1.0)
    /gamepad/raw/buttons/{player} {bitfield}

  Virtual CC (compatible with midi.js):
    /midi/raw/cc/${CONFIG.CC_CHANNEL}/{cc} {value}

  Virtual CC mapping:
    CC ${CONFIG.CC_LEFT_X} = Left stick X
    CC ${CONFIG.CC_LEFT_Y} = Left stick Y
    CC ${CONFIG.CC_RIGHT_X} = Right stick X
    CC ${CONFIG.CC_RIGHT_Y} = Right stick Y
    CC ${CONFIG.CC_LEFT_TRIG} = Left trigger
    CC ${CONFIG.CC_RIGHT_TRIG} = Right trigger

Environment:
  GAMEPAD_CC_CHANNEL      Virtual CC channel (default: 16)
  GAMEPAD_VERBOSE         "1" for debug output

Examples:
  node gamepad.js -l                    # List devices
  node gamepad.js -v                    # Auto-detect with debug
  GAMEPAD_CC_CHANNEL=10 node gamepad.js # Use channel 10 for CCs
`);
        process.exit(0);
    }

    // Parse options
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '-v' || args[i] === '--verbose') {
            CONFIG.VERBOSE = true;
        } else if (args[i] === '-d' || args[i] === '--device') {
            // Device path specified
            i++;
        }
    }

    console.error('[gamepad] Starting...');
    console.error(`[gamepad] OSC: ${CONFIG.OSC_MULTICAST}:${CONFIG.OSC_PORT}`);
    console.error(`[gamepad] Virtual CC channel: ${CONFIG.CC_CHANNEL}`);

    initOSC();

    // Try to open gamepad
    if (!openGamepad()) {
        console.error('[gamepad] No gamepad found. Waiting for device...');

        // Poll for device
        const pollForDevice = setInterval(() => {
            if (openGamepad()) {
                clearInterval(pollForDevice);
                console.error(`[gamepad] Connected: ${state.deviceInfo?.name}`);
                broadcastState();
            }
        }, 2000);
    } else {
        console.error(`[gamepad] Connected: ${state.deviceInfo?.name}`);
        broadcastState();
    }

    // Broadcast loop
    setInterval(broadcastAxes, CONFIG.POLL_MS);

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.error('\n[gamepad] Shutting down...');
        if (state.device) state.device.close();
        if (state.udpPort) state.udpPort.close();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        if (state.device) state.device.close();
        if (state.udpPort) state.udpPort.close();
        process.exit(0);
    });

    console.error('[gamepad] Ready. Move sticks to send input.');
}

main();
