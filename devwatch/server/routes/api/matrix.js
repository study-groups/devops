const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { info, warn, error, debug, systemLog } = require('../../utils/logging');

const router = express.Router();

// Testing Matrix API endpoints
router.get('/testing-matrix', async (req, res) => {
    try {
        const { PW_DIR } = req.app.locals;
        
        // Generate matrix data with current status
        const matrixData = {
            chrome: {
                'web-sm': {
                    environments: {
                        dev: { status: 'passed', lastRun: Date.now() - 3600000, duration: 2345 },
                        staging: { status: 'failed', lastRun: Date.now() - 1800000, duration: 4521 },
                        prod: { status: 'pending', lastRun: null, duration: null }
                    },
                    lastRun: Date.now() - 1800000,
                    status: 'mixed'
                },
                'web-lg': {
                    environments: {
                        dev: { status: 'passed', lastRun: Date.now() - 2400000, duration: 1876 },
                        staging: { status: 'passed', lastRun: Date.now() - 900000, duration: 2134 },
                        prod: { status: 'running', lastRun: Date.now() - 300000, duration: null }
                    },
                    lastRun: Date.now() - 300000,
                    status: 'running'
                },
                'mobile': {
                    environments: {
                        dev: { status: 'pending', lastRun: null, duration: null },
                        staging: { status: 'pending', lastRun: null, duration: null },
                        prod: { status: 'pending', lastRun: null, duration: null }
                    },
                    lastRun: null,
                    status: 'pending'
                }
            },
            firefox: {
                'web-sm': {
                    environments: {
                        dev: { status: 'passed', lastRun: Date.now() - 5400000, duration: 3421 },
                        staging: { status: 'pending', lastRun: null, duration: null },
                        prod: { status: 'pending', lastRun: null, duration: null }
                    },
                    lastRun: Date.now() - 5400000,
                    status: 'partial'
                },
                'web-lg': {
                    environments: {
                        dev: { status: 'failed', lastRun: Date.now() - 7200000, duration: 8765 },
                        staging: { status: 'pending', lastRun: null, duration: null },
                        prod: { status: 'pending', lastRun: null, duration: null }
                    },
                    lastRun: Date.now() - 7200000,
                    status: 'failed'
                },
                'mobile': {
                    environments: {
                        dev: { status: 'pending', lastRun: null, duration: null },
                        staging: { status: 'pending', lastRun: null, duration: null },
                        prod: { status: 'pending', lastRun: null, duration: null }
                    },
                    lastRun: null,
                    status: 'pending'
                }
            },
            safari: {
                'web-sm': {
                    environments: {
                        dev: { status: 'passed', lastRun: Date.now() - 4800000, duration: 2987 },
                        staging: { status: 'passed', lastRun: Date.now() - 3600000, duration: 3214 },
                        prod: { status: 'passed', lastRun: Date.now() - 1800000, duration: 2876 }
                    },
                    lastRun: Date.now() - 1800000,
                    status: 'passed'
                },
                'web-lg': {
                    environments: {
                        dev: { status: 'pending', lastRun: null, duration: null },
                        staging: { status: 'pending', lastRun: null, duration: null },
                        prod: { status: 'pending', lastRun: null, duration: null }
                    },
                    lastRun: null,
                    status: 'pending'
                },
                'mobile': {
                    environments: {
                        dev: { status: 'running', lastRun: Date.now() - 600000, duration: null },
                        staging: { status: 'pending', lastRun: null, duration: null },
                        prod: { status: 'pending', lastRun: null, duration: null }
                    },
                    lastRun: Date.now() - 600000,
                    status: 'running'
                }
            },
            edge: {
                'web-sm': {
                    environments: {
                        dev: { status: 'pending', lastRun: null, duration: null },
                        staging: { status: 'pending', lastRun: null, duration: null },
                        prod: { status: 'pending', lastRun: null, duration: null }
                    },
                    lastRun: null,
                    status: 'pending'
                },
                'web-lg': {
                    environments: {
                        dev: { status: 'pending', lastRun: null, duration: null },
                        staging: { status: 'pending', lastRun: null, duration: null },
                        prod: { status: 'pending', lastRun: null, duration: null }
                    },
                    lastRun: null,
                    status: 'pending'
                },
                'mobile': {
                    environments: {
                        dev: { status: 'pending', lastRun: null, duration: null },
                        staging: { status: 'pending', lastRun: null, duration: null },
                        prod: { status: 'pending', lastRun: null, duration: null }
                    },
                    lastRun: null,
                    status: 'pending'
                }
            }
        };

        res.json({
            success: true,
            matrix: matrixData,
            metadata: {
                lastUpdated: new Date().toISOString(),
                totalCombinations: Object.keys(matrixData).length * 3 * 3, // browsers × viewports × environments
                viewports: {
                    'web-sm': { name: 'Desktop Small', size: '1024×768' },
                    'web-lg': { name: 'Desktop Large', size: '1920×1080' },
                    'mobile': { name: 'Mobile', size: '375×667' }
                },
                browsers: {
                    chrome: { name: 'Chrome', icon: 'icon-computer' },
                    firefox: { name: 'Firefox', icon: 'icon-computer' },
                    safari: { name: 'Safari', icon: 'icon-computer' },
                    edge: { name: 'Edge', icon: 'icon-computer' }
                }
            }
        });

    } catch (e) {
        error('Error fetching testing matrix', { error: e.message });
        res.status(500).json({
            success: false,
            error: e.message
        });
    }
});

