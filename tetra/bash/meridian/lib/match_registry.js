/**
 * match_registry.js - 240-Slot Match Registry
 *
 * Manages match lifecycle for QUASAR multiplayer system.
 * - 240 match slots (0x00-0xEF)
 * - 1-8 players per match
 * - Ephemeral matches (cleaned by Doctor)
 *
 * Usage:
 *   const { MatchRegistry } = require('./match_registry');
 *   const registry = new MatchRegistry();
 *   const match = registry.create('quadrapole', { maxPlayers: 4 });
 */

'use strict';

const { EventEmitter } = require('events');
const crypto = require('crypto');

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_MATCHES = 240;        // 0x00-0xEF
const MAX_PLAYERS = 8;          // Per match
const SYSTEM_START = 0xF0;      // 0xF0-0xFF reserved for system

const MATCH_STATES = {
    LOBBY: 'lobby',
    PLAYING: 'playing',
    PAUSED: 'paused',
    ENDED: 'ended'
};

// =============================================================================
// MATCH CLASS
// =============================================================================

class Match {
    constructor(id, gameType, config = {}) {
        this.id = id;
        this.idHex = `0x${id.toString(16).padStart(2, '0')}`;
        this.gameType = gameType;
        this.state = MATCH_STATES.LOBBY;

        // Timestamps
        this.created = Date.now();
        this.started = null;
        this.ended = null;
        this.lastActivity = Date.now();

        // Configuration
        this.config = {
            minPlayers: config.minPlayers || 1,
            maxPlayers: Math.min(config.maxPlayers || 4, MAX_PLAYERS),
            public: config.public !== false,
            joinable: config.joinable !== false,
            timeout: config.timeout || 30000,
            inviteCode: config.private ? this.generateInviteCode() : null
        };

        // Player slots (1-8)
        this.players = new Array(this.config.maxPlayers).fill(null).map((_, i) => ({
            slot: i,
            id: null,
            monogram: null,
            name: null,
            connected: false,
            ready: false,
            lastSeen: null,
            score: 0
        }));

        // Game-specific state
        this.game = {};

        // Host (first player to join)
        this.hostSlot = null;
    }

    /**
     * Generate invite code for private matches
     */
    generateInviteCode() {
        return crypto.randomBytes(3).toString('hex').toUpperCase();
    }

    /**
     * Get connected player count
     */
    get playerCount() {
        return this.players.filter(p => p.id && p.connected).length;
    }

    /**
     * Get all active players
     */
    get activePlayers() {
        return this.players.filter(p => p.id && p.connected);
    }

    /**
     * Check if match is full
     */
    get isFull() {
        return this.playerCount >= this.config.maxPlayers;
    }

    /**
     * Check if match can start
     */
    get canStart() {
        return this.playerCount >= this.config.minPlayers &&
               this.state === MATCH_STATES.LOBBY;
    }

    /**
     * Find first available slot
     */
    findOpenSlot() {
        for (let i = 0; i < this.players.length; i++) {
            if (!this.players[i].id) {
                return i;
            }
        }
        return null;
    }

    /**
     * Add player to match
     */
    addPlayer(playerId, monogram, name) {
        if (this.isFull) {
            return { error: 'Match is full' };
        }

        if (!this.config.joinable && this.state !== MATCH_STATES.LOBBY) {
            return { error: 'Match not joinable' };
        }

        const slot = this.findOpenSlot();
        if (slot === null) {
            return { error: 'No slots available' };
        }

        this.players[slot] = {
            slot,
            id: playerId,
            monogram: monogram || 'AAA',
            name: name || monogram || `Player ${slot + 1}`,
            connected: true,
            ready: false,
            lastSeen: Date.now(),
            score: 0
        };

        // First player is host
        if (this.hostSlot === null) {
            this.hostSlot = slot;
        }

        this.lastActivity = Date.now();

        return { slot, player: this.players[slot] };
    }

    /**
     * Remove player from match
     */
    removePlayer(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) {
            return { error: 'Player not found' };
        }

        const slot = player.slot;

        // Reset slot
        this.players[slot] = {
            slot,
            id: null,
            monogram: null,
            name: null,
            connected: false,
            ready: false,
            lastSeen: null,
            score: 0
        };

        // Reassign host if needed
        if (this.hostSlot === slot) {
            const newHost = this.players.find(p => p.id && p.connected);
            this.hostSlot = newHost ? newHost.slot : null;
        }

        this.lastActivity = Date.now();

