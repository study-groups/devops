/**
 * monogram.js - Arcade-Style Monogram System
 *
 * Auto-incrementing 3-letter monograms (AAA, AAB, AAC... ZZZ)
 * - 17,576 unique monograms
 * - Per-monogram usage tracking
 * - Claim system for persistent identity
 * - Connection duration tracking
 *
 * Usage:
 *   const { MonogramManager } = require('./monogram');
 *   const manager = new MonogramManager();
 *   const monogram = manager.assign();  // 'AAA', 'AAB', etc.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

// =============================================================================
// CONSTANTS
// =============================================================================

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MAX_MONOGRAMS = 26 * 26 * 26;  // 17,576

// =============================================================================
// MONOGRAM UTILITIES
// =============================================================================

/**
 * Convert index to monogram (0 → AAA, 1 → AAB, etc.)
 */
function indexToMonogram(index) {
    if (index < 0 || index >= MAX_MONOGRAMS) {
        return null;
    }

    const c1 = Math.floor(index / (26 * 26));
    const c2 = Math.floor((index % (26 * 26)) / 26);
    const c3 = index % 26;

    return LETTERS[c1] + LETTERS[c2] + LETTERS[c3];
}

/**
 * Convert monogram to index (AAA → 0, AAB → 1, etc.)
 */
function monogramToIndex(monogram) {
    if (!monogram || monogram.length !== 3) {
        return -1;
    }

    const m = monogram.toUpperCase();
    const c1 = LETTERS.indexOf(m[0]);
    const c2 = LETTERS.indexOf(m[1]);
    const c3 = LETTERS.indexOf(m[2]);

    if (c1 === -1 || c2 === -1 || c3 === -1) {
        return -1;
    }

    return c1 * 26 * 26 + c2 * 26 + c3;
}

/**
 * Get next monogram in sequence
 */
function nextMonogram(monogram) {
    const index = monogramToIndex(monogram);
    if (index === -1 || index >= MAX_MONOGRAMS - 1) {
        return null;
    }
    return indexToMonogram(index + 1);
}

/**
 * Hash passphrase for claim verification
 */
function hashPassphrase(passphrase, salt) {
    return crypto
        .createHash('sha256')
        .update(passphrase + salt)
        .digest('hex');
}

// =============================================================================
// MONOGRAM DATA
// =============================================================================

class MonogramData {
    constructor(monogram) {
        this.monogram = monogram;
        this.claimed = false;
        this.claimHash = null;
        this.claimSalt = null;

        // Timestamps
        this.created = Date.now();
        this.lastSeen = Date.now();
        this.firstSeen = Date.now();

        // Session tracking
        this.sessions = [];
        this.currentSession = null;

        // Aggregate stats
        this.stats = {
            totalSessions: 0,
            totalTime: 0,           // Total time connected (ms)
            gamesPlayed: 0,
            gamesWon: 0,
            gamesLost: 0,
            totalScore: 0,
            highScore: 0
        };

        // Per-game stats
        this.games = {};
    }

    /**
     * Start a new session
     */
    startSession(sessionId) {
        const session = {
            id: sessionId,
            start: Date.now(),
            end: null,
            duration: 0,
            gamesPlayed: [],
            score: 0
        };

        this.currentSession = session;
        this.lastSeen = Date.now();

        return session;
    }

    /**
     * End current session
     */
    endSession() {
        if (!this.currentSession) return null;

        this.currentSession.end = Date.now();
        this.currentSession.duration = this.currentSession.end - this.currentSession.start;

        // Update stats
        this.stats.totalSessions++;
        this.stats.totalTime += this.currentSession.duration;

        // Keep last 100 sessions
        this.sessions.push({
            start: this.currentSession.start,
            end: this.currentSession.end,
            duration: this.currentSession.duration,
            gamesPlayed: this.currentSession.gamesPlayed.length,
            score: this.currentSession.score
        });

        if (this.sessions.length > 100) {
            this.sessions.shift();
        }

        const session = this.currentSession;
        this.currentSession = null;
        this.lastSeen = Date.now();

        return session;
    }

