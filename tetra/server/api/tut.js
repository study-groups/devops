/**
 * Tut API - Browse and build tut compiled HTML across all orgs
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');
const TETRA_SRC = process.env.TETRA_SRC;
const ORGS_DIR = path.join(TETRA_DIR, 'orgs');

// Cache design assets at startup
let fabCSS = '';
let inspectorJS = '';
try {
    fabCSS = fs.readFileSync(path.join(TETRA_SRC, 'bash/terrain/css/components/fab.css'), 'utf-8');
    inspectorJS = fs.readFileSync(path.join(TETRA_SRC, 'bash/terrain/js/ui/inspector.js'), 'utf-8');
} catch (e) {
    console.warn('[tut] Could not load design assets:', e.message);
}

function listCompiledFiles(org) {
    const dir = path.join(ORGS_DIR, org, 'tut/compiled');
    try {
        return fs.readdirSync(dir).filter(f => f.endsWith('.html'));
    } catch (e) {
        return [];
    }
}

function listSourceFiles(org) {
    const dir = path.join(ORGS_DIR, org, 'tut/src');
    try {
        return fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    } catch (e) {
        return [];
    }
}

function injectDesignFab(html) {
    const injection = `<style>${fabCSS}</style>\n<script>${inspectorJS}</script>\n<script>Terrain.Inspector.checkAutoShow();</script>`;
    return html.replace('</body>', injection + '\n</body>');
}

// GET /:org/docs — unified doc listing with paired src+compiled data
router.get('/:org/docs', (req, res) => {
    const { org } = req.params;
    const srcDir = path.join(ORGS_DIR, org, 'tut/src');
    const compiledDir = path.join(ORGS_DIR, org, 'tut/compiled');

    try {
        const sourceFiles = listSourceFiles(org);
        const compiledFiles = listCompiledFiles(org);
        const compiledSet = new Set(compiledFiles);

        const docs = sourceFiles.map(f => {
            const srcPath = path.join(srcDir, f);
            let content = {};
            try { content = JSON.parse(fs.readFileSync(srcPath, 'utf-8')); } catch (e) {}
            const meta = content.metadata || {};
            const name = f.replace(/\.json$/, '');
            const htmlName = name + '.html';
            const type = content.type || meta.type || 'unknown';

            // Count steps/groups/sections and blocks depending on type
            let stepCount = 0, blockCount = 0;
            if (Array.isArray(content.steps)) {
                stepCount = content.steps.length;
                content.steps.forEach(s => {
                    if (Array.isArray(s.content)) blockCount += s.content.length;
                });
            } else if (Array.isArray(content.groups)) {
                stepCount = content.groups.length;
                content.groups.forEach(g => {
                    if (Array.isArray(g.topics)) {
                        g.topics.forEach(t => {
                            if (Array.isArray(t.content)) blockCount += t.content.length;
                        });
                    }
                });
            } else if (Array.isArray(content.sections)) {
                stepCount = content.sections.length;
                content.sections.forEach(s => {
                    if (Array.isArray(s.content)) blockCount += s.content.length;
                });
            }

            return {
                name,
                filename: f,
                type,
                metadata: {
                    title: meta.title || name,
                    subtitle: meta.subtitle || '',
                    version: meta.version || '0.0.1',
                    difficulty: meta.difficulty || '',
                    estimatedTime: meta.estimatedTime || 0,
                    author: meta.author || '',
                    tags: meta.tags || []
                },
                hasCompiled: compiledSet.has(htmlName),
                hasSource: true,
                stepCount,
                blockCount
            };
        });

        res.json({ org, docs });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /:org/schemas/:type — serve schema files
router.get('/:org/schemas/:type', (req, res) => {
    const { type } = req.params;
    const safeName = type.replace(/[^a-z0-9_-]/gi, '');
    const schemaPath = path.join(TETRA_SRC, 'bash/tut/schemas', safeName + '.schema.json');
    if (!fs.existsSync(schemaPath)) {
        return res.status(404).json({ error: `Schema not found: ${safeName}` });
    }
    res.sendFile(path.resolve(schemaPath));
});

// GET / — list all orgs with compiled tut files
router.get('/', (req, res) => {
    try {
        const orgs = fs.readdirSync(ORGS_DIR).filter(d => {
            const stat = fs.statSync(path.join(ORGS_DIR, d));
            return stat.isDirectory() && !d.startsWith('.');
        });
        const result = orgs.map(org => ({
            org,
            files: listCompiledFiles(org)
        })).filter(o => o.files.length > 0);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /:org/src — list source JSON files
router.get('/:org/src', (req, res) => {
    const { org } = req.params;
    const srcDir = path.join(ORGS_DIR, org, 'tut/src');
    try {
        const files = listSourceFiles(org).map(f => {
            const content = JSON.parse(fs.readFileSync(path.join(srcDir, f), 'utf-8'));
            return { name: f, title: content.title || f, type: content.type || 'unknown' };
        });
        res.json({ org, files });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /:org/src/:file — read raw source JSON file
router.get('/:org/src/:file', (req, res) => {
    const { org, file } = req.params;
    const filePath = path.join(ORGS_DIR, org, 'tut/src', file);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(path.join(ORGS_DIR, org)))) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    res.type('application/json').sendFile(resolved);
});

// PUT /:org/src/:file — save source JSON file
router.put('/:org/src/:file', express.text({ type: 'text/plain', limit: '1mb' }), (req, res) => {
    const { org, file } = req.params;
    const filePath = path.join(ORGS_DIR, org, 'tut/src', file);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(path.join(ORGS_DIR, org)))) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    // req.body may be a parsed object (from global express.json()) or a string
    let content;
    if (typeof req.body === 'string') {
        try { JSON.parse(req.body); } catch (e) {
            return res.status(400).json({ error: 'Invalid JSON: ' + e.message });
        }
        content = req.body;
    } else if (typeof req.body === 'object' && req.body !== null) {
        content = JSON.stringify(req.body, null, 2);
    } else {
        return res.status(400).json({ error: 'No body provided' });
    }
    try {
        fs.writeFileSync(filePath, content, 'utf-8');
        res.json({ ok: true, file });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /:org/build — build source files to compiled HTML
router.post('/:org/build', (req, res) => {
    const { org } = req.params;
    const { target } = req.body || {};
    const srcDir = path.join(ORGS_DIR, org, 'tut/src');
    const compiledDir = path.join(ORGS_DIR, org, 'tut/compiled');

    try {
        if (!fs.existsSync(srcDir)) {
            return res.status(404).json({ error: `No tut/src for org: ${org}` });
        }
        if (!fs.existsSync(compiledDir)) {
            fs.mkdirSync(compiledDir, { recursive: true });
        }

        const sources = target
            ? [target.endsWith('.json') ? target : target + '.json']
            : listSourceFiles(org);

        const built = [];
        for (const src of sources) {
            const srcPath = path.join(srcDir, src);
            const outName = src.replace(/\.json$/, '.html');
            const outPath = path.join(compiledDir, outName);
            if (!fs.existsSync(srcPath)) continue;
            execSync(`source ~/tetra/tetra.sh && tmod load terrain && terrain_doc_build "${srcPath}" "${outPath}"`, {
                shell: '/opt/homebrew/bin/bash',
                env: { ...process.env, HOME: process.env.HOME },
                timeout: 30000
            });
            built.push(outName);
        }
        res.json({ org, built });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /:org — list compiled files for one org
router.get('/:org', (req, res) => {
    const { org } = req.params;
    const files = listCompiledFiles(org);
    res.json({ org, files });
});

// GET /:org/:file — serve compiled HTML file
router.get('/:org/:file', (req, res) => {
    const { org, file } = req.params;
    const filePath = path.join(ORGS_DIR, org, 'tut/compiled', file);

    // Path traversal check
    const resolved = path.resolve(filePath);
    const orgBase = path.resolve(path.join(ORGS_DIR, org));
    if (!resolved.startsWith(orgBase)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    if (req.query.design === 'true') {
        const html = fs.readFileSync(filePath, 'utf-8');
        res.type('html').send(injectDesignFab(html));
    } else {
        res.sendFile(resolved);
    }
});

module.exports = router;