        return { slot, removed: true };
    }

    /**
     * Get player by ID
     */
    getPlayer(playerId) {
        return this.players.find(p => p.id === playerId);
    }

    /**
     * Get player by slot
     */
    getPlayerBySlot(slot) {
        return this.players[slot];
    }

    /**
     * Update player heartbeat
     */
    heartbeat(playerId) {
        const player = this.getPlayer(playerId);
        if (player) {
            player.lastSeen = Date.now();
            player.connected = true;
            this.lastActivity = Date.now();
        }
    }

    /**
     * Set player ready state
     */
    setReady(playerId, ready = true) {
        const player = this.getPlayer(playerId);
        if (player) {
            player.ready = ready;
            this.lastActivity = Date.now();
        }
    }

    /**
     * Check if all players are ready
     */
    get allReady() {
        return this.activePlayers.every(p => p.ready);
    }

    /**
     * Start the match
     */
    start() {
        if (!this.canStart) {
            return { error: 'Cannot start match' };
        }

        this.state = MATCH_STATES.PLAYING;
        this.started = Date.now();
        this.lastActivity = Date.now();

        return { started: true };
    }

    /**
     * Pause the match
     */
    pause() {
        if (this.state !== MATCH_STATES.PLAYING) {
            return { error: 'Match not playing' };
        }

        this.state = MATCH_STATES.PAUSED;
        this.lastActivity = Date.now();

        return { paused: true };
    }

    /**
     * Resume the match
     */
    resume() {
        if (this.state !== MATCH_STATES.PAUSED) {
            return { error: 'Match not paused' };
        }

        this.state = MATCH_STATES.PLAYING;
        this.lastActivity = Date.now();

        return { resumed: true };
    }

    /**
     * End the match
     */
    end(reason = 'completed') {
        this.state = MATCH_STATES.ENDED;
        this.ended = Date.now();
        this.lastActivity = Date.now();

        return {
            ended: true,
            reason,
            duration: this.ended - (this.started || this.created),
            players: this.activePlayers.map(p => ({
                slot: p.slot,
                monogram: p.monogram,
                score: p.score
            }))
        };
    }

    /**
     * Update player score
     */
    setScore(slot, score) {
        if (this.players[slot]) {
            this.players[slot].score = score;
            this.lastActivity = Date.now();
        }
    }

    /**
     * Add to player score
     */
    addScore(slot, points) {
        if (this.players[slot]) {
            this.players[slot].score += points;
            this.lastActivity = Date.now();
        }
    }

    /**
     * Set game-specific state
     */
    setGameState(state) {
        this.game = { ...this.game, ...state };
        this.lastActivity = Date.now();
    }

    /**
     * Record player input (updates lastSeen and lastActivity)
     */
    recordInput(playerId, input) {
        const player = this.getPlayer(playerId);
        if (player) {
            player.lastSeen = Date.now();
            this.lastActivity = Date.now();
            // Emit or store input if needed for replay
            this.game.lastInput = { playerId, input, ts: Date.now() };
        }
    }

    /**
     * Broadcast message to all players in match
     */
    broadcastToPlayers(message) {
        const msgStr = typeof message === 'string' ? message : JSON.stringify(message);
        for (const slot of this.players) {
            if (slot && slot.ws && slot.ws.readyState === 1) {
                try {
                    slot.ws.send(msgStr);
                } catch (e) {
                    // Ignore send errors
                }
            }
        }
    }

    /**
     * Serialize match for API
     */
    toJSON(full = false) {
        const base = {
            id: this.idHex,
            gameType: this.gameType,
            state: this.state,
            players: this.playerCount,
            maxPlayers: this.config.maxPlayers,
            public: this.config.public,
            joinable: this.config.joinable && !this.isFull &&
                      (this.state === MATCH_STATES.LOBBY || this.config.joinable),
            created: this.created
        };

        if (full) {
            return {
                ...base,
                config: this.config,
                hostSlot: this.hostSlot,
                started: this.started,
                lastActivity: this.lastActivity,
                playerList: this.players.map(p => ({
                    slot: p.slot,
                    monogram: p.monogram,
                    name: p.name,
                    connected: p.connected,
                    ready: p.ready,
                    score: p.score
                })),
                game: this.game
            };
        }

        return base;
    }
}

// =============================================================================
// MATCH REGISTRY CLASS
// =============================================================================

class MatchRegistry extends EventEmitter {
    constructor() {
        super();

        // 240 match slots
        this.matches = new Array(MAX_MATCHES).fill(null);

        // Player → match lookup
        this.playerIndex = new Map();

        // Invite code → match lookup
        this.inviteIndex = new Map();

        // Stats
        this.stats = {
            created: 0,
            ended: 0,
            peakActive: 0
        };
    }

    /**
     * Get active match count
     */
    get activeCount() {
        return this.matches.filter(m => m !== null).length;
    }

    /**
     * Get available slot count
     */
    get availableCount() {
        return MAX_MATCHES - this.activeCount;
    }

