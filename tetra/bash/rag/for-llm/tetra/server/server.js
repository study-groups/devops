#!/usr/bin/env node

const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Environment configuration
const TETRA_ENV = process.env.TETRA_ENV || 'local';
const PORT = process.env.TETRA_PORT || 4444;
const TETRA_DIR = process.env.TETRA_DIR || '/Users/mricos/tetra';

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
app.use(express.static(path.join(TETRA_DIR, 'public')));

// WebSocket server for SSH bridge
const wss = new WebSocket.Server({
    server,
    path: '/ssh-bridge'
});

// Environment-based feature flags
const FEATURES = {
    console_access: ['local', 'dev'].includes(TETRA_ENV),
    limited_console: TETRA_ENV === 'staging',
    proxy_only: TETRA_ENV === 'production'
};

console.log('🔧 Feature flags:', FEATURES);

// SSH Bridge (local/dev only)
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

// API Routes
app.use('/api/nh', require('./api/nh'));
app.use('/api/tkm', require('./api/tkm'));
app.use('/api/tsm', require('./api/tsm'));
app.use('/api/deploy', require('./api/deploy'));
app.use('/api/pbase', require('./api/pbase'));

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

// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(TETRA_DIR, 'public', 'index.html'));
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
server.listen(PORT, () => {
    console.log(`✅ Tetra server running on http://localhost:${PORT}`);
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