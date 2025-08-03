import express from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.pdata && req.pdata.getUserRole(req.user?.username) === 'admin') {
        return next();
    }
    res.status(403).json({ error: 'Forbidden: Admin privileges required' });
};

// GET /api/users/:username - Get user details
router.get('/:username', authMiddleware, isAdmin, async (req, res) => {
    const { username } = req.params;
    const pdata = req.pdata;

    try {
        const role = pdata.getUserRole(username);

        if (!role) {
            return res.status(404).json({ error: 'User not found' });
        }

        // This is a placeholder for a more comprehensive user model.
        // We will expand this as we build out the user management features.
        const userProfile = {
            username,
            role,
            status: 'active', // Assuming all users in roles.csv are active for now
            createdAt: 'N/A', // Placeholder
            lastLoginAt: 'N/A', // Placeholder
            stats: {
                fileCount: 0, // Placeholder
                storageUsedBytes: 0, // Placeholder
                storageQuotaBytes: 0, // Placeholder
            }
        };

        res.json(userProfile);
    } catch (error) {
        console.error(`[API /api/users/:username] Error:`, error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
