/**
 * Environments API - Environment configuration and remote execution
 *
 * Reads environment configs from tetra-deploy.toml files
 * Supports SSH-based remote command execution
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');
const ORGS_DIR = path.join(TETRA_DIR, 'orgs');

/**
 * Parse TOML file (simple parser for tetra-deploy.toml format)
 */
function parseToml(content) {
    const result = {};
    let currentSection = null;
    let currentSubsection = null;

    const lines = content.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) continue;

        // Section header [section] or [section.subsection]
        const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
        if (sectionMatch) {
            const parts = sectionMatch[1].split('.');
            if (parts.length === 1) {
                currentSection = parts[0];
                currentSubsection = null;
                if (!result[currentSection]) result[currentSection] = {};
            } else {
                currentSection = parts[0];
                currentSubsection = parts[1];
                if (!result[currentSection]) result[currentSection] = {};
                if (!result[currentSection][currentSubsection]) {
                    result[currentSection][currentSubsection] = {};
                }
            }
            continue;
        }

        // Key-value pair
        const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
        if (kvMatch && currentSection) {
            const key = kvMatch[1];
            let value = kvMatch[2].trim();

            // Remove quotes
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            // Parse booleans
            if (value === 'true') value = true;
            else if (value === 'false') value = false;

            // Store in appropriate location
            if (currentSubsection) {
                result[currentSection][currentSubsection][key] = value;
            } else {
                result[currentSection][key] = value;
            }
        }
    }

    return result;
}

/**
 * Find tetra-deploy.toml for an org
 */
function findDeployToml(org) {
    const orgDir = path.join(ORGS_DIR, org);
    const targetDirs = ['targets/tetra', 'targets/tsm', 'targets'];

    for (const targetDir of targetDirs) {
        const tomlPath = path.join(orgDir, targetDir, 'tetra-deploy.toml');
        if (fs.existsSync(tomlPath)) {
            return tomlPath;
        }
    }

    return null;
}

/**
 * Find and parse main tetra.toml for an org
 */
function getOrgConfig(org) {
    const tomlPath = path.join(ORGS_DIR, org, 'tetra.toml');
    if (!fs.existsSync(tomlPath)) return null;

    try {
        const content = fs.readFileSync(tomlPath, 'utf-8');
        return parseToml(content);
    } catch (e) {
        return null;
    }
}

/**
 * Get SSH connection string for org/env
 * Prefers tetra.toml (user+host), falls back to tetra-deploy.toml
 */
function getSSHForEnv(org, env) {
    if (env === 'local') return null;

    // First check tetra.toml
    const orgConfig = getOrgConfig(org);
    if (orgConfig?.env?.[env]) {
        const envConfig = orgConfig.env[env];
        if (envConfig.user && envConfig.host) {
            return `${envConfig.user}@${envConfig.host}`;
        }
    }

    // Fall back to tetra-deploy.toml
    const tomlPath = findDeployToml(org);
    if (tomlPath) {
        try {
            const content = fs.readFileSync(tomlPath, 'utf-8');
            const config = parseToml(content);
            if (config.env?.[env]?.ssh) {
                return config.env[env].ssh;
            }
        } catch (e) {}
    }

    return null;
}

/**
 * GET /api/environments?org=X
 * List environments for an organization
 */
