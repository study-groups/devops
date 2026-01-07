const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const log = require('../../utils/logging');
const { getDirectoryStats, getProcessStatus } = require('../../utils/stats');
const { getEnvironmentData, getDirectoryData } = require('../../utils/filesystem');
const { getSystemHealthData, getProcessInfoData } = require('../../utils/system');
const { getDirectoryInfo, formatBytes, getLastModified } = require('./utils');

const router = express.Router();
const execAsync = promisify(exec);

// System command execution endpoint for Command Runner
router.post('/run', async (req, res) => {
    try {
        const { command, type } = req.body;
        
        if (type !== 'system') {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid command type. Expected "system".' 
            });
        }

        if (!command || typeof command !== 'string') {
            return res.status(400).json({ 
                success: false, 
                error: 'Command is required and must be a string.' 
            });
        }

        // Security: Only allow safe, read-only commands
        const safeCommands = [
            'pwd', 'df -h', 'free -h', 'uptime', 'whoami', 'date',
            'ps aux', 'env', 'node --version', 'npm --version',
            'git status', 'git branch', 'ip addr show', 'ifconfig'
        ];

        const isCommandSafe = safeCommands.some(safe => 
            command.startsWith(safe) || 
            command.includes('grep') ||
            command.includes('head') ||
            command.includes('sort')
        );

        if (!isCommandSafe) {
            return res.status(403).json({ 
                success: false, 
                error: 'Command not allowed. Only safe, read-only system commands are permitted.' 
            });
        }

        log.log(`[System API] Executing command: ${command}`);

        // Execute the command with timeout
        const { stdout, stderr } = await execAsync(command, { 
            timeout: 10000, // 10 second timeout
            maxBuffer: 1024 * 1024 // 1MB buffer
        });

        const result = {
            success: true,
            command,
            type: 'system',
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            timestamp: new Date().toISOString(),
            executionTime: Date.now()
        };

        res.json(result);

    } catch (error) {
        log.error('[System API] Command execution error:', error);
        
        const result = {
            success: false,
            command: req.body.command,
            type: 'system',
            error: error.message,
            stderr: error.stderr || '',
            timestamp: new Date().toISOString()
        };

        res.status(500).json(result);
    }
});

