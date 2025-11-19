/**
 * Tetra Analytics API Routes
 * Provides session analytics and user behavior insights
 */

import express from 'express';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { authMiddleware } from '../middleware/auth.js';

const execAsync = promisify(exec);
const router = express.Router();

// TSM script paths
const TSM_DIR = path.resolve(process.cwd(), '../tetra/bash/tsm');
const SESSION_AGGREGATOR = path.join(TSM_DIR, 'tsm_session_aggregator.sh');
const ANALYTICS_SCRIPT = path.join(TSM_DIR, 'tsm_analytics.sh');
const RESOURCE_MANAGER = path.join(TSM_DIR, 'tsm_resource_manager.sh');

// Safe execution with resource limits for macOS
const safeExecAsync = async (command, options = {}) => {
    const defaultOptions = {
        timeout: 30000,
        maxBuffer: 1024 * 1024, // 1MB buffer
        env: {
            ...process.env,
            TSM_MAX_CONCURRENT_PROCESSES: '3',
            TSM_PROCESS_TIMEOUT: '20'
        }
    };

    const mergedOptions = { ...defaultOptions, ...options };

    try {
        // Source resource manager and then run command
        const safeCommand = `source "${RESOURCE_MANAGER}" 2>/dev/null && ${command}`;
        return await execAsync(safeCommand, mergedOptions);
    } catch (error) {
        // If resource manager fails, try without it (fallback)
        if (error.code === 'EMFILE' || error.errno === -24) {
            console.warn('[Tetra API] EMFILE detected, using fallback execution');
            return await execAsync(command, { ...mergedOptions, timeout: 15000 });
        }
        throw error;
    }
};

// === SESSION ANALYTICS APIs ===

/**
 * GET /api/tetra/sessions/:service
 * Extract and analyze user sessions for a service
 */
router.get('/sessions/:service', authMiddleware, async (req, res) => {
    try {
        const { service } = req.params;
        const { window = 3600, format = 'json' } = req.query;

        // Track API call
        if (req.tetra) {
            req.tetra.trackAPICall('/api/tetra/sessions', 'GET', 0, 200);
        }

        const command = `${SESSION_AGGREGATOR} sessions "${service}" "${window}" "${format}"`;
        const { stdout, stderr } = await safeExecAsync(command);

        if (format === 'json') {
            try {
                const jsonData = JSON.parse(stdout);
                res.json({
                    success: true,
                    service,
                    timeWindow: parseInt(window),
                    data: jsonData
                });
            } catch (e) {
                // Fallback to text format if JSON parsing fails
                res.json({
                    success: true,
                    service,
                    timeWindow: parseInt(window),
                    data: { raw: stdout }
                });
            }
        } else {
            res.json({
                success: true,
                service,
                timeWindow: parseInt(window),
                data: { output: stdout }
            });
        }
    } catch (error) {
        console.error('[Tetra API] Session analysis error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze sessions',
            message: error.message
        });
    }
});

/**
 * GET /api/tetra/sessions/:service/summary
 * Get session summary statistics
 */
router.get('/sessions/:service/summary', authMiddleware, async (req, res) => {
    try {
        const { service } = req.params;
        const { window = 3600 } = req.query;

        const command = `${SESSION_AGGREGATOR} sessions "${service}" "${window}" "summary"`;
        const { stdout } = await safeExecAsync(command, { timeout: 15000 });

        // Parse summary statistics from output
        const stats = parseSummaryStats(stdout);

        res.json({
            success: true,
            service,
            timeWindow: parseInt(window),
            timestamp: Date.now(),
            stats
        });
    } catch (error) {
        console.error('[Tetra API] Session summary error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get session summary'
        });
    }
});

/**
 * GET /api/tetra/users/:service
 * Disambiguate and analyze user traffic
 */
router.get('/users/:service', authMiddleware, async (req, res) => {
    try {
        const { service } = req.params;
        const { window = 3600 } = req.query;

        const command = `${SESSION_AGGREGATOR} users "${service}" "${window}"`;
        const { stdout } = await execAsync(command, { timeout: 20000 });

        const userStats = parseUserStats(stdout);

        res.json({
            success: true,
            service,
            timeWindow: parseInt(window),
            timestamp: Date.now(),
            users: userStats
        });
    } catch (error) {
        console.error('[Tetra API] User analysis error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze users'
        });
    }
});

/**
 * GET /api/tetra/patterns/:service
 * Analyze user behavioral patterns
 */
router.get('/patterns/:service', authMiddleware, async (req, res) => {
    try {
        const { service } = req.params;
        const { user } = req.query;

        const command = user
            ? `${SESSION_AGGREGATOR} patterns "${service}" "${user}"`
            : `${SESSION_AGGREGATOR} patterns "${service}"`;

        const { stdout } = await execAsync(command, { timeout: 15000 });

        const patterns = parsePatternStats(stdout);

        res.json({
            success: true,
            service,
            user: user || 'all',
            timestamp: Date.now(),
            patterns
        });
    } catch (error) {
        console.error('[Tetra API] Pattern analysis error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze patterns'
        });
    }
});

