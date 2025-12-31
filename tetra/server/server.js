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
    proxy_only: TETRA_ENV === 'production'
};

console.log('🔧 Feature flags:', FEATURES);

// Gamepad Handler (optional, runs alongside server)
let gamepadHandler = null;
if (FEATURES.console_access) {
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

// Local Terminal (Socket.IO)
if (FEATURES.console_access) {
    // Create a simple terminal manager for local shell
    const pty = require('node-pty');

    let ptyProcess = null;
    let ptyReady = false;
    let handlerCount = 0;  // Track how many onData handlers exist
    const connectedSockets = new Set();

    const startLocalTerminal = () => {
        if (ptyProcess) {
            console.log('[PTY] Reusing existing terminal process');
            return ptyProcess;
        }

        console.log('[PTY] Starting NEW terminal process...');
        const defaultProjectDir = `${process.env.HOME}/src/pixeljam`;
        ptyProcess = pty.spawn('bash', [], {
            name: 'xterm-color',
            cols: 80,
            rows: 30,
            cwd: process.env.HOME,
            env: process.env,
        });

        // Silent init - discard output until ready
        ptyProcess.write(`cd "${defaultProjectDir}" 2>/dev/null; clear\r\n`);

        // Single output handler - broadcasts to all connected sockets
        handlerCount++;
        console.log(`[PTY] Registering onData handler #${handlerCount}`);
        ptyProcess.onData((data) => {
            const preview = data.replace(/[\r\n]/g, '\\n').substring(0, 50);
            console.log(`[PTY] onData: ready=${ptyReady} sockets=${connectedSockets.size} bytes=${data.length} preview="${preview}"`);
            if (ptyReady) {
                for (const socket of connectedSockets) {
                    socket.emit('output', data);
                }
            }
        });

        // Mark ready after init settles
        setTimeout(() => {
            console.log('[PTY] Marking ready, discarding init output');
            ptyReady = true;
        }, 100);

        ptyProcess.onExit(() => {
            console.log('[PTY] Process exited');
            ptyProcess = null;
            ptyReady = false;
            handlerCount = 0;
        });

        return ptyProcess;
    };

    // Handle Socket.IO connections for local terminal
    io.on('connection', (socket) => {
        console.log(`[Socket] Connected: ${socket.id} (total: ${connectedSockets.size + 1})`);

        const terminal = startLocalTerminal();
        connectedSockets.add(socket);

        // Handle input from client
        socket.on('input', (data) => {
            console.log(`[Socket] Input from ${socket.id}: ${data.length} bytes`);
            if (terminal) {
                terminal.write(data);
            }
        });

        socket.on('disconnect', () => {
            connectedSockets.delete(socket);
            console.log(`[Socket] Disconnected: ${socket.id} (remaining: ${connectedSockets.size})`);
        });
    });

    console.log('🖥️ Local Terminal enabled');
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
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
