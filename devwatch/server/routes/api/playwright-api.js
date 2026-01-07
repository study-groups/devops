const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const path = require('path');
const { log, error, warn } = require('../../utils/logging');
const { CommandManager, ExecutionManager } = require('../../utils/storage-manager');

const router = express.Router();
const execAsync = promisify(exec);

let runningTestProcess = null;
let currentJob = null;
let reportServerProcess = null;

// Helper function to parse environment variables from command string
function parseCommandWithEnvVars(command) {
    if (!command) return { envVars: {}, cleanCommand: '' };
    
    const envVars = {};
    let parts = command.trim().split(/\s+/);
    let cleanCommandParts = [];
    
    // Process each part to extract environment variables
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        // Check if this part looks like an environment variable (KEY=VALUE)
        if (part.includes('=') && !part.startsWith('-') && !cleanCommandParts.length) {
            const [key, ...valueParts] = part.split('=');
            const value = valueParts.join('='); // In case value contains '='
            
            // Validate environment variable name (alphanumeric + underscore)
            if (/^[A-Z_][A-Z0-9_]*$/i.test(key)) {
                envVars[key] = value;
                continue;
            }
        }
        
        // If we've hit a non-env-var part, the rest is the command
        cleanCommandParts = parts.slice(i);
        break;
    }
    
    return {
        envVars,
        cleanCommand: cleanCommandParts.join(' ')
    };
}

router.get('/status', (req, res) => {
    if (runningTestProcess) {
        res.json({ running: true, job: currentJob });
    } else {
        res.json({ running: false, job: null });
    }
});

// API endpoint for command runner
// Accessible as both /api/command/run and /api/playwright/run
router.post('/run', async (req, res) => {
    return handleCommandExecution(req, res);
});

