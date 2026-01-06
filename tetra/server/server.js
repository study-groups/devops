#!/usr/bin/env node

const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Server } = require('socket.io');
const GamepadHandler = require('./gamepad-handler');
const PatrolLoop = require('./patrol');

// Environment configuration
const TETRA_ENV = process.env.TETRA_ENV || 'local';
const PORT = process.env.PORT || 4444;
const TETRA_DIR = process.env.TETRA_DIR;
const TETRA_SRC = process.env.TETRA_SRC;

// JWT secret for session tokens (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const TOKEN_EXPIRY = '30m'; // 30 minutes

// In-memory store for SSH keys (in production, use Redis or database)
const sshKeyStore = new Map();

console.log(`🚀 Starting Tetra Server (${TETRA_ENV}) on port ${PORT}`);

// Express app setup
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
// Serve dashboard from source (for development) or TETRA_DIR (for deployment)
const dashboardPath = path.join(TETRA_SRC, 'dashboard');
app.use(express.static(dashboardPath));
console.log(`📁 Serving dashboard from: ${dashboardPath}`);

// Serve devpages client
const devpagesPath = path.join(TETRA_SRC, '../devpages/client');
const devpagesRoot = path.join(TETRA_SRC, '../devpages');
app.use('/client', express.static(devpagesPath));
app.use('/css', express.static(path.join(devpagesRoot, 'css')));
app.use('/node_modules', express.static(path.join(devpagesRoot, 'node_modules')));
console.log(`📁 Serving devpages from: ${devpagesRoot}`);

// Socket.IO for local terminal
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// WebSocket server for SSH bridge (noServer to avoid conflict with Socket.IO)
const wss = new WebSocket.Server({ noServer: true });

// Manually route WebSocket upgrades to avoid Socket.IO/ws conflict
server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;

    if (pathname === '/ssh-bridge') {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    }
    // Socket.IO handles its own /socket.io/ path automatically
});

// Environment-based feature flags
const FEATURES = {
    console_access: ['local', 'dev'].includes(TETRA_ENV),
    limited_console: TETRA_ENV === 'staging',
    proxy_only: TETRA_ENV === 'production',
    patrol_enabled: TETRA_ENV !== 'local',
    gamepad_enabled: process.env.TETRA_GAMEPAD === '1' // Opt-in: TETRA_GAMEPAD=1
};

console.log('🔧 Feature flags:', FEATURES);

// Patrol loop - runs on deployed servers (not local)
let patrol = null;
if (FEATURES.patrol_enabled) {
    const patrolInterval = parseInt(process.env.TSM_PATROL_INTERVAL) || 30000;
    patrol = new PatrolLoop({ interval: patrolInterval });
    console.log(`🔄 Patrol will start after server is ready (interval: ${patrolInterval/1000}s)`);
}

// Gamepad Handler (opt-in with TETRA_GAMEPAD=1)
let gamepadHandler = null;
if (FEATURES.gamepad_enabled) {
    try {
        gamepadHandler = new GamepadHandler({
            optional: true,      // Don't fail if no gamepad
            pipe: true,          // Write to named pipe for Bash TUI
            mapping: true        // Enable keyboard mapping
        });

        gamepadHandler.init().catch(err => {
            // Silently ignore - gamepad is optional
            console.log('   (Gamepad unavailable - TUI will use keyboard only)');
        });
    } catch (err) {
        console.log('⚠️  Gamepad module unavailable:', err.message);
    }
}

// Local Terminal (Socket.IO) with PTY Sessions - one per org:env
if (FEATURES.console_access) {
    const PtySessionManager = require('./pty-sessions');
    const ptyManager = new PtySessionManager();

    // Handle Socket.IO connections for terminal sessions
    io.on('connection', (socket) => {
        // Track current environment per socket
        let currentOrg = 'tetra';
        let currentEnv = 'local';
        let currentKey = null;

        console.log(`[Socket] Connected: ${socket.id}`);

        // Get session key for current org:env
        const getKey = () => `${socket.id}:${currentOrg}:${currentEnv}`;

        // Switch to an environment (creates PTY if needed)
        const switchEnv = (org, env, sshTarget) => {
            const newKey = `${socket.id}:${org}:${env}`;

            // Same env? Just ensure connected
            if (newKey === currentKey) {
                console.log(`[Socket] Already at ${newKey}`);
                return;
            }

            // Create/get the session for new env
            ptyManager.getOrCreate(socket.id, org, env, {
                sshTarget,
                cols: 120,
                rows: 30
            });

            // Switch socket from old to new
            ptyManager.switchSocket(socket, currentKey, newKey);

            currentOrg = org;
            currentEnv = env;
            currentKey = newKey;

            console.log(`[Socket] ${socket.id} switched to: ${newKey}`);
        };

        // Start with local session
        switchEnv('tetra', 'local', null);

        // Handle env-change from console iframe
        socket.on('env-change', ({ org, env, sshTarget }) => {
            if (org && env) {
                switchEnv(org, env, sshTarget || null);
            }
        });

        // Handle input from client
        socket.on('input', (data) => {
            if (currentKey) {
                ptyManager.write(currentKey, data);
            }
        });

        // Handle resize
        socket.on('resize', ({ cols, rows }) => {
            if (currentKey && cols && rows) {
                ptyManager.resize(currentKey, cols, rows);
            }
        });

        // Cleanup on disconnect
        socket.on('disconnect', () => {
            ptyManager.cleanupSocket(socket.id);
            console.log(`[Socket] Disconnected: ${socket.id}`);
        });
    });

    // API: List PTY sessions
    app.get('/api/sessions', (req, res) => {
        res.json(ptyManager.listSessions());
    });

    // API: Kill a session by key
    app.delete('/api/sessions/:key', (req, res) => {
        const { key } = req.params;
        const killed = ptyManager.killSession(decodeURIComponent(key));
        res.json({ success: killed, key });
    });

    // Note: Creating sessions via API not supported in per-socket model
    // Sessions are created automatically when socket connects + env-change
    app.post('/api/sessions', (req, res) => {
        res.status(400).json({
            error: 'Sessions are created automatically via socket env-change event',
            hint: 'Connect via Socket.IO and emit env-change'
        });
    });

    console.log('🖥️ PTY Session Manager enabled (per-env sessions)');
}

