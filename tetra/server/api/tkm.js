const express = require('express');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { BASH } = require('../lib/bash');
const router = express.Router();

/**
 * TKM API - Tetra Key Manager service
 * Handles SSH key generation, deployment, and management
 */

const HOME = process.env.HOME;

function runTkm(org, cmd, timeout = 30000) {
    // Switch to org context before running tkm command
    const fullCmd = `source ~/tetra/tetra.sh && tmod load tkm && org switch ${org} >/dev/null 2>&1 && ${cmd}`;
    try {
        return execSync(fullCmd, {
            shell: BASH,
            encoding: 'utf8',
            timeout: timeout
        });
    } catch (err) {
        return err.stdout || err.stderr || err.message;
    }
}

function getKeysDir(org) {
    if (!org) return null;
    return path.join(HOME, '.ssh', org);
}

// Get status overview
router.get('/status', (req, res) => {
    const org = req.query.org;
    if (!org) {
        return res.json({ service: 'tkm', status: 'no-org', org: null, keysDir: null, keyCount: 0 });
    }
    const keysDir = getKeysDir(org);
    let keyCount = 0;

    if (keysDir && fs.existsSync(keysDir)) {
        const files = fs.readdirSync(keysDir);
        keyCount = files.filter(f =>
            !f.endsWith('.pub') &&
            !f.includes('.revoked.') &&
            fs.statSync(path.join(keysDir, f)).isFile()
        ).length;
    }

    res.json({
        service: 'tkm',
        status: org ? 'active' : 'no-org',
        org: org || null,
        keysDir: keysDir ? `~/.ssh/${org}/` : null,
        keyCount: keyCount
    });
});

// Get list of keys with fingerprints (active and revoked)
router.get('/keys', (req, res) => {
    const org = req.query.org;
    if (!org) {
        return res.json({ active: [], revoked: [], error: 'No active org' });
    }

    const keysDir = getKeysDir(org);
    if (!keysDir || !fs.existsSync(keysDir)) {
        return res.json({ active: [], revoked: [], error: 'Keys directory does not exist' });
    }

    const active = [];
    const revoked = [];
    const files = fs.readdirSync(keysDir);

    for (const file of files) {
        const filePath = path.join(keysDir, file);
        if (!fs.statSync(filePath).isFile()) continue;
        if (file.endsWith('.pub')) continue;

        const isRevoked = file.includes('.revoked.');
        const pubPath = isRevoked ? filePath + '.pub' : filePath + '.pub';
        let fingerprint = null;

        // For revoked keys, try the .pub.revoked file
        const pubPathRevoked = filePath.replace('.revoked.', '.pub.revoked.');
        const actualPubPath = fs.existsSync(pubPath) ? pubPath :
                             (fs.existsSync(pubPathRevoked) ? pubPathRevoked : null);

        if (actualPubPath) {
            try {
                const fp = execSync(`ssh-keygen -l -f "${actualPubPath}" 2>/dev/null | awk '{print $2}'`, {
                    encoding: 'utf8',
                    shell: BASH
                });
                fingerprint = fp.trim();
            } catch (err) {
                fingerprint = null;
            }
        }

        // Parse revoked timestamp
        let revokedAt = null;
        if (isRevoked) {
            const match = file.match(/\.revoked\.(\d{8}_\d{6})$/);
            if (match) {
                const ts = match[1];
                revokedAt = `${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)} ${ts.slice(9,11)}:${ts.slice(11,13)}`;
            }
        }

        // Extract base key name for revoked keys
        const baseName = isRevoked ? file.replace(/\.revoked\.\d{8}_\d{6}$/, '') : file;

        const keyInfo = {
            name: file,
            baseName: baseName,
            fingerprint: fingerprint,
            revokedAt: revokedAt
        };

        if (isRevoked) {
            revoked.push(keyInfo);
        } else {
            active.push(keyInfo);
        }
    }

    // Sort revoked by timestamp descending (newest first)
    revoked.sort((a, b) => (b.revokedAt || '').localeCompare(a.revokedAt || ''));

    res.json({ active, revoked });
});

