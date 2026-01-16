/**
 * Capture API - Unified Script Builder
 *
 * One function that builds a Playwright script based on:
 *   - url: Starting URL
 *   - steps: Actions to perform
 *   - captureList: What to capture at the end
 *   - Per-step captures via step.capture array
 */
const path = require('path');

/**
 * Build a unified capture script
 */
function buildCaptureScript(options) {
    const {
        url,
        steps = [],
        captureList = ['screenshot'],
        outputDir,
        id,
        session,
        sessionsDir,
        viewport,
        sessionData  // Full session object with auth info
    } = options;

    const manifestPath = path.join(outputDir, 'manifest.json');

    // Only use state.json if session has browser state
    const sessionStatePath = (session && sessionData?.hasState)
        ? path.join(sessionsDir, session, 'state.json')
        : null;

    // Build context options with optional viewport, session, and auth headers
    const contextOptions = {};

    if (sessionStatePath) {
        contextOptions.storageState = `__STORAGE_STATE__`;
    }

    if (viewport) {
        contextOptions.viewport = viewport;
    }

    // Add JWT auth header if configured
    if (sessionData?.auth?.jwt) {
        const header = sessionData.auth.jwtHeader || 'Authorization';
        const prefix = sessionData.auth.jwtPrefix || 'Bearer ';
        contextOptions.extraHTTPHeaders = {
            [header]: prefix + sessionData.auth.jwt
        };
    }

    // Build the context options code
    let contextOptionsCode;
    if (Object.keys(contextOptions).length === 0) {
        contextOptionsCode = '{}';
    } else {
        // Convert to string, but handle the storageState placeholder specially
        let optionsStr = JSON.stringify(contextOptions, null, 2);
        if (sessionStatePath) {
            optionsStr = optionsStr.replace(
                '"__STORAGE_STATE__"',
                `JSON.parse(fs.readFileSync(${JSON.stringify(sessionStatePath)}, 'utf-8'))`
            );
        }
        contextOptionsCode = optionsStr;
    }

    return `
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Capture functions - each returns data to include in manifest
const captureFns = {
    async screenshot(page, outputDir, prefix = '') {
        const filename = prefix ? prefix + '-screenshot.png' : 'screenshot.png';
        await page.screenshot({ path: path.join(outputDir, filename), fullPage: false });
        return { screenshotFile: filename };
    },

    async dom(page, outputDir, prefix = '') {
        const filename = prefix ? prefix + '-dom.html' : 'dom.html';
        const html = await page.content();
        fs.writeFileSync(path.join(outputDir, filename), html);
        return { domFile: filename, domSize: html.length };
    },

    async text(page) {
        const text = await page.evaluate(() => document.body.innerText);
        return { textContent: text.substring(0, 50000) };
    },

    async structure(page, outputDir, prefix = '') {
        const filename = prefix ? prefix + '-structure.json' : 'structure.json';
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
        fs.writeFileSync(path.join(outputDir, filename), JSON.stringify(structure, null, 2));
        return { structureFile: filename, ...structure };
    },

    async accessibility(page, outputDir, prefix = '') {
        const filename = prefix ? prefix + '-accessibility.json' : 'accessibility.json';
        let tree = null;
        try {
            tree = await page.accessibility.snapshot();
        } catch (e) {
            tree = { error: 'Accessibility API not available', message: e.message };
        }
        fs.writeFileSync(path.join(outputDir, filename), JSON.stringify(tree, null, 2));
        return { accessibilityFile: filename };
    },

    async performance(page) {
        const perf = await page.evaluate(() => {
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
        return { performance: perf };
    },

    async interactions(page, outputDir, prefix = '') {
        const filename = prefix ? prefix + '-interactions.json' : 'interactions.json';
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
        fs.writeFileSync(path.join(outputDir, filename), JSON.stringify(interactions, null, 2));
        return { interactionsFile: filename, clickableCount: interactions.clickable.length, fillableCount: interactions.fillable.length };
    },

    async semantic(page) {
        const semantic = await page.evaluate(() => {
            const hints = [];
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
                formCount: document.querySelectorAll('form').length,
                hasNav: !!document.querySelector('nav, [role="navigation"]')
            };
        });
        return { semantic };
    }
};

// Run captures and merge results
async function runCaptures(page, outputDir, captureList, prefix = '') {
    const results = {};
    for (const type of captureList) {
        if (captureFns[type]) {
            try {
                const data = await captureFns[type](page, outputDir, prefix);
                Object.assign(results, data);
            } catch (e) {
                results[type + 'Error'] = e.message;
            }
        }
    }
    return results;
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext(${contextOptionsCode});
    const page = await context.newPage();

    const outputDir = ${JSON.stringify(outputDir)};
    const steps = ${JSON.stringify(steps)};
    const captureList = ${JSON.stringify(captureList)};
    const startTime = Date.now();

    const stepResults = [];

    // Navigate to URL if provided (and no goto step)
    ${url ? `
    const hasGotoStep = steps.some(s => s.action === 'goto');
    if (!hasGotoStep) {
        await page.goto(${JSON.stringify(url)}, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    ` : ''}

    // Execute steps - using Playwright action names
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepNum = String(i + 1).padStart(3, '0');
        const stepResult = { step: i + 1, action: step.action, timestamp: new Date().toISOString() };

        try {
            switch (step.action) {
                case 'goto':
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
                    break;
                case 'type':
                    await page.type(step.selector, step.value || '', { delay: step.delay || 50 });
                    stepResult.selector = step.selector;
                    break;
                case 'press':
                    await page.press(step.selector || 'body', step.key);
                    stepResult.key = step.key;
                    break;
                case 'check':
                    await page.check(step.selector);
                    stepResult.selector = step.selector;
                    break;
                case 'uncheck':
                    await page.uncheck(step.selector);
                    stepResult.selector = step.selector;
                    break;
                case 'selectOption':
                    await page.selectOption(step.selector, step.value);
                    stepResult.selector = step.selector;
                    stepResult.value = step.value;
                    break;
                case 'hover':
                    await page.hover(step.selector);
                    stepResult.selector = step.selector;
                    break;
                case 'wait':
                case 'waitForTimeout':
                    const ms = step.value || step.ms || 1000;
                    await page.waitForTimeout(ms);
                    stepResult.ms = ms;
                    break;
                case 'waitForSelector':
                    await page.waitForSelector(step.selector, { timeout: step.timeout || 10000 });
                    stepResult.selector = step.selector;
                    break;
                case 'waitForLoadState':
                    await page.waitForLoadState(step.state || 'load');
                    stepResult.state = step.state || 'load';
                    break;
                case 'evaluate':
                    const evalResult = await page.evaluate(step.script);
                    stepResult.result = evalResult;
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
                case 'setViewport':
                    await page.setViewportSize({ width: step.width, height: step.height });
                    stepResult.viewport = { width: step.width, height: step.height };
                    break;
            }

            // Per-step captures
            if (step.capture && Array.isArray(step.capture)) {
                const stepCaptures = await runCaptures(page, outputDir, step.capture, stepNum);
                Object.assign(stepResult, stepCaptures);
            }

            stepResult.success = true;
            stepResult.state = { url: page.url(), title: await page.title() };

        } catch (e) {
            stepResult.success = false;
            stepResult.error = e.message;
        }

        stepResults.push(stepResult);
    }

    // Final captures
    const finalCaptures = await runCaptures(page, outputDir, captureList);

    // Build manifest
    const manifest = {
        success: true,
        id: ${JSON.stringify(id)},
        url: ${JSON.stringify(url)} || (steps.find(s => s.action === 'goto')?.url),
        finalUrl: page.url(),
        title: await page.title(),
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        capture: captureList,
        viewport: ${viewport ? JSON.stringify(viewport) : 'null'},
        steps: stepResults.length > 0 ? stepResults : undefined,
        ...finalCaptures
    };

    fs.writeFileSync(${JSON.stringify(manifestPath)}, JSON.stringify(manifest, null, 2));

    await browser.close();
    console.log(JSON.stringify(manifest));
})().catch(e => {
    console.error(JSON.stringify({ success: false, error: e.message }));
    process.exit(1);
});
`;
}

module.exports = { buildCaptureScript };
