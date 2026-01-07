const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const router = express.Router();

const testsRoutes = require('./tests');
const savedCommandsRoutes = require('./saved-commands');
const playwrightApiRoutes = require('./playwright-api');
const logsRoutes = require('./logs');
const systemRoutes = require('./system');
const docsRoutes = require('./docs');
const iconsRoutes = require('./icons');
const { router: cronRoutes } = require('./cron');

// Helper to extract user from HTTP Basic Auth (shared utility)
function getCurrentUser(req) {
    // Debug: log all headers to see what we're getting
    console.log('[AUTH DEBUG] All headers:', Object.keys(req.headers));
    console.log('[AUTH DEBUG] Authorization header:', req.headers.authorization);
    console.log('[AUTH DEBUG] Remote-User header:', req.headers['remote-user']);
    console.log('[AUTH DEBUG] X-Remote-User header:', req.headers['x-remote-user']);
    console.log('[AUTH DEBUG] X-Forwarded-User header:', req.headers['x-forwarded-user']);
    
    // Try different ways nginx might pass the user info
    
    // Method 1: Direct Authorization header (if nginx passes it through)
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Basic ')) {
        try {
            const credentials = Buffer.from(auth.slice(6), 'base64').toString('utf-8');
            const [username] = credentials.split(':');
            console.log('[AUTH DEBUG] Found user via Authorization header:', username);
            return username || 'anonymous';
        } catch (error) {
            console.warn('Error parsing basic auth:', error);
        }
    }
    
    // Method 2: Remote-User header (common nginx setup)
    if (req.headers['remote-user']) {
        console.log('[AUTH DEBUG] Found user via Remote-User header:', req.headers['remote-user']);
        return req.headers['remote-user'];
    }
    
    // Method 3: X-Remote-User header (another common setup)
    if (req.headers['x-remote-user']) {
        console.log('[AUTH DEBUG] Found user via X-Remote-User header:', req.headers['x-remote-user']);
        return req.headers['x-remote-user'];
    }
    
    // Method 4: X-Forwarded-User header
    if (req.headers['x-forwarded-user']) {
        console.log('[AUTH DEBUG] Found user via X-Forwarded-User header:', req.headers['x-forwarded-user']);
        return req.headers['x-forwarded-user'];
    }
    
    console.log('[AUTH DEBUG] No user found, returning anonymous');
    return 'anonymous';
}
const astRoutes = require('./ast');
const matrixRoutes = require('./matrix');
const monitoringRoutes = require('./monitoring');
const resultsRoutes = require('./results');

// User info endpoint for dashboard
router.get('/user', (req, res) => {
    console.log('[USER] All headers:', JSON.stringify(req.headers, null, 2));
    
    const user = req.get('Remote-User') || 
                 req.get('X-Remote-User') || 
                 req.get('X-Forwarded-User') || 
                 req.headers['remote-user'] ||
                 req.headers['x-remote-user'] ||
                 req.headers['x-forwarded-user'] ||
                 'dev';
    
    console.log('[USER] Extracted user:', user);
    
    res.json({ 
        user: user,
        isAuthenticated: true,
        timestamp: new Date().toISOString()
    });
});

// API routes
router.use('/tests', testsRoutes);
router.use('/saved-commands', savedCommandsRoutes);
router.use('/playwright', playwrightApiRoutes);
router.use('/command', playwrightApiRoutes); // Alias for command runner
router.use('/logs', logsRoutes);
router.use('/cron', cronRoutes);
router.use('/system', systemRoutes);
router.use('/docs', docsRoutes);
router.use('/icons', iconsRoutes);
router.use('/ast', astRoutes);
router.use('/matrix', matrixRoutes);
router.use('/monitoring', monitoringRoutes);
router.use('/results', resultsRoutes);

// Alias routes for backward compatibility
router.use('/environment', systemRoutes); // Alias to /system/environment
router.use('/stats', systemRoutes); // Alias to /system/stats
router.use('/system-logs', logsRoutes); // Alias to /logs/system
// Direct source route for frontend compatibility
// We'll handle this differently in the main server file

// Debugging middleware to log all routes
router.use((req, res, next) => {
    console.log(`[API ROUTES] Received ${req.method} request to ${req.path}`);
    next();
});

// Fallback route to handle undefined API routes
router.use((req, res) => {
    console.log(`[API ROUTES] 404 Not Found: ${req.method} ${req.path}`);
    res.status(404).json({ 
        error: 'Not Found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
