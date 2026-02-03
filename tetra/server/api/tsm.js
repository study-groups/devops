const express = require('express');
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { BASH } = require('../lib/bash');
const router = express.Router();

/**
 * TSM API - Tetra Service Manager
 * Supports local and remote (SSH) execution
 *
 * Query params:
 *   org - Organization (default: tetra)
 *   env - Environment (default: local)
 */

const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');
const ORGS_DIR = path.join(TETRA_DIR, 'orgs');

/**
 * Extract org/env/user from request (headers preferred, query fallback)
 */
function getContext(req) {
    return {
        org: req.get('X-Tetra-Org') || req.query.org || 'tetra',
        env: req.get('X-Tetra-Env') || req.query.env || 'local',
        user: req.get('X-Tetra-User') || req.query.user || ''
    };
}

// Simple TTL cache for expensive operations
const cache = new Map();
const CACHE_TTL = 5000; // 5 seconds

function getCached(key) {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.time < CACHE_TTL) {
        return entry.data;
    }
    return null;
}

function setCache(key, data) {
    cache.set(key, { data, time: Date.now() });
}

/**
 * Simple TOML parser for tetra-deploy.toml
 */
function parseToml(content) {
    const result = {};
    let currentSection = null;
    let currentSubsection = null;

    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
        if (sectionMatch) {
            const parts = sectionMatch[1].split('.');
            currentSection = parts[0];
            currentSubsection = parts.length > 1 ? parts[1] : null;
            if (!result[currentSection]) result[currentSection] = {};
            if (currentSubsection && !result[currentSection][currentSubsection]) {
                result[currentSection][currentSubsection] = {};
            }
            continue;
        }

        const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
        if (kvMatch && currentSection) {
            let value = kvMatch[2].trim();
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (value === 'true') value = true;
            else if (value === 'false') value = false;

            if (currentSubsection) {
                result[currentSection][currentSubsection][kvMatch[1]] = value;
            } else {
                result[currentSection][kvMatch[1]] = value;
            }
        }
    }
    return result;
}

/**
 * Get SSH config for org/env from tetra.toml
 * Format: [env.prod] host = "1.2.3.4" auth_user = "root"
 * Returns: "user@host" or null
 */
function getSSHConfig(org, env, user = null) {
    if (env === 'local') return null;

    // Primary: tetra.toml in org root
    const tomlPath = path.join(ORGS_DIR, org, 'tetra.toml');

    if (fs.existsSync(tomlPath)) {
        try {
            const content = fs.readFileSync(tomlPath, 'utf-8');
            const config = parseToml(content);
            const envConfig = config.env?.[env];

            if (envConfig?.host) {
                // Skip localhost
                if (envConfig.host === 'localhost' || envConfig.host === '127.0.0.1') {
                    return null;
                }
                // Use provided user, or config user fields, or default to root
                const sshUser = user || envConfig.user || envConfig.auth_user || 'root';
                return `${sshUser}@${envConfig.host}`;
            }
        } catch (e) {
            console.warn(`[TSM] Failed to parse ${tomlPath}:`, e.message);
        }
    }

    // Fallback: legacy tetra-deploy.toml paths
    const legacyDirs = ['targets/tetra', 'targets/tsm', 'targets'];
    for (const targetDir of legacyDirs) {
        const legacyPath = path.join(ORGS_DIR, org, targetDir, 'tetra-deploy.toml');
        if (fs.existsSync(legacyPath)) {
            try {
                const content = fs.readFileSync(legacyPath, 'utf-8');
                const config = parseToml(content);
                return config.env?.[env]?.ssh || null;
            } catch (e) {
                // ignore
            }
        }
    }

    return null;
}

/**
 * Run TSM command (local or remote)
 */
function runTsm(cmd, org = 'tetra', env = 'local', user = null) {
    const ssh = getSSHConfig(org, env, user);

    if (ssh) {
        // Remote execution via SSH
        const remoteCmd = `source ~/tetra/tetra.sh 2>/dev/null && ${cmd}`;
        const sshCmd = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${ssh} '${remoteCmd.replace(/'/g, "'\\''")}'`;
        return execSync(sshCmd, {
            shell: BASH,
            encoding: 'utf8',
            timeout: 30000
        });
    } else {
        // Local execution
        const fullCmd = `source ~/tetra/tetra.sh && ${cmd}`;
        return execSync(fullCmd, {
            shell: BASH,
            encoding: 'utf8',
            timeout: 10000
        });
    }
}

/**
 * Run TSM command async (local or remote)
 */
