#!/usr/bin/env node
/**
 * midi-mp.js - MIDI Message Processor / Multiplexer
 *
 * Central message bus for tetra. Routes control messages between:
 *   - MIDI controllers (hardware input)
 *   - Gamepads (hardware input)
 *   - Games/Synths (formant, trax, quadrapole, etc.)
 *   - Browsers (via quasar WebSocket relay)
 *   - MIDI output (hardware synths, DAWs)
 *
 * 256 channels (0x00-0xFF):
 *   0x00-0x0F: MIDI ports (hardware in)
 *   0x10-0x1F: Gamepad slots
 *   0x20-0x2F: System/reserved
 *   0x30-0x3F: Synths (formant, tia, sid, etc.)
 *   0x40-0x7F: Games (trax, quadrapole, magnetar, etc.)
 *   0x80-0xBF: Browser clients
 *   0xC0-0xFE: User-defined
 *   0xFF:      Broadcast
 *
 * Usage:
 *   node midi-mp.js [--port 1983] [--config midi-mp.json]
 */

'use strict';

const dgram = require('dgram');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// =============================================================================
// CONSTANTS
// =============================================================================

const VERSION = '1.0.0';
const DEFAULT_PORT = 1983;
const CHANNEL_COUNT = 256;

// Output ports
const GAME_BROADCAST_PORT = 2020;   // Broadcast to game engines
const QUASAR_PORT = 1986;           // Direct to quasar for browser relay
const MULTICAST_GROUP = '239.1.1.1';

// Channel ranges
const CHAN = {
    MIDI_START:     0x00,
    MIDI_END:       0x0F,
    GAMEPAD_START:  0x10,
    GAMEPAD_END:    0x1F,
    SYSTEM_START:   0x20,
    SYSTEM_END:     0x2F,
    SYNTH_START:    0x30,
    SYNTH_END:      0x3F,
    GAME_START:     0x40,
    GAME_END:       0x7F,
    BROWSER_START:  0x80,
    BROWSER_END:    0xBF,
    USER_START:     0xC0,
    USER_END:       0xFE,
    BROADCAST:      0xFF
};

// Message types
const MSG_TYPE = {
    CC:       0x00,   // Continuous control
    NOTE:     0x01,   // Note/trigger
    STATE:    0x02,   // State sync
    CLOCK:    0x03,   // Timing/clock
    REGISTER: 0x10,   // Channel registration
    UNREGISTER: 0x11, // Channel unregistration
    QUERY:    0x20,   // Query state
    RESPONSE: 0x21    // Query response
};

// =============================================================================
// CHANNEL REGISTRY
// =============================================================================

class ChannelRegistry {
    constructor() {
        // 256 channel slots
        this.channels = new Array(CHANNEL_COUNT).fill(null);

        // Name → channel lookup
        this.nameIndex = new Map();

        // Pattern subscriptions (for wildcard routing)
        this.subscriptions = new Map();

        // Channel state cache
        this.stateCache = new Map();
    }

    /**
     * Register a channel
     * @param {number} channel - Channel number (0x00-0xFF)
     * @param {object} info - Channel info
     */
    register(channel, info) {
        if (channel < 0 || channel >= CHANNEL_COUNT) {
            throw new Error(`Invalid channel: ${channel}`);
        }

        const entry = {
            channel,
            name: info.name,
            type: info.type,           // 'input', 'output', 'synth', 'game', 'browser'
            transport: info.transport, // 'dgram', 'udp', 'tcp', 'ws'
            address: info.address,     // Socket path or host:port
            socket: info.socket || null,
            connected: true,
            lastSeen: Date.now(),
            metadata: info.metadata || {}
        };

        // Remove old entry if exists
        if (this.channels[channel]) {
            this.nameIndex.delete(this.channels[channel].name);
        }

        this.channels[channel] = entry;
        this.nameIndex.set(info.name, channel);

        console.log(`[registry] Channel 0x${channel.toString(16).padStart(2, '0')} registered: ${info.name} (${info.type})`);

        return entry;
    }

