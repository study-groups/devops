const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const log = require('../../utils/logging');

const router = express.Router();

// API endpoint to add a log entry
router.post('/entry', (req, res) => {
    console.log('%c[API /entry] Received log request:', 'color: #FFA500; font-weight: bold;', {
        body: req.body,
        headers: req.headers
    });
    
    // The new logger handles normalization and validation internally
    const logEntry = log.recordEvent({
        Type: req.body.type || 'UNKNOWN',
        From: req.body.from || 'unknown.frontend',
        Message: req.body.message || 'No message provided',
        Data: req.body.data || {}
    });

    if (logEntry) {
        console.log('%c[API /entry] Log processed successfully.', 'color: #00FF00; font-weight: bold;', logEntry.id);
        res.status(201).json({ 
            success: true, 
            message: 'Log entry created.',
            id: logEntry.id
        });
    } else {
        console.warn('%c[API /entry] Log accepted but not processed.', 'color: #FFFF00; font-weight: bold;', req.body);
        res.status(202).json({
            success: true,
            message: 'Log entry accepted but not processed (possibly due to log level settings).'
        });
    }
});

// GET /api/logs - Main endpoint for fetching log data
router.get('/', async (req, res) => {
    const { source, since, limit, type } = req.query;
    const pwDir = process.env.PW_DIR;

    if (!pwDir) {
        log.error('PW_DIR is not set');
        return res.status(500).json({ 
            success: false, 
            error: 'Server configuration error: PW_DIR is not set.'
        });
    }

    const logsDir = path.join(pwDir, 'logs');

    try {
        // If no source specified, return all available log sources
        if (!source) {
            const entries = await fs.readdir(logsDir, { withFileTypes: true });
            const sources = entries
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
            return res.json({ success: true, sources, baseLogDir: logsDir });
        }

        // Sanitize source to prevent directory traversal
        const sanitizedSource = source.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '');
        const logFile = path.join(logsDir, sanitizedSource, `${sanitizedSource}.log`);

        // Read entire log file
        const content = await fs.readFile(logFile, 'utf8');
        const lines = content.trim().split('\n').filter(Boolean);

        // Parse log entries, handling potential parsing errors
        let logs = lines.map(line => {
            try {
                return JSON.parse(line);
            } catch (parseError) {
                log.warn('Failed to parse log entry', { 
                    rawEntry: line, 
                    error: parseError.message 
                });
                return null;
            }
        }).filter(Boolean);  // Remove any null entries from parsing failures

        // Optional time-based filtering
        if (since) {
            const sinceDate = new Date(since);
            logs = logs.filter(log => 
                log.Time && new Date(log.Time) > sinceDate
            );
        }

        // Optional type filtering (case-insensitive)
        if (type) {
            const normalizedType = type.toUpperCase();
            logs = logs.filter(log => 
                (log.Type || log.TYPE || '').toUpperCase() === normalizedType
            );
        }

        // Sort logs by timestamp, most recent first
        const sortedLogs = logs.sort((a, b) => 
            new Date(b.Time || b.timestamp) - new Date(a.Time || a.timestamp)
        );

        // Apply optional limit
        const parsedLimit = limit ? parseInt(limit, 10) : null;
        const finalLogs = parsedLimit > 0 
            ? sortedLogs.slice(0, parsedLimit) 
            : sortedLogs;

        res.json({ 
            success: true, 
            logs: finalLogs, 
            source: sanitizedSource,
            totalLogs: sortedLogs.length,
            filteredLogs: finalLogs.length
        });

    } catch (error) {
        if (error.code === 'ENOENT') {
            log.warn(`Requested log file not found: ${source}`);
            return res.status(404).json({
                success: false,
                error: `Log file for source '${source}' not found`
            });
        }

        log.error('Unexpected error reading log file', { 
            source, 
            error: error.message 
        });

        res.status(500).json({
            success: false,
            error: 'An unexpected error occurred while retrieving logs'
        });
    }
});


