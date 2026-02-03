/**
 * Agents API - Registry, ledger, and resource tracking
 *
 * An agent is a named capability with a type, provider, model, budget,
 * and tags. Types (qa, vox, general) map to bash modules.
 * Providers include openai, anthropic, and tetra (free/local).
 * Budget {0,0} means free/unmetered.
 *
 * Data:
 *   $TETRA_DIR/agents/agents.json   — agent registry
 *   $TETRA_DIR/ledger/ledger.ndjson  — append-only call log
 *   $TETRA_DIR/ledger/rates.json     — pricing data
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');
const AGENTS_FILE = path.join(TETRA_DIR, 'agents', 'agents.json');
const LEDGER_FILE = path.join(TETRA_DIR, 'ledger', 'ledger.ndjson');
const RATES_FILE = path.join(TETRA_DIR, 'ledger', 'rates.json');

// Provider catalog: what types, models, and defaults each provider offers
const PROVIDERS = {
    openai: {
        types: ['qa', 'vox'],
        models: {
            qa: ['chatgpt-4o-latest', 'gpt-4o-latest', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3-mini'],
            vox: ['tts-1', 'tts-1-hd']
        }
    },
    anthropic: {
        types: ['qa'],
        models: {
            qa: ['claude-sonnet-4', 'claude-opus-4', 'claude-haiku-3.5']
        }
    },
    tetra: {
        types: ['general', 'qa', 'vox'],
        models: {
            general: ['local'],
            qa: ['local'],
            vox: ['local']
        }
    }
};

function seedDefaults() {
    const dir = path.dirname(AGENTS_FILE);
    fs.mkdirSync(dir, { recursive: true });

    let qaModel = 'chatgpt-4o-latest';
    const engineFile = path.join(TETRA_DIR, 'qa', 'engine');
    try { qaModel = fs.readFileSync(engineFile, 'utf-8').trim() || qaModel; } catch (_) {}

    const defaults = {
        qa: {
            type: 'qa',
            provider: 'openai',
            model: qaModel,
            data_dir: path.join(TETRA_DIR, 'qa'),
            budget: { daily_usd: 5.0, total_usd: 100.0 },
            tags: ['chat', 'completions']
        },
        vox: {
            type: 'vox',
            provider: 'openai',
            model: 'tts-1',
            data_dir: path.join(TETRA_DIR, 'vox'),
            budget: { daily_usd: 2.0, total_usd: 50.0 },
            tags: ['tts', 'audio']
        },
        'tetra-doctor': {
            type: 'general',
            provider: 'tetra',
            model: 'local',
            data_dir: path.join(TETRA_DIR),
            budget: { daily_usd: 0, total_usd: 0 },
            tags: ['diagnostics', 'free']
        },
        'tetra-guide': {
            type: 'general',
            provider: 'tetra',
            model: 'local',
            data_dir: path.join(TETRA_DIR),
            budget: { daily_usd: 0, total_usd: 0 },
            tags: ['docs', 'free']
        }
    };
    fs.writeFileSync(AGENTS_FILE, JSON.stringify(defaults, null, 2), 'utf-8');
    return defaults;
}

function readJSON(filePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (_) {
        return fallback;
    }
}

function readAgents() {
    if (!fs.existsSync(AGENTS_FILE)) return seedDefaults();
    const agents = readJSON(AGENTS_FILE, {});
    // Migrate: add type field to legacy agents missing it
    let dirty = false;
    for (const [name, a] of Object.entries(agents)) {
        if (!a.type) {
            if (name === 'vox' || (a.model && a.model.startsWith('tts'))) a.type = 'vox';
            else if (a.provider === 'tetra') a.type = 'general';
            else a.type = 'qa';
            if (!a.tags) a.tags = [];
            dirty = true;
        }
    }
    if (dirty) {
        fs.writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2), 'utf-8');
    }
    return agents;
}

function readNDJSON(filePath) {
    try {
        if (!fs.existsSync(filePath)) return [];
        return fs.readFileSync(filePath, 'utf-8')
            .trim().split('\n').filter(Boolean)
            .map(l => { try { return JSON.parse(l); } catch (_) { return null; } })
            .filter(Boolean);
    } catch (_) {
        return [];
    }
}

function cutoffTs(period) {
    const now = Math.floor(Date.now() / 1000);
    if (period === 'day') return now - 86400;
    if (period === 'week') return now - 604800;
    return 0;
}

function hasApiKey(provider) {
    if (provider === 'tetra') return true; // local, always available
    if (provider === 'openai') {
        if (process.env.OPENAI_API_KEY) return true;
        const keyFile = path.join(TETRA_DIR, 'qa', 'api_key');
        try { return fs.existsSync(keyFile) && fs.readFileSync(keyFile, 'utf-8').trim().length > 0; }
        catch (_) { return false; }
    }
    if (provider === 'anthropic') {
        if (process.env.ANTHROPIC_API_KEY) return true;
        const keyFile = path.join(TETRA_DIR, 'agents', 'anthropic_key');
        try { return fs.existsSync(keyFile) && fs.readFileSync(keyFile, 'utf-8').trim().length > 0; }
        catch (_) { return false; }
    }
    return false;
}

function writeAgents(agents) {
    const dir = path.dirname(AGENTS_FILE);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// GET /providers — provider catalog for create form
// ---------------------------------------------------------------------------
router.get('/providers', (req, res) => {
    res.json(PROVIDERS);
});

// ---------------------------------------------------------------------------
// GET /status — full agent overview with optional type/tag filtering
// ---------------------------------------------------------------------------
router.get('/status', (req, res) => {
    const period = req.query.period || 'total';
    const filterType = req.query.type || null;
    const filterTag = req.query.tag || null;
    const filterModel = req.query.model || null;
    let agents = readAgents();
    const entries = readNDJSON(LEDGER_FILE);
    const rates = readJSON(RATES_FILE, {});
    const cutoff = cutoffTs(period);

    const result = {};
    const types = new Set();

    for (const [name, config] of Object.entries(agents)) {
        types.add(config.type || 'general');

        // Apply filters
        if (filterType && config.type !== filterType) continue;
        if (filterTag && !(config.tags || []).includes(filterTag)) continue;
        if (filterModel && config.model !== filterModel) continue;

        const agentEntries = entries.filter(e => e.service === name && e.ts >= cutoff);
        const totalEntries = entries.filter(e => e.service === name);

        const periodSpend = agentEntries.reduce((s, e) => s + (e.cost_usd || 0), 0);
        const dayCutoff = cutoffTs('day');
        const dailySpend = entries
            .filter(e => e.service === name && e.ts >= dayCutoff)
            .reduce((s, e) => s + (e.cost_usd || 0), 0);
        const totalSpend = totalEntries.reduce((s, e) => s + (e.cost_usd || 0), 0);

        const byModel = {};
        for (const e of agentEntries) {
            const m = e.model || 'unknown';
            if (!byModel[m]) byModel[m] = { calls: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 };
            byModel[m].calls++;
            byModel[m].input_tokens += e.input_tokens || 0;
            byModel[m].output_tokens += e.output_tokens || 0;
            byModel[m].cost_usd += e.cost_usd || 0;
        }

        const isFree = config.provider === 'tetra' ||
            (config.budget && config.budget.daily_usd === 0 && config.budget.total_usd === 0);

        result[name] = {
            ...config,
            api_key_ok: hasApiKey(config.provider),
            free: isFree,
            calls: agentEntries.length,
            spend: {
                period: Math.round(periodSpend * 1000000) / 1000000,
                daily: Math.round(dailySpend * 1000000) / 1000000,
                total: Math.round(totalSpend * 1000000) / 1000000
            },
            by_model: byModel
        };
    }

    res.json({
        agents: result,
        period,
        types: [...types].sort(),
        rates: Object.keys(rates)
    });
});

// ---------------------------------------------------------------------------
// GET /ledger — recent ledger entries with type/agent filtering
// ---------------------------------------------------------------------------
router.get('/ledger', (req, res) => {
    const agent = req.query.agent || null;
    const filterType = req.query.type || null;
    const limit = parseInt(req.query.limit) || 50;
    const period = req.query.period || 'total';
    const cutoff = cutoffTs(period);

    const agents = readAgents();
    let entries = readNDJSON(LEDGER_FILE);

    if (agent && agent !== 'all') {
        entries = entries.filter(e => e.service === agent);
    } else if (filterType) {
        const typeNames = Object.entries(agents)
            .filter(([, a]) => a.type === filterType)
            .map(([n]) => n);
        entries = entries.filter(e => typeNames.includes(e.service));
    }
    entries = entries.filter(e => e.ts >= cutoff);

    entries.sort((a, b) => b.ts - a.ts);
    entries = entries.slice(0, limit);

    res.json({ entries, total: entries.length });
});

// ---------------------------------------------------------------------------
// GET /rates — pricing registry
// ---------------------------------------------------------------------------
router.get('/rates', (req, res) => {
    res.json(readJSON(RATES_FILE, {}));
});

// ---------------------------------------------------------------------------
// PUT /agents/:name/budget — update budget for an agent
// ---------------------------------------------------------------------------
router.put('/agents/:name/budget', (req, res) => {
    const { name } = req.params;
    const { daily_usd, total_usd } = req.body;
    const agents = readAgents();

    if (!agents[name]) return res.status(404).json({ error: 'Agent not found' });

    if (daily_usd !== undefined) agents[name].budget.daily_usd = parseFloat(daily_usd);
    if (total_usd !== undefined) agents[name].budget.total_usd = parseFloat(total_usd);

    writeAgents(agents);
    res.json({ ok: true, agent: name, budget: agents[name].budget });
});

// ---------------------------------------------------------------------------
// PUT /agents/:name/model — update default model for an agent
// ---------------------------------------------------------------------------
router.put('/agents/:name/model', (req, res) => {
    const { name } = req.params;
    const { model } = req.body;
    const agents = readAgents();

    if (!agents[name]) return res.status(404).json({ error: 'Agent not found' });
    if (!model) return res.status(400).json({ error: 'model required' });

    agents[name].model = model;
    writeAgents(agents);
    res.json({ ok: true, agent: name, model });
});

// ---------------------------------------------------------------------------
// POST /agents — create a new agent
// ---------------------------------------------------------------------------
router.post('/agents', (req, res) => {
    const { name, type: agentType, provider, model, data_dir, daily_usd, total_usd, tags } = req.body;
    if (!name || !provider || !model) {
        return res.status(400).json({ error: 'name, provider, model required' });
    }

    const agents = readAgents();
    const isFree = provider === 'tetra' || (parseFloat(daily_usd) === 0 && parseFloat(total_usd) === 0);

    agents[name] = {
        type: agentType || 'general',
        provider,
        model,
        data_dir: data_dir || path.join(TETRA_DIR, name),
        budget: {
            daily_usd: isFree ? 0 : (parseFloat(daily_usd) || 5.0),
            total_usd: isFree ? 0 : (parseFloat(total_usd) || 100.0)
        },
        tags: Array.isArray(tags) ? tags : (tags || '').split(',').map(t => t.trim()).filter(Boolean)
    };

    writeAgents(agents);
    res.json({ ok: true, agent: name, config: agents[name] });
});

// ---------------------------------------------------------------------------
// DELETE /agents/:name — remove an agent
// ---------------------------------------------------------------------------
router.delete('/agents/:name', (req, res) => {
    const { name } = req.params;
    const agents = readAgents();
    if (!agents[name]) return res.status(404).json({ error: 'Agent not found' });

    delete agents[name];
    writeAgents(agents);
    res.json({ ok: true, removed: name });
});

module.exports = router;
