const express = require('express');
const { execSync, exec } = require('child_process');
const { BASH } = require('../lib/bash');
const router = express.Router();

/**
 * TSM API - Tetra Service Manager
 * Calls real TSM bash commands
 */

function runTsm(cmd) {
    const fullCmd = `source ~/tetra/tetra.sh && ${cmd}`;
    return execSync(fullCmd, {
        shell: BASH,
        encoding: 'utf8',
        timeout: 10000
    });
}

// List services (JSON)
router.get('/ls', (req, res) => {
    try {
        const output = runTsm('tsm ls --json');
        const services = JSON.parse(output);
        res.json({ services });
    } catch (err) {
        res.status(500).json({ error: err.message, services: [] });
    }
});

// Service status
router.get('/status', (req, res) => {
    try {
        const output = runTsm('tsm ls --json');
        const services = JSON.parse(output);
        res.json({
            service: 'tsm',
            status: 'active',
            count: services.length,
            services
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start service
router.post('/start/:service', (req, res) => {
    const service = req.params.service;
    exec(`source ~/tetra/tetra.sh && tsm start ${service}`, { shell: BASH }, (err, stdout, stderr) => {
        if (err) {
            res.status(500).json({ error: stderr || err.message, status: 'failed' });
        } else {
            res.json({ message: stdout.trim(), status: 'started' });
        }
    });
});

// Stop service
router.post('/stop/:service', (req, res) => {
    const service = req.params.service;
    exec(`source ~/tetra/tetra.sh && tsm stop ${service}`, { shell: BASH }, (err, stdout, stderr) => {
        if (err) {
            res.status(500).json({ error: stderr || err.message, status: 'failed' });
        } else {
            res.json({ message: stdout.trim(), status: 'stopped' });
        }
    });
});

// Restart service
router.post('/restart/:service', (req, res) => {
    const service = req.params.service;
    exec(`source ~/tetra/tetra.sh && tsm restart ${service}`, { shell: BASH }, (err, stdout, stderr) => {
        if (err) {
            res.status(500).json({ error: stderr || err.message, status: 'failed' });
        } else {
            res.json({ message: stdout.trim(), status: 'restarted' });
        }
    });
});

module.exports = router;
