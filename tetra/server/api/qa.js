/**
 * QA API - Run bash test suites and return structured JSON results
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TETRA_SRC = process.env.TETRA_SRC;
const TESTS_DIR = path.join(TETRA_SRC, 'tests/startup');

// GET /api/qa/suites — list available test suites
router.get('/suites', (req, res) => {
    try {
        const files = fs.readdirSync(TESTS_DIR)
            .filter(f => f.startsWith('test-') && f.endsWith('.sh'))
            .map(f => {
                const name = f.replace(/^test-/, '').replace(/\.sh$/, '');
                return { name, file: f };
            });
        res.json({ suites: files });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/qa/suites/:name/tests — list tests in a suite without running
router.get('/suites/:name/tests', (req, res) => {
    const { name } = req.params;
    const file = `test-${name}.sh`;
    const filePath = path.join(TESTS_DIR, file);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(TESTS_DIR))) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    if (!fs.existsSync(resolved)) {
        return res.status(404).json({ error: `Suite not found: ${name}` });
    }
    const lines = fs.readFileSync(resolved, 'utf-8').split('\n');
    const tests = [];
    for (const line of lines) {
        const m = line.match(/^\s*run_test\s+"([^"]+)"\s+(\S+)/);
        if (m) {
            tests.push({ name: m[1], function: m[2], file: resolved });
        }
    }
    res.json({ suite: name, file: resolved, tests });
});

// POST /api/qa/suites/run — run a suite (or all)
router.post('/suites/run', (req, res) => {
    const { suite } = req.body || {};
    if (!suite) {
        return res.status(400).json({ error: 'Missing suite parameter' });
    }

    try {
        let scriptPath;
        if (suite === 'all') {
            scriptPath = path.join(TESTS_DIR, 'run-all.sh');
        } else {
            const file = `test-${suite}.sh`;
            scriptPath = path.join(TESTS_DIR, file);
        }

        const resolved = path.resolve(scriptPath);
        if (!resolved.startsWith(path.resolve(TESTS_DIR))) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (!fs.existsSync(scriptPath)) {
            return res.status(404).json({ error: `Suite not found: ${suite}` });
        }

        const result = execSync(
            `source ~/tetra/tetra.sh 2>/dev/null; TETRA_TEST_JSON=1 bash "${resolved}"`,
            {
                shell: '/opt/homebrew/bin/bash',
                timeout: 60000,
                env: { ...process.env, TETRA_TEST_JSON: '1' }
            }
        );
        res.json(JSON.parse(result.toString().trim()));
    } catch (e) {
        if (e.stdout) {
            try {
                res.json(JSON.parse(e.stdout.toString().trim()));
                return;
            } catch (_) {}
        }
        res.status(500).json({ error: e.message });
    }
});

// GET /api/qa/guide/:topic — return guide content
router.get('/guide/:topic', (req, res) => {
    const { topic } = req.params;
    if (!/^[a-z0-9_-]+$/.test(topic)) {
        return res.status(400).json({ error: 'Invalid topic' });
    }
    try {
        const output = execSync(
            `source ~/tetra/tetra.sh 2>/dev/null && _tetra_guide_${topic}`,
            {
                shell: '/opt/homebrew/bin/bash',
                timeout: 10000,
                env: process.env
            }
        );
        const content = output.toString().replace(/\x1b\[[0-9;]*m/g, '');
        res.json({ topic, content });
    } catch (e) {
        res.status(404).json({ error: `Guide not found: ${topic}` });
    }
});

// GET /api/qa/test/source — extract a bash function body from a test file
router.get('/test/source', (req, res) => {
    const { file, function: funcName } = req.query;
    if (!file || !funcName) {
        return res.status(400).json({ error: 'Missing file or function parameter' });
    }
    if (!/^[a-z0-9_]+$/.test(funcName)) {
        return res.status(400).json({ error: 'Invalid function name' });
    }
    const resolved = path.resolve(file);
    if (!resolved.startsWith(path.resolve(TESTS_DIR))) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    if (!fs.existsSync(resolved)) {
        return res.status(404).json({ error: 'File not found' });
    }
    const lines = fs.readFileSync(resolved, 'utf-8').split('\n');
    const startPattern = new RegExp(`^${funcName}\\s*\\(\\)`);
    let startLine = -1;
    let endLine = -1;
    let braceDepth = 0;
    for (let i = 0; i < lines.length; i++) {
        if (startLine === -1) {
            if (startPattern.test(lines[i])) {
                startLine = i;
                // Opening brace may be on same line or next
                if (lines[i].includes('{')) braceDepth = 1;
            }
        } else {
            if (braceDepth === 0 && lines[i].trim() === '{') {
                braceDepth = 1;
                continue;
            }
            for (const ch of lines[i]) {
                if (ch === '{') braceDepth++;
                else if (ch === '}') braceDepth--;
            }
            if (braceDepth <= 0) {
                endLine = i;
                break;
            }
        }
    }
    if (startLine === -1) {
        return res.status(404).json({ error: `Function not found: ${funcName}` });
    }
    if (endLine === -1) endLine = lines.length - 1;
    const source = lines.slice(startLine, endLine + 1).join('\n');
    res.json({
        function: funcName,
        file: resolved,
        startLine: startLine + 1,
        endLine: endLine + 1,
        source
    });
});

// GET /api/qa/status — return QA status
router.get('/status', (req, res) => {
    try {
        const output = execSync(
            'source ~/tetra/tetra.sh 2>/dev/null && tetra qa status',
            {
                shell: '/opt/homebrew/bin/bash',
                timeout: 10000,
                env: process.env
            }
        );
        const content = output.toString().replace(/\x1b\[[0-9;]*m/g, '');
        res.json({ status: content });
    } catch (e) {
        res.json({ status: 'unavailable', error: e.message });
    }
});

module.exports = router;
