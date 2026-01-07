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
const CABINET_PORT = process.env.CABINET_PORT ? parseInt(process.env.CABINET_PORT, 10) : null;

// CLI Commands definition for tab completion support
const CLI_COMMANDS = {
    dev: { desc: 'Run test pattern in dev mode', subcommands: null },
    host: { desc: 'Host a game for network play', subcommands: '<game>' },
    join: { desc: 'Join a remote cabinet', subcommands: '<url|code>' },
    games: { desc: 'List available games', subcommands: null },
    help: { desc: 'Show help for a command', subcommands: '<command>' }
};

// List available games in GAMES_DIR
function listGames() {
    const games = [];
    if (fs.existsSync(GAMES_DIR)) {
        for (const name of fs.readdirSync(GAMES_DIR)) {
            const driverPath = path.join(GAMES_DIR, name, `${name}_driver.js`);
            if (fs.existsSync(driverPath)) {
                games.push(name);
            }
        }
    }
    return games;
}

// Parse subcommand-based arguments (TSM-style)
function parseArgs() {
    const args = {
        command: null,   // dev, host, join, games, help
        mode: 'local',   // local, host, client
        game: null,
        dev: false,
        port: CABINET_PORT,  // null unless CABINET_PORT env or --port flag
        join: null,      // WebSocket URL to join
        code: null,      // Match code to resolve via gamma
        gammaUrl: 'http://localhost:8085',  // Gamma API URL
        gamma: false,
        http: false,     // Serve HTTP for browser access
        headless: false  // Run without local console player (server mode)
    };

    const argv = process.argv.slice(2);
    if (argv.length === 0) {
        args.command = 'help';
        return args;
    }

    // Handle --complete for bash tab completion
    if (argv[0] === '--complete') {
        handleComplete(argv.slice(1));
        process.exit(0);
    }

    // First positional arg is the command
    const cmd = argv[0];
    let i = 1;

    // Parse based on command
    switch (cmd) {
        case 'dev':
            args.command = 'dev';
            args.dev = true;
            args.mode = 'host';
            args.http = true;
            break;

        case 'host':
            args.command = 'host';
            args.mode = 'host';
            // Next positional is game name
            if (argv[i] && !argv[i].startsWith('-')) {
                args.game = argv[i];
                i++;
            }
            break;

        case 'join':
            args.command = 'join';
            args.mode = 'client';
            // Next positional is URL or code
            if (argv[i] && !argv[i].startsWith('-')) {
                const target = argv[i];
                i++;
                if (target.startsWith('ws://') || target.startsWith('wss://')) {
                    args.join = target;
                } else {
                    args.code = target;
                }
            }
            break;

        case 'games':
            args.command = 'games';
            return args;

        case 'help':
        case '-h':
        case '--help':
            args.command = 'help';
            args.helpTopic = argv[i] || null;
            return args;

        default:
            // Legacy flag-based support for backwards compatibility
            if (cmd.startsWith('-')) {
                return parseLegacyArgs();
            }
            console.error(`Unknown command: ${cmd}`);
            args.command = 'help';
            return args;
    }

    // Parse remaining options
    while (i < argv.length) {
        const arg = argv[i];
        const next = argv[i + 1];

        switch (arg) {
            case '--port':
            case '-p':
                args.port = parseInt(next, 10);
                i += 2;
                break;
            case '--http':
                args.http = true;
                i++;
                break;
            case '--headless':
            case '--server':
                args.headless = true;
                i++;
                break;
            case '--match-code':
            case '-m':
                args.matchCode = next;
                i += 2;
                break;
            case '--max-players':
            case '--players':
                args.maxPlayers = parseInt(next, 10);
                i += 2;
                break;
            case '--gamma':
                args.gamma = true;
                i++;
                break;
            case '--gamma-url':
                args.gammaUrl = next;
                i += 2;
                break;
            default:
                i++;
        }
    }

    return args;
}

// Legacy --flag based argument parsing for backwards compatibility
function parseLegacyArgs() {
    const args = {
        command: 'legacy',
        mode: 'local',
        game: null,
        dev: false,
        port: CABINET_PORT,  // null unless CABINET_PORT env or --port flag
        join: null,
        code: null,
        gammaUrl: 'http://localhost:8085',
        gamma: false,
        http: false,
        headless: false
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
            case '--code':
            case '-c':
                args.code = next;
                args.mode = 'client';
                i++;
                break;
            case '--gamma-url':
                args.gammaUrl = next;
                i++;
                break;
            case '--match-code':
            case '-m':
                args.matchCode = next;
                i++;
                break;
            case '--max-players':
            case '--players':
                args.maxPlayers = parseInt(next, 10);
                i++;
                break;
            case '--headless':
            case '--server':
                args.headless = true;
                break;
        }
    }

    if (args.dev && args.mode === 'local') {
        args.mode = 'host';
        args.http = true;
    }

    return args;
}

