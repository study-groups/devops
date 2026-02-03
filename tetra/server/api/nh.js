/**
 * NH API - Nodeholder Bridge integration
 * Manages doctl contexts and infrastructure data
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const { tetraExec, TETRA_SRC, TETRA_DIR, BASH } = require('../lib/tetra-exec');
const { execSync } = require('child_process');

/**
 * Execute nh_bridge command and return JSON result
 */
function nhbExec(cmd, timeout = 30000) {
    try {
        return tetraExec('nh_bridge', cmd, { timeout, json: true });
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

/**
 * POST /api/nh/:org/import
 * Import digocean.json into tetra sections (10-infrastructure.toml)
 */
router.post('/:org/import', (req, res) => {
    const { org } = req.params;
    const { confirm, noBuild } = req.body;

    if (!confirm) {
        return res.status(400).json({
            error: 'confirmation required',
            message: 'This will import infrastructure to tetra sections. Set confirm: true to proceed.',
            org
        });
    }

    try {
        const noBuildArg = noBuild ? 'no-build' : '';
        const fullCmd = `source ~/tetra/tetra.sh && tmod load nh_bridge && nhb_import ~/nh/${org}/digocean.json ${org} ${noBuildArg} 2>&1`;

        const output = execSync(fullCmd, {
            shell: BASH,
            encoding: 'utf8',
            timeout: 60000,
            env: { ...process.env, TETRA_SRC, TETRA_DIR }
        });

        // Parse output for key info
        const envMatch = output.match(/(\w+): (\S+) \(([^)]+)\)/g) || [];
        const environments = envMatch.map(m => {
            const parts = m.match(/(\w+): (\S+) \(([^)]+)\)/);
            return parts ? { env: parts[1], droplet: parts[2], ip: parts[3] } : null;
        }).filter(Boolean);

        const updatedMatch = output.match(/Updated: (.+)/);
        const updated = updatedMatch ? updatedMatch[1] : null;

        res.json({
            success: !output.includes('Error:') && !output.includes('error(s)'),
            org,
            environments,
            updated,
            built: !noBuild && !output.includes('Build aborted'),
            log: output
        });
    } catch (error) {
        res.status(500).json({ error: error.message, log: error.stdout || error.stderr });
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
