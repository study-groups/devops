/**
 * New Authentication Routes - Clean PData Integration
 * 
 * This replaces the old auth.js routes with clean PData integration:
 * 1. Uses PData for all user validation
 * 2. Generates PData tokens instead of custom tokens
 * 3. Provides unified authentication flow
 */

import express from 'express';
import { createRequire } from 'module';
import { authMiddleware, generatePDataToken, requireAdmin } from '../middleware/auth.js';

// Create a require function for JSON import
const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

const router = express.Router();

// ===== PUBLIC ROUTES (NO AUTH REQUIRED) =====

/**
 * Login with username/password
 * Creates a Passport session and returns user info
 */
router.post('/login', (req, res, next) => {
    console.log('[AUTH DEBUG] Login request received. Body:', req.body);
    console.log('[AUTH DEBUG] Content-Type:', req.get('Content-Type'));
    
    const username = req.body.username;
    const password = req.body.password;
    const logPrefix = `[AUTH /login] User='${username}' -`;

    console.log(`${logPrefix} Received login request.`);
    if (!username || !password) {
        console.log('[AUTH DEBUG] Missing credentials. Username:', !!username, 'Password:', !!password);
        return res.status(400).json({ error: 'Username and password are required' });
    }
    if (!req.pdata) {
        return res.status(500).json({ error: 'Internal Server Error: Auth service misconfiguration.' });
    }

    console.log(`${logPrefix} Validating credentials using PData instance...`);
    try {
        // 1. Validate password using PData
        const isValid = req.pdata.validateUser(username, password);

        if (isValid) {
            console.log(`${logPrefix} Validation successful. Proceeding with Passport authentication.`);

            // Create the user object that Passport will work with
            const user = { username: username };

            // 2. Establish Passport session
            req.login(user, (err) => {
                if (err) {
                    console.error(`${logPrefix} Error during req.login (serialization):`, err);
                    return next(err);
                }
                
                console.log(`${logPrefix} Session established via req.login.`);
                const role = req.pdata.getUserRole(user.username);

                // 3. Send success response to client
                return res.json({
                    user: {
                        username: user.username,
                        role: role
                    }
                });
            });
        } else {
            console.log(`${logPrefix} Invalid credentials.`);
            return res.status(401).json({ error: 'Invalid username or password' });
        }
    } catch (error) {
        console.error(`${logPrefix} UNEXPECTED ERROR during login process:`, error);
        return res.status(500).json({ error: 'An internal error occurred during login.' });
    }
});

/**
 * Verify credentials without creating a session
 */
router.post('/verify', (req, res) => {
    console.log('[AUTH DEBUG] Verify request received. Body:', req.body);
    
    const { username, password } = req.body;
    const logPrefix = `[AUTH /verify] User='${username}' -`;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required for verification' });
    }
    if (!req.pdata) {
        return res.status(500).json({ error: 'Internal Server Error: Auth service misconfiguration.' });
    }

    try {
        const isValid = req.pdata.validateUser(username, password);

        if (isValid) {
            console.log(`${logPrefix} Verification successful.`);
            const role = req.pdata.getUserRole(username);
            return res.json({
                success: true,
                user: {
                    username: username,
                    role: role
                }
            });
        } else {
            console.log(`${logPrefix} Invalid credentials for verification.`);
            return res.status(401).json({ success: false, error: 'Invalid username or password' });
        }
    } catch (error) {
        console.error(`${logPrefix} UNEXPECTED ERROR during verification:`, error);
        return res.status(500).json({ error: 'An internal error occurred during verification.' });
    }
});

// ===== PROTECTED ROUTES (AUTH REQUIRED) =====

/**
 * Get current user authentication status
 */
