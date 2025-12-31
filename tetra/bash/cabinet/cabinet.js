#!/usr/bin/env node

/**
 * cabinet.js - Universal game cabinet
 *
 * A cabinet is a game station that can load any gamepak.
 * Supports console display + WebSocket for multiplayer.
 *
 * Usage:
 *   node cabinet.js --dev                    # Dev mode (test pattern)
 *   node cabinet.js --game magnetar          # Load a game
 *   node cabinet.js --game magnetar --host   # Host for network play
 *   node cabinet.js --join ws://host:8080    # Join a remote cabinet
 *
 * Modes:
 *   LOCAL   - Single cabinet, local multiplayer (shared keyboard)
 *   HOST    - This cabinet hosts, others join via WebSocket
 *   CLIENT  - This cabinet joins a remote host
 */

const path = require('path');
const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');

const { Host } = require('./lib/host.js');
const { TestPattern } = require('./lib/test_pattern.js');

// Environment
const TETRA_SRC = process.env.TETRA_SRC || path.resolve(__dirname, '../../..');
const TETRA_DIR = process.env.TETRA_DIR || path.resolve(process.env.HOME, 'tetra');
const GAMES_DIR = path.join(TETRA_DIR, 'orgs/tetra/games');

// Parse arguments
function parseArgs() {
    const args = {
        mode: 'local',   // local, host, client
        game: null,
        dev: false,
        port: 8080,
        join: null,      // WebSocket URL to join
        gamma: false,
        http: false      // Serve HTTP for browser access
    };

    for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];
        const next = process.argv[i + 1];

        switch (arg) {
            case '--dev':
            case '-d':
                args.dev = true;
                break;
            case '--game':
            case '-g':
                args.game = next;
                i++;
                break;
            case '--host':
            case '-h':
                args.mode = 'host';
                break;
            case '--join':
            case '-j':
                args.mode = 'client';
                args.join = next;
                i++;
                break;
            case '--port':
            case '-p':
                args.port = parseInt(next, 10);
                i++;
                break;
            case '--gamma':
                args.gamma = true;
                break;
            case '--http':
                args.http = true;
                break;
        }
    }

    // Dev mode implies host + http for easy browser testing
    if (args.dev && args.mode === 'local') {
        args.mode = 'host';
        args.http = true;
    }

    return args;
}

// Load a gamepak by name
function loadGamepak(name) {
    const driverPath = path.join(GAMES_DIR, name, `${name}_driver.js`);

    try {
        const { [pascalCase(name) + 'Driver']: Driver } = require(driverPath);
        return new Driver({ cwd: path.join(GAMES_DIR, name) });
    } catch (e) {
        // Try generic naming
        try {
            const mod = require(driverPath);
            const DriverClass = Object.values(mod).find(v => typeof v === 'function');
            if (DriverClass) {
                return new DriverClass({ cwd: path.join(GAMES_DIR, name) });
            }
        } catch (e2) {
            console.error(`[cabinet] Failed to load gamepak: ${name}`);
            console.error(`[cabinet] Expected: ${driverPath}`);
            console.error(`[cabinet] Error: ${e.message}`);
        }
    }
    return null;
}

function pascalCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Console display handler
class ConsoleDisplay {
    constructor() {
        this.enabled = false;
    }

    enable() {
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        this.enabled = true;
    }

    disable() {
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
        this.enabled = false;
    }

    render(frame) {
        process.stdout.write('\x1b[2J\x1b[H');  // Clear screen
        process.stdout.write(frame.display || '');
    }

    onInput(callback) {
        process.stdin.on('data', (key) => {
            callback(key);
        });
    }
}

// Simple HTTP server for serving join.html
function createHttpServer(port, cabinetDir) {
    const MIME_TYPES = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.woff2': 'font/woff2'
    };

    const server = http.createServer((req, res) => {
        let filePath = req.url === '/' ? '/join.html' : req.url;
        filePath = path.join(cabinetDir, filePath);

        const ext = path.extname(filePath);
        const contentType = MIME_TYPES[ext] || 'text/plain';

        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(404);
                res.end('Not found');
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            }
        });
    });

    return server;
}

// Main cabinet class
class Cabinet {
    constructor(options = {}) {
        this.mode = options.mode || 'local';
        this.port = options.port || 8080;
        this.joinUrl = options.join || null;
        this.serveHttp = options.http || false;

        this.gamepak = null;
        this.host = null;
        this.client = null;
        this.httpServer = null;
        this.display = new ConsoleDisplay();
        this.slot = 'p1';  // Our slot when playing
        this.running = false;
    }

    loadGame(gamepak) {
        this.gamepak = gamepak;
        return this;
    }

    start() {
        this.running = true;

        if (this.mode === 'host') {
            this._startHost();
        } else if (this.mode === 'client') {
            this._startClient();
        } else {
            this._startLocal();
        }

        this._setupConsole();

        return this;
    }

    stop() {
        this.running = false;
        this.display.disable();

        if (this.gamepak) this.gamepak.stop();
        if (this.host) this.host.stop();
        if (this.client) this.client.close();
        if (this.httpServer) this.httpServer.close();

        process.exit(0);
    }

    _startLocal() {
        // Local mode: just run the game with console I/O
        if (!this.gamepak) {
            console.error('[cabinet] No gamepak loaded');
            return;
        }

        this.gamepak.onFrame((frame) => {
            this.display.render(frame);
            this._renderStatusBar();
        });

        this.gamepak.start();
    }

