/**
 * http.js - HTTP server and routing
 */

'use strict';

const http = require('http');
const net = require('net');
const handlers = require('./handlers');

/**
 * Create and configure HTTP server
 * @param {Object} ctx - Service context
 * @param {number} port - Port to listen on
 * @returns {Promise<http.Server>}
 */
function createHttpServer(ctx, port) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            handleRequest(req, res, ctx, port);
        });

        // WebSocket upgrade handling for match proxy
        server.on('upgrade', (req, socket, head) => {
            if (req.url.startsWith('/match/')) {
                handleMatchUpgrade(req, socket, head, ctx);
            } else {
                socket.destroy();
            }
        });

        server.listen(port, () => {
            console.log(`[http] Listening on :${port}`);
            resolve(server);
        });
    });
}

/**
 * Route HTTP requests to handlers
 */
function handleRequest(req, res, ctx, port) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://localhost:${port}`);
    const path = url.pathname;

    // Add httpPort to context for proxy handler
    const ctxWithPort = { ...ctx, httpPort: port };

    // Route
    if (req.method === 'GET' && path === '/') {
        handlers.handleDashboard(req, res, ctx);
    } else if (req.method === 'GET' && path === '/api/status') {
        handlers.handleStatus(req, res, ctx);
    } else if (req.method === 'GET' && path === '/api/matches') {
        handlers.handleListMatches(req, res, ctx);
    } else if (req.method === 'GET' && path.startsWith('/api/match/')) {
        const code = path.split('/')[3];
        handlers.handleGetMatch(req, res, ctx, code);
    } else if (req.method === 'POST' && path === '/api/match/create') {
        handlers.handleCreate(req, res, ctx);
    } else if (req.method === 'POST' && path === '/api/match/join') {
        handlers.handleJoin(req, res, ctx);
    } else if (req.method === 'POST' && path === '/api/match/leave') {
        handlers.handleLeave(req, res, ctx);
    } else if (req.method === 'POST' && path === '/api/match/close') {
        handlers.handleClose(req, res, ctx);
    } else if (req.method === 'POST' && path === '/api/match/extend') {
        handlers.handleExtend(req, res, ctx);
    } else if (req.method === 'DELETE' && path.startsWith('/api/match/')) {
        const code = path.split('/')[3];
        handlers.handleAdminDelete(req, res, ctx, code);
    } else if (req.method === 'GET' && path === '/api/lobby') {
        handlers.handleLobby(req, res, ctx, url.searchParams.get('game'));
    } else if (req.method === 'GET' && path === '/api/games') {
        handlers.handleListGames(req, res, ctx);
    } else if (req.method === 'GET' && path === '/api/games/processes') {
        handlers.handleListProcesses(req, res, ctx);
    } else if (req.method === 'GET' && path === '/api/ports') {
        handlers.handlePortStats(req, res, ctx);
    } else if (path.startsWith('/match/')) {
        handlers.handleMatchProxy(req, res, ctxWithPort);
    } else if (req.method === 'GET') {
        handlers.serveStaticFile(req, res, path);
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
}

/**
 * Handle WebSocket upgrade for match proxy
 */
function handleMatchUpgrade(req, socket, head, ctx) {
    const url = new URL(req.url, 'http://localhost');
    const pathParts = url.pathname.split('/');
    const code = pathParts[2]?.toUpperCase();

    if (!code) {
        socket.destroy();
        return;
    }

    const match = ctx.matches.get(code);
    if (!match || !match.port) {
        socket.destroy();
        return;
    }

    const proxyPath = '/' + pathParts.slice(3).join('/') + url.search;

    const proxySocket = net.connect(match.port, 'localhost', () => {
        const upgradeReq = [
            `${req.method} ${proxyPath} HTTP/1.1`,
            `Host: localhost:${match.port}`,
            `Upgrade: websocket`,
            `Connection: Upgrade`,
            `Sec-WebSocket-Key: ${req.headers['sec-websocket-key']}`,
            `Sec-WebSocket-Version: ${req.headers['sec-websocket-version']}`,
            `X-Gamma-Match: ${code}`,
            `X-Gamma-Game: ${match.game}`,
            '', ''
        ].join('\r\n');

        proxySocket.write(upgradeReq);
        proxySocket.write(head);

        socket.pipe(proxySocket);
        proxySocket.pipe(socket);
    });

    proxySocket.on('error', (err) => {
        console.error(`[gamma] WebSocket proxy error for ${code}:`, err.message);
        socket.destroy();
    });

    socket.on('error', () => proxySocket.destroy());
}

module.exports = { createHttpServer };
