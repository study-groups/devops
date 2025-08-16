import express from 'express';
import path from 'path';
import { createRequire } from 'module'; // Import createRequire
import session from 'express-session'; // Assuming session is used here for login
import passport from 'passport';
import { authMiddleware, generateApiToken, revokeApiToken, getUserTokens } from '../middleware/auth.js';
import { env, uploadsDirectory, imagesDirectory } from '../config.js';

// Create a require function for JSON import
const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

const router = express.Router();

// Public routes (no auth required)
// --- REMOVED /salt route as getUserSalt is no longer exported and validation handles it ---
// router.get('/salt', (req, res) => { ... }); // Removed this entire route

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    // Check if the request is authenticated (via Passport session)
    // AND if the authenticated user has the 'admin' role according to PData.
    if (req.isAuthenticated() && req.pdata && req.pdata.getUserRole(req.user?.username) === 'admin') {
        return next(); // Allow access
    }
    // Deny otherwise
    res.status(403).json({ error: 'Forbidden: Admin privileges required' });
};

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
        // 1. Validate password using your custom PData logic
        const isValid = req.pdata.validateUser(username, password);

        if (isValid) {
            console.log(`${logPrefix} Validation successful. Proceeding with Passport authentication.`);
            // Create the user object that Passport will work with
            const user = { username: username };

            // 2. Establish Passport session
            // `req.login` is provided by Passport. It calls `passport.serializeUser`
            // to store the user identifier ('username') in the session.
            req.login(user, (err) => {
                if (err) {
                    // This typically catches errors during serialization
                    console.error(`${logPrefix} Error during req.login (serialization):`, err);
                    return next(err);
                }
                // 3. Login and serialization successful - Session cookie should be set on the response now.
                console.log(`${logPrefix} Session established via req.login.`);
                const role = req.pdata.getUserRole(user.username);

                // 4. Send success response to client
                return res.json({ // Status 200 OK (default)
                    user: {
                        username: user.username,
                        role: role
                    }
                });
            });
        } else {
            // Password validation failed
            console.log(`${logPrefix} Invalid credentials.`);
            return res.status(401).json({ error: 'Invalid username or password' });
        }
    } catch (error) {
        // Catch errors during pdata.validateUser or other synchronous issues
        console.error(`${logPrefix} UNEXPECTED ERROR during login process:`, error);
        return res.status(500).json({ error: 'An internal error occurred during login.' });
    }
});

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
            // Return user data without creating a session
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

// Protected routes (auth required)
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

// Token management routes (require authentication)
router.post('/token/generate', authMiddleware, (req, res) => {
    try {
        const username = req.user.username;
        const { expiryHours = 24, description = 'API Access Token' } = req.body;
        
        // Convert hours to milliseconds
        const expiryMs = expiryHours * 60 * 60 * 1000;
        
        // Generate token
        const tokenData = generateApiToken(username, expiryMs);
        
        console.log(`[AUTH /token/generate] Generated token for user: ${username}, expires in ${expiryHours} hours`);
        
        res.json({
            success: true,
            token: tokenData.token,
            expiresAt: tokenData.expiresAt,
            expiresIn: tokenData.expiresIn,
            description,
            usage: {
                curl: `curl -H "Authorization: Bearer ${tokenData.token}" ${req.protocol}://${req.get('host')}/api/files/content?pathname=themes/classic/core.css`,
                javascript: `fetch('/api/files/content?pathname=themes/classic/core.css', { headers: { 'Authorization': 'Bearer ${tokenData.token}' } })`
            }
        });
    } catch (error) {
        console.error('[AUTH /token/generate] Error:', error);
        res.status(500).json({ error: 'Failed to generate token' });
    }
});

router.get('/tokens', authMiddleware, (req, res) => {
    try {
        const username = req.user.username;
        const tokens = getUserTokens(username);
        
        res.json({
            success: true,
            tokens,
            count: tokens.length
        });
    } catch (error) {
        console.error('[AUTH /tokens] Error:', error);
        res.status(500).json({ error: 'Failed to retrieve tokens' });
    }
});

router.delete('/token/:tokenPreview', authMiddleware, (req, res) => {
    try {
        const username = req.user.username;
        const tokenPreview = req.params.tokenPreview;
        
        // Find the full token by preview (first 8 characters)
        const userTokens = getUserTokens(username);
        const tokenToRevoke = userTokens.find(t => t.tokenPreview.startsWith(tokenPreview));
        
        if (!tokenToRevoke) {
            return res.status(404).json({ error: 'Token not found' });
        }
        
        // Note: This is a simplified approach. In production, you'd want to store
        // token IDs or have a more secure way to identify tokens for revocation.
        res.json({
            success: true,
            message: 'Token revocation endpoint available but requires full token for security',
            hint: 'Use POST /auth/token/revoke with the full token in the body'
        });
    } catch (error) {
        console.error('[AUTH /token/revoke] Error:', error);
        res.status(500).json({ error: 'Failed to revoke token' });
    }
});

router.post('/token/revoke', authMiddleware, (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }
        
        const revoked = revokeApiToken(token);
        
        if (revoked) {
            res.json({ success: true, message: 'Token revoked successfully' });
        } else {
            res.status(404).json({ error: 'Token not found or already expired' });
        }
    } catch (error) {
        console.error('[AUTH /token/revoke] Error:', error);
        res.status(500).json({ error: 'Failed to revoke token' });
    }
});

const activeUsers = new Map(); // Store active users and their last activity

// Update active users
function updateActiveUser(username) {
    activeUsers.set(username, Date.now());
    // Simple cleanup for inactive users (more than 1 hour old)
    const hourAgo = Date.now() - 60 * 60 * 1000;
    for (const [user, lastSeen] of activeUsers.entries()) {
        if (lastSeen < hourAgo) {
            activeUsers.delete(user);
        }
    }
}

// Add this route to get detailed system info
router.get('/system', authMiddleware, (req, res) => {
    res.json({
        message: "System status OK.",
        timestamp: Date.now(),
        pdataDbRoot: req.pdata.dbRoot,
        pdataDataRoot: req.pdata.dataRoot,
        pdataUploadsDir: req.pdata.uploadsDir
    });
});

// Logout route
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
             res.clearCookie('connect.sid'); // Or your session cookie name
             res.json({ success: true, message: 'Logged out successfully' });
        });
    });
});

// TODO: Add routes for adding/deleting/managing users if needed, using userUtils
// Example: Add user (requires admin)
// router.post('/users', isAdmin, async (req, res) => {
//    try {
//        const { username, password, role } = req.body;
//        const success = await userUtils.addUser(req.pdata, username, password, role);
//        if (success) {
//            res.status(201).json({ success: true });
//        } else {
//            res.status(409).json({ error: 'User already exists or invalid input' });
//        }
//    } catch (error) {
//        console.error("[AUTH /users POST] Error:", error);
//        res.status(500).json({ error: 'Failed to add user' });
//    }
// });

// module.exports = router; // Old CommonJS export
export default router; // New ESM export 