// API endpoint to trigger nginx log processing
router.post('/nginx/process', async (req, res) => {
    try {
        const pwDir = process.env.PW_DIR;
        if (!pwDir) {
            return res.status(500).json({ success: false, error: 'Server configuration error: PW_DIR is not set.' });
        }

        const statsManager = new StatsManager(
            '/var/log/nginx/access.log',
            path.join(pwDir, 'logs', 'stats', 'nginx-state.json'),
            path.join(pwDir, 'logs', 'stats', 'nginx-summary.json')
        );

        await statsManager.processLogs();

        res.json({ success: true, message: 'Nginx log processing complete.' });
    } catch (error) {
        log.error('Failed to process nginx logs', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to process nginx logs.' });
    }
});

// API endpoint to manually trigger log rotation
router.post('/rotate', (req, res) => {
    try {
        const { source } = req.body;
        if (!source || typeof source !== 'string') {
            return res.status(400).json({ success: false, error: 'Log source (e.g., "server") must be provided.' });
        }

        // Basic security to prevent directory traversal
        if (source.includes('..')) {
            return res.status(400).json({ success: false, error: 'Invalid log source.' });
        }
        
        const { PW_DIR } = req.app.locals;
        const logFile = path.join(PW_DIR, 'logs', source);

        const result = log.forceRotate(logFile);

        if (result.rotated) {
            res.json({ success: true, message: result.message });
        } else {
            res.status(404).json({ success: false, message: result.message });
        }
    } catch (e) {
        log.error('[API] Failed to manually rotate logs', { error: e.message });
        res.status(500).json({ success: false, error: 'An unexpected error occurred during log rotation.' });
    }
});

// API endpoint to log structured PW_PING events
router.post('/ping', async (req, res) => {
    try {
        const { env, src, dst, test, status, duration, details } = req.body;
        
        const logEntry = {
            TYPE: 'PW_PING',
            FROM: `event.ping.${env}`,
            message: `Ping to ${dst} completed with status: ${status}`,
            data: {
                environment: env,
                destination: dst,
                test: test || 'ping-test',
                status: status || 'unknown',
                success: status === 'passed' || status === 'success',
                duration: duration || null,
                details: details || null,
            }
        };

        log.recordEvent(logEntry);
        
        res.json({
            success: true,
            message: 'PW_PING event logged successfully',
            logEntry: logEntry
        });
        
    } catch (e) {
        res.status(500).json({ 
            success: false, 
            error: e.message 
        });
    }
});

// API endpoint to perform real page load test with performance metrics
router.post('/perform-load-test/:env', async (req, res) => {
    const { env } = req.params;
    let browser;

    try {
        const validEnvs = ['dev', 'staging', 'prod'];
        if (!validEnvs.includes(env)) {
            return res.status(400).json({ success: false, error: 'Invalid environment.' });
        }
        
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        const targetUrl = `https://${env === 'prod' ? '' : env + '.'}pixeljamarcade.com`;
        
        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 10000 });
        
        const performanceMetrics = await page.evaluate(() => {
            const perf = performance.getEntriesByType('navigation')[0];
            return {
                dns_lookup: Math.round(perf.domainLookupEnd - perf.domainLookupStart),
                tcp_connect: Math.round(perf.connectEnd - perf.connectStart),
                request_time: Math.round(perf.responseStart - perf.requestStart),
                response_time: Math.round(perf.responseEnd - perf.responseStart),
                dom_load: Math.round(perf.domContentLoadedEventEnd - perf.navigationStart),
                page_load: Math.round(perf.loadEventEnd - perf.navigationStart),
            };
        });
        
        const logEntry = {
            TYPE: 'PW_LOAD_TEST',
            FROM: `playwright.load-test.${env}`,
            message: `Load test for ${targetUrl} completed in ${performanceMetrics.page_load}ms.`,
            data: {
                environment: env,
                url: targetUrl,
                status: 'passed',
                success: true,
                performance: performanceMetrics,
            }
        };

        log.recordEvent(logEntry);
        await browser.close();
        res.json({ success: true, data: logEntry });

    } catch (pageError) {
        if (browser) await browser.close();
        
        const logEntry = {
            TYPE: 'PW_LOAD_TEST_ERROR',
            FROM: `playwright.load-test.${env}`,
            message: `Load test for ${env} failed: ${pageError.message}`,
            data: {
                environment: env,
                status: 'failed',
                success: false,
                error: pageError.message,
            }
        };
        
        log.recordEvent(logEntry);
        res.status(500).json({ success: false, error: pageError.message, data: logEntry });
    }
});

