#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment configuration
const PBASE_ENV = process.env.PBASE_ENV || 'local';
const PORT = process.env.PBASE_PORT || 2600;
const PD_DIR = process.env.PD_DIR || path.join(__dirname, '..', 'pd');
const PD_DATA = process.env.PD_DATA || path.join(PD_DIR, 'data');
const GAMES_DIR = process.env.GAMES_DIR;

// S3 configuration
const S3_BUCKET = process.env.S3_BUCKET || 'pja-games';
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'https://sfo3.digitaloceanspaces.com';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || process.env.DO_SPACES_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || process.env.DO_SPACES_SECRET;

console.log(`Starting PBase Server (${PBASE_ENV}) on port ${PORT}`);
console.log(`PD_DIR: ${PD_DIR}`);
console.log(`PD_DATA: ${PD_DATA}`);
if (GAMES_DIR) console.log(`GAMES_DIR: ${GAMES_DIR}`);
console.log(`S3 bucket: ${S3_BUCKET}`);

// Express app setup
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static dashboard
const staticPath = path.join(__dirname, 'static');
app.use(express.static(staticPath));
console.log(`Serving dashboard from: ${staticPath}`);

// Import and configure routes
import { createAuthRoutes } from './routes/auth.js';
import { createS3Routes } from './routes/s3.js';
import { createGamesRoutes } from './routes/games.js';
import { createAdminRoutes } from './routes/admin.js';
import { PData } from '@nodeholder/pdata';
import { S3Provider } from './lib/S3Provider.js';
import { LocalGameProvider } from './lib/LocalGameProvider.js';
import { GameManifest } from './lib/GameManifest.js';
import { MagicLink } from './lib/MagicLink.js';
import { getHealth as getPermissionsHealth } from './lib/permissions.js';

// Initialize services
const pdata = new PData();
const magicLink = new MagicLink({
    baseUrl: process.env.PBASE_URL || `http://localhost:${PORT}`,
});

let s3Provider = null;
let gameManifest = null;

// Initialize game provider based on environment
if (GAMES_DIR) {
    // Local mode: use filesystem
    const localProvider = new LocalGameProvider(GAMES_DIR);
    gameManifest = new GameManifest(localProvider);
    console.log(`Local game provider initialized: ${GAMES_DIR}`);
}

if (S3_ACCESS_KEY && S3_SECRET_KEY) {
    s3Provider = new S3Provider({
        bucket: S3_BUCKET,
        endpoint: S3_ENDPOINT,
        credentials: {
            accessKeyId: S3_ACCESS_KEY,
            secretAccessKey: S3_SECRET_KEY,
        },
    });
    // Only use S3 for games if no local GAMES_DIR
    if (!gameManifest) {
        gameManifest = new GameManifest(s3Provider);
    }
    console.log('S3 provider initialized');
} else if (!GAMES_DIR) {
    console.warn('No GAMES_DIR or S3 credentials - game endpoints will be disabled');
}

// Mount routes
app.use('/api/auth', createAuthRoutes(pdata, magicLink));
app.use('/api/s3', createS3Routes(s3Provider, pdata));
app.use('/api/games', createGamesRoutes(gameManifest, pdata));
app.use('/api/admin', createAdminRoutes(pdata));

// Health check (TSM requirement)
app.get('/health', (req, res) => {
    const permHealth = getPermissionsHealth();
    const allHealthy = permHealth.ok;

    res.json({
        service: 'pbase',
        status: allHealthy ? 'healthy' : 'degraded',
        port: PORT,
        environment: PBASE_ENV,
        s3_configured: !!s3Provider,
        permissions: permHealth,
        timestamp: new Date().toISOString(),
    });
});

// Status endpoint
app.get('/status', (req, res) => {
    res.json({
        service: 'pbase',
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: PBASE_ENV,
        port: PORT,
        pd_dir: PD_DIR,
        pd_data: PD_DATA,
        s3_bucket: S3_BUCKET,
        users: pdata.listUsers().join(', '),
    });
});

// Config endpoint - shows TSM runtime config
app.get('/api/config', (req, res) => {
    res.json({
        service: {
            name: process.env.TSM_NAME || 'pbase',
            command: process.env.TSM_COMMAND || 'node server.js',
            cwd: process.env.TSM_CWD || process.cwd(),
        },
        environment: PBASE_ENV,
        paths: {
            PD_DIR,
            PD_DATA,
            GAMES_DIR: GAMES_DIR || '(not set)',
        },
        s3: {
            bucket: S3_BUCKET,
            endpoint: S3_ENDPOINT,
            configured: !!(S3_ACCESS_KEY && S3_SECRET_KEY),
        },
        runtime: {
            port: PORT,
            pid: process.pid,
            uptime: Math.floor(process.uptime()),
            node: process.version,
        },
    });
});

// Default route - serve dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: PBASE_ENV === 'production' ? 'Something went wrong' : err.message,
    });
});

// Start server
app.listen(PORT, '127.0.0.1', () => {
    console.log(`PBase server running on http://127.0.0.1:${PORT}`);
    console.log(`Environment: ${PBASE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully');
    process.exit(0);
});