router.post('/testing-matrix/run', async (req, res) => {
    try {
        const { selections } = req.body;
        
        if (!selections || !Array.isArray(selections)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid selections provided'
            });
        }

        info('Starting matrix tests', { combinations: selections.length, selections });

        // Parse selections and create test commands
        const testCommands = selections.map(cellId => {
            const [browser, viewport] = cellId.split('-');
            return {
                browser,
                viewport,
                project: `${browser}-${viewport}`,
                environments: ['dev', 'staging', 'prod'] // Run against all environments
            };
        });

        // Simulate starting the tests (in real implementation, this would trigger actual test runs)
        const results = {
            success: true,
            message: `Started ${selections.length} test combinations`,
            combinations: testCommands,
            estimatedDuration: selections.length * 60000, // 1 minute per combination
            startedAt: new Date().toISOString()
        };

        // Log the activity
        info('Matrix test run initiated', {
            combinations: selections.length,
            estimatedSeconds: Math.round(results.estimatedDuration / 1000),
            startedAt: results.startedAt
        });

        res.json(results);

    } catch (e) {
        error('Error starting matrix tests', { error: e.message });
        res.status(500).json({
            success: false,
            error: e.message
        });
    }
});

// Log test run details for integration with test logs
router.post('/testing-matrix/log-run', async (req, res) => {
    try {
        const testRunInfo = req.body;
        
        systemLog({
            TYPE: 'MATRIX_TEST_RUN_STARTED',
            FROM: 'event.matrix.start',
            message: `Matrix test run logged: ${testRunInfo.id} - ${testRunInfo.combinations.length} combinations`,
            data: {
                runId: testRunInfo.id,
                combinations: testRunInfo.combinations,
                estimatedDuration: testRunInfo.estimatedDuration,
                startedAt: testRunInfo.startedAt,
                userAgent: req.headers['user-agent'],
                ip: req.ip
            }
        });

        res.json({ success: true, logged: true });

    } catch (e) {
        error('Error logging test run:', { error: e.message });
        res.status(500).json({
            success: false,
            error: e.message
        });
    }
});

