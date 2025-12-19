/**
 * scores.js - High Score and Leaderboard Manager
 *
 * Global leaderboards per game type:
 * - All-time high scores
 * - Daily/weekly/monthly rankings
 * - Per-monogram history
 *
 * Usage:
 *   const { ScoreManager } = require('./scores');
 *   const scores = new ScoreManager();
 *   scores.submit('quadrapole', 'ACE', 15000);
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// =============================================================================
// CONSTANTS
// =============================================================================

const LEADERBOARD_SIZE = 100;      // Top 100 per category
const DAILY_RETENTION = 7;          // Keep 7 days of daily boards
const WEEKLY_RETENTION = 12;        // Keep 12 weeks
const MONTHLY_RETENTION = 12;       // Keep 12 months

// =============================================================================
// SCORE ENTRY
// =============================================================================

class ScoreEntry {
    constructor(monogram, score, metadata = {}) {
        this.monogram = monogram;
        this.score = score;
        this.timestamp = Date.now();
        this.date = new Date().toISOString();
        this.matchId = metadata.matchId || null;
        this.duration = metadata.duration || null;
        this.metadata = metadata;
    }

    toJSON() {
        return {
            monogram: this.monogram,
            score: this.score,
            date: this.date,
            matchId: this.matchId,
            duration: this.duration
        };
    }
}

// =============================================================================
// LEADERBOARD
// =============================================================================

class Leaderboard {
    constructor(gameType, period = 'allTime') {
        this.gameType = gameType;
        this.period = period;
        this.entries = [];
        this.updated = Date.now();
    }

    /**
     * Submit a score
     * Returns rank if made leaderboard, null otherwise
     */
    submit(entry) {
        // Find insertion point (sorted desc by score)
        let rank = 0;
        for (let i = 0; i < this.entries.length; i++) {
            if (entry.score > this.entries[i].score) {
                break;
            }
            rank++;
        }

        // Insert if within leaderboard size
        if (rank < LEADERBOARD_SIZE) {
            this.entries.splice(rank, 0, entry.toJSON());

            // Trim to size
            if (this.entries.length > LEADERBOARD_SIZE) {
                this.entries = this.entries.slice(0, LEADERBOARD_SIZE);
            }

            this.updated = Date.now();

            return rank + 1;  // 1-indexed rank
        }

        return null;
    }

    /**
     * Get rank for a score
     */
    getRank(score) {
        for (let i = 0; i < this.entries.length; i++) {
            if (score >= this.entries[i].score) {
                return i + 1;
            }
        }
        return this.entries.length + 1;
    }

    /**
     * Get entry at rank
     */
    getAt(rank) {
        return this.entries[rank - 1] || null;
    }

    /**
     * Get entries for monogram
     */
    getFor(monogram) {
        return this.entries
            .map((e, i) => ({ ...e, rank: i + 1 }))
            .filter(e => e.monogram === monogram);
    }

    /**
     * Get top N entries
     */
    getTop(n = 10) {
        return this.entries.slice(0, n).map((e, i) => ({
            ...e,
            rank: i + 1
        }));
    }

    /**
     * Serialize
     */
    toJSON() {
        return {
            gameType: this.gameType,
            period: this.period,
            updated: this.updated,
            count: this.entries.length,
            entries: this.entries
        };
    }

    /**
     * Load from data
     */
    static fromJSON(data) {
        const lb = new Leaderboard(data.gameType, data.period);
        lb.entries = data.entries || [];
        lb.updated = data.updated || Date.now();
        return lb;
    }
}

// =============================================================================
// SCORE MANAGER
// =============================================================================

class ScoreManager extends EventEmitter {
    constructor(options = {}) {
        super();

        this.dataDir = options.dataDir || (process.env.TETRA_DIR || '/tmp/tetra') + '/scores';
        this.globalDir = path.join(this.dataDir, 'global');

        // Leaderboards cache: gameType → { allTime, daily, weekly, monthly }
        this.leaderboards = new Map();

        // Supported game types
        this.gameTypes = options.gameTypes || [
            'quadrapole', 'trax', 'formant', 'magnetar', 'pong'
        ];

        // Stats
        this.stats = {
            totalSubmissions: 0,
            highScoreChanges: 0
        };

        // Ensure directories
        this.ensureDirectories();

        // Load leaderboards
        this.loadAll();
    }