// Handle --complete for bash tab completion
function handleComplete(words) {
    const word = words[0] || '';
    const prev = words[1] || '';
    const position = parseInt(words[2] || '1', 10);

    let completions = [];

    if (position === 1) {
        // Complete commands
        completions = Object.keys(CLI_COMMANDS);
    } else if (position === 2) {
        // Context-sensitive completion
        switch (prev) {
            case 'host':
                completions = listGames();
                break;
            case 'help':
                completions = Object.keys(CLI_COMMANDS);
                break;
            case 'join':
                // Could list known hosts or recent connections
                completions = [];
                break;
        }
    } else if (position >= 3) {
        // Options completion
        completions = ['--port', '--http', '--headless', '--max-players', '--match-code'];
    }

    // Filter by current word
    if (word) {
        completions = completions.filter(c => c.startsWith(word));
    }

    console.log(completions.join('\n'));
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

// Resolve match code to WebSocket URL via gamma API
async function resolveMatchCode(code, gammaUrl) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${gammaUrl}/api/match/join`);
        const postData = JSON.stringify({ code: code.toUpperCase() });

        const req = http.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.error) {
                        reject(new Error(json.error));
                    } else if (json.host) {
                        const wsUrl = json.host.startsWith('ws://')
                            ? json.host
                            : `ws://${json.host}`;
                        resolve(wsUrl);
                    } else {
                        reject(new Error('No host in response'));
                    }
                } catch (e) {
                    reject(new Error(`Invalid response: ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
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

// Simple HTTP server for serving cabinet.html
function createHttpServer(port, cabinetDir) {
    const MIME_TYPES = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.woff2': 'font/woff2'
    };

    const server = http.createServer((req, res) => {
        // Parse URL to get pathname (strip query string)
        const urlPath = req.url.split('?')[0];

        // Strip /cabinet/ prefix if present
        let filePath = urlPath.replace(/^\/cabinet/, '') || '/';
        filePath = filePath === '/' ? '/gamma-cabinet.html' : filePath;
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
        this.headless = options.headless || false;
        this.maxPlayers = options.maxPlayers || 4;

        this.gamepak = null;
        this.host = null;
        this.client = null;
        this.httpServer = null;
        this.display = new ConsoleDisplay();
        this.slot = this.headless ? null : 'p1';  // Our slot when playing (null if headless)
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
            server: this.httpServer,  // Pass HTTP server for WebSocket to attach to
            maxPlayers: this.maxPlayers
        });

        // Reserve P1 slot for local console (only if not headless)
        if (!this.headless) {
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
        }

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
            console.log('[cabinet] Connected! Sending identity...');
            // Send identify to get assigned a slot
            this.client.send(JSON.stringify({
                t: 'identify',
                cid: `cli_${process.pid}`,
                nick: process.env.USER || 'CLI',
                visits: 1,
                requestSlot: '',  // Auto-assign
                takeover: false
            }));
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
        // Skip console setup in headless mode
        if (this.headless) {
            console.log('[cabinet] Running in headless mode (no local console)');
            // Just handle SIGINT for clean shutdown
            process.on('SIGINT', () => this.stop());
            return;
        }

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
            } else if (this.gamepak && this.slot) {
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
        if (this.headless) return;  // No status bar in headless mode

        let status = `[${(this.slot || 'HOST').toUpperCase()}]`;

        if (this.mode === 'host') {
            const localCount = this.headless ? 0 : 1;
            const remoteCount = this.host.players.size - localCount;
            status += ` HOST :${this.port} | Players: ${this.host.players.size}`;
        } else if (this.mode === 'client') {
            status += ` CLIENT -> ${this.joinUrl}`;
        }

        status += ' | Q=quit';

        process.stdout.write(`\n\x1b[36m${status}\x1b[0m`);
    }
}

// Show help
function showHelp(topic = null) {
    if (topic && CLI_COMMANDS[topic]) {
        const cmd = CLI_COMMANDS[topic];
        console.log(`cabinet ${topic} ${cmd.subcommands || ''}`);
        console.log(`  ${cmd.desc}`);
        console.log('');
        switch (topic) {
            case 'dev':
                console.log('Options:');
                console.log('  --port, -p N       Port number (REQUIRED)');
                console.log('  --headless         Run as server (no local console)');
                console.log('  --match-code CODE  Display match code in game');
                console.log('  --max-players N    Max player slots (default: 4)');
                break;
            case 'host':
                console.log('Options:');
                console.log('  --port, -p N       Port number (REQUIRED)');
                console.log('  --http             Serve gamma-cabinet.html for browser access');
                console.log('  --headless         Run as server (no local console)');
                console.log('  --match-code CODE  Display match code in game');
                console.log('  --max-players N    Max player slots (default: 4)');
                break;
            case 'join':
                console.log('Arguments:');
                console.log('  <url>   WebSocket URL (ws://host:port)');
                console.log('  <code>  4-character match code via gamma');
                break;
            case 'games':
                console.log('Lists all available games in the games directory.');
                break;
        }
        return;
    }

    console.log('cabinet - Universal game cabinet');
    console.log('');
    console.log('COMMANDS');
    console.log('  dev                   Run test pattern in dev mode');
    console.log('  host <game>           Host a game for network play');
    console.log('  join <url|code>       Join a remote cabinet');
    console.log('  games                 List available games');
    console.log('  help [command]        Show help for a command');
    console.log('');
    console.log('EXAMPLES');
    console.log('  cabinet dev --port 8090');
    console.log('  cabinet dev --port 8090 --headless');
    console.log('  cabinet host magnetar --port 8090');
    console.log('  cabinet host magnetar --port 8090 --http');
    console.log('  cabinet join ws://192.168.1.5:8090');
    console.log('  cabinet join Z9A7               # Join by match code');
    console.log('');
    console.log('OPTIONS');
    console.log('  --port, -p N          Port number (REQUIRED for dev/host)');
    console.log('  --headless            Run without local console player');
    console.log('  --http                Serve gamma-cabinet.html for browser access');
    console.log('  --max-players N       Max player slots (default: 4)');
    console.log('  --match-code CODE     Display match code in game');
    console.log('');
    console.log('ENVIRONMENT');
    console.log('  CABINET_PORT          Default port if --port not specified');
}

// Main
async function main() {
    const args = parseArgs();

    // Handle non-game commands
    if (args.command === 'help') {
        showHelp(args.helpTopic);
        process.exit(0);
    }

    if (args.command === 'games') {
        const games = listGames();
        if (games.length === 0) {
            console.log('No games found in ' + GAMES_DIR);
        } else {
            console.log('Available games:');
            for (const game of games) {
                console.log('  ' + game);
            }
        }
        process.exit(0);
    }

    // Require --port for host mode (dev, host commands)
    if (args.mode === 'host' && !args.port) {
        console.error('[cabinet] ERROR: --port is required for hosting');
        console.error('');
        console.error('Usage:');
        console.error('  cabinet dev --port 8090');
        console.error('  cabinet host magnetar --port 8090');
        console.error('');
        console.error('Or set CABINET_PORT environment variable');
        process.exit(1);
    }

    console.log('');
    console.log('┌─────────────────────────────────────┐');
    console.log('│           C A B I N E T             │');
    console.log('└─────────────────────────────────────┘');
    console.log('');

    let gamepak = null;

    if (args.dev) {
        console.log('[cabinet] Dev mode - loading test pattern');
        gamepak = new TestPattern({
            cols: 60,
            rows: 24,
            matchCode: args.matchCode,
            port: args.port,
            maxPlayers: args.maxPlayers || 4
        });
    } else if (args.game) {
        console.log(`[cabinet] Loading game: ${args.game}`);
        gamepak = loadGamepak(args.game);
        if (!gamepak) {
            process.exit(1);
        }
    } else if (args.mode !== 'client') {
        showHelp();
        process.exit(0);
    }

    // Resolve match code to WebSocket URL
    if (args.code) {
        console.log(`[cabinet] Resolving match code: ${args.code}`);
        try {
            args.join = await resolveMatchCode(args.code, args.gammaUrl);
            console.log(`[cabinet] Resolved to: ${args.join}`);
        } catch (e) {
            console.error(`[cabinet] Failed to resolve code: ${e.message}`);
            process.exit(1);
        }
    }

    const cabinet = new Cabinet({
        mode: args.mode,
        port: args.port,
        join: args.join,
        http: args.http,
        headless: args.headless,
        maxPlayers: args.maxPlayers || 4
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
        console.log('[cabinet] Browser: open gamma-cabinet.html, connect to above URL');
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