    /**
     * Allocate a match slot
     */
    allocate() {
        for (let i = 0; i < MAX_MATCHES; i++) {
            if (this.matches[i] === null) {
                return i;
            }
        }
        return null;
    }

    /**
     * Create a new match
     */
    create(gameType, config = {}) {
        const slot = this.allocate();

        if (slot === null) {
            return { error: 'No match slots available' };
        }

        const match = new Match(slot, gameType, config);
        this.matches[slot] = match;

        // Index invite code
        if (match.config.inviteCode) {
            this.inviteIndex.set(match.config.inviteCode, slot);
        }

        // Update stats
        this.stats.created++;
        if (this.activeCount > this.stats.peakActive) {
            this.stats.peakActive = this.activeCount;
        }

        this.emit('created', match);

        return match;
    }

    /**
     * Get match by ID (slot number or hex string)
     */
    get(id) {
        const slot = typeof id === 'string'
            ? parseInt(id.replace('0x', ''), 16)
            : id;

        if (slot < 0 || slot >= MAX_MATCHES) {
            return null;
        }

        return this.matches[slot];
    }

    /**
     * Get match by invite code
     */
    getByInvite(code) {
        const slot = this.inviteIndex.get(code.toUpperCase());
        return slot !== undefined ? this.matches[slot] : null;
    }

    /**
     * Get match by player ID
     */
    getByPlayer(playerId) {
        const slot = this.playerIndex.get(playerId);
        return slot !== undefined ? this.matches[slot] : null;
    }

    /**
     * Join a match
     */
    join(matchId, playerId, monogram, name) {
        const match = this.get(matchId);

        if (!match) {
            return { error: 'Match not found' };
        }

        // Check if player already in a match
        if (this.playerIndex.has(playerId)) {
            return { error: 'Player already in a match' };
        }

        const result = match.addPlayer(playerId, monogram, name);

        if (result.error) {
            return result;
        }

        // Index player
        this.playerIndex.set(playerId, match.id);

        this.emit('joined', { match, player: result.player });

        return { match, ...result };
    }

    /**
     * Leave a match
     */
    leave(playerId) {
        const match = this.getByPlayer(playerId);

        if (!match) {
            return { error: 'Player not in a match' };
        }

        const result = match.removePlayer(playerId);

        if (result.error) {
            return result;
        }

        // Remove player index
        this.playerIndex.delete(playerId);

        this.emit('left', { match, playerId, slot: result.slot });

        // End match if empty
        if (match.playerCount === 0) {
            this.end(match.id, 'empty');
        }

        return { match, ...result };
    }

    /**
     * End a match
     */
    end(matchId, reason = 'completed') {
        const match = this.get(matchId);

        if (!match) {
            return { error: 'Match not found' };
        }

        const result = match.end(reason);

        // Remove player indices
        for (const player of match.players) {
            if (player.id) {
                this.playerIndex.delete(player.id);
            }
        }

        // Remove invite index
        if (match.config.inviteCode) {
            this.inviteIndex.delete(match.config.inviteCode);
        }

        // Clear slot
        this.matches[match.id] = null;

        // Update stats
        this.stats.ended++;

        this.emit('ended', { match, ...result });

        return { match, ...result };
    }

    /**
     * List matches (with optional filters)
     */
    list(filters = {}) {
        let matches = this.matches.filter(m => m !== null);

        if (filters.gameType) {
            matches = matches.filter(m => m.gameType === filters.gameType);
        }

        if (filters.state) {
            matches = matches.filter(m => m.state === filters.state);
        }

        if (filters.public !== undefined) {
            matches = matches.filter(m => m.config.public === filters.public);
        }

        if (filters.joinable) {
            matches = matches.filter(m =>
                m.config.joinable &&
                !m.isFull &&
                (m.state === MATCH_STATES.LOBBY ||
                 (m.config.joinable && m.state === MATCH_STATES.PLAYING))
            );
        }

        return matches.map(m => m.toJSON(filters.full));
    }

    /**
     * Get all active matches
     */
    getActive() {
        return this.matches.filter(m => m !== null);
    }

    /**
     * Get registry stats
     */
    getStats() {
        const byState = {};
        const byGameType = {};

        for (const match of this.getActive()) {
            byState[match.state] = (byState[match.state] || 0) + 1;
            byGameType[match.gameType] = (byGameType[match.gameType] || 0) + 1;
        }

        return {
            total: MAX_MATCHES,
            active: this.activeCount,
            available: this.availableCount,
            players: this.playerIndex.size,
            byState,
            byGameType,
            ...this.stats
        };
    }

    /**
     * Serialize for API
     */
    toJSON() {
        return {
            stats: this.getStats(),
            matches: this.list()
        };
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    Match,
    MatchRegistry,
    MATCH_STATES,
    MAX_MATCHES,
    MAX_PLAYERS
};