// API endpoint to generate test PW_PING events (for testing/demo)
router.post('/generate-ping/:env', async (req, res) => {
    try {
        const { env } = req.params;
        const validEnvs = ['dev', 'staging', 'prod'];
        
        if (!validEnvs.includes(env)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid environment. Must be dev, staging, or prod' 
            });
        }
        
        // Generate realistic performance data
        const testNames = ['homepage-load', 'game-startup', 'user-login', 'api-health', 'navigation'];
        const randomTest = testNames[Math.floor(Math.random() * testNames.length)];
        const isSuccess = Math.random() > 0.15; // 85% success rate
        
        const performanceData = {
            dns_lookup: Math.floor(Math.random() * 50) + 10,
            tcp_connect: Math.floor(Math.random() * 100) + 20,
            request_time: Math.floor(Math.random() * 200) + 50,
            dom_load: Math.floor(Math.random() * 1000) + 500,
            page_load: Math.floor(Math.random() * 2000) + 800,
            first_paint: Math.floor(Math.random() * 800) + 300
        };
        
        const serverInfo = {
            server: Math.random() > 0.5 ? 'nginx/1.18.0' : 'Apache/2.4.41',
            status: isSuccess ? 200 : (Math.random() > 0.5 ? 404 : 500),
            content_type: 'text/html; charset=utf-8'
        };
        
        const pingData = {
            env: env,
            src: `test-runner.${env}.pixeljamarcade.com`,
            dst: `https://${env}.pixeljamarcade.com`,
            test: randomTest,
            status: isSuccess ? 'passed' : 'failed',
            duration: performanceData.page_load,
            performance: performanceData,
            server_info: serverInfo,
            details: isSuccess ? 
                `DOM: ${performanceData.dom_load}ms, Load: ${performanceData.page_load}ms` : 
                'Page load failed - timeout or server error'
        };
        
        // Log the enhanced ping event
        const PW_DIR = req.app.locals.PW_DIR;
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'PW_LOAD_TEST',
            environment: env,
            FROM: `event.ping-generator.${env}`,
            src: pingData.src,
            dst: pingData.dst,
            test: pingData.test,
            status: pingData.status,
            success: pingData.status === 'passed',
            duration: pingData.duration,
            performance: pingData.performance,
            server_info: pingData.server_info,
            metrics: {
                dom_load_time: performanceData.dom_load,
                full_load_time: performanceData.page_load,
                first_paint: performanceData.first_paint,
                tcp_connect: performanceData.tcp_connect,
                dns_lookup: performanceData.dns_lookup
            },
            details: pingData.details,
            id: `ping-${env}-${Date.now()}`
        };
        
        // Send to central log writer for unified aggregation
        try {
            log.recordEvent(logEntry);
        } catch (logError) {
            log.warn('Could not send to central log writer:', logError.message);
            
            // Fallback to direct file write if central writer is unavailable
            const logDir = path.join(PW_DIR, 'logs');
            const logFile = path.join(logDir, `playwright-monitor-${env}.log`);
            try {
                await fs.mkdir(logDir, { recursive: true });
                await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
            } catch (fileError) {
                log.warn('Fallback file write also failed', { error: fileError.message });
            }
        }
        
        res.json({
            success: true,
            message: `Generated enhanced load test event for ${env}`,
            data: logEntry
        });
        
    } catch (e) {
        res.status(500).json({ 
            success: false, 
            error: e.message 
        });
    }
});