// SSH Bridge (WebSocket)
if (FEATURES.console_access) {
    require('./ssh-bridge')(wss, sshKeyStore, JWT_SECRET);
    console.log('🔗 SSH Bridge enabled');
}

// SSH Authentication endpoints
app.post('/api/auth/ssh-token', (req, res) => {
    try {
        const { host, username, privateKey, passphrase } = req.body;
        
        if (!host || !username || !privateKey) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Generate a unique session ID
        const sessionId = crypto.randomUUID();
        
        // Store SSH credentials temporarily (encrypted in production)
        sshKeyStore.set(sessionId, {
            host,
            username,
            privateKey,
            passphrase,
            createdAt: Date.now()
        });

        // Create JWT token
        const token = jwt.sign(
            { sessionId, host, username },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        res.json({ 
            token,
            expiresIn: TOKEN_EXPIRY,
            message: 'SSH token created successfully'
        });

    } catch (error) {
        console.error('SSH token creation error:', error);
        res.status(500).json({ error: 'Failed to create SSH token' });
    }
});

app.post('/api/auth/validate-token', (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ error: 'Token required' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const sshData = sshKeyStore.get(decoded.sessionId);
        
        if (!sshData) {
            return res.status(401).json({ error: 'Session expired or invalid' });
        }

        res.json({ 
            valid: true,
            host: decoded.host,
            username: decoded.username,
            expiresAt: decoded.exp * 1000
        });

    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
});

// Gamepad API endpoints
app.get('/api/gamepad/status', (req, res) => {
    if (!gamepadHandler) {
        return res.json({ available: false, reason: 'Gamepad module not initialized' });
    }
    const state = gamepadHandler.getRawState();
    res.json({
        available: true,
        connected: state.connected,
        timestamp: state.timestamp
    });
});

app.get('/api/gamepad/raw', (req, res) => {
    if (!gamepadHandler) {
        return res.status(404).json({ error: 'Gamepad not available' });
    }
    res.json(gamepadHandler.getRawState());
});

// API Routes
app.use('/api/nh', require('./api/nh'));
app.use('/api/tkm', require('./api/tkm'));
app.use('/api/tsm', require('./api/tsm'));
app.use('/api/deploy', require('./api/deploy'));
app.use('/api/pbase', require('./api/pbase'));
app.use('/api/logs', require('./api/logs'));
app.use('/api/orgs', require('./api/orgs'));
app.use('/api/environments', require('./api/environments'));
app.use('/api/playwright', require('./api/playwright'));
app.use('/api/capture', require('./api/capture'));
app.use('/api/caddy', require('./api/caddy'));

// Environment data for frontend
app.get('/api/env', (req, res) => {
    res.json({
        USER: process.env.USER || 'dev',
        HOME: process.env.HOME || '/home/dev',
        defaultProjectDir: `${process.env.HOME || '/home/dev'}/src/pixeljam`
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        service: 'tetra-4444',
        environment: TETRA_ENV,
        features: FEATURES,
        patrol: patrol ? patrol.getStats() : null,
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Status endpoint
app.get('/status', (req, res) => {
    res.json({
        service: 'tetra',
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: TETRA_ENV,
        port: PORT
    });
});

// Patrol endpoints (for monitoring patrol loop status)
app.get('/patrol/status', (req, res) => {
    if (!patrol) {
        return res.json({
            enabled: false,
            reason: 'Patrol disabled in local environment'
        });
    }
    res.json({
        enabled: true,
        ...patrol.getStats()
    });
});

app.get('/patrol/log', (req, res) => {
    if (!patrol) {
        return res.json({ log: [], enabled: false });
    }
    res.json({
        log: patrol.getLog(),
        enabled: true
    });
});

app.post('/patrol/check', (req, res) => {
    if (!patrol) {
        return res.status(400).json({
            error: 'Patrol disabled in local environment',
            enabled: false
        });
    }
    const result = patrol.checkNow();
    res.json({
        ...result,
        enabled: true
    });
});

// Default route - serve devpages
app.get('/', (req, res) => {
    res.sendFile(path.join(devpagesPath, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: TETRA_ENV === 'production' ? 'Something went wrong' : err.message
    });
});

// Start server
server.listen(PORT, '127.0.0.1', () => {
    console.log(`✅ Tetra server running on http://127.0.0.1:${PORT}`);
    console.log(`📊 Environment: ${TETRA_ENV}`);
    console.log(`🔌 WebSocket SSH bridge: ${FEATURES.console_access ? 'enabled' : 'disabled'}`);

    // Start patrol loop after server is ready (non-local only)
    if (patrol) {
        patrol.start();
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully');
    if (patrol) patrol.stop();
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully');
    if (patrol) patrol.stop();
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
