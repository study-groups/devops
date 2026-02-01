/**
 * Voxlab API - Experiment monitoring and management
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');
const VOXLAB_DIR = path.join(TETRA_DIR, 'voxlab');

function readNdjson(filePath, limit) {
    try {
        const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n').filter(Boolean);
        const parsed = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
        return limit ? parsed.slice(-limit) : parsed;
    } catch {
        return [];
    }
}

function readJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return null;
    }
}

// GET /voxlab/experiments - List all experiments
router.get('/experiments', (req, res) => {
    const expDir = path.join(VOXLAB_DIR, 'experiments');
    try {
        const dirs = fs.readdirSync(expDir).filter(d =>
            fs.statSync(path.join(expDir, d)).isDirectory()
        );
        const experiments = dirs.map(name => {
            const dir = path.join(expDir, name);
            const config = readJson(path.join(dir, 'config.json'));
            const summary = readJson(path.join(dir, 'summary.json'));
            const runFile = path.join(dir, 'run.ndjson');

            let status = 'created';
            let lastEntry = null;
            if (summary) {
                status = 'summarized';
            } else if (fs.existsSync(runFile)) {
                status = 'complete';
                const lines = readNdjson(runFile, 1);
                lastEntry = lines[0] || null;
            }

            // Check for voice samples
            const outputsDir = path.join(dir, 'outputs');
            const samples = {};
            for (const phase of ['before', 'during', 'after']) {
                const wav = path.join(outputsDir, `sample_${phase}.wav`);
                if (fs.existsSync(wav)) {
                    samples[phase] = `/api/voxlab/experiments/${name}/audio/${phase}`;
                }
            }

            return { name, status, config, summary, lastEntry, samples };
        });
        res.json(experiments);
    } catch {
        res.json([]);
    }
});

// GET /voxlab/experiments/:id - Experiment details
router.get('/experiments/:id', (req, res) => {
    const dir = path.join(VOXLAB_DIR, 'experiments', req.params.id);
    if (!fs.existsSync(dir)) {
        return res.status(404).json({ error: 'Experiment not found' });
    }
    const config = readJson(path.join(dir, 'config.json'));
    const summary = readJson(path.join(dir, 'summary.json'));

    // Check for voice samples
    const outputsDir = path.join(dir, 'outputs');
    const samples = {};
    for (const phase of ['before', 'during', 'after']) {
        const wav = path.join(outputsDir, `sample_${phase}.wav`);
        if (fs.existsSync(wav)) {
            samples[phase] = `/api/voxlab/experiments/${req.params.id}/audio/${phase}`;
        }
    }

    res.json({ id: req.params.id, config, summary, samples });
});

// GET /voxlab/experiments/:id/audio/:phase - Serve sample audio
router.get('/experiments/:id/audio/:phase', (req, res) => {
    const phase = req.params.phase;
    if (!['before', 'during', 'after'].includes(phase)) {
        return res.status(400).json({ error: 'phase must be before, during, or after' });
    }
    const wav = path.join(VOXLAB_DIR, 'experiments', req.params.id, 'outputs', `sample_${phase}.wav`);
    if (!fs.existsSync(wav)) {
        return res.status(404).json({ error: 'sample not found' });
    }
    res.setHeader('Content-Type', 'audio/wav');
    fs.createReadStream(wav).pipe(res);
});

// GET /voxlab/experiments/:id/logs?tail=N - Experiment run logs
router.get('/experiments/:id/logs', (req, res) => {
    const runFile = path.join(VOXLAB_DIR, 'experiments', req.params.id, 'run.ndjson');
    const tail = parseInt(req.query.tail) || 100;
    const entries = readNdjson(runFile, tail);
    res.json(entries);
});

// GET /voxlab/pipelines - List pipelines
router.get('/pipelines', (req, res) => {
    const dir = path.join(VOXLAB_DIR, 'pipelines');
    try {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        const pipelines = files.map(f => readJson(path.join(dir, f))).filter(Boolean);
        res.json(pipelines);
    } catch {
        res.json([]);
    }
});

// GET /voxlab/golden - List golden references
router.get('/golden', (req, res) => {
    const dir = path.join(VOXLAB_DIR, 'golden');
    try {
        const dirs = fs.readdirSync(dir).filter(d =>
            fs.statSync(path.join(dir, d)).isDirectory()
        );
        const golden = dirs.map(epoch => {
            const meta = readJson(path.join(dir, epoch, 'meta.json'));
            return { epoch, ...meta };
        });
        res.json(golden);
    } catch {
        res.json([]);
    }
});

// GET /voxlab/triggers - List triggers
router.get('/triggers', (req, res) => {
    const triggers = readJson(path.join(VOXLAB_DIR, 'logs', 'triggers.json'));
    res.json(triggers || []);
});

// GET /voxlab/events?tail=N - Experiment lifecycle events
router.get('/events', (req, res) => {
    const tail = parseInt(req.query.tail) || 50;
    const entries = readNdjson(path.join(VOXLAB_DIR, 'logs', 'experiments.ndjson'), tail);
    res.json(entries);
});

module.exports = router;
