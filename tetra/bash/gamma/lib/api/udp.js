/**
 * udp.js - UDP server for quick status checks
 */

'use strict';

const dgram = require('dgram');

/**
 * Create UDP server
 * @param {Object} ctx - Service context (matches)
 * @param {number} port - Port to listen on
 * @returns {Promise<dgram.Socket>}
 */
function createUdpServer(ctx, port) {
    return new Promise((resolve) => {
        const server = dgram.createSocket('udp4');

        server.on('message', (msg, rinfo) => {
            const response = handleMessage(msg.toString().trim(), ctx);
            server.send(response, rinfo.port, rinfo.address);
        });

        server.bind(port, () => {
            console.log(`[udp] Listening on :${port}`);
            resolve(server);
        });
    });
}

/**
 * Handle UDP message
 * Simple text protocol for CLI
 */
function handleMessage(msg, ctx) {
    const [cmd, ...args] = msg.split(' ');

    switch (cmd) {
        case 'status':
            return `OK ${ctx.matches.count()} matches`;

        case 'list':
            const list = ctx.matches.listAll()
                .map(m => `${m.code} ${m.game} ${m.playerCount}/${m.maxPlayers}`)
                .join('\n');
            return list || 'none';

        case 'get':
            const match = ctx.matches.get(args[0]?.toUpperCase());
            return match ? JSON.stringify(match.toPublic()) : 'not found';

        default:
            return 'unknown command';
    }
}

module.exports = { createUdpServer };
