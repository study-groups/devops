/**
 * matchmaker.js - Player Queue and Match Pairing
 *
 * Manages player queues and creates matches when enough players are ready.
 * - Per-game-type queues
 * - FIFO with optional skill-based pairing
 * - Private match support (invite codes)
 *
 * Usage:
 *   const { Matchmaker } = require('./matchmaker');
 *   const matchmaker = new Matchmaker(registry);
 *   matchmaker.enqueue(playerId, 'quadrapole', { monogram: 'ACE' });
 */

'use strict';

const { EventEmitter } = require('events');
const crypto = require('crypto');

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_GAME_CONFIG = {
    quadrapole: { min: 1, max: 4, timeout: 60000, skillMatch: false },
    trax:       { min: 1, max: 8, timeout: 60000, skillMatch: false },
    formant:    { min: 1, max: 8, timeout: 60000, skillMatch: false },
    magnetar:   { min: 1, max: 2, timeout: 60000, skillMatch: true },
    pong:       { min: 1, max: 2, timeout: 60000, skillMatch: true }
};

const QUEUE_CHECK_INTERVAL = 1000;  // Check queues every second
const MAX_QUEUE_TIME = 120000;      // 2 minutes max wait

// =============================================================================
// QUEUED PLAYER
// =============================================================================

class QueuedPlayer {
    constructor(playerId, gameType, options = {}) {
        this.playerId = playerId;
        this.gameType = gameType;
        this.monogram = options.monogram || 'AAA';
        this.name = options.name || this.monogram;
        this.skill = options.skill || 1000;  // ELO-like rating
        this.joinedAt = Date.now();
        this.preferences = options.preferences || {};
    }

    /**
     * Time spent in queue (ms)
     */
    get waitTime() {
        return Date.now() - this.joinedAt;
    }

    /**
     * Serialize for API
     */
    toJSON() {
        return {
            playerId: this.playerId,
            gameType: this.gameType,
            monogram: this.monogram,
            name: this.name,
            waitTime: this.waitTime
        };
    }
}

// =============================================================================
// MATCHMAKER CLASS
// =============================================================================

class Matchmaker extends EventEmitter {
    constructor(registry, options = {}) {
        super();

        this.registry = registry;
        this.gameConfig = { ...DEFAULT_GAME_CONFIG, ...options.gameConfig };

        // Per-game-type queues
        this.queues = new Map();
        for (const gameType of Object.keys(this.gameConfig)) {
            this.queues.set(gameType, []);
        }

        // Player → queue lookup
        this.playerQueue = new Map();

        // Pending private matches (waiting for players)
        this.pendingPrivate = new Map();

        // Queue check timer
        this.checkTimer = null;

        // Stats
        this.stats = {
            queued: 0,
            matched: 0,
            timedOut: 0,
            cancelled: 0
        };
    }

    /**
     * Start the matchmaker
     */
    start() {
        if (this.checkTimer) return;

        this.checkTimer = setInterval(() => {
            this.checkQueues();
        }, QUEUE_CHECK_INTERVAL);

        console.log('[matchmaker] Started');
    }

