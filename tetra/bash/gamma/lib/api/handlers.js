/**
 * handlers.js - HTTP API route handlers
 *
 * All handlers receive (req, res, ctx) where ctx contains:
 *   - matches: Matches instance
 *   - codes: Codes instance
 *   - games: GameRegistry instance
 *   - ports: PortAllocator instance
 *   - createLimiter, joinLimiter: RateLimiter instances
 *   - stats: { matchesCreated, playersJoined, startTime }
 *   - emit: function to emit events
 *   - syncWithMidiMp: function for midi-mp sync
 *   - unregisterMatch: function to unregister from midi-mp
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const VERSION = '1.0.0';
const ANSICAB_DIR = path.join(__dirname, '../../..', 'ansicab');

// ─────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────

function readBody(req, maxSize = 4096) {
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

function json(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

function formatUptime(startTime) {
    const ms = Date.now() - startTime;
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${mins}m`;
}

function formatExpiry(timestamp) {
    const remaining = timestamp - Date.now();
    if (remaining < 0) return 'expired';
    const mins = Math.floor(remaining / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// ─────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────

function handleDashboard(req, res, ctx) {
    const matches = ctx.matches.listAll();

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
                <td>${formatExpiry(m.expires)}</td>
            </tr>`).join('');

        matchesContent = `
<table>
    <thead>
        <tr><th>Code</th><th>Game</th><th>Players</th><th>Transport</th><th>Expires</th></tr>
    </thead>
    <tbody>${rows}</tbody>
</table>`;
    }

    const html = ctx.dashboardTemplate
        .replace('{{VERSION}}', VERSION)
        .replace('{{ACTIVE_MATCHES}}', matches.length)
        .replace('{{TOTAL_CREATED}}', ctx.stats.matchesCreated)
        .replace('{{PLAYERS_JOINED}}', ctx.stats.playersJoined)
        .replace('{{UPTIME}}', formatUptime(ctx.stats.startTime))
        .replace('{{MATCHES_CONTENT}}', matchesContent);

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
}

// ─────────────────────────────────────────────────────────────
// Status & Listing
// ─────────────────────────────────────────────────────────────

function handleStatus(req, res, ctx) {
    json(res, 200, {
        version: VERSION,
        matches: ctx.matches.count(),
        stats: ctx.stats,
        uptime: Date.now() - ctx.stats.startTime
    });
}

function handleListMatches(req, res, ctx) {
    json(res, 200, ctx.matches.listAll());
}

function handleGetMatch(req, res, ctx, code) {
    const match = ctx.matches.get(code);
    if (!match) {
        return json(res, 404, { error: 'Match not found' });
    }
    json(res, 200, match.toPublic());
}

function handleLobby(req, res, ctx, game) {
    const matches = ctx.matches.listPublic(game);
    json(res, 200, matches);
}

function handleListGames(req, res, ctx) {
    const games = ctx.games.list().map(g => ({
        id: g.id,
        name: g.name,
        org: g.org,
        players: g.players,
        engine: g.engine
    }));
    json(res, 200, games);
}

function handleListProcesses(req, res, ctx) {
    json(res, 200, ctx.games.listProcesses());
}

function handlePortStats(req, res, ctx) {
    json(res, 200, ctx.ports.stats());
}

// ─────────────────────────────────────────────────────────────
// Match Lifecycle
// ─────────────────────────────────────────────────────────────

async function handleCreate(req, res, ctx) {
    const clientIp = req.socket.remoteAddress || 'unknown';
    const rateCheck = ctx.createLimiter.check(clientIp);

    if (!rateCheck.allowed) {
        res.writeHead(429, {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil(rateCheck.resetMs / 1000)
        });
        return res.end(JSON.stringify({ error: 'Too many requests', retryAfter: rateCheck.resetMs }));
    }

    const body = await readBody(req);

    try {
        const data = JSON.parse(body);
        const { game, slots = 2, transport = 'udp', addr, public: isPublic = false, spawn = false } = data;

        if (!game || typeof game !== 'string') {
            return json(res, 400, { error: 'game is required' });
        }

        const gameInfo = ctx.games.get(game);
        if (spawn && !gameInfo) {
            return json(res, 400, {
                error: `Unknown game: ${game}`,
                available: ctx.games.list().map(g => g.id)
            });
        }

        const maxPlayers = Math.max(2, Math.min(16, parseInt(slots, 10) || 2));
        const code = ctx.codes.generate(key => ctx.matches.has(key));

        let matchPort = data.port;
        if (!matchPort) {
            matchPort = ctx.ports.allocate();
            if (matchPort === null) {
                return json(res, 503, {
                    error: 'No ports available',
                    ports: ctx.ports.stats()
                });
            }
        } else {
            ctx.ports.allocated.add(matchPort);
        }

        let spawnResult = null;
        let matchAddr = addr || `localhost:${matchPort}`;

        if (spawn) {
            try {
                spawnResult = ctx.games.spawn(game, code, { port: matchPort });
                matchAddr = `localhost:${spawnResult.port}`;
            } catch (e) {
                return json(res, 500, { error: `Failed to spawn game: ${e.message}` });
            }
        }

        const match = ctx.matches.create({
            code,
            game,
            maxPlayers,
            transport,
            addr: matchAddr,
            port: matchPort,
            public: isPublic,
            pid: spawnResult?.pid || null
        });

        ctx.stats.matchesCreated++;
        ctx.updateRuntime();

        await ctx.syncWithMidiMp('register', match);

        json(res, 200, {
            code: match.code,
            token: match.hostToken,
            topic: match.topic,
            expires: match.expires,
            addr: matchAddr,
            port: matchPort,
            pid: spawnResult?.pid || null
        });

        ctx.emit('match-created', match);

    } catch (e) {
        json(res, 400, { error: e.message });
    }
}

async function handleJoin(req, res, ctx) {
    const clientIp = req.socket.remoteAddress || 'unknown';
    const rateCheck = ctx.joinLimiter.check(clientIp);

    if (!rateCheck.allowed) {
        res.writeHead(429, {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil(rateCheck.resetMs / 1000)
        });
        return res.end(JSON.stringify({ error: 'Too many requests', retryAfter: rateCheck.resetMs }));
    }

    const body = await readBody(req);

    try {
        const data = JSON.parse(body);
        const { code, name } = data;

        if (!code) {
            return json(res, 400, { error: 'code is required' });
        }

        const match = ctx.matches.get(code.toUpperCase());
        if (!match) {
            return json(res, 404, { error: 'Match not found' });
        }

        const result = match.join(name);
        if (result.error) {
            return json(res, 400, { error: result.error });
        }

        ctx.stats.playersJoined++;
        ctx.updateRuntime();
        ctx.matches.update(match);

        await ctx.syncWithMidiMp('register', match, result.slot);

        // Get game metadata for boot screen
        const gameInfo = ctx.games.get(match.game);
        const response = {
            slot: result.slot,
            token: result.token,
            host: match.host.addr,
            topic: `${match.topic}/${result.slot}`,
            game: match.game
        };

        // Add game metadata if available
        if (gameInfo) {
            response.engine = gameInfo.engine;
            response.geometry = gameInfo.geometry;
        }

        json(res, 200, response);

        ctx.emit('player-joined', { match, slot: result.slot });

    } catch (e) {
        json(res, 400, { error: e.message });
    }
}

async function handleLeave(req, res, ctx) {
    const body = await readBody(req);

    try {
        const data = JSON.parse(body);
        const { code, token } = data;

        if (!code || !token) {
            return json(res, 400, { error: 'code and token are required' });
        }

        const match = ctx.matches.get(code.toUpperCase());
        if (!match) {
            return json(res, 404, { error: 'Match not found' });
        }

        const slot = match.leave(token);
        if (!slot) {
            return json(res, 400, { error: 'Invalid token' });
        }

        ctx.matches.update(match);
        await ctx.syncWithMidiMp('unregister', match, slot);

        json(res, 200, { ok: true });
        ctx.emit('player-left', { match, slot });

    } catch (e) {
        json(res, 400, { error: e.message });
    }
}

async function handleClose(req, res, ctx) {
    const body = await readBody(req);

    try {
        const data = JSON.parse(body);
        const { code, token } = data;

        if (!code || !token) {
            return json(res, 400, { error: 'code and token are required' });
        }

        const upperCode = code.toUpperCase();
        const match = ctx.matches.get(upperCode);
        if (!match) {
            return json(res, 404, { error: 'Match not found' });
        }

        if (token !== match.hostToken) {
            return json(res, 403, { error: 'Not authorized' });
        }

        if (match.pid) {
            ctx.games.kill(match.pid);
        }

        if (match.port) {
            ctx.ports.release(match.port);
        }

        await ctx.unregisterMatch(match);
        ctx.matches.delete(upperCode);

        json(res, 200, { ok: true });
        ctx.emit('match-closed', match);

    } catch (e) {
        json(res, 400, { error: e.message });
    }
}

async function handleExtend(req, res, ctx) {
    const body = await readBody(req);

    try {
        const data = JSON.parse(body);
        const { code } = data;

        if (!code) {
            return json(res, 400, { error: 'code is required' });
        }

        const upperCode = code.toUpperCase();
        const match = ctx.matches.get(upperCode);
        if (!match) {
            return json(res, 404, { error: 'Match not found' });
        }

        const newExpiry = match.extend();
        ctx.matches.update(match);

        json(res, 200, {
            ok: true,
            code: upperCode,
            expires: newExpiry,
            timeRemaining: match.timeRemaining
        });

        ctx.emit('match-extended', match);

    } catch (e) {
        json(res, 400, { error: e.message });
    }
}

async function handleAdminDelete(req, res, ctx, code) {
    if (!code) {
        return json(res, 400, { error: 'code is required' });
    }

    const upperCode = code.toUpperCase();
    const match = ctx.matches.get(upperCode);
    if (!match) {
        return json(res, 404, { error: 'Match not found' });
    }

    if (match.pid) {
        ctx.games.kill(match.pid);
    }

    if (match.port) {
        ctx.ports.release(match.port);
    }

    await ctx.unregisterMatch(match);
    ctx.matches.delete(upperCode);

    json(res, 200, { ok: true, deleted: upperCode });
    console.log(`[gamma] Match ${upperCode} deleted via admin (port ${match.port} released)`);
    ctx.emit('match-closed', match);
}

// ─────────────────────────────────────────────────────────────
// Match Proxy
// ─────────────────────────────────────────────────────────────

function handleMatchProxy(req, res, ctx) {
    const url = new URL(req.url, `http://localhost:${ctx.httpPort}`);
    const pathParts = url.pathname.split('/');
    const code = pathParts[2]?.toUpperCase();

    if (!code) {
        return json(res, 400, { error: 'Missing match code' });
    }

    // Serve cabinet HTML for /match/CODE/ (entry point)
    const subPath = pathParts.slice(3).join('/');
    if (!subPath || subPath === '') {
        // Serve cabinet HTML - code will be read from URL by cabinet.js
        const cabinetPath = path.join(ANSICAB_DIR, 'gamma-cabinet.html');
        fs.readFile(cabinetPath, (err, content) => {
            if (err) {
                return json(res, 500, { error: 'Cabinet not found' });
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content);
        });
        return;
    }

    // Serve cabinet static files for /match/CODE/lib/*
    if (subPath.startsWith('lib/')) {
        const filePath = path.join(ANSICAB_DIR, subPath);
        const ext = path.extname(filePath);
        const contentType = MIME_TYPES[ext] || 'text/plain';
        fs.readFile(filePath, (err, content) => {
            if (err) {
                return json(res, 404, { error: 'Not found' });
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        });
        return;
    }

    // For other paths, verify match exists and proxy to game server
    const match = ctx.matches.get(code);
    if (!match) {
        return json(res, 404, { error: 'Match not found', code });
    }

    if (!match.port) {
        return json(res, 503, { error: 'Match has no allocated port', code });
    }

    const proxyPath = '/' + subPath + url.search;

    const proxyReq = http.request({
        hostname: 'localhost',
        port: match.port,
        path: proxyPath,
        method: req.method,
        headers: {
            ...req.headers,
            host: `localhost:${match.port}`,
            'x-gamma-match': code,
            'x-gamma-game': match.game
        }
    }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error(`[gamma] Proxy error for ${code}:`, err.message);
        json(res, 502, { error: 'Game server unavailable', code });
    });

    req.pipe(proxyReq);
}

// ─────────────────────────────────────────────────────────────
// Static Files
// ─────────────────────────────────────────────────────────────

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.woff2': 'font/woff2',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
};

function serveStaticFile(req, res, urlPath) {
    let filePath = urlPath.replace(/^\/ansicab/, '') || '/';
    filePath = filePath === '/' ? '/gamma-cabinet.html' : filePath;
    filePath = path.join(ANSICAB_DIR, filePath);

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'text/plain';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            json(res, 404, { error: 'Not found' });
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
}

module.exports = {
    handleDashboard,
    handleStatus,
    handleListMatches,
    handleGetMatch,
    handleLobby,
    handleListGames,
    handleListProcesses,
    handlePortStats,
    handleCreate,
    handleJoin,
    handleLeave,
    handleClose,
    handleExtend,
    handleAdminDelete,
    handleMatchProxy,
    serveStaticFile,
    readBody,
    VERSION
};
