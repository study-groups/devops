/**
 * Orgs API - List available organizations and serve workspace files
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');
const ORGS_DIR = path.join(TETRA_DIR, 'orgs');
const REPOS_TOML = path.join(ORGS_DIR, 'repos.toml');

/**
 * Parse repos.toml registry file
 * Returns object mapping org names to their config
 */
function parseReposToml() {
    if (!fs.existsSync(REPOS_TOML)) {
        return {};
    }

    const content = fs.readFileSync(REPOS_TOML, 'utf-8');
    const result = {};
    let currentOrg = null;

    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        // Section header: [org-name]
        const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
        if (sectionMatch) {
            currentOrg = sectionMatch[1];
            result[currentOrg] = {};
            continue;
        }

        // Key-value pair
        const kvMatch = trimmed.match(/^(\w+)\s*=\s*"([^"]*)"/);
        if (kvMatch && currentOrg) {
            result[currentOrg][kvMatch[1]] = kvMatch[2];
        }
    }

    return result;
}

/**
 * Write repos.toml registry file
 */
function writeReposToml(registry) {
    const lines = [];

    for (const [orgName, config] of Object.entries(registry)) {
        lines.push(`[${orgName}]`);
        for (const [key, value] of Object.entries(config)) {
            lines.push(`${key} = "${value}"`);
        }
        lines.push('');
    }

    fs.writeFileSync(REPOS_TOML, lines.join('\n'), 'utf-8');
}

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
            .filter(e => !e.name.startsWith('.') && e.name !== 'repos.toml')
            .map(e => e.name)
            .sort();

        res.json(orgs);
    } catch (error) {
        console.error('[API/orgs] Error listing orgs:', error);
        res.status(500).json({ error: 'Failed to list organizations' });
    }
});

/**
 * GET /api/orgs/registry
 * Get all registered orgs from repos.toml with clone status
 */
router.get('/registry', (req, res) => {
    try {
        const registry = parseReposToml();

        // Check which orgs are actually cloned (directory exists)
        const orgs = Object.entries(registry).map(([name, config]) => {
            const orgDir = path.join(ORGS_DIR, name);
            const isCloned = fs.existsSync(orgDir);

            return {
                id: name,
                repo: config.repo || null,
                games: config.games || null,
                alias: config.alias || null,
                description: config.description || null,
                nh_source: config.nh_source || null,
                cloned: isCloned
            };
        });

        res.json({ orgs, path: REPOS_TOML });
    } catch (error) {
        console.error('[API/orgs] Error reading registry:', error);
        res.status(500).json({ error: 'Failed to read registry' });
    }
});

/**
 * POST /api/orgs/registry
 * Add a new org to repos.toml
 */
router.post('/registry', express.json(), (req, res) => {
    try {
        const { id, repo, games, alias, description, nh_source } = req.body;

        if (!id || !repo) {
            return res.status(400).json({ error: 'id and repo are required' });
        }

        // Validate org name (alphanumeric, hyphens, underscores)
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
            return res.status(400).json({ error: 'Invalid org name' });
        }

        const registry = parseReposToml();

        if (registry[id]) {
            return res.status(409).json({ error: 'Org already exists in registry' });
        }

        registry[id] = { repo };
        if (games) registry[id].games = games;
        if (alias) registry[id].alias = alias;
        if (description) registry[id].description = description;
        if (nh_source) registry[id].nh_source = nh_source;

        writeReposToml(registry);

        res.json({ success: true, id, message: 'Org added to registry' });
    } catch (error) {
        console.error('[API/orgs] Error adding to registry:', error);
        res.status(500).json({ error: 'Failed to add to registry' });
    }
});

/**
 * PUT /api/orgs/registry/:org
 * Update an org in repos.toml
 */
router.put('/registry/:org', express.json(), (req, res) => {
    try {
        const { org } = req.params;
        const { repo, games, alias, description, nh_source } = req.body;

        const registry = parseReposToml();

        if (!registry[org]) {
            return res.status(404).json({ error: 'Org not found in registry' });
        }

        if (repo) registry[org].repo = repo;
        if (games !== undefined) {
            if (games) registry[org].games = games;
            else delete registry[org].games;
        }
        if (alias !== undefined) {
            if (alias) registry[org].alias = alias;
            else delete registry[org].alias;
        }
        if (description !== undefined) {
            if (description) registry[org].description = description;
            else delete registry[org].description;
        }
        if (nh_source !== undefined) {
            if (nh_source) registry[org].nh_source = nh_source;
            else delete registry[org].nh_source;
        }

        writeReposToml(registry);

        res.json({ success: true, org, message: 'Registry updated' });
    } catch (error) {
        console.error('[API/orgs] Error updating registry:', error);
        res.status(500).json({ error: 'Failed to update registry' });
    }
});

