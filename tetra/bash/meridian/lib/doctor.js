/**
 * doctor.js - Match Health Monitor (Watchdog)
 *
 * Monitors match health and performs cleanup:
 * - Player heartbeat monitoring
 * - Timeout eviction
 * - Stale match cleanup
 * - Health scoring
 *
 * Usage:
 *   const { Doctor } = require('./doctor');
 *   const doctor = new Doctor(registry);
 *   doctor.start();
 */

'use strict';

const { EventEmitter } = require('events');
const { MATCH_STATES } = require('./match_registry');

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_THRESHOLDS = {
    checkInterval: 5000,          // Check every 5 seconds
    playerTimeout: 30000,         // 30s no heartbeat → kick
    matchIdle: 300000,            // 5min no activity → end match
    matchMaxDuration: 3600000,    // 1hr max match length
    lobbyTimeout: 120000,         // 2min in lobby → force start or cancel
    gracePeriod: 5000             // 5s grace after disconnect
};

const HEALTH_WEIGHTS = {
    playerTimeout: 25,    // -25 per timed out player
    matchIdle: 50,        // -50 for idle match
    lowPlayers: 30,       // -30 for below min players
    longDuration: 10      // -10 for exceeding soft limit
};

// =============================================================================
// MATCH HEALTH
// =============================================================================

class MatchHealth {
    constructor(matchId) {
        this.matchId = matchId;
        this.score = 100;
        this.issues = [];
        this.action = null;
        this.checkedAt = Date.now();
    }

    addIssue(issue, penalty = 0) {
        this.issues.push(issue);
        this.score = Math.max(0, this.score - penalty);
    }

    setAction(action) {
        this.action = action;
    }

    toJSON() {
        return {
            matchId: this.matchId,
            score: this.score,
            issues: this.issues,
            action: this.action,
            checkedAt: this.checkedAt
        };
    }
}

// =============================================================================
// DOCTOR CLASS
// =============================================================================

class Doctor extends EventEmitter {
    constructor(registry, options = {}) {
        super();

        this.registry = registry;
        this.thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };

        // Health metrics per match
        this.metrics = new Map();

        // Check timer
        this.checkTimer = null;

