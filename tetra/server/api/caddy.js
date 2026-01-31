const express = require('express');
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { BASH } = require('../lib/bash');
const router = express.Router();

/**
 * Caddy API - Reverse proxy management
 * Supports local and remote (SSH) execution
 *
 * Local: Uses Caddy Admin API (localhost:2019) when available
 *        Falls back to $TETRA_DIR/orgs/$org/caddy/Caddyfile
 * Remote: Uses /etc/caddy/Caddyfile via SSH
 *
 * Query params:
 *   org - Organization (default: tetra)
 *   env - Environment (default: local)
 */

const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');
const ORGS_DIR = path.join(TETRA_DIR, 'orgs');
const CADDY_ADMIN_PORT = process.env.CADDY_ADMIN_PORT || 2019;

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
 * Query Caddy Admin API (local only)
 * @param {string} endpoint - API endpoint (e.g., 'config/', 'config/apps/http')
 * @returns {Promise<object|null>}
 */
function caddyApiGet(endpoint) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: CADDY_ADMIN_PORT,
            path: '/' + endpoint,
            method: 'GET',
            timeout: 3000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(null);
                }
            });
        });

        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.end();
    });
}

/**
 * POST to Caddy Admin API
 * @param {string} endpoint - API endpoint
 * @param {object} data - JSON data to post
 * @returns {Promise<{success: boolean, error?: string}>}
 */
function caddyApiPost(endpoint, data) {
    return new Promise((resolve) => {
        const postData = JSON.stringify(data);
        const options = {
            hostname: 'localhost',
            port: CADDY_ADMIN_PORT,
            path: '/' + endpoint,
            method: 'POST',
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({ success: res.statusCode >= 200 && res.statusCode < 300, data });
            });
        });

        req.on('error', (e) => resolve({ success: false, error: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'timeout' }); });
        req.write(postData);
        req.end();
    });
}

/**
 * Check if Caddy Admin API is available
 */
async function isCaddyApiAvailable() {
    const config = await caddyApiGet('config/');
    return config !== null;
}

/**
 * Get Caddy paths for org/env
 */
function getCaddyPaths(org, env) {
    if (env === 'local') {
        const caddyDir = path.join(ORGS_DIR, org, 'caddy');
        const logDir = path.join(TETRA_DIR, 'run', 'logs');
        return {
            caddyfile: path.join(caddyDir, 'Caddyfile'),
            modulesDir: path.join(caddyDir, 'modules'),
            logDir: logDir,
            logFile: path.join(logDir, 'caddy.log'),  // Standard local log path
            isLocal: true
        };
    } else {
        return {
            caddyfile: '/etc/caddy/Caddyfile',
            modulesDir: '/etc/caddy/modules',
            logDir: '/var/log/caddy',
            logFile: null,  // Multiple files, use glob on remote
            isLocal: false
        };
    }
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
 * Format: [env.prod] host = "1.2.3.4" work_user = "devops"
 * Returns: "user@host" or null
 */
function getSSHConfig(org, env) {
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
                // auth_user = SSH login user (root), work_user = app user (dev)
                const user = envConfig.auth_user || envConfig.user || 'root';
                return `${user}@${envConfig.host}`;
            }
        } catch (e) {
            console.warn(`[Caddy] Failed to parse ${tomlPath}:`, e.message);
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
 * Run command (local or remote)
 */
function runCmd(cmd, org = 'tetra', env = 'local') {
    const ssh = getSSHConfig(org, env);

    if (ssh) {
        const sshCmd = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${ssh} '${cmd.replace(/'/g, "'\\''")}'`;
        return execSync(sshCmd, {
            shell: BASH,
            encoding: 'utf8',
            timeout: 30000
        });
    } else {
        return execSync(cmd, {
            shell: BASH,
            encoding: 'utf8',
            timeout: 10000
        });
    }
}

/**
 * Parse Caddyfile content to extract routes with upstreams
 */
function parseRoutes(content, modulesDir, isLocal) {
    const routes = [];
    let currentHandle = null;

    // Process imports - read module files
    const lines = content.split('\n');
    let fullContent = '';

    for (const line of lines) {
        const importMatch = line.trim().match(/^import\s+(.+)$/);
        if (importMatch && isLocal) {
            const importPath = importMatch[1];
            // Resolve relative to modulesDir
            const modulePath = path.join(path.dirname(modulesDir), importPath);
            try {
                if (fs.existsSync(modulePath)) {
                    fullContent += '\n# ' + importPath + '\n';
                    fullContent += fs.readFileSync(modulePath, 'utf-8');
                }
            } catch (e) {
                // Ignore import errors
            }
        } else {
            fullContent += line + '\n';
        }
    }

    // Parse handle blocks with reverse_proxy
    const handleRegex = /handle\s+([^\{]+)\s*\{([^}]+)\}/g;
    let match;

    while ((match = handleRegex.exec(fullContent)) !== null) {
        const path = match[1].trim();
        const block = match[2];

        const proxyMatch = block.match(/reverse_proxy\s+(\S+)/);
        if (proxyMatch) {
            routes.push({
                path: path,
                upstream: proxyMatch[1],
                type: 'reverse_proxy'
            });
        }
    }

    // Also catch default handle blocks
    const defaultHandle = fullContent.match(/handle\s*\{([^}]+)\}/);
    if (defaultHandle) {
        const proxyMatch = defaultHandle[1].match(/reverse_proxy\s+(\S+)/);
        if (proxyMatch) {
            routes.push({
                path: '/*',
                upstream: proxyMatch[1],
                type: 'reverse_proxy (default)'
            });
        }
    }

    return routes;
}