/**
 * DELETE /api/orgs/registry/:org
 * Remove an org from repos.toml (does not delete cloned directory)
 */
router.delete('/registry/:org', (req, res) => {
    try {
        const { org } = req.params;

        const registry = parseReposToml();

        if (!registry[org]) {
            return res.status(404).json({ error: 'Org not found in registry' });
        }

        delete registry[org];
        writeReposToml(registry);

        res.json({ success: true, org, message: 'Org removed from registry' });
    } catch (error) {
        console.error('[API/orgs] Error removing from registry:', error);
        res.status(500).json({ error: 'Failed to remove from registry' });
    }
});

/**
 * POST /api/orgs/:org/clone
 * Clone an org's config repo
 */
router.post('/:org/clone', express.json(), (req, res) => {
    try {
        const { org } = req.params;
        const registry = parseReposToml();

        if (!registry[org]) {
            return res.status(404).json({ error: 'Org not found in registry' });
        }

        const repo = registry[org].repo;
        if (!repo) {
            return res.status(400).json({ error: 'No repo URL configured' });
        }

        const orgDir = path.join(ORGS_DIR, org);
        if (fs.existsSync(orgDir)) {
            return res.status(409).json({ error: 'Org directory already exists', path: orgDir });
        }

        // Execute git clone
        const { execSync } = require('child_process');
        try {
            execSync(`git clone "${repo}" "${orgDir}"`, {
                encoding: 'utf8',
                timeout: 60000,
                stdio: ['pipe', 'pipe', 'pipe']
            });
        } catch (gitErr) {
            return res.status(500).json({
                error: 'Git clone failed',
                details: gitErr.stderr || gitErr.message
            });
        }

        res.json({
            success: true,
            org,
            path: orgDir,
            message: `Cloned ${repo} to ${orgDir}`
        });
    } catch (error) {
        console.error('[API/orgs] Error cloning org:', error);
        res.status(500).json({ error: 'Failed to clone org' });
    }
});

/**
 * GET /api/orgs/list
 * List orgs with rich metadata for dashboard
 * Merges cloned orgs with registry to show uncloned orgs too
 */