// API endpoint to add log entry
router.post('/entry', (req, res) => {
    // Extensive logging and validation
    console.log('RAW LOG REQUEST:', {
        body: req.body,
        headers: req.headers,
        ip: req.ip
    });

    // Validate request body
    const { type, from, message, data } = req.body;

    // Strict validation
    if (!type || typeof type !== 'string') {
        console.error('INVALID LOG ENTRY: Missing or invalid type', req.body);
        return res.status(400).json({ 
            success: false, 
            error: 'Log entries must include a valid `type`.',
            details: {
                receivedBody: req.body,
                missingFields: !type ? ['type'] : [],
                invalidFields: typeof type !== 'string' ? ['type'] : []
            }
        });
    }

    // Sanitize and validate input
    const sanitizedEntry = {
        TYPE: String(type).toUpperCase(),
        FROM: from ? String(from) : 'unknown.frontend',
        message: message ? String(message) : 'No message provided',
        data: data && typeof data === 'object' ? data : {}
    };

    // Add request context
    sanitizedEntry.data.requestContext = {
        timestamp: new Date().toISOString(),
        source: req.headers['x-log-source'] || 'unknown',
        userAgent: req.headers['user-agent'],
        ip: req.ip
    };

    try {
        // Log the entry using the new logging system
        log.recordEvent({
            Type: sanitizedEntry.TYPE,
            From: sanitizedEntry.FROM,
            Message: sanitizedEntry.message,
            Data: sanitizedEntry.data
        });

        // Respond with success
        res.status(201).json({ 
            success: true, 
            message: 'Log entry created.',
            details: {
                type: sanitizedEntry.TYPE,
                from: sanitizedEntry.FROM
            }
        });
    } catch (error) {
        // Comprehensive error handling
        console.error('FATAL LOG PROCESSING ERROR:', {
            error: error.message,
            stack: error.stack,
            originalEntry: sanitizedEntry
        });

        res.status(500).json({ 
            success: false, 
            error: 'Failed to process log entry',
            details: {
                message: error.message,
                originalEntry: sanitizedEntry
            }
        });
    }
});