// Info - show file paths and configuration locations
router.get('/info', (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const paths = getCaddyPaths(org, env);

    let exists = false;
    let modules = [];
    let snippets = false;
    let envModules = [];
    let envCaddyfiles = [];

    try {
        if (paths.isLocal) {
            exists = fs.existsSync(paths.caddyfile);
            const caddyDir = path.join(ORGS_DIR, org, 'caddy');

            // Check for snippets.caddy
            snippets = fs.existsSync(path.join(caddyDir, 'snippets.caddy'));

            // List env-specific Caddyfiles (dev.Caddyfile, staging.Caddyfile, prod.Caddyfile)
            try {
                envCaddyfiles = fs.readdirSync(caddyDir)
                    .filter(f => f.endsWith('.Caddyfile'))
                    .map(f => f.replace('.Caddyfile', ''));
            } catch (e) { /* ignore */ }

            // List modules for the relevant env
            const targetEnv = env === 'local' ? 'dev' : env;
            const envModDir = path.join(caddyDir, 'modules', targetEnv);
            if (fs.existsSync(envModDir)) {
                try {
                    envModules = fs.readdirSync(envModDir).filter(f => f.endsWith('.caddy'));
                } catch (e) { /* ignore */ }
            }

            // Legacy flat modules dir
            if (fs.existsSync(paths.modulesDir)) {
                try {
                    modules = fs.readdirSync(paths.modulesDir).filter(f => f.endsWith('.caddy'));
                } catch (e) { /* ignore */ }
            }
        } else {
            // Remote: check via SSH
            try {
                const output = runCmd(`test -f ${paths.caddyfile} && echo "exists"`, org, env);
                exists = output.trim() === 'exists';
            } catch (e) {
                exists = false;
            }

            // List remote modules if they exist
            try {
                const modOutput = runCmd(`ls ${paths.modulesDir}/*.caddy 2>/dev/null | xargs -n1 basename 2>/dev/null || echo ""`, org, env);
                modules = modOutput.trim().split('\n').filter(m => m && m.endsWith('.caddy'));
            } catch (e) { /* ignore */ }
        }
    } catch (e) {
        // Ignore errors in info gathering
    }

    res.json({
        caddyfile: paths.caddyfile,
        modulesDir: paths.modulesDir,
        logDir: paths.logDir,
        exists,
        modules,
        snippets,
        envModules,
        envCaddyfiles,
        org,
        env,
        isLocal: paths.isLocal
    });
});

// Status - check if caddy is running (uses admin API for local) - cached
router.get('/status', async (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const cacheKey = `caddy:status:${org}:${env}`;

    // Check cache first
    const cached = getCached(cacheKey);
    if (cached) {
        return res.json({ ...cached, cached: true });
    }

    const paths = getCaddyPaths(org, env);
    const ssh = getSSHConfig(org, env);

    try {
        let active = false;
        let version = '';
        let pid = null;
        let listen = null;
        let adminApi = null;
        let servers = 0;

        if (paths.isLocal) {
            // Try Caddy Admin API first
            const config = await caddyApiGet('config/');

            if (config) {
                active = true;
                adminApi = `localhost:${CADDY_ADMIN_PORT}`;

                // Extract info from API response
                if (config.apps?.http?.servers) {
                    servers = Object.keys(config.apps.http.servers).length;
                    // Get first server's listen address
                    const firstServer = Object.values(config.apps.http.servers)[0];
                    if (firstServer?.listen) {
                        listen = firstServer.listen.join(', ');
                    }
                }

                // Get version
                try {
                    version = execSync('caddy version 2>/dev/null | head -1', {
                        shell: BASH, encoding: 'utf8', timeout: 3000
                    }).trim().split(' ')[0];
                } catch (e) { /* ignore */ }
            } else {
                // Fallback to process check
                try {
                    const pgrep = execSync('pgrep -f "caddy run" 2>/dev/null || echo ""', {
                        shell: BASH, encoding: 'utf8', timeout: 3000
                    }).trim();
                    active = pgrep.length > 0;
                    if (active) {
                        pid = pgrep.split('\n')[0];
                    }
                } catch (e) { /* not running */ }
            }
        } else {
            // Remote: Check systemd service
            const output = runCmd('systemctl is-active caddy 2>/dev/null || echo "inactive"', org, env);
            active = output.trim() === 'active';

            if (active) {
                // Get listening ports on remote
                try {
                    const ss = runCmd("ss -tlnp 2>/dev/null | grep caddy | head -1 | awk '{print $4}' || echo ''", org, env).trim();
                    if (ss) listen = ss;
                } catch (e) { /* ignore */ }

                try {
                    version = runCmd('caddy version 2>/dev/null | head -1', org, env).trim().split(' ')[0];
                } catch (e) { /* ignore */ }
            }
        }

        const result = {
            service: 'caddy',
            status: active ? 'online' : 'offline',
            version,
            pid,
            listen,
            adminApi,
            servers,
            host: ssh || 'localhost',
            caddyfile: paths.caddyfile,
            logFile: paths.logFile || paths.logDir,
            org,
            env,
            remote: env !== 'local'
        };
        setCache(cacheKey, result);
        res.json(result);
    } catch (err) {
        res.status(500).json({
            error: err.message,
            status: 'error',
            org,
            env
        });
    }
});

