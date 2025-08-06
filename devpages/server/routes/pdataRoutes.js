// server/routes/pdataRoutes.js

import express from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// This middleware will apply to all routes in this file
router.use(authMiddleware);

// Helper to check for admin role
const isAdmin = (req, res, next) => {
    const userRole = req.pdata.getUserRole(req.user.username);
    if (userRole === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
};

/**
 * GET /api/pdata/mount-info
 * Get detailed information about the system's mount points.
 * Admin only.
 */
router.get('/mount-info', isAdmin, (req, res) => {
    try {
        const mountInfo = req.pdata.mountManager.getMountInfo();
        res.json(mountInfo);
    } catch (error) {
        console.error('[API /pdata/mount-info] Error:', error);
        res.status(500).json({ error: 'Failed to retrieve mount information' });
    }
});

/**
 * GET /api/pdata/users/list
 * Get a list of all users and their roles.
 * Admin only.
 */
router.get('/users/list', isAdmin, (req, res) => {
    try {
        const users = req.pdata.listUsersWithRoles();
        res.json(users);
    } catch (error) {
        console.error('[API /pdata/users/list] Error:', error);
        res.status(500).json({ error: 'Failed to retrieve user list' });
    }
});

export default router;
