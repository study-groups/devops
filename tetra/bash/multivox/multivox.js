#!/usr/bin/env node
// multivox.js - Voice coordination server for estovox
// WebSocket server on port 1982 (the year SAM was released)

const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const PORT = parseInt(process.env.MULTIVOX_PORT || '1982', 10);
const THROTTLE_MS = 33; // ~30fps max broadcast rate

// Track connected clients by role
const clients = {
    synths: new Set(),   // Browser audio renderers
    faces: new Set()     // Bash TUI controllers
};
let lastBroadcast = 0;

// ============================================================================
// HTTP Server (serves browser client files)
// ============================================================================

const httpServer = http.createServer((req, res) => {
    const url = req.url === '/' ? '/index.html' : req.url;
    const filePath = path.join(__dirname, 'browser', url);
    const ext = path.extname(filePath);

    const contentTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json'
    };

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
            return;
        }
        res.writeHead(200, {
            'Content-Type': contentTypes[ext] || 'text/plain',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(content);
    });
});

// ============================================================================
// WebSocket Server
// ============================================================================

const wss = new WebSocket.Server({ server: httpServer });

wss.on('connection', (ws, req) => {
    const clientId = `${req.socket.remoteAddress}:${Date.now().toString(36)}`;
    ws.clientId = clientId;
    ws.role = 'unknown';

    console.log(`[WS] Connected: ${clientId}`);

    // Send welcome
    ws.send(JSON.stringify({
        t: 'welcome',
        synths: clients.synths.size,
        faces: clients.faces.size
    }));

    ws.on('message', (msg) => {
        const msgStr = msg.toString().trim();

        try {
            const data = JSON.parse(msgStr);

            // Handle registration
            if (data.t === 'register' || data.type === 'register') {
                ws.role = data.role || 'synth';
                if (ws.role === 'synth') {
                    clients.synths.add(ws);
                } else if (ws.role === 'face') {
                    clients.faces.add(ws);
                }
                console.log(`[WS] ${clientId} registered as ${ws.role}`);
                return;
            }

            // Handle formant/state messages - broadcast to synths
            if (data.t === 'fm' || data.t === 'st' || data.t === 'test') {
                broadcastToSynths(data);
                return;
            }

            // Unknown message type
            console.log(`[WS] ${clientId}: ${data.t || 'unknown'}`);

        } catch (e) {
            // Not JSON - try to broadcast as raw
            console.log(`[WS] ${clientId}: raw message`);
            broadcastToSynths({ t: 'raw', data: msgStr });
        }
    });

    ws.on('close', () => {
        console.log(`[WS] Disconnected: ${clientId} (${ws.role})`);
        clients.synths.delete(ws);
        clients.faces.delete(ws);
    });

    ws.on('error', (err) => {
        console.error(`[WS] Error ${clientId}:`, err.message);
        clients.synths.delete(ws);
        clients.faces.delete(ws);
    });
});

// Broadcast to all synth clients (with throttling)
function broadcastToSynths(message) {
    const now = Date.now();
    if (now - lastBroadcast < THROTTLE_MS) {
        return; // Throttle exceeded, skip
    }
    lastBroadcast = now;

    const msgStr = typeof message === 'string' ? message : JSON.stringify(message);
    let sent = 0;

    for (const ws of clients.synths) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(msgStr);
            sent++;
        }
    }

    if (sent > 0) {
        // Compact logging for formant messages
        if (message.t === 'fm') {
            process.stdout.write(`\r[WS] fm f1=${message.f1} f2=${message.f2} → ${sent} synths   `);
        } else {
            console.log(`[WS] ${message.t || 'msg'} → ${sent} synths`);
        }
    }
}

// ============================================================================
// Startup
// ============================================================================

httpServer.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║               MULTIVOX - Voice Coordination               ║
║                    (SAM was born 1982)                    ║
╠═══════════════════════════════════════════════════════════╣
║  Server: http://localhost:${PORT}                           ║
║  WebSocket: ws://localhost:${PORT}                          ║
║  Throttle: ${THROTTLE_MS}ms (~${Math.round(1000/THROTTLE_MS)}fps)                               ║
╚═══════════════════════════════════════════════════════════╝

Browser: http://localhost:${PORT}

Bash (requires websocat):
  source estovox/network/ws_sender.sh
  multivox_enable
  multivox_test
`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[MULTIVOX] Shutting down...');
    wss.close();
    httpServer.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    wss.close();
    httpServer.close();
    process.exit(0);
});
