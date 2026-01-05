/**
 * Capture API - Route Definitions
 *
 * Modes:
 *   - quick: Screenshot + text content (fast, lightweight)
 *   - full: Rich extraction (structure, accessibility, performance)
 *   - journey: Multi-step capture with state tracking
 *   - extract: Interaction map for automation
 *
 * Storage: $TETRA_DIR/orgs/<org>/captures/
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const {
    getCaptureDir,
    getSessionDir,
    getSessionsDir,
    generateId,
    ensureDir,
    runPlaywrightScript
} = require('./helpers');

const {
    buildQuickScript,
    buildFullScript,
    buildJourneyScript,
    buildExtractScript
} = require('./scripts');

// ============================================================================
// Main Capture Endpoint
// ============================================================================

/**
 * POST /api/capture
 * Main capture endpoint
 */
router.post('/', async (req, res) => {
    try {
        const { url, org = 'tetra', mode = 'quick', steps, extract, session } = req.body;

        if (!url && mode !== 'journey') {
            return res.status(400).json({ error: 'url required' });
        }

        if (mode === 'journey' && (!steps || !Array.isArray(steps))) {
            return res.status(400).json({ error: 'steps array required for journey mode' });
        }

        // Validate session exists if specified
        if (session) {
            const sessionPath = path.join(getSessionDir(org, session), 'state.json');
            if (!fs.existsSync(sessionPath)) {
                return res.status(400).json({ error: `Session "${session}" not found` });
            }
        }

        const id = generateId();
        const captureDir = getCaptureDir(org);
        const outputDir = path.join(captureDir, mode, id);
        ensureDir(outputDir);

        // Session options for script builders
        const sessionOptions = {
            session,
            sessionsDir: getSessionsDir(org)
        };

        let script;
        let timeout = 60000;

        switch (mode) {
            case 'quick':
                script = buildQuickScript(url, outputDir, id, sessionOptions);
                break;
            case 'full':
                script = buildFullScript(url, outputDir, id, sessionOptions);
                timeout = 90000;
                break;
            case 'journey':
                script = buildJourneyScript(steps, outputDir, id, sessionOptions);
                timeout = steps.length * 30000 + 30000; // 30s per step + buffer
                break;
            case 'extract':
                script = buildExtractScript(url, outputDir, id, extract || ['interactions', 'semantic'], sessionOptions);
                break;
            default:
                return res.status(400).json({ error: `Unknown mode: ${mode}` });
        }

        const result = await runPlaywrightScript(script, outputDir, timeout);
        result.outputDir = outputDir;
        result.session = session || null;
        res.json(result);

    } catch (error) {
        console.error('[API/capture] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// List Endpoint
// ============================================================================

/**
 * GET /api/capture/list
 * List captures for an org
 */
router.get('/list', (req, res) => {
    try {
        const { org = 'tetra', mode } = req.query;
        const captureDir = getCaptureDir(org);

        if (!fs.existsSync(captureDir)) {
            return res.json([]);
        }

        const modes = mode ? [mode] : ['quick', 'full', 'journey', 'extract'];
        const captures = [];

        for (const m of modes) {
            const modeDir = path.join(captureDir, m);
            if (!fs.existsSync(modeDir)) continue;

            const ids = fs.readdirSync(modeDir).filter(f => {
                return fs.statSync(path.join(modeDir, f)).isDirectory();
            });

            for (const id of ids) {
                const metaPath = path.join(modeDir, id, m === 'journey' ? 'manifest.json' : 'meta.json');
                if (fs.existsSync(metaPath)) {
                    try {
                        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                        captures.push({
                            id,
                            mode: m,
                            url: meta.url || meta.finalUrl,
                            timestamp: meta.timestamp,
                            title: meta.title,
                            success: meta.success !== false
                        });
                    } catch {}
                }
            }
        }

        // Sort by timestamp descending
        captures.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.json(captures);

    } catch (error) {
        console.error('[API/capture] List error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Session Management (MUST come before wildcard /:org/:mode/:id routes)
// ============================================================================

/**
 * GET /api/capture/sessions
 * List all saved sessions for an org
 */
router.get('/sessions', (req, res) => {
    try {
        const { org = 'tetra' } = req.query;
        const sessionsDir = getSessionsDir(org);

        if (!fs.existsSync(sessionsDir)) {
            return res.json([]);
        }

        const sessions = fs.readdirSync(sessionsDir)
            .filter(name => {
                const metaPath = path.join(sessionsDir, name, 'meta.json');
                return fs.existsSync(metaPath);
            })
            .map(name => {
                const metaPath = path.join(sessionsDir, name, 'meta.json');
                try {
                    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                    return { name, ...meta };
                } catch {
                    return { name, error: 'Failed to read metadata' };
                }
            });

        // Sort by lastUsed/created descending
        sessions.sort((a, b) => {
            const aTime = a.lastUsed || a.created || '';
            const bTime = b.lastUsed || b.created || '';
            return bTime.localeCompare(aTime);
        });

        res.json(sessions);

    } catch (error) {
        console.error('[API/capture] Sessions list error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/capture/sessions/:org/:name
 * Get session metadata
 */
router.get('/sessions/:org/:name', (req, res) => {
    try {
        const { org, name } = req.params;
        const sessionDir = getSessionDir(org, name);
        const metaPath = path.join(sessionDir, 'meta.json');

        if (!fs.existsSync(metaPath)) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        res.json({ name, ...meta });

    } catch (error) {
        console.error('[API/capture] Session get error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/capture/sessions/:org/:name
 * Delete a saved session
 */
router.delete('/sessions/:org/:name', (req, res) => {
    try {
        const { org, name } = req.params;
        const sessionDir = getSessionDir(org, name);

        if (!fs.existsSync(sessionDir)) {
            return res.status(404).json({ error: 'Session not found' });
        }

        fs.rmSync(sessionDir, { recursive: true, force: true });
        res.json({ deleted: true, name, org });

    } catch (error) {
        console.error('[API/capture] Session delete error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/capture/sessions/:org/:name/touch
 * Update lastUsed timestamp for a session
 */
router.post('/sessions/:org/:name/touch', (req, res) => {
    try {
        const { org, name } = req.params;
        const sessionDir = getSessionDir(org, name);
        const metaPath = path.join(sessionDir, 'meta.json');

        if (!fs.existsSync(metaPath)) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        meta.lastUsed = new Date().toISOString();
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

        res.json({ touched: true, name, lastUsed: meta.lastUsed });

    } catch (error) {
        console.error('[API/capture] Session touch error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Capture Detail Routes (wildcard - must come after /sessions/*)
// ============================================================================

/**
 * GET /api/capture/:org/:mode/:id
 * Get capture metadata
 */
router.get('/:org/:mode/:id', (req, res) => {
    const { org, mode, id } = req.params;
    const metaFile = mode === 'journey' ? 'manifest.json' : 'meta.json';
    const metaPath = path.join(getCaptureDir(org), mode, id, metaFile);

    if (!fs.existsSync(metaPath)) {
        return res.status(404).json({ error: 'Capture not found' });
    }

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    res.json(meta);
});

/**
 * GET /api/capture/:org/:mode/:id/screenshot
 * Get screenshot image
 */
router.get('/:org/:mode/:id/screenshot', (req, res) => {
    const { org, mode, id } = req.params;
    const { step } = req.query;

    let screenshotPath;
    if (mode === 'journey') {
        const stepsDir = path.join(getCaptureDir(org), mode, id, 'steps');
        if (step) {
            const stepNum = String(step).padStart(3, '0');
            screenshotPath = path.join(stepsDir, `${stepNum}-after.png`);
        } else {
            // Find the last step screenshot
            if (fs.existsSync(stepsDir)) {
                const files = fs.readdirSync(stepsDir).filter(f => f.endsWith('-after.png')).sort();
                if (files.length > 0) {
                    screenshotPath = path.join(stepsDir, files[files.length - 1]);
                }
            }
        }
    } else {
        screenshotPath = path.join(getCaptureDir(org), mode, id, 'screenshot.png');
    }

    if (!screenshotPath || !fs.existsSync(screenshotPath)) {
        return res.status(404).json({ error: 'Screenshot not found' });
    }

    res.sendFile(screenshotPath);
});

/**
 * GET /api/capture/:org/:mode/:id/file/:filename
 * Get any file from capture directory
 */
router.get('/:org/:mode/:id/file/:filename', (req, res) => {
    const { org, mode, id, filename } = req.params;

    // Security: prevent path traversal
    if (filename.includes('..') || filename.includes('/')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(getCaptureDir(org), mode, id, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(filePath);
});

/**
 * DELETE /api/capture/:org/:mode/:id
 * Delete a capture
 */
router.delete('/:org/:mode/:id', (req, res) => {
    try {
        const { org, mode, id } = req.params;
        const captureDir = path.join(getCaptureDir(org), mode, id);

        if (!fs.existsSync(captureDir)) {
            return res.status(404).json({ error: 'Capture not found' });
        }

        // Recursively delete directory
        fs.rmSync(captureDir, { recursive: true, force: true });
        res.json({ deleted: true, id, mode });

    } catch (error) {
        console.error('[API/capture] Delete error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
