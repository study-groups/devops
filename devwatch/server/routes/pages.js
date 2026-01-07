/**
 * Pages Routes - Static Pages with Standalone/iframe Support
 * 
 * Serves individual static pages that can work standalone or in iframes
 */

const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const router = express.Router();
const { error } = require('../utils/logging');

// Command Runner (formerly Playwright Job Runner)
router.get('/command-runner', async (req, res) => {
    try {
        const commandRunnerHtmlPath = path.join(__dirname, '..', 'static', 'command-runner.iframe.html');
        let commandRunnerHtml = await fs.readFile(commandRunnerHtmlPath, 'utf8');
        
        // Add iframe detection and styling
        const isIframe = req.query.iframe === 'true';
        if (isIframe) {
            // Add iframe-specific styles
            commandRunnerHtml = commandRunnerHtml.replace(
                '<body>',
                '<body class="iframe-mode">'
            );
        }
        
        res.send(commandRunnerHtml);
    } catch (e) {
        error('Error serving Command Runner', { error: e.message, stack: e.stack });
        res.status(500).send(createErrorPage('Command Runner', e.message));
    }
});

// Legacy Playwright route - redirect to Command Runner
router.get('/playwright', async (req, res) => {
    res.redirect('/pages/command-runner' + (req.query.iframe ? '?iframe=true' : ''));
});

// System Control Panel
router.get('/system', async (req, res) => {
    try {
        const systemHtmlPath = path.join(__dirname, '..', 'static', 'system.iframe.html');
        let systemHtml = await fs.readFile(systemHtmlPath, 'utf8');
        
        // Add iframe detection and styling
        const isIframe = req.query.iframe === 'true';
        if (isIframe) {
            // Add iframe-specific styles
            systemHtml = systemHtml.replace(
                '<body>',
                '<body class="iframe-mode">'
            );
        }
        
        res.send(systemHtml);
    } catch (e) {
        error('Error serving System Control Panel', { error: e.message, stack: e.stack });
        res.status(500).send(createErrorPage('System Control Panel', e.message));
    }
});

// Playwright Command Builder (formerly Test Suite Viewer)
router.get('/pcb', async (req, res) => {
    try {
        const pcbHtmlPath = path.join(__dirname, '..', 'static', 'pcb.iframe.html');
        let pcbHtml = await fs.readFile(pcbHtmlPath, 'utf8');
        
        // Add iframe detection and styling
        const isIframe = req.query.iframe === 'true';
        if (isIframe) {
            // Add iframe-specific styles
            pcbHtml = pcbHtml.replace(
                '<body>',
                '<body class="iframe-mode">'
            );
        }
        
        res.send(pcbHtml);
    } catch (e) {
        error('Error serving Playwright Command Builder', { error: e.message, stack: e.stack });
        res.status(500).send(createErrorPage('Playwright Command Builder', e.message));
    }
});

// Legacy TSV route - redirect to PCB
router.get('/tsv', async (req, res) => {
    try {
        const pcbHtmlPath = path.join(__dirname, '..', 'static', 'pcb.iframe.html');
        let pcbHtml = await fs.readFile(pcbHtmlPath, 'utf8');

        // Add iframe detection and styling
        const isIframe = req.query.iframe === 'true';
        if (isIframe) {
            // Add iframe-specific styles
            pcbHtml = pcbHtml.replace(
                '<body>',
                '<body class="iframe-mode">'
            );
        }

        res.send(pcbHtml);
    } catch (e) {
        error('Error serving Test Suite Viewer', { error: e.message, stack: e.stack });
        res.status(500).send(createErrorPage('Test Suite Viewer', e.message));
    }
});

// Theme Demo Page
router.get('/theme-demo', async (req, res) => {
    try {
        const demoHtmlPath = path.join(__dirname, '..', 'static', 'theme-demo.html');
        let demoHtml = await fs.readFile(demoHtmlPath, 'utf8');

        // Add iframe detection and styling
        const isIframe = req.query.iframe === 'true';
        if (isIframe) {
            // Add iframe-specific styles
            demoHtml = demoHtml.replace(
                '<body>',
                '<body class="iframe-mode">'
            );
        }

        res.send(demoHtml);
    } catch (e) {
        error('Error serving Theme Demo', { error: e.message, stack: e.stack });
        res.status(500).send(createErrorPage('Theme Demo', e.message));
    }
});

