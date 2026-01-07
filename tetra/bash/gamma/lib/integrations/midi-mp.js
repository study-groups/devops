/**
 * midi-mp.js - MIDI-MP routing integration
 *
 * Registers/unregisters match and player routes with midi-mp
 * so input flows from players to game hosts.
 */

'use strict';

const dgram = require('dgram');

const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 1984;

class MidiMpClient {
    constructor(host = DEFAULT_HOST, port = DEFAULT_PORT) {
        this.host = host;
        this.port = port;
    }

    /**
     * Sync match or player route with midi-mp
     * @param {string} action - 'register' or 'unregister'
     * @param {Object} match - Match object
     * @param {string} [slot] - Player slot (if registering player route)
     */
    async sync(action, match, slot = null) {
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

        return this._send(JSON.stringify(msg));
    }

    /**
     * Unregister all routes for a match
     */
    async unregisterMatch(match) {
        // Unregister all slots then match itself
        for (const slot of Object.keys(match.slots)) {
            await this.sync('unregister', match, slot);
        }
        return this.sync('unregister', match);
    }

    /**
     * Send message to midi-mp (fire-and-forget)
     */
    _send(msg) {
        return new Promise((resolve) => {
            const client = dgram.createSocket('udp4');
            client.send(msg, this.port, this.host, (err) => {
                client.close();
                if (err) {
                    console.error('[gamma] midi-mp send error:', err.message);
                }
                resolve();
            });
        });
    }
}

module.exports = { MidiMpClient };