    /**
     * Unregister a channel
     */
    unregister(channel) {
        const entry = this.channels[channel];
        if (entry) {
            this.nameIndex.delete(entry.name);
            this.channels[channel] = null;
            console.log(`[registry] Channel 0x${channel.toString(16).padStart(2, '0')} unregistered: ${entry.name}`);
        }
    }

    /**
     * Get channel by number
     */
    get(channel) {
        return this.channels[channel];
    }

    /**
     * Get channel by name
     */
    getByName(name) {
        const channel = this.nameIndex.get(name);
        return channel !== undefined ? this.channels[channel] : null;
    }

    /**
     * Find first available channel in range
     */
    allocate(rangeStart, rangeEnd) {
        for (let i = rangeStart; i <= rangeEnd; i++) {
            if (!this.channels[i]) {
                return i;
            }
        }
        return null;
    }

    /**
     * Subscribe to address pattern
     */
    subscribe(channel, pattern) {
        if (!this.subscriptions.has(pattern)) {
            this.subscriptions.set(pattern, new Set());
        }
        this.subscriptions.get(pattern).add(channel);
    }

    /**
     * Unsubscribe from pattern
     */
    unsubscribe(channel, pattern) {
        const subs = this.subscriptions.get(pattern);
        if (subs) {
            subs.delete(channel);
        }
    }

    /**
     * Get channels matching address pattern
     */
    getSubscribers(address) {
        const subscribers = new Set();

        for (const [pattern, channels] of this.subscriptions) {
            if (this.matchPattern(address, pattern)) {
                for (const ch of channels) {
                    subscribers.add(ch);
                }
            }
        }

        return Array.from(subscribers);
    }

    /**
     * Match address against pattern (supports * and **)
     */
    matchPattern(address, pattern) {
        // Exact match
        if (address === pattern) return true;

        // Convert pattern to regex
        const regex = pattern
            .replace(/\*\*/g, '{{DOUBLESTAR}}')
            .replace(/\*/g, '[^/]+')
            .replace(/{{DOUBLESTAR}}/g, '.*');

        return new RegExp(`^${regex}$`).test(address);
    }

    /**
     * Update channel state
     */
    setState(channel, key, value) {
        if (!this.stateCache.has(channel)) {
            this.stateCache.set(channel, {});
        }
        this.stateCache.get(channel)[key] = {
            value,
            timestamp: Date.now()
        };
    }

    /**
     * Get channel state
     */
    getState(channel, key) {
        const state = this.stateCache.get(channel);
        return state ? state[key] : null;
    }

    /**
     * Get all active channels
     */
    getActive() {
        return this.channels
            .map((entry, index) => entry ? { ...entry, channel: index } : null)
            .filter(Boolean);
    }

    /**
     * Serialize registry state
     */
    toJSON() {
        return {
            channels: this.getActive(),
            subscriptions: Array.from(this.subscriptions.entries())
        };
    }
}

// =============================================================================
// MAPPING ENGINE
// =============================================================================

class MappingEngine {
    constructor() {
        // Source pattern → target mappings
        this.mappings = [];

        // Per-target map files
        this.mapFiles = new Map();
    }

    /**
     * Load mapping file for a target
     */
    loadMapFile(target, filepath) {
        try {
            const content = fs.readFileSync(filepath, 'utf8');
            const config = JSON.parse(content);

            this.mapFiles.set(target, config);

            // Add mappings
            for (const mapping of config.mappings || []) {
                this.addMapping({
                    ...mapping,
                    target
                });
            }

            console.log(`[mapping] Loaded ${config.mappings?.length || 0} mappings from ${filepath}`);
            return true;
        } catch (e) {
            console.error(`[mapping] Failed to load ${filepath}: ${e.message}`);
            return false;
        }
    }

    /**
     * Add a mapping rule
     */
    addMapping(mapping) {
        this.mappings.push({
            from: mapping.from,           // Source pattern
            to: mapping.to,               // Target address
            target: mapping.target,       // Target name
            scale: mapping.scale || null, // Value scaling
            type: mapping.type || 'cc',   // cc, trigger, state
            value: mapping.value,         // Fixed value for triggers
            enabled: true
        });
    }