function runTsmAsync(cmd, org = 'tetra', env = 'local', callback) {
    const ssh = getSSHConfig(org, env);

    if (ssh) {
        const remoteCmd = `source ~/tetra/tetra.sh 2>/dev/null && ${cmd}`;
        const sshCmd = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${ssh} '${remoteCmd.replace(/'/g, "'\\''")}'`;
        exec(sshCmd, { shell: BASH, timeout: 30000 }, callback);
    } else {
        const fullCmd = `source ~/tetra/tetra.sh && ${cmd}`;
        exec(fullCmd, { shell: BASH, timeout: 10000 }, callback);
    }
}

// List services (JSON) - cached for 5 seconds
router.get('/ls', (req, res) => {
    const { org, env, user } = getContext(req);
    const cacheKey = `tsm:ls:${org}:${env}:${user}`;

    // Check cache first
    const cached = getCached(cacheKey);
    if (cached) {
        return res.json({ ...cached, cached: true });
    }

    try {
        const ssh = getSSHConfig(org, env, user || null);
        const output = runTsm('tsm ls --json', org, env, user || null);
        const services = JSON.parse(output);
        const result = {
            services,
            org,
            env,
            user: user || null,
            host: ssh ? ssh.split('@')[1] : 'localhost',
            remote: env !== 'local' && ssh !== null
        };
        setCache(cacheKey, result);
        res.json(result);
    } catch (err) {
        // Provide more context on SSH failures
        const ssh = getSSHConfig(org, env, user || null);
        res.status(500).json({
            error: err.message,
            services: [],
            org,
            env,
            user: user || null,
            host: ssh ? ssh.split('@')[1] : 'localhost',
            remote: env !== 'local' && ssh !== null,
            hint: ssh ? `SSH to ${ssh} failed` : `No SSH config for ${org}:${env}`
        });
    }
});

// Service status
router.get('/status', (req, res) => {
    const { org, env } = getContext(req);

    try {
        const output = runTsm('tsm ls --json', org, env);
        const services = JSON.parse(output);
        res.json({
            service: 'tsm',
            status: 'active',
            count: services.length,
            services,
            org,
            env,
            remote: env !== 'local'
        });
    } catch (err) {
        res.status(500).json({ error: err.message, org, env });
    }
});

// Start service
router.post('/start/:service', (req, res) => {
    const service = req.params.service;
    const { org, env } = getContext(req);

    runTsmAsync(`tsm start ${service}`, org, env, (err, stdout, stderr) => {
        if (err) {
            res.status(500).json({
                error: stderr || err.message,
                status: 'failed',
                org,
                env
            });
        } else {
            res.json({
                message: stdout.trim(),
                status: 'started',
                service,
                org,
                env
            });
        }
    });
});

// Stop service
router.post('/stop/:service', (req, res) => {
    const service = req.params.service;
    const { org, env } = getContext(req);

    runTsmAsync(`tsm stop ${service}`, org, env, (err, stdout, stderr) => {
        if (err) {
            res.status(500).json({
                error: stderr || err.message,
                status: 'failed',
                org,
                env
            });
        } else {
            res.json({
                message: stdout.trim(),
                status: 'stopped',
                service,
                org,
                env
            });
        }
    });
});

// Restart service
router.post('/restart/:service', (req, res) => {
    const service = req.params.service;
    const { org, env } = getContext(req);

    runTsmAsync(`tsm restart ${service}`, org, env, (err, stdout, stderr) => {
        if (err) {
            res.status(500).json({
                error: stderr || err.message,
                status: 'failed',
                org,
                env
            });
        } else {
            res.json({
                message: stdout.trim(),
                status: 'restarted',
                service,
                org,
                env
            });
        }
    });
});

// Check S3 configuration status
// NOTE: This route MUST come before /logs/:service to avoid being caught by the parameterized route
router.get('/logs/s3-status', (req, res) => {
    const { org, env } = getContext(req);

    try {
        // Check if TSM_LOG_S3_BUCKET is configured
        const output = runTsm('echo "${TSM_LOG_S3_BUCKET:-}"', org, env);
        const bucket = output.trim();

        res.json({
            configured: !!bucket,
            bucket: bucket || null,
            org,
            env
        });
    } catch (err) {
        res.json({
            configured: false,
            bucket: null,
            error: err.message,
            org,
            env
        });
    }
});

