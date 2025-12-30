#!/usr/bin/env node
/**
 * GAMMA - Game Match-Making Allocator
 *
 * Control plane service for ephemeral multiplayer sessions.
 * Creates match codes, manages player slots, integrates with midi-mp for routing.
 *
 * NOT in the data path - just sets up routing and gets out of the way.
 */

'use strict';

const http = require('http');
const dgram = require('dgram');
const net = require('net');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const Matches = require('./lib/matches');
const Codes = require('./lib/codes');
const RateLimiter = require('./lib/rate-limiter');
const GameRegistry = require('./lib/games');

// =============================================================================
// CONSTANTS
// =============================================================================

const VERSION = '1.0.0';
const DEFAULT_HTTP_PORT = 8085;
const DEFAULT_UDP_PORT = 1985;
const SOCKET_PATH = '/tmp/tetra/gamma.sock';
const STATE_DIR = process.env.GAMMA_STATE_DIR || path.join(process.env.HOME, 'tetra/gamma/state/matches');

const MIDI_MP_HOST = process.env.GAMMA_MIDI_MP_HOST || 'localhost';
const MIDI_MP_PORT = parseInt(process.env.GAMMA_MIDI_MP_PORT || '1984');

// =============================================================================
// GAMMA SERVICE
// =============================================================================

class GammaService extends EventEmitter {
    constructor(options = {}) {
        super();

        this.httpPort = options.httpPort || DEFAULT_HTTP_PORT;
        this.udpPort = options.udpPort || DEFAULT_UDP_PORT;
        this.socketPath = options.socketPath || SOCKET_PATH;

        this.matches = new Matches({ stateDir: STATE_DIR });
        this.codes = new Codes();
        this.games = new GameRegistry();

        // Rate limiters (per IP)
        this.createLimiter = new RateLimiter({ windowMs: 60000, maxRequests: 5 });   // 5 creates/min
        this.joinLimiter = new RateLimiter({ windowMs: 60000, maxRequests: 20 });    // 20 joins/min

        // Load dashboard template
        this.dashboardTemplate = fs.readFileSync(
            path.join(__dirname, 'lib/dashboard.html'),
            'utf8'
        );

        this.httpServer = null;
        this.udpServer = null;
        this.unixServer = null;
        this.wsClients = new Map();  // code -> Set of WebSocket connections

        // Stats
        this.stats = {
            matchesCreated: 0,
            playersJoined: 0,
            startTime: Date.now()
        };
    }

    async start() {
        console.log(`[gamma] Starting v${VERSION}`);

        // Load persisted matches
        this.matches.load();

        // Discover available games
        this.games.discover();

        // Handle game exits
        this.games.on('game-exit', ({ matchCode }) => {
            const match = this.matches.get(matchCode);
            if (match) {
                console.log(`[gamma] Game exited, closing match ${matchCode}`);
                this.matches.delete(matchCode);
            }
        });

        await this.startHttpServer();
        await this.startUdpServer();
        await this.startUnixServer();

        // Cleanup expired matches every 60s
        this.cleanupInterval = setInterval(() => {
            this.matches.cleanupExpired();
        }, 60000);

        console.log(`[gamma] Ready`);
        console.log(`  HTTP: http://localhost:${this.httpPort}`);
        console.log(`  UDP:  :${this.udpPort}`);
        console.log(`  Unix: ${this.socketPath}`);

        return this;
    }

    async stop() {
        console.log('[gamma] Stopping...');

        // Kill all spawned games
        this.games.shutdown();

        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
        if (this.createLimiter) this.createLimiter.stop();
        if (this.joinLimiter) this.joinLimiter.stop();
        if (this.httpServer) this.httpServer.close();
        if (this.udpServer) this.udpServer.close();
        if (this.unixServer) this.unixServer.close();

        console.log('[gamma] Stopped');
    }

    // =========================================================================
    // HTTP SERVER (REST API + WebSocket upgrade)
    // =========================================================================

    async startHttpServer() {
        return new Promise((resolve) => {
            this.httpServer = http.createServer((req, res) => {
                this.handleHttpRequest(req, res);
            });

            // WebSocket upgrade handling would go here
            // For now, just HTTP REST

            this.httpServer.listen(this.httpPort, () => {
                console.log(`[http] Listening on :${this.httpPort}`);
                resolve();
            });
        });
    }

