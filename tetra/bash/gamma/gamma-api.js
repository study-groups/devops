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

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// Core modules
const Matches = require('./lib/matches');
const Codes = require('./lib/codes');
const GameRegistry = require('./lib/games');
const RateLimiter = require('./lib/rate-limiter');
const { PortAllocator } = require('./lib/ports');

// API servers
const { createHttpServer } = require('./lib/api/http');
const { createUdpServer } = require('./lib/api/udp');
const { createUnixServer } = require('./lib/api/unix');

// Integrations
const { MidiMpClient } = require('./lib/integrations/midi-mp');
const { WebhookSender } = require('./lib/integrations/webhooks');

// TSM runtime visibility
const tsm = (d) => process.env.TSM_PROCESS_DIR &&
    fs.writeFileSync(path.join(process.env.TSM_PROCESS_DIR, 'runtime.json'), JSON.stringify(d));

// =============================================================================
// CONSTANTS
// =============================================================================

const VERSION = '1.1.0';
const DEFAULT_HTTP_PORT = 1980;
const DEFAULT_UDP_PORT = 1985;
const SOCKET_PATH = '/tmp/tetra/gamma.sock';
const STATE_DIR = process.env.GAMMA_STATE_DIR || path.join(process.env.HOME, 'tetra/gamma/state/matches');

// =============================================================================
// GAMMA SERVICE
// =============================================================================

class GammaService extends EventEmitter {
    constructor(options = {}) {
        super();

        this.httpPort = options.httpPort || DEFAULT_HTTP_PORT;
        this.udpPort = options.udpPort || DEFAULT_UDP_PORT;
        this.socketPath = options.socketPath || SOCKET_PATH;

        // Core components
        this.matches = new Matches({ stateDir: STATE_DIR });
        this.codes = new Codes();
        this.games = new GameRegistry();
        this.ports = new PortAllocator();

        // Rate limiters
        this.createLimiter = new RateLimiter({ windowMs: 60000, maxRequests: 5 });
        this.joinLimiter = new RateLimiter({ windowMs: 60000, maxRequests: 20 });

        // Integrations
        this.midiMp = new MidiMpClient(
            process.env.GAMMA_MIDI_MP_HOST,
            parseInt(process.env.GAMMA_MIDI_MP_PORT || '1984')
        );
        this.webhooks = new WebhookSender(process.env.GAMMA_STATS_WEBHOOK);

        // Dashboard template
        this.dashboardTemplate = fs.readFileSync(
            path.join(__dirname, 'lib/dashboard.html'),
            'utf8'
        );

        // Servers
        this.httpServer = null;
        this.udpServer = null;
        this.unixServer = null;

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
        this.ports.sync(this.matches.listAll());
        this.games.discover();

        // Handle game exits
        this.games.on('game-exit', ({ matchCode }) => {
            const match = this.matches.get(matchCode);
            if (match) {
                console.log(`[gamma] Game exited, closing match ${matchCode}`);
                this.matches.delete(matchCode);
            }
        });

        // Attach webhook listeners
        this.webhooks.attachToService(this);

        // Build context for handlers
        const ctx = this._buildContext();

        // Start servers
        this.httpServer = await createHttpServer(ctx, this.httpPort);
        this.udpServer = await createUdpServer(ctx, this.udpPort);
        this.unixServer = await createUnixServer(ctx, this.socketPath);

        // Cleanup expired matches every 60s
        this.cleanupInterval = setInterval(() => {
            const expired = this.matches.cleanupExpired();
            for (const match of expired) {
                if (match.port) {
                    this.ports.release(match.port);
                    console.log(`[gamma] Match ${match.code} expired (port ${match.port} released)`);
                }
            }
        }, 60000);

        console.log(`[gamma] Ready`);
        console.log(`  HTTP: http://localhost:${this.httpPort}`);
        console.log(`  UDP:  :${this.udpPort}`);
        console.log(`  Unix: ${this.socketPath}`);

        return this;
    }

    async stop() {
        console.log('[gamma] Stopping...');

        this.games.shutdown();

        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
        if (this.createLimiter) this.createLimiter.stop();
        if (this.joinLimiter) this.joinLimiter.stop();
        if (this.httpServer) this.httpServer.close();
        if (this.udpServer) this.udpServer.close();
        if (this.unixServer) this.unixServer.close();

        console.log('[gamma] Stopped');
    }

    /**
     * Build context object passed to all handlers
     */
    _buildContext() {
        return {
            matches: this.matches,
            codes: this.codes,
            games: this.games,
            ports: this.ports,
            createLimiter: this.createLimiter,
            joinLimiter: this.joinLimiter,
            stats: this.stats,
            dashboardTemplate: this.dashboardTemplate,

            // Methods
            emit: this.emit.bind(this),
            syncWithMidiMp: this.midiMp.sync.bind(this.midiMp),
            unregisterMatch: this.midiMp.unregisterMatch.bind(this.midiMp),
            updateRuntime: this._updateRuntime.bind(this)
        };
    }

    _updateRuntime() {
        tsm({
            matches: this.matches.count(),
            active: this.matches.listAll().filter(m => m.players?.length > 0).length,
            stats: { created: this.stats.matchesCreated, joined: this.stats.playersJoined },
            uptime: Math.floor((Date.now() - this.stats.startTime) / 1000),
            updated: Date.now()
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
  GAMMA_STATS_WEBHOOK     Stats collector URL (optional)

Examples:
  gamma                   Start with defaults
  gamma -p 9000           Start on HTTP port 9000

Dashboard:
  http://localhost:${DEFAULT_HTTP_PORT}/
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

module.exports = { GammaService, VERSION };