    /**
     * Record a heartbeat
     */
    heartbeat() {
        this.lastSeen = Date.now();
    }

    /**
     * Record game played
     */
    recordGame(gameType, result) {
        // Update current session
        if (this.currentSession) {
            this.currentSession.gamesPlayed.push({
                gameType,
                timestamp: Date.now(),
                result
            });
            this.currentSession.score += result.score || 0;
        }

        // Update aggregate stats
        this.stats.gamesPlayed++;
        this.stats.totalScore += result.score || 0;

        if (result.won) this.stats.gamesWon++;
        if (result.lost) this.stats.gamesLost++;
        if (result.score > this.stats.highScore) {
            this.stats.highScore = result.score;
        }

        // Update per-game stats
        if (!this.games[gameType]) {
            this.games[gameType] = {
                gamesPlayed: 0,
                wins: 0,
                losses: 0,
                totalScore: 0,
                highScore: 0,
                totalTime: 0,
                history: []
            };
        }

        const gameStats = this.games[gameType];
        gameStats.gamesPlayed++;
        gameStats.totalScore += result.score || 0;
        if (result.won) gameStats.wins++;
        if (result.lost) gameStats.losses++;
        if (result.score > gameStats.highScore) {
            gameStats.highScore = result.score;
        }
        if (result.duration) {
            gameStats.totalTime += result.duration;
        }

        // Keep last 50 games per type
        gameStats.history.push({
            date: new Date().toISOString(),
            score: result.score || 0,
            won: result.won || false,
            duration: result.duration || 0,
            match: result.matchId
        });

        if (gameStats.history.length > 50) {
            gameStats.history.shift();
        }

        this.lastSeen = Date.now();
    }

    /**
     * Claim this monogram with passphrase
     */
    claim(passphrase) {
        if (this.claimed) {
            return { error: 'Already claimed' };
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const hash = hashPassphrase(passphrase, salt);

        this.claimed = true;
        this.claimSalt = salt;
        this.claimHash = hash;

        return { claimed: true };
    }

    /**
     * Verify claim passphrase
     */
    verify(passphrase) {
        if (!this.claimed) {
            return false;
        }

        const hash = hashPassphrase(passphrase, this.claimSalt);
        return hash === this.claimHash;
    }

    /**
     * Serialize for storage
     */
    toJSON() {
        return {
            monogram: this.monogram,
            claimed: this.claimed,
            claimHash: this.claimHash,
            claimSalt: this.claimSalt,
            created: this.created,
            firstSeen: this.firstSeen,
            lastSeen: this.lastSeen,
            stats: this.stats,
            games: this.games,
            sessions: this.sessions
        };
    }

    /**
     * Load from stored data
     */
    static fromJSON(data) {
        const m = new MonogramData(data.monogram);
        Object.assign(m, data);
        return m;
    }
}

// =============================================================================
// MONOGRAM MANAGER
// =============================================================================

class MonogramManager extends EventEmitter {
    constructor(options = {}) {
        super();

        this.dataDir = options.dataDir || (process.env.TETRA_DIR || '/tmp/tetra') + '/scores';
        this.monogramsDir = path.join(this.dataDir, 'monograms');
        this.claimsDir = path.join(this.dataDir, 'claimed');

        // In-memory cache
        this.cache = new Map();

        // Current assignment index (auto-increment)
        this.nextIndex = 0;

        // Global stats
        this.globalStats = {
            totalConnections: 0,
            uniqueMonograms: 0,
            claimedMonograms: 0,
            totalPlayTime: 0,
            peakConcurrent: 0
        };

        // Currently connected
        this.connected = new Set();

        // Ensure directories exist
        this.ensureDirectories();

        // Load state
        this.loadState();
    }

    /**
     * Ensure data directories exist
     */
    ensureDirectories() {
        for (const dir of [this.dataDir, this.monogramsDir, this.claimsDir]) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
    }

    /**
     * Load state from disk
     */
    loadState() {
        const statePath = path.join(this.dataDir, 'monogram_state.json');

        try {
            if (fs.existsSync(statePath)) {
                const data = JSON.parse(fs.readFileSync(statePath, 'utf8'));
                this.nextIndex = data.nextIndex || 0;
                this.globalStats = { ...this.globalStats, ...data.globalStats };
            }
        } catch (e) {
            console.error('[monogram] Failed to load state:', e.message);
        }
    }

