const express = require('express');
const router = express.Router();
const { validateUser, getUserSalt } = require('../utils/userUtils');
const { authMiddleware } = require('../middleware/auth');
const path = require('path');

// Public routes (no auth required)
router.get('/salt', (req, res) => {
    const username = req.query.username;
    console.log(`[AUTH] Salt request for user: ${username}`);
    console.log(`[AUTH] Using users file: ${path.resolve(require('../utils/userUtils').USERS_FILE)}`);
    
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
    const { username, hashedPassword } = req.body;
    
    if (!username || !hashedPassword) {
        return res.status(400).json({ error: 'Username and password required' });
    }

    if (validateUser(username, hashedPassword)) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

router.get('/config', (req, res) => {
    const { env } = require('../config');
    const { USERS_FILE } = require('../utils/userUtils');
    
    console.log('[CONFIG] Gathering environment information');
    const safeConfig = {
        NODE_ENV: env.NODE_ENV,
        PJ_DIR: env.PJ_DIR,
        MD_DIR: env.MD_DIR,
        PORT: env.PORT,
        SERVER_TIME: new Date().toISOString(),
        USERS_FILE: path.resolve(USERS_FILE),
        UPLOADS_DIR: path.resolve(require('../config').uploadsDirectory),
        IMAGES_DIR: path.resolve(require('../config').imagesDirectory),
        VERSION: require('../../package.json').version || 'dev'
    };
    
    console.log('[CONFIG] Configuration values:');
    Object.entries(safeConfig).forEach(([key, value]) => {
        console.log(`[CONFIG] ${key.padEnd(15)} = ${value}`);
    });
    
    res.json(safeConfig);
});

// Protected routes (auth required)
router.get('/user', authMiddleware, (req, res) => {
    res.json({ username: req.auth.name });
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
    updateActiveUser(req.auth.name);
    
    const systemInfo = {
        environment: {
            NODE_ENV: process.env.NODE_ENV || 'development',
            PORT: process.env.PORT || 4000,
            VERSION: process.env.VERSION || 'dev'
        },
        paths: {
            MD_DIR: process.env.MD_DIR,
            MD_PWD: path.join(process.env.MD_DIR, req.auth.name),
            PJ_DIR: process.env.PJ_DIR,
            IMAGES_DIR: process.env.IMAGES_DIR,
            USERS_FILE: process.env.PJA_USERS_CSV
        },
        server: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            activeUsers: Array.from(activeUsers.entries()).map(([user, lastSeen]) => ({
                username: user,
                lastSeen: new Date(lastSeen).toISOString(),
                isCurrentUser: user === req.auth.name
            }))
        }
    };

    res.json(systemInfo);
});

module.exports = router; 