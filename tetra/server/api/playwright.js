/**
 * Playwright API - Screenshot and DOM capture for Claude integration
 *
 * Captures screenshots and DOM content from URLs
 * Stores results in org-specific playwright directories
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');
const ORGS_DIR = path.join(TETRA_DIR, 'orgs');

/**
 * Get playwright directory for an org
 */
function getPlaywrightDir(org) {
    return path.join(ORGS_DIR, org, 'playwright');
}

/**
 * Generate timestamped filename
 */
function generateFilename() {
    const now = new Date();
    const date = now.toISOString().split('T')[0];

    // Find next sequence number for today
    const baseDir = path.join(ORGS_DIR, 'tetra', 'playwright', 'screenshots');
    let seq = 1;

    if (fs.existsSync(baseDir)) {
        const files = fs.readdirSync(baseDir);
        const todayFiles = files.filter(f => f.startsWith(date));
        seq = todayFiles.length + 1;
    }

    return `${date}-${String(seq).padStart(3, '0')}`;
}

/**
 * POST /api/playwright/capture
 * Capture screenshot and optionally DOM from a URL
 */
router.post('/capture', async (req, res) => {
    try {
        const { url, org = 'tetra', extractDom = true } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'url required' });
        }

        const playwrightDir = getPlaywrightDir(org);
        const filename = generateFilename();

        // Ensure directories exist
        const screenshotDir = path.join(playwrightDir, 'screenshots');
        const domDir = path.join(playwrightDir, 'dom');
        const combinedDir = path.join(playwrightDir, 'combined');

        fs.mkdirSync(screenshotDir, { recursive: true });
        fs.mkdirSync(domDir, { recursive: true });
        fs.mkdirSync(combinedDir, { recursive: true });

        const screenshotPath = path.join(screenshotDir, `${filename}.png`);
        const domPath = path.join(domDir, `${filename}.html`);
        const combinedPath = path.join(combinedDir, `${filename}.json`);

        // Build playwright script
        const script = `
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto('${url.replace(/'/g, "\\'")}', { waitUntil: 'networkidle' });

    // Take screenshot
    await page.screenshot({ path: '${screenshotPath}', fullPage: false });

    ${extractDom ? `
    // Extract DOM
    const html = await page.content();
    const text = await page.evaluate(() => document.body.innerText);
    require('fs').writeFileSync('${domPath}', html);

    // Write combined JSON
    const combined = {
        url: '${url.replace(/'/g, "\\'")}',
        timestamp: new Date().toISOString(),
        screenshotPath: '${screenshotPath}',
        domPath: '${domPath}',
        textContent: text.substring(0, 50000)  // Limit size
    };
    require('fs').writeFileSync('${combinedPath}', JSON.stringify(combined, null, 2));
    ` : ''}

    await browser.close();

    console.log(JSON.stringify({
        success: true,
        screenshotPath: '${screenshotPath}',
        domPath: '${extractDom ? domPath : null}',
        combinedPath: '${extractDom ? combinedPath : null}'
    }));
})();
`;

        // Write temporary script
        const scriptPath = path.join(playwrightDir, 'capture-temp.js');
        fs.writeFileSync(scriptPath, script);

        // Execute playwright script
        try {
            const serverDir = path.join(__dirname, '..');
            const output = execSync(`node "${scriptPath}"`, {
                timeout: 60000,
                encoding: 'utf-8',
                cwd: serverDir,
                env: { ...process.env, NODE_PATH: path.join(serverDir, 'node_modules') }
            });

            // Clean up temp script
            fs.unlinkSync(scriptPath);

            const result = JSON.parse(output.trim());
            res.json(result);
        } catch (execError) {
            // Clean up temp script
            if (fs.existsSync(scriptPath)) {
                fs.unlinkSync(scriptPath);
            }

            console.error('[API/playwright] Capture failed:', execError.message);
            res.status(500).json({
                error: 'Capture failed',
                details: execError.stderr || execError.message
            });
        }
    } catch (error) {
        console.error('[API/playwright] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/playwright/list?org=X
 * List captured screenshots/DOM for an org
 */
router.get('/list', (req, res) => {
    try {
        const { org = 'tetra' } = req.query;
        const playwrightDir = getPlaywrightDir(org);
        const combinedDir = path.join(playwrightDir, 'combined');

        if (!fs.existsSync(combinedDir)) {
            return res.json([]);
        }

        const files = fs.readdirSync(combinedDir)
            .filter(f => f.endsWith('.json'))
            .sort()
            .reverse();

        const captures = files.map(file => {
            try {
                const content = fs.readFileSync(path.join(combinedDir, file), 'utf-8');
                const data = JSON.parse(content);
                return {
                    id: file.replace('.json', ''),
                    url: data.url,
                    timestamp: data.timestamp,
                    screenshotPath: data.screenshotPath,
                    domPath: data.domPath
                };
            } catch (e) {
                return null;
            }
        }).filter(Boolean);

        res.json(captures);
    } catch (error) {
        console.error('[API/playwright] List error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/playwright/screenshot/:org/:id
 * Get a screenshot image
 */
router.get('/screenshot/:org/:id', (req, res) => {
    const { org, id } = req.params;
    const screenshotPath = path.join(getPlaywrightDir(org), 'screenshots', `${id}.png`);

    if (!fs.existsSync(screenshotPath)) {
        return res.status(404).json({ error: 'Screenshot not found' });
    }

    res.sendFile(screenshotPath);
});

/**
 * GET /api/playwright/dom/:org/:id
 * Get DOM content
 */
router.get('/dom/:org/:id', (req, res) => {
    const { org, id } = req.params;
    const domPath = path.join(getPlaywrightDir(org), 'dom', `${id}.html`);

    if (!fs.existsSync(domPath)) {
        return res.status(404).json({ error: 'DOM not found' });
    }

    const content = fs.readFileSync(domPath, 'utf-8');
    res.type('text/html').send(content);
});

/**
 * GET /api/playwright/combined/:org/:id
 * Get combined JSON (metadata + text content)
 */
router.get('/combined/:org/:id', (req, res) => {
    const { org, id } = req.params;
    const combinedPath = path.join(getPlaywrightDir(org), 'combined', `${id}.json`);

    if (!fs.existsSync(combinedPath)) {
        return res.status(404).json({ error: 'Capture not found' });
    }

    const content = fs.readFileSync(combinedPath, 'utf-8');
    res.type('application/json').send(content);
});

/**
 * DELETE /api/playwright/:org/:id
 * Delete a capture
 */
router.delete('/:org/:id', (req, res) => {
    try {
        const { org, id } = req.params;
        const playwrightDir = getPlaywrightDir(org);

        const files = [
            path.join(playwrightDir, 'screenshots', `${id}.png`),
            path.join(playwrightDir, 'dom', `${id}.html`),
            path.join(playwrightDir, 'combined', `${id}.json`)
        ];

        let deleted = 0;
        for (const file of files) {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
                deleted++;
            }
        }

        res.json({ deleted, id });
    } catch (error) {
        console.error('[API/playwright] Delete error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