    /**
     * Ensure directories exist
     */
    ensureDirectories() {
        for (const dir of [this.dataDir, this.globalDir]) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
    }

    /**
     * Get leaderboard file path
     */
    getFilePath(gameType) {
        return path.join(this.globalDir, `${gameType}.json`);
    }

    /**
     * Get current period keys
     */
    getPeriodKeys() {
        const now = new Date();

        return {
            daily: now.toISOString().split('T')[0],  // YYYY-MM-DD
            weekly: `${now.getFullYear()}-W${String(Math.ceil((now.getDate() + now.getDay()) / 7)).padStart(2, '0')}`,
            monthly: now.toISOString().slice(0, 7)   // YYYY-MM
        };
    }

    /**
     * Load all leaderboards
     */
    loadAll() {
        for (const gameType of this.gameTypes) {
            this.load(gameType);
        }
    }

    /**
     * Load leaderboards for game type
     */
    load(gameType) {
        const filePath = this.getFilePath(gameType);

        const boards = {
            allTime: new Leaderboard(gameType, 'allTime'),
            daily: new Map(),
            weekly: new Map(),
            monthly: new Map()
        };

        if (fs.existsSync(filePath)) {
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

                if (data.allTime) {
                    boards.allTime = Leaderboard.fromJSON(data.allTime);
                }

                // Load periodic boards
                for (const [period, stored] of Object.entries(data.daily || {})) {
                    boards.daily.set(period, Leaderboard.fromJSON(stored));
                }
                for (const [period, stored] of Object.entries(data.weekly || {})) {
                    boards.weekly.set(period, Leaderboard.fromJSON(stored));
                }
                for (const [period, stored] of Object.entries(data.monthly || {})) {
                    boards.monthly.set(period, Leaderboard.fromJSON(stored));
                }

            } catch (e) {
                console.error(`[scores] Failed to load ${gameType}:`, e.message);
            }
        }

