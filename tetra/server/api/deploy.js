const express = require('express');
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { BASH } = require('../lib/bash');
const router = express.Router();

/**
 * Deploy API - Deployment orchestration service
 * Calls real deploy bash commands
 */

const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');

function runDeploy(cmd) {
    const fullCmd = `source ~/tetra/tetra.sh && ${cmd}`;
    return execSync(fullCmd, {
        shell: BASH,
        encoding: 'utf8',
        timeout: 30000
    });
}

// Service status
router.get('/status', (req, res) => {
    res.json({
        service: 'deploy',
        status: 'active',
        message: 'Deployment orchestration service'
    });
});

// Scan for tetra-deploy.toml files and parse basic info
function discoverTargets() {
    const orgsDir = path.join(TETRA_DIR, 'orgs');
    const targets = [];

    if (!fs.existsSync(orgsDir)) {
        return targets;
    }

    // Scan orgs/*/targets/*/tetra-deploy.toml
    const orgs = fs.readdirSync(orgsDir).filter(f => {
        const stat = fs.statSync(path.join(orgsDir, f));
        return stat.isDirectory() && !f.startsWith('.');
    });

    for (const org of orgs) {
        const targetsDir = path.join(orgsDir, org, 'targets');
        if (!fs.existsSync(targetsDir)) continue;

        const targetDirs = fs.readdirSync(targetsDir).filter(f => {
            const stat = fs.statSync(path.join(targetsDir, f));
            return stat.isDirectory() && !f.startsWith('.');
        });

        for (const targetDir of targetDirs) {
            const tomlPath = path.join(targetsDir, targetDir, 'tetra-deploy.toml');
            if (!fs.existsSync(tomlPath)) continue;

            try {
                const content = fs.readFileSync(tomlPath, 'utf8');

                // Simple TOML parsing for name and envs
                const nameMatch = content.match(/^\s*name\s*=\s*"([^"]+)"/m);
                const name = nameMatch ? nameMatch[1] : targetDir;

                // Find environments [env.xxx]
                const envMatches = content.matchAll(/^\[env\.([^\]]+)\]/gm);
                const envs = Array.from(envMatches).map(m => m[1]);

                targets.push({
                    name,
                    org,
                    envs: envs.length > 0 ? envs : ['dev'],
                    path: tomlPath
                });
            } catch (e) {
                // Skip invalid TOML files
            }
        }
    }

    return targets;
}

// List available targets
router.get('/targets', (req, res) => {
    try {
        const targets = discoverTargets();
        res.json({ targets });
    } catch (err) {
        res.status(500).json({ error: err.message, targets: [] });
    }
});

// Get deployment history
router.get('/history', (req, res) => {
    try {
        const logFile = path.join(TETRA_DIR, 'deploy/logs/deploy.log');

        if (!fs.existsSync(logFile)) {
            return res.json({ history: [] });
        }

        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.trim().split('\n').filter(Boolean).slice(-50);

        const history = lines.map(line => {
            const parts = line.split('|').map(p => p.trim());
            return {
                timestamp: parts[0] || '',
                target: parts[1] || '',
                env: parts[2] || '',
                action: parts[3] || '',
                status: parts[4] || '',
                duration: parts[5] || '',
                user: parts[6] || '',
                branch: parts[7] || '',
                commit: parts[8] || ''
            };
        }).reverse();

        res.json({ history });
    } catch (err) {
        res.status(500).json({ error: err.message, history: [] });
    }
});

// Trigger deployment (dry-run by default for safety)
router.post('/deploy', (req, res) => {
    const { target, env, dryRun = true } = req.body;

    if (!target || !env) {
        return res.status(400).json({ error: 'target and env required' });
    }

    const dryFlag = dryRun ? '-n' : '';

    exec(`source ~/tetra/tetra.sh && deploy push ${dryFlag} ${target} ${env}`,
        { shell: BASH, timeout: 60000 },
        (err, stdout, stderr) => {
            if (err) {
                res.status(500).json({
                    error: stderr || err.message,
                    status: 'failed',
                    output: stdout
                });
            } else {
                res.json({
                    message: dryRun ? 'Dry run completed' : 'Deployment completed',
                    status: dryRun ? 'preview' : 'success',
                    output: stdout
                });
            }
        }
    );
});

// Show target configuration
router.get('/show/:target/:env', (req, res) => {
    const { target, env } = req.params;

    try {
        const output = runDeploy(`deploy show ${target} ${env} 2>&1`);
        res.json({
            target,
            env,
            config: output
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;