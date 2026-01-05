/**
 * Capture API - Playwright Script Builders
 */
const path = require('path');

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

module.exports = {
    buildQuickScript,
    buildFullScript,
    buildJourneyScript,
    buildExtractScript
};
