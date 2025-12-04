#!/usr/bin/env node

/**
 * OSC REPL Listener - MIDI REPL Client Component
 *
 * Architecture Role: CLIENT (not a service)
 *
 * This script is started BY the REPL as a background helper process.
 * It connects to OSC broadcasts from the midi-bridge service.
 *
 * Flow:
 *   1. User runs: midi repl
 *   2. REPL starts this script in background
 *   3. This script listens to OSC broadcasts on :1983
 *   4. Receives MIDI events from midi-bridge service
 *   5. Outputs formatted events to bash for prompt updates
 *   6. When REPL exits, this script is killed
 *
 * Multiple instances can run simultaneously (different REPLs, games, etc.)
 * All listen to the same UDP broadcast from midi-bridge.
 */

const osc = require('osc');
const dgram = require('dgram');

class OSCReplListener {
    constructor(options = {}) {
        this.oscHost = options.oscHost || '0.0.0.0';
        this.oscPort = options.oscPort || 1983;
        this.oscMulticast = options.oscMulticast || '239.1.1.1';
        this.verbose = options.verbose || false;
        this.udpPort = null;

        // State tracking for REPL prompt
        this.state = {
            controller: '',
            instance: 0,
            variant: '',
            variant_name: '',
            last_cc: '',
            last_val: '',
            last_semantic: '',
            last_semantic_val: '',
            input_device: '',
            output_device: ''
        };

        // Dense logging with timing
        this.eventId = 0;
        this.lastEventTime = Date.now();
        this.startTime = Date.now();
    }

    log(msg) {
        if (this.verbose) {
            console.error(`[OSC Listener] ${msg}`);
        }
    }

    init() {
        // Create UDP socket with SO_REUSEADDR for multicast
        const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        // Configure socket
        socket.on('error', (err) => {
            console.error(`Socket ERROR: ${err.message}`);
        });

        socket.on('listening', () => {
            const address = socket.address();
            // Join multicast group
            try {
                socket.addMembership(this.oscMulticast);
                this.log(`Joined multicast group ${this.oscMulticast}:${this.oscPort}`);
                console.error(`✓ OSC listener ready - multicast ${this.oscMulticast}:${address.port}`);
            } catch (err) {
                console.error(`Failed to join multicast group: ${err.message}`);
            }
        });

        // Bind socket
        socket.bind(this.oscPort, this.oscHost);

        // Create OSC UDP port using the existing socket
        this.udpPort = new osc.UDPPort({
            socket: socket,
            metadata: true
        });

        this.udpPort.on("ready", () => {
            this.log(`OSC port ready`);
        });

        this.udpPort.on("message", (oscMsg) => {
            this.handleOSCMessage(oscMsg);
        });

        this.udpPort.on("error", (err) => {
            console.error(`OSC ERROR: ${err.message}`);
        });

        this.udpPort.open();
    }

    handleOSCMessage(oscMsg) {
        const address = oscMsg.address;
        const args = oscMsg.args.map(arg => arg.value);

        // Parse OSC address
        const parts = address.split('/').filter(p => p.length > 0);

        if (parts.length < 2 || parts[0] !== 'midi') {
            return;
        }

        const category = parts[1]; // raw, mapped, state

        if (category === 'state') {
            this.handleStateMessage(parts, args);
        } else if (category === 'raw') {
            this.handleRawMessage(parts, args);
        } else if (category === 'mapped') {
            this.handleMappedMessage(parts, args);
        }
    }

    handleStateMessage(parts, args) {
        // /midi/state/{key} {value}
        const key = parts[2];
        const value = args[0];

        this.state[key] = value;

        // Output state update for bash
        const stateStr = Object.entries(this.state)
            .map(([k, v]) => `${k}=${v}`)
            .join(' ');
        console.log(`__STATE__ ${stateStr}`);

        if (this.verbose) {
            console.error(`State update: ${key}=${value}`);
        }
    }

