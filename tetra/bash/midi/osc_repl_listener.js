#!/usr/bin/env node

/**
 * OSC REPL Listener
 * Subscribes to OSC MIDI broadcasts and outputs formatted events for bash REPL
 */

const osc = require('osc');

class OSCReplListener {
    constructor(options = {}) {
        this.oscHost = options.oscHost || '0.0.0.0';
        this.oscPort = options.oscPort || 57121;
        this.verbose = options.verbose || false;
        this.udpPort = null;

        // State tracking for REPL prompt
        this.state = {
            controller: '',
            instance: 0,
            variant: '',
            variant_name: '',
            last_cc: '',
            last_val: ''
        };
    }

    log(msg) {
        if (this.verbose) {
            console.error(`[OSC Listener] ${msg}`);
        }
    }

    init() {
        this.udpPort = new osc.UDPPort({
            localAddress: this.oscHost,
            localPort: this.oscPort,
            broadcast: false,
            metadata: true
        });

        this.udpPort.on("ready", () => {
            this.log(`Listening on ${this.oscHost}:${this.oscPort}`);
            console.error(`✓ OSC listener ready on port ${this.oscPort}`);
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

        let output = null;

        if (type === 'cc') {
            const controller = parts[4];
            this.state.last_cc = controller;
            this.state.last_val = value;
            output = `__EVENT__ raw CC ${channel} ${controller} ${value}`;
        } else if (type === 'note') {
            const note = parts[4];
            if (value > 0) {
                output = `__EVENT__ raw NOTE_ON ${channel} ${note} ${value}`;
            } else {
                output = `__EVENT__ raw NOTE_OFF ${channel} ${note}`;
            }
            this.state.last_cc = `N${note}`;
            this.state.last_val = value;
        } else if (type === 'program') {
            output = `__EVENT__ raw PROGRAM_CHANGE ${channel} ${value}`;
        } else if (type === 'pitchbend') {
            output = `__EVENT__ raw PITCH_BEND ${channel} ${value}`;
        }

        if (output) {
            console.log(output);

            // Also output state update for prompt
            const stateStr = Object.entries(this.state)
                .map(([k, v]) => `${k}=${v}`)
                .join(' ');
            console.log(`__STATE__ ${stateStr}`);

            if (this.verbose) {
                console.error(`Raw: ${output}`);
            }
        }
    }

    handleMappedMessage(parts, args) {
        // /midi/mapped/{variant}/{semantic}
        const variant = parts[2];
        const semantic = parts[3];
        const value = args[0];

        const output = `__EVENT__ mapped ${variant} ${semantic} ${value.toFixed(6)}`;
        console.log(output);

        if (this.verbose) {
            console.error(`Mapped: ${semantic}=${value.toFixed(6)}`);
        }
    }

    cleanup() {
        if (this.udpPort) {
            this.udpPort.close();
        }
    }
}

// CLI
function main() {
    const args = process.argv.slice(2);
    const options = {
        oscHost: '0.0.0.0',
        oscPort: 57121,
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
  -p, --osc-port PORT     OSC listen port (default: 57121)
  -v, --verbose           Verbose output to stderr
  --help                  Show this help

Output Format:
  __STATE__ controller=vmx8 instance=0 variant=a variant_name=mixer last_cc=7 last_val=64
  __EVENT__ raw CC 1 7 64
  __EVENT__ mapped a VOLUME_1 0.503937

This listener is designed to be used by the MIDI REPL for networked MIDI control.
It subscribes to OSC broadcasts and outputs formatted events that the bash REPL can parse.

Example:
  node osc_repl_listener.js -p 57121 -v
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