    /**
     * Remove mappings for target
     */
    removeTarget(target) {
        this.mappings = this.mappings.filter(m => m.target !== target);
        this.mapFiles.delete(target);
    }

    /**
     * Apply mappings to a message
     * Returns array of mapped messages
     */
    apply(address, value, sourceChannel) {
        const results = [];

        for (const mapping of this.mappings) {
            if (!mapping.enabled) continue;

            // Check if source matches
            if (!this.matchPattern(address, mapping.from)) continue;

            // Build target address
            let targetAddr = mapping.to;

            // Handle wildcards in source → target
            // e.g., /midi/note/1/* → /formant/phoneme/$1
            const sourceRegex = mapping.from
                .replace(/\*/g, '([^/]+)');
            const match = address.match(new RegExp(`^${sourceRegex}$`));

            if (match) {
                // Replace $1, $2, etc. with captured groups
                for (let i = 1; i < match.length; i++) {
                    targetAddr = targetAddr.replace(`$${i}`, match[i]);
                }
            }

            // Apply value scaling
            let mappedValue = value;
            if (mapping.scale) {
                mappedValue = this.scaleValue(value, mapping.scale);
            }

            // Use fixed value for triggers
            if (mapping.type === 'trigger' && mapping.value !== undefined) {
                mappedValue = mapping.value;
            }

            results.push({
                address: targetAddr,
                value: mappedValue,
                target: mapping.target,
                type: mapping.type
            });
        }

        return results;
    }

    /**
     * Scale value between ranges
     */
    scaleValue(value, scale) {
        const [inMin, inMax] = scale.in;
        const [outMin, outMax] = scale.out;

        // Normalize to 0-1
        const normalized = (value - inMin) / (inMax - inMin);

        // Scale to output range
        return outMin + normalized * (outMax - outMin);
    }

    /**
     * Match address against pattern
     */
    matchPattern(address, pattern) {
        if (address === pattern) return true;

        const regex = pattern
            .replace(/\*\*/g, '{{DOUBLESTAR}}')
            .replace(/\*/g, '[^/]+')
            .replace(/{{DOUBLESTAR}}/g, '.*');

        return new RegExp(`^${regex}$`).test(address);
    }

    /**
     * Get all mappings for a target
     */
    getMappingsFor(target) {
        return this.mappings.filter(m => m.target === target);
    }

    /**
     * Serialize mappings
     */
    toJSON() {
        return {
            mappings: this.mappings,
            mapFiles: Array.from(this.mapFiles.keys())
        };
    }
}

// =============================================================================
// MESSAGE ROUTER
// =============================================================================

class MessageRouter extends EventEmitter {
    constructor(options = {}) {
        super();

        this.port = options.port || DEFAULT_PORT;
        this.configDir = options.configDir || process.env.TETRA_DIR + '/midi-mp';

        this.registry = new ChannelRegistry();
        this.mappings = new MappingEngine();

        // Transport handlers
        this.udpServer = null;
        this.broadcastSocket = null;  // For sending to games (2020) and quasar (1986)
        this.unixServer = null;
        this.unixClients = new Map();  // path → socket

        // Message queue for rate limiting
        this.messageQueue = [];
        this.processing = false;

        // Stats
        this.stats = {
            messagesIn: 0,
            messagesOut: 0,
            messagesDropped: 0,
            startTime: Date.now()
        };
    }

