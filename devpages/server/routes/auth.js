import express from 'express';
import path from 'path';
import { createRequire } from 'module'; // Import createRequire
import session from 'express-session'; // Assuming session is used here for login

// Import utilities and middleware using ESM
import { validateUser, getUserSalt, loadUsers, hashPassword } from '../../pdata/userUtils.js'; // Updated path
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

    if (!username) {
        console.log('[AUTH ERROR] No username provided in salt request');
        return res.status(400).json({ error: 'Username required' });
    }

    if (!req.pdata || !req.pdata.pdDir) {
        console.error('[AUTH /salt ERROR] PData instance or pdDir missing from request object.');
        return res.status(500).json({ error: 'Internal server configuration error (PData)' });
    }

    const usersCsvPath = path.join(req.pdata.pdDir, 'users.csv');
    console.log(`[AUTH /salt] Looking for user in: ${usersCsvPath}`);

    const salt = getUserSalt(username, usersCsvPath);
    if (!salt) {
        console.log(`[AUTH ERROR] Salt not found for user: ${username}`);
        return res.status(404).json({ error: 'User not found' });
    }

    console.log(`[AUTH /salt] Returning salt for user: ${username}`);
    res.json({ salt });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const logPrefix = `[AUTH /login] User='${username}' -`; // Add prefix for easier filtering
    console.log(`${logPrefix} Received login request.`);

    if (!username || !password) {
        console.log(`${logPrefix} ERROR: Username or password missing.`);
        return res.status(400).json({ error: 'Username and password required' });
    }

    try {
        if (!req.pdata || !req.pdata.pdDir) {
             console.error(`${logPrefix} ERROR: PData instance or pdDir missing from request object.`);
             return res.status(500).json({ error: 'Internal server configuration error (PData)' });
        }
        const usersCsvPath = path.join(req.pdata.pdDir, 'users.csv');
        console.log(`${logPrefix} Attempting to load users from: ${usersCsvPath}`);

        const users = loadUsers(usersCsvPath);
        console.log(`${logPrefix} Loaded ${users.size} users. Keys: [${Array.from(users.keys()).join(', ')}]`);

        const userAuthData = users.get(username);

        if (!userAuthData) {
            console.log(`${logPrefix} LOOKUP FAILED: Username not found in loaded users map.`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        console.log(`${logPrefix} User found in map. Salt: ${userAuthData.salt?.slice(0, 10)}... Stored Hash: ${userAuthData.hash?.slice(0, 10)}...`);

        console.log(`${logPrefix} Hashing provided password...`);
        const receivedPasswordHash = hashPassword(password, userAuthData.salt);

        if (!receivedPasswordHash) {
             console.error(`${logPrefix} HASHING FAILED: hashPassword function returned null.`);
             return res.status(500).json({ error: 'Server error during password processing.' });
        }

        const isMatch = receivedPasswordHash === userAuthData.hash;
        console.log(`${logPrefix} Comparing Hashes:`);
        console.log(`   Stored Hash  : ${userAuthData.hash}`);
        console.log(`   Received Hash: ${receivedPasswordHash}`);
        console.log(`   Match?       : ${isMatch}`);

        if (!isMatch) {
             console.log(`${logPrefix} HASH MISMATCH: Password validation failed.`);
             return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log(`${logPrefix} Password validation successful.`);
        const userRole = req.pdata.getUserRole(username);

        if (!userRole) {
            console.error(`[AUTH /login ERROR] User '${username}' authenticated but has no role defined in PData/roles.csv.`);
            return res.status(403).json({ error: 'Login failed: User role not configured.' });
        }
        console.log(`${logPrefix} Role found: '${userRole}'. Proceeding with session creation...`);

        req.session.regenerate((err) => {
            if (err) {
                console.error(`${logPrefix} ERROR: Session regeneration failed:`, err);
                return res.status(500).json({ error: 'Login session error' });
            }
            req.session.user = {
                username: username,
                role: userRole,
            };
            console.log(`${logPrefix} New Session ID after regenerate: ${req.session.id}`);
            console.log(`${logPrefix} Session data set. Preparing success response.`);

            req.session.save(err => {
                if (err) {
                    console.error(`${logPrefix} ERROR: Session save error:`, err);
                    return res.status(500).json({ error: 'Login failed (session error)' });
                }
                console.log(`${logPrefix} Session saved for user '${username}'. Session ID: ${req.session.id}`);
                res.json({
                     success: true,
                     user: {
                         username: username,
                         role: userRole
                     }
                 });
            });
        });

    } catch (error) {
        console.error(`${logPrefix} UNEXPECTED ERROR during login process:`, error);
        res.status(500).json({ error: 'Internal server error during login' });
    }
});

// THIS IS NOT USED ANYMORE
router.get('/config', (req, res) => {
    // Use imports from the top level
    console.log('[CONFIG] Gathering environment information');
    const safeConfig = {
        NODE_ENV: env.NODE_ENV,
        PJ_DIR: env.PJ_DIR,
        MD_DIR: env.MD_DIR,
        PORT: env.PORT,
        SERVER_TIME: new Date().toISOString(),
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
    if (req.user && req.user.username && req.user.role) {
        res.json({
            username: req.user.username,
            role: req.user.role
        });
    } else {
        console.warn('[AUTH /user WARN] Auth middleware passed, but user/role missing from session:', req.session);
        res.status(401).json({ error: 'User session data incomplete.' });
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
    if (!req.user) {
         return res.status(401).json({ error: 'User not authenticated' });
    }
    updateActiveUser(req.user.username);

    const usersCsvPath = path.join(req.pdata.pdDir, 'users.csv');
    const rolesCsvPath = path.join(req.pdata.pdDir, 'roles.csv');

    const systemInfo = {
        environment: {
            NODE_ENV: process.env.NODE_ENV || 'development',
            PORT: process.env.PORT || 4000,
            VERSION: process.env.VERSION || pkg.version || 'dev'
        },
        paths: {
            MD_DIR_Set: !!process.env.MD_DIR,
            PD_DIR_Set: !!process.env.PD_DIR,
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