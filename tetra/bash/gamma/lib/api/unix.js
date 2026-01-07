/**
 * unix.js - Unix socket server for local CLI
 */

'use strict';

const net = require('net');
const fs = require('fs');
const path = require('path');

/**
 * Create Unix socket server
 * @param {Object} ctx - Service context
 * @param {string} socketPath - Path to socket file
 * @returns {Promise<net.Server>}
 */
function createUnixServer(ctx, socketPath) {
    // Ensure directory exists
    const dir = path.dirname(socketPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Remove old socket
    if (fs.existsSync(socketPath)) {
        fs.unlinkSync(socketPath);
    }

    return new Promise((resolve) => {
        const server = net.createServer((socket) => {
            socket.on('data', async (data) => {
                const response = await handleCommand(data.toString().trim(), ctx);
                socket.write(response + '\n');
            });
        });

        server.listen(socketPath, () => {
            console.log(`[unix] Listening on ${socketPath}`);
            resolve(server);
        });
    });
}

/**
 * Handle Unix socket command (JSON protocol)
 */
async function handleCommand(line, ctx) {
    try {
        const cmd = JSON.parse(line);

        switch (cmd.type) {
            case 'create': {
                const match = ctx.matches.create({
                    code: ctx.codes.generate(key => ctx.matches.has(key)),
                    game: cmd.game,
                    maxPlayers: cmd.slots || 2,
                    transport: cmd.transport || 'udp',
                    addr: cmd.addr
                });
                ctx.stats.matchesCreated++;
                ctx.updateRuntime();
                ctx.syncWithMidiMp('register', match);
                return JSON.stringify({ code: match.code, token: match.hostToken });
            }

            case 'join': {
                const m = ctx.matches.get(cmd.code?.toUpperCase());
                if (!m) return JSON.stringify({ error: 'not found' });
                const result = m.join(cmd.name);
                if (result.error) return JSON.stringify({ error: result.error });
                ctx.stats.playersJoined++;
                ctx.updateRuntime();
                ctx.matches.update(m);
                ctx.syncWithMidiMp('register', m, result.slot);
                return JSON.stringify({ slot: result.slot, token: result.token, host: m.host.addr });
            }

            case 'leave': {
                const m = ctx.matches.get(cmd.code?.toUpperCase());
                if (!m) return JSON.stringify({ error: 'not found' });
                const slot = m.leave(cmd.token);
                if (slot) {
                    ctx.matches.update(m);
                    ctx.syncWithMidiMp('unregister', m, slot);
                }
                return JSON.stringify({ ok: !!slot });
            }

            case 'close': {
                const closeCode = cmd.code?.toUpperCase();
                const m = ctx.matches.get(closeCode);
                if (!m) return JSON.stringify({ error: 'not found' });
                if (cmd.token !== m.hostToken) return JSON.stringify({ error: 'not authorized' });
                ctx.unregisterMatch(m);
                ctx.matches.delete(closeCode);
                return JSON.stringify({ ok: true });
            }

            case 'list':
                return JSON.stringify(ctx.matches.listAll());

            case 'status':
                return JSON.stringify({ matches: ctx.matches.count(), stats: ctx.stats });

            default:
                return JSON.stringify({ error: 'unknown command' });
        }
    } catch (e) {
        return JSON.stringify({ error: e.message });
    }
}

module.exports = { createUnixServer };