    _startHost() {
        // Host mode: run game + accept WebSocket connections
        if (!this.gamepak) {
            console.error('[cabinet] No gamepak loaded');
            return;
        }

        // If serving HTTP, create HTTP server and attach WebSocket to it
        if (this.serveHttp) {
            this.httpServer = createHttpServer(this.port, __dirname);
            this.httpServer.listen(this.port, () => {
                console.log(`[cabinet] HTTP: http://localhost:${this.port}`);
            });
        }

        // Create Host - attach to HTTP server if available
        this.host = new Host({
            port: this.port,
            driver: this.gamepak,
            server: this.httpServer  // Pass HTTP server for WebSocket to attach to
        });

        // Reserve P1 slot for local console
        const localPlayer = { id: 0, slot: 'p1', joinedAt: Date.now(), isLocal: true };
        this.host.players.set('local', localPlayer);

        // Frame handler: display locally AND broadcast
        const originalOnFrame = this.gamepak._onFrame;
        this.gamepak._onFrame = (frame) => {
            // Display on console
            this.display.render(frame);
            this._renderStatusBar();

            // Broadcast to network (original handler from Host)
            if (originalOnFrame) originalOnFrame(frame);
        };

        // Track remote players
        this.host.onPlayerJoin((player) => {
            if (this.gamepak.setPlayers) {
                this.gamepak.setPlayers(this.host._getPlayerList());
            }
        });

        this.host.onPlayerLeave((player) => {
            if (this.gamepak.setPlayers) {
                this.gamepak.setPlayers(this.host._getPlayerList());
            }
        });

        this.host.start();
    }

    _startClient() {
        // Client mode: connect to remote host, display frames, send input
        this.display.enable();

        console.log(`[cabinet] Connecting to ${this.joinUrl}...`);

        this.client = new WebSocket(this.joinUrl);

        this.client.on('open', () => {
            console.log('[cabinet] Connected!');
        });

        this.client.on('message', (msg) => {
            try {
                const data = JSON.parse(msg);

                if (data.t === 'welcome') {
                    this.slot = data.slot;
                    console.log(`[cabinet] Joined as ${this.slot}`);
                } else if (data.t === 'frame') {
                    this.display.render(data);
                    this._renderStatusBar();
                }
            } catch (e) {
                // Ignore parse errors
            }
        });

        this.client.on('close', () => {
            console.log('[cabinet] Disconnected');
            this.stop();
        });

        this.client.on('error', (err) => {
            console.error('[cabinet] Connection error:', err.message);
        });
    }

    _setupConsole() {
        this.display.enable();

        this.display.onInput((key) => {
            // Quit
            if (key === '\u0003' || key === 'q' || key === 'Q') {
                this.stop();
                return;
            }

            // Route input based on mode
            if (this.mode === 'client' && this.client) {
                // Send to remote host
                this.client.send(JSON.stringify({
                    t: 'input',
                    src: 'keyboard',
                    ctrl: key,
                    key: key,
                    val: 1,
                    pressed: true
                }));
            } else if (this.gamepak) {
                // Send to local gamepak
                this.gamepak.sendInput(this.slot, {
                    src: 'keyboard',
                    key: key,
                    val: 1,
                    pressed: true
                });
            }
        });
    }

    _renderStatusBar() {
        let status = `[${this.slot.toUpperCase()}]`;

        if (this.mode === 'host') {
            const remoteCount = this.host.players.size - 1;  // Minus local
            status += ` HOST :${this.port} | Remote: ${remoteCount}`;
        } else if (this.mode === 'client') {
            status += ` CLIENT -> ${this.joinUrl}`;
        }

        status += ' | Q=quit';

        process.stdout.write(`\n\x1b[36m${status}\x1b[0m`);
    }
}

// Main
async function main() {
    const args = parseArgs();

    console.log('');
    console.log('┌─────────────────────────────────────┐');
    console.log('│           C A B I N E T             │');
    console.log('└─────────────────────────────────────┘');
    console.log('');

    let gamepak = null;

    if (args.dev) {
        console.log('[cabinet] Dev mode - loading test pattern');
        gamepak = new TestPattern({ cols: 60, rows: 20 });
    } else if (args.game) {
        console.log(`[cabinet] Loading game: ${args.game}`);
        gamepak = loadGamepak(args.game);
        if (!gamepak) {
            process.exit(1);
        }
    } else if (args.mode !== 'client') {
        console.log('[cabinet] No game specified. Use --dev or --game <name>');
        console.log('');
        console.log('Usage:');
        console.log('  node cabinet.js --dev                 # Test pattern');
        console.log('  node cabinet.js --game magnetar       # Load game');
        console.log('  node cabinet.js --game magnetar --host # Host for network');
        console.log('  node cabinet.js --join ws://host:8080 # Join remote');
        console.log('');
        process.exit(0);
    }

    const cabinet = new Cabinet({
        mode: args.mode,
        port: args.port,
        join: args.join,
        http: args.http
    });

    if (gamepak) {
        cabinet.loadGame(gamepak);
    }

    // Graceful shutdown
    process.on('SIGINT', () => cabinet.stop());
    process.on('SIGTERM', () => cabinet.stop());

    console.log(`[cabinet] Mode: ${args.mode}`);
    if (args.mode === 'host') {
        console.log(`[cabinet] Hosting on ws://localhost:${args.port}`);
        console.log('[cabinet] Browser: open join.html, connect to above URL');
    }
    console.log('[cabinet] Starting in 1 second...');
    console.log('');

    setTimeout(() => {
        cabinet.start();
    }, 1000);
}

main().catch(e => {
    console.error('[cabinet] Fatal:', e);
    process.exit(1);
});
