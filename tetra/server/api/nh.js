/**
 * NH API - Nodeholder Bridge integration
 * Manages doctl contexts and infrastructure data
 */
const express = require('express');
const router = express.Router();
const { execSync } = require('child_process');
const path = require('path');

const BASH = '/bin/bash';
const TETRA_SRC = process.env.TETRA_SRC || path.join(process.env.HOME, 'src/devops/tetra');
const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');

/**
 * Execute nh_bridge command and return JSON result
 */
function nhbExec(cmd, timeout = 30000) {
    const fullCmd = `source ~/tetra/tetra.sh && tmod load nh_bridge && ${cmd}`;
    try {
        const result = execSync(fullCmd, {
            shell: BASH,
            encoding: 'utf8',
            timeout,
            env: { ...process.env, TETRA_SRC, TETRA_DIR }
        });
        return JSON.parse(result.trim());
    } catch (error) {
        console.error('[API/nh] Command failed:', cmd, error.message);
        return { error: error.message };
    }
}

/**
 * GET /api/nh/status
 * NH availability and current context
 */
router.get('/status', (req, res) => {
    try {
        const available = nhbExec('nhb_check_available && echo \'{"available": true}\' || echo \'{"available": false}\'');
        const current = nhbExec('nhb_doctl_current');

        res.json({
            service: 'nh_bridge',
            available: available.available || false,
            current_context: current.current || null,
            nh_src: process.env.NH_SRC || path.join(process.env.HOME, 'src/devops/nh'),
            nh_dir: process.env.NH_DIR || path.join(process.env.HOME, 'nh')
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/nh/contexts
 * List doctl auth contexts
 */
router.get('/contexts', (req, res) => {
    try {
        const result = nhbExec('nhb_doctl_contexts_full');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/nh/contexts/current
 * Get current context name
 */
router.get('/contexts/current', (req, res) => {
    try {
        const result = nhbExec('nhb_doctl_current');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/nh/contexts/switch
 * Switch doctl context (requires confirm=true)
 */
router.post('/contexts/switch', (req, res) => {
    const { context, confirm } = req.body;

    if (!context) {
        return res.status(400).json({ error: 'context required' });
    }

    if (!confirm) {
        return res.status(400).json({
            error: 'confirmation required',
            message: 'Set confirm: true to switch context',
            context
        });
    }

    try {
        const result = nhbExec(`nhb_doctl_switch "${context}"`);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/nh/:org/status
 * NH sync status for an org
 */
router.get('/:org/status', (req, res) => {
    const { org } = req.params;

    try {
        const result = nhbExec(`nhb_api_status "${org}"`);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/nh/:org/fetch
 * Trigger digocean.json refresh
 */
router.post('/:org/fetch', (req, res) => {
    const { org } = req.params;
    const { confirm } = req.body;

    if (!confirm) {
        return res.status(400).json({
            error: 'confirmation required',
            message: 'This will fetch infrastructure from DigitalOcean. Set confirm: true to proceed.',
            org
        });
    }

    try {
        // This is a longer operation
        const result = nhbExec(`nhb_doctl_fetch "${org}"`, 120000);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/nh/:context/infrastructure
 * Get infrastructure summary for a context
 */
router.get('/:context/infrastructure', (req, res) => {
    const { context } = req.params;

    try {
        const result = nhbExec(`nhb_api_infrastructure "${context}"`);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/nh/:context/json-status
 * Get digocean.json status (age, size, counts)
 */
router.get('/:context/json-status', (req, res) => {
    const { context } = req.params;

    try {
        const result = nhbExec(`nhb_doctl_json_status "${context}"`);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Legacy endpoints for backwards compatibility
router.get('/servers', (req, res) => {
    res.json({
        servers: [],
        message: 'Use /api/nh/contexts for context-aware infrastructure'
    });
});

router.post('/provision', (req, res) => {
    res.json({
        message: 'Provisioning not available via API',
        status: 'use-cli',
        hint: 'Use nhb_fetch_latest or doctl directly'
    });
});

module.exports = router;
