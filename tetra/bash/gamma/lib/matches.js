/**
 * GAMMA Match Management
 */

'use strict';

const crypto = require('crypto');

const DEFAULT_TTL = 2 * 60 * 60 * 1000;  // 2 hours

class Match {
    constructor(options) {
        this.code = options.code;
        this.game = options.game;
        this.maxPlayers = options.maxPlayers || 2;

        this.host = {
            addr: options.addr,
            transport: options.transport || 'udp'
        };

        this.topic = `tetra/game/${this.game}/${this.code}`;
        this.hostToken = this.generateToken();

        // Initialize slots
        this.slots = {};
        for (let i = 1; i <= this.maxPlayers; i++) {
            this.slots[`p${i}`] = {
                status: i === 1 ? 'host' : 'open',
                token: i === 1 ? this.hostToken : null,
                name: i === 1 ? 'host' : null,
                addr: null,
                joinedAt: i === 1 ? Date.now() : null
            };
        }

        this.settings = {
            public: options.public || false,
            password: options.password || null
        };

        this.created = Date.now();
        this.expires = Date.now() + (options.ttl || DEFAULT_TTL);
        this.lastActivity = Date.now();
    }

    generateToken() {
        return 'tok_' + crypto.randomBytes(16).toString('hex');
    }

    get playerCount() {
        return Object.values(this.slots).filter(s => s.status !== 'open' && s.status !== 'closed').length;
    }

    /**
     * Join match, returns { slot, token } or { error }
     */
    join(name) {
        // Find open slot
        const openSlot = Object.entries(this.slots).find(([_, s]) => s.status === 'open');

        if (!openSlot) {
            return { error: 'Match is full' };
        }

        const [slotName, slot] = openSlot;
        const token = this.generateToken();

        slot.status = 'joined';
        slot.token = token;
        slot.name = name || slotName;
        slot.joinedAt = Date.now();

        this.lastActivity = Date.now();

        return { slot: slotName, token };
    }

    /**
     * Leave match by token, returns slot name or null
     */
    leave(token) {
        const entry = Object.entries(this.slots).find(([_, s]) => s.token === token && s.status === 'joined');

        if (!entry) return null;

        const [slotName, slot] = entry;

        slot.status = 'open';
        slot.token = null;
        slot.name = null;
        slot.addr = null;
        slot.joinedAt = null;

        this.lastActivity = Date.now();

        return slotName;
    }

    /**
     * Check if match has expired
     */
    isExpired() {
        return Date.now() > this.expires;
    }

    /**
     * Extend expiration
     */
    heartbeat(ttl = DEFAULT_TTL) {
        this.expires = Date.now() + ttl;
        this.lastActivity = Date.now();
    }

    /**
     * Public view (no tokens)
     */
    toPublic() {
        const slots = {};
        for (const [name, slot] of Object.entries(this.slots)) {
            slots[name] = {
                status: slot.status,
                name: slot.name
            };
        }

        return {
            code: this.code,
            game: this.game,
            topic: this.topic,
            host: this.host,
            slots,
            playerCount: this.playerCount,
            maxPlayers: this.maxPlayers,
            created: this.created,
            expires: this.expires
        };
    }
}

class Matches {
    constructor() {
        this.matches = new Map();
    }

    create(options) {
        const match = new Match(options);
        this.matches.set(match.code, match);
        return match;
    }

    get(code) {
        return this.matches.get(code);
    }

    has(code) {
        return this.matches.has(code);
    }

    delete(code) {
        return this.matches.delete(code);
    }

    count() {
        return this.matches.size;
    }

    listAll() {
        return Array.from(this.matches.values()).map(m => m.toPublic());
    }

    listPublic(game = null) {
        return Array.from(this.matches.values())
            .filter(m => m.settings.public && (!game || m.game === game))
            .map(m => m.toPublic());
    }

    cleanupExpired() {
        const now = Date.now();
        let cleaned = 0;

        for (const [code, match] of this.matches) {
            if (match.isExpired()) {
                this.matches.delete(code);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`[gamma] Cleaned up ${cleaned} expired matches`);
        }

        return cleaned;
    }
}

module.exports = Matches;
