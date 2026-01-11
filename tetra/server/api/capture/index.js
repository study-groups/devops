/**
 * Capture API - Unified Model
 *
 * One capture type with composable outputs:
 *   - url: Starting URL (optional if first step is goto)
 *   - steps: Actions to perform (optional) - uses Playwright action names
 *   - capture: What to capture ["screenshot", "dom", "text", "structure", "accessibility", "performance", "interactions", "semantic"]
 *   - preset: Shorthand for common capture combos ("quick", "full", "extract")
 *
 * Supported step actions (Playwright-standard):
 *   goto, click, fill, type, press, check, uncheck, selectOption, hover,
 *   wait, waitForTimeout, waitForSelector, waitForLoadState, evaluate, saveSession
 *
 * Storage: $TETRA_DIR/orgs/<org>/captures/<id>/
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const {
    getCaptureDir,
    getSessionDir,
    getSessionsDir,
    getJourneysDir,
    getJourneyPath,
    generateId,
    ensureDir,
    runPlaywrightScript
} = require('./helpers');

const { buildCaptureScript } = require('./scripts');

// Presets map to capture arrays
const PRESETS = {
    quick: ['screenshot', 'text'],
    full: ['screenshot', 'dom', 'text', 'structure', 'accessibility', 'performance'],
    extract: ['screenshot', 'interactions', 'semantic']
};

const VALID_CAPTURES = ['screenshot', 'dom', 'text', 'structure', 'accessibility', 'performance', 'interactions', 'semantic'];

// ============================================================================
// Main Capture Endpoint
// ============================================================================

/**
 * POST /api/capture
 * Unified capture endpoint
 */
