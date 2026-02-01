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
    const fullCmd = `source ~/tetra/tetra.sh && tmod load deploy && ${cmd}`;
    return execSync(fullCmd, {
        shell: BASH,
        encoding: 'utf8',
        timeout: 30000
    });
}

// Simple TOML section parser - extracts keys from a [section]
// Handles single-line values only (strings, arrays, booleans, numbers)
function parseTomlSection(content, section) {
    const result = {};
    const escaped = section.replace(/\./g, '\\.');
    const regex = new RegExp(`^\\[${escaped}\\]\\s*$`, 'm');
    const match = content.search(regex);
    if (match === -1) return result;

    const afterSection = content.slice(match);
    const lines = afterSection.split('\n').slice(1); // skip [section] line
    let inMultiline = false;
    for (const line of lines) {
        // Skip lines inside triple-quoted blocks
        if (inMultiline) {
            if (line.includes('"""') || line.includes("'''")) inMultiline = false;
            continue;
        }
        if (/^\[/.test(line.trim())) break; // next section
        const kv = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_.-]*)\s*=\s*(.+)/);
        if (kv) {
            let val = kv[2].trim();
            // Detect triple-quoted multi-line value opening
            if (val.startsWith('"""') && !val.endsWith('"""')) {
                inMultiline = true;
                result[kv[1]] = '(multiline)';
                continue;
            }
            if (val.startsWith("'''") && !val.endsWith("'''")) {
                inMultiline = true;
                result[kv[1]] = '(multiline)';
                continue;
            }
            // Strip quotes
            if ((val.startsWith('"') && val.endsWith('"')) ||
                (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            result[kv[1]] = val;
        }
    }
    return result;
}

// Parse multi-line TOML values (triple-quoted strings)
function parseTomlMultiline(content, section, key) {
    const escaped = section.replace(/\./g, '\\.');
    const regex = new RegExp(`^\\[${escaped}\\]`, 'm');
    const match = content.search(regex);
    if (match === -1) return '';

    const afterSection = content.slice(match);
    const keyRegex = new RegExp(`^${key}\\s*=\\s*"""`, 'm');
    const keyMatch = afterSection.search(keyRegex);
    if (keyMatch === -1) return '';

    const afterKey = afterSection.slice(keyMatch);
    const endMatch = afterKey.indexOf('"""', afterKey.indexOf('"""') + 3);
    if (endMatch === -1) return '';

    return afterKey.slice(afterKey.indexOf('"""') + 3, endMatch).trim();
}

// Parse TOML array value: ["a", "b", "c"] or key = ["a","b"]
function parseTomlArray(raw) {
    if (!raw) return [];
    const match = raw.match(/\[([^\]]*)\]/);
    if (!match) return [];
    return match[1].split(',')
        .map(s => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
}

// Service status
router.get('/status', (req, res) => {
    res.json({
        service: 'deploy',
        status: 'active',
        message: 'Deployment orchestration service'
    });
});

