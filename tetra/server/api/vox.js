/**
 * Vox API - TTS generation, persistence, and annotation
 *
 * A vox is an epoch-keyed bundle in $TETRA_DIR/vox/db/.
 * The server shells out to `vox generate` which handles audio creation.
 * Metadata, source text, and annotations are stored alongside the audio.
 *
 * Naming: {EPOCH}.vox.{layer}.{ext}
 * Task log lives at ~/tetra/vox/logs/tasks.ndjson
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');
const BASH = '/opt/homebrew/bin/bash';

const VOX_DATA_DIR = path.join(TETRA_DIR, 'vox');
const VOX_DB = path.join(VOX_DATA_DIR, 'db');
const DEFAULTS_FILE = path.join(VOX_DATA_DIR, 'defaults.json');
const TASK_LOG_DIR = path.join(VOX_DATA_DIR, 'logs');
const TASK_LOG_FILE = path.join(TASK_LOG_DIR, 'tasks.ndjson');

// Cost rates per 1M characters
const COST_RATES = {
    'openai:tts-1':    15.00,
    'openai:tts-1-hd': 30.00,
    'coqui':            0,
    'formant':          0
};

// Provider → model → voices structure
const VOX_DATA = {
    openai: {
        models: {
            'tts-1': ['shimmer', 'alloy', 'ash', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage'],
            'tts-1-hd': ['shimmer', 'alloy', 'ash', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage']
        }
    },
    coqui: {
        models: {
            'vits': [],
            'tacotron': [],
            'xtts': [
                'Claribel_Dervla', 'Daisy_Studious', 'Gracie_Wise',
                'Tammie_Ema', 'Alison_Dietlinde', 'Ana_Florence',
                'Annmarie_Nele', 'Asya_Anara', 'Brenda_Stern',
                'Gitta_Nikolina', 'Henriette_Usha', 'Sofia_Hellen',
                'Tammy_Grit', 'Tanja_Adelina', 'Vjollca_Johnnie',
                'Andrew_Chipper', 'Badr_Odhiambo', 'Dionisio_Schuyler',
                'Royston_Min', 'Viktor_Eka'
            ]
        }
    }
};

function shellExec(cmd, timeout = 60000) {
    return execSync(cmd, { shell: BASH, timeout, encoding: 'utf-8' });
}

function estimateCost(text, provider, model) {
    const chars = text.length;
    let rateKey = provider;
    if (provider === 'openai') rateKey = 'openai:' + (model || 'tts-1');
    const rate = COST_RATES[rateKey] || 0;
    return { chars, cost: (chars * rate) / 1000000, rate, rateKey };
}

function logTask(entry) {
    fs.mkdirSync(TASK_LOG_DIR, { recursive: true });
    const event = {
        ts: new Date().toISOString(),
        event: entry.event || 'vox_generate',
        ...entry
    };
    fs.appendFileSync(TASK_LOG_FILE, JSON.stringify(event) + '\n', 'utf-8');
    return event;
}

// ---------------------------------------------------------------------------
// Vox helpers
// ---------------------------------------------------------------------------

function buildVoxVoice(provider, voice, model) {
    const prov = provider || 'openai';
    if (prov === 'coqui') {
        const v = voice || 'vits';
        return 'coqui:' + (v === 'default' ? 'vits' : v);
    }
    if (prov === 'formant') {
        return 'formant:' + (voice || 'ipa');
    }
    return voice || 'shimmer';
}

function getVoxFiles(id) {
    const prefix = id + '.vox.';
    const files = {};
    try {
        const entries = fs.readdirSync(VOX_DB);
        for (const f of entries) {
            if (f.startsWith(prefix)) {
                const rest = f.substring(prefix.length);
                // Determine layer: source.md, meta.json, audio.*.ext, onsets.json, etc.
                if (rest.startsWith('audio.')) {
                    files.audio = path.join(VOX_DB, f);
                } else if (rest === 'source.md') {
                    files.source = path.join(VOX_DB, f);
                } else if (rest === 'meta.json') {
                    files.meta = path.join(VOX_DB, f);
                } else if (rest === 'onsets.json') {
                    files.onsets = path.join(VOX_DB, f);
                } else if (rest === 'tokens.json') {
                    files.tokens = path.join(VOX_DB, f);
                } else if (rest === 'phonemes.json') {
                    files.phonemes = path.join(VOX_DB, f);
                } else if (rest.startsWith('spans.')) {
                    files.spans = path.join(VOX_DB, f);
                } else if (rest === 'formants.json') {
                    files.formants = path.join(VOX_DB, f);
                } else if (rest === 'bites.json') {
                    files.bites = path.join(VOX_DB, f);
                }
            }
        }
    } catch (_) {}
    return files;
}

function getAudioMime(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.wav') return 'audio/wav';
    if (ext === '.mp3') return 'audio/mpeg';
    if (ext === '.ogg') return 'audio/ogg';
    if (ext === '.flac') return 'audio/flac';
    return 'application/octet-stream';
}

// ---------------------------------------------------------------------------
// GET /status — provider availability + voice lists
// ---------------------------------------------------------------------------
router.get('/status', (req, res) => {
    try {
        const out = shellExec('source ~/tetra/tetra.sh && vox provider status 2>/dev/null || echo "unavailable"', 10000);

        const providers = {
            openai: {
                available: false,
                voices: VOX_DATA.openai.models['tts-1'],
                models: Object.keys(VOX_DATA.openai.models),
                costPer1M: { 'tts-1': 15.00, 'tts-1-hd': 30.00 }
            },
            coqui: {
                available: false,
                models: Object.keys(VOX_DATA.coqui.models),
                aliases: { fast: 'vits', classic: 'tacotron', best: 'xtts' },
                costPer1M: 0
            },
            formant: {
                available: false,
                voices: ['ipa'],
                costPer1M: 0
            }
        };

        if (out.includes('openai') && !out.includes('openai: not')) {
            providers.openai.available = true;
        }
        if (process.env.OPENAI_API_KEY) {
            providers.openai.available = true;
        }
        if (out.includes('coqui') && !out.includes('coqui: not')) {
            providers.coqui.available = true;
        }
        if (out.includes('formant') && !out.includes('formant: not')) {
            providers.formant.available = true;
        }

        let cacheStats = null;
        try {
            const cacheOut = shellExec('source ~/tetra/tetra.sh && vox cache stats 2>/dev/null || echo "{}"', 10000);
            const hitsMatch = cacheOut.match(/hits?:\s*(\d+)/i);
            const missesMatch = cacheOut.match(/miss(?:es)?:\s*(\d+)/i);
            const sizeMatch = cacheOut.match(/(\d+)\s*files?/i);
            cacheStats = {
                hits: hitsMatch ? parseInt(hitsMatch[1]) : 0,
                misses: missesMatch ? parseInt(missesMatch[1]) : 0,
                files: sizeMatch ? parseInt(sizeMatch[1]) : 0
            };
        } catch (_) {}

        // Vox count
        let count = 0;
        try {
            const entries = fs.readdirSync(VOX_DB);
            const ids = new Set();
            for (const f of entries) {
                const m = f.match(/^(\d+)\.vox\./);
                if (m) ids.add(m[1]);
            }
            count = ids.size;
        } catch (_) {}

        res.json({ providers, voxData: VOX_DATA, cache: cacheStats, count, dbPath: VOX_DB });
    } catch (e) {
        res.json({
            providers: {
                openai: {
                    available: !!process.env.OPENAI_API_KEY,
                    voices: VOX_DATA.openai.models['tts-1'],
                    models: Object.keys(VOX_DATA.openai.models),
                    costPer1M: { 'tts-1': 15.00, 'tts-1-hd': 30.00 }
                },
                coqui: {
                    available: false,
                    models: Object.keys(VOX_DATA.coqui.models),
                    aliases: { fast: 'vits', classic: 'tacotron', best: 'xtts' },
                    costPer1M: 0
                },
                formant: {
                    available: false,
                    voices: ['ipa'],
                    costPer1M: 0
                }
            },
            voxData: VOX_DATA,
            cache: null,
            count: 0,
            dbPath: VOX_DB,
            error: e.message
        });
    }
});

// ---------------------------------------------------------------------------
// POST /generate — generate a vox (persistent TTS)
// ---------------------------------------------------------------------------
router.post('/generate', (req, res) => {
    const { text, provider, voice, model } = req.body;
    const prov = provider || 'openai';
    console.log('[vox/generate] provider=%s voice=%s model=%s text=%s', prov, voice, model, (text || '').slice(0, 40));
    if (!text) return res.status(400).json({ error: 'text required' });

    const voxVoice = buildVoxVoice(prov, voice, model);
    const cost = estimateCost(text, prov, model);

    fs.mkdirSync(VOX_DB, { recursive: true });
    const epoch = Math.floor(Date.now() / 1000);
    const id = String(epoch);
    const ext = prov === 'coqui' ? 'wav' : 'mp3';
    // Extract short voice name for filename
    const voiceShort = voxVoice.replace(/^[^:]+:/, '').replace(/\//g, '-');
    const audioFileName = `${id}.vox.audio.${voiceShort}.${ext}`;
    const audioPath = path.join(VOX_DB, audioFileName);
    const sourcePath = path.join(VOX_DB, `${id}.vox.source.md`);
    const metaPath = path.join(VOX_DB, `${id}.vox.meta.json`);

    try {
        const escaped = text.replace(/'/g, "'\\''");
        const modelFlag = prov === 'openai' && model && model !== 'tts-1' ? ` --model ${model}` : '';
        const t0 = Date.now();
        shellExec(
            `source ~/tetra/tetra.sh && echo '${escaped}' | vox generate ${voxVoice}${modelFlag} --output "${audioPath}"`,
            60000
        );
        const encodeTime = (Date.now() - t0) / 1000;

        let duration = null;
        try {
            const out = execSync(
                `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`,
                { encoding: 'utf-8', timeout: 10000 }
            );
            duration = parseFloat(out.trim()) || null;
        } catch (_) {}

        const rtf = duration ? Math.round((encodeTime / duration) * 100) / 100 : null;

        // Write source text
        fs.writeFileSync(sourcePath, text, 'utf-8');

        // Write meta
        const meta = {
            id,
            provider: prov,
            voice: voxVoice,
            model: model || 'tts-1',
            duration,
            encodeTime,
            rtf,
            cost: cost.cost,
            chars: cost.chars,
            created: new Date().toISOString(),
            storagePath: audioPath
        };
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

        logTask({
            event: 'vox_generate',
            id,
            provider: prov,
            voice: voxVoice,
            model: model || 'tts-1',
            chars: cost.chars,
            cost: cost.cost,
            duration,
            encodeTime,
            rtf,
            status: 'ok'
        });

        res.json({
            ok: true,
            id,
            duration,
            encodeTime,
            rtf,
            cost,
            provider: prov,
            voice: voxVoice,
            model: model || 'tts-1',
            audioUrl: '/api/vox/db/' + id + '/audio'
        });
    } catch (e) {
        try { fs.unlinkSync(audioPath); } catch (_) {}
        logTask({
            event: 'vox_generate',
            id,
            provider: prov, voice: voxVoice, model: model || 'tts-1',
            chars: cost.chars, cost: cost.cost,
            status: 'error', error: e.message
        });
        res.status(500).json({ error: e.message, cost });
    }
});

// POST /test — alias for /generate (backward compatibility)
router.post('/test', (req, res, next) => {
    req.url = '/generate';
    router.handle(req, res, next);
});

// ---------------------------------------------------------------------------
// GET /db — list voxes from db/
// ---------------------------------------------------------------------------
router.get('/db', (req, res) => {
    try {
        fs.mkdirSync(VOX_DB, { recursive: true });
        const entries = fs.readdirSync(VOX_DB);
        const metaFiles = entries.filter(f => f.endsWith('.vox.meta.json'));

        let voxes = metaFiles.map(f => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(VOX_DB, f), 'utf-8'));
                return data;
            } catch (_) { return null; }
        }).filter(Boolean);

        // Sort by epoch desc
        voxes.sort((a, b) => parseInt(b.id) - parseInt(a.id));

        // Search filter
        const search = req.query.search;
        if (search) {
            const lower = search.toLowerCase();
            voxes = voxes.filter(v => {
                // Check source text
                const srcPath = path.join(VOX_DB, v.id + '.vox.source.md');
                try {
                    const txt = fs.readFileSync(srcPath, 'utf-8');
                    if (txt.toLowerCase().includes(lower)) return true;
                } catch (_) {}
                // Check voice/provider
                if ((v.voice || '').toLowerCase().includes(lower)) return true;
                if ((v.provider || '').toLowerCase().includes(lower)) return true;
                return false;
            });
        }

        const limit = parseInt(req.query.limit) || 50;
        voxes = voxes.slice(0, limit);

        res.json({ voxes, total: metaFiles.length, dbPath: VOX_DB });
    } catch (e) {
        res.json({ voxes: [], total: 0, dbPath: VOX_DB, error: e.message });
    }
});

// ---------------------------------------------------------------------------
// GET /db/:id — full detail: meta + annotation manifest
// ---------------------------------------------------------------------------
router.get('/db/:id', (req, res) => {
    const { id } = req.params;
    const files = getVoxFiles(id);
    if (!files.meta) return res.status(404).json({ error: 'Vox not found' });

    try {
        const meta = JSON.parse(fs.readFileSync(files.meta, 'utf-8'));
        let source = null;
        if (files.source) {
            source = fs.readFileSync(files.source, 'utf-8');
        }

        // Build annotation manifest
        const layers = {};
        for (const [key, val] of Object.entries(files)) {
            if (key !== 'meta') layers[key] = true;
        }

        let onsets = null;
        if (files.onsets) {
            try { onsets = JSON.parse(fs.readFileSync(files.onsets, 'utf-8')); } catch (_) {}
        }

        res.json({ ...meta, source, layers, onsets });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---------------------------------------------------------------------------
// GET /db/:id/audio — serve audio file
// ---------------------------------------------------------------------------
router.get('/db/:id/audio', (req, res) => {
    const { id } = req.params;
    const files = getVoxFiles(id);
    if (!files.audio) return res.status(404).json({ error: 'Audio not found' });

    const resolved = path.resolve(files.audio);
    res.setHeader('Content-Type', getAudioMime(files.audio));
    res.sendFile(resolved);
});

// ---------------------------------------------------------------------------
// GET /db/:id/source — return source text
// ---------------------------------------------------------------------------
router.get('/db/:id/source', (req, res) => {
    const { id } = req.params;
    const files = getVoxFiles(id);
    if (!files.source) return res.status(404).json({ error: 'Source not found' });

    const text = fs.readFileSync(files.source, 'utf-8');
    res.type('text/plain').send(text);
});

// ---------------------------------------------------------------------------
// POST /db/:id/analyze — run vox analyze, write onsets.json
// ---------------------------------------------------------------------------
router.post('/db/:id/analyze', (req, res) => {
    const { id } = req.params;
    const files = getVoxFiles(id);
    if (!files.audio) return res.status(404).json({ error: 'Audio not found' });

    try {
        const onsetsPath = path.join(VOX_DB, `${id}.vox.onsets.json`);
        const out = shellExec(
            `source ~/tetra/tetra.sh && vox analyze "${files.audio}" 2>/dev/null || echo "[]"`,
            30000
        );

        let onsets;
        try {
            onsets = JSON.parse(out.trim());
        } catch (_) {
            // Try to parse as space/newline-separated floats
            onsets = out.trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
        }

        fs.writeFileSync(onsetsPath, JSON.stringify(onsets, null, 2), 'utf-8');
        res.json({ ok: true, id, onsets });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---------------------------------------------------------------------------
// DELETE /db/:id — remove all files for epoch
// ---------------------------------------------------------------------------
router.delete('/db/:id', (req, res) => {
    const { id } = req.params;
    const files = getVoxFiles(id);
    if (Object.keys(files).length === 0) return res.status(404).json({ error: 'Vox not found' });

    let removed = 0;
    for (const filePath of Object.values(files)) {
        try { fs.unlinkSync(filePath); removed++; } catch (_) {}
    }
    res.json({ ok: true, id, removed });
});

// ---------------------------------------------------------------------------
// POST /dry-run — cost estimate without generating
// ---------------------------------------------------------------------------
router.post('/dry-run', (req, res) => {
    const { text, provider, model } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });
    const est = estimateCost(text, provider || 'openai', model);
    res.json({ ok: true, scope: 'single', ...est });
});

// ---------------------------------------------------------------------------
// GET /tasks — read task log
// ---------------------------------------------------------------------------
router.get('/tasks', (req, res) => {
    if (!fs.existsSync(TASK_LOG_FILE)) return res.json({ tasks: [], total: 0 });
    const lines = fs.readFileSync(TASK_LOG_FILE, 'utf-8').trim().split('\n').filter(Boolean);
    const limit = parseInt(req.query.limit) || 100;
    const event = req.query.event || null;
    let tasks = lines.map(l => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);
    if (event) tasks = tasks.filter(t => t.event === event);
    tasks = tasks.slice(-limit);
    res.json({ tasks, total: lines.length });
});

// ---------------------------------------------------------------------------
// GET /tasks/stats — aggregates
// ---------------------------------------------------------------------------
router.get('/tasks/stats', (req, res) => {
    if (!fs.existsSync(TASK_LOG_FILE)) {
        return res.json({ count: 0, totalDuration: 0, totalCost: 0, avgRtf: 0, byProvider: {} });
    }
    const lines = fs.readFileSync(TASK_LOG_FILE, 'utf-8').trim().split('\n').filter(Boolean);
    const tasks = lines.map(l => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);

    let totalDuration = 0;
    let totalCost = 0;
    let rtfSum = 0;
    let rtfCount = 0;
    const byProvider = {};

    for (const t of tasks) {
        if (t.duration) totalDuration += t.duration;
        if (t.cost) totalCost += t.cost;
        if (t.rtf) { rtfSum += t.rtf; rtfCount++; }

        const p = t.provider || 'unknown';
        if (!byProvider[p]) byProvider[p] = { count: 0, duration: 0, cost: 0 };
        byProvider[p].count++;
        if (t.duration) byProvider[p].duration += t.duration;
        if (t.cost) byProvider[p].cost += t.cost;
    }

    res.json({
        count: tasks.length,
        totalDuration: Math.round(totalDuration * 100) / 100,
        totalCost: Math.round(totalCost * 1000000) / 1000000,
        avgRtf: rtfCount ? Math.round((rtfSum / rtfCount) * 10) / 10 : 0,
        byProvider
    });
});

// ---------------------------------------------------------------------------
// GET /defaults — read defaults
// ---------------------------------------------------------------------------
router.get('/defaults', (req, res) => {
    try {
        if (fs.existsSync(DEFAULTS_FILE)) {
            const data = JSON.parse(fs.readFileSync(DEFAULTS_FILE, 'utf-8'));
            return res.json(data);
        }
    } catch (_) {}
    res.json({ provider: 'coqui', model: 'vits', voice: '' });
});

// ---------------------------------------------------------------------------
// PUT /defaults — save defaults
// ---------------------------------------------------------------------------
router.put('/defaults', (req, res) => {
    const { provider, model, voice } = req.body;
    fs.mkdirSync(VOX_DATA_DIR, { recursive: true });
    const data = { provider: provider || 'coqui', model: model || 'vits', voice: voice || '' };
    fs.writeFileSync(DEFAULTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ ok: true, ...data });
});

// Exports for use by director.js
router.logTask = logTask;
router.estimateCost = estimateCost;
router.buildVoxVoice = buildVoxVoice;
router.COST_RATES = COST_RATES;
router.VOX_DATA = VOX_DATA;
router.VOX_DB = VOX_DB;
router.TASK_LOG_FILE = TASK_LOG_FILE;
router.TASK_LOG_DIR = TASK_LOG_DIR;

module.exports = router;
