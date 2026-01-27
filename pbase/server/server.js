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
const TETRA_DIR = process.env.TETRA_DIR || path.join(process.env.HOME, 'tetra');
let TETRA_ORG = process.env.TETRA_ORG || 'tetra';
let GAMES_DIR = process.env.GAMES_DIR;

// S3 configuration
const S3_BUCKET = process.env.S3_BUCKET || 'pja-games';
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'https://sfo3.digitaloceanspaces.com';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || process.env.DO_SPACES_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || process.env.DO_SPACES_SECRET;

console.log(`Starting PBase Server (${PBASE_ENV}) on port ${PORT}`);
console.log(`PD_DIR: ${PD_DIR}`);
console.log(`PD_DATA: ${PD_DATA}`);
console.log(`TETRA_DIR: ${TETRA_DIR}`);
console.log(`TETRA_ORG: ${TETRA_ORG}`);
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
import { ManifestTools } from './lib/ManifestTools.js';
import { MagicLink } from './lib/MagicLink.js';
import { getHealth as getPermissionsHealth } from './lib/permissions.js';
import { initializeValidation, getValidationHealth, validateGame } from './middleware/validation.js';

// Initialize services
const pdata = new PData();
const magicLink = new MagicLink({
    baseUrl: process.env.PBASE_URL || `http://localhost:${PORT}`,
});

let s3Provider = null;
let manifestTools = null;

// Helper to get games dir for an org
function getGamesDir(org) {
    return path.join(TETRA_DIR, 'orgs', org, 'games');
}

// Workspace state - use an object so references stay valid
const workspace = {
    localProvider: null,
    gameManifest: null,
};

// Initialize game provider based on environment
if (GAMES_DIR) {
    // Local mode: use filesystem
    workspace.localProvider = new LocalGameProvider(GAMES_DIR);
    workspace.gameManifest = new GameManifest(workspace.localProvider);
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
    if (!workspace.gameManifest) {
        workspace.gameManifest = new GameManifest(s3Provider);
    }
    // Initialize ManifestTools for S3 manifest management
    manifestTools = new ManifestTools(s3Provider, workspace.gameManifest);
    console.log('S3 provider initialized');
} else if (!GAMES_DIR) {
    console.warn('No GAMES_DIR or S3 credentials - game endpoints will be disabled');
}

// Expose providers to middleware via app.locals
app.locals.s3Provider = s3Provider;
app.locals.gameProvider = workspace.localProvider || s3Provider;
app.locals.gameManifest = workspace.gameManifest;

// Initialize validation system
initializeValidation().then(() => {
    console.log('[Validation] System initialized');
}).catch(err => {
    console.warn('[Validation] Failed to initialize:', err.message);
});

// Mount routes
app.use('/api/auth', createAuthRoutes(pdata, magicLink));
app.use('/api/s3', createS3Routes(s3Provider, pdata, manifestTools));
app.use('/api/games', createGamesRoutes(workspace, pdata, s3Provider));
app.use('/api/admin', createAdminRoutes(pdata));

// Workspace/Org endpoints - for managing local workspace
import { readdir } from 'fs/promises';

// List available orgs
app.get('/api/workspace/orgs', async (req, res) => {
    try {
        const orgsDir = path.join(TETRA_DIR, 'orgs');
        const entries = await readdir(orgsDir, { withFileTypes: true });
        const orgs = entries
            .filter(e => e.isDirectory() && !e.name.startsWith('.'))
            .map(e => e.name);

        res.json({
            tetra_dir: TETRA_DIR,
            current_org: TETRA_ORG,
            orgs,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get current workspace state
app.get('/api/workspace', async (req, res) => {
    try {
        const gamesDir = getGamesDir(TETRA_ORG);
        let gameCount = 0;
        try {
            const entries = await readdir(gamesDir, { withFileTypes: true });
            gameCount = entries.filter(e => e.isDirectory() && !e.name.startsWith('.')).length;
        } catch { /* games dir may not exist */ }

        res.json({
            tetra_dir: TETRA_DIR,
            org: TETRA_ORG,
            games_dir: gamesDir,
            game_count: gameCount,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Switch org
app.post('/api/workspace/org', async (req, res) => {
    try {
        const { org } = req.body;
        if (!org) {
            return res.status(400).json({ error: 'org parameter required' });
        }

        const newGamesDir = getGamesDir(org);

        // Verify org exists
        try {
            await readdir(path.join(TETRA_DIR, 'orgs', org));
        } catch {
            return res.status(404).json({ error: `Org not found: ${org}` });
        }

        // Update state
        TETRA_ORG = org;
        GAMES_DIR = newGamesDir;

        // Reinitialize local provider - update workspace object in place
        if (workspace.localProvider) {
            workspace.localProvider = new LocalGameProvider(newGamesDir);
            workspace.gameManifest = new GameManifest(workspace.localProvider);
            console.log(`[Workspace] Switched to org: ${org}, games: ${newGamesDir}`);
        }

        res.json({
            success: true,
            org: TETRA_ORG,
            games_dir: GAMES_DIR,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Health check (TSM requirement)
app.get('/health', (req, res) => {
    const permHealth = getPermissionsHealth();
    const validationHealth = getValidationHealth();
    const allHealthy = permHealth.ok && validationHealth.ok;

    res.json({
        service: 'pbase',
        status: allHealthy ? 'healthy' : 'degraded',
        port: PORT,
        environment: PBASE_ENV,
        s3_configured: !!s3Provider,
        permissions: permHealth,
        validation: validationHealth,
        timestamp: new Date().toISOString(),
    });
});

// Validation endpoint - validate a game on demand
app.post('/api/validate/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const hook = req.body.hook || req.query.hook || 'onPublish';

        const provider = workspace.localProvider || s3Provider;
        if (!provider) {
            return res.status(503).json({
                error: 'Service Unavailable',
                message: 'No storage provider configured',
            });
        }

        let game = null;
        if (workspace.gameManifest) {
            try {
                game = await workspace.gameManifest.getGame(slug);
            } catch { /* ignore */ }
        }

        const result = await validateGame({
            slug,
            game,
            hook,
            provider,
        });

        if (result.success) {
            res.json(result.toSuccessResponse());
        } else {
            res.status(400).json(result.toErrorResponse());
        }
    } catch (err) {
        console.error('[Validate] Error:', err);
        res.status(500).json({
            error: 'Internal Server Error',
            message: err.message,
        });
    }
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
        workspace: {
            TETRA_DIR,
            TETRA_ORG,
            GAMES_DIR: GAMES_DIR || '(not set)',
        },
        paths: {
            PD_DIR,
            PD_DATA,
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