        this.leaderboards.set(gameType, boards);
        return boards;
    }

    /**
     * Save leaderboards for game type
     */
    save(gameType) {
        const boards = this.leaderboards.get(gameType);
        if (!boards) return false;

        const filePath = this.getFilePath(gameType);

        try {
            const data = {
                gameType,
                savedAt: new Date().toISOString(),
                allTime: boards.allTime.toJSON(),
                daily: Object.fromEntries(
                    Array.from(boards.daily.entries())
                        .slice(-DAILY_RETENTION)
                        .map(([k, v]) => [k, v.toJSON()])
                ),
                weekly: Object.fromEntries(
                    Array.from(boards.weekly.entries())
                        .slice(-WEEKLY_RETENTION)
                        .map(([k, v]) => [k, v.toJSON()])
                ),
                monthly: Object.fromEntries(
                    Array.from(boards.monthly.entries())
                        .slice(-MONTHLY_RETENTION)
                        .map(([k, v]) => [k, v.toJSON()])
                )
            };

            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            return true;

        } catch (e) {
            console.error(`[scores] Failed to save ${gameType}:`, e.message);
            return false;
        }
    }

    /**
     * Submit a score
     */
    submit(gameType, monogram, score, metadata = {}) {
        if (!this.gameTypes.includes(gameType)) {
            return { error: `Unknown game type: ${gameType}` };
        }

        let boards = this.leaderboards.get(gameType);
        if (!boards) {
            boards = this.load(gameType);
        }

        const entry = new ScoreEntry(monogram, score, metadata);
        const periods = this.getPeriodKeys();
        const results = {
            submitted: true,
            score,
            ranks: {}
        };

        // Submit to all-time
        const allTimeRank = boards.allTime.submit(entry);
        if (allTimeRank) {
            results.ranks.allTime = allTimeRank;
            if (allTimeRank === 1) {
                this.stats.highScoreChanges++;
                this.emit('newHighScore', { gameType, monogram, score });
            }
        }

        // Submit to daily
        if (!boards.daily.has(periods.daily)) {
            boards.daily.set(periods.daily, new Leaderboard(gameType, `daily:${periods.daily}`));
        }
        const dailyRank = boards.daily.get(periods.daily).submit(entry);
        if (dailyRank) {
            results.ranks.daily = dailyRank;
        }

        // Submit to weekly
        if (!boards.weekly.has(periods.weekly)) {
            boards.weekly.set(periods.weekly, new Leaderboard(gameType, `weekly:${periods.weekly}`));
        }
        const weeklyRank = boards.weekly.get(periods.weekly).submit(entry);
        if (weeklyRank) {
            results.ranks.weekly = weeklyRank;
        }

        // Submit to monthly
        if (!boards.monthly.has(periods.monthly)) {
            boards.monthly.set(periods.monthly, new Leaderboard(gameType, `monthly:${periods.monthly}`));
        }
        const monthlyRank = boards.monthly.get(periods.monthly).submit(entry);
        if (monthlyRank) {
            results.ranks.monthly = monthlyRank;
        }

        this.stats.totalSubmissions++;

        // Save
        this.save(gameType);

        this.emit('scoreSubmitted', { gameType, monogram, score, ranks: results.ranks });

        return results;
    }

    /**
     * Get leaderboard
     */
    getLeaderboard(gameType, period = 'allTime', count = 10) {
        const boards = this.leaderboards.get(gameType);
        if (!boards) {
            return { error: `Unknown game type: ${gameType}` };
        }

        if (period === 'allTime') {
            return {
                gameType,
                period: 'allTime',
                entries: boards.allTime.getTop(count)
            };
        }

        const periods = this.getPeriodKeys();
        const periodKey = periods[period];
        const boardMap = boards[period];

        if (!boardMap || !periodKey) {
            return { error: `Unknown period: ${period}` };
        }

        const board = boardMap.get(periodKey);
        if (!board) {
            return {
                gameType,
                period: `${period}:${periodKey}`,
                entries: []
            };
        }

        return {
            gameType,
            period: `${period}:${periodKey}`,
            entries: board.getTop(count)
        };
    }

    /**
     * Get rank for a score
     */
    getRank(gameType, score, period = 'allTime') {
        const boards = this.leaderboards.get(gameType);
        if (!boards) return null;

        if (period === 'allTime') {
            return boards.allTime.getRank(score);
        }

        const periods = this.getPeriodKeys();
        const board = boards[period]?.get(periods[period]);

        return board ? board.getRank(score) : null;
    }

    /**
     * Get scores for monogram
     */
    getScoresFor(gameType, monogram, period = 'allTime') {
        const boards = this.leaderboards.get(gameType);
        if (!boards) return [];

        if (period === 'allTime') {
            return boards.allTime.getFor(monogram);
        }

        const periods = this.getPeriodKeys();
        const board = boards[period]?.get(periods[period]);

        return board ? board.getFor(monogram) : [];
    }

    /**
     * Get high score for monogram
     */
    getHighScore(gameType, monogram) {
        const scores = this.getScoresFor(gameType, monogram);
        return scores.length > 0 ? scores[0] : null;
    }

    /**
     * Get stats
     */
    getStats() {
        const gameStats = {};

        for (const gameType of this.gameTypes) {
            const boards = this.leaderboards.get(gameType);
            if (boards) {
                gameStats[gameType] = {
                    allTimeCount: boards.allTime.entries.length,
                    highScore: boards.allTime.entries[0]?.score || 0,
                    highScoreHolder: boards.allTime.entries[0]?.monogram || null
                };
            }
        }

        return {
            ...this.stats,
            games: gameStats
        };
    }

    /**
     * Serialize for API
     */
    toJSON() {
        const boards = {};

        for (const gameType of this.gameTypes) {
            boards[gameType] = this.getLeaderboard(gameType, 'allTime', 10);
        }

        return {
            stats: this.getStats(),
            leaderboards: boards
        };
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    ScoreManager,
    ScoreEntry,
    Leaderboard,
    LEADERBOARD_SIZE
};
