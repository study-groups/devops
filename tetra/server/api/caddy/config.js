// Caddy API - Config, Running config, Reload, Deploy routes

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const {
    CADDY_ADMIN_PORT, BASH,
    caddyApiGet, caddyApiPost, isCaddyApiAvailable,
    getCaddyPaths, runCmd
} = require('./lib');

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
            const apiAvailable = await isCaddyApiAvailable();

            if (apiAvailable) {
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
                try {
                    output = execSync(`caddy reload --config "${paths.caddyfile}" 2>&1`, {
                        shell: BASH,
                        encoding: 'utf8',
                        timeout: 10000
                    });
                    method = 'caddy-reload';
                } catch (e) {
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

module.exports = router;