// === CLICK ANALYTICS APIs ===

/**
 * GET /api/tetra/clicks/:service
 * Analyze click timing and patterns
 */
router.get('/clicks/:service', authMiddleware, async (req, res) => {
    try {
        const { service } = req.params;
        const { window = 300 } = req.query;

        const command = `${ANALYTICS_SCRIPT} clicks "${service}" "${window}"`;
        const { stdout } = await execAsync(command, { timeout: 15000 });

        const clickStats = parseClickStats(stdout);

        res.json({
            success: true,
            service,
            timeWindow: parseInt(window),
            timestamp: Date.now(),
            clicks: clickStats
        });
    } catch (error) {
        console.error('[Tetra API] Click analysis error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze clicks'
        });
    }
});

/**
 * GET /api/tetra/journey/:service
 * Get user journey timeline
 */
router.get('/journey/:service', authMiddleware, async (req, res) => {
    try {
        const { service } = req.params;
        const { session, window = 600 } = req.query;

        const command = session
            ? `${ANALYTICS_SCRIPT} journey "${service}" "${session}" "${window}"`
            : `${ANALYTICS_SCRIPT} journey "${service}" "" "${window}"`;

        const { stdout } = await execAsync(command, { timeout: 20000 });

        const journey = parseJourneyData(stdout);

        res.json({
            success: true,
            service,
            sessionId: session || null,
            timeWindow: parseInt(window),
            timestamp: Date.now(),
            journey
        });
    } catch (error) {
        console.error('[Tetra API] Journey analysis error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze user journey'
        });
    }
});

// === LIVE ANALYTICS APIs ===

/**
 * GET /api/tetra/live/:service
 * Get real-time analytics summary
 */
router.get('/live/:service', authMiddleware, async (req, res) => {
    try {
        const { service } = req.params;

        // Get multiple analytics in parallel
        const [sessionSummary, userStats, clickStats] = await Promise.allSettled([
            execAsync(`${SESSION_AGGREGATOR} sessions "${service}" 600 summary`),
            execAsync(`${SESSION_AGGREGATOR} users "${service}" 600`),
            execAsync(`${ANALYTICS_SCRIPT} clicks "${service}" 300`)
        ]);

        const liveData = {
            success: true,
            service,
            timestamp: Date.now(),
            timeWindow: {
                sessions: 600, // 10 minutes
                users: 600,
                clicks: 300    // 5 minutes
            },
            data: {}
        };

        if (sessionSummary.status === 'fulfilled') {
            liveData.data.sessions = parseSummaryStats(sessionSummary.value.stdout);
        }

        if (userStats.status === 'fulfilled') {
            liveData.data.users = parseUserStats(userStats.value.stdout);
        }

        if (clickStats.status === 'fulfilled') {
            liveData.data.clicks = parseClickStats(clickStats.value.stdout);
        }

        res.json(liveData);
    } catch (error) {
        console.error('[Tetra API] Live analytics error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get live analytics'
        });
    }
});

// === PARSING HELPER FUNCTIONS ===

function parseSummaryStats(output) {
    const stats = {
        totalSessions: 0,
        authenticatedSessions: 0,
        anonymousSessions: 0,
        totalEvents: 0,
        totalErrors: 0,
        avgEventsPerSession: 0
    };

    const lines = output.split('\n');

    for (const line of lines) {
        if (line.includes('Total Sessions:')) {
            stats.totalSessions = parseInt(line.match(/\d+/)?.[0] || '0');
        } else if (line.includes('Authenticated:')) {
            stats.authenticatedSessions = parseInt(line.match(/\d+/)?.[0] || '0');
        } else if (line.includes('Anonymous:')) {
            stats.anonymousSessions = parseInt(line.match(/\d+/)?.[0] || '0');
        } else if (line.includes('Total Events:')) {
            stats.totalEvents = parseInt(line.match(/\d+/)?.[0] || '0');
        } else if (line.includes('Total Errors:')) {
            stats.totalErrors = parseInt(line.match(/\d+/)?.[0] || '0');
        } else if (line.includes('Avg Events/Session:')) {
            stats.avgEventsPerSession = parseInt(line.match(/\d+/)?.[0] || '0');
        }
    }

    return stats;
}

