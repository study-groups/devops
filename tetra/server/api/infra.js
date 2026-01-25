/**
 * Infra API - Server infrastructure data per org
 *
 * Reads from ~/tetra/orgs/{org}/servers.json
 * Falls back to parsing [env.*] from tetra.toml
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');
const ORGS_DIR = path.join(TETRA_DIR, 'orgs');

/**
 * Parse simple TOML for [env.*] sections
 * Returns { envName: { key: value, ... }, ... }
 */
function parseTomlEnvs(content) {
    const envs = {};
    let currentEnv = null;

    for (const line of content.split('\n')) {
        const trimmed = line.trim();

        // Match [env.name] sections
        const sectionMatch = trimmed.match(/^\[env\.(\w+)\]$/);
        if (sectionMatch) {
            currentEnv = sectionMatch[1];
            envs[currentEnv] = {};
            continue;
        }

        // Skip if not in an env section or is a comment/empty
        if (!currentEnv || !trimmed || trimmed.startsWith('#')) continue;

        // Stop if we hit a non-env section
        if (trimmed.startsWith('[') && !trimmed.startsWith('[env.')) {
            currentEnv = null;
            continue;
        }

        // Parse key = "value" or key = value
        const kvMatch = trimmed.match(/^(\w+)\s*=\s*"?([^"]*)"?$/);
        if (kvMatch) {
            envs[currentEnv][kvMatch[1]] = kvMatch[2];
        }
    }

    return envs;
}

/**
 * Convert tetra.toml envs to servers format
 */
function envsToServers(envs) {
    const servers = {};
    let priority = 1;

    for (const [name, cfg] of Object.entries(envs)) {
        // Skip local env
        if (name === 'local') continue;

        // Need at least a host
        const ip = cfg.host_floating || cfg.host || cfg.host_private;
        if (!ip) continue;

        servers[name] = {
            ip,
            priority: priority++,
            status: 'active',
            description: cfg.description || cfg.domain || name,
            region: cfg.region,
            provider: cfg.provider
        };
    }

    return servers;
}

/**
 * GET /api/infra/data
 * Get infrastructure data for an org
 */
router.get('/data', (req, res) => {
    try {
        const org = req.query.org || 'tetra';
        const orgDir = path.join(ORGS_DIR, org);

        if (!fs.existsSync(orgDir)) {
            return res.json({ org, servers: {}, inventory: {} });
        }

        // Try servers.json first
        const serversJsonPath = path.join(orgDir, 'servers.json');
        if (fs.existsSync(serversJsonPath)) {
            const data = JSON.parse(fs.readFileSync(serversJsonPath, 'utf8'));
            return res.json({
                org,
                servers: data.servers || data,
                inventory: data.inventory || {}
            });
        }

        // Fall back to parsing tetra.toml
        const tetraTomlPath = path.join(orgDir, 'tetra.toml');
        if (fs.existsSync(tetraTomlPath)) {
            const content = fs.readFileSync(tetraTomlPath, 'utf8');
            const envs = parseTomlEnvs(content);
            const servers = envsToServers(envs);

            return res.json({
                org,
                servers,
                inventory: {}
            });
        }

        // No config found
        return res.json({ org, servers: {}, inventory: {} });

    } catch (error) {
        console.error('[API/infra] Error:', error);
        res.status(500).json({ error: 'Failed to get infrastructure data' });
    }
});

module.exports = router;