// Filesystem Monitor
router.get('/filesystem', async (req, res) => {
    try {
        const fsHtmlPath = path.join(__dirname, '..', 'static', 'filesystem-monitor.html');
        let fsHtml = await fs.readFile(fsHtmlPath, 'utf8');
        
        const isIframe = req.query.iframe === 'true';
        if (isIframe) {
            fsHtml = fsHtml.replace('<body>', '<body class="iframe-mode">');
        }
        
        res.send(fsHtml);
    } catch (e) {
        error('Error serving Filesystem Monitor', { error: e.message, stack: e.stack });
        res.status(500).send(createErrorPage('Filesystem Monitor', e.message));
    }
});

// Reports viewer  
router.get('/reports', async (req, res) => {
    try {
        // For now, redirect to the main reports directory or show a simple page
        res.redirect('/playwright-report');
    } catch (e) {
        error('Error serving Reports', { error: e.message, stack: e.stack });
        res.status(500).send(createErrorPage('Reports', e.message));
    }
});

// Info page
router.get('/info', async (req, res) => {
    try {
        const infoHtmlPath = path.join(__dirname, '..', 'static', 'system-info.html');
        let infoHtml = await fs.readFile(infoHtmlPath, 'utf8');
        
        const isIframe = req.query.iframe === 'true';
        if (isIframe) {
            infoHtml = infoHtml.replace('<body>', '<body class="iframe-mode">');
        }
        
        res.send(infoHtml);
    } catch (e) {
        error('Error serving Info page', { error: e.message, stack: e.stack });
        res.status(500).send(createErrorPage('Info', e.message));
    }
});

// GET /pages/api-helper - Serve the API Helper page
router.get('/api-helper', async (req, res) => {
    try {
        const apiHelperHtmlPath = path.join(__dirname, '..', 'static', 'api-helper.iframe.html');
        let apiHelperHtml = await fs.readFile(apiHelperHtmlPath, 'utf8');
        
        const isIframe = req.query.iframe === 'true';
        if (isIframe) {
            apiHelperHtml = apiHelperHtml.replace('<body>', '<body class="iframe-mode">');
        }
        
        res.send(apiHelperHtml);
    } catch (e) {
        error('Error serving API Helper page', { error: e.message, stack: e.stack });
        res.status(500).send(createErrorPage('API Helper', e.message));
    }
});

// List all available pages
router.get('/', (req, res) => {
    const pages = [
        { path: '/pages/system', name: 'System Control Panel', description: 'System info, directory stats, and control panel' },
        { path: '/pages/api-helper', name: 'API Helper', description: 'Browse and test all available API endpoints' },
        { path: '/pages/command-runner', name: 'Command Runner', description: 'Run and manage commands with activity logging' },
        { path: '/pages/pcb', name: 'Playwright Command Builder', description: 'Build and execute Playwright test commands' },
        { path: '/pages/tsv', name: 'Test Suite Viewer', description: 'View and manage test suites (legacy)' },
        { path: '/pages/filesystem', name: 'Filesystem Monitor', description: 'Monitor filesystem and environment' },
        { path: '/pages/reports', name: 'Reports', description: 'View test reports and results' },
        { path: '/pages/info', name: 'Info', description: 'System information and documentation' }
    ];

    res.json({
        message: 'Available static pages',
        pages: pages,
        usage: {
            standalone: 'Access any page directly via its path',
            iframe: 'Add ?iframe=true for iframe-optimized display'
        }
    });
});

// Helper function to create error pages
function createErrorPage(pageName, errorMessage) {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Error - ${pageName}</title>
            <style>
                body {
                    font-family: 'Courier New', monospace;
                    background: #1a1a1a;
                    color: #e0e0e0;
                    margin: 0;
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                }
                .error-container {
                    background: #2a2a2a;
                    padding: 30px;
                    border-radius: 8px;
                    border: 1px solid #f44336;
                    max-width: 500px;
                    text-align: center;
                }
                h1 { color: #f44336; margin-top: 0; }
                .error-message { background: #333; padding: 15px; border-radius: 4px; margin: 20px 0; }
                a { color: #4CAF50; text-decoration: none; }
                a:hover { text-decoration: underline; }
            </style>
        </head>
        <body>
            <div class="error-container">
                <h1>❌ Error Loading ${pageName}</h1>
                <div class="error-message">${errorMessage}</div>
                <p><a href="/">← Back to Admin Dashboard</a></p>
                <p><a href="/api/health">Check Server Health</a></p>
            </div>
        </body>
        </html>
    `;
}

module.exports = router;