        // Stats
        this.stats = {
            checksPerformed: 0,
            playersEvicted: 0,
            matchesEnded: 0,
            matchesForcedStart: 0,
            matchesCancelled: 0
        };
    }

    /**
     * Start the doctor
     */
    start() {
        if (this.checkTimer) return;

        this.checkTimer = setInterval(() => {
            this.checkAll();
        }, this.thresholds.checkInterval);

        console.log('[doctor] Started health monitoring');
    }

    /**
     * Stop the doctor
     */
    stop() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }

        console.log('[doctor] Stopped health monitoring');
    }

    /**
     * Check all matches
     */
    checkAll() {
        const now = Date.now();

        for (const match of this.registry.getActive()) {
            const health = this.checkMatch(match, now);
            this.metrics.set(match.id, health);

            if (health.action) {
                this.takeAction(match, health.action, health);
            }
        }

        this.stats.checksPerformed++;

        this.emit('healthCheck', {
            matches: this.registry.activeCount,
            players: this.registry.playerIndex.size,
            unhealthy: this.countUnhealthy()
        });
    }

    /**
     * Check single match health
     */
    checkMatch(match, now) {
        const health = new MatchHealth(match.idHex);

        // Check player heartbeats
        this.checkPlayers(match, health, now);

        // Check match activity
        this.checkActivity(match, health, now);

        // Check match duration
        this.checkDuration(match, health, now);

        // Check lobby state
        this.checkLobby(match, health, now);

        // Check player count
        this.checkPlayerCount(match, health);

        return health;
    }

    /**
     * Check player heartbeats
     */
    checkPlayers(match, health, now) {
        const toEvict = [];

        for (const player of match.players) {
            if (!player.id || !player.connected) continue;

            const silent = now - player.lastSeen;

            if (silent > this.thresholds.playerTimeout) {
                health.addIssue(
                    `Player ${player.slot} (${player.monogram}) timeout: ${Math.round(silent / 1000)}s`,
                    HEALTH_WEIGHTS.playerTimeout
                );
                toEvict.push(player);
            } else if (silent > this.thresholds.playerTimeout / 2) {
                health.addIssue(
                    `Player ${player.slot} (${player.monogram}) slow: ${Math.round(silent / 1000)}s`,
                    5
                );
            }
        }

        if (toEvict.length > 0) {
            health.setAction({ type: 'evict', players: toEvict });
        }
    }

    /**
     * Check match activity
     */
    checkActivity(match, health, now) {
        const idle = now - match.lastActivity;

        if (idle > this.thresholds.matchIdle) {
            health.addIssue(
                `Match idle: ${Math.round(idle / 1000)}s`,
                HEALTH_WEIGHTS.matchIdle
            );
            health.setAction({ type: 'end', reason: 'idle' });
        }
    }

    /**
     * Check match duration
     */
    checkDuration(match, health, now) {
        if (!match.started) return;

        const duration = now - match.started;

        if (duration > this.thresholds.matchMaxDuration) {
            health.addIssue(
                `Match exceeded max duration: ${Math.round(duration / 60000)}min`,
                HEALTH_WEIGHTS.longDuration
            );
            health.setAction({ type: 'end', reason: 'max_duration' });
        } else if (duration > this.thresholds.matchMaxDuration * 0.9) {
            health.addIssue(
                `Match approaching max duration: ${Math.round(duration / 60000)}min`,
                5
            );
        }
    }

    /**
     * Check lobby state
     */
    checkLobby(match, health, now) {
        if (match.state !== MATCH_STATES.LOBBY) return;

        const waiting = now - match.created;

        if (waiting > this.thresholds.lobbyTimeout) {
            const connected = match.playerCount;
            const min = match.config.minPlayers;

            if (connected >= min) {
                health.addIssue('Lobby timeout - enough players to start');
                health.setAction({ type: 'force_start' });
            } else {
                health.addIssue(`Lobby timeout - only ${connected}/${min} players`);
                health.setAction({ type: 'cancel', reason: 'lobby_timeout' });
            }
        }
    }

    /**
     * Check player count
     */
    checkPlayerCount(match, health) {
        if (match.state !== MATCH_STATES.PLAYING) return;

        const connected = match.playerCount;
        const min = match.config.minPlayers;

        if (connected < min) {
            health.addIssue(
                `Below minimum players: ${connected}/${min}`,
                HEALTH_WEIGHTS.lowPlayers
            );
            health.setAction({ type: 'end', reason: 'insufficient_players' });
        }
    }

    /**
     * Take action based on health check
     */
    takeAction(match, action, health) {
        switch (action.type) {
            case 'evict':
                this.evictPlayers(match, action.players);
                break;

            case 'end':
                this.endMatch(match, action.reason);
                break;

            case 'cancel':
                this.cancelMatch(match, action.reason);
                break;

            case 'force_start':
                this.forceStart(match);
                break;
        }

        this.emit('action', { match: match.idHex, action, health: health.toJSON() });
    }

    /**
     * Evict stale players
     */
    evictPlayers(match, players) {
        for (const player of players) {
            console.log(`[doctor] Evicting ${player.monogram} from match ${match.idHex}`);

            this.registry.leave(player.id);
            this.stats.playersEvicted++;

            this.emit('evict', {
                match: match.idHex,
                player: player.id,
                monogram: player.monogram
            });
        }
    }

    /**
     * End a match
     */
    endMatch(match, reason) {
        console.log(`[doctor] Ending match ${match.idHex}: ${reason}`);

        this.registry.end(match.id, `doctor:${reason}`);
        this.stats.matchesEnded++;
    }

    /**
     * Cancel a match
     */
    cancelMatch(match, reason) {
        console.log(`[doctor] Cancelling match ${match.idHex}: ${reason}`);

        this.registry.end(match.id, `doctor:${reason}`);
        this.stats.matchesCancelled++;

        this.emit('cancelled', {
            match: match.idHex,
            reason
        });
    }

    /**
     * Force start a lobby match
     */
    forceStart(match) {
        console.log(`[doctor] Force starting match ${match.idHex}`);

        match.start();
        this.stats.matchesForcedStart++;

        this.emit('forceStart', {
            match: match.idHex,
            players: match.playerCount
        });
    }

    /**
     * Get health for a match
     */
    getHealth(matchId) {
        const slot = typeof matchId === 'string'
            ? parseInt(matchId.replace('0x', ''), 16)
            : matchId;

        return this.metrics.get(slot);
    }

    /**
     * Count unhealthy matches
     */
    countUnhealthy(threshold = 70) {
        let count = 0;

        for (const health of this.metrics.values()) {
            if (health.score < threshold) {
                count++;
            }
        }

        return count;
    }

    /**
     * Get overall system health
     */
    getSystemHealth() {
        const matches = this.registry.getActive();

        if (matches.length === 0) {
            return { score: 100, status: 'idle' };
        }

        let totalScore = 0;
        let issues = [];

        for (const match of matches) {
            const health = this.metrics.get(match.id);
            if (health) {
                totalScore += health.score;
                if (health.issues.length > 0) {
                    issues.push({
                        match: match.idHex,
                        issues: health.issues
                    });
                }
            }
        }

        const avgScore = Math.round(totalScore / matches.length);

        let status = 'healthy';
        if (avgScore < 50) status = 'critical';
        else if (avgScore < 70) status = 'degraded';
        else if (avgScore < 90) status = 'warning';

        return {
            score: avgScore,
            status,
            matches: matches.length,
            unhealthy: this.countUnhealthy(),
            issues
        };
    }

    /**
     * Get stats
     */
    getStats() {
        return {
            ...this.stats,
            systemHealth: this.getSystemHealth()
        };
    }

    /**
     * Serialize for API
     */
    toJSON() {
        const healthMap = {};

        for (const [id, health] of this.metrics) {
            healthMap[`0x${id.toString(16).padStart(2, '0')}`] = health.toJSON();
        }

        return {
            health: healthMap,
            system: this.getSystemHealth(),
            stats: this.stats,
            thresholds: this.thresholds
        };
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    Doctor,
    MatchHealth,
    DEFAULT_THRESHOLDS,
    HEALTH_WEIGHTS
};