// Shared command execution handler
async function handleCommandExecution(req, res) {
    const { command, env } = req.body;
    const { PW_DIR, PW_SRC } = req.app.locals;

    // Validate required configuration
    if (!PW_DIR) {
        error('[COMMAND EXECUTION] PW_DIR not configured');
        return res.status(500).json({ 
            success: false, 
            error: 'Server configuration error: PW_DIR not set'
        });
    }

    if (!PW_SRC) {
        error('[COMMAND EXECUTION] PW_SRC not configured');
        return res.status(500).json({ 
            success: false, 
            error: 'Server configuration error: PW_SRC not set'
        });
    }

    if (runningTestProcess) {
        return res.status(409).json({ error: 'A test run is already in progress.' });
    }

    // Parse environment variables and command
    const { envVars, cleanCommand } = parseCommandWithEnvVars(command);
    
    if (!cleanCommand || !cleanCommand.trim().startsWith('npx playwright test')) {
        log({ type: 'api', level: 'warn', from: 'command.auth', message: 'Invalid command received for execution:', data: { command } });
        return res.status(400).json({
            success: false,
            error: 'Invalid command. Only "npx playwright test ..." commands (optionally prefixed with environment variables) are allowed.',
            command
        });
    }

    // Enforce: Only allow saved named-commands
    try {
        const commandManager = new CommandManager(PW_DIR, 'playwright');
        
        // Initialize storage directories if needed
        await commandManager.initialize();
        
        // Check if this is an authorized command (only saved commands now)
        const commands = await commandManager.listCommands();
        
        log({ type: 'api', level: 'info', from: 'command.auth', message: `Authorization check: Found ${commands.length} saved commands` });
        
        const incoming = cleanCommand.trim();
        log({ type: 'api', level: 'info', from: 'command.auth', message: `Checking authorization for command: "${incoming}"` });
        const isAuthorized = commands.some(item => {
            if (!item.command) return false;
            const { cleanCommand: savedCleanCommand } = parseCommandWithEnvVars(item.command);
            // Allow execution if the incoming command starts with a saved command,
            // which handles variations in arguments like --reporter.
            return incoming.startsWith(savedCleanCommand.trim());
        });
        
        if (!isAuthorized) {
            log({
                type: 'api',
                level: 'warn',
                from: 'command.auth.failed',
                message: 'Blocked unauthorized command execution attempt',
                data: { command, environment: env, PW_DIR, PW_SRC }
            });
            return res.status(403).json({
                success: false,
                error: 'Command not authorized. Only saved commands may be executed.',
                hint: 'Save the command via Command Runner first, then execute it.'
            });
        }
    } catch (e) {
        error('[COMMAND EXECUTION] Authorization check failed:', e);
        log({
            type: 'api',
            level: 'error',
            from: 'command.auth.error',
            message: `Authorization check failed: ${e.message}`,
            data: { command, error: e.stack, PW_DIR, PW_SRC }
        });
        return res.status(500).json({ 
            success: false, 
            error: `Authorization check failed: ${e.message}`,
            data: { PW_DIR, PW_SRC, stack: e.stack }
        });
    }
    
    const envUrls = {
        dev: 'https://dev.pixeljamarcade.com',
        staging: 'https://staging.pixeljamarcade.com',
        prod: 'https://pixeljamarcade.com',
        local: 'http://localhost:3000'
    };

    const normalizedEnv = (env || '').toLowerCase();
    const targetUrl = envUrls[normalizedEnv] || envUrls['dev'];

    const isDryRun = cleanCommand.includes('--list');
    const activityId = `act_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const reportDir = isDryRun ? null : path.join('reports', `${new Date().toISOString().replace(/:/g, '-')}-${activityId}`);
    
    currentJob = { command, env, startTime: new Date().toISOString(), activityId, reportDir: reportDir ? path.join(PW_DIR, reportDir) : null };
    
    // Start execution tracking
    const executionManager = new ExecutionManager(PW_DIR);
    try {
        await executionManager.initialize();
        // Create a temporary command for tracking (we'll improve this when Command Runner is updated)
        const tempCommandId = `temp-${activityId}`;
        await executionManager.startExecution(tempCommandId, activityId);
    } catch (execErr) {
        log({ type: 'api', level: 'warn', from: 'command.run', message: 'Failed to start execution tracking:', data: { error: execErr.message } });
    }

    // Initialize/clear progress file for this activity
    try {
        const progressFile = path.join(PW_DIR, 'logs', 'test-progress.json');
        await fs.mkdir(path.dirname(progressFile), { recursive: true });
        await fs.writeFile(progressFile, JSON.stringify({
            activityId,
            status: 'starting',
            startTime: new Date().toISOString(),
            totalTests: 0,
            completedTests: 0,
            currentTest: null,
            results: [],
            lastUpdate: new Date().toISOString()
        }, null, 2));
    } catch (_) { /* ignore init errors */ }
    
    const rtReporterPath = path.join(PW_SRC, 'reporters', 'real-time-reporter.js');
    const adminReporterPath = path.join(PW_SRC, 'reporters', 'admin-reporter.js');
    
    // Set HTML reporter output to the timestamped directory
    const htmlReporterConfig = reportDir ? `html:${path.join(PW_DIR, reportDir)}` : 'html';
    const reporterArgs = isDryRun ? '' : `--reporter=json,${htmlReporterConfig},${rtReporterPath},${adminReporterPath}`;
    const finalCommand = `${cleanCommand} ${reporterArgs}`;
    log({ type: 'api', level: 'info', from: 'command.run', message: `Executing Playwright command from ${PW_SRC}: on ${env} (${targetUrl})`, data: { activityId, phase: 'start', label: 'Playwright Test Run', command, environment: env, targetUrl, isDryRun, reportDir: reportDir ? path.join(PW_DIR, reportDir) : null } });

    // Merge environment variables from command with default environment
    const processEnv = {
        ...process.env,
        PW_DIR,
        // Prefer named environment when provided; config will use PLAYWRIGHT_TARGET_ENV for dev/staging/prod/local,
        // and only fall back to PLAYWRIGHT_TARGET_URL for true custom URLs.
        ...(normalizedEnv && envUrls[normalizedEnv] ? { PLAYWRIGHT_TARGET_ENV: normalizedEnv } : { PLAYWRIGHT_TARGET_URL: targetUrl }),
        PJA_ACTIVITY_ID: activityId,
        ...envVars  // Environment variables from the command take precedence
    };

    const childProcess = exec(finalCommand, {
        cwd: PW_SRC,
        env: processEnv,
        timeout: 15 * 60 * 1000
    });

    runningTestProcess = childProcess;
    let stdout = '';
    let stderr = '';
    childProcess.stdout.on('data', (data) => stdout += data);
    childProcess.stderr.on('data', (data) => stderr += data);

    // Immediately respond to the client so it doesn't hang
    res.status(202).json({ 
        success: true, 
        message: 'Test run started.', 
        activityId,
        reportPaths: reportDir ? {
            directory: path.join(PW_DIR, reportDir),
            htmlReport: path.join(PW_DIR, reportDir, 'index.html'),
            jsonReport: path.join(PW_DIR, reportDir, 'results.json'),
            relativeDirectory: reportDir,
            webUrl: `/reports/test?testId=${reportDir.replace(/.*\//, '')}`
        } : null,
        command: {
            original: command,
            clean: cleanCommand,
            environment: env,
            targetUrl,
            isDryRun
        }
    });

    childProcess.on('close', async (code, signal) => {
        runningTestProcess = null;
        const savedJob = currentJob;
        currentJob = null;

        if (signal === 'SIGTERM') {
                     log({
            type: 'api',
            level: 'warn',
            from: 'command.run.cancelled',
            message: `Playwright test run cancelled: ${command}`,
            data: { activityId, phase: 'end', outcome: 'cancelled', label: 'Playwright Test Run', command, environment: env, isDryRun, reportDir: savedJob?.reportDir }
        });
            return;
        }

        const isTimeout = code === null && signal === 'SIGTERM';
        const outcome = code === 0 ? 'passed' : (isTimeout ? 'timeout' : 'failed');

        let results = null;
        if (!isDryRun) {
            try {
                const jsonOutput = stdout.substring(stdout.indexOf('{'), stdout.lastIndexOf('}') + 1);
                if (jsonOutput) results = JSON.parse(jsonOutput);
            } catch (e) {
                log({ type: 'api', level: 'warn', from: 'command.run', message: 'Could not parse Playwright JSON output.', data: { error: e.message } });
            }
        }

        // Update execution tracking
        const executionManager = new ExecutionManager(PW_DIR);
        try {
            await executionManager.updateExecution(activityId, {
                status: 'completed',
                endTime: new Date().toISOString(),
                duration: Date.now() - new Date(savedJob.startTime).getTime(),
                outcome,
                results: {
                    exitCode: code,
                    stdout,
                    stderr,
                    stats: results?.stats
                },
                reportPaths: savedJob?.reportDir ? {
                    directory: savedJob.reportDir,
                    htmlReport: path.join(savedJob.reportDir, 'index.html'),
                    jsonReport: path.join(savedJob.reportDir, 'results.json'),
                    webUrl: `/reports/test?testId=${path.basename(savedJob.reportDir)}`
                } : null
            });
        } catch (execErr) {
            log({ type: 'api', level: 'warn', from: 'command.run', message: 'Failed to update execution tracking:', data: { error: execErr.message } });
        }

        log({
            type: 'api',
            level: 'info',
            from: 'command.run.end',
            message: `Command run ${outcome}: ${command}`,
            data: { activityId, phase: 'end', outcome, label: 'Command Run', command, environment: env, isDryRun, summary: results?.stats, details: { stdout, stderr }, reportDir: savedJob?.reportDir, fullReportPath: savedJob?.reportDir ? path.join(savedJob.reportDir, 'index.html') : null }
        });
    });
}

