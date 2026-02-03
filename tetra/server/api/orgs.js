/**
 * Orgs API - List available organizations and serve workspace files
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');
const ORGS_DIR = path.join(TETRA_DIR, 'orgs');

// Simple TOML value extraction (handles quoted strings)
function getTomlValue(file, key) {
    try {
        const content = fs.readFileSync(file, 'utf-8');
        const regex = new RegExp(`^${key}\\s*=\\s*"?([^"\\n]*)"?`, 'm');
        const match = content.match(regex);
        return match ? match[1].trim() : null;
    } catch (e) {
        return null;
    }
}

// Generate label: read from TOML, fallback to first 2 chars uppercase
function orgLabel(name, sectionsDir) {
    const orgToml = path.join(sectionsDir, '00-org.toml');
    const label = getTomlValue(orgToml, 'label');
    return label || name.substring(0, 2).toUpperCase();
}

// Read org metadata from sections/*.toml
function getOrgMeta(orgDir, name) {
    const sectionsDir = path.join(orgDir, 'sections');
    const meta = {
        id: name,
        label: orgLabel(name, sectionsDir),
        type: 'unknown',
        hasWorkspace: fs.existsSync(path.join(orgDir, 'workspace')),
        active: false
    };

    const orgToml = path.join(sectionsDir, '00-org.toml');
    if (fs.existsSync(orgToml)) {
        meta.type = getTomlValue(orgToml, 'type') || 'unknown';
        const desc = getTomlValue(orgToml, 'description');
        if (desc) meta.description = desc;
        const platform = getTomlValue(orgToml, 'platform');
        if (platform) meta.platform = platform;
    } else {
        const mainToml = path.join(orgDir, 'tetra.toml');
        if (fs.existsSync(mainToml)) {
            meta.type = getTomlValue(mainToml, 'type') || 'unknown';
        }
    }

    // Check for alias (symlink target)
    try {
        const orgPath = path.join(ORGS_DIR, name);
        const stat = fs.lstatSync(orgPath);
        if (stat.isSymbolicLink()) {
            meta.alias = fs.readlinkSync(orgPath);
        }
    } catch (e) { /* ignore */ }

    return meta;
}

/**
 * GET /api/orgs
 * List all available organizations (simple name list)
 */
router.get('/', (req, res) => {
    try {
        if (!fs.existsSync(ORGS_DIR)) return res.json([]);

        const entries = fs.readdirSync(ORGS_DIR, { withFileTypes: true });
        const orgs = entries
            .filter(e => e.isDirectory() || e.isSymbolicLink())
            .filter(e => !e.name.startsWith('.'))
            .map(e => e.name)
            .sort();

        res.json(orgs);
    } catch (error) {
        console.error('[API/orgs] Error listing orgs:', error);
        res.status(500).json({ error: 'Failed to list organizations' });
    }
});

/**
 * GET /api/orgs/list
 * List orgs with rich metadata for dashboard
 */
