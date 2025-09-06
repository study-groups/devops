import express from 'express';
import path from 'path';
import multer from 'multer';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import fs from 'fs/promises';
import fsSync from 'fs';
import { fileURLToPath } from 'url';
import passport from 'passport';
import connectSessionFileStore from 'session-file-store';
import { S3Client } from '@aws-sdk/client-s3';

const FileStore = connectSessionFileStore(session);

// --- Local Imports ---
import { port, uploadsDirectory, env } from './config.js';
import { authMiddleware } from './middleware/auth.js';
// import { CapabilityManager } from './middleware/capabilities.js';
import authRoutes from './routes/auth.js';
import saveRoutes from './routes/save.js';
import cliRoutes from './routes/cli.js';
import filesRouter from './routes/files.js';
import usersRouter from './routes/users.js';
import configRoutes from './routes/configRoutes.js';
// import capabilityRoutes from './routes/capabilities.js';
import { PData } from '../pdata/PData.js';
import pdataRoutes from './routes/pdataRoutes.js';
import cssRoutes from './routes/css.js';
// import settingsRoutes from './routes/settings.js';
// import s3Routes from './routes/s3.js';

// --- Setup: Constants & Paths ---
const __filename = fileURLToPath(import.meta.url);
const currentDir = path.dirname(__filename);
const projectRoot = path.resolve(currentDir, '..');
const pdDir = process.env.PD_DIR;
const staticOptions = { followSymlinks: true };

if (!pdDir) {
    console.error("[SERVER FATAL] PD_DIR environment variable is not set.");
    process.exit(1);
}

// --- Initialization ---
const app = express();
let pdataInstance;
let capabilityManager;

try {
    const dataDir = path.join(pdDir, 'data');
    if (!fsSync.existsSync(dataDir)) {
        fsSync.mkdirSync(dataDir, { recursive: true });
    }
	pdataInstance = new PData();
	console.log('[Server] PData initialized successfully.');
	
	console.log('[Server] CapabilityManager initialized successfully.');
} catch (error) {
    console.error('[Server] CRITICAL: PData failed to initialize.', error);
	process.exit(1);
}

const s3ClientInstance = (() => {
    const requiredEnvVars = ['DO_SPACES_KEY', 'DO_SPACES_SECRET', 'DO_SPACES_REGION', 'DO_SPACES_ENDPOINT'];
    if (requiredEnvVars.some(v => !process.env[v])) {
        console.warn(`[Server Config] Missing DO Spaces environment variables. S3 features disabled.`);
        return null;
    }
    return new S3Client({
        endpoint: process.env.DO_SPACES_ENDPOINT,
        region: process.env.DO_SPACES_REGION,
        credentials: {
            accessKeyId: process.env.DO_SPACES_KEY,
            secretAccessKey: process.env.DO_SPACES_SECRET,
        },
        forcePathStyle: true,
    });
})();

// =============================================================================
// MIDDLEWARE CONFIGURATION (Correct Order)
// =============================================================================

// 1. Core Middleware
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  req.pdata = pdataInstance;
  req.s3Client = s3ClientInstance;
    next();
  });

// Make capability manager available to all routes
app.locals.capabilityManager = capabilityManager;
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// 2. Session & Authentication Middleware
const sessionStore = new FileStore({ 
    path: path.join(pdataInstance.dataRoot, 'sessions'), 
    ttl: 86400, 
    reapInterval: 3600,
    retries: 5,
    retryDelay: 100
});

app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'devpages-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'devpages.sid',
    cookie: {
        secure: false, // Set to true only when using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
    }
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user.username);
});
passport.deserializeUser((username, done) => {
    done(null, { username: username });
});

// 3. Static File Middleware (Serve these before API routes)
app.use('/client', express.static(path.join(projectRoot, 'client'), staticOptions));
app.use('/packages', express.static(path.join(projectRoot, 'packages'), staticOptions));
app.use('/redux', express.static(path.join(projectRoot, 'redux'), staticOptions));
app.use('/node_modules', express.static(path.join(projectRoot, 'node_modules'), staticOptions));
app.use(express.static(path.join(projectRoot, 'public'), staticOptions));

// 4. API Routes
app.use('/api/config', configRoutes);
app.use('/api/auth', express.json(), authRoutes);
// app.use('/api/capabilities', capabilityRoutes);
app.use('/api/users', authMiddleware, usersRouter);
app.use('/api/files', authMiddleware, filesRouter);
app.use('/api/save', authMiddleware, express.text({ type: 'text/plain' }), express.json(), saveRoutes);
app.use('/api/cli', express.json(), authMiddleware, cliRoutes);
app.use('/api/pdata', authMiddleware, pdataRoutes);
// app.use('/api/s3', s3Routes);
// app.use('/api/settings', settingsRoutes);
app.use('/css', cssRoutes);

// 5. Application Routes (HTML serving, etc.)
app.get('/', (req, res) => {
    res.sendFile(path.join(projectRoot, 'client', 'index.html'));
});
app.use('/login', (req, res) => {
    res.sendFile(path.join(projectRoot, 'client', 'login.html'));
});
app.use('/logout', (req, res) => {
    req.logout((err) => {
        if (err) console.error('[SERVER] Logout error:', err);
        res.redirect('/login');
    });
});

// Guest access route with capability token
app.get('/guest', (req, res) => {
    const { token } = req.query;
    if (!token || !token.startsWith('cap_')) {
        return res.status(400).send('Valid guest token required');
    }
    
    // Serve a special guest interface page
    res.sendFile(path.join(projectRoot, 'client', 'guest.html'));
});

// Shareable content access
app.get('/share', (req, res) => {
    const { token } = req.query;
    if (!token || !token.startsWith('cap_')) {
        return res.status(400).send('Valid share token required');
    }
    
    // Serve shared content interface
    res.sendFile(path.join(projectRoot, 'client', 'share.html'));
});

// Admin token generator (admin only)
app.get('/admin/tokens', authMiddleware, (req, res) => {
    // Check if user is admin
    if (!req.isAuthenticated() || !req.pdata || req.pdata.getUserRole(req.user?.username) !== 'admin') {
        return res.status(403).send('Admin access required');
    }
    
    res.sendFile(path.join(projectRoot, 'client', 'admin-tokens.html'));
});

// 6. 404 and Error Handling
    app.use((req, res, next) => {
        res.status(404).send('Resource not found');
});

// =============================================================================
// SERVER START
// =============================================================================

const server = app.listen(port, () => {
    console.log('='.repeat(50));
    console.log(`[SERVER] Server running at http://localhost:${port}`);
    console.log(`[SERVER] Environment: ${process.env.NODE_ENV}`);
    console.log(`PData DB Root: ${pdataInstance.dbRoot}`);
    console.log(`PData Data Root: ${pdataInstance.dataRoot}`);
    console.log('='.repeat(50));
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[SERVER FATAL] Port ${port} is already in use by another process.`);
        console.error(`[SERVER FATAL] Please kill the other process or use a different port.`);
        process.exit(1);
    } else {
        console.error(`[SERVER FATAL] Server failed to start:`, err);
        process.exit(1);
    }
});