    /**
     * Save state to disk
     */
    saveState() {
        const statePath = path.join(this.dataDir, 'monogram_state.json');

        try {
            const data = {
                nextIndex: this.nextIndex,
                globalStats: this.globalStats,
                savedAt: new Date().toISOString()
            };

            fs.writeFileSync(statePath, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('[monogram] Failed to save state:', e.message);
        }
    }

    /**
     * Get monogram data file path
     */
    getDataPath(monogram) {
        return path.join(this.monogramsDir, `${monogram}.json`);
    }

    /**
     * Load monogram data (from cache or disk)
     */
    load(monogram) {
        // Check cache
        if (this.cache.has(monogram)) {
            return this.cache.get(monogram);
        }

        // Load from disk
        const filePath = this.getDataPath(monogram);

        if (fs.existsSync(filePath)) {
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const m = MonogramData.fromJSON(data);
                this.cache.set(monogram, m);
                return m;
            } catch (e) {
                console.error(`[monogram] Failed to load ${monogram}:`, e.message);
            }
        }

        return null;
    }

    /**
     * Save monogram data to disk
     */
    save(monogram) {
        const data = this.cache.get(monogram);
        if (!data) return false;

        const filePath = this.getDataPath(monogram);

        try {
            fs.writeFileSync(filePath, JSON.stringify(data.toJSON(), null, 2));
            return true;
        } catch (e) {
            console.error(`[monogram] Failed to save ${monogram}:`, e.message);
            return false;
        }
    }

    /**
     * Assign next available monogram
     */
    assign(sessionId = null) {
        // Find next unclaimed monogram
        let monogram = indexToMonogram(this.nextIndex);

        // Skip if already exists and is claimed (shouldn't happen normally)
        while (monogram) {
            const existing = this.load(monogram);
            if (!existing || !existing.claimed) {
                break;
            }
            this.nextIndex++;
            monogram = indexToMonogram(this.nextIndex);
        }

        if (!monogram) {
            // All monograms used - wrap around to find unclaimed
            for (let i = 0; i < MAX_MONOGRAMS; i++) {
                const m = indexToMonogram(i);
                const existing = this.load(m);
                if (!existing || !existing.claimed) {
                    monogram = m;
                    break;
                }
            }
        }

        if (!monogram) {
            return { error: 'No monograms available' };
        }

        // Create or get monogram data
        let data = this.load(monogram);

        if (!data) {
            data = new MonogramData(monogram);
            this.cache.set(monogram, data);
            this.globalStats.uniqueMonograms++;
        }

        // Start session
        data.startSession(sessionId || `session_${Date.now()}`);

        // Update tracking
        this.connected.add(monogram);
        this.globalStats.totalConnections++;

        if (this.connected.size > this.globalStats.peakConcurrent) {
            this.globalStats.peakConcurrent = this.connected.size;
        }

        // Increment for next assignment
        this.nextIndex++;
        if (this.nextIndex >= MAX_MONOGRAMS) {
            this.nextIndex = 0;
        }

        // Save
        this.save(monogram);
        this.saveState();

        this.emit('assigned', { monogram, sessionId });

        return { monogram, data };
    }

    /**
     * Connect with specific monogram (for returning users)
     */
    connect(monogram, passphrase = null, sessionId = null) {
        const m = monogram.toUpperCase();
        let data = this.load(m);

        // If claimed, verify passphrase
        if (data?.claimed) {
            if (!passphrase || !data.verify(passphrase)) {
                return { error: 'Invalid passphrase for claimed monogram' };
            }
        }

        // Create if doesn't exist
        if (!data) {
            data = new MonogramData(m);
            this.cache.set(m, data);
            this.globalStats.uniqueMonograms++;
        }

        // Start session
        data.startSession(sessionId || `session_${Date.now()}`);

        // Update tracking
        this.connected.add(m);
        this.globalStats.totalConnections++;

        if (this.connected.size > this.globalStats.peakConcurrent) {
            this.globalStats.peakConcurrent = this.connected.size;
        }

        // Save
        this.save(m);
        this.saveState();

        this.emit('connected', { monogram: m, claimed: data.claimed });

        return { monogram: m, data, claimed: data.claimed };
    }

