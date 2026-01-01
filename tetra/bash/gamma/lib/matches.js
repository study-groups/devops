/**
 * GAMMA Match Management
 *
 * Persistence: matches saved to stateDir/CODE.json
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEFAULT_TTL = 5 * 60 * 1000;  // 5 minutes
const EXTEND_TTL = 5 * 60 * 1000;   // Extend by 5 minutes

class Match {
    constructor(options) {
        this.code = options.code;
        this.game = options.game;
        this.maxPlayers = options.maxPlayers || 2;
        this.port = options.port || null;  // Allocated match port

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
     * Join match, returns { slot, token, host } or { full: true, host } for takeover
     * Always returns host info so cabinet can connect and negotiate takeover
     */
    join(name, allowTakeover = true) {
        // Find open slot
        const openSlot = Object.entries(this.slots).find(([_, s]) => s.status === 'open');

        if (!openSlot) {
            // Match full - return host anyway for takeover/spectate
            if (allowTakeover) {
                return {
                    full: true,
                    host: this.host?.addr || null,
                    transport: this.host?.transport || 'ws',
                    game: this.game,
                    slots: this.slots
                };
            }
            return { error: 'Match is full' };
        }

        const [slotName, slot] = openSlot;
        const token = this.generateToken();

        slot.status = 'joined';
        slot.token = token;
        slot.name = name || slotName;
        slot.joinedAt = Date.now();

        this.lastActivity = Date.now();

        return {
            slot: slotName,
            token,
            host: this.host?.addr || null,
            transport: this.host?.transport || 'ws'
        };
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
     * Extend expiration (heartbeat)
     */
    heartbeat(ttl = DEFAULT_TTL) {
        this.expires = Date.now() + ttl;
        this.lastActivity = Date.now();
    }

    /**
     * Extend match by EXTEND_TTL (5 minutes)
     * Returns new expiration timestamp
     */
    extend() {
        this.expires += EXTEND_TTL;
        this.lastActivity = Date.now();
        return this.expires;
    }

    /**
     * Get time remaining in ms
     */
    get timeRemaining() {
        return Math.max(0, this.expires - Date.now());
    }

    /**
     * Check if match is about to expire (within 1 minute)
     */
    get isExpiringSoon() {
        return this.timeRemaining > 0 && this.timeRemaining < 60000;
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
            port: this.port,
            slots,
            playerCount: this.playerCount,
            maxPlayers: this.maxPlayers,
            created: this.created,
            expires: this.expires,
            timeRemaining: this.timeRemaining,
            expiringSoon: this.isExpiringSoon
        };
    }

    /**
     * Full state for persistence (includes tokens)
     */
    toJSON() {
        return {
            code: this.code,
            game: this.game,
            maxPlayers: this.maxPlayers,
            port: this.port,
            host: this.host,
            topic: this.topic,
            hostToken: this.hostToken,
            slots: this.slots,
            settings: this.settings,
            created: this.created,
            expires: this.expires,
            lastActivity: this.lastActivity
        };
    }

    /**
     * Restore from persisted state
     */
    static fromJSON(data) {
        const match = Object.create(Match.prototype);
        Object.assign(match, data);
        return match;
    }
}

class Matches {
    constructor(options = {}) {
        this.matches = new Map();
        this.stateDir = options.stateDir || null;

        // Create state directory if specified
        if (this.stateDir) {
            fs.mkdirSync(this.stateDir, { recursive: true });
        }
    }

    /**
     * Load matches from disk on startup
     */
    load() {
        if (!this.stateDir) return 0;

        let loaded = 0;
        try {
            const files = fs.readdirSync(this.stateDir).filter(f => f.endsWith('.json'));

            for (const file of files) {
                try {
                    const data = JSON.parse(fs.readFileSync(path.join(this.stateDir, file), 'utf8'));
                    const match = Match.fromJSON(data);

                    // Skip expired matches
                    if (match.isExpired()) {
                        fs.unlinkSync(path.join(this.stateDir, file));
                        continue;
                    }

                    this.matches.set(match.code, match);
                    loaded++;
                } catch (e) {
                    console.error(`[gamma] Failed to load ${file}:`, e.message);
                }
            }

            if (loaded > 0) {
                console.log(`[gamma] Loaded ${loaded} matches from disk`);
            }
        } catch (e) {
            // Directory doesn't exist yet, that's fine
        }

        return loaded;
    }

    /**
     * Save match to disk
     */
    save(match) {
        if (!this.stateDir) return;

        const file = path.join(this.stateDir, `${match.code}.json`);
        fs.writeFileSync(file, JSON.stringify(match.toJSON(), null, 2));
    }

    /**
     * Remove match file from disk
     */
    remove(code) {
        if (!this.stateDir) return;

        const file = path.join(this.stateDir, `${code}.json`);
        try {
            fs.unlinkSync(file);
        } catch (e) {
            // File may not exist
        }
    }

    create(options) {
        const match = new Match(options);
        this.matches.set(match.code, match);
        this.save(match);
        return match;
    }

    get(code) {
        return this.matches.get(code);
    }

    has(code) {
        return this.matches.has(code);
    }

    delete(code) {
        this.remove(code);
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

    /**
     * Save a match after modification (join/leave)
     */
    update(match) {
        this.save(match);
    }

    cleanupExpired() {
        const expired = [];

        for (const [code, match] of this.matches) {
            if (match.isExpired()) {
                expired.push(match);
                this.delete(code);
            }
        }

        if (expired.length > 0) {
            console.log(`[gamma] Cleaned up ${expired.length} expired matches`);
        }

        return expired;  // Return expired matches for port release
    }
}

module.exports = Matches;