// Get environments from tetra.toml
router.get('/envs', (req, res) => {
    const org = req.query.org;
    if (!org) {
        return res.json({ envs: [], error: 'No active org' });
    }

    try {
        // Get env names and hosts from org module
        const output = runTkm(org, `
            envs=$(org_env_names 2>/dev/null)
            for env in $envs; do
                [[ "$env" == "local" ]] && continue
                host=$(_tkm_get_host "$env" 2>/dev/null || echo "")
                echo "$env|$host"
            done
        `);

        const envs = output.trim().split('\n')
            .filter(line => line.includes('|'))
            .map(line => {
                const [name, host] = line.split('|');
                return { name, host: host || null };
            });

        res.json({ envs });
    } catch (err) {
        res.json({ envs: [], error: err.message });
    }
});

// Get SSH config entries for current org
router.get('/config', (req, res) => {
    const org = req.query.org;
    if (!org) {
        return res.json({ config: '' });
    }

    const configPath = path.join(HOME, '.ssh', 'config');
    if (!fs.existsSync(configPath)) {
        return res.json({ config: '' });
    }

    try {
        const content = fs.readFileSync(configPath, 'utf8');

        // Extract tkm entries for this org
        const lines = content.split('\n');
        const tkmLines = [];
        let inTkmBlock = false;
        let orgMatch = false;

        for (const line of lines) {
            if (line.includes(`# tkm: ${org}`)) {
                inTkmBlock = true;
                orgMatch = true;
                tkmLines.push(line);
            } else if (inTkmBlock) {
                if (line.startsWith('#') && line.includes('tkm:') && !line.includes(`# tkm: ${org}`)) {
                    inTkmBlock = false;
                    orgMatch = false;
                } else if (line.startsWith('Match ') || line.startsWith('Host ')) {
                    if (!orgMatch) {
                        inTkmBlock = false;
                    } else {
                        tkmLines.push(line);
                    }
                } else if (line.trim() === '' && tkmLines.length > 0) {
                    tkmLines.push(line);
                } else if (inTkmBlock) {
                    tkmLines.push(line);
                }
            }
        }

        res.json({ config: tkmLines.join('\n') });
    } catch (err) {
        res.json({ config: '', error: err.message });
    }
});

// Test SSH connectivity for an environment
router.get('/test/:env', (req, res) => {
    const org = req.query.org;
    const env = req.params.env;
    if (!org) return res.json({ env, success: false, error: 'org required' });

    try {
        const output = runTkm(org, `
            host=$(_tkm_get_host "${env}" 2>/dev/null)
            user=$(_tkm_get_auth_user "${env}" 2>/dev/null)
            [[ -z "$user" ]] && user="root"
            if ssh -o BatchMode=yes -o ConnectTimeout=5 "$user@$host" echo ok 2>/dev/null; then
                echo "SUCCESS"
            else
                echo "FAILED"
            fi
        `, 10000);

        const success = output.includes('SUCCESS');
        res.json({ env, success, output: output.trim() });
    } catch (err) {
        res.json({ env, success: false, error: err.message });
    }
});

