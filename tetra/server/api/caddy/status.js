// Caddy API - Status, Info, Routes, Validate routes

const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);
const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const {
    CADDY_ADMIN_PORT, BASH,
    getCached, setCache,
    caddyApiGet, getCaddyPaths, getSSHConfig, runCmd, runCmdAsync, parseRoutes
} = require('./lib');

// Info - show file paths and configuration locations
router.get('/info', async (req, res) => {
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

            snippets = fs.existsSync(path.join(paths.caddyDir, 'snippets.caddy'));

            try {
                envCaddyfiles = fs.readdirSync(paths.caddyDir)
                    .filter(f => f.endsWith('.Caddyfile'))
                    .map(f => f.replace('.Caddyfile', ''));
            } catch (e) { /* ignore */ }

            if (fs.existsSync(paths.modulesDir)) {
                try {
                    envModules = fs.readdirSync(paths.modulesDir).filter(f => f.endsWith('.caddy'));
                } catch (e) { /* ignore */ }
            }
        } else {
            try {
                const output = await runCmdAsync(`test -f ${paths.caddyfile} && echo "exists"`, org, env);
                exists = output.trim() === 'exists';
            } catch (e) {
                exists = false;
            }

            try {
                const modOutput = await runCmdAsync(`ls ${paths.modulesDir}/*.caddy 2>/dev/null | xargs -n1 basename 2>/dev/null || echo ""`, org, env);
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
            const config = await caddyApiGet('config/');

            if (config) {
                active = true;
                adminApi = `localhost:${CADDY_ADMIN_PORT}`;

                if (config.apps?.http?.servers) {
                    servers = Object.keys(config.apps.http.servers).length;
                    const firstServer = Object.values(config.apps.http.servers)[0];
                    if (firstServer?.listen) {
                        listen = firstServer.listen.join(', ');
                    }
                }

                try {
                    const { stdout } = await execFileAsync(BASH, ['-c', 'caddy version 2>/dev/null | head -1'], {
                        encoding: 'utf8', timeout: 3000
                    });
                    version = stdout.trim().split(' ')[0];
                } catch (e) { /* ignore */ }
            } else {
                try {
                    const { stdout } = await execFileAsync(BASH, ['-c', 'pgrep -f "caddy run" 2>/dev/null || echo ""'], {
                        encoding: 'utf8', timeout: 3000
                    });
                    const pgrep = stdout.trim();
                    active = pgrep.length > 0;
                    if (active) {
                        pid = pgrep.split('\n')[0];
                    }
                } catch (e) { /* not running */ }
            }
        } else {
            // Single SSH call for all remote status info
            const output = await runCmdAsync(
                'echo "ACTIVE=$(systemctl is-active caddy 2>/dev/null || echo inactive)"; ' +
                'echo "LISTEN=$(ss -tlnp 2>/dev/null | grep caddy | head -1 | awk \'{print $4}\' || echo \\"\\")"; ' +
                'echo "VERSION=$(caddy version 2>/dev/null | head -1 || echo \\"\\")"',
                org, env
            );
            const info = {};
            for (const line of output.trim().split('\n')) {
                const eq = line.indexOf('=');
                if (eq > 0) info[line.slice(0, eq)] = line.slice(eq + 1);
            }
            active = info.ACTIVE === 'active';
            if (active) {
                if (info.LISTEN) listen = info.LISTEN;
                if (info.VERSION) version = info.VERSION.split(' ')[0];
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

    const cached = getCached(cacheKey);
    if (cached) {
        return res.json({ ...cached, cached: true });
    }

    const paths = getCaddyPaths(org, env);

    try {
        let routes = [];

        if (paths.isLocal) {
            const config = await caddyApiGet('config/apps/http/servers');

            if (config) {
                for (const [serverName, server] of Object.entries(config)) {
                    if (server.routes) {
                        for (const route of server.routes) {
                            let pathMatch = '/*';
                            if (route.match) {
                                for (const matcher of route.match) {
                                    if (matcher.path) pathMatch = matcher.path.join(', ');
                                    if (matcher.host) pathMatch = matcher.host.join(', ');
                                }
                            }

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
                let content = '';
                if (fs.existsSync(paths.caddyfile)) {
                    content = fs.readFileSync(paths.caddyfile, 'utf-8');
                }
                routes = parseRoutes(content, paths.modulesDir, true);
            }
        } else {
            try {
                const cmd = `grep -E 'reverse_proxy' ${paths.caddyfile} 2>/dev/null || echo ""`;
                const output = await runCmdAsync(cmd, org, env);

                const lines = output.split('\n').map(l => l.trim()).filter(l => l);

                for (const line of lines) {
                    if (line.includes('import ')) continue;

                    const match = line.match(/reverse_proxy\s+(\S+)\s+(localhost:\d+|[\d.]+:\d+)/);
                    if (match) {
                        routes.push({
                            path: match[1],
                            upstream: match[2],
                            type: 'reverse_proxy'
                        });
                    } else {
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

// Validate - validate config
router.get('/validate', async (req, res) => {
    const { org = 'tetra', env = 'local' } = req.query;
    const paths = getCaddyPaths(org, env);

    try {
        const output = await runCmdAsync(`caddy validate --config ${paths.caddyfile} 2>&1`, org, env);
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