router.get('/list', (req, res) => {
    try {
        if (!fs.existsSync(ORGS_DIR)) return res.json({ orgs: [] });

        // Check active org via symlink
        let activeOrg = null;
        const configToml = path.join(TETRA_DIR, 'config', 'tetra.toml');
        try {
            if (fs.lstatSync(configToml).isSymbolicLink()) {
                const target = fs.readlinkSync(configToml);
                activeOrg = path.basename(path.dirname(target));
            }
        } catch (e) { /* no active org */ }

        const entries = fs.readdirSync(ORGS_DIR, { withFileTypes: true });
        const orgs = entries
            .filter(e => (e.isDirectory() || e.isSymbolicLink()) && !e.name.startsWith('.'))
            .map(e => {
                const orgDir = path.join(ORGS_DIR, e.name);
                // Resolve symlinks
                let realDir = orgDir;
                try { realDir = fs.realpathSync(orgDir); } catch (err) { /* ignore */ }

                const meta = getOrgMeta(realDir, e.name);
                if (e.name === activeOrg) meta.active = true;

                // Check if it's a symlink (alias)
                try {
                    if (fs.lstatSync(orgDir).isSymbolicLink()) {
                        meta.alias = path.basename(fs.readlinkSync(orgDir));
                    }
                } catch (err) { /* ignore */ }

                return meta;
            })
            .sort((a, b) => a.id.localeCompare(b.id));

        res.json({ orgs });
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

        const meta = getOrgMeta(orgDir, org);

        res.json({
            ...meta,
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

/**
 * GET /api/orgs/:org/workspace
 * List workspace content files for an organization
 */
router.get('/:org/workspace', (req, res) => {
    try {
        const { org } = req.params;
        const orgDir = path.join(ORGS_DIR, org);

        if (!fs.existsSync(orgDir)) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        const contentDir = path.join(orgDir, 'workspace', 'content');
        const files = [];

        // List workspace/content/ files
        if (fs.existsSync(contentDir)) {
            const entries = fs.readdirSync(contentDir, { withFileTypes: true });
            entries.forEach(entry => {
                if (entry.isFile()) {
                    const ext = path.extname(entry.name).slice(1);
                    files.push({
                        name: entry.name,
                        path: `workspace/content/${entry.name}`,
                        type: ext || 'file'
                    });
                }
            });
        }

        // Also check workspace root for files
        const wsDir = path.join(orgDir, 'workspace');
        if (fs.existsSync(wsDir)) {
            const entries = fs.readdirSync(wsDir, { withFileTypes: true });
            entries.forEach(entry => {
                if (entry.isFile()) {
                    const ext = path.extname(entry.name).slice(1);
                    files.push({
                        name: entry.name,
                        path: `workspace/${entry.name}`,
                        type: ext || 'file'
                    });
                }
            });
        }

        res.json({ org, files });
    } catch (error) {
        console.error('[API/orgs] Error getting workspace:', error);
        res.status(500).json({ error: 'Failed to get workspace' });
    }
});

/**
 * GET /api/orgs/:org/file/*
 * Serve a raw file from org directory (HTML served as-is, others as JSON)
 */
router.get('/:org/file/*', (req, res) => {
    try {
        const { org } = req.params;
        const filePath = req.params[0];
        const orgDir = path.join(ORGS_DIR, org);
        const fullPath = path.resolve(orgDir, filePath);

        // Security: ensure path is within org directory
        if (!fullPath.startsWith(path.resolve(orgDir))) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            const entries = fs.readdirSync(fullPath, { withFileTypes: true });
            const files = entries.map(entry => ({
                name: entry.name,
                type: entry.isDirectory() ? 'directory' : 'file'
            }));
            return res.json({ path: filePath, files });
        }

        // Serve file with correct content type
        const ext = path.extname(fullPath).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml',
            '.pdf': 'application/pdf'
        };

        const contentType = mimeTypes[ext] || 'text/plain';
        res.setHeader('Content-Type', contentType);
        res.sendFile(fullPath);
    } catch (error) {
        console.error('[API/orgs] Error serving file:', error);
        res.status(500).json({ error: 'Failed to serve file' });
    }
});

/**
 * GET /api/orgs/:org/storage
 * Get S3/storage configuration for an organization
 */
router.get('/:org/storage', (req, res) => {
    try {
        const { org } = req.params;
        const orgDir = path.join(ORGS_DIR, org);

        if (!fs.existsSync(orgDir)) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        // Try to read storage config from tetra.toml
        const tetraToml = path.join(orgDir, 'tetra.toml');
        const sectionsStorage = path.join(orgDir, 'sections', '30-storage.toml');

        let bucket = null;
        let endpoint = null;
        let region = null;
        let prefix = null;

        // Check sections file first, then main tetra.toml
        const configFiles = [sectionsStorage, tetraToml];

        for (const configFile of configFiles) {
            if (fs.existsSync(configFile)) {
                try {
                    const content = fs.readFileSync(configFile, 'utf-8');

                    // Look for [storage.s3] section
                    const s3Section = content.match(/\[storage\.s3\]([\s\S]*?)(?=\n\[|$)/);
                    if (s3Section) {
                        const section = s3Section[1];
                        bucket = bucket || extractTomlValue(section, 'bucket');
                        endpoint = endpoint || extractTomlValue(section, 'endpoint');
                        region = region || extractTomlValue(section, 'region');
                        prefix = prefix || extractTomlValue(section, 'prefix');
                    }
                } catch (e) {
                    console.warn(`[API/orgs] Failed to parse ${configFile}:`, e.message);
                }
            }
        }

        // Check environment variables as fallback
        if (!bucket && process.env.TSM_LOG_S3_BUCKET) {
            bucket = process.env.TSM_LOG_S3_BUCKET;
        }
        if (!endpoint && process.env.TSM_LOG_S3_ENDPOINT) {
            endpoint = process.env.TSM_LOG_S3_ENDPOINT;
        }

        const configured = !!bucket;

        res.json({
            org,
            configured,
            bucket: bucket || null,
            endpoint: endpoint || 'https://nyc3.digitaloceanspaces.com',
            region: region || 'nyc3',
            prefix: prefix || 'tsm/logs/',
            source: bucket ? (fs.existsSync(sectionsStorage) ? 'sections/30-storage.toml' : 'tetra.toml') : 'none'
        });
    } catch (error) {
        console.error('[API/orgs] Error getting storage config:', error);
        res.status(500).json({ error: 'Failed to get storage configuration' });
    }
});

// Helper to extract TOML value from a section string
function extractTomlValue(section, key) {
    const regex = new RegExp(`^${key}\\s*=\\s*"?([^"\\n]*)"?`, 'm');
    const match = section.match(regex);
    return match ? match[1].trim() : null;
}

// Keep old workspace/* route for backwards compatibility
router.get('/:org/workspace/*', (req, res) => {
    try {
        const { org } = req.params;
        const filePath = req.params[0];
        const orgDir = path.join(ORGS_DIR, org);
        const fullPath = path.resolve(orgDir, 'workspace', filePath);

        if (!fullPath.startsWith(path.resolve(orgDir))) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            const entries = fs.readdirSync(fullPath, { withFileTypes: true });
            const files = entries.map(entry => ({
                name: entry.name,
                type: entry.isDirectory() ? 'directory' : 'file'
            }));
            res.json({ path: fullPath, files });
        } else {
            const content = fs.readFileSync(fullPath, 'utf-8');
            res.json({ path: fullPath, content });
        }
    } catch (error) {
        console.error('[API/orgs] Error getting file:', error);
        res.status(500).json({ error: 'Failed to get file' });
    }
});

module.exports = router;