    /**
     * Stop the matchmaker
     */
    stop() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }

        console.log('[matchmaker] Stopped');
    }

    /**
     * Add player to queue
     */
    enqueue(playerId, gameType, options = {}) {
        // Validate game type
        if (!this.queues.has(gameType)) {
            return { error: `Unknown game type: ${gameType}` };
        }

        // Check if already queued
        if (this.playerQueue.has(playerId)) {
            return { error: 'Player already in queue' };
        }

        // Check if already in a match
        if (this.registry.getByPlayer(playerId)) {
            return { error: 'Player already in a match' };
        }

        const player = new QueuedPlayer(playerId, gameType, options);
        const queue = this.queues.get(gameType);

        queue.push(player);
        this.playerQueue.set(playerId, gameType);

        this.stats.queued++;

        this.emit('queued', player);

        // Try immediate match
        this.tryMatch(gameType);

        return {
            queued: true,
            position: queue.length,
            gameType
        };
    }

    /**
     * Remove player from queue
     */
    dequeue(playerId) {
        const gameType = this.playerQueue.get(playerId);

        if (!gameType) {
            return { error: 'Player not in queue' };
        }

        const queue = this.queues.get(gameType);
        const index = queue.findIndex(p => p.playerId === playerId);

        if (index !== -1) {
            const player = queue.splice(index, 1)[0];
            this.playerQueue.delete(playerId);

            this.stats.cancelled++;

            this.emit('dequeued', player);

            return { dequeued: true, player };
        }

        return { error: 'Player not found in queue' };
    }

    /**
     * Get queue position
     */
    getPosition(playerId) {
        const gameType = this.playerQueue.get(playerId);

        if (!gameType) {
            return null;
        }

        const queue = this.queues.get(gameType);
        const index = queue.findIndex(p => p.playerId === playerId);

        return index !== -1 ? index + 1 : null;
    }

    /**
     * Check all queues for possible matches
     */
    checkQueues() {
        for (const [gameType, queue] of this.queues) {
            // Skip empty queues
            if (queue.length === 0) continue;

            // Check for timed out players
            this.checkTimeouts(gameType);

            // Try to form matches
            this.tryMatch(gameType);
        }
    }

    /**
     * Check for timed out players
     */
    checkTimeouts(gameType) {
        const queue = this.queues.get(gameType);
        const now = Date.now();

        for (let i = queue.length - 1; i >= 0; i--) {
            const player = queue[i];

            if (now - player.joinedAt > MAX_QUEUE_TIME) {
                queue.splice(i, 1);
                this.playerQueue.delete(player.playerId);

                this.stats.timedOut++;

                this.emit('timeout', player);
            }
        }
    }

    /**
     * Try to form a match for game type
     */
    tryMatch(gameType) {
        const queue = this.queues.get(gameType);
        const config = this.gameConfig[gameType];

        if (!config || queue.length < config.min) {
            return null;
        }

        // Select players
        let players;

        if (config.skillMatch && queue.length > config.max) {
            // Skill-based selection
            players = this.selectBySkill(queue, config.max);
        } else {
            // FIFO selection
            const count = Math.min(queue.length, config.max);
            players = queue.splice(0, count);
        }

        if (players.length < config.min) {
            // Put players back
            queue.unshift(...players);
            return null;
        }

        // Create match
        const match = this.registry.create(gameType, {
            minPlayers: config.min,
            maxPlayers: config.max,
            timeout: config.timeout
        });

        if (match.error) {
            // Put players back
            queue.unshift(...players);
            return null;
        }

        // Add players to match
        for (const player of players) {
            this.playerQueue.delete(player.playerId);

            this.registry.join(
                match.id,
                player.playerId,
                player.monogram,
                player.name
            );
        }

        this.stats.matched += players.length;

        this.emit('matched', { match, players });

        return match;
    }

    /**
     * Select players by skill (closest cluster)
     */
    selectBySkill(queue, count) {
        if (queue.length <= count) {
            return queue.splice(0, queue.length);
        }

        // Sort by skill
        const sorted = [...queue].sort((a, b) => a.skill - b.skill);

        // Find cluster with minimum skill variance
        let bestStart = 0;
        let bestVariance = Infinity;

        for (let i = 0; i <= sorted.length - count; i++) {
            const cluster = sorted.slice(i, i + count);
            const variance = this.calculateVariance(cluster.map(p => p.skill));

            if (variance < bestVariance) {
                bestVariance = variance;
                bestStart = i;
            }
        }

        // Get selected players
        const selected = sorted.slice(bestStart, bestStart + count);

        // Remove from queue
        for (const player of selected) {
            const index = queue.findIndex(p => p.playerId === player.playerId);
            if (index !== -1) {
                queue.splice(index, 1);
            }
        }

        return selected;
    }

    /**
     * Calculate variance of values
     */
    calculateVariance(values) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    }

    /**
     * Create private match with invite code
     */
    createPrivate(playerId, gameType, options = {}) {
        const config = this.gameConfig[gameType];

        if (!config) {
            return { error: `Unknown game type: ${gameType}` };
        }

        // Check if already in a match
        if (this.registry.getByPlayer(playerId)) {
            return { error: 'Player already in a match' };
        }

        // Create private match
        const match = this.registry.create(gameType, {
            ...config,
            ...options,
            private: true,
            public: false
        });

        if (match.error) {
            return match;
        }

        // Join as host
        const result = this.registry.join(
            match.id,
            playerId,
            options.monogram,
            options.name
        );

        if (result.error) {
            this.registry.end(match.id, 'error');
            return result;
        }

        this.emit('privateCreated', { match, inviteCode: match.config.inviteCode });

        return {
            match,
            inviteCode: match.config.inviteCode
        };
    }

    /**
     * Join private match by invite code
     */
    joinPrivate(playerId, inviteCode, options = {}) {
        const match = this.registry.getByInvite(inviteCode);

        if (!match) {
            return { error: 'Invalid invite code' };
        }

        // Check if already in a match
        if (this.registry.getByPlayer(playerId)) {
            return { error: 'Player already in a match' };
        }

        return this.registry.join(
            match.id,
            playerId,
            options.monogram,
            options.name
        );
    }

    /**
     * Get queue stats
     */
    getQueueStats() {
        const queues = {};

        for (const [gameType, queue] of this.queues) {
            queues[gameType] = {
                waiting: queue.length,
                config: this.gameConfig[gameType]
            };
        }

        return {
            queues,
            ...this.stats
        };
    }

    /**
     * Get queue for game type
     */
    getQueue(gameType) {
        const queue = this.queues.get(gameType);
        return queue ? queue.map(p => p.toJSON()) : null;
    }

    /**
     * Serialize for API
     */
    toJSON() {
        const queues = {};

        for (const [gameType, queue] of this.queues) {
            queues[gameType] = queue.map(p => p.toJSON());
        }

        return {
            queues,
            stats: this.stats
        };
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    Matchmaker,
    QueuedPlayer,
    DEFAULT_GAME_CONFIG,
    MAX_QUEUE_TIME
};