router.get('/user', (req, res) => {
    if (req.isAuthenticated() && req.user) {
        const role = req.pdata ? req.pdata.getUserRole(req.user.username) : 'unknown';
        const sessionInfo = {
            id: req.session.id,
            expires: req.session.cookie.expires ? new Date(req.session.cookie.expires).toLocaleString() : 'Session',
        };

        res.json({
            isAuthenticated: true,
            user: {
                username: req.user.username,
                role: role,
                authMethod: req.authMethod || 'session'
            },
            session: sessionInfo
        });
    } else {
        // User is not authenticated. Send a 200 OK with isAuthenticated: false.
        res.status(200).json({ isAuthenticated: false, user: null });
    }
});

/**
 * Generate a PData API token for the authenticated user
 */
router.post('/token/generate', async (req, res) => {
    try {
        // Check if user is authenticated via session
        if (!req.isAuthenticated() || !req.user) {
            return res.status(401).json({ error: 'Authentication required - please log in first' });
        }
        
        const { expiryHours = 24, description = 'API Access Token' } = req.body;
        
        // Generate PData token
        console.log(`[AUTH /token/generate] Generating token for user: ${req.user.username}`);
        const tokenData = await generatePDataToken(req, expiryHours, description);
        
        console.log(`[AUTH /token/generate] Generated PData token for user: ${req.user.username}, expires in ${expiryHours} hours`);
        
        res.json({
            success: true,
            token: tokenData.token,
            expiresAt: tokenData.expiresAt,
            expiresIn: tokenData.expiresIn,
            description,
            usage: {
                curl: `curl -H "Authorization: Bearer ${tokenData.token}" ${req.protocol}://${req.get('host')}/api/files/content?pathname=example.md`,
                javascript: `fetch('/api/files/content?pathname=example.md', { headers: { 'Authorization': 'Bearer ${tokenData.token}' } })`
            }
        });
    } catch (error) {
        console.error('[AUTH /token/generate] Error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate token' });
    }
});

/**
 * Get system status (authenticated users only)
 */
router.get('/system', authMiddleware, (req, res) => {
    res.json({
        message: "System status OK.",
        timestamp: Date.now(),
        pdataDataRoot: req.pdata.dataRoot,
        pdataUploadsDir: req.pdata.uploadsDir,
        authMethod: req.authMethod,
        user: {
            username: req.user.username,
            role: req.pdata.getUserRole(req.user.username)
        }
    });
});

/**
 * Logout and destroy session
 */
router.post('/logout', (req, res, next) => {
    const username = req.user?.username || 'unknown user';
    console.log(`[AUTH /logout] User='${username}' - Received logout request.`);

    req.logout((err) => {
        if (err) {
            console.error(`[AUTH /logout] Error during req.logout for user '${username}':`, err);
            return next(err);
        }

        req.session.destroy((destroyErr) => {
            if (destroyErr) {
                console.error(`[AUTH /logout] Error destroying session for user '${username}':`, destroyErr);
            }
            console.log(`[AUTH /logout] User='${username}' logged out successfully.`);
            res.clearCookie('devpages.sid'); // Clear the session cookie
            res.json({ success: true, message: 'Logged out successfully' });
        });
    });
});

// ===== ADMIN ROUTES =====

/**
 * Get detailed system information (admin only)
 */
router.get('/admin/system', authMiddleware, requireAdmin, (req, res) => {
    try {
        const systemStatus = req.pdata.getSystemStatus();
        const userCount = req.pdata.listUsers().length;
        const usersWithRoles = req.pdata.listUsersWithRoles();
        
        res.json({
            message: "Admin system status",
            timestamp: Date.now(),
            pdata: systemStatus,
            users: {
                count: userCount,
                roles: usersWithRoles
            },
            server: {
                version: pkg.version,
                nodeVersion: process.version,
                platform: process.platform,
                uptime: process.uptime()
            }
        });
    } catch (error) {
        console.error('[AUTH /admin/system] Error:', error);
        res.status(500).json({ error: 'Failed to retrieve system information' });
    }
});

export default router;