    handleHttpRequest(req, res) {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        // Parse URL
        const url = new URL(req.url, `http://localhost:${this.httpPort}`);
        const path = url.pathname;

        // Route
        if (req.method === 'GET' && path === '/') {
            this.handleDashboard(req, res);
        } else if (req.method === 'GET' && path === '/api/status') {
            this.handleStatus(req, res);
        } else if (req.method === 'GET' && path === '/api/matches') {
            this.handleListMatches(req, res);
        } else if (req.method === 'GET' && path.startsWith('/api/match/')) {
            const code = path.split('/')[3];
            this.handleGetMatch(req, res, code);
        } else if (req.method === 'POST' && path === '/api/match/create') {
            this.handleCreate(req, res);
        } else if (req.method === 'POST' && path === '/api/match/join') {
            this.handleJoin(req, res);
        } else if (req.method === 'POST' && path === '/api/match/leave') {
            this.handleLeave(req, res);
        } else if (req.method === 'POST' && path === '/api/match/close') {
            this.handleClose(req, res);
        } else if (req.method === 'GET' && path === '/api/lobby') {
            this.handleLobby(req, res, url.searchParams.get('game'));
        } else if (req.method === 'GET' && path === '/api/games') {
            this.handleListGames(req, res);
        } else if (req.method === 'GET' && path === '/api/games/processes') {
            this.handleListProcesses(req, res);
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found' }));
        }
    }

    // Dashboard HTML
    handleDashboard(req, res) {
        const matches = this.matches.listAll();

        // Build matches table or empty message
        let matchesContent;
        if (matches.length === 0) {
            matchesContent = '<p class="empty">No active matches</p>';
        } else {
            const rows = matches.map(m => `
                <tr>
                    <td><code>${m.code}</code></td>
                    <td>${m.game}</td>
                    <td>${m.playerCount}/${m.maxPlayers}</td>
                    <td>${m.host.transport}</td>
                    <td>${this.formatExpiry(m.expires)}</td>
                </tr>`).join('');

            matchesContent = `
    <table>
        <thead>
            <tr><th>Code</th><th>Game</th><th>Players</th><th>Transport</th><th>Expires</th></tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>`;
        }

        // Render template with values
        const html = this.dashboardTemplate
            .replace('{{VERSION}}', VERSION)
            .replace('{{ACTIVE_MATCHES}}', matches.length)
            .replace('{{TOTAL_CREATED}}', this.stats.matchesCreated)
            .replace('{{PLAYERS_JOINED}}', this.stats.playersJoined)
            .replace('{{UPTIME}}', this.formatUptime())
            .replace('{{MATCHES_CONTENT}}', matchesContent);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }

    formatUptime() {
        const ms = Date.now() - this.stats.startTime;
        const hours = Math.floor(ms / 3600000);
        const mins = Math.floor((ms % 3600000) / 60000);
        return `${hours}h ${mins}m`;
    }

    formatExpiry(timestamp) {
        const remaining = timestamp - Date.now();
        if (remaining < 0) return 'expired';
        const mins = Math.floor(remaining / 60000);
        if (mins < 60) return `${mins}m`;
        return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    }