router.post('/stop', (req, res) => {
    if (runningTestProcess) {
        runningTestProcess.kill('SIGTERM');
        runningTestProcess = null;
        currentJob = null;
        res.json({ success: true, message: 'Test run stop signal sent.' });
    } else {
        res.status(404).json({ error: 'No test run in progress.' });
    }
});

// Start Playwright's built-in report server
router.post('/start-report-server', async (req, res) => {
    try {
        const { PW_DIR } = req.app.locals;
        if (!PW_DIR) {
            return res.status(500).json({ error: 'PW_DIR not configured' });
        }

        // Check if report server is already running
        if (reportServerProcess) {
            return res.json({ 
                success: true, 
                message: 'Report server already running',
                url: 'http://localhost:9323'
            });
        }

        const reportsDir = path.join(PW_DIR, 'reports');
        
        // Start Playwright's built-in report server
        reportServerProcess = exec(`npx playwright show-report --port=9323`, {
            cwd: process.cwd(),
            env: { ...process.env, PW_DIR }
        });

        reportServerProcess.on('close', () => {
            reportServerProcess = null;
        });

        // Give it a moment to start
        await new Promise(resolve => setTimeout(resolve, 2000));

        res.json({ 
            success: true, 
            message: 'Playwright report server started',
            url: 'http://localhost:9323'
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Stop Playwright's report server
router.post('/stop-report-server', (req, res) => {
    if (reportServerProcess) {
        reportServerProcess.kill('SIGTERM');
        reportServerProcess = null;
        res.json({ success: true, message: 'Report server stopped.' });
    } else {
        res.json({ success: true, message: 'Report server was not running.' });
    }
});

// List Playwright-related processes
router.get('/processes', async (req, res) => {
    try {
        const { stdout } = await execAsync('ps -ef | grep -E "(playwright|npx.*playwright|node .*test)" | grep -v grep | cat');
        const lines = stdout.split('\n').filter(Boolean);
        const processes = lines.map(line => {
            const parts = line.trim().split(/\s+/);
            // ps -ef: UID PID PPID C STIME TTY TIME CMD
            const pid = parts[1];
            const ppid = parts[2];
            const command = parts.slice(7).join(' ');
            return { pid, ppid, command, raw: line };
        });
        res.json({ success: true, processes });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Kill all Playwright-related processes (safe guard)
router.post('/stop-all', async (req, res) => {
    try {
        if (runningTestProcess) {
            try { runningTestProcess.kill('SIGTERM'); } catch (_) {}
            runningTestProcess = null;
            currentJob = null;
        }
        // Try graceful first, then force
        await execAsync('pkill -f "npx playwright test" || true');
        await execAsync('pkill -f "node .*playwright.*test" || true');
        res.json({ success: true, message: 'Stop-all signal sent to Playwright processes.' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Returns real-time progress produced by reporters/real-time-reporter.js
router.get('/progress', async (req, res) => {
    try {
        const { PW_DIR } = req.app.locals;
        const progressFile = path.join(PW_DIR, 'logs', 'test-progress.json');
        const content = await fs.readFile(progressFile, 'utf8');
        const json = JSON.parse(content);
        res.json(json);
    } catch (e) {
        if (e.code === 'ENOENT') {
            return res.status(404).json({ error: 'No active progress file' });
        }
        res.status(500).json({ error: e.message });
    }
});

// Helper: safe path join to prevent directory traversal
function safeJoin(root, unsafeRelPath = '') {
    const rel = unsafeRelPath.replace(/^\/+/, ''); // strip leading slashes
    const target = path.resolve(root, rel);
    if (!target.startsWith(root + path.sep) && target !== root) {
        const err = new Error('Forbidden path');
        err.code = 'E_FORBIDDEN_PATH';
        throw err;
    }
    return target;
}

// GET /api/show-report - Redirect to reports route
router.get('/show-report', async (req, res) => {
    const reportPath = req.query.path;
    
    if (reportPath) {
        // Extract directory name and redirect to specific report
        const dirName = reportPath.replace('/index.html', '');
        res.redirect(`/reports/${dirName}/index.html`);
    } else {
        // Redirect to general reports page
        res.redirect('/reports/');
    }
});

module.exports = router;
