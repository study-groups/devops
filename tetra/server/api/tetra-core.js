const express = require('express');
const { exec, spawn } = require('child_process');
const path = require('path');
const router = express.Router();

/**
 * Tetra Core API - Universal HTTP-to-Bash Execution Engine
 * Provides standardized execution and response handling for all Tetra modules
 */

class TetraExecutor {
    constructor(options = {}) {
        this.defaultTimeout = options.timeout || 30000;
        this.maxBuffer = options.maxBuffer || 1024 * 1024;
        this.tetraSrc = process.env.TETRA_SRC || path.join(process.env.HOME, 'src/devops/tetra');
    }

    // Core execution method for any Tetra module
    async execute(module, command, options = {}) {
        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            // Build the complete command with proper module loading
            const tetraCmd = `source ${this.tetraSrc}/bash/${module}/${module}.sh && ${command}`;

            exec(tetraCmd, {
                shell: '/bin/bash',
                env: { ...process.env, PATH: process.env.PATH },
                timeout: options.timeout || this.defaultTimeout,
                maxBuffer: options.maxBuffer || this.maxBuffer,
                cwd: options.cwd || process.cwd()
            }, (error, stdout, stderr) => {
                const executionTime = Date.now() - startTime;

                if (error) {
                    const errorInfo = this.classifyError(error, stderr, command);
                    reject({
                        success: false,
                        error: {
                            message: error.message,
                            ...errorInfo
                        },
                        stderr: stderr.trim(),
                        command: command,
                        module: module,
                        timestamp: new Date().toISOString(),
                        execution_time_ms: executionTime
                    });
                } else {
                    // Try to parse JSON output, fallback to structured text
                    try {
                        const jsonOutput = JSON.parse(stdout.trim());
                        resolve({
                            ...jsonOutput,
                            module: module,
                            command: command,
                            timestamp: new Date().toISOString(),
                            execution_time_ms: executionTime
                        });
                    } catch (e) {
                        resolve({
                            success: true,
                            output: stdout.trim(),
                            command: command,
                            module: module,
                            timestamp: new Date().toISOString(),
                            execution_time_ms: executionTime
                        });
                    }
                }
            });
        });
    }

    // Classify errors and provide suggestions
    classifyError(error, stderr, command) {
        const stderrLower = stderr.toLowerCase();

        if (stderrLower.includes('port') && stderrLower.includes('in use')) {
            return {
                code: 'PORT_CONFLICT',
                type: 'user_error',
                recoverable: true,
                suggestions: [
                    'Use tsm doctor kill <port>',
                    'Try different port with --port flag',
                    'Check for orphaned processes with tsm doctor orphans'
                ]
            };
        }

        if (stderrLower.includes('command not found')) {
            return {
                code: 'COMMAND_NOT_FOUND',
                type: 'user_error',
                recoverable: true,
                suggestions: [
                    'Check command spelling',
                    'Ensure executable is in PATH',
                    'Install required dependencies'
                ]
            };
        }

        if (stderrLower.includes('permission denied')) {
            return {
                code: 'PERMISSION_DENIED',
                type: 'user_error',
                recoverable: true,
                suggestions: [
                    'Check file permissions',
                    'Run with appropriate privileges',
                    'Ensure process has write access'
                ]
            };
        }

        if (stderrLower.includes('no such file')) {
            return {
                code: 'FILE_NOT_FOUND',
                type: 'user_error',
                recoverable: true,
                suggestions: [
                    'Check file path',
                    'Ensure file exists',
                    'Use absolute path if needed'
                ]
            };
        }

        if (error.killed && error.signal === 'SIGTERM') {
            return {
                code: 'TIMEOUT',
                type: 'system_error',
                recoverable: true,
                suggestions: [
                    'Command timed out',
                    'Try with longer timeout',
                    'Check system resources'
                ]
            };
        }

        return {
            code: 'UNKNOWN_ERROR',
            type: 'system_error',
            recoverable: false,
            suggestions: [
                'Check system logs',
                'Contact administrator',
                'Try again later'
            ]
        };
    }

    // Health check for a specific module
    async checkModuleHealth(module) {
        try {
            const result = await this.execute(module, `${module} --version 2>/dev/null || echo "available"`);
            return {
                module: module,
                status: 'healthy',
                available: true,
                response_time_ms: result.execution_time_ms
            };
        } catch (error) {
            return {
                module: module,
                status: 'unhealthy',
                available: false,
                error: error.error?.message || 'Unknown error'
            };
        }
    }

    // Get system resource information
    async getSystemResources() {
        try {
            const [diskResult, memResult, loadResult] = await Promise.allSettled([
                this.execute('utils', 'df -h | head -2'),
                this.execute('utils', 'free -h'),
                this.execute('utils', 'uptime')
            ]);

            return {
                disk: diskResult.status === 'fulfilled' ? diskResult.value.output : 'unavailable',
                memory: memResult.status === 'fulfilled' ? memResult.value.output : 'unavailable',
                load: loadResult.status === 'fulfilled' ? loadResult.value.output : 'unavailable',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                error: 'Failed to get system resources',
                timestamp: new Date().toISOString()
            };
        }
    }
}

// Create singleton instance
const tetraExecutor = new TetraExecutor();

// === HEALTH CHECK ENDPOINTS ===