router.post('/log-event', (req, res) => {
    try {
        const { type, level, from, message, data } = req.body;

        if (!type || !from || !message) {
            log.recordEvent({
                Type: 'API',
                Level: 'WARN',
                From: 'system.log-event',
                Message: 'Received a malformed log entry.',
                Data: {
                    receivedEntry: req.body,
                    missingFields: ['type', 'from', 'message'].filter(field => !req.body[field])
                }
            });
        }

        log.recordEvent({
            Type: type || 'unknown',
            Level: level || 'info',
            From: from || 'unknown',
            Message: message || 'Malformed log entry received.',
            Data: data || {}
        });

        res.status(202).json({ success: true, message: 'Log event accepted.' });
    } catch (e) {
        log.recordEvent({
            Type: 'API',
            Level: 'ERROR',
            From: 'system.log-event',
            Message: 'Failed to process log event',
            Data: {
                error: e.message,
                requestBody: req.body
            }
        });
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// Consolidated System API endpoint
router.get('/', async (req, res) => {
    const PW_DIR = req.app.locals.PW_DIR;
    const PW_SRC = req.app.locals.PW_SRC;

    try {
        // 1. Environment Data
        const environmentData = getEnvironmentData();
        const networkInterfaces = require('os').networkInterfaces();
        const ipInfo = networkInterfaces?.eth0?.[0]?.address || 
                       networkInterfaces?.en0?.[0]?.address || 
                       'localhost';

        const environment = {
            ...environmentData,
            PW_DIR,
            PW_SRC,
            PROCESS_PWD: process.cwd(),
            SERVER_INFO: `Node.js ${process.version} on ${require('os').platform()}`,
            USER_INFO: process.env.USER || process.env.USERNAME || 'Unknown',
            IP_INFO: ipInfo
        };

        // 2. System Info
        const systemInfo = {
            server: {
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch(),
                nodeVersion: process.version
            },
            memory: {
                total: Math.round(os.totalmem() / 1024 / 1024),
                free: Math.round(os.freemem() / 1024 / 1024),
                used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024)
            },
            uptime: {
                system: Math.round(os.uptime()),
                process: Math.round(process.uptime())
            },
            load: os.loadavg()
        };

        // 3. Directory Stats
        const directories = {
            'logs/': await getDirectoryStats(path.join(PW_DIR, 'logs')),
            'screenshots/': await getDirectoryStats(path.join(PW_DIR, 'screenshots')),
            'reports/': await getDirectoryStats(path.join(PW_DIR, 'reports')),
            'test-results/': await getDirectoryStats(path.join(PW_DIR, 'test-results'))
        };

        // 4. Processes
        const processes = await getProcessStatus();

        // Combine all data into a single response
        res.json({
            environment,
            systemInfo,
            directories,
            processes,
            systemHealth: getSystemHealthData(),
            processInfo: getProcessInfoData(),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        log.error('Error fetching consolidated system data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve system data.',
            details: error.message
        });
    }
});

// Simple Environment API for dashboard compatibility
router.get('/environment', (req, res) => {
    const PW_DIR = req.app.locals.PW_DIR;
    const PW_SRC = req.app.locals.PW_SRC;
    
    const environmentData = getEnvironmentData();
    
    // Determine IP address, preferring localhost
    const networkInterfaces = require('os').networkInterfaces();
    const ipInfo = networkInterfaces?.eth0?.[0]?.address || 
                   networkInterfaces?.en0?.[0]?.address || 
                   'localhost';
    
    res.json({
        ...environmentData,
        PW_DIR,
        PW_SRC,
        PROCESS_PWD: process.cwd(),
        SERVER_INFO: `Node.js ${process.version} on ${require('os').platform()}`,
        USER_INFO: process.env.USER || process.env.USERNAME || 'Unknown',
        IP_INFO: ipInfo
    });
});

// Alias route for /environment
router.get('/environment', (req, res) => {
    const PW_DIR = req.app.locals.PW_DIR;
    const PW_SRC = req.app.locals.PW_SRC;
    
    const environmentData = getEnvironmentData();
    
    // Determine IP address, preferring localhost
    const networkInterfaces = require('os').networkInterfaces();
    const ipInfo = networkInterfaces?.eth0?.[0]?.address || 
                   networkInterfaces?.en0?.[0]?.address || 
                   'localhost';
    
    res.json({
        ...environmentData,
        PW_DIR,
        PW_SRC,
        PROCESS_PWD: process.cwd(),
        SERVER_INFO: `Node.js ${process.version} on ${require('os').platform()}`,
        USER_INFO: process.env.USER || process.env.USERNAME || 'Unknown',
        IP_INFO: ipInfo
    });
});

// Comprehensive Filesystem and Environment API for Playwright
router.get('/filesystem', async (req, res) => {
    try {
        const PW_DIR = req.app.locals.PW_DIR;
        const PW_SRC = req.app.locals.PW_SRC;
        
        // Get test suites from tests directory
        let testSuites = [];
        try {
            const testsDir = path.join(PW_SRC, 'tests');
            const files = await fs.readdir(testsDir);
            testSuites = files.filter(file => file.endsWith('.spec.js') || file.endsWith('.js'));
        } catch (error) {
            log.warn({ type: 'api', level: 'warn', from: 'system.filesystem', message: `Could not read test suites from tests directory: ${error.message}` });
            testSuites = [];
        }
        
        // Determine IP address, preferring localhost
        const networkInterfaces = require('os').networkInterfaces();
        const ipInfo = networkInterfaces?.eth0?.[0]?.address || 
                       networkInterfaces?.en0?.[0]?.address || 
                       'localhost';
        
        const data = {
            PW_DIR: PW_DIR,
            PW_SRC: PW_SRC,
            PD_DIR: process.env.PD_DIR || 'Not Set',
            PROCESS_PWD: process.cwd(),
            SERVER_INFO: `Node.js ${process.version} on ${require('os').platform()}`,
            USER_INFO: process.env.USER || process.env.USERNAME || 'Unknown',
            IP_INFO: ipInfo,
            directories: {
                'Playwright Source (PW_SRC)': {
                    path: PW_SRC,
                    testSuites: testSuites
                }
            },
            timestamp: new Date().toISOString()
        };

        // Add optional data with error handling
        try {
            data.environment = getEnvironmentData();
        } catch (err) {
            log.warn({ type: 'api', level: 'warn', from: 'system.filesystem', message: 'Failed to get environment data:', data: { error: err.message } });
        }

        try {
            data.systemHealth = getSystemHealthData();
        } catch (err) {
            log.warn({ type: 'api', level: 'warn', from: 'system.filesystem', message: 'Failed to get system health data:', data: { error: err.message } });
        }

        try {
            data.processInfo = getProcessInfoData();
        } catch (err) {
            log.warn({ type: 'api', level: 'warn', from: 'system.filesystem', message: 'Failed to get process info data:', data: { error: err.message } });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get system information for monitoring
router.get('/info', async (req, res) => {
    try {
        const systemInfo = {
            server: {
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch(),
                nodeVersion: process.version
            },
            memory: {
                total: Math.round(os.totalmem() / 1024 / 1024),
                free: Math.round(os.freemem() / 1024 / 1024),
                used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024)
            },
            uptime: {
                system: Math.round(os.uptime()),
                process: Math.round(process.uptime())
            },
            load: os.loadavg()
        };
        
        res.json(systemInfo);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get system processes for monitoring
router.get('/processes', async (req, res) => {
    try {
        // Get processes related to testing
        const { stdout } = await execAsync('ps aux | grep -E "(playwright|npx|node.*test)" | grep -v grep || echo "No processes found"');
        
        const processes = stdout.split('\n')
            .filter(line => line.trim() && !line.includes('grep'))
            .map(line => {
                const parts = line.trim().split(/\s+/);
                return {
                    pid: parts[1],
                    cpu: parts[2],
                    memory: parts[3],
                    command: parts.slice(10).join(' ')
                };
            });
        
        res.json(processes);
    } catch (error) {
        log.error({ type: 'api', level: 'error', from: 'system.processes', message: 'Error getting system processes', data: { error: error.message } });
        res.json([]); // Return empty array if we can't get processes
    }
});

// API endpoint to get comprehensive directory statistics
router.get('/directory-stats/:env', async (req, res) => {
    const { env } = req.params;
    const PW_DIR = req.app.locals.PW_DIR;
    
    try {
        let directories;
        
        if (env === 'all') {
            // Standard Playwright directories + PJA log directory (shows even if they don't exist)
            directories = [
                {
                    name: 'logs',
                    path: path.join(PW_DIR, 'logs'),
                    description: 'System activity logs, test execution logs, and monitoring events',
                    type: 'Logs',
                    icon: '📄'
                },
                {
                    name: 'test-results',
                    path: path.join(PW_DIR, 'test-results'),
                    description: 'Raw Playwright test result files and execution artifacts',
                    type: 'Results',
                    icon: '📊'
                },
                {
                    name: 'reports',
                    path: path.join(PW_DIR, 'reports'),
                    description: 'Generated HTML test reports with interactive results',
                    type: 'Reports',
                    icon: '📈'
                },
                {
                    name: 'screenshots',
                    path: path.join(PW_DIR, 'screenshots'),
                    description: 'Test failure screenshots and visual regression captures',
                    type: 'Media',
                    icon: '📸'
                },
                {
                    name: 'downloads',
                    path: path.join(PW_DIR, 'downloads'),
                    description: 'Files downloaded during test execution',
                    type: 'Media',
                    icon: '📥'
                },
                {
                    name: 'pw_data',
                    path: path.join(PW_DIR, 'pw_data'),
                    description: 'Central database, configuration files, and system metadata',
                    type: 'Database',
                    icon: '🗃️'
                }
            ];
        } else {
            // Simple directory list for backward compatibility
            directories = [
                {
                    name: 'logs',
                    path: path.join(PW_DIR, 'logs'),
                    description: 'Test execution logs and events'
                },
                {
                    name: 'test-results',
                    path: path.join(PW_DIR, 'test-results'),
                    description: 'Playwright test result files'
                },
                {
                    name: 'reports',
                    path: path.join(PW_DIR, 'reports'),
                    description: 'HTML test reports'
                },
                {
                    name: 'screenshots',
                    path: path.join(PW_DIR, 'screenshots'),
                    description: 'Test failure screenshots'
                },
                {
                    name: 'pw_data',
                    path: path.join(PW_DIR, 'pw_data'),
                    description: 'Central database and data files'
                }
            ];
        }
        
        const directoryStats = [];
        
        for (const dir of directories) {
            try {
                const stats = await getDirectoryInfo(dir.path);
                const lastModified = await getLastModified(dir.path);
                let logFiles = [];

                if (dir.name === 'logs') {
                    try {
                        const files = await fs.readdir(dir.path);
                        logFiles = files.filter(file => file.endsWith('.log') || file.endsWith('.jsonl'));
                    } catch (error) {
                        // Ignore if logs directory doesn't exist
                    }
                }
                
                directoryStats.push({
                    path: dir.name + '/',
                    fullPath: dir.path,
                    files: stats.files,
                    size: stats.sizeFormatted,
                    sizeBytes: stats.sizeBytes,
                    description: dir.description,
                    type: dir.type || 'Data',
                    icon: dir.icon || '📁',
                    lastModified: lastModified,
                    logFiles: logFiles.length > 0 ? logFiles : undefined
                });
            } catch (error) {
                // Directory doesn't exist or can't be read - show it anyway with 0 stats
                directoryStats.push({
                    path: dir.name + '/',
                    fullPath: dir.path,
                    files: 0,
                    size: '0 B',
                    sizeBytes: 0,
                    description: dir.description + ' (not found)',
                    type: dir.type || 'Data',
                    icon: dir.icon || '📁',
                    lastModified: 'Directory not found'
                });
            }
        }
        
        res.json({
            success: true,
            environment: env,
            directories: directoryStats,
            systemHealth: getSystemHealthData(),
            processInfo: getProcessInfoData(),
            pwDir: PW_DIR,  // Add PW_DIR for admin-client.js compatibility
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        log.error('Error getting directory stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/nginx-logs', async (req, res) => {
    const { log, lines = 100 } = req.query;
    const allowedLogs = ['access.log', 'dev.pixeljamarcade.com_access.log'];

    if (!log || !allowedLogs.includes(log)) {
        return res.status(400).json({ error: 'Invalid log file specified.' });
    }

    const logPath = path.join('/var/log/nginx', log);

    try {
        const { stdout } = await execAsync(`tail -n ${lines} ${logPath}`);
        res.send(stdout);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read log file.', details: error.message });
    }
});

module.exports = router;
