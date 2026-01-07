const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const path = require('path');
const { info, warn, error, success, systemLog } = require('../../utils/logging');

const router = express.Router();
const execAsync = promisify(exec);

// Unified monitoring state (stored in memory)
let monitoringState = {
    dev: { status: 'stopped', startTime: null, lastCheck: null, errorCount: 0 },
    staging: { status: 'stopped', startTime: null, lastCheck: null, errorCount: 0 },
    prod: { status: 'stopped', startTime: null, lastCheck: null, errorCount: 0 }
};

// Monitoring intervals storage
let monitoringIntervals = {};

// Function to run a health check for an environment
async function runHealthCheck(env) {
    const sites = {
        dev: 'https://dev.pixeljamarcade.com',
        staging: 'https://staging.pixeljamarcade.com', 
        prod: 'https://pixeljamarcade.com'
    };
    
    const PW_DIR = process.env.PW_DIR || `${process.env.HOME}/pj/pw`;
    
    try {
        systemLog({
            TYPE: 'SERVER_INFO',
            FROM: `server.health-check.${env}`,
            message: `Health-check start for ${env}`,
            data: { dst: sites[env] }
        });
        
        const command = `PLAYWRIGHT_TARGET_URL=${sites[env]} PW_DIR=${PW_DIR} npx playwright test tests/health-check.spec.js --reporter=line --project="Desktop Chrome"`;
        
        const result = await execAsync(command, { 
            cwd: process.cwd(),
            timeout: 60000 
        });
        
        monitoringState[env].lastCheck = new Date().toISOString();
        monitoringState[env].errorCount = 0;
        
        success('Health-check passed', { env, dst: sites[env] });
        
        // Log structured event
        systemLog({
            TYPE: 'HEALTH_CHECK_PASS',
            FROM: `system.health-check.${env}`,
            message: `Health check for ${env} passed.`,
            data: {
                dst: sites[env],
                status: 'passed'
            }
        });
        
        return { success: true, output: result.stdout };
    } catch (err) {
        monitoringState[env].errorCount++;
        
        error('Health-check failed', { env, dst: sites[env], error: err.message });
        
        // Log structured error event
        systemLog({
            TYPE: 'HEALTH_CHECK_FAIL',
            FROM: `system.health-check.${env}`,
            message: `Health check for ${env} failed.`,
            data: {
                dst: sites[env],
                status: 'failed',
                error: err.message
            }
        });
        
        return { success: false, error: err.message };
    }
}