// Routes - list configured routes with their upstreams (uses admin API for local) - cached
router.get('/routes', async (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const cacheKey = `caddy:routes:${org}:${env}`;

    // Check cache first
    const cached = getCached(cacheKey);
    if (cached) {
        return res.json({ ...cached, cached: true });
    }

    const paths = getCaddyPaths(org, env);

    try {
        let routes = [];

        if (paths.isLocal) {
            // Try Caddy Admin API first
            const config = await caddyApiGet('config/apps/http/servers');

            if (config) {
                // Parse routes from API response
                for (const [serverName, server] of Object.entries(config)) {
                    if (server.routes) {
                        for (const route of server.routes) {
                            // Extract path matchers
                            let pathMatch = '/*';
                            if (route.match) {
                                for (const matcher of route.match) {
                                    if (matcher.path) pathMatch = matcher.path.join(', ');
                                    if (matcher.host) pathMatch = matcher.host.join(', ');
                                }
                            }

                            // Extract handlers
                            if (route.handle) {
                                for (const handler of route.handle) {
                                    if (handler.handler === 'reverse_proxy' && handler.upstreams) {
                                        const upstreams = handler.upstreams.map(u => u.dial).join(', ');
                                        routes.push({
                                            path: pathMatch,
                                            upstream: upstreams,
                                            type: 'reverse_proxy',
                                            server: serverName
                                        });
                                    } else if (handler.handler === 'file_server') {
                                        routes.push({
                                            path: pathMatch,
                                            upstream: handler.root || '.',
                                            type: 'file_server',
                                            server: serverName
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                // Fallback: read and parse Caddyfile with imports
                let content = '';
                if (fs.existsSync(paths.caddyfile)) {
                    content = fs.readFileSync(paths.caddyfile, 'utf-8');
                }
                routes = parseRoutes(content, paths.modulesDir, true);
            }
        } else {
            // Remote: use grep to extract reverse_proxy lines
            try {
                const cmd = `grep -E 'reverse_proxy' ${paths.caddyfile} 2>/dev/null || echo ""`;
                const output = runCmd(cmd, org, env);

                // Parse: "reverse_proxy /path backend" or "reverse_proxy backend"
                const lines = output.split('\n').map(l => l.trim()).filter(l => l);

                for (const line of lines) {
                    // Skip import statements
                    if (line.includes('import ')) continue;

                    // Match: reverse_proxy /path localhost:port or reverse_proxy localhost:port
                    const match = line.match(/reverse_proxy\s+(\S+)\s+(localhost:\d+|[\d.]+:\d+)/);
                    if (match) {
                        routes.push({
                            path: match[1],
                            upstream: match[2],
                            type: 'reverse_proxy'
                        });
                    } else {
                        // Match: reverse_proxy localhost:port (no path = default)
                        const simpleMatch = line.match(/reverse_proxy\s+(localhost:\d+|[\d.]+:\d+)/);
                        if (simpleMatch) {
                            routes.push({
                                path: '/*',
                                upstream: simpleMatch[1],
                                type: 'reverse_proxy'
                            });
                        }
                    }
                }
            } catch (e) {
                // Fall back to empty routes
            }
        }

        const result = {
            routes,
            count: routes.length,
            caddyfile: paths.caddyfile,
            org,
            env
        };
        setCache(cacheKey, result);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message, routes: [], org, env });
    }
});

// Logs - get recent caddy logs (parsed JSON)
router.get('/logs', (req, res) => {
    const { org = 'tetra', env = 'local', lines = 50 } = req.query;
    const paths = getCaddyPaths(org, env);

    try {
        if (paths.isLocal) {
            // Local caddy logs from configured log path
            const logFile = paths.logFile;

            if (fs.existsSync(logFile)) {
                const content = fs.readFileSync(logFile, 'utf-8');
                const logLines = content.split('\n').slice(-parseInt(lines)).filter(l => l);

                // Parse JSON logs (same format as remote)
                const logs = logLines.map(line => {
                    try {
                        const parsed = JSON.parse(line);
                        // Extract fields like remote does
                        if (parsed.request) {
                            return {
                                ts: parsed.ts,
                                status: parsed.status,
                                method: parsed.request?.method,
                                host: parsed.request?.host,
                                uri: parsed.request?.uri,
                                duration: parsed.duration,
                                remote_ip: parsed.request?.remote_ip || parsed.request?.client_ip
                            };
                        }
                        // Non-request log (startup, error, etc)
                        return {
                            ts: parsed.ts,
                            level: parsed.level,
                            msg: parsed.msg,
                            logger: parsed.logger
                        };
                    } catch (e) {
                        // Not JSON, return as raw
                        return { raw: line };
                    }
                });

                res.json({
                    logs,
                    count: logs.length,
                    source: logFile,
                    org,
                    env
                });
                return;
            }

            res.json({
                logs: [],
                count: 0,
                message: `No caddy.log found. Configure logging in Caddyfile to: ${logFile}`,
                source: logFile,
                org,
                env
            });
            return;
        }

        // Remote - parse JSON logs
        const cmd = `tail -n ${lines} ${paths.logDir}/*.log 2>/dev/null | jq -c 'select(.request) | {ts: .ts, status: .status, method: .request.method, host: .request.host, uri: .request.uri, duration: .duration}' 2>/dev/null || tail -n ${lines} ${paths.logDir}/*.log 2>/dev/null || echo ''`;
        const output = runCmd(cmd, org, env);

        const logs = output.trim().split('\n').filter(l => l && l.startsWith('{')).map(line => {
            try {
                return JSON.parse(line);
            } catch (e) {
                return { raw: line };
            }
        });

        res.json({
            logs,
            count: logs.length,
            source: paths.logDir,
            org,
            env
        });
    } catch (err) {
        res.status(500).json({ error: err.message, logs: [], org, env });
    }
});

// Errors - get recent errors only
router.get('/errors', (req, res) => {
    const { org = 'tetra', env = 'local', lines = 50 } = req.query;
    const paths = getCaddyPaths(org, env);

    try {
        if (paths.isLocal) {
            // Local errors from caddy.log
            const logFile = paths.logFile;

            if (fs.existsSync(logFile)) {
                const content = fs.readFileSync(logFile, 'utf-8');
                const logLines = content.split('\n').filter(l => l);

                // Filter for errors (5xx status or level=error)
                const errors = [];
                for (const line of logLines) {
                    try {
                        const parsed = JSON.parse(line);
                        const isError = parsed.level === 'error' ||
                                       (parsed.status && parsed.status >= 500);
                        if (isError) {
                            errors.push({
                                ts: parsed.ts,
                                status: parsed.status,
                                level: parsed.level,
                                msg: parsed.msg,
                                uri: parsed.request?.uri
                            });
                        }
                    } catch (e) {
                        // Not JSON, check for error keywords
                        if (line.toLowerCase().includes('error')) {
                            errors.push({ raw: line });
                        }
                    }
                }

                res.json({
                    errors: errors.slice(-parseInt(lines)),
                    count: errors.length,
                    source: logFile,
                    org,
                    env
                });
                return;
            }

            res.json({
                errors: [],
                count: 0,
                message: 'No caddy.log found',
                source: logFile,
                org,
                env
            });
            return;
        }

        const cmd = `cat ${paths.logDir}/*.log 2>/dev/null | jq -c 'select(.level == "error" or (.status // 0) >= 500) | {ts: .ts, status: .status, level: .level, msg: .msg, uri: .request.uri}' 2>/dev/null | tail -n ${lines} || echo ''`;
        const output = runCmd(cmd, org, env);

        const errors = output.trim().split('\n').filter(l => l && l.startsWith('{')).map(line => {
            try {
                return JSON.parse(line);
            } catch (e) {
                return { raw: line };
            }
        });

        res.json({
            errors,
            count: errors.length,
            org,
            env
        });
    } catch (err) {
        res.status(500).json({ error: err.message, errors: [], org, env });
    }
});

// Running config from admin API (JSON)
router.get('/config/running', async (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const paths = getCaddyPaths(org, env);

    try {
        if (paths.isLocal) {
            const config = await caddyApiGet('config/');
            if (config) {
                res.json({
                    config,
                    source: 'admin-api',
                    adminApi: `localhost:${CADDY_ADMIN_PORT}`,
                    org,
                    env
                });
            } else {
                res.json({
                    config: null,
                    source: 'admin-api',
                    message: 'Caddy admin API not responding',
                    org,
                    env
                });
            }
        } else {
            // Remote: try to query admin API via SSH
            try {
                const output = runCmd(`curl -sf http://localhost:2019/config/ 2>/dev/null || echo '{}'`, org, env);
                const config = JSON.parse(output.trim() || '{}');
                res.json({
                    config,
                    source: 'admin-api-remote',
                    org,
                    env
                });
            } catch (e) {
                res.json({
                    config: null,
                    source: 'admin-api-remote',
                    message: 'Failed to query remote admin API',
                    org,
                    env
                });
            }
        }
    } catch (err) {
        res.status(500).json({ error: err.message, org, env });
    }
});

// Config - show Caddyfile with resolved imports
router.get('/config', (req, res) => {
    const { org = 'tetra', env = 'local', resolve = 'false' } = req.query;
    const paths = getCaddyPaths(org, env);

    try {
        let content = '';

        if (paths.isLocal) {
            if (fs.existsSync(paths.caddyfile)) {
                content = fs.readFileSync(paths.caddyfile, 'utf-8');

                // Optionally resolve imports
                if (resolve === 'true') {
                    const lines = content.split('\n');
                    let resolved = '';
                    for (const line of lines) {
                        const importMatch = line.trim().match(/^import\s+(.+)$/);
                        if (importMatch) {
                            const modulePath = path.join(path.dirname(paths.caddyfile), importMatch[1]);
                            resolved += `# --- ${importMatch[1]} ---\n`;
                            if (fs.existsSync(modulePath)) {
                                resolved += fs.readFileSync(modulePath, 'utf-8') + '\n';
                            } else {
                                resolved += `# (file not found)\n`;
                            }
                        } else {
                            resolved += line + '\n';
                        }
                    }
                    content = resolved;
                }
            } else {
                content = '# Caddyfile not found: ' + paths.caddyfile;
            }
        } else {
            content = runCmd(`cat ${paths.caddyfile} 2>/dev/null || echo "# No Caddyfile found"`, org, env);
        }

        res.json({
            config: content,
            caddyfile: paths.caddyfile,
            org,
            env
        });
    } catch (err) {
        res.status(500).json({ error: err.message, config: '', org, env });
    }
});

// Reload - reload caddy config (uses admin API for local)
router.post('/reload', async (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const paths = getCaddyPaths(org, env);

    try {
        let output = '';
        let method = '';

        if (paths.isLocal) {
            // Try Admin API first
            const apiAvailable = await isCaddyApiAvailable();

            if (apiAvailable) {
                // Convert Caddyfile to JSON and POST to /load
                try {
                    const adaptOutput = execSync(`caddy adapt --config "${paths.caddyfile}" 2>&1`, {
                        shell: BASH,
                        encoding: 'utf8',
                        timeout: 10000
                    });

                    const jsonConfig = JSON.parse(adaptOutput);
                    const result = await caddyApiPost('load', jsonConfig);

                    if (result.success) {
                        output = 'Config reloaded via admin API';
                        method = 'admin-api';
                    } else {
                        output = `API reload failed: ${result.error}`;
                        method = 'admin-api-failed';
                    }
                } catch (e) {
                    output = `Failed to adapt Caddyfile: ${e.message}`;
                    method = 'adapt-failed';
                }
            } else {
                // Fallback to caddy reload command
                try {
                    output = execSync(`caddy reload --config "${paths.caddyfile}" 2>&1`, {
                        shell: BASH,
                        encoding: 'utf8',
                        timeout: 10000
                    });
                    method = 'caddy-reload';
                } catch (e) {
                    // Last resort: signal
                    output = execSync(`pkill -USR1 -f "caddy run" 2>&1 || echo "No caddy process found"`, {
                        shell: BASH,
                        encoding: 'utf8',
                        timeout: 5000
                    });
                    method = 'signal';
                }
            }
        } else {
            output = runCmd('systemctl reload caddy 2>&1', org, env);
            method = 'systemctl';
        }

        res.json({
            message: 'Caddy reload requested',
            output: output.trim(),
            method,
            org,
            env
        });
    } catch (err) {
        res.status(500).json({ error: err.message, org, env });
    }
});

// Deploy - push full config tree to remote via _caddy_deploy
router.post('/deploy', (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const dryRun = req.query.dry_run === 'true' || req.body?.dryRun === true;

    if (env === 'local') {
        return res.status(400).json({ error: 'Cannot deploy to local', org, env });
    }

    try {
        const flag = dryRun ? '--dry-run' : '';
        const cmd = `source "${process.env.TETRA_SRC}/bash/tcaddy/caddy.sh" && ` +
            `caddy_ctx set ${org} '' ${env} 2>/dev/null && ` +
            `_caddy_deploy ${flag} 2>&1`;

        const output = execSync(cmd, {
            shell: BASH,
            encoding: 'utf8',
            timeout: 60000,
            env: { ...process.env }
        });

        const success = output.includes('Deployed successfully') || output.includes('Dry run complete');

        res.json({
            success,
            dryRun,
            output: output.trim(),
            org,
            env
        });
    } catch (err) {
        res.status(500).json({
            error: err.message,
            output: err.stdout || err.stderr || '',
            org,
            env
        });
    }
});

// Validate - validate config
router.get('/validate', (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const paths = getCaddyPaths(org, env);

    try {
        const output = runCmd(`caddy validate --config ${paths.caddyfile} 2>&1`, org, env);
        res.json({
            valid: true,
            message: output.trim(),
            caddyfile: paths.caddyfile,
            org,
            env
        });
    } catch (err) {
        res.json({
            valid: false,
            message: err.message,
            caddyfile: paths.caddyfile,
            org,
            env
        });
    }
});

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Metadata - log analysis settings and resource usage
router.get('/metadata', (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const paths = getCaddyPaths(org, env);

    try {
        let result = {
            analysis: {
                enabled: true,
                filterLevel: 'standard',
                jsonParsing: true
            },
            resources: {
                cpuPercent: 0,
                memoryMB: 0,
                diskUsageMB: 0,
                openFiles: 0
            },
            logFile: null,
            files: [],
            org,
            env
        };

        if (paths.isLocal) {
            // Local: check if caddy process is running and get basic stats
            try {
                const pid = runCmd('pgrep -f "caddy run" 2>/dev/null | head -1 || echo ""', org, env).trim();
                if (pid) {
                    // Get CPU and memory for the process
                    const ps = runCmd(`ps -p ${pid} -o %cpu,%mem,rss 2>/dev/null | tail -1 || echo "0 0 0"`, org, env).trim();
                    const [cpu, mem, rss] = ps.split(/\s+/).map(Number);
                    result.resources.cpuPercent = cpu || 0;
                    result.resources.memoryMB = Math.round((rss || 0) / 1024);
                }
            } catch (e) { /* ignore */ }

            // Get log file stats
            const logFile = paths.logFile;
            if (fs.existsSync(logFile)) {
                try {
                    const stats = fs.statSync(logFile);
                    const sizeBytes = stats.size;

                    // Count lines (exact for files < 10MB, estimated for larger)
                    let lineCount;
                    if (sizeBytes < 10 * 1024 * 1024) {
                        // Small file - count exactly
                        const content = fs.readFileSync(logFile, 'utf-8');
                        lineCount = content.split('\n').filter(l => l.trim()).length;
                    } else {
                        // Large file - estimate based on sample
                        const fd = fs.openSync(logFile, 'r');
                        const sampleSize = 64 * 1024; // 64KB sample
                        const buffer = Buffer.alloc(sampleSize);
                        fs.readSync(fd, buffer, 0, sampleSize, 0);
                        fs.closeSync(fd);

                        const sampleLines = buffer.toString('utf-8').split('\n').length - 1;
                        const avgLineSize = sampleSize / sampleLines;
                        lineCount = Math.round(sizeBytes / avgLineSize);
                    }

                    result.logFile = {
                        path: logFile,
                        size: formatFileSize(sizeBytes),
                        sizeBytes,
                        lines: lineCount,
                        modified: stats.mtime.toISOString().replace('T', ' ').slice(0, 19)
                    };
                } catch (e) {
                    console.warn('[Caddy] Error reading log file stats:', e.message);
                }
            }

            result.files = [{
                name: 'caddy.log',
                size: result.logFile?.size || 'N/A',
                age: result.logFile?.modified || 'unknown'
            }];
        } else {
            // Remote: get comprehensive stats
            try {
                // Caddy process stats
                const procStats = runCmd(`
                    pid=$(pgrep -f "caddy" | head -1)
                    if [ -n "$pid" ]; then
                        ps -p $pid -o %cpu,%mem,rss --no-headers 2>/dev/null | awk '{print $1, $2, $3}'
                        lsof -p $pid 2>/dev/null | wc -l
                    else
                        echo "0 0 0"
                        echo "0"
                    fi
                `, org, env).trim().split('\n');

                const [cpu, mem, rss] = (procStats[0] || '0 0 0').split(/\s+/).map(Number);
                result.resources.cpuPercent = cpu || 0;
                result.resources.memoryMB = Math.round((rss || 0) / 1024);
                result.resources.openFiles = parseInt(procStats[1]) || 0;

                // Log directory size
                const diskUsage = runCmd(`du -sm ${paths.logDir} 2>/dev/null | cut -f1 || echo "0"`, org, env).trim();
                result.resources.diskUsageMB = parseInt(diskUsage) || 0;

                // Log files list
                const fileList = runCmd(`
                    ls -lh ${paths.logDir}/*.log 2>/dev/null | awk '{
                        split($9, a, "/");
                        name = a[length(a)];
                        size = $5;
                        # Calculate age from date fields
                        print name "|" size "|" $6 " " $7
                    }'
                `, org, env).trim();

                if (fileList) {
                    result.files = fileList.split('\n').filter(l => l).map(line => {
                        const [name, size, date] = line.split('|');
                        return { name, size, age: date };
                    });
                }

                // Check logging config in Caddyfile
                try {
                    const hasJson = runCmd(`grep -c 'format json' ${paths.caddyfile} 2>/dev/null || echo "0"`, org, env).trim();
                    result.analysis.jsonParsing = parseInt(hasJson) > 0;
                } catch (e) { /* ignore */ }

            } catch (e) {
                console.warn('[Caddy] Metadata fetch error:', e.message);
            }
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message, org, env });
    }
});

// Fail2Ban - get fail2ban status and banned IPs
router.get('/fail2ban', (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const paths = getCaddyPaths(org, env);

    try {
        let result = {
            status: 'unknown',
            active: false,
            jails: [],
            banned: [],
            recent: [],
            totalBanned: 0,
            org,
            env
        };

        if (paths.isLocal) {
            // Local - fail2ban typically not running
            result.status = 'not-applicable';
            result.message = 'fail2ban runs on remote servers';
        } else {
            // Remote - query fail2ban
            try {
                // Check if fail2ban is running
                const active = runCmd('systemctl is-active fail2ban 2>/dev/null || echo "inactive"', org, env).trim();
                result.active = active === 'active';
                result.status = active;

                if (result.active) {
                    // Get jail list
                    const jailOutput = runCmd(`fail2ban-client status 2>/dev/null | grep "Jail list" | sed 's/.*:\s*//' | tr -d ' '`, org, env).trim();
                    result.jails = jailOutput.split(',').filter(j => j);

                    // Get banned IPs from all jails
                    for (const jail of result.jails) {
                        try {
                            const banned = runCmd(`fail2ban-client status ${jail} 2>/dev/null | grep "Banned IP list" | sed 's/.*:\s*//'`, org, env).trim();
                            const ips = banned.split(/\s+/).filter(ip => ip && ip.match(/^\d+\.\d+\.\d+\.\d+$/));
                            for (const ip of ips) {
                                result.banned.push({ ip, jail });
                            }
                        } catch (e) { /* skip this jail */ }
                    }
                    result.totalBanned = result.banned.length;

                    // Get recent activity (last 20 ban/unban events)
                    try {
                        const recentOutput = runCmd(`grep -E 'Ban|Unban' /var/log/fail2ban.log 2>/dev/null | tail -20 || journalctl -u fail2ban --no-pager -n 50 2>/dev/null | grep -E 'Ban|Unban' | tail -20`, org, env).trim();
                        const lines = recentOutput.split('\n').filter(l => l);
                        result.recent = lines.map(line => {
                            const banMatch = line.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}).*?(Ban|Unban)\s+(\d+\.\d+\.\d+\.\d+)/i);
                            if (banMatch) {
                                return {
                                    time: banMatch[1],
                                    action: banMatch[2].toLowerCase(),
                                    ip: banMatch[3]
                                };
                            }
                            return { raw: line };
                        }).filter(e => e.action || e.raw);
                    } catch (e) { /* no recent logs */ }
                }
            } catch (e) {
                result.status = 'error';
                result.error = e.message;
            }
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message, org, env });
    }
});

// Ban IP
router.post('/ban', (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const { ip, jail = 'caddy-noscript', duration } = req.body;

    if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
        return res.status(400).json({ error: 'Invalid IP address' });
    }

    const paths = getCaddyPaths(org, env);

    if (paths.isLocal) {
        return res.json({ error: 'Ban only available on remote servers', org, env });
    }

    try {
        // Build fail2ban-client command
        let cmd = `fail2ban-client set ${jail} banip ${ip}`;

        // If duration specified, we need to use bantime (fail2ban 0.10+)
        // Duration format: 10m, 1h, 24h, 7d, or -1 for permanent
        if (duration) {
            const durationMap = {
                '10m': 600,
                '1h': 3600,
                '24h': 86400,
                '7d': 604800,
                'permanent': -1
            };
            const seconds = durationMap[duration] || parseInt(duration) || 600;
            cmd = `fail2ban-client set ${jail} bantime ${seconds} && fail2ban-client set ${jail} banip ${ip}`;
        }

        const result = runCmd(cmd, org, env);
        res.json({ success: true, ip, jail, duration, result: result.trim(), org, env });
    } catch (err) {
        res.status(500).json({ error: err.message, ip, jail, org, env });
    }
});

