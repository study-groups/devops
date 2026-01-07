/**
 * webhooks.js - Stats webhook sender
 *
 * Sends lifecycle events to external stats collector.
 * Fire-and-forget: errors are logged but don't affect gamma operation.
 */

'use strict';

const http = require('http');

class WebhookSender {
    constructor(url) {
        this.url = url ? new URL(url) : null;
    }

    /**
     * Check if webhooks are enabled
     */
    get enabled() {
        return this.url !== null;
    }

    /**
     * Send event to webhook endpoint
     * @param {string} event - Event name (e.g., 'match:created')
     * @param {Object} data - Event data
     */
    send(event, data) {
        if (!this.url) return;

        const payload = JSON.stringify({
            event,
            timestamp: new Date().toISOString(),
            ...data
        });

        const options = {
            hostname: this.url.hostname,
            port: this.url.port || 80,
            path: this.url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = http.request(options);
        req.on('error', (e) => {
            console.error(`[gamma] Stats webhook error: ${e.message}`);
        });
        req.write(payload);
        req.end();
    }

    /**
     * Setup event listeners on service
     * @param {EventEmitter} service - GammaService instance
     */
    attachToService(service) {
        if (!this.enabled) return;

        service.on('match-created', (match) => {
            this.send('match:created', {
                match_id: match.code,
                game_type: match.game,
                max_players: match.maxPlayers,
                port: match.port
            });
        });

        service.on('player-joined', ({ match, slot }) => {
            const player = match.slots[slot];
            this.send('player:joined', {
                match_id: match.code,
                game_type: match.game,
                slot,
                player_name: player?.name
            });
        });

        service.on('player-left', ({ match, slot }) => {
            this.send('player:left', {
                match_id: match.code,
                game_type: match.game,
                slot
            });
        });

        service.on('match-closed', (match) => {
            this.send('match:closed', {
                match_id: match.code,
                game_type: match.game,
                player_count: match.playerCount,
                duration_ms: Date.now() - new Date(match.created).getTime()
            });
        });

        console.log(`[gamma] Stats webhook enabled: ${this.url.href}`);
    }
}

module.exports = { WebhookSender };