// Scan for tetra-deploy.toml files and parse rich info
function discoverTargets(orgFilter) {
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
        // Filter by org if specified
        if (orgFilter && org !== orgFilter) continue;

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

                // [target] section
                const targetSection = parseTomlSection(content, 'target');
                const name = targetSection.name || targetDir;
                const description = targetSection.description || '';
                const repo = targetSection.repo || '';

                // Find environments [env.xxx]
                const envMatches = content.matchAll(/^\[env\.([^\]]+)\]/gm);
                const envs = [];
                for (const m of Array.from(envMatches)) {
                    const envName = m[1];
                    const envSection = parseTomlSection(content, `env.${envName}`);
                    envs.push({
                        name: envName,
                        domain: envSection.domain || '',
                        branch: envSection.branch || '',
                        ssh: envSection.ssh || '',
                        port: envSection.port || '',
                        user: envSection.user || '',
                        confirm: envSection.confirm === 'true'
                    });
                }

                // [pipeline] section - extract pipeline names AND steps
                const pipelineSection = parseTomlSection(content, 'pipeline');
                const pipelines = {};
                for (const [pName, raw] of Object.entries(pipelineSection)) {
                    pipelines[pName] = parseTomlArray(raw);
                }
                const hasPipeline = Object.keys(pipelines).length > 0;

                // [alias] section
                const aliasSection = parseTomlSection(content, 'alias');
                const aliases = Object.keys(aliasSection);

                // [remote] section - command names only (values are long scripts)
                const remoteSection = parseTomlSection(content, 'remote');
                const remoteCommands = Object.keys(remoteSection);

                // [push] section
                const pushSection = parseTomlSection(content, 'push');

                // [build] section
                const buildSection = parseTomlSection(content, 'build');

                // [files] section
                const filesSection = parseTomlSection(content, 'files');
                const files = Object.keys(filesSection).filter(k => k !== 'all');

                // Classify deploy strategy:
                // "remote-exec" = SSH to server, run commands (git pull, restart)
                // "local-push"  = build locally, rsync/push files to server
                // "hybrid"      = has both remote commands and local push
                const hasRemote = remoteCommands.length > 0;
                const hasPush = !!pushSection.method || Object.keys(pushSection).length > 0;
                const hasBuild = Object.keys(buildSection).length > 0;
                let strategy = 'unknown';
                if (hasRemote && !hasPush) strategy = 'remote-exec';
                else if (hasPush && !hasRemote) strategy = 'local-push';
                else if (hasRemote && hasPush) strategy = 'hybrid';
                else if (hasBuild) strategy = 'local-push';

                // Strategy description for the UI
                const strategyDesc = {
                    'remote-exec': 'SSH to server, run commands (git pull, deps, restart)',
                    'local-push': 'Build locally, push files to server',
                    'hybrid': 'Remote commands + file push',
                    'unknown': 'Custom deployment'
                }[strategy];

                targets.push({
                    name,
                    org,
                    description,
                    repo,
                    envs: envs.length > 0 ? envs : [{ name: 'dev', domain: '', branch: '', ssh: '', port: '' }],
                    pipelines,
                    aliases,
                    remoteCommands,
                    files,
                    strategy,
                    strategyDesc,
                    format: hasPipeline ? 'engine' : 'legacy',
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
        const orgFilter = req.query.org || '';
        const targets = discoverTargets(orgFilter);
        res.json({ targets });
    } catch (err) {
        res.status(500).json({ error: err.message, targets: [] });
    }
});

// Get deployment history
router.get('/history', (req, res) => {
    try {
        const logFile = path.join(TETRA_DIR, 'deploy/logs/deploy.log');
        const targetFilter = req.query.target || '';

        if (!fs.existsSync(logFile)) {
            return res.json({ history: [] });
        }

        const content = fs.readFileSync(logFile, 'utf8');
        const lines = content.trim().split('\n').filter(Boolean).slice(-50);

        let history = lines.map(line => {
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

        // Filter by target if specified
        if (targetFilter) {
            history = history.filter(h => h.target === targetFilter);
        }

        res.json({ history });
    } catch (err) {
        res.status(500).json({ error: err.message, history: [] });
    }
});

// Trigger deployment (dry-run by default for safety)
// Uses engine path (colon syntax) for engine targets, legacy for others
router.post('/deploy', (req, res) => {
    const { target, env, pipeline = 'default', dryRun = true } = req.body;

    if (!target || !env) {
        return res.status(400).json({ error: 'target and env required' });
    }

    const dryFlag = dryRun ? '-n' : '';
    // Use engine colon syntax: deploy target:pipeline env [-n]
    const cmd = `deploy ${target}:${pipeline} ${env} ${dryFlag}`;

    exec(`source ~/tetra/tetra.sh && tmod load deploy && ${cmd}`,
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

// Get raw TOML config for a target
router.get('/config/:target', (req, res) => {
    try {
        const orgFilter = req.query.org || '';
        const targets = discoverTargets(orgFilter);
        const t = targets.find(x => x.name === req.params.target);
        if (!t) return res.status(404).json({ error: 'Target not found' });

        const content = fs.readFileSync(t.path, 'utf8');
        res.json({ path: t.path, content });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Save raw TOML config for a target
router.put('/config/:target', express.text({ limit: '64kb' }), (req, res) => {
    try {
        const orgFilter = req.query.org || '';
        const targets = discoverTargets(orgFilter);
        const t = targets.find(x => x.name === req.params.target);
        if (!t) return res.status(404).json({ error: 'Target not found' });

        // Path validation: must stay under orgs/
        const orgsDir = path.join(TETRA_DIR, 'orgs');
        const resolved = path.resolve(t.path);
        if (!resolved.startsWith(orgsDir)) {
            return res.status(403).json({ error: 'Path outside orgs directory' });
        }

        fs.writeFileSync(resolved, req.body, 'utf8');
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