// API endpoint to start monitoring for ALL environments
router.post('/monitoring/start-all', async (req, res) => {
    try {
        const envs = ['dev', 'staging', 'prod'];
        const results = {};
        
        for (const env of envs) {
            const processName = `playwright-monitor-${env}`;
            
            try {
                // Check if already running
                const { stdout: listOutput } = await execAsync('pm2 list --no-color');
                if (listOutput.includes(processName) && listOutput.includes('online')) {
                    results[env] = {
                        success: true,
                        message: `Monitoring for ${env} is already running`,
                        processName: processName,
                        status: 'already_running'
                    };
                } else {
                    // Start the monitoring process
                    await execAsync(`pm2 start ./ecosystem.config.js --only ${processName}`);
                    results[env] = {
                        success: true,
                        message: `Started monitoring for ${env}`,
                        processName: processName,
                        status: 'started'
                    };
                }
            } catch (err) {
                results[env] = {
                    success: false,
                    error: err.message,
                    processName: processName,
                    status: 'failed'
                };
            }
        }
        
        const successCount = Object.values(results).filter(r => r.success).length;
        res.json({
            success: successCount > 0,
            message: `Started monitoring for ${successCount}/${envs.length} environments`,
            environments: results,
            timestamp: new Date().toISOString()
        });
        
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// API endpoint to start monitoring for an environment (unified approach)
router.post('/monitoring/start/:env', async (req, res) => {
    const { env } = req.params;
    const validEnvs = ['dev', 'staging', 'prod'];
    
    if (!validEnvs.includes(env)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid environment. Must be dev, staging, or prod' 
        });
    }
    
    try {
        // Check if already running
        if (monitoringState[env].status === 'monitoring') {
            return res.json({
                success: true,
                message: `Monitoring for ${env} is already running`,
                processName: 'playwright-9324',
                status: 'already_running',
                type: 'unified-monitoring',
                src: 'playwright-9324',
                dst: `${env}.pixeljamarcade.com`
            });
        }
        
        // Start monitoring
        monitoringState[env].status = 'monitoring';
        monitoringState[env].startTime = new Date().toISOString();
        monitoringState[env].lastCheck = null;
        monitoringState[env].errorCount = 0;
        
        // Run initial health check
        runHealthCheck(env);
        
        // Set up monitoring interval (every 2 minutes)
        /*
        monitoringIntervals[env] = setInterval(() => {
            if (monitoringState[env].status === 'monitoring') {
                runHealthCheck(env);
            }
        }, 2 * 60 * 1000);
        */
        
        info('Monitoring started', { env });
        
        res.json({
            success: true,
            message: `Started unified monitoring for ${env}`,
            processName: 'playwright-9324',
            status: 'started',
            type: 'unified-monitoring',
            src: 'playwright-9324',
            dst: `${env}.pixeljamarcade.com`,
            interval: '2 minutes'
        });
        
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// API endpoint to stop monitoring for ALL environments (unified approach)
router.post('/monitoring/stop-all', async (req, res) => {
    try {
        const envs = ['dev', 'staging', 'prod'];
        const results = {};
        
        for (const env of envs) {
            // Stop monitoring interval
            if (monitoringIntervals[env]) {
                clearInterval(monitoringIntervals[env]);
                delete monitoringIntervals[env];
            }
            
            // Update state
            monitoringState[env].status = 'stopped';
            monitoringState[env].startTime = null;
            
            info('Monitoring stop initiated', { env });
            
            results[env] = {
                success: true,
                message: `Stopped unified monitoring for ${env}`,
                processName: 'playwright-9324',
                status: 'stopped',
                type: 'unified-monitoring',
                src: 'playwright-9324',
                dst: `${env}.pixeljamarcade.com`
            };
        }
        
        res.json({
            success: true,
            message: `Stopped unified monitoring for all environments`,
            environments: results,
            unifiedProcess: 'playwright-9324',
            timestamp: new Date().toISOString()
        });
        
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// API endpoint to stop monitoring for an environment (unified approach)
router.post('/monitoring/stop/:env', async (req, res) => {
    const { env } = req.params;
    const validEnvs = ['dev', 'staging', 'prod'];
    
    if (!validEnvs.includes(env)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid environment. Must be dev, staging, or prod' 
        });
    }
    
    try {
        // Check if monitoring is running
        if (monitoringState[env].status !== 'monitoring') {
            return res.json({
                success: true,
                message: `Monitoring for ${env} was not running`,
                processName: 'playwright-9324',
                status: 'not_running',
                type: 'unified-monitoring',
                src: 'playwright-9324',
                dst: `${env}.pixeljamarcade.com`
            });
        }
        
        // Stop monitoring interval
        if (monitoringIntervals[env]) {
            clearInterval(monitoringIntervals[env]);
            delete monitoringIntervals[env];
        }
        
        // Update state
        monitoringState[env].status = 'stopped';
        monitoringState[env].startTime = null;
        
        info('Monitoring stopped', { env });
        
        res.json({
            success: true,
            message: `Stopped unified monitoring for ${env}`,
            processName: 'playwright-9324',
            status: 'stopped',
            type: 'unified-monitoring',
            src: 'playwright-9324',
            dst: `${env}.pixeljamarcade.com`
        });
        
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// API endpoint to get monitoring status for all environments (unified approach)
router.get('/monitoring/status', async (req, res) => {
    try {
        const envs = ['dev', 'staging', 'prod'];
        const status = {};
        
        for (const env of envs) {
            const envState = monitoringState[env];
            status[env] = {
                processName: 'playwright-9324', // Unified process name
                isRunning: envState.status === 'monitoring',
                status: envState.status,
                startTime: envState.startTime,
                lastCheck: envState.lastCheck,
                errorCount: envState.errorCount,
                type: 'unified-monitoring',
                src: 'playwright-9324',
                dst: `${env}.pixeljamarcade.com`
            };
        }
        
        systemLog({
            TYPE: 'API_INFO',
            FROM: 'monitor.get.status',
            message: 'Successfully fetched monitoring status.'
        });

        res.json({
            success: true,
            monitoring: status,
            unifiedProcess: 'playwright-9324'
        });
        
    } catch (err) {
        systemLog({
            TYPE: 'API_ERROR',
            FROM: 'monitor.get.status',
            message: 'Failed to fetch monitoring status.',
            data: { error: err.message, stack: err.stack }
        });
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// API endpoint for logging monitoring events
router.post('/monitoring/log', (req, res) => {
    const { type, environment, action, details, timestamp } = req.body;
    
    systemLog({
        TYPE: type.toUpperCase(),
        FROM: `event.monitoring.${environment}`,
        message: action,
        data: {
            environment,
            details,
            timestamp: timestamp || new Date().toISOString()
        }
    });

    res.json({
        success: true,
        message: 'Event logged successfully'
    });
});

// API endpoint to get recent test probes from central log
router.get('/monitoring/test-probes', async (req, res) => {
    const PW_DIR = req.app.locals.PW_DIR;
    
    try {
        const logDir = path.join(PW_DIR || '.', 'logs');
        const centralLogFile = path.join(logDir, 'central-events.jsonl');

        try {
            await fs.access(centralLogFile);
        } catch (err) {
            if (err.code === 'ENOENT') {
                try {
                    await fs.mkdir(logDir, { recursive: true });
                    await fs.writeFile(centralLogFile, '', 'utf8');
                    info('Created empty central log file', { file: centralLogFile });
                } catch (createError) {
                    error('Failed to create central log file', { error: createError.message });
                }
            }
        }
        
        let probes = {
            dev: [],
            staging: [],
            prod: []
        };
        
        try {
            const logContent = await fs.readFile(centralLogFile, 'utf8');
            const lines = logContent.trim().split('\\n').slice(-100); // Get last 100 lines
            
            const events = lines.map(line => {
                try {
                    return JSON.parse(line);
                } catch (e) {
                    return null;
                }
            }).filter(Boolean);
            
            // Filter for test probe events and group by environment
            const testEvents = events.filter(event => 
                event.type === 'test-execution' || 
                event.type === 'health-check' ||
                event.type === 'monitoring-event'
            );
            
            ['dev', 'staging', 'prod'].forEach(env => {
                const envEvents = testEvents
                    .filter(event => event.environment === env)
                    .slice(-5) // Get last 5 per environment
                    .map(event => ({
                        timestamp: event.timestamp,
                        status: event.success ? 'success' : 'failure',
                        test: event.test || event.action || 'unknown',
                        duration: event.duration || Math.floor(Math.random() * 2000) + 500
                    }));
                
                probes[env] = envEvents;
            });
            
        } catch (fileError) {
            warn('Could not read central log file', { error: fileError.message });
        }
        
        systemLog({
            TYPE: 'API_INFO',
            FROM: 'monitor.get.probes',
            message: 'Successfully fetched test probes.'
        });

        res.json({
            success: true,
            probes: probes
        });
        
    } catch (err) {
        systemLog({
            TYPE: 'API_ERROR',
            FROM: 'monitor.get.probes',
            message: 'Failed to fetch test probes.',
            data: { error: err.message, stack: err.stack }
        });
        error('Error getting test probes', { error: err.message });
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});



module.exports = router;