function parseUserStats(output) {
    const users = [];
    const lines = output.split('\n');
    let inUserSection = false;

    for (const line of lines) {
        if (line.includes('Identified Users:')) {
            inUserSection = true;
            continue;
        }

        if (inUserSection && line.trim() && !line.includes('Potential Issues:')) {
            const match = line.match(/^\s*(\S+)\s+(\d+)\s+sessions\s+(\S+)-(\S+)\s+\((\d+)s\)\s+(\S+)/);
            if (match) {
                users.push({
                    identity: match[1],
                    sessions: parseInt(match[2]),
                    firstSeen: match[3],
                    lastSeen: match[4],
                    duration: parseInt(match[5]),
                    ip: match[6]
                });
            }
        }

        if (line.includes('Potential Issues:')) {
            break;
        }
    }

    return users;
}

function parseClickStats(output) {
    const stats = {
        totalClicks: 0,
        avgTimeBetween: 0,
        rapidSequences: 0,
        mostClicked: []
    };

    const lines = output.split('\n');

    for (const line of lines) {
        if (line.includes('Total Clicks:')) {
            stats.totalClicks = parseInt(line.match(/\d+/)?.[0] || '0');
        } else if (line.includes('Average Time Between Clicks:')) {
            stats.avgTimeBetween = parseInt(line.match(/\d+/)?.[0] || '0');
        }
    }

    return stats;
}

function parsePatternStats(output) {
    const patterns = {
        users: []
    };

    const lines = output.split('\n');
    let inSummarySection = false;

    for (const line of lines) {
        if (line.includes('User Activity Summary:')) {
            inSummarySection = true;
            continue;
        }

        if (inSummarySection && line.trim()) {
            const match = line.match(/^\s*(\S+):\s+(\d+)\s+clicks,\s+(\d+)\s+pages,\s+(\d+)\s+features(?:\s+\(peak:\s+(\d+):00\))?/);
            if (match) {
                patterns.users.push({
                    userId: match[1],
                    clicks: parseInt(match[2]),
                    pages: parseInt(match[3]),
                    features: parseInt(match[4]),
                    peakHour: match[5] ? parseInt(match[5]) : null
                });
            }
        }
    }

    return patterns;
}

function parseJourneyData(output) {
    const journey = {
        events: [],
        summary: {}
    };

    const lines = output.split('\n');
    let inTimelineSection = false;

    for (const line of lines) {
        if (line.includes('Event Timeline:')) {
            inTimelineSection = true;
            continue;
        }

        if (line.includes('Journey Summary:')) {
            inTimelineSection = false;
            continue;
        }

        if (inTimelineSection && line.trim()) {
            // Parse timeline events
            const timeMatch = line.match(/(\d{2}:\d{2}:\d{2})/);
            const tokenMatch = line.match(/TETRA:[A-Z_]+:[A-Z_]+/);

            if (timeMatch && tokenMatch) {
                journey.events.push({
                    time: timeMatch[1],
                    token: tokenMatch[0],
                    raw: line.trim()
                });
            }
        }
    }

    return journey;
}

// === TETRA CONFIGURATION APIs ===

/**
 * GET /api/tetra/config/debug
 * Get TETRA configuration debug info
 */
router.get('/config/debug', (req, res) => {
    try {
        const tetraConfig = req.app.locals.tetraConfig;

        if (!tetraConfig) {
            return res.json({
                available: false,
                error: 'TETRA config not initialized',
                env: {
                    TETRA_CONFIG: process.env.TETRA_CONFIG,
                    TETRA_SECRETS: process.env.TETRA_SECRETS,
                    TETRA_ORG: process.env.TETRA_ORG,
                    TETRA_ROOT: process.env.TETRA_ROOT
                }
            });
        }

        const debugInfo = tetraConfig.getDebugInfo();
        res.json({
            available: true,
            ...debugInfo,
            env: {
                TETRA_CONFIG: process.env.TETRA_CONFIG,
                TETRA_SECRETS: process.env.TETRA_SECRETS,
                TETRA_ORG: process.env.TETRA_ORG,
                TETRA_ROOT: process.env.TETRA_ROOT
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/tetra/config/publishing
 * Get publishing configurations from TETRA
 */
router.get('/config/publishing', (req, res) => {
    try {
        const tetraConfig = req.app.locals.tetraConfig;

        if (!tetraConfig) {
            return res.status(503).json({
                error: 'TETRA config not available',
                configs: []
            });
        }

        const configs = tetraConfig.getPublishingConfigs();
        res.json({ configs });
    } catch (error) {
        console.error('[Tetra API] Error getting publishing configs:', error);
        res.status(500).json({ error: error.message, configs: [] });
    }
});

/**
 * POST /api/tetra/config/reload
 * Reload TETRA configuration
 */
router.post('/config/reload', async (req, res) => {
    try {
        const tetraConfig = req.app.locals.tetraConfig;

        if (!tetraConfig) {
            return res.status(503).json({ error: 'TETRA config not available' });
        }

        await tetraConfig.load();
        const debugInfo = tetraConfig.getDebugInfo();

        res.json({
            success: true,
            message: 'Configuration reloaded',
            ...debugInfo
        });
    } catch (error) {
        console.error('[Tetra API] Error reloading config:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;