    handleRawMessage(parts, args) {
        // /midi/raw/{type}/{channel}/{controller|note}
        const type = parts[2]; // cc, note, program, pitchbend
        const channel = parts[3];
        const value = args[0];

        // Dense logging: calculate timing
        const now = Date.now();
        const delta = now - this.lastEventTime;
        const elapsed = now - this.startTime;
        this.lastEventTime = now;
        this.eventId++;

        let output = null;

        if (type === 'cc') {
            const controller = parts[4];
            this.state.last_cc = controller;
            this.state.last_val = value;
            // Format: __EVENT__ id delta_ms elapsed_ms raw CC ch ctrl val
            output = `__EVENT__ ${this.eventId} ${delta} ${elapsed} raw CC ${channel} ${controller} ${value}`;
        } else if (type === 'note') {
            const note = parts[4];
            if (value > 0) {
                output = `__EVENT__ ${this.eventId} ${delta} ${elapsed} raw NOTE_ON ${channel} ${note} ${value}`;
            } else {
                output = `__EVENT__ ${this.eventId} ${delta} ${elapsed} raw NOTE_OFF ${channel} ${note}`;
            }
            this.state.last_cc = `N${note}`;
            this.state.last_val = value;
        } else if (type === 'program') {
            output = `__EVENT__ ${this.eventId} ${delta} ${elapsed} raw PROGRAM_CHANGE ${channel} ${value}`;
        } else if (type === 'pitchbend') {
            output = `__EVENT__ ${this.eventId} ${delta} ${elapsed} raw PITCH_BEND ${channel} ${value}`;
        }

        if (output) {
            console.log(output);

            // Also output state update for prompt
            const stateStr = Object.entries(this.state)
                .map(([k, v]) => `${k}=${v}`)
                .join(' ');
            console.log(`__STATE__ ${stateStr}`);

            if (this.verbose) {
                console.error(`[${this.eventId}] Δ${delta}ms: ${output}`);
            }
        }
    }

    handleMappedMessage(parts, args) {
        // /midi/mapped/{variant}/{semantic}
        const variant = parts[2];
        const semantic = parts[3];
        const value = args[0];

        // Dense logging with timing
        const now = Date.now();
        const delta = now - this.lastEventTime;
        const elapsed = now - this.startTime;
        this.lastEventTime = now;
        this.eventId++;

        // Track last semantic for prompt
        this.state.last_semantic = semantic;
        this.state.last_semantic_val = value.toFixed(6);

        // Format: __EVENT__ id delta_ms elapsed_ms mapped variant semantic value
        const output = `__EVENT__ ${this.eventId} ${delta} ${elapsed} mapped ${variant} ${semantic} ${value.toFixed(6)}`;
        console.log(output);

        // Update state for prompt
        const stateStr = Object.entries(this.state)
            .map(([k, v]) => `${k}=${v}`)
            .join(' ');
        console.log(`__STATE__ ${stateStr}`);

        if (this.verbose) {
            console.error(`[${this.eventId}] Δ${delta}ms: ${semantic}=${value.toFixed(6)}`);
        }
    }

    cleanup() {
        if (this.udpPort) {
            try {
                this.udpPort.close();
            } catch (err) {
                // Ignore cleanup errors
            }
        }
    }
}

// CLI
function main() {
    const args = process.argv.slice(2);
    const options = {
        oscHost: '0.0.0.0',
        oscPort: 1983,
        verbose: false
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '-h':
            case '--osc-host':
                options.oscHost = args[++i];
                break;

            case '-p':
            case '--osc-port':
                options.oscPort = parseInt(args[++i]);
                break;

            case '-v':
            case '--verbose':
                options.verbose = true;
                break;

            case '--help':
                console.log(`
Usage: osc_repl_listener.js [OPTIONS]

Options:
  -h, --osc-host HOST     OSC listen address (default: 0.0.0.0)
  -p, --osc-port PORT     OSC listen port (default: 1983)
  -v, --verbose           Verbose output to stderr
  --help                  Show this help

Output Format:
  __STATE__ controller=vmx8 instance=0 variant=a variant_name=mixer last_cc=7 last_val=64
  __EVENT__ raw CC 1 7 64
  __EVENT__ mapped a VOLUME_1 0.503937

This listener is designed to be used by the MIDI REPL for networked MIDI control.
It subscribes to OSC broadcasts and outputs formatted events that the bash REPL can parse.

Example:
  node osc_repl_listener.js -p 1983 -v
`);
                process.exit(0);
                break;
        }
    }

    const listener = new OSCReplListener(options);
    listener.init();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.error('\nShutting down...');
        listener.cleanup();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        listener.cleanup();
        process.exit(0);
    });
}

main();
