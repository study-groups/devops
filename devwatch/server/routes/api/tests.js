const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { warn, error } = require('../../utils/logging');
const { getEnvironmentData } = require('../../utils/filesystem');

const router = express.Router();

// Alias route for /tests
router.get('/', async (req, res) => {
    try {
        const PW_SRC = req.app.locals.PW_SRC;
        if (!PW_SRC) {
            return res.status(500).json({ error: 'PW_SRC is not defined. Check server configuration.' });
        }
        // Unified policy: we do not use test-suites.json. All tests come from PW_SRC/tests.
        const testSuites = [];

        // Scan test files non-recursively; include only .spec.js for now
        const testsDir = path.join(PW_SRC, 'tests');
        let files = [];
        try {
            files = await fs.readdir(testsDir);
        } catch (_) { files = []; }

        const testFiles = files.filter(name => name.endsWith('.spec.js'));
        const actualTests = [];
        for (const name of testFiles) {
            try {
                const filePath = path.join(testsDir, name);
                const content = await fs.readFile(filePath, 'utf8');
                actualTests.push({
                    id: name,
                    name,
                    path: filePath,
                    lineCount: content.split('\n').length
                });
            } catch (_) { /* ignore */ }
        }
        
        res.json({
            testSuites: testSuites,
            availableTests: actualTests
        });
    } catch (error) {
        error(`[API] Failed to get tests from filesystem: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Alias route for /environment
router.get('/environment', (req, res) => {
    const PW_DIR = req.app.locals.PW_DIR;
    const PW_SRC = req.app.locals.PW_SRC;
    
    const environmentData = getEnvironmentData();
    
    res.json({
        ...environmentData,
        PW_DIR,
        PW_SRC,
        PROCESS_PWD: process.cwd(),
        SERVER_INFO: `Node.js ${process.version} on ${require('os').platform()}`,
        USER_INFO: process.env.USER || process.env.USERNAME || 'Unknown',
        IP_INFO: require('os').networkInterfaces()?.eth0?.[0]?.address || 'localhost'
    });
});

// API endpoint to get test source code
router.get('/:filename/source', async (req, res) => {
    try {
        const { filename } = req.params;
        const PW_SRC = req.app.locals.PW_SRC;
        const filePath = path.join(PW_SRC, 'tests', filename);
        
        // Security check - ensure file is in tests directory
        if (!filePath.startsWith(path.join(PW_SRC, 'tests'))) {
            return res.status(400).json({ error: 'Invalid file path' });
        }
        
        const content = await fs.readFile(filePath, 'utf8');
        res.json({
            filename: filename,
            content: content,
            lines: content.split('\n').length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API endpoint to get the playwright config file and its parsed details
router.get('/config', async (req, res) => {
    try {
        const { PW_SRC, PW_DIR } = req.app.locals;
        const { env, url } = req.query;

        if (!PW_SRC) {
            return res.status(500).json({ error: 'PW_SRC is not defined. Check server configuration.' });
        }
        const configPath = path.join(PW_SRC, 'playwright.config.js');

        const envUrls = {
            dev: 'https://dev.pixeljamarcade.com',
            staging: 'https://staging.pixeljamarcade.com',
            prod: 'https://pixeljamarcade.com',
            local: 'http://localhost:3000'
        };

        // Temporarily set environment selection for config evaluation
        // Prefer named environment via PLAYWRIGHT_TARGET_ENV; only set URL when an explicit custom URL is provided
        if (env && envUrls[env]) {
            process.env.PLAYWRIGHT_TARGET_ENV = env.toLowerCase();
            delete process.env.PLAYWRIGHT_TARGET_URL;
        } else if (url) {
            process.env.PLAYWRIGHT_TARGET_URL = url;
            delete process.env.PLAYWRIGHT_TARGET_ENV;
        } else {
            // No override: config will expose full matrix (dev/staging/prod)
            delete process.env.PLAYWRIGHT_TARGET_ENV;
            delete process.env.PLAYWRIGHT_TARGET_URL;
        }

        // Read raw content for display
        const content = await fs.readFile(configPath, 'utf8');
        
        // Ensure we get a fresh version if the file has changed by clearing the cache
        delete require.cache[require.resolve(configPath)];
        const config = require(configPath);

        const projectNames = config.projects ? config.projects.map(p => p.name) : [];

        console.log('Config Projects:', JSON.stringify(config.projects, null, 2));
        console.log('Project Names:', projectNames);

        // Clean up the env vars after extracting project names
        delete process.env.PLAYWRIGHT_TARGET_ENV;
        delete process.env.PLAYWRIGHT_TARGET_URL;

        // Resolve output paths based on the config and environment
        const outputDir = path.join(PW_DIR, 'test-results');
        const reportsFolder = (config.reporter?.find(r => Array.isArray(r) && r[0] === 'html')?.[1]?.outputFolder)
            || path.join(PW_DIR, 'reports');

        // Return full configuration
        res.json({
            filename: 'playwright.config.js',
            content: content,
            lines: content.split('\n').length,
            projects: projectNames,
            paths: {
                outputDir,
                reportsFolder,
                config: configPath,
                tests: path.join(PW_SRC, 'tests'),
                snapshots: 'Stored in __snapshots__/ subdirectories next to each test file.'
            },
            // Include full config object for more comprehensive information
            fullConfig: config,
            // Include available tests for compatibility
            testSuites: [],
            availableTests: [
                {
                    id: 'game-flow.spec.js',
                    name: 'game-flow.spec.js',
                    path: path.join(PW_SRC, 'tests', 'game-flow.spec.js'),
                    lineCount: 167
                },
                {
                    id: 'games.spec.js',
                    name: 'games.spec.js',
                    path: path.join(PW_SRC, 'tests', 'games.spec.js'),
                    lineCount: 89
                },
                {
                    id: 'lpc.spec.js',
                    name: 'lpc.spec.js',
                    path: path.join(PW_SRC, 'tests', 'lpc.spec.js'),
                    lineCount: 24
                },
                {
                    id: 'metrics.spec.js',
                    name: 'metrics.spec.js',
                    path: path.join(PW_SRC, 'tests', 'metrics.spec.js'),
                    lineCount: 149
                },
                {
                    id: 'profiling.spec.js',
                    name: 'profiling.spec.js',
                    path: path.join(PW_SRC, 'tests', 'profiling.spec.js'),
                    lineCount: 72
                }
            ]
        });
    } catch (error) {
        error('Error in /api/config', { error: error.message, stack: error.stack });
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

module.exports = router;
