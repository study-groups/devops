# Tetra HTTP-to-Bash API Architecture

## Overview

A comprehensive REST API that maps all Tetra bash modules to HTTP endpoints, enabling web interface control while preserving the power and flexibility of the bash-based system.

## Core Architecture Pattern

### HTTP-to-Bash Execution Engine

```javascript
const executeTetraCommand = (module, command, options = {}) => {
    return new Promise((resolve, reject) => {
        const tetraCmd = `source ${process.env.TETRA_SRC}/bash/${module}/${module}.sh && ${command}`;

        exec(tetraCmd, {
            shell: '/bin/bash',
            env: { ...process.env, PATH: process.env.PATH },
            timeout: options.timeout || 30000,
            maxBuffer: options.maxBuffer || 1024 * 1024,
            cwd: options.cwd || process.cwd()
        }, (error, stdout, stderr) => {
            if (error) {
                reject({
                    success: false,
                    error: error.message,
                    stderr: stderr.trim(),
                    command: command,
                    module: module,
                    timestamp: new Date().toISOString()
                });
            } else {
                // Try JSON first, fallback to structured text
                try {
                    const jsonOutput = JSON.parse(stdout.trim());
                    resolve({
                        ...jsonOutput,
                        module: module,
                        timestamp: new Date().toISOString()
                    });
                } catch (e) {
                    resolve({
                        success: true,
                        output: stdout.trim(),
                        command: command,
                        module: module,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        });
    });
};
```

## Module-to-API Mappings

### 1. TSM (Service Manager) - `/api/tsm/`

**Process Management:**
- `GET /processes` → `tsm list --json`
- `POST /processes` → `tsm start --json <command>`
- `GET /processes/:id` → `tsm info :id`
- `DELETE /processes/:id` → `tsm delete :id`
- `PUT /processes/:id/restart` → `tsm restart :id`
- `GET /processes/:id/logs` → `tsm logs :id`

**Diagnostics:**
- `POST /doctor/validate` → `tsm doctor validate`
- `GET /doctor/orphans` → `tsm doctor orphans --json`
- `POST /doctor/clean` → `tsm doctor clean`
- `GET /doctor/ports` → `tsm doctor scan`

### 2. Environment Management - `/api/env/`

**Environment Operations:**
- `GET /environments` → `tetra env list --json`
- `POST /environments/:name/init` → `tetra env init :name`
- `GET /environments/:name/validate` → `tetra env validate :name --json`
- `POST /environments/:name/promote` → `tetra env promote :name`
- `GET /environments/:name/diff` → `tetra env diff :name --json`

### 3. TDash (Dashboard) - `/api/tdash/`

**Dashboard Control:**
- `GET /status` → `tdash status --json`
- `POST /mode/:mode` → `tdash switch :mode`
- `GET /modes` → `tdash modes --json`
- `POST /refresh` → `tdash refresh`

### 4. Organization Management - `/api/org/`

**Organization Operations:**
- `GET /organizations` → `tetra org list --json`
- `POST /organizations/:name` → `tetra org create :name`
- `PUT /organizations/:name/switch` → `tetra org switch :name`
- `GET /organizations/:name/config` → `tetra org config :name --json`

### 5. Deployment - `/api/deploy/`

**Deployment Operations:**
- `POST /deploy/:env` → `tetra deploy :env --json`
- `GET /deploy/:env/status` → `tetra deploy status :env --json`
- `POST /deploy/:env/rollback` → `tetra deploy rollback :env`
- `GET /deploy/history` → `tetra deploy history --json`

## Health Check & Monitoring Endpoints

### System Health - `/api/health/`

```javascript
// GET /api/health/ping
router.get('/ping', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.TETRA_VERSION || 'unknown'
    });
});

// GET /api/health/deep
router.get('/deep', async (req, res) => {
    const checks = await Promise.allSettled([
        executeTetraCommand('tsm', 'tsm list --json'),
        executeTetraCommand('utils', 'tetra env list --json'),
        checkDiskSpace(),
        checkMemoryUsage(),
        checkProcessCount()
    ]);

    const results = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        checks: {
            tsm: checks[0].status === 'fulfilled',
            env: checks[1].status === 'fulfilled',
            disk: checks[2].value,
            memory: checks[3].value,
            processes: checks[4].value
        }
    };

    const isHealthy = Object.values(results.checks).every(check =>
        typeof check === 'boolean' ? check : check.status === 'ok'
    );

    res.status(isHealthy ? 200 : 503).json({
        ...results,
        status: isHealthy ? 'healthy' : 'unhealthy'
    });
});

// GET /api/health/modules
router.get('/modules', async (req, res) => {
    const modules = ['tsm', 'env', 'org', 'deploy', 'tdash'];
    const moduleChecks = await Promise.allSettled(
        modules.map(module =>
            executeTetraCommand(module, `${module} --version || echo "available"`)
        )
    );

    const results = modules.reduce((acc, module, index) => {
        acc[module] = {
            available: moduleChecks[index].status === 'fulfilled',
            error: moduleChecks[index].reason?.error || null
        };
        return acc;
    }, {});

    res.json({
        status: 'ok',
        modules: results,
        timestamp: new Date().toISOString()
    });
});
```

### Real-time Monitoring - `/api/monitor/`