router.get('/', (req, res) => {
    try {
        const { org } = req.query;

        if (!org) {
            return res.status(400).json({ error: 'org parameter required' });
        }

        // Always include local
        const environments = {
            local: { ssh: null, host: 'localhost' }
        };

        // First, read from main tetra.toml (has user + host format)
        const orgConfig = getOrgConfig(org);
        if (orgConfig?.env) {
            for (const [envName, envConfig] of Object.entries(orgConfig.env)) {
                if (envName === 'local') continue;

                // Construct SSH from user + host
                const user = envConfig.user || 'root';
                const host = envConfig.host;
                const ssh = host ? `${user}@${host}` : null;

                environments[envName] = {
                    ssh,
                    user,
                    host,
                    domain: envConfig.domain || null,
                    confirm: envConfig.confirm || false
                };
            }
        }

        // Then overlay with tetra-deploy.toml (may have explicit ssh field)
        const tomlPath = findDeployToml(org);
        if (tomlPath) {
            try {
                const content = fs.readFileSync(tomlPath, 'utf-8');
                const config = parseToml(content);

                if (config.env) {
                    for (const [envName, envConfig] of Object.entries(config.env)) {
                        // Merge with existing or create new
                        // tetra.toml ssh (from user+host) is authoritative
                        const existing = environments[envName] || {};
                        environments[envName] = {
                            ...existing,
                            // Only use deploy.toml ssh if tetra.toml didn't provide one
                            ssh: existing.ssh || envConfig.ssh || null,
                            user: existing.user || envConfig.user || null,
                            domain: envConfig.domain || existing.domain || null,
                            confirm: envConfig.confirm ?? existing.confirm ?? false
                        };
                    }
                }
            } catch (parseError) {
                console.warn(`[API/environments] Failed to parse ${tomlPath}:`, parseError);
            }
        }

        res.json(environments);
    } catch (error) {
        console.error('[API/environments] Error:', error);
        res.status(500).json({ error: 'Failed to list environments' });
    }
});

/**
 * POST /api/environments/exec
 * Execute command on environment (local or remote via SSH)
 */
router.post('/exec', async (req, res) => {
    try {
        const { org, env, command } = req.body;

        if (!org || !env || !command) {
            return res.status(400).json({ error: 'org, env, and command required' });
        }

        // Security: validate command (basic check)
        if (command.includes('rm -rf /') || command.includes('> /dev/sd')) {
            return res.status(403).json({ error: 'Dangerous command rejected' });
        }

        const ssh = getSSHForEnv(org, env);
        let result;

        if (env === 'local' || !ssh) {
            // Local execution
            try {
                const stdout = execSync(command, {
                    timeout: 30000,
                    encoding: 'utf-8',
                    env: { ...process.env, TETRA_DIR, TETRA_SRC: process.env.TETRA_SRC }
                });
                result = { stdout, stderr: '', exitCode: 0 };
            } catch (execError) {
                result = {
                    stdout: execError.stdout || '',
                    stderr: execError.stderr || execError.message,
                    exitCode: execError.status || 1
                };
            }
        } else {
            // Remote execution via SSH
            const sshCommand = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${ssh} '${command.replace(/'/g, "'\\''")}'`;

            try {
                const stdout = execSync(sshCommand, {
                    timeout: 60000,
                    encoding: 'utf-8'
                });
                result = { stdout, stderr: '', exitCode: 0 };
            } catch (execError) {
                result = {
                    stdout: execError.stdout || '',
                    stderr: execError.stderr || execError.message,
                    exitCode: execError.status || 1
                };
            }
        }

        res.json(result);
    } catch (error) {
        console.error('[API/environments] Exec error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/environments/test?org=X&env=Y
 * Test connection to environment
 */
router.get('/test', async (req, res) => {
    const { org, env } = req.query;

    if (!org || !env) {
        return res.status(400).json({ error: 'org and env parameters required' });
    }

    const start = Date.now();

    if (env === 'local') {
        return res.json({ ok: true, latency: 0, env: 'local' });
    }

    const ssh = getSSHForEnv(org, env);
    if (!ssh) {
        return res.json({ ok: false, error: 'No SSH config for environment' });
    }

    try {
        // Test SSH connection
        const sshCommand = `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no ${ssh} 'echo ok'`;
        execSync(sshCommand, { timeout: 10000, encoding: 'utf-8' });

        res.json({
            ok: true,
            latency: Date.now() - start,
            ssh
        });
    } catch (error) {
        res.json({
            ok: false,
            latency: Date.now() - start,
            error: error.message
        });
    }
});

module.exports = router;