    // API Handlers
    handleStatus(req, res) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            version: VERSION,
            matches: this.matches.count(),
            stats: this.stats,
            uptime: Date.now() - this.stats.startTime
        }));
    }

    handleListMatches(req, res) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.matches.listAll()));
    }

    handleGetMatch(req, res, code) {
        const match = this.matches.get(code);
        if (!match) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Match not found' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(match.toPublic()));
    }

    async handleCreate(req, res) {
        // Rate limit by IP
        const clientIp = req.socket.remoteAddress || 'unknown';
        const rateCheck = this.createLimiter.check(clientIp);

        if (!rateCheck.allowed) {
            res.writeHead(429, {
                'Content-Type': 'application/json',
                'Retry-After': Math.ceil(rateCheck.resetMs / 1000)
            });
            res.end(JSON.stringify({ error: 'Too many requests', retryAfter: rateCheck.resetMs }));
            return;
        }

        const body = await this.readBody(req);

        try {
            const data = JSON.parse(body);
            const { game, slots = 2, transport = 'udp', addr, public: isPublic = false, spawn = false } = data;

            if (!game || typeof game !== 'string') {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'game is required' }));
                return;
            }

            // Check if game exists in registry (when spawning)
            const gameInfo = this.games.get(game);
            if (spawn && !gameInfo) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: `Unknown game: ${game}`,
                    available: this.games.list().map(g => g.id)
                }));
                return;
            }

            const maxPlayers = Math.max(2, Math.min(16, parseInt(slots, 10) || 2));

            // Generate unique code
            const code = this.codes.generate(key => this.matches.has(key));

            // Spawn game if requested
            let spawnResult = null;
            let matchAddr = addr || `localhost:${7300 + this.stats.matchesCreated}`;

            if (spawn) {
                try {
                    spawnResult = this.games.spawn(game, code);
                    matchAddr = `localhost:${spawnResult.port}`;
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: `Failed to spawn game: ${e.message}` }));
                    return;
                }
            }

            // Create match
            const match = this.matches.create({
                code,
                game,
                maxPlayers,
                transport,
                addr: matchAddr,
                public: isPublic,
                pid: spawnResult?.pid || null
            });

            this.stats.matchesCreated++;

            // Register with midi-mp
            await this.syncWithMidiMp('register', match);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                code: match.code,
                token: match.hostToken,
                topic: match.topic,
                expires: match.expires,
                addr: matchAddr,
                pid: spawnResult?.pid || null
            }));

            this.emit('match-created', match);

        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
    }

    async handleJoin(req, res) {
        // Rate limit by IP
        const clientIp = req.socket.remoteAddress || 'unknown';
        const rateCheck = this.joinLimiter.check(clientIp);

        if (!rateCheck.allowed) {
            res.writeHead(429, {
                'Content-Type': 'application/json',
                'Retry-After': Math.ceil(rateCheck.resetMs / 1000)
            });
            res.end(JSON.stringify({ error: 'Too many requests', retryAfter: rateCheck.resetMs }));
            return;
        }

        const body = await this.readBody(req);

        try {
            const data = JSON.parse(body);
            const { code, name } = data;

            if (!code) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'code is required' }));
                return;
            }

            const match = this.matches.get(code.toUpperCase());
            if (!match) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Match not found' }));
                return;
            }

            const result = match.join(name);
            if (result.error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: result.error }));
                return;
            }

            this.stats.playersJoined++;
            this.matches.update(match);

            // Register player route with midi-mp
            await this.syncWithMidiMp('register', match, result.slot);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                slot: result.slot,
                token: result.token,
                host: match.host.addr,
                topic: `${match.topic}/${result.slot}`,
                game: match.game
            }));

            this.emit('player-joined', { match, slot: result.slot });

        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
    }

    async handleLeave(req, res) {
        const body = await this.readBody(req);

        try {
            const data = JSON.parse(body);
            const { code, token } = data;

            if (!code || !token) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'code and token are required' }));
                return;
            }

            const match = this.matches.get(code.toUpperCase());
            if (!match) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Match not found' }));
                return;
            }

            const slot = match.leave(token);
            if (!slot) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid token' }));
                return;
            }

            this.matches.update(match);

            // Unregister from midi-mp
            await this.syncWithMidiMp('unregister', match, slot);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));

            this.emit('player-left', { match, slot });

        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
    }

    async handleClose(req, res) {
        const body = await this.readBody(req);

        try {
            const data = JSON.parse(body);
            const { code, token } = data;

            if (!code || !token) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'code and token are required' }));
                return;
            }

            const upperCode = code.toUpperCase();
            const match = this.matches.get(upperCode);
            if (!match) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Match not found' }));
                return;
            }

            if (token !== match.hostToken) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not authorized' }));
                return;
            }

            // Kill spawned game if any
            if (match.pid) {
                this.games.kill(match.pid);
            }

            // Unregister all from midi-mp
            await this.unregisterMatch(match);

            this.matches.delete(upperCode);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));

            this.emit('match-closed', match);

        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
    }

    handleLobby(req, res, game) {
        const matches = this.matches.listPublic(game);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(matches));
    }

    // List available games (from registry)
    handleListGames(req, res) {
        const games = this.games.list().map(g => ({
            id: g.id,
            name: g.name,
            org: g.org,
            players: g.players,
            engine: g.engine
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(games));
    }

    // List running game processes
    handleListProcesses(req, res) {
        const processes = this.games.listProcesses();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(processes));
    }

    readBody(req, maxSize = 4096) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk;
                if (body.length > maxSize) {
                    req.destroy();
                    reject(new Error('Payload too large'));
                }
            });
            req.on('end', () => resolve(body));
            req.on('error', reject);
        });
    }

    // =========================================================================
    // UDP SERVER (for quick status checks)
    // =========================================================================

    async startUdpServer() {
        return new Promise((resolve) => {
            this.udpServer = dgram.createSocket('udp4');

            this.udpServer.on('message', (msg, rinfo) => {
                this.handleUdpMessage(msg.toString().trim(), rinfo);
            });

            this.udpServer.bind(this.udpPort, () => {
                console.log(`[udp] Listening on :${this.udpPort}`);
                resolve();
            });
        });
    }

    handleUdpMessage(msg, rinfo) {
        // Simple text protocol for CLI
        const [cmd, ...args] = msg.split(' ');
        let response;

        switch (cmd) {
            case 'status':
                response = `OK ${this.matches.count()} matches`;
                break;
            case 'list':
                response = this.matches.listAll().map(m => `${m.code} ${m.game} ${m.playerCount}/${m.maxPlayers}`).join('\n') || 'none';
                break;
            case 'get':
                const match = this.matches.get(args[0]?.toUpperCase());
                response = match ? JSON.stringify(match.toPublic()) : 'not found';
                break;
            default:
                response = 'unknown command';
        }

        this.udpServer.send(response, rinfo.port, rinfo.address);
    }

    // =========================================================================
    // UNIX SOCKET SERVER (for local CLI)
    // =========================================================================

    async startUnixServer() {
        // Ensure directory exists
        const dir = path.dirname(this.socketPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Remove old socket
        if (fs.existsSync(this.socketPath)) {
            fs.unlinkSync(this.socketPath);
        }

        return new Promise((resolve) => {
            this.unixServer = net.createServer((socket) => {
                socket.on('data', async (data) => {
                    const response = await this.handleUnixCommand(data.toString().trim());
                    socket.write(response + '\n');
                });
            });

            this.unixServer.listen(this.socketPath, () => {
                console.log(`[unix] Listening on ${this.socketPath}`);
                resolve();
            });
        });
    }

    async handleUnixCommand(line) {
        try {
            const cmd = JSON.parse(line);

            switch (cmd.type) {
                case 'create':
                    const match = this.matches.create({
                        code: this.codes.generate(key => this.matches.has(key)),
                        game: cmd.game,
                        maxPlayers: cmd.slots || 2,
                        transport: cmd.transport || 'udp',
                        addr: cmd.addr
                    });
                    this.stats.matchesCreated++;
                    // Register async (don't block response)
                    this.syncWithMidiMp('register', match);
                    return JSON.stringify({ code: match.code, token: match.hostToken });

                case 'join':
                    const m = this.matches.get(cmd.code?.toUpperCase());
                    if (!m) return JSON.stringify({ error: 'not found' });
                    const result = m.join(cmd.name);
                    if (result.error) return JSON.stringify({ error: result.error });
                    this.stats.playersJoined++;
                    this.matches.update(m);
                    // Register async (don't block response)
                    this.syncWithMidiMp('register', m, result.slot);
                    return JSON.stringify({ slot: result.slot, token: result.token, host: m.host.addr });

                case 'leave':
                    const m2 = this.matches.get(cmd.code?.toUpperCase());
                    if (!m2) return JSON.stringify({ error: 'not found' });
                    const slot = m2.leave(cmd.token);
                    if (slot) {
                        this.matches.update(m2);
                        // Unregister async (don't block response)
                        this.syncWithMidiMp('unregister', m2, slot);
                    }
                    return JSON.stringify({ ok: !!slot });

                case 'close':
                    const closeCode = cmd.code?.toUpperCase();
                    const m3 = this.matches.get(closeCode);
                    if (!m3) return JSON.stringify({ error: 'not found' });
                    if (cmd.token !== m3.hostToken) return JSON.stringify({ error: 'not authorized' });
                    // Unregister async (don't block response)
                    this.unregisterMatch(m3);
                    this.matches.delete(closeCode);
                    return JSON.stringify({ ok: true });

                case 'list':
                    return JSON.stringify(this.matches.listAll());

                case 'status':
                    return JSON.stringify({ matches: this.matches.count(), stats: this.stats });

                default:
                    return JSON.stringify({ error: 'unknown command' });
            }
        } catch (e) {
            return JSON.stringify({ error: e.message });
        }
    }

    // =========================================================================
    // MIDI-MP INTEGRATION
    // =========================================================================

    async syncWithMidiMp(action, match, slot = null) {
        const name = slot ? `${match.code}-${slot}` : `gamma-${match.code}`;
        const topic = slot ? `${match.topic}/${slot}` : match.topic;

        const msg = { _proto: 'tdp', _v: 1, type: action, name };

        if (action === 'register') {
            msg.topic = topic;
            if (slot) {
                msg.subscribe = [
                    'tetra/gamepad/+/*',
                    'tetra/hand/+/*',
                    'tetra/midi/+/1/cc/*'
                ];
                msg.forward_to = match.host.addr;
            } else {
                msg.transport = match.host.transport;
                msg.address = match.host.addr;
            }
        }

        return this.sendToMidiMp(JSON.stringify(msg));
    }

    async unregisterMatch(match) {
        // Unregister all slots then match itself
        for (const slot of Object.keys(match.slots)) {
            await this.syncWithMidiMp('unregister', match, slot);
        }
        return this.syncWithMidiMp('unregister', match);
    }

    sendToMidiMp(msg) {
        return new Promise((resolve) => {
            const client = dgram.createSocket('udp4');
            client.send(msg, MIDI_MP_PORT, MIDI_MP_HOST, (err) => {
                client.close();
                if (err) {
                    console.error('[gamma] midi-mp send error:', err.message);
                }
                resolve();
            });
        });
    }
}

