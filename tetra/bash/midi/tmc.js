#!/usr/bin/env node

/**
 * TMC Node.js Bridge - Bidirectional MIDI I/O using easymidi
 * Alternative to tmc.c for easier cross-platform installation
 */

const net = require('net');
const easymidi = require('easymidi');

class TMCBridge {
    constructor(options = {}) {
        this.socketPath = options.socketPath;
        this.inputDeviceId = options.inputDevice ?? -1;
        this.outputDeviceId = options.outputDevice ?? -1;
        this.verbose = options.verbose || false;
        this.running = true;

        this.midiInput = null;
        this.midiOutput = null;
        this.socket = null;
    }

    log(msg) {
        if (this.verbose) {
            console.error(`[TMC] ${msg}`);
        }
    }

    listDevices() {
        console.log('Available MIDI Devices:');
        console.log('========================\n');

        console.log('Input Devices:');
        const inputs = easymidi.getInputs();
        inputs.forEach((name, i) => {
            console.log(`  [${i}] ${name}`);
        });

        console.log('\nOutput Devices:');
        const outputs = easymidi.getOutputs();
        outputs.forEach((name, i) => {
            console.log(`  [${i}] ${name}`);
        });
        console.log();
    }

    initMIDI() {
        const inputs = easymidi.getInputs();
        const outputs = easymidi.getOutputs();

        // Initialize input
        if (this.inputDeviceId < 0 && inputs.length > 0) {
            this.inputDeviceId = 0;
        }

        if (this.inputDeviceId >= 0 && this.inputDeviceId < inputs.length) {
            const inputName = inputs[this.inputDeviceId];
            this.midiInput = new easymidi.Input(inputName);
            this.log(`Opened MIDI input: ${inputName}`);

            // Register event handlers
            this.midiInput.on('noteon', (msg) => this.handleMidiEvent('noteon', msg));
            this.midiInput.on('noteoff', (msg) => this.handleMidiEvent('noteoff', msg));
            this.midiInput.on('cc', (msg) => this.handleMidiEvent('cc', msg));
            this.midiInput.on('program', (msg) => this.handleMidiEvent('program', msg));
            this.midiInput.on('pitchbend', (msg) => this.handleMidiEvent('pitchbend', msg));
        } else if (this.inputDeviceId >= 0) {
            console.error(`ERROR: Input device ${this.inputDeviceId} not found`);
        }

        // Initialize output
        if (this.outputDeviceId < 0 && outputs.length > 0) {
            this.outputDeviceId = 0;
        }

        if (this.outputDeviceId >= 0 && this.outputDeviceId < outputs.length) {
            const outputName = outputs[this.outputDeviceId];
            this.midiOutput = new easymidi.Output(outputName);
            this.log(`Opened MIDI output: ${outputName}`);
        } else if (this.outputDeviceId >= 0) {
            console.error(`ERROR: Output device ${this.outputDeviceId} not found`);
        }
    }

    handleMidiEvent(type, msg) {
        let formatted = null;

        switch (type) {
            case 'noteon':
                if (msg.velocity === 0) {
                    formatted = `NOTE_OFF ${msg.channel + 1} ${msg.note}\n`;
                } else {
                    formatted = `NOTE_ON ${msg.channel + 1} ${msg.note} ${msg.velocity}\n`;
                }
                break;

            case 'noteoff':
                formatted = `NOTE_OFF ${msg.channel + 1} ${msg.note}\n`;
                break;

            case 'cc':
                formatted = `CC ${msg.channel + 1} ${msg.controller} ${msg.value}\n`;
                break;

            case 'program':
                formatted = `PROGRAM_CHANGE ${msg.channel + 1} ${msg.number}\n`;
                break;

            case 'pitchbend':
                formatted = `PITCH_BEND ${msg.channel + 1} ${msg.value}\n`;
                break;
        }

        if (formatted) {
            if (this.verbose) {
                process.stderr.write(`MIDI IN: ${formatted}`);
            }

            if (this.socket) {
                this.socket.write(formatted);
            }
        }
    }

