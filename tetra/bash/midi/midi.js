#!/usr/bin/env node

/**
 * TMC Node.js Bridge - Bidirectional MIDI I/O using easymidi
 * Broadcasts MIDI events via OSC (UDP) for multiplayer/networked apps
 */

const net = require('net');
const easymidi = require('easymidi');
const osc = require('osc');
const fs = require('fs');
const path = require('path');
const toml = require('toml');
const os = require('os');

class TMCBridge {
    constructor(options = {}) {
        this.socketPath = options.socketPath;
        this.inputDeviceId = options.inputDevice ?? -1;
        this.outputDeviceId = options.outputDevice ?? -1;
        this.oscPort = options.oscPort || 1983;
        this.oscMulticast = options.oscMulticast || '239.1.1.1';
        this.oscEnabled = options.oscEnabled !== false; // Default to enabled
        this.verbose = options.verbose || false;
        this.running = true;

        // Map support
        this.mapFile = options.mapFile || null;
        this.mapData = null;
        this.currentVariant = options.variant || null;
        this.hardwareToSyntax = new Map(); // "1:40" -> "p1"
        this.syntaxMapping = new Map();    // "p1" -> {semantic, min, max}

        this.midiInput = null;
        this.midiOutput = null;
        this.socket = null;
        this.udpPort = null;
    }

    log(msg) {
        if (this.verbose) {
            console.error(`[MIDI] ${msg}`);
        }
    }

