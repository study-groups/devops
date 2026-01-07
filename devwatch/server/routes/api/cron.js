const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs/promises');
const { exec } = require('child_process');
const JobStorageService = require('../../services/jobStorage');

function parsePlaywrightOutput(stdout) {
    const output = {
        lcp: null,
        ttfb: null,
        pageLoadTime: null,
        fcp: null,
        passed: 0,
        failed: 0,
        reportPath: null,
        status: 'error',
        fullMetrics: null
    };

    // Parse LCP from our updated metrics.spec.js output
    const lcpMatch = stdout.match(/LCP\(ms\): ([\d.-]+(?:e[+-]?\d+)?)/);
    if (lcpMatch) output.lcp = parseFloat(lcpMatch[1]);

    const ttfbMatch = stdout.match(/TTFB\(ms\): ([\d.-]+(?:e[+-]?\d+)?)/);
    if (ttfbMatch) output.ttfb = parseFloat(ttfbMatch[1]);

    const fcpMatch = stdout.match(/FCP\(ms\): ([\d.-]+(?:e[+-]?\d+)?)/);
    if (fcpMatch) output.fcp = parseFloat(fcpMatch[1]);

    const pageLoadMatch = stdout.match(/Load\(ms\): ([\d.-]+(?:e[+-]?\d+)?)/);
    if (pageLoadMatch) output.pageLoadTime = parseFloat(pageLoadMatch[1]);

    const passedMatch = stdout.match(/(\d+) passed/);
    if (passedMatch) output.passed = parseInt(passedMatch[1], 10);

    const failedMatch = stdout.match(/(\d+) failed/);
    if (failedMatch) output.failed = parseInt(failedMatch[1], 10);
    
    const reportMatch = stdout.match(/npx playwright show-report ([^\s\x1B]+)/);
    if (reportMatch) {
        let rawPath = reportMatch[1].trim();
        
        // Clean up the path - remove ANSI escape sequences
        rawPath = rawPath.replace(/\x1B\[[0-9;]*m/g, '');
        
        // For Playwright reports, we typically just want to link to the main index.html
        // Since reports are generated in PW_DIR/reports/, we'll use a simple approach
        if (rawPath) {
            // If there's any report path mentioned, assume there's a report available
            // Use timestamp-based identifier for uniqueness
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            output.reportPath = `index.html?t=${timestamp}`;
        }
    }

    // Try to load full metrics from run-specific metrics file if available
    try {
        const pwDir = process.env.PW_DIR;
        if (pwDir) {
            // Look for run-specific metrics first (more reliable for concurrent runs)
            const runSpecificPath = require('path').join(pwDir, 'metrics.json');
            const latestPath = require('path').join(pwDir, 'latest-metrics.json');
            const fs = require('fs');
            
            let metricsData = null;
            
            // Try latest-metrics.json first (most recent single test result)
            if (fs.existsSync(latestPath)) {
                try {
                    metricsData = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
                    console.log('Successfully loaded latest-metrics.json:', metricsData);
                } catch (e) {
                    console.warn('Failed to parse latest-metrics.json:', e.message);
                }
            }
            
            // Fall back to metrics array file if latest not found
            if (!metricsData && fs.existsSync(runSpecificPath)) {
                try {
                    const runMetrics = JSON.parse(fs.readFileSync(runSpecificPath, 'utf8'));
                    // If it's an array, get the most recent entry
                    if (Array.isArray(runMetrics) && runMetrics.length > 0) {
                        metricsData = runMetrics[runMetrics.length - 1];
                        console.log('Successfully loaded from metrics.json array:', metricsData);
                    } else if (runMetrics && typeof runMetrics === 'object') {
                        metricsData = runMetrics;
                        console.log('Successfully loaded metrics.json object:', metricsData);
                    }
                } catch (e) {
                    console.warn('Failed to parse metrics.json:', e.message);
                }
            }
            
            if (metricsData) {
                output.fullMetrics = metricsData;
                // Override with more precise values if available
                if (typeof metricsData.largestContentfulPaint === 'number') output.lcp = metricsData.largestContentfulPaint;
                if (typeof metricsData.ttfb === 'number') output.ttfb = metricsData.ttfb;
                if (typeof metricsData.firstContentfulPaint === 'number') output.fcp = metricsData.firstContentfulPaint;
                if (typeof metricsData.pageLoadTime === 'number') output.pageLoadTime = metricsData.pageLoadTime;
                console.log('Final output with metrics:', output);
            } else {
                console.log('No metrics data found in files');
            }
        } else {
            console.log('PW_DIR not set');
        }
    } catch (e) {
        console.error('Error reading metrics file:', e);
    }
    
    // Set status based on test results
    if (output.passed > 0 && output.failed === 0) {
        output.status = 'success';
    } else if (output.failed > 0) {
        output.status = 'failed';
    } else {
        // Keep default 'error' status if no tests were detected
        output.status = 'error';
    }
    
    console.log('Setting status based on passed/failed:', { passed: output.passed, failed: output.failed, status: output.status });

    return output;
}

let jobStorage = null;
let activeJobs = new Map(); // Track active jobs for timeout management

// Initialize job storage when router is loaded
function initializeJobStorage(PW_DIR) {
    if (!jobStorage && PW_DIR) {
        const storageDir = path.join(PW_DIR, 'logs', 'cron');
        jobStorage = new JobStorageService(storageDir);
    }
}

// SSE endpoint removed - using simple polling instead

// GET /api/cron/jobs - Get all cron jobs
router.get('/jobs', (req, res) => {
    const bree = req.app.locals.bree;
    res.json(bree.config.jobs);
});

// GET /api/cron/results - Get stored job results
router.get('/results', async (req, res) => {
    const PW_DIR = req.app.locals.PW_DIR;
    initializeJobStorage(PW_DIR);
    
    try {
        const { env, limit = 5 } = req.query;
        
        if (env) {
            // Get results for specific environment
            const results = await jobStorage.getJobResults(env, parseInt(limit));
            res.json({ env, results });
        } else {
            // Get results for all environments
            const allResults = await jobStorage.getAllJobResults(parseInt(limit));
            res.json(allResults);
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch job results', message: error.message });
    }
});

// POST /api/cron/cleanup - Clean up old job records
router.post('/cleanup', async (req, res) => {
    const PW_DIR = req.app.locals.PW_DIR;
    initializeJobStorage(PW_DIR);
    
    try {
        const { maxAge = 30 } = req.body;
        await jobStorage.cleanupOldJobs(parseInt(maxAge));
        res.json({ message: `Cleaned up job records older than ${maxAge} days` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to cleanup old jobs', message: error.message });
    }
});

// POST /api/cron/jobs - Add a new cron job
router.post('/jobs', async (req, res) => {
    const { name, schedule, path: jobPath, worker, interval } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Missing name' });
    }

    const bree = req.app.locals.bree;
    const PW_DIR = req.app.locals.PW_DIR;
    
    const fullJobPath = jobPath ? path.join(PW_DIR, 'config', 'bree', 'jobs', jobPath) : undefined;

    try {
        await bree.add({ name, path: fullJobPath, interval: interval || schedule, worker });
        await bree.start(name);
        res.status(201).json({ message: `Job ${name} added and started.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Watchdog timer function - increased timeout to allow for Playwright's 60s timeout
function startWatchdogTimer(runId, env, type, timeoutMs = 75000) {
    const timerId = setTimeout(async () => {
        console.log(`Job ${runId} timed out after ${timeoutMs}ms`);
        
        // Update job status to timed out
        const PW_DIR = process.env.PW_DIR;
        if (PW_DIR) {
            initializeJobStorage(PW_DIR);
            try {
                await jobStorage.updateJobStatus(env, runId, 'timedout', {
                    timeoutAt: new Date().toISOString(),
                    timeoutMs
                });
            } catch (error) {
                console.error('Failed to update timed out job status:', error);
            }
        }
        
        // Send timeout event to clients
        const timeoutData = {
            status: 'timedout',
            runId,
            env,
            type,
            error: `Job timed out after ${timeoutMs / 1000} seconds`,
            timeoutAt: new Date().toISOString()
        };
        
        storeJobResult(timeoutData);
        
        // Remove from active jobs
        activeJobs.delete(runId);
    }, timeoutMs);
    
    // Store the timer
    activeJobs.set(runId, {
        timerId,
        startTime: new Date(),
        env,
        type
    });
    
    return timerId;
}

// Clear watchdog timer
function clearWatchdogTimer(runId) {
    const job = activeJobs.get(runId);
    if (job) {
        clearTimeout(job.timerId);
        activeJobs.delete(runId);
    }
}

// POST /api/cron/run-auto - Run auto health check (preserves type: 'auto')
router.post('/run-auto', async (req, res) => {
    const { command, env, runId } = req.body;
    const PW_DIR = req.app.locals.PW_DIR;

    if (!command || !env || !runId) {
        return res.status(400).json({ error: 'Missing command, environment, or runId' });
    }

    initializeJobStorage(PW_DIR);

    // Start watchdog timer for this job
    startWatchdogTimer(runId, env, 'auto');

    // Store initial job state
    try {
        await jobStorage.storeJobResult({
            runId,
            env,
            type: 'auto',  // Ensure type is 'auto'
            status: 'running',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Failed to store initial auto job state:', error);
    }

    exec(command, async (error, stdout, stderr) => {
        // Clear the watchdog timer since job completed
        clearWatchdogTimer(runId);
        
        // First send FINISHING state
        const finishingResult = {
            status: 'finishing',
            runId,
            env,
            type: 'auto',
            finishingAt: new Date().toISOString()
        };
        
        await storeJobResult(finishingResult);
        
        // Wait a moment to show FINISHING state, then send final result
        setTimeout(async () => {
            let jobResult;
            if (error) {
                jobResult = { 
                    status: 'error', 
                    error: error.message, 
                    stderr, 
                    runId, 
                    env, 
                    type: 'auto',  // Ensure type is 'auto'
                    completedAt: new Date().toISOString()
                };
            } else {
                const parsedData = parsePlaywrightOutput(stdout);
                console.log('Creating auto job result with parsed data:', parsedData);
                jobResult = { 
                    status: parsedData.status || 'success',
                    runId, 
                    env, 
                    type: 'auto',  // Ensure type is 'auto'
                    data: parsedData,
                    completedAt: new Date().toISOString()
                };
                console.log('Final auto job result to store:', jobResult);
            }
            
            // Store completed job result
            try {
                await jobStorage.storeJobResult(jobResult);
            } catch (error) {
                console.error('Failed to store auto job result:', error);
            }
        }, 1500); // Show FINISHING for 1.5 seconds
    });

    res.json({ success: true, message: 'Auto health check started', runId, env });
});

router.post('/run-manual', async (req, res) => {
    const { command, env, runId, autoType } = req.body;
    const PW_DIR = req.app.locals.PW_DIR;

    if (!command || !env || !runId) {
        return res.status(400).json({ error: 'Missing command, environment, or runId' });
    }

    initializeJobStorage(PW_DIR);

    // Determine job type based on autoType flag
    const jobType = autoType ? 'auto' : 'manual';

    // Start watchdog timer for this job
    startWatchdogTimer(runId, env, jobType);

    // Store initial job state
    try {
        await jobStorage.storeJobResult({
            runId,
            env,
            type: jobType,
            status: 'running',
            command,
            startedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Failed to store initial job state:', error);
    }

    exec(command, async (error, stdout, stderr) => {
        // Clear the watchdog timer since job completed
        clearWatchdogTimer(runId);
        
        // First send FINISHING state
        const finishingResult = {
            status: 'finishing',
            runId,
            env,
            type: jobType,
            finishingAt: new Date().toISOString()
        };
        
        storeJobResult(finishingResult);
        
        // Wait a moment to show FINISHING state, then send final result
        setTimeout(async () => {
            let jobResult;
            if (error) {
                jobResult = { 
                    status: 'error', 
                    error: error.message, 
                    stderr, 
                    runId, 
                    env, 
                    type: jobType,
                    completedAt: new Date().toISOString()
                };
            } else {
                const parsedData = parsePlaywrightOutput(stdout);
                console.log('Creating job result with parsed data:', parsedData);
                jobResult = { 
                    status: parsedData.status || 'success',  // Use parsed status
                    runId, 
                    env, 
                    type: jobType,
                    data: parsedData,
                    completedAt: new Date().toISOString()
                };
                console.log('Final job result to store:', jobResult);
            }
            
            // Store completed job result
            try {

                await jobStorage.storeJobResult(jobResult);
            } catch (storageError) {
                console.error('Failed to store job result:', storageError);
            }
            
            storeJobResult(jobResult);
        }, 1500); // Show FINISHING for 1.5 seconds
    });

    res.status(202).json({ message: `Manual command for ${env} accepted for execution.` });
});

router.post('/jobs/stop/:name', async (req, res) => {
    const { name } = req.params;
    const bree = req.app.locals.bree;
    try {
        await bree.stop(name);
        res.json({ success: true, message: `Job ${name} stopped.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

async function storeJobResult(data) {
    // Store the job result if it has the required fields
    if (data.runId && data.env && data.status && jobStorage) {
        try {
            console.log('Storing job result:', { runId: data.runId, type: data.type, env: data.env, status: data.status });
            await jobStorage.storeJobResult(data);
        } catch (error) {
            console.error('Failed to store job result:', error);
        }
    }
}

// GET /api/cron/health-check-state - Get stored health check configuration
router.get('/health-check-state', async (req, res) => {
    const PW_DIR = req.app.locals.PW_DIR;
    const configPath = path.join(PW_DIR, 'config', 'health-check-state.json');
    
    try {
        const configData = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(configData);
        res.json(config);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // Return default config if file doesn't exist
            res.json({
                enabled: false,
                interval: 'every 1 minute',
                environments: [],
                lastUpdated: new Date().toISOString()
            });
        } else {
            console.error('Failed to read health check state:', error);
            res.status(500).json({ error: 'Failed to read health check configuration' });
        }
    }
});

// POST /api/cron/health-check-state - Save health check configuration
router.post('/health-check-state', async (req, res) => {
    const PW_DIR = req.app.locals.PW_DIR;
    const configDir = path.join(PW_DIR, 'config');
    const configPath = path.join(configDir, 'health-check-state.json');
    
    try {
        // Ensure config directory exists
        await fs.mkdir(configDir, { recursive: true });
        
        const config = {
            enabled: req.body.enabled || false,
            interval: req.body.interval || 'every 1 minute',
            environments: req.body.environments || [],
            lastUpdated: new Date().toISOString()
        };
        
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        res.json({ success: true, config });
        
    } catch (error) {
        console.error('Failed to save health check state:', error);
        res.status(500).json({ error: 'Failed to save health check configuration' });
    }
});

module.exports = { 
    router, 
    storeJobResult,
    startWatchdogTimer, 
    clearWatchdogTimer,
    initializeJobStorage 
};