    parseMidiCommand(line) {
        const parts = line.trim().split(/\s+/);
        if (parts.length === 0 || !this.midiOutput) {
            return;
        }

        const cmd = parts[0];

        try {
            switch (cmd) {
                case 'CC':
                    if (parts.length >= 4) {
                        this.midiOutput.send('cc', {
                            channel: parseInt(parts[1]) - 1,
                            controller: parseInt(parts[2]),
                            value: parseInt(parts[3])
                        });
                        if (this.verbose) {
                            process.stderr.write(`MIDI OUT: ${line}\n`);
                        }
                    }
                    break;

                case 'NOTE_ON':
                    if (parts.length >= 4) {
                        this.midiOutput.send('noteon', {
                            channel: parseInt(parts[1]) - 1,
                            note: parseInt(parts[2]),
                            velocity: parseInt(parts[3])
                        });
                        if (this.verbose) {
                            process.stderr.write(`MIDI OUT: ${line}\n`);
                        }
                    }
                    break;

                case 'NOTE_OFF':
                    if (parts.length >= 3) {
                        this.midiOutput.send('noteoff', {
                            channel: parseInt(parts[1]) - 1,
                            note: parseInt(parts[2]),
                            velocity: 0
                        });
                        if (this.verbose) {
                            process.stderr.write(`MIDI OUT: ${line}\n`);
                        }
                    }
                    break;

                case 'PROGRAM_CHANGE':
                    if (parts.length >= 3) {
                        this.midiOutput.send('program', {
                            channel: parseInt(parts[1]) - 1,
                            number: parseInt(parts[2])
                        });
                        if (this.verbose) {
                            process.stderr.write(`MIDI OUT: ${line}\n`);
                        }
                    }
                    break;
            }
        } catch (err) {
            console.error(`ERROR: Failed to send MIDI: ${err.message}`);
        }
    }

    connectSocket() {
        return new Promise((resolve, reject) => {
            this.socket = net.createConnection(this.socketPath, () => {
                this.log(`Connected to socket: ${this.socketPath}`);
                resolve();
            });

            this.socket.on('error', (err) => {
                console.error(`ERROR: Socket error: ${err.message}`);
                reject(err);
            });

            this.socket.on('close', () => {
                this.log('Socket closed');
                this.running = false;
            });

            let buffer = '';
            this.socket.on('data', (data) => {
                buffer += data.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer

                lines.forEach(line => {
                    if (line.trim()) {
                        this.parseMidiCommand(line);
                    }
                });
            });
        });
    }

    async run() {
        this.log('Starting TMC Bridge...');

        this.initMIDI();

        try {
            await this.connectSocket();
        } catch (err) {
            console.error(`ERROR: Failed to connect to socket: ${err.message}`);
            process.exit(1);
        }

        console.log('TMC Bridge running (Ctrl+C to stop)');

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\nShutting down...');
            this.cleanup();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            this.cleanup();
            process.exit(0);
        });
    }

    cleanup() {
        this.running = false;

        if (this.midiInput) {
            this.midiInput.close();
        }
        if (this.midiOutput) {
            this.midiOutput.close();
        }
        if (this.socket) {
            this.socket.end();
        }
    }
}

// CLI
function main() {
    const args = process.argv.slice(2);
    const options = {
        inputDevice: -1,
        outputDevice: -1,
        socketPath: null,
        verbose: false
    };

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '-l':
            case '--list':
                const bridge = new TMCBridge();
                bridge.listDevices();
                process.exit(0);
                break;

            case '-i':
            case '--input':
                options.inputDevice = parseInt(args[++i]);
                break;

            case '-o':
            case '--output':
                options.outputDevice = parseInt(args[++i]);
                break;

            case '-s':
            case '--socket':
                options.socketPath = args[++i];
                break;

            case '-v':
            case '--verbose':
                options.verbose = true;
                break;

            case '-h':
            case '--help':
                console.log(`
Usage: tmc.js [OPTIONS]

Options:
  -l, --list              List available MIDI devices and exit
  -i, --input DEVICE_ID   MIDI input device ID
  -o, --output DEVICE_ID  MIDI output device ID
  -s, --socket PATH       Unix socket path for TMC communication
  -v, --verbose           Verbose output
  -h, --help              Show this help

Example:
  node tmc.js -i 0 -o 0 -s /tmp/tmc.sock -v
`);
                process.exit(0);
                break;
        }
    }

    if (!options.socketPath) {
        console.error('ERROR: Socket path required (-s option)');
        process.exit(1);
    }

    const bridge = new TMCBridge(options);
    bridge.run();
}

main();