// Initialize keys directory
router.post('/init', (req, res) => {
    const org = req.body.org || req.query.org;
    if (!org) return res.json({ success: false, error: 'org required' });

    try {
        const output = runTkm(org, 'tkm init');
        res.json({ success: true, output });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Generate keys
router.post('/gen', (req, res) => {
    const org = req.body.org || req.query.org;
    const env = req.body.env || 'all';
    if (!org) return res.json({ success: false, error: 'org required' });

    try {
        const output = runTkm(org, `tkm gen ${env}`);
        res.json({ success: true, output });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Deploy keys
router.post('/deploy', (req, res) => {
    const org = req.body.org || req.query.org;
    const env = req.body.env || 'all';
    if (!org) return res.json({ success: false, error: 'org required' });

    try {
        const output = runTkm(org, `tkm deploy ${env}`, 60000);
        res.json({ success: true, output });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Test connectivity
router.post('/test', (req, res) => {
    const org = req.body.org || req.query.org;
    const env = req.body.env || 'all';
    if (!org) return res.json({ success: false, error: 'org required' });

    try {
        const output = runTkm(org, `tkm test ${env}`, 30000);
        res.json({ success: true, output });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Preview rotate - show what will happen
router.get('/rotate/preview', (req, res) => {
    const org = req.query.org;
    const env = req.query.env;
    if (!org) return res.json({ success: false, error: 'org required' });
    if (!env || env === 'all') {
        return res.json({ success: false, error: 'Rotate requires a specific environment' });
    }

    const keysDir = getKeysDir(org);
    if (!keysDir || !fs.existsSync(keysDir)) {
        return res.json({ success: false, error: 'Keys directory does not exist' });
    }

    // Find current keys for this env
    const currentKeys = [];
    const files = fs.readdirSync(keysDir);

    for (const file of files) {
        if (file.includes('.revoked.')) continue;
        if (file.endsWith('.pub')) continue;
        if (!file.startsWith(env + '_')) continue;

        const filePath = path.join(keysDir, file);
        const pubPath = filePath + '.pub';
        let fingerprint = null;

        if (fs.existsSync(pubPath)) {
            try {
                const fp = execSync(`ssh-keygen -l -f "${pubPath}" 2>/dev/null | awk '{print $2}'`, {
                    encoding: 'utf8',
                    shell: BASH
                });
                fingerprint = fp.trim();
            } catch (err) {}
        }

        currentKeys.push({ name: file, fingerprint });
    }

    res.json({
        success: true,
        env,
        currentKeys,
        actions: [
            'Archive current keys with timestamp (.revoked.YYYYMMDD_HHMMSS)',
            'Generate new Ed25519 keypairs',
            'Update ~/.ssh/config with new key paths',
            'Deploy new public keys to server'
        ],
        warning: 'Old keys will still work on server until manually removed!'
    });
});

// Rotate keys (revoke + gen + deploy)
router.post('/rotate', (req, res) => {
    const org = req.body.org || req.query.org;
    const env = req.body.env;
    if (!org) return res.json({ success: false, error: 'org required' });

    if (!env || env === 'all') {
        return res.json({ success: false, error: 'Rotate requires a specific environment' });
    }

    try {
        const output = runTkm(org, `tkm rotate ${env}`, 120000);
        res.json({ success: true, output });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Clean old keys from server
router.post('/clean', (req, res) => {
    const org = req.body.org || req.query.org;
    const env = req.body.env;
    const fingerprint = req.body.fingerprint;
    if (!org) return res.json({ success: false, error: 'org required' });
    if (!env) return res.json({ success: false, error: 'env required' });
    if (!fingerprint) return res.json({ success: false, error: 'fingerprint required' });

    try {
        // Use tkm remote clean to remove key by fingerprint pattern
        const shortFp = fingerprint.substring(0, 20);
        const output = runTkm(org, `tkm remote clean ${env} root "${shortFp}" && tkm remote clean ${env} dev "${shortFp}"`, 30000);
        res.json({ success: true, output });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// List remote keys on server
router.get('/remote/keys', (req, res) => {
    const org = req.query.org;
    const env = req.query.env;
    const user = req.query.user || 'root';
    if (!org) return res.json({ success: false, error: 'org required' });
    if (!env) return res.json({ success: false, error: 'env required' });

    try {
        const output = runTkm(org, `tkm remote list ${env} ${user}`, 15000);
        res.json({ success: true, output });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Doctor - audit setup
router.get('/doctor', (req, res) => {
    const org = req.query.org;
    if (!org) return res.json({ success: false, error: 'org required' });

    try {
        const output = runTkm(org, 'tkm doctor');
        res.json({ success: true, output });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Fingerprints
router.get('/fingerprints', (req, res) => {
    const org = req.query.org;
    if (!org) return res.json({ success: false, error: 'org required' });

    try {
        const output = runTkm(org, 'tkm fingerprint all');
        res.json({ success: true, output });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

module.exports = router;
