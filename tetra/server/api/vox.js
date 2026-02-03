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
                } else if (rest === 'rms.json') {
                    files.rms = path.join(VOX_DB, f);
                } else if (rest === 'vad.json') {
                    files.vad = path.join(VOX_DB, f);
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
    if (ext === '.opus') return 'audio/opus';
    if (ext === '.flac') return 'audio/flac';
    return 'application/octet-stream';
}

// ---------------------------------------------------------------------------
// GET /status — provider availability + voice lists
// ---------------------------------------------------------------------------
router.get('/status', (req, res) => {
    try {
        // Fast provider detection without shelling out
        const providers = {
            openai: {
                available: !!process.env.OPENAI_API_KEY,
                voices: VOX_DATA.openai.models['tts-1'],
                models: Object.keys(VOX_DATA.openai.models),
                costPer1M: { 'tts-1': 15.00, 'tts-1-hd': 30.00 }
            },
            coqui: {
                available: fs.existsSync('/opt/homebrew/bin/tts') || fs.existsSync('/usr/local/bin/tts'),
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

        // Skip cache stats on status — too slow

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

        res.json({ providers, voxData: VOX_DATA, cache: null, count, dbPath: VOX_DB });
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
router.get('/db', async (req, res) => {
    try {
        fs.mkdirSync(VOX_DB, { recursive: true });
        const entries = fs.readdirSync(VOX_DB);
        const metaFiles = entries.filter(f => f.endsWith('.vox.meta.json'));

        // Sort by epoch (filename) desc BEFORE reading — most recent first
        metaFiles.sort((a, b) => {
            const idA = parseInt(a.split('.')[0]) || 0;
            const idB = parseInt(b.split('.')[0]) || 0;
            return idB - idA;
        });

        const limit = parseInt(req.query.limit) || 50;
        const search = req.query.search ? req.query.search.toLowerCase() : null;

        // Read only what we need, with early termination
        const voxes = [];
        for (const f of metaFiles) {
            if (!search && voxes.length >= limit) break;
            try {
                const data = JSON.parse(fs.readFileSync(path.join(VOX_DB, f), 'utf-8'));
                if (search) {
                    // Check voice/provider first (cheap)
                    let match = (data.voice || '').toLowerCase().includes(search) ||
                                (data.provider || '').toLowerCase().includes(search);
                    // Check source text only if needed
                    if (!match) {
                        const srcPath = path.join(VOX_DB, data.id + '.vox.source.md');
                        try {
                            const txt = fs.readFileSync(srcPath, 'utf-8');
                            match = txt.toLowerCase().includes(search);
                        } catch (_) {}
                    }
                    if (match) voxes.push(data);
                } else {
                    voxes.push(data);
                }
            } catch (_) {}
            if (!search && voxes.length >= limit) break;
        }

        res.json({ voxes: voxes.slice(0, limit), total: metaFiles.length, dbPath: VOX_DB });
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

        // Build layers with file info and data
        const layers = {};
        for (const [key, filePath] of Object.entries(files)) {
            if (key === 'meta') continue;
            try {
                const stat = fs.statSync(filePath);
                const entry = {
                    file: path.basename(filePath),
                    size: stat.size,
                    modified: stat.mtime.toISOString()
                };
                // Read JSON layer data inline
                if (key !== 'audio' && key !== 'source' && filePath.endsWith('.json')) {
                    try { entry.data = JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch (_) {}
                }
                layers[key] = entry;
            } catch (_) {
                layers[key] = { file: path.basename(filePath) };
            }
        }

        // Source stats
        const stats = source ? {
            characters: source.length,
            words: source.trim().split(/\s+/).filter(Boolean).length,
            lines: source.split('\n').length
        } : null;

        // ffprobe audio metadata
        let audio = null;
        if (files.audio) {
            try {
                const probe = execSync(
                    `/opt/homebrew/bin/ffprobe -v quiet -print_format json -show_format -show_streams "${files.audio}"`,
                    { encoding: 'utf-8', timeout: 10000 }
                );
                const info = JSON.parse(probe);
                const stream = (info.streams || []).find(s => s.codec_type === 'audio') || {};
                const fmt = info.format || {};
                audio = {
                    codec: stream.codec_name || null,
                    sample_rate: parseInt(stream.sample_rate) || null,
                    channels: stream.channels || null,
                    bit_rate: parseInt(fmt.bit_rate || stream.bit_rate) || null,
                    duration: parseFloat(fmt.duration) || meta.duration || null,
                    format: fmt.format_name || null,
                    file: path.basename(files.audio),
                    size: layers.audio ? layers.audio.size : null
                };
            } catch (_) {
                // fallback: just file info
                if (layers.audio) {
                    audio = { file: layers.audio.file, size: layers.audio.size, duration: meta.duration || null };
                }
            }
        }

        // Source hash
        let source_hash = null;
        if (source) {
            const crypto = require('crypto');
            source_hash = crypto.createHash('sha256').update(source).digest('hex');
        }

        res.json({ ...meta, source, audio, layers, stats, source_hash });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---------------------------------------------------------------------------
// GET /db/:id/audio — serve audio file
// ---------------------------------------------------------------------------
router.get('/db/:id/audio', (req, res) => {
    const { id } = req.params;
    const codec = req.query.codec;
    const files = getVoxFiles(id);

    // If no audio in db, check meta.storagePath for external audio
    if (!files.audio && files.meta) {
        try {
            const meta = JSON.parse(fs.readFileSync(files.meta, 'utf-8'));
            if (meta.storagePath && fs.existsSync(meta.storagePath)) {
                files.audio = meta.storagePath;
            }
        } catch (_) {}
    }

    if (!files.audio) return res.status(404).json({ error: 'Audio not found' });

    // If no codec requested, serve original
    if (!codec) {
        const resolved = path.resolve(files.audio);
        res.setHeader('Content-Type', getAudioMime(files.audio));
        return res.sendFile(resolved);
    }

    // Codec-on-demand: encode and cache
    const ext = codec === 'c2' ? 'c2' : codec;
    const voicePart = path.basename(files.audio).replace(/^\d+\.vox\.audio\./, '').replace(/\.[^.]+$/, '');
    const cachedName = `${id}.vox.audio.${voicePart}.${ext}`;
    const cachedPath = path.join(VOX_DB, cachedName);

    // Serve from cache if exists
    if (fs.existsSync(cachedPath)) {
        res.setHeader('Content-Type', getAudioMime(cachedPath));
        return res.sendFile(path.resolve(cachedPath));
    }

    // Encode on demand via vocoder CLI
    try {
        const out = shellExec(
            `source ~/tetra/tetra.sh && vocoder encode ${codec} "${files.audio}" "${cachedPath}"`,
            30000
        );
        if (fs.existsSync(cachedPath)) {
            res.setHeader('Content-Type', getAudioMime(cachedPath));
            return res.sendFile(path.resolve(cachedPath));
        }
        res.status(500).json({ error: 'Encoding produced no output' });
    } catch (e) {
        res.status(500).json({ error: 'Encoding failed: ' + e.message });
    }
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
    if (!id || id === 'undefined') return res.status(400).json({ error: 'Missing vox id' });
    const files = getVoxFiles(id);

    // If no audio in db, check meta.storagePath for external audio
    if (!files.audio && files.meta) {
        try {
            const meta = JSON.parse(fs.readFileSync(files.meta, 'utf-8'));
            if (meta.storagePath && fs.existsSync(meta.storagePath)) {
                files.audio = meta.storagePath;
            }
        } catch (_) {}
    }

    if (!files.audio) return res.status(404).json({ error: 'Audio not found' });

    try {
        const out = shellExec(
            `source ~/tetra/tetra.sh && vox_analyze_full "${files.audio}" "${VOX_DB}" 2>/dev/null`,
            60000
        );

        let result;
        try {
            result = JSON.parse(out.trim());
        } catch (_) {
            // Fallback: run old-style onset analysis
            const onsetsPath = path.join(VOX_DB, `${id}.vox.onsets.json`);
            const onsetOut = shellExec(
                `source ~/tetra/tetra.sh && vox analyze "${files.audio}" 2>/dev/null || echo "[]"`,
                30000
            );
            let onsets;
            try { onsets = JSON.parse(onsetOut.trim()); } catch (__) {
                onsets = onsetOut.trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
            }
            fs.writeFileSync(onsetsPath, JSON.stringify(onsets, null, 2), 'utf-8');
            return res.json({ ok: true, id, onsets });
        }

        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---------------------------------------------------------------------------
// PUT /db/:id/layers/onsets — save edited onset markers
// ---------------------------------------------------------------------------
router.put('/db/:id/layers/onsets', (req, res) => {
    const { id } = req.params;
    const { onsets } = req.body;
    if (!Array.isArray(onsets)) {
        return res.status(400).json({ error: 'onsets must be an array' });
    }
    // Accept [{start, length}, ...] or [number, ...]
    const valid = onsets.every(o => {
        if (typeof o === 'number') return o >= 0;
        if (typeof o === 'object' && o !== null) return typeof o.start === 'number' && o.start >= 0 && typeof o.length === 'number' && o.length >= 0;
        return false;
    });
    if (!valid) {
        return res.status(400).json({ error: 'onsets must be array of {start, length} or non-negative numbers' });
    }
    const files = getVoxFiles(id);
    if (!files.meta) return res.status(404).json({ error: 'Vox not found' });

    const onsetsPath = path.join(VOX_DB, `${id}.vox.onsets.json`);
    fs.writeFileSync(onsetsPath, JSON.stringify(onsets, null, 2), 'utf-8');
    res.json({ ok: true, count: onsets.length });
});

// ---------------------------------------------------------------------------
// DELETE /db/:id — soft delete (move to trash) or permanent delete
// ---------------------------------------------------------------------------
const VOX_TRASH = path.join(VOX_DATA_DIR, 'trash');

router.delete('/db/:id', (req, res) => {
    const { id } = req.params;
    const permanent = req.query.permanent === 'true';
    const files = getVoxFiles(id);
    if (Object.keys(files).length === 0) return res.status(404).json({ error: 'Vox not found' });

    if (permanent) {
        // Permanent delete
        let removed = 0;
        for (const filePath of Object.values(files)) {
            try { fs.unlinkSync(filePath); removed++; } catch (_) {}
        }
        return res.json({ ok: true, id, removed, permanent: true });
    }

    // Soft delete: move to trash
    fs.mkdirSync(VOX_TRASH, { recursive: true });
    let moved = 0;
    for (const filePath of Object.values(files)) {
        try {
            const dest = path.join(VOX_TRASH, path.basename(filePath));
            fs.renameSync(filePath, dest);
            moved++;
        } catch (_) {}
    }
    res.json({ ok: true, id, moved, trashed: true });
});

// ---------------------------------------------------------------------------
// GET /trash — list trashed voxes
// ---------------------------------------------------------------------------
router.get('/trash', (req, res) => {
    try {
        fs.mkdirSync(VOX_TRASH, { recursive: true });
        const entries = fs.readdirSync(VOX_TRASH);
        const metaFiles = entries.filter(f => f.endsWith('.vox.meta.json'));

        metaFiles.sort((a, b) => {
            const idA = parseInt(a.split('.')[0]) || 0;
            const idB = parseInt(b.split('.')[0]) || 0;
            return idB - idA;
        });

        const limit = parseInt(req.query.limit) || 50;
        const voxes = [];
        for (const f of metaFiles) {
            if (voxes.length >= limit) break;
            try {
                const data = JSON.parse(fs.readFileSync(path.join(VOX_TRASH, f), 'utf-8'));
                voxes.push(data);
            } catch (_) {}
        }

        res.json({ voxes, total: metaFiles.length, trashPath: VOX_TRASH });
    } catch (e) {
        res.json({ voxes: [], total: 0, trashPath: VOX_TRASH, error: e.message });
    }
});

// ---------------------------------------------------------------------------
// POST /trash/:id/restore — restore from trash
// ---------------------------------------------------------------------------
router.post('/trash/:id/restore', (req, res) => {
    const { id } = req.params;
    const prefix = id + '.vox.';

    try {
        const entries = fs.readdirSync(VOX_TRASH);
        const files = entries.filter(f => f.startsWith(prefix));
        if (files.length === 0) return res.status(404).json({ error: 'Vox not found in trash' });

        fs.mkdirSync(VOX_DB, { recursive: true });
        let restored = 0;
        for (const f of files) {
            try {
                fs.renameSync(path.join(VOX_TRASH, f), path.join(VOX_DB, f));
                restored++;
            } catch (_) {}
        }
        res.json({ ok: true, id, restored });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---------------------------------------------------------------------------
// DELETE /trash/:id — permanently delete from trash
// ---------------------------------------------------------------------------
router.delete('/trash/:id', (req, res) => {
    const { id } = req.params;
    const prefix = id + '.vox.';

    try {
        const entries = fs.readdirSync(VOX_TRASH);
        const files = entries.filter(f => f.startsWith(prefix));
        if (files.length === 0) return res.status(404).json({ error: 'Vox not found in trash' });

        let removed = 0;
        for (const f of files) {
            try { fs.unlinkSync(path.join(VOX_TRASH, f)); removed++; } catch (_) {}
        }
        res.json({ ok: true, id, removed });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---------------------------------------------------------------------------
// DELETE /trash — empty trash (delete all)
// ---------------------------------------------------------------------------
router.delete('/trash', (req, res) => {
    try {
        fs.mkdirSync(VOX_TRASH, { recursive: true });
        const entries = fs.readdirSync(VOX_TRASH);
        let removed = 0;
        for (const f of entries) {
            try { fs.unlinkSync(path.join(VOX_TRASH, f)); removed++; } catch (_) {}
        }
        res.json({ ok: true, removed });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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

// ---------------------------------------------------------------------------
// Vocoder static assets — serve player JS/CSS from bash/vocoder/
// ---------------------------------------------------------------------------
const TETRA_SRC = process.env.TETRA_SRC || path.join(process.env.HOME, 'src', 'devops', 'tetra');
const VOCODER_SRC = path.join(TETRA_SRC, 'bash', 'vocoder');

router.get('/vocoder/player.js', (req, res) => {
    const file = path.join(VOCODER_SRC, 'js', 'vocoder-player.js');
    if (!fs.existsSync(file)) return res.status(404).send('vocoder-player.js not found');
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.resolve(file));
});

router.get('/vocoder/player.css', (req, res) => {
    const file = path.join(VOCODER_SRC, 'css', 'vocoder-player.css');
    if (!fs.existsSync(file)) return res.status(404).send('vocoder-player.css not found');
    res.setHeader('Content-Type', 'text/css');
    res.sendFile(path.resolve(file));
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
