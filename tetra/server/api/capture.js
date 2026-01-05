/**
 * Capture API - Enhanced Playwright wrapper for page capture
 *
 * Modes:
 *   - quick: Screenshot + text content (fast, lightweight)
 *   - full: Rich extraction (structure, accessibility, performance)
 *   - journey: Multi-step capture with state tracking
 *   - trace: Full Playwright trace recording
 *
 * Storage: $TETRA_DIR/orgs/<org>/captures/
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');
const ORGS_DIR = path.join(TETRA_DIR, 'orgs');

// ============================================================================
// Helpers
// ============================================================================

function getCaptureDir(org) {
    return path.join(ORGS_DIR, org, 'captures');
}

function getSessionDir(org, name) {
    return path.join(ORGS_DIR, org, 'captures', 'sessions', name);
}

function getSessionsDir(org) {
    return path.join(ORGS_DIR, org, 'captures', 'sessions');
}

function generateId() {
    const now = new Date();
    const date = now.toISOString().replace(/[-:]/g, '').split('.')[0];
    const rand = Math.random().toString(36).substring(2, 6);
    return `${date}-${rand}`;
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

/**
 * Run a Playwright script and return parsed JSON result
 * Uses async spawn to avoid blocking the server (deadlock when capturing localhost)
 */
