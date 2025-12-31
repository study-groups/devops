const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

/**
 * Logs API - Aggregated log viewing
 * Combines deploy history, server activity, and TSM logs
 */

const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');

// In-memory activity log (recent server events)
const activityLog = [];
const MAX_ACTIVITY = 100;

function addActivity(level, source, message) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        source,
        message
    };
    activityLog.unshift(entry);
    if (activityLog.length > MAX_ACTIVITY) {
        activityLog.pop();
    }
    return entry;
}

// Log server startup
addActivity('info', 'server', 'Logs API initialized');

// Get aggregated logs
router.get('/', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const source = req.query.source; // filter by source

    const logs = [];

    // Add activity logs
    activityLog.forEach(entry => {
        if (!source || entry.source === source) {
            logs.push(entry);
        }
    });

    // Add deploy history
    try {
        const deployLog = path.join(TETRA_DIR, 'deploy/logs/deploy.log');
        if (fs.existsSync(deployLog)) {
            const content = fs.readFileSync(deployLog, 'utf8');
            const lines = content.trim().split('\n').filter(Boolean).slice(-30);

            lines.forEach(line => {
                const parts = line.split('|').map(p => p.trim());
                if (!source || source === 'deploy') {
                    logs.push({
                        timestamp: parts[0] || '',
                        level: parts[4] === 'failed' ? 'error' : 'info',
                        source: 'deploy',
                        message: `${parts[3] || 'deploy'} ${parts[1]}:${parts[2]} - ${parts[4] || 'unknown'}`
                    });
                }
            });
        }
    } catch (err) {
        // Ignore errors reading deploy log
    }

    // Sort by timestamp descending
    logs.sort((a, b) => {
        const ta = new Date(a.timestamp).getTime() || 0;
        const tb = new Date(b.timestamp).getTime() || 0;
        return tb - ta;
    });

    res.json({ logs: logs.slice(0, limit) });
});

// Get activity log only
router.get('/activity', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json({ logs: activityLog.slice(0, limit) });
});

// Add activity entry (internal use)
router.post('/activity', (req, res) => {
    const { level = 'info', source = 'api', message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'message required' });
    }

    const entry = addActivity(level, source, message);
    res.json({ entry });
});

// Server-Sent Events for real-time log streaming
router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

    // Send recent logs
    activityLog.slice(0, 10).reverse().forEach(entry => {
        res.write(`data: ${JSON.stringify(entry)}\n\n`);
    });

    // Keep connection alive
    const heartbeat = setInterval(() => {
        res.write(`: heartbeat\n\n`);
    }, 30000);

    // Store writer for broadcasting
    const writer = (entry) => {
        try {
            res.write(`data: ${JSON.stringify(entry)}\n\n`);
        } catch (e) {
            // Connection closed
        }
    };

    // Add to broadcast list
    if (!router.streamWriters) {
        router.streamWriters = new Set();
    }
    router.streamWriters.add(writer);

    // Clean up on close
    req.on('close', () => {
        clearInterval(heartbeat);
        if (router.streamWriters) {
            router.streamWriters.delete(writer);
        }
    });
});

// Helper to broadcast to all SSE clients
router.broadcast = function(entry) {
    if (router.streamWriters) {
        router.streamWriters.forEach(writer => writer(entry));
    }
};

// Export addActivity for use by other modules
router.addActivity = addActivity;

module.exports = router;