// Basic ping endpoint
router.get('/ping', (req, res) => {
    res.json({
        status: 'ok',
        service: 'tetra-api',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.TETRA_VERSION || 'development',
        node_version: process.version
    });
});

// Deep health check
router.get('/health/deep', async (req, res) => {
    const startTime = Date.now();

    try {
        const [moduleChecks, systemResources] = await Promise.allSettled([
            Promise.allSettled([
                tetraExecutor.checkModuleHealth('tsm'),
                tetraExecutor.checkModuleHealth('utils'),
                tetraExecutor.checkModuleHealth('env')
            ]),
            tetraExecutor.getSystemResources()
        ]);

        const modules = moduleChecks.status === 'fulfilled' ?
            moduleChecks.value.map(check => check.status === 'fulfilled' ? check.value : { error: check.reason }) :
            [];

        const allModulesHealthy = modules.every(module => module.status === 'healthy');
        const responseTime = Date.now() - startTime;

        const response = {
            status: allModulesHealthy ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            response_time_ms: responseTime,
            modules: modules.reduce((acc, module) => {
                acc[module.module] = {
                    status: module.status,
                    available: module.available,
                    response_time_ms: module.response_time_ms,
                    error: module.error
                };
                return acc;
            }, {}),
            system: systemResources.status === 'fulfilled' ? systemResources.value : { error: 'unavailable' }
        };

        res.status(allModulesHealthy ? 200 : 503).json(response);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Module availability check
router.get('/health/modules', async (req, res) => {
    const modules = ['tsm', 'utils', 'env', 'org', 'deploy'];

    try {
        const moduleChecks = await Promise.allSettled(
            modules.map(module => tetraExecutor.checkModuleHealth(module))
        );

        const results = moduleChecks.reduce((acc, check, index) => {
            const module = modules[index];
            acc[module] = check.status === 'fulfilled' ? check.value : {
                module: module,
                status: 'error',
                available: false,
                error: check.reason?.message || 'Health check failed'
            };
            return acc;
        }, {});

        res.json({
            status: 'ok',
            modules: results,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// === UNIVERSAL MODULE EXECUTION ===

// Execute any command on any module
router.post('/execute/:module', async (req, res) => {
    const { module } = req.params;
    const { command, options = {} } = req.body;

    if (!command) {
        return res.status(400).json({
            success: false,
            error: {
                message: 'Command is required',
                code: 'MISSING_COMMAND'
            }
        });
    }

    try {
        // Sanitize command to prevent injection
        const sanitizedCommand = command.replace(/[;&|`$()]/g, '');
        const result = await tetraExecutor.execute(module, sanitizedCommand, options);
        res.json(result);
    } catch (error) {
        res.status(500).json(error);
    }
});

// === REAL-TIME MONITORING ===

// Server-Sent Events for real-time monitoring
router.get('/monitor/events', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const sendEvent = (type, data) => {
        res.write(`event: ${type}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial connection event
    sendEvent('connected', {
        message: 'Connected to Tetra monitoring',
        timestamp: new Date().toISOString()
    });

    // Monitor TSM processes every 10 seconds
    const processMonitor = setInterval(async () => {
        try {
            const processes = await tetraExecutor.execute('tsm', 'tsm list --json');
            sendEvent('processes', {
                count: processes.data?.count || 0,
                processes: processes.data?.processes || [],
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            sendEvent('error', {
                module: 'tsm',
                error: error.error?.message || 'Failed to get process list',
                timestamp: new Date().toISOString()
            });
        }
    }, 10000);

    // Monitor system resources every 30 seconds
    const resourceMonitor = setInterval(async () => {
        try {
            const resources = await tetraExecutor.getSystemResources();
            sendEvent('resources', resources);
        } catch (error) {
            sendEvent('error', {
                module: 'system',
                error: 'Failed to get system resources',
                timestamp: new Date().toISOString()
            });
        }
    }, 30000);

    // Health check every 60 seconds
    const healthMonitor = setInterval(async () => {
        try {
            const health = await tetraExecutor.checkModuleHealth('tsm');
            sendEvent('health', health);
        } catch (error) {
            sendEvent('error', {
                module: 'health',
                error: 'Health check failed',
                timestamp: new Date().toISOString()
            });
        }
    }, 60000);

    // Cleanup on client disconnect
    req.on('close', () => {
        clearInterval(processMonitor);
        clearInterval(resourceMonitor);
        clearInterval(healthMonitor);
    });
});

// === DASHBOARD VIEWS ===

const fs = require('fs');

// Auto-discover iframe views from dashboard directory
router.get('/views', (req, res) => {
    const dashboardDir = path.join(__dirname, '../../dashboard');

    try {
        const files = fs.readdirSync(dashboardDir);
        const views = files
            .filter(f => f.endsWith('.iframe.html'))
            .map(f => {
                const id = f.replace('.iframe.html', '');
                // Capitalize first letter for label
                const label = id.charAt(0).toUpperCase() + id.slice(1);
                return { id, src: f, label };
            })
            .sort((a, b) => a.label.localeCompare(b.label));

        res.json({
            views,
            count: views.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: 'Failed to discover views',
            message: error.message
        });
    }
});

// Export both the router and the executor for use in other modules
module.exports = { router, tetraExecutor };