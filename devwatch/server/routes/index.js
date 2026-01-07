/**
 * Index Routes - Main Admin Dashboard
 * 
 * Serves the main admin interface (previously admin-server.js functionality)
 */

const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const router = express.Router();

// Main dashboard (root route) - serves the main admin interface
router.get('/', async (req, res) => {
    try {
        // Serve the main dashboard from its proper location
        const indexHtmlPath = path.join(__dirname, '..', 'static', 'dashboard', 'index.html');
        const indexHtml = await fs.readFile(indexHtmlPath, 'utf8');
        res.send(indexHtml);
    } catch (error) {
        const { error: logError } = require('../utils/logging');
        logError('Error serving main dashboard', { error: error.message, stack: error.stack });
        res.status(500).send(`
            <html>
                <head><title>Error</title></head>
                <body style="font-family: monospace; background: #1a1a1a; color: #e0e0e0; padding: 20px;">
                    <h1 style="color: #f44336;">Error Loading Playwright Server</h1>
                    <p>Could not load main interface: ${error.message}</p>
                    <p><a href="/health" style="color: #4CAF50;">Check Server Health</a></p>
                </body>
            </html>
        `);
    }
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        server: 'Playwright Server',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        pid: process.pid,
        version: process.version,
        environment: {
            NODE_ENV: process.env.NODE_ENV || 'development',
            PW_DIR: req.app.locals.PW_DIR
        }
    });
});

// Legacy admin route (redirect to root)
router.get('/admin', (req, res) => {
    res.redirect('/');
});

// DevWatch Dashboard (Terrain-based UI)
router.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'static', 'dashboard.html'));
});

module.exports = router;