    loadConfig() {
        try {
            const configPath = path.resolve(this.configFile);
            if (!fs.existsSync(configPath)) {
                this.log(`Config file not found: ${configPath}`);
                return false;
            }

            const configData = fs.readFileSync(configPath, 'utf8');
            this.config = toml.parse(configData);
            this.log(`Loaded config: ${configPath}`);

            // Apply config values (CLI options override config)
            if (!this.inputDeviceId || this.inputDeviceId === -1) {
                this.inputDeviceId = this.config.service?.device_input || -1;
            }
            if (!this.outputDeviceId || this.outputDeviceId === -1) {
                this.outputDeviceId = this.config.service?.device_output || -1;
            }
            if (!this.mapFile && this.config.service?.default_map) {
                const mapName = this.config.service.default_map;
                this.mapFile = path.join(os.homedir(), 'tetra/midi/maps', `${mapName}.json`);
            }
            if (!this.currentVariant && this.config.service?.default_variant) {
                this.currentVariant = this.config.service.default_variant;
            }
            if (this.config.service?.verbose !== undefined) {
                this.verbose = this.config.service.verbose;
            }
            if (this.config.service?.osc_port) {
                this.oscPort = this.config.service.osc_port;
            }
            if (this.config.service?.osc_multicast) {
                this.oscMulticast = this.config.service.osc_multicast;
            }

            return true;
        } catch (err) {
            console.error(`ERROR: Failed to load config: ${err.message}`);
            return false;
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

    loadMap() {
        if (!this.mapFile) {
            this.log('No map file specified');
            return false;
        }

        try {
            const mapPath = path.resolve(this.mapFile);
            const data = fs.readFileSync(mapPath, 'utf8');
            this.mapData = JSON.parse(data);

            // Set default variant if not specified
            if (!this.currentVariant) {
                this.currentVariant = this.mapData.default_variant || 'a';
            }

            // Build hardware -> syntax lookup
            this.hardwareToSyntax.clear();
            for (const [syntax, hw] of Object.entries(this.mapData.hardware)) {
                if (hw.cc !== undefined) {
                    const key = `${hw.channel}:${hw.cc}`;
                    this.hardwareToSyntax.set(key, { syntax, type: hw.type });
                } else if (hw.note !== undefined) {
                    const key = `note:${hw.channel}:${hw.note}`;
                    this.hardwareToSyntax.set(key, { syntax, type: hw.type });
                }
            }

            this.log(`Loaded map: ${this.mapData.controller}[${this.mapData.instance}]`);
            this.log(`Available variants: ${Object.keys(this.mapData.variants).join(', ')}`);

            // Load initial variant
            this.switchVariant(this.currentVariant);

            return true;
        } catch (err) {
            console.error(`ERROR: Failed to load map file: ${err.message}`);
            return false;
        }
    }

    switchVariant(variant) {
        if (!this.mapData) {
            console.error('ERROR: No map loaded');
            return false;
        }

        if (!this.mapData.variants[variant]) {
            console.error(`ERROR: Unknown variant: ${variant}`);
            console.error(`Available: ${Object.keys(this.mapData.variants).join(', ')}`);
            return false;
        }

        this.currentVariant = variant;
        const variantData = this.mapData.variants[variant];

        // Build syntax -> semantic lookup for this variant
        this.syntaxMapping.clear();
        for (const [syntax, mapping] of Object.entries(variantData.mappings)) {
            this.syntaxMapping.set(syntax, {
                semantic: mapping.semantic,
                min: mapping.min !== undefined ? mapping.min : 0,
                max: mapping.max !== undefined ? mapping.max : 1
            });
        }

        this.log(`Switched to variant '${variant}': ${variantData.name}`);
        this.log(`Mapped controls: ${Object.keys(variantData.mappings).length}`);

        // Broadcast state change via OSC
        if (this.udpPort) {
            this.broadcastState();
        }

        return true;
    }

    normalizeValue(midiValue, min, max) {
        // Linear mapping: value = min + (midi/127) * (max-min)
        return min + (midiValue / 127.0) * (max - min);
    }

    broadcastState() {
        if (!this.udpPort || !this.mapData) return;

        const controller = this.mapData.controller;
        const instance = this.mapData.instance;
        const variant = this.currentVariant;
        const variantName = this.mapData.variants[variant]?.name || variant;

        // Broadcast state metadata
        const broadcastAddr = this.oscMulticast;

        this.udpPort.send({
            address: '/midi/state/controller',
            args: [{ type: 's', value: controller }]
        }, broadcastAddr, this.oscPort);

        this.udpPort.send({
            address: '/midi/state/instance',
            args: [{ type: 'i', value: instance }]
        }, broadcastAddr, this.oscPort);

        this.udpPort.send({
            address: '/midi/state/variant',
            args: [{ type: 's', value: variant }]
        }, broadcastAddr, this.oscPort);

        this.udpPort.send({
            address: '/midi/state/variant_name',
            args: [{ type: 's', value: variantName }]
        }, broadcastAddr, this.oscPort);

        if (this.verbose) {
            console.error(`State: ${controller}[${instance}]:${variant} (${variantName})`);
        }
    }

    initOSC() {
        if (!this.oscEnabled) {
            this.log('OSC disabled');
            return;
        }

        // Create UDP socket with SO_REUSEADDR for multicast
        const dgram = require('dgram');
        const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        socket.on('listening', () => {
            // Join multicast group to receive control messages
            try {
                socket.addMembership(this.oscMulticast);
                this.log(`Joined multicast group ${this.oscMulticast}:${this.oscPort}`);
            } catch (err) {
                console.error(`Failed to join multicast: ${err.message}`);
            }
        });

        socket.on('error', (err) => {
            console.error(`Socket ERROR: ${err.message}`);
        });

        // Bind to multicast port
        socket.bind(this.oscPort, "0.0.0.0");

        this.udpPort = new osc.UDPPort({
            socket: socket,
            broadcast: true,
            multicastTTL: 1,
            metadata: true
        });

        this.udpPort.on("ready", () => {
            this.log(`OSC ready - multicasting to ${this.oscMulticast}:${this.oscPort}`);
            // Broadcast initial state if map loaded
            if (this.mapData) {
                this.broadcastState();
            }
        });

        this.udpPort.on("message", (oscMsg) => {
            this.handleOSCControl(oscMsg);
        });

        this.udpPort.on("error", (err) => {
            console.error(`OSC ERROR: ${err.message}`);
        });

        this.udpPort.open();
    }

    handleOSCControl(oscMsg) {
        const address = oscMsg.address;
        const args = oscMsg.args.map(arg => arg.value);

        // Handle control messages
        if (address === '/midi/control/variant') {
            const variant = args[0];
            if (this.switchVariant(variant)) {
                this.log(`Variant switched to: ${variant}`);
                console.error(`✓ Variant: ${variant}`);
            }
        } else if (address === '/midi/control/load-map') {
            const mapName = args[0];
            const mapPath = path.join(os.homedir(), 'tetra/midi/maps', `${mapName}.json`);
            this.mapFile = mapPath;
            if (this.loadMap()) {
                this.log(`Map loaded: ${mapName}`);
                console.error(`✓ Map loaded: ${mapName}`);
            }
        } else if (address === '/midi/control/reload') {
            if (this.loadMap()) {
                this.log('Map reloaded');
                console.error('✓ Map reloaded');
            }
        } else if (address === '/midi/control/reload-config') {
            if (this.loadConfig()) {
                this.log('Config reloaded');
                console.error('✓ Config reloaded');
            }
        } else if (address === '/midi/control/status') {
            this.broadcastState();
        } else if (address.startsWith('/midi/out/')) {
            // Handle MIDI output: /midi/out/note, /midi/out/cc, etc.
            this.handleMidiOutput(address, args);
        }
    }

    handleMidiOutput(address, args) {
        if (!this.midiOutput) {
            console.error('ERROR: No MIDI output device');
            return;
        }

        const parts = address.split('/').filter(p => p.length > 0);
        const msgType = parts[2]; // note, cc, program

        try {
            switch (msgType) {
                case 'note':
                    // /midi/out/note channel note velocity
                    if (args.length >= 3) {
                        const channel = args[0] - 1;
                        const note = args[1];
                        const velocity = args[2];
                        if (velocity > 0) {
                            this.midiOutput.send('noteon', { channel, note, velocity });
                            this.log(`MIDI OUT: NOTE_ON ${channel+1} ${note} ${velocity}`);
                        } else {
                            this.midiOutput.send('noteoff', { channel, note, velocity: 0 });
                            this.log(`MIDI OUT: NOTE_OFF ${channel+1} ${note}`);
                        }
                    }
                    break;

                case 'cc':
                    // /midi/out/cc channel controller value
                    if (args.length >= 3) {
                        const channel = args[0] - 1;
                        const controller = args[1];
                        const value = args[2];
                        this.midiOutput.send('cc', { channel, controller, value });
                        this.log(`MIDI OUT: CC ${channel+1} ${controller} ${value}`);
                    }
                    break;

                case 'program':
                    // /midi/out/program channel number
                    if (args.length >= 2) {
                        const channel = args[0] - 1;
                        const number = args[1];
                        this.midiOutput.send('program', { channel, number });
                        this.log(`MIDI OUT: PROGRAM ${channel+1} ${number}`);
                    }
                    break;
            }
        } catch (err) {
            console.error(`ERROR: Failed to send MIDI: ${err.message}`);
        }
    }

    findDeviceByName(deviceList, name) {
        const index = deviceList.findIndex(d => d === name);
        if (index >= 0) {
            return index;
        }
        // Try case-insensitive match
        const lowerName = name.toLowerCase();
        return deviceList.findIndex(d => d.toLowerCase() === lowerName);
    }

    initMIDI() {
        const inputs = easymidi.getInputs();
        const outputs = easymidi.getOutputs();

        // Resolve input device (name or ID)
        let inputIndex = this.inputDeviceId;
        if (typeof this.inputDeviceId === 'string') {
            inputIndex = this.findDeviceByName(inputs, this.inputDeviceId);
            if (inputIndex < 0) {
                console.error(`ERROR: Input device "${this.inputDeviceId}" not found`);
                console.error(`Available inputs: ${inputs.join(', ')}`);
                return;
            }
        }

        // Initialize input
        if (inputIndex < 0 && inputs.length > 0) {
            inputIndex = 0;
        }

        if (inputIndex >= 0 && inputIndex < inputs.length) {
            const inputName = inputs[inputIndex];
            this.midiInput = new easymidi.Input(inputName);
            this.log(`Opened MIDI input: ${inputName}`);

            // Register event handlers
            this.midiInput.on('noteon', (msg) => this.handleMidiEvent('noteon', msg));
            this.midiInput.on('noteoff', (msg) => this.handleMidiEvent('noteoff', msg));
            this.midiInput.on('cc', (msg) => this.handleMidiEvent('cc', msg));
            this.midiInput.on('program', (msg) => this.handleMidiEvent('program', msg));
            this.midiInput.on('pitchbend', (msg) => this.handleMidiEvent('pitchbend', msg));
        } else if (inputIndex >= 0) {
            console.error(`ERROR: Input device ${inputIndex} not found`);
        }

        // Resolve output device (name or ID)
        let outputIndex = this.outputDeviceId;
        if (typeof this.outputDeviceId === 'string') {
            outputIndex = this.findDeviceByName(outputs, this.outputDeviceId);
            if (outputIndex < 0) {
                console.error(`ERROR: Output device "${this.outputDeviceId}" not found`);
                console.error(`Available outputs: ${outputs.join(', ')}`);
                return;
            }
        }

        // Initialize output
        if (outputIndex < 0 && outputs.length > 0) {
            outputIndex = 0;
        }

        if (outputIndex >= 0 && outputIndex < outputs.length) {
            const outputName = outputs[outputIndex];
            this.midiOutput = new easymidi.Output(outputName);
            this.log(`Opened MIDI output: ${outputName}`);
        } else if (outputIndex >= 0) {
            console.error(`ERROR: Output device ${outputIndex} not found`);
        }
    }

    handleMidiEvent(type, msg) {
        let formatted = null;
        let rawOscAddress = null;
        let rawOscArgs = [];
        let channel = 0;
        let hwKey = null;

        switch (type) {
            case 'noteon':
                channel = msg.channel + 1;
                if (msg.velocity === 0) {
                    formatted = `NOTE_OFF ${channel} ${msg.note}\n`;
                    rawOscAddress = `/midi/raw/note/${channel}/${msg.note}`;
                    rawOscArgs = [0];
                    hwKey = `note:${channel}:${msg.note}`;
                } else {
                    formatted = `NOTE_ON ${channel} ${msg.note} ${msg.velocity}\n`;
                    rawOscAddress = `/midi/raw/note/${channel}/${msg.note}`;
                    rawOscArgs = [msg.velocity];
                    hwKey = `note:${channel}:${msg.note}`;
                }
                break;

            case 'noteoff':
                channel = msg.channel + 1;
                formatted = `NOTE_OFF ${channel} ${msg.note}\n`;
                rawOscAddress = `/midi/raw/note/${channel}/${msg.note}`;
                rawOscArgs = [0];
                hwKey = `note:${channel}:${msg.note}`;
                break;

            case 'cc':
                channel = msg.channel + 1;
                formatted = `CC ${channel} ${msg.controller} ${msg.value}\n`;
                rawOscAddress = `/midi/raw/cc/${channel}/${msg.controller}`;
                rawOscArgs = [msg.value];
                hwKey = `${channel}:${msg.controller}`;
                break;

            case 'program':
                channel = msg.channel + 1;
                formatted = `PROGRAM_CHANGE ${channel} ${msg.number}\n`;
                rawOscAddress = `/midi/raw/program/${channel}`;
                rawOscArgs = [msg.number];
                break;

            case 'pitchbend':
                channel = msg.channel + 1;
                formatted = `PITCH_BEND ${channel} ${msg.value}\n`;
                rawOscAddress = `/midi/raw/pitchbend/${channel}`;
                rawOscArgs = [msg.value];
                break;
        }

        if (formatted) {
            // ALWAYS send raw OSC (UDP multicast - all listeners receive)
            if (this.udpPort && rawOscAddress) {
                this.udpPort.send({
                    address: rawOscAddress,
                    args: rawOscArgs.map(v => ({ type: 'i', value: v }))
                }, this.oscMulticast, this.oscPort);

                if (this.verbose) {
                    process.stderr.write(`OSC RAW: ${rawOscAddress} ${rawOscArgs.join(' ')}\n`);
                }
            }

            // Send mapped OSC if map loaded and control is mapped
            if (this.udpPort && this.mapData && hwKey) {
                const hwMapping = this.hardwareToSyntax.get(hwKey);
                if (hwMapping) {
                    const syntax = hwMapping.syntax;
                    const semanticMapping = this.syntaxMapping.get(syntax);

                    if (semanticMapping) {
                        const semantic = semanticMapping.semantic;
                        const rawValue = rawOscArgs[0];

                        // Normalize value for continuous controls (CC, not buttons)
                        let mappedValue = rawValue;
                        if (type === 'cc') {
                            mappedValue = this.normalizeValue(rawValue, semanticMapping.min, semanticMapping.max);
                        } else if (type === 'noteon' || type === 'noteoff') {
                            // Buttons: just pass 1 or 0
                            mappedValue = rawValue > 0 ? 1 : 0;
                        }

                        const mappedAddress = `/midi/mapped/${this.currentVariant}/${semantic}`;
                        this.udpPort.send({
                            address: mappedAddress,
                            args: [{ type: 'f', value: mappedValue }]
                        }, this.oscMulticast, this.oscPort);

                        if (this.verbose) {
                            process.stderr.write(`OSC MAPPED: ${mappedAddress} ${mappedValue.toFixed(6)}\n`);
                        }
                    }
                }
            }

            // Verbose logging
            if (this.verbose) {
                process.stderr.write(`MIDI IN: ${formatted}`);
            }

            // Legacy socket/stdout output
            if (this.socket) {
                this.socket.write(formatted);
            } else {
                // No socket - write to stdout
                process.stdout.write(formatted);
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
        console.error('Starting MIDI Bridge...');

        // Load config first (unless --no-config specified)
        if (this.configFile) {
            this.loadConfig();
        }

        // Load map if specified (CLI overrides config)
        if (this.mapFile) {
            if (!this.loadMap()) {
                console.error('WARNING: Map loading failed, running with raw MIDI only');
            }
        }

        this.initMIDI();
        this.initOSC();

        if (this.socketPath) {
            try {
                await this.connectSocket();
            } catch (err) {
                console.error(`ERROR: Failed to connect to socket: ${err.message}`);
                process.exit(1);
            }
        } else {
            this.log('Running in stdout mode (no socket)');
        }

        console.error('MIDI Bridge running (Ctrl+C to stop)');

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

        if (this.udpPort) {
            this.udpPort.close();
        }

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
        oscPort: 1983,
        oscEnabled: true,
        verbose: false,
        mapFile: null,
        variant: null
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
                i++;
                options.inputDevice = isNaN(args[i]) ? args[i] : parseInt(args[i]);
                break;

            case '-o':
            case '--output':
                i++;
                options.outputDevice = isNaN(args[i]) ? args[i] : parseInt(args[i]);
                break;

            case '-s':
            case '--socket':
                options.socketPath = args[++i];
                break;

            case '--osc-port':
                options.oscPort = parseInt(args[++i]);
                break;

            case '--no-osc':
                options.oscEnabled = false;
                break;

            case '-m':
            case '--map':
                options.mapFile = args[++i];
                break;

            case '--variant':
                options.variant = args[++i];
                break;

            case '-v':
            case '--verbose':
                options.verbose = true;
                break;

            case '-h':
            case '--help':
                console.log(`
Usage: midi.js [OPTIONS]

Options:
  -l, --list              List available MIDI devices and exit
  -i, --input DEVICE      MIDI input device (ID or name)
  -o, --output DEVICE     MIDI output device (ID or name)
  -m, --map FILE          Load map file (enables semantic mapping)
  --variant VARIANT       Set initial variant (a/b/c/d, default from map)
  -s, --socket PATH       Unix socket path for communication (legacy)
  --osc-port PORT         OSC UDP port for broadcasting (default: 1983)
  --no-osc                Disable OSC output
  -v, --verbose           Verbose output (shows OSC messages)
  -h, --help              Show this help

OSC Output:
  Always broadcasts raw MIDI events:
    /midi/raw/cc/{channel}/{controller} {value}
    /midi/raw/note/{channel}/{note} {velocity}

  When map loaded, also broadcasts mapped events:
    /midi/mapped/{variant}/{semantic} {normalized_value}

  State metadata:
    /midi/state/controller {name}
    /midi/state/instance {num}
    /midi/state/variant {letter}
    /midi/state/variant_name {name}

OSC Control (send to bridge):
  /midi/control/variant {a|b|c|d}  - Switch variant
  /midi/control/reload              - Reload map file
  /midi/control/status              - Request state broadcast

Examples:
  # Raw MIDI only
  node midi.js -i "VMX8 Bluetooth" -o "VMX8 Bluetooth" -v

  # With mapping (variant 'a')
  node midi.js -i "VMX8 Bluetooth" --map ~/tetra/midi/maps/vmx8[0].json -v

  # Start with specific variant
  node midi.js -i "VMX8 Bluetooth" --map vmx8[0].json --variant b -v

  # Custom OSC port
  node midi.js -i 0 --map vmx8[0].json --osc-port 8000 -v
`);
                process.exit(0);
                break;
        }
    }

    const bridge = new TMCBridge(options);
    bridge.run();
}

main();