function runPlaywrightScript(script, outputDir, timeout = 60000) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(outputDir, '_capture-script.js');
        const serverDir = path.join(__dirname, '..');

        // Write script to temp file
        fs.writeFileSync(scriptPath, script);

        console.log('[capture] Running script:', scriptPath);

        const proc = spawn('node', [scriptPath], {
            cwd: serverDir,
            env: { ...process.env, NODE_PATH: path.join(serverDir, 'node_modules') }
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        const timer = setTimeout(() => {
            proc.kill();
            reject(new Error('Script timeout'));
        }, timeout);

        proc.on('close', (code) => {
            clearTimeout(timer);

            // Clean up script
            try { fs.unlinkSync(scriptPath); } catch {}

            if (code !== 0) {
                console.log('[capture] Script failed:', stderr || stdout);
                reject(new Error(stderr || stdout || `Exit code ${code}`));
                return;
            }

            // Parse JSON from output
            try {
                const lines = stdout.trim().split('\n');
                const jsonLine = lines[lines.length - 1];
                resolve(JSON.parse(jsonLine));
            } catch (e) {
                reject(new Error(`Failed to parse output: ${stdout}`));
            }
        });

        proc.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

// ============================================================================
// Capture Scripts
// ============================================================================

function buildQuickScript(url, outputDir, id, options = {}) {
    const screenshotPath = path.join(outputDir, 'screenshot.png');
    const metaPath = path.join(outputDir, 'meta.json');
    const sessionStatePath = options.session
        ? path.join(options.sessionsDir, options.session, 'state.json')
        : null;
    const contextOptionsCode = sessionStatePath
        ? `{ storageState: JSON.parse(fs.readFileSync(${JSON.stringify(sessionStatePath)}, 'utf-8')) }`
        : `{}`;

    return `
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext(${contextOptionsCode});
    const page = await context.newPage();

    const startTime = Date.now();
    await page.goto(${JSON.stringify(url)}, { waitUntil: 'domcontentloaded', timeout: 30000 });

    await page.screenshot({ path: ${JSON.stringify(screenshotPath)}, fullPage: false });

    const title = await page.title();
    const textContent = await page.evaluate(() => document.body.innerText);
    const finalUrl = page.url();

    const meta = {
        id: ${JSON.stringify(id)},
        mode: 'quick',
        url: ${JSON.stringify(url)},
        finalUrl,
        title,
        textContent: textContent.substring(0, 50000),
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
    };

    fs.writeFileSync(${JSON.stringify(metaPath)}, JSON.stringify(meta, null, 2));

    await browser.close();
    console.log(JSON.stringify({ success: true, id: ${JSON.stringify(id)}, ...meta }));
})().catch(e => {
    console.error(JSON.stringify({ success: false, error: e.message }));
    process.exit(1);
});
`;
}

function buildFullScript(url, outputDir, id, options = {}) {
    const screenshotPath = path.join(outputDir, 'screenshot.png');
    const domPath = path.join(outputDir, 'dom.html');
    const metaPath = path.join(outputDir, 'meta.json');
    const structurePath = path.join(outputDir, 'structure.json');
    const accessibilityPath = path.join(outputDir, 'accessibility.json');
    const sessionStatePath = options.session
        ? path.join(options.sessionsDir, options.session, 'state.json')
        : null;
    const contextOptionsCode = sessionStatePath
        ? `{ storageState: JSON.parse(fs.readFileSync(${JSON.stringify(sessionStatePath)}, 'utf-8')) }`
        : `{}`;

    return `
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext(${contextOptionsCode});
    const page = await context.newPage();

    const startTime = Date.now();
    const response = await page.goto(${JSON.stringify(url)}, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Screenshot
    await page.screenshot({ path: ${JSON.stringify(screenshotPath)}, fullPage: false });

    // DOM
    const html = await page.content();
    fs.writeFileSync(${JSON.stringify(domPath)}, html);

    // Basic info
    const title = await page.title();
    const textContent = await page.evaluate(() => document.body.innerText);
    const finalUrl = page.url();

    // Structure extraction
    const structure = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => ({
            level: h.tagName.toLowerCase(),
            text: h.innerText.trim().substring(0, 200)
        }));

        const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 100).map(a => ({
            text: a.innerText.trim().substring(0, 100),
            href: a.href
        }));

        const forms = Array.from(document.querySelectorAll('form')).map(f => ({
            action: f.action,
            method: f.method,
            fields: Array.from(f.querySelectorAll('input,select,textarea')).map(el => ({
                type: el.type || el.tagName.toLowerCase(),
                name: el.name,
                id: el.id,
                placeholder: el.placeholder
            }))
        }));

        const images = Array.from(document.querySelectorAll('img')).slice(0, 50).map(img => ({
            src: img.src,
            alt: img.alt,
            width: img.naturalWidth,
            height: img.naturalHeight
        }));

        const buttons = Array.from(document.querySelectorAll('button,[role="button"],input[type="submit"],input[type="button"]')).map(b => ({
            text: b.innerText?.trim() || b.value || '',
            type: b.type,
            selector: b.id ? '#' + b.id : (b.className ? '.' + b.className.split(' ')[0] : b.tagName.toLowerCase())
        }));

        const meta = {};
        document.querySelectorAll('meta').forEach(m => {
            const name = m.getAttribute('name') || m.getAttribute('property');
            if (name) meta[name] = m.getAttribute('content');
        });

        return { headings, links, forms, images, buttons, meta };
    });

    fs.writeFileSync(${JSON.stringify(structurePath)}, JSON.stringify(structure, null, 2));

    // Accessibility snapshot (optional - may not be available)
    let accessibilityTree = null;
    try {
        accessibilityTree = await page.accessibility.snapshot();
    } catch (e) {
        accessibilityTree = { error: 'Accessibility API not available', message: e.message };
    }
    fs.writeFileSync(${JSON.stringify(accessibilityPath)}, JSON.stringify(accessibilityTree, null, 2));

    // Performance metrics
    const performance = await page.evaluate(() => {
        const entries = performance.getEntriesByType('navigation')[0] || {};
        const paint = performance.getEntriesByType('paint');

        return {
            domContentLoaded: Math.round(entries.domContentLoadedEventEnd || 0),
            load: Math.round(entries.loadEventEnd || 0),
            ttfb: Math.round(entries.responseStart || 0),
            fcp: paint.find(p => p.name === 'first-contentful-paint')?.startTime || null,
            resources: performance.getEntriesByType('resource').length
        };
    });

    const meta = {
        id: ${JSON.stringify(id)},
        mode: 'full',
        url: ${JSON.stringify(url)},
        finalUrl,
        title,
        textContent: textContent.substring(0, 50000),
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        status: response.status(),
        performance,
        structureFile: 'structure.json',
        accessibilityFile: 'accessibility.json',
        domFile: 'dom.html'
    };

    fs.writeFileSync(${JSON.stringify(metaPath)}, JSON.stringify(meta, null, 2));

    await browser.close();
    console.log(JSON.stringify({ success: true, id: ${JSON.stringify(id)}, ...meta }));
})().catch(e => {
    console.error(JSON.stringify({ success: false, error: e.message }));
    process.exit(1);
});
`;
}

function buildJourneyScript(steps, outputDir, id, options = {}) {
    const metaPath = path.join(outputDir, 'manifest.json');
    const stepsDir = path.join(outputDir, 'steps');
    const sessionsDir = options.sessionsDir || path.join(path.dirname(outputDir), 'sessions');

    const stepsJson = JSON.stringify(steps);
    const sessionStatePath = options.session
        ? path.join(sessionsDir, options.session, 'state.json')
        : null;

    // Context options - load session if specified
    const contextOptionsCode = sessionStatePath
        ? `{ storageState: JSON.parse(fs.readFileSync(${JSON.stringify(sessionStatePath)}, 'utf-8')) }`
        : `{}`;

    return `
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext(${contextOptionsCode});
    const page = await context.newPage();

    const steps = ${stepsJson};
    const stepsDir = ${JSON.stringify(stepsDir)};
    fs.mkdirSync(stepsDir, { recursive: true });

    const results = [];
    const startTime = Date.now();

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepNum = String(i + 1).padStart(3, '0');
        const stepResult = { step: i + 1, action: step.action, timestamp: new Date().toISOString() };

        try {
            // Screenshot before action (except navigate)
            if (step.action !== 'navigate' && i > 0) {
                await page.screenshot({ path: path.join(stepsDir, stepNum + '-before.png') });
                stepResult.screenshotBefore = stepNum + '-before.png';
            }

            // Execute action
            switch (step.action) {
                case 'navigate':
                    await page.goto(step.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    stepResult.url = step.url;
                    break;
                case 'click':
                    await page.click(step.selector, { timeout: 10000 });
                    stepResult.selector = step.selector;
                    break;
                case 'fill':
                    await page.fill(step.selector, step.value || '');
                    stepResult.selector = step.selector;
                    stepResult.value = step.value ? '[FILLED]' : '';
                    break;
                case 'wait':
                    await page.waitForTimeout(step.ms || 1000);
                    stepResult.ms = step.ms || 1000;
                    break;
                case 'waitForSelector':
                    await page.waitForSelector(step.selector, { timeout: 10000 });
                    stepResult.selector = step.selector;
                    break;
                case 'saveSession':
                    const sessionDir = path.join(${JSON.stringify(sessionsDir)}, step.name);
                    fs.mkdirSync(sessionDir, { recursive: true });
                    const sessionState = await context.storageState();
                    fs.writeFileSync(path.join(sessionDir, 'state.json'), JSON.stringify(sessionState, null, 2));
                    fs.writeFileSync(path.join(sessionDir, 'meta.json'), JSON.stringify({
                        name: step.name,
                        targetUrl: page.url(),
                        created: new Date().toISOString(),
                        lastUsed: new Date().toISOString()
                    }, null, 2));
                    stepResult.sessionSaved = step.name;
                    break;
                case 'loadSession':
                    // loadSession is handled at context creation, this is a no-op
                    stepResult.note = 'Session loading handled at context creation';
                    break;
            }

            // Screenshot after action
            await page.screenshot({ path: path.join(stepsDir, stepNum + '-after.png') });
            stepResult.screenshotAfter = stepNum + '-after.png';

            // Capture state
            stepResult.state = {
                url: page.url(),
                title: await page.title()
            };

            stepResult.success = true;
        } catch (e) {
            stepResult.success = false;
            stepResult.error = e.message;
            // Try to capture error state
            try {
                await page.screenshot({ path: path.join(stepsDir, stepNum + '-error.png') });
                stepResult.screenshotError = stepNum + '-error.png';
            } catch {}
        }

        // Save step result
        fs.writeFileSync(
            path.join(stepsDir, stepNum + '-result.json'),
            JSON.stringify(stepResult, null, 2)
        );

        results.push(stepResult);
    }

    // Final state capture
    const finalState = {
        url: page.url(),
        title: await page.title(),
        textContent: await page.evaluate(() => document.body.innerText.substring(0, 10000))
    };

    const manifest = {
        id: ${JSON.stringify(id)},
        mode: 'journey',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        stepsTotal: steps.length,
        stepsSucceeded: results.filter(r => r.success).length,
        stepsFailed: results.filter(r => !r.success).length,
        steps: results,
        finalState
    };

    fs.writeFileSync(${JSON.stringify(metaPath)}, JSON.stringify(manifest, null, 2));

    await browser.close();
    console.log(JSON.stringify({ success: true, ...manifest }));
})().catch(e => {
    console.error(JSON.stringify({ success: false, error: e.message }));
    process.exit(1);
});
`;
}

function buildExtractScript(url, outputDir, id, extractTypes, options = {}) {
    const metaPath = path.join(outputDir, 'meta.json');
    const sessionStatePath = options.session
        ? path.join(options.sessionsDir, options.session, 'state.json')
        : null;
    const contextOptionsCode = sessionStatePath
        ? `{ storageState: JSON.parse(fs.readFileSync(${JSON.stringify(sessionStatePath)}, 'utf-8')) }`
        : `{}`;

    return `
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext(${contextOptionsCode});
    const page = await context.newPage();

    await page.goto(${JSON.stringify(url)}, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const result = { id: ${JSON.stringify(id)}, url: ${JSON.stringify(url)}, timestamp: new Date().toISOString() };

    // Interaction map - clickable, fillable, navigable elements
    const interactions = await page.evaluate(() => {
        const getSelector = (el) => {
            if (el.id) return '#' + el.id;
            if (el.className && typeof el.className === 'string') {
                const cls = el.className.trim().split(/\\s+/)[0];
                if (cls) return el.tagName.toLowerCase() + '.' + cls;
            }
            return el.tagName.toLowerCase();
        };

        const getBounds = (el) => {
            const rect = el.getBoundingClientRect();
            return { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) };
        };

        const clickable = Array.from(document.querySelectorAll('button, [role="button"], a, [onclick], input[type="submit"], input[type="button"]'))
            .filter(el => el.offsetParent !== null)
            .slice(0, 50)
            .map(el => ({
                selector: getSelector(el),
                text: (el.innerText || el.value || '').trim().substring(0, 100),
                bounds: getBounds(el),
                tag: el.tagName.toLowerCase(),
                role: el.getAttribute('role'),
                href: el.href || null
            }));

        const fillable = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select'))
            .filter(el => el.offsetParent !== null)
            .slice(0, 30)
            .map(el => ({
                selector: getSelector(el),
                type: el.type || el.tagName.toLowerCase(),
                name: el.name,
                placeholder: el.placeholder,
                label: el.labels?.[0]?.innerText?.trim() || null,
                bounds: getBounds(el),
                required: el.required
            }));

        return { clickable, fillable };
    });

    result.interactions = interactions;

    // Semantic analysis hints
    const semantic = await page.evaluate(() => {
        const hints = [];

        // Check for common patterns
        if (document.querySelector('form[action*="login"], input[type="password"]')) hints.push('login-form');
        if (document.querySelector('form[action*="search"], input[type="search"]')) hints.push('search');
        if (document.querySelector('[class*="cart"], [class*="basket"]')) hints.push('ecommerce');
        if (document.querySelector('article, [class*="post"], [class*="blog"]')) hints.push('content');
        if (document.querySelector('[class*="price"], [class*="product"]')) hints.push('product');
        if (document.querySelector('nav, [role="navigation"]')) hints.push('navigation');

        return {
            hints,
            hasLogin: !!document.querySelector('input[type="password"]'),
            hasSearch: !!document.querySelector('input[type="search"], [role="search"]'),
            hasForms: document.querySelectorAll('form').length,
            hasNav: !!document.querySelector('nav, [role="navigation"]')
        };
    });

    result.semantic = semantic;

    fs.writeFileSync(${JSON.stringify(metaPath)}, JSON.stringify(result, null, 2));

    await browser.close();
    console.log(JSON.stringify({ success: true, ...result }));
})().catch(e => {
    console.error(JSON.stringify({ success: false, error: e.message }));
    process.exit(1);
});
`;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/capture
 * Main capture endpoint
 */
router.post('/', async (req, res) => {
    try {
        const { url, org = 'tetra', mode = 'quick', steps, extract, session } = req.body;

        if (!url && mode !== 'journey') {
            return res.status(400).json({ error: 'url required' });
        }

        if (mode === 'journey' && (!steps || !Array.isArray(steps))) {
            return res.status(400).json({ error: 'steps array required for journey mode' });
        }

        // Validate session exists if specified
        if (session) {
            const sessionPath = path.join(getSessionDir(org, session), 'state.json');
            if (!fs.existsSync(sessionPath)) {
                return res.status(400).json({ error: `Session "${session}" not found` });
            }
        }

        const id = generateId();
        const captureDir = getCaptureDir(org);
        const outputDir = path.join(captureDir, mode, id);
        ensureDir(outputDir);

        // Session options for script builders
        const sessionOptions = {
            session,
            sessionsDir: getSessionsDir(org)
        };

        let script;
        let timeout = 60000;

        switch (mode) {
            case 'quick':
                script = buildQuickScript(url, outputDir, id, sessionOptions);
                break;
            case 'full':
                script = buildFullScript(url, outputDir, id, sessionOptions);
                timeout = 90000;
                break;
            case 'journey':
                script = buildJourneyScript(steps, outputDir, id, sessionOptions);
                timeout = steps.length * 30000 + 30000; // 30s per step + buffer
                break;
            case 'extract':
                script = buildExtractScript(url, outputDir, id, extract || ['interactions', 'semantic'], sessionOptions);
                break;
            default:
                return res.status(400).json({ error: `Unknown mode: ${mode}` });
        }

        const result = await runPlaywrightScript(script, outputDir, timeout);
        result.outputDir = outputDir;
        result.session = session || null;
        res.json(result);

    } catch (error) {
        console.error('[API/capture] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/capture/list
 * List captures for an org
 */
router.get('/list', (req, res) => {
    try {
        const { org = 'tetra', mode } = req.query;
        const captureDir = getCaptureDir(org);

        if (!fs.existsSync(captureDir)) {
            return res.json([]);
        }

        const modes = mode ? [mode] : ['quick', 'full', 'journey', 'extract'];
        const captures = [];

        for (const m of modes) {
            const modeDir = path.join(captureDir, m);
            if (!fs.existsSync(modeDir)) continue;

            const ids = fs.readdirSync(modeDir).filter(f => {
                return fs.statSync(path.join(modeDir, f)).isDirectory();
            });

            for (const id of ids) {
                const metaPath = path.join(modeDir, id, m === 'journey' ? 'manifest.json' : 'meta.json');
                if (fs.existsSync(metaPath)) {
                    try {
                        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                        captures.push({
                            id,
                            mode: m,
                            url: meta.url || meta.finalUrl,
                            timestamp: meta.timestamp,
                            title: meta.title,
                            success: meta.success !== false
                        });
                    } catch {}
                }
            }
        }

        // Sort by timestamp descending
        captures.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.json(captures);

    } catch (error) {
        console.error('[API/capture] List error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Session Management Endpoints (MUST come before wildcard /:org/:mode/:id routes)
// ============================================================================

/**
 * GET /api/capture/sessions
 * List all saved sessions for an org
 */
router.get('/sessions', (req, res) => {
    try {
        const { org = 'tetra' } = req.query;
        const sessionsDir = getSessionsDir(org);

        if (!fs.existsSync(sessionsDir)) {
            return res.json([]);
        }

        const sessions = fs.readdirSync(sessionsDir)
            .filter(name => {
                const metaPath = path.join(sessionsDir, name, 'meta.json');
                return fs.existsSync(metaPath);
            })
            .map(name => {
                const metaPath = path.join(sessionsDir, name, 'meta.json');
                try {
                    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                    return {
                        name,
                        ...meta
                    };
                } catch {
                    return { name, error: 'Failed to read metadata' };
                }
            });

        // Sort by lastUsed/created descending
        sessions.sort((a, b) => {
            const aTime = a.lastUsed || a.created || '';
            const bTime = b.lastUsed || b.created || '';
            return bTime.localeCompare(aTime);
        });

        res.json(sessions);

    } catch (error) {
        console.error('[API/capture] Sessions list error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/capture/sessions/:org/:name
 * Get session metadata
 */
router.get('/sessions/:org/:name', (req, res) => {
    try {
        const { org, name } = req.params;
        const sessionDir = getSessionDir(org, name);
        const metaPath = path.join(sessionDir, 'meta.json');

        if (!fs.existsSync(metaPath)) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        res.json({ name, ...meta });

    } catch (error) {
        console.error('[API/capture] Session get error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/capture/sessions/:org/:name
 * Delete a saved session
 */
router.delete('/sessions/:org/:name', (req, res) => {
    try {
        const { org, name } = req.params;
        const sessionDir = getSessionDir(org, name);

        if (!fs.existsSync(sessionDir)) {
            return res.status(404).json({ error: 'Session not found' });
        }

        fs.rmSync(sessionDir, { recursive: true, force: true });
        res.json({ deleted: true, name, org });

    } catch (error) {
        console.error('[API/capture] Session delete error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/capture/sessions/:org/:name/touch
 * Update lastUsed timestamp for a session
 */
router.post('/sessions/:org/:name/touch', (req, res) => {
    try {
        const { org, name } = req.params;
        const sessionDir = getSessionDir(org, name);
        const metaPath = path.join(sessionDir, 'meta.json');

        if (!fs.existsSync(metaPath)) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        meta.lastUsed = new Date().toISOString();
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

        res.json({ touched: true, name, lastUsed: meta.lastUsed });

    } catch (error) {
        console.error('[API/capture] Session touch error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Capture Detail Routes (wildcard routes - must come after /sessions/* routes)
// ============================================================================

/**
 * GET /api/capture/:org/:mode/:id
 * Get capture metadata
 */
router.get('/:org/:mode/:id', (req, res) => {
    const { org, mode, id } = req.params;
    const metaFile = mode === 'journey' ? 'manifest.json' : 'meta.json';
    const metaPath = path.join(getCaptureDir(org), mode, id, metaFile);

    if (!fs.existsSync(metaPath)) {
        return res.status(404).json({ error: 'Capture not found' });
    }

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    res.json(meta);
});

/**
 * GET /api/capture/:org/:mode/:id/screenshot
 * Get screenshot image
 */
router.get('/:org/:mode/:id/screenshot', (req, res) => {
    const { org, mode, id } = req.params;
    const { step } = req.query;

    let screenshotPath;
    if (mode === 'journey') {
        const stepsDir = path.join(getCaptureDir(org), mode, id, 'steps');
        if (step) {
            const stepNum = String(step).padStart(3, '0');
            screenshotPath = path.join(stepsDir, `${stepNum}-after.png`);
        } else {
            // Find the last step screenshot
            if (fs.existsSync(stepsDir)) {
                const files = fs.readdirSync(stepsDir).filter(f => f.endsWith('-after.png')).sort();
                if (files.length > 0) {
                    screenshotPath = path.join(stepsDir, files[files.length - 1]);
                }
            }
        }
    } else {
        screenshotPath = path.join(getCaptureDir(org), mode, id, 'screenshot.png');
    }

    if (!screenshotPath || !fs.existsSync(screenshotPath)) {
        return res.status(404).json({ error: 'Screenshot not found' });
    }

    res.sendFile(screenshotPath);
});

/**
 * GET /api/capture/:org/:mode/:id/file/:filename
 * Get any file from capture directory
 */
router.get('/:org/:mode/:id/file/:filename', (req, res) => {
    const { org, mode, id, filename } = req.params;

    // Security: prevent path traversal
    if (filename.includes('..') || filename.includes('/')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(getCaptureDir(org), mode, id, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(filePath);
});

/**
 * DELETE /api/capture/:org/:mode/:id
 * Delete a capture
 */
router.delete('/:org/:mode/:id', (req, res) => {
    try {
        const { org, mode, id } = req.params;
        const captureDir = path.join(getCaptureDir(org), mode, id);

        if (!fs.existsSync(captureDir)) {
            return res.status(404).json({ error: 'Capture not found' });
        }

        // Recursively delete directory
        fs.rmSync(captureDir, { recursive: true, force: true });
        res.json({ deleted: true, id, mode });

    } catch (error) {
        console.error('[API/capture] Delete error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