// =============================================================================
// CLI
// =============================================================================

function printUsage() {
    console.log(`
GAMMA v${VERSION} - Game Match-Making Allocator

Usage:
  gamma [options]

Options:
  --http-port, -p <port>  HTTP port (default: ${DEFAULT_HTTP_PORT})
  --udp-port, -u <port>   UDP port (default: ${DEFAULT_UDP_PORT})
  --help, -h              Show this help

Environment:
  GAMMA_MIDI_MP_HOST      midi-mp host (default: localhost)
  GAMMA_MIDI_MP_PORT      midi-mp port (default: 1984)

Examples:
  gamma                   Start with defaults
  gamma -p 9000           Start on HTTP port 9000

Dashboard:
  http://localhost:${DEFAULT_HTTP_PORT}/

API:
  POST /api/match/create  { game, slots, transport, addr }
  POST /api/match/join    { code }
  POST /api/match/leave   { code, token }
  POST /api/match/close   { code, token }
  GET  /api/match/:code   Get match info
  GET  /api/lobby?game=   List public matches
`);
}

async function main() {
    const args = process.argv.slice(2);

    let httpPort = DEFAULT_HTTP_PORT;
    let udpPort = DEFAULT_UDP_PORT;

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--http-port':
            case '-p':
                httpPort = parseInt(args[++i]);
                break;
            case '--udp-port':
            case '-u':
                udpPort = parseInt(args[++i]);
                break;
            case '--help':
            case '-h':
                printUsage();
                process.exit(0);
        }
    }

    const gamma = new GammaService({ httpPort, udpPort });

    process.on('SIGINT', async () => {
        await gamma.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        await gamma.stop();
        process.exit(0);
    });

    await gamma.start();
}

if (require.main === module) {
    main().catch(e => {
        console.error('Fatal:', e);
        process.exit(1);
    });
}

module.exports = { GammaService };
