const express = require('express');
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { BASH } = require('../lib/bash');
const router = express.Router();

/**
 * Caddy API - Reverse proxy management
 * Supports local and remote (SSH) execution
 *
 * Local: Uses $TETRA_DIR/orgs/$org/caddy/Caddyfile (with modular imports)
 * Remote: Uses /etc/caddy/Caddyfile
 *
 * Query params:
 *   org - Organization (default: tetra)
 *   env - Environment (default: local)
 */

const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');
const ORGS_DIR = path.join(TETRA_DIR, 'orgs');

/**
 * Get Caddy paths for org/env
 */
function getCaddyPaths(org, env) {
    if (env === 'local') {
        const caddyDir = path.join(ORGS_DIR, org, 'caddy');
        return {
            caddyfile: path.join(caddyDir, 'Caddyfile'),
            modulesDir: path.join(caddyDir, 'modules'),
            logDir: null, // Local caddy logs to stdout
            isLocal: true
        };
    } else {
        return {
            caddyfile: '/etc/caddy/Caddyfile',
            modulesDir: '/etc/caddy/modules',
            logDir: '/var/log/caddy',
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
 * Get SSH config for org/env
 */
function getSSHConfig(org, env) {
    if (env === 'local') return null;

    const targetDirs = ['targets/tetra', 'targets/tsm', 'targets'];
    for (const targetDir of targetDirs) {
        const tomlPath = path.join(ORGS_DIR, org, targetDir, 'tetra-deploy.toml');
        if (fs.existsSync(tomlPath)) {
            try {
                const content = fs.readFileSync(tomlPath, 'utf-8');
                const config = parseToml(content);
                return config.env?.[env]?.ssh || null;
            } catch (e) {
                console.warn(`[Caddy] Failed to parse ${tomlPath}:`, e.message);
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

    try {
        if (paths.isLocal) {
            exists = fs.existsSync(paths.caddyfile);
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
        org,
        env,
        isLocal: paths.isLocal
    });
});

// Status - check if caddy is running
router.get('/status', (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const paths = getCaddyPaths(org, env);
    const ssh = getSSHConfig(org, env);

    try {
        let active = false;
        let version = '';
        let pid = null;
        let listen = null;

        if (paths.isLocal) {
            // Check if gamma-web (local caddy) is running via TSM or pgrep
            try {
                const pgrep = runCmd('pgrep -f "caddy run" 2>/dev/null || echo ""', org, env).trim();
                active = pgrep.length > 0;
                if (active) {
                    pid = pgrep.split('\n')[0];
                    // Try to get listening address from lsof
                    try {
                        const lsof = runCmd(`lsof -p ${pid} -i -P 2>/dev/null | grep LISTEN | head -1 || echo ""`, org, env).trim();
                        const match = lsof.match(/(\*|[\d.]+):(\d+)/);
                        if (match) {
                            listen = match[1] === '*' ? '0.0.0.0:' + match[2] : match[0];
                        }
                    } catch (e) { /* ignore */ }
                }
            } catch (e) { /* not running */ }
        } else {
            // Check systemd service
            const output = runCmd('systemctl is-active caddy 2>/dev/null || echo "inactive"', org, env);
            active = output.trim() === 'active';

            if (active) {
                // Get listening ports on remote
                try {
                    const ss = runCmd("ss -tlnp 2>/dev/null | grep caddy | head -1 | awk '{print $4}' || echo ''", org, env).trim();
                    if (ss) listen = ss;
                } catch (e) { /* ignore */ }
            }
        }

        if (active) {
            try {
                version = runCmd('caddy version 2>/dev/null | head -1', org, env).trim().split(' ')[0];
            } catch (e) { /* ignore */ }
        }

        res.json({
            service: 'caddy',
            status: active ? 'online' : 'offline',
            version,
            pid,
            listen,
            host: ssh || 'localhost',
            caddyfile: paths.caddyfile,
            org,
            env,
            remote: env !== 'local'
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

// Routes - list configured routes with their upstreams
router.get('/routes', (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const paths = getCaddyPaths(org, env);

    try {
        let routes = [];

        if (paths.isLocal) {
            // Local: read and parse Caddyfile with imports
            let content = '';
            if (fs.existsSync(paths.caddyfile)) {
                content = fs.readFileSync(paths.caddyfile, 'utf-8');
            }
            routes = parseRoutes(content, paths.modulesDir, true);
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

        res.json({
            routes,
            count: routes.length,
            caddyfile: paths.caddyfile,
            org,
            env
        });
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
            // Local caddy logs to stdout - check journalctl or TSM logs
            try {
                const tsmLogDir = path.join(TETRA_DIR, 'run/logs');
                const gammaLog = path.join(tsmLogDir, 'gamma-web.log');

                if (fs.existsSync(gammaLog)) {
                    const content = fs.readFileSync(gammaLog, 'utf-8');
                    const logLines = content.split('\n').slice(-lines).filter(l => l);
                    res.json({
                        logs: logLines.map(l => ({ raw: l })),
                        count: logLines.length,
                        source: gammaLog,
                        org,
                        env
                    });
                    return;
                }
            } catch (e) { /* fall through */ }

            res.json({
                logs: [],
                count: 0,
                message: 'Local caddy logs to stdout (use TSM logs)',
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
            res.json({
                errors: [],
                count: 0,
                message: 'Local caddy errors in stdout',
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

// Reload - reload caddy config
router.post('/reload', (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const paths = getCaddyPaths(org, env);

    try {
        let output = '';

        if (paths.isLocal) {
            // For local, try to signal the running caddy process
            output = runCmd(`pkill -USR1 -f "caddy run" 2>&1 || echo "No caddy process found"`, org, env);
        } else {
            output = runCmd('systemctl reload caddy 2>&1', org, env);
        }

        res.json({
            message: 'Caddy reload requested',
            output: output.trim(),
            org,
            env
        });
    } catch (err) {
        res.status(500).json({ error: err.message, org, env });
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

module.exports = router;