// Get service logs (tail)
// Query params:
//   lines - Number of lines (default: 50)
//   format - Output format: "text" (default) or "json"
//   since - Filter by time (e.g., "5m", "1h")
//   search - Text search filter (grep on server side)
//   timestamps - Add ISO timestamps to each line
router.get('/logs/:service', (req, res) => {
    const service = req.params.service;
    const { org, env, user } = getContext(req);
    const { lines = 50, format = 'text', since = '', search = '', timestamps = '' } = req.query;

    try {
        let cmd = `tsm logs ${service} -n ${lines}`;

        // Add timestamps if requested
        if (timestamps === 'true') {
            cmd += ' -t';
        }

        // Add since filter if provided
        if (since) {
            cmd += ` --since ${since}`;
        }

        // JSON format returns structured data with timestamps and delta
        if (format === 'json') {
            cmd += ' --json';
            const output = runTsm(cmd, org, env, user || null);

            try {
                const parsed = JSON.parse(output);
                res.json({
                    service,
                    entries: parsed.entries || [],
                    org,
                    env,
                    user: user || null,
                    format: 'json'
                });
            } catch (parseErr) {
                // Fallback if JSON parsing fails
                res.json({
                    service,
                    entries: [],
                    error: 'Failed to parse JSON output',
                    org,
                    env,
                    user: user || null
                });
            }
        } else {
            // Text format returns raw log output
            let output = runTsm(cmd, org, env, user || null);

            // Apply server-side search filter if provided
            if (search && output) {
                const searchLower = search.toLowerCase();
                const lines = output.split('\n');
                const filtered = lines.filter(line => line.toLowerCase().includes(searchLower));
                output = filtered.join('\n');
            }

            res.json({
                service,
                logs: output,
                org,
                env,
                user: user || null,
                format: 'text',
                search: search || null
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message, service, org, env, user: user || null });
    }
});

// Export logs to S3/Spaces
router.post('/logs/export/:service', (req, res) => {
    const service = req.params.service;
    const { org, env } = getContext(req);
    const { destination = 'spaces' } = req.query;

    runTsmAsync(`tsm logs export ${service} --destination ${destination}`, org, env, (err, stdout, stderr) => {
        if (err) {
            res.status(500).json({
                error: stderr || err.message,
                status: 'failed',
                service,
                org,
                env
            });
        } else {
            res.json({
                message: stdout.trim(),
                status: 'exported',
                service,
                org,
                env,
                destination
            });
        }
    });
});

// Patrol - single check pass
router.post('/patrol', (req, res) => {
    const { org, env } = getContext(req);

    runTsmAsync('tsm patrol --once --json', org, env, (err, stdout, stderr) => {
        if (err) {
            res.status(500).json({
                error: stderr || err.message,
                org,
                env
            });
        } else {
            try {
                const result = JSON.parse(stdout.trim());
                res.json({
                    ...result,
                    org,
                    env,
                    timestamp: Date.now()
                });
            } catch (parseErr) {
                res.json({
                    restarted: [],
                    message: stdout.trim(),
                    org,
                    env,
                    timestamp: Date.now()
                });
            }
        }
    });
});

// Service info - detailed metadata
router.get('/info/:service', (req, res) => {
    const service = req.params.service;
    const { org, env, user } = getContext(req);
    const cacheKey = `tsm:info:${org}:${env}:${service}`;

    // Check cache first
    const cached = getCached(cacheKey);
    if (cached) {
        return res.json({ ...cached, cached: true });
    }

    try {
        // Get tsm info output
        const output = runTsm(`tsm info ${service} --json 2>/dev/null || echo "{}"`, org, env, user || null);
        let info = {};
        try {
            info = JSON.parse(output.trim());
        } catch (e) {
            // Fallback: parse text output
            info = { raw: output.trim() };
        }

        const result = {
            service,
            info,
            org,
            env,
            timestamp: Date.now()
        };
        setCache(cacheKey, result);
        res.json(result);
    } catch (err) {
        res.status(500).json({
            error: err.message,
            service,
            org,
            env
        });
    }
});

// Health check - quick status
router.get('/health', (req, res) => {
    const { org, env } = getContext(req);

    try {
        const output = runTsm('tsm doctor --json 2>/dev/null || echo "{}"', org, env);
        let health = {};
        try {
            health = JSON.parse(output.trim());
        } catch (e) {
            health = { status: 'unknown' };
        }
        res.json({
            ...health,
            org,
            env,
            timestamp: Date.now()
        });
    } catch (err) {
        res.status(500).json({
            error: err.message,
            status: 'error',
            org,
            env
        });
    }
});

module.exports = router;
