/**
 * GAMMA Game Registry
 *
 * Discovers games from $TETRA_DIR/orgs/<org>/games/<game>/game.toml
 * Spawns game processes and tracks PIDs
 */

'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// Simple TOML parser (handles our subset)
function parseToml(content) {
    const result = {};
    let currentSection = result;

    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        // Section header
        const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
        if (sectionMatch) {
            const section = sectionMatch[1];
            result[section] = result[section] || {};
            currentSection = result[section];
            continue;
        }

        // Key = value
        const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
        if (kvMatch) {
            let value = kvMatch[2].trim();
            // Remove quotes
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            // Parse numbers
            else if (/^\d+$/.test(value)) {
                value = parseInt(value, 10);
            }
            currentSection[kvMatch[1]] = value;
        }
    }

    return result;
}

class GameRegistry extends EventEmitter {
    constructor(options = {}) {
        super();

        this.tetraDir = options.tetraDir || process.env.TETRA_DIR ||
            path.join(process.env.HOME, 'tetra');

        // game id -> game info
        this.games = new Map();

        // pid -> { game, match, process }
        this.processes = new Map();
    }

    /**
     * Discover games from orgs/*/games/*/game.toml
     */
    discover() {
        const orgsDir = path.join(this.tetraDir, 'orgs');

        if (!fs.existsSync(orgsDir)) {
            console.log('[games] No orgs directory found');
            return;
        }

        let count = 0;

        for (const org of fs.readdirSync(orgsDir)) {
            const gamesDir = path.join(orgsDir, org, 'games');
            if (!fs.existsSync(gamesDir)) continue;

            for (const gameName of fs.readdirSync(gamesDir)) {
                const gameDir = path.join(gamesDir, gameName);
                const tomlPath = path.join(gameDir, 'game.toml');

                if (!fs.existsSync(tomlPath)) continue;

                try {
                    const content = fs.readFileSync(tomlPath, 'utf8');
                    const config = parseToml(content);

                    // Support both [game] section and top-level fields
                    const g = config.game || config;
                    const gameId = g.id || gameName;

                    if (!gameId) continue;

                    const game = {
                        id: gameId,
                        name: g.name || gameId,
                        description: g.description || '',
                        org,
                        dir: gameDir,
                        entry: g.entry || g.repl,
                        port: g.port,
                        engine: g.engine || 'gamepak',
                        players: config.settings?.players || g.players || 2,
                        settings: config.settings || {},
                        geometry: {
                            width: config.settings?.arena_width || 60,
                            height: config.settings?.arena_height || 24
                        }
                    };

                    this.games.set(game.id, game);
                    count++;

                } catch (e) {
                    console.error(`[games] Error loading ${tomlPath}: ${e.message}`);
                }
            }
        }

        console.log(`[games] Discovered ${count} games`);
        return count;
    }

    /**
     * Get game info
     */
    get(gameId) {
        return this.games.get(gameId);
    }

    /**
     * List all games
     */
    list() {
        return Array.from(this.games.values());
    }

    /**
     * Spawn a game instance for a match
     * Returns { pid, port } or throws
     */
    spawn(gameId, matchCode, options = {}) {
        const game = this.games.get(gameId);
        if (!game) {
            throw new Error(`Unknown game: ${gameId}`);
        }

        if (!game.entry) {
            throw new Error(`Game ${gameId} has no entry point`);
        }

        // Allocate port (use game default or find available)
        const port = options.port || game.port || this.findAvailablePort(8100, 8199);

        const entryPath = path.join(game.dir, game.entry);

        if (!fs.existsSync(entryPath)) {
            throw new Error(`Entry not found: ${entryPath}`);
        }

        console.log(`[games] Spawning ${gameId} for match ${matchCode} on port ${port}`);

        // Spawn the game process
        const env = {
            ...process.env,
            GAME_PORT: port.toString(),
            MATCH_CODE: matchCode,
            GAMMA_MANAGED: '1'
        };

        const child = spawn(entryPath, [], {
            cwd: game.dir,
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false
        });

        const pid = child.pid;

        // Track the process
        this.processes.set(pid, {
            game: gameId,
            matchCode,
            port,
            process: child,
            startedAt: Date.now()
        });

        // Handle output
        child.stdout.on('data', (data) => {
            console.log(`[${gameId}:${matchCode}] ${data.toString().trim()}`);
        });

        child.stderr.on('data', (data) => {
            console.error(`[${gameId}:${matchCode}] ${data.toString().trim()}`);
        });

        // Handle exit
        child.on('exit', (code, signal) => {
            console.log(`[games] ${gameId}:${matchCode} exited (code=${code}, signal=${signal})`);
            this.processes.delete(pid);
            this.emit('game-exit', { gameId, matchCode, pid, code, signal });
        });

        child.on('error', (err) => {
            console.error(`[games] ${gameId}:${matchCode} error: ${err.message}`);
            this.processes.delete(pid);
            this.emit('game-error', { gameId, matchCode, pid, error: err });
        });

        this.emit('game-spawn', { gameId, matchCode, pid, port });

        return { pid, port };
    }

    /**
     * Kill a game process
     */
    kill(pid) {
        const info = this.processes.get(pid);
        if (!info) {
            console.log(`[games] PID ${pid} not tracked`);
            return false;
        }

        console.log(`[games] Killing ${info.game}:${info.matchCode} (PID ${pid})`);

        try {
            info.process.kill('SIGTERM');

            // Force kill after 5s
            setTimeout(() => {
                if (this.processes.has(pid)) {
                    console.log(`[games] Force killing PID ${pid}`);
                    info.process.kill('SIGKILL');
                }
            }, 5000);

            return true;
        } catch (e) {
            console.error(`[games] Failed to kill PID ${pid}: ${e.message}`);
            return false;
        }
    }

    /**
     * Kill game by match code
     */
    killByMatch(matchCode) {
        for (const [pid, info] of this.processes) {
            if (info.matchCode === matchCode) {
                return this.kill(pid);
            }
        }
        return false;
    }

    /**
     * List running processes
     */
    listProcesses() {
        return Array.from(this.processes.entries()).map(([pid, info]) => ({
            pid,
            game: info.game,
            matchCode: info.matchCode,
            port: info.port,
            uptime: Date.now() - info.startedAt
        }));
    }

    /**
     * Find available port in range
     */
    findAvailablePort(start, end) {
        const usedPorts = new Set(
            Array.from(this.processes.values()).map(p => p.port)
        );

        for (let port = start; port <= end; port++) {
            if (!usedPorts.has(port)) {
                return port;
            }
        }

        throw new Error('No available ports');
    }

    /**
     * Cleanup - kill all processes
     */
    shutdown() {
        console.log(`[games] Shutting down ${this.processes.size} game(s)`);
        for (const pid of this.processes.keys()) {
            this.kill(pid);
        }
    }
}

module.exports = GameRegistry;