router.get('/list', (req, res) => {
    try {
        if (!fs.existsSync(ORGS_DIR)) return res.json({ orgs: [] });

        // Load registry to get all registered orgs
        const registry = parseReposToml();
        const registeredOrgs = new Set(Object.keys(registry));

        // Check active org via symlink
        let activeOrg = null;
        const configToml = path.join(TETRA_DIR, 'config', 'tetra.toml');
        try {
            if (fs.lstatSync(configToml).isSymbolicLink()) {
                const target = fs.readlinkSync(configToml);
                activeOrg = path.basename(path.dirname(target));
            }
        } catch (e) { /* no active org */ }

        const clonedOrgs = new Set();
        const entries = fs.readdirSync(ORGS_DIR, { withFileTypes: true });
        const orgs = entries
            .filter(e => (e.isDirectory() || e.isSymbolicLink()) && !e.name.startsWith('.') && e.name !== 'repos.toml')
            .map(e => {
                clonedOrgs.add(e.name);
                const orgDir = path.join(ORGS_DIR, e.name);
                // Resolve symlinks
                let realDir = orgDir;
                try { realDir = fs.realpathSync(orgDir); } catch (err) { /* ignore */ }

                const meta = getOrgMeta(realDir, e.name);
                meta.cloned = true;
                if (e.name === activeOrg) meta.active = true;

                // Merge registry data
                if (registry[e.name]) {
                    meta.repo = registry[e.name].repo;
                    if (registry[e.name].nh_source) meta.nhSource = registry[e.name].nh_source;
                    if (registry[e.name].games) meta.gamesRepo = registry[e.name].games;
                }

                // Check if it's a symlink (alias)
                try {
                    if (fs.lstatSync(orgDir).isSymbolicLink()) {
                        meta.alias = path.basename(fs.readlinkSync(orgDir));
                    }
                } catch (err) { /* ignore */ }

                return meta;
            });

        // Add uncloned orgs from registry
        for (const [orgName, config] of Object.entries(registry)) {
            if (!clonedOrgs.has(orgName)) {
                orgs.push({
                    id: orgName,
                    label: config.alias || orgName.substring(0, 2).toUpperCase(),
                    type: 'uncloned',
                    description: config.description || null,
                    repo: config.repo,
                    gamesRepo: config.games || null,
                    nhSource: config.nh_source || null,
                    cloned: false,
                    active: false,
                    hasWorkspace: false
                });
            }
        }

        orgs.sort((a, b) => a.id.localeCompare(b.id));

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

/**
 * GET /api/orgs/:org/sections
 * List section files for an organization
 */
router.get('/:org/sections', (req, res) => {
    try {
        const { org } = req.params;
        const sectionsDir = path.join(ORGS_DIR, org, 'sections');

        if (!fs.existsSync(sectionsDir)) {
            return res.json({ org, sections: [] });
        }

        const entries = fs.readdirSync(sectionsDir, { withFileTypes: true });
        const sections = entries
            .filter(e => e.isFile() && e.name.endsWith('.toml'))
            .map(e => {
                const filePath = path.join(sectionsDir, e.name);
                const stat = fs.statSync(filePath);
                return {
                    name: e.name,
                    size: stat.size,
                    modified: stat.mtime.toISOString()
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));

        res.json({ org, sections });
    } catch (error) {
        console.error('[API/orgs] Error listing sections:', error);
        res.status(500).json({ error: 'Failed to list sections' });
    }
});

/**
 * GET /api/orgs/:org/sections/:name
 * Get section content
 */
router.get('/:org/sections/:name', (req, res) => {
    try {
        const { org, name } = req.params;
        const filePath = path.join(ORGS_DIR, org, 'sections', name);

        // Security: ensure filename is safe
        if (name.includes('/') || name.includes('..')) {
            return res.status(400).json({ error: 'Invalid section name' });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Section not found' });
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const stat = fs.statSync(filePath);

        res.json({
            org,
            section: name,
            content,
            size: stat.size,
            modified: stat.mtime.toISOString()
        });
    } catch (error) {
        console.error('[API/orgs] Error reading section:', error);
        res.status(500).json({ error: 'Failed to read section' });
    }
});

/**
 * PUT /api/orgs/:org/sections/:name
 * Update section content
 */
router.put('/:org/sections/:name', (req, res) => {
    try {
        const { org, name } = req.params;
        const { content } = req.body;

        // Security: ensure filename is safe
        if (name.includes('/') || name.includes('..')) {
            return res.status(400).json({ error: 'Invalid section name' });
        }

        if (content === undefined) {
            return res.status(400).json({ error: 'Content required' });
        }

        const sectionsDir = path.join(ORGS_DIR, org, 'sections');
        const filePath = path.join(sectionsDir, name);

        // Create sections directory if needed
        if (!fs.existsSync(sectionsDir)) {
            fs.mkdirSync(sectionsDir, { recursive: true });
        }

        fs.writeFileSync(filePath, content, 'utf-8');
        const stat = fs.statSync(filePath);

        res.json({
            success: true,
            org,
            section: name,
            size: stat.size,
            modified: stat.mtime.toISOString()
        });
    } catch (error) {
        console.error('[API/orgs] Error writing section:', error);
        res.status(500).json({ error: 'Failed to write section' });
    }
});

/**
 * POST /api/orgs/:org/sections/validate
 * Validate TOML content without saving
 */
router.post('/:org/sections/validate', (req, res) => {
    try {
        const { content } = req.body;

        if (!content) {
            return res.json({ valid: false, error: 'Empty content' });
        }

        // Basic TOML validation
        const errors = [];
        const lines = content.split('\n');

        lines.forEach((line, i) => {
            const lineNum = i + 1;
            const trimmed = line.trim();

            // Skip comments and empty lines
            if (trimmed.startsWith('#') || trimmed === '') return;

            // Check section headers
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) return;

            // Check key-value pairs
            if (/^[a-zA-Z_][a-zA-Z0-9_]*\s*=/.test(trimmed)) return;

            // Check array items or continuations
            if (/^\s/.test(line)) return;
            if (/^".*",?$/.test(trimmed)) return;
            if (/^\]$/.test(trimmed)) return;

            errors.push({ line: lineNum, message: 'Unexpected format' });
        });

        if (errors.length === 0) {
            res.json({ valid: true });
        } else {
            res.json({ valid: false, errors: errors.slice(0, 10) });
        }
    } catch (error) {
        console.error('[API/orgs] Validation error:', error);
        res.status(500).json({ error: 'Validation failed' });
    }
});

/**
 * DELETE /api/orgs/:org/sections/:name
 * Delete a section file
 */
router.delete('/:org/sections/:name', (req, res) => {
    try {
        const { org, name } = req.params;

        // Security: ensure filename is safe
        if (name.includes('/') || name.includes('..')) {
            return res.status(400).json({ error: 'Invalid section name' });
        }

        const filePath = path.join(ORGS_DIR, org, 'sections', name);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Section not found' });
        }

        fs.unlinkSync(filePath);

        res.json({ success: true, org, section: name });
    } catch (error) {
        console.error('[API/orgs] Error deleting section:', error);
        res.status(500).json({ error: 'Failed to delete section' });
    }
});

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