    /**
     * Start the router
     */
    async start() {
        console.log(`[midi-mp] Starting v${VERSION}`);

        // Load config
        await this.loadConfig();

        // Start UDP server (receives from multicast)
        await this.startUdpServer();

        // Start broadcast socket (sends to games and quasar)
        await this.startBroadcastSocket();

        // Start Unix socket server (for local registration)
        await this.startUnixServer();

        // Start message processor
        this.startProcessor();

        console.log(`[midi-mp] Ready on UDP:${this.port}`);

        // TSM runtime visibility
        const tsm = (d) => process.env.TSM_PROCESS_DIR &&
            fs.writeFileSync(path.join(process.env.TSM_PROCESS_DIR, 'runtime.json'), JSON.stringify(d));
        setInterval(() => tsm({
            channels: this.registry.nameIndex.size,
            subs: this.registry.subscriptions.size,
            in: this.stats.messagesIn,
            out: this.stats.messagesOut,
            up: Math.floor((Date.now() - this.stats.startTime) / 1000)
        }), 5000);

        return this;
    }

    /**
     * Stop the router
     */
    async stop() {
        console.log('[midi-mp] Stopping...');

        if (this.udpServer) {
            this.udpServer.close();
        }

        if (this.unixServer) {
            this.unixServer.close();
        }

        for (const [path, socket] of this.unixClients) {
            socket.close();
        }

        // Save state
        await this.saveConfig();

        console.log('[midi-mp] Stopped');
    }