```javascript
// Server-Sent Events for real-time updates
router.get('/events', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    const sendEvent = (type, data) => {
        res.write(`event: ${type}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial status
    sendEvent('status', { message: 'Connected to Tetra monitor' });

    // Monitor TSM processes every 5 seconds
    const processMonitor = setInterval(async () => {
        try {
            const processes = await executeTetraCommand('tsm', 'tsm list --json');
            sendEvent('processes', processes);
        } catch (error) {
            sendEvent('error', { module: 'tsm', error: error.message });
        }
    }, 5000);

    // Monitor system resources every 10 seconds
    const resourceMonitor = setInterval(async () => {
        try {
            const resources = await getSystemResources();
            sendEvent('resources', resources);
        } catch (error) {
            sendEvent('error', { module: 'system', error: error.message });
        }
    }, 10000);

    req.on('close', () => {
        clearInterval(processMonitor);
        clearInterval(resourceMonitor);
    });
});
```

## Error Handling & Response Patterns

### Standardized Response Format

```javascript
// Success Response
{
    "success": true,
    "data": { ... },
    "module": "tsm",
    "command": "list --json",
    "timestamp": "2025-09-21T...",
    "execution_time_ms": 234
}

// Error Response
{
    "success": false,
    "error": {
        "message": "Port 4000 already in use",
        "code": "PORT_CONFLICT",
        "details": "PID 1234 (node server.js)",
        "suggestions": [
            "tsm doctor kill 4000",
            "Use different port with --port flag"
        ]
    },
    "module": "tsm",
    "command": "start server.js --port 4000",
    "timestamp": "2025-09-21T...",
    "stderr": "..."
}
```

### Error Classification

```javascript
const classifyError = (error, stderr, command) => {
    if (stderr.includes('port.*in use')) {
        return {
            code: 'PORT_CONFLICT',
            type: 'user_error',
            recoverable: true,
            suggestions: ['Use tsm doctor kill <port>', 'Try different port']
        };
    }

    if (stderr.includes('command not found')) {
        return {
            code: 'COMMAND_NOT_FOUND',
            type: 'user_error',
            recoverable: true,
            suggestions: ['Check command spelling', 'Ensure executable is in PATH']
        };
    }

    if (stderr.includes('permission denied')) {
        return {
            code: 'PERMISSION_DENIED',
            type: 'user_error',
            recoverable: true,
            suggestions: ['Check file permissions', 'Run with appropriate privileges']
        };
    }

    return {
        code: 'UNKNOWN_ERROR',
        type: 'system_error',
        recoverable: false,
        suggestions: ['Check system logs', 'Contact administrator']
    };
};
```

## WebSocket Support for Interactive Commands

```javascript
// WebSocket endpoint for interactive commands like REPL
app.ws('/api/repl', (ws, req) => {
    const repl = spawn('bash', ['-c', `source ${process.env.TETRA_SRC}/bash/tsm/tsm_repl.sh && tsm_repl_main`], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env
    });

    ws.on('message', (message) => {
        const command = JSON.parse(message);
        repl.stdin.write(command.input + '\n');
    });

    repl.stdout.on('data', (data) => {
        ws.send(JSON.stringify({
            type: 'output',
            data: data.toString()
        }));
    });

    repl.stderr.on('data', (data) => {
        ws.send(JSON.stringify({
            type: 'error',
            data: data.toString()
        }));
    });

    ws.on('close', () => {
        repl.kill();
    });
});
```

## Authentication & Security

### API Key Authentication

```javascript
const authenticateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;

    if (!apiKey || !isValidApiKey(apiKey)) {
        return res.status(401).json({
            success: false,
            error: {
                message: 'Invalid or missing API key',
                code: 'UNAUTHORIZED'
            }
        });
    }

    next();
};

// Apply to sensitive endpoints
router.use('/processes', authenticateApiKey);
router.use('/deploy', authenticateApiKey);
```

### Command Sanitization

```javascript
const sanitizeCommand = (command) => {
    // Prevent command injection
    const dangerous = [';', '&&', '||', '|', '`', '$', '(', ')', '<', '>', '&'];
    const hasDangerous = dangerous.some(char => command.includes(char));

    if (hasDangerous) {
        throw new Error('Command contains potentially dangerous characters');
    }

    return command.trim();
};
```

## Rate Limiting & Resource Management

```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: {
            message: 'Too many requests, please try again later',
            code: 'RATE_LIMIT_EXCEEDED'
        }
    }
});

const heavyOperationsLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // limit heavy operations
    message: {
        success: false,
        error: {
            message: 'Heavy operation rate limit exceeded',
            code: 'HEAVY_OPERATION_LIMIT'
        }
    }
});

router.use('/api/', apiLimiter);
router.use('/api/deploy/', heavyOperationsLimiter);
router.use('/api/doctor/', heavyOperationsLimiter);
```

This architecture provides:

1. **Unified Pattern**: All Tetra modules follow the same HTTP-to-Bash execution pattern
2. **Rich Monitoring**: Health checks, real-time events, and deep system insights
3. **Error Handling**: Classified errors with actionable suggestions
4. **Security**: Authentication, rate limiting, and command sanitization
5. **Real-time Features**: WebSocket support for interactive commands
6. **Scalability**: Modular design that easily extends to new Tetra modules

The ping/pong and doctor-like checks provide comprehensive system health monitoring while maintaining the power and flexibility of the underlying bash system.