    /**
     * Disconnect monogram
     */
    disconnect(monogram) {
        const m = monogram.toUpperCase();
        const data = this.cache.get(m);

        if (!data) {
            return { error: 'Monogram not found' };
        }

        // End session
        const session = data.endSession();

        // Update tracking
        this.connected.delete(m);

        if (session) {
            this.globalStats.totalPlayTime += session.duration;
        }

        // Save
        this.save(m);
        this.saveState();

        this.emit('disconnected', { monogram: m, session });

        return { monogram: m, session };
    }

    /**
     * Heartbeat for monogram
     */
    heartbeat(monogram) {
        const m = monogram.toUpperCase();
        const data = this.cache.get(m);

        if (data) {
            data.heartbeat();
        }
    }

    /**
     * Record game for monogram
     */
    recordGame(monogram, gameType, result) {
        const m = monogram.toUpperCase();
        const data = this.cache.get(m);

        if (!data) {
            return { error: 'Monogram not found' };
        }

        data.recordGame(gameType, result);
        this.save(m);

        this.emit('gameRecorded', { monogram: m, gameType, result });

        return { recorded: true };
    }

    /**
     * Claim a monogram
     */
    claim(monogram, passphrase) {
        const m = monogram.toUpperCase();
        let data = this.load(m);

        if (!data) {
            data = new MonogramData(m);
            this.cache.set(m, data);
        }

        const result = data.claim(passphrase);

        if (result.claimed) {
            // Save claim marker
            const claimPath = path.join(this.claimsDir, `${m}.claim`);
            fs.writeFileSync(claimPath, JSON.stringify({
                monogram: m,
                claimedAt: new Date().toISOString()
            }));

            this.globalStats.claimedMonograms++;
            this.save(m);
            this.saveState();

            this.emit('claimed', { monogram: m });
        }

        return result;
    }

    /**
     * Verify monogram claim
     */
    verify(monogram, passphrase) {
        const m = monogram.toUpperCase();
        const data = this.load(m);

        if (!data) {
            return { error: 'Monogram not found' };
        }

        return { verified: data.verify(passphrase) };
    }

    /**
     * Get monogram stats
     */
    getStats(monogram) {
        const m = monogram.toUpperCase();
        const data = this.load(m);

        if (!data) {
            return null;
        }

        return {
            monogram: m,
            claimed: data.claimed,
            stats: data.stats,
            games: Object.keys(data.games).map(g => ({
                game: g,
                ...data.games[g],
                history: undefined  // Don't include full history
            })),
            lastSeen: data.lastSeen,
            totalSessions: data.stats.totalSessions
        };
    }

    /**
     * Get global stats
     */
    getGlobalStats() {
        return {
            ...this.globalStats,
            currentlyConnected: this.connected.size,
            connected: Array.from(this.connected)
        };
    }

    /**
     * List all monograms (with optional filter)
     */
    list(filter = {}) {
        const files = fs.readdirSync(this.monogramsDir)
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''));

        let monograms = files.map(m => this.load(m)).filter(Boolean);

        if (filter.claimed !== undefined) {
            monograms = monograms.filter(m => m.claimed === filter.claimed);
        }

        if (filter.connected) {
            monograms = monograms.filter(m => this.connected.has(m.monogram));
        }

        if (filter.game) {
            monograms = monograms.filter(m => m.games[filter.game]);
        }

        return monograms.map(m => ({
            monogram: m.monogram,
            claimed: m.claimed,
            stats: m.stats,
            lastSeen: m.lastSeen
        }));
    }

    /**
     * Serialize for API
     */
    toJSON() {
        return {
            globalStats: this.getGlobalStats(),
            nextAssignment: indexToMonogram(this.nextIndex)
        };
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    MonogramManager,
    MonogramData,
    indexToMonogram,
    monogramToIndex,
    nextMonogram,
    MAX_MONOGRAMS
};