// Unban IP
router.post('/unban', (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const { ip, jail = 'caddy-noscript' } = req.body;

    if (!ip || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
        return res.status(400).json({ error: 'Invalid IP address' });
    }

    const paths = getCaddyPaths(org, env);

    if (paths.isLocal) {
        return res.json({ error: 'Unban only available on remote servers', org, env });
    }

    try {
        const result = runCmd(`fail2ban-client set ${jail} unbanip ${ip}`, org, env);
        res.json({ success: true, ip, jail, result: result.trim(), org, env });
    } catch (err) {
        res.status(500).json({ error: err.message, ip, jail, org, env });
    }
});

// Stats - longterm log statistics
router.get('/stats', (req, res) => {
    const { org = 'tetra', env = 'local', period = '24h' } = req.query;
    const paths = getCaddyPaths(org, env);

    try {
        let result = {
            period,
            summary: {
                totalRequests: 0,
                errorCount: 0,
                avgDuration: 0,
                uniqueIPs: 0
            },
            topIPs: [],
            topPaths: [],
            statusCodes: [],
            hourlyRequests: [],
            org,
            env
        };

        if (paths.isLocal) {
            // Parse local caddy.log for stats
            const logFile = paths.logFile;
            if (fs.existsSync(logFile)) {
                try {
                    const content = fs.readFileSync(logFile, 'utf-8');
                    const lines = content.split('\n').filter(l => l);

                    const logs = [];
                    const ipCounts = {};
                    const pathCounts = {};
                    const statusCounts = {};
                    let totalDuration = 0;
                    let durationCount = 0;
                    let errorCount = 0;

                    for (const line of lines) {
                        try {
                            const parsed = JSON.parse(line);
                            if (parsed.request) {
                                logs.push(parsed);

                                // Count IPs
                                const ip = parsed.request?.remote_ip || parsed.request?.client_ip || 'unknown';
                                ipCounts[ip] = (ipCounts[ip] || 0) + 1;

                                // Count paths
                                const uri = parsed.request?.uri || '/';
                                pathCounts[uri] = (pathCounts[uri] || 0) + 1;

                                // Count status codes
                                const status = parsed.status || 0;
                                statusCounts[status] = (statusCounts[status] || 0) + 1;
                                if (status >= 500) errorCount++;

                                // Sum durations
                                if (parsed.duration) {
                                    totalDuration += parsed.duration;
                                    durationCount++;
                                }
                            }
                        } catch (e) { /* skip non-JSON lines */ }
                    }

                    result.summary = {
                        totalRequests: logs.length,
                        errorCount,
                        avgDuration: durationCount > 0 ? (totalDuration / durationCount).toFixed(3) : 0,
                        uniqueIPs: Object.keys(ipCounts).length
                    };

                    // Top IPs
                    const sortedIPs = Object.entries(ipCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
                    const maxIPCount = sortedIPs[0]?.[1] || 1;
                    result.topIPs = sortedIPs.map(([ip, count]) => ({
                        ip, count, percent: Math.round((count / maxIPCount) * 100)
                    }));

                    // Top paths
                    const sortedPaths = Object.entries(pathCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
                    const maxPathCount = sortedPaths[0]?.[1] || 1;
                    result.topPaths = sortedPaths.map(([path, count]) => ({
                        path, count, percent: Math.round((count / maxPathCount) * 100)
                    }));

                    // Status codes
                    const total = logs.length || 1;
                    const sortedStatus = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
                    result.statusCodes = sortedStatus.map(([code, count]) => ({
                        code, count, percent: Math.round((count / total) * 100)
                    }));

                } catch (e) {
                    result.message = `Error parsing logs: ${e.message}`;
                }
            } else {
                result.message = `No log file found at ${logFile}`;
            }
        } else {
            try {
                // Get summary stats
                const statsCmd = `
                    cat ${paths.logDir}/*.log 2>/dev/null | jq -s '
                        {
                            total: length,
                            errors: [.[] | select(.status >= 500 or .level == "error")] | length,
                            avgDuration: (if length > 0 then ([.[].duration // 0] | add / length) else 0 end),
                            uniqueIPs: ([.[].request.remote_ip // .[].request.client_ip] | unique | length)
                        }
                    ' 2>/dev/null || echo '{"total":0,"errors":0,"avgDuration":0,"uniqueIPs":0}'
                `;
                const summaryOutput = runCmd(statsCmd, org, env).trim();
                try {
                    const summary = JSON.parse(summaryOutput);
                    result.summary = {
                        totalRequests: summary.total || 0,
                        errorCount: summary.errors || 0,
                        avgDuration: (summary.avgDuration || 0).toFixed(3),
                        uniqueIPs: summary.uniqueIPs || 0
                    };
                } catch (e) { /* use defaults */ }

                // Top IPs
                const topIPsCmd = `cat ${paths.logDir}/*.log 2>/dev/null | jq -r '.request.remote_ip // .request.client_ip // empty' | sort | uniq -c | sort -rn | head -10 | awk '{print $1 "|" $2}'`;
                const topIPsOutput = runCmd(topIPsCmd, org, env).trim();
                if (topIPsOutput) {
                    const maxCount = parseInt(topIPsOutput.split('\n')[0].split('|')[0]) || 1;
                    result.topIPs = topIPsOutput.split('\n').filter(l => l).map(line => {
                        const [count, ip] = line.split('|');
                        return { ip, count: parseInt(count), percent: Math.round((parseInt(count) / maxCount) * 100) };
                    });
                }

                // Top paths
                const topPathsCmd = `cat ${paths.logDir}/*.log 2>/dev/null | jq -r '.request.uri // empty' | sort | uniq -c | sort -rn | head -10 | awk '{print $1 "|" $2}'`;
                const topPathsOutput = runCmd(topPathsCmd, org, env).trim();
                if (topPathsOutput) {
                    const maxCount = parseInt(topPathsOutput.split('\n')[0].split('|')[0]) || 1;
                    result.topPaths = topPathsOutput.split('\n').filter(l => l).map(line => {
                        const [count, path] = line.split('|');
                        return { path, count: parseInt(count), percent: Math.round((parseInt(count) / maxCount) * 100) };
                    });
                }

                // Status code distribution
                const statusCmd = `cat ${paths.logDir}/*.log 2>/dev/null | jq -r '.status // empty' | sort | uniq -c | sort -rn | awk '{print $1 "|" $2}'`;
                const statusOutput = runCmd(statusCmd, org, env).trim();
                if (statusOutput) {
                    const total = statusOutput.split('\n').filter(l => l).reduce((sum, line) => sum + parseInt(line.split('|')[0]), 0) || 1;
                    result.statusCodes = statusOutput.split('\n').filter(l => l).map(line => {
                        const [count, code] = line.split('|');
                        return { code, count: parseInt(count), percent: Math.round((parseInt(count) / total) * 100) };
                    });
                }

            } catch (e) {
                console.warn('[Caddy] Stats fetch error:', e.message);
            }
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message, org, env });
    }
});

module.exports = router;