// New route for system logs from the frontend
router.post('/system', (req, res) => {
    try {
        const { level, type, message, from, data } = req.body;
        
        if (!level || !type || !message) {
            log.warn('System log request missing required fields', { 
                body: req.body,
                levelReceived: level,
                typeReceived: type,
                messageReceived: message,
                bodyKeys: Object.keys(req.body || {}),
                contentType: req.headers['content-type']
            });
            return res.status(400).json({ 
                success: false, 
                error: 'Log entries must include `level`, `type`, and `message`.', 
                received: { level, type, message, bodyKeys: Object.keys(req.body || {}) }
            });
        }
        
        // Use the proper recordEvent structure
        log.recordEvent({
            Type: type,           // Log category (API, SERVER, etc.)
            Level: level,         // Log level (ERROR, WARN, INFO, etc.)
            From: from || 'frontend',
            Message: message,
            Data: data || {}
        });
        
        res.status(202).json({ success: true, message: 'Log received' });
    } catch (error) {
        // Add detailed error logging
        log.error('Error in /api/logs/system endpoint', {
            errorMessage: error.message,
            errorStack: error.stack,
            requestBody: req.body
        });
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// New endpoint to get the status (last modified time) of a log source
router.get('/status', async (req, res) => {
    const { source } = req.query;
    const pwDir = process.env.PW_DIR;

    if (!pwDir) {
        return res.status(500).json({ success: false, error: 'Server configuration error: PW_DIR is not set.' });
    }

    if (!source || source.includes('..')) {
        return res.status(400).json({ success: false, error: 'Invalid or missing source name' });
    }

    const logFile = path.join(pwDir, 'logs', source, `${source}.log`);

    try {
        const stats = await fs.stat(logFile);
        res.json({
            success: true,
            source,
            lastModified: stats.mtime.toISOString()
        });
    } catch (err) {
        if (err.code === 'ENOENT') {
            res.status(404).json({ success: false, error: 'Log source not found.' });
        } else {
            res.status(500).json({ success: false, error: 'Failed to get log status.' });
        }
    }
});

// Predefined, allowed log sources
const ALLOWED_LOG_SOURCES = [
    'server',     // General server logs
    'monitor',    // Monitoring and system health logs
    'playwright', // Playwright test execution logs
    'command',    // Command runner logs
];

// New endpoint to clear logs for a specific source
router.delete('/', async (req, res) => {
    const { source } = req.query;
    const pwDir = process.env.PW_DIR;

    if (!pwDir) {
        return res.status(500).json({ 
            success: false, 
            error: 'Server configuration error: PW_DIR is not set.',
            errorType: 'CONFIG_ERROR'
        });
    }

    // Validate source
    if (!source) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid or missing log source.',
            errorType: 'INVALID_SOURCE'
        });
    }

    // Basic security to prevent directory traversal
    if (source.includes('..') || source.includes('/') || source.includes('\\')) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid log source. Directory traversal is not allowed.',
            errorType: 'INVALID_SOURCE'
        });
    }

    try {
        // Use the raw source name, but ensure it's a valid string
        const cleanSource = source.toLowerCase().trim();
        
        // Limit source name length to prevent potential abuse
        if (cleanSource.length > 50) {
            return res.status(400).json({ 
                success: false, 
                error: 'Log source name is too long.',
                errorType: 'INVALID_SOURCE'
            });
        }

        // Remove any non-alphanumeric characters except hyphens and underscores
        const sanitizedSource = cleanSource.replace(/[^a-z0-9-_]/g, '');

        const logDir = path.join(pwDir, 'logs', sanitizedSource);
        const logFile = path.join(logDir, `${sanitizedSource}.log`);

        // Ensure log directory exists
        await fs.mkdir(logDir, { recursive: true });

        // Check if log file exists using async method
        try {
            await fs.access(logFile);
        } catch (notFoundError) {
            // Create an empty log file if it doesn't exist
            await fs.writeFile(logFile, '');
            return res.json({ 
                success: true, 
                message: 'No logs found. Created empty log file.',
                errorType: 'NO_LOGS_FOUND'
            });
        }

        // Ensure log directory is writable
        try {
            await fs.access(logDir, fs.constants.W_OK);
        } catch (accessError) {
            return res.status(403).json({
                success: false,
                error: 'Log directory is not writable',
                errorType: 'PERMISSION_DENIED',
                details: accessError.message
            });
        }

        // Backup the current log file before clearing
        const backupDir = path.join(logDir, 'archive');
        await fs.mkdir(backupDir, { recursive: true });
        const backupFile = path.join(backupDir, `${sanitizedSource}.log.${Date.now()}`);
        
        try {
            // Create backup
            await fs.copyFile(logFile, backupFile);

            // Clear the log file
            await fs.writeFile(logFile, '');
        } catch (fileError) {
            return res.status(500).json({
                success: false,
                error: 'Failed to backup or clear log file',
                errorType: 'FILE_OPERATION_ERROR',
                details: fileError.message
            });
        }

        // Log the clearing event
        log.recordEvent({
            Type: 'SERVER_INFO',
            From: 'logs.clear',
            Message: `Logs cleared for source: ${sanitizedSource}`,
            Data: {
                source: sanitizedSource,
                backupFile: path.basename(backupFile)
            }
        });

        res.json({ 
            success: true, 
            message: 'Logs cleared successfully',
            backup: path.basename(backupFile)
        });

    } catch (error) {
        log.error('Failed to clear logs', { 
            source: source, 
            error: error.message 
        });

        res.status(500).json({ 
            success: false, 
            error: 'Unexpected error clearing logs',
            errorType: 'UNEXPECTED_ERROR',
            details: error.message 
        });
    }
});

// API endpoint to fetch source code for stack trace viewing
router.get('/source', async (req, res) => {
    const { file } = req.query;
    
    if (!file) {
        return res.status(400).json({ success: false, error: 'File path is required' });
    }
    
    // Security: only allow files within the project directory
    const projectRoot = process.cwd();
    const requestedPath = path.resolve(projectRoot, file);
    
    if (!requestedPath.startsWith(projectRoot)) {
        return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    try {
        const content = await fs.readFile(requestedPath, 'utf8');
        const relativePath = path.relative(projectRoot, requestedPath);
        
        res.json({
            success: true,
            file: relativePath,
            content: content
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ success: false, error: 'File not found' });
        } else {
            log.error('Failed to read source file', { file, error: error.message });
            res.status(500).json({ success: false, error: 'Failed to read file' });
        }
    }
});

module.exports = router;
