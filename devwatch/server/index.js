#!/usr/bin/env node

/**
 * Playwright Server - Main Entry Point
 * 
 * Unified Express server providing:
 * - Admin Dashboard (moved from admin-server.js)
 * - Testing API endpoints
 * - Static page serving (standalone + iframe support)
 * - Environment monitoring
 * - Test suite management
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const cors = require('cors');
const log = require('./utils/logging');
const Bree = require('bree');
const { storeJobResult, initializeJobStorage } = require('./routes/api/cron');
const http = require('http');

const app = express();

// Environment setup
// PW_DIR is required for logs and artifacts
const PW_DIR = process.env.PW_DIR;
if (!PW_DIR) {
    // Fail fast with a clear error message
    // Using console.error here intentionally as logger isn't configured yet
    // eslint-disable-next-line no-console
    console.error(`
CRITICAL ERROR: PW_DIR environment variable is not set.
` +
        `The server cannot start without a configured data directory for logs and test assets.
` +
        `Example:
  $ export PW_DIR=/path/to/your/data/directory
  $ node server/index.js
`);
    process.exit(1);
}
// PW_SRC is the source directory of the Playwright project itself.
// We can determine this reliably from the location of this file.
const PW_SRC = path.resolve(__dirname, '..');

// Ensure base directories exist
try {
    fs.mkdirSync(PW_DIR, { recursive: true });
    fs.mkdirSync(path.join(PW_DIR, 'logs'), { recursive: true });
} catch (e) {
    // Last resort warning, still allow server to continue
    console.warn('Could not ensure PW_DIR/logs directories:', e.message);
}

// Initialize and configure logger
// configureLogger({ logDir: PW_DIR, logFile: 'playwright-server.log' }); // This line is removed as per the new logging interface

// Make environment available globally to routes
app.locals.PW_DIR = PW_DIR;
app.locals.PW_SRC = PW_SRC;

log.info('Starting Playwright Server...', { pwDir: PW_DIR, pwSrc: PW_SRC, pwd: process.cwd() });

// Bree job scheduler setup - use source directory for job files
const breeJobsDir = path.join(__dirname, 'bree', 'jobs');

const bree = new Bree({
    root: breeJobsDir,
    jobs: [
        {
            name: 'periodic-health-check',
            path: path.join(breeJobsDir, 'periodic-health-check.js'),
            interval: '5m' // Run every 5 minutes
        }
    ],
    logger: { 
        info: (msg, meta) => log.info(typeof msg === 'object' ? JSON.stringify(msg) : msg, meta),
        error: (msg, meta) => log.error(typeof msg === 'object' ? JSON.stringify(msg) : msg, meta),
        warn: (msg, meta) => log.warn(typeof msg === 'object' ? JSON.stringify(msg) : msg, meta)
    },
    outputWorkerMetadata: false, 
    workerMessageHandler: (message) => {
        storeJobResult(message);
    }
});

// Make bree instance available to routes
app.locals.bree = bree;

bree.start();
log.info('Bree scheduler started.');

// Initialize job storage
initializeJobStorage(PW_DIR);
log.info('Job storage initialized.');

// Make bree instance available globally to routes
app.locals.bree = bree;

// Middleware
app.use(express.json({ 
    limit: '50mb',  // Increase JSON payload limit
    strict: true,   // Only accept arrays and objects
    type: 'application/json'
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: '50mb' 
}));
app.use(cors({
    // Disable response size limits
    maxAge: 86400,
    credentials: true,
    origin: true
}));

// Serve static files from the 'static' directory with no caching for development
app.use('/static', express.static(path.join(__dirname, 'static'), {
    etag: false,
    lastModified: false,
    setHeaders: (res, path, stat) => {
        res.set('Cache-Control', 'no-store');
    }
}));

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Request logging middleware - must be before routes
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        // The logger will automatically handle categorization now.
    });
    next();
});

// Authentication middleware - require auth for all routes except logout
app.use((req, res, next) => {
    // Skip auth check for logout routes and static assets
    if (req.path.startsWith('/logout') || req.path.startsWith('/static/')) {
        return next();
    }

    // SECURITY NOTE: Localhost bypass is safe ONLY because server binds to 127.0.0.1 (line 280)
    // If you ever change the binding to 0.0.0.0, this becomes a critical vulnerability
    const isLocalhost = req.ip === '127.0.0.1' ||
                       req.ip === '::1' ||
                       req.ip === '::ffff:127.0.0.1' ||
                       req.connection.remoteAddress === '127.0.0.1' ||
                       req.connection.remoteAddress === '::1';

    if (isLocalhost) {
        console.log('[AUTH] Allowing localhost connection for:', req.path);
        return next();
    }

    // Check for authentication headers
    const user = req.get('Remote-User') ||
                 req.get('X-Remote-User') ||
                 req.get('X-Forwarded-User') ||
                 req.headers['remote-user'] ||
                 req.headers['x-remote-user'] ||
                 req.headers['x-forwarded-user'];

    if (!user) {
        console.log('[AUTH] No authentication found for:', req.path);
        return res.status(401).set('WWW-Authenticate', 'Basic realm="Restricted Access"').send('Authentication required');
    }

    console.log('[AUTH] Authenticated user:', user, 'accessing:', req.path);
    next();
});

// Serve reports from the PW_DIR directory
app.use('/reports', express.static(path.join(PW_DIR, 'reports'), {
    // Omitting index.html from being served by default in reports
    index: ['index.html', 'index.htm'],
    extensions: ['html', 'htm'],
    fallthrough: false, // send 404 when not found
    setHeaders: (res) => {
        // Tighten security headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    }
}));

// Routes
const indexRoutes = require('./routes/index');
const apiRoutes = require('./routes/api/index');
const pagesRoutes = require('./routes/pages');

app.use('/', indexRoutes);
app.use('/api', apiRoutes);
app.use('/pages', pagesRoutes);

// Add logout route - proper HTTP Basic Auth logout
app.get('/logout', (req, res) => {
    // Send 401 with invalid credentials to force browser to clear auth
    res.status(401).set({
        'WWW-Authenticate': 'Basic realm="Restricted Access"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    }).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Logged Out</title>
            <script>
                // Try to clear credentials by making a request with invalid auth
                fetch('/logout-clear', {
                    method: 'GET',
                    headers: {
                        'Authorization': 'Basic ' + btoa('logout:logout')
                    }
                }).catch(() => {
                    // Expected to fail
                    window.location.href = '/';
                });
            </script>
        </head>
        <body>
            <h1>Logged Out</h1>
            <p>You have been logged out. <a href="/">Click here to login again</a></p>
        </body>
        </html>
    `);
});

// Helper route for logout
app.get('/logout-clear', (req, res) => {
    res.status(401).set('WWW-Authenticate', 'Basic realm="Restricted Access"').send('Clearing credentials...');
});

// Error handling middleware
app.use((err, req, res, next) => {
    // Only log errors that are not expected or handled by specific routes
    if (err.status !== 404 && err.status !== 400) {
        log.error('server.error', 'Unhandled Server Error', { 
            error: err.message, 
            stack: err.stack, 
            path: req.path, 
            method: req.method, 
            requestId: req.id 
        });
    }
    
    res.status(err.status || 500).json({ 
        error: 'Internal Server Error',
        message: err.message,
        timestamp: new Date().toISOString()
    });
});

// 404 handler for API routes, and a catch-all for the frontend app
app.use((req, res) => {
    // If the request is for an API endpoint, return a JSON 404 response
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ 
            error: 'Not Found',
            path: req.path,
            method: req.method,
            timestamp: new Date().toISOString()
        });
    }
    
    // Otherwise, serve the main application file
    res.sendFile(path.join(__dirname, 'static', 'system.iframe.html'));
});



// Start server normally
const PORT = process.env.PORT || 4400;
const server = app.listen(PORT, '127.0.0.1', () => {
    const startupMessage = `Server started successfully on port ${PORT}`;
    
    log.recordEvent({
        Type: 'SERVER_INFO',
        From: 'server.start',
        Message: startupMessage,
        Data: {
            port: PORT,
            environment: process.env.NODE_ENV || 'development',
            pid: process.pid,
            startup_time: new Date().toISOString(),
            pw_dir: PW_DIR
        }
    });
    
    console.log(startupMessage);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        log.error('server.startup', `Port ${PORT} is already in use. Please choose another port or stop the existing process.`);
    } else {
        log.error('server.startup', 'An unexpected error occurred during server startup', { 
            error: err.message, 
            stack: err.stack 
        });
    }
    process.exit(1);
});

module.exports = server;