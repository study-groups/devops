import express from 'express';
import path from 'path';
import { createRequire } from 'module'; // Import createRequire

// Import utilities and middleware using ESM
import { validateUser, getUserSalt, loadUsers, hashPassword, USERS_FILE } from '../utils/userUtils.js';
import { authMiddleware } from '../middleware/auth.js';
import { env, uploadsDirectory, imagesDirectory } from '../config.js';

// Create a require function for JSON import
const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

const router = express.Router();

// Public routes (no auth required)
router.get('/salt', (req, res) => {
    const username = req.query.username;
    console.log(`[AUTH] Salt request for user: ${username}`);
    // Use imported USERS_FILE constant
    console.log(`[AUTH] Using users file: ${path.resolve(USERS_FILE)}`);

    if (!username) {
        console.log('[AUTH ERROR] No username provided in salt request');
        return res.status(400).json({ error: 'Username required' });
    }

    const salt = getUserSalt(username);
    if (!salt) {
        console.log(`[AUTH ERROR] Salt not found for user: ${username}`);
        return res.status(404).json({ error: 'User not found' });
    }

    console.log(`[AUTH] Returning salt for user: ${username}`);
    res.json({ salt });
});

router.post('/login', (req, res) => {
    // Expect PLAIN password from client
    const { username, password } = req.body;

    console.log('[AUTH /login] Received body:', { username, password: '[REDACTED]' });

    if (!username || !password) {
        console.log('[AUTH /login ERROR] Username or password missing');
        return res.status(400).json({ error: 'Username and password required' });
    }

    try {
        const users = loadUsers();
        const user = users.get(username);

        if (!user) {
            console.log(`[AUTH /login] User not found: ${username}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Hash the received plain password with the user's stored salt
        const receivedPasswordHash = hashPassword(password, user.salt);

        if (!receivedPasswordHash) {
             console.error(`[AUTH /login ERROR] Server-side hashing failed for user: ${username}`);
             return res.status(500).json({ error: 'Login processing error' });
        }

        console.log(`[AUTH /login] Comparing password hashes for user: ${username}`);
        // Compare the newly generated hash with the stored hash
        if (receivedPasswordHash === user.hash) {
            console.log(`[AUTH /login] Password validation successful for user: ${username}`);
            // --- Session Creation --- 
            req.session.regenerate((err) => { // Regenerate session to prevent fixation
                 if (err) {
                     console.error('[AUTH /login ERROR] Session regeneration failed:', err);
                     return res.status(500).json({ error: 'Login session error' });
                 }
                 req.session.user = {
                     username: username,
                     loggedIn: true
                 };
                 console.log(`[AUTH] Session created for user: ${username}`);
                 res.json({ success: true });
            });
            // --- End Session Creation ---
        } else {
            console.log(`[AUTH /login] Password validation failed for user: ${username}`);
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('[AUTH /login ERROR] Error during login process:', error);
        res.status(500).json({ error: 'Internal server error during login' });
    }
});

router.get('/config', (req, res) => {
    // Use imports from the top level
    console.log('[CONFIG] Gathering environment information');
    const safeConfig = {
        NODE_ENV: env.NODE_ENV,
        PJ_DIR: env.PJ_DIR,
        MD_DIR: env.MD_DIR,
        PORT: env.PORT,
        SERVER_TIME: new Date().toISOString(),
        USERS_FILE: path.resolve(USERS_FILE),
        UPLOADS_DIR: path.resolve(uploadsDirectory),
        IMAGES_DIR: path.resolve(imagesDirectory),
        VERSION: pkg.version || 'dev'
    };

    console.log('[CONFIG] Configuration values:');
    Object.entries(safeConfig).forEach(([key, value]) => {
        console.log(`[CONFIG] ${key.padEnd(15)} = ${value}`);
    });

    res.json(safeConfig);
});

// Protected routes (auth required)
router.get('/user', authMiddleware, (req, res) => {
    // req.user is attached by authMiddleware if session is valid
    if (req.user) {
        res.json({ username: req.user.username });
    } else {
        // This case shouldn't be reached if authMiddleware is working, but good practice
        res.status(401).json({ error: 'User not authenticated' });
    }
});

const activeUsers = new Map(); // Store active users and their last activity

// Update active users
function updateActiveUser(username) {
    activeUsers.set(username, Date.now());
    // Clean up inactive users (more than 1 hour old)
    for (const [user, lastSeen] of activeUsers.entries()) {
        if (Date.now() - lastSeen > 60 * 60 * 1000) {
            activeUsers.delete(user);
        }
    }
}

// Add this route to get detailed system info
router.get('/system', authMiddleware, (req, res) => {
    if (!req.user) { // Check if user exists from middleware
         return res.status(401).json({ error: 'User not authenticated' });
    }
    updateActiveUser(req.user.username);

    const systemInfo = {
        environment: {
            NODE_ENV: process.env.NODE_ENV || 'development',
            PORT: process.env.PORT || 4000,
            VERSION: process.env.VERSION || pkg.version || 'dev'
        },
        paths: {
            MD_DIR: process.env.MD_DIR,
            MD_PWD: path.join(process.env.MD_DIR, req.user.username),
            PJ_DIR: process.env.PJ_DIR,
            IMAGES_DIR: process.env.IMAGES_DIR, // Should use imported imagesDirectory?
            USERS_FILE: process.env.PJA_USERS_CSV // Should use imported USERS_FILE?
        },
        server: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            activeUsers: Array.from(activeUsers.entries()).map(([user, lastSeen]) => ({
                username: user,
                lastSeen: new Date(lastSeen).toISOString(),
                isCurrentUser: user === req.user.username
            }))
        }
    };

    res.json(systemInfo);
});

// Logout route
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('[AUTH Logout Error]', err);
            return res.status(500).json({ error: 'Could not log out, please try again.' });
        }
        res.clearCookie('connect.sid'); // Use the default session cookie name, adjust if different
        console.log('[AUTH] Session destroyed successfully.');
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// module.exports = router; // Old CommonJS export
export default router; // New ESM export 