    /**
     * Load configuration
     */
    async loadConfig() {
        const configPath = path.join(this.configDir, 'config.json');

        try {
            // Ensure config dir exists
            if (!fs.existsSync(this.configDir)) {
                fs.mkdirSync(this.configDir, { recursive: true });
            }

            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

                // Load map files
                const mapsDir = path.join(this.configDir, 'maps');
                if (fs.existsSync(mapsDir)) {
                    for (const file of fs.readdirSync(mapsDir)) {
                        if (file.endsWith('.map.json')) {
                            const target = file.replace('.map.json', '');
                            this.mappings.loadMapFile(target, path.join(mapsDir, file));
                        }
                    }
                }

                console.log('[midi-mp] Configuration loaded');
            } else {
                // Create default config
                await this.saveConfig();
            }
        } catch (e) {
            console.error('[midi-mp] Config load error:', e.message);
        }
    }

    /**
     * Save configuration
     */
    async saveConfig() {
        const configPath = path.join(this.configDir, 'config.json');

        try {
            const config = {
                version: VERSION,
                port: this.port,
                registry: this.registry.toJSON(),
                mappings: this.mappings.toJSON()
            };

            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        } catch (e) {
            console.error('[midi-mp] Config save error:', e.message);
        }
    }

    /**
     * Start UDP server - joins multicast group to receive from midi.js
     */
    async startUdpServer() {
        const MULTICAST_GROUP = '239.1.1.1';

        return new Promise((resolve, reject) => {
            // Create socket with SO_REUSEADDR for multicast sharing
            this.udpServer = dgram.createSocket({ type: 'udp4', reuseAddr: true });

            this.udpServer.on('message', (msg, rinfo) => {
                this.handleUdpMessage(msg, rinfo);
            });

            this.udpServer.on('error', (err) => {
                console.error('[udp] Server error:', err);
                reject(err);
            });

            this.udpServer.on('listening', () => {
                // Join multicast group to receive broadcasts from midi.js
                try {
                    this.udpServer.addMembership(MULTICAST_GROUP);
                    console.log(`[udp] Joined multicast ${MULTICAST_GROUP}:${this.port}`);
                } catch (err) {
                    console.error(`[udp] Failed to join multicast: ${err.message}`);
                }
                resolve();
            });

            // Bind to multicast port with reuseAddr (allows multiple listeners)
            this.udpServer.bind(this.port, '0.0.0.0');
            console.log(`[udp] Binding to port ${this.port} (multicast listener)`);
        });
    }

    /**
     * Start broadcast socket for sending to games and quasar
     */
    async startBroadcastSocket() {
        return new Promise((resolve) => {
            this.broadcastSocket = dgram.createSocket('udp4');

            this.broadcastSocket.on('error', (err) => {
                console.error('[broadcast] Socket error:', err.message);
            });

            // Use ephemeral port for sending
            this.broadcastSocket.bind(0, () => {
                console.log(`[broadcast] Ready to send to games:${GAME_BROADCAST_PORT} quasar:${QUASAR_PORT}`);
                resolve();
            });
        });
    }

    /**
     * Broadcast message to games (2020) and quasar (1986)
     */
    broadcastToOutputs(address, args) {
        if (!this.broadcastSocket) return;

        const msg = Buffer.from(`${address} ${args.join(' ')}`);

        // Send to game engines on 2020
        this.broadcastSocket.send(msg, GAME_BROADCAST_PORT, '127.0.0.1', (err) => {
            if (err) console.error('[broadcast] Game send error:', err.message);
        });

        // Send to quasar on 1986
        this.broadcastSocket.send(msg, QUASAR_PORT, '127.0.0.1', (err) => {
            if (err) console.error('[broadcast] Quasar send error:', err.message);
        });

        this.stats.messagesOut += 2;
    }

    /**
     * Start Unix socket server for local registration
     */
    async startUnixServer() {
        const socketPath = '/tmp/tetra/midi-mp.sock';

        return new Promise((resolve, reject) => {
            // Remove old socket
            if (fs.existsSync(socketPath)) {
                fs.unlinkSync(socketPath);
            }

            // Ensure directory exists
            const dir = path.dirname(socketPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            this.unixServer = net.createServer((socket) => {
                this.handleUnixConnection(socket);
            });

            this.unixServer.on('error', (err) => {
                console.error('[unix] Server error:', err);
                reject(err);
            });

            this.unixServer.listen(socketPath, () => {
                console.log(`[unix] Listening on ${socketPath}`);
                resolve();
            });
        });
    }

    /**
     * Handle UDP message (OSC format)
     */
    handleUdpMessage(msg, rinfo) {
        this.stats.messagesIn++;

        try {
            // Parse OSC message
            const parsed = this.parseOscMessage(msg);

            if (!parsed) {
                // Try text format: /address value
                const text = msg.toString().trim();
                const match = text.match(/^(\/\S+)\s+(.*)$/);
                if (match) {
                    this.routeMessage({
                        address: match[1],
                        args: this.parseArgs(match[2]),
                        source: `udp:${rinfo.address}:${rinfo.port}`
                    });
                }
            } else {
                this.routeMessage({
                    address: parsed.address,
                    args: parsed.args,
                    source: `udp:${rinfo.address}:${rinfo.port}`
                });
            }
        } catch (e) {
            console.error('[udp] Parse error:', e.message);
        }
    }

    /**
     * Handle Unix socket connection (for registration)
     */
    handleUnixConnection(socket) {
        let buffer = '';

        socket.on('data', (data) => {
            buffer += data.toString();

            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop();  // Keep incomplete line

            for (const line of lines) {
                if (line.trim()) {
                    this.handleUnixCommand(socket, line.trim());
                }
            }
        });

        socket.on('close', () => {
            // Unregister any channels owned by this socket
            for (const entry of this.registry.getActive()) {
                if (entry.socket === socket) {
                    this.registry.unregister(entry.channel);
                }
            }
        });

        socket.on('error', (err) => {
            console.error('[unix] Socket error:', err.message);
        });
    }

    /**
     * Handle Unix socket command
     */
    handleUnixCommand(socket, line) {
        try {
            const cmd = JSON.parse(line);

            switch (cmd.type) {
                case 'register':
                    this.handleRegister(socket, cmd);
                    break;

                case 'unregister':
                    this.handleUnregister(cmd);
                    break;

                case 'subscribe':
                    this.handleSubscribe(cmd);
                    break;

                case 'send':
                    this.routeMessage({
                        address: cmd.address,
                        args: cmd.args,
                        source: `unix:${cmd.name}`
                    });
                    break;

                case 'query':
                    this.handleQuery(socket, cmd);
                    break;

                default:
                    socket.write(JSON.stringify({ error: 'Unknown command' }) + '\n');
            }
        } catch (e) {
            socket.write(JSON.stringify({ error: e.message }) + '\n');
        }
    }

    /**
     * Handle channel registration
     */
    handleRegister(socket, cmd) {
        const { name, type, transport, address, subscribe } = cmd;

        // Determine channel range based on type
        let rangeStart, rangeEnd;
        switch (type) {
            case 'midi':
                rangeStart = CHAN.MIDI_START;
                rangeEnd = CHAN.MIDI_END;
                break;
            case 'gamepad':
                rangeStart = CHAN.GAMEPAD_START;
                rangeEnd = CHAN.GAMEPAD_END;
                break;
            case 'synth':
                rangeStart = CHAN.SYNTH_START;
                rangeEnd = CHAN.SYNTH_END;
                break;
            case 'game':
                rangeStart = CHAN.GAME_START;
                rangeEnd = CHAN.GAME_END;
                break;
            case 'browser':
                rangeStart = CHAN.BROWSER_START;
                rangeEnd = CHAN.BROWSER_END;
                break;
            default:
                rangeStart = CHAN.USER_START;
                rangeEnd = CHAN.USER_END;
        }

        // Allocate channel
        const channel = cmd.channel !== undefined
            ? cmd.channel
            : this.registry.allocate(rangeStart, rangeEnd);

        if (channel === null) {
            socket.write(JSON.stringify({ error: 'No channels available' }) + '\n');
            return;
        }

        // Register
        const entry = this.registry.register(channel, {
            name,
            type,
            transport: transport || 'unix',
            address: address || socket.remoteAddress,
            socket
        });

        // Subscribe to patterns
        if (subscribe) {
            for (const pattern of subscribe) {
                this.registry.subscribe(channel, pattern);
            }
        }

        // Load mapping file if exists
        const mapFile = path.join(this.configDir, 'maps', `${name}.map.json`);
        if (fs.existsSync(mapFile)) {
            this.mappings.loadMapFile(name, mapFile);
        }

        // Store dgram socket if provided
        if (transport === 'dgram' && address) {
            this.connectDgram(channel, address);
        }

        socket.write(JSON.stringify({
            ok: true,
            channel: `0x${channel.toString(16).padStart(2, '0')}`,
            channelNum: channel
        }) + '\n');

        this.emit('register', entry);
    }

    /**
     * Handle unregistration
     */
    handleUnregister(cmd) {
        const entry = cmd.channel !== undefined
            ? this.registry.get(cmd.channel)
            : this.registry.getByName(cmd.name);

        if (entry) {
            this.registry.unregister(entry.channel);
            this.mappings.removeTarget(entry.name);
            this.emit('unregister', entry);
        }
    }

    /**
     * Handle subscription
     */
    handleSubscribe(cmd) {
        const entry = this.registry.getByName(cmd.name);
        if (entry && cmd.patterns) {
            for (const pattern of cmd.patterns) {
                this.registry.subscribe(entry.channel, pattern);
            }
        }
    }

    /**
     * Handle query
     */
    handleQuery(socket, cmd) {
        let result;

        switch (cmd.query) {
            case 'channels':
                result = this.registry.getActive();
                break;
            case 'mappings':
                result = this.mappings.toJSON();
                break;
            case 'stats':
                result = {
                    ...this.stats,
                    uptime: Date.now() - this.stats.startTime
                };
                break;
            case 'state':
                result = cmd.channel !== undefined
                    ? this.registry.stateCache.get(cmd.channel)
                    : Object.fromEntries(this.registry.stateCache);
                break;
            default:
                result = { error: 'Unknown query' };
        }

        socket.write(JSON.stringify(result) + '\n');
    }

    /**
     * Connect to dgram socket
     */
    connectDgram(channel, socketPath) {
        const socket = dgram.createSocket('unix_dgram');

        socket.on('error', (err) => {
            console.error(`[dgram] Channel 0x${channel.toString(16)} error:`, err.message);
        });

        this.unixClients.set(socketPath, { socket, channel });

        const entry = this.registry.get(channel);
        if (entry) {
            entry.dgramSocket = socket;
            entry.dgramPath = socketPath;
        }
    }

    /**
     * Route a message
     */
    routeMessage(msg) {
        const { address, args, source } = msg;
        const value = args[0];

        // Extract source channel from address if present
        // e.g., /0x00/cc/74 → channel 0x00, address /cc/74
        let sourceChannel = null;
        let routeAddr = address;

        const chanMatch = address.match(/^\/(0x[0-9a-f]{2})\/(.+)$/i);
        if (chanMatch) {
            sourceChannel = parseInt(chanMatch[1], 16);
            routeAddr = '/' + chanMatch[2];
        }

        // Apply mappings
        const mapped = this.mappings.apply(routeAddr, value, sourceChannel);

        if (mapped.length > 0) {
            // Route mapped messages to targets
            for (const m of mapped) {
                // Broadcast mapped message to games (2020) and quasar (1986)
                this.broadcastToOutputs(m.address, [m.value]);

                // Also send to registered channel if target exists
                const target = this.registry.getByName(m.target);
                if (target) {
                    this.sendToChannel(target.channel, m.address, m.value);
                }
            }
        } else {
            // No mapping - broadcast raw message to outputs
            this.broadcastToOutputs(routeAddr, args);

            // Also route by subscription
            const subscribers = this.registry.getSubscribers(routeAddr);
            for (const channel of subscribers) {
                this.sendToChannel(channel, routeAddr, value);
            }
        }

        // Broadcast channel (0xFF)
        if (address.startsWith('/0xFF/') || address === '/broadcast') {
            for (const entry of this.registry.getActive()) {
                this.sendToChannel(entry.channel, routeAddr, value);
            }
        }

        // Update state cache
        if (sourceChannel !== null) {
            const param = routeAddr.split('/').pop();
            this.registry.setState(sourceChannel, param, value);
        }

        this.emit('message', { address, args, source, mapped });
    }

    /**
     * Send message to a channel
     */
    sendToChannel(channel, address, value) {
        const entry = this.registry.get(channel);
        if (!entry || !entry.connected) return;

        const msg = `${address} ${value}`;

        try {
            switch (entry.transport) {
                case 'unix':
                    if (entry.socket && !entry.socket.destroyed) {
                        entry.socket.write(msg + '\n');
                    }
                    break;

                case 'dgram':
                    if (entry.dgramSocket && entry.dgramPath) {
                        const buf = Buffer.from(msg);
                        entry.dgramSocket.send(buf, 0, buf.length, entry.dgramPath);
                    }
                    break;

                case 'udp':
                    if (entry.address) {
                        const [host, port] = entry.address.split(':');
                        const buf = Buffer.from(msg);
                        this.udpServer.send(buf, 0, buf.length, parseInt(port), host);
                    }
                    break;

                case 'ws':
                    // WebSocket via quasar relay
                    this.sendToQuasar(entry, address, value);
                    break;
            }

            this.stats.messagesOut++;
            entry.lastSeen = Date.now();

        } catch (e) {
            console.error(`[send] Channel 0x${channel.toString(16)} error:`, e.message);
            this.stats.messagesDropped++;
        }
    }

    /**
     * Send to quasar for WebSocket relay
     */
    sendToQuasar(entry, address, value) {
        const quasar = this.registry.getByName('quasar');
        if (quasar && quasar.socket) {
            quasar.socket.write(JSON.stringify({
                type: 'relay',
                target: entry.name,
                address,
                value
            }) + '\n');
        }
    }

    /**
     * Start message processor
     */
    startProcessor() {
        // Process message queue at regular intervals
        setInterval(() => {
            if (this.messageQueue.length > 0 && !this.processing) {
                this.processing = true;

                while (this.messageQueue.length > 0) {
                    const msg = this.messageQueue.shift();
                    this.routeMessage(msg);
                }

                this.processing = false;
            }
        }, 1);  // 1ms tick for low latency
    }

    /**
     * Parse OSC message (basic implementation)
     */
    parseOscMessage(buffer) {
        try {
            // OSC address starts with /
            if (buffer[0] !== 0x2F) return null;

            // Find null terminator
            let addrEnd = buffer.indexOf(0);
            if (addrEnd === -1) return null;

            const address = buffer.slice(0, addrEnd).toString();

            // Align to 4 bytes
            addrEnd = Math.ceil((addrEnd + 1) / 4) * 4;

            // Type tag string
            if (buffer[addrEnd] !== 0x2C) {
                return { address, args: [] };
            }

            let typeEnd = buffer.indexOf(0, addrEnd);
            const types = buffer.slice(addrEnd + 1, typeEnd).toString();
            typeEnd = Math.ceil((typeEnd + 1) / 4) * 4;

            // Parse arguments
            const args = [];
            let offset = typeEnd;

            for (const type of types) {
                switch (type) {
                    case 'i':  // int32
                        args.push(buffer.readInt32BE(offset));
                        offset += 4;
                        break;
                    case 'f':  // float32
                        args.push(buffer.readFloatBE(offset));
                        offset += 4;
                        break;
                    case 's':  // string
                        const strEnd = buffer.indexOf(0, offset);
                        args.push(buffer.slice(offset, strEnd).toString());
                        offset = Math.ceil((strEnd + 1) / 4) * 4;
                        break;
                }
            }

            return { address, args };

        } catch (e) {
            return null;
        }
    }

    /**
     * Parse text arguments
     */
    parseArgs(text) {
        const args = [];
        const parts = text.split(/\s+/);

        for (const part of parts) {
            if (part === '') continue;

            // Try number
            const num = parseFloat(part);
            if (!isNaN(num)) {
                args.push(num);
            } else {
                args.push(part);
            }
        }

        return args;
    }

}