router.post('/', async (req, res) => {
    try {
        const {
            url,
            org = 'tetra',
            steps = [],
            capture = ['screenshot'],
            preset,
            session,
            viewport
        } = req.body;

        // Validate viewport if provided
        if (viewport) {
            const { width, height } = viewport;
            if (!Number.isInteger(width) || !Number.isInteger(height) ||
                width < 320 || width > 3840 || height < 200 || height > 2160) {
                return res.status(400).json({
                    error: 'Invalid viewport dimensions. Width: 320-3840, Height: 200-2160'
                });
            }
        }

        // Resolve captures from preset or explicit list
        let captureList = preset ? PRESETS[preset] : capture;
        if (!captureList || !Array.isArray(captureList)) {
            captureList = ['screenshot'];
        }

        // Validate capture types
        const invalidCaptures = captureList.filter(c => !VALID_CAPTURES.includes(c));
        if (invalidCaptures.length > 0) {
            return res.status(400).json({
                error: `Invalid capture types: ${invalidCaptures.join(', ')}`,
                valid: VALID_CAPTURES
            });
        }

        // Need either url or a goto step
        const hasGoto = steps.some(s => s.action === 'goto');
        if (!url && !hasGoto) {
            return res.status(400).json({ error: 'url required (or first step must be goto)' });
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
        const outputDir = path.join(captureDir, id);
        ensureDir(outputDir);

        // Build and run script
        const script = buildCaptureScript({
            url,
            steps,
            captureList,
            outputDir,
            id,
            session,
            sessionsDir: getSessionsDir(org),
            viewport
        });

        // Timeout: base 30s + 20s per step + 10s per capture type
        const timeout = 30000 + (steps.length * 20000) + (captureList.length * 10000);

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
        const { org = 'tetra' } = req.query;
        const captureDir = getCaptureDir(org);

        if (!fs.existsSync(captureDir)) {
            return res.json([]);
        }

        const captures = [];
        const entries = fs.readdirSync(captureDir);

        for (const id of entries) {
            const idPath = path.join(captureDir, id);
            if (!fs.statSync(idPath).isDirectory()) continue;

            const manifestPath = path.join(idPath, 'manifest.json');
            if (fs.existsSync(manifestPath)) {
                try {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                    captures.push({
                        id,
                        url: manifest.url || manifest.finalUrl,
                        timestamp: manifest.timestamp,
                        title: manifest.title,
                        capture: manifest.capture,
                        stepCount: manifest.steps?.length || 0,
                        success: manifest.success !== false
                    });
                } catch {}
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
// Session Management
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
 * DELETE /api/capture/sessions/:org/:name
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

// ============================================================================
// Journey Templates (saved step sequences)
// ============================================================================

/**
 * GET /api/capture/journeys
 * List saved journey templates
 */
router.get('/journeys', (req, res) => {
    try {
        const { org = 'tetra' } = req.query;
        const journeysDir = getJourneysDir(org);

        if (!fs.existsSync(journeysDir)) {
            return res.json([]);
        }

        const journeys = fs.readdirSync(journeysDir)
            .filter(f => f.endsWith('.json'))
            .map(f => {
                const filePath = path.join(journeysDir, f);
                try {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    return { name: f.replace('.json', ''), ...data };
                } catch {
                    return { name: f.replace('.json', ''), error: 'Failed to read' };
                }
            });

        journeys.sort((a, b) => {
            const aTime = a.updated || a.created || '';
            const bTime = b.updated || b.created || '';
            return bTime.localeCompare(aTime);
        });

        res.json(journeys);

    } catch (error) {
        console.error('[API/capture] Journeys list error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/capture/journeys/:org/:name
 * Save a journey template
 */
router.post('/journeys/:org/:name', (req, res) => {
    try {
        const { org, name } = req.params;
        const { steps, capture, description } = req.body;

        if (!steps || !Array.isArray(steps)) {
            return res.status(400).json({ error: 'steps array required' });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
            return res.status(400).json({ error: 'Invalid name. Use only letters, numbers, dashes, underscores.' });
        }

        const journeysDir = getJourneysDir(org);
        ensureDir(journeysDir);

        const journeyPath = getJourneyPath(org, name);
        const isNew = !fs.existsSync(journeyPath);
        const now = new Date().toISOString();

        const journey = {
            steps,
            capture: capture || ['screenshot'],
            description: description || '',
            created: isNew ? now : (JSON.parse(fs.readFileSync(journeyPath, 'utf-8')).created || now),
            updated: now,
            stepCount: steps.length
        };

        fs.writeFileSync(journeyPath, JSON.stringify(journey, null, 2));

        res.json({ saved: true, name, isNew, stepCount: steps.length });

    } catch (error) {
        console.error('[API/capture] Journey save error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/capture/journeys/:org/:name
 */
router.delete('/journeys/:org/:name', (req, res) => {
    try {
        const { org, name } = req.params;
        const journeyPath = getJourneyPath(org, name);

        if (!fs.existsSync(journeyPath)) {
            return res.status(404).json({ error: 'Journey not found' });
        }

        fs.unlinkSync(journeyPath);
        res.json({ deleted: true, name });

    } catch (error) {
        console.error('[API/capture] Journey delete error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Capture Detail Routes
// ============================================================================

/**
 * GET /api/capture/:org/:id
 * Get capture manifest
 */
router.get('/:org/:id', (req, res) => {
    const { org, id } = req.params;
    const manifestPath = path.join(getCaptureDir(org), id, 'manifest.json');

    if (!fs.existsSync(manifestPath)) {
        return res.status(404).json({ error: 'Capture not found' });
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    res.json(manifest);
});

/**
 * GET /api/capture/:org/:id/file/:filename
 * Get any file from capture directory
 */
router.get('/:org/:id/file/:filename', (req, res) => {
    const { org, id, filename } = req.params;

    // Security: prevent path traversal
    if (filename.includes('..') || filename.includes('/')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(getCaptureDir(org), id, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(filePath);
});

/**
 * DELETE /api/capture/:org/:id
 * Delete a capture
 */
router.delete('/:org/:id', (req, res) => {
    try {
        const { org, id } = req.params;
        const captureDir = path.join(getCaptureDir(org), id);

        if (!fs.existsSync(captureDir)) {
            return res.status(404).json({ error: 'Capture not found' });
        }

        fs.rmSync(captureDir, { recursive: true, force: true });
        res.json({ deleted: true, id });

    } catch (error) {
        console.error('[API/capture] Delete error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