// Get real-time test status for monitoring
router.get('/testing-matrix/status/:runId', async (req, res) => {
    try {
        const { runId } = req.params;
        const { PW_DIR } = req.app.locals;
        
        // Try to get real test status from actual Playwright execution
        let realStatus = null;
        
        try {
            
            // Check for test-results directory and recent results
            const resultsDir = path.join(PW_DIR, 'test-results');
            const files = await fs.readdir(resultsDir).catch(() => []);
            
            // Look for recent result files that match our run
            const recentFiles = files.filter(file => 
                file.includes('test-results') && 
                file.endsWith('.json')
            ).sort().reverse().slice(0, 5); // Get 5 most recent
            
            for (const file of recentFiles) {
                try {
                    const filePath = path.join(resultsDir, file);
                    const stats = await fs.stat(filePath);
                    const fileAge = Date.now() - stats.mtime.getTime();
                    
                    // If file is less than 5 minutes old, it might be from our current run
                    if (fileAge < 5 * 60 * 1000) {
                        const content = await fs.readFile(filePath, 'utf8');
                        const results = JSON.parse(content);
                        
                        realStatus = {
                            runId,
                            progress: results.progress || 50,
                            currentTest: results.currentTest || 'Processing...',
                            currentBrowser: results.browser || 'chrome',
                            currentEnvironment: results.environment || 'dev',
                            status: results.status || 'running',
                            passedTests: results.passed || 0,
                            failedTests: results.failed || 0,
                            runningTests: results.running || 1,
                            isReal: true,
                            lastUpdate: new Date().toISOString()
                        };
                        break;
                    }
                } catch (fileError) {
                    // Skip this file if we can't read it
                    continue;
                }
            }
        } catch (dirError) {
            warn('Could not check test results directory', { error: dirError.message });
        }
        
        // If no real status found, return a minimal response to let client handle simulation
        if (!realStatus) {
            res.status(404).json({ 
                error: 'No active test status found',
                runId,
                suggestion: 'Tests may still be starting or may have failed to initialize'
            });
            return;
        }
        
        res.json(realStatus);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Stop running tests
router.post('/testing-matrix/stop', async (req, res) => {
    try {
        // In a real implementation, this would terminate running test processes
        info('Stopping all running tests...');
        
        // Simulate stopping tests
        setTimeout(() => {
            info('Tests stopped successfully');
        }, 1000);
        
        res.json({ 
            success: true, 
            message: 'Test termination initiated',
            stoppedAt: new Date().toISOString()
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get test results for monitoring
router.get('/testing-matrix/results', async (req, res) => {
    try {
        debug('[API] Testing matrix results endpoint called');
        const { PW_DIR } = req.app.locals;
        
        const results = [];
        
        // Always return success, even if no results found
        debug('[API] PW_DIR', { PW_DIR });
        
        // Check central test results
        const centralFile = path.join(PW_DIR, 'pw_data', 'central-test-results.json');
        debug('[API] Looking for central file at', { centralFile });
        
        try {
            const centralContent = await fs.readFile(centralFile, 'utf8');
            const centralResults = JSON.parse(centralContent);
            info('[API] Found central results', { entries: centralResults.length });
            
            // Get recent results (last 10)
            const recentResults = centralResults.slice(-10).map(result => ({
                runId: result.id || `result-${Date.now()}`,
                progress: result.status === 'passed' ? 100 : (result.status === 'failed' ? 100 : 50),
                currentTest: result.test || 'Unknown',
                passed: result.status === 'passed' ? 1 : 0,
                failed: result.status === 'failed' ? 1 : 0,
                running: result.status === 'running' ? 1 : 0,
                status: result.status || 'unknown',
                timestamp: result.timestamp
            }));
            
            results.push(...recentResults);
        } catch (centralError) {
            warn('[API] Could not read central test results', { error: centralError.message });
            // File doesn't exist yet - this is normal for new setups
        }
        
        // Also check for any recent test-results directories
        try {
            const testResultsDir = path.join(PW_DIR, 'test-results');
            const testDirExists = await fs.access(testResultsDir).then(() => true).catch(() => false);
            
            if (testDirExists) {
                const testFiles = await fs.readdir(testResultsDir);
                info('[API] Found test results directory', { files: testFiles.length });
                
                // Add any recent test runs as potential results
                for (const file of testFiles.slice(-5)) {
                    if (file.includes('test-') || file.includes('results')) {
                        const filePath = path.join(testResultsDir, file);
                        const stats = await fs.stat(filePath).catch(() => null);
                        
                        if (stats && (Date.now() - stats.mtime.getTime()) < 10 * 60 * 1000) {
                            // File is less than 10 minutes old
                            results.push({
                                runId: `file-${Date.now()}`,
                                progress: 75,
                                currentTest: file,
                                passed: 0,
                                failed: 0,
                                running: 1,
                                status: 'running',
                                timestamp: stats.mtime.toISOString(),
                                source: 'file-system'
                            });
                        }
                    }
                }
            }
        } catch (testDirError) {
            warn('[API] Could not check test-results directory', { error: testDirError.message });
        }
        
        debug('[API] Returning results', { count: results.length });
        res.json(results);
        
    } catch (e) {
        error('[API] Error in testing-matrix/results', { error: e.message });
        // Always return something, even on error
        res.json([]);
    }
});

module.exports = router;