// =============================================================================
// CLI
// =============================================================================

function printUsage() {
    console.log(`
midi-mp v${VERSION} - MIDI Message Processor / Multiplexer

Usage:
  midi-mp [options]

Options:
  --port, -p <port>     UDP port (default: ${DEFAULT_PORT})
  --config, -c <dir>    Config directory (default: $TETRA_DIR/midi-mp)
  --verbose, -v         Verbose output
  --help, -h            Show this help

Environment:
  TETRA_DIR             Tetra runtime directory
  MIDI_MP_PORT          Default port

Commands (via Unix socket /tmp/tetra/midi-mp.sock):
  {"type":"register","name":"formant","type":"synth","subscribe":["/formant/*"]}
  {"type":"send","address":"/formant/jaw","args":[50]}
  {"type":"query","query":"channels"}
  {"type":"query","query":"stats"}

Examples:
  # Start router
  midi-mp --port 1983

  # Send OSC via netcat
  echo "/0x00/cc/74 100" | nc -u localhost 1983

  # Register a client
  echo '{"type":"register","name":"test","type":"synth"}' | nc -U /tmp/tetra/midi-mp.sock
`);
}

async function main() {
    const args = process.argv.slice(2);

    let port = DEFAULT_PORT;
    let configDir = (process.env.TETRA_DIR || '/tmp/tetra') + '/midi-mp';
    let verbose = false;

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--port':
            case '-p':
                port = parseInt(args[++i]);
                break;
            case '--config':
            case '-c':
                configDir = args[++i];
                break;
            case '--verbose':
            case '-v':
                verbose = true;
                break;
            case '--help':
            case '-h':
                printUsage();
                process.exit(0);
        }
    }

    const router = new MessageRouter({ port, configDir });

    if (verbose) {
        router.on('message', (msg) => {
            console.log(`[msg] ${msg.address} ${msg.args.join(' ')} (from ${msg.source})`);
        });

        router.on('register', (entry) => {
            console.log(`[+] ${entry.name} registered on channel 0x${entry.channel.toString(16)}`);
        });

        router.on('unregister', (entry) => {
            console.log(`[-] ${entry.name} unregistered`);
        });
    }

    // Handle shutdown
    process.on('SIGINT', async () => {
        await router.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        await router.stop();
        process.exit(0);
    });

    await router.start();
}

// Run if executed directly
if (require.main === module) {
    main().catch((e) => {
        console.error('Fatal error:', e);
        process.exit(1);
    });
}

// Export for testing/embedding
module.exports = { MessageRouter, ChannelRegistry, MappingEngine, CHAN, MSG_TYPE };
