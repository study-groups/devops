/**
 * Orgs API - List available organizations
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');
const ORGS_DIR = path.join(TETRA_DIR, 'orgs');

/**
 * GET /api/orgs
 * List all available organizations
 */
router.get('/', (req, res) => {
    try {
        if (!fs.existsSync(ORGS_DIR)) {
            return res.json([]);
        }

        const entries = fs.readdirSync(ORGS_DIR, { withFileTypes: true });
        const orgs = entries
            .filter(entry => entry.isDirectory())
            .filter(entry => !entry.name.startsWith('.'))
            .map(entry => entry.name)
            .sort();

        res.json(orgs);
    } catch (error) {
        console.error('[API/orgs] Error listing orgs:', error);
        res.status(500).json({ error: 'Failed to list organizations' });
    }
});

/**
 * GET /api/orgs/:org
 * Get details about a specific organization
 */
router.get('/:org', (req, res) => {
    try {
        const { org } = req.params;
        const orgDir = path.join(ORGS_DIR, org);

        if (!fs.existsSync(orgDir)) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        const entries = fs.readdirSync(orgDir, { withFileTypes: true });
        const subdirs = entries
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name);

        res.json({
            name: org,
            path: orgDir,
            hasTsm: subdirs.includes('tsm'),
            hasTargets: subdirs.includes('targets'),
            hasPlaywright: subdirs.includes('playwright'),
            subdirectories: subdirs
        });
    } catch (error) {
        console.error('[API/orgs] Error getting org details:', error);
        res.status(500).json({ error: 'Failed to get organization details' });
    }
});

module.exports = router;
